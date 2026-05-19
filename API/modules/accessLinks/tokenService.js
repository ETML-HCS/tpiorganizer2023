const crypto = require('crypto')
const mongoose = require('mongoose')

const Person = require('../../models/personModel')
const { MagicLink } = require('../../models/magicLinkModel')
const { AccessLinkLog } = require('../../models/accessLinkLogModel')
const coordinationConfigService = require('../../services/coordinationConfigService')
const { buildDefensePublicPath } = require('../../utils/publicRoutes')
const {
  ACCESS_LINK_TYPES,
  DEFAULT_EXPIRY_HOURS,
  DEFAULT_MAX_USES,
  isAccessLinkType
} = require('./constants')

function toDisplayName(person) {
  if (!person) {
    return ''
  }

  return [person.firstName, person.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function getExpiryHours(type) {
  const envKey = type === ACCESS_LINK_TYPES.VOTE
    ? 'MAGIC_LINK_VOTE_EXPIRY_HOURS'
    : 'MAGIC_LINK_SOUTENANCE_EXPIRY_HOURS'

  const configured = Number.parseInt(process.env[envKey] || '', 10)
  if (Number.isInteger(configured) && configured > 0) {
    return configured
  }

  return DEFAULT_EXPIRY_HOURS[type] || 24
}

function getMaxUses(type) {
  const envKey = type === ACCESS_LINK_TYPES.VOTE
    ? 'MAGIC_LINK_VOTE_MAX_USES'
    : 'MAGIC_LINK_SOUTENANCE_MAX_USES'

  const configured = Number.parseInt(process.env[envKey] || '', 10)
  if (Number.isInteger(configured) && configured > 0) {
    return configured
  }

  return DEFAULT_MAX_USES[type] || 1
}

function buildEnvAccessLinkFallback() {
  return {
    voteLinkValidityHours: getExpiryHours('vote'),
    voteLinkMaxUses: getMaxUses('vote'),
    soutenanceLinkValidityHours: getExpiryHours('soutenance'),
    soutenanceLinkMaxUses: getMaxUses('soutenance')
  }
}

async function getAccessLinkSettingsForYear(year) {
  const planningConfig = await coordinationConfigService.getPlanningConfigIfAvailable(year)
  return coordinationConfigService.normalizeAccessLinkSettings(
    planningConfig?.accessLinkSettings,
    buildEnvAccessLinkFallback()
  )
}

async function resolveMagicLinkPolicy({
  type,
  year,
  maxUses = null,
  expiresInHours = null,
  accessLinkSettings = null
}) {
  const settings = accessLinkSettings
    ? coordinationConfigService.normalizeAccessLinkSettings(accessLinkSettings, buildEnvAccessLinkFallback())
    : await getAccessLinkSettingsForYear(year)
  const configuredExpiryHours = type === ACCESS_LINK_TYPES.VOTE
    ? settings.voteLinkValidityHours
    : settings.soutenanceLinkValidityHours
  const configuredMaxUses = type === ACCESS_LINK_TYPES.VOTE
    ? settings.voteLinkMaxUses
    : settings.soutenanceLinkMaxUses

  return {
    expiresInHours: Number.isInteger(expiresInHours) && expiresInHours > 0
      ? expiresInHours
      : configuredExpiryHours,
    maxUses: Number.isInteger(maxUses) && maxUses > 0
      ? maxUses
      : configuredMaxUses
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function buildMagicLinkUrl(baseUrl, redirectPath, token) {
  const normalizedBase = baseUrl.endsWith('/')
    ? baseUrl
    : `${baseUrl}/`
  const normalizedPath = redirectPath.startsWith('/')
    ? redirectPath
    : `/${redirectPath}`

  const url = new URL(normalizedPath, normalizedBase)
  url.searchParams.set('ml', token)

  return url.toString()
}

function normalizeRecipientEmail(person, recipientEmail = null) {
  return typeof recipientEmail === 'string' && recipientEmail.trim().length > 0
    ? recipientEmail.trim().toLowerCase()
    : typeof person?.email === 'string' && person.email.trim().length > 0
      ? person.email.trim().toLowerCase()
      : ''
}

function normalizePersonObjectId(person) {
  const personId = person?._id

  return mongoose.isObjectIdOrHexString(personId) ? personId : null
}

function applyMagicLinkTargetQuery(query, person, recipientEmail, errorMessage) {
  const personId = normalizePersonObjectId(person)

  if (personId) {
    query.personId = personId
    return
  }

  if (recipientEmail) {
    query.recipientEmail = recipientEmail
    return
  }

  throw new Error(errorMessage)
}

function applyScopeFilters(query, scope = {}) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    return
  }

  for (const [key, value] of Object.entries(scope)) {
    if (!key || value === undefined) {
      continue
    }

    query[`scope.${key}`] = value === null ? null : value
  }
}

function normalizeSourceFilters(sources = []) {
  return Array.isArray(sources)
    ? sources.filter((source) => typeof source === 'string' && source.trim().length > 0)
    : []
}

function isMagicLinkStillUsable(link) {
  const maxUses = Number(link?.maxUses || 0)
  const usageCount = Number(link?.usageCount || 0)

  return maxUses <= 0 || usageCount < maxUses
}

function getMagicLinkAvailabilityStatus(link, now = new Date()) {
  if (!link) {
    return 'missing'
  }

  if (link.revokedAt) {
    return 'revoked'
  }

  const expiresAt = link.expiresAt ? new Date(link.expiresAt) : null
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt <= now) {
    return 'expired'
  }

  if (!isMagicLinkStillUsable(link)) {
    return 'exhausted'
  }

  return 'available'
}

function buildStoredMagicLinkResponse(link, baseUrl) {
  const rawToken = typeof link?.rawToken === 'string'
    ? link.rawToken.trim()
    : ''
  const baseStatus = getMagicLinkAvailabilityStatus(link)
  const availabilityStatus = baseStatus === 'available' && !rawToken
    ? 'unrecoverable'
    : baseStatus
  const canExposeUrl = availabilityStatus === 'available' && rawToken

  return {
    id: link?._id ? String(link._id) : '',
    token: canExposeUrl ? rawToken : null,
    redirectPath: link?.redirectPath,
    url: canExposeUrl ? buildMagicLinkUrl(baseUrl, link.redirectPath, rawToken) : null,
    expiresAt: link?.expiresAt || null,
    createdAt: link?.createdAt || null,
    deliveryStatus: link?.emailDeliveryStatus || '',
    deliveryError: link?.emailDeliveryError || '',
    sentAt: link?.emailSentAt || null,
    emailMessageId: link?.emailMessageId || '',
    revokedAt: link?.revokedAt || null,
    maxUses: Number(link?.maxUses || 0),
    usageCount: Number(link?.usageCount || 0),
    lastUsedAt: link?.lastUsedAt || null,
    type: link?.type,
    source: link?.scope?.source || '',
    publicationVersion: link?.scope?.publicationVersion || null,
    generated: true,
    recoverable: Boolean(rawToken),
    availabilityStatus
  }
}

function compactLogText(value, maxLength = 512) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim().slice(0, maxLength)
}

