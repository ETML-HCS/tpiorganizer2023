const express = require('express')

const TpiPlanning = require('../models/tpiCoordinationModel')
const Vote = require('../models/voteModel')
const { requireNonEmptyBody, requireYearParam } = require('../middleware/requestValidation')
const { authMiddleware, requireRole } = require('../services/magicLinkService')
const accessLinkTokenService = require('../modules/accessLinks/tokenService')
const emailService = require('../services/emailService')
const publishedSoutenanceService = require('../services/publishedSoutenanceService')
const publicationChangeNotificationService = require('../services/publicationChangeNotificationService')
const finalScheduleDeliveryService = require('../services/finalScheduleDeliveryService')
const coordinationAutomationService = require('../services/coordinationAutomationService')
const coordinationValidationService = require('../services/coordinationValidationService')
const schedulingService = require('../services/schedulingService')
const staticDefensePublicationService = require('../services/staticDefensePublicationService')
const staticVotePublicationService = require('../services/staticVotePublicationService')
const votingCampaignService = require('../services/votingCampaignService')
const workflowService = require('../services/workflowService')
const { getSharedEmailSettingsIfAvailable } = require('../services/coordinationCatalogService')
const coordinationConfigService = require('../services/coordinationConfigService')
const publicationDeploymentConfigService = require('../services/publicationDeploymentConfigService')
const accessLinkPreviewModule = require('../modules/accessLinks/previewService')
const { buildDefensePublicPath } = require('../utils/publicRoutes')
const {
  normalizeVoteLinkTarget,
  normalizeSoutenanceLinkTarget
} = require('../modules/accessLinks/constants')
const {
  syncLegacyCatalogToPlanning,
  rebuildWorkflowFromLegacyPlanning
} = require('../services/legacyPlanningBridgeService')
const {
  COORDINATION_PROPOSAL_READY_STATUSES
} = require('../modules/coordination/status')
const {
  VOTING_STAKEHOLDER_ROLES,
  formatTpiStakeholderRoleLabel
} = require('../modules/stakeholders/stakeholderDefinitions')

const router = express.Router()
const IS_DEBUG = process.env.NODE_ENV !== 'production' && process.env.REACT_APP_DEBUG === 'true'
const AUTOMATIC_EMAIL_SENDS_DISABLED_REASON = 'automatic_email_sends_disabled'

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

