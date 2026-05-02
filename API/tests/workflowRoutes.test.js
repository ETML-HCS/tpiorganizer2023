const test = require('node:test')
const assert = require('node:assert/strict')

const { loadTestApp } = require('./helpers/loadTestApp')
const {
  buildSessionToken,
  closeServer,
  startServer
} = require('./helpers/httpTest')
const { replaceProperty: patchMethod } = require('./helpers/stubSandbox')

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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/access-links/generate requires authentication', async () => {
  const jwtSecret = 'test-jwt-secret'
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/access-links/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    assert.equal(response.status, 401)
  } finally {
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/access-links/generate enforces admin role', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['expert1'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/access-links/generate`, {
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
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/access-links/generate rejects publication target without public URL', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const workflowService = require('../services/workflowService')
  const restore = [
    patchMethod(workflowService, 'getWorkflowYearState', async () => ({ state: 'published' }))
  ]
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/access-links/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ soutenanceLinkTarget: 'publication' })
    })

    assert.equal(response.status, 400)
    const body = await response.json()
    assert.equal(body.error, 'URL publique de publication invalide ou absente.')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})

test('GET /api/workflow/static-publication/config requires authentication', async () => {
  const jwtSecret = 'test-jwt-secret'
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/static-publication/config`)

    assert.equal(response.status, 401)
  } finally {
    await closeServer(server)
    restoreEnv()
  }
})

test('PUT /api/workflow/static-publication/config enforces admin role', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['expert1'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/static-publication/config`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ host: 'ftp.example.ch' })
    })

    assert.equal(response.status, 403)
    const body = await response.json()
    assert.equal(body.error, 'Acc\u00e8s non autoris\u00e9')
  } finally {
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/publication/publish waits until all votes are resolved', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const workflowService = require('../services/workflowService')
  const TpiPlanning = require('../models/tpiPlanningModel')
  const restore = [
    patchMethod(workflowService, 'getWorkflowYearState', async () => ({ state: 'voting_open' })),
    patchMethod(TpiPlanning, 'countDocuments', async (query) => {
      assert.equal(query.year, 2026)
      assert.deepEqual(query.status.$in, ['voting', 'pending_validation', 'manual_required'])
      return 1
    })
  ]

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/publication/publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    assert.equal(response.status, 409)
    const body = await response.json()
    assert.equal(
      body.error,
      'Publication bloquee tant que des TPI restent en vote ou en intervention manuelle.'
    )
    assert.equal(body.details.blockingCount, 1)
    assert.deepEqual(body.details.blockingStatuses, ['voting', 'pending_validation', 'manual_required'])
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/publication/publish can publish directly from a validated planning snapshot', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const workflowService = require('../services/workflowService')
  const planningValidationService = require('../services/planningValidationService')
  const schedulingService = require('../services/schedulingService')
  const publishedSoutenanceService = require('../services/publishedSoutenanceService')
  const votingCampaignService = require('../services/votingCampaignService')
  const TpiPlanning = require('../models/tpiPlanningModel')

  const tpiId = '507f1f77bcf86cd799439012'
  const slotId = '507f1f77bcf86cd799439013'
  const snapshot = {
    year: 2026,
    version: 4,
    entries: [
      {
        tpiId,
        reference: 'TPI-2026-001',
        slot: { slotId }
      }
    ]
  }
  const confirmCalls = []
  let transitionPayload = null

  const restore = [
    patchMethod(workflowService, 'getWorkflowYearState', async () => ({ state: 'planning' })),
    patchMethod(planningValidationService, 'getActiveSnapshot', async () => snapshot),
    patchMethod(planningValidationService, 'validatePlanningForYear', async () => ({
      year: 2026,
      summary: { isValid: true, issueCount: 0 },
      issues: [],
      entries: snapshot.entries
    })),
    patchMethod(planningValidationService, 'isValidationAlignedWithSnapshot', () => true),
    patchMethod(TpiPlanning, 'find', (query) => {
      assert.equal(query.year, 2026)
      assert.deepEqual(query._id.$in, [tpiId])

      return {
        select() {
          return {
            lean: async () => ([
              {
                _id: tpiId,
                reference: 'TPI-2026-001',
                status: 'pending_slots',
                confirmedSlot: null
              }
            ])
          }
        }
      }
    }),
    patchMethod(schedulingService, 'confirmSlotForTpi', async (receivedTpiId, receivedSlotId, options) => {
      confirmCalls.push({ receivedTpiId, receivedSlotId, options })
      return { success: true }
    }),
    patchMethod(TpiPlanning, 'countDocuments', async (query) => {
      assert.equal(query.year, 2026)
      assert.deepEqual(query.status.$in, ['voting', 'pending_validation', 'manual_required'])
      return 0
    }),
    patchMethod(publishedSoutenanceService, 'publishConfirmedPlanningSoutenances', async () => ({
      rooms: [{ idRoom: 1 }],
      publicationVersion: { version: 2 }
    })),
    patchMethod(workflowService, 'transitionWorkflowYear', async (payload) => {
      transitionPayload = payload
      return {
        changed: true,
        workflow: { state: 'published' }
      }
    }),
    patchMethod(votingCampaignService, 'sendSoutenanceLinksForYear', async () => ({
      emailsSent: 4,
      emailsSucceeded: 4
    })),
    patchMethod(workflowService, 'logWorkflowAuditEvent', async () => {})
  ]

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/publication/publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.success, true)
    assert.equal(body.roomsCount, 1)
    assert.equal(body.targetUrl, '/defenses/2026')
    assert.deepEqual(body.directPublication, {
      snapshotVersion: 4,
      plannedCount: 1,
      confirmedCount: 1,
      alreadyConfirmedCount: 0
    })
    assert.equal(confirmCalls.length, 1)
    assert.equal(confirmCalls[0].receivedTpiId, tpiId)
    assert.equal(confirmCalls[0].receivedSlotId, slotId)
    assert.equal(confirmCalls[0].options.historyAction, 'slot_confirmed_direct_publication')
    assert.equal(transitionPayload.targetState, 'published')
    assert.equal(transitionPayload.allowDirectPublication, true)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
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
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/reset validates confirmation phrase', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/reset`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ confirmation: 'RECOMMENCER' })
    })

    assert.equal(response.status, 400)
    const body = await response.json()
    assert.equal(body.error, 'Confirmation de reset invalide.')
    assert.equal(body.details.expectedConfirmation, 'RECOMMENCER 2026')
  } finally {
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/reset resets workflow and returns planning state', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const workflowService = require('../services/workflowService')
  let resetPayload = null
  const restore = [
    patchMethod(workflowService, 'resetWorkflowYear', async payload => {
      resetPayload = payload
      return {
        deleted: {
          votes: 3,
          slots: 2,
          tpiPlannings: 1,
          planningSnapshots: 1,
          publicationVersions: 0,
          magicLinks: 2,
          workflowYears: 1,
          legacyCollections: []
        }
      }
    }),
    patchMethod(workflowService, 'getWorkflowYearState', async year => ({
      year,
      state: 'planning',
      allowedTransitions: ['voting_open']
    }))
  ]

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/reset`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ confirmation: 'RECOMMENCER 2026' })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.success, true)
    assert.equal(body.workflow.state, 'planning')
    assert.equal(resetPayload.year, 2026)
    assert.equal(resetPayload.user.email, 'planner@example.com')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
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
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/static-votes/generate requires authentication', async () => {
  const jwtSecret = 'test-jwt-secret'
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/static-votes/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    assert.equal(response.status, 401)
  } finally {
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/static-votes/sync calls the static vote sync service', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'], { email: 'planner@example.com' })
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret,
    STATIC_VOTE_SYNC_SECRET: 'sync-secret'
  })

  const staticVotePublicationService = require('../services/staticVotePublicationService')
  const workflowService = require('../services/workflowService')

  let receivedPayload = null
  const restore = [
    patchMethod(staticVotePublicationService, 'syncStaticVoteResponses', async (payload) => {
      receivedPayload = payload
      return {
        success: true,
        year: payload.year,
        sourceUrl: payload.remoteUrl,
        receivedCount: 1,
        importedCount: 1,
        skippedCount: 0,
        failedCount: 0,
        results: []
      }
    }),
    patchMethod(workflowService, 'logWorkflowAuditEvent', async () => {})
  ]

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/static-votes/sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        remoteUrl: 'https://tpi26.ch/votes-2026/sync.php'
      })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.importedCount, 1)
    assert.equal(receivedPayload.year, 2026)
    assert.equal(receivedPayload.remoteUrl, 'https://tpi26.ch/votes-2026/sync.php')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})
