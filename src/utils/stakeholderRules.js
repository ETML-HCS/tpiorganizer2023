import stakeholderDefinitions from '../../shared/stakeholderDefinitions.json'

const PLACEHOLDER_EMPTY_VALUES = new Set(['null', 'undefined'])

export const STAKEHOLDER_DEFINITIONS = Object.freeze(stakeholderDefinitions)

export const STAKEHOLDER_ROLES = Object.freeze([...stakeholderDefinitions.registryRoles])

export const TPI_RELATION_ROLES = Object.freeze(
  stakeholderDefinitions.tpiRelations.map((relation) => Object.freeze({
    key: relation.key,
    label: relation.displayLabel || relation.label,
    role: relation.registryRole,
    responsibility: relation.responsibility
  }))
)

export const TPI_RELATION_LABELS = Object.freeze(
  Object.fromEntries(
    stakeholderDefinitions.tpiRelations.map((relation) => [
      relation.key,
      relation.displayLabel || relation.label || relation.key
    ])
  )
)

export const VOTING_STAKEHOLDER_ROLES = Object.freeze([
  ...stakeholderDefinitions.votingStakeholderRoles
])

export const ROLE_OPTIONS = Object.freeze(
  STAKEHOLDER_ROLES.map((role) => Object.freeze({
    value: role,
    label: stakeholderDefinitions.roleLabels[role] || role,
    responsibilities: stakeholderDefinitions.roleResponsibilities[role] || []
  }))
)

export const ROLE_LABELS = Object.freeze(
  Object.fromEntries(ROLE_OPTIONS.map((role) => [role.value, role.label]))
)

export function normalizeWhitespace(value = '') {
  const normalizedValue = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()

  return PLACEHOLDER_EMPTY_VALUES.has(normalizedValue.toLowerCase())
    ? ''
    : normalizedValue
}

export function normalizeFold(value = '') {
  return normalizeWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function normalizeLookupKey(value = '') {
  return normalizeFold(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeRoleAliasKey(role = '') {
  return normalizeWhitespace(role).toLowerCase().replace(/[ -]+/g, '_')
}

const TPI_RELATION_ALIAS_MAP = new Map(
  stakeholderDefinitions.tpiRelations.flatMap((relation) => [
    [normalizeRoleAliasKey(relation.key), relation.key],
    ...((relation.aliases || []).map((alias) => [
      normalizeRoleAliasKey(alias),
      relation.key
    ]))
  ])
)

const ROLE_ALIAS_MAP = new Map(
  STAKEHOLDER_ROLES.flatMap((role) => [
    [normalizeRoleAliasKey(role), role],
    ...((stakeholderDefinitions.roleAliases[role] || []).map((alias) => [
      normalizeRoleAliasKey(alias),
      role
    ]))
  ])
)

export function normalizeTpiRelationRole(role = '') {
  return TPI_RELATION_ALIAS_MAP.get(normalizeRoleAliasKey(role)) || ''
}

export function getTpiRelationRoleLabel(role = '', fallback = '') {
  const relationRole = normalizeTpiRelationRole(role)
  if (relationRole) {
    return TPI_RELATION_LABELS[relationRole] || relationRole
  }

  const registryRole = normalizeStakeholderRole(role)
  if (registryRole) {
    return ROLE_LABELS[registryRole] || registryRole
  }

  return normalizeWhitespace(role) || fallback
}

export function getStakeholderRoleLabel(role = '') {
  const normalizedRole = normalizeStakeholderRole(role) || normalizeWhitespace(role)
  return ROLE_LABELS[normalizedRole] || 'Partie prenante'
}

export function normalizeStakeholderRole(role = '') {
  return ROLE_ALIAS_MAP.get(normalizeRoleAliasKey(role)) || ''
}

export function normalizeRoleList(roles = [], fallbackRoles = []) {
  const normalizedRoles = []

  for (const role of Array.isArray(roles) ? roles : [roles]) {
    const normalizedRole = normalizeStakeholderRole(role)

    if (normalizedRole && !normalizedRoles.includes(normalizedRole)) {
      normalizedRoles.push(normalizedRole)
    }
  }

  if (normalizedRoles.length > 0) {
    return normalizedRoles
  }

  return Array.isArray(fallbackRoles) ? fallbackRoles : [fallbackRoles].filter(Boolean)
}

export function normalizeCandidateYears(years = []) {
  return Array.from(
    new Set(
      (Array.isArray(years) ? years : [years])
        .map((year) => Number.parseInt(year, 10))
        .filter((year) => Number.isInteger(year))
    )
  ).sort((left, right) => left - right)
}

export function splitStakeholderName(value = '') {
  const parts = normalizeWhitespace(value).split(' ').filter(Boolean)

  if (parts.length === 0) {
    return {
      firstName: '',
      lastName: ''
    }
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: ''
    }
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1]
  }
}

export function formatPersonName(person = {}) {
  return [person?.firstName, person?.lastName]
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)
    .join(' ')
}

