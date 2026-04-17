const test = require('node:test')
const assert = require('node:assert/strict')

const {
  filterPlanifiableTpis,
  isExternalPlanningSite,
  normalizeSiteValue
} = require('../services/tpiPlanningVisibility')

test('normalizeSiteValue removes punctuation and accents', async () => {
  assert.equal(normalizeSiteValue('Hors-ÉTML '), 'horsetml')
})

test('isExternalPlanningSite detects hors-etml variants', async () => {
  assert.equal(isExternalPlanningSite('hors-etml'), true)
  assert.equal(isExternalPlanningSite('Hors ETML'), true)
  assert.equal(isExternalPlanningSite('ETML'), false)
})

test('filterPlanifiableTpis removes external planning entries', async () => {
  const result = filterPlanifiableTpis([
    { reference: 'TPI-1', site: 'ETML' },
    { reference: 'TPI-2', site: 'hors-etml' },
    { reference: 'TPI-3', site: 'CFPV' }
  ])

  assert.deepEqual(result.map((tpi) => tpi.reference), ['TPI-1', 'TPI-3'])
})
