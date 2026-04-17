const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')

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

test('POST /api/auth/login returns a token for valid admin credentials', async () => {
  const { app, restoreEnv } = loadTestApp({
    AUTH_USER_PLAIN: '',
    AUTH_PASS_PLAIN: '',
    AUTH_USER_HASH: bcrypt.hashSync('admin', 4),
    AUTH_PASS_HASH: bcrypt.hashSync('admin', 4),
    AUTH_SESSION_SECRET: 'test-auth-secret',
    JWT_SECRET: 'test-jwt-secret'
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' })
    })

    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.success, true)
    assert.equal(typeof payload.token, 'string')
    assert.ok(payload.token.length > 20)
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/auth/login supports plain admin credentials from env in dev', async () => {
  const { app, restoreEnv } = loadTestApp({
    AUTH_USER_PLAIN: 'admin-dev',
    AUTH_PASS_PLAIN: 'admin-dev-pass',
    AUTH_SESSION_SECRET: 'test-auth-secret',
    JWT_SECRET: 'test-jwt-secret'
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin-dev',
        password: 'admin-dev-pass'
      })
    })

    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.success, true)
    assert.equal(typeof payload.token, 'string')
    assert.ok(payload.token.length > 20)
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})