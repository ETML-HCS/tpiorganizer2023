const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')

const { loadTestApp } = require('./helpers/loadTestApp')
const Person = require('../models/personModel')
const PlanningConfig = require('../models/planningConfigModel')
const PublicationVersion = require('../models/publicationVersionModel')
const TpiModelsYear = require('../models/tpiModels')

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

test('GET /api/get-tpi requires authentication', async () => {
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
    const response = await fetch(`${baseUrl}/api/get-tpi`)
    const payload = await response.json()

    assert.equal(response.status, 401)
    assert.equal(payload.message, 'Authentification requise')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('GET /api/get-tpi returns 400 when year is missing and token is valid', async () => {
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
    const loginPayload = await login(baseUrl)

    const response = await fetch(`${baseUrl}/api/get-tpi`, {
      headers: {
        Authorization: `Bearer ${loginPayload.token}`
      }
    })
    const payload = await response.json()

    assert.equal(response.status, 400)
    assert.equal(payload.error, 'Année manquante.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('GET /api/get-tpi backfills missing stakeholder links from the people registry', async () => {
  const { app, restoreEnv } = loadTestApp({
    AUTH_USER_PLAIN: '',
    AUTH_PASS_PLAIN: '',
    AUTH_USER_HASH: bcrypt.hashSync('admin', 4),
    AUTH_PASS_HASH: bcrypt.hashSync('admin', 4),
    AUTH_SESSION_SECRET: 'test-auth-secret',
    JWT_SECRET: 'test-jwt-secret'
  })

  const { server, baseUrl } = await startServer(app)
  const tpiModel = TpiModelsYear(2026)
  const originalPersonFind = Person.find
  const originalPlanningConfigFindOne = PlanningConfig.findOne
  const originalPublicationVersionFindOne = PublicationVersion.findOne
  const originalFind = tpiModel.find
  const originalBulkWrite = tpiModel.bulkWrite

  try {
    const loginPayload = await login(baseUrl)

    Person.find = () => ({
      select() {
        return {
          lean: async () => ([
            {
              _id: 'person-candidate',
              firstName: 'Alice',
              lastName: 'Martin',
              email: 'alice.martin@example.com',
              roles: ['candidat'],
              candidateYears: [2026],
              isActive: true
            },
            {
              _id: 'person-expert-1',
              firstName: 'Bob',
              lastName: 'Expert',
              email: 'bob.expert@example.com',
              roles: ['expert'],
              isActive: true
            },
            {
              _id: 'person-expert-2',
              firstName: 'Carla',
              lastName: 'Expert',
              email: 'carla.expert@example.com',
              roles: ['expert'],
              isActive: true
            },
            {
              _id: 'person-boss',
              firstName: 'Diane',
              lastName: 'Boss',
              email: 'diane.boss@example.com',
              roles: ['chef_projet'],
              isActive: true
            }
          ])
        }
      }
    })

    PlanningConfig.findOne = () => ({
      lean: async () => ({
        year: 2026,
        classTypes: [
          {
            code: 'MATU',
            prefix: 'M',
            label: 'MATU',
            startDate: '2026-03-01',
            endDate: '2026-06-03'
          }
        ]
      })
    })

    PublicationVersion.findOne = () => ({
      lean: async () => ({
        year: 2026,
        version: 3,
        isActive: true,
        rooms: [
          {
            name: 'A101',
            site: 'ETML',
            date: '2026-06-10',
            tpiDatas: [
              {
                refTpi: 'TPI-2026-007'
              }
            ]
          }
        ]
      })
    })

    tpiModel.find = async () => ([
      {
        _id: 'legacy-tpi-1',
        refTpi: '007',
        candidat: 'Alice Martin',
        classe: 'MID4A',
        experts: {
          1: 'Bob Expert',
          2: 'Carla Expert'
        },
        boss: 'Diane Boss',
        candidatPersonId: null,
        expert1PersonId: null,
        expert2PersonId: null,
        bossPersonId: null
      }
    ])

    let capturedBulkOperations = null
    tpiModel.bulkWrite = async (operations) => {
      capturedBulkOperations = operations
      return { modifiedCount: operations.length }
    }

    const response = await fetch(`${baseUrl}/api/get-tpi?year=2026`, {
      headers: {
        Authorization: `Bearer ${loginPayload.token}`
      }
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.length, 1)
    assert.equal(payload[0].candidatPersonId, 'person-candidate')
    assert.equal(payload[0].expert1PersonId, 'person-expert-1')
    assert.equal(payload[0].expert2PersonId, 'person-expert-2')
    assert.equal(payload[0].bossPersonId, 'person-boss')
    assert.equal(payload[0].dates.depart, '2026-03-01')
    assert.equal(payload[0].dates.fin, '2026-06-03')
    assert.match(payload[0].dates.soutenance, /^2026-06-10/)
    assert.equal(payload[0].salle, 'A101')
    assert.equal(payload[0].lieu.site, 'ETML')
    assert.deepEqual(payload[0].stakeholderState, {
      isComplete: true,
      isResolved: true,
      isValidated: true,
      missingRoles: [],
      unresolvedRoles: []
    })
    assert.equal(capturedBulkOperations.length, 1)
    assert.deepEqual(capturedBulkOperations[0], {
      updateOne: {
        filter: { _id: 'legacy-tpi-1' },
        update: {
          $set: {
            candidatPersonId: 'person-candidate',
            expert1PersonId: 'person-expert-1',
            expert2PersonId: 'person-expert-2',
            bossPersonId: 'person-boss'
          }
        }
      }
    })
  } finally {
    Person.find = originalPersonFind
    PlanningConfig.findOne = originalPlanningConfigFindOne
    PublicationVersion.findOne = originalPublicationVersionFindOne
    tpiModel.find = originalFind
    tpiModel.bulkWrite = originalBulkWrite
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('GET /api/tpi/:year/byCandidate/:candidateName returns 400 when candidate name is blank', async () => {
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
    const loginPayload = await login(baseUrl)

    const response = await fetch(`${baseUrl}/api/tpi/2026/byCandidate/%20`, {
      headers: {
        Authorization: `Bearer ${loginPayload.token}`
      }
    })
    const payload = await response.json()

    assert.equal(response.status, 400)
    assert.equal(payload.error, 'Nom du candidat requis.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/save-tpi/:year links participant ids when the names match the people registry', async () => {
  const { app, restoreEnv } = loadTestApp({
    AUTH_USER_PLAIN: '',
    AUTH_PASS_PLAIN: '',
    AUTH_USER_HASH: bcrypt.hashSync('admin', 4),
    AUTH_PASS_HASH: bcrypt.hashSync('admin', 4),
    AUTH_SESSION_SECRET: 'test-auth-secret',
    JWT_SECRET: 'test-jwt-secret'
  })

  const { server, baseUrl } = await startServer(app)
  const tpiModel = TpiModelsYear(2026)
  const originalPersonFind = Person.find
  const originalFindOneAndUpdate = tpiModel.findOneAndUpdate

  try {
    const loginPayload = await login(baseUrl)

    Person.find = () => ({
      select() {
        return {
          lean: async () => ([
            {
              _id: 'person-candidate',
              firstName: 'Alice',
              lastName: 'Martin',
              email: 'alice.martin@example.com',
              roles: ['candidat'],
              isActive: true
            },
            {
              _id: 'person-expert-1',
              firstName: 'Bob',
              lastName: 'Expert',
              email: 'bob.expert@example.com',
              roles: ['expert'],
              isActive: true
            },
            {
              _id: 'person-expert-2',
              firstName: 'Carla',
              lastName: 'Expert',
              email: 'carla.expert@example.com',
              roles: ['expert'],
              isActive: true
            },
            {
              _id: 'person-boss',
              firstName: 'Diane',
              lastName: 'Boss',
              email: 'diane.boss@example.com',
              roles: ['chef_projet'],
              isActive: true
            }
          ])
        }
      }
    })

    let capturedUpdate = null
    tpiModel.findOneAndUpdate = async (filter, update, options) => {
      capturedUpdate = { filter, update, options }
      return { _id: 'saved-tpi', ...update }
    }

    const response = await fetch(`${baseUrl}/api/save-tpi/2026`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${loginPayload.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refTpi: 'TPI-2026-042',
        candidat: 'Alice Martin',
        experts: {
          1: 'Bob Expert',
          2: 'Carla Expert'
        },
        boss: 'Diane Boss'
      })
    })

    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload._id, 'saved-tpi')
    assert.equal(capturedUpdate.filter.refTpi, 'TPI-2026-042')
    assert.equal(capturedUpdate.update.candidatPersonId, 'person-candidate')
    assert.equal(capturedUpdate.update.expert1PersonId, 'person-expert-1')
    assert.equal(capturedUpdate.update.expert2PersonId, 'person-expert-2')
    assert.equal(capturedUpdate.update.bossPersonId, 'person-boss')
  } finally {
    Person.find = originalPersonFind
    tpiModel.findOneAndUpdate = originalFindOneAndUpdate
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/save-tpi/:year rejects manual creation when stakeholders are not validated in the referential', async () => {
  const { app, restoreEnv } = loadTestApp({
    AUTH_USER_PLAIN: '',
    AUTH_PASS_PLAIN: '',
    AUTH_USER_HASH: bcrypt.hashSync('admin', 4),
    AUTH_PASS_HASH: bcrypt.hashSync('admin', 4),
    AUTH_SESSION_SECRET: 'test-auth-secret',
    JWT_SECRET: 'test-jwt-secret'
  })

  const { server, baseUrl } = await startServer(app)
  const originalPersonFind = Person.find
  const tpiModel = TpiModelsYear(2026)
  const originalFindOneAndUpdate = tpiModel.findOneAndUpdate

  try {
    const loginPayload = await login(baseUrl)

    Person.find = () => ({
      select() {
        return {
          lean: async () => ([
            {
              _id: 'person-candidate',
              firstName: 'Alice',
              lastName: 'Martin',
              email: 'alice.martin@example.com',
              roles: ['candidat'],
              candidateYears: [2026],
              isActive: true
            },
            {
              _id: 'person-expert-1',
              firstName: 'Bob',
              lastName: 'Expert',
              email: 'bob.expert@example.com',
              roles: ['expert'],
              isActive: true
            },
            {
              _id: 'person-boss',
              firstName: 'Diane',
              lastName: 'Boss',
              email: 'diane.boss@example.com',
              roles: ['chef_projet'],
              isActive: true
            }
          ])
        }
      }
    })

    let wasCalled = false
    tpiModel.findOneAndUpdate = async () => {
      wasCalled = true
      return null
    }

    const response = await fetch(`${baseUrl}/api/save-tpi/2026`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${loginPayload.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refTpi: 'TPI-2026-099',
        candidat: 'Alice Martin',
        experts: {
          1: 'Bob Expert',
          2: 'Carla Expert'
        },
        boss: 'Diane Boss'
      })
    })

    const payload = await response.json()

    assert.equal(response.status, 400)
    assert.equal(wasCalled, false)
    assert.match(payload.error, /parties prenantes doivent être validées/i)
    assert.deepEqual(payload.details.unresolvedRoles, ['expert2'])
  } finally {
    Person.find = originalPersonFind
    tpiModel.findOneAndUpdate = originalFindOneAndUpdate
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/save-tpi/:year treats literal null stakeholder placeholders as missing data', async () => {
  const { app, restoreEnv } = loadTestApp({
    AUTH_USER_PLAIN: '',
    AUTH_PASS_PLAIN: '',
    AUTH_USER_HASH: bcrypt.hashSync('admin', 4),
    AUTH_PASS_HASH: bcrypt.hashSync('admin', 4),
    AUTH_SESSION_SECRET: 'test-auth-secret',
    JWT_SECRET: 'test-jwt-secret'
  })

  const { server, baseUrl } = await startServer(app)
  const originalPersonFind = Person.find
  const tpiModel = TpiModelsYear(2026)
  const originalFindOneAndUpdate = tpiModel.findOneAndUpdate

  try {
    const loginPayload = await login(baseUrl)

    Person.find = () => ({
      select() {
        return {
          lean: async () => ([
            {
              _id: 'person-candidate',
              firstName: 'Alice',
              lastName: 'Martin',
              email: 'alice.martin@example.com',
              roles: ['candidat'],
              candidateYears: [2026],
              isActive: true
            },
            {
              _id: 'person-expert-1',
              firstName: 'Bob',
              lastName: 'Expert',
              email: 'bob.expert@example.com',
              roles: ['expert'],
              isActive: true
            },
            {
              _id: 'person-boss',
              firstName: 'Diane',
              lastName: 'Boss',
              email: 'diane.boss@example.com',
              roles: ['chef_projet'],
              isActive: true
            }
          ])
        }
      }
    })

    let wasCalled = false
    tpiModel.findOneAndUpdate = async () => {
      wasCalled = true
      return null
    }

    const response = await fetch(`${baseUrl}/api/save-tpi/2026`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${loginPayload.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refTpi: 'TPI-2026-100',
        candidat: 'Alice Martin',
        experts: {
          1: 'Bob Expert',
          2: 'null'
        },
        boss: 'Diane Boss'
      })
    })

    const payload = await response.json()

    assert.equal(response.status, 400)
    assert.equal(wasCalled, false)
    assert.deepEqual(payload.details.missingRoles, ['expert2'])
    assert.deepEqual(payload.details.unresolvedRoles, [])
  } finally {
    Person.find = originalPersonFind
    tpiModel.findOneAndUpdate = originalFindOneAndUpdate
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/delete-tpi-year/:year requires confirmation', async () => {
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
    const loginPayload = await login(baseUrl)

    const response = await fetch(`${baseUrl}/api/delete-tpi-year/2026`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${loginPayload.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ confirm: false })
    })
    const payload = await response.json()

    assert.equal(response.status, 400)
    assert.equal(payload.error, 'Confirmation requise.')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})
