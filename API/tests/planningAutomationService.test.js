const test = require('node:test')
const assert = require('node:assert/strict')

const Person = require('../models/personModel')
const {
  buildAutomaticSlotDocuments,
  buildLegacyRoomsFromAutomaticSlots,
  computeAutomaticAssignments,
  resolveTaskAllowedDateKeys
} = require('../services/planningAutomationService')

function makeSiteContext(overrides = {}) {
  return {
    siteKey: 'ETML',
    siteId: 'site-etml',
    siteCode: 'ETML',
    siteLabel: 'ETML',
    roomNames: ['A101'],
    roomCapacityByName: new Map([['A101', 18]]),
    numSlots: 4,
    maxConsecutiveTpi: 4,
    minTpiPerRoom: 3,
    tpiTimeMinutes: 60,
    breaklineMinutes: 10,
    firstTpiStartTime: '08:00',
    manualRoomTarget: null,
    ...overrides
  }
}

function makeParticipant(personId, personName, overrides = {}) {
  const preferredSoutenanceChoices = Array.isArray(overrides.preferredSoutenanceChoices)
    ? overrides.preferredSoutenanceChoices
    : Array.isArray(overrides.preferredSoutenanceDates)
      ? overrides.preferredSoutenanceDates.map((date) => ({ date }))
      : []

  return {
    personId,
    personName,
    role: overrides.role || 'expert1',
    person: {
      _id: personId,
      firstName: personName.split(' ')[0],
      lastName: personName.split(' ').slice(1).join(' '),
      isAvailableOn: overrides.isAvailableOn || (() => true),
      preferredSoutenanceChoices,
      preferredSoutenanceDates: Array.isArray(overrides.preferredSoutenanceDates)
        ? overrides.preferredSoutenanceDates
        : []
    },
    preferredChoices: preferredSoutenanceChoices,
    preferredDateKeys: Array.isArray(overrides.preferredSoutenanceDates)
      ? overrides.preferredSoutenanceDates
      : []
  }
}

function makeTask(index, siteContext, overrides = {}) {
  const id = `tpi-${index}`
  return {
    tpi: {
      _id: id,
      year: 2026,
      classe: overrides.classe || 'DEV4'
    },
    tpiId: id,
    reference: overrides.reference || `TPI-2026-${String(index).padStart(3, '0')}`,
    siteValue: siteContext.siteCode,
    siteContext,
    allowedDateKeys: overrides.allowedDateKeys || ['2026-06-10'],
    participants: overrides.participants || [
      makeParticipant(`cand-${index}`, `Candidate ${index}`, { role: 'candidat' }),
      makeParticipant(`expert-a-${index}`, `Expert A ${index}`, { role: 'expert1' }),
      makeParticipant(`expert-b-${index}`, `Expert B ${index}`, { role: 'expert2' }),
      makeParticipant(`boss-${index}`, `Boss ${index}`, { role: 'chefProjet' })
    ],
    repeatedParticipantWeight: 0,
    issues: []
  }
}

test('computeAutomaticAssignments garde la meme salle pour une personne repetee sur la meme date', () => {
  const siteContext = makeSiteContext()
  const sharedExpert = makeParticipant('expert-shared', 'Expert Shared', { role: 'expert1' })
  const tasks = [
    makeTask(1, siteContext, {
      participants: [
        makeParticipant('cand-1', 'Candidate One', { role: 'candidat' }),
        sharedExpert,
        makeParticipant('expert-b-1', 'Expert B One', { role: 'expert2' }),
        makeParticipant('boss-1', 'Boss One', { role: 'chefProjet' })
      ]
    }),
    makeTask(2, siteContext, {
      participants: [
        makeParticipant('cand-2', 'Candidate Two', { role: 'candidat' }),
        sharedExpert,
        makeParticipant('expert-b-2', 'Expert B Two', { role: 'expert2' }),
        makeParticipant('boss-2', 'Boss Two', { role: 'chefProjet' })
      ]
    })
  ]

  const result = computeAutomaticAssignments(tasks)

  assert.equal(result.manualRequired.length, 0)
  assert.equal(result.assignments.length, 2)
  assert.equal(result.assignments[0].placement.dateKey, '2026-06-10')
  assert.equal(result.assignments[1].placement.dateKey, '2026-06-10')
  assert.equal(result.assignments[0].placement.roomName, 'A101')
  assert.equal(result.assignments[1].placement.roomName, 'A101')
  assert.deepEqual(
    result.assignments.map((entry) => entry.placement.period),
    [1, 2]
  )
})

