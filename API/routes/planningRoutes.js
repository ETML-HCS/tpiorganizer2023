/**
 * Routes API pour le système de planification des TPI
 */

const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()

// Models
const Person = require('../models/personModel')
const Slot = require('../models/slotModel')
const Vote = require('../models/voteModel')
const TpiPlanning = require('../models/tpiPlanningModel')
const personImportService = require('../services/personImportService')
const personRegistryService = require('../services/personRegistryService')
const { backfillMissingPersonShortIds } = require('../services/personShortIdService')

// Services
const schedulingService = require('../services/schedulingService')
const magicLinkService = require('../services/magicLinkService')
const emailService = require('../services/emailService')
const { filterPlanifiableTpis } = require('../services/tpiPlanningVisibility')
const {
  getPlanningConfig,
  getPlanningConfigIfAvailable,
  normalizeAccessLinkSettings,
  normalizeWorkflowSettings,
  savePlanningConfig
} = require('../services/planningConfigService')
const {
  buildConfiguredSlotProposalOptions,
  buildProposalOptionDisplay,
  buildSlotQueueKey,
  buildVoteProposalContext,
  filterSlotDocumentsForVoteProposal
} = require('../services/voteProposalOptionsService')
const {
  toPlanningTpiResponseObject
} = require('../services/planningTpiResponseService')
const {
  getSharedEmailSettingsIfAvailable,
  getSharedPlanningCatalog,
  saveSharedPlanningCatalog
} = require('../services/planningCatalogService')

// Middleware d'authentification
const { authMiddleware, requireRole } = magicLinkService
const {
  requireObjectIdParam,
  requireNonEmptyBody,
  requireYearParam
} = require('../middleware/requestValidation')

const ALLOWED_VOTE_DECISIONS = new Set(['accepted', 'rejected', 'preferred'])
const ALLOWED_VOTE_RESPONSE_MODES = new Set(['ok', 'proposal'])
const INDICATIVE_QUEUE_VOTE_DECISIONS = ['accepted', 'preferred']
const VOTE_REQUIRED_ROLES = ['expert1', 'expert2', 'chef_projet']

function getRouteErrorResponse(error, fallbackMessage) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500

  return {
    statusCode,
    payload: {
      error: statusCode === 503
        ? (error?.message || fallbackMessage)
        : fallbackMessage
    }
  }
}

function toPublicVoteSettings(planningConfig = {}) {
  const settings = normalizeWorkflowSettings(planningConfig?.workflowSettings)
  return {
    maxProposalsPerTpi: settings.maxVoteProposals,
    allowSpecialRequest: settings.allowSpecialVoteRequest
  }
}

async function getVoteSettingsForYear(year, cache = null) {
  const numericYear = toInteger(year)
  const cacheKey = Number.isInteger(numericYear) ? String(numericYear) : ''

  if (cache && cacheKey && cache.has(cacheKey)) {
    return cache.get(cacheKey)
  }

  let settings = toPublicVoteSettings()

  if (Number.isInteger(numericYear)) {
    try {
      const planningConfig = await getPlanningConfigIfAvailable(numericYear)
      settings = toPublicVoteSettings(planningConfig)
    } catch (error) {
      console.warn(`Impossible de charger les règles de vote ${numericYear}:`, error?.message || error)
    }
  }

  if (cache && cacheKey) {
    cache.set(cacheKey, settings)
  }

  return settings
}

function buildMaxVoteProposalsMessage(limit, suffix = 'par TPI et par votant') {
  return `Maximum ${limit} créneau${limit > 1 ? 'x' : ''} alternatif${limit > 1 ? 's' : ''} ${suffix}.`
}

async function getAccessLinkSettingsForYear(year, cache = null) {
  const numericYear = toInteger(year)
  const cacheKey = Number.isInteger(numericYear) ? String(numericYear) : ''

  if (cache && cacheKey && cache.has(cacheKey)) {
    return cache.get(cacheKey)
  }

  let settings = normalizeAccessLinkSettings()

  if (Number.isInteger(numericYear)) {
    try {
      const planningConfig = await getPlanningConfigIfAvailable(numericYear)
      settings = normalizeAccessLinkSettings(planningConfig?.accessLinkSettings)
    } catch (error) {
      console.warn(`Impossible de charger les règles de liens ${numericYear}:`, error?.message || error)
    }
  }

  if (cache && cacheKey) {
    cache.set(cacheKey, settings)
  }

  return settings
}

router.get('/catalog', async (req, res) => {
  try {
    const catalog = await getSharedPlanningCatalog()
    return res.json(catalog)
  } catch (error) {
    console.error('Erreur lors du chargement du catalogue partagé:', error)
    const response = getRouteErrorResponse(error, 'Erreur lors du chargement du catalogue partagé.')
    return res.status(response.statusCode).json(response.payload)
  }
})

router.put(
  '/catalog',
  authMiddleware,
  requireRole('admin'),
  requireNonEmptyBody('Catalogue requis.'),
  async (req, res) => {
    try {
      const savedCatalog = await saveSharedPlanningCatalog(req.body)
      return res.json(savedCatalog)
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du catalogue partagé:', error)
      const response = getRouteErrorResponse(error, 'Erreur lors de la sauvegarde du catalogue partagé.')
      return res.status(response.statusCode).json(response.payload)
    }
  }
)

router.get('/config/:year', requireYearParam('year'), async (req, res) => {
  try {
    const { year } = req.validatedParams
    const config = await getPlanningConfig(year)

    if (!config) {
      return res.status(404).json({ error: 'Configuration introuvable.' })
    }

    return res.json(config)
  } catch (error) {
    console.error(`Erreur lors du chargement de la configuration ${req.params.year}:`, error)
    const response = getRouteErrorResponse(error, 'Erreur lors du chargement de la configuration.')
    return res.status(response.statusCode).json(response.payload)
  }
})

router.put(
  '/config/:year',
  authMiddleware,
  requireRole('admin'),
  requireYearParam('year'),
  requireNonEmptyBody('Configuration requise.'),
  async (req, res) => {
    try {
      const { year } = req.validatedParams
      const savedConfig = await savePlanningConfig(year, req.body)

      return res.json(savedConfig)
    } catch (error) {
      console.error(`Erreur lors de la sauvegarde de la configuration ${req.params.year}:`, error)
      const response = getRouteErrorResponse(error, 'Erreur lors de la sauvegarde de la configuration.')
      return res.status(response.statusCode).json(response.payload)
    }
  }
)

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function toInteger(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return null
    }

    const parsed = Number(trimmed)
    return Number.isInteger(parsed) ? parsed : null
  }

  return null
}

function parseShortIdSearch(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/\s+/g, '')

  if (!normalized) {
    return null
  }

  const prefixedMatch = normalized.match(/^[A-Z][-:]?(\d{1,3})$/)
  if (prefixedMatch) {
    return toInteger(prefixedMatch[1])
  }

  return toInteger(normalized)
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

function toObjectIdOrNull(value) {
  return isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null
}

