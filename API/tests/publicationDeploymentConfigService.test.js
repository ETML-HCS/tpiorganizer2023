const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildEnvDeploymentConfig,
  normalizeDeploymentConfig,
  toPublicDeploymentConfig
} = require('../services/publicationDeploymentConfigService')

const DEPLOYMENT_ENV_KEYS = [
  'FTP_HOST',
  'FTP_PASSWORD',
  'FTP_PORT',
  'FTP_PROTOCOL',
  'FTP_REMOTE_DIR',
  'FTP_STATIC_REMOTE_DIR',
  'FTP_USER',
  'PUBLICATION_FTP_PROTOCOL',
  'PUBLIC_SITE_BASE_URL',
  'STATIC_PUBLIC_BASE_URL',
  'STATIC_PUBLIC_PATH',
  'STATIC_PUBLICATION_PUBLIC_PATH'
]

function withDeploymentEnv(values, run) {
  const previousValues = new Map(
    DEPLOYMENT_ENV_KEYS.map((key) => [key, process.env[key]])
  )

  for (const key of DEPLOYMENT_ENV_KEYS) {
    delete process.env[key]
  }

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) {
      process.env[key] = value
    }
  }

  try {
    return run()
  } finally {
    for (const key of DEPLOYMENT_ENV_KEYS) {
      const previousValue = previousValues.get(key)
      if (previousValue === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = previousValue
      }
    }
  }
}

test('buildEnvDeploymentConfig normalise le protocole, le port et les chemins publics', () => {
  withDeploymentEnv({
    PUBLICATION_FTP_PROTOCOL: 'sftp',
    FTP_HOST: ' sftp.example.ch ',
    FTP_USER: ' deploy ',
    FTP_PASSWORD: ' secret ',
    FTP_REMOTE_DIR: '/var/www',
    FTP_STATIC_REMOTE_DIR: 'soutenances-{year}',
    STATIC_PUBLIC_BASE_URL: 'publication.example.ch/',
    STATIC_PUBLICATION_PUBLIC_PATH: 'soutenances-{year}'
  }, () => {
    const config = buildEnvDeploymentConfig()

    assert.equal(config.protocol, 'sftp')
    assert.equal(config.host, 'sftp.example.ch')
    assert.equal(config.port, 22)
    assert.equal(config.username, 'deploy')
    assert.equal(config.password, 'secret')
    assert.equal(config.remoteDir, '/var/www')
    assert.equal(config.staticRemoteDir, 'soutenances-{year}')
    assert.equal(config.publicBaseUrl, 'https://publication.example.ch')
    assert.equal(config.publicPath, '/soutenances-{year}')
  })
})

test('toPublicDeploymentConfig masque le mot de passe chiffre', () => {
  const normalized = normalizeDeploymentConfig(
    {
      protocol: 'ftp',
      host: 'ftp.example.ch',
      username: 'publisher',
      password: 'secret-value',
      publicBaseUrl: 'https://publication.example.ch'
    },
    {
      protocol: 'ftp',
      port: 21,
      publicBaseUrl: 'https://tpi26.ch'
    },
    { includeSecret: true }
  )

  assert.equal(normalized.password, 'secret-value')
  assert.notEqual(normalized.passwordEncrypted, '')

  const publicConfig = toPublicDeploymentConfig(normalized)

  assert.equal(publicConfig.hasPassword, true)
  assert.equal(publicConfig.password, undefined)
  assert.equal(publicConfig.passwordEncrypted, undefined)
  assert.equal(publicConfig.publicBaseUrl, 'https://publication.example.ch')
})

test('normalizeDeploymentConfig peut effacer le mot de passe existant', () => {
  const existing = normalizeDeploymentConfig(
    {
      password: 'secret-value',
      publicBaseUrl: 'https://publication.example.ch'
    },
    {
      protocol: 'ftp',
      port: 21,
      publicBaseUrl: 'https://tpi26.ch'
    }
  )

  const cleared = normalizeDeploymentConfig(
    {
      clearPassword: true
    },
    existing
  )

  assert.equal(cleared.passwordEncrypted, '')
  assert.equal(toPublicDeploymentConfig(cleared).hasPassword, false)
})
