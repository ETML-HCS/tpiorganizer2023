import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router-dom"

import { soutenancesService } from "../../services/apiService"
import { workflowPlanningService } from "../../services/planningService"
import { showNotification } from "../Tools"
import { formatDate, getRoomSchedule } from "./TpiSoutenanceParts"

const defaultFilters = {
  site: "",
  date: "",
  candidate: "",
  experts: "",
  projectManagerButton: "",
  projectManager: "",
  nameRoom: ""
}

const useToken = () => {
  const location = useLocation()
  const queryParams = new URLSearchParams(location.search)
  return {
    legacyToken: queryParams.get("token"),
    magicLinkToken: queryParams.get("ml")
  }
}

const fetchSoutenanceData = async (year, accessOptions = {}) => {
  try {
    return await soutenancesService.getPublishedByYear(year, accessOptions)
  } catch (error) {
    showNotification("Erreur lors du chargement des soutenances", "error")
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
    tpiDatas: room.tpiDatas.map((tpi, index) => ({
      ...tpi,
      _roomId: room._id,
      originalIndex: index
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
  filters.nameRoom !== "" ||
  filters.experts !== "" ||
  filters.candidate !== "" ||
  filters.projectManager !== "" ||
  filters.projectManagerButton !== ""

export const useSoutenanceData = (year) => {
  const { legacyToken: token, magicLinkToken } = useToken()
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
    return [...new Set(roomNames)].sort()
  }, [soutenanceData])

  const uniqueDates = useMemo(() => {
    const dates = soutenanceData.map((room) => formatDate(room.date))
    return [...new Set(dates)].sort()
  }, [soutenanceData])

  const uniqueSites = useMemo(() => {
    const sites = soutenanceData.map((room) => room.site)
    return [...new Set(sites)].sort()
  }, [soutenanceData])

  const uniqueCandidates = useMemo(() => {
    const candidates = new Set(
      soutenanceData.flatMap((room) => room.tpiDatas.map((tpi) => tpi.candidat))
    )
    return Array.from(candidates).sort()
  }, [soutenanceData])

  const uniqueExperts = useMemo(() => {
    const experts = new Set(
      soutenanceData.flatMap((room) =>
        room.tpiDatas.flatMap((tpi) =>
          [tpi.expert1?.name, tpi.expert2?.name].filter(Boolean)
        )
      )
    )
    return Array.from(experts).sort()
  }, [soutenanceData])

  const uniqueProjectManagers = useMemo(() => {
    const managers = new Set(
      soutenanceData.flatMap((room) =>
        room.tpiDatas.map((tpi) => tpi.boss?.name).filter(Boolean)
      )
    )
    return Array.from(managers).sort()
  }, [soutenanceData])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
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

  const updateFilter = useCallback((filterName, value) => {
    setFilters((previousFilters) => ({
      ...previousFilters,
      [filterName]: value
    }))
  }, [])

  const updateSoutenanceData = useCallback(
    async (targetYear, propositions, tpiData, expertOrBossRole) => {
      if (magicLinkViewer) {
        throw new Error("Mode lecture seule: lien soutenance.")
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
        showNotification("Erreur lors de la mise a jour de la soutenance", "error")
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
    isFilterApplied: isFilterApplied(filters)
  }
}
