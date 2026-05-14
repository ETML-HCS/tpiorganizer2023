const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const zlib = require('zlib')

const { rootDir } = require('../config/loadEnv')
const Slot = require('../models/slotModel')
const TpiPlanning = require('../models/tpiCoordinationModel')
const Vote = require('../models/voteModel')
const { MagicLink } = require('../models/magicLinkModel')
const { ResolutionProposal } = require('../models/resolutionProposalModel')
const schedulingService = require('./schedulingService')
const {
  getPlanningConfigIfAvailable,
  normalizeWorkflowSettings
} = require('./coordinationConfigService')
const { getSharedPublicationSettingsIfAvailable } = require('./coordinationCatalogService')
const {
  buildConfiguredSlotProposalOptions,
  buildProposalOptionDisplay,
  buildSlotQueueKey,
  buildVoteProposalContext,
  filterSlotDocumentsForVoteProposal
} = require('./voteProposalOptionsService')
const {
  ensureConfiguredWindowSlotDocuments
} = require('./voteProposalWindowSlotService')
const {
  getPublicationDeploymentConfigIfAvailable
} = require('./publicationDeploymentConfigService')
const {
  SimpleFtpClient,
  getFtpConfig,
  joinSlashPaths,
  normalizeSlashPath
} = require('./staticDefensePublicationService')
const { COORDINATION_VOTE_STATUSES } = require('../modules/coordination/status')

