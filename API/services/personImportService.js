const Person = require('../models/personModel')
const {
  isSyntheticOrganizerEmail,
  isValidEmail,
  normalizeEmail,
  normalizeText,
  resolveUniquePersonFromList
} = require('./personIdentityService')
const {
  ALLOWED_ROLES,
  mergePersonRecord,
  mergeRoles,
  normalizeRoleList,
  normalizeRoles
} = require('./personRegistryService')
const {
  ensurePersonShortId,
  resetPersonShortIdSequence
} = require('./personShortIdService')

const DELIMITERS = ['\t', ';', ',']

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function detectDelimiter(content = '') {
  const firstLine = content.split(/\r?\n/).find((line) => line.trim()) || ''

  let bestDelimiter = '\t'
  let maxCount = -1

  for (const delimiter of DELIMITERS) {
    const pattern = delimiter === '\t' ? /\t/g : new RegExp(escapeRegex(delimiter), 'g')
    const count = (firstLine.match(pattern) || []).length

    if (count > maxCount) {
      maxCount = count
      bestDelimiter = delimiter
    }
  }

  return bestDelimiter
}

function normalizeHeader(value = '') {
  return normalizeText(value).toLowerCase().replace(/\s+/g, '')
}

function parseDelimitedLine(line, delimiter) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  result.push(current.trim())
  return result
}

const COLUMN_MAPPINGS = {
  expert: 'name',
  nom: 'name',
  nomcomplet: 'name',
  personne: 'name',
  expertmail: 'email',
  email: 'email',
  mail: 'email',
  adressemail: 'email',
  tel: 'phone',
  telephone: 'phone',
  phone: 'phone',
  mobile: 'phone',
  site: 'site',
  lieu: 'site'
}

function parsePeopleContent(content = '') {
  const rawContent = content.toString().replace(/\uFEFF/g, '').trim()

  if (!rawContent) {
    throw new Error('Le contenu à importer est vide.')
  }

  const delimiter = detectDelimiter(rawContent)
  const lines = rawContent.split(/\r?\n/).filter((line) => line.trim())

  if (lines.length < 2) {
    throw new Error("Le fichier doit contenir au moins un en-tête et une ligne de données.")
  }

  const headers = parseDelimitedLine(lines[0], delimiter)
  const columnMap = {}

  headers.forEach((header, index) => {
    const mappedField = COLUMN_MAPPINGS[normalizeHeader(header)]

    if (mappedField) {
      columnMap[index] = mappedField
    }
  })

  if (!Object.values(columnMap).includes('name') || !Object.values(columnMap).includes('email')) {
    throw new Error("Les colonnes 'Expert' et 'Expert mail' sont requises.")
  }

  const rows = []

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = parseDelimitedLine(lines[lineIndex], delimiter)
    const row = {
      _lineNumber: lineIndex + 1
    }

    for (const [columnIndex, field] of Object.entries(columnMap)) {
      row[field] = values[Number(columnIndex)] || ''
    }

    if (row.name || row.email || row.phone || row.site) {
      rows.push(row)
    }
  }

  return {
    delimiter,
    headers,
    columnMap,
    rows
  }
}

function splitFullName(fullName = '') {
  const pieces = fullName
    .toString()
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (pieces.length === 0) {
    return { firstName: '', lastName: '' }
  }

  if (pieces.length === 1) {
    return { firstName: pieces[0], lastName: '' }
  }

  return {
    firstName: pieces.slice(0, -1).join(' '),
    lastName: pieces[pieces.length - 1]
  }
}

function hasAnyRoleOverlap(existingRoles = [], incomingRoles = []) {
  const existingRoleSet = new Set(normalizeRoleList(existingRoles))
  const incomingRoleList = normalizeRoleList(incomingRoles)

  return incomingRoleList.some((role) => existingRoleSet.has(role))
}

async function findExistingPersonForImport(fullName, defaultRoles = []) {
  const candidatePeople = await Person.find({ isActive: true })
    .select('firstName lastName email roles candidateYears isActive')

  const resolved = resolveUniquePersonFromList(fullName, candidatePeople)
  if (!resolved.person) {
    return null
  }

  if (defaultRoles.length > 0 && !hasAnyRoleOverlap(resolved.person.roles, defaultRoles)) {
    return null
  }

  if (!isSyntheticOrganizerEmail(resolved.person.email) && normalizeEmail(resolved.person.email || '')) {
    return null
  }

  return resolved.person
}

