import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router-dom"

import { soutenancesService } from "../../services/apiService"
import { workflowPlanningService } from "../../services/planningService"
import { getStoredAuthToken } from "../../utils/storage"
import { showNotification } from "../Tools"
import { formatDate, getLegacyScheduleIndex, getRoomSchedule } from "./TpiSoutenanceParts"

const defaultFilters = {
  site: "",
  date: "",
  reference: "",
  candidate: "",
  experts: "",
  projectManagerButton: "",
  projectManager: "",
  nameRoom: ""
}

const useToken = () => {
  const location = useLocation()
  const queryParams = new URLSearchParams(location.search)
  const legacyToken = [queryParams.get("token"), queryParams.get("code")]
    .find((value) => typeof value === "string" && value.trim())
    ?.trim() || ""
  const magicLinkToken = queryParams.get("ml")?.trim() || ""

  return {
    legacyToken,
    magicLinkToken,
    focusReference: queryParams.get("focus") || ""
  }
}

const fetchSoutenanceData = async (year, accessOptions = {}) => {
  try {
    return await soutenancesService.getPublishedByYear(year, accessOptions)
  } catch (error) {
    showNotification("Erreur lors du chargement des défenses", "error")
    console.error("Erreur fetchSoutenanceData:", error)
    return null
  }
}

const fetchTpiListExperts = async () => {
  try {
    return await soutenancesService.getExpertsOrBoss()
  } catch (error) {
    showNotification("Erreur lors du chargement des experts", "error")
    console.error("Erreur fetchTpiListExperts:", error)
    return null
  }
}

const attachRoomIdentifiers = (rooms) =>
  rooms.map((room) => ({
    ...room,
    tpiDatas: (Array.isArray(room.tpiDatas) ? room.tpiDatas : []).map((tpi, index) => ({
      ...tpi,
      _roomId: room._id,
      originalIndex: getLegacyScheduleIndex(tpi, index)
    }))
  }))

export const createSchedule = (roomData) => {
  if (!roomData?.configSite) {
    return []
  }

  const schedule = []
  const {
    breakline,
    tpiTime,
    firstTpiStart,
    numSlots
  } = roomData.configSite
  const totalSlots = Math.max(0, Number.parseInt(numSlots, 10) || 0)
  const breakDuration = Number(breakline) || 0
  const slotDuration = Number(tpiTime) || 0
  let currentTime = Number(firstTpiStart) || 0

  for (let index = 0; index < totalSlots; index++) {
    let startTime = currentTime
    let endTime = currentTime + slotDuration

    const startHours = Math.floor(startTime)
    const startMinutes = Math.floor((startTime % 1) * 60)
    const endHours = Math.floor(endTime)
    const endMinutes = Math.floor((endTime % 1) * 60)

    schedule.push({
      startTime: `${startHours < 10 ? `0${startHours}` : startHours}:${
        startMinutes < 10 ? `0${startMinutes}` : startMinutes
      }`,
      endTime: `${endHours < 10 ? `0${endHours}` : endHours}:${
        endMinutes < 10 ? `0${endMinutes}` : endMinutes
      }`
    })

    currentTime = index < totalSlots - 1
      ? endTime + breakDuration
      : endTime
  }

  return schedule
}

const normalizeText = (value) => String(value || "").toLowerCase()

const normalizeReference = (value) =>
  normalizeText(value).replace(/^tpi-\d{4}-/i, "")

const filterOptionCollator = new Intl.Collator("fr", {
  sensitivity: "base",
  numeric: true
})

export const sortFilterTextValues = (values = []) =>
  Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  ).sort(filterOptionCollator.compare)

const getDateSortValue = (dateValue) => {
  const time = new Date(dateValue).getTime()
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER
}

export const buildDateFilterOptions = (rooms = []) =>
  Array.from(
    rooms.reduce((dateOptions, room) => {
      const label = formatDate(room.date)
      if (!label || dateOptions.has(label)) {
        return dateOptions
      }

      dateOptions.set(label, {
        label,
        sortValue: getDateSortValue(room.date)
      })
      return dateOptions
    }, new Map()).values()
  )
    .sort((left, right) =>
      left.sortValue - right.sortValue ||
      filterOptionCollator.compare(left.label, right.label)
    )
    .map((dateOption) => dateOption.label)

const resolvePersonNameForAggregatedICal = (filters) => {
  const candidateFilters = [
    { key: "experts", value: filters?.experts || "" },
    { key: "projectManagerButton", value: filters?.projectManagerButton || "" },
    { key: "projectManager", value: filters?.projectManager || "" }
  ]

  const normalizedValues = candidateFilters
    .map((entry) => normalizeText(entry.value))
    .filter(Boolean)

  if (new Set(normalizedValues).size !== 1) {
    return ""
  }

  const firstMatch = candidateFilters.find((entry) => normalizeText(entry.value))
  return firstMatch?.value || ""
}

