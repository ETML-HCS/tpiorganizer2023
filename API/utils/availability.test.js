const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildDefaultAvailabilityFromPresences
} = require('./availability')

test('buildDefaultAvailabilityFromPresences converts imported presences into person schema format', () => {
  const result = buildDefaultAvailabilityFromPresences({
    '2026-06-01': { matin: true, 'apres-midi': false },
    '2026-06-08': { matin: false, 'apres-midi': true },
    '2026-06-02': { matin: true, 'apres-midi': true }
  })

  assert.deepEqual(result, [
    { dayOfWeek: 1, periods: [1, 2] },
    { dayOfWeek: 2, periods: [1, 2] }
  ])
})