const crypto = require('crypto')

const Person = require('../models/personModel')
const { MagicLink } = require('../models/magicLinkModel')

const DEFAULT_EXPIRY_HOURS = Object.freeze({
  vote: 24 * 7,
  soutenance: 24 * 30
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

async function createTypedMagicLink({
  type,
  year,
  baseUrl,
  redirectPath,
  person,
  role = null,
  scope = {},
  maxUses = null,
  expiresInHours = null
}) {
  if (!['vote', 'soutenance'].includes(type)) {
    throw new Error('Type de magic link invalide.')
  }

  if (!person?.email) {
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
    type,
    year,
    recipientEmail: String(person.email).toLowerCase(),
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
  redirectPath = null
}) {
  return await createTypedMagicLink({
    type: 'vote',
    year,
    baseUrl,
    redirectPath: redirectPath || `/planning/${year}`,
    person,
    role,
    scope
  })
}

async function createSoutenanceMagicLink({ year, person, scope = {}, baseUrl }) {
  return await createTypedMagicLink({
    type: 'soutenance',
    year,
    baseUrl,
    redirectPath: `/Soutenances/${year}`,
    person,
    role: null,
    scope
  })
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
  resolveMagicLink,
  isTokenLooksValid
}