function toDateOrNull(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getVoteMagicLinkContext(req) {
  const authContext = req.user?.authContext

  if (authContext?.type !== 'vote_magic_link') {
    return null
  }

  const personId = authContext.personId || req.user?.id
  const personObjectId = toObjectIdOrNull(personId)

  if (!personObjectId) {
    return null
  }

  return {
    ...authContext,
    personId: String(personId),
    personObjectId
  }
}

function rejectVoteScope(res, message = 'Acces hors scope du lien de vote.') {
  return res.status(403).json({ error: message })
}

function buildScopedVoteTpiFilter(req, year) {
  const context = getVoteMagicLinkContext(req)

  if (!context) {
    return { year }
  }

  if (Number(context.year) !== Number(year)) {
    return null
  }

  const scopedFilter = {
    year,
    $or: [
      { expert1: context.personObjectId },
      { expert2: context.personObjectId },
      { chefProjet: context.personObjectId }
    ]
  }

  const scopedTpiObjectId = toObjectIdOrNull(context.scope?.tpiId)
  if (scopedTpiObjectId) {
    scopedFilter._id = scopedTpiObjectId
  }

  return scopedFilter
}

function resolveVoteParticipantId(req) {
  const context = getVoteMagicLinkContext(req)

  if (context?.personObjectId) {
    return context.personObjectId
  }

  if (isValidObjectId(req.user?.id)) {
    return new mongoose.Types.ObjectId(req.user.id)
  }

  return null
}

async function getPreferredVoteCountForVoter({ tpiPlanningId, voterId, excludeVoteId = null }) {
  const filter = {
    tpiPlanning: tpiPlanningId,
    voter: voterId,
    decision: 'preferred'
  }

  if (excludeVoteId) {
    filter._id = { $ne: excludeVoteId }
  }

  return await Vote.countDocuments(filter)
}

function getFixedSlotIdFromTpi(tpi) {
  const fixedSlot = Array.isArray(tpi?.proposedSlots)
    ? tpi.proposedSlots.find((proposedSlot) => proposedSlot?.slot)
    : null

  return fixedSlot?.slot?._id
    ? String(fixedSlot.slot._id)
    : fixedSlot?.slot
      ? String(fixedSlot.slot)
      : null
}

function isVoteScopeCompatibleWithTpi(req, tpi, year = null) {
  const context = getVoteMagicLinkContext(req)

  if (!context) {
    return true
  }

  const targetYear = year === null || year === undefined
    ? Number(tpi?.year)
    : Number(year)

  if (Number(context.year) !== targetYear || Number(tpi?.year) !== targetYear) {
    return false
  }

  const scopedTpiId = context.scope?.tpiId
  if (scopedTpiId && String(scopedTpiId) !== String(tpi?._id || '')) {
    return false
  }

  const participantIds = [
    tpi?.expert1,
    tpi?.expert2,
    tpi?.chefProjet
  ]
    .filter(Boolean)
    .map(person => String(person?._id || person))

  return participantIds.includes(String(context.personId))
}

function buildSlotSortKey(slot) {
  const date = new Date(slot?.date || 0).getTime()
  return [
    Number.isFinite(date) ? String(date) : '0',
    String(slot?.period || ''),
    String(slot?.startTime || ''),
    String(slot?.room?.name || '')
  ].join('|')
}

function normalizePlanningLookup(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase()
}

function isSlotSiteCompatibleWithTpi(slot, tpi) {
  const tpiSite = normalizePlanningLookup(tpi?.site || tpi?.lieu?.site)

  if (!tpiSite) {
    return true
  }

  const slotSite = normalizePlanningLookup(slot?.room?.site)
  return !slotSite || slotSite === tpiSite
}

function buildDateRangeFilters(dateKeys = []) {
  return (Array.isArray(dateKeys) ? dateKeys : [])
    .map((dateKey) => {
      const start = new Date(`${dateKey}T00:00:00.000Z`)
      if (Number.isNaN(start.getTime())) {
        return null
      }

      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
      return {
        date: {
          $gte: start,
          $lt: end
        }
      }
    })
    .filter(Boolean)
}

function toDateKey(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function hasUsefulQueueKey(value) {
  return String(value || '').replace(/\|/g, '').trim().length > 0
}

function getProposalOptionRank(option) {
  if (option?.source === 'existing_vote') {
    return 0
  }

  if (option?.availabilityStatus === 'available' || option?.source === 'planning_option') {
    return 1
  }

  if (option?.availabilityStatus === 'planning_window' || option?.source === 'planning_config_window') {
    return 2
  }

  return 3
}

function getProposalOptionScore(option) {
  const score = Number(option?.score)
  return Number.isFinite(score) ? score : Number.NEGATIVE_INFINITY
}

function isBetterProposalWindowOption(candidate, current) {
  if (!current) {
    return true
  }

  const candidateRank = getProposalOptionRank(candidate)
  const currentRank = getProposalOptionRank(current)
  if (candidateRank !== currentRank) {
    return candidateRank < currentRank
  }

  const candidateScore = getProposalOptionScore(candidate)
  const currentScore = getProposalOptionScore(current)
  if (candidateScore !== currentScore) {
    return candidateScore > currentScore
  }

  return buildSlotSortKey(candidate?.slot).localeCompare(buildSlotSortKey(current?.slot)) < 0
}

function addProposalOptionByWindow(optionsByWindowKey, option) {
  const queueKey = option?.queueKey || buildSlotQueueKey(option?.slot)

  if (!hasUsefulQueueKey(queueKey)) {
    return false
  }

  const normalizedOption = {
    ...option,
    queueKey
  }
  const current = optionsByWindowKey.get(queueKey)

  if (isBetterProposalWindowOption(normalizedOption, current)) {
    optionsByWindowKey.set(queueKey, normalizedOption)
    return true
  }

  return false
}

function getSlotCapacityPeriodKey(slot) {
  if (Number.isInteger(Number(slot?.period))) {
    return `P${Number(slot.period)}`
  }

  return [
    slot?.startTime || '',
    slot?.endTime || ''
  ].join('-')
}

function getOptionFallbackCapacity(option) {
  const capacity = Number(option?.display?.windowCapacity)
  return Number.isFinite(capacity) && capacity > 0 ? Math.floor(capacity) : null
}

function getOptionQueueCapacity(option, capacityPeriodsByQueueKey = new Map()) {
  const fromSlots = capacityPeriodsByQueueKey.get(option?.queueKey)?.size
  if (Number.isInteger(fromSlots) && fromSlots > 0) {
    return fromSlots
  }

  return getOptionFallbackCapacity(option)
}

function withQueueData(option, count, capacity = null) {
  const normalizedCount = Math.max(0, Math.floor(Number(count) || 0))
  const normalizedCapacity = Number.isFinite(Number(capacity)) && Number(capacity) > 0
    ? Math.floor(Number(capacity))
    : null

  return {
    ...option,
    queue: {
      count: normalizedCount,
      capacity: normalizedCapacity,
      nextPosition: normalizedCount + 1,
      source: 'votes'
    }
  }
}

async function attachVoteQueueCountsToProposalOptions(options = [], tpi = {}) {
  const normalizedOptions = Array.isArray(options) ? options : []
  if (normalizedOptions.length === 0) {
    return normalizedOptions
  }

  const optionQueueKeys = new Set()
  const optionDateKeys = new Set()

  for (const option of normalizedOptions) {
    const queueKey = option.queueKey || buildSlotQueueKey(option.slot)
    option.queueKey = queueKey

    if (hasUsefulQueueKey(queueKey)) {
      optionQueueKeys.add(queueKey)
    }

    const dateKey = toDateKey(option.slot?.date)
    if (dateKey) {
      optionDateKeys.add(dateKey)
    }
  }

  if (optionQueueKeys.size === 0 || optionDateKeys.size === 0) {
    return normalizedOptions.map((option) => withQueueData(option, 0, getOptionFallbackCapacity(option)))
  }

  const relatedSlotDocuments = await Slot.find({
    year: tpi.year,
    $or: buildDateRangeFilters(Array.from(optionDateKeys))
  })
    .select('date period startTime endTime room')
    .lean()

  const queueKeyBySlotId = new Map()
  const capacityPeriodsByQueueKey = new Map()
  const relatedSlotIds = []

  for (const slotDocument of relatedSlotDocuments) {
    if (!isSlotSiteCompatibleWithTpi(slotDocument, tpi)) {
      continue
    }

    const queueKey = buildSlotQueueKey(slotDocument)
    if (!optionQueueKeys.has(queueKey)) {
      continue
    }

    if (!capacityPeriodsByQueueKey.has(queueKey)) {
      capacityPeriodsByQueueKey.set(queueKey, new Set())
    }
    capacityPeriodsByQueueKey.get(queueKey).add(getSlotCapacityPeriodKey(slotDocument))

    const slotId = slotDocument?._id ? String(slotDocument._id) : ''
    if (!slotId) {
      continue
    }

    relatedSlotIds.push(slotDocument._id)
    queueKeyBySlotId.set(slotId, queueKey)
  }

  if (relatedSlotIds.length === 0) {
    return normalizedOptions.map((option) =>
      withQueueData(option, 0, getOptionQueueCapacity(option, capacityPeriodsByQueueKey))
    )
  }

  const positiveVotes = await Vote.find({
    slot: { $in: relatedSlotIds },
    decision: { $in: INDICATIVE_QUEUE_VOTE_DECISIONS }
  })
    .select('slot voter')
    .lean()

  const votersByQueueKey = new Map()
  for (const vote of positiveVotes) {
    const queueKey = queueKeyBySlotId.get(String(vote.slot || ''))
    const voterId = String(vote.voter || '')

    if (!queueKey || !voterId) {
      continue
    }

    if (!votersByQueueKey.has(queueKey)) {
      votersByQueueKey.set(queueKey, new Set())
    }

    votersByQueueKey.get(queueKey).add(voterId)
  }

  return normalizedOptions.map((option) => {
    const count = votersByQueueKey.get(option.queueKey)?.size || 0

    return withQueueData(option, count, getOptionQueueCapacity(option, capacityPeriodsByQueueKey))
  })
}

function buildVoteResponseMode(roleStatus) {
  if (!roleStatus || roleStatus.decision === 'pending') {
    return 'pending'
  }

  if (roleStatus.decision === 'accepted') {
    return 'ok'
  }

  if (
    roleStatus.alternativeCount > 0 ||
    roleStatus.availabilityException ||
    roleStatus.specialRequestReason ||
    roleStatus.specialRequestDate
  ) {
    return 'proposal'
  }

  return roleStatus.decision
}

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function toIdString(value) {
  if (!value) {
    return ''
  }

  if (value._id) {
    return String(value._id)
  }

  return String(value)
}

function serializeVoteSlot(slot) {
  if (!slot) {
    return null
  }

  const rawSlot = typeof slot.toObject === 'function'
    ? slot.toObject()
    : slot

  return {
    _id: toIdString(rawSlot),
    date: rawSlot.date || null,
    period: rawSlot.period || '',
    startTime: rawSlot.startTime || '',
    endTime: rawSlot.endTime || '',
    room: rawSlot.room || null,
    status: rawSlot.status || ''
  }
}

function formatVotePersonName(person) {
  if (!person) {
    return ''
  }

  return [person.firstName, person.lastName]
    .map(compactText)
    .filter(Boolean)
    .join(' ')
}

function makePendingSlotRoleDecision(role) {
  return {
    role,
    decision: 'pending',
    voteId: '',
    voterName: '',
    votedAt: null,
    comment: '',
    priority: null,
    availabilityException: false,
    specialRequestReason: '',
    specialRequestDate: null
  }
}

function makeVoteSlotEntry(slot, fixedSlotId) {
  const serializedSlot = serializeVoteSlot(slot)
  const slotId = toIdString(serializedSlot)

  return {
    slotId,
    slot: serializedSlot,
    isFixed: Boolean(slotId && fixedSlotId && slotId === fixedSlotId),
    roleDecisions: {
      expert1: makePendingSlotRoleDecision('expert1'),
      expert2: makePendingSlotRoleDecision('expert2'),
      chef_projet: makePendingSlotRoleDecision('chef_projet')
    }
  }
}

function countVoteSlotDecisions(roleDecisions) {
  const decisions = Object.values(roleDecisions)
  const positiveCount = decisions.filter((entry) =>
    entry.decision === 'accepted' || entry.decision === 'preferred'
  ).length
  const rejectedCount = decisions.filter((entry) => entry.decision === 'rejected').length
  const pendingCount = decisions.filter((entry) => !entry.decision || entry.decision === 'pending').length

  return {
    positiveCount,
    rejectedCount,
    pendingCount,
    respondedCount: decisions.length - pendingCount
  }
}

function buildAdminVoteDecision(tpi, votes = [], fixedSlotId = '') {
  const slotsById = new Map()

  const addSlot = (slot) => {
    const slotId = toIdString(slot)
    if (!slotId || slotsById.has(slotId)) {
      return
    }

    slotsById.set(slotId, makeVoteSlotEntry(slot, fixedSlotId))
  }

  if (Array.isArray(tpi?.proposedSlots)) {
    for (const proposedSlot of tpi.proposedSlots) {
      addSlot(proposedSlot?.slot)
    }
  }

  if (tpi?.confirmedSlot) {
    addSlot(tpi.confirmedSlot)
  }

  for (const vote of votes) {
    addSlot(vote.slot)
  }

  for (const vote of votes) {
    const slotId = toIdString(vote.slot)
    const role = vote.voterRole
    const slotEntry = slotsById.get(slotId)

    if (!slotEntry || !slotEntry.roleDecisions[role]) {
      continue
    }

    slotEntry.roleDecisions[role] = {
      role,
      decision: vote.decision || 'pending',
      voteId: toIdString(vote._id),
      voterName: formatVotePersonName(vote.voter),
      votedAt: vote.votedAt || null,
      comment: vote.comment || '',
      priority: Number.isFinite(Number(vote.priority)) ? Number(vote.priority) : null,
      availabilityException: Boolean(vote.availabilityException),
      specialRequestReason: vote.specialRequestReason || '',
      specialRequestDate: vote.specialRequestDate || null
    }
  }

  const slots = Array.from(slotsById.values()).map((slotEntry) => {
    const counts = countVoteSlotDecisions(slotEntry.roleDecisions)

    return {
      ...slotEntry,
      ...counts,
      hasConsensus: counts.positiveCount === 3,
      roleDecisions: VOTE_REQUIRED_ROLES.map((role) => slotEntry.roleDecisions[role])
    }
  })

  slots.sort((a, b) => {
    if (a.isFixed !== b.isFixed) {
      return a.isFixed ? -1 : 1
    }

    if (b.positiveCount !== a.positiveCount) {
      return b.positiveCount - a.positiveCount
    }

    return String(a.slot?.date || '').localeCompare(String(b.slot?.date || ''))
  })

  return {
    requiredRoles: VOTE_REQUIRED_ROLES,
    slots
  }
}

async function buildVoteProposalOptionsForTpi(tpi, groupedSlots = []) {
  const tpiId = String(tpi?._id || '')
  if (!tpiId) {
    return {
      options: [],
      context: {
        candidateClass: '',
        candidateClassLabel: '',
        classCode: '',
        isMatu: false,
        allowedDateKeys: [],
        allowedDateLabels: [],
        source: 'planning_slots'
      },
      settings: toPublicVoteSettings()
    }
  }

  let planningConfig = null
  let voteSettings = toPublicVoteSettings()
  let proposalContext = {
    candidateClass: String(tpi?.classe || '').trim(),
    candidateClassLabel: String(tpi?.classe || '').trim(),
    classCode: '',
    isMatu: false,
    allowedDateKeys: [],
    allowedDateLabels: [],
    source: 'planning_slots'
  }

  try {
    if (mongoose.connection?.readyState === 1) {
      planningConfig = await getPlanningConfig(tpi?.year)
      voteSettings = toPublicVoteSettings(planningConfig)
      proposalContext = buildVoteProposalContext(tpi, planningConfig)
    }
  } catch (error) {
    console.warn(`Impossible de charger la configuration de vote ${tpi?.year}:`, error?.message || error)
  }

  const fixedSlotId = getFixedSlotIdFromTpi(tpi)
  const optionsByWindowKey = new Map()
  const existingSlotIds = new Set()

  for (const groupedSlot of groupedSlots || []) {
    const slotId = groupedSlot?.slot?._id
      ? String(groupedSlot.slot._id)
      : groupedSlot?.slot
        ? String(groupedSlot.slot)
        : ''

    if (!slotId || slotId === fixedSlotId) {
      continue
    }

    existingSlotIds.add(slotId)
    addProposalOptionByWindow(optionsByWindowKey, {
      slotId,
      voteId: groupedSlot.voteId ? String(groupedSlot.voteId) : null,
      slot: groupedSlot.slot,
      source: 'existing_vote',
      queueKey: buildSlotQueueKey(groupedSlot.slot),
      score: null,
      reason: '',
      display: buildProposalOptionDisplay(groupedSlot.slot, planningConfig || {}, tpi)
    })
  }

  const availableSlots = await schedulingService.findAvailableSlotsForTpi(tpiId)
  const availableSlotIds = availableSlots
    .map(slotInfo => slotInfo.slot)
    .filter(Boolean)

  if (availableSlotIds.length > 0) {
    const slotDocuments = await Slot.find({ _id: { $in: availableSlotIds } })
      .select('date period startTime endTime room status')
      .lean()

    const filteredSlotDocuments = filterSlotDocumentsForVoteProposal(slotDocuments, proposalContext)

    const slotById = new Map(
      filteredSlotDocuments.map(slotDocument => [String(slotDocument._id), slotDocument])
    )

    for (const slotInfo of availableSlots) {
      const slotId = String(slotInfo.slot || '')
      if (!slotId || slotId === fixedSlotId) {
        continue
      }

      const slotDocument = slotById.get(slotId)
      if (!slotDocument) {
        continue
      }

      existingSlotIds.add(slotId)
      addProposalOptionByWindow(optionsByWindowKey, {
        slotId,
        voteId: null,
        slot: slotDocument,
        source: 'planning_option',
        queueKey: buildSlotQueueKey(slotDocument),
        score: Number.isFinite(Number(slotInfo.score)) ? Number(slotInfo.score) : null,
        reason: typeof slotInfo.reason === 'string' ? slotInfo.reason : '',
        display: buildProposalOptionDisplay(slotDocument, planningConfig || {}, tpi),
        availabilityStatus: 'available'
      })
    }
  }

  const shouldLoadConfiguredWindows =
    (Array.isArray(proposalContext.allowedDateKeys) && proposalContext.allowedDateKeys.length > 0) ||
    optionsByWindowKey.size === 0

  if (shouldLoadConfiguredWindows) {
    const dateRangeFilters = buildDateRangeFilters(proposalContext.allowedDateKeys)
    const configuredSlotQuery = {
      year: tpi.year,
      status: { $in: ['available', 'proposed', 'pending_votes'] }
    }

    if (dateRangeFilters.length > 0) {
      configuredSlotQuery.$or = dateRangeFilters
    }

    const configuredSlotDocuments = await Slot.find(configuredSlotQuery)
      .select('date period startTime endTime room status assignedTpi config')
      .sort({ date: 1, period: 1, 'room.name': 1 })
      .lean()

    const siteCompatibleSlotDocuments = configuredSlotDocuments
      .filter((slotDocument) => isSlotSiteCompatibleWithTpi(slotDocument, tpi))

    const configuredOptions = buildConfiguredSlotProposalOptions(siteCompatibleSlotDocuments, {
      fixedSlotId,
      existingSlotIds,
      planningConfig: planningConfig || {},
      proposalContext,
      tpi,
      source: 'planning_config_window'
    })

    for (const option of configuredOptions) {
      if (option.slotId && option.slotId !== fixedSlotId) {
        addProposalOptionByWindow(optionsByWindowKey, option)
      }
    }
  }

  const sortedOptions = Array.from(optionsByWindowKey.values())
    .sort((left, right) => {
      const leftKey = left.queueKey || buildSlotQueueKey(left.slot)
      const rightKey = right.queueKey || buildSlotQueueKey(right.slot)

      if (leftKey !== rightKey) {
        return leftKey.localeCompare(rightKey)
      }

      return buildSlotSortKey(left.slot).localeCompare(buildSlotSortKey(right.slot))
    })

  return {
    options: await attachVoteQueueCountsToProposalOptions(sortedOptions, tpi),
    context: proposalContext,
    settings: voteSettings
  }
}

// ============================================
// ROUTES AUTHENTIFICATION (Magic Link)
// ============================================

/**
 * POST /api/planning/auth/magic-link
 * Génère et envoie un magic link par email
 */
router.post('/auth/magic-link', async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string'
      ? req.body.email.trim()
      : ''
    
    if (email.length === 0) {
      return res.status(400).json({ error: 'Email requis' })
    }
    
    const baseUrl = `${req.protocol}://${req.get('host')}/api/planning`
    const magicLink = await magicLinkService.generateMagicLink(email, baseUrl)
    
    // Envoyer l'email
    const emailSettings = await getSharedEmailSettingsIfAvailable()
    await emailService.sendEmail(email, 'voteRequest', {
      recipientName: magicLink.personName,
      magicLinkUrl: magicLink.url,
      // Les autres champs seront vides pour un simple login
      candidateName: 'N/A',
      tpiReference: 'Connexion',
      role: 'Utilisateur',
      slots: [],
      deadline: magicLink.expiresAt.toLocaleDateString('fr-CH')
    }, { emailSettings })
    
    res.json({ 
      success: true, 
      message: 'Un lien de connexion a été envoyé à votre adresse email' 
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

/**
 * GET /api/planning/auth/verify
 * Vérifie un magic link et retourne un token de session
 */
router.get('/auth/verify', async (req, res) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : ''
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : ''
    
    if (token.length === 0 || email.length === 0) {
      return res.status(400).json({ error: 'Token et email requis' })
    }
    
    const result = await magicLinkService.verifyMagicLink(token, email)
    const sessionToken = magicLinkService.generateSessionToken(result.person)
    
    res.json({
      success: true,
      token: sessionToken,
      user: result.person
    })
  } catch (error) {
    res.status(401).json({ error: error.message })
  }
})

// ============================================
// ROUTES PERSONNES
// ============================================

/**
 * GET /api/planning/persons
 * Liste toutes les personnes (filtrable par rôle)
 */
router.get('/persons', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    await backfillMissingPersonShortIds()

    const { role, site, search, sendEmails } = req.query

    const filter = { isActive: true }

    if (role) {
      filter.roles = role
    }

    if (site) {
      filter.site = site
    }

    if (sendEmails !== undefined) {
      filter.sendEmails = sendEmails === 'true'
    }

    if (search) {
      const parsedShortId = parseShortIdSearch(search)
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]

      if (Number.isInteger(parsedShortId)) {
        filter.$or.push({ shortId: parsedShortId })
      }
    }

    const persons = await Person.find(filter)
      .select('-magicLinkToken -magicLinkExpires')
      .sort({ lastName: 1, firstName: 1 })

    res.json(persons)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/persons
 * Crée une nouvelle personne
 */
router.post('/persons', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const result = await personRegistryService.createOrMergePerson(req.body)
    const statusCode = result.created ? 201 : 200

    res.status(statusCode).json(result)
  } catch (error) {
    if (error instanceof personRegistryService.PersonRegistryError) {
      return res.status(error.statusCode || 400).json({ error: error.message })
    }

    if (error?.code === 11000) {
      return res.status(409).json({
        error: 'Une personne avec cet email existe déjà.'
      })
    }

    res.status(400).json({ error: error.message })
  }
})

/**
 * POST /api/planning/persons/import
 * Importe un lot de parties prenantes depuis un texte CSV/TSV
 */
router.post('/persons/import', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : ''

    if (!content) {
      return res.status(400).json({ error: 'Contenu CSV requis' })
    }

    const defaultSite = typeof req.body?.defaultSite === 'string'
      ? req.body.defaultSite.trim()
      : ''
    const defaultRoles = Array.isArray(req.body?.defaultRoles)
      ? req.body.defaultRoles
      : typeof req.body?.defaultRole === 'string'
        ? [req.body.defaultRole]
        : []

    const results = await personImportService.importPeopleFromContent(content, {
      defaultSite,
      defaultRoles: defaultRoles.length > 0 ? defaultRoles : ['expert']
    })

    res.json({
      success: true,
      ...results
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

/**
 * PUT /api/planning/persons/:id
 * Met à jour une personne
 */
router.put('/persons/:id', authMiddleware, requireRole('admin'), requireObjectIdParam('id', 'Identifiant personne'), async (req, res) => {
  try {
    const allowedFields = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'roles',
      'site',
      'entreprise',
      'defaultAvailability',
      'unavailableDates',
      'isActive',
      'sendEmails',
      'candidateYears',
      'preferredSoutenanceDates',
      'preferredSoutenanceChoices'
    ]
    const normalizedUpdate = {}

    for (const field of allowedFields) {
      if (req.body?.[field] !== undefined) {
        normalizedUpdate[field] = req.body[field]
      }
    }

    const person = await personRegistryService.updatePerson(req.params.id, normalizedUpdate)

    if (!person) {
      return res.status(404).json({ error: 'Personne non trouvée' })
    }

    res.json(person)
  } catch (error) {
    if (error instanceof personRegistryService.PersonRegistryError) {
      return res.status(error.statusCode || 400).json({ error: error.message })
    }

    if (error?.code === 11000) {
      return res.status(409).json({
        error: 'Une personne avec cet email existe déjà.'
      })
    }

    res.status(400).json({ error: error.message })
  }
})

/**
 * POST /api/planning/persons/merge
 * Fusionne plusieurs fiches en conservant une fiche cible
 */
router.post('/persons/merge', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const targetPersonId = typeof req.body?.targetPersonId === 'string'
      ? req.body.targetPersonId.trim()
      : ''
    const sourcePersonIds = Array.isArray(req.body?.sourcePersonIds)
      ? req.body.sourcePersonIds
      : []
    const allowDifferentIdentity = req.body?.allowDifferentIdentity === true

    if (!targetPersonId) {
      return res.status(400).json({ error: 'targetPersonId requis' })
    }

    if (sourcePersonIds.length === 0) {
      return res.status(400).json({ error: 'sourcePersonIds requis' })
    }

    const result = await personRegistryService.mergePeopleIntoTarget(targetPersonId, sourcePersonIds, {
      allowDifferentIdentity
    })

    res.json({
      success: true,
      ...result
    })
  } catch (error) {
    if (error instanceof personRegistryService.PersonRegistryError) {
      return res.status(error.statusCode || 400).json({ error: error.message, details: error.details || {} })
    }

    res.status(400).json({ error: error.message })
  }
})

/**
 * DELETE /api/planning/persons/:id
 * Désactive une personne
 */
router.delete('/persons/:id', authMiddleware, requireRole('admin'), requireObjectIdParam('id', 'Identifiant personne'), async (req, res) => {
  try {
    const person = await Person.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    )

    if (!person) {
      return res.status(404).json({ error: 'Personne non trouvée' })
    }

    res.json({ success: true, person })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

/**
 * POST /api/planning/persons/purge
 * Supprime tout le référentiel des parties prenantes
 */
router.post('/persons/purge', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    if (req.body?.confirm !== true) {
      return res.status(400).json({ error: 'Confirmation requise' })
    }

    const result = await personImportService.purgeAllPeople()

    res.json({
      success: true,
      ...result
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

/**
 * PUT /api/planning/persons/:id/availability
 * Met à jour les disponibilités d'une personne
 */
router.put('/persons/:id/availability', authMiddleware, requireRole('admin'), requireObjectIdParam('id', 'Identifiant personne'), async (req, res) => {
  try {
    const { defaultAvailability, unavailableDates } = req.body

    if (
      defaultAvailability === undefined &&
      unavailableDates === undefined
    ) {
      return res.status(400).json({
        error: 'defaultAvailability ou unavailableDates requis'
      })
    }

    if (
      defaultAvailability !== undefined &&
      !Array.isArray(defaultAvailability)
    ) {
      return res
        .status(400)
        .json({ error: 'defaultAvailability doit être un tableau' })
    }

    if (
      unavailableDates !== undefined &&
      !Array.isArray(unavailableDates)
    ) {
      return res
        .status(400)
        .json({ error: 'unavailableDates doit être un tableau' })
    }
    
    const person = await Person.findByIdAndUpdate(
      req.params.id,
      { defaultAvailability, unavailableDates },
      { new: true }
    )
    
    if (!person) {
      return res.status(404).json({ error: 'Personne non trouvée' })
    }
    
    res.json(person)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// ============================================
// ROUTES CRÉNEAUX (SLOTS)
// ============================================

/**
 * POST /api/planning/slots/generate
 * Génère les créneaux pour une période
 */
router.post('/slots/generate', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { year, dates, siteConfig } = req.body

    const parsedYear = toInteger(year)
    
    if (!parsedYear || !Array.isArray(dates) || dates.length === 0 || !isPlainObject(siteConfig)) {
      return res.status(400).json({ error: 'year, dates et siteConfig requis' })
    }

    if (typeof siteConfig.site !== 'string' || siteConfig.site.trim().length === 0) {
      return res.status(400).json({ error: 'siteConfig.site requis' })
    }

    if (!Array.isArray(siteConfig.rooms) || siteConfig.rooms.length === 0) {
      return res.status(400).json({ error: 'siteConfig.rooms doit être un tableau non vide' })
    }
    
    const slots = await schedulingService.generateSlotsForPeriod(parsedYear, dates, siteConfig)
    
    res.json({ 
      success: true, 
      message: `${slots.length} créneaux générés`,
      count: slots.length
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/planning/slots/:year
 * Liste tous les créneaux d'une année
 */
router.get('/slots/:year', authMiddleware, requireYearParam('year'), async (req, res) => {
  try {
    const year = req.validatedParams.year
    const { status, date, site } = req.query

     if (getVoteMagicLinkContext(req)) {
      return rejectVoteScope(res, 'Liste complete des creneaux indisponible avec un lien de vote.')
    }
    
    const filter = { year }
    
    if (status) {
      filter.status = status
    }
    
    if (date) {
      const parsedDate = new Date(date)
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Date invalide.' })
      }
      filter.date = parsedDate
    }
    
    if (site) {
      filter['room.site'] = site
    }
    
    const slots = await Slot.find(filter)
      .populate('assignedTpi', 'reference candidat')
      .sort({ date: 1, period: 1, 'room.name': 1 })
    
    res.json(slots)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/planning/slots/:year/calendar
 * Retourne les créneaux formatés pour un calendrier
 */
router.get('/slots/:year/calendar', authMiddleware, requireYearParam('year'), async (req, res) => {
  try {
    const year = req.validatedParams.year
    const scopedTpiFilter = buildScopedVoteTpiFilter(req, year)

    if (!scopedTpiFilter) {
      return rejectVoteScope(res, 'Annee indisponible pour ce lien de vote.')
    }

    const scopedTpiIds = getVoteMagicLinkContext(req)
      ? await TpiPlanning.find(scopedTpiFilter).distinct('_id')
      : null

    const slotFilter = { year }
    if (Array.isArray(scopedTpiIds)) {
      if (scopedTpiIds.length === 0) {
        return res.json([])
      }
      slotFilter.assignedTpi = { $in: scopedTpiIds }
    }

    const slots = await Slot.find(slotFilter)
      .populate({
        path: 'assignedTpi',
        populate: [
          { path: 'candidat', select: 'firstName lastName' },
          { path: 'expert1', select: 'firstName lastName' },
          { path: 'expert2', select: 'firstName lastName' },
          { path: 'chefProjet', select: 'firstName lastName' }
        ]
      })
    
    // Grouper par date
    const calendar = {}
    
    for (const slot of slots) {
      const dateKey = slot.date.toISOString().split('T')[0]
      
      if (!calendar[dateKey]) {
        calendar[dateKey] = {
          date: dateKey,
          rooms: {}
        }
      }
      
      if (!calendar[dateKey].rooms[slot.room.name]) {
        calendar[dateKey].rooms[slot.room.name] = []
      }
      
      calendar[dateKey].rooms[slot.room.name].push({
        id: slot._id,
        period: slot.period,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: slot.status,
        tpi: slot.assignedTpi ? {
          reference: slot.assignedTpi.reference,
          candidat: slot.assignedTpi.candidat?.firstName + ' ' + slot.assignedTpi.candidat?.lastName
        } : null
      })
    }
    
    res.json(Object.values(calendar))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// ROUTES TPI PLANNING
// ============================================

/**
 * GET /api/planning/tpi/:year
 * Liste tous les TPI d'une année
 */
router.get('/tpi/:year', authMiddleware, requireYearParam('year'), async (req, res) => {
  try {
    const year = req.validatedParams.year
    const { status } = req.query
    const filter = buildScopedVoteTpiFilter(req, year)

    if (!filter) {
      return rejectVoteScope(res, 'Annee indisponible pour ce lien de vote.')
    }
    
    if (status) {
      filter.status = status
    }
    
    const [planningConfig, rawTpis] = await Promise.all([
      getPlanningConfig(year),
      TpiPlanning.find(filter)
        .populate('candidat expert1 expert2 chefProjet', 'firstName lastName email')
        .populate('proposedSlots.slot', 'date period startTime endTime room status')
        .populate('confirmedSlot', 'date period startTime room')
        .sort({ reference: 1 })
    ])

    const tpis = filterPlanifiableTpis(rawTpis, planningConfig)
      .map(toPlanningTpiResponseObject)

    if (tpis.length > 0) {
      const tpiIds = tpis.map(tpi => tpi._id)
      const voteStats = await Vote.aggregate([
        { $match: { tpiPlanning: { $in: tpiIds } } },
        {
          $group: {
            _id: '$tpiPlanning',
            totalVotes: { $sum: 1 },
            pendingVotes: {
              $sum: {
                $cond: [{ $eq: ['$decision', 'pending'] }, 1, 0]
              }
            },
            acceptedVotes: {
              $sum: {
                $cond: [{ $eq: ['$decision', 'accepted'] }, 1, 0]
              }
            },
            preferredVotes: {
              $sum: {
                $cond: [{ $eq: ['$decision', 'preferred'] }, 1, 0]
              }
            },
            rejectedVotes: {
              $sum: {
                $cond: [{ $eq: ['$decision', 'rejected'] }, 1, 0]
              }
            },
            respondedVotes: {
              $sum: {
                $cond: [{ $ne: ['$decision', 'pending'] }, 1, 0]
              }
            }
          }
        }
      ])

      const votesByRole = await Vote.find({
        tpiPlanning: { $in: tpiIds }
      })
        .populate('slot', 'date period startTime endTime room')
        .populate('voter', 'firstName lastName email')
        .select('tpiPlanning slot voter voterRole decision votedAt comment priority availabilityException specialRequestReason specialRequestDate')
        .sort({ createdAt: 1 })

      const statsByTpiId = new Map(
        voteStats.map(stat => [String(stat._id), stat])
      )
      const votesByTpiId = new Map()
      for (const vote of votesByRole) {
        const tpiId = String(vote.tpiPlanning)
        if (!votesByTpiId.has(tpiId)) {
          votesByTpiId.set(tpiId, [])
        }

        votesByTpiId.get(tpiId).push(vote)
      }

      const makeDefaultRoleStatus = () => ({
        decision: 'pending',
        votedAt: null,
        comment: '',
        availabilityException: false,
        specialRequestReason: '',
        specialRequestDate: null,
        alternativeCount: 0,
        rejectedAlternativeCount: 0,
        acceptedAlternativeCount: 0,
        responseMode: 'pending'
      })

      const voteRoleStatusByTpi = new Map(
        tpiIds.map((tpiId) => [
          String(tpiId),
          {
            expert1: makeDefaultRoleStatus(),
            expert2: makeDefaultRoleStatus(),
            chef_projet: makeDefaultRoleStatus()
          }
        ])
      )

      const fixedSlotIdsByTpiId = new Map(
        tpis.map((tpi) => {
          const fixedSlot = Array.isArray(tpi.proposedSlots)
            ? tpi.proposedSlots.find((proposedSlot) => proposedSlot?.slot)
            : null

          return [
            String(tpi._id),
            fixedSlot?.slot?._id ? String(fixedSlot.slot._id) : null
          ]
        })
      )

      for (const vote of votesByRole) {
        const tpiId = String(vote.tpiPlanning)
        const role = vote.voterRole
        const tpiRoleStatus = voteRoleStatusByTpi.get(tpiId)

        if (!tpiRoleStatus || !tpiRoleStatus[role]) {
          continue
        }

        const fixedSlotId = fixedSlotIdsByTpiId.get(tpiId)
        const currentStatus = tpiRoleStatus[role]
        const voteSlotId = vote.slot?._id ? String(vote.slot._id) : String(vote.slot || '')
        const decision = vote.decision || 'pending'

        if (fixedSlotId && voteSlotId === fixedSlotId) {
          currentStatus.decision = decision
          currentStatus.votedAt = vote.votedAt || null
          currentStatus.comment = vote.comment || ''
          currentStatus.availabilityException = Boolean(vote.availabilityException)
          currentStatus.specialRequestReason = vote.specialRequestReason || ''
          currentStatus.specialRequestDate = vote.specialRequestDate || null
          currentStatus.fixedVoteId = String(vote._id)
          continue
        }

        if (decision === 'preferred') {
          currentStatus.alternativeCount += 1
        } else if (decision === 'rejected') {
          currentStatus.rejectedAlternativeCount += 1
        } else if (decision === 'accepted') {
          currentStatus.acceptedAlternativeCount += 1
        }
      }

      for (const tpi of tpis) {
        const roleStatus = voteRoleStatusByTpi.get(String(tpi._id)) || {
          expert1: makeDefaultRoleStatus(),
          expert2: makeDefaultRoleStatus(),
          chef_projet: makeDefaultRoleStatus()
        }

        for (const currentStatus of Object.values(roleStatus)) {
          currentStatus.responseMode = buildVoteResponseMode(currentStatus)
        }

        tpi.votingSession = tpi.votingSession || {}
        tpi.votingSession.voteSummary = {
          ...(tpi.votingSession.voteSummary || {}),
          expert1Voted: buildVoteResponseMode(roleStatus.expert1) !== 'pending',
          expert2Voted: buildVoteResponseMode(roleStatus.expert2) !== 'pending',
          chefProjetVoted: buildVoteResponseMode(roleStatus.chef_projet) !== 'pending'
        }

        tpi.voteStats = statsByTpiId.get(String(tpi._id)) || {
          totalVotes: 0,
          pendingVotes: 0,
          acceptedVotes: 0,
          preferredVotes: 0,
          rejectedVotes: 0,
          respondedVotes: 0
        }

        tpi.voteRoleStatus = roleStatus
        tpi.voteDecision = buildAdminVoteDecision(
          tpi,
          votesByTpiId.get(String(tpi._id)) || [],
          fixedSlotIdsByTpiId.get(String(tpi._id))
        )
      }
    }
    
    res.json(tpis)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/planning/tpi/:year/:id
 * Détails d'un TPI
 */
router.get('/tpi/:year/:id', authMiddleware, requireYearParam('year'), requireObjectIdParam('id', 'Identifiant TPI'), async (req, res) => {
  try {
    const year = req.validatedParams.year
    const tpi = await TpiPlanning.findById(req.params.id)
      .populate('candidat expert1 expert2 chefProjet')
      .populate('proposedSlots.slot')
      .populate('confirmedSlot')
    
    if (!tpi) {
      return res.status(404).json({ error: 'TPI non trouvé' })
    }

    if (!isVoteScopeCompatibleWithTpi(req, tpi, year)) {
      return rejectVoteScope(res, 'TPI hors scope du lien de vote.')
    }
    
    // Récupérer les votes associés
    const votes = await Vote.find({ tpiPlanning: tpi._id })
      .populate('slot', 'date period startTime room')
      .populate('voter', 'firstName lastName')
    
    res.json({ tpi, votes })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/tpi
 * Crée un nouveau TPI
 */
router.post('/tpi', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { year, candidat, expert1, expert2, chefProjet, sujet, description, entreprise, classe, site, dates } = req.body
    const createdBy = toObjectIdOrNull(req.user?.id)
    
    // Générer la référence
    const reference = await TpiPlanning.generateReference(year)
    
    const tpi = new TpiPlanning({
      reference,
      year,
      candidat,
      expert1,
      expert2,
      chefProjet,
      sujet,
      description,
      entreprise,
      classe,
      site,
      dates,
      status: 'draft',
      createdBy
    })
    
    await tpi.save()
    await tpi.addHistory('created', createdBy, {
      createdByUsername: req.user?.id || null
    })
    
    res.status(201).json(tpi)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

/**
 * POST /api/planning/tpi/:id/propose-slots
 * Lance la proposition de créneaux et le processus de vote
 */
router.post('/tpi/:id/propose-slots', authMiddleware, requireObjectIdParam('id', 'Identifiant TPI'), requireRole('admin'), async (req, res) => {
  try {
    const maxSlots = req.body?.maxSlots === undefined ? 4 : toInteger(req.body.maxSlots)

    if (!maxSlots || maxSlots < 1 || maxSlots > 4) {
      return res.status(400).json({ error: 'maxSlots doit être un entier entre 1 et 4' })
    }
    
    const result = await schedulingService.proposeSlotsAndInitiateVoting(
      req.params.id,
      maxSlots
    )
    
    if (result.success && result.proposedSlots.length > 0) {
      // Envoyer les emails de demande de vote
      const tpi = await TpiPlanning.findById(req.params.id)
        .populate('candidat expert1 expert2 chefProjet')
        .populate('proposedSlots.slot')
      
      const baseUrl = `${req.protocol}://${req.get('host')}/api/planning`
      const accessLinkSettings = await getAccessLinkSettingsForYear(tpi.year)
      
      // Générer les magic links pour chaque votant
      const voters = [
        { person: tpi.expert1, role: 'expert1' },
        { person: tpi.expert2, role: 'expert2' },
        { person: tpi.chefProjet, role: 'chef_projet' }
      ]
      
      const magicLinks = []
      
      for (const voter of voters) {
        const link = await magicLinkService.generateMagicLink(voter.person.email, baseUrl, {
          expiresInHours: accessLinkSettings.voteLinkValidityHours
        })
        magicLinks.push({
          ...link,
          email: voter.person.email,
          role: voter.role,
          slots: tpi.proposedSlots.map(ps => ({
            date: ps.slot.date.toLocaleDateString('fr-CH'),
            period: ps.slot.period,
            startTime: ps.slot.startTime,
            endTime: ps.slot.endTime,
            room: ps.slot.room.name
          }))
        })
      }
      
      const emailSettings = await getSharedEmailSettingsIfAvailable()
      await emailService.sendVoteRequests(tpi, magicLinks, {
        emailSettings,
        expiresInHours: accessLinkSettings.voteLinkValidityHours
      })
    }
    
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/tpi/:id/force-slot
 * Force manuellement un créneau (intervention admin)
 */
router.post('/tpi/:id/force-slot', authMiddleware, requireObjectIdParam('id', 'Identifiant TPI'), requireRole('admin'), async (req, res) => {
  try {
    const { slotId, reason } = req.body
    
    if (!slotId || !reason) {
      return res.status(400).json({ error: 'slotId et reason requis' })
    }

    if (!isValidObjectId(slotId)) {
      return res.status(400).json({ error: 'slotId invalide' })
    }

    if (typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'reason doit être une chaîne non vide' })
    }
    
    const result = await schedulingService.forceSlotManually(
      req.params.id,
      slotId,
      toObjectIdOrNull(req.user?.id),
      reason
    )
    
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/tpi/:id/move-to-slot/:slotId/simulate
 * Simule un déplacement demandé depuis le suivi des votes.
 */
router.post('/tpi/:id/move-to-slot/:slotId/simulate', authMiddleware, requireObjectIdParam('id', 'Identifiant TPI'), requireObjectIdParam('slotId', 'Identifiant créneau'), requireRole('admin'), async (req, res) => {
  try {
    const result = await schedulingService.simulateTpiMoveToSlot(req.params.id, req.params.slotId)
    return res.json(result)
  } catch (error) {
    if (String(error?.message || '').includes('non trouvé')) {
      return res.status(404).json({ error: error.message })
    }

    return res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/tpi/:id/move-to-slot/:slotId
 * Déplace et confirme un TPI vers un créneau proposé si la simulation est sans conflit.
 */
router.post('/tpi/:id/move-to-slot/:slotId', authMiddleware, requireObjectIdParam('id', 'Identifiant TPI'), requireObjectIdParam('slotId', 'Identifiant créneau'), requireRole('admin'), async (req, res) => {
  try {
    const reason = typeof req.body?.reason === 'string'
      ? req.body.reason.trim()
      : ''
    const result = await schedulingService.moveTpiToSlot(
      req.params.id,
      req.params.slotId,
      toObjectIdOrNull(req.user?.id),
      reason
    )

    return res.status(result?.success === false ? 409 : 200).json(result)
  } catch (error) {
    if (String(error?.message || '').includes('non trouvé')) {
      return res.status(404).json({ error: error.message })
    }

    return res.status(500).json({ error: error.message })
  }
})

// ============================================
// ROUTES VOTES
// ============================================

/**
 * GET /api/planning/votes/pending
 * Liste les votes en attente pour l'utilisateur connecté
 */
router.get('/votes/pending', authMiddleware, async (req, res) => {
  try {
    const voterObjectId = resolveVoteParticipantId(req)

    if (!voterObjectId) {
      return res.json([])
    }

    const voteFilter = {
      voter: voterObjectId,
      decision: 'pending'
    }

    const context = getVoteMagicLinkContext(req)
    if (context) {
      const scopedTpiIds = await TpiPlanning.find(
        buildScopedVoteTpiFilter(req, context.year)
      ).distinct('_id')

      if (scopedTpiIds.length === 0) {
        return res.json([])
      }

      voteFilter.tpiPlanning = { $in: scopedTpiIds }
    }

    const votes = await Vote.find(voteFilter)
      .populate({
        path: 'tpiPlanning',
        populate: [
          { path: 'candidat', select: 'firstName lastName' },
          { path: 'proposedSlots.slot', select: 'date period startTime endTime room status' }
        ]
      })
      .populate('slot', 'date period startTime endTime room')
    
    // Grouper par TPI
    const votesByTpi = {}
    
    for (const vote of votes) {
      const tpiId = vote.tpiPlanning._id.toString()
      
      if (!votesByTpi[tpiId]) {
        votesByTpi[tpiId] = {
          tpi: vote.tpiPlanning,
          slots: []
        }
      }
      
      votesByTpi[tpiId].slots.push({
        voteId: vote._id,
        slot: vote.slot,
        voterRole: vote.voterRole
      })
    }

    const groupedVotes = Object.values(votesByTpi)

    for (const group of groupedVotes) {
      const orderedSlotIds = Array.isArray(group.tpi?.proposedSlots)
        ? group.tpi.proposedSlots
          .map((proposedSlot) => proposedSlot?.slot?._id ? String(proposedSlot.slot._id) : null)
          .filter(Boolean)
        : []
      const slotOrder = new Map(orderedSlotIds.map((slotId, index) => [slotId, index]))

      group.slots.sort((a, b) => {
        const slotIdA = a.slot?._id ? String(a.slot._id) : ''
        const slotIdB = b.slot?._id ? String(b.slot._id) : ''
        const orderA = slotOrder.has(slotIdA) ? slotOrder.get(slotIdA) : Number.MAX_SAFE_INTEGER
        const orderB = slotOrder.has(slotIdB) ? slotOrder.get(slotIdB) : Number.MAX_SAFE_INTEGER

        if (orderA !== orderB) {
          return orderA - orderB
        }

        const dateA = new Date(a.slot?.date || 0).getTime()
        const dateB = new Date(b.slot?.date || 0).getTime()
        if (dateA !== dateB) {
          return dateA - dateB
        }

        const periodA = String(a.slot?.period || '')
        const periodB = String(b.slot?.period || '')
        if (periodA !== periodB) {
          return periodA.localeCompare(periodB)
        }

        return String(a.slot?.room?.name || '').localeCompare(String(b.slot?.room?.name || ''))
      })

      group.fixedSlot = group.slots[0] || null
      group.fixedVoteId = group.fixedSlot?.voteId ? String(group.fixedSlot.voteId) : null
    }

    await Promise.all(
      groupedVotes.map(async (group) => {
        const proposalData = await buildVoteProposalOptionsForTpi(group.tpi, group.slots)
        group.proposalOptions = proposalData.options
        group.proposalContext = proposalData.context
        group.voteSettings = proposalData.settings
      })
    )
    
    res.json(groupedVotes)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/votes/respond/:tpiId
 * Répond au vote d'un TPI avec le nouveau flux OK ou Proposition
 */
router.post('/votes/respond/:tpiId', authMiddleware, requireObjectIdParam('tpiId', 'Identifiant TPI'), async (req, res) => {
  try {
    const voterObjectId = resolveVoteParticipantId(req)

    if (!voterObjectId) {
      return res.status(403).json({ error: 'Non autorisé à voter' })
    }

    const mode = typeof req.body?.mode === 'string'
      ? req.body.mode.trim().toLowerCase()
      : ''
    const fixedVoteId = typeof req.body?.fixedVoteId === 'string'
      ? req.body.fixedVoteId.trim()
      : ''
    const proposedSlotIds = Array.isArray(req.body?.proposedSlotIds)
      ? [...new Set(
          req.body.proposedSlotIds
            .filter(value => typeof value === 'string')
            .map(value => value.trim())
            .filter(Boolean)
        )]
      : []
    const specialRequest = isPlainObject(req.body?.specialRequest)
      ? req.body.specialRequest
      : null
    const specialRequestReason = typeof specialRequest?.reason === 'string'
      ? specialRequest.reason.trim()
      : ''
    const specialRequestDate = toDateOrNull(specialRequest?.requestedDate)
    const hasSpecialRequest = Boolean(specialRequestReason || specialRequest?.requestedDate)

    if (!ALLOWED_VOTE_RESPONSE_MODES.has(mode)) {
      return res.status(400).json({ error: 'mode invalide (ok, proposal)' })
    }

    if (!isValidObjectId(fixedVoteId)) {
      return res.status(400).json({ error: 'fixedVoteId invalide' })
    }

    if (proposedSlotIds.some(slotId => !isValidObjectId(slotId))) {
      return res.status(400).json({ error: 'proposedSlotIds contient un identifiant invalide.' })
    }

    if (mode === 'ok' && proposedSlotIds.length > 0) {
      return res.status(400).json({ error: 'Le mode OK ne permet pas de proposer d autres créneaux.' })
    }

    if (mode === 'ok' && hasSpecialRequest) {
      return res.status(400).json({ error: 'La demande spéciale est réservée au mode Proposition.' })
    }

    if (hasSpecialRequest && (!specialRequestReason || !specialRequestDate)) {
      return res.status(400).json({
        error: 'La demande spéciale exige une raison libre et une date demandée.'
      })
    }

    if (mode === 'proposal' && proposedSlotIds.length === 0 && !hasSpecialRequest) {
      return res.status(400).json({
        error: 'Choisissez au moins un créneau ou saisissez une demande spéciale.'
      })
    }

    const tpi = await TpiPlanning.findById(req.params.tpiId)
      .populate('proposedSlots.slot', 'date period startTime endTime room status')

    if (!tpi) {
      return res.status(404).json({ error: 'TPI non trouvé' })
    }

    if (!isVoteScopeCompatibleWithTpi(req, tpi, tpi.year)) {
      return rejectVoteScope(res, 'TPI hors scope du lien de vote.')
    }

    const voteSettings = await getVoteSettingsForYear(tpi.year)
    const maxVoteProposals = voteSettings.maxProposalsPerTpi

    if (proposedSlotIds.length > maxVoteProposals) {
      return res.status(400).json({
        error: buildMaxVoteProposalsMessage(maxVoteProposals, 'par réponse')
      })
    }

    if (hasSpecialRequest && voteSettings.allowSpecialRequest === false) {
      return res.status(400).json({ error: 'La demande spéciale est désactivée pour cette année.' })
    }

    const existingVotes = await Vote.find({
      tpiPlanning: tpi._id,
      voter: voterObjectId
    })
      .select('tpiPlanning slot voter voterRole decision comment availabilityException specialRequestReason specialRequestDate priority')
      .sort({ createdAt: 1 })

    if (existingVotes.length === 0) {
      return res.status(404).json({ error: 'Aucun vote disponible pour ce TPI.' })
    }

    const existingVotesById = new Map(
      existingVotes.map(vote => [String(vote._id), vote])
    )
    const existingVotesBySlotId = new Map(
      existingVotes.map(vote => [String(vote.slot), vote])
    )

    const fixedVote = existingVotesById.get(fixedVoteId)
    if (!fixedVote) {
      return res.status(400).json({ error: 'fixedVoteId ne correspond pas à ce TPI.' })
    }

    const fixedSlotId = getFixedSlotIdFromTpi(tpi)
    if (fixedSlotId && String(fixedVote.slot) !== fixedSlotId) {
      return res.status(400).json({ error: 'fixedVoteId doit pointer vers la date fixée du TPI.' })
    }

    const allowedProposalSlotIds = new Set(
      existingVotes
        .map(vote => String(vote.slot))
        .filter(slotId => slotId !== fixedSlotId)
    )

    const needsAdditionalProposalOptions = proposedSlotIds.some(slotId => !allowedProposalSlotIds.has(slotId))
    if (needsAdditionalProposalOptions) {
      const additionalProposalData = await buildVoteProposalOptionsForTpi(tpi, [])
      for (const option of additionalProposalData.options) {
        if (option?.slotId && option.slotId !== fixedSlotId) {
          allowedProposalSlotIds.add(option.slotId)
        }
      }
    }

    for (const slotId of proposedSlotIds) {
      if (!allowedProposalSlotIds.has(slotId)) {
        return res.status(400).json({
          error: 'Un créneau proposé ne fait plus partie des options autorisées pour ce vote.'
        })
      }
    }

    const proposalSelectionSet = new Set(proposedSlotIds)
    const fixedDecision = mode === 'ok' ? 'accepted' : 'rejected'
    const fixedComment = mode === 'proposal'
      ? (hasSpecialRequest ? specialRequestReason : 'Proposition de créneaux alternatifs')
      : ''
    const voterRole = fixedVote.voterRole
    const sharedSpecialReason = hasSpecialRequest ? specialRequestReason : ''
    const sharedSpecialDate = hasSpecialRequest ? specialRequestDate : null

    for (const vote of existingVotes) {
      const slotId = String(vote.slot)
      const isFixedSlot = slotId === fixedSlotId
      const isSelectedProposal = proposalSelectionSet.has(slotId)

      vote.decision = isFixedSlot
        ? fixedDecision
        : isSelectedProposal
          ? 'preferred'
          : 'rejected'
      vote.comment = isFixedSlot ? fixedComment : ''
      vote.availabilityException = hasSpecialRequest
      vote.specialRequestReason = sharedSpecialReason
      vote.specialRequestDate = sharedSpecialDate
      vote.priority = isSelectedProposal
        ? proposedSlotIds.indexOf(slotId) + 1
        : undefined
      vote.votedAt = new Date()
      vote.magicLinkUsed = req.headers.authorization
      await vote.save()
    }

    for (const slotId of proposedSlotIds) {
      if (existingVotesBySlotId.has(slotId)) {
        continue
      }

      const createdVote = new Vote({
        tpiPlanning: tpi._id,
        slot: slotId,
        voter: voterObjectId,
        voterRole,
        decision: 'preferred',
        comment: '',
        availabilityException: hasSpecialRequest,
        specialRequestReason: sharedSpecialReason,
        specialRequestDate: sharedSpecialDate,
        priority: proposedSlotIds.indexOf(slotId) + 1,
        votedAt: new Date(),
        magicLinkUsed: req.headers.authorization
      })

      await createdVote.save()
    }

    const validationResult = await schedulingService.registerVoteAndCheckValidation(
      fixedVote._id,
      fixedDecision,
      fixedComment
    )

    return res.json({
      success: true,
      mode,
      proposedCount: proposedSlotIds.length,
      hasSpecialRequest,
      validation: validationResult
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/votes/bulk
 * Soumet plusieurs votes en une fois (pour un TPI)
 */
router.post('/votes/bulk', authMiddleware, async (req, res) => {
  try {
    const { votes } = req.body // [{ voteId, decision, comment, priority, availabilityException }]
    const context = getVoteMagicLinkContext(req)
    const voterObjectId = resolveVoteParticipantId(req)
    
    if (!Array.isArray(votes) || votes.length === 0) {
      return res.status(400).json({ error: 'votes doit être un tableau non vide' })
    }

    if (!voterObjectId) {
      return res.status(403).json({ error: 'Non autorisé à voter' })
    }

    for (const voteData of votes) {
      if (!isPlainObject(voteData)) {
        return res.status(400).json({ error: 'Chaque vote doit être un objet' })
      }

      if (!isValidObjectId(voteData.voteId)) {
        return res.status(400).json({ error: 'voteId invalide dans la liste des votes' })
      }

      if (!ALLOWED_VOTE_DECISIONS.has(voteData.decision)) {
        return res.status(400).json({
          error: 'decision invalide dans la liste des votes (accepted, rejected, preferred)'
        })
      }

      if (voteData.priority !== undefined) {
        const parsedPriority = toInteger(voteData.priority)
        if (!parsedPriority || parsedPriority < 1) {
          return res.status(400).json({ error: 'priority invalide dans la liste des votes' })
        }
      }

      if (voteData.availabilityException !== undefined && typeof voteData.availabilityException !== 'boolean') {
        return res.status(400).json({
          error: 'availabilityException doit être un booléen dans la liste des votes'
        })
      }
    }
    
    const results = []
    const voteSettingsByYear = new Map()
    let firstSuccessfulVoteId = null
    let firstSuccessfulDecision = null
    
    for (const voteData of votes) {
      const vote = await Vote.findById(voteData.voteId)
        .populate('tpiPlanning', 'year')
      
      if (!vote || vote.voter.toString() !== voterObjectId.toString()) {
        results.push({ voteId: voteData.voteId, success: false, error: 'Non autorisé' })
        continue
      }

      if (context && Number(vote.tpiPlanning?.year) !== Number(context.year)) {
        results.push({ voteId: voteData.voteId, success: false, error: 'Hors scope du lien de vote' })
        continue
      }

      if (context?.scope?.tpiId && String(vote.tpiPlanning?._id || '') !== String(context.scope.tpiId)) {
        results.push({ voteId: voteData.voteId, success: false, error: 'Hors scope du lien de vote' })
        continue
      }

      if (voteData.decision === 'preferred') {
        const voteSettings = await getVoteSettingsForYear(vote.tpiPlanning?.year, voteSettingsByYear)
        const preferredCount = await getPreferredVoteCountForVoter({
          tpiPlanningId: vote.tpiPlanning._id || vote.tpiPlanning,
          voterId: voterObjectId,
          excludeVoteId: vote._id
        })

        if (preferredCount + 1 > voteSettings.maxProposalsPerTpi) {
          results.push({
            voteId: voteData.voteId,
            success: false,
            error: buildMaxVoteProposalsMessage(voteSettings.maxProposalsPerTpi)
          })
          continue
        }
      }
      
      vote.decision = voteData.decision
      vote.comment = voteData.comment
      vote.availabilityException = Boolean(voteData.availabilityException)
      vote.priority = voteData.priority === undefined
        ? undefined
        : toInteger(voteData.priority)
      await vote.save()
      
      results.push({ voteId: voteData.voteId, success: true })

      if (!firstSuccessfulVoteId) {
        firstSuccessfulVoteId = vote._id
        firstSuccessfulDecision = voteData.decision
      }
    }
    
    // Vérifier la validation après tous les votes
    if (firstSuccessfulVoteId) {
      const validationResult = await schedulingService.registerVoteAndCheckValidation(
        firstSuccessfulVoteId,
        firstSuccessfulDecision
      )
      
      return res.json({ results, validation: validationResult })
    }
    
    res.json({ results })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/votes/:id/preferred-soutenance-choice
 * Insère le créneau proposé par un votant dans ses dates idéales.
 */
router.post('/votes/:id/preferred-soutenance-choice', authMiddleware, requireObjectIdParam('id', 'Identifiant de vote'), requireRole('admin'), async (req, res) => {
  try {
    const vote = await Vote.findById(req.params.id)
      .populate('slot', 'date period startTime endTime room')
      .populate('voter', 'firstName lastName email preferredSoutenanceDates preferredSoutenanceChoices')

    if (!vote || !vote.slot || !vote.voter) {
      return res.status(404).json({ error: 'Vote, créneau ou votant introuvable.' })
    }

    if (vote.decision !== 'preferred') {
      return res.status(400).json({ error: 'Seules les propositions de créneau peuvent être ajoutées aux préférences.' })
    }

    const dateKey = toDateKey(vote.slot.date)
    const period = toInteger(vote.slot.period)

    if (!dateKey) {
      return res.status(400).json({ error: 'Créneau sans date exploitable.' })
    }

    const voter = vote.voter
    const existingChoices = Array.isArray(voter.preferredSoutenanceChoices)
      ? voter.preferredSoutenanceChoices
      : []
    const existingDateFallbacks = Array.isArray(voter.preferredSoutenanceDates)
      ? voter.preferredSoutenanceDates
      : []

    const normalizedChoices = existingChoices.length > 0
      ? existingChoices
      : existingDateFallbacks.map((date) => ({ date, period: null }))

    const seenChoiceKeys = new Set()
    const choiceRows = []
    for (const choice of normalizedChoices) {
      const normalizedChoice = {
        date: toDateKey(choice?.date),
        period: toInteger(choice?.period)
      }

      if (!normalizedChoice.date) {
        continue
      }

      const choiceKey = `${normalizedChoice.date}|${normalizedChoice.period || ''}`
      if (seenChoiceKeys.has(choiceKey)) {
        continue
      }

      seenChoiceKeys.add(choiceKey)
      choiceRows.push(normalizedChoice)
    }

    const exactIndex = choiceRows.findIndex((choice) =>
      choice.date === dateKey && Number(choice.period || 0) === Number(period || 0)
    )
    const dateOnlyIndex = choiceRows.findIndex((choice) =>
      choice.date === dateKey && !choice.period
    )

    let added = false
    if (exactIndex === -1 && dateOnlyIndex !== -1) {
      choiceRows[dateOnlyIndex] = { date: dateKey, period }
      added = true
    } else if (exactIndex === -1) {
      if (choiceRows.length >= 3) {
        return res.status(409).json({
          error: 'Le votant a déjà 3 dates idéales. Modifiez ses préférences dans Parties prenantes.',
          preferredSoutenanceChoices: choiceRows
        })
      }

      choiceRows.push({ date: dateKey, period })
      added = true
    }

    voter.preferredSoutenanceChoices = choiceRows.map((choice) => ({
      date: new Date(`${choice.date}T00:00:00.000Z`),
      period: choice.period || null
    }))
    voter.preferredSoutenanceDates = Array.from(new Set(choiceRows.map((choice) => choice.date)))
      .map((choiceDate) => new Date(`${choiceDate}T00:00:00.000Z`))

    await voter.save()

    return res.json({
      success: true,
      added,
      voter: {
        _id: String(voter._id),
        name: formatVotePersonName(voter),
        email: voter.email || ''
      },
      preferredSoutenanceChoices: choiceRows,
      slot: {
        _id: String(vote.slot._id),
        date: dateKey,
        period,
        startTime: vote.slot.startTime || '',
        endTime: vote.slot.endTime || '',
        room: vote.slot.room || null
      }
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/votes/:id
 * Soumet un vote
 */
router.post('/votes/:id', authMiddleware, requireObjectIdParam('id', 'Identifiant de vote'), async (req, res) => {
  try {
    const { decision, comment } = req.body
    const context = getVoteMagicLinkContext(req)
    const voterObjectId = resolveVoteParticipantId(req)
    const priority = req.body?.priority === undefined
      ? undefined
      : toInteger(req.body.priority)
    
    if (!decision || !ALLOWED_VOTE_DECISIONS.has(decision)) {
      return res.status(400).json({ error: 'decision invalide (accepted, rejected, preferred)' })
    }

    if (req.body?.priority !== undefined && (!priority || priority < 1)) {
      return res.status(400).json({ error: 'priority doit être un entier >= 1' })
    }

    if (
      req.body?.availabilityException !== undefined &&
      typeof req.body.availabilityException !== 'boolean'
    ) {
      return res.status(400).json({ error: 'availabilityException doit être un booléen' })
    }

    if (!voterObjectId) {
      return res.status(403).json({ error: 'Non autorisé à voter' })
    }
    
    const vote = await Vote.findById(req.params.id)
      .populate('tpiPlanning', 'year')
    
    if (!vote) {
      return res.status(404).json({ error: 'Vote non trouvé' })
    }
    
    // Vérifier que c'est bien le votant
    if (vote.voter.toString() !== voterObjectId.toString()) {
      return res.status(403).json({ error: 'Non autorisé à voter' })
    }

    if (context && Number(vote.tpiPlanning?.year) !== Number(context.year)) {
      return rejectVoteScope(res, 'Vote hors scope du lien de vote.')
    }

    if (context?.scope?.tpiId && String(vote.tpiPlanning?._id || '') !== String(context.scope.tpiId)) {
      return rejectVoteScope(res, 'Vote hors scope du lien de vote.')
    }

    if (decision === 'preferred') {
      const voteSettings = await getVoteSettingsForYear(vote.tpiPlanning?.year)
      const preferredCount = await getPreferredVoteCountForVoter({
        tpiPlanningId: vote.tpiPlanning._id || vote.tpiPlanning,
        voterId: voterObjectId,
        excludeVoteId: vote._id
      })

      if (preferredCount + 1 > voteSettings.maxProposalsPerTpi) {
        return res.status(400).json({ error: buildMaxVoteProposalsMessage(voteSettings.maxProposalsPerTpi) })
      }
    }
    
    vote.decision = decision
    vote.comment = comment
    vote.availabilityException = Boolean(req.body?.availabilityException)
    vote.priority = priority
    vote.votedAt = new Date()
    vote.magicLinkUsed = req.headers.authorization
    
    await vote.save()
    
    // Vérifier si la validation automatique est possible
    const result = await schedulingService.registerVoteAndCheckValidation(
      vote._id,
      decision,
      comment
    )
    
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// ROUTES DISPONIBILITÉS (pour drag & drop)
// ============================================

/**
 * GET /api/planning/availability/:year/:tpiId
 * Retourne les créneaux disponibles pour un TPI (pour le drag & drop)
 */
router.get('/availability/:year/:tpiId', authMiddleware, requireYearParam('year'), requireObjectIdParam('tpiId', 'Identifiant TPI'), async (req, res) => {
  try {
    if (getVoteMagicLinkContext(req)) {
      return rejectVoteScope(res, 'Disponibilites reservees a l administration.')
    }

    const availableSlots = await schedulingService.findAvailableSlotsForTpi(req.params.tpiId)

    const slotIds = availableSlots
      .map(slotInfo => slotInfo.slot)
      .filter(Boolean)

    const slots = await Slot.find({ _id: { $in: slotIds } })
    const slotsById = new Map(slots.map(slot => [String(slot._id), slot]))

    const enrichedSlots = availableSlots.flatMap(slotInfo => {
      const slot = slotsById.get(String(slotInfo.slot))

      if (!slot) {
        return []
      }

      return [{
        ...slotInfo,
        slotDetails: {
          id: slot._id,
          date: slot.date,
          period: slot.period,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room
        }
      }]
    })
    
    res.json(enrichedSlots)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/assign/:slotId
 * Assigne un TPI à un créneau (drag & drop final)
 */
router.post('/assign/:slotId', authMiddleware, requireObjectIdParam('slotId', 'Identifiant de créneau'), requireRole('admin'), async (req, res) => {
  try {
    const { tpiId } = req.body

    if (!isValidObjectId(tpiId)) {
      return res.status(400).json({ error: 'tpiId invalide' })
    }
    
    const result = await schedulingService.confirmSlotForTpi(tpiId, req.params.slotId)
    
    if (result.success) {
      // Envoyer les confirmations
      const tpi = await TpiPlanning.findById(tpiId)
        .populate('candidat expert1 expert2 chefProjet')
      
      const recipients = [tpi.candidat, tpi.expert1, tpi.expert2, tpi.chefProjet]
      const emailSettings = await getSharedEmailSettingsIfAvailable()
      await emailService.sendSoutenanceConfirmations(tpi, result.slot, recipients, { emailSettings })
    }
    
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/tpi/:id/resend-votes
 * Renvoie les demandes de vote pour un TPI
 */
router.post('/tpi/:id/resend-votes', authMiddleware, requireObjectIdParam('id', 'Identifiant TPI'), requireRole('admin'), async (req, res) => {
  try {
    const tpi = await TpiPlanning.findById(req.params.id)
      .populate('candidat expert1 expert2 chefProjet')
      .populate('proposedSlots.slot')
    
    if (!tpi) {
      return res.status(404).json({ error: 'TPI non trouvé' })
    }
    
    if (!tpi.proposedSlots || tpi.proposedSlots.length === 0) {
      return res.status(400).json({ error: 'Aucun créneau proposé pour ce TPI' })
    }
    
    const baseUrl = `${req.protocol}://${req.get('host')}/api/planning`
    const accessLinkSettings = await getAccessLinkSettingsForYear(tpi.year)
    
    // Générer les magic links pour chaque votant
    const voters = [
      { person: tpi.expert1, role: 'expert1' },
      { person: tpi.expert2, role: 'expert2' },
      { person: tpi.chefProjet, role: 'chef_projet' }
    ]
    
    const magicLinks = []
    
    for (const voter of voters) {
      if (voter.person) {
        const link = await magicLinkService.generateMagicLink(voter.person.email, baseUrl, {
          expiresInHours: accessLinkSettings.voteLinkValidityHours
        })
        magicLinks.push({
          ...link,
          email: voter.person.email,
          personName: `${voter.person.firstName} ${voter.person.lastName}`,
          role: voter.role,
          slots: tpi.proposedSlots.map(ps => ({
            date: ps.slot.date.toLocaleDateString('fr-CH'),
            period: ps.slot.period,
            startTime: ps.slot.startTime,
            endTime: ps.slot.endTime,
            room: ps.slot.room.name
          }))
        })
      }
    }
    
    // Envoyer les emails
    const emailSettings = await getSharedEmailSettingsIfAvailable()
    await emailService.sendVoteRequests(tpi, magicLinks, {
      emailSettings,
      expiresInHours: accessLinkSettings.voteLinkValidityHours
    })
    
    res.json({ 
      success: true, 
      message: 'Demandes de vote renvoyées avec succès',
      emailsSent: magicLinks.length 
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
