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
