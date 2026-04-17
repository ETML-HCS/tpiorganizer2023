const {
  personHasRole,
  resolveUniquePersonForRole
} = require('./personRegistryService')

const PLACEHOLDER_EMPTY_VALUES = new Set(['null', 'undefined'])

const LEGACY_TPI_STAKEHOLDER_FIELDS = Object.freeze([
  {
    role: 'candidat',
    label: 'candidat',
    idName: 'candidatPersonId',
    getName(tpi) {
      return tpi?.candidat
    }
  },
  {
    role: 'expert1',
    label: 'expert1',
    idName: 'expert1PersonId',
    getName(tpi) {
      return tpi?.experts?.['1'] ?? tpi?.experts?.[1] ?? tpi?.expert1
    }
  },
  {
    role: 'expert2',
    label: 'expert2',
    idName: 'expert2PersonId',
    getName(tpi) {
      return tpi?.experts?.['2'] ?? tpi?.experts?.[2] ?? tpi?.expert2
    }
  },
  {
    role: 'chef_projet',
    label: 'chef_projet',
    idName: 'bossPersonId',
    getName(tpi) {
      return tpi?.boss
    }
  }
])

function normalizeTextValue(value) {
  if (typeof value !== 'string') {
    return ''
  }

  const normalizedValue = value.trim()
  return PLACEHOLDER_EMPTY_VALUES.has(normalizedValue.toLowerCase())
    ? ''
    : normalizedValue
}

function normalizePersonId(value) {
  if (!value) {
    return ''
  }

  if (value?._id) {
    return String(value._id)
  }

  return normalizeTextValue(String(value))
}

function buildPeopleIndex(people = []) {
  return new Map(
    (Array.isArray(people) ? people : [])
      .filter(Boolean)
      .map((person) => [normalizePersonId(person), person])
      .filter(([personId]) => personId)
  )
}

function collectLegacyTpiStakeholders(tpi = {}) {
  return LEGACY_TPI_STAKEHOLDER_FIELDS.map((field) => ({
    ...field,
    name: normalizeTextValue(field.getName(tpi)),
    personId: normalizePersonId(tpi?.[field.idName])
  }))
}

function resolveStakeholderPerson(stakeholder, people = [], options = {}) {
  const peopleIndex = options.peopleIndex instanceof Map
    ? options.peopleIndex
    : buildPeopleIndex(people)
  const byId = stakeholder.personId ? peopleIndex.get(stakeholder.personId) || null : null

  if (byId && personHasRole(byId, stakeholder.role, options)) {
    return {
      person: byId,
      reason: 'matched_person_id'
    }
  }

  if (!stakeholder.name) {
    return {
      person: null,
      reason: stakeholder.personId ? 'person_id_not_found' : 'missing_identity'
    }
  }

  return resolveUniquePersonForRole(
    stakeholder.name,
    people,
    stakeholder.role,
    options
  )
}

function validateLegacyTpiStakeholders(tpi = {}, options = {}) {
  const people = Array.isArray(options.people) ? options.people : []
  const peopleIndex = options.peopleIndex instanceof Map
    ? options.peopleIndex
    : buildPeopleIndex(people)
  const stakeholders = collectLegacyTpiStakeholders(tpi)
  const missingRoles = []
  const unresolvedRoles = []
  const linkedPersonIds = {}

  for (const stakeholder of stakeholders) {
    if (!stakeholder.name && !stakeholder.personId) {
      missingRoles.push(stakeholder.label)
      continue
    }

    if (people.length === 0 && peopleIndex.size === 0) {
      if (!stakeholder.personId && options.requireResolved === true) {
        unresolvedRoles.push(stakeholder.label)
      }
      continue
    }

    const resolved = resolveStakeholderPerson(stakeholder, people, {
      ...options,
      peopleIndex
    })

    if (!resolved.person) {
      unresolvedRoles.push(stakeholder.label)
      continue
    }

    linkedPersonIds[stakeholder.idName] = normalizePersonId(resolved.person)
  }

  return {
    stakeholders,
    missingRoles,
    unresolvedRoles,
    linkedPersonIds,
    isComplete: missingRoles.length === 0,
    isValidated: missingRoles.length === 0 && unresolvedRoles.length === 0
  }
}

function linkLegacyTpiStakeholders(tpi = {}, people = [], options = {}) {
  const validation = validateLegacyTpiStakeholders(tpi, {
    ...options,
    people
  })

  const nextTpi = {
    ...tpi,
    experts:
      tpi?.experts && typeof tpi.experts === 'object'
        ? { ...tpi.experts }
        : {}
  }

  for (const [idName, personId] of Object.entries(validation.linkedPersonIds)) {
    if (!nextTpi[idName]) {
      nextTpi[idName] = personId
    }
  }

  return {
    tpi: nextTpi,
    validation
  }
}

module.exports = {
  LEGACY_TPI_STAKEHOLDER_FIELDS,
  collectLegacyTpiStakeholders,
  linkLegacyTpiStakeholders,
  normalizePersonId,
  resolveStakeholderPerson,
  validateLegacyTpiStakeholders
}
