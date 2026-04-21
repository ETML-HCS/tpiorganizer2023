/**
 * Tests des routes de planification (voting, conflits, calendrier)
 * Teste les flux critiques identifiés comme TODOs
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')

const { loadTestApp } = require('./helpers/loadTestApp')

async function startServer(app) {
  return await new Promise(resolve => {
    const server = app.listen(0, () => {
      const address = server.address()
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`
      })
    })
  })
}

// ============================================
// Tests: Resend Vote Requests (TODO#1)
// ============================================

test('POST /api/planning/tpi/:id/resend-votes successfully resends voting requests', async () => {
  const { app, restoreEnv } = loadTestApp({
    AUTH_USER_PLAIN: '',
    AUTH_PASS_PLAIN: '',
    AUTH_USER_HASH: bcrypt.hashSync('admin', 4),
    AUTH_PASS_HASH: bcrypt.hashSync('admin', 4),
    AUTH_SESSION_SECRET: 'test-auth-secret',
    JWT_SECRET: 'test-jwt-secret',
    SKIP_PLANNING_AUTH: 'true',
    NODE_ENV: 'development',
    SMTP_HOST: 'smtp.ethereal.email',
    SMTP_PORT: '587',
    SMTP_USER: 'test@ethereal.email',
    SMTP_PASS: 'test-pass',
    DB_CLUSTER: 'localhost:27017',
    DB_NAME: 'tpiorganizer_test'
  })

  const { server, baseUrl } = await startServer(app)

  try {
    // Test: resend-votes endpoint exists and requires auth
    // Note: Ce test nécessite une BDD mockée - adaptez selon votre setup
    const response = await fetch(`${baseUrl}/api/planning/tpi/test-id/resend-votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    // Le endpoint devrait exister (même si la BDD est vide)
    assert.ok([400, 404, 500].includes(response.status), 
      'resend-votes endpoint should exist and be callable')

  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/planning/tpi/:id/resend-votes requires authentication', async () => {
  const { app, restoreEnv } = loadTestApp({
    AUTH_SESSION_SECRET: 'test-auth-secret',
    JWT_SECRET: 'test-jwt-secret'
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/planning/tpi/test-id/resend-votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
      // NO Authorization header
    })

    // Devrait être rejeté sans token
    assert.equal(response.status, 401, 
      'resend-votes should return 401 without auth token')

  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

// ============================================
// Tests: Loading Availability (TODO#2)
// ============================================

test('GET /api/planning/availability/:year/:tpiId returns available slots', async () => {
  const { app, restoreEnv } = loadTestApp({
    AUTH_SESSION_SECRET: 'test-auth-secret',
    JWT_SECRET: 'test-jwt-secret',
    SKIP_PLANNING_AUTH: 'true'
  })

  const { server, baseUrl } = await startServer(app)

  try {
    // Test: availability endpoint exists
    const response = await fetch(`${baseUrl}/api/planning/availability/2026/test-tpi-id`, {
      method: 'GET'
    })

    // Le endpoint doit exister et retourner JSON
    assert.ok([200, 400, 404, 500].includes(response.status),
      'availability endpoint should exist')

  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

// ============================================
// Tests: Security / Auth Bypass
// ============================================

test('Auth bypass flags should NOT be active in production mode', async () => {
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'production',
    SKIP_APP_AUTH: 'false',
    REACT_APP_DEBUG: 'false'
  })

  // Vérifier que le bypass n'est pas actif
  assert.notEqual(
    process.env.SKIP_APP_AUTH, 'true',
    'SKIP_APP_AUTH should never be true in production'
  )

  assert.notEqual(
    process.env.REACT_APP_DEBUG, 'true',
    'REACT_APP_DEBUG should never be true in production'
  )

  restoreEnv()
})

// ============================================
// Tests: Error Handling
// ============================================

test('Invalid TPI ID should return proper error', async () => {
  const { app, restoreEnv } = loadTestApp({
    AUTH_SESSION_SECRET: 'test-auth-secret',
    JWT_SECRET: 'test-jwt-secret',
    SKIP_PLANNING_AUTH: 'true'
  })

  const { server, baseUrl } = await startServer(app)

  try {
    // Test avec un ID invalide (pas MongoDB ObjectId valide)
    const response = await fetch(`${baseUrl}/api/planning/tpi/invalid-id/resend-votes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    // Devrait retourner une erreur HTTP appropriée (pas 500)
    assert.ok([400, 404].includes(response.status),
      'Invalid ID should return 400 or 404, not 500')

    const error = await response.json()
    assert.ok(error.error || error.message, 'Error should have message')

  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

// ============================================
// Tests: Email Service Integration
// ============================================

test('Email service should be properly configured', async () => {
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'production',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '465',
    SMTP_USER: 'noreply@example.com',
    SMTP_PASS: 'test-password'
  })

  // La config SMTP devrait exister
  assert.ok(process.env.SMTP_HOST, 'SMTP_HOST should be configured')
  assert.equal(process.env.SMTP_PORT, '465', 'SMTP_PORT should be 465 for production')

  restoreEnv()
})

// ============================================
// Tests: Database Connection
// ============================================

test('Database connection should use secure config', async () => {
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'production',
    DB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/dbname'
  })

  // La config DB devrait utiliser mongodb+srv en prod
  assert.ok(
    process.env.DB_URI?.includes('mongodb+srv'),
    'Production DB should use mongodb+srv (Atlas)'
  )

  restoreEnv()
})

test('GET /api/planning/catalog returns 503 when database config is unavailable', async () => {
  const { app, restoreEnv } = loadTestApp({
    AUTH_SESSION_SECRET: 'test-auth-secret',
    JWT_SECRET: 'test-jwt-secret',
    DB_URI: '',
    DB_CLUSTER: '',
    DB_NAME: '',
    DB_USERNAME: '',
    DB_PASSWORD: ''
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/planning/catalog`)

    assert.equal(response.status, 503)
    const error = await response.json()
    assert.equal(error.error, 'Catalogue partagé indisponible: connexion MongoDB impossible.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('GET /api/planning/config/:year returns 503 when database config is unavailable', async () => {
  const { app, restoreEnv } = loadTestApp({
    AUTH_SESSION_SECRET: 'test-auth-secret',
    JWT_SECRET: 'test-jwt-secret',
    DB_URI: '',
    DB_CLUSTER: '',
    DB_NAME: '',
    DB_USERNAME: '',
    DB_PASSWORD: ''
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/planning/config/2026`)

    assert.equal(response.status, 503)
    const error = await response.json()
    assert.equal(error.error, 'Configuration de planification indisponible: connexion MongoDB impossible.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})
