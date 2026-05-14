const test = require('node:test')
const assert = require('node:assert/strict')

const servicePath = require.resolve('../services/legacyPlanningBridgeService')
const coordinationConfigService = require('../services/coordinationConfigService')
const Person = require('../models/personModel')
const Slot = require('../models/slotModel')
const TpiPlanning = require('../models/tpiCoordinationModel')
require('../models/tpiModels')
const TpiModelsYearPath = require.resolve('../models/tpiModels')
const tpiRoomsModels = require('../models/tpiRoomsModels')
const Vote = require('../models/voteModel')

function clearLegacyPlanningBridgeService() {
  delete require.cache[servicePath]
}

test('rebuildWorkflowFromLegacyPlanning ignores legacy entries outside configured coordination sites', async () => {
  const originalGetPlanningConfig = coordinationConfigService.getPlanningConfig
  const originalPersonFind = Person.find
  const originalSlotDeleteMany = Slot.deleteMany
  const originalSlotCreate = Slot.create
  const originalTpiPlanningFind = TpiPlanning.find
  const originalTpiPlanningDeleteMany = TpiPlanning.deleteMany
  const originalTpiPlanningCreate = TpiPlanning.create
  const originalCreateTpiRoomModel = tpiRoomsModels.createTpiRoomModel
  const originalVoteDeleteMany = Vote.deleteMany
  const originalVoteInsertMany = Vote.insertMany
  const originalConsoleWarn = console.warn
  const originalTpiModelsModule = require.cache[TpiModelsYearPath]

  let tpiCreateCount = 0
  let slotCreateCount = 0
  let voteInsertCount = 0

  coordinationConfigService.getPlanningConfig = async () => ({
    siteConfigs: [
      {
        siteCode: 'ETML',
        active: true
      }
    ]
  })

  Person.find = () => ({
    select() {
      return {
        lean: async () => ([])
      }
    }
  })

  TpiPlanning.find = () => ({
    distinct: async () => ([])
  })
  TpiPlanning.deleteMany = async () => ({ acknowledged: true })
  TpiPlanning.create = async () => {
    tpiCreateCount += 1
    throw new Error('TpiPlanning.create should not be called for out-of-scope coordination entries.')
  }

  tpiRoomsModels.createTpiRoomModel = () => ({
    deleteMany: async () => ({ acknowledged: true }),
    insertMany: async () => ({ acknowledged: true })
  })

  Slot.deleteMany = async () => ({ acknowledged: true })
  Slot.create = async () => {
    slotCreateCount += 1
    throw new Error('Slot.create should not be called for out-of-scope legacy entries.')
  }

  Vote.deleteMany = async () => ({ acknowledged: true })
  Vote.insertMany = async () => {
    voteInsertCount += 1
    throw new Error('Vote.insertMany should not be called for out-of-scope legacy entries.')
  }

  require.cache[TpiModelsYearPath].exports = () => ({
    find() {
      return {
        lean: async () => ([])
      }
    }
  })

  console.warn = () => {}

  clearLegacyPlanningBridgeService()
  const { rebuildWorkflowFromLegacyPlanning } = require('../services/legacyPlanningBridgeService')

  try {
    const summary = await rebuildWorkflowFromLegacyPlanning({
      year: 2026,
      legacyRooms: [
        {
          idRoom: 1,
          lastUpdate: Date.now(),
          site: 'CFPV',
          date: '2026-06-10',
          name: 'A101',
          tpiDatas: [
            {
              refTpi: '3001',
              period: 1,
              candidat: 'Alice Example',
              expert1: { name: 'Expert 1' },
              expert2: { name: 'Expert 2' },
              boss: { name: 'Chef Projet' }
            }
          ]
        }
      ]
    })

    assert.equal(summary.tpiCount, 0)
    assert.equal(summary.slotCount, 0)
    assert.equal(summary.voteCount, 0)
    assert.equal(summary.skippedEntries, 1)
    assert.equal(summary.outOfScopeEntries, 1)
    assert.equal(summary.externalEntries, 0)
    assert.equal(summary.unconfiguredSiteEntries, 1)
    assert.equal(tpiCreateCount, 0)
    assert.equal(slotCreateCount, 0)
    assert.equal(voteInsertCount, 0)
  } finally {
    coordinationConfigService.getPlanningConfig = originalGetPlanningConfig
    Person.find = originalPersonFind
    Slot.deleteMany = originalSlotDeleteMany
    Slot.create = originalSlotCreate
    TpiPlanning.find = originalTpiPlanningFind
    TpiPlanning.deleteMany = originalTpiPlanningDeleteMany
    TpiPlanning.create = originalTpiPlanningCreate
    tpiRoomsModels.createTpiRoomModel = originalCreateTpiRoomModel
    Vote.deleteMany = originalVoteDeleteMany
    Vote.insertMany = originalVoteInsertMany
    console.warn = originalConsoleWarn

    if (originalTpiModelsModule) {
      require.cache[TpiModelsYearPath] = originalTpiModelsModule
    } else {
      delete require.cache[TpiModelsYearPath]
    }

    clearLegacyPlanningBridgeService()
  }
})

