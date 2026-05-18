const test = require('node:test')
const assert = require('node:assert/strict')

const PlanningConfig = require('../models/coordinationConfigModel')
const PublicationVersion = require('../models/publicationVersionModel')
const {
  enrichLegacyTpisWithDerivedDates
} = require('../services/legacyTpiDateEnrichmentService')

test('enrichLegacyTpisWithDerivedDates falls back when optional context queries fail', async () => {
  const originalPlanningFindOne = PlanningConfig.findOne
  const originalPublicationFindOne = PublicationVersion.findOne
  const originalWarn = console.warn
  const warnings = []

  PlanningConfig.findOne = () => ({
    lean: async () => {
      throw new Error('planification timeout')
    }
  })

  PublicationVersion.findOne = () => ({
    lean: async () => {
      throw new Error('publication timeout')
    }
  })

  console.warn = (...args) => {
    warnings.push(args.join(' '))
  }

  try {
    const [enrichedTpi] = await enrichLegacyTpisWithDerivedDates(2026, [{
      refTpi: '042',
      classe: 'CFC',
      dates: {},
      lieu: {}
    }], {
      planningConfig: PlanningConfig.findOne(),
      publicationVersion: PublicationVersion.findOne()
    })

    assert.equal(enrichedTpi.refTpi, '042')
    assert.deepEqual(enrichedTpi.dates, {})
    assert.deepEqual(enrichedTpi.lieu, {})
    assert.equal(warnings.length, 2)
    assert.match(warnings[0], /configuration de planification/i)
    assert.match(warnings[1], /publication active des défenses/i)
  } finally {
    PlanningConfig.findOne = originalPlanningFindOne
    PublicationVersion.findOne = originalPublicationFindOne
    console.warn = originalWarn
  }
})

test('enrichLegacyTpisWithDerivedDates does not overwrite explicit GestionTPI planning fields', async () => {
  const [enrichedTpi] = await enrichLegacyTpisWithDerivedDates(2026, [{
    refTpi: '042',
    classe: 'CFC',
    salle: '',
    dates: {
      soutenance: null
    },
    lieu: {
      site: ''
    }
  }], {
    planningConfig: { classTypes: [] },
    publicationVersion: {
      rooms: [{
        date: '2026-06-10',
        name: 'VENNES 51',
        site: 'Vennes',
        tpiDatas: [{ refTpi: '042' }]
      }]
    }
  })

  assert.equal(enrichedTpi.salle, '')
  assert.equal(enrichedTpi.dates.soutenance, null)
  assert.equal(enrichedTpi.lieu.site, '')
})

test('enrichLegacyTpisWithDerivedDates backfills missing planning fields from active publication', async () => {
  const [enrichedTpi] = await enrichLegacyTpisWithDerivedDates(2026, [{
    refTpi: '042',
    classe: 'CFC',
    dates: {},
    lieu: {}
  }], {
    planningConfig: { classTypes: [] },
    publicationVersion: {
      rooms: [{
        date: '2026-06-10',
        name: 'VENNES 51',
        site: 'Vennes',
        tpiDatas: [{ refTpi: '042' }]
      }]
    }
  })

  assert.equal(enrichedTpi.salle, 'VENNES 51')
  assert.equal(enrichedTpi.dates.soutenance.toISOString().slice(0, 10), '2026-06-10')
  assert.equal(enrichedTpi.lieu.site, 'Vennes')
})
