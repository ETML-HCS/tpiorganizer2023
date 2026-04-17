const express = require('express')

const TpiPlanning = require('../models/tpiPlanningModel')
const Vote = require('../models/voteModel')
const { requireNonEmptyBody, requireYearParam } = require('../middleware/requestValidation')
const { authMiddleware, requireRole } = require('../services/magicLinkService')
const magicLinkV2Service = require('../services/magicLinkV2Service')
const {
  publishConfirmedPlanningSoutenances,
  rollbackPublicationVersion
} = require('../services/publishedSoutenanceService')
const planningValidationService = require('../services/planningValidationService')
const votingCampaignService = require('../services/votingCampaignService')
const workflowService = require('../services/workflowService')
const {
  rebuildWorkflowFromLegacyPlanning
} = require('../services/legacyPlanningBridgeService')

const router = express.Router()
const IS_DEBUG = process.env.NODE_ENV !== 'production' && process.env.REACT_APP_DEBUG === 'true'

function parsePositiveInteger(rawValue, fallbackValue) {
  if (rawValue === undefined) {
    return fallbackValue
  }

  const parsed = Number.parseInt(String(rawValue), 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackValue
  }

  return parsed
}

function parseBoolean(rawValue, fallbackValue = false) {
  if (typeof rawValue === 'boolean') {
    return rawValue
  }

  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase()
    if (normalized === 'true') {
      return true
    }
    if (normalized === 'false') {
      return false
    }
  }

  return fallbackValue
}

function normalizeBaseUrl(rawValue, fallbackValue) {
  if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
    return rawValue.trim().replace(/\/+$/, '')
  }

  return fallbackValue
}

function getFrontendBaseUrl(req) {
  return normalizeBaseUrl(
    req.body?.baseUrl || req.get('origin'),
    `${req.protocol}://${req.get('host')}`
  )
}

async function findDevVoteLinkTarget(year) {
  const tpis = await TpiPlanning.find({
    year,
    status: { $in: ['voting', 'pending_slots'] }
  })
    .populate('candidat expert1 expert2 chefProjet', 'firstName lastName email')
    .sort({ reference: 1 })

  for (const tpi of tpis) {
    const pendingVotes = await Vote.find({
      tpiPlanning: tpi._id,
      decision: 'pending'
    })
      .populate('voter', 'firstName lastName email roles')
      .populate('slot', 'date period startTime endTime room')
      .sort({ voterRole: 1, createdAt: 1 })

    if (!pendingVotes.length) {
      continue
    }

    const byRole = new Map()
    for (const vote of pendingVotes) {
      if (!vote?.voter?.email || byRole.has(vote.voterRole)) {
        continue
      }

      byRole.set(vote.voterRole, vote)
    }

    const requiredRoles = ['expert1', 'expert2', 'chef_projet']
    const votes = requiredRoles
      .map(role => byRole.get(role))
      .filter(Boolean)

    if (votes.length === 0) {
      continue
    }

    return {
      tpi,
      votes
    }
  }

  return null
}

router.get(
  '/:year/planification/validate',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    try {
      const year = req.validatedParams.year
      const includeEntries = parseBoolean(req.query.includeEntries, false)

      const validation = await planningValidationService.validatePlanningForYear(year)

      const response = {
        year: validation.year,
        checkedAt: validation.checkedAt,
        source: validation.source,
        summary: validation.summary,
        issues: validation.issues,
        hardConflicts: validation.hardConflicts
      }

      if (includeEntries) {
        response.entries = validation.entries
      }

      return res.status(200).json(response)
    } catch (error) {
      console.error('Erreur validation planification:', error)
      return res.status(500).json({ error: 'Erreur lors de la validation de la planification.' })
    }
  }
)

