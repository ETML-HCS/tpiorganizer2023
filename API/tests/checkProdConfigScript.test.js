const assert = require('node:assert/strict')
const test = require('node:test')

const {
  printValidationReport,
  validateProductionConfig
} = require('../../scripts/check-prod-config')

function buildValidProductionEnv(overrides = {}) {
  return {
    NODE_ENV: 'production',
    REACT_APP_DEBUG: 'false',
    SKIP_APP_AUTH: 'false',
    JWT_SECRET: 'x'.repeat(64),
    DB_URI: 'mongodb://localhost:27017/tpi',
    SMTP_HOST: 'smtp.example.ch',
    SMTP_PORT: '465',
    SMTP_USER: 'notifications@example.ch',
    SMTP_PASS: 'smtp-password',
    SMTP_FROM: '"TPI 2026" <notifications@example.ch>',
    CORS_ORIGIN: 'https://admin.example.ch',
    ...overrides
  }
}

test('check-prod-config accepts a complete production config and warns about DKIM when unmanaged', () => {
  const report = validateProductionConfig(buildValidProductionEnv())

  assert.equal(report.valid, true)
  assert.deepEqual(report.errors, [])
  assert.equal(report.warnings.length, 1)
  assert.match(report.warnings[0], /DKIM/)
})

test('check-prod-config validates SMTP sender and envelope addresses', () => {
  const report = validateProductionConfig(buildValidProductionEnv({
    SMTP_FROM: 'not-an-email',
    SMTP_ENVELOPE_FROM: 'bounce@example.ch, attacker@example.ch'
  }))

  assert.equal(report.valid, false)
  assert.ok(report.errors.some(error => error.includes('SMTP_FROM doit contenir')))
  assert.ok(report.errors.some(error => error.includes('SMTP_ENVELOPE_FROM doit contenir')))
})

test('check-prod-config requires complete DKIM settings when one DKIM variable is present', () => {
  const report = validateProductionConfig(buildValidProductionEnv({
    SMTP_DKIM_SELECTOR: 'mail'
  }))

  assert.equal(report.valid, false)
  assert.ok(report.errors.some(error => error.includes('SMTP_DKIM_DOMAIN/SMTP_DKIM_SELECTOR/SMTP_DKIM_PRIVATE_KEY')))
})

test('check-prod-config accepts complete DKIM settings without DKIM warning', () => {
  const report = validateProductionConfig(buildValidProductionEnv({
    SMTP_DKIM_SELECTOR: 'mail',
    SMTP_DKIM_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----'
  }))

  assert.equal(report.valid, true)
  assert.deepEqual(report.errors, [])
  assert.deepEqual(report.warnings, [])
})

test('check-prod-config report printer keeps warnings visible on success and failure', () => {
  const messages = {
    errors: [],
    warnings: [],
    logs: []
  }
  const logger = {
    error: message => messages.errors.push(message),
    warn: message => messages.warnings.push(message),
    log: message => messages.logs.push(message)
  }

  printValidationReport({
    valid: false,
    errors: ['Erreur test'],
    warnings: ['Avertissement test']
  }, logger)

  assert.deepEqual(messages.errors, [
    'Configuration de production invalide:',
    '- Erreur test'
  ])
  assert.deepEqual(messages.warnings, ['Avertissement: Avertissement test'])
  assert.deepEqual(messages.logs, [])
})
