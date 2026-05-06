import {
  normalizeFold,
  normalizeRoleList,
  normalizeWhitespace
} from '../../utils/stakeholderRules'
import stakeholderDefinitions from '../../../shared/stakeholderDefinitions.json'

export const IMPORT_DELIMITERS = ['\t', ';', ',']

export const IMPORT_COLUMN_MAPPINGS = Object.freeze({
  ...stakeholderDefinitions.importColumnMappings
})

export const IMPORT_FIELD_LABELS = Object.freeze({
  name: 'Nom',
  email: 'Email',
  phone: 'Téléphone',
  site: 'Site'
})

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function normalizeImportHeader(value = '') {
  return normalizeFold(value).replace(/\s+/g, '')
}

export function detectImportDelimiter(content = '') {
  const firstLine = String(content || '').split(/\r?\n/).find((line) => line.trim()) || ''
  let bestDelimiter = '\t'
  let maxCount = -1

  for (const delimiter of IMPORT_DELIMITERS) {
    const pattern = delimiter === '\t'
      ? /\t/g
      : new RegExp(escapeRegex(delimiter), 'g')
    const count = (firstLine.match(pattern) || []).length

    if (count > maxCount) {
      bestDelimiter = delimiter
      maxCount = count
    }
  }

  return bestDelimiter
}

export function parseImportDelimitedLine(line = '', delimiter = ';') {
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

export function getImportDelimiterLabel(delimiter = '') {
  switch (delimiter) {
    case '\t':
      return 'Tabulation'
    case ';':
      return 'Point-virgule'
    case ',':
      return 'Virgule'
    default:
      return 'Inconnu'
  }
}

export function buildStakeholderImportPreview(content = '') {
  const rawContent = String(content || '').replace(/\uFEFF/g, '').trim()

  if (!rawContent) {
    return {
      canImport: false,
      dataRowCount: 0,
      delimiter: '',
      delimiterLabel: 'Aucun',
      headers: [],
      isEmpty: true,
      missingRequiredFields: ['name', 'email'],
      recognizedFields: [],
      sampleRows: []
    }
  }

  const lines = rawContent.split(/\r?\n/).filter((line) => line.trim())
  const delimiter = detectImportDelimiter(rawContent)
  const headers = parseImportDelimitedLine(lines[0] || '', delimiter)
  const mappedColumns = headers
    .map((header, index) => {
      const field = IMPORT_COLUMN_MAPPINGS[normalizeImportHeader(header)]
      return field ? { field, header, index } : null
    })
    .filter(Boolean)
  const recognizedFields = Array.from(new Set(mappedColumns.map((column) => column.field)))
  const missingRequiredFields = ['name', 'email'].filter((field) => !recognizedFields.includes(field))
  const sampleRows = lines
    .slice(1, 6)
    .map((line, index) => {
      const values = parseImportDelimitedLine(line, delimiter)
      const row = {
        email: '',
        lineNumber: index + 2,
        name: '',
        phone: '',
        site: ''
      }

      for (const column of mappedColumns) {
        row[column.field] = normalizeWhitespace(values[column.index])
      }

      return row
    })
    .filter((row) => row.name || row.email || row.phone || row.site)

  return {
    canImport: lines.length > 1 && missingRequiredFields.length === 0,
    dataRowCount: Math.max(lines.length - 1, 0),
    delimiter,
    delimiterLabel: getImportDelimiterLabel(delimiter),
    headers,
    isEmpty: false,
    missingRequiredFields,
    recognizedFields,
    sampleRows
  }
}

export function normalizeImportOptions({ defaultSite = '', defaultRoles = [] } = {}) {
  const roles = normalizeRoleList(defaultRoles, ['expert']).filter((role) => role !== 'admin')

  return {
    defaultSite: normalizeWhitespace(defaultSite),
    defaultRoles: roles.length > 0 ? roles : ['expert']
  }
}
