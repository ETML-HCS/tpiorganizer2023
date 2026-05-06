const test = require('node:test')
const assert = require('node:assert/strict')

const {
  REGISTRY_ROLES,
  ROLE_RESPONSIBILITIES,
  STAKEHOLDER_IMPORT_COLUMN_MAPPINGS,
  TPI_STAKEHOLDER_RELATIONS,
  TPI_STAKEHOLDER_ROLE_LABELS,
  VOTING_STAKEHOLDER_ROLES,
  formatTpiStakeholderRoleLabel,
  getStakeholderRelation,
  mapStakeholderRoleToRegistryRole
} = require('../modules/stakeholders/stakeholderDefinitions')

test('stakeholder definitions expose the canonical registry roles only', () => {
  assert.deepEqual(REGISTRY_ROLES, ['candidat', 'expert', 'chef_projet', 'admin'])
  assert.ok(ROLE_RESPONSIBILITIES.expert.some((entry) => entry.includes('Expert 1')))
})

test('stakeholder definitions normalize legacy relation names to registry roles', () => {
  assert.equal(mapStakeholderRoleToRegistryRole('expert1'), 'expert')
  assert.equal(mapStakeholderRoleToRegistryRole('expert2'), 'expert')
  assert.equal(mapStakeholderRoleToRegistryRole('boss'), 'chef_projet')
  assert.equal(mapStakeholderRoleToRegistryRole('responsable'), 'chef_projet')
  assert.equal(mapStakeholderRoleToRegistryRole('formateur'), '')
})

test('stakeholder definitions keep the required TPI relations explicit and shared with imports', () => {
  assert.deepEqual(
    TPI_STAKEHOLDER_RELATIONS.map((relation) => relation.key),
    ['candidat', 'expert1', 'expert2', 'chef_projet']
  )
  assert.deepEqual(TPI_STAKEHOLDER_ROLE_LABELS, {
    candidat: 'Candidat',
    expert1: 'Expert 1',
    expert2: 'Expert 2',
    chef_projet: 'Chef de projet'
  })
  assert.deepEqual(VOTING_STAKEHOLDER_ROLES, ['expert1', 'expert2', 'chef_projet'])
  assert.equal(getStakeholderRelation('chef_projet').planningField, 'chefProjet')
  assert.equal(getStakeholderRelation('chef_projet').legacyIdField, 'bossPersonId')
  assert.equal(getStakeholderRelation('expert 1').key, 'expert1')
  assert.equal(STAKEHOLDER_IMPORT_COLUMN_MAPPINGS.expertmail, 'email')
})

test('stakeholder definitions format TPI relation labels from the shared catalog', () => {
  assert.equal(formatTpiStakeholderRoleLabel('expert_1'), 'Expert 1')
  assert.equal(formatTpiStakeholderRoleLabel('expert 2'), 'Expert 2')
  assert.equal(formatTpiStakeholderRoleLabel('boss'), 'Chef de projet')
  assert.equal(formatTpiStakeholderRoleLabel('expert'), 'Expert')
  assert.equal(formatTpiStakeholderRoleLabel('', 'Role'), 'Role')
})

test('stakeholder relations resolve names from the supported legacy and coordination shapes', () => {
  const tpi = {
    candidat: 'Alice Candidate',
    experts: {
      1: 'Bob Expert'
    },
    expert2: 'Carla Expert',
    boss: 'Diane Boss'
  }

  assert.deepEqual(
    TPI_STAKEHOLDER_RELATIONS.map((relation) => relation.getName(tpi)),
    ['Alice Candidate', 'Bob Expert', 'Carla Expert', 'Diane Boss']
  )
})
