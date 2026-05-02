const { randomUUID } = require('crypto')
const mongoose = require('mongoose')
const { ensureDatabaseConnection } = require('../config/dbConfig')
const PlanningConfig = require('../models/planningConfigModel')
const { getSharedPlanningCatalog } = require('./planningCatalogService')
const {
  getMaxConsecutiveTpiLimit,
  getMinTpiPerOpenRoomTarget,
  MIN_TPI_PER_OPEN_ROOM,
  MAX_CONSECUTIVE_TPI
} = require('./planningRuleUtils')

const DEFAULT_SCHEMA_VERSION = 2
const DEFAULT_SITE_SCHEDULE = {
  breaklineMinutes: 10,
  tpiTimeMinutes: 60,
  firstTpiStartTime: '08:00',
  numSlots: 8,
  maxConsecutiveTpi: MAX_CONSECUTIVE_TPI,
  minTpiPerRoom: MIN_TPI_PER_OPEN_ROOM,
  manualRoomTarget: null,
  active: true
}
const DEFAULT_WORKFLOW_SETTINGS = {
  voteDeadlineDays: 7,
  maxVoteProposals: 3,
  allowSpecialVoteRequest: true,
  automaticVoteRemindersEnabled: false,
  voteReminderLeadHours: 48,
  maxVoteReminders: 1,
  voteReminderCooldownHours: 24
}
const DEFAULT_ACCESS_LINK_SETTINGS = {
  voteLinkValidityHours: 24 * 7,
  voteLinkMaxUses: 20,
  soutenanceLinkValidityHours: 24 * 4,
  soutenanceLinkMaxUses: 60
}
const MIN_VOTE_DEADLINE_DAYS = 1
const MAX_VOTE_DEADLINE_DAYS = 60
const MIN_VOTE_PROPOSALS = 1
const MAX_VOTE_PROPOSALS = 10
const MIN_VOTE_REMINDER_LEAD_HOURS = 1
const MAX_VOTE_REMINDER_LEAD_HOURS = 24 * 30
const MIN_VOTE_REMINDERS = 0
const MAX_VOTE_REMINDERS = 10
const MIN_VOTE_REMINDER_COOLDOWN_HOURS = 1
const MAX_VOTE_REMINDER_COOLDOWN_HOURS = 24 * 30
const MIN_ACCESS_LINK_VALIDITY_HOURS = 1
const MAX_ACCESS_LINK_VALIDITY_HOURS = 24 * 365
const MIN_ACCESS_LINK_MAX_USES = 1
const MAX_ACCESS_LINK_MAX_USES = 1000
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
const DEFAULT_CLASS_TYPES = [
  { code: 'CFC', prefix: 'C', label: 'CFC', startDate: '', endDate: '' },
  { code: 'FPA', prefix: 'F', label: 'FPA', startDate: '', endDate: '' },
  { code: 'MATU', prefix: 'M', label: 'MATU', startDate: '', endDate: '' }
]

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

function toIntegerYear(value) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) ? parsed : null
}

function padTwo(value) {
  return String(value).padStart(2, '0')
}

function decimalHoursToTimeString(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return ''
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

  const [hoursPart, minutesPart] = text.split(':')
  const hours = Number.parseInt(hoursPart, 10)
  const minutes = Number.parseInt(minutesPart || '0', 10)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return fallback
  }

  return hours + minutes / 60
}

