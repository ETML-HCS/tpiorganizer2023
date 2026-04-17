const compactText = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

const normalizeCatalogValue = (value) =>
  compactText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase()

const normalizeIdSegment = (value) =>
  compactText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

const makeStableId = (prefix, ...parts) => {
  const normalizedParts = parts
    .map((part) => normalizeIdSegment(part))
    .filter(Boolean)

  if (normalizedParts.length === 0) {
    const generatedUuid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`

    return `${prefix}-${generatedUuid}`
  }

  return [prefix, ...normalizedParts].join('-')
}

const matchesPlanningValue = (value, candidate) => {
  const normalizedValue = normalizeCatalogValue(value)
  const normalizedCandidate = normalizeCatalogValue(candidate)

  if (!normalizedValue || !normalizedCandidate) {
    return false
  }

  if (normalizedValue === normalizedCandidate) {
    return true
  }

  if (
    normalizedValue.startsWith(normalizedCandidate) ||
    normalizedCandidate.startsWith(normalizedValue)
  ) {
    return true
  }

  if (normalizedValue.length >= 3 && normalizedCandidate.includes(normalizedValue)) {
    return true
  }

  if (normalizedCandidate.length >= 3 && normalizedValue.includes(normalizedCandidate)) {
    return true
  }

  return false
}

const normalizeCatalogAliases = (value) =>
  Array.isArray(value)
    ? value.map((entry) => normalizeCatalogValue(entry)).filter(Boolean)
    : []

export const normalizePlanningCatalogClassEntry = (entry, index = 0, siteCode = '', baseType = '') => {
  const source = entry && typeof entry === 'object' && !Array.isArray(entry)
    ? entry
    : { code: entry, label: entry }
  const code = normalizeCatalogValue(source.code || source.label || source.name)
  const label = compactText(source.label || source.name || code)
  const normalizedSiteCode = normalizeCatalogValue(siteCode)
  const normalizedBaseType = normalizeCatalogValue(source.baseType || baseType)

  if (!code && !label) {
    return null
  }

  return {
    ...source,
    id: compactText(source.id || makeStableId('site-class', normalizedSiteCode || normalizedBaseType || code || label, normalizedBaseType || code, code || label)),
    code: code || label,
    label: label || code,
    description: compactText(source.description || source.notes || ''),
    active: source.active !== false,
    order: Number.isFinite(Number(source.order)) ? Number(source.order) : index,
    baseType: normalizedBaseType,
    aliases: normalizeCatalogAliases(source.aliases)
  }
}

export const normalizePlanningCatalogClassEntries = (values, fallback = [], siteCode = '', baseType = '') => {
  const rawEntries = Array.isArray(values) && values.length > 0
    ? values
    : Array.isArray(fallback)
      ? fallback
      : []
  const normalized = []
  const seen = new Set()

  rawEntries.forEach((entry, index) => {
    const fallbackEntry = Array.isArray(fallback) ? fallback[index] || {} : {}
    const normalizedEntry = normalizePlanningCatalogClassEntry(entry, fallbackEntry, siteCode, baseType)

    if (!normalizedEntry) {
      return
    }

    const dedupeKey = compactText(normalizedEntry.id || '').toLowerCase() || normalizeCatalogValue(normalizedEntry.code)
    if (seen.has(dedupeKey)) {
      return
    }

    seen.add(dedupeKey)
    normalized.push({
      ...normalizedEntry,
      order: Number.isFinite(Number(normalizedEntry.order)) ? Number(normalizedEntry.order) : index
    })
  })

  return normalized.sort((left, right) => {
    const leftOrder = Number.isFinite(Number(left.order)) ? Number(left.order) : 0
    const rightOrder = Number.isFinite(Number(right.order)) ? Number(right.order) : 0

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    return compactText(left.code).localeCompare(compactText(right.code))
  })
}

export const normalizePlanningCatalogClassGroup = (value, fallback = {}, siteCode = '') => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
  const fallbackSource = fallback && typeof fallback === 'object' && !Array.isArray(fallback)
    ? fallback
    : {}
  const baseType = normalizeCatalogValue(
    source.baseType ||
    source.code ||
    source.label ||
    fallbackSource.baseType ||
    fallbackSource.code ||
    fallbackSource.label
  )
  const normalizedSiteCode = normalizeCatalogValue(siteCode)
  const id = compactText(
    source.id ||
    fallbackSource.id ||
    makeStableId('site-class-group', normalizedSiteCode || baseType, baseType)
  )
  const classSource =
    source.classes ??
    source.classEntries ??
    source.items ??
    fallbackSource.classes ??
    fallbackSource.classEntries ??
    fallbackSource.items ??
    []

  return {
    ...source,
    id,
    baseType,
    label: compactText(source.label || fallbackSource.label || baseType),
    description: compactText(source.description || source.notes || fallbackSource.description || fallbackSource.notes || ''),
    active: source.active !== false && fallbackSource.active !== false,
    order: Number.isFinite(Number(source.order))
      ? Number(source.order)
      : Number.isFinite(Number(fallbackSource.order))
        ? Number(fallbackSource.order)
        : 0,
    classes: normalizePlanningCatalogClassEntries(classSource, fallbackSource.classes || [], normalizedSiteCode, baseType)
  }
}

export const normalizePlanningCatalogClassGroups = (values, fallback = [], siteCode = '') => {
  const sourceGroups = Array.isArray(values) && values.length > 0
    ? values
    : Array.isArray(fallback)
      ? fallback
      : []
  const normalized = []
  const seen = new Set()

  sourceGroups.forEach((group, index) => {
    const fallbackGroup = Array.isArray(fallback) ? fallback[index] || {} : {}
    const normalizedGroup = normalizePlanningCatalogClassGroup(group, fallbackGroup, siteCode)

    if (!normalizedGroup.baseType) {
      return
    }

    const dedupeKey = compactText(normalizedGroup.id || '').toLowerCase() || normalizedGroup.baseType
    if (seen.has(dedupeKey)) {
      return
    }

    seen.add(dedupeKey)
    normalized.push({
      ...normalizedGroup,
      order: Number.isFinite(Number(normalizedGroup.order)) ? Number(normalizedGroup.order) : index
    })
  })

  return normalized.sort((left, right) => {
    const leftOrder = Number.isFinite(Number(left.order)) ? Number(left.order) : 0
    const rightOrder = Number.isFinite(Number(right.order)) ? Number(right.order) : 0

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    return compactText(left.baseType).localeCompare(compactText(right.baseType))
  })
}

export const normalizePlanningCatalogSite = (value, fallback = {}) => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
  const fallbackSource = fallback && typeof fallback === 'object' && !Array.isArray(fallback)
    ? fallback
    : {}
  const code = normalizeCatalogValue(source.code || fallbackSource.code || '')
  const label = compactText(source.label || source.name || fallbackSource.label || fallbackSource.name || code)
  const siteId = compactText(source.id || fallbackSource.id || makeStableId('site', code || label || fallbackSource.code || fallbackSource.label))
  const classSource =
    source.classGroups ??
    source.classes ??
    source.classCatalog ??
    fallbackSource.classGroups ??
    fallbackSource.classes ??
    fallbackSource.classCatalog ??
    []

  return {
    ...source,
    id: siteId,
    code: code || label,
    label: label || code,
    aliases: normalizeCatalogAliases(source.aliases || fallbackSource.aliases),
    classGroups: normalizePlanningCatalogClassGroups(classSource, fallbackSource.classGroups || fallbackSource.classes || [], code)
  }
}

export const normalizePlanningCatalogSites = (sites = []) => {
  const sourceSites = Array.isArray(sites) ? sites : []
  const normalized = []
  const seen = new Set()

  sourceSites.forEach((site, index) => {
    const normalizedSite = normalizePlanningCatalogSite(site, {})

    if (!normalizedSite.code && !normalizedSite.id) {
      return
    }

    const dedupeKey = compactText(normalizedSite.id || '').toLowerCase() || normalizedSite.code
    if (seen.has(dedupeKey)) {
      return
    }

    seen.add(dedupeKey)
    normalized.push({
      ...normalizedSite,
      order: Number.isFinite(Number(normalizedSite.order)) ? Number(normalizedSite.order) : index
    })
  })

  return normalized.sort((left, right) => {
    const leftOrder = Number.isFinite(Number(left.order)) ? Number(left.order) : 0
    const rightOrder = Number.isFinite(Number(right.order)) ? Number(right.order) : 0

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    return compactText(left.label || left.code).localeCompare(compactText(right.label || right.code))
  })
}

export const resolvePlanningCatalogSite = (siteValue, sites = []) => {
  const normalizedSiteValue = normalizeCatalogValue(siteValue)
  if (!normalizedSiteValue) {
    return null
  }

  const normalizedSites = normalizePlanningCatalogSites(sites)

  return normalizedSites.find((site) => {
    const tokens = [
      site.id,
      site.code,
      site.label,
      ...(Array.isArray(site.aliases) ? site.aliases : [])
    ].filter(Boolean)

    return tokens.some((token) => matchesPlanningValue(normalizedSiteValue, token))
  }) || null
}

export const resolvePlanningCatalogClass = (value, catalogSites = [], siteValue = '') => {
  const normalizedClassValue = normalizeCatalogValue(value)
  if (!normalizedClassValue) {
    return null
  }

  const normalizedSites = normalizePlanningCatalogSites(catalogSites)
  const resolvedSite = resolvePlanningCatalogSite(siteValue, normalizedSites)
  const orderedSites = resolvedSite
    ? [
        resolvedSite,
        ...normalizedSites.filter((site) => {
          const siteId = normalizeCatalogValue(site.id)
          const siteCode = normalizeCatalogValue(site.code)
          return siteId !== normalizeCatalogValue(resolvedSite.id) && siteCode !== normalizeCatalogValue(resolvedSite.code)
        })
      ]
    : normalizedSites

  for (const site of orderedSites) {
    const classGroups = Array.isArray(site.classGroups) ? site.classGroups : []

    for (const group of classGroups) {
      const classEntries = Array.isArray(group.classes) ? group.classes : []

      const matchingClass = classEntries.find((classEntry) => {
        const tokens = [
          classEntry.id,
          classEntry.code,
          classEntry.label,
          ...(Array.isArray(classEntry.aliases) ? classEntry.aliases : [])
        ].filter(Boolean)

        return tokens.some((token) => matchesPlanningValue(normalizedClassValue, token))
      })

      if (matchingClass) {
        return {
          site,
          group,
          classEntry: matchingClass,
          matchSource: 'class'
        }
      }

      if (matchesPlanningValue(normalizedClassValue, group.baseType) || matchesPlanningValue(normalizedClassValue, group.label)) {
        return {
          site,
          group,
          classEntry: null,
          matchSource: 'group'
        }
      }
    }
  }

  return null
}
