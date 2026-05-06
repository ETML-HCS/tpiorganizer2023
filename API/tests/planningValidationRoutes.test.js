const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')

const { loadTestApp } = require('./helpers/loadTestApp')
const schedulingService = require('../services/schedulingService')
const emailService = require('../services/emailService')

const VALID_OBJECT_ID = '507f1f77bcf86cd799439011'

function patchMethod(target, key, implementation) {
  const original = target[key]
  target[key] = implementation
  return () => {
    target[key] = original
  }
}

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

function buildSessionToken(secret, roles = ['admin']) {
  return jwt.sign(
    {
      id: VALID_OBJECT_ID,
      email: 'planner@example.com',
      roles
    },
    secret,
    { expiresIn: '1h' }
  )
}

test('GET /api/coordination/slots/:year rejects invalid year format', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret)
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/coordination/slots/not-a-year`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    assert.equal(response.status, 400)
    const error = await response.json()
    assert.equal(error.error, 'Année invalide.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('GET /api/coordination/slots/:year rejects invalid date query', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret)
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(
      `${baseUrl}/api/coordination/slots/2026?date=invalid-date`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    assert.equal(response.status, 400)
    const error = await response.json()
    assert.equal(error.error, 'Date invalide.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/coordination/votes/bulk validates vote IDs before DB access', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['expert1'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/coordination/votes/bulk`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        votes: [
          { voteId: 'invalid-id', decision: 'accepted' }
        ]
      })
    })

    assert.equal(response.status, 400)
    const error = await response.json()
    assert.equal(error.error, 'voteId invalide dans la liste des votes')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/coordination/assign/:slotId rejects missing or invalid tpiId', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/coordination/assign/${VALID_OBJECT_ID}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    assert.equal(response.status, 400)
    const error = await response.json()
    assert.equal(error.error, 'tpiId invalide')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/coordination/assign/:slotId does not send confirmation emails automatically', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const tpiId = '507f1f77bcf86cd799439012'
  const slotId = '507f1f77bcf86cd799439013'
  const restore = [
    patchMethod(schedulingService, 'confirmSlotForTpi', async (receivedTpiId, receivedSlotId) => {
      assert.equal(receivedTpiId, tpiId)
      assert.equal(receivedSlotId, slotId)
      return {
        success: true,
        slot: { _id: slotId }
      }
    }),
    patchMethod(emailService, 'sendSoutenanceConfirmations', async () => {
      throw new Error('Les confirmations de defense ne doivent pas partir automatiquement.')
    })
  ]
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/coordination/assign/${slotId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tpiId })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.success, true)
    assert.equal(body.emailDelivery.emailsSkipped, true)
    assert.equal(body.emailDelivery.reason, 'automatic_email_sends_disabled')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/coordination/tpi/:id/propose-slots validates maxSlots bounds', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(
      `${baseUrl}/api/coordination/tpi/${VALID_OBJECT_ID}/propose-slots`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ maxSlots: 0 })
      }
    )

    assert.equal(response.status, 400)
    const error = await response.json()
    assert.equal(error.error, 'maxSlots doit être un entier entre 1 et 4')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/coordination/tpi/:id/propose-slots does not send vote emails automatically', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const restore = [
    patchMethod(schedulingService, 'proposeSlotsAndInitiateVoting', async (receivedTpiId, maxSlots) => {
      assert.equal(receivedTpiId, VALID_OBJECT_ID)
      assert.equal(maxSlots, 3)
      return {
        success: true,
        proposedSlots: [{ slot: VALID_OBJECT_ID }]
      }
    }),
    patchMethod(emailService, 'sendVoteRequests', async () => {
      throw new Error('Les demandes de vote ne doivent pas partir automatiquement.')
    })
  ]
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(
      `${baseUrl}/api/coordination/tpi/${VALID_OBJECT_ID}/propose-slots`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ maxSlots: 3 })
      }
    )

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.success, true)
    assert.equal(body.emailDelivery.emailsSkipped, true)
    assert.equal(body.emailDelivery.reason, 'automatic_email_sends_disabled')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})