function parseOptionalPositiveInteger(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '' || rawValue === 'active') {
    return null
  }

  const parsed = Number.parseInt(String(rawValue), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
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

function parseOptionalBoolean(rawValue) {
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

  return null
}

function buildPlanningVoteMigrationWarnings(summary = null) {
  if (!summary || typeof summary !== 'object') {
    return []
  }

  const preservedResponses = Number(summary.preservedSubmittedResponseCount || 0)
  const droppedResponses = Number(summary.droppedSubmittedResponseCount || 0)

  if (preservedResponses <= 0 && droppedResponses <= 0) {
    return []
  }

  const warnings = []

  if (preservedResponses > 0) {
    warnings.push(`${preservedResponses} réponse(s) de vote conservée(s) après reconstruction de la planification.`)
  }

  if (droppedResponses > 0) {
    warnings.push(`${droppedResponses} réponse(s) de vote ne correspondaient plus au nouveau créneau et doivent être redemandées.`)
  }

  return warnings
}

function buildStaticVoteSyncWarnings(result = null) {
  if (!result || typeof result !== 'object') {
    return []
  }

  const imported = Number(result.importedCount || 0)
  const skipped = Number(result.skippedCount || 0)
  const failed = Number(result.failedCount || 0)
  const received = Number(result.receivedCount || 0)
  const ignoredCampaign = Number(result.ignoredCampaignCount || 0)
  const warnings = []

  if (received > 0) {
    warnings.push(
      `Synchronisation mini-site vote: ${imported}/${received} réponse(s) importée(s)` +
      (skipped > 0 ? `, ${skipped} déjà connue(s)` : '') +
      (ignoredCampaign > 0 ? `, ${ignoredCampaign} campagne(s) obsolète(s) ignorée(s)` : '') +
      (failed > 0 ? `, ${failed} erreur(s)` : '') +
      '.'
    )
  }

  return warnings
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

async function getAccessLinkSettingsForYear(year) {
  const config = await coordinationConfigService.getPlanningConfigIfAvailable(year)
  return coordinationConfigService.normalizeAccessLinkSettings(config?.accessLinkSettings)
}

async function resolveAccessLinkTargets(year, body = {}) {
  const settings = await getAccessLinkSettingsForYear(year)
  const requestedVoteLinkTarget = compactText(body?.voteLinkTarget)
  const requestedSoutenanceLinkTarget = compactText(body?.soutenanceLinkTarget)

  return {
    settings,
    voteLinkTarget: normalizeVoteLinkTarget(
      requestedVoteLinkTarget || settings.defaultVoteLinkTarget
    ),
    soutenanceLinkTarget: normalizeSoutenanceLinkTarget(
      requestedSoutenanceLinkTarget || settings.defaultSoutenanceLinkTarget
    )
  }
}

function buildSoutenancePublicationLinkTarget(rawPublicUrl) {
  const publicUrl = compactText(rawPublicUrl)

  if (!publicUrl) {
    return null
  }

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(publicUrl)
    ? publicUrl
    : `https://${publicUrl}`

  try {
    const url = new URL(withProtocol)
    const baseUrl = `${url.protocol}//${url.host}`
    const path = `${url.pathname || '/'}${url.search || ''}` || '/'

    return {
      baseUrl,
      redirectPath: path
    }
  } catch (error) {
    return null
  }
}

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

async function syncStaticVotesForProtectedUpdate(year) {
  const status = await staticVotePublicationService.getStaticVotePublicationStatus(year)

  if (!status.available) {
    return {
      skipped: true,
      reason: 'static_vote_not_generated'
    }
  }

  if (!status.syncSecretConfigured) {
    const error = new Error('Synchronisation mini-site vote requise avant mise à jour, mais STATIC_VOTE_SYNC_SECRET n’est pas configuré.')
    error.statusCode = 409
    throw error
  }

  const result = await staticVotePublicationService.syncStaticVoteResponses({ year })
  if (!result.success) {
    const error = new Error('Synchronisation mini-site vote incomplète: mise à jour bloquée pour protéger les réponses en cours.')
    error.statusCode = 409
    error.details = result
    throw error
  }

  return result
}

async function getConfiguredSoutenancePublicUrl(year) {
  try {
    const status = await staticDefensePublicationService.getStaticPublicationStatus(year)
    const statusPublicUrl = compactText(status?.publicUrl)
    if (statusPublicUrl) {
      return statusPublicUrl
    }
  } catch (error) {
    console.warn(`URL publique défense ${year} indisponible:`, error?.message || error)
  }

  try {
    return compactText(await staticDefensePublicationService.getPublicUrl(year))
  } catch (error) {
    console.warn(`Fallback URL publique défense ${year} indisponible:`, error?.message || error)
    return ''
  }
}

async function resolveSoutenancePublicationLinkTarget(year, rawPublicUrl) {
  const explicitTarget = buildSoutenancePublicationLinkTarget(rawPublicUrl)

  if (explicitTarget) {
    return explicitTarget
  }

  const configuredPublicUrl = await getConfiguredSoutenancePublicUrl(year)
  return buildSoutenancePublicationLinkTarget(configuredPublicUrl)
}

async function applySoutenanceSendLinkOptions(year, body = {}, sendLinkOptions = {}) {
  const settings = await getAccessLinkSettingsForYear(year)
  const requestedSoutenanceLinkTarget = compactText(body?.soutenanceLinkTarget)
  const soutenanceLinkTarget = normalizeSoutenanceLinkTarget(
    requestedSoutenanceLinkTarget || settings.defaultSoutenanceLinkTarget
  )
  const requestedSoutenancePublicUrl = compactText(body?.soutenancePublicUrl || body?.publicationPublicUrl)

  if (requestedSoutenanceLinkTarget || soutenanceLinkTarget === 'publication') {
    sendLinkOptions.soutenanceLinkTarget = soutenanceLinkTarget
  }

  if (requestedSoutenancePublicUrl) {
    sendLinkOptions.soutenancePublicUrl = requestedSoutenancePublicUrl
  } else if (soutenanceLinkTarget === 'publication') {
    const configuredPublicUrl = await getConfiguredSoutenancePublicUrl(year)
    if (configuredPublicUrl) {
      sendLinkOptions.soutenancePublicUrl = configuredPublicUrl
    }
  }

  return sendLinkOptions
}

async function resolveDefenseChangeNotificationLinkTarget(year, req) {
  const baseUrl = `${req.protocol}://${req.get('host')}`
  const sendLinkOptions = {}
  await applySoutenanceSendLinkOptions(year, req.body, sendLinkOptions)

  const requestedTarget = normalizeSoutenanceLinkTarget(sendLinkOptions.soutenanceLinkTarget)

  if (requestedTarget !== 'publication') {
    return {
      baseUrl,
      redirectPath: buildDefensePublicPath(year),
      linkTarget: 'app'
    }
  }

  const publicationTarget = await resolveSoutenancePublicationLinkTarget(
    year,
    sendLinkOptions.soutenancePublicUrl || req.body?.defensePublicUrl
  )

  if (!publicationTarget) {
    const error = new Error('URL publique de publication des défenses invalide ou absente.')
    error.statusCode = 400
    throw error
  }

  return {
    baseUrl: publicationTarget.baseUrl,
    redirectPath: publicationTarget.redirectPath,
    linkTarget: 'publication'
  }
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

function createDirectPublicationError(message, details = {}, statusCode = 409) {
  const error = new Error(message)
  error.statusCode = statusCode
  error.details = details
  return error
}

function extractDirectPublicationTargets(snapshot) {
  const targetsByTpiId = new Map()
  const entries = Array.isArray(snapshot?.entries) ? snapshot.entries : []

  for (const entry of entries) {
    const tpiId = compactText(entry?.tpiId)
    const slotId = compactText(entry?.slot?.slotId)

    if (!tpiId || !slotId || targetsByTpiId.has(tpiId)) {
      continue
    }

    targetsByTpiId.set(tpiId, {
      tpiId,
      slotId,
      reference: compactText(entry?.reference)
    })
  }

  return Array.from(targetsByTpiId.values())
}

async function getValidatedSnapshotForDirectPublication(year) {
  const snapshot = await coordinationValidationService.getActiveSnapshot(year)

  if (!snapshot) {
    throw createDirectPublicationError(
      'Un snapshot actif est requis avant la publication directe. Geler d\'abord la planification.',
      { year, hasSnapshot: false }
    )
  }

  const validation = await coordinationValidationService.validatePlanningForYear(year)

  if (!validation.summary?.isValid) {
    throw createDirectPublicationError(
      'La planification courante contient encore des erreurs bloquantes. Corrigez-les puis regeler la planification.',
      {
        year,
        snapshotVersion: snapshot?.version || null,
        summary: validation.summary,
        issues: validation.issues
      }
    )
  }

  if (!coordinationValidationService.isValidationAlignedWithSnapshot(snapshot, validation)) {
    throw createDirectPublicationError(
      'La planification a été modifiée depuis le dernier snapshot. Geler une nouvelle version avant publication directe.',
      {
        year,
        snapshotVersion: snapshot?.version || null,
        summary: validation.summary,
        issues: validation.issues
      }
    )
  }

  return { snapshot, validation }
}

async function confirmSnapshotForDirectPublication({ year, snapshot }) {
  const targets = extractDirectPublicationTargets(snapshot)

  if (targets.length === 0) {
    throw createDirectPublicationError(
      'Aucun créneau planifié dans le snapshot actif.',
      {
        year,
        snapshotVersion: snapshot?.version || null
      }
    )
  }

  const tpis = await TpiPlanning.find({
    year,
    _id: { $in: targets.map(target => target.tpiId) }
  })
    .select('_id reference status confirmedSlot')
    .lean()

  const tpisById = new Map(tpis.map(tpi => [String(tpi._id), tpi]))
  const failures = []
  let confirmedCount = 0
  let alreadyConfirmedCount = 0

  for (const target of targets) {
    const tpi = tpisById.get(target.tpiId)

    if (!tpi) {
      failures.push({
        tpiId: target.tpiId,
        slotId: target.slotId,
        reference: target.reference,
        message: 'TPI introuvable dans la planification.'
      })
      continue
    }

    const confirmedSlotId = compactText(tpi.confirmedSlot)
    if (compactText(tpi.status) === 'confirmed' && confirmedSlotId === target.slotId) {
      alreadyConfirmedCount += 1
      continue
    }

    const result = await schedulingService.confirmSlotForTpi(target.tpiId, target.slotId, {
      historyAction: 'slot_confirmed_direct_publication',
      historyDetails: {
        source: 'direct_publication',
        snapshotVersion: snapshot?.version || null
      }
    })

    if (result?.success) {
      confirmedCount += 1
      continue
    }

    failures.push({
      tpiId: target.tpiId,
      slotId: target.slotId,
      reference: target.reference || compactText(tpi.reference),
      message: result?.message || 'Confirmation du créneau impossible.',
      conflicts: result?.conflicts || []
    })
  }

  if (failures.length > 0) {
    throw createDirectPublicationError(
      'Publication directe bloquée: certains créneaux n\'ont pas pu être confirmés.',
      {
        year,
        snapshotVersion: snapshot?.version || null,
        plannedCount: targets.length,
        confirmedCount,
        alreadyConfirmedCount,
        failureCount: failures.length,
        failures
      }
    )
  }

  return {
    snapshotVersion: snapshot?.version || null,
    plannedCount: targets.length,
    confirmedCount,
    alreadyConfirmedCount
  }
}

async function findDevVoteLinkTarget(year, requestedReference = '') {
  const tpis = await TpiPlanning.find({
    year,
    status: { $in: COORDINATION_PROPOSAL_READY_STATUSES }
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

    const requiredRoles = VOTING_STAKEHOLDER_ROLES
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

async function ensureWorkflowFreeVoteRecordsForYear(year) {
  const tpis = await TpiPlanning.find({
    year,
    status: { $in: COORDINATION_PROPOSAL_READY_STATUSES },
    proposedSlots: { $exists: true, $ne: [] }
  })
    .populate('candidat expert1 expert2 chefProjet', 'firstName lastName email sendEmails')
    .populate('proposedSlots.slot')

  return await votingCampaignService.ensureVoteRecordsForTpis(tpis)
}

async function findDevSoutenanceLinkTarget(year, requestedReference = '') {
  const activePublication = await publishedSoutenanceService.getActivePublicationVersion(year)
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
          roleLabel: formatTpiStakeholderRoleLabel(participant.role)
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

      const validation = await coordinationValidationService.validatePlanningForYear(year)

      const response = {
        year: validation.year,
        checkedAt: validation.checkedAt,
        source: validation.source,
        summary: validation.summary,
        issues: validation.issues,
        hardConflicts: validation.hardConflicts,
        warnings: []
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
      await workflowService.getWorkflowYearState(year)

      const syncSummary = await syncLegacyCatalogToPlanning({
        year,
        createdBy: req.user
      })
      const result = await coordinationAutomationService.autoPlanYear(year)
      const validation = await coordinationValidationService.validatePlanningForYear(year)

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.planification.auto-plan',
        user: req.user,
        payload: {
          syncCreatedCount: syncSummary.createdCount,
          plannedCount: result.plannedCount,
          manualRequiredCount: result.manualRequiredCount,
          constraintOverrideCount: result.constraintOverrideCount,
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
      let staticVoteSyncSummary = null

      if (legacyRooms) {
        const existingPlanningCount = await TpiPlanning.countDocuments({ year })
        if (existingPlanningCount > 0) {
          staticVoteSyncSummary = await syncStaticVotesForProtectedUpdate(year)
        }

        migrationSummary = await rebuildWorkflowFromLegacyPlanning({
          year,
          legacyRooms,
          createdBy: req.user
        })

        if (existingPlanningCount === 0) {
          staticVoteSyncSummary = await syncStaticVotesForProtectedUpdate(year)
        }
      }

      const validation = await coordinationValidationService.validatePlanningForYear(year)

      const response = {
        year: validation.year,
        checkedAt: validation.checkedAt,
        source: validation.source,
        summary: validation.summary,
        issues: validation.issues,
        hardConflicts: validation.hardConflicts,
        warnings: [
          ...buildStaticVoteSyncWarnings(staticVoteSyncSummary),
          ...buildPlanningVoteMigrationWarnings(migrationSummary)
        ]
      }

      if (migrationSummary) {
        response.migrationSummary = migrationSummary
      }

      if (staticVoteSyncSummary && !staticVoteSyncSummary.skipped) {
        response.staticVoteSyncSummary = staticVoteSyncSummary
      }

      if (includeEntries) {
        response.entries = validation.entries
      }

      return res.status(200).json(response)
    } catch (error) {
      console.error('Erreur validation planification:', error)
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erreur lors de la validation de la planification.',
        details: error.details
      })
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
      const snapshot = await coordinationValidationService.getActiveSnapshot(year)

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
    let staticVoteSyncSummary = null

    try {
      await workflowService.getWorkflowYearState(year)

      if (legacyRooms) {
        const existingPlanningCount = await TpiPlanning.countDocuments({ year })
        if (existingPlanningCount > 0) {
          staticVoteSyncSummary = await syncStaticVotesForProtectedUpdate(year)
        }

        migrationSummary = await rebuildWorkflowFromLegacyPlanning({
          year,
          legacyRooms,
          createdBy: req.user
        })

        if (existingPlanningCount === 0) {
          staticVoteSyncSummary = await syncStaticVotesForProtectedUpdate(year)
        }
      }

      const planningCount = await TpiPlanning.countDocuments({ year })
      if (planningCount === 0) {
        migrationSummary = await rebuildWorkflowFromLegacyPlanning({
          year,
          createdBy: req.user
        })
        staticVoteSyncSummary = await syncStaticVotesForProtectedUpdate(year)
      }

      const result = await coordinationValidationService.freezePlanningSnapshot({
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
        staticVoteSyncSummary: staticVoteSyncSummary && !staticVoteSyncSummary.skipped
          ? staticVoteSyncSummary
          : undefined,
        warnings: [
          ...buildStaticVoteSyncWarnings(staticVoteSyncSummary),
          ...buildPlanningVoteMigrationWarnings(migrationSummary)
        ],
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
      if (error instanceof coordinationValidationService.PlanningFreezeError) {
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

      if (error.statusCode) {
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

        return res.status(error.statusCode).json({
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
  '/:year/planification/sync-from-coordination',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year
    const allowHardConflicts = parseBoolean(req.body?.allowHardConflicts, false)

    try {
      await workflowService.getWorkflowYearState(year)

      const validationPreview = await coordinationValidationService.validatePlanningForYear(year)
      if (validationPreview.summary.hasHardConflicts && !allowHardConflicts) {
        throw new coordinationValidationService.PlanningFreezeError(
          'Conflits hard detectes. Synchronisation et freeze refuses.',
          {
            summary: validationPreview.summary,
            hardConflicts: validationPreview.hardConflicts
          }
        )
      }

      const syncResult = await coordinationAutomationService.syncLegacyRoomsFromCurrentPlanning(year)
      const result = await coordinationValidationService.freezePlanningSnapshot({
        year,
        user: req.user,
        allowHardConflicts
      })

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.planification.sync-from-coordination',
        user: req.user,
        payload: {
          roomCount: syncResult.roomCount,
          slotCount: syncResult.slotCount,
          tpiCount: syncResult.tpiCount,
          version: result.snapshot.version,
          hash: result.snapshot.hash,
          allowHardConflicts
        },
        success: true
      })

      return res.status(201).json({
        success: true,
        summary: {
          year: syncResult.year,
          roomCount: syncResult.roomCount,
          slotCount: syncResult.slotCount,
          tpiCount: syncResult.tpiCount
        },
        legacyRooms: syncResult.legacyRooms,
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
      if (error instanceof coordinationValidationService.PlanningFreezeError) {
        await workflowService.logWorkflowAuditEvent({
          year,
          action: 'workflow.planification.sync-from-coordination',
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

      console.error('Erreur synchronisation planification depuis coordination:', error)
      return res.status(500).json({ error: 'Erreur lors de la synchronisation depuis la coordination.' })
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
    const skipEmails = true
    let migrationSummary = null
    let staticVoteSyncSummary = null
    const workflowWarnings = []

    try {
      const workflow = await workflowService.getWorkflowYearState(year)
      let nextWorkflow = workflow

      const snapshot = await coordinationValidationService.getActiveSnapshot(year)
      if (!snapshot) {
        workflowWarnings.push('Aucun snapshot actif: normalement la planification est gelée avant les votes.')
      }

      const votingTpiCount = await TpiPlanning.countDocuments({
        year,
        status: { $in: COORDINATION_PROPOSAL_READY_STATUSES }
      })

      if (legacyRooms || votingTpiCount === 0) {
        const existingPlanningCount = await TpiPlanning.countDocuments({ year })
        if (legacyRooms || existingPlanningCount === 0) {
          if (existingPlanningCount > 0) {
            staticVoteSyncSummary = await syncStaticVotesForProtectedUpdate(year)
            workflowWarnings.push(...buildStaticVoteSyncWarnings(staticVoteSyncSummary))
          }

          migrationSummary = await rebuildWorkflowFromLegacyPlanning({
            year,
            legacyRooms,
            createdBy: req.user
          })

          if (existingPlanningCount === 0) {
            staticVoteSyncSummary = await syncStaticVotesForProtectedUpdate(year)
            workflowWarnings.push(...buildStaticVoteSyncWarnings(staticVoteSyncSummary))
          }

          workflowWarnings.push(...buildPlanningVoteMigrationWarnings(migrationSummary))
        }
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`
      const startVoteOptions = { skipEmails }
      const fromArbitrage = parseBoolean(req.body?.fromArbitrage, false)
      const requestedVoteLinkTarget = compactText(req.body?.voteLinkTarget)
      const requestedVotePublicUrl = compactText(req.body?.votePublicUrl || req.body?.staticVotePublicUrl)

      if (fromArbitrage) {
        startVoteOptions.fromArbitrage = true
      }

      if (requestedVoteLinkTarget) {
        startVoteOptions.voteLinkTarget = requestedVoteLinkTarget
      }

      if (requestedVotePublicUrl) {
        startVoteOptions.votePublicUrl = requestedVotePublicUrl
      }

      const result = await votingCampaignService.startVotesCampaign(year, baseUrl, startVoteOptions)

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.votes.start',
        user: req.user,
        payload: {
          tpiCount: result.tpiCount,
          totalEmails: result.totalEmails,
          successfulEmails: result.successfulEmails,
          emailsSkipped: result.emailsSkipped === true,
          emailSkipReason: result.emailSkipReason || AUTOMATIC_EMAIL_SENDS_DISABLED_REASON,
          staticVoteSyncSummary,
          warnings: workflowWarnings
        },
        success: true
      })

      return res.status(200).json({
        success: true,
        year,
        workflowState: nextWorkflow?.state || 'planning',
        workflow: nextWorkflow,
        activePhases: nextWorkflow?.activePhases || [],
        warnings: workflowWarnings,
        summary: migrationSummary,
        staticVoteSyncSummary: staticVoteSyncSummary && !staticVoteSyncSummary.skipped
          ? staticVoteSyncSummary
          : undefined,
        ...result
      })
    } catch (error) {
      console.error('Erreur lancement campagne votes:', error)
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erreur lors du lancement de la campagne de votes.',
        details: error.details
      })
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
    const accessLinkSettings = await getAccessLinkSettingsForYear(year)
    const workflowFreeModeEnabled = accessLinkSettings.workflowFreeModeEnabled === true

    if (!workflow?.phases?.votes?.active && !workflowFreeModeEnabled) {
      return res.status(409).json({
        error: 'Le mode test de vote est disponible uniquement quand la phase Votes est active.',
        details: {
          year,
          activePhases: workflow?.activePhases || [],
          requiredPhase: 'votes'
        }
      })
    }

    if (workflowFreeModeEnabled) {
      await ensureWorkflowFreeVoteRecordsForYear(year)
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
    const redirectPath = buildRedirectPath(`/coordination/${year}`, {
      previewVote: '1',
      focus: target.tpi.reference || ''
    })
    const links = []

    for (const vote of target.votes) {
      const link = await accessLinkTokenService.createVoteMagicLink({
        year,
        person: vote.voter,
        role: vote.voterRole,
        scope: {
          year,
          kind: 'stakeholder_votes',
          reference: target.tpi.reference
        },
        baseUrl,
        redirectPath
      })

      links.push({
        type: 'vote',
        role: vote.voterRole,
        roleLabel: formatTpiStakeholderRoleLabel(vote.voterRole),
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
    const accessLinkSettings = await getAccessLinkSettingsForYear(year)
    const workflowFreeModeEnabled = accessLinkSettings.workflowFreeModeEnabled === true

    if (!workflow?.phases?.votes?.active && !workflowFreeModeEnabled) {
      return res.status(409).json({
        error: 'Le mode test de vote est disponible uniquement quand la phase Votes est active.',
        details: {
          year,
          activePhases: workflow?.activePhases || [],
          requiredPhase: 'votes'
        }
      })
    }

    if (workflowFreeModeEnabled) {
      await ensureWorkflowFreeVoteRecordsForYear(year)
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
    const redirectPath = buildRedirectPath(`/coordination/${year}`, {
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
    const emailSettings = await getSharedEmailSettingsIfAvailable()

    for (const vote of target.votes) {
      const link = await accessLinkTokenService.createVoteMagicLink({
        year,
        person: vote.voter,
        recipientEmail,
        role: vote.voterRole,
        scope: {
          year,
          kind: 'stakeholder_votes',
          reference: target.tpi.reference,
          source: 'dev_vote_email'
        },
        baseUrl,
        redirectPath
      })

      const emailDelivery = await emailService.sendEmail(recipientEmail, 'voteRequest', {
        recipientName: formatPersonName(vote.voter) || formatTpiStakeholderRoleLabel(vote.voterRole),
        candidateName,
        tpiReference: target.tpi.reference,
        tpiSubject: target.tpi.sujet || '',
        role: formatTpiStakeholderRoleLabel(vote.voterRole),
        slots,
        deadline: fallbackDeadline || link.expiresAt.toLocaleDateString('fr-CH'),
        magicLinkUrl: link.url
      }, { emailSettings })

      if (emailDelivery.success) {
        emailsSucceeded += 1
      }

      links.push({
        type: 'vote',
        role: vote.voterRole,
        roleLabel: formatTpiStakeholderRoleLabel(vote.voterRole),
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
    const accessLinkSettings = await getAccessLinkSettingsForYear(year)
    const workflowFreeModeEnabled = accessLinkSettings.workflowFreeModeEnabled === true

    if (!workflow?.phases?.defenses?.active && !workflowFreeModeEnabled) {
      return res.status(409).json({
        error: 'Le mode test défense est disponible uniquement quand la phase Défenses est active.',
        details: {
          year,
          activePhases: workflow?.activePhases || [],
          requiredPhase: 'defenses'
        }
      })
    }

    const target = await findDevSoutenanceLinkTarget(year, requestedReference)

    if (!target) {
      return res.status(404).json({
        error: requestedReference
          ? `Aucune défense publiee disponible pour ${requestedReference}.`
          : 'Aucune défense publiee disponible pour cette annee.'
      })
    }

    const baseUrl = getFrontendBaseUrl(req)
    const redirectPath = buildRedirectPath(buildDefensePublicPath(year), {
      focus: target.reference || ''
    })
    const links = []
    let emailsSucceeded = 0
    const emailSettings = await getSharedEmailSettingsIfAvailable()

    for (const participant of target.participants) {
      const link = await accessLinkTokenService.createSoutenanceMagicLink({
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
        recipientRoles: [participant.role],
        year,
        magicLinkUrl: link.url,
        deadline: link.expiresAt.toLocaleDateString('fr-CH')
      }, { emailSettings })

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
    console.error('Erreur envoi emails de test défense:', error)
    return res.status(500).json({
      error: 'Erreur lors de l envoi des emails de test de défense.'
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
  requireNonEmptyBody('Donnees de test défense requises.'),
  handleDevSoutenanceEmails
)

router.get(
  '/static-publication/config',
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    try {
      const config = await publicationDeploymentConfigService.getPublicationDeploymentConfig()
      return res.status(200).json(config)
    } catch (error) {
      console.error('Erreur chargement configuration publication:', error)
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erreur lors du chargement de la configuration publication.'
      })
    }
  }
)

router.put(
  '/static-publication/config',
  authMiddleware,
  requireRole('admin'),
  requireNonEmptyBody('Configuration publication requise.'),
  async (req, res) => {
    try {
      const config = await publicationDeploymentConfigService.savePublicationDeploymentConfig(req.body)
      return res.status(200).json(config)
    } catch (error) {
      console.error('Erreur sauvegarde configuration publication:', error)
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erreur lors de la sauvegarde de la configuration publication.'
      })
    }
  }
)

async function safeLogAccessLinksAudit(event) {
  try {
    await workflowService.logWorkflowAuditEvent(event)
  } catch (error) {
    console.error('Erreur audit liens d acces:', error)
  }
}

async function refreshGeneratedAccessPublications({
  year,
  voteLinkTarget,
  soutenanceLinkTarget
}) {
  const result = {
    votePublication: null,
    soutenancePublication: null,
    warnings: []
  }

  if (voteLinkTarget === 'static') {
    try {
      const staticVoteSyncSummary = await syncStaticVotesForProtectedUpdate(year)
      result.warnings.push(...buildStaticVoteSyncWarnings(staticVoteSyncSummary))

      const generated = await staticVotePublicationService.generateStaticVotesSite(year)
      let published = null

      try {
        published = await staticVotePublicationService.publishStaticVotesSite(year)
      } catch (error) {
        result.warnings.push(
          `Mini-site vote généré localement, mais publication FTP échouée: ${error.message}`
        )
      }

      result.votePublication = published || generated
      if (staticVoteSyncSummary && !staticVoteSyncSummary.skipped) {
        result.votePublication.staticVoteSyncSummary = staticVoteSyncSummary
      }
    } catch (error) {
      result.warnings.push(`Mini-site vote non rafraîchi: ${error.message}`)
    }
  }

  if (soutenanceLinkTarget === 'publication') {
    try {
      const generated = await staticDefensePublicationService.generateStaticDefensesSite(year)
      let published = null

      try {
        published = await staticDefensePublicationService.publishStaticDefensesSite(year)
      } catch (error) {
        result.warnings.push(
          `Mini-site défense généré localement, mais publication FTP échouée: ${error.message}`
        )
      }

      result.soutenancePublication = published || generated
    } catch (error) {
      result.warnings.push(`Mini-site défense non rafraîchi: ${error.message}`)
    }
  }

  return result
}

function normalizeAccessLinkRequestPhases(rawValue, fallback = null) {
  const fallbackSource = Array.isArray(fallback) ? fallback : []
  const source = Array.isArray(rawValue)
    ? rawValue
    : typeof rawValue === 'string'
      ? rawValue.split(',')
      : fallbackSource
  const phases = source
    .map((phase) => compactText(phase).toLowerCase())
    .filter((phase) => ['vote', 'soutenance', 'arbitrage'].includes(phase))

  if (phases.length > 0) {
    return Array.from(new Set(phases))
  }

  if (fallbackSource.length > 0 && source !== fallbackSource) {
    return normalizeAccessLinkRequestPhases(fallbackSource)
  }

  return null
}

async function handleAccessLinks(req, res, {
  generateLinks = false,
  generateMissingOnly = false,
  phases = null,
  acceptRequestedPhases = true,
  refreshPublications = true,
  auditAction = null,
  actionLabel: providedActionLabel = null
} = {}) {
  const year = req.validatedParams.year
  const actionLabel = providedActionLabel || (generateLinks ? 'generation' : 'preparation')
  const requestedPhases = acceptRequestedPhases
    ? normalizeAccessLinkRequestPhases(req.body?.phases || req.body?.phase, phases)
    : normalizeAccessLinkRequestPhases(phases)
  const resolvedAuditAction = auditAction || (
    generateLinks ? 'workflow.access-links.generate' : null
  )

  try {
    const workflow = await workflowService.getWorkflowYearState(year)
    const baseUrl = getFrontendBaseUrl(req)
    const {
      settings,
      voteLinkTarget,
      soutenanceLinkTarget
    } = await resolveAccessLinkTargets(year, req.body)
    const votePublicationTarget = voteLinkTarget === 'static'
      ? await staticVotePublicationService.getStaticVoteLinkTarget(
        year,
        req.body?.votePublicUrl || req.body?.staticVotePublicUrl
      )
      : null
    const publicationTarget = soutenanceLinkTarget === 'publication'
      ? await resolveSoutenancePublicationLinkTarget(
        year,
        req.body?.soutenancePublicUrl || req.body?.publicationPublicUrl
      )
      : null

    if (soutenanceLinkTarget === 'publication' && !publicationTarget) {
      return res.status(400).json({
        error: 'URL publique de publication invalide ou absente.'
      })
    }

    const publicationVersion = parseOptionalPositiveInteger(req.body?.publicationVersion)
    const preview = await accessLinkPreviewModule.buildAccessLinkPreview({
      year,
      baseUrl,
      voteBaseUrl: votePublicationTarget?.baseUrl || baseUrl,
      voteRedirectPath: votePublicationTarget?.redirectPath || `/coordination/${year}`,
      voteLinkTarget,
      soutenanceBaseUrl: publicationTarget?.baseUrl || baseUrl,
      soutenanceRedirectPath: publicationTarget?.redirectPath || buildDefensePublicPath(year),
      soutenanceLinkTarget: publicationTarget ? 'publication' : 'app',
      publicationVersion,
      autoPublishSoutenance: generateLinks === true,
      publicationUser: req.user,
      workflowFreeModeEnabled: true,
      generateLinks,
      generateMissingOnly,
      phases: requestedPhases
    })
    const publicationRefresh = generateLinks && refreshPublications
      ? await refreshGeneratedAccessPublications({
        year,
        voteLinkTarget,
        soutenanceLinkTarget: publicationTarget ? 'publication' : 'app'
      })
      : null

    if (generateLinks && resolvedAuditAction) {
      await safeLogAccessLinksAudit({
        year,
        action: resolvedAuditAction,
        user: req.user,
        payload: {
          summary: preview.summary,
          contexts: preview.contexts,
          publicationRefresh,
          generateMissingOnly: generateMissingOnly === true,
          phases: requestedPhases
        },
        success: !publicationRefresh?.warnings?.length,
        error: publicationRefresh?.warnings?.join(' | ') || undefined
      })
    }

    return res.status(200).json({
      success: true,
      workflowState: workflow?.state || 'planning',
      workflowPhases: workflow?.phases || {},
      activePhases: workflow?.activePhases || [],
      publicationRefresh,
      warnings: publicationRefresh?.warnings || [],
      ...preview
    })
  } catch (error) {
    if (generateLinks && resolvedAuditAction) {
      await safeLogAccessLinksAudit({
        year,
        action: resolvedAuditAction,
        user: req.user,
        payload: {
          generateMissingOnly: generateMissingOnly === true,
          phases: requestedPhases
        },
        success: false,
        error: error?.message || 'Erreur inconnue'
      })
    }

    console.error(`Erreur ${actionLabel} liens d acces:`, error)
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({
      error: statusCode < 500 && error?.message
        ? error.message
        : generateLinks
        ? 'Erreur lors de la generation des liens d acces.'
        : 'Erreur lors de la preparation des liens d acces.'
    })
  }
}

function normalizeEmailPreviewTarget(rawTarget = {}) {
  const target = rawTarget && typeof rawTarget === 'object' ? rawTarget : {}

  return {
    clientKey: compactText(target.clientKey || target.deliveryKey),
    linkId: compactText(target.linkId || target.id),
    personId: compactText(target.personId),
    recipientName: compactText(target.recipientName || target.personName || target.name),
    recipientEmail: getRecipientEmail(target.recipientEmail || target.email),
    recipientAudience: compactText(target.recipientAudience || target.audience),
    recipientRoles: Array.isArray(target.recipientRoles)
      ? target.recipientRoles.map(compactText).filter(Boolean)
      : [],
    magicLinkUrl: compactText(target.magicLinkUrl || target.url),
    expiresAt: target.expiresAt || null
  }
}

function formatEmailDeadline(value) {
  const date = value ? new Date(value) : null
  if (date && !Number.isNaN(date.getTime())) {
    return date.toLocaleDateString('fr-CH')
  }

  return 'selon la configuration active'
}

function normalizeSoutenanceAccessEmailMessageType(value) {
  return compactText(value) === 'schedule_update' ? 'schedule_update' : 'standard'
}

function buildSoutenanceEmailTemplateData(year, target = {}, options = {}) {
  const normalizedTarget = normalizeEmailPreviewTarget(target)

  return {
    recipientName: normalizedTarget.recipientName || 'Jean Expert',
    recipientAudience: normalizedTarget.recipientAudience || 'expert',
    recipientRoles: normalizedTarget.recipientRoles.length > 0 ? normalizedTarget.recipientRoles : ['expert'],
    year,
    magicLinkUrl: normalizedTarget.magicLinkUrl || `https://tpi${String(year).slice(-2)}.ch/?ml=preview`,
    deadline: formatEmailDeadline(normalizedTarget.expiresAt),
    messageType: normalizeSoutenanceAccessEmailMessageType(options.messageType || target?.messageType)
  }
}

async function handleAccessEmailPreview(req, res) {
  const year = req.validatedParams.year
  const template = compactText(req.body?.template || 'soutenanceAccess')
  const messageType = normalizeSoutenanceAccessEmailMessageType(req.body?.messageType || req.body?.target?.messageType)

  if (template !== 'soutenanceAccess') {
    return res.status(400).json({ error: 'Template email non supporté.' })
  }

  try {
    const emailSettings = await getSharedEmailSettingsIfAvailable()
    const email = emailService.emailTemplates.soutenanceAccess(
      emailService.buildTemplateData(
        buildSoutenanceEmailTemplateData(year, req.body?.target, { messageType }),
        { emailSettings }
      )
    )

    return res.status(200).json({
      success: true,
      year,
      template,
      messageType,
      subject: email.subject,
      html: email.html,
      text: email.text
    })
  } catch (error) {
    console.error('Erreur prévisualisation email accès:', error)
    return res.status(500).json({
      error: 'Erreur lors de la prévisualisation du template email.'
    })
  }
}

function normalizeEmailBatchTargets(rawTargets) {
  return (Array.isArray(rawTargets) ? rawTargets : [])
    .slice(0, 250)
    .map(normalizeEmailPreviewTarget)
    .filter((target) => target.linkId)
}

async function handleSendSoutenanceAccessEmails(req, res) {
  const year = req.validatedParams.year
  const targets = normalizeEmailBatchTargets(req.body?.targets)
  const testEmail = getRecipientEmail(req.body?.testEmail)
  const forceResend = parseBoolean(req.body?.forceResend, false)
  const messageType = normalizeSoutenanceAccessEmailMessageType(req.body?.messageType)

  if (targets.length === 0) {
    return res.status(400).json({ error: 'Aucun destinataire sélectionné.' })
  }

  if (testEmail && !isValidEmailAddress(testEmail)) {
    return res.status(400).json({ error: 'Adresse email de test invalide.' })
  }

  const baseUrl = getFrontendBaseUrl(req)
  const emailSettings = await getSharedEmailSettingsIfAvailable()
  const results = []

  for (const target of targets) {
    try {
      const resolvedLink = await accessLinkTokenService.findMagicLinkForEmailDelivery({
        id: target.linkId,
        year,
        type: 'soutenance',
        baseUrl
      })

      if (!resolvedLink?.raw || !resolvedLink?.public) {
        results.push({
          ...target,
          deliveryStatus: 'failed',
          error: 'Lien introuvable.'
        })
        continue
      }

      const rawLink = resolvedLink.raw
      const publicLink = resolvedLink.public
      const recipientEmail = testEmail || getRecipientEmail(rawLink.recipientEmail)
      const magicLinkUrl = target.magicLinkUrl || publicLink.url

      if (!recipientEmail || !isValidEmailAddress(recipientEmail)) {
        results.push({
          ...target,
          recipientEmail,
          deliveryStatus: 'failed',
          error: 'Adresse email invalide.'
        })
        continue
      }

      if (!magicLinkUrl || publicLink.availabilityStatus !== 'available') {
        results.push({
          ...target,
          recipientEmail,
          deliveryStatus: 'failed',
          error: 'Lien personnel indisponible ou expiré.'
        })
        continue
      }

      if (!testEmail && rawLink.emailDeliveryStatus === 'sent' && !forceResend) {
        results.push({
          ...target,
          recipientEmail,
          deliveryStatus: 'skipped',
          sentAt: rawLink.emailSentAt || null,
          messageId: rawLink.emailMessageId || '',
          error: 'Déjà envoyé.'
        })
        continue
      }

      const sentAt = new Date()
      const delivery = await emailService.sendEmail(recipientEmail, 'soutenanceAccess', {
        recipientName: target.recipientName || rawLink.personName || recipientEmail,
        recipientAudience: target.recipientAudience,
        recipientRoles: target.recipientRoles,
        year,
        magicLinkUrl,
        deadline: formatEmailDeadline(rawLink.expiresAt),
        messageType
      }, { emailSettings })

      if (!testEmail) {
        await accessLinkTokenService.markMagicLinkEmailDelivery({
          id: rawLink._id,
          status: delivery.success ? 'sent' : 'failed',
          messageId: delivery.messageId || '',
          error: delivery.error || '',
          sentAt
        })
      }

      results.push({
        ...target,
        recipientEmail,
        recipientName: target.recipientName || rawLink.personName || '',
        deliveryStatus: delivery.success ? 'sent' : 'failed',
        sentAt: delivery.success ? sentAt.toISOString() : null,
        messageId: delivery.messageId || '',
        error: delivery.error || '',
        testMode: Boolean(testEmail)
      })
    } catch (error) {
      results.push({
        ...target,
        deliveryStatus: 'failed',
        error: error?.message || 'Erreur lors de l’envoi.'
      })
    }
  }

  const sentCount = results.filter((entry) => entry.deliveryStatus === 'sent').length
  const skippedCount = results.filter((entry) => entry.deliveryStatus === 'skipped').length
  const failedCount = results.filter((entry) => entry.deliveryStatus === 'failed').length

  await safeLogAccessLinksAudit({
    year,
    action: testEmail
      ? 'workflow.access-links.email-test'
      : 'workflow.access-links.email-send',
    user: req.user,
    payload: {
      requestedCount: targets.length,
      sentCount,
      skippedCount,
      failedCount,
      testMode: Boolean(testEmail),
      messageType
    },
    success: failedCount === 0,
    error: failedCount > 0 ? `${failedCount} échec(s) email.` : undefined
  })

  return res.status(200).json({
    success: failedCount === 0,
    year,
    testMode: Boolean(testEmail),
    messageType,
    summary: {
      requestedCount: targets.length,
      sentCount,
      skippedCount,
      failedCount
    },
    results
  })
}

async function handleResetAccessEmailDeliveries(req, res) {
  const year = req.validatedParams.year
  const type = compactText(req.body?.type || 'soutenance') || 'soutenance'
  const linkIds = Array.isArray(req.body?.linkIds)
    ? req.body.linkIds.map(compactText).filter(Boolean)
    : []

  try {
    const resetResult = await accessLinkTokenService.resetMagicLinkEmailDeliveries({
      year,
      type,
      ids: linkIds
    })

    await safeLogAccessLinksAudit({
      year,
      action: 'workflow.access-links.email-reset',
      user: req.user,
      payload: {
        type,
        requestedLinkCount: linkIds.length,
        matchedCount: resetResult.matchedCount,
        modifiedCount: resetResult.modifiedCount
      },
      success: true
    })

    return res.status(200).json({
      success: true,
      year,
      type,
      requestedLinkCount: linkIds.length,
      ...resetResult
    })
  } catch (error) {
    await safeLogAccessLinksAudit({
      year,
      action: 'workflow.access-links.email-reset',
      user: req.user,
      payload: {
        type,
        requestedLinkCount: linkIds.length
      },
      success: false,
      error: error?.message || 'Erreur inconnue'
    })

    console.error('Erreur reset envois liens acces:', error)
    const statusCode = error?.message === 'Type de magic link invalide.' ? 400 : 500
    return res.status(statusCode).json({
      error: statusCode === 400
        ? error.message
        : 'Erreur lors du reset des envois de liens d acces.'
    })
  }
}

router.post(
  '/:year/access-links/preview',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => handleAccessLinks(req, res, { generateLinks: false })
)

router.post(
  '/:year/access-links/generate',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => handleAccessLinks(req, res, { generateLinks: true })
)

router.post(
  '/:year/access-links/reconcile',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => handleAccessLinks(req, res, {
    generateLinks: true,
    generateMissingOnly: true,
    phases: ['soutenance'],
    acceptRequestedPhases: false,
    refreshPublications: false,
    auditAction: 'workflow.access-links.reconcile',
    actionLabel: 'reconciliation'
  })
)

router.get(
  '/:year/access-links/logs',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year

    try {
      const logs = await accessLinkTokenService.listAccessLogs({
        year,
        type: compactText(req.query?.type),
        status: compactText(req.query?.status),
        personId: compactText(req.query?.personId),
        limit: parsePositiveInteger(req.query?.limit, 100)
      })

      return res.status(200).json({
        success: true,
        year,
        logs
      })
    } catch (error) {
      console.error('Erreur lecture logs liens acces:', error)
      return res.status(500).json({
        error: 'Erreur lors de la lecture des logs de liens d acces.'
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
      const baseUrl = `${req.protocol}://${req.get('host')}`
      const reminderOptions = { automatic: req.body?.automatic === true }
      const requestedVoteLinkTarget = compactText(req.body?.voteLinkTarget)
      const requestedVotePublicUrl = compactText(req.body?.votePublicUrl || req.body?.staticVotePublicUrl)
      const requestedTpiIds = Array.isArray(req.body?.tpiIds)
        ? req.body.tpiIds.map(compactText).filter(Boolean)
        : []

      if (requestedTpiIds.length > 0) {
        reminderOptions.tpiIds = requestedTpiIds
      }

      if (req.body?.movedOnly === true) {
        reminderOptions.movedOnly = true
      }

      if (requestedVoteLinkTarget) {
        reminderOptions.voteLinkTarget = requestedVoteLinkTarget
      }

      if (requestedVotePublicUrl) {
        reminderOptions.votePublicUrl = requestedVotePublicUrl
      }

      const result = await votingCampaignService.remindPendingVotes(year, baseUrl, reminderOptions)

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.votes.remind',
        user: req.user,
        payload: {
          automatic: result.automatic === true,
          skipped: result.skipped === true,
          reminderTargets: result.reminderTargets,
          emailsSent: result.emailsSent,
          emailsSucceeded: result.emailsSucceeded,
          movedOnly: result.movedOnly === true,
          requestedTpiCount: result.requestedTpiCount || null
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
    const legacyRooms = Array.isArray(req.body?.legacyRooms) && req.body.legacyRooms.length > 0
      ? req.body.legacyRooms
      : null
    let directPublication = null
    const workflowWarnings = []

    try {
      const workflow = await workflowService.getWorkflowYearState(year)

      if (legacyRooms) {
        workflowWarnings.push('Publication générée depuis la planification courante fournie par l\'admin.')
      }

      if (!legacyRooms && !workflow?.phases?.votes?.active) {
        try {
          const { snapshot } = await getValidatedSnapshotForDirectPublication(year)
          directPublication = await confirmSnapshotForDirectPublication({
            year,
            snapshot
          })
        } catch (error) {
          workflowWarnings.push(
            error?.message || 'Publication directe lancée sans snapshot validé.'
          )
        }
      }

      const blockingStatuses = ['voting', 'pending_validation', 'manual_required']
      const blockingCount = await TpiPlanning.countDocuments({
        year,
        status: { $in: blockingStatuses }
      })

      if (blockingCount > 0) {
        workflowWarnings.push(
          `${blockingCount} TPI restent en vote ou en intervention manuelle: publication forcée par l'admin.`
        )
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`
      const defenseTargetUrl = buildDefensePublicPath(year)
      const publishedResult = legacyRooms
        ? await publishedSoutenanceService.publishRoomsAsSoutenances(year, legacyRooms, req.user, {
          origin: 'admin_current_planning'
        })
        : await publishedSoutenanceService.publishConfirmedPlanningSoutenances(year, req.user)
      const roomCount = Array.isArray(publishedResult?.rooms)
        ? publishedResult.rooms.length
        : 0
      const publicationVersion = publishedResult?.publicationVersion || null
      const sendLinkOptions = {
        publicationRooms: Array.isArray(publishedResult?.rooms) ? publishedResult.rooms : [],
        generateMissingAccessLinks: true,
        skipEmails: true
      }
      await applySoutenanceSendLinkOptions(year, req.body, sendLinkOptions)

      const sentLinks = await votingCampaignService.sendSoutenanceLinksForYear(
        year,
        baseUrl,
        publicationVersion?.version || null,
        sendLinkOptions
      )

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.publication.publish',
        user: req.user,
        payload: {
          publicationVersion: publicationVersion?.version || null,
          roomsCount: roomCount,
          sentLinks,
          directPublication,
          targetUrl: defenseTargetUrl,
          warnings: workflowWarnings
        },
        success: true
      })

      return res.status(200).json({
        success: true,
        year,
        roomsCount: roomCount,
        publicationVersion,
        sentLinks,
        directPublication,
        targetUrl: defenseTargetUrl,
        workflow,
        workflowState: workflow?.state || 'planning',
        activePhases: workflow?.activePhases || [],
        warnings: workflowWarnings,
        message: roomCount > 0
          ? `${roomCount} salles publiées depuis ${legacyRooms ? 'la planification courante' : 'la planification confirmée'}${directPublication ? ' sans campagne de votes' : ''}`
          : 'Aucune défense confirmée à publier'
      })
    } catch (error) {
      if (error?.statusCode) {
        await workflowService.logWorkflowAuditEvent({
          year,
          action: 'workflow.publication.publish',
          user: req.user,
          payload: {
            directPublication
          },
          success: false,
          error: error.message
        })

        return res.status(error.statusCode).json({
          error: error.message,
          details: error.details
        })
      }

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
      const rollbackResult = await publishedSoutenanceService.rollbackPublicationVersion(year, version)
      const defenseTargetUrl = buildDefensePublicPath(year)

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.publication.rollback',
        user: req.user,
        payload: {
          publicationVersion: rollbackResult?.publicationVersion?.version || version,
          targetUrl: defenseTargetUrl
        },
        success: true
      })

      return res.status(200).json({
        success: true,
        year,
        publicationVersion: rollbackResult?.publicationVersion || null,
        targetUrl: defenseTargetUrl
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
  '/:year/publication/deactivate',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year

    try {
      const workflowWarnings = []
      const snapshot = await workflowService.hasActivePlanningSnapshot(year)
      if (!snapshot) {
        workflowWarnings.push('Aucun snapshot actif: désactivation lancée par l\'admin.')
      }

      const deactivationResult = await publishedSoutenanceService.deactivatePublication(year)
      const nextWorkflow = await workflowService.getWorkflowYearState(year)

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.publication.deactivate',
        user: req.user,
        payload: {
          ...deactivationResult,
          voteCampaign: null,
          activePhases: nextWorkflow?.activePhases || [],
          warnings: workflowWarnings
        },
        success: true
      })

      return res.status(200).json({
        success: true,
        year,
        workflowState: nextWorkflow?.state || 'planning',
        workflow: nextWorkflow,
        activePhases: nextWorkflow?.activePhases || [],
        voteCampaign: null,
        warnings: workflowWarnings,
        ...deactivationResult,
        message: 'Publication des défenses désactivée.'
      })
    } catch (error) {
      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.publication.deactivate',
        user: req.user,
        payload: {},
        success: false,
        error: error?.message || 'Erreur inconnue'
      })

      console.error('Erreur desactivation publication workflow:', error)
      return res.status(500).json({ error: 'Erreur lors de la desactivation de la publication.' })
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
      const baseUrl = `${req.protocol}://${req.get('host')}`
      const sendLinkOptions = {}
      await applySoutenanceSendLinkOptions(year, req.body, sendLinkOptions)

      const sentLinks = await votingCampaignService.sendSoutenanceLinksForYear(
        year,
        baseUrl,
        null,
        sendLinkOptions
      )

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
      console.error('Erreur envoi liens défenses:', error)
      return res.status(500).json({ error: 'Erreur lors de l\'envoi des liens défenses.' })
    }
  }
)

router.get(
  '/:year/publication/final-schedule/preview',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year

    try {
      const preview = await finalScheduleDeliveryService.previewFinalScheduleDelivery({
        year,
        publicationVersion: parseOptionalPositiveInteger(req.query?.publicationVersion)
      })

      return res.status(200).json(preview)
    } catch (error) {
      console.error('Erreur aperçu envoi horaires définitifs:', error)
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erreur lors de la préparation de l’envoi des horaires définitifs.'
      })
    }
  }
)

router.post(
  '/:year/publication/final-schedule/send',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year

    try {
      const result = await finalScheduleDeliveryService.sendFinalScheduleDelivery({
        year,
        publicationVersion: parseOptionalPositiveInteger(req.body?.publicationVersion),
        forceResend: parseBoolean(req.body?.forceResend, false)
      })

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.publication.final-schedule.send',
        user: req.user,
        payload: {
          publicationVersion: result.publicationVersion || null,
          summary: result.summary || null,
          available: result.available === true,
          reason: result.reason || null
        },
        success: result.success !== false
      })

      return res.status(200).json(result)
    } catch (error) {
      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.publication.final-schedule.send',
        user: req.user,
        payload: {
          publicationVersion: parseOptionalPositiveInteger(req.body?.publicationVersion)
        },
        success: false,
        error: error?.message || 'Erreur inconnue'
      })

      console.error('Erreur envoi horaires définitifs:', error)
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erreur lors de l’envoi des horaires définitifs.'
      })
    }
  }
)

router.get(
  '/:year/publication/defense-changes/preview',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year

    try {
      const preview = await publicationChangeNotificationService.previewDefenseChangeNotifications({
        year,
        publicationVersion: parseOptionalPositiveInteger(req.query?.publicationVersion)
      })

      return res.status(200).json(preview)
    } catch (error) {
      console.error('Erreur aperçu notifications changements défenses:', error)
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erreur lors de la préparation des notifications de changements des défenses.'
      })
    }
  }
)

router.post(
  '/:year/publication/defense-changes/send',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year

    try {
      const linkTarget = await resolveDefenseChangeNotificationLinkTarget(year, req)
      const result = await publicationChangeNotificationService.sendDefenseChangeNotifications({
        year,
        publicationVersion: parseOptionalPositiveInteger(req.body?.publicationVersion),
        baseUrl: linkTarget.baseUrl,
        redirectPath: linkTarget.redirectPath,
        linkTarget: linkTarget.linkTarget,
        forceResend: parseBoolean(req.body?.forceResend, false)
      })

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.publication.defense-changes.send',
        user: req.user,
        payload: {
          currentVersion: result?.preview?.currentVersion || null,
          previousVersion: result?.preview?.previousVersion || null,
          summary: result?.summary || {},
          notificationSummary: result?.preview?.summary || {},
          linkTarget: linkTarget.linkTarget
        },
        success: result?.success !== false,
        error: result?.success === false ? `${result?.summary?.failedCount || 0} échec(s) notification.` : undefined
      })

      return res.status(result?.success === false ? 207 : 200).json(result)
    } catch (error) {
      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.publication.defense-changes.send',
        user: req.user,
        payload: {},
        success: false,
        error: error?.message || 'Erreur inconnue'
      })

      console.error('Erreur envoi notifications changements défenses:', error)
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erreur lors de l’envoi des notifications de changements des défenses.'
      })
    }
  }
)

router.post(
  '/:year/access-links/email-preview',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => handleAccessEmailPreview(req, res)
)

router.post(
  '/:year/access-links/send-soutenance-emails',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => handleSendSoutenanceAccessEmails(req, res)
)

router.post(
  '/:year/access-links/email-deliveries/reset',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => handleResetAccessEmailDeliveries(req, res)
)

router.post(
  '/:year/reset',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  requireNonEmptyBody('Confirmation de reset requise.'),
  async (req, res) => {
    const year = req.validatedParams.year
    const confirmation = compactText(req.body?.confirmation).toUpperCase()
    const expectedConfirmation = `RECOMMENCER ${year}`

    if (confirmation !== expectedConfirmation) {
      return res.status(400).json({
        error: 'Confirmation de reset invalide.',
        details: {
          expectedConfirmation
        }
      })
    }

    try {
      const result = await workflowService.resetWorkflowYear({
        year,
        user: req.user
      })
      const workflow = await workflowService.getWorkflowYearState(year)

      return res.status(200).json({
        success: true,
        year,
        workflow,
        deleted: result.deleted
      })
    } catch (error) {
      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.reset',
        user: req.user,
        payload: {},
        success: false,
        error: error?.message || 'Erreur inconnue'
      })

      console.error('Erreur reset workflow annuel:', error)
      return res.status(500).json({ error: 'Erreur lors de la réinitialisation du workflow annuel.' })
    }
  }
)

