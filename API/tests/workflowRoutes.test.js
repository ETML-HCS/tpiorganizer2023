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

test('GET /api/workflow/:year rejects invalid year format', async () => {
  const jwtSecret = 'test-jwt-secret'
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/not-a-year`)

    assert.equal(response.status, 400)
    const body = await response.json()
    assert.equal(body.error, 'Ann\u00e9e invalide.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('GET /api/workflow/:year/planification/validate rejects invalid year format', async () => {
  const jwtSecret = 'test-jwt-secret'
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/not-a-year/planification/validate`)

    assert.equal(response.status, 400)
    const body = await response.json()
    assert.equal(body.error, 'Ann\u00e9e invalide.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/planification/freeze requires authentication', async () => {
  const jwtSecret = 'test-jwt-secret'
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/planification/freeze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    assert.equal(response.status, 401)
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/planification/freeze enforces admin role', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['expert1'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/planification/freeze`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    assert.equal(response.status, 403)
    const body = await response.json()
    assert.equal(body.error, 'Acc\u00e8s non autoris\u00e9')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/votes/start requires authentication', async () => {
  const jwtSecret = 'test-jwt-secret'
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/votes/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    assert.equal(response.status, 401)
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/votes/start enforces admin role', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['expert1'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/votes/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    assert.equal(response.status, 403)
    const body = await response.json()
    assert.equal(body.error, 'Acc\u00e8s non autoris\u00e9')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/votes/close requires authentication', async () => {
  const jwtSecret = 'test-jwt-secret'
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/votes/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    assert.equal(response.status, 401)
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/publication/publish requires authentication', async () => {
  const jwtSecret = 'test-jwt-secret'
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/publication/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    assert.equal(response.status, 401)
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/publication/publish enforces admin role', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['expert1'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/publication/publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    assert.equal(response.status, 403)
    const body = await response.json()
    assert.equal(body.error, 'Acc\u00e8s non autoris\u00e9')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/publication/send-links requires authentication', async () => {
  const jwtSecret = 'test-jwt-secret'
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/publication/send-links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    assert.equal(response.status, 401)
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/transition requires authentication', async () => {
  const jwtSecret = 'test-jwt-secret'
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/transition`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetState: 'voting_open' })
    })

    assert.equal(response.status, 401)
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/transition enforces admin role', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['expert1'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/transition`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetState: 'voting_open' })
    })

    assert.equal(response.status, 403)
    const body = await response.json()
    assert.equal(body.error, 'Acc\u00e8s non autoris\u00e9')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/transition validates targetState', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/transition`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetState: 'invalid_state' })
    })

    assert.equal(response.status, 400)
    const body = await response.json()
    assert.equal(body.error, 'Etat workflow invalide.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})