function normalizeDateValue(value) {
  const text = compactText(value)

  if (!text) {
    return ''
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
    const [hoursPart, minutesPart] = text.split(':')
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
  const numeric = Number(value)

  if (Number.isFinite(numeric)) {
    return numeric
  }

  if (Number.isFinite(Number(legacyHoursFallback))) {
    return Math.round(Number(legacyHoursFallback) * 60)
  }

  return fallbackMinutes
}

function normalizeBoundedInteger(value, fallback, min, max) {
  const numeric = Number.parseInt(String(value), 10)
  const fallbackValue = Number.parseInt(String(fallback), 10)
  const safeFallback = Number.isInteger(fallbackValue)
    ? Math.max(min, Math.min(max, fallbackValue))
    : min

  if (!Number.isInteger(numeric)) {
    return safeFallback
  }

  return Math.max(min, Math.min(max, numeric))
}

function normalizeBooleanOption(source, fallback) {
  if (typeof source === 'boolean') {
    return source
  }

  if (typeof fallback === 'boolean') {
    return fallback
  }

  return true
}

function normalizeWorkflowSettings(value = {}, fallback = DEFAULT_WORKFLOW_SETTINGS) {
  const source = value && typeof value === 'object' ? value : {}
  const fallbackSource = fallback && typeof fallback === 'object'
    ? fallback
    : DEFAULT_WORKFLOW_SETTINGS

  return {
    voteDeadlineDays: normalizeBoundedInteger(
      source.voteDeadlineDays ?? source.votingDeadlineDays ?? source.voteDeadline,
      fallbackSource.voteDeadlineDays ?? DEFAULT_WORKFLOW_SETTINGS.voteDeadlineDays,
      MIN_VOTE_DEADLINE_DAYS,
      MAX_VOTE_DEADLINE_DAYS
    ),
    maxVoteProposals: normalizeBoundedInteger(
      source.maxVoteProposals ?? source.maxProposalsPerVote ?? source.maxAlternativeSlots,
      fallbackSource.maxVoteProposals ?? DEFAULT_WORKFLOW_SETTINGS.maxVoteProposals,
      MIN_VOTE_PROPOSALS,
      MAX_VOTE_PROPOSALS
    ),
    allowSpecialVoteRequest: normalizeBooleanOption(
      source.allowSpecialVoteRequest ?? source.allowSpecialRequest,
      fallbackSource.allowSpecialVoteRequest
    ),
    automaticVoteRemindersEnabled: normalizeBooleanOption(
      source.automaticVoteRemindersEnabled ?? source.autoVoteRemindersEnabled ?? source.automaticRemindersEnabled,
      fallbackSource.automaticVoteRemindersEnabled ?? DEFAULT_WORKFLOW_SETTINGS.automaticVoteRemindersEnabled
    ),
    voteReminderLeadHours: normalizeBoundedInteger(
      source.voteReminderLeadHours ?? source.reminderLeadHours ?? source.voteReminderBeforeDeadlineHours,
      fallbackSource.voteReminderLeadHours ?? DEFAULT_WORKFLOW_SETTINGS.voteReminderLeadHours,
      MIN_VOTE_REMINDER_LEAD_HOURS,
      MAX_VOTE_REMINDER_LEAD_HOURS
    ),
    maxVoteReminders: normalizeBoundedInteger(
      source.maxVoteReminders ?? source.maxRemindersPerVote ?? source.voteReminderMaxCount,
      fallbackSource.maxVoteReminders ?? DEFAULT_WORKFLOW_SETTINGS.maxVoteReminders,
      MIN_VOTE_REMINDERS,
      MAX_VOTE_REMINDERS
    ),
    voteReminderCooldownHours: normalizeBoundedInteger(
      source.voteReminderCooldownHours ?? source.reminderCooldownHours ?? source.voteReminderIntervalHours,
      fallbackSource.voteReminderCooldownHours ?? DEFAULT_WORKFLOW_SETTINGS.voteReminderCooldownHours,
      MIN_VOTE_REMINDER_COOLDOWN_HOURS,
      MAX_VOTE_REMINDER_COOLDOWN_HOURS
    )
  }
}

function normalizeAccessLinkSettings(value = {}, fallback = DEFAULT_ACCESS_LINK_SETTINGS) {
  const source = value && typeof value === 'object' ? value : {}
  const fallbackSource = fallback && typeof fallback === 'object'
    ? fallback
    : DEFAULT_ACCESS_LINK_SETTINGS

  return {
    voteLinkValidityHours: normalizeBoundedInteger(
      source.voteLinkValidityHours ?? source.voteValidityHours ?? source.voteExpiryHours,
      fallbackSource.voteLinkValidityHours ?? DEFAULT_ACCESS_LINK_SETTINGS.voteLinkValidityHours,
      MIN_ACCESS_LINK_VALIDITY_HOURS,
      MAX_ACCESS_LINK_VALIDITY_HOURS
    ),
    voteLinkMaxUses: normalizeBoundedInteger(
      source.voteLinkMaxUses ?? source.voteMaxUses,
      fallbackSource.voteLinkMaxUses ?? DEFAULT_ACCESS_LINK_SETTINGS.voteLinkMaxUses,
      MIN_ACCESS_LINK_MAX_USES,
      MAX_ACCESS_LINK_MAX_USES
    ),
    soutenanceLinkValidityHours: normalizeBoundedInteger(
      source.soutenanceLinkValidityHours ?? source.soutenanceValidityHours ?? source.soutenanceExpiryHours,
      fallbackSource.soutenanceLinkValidityHours ?? DEFAULT_ACCESS_LINK_SETTINGS.soutenanceLinkValidityHours,
      MIN_ACCESS_LINK_VALIDITY_HOURS,
      MAX_ACCESS_LINK_VALIDITY_HOURS
    ),
    soutenanceLinkMaxUses: normalizeBoundedInteger(
      source.soutenanceLinkMaxUses ?? source.soutenanceMaxUses,
      fallbackSource.soutenanceLinkMaxUses ?? DEFAULT_ACCESS_LINK_SETTINGS.soutenanceLinkMaxUses,
      MIN_ACCESS_LINK_MAX_USES,
      MAX_ACCESS_LINK_MAX_USES
    )
  }
}

function normalizeSoutenanceDateEntry(value) {
  if (!value && value !== 0) {
    return null
  }

  const isObjectEntry = value && typeof value === 'object'
  const rawDate = isObjectEntry
    ? value.date ?? value.value ?? value.label ?? ''
    : value
  const date = normalizeDateValue(rawDate)

  if (!date) {
    return null
  }

  const rawClasses = isObjectEntry
    ? (value.classes ?? value.tags ?? value.classePrefixes ?? null)
    : null
  const classes = Array.isArray(rawClasses)
    ? rawClasses
        .map((c) => String(c ?? '').trim().toUpperCase())
        .filter(Boolean)
    : []

  return {
    date,
    min: Boolean(isObjectEntry && (value.min ?? value.isMin ?? value.minimal ?? value.minDate)),
    special: Boolean(isObjectEntry && (value.special ?? value.other ?? value.isSpecial ?? value.specialDate)),
    classes,
    label: ''
  }
}

function normalizeSoutenanceDateEntries(values) {
  const entries = Array.isArray(values) ? values : [values]
  const normalizedByDate = new Map()

  entries.forEach((value) => {
    const entry = normalizeSoutenanceDateEntry(value)

    if (!entry) {
      return
    }

    const current = normalizedByDate.get(entry.date)
    if (!current) {
      normalizedByDate.set(entry.date, {
        ...entry,
        label: new Date(entry.date).toLocaleDateString('fr-CH', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })
      })
      return
    }

    normalizedByDate.set(entry.date, {
      ...current,
      min: current.min || entry.min,
      special: current.special || entry.special,
      classes: Array.from(new Set([...(current.classes || []), ...(entry.classes || [])]))
    })
  })

  return Array.from(normalizedByDate.values()).sort((left, right) => {
    const leftTime = new Date(left.date).getTime()
    const rightTime = new Date(right.date).getTime()

    const leftValid = !Number.isNaN(leftTime)
    const rightValid = !Number.isNaN(rightTime)

    if (leftValid && rightValid) {
      return leftTime - rightTime
    }

    if (leftValid) {
      return -1
    }

    if (rightValid) {
      return 1
    }

    return String(left.date).localeCompare(String(right.date))
  })
}