const DEFAULT_OUTPUT_ROOT = path.resolve(rootDir, 'static-publication')
const DEFAULT_PUBLIC_BASE_URL = 'https://tpi26.ch'
const DEFAULT_STATIC_VOTE_PATH_PREFIX = 'votes'
const DEFAULT_STATIC_VOTE_SYNC_TIMEOUT_MS = 15000
const STATIC_VOTE_BOOTSTRAP_PLACEHOLDER = '<!-- STATIC_VOTE_BOOTSTRAP -->'
const STATIC_VOTE_IMPORT_PREFIX = 'static-vote'
const VOTE_TPI_STATUSES = COORDINATION_VOTE_STATUSES
const ALLOWED_RESPONSE_MODES = new Set(['ok', 'proposal'])

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function parseYear(value) {
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    const error = new Error('Annee invalide pour la publication vote.')
    error.statusCode = 400
    throw error
  }

  return parsed
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function escapeHtml(value) {
  return compactText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function serializeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

function serializeJsonForPhp(value) {
  return JSON.stringify(value)
    .replace(/<\?/g, '<\\/')
    .replace(/<\/script/gi, '<\\/script')
}

function toIdString(value) {
  if (!value) {
    return ''
  }

  return String(value?._id || value?.id || value)
}

function toDateOrNull(value) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toIsoDate(value) {
  const date = toDateOrNull(value)
  return date ? date.toISOString().slice(0, 10) : ''
}

function formatDateLabel(value) {
  const isoDate = toIsoDate(value)
  if (!isoDate) {
    return ''
  }

  const date = new Date(`${isoDate}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    return isoDate
  }

  return new Intl.DateTimeFormat('fr-CH', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date)
}

function formatPersonName(person) {
  if (!person) {
    return ''
  }

  if (typeof person.fullName === 'string' && person.fullName.trim()) {
    return person.fullName.trim()
  }

  if (typeof person.name === 'string' && person.name.trim()) {
    return person.name.trim()
  }

  return [person.firstName, person.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function getOutputRoot() {
  const configuredPath = compactText(
    process.env.STATIC_VOTE_PUBLICATION_DIR ||
    process.env.STATIC_PUBLICATION_DIR
  )

  return configuredPath
    ? path.resolve(rootDir, configuredPath)
    : DEFAULT_OUTPUT_ROOT
}

function getOutputDir(year) {
  return path.join(getOutputRoot(), 'votes', String(parseYear(year)))
}

function getIndexPath(year) {
  return path.join(getOutputDir(year), 'index.html')
}

function getPhpIndexPath(year) {
  return path.join(getOutputDir(year), 'index.php')
}

function getSyncPhpPath(year) {
  return path.join(getOutputDir(year), 'sync.php')
}

function getArbitragePhpPath(year) {
  return path.join(getOutputDir(year), 'arbitrage.php')
}

function getDeniedIndexPath(year) {
  return path.join(getOutputDir(year), 'index-denied.html')
}

function getHtaccessPath(year) {
  return path.join(getOutputDir(year), '.htaccess')
}

function getManifestPath(year) {
  return path.join(getOutputDir(year), 'manifest.json')
}

function getPreviewPath(year) {
  return `/api/workflow/${parseYear(year)}/static-votes/preview`
}

function withPublicationYear(value, year) {
  return compactText(value).replace(/\{year\}/g, String(parseYear(year)))
}

function getDefaultStaticVotePublicPath(year) {
  return `/${DEFAULT_STATIC_VOTE_PATH_PREFIX}-${parseYear(year)}`
}

function normalizeVotePublicPath(year, deploymentConfig = null) {
  const normalizedYear = parseYear(year)
  const configuredDeploymentPath = compactText(
    deploymentConfig?.votePublicPath ||
    deploymentConfig?.staticVotePublicPath ||
    deploymentConfig?.votePublicationPublicPath
  )
  const configuredPublicPath = compactText(
    configuredDeploymentPath ||
    process.env.STATIC_VOTE_PUBLIC_PATH ||
    process.env.STATIC_VOTE_PUBLICATION_PUBLIC_PATH ||
    process.env.FTP_STATIC_VOTE_PUBLIC_PATH
  )

  if (configuredPublicPath) {
    return normalizeSlashPath(withPublicationYear(configuredPublicPath, normalizedYear))
  }

  return getDefaultStaticVotePublicPath(normalizedYear)
}

function normalizeVoteRemoteDir(year, deploymentConfig = null) {
  const normalizedYear = parseYear(year)
  const remoteBaseDir = compactText(deploymentConfig?.remoteDir || process.env.FTP_REMOTE_DIR)
  const voteRemoteDir = compactText(
    deploymentConfig?.voteRemoteDir ||
    deploymentConfig?.staticVoteRemoteDir ||
    deploymentConfig?.votePublicationRemoteDir ||
    process.env.FTP_STATIC_VOTE_REMOTE_DIR ||
    process.env.FTP_VOTE_REMOTE_DIR
  )
  const defaultVoteDir = `${DEFAULT_STATIC_VOTE_PATH_PREFIX}-${normalizedYear}`

  if (voteRemoteDir) {
    const configuredVoteDir = withPublicationYear(voteRemoteDir, normalizedYear)
    return remoteBaseDir && !configuredVoteDir.startsWith('/')
      ? joinSlashPaths(withPublicationYear(remoteBaseDir, normalizedYear), configuredVoteDir)
      : normalizeSlashPath(configuredVoteDir)
  }

  if (remoteBaseDir) {
    return joinSlashPaths(withPublicationYear(remoteBaseDir, normalizedYear), defaultVoteDir)
  }

  return normalizeSlashPath(defaultVoteDir)
}

function normalizePublicBaseUrl(value, fallback = DEFAULT_PUBLIC_BASE_URL) {
  const rawValue = compactText(value)
  const rawFallback = compactText(fallback) || DEFAULT_PUBLIC_BASE_URL
  const candidate = rawValue || rawFallback
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`

  try {
    const url = new URL(withProtocol)
    url.hash = ''
    url.search = ''
    return url.toString().replace(/\/+$/, '')
  } catch (error) {
    return rawFallback.replace(/\/+$/, '')
  }
}

async function getConfiguredPublicBaseUrl(deploymentConfig = null) {
  const configuredDeploymentUrl = compactText(deploymentConfig?.publicBaseUrl)
  const publicationSettings = await getSharedPublicationSettingsIfAvailable()
  const configuredCatalogUrl = compactText(publicationSettings?.publicBaseUrl)
  const configuredEnvUrl = compactText(
    process.env.STATIC_VOTE_PUBLIC_BASE_URL ||
    process.env.STATIC_PUBLIC_BASE_URL ||
    process.env.PUBLIC_SITE_BASE_URL
  )
  const normalizedDefaultUrl = normalizePublicBaseUrl(DEFAULT_PUBLIC_BASE_URL)
  const normalizedDeploymentUrl = configuredDeploymentUrl
    ? normalizePublicBaseUrl(configuredDeploymentUrl)
    : ''
  const normalizedCatalogUrl = configuredCatalogUrl
    ? normalizePublicBaseUrl(configuredCatalogUrl)
    : ''

  if (normalizedDeploymentUrl && normalizedDeploymentUrl !== normalizedDefaultUrl) {
    return normalizedDeploymentUrl
  }

  if (normalizedCatalogUrl && normalizedCatalogUrl !== normalizedDefaultUrl) {
    return normalizedCatalogUrl
  }

  return normalizePublicBaseUrl(
    configuredEnvUrl ||
    normalizedDeploymentUrl ||
    normalizedCatalogUrl ||
    DEFAULT_PUBLIC_BASE_URL
  )
}

async function getPublicUrl(year, deploymentConfig = null) {
  const baseUrl = compactText(await getConfiguredPublicBaseUrl(deploymentConfig)).replace(/\/+$/, '')
  const publicPath = normalizeVotePublicPath(year, deploymentConfig)

  return `${baseUrl}${publicPath === '/' ? '/' : `${publicPath}/`}`
}

function buildPublicUrlLinkTarget(rawPublicUrl, year, deploymentConfig = null) {
  const publicUrl = compactText(rawPublicUrl)

  if (!publicUrl) {
    return null
  }

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(publicUrl)
    ? publicUrl
    : `https://${publicUrl}`

  try {
    const url = new URL(withProtocol)
    const pathname = compactText(url.pathname) || '/'
    const hasExplicitPath = pathname !== '/'
    const redirectPathname = hasExplicitPath
      ? pathname
      : `${normalizeVotePublicPath(year, deploymentConfig).replace(/\/+$/, '')}/`

    return {
      baseUrl: `${url.protocol}//${url.host}`,
      redirectPath: `${redirectPathname}${url.search || ''}` || '/'
    }
  } catch (error) {
    return null
  }
}

async function getStaticVoteLinkTarget(year, explicitPublicUrl = '', deploymentConfig = null) {
  const normalizedYear = parseYear(year)
  const publicUrl = compactText(explicitPublicUrl)
  const resolvedDeploymentConfig = deploymentConfig || (!publicUrl
    ? await getPublicationDeploymentConfigIfAvailable()
    : null)
  const resolvedPublicUrl = publicUrl || await getPublicUrl(normalizedYear, resolvedDeploymentConfig)
  const target = buildPublicUrlLinkTarget(resolvedPublicUrl, normalizedYear, resolvedDeploymentConfig)

  if (!target) {
    const error = new Error('URL publique de vote statique invalide ou absente.')
    error.statusCode = 400
    throw error
  }

  return target
}

function encodeBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function createStaticVoteArbitrageToken(payload = {}, explicitSecret = '') {
  const secret = compactText(explicitSecret || getArbitrageSecret())

  if (!secret) {
    const error = new Error('STATIC_VOTE_ARBITRAGE_SECRET ou STATIC_VOTE_SYNC_SECRET requis pour générer un lien arbitrage mini-site.')
    error.statusCode = 409
    throw error
  }

  const normalizedPayload = {
    ...payload,
    kind: 'resolution_proposal',
    version: 1
  }
  const compressed = zlib.deflateRawSync(Buffer.from(JSON.stringify(normalizedPayload), 'utf8'))
  const body = encodeBase64Url(compressed)
  const signature = encodeBase64Url(crypto.createHmac('sha256', secret).update(body).digest())

  return `svra.${body}.${signature}`
}

function buildStaticVoteArbitrageUrl(publicUrl, year, token) {
  const normalizedYear = parseYear(year)
  const baseUrl = compactText(publicUrl) || getDefaultStaticVotePublicPath(normalizedYear)
  const url = new URL('arbitrage.php', `${baseUrl.replace(/\/+$/, '')}/`)
  url.searchParams.set('token', compactText(token))
  return url.toString()
}

function getSyncSecret() {
  return compactText(process.env.STATIC_VOTE_SYNC_SECRET)
}

function getArbitrageSecret() {
  return compactText(process.env.STATIC_VOTE_ARBITRAGE_SECRET || getSyncSecret())
}

function canBuildStaticVoteArbitrageLinks() {
  return Boolean(getArbitrageSecret())
}

function getSyncTimeoutMs(value = null) {
  return parsePositiveInteger(
    value ?? process.env.STATIC_VOTE_SYNC_TIMEOUT_MS,
    DEFAULT_STATIC_VOTE_SYNC_TIMEOUT_MS
  )
}

function toPublicVoteSettings(planningConfig = {}) {
  const settings = normalizeWorkflowSettings(planningConfig?.workflowSettings)
  return {
    maxProposalsPerTpi: settings.maxVoteProposals,
    allowSpecialRequest: settings.allowSpecialVoteRequest
  }
}

function buildDateRangeFilters(dateKeys = []) {
  return (Array.isArray(dateKeys) ? dateKeys : [])
    .map((dateKey) => {
      const start = new Date(`${dateKey}T00:00:00.000Z`)
      if (Number.isNaN(start.getTime())) {
        return null
      }

      return {
        date: {
          $gte: start,
          $lt: new Date(start.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    })
    .filter(Boolean)
}

function normalizePlanningLookup(value) {
  return compactText(value)
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

  const slotSite = normalizePlanningLookup(slot?.room?.site || slot?.roomSite)
  return !slotSite || slotSite === tpiSite
}

function hasUsefulQueueKey(value) {
  return compactText(value).replace(/\|/g, '').length > 0
}

function buildStaticSlotSortKey(slot) {
  const date = new Date(slot?.date || 0).getTime()
  return [
    Number.isFinite(date) ? String(date) : '0',
    compactText(slot?.period),
    compactText(slot?.startTime),
    compactText(slot?.room?.name || slot?.roomName)
  ].join('|')
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

  return buildStaticSlotSortKey(candidate?.slot).localeCompare(buildStaticSlotSortKey(current?.slot)) < 0
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
  if (normalizedOptions.length === 0 || mongoose.connection?.readyState !== 1) {
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

    const dateKey = toIsoDate(option.slot?.date)
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

    const slotId = toIdString(slotDocument)
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
    decision: { $in: ['accepted', 'preferred'] }
  })
    .select('slot voter')
    .lean()

  const votersByQueueKey = new Map()
  for (const vote of positiveVotes) {
    const queueKey = queueKeyBySlotId.get(toIdString(vote.slot))
    const voterId = toIdString(vote.voter)

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

function getSlotIdFromProposedSlot(proposedSlot) {
  return toIdString(proposedSlot?.slot)
}

function getFixedSlotIdFromTpi(tpi) {
  const fixedSlot = Array.isArray(tpi?.proposedSlots)
    ? tpi.proposedSlots.find((proposedSlot) => proposedSlot?.slot)
    : null

  return getSlotIdFromProposedSlot(fixedSlot)
}

function buildSlotPayload(slot) {
  const date = toIsoDate(slot?.date)
  const roomName = compactText(slot?.room?.name)
  const roomSite = compactText(slot?.room?.site)
  const startTime = compactText(slot?.startTime)
  const endTime = compactText(slot?.endTime)

  return {
    id: toIdString(slot),
    date,
    dateLabel: formatDateLabel(slot?.date),
    period: Number.parseInt(String(slot?.period || ''), 10) || null,
    startTime,
    endTime,
    room: roomName || roomSite
      ? {
          name: roomName,
          site: roomSite
        }
      : null,
    roomName,
    roomSite,
    label: [
      formatDateLabel(slot?.date),
      startTime && endTime ? `${startTime} - ${endTime}` : '',
      roomName
    ].filter(Boolean).join(' | ')
  }
}

function buildStaticVoteSlotTransferKey(slot) {
  if (!slot) {
    return ''
  }

  const room = slot.room && typeof slot.room === 'object' ? slot.room : {}

  return [
    toIsoDate(slot.date),
    compactText(slot.period),
    compactText(slot.startTime),
    compactText(slot.endTime),
    normalizePlanningLookup(slot.roomName || room.name),
    normalizePlanningLookup(slot.roomSite || room.site)
  ].join('|')
}

function buildCampaignId(year, groups = []) {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      year: parseYear(year),
      groups: groups.map((group) => ({
        personId: group.personId,
        tpiId: group.tpi?.id,
        fixedVoteId: group.fixedVoteId,
        proposals: group.proposalOptions.map((option) => option.slotId)
      }))
    }))
    .digest('hex')

  return `vote-${parseYear(year)}-${hash.slice(0, 16)}`
}

async function listStaticVoteAccessLinks(year) {
  const normalizedYear = parseYear(year)
  const now = new Date()
  const links = await MagicLink.find({
    type: 'vote',
    year: normalizedYear,
    revokedAt: null,
    expiresAt: { $gt: now }
  })
    .select('tokenHash personId personName recipientEmail expiresAt maxUses usageCount scope')
    .lean()

  return (Array.isArray(links) ? links : [])
    .filter((link) => {
      const tokenHash = compactText(link?.tokenHash)
      if (!tokenHash) {
        return false
      }

      const maxUses = Number(link?.maxUses || 0)
      const usageCount = Number(link?.usageCount || 0)
      return maxUses <= 0 || usageCount < maxUses
    })
    .map((link) => ({
      year: normalizedYear,
      hash: compactText(link.tokenHash),
      personId: link.personId ? String(link.personId) : null,
      name: compactText(link.personName) || null,
      email: compactText(link.recipientEmail) || null,
      scope: link.scope && typeof link.scope === 'object' && !Array.isArray(link.scope)
        ? link.scope
        : {},
      expiresAt: link.expiresAt instanceof Date
        ? link.expiresAt.toISOString()
        : new Date(link.expiresAt).toISOString()
    }))
}

function sortVoteSlots(slots = [], tpi) {
  const orderedSlotIds = Array.isArray(tpi?.proposedSlots)
    ? tpi.proposedSlots
      .map(getSlotIdFromProposedSlot)
      .filter(Boolean)
    : []
  const slotOrder = new Map(orderedSlotIds.map((slotId, index) => [slotId, index]))

  return [...slots].sort((left, right) => {
    const leftOrder = slotOrder.has(left.slotId) ? slotOrder.get(left.slotId) : Number.MAX_SAFE_INTEGER
    const rightOrder = slotOrder.has(right.slotId) ? slotOrder.get(right.slotId) : Number.MAX_SAFE_INTEGER

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    return String(left.slot?.label || '').localeCompare(String(right.slot?.label || ''), 'fr')
  })
}

async function buildStaticVoteProposalOptionsForTpi(tpi, groupedSlots = [], planningConfig = null) {
  const tpiId = toIdString(tpi)
  let resolvedPlanningConfig = planningConfig

  if (!resolvedPlanningConfig && mongoose.connection?.readyState === 1) {
    try {
      resolvedPlanningConfig = await getPlanningConfigIfAvailable(tpi?.year)
    } catch (error) {
      console.warn(`Configuration de vote statique indisponible pour ${tpi?.year}:`, error?.message || error)
    }
  }

  const voteSettings = toPublicVoteSettings(resolvedPlanningConfig || {})
  const proposalContext = resolvedPlanningConfig
    ? buildVoteProposalContext(tpi, resolvedPlanningConfig)
    : {
        candidateClass: compactText(tpi?.classe),
        candidateClassLabel: compactText(tpi?.classe),
        classCode: '',
        isMatu: false,
        allowedDateKeys: [],
        allowedDateLabels: [],
        source: 'planning_slots'
      }

  if (!tpiId) {
    return {
      options: [],
      context: proposalContext,
      settings: voteSettings
    }
  }

  const fixedSlotId = getFixedSlotIdFromTpi(tpi)
  const optionsByWindowKey = new Map()
  const existingSlotIds = new Set()

  for (const groupedSlot of Array.isArray(groupedSlots) ? groupedSlots : []) {
    const slotId = compactText(groupedSlot?.slotId || groupedSlot?.slot?.id || groupedSlot?.slot?._id)

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
      display: buildProposalOptionDisplay(groupedSlot.slot, resolvedPlanningConfig || {}, tpi),
      availabilityStatus: 'existing_vote'
    })
  }

  if (mongoose.connection?.readyState === 1) {
    try {
      const availableSlots = await schedulingService.findAvailableSlotsForTpi(tpiId)
      const availableSlotIds = (Array.isArray(availableSlots) ? availableSlots : [])
        .map((slotInfo) => slotInfo.slot)
        .filter(Boolean)

      if (availableSlotIds.length > 0) {
        const slotDocuments = await Slot.find({ _id: { $in: availableSlotIds } })
          .select('date period startTime endTime room status')
          .lean()
        const filteredSlotDocuments = filterSlotDocumentsForVoteProposal(slotDocuments, proposalContext)
        const slotById = new Map(
          filteredSlotDocuments.map((slotDocument) => [toIdString(slotDocument), slotDocument])
        )

        for (const slotInfo of availableSlots) {
          const slotId = compactText(slotInfo?.slot)
          if (!slotId || slotId === fixedSlotId) {
            continue
          }

          const slotDocument = slotById.get(slotId)
          if (!slotDocument || !isSlotSiteCompatibleWithTpi(slotDocument, tpi)) {
            continue
          }

          existingSlotIds.add(slotId)
          addProposalOptionByWindow(optionsByWindowKey, {
            slotId,
            voteId: null,
            slot: buildSlotPayload(slotDocument),
            source: 'planning_option',
            queueKey: buildSlotQueueKey(slotDocument),
            score: Number.isFinite(Number(slotInfo.score)) ? Number(slotInfo.score) : null,
            reason: compactText(slotInfo.reason),
            display: buildProposalOptionDisplay(slotDocument, resolvedPlanningConfig || {}, tpi),
            availabilityStatus: 'available'
          })
        }
      }
    } catch (error) {
      console.warn(`Options de vote statique indisponibles pour ${tpi?.reference || tpiId}:`, error?.message || error)
    }

    try {
      const shouldLoadConfiguredWindows =
        (Array.isArray(proposalContext.allowedDateKeys) && proposalContext.allowedDateKeys.length > 0) ||
        optionsByWindowKey.size === 0

      if (shouldLoadConfiguredWindows) {
        const dateRangeFilters = buildDateRangeFilters(proposalContext.allowedDateKeys)
        const configuredSlotQuery = {
          year: tpi.year,
          status: { $in: ['available', 'proposed', 'pending_votes', 'confirmed'] }
        }

        if (dateRangeFilters.length > 0) {
          configuredSlotQuery.$or = dateRangeFilters
        }

        const configuredSlotDocuments = await Slot.find(configuredSlotQuery)
          .select('date period startTime endTime room status assignedTpi config')
          .sort({ date: 1, period: 1, 'room.name': 1 })
          .lean()
        const siteCompatibleSlotDocuments = (Array.isArray(configuredSlotDocuments) ? configuredSlotDocuments : [])
          .filter((slotDocument) => isSlotSiteCompatibleWithTpi(slotDocument, tpi))
        const proposalSlotDocuments = await ensureConfiguredWindowSlotDocuments(siteCompatibleSlotDocuments, {
          planningConfig: resolvedPlanningConfig || {},
          proposalContext,
          tpi,
          year: tpi.year
        })
        const configuredOptions = buildConfiguredSlotProposalOptions(proposalSlotDocuments, {
          fixedSlotId,
          existingSlotIds,
          planningConfig: resolvedPlanningConfig || {},
          proposalContext,
          tpi,
          source: 'planning_config_window'
        })

        for (const option of configuredOptions) {
          if (!option?.slotId || option.slotId === fixedSlotId) {
            continue
          }

          addProposalOptionByWindow(optionsByWindowKey, {
            ...option,
            slot: buildSlotPayload(option.slot)
          })
        }
      }
    } catch (error) {
      console.warn(`Demi-journées de vote statique indisponibles pour ${tpi?.reference || tpiId}:`, error?.message || error)
    }
  }

  const options = Array.from(optionsByWindowKey.values())
    .sort((left, right) => {
      const leftKey = left.queueKey || buildSlotQueueKey(left.slot)
      const rightKey = right.queueKey || buildSlotQueueKey(right.slot)

      if (leftKey !== rightKey) {
        return leftKey.localeCompare(rightKey)
      }

      return buildStaticSlotSortKey(left.slot).localeCompare(buildStaticSlotSortKey(right.slot))
    })
  const optionsWithQueue = await attachVoteQueueCountsToProposalOptions(options, tpi)

  return {
    options: optionsWithQueue,
    context: proposalContext,
    settings: voteSettings
  }
}

async function buildStaticVoteCampaignPayload(year, generatedAt = new Date().toISOString()) {
  const normalizedYear = parseYear(year)
  let planningConfig = null
  try {
    planningConfig = await getPlanningConfigIfAvailable(normalizedYear)
  } catch (error) {
    console.warn(`Configuration de vote statique ${normalizedYear} indisponible:`, error?.message || error)
  }
  const defaultVoteSettings = toPublicVoteSettings(planningConfig || {})
  const tpis = await TpiPlanning.find({
    year: normalizedYear,
    status: { $in: VOTE_TPI_STATUSES }
  })
    .populate('candidat', 'firstName lastName name fullName')
    .populate('proposedSlots.slot', 'date period startTime endTime room status')
    .select('reference sujet year status candidat classe site proposedSlots history')
    .sort({ reference: 1 })

  if (!Array.isArray(tpis) || tpis.length === 0) {
    return {
      year: normalizedYear,
      generatedAt,
      campaignId: buildCampaignId(normalizedYear, []),
      groups: []
    }
  }

  const tpiById = new Map(tpis.map((tpi) => [toIdString(tpi), tpi]))
  const votes = await Vote.find({
    tpiPlanning: { $in: tpis.map((tpi) => tpi._id) },
    decision: { $nin: ['accepted', 'preferred'] }
  })
    .populate('slot', 'date period startTime endTime room status')
    .populate('voter', 'firstName lastName name fullName email')
    .select('tpiPlanning slot voter voterRole decision')
    .sort({ createdAt: 1 })

  const groupsByKey = new Map()

  for (const vote of Array.isArray(votes) ? votes : []) {
    const tpiId = toIdString(vote?.tpiPlanning)
    const tpi = tpiById.get(tpiId)
    const personId = toIdString(vote?.voter)
    const slotId = toIdString(vote?.slot)

    if (!tpi || !personId || !slotId) {
      continue
    }

    if (compactText(vote.decision || 'pending') !== 'pending' && !isMovedVoteRelaunchVote(vote, tpi)) {
      continue
    }

    const groupKey = `${personId}:${tpiId}`

    if (!groupsByKey.has(groupKey)) {
      groupsByKey.set(groupKey, {
        personId,
        personName: formatPersonName(vote.voter),
        personEmail: compactText(vote?.voter?.email),
        tpi: {
          id: tpiId,
          reference: compactText(tpi.reference),
          subject: compactText(tpi.sujet),
          candidateName: formatPersonName(tpi.candidat),
          classe: compactText(tpi.classe),
          site: compactText(tpi.site),
          status: compactText(tpi.status)
        },
        fixedVoteId: '',
        fixedSlotId: '',
        fixedSlot: null,
        proposalOptions: [],
        proposalContext: null,
        voteSettings: defaultVoteSettings,
        slots: []
      })
    }

    groupsByKey.get(groupKey).slots.push({
      voteId: toIdString(vote),
      voterRole: compactText(vote.voterRole),
      slotId,
      slot: buildSlotPayload(vote.slot)
    })
  }

  const groups = []

  for (const group of groupsByKey.values()) {
    const tpi = tpiById.get(group.tpi.id)
    const fixedSlotId = getFixedSlotIdFromTpi(tpi)
    const sortedSlots = sortVoteSlots(group.slots, tpi)
    const fixedEntry = sortedSlots.find((slot) => slot.slotId === fixedSlotId) || sortedSlots[0] || null

    if (!fixedEntry) {
      continue
    }

    const proposalData = await buildStaticVoteProposalOptionsForTpi(tpi, sortedSlots, planningConfig)

    groups.push({
      personId: group.personId,
      personName: group.personName,
      personEmail: group.personEmail,
      tpi: group.tpi,
      fixedVoteId: fixedEntry.voteId,
      fixedSlotId: fixedEntry.slotId,
      fixedSlot: fixedEntry.slot,
      proposalOptions: proposalData.options,
      proposalContext: proposalData.context,
      voteSettings: proposalData.settings
    })
  }

  groups.sort((left, right) => (
    `${left.personName}|${left.tpi.reference}`
      .localeCompare(`${right.personName}|${right.tpi.reference}`, 'fr')
  ))

  return {
    year: normalizedYear,
    generatedAt,
    campaignId: buildCampaignId(normalizedYear, groups),
    groups
  }
}

function buildStaticVoteUnavailableHtml(year, title = 'Lien personnel requis', message = 'Le module de vote est accessible uniquement depuis le lien personnel transmis par email.') {
  const normalizedYear = parseYear(year)

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(title)} ${normalizedYear}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      --ink: #172033;
      --muted: #526071;
      --line: #d8dee8;
      --panel: #fff;
      --page: #f5f7fb;
      --accent: #0f766e;
      --accent-soft: #e7f5f1;
      --info: #1d4ed8;
      --info-soft: #eaf2ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: linear-gradient(180deg, #eaf1f4 0, #f8fafc 220px, var(--page) 100%);
      color: var(--ink);
    }
    main {
      width: min(560px, calc(100vw - 32px));
      display: grid;
      gap: 14px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 28px;
      box-shadow: 0 24px 70px rgba(23, 32, 51, .10);
    }
    .vote-unavailable-kicker {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 4px 10px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: .82rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .vote-unavailable-status {
      display: grid;
      gap: 8px;
      padding: 12px;
      border-left: 4px solid var(--info);
      background: var(--info-soft);
      color: var(--muted);
      line-height: 1.45;
    }
    h1 { margin: 0; font-size: 1.62rem; line-height: 1.12; letter-spacing: 0; }
    p { margin: 0; color: var(--muted); line-height: 1.55; }
  </style>
</head>
<body>
  <main>
    <span class="vote-unavailable-kicker">Votes coordination ${normalizedYear}</span>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <p class="vote-unavailable-status">Aucun vote n'est affiche depuis l'adresse publique. Le contenu est charge uniquement apres validation du lien nominatif.</p>
  </main>
</body>
</html>`
}

function buildStaticVoteHtml({ year, generatedAt, campaignId, groups = [] }) {
  const normalizedYear = parseYear(year)

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Votes coordination ${normalizedYear}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      --ink: #182235;
      --muted: #5b6678;
      --line: #d9e2ec;
      --panel: #fff;
      --page: #f5f7fb;
      --soft: #edf2f7;
      --accent: #0f766e;
      --accent-strong: #0b5e57;
      --accent-soft: #e6f4f1;
      --info: #1d4ed8;
      --info-soft: #eaf2ff;
      --warning: #8a5a00;
      --warning-soft: #fff7e6;
      --danger: #b42318;
      --danger-soft: #fff1f0;
      --shadow: 0 18px 50px rgba(23, 32, 51, .08);
      --card-shadow: 0 10px 28px rgba(23, 32, 51, .055);
    }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    .vote-shell,
    .vote-card,
    .vote-card *,
    .vote-header,
    .vote-summary {
      min-width: 0;
    }
    body {
      margin: 0;
      min-height: 100vh;
      background: linear-gradient(180deg, #eaf1f4 0, #f8fafc 210px, var(--page) 100%);
      color: var(--ink);
    }
    button, input, textarea { font: inherit; }
    button { -webkit-tap-highlight-color: transparent; }
    .vote-shell {
      width: min(1080px, calc(100vw - 24px));
      margin: 0 auto;
      padding: 12px 0 26px;
    }
    .vote-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(260px, 330px);
      gap: 10px;
      align-items: stretch;
      margin-bottom: 10px;
      padding: 11px;
      background: rgba(255, 255, 255, .92);
      border: 1px solid rgba(215, 222, 232, .95);
      border-radius: 8px;
      box-shadow: var(--shadow);
    }
    .vote-header-main {
      display: grid;
      align-content: center;
      gap: 6px;
    }
    .vote-kicker {
      display: inline-flex;
      align-items: center;
      min-height: 21px;
      padding: 1px 7px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent-strong);
      font-size: .74rem;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .vote-header h1 { margin: 0; font-size: 1.48rem; line-height: 1.08; letter-spacing: 0; }
    .vote-header p { margin: 0; color: var(--muted); line-height: 1.3; }
    .vote-viewer-line {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .vote-viewer-line::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--accent);
      box-shadow: 0 0 0 4px rgba(15, 118, 110, .12);
      flex: 0 0 auto;
    }
    .vote-summary {
      display: grid;
      align-content: center;
      gap: 6px;
      padding: 7px;
      background: #f8faf9;
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .vote-summary strong { font-size: 1.04rem; letter-spacing: 0; }
    .vote-summary span, .vote-summary small { color: var(--muted); line-height: 1.3; }
    .vote-progress {
      width: 100%;
      height: 6px;
      overflow: hidden;
      border-radius: 999px;
      background: #dde5eb;
    }
    .vote-progress span {
      display: block;
      width: 0%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--accent), var(--info));
      transition: width .18s ease;
    }
    .vote-list { display: grid; gap: 10px; }
    .vote-date-group {
      display: grid;
      gap: 6px;
    }
    .vote-date-header {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 8px;
      padding: 2px 2px 0;
    }
    .vote-date-header h2 {
      margin: 0;
      font-size: 1rem;
      line-height: 1.2;
      letter-spacing: 0;
    }
    .vote-date-progress {
      display: inline-flex;
      align-items: center;
      min-height: 21px;
      padding: 2px 7px;
      border-radius: 999px;
      background: #fff;
      border: 1px solid var(--line);
      color: var(--muted);
      font-size: .78rem;
      font-weight: 700;
      white-space: nowrap;
    }
    .vote-date-progress.is-complete {
      background: var(--accent-soft);
      border-color: rgba(15, 118, 110, .28);
      color: var(--accent-strong);
    }
    .vote-date-cards {
      display: grid;
      gap: 7px;
    }
    .vote-period-group {
      display: grid;
      gap: 6px;
    }
    .vote-period-header {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
      font-size: .82rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .vote-period-header::after {
      content: "";
      height: 1px;
      flex: 1 1 auto;
      background: var(--line);
    }
    .vote-period-count {
      display: inline-flex;
      align-items: center;
      min-height: 18px;
      padding: 1px 6px;
      border-radius: 999px;
      background: var(--soft);
      color: var(--muted);
      font-size: .74rem;
      font-weight: 800;
      text-transform: none;
      letter-spacing: 0;
    }
    .vote-period-cards {
      display: grid;
      gap: 7px;
    }
    .vote-card {
      display: grid;
      gap: 0;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: var(--card-shadow);
    }
    .vote-card.is-submitted {
      border-color: rgba(15, 118, 110, .42);
      background: linear-gradient(180deg, #fff 0, #f8fcfb 100%);
    }
    .vote-card.is-sent-compact {
      gap: 0;
      padding: 8px;
    }
    .vote-card.is-just-sent {
      animation: voteSentIn .32s ease-out;
    }
    .vote-sent {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 9px;
      align-items: start;
    }
    .vote-sent-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      justify-self: end;
      min-width: 36px;
      min-height: 28px;
      padding: 4px 7px;
      border-radius: 999px;
      background: var(--accent);
      color: #fff;
      font-size: .78rem;
      font-weight: 800;
      letter-spacing: .02em;
    }
    .vote-sent strong {
      display: block;
      font-size: .96rem;
      line-height: 1.25;
    }
    .vote-sent p {
      margin: 2px 0 0;
      color: var(--muted);
      font-size: .9rem;
      line-height: 1.35;
    }
    @keyframes voteSentIn {
      from {
        opacity: .35;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .vote-card.is-just-sent { animation: none; }
    }
    .vote-card-header {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: flex-start;
      padding: 8px 10px;
      border-bottom: 1px solid var(--line);
      background: #fff;
    }
    .vote-reference {
      display: block;
      margin-bottom: 2px;
      color: var(--accent-strong);
      font-size: .74rem;
      font-weight: 700;
      letter-spacing: .03em;
      text-transform: uppercase;
    }
    .vote-card h2 { margin: 0; font-size: 1.02rem; line-height: 1.22; letter-spacing: 0; }
    .vote-card p { margin: 2px 0 0; color: var(--muted); line-height: 1.34; }
    .vote-card-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 5px;
    }
    .vote-card-meta span {
      display: inline-flex;
      align-items: center;
      min-height: 19px;
      padding: 1px 6px;
      border-radius: 999px;
      background: var(--soft);
      color: var(--muted);
      font-size: .76rem;
      font-weight: 700;
      max-width: 100%;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .vote-chip {
      display: inline-flex;
      align-items: center;
      min-height: 21px;
      padding: 2px 7px;
      border-radius: 999px;
      background: var(--warning-soft);
      color: var(--warning);
      font-size: .8rem;
      font-weight: 700;
      white-space: nowrap;
      max-width: 100%;
    }
    .vote-chip.is-submitted {
      background: var(--accent-soft);
      color: var(--accent-strong);
    }
    .vote-section {
      border-top: 1px solid var(--line);
      padding-top: 6px;
    }
    .vote-card-main-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(230px, 286px);
      grid-template-rows: auto minmax(0, 1fr);
      grid-template-areas:
        "content side"
        "content remark";
      align-items: stretch;
    }
    .vote-card-content {
      grid-area: content;
      display: grid;
      gap: 6px;
      padding: 8px 10px;
    }
    .vote-card-side {
      grid-area: side;
      padding: 8px;
      border-left: 1px solid var(--line);
      background: #f8fafc;
    }
    .vote-card-aside-remark {
      grid-area: remark;
      display: grid;
      min-height: 0;
      padding: 0 8px 8px;
      border-left: 1px solid var(--line);
      background: #f8fafc;
    }
    .vote-card-content .vote-section:first-child,
    .vote-card-side .vote-section {
      border-top: 0;
      padding-top: 0;
    }
    .vote-section h3 {
      margin: 0 0 3px;
      font-size: .74rem;
      color: var(--ink);
      letter-spacing: .02em;
      text-transform: uppercase;
    }
    .vote-slot {
      display: grid;
      gap: 4px;
      padding: 6px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fbfcfe;
    }
    .vote-slot.is-fixed {
      border-color: rgba(15, 118, 110, .35);
      background: #f8fcfb;
    }
    .vote-slot strong { font-size: .96rem; line-height: 1.28; }
    .vote-slot-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .vote-slot-meta span {
      display: inline-flex;
      align-items: center;
      min-height: 19px;
      padding: 1px 6px;
      border-radius: 999px;
      background: var(--soft);
      color: var(--muted);
      font-size: .78rem;
      max-width: 100%;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .vote-mode {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px;
    }
    .vote-choice,
    .vote-proposal,
    .vote-special-toggle,
    .vote-period-button {
      display: flex;
      gap: 5px;
      align-items: flex-start;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 6px;
      background: #fff;
      cursor: pointer;
      transition: border-color .15s ease, background .15s ease, box-shadow .15s ease;
    }
    .vote-choice:hover,
    .vote-proposal:hover,
    .vote-special-toggle:hover,
    .vote-period-button:hover:not(:disabled) {
      border-color: rgba(15, 118, 110, .42);
    }
    .vote-choice:focus-within,
    .vote-proposal:focus-within,
    .vote-special-toggle:focus-within,
    .vote-only-availability:focus-within,
    .vote-period-button:focus-visible {
      outline: 3px solid rgba(15, 118, 110, .18);
      outline-offset: 2px;
    }
    .vote-choice.is-selected,
    .vote-proposal.is-selected,
    .vote-special-toggle.is-selected,
    .vote-only-availability.is-selected,
    .vote-period-button.is-selected {
      border-color: var(--accent);
      background: var(--accent-soft);
      box-shadow: inset 0 0 0 1px rgba(15, 118, 110, .16);
    }
    .vote-proposal.vote-load-easy { border-color: rgba(22, 163, 74, .32); }
    .vote-proposal.vote-load-medium { border-color: rgba(217, 119, 6, .36); }
    .vote-proposal.vote-load-busy { border-color: rgba(220, 38, 38, .36); }
    .vote-choice.is-disabled,
    .vote-proposal.is-disabled,
    .vote-special-toggle.is-disabled,
    .vote-only-availability.is-disabled,
    .vote-period-button:disabled {
      cursor: default;
      opacity: .58;
    }
    .vote-choice input,
    .vote-proposal input,
    .vote-special-toggle input {
      margin-top: 2px;
      accent-color: var(--accent);
    }
    .vote-choice strong,
    .vote-proposal strong,
    .vote-special-toggle strong {
      display: block;
      font-size: .86rem;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }
    .vote-choice small {
      display: block;
      margin-top: 1px;
      color: var(--muted);
      font-size: .75rem;
      line-height: 1.25;
    }
    .vote-proposal span span,
    .vote-period-button span span {
      display: block;
      color: var(--muted);
      font-size: .74rem;
      line-height: 1.25;
      margin-top: 1px;
    }
    .vote-proposal-meta {
      display: flex;
      gap: 3px;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 2px;
    }
    .vote-proposal .vote-proposal-meta span,
    .vote-period-button .vote-proposal-meta span {
      display: inline-flex;
      margin-top: 0;
    }
    .vote-load-chip,
    .vote-queue-chip {
      display: inline-flex;
      align-items: center;
      min-height: 16px;
      padding: 0 5px;
      border-radius: 999px;
      font-size: .68rem;
      font-weight: 700;
    }
    .vote-load-chip.vote-load-easy {
      color: #166534;
      background: #e8f8ee;
    }
    .vote-load-chip.vote-load-medium {
      color: #92400e;
      background: #fff5d6;
    }
    .vote-load-chip.vote-load-busy {
      color: #991b1b;
      background: #ffe8e8;
    }
    .vote-queue-chip {
      color: #4b5563;
      background: #eef2f7;
    }
    .vote-proposals { display: grid; gap: 5px; }
    .vote-proposal-day {
      display: grid;
      grid-template-columns: minmax(112px, .62fr) minmax(0, 3fr);
      gap: 5px;
      align-items: stretch;
      padding: 5px;
      border: 1px solid #dfe7ef;
      border-radius: 7px;
      background: linear-gradient(180deg, #fff 0, #fbfcfe 100%);
      transition: border-color .15s ease, background .15s ease, box-shadow .15s ease;
    }
    .vote-proposal-day.has-selection {
      border-color: rgba(15, 118, 110, .38);
      background: linear-gradient(180deg, #f8fcfb 0, #fff 100%);
      box-shadow: inset 2px 0 0 rgba(15, 118, 110, .72);
    }
    .vote-proposal-day h4 {
      display: flex;
      align-items: center;
      margin: 0;
      padding: 5px 6px;
      border-radius: 7px;
      background: #f0f5f7;
      color: #263344;
      font-size: .8rem;
      line-height: 1.25;
      letter-spacing: 0;
    }
    .vote-day-controls {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 4px;
      align-items: stretch;
    }
    .vote-day-hidden-options {
      display: none;
    }
    .vote-day-segments {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 3px;
    }
    .vote-proposal-input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }
    .vote-period-button,
    .vote-day-controls .vote-only-availability {
      min-height: 34px;
      align-items: center;
      padding: 5px 6px;
    }
    .vote-period-button {
      justify-content: center;
      text-align: center;
      color: var(--ink);
    }
    .vote-period-button > span {
      display: grid;
      justify-items: center;
      gap: 2px;
      min-width: 0;
    }
    .vote-period-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      color: var(--accent);
    }
    .vote-period-icon svg {
      display: block;
      width: 16px;
      height: 16px;
      stroke: currentColor;
    }
    .vote-only-availability {
      display: flex;
      gap: 4px;
      align-items: center;
      justify-content: center;
      border: 1px dashed rgba(138, 90, 0, .38);
      border-radius: 7px;
      padding: 5px 6px;
      background: var(--warning-soft);
      cursor: pointer;
      transition: border-color .15s ease, background .15s ease, box-shadow .15s ease;
    }
    .vote-only-availability:hover { border-color: rgba(138, 90, 0, .48); }
    .vote-only-availability.is-selected {
      border-color: var(--warning);
      background: #fff1c2;
      box-shadow: inset 0 0 0 1px rgba(138, 90, 0, .14);
    }
    .vote-only-availability.is-disabled {
      cursor: default;
      opacity: .58;
    }
    .vote-only-availability input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }
    .vote-only-availability strong {
      display: block;
      font-size: .8rem;
      line-height: 1.25;
    }
    .vote-proposal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 5px;
      padding: 6px 7px;
      border: 1px solid rgba(15, 118, 110, .18);
      border-radius: 8px;
      background: linear-gradient(180deg, #f6fbfa 0, #fff 100%);
    }
    .vote-section .vote-proposal-title {
      display: flex;
      align-items: center;
      gap: 5px;
      min-width: 0;
      margin: 0;
    }
    .vote-proposal-title::before {
      content: "";
      width: 5px;
      height: 18px;
      flex: 0 0 auto;
      border-radius: 999px;
      background: var(--accent);
    }
    .vote-proposal-count {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      min-height: 19px;
      padding: 1px 6px;
      border-radius: 999px;
      background: var(--soft);
      color: var(--muted);
      font-size: .75rem;
      font-weight: 700;
    }
    .vote-proposal-head .vote-proposal-count {
      flex: 0 0 auto;
    }
    .vote-proposal-count.is-limit {
      background: var(--accent-soft);
      color: var(--accent-strong);
    }
    .vote-empty-note {
      margin: 0;
      padding: 6px;
      border: 1px dashed var(--line);
      border-radius: 8px;
      color: var(--muted);
      background: #fbfcfe;
    }
    .vote-remark {
      display: grid;
      gap: 4px;
      margin-top: 0;
    }
    .vote-card-aside-remark .vote-remark {
      grid-template-rows: auto minmax(0, 1fr);
      min-height: 0;
      height: 100%;
      padding-top: 6px;
      border-top: 1px solid var(--line);
    }
    .vote-remark label {
      color: var(--ink);
      font-size: .84rem;
      font-weight: 700;
    }
    .vote-remark textarea {
      width: 100%;
      min-height: 36px;
      height: 100%;
      resize: vertical;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 6px 7px;
      background: #fff;
      color: var(--ink);
    }
    .vote-special {
      display: grid;
      gap: 5px;
    }
    .vote-special-fields {
      display: grid;
      grid-template-columns: minmax(0, 170px) minmax(0, 1fr);
      gap: 5px;
      align-items: start;
    }
    .vote-special-fields input,
    .vote-special-fields textarea {
      width: 100%;
      min-height: 32px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 5px 6px;
      background: #fff;
      color: var(--ink);
      line-height: 1.2;
    }
    .vote-special-fields textarea { height: 32px; resize: vertical; }
    .vote-special-fields input:focus,
    .vote-special-fields textarea:focus,
    .vote-remark textarea:focus,
    .vote-submit:focus-visible {
      outline: 3px solid rgba(15, 118, 110, .22);
      outline-offset: 2px;
    }
    .vote-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 6px;
      border-top: 1px solid var(--line);
      padding: 7px 10px;
      background: #fbfcfe;
    }
    .vote-status { color: var(--muted); font-size: .92rem; line-height: 1.4; }
    .vote-status.is-error { color: var(--danger); }
    .vote-status.is-success { color: var(--accent-strong); font-weight: 700; }
    .vote-submit {
      min-height: 32px;
      border: 0;
      border-radius: 8px;
      background: var(--accent);
      color: white;
      padding: 7px 11px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 8px 20px rgba(15, 118, 110, .20);
      white-space: normal;
      text-align: center;
    }
    .vote-submit:hover:not(:disabled) { background: var(--accent-strong); }
    .vote-submit:disabled { opacity: .58; cursor: default; box-shadow: none; }
    .vote-empty {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 24px;
      color: var(--muted);
      box-shadow: var(--shadow);
    }
    @media (max-width: 780px) {
      .vote-shell { width: min(100vw - 18px, 1080px); padding: 10px 0 22px; }
      .vote-header { grid-template-columns: 1fr; padding: 10px; }
      .vote-header h1 { font-size: 1.42rem; }
      .vote-date-header {
        display: grid;
        align-items: start;
      }
      .vote-date-progress {
        width: fit-content;
      }
      .vote-card-main-grid { grid-template-columns: 1fr; }
      .vote-card-main-grid {
        grid-template-rows: auto;
        grid-template-areas:
          "side"
          "content"
          "remark";
      }
      .vote-card-side {
        border-left: 0;
        border-top: 1px solid var(--line);
      }
      .vote-card-aside-remark {
        border-left: 0;
        border-top: 1px solid var(--line);
        padding: 8px 10px;
      }
      .vote-card-aside-remark .vote-remark {
        grid-template-rows: none;
        height: auto;
        padding-top: 0;
        border-top: 0;
      }
      .vote-card-aside-remark .vote-remark textarea {
        height: 38px;
      }
      .vote-card-header,
      .vote-actions {
        display: grid;
        justify-items: stretch;
      }
      .vote-chip { justify-self: start; }
      .vote-mode,
      .vote-special-fields { grid-template-columns: 1fr; }
      .vote-proposal-day,
      .vote-day-controls,
      .vote-day-segments { grid-template-columns: 1fr; }
      .vote-submit { width: 100%; }
    }
    @media (max-width: 520px) {
      .vote-shell { width: min(100vw - 14px, 1080px); }
      .vote-header { gap: 8px; margin-bottom: 8px; }
      .vote-summary small,
      .vote-viewer-line,
      .vote-card h2,
      .vote-slot strong {
        overflow-wrap: anywhere;
      }
      .vote-card-header,
      .vote-card-content,
      .vote-card-side,
      .vote-card-aside-remark,
      .vote-actions {
        padding-left: 10px;
        padding-right: 10px;
      }
      .vote-choice,
      .vote-proposal,
      .vote-special-toggle,
      .vote-only-availability {
        padding: 7px;
      }
      .vote-proposal-head {
        display: grid;
        justify-items: start;
      }
      .vote-date-progress,
      .vote-chip,
      .vote-period-count {
        white-space: normal;
      }
    }
  </style>
</head>
<body>
  <div class="vote-shell">
    <header class="vote-header">
      <div class="vote-header-main">
        <span class="vote-kicker">Lien personnel</span>
        <h1>Votes coordination ${normalizedYear}</h1>
        <p id="vote-viewer" class="vote-viewer-line">V&eacute;rification du lien personnel.</p>
      </div>
      <aside class="vote-summary" aria-label="Resume des votes">
        <strong id="vote-count">0 / 0 r&eacute;ponses</strong>
        <span id="vote-progress-text">Chargement des votes.</span>
        <div class="vote-progress" aria-hidden="true"><span id="vote-progress-fill"></span></div>
        <small>Campagne ${escapeHtml(campaignId || '')}</small>
      </aside>
    </header>
    <main id="vote-root" class="vote-list" aria-live="polite"></main>
  </div>
  ${STATIC_VOTE_BOOTSTRAP_PLACEHOLDER}
  <script>
    (function () {
      var bootstrap = window.__STATIC_VOTE_BOOTSTRAP__ || {};
      var groups = Array.isArray(bootstrap.groups) ? bootstrap.groups : [];
      var submittedTpiIds = new Set(Array.isArray(bootstrap.submittedTpiIds) ? bootstrap.submittedTpiIds : []);
      var root = document.getElementById('vote-root');
      var viewer = document.getElementById('vote-viewer');
      var countLabel = document.getElementById('vote-count');
      var progressText = document.getElementById('vote-progress-text');
      var progressFill = document.getElementById('vote-progress-fill');
      var DEFAULT_MAX_PROPOSALS = 3;

      function escapeText(value) {
        return String(value == null ? '' : value);
      }

      function createTextElement(tagName, className, text) {
        var node = document.createElement(tagName);
        if (className) {
          node.className = className;
        }
        node.textContent = escapeText(text);
        return node;
      }

      function pluralize(count, singular, plural) {
        return count > 1 ? plural : singular;
      }

      function getGroupTpiId(group) {
        return group && group.tpi ? String(group.tpi.id || '') : '';
      }

      function getTpiCandidateName(group) {
        return group && group.tpi && group.tpi.candidateName
          ? group.tpi.candidateName
          : 'ce candidat';
      }

      function getFixedSlot(group) {
        return group && group.fixedSlot ? group.fixedSlot : {};
      }

      function getFixedDateKey(group) {
        var slot = getFixedSlot(group);
        return String(slot.date || slot.dateLabel || slot.label || 'date-inconnue');
      }

      function getFixedDateLabel(group) {
        var slot = getFixedSlot(group);
        var label = slot.dateLabel || slot.label || '';
        if (label.indexOf(' | ') !== -1) {
          label = label.split(' | ')[0];
        }
        return label || 'Date à confirmer';
      }

      function getFixedSlotSortValue(group) {
        var slot = getFixedSlot(group);
        var start = String(slot.startTime || '');
        var match = start.match(/^(\\d{1,2})(?::(\\d{2}))?/);
        if (match) {
          var hour = Number.parseInt(match[1], 10);
          var minute = Number.parseInt(match[2] || '0', 10);
          if (Number.isFinite(hour) && Number.isFinite(minute)) {
            return (hour * 60) + minute;
          }
        }

        var period = Number.parseInt(String(slot.period || ''), 10);
        return Number.isFinite(period) ? period * 100 : Number.MAX_SAFE_INTEGER;
      }

      function getFixedPeriodKey(group) {
        var slot = getFixedSlot(group);
        var start = String(slot.startTime || '');
        var match = start.match(/^(\\d{1,2})(?::(\\d{2}))?/);
        if (match) {
          var hour = Number.parseInt(match[1], 10);
          if (Number.isFinite(hour)) {
            return hour < 12 ? 'AM' : 'PM';
          }
        }

        var period = Number.parseInt(String(slot.period || ''), 10);
        if (Number.isFinite(period)) {
          return period <= 4 ? 'AM' : 'PM';
        }

        return 'UNKNOWN';
      }

      function getFixedPeriodLabel(periodKey) {
        if (periodKey === 'AM') {
          return 'Matin';
        }
        if (periodKey === 'PM') {
          return 'Après-midi';
        }
        return 'Horaire à confirmer';
      }

      function getFixedSlotTitle(slot) {
        if (slot && slot.startTime && slot.endTime) {
          return slot.startTime + ' - ' + slot.endTime;
        }

        if (slot && slot.dateLabel) {
          return slot.dateLabel;
        }

        return slot && slot.label ? slot.label : 'Créneau';
      }

      function buildVoteDateGroups(voteGroups) {
        var byDate = new Map();

        (Array.isArray(voteGroups) ? voteGroups : [])
          .map(function (group, index) {
            return { group: group, index: index };
          })
          .sort(function (left, right) {
            var leftDate = getFixedDateKey(left.group);
            var rightDate = getFixedDateKey(right.group);
            if (leftDate !== rightDate) {
              return leftDate.localeCompare(rightDate, 'fr');
            }

            var leftTime = getFixedSlotSortValue(left.group);
            var rightTime = getFixedSlotSortValue(right.group);
            if (leftTime !== rightTime) {
              return leftTime - rightTime;
            }

            return getTpiCandidateName(left.group).localeCompare(getTpiCandidateName(right.group), 'fr');
          })
          .forEach(function (entry) {
            var key = getFixedDateKey(entry.group);
            if (!byDate.has(key)) {
              byDate.set(key, {
                key: key,
                label: getFixedDateLabel(entry.group),
                entries: []
              });
            }
            byDate.get(key).entries.push(entry);
          });

        return Array.from(byDate.values());
      }

      function buildVotePeriodGroups(entries) {
        var order = ['AM', 'PM', 'UNKNOWN'];
        var byPeriod = new Map();

        (Array.isArray(entries) ? entries : []).forEach(function (entry) {
          var key = getFixedPeriodKey(entry.group);
          if (!byPeriod.has(key)) {
            byPeriod.set(key, {
              key: key,
              label: getFixedPeriodLabel(key),
              entries: []
            });
          }
          byPeriod.get(key).entries.push(entry);
        });

        return Array.from(byPeriod.values()).sort(function (left, right) {
          return order.indexOf(left.key) - order.indexOf(right.key);
        });
      }

      function isSubmitted(group) {
        var tpiId = getGroupTpiId(group);
        return tpiId ? submittedTpiIds.has(tpiId) : false;
      }

      function updateDateGroupSummaries() {
        Array.from(root.querySelectorAll('[data-date-group-key]')).forEach(function (section) {
          var total = section.querySelectorAll('.vote-card').length;
          var completed = section.querySelectorAll('.vote-card.is-submitted').length;
          var remaining = Math.max(total - completed, 0);
          var progress = section.querySelector('[data-date-progress]');
          if (progress) {
            progress.textContent = completed + ' / ' + total + ' ' + pluralize(total, 'réponse transmise', 'réponses transmises');
            progress.classList.toggle('is-complete', total > 0 && remaining === 0);
          }
        });
      }

      function setViewer() {
        var name = bootstrap.viewer && bootstrap.viewer.name ? bootstrap.viewer.name : '';
        viewer.textContent = name
          ? 'Lien vérifié pour ' + name
          : 'Lien personnel valide.';
      }

      function updateSummary() {
        var total = groups.length;
        var completed = groups.reduce(function (count, group) {
          return count + (isSubmitted(group) ? 1 : 0);
        }, 0);
        var remaining = Math.max(total - completed, 0);
        var percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        if (countLabel) {
          countLabel.textContent = total > 0
            ? completed + ' / ' + total + ' ' + pluralize(total, 'réponse', 'réponses')
            : 'Aucun vote';
        }

        if (progressText) {
          progressText.textContent = total === 0
            ? 'Aucun vote ouvert pour ce lien.'
            : remaining === 0
              ? 'Toutes les réponses sont transmises.'
              : remaining + ' ' + pluralize(remaining, 'réponse restante', 'réponses restantes') + '.';
        }

        if (progressFill) {
          progressFill.style.width = percent + '%';
        }
        updateDateGroupSummaries();
      }

      function buildSubmitUrl() {
        var url = new URL(window.location.href);
        url.searchParams.set('action', 'submit');
        return url.toString();
      }

      function createSlotNode(slot, variant) {
        var node = document.createElement('div');
        node.className = 'vote-slot' + (variant ? ' ' + variant : '');

        var title = createTextElement(
          'strong',
          '',
          getFixedSlotTitle(slot)
        );
        var meta = document.createElement('div');
        meta.className = 'vote-slot-meta';

        [
          slot && slot.roomName ? slot.roomName : '',
          slot && slot.period ? 'Période ' + slot.period : ''
        ].filter(Boolean).forEach(function (item) {
          meta.append(createTextElement('span', '', item));
        });

        node.append(title);
        if (meta.children.length) {
          node.append(meta);
        }
        return node;
      }

      function getMaxProposals(group) {
        var value = group && group.voteSettings
          ? Number.parseInt(String(group.voteSettings.maxProposalsPerTpi || ''), 10)
          : DEFAULT_MAX_PROPOSALS;

        return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_PROPOSALS;
      }

      function getCardMaxProposals(card) {
        var value = Number.parseInt(card.dataset.maxProposals || String(DEFAULT_MAX_PROPOSALS), 10);
        return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_PROPOSALS;
      }

      function getProposalLimitMessage(maxProposals) {
        return 'Maximum ' + maxProposals + ' demi-journée' + (maxProposals > 1 ? 's' : '') + ' par réponse.';
      }

      function isSpecialRequestAllowed(group) {
        return !(group && group.voteSettings && group.voteSettings.allowSpecialRequest === false);
      }

      function getProposalDateLabel(option) {
        var slot = option && option.slot ? option.slot : {};
        var label = slot.dateLabel || slot.label || 'Date possible';
        return String(label).indexOf(' | ') !== -1 ? String(label).split(' | ')[0] : label;
      }

      function getProposalDateKey(option) {
        var slot = option && option.slot ? option.slot : {};
        return slot.date || getProposalDateLabel(option);
      }

      function normalizeProposalPeriodKey(option) {
        var display = option && option.display ? option.display : {};
        var slot = option && option.slot ? option.slot : {};
        var rawPeriod = String(display.windowPeriod || display.periodLabel || slot.period || '').toLowerCase();

        if (rawPeriod.indexOf('pm') !== -1 || rawPeriod.indexOf('après') !== -1 || rawPeriod.indexOf('apres') !== -1) {
          return 'PM';
        }

        if (rawPeriod.indexOf('am') !== -1 || rawPeriod.indexOf('matin') !== -1) {
          return 'AM';
        }

        var startMatch = String(slot.startTime || '').match(/^(\d{1,2})(?::(\d{2}))?/);
        if (startMatch) {
          var hour = Number.parseInt(startMatch[1], 10);
          if (Number.isFinite(hour)) {
            return hour < 12 ? 'AM' : 'PM';
          }
        }

        var numericPeriod = Number.parseInt(String(slot.period || ''), 10);
        if (Number.isFinite(numericPeriod)) {
          return numericPeriod <= 4 ? 'AM' : 'PM';
        }

        return 'AM';
      }

      function getProposalPeriodShortLabel(option) {
        return normalizeProposalPeriodKey(option) === 'PM' ? 'Après-midi' : 'Matin';
      }

      function getProposalPeriodLabel(option) {
        var display = option && option.display ? option.display : {};
        var slot = option && option.slot ? option.slot : {};
        var period = display.periodLabel || (display.windowPeriod === 'PM' ? 'Après-midi' : '');
        var timeRange = display.timeRangeLabel || (
          slot.startTime && slot.endTime ? slot.startTime + ' - ' + slot.endTime : ''
        );
        var details = [
          period || (slot.period ? 'Période ' + slot.period : ''),
          timeRange
        ].filter(Boolean).join(' | ');

        return details || 'Demi-journée';
      }

      function getProposalQueueLabel(option) {
        var queue = option && option.queue ? option.queue : {};
        var count = Number(queue.count);
        if (!Number.isFinite(count) || count < 0) {
          return '';
        }

        var capacity = Number(queue.capacity);
        return Number.isFinite(capacity) && capacity > 0
          ? Math.floor(count) + '/' + Math.floor(capacity)
          : String(Math.floor(count));
      }

      function getProposalLoadInfo(option) {
        var queue = option && option.queue ? option.queue : {};
        var count = Number(queue.count);
        var capacity = Number(queue.capacity);

        if (!Number.isFinite(count) || count < 0) {
          return { tone: 'neutral', label: '', title: '' };
        }

        var normalizedCount = Math.floor(count);
        var normalizedCapacity = Number.isFinite(capacity) && capacity > 0 ? Math.floor(capacity) : null;
        var ratio = normalizedCapacity ? normalizedCount / normalizedCapacity : 0;

        if (normalizedCapacity && ratio >= .8) {
          return {
            tone: 'busy',
            label: 'Très demandé',
            title: 'Indicateur de génération: beaucoup de préférences pointaient déjà vers cette demi-journée.'
          };
        }

        if (normalizedCapacity && ratio >= .5) {
          return {
            tone: 'medium',
            label: 'Déjà demandé',
            title: 'Indicateur de génération: plusieurs préférences pointaient déjà vers cette demi-journée.'
          };
        }

        if (normalizedCount > 0 || normalizedCapacity) {
          return {
            tone: 'easy',
            label: 'Peu demandé',
            title: 'Indicateur de génération: peu de préférences pointaient vers cette demi-journée.'
          };
        }

        return { tone: 'neutral', label: '', title: '' };
      }

      function buildProposalDayGroups(options) {
        var groupsByDay = new Map();

        (Array.isArray(options) ? options : []).forEach(function (option) {
          var dayKey = getProposalDateKey(option);
          if (!dayKey) {
            return;
          }

          if (!groupsByDay.has(dayKey)) {
            groupsByDay.set(dayKey, {
              dayKey: dayKey,
              label: getProposalDateLabel(option),
              options: {}
            });
          }

          var group = groupsByDay.get(dayKey);
          var periodKey = normalizeProposalPeriodKey(option);
          if (!group.options[periodKey]) {
            group.options[periodKey] = option;
          }
        });

        return Array.from(groupsByDay.values());
      }

      function updateProposalCounter(card) {
        var counter = card.querySelector('[data-proposal-count]');
        if (!counter) {
          return;
        }

        var selectedCount = card.querySelectorAll('input[data-proposal-slot]:checked').length;
        var maxProposals = getCardMaxProposals(card);
        counter.textContent = selectedCount + '/' + maxProposals + ' demi-journées';
        counter.classList.toggle('is-limit', selectedCount >= maxProposals);
      }

      function enforceProposalLimit(card, changedInput) {
        if (
          !changedInput ||
          !changedInput.matches ||
          !changedInput.matches('input[data-proposal-slot]') ||
          !changedInput.checked
        ) {
          return false;
        }

        var maxProposals = getCardMaxProposals(card);
        var selected = Array.from(card.querySelectorAll('input[data-proposal-slot]:checked'));
        if (selected.length <= maxProposals) {
          return false;
        }

        changedInput.checked = false;
        setStatus(card, getProposalLimitMessage(maxProposals), 'error');
        return true;
      }

      function getProposalInputsForDay(card, dayKey) {
        return Array.from(card.querySelectorAll('input[data-proposal-slot]'))
          .filter(function (input) { return (input.dataset.dayKey || '') === dayKey; });
      }

      function getSelectedProposalCountOutsideDay(card, dayKey) {
        return Array.from(card.querySelectorAll('input[data-proposal-slot]:checked'))
          .filter(function (input) { return (input.dataset.dayKey || '') !== dayKey; })
          .length;
      }

      function getDesiredDayPeriodKeys(dayInputs, periodKey) {
        if (periodKey === 'FULL') {
          return dayInputs.map(function (input) { return input.dataset.periodKey || ''; }).filter(Boolean);
        }

        return dayInputs.some(function (input) { return (input.dataset.periodKey || '') === periodKey; })
          ? [periodKey]
          : [];
      }

      function hasExactDaySelection(dayInputs, desiredPeriodKeys) {
        var desired = desiredPeriodKeys.slice().sort().join('|');
        var current = dayInputs
          .filter(function (input) { return input.checked; })
          .map(function (input) { return input.dataset.periodKey || ''; })
          .filter(Boolean)
          .sort()
          .join('|');
        return desired === current;
      }

      function handleProposalDayToggle(card, button) {
        if (!button || button.disabled) {
          return '';
        }

        var dayKey = button.dataset.dayKey || '';
        var periodKey = button.dataset.dayToggle || '';
        var dayInputs = getProposalInputsForDay(card, dayKey);
        var desiredPeriodKeys = getDesiredDayPeriodKeys(dayInputs, periodKey);

        if (desiredPeriodKeys.length === 0) {
          return '';
        }

        if (hasExactDaySelection(dayInputs, desiredPeriodKeys)) {
          desiredPeriodKeys = [];
        }

        var maxProposals = getCardMaxProposals(card);
        var nextCount = getSelectedProposalCountOutsideDay(card, dayKey) + desiredPeriodKeys.length;
        if (nextCount > maxProposals) {
          setStatus(card, getProposalLimitMessage(maxProposals), 'error');
          return 'blocked';
        }

        dayInputs.forEach(function (input) {
          input.checked = desiredPeriodKeys.indexOf(input.dataset.periodKey || '') !== -1;
        });

        if (desiredPeriodKeys.length === 0) {
          Array.from(card.querySelectorAll('input[data-only-availability]'))
            .filter(function (input) { return (input.dataset.dayKey || '') === dayKey; })
            .forEach(function (input) { input.checked = false; });
        }

        return 'changed';
      }

      function getCardState(card) {
        var modeInput = card.querySelector('input[name="' + card.dataset.groupName + '-mode"]:checked');
        var mode = modeInput ? modeInput.value : '';
        var proposedSlotIds = Array.from(card.querySelectorAll('input[data-proposal-slot]:checked'))
          .map(function (input) { return input.value; });
        var onlyAvailabilitySlotIds = [];
        Array.from(card.querySelectorAll('input[data-only-availability]:checked'))
          .forEach(function (input) {
            var dayKey = input.dataset.dayKey || '';
            Array.from(card.querySelectorAll('input[data-proposal-slot]:checked'))
              .filter(function (slotInput) { return (slotInput.dataset.dayKey || '') === dayKey; })
              .forEach(function (slotInput) {
                if (slotInput.value && onlyAvailabilitySlotIds.indexOf(slotInput.value) === -1) {
                  onlyAvailabilitySlotIds.push(slotInput.value);
                }
              });
          });
        var specialEnabled = Boolean(card.querySelector('input[data-special-enabled]:checked'));
        var reason = card.querySelector('[data-special-reason]');
        var date = card.querySelector('[data-special-date]');
        var remark = card.querySelector('[data-vote-remark]');

        return {
          mode: mode,
          proposedSlotIds: proposedSlotIds,
          onlyAvailabilitySlotIds: onlyAvailabilitySlotIds,
          remark: remark ? remark.value.trim() : '',
          specialRequest: specialEnabled ? {
            reason: reason ? reason.value.trim() : '',
            requestedDate: date ? date.value : ''
          } : null
        };
      }

      function setStatus(card, text, kind) {
        var status = card.querySelector('[data-status]');
        if (!status) {
          return;
        }
        status.textContent = text || '';
        status.className = 'vote-status' + (kind ? ' is-' + kind : '');
      }

      function clearProposalState(card) {
        Array.from(card.querySelectorAll('input[data-proposal-slot], input[data-special-enabled], input[data-only-availability]'))
          .forEach(function (input) {
            input.checked = false;
          });

        Array.from(card.querySelectorAll('[data-special-date], [data-special-reason]'))
          .forEach(function (field) {
            field.value = '';
          });
      }

      function clearProposalFields(card) {
        Array.from(card.querySelectorAll('input[data-proposal-slot], input[data-only-availability]'))
          .forEach(function (input) {
            input.checked = false;
          });
      }

      function updateChoiceClasses(card) {
        var specialFields = card.querySelector('[data-special-fields]');
        var specialInput = card.querySelector('input[data-special-enabled]');
        var specialEnabled = Boolean(specialInput && specialInput.checked);
        var checkedOnlyInputs = Array.from(card.querySelectorAll('input[data-only-availability]:checked'));
        var activeOnlyInput = checkedOnlyInputs.length > 0 ? checkedOnlyInputs[checkedOnlyInputs.length - 1] : null;
        var activeOnlyDayKey = activeOnlyInput ? activeOnlyInput.dataset.dayKey || '' : '';

        if (specialEnabled) {
          clearProposalFields(card);
        }

        Array.from(card.querySelectorAll('input[data-only-availability]'))
          .forEach(function (input) {
            if (input !== activeOnlyInput) {
              input.checked = false;
            }
          });

        if (activeOnlyDayKey) {
          Array.from(card.querySelectorAll('input[data-proposal-slot]'))
            .forEach(function (input) {
              if ((input.dataset.dayKey || '') !== activeOnlyDayKey) {
                input.checked = false;
              }
            });
        }

        Array.from(card.querySelectorAll('input[data-proposal-slot]'))
          .forEach(function (input) {
            var disabledByExclusive = Boolean(activeOnlyDayKey) && (input.dataset.dayKey || '') !== activeOnlyDayKey;
            if (specialEnabled || disabledByExclusive) {
              input.checked = false;
            }
          });

        Array.from(card.querySelectorAll('input[data-only-availability]'))
          .forEach(function (input) {
            var dayKey = input.dataset.dayKey || '';
            var selectedInDay = Array.from(card.querySelectorAll('input[data-proposal-slot]:checked'))
              .some(function (slotInput) { return (slotInput.dataset.dayKey || '') === dayKey; });
            var disabledByExclusive = Boolean(activeOnlyDayKey) && dayKey !== activeOnlyDayKey;
            input.disabled = specialEnabled || disabledByExclusive || !selectedInDay;
            if (input.disabled) {
              input.checked = false;
            }
          });

        if (activeOnlyInput && !activeOnlyInput.checked) {
          activeOnlyDayKey = '';
        }

        var selectedProposalCount = card.querySelectorAll('input[data-proposal-slot]:checked').length;
        var maxProposals = getCardMaxProposals(card);
        Array.from(card.querySelectorAll('input[data-proposal-slot]'))
          .forEach(function (input) {
            var disabledByExclusive = Boolean(activeOnlyDayKey) && (input.dataset.dayKey || '') !== activeOnlyDayKey;
            var disabledByLimit = selectedProposalCount >= maxProposals && !input.checked;
            input.disabled = specialEnabled || disabledByExclusive || disabledByLimit;
          });

        Array.from(card.querySelectorAll('[data-day-toggle]'))
          .forEach(function (button) {
            var dayKey = button.dataset.dayKey || '';
            var periodKey = button.dataset.dayToggle || '';
            var dayInputs = getProposalInputsForDay(card, dayKey);
            var desiredPeriodKeys = getDesiredDayPeriodKeys(dayInputs, periodKey);
            var isMissing = periodKey === 'FULL' ? dayInputs.length < 2 : desiredPeriodKeys.length === 0;
            var isSelected = !isMissing && hasExactDaySelection(dayInputs, desiredPeriodKeys);
            var disabledByExclusive = Boolean(activeOnlyDayKey) && dayKey !== activeOnlyDayKey;
            var disabledByLimit = !isSelected &&
              getSelectedProposalCountOutsideDay(card, dayKey) + desiredPeriodKeys.length > maxProposals;

            button.disabled = specialEnabled || disabledByExclusive || isMissing || disabledByLimit;
            button.classList.toggle('is-selected', isSelected);
          });

        Array.from(card.querySelectorAll('.vote-choice, .vote-special-toggle, .vote-only-availability'))
          .forEach(function (label) {
            var input = label.querySelector('input');
            label.classList.toggle('is-selected', Boolean(input && input.checked));
            label.classList.toggle('is-disabled', !input || Boolean(input.disabled));
          });

        Array.from(card.querySelectorAll('.vote-proposal-day'))
          .forEach(function (dayNode) {
            dayNode.classList.toggle('has-selection', Boolean(
              dayNode.querySelector('input[data-proposal-slot]:checked, input[data-only-availability]:checked')
            ));
          });

        if (specialFields) {
          specialFields.hidden = !specialEnabled;
        }
        updateProposalCounter(card);
      }

      function syncModeState(card) {
        var state = getCardState(card);
        var proposalArea = card.querySelector('[data-proposal-area]');
        var specialArea = card.querySelector('[data-special-area]');
        var showProposal = state.mode === 'proposal';

        if (proposalArea) {
          proposalArea.hidden = !showProposal;
        }
        if (specialArea) {
          specialArea.hidden = !showProposal;
        }
        if (!showProposal) {
          clearProposalState(card);
        }
      }

      function collapseSubmittedCard(card, group, justSubmitted) {
        card.className = 'vote-card is-submitted is-sent-compact' + (justSubmitted ? ' is-just-sent' : '');
        card.setAttribute('aria-disabled', 'true');
        card.textContent = '';

        var sent = document.createElement('section');
        sent.className = 'vote-sent';
        sent.setAttribute('role', 'status');
        var badge = createTextElement('span', 'vote-sent-badge', 'OK');
        var copy = document.createElement('div');
        copy.append(
          createTextElement('strong', '', 'Réponse transmise'),
          createTextElement(
            'p',
            '',
            'Vos informations pour le TPI de ' + getTpiCandidateName(group) +
              ' ont été transmises. Il n’est plus possible de les modifier.'
          )
        );
        sent.append(copy, badge);
        card.append(sent);
      }

      function isAlreadySubmittedError(response, data) {
        if (!response || response.status !== 409) {
          return false;
        }

        var message = String(data && data.error ? data.error : '').toLowerCase();
        return message.indexOf('deja transmis') !== -1 || message.indexOf('déjà transmis') !== -1;
      }

      async function submitGroup(card, group) {
        if (card.classList.contains('is-submitted')) {
          return;
        }

        var state = getCardState(card);

        if (state.mode !== 'ok' && state.mode !== 'proposal') {
          setStatus(card, 'Choisissez une réponse avant de transmettre.', 'error');
          return;
        }

        if (state.mode === 'proposal' && state.proposedSlotIds.length === 0 && !state.specialRequest) {
          setStatus(card, 'Choisissez une date proposée ou une demande spéciale hors liste.', 'error');
          return;
        }

        var maxProposals = getCardMaxProposals(card);
        if (state.mode === 'proposal' && state.proposedSlotIds.length > maxProposals) {
          setStatus(card, getProposalLimitMessage(maxProposals), 'error');
          return;
        }

        if (state.mode === 'proposal' && state.specialRequest && state.proposedSlotIds.length > 0) {
          setStatus(card, 'La demande spéciale hors liste remplace les dates proposées.', 'error');
          return;
        }

        if (state.onlyAvailabilitySlotIds.length > 0 && state.onlyAvailabilitySlotIds.some(function (slotId) { return state.proposedSlotIds.indexOf(slotId) === -1; })) {
          setStatus(card, 'La seule disponibilité doit correspondre à une demi-journée cochée.', 'error');
          return;
        }

        if (state.specialRequest && (!state.specialRequest.reason || !state.specialRequest.requestedDate)) {
          setStatus(card, 'La demande spéciale hors liste exige une date et une raison.', 'error');
          return;
        }

        var submitButton = card.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Transmission...';
        setStatus(card, 'Transmission en cours...', '');

        try {
          var response = await fetch(buildSubmitUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              campaignId: bootstrap.campaignId,
              tpiId: group.tpi.id,
              fixedVoteId: group.fixedVoteId,
              mode: state.mode,
              proposedSlotIds: state.mode === 'proposal' && !state.specialRequest ? state.proposedSlotIds : [],
              onlyAvailabilitySlotIds: state.mode === 'proposal' && !state.specialRequest ? state.onlyAvailabilitySlotIds : [],
              remark: state.remark,
              specialRequest: state.mode === 'proposal' ? state.specialRequest : null
            })
          });
          var data = await response.json().catch(function () { return {}; });

          if (isAlreadySubmittedError(response, data)) {
            submittedTpiIds.add(getGroupTpiId(group));
            collapseSubmittedCard(card, group, true);
            updateSummary();
            return;
          }

          if (!response.ok || data.success !== true) {
            throw new Error(data.error || 'Réponse refusée.');
          }

          submittedTpiIds.add(getGroupTpiId(group));
          collapseSubmittedCard(card, group, true);
          updateSummary();
        } catch (error) {
          submitButton.disabled = false;
          submitButton.textContent = 'Transmettre';
          setStatus(card, error && error.message ? error.message : 'Erreur lors de la transmission.', 'error');
        }
      }

      function createModeChoice(card, value, title, description) {
        var label = document.createElement('label');
        label.className = 'vote-choice';
        label.title = description;
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = card.dataset.groupName + '-mode';
        input.value = value;
        var copy = document.createElement('span');
        copy.append(createTextElement('strong', '', title));
        if (description) {
          copy.append(createTextElement('small', '', description));
        }
        label.append(input, copy);
        return label;
      }

      function createSvgElement(tagName, attrs) {
        var node = document.createElementNS('http://www.w3.org/2000/svg', tagName);
        Object.keys(attrs || {}).forEach(function (key) {
          node.setAttribute(key, attrs[key]);
        });
        return node;
      }

      function createPeriodIcon(kind) {
        var svg = createSvgElement('svg', {
          viewBox: '0 0 24 24',
          fill: 'none',
          'stroke-width': '2',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'aria-hidden': 'true',
          focusable: 'false'
        });

        if (kind === 'PM') {
          svg.append(
            createSvgElement('path', { d: 'M4 18h16' }),
            createSvgElement('path', { d: 'M6 16a6 6 0 0 1 12 0' }),
            createSvgElement('path', { d: 'M12 10V6' }),
            createSvgElement('path', { d: 'M8.5 11.5 6 9' }),
            createSvgElement('path', { d: 'm15.5 11.5 2.5-2.5' })
          );
        } else if (kind === 'FULL') {
          svg.append(
            createSvgElement('circle', { cx: '8', cy: '8', r: '3' }),
            createSvgElement('path', { d: 'M8 1v2' }),
            createSvgElement('path', { d: 'M8 13v2' }),
            createSvgElement('path', { d: 'M1 8h2' }),
            createSvgElement('path', { d: 'M13 8h2' }),
            createSvgElement('path', { d: 'M14 18h7' }),
            createSvgElement('path', { d: 'M15 16a3 3 0 0 1 5 0' })
          );
        } else {
          svg.append(
            createSvgElement('circle', { cx: '12', cy: '12', r: '4' }),
            createSvgElement('path', { d: 'M12 2v2' }),
            createSvgElement('path', { d: 'M12 20v2' }),
            createSvgElement('path', { d: 'M4.93 4.93 6.34 6.34' }),
            createSvgElement('path', { d: 'm17.66 17.66 1.41 1.41' }),
            createSvgElement('path', { d: 'M2 12h2' }),
            createSvgElement('path', { d: 'M20 12h2' }),
            createSvgElement('path', { d: 'm6.34 17.66-1.41 1.41' }),
            createSvgElement('path', { d: 'm19.07 4.93-1.41 1.41' })
          );
        }

        var wrap = document.createElement('span');
        wrap.className = 'vote-period-icon';
        wrap.append(svg);
        return wrap;
      }

      function createProposalPeriodInput(option, dayKey, periodKey) {
        var input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'vote-proposal-input';
        input.dataset.proposalSlot = 'true';
        input.dataset.dayKey = dayKey;
        input.dataset.periodKey = periodKey;
        input.value = escapeText(option && option.slotId ? option.slotId : '');
        input.tabIndex = -1;
        input.setAttribute('aria-hidden', 'true');
        return input;
      }

      function createProposalPeriodMeta(option) {
        var loadInfo = getProposalLoadInfo(option);
        var queueLabel = getProposalQueueLabel(option);
        var meta = document.createElement('span');
        meta.className = 'vote-proposal-meta';
        if (loadInfo.label || queueLabel) {
          if (loadInfo.label) {
            meta.append(createTextElement('span', 'vote-load-chip vote-load-' + loadInfo.tone, loadInfo.label));
          }
          if (queueLabel) {
            meta.append(createTextElement('span', 'vote-queue-chip', queueLabel));
          }
        }

        return meta.children.length ? meta : null;
      }

      function createProposalPeriodButton(dayGroup, periodKey) {
        var option = periodKey === 'FULL' ? null : dayGroup.options[periodKey];
        var hasBothPeriods = Boolean(dayGroup.options.AM && dayGroup.options.PM);
        var disabled = periodKey === 'FULL' ? !hasBothPeriods : !option;
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'vote-period-button' + (option ? ' vote-load-' + getProposalLoadInfo(option).tone : '');
        button.dataset.dayToggle = periodKey;
        button.dataset.dayKey = dayGroup.dayKey;
        if (disabled) {
          button.disabled = true;
        }
        button.title = periodKey === 'FULL'
          ? hasBothPeriods
            ? 'Sélectionner matin et après-midi.'
            : 'Journée complète non disponible.'
          : option
            ? [getProposalPeriodLabel(option), getProposalLoadInfo(option).title].filter(Boolean).join('\\n')
            : (periodKey === 'PM' ? 'Après-midi non publié.' : 'Matin non publié.');

        var copy = document.createElement('span');
        copy.append(createPeriodIcon(periodKey));
        copy.append(createTextElement('strong', '', periodKey === 'FULL' ? 'Journée' : getProposalPeriodShortLabel(option || { display: { windowPeriod: periodKey } })));

        if (option) {
          var meta = createProposalPeriodMeta(option);
          if (meta) {
            copy.append(meta);
          }
        }

        button.append(copy);
        return button;
      }

      function createProposalDayOptionGroup(dayGroup) {
        var row = document.createElement('article');
        row.className = 'vote-proposal-day';
        var title = document.createElement('h4');
        title.textContent = dayGroup.label || 'Date possible';
        var controls = document.createElement('div');
        controls.className = 'vote-day-controls';
        var hiddenInputs = document.createElement('div');
        hiddenInputs.className = 'vote-day-hidden-options';
        var segments = document.createElement('div');
        segments.className = 'vote-day-segments';

        ['AM', 'PM'].forEach(function (periodKey) {
          if (dayGroup.options[periodKey]) {
            hiddenInputs.append(createProposalPeriodInput(dayGroup.options[periodKey], dayGroup.dayKey, periodKey));
          }
        });
        segments.append(
          createProposalPeriodButton(dayGroup, 'AM'),
          createProposalPeriodButton(dayGroup, 'PM'),
          createProposalPeriodButton(dayGroup, 'FULL')
        );

        var onlyLabel = document.createElement('label');
        onlyLabel.className = 'vote-only-availability vote-unique-toggle';
        onlyLabel.title = 'À cocher si les périodes choisies ce jour sont vos seules disponibilités.';
        var onlyInput = document.createElement('input');
        onlyInput.type = 'checkbox';
        onlyInput.dataset.onlyAvailability = 'true';
        onlyInput.dataset.dayKey = dayGroup.dayKey;
        var onlyCopy = document.createElement('span');
        onlyCopy.append(createTextElement('strong', '', 'Unique'));
        onlyLabel.append(onlyInput, onlyCopy);
        controls.append(hiddenInputs, segments, onlyLabel);
        row.append(title, controls);
        return row;
      }

      function renderGroup(group, index) {
        var card = document.createElement('form');
        card.className = 'vote-card';
        card.dataset.groupName = 'vote-' + index;
        card.dataset.maxProposals = String(getMaxProposals(group));

        if (isSubmitted(group)) {
          collapseSubmittedCard(card, group, false);
          return card;
        }

        var header = document.createElement('div');
        header.className = 'vote-card-header';
        var titleBlock = document.createElement('div');
        titleBlock.append(createTextElement('span', 'vote-reference', group.tpi && group.tpi.reference ? group.tpi.reference : 'TPI'));
        var title = document.createElement('h2');
        title.textContent = group.tpi && group.tpi.candidateName ? group.tpi.candidateName : 'Candidat non renseigné';
        var subject = document.createElement('p');
        subject.textContent = group.tpi && group.tpi.subject ? group.tpi.subject : 'Sujet non renseigné';
        titleBlock.append(title, subject);
        var meta = document.createElement('div');
        meta.className = 'vote-card-meta';
        [
          group.tpi && group.tpi.classe ? group.tpi.classe : '',
          group.tpi && group.tpi.site ? group.tpi.site : ''
        ].filter(Boolean).forEach(function (item) {
          meta.append(createTextElement('span', '', item));
        });
        if (meta.children.length) {
          titleBlock.append(meta);
        }
        var chip = document.createElement('span');
        chip.className = 'vote-chip';
        chip.dataset.chip = 'true';
        chip.textContent = 'À traiter';
        header.append(titleBlock, chip);

        var fixedSection = document.createElement('section');
        fixedSection.className = 'vote-section';
        var fixedTitle = document.createElement('h3');
        fixedTitle.textContent = 'Créneau proposé';
        fixedSection.append(fixedTitle, createSlotNode(group.fixedSlot, 'is-fixed'));

        var decisionSection = document.createElement('section');
        decisionSection.className = 'vote-section';
        var decisionTitle = document.createElement('h3');
        decisionTitle.textContent = 'Votre réponse';

        var mode = document.createElement('div');
        mode.className = 'vote-mode';
        mode.append(
          createModeChoice(card, 'ok', 'Garder ce créneau', 'La date proposée convient.'),
          createModeChoice(card, 'proposal', 'Demander un autre créneau', 'Choisir une demi-journée ou une demande hors liste.')
        );
        decisionSection.append(decisionTitle, mode);

        var proposalSection = document.createElement('section');
        proposalSection.className = 'vote-section vote-details';
        proposalSection.dataset.proposalArea = 'true';
        proposalSection.hidden = true;
        var proposalHead = document.createElement('div');
        proposalHead.className = 'vote-proposal-head';
        var proposalTitle = document.createElement('h3');
        proposalTitle.className = 'vote-proposal-title';
        proposalTitle.textContent = 'Créneaux alternatifs';
        var proposalCount = document.createElement('span');
        proposalCount.className = 'vote-proposal-count';
        proposalCount.dataset.proposalCount = 'true';
        proposalHead.append(proposalTitle, proposalCount);
        var proposalList = document.createElement('div');
        proposalList.className = 'vote-proposals';
        buildProposalDayGroups(group.proposalOptions || []).forEach(function (dayGroup) {
          proposalList.append(createProposalDayOptionGroup(dayGroup));
        });
        if (!proposalList.children.length) {
          var emptyProposal = document.createElement('p');
          emptyProposal.className = 'vote-empty-note';
          emptyProposal.textContent = 'Aucune option publiée.';
          emptyProposal.title = 'Utilisez une demande hors liste si nécessaire.';
          proposalList.append(emptyProposal);
        }
        proposalSection.append(proposalHead, proposalList);

        var special = document.createElement('section');
        special.className = 'vote-section vote-special vote-details';
        special.dataset.specialArea = 'true';
        special.hidden = true;
        var specialLabel = document.createElement('label');
        specialLabel.className = 'vote-special-toggle';
        specialLabel.title = 'Demande spéciale hors liste: remplace les dates proposées.';
        var specialInput = document.createElement('input');
        specialInput.type = 'checkbox';
        specialInput.dataset.specialEnabled = 'true';
        var specialCopy = document.createElement('span');
        specialCopy.append(createTextElement('strong', '', 'Hors liste'));
        specialLabel.append(specialInput, specialCopy);
        var specialFields = document.createElement('div');
        specialFields.className = 'vote-special-fields';
        specialFields.dataset.specialFields = 'true';
        specialFields.hidden = true;
        var specialDate = document.createElement('input');
        specialDate.type = 'date';
        specialDate.dataset.specialDate = 'true';
        specialDate.setAttribute('aria-label', 'Date souhaitée');
        var specialReason = document.createElement('textarea');
        specialReason.dataset.specialReason = 'true';
        specialReason.rows = 1;
        specialReason.placeholder = 'Contrainte ou raison';
        specialReason.setAttribute('aria-label', 'Contrainte ou raison');
        specialFields.append(specialDate, specialReason);
        special.append(specialLabel, specialFields);

        var remark = document.createElement('section');
        remark.className = 'vote-section vote-remark';
        var remarkLabel = createTextElement('label', '', 'Remarque');
        remarkLabel.title = 'Message général optionnel pour l’administration.';
        var remarkId = card.dataset.groupName + '-remark';
        remarkLabel.setAttribute('for', remarkId);
        var remarkField = document.createElement('textarea');
        remarkField.id = remarkId;
        remarkField.dataset.voteRemark = 'true';
        remarkField.rows = 2;
        remarkField.placeholder = 'Optionnel';
        remarkField.setAttribute('aria-label', 'Remarque générale optionnelle');
        remark.append(remarkLabel, remarkField);

        var actions = document.createElement('div');
        actions.className = 'vote-actions';
        var status = document.createElement('span');
        status.dataset.status = 'true';
        status.className = 'vote-status';
        status.setAttribute('role', 'status');
        status.textContent = '';
        var button = document.createElement('button');
        button.className = 'vote-submit';
        button.type = 'submit';
        button.textContent = 'Transmettre';
        button.disabled = false;
        actions.append(status, button);

        var mainGrid = document.createElement('div');
        mainGrid.className = 'vote-card-main-grid';
        var content = document.createElement('div');
        content.className = 'vote-card-content';
        var side = document.createElement('aside');
        side.className = 'vote-card-side';
        side.setAttribute('aria-label', 'Créneau proposé');
        side.append(fixedSection);
        var asideRemark = document.createElement('div');
        asideRemark.className = 'vote-card-aside-remark';
        asideRemark.append(remark);

        if (isSpecialRequestAllowed(group)) {
          content.append(decisionSection, proposalSection, special);
        } else {
          content.append(decisionSection, proposalSection);
        }
        mainGrid.append(side, content, asideRemark);
        card.append(header, mainGrid, actions);
        card.addEventListener('click', function (event) {
          var toggle = event.target && event.target.closest
            ? event.target.closest('[data-day-toggle]')
            : null;
          if (!toggle || !card.contains(toggle) || card.classList.contains('is-submitted')) {
            return;
          }

          event.preventDefault();
          var toggleResult = handleProposalDayToggle(card, toggle);
          if (!toggleResult) {
            return;
          }

          syncModeState(card);
          updateChoiceClasses(card);
          if (card.querySelector('[data-status].is-error') && toggleResult !== 'blocked') {
            setStatus(card, '', '');
          }
        });
        card.addEventListener('change', function (event) {
          if (card.classList.contains('is-submitted')) {
            return;
          }
          var limitReached = enforceProposalLimit(card, event.target);
          syncModeState(card);
          updateChoiceClasses(card);
          if (card.querySelector('[data-status].is-error') && !limitReached) {
            setStatus(card, '', '');
          }
        });
        card.addEventListener('submit', function (event) {
          event.preventDefault();
          submitGroup(card, group);
        });
        syncModeState(card);
        updateChoiceClasses(card);

        return card;
      }

      function createVoteDateGroupNode(dateGroup) {
        var section = document.createElement('section');
        section.className = 'vote-date-group';
        section.dataset.dateGroupKey = dateGroup.key;

        var header = document.createElement('header');
        header.className = 'vote-date-header';
        var title = createTextElement('h2', '', dateGroup.label);
        var progress = createTextElement('span', 'vote-date-progress', '');
        progress.dataset.dateProgress = 'true';
        header.append(title, progress);

        var cards = document.createElement('div');
        cards.className = 'vote-date-cards';

        section.append(header, cards);
        return section;
      }

      function createVotePeriodGroupNode(periodGroup) {
        var section = document.createElement('section');
        section.className = 'vote-period-group';
        section.dataset.periodGroupKey = periodGroup.key;

        var header = document.createElement('header');
        header.className = 'vote-period-header';
        header.append(
          createTextElement('span', '', periodGroup.label),
          createTextElement('span', 'vote-period-count', periodGroup.entries.length + ' TPI')
        );

        var cards = document.createElement('div');
        cards.className = 'vote-period-cards';
        periodGroup.entries.forEach(function (entry) {
          cards.append(renderGroup(entry.group, entry.index));
        });

        section.append(header, cards);
        return section;
      }

      function render() {
        setViewer();
        updateSummary();
        root.textContent = '';

        if (!groups.length) {
          var empty = document.createElement('div');
          empty.className = 'vote-empty';
          empty.textContent = 'Les demandes de modification d’horaires ne sont plus possibles.';
          root.append(empty);
          return;
        }

        buildVoteDateGroups(groups).forEach(function (dateGroup) {
          var node = createVoteDateGroupNode(dateGroup);
          var cards = node.querySelector('.vote-date-cards');
          if (cards) {
            cards.textContent = '';
            buildVotePeriodGroups(dateGroup.entries).forEach(function (periodGroup) {
              cards.append(createVotePeriodGroupNode(periodGroup));
            });
          }
          root.append(node);
        });
        updateSummary();
      }

      render();
    })();
  </script>
  <script type="application/json" id="static-vote-debug">${serializeJsonForHtml({
    year: normalizedYear,
    generatedAt,
    campaignId,
    groupCount: groups.length
  })}</script>
</body>
</html>`
}

