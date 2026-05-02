import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { DndProvider } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"
import { useNavigate } from "react-router-dom"
import { toast } from "react-toastify"

import TpiScheduleButtons from "./TpiScheduleButtons"
import { showNotification } from "../Tools"
import { personService, workflowPlanningService } from "../../services/planningService"
import { getTpiModels } from "../tpiControllers/TpiController"

import {
  createTpiCollectionForYear,
  publishSoutenancesFromPlanning,
  transmitToDatabase
} from "../tpiControllers/TpiRoomsController"

import DateRoom from "./DateRoom"
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
  normalizeOrganizerRooms,
  normalizeRoom,
  normalizeTpi
} from "./tpiScheduleData"
import {
  normalizeSoutenanceDateEntries,
} from "./soutenanceDateUtils"
import { ROUTES } from "../../config/appConfig"
import {
  optimizePlanningRooms,
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
import { API_URL, IS_DEBUG, STORAGE_KEYS, YEARS_CONFIG } from "../../config/appConfig"
import { planningCatalogService, planningConfigService } from "../../services/planningService"
import {
  readJSONListValue,
  readStorageValue,
  removeStorageValue,
  writeJSONValue,
  writeStorageValue
} from "../../utils/storage"
import {
  buildOptimizationToast,
  buildValidationToast,
  extractValidationResultFromError
} from "../../utils/workflowFeedback"
import { getPlanningPerimeterState } from "../../utils/planningScopeUtils"

const apiUrl = API_URL
const shouldLogWorkflowDebug = IS_DEBUG && process.env.NODE_ENV !== "test"

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

function getInitialSelectedYear() {
  const savedRooms = readJSONListValue(STORAGE_KEYS.ORGANIZER_DATA, [], [
    "organizerData"
  ])
  const inferredYear = inferPlanningYearFromRooms(savedRooms)

  if (Number.isInteger(inferredYear)) {
    return inferredYear
  }

  const storedYear = Number.parseInt(
    readStorageValue(STORAGE_KEYS.PLANNING_SELECTED_YEAR, ""),
    10
  )

  if (Number.isInteger(storedYear)) {
    return storedYear
  }

  return YEARS_CONFIG.getCurrentYear()
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
  const navigate = useNavigate()
  const [selectedYear, setSelectedYear] = useState(() => getInitialSelectedYear())
  const [configData, setConfigData] = useState(() =>
    buildPlanningConfigForYear({}, getInitialSelectedYear())
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
  const previousRoomsFocusModeRef = useRef(false)
  const roomsWrapModeBeforeFocusRef = useRef(null)
  const roomsContainerRef = useRef(null)
  const [workflowState, setWorkflowState] = useState("planning")
  const [activeSnapshotVersion, setActiveSnapshotVersion] = useState(null)
  // Hash des salles au moment du dernier gel (pour détecter les modifications)
  const [roomsHashAtFreeze, setRoomsHashAtFreeze] = useState(null)
  const [validationResult, setValidationResult] = useState(null)
  const [workflowActionLoading, setWorkflowActionLoading] = useState(false)
  const [pendingWorkflowAction, setPendingWorkflowAction] = useState("")
  const [staticPublicationInfo, setStaticPublicationInfo] = useState(null)
  const [pendingYearChange, setPendingYearChange] = useState(null)
  const [isReplacingPlanningYear, setIsReplacingPlanningYear] = useState(false)
  const [isDeleteAllRoomsDialogOpen, setIsDeleteAllRoomsDialogOpen] = useState(false)
  const [isResettingWorkflowYear, setIsResettingWorkflowYear] = useState(false)
  const [soutenanceDates, setSoutenanceDates] = useState(defaultSoutenanceDates)
  const [roomCatalogBySite, setRoomCatalogBySite] = useState(defaultRoomCatalogBySite)
  const [availableTpiModels, setAvailableTpiModels] = useState(null)
  const [peopleRegistry, setPeopleRegistry] = useState(null)
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

  // TPI placés dans les salles mais qui ne peuvent pas être importés lors du gel.
  const nonImportableTpiRefs = useMemo(() => getNonImportableTpiRefs(roomEntries), [roomEntries])

  const localConflictSummary = useMemo(() => {
    return summarizeLocalPersonConflicts(roomEntries)
  }, [roomEntries])

  const validationMarkersBySlotKey = useMemo(() => {
    return buildValidationMarkers(roomEntries, validationResult, localConflictSummary)
  }, [roomEntries, validationResult, localConflictSummary])

  const notify = useCallback((message, type = "info", duration = 3000) => {
    showNotification(message, type, duration)
  }, [])

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
        const remoteConfig = await planningConfigService.getByYear(year)

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

    const shouldLoadPeopleRegistry = [0, 2, 3].includes(Number(tpiCardDetailLevel))

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
          typeof planningCatalogService?.getGlobal === "function"
            ? await planningCatalogService.getGlobal()
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
      writeStorageValue(
        STORAGE_KEYS.PLANNING_SELECTED_YEAR,
        String(Number(selectedYear))
      )
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
      new Set(
        roomEntries
          .map((room) => compactText(room?.date))
          .filter(Boolean)
      )
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
    const dateFilter = String(roomFilters.date || "").trim().toLowerCase()

    return Array.from(
      new Set(
        roomEntries
          .filter((room) => {
            const roomSite = String(room?.site || "").trim().toLowerCase()
            const roomDate = String(room?.date || "").trim().toLowerCase()

            const matchesSite = !siteFilter || roomSite === siteFilter
            const matchesDate = !dateFilter || roomDate === dateFilter

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
  }, [roomEntries, roomFilters.site, roomFilters.date])

  const visibleRooms = useMemo(() => {
    const siteFilter = String(roomFilters.site || "").trim().toLowerCase()
    const dateFilter = String(roomFilters.date || "").trim()
    const roomFilter = String(roomFilters.room || "").trim().toLowerCase()

    return roomEntries.filter((room) => {
      const roomSite = String(room?.site || "").trim().toLowerCase()
      const roomDate = String(room?.date || "").trim()
      const roomName = String(room?.name || room?.nameRoom || "").trim().toLowerCase()

      const matchesSite = !siteFilter || roomSite === siteFilter
      const matchesDate = !dateFilter || roomDate === dateFilter || roomDate.startsWith(dateFilter)
      const matchesRoom = !roomFilter || roomName === roomFilter

      return matchesSite && matchesDate && matchesRoom
    })
  }, [roomEntries, roomFilters])

  const updateRoomFilters = (patch) => {
    setRoomFilters((prev) => ({
      ...prev,
      ...patch
    }))
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

  const toggleRoomsFocusMode = useCallback(() => {
    setIsRoomsFocusMode((prev) => !prev)
  }, [])

  const toggleRoomsWrapMode = useCallback(() => {
    setIsRoomsWrapMode((prev) => !prev)
  }, [])

  useEffect(() => {
    const wasFocused = previousRoomsFocusModeRef.current

    if (!wasFocused && isRoomsFocusMode) {
      roomsWrapModeBeforeFocusRef.current = isRoomsWrapMode

      if (!isRoomsWrapMode) {
        setIsRoomsWrapMode(true)
      }

      setIsEditing(false)
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
        setIsRoomsFocusMode(false)
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [isRoomsFocusMode])

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
        safePromise(workflowPlanningService.getYearState, year).catch((error) => {
          console.warn("Erreur chargement état workflow:", error?.status, error?.message)
          return null
        }),
        safePromise(workflowPlanningService.getActiveSnapshot, year).catch((error) => {
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

      const snapshotVersion = snapshot?.version || null
      setActiveSnapshotVersion(snapshotVersion)

      if (shouldLogWorkflowDebug) {
        console.log(`[Workflow] année=${year} state=${nextState} snapshot=v${snapshotVersion || "aucun"}`)
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
    if (typeof workflowPlanningService.getStaticPublicationStatus !== "function") {
      return null
    }

    try {
      const status = await workflowPlanningService.getStaticPublicationStatus(year)
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

  const handleValidatePlanification = async () => {
    const loadingToastId = toast.loading(`Vérification ${selectedYear} en cours...`, {
      position: "top-center"
    })

    const optimization = optimizePlanningRooms(roomEntries, {
      soutenanceDates
    })
    const roomsToValidate = optimization.changed ? optimization.rooms : roomEntries

    if (optimization.changed) {
      clearValidationState()
      setNewRooms(roomsToValidate)
      saveDataToLocalStorage(roomsToValidate)
    }

    const result = await executeWorkflowAction({
      actionKey: "validate",
      run: () => workflowPlanningService.validatePlanification(selectedYear, false, roomsToValidate),
      successMessage: null,
      showSuccessNotification: false,
      showErrorNotification: false,
      onSuccess: (validationResult) => {
        const nextValidationResult = buildValidationResultFromSources(
          selectedYear,
          validationResult,
          optimization.after
        )
        setValidationResult(nextValidationResult)
        const validationToast = buildValidationToast(selectedYear, {
          ...validationResult,
          ...nextValidationResult
        })
        const optimizationToast = optimization.changed
          ? buildOptimizationToast(selectedYear, {
              optimization
            })
          : null
        toast.update(loadingToastId, {
          render: optimizationToast
            ? `${optimizationToast.message} ${validationToast.message}`
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

  const handleAutomatePlanification = async () => {
    const result = await executeWorkflowAction({
      actionKey: "autoPlan",
      confirmMessage: `Reconstruire automatiquement la planification ${selectedYear} ? La version locale actuelle sera remplacée par la version générée selon la configuration annuelle.`,
      run: () => workflowPlanningService.automatePlanification(selectedYear),
      successMessage: (payload) => {
        const summary = payload?.summary || {}
        const syncSummary = payload?.sync || {}
        const plannedCount = Number(summary.plannedCount || 0)
        const manualRequiredCount = Number(summary.manualRequiredCount || 0)
        const roomCount = Number(summary.legacyRoomCount || summary.roomCount || 0)
        const syncCreatedCount = Number(syncSummary.createdCount || 0)
        const syncPrefix = syncCreatedCount > 0
          ? `${syncCreatedCount} TPI intégré(s) depuis GestionTPI dans le workflow. `
          : ''

        return `${syncPrefix}Planification automatique terminée: ${plannedCount} TPI placés, ${manualRequiredCount} manuel(s), ${roomCount} salle(s).`
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
      run: () => workflowPlanningService.freezePlanification(selectedYear, false, newRooms),
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
    const result = await executeWorkflowAction({
      actionKey: "startVotes",
      confirmMessage: "Confirmer l ouverture de la campagne de votes ?",
      run: () => workflowPlanningService.startVotes(selectedYear, newRooms),
      successMessage: (result) => {
        const tpiCount = result?.tpiCount || 0
        const successfulEmails = result?.successfulEmails || 0
        const totalEmails = result?.totalEmails || 0
        const emailSuffix = successfulEmails < totalEmails
          ? ` Attention: ${totalEmails - successfulEmails} envoi(s) ont échoué.`
          : ''

        return `Campagne ouverte: ${tpiCount} TPI synchronises, ${successfulEmails}/${totalEmails} emails envoyes.${emailSuffix}`
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
  }

  const handleOpenVotesWithoutEmails = async () => {
    if (!IS_DEBUG) {
      return
    }

    const result = await executeWorkflowAction({
      actionKey: "startVotesNoEmail",
      confirmMessage: "Confirmer l ouverture de la campagne de votes sans envoyer d emails ?",
      run: () => workflowPlanningService.startVotesWithoutEmails(selectedYear, newRooms),
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
  }

  const handleRemindVotes = async () => {
    await executeWorkflowAction({
      actionKey: "remindVotes",
      run: () => workflowPlanningService.remindVotes(selectedYear),
      successMessage: (result) =>
        `Relances envoyees: ${result?.emailsSucceeded || 0}/${result?.emailsSent || 0}.`
    })
  }

  const handleCloseVotes = async () => {
    await executeWorkflowAction({
      actionKey: "closeVotes",
      confirmMessage: "Confirmer la cloture des votes ?",
      run: () => workflowPlanningService.closeVotes(selectedYear),
      successMessage: (result) =>
        `Cloture terminee: ${result?.confirmedCount || 0} confirmes, ${result?.manualRequiredCount || 0} manuels.`
    })
  }

  const handlePublishDefinitive = async () => {
    await executeWorkflowAction({
      actionKey: "publish",
      confirmMessage: "Confirmer la publication definitive ?",
      run: () => workflowPlanningService.publishDefinitive(selectedYear),
      successMessage: (result) =>
        `${result?.message || "Publication terminee."} Liens: ${result?.sentLinks?.emailsSucceeded || 0}/${result?.sentLinks?.emailsSent || 0}.`
    })
  }

  const handleSendSoutenanceLinks = async () => {
    await executeWorkflowAction({
      actionKey: "sendLinks",
      run: () => workflowPlanningService.sendPublicationLinks(selectedYear),
      successMessage: (result) =>
        `Liens défense envoyes: ${result?.sentLinks?.emailsSucceeded || 0}/${result?.sentLinks?.emailsSent || 0}.`
    })
  }

  const handleGenerateStaticPublication = async () => {
    await executeWorkflowAction({
      actionKey: "staticGenerate",
      run: () => workflowPlanningService.generateStaticPublication(selectedYear),
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

    await executeWorkflowAction({
      actionKey: "staticPublish",
      confirmMessage: `Publier la page statique générée sur ${publicationTargetLabel} par FTP ?`,
      run: () => workflowPlanningService.publishStaticPublication(selectedYear),
      successMessage: (result) =>
        `Publication FTP réussie: ${result?.defenseCount || 0} défense(s) en ligne${result?.publicUrl ? ` sur ${result.publicUrl}.` : "."}`,
      onSuccess: (result) => {
        const publishedAt = result?.publishedAt || new Date().toISOString()
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

  const handleOpenVoteTracking = () => {
    navigate(`/planning/${selectedYear}?tab=votes`)
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
      const planningPublication = await publishSoutenancesFromPlanning(year)

      if (planningPublication?.count > 0) {
        if (Number.isInteger(normalizedYear)) {
          navigate(soutenancePageUrl)
        }
        notify(
          `Les défenses confirmées ont été publiées depuis le planning. Voir: ${soutenancePageUrl}`,
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
        "Aucune défense confirmée dans le planning et aucune salle legacy à publier.",
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
      console.error("Erreur lors de la suppression complète du planning :", error)
      notify(`Erreur lors de la suppression complète du planning : ${error.message}`, "error")
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
    notify(`${roomCount} salle(s) supprimée(s) du planning ${selectedYear}.`, "success")
  }

  const handleRestartWorkflowYear = async () => {
    if (isResettingWorkflowYear) {
      return
    }

    const roomCount = roomEntries.length
    setIsResettingWorkflowYear(true)

    try {
      const result = await workflowPlanningService.resetYear(selectedYear)
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
      updatedRooms[roomIndex].tpiDatas[tpiIndex] = normalizeTpi(updatedTpi)

      setNewRooms(updatedRooms)
      await saveDataToLocalStorage(updatedRooms)
    } catch (error) {
      notify(
        `Erreur lors de la mise à jour de la salle de TPI dans le stockage local : ${error}`,
        "error"
      )
    }
  }

  const toggleEditing = () => {
    setIsEditing((prevIsEditing) => !prevIsEditing)
  }

  // Fonction pour sauvegarder les données dans localStorage
  const saveDataToLocalStorage = (data) => {
    return writeJSONValue(STORAGE_KEYS.ORGANIZER_DATA, Array.isArray(data) ? data : [])
  }

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
      notify("Le planning contient déjà toutes les salles configurées.", "info")
      return
    }

    const updatedRooms = [...normalizedExistingRooms, ...createdRooms]
    setNewRooms(updatedRooms)
    writeJSONValue(STORAGE_KEYS.ORGANIZER_DATA, updatedRooms)
    notify(
      `${createdRooms.length} salle(s) de planning générée(s) depuis Configuration.`,
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

    clearValidationState()
    // Effectuer le swap en utilisant une variable temporaire
    const tempTpi = { ...draggedTpiRoom.tpiDatas[draggedTpiIndex] }
    draggedTpiRoom.tpiDatas[draggedTpiIndex] = {
      ...targetTpiRoom.tpiDatas[targetTpiIndex]
    }
    targetTpiRoom.tpiDatas[targetTpiIndex] = tempTpi

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

      roomsData = roomEntries.map((room) => ({
        ...room,
        lastUpdate: new Date().getTime()
      }))

      setNewRooms(roomsData)
      writeJSONValue(STORAGE_KEYS.ORGANIZER_DATA, roomsData)

      notify(`Synchronisation BDD ${selectedYear} en cours...`, "info", 2200)

      let successCount = 0
      const failedRooms = []

      for (const room of roomsData) {
        const roomLabel = compactText(room?.name || room?.nameRoom || room?.idRoom)
        try {
          const isDataTransmitted = await transmitToDatabase(room)

          if (isDataTransmitted) {
            successCount += 1
          } else {
            failedRooms.push(roomLabel || "Salle inconnue")
          }
        } catch (error) {
          console.error("Erreur lors de la transmission de la salle :", error)
          failedRooms.push(roomLabel || "Salle inconnue")
        }
      }

      if (failedRooms.length === 0) {
        notify(
          `Synchronisation BDD ${selectedYear} terminée: ${successCount}/${roomsData.length} salle(s) envoyée(s).`,
          "success"
        )
        return
      }

      const failedPreview = failedRooms.slice(0, 3).join(", ")
      const extraCount = failedRooms.length > 3 ? ` + ${failedRooms.length - 3} autre(s)` : ""
      notify(
        `Synchronisation ${selectedYear} partielle: ${successCount}/${roomsData.length} salle(s) envoyée(s). Échec: ${failedPreview}${extraCount}.`,
        "error",
        4200
      )
    } catch (error) {
      console.error("Erreur lors de la transmission des données :", error)
      notify(error.message || "Erreur lors de la synchronisation vers la BDD.", "error")
    }
  }

  const isRoomsWrapModeEffective = isRoomsFocusMode || isRoomsWrapMode

  return (
    <div className={`planning-schedule-page ${isRoomsFocusMode ? "planning-schedule-page--focus" : ""} ${isRoomsWrapModeEffective ? "planning-schedule-page--wrap" : ""}`.trim()}>
      {!isRoomsFocusMode ? (
        <TpiScheduleButtons
          configData={effectiveConfigData}
          selectedYear={selectedYear}
          onYearChange={handleYearChangeRequest}
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
          onAutomatePlanification={handleAutomatePlanification}
          onValidatePlanification={handleValidatePlanification}
          onFreezeSnapshot={handleFreezeSnapshot}
          onOpenVotes={handleOpenVotes}
          onOpenVotesWithoutEmails={IS_DEBUG ? handleOpenVotesWithoutEmails : null}
          onOpenVoteAccessPreview={IS_DEBUG ? handleOpenVoteAccessPreview : null}
          onRemindVotes={handleRemindVotes}
          onCloseVotes={handleCloseVotes}
          onPublishDefinitive={handlePublishDefinitive}
          onSendSoutenanceLinks={handleSendSoutenanceLinks}
          onGenerateStaticPublication={handleGenerateStaticPublication}
          onPreviewStaticPublication={handlePreviewStaticPublication}
          onPublishStaticPublication={handlePublishStaticPublication}
          staticPublicationInfo={staticPublicationInfo}
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
          onToggleRoomsFocusMode={toggleRoomsFocusMode}
          onToggleRoomsWrapMode={toggleRoomsWrapMode}
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
                    Choisis si c’est une erreur, un simple nettoyage local, ou un vrai redémarrage du workflow{" "}
                    <strong>{selectedYear}</strong>.
                  </p>
                </div>

                <div className="planning-year-change-summary planning-delete-rooms-summary">
                  <div className="planning-year-change-summary-item">
                    <span>Rooms locales</span>
                    <strong>{roomEntries.length}</strong>
                  </div>
                  <div className="planning-year-change-summary-item">
                    <span>Workflow</span>
                    <strong>{workflowState}</strong>
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
                      Efface seulement la vue locale; l’état workflow reste inchangé.
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
                      Réinitialise rooms, votes, snapshots, publication et état annuel.
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
            Aucun planning compatible en local.
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
          {workflowState !== "planning" || activeSnapshotVersion ? (
            <button
              type='button'
              className='icon-button'
              onClick={() => setIsDeleteAllRoomsDialogOpen(true)}
              aria-label='Recommencer workflow'
              title='Recommencer le workflow'
            >
              <IconButtonContent label='Recommencer workflow' icon={RefreshIcon} />
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
                  onUpdateTpi={(tpiIndex, updatedTpi) =>
                    handleUpdateTpi(originalIndex >= 0 ? originalIndex : 0, tpiIndex, updatedTpi)
                  }
                  onSwapTpiCards={(draggedTpi, targetTpi) =>
                    handleSwapTpiCards(draggedTpi, targetTpi)
                  }
                  onDelete={() => handleDelete(room.idRoom)}
                  validationMarkersBySlotKey={validationMarkersBySlotKey}
                />
              )
            })}
          </div>
        </DndProvider>
      )}
    </div>
  )
}
export default TpiSchedule
