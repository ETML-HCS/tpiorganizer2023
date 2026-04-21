const express = require('express')

const TpiPlanning = require('../models/tpiPlanningModel')
const Vote = require('../models/voteModel')
const { requireNonEmptyBody, requireYearParam } = require('../middleware/requestValidation')
const { authMiddleware, requireRole } = require('../services/magicLinkService')
const magicLinkV2Service = require('../services/magicLinkV2Service')
const emailService = require('../services/emailService')
const {
  publishConfirmedPlanningSoutenances,
  rollbackPublicationVersion,
  getActivePublicationVersion
} = require('../services/publishedSoutenanceService')
const planningAutomationService = require('../services/planningAutomationService')
const planningValidationService = require('../services/planningValidationService')
const votingCampaignService = require('../services/votingCampaignService')
const workflowService = require('../services/workflowService')
const { buildAccessLinkPreview } = require('../services/accessLinkPreviewService')
const {
  syncLegacyCatalogToPlanning,
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

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function normalizeReference(value) {
  return compactText(value)
    .toLowerCase()
    .replace(/^tpi-\d{4}-/i, '')
}

function matchesReference(candidateReference, requestedReference) {
  const normalizedCandidate = normalizeReference(candidateReference)
  const normalizedRequested = normalizeReference(requestedReference)

  if (!normalizedRequested || !normalizedCandidate) {
    return false
  }

  return normalizedCandidate === normalizedRequested ||
    compactText(candidateReference).toLowerCase() === compactText(requestedReference).toLowerCase()
}

function formatPersonName(person) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim()
}

function formatRoleLabel(role) {
  if (role === 'expert1') {
    return 'Expert 1'
  }

  if (role === 'expert2') {
    return 'Expert 2'
  }

  if (role === 'chef_projet') {
    return 'Chef de projet'
  }

  if (role === 'candidat') {
    return 'Candidat'
  }

  return compactText(role)
}

function buildRedirectPath(pathname, query = {}) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') {
      continue
    }

    params.set(key, String(value))
  }

  const queryString = params.toString()
  return queryString ? `${pathname}?${queryString}` : pathname
}

function getRecipientEmail(rawValue) {
  return compactText(rawValue).toLowerCase()
}

function isValidEmailAddress(value) {
  return /^\S+@\S+\.\S+$/.test(value)
}

function buildVoteSlotsPayload(votes = []) {
  const seen = new Set()
  const slots = []

  for (const vote of votes) {
    const slot = vote?.slot
    const slotId = slot?._id ? String(slot._id) : ''

    if (!slot || (slotId && seen.has(slotId))) {
      continue
    }

    if (slotId) {
      seen.add(slotId)
    }

    slots.push({
      date: slot.date ? new Date(slot.date).toLocaleDateString('fr-CH') : '',
      period: slot.period,
      startTime: slot.startTime || '',
      endTime: slot.endTime || '',
      room: slot.room?.name || slot.room || ''
    })
  }

  return slots
}

