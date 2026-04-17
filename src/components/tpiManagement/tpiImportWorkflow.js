import { splitTags } from './tpiManagementUtils.js'

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()
    .trim()

const getFirstValue = (entry, keys) => {
  for (const key of keys) {
    const value = entry?.[key]

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim()
    }
  }

  return ''
}

const getHeaderValue = (entry, headerName) => {
  if (!headerName) {
    return ''
  }

  const value = entry?.[headerName]
  return value === undefined || value === null ? '' : String(value).trim()
}

export const parseFlexibleDate = (dateStr) => {
  if (!dateStr || !String(dateStr).trim()) {
    return null
  }

  const value = String(dateStr).trim()

  const parts = value.split(/[./-]/).filter(Boolean)

  if (parts.length === 3) {
    let [a, b, c] = parts
    let day = a
    let month = b
    let year = c

    if (a.length === 4) {
      year = a
      month = b
      day = c
    }

    if (year.length === 2) {
      year = `20${year}`
    }

    const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    const parsedDate = new Date(iso)

    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate
    }
  }

  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

export const IMPORT_FIELD_DEFS = [
  {
    key: 'refTpi',
    label: 'Référence',
    required: true,
    aliases: ['N° de TPI', 'N', 'Référence', 'Reference', 'Ref', 'TPI']
  },
  {
    key: 'candidat',
    label: 'Candidat',
    required: true,
    aliases: ['Candidat', 'Eleve', 'Éleve', 'Élève', 'Student']
  },
  {
    key: 'classe',
    label: 'Classe',
    required: false,
    aliases: ['Classe', 'Class']
  },
  {
    key: 'entreprise',
    label: 'Entreprise',
    required: false,
    aliases: ['Entreprise', 'Ent TPI', 'EntTPI', 'Company']
  },
  {
    key: 'site',
    label: 'Lieu / Site',
    required: false,
    aliases: ['Lieu', 'Site', 'Location']
  },
  {
    key: 'boss',
    label: 'Encadrant',
    required: true,
    aliases: ['Encadrant', 'Chef de projet', 'ChefProjet', 'Responsable', 'Boss']
  },
  {
    key: 'expert1',
    label: 'Expert 1',
    required: true,
    aliases: ['Expert 1', 'Expert1', 'Expert-1']
  },
  {
    key: 'expert2',
    label: 'Expert 2',
    required: true,
    aliases: ['Expert 2', 'Expert2', 'Expert-2']
  },
  {
    key: 'sujet',
    label: 'Sujet',
    required: false,
    aliases: ['Sujet', 'Title', 'Intitulé', 'Intitule']
  },
  {
    key: 'description',
    label: 'Domaine',
    required: false,
    aliases: ['Domaine', 'Description']
  },
  {
    key: 'tags',
    label: 'Mots clés',
    required: false,
    aliases: ['Mots clés', 'Tags', 'Mots cles']
  },
  {
    key: 'salle',
    label: 'Salle',
    required: false,
    aliases: ['Salle']
  },
  {
    key: 'dateDepart',
    label: 'Départ',
    required: false,
    aliases: ['Départ', 'Date départ', 'Date début', 'Début TPI', 'Date Debut']
  },
  {
    key: 'dateFin',
    label: 'Fin',
    required: false,
    aliases: ['Fin']
  },
  {
    key: 'legacyExpert',
    label: 'Expert',
    required: false,
    advanced: true,
    aliases: ['Expert', 'Expert unique']
  },
  {
    key: 'legacyExpertNo',
    label: 'Expert no',
    required: false,
    advanced: true,
    aliases: ['Expert no', 'Expert numéro', 'Numero expert', 'Numéro expert']
  }
]

const normalizeHeaders = (headers = []) =>
  headers
    .filter(Boolean)
    .map((header) => ({
      raw: header,
      normalized: normalizeText(header)
    }))

const findMatchingHeader = (headers, aliases = []) => {
  const normalizedHeaders = normalizeHeaders(headers)

  for (const alias of aliases) {
    const normalizedAlias = normalizeText(alias)
    const match = normalizedHeaders.find((header) => header.normalized === normalizedAlias)

    if (match) {
      return match.raw
    }
  }

  return ''
}

export const buildDefaultImportMapping = (headers = []) =>
  IMPORT_FIELD_DEFS.reduce((mapping, field) => {
    mapping[field.key] = findMatchingHeader(headers, [field.label, ...(field.aliases || [])])
    return mapping
  }, {})

export const normalizeImportMapping = (mapping = {}, headers = []) =>
  IMPORT_FIELD_DEFS.reduce((normalized, field) => {
    const selectedValue = mapping?.[field.key]
    if (!selectedValue) {
      normalized[field.key] = ''
      return normalized
    }

    const headerMatch = headers.find((header) => header === selectedValue)
    normalized[field.key] = headerMatch || ''
    return normalized
  }, {})

export const getImportMode = (mapping = {}) => {
  if (mapping.expert1 || mapping.expert2) {
    return 'compact'
  }

  if (mapping.legacyExpert || mapping.legacyExpertNo) {
    return 'legacy'
  }

  return 'compact'
}