test('buildAutomaticSlotDocuments cree une salle supplementaire si un seul creneau est disponible', () => {
  const siteContext = makeSiteContext({
    numSlots: 1
  })
  const tasks = [
    makeTask(1, siteContext),
    makeTask(2, siteContext)
  ]

  const computation = computeAutomaticAssignments(tasks)
  const slotDocuments = buildAutomaticSlotDocuments(
    computation.assignments,
    computation.generatedRoomsBySiteDate
  )

  assert.equal(computation.manualRequired.length, 0)
  assert.equal(computation.assignments.length, 2)
  assert.equal(
    new Set(computation.assignments.map((entry) => entry.placement.roomName)).size,
    2
  )
  assert.equal(slotDocuments.length, 2)
  assert.deepEqual(
    slotDocuments.map((slot) => slot.status),
    ['proposed', 'proposed']
  )
})

test('computeAutomaticAssignments utilise le minimum de TPI par salle configure comme preference souple', () => {
  const siteContext = makeSiteContext({
    numSlots: 4,
    minTpiPerRoom: 2
  })
  const tasks = Array.from({ length: 6 }, (_, index) =>
    makeTask(index + 1, siteContext)
  )

  const result = computeAutomaticAssignments(tasks)
  const loadByRoom = result.assignments.reduce((accumulator, assignment) => {
    const roomName = assignment.placement.roomName
    accumulator[roomName] = (accumulator[roomName] || 0) + 1
    return accumulator
  }, {})

  assert.equal(result.manualRequired.length, 0)
  assert.deepEqual(loadByRoom, {
    A101: 4,
    'ETML 02': 2
  })
})

test('resolveTaskAllowedDateKeys force la date TPI seulement si elle respecte les dates de classe', () => {
  assert.deepEqual(
    resolveTaskAllowedDateKeys(
      { dates: { soutenance: '2026-06-03' } },
      ['2026-06-03', '2026-06-10']
    ),
    ['2026-06-03']
  )
  assert.deepEqual(
    resolveTaskAllowedDateKeys(
      { dates: { soutenance: '2026-06-03' } },
      ['2026-06-10']
    ),
    ['2026-06-10']
  )
  assert.deepEqual(
    resolveTaskAllowedDateKeys(
      { dates: { soutenance: '2026-06-03' } },
      []
    ),
    ['2026-06-03']
  )
})

test('computeAutomaticAssignments equilibre une salle ouverte avec au moins 3 TPI quand possible', () => {
  const siteContext = makeSiteContext({
    numSlots: 4
  })
  const tasks = Array.from({ length: 6 }, (_, index) => makeTask(index + 1, siteContext))

  const result = computeAutomaticAssignments(tasks)
  const roomLoads = result.assignments.reduce((loads, assignment) => {
    const roomName = assignment.placement.roomName
    loads.set(roomName, Number(loads.get(roomName) || 0) + 1)
    return loads
  }, new Map())

  assert.equal(result.manualRequired.length, 0)
  assert.equal(result.assignments.length, 6)
  assert.deepEqual(
    Array.from(roomLoads.values()).sort((left, right) => left - right),
    [3, 3]
  )
})

test('computeAutomaticAssignments etale une 5e défense sur une autre date pour eviter 5 TPI consecutifs', () => {
  const siteContext = makeSiteContext({
    numSlots: 4
  })
  const sharedExpert = makeParticipant('expert-shared', 'Expert Shared', { role: 'expert1' })
  const tasks = Array.from({ length: 5 }, (_, index) =>
    makeTask(index + 1, siteContext, {
      allowedDateKeys: ['2026-06-10', '2026-06-11'],
      participants: [
        makeParticipant(`cand-${index + 1}`, `Candidate ${index + 1}`, { role: 'candidat' }),
        sharedExpert,
        makeParticipant(`expert-b-${index + 1}`, `Expert B ${index + 1}`, { role: 'expert2' }),
        makeParticipant(`boss-${index + 1}`, `Boss ${index + 1}`, { role: 'chefProjet' })
      ]
    })
  )

  const result = computeAutomaticAssignments(tasks)
  const assignedDates = new Set(result.assignments.map((entry) => entry.placement.dateKey))

  assert.equal(result.manualRequired.length, 0)
  assert.equal(result.assignments.length, 5)
  assert.equal(assignedDates.size, 2)
  assert.ok(assignedDates.has('2026-06-10'))
  assert.ok(assignedDates.has('2026-06-11'))
})