function normalizeLogRequest(context = {}) {
  const request = context?.request || context || {}
  const headers = request.headers || {}
  const getHeader = typeof request.get === 'function'
    ? (name) => request.get(name)
    : (name) => headers[name] || headers[name.toLowerCase()]

  return {
    ip: compactLogText(
      request.ip ||
      request.remoteAddress ||
      request.connection?.remoteAddress ||
      headers['x-forwarded-for'] ||
      '',
      128
    ),
    userAgent: compactLogText(
      request.userAgent ||
      getHeader('user-agent') ||
      '',
      512
    )
  }
}

function buildAccessLogPayload({
  status,
  reason = '',
  tokenHash = '',
  link = null,
  context = {}
}) {
  const requestContext = normalizeLogRequest(context)
  const normalizedYear = Number.parseInt(link?.year, 10)

  return {
    tokenHash: compactLogText(tokenHash, 128),
    type: isAccessLinkType(link?.type) ? link.type : null,
    year: Number.isInteger(normalizedYear) ? normalizedYear : null,
    personId: mongoose.isObjectIdOrHexString(link?.personId) ? link.personId : null,
    recipientEmail: normalizeRecipientEmail(null, link?.recipientEmail),
    status,
    reason: compactLogText(reason),
    redirectPath: compactLogText(link?.redirectPath, 256),
    role: link?.role || null,
    scope: link?.scope && typeof link.scope === 'object' ? link.scope : {},
    ip: requestContext.ip,
    userAgent: requestContext.userAgent
  }
}