router.get(
  '/:year/static-publication/status',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    try {
      const status = await staticDefensePublicationService.getStaticPublicationStatus(req.validatedParams.year)

      return res.status(200).json(status)
    } catch (error) {
      console.error('Erreur statut publication statique:', error)
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erreur lors de la lecture de la publication statique.'
      })
    }
  }
)

router.get(
  '/:year/static-publication/preview',
  requireYearParam('year'),
  async (req, res) => {
    try {
      const status = await staticDefensePublicationService.getStaticPublicationStatus(req.validatedParams.year)

      if (!status.available) {
        return res.status(404).send('Page statique non generee.')
      }

      res.setHeader('Cache-Control', 'no-store')
      return res.sendFile(status.indexPath)
    } catch (error) {
      console.error('Erreur aperçu publication statique:', error)
      return res.status(error.statusCode || 500).send(
        error.message || 'Erreur lors de l aperçu de la publication statique.'
      )
    }
  }
)

router.post(
  '/:year/static-publication/generate',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year

    try {
      const result = await staticDefensePublicationService.generateStaticDefensesSite(year)

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.staticPublication.generate',
        user: req.user,
        payload: {
          roomCount: result.roomCount,
          defenseCount: result.defenseCount,
          previewPath: result.previewPath,
          remoteDir: result.remoteDir
        },
        success: true
      })

      return res.status(200).json(result)
    } catch (error) {
      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.staticPublication.generate',
        user: req.user,
        payload: {},
        success: false,
        error: error.message
      })

      console.error('Erreur generation publication statique:', error)
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erreur lors de la generation de la page statique.'
      })
    }
  }
)