function normalizeClassTypeDefinition(value, fallback = {}) {
  const source = value && typeof value === 'object' ? value : {}
  const fallbackSource = fallback && typeof fallback === 'object' ? fallback : {}
  const code = compactText(source.code || fallbackSource.code || '').toUpperCase()
  const id = compactText(source.id || fallbackSource.id || makeStableId('class', code || fallbackSource.code || source.label || fallbackSource.label))
  const prefix = compactText(source.prefix || fallbackSource.prefix || code.slice(0, 1))
  const label = compactText(source.label || fallbackSource.label || code)
  const startDate = normalizeDateValue(source.startDate || source.start || fallbackSource.startDate || '')
  const endDate = normalizeDateValue(source.endDate || source.end || fallbackSource.endDate || '')
  const rawDates = Array.isArray(source.soutenanceDates)
    ? source.soutenanceDates
    : Array.isArray(fallbackSource.soutenanceDates)
      ? fallbackSource.soutenanceDates
      : []

  return {
    id,
    code,
    prefix,
    label: label || code,
    startDate,
    endDate,
    soutenanceDates: normalizeSoutenanceDateEntries(rawDates),
    notes: compactText(source.notes || fallbackSource.notes || ''),
    active: source.active !== false && fallbackSource.active !== false
  }
}