async function logAccessLinkAttempt(payload) {
  try {
    return await AccessLinkLog.create(buildAccessLogPayload(payload))
  } catch (error) {
    console.error('Erreur journal acces magic link:', error)
    return null
  }
}

function serializeAccessLog(row = {}) {
  return {
    id: row?._id ? String(row._id) : '',
    tokenHash: row.tokenHash || '',
    type: row.type || null,
    year: row.year || null,
    personId: row.personId ? String(row.personId) : null,
    recipientEmail: row.recipientEmail || '',
    status: row.status || '',
    reason: row.reason || '',
    redirectPath: row.redirectPath || '',
    role: row.role || null,
    scope: row.scope || {},
    ip: row.ip || '',
    userAgent: row.userAgent || '',
    createdAt: row.createdAt || null
  }
}

function getModifiedCount(result = {}) {
  return Number(result.modifiedCount ?? result.nModified ?? 0)
}

async function reserveMagicLinkUsage(link, now) {
  const result = await MagicLink.updateOne(
    {
      _id: link._id,
      revokedAt: null,
      expiresAt: { $gt: now },
      $or: [
        { maxUses: { $lte: 0 } },
        { $expr: { $lt: ['$usageCount', '$maxUses'] } }
      ]
    },
    {
      $inc: { usageCount: 1 },
      $set: {
        lastUsedAt: now,
        updatedAt: now
      }
    }
  )

  return getModifiedCount(result) === 1
}

async function listAccessLogs({
  year,
  type = null,
  status = null,
  personId = null,
  limit = 100
} = {}) {
  const query = {}
  const normalizedYear = Number.parseInt(year, 10)

  if (Number.isInteger(normalizedYear)) {
    query.year = normalizedYear
  }

  if (isAccessLinkType(type)) {
    query.type = type
  }

  const normalizedStatus = compactLogText(status, 64)
  if (normalizedStatus) {
    query.status = normalizedStatus
  }

  if (mongoose.isObjectIdOrHexString(personId)) {
    query.personId = personId
  }

  const normalizedLimit = Number.parseInt(limit, 10)
  const boundedLimit = Number.isInteger(normalizedLimit)
    ? Math.min(Math.max(normalizedLimit, 1), 500)
    : 100

  const rows = await AccessLinkLog.find(query)
    .sort({ createdAt: -1 })
    .limit(boundedLimit)
    .lean()

  return (rows || []).map(serializeAccessLog)
}

async function createTypedMagicLink({
  type,
  year,
  baseUrl,
  redirectPath,
  person,
  recipientEmail = null,
  role = null,
  scope = {},
  maxUses = null,
  expiresInHours = null,
  accessLinkSettings = null,
  persistToken = false
}) {
  if (!isAccessLinkType(type)) {
    throw new Error('Type de magic link invalide.')
  }

  const normalizedRecipientEmail = normalizeRecipientEmail(person, recipientEmail)

  if (!normalizedRecipientEmail) {
    throw new Error('Personne cible invalide pour magic link.')
  }

  if (!redirectPath || typeof redirectPath !== 'string') {
    throw new Error('redirectPath requis.')
  }

  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error('baseUrl requis.')
  }

  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const now = new Date()
  const policy = await resolveMagicLinkPolicy({
    type,
    year,
    maxUses,
    expiresInHours,
    accessLinkSettings
  })
  const hours = policy.expiresInHours
  const expiry = new Date(now.getTime() + hours * 60 * 60 * 1000)
  const allowedUses = policy.maxUses

  const created = await MagicLink.create({
    tokenHash,
    rawToken: persistToken ? token : '',
    type,
    year,
    recipientEmail: normalizedRecipientEmail,
    personId: normalizePersonObjectId(person),
    personName: toDisplayName(person),
    role,
    scope,
    redirectPath,
    maxUses: allowedUses,
    usageCount: 0,
    expiresAt: expiry
  })

  return {
    id: String(created._id),
    token,
    redirectPath,
    url: buildMagicLinkUrl(baseUrl, redirectPath, token),
    expiresAt: expiry,
    type
  }
}

