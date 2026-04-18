const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')

const { loadTestApp } = require('./helpers/loadTestApp')
const Person = require('../models/personModel')
const TpiModelsYear = require('../models/tpiModels')
const TpiPlanning = require('../models/tpiPlanningModel')
const Vote = require('../models/voteModel')

async function startServer(app) {
  return await new Promise((resolve) => {
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

test('GET /api/tpi-dossier/:year/:ref requires authentication', async () => {
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
    const response = await fetch(`${baseUrl}/api/tpi-dossier/2026/2163`)
    const payload = await response.json()

    assert.equal(response.status, 401)
    assert.equal(payload.message, 'Authentification requise')
  } finally {
    await new Promise((resolve) => server.close(resolve))
    restoreEnv()
  }
})

test('GET /api/tpi-dossier/:year/:ref returns a merged dossier for a workflow reference', async () => {
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
  const originalLegacyFindOne = tpiModel.findOne
  const originalPersonFind = Person.find
  const originalPlanningFindOne = TpiPlanning.findOne
  const originalVoteFind = Vote.find

  let capturedLegacyFilter = null
  let capturedPlanningFilter = null

  try {
    const loginPayload = await login(baseUrl)

    tpiModel.findOne = async (filter) => {
      capturedLegacyFilter = filter
      return {
        _id: 'legacy-1',
        refTpi: '042',
        candidat: 'Alice Martin',
        candidatPersonId: 'candidate-1',
        experts: {
          1: 'Bob Expert',
          2: 'Carla Expert'
        },
        expert1PersonId: 'expert-1',
        expert2PersonId: 'expert-2',
        boss: 'Diane Boss',
        bossPersonId: 'boss-1',
        sujet: 'Sujet legacy'
      }
    }

    Person.find = () => ({
      select() {
        return {
          lean: async () => ([
            {
              _id: 'candidate-1',
              firstName: 'Alice',
              lastName: 'Martin',
              roles: ['candidat'],
              candidateYears: [2026],
              isActive: true
            },
            {
              _id: 'expert-1',
              firstName: 'Bob',
              lastName: 'Expert',
              roles: ['expert'],
              isActive: true
            },
            {
              _id: 'expert-2',
              firstName: 'Carla',
              lastName: 'Expert',
              roles: ['expert'],
              isActive: true
            },
            {
              _id: 'boss-1',
              firstName: 'Diane',
              lastName: 'Boss',
              roles: ['chef_projet'],
              isActive: true
            }
          ])
        }
      }
    })

    TpiPlanning.findOne = (filter) => {
      capturedPlanningFilter = filter

      return {
        populate() {
          return this
        },
        lean: async () => ({
          _id: 'planning-1',
          reference: 'TPI-2026-042',
          status: 'voting',
          sujet: 'Sujet planning',
          candidat: { firstName: 'Alice', lastName: 'Martin' },
          expert1: { firstName: 'Bob', lastName: 'Expert' },
          expert2: { firstName: 'Carla', lastName: 'Expert' },
          chefProjet: { firstName: 'Diane', lastName: 'Boss' },
          proposedSlots: [{
            slot: {
              _id: 'slot-1',
              date: '2026-06-10',
              startTime: '08:00',
              room: { name: 'A101' }
            }
          }],
          votingSession: {
            voteSummary: {
              expert1Voted: true,
              expert2Voted: false,
              chefProjetVoted: true
            }
          }
        })
      }
    }

    Vote.find = () => ({
      populate() {
        return this
      },
      sort() {
        return this
      },
      lean: async () => ([
        {
          _id: 'vote-1',
          voterRole: 'expert1',
          decision: 'accepted',
          votedAt: '2026-05-01T08:00:00.000Z',
          voter: { firstName: 'Bob', lastName: 'Expert' },
          slot: {
            date: '2026-06-10',
            startTime: '08:00',
            room: { name: 'A101' }
          }
        },
        {
          _id: 'vote-2',
          voterRole: 'expert2',
          decision: 'pending',
          voter: { firstName: 'Carla', lastName: 'Expert' },
          slot: {
            date: '2026-06-10',
            startTime: '08:00',
            room: { name: 'A101' }
          }
        }
      ])
    })

    const response = await fetch(`${baseUrl}/api/tpi-dossier/2026/TPI-2026-042`, {
      headers: {
        Authorization: `Bearer ${loginPayload.token}`
      }
    })
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.deepEqual(capturedLegacyFilter.refTpi.$in, ['TPI-2026-042', '042'])
    assert.deepEqual(capturedPlanningFilter.reference.$in, ['TPI-2026-042'])
    assert.equal(payload.identifiers.legacyRef, '042')
    assert.equal(payload.identifiers.workflowReference, 'TPI-2026-042')
    assert.equal(payload.legacy.exists, true)
    assert.equal(payload.planning.exists, true)
    assert.equal(payload.consistency.importedToPlanning, true)
    assert.equal(payload.planning.voteSummary.totalVotes, 2)
    assert.equal(payload.planning.voteSummary.pendingVotes, 1)
    assert.equal(payload.planning.voteSummary.acceptedVotes, 1)
    assert.equal(payload.planning.plannedSlot.room.name, 'A101')
  } finally {
    tpiModel.findOne = originalLegacyFindOne
    Person.find = originalPersonFind
    TpiPlanning.findOne = originalPlanningFindOne
    Vote.find = originalVoteFind
    await new Promise((resolve) => server.close(resolve))
    restoreEnv()
  }
})