router.post(
  '/:year/static-publication/publish',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year

    try {
      const result = await staticDefensePublicationService.publishStaticDefensesSite(year)

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.staticPublication.publish',
        user: req.user,
        payload: {
          publicUrl: result.publicUrl,
          remoteDir: result.remoteDir,
          defenseCount: result.defenseCount
        },
        success: true
      })

      return res.status(200).json(result)
    } catch (error) {
      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.staticPublication.publish',
        user: req.user,
        payload: {},
        success: false,
        error: error.message
      })

      console.error('Erreur publication statique FTP:', error)
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erreur lors de la publication statique par FTP.'
      })
    }
  }
)

router.get(
  '/:year/static-votes/status',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    try {
      const status = await staticVotePublicationService.getStaticVotePublicationStatus(req.validatedParams.year)

      return res.status(200).json(status)
    } catch (error) {
      console.error('Erreur statut publication vote statique:', error)
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erreur lors de la lecture de la publication vote statique.'
      })
    }
  }
)

router.get(
  '/:year/static-votes/preview',
  requireYearParam('year'),
  async (req, res) => {
    try {
      const status = await staticVotePublicationService.getStaticVotePublicationStatus(req.validatedParams.year)

      if (!status.available) {
        return res.status(404).send('Publication vote non generee.')
      }

      res.setHeader('Cache-Control', 'no-store')
      return res.sendFile(status.indexPath)
    } catch (error) {
      console.error('Erreur aperçu publication vote statique:', error)
      return res.status(error.statusCode || 500).send(
        error.message || 'Erreur lors de l apercu de la publication vote statique.'
      )
    }
  }
)