function buildStaticVotePhp({ html, year, campaignPayload, accessLinks = [] }) {
  const normalizedYear = parseYear(year)

  const phpPreamble = `<?php
declare(strict_types=1);

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Robots-Tag: noindex, nofollow');

$staticVoteAccessLinks = json_decode(<<<'STATIC_VOTE_ACCESS_JSON'
${serializeJsonForPhp(Array.isArray(accessLinks) ? accessLinks : [])}
STATIC_VOTE_ACCESS_JSON, true) ?: [];

$staticVotePayload = json_decode(<<<'STATIC_VOTE_PAYLOAD_JSON'
${serializeJsonForPhp(campaignPayload || { year: normalizedYear, groups: [] })}
STATIC_VOTE_PAYLOAD_JSON, true) ?: [];

function staticVoteText($value): string
{
    if ($value === null) {
        return '';
    }

    if (is_scalar($value)) {
        return trim((string) $value);
    }

    return '';
}

function staticVoteUnavailable(int $statusCode, string $title, string $message): void
{
    http_response_code($statusCode);
    header('Content-Type: text/html; charset=utf-8');
    $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $safeMessage = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>' . $safeTitle . '</title><style>:root{font-family:Inter,Segoe UI,Arial,sans-serif;color:#172033;background:#f5f7fb;--muted:#526071;--line:#d8dee8;--accent:#0f766e;--accent-soft:#e7f5f1;--info:#1d4ed8;--info-soft:#eaf2ff}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(180deg,#eaf1f4 0,#f8fafc 220px,#f5f7fb 100%)}main{width:min(560px,calc(100vw - 32px));display:grid;gap:14px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:28px;box-shadow:0 24px 70px rgba(23,32,51,.10)}.kicker{display:inline-flex;width:fit-content;min-height:28px;align-items:center;padding:4px 10px;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-size:.82rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase}h1{margin:0;font-size:1.62rem;line-height:1.12;letter-spacing:0}p{margin:0;color:var(--muted);line-height:1.55}.status{padding:12px;border-left:4px solid var(--info);background:var(--info-soft);color:var(--muted);line-height:1.45}</style></head><body><main><span class="kicker">Votes coordination ${normalizedYear}</span><h1>' . $safeTitle . '</h1><p>' . $safeMessage . '</p><p class="status">Aucun vote n&#039;est affiche depuis cette adresse sans validation du lien nominatif.</p></main></body></html>';
    exit;
}

function staticVoteJson(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    exit;
}

function staticVoteDataDir(): string
{
    $dir = __DIR__ . DIRECTORY_SEPARATOR . 'data';

    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }

    $htaccess = $dir . DIRECTORY_SEPARATOR . '.htaccess';
    if (!file_exists($htaccess)) {
        file_put_contents($htaccess, "Require all denied\\nDeny from all\\n");
    }

    return $dir;
}

function staticVoteRecordsPath(): string
{
    return staticVoteDataDir() . DIRECTORY_SEPARATOR . 'votes.jsonl';
}

function staticVoteReadRecords(): array
{
    $path = staticVoteRecordsPath();

    if (!file_exists($path)) {
        return [];
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        return [];
    }

    $records = [];
    foreach ($lines as $line) {
        $record = json_decode($line, true);
        if (is_array($record)) {
            $records[] = $record;
        }
    }

    return $records;
}

function staticVoteFindExistingRecordInList(array $records, string $tokenHash, string $campaignId, string $tpiId): ?array
{
    foreach ($records as $record) {
        if (
            is_array($record) &&
            staticVoteText($record['tokenHash'] ?? '') === $tokenHash &&
            staticVoteText($record['campaignId'] ?? '') === $campaignId &&
            staticVoteText($record['tpiId'] ?? '') === $tpiId
        ) {
            return $record;
        }
    }

    return null;
}

function staticVoteAppendUniqueRecord(array $record, string $tokenHash, string $campaignId, string $tpiId): ?array
{
    $dir = staticVoteDataDir();
    $lockPath = $dir . DIRECTORY_SEPARATOR . 'votes.lock';
    $lockHandle = fopen($lockPath, 'c');

    if ($lockHandle === false) {
        staticVoteJson(500, ['success' => false, 'error' => 'Verrouillage impossible.']);
    }

    if (!flock($lockHandle, LOCK_EX)) {
        fclose($lockHandle);
        staticVoteJson(500, ['success' => false, 'error' => 'Verrouillage impossible.']);
    }

    $existingSubmission = staticVoteFindExistingRecordInList(
        staticVoteReadRecords(),
        $tokenHash,
        $campaignId,
        $tpiId
    );

    if ($existingSubmission !== null) {
        flock($lockHandle, LOCK_UN);
        fclose($lockHandle);
        return $existingSubmission;
    }

    $encoded = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if (!is_string($encoded) || $encoded === '') {
        flock($lockHandle, LOCK_UN);
        fclose($lockHandle);
        staticVoteJson(500, ['success' => false, 'error' => 'Enregistrement impossible.']);
    }

    $written = file_put_contents(staticVoteRecordsPath(), $encoded . PHP_EOL, FILE_APPEND);

    flock($lockHandle, LOCK_UN);
    fclose($lockHandle);

    if ($written === false) {
        staticVoteJson(500, ['success' => false, 'error' => 'Enregistrement impossible.']);
    }

    return null;
}

function staticVoteFindAccessEntry(array $accessLinks, string $tokenHash): ?array
{
    foreach ($accessLinks as $entry) {
        if (!is_array($entry)) {
            continue;
        }

        $candidateHash = staticVoteText($entry['hash'] ?? '');
        if ($candidateHash !== '' && hash_equals($candidateHash, $tokenHash)) {
            return $entry;
        }
    }

    return null;
}

function staticVoteFilteredGroups(array $payload, array $accessEntry): array
{
    $personId = staticVoteText($accessEntry['personId'] ?? '');
    $scope = isset($accessEntry['scope']) && is_array($accessEntry['scope']) ? $accessEntry['scope'] : [];
    $scopeTpiId = staticVoteText($scope['tpiId'] ?? ($scope['tpiPlanningId'] ?? ''));
    $groups = isset($payload['groups']) && is_array($payload['groups']) ? $payload['groups'] : [];
    $filtered = [];

    foreach ($groups as $group) {
        if (!is_array($group)) {
            continue;
        }

        $groupTpi = isset($group['tpi']) && is_array($group['tpi']) ? $group['tpi'] : [];
        $groupTpiId = staticVoteText($groupTpi['id'] ?? '');

        if (
            staticVoteText($group['personId'] ?? '') === $personId &&
            ($scopeTpiId === '' || $groupTpiId === $scopeTpiId)
        ) {
            $filtered[] = $group;
        }
    }

    return $filtered;
}

function staticVoteFindGroup(array $groups, string $tpiId, string $fixedVoteId): ?array
{
    foreach ($groups as $group) {
        if (!is_array($group)) {
            continue;
        }

        $groupTpi = isset($group['tpi']) && is_array($group['tpi']) ? $group['tpi'] : [];
        if (staticVoteText($groupTpi['id'] ?? '') === $tpiId && staticVoteText($group['fixedVoteId'] ?? '') === $fixedVoteId) {
            return $group;
        }
    }

    return null;
}

function staticVoteAllowedProposalSlotIds(array $group): array
{
    $ids = [];
    $options = isset($group['proposalOptions']) && is_array($group['proposalOptions']) ? $group['proposalOptions'] : [];

    foreach ($options as $option) {
        if (is_array($option)) {
            $slotId = staticVoteText($option['slotId'] ?? '');
            if ($slotId !== '') {
                $ids[$slotId] = true;
            }
        }
    }

    return $ids;
}

function staticVoteSubmittedTpiIds(string $tokenHash, string $campaignId): array
{
    $ids = [];

    foreach (staticVoteReadRecords() as $record) {
        if (staticVoteText($record['tokenHash'] ?? '') !== $tokenHash) {
            continue;
        }

        if ($campaignId !== '' && staticVoteText($record['campaignId'] ?? '') !== $campaignId) {
            continue;
        }

        $tpiId = staticVoteText($record['tpiId'] ?? '');
        if ($tpiId !== '') {
            $ids[$tpiId] = true;
        }
    }

    return array_values(array_keys($ids));
}

function staticVoteFindExistingSubmission(string $tokenHash, string $campaignId, string $tpiId): ?array
{
    return staticVoteFindExistingRecordInList(staticVoteReadRecords(), $tokenHash, $campaignId, $tpiId);
}

function staticVoteRandomId(string $tokenHash, string $tpiId): string
{
    try {
        $random = bin2hex(random_bytes(12));
    } catch (Throwable $error) {
        $random = uniqid('', true);
    }

    return hash('sha256', $tokenHash . '|' . $tpiId . '|' . microtime(true) . '|' . $random);
}

function staticVoteHandleSubmit(array $payload, array $accessEntry, string $tokenHash): void
{
    $rawBody = file_get_contents('php://input');
    $body = json_decode(is_string($rawBody) ? $rawBody : '', true);

    if (!is_array($body)) {
        staticVoteJson(400, ['success' => false, 'error' => 'Payload invalide.']);
    }

    $mode = strtolower(staticVoteText($body['mode'] ?? ''));
    $tpiId = staticVoteText($body['tpiId'] ?? '');
    $fixedVoteId = staticVoteText($body['fixedVoteId'] ?? '');
    $campaignId = staticVoteText($payload['campaignId'] ?? '');
    $bodyCampaignId = staticVoteText($body['campaignId'] ?? '');

    if ($campaignId !== '' && $bodyCampaignId !== '' && $campaignId !== $bodyCampaignId) {
        staticVoteJson(409, ['success' => false, 'error' => 'Campagne obsolète.']);
    }

    if ($mode !== 'ok' && $mode !== 'proposal') {
        staticVoteJson(400, ['success' => false, 'error' => 'Mode invalide.']);
    }

    $groups = staticVoteFilteredGroups($payload, $accessEntry);
    $group = staticVoteFindGroup($groups, $tpiId, $fixedVoteId);
    if ($group === null) {
        staticVoteJson(403, ['success' => false, 'error' => 'Vote hors scope du lien.']);
    }

    $voteSettings = isset($group['voteSettings']) && is_array($group['voteSettings'])
        ? $group['voteSettings']
        : [];
    $maxProposals = isset($voteSettings['maxProposalsPerTpi']) ? (int) $voteSettings['maxProposalsPerTpi'] : 3;
    if ($maxProposals < 1) {
        $maxProposals = 3;
    }
    $allowSpecialRequest = !isset($voteSettings['allowSpecialRequest']) || $voteSettings['allowSpecialRequest'] !== false;

    $rawProposedSlotIds = isset($body['proposedSlotIds']) && is_array($body['proposedSlotIds'])
        ? $body['proposedSlotIds']
        : [];
    $rawOnlyAvailabilitySlotIds = isset($body['onlyAvailabilitySlotIds']) && is_array($body['onlyAvailabilitySlotIds'])
        ? $body['onlyAvailabilitySlotIds']
        : [];
    $allowedProposalSlotIds = staticVoteAllowedProposalSlotIds($group);
    $proposedSlotIds = [];
    $onlyAvailabilitySlotIds = [];

    foreach ($rawProposedSlotIds as $slotId) {
        $slotId = staticVoteText($slotId);
        if ($slotId === '') {
            continue;
        }

        if (!isset($allowedProposalSlotIds[$slotId])) {
            staticVoteJson(400, ['success' => false, 'error' => 'Creneau alternatif invalide.']);
        }

        if (!in_array($slotId, $proposedSlotIds, true)) {
            $proposedSlotIds[] = $slotId;
        }
    }

    foreach ($rawOnlyAvailabilitySlotIds as $slotId) {
        $slotId = staticVoteText($slotId);
        if ($slotId === '') {
            continue;
        }

        if (!isset($allowedProposalSlotIds[$slotId])) {
            staticVoteJson(400, ['success' => false, 'error' => 'Seule disponibilite invalide.']);
        }

        if (!in_array($slotId, $onlyAvailabilitySlotIds, true)) {
            $onlyAvailabilitySlotIds[] = $slotId;
        }
    }

    $specialRequest = isset($body['specialRequest']) && is_array($body['specialRequest'])
        ? $body['specialRequest']
        : null;
    $specialReason = $specialRequest ? staticVoteText($specialRequest['reason'] ?? '') : '';
    $specialDate = $specialRequest ? staticVoteText($specialRequest['requestedDate'] ?? '') : '';
    $hasSpecialRequest = $specialReason !== '' || $specialDate !== '';
    $hardConstraint = isset($body['hardConstraint']) && $body['hardConstraint'] === true;
    $remark = staticVoteText($body['remark'] ?? '');
    if (strlen($remark) > 2000) {
        $remark = substr($remark, 0, 2000);
    }

    if ($mode === 'ok' && (count($proposedSlotIds) > 0 || $hasSpecialRequest || $hardConstraint)) {
        staticVoteJson(400, ['success' => false, 'error' => 'Le mode OK ne permet pas de proposition.']);
    }

    if (count($proposedSlotIds) > $maxProposals) {
        staticVoteJson(400, ['success' => false, 'error' => 'Trop de demi-journees proposees.']);
    }

    if ($hasSpecialRequest && !$allowSpecialRequest) {
        staticVoteJson(400, ['success' => false, 'error' => 'La demande hors liste est desactivee pour cette annee.']);
    }

    if ($hardConstraint && count($proposedSlotIds) > 0) {
        staticVoteJson(400, ['success' => false, 'error' => 'Ce choix indique qu aucune date proposee n est possible.']);
    }

    if ($hardConstraint && $hasSpecialRequest) {
        staticVoteJson(400, ['success' => false, 'error' => 'La contrainte dure ne peut pas etre combinee avec une demande speciale.']);
    }

    if ($hasSpecialRequest && count($proposedSlotIds) > 0) {
        staticVoteJson(400, ['success' => false, 'error' => 'La demande speciale hors liste remplace les dates proposees.']);
    }

    foreach ($onlyAvailabilitySlotIds as $slotId) {
        if (!in_array($slotId, $proposedSlotIds, true)) {
            staticVoteJson(400, ['success' => false, 'error' => 'La seule disponibilite doit correspondre a une demi-journee cochee.']);
        }
    }

    if ($mode === 'proposal' && count($proposedSlotIds) === 0 && !$hasSpecialRequest && !$hardConstraint) {
        staticVoteJson(400, ['success' => false, 'error' => 'Choisissez un creneau ou une demande speciale.']);
    }

    if ($hasSpecialRequest && ($specialReason === '' || $specialDate === '')) {
        staticVoteJson(400, ['success' => false, 'error' => 'Demande speciale incomplete.']);
    }

    if ($mode === 'ok') {
        $onlyAvailabilitySlotIds = [];
    }

    $existingSubmission = staticVoteFindExistingSubmission($tokenHash, $campaignId, $tpiId);
    if ($existingSubmission !== null) {
        staticVoteJson(409, [
            'success' => false,
            'error' => 'Vote deja transmis pour ce TPI.',
            'id' => staticVoteText($existingSubmission['id'] ?? ''),
        ]);
    }

    $record = [
        'id' => staticVoteRandomId($tokenHash, $tpiId),
        'source' => 'static_vote_php',
        'year' => ${normalizedYear},
        'campaignId' => $campaignId,
        'personId' => staticVoteText($accessEntry['personId'] ?? ''),
        'personName' => staticVoteText($accessEntry['name'] ?? ''),
        'tpiId' => $tpiId,
        'tpiReference' => isset($group['tpi']) && is_array($group['tpi'])
            ? staticVoteText($group['tpi']['reference'] ?? '')
            : '',
        'fixedVoteId' => $fixedVoteId,
        'fixedSlot' => isset($group['fixedSlot']) && is_array($group['fixedSlot']) ? $group['fixedSlot'] : null,
        'mode' => $mode,
        'proposedSlotIds' => $proposedSlotIds,
        'proposalOptions' => isset($group['proposalOptions']) && is_array($group['proposalOptions'])
            ? $group['proposalOptions']
            : [],
        'onlyAvailabilitySlotIds' => $onlyAvailabilitySlotIds,
        'hardConstraint' => $hardConstraint,
        'remark' => $remark,
        'specialRequest' => $hasSpecialRequest ? [
            'reason' => $specialReason,
            'requestedDate' => $specialDate,
        ] : null,
        'submittedAt' => gmdate('c'),
        'tokenHash' => $tokenHash,
    ];

    $existingSubmission = staticVoteAppendUniqueRecord($record, $tokenHash, $campaignId, $tpiId);
    if ($existingSubmission !== null) {
        staticVoteJson(409, [
            'success' => false,
            'error' => 'Vote deja transmis pour ce TPI.',
            'id' => staticVoteText($existingSubmission['id'] ?? ''),
        ]);
    }

    staticVoteJson(200, ['success' => true, 'id' => $record['id'], 'submittedAt' => $record['submittedAt']]);
}

$staticVoteToken = isset($_GET['ml']) && is_string($_GET['ml']) ? trim($_GET['ml']) : '';
if ($staticVoteToken === '' || strlen($staticVoteToken) < 32 || strlen($staticVoteToken) > 256) {
    staticVoteUnavailable(403, 'Lien requis', 'Le vote coordination est accessible uniquement avec un lien personnel.');
}

$staticVoteTokenHash = hash('sha256', $staticVoteToken);
$staticVoteAccessEntry = staticVoteFindAccessEntry($staticVoteAccessLinks, $staticVoteTokenHash);

if ($staticVoteAccessEntry === null) {
    staticVoteUnavailable(403, 'Acces refuse', 'Ce lien ne donne pas acces au vote coordination.');
}

$staticVoteExpiresAt = isset($staticVoteAccessEntry['expiresAt']) && is_string($staticVoteAccessEntry['expiresAt'])
    ? strtotime($staticVoteAccessEntry['expiresAt'])
    : false;

if ($staticVoteExpiresAt !== false && $staticVoteExpiresAt <= time()) {
    staticVoteUnavailable(410, 'Lien expire', 'Ce lien de vote a expire.');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = isset($_GET['action']) && is_string($_GET['action']) ? trim($_GET['action']) : '';
    if ($action === 'submit') {
        staticVoteHandleSubmit($staticVotePayload, $staticVoteAccessEntry, $staticVoteTokenHash);
    }

    staticVoteJson(404, ['success' => false, 'error' => 'Action inconnue.']);
}

$staticVoteViewer = [
    'personId' => $staticVoteAccessEntry['personId'] ?? null,
    'name' => $staticVoteAccessEntry['name'] ?? null,
    'email' => $staticVoteAccessEntry['email'] ?? null,
];
$staticVoteBrowserPayload = $staticVotePayload;
$staticVoteBrowserPayload['viewer'] = $staticVoteViewer;
$staticVoteBrowserPayload['groups'] = staticVoteFilteredGroups($staticVotePayload, $staticVoteAccessEntry);
$staticVoteBrowserPayload['submittedTpiIds'] = staticVoteSubmittedTpiIds(
    $staticVoteTokenHash,
    staticVoteText($staticVotePayload['campaignId'] ?? '')
);
$staticVoteBootstrap = '<script>window.__STATIC_VOTE_BOOTSTRAP__=' .
    json_encode($staticVoteBrowserPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) .
    ';</script>';
?>
`

  return `${phpPreamble}${html.replace(
    STATIC_VOTE_BOOTSTRAP_PLACEHOLDER,
    '<?php echo $staticVoteBootstrap; ?>'
  )}`
}

