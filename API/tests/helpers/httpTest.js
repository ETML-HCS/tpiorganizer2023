const jwt = require('jsonwebtoken')

const { loadTestApp } = require('./loadTestApp')

const DEFAULT_USER_ID = '507f1f77bcf86cd799439011'
const DEFAULT_EMAIL = 'planner@example.com'

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

async function closeServer(server) {
  if (!server?.listening) {
    return
  }

  await new Promise(resolve => server.close(resolve))
}

function buildSessionToken(secret, roles = ['admin'], overrides = {}) {
  return jwt.sign(
    {
      id: DEFAULT_USER_ID,
      email: DEFAULT_EMAIL,
      roles,
      ...overrides
    },
    secret,
    { expiresIn: '1h' }
  )
}

function jsonHeaders(token, headers = {}) {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
    ...headers
  }
}

async function withTestAppServer(env, callback) {
  const { app, restoreEnv } = loadTestApp(env)
  const { server, baseUrl } = await startServer(app)

  try {
    return await callback({ app, server, baseUrl })
  } finally {
    await closeServer(server)
    restoreEnv()
  }
}

module.exports = {
  DEFAULT_EMAIL,
  DEFAULT_USER_ID,
  buildSessionToken,
  closeServer,
  jsonHeaders,
  startServer,
  withTestAppServer
}