test('computeAutomaticAssignments respecte la limite configurable de TPI consecutifs du site', () => {
  const siteContext = makeSiteContext({
    numSlots: 4,
    maxConsecutiveTpi: 2
  })
  const sharedExpert = makeParticipant('expert-shared', 'Expert Shared', { role: 'expert1' })
  const tasks = Array.from({ length: 3 }, (_, index) =>
    makeTask(index + 1, siteContext, {
      participants: [
        makeParticipant(`cand-${index + 1}`, `Candidate ${index + 1}`, { role: 'candidat' }),
        sharedExpert,
        makeParticipant(`expert-b-${index + 1}`, `Expert B ${index + 1}`, { role: 'expert2' }),
        makeParticipant(`boss-${index + 1}`, `Boss ${index + 1}`, { role: 'chefProjet' })
      ]
    })
  )

  const result = computeAutomaticAssignments(tasks)
  const assignedPeriods = result.assignments
    .map((entry) => entry.placement.period)
    .sort((left, right) => left - right)

  assert.equal(result.manualRequired.length, 0)
  assert.equal(result.assignments.length, 3)
  assert.deepEqual(assignedPeriods, [1, 2, 4])
})

test('computeAutomaticAssignments passe en manuel quand la limite consecutive ne laisse aucun creneau', () => {
  const siteContext = makeSiteContext({
    numSlots: 3,
    maxConsecutiveTpi: 2
  })
  const sharedExpert = makeParticipant('expert-shared', 'Expert Shared', { role: 'expert1' })
  const tasks = Array.from({ length: 3 }, (_, index) =>
    makeTask(index + 1, siteContext, {
      participants: [
        makeParticipant(`cand-${index + 1}`, `Candidate ${index + 1}`, { role: 'candidat' }),
        sharedExpert,
        makeParticipant(`expert-b-${index + 1}`, `Expert B ${index + 1}`, { role: 'expert2' }),
        makeParticipant(`boss-${index + 1}`, `Boss ${index + 1}`, { role: 'chefProjet' })
      ]
    })
  )

  const result = computeAutomaticAssignments(tasks)

  assert.equal(result.assignments.length, 2)
  assert.equal(result.manualRequired.length, 1)
  assert.match(result.manualRequired[0].reason, /Aucun créneau valide/i)
})

test('computeAutomaticAssignments interdit le meme participant sur deux salles au meme moment', () => {
  const siteContext = makeSiteContext({
    roomNames: ['A101', 'A102'],
    roomCapacityByName: new Map([
      ['A101', 18],
      ['A102', 18]
    ]),
    numSlots: 2
  })
  const sharedExpert = makeParticipant('expert-shared', 'Expert Shared', { role: 'expert1' })
  const tasks = [
    makeTask(1, siteContext, {
      participants: [
        makeParticipant('cand-1', 'Candidate One', { role: 'candidat' }),
        sharedExpert,
        makeParticipant('expert-b-1', 'Expert B One', { role: 'expert2' }),
        makeParticipant('boss-1', 'Boss One', { role: 'chefProjet' })
      ]
    }),
    makeTask(2, siteContext, {
      participants: [
        makeParticipant('cand-2', 'Candidate Two', { role: 'candidat' }),
        sharedExpert,
        makeParticipant('expert-b-2', 'Expert B Two', { role: 'expert2' }),
        makeParticipant('boss-2', 'Boss Two', { role: 'chefProjet' })
      ]
    })
  ]

  const result = computeAutomaticAssignments(tasks)
  const assignedPeriods = result.assignments
    .map((entry) => entry.placement.period)
    .sort((left, right) => left - right)

  assert.equal(result.manualRequired.length, 0)
  assert.deepEqual(assignedPeriods, [1, 2])
})

