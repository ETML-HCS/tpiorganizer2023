import { applySoutenanceDateYear, normalizeSoutenanceDateEntries } from "./soutenanceDateUtils"

const DEFAULT_OFFER = {
  isValidated: false,
  submit: []
}

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

const DEFAULT_SITE_SCHEDULE = {
  breaklineMinutes: 10,
  tpiTimeMinutes: 60,
  firstTpiStartTime: "08:00",
  numSlots: 8,
  minTpiPerRoom: 3,
  active: true
}

function compactText(value) {
  if (value === null || value === undefined) {
    return ""
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

function normalizeOptionalPlanningColor(source = {}, fallback = {}, keys = ["tpiColor", "tpiCardColor"]) {
  const sourceObject = source && typeof source === "object" ? source : {}
  const fallbackObject = fallback && typeof fallback === "object" ? fallback : {}

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

  return ""
}

function normalizeOptionalSoutenanceColor(source = {}, fallback = {}) {
  return normalizeOptionalPlanningColor(source, fallback, ["soutenanceColor", "defenseColor", "defenceColor"])
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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
}

function makeStableId(prefix, ...parts) {
  const normalizedParts = parts
    .map((part) => normalizeIdSegment(part))
    .filter(Boolean)

  if (normalizedParts.length === 0) {
    return `${prefix}-${Date.now()}`
  }

  return [prefix, ...normalizedParts].join("-")
}

function padTwo(value) {
  return String(value).padStart(2, "0")
}

function decimalHoursToTimeString(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return ""
  }

  const totalMinutes = Math.round(numeric * 60)
  const hours = Math.max(Math.floor(totalMinutes / 60), 0)
  const minutes = Math.max(totalMinutes % 60, 0)

  return `${padTwo(hours)}:${padTwo(minutes)}`
}

function timeStringToDecimalHours(value, fallback = 0) {
  const text = compactText(value)

  if (!text) {
    return fallback
  }

  const [hoursPart, minutesPart] = text.split(":")
  const hours = Number.parseInt(hoursPart, 10)
  const minutes = Number.parseInt(minutesPart || "0", 10)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return fallback
  }

  return hours + minutes / 60
}

function normalizeDateValue(value) {
  const text = compactText(value)

  if (!text) {
    return ""
  }

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) {
    return text.slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

function normalizeTimeValue(value, fallback = DEFAULT_SITE_SCHEDULE.firstTpiStartTime) {
  const text = compactText(value)

  if (!text) {
    return fallback
  }

  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const [hoursPart, minutesPart] = text.split(":")
    const hours = Number.parseInt(hoursPart, 10)
    const minutes = Number.parseInt(minutesPart, 10)

    if (Number.isInteger(hours) && Number.isInteger(minutes) && hours >= 0 && minutes >= 0 && minutes < 60) {
      return `${padTwo(hours)}:${padTwo(minutes)}`
    }
  }

  const decimal = Number(text)
  if (Number.isFinite(decimal)) {
    const converted = decimalHoursToTimeString(decimal)
    if (converted) {
      return converted
    }
  }

  return fallback
}

function normalizeMinuteValue(value, fallbackMinutes, legacyHoursFallback = null) {
  const normalizedValue = compactText(value)
  const numeric = normalizedValue === "" ? Number.NaN : Number(normalizedValue)

  if (Number.isFinite(numeric)) {
    return numeric
  }

  const normalizedLegacyValue = compactText(legacyHoursFallback)
  const legacyNumeric = normalizedLegacyValue === "" ? Number.NaN : Number(normalizedLegacyValue)

  if (Number.isFinite(legacyNumeric)) {
    return Math.round(legacyNumeric * 60)
  }

  return fallbackMinutes
}

function extractSiteConfigEntries(value) {
  if (!value || typeof value !== "object") {
    return []
  }

  if (Array.isArray(value)) {
    return value
  }

  if (Array.isArray(value.siteConfigs)) {
    return value.siteConfigs
  }

  if (value.siteConfigsByCode && typeof value.siteConfigsByCode === "object") {
    return Object.entries(value.siteConfigsByCode).map(([siteCode, siteConfig]) => ({
      siteCode,
      ...(siteConfig && typeof siteConfig === "object" ? siteConfig : {})
    }))
  }

  const legacySiteCodes = ["etml", "cfpv"]
  const legacyEntries = legacySiteCodes
    .filter((siteCode) => Object.prototype.hasOwnProperty.call(value, siteCode))
    .map((siteCode) => ({
      siteCode: siteCode.toUpperCase(),
      ...(value[siteCode] && typeof value[siteCode] === "object" ? value[siteCode] : {})
    }))

  return legacyEntries
}