router.post(
  '/:year/static-votes/generate',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year

    try {
      const staticVoteSyncSummary = await syncStaticVotesForProtectedUpdate(year)
      const result = await staticVotePublicationService.generateStaticVotesSite(year)
      const response = {
        ...result,
        warnings: buildStaticVoteSyncWarnings(staticVoteSyncSummary)
      }

      if (staticVoteSyncSummary && !staticVoteSyncSummary.skipped) {
        response.staticVoteSyncSummary = staticVoteSyncSummary
      }

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.staticVotes.generate',
        user: req.user,
        payload: {
          campaignId: result.campaignId,
          groupCount: result.groupCount,
          accessLinkCount: result.accessLinkCount,
          previewPath: result.previewPath,
          remoteDir: result.remoteDir,
          staticVoteSyncSummary
        },
        success: true
      })

      return res.status(200).json(response)
    } catch (error) {
      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.staticVotes.generate',
        user: req.user,
        payload: {},
        success: false,
        error: error.message
      })

      console.error('Erreur generation publication vote statique:', error)
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erreur lors de la generation de la publication vote statique.',
        details: error.details
      })
    }
  }
)

router.post(
  '/:year/static-votes/publish',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year

    try {
      const staticVoteSyncSummary = await syncStaticVotesForProtectedUpdate(year)
      const result = await staticVotePublicationService.publishStaticVotesSite(year)
      const response = {
        ...result,
        warnings: buildStaticVoteSyncWarnings(staticVoteSyncSummary)
      }

      if (staticVoteSyncSummary && !staticVoteSyncSummary.skipped) {
        response.staticVoteSyncSummary = staticVoteSyncSummary
      }

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.staticVotes.publish',
        user: req.user,
        payload: {
          publicUrl: result.publicUrl,
          remoteDir: result.remoteDir,
          groupCount: result.groupCount,
          accessLinkCount: result.accessLinkCount,
          staticVoteSyncSummary
        },
        success: true
      })

      return res.status(200).json(response)
    } catch (error) {
      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.staticVotes.publish',
        user: req.user,
        payload: {},
        success: false,
        error: error.message
      })

      console.error('Erreur publication vote statique FTP:', error)
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erreur lors de la publication vote statique par FTP.',
        details: error.details
      })
    }
  }
)