test('rebuildWorkflowFromLegacyPlanning creates available slots for generated empty room slots without stakeholder warnings', async () => {
  const originalGetPlanningConfig = coordinationConfigService.getPlanningConfig
  const originalPersonFind = Person.find
  const originalSlotDeleteMany = Slot.deleteMany
  const originalSlotCreate = Slot.create
  const originalTpiPlanningFind = TpiPlanning.find
  const originalTpiPlanningDeleteMany = TpiPlanning.deleteMany
  const originalTpiPlanningCreate = TpiPlanning.create
  const originalCreateTpiRoomModel = tpiRoomsModels.createTpiRoomModel
  const originalVoteDeleteMany = Vote.deleteMany
  const originalVoteInsertMany = Vote.insertMany
  const originalConsoleWarn = console.warn
  const originalTpiModelsModule = require.cache[TpiModelsYearPath]

  let tpiCreateCount = 0
  let slotCreateCount = 0
  let voteInsertCount = 0
  const createdSlots = []
  const warnings = []

  coordinationConfigService.getPlanningConfig = async () => ({
    siteConfigs: [
      {
        siteCode: 'VENNES',
        active: true
      }
    ]
  })

  Person.find = () => ({
    select() {
      return {
        lean: async () => ([])
      }
    }
  })

  TpiPlanning.find = () => ({
    distinct: async () => ([])
  })
  TpiPlanning.deleteMany = async () => ({ acknowledged: true })
  TpiPlanning.create = async () => {
    tpiCreateCount += 1
    throw new Error('TpiPlanning.create should not be called for generated empty slots.')
  }

  tpiRoomsModels.createTpiRoomModel = () => ({
    deleteMany: async () => ({ acknowledged: true }),
    insertMany: async () => ({ acknowledged: true })
  })

  Slot.deleteMany = async () => ({ acknowledged: true })
  Slot.create = async (doc) => {
    slotCreateCount += 1
    createdSlots.push(doc)
    return {
      ...doc,
      _id: `slot-empty-${slotCreateCount}`
    }
  }

  Vote.deleteMany = async () => ({ acknowledged: true })
  Vote.insertMany = async () => {
    voteInsertCount += 1
    throw new Error('Vote.insertMany should not be called for generated empty slots.')
  }

  require.cache[TpiModelsYearPath].exports = () => ({
    find() {
      return {
        lean: async () => ([])
      }
    }
  })

  console.warn = (message) => {
    warnings.push(String(message))
  }

  clearLegacyPlanningBridgeService()
  const { rebuildWorkflowFromLegacyPlanning } = require('../services/legacyPlanningBridgeService')

  try {
    const summary = await rebuildWorkflowFromLegacyPlanning({
      year: 2026,
      legacyRooms: [
        {
          idRoom: 1,
          lastUpdate: Date.now(),
          site: 'VENNES',
          date: '2026-06-04',
          name: 'Vennes - A22',
          tpiDatas: [
            {
              id: 'vennes_0_5',
              refTpi: null,
              period: 6,
              candidat: '',
              candidatPersonId: '',
              expert1: { name: '', personId: '' },
              expert2: { name: '', personId: '' },
              boss: { name: '', personId: '' }
            },
            {
              id: 'vennes_0_6',
              refTpi: null,
              period: 7
            }
          ]
        }
      ]
    })

    assert.equal(summary.tpiCount, 0)
    assert.equal(summary.slotCount, 2)
    assert.equal(summary.voteCount, 0)
    assert.equal(summary.skippedEntries, 0)
    assert.equal(summary.emptySlotEntries, 2)
    assert.deepEqual(summary.missingReferences, [])
    assert.equal(
      warnings.some((message) => message.includes('TPI IGNORÉ (parties prenantes invalides)')),
      false
    )
    assert.equal(tpiCreateCount, 0)
    assert.equal(slotCreateCount, 2)
    assert.deepEqual(createdSlots.map((slot) => ({
      period: slot.period,
      status: slot.status,
      assignedTpi: slot.assignedTpi
    })), [
      { period: 1, status: 'available', assignedTpi: null },
      { period: 2, status: 'available', assignedTpi: null }
    ])
    assert.equal(voteInsertCount, 0)
  } finally {
    coordinationConfigService.getPlanningConfig = originalGetPlanningConfig
    Person.find = originalPersonFind
    Slot.deleteMany = originalSlotDeleteMany
    Slot.create = originalSlotCreate
    TpiPlanning.find = originalTpiPlanningFind
    TpiPlanning.deleteMany = originalTpiPlanningDeleteMany
    TpiPlanning.create = originalTpiPlanningCreate
    tpiRoomsModels.createTpiRoomModel = originalCreateTpiRoomModel
    Vote.deleteMany = originalVoteDeleteMany
    Vote.insertMany = originalVoteInsertMany
    console.warn = originalConsoleWarn

    if (originalTpiModelsModule) {
      require.cache[TpiModelsYearPath] = originalTpiModelsModule
    } else {
      delete require.cache[TpiModelsYearPath]
    }

    clearLegacyPlanningBridgeService()
  }
})

