import { splitTags } from './tpiManagementUtils.js'

const getFirstValue = (entry, keys) => {
  for (const key of keys) {
    const value = entry?.[key]

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim()
    }
  }

  return ''
}

export const parseLegacyDate = (dateStr) => {
  if (!dateStr || !String(dateStr).trim()) {
    return null
  }

  const parts = String(dateStr).trim().split('.')

  if (parts.length !== 3) {
    return null
  }

  const normalizedYear = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
  const parsedDate = new Date(`${normalizedYear}-${parts[1]}-${parts[0]}`)

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

export const buildImportedTpi = (entry) => {
  const refTpi = getFirstValue(entry, ['N° de TPI', 'tpiRef'])

  if (!refTpi) {
    return null
  }

  return {
    refTpi,
    candidat: getFirstValue(entry, ['Candidat', 'candidat']),
    experts: {
      1: getFirstValue(entry, ['Expert 1', 'expert 1']),
      2: getFirstValue(entry, ['Expert 2', 'expert 2'])
    },
    boss: getFirstValue(entry, ['Chef de projet', 'boss']),
    lieu: {
      entreprise: getFirstValue(entry, ['Entreprise', 'lieu-entreprise']),
      site: getFirstValue(entry, ['Lieu', 'lieu-site'])
    },
    sujet: getFirstValue(entry, ['Sujet', 'sujet']),
    description: getFirstValue(entry, ['Domaine', 'domaine']),
    tags: splitTags(getFirstValue(entry, ['Mots clés', 'tags'])),
    dates: {
      depart: parseLegacyDate(getFirstValue(entry, ['Départ', 'dateDepart'])),
      fin: parseLegacyDate(getFirstValue(entry, ['Fin', 'dateFin'])),
      soutenance: parseLegacyDate(getFirstValue(entry, ['Date soutenance', 'dateSoutenance']))
    },
    salle: getFirstValue(entry, ['Salle', 'salle'])
  }
}

export const hydrateExpertsFromRows = (tpiMap, entry) => {
  const refTpi = getFirstValue(entry, ['N° de TPI', 'tpiRef'])
  const currentTpi = tpiMap[refTpi]

  if (!currentTpi) {
    return
  }

  const expertNo = getFirstValue(entry, ['Expert no', 'expert no', 'expertNo'])
  const expertName = getFirstValue(entry, ['Expert', 'expert'])

  if (expertNo === '1' || expertNo === '2') {
    currentTpi.experts[expertNo] = expertName
  }
}

const isLegacyExpertRow = (entry) => {
  const expertNo = getFirstValue(entry, ['Expert no', 'expert no', 'expertNo'])
  const expertName = getFirstValue(entry, ['Expert', 'expert'])

  return Boolean(expertName) || expertNo === '1' || expertNo === '2'
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

const getLegacyValidationIssues = (entry, tpi) => {
  const issues = []
  const expertNo = getFirstValue(entry, ['Expert no', 'expert no', 'expertNo'])
  const expertName = getFirstValue(entry, ['Expert', 'expert'])

  if (!tpi.candidat) {
    issues.push('candidat')
  }

  if (!tpi.boss) {
    issues.push('chef de projet')
  }

  if (!expertName) {
    issues.push('expert')
  }

  if (expertNo !== '1' && expertNo !== '2') {
    issues.push('numéro expert')
  }

  return issues
}

export const buildImportProcessingReport = (rows) => {
  const tpiMap = {}
  const skippedRows = []
  const duplicateRows = []
  const legacyRows = []

  rows.forEach((entry, index) => {
    const builtTpi = buildImportedTpi(entry)
    const rowNumber = index + 2

    if (!builtTpi) {
      skippedRows.push({
        row: rowNumber,
        ref: '',
        reasons: ['référence manquante']
      })
      return
    }

    const legacyRow = isLegacyExpertRow(entry)
    const issues = legacyRow
      ? getLegacyValidationIssues(entry, builtTpi)
      : getCompactValidationIssues(builtTpi)

    if (issues.length > 0) {
      skippedRows.push({
        row: rowNumber,
        ref: builtTpi.refTpi,
        reasons: issues
      })
      return
    }

    if (legacyRow) {
      legacyRows.push(rowNumber)
      if (!tpiMap[builtTpi.refTpi]) {
        tpiMap[builtTpi.refTpi] = builtTpi
      }
      return
    }

    if (tpiMap[builtTpi.refTpi]) {
      duplicateRows.push({
        row: rowNumber,
        ref: builtTpi.refTpi
      })
      return
    }

    tpiMap[builtTpi.refTpi] = builtTpi
  })

  rows.forEach((entry) => hydrateExpertsFromRows(tpiMap, entry))

  return {
    tpis: Object.values(tpiMap),
    summary: {
      totalRows: rows.length,
      uniqueTpis: Object.keys(tpiMap).length,
      legacyRows,
      duplicateRows,
      skippedRows
    }
  }
}
