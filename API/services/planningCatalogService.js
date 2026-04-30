const { randomUUID } = require('crypto')
const { ensureDatabaseConnection } = require('../config/dbConfig')
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
const DEFAULT_SITE_PLANNING_COLORS = [
  '#1D4ED8',
  '#0F766E',
  '#BE185D',
  '#7C3AED',
  '#C2410C',
  '#0891B2',
  '#4F46E5',
  '#65A30D'
]
const DEFAULT_STAKEHOLDER_ICONS = {
  candidate: 'candidate',
  expert1: 'participant',
  expert2: 'participant',
  projectManager: 'participant'
}
const CANDIDATE_STAKEHOLDER_ICON_VALUES = new Set([
  'candidate',
  'candidate-green',
  'candidate-violet',
  'candidate-rose',
  'candidate-gold'
])
const HELMET_STAKEHOLDER_ICON_VALUES = new Set([
  'participant',
  'helmet-orange',
  'helmet-green',
  'helmet-blue',
  'helmet-black',
  'helmet-gray'
])
const STAKEHOLDER_ICON_VALUES = new Set([
  ...CANDIDATE_STAKEHOLDER_ICON_VALUES,
  ...HELMET_STAKEHOLDER_ICON_VALUES
])

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function normalizePlanningColor(value) {
  const hex = compactText(value).replace(/^#/, '')

  if (/^[\da-fA-F]{3}$/.test(hex)) {
    return `#${hex
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toUpperCase()}`
  }

  if (/^[\da-fA-F]{6}$/.test(hex)) {
    return `#${hex.toUpperCase()}`
  }

  return ''
}

function normalizeOptionalPlanningColor(source = {}, fallback = {}, keys = ['tpiColor', 'tpiCardColor']) {
  const sourceObject = source && typeof source === 'object' ? source : {}
  const fallbackObject = fallback && typeof fallback === 'object' ? fallback : {}

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(sourceObject, key)) {
      return normalizePlanningColor(sourceObject[key])
    }
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(fallbackObject, key)) {
      return normalizePlanningColor(fallbackObject[key])
    }
  }

  return ''
}

function normalizeOptionalSoutenanceColor(source = {}, fallback = {}) {
  return normalizeOptionalPlanningColor(source, fallback, ['soutenanceColor', 'defenseColor', 'defenceColor'])
}

function normalizeStakeholderIconKey(value, fallback = 'participant', role = '') {
  const normalizedValue = compactText(value)
  const allowedValues = role === 'candidate'
    ? CANDIDATE_STAKEHOLDER_ICON_VALUES
    : role
      ? HELMET_STAKEHOLDER_ICON_VALUES
      : STAKEHOLDER_ICON_VALUES
  const defaultFallback = role === 'candidate' ? DEFAULT_STAKEHOLDER_ICONS.candidate : 'participant'
  const normalizedFallback = compactText(fallback)
  const safeFallback = allowedValues.has(normalizedFallback) ? normalizedFallback : defaultFallback

  return allowedValues.has(normalizedValue)
    ? normalizedValue
    : safeFallback
}

function normalizeStakeholderIcons(value = {}, fallback = DEFAULT_STAKEHOLDER_ICONS) {
  const source = value && typeof value === 'object' ? value : {}
  const fallbackSource = fallback && typeof fallback === 'object' ? fallback : DEFAULT_STAKEHOLDER_ICONS

  return {
    candidate: normalizeStakeholderIconKey(
      source.candidate,
      fallbackSource.candidate || DEFAULT_STAKEHOLDER_ICONS.candidate,
      'candidate'
    ),
    expert1: normalizeStakeholderIconKey(
      source.expert1,
      fallbackSource.expert1 || DEFAULT_STAKEHOLDER_ICONS.expert1,
      'expert1'
    ),
    expert2: normalizeStakeholderIconKey(
      source.expert2,
      fallbackSource.expert2 || DEFAULT_STAKEHOLDER_ICONS.expert2,
      'expert2'
    ),
    projectManager: normalizeStakeholderIconKey(
      source.projectManager || source.boss,
      fallbackSource.projectManager || DEFAULT_STAKEHOLDER_ICONS.projectManager,
      'projectManager'
    )
  }
}

