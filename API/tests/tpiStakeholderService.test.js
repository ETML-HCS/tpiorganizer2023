const test = require('node:test')
const assert = require('node:assert/strict')

const {
  collectLegacyTpiStakeholders,
  linkLegacyTpiStakeholders,
  resolveStakeholderPerson,
  validateLegacyTpiStakeholders
} = require('../services/tpiStakeholderService')

const people = [
  {
    _id: 'candidate-2026',
    firstName: 'Alice',
    lastName: 'Martin',
    roles: ['candidat'],
    candidateYears: [2026],
    isActive: true
  },
  {
    _id: 'expert-1',
    firstName: 'Bob',
    lastName: 'Expert',
    roles: ['expert'],
    isActive: true
  },
  {
    _id: 'expert-2',
    firstName: 'Carla',
    lastName: 'Expert',
    roles: ['expert'],
    isActive: true
  },
  {
    _id: 'project-lead',
    firstName: 'Diane',
    lastName: 'Boss',
    roles: ['chef_projet'],
    isActive: true
  }
]

test('collectLegacyTpiStakeholders normalizes legacy and coordination-shaped TPI relations', () => {
  const stakeholders = collectLegacyTpiStakeholders({
    candidat: 'Alice Martin',
    experts: {
      1: 'Bob Expert'
    },
    expert2: 'Carla Expert',
    chefProjet: 'Diane Boss'
  })

  assert.deepEqual(
    stakeholders.map(({ role, label, idName, name }) => ({ role, label, idName, name })),
    [
      { role: 'candidat', label: 'candidat', idName: 'candidatPersonId', name: 'Alice Martin' },
      { role: 'expert1', label: 'expert1', idName: 'expert1PersonId', name: 'Bob Expert' },
      { role: 'expert2', label: 'expert2', idName: 'expert2PersonId', name: 'Carla Expert' },
      { role: 'chef_projet', label: 'chef_projet', idName: 'bossPersonId', name: 'Diane Boss' }
    ]
  )
})

test('validateLegacyTpiStakeholders links every required relation by role and year', () => {
  const validation = validateLegacyTpiStakeholders(
    {
      candidat: 'Alice Martin',
      experts: {
        1: 'Bob Expert',
        2: 'Carla Expert'
      },
      boss: 'Diane Boss'
    },
    {
      people,
      year: 2026,
      requireResolved: true
    }
  )

  assert.equal(validation.isComplete, true)
  assert.equal(validation.isValidated, true)
  assert.deepEqual(validation.missingRoles, [])
  assert.deepEqual(validation.unresolvedRoles, [])
  assert.deepEqual(validation.linkedPersonIds, {
    candidatPersonId: 'candidate-2026',
    expert1PersonId: 'expert-1',
    expert2PersonId: 'expert-2',
    bossPersonId: 'project-lead'
  })
})

test('validateLegacyTpiStakeholders rejects missing placeholders and wrong-role matches', () => {
  const validation = validateLegacyTpiStakeholders(
    {
      candidat: 'Alice Martin',
      experts: {
        1: 'Diane Boss',
        2: 'null'
      },
      boss: 'Bob Expert'
    },
    {
      people,
      year: 2026,
      requireResolved: true
    }
  )

  assert.equal(validation.isComplete, false)
  assert.equal(validation.isValidated, false)
  assert.deepEqual(validation.missingRoles, ['expert2'])
  assert.deepEqual(validation.unresolvedRoles.sort(), ['chef_projet', 'expert1'])
})

test('resolveStakeholderPerson rejects a candidate outside the requested year', () => {
  const resolved = resolveStakeholderPerson(
    {
      role: 'candidat',
      label: 'candidat',
      name: 'Alice Martin',
      personId: ''
    },
    people,
    { year: 2027 }
  )

  assert.equal(resolved.person, null)
})

test('linkLegacyTpiStakeholders preserves existing links and fills missing ones', () => {
  const { tpi, validation } = linkLegacyTpiStakeholders(
    {
      candidat: 'Alice Martin',
      experts: {
        1: 'Bob Expert',
        2: 'Carla Expert'
      },
      boss: 'Diane Boss',
      expert1PersonId: 'manual-expert'
    },
    people,
    { year: 2026 }
  )

  assert.equal(validation.isValidated, true)
  assert.equal(tpi.expert1PersonId, 'manual-expert')
  assert.equal(tpi.expert2PersonId, 'expert-2')
  assert.equal(tpi.bossPersonId, 'project-lead')
})