function normalizeClassTypeEntries(values, fallbackClassTypes = []) {
  const hasSourceEntries = Array.isArray(values)
  const fallbackEntries = Array.isArray(fallbackClassTypes)
    ? fallbackClassTypes.map((entry) => normalizeClassTypeDefinition(entry)).filter((entry) => entry.code)
    : []
  const sourceEntries = hasSourceEntries ? values : []
  const normalized = []
  const seen = new Set()
  const sourceById = new Map()
  const sourceByCode = new Map()
  const fallbackById = new Map()
  const fallbackByCode = new Map()

  sourceEntries.forEach((entry, index) => {
    const normalizedEntry = normalizeClassTypeDefinition(entry)
    const normalizedId = compactText(normalizedEntry.id || '').toLowerCase()
    const normalizedCode = compactText(normalizedEntry.code).toUpperCase()

    if (!normalizedEntry.code) {
      return
    }

    if (normalizedId) {
      sourceById.set(normalizedId, normalizedEntry)
    }

    if (normalizedCode) {
      sourceByCode.set(normalizedCode, normalizedEntry)
    }
  })

  fallbackEntries.forEach((entry) => {
    const normalizedId = compactText(entry.id || '').toLowerCase()
    const normalizedCode = compactText(entry.code).toUpperCase()

    if (normalizedId) {
      fallbackById.set(normalizedId, entry)
    }

    if (normalizedCode) {
      fallbackByCode.set(normalizedCode, entry)
    }
  })

  const addEntry = (entry, index = 0) => {
    if (!entry || !entry.code) {
      return
    }

    const normalizedId = compactText(entry.id || '').toLowerCase()
    const normalizedCode = compactText(entry.code).toUpperCase()
    const key = normalizedId || normalizedCode

    if (!key || seen.has(key)) {
      return
    }

    seen.add(key)
    normalized.push({
      ...entry,
      order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : index
    })
  }

  DEFAULT_CLASS_TYPES.forEach((defaultType, index) => {
    const code = compactText(defaultType.code).toUpperCase()
    const sourceEntry = sourceByCode.get(code) || sourceById.get(code.toLowerCase())
    const fallbackEntry = fallbackByCode.get(code) || fallbackById.get(code.toLowerCase())
    const normalizedEntry = normalizeClassTypeDefinition(
      sourceEntry || fallbackEntry || defaultType,
      sourceEntry || fallbackEntry || defaultType
    )

    addEntry(normalizedEntry, index)
  })

  sourceEntries.forEach((entry, index) => {
    const normalizedEntry = normalizeClassTypeDefinition(entry)
    const normalizedCode = compactText(normalizedEntry.code).toUpperCase()

    if (!normalizedEntry.code || DEFAULT_CLASS_TYPES.some((defaultType) => defaultType.code === normalizedCode)) {
      return
    }

    addEntry(normalizedEntry, DEFAULT_CLASS_TYPES.length + index)
  })

  if (!hasSourceEntries) {
    fallbackEntries.forEach((entry, index) => {
      const normalizedEntry = normalizeClassTypeDefinition(entry)
      const normalizedCode = compactText(normalizedEntry.code).toUpperCase()

      if (!normalizedEntry.code || DEFAULT_CLASS_TYPES.some((defaultType) => defaultType.code === normalizedCode)) {
        return
      }

      addEntry(normalizedEntry, DEFAULT_CLASS_TYPES.length + sourceEntries.length + index)
    })
  }

  return normalized
}

