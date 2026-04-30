import {
  normalizeSoutenanceDateEntries,
  normalizeSoutenanceDateValue
} from "./soutenanceDateUtils"
import { inferRoomClassMode } from "./tpiScheduleFilters"

const PLACEHOLDER_NAMES = new Set(["null", "n/a", "na", "none", "-"])
const DEFAULT_MAX_CONSECUTIVE_TPI = 4

const compactText = (value) => {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

const normalizeName = (value) =>
  compactText(value)
    .replace(/\s+/g, " ")
    .toLowerCase()

const isPlaceholderName = (value) => {
  const normalized = normalizeName(value)
  return !normalized || PLACEHOLDER_NAMES.has(normalized)
}

const getTpiReference = (tpi) => compactText(tpi?.refTpi || tpi?.id)

const getRoomName = (room) => compactText(room?.name || room?.nameRoom)

const getRoomSite = (room) => compactText(room?.site).toUpperCase()

const getRoomDateKey = (room) => normalizeSoutenanceDateValue(room?.date)

const getMaxConsecutiveTpiLimit = (value, fallback = DEFAULT_MAX_CONSECUTIVE_TPI) => {
  const fallbackLimit = Number.isInteger(Number(fallback)) && Number(fallback) > 0
    ? Number(fallback)
    : DEFAULT_MAX_CONSECUTIVE_TPI
  const limit = Number(value)

  return Number.isInteger(limit) && limit > 0
    ? limit
    : fallbackLimit
}

const inferTpiClassMode = (tpi) => {
  const classe = compactText(tpi?.classe).toUpperCase()

  if (!classe) {
    return null
  }

  return classe.startsWith("M") ? "matu" : "nonM"
}

const isEmptyTpiCard = (tpi) => {
  if (getTpiReference(tpi)) {
    return false
  }

  const participantNames = [
    tpi?.candidat,
    tpi?.expert1?.name,
    tpi?.expert2?.name,
    tpi?.boss?.name
  ]

  if (participantNames.some((value) => !isPlaceholderName(value))) {
    return false
  }

  return !compactText(tpi?.sujet) && !compactText(tpi?.description)
}

const getTpiParticipants = (tpi) => [
  { role: "candidat", name: compactText(tpi?.candidat) },
  { role: "expert1", name: compactText(tpi?.expert1?.name) },
  { role: "expert2", name: compactText(tpi?.expert2?.name) },
  { role: "boss", name: compactText(tpi?.boss?.name) }
].filter(({ name }) => Boolean(name) && !isPlaceholderName(name))

const compareTimelineKeys = (left, right) => {
  const [leftDate, leftPeriodText] = String(left || "").split("|")
  const [rightDate, rightPeriodText] = String(right || "").split("|")

  const leftTime = new Date(leftDate).getTime()
  const rightTime = new Date(rightDate).getTime()
  const leftValid = !Number.isNaN(leftTime)
  const rightValid = !Number.isNaN(rightTime)

  if (leftValid && rightValid && leftTime !== rightTime) {
    return leftTime - rightTime
  }

  if (leftValid !== rightValid) {
    return leftValid ? -1 : 1
  }

  const leftPeriod = Number.parseInt(leftPeriodText, 10)
  const rightPeriod = Number.parseInt(rightPeriodText, 10)

  if (Number.isInteger(leftPeriod) && Number.isInteger(rightPeriod) && leftPeriod !== rightPeriod) {
    return leftPeriod - rightPeriod
  }

  return String(left || "").localeCompare(String(right || ""))
}

const buildTimeline = (roomEntries) => {
  const timeSteps = []
  const seenKeys = new Set()

  for (const room of Array.isArray(roomEntries) ? roomEntries : []) {
    const roomDateKey = getRoomDateKey(room)
    const tpiDatas = Array.isArray(room?.tpiDatas) ? room.tpiDatas : []

    for (let slotIndex = 0; slotIndex < tpiDatas.length; slotIndex += 1) {
      const key = `${roomDateKey}|${slotIndex + 1}`
      if (!key || seenKeys.has(key)) {
        continue
      }

      seenKeys.add(key)
      timeSteps.push(key)
    }
  }

  timeSteps.sort(compareTimelineKeys)

  return {
    timeSteps,
    indexByKey: new Map(timeSteps.map((key, index) => [key, index]))
  }
}

const buildRoomContexts = (roomEntries, normalizedDates) => {
  const dateEntries = Array.isArray(normalizedDates)
    ? normalizedDates
    : normalizeSoutenanceDateEntries(normalizedDates)

  return (Array.isArray(roomEntries) ? roomEntries : []).map((room, roomIndex) => {
    const roomDateKey = getRoomDateKey(room)
    const roomDateEntry = dateEntries.find((entry) => entry.date === roomDateKey) || null
    const roomName = getRoomName(room)
    const roomSite = getRoomSite(room)
    const roomClassMode = inferRoomClassMode({
      roomName,
      roomDateEntry,
      allowedPrefixes: Array.isArray(roomDateEntry?.classes) ? roomDateEntry.classes : []
    })

    return {
      roomIndex,
      roomDateKey,
      roomDateEntry,
      roomName,
      roomSite,
      roomKey: `${roomSite}|${roomName}`,
      roomClassMode
    }
  })
}

const buildSlotContexts = (roomEntries, roomContexts, timeline) => {
  const contexts = []

  ;(Array.isArray(roomEntries) ? roomEntries : []).forEach((room, roomIndex) => {
    const roomContext = roomContexts[roomIndex] || {
      roomIndex,
      roomDateKey: getRoomDateKey(room),
      roomDateEntry: null,
      roomName: getRoomName(room),
      roomSite: getRoomSite(room),
      roomKey: `${getRoomSite(room)}|${getRoomName(room)}`,
      roomClassMode: null
    }
    const tpiDatas = Array.isArray(room?.tpiDatas) ? room.tpiDatas : []

    tpiDatas.forEach((tpi, slotIndex) => {
      const period = slotIndex + 1
      const slotKey = `${roomContext.roomDateKey}|${period}`
      const timelineIndex = timeline.indexByKey.get(slotKey)

      contexts.push({
        roomIndex,
        slotIndex,
        period,
        slotKey,
        timelineIndex: Number.isInteger(timelineIndex) ? timelineIndex : Number.MAX_SAFE_INTEGER,
        roomName: roomContext.roomName,
        roomSite: roomContext.roomSite,
        roomKey: roomContext.roomKey,
        roomDateKey: roomContext.roomDateKey,
        roomDateEntry: roomContext.roomDateEntry,
        roomClassMode: roomContext.roomClassMode,
        maxConsecutiveTpi: getMaxConsecutiveTpiLimit(room?.configSite?.maxConsecutiveTpi),
        tpi,
        reference: getTpiReference(tpi),
        tpiClassMode: inferTpiClassMode(tpi),
        participants: getTpiParticipants(tpi),
        isEmpty: isEmptyTpiCard(tpi)
      })
    })
  })

  return contexts
}

const cloneTpiCard = (tpi) => {
  if (!tpi || typeof tpi !== "object") {
    return tpi
  }

  return {
    ...tpi,
    expert1: tpi.expert1 && typeof tpi.expert1 === "object"
      ? { ...tpi.expert1 }
      : tpi.expert1,
    expert2: tpi.expert2 && typeof tpi.expert2 === "object"
      ? { ...tpi.expert2 }
      : tpi.expert2,
    boss: tpi.boss && typeof tpi.boss === "object"
      ? { ...tpi.boss }
      : tpi.boss
  }
}

const clonePlanningRooms = (roomEntries) => {
  return (Array.isArray(roomEntries) ? roomEntries : []).map((room) => ({
    ...room,
    configSite: room?.configSite && typeof room.configSite === "object"
      ? { ...room.configSite }
      : room?.configSite,
    tpiDatas: Array.isArray(room?.tpiDatas)
      ? room.tpiDatas.map((tpi) => cloneTpiCard(tpi))
      : []
  }))
}

const canPlaceTpiInRoom = (tpi, roomContext) => {
  if (!tpi || !roomContext) {
    return false
  }

  if (isEmptyTpiCard(tpi)) {
    return true
  }

  const roomMode = roomContext.roomClassMode || null
  const tpiMode = inferTpiClassMode(tpi)

  if (!roomMode || !tpiMode) {
    return false
  }

  return roomMode === tpiMode
}

const buildPersonAnalytics = (slotContexts) => {
  const personSlotGroups = new Map()

  for (const context of Array.isArray(slotContexts) ? slotContexts : []) {
    if (context.isEmpty) {
      continue
    }

    const uniquePeople = new Map()
    for (const participant of context.participants) {
      const personKey = normalizeName(participant.name)
      if (!personKey) {
        continue
      }

      if (!uniquePeople.has(personKey)) {
        uniquePeople.set(personKey, {
          personKey,
          personName: participant.name,
          roles: new Set()
        })
      }

      uniquePeople.get(personKey).roles.add(participant.role)
    }

    for (const [personKey, participant] of uniquePeople.entries()) {
      if (!personSlotGroups.has(personKey)) {
        personSlotGroups.set(personKey, new Map())
      }

      const slotGroups = personSlotGroups.get(personKey)
      if (!slotGroups.has(context.slotKey)) {
        slotGroups.set(context.slotKey, {
          personKey,
          personName: participant.personName,
          slotKey: context.slotKey,
          timelineIndex: context.timelineIndex,
          period: context.period,
          roomName: context.roomName,
          roomSite: context.roomSite,
          roomKey: context.roomKey,
          refs: new Set(),
          roles: new Set(),
          roomNames: new Set(),
          roomSites: new Set(),
          maxConsecutiveTpi: getMaxConsecutiveTpiLimit(context.maxConsecutiveTpi)
        })
      }

      const group = slotGroups.get(context.slotKey)
      group.refs.add(context.reference || `${context.roomKey}#${context.slotKey}`)
      group.maxConsecutiveTpi = Math.min(
        getMaxConsecutiveTpiLimit(group.maxConsecutiveTpi),
        getMaxConsecutiveTpiLimit(context.maxConsecutiveTpi)
      )
      for (const role of participant.roles) {
        group.roles.add(role)
      }
      group.roomNames.add(context.roomName)
      group.roomSites.add(context.roomSite)
    }
  }

  const personOverlaps = []
  const sequenceViolations = []
  const classMismatches = []

  let personOverlapGroupCount = 0
  let personOverlapCount = 0
  let sequenceViolationCount = 0
  let sequenceExcessCount = 0
  let classMismatchCount = 0
  let movementPenalty = 0

  for (const slotGroupsMap of personSlotGroups.values()) {
    const slotGroups = Array.from(slotGroupsMap.values()).sort((left, right) => {
      const leftIndex = Number.isInteger(left.timelineIndex) ? left.timelineIndex : Number.MAX_SAFE_INTEGER
      const rightIndex = Number.isInteger(right.timelineIndex) ? right.timelineIndex : Number.MAX_SAFE_INTEGER

      return leftIndex - rightIndex || String(left.slotKey).localeCompare(String(right.slotKey))
    })

    for (const slotGroup of slotGroups) {
      if (slotGroup.refs.size <= 1) {
        continue
      }

      personOverlapGroupCount += 1
      personOverlapCount += slotGroup.refs.size - 1
      personOverlaps.push({
        personName: slotGroup.personName,
        slotKey: slotGroup.slotKey,
        timelineIndex: slotGroup.timelineIndex,
        period: slotGroup.period,
        roomNames: Array.from(slotGroup.roomNames).sort((left, right) => left.localeCompare(right)),
        roomSites: Array.from(slotGroup.roomSites).sort((left, right) => left.localeCompare(right)),
        roles: Array.from(slotGroup.roles).sort((left, right) => left.localeCompare(right)),
        references: Array.from(slotGroup.refs).sort((left, right) => left.localeCompare(right))
      })
    }

    if (slotGroups.length === 0) {
      continue
    }

    let runStart = 0
    const flushRun = (startIndex, endIndex) => {
      const runLength = endIndex - startIndex + 1
      if (runLength <= 0) {
        return
      }

      const runGroups = slotGroups.slice(startIndex, endIndex + 1)
      const maxConsecutiveTpi = Math.min(
        ...runGroups.map((slotGroup) => getMaxConsecutiveTpiLimit(slotGroup.maxConsecutiveTpi))
      )
      const softLimit = Math.max(maxConsecutiveTpi - 1, 0)

      if (runLength > softLimit) {
        sequenceExcessCount += runLength - softLimit
      }

      if (runLength > maxConsecutiveTpi) {
        sequenceViolationCount += 1
        sequenceViolations.push({
          personName: slotGroups[startIndex].personName,
          consecutiveCount: runLength,
          maxConsecutiveTpi,
          slotKeys: slotGroups
            .slice(startIndex, endIndex + 1)
            .map((slotGroup) => slotGroup.slotKey)
        })
      }
    }

    for (let index = 1; index < slotGroups.length; index += 1) {
      const previous = slotGroups[index - 1]
      const current = slotGroups[index]
      const previousIndex = Number.isInteger(previous.timelineIndex) ? previous.timelineIndex : Number.MAX_SAFE_INTEGER
      const currentIndex = Number.isInteger(current.timelineIndex) ? current.timelineIndex : Number.MAX_SAFE_INTEGER
      const gap = currentIndex - previousIndex

      if (gap === 1) {
        if (previous.roomKey !== current.roomKey) {
          movementPenalty += previous.roomSite === current.roomSite ? 2 : 4
        }
        continue
      }

      if (gap === 2 && previous.roomKey !== current.roomKey) {
        movementPenalty += previous.roomSite === current.roomSite ? 1 : 2
      }

      flushRun(runStart, index - 1)
      runStart = index
    }

    flushRun(runStart, slotGroups.length - 1)
  }

  for (const context of Array.isArray(slotContexts) ? slotContexts : []) {
    if (context.isEmpty) {
      continue
    }

    if (!context.roomClassMode || !context.tpiClassMode) {
      continue
    }

    if (context.roomClassMode === context.tpiClassMode) {
      continue
    }

    classMismatchCount += 1
    classMismatches.push({
      reference: context.reference,
      candidat: compactText(context.tpi?.candidat),
      classe: compactText(context.tpi?.classe),
      roomName: context.roomName,
      roomSite: context.roomSite,
      roomClassMode: context.roomClassMode,
      tpiClassMode: context.tpiClassMode,
      slotKey: context.slotKey,
      period: context.period
    })
  }

  const overlapPenalty = personOverlapCount * 100000
  const classMismatchPenalty = classMismatchCount * 50000
  const sequencePenalty = sequenceExcessCount * 1000
  const movementScore = movementPenalty * 10
  const score = overlapPenalty + classMismatchPenalty + sequencePenalty + movementScore

  return {
    personSlotGroups,
    personOverlaps,
    sequenceViolations,
    classMismatches,
    summary: {
      personOverlapGroupCount,
      personOverlapCount,
      sequenceViolationCount,
      sequenceExcessCount,
      classMismatchCount,
      movementPenalty,
      overlapPenalty,
      classMismatchPenalty,
      sequencePenalty,
      movementScore,
      score
    }
  }
}

export const summarizeLocalPersonConflicts = (roomEntries, options = {}) => {
  const normalizedDates = normalizeSoutenanceDateEntries(options?.soutenanceDates || [])
  const timeline = buildTimeline(roomEntries)
  const roomContexts = buildRoomContexts(roomEntries, normalizedDates)
  const slotContexts = buildSlotContexts(roomEntries, roomContexts, timeline)
  const analysis = buildPersonAnalytics(slotContexts)

  return {
    conflictCount: analysis.summary.personOverlapGroupCount,
    conflicts: analysis.personOverlaps,
    summary: analysis.summary
  }
}

export const analyzePlanningRooms = (roomEntries, options = {}) => {
  const normalizedDates = normalizeSoutenanceDateEntries(options?.soutenanceDates || [])
  const timeline = buildTimeline(roomEntries)
  const roomContexts = buildRoomContexts(roomEntries, normalizedDates)
  const slotContexts = buildSlotContexts(roomEntries, roomContexts, timeline)
  const analysis = buildPersonAnalytics(slotContexts)

  return {
    timeline,
    roomContexts,
    slotContexts,
    ...analysis
  }
}

const cloneRoomsForSwap = (roomEntries, leftContext, rightContext) => {
  const nextRooms = (Array.isArray(roomEntries) ? roomEntries : []).map((room, index) => {
    if (index !== leftContext.roomIndex && index !== rightContext.roomIndex) {
      return room
    }

    return {
      ...room,
      configSite: room?.configSite && typeof room.configSite === "object"
        ? { ...room.configSite }
        : room?.configSite,
      tpiDatas: Array.isArray(room?.tpiDatas) ? [...room.tpiDatas] : []
    }
  })

  const leftRoom = nextRooms[leftContext.roomIndex]
  const rightRoom = nextRooms[rightContext.roomIndex]

  if (!leftRoom || !rightRoom) {
    return nextRooms
  }

  const leftCard = leftRoom.tpiDatas[leftContext.slotIndex]
  const rightCard = rightRoom.tpiDatas[rightContext.slotIndex]

  leftRoom.tpiDatas[leftContext.slotIndex] = rightCard
  rightRoom.tpiDatas[rightContext.slotIndex] = leftCard

  return nextRooms
}

const isBetterAnalysis = (candidate, current) => {
  if (!current) {
    return true
  }

  if (candidate.summary.score !== current.summary.score) {
    return candidate.summary.score < current.summary.score
  }

  if (candidate.summary.personOverlapCount !== current.summary.personOverlapCount) {
    return candidate.summary.personOverlapCount < current.summary.personOverlapCount
  }

  if (candidate.summary.classMismatchCount !== current.summary.classMismatchCount) {
    return candidate.summary.classMismatchCount < current.summary.classMismatchCount
  }

  if (candidate.summary.sequenceExcessCount !== current.summary.sequenceExcessCount) {
    return candidate.summary.sequenceExcessCount < current.summary.sequenceExcessCount
  }

  if (candidate.summary.movementPenalty !== current.summary.movementPenalty) {
    return candidate.summary.movementPenalty < current.summary.movementPenalty
  }

  return false
}

export const optimizePlanningRooms = (roomEntries, options = {}) => {
  const normalizedDates = normalizeSoutenanceDateEntries(options?.soutenanceDates || [])
  const maxPasses = Number.isInteger(options?.maxPasses) && options.maxPasses > 0
    ? options.maxPasses
    : 6

  let workingRooms = clonePlanningRooms(roomEntries)
  let currentAnalysis = analyzePlanningRooms(workingRooms, { soutenanceDates: normalizedDates })
  const baselineSummary = currentAnalysis.summary
  const timeline = currentAnalysis.timeline
  const roomContexts = currentAnalysis.roomContexts
  let swapCount = 0

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const slotContexts = buildSlotContexts(workingRooms, roomContexts, timeline)
    const contextsByDate = new Map()

    slotContexts.forEach((context, index) => {
      if (!context.slotKey) {
        return
      }

      const dateKey = context.roomDateKey || ""
      if (!contextsByDate.has(dateKey)) {
        contextsByDate.set(dateKey, [])
      }

      contextsByDate.get(dateKey).push({
        ...context,
        slotContextIndex: index
      })
    })

    let bestCandidate = null

    for (const dateContexts of contextsByDate.values()) {
      for (let leftIndex = 0; leftIndex < dateContexts.length - 1; leftIndex += 1) {
        const leftContext = dateContexts[leftIndex]

        for (let rightIndex = leftIndex + 1; rightIndex < dateContexts.length; rightIndex += 1) {
          const rightContext = dateContexts[rightIndex]

          if (leftContext.period === rightContext.period) {
            continue
          }

          if (leftContext.isEmpty && rightContext.isEmpty) {
            continue
          }

          if (!canPlaceTpiInRoom(leftContext.tpi, rightContext) || !canPlaceTpiInRoom(rightContext.tpi, leftContext)) {
            continue
          }

          const nextRooms = cloneRoomsForSwap(workingRooms, leftContext, rightContext)
          const nextAnalysis = analyzePlanningRooms(nextRooms, { soutenanceDates: normalizedDates })

          if (!isBetterAnalysis(nextAnalysis, currentAnalysis)) {
            continue
          }

          if (!bestCandidate || isBetterAnalysis(nextAnalysis, bestCandidate.analysis)) {
            bestCandidate = {
              rooms: nextRooms,
              analysis: nextAnalysis,
              leftContext,
              rightContext
            }
          }
        }
      }
    }

    if (!bestCandidate) {
      break
    }

    workingRooms = bestCandidate.rooms
    currentAnalysis = bestCandidate.analysis
    swapCount += 1
  }

  return {
    rooms: workingRooms,
    changed: swapCount > 0,
    swapCount,
    before: baselineSummary,
    after: {
      ...currentAnalysis.summary,
      personOverlaps: currentAnalysis.personOverlaps,
      sequenceViolations: currentAnalysis.sequenceViolations,
      classMismatches: currentAnalysis.classMismatches
    }
  }
}