function getDefaultPlanningColor(seed = '', fallbackIndex = 0) {
  const normalizedSeed = compactText(seed).toUpperCase()

  if (!normalizedSeed) {
    return DEFAULT_SITE_PLANNING_COLORS[Math.abs(Number(fallbackIndex) || 0) % DEFAULT_SITE_PLANNING_COLORS.length]
  }

  let hash = 0
  for (const character of normalizedSeed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return DEFAULT_SITE_PLANNING_COLORS[hash % DEFAULT_SITE_PLANNING_COLORS.length]
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
  const fallbackEntries = Array.isArray(fallback) ? fallback : []
  const fallbackById = new Map()
  const fallbackByKey = new Map()

  fallbackEntries.forEach((entry) => {
    const fallbackSource = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? entry
      : { code: entry, label: entry }
    const fallbackId = compactText(fallbackSource.id).toLowerCase()
    const fallbackKeys = [
      fallbackSource.code,
      fallbackSource.label,
      fallbackSource.name
    ].map((value) => compactText(value).toLowerCase()).filter(Boolean)

    if (fallbackId) {
      fallbackById.set(fallbackId, fallbackSource)
    }

    fallbackKeys.forEach((key) => {
      if (!fallbackByKey.has(key)) {
        fallbackByKey.set(key, fallbackSource)
      }
    })
  })
  const normalized = []
  const seen = new Set()

  rawEntries.forEach((entry, index) => {
    const source = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? entry
      : { code: entry, label: entry }
    const code = compactText(source.code || source.label || source.name || '').toUpperCase()
    const label = compactText(source.label || source.name || source.code || code)
    const sourceId = compactText(source.id)
    const fallbackSource =
      fallbackById.get(sourceId.toLowerCase()) ||
      fallbackByKey.get(compactText(code || label).toLowerCase()) ||
      fallbackEntries[index] ||
      {}

    if (!code && !label) {
      return
    }

    const id = sourceId || compactText(fallbackSource.id) || makeStableId('room', siteCode, code || label)
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
      soutenanceColor: normalizeOptionalSoutenanceColor(source, fallbackSource),
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
    planningColor: normalizePlanningColor(
      source.planningColor ||
      source.color ||
      fallbackSource.planningColor ||
      fallbackSource.color ||
      getDefaultPlanningColor(code || label)
    ),
    tpiColor: normalizeOptionalPlanningColor(source, fallbackSource),
    soutenanceColor: normalizeOptionalSoutenanceColor(source, fallbackSource),
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
    stakeholderIcons: { ...DEFAULT_STAKEHOLDER_ICONS },
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
    stakeholderIcons: normalizeStakeholderIcons(source.stakeholderIcons, fallback.stakeholderIcons),
    sites: sortSitesByInputOrder(normalizedInOrder)
  }
}

async function getSharedPlanningCatalog() {
  await ensureDatabaseConnection({
    errorMessage: 'Catalogue partagé indisponible: connexion MongoDB impossible.'
  })

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
        stakeholderIcons: { ...DEFAULT_STAKEHOLDER_ICONS },
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
  await ensureDatabaseConnection({
    errorMessage: 'Catalogue partagé indisponible: connexion MongoDB impossible.'
  })

  const fallback = await getSharedPlanningCatalog()
  const normalizedCatalog = normalizeStoredCatalog(payload, fallback)

  const document = await PlanningSharedCatalog.findOneAndUpdate(
    { key: 'shared' },
    {
      key: 'shared',
      schemaVersion: normalizedCatalog.schemaVersion,
      stakeholderIcons: normalizedCatalog.stakeholderIcons,
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
  normalizeStakeholderIcons,
  normalizeStoredCatalog,
  saveSharedPlanningCatalog
}
