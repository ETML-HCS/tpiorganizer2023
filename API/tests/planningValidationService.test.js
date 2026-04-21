const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildLegacyConsistencyIssues,
  buildUnplannedTpiIssues,
  buildValidationIssues
} = require('../services/planningValidationService')

function buildPerson(id, firstName, lastName) {
  return { _id: id, firstName, lastName }
}

test('buildValidationIssues reports a person overlap with explicit message', () => {
  const person = buildPerson('person-1', 'Ada', 'Lovelace')

  const entries = [
    {
      reference: 'TPI-001',
      slot: {
        dateKey: '2026-06-10',
        period: 1,
        room: { site: 'ETML', name: 'A101' }
      },
      participants: [
        { role: 'expert1', personId: person._id, fullName: 'Ada Lovelace' }
      ]
    },
    {
      reference: 'TPI-002',
      slot: {
        dateKey: '2026-06-10',
        period: 1,
        room: { site: 'CFPV', name: 'B201' }
      },
      participants: [
        { role: 'chef_projet', personId: person._id, fullName: 'Ada Lovelace' }
      ]
    }
  ]

  const result = buildValidationIssues(entries, [])

  assert.equal(result.issueCount, 1)
  assert.equal(result.issues[0].type, 'person_overlap')
  assert.match(result.issues[0].message, /Ada Lovelace/)
  assert.match(result.issues[0].message, /plusieurs TPI/)
})

test('buildValidationIssues reports a sequence overflow after 4 consecutive TPI', () => {
  const person = buildPerson('person-2', 'Grace', 'Hopper')

  const slots = Array.from({ length: 5 }, (_, index) => ({
    date: '2026-06-11',
    period: index + 1,
    status: 'confirmed',
    room: { site: 'ETML', name: `A10${index + 1}` },
    assignedTpi: {
      reference: `TPI-10${index + 1}`
    },
    assignments: {
      expert1: person
    }
  }))

  const result = buildValidationIssues([], slots)

  assert.equal(result.issueCount, 1)
  assert.equal(result.issues[0].type, 'consecutive_limit')
  assert.equal(result.issues[0].consecutiveCount, 5)
  assert.match(result.issues[0].message, /5 TPI consécutifs/)
  assert.ok(result.issues[0].slotLabels.length >= 5)
  assert.deepEqual(result.issues[0].references, [
    'TPI-101',
    'TPI-102',
    'TPI-103',
    'TPI-104',
    'TPI-105'
  ])
})

test('buildValidationIssues returns no issue when planning is valid', () => {
  const person = buildPerson('person-3', 'Linus', 'Torvalds')

  const entries = [
    {
      reference: 'TPI-010',
      slot: {
        dateKey: '2026-06-12',
        period: 1,
        room: { site: 'ETML', name: 'A101' }
      },
      participants: [
        { role: 'candidat', personId: person._id, fullName: 'Linus Torvalds' }
      ]
    }
  ]

  const slots = [
    {
      date: '2026-06-12',
      period: 1,
      status: 'confirmed',
      room: { site: 'ETML', name: 'A101' },
      assignments: { candidat: person }
    },
    {
      date: '2026-06-12',
      period: 2,
      status: 'available',
      room: { site: 'ETML', name: 'A101' },
      assignments: {}
    }
  ]

  const result = buildValidationIssues(entries, slots)

  assert.equal(result.issueCount, 0)
  assert.equal(result.issues.length, 0)
  assert.equal(result.hardConflictSummary.hasHardConflicts, false)
})

test('buildValidationIssues reports a room class mismatch', () => {
  const entries = [
    {
      reference: 'TPI-020',
      classe: 'DEV4',
      slot: {
        dateKey: '2026-06-13',
        period: 1,
        room: { site: 'ETML', name: 'M101' }
      },
      participants: []
    }
  ]

  const result = buildValidationIssues(entries, [])

  assert.equal(result.issueCount, 1)
  assert.equal(result.classMismatchCount, 1)
  assert.equal(result.issues[0].type, 'room_class_mismatch')
  assert.match(result.issues[0].message, /salle MATU/)
})

