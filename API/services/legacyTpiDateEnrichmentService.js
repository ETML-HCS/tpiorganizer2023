const mongoose = require('mongoose')
const PlanningConfig = require('../models/planningConfigModel')
const PublicationVersion = require('../models/publicationVersionModel')

const defaultPlanningConfigFindOne = PlanningConfig.findOne
const defaultPublicationVersionFindOne = PublicationVersion.findOne

const DEFAULT_CLASS_TYPES = [
  { code: 'CFC', prefix: 'C', label: 'CFC' },
  { code: 'FPA', prefix: 'F', label: 'FPA' },
  { code: 'MATU', prefix: 'M', label: 'MATU' }
]

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function normalizeToken(value) {
  return compactText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase()
}

function uniqueList(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)))
}

function resolveQuery(query) {
  if (!query) {
    return Promise.resolve(null)
  }

  if (typeof query.lean === 'function') {
    return query.lean()
  }

  return Promise.resolve(query)
}

async function resolveOptionalContextValue(query, fallbackValue, label, year) {
  try {
    return await resolveQuery(query)
  } catch (error) {
    console.warn(
      `Impossible de charger ${label} pour ${year}; enrichissement partiel utilise.`,
      error?.message || error
    )
    return fallbackValue
  }
}

function extractLegacyRefFromWorkflowReference(value) {
  const rawValue = compactText(value)
  const workflowMatch = rawValue.match(/^TPI-\d{4}-(.+)$/i)

  return workflowMatch?.[1]
    ? compactText(workflowMatch[1])
    : ''
}

function buildLegacyRefCandidates(value, year = null) {
  const rawValue = compactText(value)

  if (!rawValue) {
    return []
  }

  const workflowLegacyRef = extractLegacyRefFromWorkflowReference(rawValue)
  if (workflowLegacyRef) {
    return uniqueList([rawValue, workflowLegacyRef])
  }

  if (/^TPI-/i.test(rawValue)) {
    return [rawValue]
  }

  const normalizedYear = Number.parseInt(year, 10)
  const workflowReference = Number.isInteger(normalizedYear)
    ? `TPI-${normalizedYear}-${rawValue}`
    : ''

  return uniqueList([rawValue, workflowReference])
}

function buildLegacyRefFilter(fieldName, value, year = null) {
  const candidates = buildLegacyRefCandidates(value, year)

  if (candidates.length === 0) {
    return { [fieldName]: compactText(value) }
  }

  if (candidates.length === 1) {
    return { [fieldName]: candidates[0] }
  }

  return {
    [fieldName]: {
      $in: candidates
    }
  }
}

function matchesToken(left, right) {
  const normalizedLeft = normalizeToken(left)
  const normalizedRight = normalizeToken(right)

  if (!normalizedLeft || !normalizedRight) {
    return false
  }

  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.startsWith(normalizedRight) ||
    normalizedRight.startsWith(normalizedLeft)
  )
}

function resolveMatchingClassType(rawClassValue, classTypes = []) {
  const normalizedClassValue = normalizeToken(rawClassValue)
  const candidates = Array.isArray(classTypes) && classTypes.length > 0
    ? classTypes
    : DEFAULT_CLASS_TYPES

  if (!normalizedClassValue) {
    return null
  }

  return candidates.find((classType) => {
    const tokens = [
      classType?.code,
      classType?.prefix,
      classType?.label,
      ...(Array.isArray(classType?.aliases) ? classType.aliases : [])
    ]

    return tokens.some((token) => matchesToken(normalizedClassValue, token))
  }) || null
}

function hasDateValue(value) {
  if (!value) {
    return false
  }

  const date = new Date(value)
  return !Number.isNaN(date.getTime())
}

function buildPublicationLookup(rooms = [], year = null) {
  const lookup = new Map()

  for (const room of Array.isArray(rooms) ? rooms : []) {
    const roomDate = room?.date ? new Date(room.date) : null

    if (!(roomDate instanceof Date) || Number.isNaN(roomDate.getTime())) {
      continue
    }

    const entry = {
      date: roomDate,
      roomName: compactText(room?.name),
      site: compactText(room?.site)
    }

    for (const tpiData of Array.isArray(room?.tpiDatas) ? room.tpiDatas : []) {
      for (const candidate of buildLegacyRefCandidates(tpiData?.refTpi, year)) {
        const normalizedCandidate = normalizeToken(candidate)

        if (normalizedCandidate) {
          lookup.set(normalizedCandidate, entry)
        }
      }
    }
  }

  return lookup
}

