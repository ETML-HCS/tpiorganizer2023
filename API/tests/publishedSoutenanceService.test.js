const test = require('node:test')
const assert = require('node:assert/strict')

const {
  filterPublishedRooms,
  inferPublishedRoomClassModeFromEntries,
  syncPublishedSoutenancesToTpiCatalog
} = require('../services/publishedSoutenanceService')

test('filterPublishedRooms filters published rooms by participant personId', () => {
  const rooms = [
    {
      idRoom: 1,
      name: 'A101',
      tpiDatas: [
        {
          id: 'room-a_0',
          candidat: 'Alice Candidate',
          candidatPersonId: 'candidate-1',
          expert1: { name: 'Expert One', personId: 'expert-1' },
          expert2: { name: 'Expert Two', personId: 'expert-2' },
          boss: { name: 'Boss One', personId: 'boss-1' }
        },
        {
          id: 'room-a_1',
          candidat: 'Bob Candidate',
          candidatPersonId: 'candidate-2',
          expert1: { name: 'Expert Three', personId: 'expert-3' },
          expert2: { name: 'Expert Four', personId: 'expert-4' },
          boss: { name: 'Boss Two', personId: 'boss-2' }
        }
      ]
    }
  ]

  const filtered = filterPublishedRooms(rooms, {
    personId: 'expert-1'
  })

  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].tpiDatas.length, 1)
  assert.equal(filtered[0].tpiDatas[0].id, 'room-a_0')
})

test('filterPublishedRooms falls back to participant name for legacy rooms', () => {
  const rooms = [
    {
      idRoom: 2,
      name: 'B201',
      tpiDatas: [
        {
          id: 'room-b_0',
          candidat: 'Claire Candidate',
          expert1: { name: 'Nina Expert' },
          expert2: { name: 'Marc Expert' },
          boss: { name: 'Paul Boss' }
        },
        {
          id: 'room-b_1',
          candidat: 'David Candidate',
          expert1: { name: 'Sonia Expert' },
          expert2: { name: 'Leo Expert' },
          boss: { name: 'Eva Boss' }
        }
      ]
    }
  ]

  const filtered = filterPublishedRooms(rooms, {
    name: 'Paul Boss'
  })

  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].tpiDatas.length, 1)
  assert.equal(filtered[0].tpiDatas[0].id, 'room-b_0')
})

test('inferPublishedRoomClassModeFromEntries returns matu only for homogeneous MATU rooms', () => {
  assert.equal(
    inferPublishedRoomClassModeFromEntries([
      { tpi: { classe: 'MATU1' } },
      { tpi: { classe: 'M2' } }
    ]),
    'matu'
  )

  assert.equal(
    inferPublishedRoomClassModeFromEntries([
      { tpi: { classe: 'MATU1' } },
      { tpi: { classe: 'CFC3' } }
    ]),
    null
  )
})

test('syncPublishedSoutenancesToTpiCatalog updates soutenance dates in the TPI catalog', async () => {
  const bulkWrites = []
  const modelFactory = () => ({
    bulkWrite: async (operations) => {
      bulkWrites.push(...operations)
      return { matchedCount: operations.length, modifiedCount: operations.length }
    }
  })

  const result = await syncPublishedSoutenancesToTpiCatalog(
    2026,
    [
      {
        name: 'A101',
        site: 'ETML',
        date: '2026-06-03',
        tpiDatas: [
          { refTpi: 'TPI-1' },
          { refTpi: 'TPI-2' },
          { refTpi: '' }
        ]
      }
    ],
    modelFactory
  )

  assert.equal(bulkWrites.length, 2)
  assert.deepEqual(bulkWrites[0].updateOne.filter, {
    refTpi: 'TPI-1'
  })
  assert.equal(bulkWrites[0].updateOne.update.$set.salle, 'A101')
  assert.equal(bulkWrites[0].updateOne.update.$set['lieu.site'], 'ETML')
  assert.equal(bulkWrites[0].updateOne.update.$set['dates.soutenance'] instanceof Date, true)
  assert.equal(result.matchedCount, 2)
})

test('syncPublishedSoutenancesToTpiCatalog matches legacy references from workflow references', async () => {
  const bulkWrites = []
  const modelFactory = () => ({
    bulkWrite: async (operations) => {
      bulkWrites.push(...operations)
      return { matchedCount: operations.length, modifiedCount: operations.length }
    }
  })

  await syncPublishedSoutenancesToTpiCatalog(
    2026,
    [
      {
        name: 'B204',
        site: 'CFPV',
        date: '2026-06-11',
        tpiDatas: [
          { refTpi: 'TPI-2026-042' }
        ]
      }
    ],
    modelFactory
  )

  assert.equal(bulkWrites.length, 1)
  assert.deepEqual(bulkWrites[0].updateOne.filter, {
    refTpi: {
      $in: ['TPI-2026-042', '042']
    }
  })
  assert.equal(bulkWrites[0].updateOne.update.$set.salle, 'B204')
  assert.equal(bulkWrites[0].updateOne.update.$set['lieu.site'], 'CFPV')
})
