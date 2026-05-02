const crypto = require('crypto')

const Person = require('../models/personModel')
const { MagicLink } = require('../models/magicLinkModel')
const { buildDefensePublicPath } = require('../utils/publicRoutes')

const DEFAULT_EXPIRY_HOURS = Object.freeze({
  vote: 24 * 7,
  soutenance: 24 * 4
})

const DEFAULT_MAX_USES = Object.freeze({
  vote: 20,
  soutenance: 60
})

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
  const envKey = type === 'vote'
    ? 'MAGIC_LINK_VOTE_EXPIRY_HOURS'
    : 'MAGIC_LINK_SOUTENANCE_EXPIRY_HOURS'

  const configured = Number.parseInt(process.env[envKey] || '', 10)
  if (Number.isInteger(configured) && configured > 0) {
    return configured
  }

  return DEFAULT_EXPIRY_HOURS[type] || 24
}

function getMaxUses(type) {
  const envKey = type === 'vote'
    ? 'MAGIC_LINK_VOTE_MAX_USES'
    : 'MAGIC_LINK_SOUTENANCE_MAX_USES'

  const configured = Number.parseInt(process.env[envKey] || '', 10)
  if (Number.isInteger(configured) && configured > 0) {
    return configured
  }

  return DEFAULT_MAX_USES[type] || 1
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
  persistToken = false
}) {
  if (!['vote', 'soutenance'].includes(type)) {
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
  const hours = Number.isInteger(expiresInHours) && expiresInHours > 0
    ? expiresInHours
    : getExpiryHours(type)
  const expiry = new Date(now.getTime() + hours * 60 * 60 * 1000)
  const allowedUses = Number.isInteger(maxUses) && maxUses > 0
    ? maxUses
    : getMaxUses(type)

  const created = await MagicLink.create({
    tokenHash,
    rawToken: persistToken ? token : '',
    type,
    year,
    recipientEmail: normalizedRecipientEmail,
    personId: person?._id || null,
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
  persistToken = false
}) {
  return await createTypedMagicLink({
    type: 'vote',
    year,
    baseUrl,
    redirectPath: redirectPath || `/planning/${year}`,
    person,
    recipientEmail,
    role,
    scope,
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
  persistToken = false
}) {
  return await createTypedMagicLink({
    type: 'soutenance',
    year,
    baseUrl,
    redirectPath: redirectPath || buildDefensePublicPath(year),
    person,
    recipientEmail,
    role: null,
    scope,
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
  if (!['vote', 'soutenance'].includes(type)) {
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

  if (person?._id) {
    query.personId = person._id
  } else if (normalizedRecipientEmail) {
    query.recipientEmail = normalizedRecipientEmail
  } else {
    throw new Error('Personne cible invalide pour revocation magic link.')
  }

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
  if (!['vote', 'soutenance'].includes(type)) {
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

  if (person?._id) {
    query.personId = person._id
  } else if (normalizedRecipientEmail) {
    query.recipientEmail = normalizedRecipientEmail
  } else {
    throw new Error('Personne cible invalide pour magic link.')
  }

  const normalizedSources = normalizeSourceFilters(sources)
  if (normalizedSources.length > 0) {
    query['scope.source'] = { $in: normalizedSources }
  }

  applyScopeFilters(query, scope)

  const links = await MagicLink.find(query)
    .select('+rawToken type year redirectPath expiresAt maxUses usageCount scope createdAt')
    .sort({ createdAt: -1 })
    .lean()

  const reusableLink = (links || []).find(isMagicLinkStillUsable)
  if (!reusableLink) {
    return null
  }

  const rawToken = typeof reusableLink.rawToken === 'string'
    ? reusableLink.rawToken.trim()
    : ''

  return {
    id: reusableLink._id ? String(reusableLink._id) : '',
    token: rawToken || null,
    redirectPath: reusableLink.redirectPath,
    url: rawToken ? buildMagicLinkUrl(baseUrl, reusableLink.redirectPath, rawToken) : null,
    expiresAt: reusableLink.expiresAt,
    type: reusableLink.type,
    generated: true,
    recoverable: Boolean(rawToken)
  }
}

function isTokenLooksValid(rawToken) {
  return (
    typeof rawToken === 'string' &&
    rawToken.trim().length >= 32 &&
    rawToken.trim().length <= 256
  )
}

async function resolveMagicLink(rawToken) {
  if (!isTokenLooksValid(rawToken)) {
    const error = new Error('Token invalide.')
    error.statusCode = 400
    throw error
  }

  const normalizedToken = rawToken.trim()
  const tokenHash = hashToken(normalizedToken)
  const now = new Date()

  const magicLink = await MagicLink.findOne({ tokenHash })

  if (!magicLink) {
    const error = new Error('Magic link introuvable.')
    error.statusCode = 404
    throw error
  }

  if (magicLink.revokedAt) {
    const error = new Error('Magic link revoque.')
    error.statusCode = 410
    throw error
  }

  if (magicLink.expiresAt.getTime() <= now.getTime()) {
    const error = new Error('Magic link expire.')
    error.statusCode = 410
    throw error
  }

  if (magicLink.maxUses > 0 && magicLink.usageCount >= magicLink.maxUses) {
    const error = new Error('Magic link deja consomme.')
    error.statusCode = 410
    throw error
  }

  magicLink.usageCount += 1
  magicLink.lastUsedAt = now
  await magicLink.save()

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
  createTypedMagicLink,
  createVoteMagicLink,
  createSoutenanceMagicLink,
  revokeActiveMagicLinks,
  findReusableMagicLink,
  resolveMagicLink,
  isTokenLooksValid
}
