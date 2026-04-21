const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildConfiguredPlanningSiteKeys,
  filterPlanifiableTpis,
  isConfiguredPlanningSite,
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

test('buildConfiguredPlanningSiteKeys keeps only active configured site codes', async () => {
  const siteKeys = buildConfiguredPlanningSiteKeys({
    siteConfigs: [
      { siteCode: 'ETML', label: 'Lausanne', active: true },
      { siteCode: 'CFPV', active: false },
      { label: 'Lausanne', active: true }
    ]
  })

  assert.equal(siteKeys.has('etml'), true)
  assert.equal(siteKeys.has('lausanne'), false)
  assert.equal(siteKeys.has('cfpv'), false)
})

test('isConfiguredPlanningSite uses siteCode as the planning perimeter', async () => {
  const planningConfig = {
    siteConfigs: [
      { siteCode: 'ETML', label: 'Lausanne', active: true }
    ]
  }

  assert.equal(isConfiguredPlanningSite('ETML', planningConfig), true)
  assert.equal(isConfiguredPlanningSite('Lausanne', planningConfig), false)
  assert.equal(isConfiguredPlanningSite('CFPV', planningConfig), false)
})

test('filterPlanifiableTpis keeps only configured sites when a site configuration is provided', async () => {
  const result = filterPlanifiableTpis([
    { reference: 'TPI-1', site: 'ETML' },
    { reference: 'TPI-2', site: 'hors-etml' },
    { reference: 'TPI-3', site: 'CFPV' }
  ], {
    siteConfigs: [
      { siteCode: 'ETML', active: true }
    ]
  })

  assert.deepEqual(result.map((tpi) => tpi.reference), ['TPI-1'])
})

test('filterPlanifiableTpis returns no TPI when no planning site is configured for the year', async () => {
  const result = filterPlanifiableTpis([
    { reference: 'TPI-1', site: 'ETML' },
    { reference: 'TPI-2', site: 'CFPV' }
  ], {
    siteConfigs: []
  })

  assert.deepEqual(result, [])
})

test('filterPlanifiableTpis prioritizes lieu.site over site when both are present', async () => {
  const result = filterPlanifiableTpis([
    { reference: 'TPI-1', site: 'CFPV', lieu: { site: 'ETML' } },
    { reference: 'TPI-2', site: 'ETML', lieu: { site: 'CFPV' } }
  ], {
    siteConfigs: [
      { siteCode: 'ETML', active: true }
    ]
  })

  assert.deepEqual(result.map((tpi) => tpi.reference), ['TPI-1'])
})
