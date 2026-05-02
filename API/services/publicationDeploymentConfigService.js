const crypto = require('crypto')
const mongoose = require('mongoose')
const { ensureDatabaseConnection } = require('../config/dbConfig')
const PublicationDeploymentConfig = require('../models/publicationDeploymentConfigModel')
const PlanningSharedCatalog = require('../models/planningSharedCatalogModel')

const CONFIG_KEY = 'static-publication'
const DEFAULT_PUBLIC_BASE_URL = 'https://tpi26.ch'
const SUPPORTED_PROTOCOLS = new Set(['ftp', 'ftps', 'sftp', 'ssh'])

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function normalizeProtocol(value, fallback = 'ftp') {
  const normalized = compactText(value).toLowerCase()
  return SUPPORTED_PROTOCOLS.has(normalized) ? normalized : fallback
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function getDefaultPort(protocol = 'ftp') {
  return ['sftp', 'ssh'].includes(protocol) ? 22 : 21
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

function normalizePublicPath(value) {
  const rawValue = compactText(value)
  if (!rawValue) {
    return ''
  }

  const normalized = rawValue
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')

  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

function getEncryptionSecret() {
  return compactText(
    process.env.PUBLICATION_DEPLOYMENT_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    'tpiorganizer-local-publication-config'
  )
}

function getEncryptionKey() {
  return crypto.createHash('sha256').update(getEncryptionSecret()).digest()
}

function encryptSecret(value) {
  const rawValue = compactText(value)
  if (!rawValue) {
    return ''
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(rawValue, 'utf8'),
    cipher.final()
  ])
  const tag = cipher.getAuthTag()

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url')
  ].join(':')
}

function decryptSecret(value) {
  const encryptedValue = compactText(value)
  if (!encryptedValue) {
    return ''
  }

  const parts = encryptedValue.split(':')
  if (parts.length !== 4 || parts[0] !== 'v1') {
    return encryptedValue
  }

  const [, ivPart, tagPart, encryptedPart] = parts
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivPart, 'base64url')
  )
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final()
  ]).toString('utf8')
}

function buildEnvDeploymentConfig() {
  const protocol = normalizeProtocol(
    process.env.PUBLICATION_FTP_PROTOCOL ||
    process.env.FTP_PROTOCOL ||
    'ftp'
  )

  return {
    key: CONFIG_KEY,
    protocol,
    host: compactText(process.env.FTP_HOST),
    port: parsePositiveInteger(process.env.FTP_PORT, getDefaultPort(protocol)),
    username: compactText(process.env.FTP_USER),
    password: compactText(process.env.FTP_PASSWORD),
    passwordEncrypted: '',
    passwordUpdatedAt: null,
    remoteDir: compactText(process.env.FTP_REMOTE_DIR),
    staticRemoteDir: compactText(process.env.FTP_STATIC_REMOTE_DIR),
    publicBaseUrl: normalizePublicBaseUrl(
      process.env.STATIC_PUBLIC_BASE_URL ||
      process.env.PUBLIC_SITE_BASE_URL ||
      DEFAULT_PUBLIC_BASE_URL
    ),
    publicPath: normalizePublicPath(
      process.env.STATIC_PUBLIC_PATH ||
      process.env.STATIC_PUBLICATION_PUBLIC_PATH ||
      process.env.FTP_STATIC_PUBLIC_PATH
    )
  }
}

function normalizeDeploymentConfig(value = {}, fallback = buildEnvDeploymentConfig(), options = {}) {
  const source = value && typeof value === 'object' ? value : {}
  const fallbackSource = fallback && typeof fallback === 'object'
    ? fallback
    : buildEnvDeploymentConfig()
  const protocol = normalizeProtocol(source.protocol, normalizeProtocol(fallbackSource.protocol))
  const rawPassword = compactText(source.password)
  const clearPassword = source.clearPassword === true
  const fallbackEncrypted = compactText(fallbackSource.passwordEncrypted)
  const passwordEncrypted = clearPassword
    ? ''
    : rawPassword
      ? encryptSecret(rawPassword)
      : fallbackEncrypted
  const fallbackPassword = compactText(fallbackSource.password)

  return {
    key: CONFIG_KEY,
    protocol,
    host: compactText(source.host ?? fallbackSource.host),
    port: parsePositiveInteger(source.port, parsePositiveInteger(fallbackSource.port, getDefaultPort(protocol))),
    username: compactText(source.username ?? source.user ?? fallbackSource.username ?? fallbackSource.user),
    password: options.includeSecret
      ? (rawPassword || (passwordEncrypted ? decryptSecret(passwordEncrypted) : fallbackPassword))
      : '',
    passwordEncrypted,
    passwordUpdatedAt: rawPassword
      ? new Date()
      : clearPassword
        ? null
        : fallbackSource.passwordUpdatedAt || null,
    remoteDir: compactText(source.remoteDir ?? fallbackSource.remoteDir),
    staticRemoteDir: compactText(source.staticRemoteDir ?? source.staticDir ?? fallbackSource.staticRemoteDir),
    publicBaseUrl: normalizePublicBaseUrl(
      source.publicBaseUrl ?? source.staticPublicBaseUrl ?? source.publicSiteBaseUrl,
      fallbackSource.publicBaseUrl
    ),
    publicPath: normalizePublicPath(
      source.publicPath ?? source.staticPublicPath ?? fallbackSource.publicPath
    )
  }
}