test('buildUnplannedTpiIssues reports workflow TPI without any slot', () => {
  const result = buildUnplannedTpiIssues([
    {
      _id: 'tpi-1',
      reference: 'TPI-2026-001',
      status: 'draft',
      proposedSlots: [],
      confirmedSlot: null
    }
  ])

  assert.equal(result.length, 1)
  assert.equal(result[0].type, 'unplanned_tpi')
  assert.match(result[0].message, /aucun créneau proposé ou confirmé/)
  assert.equal(result[0].reason, "La planification automatique n'a pas encore traite cette fiche.")
})

test('buildUnplannedTpiIssues exposes the stored manual reason when a TPI is manual_required', () => {
  const result = buildUnplannedTpiIssues([
    {
      _id: 'tpi-2',
      reference: 'TPI-2026-010',
      status: 'manual_required',
      proposedSlots: [],
      confirmedSlot: null,
      conflicts: [
        {
          type: 'no_common_slot',
          description: 'Aucune date de soutenance configuree pour cette classe.'
        }
      ]
    }
  ])

  assert.equal(result.length, 1)
  assert.equal(result[0].type, 'unplanned_tpi')
  assert.equal(result[0].reason, 'Aucune date de soutenance configuree pour cette classe.')
  assert.match(result[0].message, /Raison: Aucune date de soutenance configuree pour cette classe\./)
})

test('buildLegacyConsistencyIssues reports missing stakeholders from legacy catalog', () => {
  const result = buildLegacyConsistencyIssues({
    year: 2026,
    legacyTpis: [
      {
        refTpi: '2246',
        candidat: 'Alice Example',
        experts: { 1: 'Expert 1', 2: '' },
        boss: 'Chef Projet'
      }
    ],
    workflowTpis: []
  })

  assert.equal(result.length, 1)
  assert.equal(result[0].type, 'legacy_tpi_missing_stakeholders')
  assert.deepEqual(result[0].missingStakeholders, ['expert2'])
})

test('buildLegacyConsistencyIssues reports missing workflow import for legacy TPI', () => {
  const result = buildLegacyConsistencyIssues({
    year: 2026,
    legacyTpis: [
      {
        refTpi: '2247',
        candidat: 'Alice Example',
        candidatPersonId: 'person-candidate',
        experts: { 1: 'Expert 1', 2: 'Expert 2' },
        expert1PersonId: 'person-expert-1',
        expert2PersonId: 'person-expert-2',
        boss: 'Chef Projet',
        bossPersonId: 'person-boss'
      }
    ],
    workflowTpis: []
  })

  assert.equal(result.length, 1)
  assert.equal(result[0].type, 'legacy_tpi_not_imported')
  assert.match(result[0].message, /workflow de planification/)
})

test('buildLegacyConsistencyIssues reports unresolved stakeholders that must be confirmed in Parties prenantes', () => {
  const result = buildLegacyConsistencyIssues({
    year: 2026,
    legacyTpis: [
      {
        refTpi: '2248',
        candidat: 'Alice Example',
        experts: { 1: 'Expert 1', 2: 'Expert 2' },
        boss: 'Chef Projet'
      }
    ],
    workflowTpis: [],
    people: [
      {
        _id: 'person-candidate',
        firstName: 'Alice',
        lastName: 'Example',
        roles: ['candidat'],
        candidateYears: [2026],
        isActive: true
      },
      {
        _id: 'person-expert-1',
        firstName: 'Expert',
        lastName: '1',
        roles: ['expert'],
        isActive: true
      }
    ]
  })

  assert.equal(result.length, 1)
  assert.equal(result[0].type, 'legacy_tpi_unresolved_stakeholders')
  assert.deepEqual(result[0].unresolvedStakeholders, ['expert2', 'chef_projet'])
  assert.match(result[0].message, /Parties prenantes/)
})

test('buildLegacyConsistencyIssues ignores legacy TPI outside configured planning sites', () => {
  const result = buildLegacyConsistencyIssues({
    year: 2026,
    legacyTpis: [
      {
        refTpi: '3001',
        site: 'CFPV',
        candidat: 'Alice Example',
        experts: { 1: '', 2: '' },
        boss: ''
      }
    ],
    workflowTpis: [],
    planningConfig: {
      siteConfigs: [
        { siteCode: 'ETML', active: true }
      ]
    }
  })

  assert.deepEqual(result, [])
})