function buildStaticVoteArbitragePhp({ year, tokenSecret }) {
  const normalizedYear = parseYear(year)

  return `<?php
declare(strict_types=1);

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Robots-Tag: noindex, nofollow');

$staticVoteArbitrageSecret = json_decode(<<<'STATIC_VOTE_ARBITRAGE_SECRET_JSON'
${serializeJsonForPhp(compactText(tokenSecret))}
STATIC_VOTE_ARBITRAGE_SECRET_JSON, true);

function arbitrageText($value): string
{
    if ($value === null) {
        return '';
    }

    if (is_scalar($value)) {
        return trim((string) $value);
    }

    return '';
}

function arbitrageEscape($value): string
{
    return htmlspecialchars(arbitrageText($value), ENT_QUOTES, 'UTF-8');
}

function arbitrageBase64UrlDecode(string $value): string
{
    $base64 = strtr($value, '-_', '+/');
    $padding = strlen($base64) % 4;
    if ($padding > 0) {
        $base64 .= str_repeat('=', 4 - $padding);
    }

    $decoded = base64_decode($base64, true);
    return is_string($decoded) ? $decoded : '';
}

function arbitrageUnavailable(int $statusCode, string $title, string $message): void
{
    http_response_code($statusCode);
    header('Content-Type: text/html; charset=utf-8');
    $safeTitle = arbitrageEscape($title);
    $safeMessage = arbitrageEscape($message);
    echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>' . $safeTitle . '</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7f9;color:#172033;font-family:Inter,Arial,sans-serif}main{width:min(560px,calc(100vw - 32px));background:#fff;border:1px solid #d8dee8;border-radius:8px;padding:28px;box-shadow:0 20px 60px rgba(23,32,51,.08)}h1{margin:0 0 10px;font-size:1.45rem}p{margin:0;color:#526071;line-height:1.55}</style></head><body><main><h1>' . $safeTitle . '</h1><p>' . $safeMessage . '</p></main></body></html>';
    exit;
}

function arbitrageDataDir(): string
{
    $dir = __DIR__ . DIRECTORY_SEPARATOR . 'data';

    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }

    $htaccess = $dir . DIRECTORY_SEPARATOR . '.htaccess';
    if (!file_exists($htaccess)) {
        file_put_contents($htaccess, "Require all denied\\nDeny from all\\n");
    }

    return $dir;
}

function arbitrageRecordsPath(): string
{
    return arbitrageDataDir() . DIRECTORY_SEPARATOR . 'arbitrages.jsonl';
}

function arbitrageReadRecords(): array
{
    $path = arbitrageRecordsPath();

    if (!file_exists($path)) {
        return [];
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        return [];
    }

    $records = [];
    foreach ($lines as $line) {
        $record = json_decode($line, true);
        if (is_array($record)) {
            $records[] = $record;
        }
    }

    return $records;
}

function arbitrageFindExistingRecord(string $tokenHash): ?array
{
    foreach (arbitrageReadRecords() as $record) {
        if (arbitrageText($record['tokenHash'] ?? '') === $tokenHash) {
            return $record;
        }
    }

    return null;
}

function arbitrageAppendRecord(array $record, string $tokenHash): ?array
{
    $dir = arbitrageDataDir();
    $lockPath = $dir . DIRECTORY_SEPARATOR . 'arbitrages.lock';
    $lockHandle = fopen($lockPath, 'c');

    if ($lockHandle === false) {
        arbitrageUnavailable(500, 'Enregistrement impossible', 'Le verrouillage de la réponse a échoué.');
    }

    if (!flock($lockHandle, LOCK_EX)) {
        fclose($lockHandle);
        arbitrageUnavailable(500, 'Enregistrement impossible', 'Le verrouillage de la réponse a échoué.');
    }

    $existing = arbitrageFindExistingRecord($tokenHash);
    if ($existing !== null) {
        flock($lockHandle, LOCK_UN);
        fclose($lockHandle);
        return $existing;
    }

    $encoded = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $written = is_string($encoded) && $encoded !== ''
        ? file_put_contents(arbitrageRecordsPath(), $encoded . PHP_EOL, FILE_APPEND)
        : false;

    flock($lockHandle, LOCK_UN);
    fclose($lockHandle);

    if ($written === false) {
        arbitrageUnavailable(500, 'Enregistrement impossible', 'La réponse n’a pas pu être sauvegardée.');
    }

    return null;
}

function arbitrageDecodeToken(string $token, string $secret): array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3 || $parts[0] !== 'svra') {
        return [];
    }

    $body = $parts[1];
    $signature = arbitrageBase64UrlDecode($parts[2]);
    $expected = hash_hmac('sha256', $body, $secret, true);
    if ($signature === '' || !hash_equals($expected, $signature)) {
        return [];
    }

    $compressed = arbitrageBase64UrlDecode($body);
    $json = $compressed !== '' ? gzinflate($compressed) : false;
    if (!is_string($json)) {
        return [];
    }

    $payload = json_decode($json, true);
    return is_array($payload) ? $payload : [];
}

function arbitrageRender(array $proposal, string $tokenHash, ?array $existing = null, string $error = ''): void
{
    header('Content-Type: text/html; charset=utf-8');
    $alreadySubmitted = is_array($existing);
    $decision = $alreadySubmitted ? arbitrageText($existing['decision'] ?? '') : '';
    $statusLabel = $decision === 'accepted'
        ? 'Accord confirmé'
        : ($decision === 'rejected' ? 'Refus transmis' : 'Réponse attendue');
    $reference = arbitrageEscape($proposal['tpiReference'] ?? 'TPI');
    $candidate = arbitrageEscape($proposal['candidateName'] ?? '');
    $subject = arbitrageEscape($proposal['subject'] ?? '');
    $slot = arbitrageEscape($proposal['proposedSlotLabel'] ?? '');
    $message = arbitrageEscape($proposal['message'] ?? '');
    $name = arbitrageEscape($proposal['recipientName'] ?? ($proposal['name'] ?? ''));
    $role = arbitrageEscape($proposal['roleLabel'] ?? '');
    $safeError = arbitrageEscape($error);
    echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Arbitrage TPI ${normalizedYear}</title><style>:root{font-family:Inter,Segoe UI,Arial,sans-serif;color:#172033;background:#f4f6f8;--line:#d8dee8;--muted:#526071;--accent:#0f766e;--danger:#b42318}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(180deg,#eef4f2 0,#f7f8fa 230px,#f4f6f8 100%)}main{width:min(760px,calc(100vw - 28px));margin:0 auto;padding:18px 0 34px}.panel{display:grid;gap:16px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:22px;box-shadow:0 18px 50px rgba(23,32,51,.08)}.kicker{display:inline-flex;width:fit-content;min-height:26px;align-items:center;padding:3px 10px;border-radius:999px;background:#e7f5f1;color:#0b5e57;font-weight:800;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em}h1{margin:0;font-size:1.45rem;letter-spacing:0}.meta{display:grid;gap:8px;padding:12px;border:1px solid var(--line);border-radius:8px;background:#fbfcfe}.row{display:grid;grid-template-columns:150px minmax(0,1fr);gap:8px}.row span:first-child{color:var(--muted);font-weight:700}.message{padding:12px;border-left:4px solid var(--accent);background:#f8fcfb;color:#243044;line-height:1.5}.alert{padding:12px;border-radius:8px;border:1px solid #fecaca;background:#fff1f0;color:var(--danger);font-weight:700}.success{padding:12px;border-radius:8px;border:1px solid #bbf7d0;background:#f0fdf4;color:#166534;font-weight:800}.choices{display:grid;gap:8px}.choice{display:flex;gap:8px;align-items:flex-start;padding:12px;border:1px solid var(--line);border-radius:8px;background:#fff}.choice input{margin-top:3px;accent-color:var(--accent)}textarea{width:100%;min-height:82px;resize:vertical;border:1px solid var(--line);border-radius:8px;padding:10px;font:inherit}button{min-height:40px;border:0;border-radius:8px;background:var(--accent);color:#fff;font-weight:800;padding:9px 14px;cursor:pointer}button:hover{background:#0b5e57}.muted{color:var(--muted);line-height:1.45}@media(max-width:620px){.row{grid-template-columns:1fr}}</style></head><body><main><section class="panel"><span class="kicker">Arbitrage TPI ${normalizedYear}</span><h1>' . $reference . '</h1>';
    if ($name !== '' || $role !== '') {
        echo '<p class="muted">' . trim($name . ($role !== '' ? ' · ' . $role : '')) . '</p>';
    }
    echo '<div class="meta"><div class="row"><span>Candidat</span><strong>' . $candidate . '</strong></div><div class="row"><span>Sujet</span><span>' . $subject . '</span></div><div class="row"><span>Créneau proposé</span><strong>' . $slot . '</strong></div></div>';
    if ($message !== '') {
        echo '<div class="message">' . nl2br($message) . '</div>';
    }
    if ($safeError !== '') {
        echo '<div class="alert">' . $safeError . '</div>';
    }
    if ($alreadySubmitted) {
        echo '<div class="success">' . arbitrageEscape($statusLabel) . '</div>';
        if (arbitrageText($existing['reason'] ?? '') !== '') {
            echo '<p class="muted"><strong>Raison:</strong> ' . arbitrageEscape($existing['reason']) . '</p>';
        }
        if (arbitrageText($existing['alternativeProposal'] ?? '') !== '') {
            echo '<p class="muted"><strong>Proposition:</strong> ' . arbitrageEscape($existing['alternativeProposal']) . '</p>';
        }
        echo '</section></main></body></html>';
        return;
    }
    echo '<form method="post"><div class="choices"><label class="choice"><input type="radio" name="decision" value="accepted" required><span><strong>J’accepte le créneau proposé</strong><br><span class="muted">L’administration pourra confirmer le TPI sur ce créneau.</span></span></label><label class="choice"><input type="radio" name="decision" value="rejected" required><span><strong>Je refuse ce créneau</strong><br><span class="muted">Une raison est requise. Vous pouvez ajouter une proposition.</span></span></label></div><p><label><strong>Raison du refus</strong><textarea name="reason" placeholder="Obligatoire si refus"></textarea></label></p><p><label><strong>Proposition éventuelle</strong><textarea name="alternativeProposal" placeholder="Créneau ou contrainte à considérer"></textarea></label></p><button type="submit">Transmettre ma réponse</button></form></section></main></body></html>';
}

if (!is_string($staticVoteArbitrageSecret) || trim($staticVoteArbitrageSecret) === '') {
    arbitrageUnavailable(503, 'Arbitrage indisponible', 'Le mini-site n’est pas configuré pour recevoir les arbitrages.');
}

$arbitrageToken = isset($_GET['token']) && is_string($_GET['token']) ? trim($_GET['token']) : '';
if ($arbitrageToken === '' || strlen($arbitrageToken) > 6000) {
    arbitrageUnavailable(403, 'Lien requis', 'Cette page nécessite un lien personnel d’arbitrage.');
}

$arbitragePayload = arbitrageDecodeToken($arbitrageToken, trim($staticVoteArbitrageSecret));
if ($arbitragePayload === [] || (int)($arbitragePayload['year'] ?? 0) !== ${normalizedYear}) {
    arbitrageUnavailable(403, 'Lien invalide', 'Ce lien d’arbitrage est invalide ou ne correspond pas à cette année.');
}

$expiresAt = isset($arbitragePayload['expiresAt']) && is_string($arbitragePayload['expiresAt'])
    ? strtotime($arbitragePayload['expiresAt'])
    : false;
if ($expiresAt !== false && $expiresAt <= time()) {
    arbitrageUnavailable(410, 'Lien expiré', 'Cette proposition d’arbitrage a expiré.');
}

$tokenHash = hash('sha256', $arbitrageToken);
$existingRecord = arbitrageFindExistingRecord($tokenHash);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $existingRecord === null) {
    $decision = strtolower(arbitrageText($_POST['decision'] ?? ''));
    $reason = arbitrageText($_POST['reason'] ?? '');
    $alternativeProposal = arbitrageText($_POST['alternativeProposal'] ?? '');

    if ($decision !== 'accepted' && $decision !== 'rejected') {
        arbitrageRender($arbitragePayload, $tokenHash, null, 'Réponse invalide.');
        exit;
    }

    if ($decision === 'rejected' && $reason === '') {
        arbitrageRender($arbitragePayload, $tokenHash, null, 'Une raison est requise en cas de refus.');
        exit;
    }

    $record = [
        'id' => hash('sha256', $tokenHash . '|' . microtime(true)),
        'source' => 'static_vote_arbitrage_php',
        'year' => ${normalizedYear},
        'tokenHash' => $tokenHash,
        'tpiId' => arbitrageText($arbitragePayload['tpiId'] ?? ''),
        'personId' => arbitrageText($arbitragePayload['personId'] ?? ''),
        'role' => arbitrageText($arbitragePayload['role'] ?? ''),
        'decision' => $decision,
        'reason' => substr($reason, 0, 2000),
        'alternativeProposal' => substr($alternativeProposal, 0, 2000),
        'submittedAt' => gmdate('c'),
    ];

    $existingRecord = arbitrageAppendRecord($record, $tokenHash);
    if ($existingRecord === null) {
        $existingRecord = $record;
    }
}

arbitrageRender($arbitragePayload, $tokenHash, $existingRecord);
`
}