function normalizeSiteScheduleDefinition(value, fallback = {}) {
  const source = value && typeof value === 'object' ? value : {}
  const fallbackSource = fallback && typeof fallback === 'object' ? fallback : {}
  const id = compactText(source.id || fallbackSource.id || makeStableId('site-config', source.siteId || source.siteCode || fallbackSource.siteId || fallbackSource.siteCode || source.code || fallbackSource.code || source.label || fallbackSource.label))
  const siteCode = compactText(source.siteCode || source.code || source.site || fallbackSource.siteCode || fallbackSource.code || '').toUpperCase()
  const siteId = compactText(source.siteId || fallbackSource.siteId || source.id || fallbackSource.id || makeStableId('site', siteCode || fallbackSource.siteCode || source.code || fallbackSource.code || source.label || fallbackSource.label))
  const label = compactText(source.label || source.name || fallbackSource.label || fallbackSource.name || siteCode)

  return {
    id,
    siteId,
    siteCode,
    label: label || siteCode,
    planningColor: normalizePlanningColor(
      source.planningColor ||
      source.color ||
      fallbackSource.planningColor ||
      fallbackSource.color ||
      getDefaultPlanningColor(siteCode || label)
    ),
    tpiColor: normalizeOptionalPlanningColor(source, fallbackSource),
    soutenanceColor: normalizeOptionalSoutenanceColor(source, fallbackSource),
    breaklineMinutes: normalizeMinuteValue(
      source.breaklineMinutes,
      Number.isFinite(Number(fallbackSource.breaklineMinutes)) ? Number(fallbackSource.breaklineMinutes) : DEFAULT_SITE_SCHEDULE.breaklineMinutes,
      source.breakline
    ),
    tpiTimeMinutes: normalizeMinuteValue(
      source.tpiTimeMinutes,
      Number.isFinite(Number(fallbackSource.tpiTimeMinutes)) ? Number(fallbackSource.tpiTimeMinutes) : DEFAULT_SITE_SCHEDULE.tpiTimeMinutes,
      source.tpiTime
    ),
    firstTpiStartTime: normalizeTimeValue(
      source.firstTpiStartTime ?? source.firstTpiStart,
      fallbackSource.firstTpiStartTime || DEFAULT_SITE_SCHEDULE.firstTpiStartTime
    ),
    numSlots: Number.isInteger(Number(source.numSlots)) && Number(source.numSlots) > 0
      ? Number(source.numSlots)
      : Number.isInteger(Number(fallbackSource.numSlots)) && Number(fallbackSource.numSlots) > 0
        ? Number(fallbackSource.numSlots)
        : DEFAULT_SITE_SCHEDULE.numSlots,
    maxConsecutiveTpi: getMaxConsecutiveTpiLimit(
      source.maxConsecutiveTpi,
      getMaxConsecutiveTpiLimit(fallbackSource.maxConsecutiveTpi, DEFAULT_SITE_SCHEDULE.maxConsecutiveTpi)
    ),
    minTpiPerRoom: getMinTpiPerOpenRoomTarget(
      source.minTpiPerRoom ?? source.minTpiPerOpenRoom ?? source.minRoomLoad,
      getMinTpiPerOpenRoomTarget(
        fallbackSource.minTpiPerRoom ?? fallbackSource.minTpiPerOpenRoom ?? fallbackSource.minRoomLoad,
        DEFAULT_SITE_SCHEDULE.minTpiPerRoom
      )
    ),
    manualRoomTarget: Number.isFinite(Number(source.manualRoomTarget)) && Number(source.manualRoomTarget) >= 0
      ? Number(source.manualRoomTarget)
      : Number.isFinite(Number(fallbackSource.manualRoomTarget)) && Number(fallbackSource.manualRoomTarget) >= 0
        ? Number(fallbackSource.manualRoomTarget)
        : DEFAULT_SITE_SCHEDULE.manualRoomTarget,
    notes: compactText(source.notes || fallbackSource.notes || ''),
    active: source.active !== false && fallbackSource.active !== false
  }
}

function extractLegacySiteSchedules(source = {}) {
  const legacySiteCodes = ['etml', 'cfpv']
  return legacySiteCodes
    .filter((siteCode) => Object.prototype.hasOwnProperty.call(source, siteCode))
    .map((siteCode) => ({
      siteId: makeStableId('site', siteCode.toUpperCase()),
      siteCode: siteCode.toUpperCase(),
      ...(source[siteCode] && typeof source[siteCode] === 'object' ? source[siteCode] : {})
    }))
}

function extractSiteSchedulesFromPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  if (Array.isArray(payload.siteConfigs)) {
    return payload.siteConfigs
  }

  if (Array.isArray(payload.sites)) {
    return payload.sites
  }

  const legacy = extractLegacySiteSchedules(payload)
  if (legacy.length > 0) {
    return legacy
  }

  return []
}

function buildLegacySiteAlias(siteConfigs, siteCode) {
  const code = String(siteCode || '').trim().toUpperCase()
  const siteConfig = Array.isArray(siteConfigs)
    ? siteConfigs.find((entry) => entry.siteCode === code || entry.siteId === code)
    : null
  const firstStart = siteConfig ? timeStringToDecimalHours(siteConfig.firstTpiStartTime, 8) : 8

  return {
    breakline: siteConfig ? siteConfig.breaklineMinutes / 60 : DEFAULT_SITE_SCHEDULE.breaklineMinutes / 60,
    tpiTime: siteConfig ? siteConfig.tpiTimeMinutes / 60 : DEFAULT_SITE_SCHEDULE.tpiTimeMinutes / 60,
    firstTpiStart: firstStart,
    numSlots: siteConfig ? siteConfig.numSlots : DEFAULT_SITE_SCHEDULE.numSlots,
    maxConsecutiveTpi: siteConfig ? siteConfig.maxConsecutiveTpi : DEFAULT_SITE_SCHEDULE.maxConsecutiveTpi,
    minTpiPerRoom: siteConfig ? siteConfig.minTpiPerRoom : DEFAULT_SITE_SCHEDULE.minTpiPerRoom,
    label: siteConfig ? siteConfig.label : code
  }
}

