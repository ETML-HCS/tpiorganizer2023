const { randomUUID } = require('crypto')
const PlanningSharedCatalog = require('../models/planningSharedCatalogModel')

const DEFAULT_SCHEMA_VERSION = 2
const DEFAULT_ADDRESS = {
  line1: '',
  line2: '',
  postalCode: '',
  city: '',
  canton: '',
  country: ''
}
const DEFAULT_SITE_CLASS_BASE_TYPES = ['CFC', 'FPA', 'MATU']

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function normalizeIdSegment(value) {
  return compactText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function makeStableId(prefix, ...parts) {
  const normalizedParts = parts
    .map((part) => normalizeIdSegment(part))
    .filter(Boolean)

  if (normalizedParts.length === 0) {
    return `${prefix}-${randomUUID()}`
  }

  return [prefix, ...normalizedParts].join('-')
}

function normalizeAddress(value = {}) {
  const source = value && typeof value === 'object' ? value : {}

  return {
    line1: compactText(source.line1 || source.addressLine1 || source.street || ''),
    line2: compactText(source.line2 || source.addressLine2 || source.street2 || ''),
    postalCode: compactText(source.postalCode || source.zip || source.npa || ''),
    city: compactText(source.city || ''),
    canton: compactText(source.canton || ''),
    country: compactText(source.country || '')
  }
}

function normalizeRoomDetails(values, fallback = [], siteCode = '') {
  const rawEntries = Array.isArray(values)
    ? values
    : Array.isArray(fallback)
      ? fallback
      : []
  const normalized = []
  const seen = new Set()

  rawEntries.forEach((entry, index) => {
    const source = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? entry
      : { code: entry, label: entry }
    const code = compactText(source.code || source.label || source.name || '').toUpperCase()
    const label = compactText(source.label || source.name || source.code || code)

    if (!code && !label) {
      return
    }

    const id = compactText(source.id || makeStableId('room', siteCode, code || label))
    const dedupeKey = compactText(source.id || '').toLowerCase() || compactText(code || label).toLowerCase()

    if (seen.has(dedupeKey)) {
      return
    }

    seen.add(dedupeKey)
    const capacity = Number(source.capacity)

    normalized.push({
      id,
      code: code || label,
      label: label || code,
      capacity: Number.isFinite(capacity) ? capacity : null,
      notes: compactText(source.notes || ''),
      active: source.active !== false,
      order: Number.isFinite(Number(source.order)) ? Number(source.order) : index
    })
  })

  return normalized
}

function normalizeRoomNames(roomDetails) {
  return Array.from(
    new Set(
      (Array.isArray(roomDetails) ? roomDetails : [])
        .map((room) => compactText(room?.label || room?.code))
        .filter(Boolean)
    )
  )
}

function normalizeClassTypeCode(value) {
  return compactText(value).toUpperCase().replace(/[^A-Z0-9]+/g, '')
}

function normalizeSiteClassEntry(value, fallback = {}, siteCode = '', baseType = '') {
  const source = value && typeof value === 'object' ? value : {}
  const fallbackSource = fallback && typeof fallback === 'object' ? fallback : {}
  const normalizedSiteCode = normalizeClassTypeCode(siteCode)
  const normalizedBaseType = normalizeClassTypeCode(
    source.baseType ||
    source.type ||
    source.group ||
    baseType ||
    fallbackSource.baseType ||
    fallbackSource.type ||
    fallbackSource.group
  )
  const code = normalizeClassTypeCode(source.code || source.label || source.name || fallbackSource.code || fallbackSource.label || fallbackSource.name)
  const label = compactText(source.label || source.name || fallbackSource.label || fallbackSource.name || code)
  const id = compactText(
    source.id ||
    fallbackSource.id ||
    makeStableId('site-class', normalizedSiteCode || normalizedBaseType || code || label, normalizedBaseType || code, code || label)
  )

  if (!code && !label) {
    return null
  }

  return {
    id,
    code: code || label,
    label: label || code,
    description: compactText(source.description || source.notes || fallbackSource.description || fallbackSource.notes || ''),
    active: source.active !== false && fallbackSource.active !== false,
    order: Number.isFinite(Number(source.order))
      ? Number(source.order)
      : Number.isFinite(Number(fallbackSource.order))
        ? Number(fallbackSource.order)
        : 0
  }
}

function normalizeSiteClassEntries(values, fallback = [], siteCode = '', baseType = '') {
  const rawEntries = Array.isArray(values)
    ? values
    : Array.isArray(fallback)
      ? fallback
      : []
  const normalized = []
  const seen = new Set()

  rawEntries.forEach((entry, index) => {
    const fallbackEntry = Array.isArray(fallback) ? fallback[index] || {} : {}
    const normalizedEntry = normalizeSiteClassEntry(entry, fallbackEntry, siteCode, baseType)

    if (!normalizedEntry) {
      return
    }

    const dedupeKey = compactText(normalizedEntry.id || '').toLowerCase() || compactText(normalizedEntry.code).toUpperCase()
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

function normalizeSiteClassGroup(value, fallback = {}, siteCode = '') {
  const source = value && typeof value === 'object' ? value : {}
  const fallbackSource = fallback && typeof fallback === 'object' ? fallback : {}
  const baseType = normalizeClassTypeCode(
    source.baseType ||
    source.code ||
    source.label ||
    fallbackSource.baseType ||
    fallbackSource.code ||
    fallbackSource.label
  )
  const normalizedSiteCode = normalizeClassTypeCode(siteCode)
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
    classes: normalizeSiteClassEntries(classSource, fallbackSource.classes || [], normalizedSiteCode, baseType)
  }
}

function normalizeSiteClassGroups(values, fallback = [], siteCode = '') {
  const sourceGroups = Array.isArray(values)
    ? values
    : Array.isArray(fallback)
      ? fallback
      : []
  const normalized = []
  const seen = new Set()

  sourceGroups.forEach((group, index) => {
    const fallbackGroup = Array.isArray(fallback) ? fallback[index] || {} : {}
    const normalizedGroup = normalizeSiteClassGroup(group, fallbackGroup, siteCode)

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

  return normalized
}

function seedDefaultSiteClassGroups(siteCode, groups = []) {
  const normalizedGroups = normalizeSiteClassGroups(groups, [], siteCode)
  const groupsByBaseType = new Map(
    normalizedGroups
      .filter((group) => group?.baseType)
      .map((group) => [group.baseType, group])
  )

  const seededDefaults = DEFAULT_SITE_CLASS_BASE_TYPES.map((baseType, index) => {
    const existing = groupsByBaseType.get(baseType)
    if (existing) {
      return {
        ...existing,
        order: Number.isFinite(Number(existing.order)) ? Number(existing.order) : index
      }
    }

    return normalizeSiteClassGroup(
      {
        baseType,
        label: baseType,
        description: ''
      },
      {
        baseType,
        label: baseType,
        description: '',
        order: index
      },
      siteCode
    )
  })

  const customGroups = normalizedGroups.filter((group) => !DEFAULT_SITE_CLASS_BASE_TYPES.includes(group.baseType))
  return [...seededDefaults, ...customGroups]
}

function extractSitesFromPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  if (Array.isArray(payload.sites)) {
    return payload.sites
  }

  return Object.keys(payload)
    .filter((key) => ![
      'key',
      'schemaVersion',
      'sites',
      'createdAt',
      'updatedAt'
    ].includes(key))
    .map((siteCode) => ({
      code: siteCode,
      ...(payload[siteCode] && typeof payload[siteCode] === 'object' ? payload[siteCode] : {})
    }))
}

function normalizeSiteCatalog(value, fallback = {}) {
  const source = value && typeof value === 'object' ? value : {}
  const fallbackSource = fallback && typeof fallback === 'object' ? fallback : {}
  const code = compactText(source.code || fallbackSource.code || '').toUpperCase()
  const label = compactText(source.label || source.name || fallbackSource.label || fallbackSource.name || code)
  const siteId = compactText(source.id || fallbackSource.id || makeStableId('site', code || label || fallbackSource.code || fallbackSource.label))
  const roomSource =
    source.roomDetails ??
    source.rooms ??
    source.roomsText ??
    fallbackSource.roomDetails ??
    fallbackSource.rooms ??
    []
  const classSource =
    source.classGroups ??
    source.classes ??
    source.classCatalog ??
    fallbackSource.classGroups ??
    fallbackSource.classes ??
    fallbackSource.classCatalog ??
    []

  let roomDetails = []
  if (typeof roomSource === 'string') {
    roomDetails = normalizeRoomDetails(
      roomSource
        .split(/\r?\n/)
        .map((line) => compactText(line))
        .filter(Boolean)
        .map((line, index) => ({
          code: line,
          label: line,
          order: index
        })),
      [],
      code
    )
  } else {
    roomDetails = normalizeRoomDetails(roomSource, fallbackSource.roomDetails || [], code)
  }

  const classGroups = seedDefaultSiteClassGroups(
    code,
    normalizeSiteClassGroups(classSource, fallbackSource.classGroups || fallbackSource.classes || [], code)
  )

  return {
    id: siteId,
    code,
    label: label || code,
    address: normalizeAddress(source.address || fallbackSource.address),
    rooms: normalizeRoomNames(roomDetails),
    roomDetails,
    classGroups,
    notes: compactText(source.notes || fallbackSource.notes || '')
  }
}

function sortSitesByInputOrder(sites = []) {
  return Array.isArray(sites) ? sites : []
}

function buildDefaultPlanningCatalog() {
  return {
    key: 'shared',
    schemaVersion: DEFAULT_SCHEMA_VERSION,
    sites: []
  }
}

function normalizeStoredCatalog(document, fallbackCatalog = buildDefaultPlanningCatalog()) {
  const source = document && typeof document === 'object' ? document : {}
  const fallback = fallbackCatalog && typeof fallbackCatalog === 'object'
    ? fallbackCatalog
    : buildDefaultPlanningCatalog()
  const fallbackSites = Array.isArray(fallback.sites) ? fallback.sites : []
  const hasExplicitSites = Array.isArray(source.sites)
  const siteEntries = extractSitesFromPayload(source)
  const normalizedById = new Map()
  const normalizedInOrder = []

  siteEntries.forEach((site, index) => {
    const fallbackSite = fallbackSites.find((entry) => entry.code === site?.code) || fallbackSites[index] || {}
    const normalized = normalizeSiteCatalog(site, fallbackSite)

    const normalizedId = compactText(normalized.id || '').toLowerCase()
    if (!normalized.code && !normalizedId) {
      return
    }

    const dedupeKey = normalizedId || normalized.code
    if (normalizedById.has(dedupeKey)) {
      return
    }

    normalizedById.set(dedupeKey, normalized)
    normalizedInOrder.push(normalized)
  })

  if (!hasExplicitSites && siteEntries.length === 0) {
    for (const fallbackSite of fallbackSites) {
      const normalized = normalizeSiteCatalog(fallbackSite)
      const dedupeKey = compactText(normalized.id || '').toLowerCase() || normalized.code
      if (normalized.code && !normalizedById.has(dedupeKey)) {
        normalizedById.set(dedupeKey, normalized)
        normalizedInOrder.push(normalized)
      }
    }
  }

  return {
    key: compactText(source.key || fallback.key || 'shared') || 'shared',
    schemaVersion: Number.isFinite(Number(source.schemaVersion))
      ? Number(source.schemaVersion)
      : Number.isFinite(Number(fallback.schemaVersion))
        ? Number(fallback.schemaVersion)
        : DEFAULT_SCHEMA_VERSION,
    sites: sortSitesByInputOrder(normalizedInOrder)
  }
}

async function getSharedPlanningCatalog() {
  const document = await PlanningSharedCatalog.findOne({ key: 'shared' }).lean()

  if (document) {
    return normalizeStoredCatalog(document)
  }

  const fallback = buildDefaultPlanningCatalog()
  const inserted = await PlanningSharedCatalog.findOneAndUpdate(
    { key: 'shared' },
    {
      $setOnInsert: {
        key: 'shared',
        schemaVersion: DEFAULT_SCHEMA_VERSION,
        sites: []
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  )

  return normalizeStoredCatalog(inserted?.toObject ? inserted.toObject() : inserted, fallback)
}

async function saveSharedPlanningCatalog(payload = {}) {
  const fallback = await getSharedPlanningCatalog()
  const normalizedCatalog = normalizeStoredCatalog(payload, fallback)

  const document = await PlanningSharedCatalog.findOneAndUpdate(
    { key: 'shared' },
    {
      key: 'shared',
      schemaVersion: normalizedCatalog.schemaVersion,
      sites: normalizedCatalog.sites
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  )

  return normalizeStoredCatalog(document?.toObject ? document.toObject() : document, normalizedCatalog)
}

module.exports = {
  buildDefaultPlanningCatalog,
  getSharedPlanningCatalog,
  normalizeAddress,
  normalizeRoomDetails,
  normalizeSiteCatalog,
  normalizeStoredCatalog,
  saveSharedPlanningCatalog
}
