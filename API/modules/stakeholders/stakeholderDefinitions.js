const stakeholderDefinitions = require('../../../shared/stakeholderDefinitions.json')

const REGISTRY_ROLES = Object.freeze([...stakeholderDefinitions.registryRoles])
const REGISTRY_ROLE_SET = new Set(REGISTRY_ROLES)
const ROLE_LABELS = Object.freeze({ ...stakeholderDefinitions.roleLabels })
const ROLE_RESPONSIBILITIES = Object.freeze({ ...stakeholderDefinitions.roleResponsibilities })
const STAKEHOLDER_IMPORT_COLUMN_MAPPINGS = Object.freeze({
  ...stakeholderDefinitions.importColumnMappings
})

function normalizeRoleName(role = '') {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[ -]+/g, '_')
}

function readPath(source = {}, path = '') {
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((value, segment) => (value == null ? undefined : value[segment]), source)
}

function createRelation(definition = {}) {
  const relation = {
    key: definition.key,
    label: definition.label || definition.key,
    displayLabel: definition.displayLabel || definition.label || definition.key,
    registryRole: definition.registryRole,
    planningField: definition.planningField,
    slotAssignmentField: definition.slotAssignmentField,
    legacyIdField: definition.legacyIdField,
    responsibility: definition.responsibility || '',
    aliases: Object.freeze([...(definition.aliases || [])]),
    getName(tpi = {}) {
      for (const path of definition.legacyNamePaths || []) {
        const value = readPath(tpi, path)

        if (value !== undefined && value !== null && String(value).trim()) {
          return value
        }
      }

      return ''
    }
  }

  return Object.freeze(relation)
}

const TPI_STAKEHOLDER_RELATIONS = Object.freeze(
  stakeholderDefinitions.tpiRelations.map(createRelation)
)

const TPI_STAKEHOLDER_RELATION_BY_KEY = Object.freeze(
  Object.fromEntries(TPI_STAKEHOLDER_RELATIONS.flatMap((relation) => [
    [normalizeRoleName(relation.key), relation],
    ...relation.aliases.map((alias) => [normalizeRoleName(alias), relation])
  ]))
)

const TPI_STAKEHOLDER_ROLE_LABELS = Object.freeze(
  Object.fromEntries(
    TPI_STAKEHOLDER_RELATIONS.map((relation) => [relation.key, relation.displayLabel])
  )
)

const VOTING_STAKEHOLDER_ROLES = Object.freeze([...stakeholderDefinitions.votingStakeholderRoles])

const ROLE_ALIAS_TO_REGISTRY_ROLE = new Map()
for (const role of REGISTRY_ROLES) {
  ROLE_ALIAS_TO_REGISTRY_ROLE.set(normalizeRoleName(role), role)
}

for (const [role, aliases] of Object.entries(stakeholderDefinitions.roleAliases || {})) {
  if (!REGISTRY_ROLE_SET.has(role)) {
    continue
  }

  for (const alias of aliases || []) {
    ROLE_ALIAS_TO_REGISTRY_ROLE.set(normalizeRoleName(alias), role)
  }
}

function mapStakeholderRoleToRegistryRole(role = '') {
  return ROLE_ALIAS_TO_REGISTRY_ROLE.get(normalizeRoleName(role)) || ''
}

function isRegistryRole(role = '') {
  return REGISTRY_ROLE_SET.has(role)
}

function getStakeholderRelation(role = '') {
  return TPI_STAKEHOLDER_RELATION_BY_KEY[normalizeRoleName(role)] || null
}

function formatTpiStakeholderRoleLabel(role = '', fallback = '') {
  const relation = getStakeholderRelation(role)
  if (relation) {
    return relation.displayLabel
  }

  const registryRole = mapStakeholderRoleToRegistryRole(role)
  if (registryRole) {
    return ROLE_LABELS[registryRole] || registryRole
  }

  return String(role || '').trim() || fallback
}

module.exports = {
  REGISTRY_ROLES,
  REGISTRY_ROLE_SET,
  ROLE_LABELS,
  ROLE_RESPONSIBILITIES,
  STAKEHOLDER_IMPORT_COLUMN_MAPPINGS,
  TPI_STAKEHOLDER_RELATIONS,
  TPI_STAKEHOLDER_RELATION_BY_KEY,
  TPI_STAKEHOLDER_ROLE_LABELS,
  VOTING_STAKEHOLDER_ROLES,
  formatTpiStakeholderRoleLabel,
  getStakeholderRelation,
  isRegistryRole,
  mapStakeholderRoleToRegistryRole
}
