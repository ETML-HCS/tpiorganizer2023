const test = require('node:test')
const assert = require('node:assert/strict')

const PlanningConfig = require('../models/planningConfigModel')
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
      throw new Error('planning timeout')
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
    assert.match(warnings[1], /publication active des soutenances/i)
  } finally {
    PlanningConfig.findOne = originalPlanningFindOne
    PublicationVersion.findOne = originalPublicationFindOne
    console.warn = originalWarn
  }
})
