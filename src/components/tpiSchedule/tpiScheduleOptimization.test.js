import {
  analyzePlanningRooms,
  optimizePlanningRooms,
  summarizeLocalPersonConflicts
} from './tpiScheduleOptimization'
import { buildLocalValidationIssues } from './tpiScheduleValidationUtils'

const makeCard = (refTpi, candidat, expert1, expert2, boss, classe = 'DEV4') => ({
  refTpi,
  candidat,
  expert1: { name: expert1 },
  expert2: { name: expert2 },
  boss: { name: boss },
  classe
})

const emptyCard = () => ({
  refTpi: '',
  candidat: '',
  expert1: { name: '' },
  expert2: { name: '' },
  boss: { name: '' }
})

const makeRoom = ({ date, name, site = 'ETML', cards, configSite }) => ({
  date,
  name,
  site,
  configSite,
  tpiDatas: cards
})

describe('tpiScheduleOptimization', () => {
  it('detecte les doubles presences locales', () => {
    const rooms = [
      makeRoom({
        date: '2026-06-10',
        name: 'A101',
        cards: [
          makeCard('T1', 'Alice', 'Bob', 'Cara', 'Dan'),
          makeCard('T2', 'Eve', 'Fran', 'Gina', 'Hugo')
        ]
      }),
      makeRoom({
        date: '2026-06-10',
        name: 'A102',
        cards: [
          makeCard('T3', 'Alice', 'Ivy', 'Jake', 'Lia'),
          emptyCard()
        ]
      })
    ]

    const summary = summarizeLocalPersonConflicts(rooms)

    expect(summary.conflictCount).toBe(1)
    expect(summary.conflicts[0].personName).toBe('Alice')
    expect(summary.conflicts[0].references).toEqual(['T1', 'T3'])
  })

  it('optimise un overlap en best effort', () => {
    const soutenanceDates = [{ date: '2026-06-10', min: true }]
    const rooms = [
      makeRoom({
        date: '2026-06-10',
        name: 'A101',
        cards: [
          makeCard('T1', 'Alice', 'Bob', 'Cara', 'Dan', 'MIN4'),
          makeCard('T2', 'Eve', 'Fran', 'Gina', 'Hugo', 'MIN4')
        ]
      }),
      makeRoom({
        date: '2026-06-10',
        name: 'A102',
        cards: [
          makeCard('T3', 'Alice', 'Ivy', 'Jake', 'Lia', 'MIN4'),
          emptyCard()
        ]
      })
    ]

    const before = analyzePlanningRooms(rooms, { soutenanceDates })
    const result = optimizePlanningRooms(rooms, { soutenanceDates })

    expect(before.summary.personOverlapCount).toBe(1)
    expect(result.changed).toBe(true)
    expect(result.swapCount).toBeGreaterThan(0)
    expect(result.after.personOverlapCount).toBe(0)
    expect(result.after.score).toBeLessThan(before.summary.score)
  })

  it('reduces a sequence trop longue when a safe swap exists', () => {
    const soutenanceDates = [{ date: '2026-06-11', min: true }]
    const rooms = [
      makeRoom({
        date: '2026-06-11',
        name: 'A201',
        cards: [
          makeCard('T10', 'Max', 'B1', 'B2', 'B3', 'MIN4'),
          makeCard('T11', 'Max', 'C1', 'C2', 'C3', 'MIN4'),
          makeCard('T12', 'Max', 'D1', 'D2', 'D3', 'MIN4'),
          makeCard('T13', 'Max', 'E1', 'E2', 'E3', 'MIN4'),
          emptyCard()
        ]
      }),
      makeRoom({
        date: '2026-06-11',
        name: 'A202',
        cards: [
          makeCard('T20', 'Zoe', 'Z1', 'Z2', 'Z3', 'MIN4'),
          emptyCard(),
          emptyCard(),
          emptyCard(),
          emptyCard()
        ]
      })
    ]

    const before = analyzePlanningRooms(rooms, { soutenanceDates })
    const result = optimizePlanningRooms(rooms, { soutenanceDates })

    expect(before.summary.sequenceExcessCount).toBe(1)
    expect(result.changed).toBe(true)
    expect(result.after.sequenceExcessCount).toBe(0)
    expect(result.after.score).toBeLessThan(before.summary.score)
  })

  it('respecte la limite configurable de TPI consecutifs dans l optimisation locale', () => {
    const soutenanceDates = [{ date: '2026-06-12', min: true }]
    const limitedRoomConfig = { maxConsecutiveTpi: 2 }
    const rooms = [
      makeRoom({
        date: '2026-06-12',
        name: 'A301',
        configSite: limitedRoomConfig,
        cards: [
          makeCard('T40', 'Max', 'B1', 'B2', 'B3', 'MIN4'),
          makeCard('T41', 'Max', 'C1', 'C2', 'C3', 'MIN4'),
          makeCard('T42', 'Max', 'D1', 'D2', 'D3', 'MIN4'),
          emptyCard()
        ]
      }),
      makeRoom({
        date: '2026-06-12',
        name: 'A302',
        configSite: limitedRoomConfig,
        cards: [
          makeCard('T50', 'Zoe', 'Z1', 'Z2', 'Z3', 'MIN4'),
          emptyCard(),
          emptyCard(),
          emptyCard()
        ]
      })
    ]

    const before = analyzePlanningRooms(rooms, { soutenanceDates })
    const result = optimizePlanningRooms(rooms, { soutenanceDates })
    const localValidation = buildLocalValidationIssues(before)

    expect(before.summary.sequenceViolationCount).toBe(1)
    expect(before.sequenceViolations[0].maxConsecutiveTpi).toBe(2)
    expect(localValidation.summary.sequenceViolationCount).toBe(1)
    expect(result.changed).toBe(true)
    expect(result.after.sequenceViolationCount).toBe(0)
    expect(result.after.score).toBeLessThan(before.summary.score)
  })

  it('compte les incompatibilites MATU/AUTRE dans le score local', () => {
    const rooms = [
      makeRoom({
        date: '2026-06-10',
        name: 'MATU-1',
        cards: [
          makeCard('T30', 'Alice', 'B1', 'B2', 'B3', 'DEV4'),
          emptyCard()
        ]
      }),
      makeRoom({
        date: '2026-06-11',
        name: 'AUTRE-1',
        cards: [
          makeCard('T31', 'Bob', 'C1', 'C2', 'C3', 'MATU1'),
          emptyCard()
        ]
      })
    ]

    const result = analyzePlanningRooms(rooms, {
      soutenanceDates: [
        { date: '2026-06-10', min: true },
        { date: '2026-06-11', special: true }
      ]
    })

    expect(result.summary.classMismatchCount).toBe(2)
    expect(result.summary.classMismatchPenalty).toBe(100000)
    expect(result.classMismatches).toHaveLength(2)
    expect(result.classMismatches.map((issue) => issue.tpiClassMode)).toEqual(['nonM', 'matu'])
    expect(result.summary.score).toBe(result.summary.classMismatchPenalty)
  })
})