test('rebuildWorkflowFromLegacyPlanning uses displayed slot order instead of stale embedded periods', async () => {
  const originalGetPlanningConfig = coordinationConfigService.getPlanningConfig
  const originalPersonFind = Person.find
  const originalPersonFindById = Person.findById
  const originalSlotDeleteMany = Slot.deleteMany
  const originalSlotCreate = Slot.create
  const originalTpiPlanningFind = TpiPlanning.find
  const originalTpiPlanningDeleteMany = TpiPlanning.deleteMany
  const originalTpiPlanningCreate = TpiPlanning.create
  const originalTpiPlanningUpdateOne = TpiPlanning.updateOne
  const originalCreateTpiRoomModel = tpiRoomsModels.createTpiRoomModel
  const originalVoteDeleteMany = Vote.deleteMany
  const originalVoteInsertMany = Vote.insertMany
  const originalConsoleWarn = console.warn
  const originalTpiModelsModule = require.cache[TpiModelsYearPath]

  const people = [
    {
      _id: '507f1f77bcf86cd799439031',
      firstName: 'Alice',
      lastName: 'Example',
      roles: ['candidat'],
      candidateYears: [2026],
      isActive: true
    },
    {
      _id: '507f1f77bcf86cd799439032',
      firstName: 'Expert',
      lastName: 'One',
      roles: ['expert'],
      isActive: true
    },
    {
      _id: '507f1f77bcf86cd799439033',
      firstName: 'Expert',
      lastName: 'Two',
      roles: ['expert'],
      isActive: true
    },
    {
      _id: '507f1f77bcf86cd799439034',
      firstName: 'Chef',
      lastName: 'Projet',
      roles: ['chef_projet'],
      isActive: true
    }
  ]
  const warnings = []
  let tpiCreateCount = 0
  let slotCreateCount = 0
  let voteInsertCount = 0
  const createdSlots = []

  coordinationConfigService.getPlanningConfig = async () => ({
    siteConfigs: [
      {
        siteCode: 'VENNES',
        active: true
      }
    ],
    workflowSettings: {
      voteDeadlineDays: 7
    }
  })

  Person.find = () => ({
    select() {
      return {
        lean: async () => people
      }
    }
  })
  Person.findById = async (personId) => people.find((person) => person._id === String(personId)) || null

  TpiPlanning.find = () => ({
    distinct: async () => []
  })
  TpiPlanning.deleteMany = async () => ({ acknowledged: true })
  TpiPlanning.create = async (doc) => {
    tpiCreateCount += 1
    return {
      ...doc,
      _id: `tpi-${tpiCreateCount}`
    }
  }
  TpiPlanning.updateOne = async () => ({ acknowledged: true, matchedCount: 1, modifiedCount: 1 })

  tpiRoomsModels.createTpiRoomModel = () => ({
    deleteMany: async () => ({ acknowledged: true }),
    insertMany: async () => ({ acknowledged: true })
  })

  Slot.deleteMany = async () => ({ acknowledged: true })
  Slot.create = async (doc) => {
    slotCreateCount += 1
    createdSlots.push(doc)

    return {
      ...doc,
      _id: `slot-${slotCreateCount}`
    }
  }

  Vote.deleteMany = async () => ({ acknowledged: true })
  Vote.insertMany = async (docs) => {
    voteInsertCount += 1
    return docs
  }

  require.cache[TpiModelsYearPath].exports = () => ({
    find() {
      return {
        lean: async () => []
      }
    }
  })

  console.warn = (message) => {
    warnings.push(String(message))
  }

  clearLegacyPlanningBridgeService()
  const { rebuildWorkflowFromLegacyPlanning } = require('../services/legacyPlanningBridgeService')

  try {
    const participantIds = {
      candidatPersonId: '507f1f77bcf86cd799439031',
      expert1: { personId: '507f1f77bcf86cd799439032' },
      expert2: { personId: '507f1f77bcf86cd799439033' },
      boss: { personId: '507f1f77bcf86cd799439034' }
    }
    const summary = await rebuildWorkflowFromLegacyPlanning({
      year: 2026,
      legacyRooms: [
        {
          idRoom: 1,
          lastUpdate: Date.now(),
          site: 'VENNES',
          date: '2026-06-10',
          name: 'Vennes - A22',
          tpiDatas: [
            {
              refTpi: '3001',
              period: 7,
              ...participantIds
            },
            {
              refTpi: '3002',
              period: 7,
              ...participantIds
            }
          ]
        }
      ]
    })

    assert.equal(summary.tpiCount, 2)
    assert.equal(summary.slotCount, 2)
    assert.equal(summary.voteCount, 6)
    assert.equal(summary.skippedEntries, 0)
    assert.equal(summary.duplicateSlotEntries, 0)
    assert.deepEqual(summary.duplicateSlots, [])
    assert.equal(tpiCreateCount, 2)
    assert.equal(slotCreateCount, 2)
    assert.deepEqual(createdSlots.map((slot) => ({
      period: slot.period,
      startTime: slot.startTime,
      status: slot.status
    })), [
      { period: 1, startTime: '8:00', status: 'pending_votes' },
      { period: 2, startTime: '9:10', status: 'pending_votes' }
    ])
    assert.equal(voteInsertCount, 2)
    assert.equal(
      warnings.some((message) => message.includes('Créneau partagé détecté')),
      false
    )
  } finally {
    coordinationConfigService.getPlanningConfig = originalGetPlanningConfig
    Person.find = originalPersonFind
    Person.findById = originalPersonFindById
    Slot.deleteMany = originalSlotDeleteMany
    Slot.create = originalSlotCreate
    TpiPlanning.find = originalTpiPlanningFind
    TpiPlanning.deleteMany = originalTpiPlanningDeleteMany
    TpiPlanning.create = originalTpiPlanningCreate
    TpiPlanning.updateOne = originalTpiPlanningUpdateOne
    tpiRoomsModels.createTpiRoomModel = originalCreateTpiRoomModel
    Vote.deleteMany = originalVoteDeleteMany
    Vote.insertMany = originalVoteInsertMany
    console.warn = originalConsoleWarn

    if (originalTpiModelsModule) {
      require.cache[TpiModelsYearPath] = originalTpiModelsModule
    } else {
      delete require.cache[TpiModelsYearPath]
    }

    clearLegacyPlanningBridgeService()
  }
})