async function importPeopleFromContent(content, options = {}) {
  const parsed = parsePeopleContent(content)
  const defaultRoles = normalizeRoles(options.defaultRoles)
  const defaultSite = typeof options.defaultSite === 'string' ? options.defaultSite.trim() : ''

  const results = {
    created: 0,
    updated: 0,
    duplicates: 0,
    skipped: 0,
    errors: [],
    rowsProcessed: parsed.rows.length,
    imported: []
  }

  for (const row of parsed.rows) {
    try {
      const fullName = typeof row.name === 'string' ? row.name.trim() : ''
      const email = normalizeEmail(row.email || '')
      const phone = typeof row.phone === 'string' ? row.phone.trim() : ''
      const rowSite = typeof row.site === 'string' ? row.site.trim() : ''
      const site = rowSite || defaultSite || ''
      const { firstName, lastName } = splitFullName(fullName)

      if (!fullName) {
        results.skipped += 1
        results.errors.push({
          line: row._lineNumber,
          error: 'Nom manquant.',
          data: row
        })
        continue
      }

      if (!email || !isValidEmail(email)) {
        results.skipped += 1
        results.errors.push({
          line: row._lineNumber,
          error: 'Email manquant ou invalide.',
          data: row
        })
        continue
      }

      const existingPerson = await Person.findOne({ email })
      if (existingPerson) {
        const { hasChanges, updates } = mergePersonRecord(existingPerson, {
          firstName,
          lastName,
          phone,
          site,
          roles: defaultRoles,
          isActive: true
        })

        if (!hasChanges) {
          results.duplicates += 1
          results.skipped += 1
          results.imported.push({
            line: row._lineNumber,
            status: 'duplicate',
            email,
            name: fullName
          })
          continue
        }

        Object.assign(existingPerson, updates)
        await ensurePersonShortId(existingPerson, { persist: false })
        await existingPerson.save()

        results.updated += 1
        results.imported.push({
          line: row._lineNumber,
          status: 'updated',
          email,
          name: fullName
        })
        continue
      }

      const existingByName = await findExistingPersonForImport(fullName, defaultRoles)
      if (existingByName) {
        const { hasChanges, updates } = mergePersonRecord(existingByName, {
          firstName,
          lastName,
          phone,
          site,
          roles: defaultRoles,
          isActive: true
        })

        if (normalizeEmail(existingByName.email || '') !== email) {
          updates.email = email
        }

        if (Object.keys(updates).length > 0) {
          Object.assign(existingByName, updates)
          await ensurePersonShortId(existingByName, { persist: false })
          await existingByName.save()

          results.updated += 1
          results.imported.push({
            line: row._lineNumber,
            status: 'updated',
            email,
            name: fullName
          })
          continue
        }

        results.duplicates += 1
        results.skipped += 1
        results.imported.push({
          line: row._lineNumber,
          status: 'duplicate',
          email,
          name: fullName
        })
        continue
      }

      const person = new Person({
        firstName,
        lastName,
        email,
        phone,
        site,
        roles: defaultRoles,
        isActive: true
      })

      await ensurePersonShortId(person, { persist: false })
      await person.save()

      results.created += 1
      results.imported.push({
        line: row._lineNumber,
        status: 'created',
        email,
        name: fullName
      })
    } catch (error) {
      results.skipped += 1
      results.errors.push({
        line: row._lineNumber,
        error: error.message,
        data: row
      })
    }
  }

  return results
}

async function purgeAllPeople() {
  const result = await Person.deleteMany({})
  await resetPersonShortIdSequence()

  return {
    deletedCount: result?.deletedCount || 0
  }
}

module.exports = {
  COLUMN_MAPPINGS,
  ALLOWED_ROLES,
  detectDelimiter,
  importPeopleFromContent,
  parseDelimitedLine,
  parsePeopleContent,
  mergePersonRecord,
  mergeRoles,
  purgeAllPeople,
  normalizeRoleList,
  normalizeRoles,
  splitFullName
}
