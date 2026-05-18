import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { DndProvider } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "react-toastify"

import TpiScheduleButtons from "./TpiScheduleButtons"
import { showNotification } from "../Tools"
import { personService, workflowCoordinationService } from "../../services/coordinationService"
import { getTpiModels } from "../tpiControllers/TpiController"

import {
  createTpiCollectionForYear,
  publishSoutenancesFromPlanification,
  replacePlanningRoomsInDatabase
} from "../tpiControllers/TpiRoomsController"

import DateRoom from "./DateRoom"
import TpiAssignmentPanel from "./TpiAssignmentPanel"
import IconButtonContent from "../shared/IconButtonContent"
import {
  AlertIcon,
  ArrowRightIcon,
  CloseIcon,
  ConfigurationIcon,
  RefreshIcon,
  TimeIcon,
  TrashIcon
} from "../shared/InlineIcons"
import {
  buildPlanningJsonExportFileName,
  combinedScheduleConfig,
  buildPlanningConfigForYear,
  createEmptyOffer,
  createEmptyTpi,
  isTpiPlanningSealed,
  normalizeOrganizerRooms,
  normalizeRoom,
  normalizeTpi
} from "./tpiScheduleData"
import {
  normalizeSoutenanceDateEntries,
  normalizeSoutenanceDateValue,
} from "./soutenanceDateUtils"
import {
  inferRoomClassMode
} from "./tpiScheduleFilters"
import { ROUTES } from "../../config/appConfig"
import {
  analyzePlanningRooms,
  buildTargetedPlanningOptimizationProposal,
  summarizeLocalPersonConflicts
} from "./tpiScheduleOptimization"
import {
  buildValidationResultFromSources
} from "./tpiScheduleValidationUtils"
import {
  buildValidationMarkers
} from "./tpiScheduleValidationMarkers"
import {
  getNonImportableTpiRefs
} from "./tpiScheduleImportability"
import {
  buildGestionTpiSyncModelMap,
  buildRoomsWithGestionTpiSync,
  buildPlanningTpiFromGestionModel,
  buildPlanningTpiSyncSummary,
  normalizeTpiSyncRefKey
} from "./tpiScheduleSync"
import { API_URL, IS_DEBUG, STORAGE_KEYS, YEARS_CONFIG } from "../../config/appConfig"
import { coordinationCatalogService, coordinationConfigService } from "../../services/coordinationService"
import { STATIC_VOTE_REGENERATION_CONFIRM_MESSAGE } from "../../constants/staticVotePublication"
import {
  readJSONListValue,
  readStorageValue,
  removeStorageValue,
  writeJSONValue,
  writeStorageValue
} from "../../utils/storage"
import {
  getCoordinationYearFromSearch,
  getPreferredCoordinationYear,
  persistCoordinationYear
} from "../../utils/coordinationYear"
import {
  buildOptimizationToast,
  buildValidationToast,
  extractValidationResultFromError
} from "../../utils/workflowFeedback"
import { getPlanningPerimeterState } from "../../utils/coordinationScopeUtils"

const apiUrl = API_URL
const shouldLogWorkflowDebug = IS_DEBUG && process.env.NODE_ENV !== "test"

const DEFAULT_VALIDATION_OPTIMIZATION_SETTINGS = {
  profile: "corrections",
  mode: "strict",
  maxSwaps: 3,
  sameSiteOnly: true,
  preserveValidated: true,
  reduceWaitingTime: false,
  issueTypes: ["person_overlap", "consecutive_limit", "room_class_mismatch"]
}