function buildStaticVoteSyncPhp({ year, syncSecret }) {
  const normalizedYear = parseYear(year)

  return `<?php
declare(strict_types=1);

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Robots-Tag: noindex, nofollow');
header('Content-Type: application/json; charset=utf-8');

$staticVoteSyncSecret = json_decode(<<<'STATIC_VOTE_SYNC_SECRET_JSON'
${serializeJsonForPhp(compactText(syncSecret))}
STATIC_VOTE_SYNC_SECRET_JSON, true);

function staticVoteSyncRespond(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (!is_string($staticVoteSyncSecret) || trim($staticVoteSyncSecret) === '') {
    staticVoteSyncRespond(503, ['success' => false, 'error' => 'Synchronisation non configuree.']);
}

$providedSecret = '';
if (isset($_SERVER['HTTP_X_SYNC_SECRET']) && is_string($_SERVER['HTTP_X_SYNC_SECRET'])) {
    $providedSecret = trim($_SERVER['HTTP_X_SYNC_SECRET']);
} elseif (isset($_GET['secret']) && is_string($_GET['secret'])) {
    $providedSecret = trim($_GET['secret']);
}

if ($providedSecret === '' || !hash_equals($staticVoteSyncSecret, $providedSecret)) {
    staticVoteSyncRespond(403, ['success' => false, 'error' => 'Secret invalide.']);
}

$recordsPath = __DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'votes.jsonl';
$records = [];

if (file_exists($recordsPath)) {
    $lines = file($recordsPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (is_array($lines)) {
        foreach ($lines as $line) {
            $record = json_decode($line, true);
            if (is_array($record) && (int)($record['year'] ?? 0) === ${normalizedYear}) {
                $records[] = $record;
            }
        }
    }
}

$arbitrageRecordsPath = __DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'arbitrages.jsonl';
$arbitrageRecords = [];

if (file_exists($arbitrageRecordsPath)) {
    $lines = file($arbitrageRecordsPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (is_array($lines)) {
        foreach ($lines as $line) {
            $record = json_decode($line, true);
            if (is_array($record) && (int)($record['year'] ?? 0) === ${normalizedYear}) {
                $arbitrageRecords[] = $record;
            }
        }
    }
}

staticVoteSyncRespond(200, [
    'success' => true,
    'year' => ${normalizedYear},
    'records' => $records,
    'arbitrageRecords' => $arbitrageRecords,
    'count' => count($records) + count($arbitrageRecords),
    'voteCount' => count($records),
    'arbitrageCount' => count($arbitrageRecords),
]);
`
}

