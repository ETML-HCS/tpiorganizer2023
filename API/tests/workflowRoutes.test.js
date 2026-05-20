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

test('POST /api/workflow/:year/votes/start forces skipEmails in debug mode', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret,
    REACT_APP_DEBUG: 'true'
  })

  const workflowService = require('../services/workflowService')
  const coordinationValidationService = require('../services/coordinationValidationService')
  const votingCampaignService = require('../services/votingCampaignService')
  const TpiPlanning = require('../models/tpiCoordinationModel')

  let receivedOptions = null
  const restore = [
    patchMethod(workflowService, 'getWorkflowYearState', async () => ({ state: 'voting_open' })),
    patchMethod(workflowService, 'setWorkflowPhaseActive', async () => {
      throw new Error('La route votes/start ne doit pas ouvrir de phase automatiquement.')
    }),
    patchMethod(workflowService, 'logWorkflowAuditEvent', async () => {}),
    patchMethod(coordinationValidationService, 'getActiveSnapshot', async () => null),
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
      body: JSON.stringify({ skipEmails: false })
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

test('POST /api/workflow/:year/votes/start accepts skipEmails outside debug mode', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret,
    REACT_APP_DEBUG: 'false'
  })

  const workflowService = require('../services/workflowService')
  const coordinationValidationService = require('../services/coordinationValidationService')
  const votingCampaignService = require('../services/votingCampaignService')
  const TpiPlanning = require('../models/tpiCoordinationModel')

  let startVotesCalled = false
  const restore = [
    patchMethod(workflowService, 'getWorkflowYearState', async () => ({ state: 'voting_open' })),
    patchMethod(workflowService, 'setWorkflowPhaseActive', async () => {
      throw new Error('La route votes/start ne doit pas ouvrir de phase automatiquement.')
    }),
    patchMethod(workflowService, 'logWorkflowAuditEvent', async () => {}),
    patchMethod(coordinationValidationService, 'getActiveSnapshot', async () => null),
    patchMethod(TpiPlanning, 'countDocuments', async () => 1),
    patchMethod(votingCampaignService, 'startVotesCampaign', async () => {
      startVotesCalled = true
      return {
        tpiCount: 0,
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
    assert.equal(startVotesCalled, true)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/votes/start keeps admin phases unchanged', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret,
    REACT_APP_DEBUG: 'false'
  })

  const workflowService = require('../services/workflowService')
  const coordinationValidationService = require('../services/coordinationValidationService')
  const votingCampaignService = require('../services/votingCampaignService')
  const TpiPlanning = require('../models/tpiCoordinationModel')

  const restore = [
    patchMethod(workflowService, 'getWorkflowYearState', async () => ({
      state: 'published',
      activePhases: ['defenses'],
      phases: { defenses: { active: true } }
    })),
    patchMethod(workflowService, 'setWorkflowPhaseActive', async () => {
      throw new Error('La route votes/start ne doit pas ouvrir de phase automatiquement.')
    }),
    patchMethod(workflowService, 'logWorkflowAuditEvent', async () => {}),
    patchMethod(coordinationValidationService, 'getActiveSnapshot', async () => ({ version: 3 })),
    patchMethod(TpiPlanning, 'countDocuments', async () => 1),
    patchMethod(votingCampaignService, 'startVotesCampaign', async () => ({
      tpiCount: 1,
      totalEmails: 0,
      successfulEmails: 0,
      failedEmails: 0,
      emailsSkipped: true,
      details: []
    }))
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
    assert.equal(body.workflowState, 'published')
    assert.deepEqual(body.activePhases, ['defenses'])
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/votes/remind forwards targeted moved TPI options', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const workflowService = require('../services/workflowService')
  const votingCampaignService = require('../services/votingCampaignService')

  let receivedOptions = null
  let auditPayload = null
  const restore = [
    patchMethod(workflowService, 'logWorkflowAuditEvent', async (entry) => {
      auditPayload = entry.payload
    }),
    patchMethod(votingCampaignService, 'remindPendingVotes', async (_year, _baseUrl, options = {}) => {
      receivedOptions = options
      return {
        tpiCount: 1,
        eligibleTpiCount: 1,
        reminderTargets: 1,
        emailsSent: 1,
        emailsSucceeded: 1,
        emailsFailed: 0,
        automatic: false,
        movedOnly: true,
        requestedTpiCount: 2,
        skipped: false,
        reason: null
      }
    })
  ]

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/votes/remind`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tpiIds: ['coord-1', 'coord-2'],
        movedOnly: true,
        voteLinkTarget: 'static',
        votePublicUrl: 'https://tpi26.ch/votes-2026/'
      })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.success, true)
    assert.equal(body.movedOnly, true)
    assert.equal(body.requestedTpiCount, 2)
    assert.deepEqual(receivedOptions, {
      automatic: false,
      tpiIds: ['coord-1', 'coord-2'],
      movedOnly: true,
      voteLinkTarget: 'static',
      votePublicUrl: 'https://tpi26.ch/votes-2026/'
    })
    assert.deepEqual(auditPayload, {
      automatic: false,
      skipped: false,
      reminderTargets: 1,
      emailsSent: 1,
      emailsSucceeded: 1,
      movedOnly: true,
      requestedTpiCount: 2
    })
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

test('GET /api/workflow/:year/access-links/logs retourne les logs admin filtres', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })
  const accessLinkTokenService = require('../modules/accessLinks/tokenService')
  const calls = []
  const restore = [
    patchMethod(accessLinkTokenService, 'listAccessLogs', async (params) => {
      calls.push(params)
      return [
        {
          id: 'log-1',
          year: 2026,
          type: 'vote',
          status: 'success'
        }
      ]
    })
  ]
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(
      `${baseUrl}/api/workflow/2026/access-links/logs?type=vote&status=success&limit=25`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.success, true)
    assert.equal(body.year, 2026)
    assert.deepEqual(body.logs, [
      {
        id: 'log-1',
        year: 2026,
        type: 'vote',
        status: 'success'
      }
    ])
    assert.deepEqual(calls[0], {
      year: 2026,
      type: 'vote',
      status: 'success',
      personId: '',
      limit: 25
    })
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/access-links/email-deliveries/reset reset les statuts SMTP', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const workflowService = require('../services/workflowService')
  const accessLinkTokenService = require('../modules/accessLinks/tokenService')
  let resetPayload = null
  const restore = [
    patchMethod(workflowService, 'logWorkflowAuditEvent', async () => {}),
    patchMethod(accessLinkTokenService, 'resetMagicLinkEmailDeliveries', async (payload) => {
      resetPayload = payload
      return {
        matchedCount: 2,
        modifiedCount: 2,
        resetAt: '2026-05-07T12:00:00.000Z'
      }
    })
  ]
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/access-links/email-deliveries/reset`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'soutenance',
        linkIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
      })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.deepEqual(resetPayload, {
      year: 2026,
      type: 'soutenance',
      ids: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']
    })
    assert.equal(body.modifiedCount, 2)
    assert.equal(body.requestedLinkCount, 2)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/access-links/email-preview transmet le type de message au template', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const emailService = require('../services/emailService')
  let templateData = null
  const restore = [
    patchMethod(emailService.emailTemplates, 'soutenanceAccess', (data) => {
      templateData = data
      return {
        subject: `subject:${data.messageType}`,
        html: `<p>${data.messageType}</p>`,
        text: data.messageType
      }
    })
  ]
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/access-links/email-preview`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template: 'soutenanceAccess',
        messageType: 'schedule_update',
        target: {
          recipientName: 'Camille Projet',
          recipientRoles: ['chef_projet'],
          magicLinkUrl: 'https://tpi26.ch/soutenances-2026/?ml=preview',
          expiresAt: '2026-05-14T21:00:00.000Z'
        }
      })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.messageType, 'schedule_update')
    assert.equal(body.subject, 'subject:schedule_update')
    assert.equal(templateData.messageType, 'schedule_update')
    assert.equal(templateData.recipientName, 'Camille Projet')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/access-links/email-preview normalise les types inconnus', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const emailService = require('../services/emailService')
  let templateData = null
  const restore = [
    patchMethod(emailService.emailTemplates, 'soutenanceAccess', (data) => {
      templateData = data
      return {
        subject: `subject:${data.messageType}`,
        html: `<p>${data.messageType}</p>`,
        text: data.messageType
      }
    })
  ]
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/access-links/email-preview`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template: 'soutenanceAccess',
        messageType: 'not-supported',
        target: {
          recipientName: 'Camille Projet'
        }
      })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.messageType, 'standard')
    assert.equal(templateData.messageType, 'standard')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/access-links/send-soutenance-emails transmet le type de relance à sendEmail', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const workflowService = require('../services/workflowService')
  const accessLinkTokenService = require('../modules/accessLinks/tokenService')
  const emailService = require('../services/emailService')
  const linkId = '507f1f77bcf86cd799439011'
  let sendEmailCall = null
  let markedDelivery = null
  let auditPayload = null
  const restore = [
    patchMethod(workflowService, 'logWorkflowAuditEvent', async (payload) => {
      auditPayload = payload
    }),
    patchMethod(accessLinkTokenService, 'findMagicLinkForEmailDelivery', async (payload) => {
      assert.deepEqual(payload, {
        id: linkId,
        year: 2026,
        type: 'soutenance',
        baseUrl: 'https://tpi26.ch'
      })

      return {
        raw: {
          _id: linkId,
          recipientEmail: 'camille.projet@example.ch',
          personName: 'Camille Projet',
          expiresAt: '2026-05-14T21:00:00.000Z',
          emailDeliveryStatus: 'sent',
          emailSentAt: '2026-05-01T08:00:00.000Z',
          emailMessageId: 'old-message'
        },
        public: {
          url: 'https://tpi26.ch/soutenances-2026/?ml=token-cdp',
          availabilityStatus: 'available'
        }
      }
    }),
    patchMethod(accessLinkTokenService, 'markMagicLinkEmailDelivery', async (payload) => {
      markedDelivery = payload
      return payload
    }),
    patchMethod(emailService, 'sendEmail', async (to, template, data, options) => {
      sendEmailCall = { to, template, data, options }
      return {
        success: true,
        messageId: 'new-message'
      }
    })
  ]
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/access-links/send-soutenance-emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        baseUrl: 'https://tpi26.ch',
        forceResend: true,
        messageType: 'schedule_update',
        targets: [
          {
            clientKey: 'person-cdp-link',
            linkId,
            recipientName: 'Camille Projet',
            recipientAudience: 'cdp',
            recipientRoles: ['chef_projet']
          }
        ]
      })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.messageType, 'schedule_update')
    assert.equal(body.summary.sentCount, 1)
    assert.equal(sendEmailCall.to, 'camille.projet@example.ch')
    assert.equal(sendEmailCall.template, 'soutenanceAccess')
    assert.equal(sendEmailCall.data.messageType, 'schedule_update')
    assert.equal(sendEmailCall.data.magicLinkUrl, 'https://tpi26.ch/soutenances-2026/?ml=token-cdp')
    assert.equal(markedDelivery.status, 'sent')
    assert.equal(markedDelivery.messageId, 'new-message')
    assert.equal(auditPayload.payload.messageType, 'schedule_update')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/access-links/generate utilise le fallback URL publique défense', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const workflowService = require('../services/workflowService')
  const accessLinkPreviewModule = require('../modules/accessLinks/previewService')
  const staticDefensePublicationService = require('../services/staticDefensePublicationService')
  let previewPayload = null
  const restore = [
    patchMethod(workflowService, 'getWorkflowYearState', async () => ({ state: 'published', phases: {} })),
    patchMethod(workflowService, 'logWorkflowAuditEvent', async () => {}),
    patchMethod(staticDefensePublicationService, 'getStaticPublicationStatus', async () => ({ publicUrl: '' })),
    patchMethod(staticDefensePublicationService, 'getPublicUrl', async () => 'https://publication.example.ch/defenses/'),
    patchMethod(staticDefensePublicationService, 'generateStaticDefensesSite', async () => ({
      publicUrl: 'https://publication.example.ch/defenses/'
    })),
    patchMethod(staticDefensePublicationService, 'publishStaticDefensesSite', async () => ({
      publicUrl: 'https://publication.example.ch/defenses/',
      publishedAt: '2026-05-05T10:00:00.000Z'
    })),
    patchMethod(accessLinkPreviewModule, 'buildAccessLinkPreview', async (payload) => {
      previewPayload = payload
      return {
        year: payload.year,
        linksGenerated: true,
        hasGeneratedLinks: true,
        summary: {
          peopleCount: 0,
          voteLinkCount: 0,
          voteGeneratedLinkCount: 0,
          soutenanceLinkCount: 0,
          soutenanceGeneratedLinkCount: 0,
          arbitrageLinkCount: 0,
          generatedLinkCount: 0
        },
        contexts: {
          vote: {},
          soutenance: {},
          arbitrage: {}
        },
        people: []
      }
    })
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

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(previewPayload.soutenanceBaseUrl, 'https://publication.example.ch')
    assert.equal(previewPayload.soutenanceRedirectPath, '/defenses/')
    assert.equal(previewPayload.soutenanceLinkTarget, 'publication')
    assert.equal(body.publicationRefresh.soutenancePublication.publicUrl, 'https://publication.example.ch/defenses/')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/access-links/generate orchestre la generation globale et les mini-sites', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })
  const accessLinkPreviewModule = require('../modules/accessLinks/previewService')
  let previewPayload = null
  const restorePreview = [
    patchMethod(accessLinkPreviewModule, 'buildAccessLinkPreview', async (payload) => {
      previewPayload = payload
      return {
        year: payload.year,
        linksGenerated: true,
        hasGeneratedLinks: true,
        summary: {
          peopleCount: 0,
          voteLinkCount: 0,
          voteGeneratedLinkCount: 0,
          soutenanceLinkCount: 0,
          soutenanceGeneratedLinkCount: 0,
          arbitrageLinkCount: 0,
          generatedLinkCount: 0
        },
        contexts: {
          vote: {},
          soutenance: {},
          arbitrage: {}
        },
        people: []
      }
    })
  ]

  const workflowService = require('../services/workflowService')
  const coordinationConfigService = require('../services/coordinationConfigService')
  const staticVotePublicationService = require('../services/staticVotePublicationService')
  const staticDefensePublicationService = require('../services/staticDefensePublicationService')
  const calls = []
  const restore = [
    patchMethod(workflowService, 'getWorkflowYearState', async () => ({ state: 'planning', phases: {} })),
    patchMethod(workflowService, 'logWorkflowAuditEvent', async () => {}),
    patchMethod(coordinationConfigService, 'getPlanningConfigIfAvailable', async () => ({ accessLinkSettings: {} })),
    patchMethod(staticVotePublicationService, 'getStaticVoteLinkTarget', async () => ({
      baseUrl: 'https://votes.example.ch',
      redirectPath: '/votes-2026/'
    })),
    patchMethod(staticVotePublicationService, 'getStaticVotePublicationStatus', async () => ({
      available: false
    })),
    patchMethod(staticVotePublicationService, 'generateStaticVotesSite', async (year) => {
      calls.push(`vote-generate-${year}`)
      return { publicUrl: 'https://votes.example.ch/votes-2026/' }
    }),
    patchMethod(staticVotePublicationService, 'publishStaticVotesSite', async (year) => {
      calls.push(`vote-publish-${year}`)
      return { publicUrl: 'https://votes.example.ch/votes-2026/', publishedAt: '2026-05-05T10:00:00.000Z' }
    }),
    patchMethod(staticDefensePublicationService, 'generateStaticDefensesSite', async (year) => {
      calls.push(`defense-generate-${year}`)
      return { publicUrl: 'https://publication.example.ch/defenses/' }
    }),
    patchMethod(staticDefensePublicationService, 'publishStaticDefensesSite', async (year) => {
      calls.push(`defense-publish-${year}`)
      return { publicUrl: 'https://publication.example.ch/defenses/', publishedAt: '2026-05-05T10:00:00.000Z' }
    })
  ]
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/access-links/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        voteLinkTarget: 'static',
        votePublicUrl: 'https://votes.example.ch/votes-2026/',
        soutenanceLinkTarget: 'publication',
        soutenancePublicUrl: 'https://publication.example.ch/defenses/'
      })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(previewPayload.generateLinks, true)
    assert.equal(previewPayload.workflowFreeModeEnabled, true)
    assert.equal(previewPayload.autoPublishSoutenance, true)
    assert.equal(previewPayload.voteLinkTarget, 'static')
    assert.equal(previewPayload.soutenanceLinkTarget, 'publication')
    assert.deepEqual(calls, [
      'vote-generate-2026',
      'vote-publish-2026',
      'defense-generate-2026',
      'defense-publish-2026'
    ])
    assert.equal(body.publicationRefresh.votePublication.publicUrl, 'https://votes.example.ch/votes-2026/')
    assert.equal(body.publicationRefresh.soutenancePublication.publicUrl, 'https://publication.example.ch/defenses/')
    assert.deepEqual(body.warnings, [])
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    while (restorePreview.length > 0) {
      restorePreview.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/access-links/reconcile cible les liens defense manquants sans rafraichir les publications', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })
  const accessLinkPreviewModule = require('../modules/accessLinks/previewService')
  const workflowService = require('../services/workflowService')
  const coordinationConfigService = require('../services/coordinationConfigService')
  const staticDefensePublicationService = require('../services/staticDefensePublicationService')
  let previewPayload = null
  const restore = [
    patchMethod(workflowService, 'getWorkflowYearState', async () => ({ state: 'published', phases: {} })),
    patchMethod(workflowService, 'logWorkflowAuditEvent', async () => {}),
    patchMethod(coordinationConfigService, 'getPlanningConfigIfAvailable', async () => ({ accessLinkSettings: {} })),
    patchMethod(staticDefensePublicationService, 'generateStaticDefensesSite', async () => {
      throw new Error('La reconciliation ne doit pas rafraichir le mini-site defense.')
    }),
    patchMethod(staticDefensePublicationService, 'publishStaticDefensesSite', async () => {
      throw new Error('La reconciliation ne doit pas publier le mini-site defense.')
    }),
    patchMethod(accessLinkPreviewModule, 'buildAccessLinkPreview', async (payload) => {
      previewPayload = payload
      return {
        year: payload.year,
        linksGenerated: true,
        hasGeneratedLinks: true,
        summary: {
          peopleCount: 1,
          voteLinkCount: 0,
          voteGeneratedLinkCount: 0,
          soutenanceLinkCount: 1,
          soutenanceGeneratedLinkCount: 1,
          arbitrageLinkCount: 0,
          generatedLinkCount: 1
        },
        contexts: {
          phases: ['soutenance'],
          vote: {},
          soutenance: { publicationVersion: 12 },
          arbitrage: {}
        },
        people: []
      }
    })
  ]
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/access-links/reconcile`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phases: ['vote', 'arbitrage'] })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.success, true)
    assert.equal(previewPayload.generateLinks, true)
    assert.equal(previewPayload.generateMissingOnly, true)
    assert.deepEqual(previewPayload.phases, ['soutenance'])
    assert.equal(body.publicationRefresh, null)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/publication/deactivate keeps phase control manual', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const workflowService = require('../services/workflowService')
  const publishedSoutenanceService = require('../services/publishedSoutenanceService')
  const votingCampaignService = require('../services/votingCampaignService')

  const restore = [
    patchMethod(workflowService, 'getWorkflowYearState', async () => ({
      state: 'published',
      activePhases: ['defenses'],
      phases: { defenses: { active: true } }
    })),
    patchMethod(workflowService, 'hasActivePlanningSnapshot', async () => ({ version: 2 })),
    patchMethod(publishedSoutenanceService, 'deactivatePublication', async () => ({
      deactivatedPublicationCount: 1,
      deactivatedVersions: [3],
      revokedSoutenanceLinks: 4,
      reopenedDirectPublicationCount: 2,
      deactivatedAt: '2026-05-02T12:00:00.000Z'
    })),
    patchMethod(votingCampaignService, 'startVotesCampaign', async () => {
      throw new Error('La désactivation de publication ne doit pas relancer les votes automatiquement.')
    }),
    patchMethod(workflowService, 'setWorkflowPhaseActive', async () => {
      throw new Error('La désactivation de publication ne doit pas modifier les phases automatiquement.')
    }),
    patchMethod(workflowService, 'logWorkflowAuditEvent', async () => {})
  ]
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/publication/deactivate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.success, true)
    assert.equal(body.workflowState, 'published')
    assert.deepEqual(body.activePhases, ['defenses'])
    assert.equal(body.deactivatedPublicationCount, 1)
    assert.equal(body.revokedSoutenanceLinks, 4)
    assert.equal(body.reopenedDirectPublicationCount, 2)
    assert.equal(body.voteCampaign, null)
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

test('POST /api/workflow/:year/publication/publish publishes with warning when votes are unresolved', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const workflowService = require('../services/workflowService')
  const publishedSoutenanceService = require('../services/publishedSoutenanceService')
  const votingCampaignService = require('../services/votingCampaignService')
  const TpiPlanning = require('../models/tpiCoordinationModel')
  let sentLinksVersion = null
  let sentLinksOptions = null
  const restore = [
    patchMethod(workflowService, 'getWorkflowYearState', async () => ({
      state: 'voting_open',
      activePhases: ['votes'],
      phases: { votes: { active: true } }
    })),
    patchMethod(TpiPlanning, 'countDocuments', async (query) => {
      assert.equal(query.year, 2026)
      assert.deepEqual(query.status.$in, ['voting', 'pending_validation', 'manual_required'])
      return 1
    }),
    patchMethod(publishedSoutenanceService, 'publishConfirmedPlanningSoutenances', async () => ({
      rooms: [{ idRoom: 1 }],
      publicationVersion: { version: 7 }
    })),
    patchMethod(workflowService, 'setWorkflowPhaseActive', async () => {
      throw new Error('La publication ne doit pas ouvrir la phase défenses automatiquement.')
    }),
    patchMethod(votingCampaignService, 'sendSoutenanceLinksForYear', async (year, baseUrl, version, options) => {
      sentLinksVersion = version
      sentLinksOptions = options
      return {
        emailsSent: 0,
        emailsSucceeded: 0,
        emailsSkipped: true
      }
    }),
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
    assert.equal(body.publicationVersion.version, 7)
    assert.equal(body.sentLinks.emailsSkipped, true)
    assert.equal(sentLinksVersion, 7)
    assert.equal(sentLinksOptions.skipEmails, true)
    assert.equal(body.workflowState, 'voting_open')
    assert.deepEqual(body.activePhases, ['votes'])
    assert.equal(
      body.warnings[0],
      '1 TPI restent en vote ou en intervention manuelle: publication forcée par l\'admin.'
    )
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/publication/publish can publish the current admin planification rooms', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const workflowService = require('../services/workflowService')
  const publishedSoutenanceService = require('../services/publishedSoutenanceService')
  const votingCampaignService = require('../services/votingCampaignService')
  const TpiPlanning = require('../models/tpiCoordinationModel')
  const legacyRooms = [
    {
      idRoom: 123,
      name: 'A101',
      site: 'ETML',
      date: '2026-06-10',
      tpiDatas: [
        {
          id: 'room-a_1',
          refTpi: 'TPI-2026-001',
          candidat: 'Alice Candidate',
          expert1: { name: 'Expert One' },
          expert2: { name: 'Expert Two' },
          boss: { name: 'Chef Projet' }
        }
      ]
    }
  ]
  let publishRoomsPayload = null
  let sentLinksPayload = null

  const restore = [
    patchMethod(workflowService, 'getWorkflowYearState', async () => ({
      state: 'planning',
      activePhases: ['planning'],
      phases: { planning: { active: true } }
    })),
    patchMethod(TpiPlanning, 'countDocuments', async () => 0),
    patchMethod(publishedSoutenanceService, 'publishRoomsAsSoutenances', async (year, rooms, user, source) => {
      publishRoomsPayload = { year, rooms, user, source }
      return {
        rooms,
        publicationVersion: { version: 9 }
      }
    }),
    patchMethod(workflowService, 'setWorkflowPhaseActive', async () => {
      throw new Error('La publication ne doit pas ouvrir la phase défenses automatiquement.')
    }),
    patchMethod(votingCampaignService, 'sendSoutenanceLinksForYear', async (year, baseUrl, publicationVersion, options) => {
      sentLinksPayload = { year, baseUrl, publicationVersion, options }
      return {
        emailsSent: 0,
        emailsSucceeded: 0,
        emailsSkipped: true
      }
    }),
    patchMethod(workflowService, 'logWorkflowAuditEvent', async () => {})
  ]

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/publication/publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ legacyRooms })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.success, true)
    assert.equal(body.roomsCount, 1)
    assert.equal(body.publicationVersion.version, 9)
    assert.equal(publishRoomsPayload.year, 2026)
    assert.deepEqual(publishRoomsPayload.rooms, legacyRooms)
    assert.equal(publishRoomsPayload.source.origin, 'admin_current_planning')
    assert.equal(sentLinksPayload.publicationVersion, 9)
    assert.deepEqual(sentLinksPayload.options.publicationRooms, legacyRooms)
    assert.equal(sentLinksPayload.options.skipEmails, true)
    assert.equal(body.workflowState, 'planning')
    assert.deepEqual(body.activePhases, ['planning'])
    assert.match(body.message, /planification courante/)
    assert.ok(body.warnings.includes('Publication générée depuis la planification courante fournie par l\'admin.'))
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/publication/publish can publish directly from a validated planification snapshot', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const workflowService = require('../services/workflowService')
  const coordinationValidationService = require('../services/coordinationValidationService')
  const schedulingService = require('../services/schedulingService')
  const publishedSoutenanceService = require('../services/publishedSoutenanceService')
  const votingCampaignService = require('../services/votingCampaignService')
  const TpiPlanning = require('../models/tpiCoordinationModel')

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
  let directSentLinksOptions = null

  const restore = [
    patchMethod(workflowService, 'getWorkflowYearState', async () => ({
      state: 'planning',
      activePhases: ['planning'],
      phases: { planning: { active: true } }
    })),
    patchMethod(coordinationValidationService, 'getActiveSnapshot', async () => snapshot),
    patchMethod(coordinationValidationService, 'validatePlanningForYear', async () => ({
      year: 2026,
      summary: { isValid: true, issueCount: 0 },
      issues: [],
      entries: snapshot.entries
    })),
    patchMethod(coordinationValidationService, 'isValidationAlignedWithSnapshot', () => true),
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
    patchMethod(workflowService, 'setWorkflowPhaseActive', async () => {
      throw new Error('La publication directe ne doit pas ouvrir la phase défenses automatiquement.')
    }),
    patchMethod(votingCampaignService, 'sendSoutenanceLinksForYear', async (_year, _baseUrl, _publicationVersion, options) => {
      directSentLinksOptions = options
      return {
        emailsSent: 0,
        emailsSucceeded: 0,
        emailsSkipped: true
      }
    }),
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
    assert.equal(body.sentLinks.emailsSkipped, true)
    assert.equal(directSentLinksOptions.skipEmails, true)
    assert.equal(body.workflowState, 'planning')
    assert.deepEqual(body.activePhases, ['planning'])
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

test('GET /api/workflow/:year/publication/final-schedule/preview requires authentication', async () => {
  const jwtSecret = 'test-jwt-secret'
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/publication/final-schedule/preview`)

    assert.equal(response.status, 401)
  } finally {
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/publication/final-schedule/send enforces admin role', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['expert1'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/publication/final-schedule/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    assert.equal(response.status, 403)
  } finally {
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/publication/final-schedule/send calls final delivery service', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const finalScheduleDeliveryService = require('../services/finalScheduleDeliveryService')
  const workflowService = require('../services/workflowService')
  let receivedPayload = null
  const restore = [
    patchMethod(workflowService, 'logWorkflowAuditEvent', async () => {}),
    patchMethod(finalScheduleDeliveryService, 'sendFinalScheduleDelivery', async (payload) => {
      receivedPayload = payload
      return {
        success: true,
        available: true,
        year: payload.year,
        publicationVersion: payload.publicationVersion,
        summary: {
          sentCount: 2,
          skippedCount: 0,
          failedCount: 0
        },
        results: []
      }
    })
  ]

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/publication/final-schedule/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        publicationVersion: 4,
        forceResend: true
      })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.success, true)
    assert.deepEqual(receivedPayload, {
      year: 2026,
      publicationVersion: 4,
      forceResend: true
    })
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/publication/final-schedule/manual-package downloads zip package', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const finalScheduleDeliveryService = require('../services/finalScheduleDeliveryService')
  const workflowService = require('../services/workflowService')
  let receivedPayload = null
  const restore = [
    patchMethod(workflowService, 'logWorkflowAuditEvent', async () => {}),
    patchMethod(finalScheduleDeliveryService, 'buildManualFinalSchedulePackage', async (payload) => {
      receivedPayload = payload
      return {
        success: true,
        available: true,
        year: payload.year,
        publicationVersion: payload.publicationVersion,
        filename: 'manual-package.zip',
        contentType: 'application/zip',
        buffer: Buffer.from('PK-test'),
        summary: {
          packagedCount: 3
        }
      }
    })
  ]

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/publication/final-schedule/manual-package`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        publicationVersion: 4,
        forceResend: true
      })
    })

    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /application\/zip/)
    assert.match(response.headers.get('content-disposition'), /manual-package\.zip/)
    assert.equal(response.headers.get('x-final-schedule-packaged-count'), '3')
    assert.equal(Buffer.from(await response.arrayBuffer()).toString('utf8'), 'PK-test')
    assert.deepEqual(receivedPayload, {
      year: 2026,
      publicationVersion: 4,
      forceResend: true
    })
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})

test('GET /api/workflow/:year/publication/defense-changes/preview returns targeted notification preview', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const publicationChangeNotificationService = require('../services/publicationChangeNotificationService')
  let receivedPayload = null
  const restore = [
    patchMethod(publicationChangeNotificationService, 'previewDefenseChangeNotifications', async (payload) => {
      receivedPayload = payload
      return {
        year: payload.year,
        currentVersion: payload.publicationVersion,
        previousVersion: 2,
        hasCurrentPublication: true,
        hasPreviousPublication: true,
        shouldNotify: true,
        summary: {
          changedDefenseCount: 1,
          pendingRecipientCount: 2
        },
        changes: [],
        recipients: []
      }
    })
  ]

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/publication/defense-changes/preview?publicationVersion=3`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.deepEqual(receivedPayload, {
      year: 2026,
      publicationVersion: 3
    })
    assert.equal(body.shouldNotify, true)
    assert.equal(body.summary.pendingRecipientCount, 2)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await closeServer(server)
    restoreEnv()
  }
})