test('computeAutomaticAssignments saute une salle MATU incompatible pour un TPI non-MATU', () => {
  const siteContext = makeSiteContext({
    roomNames: ['M101', 'A101'],
    roomCapacityByName: new Map([
      ['M101', 18],
      ['A101', 18]
    ]),
    numSlots: 1
  })
  const task = makeTask(1, siteContext, {
    classe: 'DEV4'
  })

  const result = computeAutomaticAssignments([task])

  assert.equal(result.manualRequired.length, 0)
  assert.equal(result.assignments.length, 1)
  assert.equal(result.assignments[0].placement.roomName, 'A101')
})

test('computeAutomaticAssignments privilegie une date ideale quand deux TPI se disputent les memes creneaux', () => {
  const siteContext = makeSiteContext({
    numSlots: 1
  })
  const sharedExpert = makeParticipant('expert-shared', 'Expert Shared', { role: 'expert1' })
  const neutralTask = makeTask(1, siteContext, {
    participants: [
      makeParticipant('cand-1', 'Candidate One', { role: 'candidat' }),
      sharedExpert,
      makeParticipant('expert-b-1', 'Expert B One', { role: 'expert2' }),
      makeParticipant('boss-1', 'Boss One', { role: 'chefProjet' })
    ],
    allowedDateKeys: ['2026-06-10', '2026-06-11']
  })
  const preferredTask = makeTask(2, siteContext, {
    reference: 'TPI-2026-002',
    participants: [
      makeParticipant('cand-2', 'Candidate Two', {
        role: 'candidat',
        preferredSoutenanceDates: ['2026-06-10']
      }),
      sharedExpert,
      makeParticipant('expert-b-2', 'Expert B Two', { role: 'expert2' }),
      makeParticipant('boss-2', 'Boss Two', { role: 'chefProjet' })
    ],
    allowedDateKeys: ['2026-06-10', '2026-06-11']
  })

  const result = computeAutomaticAssignments([neutralTask, preferredTask])
  const assignmentByReference = new Map(
    result.assignments.map((entry) => [entry.task.reference, entry.placement.dateKey])
  )

  assert.equal(result.manualRequired.length, 0)
  assert.equal(result.assignments.length, 2)
  assert.equal(assignmentByReference.get('TPI-2026-002'), '2026-06-10')
  assert.equal(assignmentByReference.get('TPI-2026-001'), '2026-06-11')
})

test('computeAutomaticAssignments privilegie un creneau exact quand la date est identique', () => {
  const siteContext = makeSiteContext({
    numSlots: 2
  })
  const preferredTask = makeTask(1, siteContext, {
    participants: [
      makeParticipant('cand-1', 'Candidate One', {
        role: 'candidat',
        preferredSoutenanceChoices: [{ date: '2026-06-10', period: 2 }]
      }),
      makeParticipant('expert-a-1', 'Expert A One', { role: 'expert1' }),
      makeParticipant('expert-b-1', 'Expert B One', { role: 'expert2' }),
      makeParticipant('boss-1', 'Boss One', { role: 'chefProjet' })
    ],
    allowedDateKeys: ['2026-06-10']
  })
  const neutralTask = makeTask(2, siteContext, {
    allowedDateKeys: ['2026-06-10']
  })

  const result = computeAutomaticAssignments([neutralTask, preferredTask])
  const assignmentByReference = new Map(
    result.assignments.map((entry) => [entry.task.reference, entry.placement.period])
  )

  assert.equal(result.manualRequired.length, 0)
  assert.equal(result.assignments.length, 2)
  assert.equal(assignmentByReference.get('TPI-2026-001'), 2)
  assert.equal(assignmentByReference.get('TPI-2026-002'), 1)
})