function buildStaticVoteHtaccess() {
  return `Options -Indexes
<FilesMatch "^(votes\\.jsonl|arbitrages\\.jsonl)$">
  Require all denied
  Deny from all
</FilesMatch>
RedirectMatch 403 ^.*/data/.*$
`
}

async function writeStaticVoteAccessFiles({ year, html, campaignPayload }) {
  const normalizedYear = parseYear(year)
  const accessLinks = await listStaticVoteAccessLinks(normalizedYear)
  const syncSecret = getSyncSecret()
  const arbitrageSecret = getArbitrageSecret()

  await fs.promises.writeFile(
    getPhpIndexPath(normalizedYear),
    buildStaticVotePhp({
      html,
      year: normalizedYear,
      campaignPayload,
      accessLinks
    }),
    'utf8'
  )
  await fs.promises.writeFile(
    getSyncPhpPath(normalizedYear),
    buildStaticVoteSyncPhp({
      year: normalizedYear,
      syncSecret
    }),
    'utf8'
  )
  await fs.promises.writeFile(
    getArbitragePhpPath(normalizedYear),
    buildStaticVoteArbitragePhp({
      year: normalizedYear,
      tokenSecret: arbitrageSecret
    }),
    'utf8'
  )
  await fs.promises.writeFile(
    getDeniedIndexPath(normalizedYear),
    buildStaticVoteUnavailableHtml(normalizedYear),
    'utf8'
  )
  await fs.promises.writeFile(
    getHtaccessPath(normalizedYear),
    buildStaticVoteHtaccess(),
    'utf8'
  )

  return {
    accessLinkCount: accessLinks.length,
    arbitrageConfigured: Boolean(arbitrageSecret),
    syncSecretConfigured: Boolean(syncSecret)
  }
}