test('POST /api/workflow/:year/publication/defense-changes/send sends targeted notifications through app links', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const workflowService = require('../services/workflowService')
  const publicationChangeNotificationService = require('../services/publicationChangeNotificationService')
  let receivedPayload = null
  let auditPayload = null
  const restore = [
    patchMethod(publicationChangeNotificationService, 'sendDefenseChangeNotifications', async (payload) => {
      receivedPayload = payload
      return {
        success: true,
        year: payload.year,
        preview: {
          currentVersion: payload.publicationVersion,
          previousVersion: 2,
          summary: {
            pendingRecipientCount: 0,
            sentRecipientCount: 2
          }
        },
        summary: {
          requestedCount: 2,
          sentCount: 2,
          skippedCount: 0,
          failedCount: 0
        },
        results: []
      }
    }),
    patchMethod(workflowService, 'logWorkflowAuditEvent', async (payload) => {
      auditPayload = payload
    })
  ]

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/publication/defense-changes/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        publicationVersion: 3,
        forceResend: true
      })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.success, true)
    assert.equal(receivedPayload.year, 2026)
    assert.equal(receivedPayload.publicationVersion, 3)
    assert.equal(receivedPayload.forceResend, true)
    assert.equal(receivedPayload.linkTarget, 'app')
    assert.equal(receivedPayload.redirectPath, '/defenses/2026')
    assert.equal(receivedPayload.baseUrl, baseUrl)
    assert.equal(auditPayload.action, 'workflow.publication.defense-changes.send')
    assert.equal(auditPayload.success, true)
    assert.equal(auditPayload.payload.linkTarget, 'app')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
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

test('POST /api/workflow/:year/reset resets workflow and returns planification state', async () => {
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
      activePhases: ['planning'],
      phases: { planning: { active: true } }
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

test('POST /api/workflow/:year/phases/:phase toggles an admin phase', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['admin'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const workflowService = require('../services/workflowService')
  let receivedPayload = null
  const restore = [
    patchMethod(workflowService, 'setWorkflowPhaseActive', async payload => {
      receivedPayload = payload
      return {
        changed: true,
        phase: payload.phase,
        active: payload.active,
        workflow: {
          year: payload.year,
          state: 'voting_open',
          activePhases: ['planning', 'votes'],
          phases: {
            planning: { active: true },
            votes: { active: true }
          }
        }
      }
    })
  ]

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/workflow/2026/phases/votes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ active: true, reason: 'Ouverture admin' })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.success, true)
    assert.equal(body.phase, 'votes')
    assert.equal(body.active, true)
    assert.deepEqual(body.activePhases, ['planning', 'votes'])
    assert.equal(receivedPayload.year, 2026)
    assert.equal(receivedPayload.phase, 'votes')
    assert.equal(receivedPayload.active, true)
    assert.equal(receivedPayload.reason, 'Ouverture admin')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
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