export const matchesReferenceFilter = (referenceFilter, tpiReference) => {
  const normalizedFilter = normalizeReference(referenceFilter)
  const normalizedReference = normalizeReference(tpiReference)
  const rawFilter = normalizeText(referenceFilter)
  const rawReference = normalizeText(tpiReference)

  if (!normalizedFilter || !normalizedReference) {
    return false
  }

  return normalizedFilter === normalizedReference || rawFilter === rawReference
}

const doesTpiMatchViewer = (tpi, viewer = null) => {
  if (!viewer?.personId && !viewer?.name) {
    return true
  }

  const participantIds = [
    tpi.candidatPersonId,
    tpi.expert1?.personId,
    tpi.expert2?.personId,
    tpi.boss?.personId
  ]
    .filter(Boolean)
    .map((value) => String(value))

  if (viewer?.personId && participantIds.includes(String(viewer.personId))) {
    return true
  }

  const normalizedViewer = normalizeText(viewer?.name)
  const names = [
    tpi.candidat,
    tpi.expert1?.name,
    tpi.expert2?.name,
    tpi.boss?.name
  ]

  return names.some(name => normalizeText(name).includes(normalizedViewer))
}

const filterRooms = (rooms, filters, magicLinkViewer = null) =>
  rooms.flatMap((room) => {
    const filteredTpis = room.tpiDatas.filter((tpi) => {
      if (!doesTpiMatchViewer(tpi, magicLinkViewer)) {
        return false
      }

      return (
        (!filters.nameRoom || room.name === filters.nameRoom) &&
        (!filters.site || room.site === filters.site) &&
        (!filters.date || formatDate(room.date) === filters.date) &&
        (!filters.reference || matchesReferenceFilter(filters.reference, tpi.refTpi)) &&
        (!filters.candidate ||
          tpi.candidat.toLowerCase().includes(filters.candidate.toLowerCase())) &&
        (!filters.experts ||
          tpi.expert1?.name.toLowerCase().includes(filters.experts.toLowerCase()) ||
          tpi.expert2?.name
            .toLowerCase()
            .includes(filters.experts.toLowerCase())) &&
        (!filters.projectManagerButton ||
          tpi.expert1?.name
            .toLowerCase()
            .includes(filters.projectManagerButton.toLowerCase()) ||
          tpi.expert2?.name
            .toLowerCase()
            .includes(filters.projectManagerButton.toLowerCase()) ||
          tpi.boss?.name
            .toLowerCase()
            .includes(filters.projectManagerButton.toLowerCase())) &&
        (!filters.projectManager ||
          (tpi.boss?.name &&
            tpi.boss.name
              .toLowerCase()
              .includes(filters.projectManager.toLowerCase())))
      )
    })

    if (filteredTpis.length === 0) {
      return []
    }

    return { ...room, tpiDatas: filteredTpis }
  })

export const isFilterApplied = (filters) =>
  filters.site !== "" ||
  filters.date !== "" ||
  filters.reference !== "" ||
  filters.nameRoom !== "" ||
  filters.experts !== "" ||
  filters.candidate !== "" ||
  filters.projectManager !== "" ||
  filters.projectManagerButton !== ""