async function getStaticVotePublicationStatus(year, deploymentConfig = null) {
  const normalizedYear = parseYear(year)
  const resolvedDeploymentConfig = deploymentConfig || await getPublicationDeploymentConfigIfAvailable()
  const phpIndexPath = getPhpIndexPath(normalizedYear)
  const arbitragePhpPath = getArbitragePhpPath(normalizedYear)
  const manifestPath = getManifestPath(normalizedYear)
  const available = fs.existsSync(phpIndexPath)
  const arbitrageAvailable = fs.existsSync(arbitragePhpPath)
  let manifest = {}

  if (available && fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'))
    } catch (error) {
      manifest = {}
    }
  }

  return {
    available,
    year: normalizedYear,
    outputDir: getOutputDir(normalizedYear),
    indexPath: getIndexPath(normalizedYear),
    phpIndexPath,
    syncPhpPath: getSyncPhpPath(normalizedYear),
    arbitragePhpPath,
    arbitrageAvailable,
    deniedIndexPath: getDeniedIndexPath(normalizedYear),
    htaccessPath: getHtaccessPath(normalizedYear),
    manifestPath,
    previewPath: available ? getPreviewPath(normalizedYear) : null,
    publicUrl: await getPublicUrl(normalizedYear, resolvedDeploymentConfig),
    remoteDir: normalizeVoteRemoteDir(normalizedYear, resolvedDeploymentConfig),
    generatedAt: manifest.generatedAt || null,
    publishedAt: manifest.publishedAt || null,
    campaignId: manifest.campaignId || null,
    tpiCount: Number(manifest.tpiCount || 0),
    voterCount: Number(manifest.voterCount || 0),
    groupCount: Number(manifest.groupCount || 0),
    accessLinkCount: Number(manifest.accessLinkCount || 0),
    arbitrageConfigured: Boolean(manifest.arbitrageConfigured),
    siteSyncSecretConfigured: Boolean(manifest.syncSecretConfigured),
    syncSecretConfigured: Boolean(getSyncSecret())
  }
}

function countUnique(values = []) {
  return new Set(values.filter(Boolean)).size
}

async function generateStaticVotesSite(year) {
  const normalizedYear = parseYear(year)
  const deploymentConfig = await getPublicationDeploymentConfigIfAvailable()
  const generatedAt = new Date().toISOString()
  const campaignPayload = await buildStaticVoteCampaignPayload(normalizedYear, generatedAt)
  const html = buildStaticVoteHtml(campaignPayload)
  const outputDir = getOutputDir(normalizedYear)

  await fs.promises.mkdir(outputDir, { recursive: true })
  await fs.promises.writeFile(getIndexPath(normalizedYear), buildStaticVoteUnavailableHtml(normalizedYear), 'utf8')

  const accessFiles = await writeStaticVoteAccessFiles({
    year: normalizedYear,
    html,
    campaignPayload
  })
  const publicUrl = await getPublicUrl(normalizedYear, deploymentConfig)
  const manifest = {
    year: normalizedYear,
    generatedAt,
    campaignId: campaignPayload.campaignId,
    tpiCount: countUnique(campaignPayload.groups.map((group) => group.tpi?.id)),
    voterCount: countUnique(campaignPayload.groups.map((group) => group.personId)),
    groupCount: campaignPayload.groups.length,
    accessLinkCount: accessFiles.accessLinkCount,
    arbitrageConfigured: accessFiles.arbitrageConfigured,
    syncSecretConfigured: accessFiles.syncSecretConfigured,
    previewPath: getPreviewPath(normalizedYear),
    publicUrl,
    remoteDir: normalizeVoteRemoteDir(normalizedYear, deploymentConfig)
  }

  await fs.promises.writeFile(getManifestPath(normalizedYear), JSON.stringify(manifest, null, 2), 'utf8')

  return {
    success: true,
    available: true,
    outputDir,
    indexPath: getIndexPath(normalizedYear),
    phpIndexPath: getPhpIndexPath(normalizedYear),
    syncPhpPath: getSyncPhpPath(normalizedYear),
    arbitragePhpPath: getArbitragePhpPath(normalizedYear),
    deniedIndexPath: getDeniedIndexPath(normalizedYear),
    htaccessPath: getHtaccessPath(normalizedYear),
    manifestPath: getManifestPath(normalizedYear),
    arbitrageAvailable: true,
    ...manifest
  }
}

async function publishStaticVotesSite(year) {
  const normalizedYear = parseYear(year)
  const deploymentConfig = await getPublicationDeploymentConfigIfAvailable({ includeSecret: true })
  const status = await getStaticVotePublicationStatus(normalizedYear, deploymentConfig)

  if (!status.available) {
    const error = new Error('Genere la publication vote avant la publication FTP.')
    error.statusCode = 409
    throw error
  }

  const php = await fs.promises.readFile(status.phpIndexPath, 'utf8')
  const match = php.match(/STATIC_VOTE_PAYLOAD_JSON'\n([\s\S]*?)\nSTATIC_VOTE_PAYLOAD_JSON/)
  const campaignPayload = match ? JSON.parse(match[1]) : {
    year: normalizedYear,
    generatedAt: status.generatedAt,
    campaignId: status.campaignId,
    groups: []
  }
  const html = buildStaticVoteHtml(campaignPayload)
  const accessFiles = await writeStaticVoteAccessFiles({
    year: normalizedYear,
    html,
    campaignPayload
  })
  const remoteDir = normalizeVoteRemoteDir(normalizedYear, deploymentConfig)
  const publishedAt = new Date().toISOString()
  const manifest = {
    year: normalizedYear,
    generatedAt: status.generatedAt || null,
    publishedAt,
    campaignId: status.campaignId || campaignPayload.campaignId || null,
    tpiCount: status.tpiCount || 0,
    voterCount: status.voterCount || 0,
    groupCount: status.groupCount || 0,
    accessLinkCount: accessFiles.accessLinkCount,
    arbitrageConfigured: accessFiles.arbitrageConfigured,
    syncSecretConfigured: accessFiles.syncSecretConfigured,
    previewPath: getPreviewPath(normalizedYear),
    publicUrl: await getPublicUrl(normalizedYear, deploymentConfig),
    remoteDir
  }

  const ftpClient = new SimpleFtpClient(getFtpConfig(deploymentConfig))

  try {
    await ftpClient.connect()
    manifest.remoteDir = await ftpClient.ensureDirectory(remoteDir)
    await ftpClient.uploadFile(status.deniedIndexPath, 'index.html')
    await ftpClient.uploadFile(status.phpIndexPath, 'index.php')
    await ftpClient.uploadFile(status.syncPhpPath, 'sync.php')
    await ftpClient.uploadFile(status.arbitragePhpPath, 'arbitrage.php')
    await ftpClient.uploadFile(status.htaccessPath, '.htaccess')
    await fs.promises.writeFile(status.manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
    await ftpClient.uploadFile(status.manifestPath, 'manifest.json')
  } finally {
    await ftpClient.close()
  }

  return {
    success: true,
    available: true,
    ...manifest
  }
}

function normalizeObjectId(value) {
  const text = compactText(value)
  return mongoose.Types.ObjectId.isValid(text) ? text : ''
}

function normalizeStaticVoteSlotSnapshot(slot = null) {
  if (!slot || typeof slot !== 'object' || Array.isArray(slot)) {
    return null
  }

  const room = slot.room && typeof slot.room === 'object' ? slot.room : {}
  const normalized = {
    id: normalizeObjectId(slot.id || slot._id),
    date: toIsoDate(slot.date),
    period: Number.parseInt(String(slot.period || ''), 10) || null,
    startTime: compactText(slot.startTime),
    endTime: compactText(slot.endTime),
    roomName: compactText(slot.roomName || room.name),
    roomSite: compactText(slot.roomSite || room.site)
  }

  if (!normalized.date && !normalized.period && !normalized.startTime && !normalized.roomName) {
    return null
  }

  normalized.room = normalized.roomName || normalized.roomSite
    ? {
        name: normalized.roomName,
        site: normalized.roomSite
      }
    : null

  return normalized
}

function normalizeStaticVoteProposalSnapshot(option = {}) {
  if (!option || typeof option !== 'object' || Array.isArray(option)) {
    return null
  }

  const slot = normalizeStaticVoteSlotSnapshot(option.slot)
  const slotId = normalizeObjectId(option.slotId || slot?.id)

  if (!slotId && !slot) {
    return null
  }

  return {
    slotId,
    voteId: normalizeObjectId(option.voteId),
    slot
  }
}

function normalizeStaticVoteRecord(record = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return null
  }

  const mode = compactText(record.mode).toLowerCase()
  const specialRequest = record.specialRequest && typeof record.specialRequest === 'object'
    ? {
        reason: compactText(record.specialRequest.reason),
        requestedDate: toDateOrNull(record.specialRequest.requestedDate)
      }
    : null
  const normalized = {
    id: compactText(record.id || record.submissionId),
    year: parseYear(record.year),
    campaignId: compactText(record.campaignId),
    personId: normalizeObjectId(record.personId),
    tpiId: normalizeObjectId(record.tpiId),
    tpiReference: compactText(record.tpiReference || record.tpiRef || record.reference),
    fixedVoteId: normalizeObjectId(record.fixedVoteId),
    fixedSlotId: normalizeObjectId(record.fixedSlotId || record.fixedSlot?.id || record.fixedSlot?._id),
    fixedSlot: normalizeStaticVoteSlotSnapshot(record.fixedSlot),
    mode,
    proposedSlotIds: Array.isArray(record.proposedSlotIds)
      ? [...new Set(record.proposedSlotIds.map(normalizeObjectId).filter(Boolean))]
      : [],
    proposalOptions: Array.isArray(record.proposalOptions)
      ? record.proposalOptions.map(normalizeStaticVoteProposalSnapshot).filter(Boolean)
      : [],
    onlyAvailabilitySlotIds: Array.isArray(record.onlyAvailabilitySlotIds)
      ? [...new Set(record.onlyAvailabilitySlotIds.map(normalizeObjectId).filter(Boolean))]
      : [],
    hardConstraint: record.hardConstraint === true,
    remark: compactText(record.remark).slice(0, 2000),
    specialRequest,
    submittedAt: toDateOrNull(record.submittedAt) || new Date(),
    tokenHash: compactText(record.tokenHash)
  }

  if (!normalized.id || !normalized.personId || !normalized.tpiId || !normalized.fixedVoteId) {
    return null
  }

  if (!ALLOWED_RESPONSE_MODES.has(mode)) {
    return null
  }

  if (normalized.mode === 'ok') {
    normalized.proposedSlotIds = []
    normalized.onlyAvailabilitySlotIds = []
    normalized.hardConstraint = false
    normalized.specialRequest = null
    return normalized
  }

  const hasSpecialReason = Boolean(normalized.specialRequest?.reason)
  const hasSpecialDate = Boolean(normalized.specialRequest?.requestedDate)

  if ((hasSpecialReason || hasSpecialDate) && (!hasSpecialReason || !hasSpecialDate)) {
    return null
  }

  if (normalized.hardConstraint && normalized.proposedSlotIds.length > 0) {
    return null
  }

  if (normalized.hardConstraint && (hasSpecialReason || hasSpecialDate)) {
    return null
  }

  if ((hasSpecialReason || hasSpecialDate) && normalized.proposedSlotIds.length > 0) {
    return null
  }

  if (normalized.onlyAvailabilitySlotIds.some((slotId) => !normalized.proposedSlotIds.includes(slotId))) {
    return null
  }

  if (normalized.proposedSlotIds.length === 0 && !hasSpecialReason && !normalized.hardConstraint) {
    return null
  }

  return normalized
}

function buildImportKey(record) {
  return `${STATIC_VOTE_IMPORT_PREFIX}:${record.year}:${record.id}`
}

function hasRecordedVoteResponse(vote) {
  const decision = compactText(vote?.decision)
  return Boolean(
    (decision && decision !== 'pending') ||
    vote?.votedAt ||
    compactText(vote?.magicLinkUsed)
  )
}

function isPositiveVoteDecision(decision) {
  return decision === 'accepted' || decision === 'preferred'
}

function isActiveVoteSlot(slot) {
  if (!slot || typeof slot !== 'object') {
    return true
  }

  const status = compactText(slot.status)
  return status !== 'blocked' && status !== 'cancelled'
}

function isActiveVoteDocument(vote) {
  return isActiveVoteSlot(vote?.slot)
}

function getLatestMovedVoteHistory(tpi) {
  return (Array.isArray(tpi?.history) ? tpi.history : [])
    .slice()
    .reverse()
    .find((entry) => ['planning_slot_moved_after_votes', 'slot_moved_from_vote_proposal'].includes(compactText(entry?.action))) || null
}

function getMovedVoteTouchedRoleSet(tpi) {
  const touchedRoles = getLatestMovedVoteHistory(tpi)?.details?.touchedRoles
  return new Set(
    (Array.isArray(touchedRoles) ? touchedRoles : [])
      .map(compactText)
      .filter(Boolean)
  )
}

function isMovedVoteRelaunchVote(vote, tpi) {
  const currentSlotId = getFixedSlotIdFromTpi(tpi)
  const touchedRoles = getMovedVoteTouchedRoleSet(tpi)
  const decision = compactText(vote?.decision || 'pending')

  if (!getLatestMovedVoteHistory(tpi)) {
    return false
  }

  if (currentSlotId && toIdString(vote?.slot) !== currentSlotId) {
    return false
  }

  if (touchedRoles.size > 0 && !touchedRoles.has(compactText(vote?.voterRole))) {
    return false
  }

  return !isPositiveVoteDecision(decision)
}

function parseStaticVotePayloadFromPhp(content) {
  const text = typeof content === 'string' ? content : ''
  const match = text.match(/\$staticVotePayload\s*=\s*json_decode\(<<<'STATIC_VOTE_PAYLOAD_JSON'\r?\n([\s\S]*?)\r?\nSTATIC_VOTE_PAYLOAD_JSON,\s*true\)/)

  if (!match) {
    return null
  }

  try {
    const payload = JSON.parse(match[1])
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null
  } catch (error) {
    return null
  }
}

async function loadStaticVoteCampaignSnapshot(year) {
  const phpIndexPath = getPhpIndexPath(year)

  if (!fs.existsSync(phpIndexPath)) {
    return null
  }

  try {
    return parseStaticVotePayloadFromPhp(await fs.promises.readFile(phpIndexPath, 'utf8'))
  } catch (error) {
    return null
  }
}

function buildStaticVoteArchiveGroupFromRecord(record = {}) {
  const proposalOptions = Array.isArray(record.proposalOptions)
    ? record.proposalOptions.map(normalizeStaticVoteProposalSnapshot).filter(Boolean)
    : []
  const fixedSlot = normalizeStaticVoteSlotSnapshot(record.fixedSlot)
  const tpiReference = compactText(record.tpiReference)

  if (!tpiReference && !fixedSlot && proposalOptions.length === 0) {
    return null
  }

  return {
    personId: record.personId,
    tpi: {
      id: record.tpiId,
      reference: tpiReference
    },
    fixedVoteId: record.fixedVoteId,
    fixedSlotId: normalizeObjectId(record.fixedSlotId || fixedSlot?.id),
    fixedSlot,
    proposalOptions
  }
}

function findStaticVoteArchiveGroupInPayload(record, payload) {
  const groups = Array.isArray(payload?.groups) ? payload.groups : []
  const matchingGroups = groups.filter((group) => {
    const groupTpi = group?.tpi && typeof group.tpi === 'object' ? group.tpi : {}

    return (
      compactText(group?.personId) === record.personId &&
      compactText(groupTpi.id) === record.tpiId &&
      (!record.fixedVoteId || compactText(group?.fixedVoteId) === record.fixedVoteId)
    )
  })

  if (matchingGroups.length !== 1) {
    return null
  }

  return matchingGroups[0]
}

async function findStaticVoteArchiveGroup(record) {
  const embeddedGroup = buildStaticVoteArchiveGroupFromRecord(record)

  if (embeddedGroup?.tpi?.reference) {
    return embeddedGroup
  }

  const snapshot = await loadStaticVoteCampaignSnapshot(record.year)
  return findStaticVoteArchiveGroupInPayload(record, snapshot)
}

function indexArchiveSlotsByOldId(archiveGroup = {}) {
  const slotsById = new Map()
  const fixedSlot = normalizeStaticVoteSlotSnapshot(archiveGroup.fixedSlot)
  const fixedSlotId = normalizeObjectId(archiveGroup.fixedSlotId || fixedSlot?.id)

  if (fixedSlotId && fixedSlot) {
    slotsById.set(fixedSlotId, fixedSlot)
  }

  for (const option of Array.isArray(archiveGroup.proposalOptions) ? archiveGroup.proposalOptions : []) {
    const normalizedOption = normalizeStaticVoteProposalSnapshot(option)
    if (normalizedOption?.slotId && normalizedOption.slot) {
      slotsById.set(normalizedOption.slotId, normalizedOption.slot)
    }
  }

  for (const slotEntry of Array.isArray(archiveGroup.slots) ? archiveGroup.slots : []) {
    const slot = normalizeStaticVoteSlotSnapshot(slotEntry.slot)
    const slotId = normalizeObjectId(slotEntry.slotId || slot?.id)
    if (slotId && slot) {
      slotsById.set(slotId, slot)
    }
  }

  return slotsById
}

function addSlotToStaticVoteTransferIndex(index, slot, value = {}) {
  const key = buildStaticVoteSlotTransferKey(slot)

  if (!key) {
    return
  }

  const existing = index.get(key) || {}

  index.set(key, {
    ...existing,
    ...value,
    slotId: value.slotId || existing.slotId || toIdString(slot),
    voteId: value.voteId || existing.voteId || '',
    slot
  })
}

async function buildCurrentStaticVoteSlotTransferIndex({ year, currentTpi, existingVotes, archiveSlotsByOldId }) {
  const index = new Map()

  for (const vote of Array.isArray(existingVotes) ? existingVotes : []) {
    const slot = vote?.slot && typeof vote.slot === 'object' ? vote.slot : null
    if (!slot) {
      continue
    }

    addSlotToStaticVoteTransferIndex(index, slot, {
      voteId: toIdString(vote),
      slotId: toIdString(slot)
    })
  }

  for (const proposedSlot of Array.isArray(currentTpi?.proposedSlots) ? currentTpi.proposedSlots : []) {
    const slot = proposedSlot?.slot && typeof proposedSlot.slot === 'object' ? proposedSlot.slot : null
    if (!slot) {
      continue
    }

    addSlotToStaticVoteTransferIndex(index, slot)
  }

  const missingDateKeys = Array.from(archiveSlotsByOldId.values())
    .filter((slot) => !index.has(buildStaticVoteSlotTransferKey(slot)))
    .map((slot) => toIsoDate(slot.date))
    .filter(Boolean)

  if (missingDateKeys.length === 0 || mongoose.connection?.readyState !== 1) {
    return index
  }

  const dateRangeFilters = buildDateRangeFilters([...new Set(missingDateKeys)])
  if (dateRangeFilters.length === 0) {
    return index
  }

  const slotDocuments = await Slot.find({
    year,
    $or: dateRangeFilters
  })
    .select('date period startTime endTime room status')
    .lean()

  for (const slot of Array.isArray(slotDocuments) ? slotDocuments : []) {
    addSlotToStaticVoteTransferIndex(index, slot)
  }

  return index
}

function remapStaticVoteSlotIds(slotIds = [], archiveSlotsByOldId, currentSlotsByTransferKey) {
  const mappedIds = []

  for (const oldSlotId of slotIds) {
    const archiveSlot = archiveSlotsByOldId.get(oldSlotId)
    const transferKey = buildStaticVoteSlotTransferKey(archiveSlot)
    const currentSlotId = transferKey ? currentSlotsByTransferKey.get(transferKey)?.slotId : ''

    if (!currentSlotId) {
      return null
    }

    if (!mappedIds.includes(currentSlotId)) {
      mappedIds.push(currentSlotId)
    }
  }

  return mappedIds
}

async function remapStaticVoteRecordFromSnapshot(record, existingTpi = null, existingVotes = null) {
  const archiveGroup = await findStaticVoteArchiveGroup(record)
  const tpiReference = compactText(archiveGroup?.tpi?.reference)

  if (!archiveGroup || !tpiReference) {
    return null
  }

  const currentTpi = existingTpi && compactText(existingTpi.reference) === tpiReference
    ? existingTpi
    : await TpiPlanning.findOne({
      year: record.year,
      reference: tpiReference
    }).populate('proposedSlots.slot', 'date period startTime endTime room status')

  if (!currentTpi) {
    return null
  }

  const currentVotes = Array.isArray(existingVotes)
    ? existingVotes
    : await Vote.find({
      tpiPlanning: currentTpi._id,
      voter: record.personId
    })
      .populate('slot', 'date period startTime endTime room status')
      .select('tpiPlanning slot voter voterRole decision comment availabilityException hardConstraint specialRequestReason specialRequestDate priority magicLinkUsed')

  if (!Array.isArray(currentVotes) || currentVotes.length === 0) {
    return null
  }
  const activeCurrentVotes = currentVotes.filter(isActiveVoteDocument)

  if (activeCurrentVotes.length === 0) {
    return null
  }

  const archiveSlotsByOldId = indexArchiveSlotsByOldId(archiveGroup)
  const currentSlotsByTransferKey = await buildCurrentStaticVoteSlotTransferIndex({
    year: record.year,
    currentTpi,
    existingVotes: activeCurrentVotes,
    archiveSlotsByOldId
  })
  const archiveFixedSlot = archiveSlotsByOldId.get(record.fixedSlotId || archiveGroup.fixedSlotId) ||
    normalizeStaticVoteSlotSnapshot(archiveGroup.fixedSlot)
  const archiveFixedKey = buildStaticVoteSlotTransferKey(archiveFixedSlot)
  const currentFixedVoteId = archiveFixedKey ? currentSlotsByTransferKey.get(archiveFixedKey)?.voteId : ''

  if (!currentFixedVoteId) {
    return null
  }

  const proposedSlotIds = remapStaticVoteSlotIds(
    record.proposedSlotIds,
    archiveSlotsByOldId,
    currentSlotsByTransferKey
  )
  const onlyAvailabilitySlotIds = remapStaticVoteSlotIds(
    record.onlyAvailabilitySlotIds,
    archiveSlotsByOldId,
    currentSlotsByTransferKey
  )

  if (!proposedSlotIds || !onlyAvailabilitySlotIds) {
    return null
  }

  return {
    ...record,
    tpiId: toIdString(currentTpi),
    tpiReference,
    fixedVoteId: currentFixedVoteId,
    proposedSlotIds,
    onlyAvailabilitySlotIds
  }
}

async function importStaticVoteRecord(rawRecord, expectedYear) {
  let record

  try {
    record = normalizeStaticVoteRecord(rawRecord)
  } catch (error) {
    return {
      imported: false,
      skipped: true,
      reason: 'invalid_record'
    }
  }

  if (!record || Number(record.year) !== Number(expectedYear)) {
    return {
      imported: false,
      skipped: true,
      reason: 'invalid_record'
    }
  }

  const importKey = buildImportKey(record)
  const alreadyImported = await Vote.exists({ magicLinkUsed: importKey })

  if (alreadyImported) {
    return {
      imported: false,
      skipped: true,
      reason: 'already_imported',
      importKey
    }
  }

  let remapAttempted = false
  let tpi = await TpiPlanning.findOne({
    _id: record.tpiId,
    year: record.year
  }).populate('proposedSlots.slot', 'date period startTime endTime room status')

  if (!tpi) {
    const remappedRecord = await remapStaticVoteRecordFromSnapshot(record)
    if (remappedRecord) {
      record = normalizeStaticVoteRecord(remappedRecord)
      remapAttempted = true
      tpi = await TpiPlanning.findOne({
        _id: record.tpiId,
        year: record.year
      }).populate('proposedSlots.slot', 'date period startTime endTime room status')
    }
  }

  if (!tpi) {
    return {
      imported: false,
      skipped: false,
      reason: 'tpi_not_found',
      importKey
    }
  }

  if (!VOTE_TPI_STATUSES.includes(compactText(tpi.status))) {
    return {
      imported: false,
      skipped: false,
      reason: 'tpi_not_open',
      importKey
    }
  }

  const roleIds = new Set([
    toIdString(tpi.expert1),
    toIdString(tpi.expert2),
    toIdString(tpi.chefProjet)
  ].filter(Boolean))

  if (roleIds.size > 0 && !roleIds.has(record.personId)) {
    return {
      imported: false,
      skipped: false,
      reason: 'person_out_of_scope',
      importKey
    }
  }

  const existingVotes = await Vote.find({
    tpiPlanning: tpi._id,
    voter: record.personId
  })
    .populate('slot', 'date period startTime endTime room status')
    .select('tpiPlanning slot voter voterRole decision comment availabilityException hardConstraint specialRequestReason specialRequestDate priority magicLinkUsed')

  if (!Array.isArray(existingVotes) || existingVotes.length === 0) {
    return {
      imported: false,
      skipped: false,
      reason: 'votes_not_found',
      importKey
    }
  }
  const activeExistingVotes = existingVotes.filter(isActiveVoteDocument)

  if (activeExistingVotes.length === 0) {
    return {
      imported: false,
      skipped: false,
      reason: 'votes_not_found',
      importKey
    }
  }

  const existingVotesById = new Map(activeExistingVotes.map((vote) => [toIdString(vote), vote]))
  const existingVotesBySlotId = new Map(activeExistingVotes.map((vote) => [toIdString(vote.slot), vote]))
  let fixedVote = existingVotesById.get(record.fixedVoteId)

  if (!fixedVote) {
    if (!remapAttempted) {
      const remappedRecord = await remapStaticVoteRecordFromSnapshot(record, tpi, activeExistingVotes)
      if (remappedRecord) {
        record = normalizeStaticVoteRecord(remappedRecord)
        fixedVote = existingVotesById.get(record.fixedVoteId)
        remapAttempted = true
      }
    }
  }

  if (!fixedVote) {
    return {
      imported: false,
      skipped: false,
      reason: 'fixed_vote_not_found',
      importKey
    }
  }

  const fixedSlotId = getFixedSlotIdFromTpi(tpi)
  if (fixedSlotId && toIdString(fixedVote.slot) !== fixedSlotId) {
    if (!remapAttempted) {
      const remappedRecord = await remapStaticVoteRecordFromSnapshot(record, tpi, activeExistingVotes)
      if (remappedRecord) {
        record = normalizeStaticVoteRecord(remappedRecord)
        fixedVote = existingVotesById.get(record.fixedVoteId)
        remapAttempted = true
      }
    }
  }

  if (!fixedVote) {
    return {
      imported: false,
      skipped: false,
      reason: 'fixed_vote_not_found',
      importKey
    }
  }

  if (fixedSlotId && toIdString(fixedVote.slot) !== fixedSlotId) {
    return {
      imported: false,
      skipped: false,
      reason: 'fixed_vote_mismatch',
      importKey
    }
  }

  if (activeExistingVotes.some((vote) =>
    hasRecordedVoteResponse(vote) && !isMovedVoteRelaunchVote(vote, tpi)
  )) {
    return {
      imported: false,
      skipped: true,
      reason: 'already_answered',
      importKey
    }
  }

  const allowedProposalSlotIds = new Set(
    activeExistingVotes
      .map((vote) => toIdString(vote.slot))
      .filter((slotId) => slotId && slotId !== fixedSlotId)
  )

  const needsAdditionalProposalOptions = record.proposedSlotIds.some((slotId) => !allowedProposalSlotIds.has(slotId))
  if (needsAdditionalProposalOptions) {
    const additionalProposalData = await buildStaticVoteProposalOptionsForTpi(tpi, [])
    for (const option of Array.isArray(additionalProposalData.options) ? additionalProposalData.options : []) {
      if (option?.slotId && option.slotId !== fixedSlotId) {
        allowedProposalSlotIds.add(option.slotId)
      }
    }
  }

  for (const slotId of record.proposedSlotIds) {
    if (!allowedProposalSlotIds.has(slotId)) {
      return {
        imported: false,
        skipped: false,
        reason: 'proposal_out_of_scope',
        importKey
      }
    }
  }

  const proposalSelectionSet = new Set(record.proposedSlotIds)
  const onlyAvailabilitySelectionSet = new Set(record.onlyAvailabilitySlotIds)
  const fixedDecision = record.mode === 'ok' ? 'accepted' : 'rejected'
  const hasSpecialRequest = Boolean(record.specialRequest?.reason || record.specialRequest?.requestedDate)
  const remark = compactText(record.remark)
  const hasOnlyAvailability = Array.isArray(record.onlyAvailabilitySlotIds) && record.onlyAvailabilitySlotIds.length > 0
  const fixedComment = record.mode === 'proposal'
    ? [
        record.hardConstraint ? 'Aucune date proposée ne convient.' : '',
        hasSpecialRequest ? record.specialRequest.reason : '',
        hasOnlyAvailability ? 'Seule disponibilité signalée.' : '',
        !hasSpecialRequest && !record.hardConstraint && !hasOnlyAvailability && !remark ? 'Proposition de creneaux alternatifs' : '',
        remark
      ].filter(Boolean).join(' ')
    : remark
  const sharedSpecialReason = hasSpecialRequest ? record.specialRequest.reason : ''
  const sharedSpecialDate = hasSpecialRequest ? record.specialRequest.requestedDate : null

  for (const vote of activeExistingVotes) {
    const slotId = toIdString(vote.slot)
    const isFixedSlot = slotId === fixedSlotId
    const isSelectedProposal = proposalSelectionSet.has(slotId)
    const isOnlyAvailabilitySlot = onlyAvailabilitySelectionSet.has(slotId)

    vote.decision = isFixedSlot
      ? fixedDecision
      : isSelectedProposal
        ? 'preferred'
        : 'rejected'
    vote.comment = isFixedSlot
      ? fixedComment
      : isOnlyAvailabilitySlot
        ? 'Seule disponibilité signalée.'
        : ''
    vote.availabilityException = hasSpecialRequest
    vote.hardConstraint = Boolean(record.hardConstraint === true || isOnlyAvailabilitySlot)
    vote.specialRequestReason = sharedSpecialReason
    vote.specialRequestDate = sharedSpecialDate
    vote.priority = isSelectedProposal
      ? record.proposedSlotIds.indexOf(slotId) + 1
      : undefined
    vote.votedAt = record.submittedAt
    vote.magicLinkUsed = importKey
    await vote.save()
  }

  for (const slotId of record.proposedSlotIds) {
    if (existingVotesBySlotId.has(slotId)) {
      continue
    }

    const createdVote = new Vote({
      tpiPlanning: tpi._id,
      slot: slotId,
      voter: record.personId,
      voterRole: fixedVote.voterRole,
      decision: 'preferred',
      comment: onlyAvailabilitySelectionSet.has(slotId) ? 'Seule disponibilité signalée.' : '',
      availabilityException: hasSpecialRequest,
      hardConstraint: onlyAvailabilitySelectionSet.has(slotId),
      specialRequestReason: sharedSpecialReason,
      specialRequestDate: sharedSpecialDate,
      priority: record.proposedSlotIds.indexOf(slotId) + 1,
      votedAt: record.submittedAt,
      magicLinkUsed: importKey
    })

    await createdVote.save()
  }

  const validation = await schedulingService.registerVoteAndCheckValidation(
    fixedVote._id,
    fixedDecision,
    fixedComment
  )

  return {
    imported: true,
    skipped: false,
    importKey,
    tpiId: record.tpiId,
    personId: record.personId,
    validation
  }
}

function normalizeStaticVoteArbitrageRecord(record = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return null
  }

  const decision = compactText(record.decision).toLowerCase()
  const normalized = {
    id: compactText(record.id),
    year: parseYear(record.year),
    tokenHash: compactText(record.tokenHash),
    tpiId: normalizeObjectId(record.tpiId),
    personId: normalizeObjectId(record.personId),
    role: compactText(record.role),
    decision,
    reason: compactText(record.reason).slice(0, 2000),
    alternativeProposal: compactText(record.alternativeProposal).slice(0, 2000),
    submittedAt: toDateOrNull(record.submittedAt) || new Date()
  }

  if (!normalized.id || !normalized.tokenHash || !['accepted', 'rejected'].includes(decision)) {
    return null
  }

  if (decision === 'rejected' && !normalized.reason) {
    return null
  }

  return normalized
}

