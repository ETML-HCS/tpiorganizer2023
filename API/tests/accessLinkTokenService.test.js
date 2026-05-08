const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

const { MagicLink } = require('../models/magicLinkModel')
const Person = require('../models/personModel')
const { AccessLinkLog } = require('../models/accessLinkLogModel')
const accessLinkTokenService = require('../modules/accessLinks/tokenService')
const { replaceProperty } = require('./helpers/stubSandbox')

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function createResolvedLink(overrides = {}) {
  const link = {
    _id: 'link-1',
    tokenHash: hashToken('a'.repeat(64)),
    type: 'vote',
    year: 2026,
    recipientEmail: 'alice@example.com',
    personId: '507f1f77bcf86cd799439011',
    personName: 'Alice Expert',
    role: null,
    scope: { kind: 'stakeholder_votes' },
    redirectPath: '/coordination/2026',
    maxUses: 2,
    usageCount: 0,
    revokedAt: null,
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    lastUsedAt: null,
    save: async function save() {
      this.saved = true
    },
    toObject: function toObject() {
      return {
        _id: this._id,
        type: this.type,
        year: this.year,
        recipientEmail: this.recipientEmail,
        personId: this.personId,
        personName: this.personName,
        role: this.role,
        scope: this.scope,
        redirectPath: this.redirectPath,
        maxUses: this.maxUses,
        usageCount: this.usageCount,
        revokedAt: this.revokedAt,
        expiresAt: this.expiresAt,
        lastUsedAt: this.lastUsedAt
      }
    },
    ...overrides
  }

  return link
}

