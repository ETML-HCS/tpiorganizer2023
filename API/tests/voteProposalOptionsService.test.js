const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildConfiguredSlotProposalOptions,
  buildMissingConfiguredWindowSlotDocuments,
  buildSlotQueueKey,
  buildVoteProposalContext,
  filterSlotDocumentsForVoteProposal
} = require('../services/voteProposalOptionsService')

test('buildVoteProposalContext retient les dates standard pour une classe non MATU', () => {
  const context = buildVoteProposalContext(
    { classe: 'CID4A' },
    {
      classTypes: [
        { code: 'CFC', prefix: 'C', label: 'CFC' },
        { code: 'MATU', prefix: 'M', label: 'MATU' }
      ],
      soutenanceDates: [
        { date: '2026-06-10', classes: ['CFC', 'C'] },
        { date: '2026-06-11', classes: ['MATU', 'M'], min: true },
        { date: '2026-06-12', classes: ['CFC', 'C'], special: true }
      ]
    }
  )

  assert.equal(context.candidateClass, 'CID4A')
  assert.equal(context.isMatu, false)
  assert.deepEqual(context.allowedDateKeys, ['2026-06-10'])
  assert.equal(context.source, 'planning_config')
})

test('buildVoteProposalContext retient les dates MATU pour une classe MATU', () => {
  const context = buildVoteProposalContext(
    { classe: 'MID3A' },
    {
      classTypes: [
        { code: 'CFC', prefix: 'C', label: 'CFC' },
        { code: 'MATU', prefix: 'M', label: 'MATU' }
      ],
      soutenanceDates: [
        { date: '2026-06-10', classes: ['CFC', 'C'] },
        { date: '2026-06-11', classes: ['MATU', 'M'], min: true }
      ]
    }
  )

  assert.equal(context.isMatu, true)
  assert.deepEqual(context.allowedDateKeys, ['2026-06-11'])
})

test('buildVoteProposalContext lit les dates portées par les types de classe', () => {
  const context = buildVoteProposalContext(
    { classe: 'FID2' },
    {
      classTypes: [
        {
          code: 'FPA',
          prefix: 'F',
          label: 'FPA',
          soutenanceDates: [
            { date: '2026-06-10' },
            { date: '2026-06-11' }
          ]
        },
        {
          code: 'MATU',
          prefix: 'M',
          label: 'MATU',
          soutenanceDates: [{ date: '2026-06-03' }]
        }
      ]
    }
  )

  assert.equal(context.candidateClassLabel, 'FPA')
  assert.deepEqual(context.allowedDateKeys, ['2026-06-10', '2026-06-11'])
  assert.equal(context.source, 'planning_config')
})

test('filterSlotDocumentsForVoteProposal limite les créneaux aux dates autorisées', () => {
  const filteredSlots = filterSlotDocumentsForVoteProposal(
    [
      { _id: 'slot-1', date: '2026-06-10T08:00:00.000Z' },
      { _id: 'slot-2', date: '2026-06-11T08:00:00.000Z' }
    ],
    {
      allowedDateKeys: ['2026-06-11']
    }
  )

  assert.deepEqual(filteredSlots.map((slot) => slot._id), ['slot-2'])
})

test('buildMissingConfiguredWindowSlotDocuments complète les demi-journées manquantes sur les dates de défense', () => {
  const missingSlots = buildMissingConfiguredWindowSlotDocuments(
    [
      {
        _id: 'slot-morning',
        year: 2026,
        date: '2026-06-10T08:00:00.000Z',
        period: 1,
        startTime: '08:00',
        endTime: '09:00',
        status: 'proposed',
        room: { name: 'A01', site: 'VENNES', capacity: 1 }
      },
      {
        _id: 'slot-outside-defense',
        year: 2026,
        date: '2026-06-11T08:00:00.000Z',
        period: 1,
        startTime: '08:00',
        endTime: '09:00',
        status: 'proposed',
        room: { name: 'A01', site: 'VENNES', capacity: 1 }
      }
    ],
    {
      proposalContext: { allowedDateKeys: ['2026-06-10'] },
      planningConfig: {
        year: 2026,
        siteConfigs: [
          {
            siteCode: 'VENNES',
            firstTpiStartTime: '08:00',
            tpiTimeMinutes: 60,
            breaklineMinutes: 240,
            numSlots: 2
          }
        ]
      },
      tpi: { year: 2026, site: 'VENNES' }
    }
  )

  assert.equal(missingSlots.length, 1)
  assert.equal(missingSlots[0].date.toISOString().slice(0, 10), '2026-06-10')
  assert.equal(missingSlots[0].period, 2)
  assert.equal(missingSlots[0].startTime, '13:00')
  assert.equal(missingSlots[0].room.name, 'A01')
  assert.equal(missingSlots[0].status, 'available')
})

