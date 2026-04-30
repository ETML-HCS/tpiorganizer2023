const test = require('node:test')
const assert = require('node:assert/strict')

const {
  enrichPublishedRoomsAppearance,
  enrichPublishedRoomsScheduleConfig,
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

test('enrichPublishedRoomsAppearance applique la couleur et les SVG configurés', () => {
  const enriched = enrichPublishedRoomsAppearance(
    [
      {
        idRoom: 3,
        site: 'ETML',
        name: 'A101',
        configSite: {
          numSlots: 8,
          soutenanceColor: '#123456'
        },
        tpiDatas: []
      },
      {
        idRoom: 4,
        site: 'ETML',
        name: 'A102',
        configSite: {
          numSlots: 8
        },
        tpiDatas: []
      }
    ],
    {
      stakeholderIcons: {
        candidate: 'candidate-rose',
        expert1: 'helmet-orange',
        expert2: 'helmet-blue',
        projectManager: 'helmet-gray'
      },
      siteAppearanceByCode: new Map([
        ['ETML', { soutenanceColor: '#0f766e' }]
      ]),
      roomAppearanceByKey: new Map([
        ['ETML|A101', { soutenanceColor: '#be185d' }]
      ])
    }
  )

  assert.equal(enriched[0].configSite.numSlots, 8)
  assert.equal(enriched[0].configSite.soutenanceColor, '#BE185D')
  assert.equal(enriched[1].configSite.soutenanceColor, '#0F766E')
  assert.deepEqual(enriched[0].configSite.stakeholderIcons, {
    candidate: 'candidate-rose',
    expert1: 'helmet-orange',
    expert2: 'helmet-blue',
    projectManager: 'helmet-gray'
  })
})

test('enrichPublishedRoomsScheduleConfig garde le nombre total de créneaux configurés', () => {
  const rooms = enrichPublishedRoomsScheduleConfig(
    [
      {
        idRoom: 4,
        site: 'ETML',
        name: 'A101',
        date: '2026-06-10',
        configSite: {
          numSlots: 2
        },
        tpiDatas: [
          {
            id: 'room-a_1',
            period: 2,
            refTpi: '2163',
            candidat: 'Alice Candidate'
          }
        ]
      }
    ],
    {
      siteConfigs: [
        {
          siteCode: 'ETML',
          breaklineMinutes: 10,
          tpiTimeMinutes: 60,
          firstTpiStartTime: '08:00',
          numSlots: 4,
          minTpiPerRoom: 2,
          active: true
        }
      ]
    }
  )

  assert.equal(rooms[0].configSite.numSlots, 4)
  assert.equal(rooms[0].configSite.firstTpiStart, 8)
  assert.equal(rooms[0].configSite.minTpiPerRoom, 2)
  assert.equal(rooms[0].tpiDatas.length, 4)
  assert.equal(rooms[0].tpiDatas[1].refTpi, '2163')
  assert.equal(rooms[0].tpiDatas[0].refTpi, null)
  assert.equal(rooms[0].tpiDatas[3].refTpi, null)
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

test('syncPublishedSoutenancesToTpiCatalog updates défense dates in the TPI catalog', async () => {
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