function findPublicationEntry(refTpi, year, publicationLookup = null) {
  if (!(publicationLookup instanceof Map) || publicationLookup.size === 0) {
    return null
  }

  for (const candidate of buildLegacyRefCandidates(refTpi, year)) {
    const normalizedCandidate = normalizeToken(candidate)

    if (!normalizedCandidate) {
      continue
    }

    const publicationEntry = publicationLookup.get(normalizedCandidate)
    if (publicationEntry) {
      return publicationEntry
    }
  }

  return null
}

function toPlainObject(value) {
  if (!value) {
    return null
  }

  if (typeof value.toObject === 'function') {
    return value.toObject({ depopulate: true, minimize: false, versionKey: false })
  }

  return { ...value }
}

function enrichLegacyTpiWithDerivedDates(tpi, options = {}) {
  const plainTpi = toPlainObject(tpi)

  if (!plainTpi) {
    return plainTpi
  }

  const normalizedYear = Number.parseInt(options.year, 10)
  const classTypes = Array.isArray(options?.planningConfig?.classTypes)
    ? options.planningConfig.classTypes
    : []
  const publicationEntry = findPublicationEntry(
    plainTpi.refTpi,
    normalizedYear,
    options.publicationLookup
  )
  const matchingClassType = resolveMatchingClassType(plainTpi.classe, classTypes)
  const nextDates = {
    ...(plainTpi?.dates && typeof plainTpi.dates === 'object' ? plainTpi.dates : {})
  }
  const nextLieu = {
    ...(plainTpi?.lieu && typeof plainTpi.lieu === 'object' ? plainTpi.lieu : {})
  }

  if (!hasDateValue(nextDates.depart) && compactText(matchingClassType?.startDate)) {
    nextDates.depart = compactText(matchingClassType.startDate)
  }

  if (!hasDateValue(nextDates.fin) && compactText(matchingClassType?.endDate)) {
    nextDates.fin = compactText(matchingClassType.endDate)
  }

  if (publicationEntry?.date) {
    nextDates.soutenance = publicationEntry.date
  }

  if (publicationEntry?.roomName) {
    plainTpi.salle = publicationEntry.roomName
  }

  if (publicationEntry?.site) {
    nextLieu.site = publicationEntry.site
  }

  return {
    ...plainTpi,
    lieu: nextLieu,
    dates: nextDates
  }
}

async function loadLegacyTpiDateEnrichmentContext(year, options = {}) {
  const normalizedYear = Number.parseInt(year, 10)

  if (!Number.isInteger(normalizedYear)) {
    return {
      planningConfig: { classTypes: [] },
      publicationLookup: new Map()
    }
  }

  const canQueryOptionalContext = mongoose.connection.readyState === 1
  const hasPatchedPlanningConfigQuery = PlanningConfig.findOne !== defaultPlanningConfigFindOne
  const hasPatchedPublicationVersionQuery = PublicationVersion.findOne !== defaultPublicationVersionFindOne

  const [planningConfigDocument, publicationVersion] = await Promise.all([
    resolveOptionalContextValue(
      options.planningConfig !== undefined
        ? options.planningConfig
        : canQueryOptionalContext || hasPatchedPlanningConfigQuery
          ? PlanningConfig.findOne({ year: normalizedYear })
          : { classTypes: [] },
      { classTypes: [] },
      'la configuration de planification',
      normalizedYear
    ),
    resolveOptionalContextValue(
      options.publicationVersion !== undefined
        ? options.publicationVersion
        : canQueryOptionalContext || hasPatchedPublicationVersionQuery
          ? PublicationVersion.findOne({ year: normalizedYear, isActive: true })
          : null,
      null,
      'la publication active des soutenances',
      normalizedYear
    )
  ])

  return {
    planningConfig: planningConfigDocument && typeof planningConfigDocument === 'object'
      ? planningConfigDocument
      : { classTypes: [] },
    publicationLookup: buildPublicationLookup(publicationVersion?.rooms, normalizedYear)
  }
}

async function enrichLegacyTpisWithDerivedDates(year, tpis = [], options = {}) {
  const sourceTpis = Array.isArray(tpis) ? tpis : []

  if (sourceTpis.length === 0) {
    return []
  }

  const context = await loadLegacyTpiDateEnrichmentContext(year, options)

  return sourceTpis.map((tpi) => enrichLegacyTpiWithDerivedDates(tpi, {
    ...context,
    year
  }))
}

module.exports = {
  buildLegacyRefCandidates,
  buildLegacyRefFilter,
  enrichLegacyTpiWithDerivedDates,
  enrichLegacyTpisWithDerivedDates,
  extractLegacyRefFromWorkflowReference,
  loadLegacyTpiDateEnrichmentContext
}
