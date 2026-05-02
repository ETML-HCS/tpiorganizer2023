const test = require('node:test')
const assert = require('node:assert/strict')

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

test('soutenance magic links are valid for 4 days by default', () => {
  const { DEFAULT_EXPIRY_HOURS } = require('../services/magicLinkV2Service')

  assert.equal(DEFAULT_EXPIRY_HOURS.soutenance, 24 * 4)
})

test('legacy planning magic links accept a custom expiration duration', async () => {
  const Person = require('../models/personModel')
  const magicLinkService = require('../services/magicLinkService')
  const originalFindOne = Person.findOne
  const fixedNow = Date.parse('2026-04-01T00:00:00.000Z')
  const originalDateNow = Date.now
  const savedPeople = []

  Date.now = () => fixedNow
  Person.findOne = async () => ({
    _id: 'person-1',
    email: 'alice@example.com',
    fullName: 'Alice Expert',
    save: async function save() {
      savedPeople.push({
        magicLinkToken: this.magicLinkToken,
        magicLinkExpires: this.magicLinkExpires
      })
    }
  })

  try {
    const link = await magicLinkService.generateMagicLink(
      'ALICE@example.com',
      'https://example.test/api/planning',
      { expiresInHours: 72 }
    )

    assert.equal(link.expiresInHours, 72)
    assert.equal(link.expiresAt.toISOString(), '2026-04-04T00:00:00.000Z')
    assert.equal(savedPeople.length, 1)
    assert.equal(savedPeople[0].magicLinkExpires.toISOString(), '2026-04-04T00:00:00.000Z')
    assert.match(link.url, /^https:\/\/example\.test\/api\/planning\/auth\/verify\?token=/)
  } finally {
    Person.findOne = originalFindOne
    Date.now = originalDateNow
  }
})

test('revokeActiveMagicLinks filters by source and keeps the new link active', async () => {
  const { MagicLink } = require('../models/magicLinkModel')
  const magicLinkV2Service = require('../services/magicLinkV2Service')
  const originalUpdateMany = MagicLink.updateMany
  const calls = []

  MagicLink.updateMany = async (query, update) => {
    calls.push({ query, update })
    return { matchedCount: 2, modifiedCount: 2 }
  }

  try {
    const result = await magicLinkV2Service.revokeActiveMagicLinks({
      year: '2026',
      type: 'vote',
      person: {
        _id: 'person-1',
        email: 'alice@example.com'
      },
      sources: ['admin_access_preview', 'admin_access_generated'],
      excludeIds: ['new-link-id']
    })

    assert.equal(result.modifiedCount, 2)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].query.year, 2026)
    assert.equal(calls[0].query.type, 'vote')
    assert.equal(calls[0].query.personId, 'person-1')
    assert.equal(calls[0].query.revokedAt, null)
    assert.ok(calls[0].query.expiresAt.$gt instanceof Date)
    assert.deepEqual(
      calls[0].query['scope.source'].$in,
      ['admin_access_preview', 'admin_access_generated']
    )
    assert.deepEqual(calls[0].query._id.$nin, ['new-link-id'])
    assert.ok(calls[0].update.$set.revokedAt instanceof Date)
    assert.ok(calls[0].update.$set.updatedAt instanceof Date)
  } finally {
    MagicLink.updateMany = originalUpdateMany
  }
})

test('revokeActiveMagicLinks can scope revocation by publication version', async () => {
  const { MagicLink } = require('../models/magicLinkModel')
  const magicLinkV2Service = require('../services/magicLinkV2Service')
  const originalUpdateMany = MagicLink.updateMany
  const calls = []

  MagicLink.updateMany = async (query, update) => {
    calls.push({ query, update })
    return { matchedCount: 1, modifiedCount: 1 }
  }

  try {
    await magicLinkV2Service.revokeActiveMagicLinks({
      year: 2026,
      type: 'soutenance',
      person: {
        _id: 'person-1',
        email: 'alice@example.com'
      },
      sources: ['admin_access_generated'],
      scope: {
        publicationVersion: 2
      }
    })

    assert.equal(calls.length, 1)
    assert.equal(calls[0].query['scope.publicationVersion'], 2)
    assert.deepEqual(calls[0].query['scope.source'].$in, ['admin_access_generated'])
  } finally {
    MagicLink.updateMany = originalUpdateMany
  }
})

