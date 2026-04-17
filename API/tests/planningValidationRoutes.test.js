const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')

const { loadTestApp } = require('./helpers/loadTestApp')

const VALID_OBJECT_ID = '507f1f77bcf86cd799439011'

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

test('GET /api/planning/slots/:year rejects invalid year format', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret)
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/planning/slots/not-a-year`, {
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

test('GET /api/planning/slots/:year rejects invalid date query', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret)
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(
      `${baseUrl}/api/planning/slots/2026?date=invalid-date`,
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

test('POST /api/planning/votes/bulk validates vote IDs before DB access', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['expert1'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/planning/votes/bulk`, {
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

test('POST /api/planning/assign/:slotId rejects missing or invalid tpiId', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/planning/assign/${VALID_OBJECT_ID}`, {
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

test('POST /api/planning/tpi/:id/propose-slots validates maxSlots bounds', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(
      `${baseUrl}/api/planning/tpi/${VALID_OBJECT_ID}/propose-slots`,
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
