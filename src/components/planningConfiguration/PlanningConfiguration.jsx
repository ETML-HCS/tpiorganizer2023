import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "react-toastify"

import { YEARS_CONFIG, STORAGE_KEYS } from "../../config/appConfig"
import { readStorageValue, writeStorageValue } from "../../utils/storage"
import {
  planningCatalogService,
  planningConfigService,
  tpiPlanningService
} from "../../services/planningService"
import { buildPlanningRoomSizingOverview } from "../../utils/planningCapacityUtils"
import { normalizeSoutenanceDateEntries } from "../tpiSchedule/soutenanceDateUtils"
import BinaryToggle from "../shared/BinaryToggle"
import { CalendarIcon, RoomIcon, SettingsIcon, TimeIcon } from "../shared/InlineIcons"

import "../../css/planningConfiguration.css"

const DEFAULT_SITE_SCHEDULE = {
  breaklineMinutes: 10,
  tpiTimeMinutes: 60,
  firstTpiStartTime: "08:00",
  numSlots: 8,
  manualRoomTarget: ""
}

const DEFAULT_ANNUAL_CLASS_TYPES = [
  { code: "CFC", prefix: "C", label: "CFC", startDate: "", endDate: "" },
  { code: "FPA", prefix: "F", label: "FPA", startDate: "", endDate: "" },
  { code: "MATU", prefix: "M", label: "MATU", startDate: "", endDate: "" }
]

const DEFAULT_SITE_CLASS_BASE_TYPES = ["CFC", "FPA", "MATU"]

const DEFAULT_ADDRESS = {
  line1: "",
  line2: "",
  postalCode: "",
  city: "",
  canton: "",
  country: ""
}

const DEFAULT_SITE_PLANNING_COLORS = [
  "#1D4ED8",
  "#0F766E",
  "#BE185D",
  "#7C3AED",
  "#C2410C",
  "#0891B2",
  "#4F46E5",
  "#65A30D"
]

