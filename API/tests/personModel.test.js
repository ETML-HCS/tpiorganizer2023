const test = require('node:test')
const assert = require('node:assert/strict')

const Person = require('../models/personModel')

function buildPerson(overrides = {}) {
  return new Person({
    firstName: 'Alice',
    lastName: 'Example',
    email: `alice.${Math.random().toString(36).slice(2)}@example.com`,
    roles: ['expert'],
    ...overrides
  })
}

test('person.isAvailableOn returns true when no availability constraints are defined', () => {
  const person = buildPerson({
    defaultAvailability: [],
    unavailableDates: []
  })

  assert.equal(person.isAvailableOn(new Date('2026-06-10T08:00:00.000Z'), 1), true)
  assert.equal(person.isAvailableOn(new Date('2026-06-11T08:00:00.000Z'), 4), true)
})

test('person.isAvailableOn keeps explicit default availability constraints when they exist', () => {
  const person = buildPerson({
    defaultAvailability: [
      { dayOfWeek: 3, periods: [1, 2] }
    ],
    unavailableDates: []
  })

  assert.equal(person.isAvailableOn(new Date('2026-06-10T08:00:00.000Z'), 1), true)
  assert.equal(person.isAvailableOn(new Date('2026-06-10T08:00:00.000Z'), 4), false)
})

test('person.isAvailableOn lets explicit unavailableDates override the implicit fallback', () => {
  const person = buildPerson({
    defaultAvailability: [],
    unavailableDates: [
      {
        date: new Date('2026-06-10T08:00:00.000Z'),
        allDay: true,
        periods: []
      }
    ]
  })

  assert.equal(person.isAvailableOn(new Date('2026-06-10T08:00:00.000Z'), 1), false)
  assert.equal(person.isAvailableOn(new Date('2026-06-11T08:00:00.000Z'), 1), true)
})