function normalizeSiteConfig(siteConfig = {}, fallbackSiteConfig = DEFAULT_SITE_SCHEDULE) {
  const source = siteConfig && typeof siteConfig === "object" ? siteConfig : {}
  const fallback = fallbackSiteConfig && typeof fallbackSiteConfig === "object"
    ? fallbackSiteConfig
    : DEFAULT_SITE_SCHEDULE
  const siteId = compactText(source.siteId || source.id || "")
  const siteCode = compactText(source.siteCode || source.code || source.site || siteId).toUpperCase()
  const label = compactText(source.label || source.name || fallback.label || siteCode || siteId)
  const breaklineMinutes = normalizeMinuteValue(
    source.breaklineMinutes,
    Number.isFinite(Number(fallback.breaklineMinutes)) ? Number(fallback.breaklineMinutes) : DEFAULT_SITE_SCHEDULE.breaklineMinutes,
    source.breakline
  )
  const tpiTimeMinutes = normalizeMinuteValue(
    source.tpiTimeMinutes,
    Number.isFinite(Number(fallback.tpiTimeMinutes)) ? Number(fallback.tpiTimeMinutes) : DEFAULT_SITE_SCHEDULE.tpiTimeMinutes,
    source.tpiTime
  )
  const firstTpiStartTime = normalizeTimeValue(
    source.firstTpiStartTime ?? source.firstTpiStart,
    fallback.firstTpiStartTime || DEFAULT_SITE_SCHEDULE.firstTpiStartTime
  )
  const numSlots = Number.isInteger(Number(source.numSlots)) && Number(source.numSlots) > 0
    ? Number(source.numSlots)
    : Number.isInteger(Number(fallback.numSlots)) && Number(fallback.numSlots) > 0
      ? Number(fallback.numSlots)
      : DEFAULT_SITE_SCHEDULE.numSlots
  const minTpiPerRoom = Number.isInteger(Number(source.minTpiPerRoom)) && Number(source.minTpiPerRoom) > 0
    ? Number(source.minTpiPerRoom)
    : Number.isInteger(Number(fallback.minTpiPerRoom)) && Number(fallback.minTpiPerRoom) > 0
      ? Number(fallback.minTpiPerRoom)
      : DEFAULT_SITE_SCHEDULE.minTpiPerRoom
  const active = source.active !== false && fallback.active !== false

  return {
    id: compactText(source.id || siteId || makeStableId("site-config", siteCode || label)),
    siteId: siteId || compactText(source.id || makeStableId("site", siteCode || label)),
    siteCode,
    label: label || siteCode || siteId,
    planningColor: normalizePlanningColor(
      source.planningColor ||
      source.color ||
      fallback.planningColor ||
      fallback.color ||
      getDefaultPlanningColor(siteCode || label)
    ),
    tpiColor: normalizeOptionalPlanningColor(source, fallback),
    soutenanceColor: normalizeOptionalSoutenanceColor(source, fallback),
    breaklineMinutes,
    tpiTimeMinutes,
    firstTpiStartTime,
    numSlots,
    minTpiPerRoom,
    notes: compactText(source.notes || fallback.notes || ""),
    active,
    breakline: breaklineMinutes / 60,
    tpiTime: tpiTimeMinutes / 60,
    firstTpiStart: timeStringToDecimalHours(firstTpiStartTime, 8)
  }
}

function normalizeSiteConfigEntries(values, fallbackValues = []) {
  const sourceEntries = extractSiteConfigEntries(values)
  const fallbackEntries = extractSiteConfigEntries(fallbackValues)
  const inputEntries = sourceEntries.length > 0 ? sourceEntries : fallbackEntries
  const fallbackById = new Map()
  const fallbackByCode = new Map()
  const normalized = []
  const seen = new Set()

  fallbackEntries.forEach((entry) => {
    const normalizedEntry = normalizeSiteConfig(entry)
    const normalizedId = compactText(normalizedEntry.siteId || normalizedEntry.id || "").toLowerCase()
    const normalizedCode = compactText(normalizedEntry.siteCode).toUpperCase()

    if (normalizedId) {
      fallbackById.set(normalizedId, normalizedEntry)
    }

    if (normalizedCode) {
      fallbackByCode.set(normalizedCode, normalizedEntry)
    }
  })

  inputEntries.forEach((entry, index) => {
    const entryId = compactText(entry?.siteId || entry?.id || "").toLowerCase()
    const entryCode = compactText(entry?.siteCode || entry?.code || entry?.site || "").toUpperCase()
    const fallbackEntry =
      fallbackById.get(entryId) ||
      fallbackByCode.get(entryCode) ||
      fallbackEntries[index] ||
      {}
    const normalizedEntry = normalizeSiteConfig(entry, fallbackEntry)
    const normalizedId = compactText(normalizedEntry.siteId || normalizedEntry.id || "").toLowerCase()
    const normalizedCode = compactText(normalizedEntry.siteCode).toUpperCase()
    const dedupeKey = normalizedId || normalizedCode

    if (!dedupeKey || seen.has(dedupeKey)) {
      return
    }

    seen.add(dedupeKey)
    normalized.push(normalizedEntry)
  })

  return normalized
}

