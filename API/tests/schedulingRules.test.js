const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')

const schedulingService = require('../services/schedulingService')
const Slot = require('../models/slotModel')
const Person = require('../models/personModel')

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

function buildTimelineSlots(personId, options = {}) {
  const { totalPeriods = 6, occupiedPeriods = 4 } = options
  const date = new Date('2026-06-10T00:00:00.000Z')

  return Array.from({ length: totalPeriods }, (_, index) => {
    const period = index + 1
    const occupied = period <= occupiedPeriods

    return {
      _id: createObjectId(),
      date,
      period,
      room: { name: 'A101', site: 'ETML' },
      status: occupied ? 'confirmed' : 'available',
      assignments: occupied
        ? {
            expert1: personId
          }
        : {}
    }
  })
}

test('checkConsecutiveRule autorise une reprise après une pause d’un créneau', async () => {
  const personId = createObjectId()
  const timelineSlots = buildTimelineSlots(personId, { candidatePeriod: 6 })
  const candidateDate = new Date('2026-06-10T00:00:00.000Z')

  const restore = [
    patchMethod(Slot, 'find', (query) => {
      if (query?.year === 2026) {
        return {
          select: () => ({
            sort: () => timelineSlots
          })
        }
      }

      throw new Error(`Unexpected Slot.find query: ${JSON.stringify(query)}`)
    }),
    patchMethod(Person, 'findById', async () => ({ fullName: 'Expert Test' }))
  ]

  try {
    const result = await schedulingService.checkConsecutiveRule(
      [personId],
      candidateDate,
      6
    )

    assert.equal(result.valid, true)
    assert.equal(result.reason, '')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('checkConsecutiveRule bloque un 5e TPI consécutif', async () => {
  const personId = createObjectId()
  const timelineSlots = buildTimelineSlots(personId, { candidatePeriod: 5 })
  const candidateDate = new Date('2026-06-10T00:00:00.000Z')

  const restore = [
    patchMethod(Slot, 'find', (query) => {
      if (query?.year === 2026) {
        return {
          select: () => ({
            sort: () => timelineSlots
          })
        }
      }

      throw new Error(`Unexpected Slot.find query: ${JSON.stringify(query)}`)
    }),
    patchMethod(Person, 'findById', async () => ({ fullName: 'Expert Test' }))
  ]

  try {
    const result = await schedulingService.checkConsecutiveRule(
      [personId],
      candidateDate,
      5
    )

    assert.equal(result.valid, false)
    assert.match(result.reason, /pause d'un créneau/i)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('checkConsecutiveRule bloque selon une limite configurable', async () => {
  const personId = createObjectId()
  const timelineSlots = buildTimelineSlots(personId, {
    occupiedPeriods: 3,
    totalPeriods: 4
  })
  const candidateDate = new Date('2026-06-10T00:00:00.000Z')

  const restore = [
    patchMethod(Slot, 'find', (query) => {
      if (query?.year === 2026) {
        return {
          select: () => ({
            sort: () => timelineSlots
          })
        }
      }

      throw new Error(`Unexpected Slot.find query: ${JSON.stringify(query)}`)
    }),
    patchMethod(Person, 'findById', async () => ({ fullName: 'Expert Test' }))
  ]

  try {
    const result = await schedulingService.checkConsecutiveRule(
      [personId],
      candidateDate,
      4,
      { maxConsecutiveTpi: 3 }
    )

    assert.equal(result.valid, false)
    assert.match(result.reason, /4 TPI consécutifs/i)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('checkPersonAvailability considère les créneaux proposés comme occupés', async () => {
  const personId = createObjectId()
  const slotId = createObjectId()
  const person = {
    _id: personId,
    isAvailableOn: () => true
  }

  let capturedQuery = null
  const restore = [
    patchMethod(Slot, 'findOne', async (query) => {
      capturedQuery = query
      return null
    })
  ]

  try {
    const result = await schedulingService.checkPersonAvailability(
      person,
      new Date('2026-06-10T00:00:00.000Z'),
      1,
      slotId
    )

    assert.equal(result.available, true)
    assert.ok(capturedQuery)
    assert.deepEqual(capturedQuery.status.$in, ['confirmed', 'pending_votes', 'proposed'])
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})
