const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildDefaultPlanningConfig,
  normalizeStoredConfig
} = require('../services/planningConfigService')

test('buildDefaultPlanningConfig expose une structure vide et alimente les sites du catalogue', () => {
  const config = buildDefaultPlanningConfig(2026, [
    {
      id: 'site-etml',
      code: 'ETML',
      label: 'ETML Sébeillon',
      planningColor: '#14532d',
      tpiColor: '#fee2e2',
      soutenanceColor: '#0f766e'
    }
  ])

  assert.equal(config.year, 2026)
  assert.equal(config.schemaVersion, 2)
  assert.deepEqual(
    config.classTypes.map((classType) => classType.code),
    ['CFC', 'FPA', 'MATU']
  )
  assert.deepEqual(config.soutenanceDates, [])
  assert.equal(config.siteConfigs.length, 1)
  assert.equal(config.siteConfigs[0].siteId, 'site-etml')
  assert.equal(config.siteConfigs[0].siteCode, 'ETML')
  assert.equal(config.siteConfigs[0].label, 'ETML Sébeillon')
  assert.equal(config.siteConfigs[0].planningColor, '#14532D')
  assert.equal(config.siteConfigs[0].tpiColor, '#FEE2E2')
  assert.equal(config.siteConfigs[0].soutenanceColor, '#0F766E')
  assert.equal(config.siteConfigs[0].breaklineMinutes, 10)
  assert.equal(config.siteConfigs[0].tpiTimeMinutes, 60)
  assert.equal(config.siteConfigs[0].firstTpiStartTime, '08:00')
  assert.equal(config.siteConfigs[0].numSlots, 8)
  assert.equal(config.siteConfigs[0].maxConsecutiveTpi, 4)
  assert.equal(config.siteConfigs[0].manualRoomTarget, null)
})

test('normalizeStoredConfig conserve les types de classe dynamiques et les parametres de site', () => {
  const config = normalizeStoredConfig(
    {
      year: 2026,
      schemaVersion: 4,
      classTypes: [
        {
          code: 'MATU',
          prefix: 'M',
          label: 'MATU',
          startDate: '2026-03-01',
          endDate: '2026-06-30',
          soutenanceDates: [
            { date: '2026-06-05', min: true },
            { date: '2026-06-06', special: true }
          ]
        },
        {
          code: 'CFC',
          prefix: 'C',
          label: 'CFC',
          startDate: '2026-01-10',
          endDate: '2026-05-30',
          soutenanceDates: [{ date: '2026-05-28' }]
        }
      ],
      siteConfigs: [
        {
          siteCode: 'ETML',
          breaklineMinutes: 15,
          tpiTimeMinutes: 90,
          firstTpiStartTime: '08:30',
          numSlots: 9,
          maxConsecutiveTpi: 3,
          manualRoomTarget: 4
        }
      ]
    },
    2026,
    undefined,
    [
      {
        id: 'site-etml',
        code: 'ETML',
        label: 'ETML Sébeillon',
          planningColor: '#14532d',
          tpiColor: '#fee2e2',
          soutenanceColor: '#0f766e'
      }
    ]
  )

  assert.equal(config.year, 2026)
  assert.equal(config.schemaVersion, 4)
  assert.deepEqual(
    config.classTypes.map((classType) => classType.code),
    ['CFC', 'FPA', 'MATU']
  )
  assert.equal(config.classTypes[0].code, 'CFC')
  assert.equal(config.classTypes[0].startDate, '2026-01-10')
  assert.equal(config.classTypes[0].soutenanceDates.length, 1)
  assert.equal(config.classTypes[2].code, 'MATU')
  assert.equal(config.classTypes[2].startDate, '2026-03-01')
  assert.equal(config.soutenanceDates.length, 3)
  assert.ok(config.soutenanceDates.some((entry) => entry.date === '2026-06-05' && entry.classes.includes('MATU')))
  assert.equal(config.siteConfigs.length, 1)
  assert.equal(config.siteConfigs[0].siteId, 'site-etml')
  assert.equal(config.siteConfigs[0].siteCode, 'ETML')
  assert.equal(config.siteConfigs[0].planningColor, '#14532D')
  assert.equal(config.siteConfigs[0].tpiColor, '#FEE2E2')
  assert.equal(config.siteConfigs[0].soutenanceColor, '#0F766E')
  assert.equal(config.siteConfigs[0].breaklineMinutes, 15)
  assert.equal(config.siteConfigs[0].tpiTimeMinutes, 90)
  assert.equal(config.siteConfigs[0].firstTpiStartTime, '08:30')
  assert.equal(config.siteConfigs[0].numSlots, 9)
  assert.equal(config.siteConfigs[0].maxConsecutiveTpi, 3)
  assert.equal(config.siteConfigs[0].manualRoomTarget, 4)
  assert.equal(config.siteConfigsByCode.ETML.numSlots, 9)
  assert.equal(config.siteConfigsByCode.ETML.maxConsecutiveTpi, 3)
})

test('normalizeStoredConfig supprime les types custom absents du payload explicite', () => {
  const config = normalizeStoredConfig(
    {
      year: 2026,
      classTypes: [
        {
          code: 'CFC',
          prefix: 'C',
          label: 'CFC'
        }
      ],
      siteConfigs: []
    },
    2026,
    {
      year: 2026,
      schemaVersion: 2,
      classTypes: [
        { code: 'CFC', prefix: 'C', label: 'CFC' },
        { code: 'TYPE1', prefix: 'T1', label: 'Type 1' }
      ],
      soutenanceDates: [],
      siteConfigs: []
    },
    []
  )

  assert.deepEqual(
    config.classTypes.map((classType) => classType.code),
    ['CFC', 'FPA', 'MATU']
  )
})

test('normalizeStoredConfig retire les configs de site hors catalogue', () => {
  const config = normalizeStoredConfig(
    {
      year: 2026,
      classTypes: [],
      siteConfigs: [
        {
          siteId: 'site-etml',
          siteCode: 'ETML',
          numSlots: 8
        },
        {
          siteId: 'site-cfpv',
          siteCode: 'CFPV',
          numSlots: 8
        }
      ]
    },
    2026,
    undefined,
    [
      {
        id: 'site-etml',
        code: 'ETML',
        label: 'ETML Sébeillon'
      }
    ]
  )

  assert.equal(config.siteConfigs.length, 1)
  assert.equal(config.siteConfigs[0].siteCode, 'ETML')
})