function buildLegacySiteAlias(siteConfigs, siteCode) {
  const code = String(siteCode || "").trim().toUpperCase()
  const siteConfig = Array.isArray(siteConfigs)
    ? siteConfigs.find((entry) => entry.siteCode === code || entry.siteId === code)
    : null

  return normalizeSiteConfig(
    siteConfig || { siteCode: code, label: code },
    { ...DEFAULT_SITE_SCHEDULE, siteCode: code, label: code }
  )
}

function createEmptyPlanningConfig(year = null) {
  const parsedYear = Number.parseInt(year, 10)

  return {
    year: Number.isInteger(parsedYear) ? parsedYear : null,
    schemaVersion: 2,
    classTypes: [],
    soutenanceDates: [],
    siteConfigs: [],
    siteConfigsByCode: {},
    etml: buildLegacySiteAlias([], "ETML"),
    cfpv: buildLegacySiteAlias([], "CFPV")
  }
}

export const combinedScheduleConfig = createEmptyPlanningConfig()

export const createEmptyOffer = () => ({
  ...DEFAULT_OFFER,
  submit: []
})

export const createEmptyTpi = () => ({
  refTpi: null,
  id: "",
  candidat: "",
  candidatPersonId: "",
  expert1: { name: "", personId: "", offres: createEmptyOffer() },
  expert2: { name: "", personId: "", offres: createEmptyOffer() },
  boss: { name: "", personId: "", offres: createEmptyOffer() }
})

export const normalizeOffer = (offer) => ({
  isValidated: Boolean(offer?.isValidated),
  submit: Array.isArray(offer?.submit) ? [...offer.submit] : []
})