test('computeAutomaticAssignments revient en arriere quand un choix glouton bloque une contrainte', () => {
  const siteContext = makeSiteContext({
    numSlots: 3
  })
  const sharedExpert = makeParticipant('expert-shared', 'Expert Shared', { role: 'expert1' })
  const makeAvailability = (periods) => (_date, period) => periods.includes(Number(period))
  const tasks = [
    makeTask(1, siteContext, {
      participants: [
        makeParticipant('cand-1', 'Candidate One', {
          role: 'candidat',
          isAvailableOn: makeAvailability([1, 2])
        }),
        sharedExpert,
        makeParticipant('expert-b-1', 'Expert B One', { role: 'expert2' }),
        makeParticipant('boss-1', 'Boss One', { role: 'chefProjet' })
      ]
    }),
    makeTask(2, siteContext, {
      participants: [
        makeParticipant('cand-2', 'Candidate Two', {
          role: 'candidat',
          isAvailableOn: makeAvailability([1, 3])
        }),
        sharedExpert,
        makeParticipant('expert-b-2', 'Expert B Two', { role: 'expert2' }),
        makeParticipant('boss-2', 'Boss Two', { role: 'chefProjet' })
      ]
    }),
    makeTask(3, siteContext, {
      participants: [
        makeParticipant('cand-3', 'Candidate Three', {
          role: 'candidat',
          isAvailableOn: makeAvailability([1, 3])
        }),
        sharedExpert,
        makeParticipant('expert-b-3', 'Expert B Three', { role: 'expert2' }),
        makeParticipant('boss-3', 'Boss Three', { role: 'chefProjet' })
      ]
    })
  ]

  const result = computeAutomaticAssignments(tasks)
  const assignmentByReference = new Map(
    result.assignments.map((entry) => [entry.task.reference, entry.placement.period])
  )

  assert.equal(result.manualRequired.length, 0)
  assert.equal(result.assignments.length, 3)
  assert.equal(assignmentByReference.get('TPI-2026-001'), 2)
  assert.deepEqual(
    [
      assignmentByReference.get('TPI-2026-002'),
      assignmentByReference.get('TPI-2026-003')
    ].sort((left, right) => left - right),
    [1, 3]
  )
})

test('computeAutomaticAssignments evite une nouvelle salle pour une simple preference', () => {
  const siteContext = makeSiteContext({
    numSlots: 2
  })
  const sharedExpert = makeParticipant('expert-shared', 'Expert Shared', { role: 'expert1' })
  const neutralTask = makeTask(1, siteContext, {
    participants: [
      makeParticipant('cand-1', 'Candidate One', { role: 'candidat' }),
      sharedExpert,
      makeParticipant('expert-b-1', 'Expert B One', { role: 'expert2' }),
      makeParticipant('boss-1', 'Boss One', { role: 'chefProjet' })
    ],
    allowedDateKeys: ['2026-06-10']
  })
  const otherDayTask = makeTask(2, siteContext, {
    participants: [
      makeParticipant('cand-2', 'Candidate Two', { role: 'candidat' }),
      sharedExpert,
      makeParticipant('expert-b-2', 'Expert B Two', { role: 'expert2' }),
      makeParticipant('boss-2', 'Boss Two', { role: 'chefProjet' })
    ],
    allowedDateKeys: ['2026-06-11']
  })
  const preferredTask = makeTask(3, siteContext, {
    participants: [
      makeParticipant('cand-3', 'Candidate Three', {
        role: 'candidat',
        preferredSoutenanceChoices: [{ date: '2026-06-10', period: 1 }]
      }),
      makeParticipant('expert-a-3', 'Expert A Three', { role: 'expert1' }),
      makeParticipant('expert-b-3', 'Expert B Three', { role: 'expert2' }),
      makeParticipant('boss-3', 'Boss Three', { role: 'chefProjet' })
    ],
    allowedDateKeys: ['2026-06-10']
  })

  const result = computeAutomaticAssignments([neutralTask, otherDayTask, preferredTask])
  const preferredAssignment = result.assignments.find((entry) => entry.task.reference === 'TPI-2026-003')
  const dateTenRooms = result.generatedRoomsBySiteDate.get('ETML|2026-06-10')

  assert.equal(result.manualRequired.length, 0)
  assert.equal(preferredAssignment.placement.roomName, 'A101')
  assert.equal(preferredAssignment.placement.period, 2)
  assert.deepEqual(dateTenRooms, ['A101'])
})

test('computeAutomaticAssignments respecte les indisponibilites declarees des participants', () => {
  const siteContext = makeSiteContext({
    numSlots: 2
  })
  const task = makeTask(1, siteContext, {
    participants: [
      makeParticipant('cand-1', 'Candidate One', {
        role: 'candidat',
        isAvailableOn: (_date, period) => Number(period) === 2
      }),
      makeParticipant('expert-a-1', 'Expert A One', { role: 'expert1' }),
      makeParticipant('expert-b-1', 'Expert B One', { role: 'expert2' }),
      makeParticipant('boss-1', 'Boss One', { role: 'chefProjet' })
    ]
  })

  const result = computeAutomaticAssignments([task])

  assert.equal(result.manualRequired.length, 0)
  assert.equal(result.assignments.length, 1)
  assert.equal(result.assignments[0].placement.period, 2)
})