test('rebuildWorkflowFromLegacyPlanning preserves submitted votes for matching rebuilt slots', async () => {
  const originalGetPlanningConfig = coordinationConfigService.getPlanningConfig
  const originalPersonFind = Person.find
  const originalPersonFindById = Person.findById
  const originalSlotFind = Slot.find
  const originalSlotFindOne = Slot.findOne
  const originalSlotDeleteMany = Slot.deleteMany
  const originalSlotCreate = Slot.create
  const originalTpiPlanningFind = TpiPlanning.find
  const originalTpiPlanningDeleteMany = TpiPlanning.deleteMany
  const originalTpiPlanningCreate = TpiPlanning.create
  const originalTpiPlanningUpdateOne = TpiPlanning.updateOne
  const originalCreateTpiRoomModel = tpiRoomsModels.createTpiRoomModel
  const originalVoteFind = Vote.find
  const originalVoteDeleteMany = Vote.deleteMany
  const originalVoteInsertMany = Vote.insertMany
  const originalConsoleWarn = console.warn
  const originalTpiModelsModule = require.cache[TpiModelsYearPath]

  const oldTpiId = '507f1f77bcf86cd799439101'
  const oldSlotId = '507f1f77bcf86cd799439102'
  const oldVoteId = '507f1f77bcf86cd799439103'
  const oldRejectedSlotId = '507f1f77bcf86cd799439106'
  const oldRejectedVoteId = '507f1f77bcf86cd799439107'
  const newTpiId = '507f1f77bcf86cd799439104'
  const newSlotId = '507f1f77bcf86cd799439105'
  const archivedRejectedSlotId = '507f1f77bcf86cd799439108'
  const candidatId = '507f1f77bcf86cd799439111'
  const expert1Id = '507f1f77bcf86cd799439112'
  const expert2Id = '507f1f77bcf86cd799439113'
  const chefProjetId = '507f1f77bcf86cd799439114'
  const votedAt = new Date('2026-05-12T10:30:00.000Z')
  const people = [
    {
      _id: candidatId,
      firstName: 'Alice',
      lastName: 'Example',
      roles: ['candidat'],
      candidateYears: [2026],
      isActive: true
    },
    {
      _id: expert1Id,
      firstName: 'Expert',
      lastName: 'One',
      roles: ['expert'],
      isActive: true
    },
    {
      _id: expert2Id,
      firstName: 'Expert',
      lastName: 'Two',
      roles: ['expert'],
      isActive: true
    },
    {
      _id: chefProjetId,
      firstName: 'Chef',
      lastName: 'Projet',
      roles: ['chef_projet'],
      isActive: true
    }
  ]
  let deletedVoteQuery = null
  let insertedVoteDocs = []
  const createdSlotDocs = []
  const tpiUpdates = []

  coordinationConfigService.getPlanningConfig = async () => ({
    siteConfigs: [
      {
        siteCode: 'VENNES',
        active: true
      }
    ],
    workflowSettings: {
      voteDeadlineDays: 7
    }
  })

  Person.find = () => ({
    select() {
      return {
        lean: async () => people
      }
    }
  })
  Person.findById = async (personId) => people.find((person) => person._id === String(personId)) || null

  TpiPlanning.find = () => ({
    select() {
      return {
        lean: async () => ([
          {
            _id: oldTpiId,
            reference: 'TPI-2026-3001',
            proposedSlots: [
              { slot: oldRejectedSlotId }
            ]
          }
        ])
      }
    }
  })
  TpiPlanning.deleteMany = async () => ({ acknowledged: true })
  TpiPlanning.create = async (doc) => ({
    ...doc,
    _id: newTpiId
  })
  TpiPlanning.updateOne = async (filter, update) => {
    tpiUpdates.push({ filter, update })
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 }
  }

  tpiRoomsModels.createTpiRoomModel = () => ({
    deleteMany: async () => ({ acknowledged: true }),
    insertMany: async () => ({ acknowledged: true })
  })

  Slot.find = () => ({
    select() {
      return {
        lean: async () => ([
          {
            _id: oldSlotId,
            year: 2026,
            date: new Date('2026-06-10T00:00:00.000Z'),
            period: 1,
            startTime: '8:00',
            endTime: '9:00',
            room: {
              name: 'Vennes - A22',
              site: 'VENNES'
            }
          },
          {
            _id: oldRejectedSlotId,
            year: 2026,
            date: new Date('2026-06-11T00:00:00.000Z'),
            period: 2,
            startTime: '9:10',
            endTime: '10:10',
            room: {
              name: 'Vennes - A23',
              site: 'VENNES'
            }
          }
        ])
      }
    }
  })
  Slot.findOne = async () => null
  Slot.deleteMany = async () => ({ acknowledged: true })
  Slot.create = async (doc) => {
    createdSlotDocs.push(doc)
    return {
      ...doc,
      _id: doc.history?.some((entry) => entry.action === 'archived_vote_slot_after_planning_move')
        ? archivedRejectedSlotId
        : newSlotId
    }
  }

  Vote.find = () => ({
    select() {
      return {
        lean: async () => ([
          {
            _id: oldVoteId,
            tpiPlanning: oldTpiId,
            slot: oldSlotId,
            voter: expert1Id,
            voterRole: 'expert1',
            decision: 'accepted',
            comment: 'OK pour moi.',
            availabilityException: false,
            hardConstraint: false,
            specialRequestReason: '',
            specialRequestDate: null,
            priority: 1,
            votedAt,
            magicLinkUsed: 'Bearer vote-token',
            createdAt: new Date('2026-05-10T08:00:00.000Z')
          },
          {
            _id: oldRejectedVoteId,
            tpiPlanning: oldTpiId,
            slot: oldRejectedSlotId,
            voter: expert1Id,
            voterRole: 'expert1',
            decision: 'rejected',
            comment: 'Pas disponible ce jour-là.',
            availabilityException: false,
            hardConstraint: false,
            specialRequestReason: '',
            specialRequestDate: null,
            votedAt,
            magicLinkUsed: 'Bearer vote-token',
            createdAt: new Date('2026-05-10T08:00:00.000Z')
          }
        ])
      }
    }
  })
  Vote.deleteMany = async (query) => {
    deletedVoteQuery = query
    return { acknowledged: true, deletedCount: 1 }
  }
  Vote.insertMany = async (docs) => {
    insertedVoteDocs = docs
    return docs
  }

  require.cache[TpiModelsYearPath].exports = () => ({
    find() {
      return {
        lean: async () => []
      }
    }
  })

  console.warn = () => {}

  clearLegacyPlanningBridgeService()
  const { rebuildWorkflowFromLegacyPlanning } = require('../services/legacyPlanningBridgeService')

  try {
    const summary = await rebuildWorkflowFromLegacyPlanning({
      year: 2026,
      legacyRooms: [
        {
          idRoom: 1,
          lastUpdate: Date.now(),
          site: 'VENNES',
          date: '2026-06-10',
          name: 'Vennes - A22',
          tpiDatas: [
            {
              refTpi: '3001',
              candidat: 'Alice Example',
              candidatPersonId: candidatId,
              expert1: { name: 'Expert One', personId: expert1Id },
              expert2: { name: 'Expert Two', personId: expert2Id },
              boss: { name: 'Chef Projet', personId: chefProjetId }
            }
          ]
        }
      ]
    })

    assert.equal(summary.tpiCount, 1)
    assert.equal(summary.voteCount, 4)
    assert.equal(summary.preservedVoteCount, 2)
    assert.equal(summary.preservedSubmittedVoteCount, 2)
    assert.equal(summary.droppedSubmittedVoteCount, 0)
    assert.equal(summary.preservedSubmittedResponseCount, 1)
    assert.equal(summary.droppedSubmittedResponseCount, 0)
    assert.equal(summary.movedVoteTpiCount, 1)
    assert.equal(summary.movedVoteStakeholderCount, 2)
    assert.deepEqual(deletedVoteQuery, {
      tpiPlanning: { $in: [oldTpiId] }
    })

    assert.equal(insertedVoteDocs.length, 4)
    const preservedVote = insertedVoteDocs.find((vote) => vote.voterRole === 'expert1')
    assert.equal(preservedVote._id, oldVoteId)
    assert.equal(preservedVote.tpiPlanning, newTpiId)
    assert.equal(preservedVote.slot, newSlotId)
    assert.equal(preservedVote.voter, expert1Id)
    assert.equal(preservedVote.decision, 'accepted')
    assert.equal(preservedVote.comment, 'OK pour moi.')
    assert.equal(preservedVote.votedAt.toISOString(), votedAt.toISOString())
    assert.equal(preservedVote.magicLinkUsed, 'Bearer vote-token')
    const archivedRejectedVote = insertedVoteDocs.find((vote) => vote._id === oldRejectedVoteId)
    assert.equal(archivedRejectedVote.tpiPlanning, newTpiId)
    assert.equal(archivedRejectedVote.slot, archivedRejectedSlotId)
    assert.equal(archivedRejectedVote.voter, expert1Id)
    assert.equal(archivedRejectedVote.decision, 'rejected')
    assert.equal(archivedRejectedVote.comment, 'Pas disponible ce jour-là.')
    const archivedSlotDoc = createdSlotDocs.find((doc) =>
      doc.history?.some((entry) => entry.action === 'archived_vote_slot_after_planning_move')
    )
    assert.equal(archivedSlotDoc.status, 'blocked')
    assert.equal(archivedSlotDoc.assignedTpi, null)
    assert.deepEqual(
      insertedVoteDocs
        .filter((vote) => vote.decision === 'pending')
        .map((vote) => vote.decision),
      ['pending', 'pending']
    )
    assert.deepEqual(tpiUpdates[0].update.$set['votingSession.voteSummary'], {
      expert1Voted: true,
      expert2Voted: false,
      chefProjetVoted: false
    })
    assert.equal(tpiUpdates[0].update.$push.history.action, 'planning_slot_moved_after_votes')
    assert.deepEqual(tpiUpdates[0].update.$push.history.details.touchedRoles, ['expert2', 'chef_projet'])
    assert.equal(tpiUpdates[0].update.$push.history.details.previousSlot.room.name, 'Vennes - A23')
    assert.equal(tpiUpdates[0].update.$push.history.details.currentSlot.room.name, 'Vennes - A22')
  } finally {
    coordinationConfigService.getPlanningConfig = originalGetPlanningConfig
    Person.find = originalPersonFind
    Person.findById = originalPersonFindById
    Slot.find = originalSlotFind
    Slot.findOne = originalSlotFindOne
    Slot.deleteMany = originalSlotDeleteMany
    Slot.create = originalSlotCreate
    TpiPlanning.find = originalTpiPlanningFind
    TpiPlanning.deleteMany = originalTpiPlanningDeleteMany
    TpiPlanning.create = originalTpiPlanningCreate
    TpiPlanning.updateOne = originalTpiPlanningUpdateOne
    tpiRoomsModels.createTpiRoomModel = originalCreateTpiRoomModel
    Vote.find = originalVoteFind
    Vote.deleteMany = originalVoteDeleteMany
    Vote.insertMany = originalVoteInsertMany
    console.warn = originalConsoleWarn

    if (originalTpiModelsModule) {
      require.cache[TpiModelsYearPath] = originalTpiModelsModule
    } else {
      delete require.cache[TpiModelsYearPath]
    }

    clearLegacyPlanningBridgeService()
  }
})