const normalizePersonIdValue = (value) => {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

const normalizeStakeholder = (entry, fallbackName = "", fallbackPersonId = "") => {
  const source = entry && typeof entry === "object" ? entry : {}
  const name = typeof entry === "string"
    ? entry
    : source.name ?? fallbackName ?? ""

  return {
    name,
    personId: normalizePersonIdValue(source.personId ?? fallbackPersonId),
    offres: normalizeOffer(source.offres)
  }
}

export const normalizeTpi = (tpi = {}) => {
  return {
    ...createEmptyTpi(),
    refTpi: tpi.refTpi ?? null,
    id: tpi.id ?? "",
    candidat: tpi.candidat ?? "",
    candidatPersonId: normalizePersonIdValue(tpi.candidatPersonId),
    expert1: normalizeStakeholder(
      tpi.expert1,
      tpi.experts?.["1"] ?? tpi.experts?.[1] ?? "",
      tpi.expert1PersonId
    ),
    expert2: normalizeStakeholder(
      tpi.expert2,
      tpi.experts?.["2"] ?? tpi.experts?.[2] ?? "",
      tpi.expert2PersonId
    ),
    boss: normalizeStakeholder(
      tpi.boss,
      typeof tpi.boss === "string" ? tpi.boss : "",
      tpi.bossPersonId
    )
  }
}

export const getSiteConfig = (site, sourceConfig = combinedScheduleConfig) => {
  const siteKey = String(site ?? "").trim().toUpperCase()
  const normalizedSource = sourceConfig && typeof sourceConfig === "object"
    ? sourceConfig
    : combinedScheduleConfig
  const siteConfigs = Array.isArray(normalizedSource.siteConfigs) ? normalizedSource.siteConfigs : []
  const siteConfigsByCode = normalizedSource.siteConfigsByCode && typeof normalizedSource.siteConfigsByCode === "object"
    ? normalizedSource.siteConfigsByCode
    : {}
  const siteConfig =
    siteConfigs.find((entry) => compactText(entry?.siteCode).toUpperCase() === siteKey || compactText(entry?.siteId).toUpperCase() === siteKey) ||
    siteConfigsByCode[siteKey] ||
    siteConfigsByCode[siteKey.toLowerCase()] ||
    normalizedSource[siteKey.toLowerCase()] ||
    normalizedSource[siteKey]

  return normalizeSiteConfig(
    siteConfig || { siteCode: siteKey, label: siteKey },
    { ...DEFAULT_SITE_SCHEDULE, siteCode: siteKey, label: siteKey }
  )
}

export const buildPlanningConfigForYear = (sourceConfig = combinedScheduleConfig, year = null) => {
  const fallbackConfig = sourceConfig && typeof sourceConfig === "object"
    ? sourceConfig
    : combinedScheduleConfig
  const parsedYear = Number.parseInt(year, 10)
  const normalizedDates = normalizeSoutenanceDateEntries(
    fallbackConfig?.soutenanceDates || []
  ).map((entry) => {
    if (!Number.isInteger(parsedYear)) {
      return entry
    }

    const adjustedDate = applySoutenanceDateYear(entry.date, parsedYear)
    return {
      ...entry,
      date: adjustedDate || entry.date
    }
  })
  const siteConfigsSource = Array.isArray(fallbackConfig?.siteConfigs) && fallbackConfig.siteConfigs.length > 0
    ? fallbackConfig.siteConfigs
    : fallbackConfig?.siteConfigsByCode && Object.keys(fallbackConfig.siteConfigsByCode).length > 0
      ? fallbackConfig.siteConfigsByCode
      : fallbackConfig
  const siteConfigs = normalizeSiteConfigEntries(siteConfigsSource)
  const siteConfigsByCode = siteConfigs.reduce((acc, siteConfig) => {
    if (siteConfig?.siteCode) {
      acc[siteConfig.siteCode] = siteConfig
    }

    return acc
  }, {})

  return {
    year: Number.isInteger(parsedYear) ? parsedYear : null,
    schemaVersion: Number.isFinite(Number(fallbackConfig?.schemaVersion))
      ? Number(fallbackConfig.schemaVersion)
      : 2,
    classTypes: Array.isArray(fallbackConfig?.classTypes)
      ? fallbackConfig.classTypes.filter(Boolean).map((entry) => ({ ...entry }))
      : [],
    soutenanceDates: normalizeSoutenanceDateEntries(normalizedDates),
    siteConfigs,
    siteConfigsByCode,
    etml: buildLegacySiteAlias(siteConfigs, "ETML"),
    cfpv: buildLegacySiteAlias(siteConfigs, "CFPV")
  }
}

export const normalizeRoom = (room = {}, index = 0, sourceConfig = combinedScheduleConfig) => {
  const siteKey = String(room.site ?? "").trim().toUpperCase()
  const siteConfig = getSiteConfig(siteKey, sourceConfig)
  const numSlots =
    Number.isInteger(siteConfig?.numSlots) && siteConfig.numSlots > 0
      ? siteConfig.numSlots
      : DEFAULT_SITE_SCHEDULE.numSlots

  const tpiSources = Array.isArray(room.tpiDatas) ? room.tpiDatas : []
  const tpiDatas = Array.from({ length: numSlots }, (_, slotIndex) =>
    normalizeTpi(tpiSources[slotIndex] || createEmptyTpi())
  )

  return {
    idRoom: typeof room.idRoom === "number" ? room.idRoom : Date.now() + index,
    lastUpdate: Number(room.lastUpdate) || Date.now(),
    site: room.site || siteConfig.siteCode || siteKey || "ETML",
    date: room.date || new Date().toISOString().slice(0, 10),
    name: room.name || room.nameRoom || `Salle ${index + 1}`,
    configSite: {
      ...siteConfig,
      numSlots
    },
    tpiDatas
  }
}

/**
 * Convertit récursivement un objet issu d'un export MongoDB Extended JSON
 * en un objet JS standard :
 *   { "$oid": "abc" }   -> "abc"
 *   { "$date": "..." }  -> "..."
 */
export const stripMongoExtendedJson = (value) => {
  if (value === null || value === undefined) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(stripMongoExtendedJson)
  }

  if (typeof value === "object") {
    if (typeof value.$oid === "string") {
      return value.$oid
    }

    if (typeof value.$date === "string" || value.$date instanceof Date) {
      return typeof value.$date === "string"
        ? value.$date
        : value.$date.toISOString()
    }

    const cleaned = {}
    for (const key of Object.keys(value)) {
      cleaned[key] = stripMongoExtendedJson(value[key])
    }
    return cleaned
  }

  return value
}

export const normalizeOrganizerRooms = (savedRooms, sourceConfig = combinedScheduleConfig) => {
  if (!savedRooms) {
    return []
  }

  if (!Array.isArray(savedRooms) && typeof savedRooms !== "object") {
    return []
  }

  const cleaned = stripMongoExtendedJson(savedRooms)
  const rooms = Array.isArray(cleaned) ? cleaned : [cleaned]
  return rooms.filter(Boolean).map((room, index) => normalizeRoom(room, index, sourceConfig))
}