export function getPersonIdentityKey(person = {}) {
  return normalizeLookupKey(formatPersonName(person))
}

export function getPersonEmail(person = {}) {
  return normalizeWhitespace(person?.email).toLowerCase()
}

export function personHasStakeholderRole(person = {}, requiredRole = '', options = {}) {
  const role = normalizeStakeholderRole(requiredRole)

  if (!role) {
    return true
  }

  const personRoles = normalizeRoleList(person?.roles)
  if (!personRoles.includes(role)) {
    return false
  }

  if (role !== 'candidat') {
    return true
  }

  const requestedYear = Number.parseInt(options.year, 10)
  if (!Number.isInteger(requestedYear)) {
    return true
  }

  const candidateYears = normalizeCandidateYears(person?.candidateYears || [])
  return candidateYears.length === 0 || candidateYears.includes(requestedYear)
}

export function findMatchingStakeholder(people = [], { name = '', email = '', role = '', year = null } = {}) {
  const normalizedName = normalizeLookupKey(name)
  const normalizedEmail = normalizeWhitespace(email).toLowerCase()

  if (!normalizedName && !normalizedEmail) {
    return null
  }

  const matches = (Array.isArray(people) ? people : []).filter((person) => {
    if (!person || person.isActive === false || !personHasStakeholderRole(person, role, { year })) {
      return false
    }

    const nameMatches = normalizedName && getPersonIdentityKey(person) === normalizedName
    const emailMatches = normalizedEmail && getPersonEmail(person) === normalizedEmail

    return nameMatches || emailMatches
  })

  return matches.length === 1 ? matches[0] : null
}

export function doesPersonCoverStakeholderDraft(person = {}, draft = {}) {
  if (!person || person.isActive === false) {
    return false
  }

  if (getPersonIdentityKey(person) !== normalizeLookupKey(draft?.name)) {
    return false
  }

  if (!personHasStakeholderRole(person, draft?.role, { year: draft?.year })) {
    return false
  }

  if (!getPersonEmail(person)) {
    return false
  }

  return true
}

export function findPersonForStakeholderDraft(people = [], draft = {}) {
  return (Array.isArray(people) ? people : []).find((person) =>
    doesPersonCoverStakeholderDraft(person, draft)
  ) || null
}

export function getStakeholderDraftStatus(draft = {}, people = []) {
  const matchingPerson = findPersonForStakeholderDraft(people, draft)

  if (matchingPerson) {
    return {
      type: 'resolved',
      label: 'Couvert',
      person: matchingPerson,
      needs: []
    }
  }

  const partialPerson = findMatchingStakeholder(people, {
    name: draft?.name,
    year: draft?.year
  })

  if (partialPerson) {
    const needs = []

    if (!getPersonEmail(partialPerson)) {
      needs.push('Email à compléter')
    }

    if (!personHasStakeholderRole(partialPerson, draft?.role, { year: draft?.year })) {
      needs.push(`Rôle ${getStakeholderRoleLabel(draft?.role)} à ajouter`)
    }

    if (normalizeStakeholderRole(draft?.role) === 'candidat') {
      const draftYears = normalizeCandidateYears(draft?.candidateYears || draft?.year)
      const personYears = normalizeCandidateYears(partialPerson?.candidateYears || [])
      const missingYears = draftYears.filter((year) => !personYears.includes(year))

      if (missingYears.length > 0) {
        needs.push(`Année ${missingYears.join(', ')} à associer`)
      }
    }

    return {
      type: 'enrich',
      label: 'À enrichir',
      person: partialPerson,
      needs: needs.length > 0 ? needs : ['Fiche à vérifier']
    }
  }

  return {
    type: 'create',
    label: 'À créer',
    person: null,
    needs: ['Fiche référentielle manquante']
  }
}

export function getStakeholderDraftRank(statusType = '') {
  switch (statusType) {
    case 'create':
      return 1
    case 'enrich':
      return 2
    case 'resolved':
      return 3
    default:
      return 9
  }
}

export function createEmptyStakeholderForm(year = null) {
  const normalizedYear = Number.parseInt(year, 10)

  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    site: '',
    entreprise: '',
    roles: ['expert'],
    candidateYears: Number.isInteger(normalizedYear) ? [normalizedYear] : [],
    sendEmails: true,
    isActive: true
  }
}

