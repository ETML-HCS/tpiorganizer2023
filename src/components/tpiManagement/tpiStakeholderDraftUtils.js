const PLACEHOLDER_EMPTY_VALUES = new Set(['null', 'undefined'])

const normalizeWhitespace = (value = '') => {
  const normalizedValue = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()

  return PLACEHOLDER_EMPTY_VALUES.has(normalizedValue.toLowerCase())
    ? ''
    : normalizedValue
}

const normalizeFold = (value = '') =>
  normalizeWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const uniqueList = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .map((value) => normalizeWhitespace(value))
        .filter(Boolean)
    )
  )

export const splitStakeholderDraftName = (value = '') => {
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

export const getStakeholderRoleLabel = (role = '') => {
  switch (String(role || '').trim()) {
    case 'candidat':
      return 'Candidat'
    case 'expert':
      return 'Expert'
    case 'chef_projet':
      return 'Chef de projet'
    default:
      return 'Partie prenante'
  }
}

const buildDraftKey = (entry = {}) => {
  const role = normalizeWhitespace(entry.role || 'unknown')
  const name = normalizeFold(entry.name)
  const year = Number.isInteger(Number(entry.year)) ? Number(entry.year) : 'na'

  return `${role}|${name}|${year}`
}

const normalizeDraftEntry = (entry = {}) => {
  const normalizedRole = normalizeWhitespace(entry.role)
  const normalizedName = normalizeWhitespace(entry.name)
  const parsedYear = Number.parseInt(entry.year, 10)
  const normalizedYear = Number.isInteger(parsedYear) ? parsedYear : null

  return {
    id: normalizeWhitespace(entry.id) || buildDraftKey({
      role: normalizedRole,
      name: normalizedName,
      year: normalizedYear
    }),
    role: normalizedRole,
    name: normalizedName,
    year: normalizedYear,
    site: normalizeWhitespace(entry.site),
    entreprise: normalizeWhitespace(entry.entreprise),
    candidateYears: uniqueList(
      Array.isArray(entry.candidateYears)
        ? entry.candidateYears
        : normalizedRole === 'candidat' && normalizedYear
          ? [normalizedYear]
          : []
    )
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value))
      .sort((left, right) => right - left),
    refs: uniqueList(entry.refs).sort((left, right) =>
      left.localeCompare(right, 'fr', { numeric: true, sensitivity: 'base' })
    ),
    source: normalizeWhitespace(entry.source) || 'gestionTPI',
    createdAt: normalizeWhitespace(entry.createdAt) || new Date().toISOString()
  }
}

export const mergeStakeholderDraftEntries = (existingEntries = [], incomingEntries = []) => {
  const merged = new Map()

  const appendEntry = (rawEntry) => {
    const normalizedEntry = normalizeDraftEntry(rawEntry)

    if (!normalizedEntry.role || !normalizedEntry.name) {
      return
    }

    const key = buildDraftKey(normalizedEntry)
    const current = merged.get(key)

    if (!current) {
      merged.set(key, normalizedEntry)
      return
    }

    merged.set(key, {
      ...current,
      site: current.site || normalizedEntry.site,
      entreprise: current.entreprise || normalizedEntry.entreprise,
      refs: uniqueList([...current.refs, ...normalizedEntry.refs]).sort((left, right) =>
        left.localeCompare(right, 'fr', { numeric: true, sensitivity: 'base' })
      ),
      candidateYears: uniqueList([...current.candidateYears, ...normalizedEntry.candidateYears])
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value))
        .sort((left, right) => right - left)
    })
  }

  ;[...(Array.isArray(existingEntries) ? existingEntries : []), ...(Array.isArray(incomingEntries) ? incomingEntries : [])]
    .forEach(appendEntry)

  return Array.from(merged.values()).sort((left, right) => {
    const leftKey = `${getStakeholderRoleLabel(left.role)}|${left.name}|${left.year || 0}`
    const rightKey = `${getStakeholderRoleLabel(right.role)}|${right.name}|${right.year || 0}`

    return leftKey.localeCompare(rightKey, 'fr', { numeric: true, sensitivity: 'base' })
  })
}

export const buildStakeholderDraftEntries = (tpis = [], year = null) => {
  const entries = []
  const parsedYear = Number.parseInt(year, 10)
  const normalizedYear = Number.isInteger(parsedYear) ? parsedYear : null

  const appendEntry = (role, name, tpi) => {
    const normalizedName = normalizeWhitespace(name)

    if (!normalizedName) {
      return
    }

    entries.push({
      role,
      name: normalizedName,
      year: normalizedYear,
      site: normalizeWhitespace(tpi?.lieu?.site || tpi?.site),
      entreprise: normalizeWhitespace(tpi?.lieu?.entreprise || tpi?.entreprise),
      candidateYears: role === 'candidat' && normalizedYear ? [normalizedYear] : [],
      refs: uniqueList([tpi?.refTpi]),
      source: 'gestionTPI'
    })
  }

  for (const tpi of Array.isArray(tpis) ? tpis : []) {
    appendEntry('candidat', tpi?.candidat, tpi)
    appendEntry('expert', tpi?.experts?.['1'] ?? tpi?.experts?.[1] ?? tpi?.expert1, tpi)
    appendEntry('expert', tpi?.experts?.['2'] ?? tpi?.experts?.[2] ?? tpi?.expert2, tpi)
    appendEntry('chef_projet', tpi?.boss, tpi)
  }

  return mergeStakeholderDraftEntries([], entries)
}