const compactText = (value) => {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

const normalizePlanningColor = (value) => {
  const hex = compactText(value).replace(/^#/, "")

  if (/^[\da-fA-F]{3}$/.test(hex)) {
    return `#${hex
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toUpperCase()}`
  }

  if (/^[\da-fA-F]{6}$/.test(hex)) {
    return `#${hex.toUpperCase()}`
  }

  return ""
}

const getDefaultPlanningColor = (seed = "", fallbackIndex = 0) => {
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

const generateLocalId = (prefix) => {
  const randomId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return `${prefix}-${randomId}`
}

const normalizeIdSegment = (value) =>
  compactText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()

const makeStableId = (prefix, ...parts) => {
  const normalizedParts = parts
    .map((part) => normalizeIdSegment(part))
    .filter(Boolean)

  if (normalizedParts.length === 0) {
    return generateLocalId(prefix)
  }

  return [prefix, ...normalizedParts].join("-")
}

const normalizeDateInputValue = (value) => {
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

const classTypeDatesToText = (values) =>
  normalizeSoutenanceDateEntries(values)
    .map((entry) => {
      const parts = [entry.date]
      if (entry.special) parts.push("SPECIAL")
      else if (entry.min) parts.push("SPECIAL")
      return parts.join(" ")
    })
    .join("\n")

const classTypeTextToDates = (text) => {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => compactText(line))
    .filter(Boolean)

  return normalizeSoutenanceDateEntries(
    lines.map((line) => {
      const tokens = line.split(/\s+/).filter(Boolean)
      if (tokens.length === 0) {
        return null
      }

      const date = normalizeDateInputValue(tokens.shift())
      if (!date) {
        return null
      }

      const flags = new Set(tokens.map((token) => token.toUpperCase()))
      return {
        date,
        special: flags.has("SPECIAL")
      }
    }).filter(Boolean)
  )
}

const normalizeAnnualClassType = (entry, index = 0) => {
  const source = entry && typeof entry === "object" ? entry : {}
  const rawCode = compactText(source.code || source.label || source.name || `TYPE${index + 1}`)
  const code = rawCode.toUpperCase()
  const label = compactText(source.label || source.name || code || `Type ${index + 1}`)

  return {
    id: compactText(source.id) || makeStableId("class", code || label),
    code,
    prefix: compactText(source.prefix || code.slice(0, 1)),
    label,
    startDate: normalizeDateInputValue(source.startDate || source.start || ""),
    endDate: normalizeDateInputValue(source.endDate || source.end || ""),
    soutenanceDatesText: Array.isArray(source.soutenanceDates)
      ? classTypeDatesToText(source.soutenanceDates)
      : compactText(source.soutenanceDatesText || ""),
    notes: compactText(source.notes || ""),
    active: source.active !== false,
    locked: DEFAULT_ANNUAL_CLASS_TYPES.some((defaultType) => defaultType.code === code)
  }
}

const normalizeClassTypes = (values) => {
  const source = Array.isArray(values) ? values : []
  const normalizedSource = source
    .map((entry, index) => normalizeAnnualClassType(entry, index))
    .filter((entry) => entry.code || entry.label)
  const normalizedByCode = new Map(
    normalizedSource
      .filter((entry) => entry.code)
      .map((entry) => [entry.code, entry])
  )
  const normalized = []
  const seen = new Set()

  DEFAULT_ANNUAL_CLASS_TYPES.forEach((defaultType, index) => {
    const code = defaultType.code.toUpperCase()
    const sourceEntry = normalizedByCode.get(code)
    const normalizedEntry = sourceEntry
      ? {
          ...sourceEntry,
          locked: true
        }
      : normalizeAnnualClassType(defaultType, index)

    const dedupeKey = compactText(normalizedEntry.id || "").toLowerCase() || normalizedEntry.code
    if (!normalizedEntry.code || seen.has(dedupeKey)) {
      return
    }

    seen.add(dedupeKey)
    normalized.push({
      ...normalizedEntry,
      locked: true
    })
  })

  normalizedSource.forEach((entry, index) => {
    if (DEFAULT_ANNUAL_CLASS_TYPES.some((defaultType) => defaultType.code === entry.code)) {
      return
    }

    const dedupeKey = compactText(entry.id || "").toLowerCase() || entry.code
    if (seen.has(dedupeKey)) {
      return
    }

    seen.add(dedupeKey)
    normalized.push({
      ...entry,
      locked: false,
      order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : index
    })
  })

  return normalized
}

const normalizeSiteClassEntry = (entry, fallback = {}, siteCode = "", baseType = "") => {
  const source = entry && typeof entry === "object" ? entry : {}
  const fallbackSource = fallback && typeof fallback === "object" ? fallback : {}
  const normalizedSiteCode = compactText(siteCode).toUpperCase()
  const normalizedBaseType = compactText(
    source.baseType ||
      source.type ||
      source.group ||
      baseType ||
      fallbackSource.baseType ||
      fallbackSource.type ||
      fallbackSource.group ||
      ""
  ).toUpperCase()
  const code = compactText(source.code || source.label || source.name || fallbackSource.code || fallbackSource.label || fallbackSource.name || "")
    .toUpperCase()
  const label = compactText(source.label || source.name || fallbackSource.label || fallbackSource.name || code)

  if (!code && !label) {
    return null
  }

  return {
    id:
      compactText(source.id) ||
      compactText(fallbackSource.id) ||
      makeStableId("site-class", normalizedSiteCode || normalizedBaseType || code || label, normalizedBaseType || code || label),
    baseType: normalizedBaseType || DEFAULT_SITE_CLASS_BASE_TYPES[0],
    code: code || label,
    label: label || code,
    description: compactText(source.description || source.notes || fallbackSource.description || fallbackSource.notes || ""),
    active: source.active !== false && fallbackSource.active !== false,
    order: Number.isFinite(Number(source.order))
      ? Number(source.order)
      : Number.isFinite(Number(fallbackSource.order))
        ? Number(fallbackSource.order)
        : 0
  }
}

const normalizeSiteClassEntries = (values, fallback = [], siteCode = "", baseType = "") => {
  const source = Array.isArray(values) && values.length > 0
    ? values
    : Array.isArray(fallback)
      ? fallback
      : []
  const normalized = []
  const seen = new Set()

  source.forEach((entry, index) => {
    const normalizedEntry = normalizeSiteClassEntry(entry, Array.isArray(fallback) ? fallback[index] || {} : {}, siteCode, baseType)

    if (!normalizedEntry) {
      return
    }

    const dedupeKey = compactText(normalizedEntry.id || "").toLowerCase() || compactText(normalizedEntry.code).toUpperCase()
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

const normalizeSiteClassGroup = (entry, fallback = {}, siteCode = "") => {
  const source = entry && typeof entry === "object" ? entry : {}
  const fallbackSource = fallback && typeof fallback === "object" ? fallback : {}
  const baseType = compactText(
    source.baseType ||
      source.code ||
      source.label ||
      fallbackSource.baseType ||
      fallbackSource.code ||
      fallbackSource.label ||
      ""
  ).toUpperCase()
  const normalizedSiteCode = compactText(siteCode).toUpperCase()
  const classSource = source.classes || source.classEntries || source.items || fallbackSource.classes || fallbackSource.classEntries || fallbackSource.items || []

  return {
    id:
      compactText(source.id) ||
      compactText(fallbackSource.id) ||
      makeStableId("site-class-group", normalizedSiteCode || baseType || "site", baseType || "group"),
    baseType: baseType || DEFAULT_SITE_CLASS_BASE_TYPES[0],
    label: compactText(source.label || fallbackSource.label || baseType),
    description: compactText(source.description || source.notes || fallbackSource.description || fallbackSource.notes || ""),
    active: source.active !== false && fallbackSource.active !== false,
    order: Number.isFinite(Number(source.order))
      ? Number(source.order)
      : Number.isFinite(Number(fallbackSource.order))
        ? Number(fallbackSource.order)
        : 0,
    classes: normalizeSiteClassEntries(classSource, fallbackSource.classes || [], normalizedSiteCode, baseType)
  }
}

const normalizeSiteClassGroups = (values, fallback = [], siteCode = "") => {
  const source = Array.isArray(values) && values.length > 0
    ? values
    : Array.isArray(fallback)
      ? fallback
      : []
  const normalized = []
  const seen = new Set()

  source.forEach((entry, index) => {
    const normalizedGroup = normalizeSiteClassGroup(entry, Array.isArray(fallback) ? fallback[index] || {} : {}, siteCode)

    if (!normalizedGroup.baseType) {
      return
    }

    const dedupeKey = compactText(normalizedGroup.id || "").toLowerCase() || normalizedGroup.baseType
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

const seedDefaultSiteClassGroups = (siteCode, groups = []) => {
  const normalizedGroups = normalizeSiteClassGroups(groups, [], siteCode)
  const groupsByBaseType = new Map(
    normalizedGroups
      .filter((group) => group.baseType)
      .map((group) => [group.baseType, group])
  )
  const seen = new Set()
  const seeded = []

  DEFAULT_SITE_CLASS_BASE_TYPES.forEach((baseType, index) => {
    const existing = groupsByBaseType.get(baseType)
    const normalizedGroup = existing
      ? {
          ...existing,
          locked: true,
          order: Number.isFinite(Number(existing.order)) ? Number(existing.order) : index
        }
      : normalizeSiteClassGroup(
          {
            baseType,
            label: baseType,
            description: ""
          },
          {
            baseType,
            label: baseType,
            description: "",
            order: index
          },
          siteCode
        )

    const dedupeKey = compactText(normalizedGroup.id || "").toLowerCase() || normalizedGroup.baseType
    if (seen.has(dedupeKey)) {
      return
    }

    seen.add(dedupeKey)
    seeded.push({
      ...normalizedGroup,
      locked: true
    })
  })

  normalizedGroups.forEach((group, index) => {
    if (DEFAULT_SITE_CLASS_BASE_TYPES.includes(group.baseType)) {
      return
    }

    const dedupeKey = compactText(group.id || "").toLowerCase() || group.baseType
    if (seen.has(dedupeKey)) {
      return
    }

    seen.add(dedupeKey)
    seeded.push({
      ...group,
      locked: false,
      order: Number.isFinite(Number(group.order)) ? Number(group.order) : DEFAULT_SITE_CLASS_BASE_TYPES.length + index
    })
  })

  return seeded
}

const normalizeRoomDetails = (values, siteId = "", fallback = []) => {
  const sourceValues = Array.isArray(values) && values.length > 0
    ? values
    : typeof values === "string" && values.trim()
      ? values
          .split(/\r?\n/)
          .map((line) => compactText(line))
          .filter(Boolean)
      : fallback
  const normalized = []
  const seen = new Set()

  sourceValues.forEach((entry, index) => {
    const source = entry && typeof entry === "object" && !Array.isArray(entry)
      ? entry
      : { code: entry, label: entry }
    const code = compactText(source.code || source.label || source.name || `ROOM${index + 1}`).toUpperCase()
    const label = compactText(source.label || source.name || source.code || code)
    const id = compactText(source.id) || makeStableId("room", siteId, code || label || index + 1)
    const dedupeKey = compactText(id).toLowerCase() || code || label.toUpperCase()

    if (!code && !label) {
      return
    }

    if (seen.has(dedupeKey)) {
      return
    }

    seen.add(dedupeKey)
    normalized.push({
      id,
      code,
      label,
      capacity: Number.isFinite(Number(source.capacity)) ? Number(source.capacity) : "",
      notes: compactText(source.notes || ""),
      active: source.active !== false,
      order: Number.isFinite(Number(source.order)) ? Number(source.order) : index,
      siteId
    })
  })

  return normalized
}

const normalizeCatalogSites = (values) => {
  const source = Array.isArray(values) ? values : []

  return source
    .map((site, index) => {
      const code = compactText(site?.code || site?.name || site?.label || `SITE${index + 1}`).toUpperCase()
      const id = compactText(site?.id) || makeStableId("site", code || site?.label || site?.name || index + 1)
      const label = compactText(site?.label || site?.name || code || `Site ${index + 1}`)
      const planningColor = normalizePlanningColor(
        site?.planningColor || site?.color || getDefaultPlanningColor(code || label, index)
      )
      const roomSource = Array.isArray(site?.roomDetails)
        ? site.roomDetails
        : Array.isArray(site?.rooms)
          ? site.rooms
          : typeof site?.roomsText === "string"
            ? site.roomsText.split(/\r?\n/).map((line) => compactText(line)).filter(Boolean)
            : []
      const roomDetails = normalizeRoomDetails(roomSource, id)
      const classSource = Array.isArray(site?.classGroups)
        ? site.classGroups
        : Array.isArray(site?.classes)
          ? site.classes
          : Array.isArray(site?.classCatalog)
            ? site.classCatalog
            : []
      const classGroups = seedDefaultSiteClassGroups(id, normalizeSiteClassGroups(classSource, [], id))

      return {
        id,
        code,
        label,
        planningColor,
        address: {
          line1: compactText(site?.address?.line1 || site?.address?.street || ""),
          line2: compactText(site?.address?.line2 || site?.address?.street2 || ""),
          postalCode: compactText(site?.address?.postalCode || site?.address?.zip || site?.address?.npa || ""),
          city: compactText(site?.address?.city || ""),
          canton: compactText(site?.address?.canton || ""),
          country: compactText(site?.address?.country || "Suisse")
        },
        roomDetails,
        rooms: roomDetails.map((room) => room.label || room.code).filter(Boolean),
        classGroups,
        notes: compactText(site?.notes || ""),
        active: site?.active !== false
      }
    })
    .filter((site) => site.code || site.label)
}

const syncSiteConfigsToCatalog = (siteConfigs, sites) => {
  const catalogSites = Array.isArray(sites) ? sites : []
  const sourceConfigs = Array.isArray(siteConfigs) ? siteConfigs : []
  const configById = new Map(
    sourceConfigs
      .filter((config) => compactText(config?.siteId))
      .map((config) => [compactText(config.siteId).toLowerCase(), config])
  )

  return catalogSites.map((site, index) => {
    const siteId = compactText(site?.id || site?.siteId || "").toLowerCase() || compactText(site?.code).toLowerCase() || generateLocalId("site")
    const existing = configById.get(siteId) || sourceConfigs[index] || {}

    return {
      id: compactText(existing?.id) || generateLocalId("site-config"),
      siteId,
      siteCode: compactText(site?.code || existing?.siteCode || ""),
      breaklineMinutes: Number.isFinite(Number(existing?.breaklineMinutes))
        ? Number(existing.breaklineMinutes)
        : DEFAULT_SITE_SCHEDULE.breaklineMinutes,
      tpiTimeMinutes: Number.isFinite(Number(existing?.tpiTimeMinutes))
        ? Number(existing.tpiTimeMinutes)
        : DEFAULT_SITE_SCHEDULE.tpiTimeMinutes,
      firstTpiStartTime: compactText(existing?.firstTpiStartTime) || DEFAULT_SITE_SCHEDULE.firstTpiStartTime,
      numSlots: Number.isFinite(Number(existing?.numSlots)) && Number(existing.numSlots) > 0
        ? Number(existing.numSlots)
        : DEFAULT_SITE_SCHEDULE.numSlots,
      manualRoomTarget: Number.isFinite(Number(existing?.manualRoomTarget)) && Number(existing.manualRoomTarget) >= 0
        ? Number(existing.manualRoomTarget)
        : "",
      notes: compactText(existing?.notes || ""),
      active: existing?.active !== false
    }
  })
}

const normalizeYearDraft = (payload, year, catalogSites = []) => {
  const source = payload && typeof payload === "object" ? payload : {}
  const numericYear = Number.isInteger(Number(year))
    ? Number(year)
    : Number.isInteger(Number(source.year))
      ? Number(source.year)
      : YEARS_CONFIG.getCurrentYear()

  return {
    year: numericYear,
    schemaVersion: Number.isFinite(Number(source.schemaVersion)) ? Number(source.schemaVersion) : 2,
    classTypes: normalizeClassTypes(source.classTypes),
    siteConfigs: syncSiteConfigsToCatalog(source.siteConfigs || source.sites || [], catalogSites)
  }
}

const normalizeCatalogDraft = (payload) => {
  const source = payload && typeof payload === "object" ? payload : {}

  return {
    key: compactText(source.key || "shared") || "shared",
    schemaVersion: Number.isFinite(Number(source.schemaVersion)) ? Number(source.schemaVersion) : 2,
    sites: normalizeCatalogSites(source.sites || [])
  }
}

const buildClassTypePayload = (classType) => ({
  id: compactText(classType.id) || generateLocalId("class"),
  code: compactText(classType.code).toUpperCase(),
  prefix: compactText(classType.prefix || compactText(classType.code).slice(0, 1)),
  label: compactText(classType.label || classType.code),
  startDate: normalizeDateInputValue(classType.startDate),
  endDate: normalizeDateInputValue(classType.endDate),
  soutenanceDates: classTypeTextToDates(classType.soutenanceDatesText || "").map((entry) => ({
    date: entry.date,
    min: Boolean(entry.min),
    special: Boolean(entry.special),
    classes: Array.from(new Set([
      compactText(classType.code).toUpperCase(),
      compactText(classType.prefix || compactText(classType.code).slice(0, 1)).toUpperCase()
    ].filter(Boolean)))
  })),
  notes: compactText(classType.notes),
  active: classType.active !== false
})

const buildYearPayload = (draft, year, catalogSites = []) => {
  const source = draft && typeof draft === "object" ? draft : normalizeYearDraft({}, year, catalogSites)
  const classTypes = normalizeClassTypes(source.classTypes).map(buildClassTypePayload)
  const siteConfigs = syncSiteConfigsToCatalog(source.siteConfigs, catalogSites).map((siteConfig) => ({
    id: compactText(siteConfig.id) || generateLocalId("site-config"),
    siteId: compactText(siteConfig.siteId),
    siteCode: compactText(siteConfig.siteCode).toUpperCase(),
    breaklineMinutes: Number.isFinite(Number(siteConfig.breaklineMinutes))
      ? Number(siteConfig.breaklineMinutes)
      : DEFAULT_SITE_SCHEDULE.breaklineMinutes,
    tpiTimeMinutes: Number.isFinite(Number(siteConfig.tpiTimeMinutes))
      ? Number(siteConfig.tpiTimeMinutes)
      : DEFAULT_SITE_SCHEDULE.tpiTimeMinutes,
    firstTpiStartTime: compactText(siteConfig.firstTpiStartTime) || DEFAULT_SITE_SCHEDULE.firstTpiStartTime,
    numSlots: Number.isFinite(Number(siteConfig.numSlots)) && Number(siteConfig.numSlots) > 0
      ? Number(siteConfig.numSlots)
      : DEFAULT_SITE_SCHEDULE.numSlots,
    manualRoomTarget: Number.isFinite(Number(siteConfig.manualRoomTarget)) && Number(siteConfig.manualRoomTarget) >= 0
      ? Number(siteConfig.manualRoomTarget)
      : null,
    notes: compactText(siteConfig.notes || ""),
    active: siteConfig.active !== false
  }))

  return {
    year: Number.isInteger(Number(year)) ? Number(year) : source.year,
    schemaVersion: Number.isFinite(Number(source.schemaVersion)) ? Number(source.schemaVersion) : 2,
    classTypes,
    soutenanceDates: normalizeSoutenanceDateEntries(
      classTypes.flatMap((classType) => classType.soutenanceDates)
    ),
    siteConfigs
  }
}

const buildCatalogPayload = (draft) => {
  const source = draft && typeof draft === "object" ? draft : normalizeCatalogDraft({})

  return {
    key: compactText(source.key || "shared") || "shared",
    schemaVersion: Number.isFinite(Number(source.schemaVersion)) ? Number(source.schemaVersion) : 2,
    sites: normalizeCatalogSites(source.sites || []).map((site) => {
      const roomDetails = normalizeRoomDetails(site.roomDetails, compactText(site.id))
      const classGroups = Array.isArray(site.classGroups)
        ? site.classGroups.map((group, groupIndex) => buildSiteClassGroupPayload(group, site.id, groupIndex))
        : []

      return {
        id: compactText(site.id) || generateLocalId("site"),
        code: compactText(site.code).toUpperCase(),
        label: compactText(site.label || site.code),
        planningColor: normalizePlanningColor(
          site.planningColor || getDefaultPlanningColor(site.code || site.label)
        ),
        address: {
          line1: compactText(site.address?.line1),
          line2: compactText(site.address?.line2),
          postalCode: compactText(site.address?.postalCode),
          city: compactText(site.address?.city),
          canton: compactText(site.address?.canton),
          country: compactText(site.address?.country)
        },
        roomDetails,
        rooms: roomDetails.map((room) => room.label || room.code).filter(Boolean),
        classGroups,
        notes: compactText(site.notes || ""),
        active: site.active !== false
      }
    })
  }
}

const createBlankClassType = (index = 1) => ({
  id: generateLocalId("class"),
  code: `TYPE${index}`,
  prefix: `T${index}`,
  label: `Type ${index}`,
  startDate: "",
  endDate: "",
  soutenanceDatesText: "",
  notes: "",
  active: true
})

const createBlankRoom = (index = 1, siteId = "") => ({
  id: generateLocalId("room"),
  code: `ROOM${index}`,
  label: `Salle ${index}`,
  capacity: "",
  notes: "",
  active: true,
  order: index,
  siteId
})

const appendGeneratedRoomsToSite = (site, count = 0) => {
  const requestedCount = Number.isInteger(Number(count)) ? Number(count) : 0
  if (requestedCount <= 0) {
    return Array.isArray(site?.roomDetails) ? site.roomDetails : []
  }

  const existingRooms = Array.isArray(site?.roomDetails) ? site.roomDetails : []
  const existingCodes = new Set(
    existingRooms
      .map((room) => compactText(room?.code).toUpperCase())
      .filter(Boolean)
  )
  const existingLabels = new Set(
    existingRooms
      .map((room) => compactText(room?.label).toLowerCase())
      .filter(Boolean)
  )
  const siteCode = compactText(site?.code).toUpperCase()
  const generatedRooms = []
  let sequence = 1

  while (generatedRooms.length < requestedCount) {
    const padded = String(sequence).padStart(2, "0")
    const code = siteCode ? `${siteCode}-${padded}` : `ROOM${sequence}`
    const label = siteCode ? `${siteCode} ${padded}` : `Salle ${sequence}`
    sequence += 1

    if (existingCodes.has(code) || existingLabels.has(label.toLowerCase())) {
      continue
    }

    existingCodes.add(code)
    existingLabels.add(label.toLowerCase())
    generatedRooms.push({
      ...createBlankRoom(existingRooms.length + generatedRooms.length + 1, compactText(site?.id)),
      code,
      label,
      notes: "Générée depuis la cible manuelle",
      order: existingRooms.length + generatedRooms.length
    })
  }

  return [...existingRooms, ...generatedRooms]
}

const createBlankSite = (index = 1) => {
  const id = generateLocalId("site")
  const code = `SITE${index}`

  return {
    id,
    code,
    label: `Site ${index}`,
    planningColor: getDefaultPlanningColor(code, index - 1),
    address: { ...DEFAULT_ADDRESS, country: "Suisse" },
    roomDetails: [],
    rooms: [],
    classGroups: createDefaultSiteClassGroups(id),
    notes: "",
    active: true
  }
}

const createBlankSiteConfig = (site) => ({
  id: generateLocalId("site-config"),
  siteId: compactText(site?.id) || generateLocalId("site"),
  siteCode: compactText(site?.code || "").toUpperCase(),
  breaklineMinutes: DEFAULT_SITE_SCHEDULE.breaklineMinutes,
  tpiTimeMinutes: DEFAULT_SITE_SCHEDULE.tpiTimeMinutes,
  firstTpiStartTime: DEFAULT_SITE_SCHEDULE.firstTpiStartTime,
  numSlots: DEFAULT_SITE_SCHEDULE.numSlots,
  manualRoomTarget: "",
  notes: "",
  active: true
})

const createBlankSiteClassEntry = (baseType, index = 1) => {
  const normalizedBaseType = compactText(baseType || DEFAULT_SITE_CLASS_BASE_TYPES[0]).toUpperCase()

  return {
    id: generateLocalId("class"),
    baseType: normalizedBaseType,
    code: `${normalizedBaseType}${index}`,
    label: `${normalizedBaseType} ${index}`,
    description: "",
    active: true,
    order: index - 1
  }
}

const getNextAnnualClassTypeIndex = (classTypes = []) => {
  const maxIndex = Array.isArray(classTypes)
    ? classTypes.reduce((max, classType) => {
        const code = compactText(classType?.code).toUpperCase()
        const match = code.match(/^TYPE(\d+)$/)

        if (!match) {
          return max
        }

        return Math.max(max, Number.parseInt(match[1], 10))
      }, 0)
    : 0

  return maxIndex + 1
}

const getNextSiteClassIndex = (group) => {
  const baseType = compactText(group?.baseType).toUpperCase()
  const escapedBaseType = baseType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^${escapedBaseType}(\\d+)$`)
  const maxIndex = Array.isArray(group?.classes)
    ? group.classes.reduce((max, entry) => {
        const code = compactText(entry?.code).toUpperCase()
        const match = code.match(pattern)

        if (!match) {
          return max
        }

        return Math.max(max, Number.parseInt(match[1], 10))
      }, 0)
    : 0

  return maxIndex + 1
}

const createBlankSiteClassGroup = (baseType, siteCode = "", index = 0) => {
  const normalizedBaseType = compactText(baseType || DEFAULT_SITE_CLASS_BASE_TYPES[index] || "").toUpperCase()

  return {
    id: makeStableId("site-class-group", siteCode, normalizedBaseType),
    baseType: normalizedBaseType,
    label: normalizedBaseType,
    description: "",
    active: true,
    order: index,
    classes: []
  }
}

const createDefaultSiteClassGroups = (siteCode = "", groups = []) => {
  const baseGroups = DEFAULT_SITE_CLASS_BASE_TYPES.map((baseType, index) => {
    const existing = Array.isArray(groups)
      ? groups.find((group) => compactText(group?.baseType).toUpperCase() === baseType)
      : null

    if (existing) {
      return {
        ...createBlankSiteClassGroup(baseType, siteCode, index),
        classes: Array.isArray(existing.classes)
          ? existing.classes.map((entry, entryIndex) => ({
              ...createBlankSiteClassEntry(baseType, entryIndex + 1),
              ...entry,
              baseType,
              id: compactText(entry?.id) || makeStableId("site-class", siteCode, baseType, entry?.code || entry?.label || entryIndex + 1)
            }))
          : []
      }
    }

    return createBlankSiteClassGroup(baseType, siteCode, index)
  })

  return baseGroups
}

const cloneSiteClassEntryForSite = (entry, baseType, siteCode = "", groupIndex = 0, entryIndex = 0) => {
  const normalizedBaseType = compactText(entry?.baseType || baseType || DEFAULT_SITE_CLASS_BASE_TYPES[0]).toUpperCase()
  const code = compactText(entry?.code || entry?.label || `${normalizedBaseType}${entryIndex + 1}`).toUpperCase()

  return {
    ...entry,
    id: makeStableId(
      "site-class",
      compactText(siteCode).toUpperCase() || normalizedBaseType,
      normalizedBaseType,
      code,
      groupIndex,
      entryIndex
    ),
    baseType: normalizedBaseType || DEFAULT_SITE_CLASS_BASE_TYPES[0],
    code,
    label: compactText(entry?.label || code),
    description: compactText(entry?.description || ""),
    active: entry?.active !== false,
    order: Number.isFinite(Number(entry?.order)) ? Number(entry.order) : entryIndex
  }
}

const cloneSiteClassGroupForSite = (group, siteCode = "", groupIndex = 0) => {
  const normalizedBaseType = compactText(group?.baseType || group?.code || group?.label || DEFAULT_SITE_CLASS_BASE_TYPES[groupIndex] || "").toUpperCase()
  const classes = Array.isArray(group?.classes)
    ? group.classes.map((entry, entryIndex) =>
        cloneSiteClassEntryForSite(entry, normalizedBaseType, siteCode, groupIndex, entryIndex)
      )
    : []

  return {
    ...group,
    id: makeStableId(
      "site-class-group",
      compactText(siteCode).toUpperCase() || normalizedBaseType,
      normalizedBaseType,
      groupIndex
    ),
    baseType: normalizedBaseType || DEFAULT_SITE_CLASS_BASE_TYPES[0],
    label: compactText(group?.label || normalizedBaseType),
    description: compactText(group?.description || ""),
    active: group?.active !== false,
    order: Number.isFinite(Number(group?.order)) ? Number(group.order) : groupIndex,
    classes
  }
}

const buildSiteClassEntryPayload = (entry, baseType, siteCode = "", index = 0) => {
  const normalizedBaseType = compactText(entry?.baseType || baseType || "").toUpperCase()
  const normalizedSiteCode = compactText(siteCode).toUpperCase()
  const code = compactText(entry?.code || entry?.label || `${normalizedBaseType}${index + 1}`).toUpperCase()

  return {
    id: compactText(entry?.id) || makeStableId("site-class", normalizedSiteCode || normalizedBaseType, normalizedBaseType, code),
    baseType: normalizedBaseType || DEFAULT_SITE_CLASS_BASE_TYPES[0],
    code,
    label: compactText(entry?.label || code),
    description: compactText(entry?.description || ""),
    active: entry?.active !== false,
    order: Number.isFinite(Number(entry?.order)) ? Number(entry.order) : index
  }
}

const buildSiteClassGroupPayload = (group, siteCode = "", index = 0) => {
  const normalizedBaseType = compactText(group?.baseType || group?.label || "").toUpperCase()
  const classes = Array.isArray(group?.classes)
    ? group.classes.map((entry, entryIndex) => buildSiteClassEntryPayload(entry, normalizedBaseType, siteCode, entryIndex))
    : []

  return {
    id: compactText(group?.id) || makeStableId("site-class-group", compactText(siteCode).toUpperCase() || normalizedBaseType, normalizedBaseType, index),
    baseType: normalizedBaseType || DEFAULT_SITE_CLASS_BASE_TYPES[0],
    label: compactText(group?.label || normalizedBaseType),
    description: compactText(group?.description || ""),
    active: group?.active !== false,
    order: Number.isFinite(Number(group?.order)) ? Number(group.order) : index,
    classes
  }
}

const cloneSiteClassGroupsForSite = (groups, siteCode) => {
  const source = Array.isArray(groups) ? groups : []
  const cloned = source.map((group, groupIndex) => cloneSiteClassGroupForSite(group, siteCode, groupIndex))
  const groupsByBaseType = new Map(
    cloned
      .filter((group) => compactText(group?.baseType).toUpperCase())
      .map((group) => [compactText(group.baseType).toUpperCase(), group])
  )

  const seededDefaults = DEFAULT_SITE_CLASS_BASE_TYPES.map((baseType, index) => {
    const existing = groupsByBaseType.get(baseType)
    if (existing) {
      return {
        ...existing,
        order: Number.isFinite(Number(existing.order)) ? Number(existing.order) : index
      }
    }

    return createBlankSiteClassGroup(baseType, siteCode, index)
  })

  const customGroups = cloned.filter((group) => !DEFAULT_SITE_CLASS_BASE_TYPES.includes(compactText(group?.baseType).toUpperCase()))
  return [...seededDefaults, ...customGroups]
}

const getInitialSelectedYear = () => {
  const storedYear = Number.parseInt(readStorageValue(STORAGE_KEYS.PLANNING_SELECTED_YEAR, ""), 10)
  if (Number.isInteger(storedYear)) {
    return storedYear
  }

  return YEARS_CONFIG.getCurrentYear()
}

const formatDateRangeLabel = (startDate, endDate) => {
  const start = compactText(startDate)
  const end = compactText(endDate)

  if (start && end) {
    return `${start} → ${end}`
  }

  if (start) {
    return `Début ${start}`
  }

  if (end) {
    return `Fin ${end}`
  }

  return "Période non définie"
}

const formatClassTypeSummaryLine = (classType = {}) => {
  const prefix = compactText(classType?.prefix || classType?.code || "Type")
  const label = compactText(classType?.label || classType?.code || "Type")
  const rangeLabel = formatDateRangeLabel(classType?.startDate, classType?.endDate)

  return [prefix, label, rangeLabel].filter(Boolean).join(" · ")
}

const formatRoomNamesSummary = (roomDetails = []) => {
  const roomNames = Array.isArray(roomDetails)
    ? roomDetails
        .map((room) => compactText(room?.label || room?.code))
        .filter(Boolean)
    : []

  return roomNames.length > 0 ? roomNames.join(" · ") : "Aucune salle"
}

const getSiteStatistics = (site = {}) => {
  const roomCount = Array.isArray(site?.roomDetails) ? site.roomDetails.length : 0
  const groupCount = Array.isArray(site?.classGroups) ? site.classGroups.length : 0
  const classCount = Array.isArray(site?.classGroups)
    ? site.classGroups.reduce(
        (count, group) => count + (Array.isArray(group?.classes) ? group.classes.length : 0),
        0
      )
    : 0
  return {
    roomCount,
    groupCount,
    classCount
  }
}

const SectionToggleButton = ({
  isOpen,
  onClick,
  controlsId,
  subject = "",
  className = "",
  iconOnly = false,
  openLabel = "Ouvrir",
  closeLabel = "Réduire"
}) => {
  const label = isOpen ? closeLabel : openLabel
  const ariaLabel = subject ? `${label} ${subject}` : label

  return (
    <button
      type='button'
      className={`collapse-toggle ${iconOnly ? "collapse-toggle-mini" : "collapse-toggle-header"} configuration-collapse-toggle ${isOpen ? "active" : ""} ${className}`.trim()}
      onClick={onClick}
      aria-expanded={isOpen}
      aria-controls={controlsId}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {!iconOnly ? <span className='collapse-toggle-label'>{label}</span> : null}
      <span className='collapse-toggle-icon' aria-hidden='true'></span>
    </button>
  )
}

const ClassTypeCard = ({ classType, onChange, onRemove, disabled = false }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const locked = classType?.locked === true
  const bodyId = `configuration-class-type-body-${classType?.id || classType?.code || "item"}`
  const summaryLine = formatClassTypeSummaryLine(classType)

  return (
    <article className={`configuration-card configuration-class-card${isExpanded ? "" : " is-collapsed"}`}>
      {isExpanded ? (
        <div className='configuration-card-head'>
          <div className='configuration-card-head-copy'>
            <span className='configuration-card-kicker'>
              {classType?.prefix || classType?.code || "?"}
            </span>
            <h4>{classType?.label || classType?.code || "Type"}</h4>
          </div>
          <div className='configuration-card-head-actions configuration-site-class-group-head-actions'>
            {locked ? <span className='page-tools-chip'>Base</span> : null}
            <SectionToggleButton
              isOpen={isExpanded}
              onClick={() => setIsExpanded((current) => !current)}
              controlsId={bodyId}
              subject={`le type ${classType?.label || classType?.code || ""}`.trim()}
              className='configuration-collapse-toggle--compact'
            />
            {!locked ? (
              <button
                type='button'
                className='page-tools-action-btn ghost'
                onClick={onRemove}
                disabled={disabled}
              >
                Supprimer
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className='configuration-collapsed-row'>
          <p className='configuration-collapsed-line'>{summaryLine}</p>
          <SectionToggleButton
            isOpen={isExpanded}
            onClick={() => setIsExpanded((current) => !current)}
            controlsId={bodyId}
            subject={`le type ${classType?.label || classType?.code || ""}`.trim()}
            iconOnly={true}
            className='configuration-collapse-toggle--icon-only'
          />
        </div>
      )}

      <div id={bodyId} className='configuration-card-body' hidden={!isExpanded}>
        <div className='configuration-card-grid configuration-card-grid--class-type'>
          <label className='page-tools-field configuration-class-type-field configuration-class-type-field--code'>
            <span className='page-tools-field-label'>Code</span>
            <input
              className='page-tools-field-control'
              type='text'
              value={classType?.code || ""}
              onChange={(event) => onChange("code", event.target.value)}
              disabled={disabled || locked}
            />
          </label>

          <label className='page-tools-field configuration-class-type-field configuration-class-type-field--prefix'>
            <span className='page-tools-field-label'>Préfixe</span>
            <input
              className='page-tools-field-control'
              type='text'
              value={classType?.prefix || ""}
              onChange={(event) => onChange("prefix", event.target.value)}
              disabled={disabled || locked}
            />
          </label>

          <label className='page-tools-field configuration-class-type-field configuration-class-type-field--label'>
            <span className='page-tools-field-label'>Libellé</span>
            <input
              className='page-tools-field-control'
              type='text'
              value={classType?.label || ""}
              onChange={(event) => onChange("label", event.target.value)}
              disabled={disabled || locked}
            />
          </label>

          <label className='page-tools-field configuration-class-type-field configuration-class-type-field--date'>
            <span className='page-tools-field-label'>Début</span>
            <input
              className='page-tools-field-control'
              type='date'
              value={classType?.startDate || ""}
              onChange={(event) => onChange("startDate", event.target.value)}
              disabled={disabled}
            />
          </label>

          <label className='page-tools-field configuration-class-type-field configuration-class-type-field--date'>
            <span className='page-tools-field-label'>Fin</span>
            <input
              className='page-tools-field-control'
              type='date'
              value={classType?.endDate || ""}
              onChange={(event) => onChange("endDate", event.target.value)}
              disabled={disabled}
            />
          </label>

          <label className='page-tools-field configuration-class-type-field configuration-class-type-field--notes'>
            <span className='page-tools-field-label'>Notes</span>
            <input
              className='page-tools-field-control'
              type='text'
              value={classType?.notes || ""}
              onChange={(event) => onChange("notes", event.target.value)}
              disabled={disabled}
            />
          </label>
        </div>

        <label className='page-tools-field configuration-class-type-soutenance'>
          <span className='page-tools-field-label'>Soutenance</span>
          <textarea
            className='page-tools-field-control configuration-textarea'
            rows='3'
            value={classType?.soutenanceDatesText || ""}
            onChange={(event) => onChange("soutenanceDatesText", event.target.value)}
            placeholder='2026-06-01 SPECIAL'
            disabled={disabled}
          />
        </label>
      </div>
    </article>
  )
}

const SiteScheduleCard = ({ site, schedule, onChange, disabled = false }) => (
  <article className='configuration-card configuration-schedule-card'>
    <div className='configuration-card-head'>
      <div className='configuration-card-head-copy'>
        <span className='configuration-card-kicker'>
          <TimeIcon className='configuration-card-icon' />
        </span>
        <h4>{site?.label || site?.code || "Site"}</h4>
      </div>
    </div>

    <div className='configuration-card-grid configuration-card-grid--schedule'>
      <label className='page-tools-field'>
        <span className='page-tools-field-label'>Pause entre TPI (min)</span>
        <input
          className='page-tools-field-control'
          type='number'
          min='0'
          step='1'
          value={schedule?.breaklineMinutes ?? DEFAULT_SITE_SCHEDULE.breaklineMinutes}
          onChange={(event) => onChange("breaklineMinutes", Number.parseInt(event.target.value, 10))}
          disabled={disabled}
        />
      </label>

      <label className='page-tools-field'>
        <span className='page-tools-field-label'>Durée TPI (min)</span>
        <input
          className='page-tools-field-control'
          type='number'
          min='1'
          step='1'
          value={schedule?.tpiTimeMinutes ?? DEFAULT_SITE_SCHEDULE.tpiTimeMinutes}
          onChange={(event) => onChange("tpiTimeMinutes", Number.parseInt(event.target.value, 10))}
          disabled={disabled}
        />
      </label>

      <label className='page-tools-field'>
        <span className='page-tools-field-label'>Premier TPI</span>
        <input
          className='page-tools-field-control'
          type='time'
          step='900'
          value={schedule?.firstTpiStartTime || DEFAULT_SITE_SCHEDULE.firstTpiStartTime}
          onChange={(event) => onChange("firstTpiStartTime", event.target.value)}
          disabled={disabled}
        />
      </label>

      <label className='page-tools-field'>
        <span className='page-tools-field-label'>Créneaux / room</span>
        <input
          className='page-tools-field-control'
          type='number'
          min='1'
          step='1'
          value={schedule?.numSlots ?? DEFAULT_SITE_SCHEDULE.numSlots}
          onChange={(event) => onChange("numSlots", Number.parseInt(event.target.value, 10))}
          disabled={disabled}
        />
      </label>

      <label className='page-tools-field'>
        <span
          className='page-tools-field-label configuration-help-label'
          title='Nombre de rooms à prévoir pour chaque date sur ce site. Laisser vide pour utiliser le calcul automatique.'
        >
          Rooms / date
        </span>
        <input
          className='page-tools-field-control'
          type='number'
          min='0'
          step='1'
          value={schedule?.manualRoomTarget ?? ""}
          onChange={(event) =>
            onChange(
              "manualRoomTarget",
              event.target.value === "" ? "" : Number.parseInt(event.target.value, 10)
            )
          }
          placeholder='Auto'
          disabled={disabled}
        />
      </label>

      <label className='page-tools-field configuration-schedule-field configuration-schedule-field--notes'>
        <span className='page-tools-field-label'>Notes</span>
        <input
          className='page-tools-field-control'
          type='text'
          value={schedule?.notes || ""}
          onChange={(event) => onChange("notes", event.target.value)}
          disabled={disabled}
        />
      </label>
    </div>
  </article>
)

const RoomRow = ({ room, siteId = "", onChange, onRemove, disabled = false }) => (
  <article className='configuration-room-row'>
    <div className='configuration-room-row-head'>
      <strong>{room?.label || room?.code || "Salle"}</strong>
      <button
        type='button'
        className='page-tools-action-btn ghost'
        onClick={onRemove}
        disabled={disabled}
      >
        Supprimer
      </button>
    </div>

    <div className='configuration-room-grid'>
      <label className='page-tools-field configuration-room-field configuration-room-field--code'>
        <span className='page-tools-field-label'>Code</span>
        <input
          className='page-tools-field-control'
          type='text'
          value={room?.code || ""}
          onChange={(event) => onChange("code", event.target.value)}
          disabled={disabled}
        />
      </label>

      <label className='page-tools-field configuration-room-field configuration-room-field--name'>
        <span className='page-tools-field-label'>Nom</span>
        <input
          className='page-tools-field-control'
          type='text'
          value={room?.label || ""}
          onChange={(event) => onChange("label", event.target.value)}
          disabled={disabled}
        />
      </label>

      <label className='page-tools-field configuration-room-field configuration-room-field--capacity'>
        <span className='page-tools-field-label'>Capacité</span>
        <input
          className='page-tools-field-control'
          type='number'
          min='0'
          step='1'
          value={room?.capacity ?? ""}
          onChange={(event) => onChange("capacity", event.target.value === "" ? "" : Number.parseInt(event.target.value, 10))}
          disabled={disabled}
        />
      </label>

      <label className='page-tools-field configuration-room-field configuration-room-field--notes'>
        <span className='page-tools-field-label'>Notes</span>
        <input
          className='page-tools-field-control'
          type='text'
          value={room?.notes || ""}
          onChange={(event) => onChange("notes", event.target.value)}
          disabled={disabled}
        />
      </label>

      <div className='page-tools-field configuration-room-field configuration-room-field--toggle'>
        <BinaryToggle
          value={room?.active !== false}
          onChange={(nextValue) => onChange("active", nextValue)}
          name={`configuration-room-active-${siteId || "site"}-${room?.id || room?.code || room?.label || "room"}`}
          className='configuration-toggle-switch'
          trueLabel='Oui'
          falseLabel='Non'
          ariaLabel={`Salle ${room?.label || room?.code || "salle"} active ou inactive`}
          disabled={disabled}
        />
      </div>
    </div>
  </article>
)

const SiteClassEntryRow = ({ entry, siteId = "", onChange, onRemove, disabled = false }) => (
  <article className='configuration-site-class-entry'>
    <div className='configuration-site-class-entry-head'>
      <strong>{entry?.label || entry?.code || "Classe"}</strong>
      <button
        type='button'
        className='page-tools-action-btn ghost'
        onClick={onRemove}
        disabled={disabled}
      >
        Supprimer
      </button>
    </div>

    <div className='configuration-card-grid configuration-card-grid--site-class-entry'>
      <label className='page-tools-field configuration-site-class-field configuration-site-class-field--code'>
        <span className='page-tools-field-label'>Code</span>
        <input
          className='page-tools-field-control'
          type='text'
          value={entry?.code || ""}
          onChange={(event) => onChange("code", event.target.value)}
          disabled={disabled}
        />
      </label>

      <label className='page-tools-field configuration-site-class-field configuration-site-class-field--name'>
        <span className='page-tools-field-label'>Nom</span>
        <input
          className='page-tools-field-control'
          type='text'
          value={entry?.label || ""}
          onChange={(event) => onChange("label", event.target.value)}
          disabled={disabled}
        />
      </label>

      <label className='page-tools-field configuration-site-class-field configuration-site-class-field--description'>
        <span className='page-tools-field-label'>Description</span>
        <input
          className='page-tools-field-control'
          type='text'
          value={entry?.description || ""}
          onChange={(event) => onChange("description", event.target.value)}
          disabled={disabled}
        />
      </label>

      <div className='page-tools-field configuration-site-class-field configuration-site-class-field--toggle'>
        <BinaryToggle
          value={entry?.active !== false}
          onChange={(nextValue) => onChange("active", nextValue)}
          name={`configuration-site-class-entry-active-${siteId || "site"}-${entry?.id || entry?.code || "entry"}`}
          className='configuration-toggle-switch'
          trueLabel='Oui'
          falseLabel='Non'
          ariaLabel={`Classe ${entry?.label || entry?.code || "classe"} active ou inactive`}
          disabled={disabled}
        />
      </div>
    </div>
  </article>
)

const SiteClassGroupCard = ({ siteId = "", group, onAddClass, onClassChange, onClassRemove, disabled = false }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const classCount = Array.isArray(group?.classes) ? group.classes.length : 0
  const activeClassCount = Array.isArray(group?.classes)
    ? group.classes.filter((entry) => entry?.active !== false).length
    : 0
  const bodyId = `configuration-site-class-group-body-${siteId || "site"}-${group?.id || group?.baseType || "group"}`
  const summaryLine = [
    group?.label || group?.baseType || "Famille",
    `${classCount} classe${classCount > 1 ? "s" : ""}`,
    `${activeClassCount} active${activeClassCount > 1 ? "s" : ""}`
  ].join(" · ")

  return (
    <article className={`configuration-card configuration-site-class-group${isExpanded ? "" : " is-collapsed"}`}>
      {isExpanded ? (
        <div className='configuration-card-head configuration-site-class-group-head'>
          <div className='configuration-site-class-group-head-copy'>
            <span className='configuration-card-kicker'>{group?.baseType || "TYPE"}</span>
            <h5>{group?.label || group?.baseType || "Famille"}</h5>
          </div>
          <div className='configuration-card-head-actions configuration-site-class-group-head-actions'>
            <button
              type='button'
              className='page-tools-action-btn ghost'
              onClick={onAddClass}
              disabled={disabled}
            >
              Ajouter
            </button>
            <SectionToggleButton
              isOpen={isExpanded}
              onClick={() => setIsExpanded((current) => !current)}
              controlsId={bodyId}
              subject={`le groupe ${group?.label || group?.baseType || ""}`.trim()}
              className='configuration-collapse-toggle--compact'
            />
          </div>
        </div>
      ) : (
        <div className='configuration-collapsed-row'>
          <p className='configuration-collapsed-line'>{summaryLine}</p>
          <SectionToggleButton
            isOpen={isExpanded}
            onClick={() => setIsExpanded((current) => !current)}
            controlsId={bodyId}
            subject={`le groupe ${group?.label || group?.baseType || ""}`.trim()}
            iconOnly={true}
            className='configuration-collapse-toggle--icon-only'
          />
        </div>
      )}

      <div id={bodyId} className='configuration-site-class-group-body' hidden={!isExpanded}>
        <div className='configuration-site-class-list'>
          {Array.isArray(group?.classes) && group.classes.length > 0 ? (
            group.classes.map((entry, entryIndex) => (
              <SiteClassEntryRow
                key={entry.id || entryIndex}
                siteId={siteId}
                entry={entry}
                onChange={(field, value) => onClassChange(entry.id || entryIndex, field, value)}
                onRemove={() => onClassRemove(entry.id || entryIndex)}
                disabled={disabled}
              />
            ))
          ) : (
            <p className='configuration-empty-hint'>Aucune classe.</p>
          )}
        </div>
      </div>
    </article>
  )
}

const SiteClassCatalogCard = ({
  site,
  sites = [],
  onClassChange,
  onAddClass,
  onRemoveClass,
  onCopyClassesFromSite,
  disabled = false
}) => {
  const [copySourceSiteId, setCopySourceSiteId] = useState("")
  const [activeGroupId, setActiveGroupId] = useState("")
  const allSiteOptions = Array.isArray(sites)
    ? sites.filter((entry) => entry?.id && entry.id !== site?.id)
    : []
  const groupList = useMemo(() => (Array.isArray(site?.classGroups) ? site.classGroups : []), [site?.classGroups])
  const groupTabs = useMemo(
    () =>
      groupList.map((group, index) => {
        const key = compactText(group?.id) || compactText(group?.baseType) || `group-${index}`
        const classCount = Array.isArray(group?.classes) ? group.classes.length : 0

        return {
          key,
          group,
          classCount
        }
      }),
    [groupList]
  )
  const activeGroup = useMemo(() => {
    if (groupTabs.length === 0) {
      return null
    }

    return groupTabs.find((tab) => tab.key === activeGroupId) || groupTabs[0]
  }, [activeGroupId, groupTabs])
  const activeTabButtonId = activeGroup ? `configuration-site-class-tabs-${site?.id || site?.code || "site"}-${activeGroup.key}` : ""
  const panelId = `configuration-site-class-panel-${site?.id || site?.code || "site"}`

  useEffect(() => {
    if (groupTabs.length === 0) {
      setActiveGroupId("")
      return
    }

    const selectedKey = compactText(activeGroupId)
    const hasSelection = groupTabs.some((tab) => tab.key === selectedKey)

    if (!hasSelection) {
      setActiveGroupId(groupTabs[0].key)
    }
  }, [activeGroupId, groupTabs])

  useEffect(() => {
    if (groupTabs.length > 0 && !activeGroupId) {
      setActiveGroupId(groupTabs[0].key)
    }
  }, [activeGroupId, groupTabs])

  const handleGroupTabKeyDown = useCallback(
    (event, tabIndex) => {
      if (groupTabs.length === 0) {
        return
      }

      let nextIndex = null

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          nextIndex = (tabIndex + 1) % groupTabs.length
          break
        case "ArrowLeft":
        case "ArrowUp":
          nextIndex = (tabIndex - 1 + groupTabs.length) % groupTabs.length
          break
        case "Home":
          nextIndex = 0
          break
        case "End":
          nextIndex = groupTabs.length - 1
          break
        default:
          return
      }

      event.preventDefault()
      const nextTab = groupTabs[nextIndex]
      if (nextTab) {
        setActiveGroupId(nextTab.key)
      }
    },
    [groupTabs]
  )

  return (
    <article className='configuration-card configuration-class-site-card'>
      <div className='configuration-card-head'>
        <div className='configuration-card-head-copy'>
          <span className='configuration-card-kicker'>
            <CalendarIcon className='configuration-card-icon' />
          </span>
          <h4>Classes</h4>
        </div>
      </div>

      <p className='configuration-section-note'>
        Les familles sont organisées en onglets. Chaque groupe peut ensuite être replié individuellement.
      </p>

      <div className='configuration-site-copybar'>
        <label className='page-tools-field configuration-site-copybar-field'>
          <span className='page-tools-field-label'>Copier depuis</span>
          <select
            className='page-tools-field-control'
            value={copySourceSiteId}
            onChange={(event) => setCopySourceSiteId(event.target.value)}
            disabled={disabled || allSiteOptions.length === 0}
          >
            <option value=''>Choisir un site</option>
            {allSiteOptions.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label || entry.code || entry.id}
              </option>
            ))}
          </select>
        </label>

        <button
          type='button'
          className='page-tools-action-btn ghost'
          onClick={() => {
            if (!copySourceSiteId) {
              return
            }

            onCopyClassesFromSite(copySourceSiteId)
            setCopySourceSiteId("")
          }}
          disabled={disabled || !copySourceSiteId || allSiteOptions.length === 0}
        >
          Copier
        </button>
      </div>

      {groupTabs.length > 1 ? (
        <div className='page-tools-tabs configuration-site-class-tabs' role='tablist' aria-label={`Groupes de classes de ${site?.label || site?.code || "site"}`}>
          {groupTabs.map((tab, tabIndex) => {
            const isActive = tab.key === activeGroup?.key
            const tabId = `configuration-site-class-tabs-${site?.id || site?.code || "site"}-${tab.key}`

            return (
              <button
                key={tab.key}
                id={tabId}
                type='button'
                role='tab'
                className={`page-tools-tab configuration-site-class-tab${isActive ? " active" : ""}`.trim()}
                aria-selected={isActive}
                aria-controls={panelId}
                tabIndex={isActive ? 0 : -1}
                title={tab.group?.label || tab.group?.baseType || "Famille"}
                onClick={() => setActiveGroupId(tab.key)}
                onKeyDown={(event) => handleGroupTabKeyDown(event, tabIndex)}
              >
                <span className='page-tools-tab-label'>{tab.group?.label || tab.group?.baseType || "Famille"}</span>
                <span className='page-tools-tab-badge'>
                  {tab.classCount}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      <div
        id={panelId}
        className='configuration-site-class-panel'
        role='tabpanel'
        aria-labelledby={activeTabButtonId || undefined}
      >
        {activeGroup ? (
          <SiteClassGroupCard
            siteId={site?.id || site?.code || "site"}
            group={activeGroup.group}
            onAddClass={() => onAddClass(site.id, activeGroup.key)}
            onClassChange={(classId, field, value) =>
              onClassChange(site.id, activeGroup.key, classId, field, value)
            }
            onClassRemove={(classId) => onRemoveClass(site.id, activeGroup.key, classId)}
            disabled={disabled}
          />
        ) : (
          <div className='configuration-empty-state'>
            <p>Aucune classe.</p>
          </div>
        )}
      </div>
    </article>
  )
}

const CatalogSiteCard = ({
  site,
  schedule,
  onSiteChange,
  onAddressChange,
  onRoomChange,
  onAddRoom,
  onGenerateRooms,
  onRemoveRoom,
  onRemoveSite,
  onScheduleChange,
  onClassChange,
  onAddClass,
  onRemoveClass,
  onCopyClassesFromSite,
  sites = [],
  disabled = false
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const bodyId = `configuration-site-body-${site?.id || site?.code || "site"}`
  const { roomCount } = getSiteStatistics(site)
  const manualRoomTarget = Number.isFinite(Number(schedule?.manualRoomTarget)) && Number(schedule.manualRoomTarget) >= 0
    ? Number(schedule.manualRoomTarget)
    : null
  const slotCount = Number.isInteger(Number(schedule?.numSlots)) && Number(schedule.numSlots) > 0
    ? Number(schedule.numSlots)
    : DEFAULT_SITE_SCHEDULE.numSlots
  const missingRoomCount = manualRoomTarget === null ? 0 : Math.max(manualRoomTarget - roomCount, 0)
  const summaryLine = `${compactText(site?.label || site?.code || "Site")} · ${formatRoomNamesSummary(site?.roomDetails)}`

  return (
    <article className={`configuration-card configuration-catalog-card configuration-site-stack${isExpanded ? "" : " is-collapsed"}`}>
      {isExpanded ? (
        <div className='configuration-card-head configuration-site-stack-head'>
          <div className='configuration-card-head-copy'>
            <span className='configuration-card-kicker'>
              <RoomIcon className='configuration-card-icon' />
            </span>
            <h4>{site?.label || site?.code || "Site"}</h4>
            <p className='configuration-section-note'>
              {site?.code ? `Code ${site.code}` : "Code site"}
            </p>
          </div>

          <div className='configuration-card-head-actions configuration-site-stack-head-actions'>
            <button
              type='button'
              className='page-tools-action-btn ghost'
              onClick={onAddRoom}
              disabled={disabled}
            >
              Ajouter
            </button>
            <button
              type='button'
              className='page-tools-action-btn ghost'
              onClick={onRemoveSite}
              disabled={disabled}
            >
              Supprimer le site
            </button>
            <SectionToggleButton
              isOpen={isExpanded}
              onClick={() => setIsExpanded((current) => !current)}
              controlsId={bodyId}
              subject={`le site ${site?.label || site?.code || ""}`.trim()}
              className='configuration-collapse-toggle--compact'
            />
          </div>
        </div>
      ) : (
        <div className='configuration-collapsed-row configuration-collapsed-row--site'>
          <p className='configuration-collapsed-line'>{summaryLine}</p>
          <SectionToggleButton
            isOpen={isExpanded}
            onClick={() => setIsExpanded((current) => !current)}
            controlsId={bodyId}
            subject={`le site ${site?.label || site?.code || ""}`.trim()}
            iconOnly={true}
            className='configuration-collapse-toggle--icon-only'
          />
        </div>
      )}

      <div id={bodyId} className='configuration-site-stack-body' hidden={!isExpanded}>
        <div className='configuration-card-grid configuration-card-grid--site'>
          <label className='page-tools-field'>
            <span className='page-tools-field-label'>Code</span>
            <input
              className='page-tools-field-control'
              type='text'
              value={site?.code || ""}
              onChange={(event) => onSiteChange("code", event.target.value)}
              disabled={disabled}
            />
          </label>

          <label className='page-tools-field'>
            <span className='page-tools-field-label'>Nom</span>
            <input
              className='page-tools-field-control'
              type='text'
              value={site?.label || ""}
              onChange={(event) => onSiteChange("label", event.target.value)}
              disabled={disabled}
            />
          </label>

          <label className='page-tools-field'>
            <span className='page-tools-field-label'>Couleur planning</span>
            <input
              className='page-tools-field-control configuration-color-input'
              type='color'
              value={normalizePlanningColor(
                site?.planningColor || getDefaultPlanningColor(site?.code || site?.label)
              )}
              onChange={(event) => onSiteChange("planningColor", event.target.value)}
              aria-label={`Couleur planning du site ${site?.label || site?.code || "site"}`}
              disabled={disabled}
            />
          </label>

          <label className='page-tools-field'>
            <span className='page-tools-field-label'>Adresse 1</span>
            <input
              className='page-tools-field-control'
              type='text'
              value={site?.address?.line1 || ""}
              onChange={(event) => onAddressChange("line1", event.target.value)}
              disabled={disabled}
            />
          </label>

          <label className='page-tools-field'>
            <span className='page-tools-field-label'>NPA</span>
            <input
              className='page-tools-field-control'
              type='text'
              value={site?.address?.postalCode || ""}
              onChange={(event) => onAddressChange("postalCode", event.target.value)}
              disabled={disabled}
            />
          </label>

          <label className='page-tools-field'>
            <span className='page-tools-field-label'>Ville</span>
            <input
              className='page-tools-field-control'
              type='text'
              value={site?.address?.city || ""}
              onChange={(event) => onAddressChange("city", event.target.value)}
              disabled={disabled}
            />
          </label>

          <label className='page-tools-field'>
            <span className='page-tools-field-label'>Canton</span>
            <input
              className='page-tools-field-control'
              type='text'
              value={site?.address?.canton || ""}
              onChange={(event) => onAddressChange("canton", event.target.value)}
              disabled={disabled}
            />
          </label>

          <label className='page-tools-field'>
            <span className='page-tools-field-label'>Pays</span>
            <input
              className='page-tools-field-control'
              type='text'
              value={site?.address?.country || ""}
              onChange={(event) => onAddressChange("country", event.target.value)}
              disabled={disabled}
            />
          </label>
        </div>

        <label className='page-tools-field'>
          <span className='page-tools-field-label'>Notes</span>
          <input
            className='page-tools-field-control'
            type='text'
            value={site?.notes || ""}
            onChange={(event) => onSiteChange("notes", event.target.value)}
            disabled={disabled}
          />
        </label>

        <div className='configuration-room-list-head'>
          <div className='configuration-room-list-copy'>
            <strong>Rooms du site</strong>
            <p className='configuration-empty-hint'>
              {manualRoomTarget === null
                ? `Définis ici les noms. Planification créera ensuite 1 room par date avec ${slotCount} créneau${slotCount > 1 ? "x" : ""}.`
                : `${roomCount}/${manualRoomTarget} room${manualRoomTarget > 1 ? "s" : ""} définie${manualRoomTarget > 1 ? "s" : ""}. Planification créera ensuite 1 room par date avec ${slotCount} créneau${slotCount > 1 ? "x" : ""}.`}
            </p>
          </div>
          {missingRoomCount > 0 ? (
            <button
              type='button'
              className='page-tools-action-btn secondary'
              onClick={() => onGenerateRooms(missingRoomCount)}
              disabled={disabled}
            >
              Créer {missingRoomCount}
            </button>
          ) : null}
        </div>

        <div className='configuration-room-list'>
          {Array.isArray(site?.roomDetails) && site.roomDetails.length > 0 ? (
            site.roomDetails.map((room, roomIndex) => (
              <RoomRow
                key={room.id || roomIndex}
                room={room}
                siteId={site?.id || site?.code || "site"}
                onChange={(field, value) => onRoomChange(room.id || roomIndex, field, value)}
                onRemove={() => onRemoveRoom(room.id || roomIndex)}
                disabled={disabled}
              />
            ))
          ) : (
            <p className='configuration-empty-hint'>Aucune salle.</p>
          )}
        </div>

        <SiteScheduleCard
          site={site}
          schedule={schedule}
          onChange={onScheduleChange}
          disabled={disabled}
        />

        <SiteClassCatalogCard
          site={site}
          sites={sites}
          onClassChange={onClassChange}
          onAddClass={onAddClass}
          onRemoveClass={onRemoveClass}
          onCopyClassesFromSite={onCopyClassesFromSite}
          disabled={disabled}
        />
      </div>
    </article>
  )
}

const RoomSizingPanel = ({ overview, isLoading = false, error = "" }) => {
  const totals = overview?.totals || {}
  const sites = Array.isArray(overview?.sites) ? overview.sites : []
  const notes = Array.isArray(overview?.notes) ? overview.notes.filter(Boolean) : []
  const shortageRooms = Number(totals.shortageRooms || 0)
  const surplusRooms = Number(totals.surplusRooms || 0)
  const manualOverrideCount = Number(totals.manualOverrideCount || 0)
  const netRoomGap = Number(totals.roomGap || 0)
  const roomGapValue = netRoomGap === 0 ? "OK" : netRoomGap > 0 ? `+${netRoomGap}` : `${netRoomGap}`
  const roomGapHint = shortageRooms > 0 || surplusRooms > 0
    ? [
        shortageRooms > 0 ? `${shortageRooms} salle${shortageRooms > 1 ? "s" : ""} à créer` : null,
        surplusRooms > 0 ? `${surplusRooms} salle${surplusRooms > 1 ? "s" : ""} en marge` : null
      ]
        .filter(Boolean)
        .join(" · ")
    : "Équilibre global"
  const automaticTargetValue = Number(totals.recommendedRooms || 0)
  const totalTargetHint =
    manualOverrideCount > 0 && automaticTargetValue !== Number(totals.targetRooms || 0)
      ? `Auto ${automaticTargetValue}`
      : ""
  const summaryCards = [
    {
      label: "TPI",
      value: totals.tpiCount || 0
    },
    {
      label: "Actives / jour",
      value: totals.activeRoomCount || 0
    },
    {
      label: "Cible / jour",
      value: totals.targetRooms || 0,
      hint: totalTargetHint
    },
    {
      label: "Écart net",
      value: roomGapValue,
      hint: roomGapHint,
      tone: netRoomGap > 0 ? "alert" : netRoomGap < 0 ? "surplus" : "ok"
    }
  ]
  const panelNotes = [
    ...notes.map((note) => ({ label: note, tone: "muted" })),
    manualOverrideCount > 0
      ? {
          label: `${manualOverrideCount} cible${manualOverrideCount > 1 ? "s" : ""} manuelle${manualOverrideCount > 1 ? "s" : ""}`,
          tone: "manual"
        }
      : null
  ].filter(Boolean)

  return (
    <section className='configuration-panel configuration-panel--capacity'>
      <div className='configuration-panel-head'>
        <div className='configuration-panel-head-copy'>
          <span className='page-tools-chip'>
            <SettingsIcon className='configuration-panel-icon' />
            Dimensionnement
          </span>
          <h3>Salles à prévoir</h3>
          <p className='configuration-section-note'>
            Basé sur les TPI de GestionTPI, les dates de soutenance et les salles disponibles le même jour.
          </p>
        </div>
      </div>

      {error ? <p className='configuration-field-hint'>{error}</p> : null}

      {isLoading ? (
        <div className='configuration-empty-state'>
          <p>Chargement des TPI...</p>
        </div>
      ) : (
        <>
          <div className='configuration-capacity-summary'>
            {summaryCards.map((card) => (
              <article
                key={card.label}
                className={`configuration-summary-card ${card.tone ? `configuration-summary-card--${card.tone}` : ""}`.trim()}
              >
                <div className='configuration-summary-copy'>
                  <span className='configuration-summary-label'>{card.label}</span>
                  {card.hint ? <span className='configuration-summary-hint'>{card.hint}</span> : null}
                </div>
                <strong className='configuration-summary-value'>{card.value}</strong>
              </article>
            ))}
          </div>

          {panelNotes.length > 0 ? (
            <div className='configuration-capacity-note-list'>
              {panelNotes.map((note) => (
                <span
                  key={note.label}
                  className={`configuration-capacity-note configuration-capacity-note--${note.tone}`.trim()}
                >
                  {note.label}
                </span>
              ))}
            </div>
          ) : null}

          <div className='configuration-capacity-list'>
            {sites.length > 0 ? (
              sites.map((site) => {
                const progress = site.targetRooms > 0
                  ? Math.min(100, Math.round((site.activeRoomCount / site.targetRooms) * 100))
                  : 0
                const meterClass = site.roomGap > 0
                  ? "is-alert"
                  : site.roomGap < 0
                    ? "is-surplus"
                    : "is-ok"
                const siteStats = [
                  {
                    label: "TPI",
                    value: site.tpiCount,
                    tone: "neutral"
                  },
                  {
                    label: "Actives",
                    value: site.activeRoomCount,
                    tone: "neutral"
                  },
                  site.usesManualRoomTarget && site.recommendedRooms !== site.targetRooms
                    ? {
                        label: "Auto",
                        value: site.recommendedRooms,
                        tone: "muted"
                      }
                    : null,
                  {
                    label: site.usesManualRoomTarget ? "Manuel" : "Cible",
                    value: site.targetRooms,
                    tone: site.usesManualRoomTarget ? "manual" : "neutral"
                  },
                  site.roomGap > 0
                    ? {
                        label: "À créer",
                        value: site.roomGap,
                        tone: "alert"
                      }
                    : site.roomGap < 0
                      ? {
                          label: "Marge",
                          value: Math.abs(site.roomGap),
                          tone: "surplus"
                        }
                      : {
                          label: "Écart",
                          value: "OK",
                          tone: "ok"
                        },
                  site.undatedTpiCount > 0
                    ? {
                        label: "Sans date",
                        value: site.undatedTpiCount,
                        tone: "muted"
                      }
                    : null
                ].filter(Boolean)
                const siteMeta = site.tpiCount > 0
                  ? `Pression ${site.pressureLabel.toLowerCase()}`
                  : "Aucun TPI affecté"
                return (
                  <article
                    key={site.key}
                    className={`configuration-card configuration-capacity-site configuration-capacity-site--${site.pressureLevel} configuration-capacity-site--${site.siteKind}`.trim()}
                  >
                    <div className='configuration-capacity-site-head'>
                      <div className='configuration-capacity-site-copy'>
                        <span className='configuration-card-kicker'>{site.siteStatusLabel}</span>
                        <h4>{site.siteLabel}</h4>
                        <p className='configuration-card-note'>{site.scheduleLabel}</p>
                      </div>
                    </div>

                    <div className='configuration-capacity-site-stats'>
                      {siteStats.map((stat) => (
                        <span
                          key={`${site.key}-${stat.label}`}
                          className={`configuration-capacity-site-stat is-${stat.tone}`.trim()}
                        >
                          <span className='configuration-capacity-site-stat-label'>{stat.label}</span>
                          <strong className='configuration-capacity-site-stat-value'>{stat.value}</strong>
                        </span>
                      ))}
                    </div>

                    {site.targetRooms > 0 ? (
                      <div className='configuration-capacity-meter'>
                        <div className='configuration-capacity-meter-track'>
                          <div
                            className={`configuration-capacity-meter-fill ${meterClass}`.trim()}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className='configuration-capacity-meter-labels'>
                          <span>{site.activeRoomCount} actives</span>
                          <span>
                            {site.targetRooms} {site.usesManualRoomTarget ? "manuelles" : "conseillées"}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {site.classTypeSummary ? (
                      <div className='configuration-capacity-types'>
                        {site.classTypeCounts.map((entry) => (
                          <span key={`${site.key}-${entry.code}`} className='page-tools-chip'>
                            {entry.code} {entry.count}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <p className='configuration-card-note configuration-capacity-site-meta'>{siteMeta}</p>
                  </article>
                )
              })
            ) : (
              <div className='configuration-empty-state'>
                <p>Aucun site à dimensionner.</p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

const PlanningConfiguration = () => {
  const initialYear = useMemo(getInitialSelectedYear, [])
  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [yearDraft, setYearDraft] = useState(() => normalizeYearDraft({}, initialYear, []))
  const [catalogDraft, setCatalogDraft] = useState(() => normalizeCatalogDraft({}))
  const [isYearReady, setIsYearReady] = useState(false)
  const [isCatalogReady, setIsCatalogReady] = useState(false)
  const [isPlanningReady, setIsPlanningReady] = useState(false)
  const [isYearSaving, setIsYearSaving] = useState(false)
  const [isCatalogSaving, setIsCatalogSaving] = useState(false)
  const [planningTpis, setPlanningTpis] = useState([])
  const [planningTpiError, setPlanningTpiError] = useState("")
  const yearBaselineRef = useRef("")
  const catalogBaselineRef = useRef("")

  const yearOptions = useMemo(
    () => YEARS_CONFIG.getAvailableYears().slice().sort((left, right) => right - left),
    []
  )

  const currentYearPayload = useMemo(
    () => buildYearPayload(yearDraft, selectedYear, catalogDraft.sites),
    [catalogDraft.sites, selectedYear, yearDraft]
  )
  const currentCatalogPayload = useMemo(
    () => buildCatalogPayload(catalogDraft),
    [catalogDraft]
  )
  const roomSizingOverview = useMemo(
    () =>
      buildPlanningRoomSizingOverview({
        tpis: planningTpis,
        catalogSites: catalogDraft.sites,
        siteConfigs: yearDraft.siteConfigs,
        classTypes: currentYearPayload.classTypes,
        catalogOnly: true
      }),
    [catalogDraft.sites, currentYearPayload.classTypes, planningTpis, yearDraft.siteConfigs]
  )

  const isYearDirty = useMemo(
    () => JSON.stringify(currentYearPayload) !== yearBaselineRef.current,
    [currentYearPayload]
  )
  const isCatalogDirty = useMemo(
    () => JSON.stringify(currentCatalogPayload) !== catalogBaselineRef.current,
    [currentCatalogPayload]
  )
  const isAnyDirty = isYearDirty || isCatalogDirty

  const siteScheduleById = useMemo(() => {
    const map = new Map()

    for (const siteConfig of Array.isArray(yearDraft?.siteConfigs) ? yearDraft.siteConfigs : []) {
      const siteId = compactText(siteConfig?.siteId).toLowerCase()
      if (siteId) {
        map.set(siteId, siteConfig)
      }
    }

    return map
  }, [yearDraft?.siteConfigs])

  useEffect(() => {
    let isCancelled = false

    const bootstrap = async () => {
      setIsCatalogReady(false)
      setIsYearReady(false)
      setIsPlanningReady(false)
      setPlanningTpis([])
      setPlanningTpiError("")

      let loadedCatalog = normalizeCatalogDraft({})
      try {
        const catalog = await planningCatalogService.getGlobal()
        loadedCatalog = normalizeCatalogDraft(catalog)
      } catch (error) {
        console.error("Erreur lors du chargement du catalogue partagé :", error)
        toast.error("Impossible de charger le catalogue partagé.")
      }

      if (isCancelled) {
        return
      }

      setCatalogDraft(loadedCatalog)
      catalogBaselineRef.current = JSON.stringify(buildCatalogPayload(loadedCatalog))

      try {
        const [config, tpis] = await Promise.all([
          planningConfigService.getByYear(selectedYear),
          tpiPlanningService.getByYear(selectedYear).catch((error) => {
            console.error(`Erreur lors du chargement des TPI ${selectedYear} :`, error)
            return null
          })
        ])

        if (isCancelled) {
          return
        }

        const normalized = normalizeYearDraft(config, selectedYear, loadedCatalog.sites)
        setYearDraft(normalized)
        yearBaselineRef.current = JSON.stringify(
          buildYearPayload(normalized, selectedYear, loadedCatalog.sites)
        )
        setPlanningTpis(Array.isArray(tpis) ? tpis : [])
        setPlanningTpiError(Array.isArray(tpis) ? "" : `Impossible de charger les TPI ${selectedYear}.`)
      } catch (error) {
        console.error(`Erreur lors du chargement de la configuration ${selectedYear} :`, error)
        const fallback = normalizeYearDraft({}, selectedYear, loadedCatalog.sites)
        setYearDraft(fallback)
        yearBaselineRef.current = JSON.stringify(
          buildYearPayload(fallback, selectedYear, loadedCatalog.sites)
        )
        setPlanningTpis([])
        setPlanningTpiError(`Impossible de charger les TPI ${selectedYear}.`)
        toast.error(`Impossible de charger la configuration ${selectedYear}.`)
      }

      if (isCancelled) {
        return
      }

      setIsCatalogReady(true)
      setIsYearReady(true)
      setIsPlanningReady(true)
    }

    void bootstrap()

    return () => {
      isCancelled = true
    }
  }, [selectedYear])

  useEffect(() => {
    setYearDraft((current) => {
      const syncedSiteConfigs = syncSiteConfigsToCatalog(current.siteConfigs, catalogDraft.sites)
      if (JSON.stringify(syncedSiteConfigs) === JSON.stringify(current.siteConfigs || [])) {
        return current
      }

      return {
        ...current,
        siteConfigs: syncedSiteConfigs
      }
    })
  }, [catalogDraft.sites])

  useEffect(() => {
    writeStorageValue(STORAGE_KEYS.PLANNING_SELECTED_YEAR, String(selectedYear))
  }, [selectedYear])

  const persistCatalogDraft = useCallback(async (draft) => {
    const payload = buildCatalogPayload(draft)
    const saved = await planningCatalogService.saveGlobal(payload)
    const normalized = normalizeCatalogDraft(saved || payload)
    setCatalogDraft(normalized)
    catalogBaselineRef.current = JSON.stringify(buildCatalogPayload(normalized))
    return normalized
  }, [])

  const persistYearDraft = useCallback(
    async (draft, catalogSites) => {
      const payload = buildYearPayload(draft, selectedYear, catalogSites)
      const saved = await planningConfigService.saveByYear(selectedYear, payload)
      const normalized = normalizeYearDraft(saved || payload, selectedYear, catalogSites)
      setYearDraft(normalized)
      yearBaselineRef.current = JSON.stringify(
        buildYearPayload(normalized, selectedYear, catalogSites)
      )
      return normalized
    },
    [selectedYear]
  )

  const handleSaveAll = useCallback(async () => {
    if (!isYearReady || !isCatalogReady || isYearSaving || isCatalogSaving || !isAnyDirty) {
      return false
    }

    let hasSavedCatalog = false
    setIsCatalogSaving(isCatalogDirty)
    setIsYearSaving(isYearDirty)

    try {
      const nextCatalog = isCatalogDirty
        ? await persistCatalogDraft(catalogDraft)
        : catalogDraft
      hasSavedCatalog = isCatalogDirty

      if (isYearDirty) {
        await persistYearDraft(
          {
            ...yearDraft,
            siteConfigs: syncSiteConfigsToCatalog(yearDraft.siteConfigs, nextCatalog.sites)
          },
          nextCatalog.sites
        )
      }

      toast.success(
        isCatalogDirty && isYearDirty
          ? "Catalogue et configuration enregistrés."
          : isCatalogDirty
            ? "Catalogue enregistré."
          : `Configuration ${selectedYear} enregistrée.`
      )
      return true
    } catch (error) {
      console.error(`Erreur lors de l'enregistrement de la configuration ${selectedYear} :`, error)
      toast.error(
        hasSavedCatalog
          ? "Catalogue enregistré, mais impossible d'enregistrer la configuration."
          : "Impossible d'enregistrer les modifications."
      )
      return false
    } finally {
      setIsCatalogSaving(false)
      setIsYearSaving(false)
    }
  }, [
    catalogDraft,
    isAnyDirty,
    isCatalogDirty,
    isCatalogReady,
    isCatalogSaving,
    isYearReady,
    isYearSaving,
    persistCatalogDraft,
    persistYearDraft,
    selectedYear,
    yearDraft
  ])

  const handleYearChange = useCallback(
    async (event) => {
      const nextYear = Number.parseInt(event.target.value, 10)

      if (!Number.isInteger(nextYear) || nextYear === selectedYear) {
        return
      }

      if (isAnyDirty) {
        const shouldSave = window.confirm(
          `Enregistrer les modifications avant de charger ${nextYear} ?`
        )

        if (shouldSave) {
          const saved = await handleSaveAll()
          if (!saved) {
            return
          }
        }
      }

      setSelectedYear(nextYear)
    },
    [handleSaveAll, isAnyDirty, selectedYear]
  )

  const addClassType = useCallback(() => {
    setYearDraft((current) => ({
      ...current,
      classTypes: [
        ...(current.classTypes || []),
        createBlankClassType(getNextAnnualClassTypeIndex(current.classTypes || []))
      ]
    }))
  }, [])

  const removeClassType = useCallback((classTypeId) => {
    setYearDraft((current) => ({
      ...current,
      classTypes: (current.classTypes || []).filter(
        (classType) => classType?.locked === true || classType.id !== classTypeId
      )
    }))
  }, [])

  const updateClassTypeField = useCallback((classTypeId, field, value) => {
    setYearDraft((current) => ({
      ...current,
      classTypes: (current.classTypes || []).map((classType) =>
        classType.id === classTypeId ? { ...classType, [field]: value } : classType
      )
    }))
  }, [])

  const addSite = useCallback(() => {
    const nextSite = createBlankSite((catalogDraft.sites || []).length + 1)
    setCatalogDraft((current) => ({
      ...current,
      sites: [...(current.sites || []), nextSite]
    }))
    setYearDraft((current) => ({
      ...current,
      siteConfigs: [...(current.siteConfigs || []), createBlankSiteConfig(nextSite)]
    }))
  }, [catalogDraft.sites])

  const removeSite = useCallback((siteId) => {
    setCatalogDraft((current) => ({
      ...current,
      sites: (current.sites || []).filter((site) => site.id !== siteId)
    }))
    setYearDraft((current) => ({
      ...current,
      siteConfigs: (current.siteConfigs || []).filter(
        (siteConfig) => compactText(siteConfig.siteId).toLowerCase() !== compactText(siteId).toLowerCase()
      )
    }))
  }, [])

  const updateSiteField = useCallback((siteId, field, value) => {
    setCatalogDraft((current) => ({
      ...current,
      sites: (current.sites || []).map((site) =>
        site.id === siteId ? { ...site, [field]: value } : site
      )
    }))
  }, [])

  const updateSiteAddressField = useCallback((siteId, field, value) => {
    setCatalogDraft((current) => ({
      ...current,
      sites: (current.sites || []).map((site) =>
        site.id === siteId
          ? {
              ...site,
              address: {
                ...(site.address || DEFAULT_ADDRESS),
                [field]: value
              }
            }
          : site
      )
    }))
  }, [])

  const addRoom = useCallback((siteId) => {
    setCatalogDraft((current) => ({
      ...current,
      sites: (current.sites || []).map((site) => {
        if (site.id !== siteId) {
          return site
        }

        const nextRoom = createBlankRoom((site.roomDetails || []).length + 1, siteId)
        const nextRoomDetails = [...(site.roomDetails || []), nextRoom]

        return {
          ...site,
          roomDetails: nextRoomDetails,
          rooms: nextRoomDetails.map((room) => room.label || room.code).filter(Boolean)
        }
      })
    }))
  }, [])

  const generateRoomsFromTarget = useCallback((siteId, count) => {
    setCatalogDraft((current) => ({
      ...current,
      sites: (current.sites || []).map((site) => {
        if (site.id !== siteId) {
          return site
        }

        const nextRoomDetails = appendGeneratedRoomsToSite(site, count)
        return {
          ...site,
          roomDetails: nextRoomDetails,
          rooms: nextRoomDetails.map((room) => room.label || room.code).filter(Boolean)
        }
      })
    }))
  }, [])

  const removeRoom = useCallback((siteId, roomId) => {
    setCatalogDraft((current) => ({
      ...current,
      sites: (current.sites || []).map((site) => {
        if (site.id !== siteId) {
          return site
        }

        const nextRoomDetails = (site.roomDetails || []).filter((room) => room.id !== roomId)

        return {
          ...site,
          roomDetails: nextRoomDetails,
          rooms: nextRoomDetails.map((room) => room.label || room.code).filter(Boolean)
        }
      })
    }))
  }, [])

  const updateRoomField = useCallback((siteId, roomId, field, value) => {
    setCatalogDraft((current) => ({
      ...current,
      sites: (current.sites || []).map((site) => {
        if (site.id !== siteId) {
          return site
        }

        const nextRoomDetails = (site.roomDetails || []).map((room) =>
          room.id === roomId ? { ...room, [field]: value } : room
        )

        return {
          ...site,
          roomDetails: nextRoomDetails,
          rooms: nextRoomDetails.map((room) => room.label || room.code).filter(Boolean)
        }
      })
    }))
  }, [])

  const updateSiteClassEntryField = useCallback((siteId, groupKey, classId, field, value) => {
    setCatalogDraft((current) => ({
      ...current,
      sites: (current.sites || []).map((site) => {
        if (site.id !== siteId) {
          return site
        }

        const nextClassGroups = (Array.isArray(site.classGroups) ? site.classGroups : []).map((group) => {
          if (group.id !== groupKey && group.baseType !== groupKey) {
            return group
          }

          return {
            ...group,
            classes: (Array.isArray(group.classes) ? group.classes : []).map((entry) =>
              (entry.id || entry.code) === classId ? { ...entry, [field]: value } : entry
            )
          }
        })

        return {
          ...site,
          classGroups: nextClassGroups
        }
      })
    }))
  }, [])

  const addSiteClassEntry = useCallback((siteId, groupKey) => {
    setCatalogDraft((current) => ({
      ...current,
      sites: (current.sites || []).map((site) => {
        if (site.id !== siteId) {
          return site
        }

        const nextClassGroups = (Array.isArray(site.classGroups) ? site.classGroups : []).map((group) => {
          if (group.id !== groupKey && group.baseType !== groupKey) {
            return group
          }

          const nextEntry = createBlankSiteClassEntry(group.baseType, getNextSiteClassIndex(group))

          return {
            ...group,
            classes: [...(group.classes || []), nextEntry]
          }
        })

        return {
          ...site,
          classGroups: nextClassGroups
        }
      })
    }))
  }, [])

  const removeSiteClassEntry = useCallback((siteId, groupKey, classId) => {
    setCatalogDraft((current) => ({
      ...current,
      sites: (current.sites || []).map((site) => {
        if (site.id !== siteId) {
          return site
        }

        const nextClassGroups = (Array.isArray(site.classGroups) ? site.classGroups : []).map((group) => {
          if (group.id !== groupKey && group.baseType !== groupKey) {
            return group
          }

          return {
            ...group,
            classes: (Array.isArray(group.classes) ? group.classes : []).filter(
              (entry) => (entry.id || entry.code) !== classId
            )
          }
        })

        return {
          ...site,
          classGroups: nextClassGroups
        }
      })
    }))
  }, [])

  const copySiteClassGroups = useCallback((targetSiteId, sourceSiteId) => {
    const sourceSite = (catalogDraft.sites || []).find((site) => site.id === sourceSiteId)
    const targetSite = (catalogDraft.sites || []).find((site) => site.id === targetSiteId)

    if (!sourceSite) {
      toast.error("Site source introuvable.")
      return
    }

    if (!targetSite) {
      toast.error("Site cible introuvable.")
      return
    }

    setCatalogDraft((current) => {
      return {
        ...current,
        sites: (current.sites || []).map((site) => {
          if (site.id !== targetSiteId) {
            return site
          }

          return {
            ...site,
            classGroups: cloneSiteClassGroupsForSite(sourceSite.classGroups || [], site.id)
          }
        })
      }
    })

    toast.success(`Classes copiées de ${sourceSite.label || sourceSite.code || sourceSiteId} vers ${targetSite.label || targetSite.code || targetSiteId}.`)
  }, [catalogDraft.sites])

  const siteCards = Array.isArray(catalogDraft?.sites) ? catalogDraft.sites : []

  const actions = (
    <div className='configuration-page-actions'>
      <label className='page-tools-field configuration-year-field'>
        <span className='page-tools-field-label'>Année</span>
        <select
          className='page-tools-field-control'
          value={selectedYear}
          onChange={handleYearChange}
          disabled={!isYearReady || isYearSaving}
        >
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>

      <button
        type='button'
        className='page-tools-action-btn primary'
        onClick={() => {
          void handleSaveAll()
        }}
        disabled={!isYearReady || !isCatalogReady || isYearSaving || isCatalogSaving || !isAnyDirty}
      >
        {isYearSaving || isCatalogSaving ? "Enregistrement..." : "Enregistrer"}
      </button>
    </div>
  )

  return (
    <div className='configuration-page'>
      <section id='configuration-hero' className='page-tools configuration-hero'>
        <div className='configuration-hero-shell'>
          <div className='configuration-hero-copy'>
            <span className='configuration-eyebrow'>
              <SettingsIcon className='configuration-eyebrow-icon' />
              Paramètres partagés
            </span>
            <h2>Configuration</h2>
            <p>
              Réglez l'année et le catalogue des sites, salles et familles de classes.
            </p>
          </div>

          <div className='configuration-hero-side'>
            {actions}
          </div>
        </div>
      </section>

      <RoomSizingPanel
        year={selectedYear}
        overview={roomSizingOverview}
        isLoading={!isPlanningReady}
        error={planningTpiError}
      />

      <div className='configuration-grid'>
        <section className='configuration-panel configuration-panel--year'>
          <div className='configuration-panel-head'>
            <div className='configuration-panel-head-copy'>
              <span className='page-tools-chip'>
                <CalendarIcon className='configuration-panel-icon' />
                {selectedYear}
              </span>
              <h3>Année</h3>
              <p className='configuration-section-note'>
                Types de classe, dates de soutenance et configuration annuelle.
              </p>
            </div>
            <div className='configuration-card-head-actions'>
              <button
                type='button'
                className='page-tools-action-btn ghost'
                onClick={addClassType}
                disabled={!isYearReady}
              >
                Ajouter
              </button>
            </div>
          </div>

          <div className='configuration-panel-body'>
            <div className='configuration-class-list'>
              {Array.isArray(yearDraft?.classTypes) && yearDraft.classTypes.length > 0 ? (
                yearDraft.classTypes.map((classType) => (
                  <ClassTypeCard
                    key={classType.id}
                    classType={classType}
                    onChange={(field, value) => updateClassTypeField(classType.id, field, value)}
                    onRemove={() => removeClassType(classType.id)}
                    disabled={!isYearReady}
                  />
                ))
              ) : (
                <div className='configuration-empty-state'>
                  <p>Aucun type.</p>
                  <button
                    type='button'
                    className='page-tools-action-btn primary'
                    onClick={addClassType}
                    disabled={!isYearReady}
                  >
                    Ajouter
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className='configuration-panel configuration-panel--catalog'>
          <div className='configuration-panel-head'>
            <div className='configuration-panel-head-copy'>
              <span className='page-tools-chip'>
                <RoomIcon className='configuration-panel-icon' />
                Catalogue
              </span>
              <h3>Sites</h3>
              <p className='configuration-section-note'>
                Chaque site regroupe ses salles, son horaire et ses familles de classes.
              </p>
            </div>
            <div className='configuration-card-head-actions'>
              <button
                type='button'
                className='page-tools-action-btn ghost'
                onClick={addSite}
                disabled={!isCatalogReady}
              >
                Ajouter
              </button>
            </div>
          </div>

          <div className='configuration-panel-body'>
            <div className='configuration-site-groups'>
              {siteCards.length > 0 ? (
                siteCards.map((site) => (
                  <CatalogSiteCard
                    key={site.id}
                    site={site}
                    schedule={siteScheduleById.get(compactText(site.id).toLowerCase())}
                    sites={siteCards}
                    onSiteChange={(field, value) => updateSiteField(site.id, field, value)}
                    onAddressChange={(field, value) => updateSiteAddressField(site.id, field, value)}
                    onRoomChange={(roomId, field, value) => updateRoomField(site.id, roomId, field, value)}
                    onAddRoom={() => addRoom(site.id)}
                    onGenerateRooms={(count) => generateRoomsFromTarget(site.id, count)}
                    onRemoveRoom={(roomId) => removeRoom(site.id, roomId)}
                    onRemoveSite={() => removeSite(site.id)}
                    onScheduleChange={(field, value) => {
                      setYearDraft((current) => ({
                        ...current,
                        siteConfigs: syncSiteConfigsToCatalog(
                          (current.siteConfigs || []).map((siteConfig) =>
                            compactText(siteConfig.siteId).toLowerCase() === compactText(site.id).toLowerCase()
                              ? { ...siteConfig, [field]: value }
                              : siteConfig
                          ),
                          catalogDraft.sites
                        )
                      }))
                    }}
                    onClassChange={updateSiteClassEntryField}
                    onAddClass={addSiteClassEntry}
                    onRemoveClass={removeSiteClassEntry}
                    onCopyClassesFromSite={(sourceSiteId) => copySiteClassGroups(site.id, sourceSiteId)}
                    disabled={!isCatalogReady}
                  />
                ))
              ) : (
                <div className='configuration-empty-state'>
                  <p>Aucun site.</p>
                  <button
                    type='button'
                    className='page-tools-action-btn primary'
                    onClick={addSite}
                    disabled={!isCatalogReady}
                  >
                    Ajouter
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default PlanningConfiguration
