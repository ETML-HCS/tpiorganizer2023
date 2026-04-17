const path = require('path')

const EMAIL_TOKEN_REGEX = /[^\s@]+@[^\s@]+\.[^\s@]+/
const STRICT_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SYNTHETIC_ORGANIZER_EMAIL_REGEX = /@tpi-?organizer\.ch$/i
const PLACEHOLDER_EMPTY_VALUES = new Set(['null', 'undefined'])

function normalizeText(value = '') {
  const textValue = String(value ?? '')
    .trim()

  if (PLACEHOLDER_EMPTY_VALUES.has(textValue.toLowerCase())) {
    return ''
  }

  return textValue
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
}

function normalizeEmail(value = '') {
  const normalizedValue = String(value ?? '').trim().toLowerCase()
  return PLACEHOLDER_EMPTY_VALUES.has(normalizedValue)
    ? ''
    : normalizedValue
}

function isValidEmail(value = '') {
  return STRICT_EMAIL_REGEX.test(normalizeEmail(value))
}

function isSyntheticOrganizerEmail(value = '') {
  return SYNTHETIC_ORGANIZER_EMAIL_REGEX.test(normalizeEmail(value))
}

function extractEmailFromFilename(filename = '') {
  const baseName = path.basename(filename, path.extname(filename))
  const match = baseName.match(EMAIL_TOKEN_REGEX)

  return match ? normalizeEmail(match[0]) : null
}

function splitNameParts(value = '') {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean)
}

function buildNameVariants(value = '') {
  const parts = splitNameParts(value)

  if (parts.length < 2) {
    return []
  }

  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')

  return [
    { firstName, lastName },
    { firstName: lastName, lastName: firstName }
  ]
}

function resolveUniquePersonFromList(identifier = '', people = []) {
  const value = normalizeEmail(identifier)
  const isEmail = STRICT_EMAIL_REGEX.test(value)

  const activePeople = Array.isArray(people)
    ? people.filter((person) => person && person.isActive !== false)
    : []

  if (isEmail) {
    const matches = activePeople.filter(
      (person) => normalizeEmail(person.email || '') === value
    )

    if (matches.length === 1) {
      return { person: matches[0], reason: 'matched_email' }
    }

    if (matches.length > 1) {
      return { person: null, reason: 'email_ambiguous' }
    }

    return { person: null, reason: 'email_not_found' }
  }

  const variants = buildNameVariants(identifier)
  const matches = activePeople.filter((person) =>
    variants.some(
      (variant) =>
        normalizeText(person.firstName || '').toLowerCase() === normalizeText(variant.firstName).toLowerCase() &&
        normalizeText(person.lastName || '').toLowerCase() === normalizeText(variant.lastName).toLowerCase()
    )
  )

  if (matches.length === 1) {
    return { person: matches[0], reason: 'matched_name' }
  }

  if (matches.length > 1) {
    return { person: null, reason: 'name_ambiguous' }
  }

  return { person: null, reason: 'name_not_found' }
}

module.exports = {
  buildNameVariants,
  EMAIL_TOKEN_REGEX,
  extractEmailFromFilename,
  isValidEmail,
  isSyntheticOrganizerEmail,
  resolveUniquePersonFromList,
  normalizeEmail,
  normalizeText,
  splitNameParts
}