router.post(
  '/:year/planification/validate',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    try {
      const year = req.validatedParams.year
      const includeEntries = parseBoolean(req.body?.includeEntries, false)
      const legacyRooms = Array.isArray(req.body?.legacyRooms) && req.body.legacyRooms.length > 0
        ? req.body.legacyRooms
        : null
      let migrationSummary = null

      if (legacyRooms) {
        const workflow = await workflowService.getWorkflowYearState(year)
        if (workflow.state !== 'planning') {
          return res.status(409).json({
            error: 'Validation de la planification impossible hors etat planning.',
            details: {
              year,
              state: workflow.state,
              requiredState: 'planning'
            }
          })
        }

        migrationSummary = await rebuildWorkflowFromLegacyPlanning({
          year,
          legacyRooms,
          createdBy: req.user
        })
      }

      const validation = await planningValidationService.validatePlanningForYear(year)

      const response = {
        year: validation.year,
        checkedAt: validation.checkedAt,
        source: validation.source,
        summary: validation.summary,
        issues: validation.issues,
        hardConflicts: validation.hardConflicts
      }

      if (migrationSummary) {
        response.migrationSummary = migrationSummary
      }

      if (includeEntries) {
        response.entries = validation.entries
      }

      return res.status(200).json(response)
    } catch (error) {
      console.error('Erreur validation planification:', error)
      return res.status(500).json({ error: 'Erreur lors de la validation de la planification.' })
    }
  }
)

router.get(
  '/:year/planification/snapshot',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    try {
      const year = req.validatedParams.year
      const includeEntries = parseBoolean(req.query.includeEntries, false)
      const snapshot = await planningValidationService.getActiveSnapshot(year)

      if (!snapshot) {
        return res.status(404).json({ error: 'Aucun snapshot actif pour cette annee.' })
      }

      const response = {
        year: snapshot.year,
        version: snapshot.version,
        isActive: snapshot.isActive,
        frozenAt: snapshot.frozenAt,
        frozenBy: snapshot.frozenBy,
        hash: snapshot.hash,
        source: snapshot.source,
        validationSummary: snapshot.validationSummary,
        hardConflicts: snapshot.hardConflicts
      }

      if (includeEntries) {
        response.entries = snapshot.entries
      }

      return res.status(200).json(response)
    } catch (error) {
      console.error('Erreur lecture snapshot planification:', error)
      return res.status(500).json({ error: 'Erreur lors de la lecture du snapshot de planification.' })
    }
  }
)

router.post(
  '/:year/planification/freeze',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year
    const allowHardConflicts = parseBoolean(req.body?.allowHardConflicts, false)
    const legacyRooms = Array.isArray(req.body?.legacyRooms) && req.body.legacyRooms.length > 0
      ? req.body.legacyRooms
      : null
    let migrationSummary = null

    try {
      const workflow = await workflowService.getWorkflowYearState(year)

      if (workflow.state !== 'planning') {
        return res.status(409).json({
          error: 'Freeze impossible hors etat planning.',
          details: {
            year,
            state: workflow.state,
            requiredState: 'planning'
          }
        })
      }

      if (legacyRooms) {
        migrationSummary = await rebuildWorkflowFromLegacyPlanning({
          year,
          legacyRooms,
          createdBy: req.user
        })
      }

      const planningCount = await TpiPlanning.countDocuments({ year })
      if (planningCount === 0) {
        migrationSummary = await rebuildWorkflowFromLegacyPlanning({
          year,
          createdBy: req.user
        })
      }

      const result = await planningValidationService.freezePlanningSnapshot({
        year,
        user: req.user,
        allowHardConflicts
      })

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.planification.freeze',
        user: req.user,
        payload: {
          version: result.snapshot.version,
          hash: result.snapshot.hash,
          allowHardConflicts
        },
        success: true
      })

      return res.status(201).json({
        success: true,
        summary: migrationSummary,
        snapshot: {
          year: result.snapshot.year,
          version: result.snapshot.version,
          frozenAt: result.snapshot.frozenAt,
          hash: result.snapshot.hash,
          source: result.snapshot.source,
          validationSummary: result.snapshot.validationSummary
        },
        hardConflicts: result.snapshot.hardConflicts
      })
    } catch (error) {
      if (error instanceof planningValidationService.PlanningFreezeError) {
        await workflowService.logWorkflowAuditEvent({
          year,
          action: 'workflow.planification.freeze',
          user: req.user,
          payload: {
            allowHardConflicts
          },
          success: false,
          error: error.message
        })

        return res.status(error.statusCode || 409).json({
          error: error.message,
          details: error.details
        })
      }

      console.error('Erreur freeze planification:', error)
      return res.status(500).json({ error: 'Erreur lors du freeze de planification.' })
    }
  }
)