async function createVoteMagicLink({
  year,
  person,
  role,
  scope = {},
  baseUrl,
  redirectPath = null,
  recipientEmail = null,
  accessLinkSettings = null,
  persistToken = false
}) {
  return await createTypedMagicLink({
    type: ACCESS_LINK_TYPES.VOTE,
    year,
    baseUrl,
    redirectPath: redirectPath || `/coordination/${year}`,
    person,
    recipientEmail,
    role,
    scope,
    accessLinkSettings,
    persistToken
  })
}

async function createSoutenanceMagicLink({
  year,
  person,
  scope = {},
  baseUrl,
  redirectPath = null,
  recipientEmail = null,
  accessLinkSettings = null,
  persistToken = false
}) {
  return await createTypedMagicLink({
    type: ACCESS_LINK_TYPES.SOUTENANCE,
    year,
    baseUrl,
    redirectPath: redirectPath || buildDefensePublicPath(year),
    person,
    recipientEmail,
    role: null,
    scope,
    accessLinkSettings,
    persistToken
  })
}

async function revokeActiveMagicLinks({
  year,
  type,
  person = null,
  recipientEmail = null,
  scope = {},
  sources = [],
  excludeIds = []
}) {
  if (!isAccessLinkType(type)) {
    throw new Error('Type de magic link invalide.')
  }

  const normalizedYear = Number.parseInt(year, 10)
  if (!Number.isInteger(normalizedYear)) {
    throw new Error('Annee invalide pour revocation magic link.')
  }

  const normalizedRecipientEmail = normalizeRecipientEmail(person, recipientEmail)

  const query = {
    year: normalizedYear,
    type,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  }

  applyMagicLinkTargetQuery(
    query,
    person,
    normalizedRecipientEmail,
    'Personne cible invalide pour revocation magic link.'
  )

  const normalizedSources = normalizeSourceFilters(sources)

  if (normalizedSources.length > 0) {
    query['scope.source'] = { $in: normalizedSources }
  }

  applyScopeFilters(query, scope)

  const normalizedExcludeIds = Array.isArray(excludeIds)
    ? excludeIds.filter((id) => id !== null && id !== undefined && String(id).trim().length > 0)
    : []

  if (normalizedExcludeIds.length > 0) {
    query._id = { $nin: normalizedExcludeIds }
  }

  const revokedAt = new Date()
  return await MagicLink.updateMany(query, {
    $set: {
      revokedAt,
      updatedAt: revokedAt
    }
  })
}

async function findReusableMagicLink({
  year,
  type,
  person = null,
  recipientEmail = null,
  scope = {},
  sources = [],
  baseUrl
}) {
  if (!isAccessLinkType(type)) {
    throw new Error('Type de magic link invalide.')
  }

  const normalizedYear = Number.parseInt(year, 10)
  if (!Number.isInteger(normalizedYear)) {
    throw new Error('Annee invalide pour magic link.')
  }

  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error('baseUrl requis.')
  }

  const normalizedRecipientEmail = normalizeRecipientEmail(person, recipientEmail)
  const query = {
    year: normalizedYear,
    type,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  }

  applyMagicLinkTargetQuery(
    query,
    person,
    normalizedRecipientEmail,
    'Personne cible invalide pour magic link.'
  )

  const normalizedSources = normalizeSourceFilters(sources)
  if (normalizedSources.length > 0) {
    query['scope.source'] = { $in: normalizedSources }
  }

  applyScopeFilters(query, scope)

  const links = await MagicLink.find(query)
    .select('+rawToken type year redirectPath expiresAt maxUses usageCount lastUsedAt scope createdAt emailDeliveryStatus emailSentAt emailDeliveryError emailMessageId')
    .sort({ createdAt: -1 })
    .lean()

  const reusableLink = (links || []).find(isMagicLinkStillUsable)
  if (!reusableLink) {
    return null
  }

  return buildStoredMagicLinkResponse(reusableLink, baseUrl)
}

