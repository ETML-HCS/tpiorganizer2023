const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildBackupVerification,
  replacePlanningRoomsForYear
} = require('../services/legacyPlanningBackupService')

function createFakeRoomModel(initialRooms = []) {
  let storedRooms = [...initialRooms]
  const calls = {
    deleteMany: 0,
    insertMany: []
  }

  return {
    calls,
    getStoredRooms: () => storedRooms,
    model: {
      async deleteMany() {
        calls.deleteMany += 1
        storedRooms = []
      },
      async insertMany(rooms) {
        calls.insertMany.push(rooms)
        storedRooms = rooms.map((room) => ({
          ...room,
          _id: `mongo-${room.idRoom}`,
          __v: 0,
          date: new Date(`${String(room.date).slice(0, 10)}T00:00:00.000Z`),
          tpiDatas: (Array.isArray(room.tpiDatas) ? room.tpiDatas : []).map((tpiData, index) => ({
            ...tpiData,
            _id: `tpi-${room.idRoom}-${index}`,
            refTpi: String(tpiData.refTpi || '')
          }))
        }))
      },
      find() {
        return {
          lean: async () => storedRooms
        }
      }
    }
  }
}

test('replacePlanningRoomsForYear remplace les anciennes salles et vérifie la copie relue', async () => {
  const fake = createFakeRoomModel([
    {
      idRoom: 99,
      date: '2026-06-09',
      name: 'Ancienne salle',
      tpiDatas: [{ refTpi: 'OLD', candidat: 'Ancien TPI' }]
    }
  ])
  const rooms = [
    {
      idRoom: 1,
      lastUpdate: 1234,
      site: 'ETML',
      date: '2026-06-10',
      name: 'A101',
      roomClassMode: 'matu',
      configSite: {
        siteCode: 'ETML',
        label: 'ETML',
        active: true,
        numSlots: 1,
        tpiTime: 1,
        breakline: 0.1667,
        firstTpiStart: 8,
        minTpiPerRoom: 1
      },
      tpiDatas: [
        {
          refTpi: 'TPI-2026-001',
          id: 'slot-1',
          period: 1,
          candidat: 'Alice Example',
          expert1: { name: 'Expert One', offres: { isValidated: false, submit: [] } },
          expert2: { name: 'Expert Two', offres: { isValidated: false, submit: [] } },
          boss: { name: 'Chef Projet', offres: { isValidated: false, submit: [] } }
        }
      ]
    }
  ]

  const result = await replacePlanningRoomsForYear(2026, rooms, {
    modelFactory: () => fake.model
  })

  assert.equal(fake.calls.deleteMany, 1)
  assert.equal(fake.calls.insertMany.length, 1)
  assert.equal(fake.getStoredRooms().length, 1)
  assert.equal(fake.getStoredRooms()[0].idRoom, 1)
  assert.equal(result.exactMatch, true)
  assert.equal(result.roomCount, 1)
  assert.equal(result.tpiCount, 1)
})

test('buildBackupVerification détecte une salle distante en trop', () => {
  const verification = buildBackupVerification(
    [
      {
        idRoom: 1,
        date: '2026-06-10',
        name: 'A101',
        tpiDatas: [{ refTpi: 'TPI-1', candidat: 'Alice' }]
      }
    ],
    [
      {
        idRoom: 1,
        date: '2026-06-10T00:00:00.000Z',
        name: 'A101',
        tpiDatas: [{ refTpi: 'TPI-1', candidat: 'Alice' }]
      },
      {
        idRoom: 2,
        date: '2026-06-10',
        name: 'A102',
        tpiDatas: [{ refTpi: 'TPI-2', candidat: 'Bob' }]
      }
    ]
  )

  assert.equal(verification.exactMatch, false)
  assert.equal(verification.expectedRoomCount, 1)
  assert.equal(verification.storedRoomCount, 2)
  assert.equal(verification.expectedTpiCount, 1)
  assert.equal(verification.storedTpiCount, 2)
})
