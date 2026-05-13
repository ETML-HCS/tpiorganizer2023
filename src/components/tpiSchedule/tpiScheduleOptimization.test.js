import {
  analyzePlanningRooms,
  buildTargetedPlanningOptimizationProposal,
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

const makeCardWithStakeholders = (refTpi, overrides = {}) => ({
  refTpi,
  candidat: `Candidat ${refTpi}`,
  candidatPersonId: '',
  expert1: { name: `Expert 1 ${refTpi}`, personId: '' },
  expert2: { name: `Expert 2 ${refTpi}`, personId: '' },
  boss: { name: `Chef ${refTpi}`, personId: '' },
  classe: 'DEV4',
  ...overrides
})

const emptyCard = () => ({
  refTpi: '',
  candidat: '',
  expert1: { name: '' },
  expert2: { name: '' },
  boss: { name: '' }
})

const makeRoom = ({ date, name, site = 'ETML', cards, configSite, roomClassMode, classMode }) => ({
  date,
  name,
  site,
  roomClassMode,
  classMode,
  configSite,
  tpiDatas: cards
})

const getTpiPositionsByReference = (rooms, references) => {
  const referenceSet = new Set(references)
  const positions = {}

  rooms.forEach((room, roomIndex) => {
    ;(Array.isArray(room?.tpiDatas) ? room.tpiDatas : []).forEach((tpi, slotIndex) => {
      if (!referenceSet.has(tpi?.refTpi)) {
        return
      }

      positions[tpi.refTpi] = {
        date: room.date,
        roomIndex,
        roomName: room.name,
        slotIndex,
        period: slotIndex + 1,
        isPlanningSealed: tpi.isPlanningSealed === true
      }
    })
  })

  return positions
}

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

  it('detecte Patrick Chenaux dans A23 et B22 le meme creneau via son personId', () => {
    const rooms = [
      makeRoom({
        date: '2026-06-10',
        name: 'A23',
        cards: [
          makeCardWithStakeholders('TPI-A23', {
            expert1: { name: 'Patrick Chenaux', personId: 'person-patrick-chenaux' }
          })
        ]
      }),
      makeRoom({
        date: '2026-06-10',
        name: 'B22',
        cards: [
          makeCardWithStakeholders('TPI-B22', {
            expert2: { name: 'P. Chenaux', personId: 'person-patrick-chenaux' }
          })
        ]
      })
    ]

    const summary = summarizeLocalPersonConflicts(rooms)
    const validation = buildLocalValidationIssues(summary)

    expect(summary.conflictCount).toBe(1)
    expect(summary.conflicts[0]).toMatchObject({
      personId: 'person-patrick-chenaux',
      personName: 'Patrick Chenaux',
      slotKey: '2026-06-10|1',
      roomNames: ['A23', 'B22'],
      references: ['TPI-A23', 'TPI-B22']
    })
    expect(validation.summary.personOverlapCount).toBe(1)
    expect(validation.issues[0]).toMatchObject({
      type: 'person_overlap',
      personId: 'person-patrick-chenaux',
      dateKey: '2026-06-10',
      period: 1
    })
  })

  it('conserve la detection par nom quand une seule carte a un personId', () => {
    const rooms = [
      makeRoom({
        date: '2026-06-10',
        name: 'A23',
        cards: [
          makeCardWithStakeholders('TPI-A23', {
            expert1: { name: 'Patrick Chenaux', personId: 'person-patrick-chenaux' }
          })
        ]
      }),
      makeRoom({
        date: '2026-06-10',
        name: 'B22',
        cards: [
          makeCardWithStakeholders('TPI-B22', {
            expert1: { name: 'Patrick Chenaux', personId: '' }
          })
        ]
      })
    ]

    const summary = summarizeLocalPersonConflicts(rooms)

    expect(summary.conflictCount).toBe(1)
    expect(summary.conflicts[0].references).toEqual(['TPI-A23', 'TPI-B22'])
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

  it('ne deplace pas un TPI scelle pendant l optimisation', () => {
    const soutenanceDates = [{ date: '2026-06-10', min: true }]
    const rooms = [
      makeRoom({
        date: '2026-06-10',
        name: 'A101',
        cards: [
          { ...makeCard('T1', 'Alice', 'Bob', 'Cara', 'Dan', 'MIN4'), isPlanningSealed: true },
          emptyCard()
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

    const result = optimizePlanningRooms(rooms, { soutenanceDates })

    expect(result.changed).toBe(true)
    expect(result.after.personOverlapCount).toBe(0)
    expect(result.rooms[0].tpiDatas[0]).toMatchObject({
      refTpi: 'T1',
      isPlanningSealed: true
    })
  })

  it('conserve la position exacte de tous les TPI verrouilles pendant l optimisation', () => {
    const soutenanceDates = [{ date: '2026-06-10' }]
    const lockedReferences = ['TM-LOCK', 'TC-LOCK']
    const rooms = [
      makeRoom({
        date: '2026-06-10',
        name: 'M101',
        roomClassMode: 'matu',
        cards: [
          { ...makeCard('TM-LOCK', 'Mona', 'L1', 'L2', 'L3', 'MATU1'), isPlanningSealed: true },
          emptyCard()
        ]
      }),
      makeRoom({
        date: '2026-06-10',
        name: 'A101',
        roomClassMode: 'nonM',
        cards: [
          { ...makeCard('TC-LOCK', 'Nora', 'P1', 'P2', 'P3', 'DEV4'), isPlanningSealed: true },
          emptyCard()
        ]
      }),
      makeRoom({
        date: '2026-06-10',
        name: 'A102',
        roomClassMode: 'nonM',
        cards: [
          makeCard('T-A', 'Alice', 'B1', 'B2', 'B3', 'DEV4'),
          emptyCard()
        ]
      }),
      makeRoom({
        date: '2026-06-10',
        name: 'A103',
        roomClassMode: 'nonM',
        cards: [
          makeCard('T-B', 'Alice', 'C1', 'C2', 'C3', 'DEV4'),
          emptyCard()
        ]
      })
    ]

    const lockedBefore = getTpiPositionsByReference(rooms, lockedReferences)
    const result = optimizePlanningRooms(rooms, { soutenanceDates })

    expect(result.changed).toBe(true)
    expect(result.after.personOverlapCount).toBe(0)
    expect(getTpiPositionsByReference(result.rooms, lockedReferences)).toEqual(lockedBefore)
  })

  it('renonce a optimiser quand la seule correction deplacerait un TPI scelle', () => {
    const soutenanceDates = [{ date: '2026-06-10', min: true }]
    const rooms = [
      makeRoom({
        date: '2026-06-10',
        name: 'A101',
        cards: [
          { ...makeCard('T1', 'Alice', 'Bob', 'Cara', 'Dan', 'MIN4'), isPlanningSealed: true }
        ]
      }),
      makeRoom({
        date: '2026-06-10',
        name: 'A102',
        cards: [
          { ...makeCard('T3', 'Alice', 'Ivy', 'Jake', 'Lia', 'MIN4'), isPlanningSealed: true }
        ]
      })
    ]

    const result = optimizePlanningRooms(rooms, { soutenanceDates })

    expect(result.changed).toBe(false)
    expect(result.after.personOverlapCount).toBe(1)
    expect(result.rooms[0].tpiDatas[0]).toMatchObject({
      refTpi: 'T1',
      isPlanningSealed: true
    })
    expect(result.rooms[1].tpiDatas[0]).toMatchObject({
      refTpi: 'T3',
      isPlanningSealed: true
    })
  })

  it('propose les optimisations strictes uniquement sur les TPI touches ou les slots vides', () => {
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
          makeCard('T4', 'Zoe', 'Kim', 'Luz', 'Mia', 'MIN4')
        ]
      })
    ]
    const validationResult = {
      summary: { issueCount: 1 },
      issues: [
        {
          type: 'person_overlap',
          references: ['T1', 'T3']
        }
      ]
    }

    const strictProposal = buildTargetedPlanningOptimizationProposal(rooms, {
      soutenanceDates: [{ date: '2026-06-10', min: true }],
      validationResult,
      settings: {
        mode: 'strict',
        maxSwaps: 3,
        sameSiteOnly: true,
        preserveValidated: false,
        issueTypes: ['person_overlap']
      }
    })
    const expandedProposal = buildTargetedPlanningOptimizationProposal(rooms, {
      soutenanceDates: [{ date: '2026-06-10', min: true }],
      validationResult,
      settings: {
        mode: 'expanded',
        maxSwaps: 3,
        sameSiteOnly: true,
        preserveValidated: false,
        issueTypes: ['person_overlap']
      }
    })

    expect(strictProposal.changed).toBe(false)
    expect(expandedProposal.changed).toBe(true)
    expect(expandedProposal.targetReferences).toEqual(['T1', 'T3'])
    expect(expandedProposal.after.personOverlapCount).toBe(0)
    const swapRefs = [
      expandedProposal.swaps[0].left.reference,
      expandedProposal.swaps[0].right.reference
    ]
    expect(swapRefs.some((reference) => ['T1', 'T3'].includes(reference))).toBe(true)
    expect(swapRefs.some((reference) => ['T2', 'T4'].includes(reference))).toBe(true)
  })

  it('reduit les attentes sans depasser la limite consecutive et privilegie la pause repas', () => {
    const soutenanceDates = [{ date: '2026-06-10', min: true }]
    const rooms = [
      makeRoom({
        date: '2026-06-10',
        name: 'A101',
        configSite: { maxConsecutiveTpi: 3 },
        cards: [
          makeCard('T1', 'Alice', 'Bob', 'Cara', 'Dan', 'MIN4'),
          makeCard('T2', 'Alice', 'Eve', 'Fran', 'Gina', 'MIN4'),
          makeCard('T3', 'Alice', 'Hugo', 'Ivy', 'Jake', 'MIN4'),
          emptyCard(),
          emptyCard(),
          emptyCard(),
          makeCard('T4', 'Alice', 'Lia', 'Mia', 'Nia', 'MIN4')
        ]
      })
    ]

    const before = analyzePlanningRooms(rooms, { soutenanceDates })
    const result = optimizePlanningRooms(rooms, {
      soutenanceDates,
      maxPasses: 1,
      preventNewIssues: true,
      reduceWaitingTime: true
    })

    expect(before.summary.waitingGapCount).toBe(3)
    expect(before.summary.sequenceViolationCount).toBe(0)
    expect(result.changed).toBe(true)
    expect(result.rooms[0].tpiDatas[4].refTpi).toBe('T4')
    expect(result.after.waitingGapCount).toBe(1)
    expect(result.after.offMealBreakCount).toBe(0)
    expect(result.after.sequenceViolationCount).toBe(0)
  })

  it('reduit l attente sans degrader le score individuel d une autre personne', () => {
    const soutenanceDates = [{ date: '2026-06-10', min: true }]
    const rooms = [
      makeRoom({
        date: '2026-06-10',
        name: 'A101',
        configSite: { maxConsecutiveTpi: 4 },
        cards: [
          makeCard('T1', 'Alice', 'Bob', 'Cara', 'Dan', 'MIN4'),
          makeCard('T2', 'Zoé', 'Marc', 'Nina', 'Omar', 'MIN4'),
          makeCard('T3', 'Zoé', 'Paul', 'Quin', 'Rita', 'MIN4'),
          emptyCard(),
          makeCard('T4', 'Alice', 'Sam', 'Tia', 'Uma', 'MIN4')
        ]
      })
    ]

    const before = analyzePlanningRooms(rooms, { soutenanceDates })
    const result = optimizePlanningRooms(rooms, {
      soutenanceDates,
      maxPasses: 1,
      preventNewIssues: true,
      reduceWaitingTime: true
    })

    const beforeWaitingScores = new Map(
      before.personWaitingSummaries.map((summary) => [summary.personKey, summary.waitingScore])
    )

    expect(before.summary.waitingGapCount).toBe(3)
    expect(result.changed).toBe(true)
    expect(result.after.waitingGapCount).toBeLessThan(before.summary.waitingGapCount)
    result.after.personWaitingSummaries.forEach((summary) => {
      expect(summary.waitingScore).toBeLessThanOrEqual(beforeWaitingScores.get(summary.personKey) || 0)
    })
  })

  it('ne deplace pas une pause vers le repas si cela augmente l attente', () => {
    const soutenanceDates = [{ date: '2026-06-10', min: true }]
    const rooms = [
      makeRoom({
        date: '2026-06-10',
        name: 'A101',
        configSite: { maxConsecutiveTpi: 2 },
        cards: [
          makeCard('T1', 'Alice', 'Bob', 'Cara', 'Dan', 'MIN4'),
          makeCard('T2', 'Alice', 'Eve', 'Fran', 'Gina', 'MIN4'),
          emptyCard(),
          makeCard('T3', 'Alice', 'Hugo', 'Ivy', 'Jake', 'MIN4'),
          emptyCard()
        ]
      })
    ]

    const before = analyzePlanningRooms(rooms, { soutenanceDates })
    const result = optimizePlanningRooms(rooms, {
      soutenanceDates,
      maxPasses: 1,
      preventNewIssues: true,
      reduceWaitingTime: true
    })

    expect(before.summary.waitingGapCount).toBe(1)
    expect(before.summary.offMealBreakCount).toBe(1)
    expect(result.changed).toBe(false)
    expect(result.after.waitingGapCount).toBe(1)
    expect(result.after.offMealBreakCount).toBe(1)
  })

  it('ne compacte pas les TPI au dela de la limite consecutive', () => {
    const soutenanceDates = [{ date: '2026-06-10', min: true }]
    const rooms = [
      makeRoom({
        date: '2026-06-10',
        name: 'A101',
        configSite: { maxConsecutiveTpi: 2 },
        cards: [
          makeCard('T1', 'Alice', 'Bob', 'Cara', 'Dan', 'MIN4'),
          makeCard('T2', 'Alice', 'Eve', 'Fran', 'Gina', 'MIN4'),
          emptyCard(),
          makeCard('T3', 'Alice', 'Hugo', 'Ivy', 'Jake', 'MIN4')
        ]
      })
    ]

    const before = analyzePlanningRooms(rooms, { soutenanceDates })
    const result = optimizePlanningRooms(rooms, {
      soutenanceDates,
      maxPasses: 1,
      preventNewIssues: true,
      reduceWaitingTime: true
    })

    expect(before.summary.waitingGapCount).toBe(1)
    expect(before.summary.sequenceViolationCount).toBe(0)
    expect(result.changed).toBe(false)
    expect(result.after.sequenceViolationCount).toBe(0)
    expect(result.rooms[0].tpiDatas.map((tpi) => tpi.refTpi || '')).toEqual(['T1', 'T2', '', 'T3'])
  })

  it('ne reduit pas l attente si cela cree une surcharge de sequence', () => {
    const soutenanceDates = [{ date: '2026-06-10', min: true }]
    const rooms = [
      makeRoom({
        date: '2026-06-10',
        name: 'A101',
        configSite: { maxConsecutiveTpi: 3 },
        cards: [
          makeCard('T1', 'Alice', 'Bob', 'Cara', 'Dan', 'MIN4'),
          makeCard('T2', 'Alice', 'Eve', 'Fran', 'Gina', 'MIN4'),
          emptyCard(),
          makeCard('T3', 'Alice', 'Hugo', 'Ivy', 'Jake', 'MIN4')
        ]
      })
    ]

    const before = analyzePlanningRooms(rooms, { soutenanceDates })
    const result = optimizePlanningRooms(rooms, {
      soutenanceDates,
      maxPasses: 1,
      preventNewIssues: true,
      reduceWaitingTime: true
    })

    expect(before.summary.waitingGapCount).toBe(1)
    expect(before.summary.sequenceExcessCount).toBe(0)
    expect(result.changed).toBe(false)
    expect(result.after.waitingGapCount).toBe(1)
    expect(result.after.sequenceExcessCount).toBe(0)
  })

  it('propose une optimisation d attente globale apres une verification valide', () => {
    const soutenanceDates = [{ date: '2026-06-10', min: true }]
    const rooms = [
      makeRoom({
        date: '2026-06-10',
        name: 'A101',
        configSite: { maxConsecutiveTpi: 3 },
        cards: [
          makeCard('T1', 'Alice', 'Bob', 'Cara', 'Dan', 'MIN4'),
          makeCard('T2', 'Alice', 'Eve', 'Fran', 'Gina', 'MIN4'),
          makeCard('T3', 'Alice', 'Hugo', 'Ivy', 'Jake', 'MIN4'),
          emptyCard(),
          emptyCard(),
          emptyCard(),
          makeCard('T4', 'Alice', 'Lia', 'Mia', 'Nia', 'MIN4')
        ]
      })
    ]

    const proposal = buildTargetedPlanningOptimizationProposal(rooms, {
      soutenanceDates,
      validationResult: {
        summary: { issueCount: 0 },
        issues: []
      },
      settings: {
        reduceWaitingTime: true,
        maxSwaps: 1,
        sameSiteOnly: true,
        preserveValidated: false,
        issueTypes: ['person_overlap', 'consecutive_limit', 'room_class_mismatch']
      }
    })

    expect(proposal.changed).toBe(true)
    expect(proposal.targetReferences).toEqual([])
    expect(proposal.after.waitingGapCount).toBeLessThan(proposal.before.waitingGapCount)
    expect(proposal.after.sequenceViolationCount).toBe(0)
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

  it('respecte le type explicite des rooms MATU et non MATU dans l analyse', () => {
    const rooms = [
      makeRoom({
        date: '2026-06-10',
        name: 'A101',
        roomClassMode: 'matu',
        cards: [
          makeCard('T60', 'Alice', 'B1', 'B2', 'B3', 'MATU1')
        ]
      }),
      makeRoom({
        date: '2026-06-10',
        name: 'A102',
        roomClassMode: 'nonM',
        cards: [
          makeCard('T61', 'Bob', 'C1', 'C2', 'C3', 'DEV4')
        ]
      })
    ]

    const result = analyzePlanningRooms(rooms, {
      soutenanceDates: [{ date: '2026-06-10' }]
    })

    expect(result.roomContexts.map((context) => context.roomClassMode)).toEqual(['matu', 'nonM'])
    expect(result.summary.classMismatchCount).toBe(0)
  })

  it('ne propose jamais de deplacer un TPI CFC dans une room MATU explicite', () => {
    const rooms = [
      makeRoom({
        date: '2026-06-10',
        name: 'A101',
        roomClassMode: 'matu',
        cards: [
          emptyCard(),
          emptyCard()
        ]
      }),
      makeRoom({
        date: '2026-06-10',
        name: 'A102',
        roomClassMode: 'nonM',
        cards: [
          makeCard('T70', 'Alice', 'B1', 'B2', 'B3', 'DEV4'),
          emptyCard()
        ]
      }),
      makeRoom({
        date: '2026-06-10',
        name: 'A103',
        roomClassMode: 'nonM',
        cards: [
          makeCard('T71', 'Alice', 'C1', 'C2', 'C3', 'DEV4'),
          emptyCard()
        ]
      })
    ]

    const before = analyzePlanningRooms(rooms, {
      soutenanceDates: [{ date: '2026-06-10' }]
    })
    const result = optimizePlanningRooms(rooms, {
      soutenanceDates: [{ date: '2026-06-10' }]
    })

    expect(before.summary.personOverlapCount).toBe(1)
    expect(result.changed).toBe(true)
    expect(result.after.personOverlapCount).toBe(0)
    expect(result.rooms[0].tpiDatas.every((tpi) => !tpi.refTpi)).toBe(true)
  })
})