export const useSoutenanceData = (year) => {
  const { legacyToken: token, magicLinkToken, focusReference } = useToken()
  const [soutenanceData, setSoutenanceData] = useState([])
  const [expertOrBoss, setExpertOrBoss] = useState(null)
  const [listOfExpertsOrBoss, setListOfExpertsOrBoss] = useState([])
  const [magicLinkViewer, setMagicLinkViewer] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(defaultFilters)

  const filteredData = useMemo(
    () => filterRooms(soutenanceData, filters, magicLinkViewer),
    [soutenanceData, filters, magicLinkViewer]
  )

  const uniqueSalles = useMemo(() => {
    const roomNames = soutenanceData.map((room) => room.name)
    return sortFilterTextValues(roomNames)
  }, [soutenanceData])

  const uniqueDates = useMemo(() => {
    return buildDateFilterOptions(soutenanceData)
  }, [soutenanceData])

  const uniqueSites = useMemo(() => {
    const sites = soutenanceData.map((room) => room.site)
    return sortFilterTextValues(sites)
  }, [soutenanceData])

  const uniqueCandidates = useMemo(() => {
    const candidates = soutenanceData.flatMap((room) =>
      (Array.isArray(room.tpiDatas) ? room.tpiDatas : []).map((tpi) => tpi.candidat)
    )
    return sortFilterTextValues(candidates)
  }, [soutenanceData])

  const uniqueExperts = useMemo(() => {
    const experts = soutenanceData.flatMap((room) =>
      (Array.isArray(room.tpiDatas) ? room.tpiDatas : []).flatMap((tpi) =>
        [tpi.expert1?.name, tpi.expert2?.name]
      )
    )
    return sortFilterTextValues(experts)
  }, [soutenanceData])

  const uniqueProjectManagers = useMemo(() => {
    const managers = soutenanceData.flatMap((room) =>
      (Array.isArray(room.tpiDatas) ? room.tpiDatas : []).map((tpi) => tpi.boss?.name)
    )
    return sortFilterTextValues(managers)
  }, [soutenanceData])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const hasAppSession = Boolean(getStoredAuthToken("/api/defenses"))

      if (!token && !magicLinkToken && !hasAppSession) {
        setSoutenanceData([])
        setListOfExpertsOrBoss([])
        setError("Code ou lien magique requis pour afficher les défenses.")
        return
      }

      const [rooms, experts] = await Promise.all([
        fetchSoutenanceData(year, {
          ml: magicLinkToken || undefined,
          token: token || undefined
        }),
        fetchTpiListExperts()
      ])

      if (!rooms) {
        setError("Impossible de charger les données")
        return
      }

      setSoutenanceData(attachRoomIdentifiers(rooms))
      setListOfExpertsOrBoss(experts || [])
    } catch (loadError) {
      setError("Erreur lors du chargement des données")
      console.error(loadError)
    } finally {
      setIsLoading(false)
    }
  }, [year, magicLinkToken, token])

  useEffect(() => {
    loadData().catch(console.error)
  }, [loadData])

  useEffect(() => {
    let isCancelled = false

    const resolveMagicLink = async () => {
      if (!magicLinkToken) {
        return
      }

      try {
        const resolved = await workflowPlanningService.resolveMagicLink(magicLinkToken)
        if (!isCancelled && resolved?.type === "soutenance") {
          if (resolved?.year && String(resolved.year) !== String(year)) {
            setError(`Ce lien cible l annee ${resolved.year} et non ${year}.`)
            return
          }

          setMagicLinkViewer(resolved.viewer || null)
        }
      } catch (resolveError) {
        if (!isCancelled) {
          setError(resolveError?.data?.error || "Lien magique invalide ou expire")
        }
      }
    }

    resolveMagicLink().catch(console.error)

    return () => {
      isCancelled = true
    }
  }, [magicLinkToken, year])

  useEffect(() => {
    if (magicLinkViewer?.name) {
      setFilters((previousFilters) => ({
        ...previousFilters,
        experts: "",
        projectManagerButton: "",
        projectManager: ""
      }))
      setExpertOrBoss({
        name: magicLinkViewer.name,
        role: "viewer"
      })
      return
    }

    if (listOfExpertsOrBoss.length === 0) {
      setExpertOrBoss(null)
      return
    }

    const matchedParticipant = listOfExpertsOrBoss.find(
      (participant) => participant.token === token
    )

    setExpertOrBoss(matchedParticipant || null)

    if (!matchedParticipant?.name) {
      return
    }

    setFilters((previousFilters) => ({
      ...previousFilters,
      experts:
        matchedParticipant.role === "projectManager"
          ? previousFilters.experts
          : matchedParticipant.name,
      projectManagerButton:
        matchedParticipant.role === "projectManager"
          ? matchedParticipant.name
          : previousFilters.projectManagerButton
    }))
  }, [listOfExpertsOrBoss, token])

  useEffect(() => {
    setFilters((previousFilters) => {
      if (previousFilters.reference === focusReference) {
        return previousFilters
      }

      return {
        ...previousFilters,
        reference: focusReference
      }
    })
  }, [focusReference])

  const updateFilter = useCallback((filterName, value) => {
    setFilters((previousFilters) => ({
      ...previousFilters,
      [filterName]: value
    }))
  }, [])

  const updateSoutenanceData = useCallback(
    async (targetYear, propositions, tpiData, expertOrBossRole) => {
      if (magicLinkViewer) {
        throw new Error("Mode lecture seule: lien défense.")
      }

      try {
        return await soutenancesService.updateOffers(
          targetYear,
          tpiData._roomId,
          tpiData._id,
          expertOrBossRole,
          propositions,
          {
            token: token || undefined
          }
        )
      } catch (updateError) {
        showNotification("Erreur lors de la mise a jour de la défense", "error")
        console.error("Erreur updateSoutenanceData:", updateError)
        throw updateError
      }
    },
    [magicLinkViewer, token]
  )

  const schedule = useMemo(
    () => (soutenanceData.length > 0 ? createSchedule(soutenanceData[0]) : []),
    [soutenanceData]
  )

  const displayedSchedule = useMemo(
    () =>
      filteredData.length > 0 ? getRoomSchedule(filteredData[0], schedule) : schedule,
    [filteredData, schedule]
  )

  const aggregatedICalPersonLabel = useMemo(
    () => resolvePersonNameForAggregatedICal(filters),
    [filters]
  )

  return {
    token,
    magicLinkViewer,
    soutenanceData,
    expertOrBoss,
    listOfExpertsOrBoss,
    isLoading,
    error,
    filters,
    filteredData,
    uniqueSalles,
    uniqueDates,
    uniqueSites,
    uniqueCandidates,
    uniqueExperts,
    uniqueProjectManagers,
    loadData,
    updateFilter,
    updateSoutenanceData,
    schedule,
    displayedSchedule,
    isFilterApplied: isFilterApplied(filters),
    aggregatedICalPersonLabel
  }
}