test('buildMissingConfiguredWindowSlotDocuments ne considère pas un créneau confirmé comme une option disponible', () => {
  const missingSlots = buildMissingConfiguredWindowSlotDocuments(
    [
      {
        _id: 'slot-morning',
        year: 2026,
        date: '2026-06-10T08:00:00.000Z',
        period: 1,
        startTime: '08:00',
        endTime: '09:00',
        status: 'proposed',
        room: { name: 'A01', site: 'VENNES', capacity: 1 }
      },
      {
        _id: 'slot-confirmed-afternoon',
        year: 2026,
        date: '2026-06-10T12:00:00.000Z',
        period: 3,
        startTime: '12:00',
        endTime: '13:00',
        status: 'confirmed',
        assignedTpi: 'other-tpi',
        room: { name: 'A01', site: 'VENNES', capacity: 1 }
      }
    ],
    {
      proposalContext: { allowedDateKeys: ['2026-06-10'] },
      planningConfig: {
        year: 2026,
        siteConfigs: [
          {
            siteCode: 'VENNES',
            firstTpiStartTime: '08:00',
            tpiTimeMinutes: 60,
            breaklineMinutes: 60,
            numSlots: 4
          }
        ]
      },
      tpi: { year: 2026, site: 'VENNES' }
    }
  )

  assert.deepEqual(missingSlots.map((slot) => slot.period), [2, 4])
})

test('buildConfiguredSlotProposalOptions regroupe les salles par fenêtre configurée', () => {
  const options = buildConfiguredSlotProposalOptions(
    [
      {
        _id: 'slot-occupied-a',
        date: '2026-06-10T08:00:00.000Z',
        period: 1,
        startTime: '8:00',
        endTime: '9:00',
        status: 'pending_votes',
        assignedTpi: 'other-tpi',
        room: { name: 'A01', site: 'VENNES' }
      },
      {
        _id: 'slot-occupied-b',
        date: '2026-06-10T08:00:00.000Z',
        period: 1,
        startTime: '8:00',
        endTime: '9:00',
        status: 'pending_votes',
        assignedTpi: 'other-tpi',
        room: { name: 'A02', site: 'VENNES' }
      },
      {
        _id: 'slot-morning-later',
        date: '2026-06-10T10:20:00.000Z',
        period: 3,
        startTime: '10:20',
        endTime: '11:20',
        status: 'available',
        room: { name: 'A03', site: 'VENNES' }
      },
      {
        _id: 'slot-afternoon',
        date: '2026-06-10T13:00:00.000Z',
        period: 5,
        startTime: '13:00',
        endTime: '14:00',
        status: 'pending_votes',
        assignedTpi: 'other-tpi',
        room: { name: 'A01', site: 'VENNES' }
      }
    ],
    {
      fixedSlotId: '',
      existingSlotIds: new Set(),
      proposalContext: { allowedDateKeys: ['2026-06-10'] },
      planningConfig: {
        siteConfigs: [
          {
            siteCode: 'VENNES',
            firstTpiStartTime: '08:00',
            tpiTimeMinutes: 60,
            breaklineMinutes: 10,
            numSlots: 8
          }
        ]
      },
      tpi: { site: 'VENNES' }
    }
  )

  assert.equal(options.length, 2)
  assert.equal(options[0].display.periodLabel, 'Matin')
  assert.equal(options[0].display.timeRangeLabel, '08:00 - 12:00')
  assert.equal(options[0].display.windowCapacity, 4)
  assert.equal(options[0].queueKey, '2026-06-10|AM|VENNES')
  assert.equal(options[1].display.periodLabel, 'Après-midi')
  assert.equal(options[1].display.windowCapacity, 4)
})

test('buildSlotQueueKey regroupe les créneaux par demi-journée', () => {
  assert.equal(
    buildSlotQueueKey({
      date: '2026-06-10T08:00:00.000Z',
      period: 1,
      startTime: '08:00',
      endTime: '09:00',
      room: { site: 'VENNES' }
    }),
    '2026-06-10|AM|VENNES'
  )
  assert.equal(
    buildSlotQueueKey({
      date: '2026-06-10T10:20:00.000Z',
      period: 3,
      startTime: '10:20',
      endTime: '11:20',
      room: { site: 'VENNES' }
    }),
    '2026-06-10|AM|VENNES'
  )
  assert.equal(
    buildSlotQueueKey({
      date: '2026-06-10T13:00:00.000Z',
      period: 5,
      startTime: '13:00',
      endTime: '14:00',
      room: { site: 'VENNES' }
    }),
    '2026-06-10|PM|VENNES'
  )
})
