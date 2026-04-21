const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')

const { loadTestApp } = require('./helpers/loadTestApp')
const Person = require('../models/personModel')
const TpiPlanning = require('../models/tpiPlanningModel')
const Slot = require('../models/slotModel')
const { MagicLink } = require('../models/magicLinkModel')

const VALID_OBJECT_ID = '507f1f77bcf86cd799439011'

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

function buildSessionToken(secret) {
  return jwt.sign(
    {
      id: VALID_OBJECT_ID,
      email: 'planner@example.com',
      roles: ['admin']
    },
    secret,
    { expiresIn: '1h' }
  )
}

test('POST /api/planning/persons/import rejects empty content', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret)
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/planning/persons/import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: '' })
    })

    assert.equal(response.status, 400)
    const error = await response.json()
    assert.equal(error.error, 'Contenu CSV requis')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/planning/persons/purge requires confirmation', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret)
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    const response = await fetch(`${baseUrl}/api/planning/persons/purge`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    assert.equal(response.status, 400)
    const error = await response.json()
    assert.equal(error.error, 'Confirmation requise')
  } finally {
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/planning/persons merges roles when the email already exists', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret)
  const originalFindOne = Person.findOne
  const originalSave = Person.prototype.save
  const savedDocs = []
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    Person.findOne = async (query) => {
      if (query?.email === 'alain.pittet@info-domo.ch') {
        return {
          _id: 'existing-person',
          firstName: 'Alain',
          lastName: 'Pittet',
          email: 'alain.pittet@info-domo.ch',
          phone: '',
          site: '',
          entreprise: '',
          roles: ['expert'],
          isActive: true,
          save: async function save() {
            savedDocs.push({
              email: this.email,
              roles: this.roles
            })
            return this
          }
        }
      }

      return null
    }

    Person.prototype.save = async function save() {
      savedDocs.push({
        email: this.email,
        roles: this.roles
      })
      return this
    }

    const response = await fetch(`${baseUrl}/api/planning/persons`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        firstName: 'Alain',
        lastName: 'Pittet',
        email: 'alain.pittet@info-domo.ch',
        roles: ['expert', 'chef_projet']
      })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.created, false)
    assert.equal(body.merged, true)
    assert.deepEqual(body.person.roles, ['expert', 'chef_projet'])
    assert.equal(savedDocs.length, 1)
    assert.deepEqual(savedDocs[0].roles, ['expert', 'chef_projet'])
  } finally {
    Person.findOne = originalFindOne
    Person.prototype.save = originalSave
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/planning/persons updates a synthetic organizer email when the name matches', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret)
  const originalFindOne = Person.findOne
  const originalFind = Person.find
  const originalSave = Person.prototype.save
  const savedDocs = []
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    Person.findOne = async () => null
    Person.find = () => ({
      select() {
        return [
          {
            _id: 'placeholder-person',
            firstName: 'Alain',
            lastName: 'Pittet',
            email: 'alain.pittet@tpiOrganizer.ch',
            phone: '',
            site: '',
            entreprise: '',
            roles: ['expert'],
            isActive: true,
            save: async function save() {
              savedDocs.push({
                email: this.email,
                roles: this.roles,
                phone: this.phone
              })
              return this
            }
          }
        ]
      }
    })

    Person.prototype.save = async function save() {
      savedDocs.push({
        email: this.email,
        roles: this.roles,
        phone: this.phone
      })
      return this
    }

    const response = await fetch(`${baseUrl}/api/planning/persons`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        firstName: 'Alain',
        lastName: 'Pittet',
        email: 'alain.pittet@info-domo.ch',
        roles: ['expert']
      })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.created, false)
    assert.equal(body.merged, true)
    assert.equal(body.person.email, 'alain.pittet@info-domo.ch')
    assert.equal(savedDocs.length, 1)
    assert.equal(savedDocs[0].email, 'alain.pittet@info-domo.ch')
  } finally {
    Person.findOne = originalFindOne
    Person.find = originalFind
    Person.prototype.save = originalSave
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('PUT /api/planning/persons/:id persists sendEmails, candidateYears, preferredSoutenanceDates and preferredSoutenanceChoices', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret)
  const originalFindByIdAndUpdate = Person.findByIdAndUpdate
  const originalFindOne = Person.findOne
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    Person.findOne = async () => null
    Person.findByIdAndUpdate = async (personId, update, options) => ({
      _id: personId,
      ...update,
      options
    })

    const response = await fetch(`${baseUrl}/api/planning/persons/${VALID_OBJECT_ID}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        firstName: 'Alice',
        lastName: 'Martin',
        roles: ['candidat'],
        sendEmails: false,
        candidateYears: [2026, '2025'],
        preferredSoutenanceDates: ['2026-06-12', '2026-06-10', '2026-06-12', 'invalid-date'],
        preferredSoutenanceChoices: [
          { date: '2026-06-12', period: 3 },
          { date: '2026-06-10', period: '1' },
          { date: '2026-06-10', period: 6 },
          { date: 'invalid-date', period: 2 }
        ]
      })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body._id, VALID_OBJECT_ID)
    assert.equal(body.sendEmails, false)
    assert.deepEqual(body.candidateYears, [2025, 2026])
    assert.deepEqual(body.preferredSoutenanceDates, ['2026-06-12', '2026-06-10'])
    assert.deepEqual(body.preferredSoutenanceChoices, [
      { date: '2026-06-12', period: 3 },
      { date: '2026-06-10', period: 1 }
    ])
    assert.deepEqual(body.roles, ['candidat'])
  } finally {
    Person.findByIdAndUpdate = originalFindByIdAndUpdate
    Person.findOne = originalFindOne
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('GET /api/planning/persons accepts prefixed short id search', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret)
  const originalFind = Person.find
  let receivedFilter = null
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    Person.find = (query) => {
      receivedFilter = query

      return {
        select() {
          return {
            sort() {
              return Promise.resolve([
                {
                  _id: VALID_OBJECT_ID,
                  firstName: 'Alice',
                  lastName: 'Martin',
                  email: 'alice@example.com',
                  roles: ['expert'],
                  shortId: 1,
                  isActive: true
                }
              ])
            }
          }
        }
      }
    }

    const response = await fetch(`${baseUrl}/api/planning/persons?search=E-001`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.length, 1)
    assert.equal(receivedFilter.isActive, true)
    assert.ok(Array.isArray(receivedFilter.$or))
    assert.ok(receivedFilter.$or.some((entry) => entry?.shortId === 1))
  } finally {
    Person.find = originalFind
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/planning/persons/merge merges duplicate people and rewires references', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret)
  const originalFindById = Person.findById
  const originalDeleteMany = Person.deleteMany
  const originalSave = Person.prototype.save
  const originalTpiPlanningUpdateMany = TpiPlanning.updateMany
  const originalSlotUpdateMany = Slot.updateMany
  const originalMagicLinkUpdateMany = MagicLink.updateMany
  const originalDb = mongoose.connection.db
  const calls = {
    savedTarget: null,
    deleteMany: null,
    tpiPlanningUpdates: [],
    slotUpdates: [],
    magicLinkUpdates: [],
    legacyUpdates: []
  }
  const targetPersonId = '507f1f77bcf86cd799439021'
  const sourcePersonId = '507f1f77bcf86cd799439022'
  const targetPerson = {
    _id: targetPersonId,
    firstName: 'Alice',
    lastName: 'Martin',
    email: 'alice.primary@example.com',
    phone: '',
    site: '',
    entreprise: '',
    roles: ['expert'],
    isActive: true,
    sendEmails: true,
    candidateYears: [],
    preferredSoutenanceDates: ['2026-06-11'],
    preferredSoutenanceChoices: [{ date: '2026-06-11', period: 2 }],
    save: async function save() {
      calls.savedTarget = {
        email: this.email,
        phone: this.phone,
        roles: this.roles,
        candidateYears: this.candidateYears,
        preferredSoutenanceDates: this.preferredSoutenanceDates,
        preferredSoutenanceChoices: this.preferredSoutenanceChoices
      }
      return this
    }
  }
  const sourcePerson = {
    _id: sourcePersonId,
    firstName: 'Alice',
    lastName: 'Martin',
    email: 'alice.secondary@example.com',
    phone: '079 111 22 33',
    site: 'ETML',
    entreprise: 'ACME',
    roles: ['chef_projet'],
    isActive: true,
    sendEmails: false,
    candidateYears: [2025],
    preferredSoutenanceDates: ['2026-06-10', '2026-06-12'],
    preferredSoutenanceChoices: [
      { date: '2026-06-10', period: 1 },
      { date: '2026-06-12', period: 4 }
    ]
  }
  const sourceObjectId = new mongoose.Types.ObjectId(sourcePersonId)
  const targetObjectId = new mongoose.Types.ObjectId(targetPersonId)
  const makeUpdateManyMock = (bucket) => async (filter, update) => {
    bucket.push({ filter, update })
    return { matchedCount: 1, modifiedCount: 1 }
  }

  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    Person.findById = async (personId) => {
      if (String(personId) === targetPersonId) {
        return targetPerson
      }

      if (String(personId) === sourcePersonId) {
        return sourcePerson
      }

      return null
    }

    Person.deleteMany = async (filter) => {
      calls.deleteMany = filter
      return { deletedCount: 1 }
    }

    Person.prototype.save = originalSave
    TpiPlanning.updateMany = makeUpdateManyMock(calls.tpiPlanningUpdates)
    Slot.updateMany = makeUpdateManyMock(calls.slotUpdates)
    MagicLink.updateMany = makeUpdateManyMock(calls.magicLinkUpdates)
    mongoose.connection.db = {
      listCollections: () => ({
        toArray: async () => [{ name: 'tpiList_2025' }, { name: 'not_related' }]
      }),
      collection: (name) => ({
        updateMany: async (filter, update) => {
          calls.legacyUpdates.push({ name, filter, update })
          return { matchedCount: 1, modifiedCount: 1 }
        }
      })
    }

    const response = await fetch(`${baseUrl}/api/planning/persons/merge`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        targetPersonId,
        sourcePersonIds: [sourcePersonId]
      })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.merged, true)
    assert.equal(body.deletedCount, 1)
    assert.equal(body.targetPerson.email, 'alice.primary@example.com')
    assert.equal(targetPerson.phone, '079 111 22 33')
    assert.deepEqual(targetPerson.roles, ['expert', 'chef_projet'])
    assert.deepEqual(targetPerson.candidateYears, [2025])
    assert.deepEqual(targetPerson.preferredSoutenanceDates, ['2026-06-11', '2026-06-10', '2026-06-12'])
    assert.deepEqual(targetPerson.preferredSoutenanceChoices, [
      { date: '2026-06-11', period: 2 },
      { date: '2026-06-10', period: 1 },
      { date: '2026-06-12', period: 4 }
    ])
    assert.deepEqual(calls.deleteMany, { _id: { $in: [sourceObjectId] } })
    assert.equal(calls.tpiPlanningUpdates.length, 4)
    assert.equal(calls.slotUpdates.length, 4)
    assert.equal(calls.magicLinkUpdates.length, 1)
    assert.equal(calls.legacyUpdates.length, 4)
    assert.deepEqual(
      calls.tpiPlanningUpdates.map((entry) => Object.keys(entry.filter)[0]).sort(),
      ['candidat', 'chefProjet', 'expert1', 'expert2']
    )
    assert.deepEqual(
      calls.legacyUpdates.map((entry) => Object.keys(entry.filter)[0]).sort(),
      ['bossPersonId', 'candidatPersonId', 'expert1PersonId', 'expert2PersonId']
    )
    assert.equal(String(calls.tpiPlanningUpdates[0].update.$set.candidat), targetPersonId)
    assert.equal(String(calls.slotUpdates[0].update.$set['assignments.candidat']), targetPersonId)
    assert.equal(String(calls.magicLinkUpdates[0].update.$set.personId), targetPersonId)
    assert.equal(calls.legacyUpdates[0].name, 'tpiList_2025')
    assert.equal(String(calls.legacyUpdates[0].update.$set.candidatPersonId), targetPersonId)
  } finally {
    Person.findById = originalFindById
    Person.deleteMany = originalDeleteMany
    Person.prototype.save = originalSave
    TpiPlanning.updateMany = originalTpiPlanningUpdateMany
    Slot.updateMany = originalSlotUpdateMany
    MagicLink.updateMany = originalMagicLinkUpdateMany
    mongoose.connection.db = originalDb
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/planning/persons/merge allows manual merge when identities differ explicitly', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret)
  const originalFindById = Person.findById
  const originalDeleteMany = Person.deleteMany
  const originalSave = Person.prototype.save
  const originalTpiPlanningUpdateMany = TpiPlanning.updateMany
  const originalSlotUpdateMany = Slot.updateMany
  const originalMagicLinkUpdateMany = MagicLink.updateMany
  const originalDb = mongoose.connection.db
  const targetPersonId = '507f1f77bcf86cd799439031'
  const sourcePersonId = '507f1f77bcf86cd799439032'
  const targetPerson = {
    _id: targetPersonId,
    firstName: 'Alice',
    lastName: 'Martin',
    email: 'alice.primary@example.com',
    phone: '',
    site: '',
    entreprise: '',
    roles: ['expert'],
    isActive: true,
    sendEmails: true,
    candidateYears: [],
    save: async function save() {
      return this
    }
  }
  const sourcePerson = {
    _id: sourcePersonId,
    firstName: 'Alicia',
    lastName: 'Martins',
    email: 'alicia.secondary@example.com',
    phone: '079 111 22 33',
    site: 'ETML',
    entreprise: 'ACME',
    roles: ['chef_projet'],
    isActive: true,
    sendEmails: true,
    candidateYears: []
  }

  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)

  try {
    Person.findById = async (personId) => {
      if (String(personId) === targetPersonId) {
        return targetPerson
      }

      if (String(personId) === sourcePersonId) {
        return sourcePerson
      }

      return null
    }

    Person.deleteMany = async () => ({ deletedCount: 1 })
    Person.prototype.save = originalSave
    TpiPlanning.updateMany = async () => ({ matchedCount: 1, modifiedCount: 1 })
    Slot.updateMany = async () => ({ matchedCount: 1, modifiedCount: 1 })
    MagicLink.updateMany = async () => ({ matchedCount: 1, modifiedCount: 1 })
    mongoose.connection.db = {
      listCollections: () => ({
        toArray: async () => []
      }),
      collection: () => ({
        updateMany: async () => ({ matchedCount: 0, modifiedCount: 0 })
      })
    }

    const response = await fetch(`${baseUrl}/api/planning/persons/merge`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        targetPersonId,
        sourcePersonIds: [sourcePersonId],
        allowDifferentIdentity: true
      })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.merged, true)
    assert.equal(body.deletedCount, 1)
  } finally {
    Person.findById = originalFindById
    Person.deleteMany = originalDeleteMany
    Person.prototype.save = originalSave
    TpiPlanning.updateMany = originalTpiPlanningUpdateMany
    Slot.updateMany = originalSlotUpdateMany
    MagicLink.updateMany = originalMagicLinkUpdateMany
    mongoose.connection.db = originalDb
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})