function buildApiAbsoluteUrl(path) {
  if (!path) {
    return ""
  }

  try {
    return new URL(path, API_URL).toString()
  } catch (error) {
    return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`
  }
}

function getFullscreenElement(doc = document) {
  return doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement ||
    null
}

function requestElementFullscreen(element) {
  if (!element) {
    return null
  }

  const requestFullscreen =
    element.requestFullscreen ||
    element.webkitRequestFullscreen ||
    element.mozRequestFullScreen ||
    element.msRequestFullscreen

  if (typeof requestFullscreen !== "function") {
    return null
  }

  return requestFullscreen.call(element)
}

function exitDocumentFullscreen(doc = document) {
  const exitFullscreen =
    doc.exitFullscreen ||
    doc.webkitExitFullscreen ||
    doc.mozCancelFullScreen ||
    doc.msExitFullscreen

  if (typeof exitFullscreen !== "function") {
    return null
  }

  return exitFullscreen.call(doc)
}

function formatPublicationConfirmTarget(url) {
  const rawUrl = typeof url === "string" ? url.trim() : ""
  if (!rawUrl) {
    return "le site publication"
  }

  try {
    return new URL(rawUrl).host || rawUrl
  } catch (error) {
    return rawUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "") || "le site publication"
  }
}

function updateTpiDatas(room, sourceConfig = combinedScheduleConfig) {
  const normalizedRoom = normalizeRoom(room, 0, sourceConfig)

  normalizedRoom.tpiDatas = normalizedRoom.tpiDatas.map((tpiData) => {
    const safeTpi = normalizeTpi(tpiData)

    return {
      ...safeTpi,
      expert1: {
        ...safeTpi.expert1,
        offres: updateSchema()
      },
      expert2: {
        ...safeTpi.expert2,
        offres: updateSchema()
      },
      boss: {
        ...safeTpi.boss,
        offres: updateSchema()
      }
    }
  })

  return normalizedRoom
}

function updateSchema() {
  return createEmptyOffer()
}

function getYearFromDateValue(value) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  const year = date.getFullYear()

  return Number.isInteger(year) ? year : null
}

function inferPlanningYearFromRooms(rooms) {
  if (!Array.isArray(rooms) || rooms.length === 0) {
    return null
  }

  const yearCounts = new Map()

  for (const room of rooms) {
    const candidateYear = Number.isInteger(Number(room?.year))
      ? Number(room.year)
      : getYearFromDateValue(room?.date)

    if (Number.isInteger(candidateYear)) {
      yearCounts.set(candidateYear, (yearCounts.get(candidateYear) || 0) + 1)
    }
  }

  if (yearCounts.size === 0) {
    return null
  }

  return Array.from(yearCounts.entries())
    .sort((left, right) => right[1] - left[1] || right[0] - left[0])[0]?.[0] ?? null
}

function buildPlanningRoomKey(site, date, roomName) {
  return [
    String(site || "").trim().toUpperCase(),
    String(date || "").trim(),
    String(roomName || "").trim().toLowerCase()
  ].join("|")
}

function getInitialSelectedYear(search = "") {
  const savedRooms = readJSONListValue(STORAGE_KEYS.ORGANIZER_DATA, [], [
    "organizerData"
  ])
  const inferredYear = inferPlanningYearFromRooms(savedRooms)

  if (Number.isInteger(inferredYear)) {
    return inferredYear
  }

  return getPreferredCoordinationYear(search)
}

function getInitialTpiCardDetailLevel() {
  const storedLevel = Number.parseInt(
    readStorageValue(STORAGE_KEYS.TPI_CARD_DETAIL_LEVEL, "2"),
    10
  )

  if ([0, 1, 2, 3].includes(storedLevel)) {
    return storedLevel
  }

  return 2
}

function compactText(value) {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

function normalizeRoomDateFilterValue(value) {
  const rawValue = compactText(value)
  return normalizeSoutenanceDateValue(rawValue) || rawValue
}

function normalizeRoomDateFilterValues(values) {
  const source = Array.isArray(values) ? values : [values]

  return Array.from(
    new Set(source.map((value) => normalizeRoomDateFilterValue(value)).filter(Boolean))
  )
}

function getRoomStartSortValue(room) {
  const timeText = compactText(room?.configSite?.firstTpiStartTime)
  const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})$/)

  if (timeMatch) {
    const hours = Number.parseInt(timeMatch[1], 10)
    const minutes = Number.parseInt(timeMatch[2], 10)

    if (
      Number.isInteger(hours) &&
      Number.isInteger(minutes) &&
      hours >= 0 &&
      minutes >= 0 &&
      minutes < 60
    ) {
      return hours * 60 + minutes
    }
  }

  const legacyHours = Number(room?.configSite?.firstTpiStart)
  return Number.isFinite(legacyHours) ? Math.round(legacyHours * 60) : 0
}

function getRoomChronologicalSortValue(room, originalIndex = 0) {
  const rawDate = compactText(room?.date)
  const dateKey = normalizeSoutenanceDateValue(rawDate) || rawDate
  const dateTime = new Date(dateKey).getTime()

  return {
    dateSort: Number.isNaN(dateTime) ? Number.MAX_SAFE_INTEGER : dateTime,
    dateLabel: dateKey,
    startSort: getRoomStartSortValue(room),
    site: compactText(room?.site).toUpperCase(),
    name: compactText(room?.name || room?.nameRoom).toLowerCase(),
    originalIndex
  }
}

function compareRoomChronologicalSortValues(left, right) {
  return left.dateSort - right.dateSort ||
    left.dateLabel.localeCompare(right.dateLabel) ||
    left.startSort - right.startSort ||
    left.site.localeCompare(right.site) ||
    left.name.localeCompare(right.name) ||
    left.originalIndex - right.originalIndex
}

function getRoomDateFilterValues(filters = {}) {
  return normalizeRoomDateFilterValues([
    ...(Array.isArray(filters?.date) ? filters.date : [filters?.date]),
    ...(Array.isArray(filters?.dates) ? filters.dates : [filters?.dates])
  ])
}

function normalizeTpiReference(value) {
  return compactText(value).toLowerCase()
}

function tpiHasVisibleContent(tpi) {
  return Boolean(
    compactText(tpi?.refTpi) ||
    compactText(tpi?.candidat) ||
    compactText(tpi?.expert1?.name) ||
    compactText(tpi?.expert2?.name) ||
    compactText(tpi?.boss?.name) ||
    compactText(tpi?.sujet) ||
    compactText(tpi?.description)
  )
}

function getTpiClassMode(tpi) {
  const classe = compactText(tpi?.classe).toUpperCase()

  if (!classe) {
    return null
  }

  return classe.startsWith("M") ? "matu" : "nonM"
}

function normalizeStakeholderLookupValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function buildPersonNameKey(firstName, lastName) {
  const normalizedFirstName = normalizeStakeholderLookupValue(firstName)
  const normalizedLastName = normalizeStakeholderLookupValue(lastName)

  if (!normalizedFirstName && !normalizedLastName) {
    return ''
  }

  return `${normalizedFirstName}|${normalizedLastName}`
}

function buildNameVariantKeys(value) {
  const parts = normalizeStakeholderLookupValue(value)
    .split(' ')
    .filter(Boolean)

  if (parts.length < 2) {
    return []
  }

  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')

  return [
    buildPersonNameKey(firstName, lastName),
    buildPersonNameKey(lastName, firstName)
  ].filter(Boolean)
}

function getStakeholderHintKey(role, name) {
  const normalizedName = normalizeStakeholderLookupValue(name)

  if (!role || !normalizedName) {
    return ''
  }

  return `${role}|${normalizedName}`
}

function personHasRole(person, role) {
  if (!role) {
    return true
  }

  const roles = Array.isArray(person?.roles) ? person.roles : []
  return roles.some((value) => String(value || '').trim() === role)
}

function personMatchesPlanningYear(person, role, year) {
  if (role !== 'candidat' || !Number.isInteger(year)) {
    return true
  }

  const candidateYears = Array.isArray(person?.candidateYears)
    ? person.candidateYears
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value))
    : []

  if (candidateYears.length === 0) {
    return true
  }

  return candidateYears.includes(year)
}

function formatRegistryPersonLabel(person) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim()
}

function getPersonShortIdPrefix(person) {
  const roles = Array.isArray(person?.roles)
    ? person.roles.map((role) => String(role || '').trim().toLowerCase()).filter(Boolean)
    : []
  const roleSet = new Set(roles)

  if (roleSet.size > 1) {
    return 'M'
  }

  if (roleSet.has('expert')) {
    return 'E'
  }

  if (roleSet.has('chef_projet')) {
    return 'P'
  }

  if (roleSet.has('candidat')) {
    return 'C'
  }

  if (roleSet.has('admin')) {
    return 'A'
  }

  return 'S'
}

function formatRegistryPersonShortId(person) {
  const parsedShortId = Number.parseInt(person?.shortId, 10)

  if (!Number.isInteger(parsedShortId) || parsedShortId <= 0) {
    return ''
  }

  return `${getPersonShortIdPrefix(person)}-${String(parsedShortId).padStart(3, '0')}`
}

function findRegistryPersonByObjectId(people, personId) {
  const normalizedPersonId = compactText(personId)

  if (!normalizedPersonId) {
    return null
  }

  return (Array.isArray(people) ? people : []).find(
    (person) => compactText(person?._id) === normalizedPersonId
  ) || null
}

function resolveUniqueRegistryPerson(people, value, role, year) {
  const normalizedValue = normalizeStakeholderLookupValue(value)
  const nameVariantKeys = buildNameVariantKeys(value)

  if (!normalizedValue) {
    return null
  }

  const matches = (Array.isArray(people) ? people : []).filter((person) => {
    if (!person || person.isActive === false) {
      return false
    }

    if (!personHasRole(person, role) || !personMatchesPlanningYear(person, role, year)) {
      return false
    }

    const displayName = normalizeStakeholderLookupValue(formatRegistryPersonLabel(person))
    const personNameKey = buildPersonNameKey(person?.firstName, person?.lastName)
    const email = normalizeStakeholderLookupValue(person?.email)

    return (
      displayName === normalizedValue ||
      email === normalizedValue ||
      nameVariantKeys.includes(personNameKey)
    )
  })

  return matches.length === 1 ? matches[0] : null
}

function buildStakeholderShortIdHints({ rooms = [], tpiModels = [], people = [], year = null }) {
  if (!Array.isArray(people) || people.length === 0) {
    return {}
  }

  const hintSets = new Map()

  const addHint = ({ role, name, personId, planningYear = year }) => {
    const hintKey = getStakeholderHintKey(role, name)

    if (!hintKey) {
      return
    }

    const person =
      findRegistryPersonByObjectId(people, personId) ||
      resolveUniqueRegistryPerson(people, name, role, planningYear)
    const shortId = formatRegistryPersonShortId(person)

    if (!shortId) {
      return
    }

    if (!hintSets.has(hintKey)) {
      hintSets.set(hintKey, new Set())
    }

    hintSets.get(hintKey).add(shortId)
  }

  for (const room of Array.isArray(rooms) ? rooms : []) {
    const planningYear = Number.isInteger(Number(room?.year))
      ? Number(room.year)
      : getYearFromDateValue(room?.date) || year

    for (const tpi of Array.isArray(room?.tpiDatas) ? room.tpiDatas : []) {
      addHint({
        role: 'candidat',
        name: tpi?.candidat,
        personId: tpi?.candidatPersonId,
        planningYear
      })
      addHint({
        role: 'expert',
        name: tpi?.expert1?.name,
        personId: tpi?.expert1?.personId,
        planningYear
      })
      addHint({
        role: 'expert',
        name: tpi?.expert2?.name,
        personId: tpi?.expert2?.personId,
        planningYear
      })
      addHint({
        role: 'chef_projet',
        name: tpi?.boss?.name,
        personId: tpi?.boss?.personId,
        planningYear
      })
    }
  }

  for (const tpiModel of Array.isArray(tpiModels) ? tpiModels : []) {
    addHint({
      role: 'candidat',
      name: tpiModel?.candidat,
      personId: tpiModel?.candidatPersonId,
      planningYear: year
    })
    addHint({
      role: 'expert',
      name: tpiModel?.experts?.[1],
      personId: tpiModel?.expert1PersonId,
      planningYear: year
    })
    addHint({
      role: 'expert',
      name: tpiModel?.experts?.[2],
      personId: tpiModel?.expert2PersonId,
      planningYear: year
    })
    addHint({
      role: 'chef_projet',
      name: tpiModel?.boss,
      personId: tpiModel?.bossPersonId,
      planningYear: year
    })
  }

  return Array.from(hintSets.entries()).reduce((acc, [hintKey, values]) => {
    if (values.size === 1) {
      acc[hintKey] = Array.from(values)[0]
    }

    return acc
  }, {})
}

function formatRoomDateLabel(dateValue) {
  const text = compactText(dateValue)
  if (!text) {
    return ""
  }

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) {
    return text
  }

  return date.toLocaleDateString("fr-CH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  })
}

function normalizeRoomNameList(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .map((value) => compactText(value))
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right))
}

function normalizeRoomCatalog(value, fallbackCatalog = {}) {
  const source = value && typeof value === "object" ? value : {}
  const fallback = fallbackCatalog && typeof fallbackCatalog === "object" ? fallbackCatalog : {}
  const siteKeys = Array.from(
    new Set([
      ...Object.keys(fallback).map((site) => String(site || "").trim().toUpperCase()).filter(Boolean),
      ...Object.keys(source).map((site) => String(site || "").trim().toUpperCase()).filter(Boolean)
    ])
  ).sort((left, right) => left.localeCompare(right))

  return siteKeys.reduce((acc, site) => {
    const hasSourceSite = Object.prototype.hasOwnProperty.call(source, site)
    const sourceRooms = Array.isArray(source[site]) ? source[site] : []
    const fallbackRooms = Array.isArray(fallback[site]) ? fallback[site] : []
    acc[site] = normalizeRoomNameList(hasSourceSite ? sourceRooms : fallbackRooms)
    return acc
  }, {})
}

function catalogToRoomCatalog(catalog, fallbackCatalog = {}) {
  if (catalog && typeof catalog === "object" && Array.isArray(catalog.sites)) {
    const source = catalog.sites.reduce((acc, site) => {
      const siteCode = String(site?.code || site?.label || "").trim().toUpperCase()
      if (!siteCode) {
        return acc
      }

      acc[siteCode] = Array.isArray(site?.rooms) ? site.rooms : []
      return acc
    }, {})

    return normalizeRoomCatalog(source, fallbackCatalog)
  }

  return normalizeRoomCatalog(catalog, fallbackCatalog)
}

function catalogToSiteConfigOverrides(catalog) {
  if (!catalog || typeof catalog !== "object" || !Array.isArray(catalog.sites)) {
    return []
  }

  return catalog.sites
    .map((site) => {
      const siteCode = compactText(site?.code || site?.siteCode || site?.label).toUpperCase()
      const siteId = compactText(site?.id || site?.siteId || siteCode).toLowerCase()

      if (!siteCode && !siteId) {
        return null
      }

      return {
        siteId,
        siteCode,
        label: compactText(site?.label || site?.name || siteCode),
        planningColor: compactText(site?.planningColor || site?.color || ""),
        tpiColor: compactText(site?.tpiColor || site?.tpiCardColor || ""),
        soutenanceColor: compactText(site?.soutenanceColor || site?.defenseColor || site?.defenceColor || "")
      }
    })
    .filter(Boolean)
}

function mergePlanningConfigWithCatalogColors(config, catalogSiteConfigs = [], year = null) {
  const baseConfig = buildPlanningConfigForYear(config || {}, year)
  const catalogEntries = Array.isArray(catalogSiteConfigs) ? catalogSiteConfigs : []

  if (catalogEntries.length === 0) {
    return baseConfig
  }

  const overridesById = new Map()
  const overridesByCode = new Map()

  catalogEntries.forEach((entry) => {
    const siteId = compactText(entry?.siteId || entry?.id || "").toLowerCase()
    const siteCode = compactText(entry?.siteCode || entry?.code || "").toUpperCase()

    if (siteId) {
      overridesById.set(siteId, entry)
    }

    if (siteCode) {
      overridesByCode.set(siteCode, entry)
    }
  })

  const seen = new Set()
  const mergedSiteConfigs = (Array.isArray(baseConfig.siteConfigs) ? baseConfig.siteConfigs : [])
    .map((siteConfig) => {
      const siteId = compactText(siteConfig?.siteId || siteConfig?.id || "").toLowerCase()
      const siteCode = compactText(siteConfig?.siteCode || siteConfig?.code || "").toUpperCase()
      const override = overridesById.get(siteId) || overridesByCode.get(siteCode)

      if (!override) {
        if (siteId || siteCode) {
          seen.add(siteId || siteCode)
        }
        return siteConfig
      }

      const overrideId = compactText(override.siteId || override.id || "").toLowerCase()
      const overrideCode = compactText(override.siteCode || override.code || "").toUpperCase()
      seen.add(overrideId || overrideCode)

      return {
        ...siteConfig,
        siteId: siteConfig.siteId || override.siteId,
        siteCode: siteConfig.siteCode || override.siteCode,
        label: override.label || siteConfig.label,
        planningColor: override.planningColor || siteConfig.planningColor,
        tpiColor: override.tpiColor || "",
        soutenanceColor: override.soutenanceColor || ""
      }
    })

  catalogEntries.forEach((entry) => {
    const siteId = compactText(entry?.siteId || entry?.id || "").toLowerCase()
    const siteCode = compactText(entry?.siteCode || entry?.code || "").toUpperCase()
    const dedupeKey = siteId || siteCode

    if (!dedupeKey || seen.has(dedupeKey)) {
      return
    }

    seen.add(dedupeKey)
    mergedSiteConfigs.push(entry)
  })

  return buildPlanningConfigForYear(
    {
      ...baseConfig,
      siteConfigs: mergedSiteConfigs
    },
    year
  )
}

const TpiSchedule = ({ toggleArrow, isArrowUp }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const requestedYear = useMemo(
    () => getCoordinationYearFromSearch(location.search),
    [location.search]
  )
  const [selectedYear, setSelectedYear] = useState(() => getInitialSelectedYear(location.search))
  const [configData, setConfigData] = useState(() =>
    buildPlanningConfigForYear({}, getInitialSelectedYear(location.search))
  )
  const [catalogSiteConfigOverrides, setCatalogSiteConfigOverrides] = useState([])
  const effectiveConfigData = useMemo(
    () => mergePlanningConfigWithCatalogColors(configData, catalogSiteConfigOverrides, selectedYear),
    [catalogSiteConfigOverrides, configData, selectedYear]
  )
  const defaultSoutenanceDates = useMemo(
    () => normalizeSoutenanceDateEntries(effectiveConfigData?.soutenanceDates || []),
    [effectiveConfigData]
  )
  const defaultRoomCatalogBySite = useMemo(
    () => normalizeRoomCatalog({}),
    []
  )

  const [newRooms, setNewRooms] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [isNewRoomFormOpen, setIsNewRoomFormOpen] = useState(false)
  const [tpiCardDetailLevel, setTpiCardDetailLevel] = useState(() => getInitialTpiCardDetailLevel())
  const [roomFilters, setRoomFilters] = useState({
    site: "",
    date: "",
    room: ""
  })
  const [isRoomsFocusMode, setIsRoomsFocusMode] = useState(false)
  const [isRoomsWrapMode, setIsRoomsWrapMode] = useState(false)
  const [isRoomsChronologicalSortMode, setIsRoomsChronologicalSortMode] = useState(false)
  const previousRoomsFocusModeRef = useRef(false)
  const roomsWrapModeBeforeFocusRef = useRef(null)
  const planningPageRef = useRef(null)
  const roomsContainerRef = useRef(null)
  const requestedFullscreenElementRef = useRef(null)
  const [workflowState, setWorkflowState] = useState("planning")
  const [workflowPhases, setWorkflowPhases] = useState({})
  const [activeSnapshotVersion, setActiveSnapshotVersion] = useState(null)
  // Hash des salles au moment du dernier gel (pour détecter les modifications)
  const [roomsHashAtFreeze, setRoomsHashAtFreeze] = useState(null)
  const [validationResult, setValidationResult] = useState(null)
  const [validationOptimizationSettings, setValidationOptimizationSettings] = useState(DEFAULT_VALIDATION_OPTIMIZATION_SETTINGS)
  const [workflowActionLoading, setWorkflowActionLoading] = useState(false)
  const [pendingWorkflowAction, setPendingWorkflowAction] = useState("")
  const [staticPublicationInfo, setStaticPublicationInfo] = useState(null)
  const [staticVotePublicationInfo, setStaticVotePublicationInfo] = useState(null)
  const staticVoteAutoSyncYearsRef = useRef(new Set())
  const [hasLoadedLocalPlanning, setHasLoadedLocalPlanning] = useState(false)
  const [pendingYearChange, setPendingYearChange] = useState(null)
  const [isReplacingPlanningYear, setIsReplacingPlanningYear] = useState(false)
  const [isDeleteAllRoomsDialogOpen, setIsDeleteAllRoomsDialogOpen] = useState(false)
  const [isResettingWorkflowYear, setIsResettingWorkflowYear] = useState(false)
  const [soutenanceDates, setSoutenanceDates] = useState(defaultSoutenanceDates)
  const [roomCatalogBySite, setRoomCatalogBySite] = useState(defaultRoomCatalogBySite)
  const [availableTpiModels, setAvailableTpiModels] = useState(null)
  const [isRefreshingTpiSyncStatus, setIsRefreshingTpiSyncStatus] = useState(false)
  const [peopleRegistry, setPeopleRegistry] = useState(null)
  const [swapAssistSource, setSwapAssistSource] = useState(null)
  const gestionTpiSyncNoticeSignatureRef = useRef("")
  const roomEntries = useMemo(() => (Array.isArray(newRooms) ? newRooms : []), [newRooms])
  const stakeholderShortIdHints = useMemo(() => {
    return buildStakeholderShortIdHints({
      rooms: roomEntries,
      tpiModels: availableTpiModels,
      people: peopleRegistry,
      year: Number.parseInt(selectedYear, 10)
    })
  }, [availableTpiModels, peopleRegistry, roomEntries, selectedYear])

  const assignedTpiRefs = useMemo(() => {
    const refs = []

    for (const room of roomEntries) {
      const tpiDatas = Array.isArray(room?.tpiDatas) ? room.tpiDatas : []

      for (const tpi of tpiDatas) {
        const refTpi = String(tpi?.refTpi || "").trim()
        if (refTpi) {
          refs.push(refTpi)
        }
      }
    }

    return Array.from(new Set(refs))
  }, [roomEntries])

  const planifiableTpiModels = useMemo(() => {
    if (!Array.isArray(availableTpiModels)) {
      return null
    }

    return availableTpiModels.filter((model) =>
      getPlanningPerimeterState(model, effectiveConfigData?.siteConfigs, selectedYear).isPlanifiable
    )
  }, [availableTpiModels, effectiveConfigData?.siteConfigs, selectedYear])

  const tpiUsageSummary = useMemo(() => {
    if (!Array.isArray(planifiableTpiModels)) {
      return {
        usedTpiCount: null,
        totalTpiCount: null
      }
    }

    const availableRefSet = new Set()

    for (const model of planifiableTpiModels) {
      const refTpi = String(model?.refTpi || "").trim()
      if (refTpi) {
        availableRefSet.add(refTpi)
      }
    }

    const totalTpiCount = availableRefSet.size
    const usedTpiCount = assignedTpiRefs.filter((refTpi) => availableRefSet.has(refTpi)).length

    return {
      usedTpiCount,
      totalTpiCount
    }
  }, [assignedTpiRefs, planifiableTpiModels])

  const unassignedTpiQueue = useMemo(() => {
    if (!Array.isArray(planifiableTpiModels)) {
      return []
    }

    const assignedRefSet = new Set(assignedTpiRefs.map(normalizeTpiReference).filter(Boolean))

    return planifiableTpiModels
      .map((model) => {
        const tpi = buildPlanningTpiFromGestionModel(createEmptyTpi(), model, {
          preserveOffers: false
        })
        const refTpi = compactText(tpi?.refTpi || model?.refTpi)
        const refKey = normalizeTpiReference(refTpi)

        if (!refKey || assignedRefSet.has(refKey)) {
          return null
        }

        return {
          key: refKey,
          tpi,
          refTpi,
          candidat: compactText(tpi?.candidat || model?.candidat),
          classe: compactText(tpi?.classe || model?.classe),
          site: compactText(tpi?.site || tpi?.lieu?.site || tpi?.lieu?.entreprise || model?.site || model?.lieu?.site || model?.lieu?.entreprise),
          sujet: compactText(tpi?.sujet || tpi?.description || model?.sujet || model?.description || model?.domaine)
        }
      })
      .filter(Boolean)
      .sort((left, right) => {
        const classOrder = left.classe.localeCompare(right.classe, "fr", {
          numeric: true,
          sensitivity: "base"
        })

        if (classOrder !== 0) {
          return classOrder
        }

        const nameOrder = left.candidat.localeCompare(right.candidat, "fr", {
          numeric: true,
          sensitivity: "base"
        })

        if (nameOrder !== 0) {
          return nameOrder
        }

        return left.refTpi.localeCompare(right.refTpi, "fr", {
          numeric: true,
          sensitivity: "base"
        })
      })
  }, [assignedTpiRefs, planifiableTpiModels])

  const tpiSyncSummary = useMemo(
    () => buildPlanningTpiSyncSummary(roomEntries, availableTpiModels),
    [availableTpiModels, roomEntries]
  )

  const tpiSyncEntriesBySlotKey = useMemo(() => {
    return (Array.isArray(tpiSyncSummary.entries) ? tpiSyncSummary.entries : []).reduce(
      (acc, entry) => {
        if (entry?.slotKey) {
          acc[entry.slotKey] = entry
        }

        return acc
      },
      {}
    )
  }, [tpiSyncSummary.entries])

  const tpiSyncCount = Number.isInteger(tpiSyncSummary.count)
    ? tpiSyncSummary.count
    : null

  // TPI placés dans les salles mais qui ne peuvent pas être importés lors du gel.
  const nonImportableTpiRefs = useMemo(() => getNonImportableTpiRefs(roomEntries), [roomEntries])

  const localConflictSummary = useMemo(() => {
    return summarizeLocalPersonConflicts(roomEntries)
  }, [roomEntries])

  const planningProblemItems = useMemo(() => {
    const items = []

    ;(Array.isArray(localConflictSummary.conflicts) ? localConflictSummary.conflicts : []).forEach((conflict, index) => {
      const references = Array.isArray(conflict?.references) ? conflict.references : []
      const [dateKey, periodText] = String(conflict?.slotKey || "").split("|")
      const personLabel = compactText(conflict?.personName) || "Personne"
      const dateLabel = formatRoomDateLabel(dateKey) || compactText(dateKey)
      const slotLabel = [
        dateLabel,
        periodText ? `créneau ${periodText}` : ""
      ].filter(Boolean).join(" · ")

      items.push({
        key: `conflict-${index}-${personLabel}-${slotLabel}`,
        type: "conflict",
        label: `Conflit horaire: ${personLabel}`,
        detail: [
          slotLabel,
          references.length > 0 ? references.join(", ") : ""
        ].filter(Boolean).join(" · ")
      })
    })

    ;(Array.isArray(nonImportableTpiRefs) ? nonImportableTpiRefs : []).forEach((refTpi, index) => {
      items.push({
        key: `non-importable-${refTpi || index}`,
        type: "import",
        label: `TPI incomplet: ${refTpi}`,
        detail: "Participant manquant pour le snapshot"
      })
    })

    return items.slice(0, 80)
  }, [localConflictSummary.conflicts, nonImportableTpiRefs])

  const validationMarkersBySlotKey = useMemo(() => {
    return buildValidationMarkers(roomEntries, validationResult, localConflictSummary)
  }, [roomEntries, validationResult, localConflictSummary])

  const validationOptimizationProposal = useMemo(() => {
    if (
      !validationResult ||
      Number(validationResult?.year) !== Number(selectedYear)
    ) {
      return null
    }

    return buildTargetedPlanningOptimizationProposal(roomEntries, {
      soutenanceDates,
      validationResult,
      settings: validationOptimizationSettings
    })
  }, [roomEntries, selectedYear, soutenanceDates, validationOptimizationSettings, validationResult])

  const handleValidationOptimizationSettingsChange = useCallback((nextSettings = {}) => {
    setValidationOptimizationSettings((previousSettings) => ({
      ...previousSettings,
      ...nextSettings,
      profile: typeof nextSettings.profile === "string"
        ? nextSettings.profile
        : previousSettings.profile,
      issueTypes: Array.isArray(nextSettings.issueTypes)
        ? nextSettings.issueTypes
        : previousSettings.issueTypes
    }))
  }, [])

  const getRoomSwapClassMode = useCallback((room) => {
    const dateKey = compactText(room?.date).slice(0, 10)
    const roomDateEntry = (Array.isArray(soutenanceDates) ? soutenanceDates : [])
      .find((entry) => compactText(entry?.date) === dateKey) || null

    return inferRoomClassMode({
      roomName: room?.name || room?.nameRoom,
      roomDateEntry,
      allowedPrefixes: Array.isArray(roomDateEntry?.classes) ? roomDateEntry.classes : []
    })
  }, [soutenanceDates])

  const getTpiRoomCompatibility = useCallback((tpi, room) => {
    if (!tpiHasVisibleContent(tpi)) {
      return "compatible"
    }

    const tpiMode = getTpiClassMode(tpi)
    const roomMode = getRoomSwapClassMode(room)

    if (!tpiMode || !roomMode) {
      return "warning"
    }

    return tpiMode === roomMode ? "compatible" : "blocked"
  }, [getRoomSwapClassMode])

  const getSwapAssistSlotState = useCallback(({ roomIndex, slotIndex, roomData, tpi }) => {
    if (!swapAssistSource) {
      return ""
    }

    if (roomIndex === swapAssistSource.roomIndex && slotIndex === swapAssistSource.tpiIndex) {
      return "source"
    }

    const sourceRoom = roomEntries[swapAssistSource.roomIndex]
    const sourceTpi = sourceRoom?.tpiDatas?.[swapAssistSource.tpiIndex] || swapAssistSource.tpi
    const targetRoom = roomData || roomEntries[roomIndex]
    const targetTpi = tpi || targetRoom?.tpiDatas?.[slotIndex]

    if (
      isTpiPlanningSealed(sourceTpi) ||
      (tpiHasVisibleContent(targetTpi) && isTpiPlanningSealed(targetTpi))
    ) {
      return "blocked"
    }

    const sourceToTarget = getTpiRoomCompatibility(sourceTpi, targetRoom)
    const targetToSource = tpiHasVisibleContent(targetTpi)
      ? getTpiRoomCompatibility(targetTpi, sourceRoom)
      : "compatible"

    if (sourceToTarget === "blocked" || targetToSource === "blocked") {
      return "blocked"
    }

    if (sourceToTarget === "warning" || targetToSource === "warning") {
      return "warning"
    }

    return "target"
  }, [getTpiRoomCompatibility, roomEntries, swapAssistSource])

  const notify = useCallback((message, type = "info", duration = 3000) => {
    showNotification(message, type, duration)
  }, [])

  useEffect(() => {
    if (!swapAssistSource) {
      return
    }

    const currentTpi = roomEntries?.[swapAssistSource.roomIndex]?.tpiDatas?.[swapAssistSource.tpiIndex]
    const currentRefKey = normalizeTpiReference(currentTpi?.refTpi)
    const selectedRefKey = normalizeTpiReference(swapAssistSource.refTpi)

    if (
      !currentTpi ||
      !tpiHasVisibleContent(currentTpi) ||
      isTpiPlanningSealed(currentTpi) ||
      (selectedRefKey && currentRefKey !== selectedRefKey)
    ) {
      setSwapAssistSource(null)
    }
  }, [roomEntries, swapAssistSource])

  const handleRefreshTpiSyncStatus = useCallback(async () => {
    const year = Number.parseInt(selectedYear, 10)

    if (!Number.isInteger(year)) {
      notify("Année de planification invalide pour la synchronisation.", "error")
      return
    }

    setIsRefreshingTpiSyncStatus(true)

    try {
      const tpiModels = await getTpiModels(year)
      const nextTpiModels = Array.isArray(tpiModels) ? tpiModels : []
      const nextSummary = buildPlanningTpiSyncSummary(roomEntries, nextTpiModels)

      setAvailableTpiModels(nextTpiModels)

      if (Number(nextSummary.count) > 0) {
        notify(`${nextSummary.count} TPI à synchroniser depuis GestionTPI.`, "info")
      } else {
        notify("Aucun TPI à synchroniser depuis GestionTPI.", "success")
      }
    } catch (error) {
      console.error("Erreur lors du calcul de synchronisation GestionTPI :", error)
      notify("Impossible de calculer les TPI à synchroniser.", "error")
    } finally {
      setIsRefreshingTpiSyncStatus(false)
    }
  }, [notify, roomEntries, selectedYear])

  useEffect(() => {
    if (!effectiveConfigData) {
      notify("Erreur lors du chargement du fichier de configuration.", "error")
    }
  }, [effectiveConfigData, notify])

  const fetchData = async () => {
    const savedRooms = readJSONListValue(STORAGE_KEYS.ORGANIZER_DATA, [], [
      "organizerData"
    ]) || []

    if (savedRooms.length > 0) {
      const normalizedRooms = normalizeOrganizerRooms(savedRooms)
      setNewRooms(normalizedRooms)
    }

    setHasLoadedLocalPlanning(true)
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    let isCancelled = false
    const year = Number.parseInt(selectedYear, 10)
    const fallbackConfig = buildPlanningConfigForYear({}, year)

    setConfigData(fallbackConfig)

    if (!Number.isInteger(year)) {
      return undefined
    }

    const loadPlanningConfig = async () => {
      try {
        const remoteConfig = await coordinationConfigService.getByYear(year)

        if (!isCancelled) {
          setConfigData(buildPlanningConfigForYear(remoteConfig || fallbackConfig, year))
        }
      } catch (error) {
        if (!isCancelled) {
          console.error(`Erreur lors du chargement de la configuration ${year} :`, error)
          setConfigData(fallbackConfig)
        }
      }
    }

    void loadPlanningConfig()

    return () => {
      isCancelled = true
    }
  }, [selectedYear])

  useEffect(() => {
    let isCancelled = false

    const shouldLoadPeopleRegistry = [0, 1, 2, 3].includes(Number(tpiCardDetailLevel))

    if (!shouldLoadPeopleRegistry || peopleRegistry !== null) {
      return undefined
    }

    const loadPeopleRegistry = async () => {
      try {
        const people = await personService.getAll()

        if (!isCancelled) {
          setPeopleRegistry(Array.isArray(people) ? people : [])
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Erreur lors du chargement du référentiel Parties prenantes pour les cartes TPI :", error)
          setPeopleRegistry([])
        }
      }
    }

    void loadPeopleRegistry()

    return () => {
      isCancelled = true
    }
  }, [peopleRegistry, tpiCardDetailLevel])

  useEffect(() => {
    let isCancelled = false

    const year = Number.parseInt(selectedYear, 10)

    if (!Number.isInteger(year)) {
      setAvailableTpiModels(null)
      return undefined
    }

    setAvailableTpiModels(null)

    const loadTpiModels = async () => {
      try {
        const tpiModels = await getTpiModels(year)

        if (isCancelled) {
          return
        }

        setAvailableTpiModels(Array.isArray(tpiModels) ? tpiModels : [])
      } catch (error) {
        if (!isCancelled) {
          console.error("Erreur lors du chargement des modèles TPI pour le compteur global :", error)
          setAvailableTpiModels([])
        }
      }
    }

    void loadTpiModels()

    return () => {
      isCancelled = true
    }
  }, [selectedYear])

  useEffect(() => {
    setSoutenanceDates(
      normalizeSoutenanceDateEntries(effectiveConfigData?.soutenanceDates || defaultSoutenanceDates)
    )
  }, [defaultSoutenanceDates, effectiveConfigData])

  useEffect(() => {
    if (!effectiveConfigData || roomEntries.length === 0) {
      return
    }

    const normalizedRooms = roomEntries.map((room, index) =>
      normalizeRoom(room, index, effectiveConfigData)
    )

    const currentSnapshot = JSON.stringify(roomEntries)
    const normalizedSnapshot = JSON.stringify(normalizedRooms)

    if (currentSnapshot !== normalizedSnapshot) {
      setNewRooms(normalizedRooms)
      writeJSONValue(STORAGE_KEYS.ORGANIZER_DATA, normalizedRooms)
    }
  }, [effectiveConfigData, roomEntries])

  useEffect(() => {
    let isCancelled = false

    const loadPlanningCatalog = async () => {
      try {
        const catalog =
          typeof coordinationCatalogService?.getGlobal === "function"
            ? await coordinationCatalogService.getGlobal()
            : null

        if (!isCancelled) {
          setRoomCatalogBySite(catalogToRoomCatalog(catalog, defaultRoomCatalogBySite))
          setCatalogSiteConfigOverrides(catalogToSiteConfigOverrides(catalog))
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Erreur lors du chargement du catalogue partagé :", error)
          setRoomCatalogBySite(defaultRoomCatalogBySite)
          setCatalogSiteConfigOverrides([])
        }
      }
    }

    void loadPlanningCatalog()

    return () => {
      isCancelled = true
    }
  }, [defaultRoomCatalogBySite])

  useEffect(() => {
    if (Number.isInteger(Number(selectedYear))) {
      persistCoordinationYear(selectedYear)
    }
  }, [selectedYear])

  useEffect(() => {
    if ([0, 1, 2, 3].includes(Number(tpiCardDetailLevel))) {
      writeStorageValue(
        STORAGE_KEYS.TPI_CARD_DETAIL_LEVEL,
        String(Number(tpiCardDetailLevel))
      )
    }
  }, [tpiCardDetailLevel])

  useEffect(() => {
    if (!pendingYearChange) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [pendingYearChange])

  useEffect(() => {
    if (!pendingYearChange) {
      return undefined
    }

    const handleEscape = (event) => {
      if (event.key === "Escape" && !isReplacingPlanningYear) {
        event.preventDefault()
        setPendingYearChange(null)
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [isReplacingPlanningYear, pendingYearChange])

  const roomSiteOptions = useMemo(() => {
    return Array.from(
      new Set(
        roomEntries
          .map((room) => String(room?.site || "").trim())
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right))
  }, [roomEntries])

  const roomDateOptions = useMemo(() => {
    const uniqueDates = Array.from(
      roomEntries.reduce((dateKeys, room) => {
        const rawDate = compactText(room?.date)
        const dateKey = normalizeSoutenanceDateValue(rawDate) || rawDate

        if (dateKey) {
          dateKeys.add(dateKey)
        }

        return dateKeys
      }, new Set())
    )

    return uniqueDates
      .sort((left, right) => {
        const leftTime = new Date(left).getTime()
        const rightTime = new Date(right).getTime()
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

        return left.localeCompare(right)
      })
      .map((value) => ({
        value,
        label: formatRoomDateLabel(value)
      }))
  }, [roomEntries])

  const roomNameOptions = useMemo(() => {
    const siteFilter = String(roomFilters.site || "").trim().toLowerCase()
    const dateFilters = getRoomDateFilterValues(roomFilters)
    const hasDateFilters = dateFilters.length > 0

    return Array.from(
      new Set(
        roomEntries
          .filter((room) => {
            const roomSite = String(room?.site || "").trim().toLowerCase()
            const rawRoomDate = String(room?.date || "").trim()
            const roomDate = normalizeSoutenanceDateValue(rawRoomDate) || rawRoomDate

            const matchesSite = !siteFilter || roomSite === siteFilter
            const matchesDate = !hasDateFilters || dateFilters.includes(roomDate)

            return matchesSite && matchesDate
          })
          .map((room) => compactText(room?.name || room?.nameRoom))
          .filter(Boolean)
      )
    )
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({
        value,
        label: value
      }))
  }, [roomEntries, roomFilters.site, roomFilters.date, roomFilters.dates])

  const visibleRooms = useMemo(() => {
    const siteFilter = String(roomFilters.site || "").trim().toLowerCase()
    const dateFilters = getRoomDateFilterValues(roomFilters)
    const hasDateFilters = dateFilters.length > 0
    const roomFilter = String(roomFilters.room || "").trim().toLowerCase()

    const filteredRooms = []

    roomEntries.forEach((room, index) => {
      const roomSite = String(room?.site || "").trim().toLowerCase()
      const rawRoomDate = String(room?.date || "").trim()
      const roomDate = normalizeSoutenanceDateValue(rawRoomDate) || rawRoomDate
      const roomName = String(room?.name || room?.nameRoom || "").trim().toLowerCase()

      const matchesSite = !siteFilter || roomSite === siteFilter
      const matchesDate = !hasDateFilters || dateFilters.includes(roomDate)
      const matchesRoom = !roomFilter || roomName === roomFilter

      if (matchesSite && matchesDate && matchesRoom) {
        filteredRooms.push({ room, index })
      }
    })

    if (!isRoomsChronologicalSortMode) {
      return filteredRooms.map((entry) => entry.room)
    }

    return filteredRooms
      .map((entry) => ({
        ...entry,
        sortValue: getRoomChronologicalSortValue(entry.room, entry.index)
      }))
      .sort((left, right) =>
        compareRoomChronologicalSortValues(left.sortValue, right.sortValue)
      )
      .map((entry) => entry.room)
  }, [isRoomsChronologicalSortMode, roomEntries, roomFilters])

  const updateRoomFilters = (patch) => {
    setRoomFilters((prev) => {
      const nextFilters = {
        ...prev,
        ...patch
      }

      if (
        Object.prototype.hasOwnProperty.call(patch, "site") ||
        Object.prototype.hasOwnProperty.call(patch, "date")
      ) {
        nextFilters.room = ""
      }

      return nextFilters
    })
  }

  const clearRoomFilters = () => {
    setRoomFilters({
      site: "",
      date: "",
      room: ""
    })
  }

  const clearValidationState = () => {
    setValidationResult(null)
  }

  const enterPlanningFullscreen = useCallback(() => {
    if (typeof document === "undefined") {
      return
    }

    const targetElement = planningPageRef.current || document.documentElement

    if (!targetElement || getFullscreenElement(document)) {
      return
    }

    try {
      const fullscreenRequest = requestElementFullscreen(targetElement)

      if (fullscreenRequest !== null) {
        requestedFullscreenElementRef.current = targetElement
      }

      if (fullscreenRequest && typeof fullscreenRequest.catch === "function") {
        fullscreenRequest.catch(() => {
          if (requestedFullscreenElementRef.current === targetElement) {
            requestedFullscreenElementRef.current = null
          }
        })
      }
    } catch (error) {
      requestedFullscreenElementRef.current = null
    }
  }, [])

  const exitPlanningFullscreen = useCallback(() => {
    if (typeof document === "undefined") {
      return
    }

    const activeFullscreenElement = getFullscreenElement(document)
    const targetElement = planningPageRef.current || requestedFullscreenElementRef.current

    if (!activeFullscreenElement) {
      requestedFullscreenElementRef.current = null
      return
    }

    if (!targetElement || activeFullscreenElement !== targetElement) {
      return
    }

    requestedFullscreenElementRef.current = null

    try {
      const fullscreenExit = exitDocumentFullscreen(document)

      if (fullscreenExit && typeof fullscreenExit.catch === "function") {
        fullscreenExit.catch(() => {})
      }
    } catch (error) {
      // Browser fullscreen can be interrupted by the user; CSS focus still exits.
    }
  }, [])

  const toggleRoomsFocusMode = useCallback(() => {
    if (isRoomsFocusMode) {
      setIsRoomsFocusMode(false)
      exitPlanningFullscreen()
      return
    }

    setIsRoomsFocusMode(true)
    enterPlanningFullscreen()
  }, [enterPlanningFullscreen, exitPlanningFullscreen, isRoomsFocusMode])

  const toggleRoomsWrapMode = useCallback(() => {
    setIsRoomsWrapMode((prev) => !prev)
  }, [])

  const toggleRoomsChronologicalSortMode = useCallback(() => {
    setIsRoomsChronologicalSortMode((prev) => !prev)
  }, [])

  useEffect(() => {
    const wasFocused = previousRoomsFocusModeRef.current

    if (!wasFocused && isRoomsFocusMode) {
      roomsWrapModeBeforeFocusRef.current = isRoomsWrapMode

      if (!isRoomsWrapMode) {
        setIsRoomsWrapMode(true)
      }

      setIsEditing(false)
      setSwapAssistSource(null)
    }

    if (wasFocused && !isRoomsFocusMode) {
      if (roomsWrapModeBeforeFocusRef.current !== null) {
        setIsRoomsWrapMode(Boolean(roomsWrapModeBeforeFocusRef.current))
      }

      roomsWrapModeBeforeFocusRef.current = null
    }

    previousRoomsFocusModeRef.current = isRoomsFocusMode
  }, [isRoomsFocusMode, isRoomsWrapMode])

  useEffect(() => {
    if (!isRoomsFocusMode) {
      return undefined
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault()
        exitPlanningFullscreen()
        setIsRoomsFocusMode(false)
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [exitPlanningFullscreen, isRoomsFocusMode])

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined
    }

    const handleFullscreenChange = () => {
      const activeFullscreenElement = getFullscreenElement(document)

      if (!activeFullscreenElement && requestedFullscreenElementRef.current) {
        requestedFullscreenElementRef.current = null
        setIsRoomsFocusMode(false)
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange)
    document.addEventListener("mozfullscreenchange", handleFullscreenChange)
    document.addEventListener("MSFullscreenChange", handleFullscreenChange)

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange)
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange)
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    return () => {
      exitPlanningFullscreen()
    }
  }, [exitPlanningFullscreen])

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined
    }

    const body = document.body
    const previousValue = body.classList.contains("planning-focus-mode")

    if (isRoomsFocusMode) {
      body.classList.add("planning-focus-mode")
    } else {
      body.classList.remove("planning-focus-mode")
    }

    return () => {
      if (previousValue) {
        body.classList.add("planning-focus-mode")
      } else {
        body.classList.remove("planning-focus-mode")
      }
    }
  }, [isRoomsFocusMode])

  useLayoutEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined
    }

    const isJsdomEnvironment =
      typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent || "")

    const resetScrollPosition = () => {
      const scroller = document.scrollingElement || document.documentElement

      if (scroller) {
        scroller.scrollTop = 0
        scroller.scrollLeft = 0
      }

      if (document.documentElement) {
        document.documentElement.scrollTop = 0
        document.documentElement.scrollLeft = 0
      }

      if (document.body) {
        document.body.scrollTop = 0
        document.body.scrollLeft = 0
      }

      if (!isJsdomEnvironment && typeof window.scrollTo === "function") {
        try {
          window.scrollTo({ top: 0, left: 0, behavior: "auto" })
        } catch (error) {
          // jsdom exposes scrollTo as a throwing stub; ignore it in tests.
        }
      }

      if (
        roomsContainerRef.current &&
        !isJsdomEnvironment &&
        typeof roomsContainerRef.current.scrollTo === "function"
      ) {
        try {
          roomsContainerRef.current.scrollTo({ top: 0, left: 0, behavior: "auto" })
        } catch (error) {
          roomsContainerRef.current.scrollTop = 0
          roomsContainerRef.current.scrollLeft = 0
        }
      } else if (roomsContainerRef.current) {
        roomsContainerRef.current.scrollTop = 0
        roomsContainerRef.current.scrollLeft = 0
      }
    }

    resetScrollPosition()
  }, [isRoomsFocusMode, isRoomsWrapMode])

  const resetPlanningViewState = () => {
    setRoomFilters({
      site: "",
      date: "",
      room: ""
    })
    setIsEditing(false)
    clearValidationState()
  }

  const handleYearChangeRequest = (nextYear) => {
    const parsedYear = Number.parseInt(nextYear, 10)

    if (!Number.isInteger(parsedYear) || parsedYear === Number(selectedYear)) {
      return
    }

    if (roomEntries.length > 0) {
      setPendingYearChange(parsedYear)
      return
    }

      handleFetchConfig(parsedYear)
        .catch((error) => {
          console.error("Erreur lors du chargement de la planification:", error)
        })
  }

  const cancelYearChange = () => {
    if (isReplacingPlanningYear) {
      return
    }

    setIsReplacingPlanningYear(false)
    setPendingYearChange(null)
  }

  const handleCancelYearChange = (event) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }

    cancelYearChange()
  }

  const confirmYearChange = async () => {
    const targetYear = Number.parseInt(pendingYearChange, 10)

    if (!Number.isInteger(targetYear) || isReplacingPlanningYear) {
      return
    }

    setIsReplacingPlanningYear(true)

    try {
      await handleFetchConfig(targetYear)
    } finally {
      setPendingYearChange(null)
      setIsReplacingPlanningYear(false)
    }
  }

  const refreshWorkflowContext = useCallback(async (year) => {
    try {
      const safePromise = (handler, ...args) => {
        if (typeof handler !== "function") {
          return Promise.resolve(null)
        }

        try {
          return Promise.resolve(handler(...args))
        } catch (error) {
          return Promise.reject(error)
        }
      }

      const [workflow, snapshot] = await Promise.all([
        safePromise(workflowCoordinationService.getYearState, year).catch((error) => {
          console.warn("Erreur chargement phases admin:", error?.status, error?.message)
          return null
        }),
        safePromise(workflowCoordinationService.getActiveSnapshot, year).catch((error) => {
          // 404 = pas encore de snapshot, c'est normal
          if (error?.status === 404) {
            return null
          }
          console.warn("Erreur chargement snapshot:", error?.status, error?.message)
          return null
        })
      ])

      const nextState = workflow?.state || "planning"
      setWorkflowState(nextState)
      setWorkflowPhases(workflow?.phases || {})

      const snapshotVersion = snapshot?.version || null
      setActiveSnapshotVersion(snapshotVersion)

      if (shouldLogWorkflowDebug) {
        console.debug(`[Workflow] année=${year} state=${nextState} snapshot=v${snapshotVersion || "aucun"}`)
      }

    } catch (error) {
      console.error("Erreur chargement contexte workflow:", error)
      notify("Erreur lors du chargement du workflow.", "error")
    }
  }, [notify])

  useEffect(() => {
    refreshWorkflowContext(selectedYear).catch(console.error)
  }, [refreshWorkflowContext, selectedYear])

  const refreshStaticPublicationStatus = useCallback(async (year) => {
    if (typeof workflowCoordinationService.getStaticPublicationStatus !== "function") {
      return null
    }

    try {
      const status = await workflowCoordinationService.getStaticPublicationStatus(year)
      setStaticPublicationInfo(status || null)
      return status
    } catch (error) {
      console.warn("Erreur chargement publication statique:", error?.status, error?.message)
      setStaticPublicationInfo(null)
      return null
    }
  }, [])

  useEffect(() => {
    refreshStaticPublicationStatus(selectedYear).catch(console.error)
  }, [refreshStaticPublicationStatus, selectedYear])

  const refreshStaticVotePublicationStatus = useCallback(async (year) => {
    if (typeof workflowCoordinationService.getStaticVotePublicationStatus !== "function") {
      return null
    }

    try {
      const status = await workflowCoordinationService.getStaticVotePublicationStatus(year)
      setStaticVotePublicationInfo(status || null)
      return status
    } catch (error) {
      console.warn("Erreur chargement mini-site vote:", error?.status, error?.message)
      setStaticVotePublicationInfo(null)
      return null
    }
  }, [])

  const applyStaticVoteSyncResult = useCallback((result, extra = {}) => {
    const failedCount = Number(result?.failedCount || 0)

    setStaticVotePublicationInfo((previousInfo) => ({
      ...(previousInfo || {}),
      ...extra,
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: failedCount > 0 ? "warning" : "success",
      lastSyncMessage: extra.lastSyncMessage || "Synchronisation votes web effectuée.",
      lastSyncReceivedCount: Number(result?.receivedCount || 0),
      lastSyncImportedCount: Number(result?.importedCount || 0),
      lastSyncFailedCount: failedCount
    }))
  }, [])

  const syncStaticVotePublicationSilently = useCallback(async (year, status = null) => {
    if (typeof workflowCoordinationService.syncStaticVotePublication !== "function") {
      return null
    }

    try {
      const result = await workflowCoordinationService.syncStaticVotePublication(year)
      applyStaticVoteSyncResult(result, {
        ...(status || {}),
        lastSyncMessage: "Synchronisation automatique au chargement."
      })
      return result
    } catch (error) {
      console.warn("Synchronisation automatique mini-site vote indisponible:", error?.status, error?.message)
      setStaticVotePublicationInfo((previousInfo) => ({
        ...(previousInfo || {}),
        ...(status || {}),
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: "error",
        lastSyncMessage: error?.data?.error || error?.message || "Synchronisation automatique indisponible."
      }))
      return null
    }
  }, [applyStaticVoteSyncResult])

  useEffect(() => {
    let isCancelled = false

    const loadStaticVotePublicationStatus = async () => {
      const status = await refreshStaticVotePublicationStatus(selectedYear)

      if (isCancelled) {
        return
      }

      const yearKey = String(selectedYear)
      if (
        status?.available === true &&
        status?.syncSecretConfigured === true &&
        !staticVoteAutoSyncYearsRef.current.has(yearKey)
      ) {
        staticVoteAutoSyncYearsRef.current.add(yearKey)
        await syncStaticVotePublicationSilently(selectedYear, status)
      }
    }

    loadStaticVotePublicationStatus().catch(console.error)

    return () => {
      isCancelled = true
    }
  }, [refreshStaticVotePublicationStatus, selectedYear, syncStaticVotePublicationSilently])

  const executeWorkflowAction = async ({
    actionKey,
    confirmMessage = "",
    run,
    successMessage,
    onSuccess = null,
    onError = null,
    showSuccessNotification = true,
    showErrorNotification = true
  }) => {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return
    }

    setWorkflowActionLoading(true)
    setPendingWorkflowAction(actionKey)

    try {
      const result = await run()
      if (successMessage && showSuccessNotification) {
        const message = typeof successMessage === "function"
          ? successMessage(result)
          : successMessage
        if (message) {
          notify(message, "success")
        }
      }
      const resultWarnings = Array.isArray(result?.warnings)
        ? result.warnings.filter(Boolean)
        : []
      if (resultWarnings.length > 0) {
        const displayedWarnings = resultWarnings.slice(0, 2).join(" ")
        const suffix = resultWarnings.length > 2
          ? ` (+${resultWarnings.length - 2} autre${resultWarnings.length > 3 ? "s" : ""})`
          : ""
        notify(`Action exécutée avec avertissement: ${displayedWarnings}${suffix}`, "warning", 6500)
      }
      if (typeof onSuccess === "function") {
        onSuccess(result)
      }
      await refreshWorkflowContext(selectedYear)
      return result
    } catch (error) {
      const message = error?.data?.error || error?.message || "Erreur workflow."
      if (showErrorNotification) {
        notify(message, "error", 3500)
      }
      if (typeof onError === "function") {
        onError(message, error)
      }
    } finally {
      setWorkflowActionLoading(false)
      setPendingWorkflowAction("")
    }
  }

  const buildWorkflowGuidanceConfirm = (actionLabel, _expectedFlow, warnings = []) => {
    const activeWarnings = warnings.filter(Boolean)
    const intro = `Confirmer: ${actionLabel} ?`

    if (activeWarnings.length === 0) {
      return intro
    }

    return [
      intro,
      "",
      ...activeWarnings.map((warning) => `- ${warning}`),
      "",
      "L'action reste sous contrôle admin."
    ].join("\n")
  }

  const hasSnapshotForCurrentPlanning = Boolean(activeSnapshotVersion)
  const currentPlanningHash = JSON.stringify(newRooms.map(r => ({
    name: r.name,
    date: r.date,
    tpiCount: r.tpiDatas?.length || 0
  })))
  const hasStaleSnapshotForCurrentPlanning = Boolean(
    roomsHashAtFreeze &&
    currentPlanningHash &&
    roomsHashAtFreeze !== currentPlanningHash
  )
  const hasBlockingValidationForCurrentPlanning = Boolean(
    validationResult &&
    Number(validationResult?.year) === Number(selectedYear) &&
    validationResult?.summary?.isValid === false
  )
  const isWorkflowPhaseActive = useCallback((phase) => {
    if (workflowPhases?.[phase] && typeof workflowPhases[phase].active === "boolean") {
      return workflowPhases[phase].active
    }

    if (phase === "planning") {
      return workflowState === "planning"
    }

    if (phase === "votes") {
      return workflowState === "voting_open"
    }

    if (phase === "defenses") {
      return workflowState === "published"
    }

    return false
  }, [workflowPhases, workflowState])
  const activeWorkflowPhaseLabel = useMemo(() => {
    const labels = {
      planning: "Planification",
      votes: "Votes",
      arbitrage: "Arbitrage",
      defenses: "Défenses"
    }
    const activeLabels = Object.entries(workflowPhases || {})
      .filter(([, value]) => value?.active === true)
      .map(([phase]) => labels[phase] || phase)

    if (activeLabels.length > 0) {
      return activeLabels.join(", ")
    }

    return {
      planning: "Planification",
      voting_open: "Votes",
      published: "Défenses"
    }[workflowState] || "Aucune"
  }, [workflowPhases, workflowState])

  const runValidationForRooms = async (roomsToValidate, options = {}) => {
    const loadingToastId = toast.loading(options.loadingMessage || `Vérification ${selectedYear} en cours...`, {
      position: "top-center"
    })
    const localAnalysis = analyzePlanningRooms(roomsToValidate, {
      soutenanceDates
    })
    const shouldSendRoomsForBackendValidation =
      !isWorkflowPhaseActive("votes") &&
      !isWorkflowPhaseActive("arbitrage") &&
      !isWorkflowPhaseActive("defenses")

    const result = await executeWorkflowAction({
      actionKey: "validate",
      run: () => workflowCoordinationService.validatePlanification(
        selectedYear,
        false,
        shouldSendRoomsForBackendValidation ? roomsToValidate : null
      ),
      successMessage: null,
      showSuccessNotification: false,
      showErrorNotification: false,
      onSuccess: (validationResult) => {
        const nextValidationResult = buildValidationResultFromSources(
          selectedYear,
          validationResult,
          localAnalysis
        )
        setValidationResult(nextValidationResult)
        const validationToast = buildValidationToast(selectedYear, {
          ...validationResult,
          ...nextValidationResult
        })
        toast.update(loadingToastId, {
          render: options.successPrefix
            ? `${options.successPrefix} ${validationToast.message}`
            : validationToast.message,
          type: validationToast.level,
          isLoading: false,
          autoClose: 6000,
          closeOnClick: true,
          closeButton: true
        })
      },
      onError: (message) => {
        toast.update(loadingToastId, {
          render: message,
          type: "error",
          isLoading: false,
          autoClose: 7000,
          closeOnClick: true,
          closeButton: true
        })
      }
    })

    return result
  }

  const handleValidatePlanification = async () => {
    return await runValidationForRooms(roomEntries)
  }

  const handleApplyValidationOptimization = async () => {
    const proposal = validationOptimizationProposal

    if (!proposal?.changed) {
      notify("Aucune optimisation ciblée applicable avec ces options.", "info")
      return null
    }

    const nextRooms = proposal.rooms
    const optimizationToast = buildOptimizationToast(selectedYear, {
      optimization: proposal
    })

    clearValidationState()
    setNewRooms(nextRooms)
    saveDataToLocalStorage(nextRooms)

    return await runValidationForRooms(nextRooms, {
      loadingMessage: `Optimisation ciblée ${selectedYear} en cours...`,
      successPrefix: optimizationToast.message
    })
  }

  const handleAutomatePlanification = async () => {
    const result = await executeWorkflowAction({
      actionKey: "autoPlan",
      confirmMessage: `Reconstruire automatiquement la planification ${selectedYear} ? La version locale actuelle sera remplacée par la version générée selon la configuration annuelle.`,
      run: () => workflowCoordinationService.automatePlanification(selectedYear),
      successMessage: (payload) => {
        const summary = payload?.summary || {}
        const syncSummary = payload?.sync || {}
        const plannedCount = Number(summary.plannedCount || 0)
        const manualRequiredCount = Number(summary.manualRequiredCount || 0)
        const constraintOverrideCount = Number(summary.constraintOverrideCount || 0)
        const roomCount = Number(summary.legacyRoomCount || summary.roomCount || 0)
        const syncCreatedCount = Number(syncSummary.createdCount || 0)
        const syncPrefix = syncCreatedCount > 0
          ? `${syncCreatedCount} TPI intégré(s) depuis GestionTPI dans le workflow. `
          : ''
        const constraintSuffix = constraintOverrideCount > 0
          ? ` ${constraintOverrideCount} TPI placé(s) avec alerte de contrainte.`
          : ''

        return `${syncPrefix}Planification automatique terminée: ${plannedCount} TPI placés, ${manualRequiredCount} manuel(s), ${roomCount} salle(s).${constraintSuffix}`
      },
      onSuccess: (payload) => {
        if (payload?.validation) {
          setValidationResult(payload.validation)
        }
      }
    })

    if (result?.success) {
      const generatedLegacyRooms = Array.isArray(result?.legacyRooms)
        ? result.legacyRooms
        : []

      if (generatedLegacyRooms.length > 0) {
        const normalizedRooms = normalizeOrganizerRooms(generatedLegacyRooms, effectiveConfigData)

        removeStorageValue(STORAGE_KEYS.ORGANIZER_DATA)
        writeJSONValue(STORAGE_KEYS.ORGANIZER_DATA, normalizedRooms)
        resetPlanningViewState()
        setNewRooms(normalizedRooms)

        if (result?.validation) {
          setValidationResult(result.validation)
        }
      } else {
        await handleFetchConfig(selectedYear, {
          skipConfirm: true,
          notifyStart: false,
          notifySuccess: false,
          preserveValidation: result?.validation || null
        })
      }
    }

    return result
  }

  const handleFreezeSnapshot = async () => {
    const result = await executeWorkflowAction({
      actionKey: "freeze",
      confirmMessage: `Confirmer le gel du snapshot ${selectedYear} ?`,
      run: () => workflowCoordinationService.freezePlanification(selectedYear, false, newRooms),
      successMessage: (result) => {
        const version = result?.snapshot?.version || "?"
        const imported = result?.summary?.tpiCount || 0
        const skipped = result?.summary?.skippedEntries || 0
        let msg = `Snapshot v${version} gele avec succes. ${imported} TPI importes.`
        if (skipped > 0) {
          msg += ` ${skipped} TPI ignores.`
        }
        return msg
      }
    })

    if (result?.snapshot?.version) {
      setActiveSnapshotVersion(result.snapshot.version)
      // Stocker le hash des salles actuelles pour détecter les modifications futures
      const hash = JSON.stringify(newRooms.map(r => ({
        name: r.name,
        date: r.date,
        tpiCount: r.tpiDatas?.length || 0
      })))
      setRoomsHashAtFreeze(hash)
    }
  }

  const handleOpenVotes = async () => {
    const warnings = [
      !hasSnapshotForCurrentPlanning
        ? "Aucun snapshot actif n'est gelé."
        : "",
      hasStaleSnapshotForCurrentPlanning
        ? "La planification locale a changé depuis le dernier snapshot."
        : "",
      hasBlockingValidationForCurrentPlanning
        ? "La dernière vérification contient encore des erreurs."
        : ""
    ]
    const result = await executeWorkflowAction({
      actionKey: "startVotes",
      confirmMessage: buildWorkflowGuidanceConfirm(
        "ouvrir la campagne de votes sans envoyer d emails",
        "Planification -> Votes -> Défenses",
        warnings
      ),
      run: () => workflowCoordinationService.startVotesWithoutEmails(selectedYear, newRooms),
      successMessage: (result) => {
        const tpiCount = result?.tpiCount || 0
        return `Campagne ouverte: ${tpiCount} TPI synchronisés, aucun email envoyé automatiquement.`
      },
      onError: (_message, error) => {
        const validationFromError = extractValidationResultFromError(selectedYear, error)
        if (validationFromError) {
          setValidationResult(validationFromError)
        }
      }
    })

    if (result?.workflowState) {
      setWorkflowState(result.workflowState)
    }
    if (result?.workflow?.phases) {
      setWorkflowPhases(result.workflow.phases)
    }
  }

  const handleOpenVotesWithoutEmails = async () => {
    const warnings = [
      !hasSnapshotForCurrentPlanning
        ? "Aucun snapshot actif n'est gelé."
        : "",
      hasStaleSnapshotForCurrentPlanning
        ? "La planification locale a changé depuis le dernier snapshot."
        : "",
      hasBlockingValidationForCurrentPlanning
        ? "La dernière vérification contient encore des erreurs."
        : ""
    ]
    const result = await executeWorkflowAction({
      actionKey: "startVotesNoEmail",
      confirmMessage: buildWorkflowGuidanceConfirm(
        "ouvrir la campagne de votes sans envoyer d emails",
        "Planification -> Votes -> Défenses",
        warnings
      ),
      run: () => workflowCoordinationService.startVotesWithoutEmails(selectedYear, newRooms),
      successMessage: (result) => {
        const tpiCount = result?.tpiCount || 0
        return `Campagne ouverte: ${tpiCount} TPI synchronises, aucun email envoye.`
      },
      onError: (_message, error) => {
        const validationFromError = extractValidationResultFromError(selectedYear, error)
        if (validationFromError) {
          setValidationResult(validationFromError)
        }
      }
    })

    if (result?.workflowState) {
      setWorkflowState(result.workflowState)
    }
    if (result?.workflow?.phases) {
      setWorkflowPhases(result.workflow.phases)
    }
  }

  const handleRemindVotes = async () => {
    await executeWorkflowAction({
      actionKey: "remindVotes",
      confirmMessage: buildWorkflowGuidanceConfirm(
        "relancer les votes",
        "Votes",
        !isWorkflowPhaseActive("votes")
          ? ["La phase Votes n'est pas active."]
          : []
      ),
      run: () => workflowCoordinationService.remindVotes(selectedYear),
      successMessage: (result) =>
        `Relances envoyees: ${result?.emailsSucceeded || 0}/${result?.emailsSent || 0}.`
    })
  }

  const handleCloseVotes = async () => {
    await executeWorkflowAction({
      actionKey: "closeVotes",
      confirmMessage: buildWorkflowGuidanceConfirm(
        "clore les votes",
        "Votes",
        !isWorkflowPhaseActive("votes")
          ? ["La phase Votes n'est pas active."]
          : []
      ),
      run: () => workflowCoordinationService.closeVotes(selectedYear),
      successMessage: (result) =>
        `Clôture terminée: ${result?.confirmedCount || 0} confirmés, ${result?.manualRequiredCount || 0} manuels.`
    })
  }

  const soutenanceSiteLinkOptions = useMemo(() => {
    const publicUrl = typeof staticPublicationInfo?.publicUrl === "string"
      ? staticPublicationInfo.publicUrl.trim()
      : ""

    return publicUrl
      ? {
          soutenanceLinkTarget: "publication",
          soutenancePublicUrl: publicUrl
        }
      : {}
  }, [staticPublicationInfo?.publicUrl])

  const handlePublishDefinitive = async () => {
    const warnings = [
      isWorkflowPhaseActive("votes")
        ? "La phase Votes est encore active; les défenses seront publiées en parallèle."
        : "",
      hasStaleSnapshotForCurrentPlanning
        ? "La planification locale a changé depuis le dernier snapshot."
        : "",
      hasBlockingValidationForCurrentPlanning
        ? "La dernière vérification contient encore des erreurs."
        : ""
    ]
    const result = await executeWorkflowAction({
      actionKey: "publish",
      confirmMessage: buildWorkflowGuidanceConfirm(
        "publier les défenses",
        "Défenses",
        warnings
      ),
      run: () => workflowCoordinationService.publishDefinitive(selectedYear, newRooms, soutenanceSiteLinkOptions),
      successMessage: (result) => {
        const sentLinks = result?.sentLinks
        const linksLabel = sentLinks?.emailsSkipped
          ? " Liens: non envoyés automatiquement."
          : ` Liens: ${sentLinks?.emailsSucceeded || 0}/${sentLinks?.emailsSent || 0}.`
        return `${result?.message || "Publication terminée."}${linksLabel}`
      }
    })

    if (result?.workflowState) {
      setWorkflowState(result.workflowState)
    }
    if (result?.workflow?.phases) {
      setWorkflowPhases(result.workflow.phases)
    }
  }

  const handleDeactivatePublication = async () => {
    const result = await executeWorkflowAction({
      actionKey: "deactivatePublication",
      confirmMessage: buildWorkflowGuidanceConfirm(
        "revenir aux votes",
        "Défenses",
        !isWorkflowPhaseActive("defenses")
          ? ["La phase Défenses n'est pas active."]
          : []
      ),
      run: () => workflowCoordinationService.deactivatePublication(selectedYear),
      successMessage: (result) => {
        const reopenedCount = Number(result?.reopenedDirectPublicationCount || 0)
        const voteSuffix = reopenedCount > 0
          ? ` ${result?.voteCampaign?.tpiCount || reopenedCount} TPI remis en vote sans email automatique.`
          : ''

        return `Publication desactivee: ${result?.deactivatedPublicationCount || 0} version(s), ${result?.revokedSoutenanceLinks || 0} lien(s) revoque(s).${voteSuffix}`
      },
      onSuccess: (result) => {
        const nextWorkflowState = result?.workflowState || result?.workflow?.state
        if (nextWorkflowState) {
          setWorkflowState(nextWorkflowState)
        }
        if (result?.workflow?.phases) {
          setWorkflowPhases(result.workflow.phases)
        }
      }
    })

    const nextWorkflowState = result?.workflowState || result?.workflow?.state
    if (nextWorkflowState) {
      setWorkflowState(nextWorkflowState)
    }
    if (result?.workflow?.phases) {
      setWorkflowPhases(result.workflow.phases)
    }
  }

  const handleWorkflowPhaseToggle = async (phase, active) => {
    const labels = {
      planning: "Planification",
      votes: "Votes",
      arbitrage: "Arbitrage",
      defenses: "Défenses"
    }
    const phaseLabel = labels[phase] || phase
    const actionLabel = active ? "activer" : "désactiver"
    const result = await executeWorkflowAction({
      actionKey: "phaseToggle",
      confirmMessage: `Confirmer: ${actionLabel} la phase "${phaseLabel}" pour ${selectedYear} ? Les données ne seront pas supprimées.`,
      run: () => workflowCoordinationService.setPhaseActive(selectedYear, phase, active, {
        reason: `Pilotage admin: ${actionLabel} ${phaseLabel}`
      }),
      successMessage: (result) => {
        const nextActive = result?.active === true
        return `Phase ${phaseLabel} ${nextActive ? "activée" : "désactivée"}.`
      },
      onSuccess: (result) => {
        const nextWorkflowState = result?.workflow?.state
        if (nextWorkflowState) {
          setWorkflowState(nextWorkflowState)
        }
        if (result?.workflow?.phases) {
          setWorkflowPhases(result.workflow.phases)
        }
      }
    })

    const nextWorkflowState = result?.workflow?.state
    if (nextWorkflowState) {
      setWorkflowState(nextWorkflowState)
    }
    if (result?.workflow?.phases) {
      setWorkflowPhases(result.workflow.phases)
    }
  }

  const handleSendSoutenanceLinks = async () => {
    await executeWorkflowAction({
      actionKey: "sendLinks",
      confirmMessage: buildWorkflowGuidanceConfirm(
        "envoyer les liens de défense",
        "Défenses",
        !isWorkflowPhaseActive("defenses")
          ? ["La phase Défenses n'est pas active."]
          : []
      ),
      run: () => workflowCoordinationService.sendPublicationLinks(selectedYear, soutenanceSiteLinkOptions),
      successMessage: (result) =>
        `Liens défense envoyés: ${result?.sentLinks?.emailsSucceeded || 0}/${result?.sentLinks?.emailsSent || 0}.`
    })
  }

  const handleGenerateStaticPublication = async () => {
    await executeWorkflowAction({
      actionKey: "staticGenerate",
      run: () => workflowCoordinationService.generateStaticPublication(selectedYear),
      successMessage: (result) =>
        `Page statique générée: ${result?.defenseCount || 0} défense(s), ${result?.roomCount || 0} salle(s).`,
      onSuccess: (result) => {
        setStaticPublicationInfo(result || null)
      }
    })
  }

  const handlePreviewStaticPublication = async () => {
    let status = staticPublicationInfo

    if (!status?.available) {
      status = await refreshStaticPublicationStatus(selectedYear)
    }

    if (!status?.available || !status.previewPath) {
      notify("Génère la page statique avant de la prévisualiser.", "warning", 3200)
      return
    }

    window.open(buildApiAbsoluteUrl(status.previewPath), "_blank", "noopener,noreferrer")
  }

  const handlePublishStaticPublication = async () => {
    const publicationTargetLabel = formatPublicationConfirmTarget(staticPublicationInfo?.publicUrl)
    const warnings = [
      "La publication Défenses sera d'abord recréée depuis la planification courante.",
      hasStaleSnapshotForCurrentPlanning
        ? "La planification locale a changé depuis le dernier snapshot."
        : "",
      hasBlockingValidationForCurrentPlanning
        ? "La dernière vérification contient encore des erreurs."
        : ""
    ]

    await executeWorkflowAction({
      actionKey: "staticPublish",
      confirmMessage: buildWorkflowGuidanceConfirm(
        `publier les défenses puis transférer sur ${publicationTargetLabel}`,
        "Défenses + tpi26",
        warnings
      ),
      run: async () => {
        const publication = await workflowCoordinationService.publishDefinitive(
          selectedYear,
          newRooms,
          soutenanceSiteLinkOptions
        )
        const ftpPublication = await workflowCoordinationService.publishStaticPublication(selectedYear)

        return {
          ...(ftpPublication || {}),
          publication
        }
      },
      successMessage: (result) =>
        `Défenses publiées puis transfert FTP réussi: ${result?.defenseCount || 0} défense(s) en ligne${result?.publicUrl ? ` sur ${result.publicUrl}.` : "."}`,
      onSuccess: (result) => {
        const publishedAt = result?.publishedAt || new Date().toISOString()
        const publicationResult = result?.publication
        if (publicationResult?.workflowState) {
          setWorkflowState(publicationResult.workflowState)
        }
        if (publicationResult?.workflowPhases) {
          setWorkflowPhases(publicationResult.workflowPhases)
        }
        setStaticPublicationInfo({
          ...(result || {}),
          lastPublishStatus: "success",
          lastPublishMessage: "Publication FTP réussie.",
          lastPublishAt: publishedAt
        })
      },
      onError: (message) => {
        setStaticPublicationInfo((previousInfo) => ({
          ...(previousInfo || {}),
          lastPublishStatus: "error",
          lastPublishMessage: message || "Erreur lors de la publication statique par FTP.",
          lastPublishAt: new Date().toISOString()
        }))
      }
    })
  }

  const handleGenerateStaticVotePublication = async () => {
    await executeWorkflowAction({
      actionKey: "staticVoteGenerate",
      confirmMessage: STATIC_VOTE_REGENERATION_CONFIRM_MESSAGE,
      run: () => workflowCoordinationService.generateStaticVotePublication(selectedYear),
      successMessage: (result) =>
        `Mini-site vote généré: ${result?.groupCount || 0} vote(s), ${result?.accessLinkCount || 0} lien(s).`,
      onSuccess: (result) => {
        setStaticVotePublicationInfo(result || null)
      }
    })
  }

  const handlePublishStaticVotePublication = async () => {
    const publicationTargetLabel = formatPublicationConfirmTarget(staticVotePublicationInfo?.publicUrl)

    await executeWorkflowAction({
      actionKey: "staticVotePublish",
      confirmMessage: `Publier le mini-site vote généré sur ${publicationTargetLabel} par FTP ?`,
      run: () => workflowCoordinationService.publishStaticVotePublication(selectedYear),
      successMessage: (result) =>
        `Mini-site vote publié${result?.publicUrl ? ` sur ${result.publicUrl}.` : "."}`,
      onSuccess: (result) => {
        const publishedAt = result?.publishedAt || new Date().toISOString()
        setStaticVotePublicationInfo((previousInfo) => ({
          ...(previousInfo || {}),
          ...(result || {}),
          available: true,
          lastPublishStatus: "success",
          lastPublishMessage: "Publication FTP vote réussie.",
          lastPublishAt: publishedAt
        }))
      },
      onError: (message) => {
        setStaticVotePublicationInfo((previousInfo) => ({
          ...(previousInfo || {}),
          lastPublishStatus: "error",
          lastPublishMessage: message || "Erreur lors de la publication FTP du mini-site vote.",
          lastPublishAt: new Date().toISOString()
        }))
      }
    })
  }

  const handleSyncStaticVotePublication = async () => {
    await executeWorkflowAction({
      actionKey: "staticVoteSync",
      run: () => workflowCoordinationService.syncStaticVotePublication(selectedYear),
      successMessage: (result) =>
        `Votes web synchronisés: ${result?.importedCount || 0}/${result?.receivedCount || 0} importé(s), ${result?.failedCount || 0} erreur(s).`,
      onSuccess: (result) => {
        applyStaticVoteSyncResult(result, {
          lastSyncMessage: "Synchronisation manuelle votes web effectuée."
        })
      },
      onError: (message) => {
        setStaticVotePublicationInfo((previousInfo) => ({
          ...(previousInfo || {}),
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: "error",
          lastSyncMessage: message || "Erreur lors de la synchronisation votes web."
        }))
      }
    })
  }

  const handleOpenVoteTracking = () => {
    navigate(`${ROUTES.COORDINATION}/${selectedYear}?tab=votes`)
  }

  const handleOpenVoteAccessPreview = useCallback(() => {
    const query = new URLSearchParams({
      year: String(selectedYear),
      type: 'vote',
      auto: '1'
    })

    navigate(`${ROUTES.GEN_TOKENS}?${query.toString()}`)
  }, [navigate, selectedYear])

  const handlePublish = async (year) => {
    const normalizedYear = Number.parseInt(year, 10)
    const soutenancePageUrl = Number.isInteger(normalizedYear)
      ? `${ROUTES.SOUTENANCES}/${normalizedYear}`
      : ROUTES.SOUTENANCES

    try {
      const planningPublication = await publishSoutenancesFromPlanification(year)

      if (planningPublication?.count > 0) {
        if (Number.isInteger(normalizedYear)) {
          navigate(soutenancePageUrl)
        }
        notify(
          `Les défenses confirmées ont été publiées depuis la planification. Voir: ${soutenancePageUrl}`,
          "success"
        )
        return
      }

      if (roomEntries.length > 0) {
        for (const room of roomEntries) {
          try {
            await createTpiCollectionForYear(year, updateTpiDatas(room, effectiveConfigData))
          } catch (error) {
            console.error(
              "Erreur lors de la création de la salle de TPI : ",
              error
            )
            return
          }
        }

        if (Number.isInteger(normalizedYear)) {
          navigate(soutenancePageUrl)
        }
        notify(`Les défenses ont été publiées. Voir: ${soutenancePageUrl}`, "success")
        return
      }

      notify(
        "Aucune défense confirmée dans la planification et aucune salle legacy à publier.",
        "error"
      )
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des défenses :", error)
      notify("Erreur lors de la publication des défenses.", "error")
    }
  }

  const handleDelete = async (idRoomToDelete) => {
    try {
      clearValidationState()
      setNewRooms((prevRooms) => {
        const updatedData = prevRooms.filter(
          (room) => room.idRoom !== idRoomToDelete
        )

        writeJSONValue(STORAGE_KEYS.ORGANIZER_DATA, updatedData)
        return updatedData
      })

      notify(`Salle ${idRoomToDelete} supprimée`, "success")
    } catch (error) {
      console.error("Erreur lors de la suppression de la salle :", error)
      notify(`Erreur lors de la suppression de la salle : ${error.message}`, "error")
    }
  }

  const clearLocalPlanningRooms = () => {
    clearValidationState()
    clearRoomFilters()
    setRoomsHashAtFreeze(null)
    setNewRooms([])
    setIsEditing(false)
    removeStorageValue(STORAGE_KEYS.ORGANIZER_DATA)
  }

  const handleDeleteAllRooms = () => {
    try {
      const roomCount = roomEntries.length

      if (roomCount === 0) {
        notify("Aucune salle à supprimer.", "info")
        return false
      }

      setIsDeleteAllRoomsDialogOpen(true)
      return false
    } catch (error) {
      console.error("Erreur lors de la suppression complète de la planification :", error)
      notify(`Erreur lors de la suppression complète de la planification : ${error.message}`, "error")
      return false
    }
  }

  const handleCancelDeleteAllRooms = () => {
    if (isResettingWorkflowYear) {
      return
    }

    setIsDeleteAllRoomsDialogOpen(false)
    notify("Suppression de la planification annulée.", "info")
  }

  const handleDeleteRoomsOnly = () => {
    const roomCount = roomEntries.length

    if (roomCount === 0) {
      setIsDeleteAllRoomsDialogOpen(false)
      notify("Aucune salle à supprimer.", "info")
      return
    }

    clearLocalPlanningRooms()
    setIsDeleteAllRoomsDialogOpen(false)
    notify(`${roomCount} salle(s) supprimée(s) de la planification ${selectedYear}.`, "success")
  }

  const handleRestartWorkflowYear = async () => {
    if (isResettingWorkflowYear) {
      return
    }

    const roomCount = roomEntries.length
    setIsResettingWorkflowYear(true)

    try {
      const result = await workflowCoordinationService.resetYear(selectedYear)
      const deleted = result?.deleted || {}
      const legacyDeletedCount = Array.isArray(deleted.legacyCollections)
        ? deleted.legacyCollections.reduce((total, item) => total + Number(item?.deletedCount || 0), 0)
        : 0
      const totalDeleted = [
        deleted.votes,
        deleted.slots,
        deleted.tpiPlannings,
        deleted.planningSnapshots,
        deleted.publicationVersions,
        deleted.magicLinks,
        deleted.workflowYears,
        legacyDeletedCount
      ].reduce((total, value) => total + Number(value || 0), 0)

      clearLocalPlanningRooms()
      setWorkflowState(result?.workflow?.state || "planning")
      setWorkflowPhases(result?.workflow?.phases || {})
      setActiveSnapshotVersion(null)
      setIsDeleteAllRoomsDialogOpen(false)
      await refreshWorkflowContext(selectedYear)

      notify(
        `Workflow ${selectedYear} réinitialisé: ${roomCount} room(s) locale(s) effacée(s), ${totalDeleted} élément(s) serveur supprimé(s).`,
        "success",
        5000
      )
    } catch (error) {
      console.error("Erreur lors de la réinitialisation du workflow :", error)
      notify(
        error?.data?.error || error?.message || "Erreur lors de la réinitialisation du workflow.",
        "error",
        5000
      )
    } finally {
      setIsResettingWorkflowYear(false)
    }
  }

  const handleUpdateRoom = (roomIndex, updates = {}) => {
    try {
      clearValidationState()

      if (!Array.isArray(roomEntries) || !roomEntries[roomIndex]) {
        return
      }

      const updatedRoom = normalizeRoom(
        {
          ...roomEntries[roomIndex],
          ...updates,
          lastUpdate: Date.now()
        },
        roomIndex,
        effectiveConfigData
      )
      const updatedRoomKey = buildPlanningRoomKey(
        updatedRoom?.site,
        updatedRoom?.date,
        updatedRoom?.name || updatedRoom?.nameRoom
      )
      const duplicateRoom = roomEntries.find(
        (room, index) =>
          index !== roomIndex &&
          buildPlanningRoomKey(room?.site, room?.date, room?.name || room?.nameRoom) === updatedRoomKey
      )

      if (duplicateRoom) {
        const roomLabel = compactText(updatedRoom?.name || updatedRoom?.nameRoom) || "sans nom"
        const siteLabel = compactText(updatedRoom?.site).toUpperCase() || "site inconnu"
        const dateLabel = formatRoomDateLabel(updatedRoom?.date) || compactText(updatedRoom?.date) || "date inconnue"
        notify(`La salle ${roomLabel} est déjà utilisée le ${dateLabel} (${siteLabel}).`, "error")
        return
      }

      const updatedRooms = [...roomEntries]
      updatedRooms[roomIndex] = updatedRoom
      setNewRooms(updatedRooms)
      writeJSONValue(STORAGE_KEYS.ORGANIZER_DATA, updatedRooms)

      notify("Salle mise à jour.", "success")
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la salle :", error)
      notify(`Erreur lors de la mise à jour de la salle : ${error.message}`, "error")
    }
  }

  const handleUpdateTpi = async (roomIndex, tpiIndex, updatedTpi) => {
    try {
      const updatedRooms = [...newRooms]
      if (!updatedRooms[roomIndex]?.tpiDatas?.[tpiIndex]) {
        return
      }

      clearValidationState()
      updatedRooms[roomIndex] = {
        ...updatedRooms[roomIndex],
        tpiDatas: [...updatedRooms[roomIndex].tpiDatas]
      }
      updatedRooms[roomIndex].tpiDatas[tpiIndex] = normalizeTpi({
        ...updatedTpi,
        period: tpiIndex + 1
      })

      setNewRooms(updatedRooms)
      await saveDataToLocalStorage(updatedRooms)
    } catch (error) {
      notify(
        `Erreur lors de la mise à jour de la salle de TPI dans le stockage local : ${error}`,
        "error"
      )
    }
  }

  const handleSyncTpiFromGestion = async (roomIndex, tpiIndex) => {
    try {
      const currentTpi = newRooms?.[roomIndex]?.tpiDatas?.[tpiIndex]
      const refKey = normalizeTpiSyncRefKey(currentTpi?.refTpi)

      if (!refKey) {
        notify("Impossible de synchroniser un slot sans référence TPI.", "error")
        return
      }

      const sourceModelsByRef = buildGestionTpiSyncModelMap(availableTpiModels)
      const sourceModel = sourceModelsByRef.get(refKey)

      if (!sourceModel) {
        notify("TPI introuvable dans GestionTPI pour ce slot.", "error")
        return
      }

      const updatedTpi = buildPlanningTpiFromGestionModel(currentTpi, sourceModel)
      await handleUpdateTpi(roomIndex, tpiIndex, updatedTpi)

      notify(`TPI ${updatedTpi.refTpi || currentTpi.refTpi} synchronisé depuis GestionTPI.`, "success")
    } catch (error) {
      console.error("Erreur lors de la synchronisation du TPI :", error)
      notify("Erreur lors de la synchronisation du TPI.", "error")
    }
  }

  const handleSyncAllTpisFromGestion = async () => {
    try {
      const syncEntries = Array.isArray(tpiSyncSummary.entries)
        ? tpiSyncSummary.entries
        : []
      const syncRefs = Array.from(
        new Set(syncEntries.map((entry) => normalizeTpiSyncRefKey(entry?.refTpi)).filter(Boolean))
      )

      if (syncEntries.length === 0 || syncRefs.length === 0) {
        notify("Aucun TPI à synchroniser depuis GestionTPI.", "info")
        return
      }

      const confirmed = typeof window === "undefined"
        ? true
        : window.confirm(
            `Synchroniser ${syncRefs.length} TPI depuis GestionTPI dans la planification ?`
          )

      if (!confirmed) {
        return
      }

      const syncResult = buildRoomsWithGestionTpiSync(
        newRooms,
        syncEntries,
        availableTpiModels,
        { updatedAt: Date.now() }
      )

      if (syncResult.updatedSlotCount === 0) {
        notify("Aucun slot synchronisable trouvé dans la planification.", "error")
        return
      }

      clearValidationState()
      setNewRooms(syncResult.rooms)
      await saveDataToLocalStorage(syncResult.rooms)

      notify(
        `${syncResult.refCount || syncRefs.length} TPI synchronisé(s) depuis GestionTPI dans ${syncResult.updatedSlotCount} slot(s).`,
        "success"
      )
    } catch (error) {
      console.error("Erreur lors de la synchronisation globale GestionTPI :", error)
      notify("Erreur lors de la synchronisation globale des TPI.", "error")
    }
  }

  const toggleEditing = () => {
    setIsEditing((prevIsEditing) => !prevIsEditing)
  }

  // Fonction pour sauvegarder les données dans localStorage
  const saveDataToLocalStorage = (data) => {
    return writeJSONValue(
      STORAGE_KEYS.ORGANIZER_DATA,
      normalizeOrganizerRooms(Array.isArray(data) ? data : [], effectiveConfigData)
    )
  }

  useEffect(() => {
    if (
      !hasLoadedLocalPlanning ||
      !Array.isArray(availableTpiModels) ||
      roomEntries.length === 0
    ) {
      return
    }

    const syncEntries = Array.isArray(tpiSyncSummary.entries)
      ? tpiSyncSummary.entries
      : []

    if (syncEntries.length === 0) {
      gestionTpiSyncNoticeSignatureRef.current = ""
      return
    }

    const syncSignature = syncEntries
      .map((entry) => [
        entry?.slotKey || "",
        normalizeTpiSyncRefKey(entry?.refTpi),
        Array.isArray(entry?.changedFields) ? entry.changedFields.join(",") : ""
      ].join(":"))
      .join("|")

    if (!syncSignature || gestionTpiSyncNoticeSignatureRef.current === syncSignature) {
      return
    }

    gestionTpiSyncNoticeSignatureRef.current = syncSignature
    notify(
      `${tpiSyncSummary.count} TPI à synchroniser depuis GestionTPI. Utilise "Sync tout" pour appliquer les changements.`,
      "info",
      2400
    )
  }, [
    availableTpiModels,
    hasLoadedLocalPlanning,
    notify,
    roomEntries,
    tpiSyncSummary.count,
    tpiSyncSummary.entries
  ])

  // Fonction pour gérer le processus de sauvegarde des données
  const handleSave = async () => {
    // Étape 1: Mettre à jour la propriété lastUpdate pour chaque salle avec la nouvelle date
    const updatedRooms = roomEntries.map((room) => ({
      ...room,
      // Mettre à jour avec la nouvelle date
      lastUpdate: new Date().getTime()
    }))

    // Mettre à jour l'état newRooms avec la liste des salles mises à jour
    setNewRooms(updatedRooms)

    // Sauvegarder les données dans localStorage avec la nouvelle date
    saveDataToLocalStorage(updatedRooms)

    // Afficher le message de sauvegarde avec une durée de 3 secondes
    notify(
      `Configuration ${selectedYear} sauvegardée: ${updatedRooms.length} salle(s).`,
      "success"
    )
  }

  const handleGenerateRoomsFromCatalog = useCallback(() => {
    const availableDates = normalizeSoutenanceDateEntries(soutenanceDates)
      .map((entry) => String(entry?.date || "").trim())
      .filter(Boolean)
    const catalogEntries = Object.entries(roomCatalogBySite || {})
      .map(([site, rooms]) => [
        String(site || "").trim().toUpperCase(),
        Array.isArray(rooms) ? rooms.map((room) => String(room || "").trim()).filter(Boolean) : []
      ])
      .filter(([site, rooms]) => site && rooms.length > 0)

    if (availableDates.length === 0) {
      notify("Aucune date de défense disponible pour générer les salles.", "error")
      return
    }

    if (catalogEntries.length === 0) {
      notify("Aucune salle définie dans Configuration.", "error")
      return
    }

    clearValidationState()
    const normalizedExistingRooms = normalizeOrganizerRooms(roomEntries, effectiveConfigData)
    const existingKeys = new Set(
      normalizedExistingRooms.map((room) =>
        buildPlanningRoomKey(room?.site, room?.date, room?.name || room?.nameRoom)
      )
    )
    const createdRooms = []
    let nextRoomId = Date.now()

    for (const date of availableDates) {
      for (const [site, roomNames] of catalogEntries) {
        for (const roomName of roomNames) {
          const roomKey = buildPlanningRoomKey(site, date, roomName)
          if (existingKeys.has(roomKey)) {
            continue
          }

          existingKeys.add(roomKey)
          createdRooms.push(
            normalizeRoom(
              {
                idRoom: nextRoomId++,
                site,
                date,
                name: roomName,
                year: Number.isInteger(Number(selectedYear)) ? Number(selectedYear) : undefined,
                tpiDatas: []
              },
              normalizedExistingRooms.length + createdRooms.length,
              effectiveConfigData
            )
          )
        }
      }
    }

    if (createdRooms.length === 0) {
      notify("La planification contient déjà toutes les salles configurées.", "info")
      return
    }

    const updatedRooms = [...normalizedExistingRooms, ...createdRooms]
    setNewRooms(updatedRooms)
    writeJSONValue(STORAGE_KEYS.ORGANIZER_DATA, updatedRooms)
    notify(
      `${createdRooms.length} salle(s) de planification générée(s) depuis Configuration.`,
      "success"
    )
  }, [effectiveConfigData, notify, roomCatalogBySite, roomEntries, selectedYear, soutenanceDates])

  const handleCreateManualRoom = useCallback(({ date, nameRoom, site }) => {
    const normalizedDate = String(date || "").trim()
    const normalizedRoomName = String(nameRoom || "").trim()
    const normalizedSite = String(site || "").trim().toUpperCase()

    if (!normalizedDate || !normalizedRoomName || !normalizedSite) {
      notify("Renseigne la date, le site et la salle avant de valider.", "error")
      return
    }

    clearValidationState()
    const normalizedExistingRooms = normalizeOrganizerRooms(roomEntries, effectiveConfigData)
    const roomKey = buildPlanningRoomKey(normalizedSite, normalizedDate, normalizedRoomName)
    const duplicateRoom = normalizedExistingRooms.some((room) =>
      buildPlanningRoomKey(room?.site, room?.date, room?.name || room?.nameRoom) === roomKey
    )

    if (duplicateRoom) {
      notify("Cette room existe déjà pour cette date et ce site.", "error")
      return
    }

    const createdRoom = normalizeRoom(
      {
        idRoom: Date.now(),
        site: normalizedSite,
        date: normalizedDate,
        name: normalizedRoomName,
        year: Number.isInteger(Number(selectedYear)) ? Number(selectedYear) : undefined,
        tpiDatas: []
      },
      normalizedExistingRooms.length,
      effectiveConfigData
    )
    const updatedRooms = [...normalizedExistingRooms, createdRoom]

    setNewRooms(updatedRooms)
    writeJSONValue(STORAGE_KEYS.ORGANIZER_DATA, updatedRooms)
    setIsNewRoomFormOpen(false)
    notify(`Room ${normalizedRoomName} créée pour ${normalizedSite}.`, "success")
  }, [effectiveConfigData, notify, roomEntries, selectedYear])

  const handleExport = async () => {
    if (roomEntries.length === 0) {
      notify(`Aucune salle à exporter pour ${selectedYear}.`, "error")
      return
    }

    try {
      const normalizedRooms = roomEntries.map((room, index) =>
        normalizeRoom(room, index, effectiveConfigData)
      )

      setNewRooms(normalizedRooms)
      saveDataToLocalStorage(normalizedRooms)

      // Conversion des salles mises à jour en format JSON
      const jsonRooms = JSON.stringify(normalizedRooms)

      // Création de l'objet Blob et du lien de téléchargement
      const blob = new Blob([jsonRooms], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = buildPlanningJsonExportFileName(selectedYear)
      link.click()
      URL.revokeObjectURL(url)

      notify(
        `Export JSON créé pour ${selectedYear}: ${normalizedRooms.length} salle(s).`,
        "success"
      )
    } catch (error) {
      console.error("Erreur lors de l'exportation des données :", error)
      notify("Impossible de générer l'export JSON.", "error")
    }
  }

  // Fonction pour charger les données depuis le fichier JSON
  const handleLoadConfig = (jsonData) => {
    try {
      const parsedData = JSON.parse(jsonData)
      const normalizedRooms = normalizeOrganizerRooms(parsedData, effectiveConfigData)

      if (normalizedRooms.length > 0) {
        resetPlanningViewState()
        setNewRooms(normalizedRooms)
        writeJSONValue(STORAGE_KEYS.ORGANIZER_DATA, normalizedRooms)
        const inferredYear = inferPlanningYearFromRooms(normalizedRooms)
        if (Number.isInteger(inferredYear)) {
          setSelectedYear(inferredYear)
        }
        notify(
          `Import JSON réussi: ${normalizedRooms.length} salle(s) chargée(s).`,
          "success"
        )
      } else {
        notify("Le fichier JSON ne contient aucune salle exploitable.", "error")
      }
    } catch (error) {
      console.error("Erreur lors du traitement du fichier JSON :", error)
      notify("Le fichier JSON est invalide ou illisible.", "error")
    }
  }

  const handleDropUnassignedTpi = (sourceTpi, targetTpiID) => {
    const targetId = compactText(targetTpiID)
    const sourceRef = compactText(sourceTpi?.refTpi)

    if (!targetId || !sourceRef) {
      notify("TPI ou slot invalide.", "error")
      return
    }

    const sourceRefKey = normalizeTpiReference(sourceRef)
    if (assignedTpiRefs.some((refTpi) => normalizeTpiReference(refTpi) === sourceRefKey)) {
      notify(`TPI ${sourceRef} déjà attribué dans la planification.`, "error")
      return
    }

    let targetRoomIndex = -1
    let targetTpiIndex = -1

    roomEntries.some((room, roomIndex) => {
      const tpiIndex = Array.isArray(room?.tpiDatas)
        ? room.tpiDatas.findIndex((tpi) => compactText(tpi?.id) === targetId)
        : -1

      if (tpiIndex >= 0) {
        targetRoomIndex = roomIndex
        targetTpiIndex = tpiIndex
        return true
      }

      return false
    })

    if (targetRoomIndex < 0 || targetTpiIndex < 0) {
      notify("Slot cible introuvable.", "error")
      return
    }

    const targetRoom = roomEntries[targetRoomIndex]
    const targetTpi = targetRoom?.tpiDatas?.[targetTpiIndex]
    const targetHasTpi = tpiHasVisibleContent(targetTpi)

    if (targetHasTpi && isTpiPlanningSealed(targetTpi)) {
      notify("Ce TPI est scellé et ne peut pas être remplacé.", "error")
      return
    }

    if (targetHasTpi && typeof window !== "undefined") {
      const targetRef = compactText(targetTpi?.refTpi) || compactText(targetTpi?.candidat) || "ce TPI"
      const confirmed = window.confirm(
        `Remplacer ${targetRef} par ${sourceRef} ? Le TPI remplacé retournera dans la liste à placer.`
      )

      if (!confirmed) {
        return
      }
    }

    const updatedRooms = roomEntries.map((room, roomIndex) => {
      if (roomIndex !== targetRoomIndex) {
        return room
      }

      const tpiDatas = Array.isArray(room?.tpiDatas) ? [...room.tpiDatas] : []
      tpiDatas[targetTpiIndex] = normalizeTpi({
        ...sourceTpi,
        id: targetId,
        period: targetTpiIndex + 1
      })

      return {
        ...room,
        lastUpdate: Date.now(),
        tpiDatas
      }
    })

    clearValidationState()
    setSwapAssistSource(null)
    setNewRooms(updatedRooms)
    saveDataToLocalStorage(updatedRooms)

    notify(
      `TPI ${sourceRef} placé dans ${targetRoom?.name || "la salle"}, créneau ${targetTpiIndex + 1}.`,
      "success"
    )
  }

  const handleUnassignTpiFromPlanning = (sourceTpi) => {
    const sourceId = compactText(sourceTpi?.id)
    const sourceRef = compactText(sourceTpi?.refTpi)
    const sourceRefKey = normalizeTpiReference(sourceRef)

    if (!sourceId && !sourceRefKey) {
      notify("TPI invalide.", "error")
      return
    }

    let targetRoomIndex = -1
    let targetTpiIndex = -1

    roomEntries.some((room, roomIndex) => {
      const tpiDatas = Array.isArray(room?.tpiDatas) ? room.tpiDatas : []
      let tpiIndex = sourceId
        ? tpiDatas.findIndex((tpi) => compactText(tpi?.id) === sourceId)
        : -1

      if (tpiIndex < 0 && sourceRefKey) {
        tpiIndex = tpiDatas.findIndex((tpi) =>
          normalizeTpiReference(tpi?.refTpi) === sourceRefKey
        )
      }

      if (tpiIndex >= 0) {
        targetRoomIndex = roomIndex
        targetTpiIndex = tpiIndex
        return true
      }

      return false
    })

    if (targetRoomIndex < 0 || targetTpiIndex < 0) {
      notify("TPI introuvable dans la planification.", "error")
      return
    }

    const targetRoom = roomEntries[targetRoomIndex]
    const targetTpi = targetRoom?.tpiDatas?.[targetTpiIndex]

    if (!tpiHasVisibleContent(targetTpi)) {
      notify("Ce créneau est déjà vide.", "info")
      return
    }

    if (isTpiPlanningSealed(targetTpi)) {
      notify("Ce TPI est scellé et ne peut pas être retiré.", "error")
      return
    }

    const updatedRooms = roomEntries.map((room, roomIndex) => {
      if (roomIndex !== targetRoomIndex) {
        return room
      }

      const tpiDatas = Array.isArray(room?.tpiDatas) ? [...room.tpiDatas] : []
      tpiDatas[targetTpiIndex] = normalizeTpi({
        ...createEmptyTpi(),
        id: compactText(targetTpi?.id) || sourceId,
        period: targetTpiIndex + 1
      })

      return {
        ...room,
        lastUpdate: Date.now(),
        tpiDatas
      }
    })

    clearValidationState()
    setSwapAssistSource(null)
    setNewRooms(updatedRooms)
    saveDataToLocalStorage(updatedRooms)

    const removedRef = sourceRef || compactText(targetTpi?.refTpi) || "sélectionné"
    notify(`TPI ${removedRef} remis dans la liste à placer.`, "success")
  }

  const handleSelectTpiForSwap = ({ tpi, roomIndex, tpiIndex, slotId }) => {
    if (isEditing || !tpiHasVisibleContent(tpi) || isTpiPlanningSealed(tpi)) {
      return
    }

    const normalizedRoomIndex = Number.parseInt(roomIndex, 10)
    const normalizedTpiIndex = Number.parseInt(tpiIndex, 10)

    if (!Number.isInteger(normalizedRoomIndex) || !Number.isInteger(normalizedTpiIndex)) {
      return
    }

    const room = roomEntries[normalizedRoomIndex]
    const refTpi = compactText(tpi?.refTpi)
    const tpiId = compactText(slotId || tpi?.id)

    if (!room || !tpiId) {
      return
    }

    setSwapAssistSource((current) => {
      if (
        current &&
        current.roomIndex === normalizedRoomIndex &&
        current.tpiIndex === normalizedTpiIndex
      ) {
        return null
      }

      return {
        tpi: normalizeTpi(tpi),
        tpiId,
        refTpi,
        candidat: compactText(tpi?.candidat),
        roomIndex: normalizedRoomIndex,
        tpiIndex: normalizedTpiIndex,
        roomName: compactText(room?.name || room?.nameRoom),
        roomDate: compactText(room?.date).slice(0, 10),
        period: normalizedTpiIndex + 1
      }
    })
  }

  const clearSwapAssistSource = () => {
    setSwapAssistSource(null)
  }

  const handleAssistedSwapToSlot = (targetTpiID) => {
    if (!swapAssistSource) {
      return
    }

    const targetId = compactText(targetTpiID)
    if (!targetId || targetId === swapAssistSource.tpiId) {
      setSwapAssistSource(null)
      return
    }

    let targetRoomIndex = -1
    let targetTpiIndex = -1
    let targetTpi = null
    let targetRoom = null

    roomEntries.some((room, roomIndex) => {
      const tpiIndex = Array.isArray(room?.tpiDatas)
        ? room.tpiDatas.findIndex((tpi) => compactText(tpi?.id) === targetId)
        : -1

      if (tpiIndex >= 0) {
        targetRoomIndex = roomIndex
        targetTpiIndex = tpiIndex
        targetTpi = room.tpiDatas[tpiIndex]
        targetRoom = room
        return true
      }

      return false
    })

    if (targetRoomIndex < 0 || targetTpiIndex < 0) {
      notify("Slot cible introuvable.", "error")
      return
    }

    const sourceTpi = roomEntries?.[swapAssistSource.roomIndex]?.tpiDatas?.[swapAssistSource.tpiIndex] || swapAssistSource.tpi
    if (isTpiPlanningSealed(sourceTpi) || (tpiHasVisibleContent(targetTpi) && isTpiPlanningSealed(targetTpi))) {
      notify("Les TPI scellés ne peuvent pas être déplacés.", "error")
      setSwapAssistSource(null)
      return
    }

    const slotState = getSwapAssistSlotState({
      roomIndex: targetRoomIndex,
      slotIndex: targetTpiIndex,
      roomData: targetRoom,
      tpi: targetTpi
    })

    if (slotState === "blocked") {
      notify("Ce swap est incompatible avec la classe ou la room cible.", "error")
      return
    }

    handleSwapTpiCards(swapAssistSource.tpiId, targetId)
    setSwapAssistSource(null)
  }

  const handleSwapTpiCards = (draggedTpiID, targetTpiID) => {
    // Recherche des salles qui contiennent les TPI correspondants
    const draggedTpiRoomIndex = roomEntries.findIndex((room) =>
      room.tpiDatas.some((tpi) => tpi.id === draggedTpiID)
    )

    const targetTpiRoomIndex = roomEntries.findIndex((room) =>
      room.tpiDatas.some((tpi) => tpi.id === targetTpiID)
    )

    // Vérifier si les TPI et les salles correspondantes ont été trouvés
    if (draggedTpiRoomIndex === -1 || targetTpiRoomIndex === -1) {
      notify("TPI ou salle invalide.", "error")
      return
    }

    // Trouver l'index du tpiDatas correspondant au draggedTpiID et au targetTpiID dans leurs salles respectives
    const draggedTpiRoom = newRooms[draggedTpiRoomIndex]
    const targetTpiRoom = newRooms[targetTpiRoomIndex]

    const draggedTpiIndex = draggedTpiRoom.tpiDatas.findIndex(
      (tpi) => tpi.id === draggedTpiID
    )
    const targetTpiIndex = targetTpiRoom.tpiDatas.findIndex(
      (tpi) => tpi.id === targetTpiID
    )

    // Vérifier si les tpi correspondants ont été trouvés
    if (draggedTpiIndex === -1 || targetTpiIndex === -1) {
      notify("ID de TPI invalide.", "error")
      return
    }

    const draggedSlotTpi = draggedTpiRoom.tpiDatas[draggedTpiIndex]
    const targetSlotTpi = targetTpiRoom.tpiDatas[targetTpiIndex]

    if (
      isTpiPlanningSealed(draggedSlotTpi) ||
      (tpiHasVisibleContent(targetSlotTpi) && isTpiPlanningSealed(targetSlotTpi))
    ) {
      notify("Les TPI scellés ne peuvent pas être déplacés.", "error")
      return
    }

    clearValidationState()
    // Effectuer le swap en utilisant une variable temporaire
    const tempTpi = { ...draggedSlotTpi }
    draggedTpiRoom.tpiDatas[draggedTpiIndex] = {
      ...targetTpiRoom.tpiDatas[targetTpiIndex],
      period: draggedTpiIndex + 1
    }
    targetTpiRoom.tpiDatas[targetTpiIndex] = {
      ...tempTpi,
      period: targetTpiIndex + 1
    }

    // Créer un nouvel objet newRooms avec les modifications effectuées
    const updatedNewRooms = roomEntries.map((room, index) => {
      if (index === draggedTpiRoomIndex) {
        return draggedTpiRoom
      } else if (index === targetTpiRoomIndex) {
        return targetTpiRoom
      } else {
        return room
      }
    })

    // Mettre à jour l'état avec le nouvel objet newRooms
    setNewRooms(updatedNewRooms)
    saveDataToLocalStorage(updatedNewRooms)
  }

  const handleFetchConfig = async (selectedYear, options = {}) => {
    const {
      skipConfirm = false,
      notifyStart = true,
      notifySuccess = true,
      preserveValidation
    } = options

    if (!skipConfirm && roomEntries.length > 0) {
      const confirmed = window.confirm(
        `Charger la configuration ${selectedYear} depuis la BDD va remplacer la planification locale actuelle (${roomEntries.length} salle(s)). Continuer ?`
      )

      if (!confirmed) {
        notify(`Chargement ${selectedYear} annulé.`, "info")
        return false
      }
    }

    if (notifyStart) {
      notify(`Chargement de la configuration ${selectedYear} depuis la BDD...`)
    }

    try {
      const response = await fetch(`${apiUrl}/api/tpiRoomYear/${selectedYear}`)

      if (!response.ok) {
        throw new Error("Erreur lors de la récupération de la configuration.")
      }

      const roomConfigData = await response.json() // Convertir la réponse en JSON
      const normalizedRooms = normalizeOrganizerRooms(roomConfigData, effectiveConfigData)

      removeStorageValue(STORAGE_KEYS.ORGANIZER_DATA)
      writeJSONValue(STORAGE_KEYS.ORGANIZER_DATA, normalizedRooms)
      resetPlanningViewState()
      setNewRooms(normalizedRooms)
      if (Object.prototype.hasOwnProperty.call(options, "preserveValidation")) {
        setValidationResult(preserveValidation)
      }
      const requestedYear = Number.parseInt(selectedYear, 10)
      const inferredYear = inferPlanningYearFromRooms(normalizedRooms)
      setSelectedYear(
        Number.isInteger(requestedYear)
          ? requestedYear
          : Number.isInteger(inferredYear)
            ? inferredYear
            : YEARS_CONFIG.getCurrentYear()
      )
      if (notifySuccess) {
        notify(
          `Configuration ${selectedYear} chargée depuis la BDD: ${normalizedRooms.length} salle(s).`,
          "success"
        )
      }
      return true
    } catch (error) {
      console.error("Erreur lors du chargement de la configuration:", error)
      notify(`Impossible de charger la configuration ${selectedYear} depuis la BDD.`, "error", 3500)
      return false
    }
  }

  useEffect(() => {
    if (!hasLoadedLocalPlanning || !requestedYear || requestedYear === Number(selectedYear)) {
      return
    }

    handleYearChangeRequest(requestedYear)
  }, [hasLoadedLocalPlanning, requestedYear, roomEntries.length, selectedYear])

  const handleTransmitToDatabase = async () => {
    let roomsData

    try {
      if (roomEntries.length === 0) {
        throw new Error("Aucune salle à synchroniser vers la BDD.")
      }

      const confirmed = window.confirm(
        `Synchroniser ${selectedYear} vers la BDD va écraser la version distante avec ${roomEntries.length} salle(s). Continuer ?`
      )

      if (!confirmed) {
        notify(`Synchronisation ${selectedYear} annulée.`, "info")
        return
      }

      roomsData = normalizeOrganizerRooms(roomEntries, effectiveConfigData).map((room) => ({
        ...room,
        lastUpdate: new Date().getTime()
      }))

      setNewRooms(roomsData)
      writeJSONValue(STORAGE_KEYS.ORGANIZER_DATA, roomsData)

      notify(`Synchronisation BDD ${selectedYear} en cours avec vérification complète...`, "info", 2200)

      const result = await replacePlanningRoomsInDatabase(selectedYear, roomsData)

      if (!result?.exactMatch) {
        throw new Error("La vérification BDD a échoué: la base ne correspond pas à l'écran.")
      }

      const roomCount = Number(result.roomCount ?? roomsData.length)
      const tpiCount = Number(result.tpiCount ?? 0)
      const successMessage = `Sauvegarde BDD ${selectedYear} vérifiée à 100%: ${roomCount} salle(s), ${tpiCount} TPI.`

      notify(
        successMessage,
        "success",
        5000
      )

      if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert(successMessage)
      }
    } catch (error) {
      console.error("Erreur lors de la transmission des données :", error)
      notify(error.message || "Erreur lors de la synchronisation vers la BDD.", "error")
    }
  }

  const isRoomsWrapModeEffective = isRoomsFocusMode || isRoomsWrapMode

  return (
    <div
      ref={planningPageRef}
      className={`planning-schedule-page ${isRoomsFocusMode ? "planning-schedule-page--focus" : ""} ${isRoomsWrapModeEffective ? "planning-schedule-page--wrap" : ""}`.trim()}
    >
      {!isRoomsFocusMode ? (
        <TpiScheduleButtons
          configData={effectiveConfigData}
          selectedYear={selectedYear}
          availableYears={YEARS_CONFIG.getAvailableYears()}
          onToggleEditing={toggleEditing}
          onDeleteAllRooms={handleDeleteAllRooms}
          onSave={handleSave}
          onSendBD={handleTransmitToDatabase}
          onExport={handleExport}
          onPublish={handlePublish}
          onLoadConfig={handleLoadConfig}
          onFetchConfig={handleFetchConfig}
          workflowState={workflowState}
          activeSnapshotVersion={activeSnapshotVersion}
          workflowActionLoading={workflowActionLoading}
          pendingWorkflowAction={pendingWorkflowAction}
          validationResult={validationResult}
          validationOptimizationProposal={validationOptimizationProposal}
          validationOptimizationSettings={validationOptimizationSettings}
          onValidationOptimizationSettingsChange={handleValidationOptimizationSettingsChange}
          onApplyValidationOptimization={handleApplyValidationOptimization}
          onAutomatePlanification={handleAutomatePlanification}
          onValidatePlanification={handleValidatePlanification}
          onFreezeSnapshot={handleFreezeSnapshot}
          onOpenVotes={handleOpenVotes}
          onOpenVotesWithoutEmails={handleOpenVotesWithoutEmails}
          onOpenVoteAccessPreview={handleOpenVoteAccessPreview}
          onRemindVotes={handleRemindVotes}
          onCloseVotes={handleCloseVotes}
          onPublishDefinitive={handlePublishDefinitive}
          onDeactivatePublication={handleDeactivatePublication}
          workflowPhases={workflowPhases}
          onWorkflowPhaseToggle={handleWorkflowPhaseToggle}
          onSendSoutenanceLinks={handleSendSoutenanceLinks}
          onGenerateStaticPublication={handleGenerateStaticPublication}
          onPreviewStaticPublication={handlePreviewStaticPublication}
          onPublishStaticPublication={handlePublishStaticPublication}
          staticPublicationInfo={staticPublicationInfo}
          onGenerateStaticVotePublication={handleGenerateStaticVotePublication}
          onPublishStaticVotePublication={handlePublishStaticVotePublication}
          onSyncStaticVotePublication={handleSyncStaticVotePublication}
          staticVotePublicationInfo={staticVotePublicationInfo}
          onOpenVotesTracking={handleOpenVoteTracking}
          onOpenSoutenances={() => {
            const normalizedYear = Number.parseInt(selectedYear, 10)
            if (!Number.isInteger(normalizedYear)) {
              return
            }

            navigate(`${ROUTES.SOUTENANCES}/${normalizedYear}`)
          }}
          roomsCount={visibleRooms.length}
          totalRoomsCount={roomEntries.length}
          usedTpiCount={tpiUsageSummary.usedTpiCount}
          totalTpiCount={tpiUsageSummary.totalTpiCount}
          tpiSyncCount={tpiSyncCount}
          isTpiSyncRefreshing={isRefreshingTpiSyncStatus}
          onRefreshTpiSyncStatus={handleRefreshTpiSyncStatus}
          onSyncAllTpisFromGestion={handleSyncAllTpisFromGestion}
          nonImportableTpiCount={nonImportableTpiRefs.length}
          localConflictCount={localConflictSummary.conflictCount}
          tpiCardDetailLevel={tpiCardDetailLevel}
          onTpiCardDetailLevelChange={setTpiCardDetailLevel}
          soutenanceDates={soutenanceDates}
          roomFilters={roomFilters}
          roomSiteOptions={roomSiteOptions}
          roomDateOptions={roomDateOptions}
          roomNameOptions={roomNameOptions}
          onRoomFiltersChange={updateRoomFilters}
          onClearRoomFilters={clearRoomFilters}
          roomCatalogBySite={roomCatalogBySite}
          onGenerateRoomsFromCatalog={handleGenerateRoomsFromCatalog}
          onShowNewRoomForm={() => setIsNewRoomFormOpen(true)}
          onCreateRoom={handleCreateManualRoom}
          onCancelCreateRoom={() => setIsNewRoomFormOpen(false)}
          showNewRoomForm={isNewRoomFormOpen}
          existingRooms={roomEntries}
          roomsHashAtFreeze={roomsHashAtFreeze}
          currentRoomsHash={JSON.stringify(newRooms.map(r => ({ name: r.name, date: r.date, tpiCount: r.tpiDatas?.length || 0 })))}
          isRoomsFocusMode={isRoomsFocusMode}
          isRoomsWrapMode={isRoomsWrapMode}
          isRoomsChronologicalSortMode={isRoomsChronologicalSortMode}
          onToggleRoomsFocusMode={toggleRoomsFocusMode}
          onToggleRoomsWrapMode={toggleRoomsWrapMode}
          onToggleRoomsChronologicalSortMode={toggleRoomsChronologicalSortMode}
          toggleArrow={toggleArrow}
          isArrowUp={isArrowUp}
        />
      ) : null}

      {Number.isInteger(pendingYearChange) && typeof document !== "undefined"
        ? createPortal(
            <div
              className="planning-year-change-overlay"
              role="presentation"
              onClick={isReplacingPlanningYear ? undefined : handleCancelYearChange}
            >
              <div
                className="planning-year-change-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="planning-year-change-title"
                aria-describedby="planning-year-change-description"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="planning-year-change-close icon-button"
                  aria-label="Fermer"
                  title="Fermer"
                  onClick={handleCancelYearChange}
                  disabled={isReplacingPlanningYear}
                >
                  <IconButtonContent label='Fermer' icon={CloseIcon} />
                </button>
                <div className="planning-year-change-icon" aria-hidden="true">
                  <AlertIcon />
                </div>
                <div className="planning-year-change-copy">
                  <h3 id="planning-year-change-title">Remplacer la planification ?</h3>
                  <p id="planning-year-change-description">
                    La planification courante va être effacée puis remplacée par celle de l’année{" "}
                    <strong>{pendingYearChange}</strong>.
                  </p>
                </div>

                <div className="planning-year-change-summary">
                  <div className="planning-year-change-summary-item">
                    <span>Courante</span>
                    <strong>{selectedYear}</strong>
                  </div>
                  <div className="planning-year-change-summary-item">
                    <span>Nouvelle</span>
                    <strong>{pendingYearChange}</strong>
                  </div>
                </div>

                <p className="planning-year-change-note">
                  Les salles, filtres et validations en mémoire seront remplacés par la configuration
                  de l’année sélectionnée.
                </p>

                <div className="planning-year-change-actions">
                  <button
                    type="button"
                    className="planning-year-change-btn secondary icon-button"
                    onClick={handleCancelYearChange}
                    disabled={isReplacingPlanningYear}
                    aria-label="Annuler"
                    title="Annuler"
                  >
                    <IconButtonContent label='Annuler' icon={CloseIcon} />
                  </button>
                  <button
                    type="button"
                    className="planning-year-change-btn primary icon-button"
                    onClick={confirmYearChange}
                    disabled={isReplacingPlanningYear}
                    aria-label={isReplacingPlanningYear ? "Chargement..." : "Planifier et remplacer"}
                    title={isReplacingPlanningYear ? "Chargement..." : "Planifier et remplacer"}
                  >
                    <IconButtonContent
                      label={isReplacingPlanningYear ? "Chargement..." : "Planifier et remplacer"}
                      icon={isReplacingPlanningYear ? TimeIcon : ArrowRightIcon}
                    />
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {isDeleteAllRoomsDialogOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="planning-year-change-overlay planning-delete-rooms-overlay"
              role="presentation"
              onClick={isResettingWorkflowYear ? undefined : handleCancelDeleteAllRooms}
            >
              <div
                className="planning-year-change-dialog planning-delete-rooms-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="planning-delete-rooms-title"
                aria-describedby="planning-delete-rooms-description"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="planning-year-change-close icon-button"
                  aria-label="Fermer"
                  title="Fermer"
                  onClick={handleCancelDeleteAllRooms}
                  disabled={isResettingWorkflowYear}
                >
                  <IconButtonContent label='Fermer' icon={CloseIcon} />
                </button>
                <div className="planning-year-change-icon planning-delete-rooms-icon" aria-hidden="true">
                  <AlertIcon />
                </div>
                <div className="planning-year-change-copy">
                  <h3 id="planning-delete-rooms-title">Supprimer toutes les rooms ?</h3>
                  <p id="planning-delete-rooms-description">
                    Choisis si c’est une erreur, un simple nettoyage local, ou une réinitialisation complète de l’année{" "}
                    <strong>{selectedYear}</strong>.
                  </p>
                </div>

                <div className="planning-year-change-summary planning-delete-rooms-summary">
                  <div className="planning-year-change-summary-item">
                    <span>Rooms locales</span>
                    <strong>{roomEntries.length}</strong>
                  </div>
                  <div className="planning-year-change-summary-item">
                    <span>Phases</span>
                    <strong>{activeWorkflowPhaseLabel}</strong>
                  </div>
                  <div className="planning-year-change-summary-item">
                    <span>Snapshot</span>
                    <strong>{activeSnapshotVersion ? `v${activeSnapshotVersion}` : "aucun"}</strong>
                  </div>
                </div>

                <div className="planning-delete-rooms-choices">
                  <button
                    type="button"
                    className="planning-delete-rooms-choice secondary"
                    onClick={handleCancelDeleteAllRooms}
                    disabled={isResettingWorkflowYear}
                  >
                    <span className="planning-delete-rooms-choice-main">
                      <CloseIcon className="ui-button-icon" />
                      <span>Annuler</span>
                    </span>
                    <span className="planning-delete-rooms-choice-detail">
                      Erreur de clic, ne rien changer.
                    </span>
                  </button>
                  <button
                    type="button"
                    className="planning-delete-rooms-choice warning"
                    onClick={handleDeleteRoomsOnly}
                    disabled={isResettingWorkflowYear || roomEntries.length === 0}
                  >
                    <span className="planning-delete-rooms-choice-main">
                      <TrashIcon className="ui-button-icon" />
                      <span>Rooms uniquement</span>
                    </span>
                    <span className="planning-delete-rooms-choice-detail">
                      Efface seulement la vue locale; les phases restent inchangées.
                    </span>
                  </button>
                  <button
                    type="button"
                    className="planning-delete-rooms-choice danger"
                    onClick={handleRestartWorkflowYear}
                    disabled={isResettingWorkflowYear}
                  >
                    <span className="planning-delete-rooms-choice-main">
                      {isResettingWorkflowYear ? (
                        <TimeIcon className="ui-button-icon" />
                      ) : (
                        <RefreshIcon className="ui-button-icon" />
                      )}
                      <span>{isResettingWorkflowYear ? "Redémarrage..." : "Recommencer"}</span>
                    </span>
                    <span className="planning-delete-rooms-choice-detail">
                      Réinitialise rooms, votes, snapshots, publication et phases annuelles.
                    </span>
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {roomEntries.length === 0 ? (
        <div className='planning-empty-state'>
          <h2>Aucune salle chargée</h2>
          <p>
            Aucune planification compatible en local.
          </p>
          <p>Prépare dates, sites et salles dans Configuration.</p>
          <button
            type='button'
            className='icon-button'
            onClick={() => navigate("/configuration")}
            aria-label='Ouvrir Configuration'
            title='Ouvrir Configuration'
          >
            <IconButtonContent label='Ouvrir Configuration' icon={ConfigurationIcon} />
          </button>
          {activeWorkflowPhaseLabel !== "Planification" || activeSnapshotVersion ? (
            <button
              type='button'
              className='icon-button'
              onClick={() => setIsDeleteAllRoomsDialogOpen(true)}
              aria-label='Recommencer les phases'
              title='Recommencer les phases'
            >
              <IconButtonContent label='Recommencer phases' icon={RefreshIcon} />
            </button>
          ) : null}
        </div>
      ) : visibleRooms.length === 0 ? (
        <div className='planning-empty-state'>
          <h2>Aucune salle correspondante</h2>
          <p>
            Aucune colonne pour ces filtres.
          </p>
          <p>Réinitialise site, date ou salle.</p>
          <button
            type='button'
            className='icon-button'
            onClick={clearRoomFilters}
            aria-label='Réinitialiser les filtres'
            title='Réinitialiser les filtres'
          >
            <IconButtonContent label='Réinitialiser les filtres' icon={RefreshIcon} />
          </button>
        </div>
      ) : (
        <DndProvider backend={HTML5Backend}>
          {!isRoomsFocusMode && swapAssistSource ? (
            <div className='planning-swap-assist-bar' role='status'>
              <div className='planning-swap-assist-copy'>
                <span>Échange</span>
                <strong>
                  {[swapAssistSource.refTpi, swapAssistSource.candidat].filter(Boolean).join(" · ") || "TPI sélectionné"}
                </strong>
                <em>
                  {[swapAssistSource.roomDate, swapAssistSource.roomName, `slot ${swapAssistSource.period}`].filter(Boolean).join(" · ")}
                </em>
              </div>
              <button
                type='button'
                className='planning-swap-assist-clear icon-button'
                onClick={clearSwapAssistSource}
                aria-label='Annuler la sélection de swap'
                title='Annuler la sélection de swap'
              >
                <IconButtonContent label='Annuler la sélection de swap' icon={CloseIcon} />
              </button>
            </div>
          ) : null}
          <div className='planning-assignment-workbench'>
            {!isRoomsFocusMode ? (
              <TpiAssignmentPanel
                unassignedTpis={unassignedTpiQueue}
                problemItems={planningProblemItems}
                isLoading={!Array.isArray(planifiableTpiModels)}
                isDragDisabled={isEditing}
                onUnassignTpi={handleUnassignTpiFromPlanning}
                onRefresh={handleRefreshTpiSyncStatus}
              />
            ) : null}
            <div id='rooms' ref={roomsContainerRef}>
              {visibleRooms.map((room) => {
                const originalIndex = roomEntries.findIndex((candidate) => candidate.idRoom === room.idRoom)

                return (
                  <DateRoom
                    key={room.idRoom ?? originalIndex}
                    roomIndex={originalIndex >= 0 ? originalIndex : 0}
                    roomData={room}
                    isEditOfRoom={isEditing}
                    onUpdateRoom={handleUpdateRoom}
                    tpiCardDetailLevel={tpiCardDetailLevel}
                    peopleRegistry={peopleRegistry}
                    stakeholderShortIdHints={stakeholderShortIdHints}
                    soutenanceDates={soutenanceDates}
                    roomCatalogBySite={roomCatalogBySite}
                    allRooms={roomEntries}
                    tpiSyncEntriesBySlotKey={tpiSyncEntriesBySlotKey}
                    onSyncTpiFromGestion={handleSyncTpiFromGestion}
                    onUpdateTpi={(tpiIndex, updatedTpi) =>
                      handleUpdateTpi(originalIndex >= 0 ? originalIndex : 0, tpiIndex, updatedTpi)
                    }
                    onSwapTpiCards={(draggedTpi, targetTpi) =>
                      handleSwapTpiCards(draggedTpi, targetTpi)
                    }
                    swapAssistSource={swapAssistSource}
                    getSwapAssistSlotState={getSwapAssistSlotState}
                    onSelectTpiForSwap={handleSelectTpiForSwap}
                    onAssistedSwapToSlot={handleAssistedSwapToSlot}
                    onDropUnassignedTpi={(sourceTpi, targetTpi) =>
                      handleDropUnassignedTpi(sourceTpi, targetTpi)
                    }
                    onDelete={() => handleDelete(room.idRoom)}
                    validationMarkersBySlotKey={validationMarkersBySlotKey}
                  />
                )
              })}
            </div>
          </div>
        </DndProvider>
      )}
    </div>
  )
}
export default TpiSchedule
