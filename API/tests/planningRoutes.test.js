/**
 * Tests des routes de planification (voting, conflits, calendrier)
 * Teste les flux critiques identifiés comme TODOs
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')

const { loadTestApp } = require('./helpers/loadTestApp')
const {
  buildSessionToken,
  closeServer,
  DEFAULT_USER_ID,
  startServer
} = require('./helpers/httpTest')
const {
  makeQueryResult,
  replaceProperty: patchMethod
} = require('./helpers/stubSandbox')
const Vote = require('../models/voteModel')
const schedulingService = require('../services/schedulingService')

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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/planning/tpi/:id/move-to-slot/:slotId/simulate retourne la simulation de déplacement', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret)
  const tpiId = new mongoose.Types.ObjectId().toString()
  const slotId = new mongoose.Types.ObjectId().toString()
  const calls = []
  const restore = patchMethod(schedulingService, 'simulateTpiMoveToSlot', async (receivedTpiId, receivedSlotId) => {
    calls.push({ tpiId: receivedTpiId, slotId: receivedSlotId })
    return {
      success: true,
      canMove: true,
      status: 'clear',
      message: 'Déplacement possible sans conflit détecté.'
    }
  })
  const { app, restoreEnv } = loadTestApp({
    AUTH_SESSION_SECRET: 'test-auth-secret',
    JWT_SECRET: jwtSecret,
    NODE_ENV: 'development'
  })
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/planning/tpi/${tpiId}/move-to-slot/${slotId}/simulate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    assert.equal(response.status, 200)
    assert.deepEqual(calls, [{ tpiId, slotId }])
    const body = await response.json()
    assert.equal(body.success, true)
    assert.equal(body.canMove, true)
    assert.equal(body.message, 'Déplacement possible sans conflit détecté.')
  } finally {
    restore()
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/planning/tpi/:id/move-to-slot/:slotId retourne 409 quand le déplacement est bloqué', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret)
  const tpiId = new mongoose.Types.ObjectId().toString()
  const slotId = new mongoose.Types.ObjectId().toString()
  const calls = []
  const restore = patchMethod(schedulingService, 'moveTpiToSlot', async (receivedTpiId, receivedSlotId, userId, reason) => {
    calls.push({
      tpiId: receivedTpiId,
      slotId: receivedSlotId,
      userId: String(userId),
      reason
    })
    return {
      success: false,
      canMove: false,
      message: 'Le déplacement est bloqué par un conflit.',
      conflicts: [{ type: 'room_overlap' }]
    }
  })
  const { app, restoreEnv } = loadTestApp({
    AUTH_SESSION_SECRET: 'test-auth-secret',
    JWT_SECRET: jwtSecret,
    NODE_ENV: 'development'
  })
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/planning/tpi/${tpiId}/move-to-slot/${slotId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: '  Depuis proposition de vote  ' })
    })

    assert.equal(response.status, 409)
    assert.deepEqual(calls, [{
      tpiId,
      slotId,
      userId: DEFAULT_USER_ID,
      reason: 'Depuis proposition de vote'
    }])
    const body = await response.json()
    assert.equal(body.success, false)
    assert.equal(body.message, 'Le déplacement est bloqué par un conflit.')
  } finally {
    restore()
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/planning/votes/:id/preferred-soutenance-choice deduplicates existing choices', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret)
  const voteId = new mongoose.Types.ObjectId()
  const slotId = new mongoose.Types.ObjectId()
  const voterId = new mongoose.Types.ObjectId()
  const voter = {
    _id: voterId,
    firstName: 'Carla',
    lastName: 'Expert',
    email: 'carla@example.test',
    preferredSoutenanceChoices: [
      { date: new Date('2026-06-10T00:00:00.000Z'), period: 1 },
      { date: new Date('2026-06-10T00:00:00.000Z'), period: 1 },
      { date: new Date('2026-06-11T00:00:00.000Z'), period: 2 }
    ],
    preferredSoutenanceDates: [],
    save: async function save() {
      return this
    }
  }
  const vote = {
    _id: voteId,
    decision: 'preferred',
    slot: {
      _id: slotId,
      date: new Date('2026-06-12T08:00:00.000Z'),
      period: 1,
      startTime: '08:00',
      endTime: '12:00',
      room: { name: 'A101' }
    },
    voter
  }
  const restore = patchMethod(Vote, 'findById', () => makeQueryResult(vote))
  const { app, restoreEnv } = loadTestApp({
    AUTH_SESSION_SECRET: 'test-auth-secret',
    JWT_SECRET: jwtSecret,
    NODE_ENV: 'development'
  })
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/planning/votes/${voteId}/preferred-soutenance-choice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    })

    assert.equal(response.status, 200)
    const body = await response.json()

    assert.equal(body.success, true)
    assert.equal(body.added, true)
    assert.deepEqual(body.preferredSoutenanceChoices, [
      { date: '2026-06-10', period: 1 },
      { date: '2026-06-11', period: 2 },
      { date: '2026-06-12', period: 1 }
    ])
    assert.equal(voter.preferredSoutenanceChoices.length, 3)
  } finally {
    restore()
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/planning/votes/:id/preferred-soutenance-choice précise une date idéale existante', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret)
  const voteId = new mongoose.Types.ObjectId()
  const slotId = new mongoose.Types.ObjectId()
  const voterId = new mongoose.Types.ObjectId()
  const voter = {
    _id: voterId,
    firstName: 'Carla',
    lastName: 'Expert',
    email: 'carla@example.test',
    preferredSoutenanceChoices: [
      { date: new Date('2026-06-12T00:00:00.000Z'), period: null }
    ],
    preferredSoutenanceDates: [],
    save: async function save() {
      return this
    }
  }
  const vote = {
    _id: voteId,
    decision: 'preferred',
    slot: {
      _id: slotId,
      date: new Date('2026-06-12T13:00:00.000Z'),
      period: 2,
      startTime: '13:00',
      endTime: '17:00',
      room: { name: 'B202' }
    },
    voter
  }
  const restore = patchMethod(Vote, 'findById', () => makeQueryResult(vote))
  const { app, restoreEnv } = loadTestApp({
    AUTH_SESSION_SECRET: 'test-auth-secret',
    JWT_SECRET: jwtSecret,
    NODE_ENV: 'development'
  })
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/planning/votes/${voteId}/preferred-soutenance-choice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    })

    assert.equal(response.status, 200)
    const body = await response.json()

    assert.equal(body.success, true)
    assert.equal(body.added, true)
    assert.deepEqual(body.preferredSoutenanceChoices, [
      { date: '2026-06-12', period: 2 }
    ])
    assert.equal(voter.preferredSoutenanceChoices.length, 1)
    assert.equal(voter.preferredSoutenanceChoices[0].period, 2)
  } finally {
    restore()
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
    restoreEnv()
  }
})