function normalizeSiteScheduleEntries(values, fallbackSiteConfigs = [], catalogSites = []) {
  const hasExplicitValues = Array.isArray(values)
  const inputValues = hasExplicitValues ? values : fallbackSiteConfigs
  const fallbackById = new Map()
  const fallbackByCode = new Map()
  const normalized = []

  ;(Array.isArray(fallbackSiteConfigs) ? fallbackSiteConfigs : []).forEach((entry) => {
    const normalizedEntry = normalizeSiteScheduleDefinition(entry)

    if (normalizedEntry.siteId) {
      fallbackById.set(String(normalizedEntry.siteId).toLowerCase(), normalizedEntry)
    }

    if (normalizedEntry.siteCode) {
      fallbackByCode.set(normalizedEntry.siteCode, normalizedEntry)
    }
  })

  const sourceById = new Map()
  const sourceByCode = new Map()

  inputValues.forEach((entry, index) => {
    const entryId = compactText(entry?.siteId || entry?.id || '').toLowerCase()
    const entryCode = compactText(entry?.siteCode || entry?.code || entry?.site || '').toUpperCase()
    const fallbackEntry =
      fallbackById.get(entryId) ||
      fallbackByCode.get(entryCode) ||
      fallbackSiteConfigs[index] ||
      {}
    const normalizedEntry = normalizeSiteScheduleDefinition(entry, fallbackEntry)
    const normalizedId = compactText(normalizedEntry.siteId || normalizedEntry.id || '').toLowerCase()
    const normalizedCode = compactText(normalizedEntry.siteCode).toUpperCase()

    if (!normalizedId && !normalizedCode) {
      return
    }

    if (normalizedId && !sourceById.has(normalizedId)) {
      sourceById.set(normalizedId, normalizedEntry)
    }

    if (normalizedCode && !sourceByCode.has(normalizedCode)) {
      sourceByCode.set(normalizedCode, normalizedEntry)
    }
  })

  const orderedCatalogSites = Array.isArray(catalogSites) ? catalogSites : []

  if (orderedCatalogSites.length > 0) {
    orderedCatalogSites.forEach((site, index) => {
      const siteCode = compactText(site?.code || site?.label).toUpperCase()
      const siteId = compactText(site?.id || site?.siteId || '').toLowerCase() || makeStableId('site', siteCode)

      if (!siteCode && !siteId) {
        return
      }

      const existing = sourceById.get(siteId) || sourceByCode.get(siteCode)
      const fallbackEntry =
        fallbackById.get(siteId) ||
        fallbackByCode.get(siteCode) ||
        fallbackSiteConfigs[index] ||
        {}
      const normalizedEntry = normalizeSiteScheduleDefinition(
        existing || {
          siteId,
          siteCode,
          label: compactText(site?.label || site?.name || siteCode),
          planningColor: compactText(site?.planningColor || site?.color || ''),
          tpiColor: compactText(site?.tpiColor || site?.tpiCardColor || ''),
          soutenanceColor: compactText(site?.soutenanceColor || site?.defenseColor || site?.defenceColor || '')
        },
        {
          ...fallbackEntry,
          siteId,
          siteCode,
          label: compactText(site?.label || site?.name || siteCode),
          planningColor: compactText(
            site?.planningColor ||
            site?.color ||
            fallbackEntry?.planningColor ||
            fallbackEntry?.color ||
            ''
          ),
          tpiColor: compactText(
            site?.tpiColor ||
            site?.tpiCardColor ||
            fallbackEntry?.tpiColor ||
            fallbackEntry?.tpiCardColor ||
            ''
          ),
          soutenanceColor: compactText(
            site?.soutenanceColor ||
            site?.defenseColor ||
            site?.defenceColor ||
            fallbackEntry?.soutenanceColor ||
            fallbackEntry?.defenseColor ||
            fallbackEntry?.defenceColor ||
            ''
          )
        }
      )

      normalizedEntry.siteId = siteId
      normalizedEntry.siteCode = siteCode
      normalizedEntry.label = normalizedEntry.label || compactText(site?.label || site?.name || siteCode)
      normalized.push(normalizedEntry)
      sourceById.delete(siteId)
      if (siteCode) {
        sourceByCode.delete(siteCode)
      }
    })
  }

  if (orderedCatalogSites.length === 0) {
    for (const entry of sourceById.values()) {
      normalized.push(entry)
    }
  }

  if (normalized.length === 0 && !hasExplicitValues && fallbackSiteConfigs.length > 0) {
    return fallbackSiteConfigs.map((entry) => normalizeSiteScheduleDefinition(entry))
  }

  return normalized
}