async function findLatestMagicLinkStatus({
  year,
  type,
  person = null,
  recipientEmail = null,
  scope = {},
  sources = [],
  baseUrl
}) {
  if (!isAccessLinkType(type)) {
    throw new Error('Type de magic link invalide.')
  }

  const normalizedYear = Number.parseInt(year, 10)
  if (!Number.isInteger(normalizedYear)) {
    throw new Error('Annee invalide pour magic link.')
  }

  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error('baseUrl requis.')
  }

  const normalizedRecipientEmail = normalizeRecipientEmail(person, recipientEmail)
  const query = {
    year: normalizedYear,
    type
  }

  applyMagicLinkTargetQuery(
    query,
    person,
    normalizedRecipientEmail,
    'Personne cible invalide pour magic link.'
  )

  const normalizedSources = normalizeSourceFilters(sources)
  if (normalizedSources.length > 0) {
    query['scope.source'] = { $in: normalizedSources }
  }

  applyScopeFilters(query, scope)

  const latestLink = await MagicLink.findOne(query)
    .select('+rawToken type year redirectPath expiresAt maxUses usageCount lastUsedAt scope createdAt revokedAt emailDeliveryStatus emailSentAt emailDeliveryError emailMessageId')
    .sort({ createdAt: -1 })
    .lean()

  return latestLink ? buildStoredMagicLinkResponse(latestLink, baseUrl) : null
}

async function findMagicLinkForEmailDelivery({
  id,
  year,
  type,
  baseUrl
}) {
  if (!mongoose.isObjectIdOrHexString(id)) {
    return null
  }

  const normalizedYear = Number.parseInt(year, 10)
  if (!Number.isInteger(normalizedYear)) {
    throw new Error('Annee invalide pour magic link.')
  }

  if (!isAccessLinkType(type)) {
    throw new Error('Type de magic link invalide.')
  }

  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error('baseUrl requis.')
  }

  const link = await MagicLink.findOne({
    _id: id,
    year: normalizedYear,
    type
  })
    .select('+rawToken type year recipientEmail personId personName redirectPath expiresAt maxUses usageCount lastUsedAt scope createdAt revokedAt emailDeliveryStatus emailSentAt emailDeliveryError emailMessageId')
    .lean()

  if (!link) {
    return null
  }

  return {
    raw: link,
    public: buildStoredMagicLinkResponse(link, baseUrl)
  }
}

async function markMagicLinkEmailDelivery({
  id,
  status,
  messageId = '',
  error = '',
  sentAt = new Date()
}) {
  if (!mongoose.isObjectIdOrHexString(id)) {
    return null
  }

  const normalizedStatus = ['sent', 'failed', 'skipped', 'pending'].includes(status)
    ? status
    : 'failed'
  const parsedSentAt = sentAt instanceof Date ? sentAt : new Date(sentAt || Date.now())
  const update = {
    emailDeliveryStatus: normalizedStatus,
    emailMessageId: String(messageId || ''),
    emailDeliveryError: String(error || '').slice(0, 1000),
    updatedAt: new Date()
  }

  if (normalizedStatus === 'sent') {
    update.emailSentAt = Number.isNaN(parsedSentAt.getTime()) ? new Date() : parsedSentAt
  } else if (normalizedStatus === 'failed') {
    update.emailSentAt = null
  }

  await MagicLink.updateOne({ _id: id }, { $set: update })
  return update
}