async function findDevVoteLinkTarget(year, requestedReference = '') {
  const tpis = await TpiPlanning.find({
    year,
    status: { $in: ['voting', 'pending_slots'] }
  })
    .populate('candidat expert1 expert2 chefProjet', 'firstName lastName email')
    .sort({ reference: 1 })

  for (const tpi of tpis) {
    if (requestedReference && !matchesReference(tpi.reference, requestedReference)) {
      continue
    }

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

async function findDevSoutenanceLinkTarget(year, requestedReference = '') {
  const activePublication = await getActivePublicationVersion(year)
  const rooms = Array.isArray(activePublication?.rooms) ? activePublication.rooms : []

  for (const room of rooms) {
    for (const tpiData of Array.isArray(room?.tpiDatas) ? room.tpiDatas : []) {
      if (requestedReference && !matchesReference(tpiData?.refTpi, requestedReference)) {
        continue
      }

      const participants = []
      const seenPersonIds = new Set()
      const rawParticipants = [
        {
          role: 'candidat',
          personId: tpiData?.candidatPersonId || null,
          name: tpiData?.candidat || ''
        },
        {
          role: 'expert1',
          personId: tpiData?.expert1?.personId || null,
          name: tpiData?.expert1?.name || ''
        },
        {
          role: 'expert2',
          personId: tpiData?.expert2?.personId || null,
          name: tpiData?.expert2?.name || ''
        },
        {
          role: 'chef_projet',
          personId: tpiData?.boss?.personId || null,
          name: tpiData?.boss?.name || ''
        }
      ]

      for (const participant of rawParticipants) {
        const personId = compactText(participant.personId)
        if (!personId || seenPersonIds.has(personId)) {
          continue
        }

        seenPersonIds.add(personId)
        participants.push({
          ...participant,
          roleLabel: formatRoleLabel(participant.role)
        })
      }

      if (participants.length === 0) {
        continue
      }

      return {
        publicationVersion: activePublication?.version || null,
        reference: tpiData?.refTpi || '',
        room: {
          site: room?.site || '',
          name: room?.name || '',
          date: room?.date || null
        },
        participants
      }
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
  '/:year/planification/auto-plan',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year

    try {
      const workflow = await workflowService.getWorkflowYearState(year)

      if (workflow.state !== 'planning') {
        return res.status(409).json({
          error: 'Planification automatique impossible hors etat planning.',
          details: {
            year,
            state: workflow.state,
            requiredState: 'planning'
          }
        })
      }

      const syncSummary = await syncLegacyCatalogToPlanning({
        year,
        createdBy: req.user
      })
      const result = await planningAutomationService.autoPlanYear(year)
      const validation = await planningValidationService.validatePlanningForYear(year)

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.planification.auto-plan',
        user: req.user,
        payload: {
          syncCreatedCount: syncSummary.createdCount,
          plannedCount: result.plannedCount,
          manualRequiredCount: result.manualRequiredCount,
          slotCount: result.slotCount,
          roomCount: result.roomCount
        },
        success: true
      })

      return res.status(200).json({
        success: true,
        summary: result,
        legacyRooms: Array.isArray(result?.legacyRooms) ? result.legacyRooms : [],
        sync: syncSummary,
        validation: {
          year: validation.year,
          checkedAt: validation.checkedAt,
          source: validation.source,
          summary: validation.summary,
          issues: validation.issues,
          hardConflicts: validation.hardConflicts
        }
      })
    } catch (error) {
      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.planification.auto-plan',
        user: req.user,
        payload: {},
        success: false,
        error: error?.message || 'Erreur inconnue'
      })

      console.error('Erreur planification automatique:', error)
      return res.status(500).json({ error: 'Erreur lors de la planification automatique.' })
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
    const skipEmails = parseBoolean(req.body?.skipEmails, false)
    let migrationSummary = null

    try {
      if (skipEmails && !IS_DEBUG) {
        return res.status(403).json({
          error: 'L ouverture des votes sans emails est indisponible hors mode debug.'
        })
      }

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
      const result = await votingCampaignService.startVotesCampaign(year, baseUrl, {
        skipEmails
      })

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.votes.start',
        user: req.user,
        payload: {
          tpiCount: result.tpiCount,
          totalEmails: result.totalEmails,
          successfulEmails: result.successfulEmails,
          emailsSkipped: result.emailsSkipped === true
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
  const requestedReference = compactText(req.body?.reference)

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

    const target = await findDevVoteLinkTarget(year, requestedReference)

    if (!target) {
      return res.status(404).json({
        error: requestedReference
          ? `Aucun vote en attente disponible pour ${requestedReference}.`
          : 'Aucun vote en attente disponible pour cette annee.'
      })
    }

    const baseUrl = getFrontendBaseUrl(req)
    const redirectPath = buildRedirectPath(`/planning/${year}`, {
      previewVote: '1',
      focus: target.tpi.reference || ''
    })
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
        redirectPath
      })

      links.push({
        type: 'vote',
        role: vote.voterRole,
        roleLabel: formatRoleLabel(vote.voterRole),
        voter: {
          id: String(vote.voter._id),
          name: formatPersonName(vote.voter),
          email: vote.voter.email || ''
        },
        expiresAt: link.expiresAt,
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

async function handleDevVoteEmails(req, res) {
  if (!IS_DEBUG) {
    return res.status(404).json({ error: 'Route indisponible.' })
  }

  const year = req.validatedParams.year
  const recipientEmail = getRecipientEmail(req.body?.email)
  const requestedReference = compactText(req.body?.reference)

  if (!isValidEmailAddress(recipientEmail)) {
    return res.status(400).json({ error: 'Adresse email de destination invalide.' })
  }

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

    const target = await findDevVoteLinkTarget(year, requestedReference)

    if (!target) {
      return res.status(404).json({
        error: requestedReference
          ? `Aucun vote en attente disponible pour ${requestedReference}.`
          : 'Aucun vote en attente disponible pour cette annee.'
      })
    }

    const baseUrl = getFrontendBaseUrl(req)
    const redirectPath = buildRedirectPath(`/planning/${year}`, {
      previewVote: '1',
      focus: target.tpi.reference || ''
    })
    const slots = buildVoteSlotsPayload(target.votes)
    const candidateName = formatPersonName(target.tpi.candidat)
    const fallbackDeadline = target.tpi?.votingSession?.deadline
      ? new Date(target.tpi.votingSession.deadline).toLocaleDateString('fr-CH')
      : ''
    const links = []
    let emailsSucceeded = 0

    for (const vote of target.votes) {
      const link = await magicLinkV2Service.createVoteMagicLink({
        year,
        person: vote.voter,
        recipientEmail,
        role: vote.voterRole,
        scope: {
          year,
          tpiId: String(target.tpi._id),
          reference: target.tpi.reference,
          source: 'dev_vote_email'
        },
        baseUrl,
        redirectPath
      })

      const emailDelivery = await emailService.sendEmail(recipientEmail, 'voteRequest', {
        recipientName: formatPersonName(vote.voter) || formatRoleLabel(vote.voterRole),
        candidateName,
        tpiReference: target.tpi.reference,
        tpiSubject: target.tpi.sujet || '',
        role: formatRoleLabel(vote.voterRole),
        slots,
        deadline: fallbackDeadline || link.expiresAt.toLocaleDateString('fr-CH'),
        magicLinkUrl: link.url
      })

      if (emailDelivery.success) {
        emailsSucceeded += 1
      }

      links.push({
        type: 'vote',
        role: vote.voterRole,
        roleLabel: formatRoleLabel(vote.voterRole),
        viewer: {
          id: String(vote.voter._id),
          name: formatPersonName(vote.voter),
          email: vote.voter.email || ''
        },
        expiresAt: link.expiresAt,
        url: link.url,
        token: link.token,
        emailDelivery: {
          ...emailDelivery,
          sentTo: recipientEmail
        }
      })
    }

    return res.status(200).json({
      success: true,
      kind: 'vote',
      year,
      reference: target.tpi.reference,
      sentTo: recipientEmail,
      summary: {
        emailsSent: links.length,
        emailsSucceeded,
        emailsFailed: Math.max(links.length - emailsSucceeded, 0)
      },
      links
    })
  } catch (error) {
    console.error('Erreur envoi emails de test vote:', error)
    return res.status(500).json({
      error: 'Erreur lors de l envoi des emails de test de vote.'
    })
  }
}

async function handleDevSoutenanceEmails(req, res) {
  if (!IS_DEBUG) {
    return res.status(404).json({ error: 'Route indisponible.' })
  }

  const year = req.validatedParams.year
  const recipientEmail = getRecipientEmail(req.body?.email)
  const requestedReference = compactText(req.body?.reference)

  if (!isValidEmailAddress(recipientEmail)) {
    return res.status(400).json({ error: 'Adresse email de destination invalide.' })
  }

  try {
    const workflow = await workflowService.getWorkflowYearState(year)

    if (workflow.state !== 'published') {
      return res.status(409).json({
        error: 'Le mode test soutenance est disponible uniquement apres publication.',
        details: {
          year,
          state: workflow.state,
          requiredState: 'published'
        }
      })
    }

    const target = await findDevSoutenanceLinkTarget(year, requestedReference)

    if (!target) {
      return res.status(404).json({
        error: requestedReference
          ? `Aucune soutenance publiee disponible pour ${requestedReference}.`
          : 'Aucune soutenance publiee disponible pour cette annee.'
      })
    }

    const baseUrl = getFrontendBaseUrl(req)
    const redirectPath = buildRedirectPath(`/Soutenances/${year}`, {
      focus: target.reference || ''
    })
    const links = []
    let emailsSucceeded = 0

    for (const participant of target.participants) {
      const link = await magicLinkV2Service.createSoutenanceMagicLink({
        year,
        person: {
          _id: participant.personId,
          firstName: participant.name || participant.roleLabel,
          lastName: '',
          email: recipientEmail
        },
        recipientEmail,
        scope: {
          kind: 'published_soutenances',
          publicationVersion: target.publicationVersion,
          reference: target.reference,
          source: 'dev_soutenance_email'
        },
        baseUrl,
        redirectPath
      })

      const emailDelivery = await emailService.sendEmail(recipientEmail, 'soutenanceAccess', {
        recipientName: participant.name || participant.roleLabel,
        year,
        magicLinkUrl: link.url,
        deadline: link.expiresAt.toLocaleDateString('fr-CH')
      })

      if (emailDelivery.success) {
        emailsSucceeded += 1
      }

      links.push({
        type: 'soutenance',
        role: participant.role,
        roleLabel: participant.roleLabel,
        viewer: {
          id: compactText(participant.personId),
          name: participant.name || participant.roleLabel,
          email: ''
        },
        expiresAt: link.expiresAt,
        url: link.url,
        token: link.token,
        emailDelivery: {
          ...emailDelivery,
          sentTo: recipientEmail
        }
      })
    }

    return res.status(200).json({
      success: true,
      kind: 'soutenance',
      year,
      reference: target.reference,
      publicationVersion: target.publicationVersion,
      room: target.room,
      sentTo: recipientEmail,
      summary: {
        emailsSent: links.length,
        emailsSucceeded,
        emailsFailed: Math.max(links.length - emailsSucceeded, 0)
      },
      links
    })
  } catch (error) {
    console.error('Erreur envoi emails de test soutenance:', error)
    return res.status(500).json({
      error: 'Erreur lors de l envoi des emails de test de soutenance.'
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
  '/:year/votes/dev-email',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  requireNonEmptyBody('Donnees de test vote requises.'),
  handleDevVoteEmails
)

router.post(
  '/:year/publication/dev-email',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  requireNonEmptyBody('Donnees de test soutenance requises.'),
  handleDevSoutenanceEmails
)

router.post(
  '/:year/access-links/preview',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year

    try {
      const workflow = await workflowService.getWorkflowYearState(year)
      const baseUrl = getFrontendBaseUrl(req)
      const preview = await buildAccessLinkPreview({
        year,
        baseUrl
      })

      return res.status(200).json({
        success: true,
        workflowState: workflow?.state || 'planning',
        ...preview
      })
    } catch (error) {
      console.error('Erreur generation apercu liens d acces:', error)
      return res.status(500).json({
        error: 'Erreur lors de la generation des liens d acces.'
      })
    }
  }
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
