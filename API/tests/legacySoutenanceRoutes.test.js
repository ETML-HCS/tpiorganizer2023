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

async function login(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin' })
  })

  return await response.json()
}

function createTestContext() {
  return loadTestApp({
    AUTH_USER_PLAIN: '',
    AUTH_PASS_PLAIN: '',
    AUTH_USER_HASH: bcrypt.hashSync('admin', 4),
    AUTH_PASS_HASH: bcrypt.hashSync('admin', 4),
    AUTH_SESSION_SECRET: 'test-auth-secret',
    JWT_SECRET: 'test-jwt-secret'
  })
}

test('GET /api/soutenances/:year requires authentication, token or magic link', async () => {
  const { app, restoreEnv } = createTestContext()
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/soutenances/2026`)
    const payload = await response.json()

    assert.equal(response.status, 401)
    assert.equal(payload.error, 'Authentification ou lien de soutenance requis.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/soutenances/:year/publish-room requires authentication', async () => {
  const { app, restoreEnv } = createTestContext()
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/soutenances/2026/publish-room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idRoom: 123 })
    })

    const payload = await response.json()

    assert.equal(response.status, 401)
    assert.equal(payload.message, 'Authentification requise')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/soutenances/:year/publish-room returns 400 when idRoom is missing', async () => {
  const { app, restoreEnv } = createTestContext()
  const { server, baseUrl } = await startServer(app)

  try {
    const loginPayload = await login(baseUrl)

    const response = await fetch(`${baseUrl}/api/soutenances/2026/publish-room`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginPayload.token}`
      },
      body: JSON.stringify({ name: 'Salle 101' })
    })

    const payload = await response.json()

    assert.equal(response.status, 400)
    assert.equal(payload.error, 'idRoom requis pour publier une salle.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('PUT /api/soutenances/:year/rooms/:roomId/tpis/:tpiDataId/offres/:expertOrBoss rejects invalid roles', async () => {
  const { app, restoreEnv } = createTestContext()
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(
      `${baseUrl}/api/soutenances/2026/rooms/room-1/tpis/tpi-1/offres/invalid-role`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offres: { isValidated: false, submit: [] } })
      }
    )

    const payload = await response.json()

    assert.equal(response.status, 400)
    assert.equal(payload.error, 'Rôle invalide.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/soutenances/:year/publish-from-planning requires authentication', async () => {
  const { app, restoreEnv } = createTestContext()
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/soutenances/2026/publish-from-planning`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })

    const payload = await response.json()

    assert.equal(response.status, 401)
    assert.equal(payload.message, 'Authentification requise')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})