test('computeAutomaticAssignments marque manuel quand un participant est indisponible partout', () => {
  const siteContext = makeSiteContext({
    numSlots: 2
  })
  const task = makeTask(1, siteContext, {
    participants: [
      makeParticipant('cand-1', 'Candidate One', {
        role: 'candidat',
        isAvailableOn: () => false
      }),
      makeParticipant('expert-a-1', 'Expert A One', { role: 'expert1' }),
      makeParticipant('expert-b-1', 'Expert B One', { role: 'expert2' }),
      makeParticipant('boss-1', 'Boss One', { role: 'chefProjet' })
    ]
  })

  const result = computeAutomaticAssignments([task])

  assert.equal(result.assignments.length, 0)
  assert.equal(result.manualRequired.length, 1)
  assert.equal(result.manualRequired[0].reference, 'TPI-2026-001')
})

test('computeAutomaticAssignments treats participants without declared availability as unconstrained', () => {
  const siteContext = makeSiteContext({
    numSlots: 2
  })
  const personA = new Person({
    firstName: 'Alice',
    lastName: 'Candidate',
    email: 'alice.candidate@example.com',
    roles: ['candidat']
  })
  const personB = new Person({
    firstName: 'Bob',
    lastName: 'Expert',
    email: 'bob.expert@example.com',
    roles: ['expert']
  })
  const personC = new Person({
    firstName: 'Carla',
    lastName: 'Expert',
    email: 'carla.expert@example.com',
    roles: ['expert']
  })
  const personD = new Person({
    firstName: 'Diane',
    lastName: 'Boss',
    email: 'diane.boss@example.com',
    roles: ['chef_projet']
  })

  const task = {
    tpi: {
      _id: 'tpi-open-availability',
      year: 2026
    },
    tpiId: 'tpi-open-availability',
    reference: 'TPI-2026-777',
    siteValue: siteContext.siteCode,
    siteContext,
    allowedDateKeys: ['2026-06-10'],
    participants: [
      { personId: String(personA._id), personName: 'Alice Candidate', role: 'candidat', person: personA },
      { personId: String(personB._id), personName: 'Bob Expert', role: 'expert1', person: personB },
      { personId: String(personC._id), personName: 'Carla Expert', role: 'expert2', person: personC },
      { personId: String(personD._id), personName: 'Diane Boss', role: 'chefProjet', person: personD }
    ],
    repeatedParticipantWeight: 0,
    issues: []
  }

  const result = computeAutomaticAssignments([task])

  assert.equal(result.manualRequired.length, 0)
  assert.equal(result.assignments.length, 1)
  assert.equal(result.assignments[0].placement.dateKey, '2026-06-10')
})

test('buildLegacyRoomsFromAutomaticSlots reconstruit le format legacy attendu par l onglet workflow', () => {
  const siteContext = makeSiteContext({
    numSlots: 3
  })
  const tasks = [makeTask(1, siteContext, { reference: 'TPI-2026-2163' })]
  const computation = computeAutomaticAssignments(tasks)
  const slotDocuments = buildAutomaticSlotDocuments(
    computation.assignments,
    computation.generatedRoomsBySiteDate
  )

  const legacyRooms = buildLegacyRoomsFromAutomaticSlots(2026, slotDocuments, tasks)

  assert.equal(legacyRooms.length, 1)
  assert.equal(legacyRooms[0].site, 'ETML')
  assert.equal(legacyRooms[0].name, 'A101')
  assert.equal(legacyRooms[0].configSite.numSlots, 3)
  assert.equal(legacyRooms[0].configSite.maxConsecutiveTpi, 4)
  assert.equal(legacyRooms[0].configSite.minTpiPerRoom, 3)
  assert.equal(legacyRooms[0].tpiDatas.length, 3)
  assert.equal(legacyRooms[0].tpiDatas[0].refTpi, '2163')
  assert.equal(legacyRooms[0].tpiDatas[0].id, 'TPI-2026-2163')
  assert.equal(legacyRooms[0].tpiDatas[1].refTpi, null)
  assert.equal(legacyRooms[0].tpiDatas[2].refTpi, null)
})