test('syncLegacyCatalogToPlanning creates missing coordination drafts from planifiable legacy TPI', async () => {
  const originalGetPlanningConfig = coordinationConfigService.getPlanningConfig
  const originalPersonFind = Person.find
  const originalTpiPlanningFind = TpiPlanning.find
  const originalTpiPlanningInsertMany = TpiPlanning.insertMany
  const originalTpiModelsModule = require.cache[TpiModelsYearPath]

  let insertedCoordinationDocs = []
  let legacyBulkOperations = []

  coordinationConfigService.getPlanningConfig = async () => ({
    siteConfigs: [
      {
        siteCode: 'ETML',
        active: true
      }
    ]
  })

  Person.find = () => ({
    select() {
      return {
        lean: async () => ([
          {
            _id: '507f1f77bcf86cd799439011',
            firstName: 'Alice',
            lastName: 'Example',
            roles: ['candidat'],
            candidateYears: [2026],
            isActive: true
          },
          {
            _id: '507f1f77bcf86cd799439012',
            firstName: 'Expert',
            lastName: 'One',
            roles: ['expert'],
            isActive: true
          },
          {
            _id: '507f1f77bcf86cd799439013',
            firstName: 'Expert',
            lastName: 'Two',
            roles: ['expert'],
            isActive: true
          },
          {
            _id: '507f1f77bcf86cd799439014',
            firstName: 'Chef',
            lastName: 'Projet',
            roles: ['chef_projet'],
            isActive: true
          }
        ])
      }
    }
  })

  TpiPlanning.find = () => ({
    select() {
      return {
        lean: async () => ([])
      }
    }
  })

  TpiPlanning.insertMany = async (docs) => {
    insertedCoordinationDocs = docs
    return docs
  }

  require.cache[TpiModelsYearPath].exports = () => ({
    find() {
      return {
        lean: async () => ([
          {
            _id: '507f1f77bcf86cd799439021',
            refTpi: '2247',
            candidat: 'Alice Example',
            experts: {
              1: 'Expert One',
              2: 'Expert Two'
            },
            boss: 'Chef Projet',
            classe: 'INF1',
            sujet: 'Sujet de test',
            lieu: {
              site: 'ETML',
              entreprise: 'Entreprise Test'
            }
          }
        ])
      }
    },
    bulkWrite(operations) {
      legacyBulkOperations = operations
      return Promise.resolve({ acknowledged: true })
    }
  })

  clearLegacyPlanningBridgeService()
  const { syncLegacyCatalogToPlanning } = require('../services/legacyPlanningBridgeService')

  try {
    const summary = await syncLegacyCatalogToPlanning({
      year: 2026,
      createdBy: { id: '507f1f77bcf86cd799439099' }
    })

    assert.equal(summary.createdCount, 1)
    assert.equal(summary.skippedExistingCount, 0)
    assert.equal(summary.skippedInvalidStakeholdersCount, 0)
    assert.equal(summary.outOfScopeCount, 0)
    assert.equal(insertedCoordinationDocs.length, 1)
    assert.equal(insertedCoordinationDocs[0].reference, 'TPI-2026-2247')
    assert.equal(String(insertedCoordinationDocs[0].candidat), '507f1f77bcf86cd799439011')
    assert.equal(String(insertedCoordinationDocs[0].expert1), '507f1f77bcf86cd799439012')
    assert.equal(String(insertedCoordinationDocs[0].expert2), '507f1f77bcf86cd799439013')
    assert.equal(String(insertedCoordinationDocs[0].chefProjet), '507f1f77bcf86cd799439014')
    assert.equal(insertedCoordinationDocs[0].status, 'draft')
    assert.equal(insertedCoordinationDocs[0].site, 'ETML')
    assert.equal(insertedCoordinationDocs[0].classe, 'INF1')
    assert.equal(legacyBulkOperations.length, 1)
    assert.deepEqual(legacyBulkOperations[0].updateOne.update.$set, {
      candidatPersonId: '507f1f77bcf86cd799439011',
      expert1PersonId: '507f1f77bcf86cd799439012',
      expert2PersonId: '507f1f77bcf86cd799439013',
      bossPersonId: '507f1f77bcf86cd799439014'
    })
  } finally {
    coordinationConfigService.getPlanningConfig = originalGetPlanningConfig
    Person.find = originalPersonFind
    TpiPlanning.find = originalTpiPlanningFind
    TpiPlanning.insertMany = originalTpiPlanningInsertMany

    if (originalTpiModelsModule) {
      require.cache[TpiModelsYearPath] = originalTpiModelsModule
    } else {
      delete require.cache[TpiModelsYearPath]
    }

    clearLegacyPlanningBridgeService()
  }
})
