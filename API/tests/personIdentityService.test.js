const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildNameVariants,
  extractEmailFromFilename,
  isValidEmail,
  normalizeEmail,
  isSyntheticOrganizerEmail,
  resolveUniquePersonFromList
} = require('../services/personIdentityService')

test('normalizeEmail trims and lowercases email values', () => {
  assert.equal(
    normalizeEmail('  TEST.Person@Example.COM  '),
    'test.person@example.com'
  )
})

test('extractEmailFromFilename returns null when filename has no real email', () => {
  assert.equal(
    extractEmailFromFilename('Emploi_du_Temps_Nom_Prenom.ics'),
    null
  )
  assert.equal(
    extractEmailFromFilename('prenom_nom.ics'),
    null
  )
})

test('extractEmailFromFilename keeps only actual email identifiers', () => {
  assert.equal(
    extractEmailFromFilename('MARC.OLIVIER@EDUVAUD.CH.ics'),
    'marc.olivier@eduvaud.ch'
  )
})

test('buildNameVariants returns first/last name permutations for every possible split', () => {
  assert.deepEqual(buildNameVariants('Jean Dupont'), [
    { firstName: 'Jean', lastName: 'Dupont' },
    { firstName: 'Dupont', lastName: 'Jean' }
  ])
})

test('resolveUniquePersonFromList matches multi-part names regardless of the chosen split', () => {
  const people = [
    {
      email: 'dario@example.com',
      firstName: 'Chasi Sanchez Dario',
      lastName: 'Jhesuanj',
      isActive: true
    }
  ]

  const result = resolveUniquePersonFromList('Chasi Sanchez Dario Jhesuanj', people)
  assert.equal(result.person?.email, 'dario@example.com')
  assert.equal(result.reason, 'matched_name')
})

test('isValidEmail rejects empty or malformed values', () => {
  assert.equal(isValidEmail(''), false)
  assert.equal(isValidEmail('not-an-email'), false)
  assert.equal(isValidEmail('demo@example.com'), true)
})

test('isSyntheticOrganizerEmail detects placeholder organizer domains', () => {
  assert.equal(isSyntheticOrganizerEmail('xyz@tpiOrganizer.ch'), true)
  assert.equal(isSyntheticOrganizerEmail('noreply@tpi-organizer.ch'), true)
  assert.equal(isSyntheticOrganizerEmail('demo@example.com'), false)
})

test('resolveUniquePersonFromList returns only active confirmed persons', () => {
  const people = [
    {
      email: 'alain.dupont@example.com',
      firstName: 'Alain',
      lastName: 'Dupont',
      isActive: true
    },
    {
      email: 'alain.dupont@example.org',
      firstName: 'Alain',
      lastName: 'Dupont',
      isActive: false
    }
  ]

  const byEmail = resolveUniquePersonFromList('ALAIN.DUPONT@EXAMPLE.COM', people)
  assert.equal(byEmail.person?.email, 'alain.dupont@example.com')
  assert.equal(byEmail.reason, 'matched_email')

  const byName = resolveUniquePersonFromList('Alain Dupont', people)
  assert.equal(byName.person?.email, 'alain.dupont@example.com')
  assert.equal(byName.reason, 'matched_name')
})

test('resolveUniquePersonFromList rejects ambiguous identities', () => {
  const people = [
    {
      email: 'a1@example.com',
      firstName: 'Alain',
      lastName: 'Dupont',
      isActive: true
    },
    {
      email: 'a2@example.com',
      firstName: 'Alain',
      lastName: 'Dupont',
      isActive: true
    }
  ]

  const result = resolveUniquePersonFromList('Alain Dupont', people)
  assert.equal(result.person, null)
  assert.equal(result.reason, 'name_ambiguous')
})