router.post(
  '/:year/static-votes/sync',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  async (req, res) => {
    const year = req.validatedParams.year
    const remoteUrl = compactText(req.body?.remoteUrl)

    try {
      const result = await staticVotePublicationService.syncStaticVoteResponses({
        year,
        remoteUrl
      })

      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.staticVotes.sync',
        user: req.user,
        payload: {
          receivedCount: result.receivedCount,
          voteReceivedCount: result.voteReceivedCount,
          voteProcessedCount: result.voteProcessedCount,
          arbitrageReceivedCount: result.arbitrageReceivedCount,
          importedCount: result.importedCount,
          arbitrageImportedCount: result.arbitrageImportedCount,
          skippedCount: result.skippedCount,
          failedCount: result.failedCount,
          ignoredCampaignCount: result.ignoredCampaignCount,
          ignoredCampaignIds: result.ignoredCampaignIds,
          sourceUrl: result.sourceUrl
        },
        success: result.failedCount === 0
      })

      return res.status(result.failedCount > 0 ? 207 : 200).json(result)
    } catch (error) {
      await workflowService.logWorkflowAuditEvent({
        year,
        action: 'workflow.staticVotes.sync',
        user: req.user,
        payload: { remoteUrl },
        success: false,
        error: error.message
      })

      console.error('Erreur synchronisation vote statique:', error)
      return res.status(error.statusCode || 500).json({
        error: error.message || 'Erreur lors de la synchronisation des votes statiques.'
      })
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
  '/:year/phases/:phase',
  requireYearParam('year'),
  authMiddleware,
  requireRole('admin'),
  requireNonEmptyBody('Donnees de phase requises.'),
  async (req, res) => {
    const year = req.validatedParams.year
    const phase = workflowService.normalizeWorkflowPhase(req.params.phase)
    const active = parseOptionalBoolean(req.body?.active)
    const reason = compactText(req.body?.reason)

    if (!phase) {
      return res.status(400).json({ error: 'Phase workflow invalide.' })
    }

    if (active === null) {
      return res.status(400).json({ error: 'Valeur active requise.' })
    }

    try {
      const result = await workflowService.setWorkflowPhaseActive({
        year,
        phase,
        active,
        user: req.user,
        reason
      })

      return res.status(200).json({
        success: true,
        changed: result.changed,
        phase: result.phase,
        active: result.active,
        workflow: result.workflow,
        workflowState: result.workflow?.state || 'planning',
        activePhases: result.workflow?.activePhases || []
      })
    } catch (error) {
      console.error('Erreur activation phase workflow:', error)
      return res.status(500).json({ error: 'Erreur lors de la mise a jour de la phase workflow.' })
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