function flattenClassTypeDates(classTypes = []) {
  const dates = []

  for (const classType of Array.isArray(classTypes) ? classTypes : []) {
    const code = compactText(classType?.code).toUpperCase()
    const prefix = compactText(classType?.prefix || code.slice(0, 1))

    for (const entry of Array.isArray(classType?.soutenanceDates) ? classType.soutenanceDates : []) {
      const normalizedEntry = normalizeSoutenanceDateEntry(entry)

      if (!normalizedEntry) {
        continue
      }

      dates.push({
        ...normalizedEntry,
        classes: Array.from(new Set([
          ...(normalizedEntry.classes || []),
          code,
          prefix
        ])).filter(Boolean)
      })
    }
  }

  return normalizeSoutenanceDateEntries(dates)
}

function attachLegacySiteAliases(config) {
  const siteConfigs = Array.isArray(config.siteConfigs) ? config.siteConfigs : []
  return {
    ...config,
    siteConfigsByCode: siteConfigs.reduce((acc, siteConfig) => {
      if (siteConfig?.siteCode) {
        acc[siteConfig.siteCode] = siteConfig
      }
      return acc
    }, {}),
    etml: buildLegacySiteAlias(siteConfigs, 'ETML'),
    cfpv: buildLegacySiteAlias(siteConfigs, 'CFPV')
  }
}

function buildDefaultPlanningConfig(year, catalogSites = []) {
  const requestedYear = toIntegerYear(year) || new Date().getFullYear()
  const siteConfigs = normalizeSiteScheduleEntries([], [], catalogSites).map((entry) => ({
    ...entry,
    breaklineMinutes: DEFAULT_SITE_SCHEDULE.breaklineMinutes,
    tpiTimeMinutes: DEFAULT_SITE_SCHEDULE.tpiTimeMinutes,
    firstTpiStartTime: DEFAULT_SITE_SCHEDULE.firstTpiStartTime,
    numSlots: DEFAULT_SITE_SCHEDULE.numSlots,
    maxConsecutiveTpi: DEFAULT_SITE_SCHEDULE.maxConsecutiveTpi,
    minTpiPerRoom: DEFAULT_SITE_SCHEDULE.minTpiPerRoom,
    manualRoomTarget: DEFAULT_SITE_SCHEDULE.manualRoomTarget,
    active: entry.active !== false
  }))

  return attachLegacySiteAliases({
    year: requestedYear,
    schemaVersion: DEFAULT_SCHEMA_VERSION,
    classTypes: normalizeClassTypeEntries([], DEFAULT_CLASS_TYPES),
    soutenanceDates: [],
    siteConfigs,
    workflowSettings: { ...DEFAULT_WORKFLOW_SETTINGS },
    accessLinkSettings: { ...DEFAULT_ACCESS_LINK_SETTINGS }
  })
}

function normalizeStoredConfig(document, year, fallbackConfig = null, catalogSites = []) {
  const source = document && typeof document === 'object' ? document : {}
  const fallback = fallbackConfig && typeof fallbackConfig === 'object'
    ? fallbackConfig
    : buildDefaultPlanningConfig(year, catalogSites)
  const resolvedYear = Number.isInteger(Number(year))
    ? Number(year)
    : Number.isInteger(Number(source.year))
      ? Number(source.year)
      : Number.isInteger(Number(fallback.year))
        ? Number(fallback.year)
        : new Date().getFullYear()

  const classTypes = normalizeClassTypeEntries(source.classTypes, fallback.classTypes)
  const siteSchedulesInput = extractSiteSchedulesFromPayload(source)
  const siteConfigs = normalizeSiteScheduleEntries(
    siteSchedulesInput,
    fallback.siteConfigs,
    catalogSites
  )

  return attachLegacySiteAliases({
    year: resolvedYear,
    schemaVersion: Number.isFinite(Number(source.schemaVersion))
      ? Number(source.schemaVersion)
      : Number.isFinite(Number(fallback.schemaVersion))
        ? Number(fallback.schemaVersion)
        : DEFAULT_SCHEMA_VERSION,
    classTypes,
    soutenanceDates: flattenClassTypeDates(classTypes),
    siteConfigs,
    workflowSettings: normalizeWorkflowSettings(source.workflowSettings, fallback.workflowSettings),
    accessLinkSettings: normalizeAccessLinkSettings(source.accessLinkSettings, fallback.accessLinkSettings)
  })
}