function toPublicDeploymentConfig(config = {}) {
  const normalized = normalizeDeploymentConfig(config, buildEnvDeploymentConfig(), { includeSecret: false })

  return {
    key: CONFIG_KEY,
    protocol: normalized.protocol,
    host: normalized.host,
    port: normalized.port,
    username: normalized.username,
    hasPassword: Boolean(compactText(normalized.passwordEncrypted) || compactText(config.password)),
    passwordUpdatedAt: normalized.passwordUpdatedAt
      ? new Date(normalized.passwordUpdatedAt).toISOString()
      : null,
    remoteDir: normalized.remoteDir,
    staticRemoteDir: normalized.staticRemoteDir,
    publicBaseUrl: normalized.publicBaseUrl,
    publicPath: normalized.publicPath
  }
}

async function findStoredConfig() {
  return await PublicationDeploymentConfig.findOne({ key: CONFIG_KEY })
    .select('+passwordEncrypted')
    .lean()
}

async function getPublicationDeploymentConfig({ includeSecret = false } = {}) {
  await ensureDatabaseConnection({
    errorMessage: 'Configuration de publication indisponible: connexion MongoDB impossible.'
  })

  const envFallback = buildEnvDeploymentConfig()
  const document = await findStoredConfig()
  const normalized = normalizeDeploymentConfig(document || {}, envFallback, { includeSecret })

  return includeSecret ? normalized : toPublicDeploymentConfig(normalized)
}

async function getPublicationDeploymentConfigIfAvailable({ includeSecret = false } = {}) {
  const envFallback = buildEnvDeploymentConfig()

  if (mongoose.connection.readyState !== 1) {
    return includeSecret ? envFallback : toPublicDeploymentConfig(envFallback)
  }

  try {
    return await getPublicationDeploymentConfig({ includeSecret })
  } catch (error) {
    if (error?.code !== 'DATABASE_UNAVAILABLE' && error?.statusCode !== 503) {
      console.warn('Configuration de publication indisponible:', error.message)
    }
    return includeSecret ? envFallback : toPublicDeploymentConfig(envFallback)
  }
}

async function syncSharedPublicationSettings(publicBaseUrl) {
  const normalizedPublicBaseUrl = normalizePublicBaseUrl(publicBaseUrl)

  await PlanningSharedCatalog.findOneAndUpdate(
    { key: 'shared' },
    {
      $set: {
        'publicationSettings.publicBaseUrl': normalizedPublicBaseUrl
      },
      $setOnInsert: {
        key: 'shared',
        schemaVersion: 2,
        sites: []
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  )
}

async function savePublicationDeploymentConfig(payload = {}) {
  await ensureDatabaseConnection({
    errorMessage: 'Configuration de publication indisponible: connexion MongoDB impossible.'
  })

  const envFallback = buildEnvDeploymentConfig()
  const existing = await findStoredConfig()
  const fallback = normalizeDeploymentConfig(existing || {}, envFallback, { includeSecret: false })
  const normalized = normalizeDeploymentConfig(payload, fallback, { includeSecret: false })

  const document = await PublicationDeploymentConfig.findOneAndUpdate(
    { key: CONFIG_KEY },
    {
      key: CONFIG_KEY,
      protocol: normalized.protocol,
      host: normalized.host,
      port: normalized.port,
      username: normalized.username,
      passwordEncrypted: normalized.passwordEncrypted,
      passwordUpdatedAt: normalized.passwordUpdatedAt,
      remoteDir: normalized.remoteDir,
      staticRemoteDir: normalized.staticRemoteDir,
      publicBaseUrl: normalized.publicBaseUrl,
      publicPath: normalized.publicPath,
      updatedAt: new Date()
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  ).select('+passwordEncrypted')

  await syncSharedPublicationSettings(normalized.publicBaseUrl)

  return toPublicDeploymentConfig(document?.toObject ? document.toObject() : document)
}

module.exports = {
  buildEnvDeploymentConfig,
  getPublicationDeploymentConfig,
  getPublicationDeploymentConfigIfAvailable,
  normalizeDeploymentConfig,
  normalizeProtocol,
  normalizePublicBaseUrl,
  savePublicationDeploymentConfig,
  toPublicDeploymentConfig
}
