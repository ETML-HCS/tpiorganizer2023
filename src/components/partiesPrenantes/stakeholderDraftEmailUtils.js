const ORGANIZER_DRAFT_EMAIL_DOMAIN = 'tpiorganizer.ch'
const DEFAULT_ROLE_ALIAS = 's'
const ROLE_ALIASES = {
  admin: 'a',
  candidat: 'c',
  chef_projet: 'p',
  expert: 'e',
  stakeholder: DEFAULT_ROLE_ALIAS
}

function normalizeWhitespace(value = '') {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeFold(value = '') {
  return normalizeWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function slugifyEmailToken(value = '') {
  return normalizeFold(value)
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
}

function compactEmailToken(value = '', maxLength = 8) {
  return slugifyEmailToken(value)
    .replace(/\./g, '')
    .slice(0, maxLength)
}

function buildStableEmailSuffix(value = '') {
  const normalizedValue = normalizeWhitespace(value)
  let hash = 0

  for (let index = 0; index < normalizedValue.length; index += 1) {
    hash = ((hash << 5) - hash) + normalizedValue.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash).toString(36).padStart(6, '0').slice(0, 6)
}

function buildCompactRoleAlias(role = '') {
  const normalizedRole = slugifyEmailToken(role)

  if (!normalizedRole) {
    return DEFAULT_ROLE_ALIAS
  }

  return ROLE_ALIASES[normalizedRole] || normalizedRole.slice(0, 2)
}

function buildCompactNameSegment(firstName = '', lastName = '') {
  const compactFirstName = compactEmailToken(firstName, 1)
  const compactLastName = compactEmailToken(lastName, 8)

  if (compactFirstName && compactLastName) {
    return `${compactFirstName}${compactLastName}`
  }

  return compactLastName || compactEmailToken(firstName, 9) || 'anon'
}

function buildCompactYearSegment(year = null) {
  if (!Number.isInteger(Number(year))) {
    return 'xx'
  }

  return String(Number(year)).slice(-2).padStart(2, '0')
}

export function buildSyntheticStakeholderEmail({
  firstName = '',
  lastName = '',
  role = 'stakeholder',
  year = null,
  seed = ''
} = {}) {
  const compactRoleAlias = buildCompactRoleAlias(role)
  const nameSegment = buildCompactNameSegment(firstName, lastName)
  const normalizedYear = buildCompactYearSegment(year)
  const suffix = buildStableEmailSuffix([
    compactRoleAlias,
    nameSegment,
    normalizedYear,
    normalizeWhitespace(seed)
  ].filter(Boolean).join('|') || compactRoleAlias)
  const localPart = [
    'd',
    compactRoleAlias,
    nameSegment,
    normalizedYear,
    suffix
  ]
    .join('.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')

  return `${localPart}@${ORGANIZER_DRAFT_EMAIL_DOMAIN}`
}