export const getMissingRequiredMappingKeys = (mapping = {}) => {
  const mode = getImportMode(mapping)
  const requiredKeys =
    mode === 'legacy'
      ? ['refTpi', 'candidat', 'boss', 'legacyExpert', 'legacyExpertNo']
      : ['refTpi', 'candidat', 'boss', 'expert1', 'expert2']

  return requiredKeys.filter((key) => !mapping?.[key])
}

const getMappedValue = (entry, mapping, key) => getHeaderValue(entry, mapping?.[key])

export const buildImportedTpi = (entry, mapping = {}) => {
  const refTpi = getMappedValue(entry, mapping, 'refTpi')

  if (!refTpi) {
    return null
  }

  return {
    refTpi,
    candidat: getMappedValue(entry, mapping, 'candidat'),
    classe: getMappedValue(entry, mapping, 'classe'),
    experts: {
      1: getMappedValue(entry, mapping, 'expert1'),
      2: getMappedValue(entry, mapping, 'expert2')
    },
    boss: getMappedValue(entry, mapping, 'boss'),
    lieu: {
      entreprise: getMappedValue(entry, mapping, 'entreprise'),
      site: getMappedValue(entry, mapping, 'site')
    },
    sujet: getMappedValue(entry, mapping, 'sujet'),
    description: getMappedValue(entry, mapping, 'description'),
    tags: splitTags(getMappedValue(entry, mapping, 'tags')),
    dates: {
      depart: parseFlexibleDate(getMappedValue(entry, mapping, 'dateDepart')),
      fin: parseFlexibleDate(getMappedValue(entry, mapping, 'dateFin')),
      soutenance: null
    },
    salle: getMappedValue(entry, mapping, 'salle')
  }
}

const getCompactValidationIssues = (tpi) => {
  const issues = []

  if (!tpi.candidat) {
    issues.push('candidat')
  }

  if (!tpi.boss) {
    issues.push('chef de projet')
  }

  if (!tpi.experts?.[1]) {
    issues.push('expert 1')
  }

  if (!tpi.experts?.[2]) {
    issues.push('expert 2')
  }

  return issues
}

const getLegacyValidationIssues = (entry, mapping) => {
  const issues = []

  if (!getMappedValue(entry, mapping, 'candidat')) {
    issues.push('candidat')
  }

  if (!getMappedValue(entry, mapping, 'boss')) {
    issues.push('chef de projet')
  }

  if (!getMappedValue(entry, mapping, 'legacyExpert')) {
    issues.push('expert')
  }

  const expertNo = getMappedValue(entry, mapping, 'legacyExpertNo')
  if (expertNo !== '1' && expertNo !== '2') {
    issues.push('numéro expert')
  }

  return issues
}

export const hydrateExpertsFromRows = (tpiMap, entry, mapping = {}) => {
  const refTpi = getMappedValue(entry, mapping, 'refTpi')
  const currentTpi = tpiMap[refTpi]

  if (!currentTpi) {
    return
  }

  const expertNo = getMappedValue(entry, mapping, 'legacyExpertNo')
  const expertName = getMappedValue(entry, mapping, 'legacyExpert')

  if (expertNo === '1' || expertNo === '2') {
    currentTpi.experts[expertNo] = expertName
  }
}

export const buildImportProcessingReport = (rows, providedMapping = null) => {
  const headers = rows.length > 0 ? Object.keys(rows[0] || {}) : []
  const mapping =
    providedMapping !== null && providedMapping !== undefined
      ? normalizeImportMapping(providedMapping, headers)
      : buildDefaultImportMapping(headers)

  const mode = getImportMode(mapping)
  const tpiMap = {}
  const skippedRows = []
  const duplicateRows = []
  const legacyRows = []

  rows.forEach((entry, index) => {
    const rowNumber = index + 2
    const refTpi = getMappedValue(entry, mapping, 'refTpi')

    if (!refTpi) {
      skippedRows.push({
        row: rowNumber,
        ref: '',
        reasons: ['référence manquante']
      })
      return
    }

    if (mode === 'legacy') {
      const issues = getLegacyValidationIssues(entry, mapping)

      if (issues.length > 0) {
        skippedRows.push({
          row: rowNumber,
          ref: refTpi,
          reasons: issues
        })
        return
      }

      if (!tpiMap[refTpi]) {
        tpiMap[refTpi] = buildImportedTpi(entry, mapping)
      }

      legacyRows.push(rowNumber)
      return
    }

    const builtTpi = buildImportedTpi(entry, mapping)
    const issues = getCompactValidationIssues(builtTpi)

    if (issues.length > 0) {
      skippedRows.push({
        row: rowNumber,
        ref: refTpi,
        reasons: issues
      })
      return
    }

    if (tpiMap[refTpi]) {
      duplicateRows.push({
        row: rowNumber,
        ref: refTpi
      })
      return
    }

    tpiMap[refTpi] = builtTpi
  })

  if (mode === 'legacy') {
    rows.forEach((entry) => hydrateExpertsFromRows(tpiMap, entry, mapping))
  }

  return {
    tpis: Object.values(tpiMap),
    summary: {
      totalRows: rows.length,
      uniqueTpis: Object.keys(tpiMap).length,
      legacyRows,
      duplicateRows,
      skippedRows,
      mode,
      mapping
    }
  }
}