function computeResolutionProposalStatusFromRecipients(proposal, now = new Date()) {
  if (!proposal) {
    return 'sent'
  }

  if (proposal.status === 'cancelled' || proposal.status === 'failed') {
    return proposal.status
  }

  const expiresAt = proposal.expiresAt ? new Date(proposal.expiresAt) : null
  const recipients = Array.isArray(proposal.recipients) ? proposal.recipients : []
  const rejectedCount = recipients.filter((recipient) => recipient.responseStatus === 'rejected').length
  const acceptedCount = recipients.filter((recipient) => recipient.responseStatus === 'accepted').length
  const respondedCount = rejectedCount + acceptedCount

  if (rejectedCount > 0) {
    return 'rejected'
  }

  if (recipients.length > 0 && acceptedCount === recipients.length) {
    return 'accepted'
  }

  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt <= now) {
    return 'expired'
  }

  return respondedCount > 0 ? 'partial' : 'sent'
}

async function guardStaticVoteArbitrageImportStatus(proposal, submittedAt = new Date()) {
  const status = computeResolutionProposalStatusFromRecipients(proposal, submittedAt)

  if (status === 'expired') {
    if (proposal.status !== 'expired') {
      proposal.status = 'expired'
      await proposal.save()
    }

    return {
      imported: false,
      skipped: true,
      reason: 'proposal_expired',
      proposalId: toIdString(proposal),
      status
    }
  }

  if (['accepted', 'rejected', 'cancelled', 'failed'].includes(status)) {
    return {
      imported: false,
      skipped: true,
      reason: 'proposal_closed',
      proposalId: toIdString(proposal),
      status
    }
  }

  return null
}

async function importStaticVoteArbitrageRecord(rawRecord, expectedYear) {
  let record

  try {
    record = normalizeStaticVoteArbitrageRecord(rawRecord)
  } catch (error) {
    return {
      imported: false,
      skipped: true,
      reason: 'invalid_arbitrage_record'
    }
  }

  if (!record || Number(record.year) !== Number(expectedYear)) {
    return {
      imported: false,
      skipped: true,
      reason: 'invalid_arbitrage_record'
    }
  }

  const proposal = await ResolutionProposal.findOne({ 'recipients.tokenHash': record.tokenHash })

  if (!proposal) {
    return {
      imported: false,
      skipped: false,
      reason: 'proposal_not_found',
      recordId: record.id
    }
  }

  const recipient = (Array.isArray(proposal.recipients) ? proposal.recipients : [])
    .find((item) => item.tokenHash === record.tokenHash)

  if (!recipient) {
    return {
      imported: false,
      skipped: false,
      reason: 'recipient_not_found',
      recordId: record.id
    }
  }

  const currentStatus = compactText(recipient.responseStatus)
  if (['accepted', 'rejected'].includes(currentStatus)) {
    if (currentStatus === record.decision) {
      return {
        imported: false,
        skipped: true,
        reason: 'already_imported',
        recordId: record.id,
        proposalId: toIdString(proposal)
      }
    }

    return {
      imported: false,
      skipped: false,
      reason: 'response_conflict',
      recordId: record.id,
      proposalId: toIdString(proposal)
    }
  }

  const blockedStatus = await guardStaticVoteArbitrageImportStatus(proposal, record.submittedAt)
  if (blockedStatus) {
    return {
      ...blockedStatus,
      recordId: record.id
    }
  }

  recipient.responseStatus = record.decision
  recipient.responseReason = record.decision === 'rejected' ? record.reason : ''
  recipient.alternativeProposal = record.decision === 'rejected' ? record.alternativeProposal : ''
  recipient.respondedAt = record.submittedAt
  proposal.status = computeResolutionProposalStatusFromRecipients(proposal)
  await proposal.save()

  return {
    imported: true,
    skipped: false,
    recordId: record.id,
    proposalId: toIdString(proposal),
    tpiId: toIdString(proposal.tpiPlanning),
    personId: toIdString(recipient.person),
    decision: record.decision
  }
}

async function resolveStaticVoteSyncUrl(year, explicitRemoteUrl = '') {
  const configuredUrl = compactText(
    explicitRemoteUrl ||
    withPublicationYear(process.env.STATIC_VOTE_SYNC_URL || '', year)
  )

  if (configuredUrl) {
    return configuredUrl
  }

  return `${await getPublicUrl(year)}sync.php`
}

async function fetchStaticVoteRecords({
  year,
  remoteUrl = '',
  syncSecret = '',
  fetchImpl = null,
  timeoutMs = null
} = {}) {
  const normalizedYear = parseYear(year)
  const resolvedSecret = compactText(syncSecret || getSyncSecret())
  if (!resolvedSecret) {
    const error = new Error('STATIC_VOTE_SYNC_SECRET requis pour synchroniser les votes.')
    error.statusCode = 409
    throw error
  }

  const resolvedUrl = await resolveStaticVoteSyncUrl(normalizedYear, remoteUrl)
  const httpFetch = fetchImpl || global.fetch
  const resolvedTimeoutMs = getSyncTimeoutMs(timeoutMs)

  if (typeof httpFetch !== 'function') {
    const error = new Error('fetch indisponible pour la synchronisation des votes.')
    error.statusCode = 500
    throw error
  }

  const requestOptions = {
    headers: {
      'X-Sync-Secret': resolvedSecret,
      Accept: 'application/json'
    }
  }
  let timeoutHandle = null

  if (typeof AbortController === 'function' && resolvedTimeoutMs > 0) {
    const controller = new AbortController()
    requestOptions.signal = controller.signal
    timeoutHandle = setTimeout(() => controller.abort(), resolvedTimeoutMs)
  }

  let response
  try {
    response = await httpFetch(resolvedUrl, requestOptions)
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Synchronisation distante expiree apres ${resolvedTimeoutMs} ms.`)
      timeoutError.statusCode = 504
      throw timeoutError
    }

    throw error
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }

  const body = await response.json().catch(() => null)

  if (!response.ok || !body?.success) {
    const error = new Error(body?.error || `Synchronisation distante refusee (${response.status}).`)
    error.statusCode = response.status || 502
    throw error
  }

  return {
    sourceUrl: resolvedUrl,
    records: Array.isArray(body.records) ? body.records : [],
    arbitrageRecords: Array.isArray(body.arbitrageRecords) ? body.arbitrageRecords : []
  }
}

async function syncStaticVoteResponses({
  year,
  remoteUrl = '',
  syncSecret = '',
  fetchImpl = null,
  timeoutMs = null
} = {}) {
  const normalizedYear = parseYear(year)
  const remote = await fetchStaticVoteRecords({
    year: normalizedYear,
    remoteUrl,
    syncSecret,
    fetchImpl,
    timeoutMs
  })

  const results = []
  const arbitrageResults = []
  let importedCount = 0
  let skippedCount = 0
  let failedCount = 0
  let voteImportedCount = 0
  let voteSkippedCount = 0
  let voteFailedCount = 0
  let arbitrageImportedCount = 0
  let arbitrageSkippedCount = 0
  let arbitrageFailedCount = 0

  for (const record of remote.records) {
    try {
      const result = await importStaticVoteRecord(record, normalizedYear)
      results.push(result)

      if (result.imported) {
        importedCount += 1
        voteImportedCount += 1
      } else if (result.skipped) {
        skippedCount += 1
        voteSkippedCount += 1
      } else {
        failedCount += 1
        voteFailedCount += 1
      }
    } catch (error) {
      failedCount += 1
      voteFailedCount += 1
      results.push({
        imported: false,
        skipped: false,
        reason: error?.message || 'import_failed'
      })
    }
  }

  for (const record of remote.arbitrageRecords) {
    try {
      const result = await importStaticVoteArbitrageRecord(record, normalizedYear)
      arbitrageResults.push(result)

      if (result.imported) {
        importedCount += 1
        arbitrageImportedCount += 1
      } else if (result.skipped) {
        skippedCount += 1
        arbitrageSkippedCount += 1
      } else {
        failedCount += 1
        arbitrageFailedCount += 1
      }
    } catch (error) {
      failedCount += 1
      arbitrageFailedCount += 1
      arbitrageResults.push({
        imported: false,
        skipped: false,
        reason: error?.message || 'arbitrage_import_failed'
      })
    }
  }

  return {
    success: failedCount === 0,
    year: normalizedYear,
    sourceUrl: remote.sourceUrl,
    receivedCount: remote.records.length + remote.arbitrageRecords.length,
    voteReceivedCount: remote.records.length,
    arbitrageReceivedCount: remote.arbitrageRecords.length,
    importedCount,
    skippedCount,
    failedCount,
    voteImportedCount,
    voteSkippedCount,
    voteFailedCount,
    arbitrageImportedCount,
    arbitrageSkippedCount,
    arbitrageFailedCount,
    results,
    arbitrageResults
  }
}

module.exports = {
  STATIC_VOTE_BOOTSTRAP_PLACEHOLDER,
  buildStaticVoteArbitragePhp,
  buildStaticVoteCampaignPayload,
  buildStaticVoteHtml,
  buildStaticVoteHtaccess,
  buildStaticVotePhp,
  buildStaticVoteSyncPhp,
  buildStaticVoteUnavailableHtml,
  buildStaticVoteArbitrageUrl,
  canBuildStaticVoteArbitrageLinks,
  createStaticVoteArbitrageToken,
  fetchStaticVoteRecords,
  generateStaticVotesSite,
  getArbitragePhpPath,
  getIndexPath,
  getPublicUrl,
  getStaticVotePublicationStatus,
  getStaticVoteLinkTarget,
  importStaticVoteArbitrageRecord,
  importStaticVoteRecord,
  listStaticVoteAccessLinks,
  normalizeVotePublicPath,
  normalizeVoteRemoteDir,
  publishStaticVotesSite,
  syncStaticVoteResponses
}