async function resetMagicLinkEmailDeliveries({
  year,
  type,
  ids = []
} = {}) {
  if (!isAccessLinkType(type)) {
    throw new Error('Type de magic link invalide.')
  }

  const normalizedYear = Number.parseInt(year, 10)
  if (!Number.isInteger(normalizedYear)) {
    throw new Error('Annee invalide pour reset envois magic link.')
  }

  const rawIds = (Array.isArray(ids) ? ids : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean)
  const normalizedIds = rawIds
    .filter((id) => mongoose.isObjectIdOrHexString(id))
  const updatedAt = new Date()

  if (rawIds.length > 0 && normalizedIds.length === 0) {
    return {
      matchedCount: 0,
      modifiedCount: 0,
      resetAt: updatedAt.toISOString()
    }
  }

  const query = {
    year: normalizedYear,
    type,
    emailDeliveryStatus: { $in: ['sent', 'failed', 'skipped', 'pending'] }
  }

  if (normalizedIds.length > 0) {
    query._id = { $in: normalizedIds }
  }

  const result = await MagicLink.updateMany(query, {
    $set: {
      emailDeliveryStatus: '',
      emailSentAt: null,
      emailDeliveryError: '',
      emailMessageId: '',
      updatedAt
    }
  })

  return {
    matchedCount: Number(result.matchedCount ?? result.n ?? 0),
    modifiedCount: getModifiedCount(result),
    resetAt: updatedAt.toISOString()
  }
}

async function listSoutenancePublicationAccessLinkStats({
  year,
  sources = []
} = {}) {
  const normalizedYear = Number.parseInt(year, 10)
  if (!Number.isInteger(normalizedYear)) {
    throw new Error('Annee invalide pour statistiques magic links.')
  }

  const now = new Date()
  const query = {
    year: normalizedYear,
    type: ACCESS_LINK_TYPES.SOUTENANCE,
    'scope.kind': 'published_soutenances'
  }

  const normalizedSources = normalizeSourceFilters(sources)
  if (normalizedSources.length > 0) {
    query['scope.source'] = { $in: normalizedSources }
  }

  const activeUsableExpression = {
    $and: [
      { $eq: ['$revokedAt', null] },
      { $gt: ['$expiresAt', now] },
      {
        $or: [
          { $lte: ['$maxUses', 0] },
          { $lt: ['$usageCount', '$maxUses'] }
        ]
      }
    ]
  }
  const rawTokenAvailableExpression = {
    $gt: [
      { $strLenCP: { $ifNull: ['$rawToken', ''] } },
      0
    ]
  }

  const rows = await MagicLink.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$scope.publicationVersion',
        totalGeneratedLinkCount: { $sum: 1 },
        generatedLinkCount: {
          $sum: { $cond: [activeUsableExpression, 1, 0] }
        },
        recoverableGeneratedLinkCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  activeUsableExpression,
                  rawTokenAvailableExpression
                ]
              },
              1,
              0
            ]
          }
        },
        unrecoverableGeneratedLinkCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  activeUsableExpression,
                  { $not: [rawTokenAvailableExpression] }
                ]
              },
              1,
              0
            ]
          }
        },
        expiredGeneratedLinkCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$revokedAt', null] },
                  { $lte: ['$expiresAt', now] }
                ]
              },
              1,
              0
            ]
          }
        },
        revokedGeneratedLinkCount: {
          $sum: {
            $cond: [
              { $ne: ['$revokedAt', null] },
              1,
              0
            ]
          }
        },
        exhaustedGeneratedLinkCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$revokedAt', null] },
                  { $gt: ['$expiresAt', now] },
                  { $gt: ['$maxUses', 0] },
                  { $gte: ['$usageCount', '$maxUses'] }
                ]
              },
              1,
              0
            ]
          }
        },
        earliestExpiry: { $min: '$expiresAt' },
        latestExpiry: { $max: '$expiresAt' }
      }
    },
    { $sort: { _id: -1 } }
  ])

  return (rows || [])
    .map((row) => ({
      publicationVersion: Number.parseInt(row?._id, 10),
      totalGeneratedLinkCount: Number(row?.totalGeneratedLinkCount || 0),
      generatedLinkCount: Number(row?.generatedLinkCount || 0),
      recoverableGeneratedLinkCount: Number(row?.recoverableGeneratedLinkCount || 0),
      unrecoverableGeneratedLinkCount: Number(row?.unrecoverableGeneratedLinkCount || 0),
      expiredGeneratedLinkCount: Number(row?.expiredGeneratedLinkCount || 0),
      revokedGeneratedLinkCount: Number(row?.revokedGeneratedLinkCount || 0),
      exhaustedGeneratedLinkCount: Number(row?.exhaustedGeneratedLinkCount || 0),
      earliestExpiry: row?.earliestExpiry || null,
      latestExpiry: row?.latestExpiry || null
    }))
    .filter((row) => Number.isInteger(row.publicationVersion) && row.publicationVersion > 0)
}