test('create magic links applique les paramètres annuels de validité et d usages', async () => {
  const { MagicLink } = require('../models/magicLinkModel')
  const planningConfigService = require('../services/planningConfigService')
  const magicLinkV2Service = require('../services/magicLinkV2Service')
  const originalCreate = MagicLink.create
  const originalGetPlanningConfigIfAvailable = planningConfigService.getPlanningConfigIfAvailable
  const calls = []

  MagicLink.create = async (payload) => {
    calls.push(payload)
    return { _id: `link-${calls.length}` }
  }
  planningConfigService.getPlanningConfigIfAvailable = async () => ({
    accessLinkSettings: {
      voteLinkValidityHours: 48,
      voteLinkMaxUses: 9,
      soutenanceLinkValidityHours: 120,
      soutenanceLinkMaxUses: 80
    }
  })

  const before = Date.now()

  try {
    await magicLinkV2Service.createVoteMagicLink({
      year: 2026,
      person: {
        _id: 'person-1',
        email: 'alice@example.com'
      },
      role: null,
      scope: { source: 'vote_campaign' },
      baseUrl: 'http://localhost:3000'
    })

    await magicLinkV2Service.createSoutenanceMagicLink({
      year: 2026,
      person: {
        _id: 'person-2',
        email: 'bob@example.com'
      },
      scope: { source: 'admin_access_generated' },
      baseUrl: 'http://localhost:3000'
    })

    const after = Date.now()

    assert.equal(calls.length, 2)
    assert.equal(calls[0].maxUses, 9)
    assert.equal(calls[1].maxUses, 80)
    assert.ok(calls[0].expiresAt.getTime() >= before + 48 * 60 * 60 * 1000)
    assert.ok(calls[0].expiresAt.getTime() <= after + 48 * 60 * 60 * 1000)
    assert.ok(calls[1].expiresAt.getTime() >= before + 120 * 60 * 60 * 1000)
    assert.ok(calls[1].expiresAt.getTime() <= after + 120 * 60 * 60 * 1000)
  } finally {
    MagicLink.create = originalCreate
    planningConfigService.getPlanningConfigIfAvailable = originalGetPlanningConfigIfAvailable
  }
})

test('createVoteMagicLink persiste le token brut uniquement sur demande', async () => {
  const { MagicLink } = require('../models/magicLinkModel')
  const magicLinkV2Service = require('../services/magicLinkV2Service')
  const originalCreate = MagicLink.create
  const calls = []

  MagicLink.create = async (payload) => {
    calls.push(payload)
    return { _id: `link-${calls.length}` }
  }

  try {
    await magicLinkV2Service.createVoteMagicLink({
      year: 2026,
      person: {
        _id: 'person-1',
        email: 'alice@example.com'
      },
      role: null,
      scope: { source: 'admin_access_generated' },
      baseUrl: 'http://localhost:3000',
      persistToken: true
    })

    await magicLinkV2Service.createVoteMagicLink({
      year: 2026,
      person: {
        _id: 'person-2',
        email: 'bob@example.com'
      },
      role: null,
      scope: { source: 'vote_reminder' },
      baseUrl: 'http://localhost:3000'
    })

    assert.equal(calls.length, 2)
    assert.equal(typeof calls[0].rawToken, 'string')
    assert.equal(calls[0].rawToken.length, 64)
    assert.equal(calls[1].rawToken, '')
  } finally {
    MagicLink.create = originalCreate
  }
})

test('findReusableMagicLink reconstruit une URL depuis un token persiste', async () => {
  const { MagicLink } = require('../models/magicLinkModel')
  const magicLinkV2Service = require('../services/magicLinkV2Service')
  const originalFind = MagicLink.find
  const calls = []

  MagicLink.find = (query) => {
    calls.push({ query })

    return {
      select(selection) {
        calls[calls.length - 1].selection = selection
        return this
      },
      sort(sortOrder) {
        calls[calls.length - 1].sortOrder = sortOrder
        return this
      },
      lean() {
        return Promise.resolve([
          {
            _id: 'used-link',
            rawToken: 'used-token',
            type: 'soutenance',
            redirectPath: '/defenses/2026',
            expiresAt: new Date('2026-06-01T12:00:00Z'),
            maxUses: 1,
            usageCount: 1
          },
          {
            _id: 'reusable-link',
            rawToken: 'reusable-token',
            type: 'soutenance',
            redirectPath: '/defenses/2026',
            expiresAt: new Date('2026-06-02T12:00:00Z'),
            maxUses: 60,
            usageCount: 4
          }
        ])
      }
    }
  }

  try {
    const link = await magicLinkV2Service.findReusableMagicLink({
      year: '2026',
      type: 'soutenance',
      person: {
        _id: 'person-1',
        email: 'alice@example.com'
      },
      scope: {
        publicationVersion: 3
      },
      sources: ['admin_access_generated'],
      baseUrl: 'http://localhost:3000'
    })

    assert.equal(calls.length, 1)
    assert.equal(calls[0].query.year, 2026)
    assert.equal(calls[0].query.type, 'soutenance')
    assert.equal(calls[0].query.personId, 'person-1')
    assert.equal(calls[0].query['scope.publicationVersion'], 3)
    assert.deepEqual(calls[0].query['scope.source'].$in, ['admin_access_generated'])
    assert.match(calls[0].selection, /\+rawToken/)
    assert.equal(link.id, 'reusable-link')
    assert.equal(link.token, 'reusable-token')
    assert.equal(link.url, 'http://localhost:3000/defenses/2026?ml=reusable-token')
    assert.equal(link.generated, true)
    assert.equal(link.recoverable, true)
  } finally {
    MagicLink.find = originalFind
  }
})

test('GET /api/magic-link/resolve rejects missing token', async () => {
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: 'test-jwt-secret'
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/magic-link/resolve`)

    assert.equal(response.status, 400)
    const body = await response.json()
    assert.equal(body.error, 'Token invalide.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('GET /api/magic-link/resolve rejects invalid token format', async () => {
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: 'test-jwt-secret'
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/magic-link/resolve?token=short`)

    assert.equal(response.status, 400)
    const body = await response.json()
    assert.equal(body.error, 'Token invalide.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})