export function stakeholderToForm(person = {}, fallbackYear = null) {
  if (!person) {
    return createEmptyStakeholderForm(fallbackYear)
  }

  return {
    firstName: normalizeWhitespace(person.firstName),
    lastName: normalizeWhitespace(person.lastName),
    email: normalizeWhitespace(person.email),
    phone: normalizeWhitespace(person.phone),
    site: normalizeWhitespace(person.site),
    entreprise: normalizeWhitespace(person.entreprise),
    roles: normalizeRoleList(person.roles, ['expert']),
    candidateYears: normalizeCandidateYears(person.candidateYears || []),
    sendEmails: person.sendEmails !== false,
    isActive: person.isActive !== false
  }
}

export function draftToStakeholderForm(draft = {}, fallbackYear = null) {
  const { firstName, lastName } = splitStakeholderName(draft?.name)
  const role = normalizeStakeholderRole(draft?.role) || 'expert'
  const candidateYears = role === 'candidat'
    ? normalizeCandidateYears(draft?.candidateYears || draft?.year || fallbackYear)
    : []

  return {
    ...createEmptyStakeholderForm(fallbackYear),
    firstName,
    lastName,
    site: normalizeWhitespace(draft?.site),
    entreprise: normalizeWhitespace(draft?.entreprise),
    roles: [role],
    candidateYears
  }
}

export function validateStakeholderForm(form = {}) {
  const errors = []
  const roles = normalizeRoleList(form.roles)

  if (!normalizeWhitespace(form.firstName)) {
    errors.push('Prénom requis.')
  }

  if (!normalizeWhitespace(form.lastName)) {
    errors.push('Nom requis.')
  }

  if (!normalizeWhitespace(form.email)) {
    errors.push('Email requis.')
  }

  if (roles.length === 0) {
    errors.push('Au moins un rôle valide est requis.')
  }

  if (roles.includes('candidat') && normalizeCandidateYears(form.candidateYears).length === 0) {
    errors.push('Un candidat doit être associé à au moins une année.')
  }

  return errors
}

export function stakeholderFormToPayload(form = {}) {
  const roles = normalizeRoleList(form.roles)

  return {
    firstName: normalizeWhitespace(form.firstName),
    lastName: normalizeWhitespace(form.lastName),
    email: normalizeWhitespace(form.email).toLowerCase(),
    phone: normalizeWhitespace(form.phone),
    site: normalizeWhitespace(form.site),
    entreprise: normalizeWhitespace(form.entreprise),
    roles,
    candidateYears: roles.includes('candidat')
      ? normalizeCandidateYears(form.candidateYears)
      : [],
    sendEmails: form.sendEmails !== false,
    isActive: form.isActive !== false
  }
}

export function filterStakeholders(people = [], filters = {}) {
  const search = normalizeLookupKey(filters.search)
  const role = normalizeStakeholderRole(filters.role)
  const site = normalizeLookupKey(filters.site)
  const emailFilter = normalizeWhitespace(filters.emailFilter)

  return (Array.isArray(people) ? people : []).filter((person) => {
    if (role && !normalizeRoleList(person?.roles).includes(role)) {
      return false
    }

    if (site && normalizeLookupKey(person?.site) !== site) {
      return false
    }

    if (emailFilter === 'with' && !getPersonEmail(person)) {
      return false
    }

    if (emailFilter === 'without' && getPersonEmail(person)) {
      return false
    }

    if (!search) {
      return true
    }

    const searchableText = normalizeLookupKey([
      formatPersonName(person),
      person?.email,
      person?.site,
      person?.entreprise,
      person?.shortId
    ].filter(Boolean).join(' '))

    return searchableText.includes(search)
  })
}

export function groupStakeholdersByIdentity(people = []) {
  const groups = new Map()

  for (const person of Array.isArray(people) ? people : []) {
    const key = getPersonIdentityKey(person)

    if (!key) {
      continue
    }

    const group = groups.get(key) || []
    group.push(person)
    groups.set(key, group)
  }

  return Array.from(groups.values()).filter((group) => group.length > 1)
}

export function buildStakeholderStats(people = [], drafts = []) {
  const activePeople = (Array.isArray(people) ? people : []).filter((person) => person?.isActive !== false)
  const roleCounts = Object.fromEntries(STAKEHOLDER_ROLES.map((role) => [role, 0]))

  for (const person of activePeople) {
    for (const role of normalizeRoleList(person?.roles)) {
      roleCounts[role] = (roleCounts[role] || 0) + 1
    }
  }

  const draftStatusCounts = {
    create: 0,
    enrich: 0,
    resolved: 0
  }

  for (const draft of Array.isArray(drafts) ? drafts : []) {
    const status = getStakeholderDraftStatus(draft, people)
    draftStatusCounts[status.type] = (draftStatusCounts[status.type] || 0) + 1
  }

  return {
    total: activePeople.length,
    roleCounts,
    draftStatusCounts,
    duplicateGroups: groupStakeholdersByIdentity(activePeople).length
  }
}