router.post(
  '/:year/votes/start',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year
    const legacyRooms = Array.isArray(req.body?.legacyRooms) && req.body.legacyRooms.length > 0
      ? req.body.legacyRooms
      : null
    let migrationSummary = null

    try {
      const workflow = await workflowService.getWorkflowYearState(year)

      if (workflow.state === 'published') {
        return res.status(409).json({
          error: 'Campagne de votes impossible en etat published.',
          details: {
            year,
            state: workflow.state
          }
        })
      }

      if (legacyRooms && workflow.state !== 'planning') {
        return res.status(409).json({
          error: 'La synchronisation legacy est autorisée uniquement avant l ouverture des votes.',
          details: {
            year,
            state: workflow.state,
            requiredState: 'planning'
          }
        })
      }

      const snapshot = await planningValidationService.getActiveSnapshot(year)
      if (workflow.state === 'planning' && !snapshot) {
        return res.status(409).json({
          error: 'Un snapshot actif est requis avant l ouverture des votes. Geler d abord la planification.',
          details: { year, hasSnapshot: false }
        })
      }

      const votingTpiCount = await TpiPlanning.countDocuments({
        year,
        status: { $in: ['voting', 'pending_slots'] }
      })

      if (legacyRooms || votingTpiCount === 0) {
        const existingPlanningCount = await TpiPlanning.countDocuments({ year })
        if (legacyRooms || existingPlanningCount === 0) {
          migrationSummary = await rebuildWorkflowFromLegacyPlanning({
            year,
            legacyRooms,
            createdBy: req.user
          })
        }
      }

      if (workflow.state === 'planning') {
        const validation = await planningValidationService.validatePlanningForYear(year)

        if (!validation.summary?.isValid) {
          return res.status(409).json({
            error: 'La planification courante contient encore des erreurs bloquantes. Corrigez-les puis regeler la planification.',
            details: {
              year,
              snapshotVersion: snapshot?.version || null,
              summary: validation.summary,
              issues: validation.issues
            }
          })
        }

        if (!planningValidationService.isValidationAlignedWithSnapshot(snapshot, validation)) {
          return res.status(409).json({
            error: 'La planification a été modifiée depuis le dernier snapshot. Geler une nouvelle version avant d ouvrir les votes.',
            details: {
              year,
              snapshotVersion: snapshot?.version || null,
              summary: validation.summary,
              issues: validation.issues
            }
          })
        }

        try {
          await workflowService.transitionWorkflowYear({
            year,
            targetState: 'voting_open',
            user: req.user
          })
        } catch (error) {
          if (error instanceof workflowService.WorkflowTransitionError) {
            await workflowService.safeAuditTransitionFailure({
              year,
              user: req.user,
              targetState: 'voting_open',
              error
            })

            return res.status(error.statusCode || 409).json({
              error: error.message,
              details: error.details
            })
          }

          throw error
        }
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`
      const result = await votingCampaignService.startVotesCampaign(year, baseUrl)

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.votes.start',
        user: req.user,
        payload: {
          tpiCount: result.tpiCount,
          totalEmails: result.totalEmails,
          successfulEmails: result.successfulEmails
        },
        success: true
      })

      return res.status(200).json({
        success: true,
        year,
        workflowState: 'voting_open',
        summary: migrationSummary,
        ...result
      })
    } catch (error) {
      console.error('Erreur lancement campagne votes:', error)
      return res.status(500).json({ error: 'Erreur lors du lancement de la campagne de votes.' })
    }
  }
)

async function handleDevVoteLinks(req, res) {
  if (!IS_DEBUG) {
    return res.status(404).json({ error: 'Route indisponible.' })
  }

  const year = req.validatedParams.year

  try {
    const workflow = await workflowService.getWorkflowYearState(year)

    if (workflow.state !== 'voting_open') {
      return res.status(409).json({
        error: 'Le mode test de vote est disponible uniquement quand les votes sont ouverts.',
        details: {
          year,
          state: workflow.state,
          requiredState: 'voting_open'
        }
      })
    }

    const target = await findDevVoteLinkTarget(year)

    if (!target) {
      return res.status(404).json({
        error: 'Aucun vote en attente disponible pour cette annee.'
      })
    }

    const baseUrl = getFrontendBaseUrl(req)
    const links = []

    for (const vote of target.votes) {
      const link = await magicLinkV2Service.createVoteMagicLink({
        year,
        person: vote.voter,
        role: vote.voterRole,
        scope: {
          year,
          tpiId: String(target.tpi._id),
          reference: target.tpi.reference
        },
        baseUrl,
        redirectPath: `/planning/${year}?previewVote=1`
      })

      links.push({
        role: vote.voterRole,
        voter: {
          id: String(vote.voter._id),
          name: `${vote.voter.firstName || ''} ${vote.voter.lastName || ''}`.trim(),
          email: vote.voter.email || ''
        },
        url: link.url,
        token: link.token
      })
    }

    return res.status(200).json({
      success: true,
      year,
      tpiId: String(target.tpi._id),
      reference: target.tpi.reference,
      links
    })
  } catch (error) {
    console.error('Erreur generation liens de test vote:', error)
    return res.status(500).json({
      error: 'Erreur lors de la generation des liens de test de vote.'
    })
  }
}

router.post(
  '/:year/votes/dev-links',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  handleDevVoteLinks
)

router.post(
  '/:year/votes/dev-link',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  handleDevVoteLinks
)

router.post(
  '/:year/votes/remind',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year

    try {
      const workflow = await workflowService.getWorkflowYearState(year)

      if (workflow.state !== 'voting_open') {
        return res.status(409).json({
          error: 'Relance impossible hors etat voting_open.',
          details: {
            year,
            state: workflow.state,
            requiredState: 'voting_open'
          }
        })
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`
      const result = await votingCampaignService.remindPendingVotes(year, baseUrl)

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.votes.remind',
        user: req.user,
        payload: {
          reminderTargets: result.reminderTargets,
          emailsSent: result.emailsSent,
          emailsSucceeded: result.emailsSucceeded
        },
        success: true
      })

      return res.status(200).json({
        success: true,
        year,
        ...result
      })
    } catch (error) {
      console.error('Erreur relance campagne votes:', error)
      return res.status(500).json({ error: 'Erreur lors de la relance des votes.' })
    }
  }
)

