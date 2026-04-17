const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')

const { loadTestApp } = require('./helpers/loadTestApp')
const Vote = require('../models/voteModel')
const TpiPlanning = require('../models/tpiPlanningModel')
const schedulingService = require('../services/schedulingService')

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

function buildSessionToken(secret, roles = ['expert1']) {
  return jwt.sign(
    {
      id: VALID_OBJECT_ID,
      email: 'expert@example.com',
      roles
    },
    secret,
    { expiresIn: '1h' }
  )
}

function patchMethod(target, key, implementation) {
  const original = target[key]
  target[key] = implementation
  return () => {
    target[key] = original
  }
}

function createVoteRecord({ voteId, voterId, tpiId, year = 2026 }) {
  return {
    _id: new mongoose.Types.ObjectId(voteId),
    tpiPlanning: { _id: tpiId, year },
    voter: voterId,
    voterRole: 'expert1',
    decision: 'pending',
    comment: '',
    availabilityException: false,
    priority: undefined,
    votedAt: null,
    save: async function save() {
      return this
    }
  }
}

function makeVoteQuery(vote) {
  return {
    populate: async () => vote
  }
}

function makeFindQuery(result) {
  return {
    select() {
      return this
    },
    sort: async () => result
  }
}

test('POST /api/planning/votes/bulk enregistre OK, alternatives et exception', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['expert1'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)
  const voterId = new mongoose.Types.ObjectId(VALID_OBJECT_ID)
  const tpiId = new mongoose.Types.ObjectId()
  const voteIds = {
    fixed: new mongoose.Types.ObjectId().toString(),
    alt1: new mongoose.Types.ObjectId().toString(),
    alt2: new mongoose.Types.ObjectId().toString(),
    alt3: new mongoose.Types.ObjectId().toString()
  }
  const savedVotes = new Map()
  const registerCalls = []

  const restore = [
    patchMethod(Vote, 'findById', (voteId) => {
      const vote = savedVotes.get(String(voteId))
      return vote ? makeVoteQuery(vote) : makeVoteQuery(null)
    }),
    patchMethod(Vote, 'countDocuments', async (filter) => {
      let count = 0

      for (const vote of savedVotes.values()) {
        if (String(vote.tpiPlanning._id) !== String(filter.tpiPlanning)) {
          continue
        }

        if (String(vote.voter) !== String(filter.voter)) {
          continue
        }

        if (filter.decision && vote.decision !== filter.decision) {
          continue
        }

        if (filter._id?.$ne && String(vote._id) === String(filter._id.$ne)) {
          continue
        }

        count += 1
      }

      return count
    }),
    patchMethod(schedulingService, 'registerVoteAndCheckValidation', async (voteId, decision, comment) => {
      registerCalls.push({ voteId: String(voteId), decision, comment })
      return {
        success: true,
        validation: { autoValidated: false }
      }
    })
  ]

  const createAndStoreVote = (voteId) => {
    const vote = createVoteRecord({ voteId, voterId, tpiId })
    vote.save = async function save() {
      savedVotes.set(voteId, this)
      return this
    }
    savedVotes.set(voteId, vote)
    return vote
  }

  createAndStoreVote(voteIds.fixed)
  createAndStoreVote(voteIds.alt1)
  createAndStoreVote(voteIds.alt2)
  createAndStoreVote(voteIds.alt3)

  try {
    const response = await fetch(`${baseUrl}/api/planning/votes/bulk`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        votes: [
          { voteId: voteIds.fixed, decision: 'accepted', comment: 'OK', priority: 5 },
          { voteId: voteIds.alt1, decision: 'preferred', comment: 'Alternative 1', priority: 1 },
          { voteId: voteIds.alt2, decision: 'preferred', comment: 'Alternative 2', priority: 1 },
          { voteId: voteIds.alt3, decision: 'rejected', comment: 'Impossible', availabilityException: true }
        ]
      })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.results.length, 4)
    assert.deepEqual(body.results.map(result => result.success), [true, true, true, true])
    assert.equal(registerCalls.length, 1)
    assert.equal(registerCalls[0].decision, 'accepted')
    assert.equal(savedVotes.get(voteIds.fixed).decision, 'accepted')
    assert.equal(savedVotes.get(voteIds.alt1).decision, 'preferred')
    assert.equal(savedVotes.get(voteIds.alt2).decision, 'preferred')
    assert.equal(savedVotes.get(voteIds.alt3).decision, 'rejected')
    assert.equal(savedVotes.get(voteIds.alt3).availabilityException, true)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/planning/votes/bulk refuse un 4e créneau préféré', async () => {
  const jwtSecret = 'test-jwt-secret'
  const token = buildSessionToken(jwtSecret, ['expert1'])
  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)
  const voterId = new mongoose.Types.ObjectId(VALID_OBJECT_ID)
  const tpiId = new mongoose.Types.ObjectId()
  const voteIds = {
    vote1: new mongoose.Types.ObjectId().toString(),
    vote2: new mongoose.Types.ObjectId().toString(),
    vote3: new mongoose.Types.ObjectId().toString(),
    vote4: new mongoose.Types.ObjectId().toString()
  }
  const savedVotes = new Map()
  const registerCalls = []

  const restore = [
    patchMethod(Vote, 'findById', (voteId) => {
      const vote = savedVotes.get(String(voteId))
      return vote ? makeVoteQuery(vote) : makeVoteQuery(null)
    }),
    patchMethod(Vote, 'countDocuments', async (filter) => {
      let count = 0

      for (const vote of savedVotes.values()) {
        if (String(vote.tpiPlanning._id) !== String(filter.tpiPlanning)) {
          continue
        }

        if (String(vote.voter) !== String(filter.voter)) {
          continue
        }

        if (filter.decision && vote.decision !== filter.decision) {
          continue
        }

        if (filter._id?.$ne && String(vote._id) === String(filter._id.$ne)) {
          continue
        }

        count += 1
      }

      return count
    }),
    patchMethod(schedulingService, 'registerVoteAndCheckValidation', async (voteId, decision, comment) => {
      registerCalls.push({ voteId: String(voteId), decision, comment })
      return {
        success: true,
        validation: { autoValidated: false }
      }
    })
  ]

  const createAndStoreVote = (voteId) => {
    const vote = createVoteRecord({ voteId, voterId, tpiId })
    vote.save = async function save() {
      savedVotes.set(voteId, this)
      return this
    }
    savedVotes.set(voteId, vote)
    return vote
  }

  createAndStoreVote(voteIds.vote1)
  createAndStoreVote(voteIds.vote2)
  createAndStoreVote(voteIds.vote3)
  createAndStoreVote(voteIds.vote4)

  try {
    const response = await fetch(`${baseUrl}/api/planning/votes/bulk`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        votes: [
          { voteId: voteIds.vote1, decision: 'preferred', priority: 1 },
          { voteId: voteIds.vote2, decision: 'preferred', priority: 1 },
          { voteId: voteIds.vote3, decision: 'preferred', priority: 1 },
          { voteId: voteIds.vote4, decision: 'preferred', priority: 1 }
        ]
      })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.results.length, 4)
    assert.deepEqual(body.results.map(result => result.success), [true, true, true, false])
    assert.equal(body.results[3].error, 'Maximum 3 créneaux alternatifs par TPI et par votant.')
    assert.equal(registerCalls.length, 1)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})

