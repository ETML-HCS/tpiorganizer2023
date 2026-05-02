const test = require('node:test')
const assert = require('node:assert/strict')

const servicePath = require.resolve('../services/legacyPlanningBridgeService')
const planningConfigService = require('../services/planningConfigService')
const Person = require('../models/personModel')
const Slot = require('../models/slotModel')
const TpiPlanning = require('../models/tpiPlanningModel')
require('../models/tpiModels')
const TpiModelsYearPath = require.resolve('../models/tpiModels')
const tpiRoomsModels = require('../models/tpiRoomsModels')
const Vote = require('../models/voteModel')

function clearLegacyPlanningBridgeService() {
  delete require.cache[servicePath]
}

test('rebuildWorkflowFromLegacyPlanning ignores legacy entries outside configured planning sites', async () => {
  const originalGetPlanningConfig = planningConfigService.getPlanningConfig
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

  planningConfigService.getPlanningConfig = async () => ({
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
    throw new Error('TpiPlanning.create should not be called for out-of-scope legacy entries.')
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
    planningConfigService.getPlanningConfig = originalGetPlanningConfig
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

test('syncLegacyCatalogToPlanning creates missing planning drafts from planifiable legacy TPI', async () => {
  const originalGetPlanningConfig = planningConfigService.getPlanningConfig
  const originalPersonFind = Person.find
  const originalTpiPlanningFind = TpiPlanning.find
  const originalTpiPlanningInsertMany = TpiPlanning.insertMany
  const originalTpiModelsModule = require.cache[TpiModelsYearPath]

  let insertedPlanningDocs = []
  let legacyBulkOperations = []

  planningConfigService.getPlanningConfig = async () => ({
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
    insertedPlanningDocs = docs
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
    assert.equal(insertedPlanningDocs.length, 1)
    assert.equal(insertedPlanningDocs[0].reference, 'TPI-2026-2247')
    assert.equal(String(insertedPlanningDocs[0].candidat), '507f1f77bcf86cd799439011')
    assert.equal(String(insertedPlanningDocs[0].expert1), '507f1f77bcf86cd799439012')
    assert.equal(String(insertedPlanningDocs[0].expert2), '507f1f77bcf86cd799439013')
    assert.equal(String(insertedPlanningDocs[0].chefProjet), '507f1f77bcf86cd799439014')
    assert.equal(insertedPlanningDocs[0].status, 'draft')
    assert.equal(insertedPlanningDocs[0].site, 'ETML')
    assert.equal(insertedPlanningDocs[0].classe, 'INF1')
    assert.equal(legacyBulkOperations.length, 1)
    assert.deepEqual(legacyBulkOperations[0].updateOne.update.$set, {
      candidatPersonId: '507f1f77bcf86cd799439011',
      expert1PersonId: '507f1f77bcf86cd799439012',
      expert2PersonId: '507f1f77bcf86cd799439013',
      bossPersonId: '507f1f77bcf86cd799439014'
    })
  } finally {
    planningConfigService.getPlanningConfig = originalGetPlanningConfig
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
