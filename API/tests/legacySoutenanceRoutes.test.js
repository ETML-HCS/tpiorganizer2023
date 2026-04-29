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
    JWT_SECRET: 'test-jwt-secret',
    DB_URI: '',
    DB_CLUSTER: '',
    DB_NAME: '',
    DB_USERNAME: '',
    DB_PASSWORD: ''
  })
}

function patchMethod(target, key, implementation) {
  const original = target[key]
  target[key] = implementation
  return () => {
    target[key] = original
  }
}

function addPublishedScheduleDependencyPatches(restore) {
  const PlanningConfig = require('../models/planningConfigModel')
  const PlanningSharedCatalog = require('../models/planningSharedCatalogModel')

  restore.push(
    patchMethod(PlanningSharedCatalog, 'findOne', () => ({
      lean: async () => ({
        key: 'shared',
        schemaVersion: 2,
        stakeholderIcons: {},
        sites: []
      })
    })),
    patchMethod(PlanningConfig, 'findOne', () => ({
      lean: async () => ({
        year: 2026,
        schemaVersion: 2,
        classTypes: [],
        soutenanceDates: [],
        siteConfigs: []
      })
    }))
  )
}

test('GET /api/defenses/:year requires an admin session, code or magic link', async () => {
  const { app, restoreEnv } = createTestContext()
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/defenses/2026`)
    const payload = await response.json()

    assert.equal(response.status, 401)
    assert.equal(payload.error, 'Code ou lien magique requis pour afficher les defenses.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('GET /api/defenses/:year returns the full published schedule for an admin session', async () => {
  const { app, restoreEnv } = createTestContext()
  const PublicationVersion = require('../models/publicationVersionModel')
  const restore = [
    patchMethod(PublicationVersion, 'findOne', () => ({
      sort: () => ({
        lean: async () => ({
          year: 2026,
          version: 3,
          isActive: true,
          rooms: [
            {
              idRoom: 101,
              name: 'A101',
              tpiDatas: [
                {
                  id: 'A101_0',
                  refTpi: 'TPI-2026-001',
                  candidat: 'Alice Candidate',
                  expert1: { name: 'Eva Expert' },
                  expert2: { name: 'Noa Expert' },
                  boss: { name: 'Paul Chef' }
                }
              ]
            }
          ]
        })
      })
    }))
  ]
  addPublishedScheduleDependencyPatches(restore)
  const { server, baseUrl } = await startServer(app)

  try {
    const loginPayload = await login(baseUrl)
    const response = await fetch(`${baseUrl}/api/defenses/2026`, {
      headers: {
        Authorization: `Bearer ${loginPayload.token}`
      }
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.length, 1)
    assert.equal(payload[0].name, 'A101')
    assert.equal(payload[0].tpiDatas[0].refTpi, 'TPI-2026-001')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('GET /api/defenses/:year accepts code as legacy access token alias', async () => {
  const { app, restoreEnv } = createTestContext()
  const PublicationVersion = require('../models/publicationVersionModel')
  const TpiExperts = require('../models/tpiExpertsModel')
  const restore = [
    patchMethod(TpiExperts, 'findOne', query => ({
      select: () => ({
        lean: async () => (
          query?.token === 'legacy-code'
            ? { name: 'Eva Expert', role: 'expert' }
            : null
        )
      })
    })),
    patchMethod(PublicationVersion, 'findOne', () => ({
      sort: () => ({
        lean: async () => ({
          year: 2026,
          version: 3,
          isActive: true,
          rooms: [
            {
              idRoom: 101,
              name: 'A101',
              tpiDatas: [
                {
                  id: 'A101_0',
                  refTpi: 'TPI-2026-001',
                  candidat: 'Alice Candidate',
                  expert1: { name: 'Eva Expert' },
                  expert2: { name: 'Noa Expert' },
                  boss: { name: 'Paul Chef' }
                },
                {
                  id: 'A101_1',
                  refTpi: 'TPI-2026-002',
                  candidat: 'Bob Candidate',
                  expert1: { name: 'Other Expert' },
                  expert2: { name: 'Noa Expert' },
                  boss: { name: 'Paul Chef' }
                }
              ]
            }
          ]
        })
      })
    }))
  ]
  addPublishedScheduleDependencyPatches(restore)
  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/defenses/2026?code=legacy-code`)
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.length, 1)
    assert.equal(payload[0].tpiDatas.length, 1)
    assert.equal(payload[0].tpiDatas[0].refTpi, 'TPI-2026-001')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
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