test('resolveMagicLink journalise un accès valide et incrémente l usage', async () => {
  const rawToken = 'a'.repeat(64)
  const logs = []
  const link = createResolvedLink()
  const restore = [
    replaceProperty(MagicLink, 'findOne', async (query) => {
      assert.deepEqual(query, { tokenHash: hashToken(rawToken) })
      return link
    }),
    replaceProperty(MagicLink, 'updateOne', async (query, update) => {
      assert.equal(query._id, 'link-1')
      assert.equal(query.revokedAt, null)
      assert.ok(query.expiresAt.$gt instanceof Date)
      assert.ok(Array.isArray(query.$or))
      assert.deepEqual(update.$inc, { usageCount: 1 })
      assert.ok(update.$set.lastUsedAt instanceof Date)
      return { modifiedCount: 1 }
    }),
    replaceProperty(Person, 'findById', async (personId) => ({
      _id: personId,
      email: 'alice@example.com',
      roles: ['expert']
    })),
    replaceProperty(AccessLinkLog, 'create', async (payload) => {
      logs.push(payload)
      return payload
    })
  ]

  try {
    const result = await accessLinkTokenService.resolveMagicLink(rawToken, {
      request: {
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'node-test'
        }
      }
    })

    assert.equal(result.link.usageCount, 1)
    assert.ok(link.lastUsedAt instanceof Date)
    assert.equal(result.person.email, 'alice@example.com')
    assert.equal(logs.length, 1)
    assert.equal(logs[0].status, 'success')
    assert.equal(logs[0].type, 'vote')
    assert.equal(logs[0].year, 2026)
    assert.equal(logs[0].recipientEmail, 'alice@example.com')
    assert.equal(logs[0].ip, '127.0.0.1')
    assert.equal(logs[0].userAgent, 'node-test')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('resolveMagicLink journalise un lien expiré sans l utiliser', async () => {
  const rawToken = 'b'.repeat(64)
  const logs = []
  const link = createResolvedLink({
    tokenHash: hashToken(rawToken),
    type: 'soutenance',
    expiresAt: new Date('2020-01-01T00:00:00.000Z'),
    save: async () => {
      throw new Error('Un lien expiré ne doit pas être sauvegardé.')
    }
  })
  const restore = [
    replaceProperty(MagicLink, 'findOne', async () => link),
    replaceProperty(MagicLink, 'updateOne', async () => {
      throw new Error('Un lien expiré ne doit pas réserver d usage.')
    }),
    replaceProperty(AccessLinkLog, 'create', async (payload) => {
      logs.push(payload)
      return payload
    })
  ]

  try {
    await assert.rejects(
      () => accessLinkTokenService.resolveMagicLink(rawToken),
      /Magic link expire/
    )

    assert.equal(link.usageCount, 0)
    assert.equal(logs.length, 1)
    assert.equal(logs[0].status, 'expired')
    assert.equal(logs[0].type, 'soutenance')
    assert.equal(logs[0].reason, 'Magic link expire.')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('resolveMagicLink refuse une consommation concurrente qui dépasse la limite', async () => {
  const rawToken = 'c'.repeat(64)
  const logs = []
  const link = createResolvedLink({
    tokenHash: hashToken(rawToken),
    maxUses: 1,
    usageCount: 0
  })
  const restore = [
    replaceProperty(MagicLink, 'findOne', async () => link),
    replaceProperty(MagicLink, 'updateOne', async () => ({ modifiedCount: 0 })),
    replaceProperty(AccessLinkLog, 'create', async (payload) => {
      logs.push(payload)
      return payload
    })
  ]

  try {
    await assert.rejects(
      () => accessLinkTokenService.resolveMagicLink(rawToken),
      /Magic link deja consomme/
    )

    assert.equal(link.usageCount, 0)
    assert.equal(logs.length, 1)
    assert.equal(logs[0].status, 'exhausted')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('listAccessLogs borne la limite et normalise la sortie', async () => {
  const calls = []
  const restore = replaceProperty(AccessLinkLog, 'find', (query) => {
    calls.push({ query })

    return {
      sort(sortOrder) {
        calls[calls.length - 1].sortOrder = sortOrder
        return this
      },
      limit(limit) {
        calls[calls.length - 1].limit = limit
        return this
      },
      lean() {
        return Promise.resolve([
          {
            _id: 'log-1',
            type: 'vote',
            year: 2026,
            personId: '507f1f77bcf86cd799439011',
            status: 'success',
            createdAt: new Date('2026-05-05T10:00:00.000Z')
          }
        ])
      }
    }
  })

  try {
    const logs = await accessLinkTokenService.listAccessLogs({
      year: '2026',
      type: 'vote',
      status: 'success',
      limit: 999
    })

    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0].query, {
      year: 2026,
      type: 'vote',
      status: 'success'
    })
    assert.deepEqual(calls[0].sortOrder, { createdAt: -1 })
    assert.equal(calls[0].limit, 500)
    assert.equal(logs[0].id, 'log-1')
    assert.equal(logs[0].personId, '507f1f77bcf86cd799439011')
  } finally {
    restore()
  }
})

test('resetMagicLinkEmailDeliveries efface les statuts d envoi SMTP ciblés', async () => {
  const calls = []
  const restore = replaceProperty(MagicLink, 'updateMany', async (query, update) => {
    calls.push({ query, update })
    return { matchedCount: 2, modifiedCount: 2 }
  })

  try {
    const result = await accessLinkTokenService.resetMagicLinkEmailDeliveries({
      year: '2026',
      type: 'soutenance',
      ids: ['507f1f77bcf86cd799439011', 'bad-id']
    })

    assert.equal(result.matchedCount, 2)
    assert.equal(result.modifiedCount, 2)
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0].query, {
      year: 2026,
      type: 'soutenance',
      emailDeliveryStatus: { $in: ['sent', 'failed', 'skipped', 'pending'] },
      _id: { $in: ['507f1f77bcf86cd799439011'] }
    })
    assert.deepEqual(calls[0].update.$set.emailDeliveryStatus, '')
    assert.equal(calls[0].update.$set.emailSentAt, null)
    assert.equal(calls[0].update.$set.emailDeliveryError, '')
    assert.equal(calls[0].update.$set.emailMessageId, '')
    assert.ok(calls[0].update.$set.updatedAt instanceof Date)
  } finally {
    restore()
  }
})

test('resetMagicLinkEmailDeliveries ne reset pas toute l annee si les ids fournis sont invalides', async () => {
  const restore = replaceProperty(MagicLink, 'updateMany', async () => {
    throw new Error('Aucun reset global attendu pour des ids invalides.')
  })

  try {
    const result = await accessLinkTokenService.resetMagicLinkEmailDeliveries({
      year: 2026,
      type: 'soutenance',
      ids: ['bad-id']
    })

    assert.equal(result.matchedCount, 0)
    assert.equal(result.modifiedCount, 0)
  } finally {
    restore()
  }
})