router.post(
  '/:year/votes/close',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year

    try {
      const workflow = await workflowService.getWorkflowYearState(year)

      if (workflow.state !== 'voting_open') {
        return res.status(409).json({
          error: 'Cloture impossible hors etat voting_open.',
          details: {
            year,
            state: workflow.state,
            requiredState: 'voting_open'
          }
        })
      }

      const result = await votingCampaignService.closeVotesCampaign(year)

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.votes.close',
        user: req.user,
        payload: {
          tpiProcessed: result.tpiProcessed,
          confirmedCount: result.confirmedCount,
          manualRequiredCount: result.manualRequiredCount
        },
        success: true
      })

      return res.status(200).json({
        success: true,
        year,
        ...result
      })
    } catch (error) {
      console.error('Erreur cloture campagne votes:', error)
      return res.status(500).json({ error: 'Erreur lors de la cloture des votes.' })
    }
  }
)

router.post(
  '/:year/publication/publish',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year

    try {
      const workflow = await workflowService.getWorkflowYearState(year)
      if (!['voting_open', 'published'].includes(workflow.state)) {
        return res.status(409).json({
          error: 'Publication impossible dans l\'etat courant.',
          details: {
            year,
            state: workflow.state,
            requiredStates: ['voting_open', 'published']
          }
        })
      }

      const blockingStatuses = ['voting', 'pending_validation', 'manual_required']
      const blockingCount = await TpiPlanning.countDocuments({
        year,
        status: { $in: blockingStatuses }
      })

      if (blockingCount > 0) {
        return res.status(409).json({
          error: 'Publication bloquee tant que des TPI restent en vote ou en intervention manuelle.',
          details: {
            year,
            blockingStatuses,
            blockingCount
          }
        })
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`
      const publishedResult = await publishConfirmedPlanningSoutenances(year, req.user)
      const roomCount = Array.isArray(publishedResult?.rooms)
        ? publishedResult.rooms.length
        : 0
      const publicationVersion = publishedResult?.publicationVersion || null

      if (workflow.state !== 'published') {
        await workflowService.transitionWorkflowYear({
          year,
          targetState: 'published',
          user: req.user
        })
      }

      const sentLinks = await votingCampaignService.sendSoutenanceLinksForYear(
        year,
        baseUrl,
        publicationVersion?.version || null
      )

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.publication.publish',
        user: req.user,
        payload: {
          publicationVersion: publicationVersion?.version || null,
          roomsCount: roomCount,
          sentLinks,
          targetUrl: `/Soutenances/${year}`
        },
        success: true
      })

      return res.status(200).json({
        success: true,
        year,
        roomsCount: roomCount,
        publicationVersion,
        sentLinks,
        targetUrl: `/Soutenances/${year}`,
        message: roomCount > 0
          ? `${roomCount} salles publiees depuis le planning confirme`
          : 'Aucune soutenance confirmee a publier'
      })
    } catch (error) {
      console.error('Erreur publication workflow:', error)
      return res.status(500).json({ error: 'Erreur lors de la publication definitive.' })
    }
  }
)

router.post(
  '/:year/publication/rollback/:version',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year
    const version = parsePositiveInteger(req.params.version, null)

    if (!version) {
      return res.status(400).json({ error: 'Version de rollback invalide.' })
    }

    try {
      const workflow = await workflowService.getWorkflowYearState(year)
      if (workflow.state !== 'published') {
        return res.status(409).json({
          error: 'Rollback possible uniquement en etat published.',
          details: {
            year,
            state: workflow.state,
            requiredState: 'published'
          }
        })
      }

      const rollbackResult = await rollbackPublicationVersion(year, version)

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.publication.rollback',
        user: req.user,
        payload: {
          publicationVersion: rollbackResult?.publicationVersion?.version || version,
          targetUrl: `/Soutenances/${year}`
        },
        success: true
      })

      return res.status(200).json({
        success: true,
        year,
        publicationVersion: rollbackResult?.publicationVersion || null,
        targetUrl: `/Soutenances/${year}`
      })
    } catch (error) {
      if (error?.statusCode) {
        return res.status(error.statusCode).json({
          error: error.message
        })
      }

      console.error('Erreur rollback publication workflow:', error)
      return res.status(500).json({ error: 'Erreur lors du rollback de publication.' })
    }
  }
)

router.post(
  '/:year/publication/send-links',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year

    try {
      const workflow = await workflowService.getWorkflowYearState(year)
      if (workflow.state !== 'published') {
        return res.status(409).json({
          error: 'Envoi des liens possible uniquement en etat published.',
          details: {
            year,
            state: workflow.state,
            requiredState: 'published'
          }
        })
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`
      const sentLinks = await votingCampaignService.sendSoutenanceLinksForYear(year, baseUrl)

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.publication.send-links',
        user: req.user,
        payload: sentLinks,
        success: true
      })

      return res.status(200).json({
        success: true,
        year,
        sentLinks
      })
    } catch (error) {
      console.error('Erreur envoi liens soutenances:', error)
      return res.status(500).json({ error: 'Erreur lors de l\'envoi des liens soutenances.' })
    }
  }
)