test('POST /api/planning/votes/respond/:tpiId enregistre une proposition scoped sur le TPI', async () => {
  const jwtSecret = 'test-jwt-secret'
  const scopedTpiId = new mongoose.Types.ObjectId().toString()
  const fixedSlotId = new mongoose.Types.ObjectId().toString()
  const altSlotId = new mongoose.Types.ObjectId().toString()
  const fixedVoteId = new mongoose.Types.ObjectId().toString()
  const altVoteId = new mongoose.Types.ObjectId().toString()

  const token = jwt.sign(
    {
      id: VALID_OBJECT_ID,
      email: 'expert@example.com',
      roles: ['expert1'],
      authContext: {
        type: 'vote_magic_link',
        year: 2026,
        personId: VALID_OBJECT_ID,
        scope: {
          tpiId: scopedTpiId
        }
      }
    },
    jwtSecret,
    { expiresIn: '1h' }
  )

  const { app, restoreEnv } = loadTestApp({
    NODE_ENV: 'development',
    JWT_SECRET: jwtSecret
  })

  const { server, baseUrl } = await startServer(app)
  const voterId = new mongoose.Types.ObjectId(VALID_OBJECT_ID)
  const existingVotes = [
    {
      _id: new mongoose.Types.ObjectId(fixedVoteId),
      tpiPlanning: scopedTpiId,
      slot: fixedSlotId,
      voter: voterId,
      voterRole: 'expert1',
      decision: 'pending',
      comment: '',
      availabilityException: false,
      specialRequestReason: '',
      specialRequestDate: null,
      priority: undefined,
      votedAt: null,
      magicLinkUsed: null,
      save: async function save() { return this }
    },
    {
      _id: new mongoose.Types.ObjectId(altVoteId),
      tpiPlanning: scopedTpiId,
      slot: altSlotId,
      voter: voterId,
      voterRole: 'expert1',
      decision: 'pending',
      comment: '',
      availabilityException: false,
      specialRequestReason: '',
      specialRequestDate: null,
      priority: undefined,
      votedAt: null,
      magicLinkUsed: null,
      save: async function save() { return this }
    }
  ]

  const restore = [
    patchMethod(TpiPlanning, 'findById', () => ({
      populate: async () => ({
        _id: scopedTpiId,
        year: 2026,
        expert1: { _id: voterId },
        expert2: { _id: new mongoose.Types.ObjectId() },
        chefProjet: { _id: new mongoose.Types.ObjectId() },
        proposedSlots: [
          {
            slot: { _id: fixedSlotId }
          }
        ]
      })
    })),
    patchMethod(Vote, 'find', () => makeFindQuery(existingVotes)),
    patchMethod(schedulingService, 'findAvailableSlotsForTpi', async () => []),
    patchMethod(schedulingService, 'registerVoteAndCheckValidation', async (voteId, decision, comment) => ({
      success: true,
      voteId: String(voteId),
      decision,
      comment
    }))
  ]

  try {
    const response = await fetch(`${baseUrl}/api/planning/votes/respond/${scopedTpiId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fixedVoteId,
        mode: 'proposal',
        proposedSlotIds: [altSlotId]
      })
    })

    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.success, true)
    assert.equal(existingVotes[0].decision, 'rejected')
    assert.equal(existingVotes[0].comment, 'Proposition de créneaux alternatifs')
    assert.equal(existingVotes[1].decision, 'preferred')
    assert.equal(existingVotes[1].priority, 1)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
    await new Promise(resolve => server.close(resolve))
    restoreEnv()
  }
})