function isTokenLooksValid(rawToken) {
  return (
    typeof rawToken === 'string' &&
    rawToken.trim().length >= 32 &&
    rawToken.trim().length <= 256
  )
}

async function resolveMagicLink(rawToken, context = {}) {
  const normalizedToken = typeof rawToken === 'string' ? rawToken.trim() : ''

  if (!isTokenLooksValid(rawToken)) {
    await logAccessLinkAttempt({
      status: 'invalid',
      reason: 'Token invalide.',
      tokenHash: normalizedToken ? hashToken(normalizedToken) : '',
      context
    })

    const error = new Error('Token invalide.')
    error.statusCode = 400
    throw error
  }

  const tokenHash = hashToken(normalizedToken)
  const now = new Date()

  const magicLink = await MagicLink.findOne({ tokenHash })

  if (!magicLink) {
    await logAccessLinkAttempt({
      status: 'not_found',
      reason: 'Magic link introuvable.',
      tokenHash,
      context
    })

    const error = new Error('Magic link introuvable.')
    error.statusCode = 404
    throw error
  }

  if (magicLink.revokedAt) {
    await logAccessLinkAttempt({
      status: 'revoked',
      reason: 'Magic link revoque.',
      tokenHash,
      link: magicLink,
      context
    })

    const error = new Error('Magic link revoque.')
    error.statusCode = 410
    throw error
  }

  if (magicLink.expiresAt.getTime() <= now.getTime()) {
    await logAccessLinkAttempt({
      status: 'expired',
      reason: 'Magic link expire.',
      tokenHash,
      link: magicLink,
      context
    })

    const error = new Error('Magic link expire.')
    error.statusCode = 410
    throw error
  }

  if (magicLink.maxUses > 0 && magicLink.usageCount >= magicLink.maxUses) {
    await logAccessLinkAttempt({
      status: 'exhausted',
      reason: 'Magic link deja consomme.',
      tokenHash,
      link: magicLink,
      context
    })

    const error = new Error('Magic link deja consomme.')
    error.statusCode = 410
    throw error
  }

  const usageReserved = await reserveMagicLinkUsage(magicLink, now)

  if (!usageReserved) {
    await logAccessLinkAttempt({
      status: 'exhausted',
      reason: 'Magic link deja consomme.',
      tokenHash,
      link: magicLink,
      context
    })

    const error = new Error('Magic link deja consomme.')
    error.statusCode = 410
    throw error
  }

  magicLink.usageCount = Number(magicLink.usageCount || 0) + 1
  magicLink.lastUsedAt = now

  await logAccessLinkAttempt({
    status: 'success',
    tokenHash,
    link: magicLink,
    context
  })

  let person = null
  if (magicLink.personId) {
    person = await Person.findById(magicLink.personId)
  }

  return {
    link: magicLink.toObject(),
    person
  }
}

module.exports = {
  DEFAULT_EXPIRY_HOURS,
  DEFAULT_MAX_USES,
  buildEnvAccessLinkFallback,
  createTypedMagicLink,
  createVoteMagicLink,
  createSoutenanceMagicLink,
  revokeActiveMagicLinks,
  findReusableMagicLink,
  findLatestMagicLinkStatus,
  findMagicLinkForEmailDelivery,
  markMagicLinkEmailDelivery,
  resetMagicLinkEmailDeliveries,
  listSoutenancePublicationAccessLinkStats,
  listAccessLogs,
  logAccessLinkAttempt,
  resolveMagicLink,
  isTokenLooksValid
}
