const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')

const TpiPlanning = require('../models/tpiPlanningModel')
const {
  toPlanningTpiResponseObject
} = require('../services/planningTpiResponseService')

test('toPlanningTpiResponseObject allows computed vote fields to be serialized', () => {
  const personId = new mongoose.Types.ObjectId()
  const tpi = new TpiPlanning({
    reference: 'TPI-2026-001',
    year: 2026,
    candidat: personId,
    expert1: new mongoose.Types.ObjectId(),
    expert2: new mongoose.Types.ObjectId(),
    chefProjet: new mongoose.Types.ObjectId(),
    status: 'voting'
  })

  tpi.voteRoleStatus = {
    expert1: { decision: 'accepted', responseMode: 'ok' }
  }

  assert.equal(JSON.parse(JSON.stringify(tpi)).voteRoleStatus, undefined)

  const responseTpi = toPlanningTpiResponseObject(tpi)
  responseTpi.voteRoleStatus = {
    expert1: { decision: 'accepted', responseMode: 'ok' },
    expert2: { decision: 'pending', responseMode: 'pending' },
    chef_projet: { decision: 'pending', responseMode: 'pending' }
  }
  responseTpi.voteStats = {
    totalVotes: 3,
    pendingVotes: 2,
    acceptedVotes: 1,
    preferredVotes: 0,
    rejectedVotes: 0,
    respondedVotes: 1
  }

  const serialized = JSON.parse(JSON.stringify(responseTpi))

  assert.equal(serialized.reference, 'TPI-2026-001')
  assert.equal(serialized.voteRoleStatus.expert1.responseMode, 'ok')
  assert.equal(serialized.voteStats.respondedVotes, 1)
})
