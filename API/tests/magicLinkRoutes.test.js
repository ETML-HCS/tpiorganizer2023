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
