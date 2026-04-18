const test = require('node:test')
const assert = require('node:assert/strict')

const {
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
