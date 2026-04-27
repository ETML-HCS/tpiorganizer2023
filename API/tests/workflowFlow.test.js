const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')

const schedulingService = require('../services/schedulingService')
const TpiPlanning = require('../models/tpiPlanningModel')
const Slot = require('../models/slotModel')
const Person = require('../models/personModel')
const Vote = require('../models/voteModel')

function patchMethod(target, key, implementation) {
  const original = target[key]
  target[key] = implementation
  return () => {
    target[key] = original
  }
}

function createObjectId() {
  return new mongoose.Types.ObjectId()
}

function makeQueryResult(value) {
  return {
    populate() {
      return this
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject)
    }
  }
}

test('proposeSlotsAndInitiateVoting crée 1 date fixée et 3 alternatives avec 12 votes', async () => {
  const tpiId = createObjectId()
  const selectedSlots = Array.from({ length: 5 }, (_, index) => {
    const slotId = createObjectId()
    return {
      _id: slotId,
      date: new Date(`2026-06-${10 + index}T08:00:00.000Z`),
      period: (index % 2) + 1,
      room: {
        site: 'ETML',
        name: `A10${index + 1}`
      },
      status: 'available'
    }
  })

  const fakePerson = (id, fullName) => ({
    _id: id,
    fullName,
    isAvailableOn: () => true
  })

  const tpi = {
    _id: tpiId,
    year: 2026,
    site: 'ETML',
    status: 'draft',
    proposedSlots: [],
    candidat: fakePerson(createObjectId(), 'Candidat Test'),
    expert1: fakePerson(createObjectId(), 'Expert Un'),
    expert2: fakePerson(createObjectId(), 'Expert Deux'),
    chefProjet: fakePerson(createObjectId(), 'Chef Projet'),
    votingSession: {
      voteSummary: {
        expert1Voted: false,
        expert2Voted: false,
        chefProjetVoted: false
      }
    },
    save: async function save() {
      return this
    },
    addHistory: async function addHistory() {
      return this
    }
  }

  const createdVotes = []
  const slotUpdates = []
  const restore = [
    patchMethod(TpiPlanning, 'findById', () => ({
      populate: async () => tpi,
      then: (resolve, reject) => Promise.resolve(tpi).then(resolve, reject),
      catch: (reject) => Promise.resolve(tpi).catch(reject)
    })),
    patchMethod(Slot, 'find', (query) => {
      if (query?.year === 2026 && query?.status === undefined) {
        return {
          select: () => ({
            sort: () => selectedSlots
          })
        }
      }

      if (query?.year === 2026 && query?.status === 'available') {
        return {
          sort: () => selectedSlots
        }
      }

      if (query?.status === 'confirmed') {
        return {
          sort: () => ({
            limit: () => []
          })
        }
      }

      throw new Error(`Unexpected Slot.find query: ${JSON.stringify(query)}`)
    }),
    patchMethod(Slot, 'findOne', async () => null),
    patchMethod(Slot, 'findByIdAndUpdate', async (slotId, update) => {
      slotUpdates.push({ slotId: String(slotId), update })
      return null
    }),
    patchMethod(Vote, 'create', async (payload) => {
      createdVotes.push(payload)
      return payload
    }),
    patchMethod(Person, 'findById', async () => null)
  ]

  try {
    const result = await schedulingService.proposeSlotsAndInitiateVoting(tpiId)

    assert.equal(result.success, true)
    assert.equal(result.proposedSlots.length, 4)
    assert.equal(tpi.status, 'voting')
    assert.equal(tpi.proposedSlots.length, 4)
    assert.equal(createdVotes.length, 12)
    assert.equal(slotUpdates.length, 4)
    assert.ok(tpi.votingSession.startedAt instanceof Date)
    assert.ok(tpi.votingSession.deadline instanceof Date)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('registerVoteAndCheckValidation confirme un créneau quand tout est validé', async () => {
  const tpiId = createObjectId()
  const slotId = createObjectId()
  const otherSlotId = createObjectId()
  const voterId = createObjectId()

  const slot = {
    _id: slotId,
    date: new Date('2026-06-10T08:00:00.000Z'),
    period: 1,
    room: { name: 'A101' },
    status: 'proposed',
    save: async function save() {
      return this
    }
  }

  const tpi = {
    _id: tpiId,
    candidat: createObjectId(),
    expert1: createObjectId(),
    expert2: createObjectId(),
    chefProjet: createObjectId(),
    proposedSlots: [{ slot: slotId }, { slot: otherSlotId }],
    status: 'voting',
    votingSession: {
      voteSummary: {
        expert1Voted: false,
        expert2Voted: false,
        chefProjetVoted: false
      }
    },
    save: async function save() {
      return this
    },
    areAllVotesIn: () => true,
    addHistory: async function addHistory() {
      return this
    }
  }

  const vote = {
    _id: createObjectId(),
    tpiPlanning: tpiId,
    voter: voterId,
    voterRole: 'expert1',
    decision: 'pending',
    comment: '',
    votedAt: null,
    save: async function save() {
      return this
    }
  }

  const restore = [
    patchMethod(Vote, 'findById', async (id) => {
      if (String(id) === String(vote._id)) {
        return vote
      }

      return null
    }),
    patchMethod(Vote, 'findUnanimousSlot', async () => slotId),
    patchMethod(TpiPlanning, 'findById', async () => tpi),
    patchMethod(Slot, 'findById', async (id) => {
      if (String(id) === String(slotId)) {
        return slot
      }

      return null
    }),
    patchMethod(Slot, 'findOne', async () => null),
    patchMethod(Slot, 'updateMany', async () => ({ modifiedCount: 1 })),
    patchMethod(Slot, 'findByIdAndUpdate', async () => null),
    patchMethod(Person, 'findById', async () => ({ fullName: 'Personne test' })),
    patchMethod(Person, 'findByIdAndUpdate', async () => null)
  ]

  try {
    const result = await schedulingService.registerVoteAndCheckValidation(
      vote._id,
      'preferred',
      'OK pour moi'
    )

    assert.equal(result.success, true)
    assert.equal(result.message, 'Créneau confirmé avec succès')
    assert.equal(tpi.status, 'confirmed')
    assert.equal(String(tpi.confirmedSlot), String(slotId))
    assert.equal(vote.decision, 'preferred')
    assert.equal(vote.comment, 'OK pour moi')
    assert.equal(tpi.votingSession.voteSummary.expert1Voted, true)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('registerVoteAndCheckValidation prépare une validation manuelle quand les votes proposent un compromis', async () => {
  const tpiId = createObjectId()
  const suggestedSlotId = createObjectId()
  const voterId = createObjectId()

  const tpi = {
    _id: tpiId,
    status: 'voting',
    votingSession: {
      voteSummary: {
        expert1Voted: false,
        expert2Voted: false,
        chefProjetVoted: false
      }
    },
    save: async function save() {
      return this
    },
    areAllVotesIn: () => true
  }

  const vote = {
    _id: createObjectId(),
    tpiPlanning: tpiId,
    voter: voterId,
    voterRole: 'expert2',
    decision: 'pending',
    comment: '',
    votedAt: null,
    save: async function save() {
      return this
    }
  }

  const restore = [
    patchMethod(Vote, 'findById', async (id) => {
      if (String(id) === String(vote._id)) {
        return vote
      }

      return null
    }),
    patchMethod(Vote, 'findUnanimousSlot', async () => null),
    patchMethod(Vote, 'aggregate', async () => [
      {
        _id: suggestedSlotId,
        acceptedCount: 2,
        preferredCount: 1,
        rejectedCount: 1
      }
    ]),
    patchMethod(TpiPlanning, 'findById', async () => tpi)
  ]

  try {
    const result = await schedulingService.registerVoteAndCheckValidation(
      vote._id,
      'preferred',
      'Alternative possible'
    )

    assert.equal(result.success, true)
    assert.equal(result.message, 'Tous les votes collectés, validation manuelle requise')
    assert.equal(String(result.suggestedSlot), String(suggestedSlotId))
    assert.equal(tpi.status, 'pending_validation')
    assert.equal(tpi.votingSession.voteSummary.expert2Voted, true)
    assert.equal(vote.decision, 'preferred')
    assert.equal(vote.comment, 'Alternative possible')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('findAvailableSlotsForTpi ignore les salles incompatibles avec la classe du TPI', async () => {
  const tpiId = createObjectId()
  const slotId = createObjectId()

  const fakePerson = (id, fullName) => ({
    _id: id,
    fullName,
    isAvailableOn: () => true
  })

  const tpi = {
    _id: tpiId,
    year: 2026,
    site: 'ETML',
    classe: 'DEV4',
    candidat: fakePerson(createObjectId(), 'Candidat Test'),
    expert1: fakePerson(createObjectId(), 'Expert Un'),
    expert2: fakePerson(createObjectId(), 'Expert Deux'),
    chefProjet: fakePerson(createObjectId(), 'Chef Projet')
  }

  const mismatchedSlot = {
    _id: slotId,
    year: 2026,
    date: new Date('2026-06-20T08:00:00.000Z'),
    period: 1,
    room: {
      site: 'ETML',
      name: 'M101'
    },
    status: 'available'
  }

  const restore = [
    patchMethod(TpiPlanning, 'findById', () => ({
      populate: async () => tpi,
      then: (resolve, reject) => Promise.resolve(tpi).then(resolve, reject),
      catch: (reject) => Promise.resolve(tpi).catch(reject)
    })),
    patchMethod(Slot, 'find', (query) => {
      if (query?.year === 2026 && query?.status === 'available') {
        return {
          sort: () => [mismatchedSlot]
        }
      }

      if (query?.year === 2026 && query?.status === undefined) {
        return {
          select: () => ({
            sort: () => [mismatchedSlot]
          })
        }
      }

      throw new Error(`Unexpected Slot.find query: ${JSON.stringify(query)}`)
    }),
    patchMethod(Slot, 'findOne', async () => null)
  ]

  try {
    const result = await schedulingService.findAvailableSlotsForTpi(tpiId)
    assert.equal(result.length, 0)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('forceSlotManually marque la dérogation admin puis confirme le créneau sans conflit', async () => {
  const tpiId = createObjectId()
  const slotId = createObjectId()
  const adminId = createObjectId()
  const otherSlotId = createObjectId()

  const tpi = {
    _id: tpiId,
    classe: 'DEV4',
    candidat: createObjectId(),
    expert1: createObjectId(),
    expert2: createObjectId(),
    chefProjet: createObjectId(),
    proposedSlots: [{ slot: slotId }, { slot: otherSlotId }],
    manualOverride: null,
    save: async function save() {
      return this
    },
    addHistory: async function addHistory() {
      return this
    }
  }

  const slot = {
    _id: slotId,
    date: new Date('2026-06-21T08:00:00.000Z'),
    period: 1,
    room: {
      site: 'ETML',
      name: 'A201'
    },
    status: 'available',
    save: async function save() {
      return this
    }
  }

  const releasedSlots = []
  const restore = [
    patchMethod(TpiPlanning, 'findById', async () => tpi),
    patchMethod(Slot, 'findById', async (id) => {
      if (String(id) === String(slotId)) {
        return slot
      }

      return null
    }),
    patchMethod(Slot, 'findOne', async () => null),
    patchMethod(Slot, 'updateMany', async (_query, update) => {
      releasedSlots.push({ update: update.$set || update })
      return { modifiedCount: 1 }
    }),
    patchMethod(Slot, 'findByIdAndUpdate', async (id, update) => {
      releasedSlots.push({ id: String(id), update })
      return null
    }),
    patchMethod(Person, 'findByIdAndUpdate', async () => null)
  ]

  try {
    const result = await schedulingService.forceSlotManually(
      tpiId,
      slotId,
      adminId,
      'Décision comité: tous les autres créneaux sont impossibles.'
    )

    assert.equal(result.success, true)
    assert.equal(tpi.manualOverride.isManual, true)
    assert.equal(String(tpi.manualOverride.overriddenBy), String(adminId))
    assert.equal(tpi.manualOverride.reason, 'Décision comité: tous les autres créneaux sont impossibles.')
    assert.equal(tpi.status, 'confirmed')
    assert.equal(String(tpi.confirmedSlot), String(slotId))
    assert.equal(slot.status, 'confirmed')
    assert.equal(releasedSlots.length, 1)
    assert.equal(releasedSlots[0].update.status, 'available')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('forceSlotManually ne marque pas la dérogation si la confirmation échoue', async () => {
  const tpiId = createObjectId()
  const slotId = createObjectId()
  const adminId = createObjectId()

  const tpi = {
    _id: tpiId,
    classe: 'DEV4',
    candidat: createObjectId(),
    expert1: createObjectId(),
    expert2: createObjectId(),
    chefProjet: createObjectId(),
    proposedSlots: [],
    manualOverride: null,
    addHistory: async function addHistory() {
      return this
    }
  }

  const incompatibleSlot = {
    _id: slotId,
    date: new Date('2026-06-21T08:00:00.000Z'),
    period: 1,
    room: {
      site: 'ETML',
      name: 'M201'
    },
    save: async function save() {
      return this
    }
  }

  const restore = [
    patchMethod(TpiPlanning, 'findById', async () => tpi),
    patchMethod(Slot, 'findById', async () => incompatibleSlot),
    patchMethod(Slot, 'findOne', async () => null)
  ]

  try {
    const result = await schedulingService.forceSlotManually(
      tpiId,
      slotId,
      adminId,
      'Dérogation impossible.'
    )

    assert.equal(result.success, false)
    assert.match(result.message, /Incompatibilité de salle/)
    assert.equal(tpi.manualOverride, null)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('simulateTpiMoveToSlot signale une inversion faisable quand le créneau cible est occupé', async () => {
  const tpiId = createObjectId()
  const occupantTpiId = createObjectId()
  const currentSlotId = createObjectId()
  const targetSlotId = createObjectId()

  const tpi = {
    _id: tpiId,
    reference: 'TPI-2026-010',
    classe: 'DEV4',
    candidat: createObjectId(),
    expert1: createObjectId(),
    expert2: createObjectId(),
    chefProjet: createObjectId(),
    confirmedSlot: null,
    proposedSlots: [
      {
        slot: {
          _id: currentSlotId,
          date: new Date('2026-06-10T08:00:00.000Z'),
          period: 1,
          startTime: '08:00',
          endTime: '12:00',
          room: { site: 'ETML', name: 'A101' },
          assignedTpi: tpiId
        }
      }
    ]
  }
  tpi.confirmedSlot = tpi.proposedSlots[0].slot

  const occupantTpi = {
    _id: occupantTpiId,
    reference: 'TPI-2026-011',
    classe: 'DEV4',
    candidat: createObjectId(),
    expert1: createObjectId(),
    expert2: createObjectId(),
    chefProjet: createObjectId()
  }

  const targetSlot = {
    _id: targetSlotId,
    date: new Date('2026-06-11T13:00:00.000Z'),
    period: 2,
    startTime: '13:00',
    endTime: '17:00',
    room: { site: 'ETML', name: 'A101' },
    assignedTpi: {
      _id: occupantTpiId,
      reference: occupantTpi.reference,
      candidat: { firstName: 'Bob', lastName: 'Occupant' }
    }
  }

  const currentSlot = {
    ...tpi.confirmedSlot,
    assignedTpi: tpiId
  }

  const restore = [
    patchMethod(TpiPlanning, 'findById', (id) => {
      if (String(id) === String(tpiId)) {
        return makeQueryResult(tpi)
      }

      if (String(id) === String(occupantTpiId)) {
        return makeQueryResult(occupantTpi)
      }

      return makeQueryResult(null)
    }),
    patchMethod(Slot, 'findById', (id) => {
      if (String(id) === String(targetSlotId)) {
        return makeQueryResult(targetSlot)
      }

      if (String(id) === String(currentSlotId)) {
        return makeQueryResult(currentSlot)
      }

      return makeQueryResult(null)
    }),
    patchMethod(Slot, 'findOne', async () => null)
  ]

  try {
    const result = await schedulingService.simulateTpiMoveToSlot(tpiId, targetSlotId)

    assert.equal(result.success, true)
    assert.equal(result.canMove, false)
    assert.equal(result.conflicts[0].type, 'room_overlap')
    assert.equal(result.swapCandidate.canSwap, true)
    assert.equal(result.swapCandidate.tpi.reference, 'TPI-2026-011')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('confirmSlotForTpi ne double-compte pas les statistiques lors d un déplacement confirmé', async () => {
  const tpiId = createObjectId()
  const oldSlotId = createObjectId()
  const newSlotId = createObjectId()

  const tpi = {
    _id: tpiId,
    classe: 'DEV4',
    candidat: createObjectId(),
    expert1: createObjectId(),
    expert2: createObjectId(),
    chefProjet: createObjectId(),
    confirmedSlot: oldSlotId,
    proposedSlots: [],
    addHistory: async function addHistory() {
      return this
    }
  }

  const slot = {
    _id: newSlotId,
    date: new Date('2026-06-22T08:00:00.000Z'),
    period: 1,
    room: {
      site: 'ETML',
      name: 'A201'
    },
    save: async function save() {
      return this
    }
  }

  const personUpdates = []
  const restore = [
    patchMethod(TpiPlanning, 'findById', async () => tpi),
    patchMethod(Slot, 'findById', async () => slot),
    patchMethod(Slot, 'findOne', async () => null),
    patchMethod(Slot, 'updateMany', async () => ({ modifiedCount: 1 })),
    patchMethod(Person, 'findByIdAndUpdate', async (id, update) => {
      personUpdates.push({ id: String(id), update })
      return null
    })
  ]

  try {
    const result = await schedulingService.confirmSlotForTpi(tpiId, newSlotId)

    assert.equal(result.success, true)
    assert.equal(personUpdates.length, 3)
    assert.ok(personUpdates.every(entry => !entry.update.$inc))
    assert.ok(personUpdates.every(entry => entry.update.$set?.['stats.lastTpiDate'] === slot.date))
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('confirmSlotForTpi refuse une salle incompatible avec la classe du TPI', async () => {
  const tpiId = createObjectId()
  const slotId = createObjectId()

  const tpi = {
    _id: tpiId,
    classe: 'DEV4',
    candidat: createObjectId(),
    expert1: createObjectId(),
    expert2: createObjectId(),
    chefProjet: createObjectId(),
    proposedSlots: [],
    addHistory: async function addHistory() {
      return this
    }
  }

  const slot = {
    _id: slotId,
    date: new Date('2026-06-21T08:00:00.000Z'),
    period: 1,
    room: {
      site: 'ETML',
      name: 'M201'
    },
    save: async function save() {
      return this
    }
  }

  const restore = [
    patchMethod(TpiPlanning, 'findById', async () => tpi),
    patchMethod(Slot, 'findById', async () => slot),
    patchMethod(Slot, 'findOne', async () => null)
  ]

  try {
    const result = await schedulingService.confirmSlotForTpi(tpiId, slotId)

    assert.equal(result.success, false)
    assert.match(result.message, /Incompatibilité de salle/)
    assert.equal(result.conflicts[0].type, 'room_class_mismatch')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('confirmSlotForTpi refuse un créneau déjà assigné à un autre TPI', async () => {
  const tpiId = createObjectId()
  const otherTpiId = createObjectId()
  const slotId = createObjectId()

  const tpi = {
    _id: tpiId,
    classe: 'DEV4',
    candidat: createObjectId(),
    expert1: createObjectId(),
    expert2: createObjectId(),
    chefProjet: createObjectId(),
    proposedSlots: [],
    addHistory: async function addHistory() {
      return this
    }
  }

  const slot = {
    _id: slotId,
    assignedTpi: otherTpiId,
    date: new Date('2026-06-21T08:00:00.000Z'),
    period: 1,
    room: {
      site: 'ETML',
      name: 'A201'
    },
    save: async function save() {
      return this
    }
  }

  const restore = [
    patchMethod(TpiPlanning, 'findById', async () => tpi),
    patchMethod(Slot, 'findById', async () => slot),
    patchMethod(Slot, 'findOne', async () => null)
  ]

  try {
    const result = await schedulingService.confirmSlotForTpi(tpiId, slotId)

    assert.equal(result.success, false)
    assert.match(result.message, /Créneau déjà réservé/)
    assert.equal(result.conflicts[0].type, 'room_overlap')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})