router.get('/:year', requireYearParam('year'), authMiddleware, async (req, res) => {
  try {
    const year = req.validatedParams.year
    const workflow = await workflowService.getWorkflowYearState(year)

    return res.status(200).json(workflow)
  } catch (error) {
    console.error('Erreur lecture workflow annuel:', error)
    return res.status(500).json({ error: 'Erreur lors de la lecture du workflow annuel.' })
  }
})

router.post(
  '/:year/transition',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  requireNonEmptyBody('Donnees de transition requises.'),
  async (req, res) => {
    const year = req.validatedParams.year
    const targetState = typeof req.body?.targetState === 'string'
      ? req.body.targetState.trim()
      : typeof req.body?.state === 'string'
        ? req.body.state.trim()
        : ''

    if (targetState.length === 0) {
      return res.status(400).json({ error: 'targetState requis.' })
    }

    if (!workflowService.isWorkflowState(targetState)) {
      return res.status(400).json({ error: 'Etat workflow invalide.' })
    }

    try {
      const result = await workflowService.transitionWorkflowYear({
        year,
        targetState,
        user: req.user
      })

      return res.status(200).json({
        success: true,
        changed: result.changed,
        workflow: result.workflow
      })
    } catch (error) {
      if (error instanceof workflowService.WorkflowTransitionError) {
        await workflowService.safeAuditTransitionFailure({
          year,
          user: req.user,
          targetState,
          error
        })

        return res.status(error.statusCode || 409).json({
          error: error.message,
          details: error.details
        })
      }

      console.error('Erreur transition workflow:', error)
      return res.status(500).json({ error: 'Erreur lors de la transition workflow.' })
    }
  }
)

router.get(
  '/:year/audit',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    try {
      const year = req.validatedParams.year
      const limit = parsePositiveInteger(req.query.limit, 100)
      const events = await workflowService.listWorkflowAuditEvents(year, limit)

      return res.status(200).json({
        year,
        count: events.length,
        events
      })
    } catch (error) {
      console.error('Erreur lecture audit workflow:', error)
      return res.status(500).json({ error: 'Erreur lors de la lecture de l\'audit workflow.' })
    }
  }
)

module.exports = router
