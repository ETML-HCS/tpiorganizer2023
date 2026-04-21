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

function patchMethod(target, key, implementation) {
  const original = target[key]
  target[key] = implementation
  return () => {
    target[key] = original
  }
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

test('POST /api/workflow/:year/votes/start accepts skipEmails in debug mode', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret,
    REACT_APP_DEBUG: 'true'
  })

  const workflowService = require('../services/workflowService')
  const planningValidationService = require('../services/planningValidationService')
  const votingCampaignService = require('../services/votingCampaignService')
  const TpiPlanning = require('../models/tpiPlanningModel')

  let receivedOptions = null
  const restore = [
    patchMethod(workflowService, 'getWorkflowYearState', async () => ({ state: 'voting_open' })),
    patchMethod(workflowService, 'logWorkflowAuditEvent', async () => {}),
    patchMethod(planningValidationService, 'getActiveSnapshot', async () => null),
    patchMethod(TpiPlanning, 'countDocuments', async () => 1),
    patchMethod(votingCampaignService, 'startVotesCampaign', async (_year, _baseUrl, options = {}) => {
      receivedOptions = options
      return {
        tpiCount: 2,
        totalEmails: 0,
        successfulEmails: 0,
        failedEmails: 0,
        emailsSkipped: true,
        details: []
      }
    })
  ]

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/votes/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ skipEmails: true })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.success, true)
    assert.equal(body.emailsSkipped, true)
    assert.deepEqual(receivedOptions, { skipEmails: true })
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/votes/start rejects skipEmails outside debug mode', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret,
    REACT_APP_DEBUG: 'false'
  })

  const votingCampaignService = require('../services/votingCampaignService')

  let startVotesCalled = false
  const restore = [
    patchMethod(votingCampaignService, 'startVotesCampaign', async () => {
      startVotesCalled = true
      return {
        tpiCount: 0,
        totalEmails: 0,
        successfulEmails: 0,
        failedEmails: 0,
        details: []
      }
    })
  ]

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/votes/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ skipEmails: true })
    })

    assert.equal(response.status, 403)
    const body = await response.json()
    assert.equal(body.error, 'L ouverture des votes sans emails est indisponible hors mode debug.')
    assert.equal(startVotesCalled, false)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/access-links/preview requires authentication', async () => {
  const jwtSecret = 'test-jwt-secret'
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/access-links/preview`, {
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

test('POST /api/workflow/:year/access-links/preview enforces admin role', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['expert1'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/access-links/preview`, {
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

test('POST /api/workflow/:year/votes/dev-email requires authentication', async () => {
  const jwtSecret = 'test-jwt-secret'
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/votes/dev-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: 'test@example.com' })
    })

    assert.equal(response.status, 401)
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/votes/dev-email enforces admin role', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['expert1'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/votes/dev-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: 'test@example.com' })
    })

    assert.equal(response.status, 403)
    const body = await response.json()
    assert.equal(body.error, 'Acc\u00e8s non autoris\u00e9')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/votes/dev-email is unavailable outside debug mode', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret,
    REACT_APP_DEBUG: 'false'
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/votes/dev-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: 'test@example.com' })
    })

    assert.equal(response.status, 404)
    const body = await response.json()
    assert.equal(body.error, 'Route indisponible.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/publication/dev-email requires authentication', async () => {
  const jwtSecret = 'test-jwt-secret'
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/publication/dev-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: 'test@example.com' })
    })

    assert.equal(response.status, 401)
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/publication/dev-email enforces admin role', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['expert1'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/publication/dev-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: 'test@example.com' })
    })

    assert.equal(response.status, 403)
    const body = await response.json()
    assert.equal(body.error, 'Acc\u00e8s non autoris\u00e9')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/workflow/:year/publication/dev-email is unavailable outside debug mode', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret,
    REACT_APP_DEBUG: 'false'
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/publication/dev-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: 'test@example.com' })
    })

    assert.equal(response.status, 404)
    const body = await response.json()
    assert.equal(body.error, 'Route indisponible.')
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