function normalizeYearConfigPayload(payload, year, fallbackConfig = null, catalogSites = []) {
  const source = payload && typeof payload === 'object' ? payload : {}
  const fallback = fallbackConfig && typeof fallbackConfig === 'object'
    ? fallbackConfig
    : buildDefaultPlanningConfig(year, catalogSites)

  return normalizeStoredConfig(source, year, fallback, catalogSites)
}

async function getPlanningConfig(year) {
  await ensureDatabaseConnection({
    errorMessage: 'Configuration de planification indisponible: connexion MongoDB impossible.'
  })

  const requestedYear = toIntegerYear(year)

  if (!Number.isInteger(requestedYear)) {
    return null
  }

  const catalog = await getSharedPlanningCatalog()
  const catalogSites = Array.isArray(catalog?.sites) ? catalog.sites : []
  const document = await PlanningConfig.findOne({ year: requestedYear }).lean()

  if (document) {
    return normalizeStoredConfig(document, requestedYear, buildDefaultPlanningConfig(requestedYear, catalogSites), catalogSites)
  }

  const fallback = buildDefaultPlanningConfig(requestedYear, catalogSites)
  const inserted = await PlanningConfig.findOneAndUpdate(
    { year: requestedYear },
    {
      $setOnInsert: {
        year: requestedYear,
        schemaVersion: DEFAULT_SCHEMA_VERSION,
        classTypes: [],
        soutenanceDates: [],
        siteConfigs: fallback.siteConfigs,
        workflowSettings: fallback.workflowSettings,
        accessLinkSettings: fallback.accessLinkSettings
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  )

  return normalizeStoredConfig(inserted?.toObject ? inserted.toObject() : inserted, requestedYear, fallback, catalogSites)
}

async function getPlanningConfigIfAvailable(year) {
  const requestedYear = toIntegerYear(year)

  if (!Number.isInteger(requestedYear)) {
    return null
  }

  if (mongoose.connection.readyState !== 1) {
    return null
  }

  try {
    return await getPlanningConfig(requestedYear)
  } catch (error) {
    if (error?.code === 'DATABASE_UNAVAILABLE' || error?.statusCode === 503) {
      return null
    }

    throw error
  }
}

async function savePlanningConfig(year, payload = {}) {
  await ensureDatabaseConnection({
    errorMessage: 'Configuration de planification indisponible: connexion MongoDB impossible.'
  })

  const requestedYear = toIntegerYear(year)

  if (!Number.isInteger(requestedYear)) {
    throw new Error('Année invalide pour la configuration.')
  }

  const catalog = await getSharedPlanningCatalog()
  const catalogSites = Array.isArray(catalog?.sites) ? catalog.sites : []
  const existingDocument = await PlanningConfig.findOne({ year: requestedYear }).lean()
  const fallback = existingDocument
    ? normalizeStoredConfig(existingDocument, requestedYear, buildDefaultPlanningConfig(requestedYear, catalogSites), catalogSites)
    : buildDefaultPlanningConfig(requestedYear, catalogSites)
  const normalizedConfig = normalizeYearConfigPayload(payload, requestedYear, fallback, catalogSites)

  const document = await PlanningConfig.findOneAndUpdate(
    { year: requestedYear },
    {
      year: requestedYear,
      schemaVersion: normalizedConfig.schemaVersion,
      classTypes: normalizedConfig.classTypes,
      soutenanceDates: normalizedConfig.soutenanceDates,
      siteConfigs: normalizedConfig.siteConfigs,
      workflowSettings: normalizedConfig.workflowSettings,
      accessLinkSettings: normalizedConfig.accessLinkSettings
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  )

  return normalizeStoredConfig(document?.toObject ? document.toObject() : document, requestedYear, normalizedConfig, catalogSites)
}

module.exports = {
  DEFAULT_ACCESS_LINK_SETTINGS,
  DEFAULT_WORKFLOW_SETTINGS,
  buildDefaultPlanningConfig,
  decimalHoursToTimeString,
  flattenClassTypeDates,
  getPlanningConfig,
  getPlanningConfigIfAvailable,
  normalizeClassTypeEntries,
  normalizeAccessLinkSettings,
  normalizeSoutenanceDateEntries,
  normalizeStoredConfig,
  normalizeWorkflowSettings,
  normalizeYearConfigPayload,
  savePlanningConfig
}
