import {
  normalizeSoutenanceDateEntries,
  normalizeSoutenanceDateValue
} from "./soutenanceDateUtils"
import { inferRoomClassMode } from "./tpiScheduleFilters"
import { isTpiPlanningSealed } from "./tpiScheduleData"

const PLACEHOLDER_NAMES = new Set(["null", "n/a", "na", "none", "-"])
const DEFAULT_MAX_CONSECUTIVE_TPI = 4
const DEFAULT_PREFERRED_BREAK_PERIODS = [4, 5]

const compactText = (value) => {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

const normalizeName = (value) =>
  compactText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()

const normalizePersonId = (value) => compactText(value)

const buildPersonIdentityKeys = (participant = {}) => {
  const keys = []
  const personId = normalizePersonId(participant.personId)
  if (personId) {
    keys.push(`id:${personId}`)
  }

  const name = normalizeName(participant.name)
  if (name && !PLACEHOLDER_NAMES.has(name)) {
    keys.push(`name:${name}`)
  }

  return keys
}

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
  const participantIds = [
    tpi?.candidatPersonId,
    tpi?.expert1?.personId,
    tpi?.expert2?.personId,
    tpi?.boss?.personId
  ]

  if (participantNames.some((value) => !isPlaceholderName(value))) {
    return false
  }

  if (participantIds.some((value) => Boolean(normalizePersonId(value)))) {
    return false
  }

  return !compactText(tpi?.sujet) && !compactText(tpi?.description)
}

const getTpiParticipants = (tpi) => [
  { role: "candidat", name: compactText(tpi?.candidat), personId: normalizePersonId(tpi?.candidatPersonId) },
  { role: "expert1", name: compactText(tpi?.expert1?.name), personId: normalizePersonId(tpi?.expert1?.personId) },
  { role: "expert2", name: compactText(tpi?.expert2?.name), personId: normalizePersonId(tpi?.expert2?.personId) },
  { role: "boss", name: compactText(tpi?.boss?.name), personId: normalizePersonId(tpi?.boss?.personId) }
].filter((participant) => buildPersonIdentityKeys(participant).length > 0)

const findCanonicalPersonKey = (parents, key) => {
  let current = key
  while (parents.has(current) && parents.get(current) !== current) {
    current = parents.get(current)
  }

  let pathKey = key
  while (parents.has(pathKey) && parents.get(pathKey) !== pathKey) {
    const next = parents.get(pathKey)
    parents.set(pathKey, current)
    pathKey = next
  }

  return current
}

const buildParticipantIdentityIndex = (slotContexts) => {
  const parents = new Map()

  const ensureKey = (key) => {
    if (key && !parents.has(key)) {
      parents.set(key, key)
    }
  }

  const union = (preferredKey, key) => {
    ensureKey(preferredKey)
    ensureKey(key)
    const preferredRoot = findCanonicalPersonKey(parents, preferredKey)
    const keyRoot = findCanonicalPersonKey(parents, key)

    if (preferredRoot !== keyRoot) {
      parents.set(keyRoot, preferredRoot)
    }
  }

  for (const context of Array.isArray(slotContexts) ? slotContexts : []) {
    for (const participant of Array.isArray(context?.participants) ? context.participants : []) {
      const keys = buildPersonIdentityKeys(participant)
      const preferredKey = keys.find((key) => key.startsWith("id:")) || keys[0]

      if (!preferredKey) {
        continue
      }

      keys.forEach((key) => union(preferredKey, key))
    }
  }

  return {
    resolve(participant = {}) {
      const keys = buildPersonIdentityKeys(participant)
      const preferredKey = keys.find((key) => key.startsWith("id:")) || keys[0]
      return preferredKey ? findCanonicalPersonKey(parents, preferredKey) : ""
    }
  }
}

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

const parseTimelineKey = (key) => {
  const [dateKey, periodText] = String(key || "").split("|")
  const period = Number.parseInt(periodText, 10)

  if (!dateKey || !Number.isInteger(period)) {
    return null
  }

  return { dateKey, period }
}

const getTimelinePeriodGap = (leftKey, rightKey) => {
  const left = parseTimelineKey(leftKey)
  const right = parseTimelineKey(rightKey)

  if (!left || !right || left.dateKey !== right.dateKey) {
    return null
  }

  return right.period - left.period
}

const getFreePeriodsBetween = (leftPeriod, rightPeriod) => {
  const periods = []

  for (let period = Number(leftPeriod) + 1; period < Number(rightPeriod); period += 1) {
    periods.push(period)
  }

  return periods
}

const getPreferredBreakDistance = (freePeriods, preferredPeriods = DEFAULT_PREFERRED_BREAK_PERIODS) => {
  if (!Array.isArray(freePeriods) || freePeriods.length === 0) {
    return 0
  }

  const preferredSet = new Set(preferredPeriods)
  if (freePeriods.some((period) => preferredSet.has(period))) {
    return 0
  }

  return Math.min(
    ...freePeriods.map((freePeriod) =>
      Math.min(...preferredPeriods.map((preferredPeriod) => Math.abs(freePeriod - preferredPeriod)))
    )
  )
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
      roomClassMode: room?.roomClassMode,
      classMode: room?.classMode,
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
  const participantIdentityIndex = buildParticipantIdentityIndex(slotContexts)

  for (const context of Array.isArray(slotContexts) ? slotContexts : []) {
    if (context.isEmpty) {
      continue
    }

    const uniquePeople = new Map()
    for (const participant of context.participants) {
      const personKey = participantIdentityIndex.resolve(participant)
      if (!personKey) {
        continue
      }

      if (!uniquePeople.has(personKey)) {
        uniquePeople.set(personKey, {
          personKey,
          personId: normalizePersonId(participant.personId),
          personName: compactText(participant.name) || normalizePersonId(participant.personId) || "Personne inconnue",
          roles: new Set()
        })
      }

      const currentParticipant = uniquePeople.get(personKey)
      if (!currentParticipant.personId && participant.personId) {
        currentParticipant.personId = normalizePersonId(participant.personId)
      }
      if (
        (!currentParticipant.personName || currentParticipant.personName === "Personne inconnue") &&
        compactText(participant.name)
      ) {
        currentParticipant.personName = compactText(participant.name)
      }
      currentParticipant.roles.add(participant.role)
    }

    for (const [personKey, participant] of uniquePeople.entries()) {
      if (!personSlotGroups.has(personKey)) {
        personSlotGroups.set(personKey, new Map())
      }

      const slotGroups = personSlotGroups.get(personKey)
      if (!slotGroups.has(context.slotKey)) {
        slotGroups.set(context.slotKey, {
          personKey,
          personId: participant.personId,
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
      if (!group.personId && participant.personId) {
        group.personId = participant.personId
      }
      if (
        (!group.personName || group.personName === "Personne inconnue") &&
        participant.personName &&
        participant.personName !== "Personne inconnue"
      ) {
        group.personName = participant.personName
      }
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
  const personWaitingSummaries = []

  let personOverlapGroupCount = 0
  let personOverlapCount = 0
  let sequenceViolationCount = 0
  let sequenceExcessCount = 0
  let classMismatchCount = 0
  let movementPenalty = 0
  let waitingGapCount = 0
  let forcedBreakCount = 0
  let offMealBreakCount = 0
  let mealBreakDistancePenalty = 0

  for (const [personKey, slotGroupsMap] of personSlotGroups.entries()) {
    const slotGroups = Array.from(slotGroupsMap.values()).sort((left, right) => {
      const leftIndex = Number.isInteger(left.timelineIndex) ? left.timelineIndex : Number.MAX_SAFE_INTEGER
      const rightIndex = Number.isInteger(right.timelineIndex) ? right.timelineIndex : Number.MAX_SAFE_INTEGER

      return leftIndex - rightIndex || String(left.slotKey).localeCompare(String(right.slotKey))
    })
    let personWaitingGapCount = 0
    let personForcedBreakCount = 0
    let personOffMealBreakCount = 0
    let personMealBreakDistancePenalty = 0

    for (const slotGroup of slotGroups) {
      if (slotGroup.refs.size <= 1) {
        continue
      }

      personOverlapGroupCount += 1
      personOverlapCount += slotGroup.refs.size - 1
      personOverlaps.push({
        personId: slotGroup.personId,
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

    const slotGroupsByDate = new Map()
    slotGroups.forEach((slotGroup) => {
      const parsedSlot = parseTimelineKey(slotGroup.slotKey)
      const dateKey = parsedSlot?.dateKey || compactText(slotGroup.slotKey).split("|")[0]

      if (!dateKey) {
        return
      }

      if (!slotGroupsByDate.has(dateKey)) {
        slotGroupsByDate.set(dateKey, [])
      }

      slotGroupsByDate.get(dateKey).push({
        ...slotGroup,
        period: parsedSlot?.period || slotGroup.period
      })
    })

    for (const dateSlotGroups of slotGroupsByDate.values()) {
      const sortedDateGroups = dateSlotGroups
        .filter((slotGroup) => Number.isInteger(Number(slotGroup.period)))
        .sort((left, right) => Number(left.period) - Number(right.period))

      if (sortedDateGroups.length <= 1) {
        continue
      }

      const runs = []
      let currentRun = {
        startPeriod: Number(sortedDateGroups[0].period),
        endPeriod: Number(sortedDateGroups[0].period),
        length: 1,
        maxConsecutiveTpi: getMaxConsecutiveTpiLimit(sortedDateGroups[0].maxConsecutiveTpi)
      }

      for (let index = 1; index < sortedDateGroups.length; index += 1) {
        const previousGroup = sortedDateGroups[index - 1]
        const currentGroup = sortedDateGroups[index]
        const previousPeriod = Number(previousGroup.period)
        const currentPeriod = Number(currentGroup.period)
        const gap = Math.max(currentPeriod - previousPeriod - 1, 0)

        waitingGapCount += gap
        personWaitingGapCount += gap

        if (gap === 0) {
          currentRun.endPeriod = currentPeriod
          currentRun.length += 1
          currentRun.maxConsecutiveTpi = Math.min(
            getMaxConsecutiveTpiLimit(currentRun.maxConsecutiveTpi),
            getMaxConsecutiveTpiLimit(currentGroup.maxConsecutiveTpi)
          )
          continue
        }

        runs.push(currentRun)
        currentRun = {
          startPeriod: currentPeriod,
          endPeriod: currentPeriod,
          length: 1,
          maxConsecutiveTpi: getMaxConsecutiveTpiLimit(currentGroup.maxConsecutiveTpi)
        }
      }

      runs.push(currentRun)

      for (let runIndex = 0; runIndex < runs.length - 1; runIndex += 1) {
        const leftRun = runs[runIndex]
        const rightRun = runs[runIndex + 1]
        const maxConsecutiveTpi = Math.min(
          getMaxConsecutiveTpiLimit(leftRun.maxConsecutiveTpi),
          getMaxConsecutiveTpiLimit(rightRun.maxConsecutiveTpi)
        )

        if (leftRun.length + rightRun.length <= maxConsecutiveTpi) {
          continue
        }

        forcedBreakCount += 1
        personForcedBreakCount += 1
        const freePeriods = getFreePeriodsBetween(leftRun.endPeriod, rightRun.startPeriod)
        const preferredDistance = getPreferredBreakDistance(freePeriods)

        if (preferredDistance > 0) {
          offMealBreakCount += 1
          mealBreakDistancePenalty += preferredDistance
          personOffMealBreakCount += 1
          personMealBreakDistancePenalty += preferredDistance
        }
      }
    }

    const firstSlotGroup = slotGroups[0] || {}
    const personWaitingPenalty = personWaitingGapCount * 100
    const personMealBreakPenalty = (personOffMealBreakCount * 150) + (personMealBreakDistancePenalty * 25)

    personWaitingSummaries.push({
      personKey,
      personId: firstSlotGroup.personId,
      personName: firstSlotGroup.personName,
      waitingGapCount: personWaitingGapCount,
      forcedBreakCount: personForcedBreakCount,
      offMealBreakCount: personOffMealBreakCount,
      mealBreakDistancePenalty: personMealBreakDistancePenalty,
      waitingScore: personWaitingPenalty + personMealBreakPenalty
    })

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
          personId: slotGroups[startIndex].personId,
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
      const periodGap = getTimelinePeriodGap(previous.slotKey, current.slotKey)

      if (periodGap === 1) {
        if (previous.roomKey !== current.roomKey) {
          movementPenalty += previous.roomSite === current.roomSite ? 2 : 4
        }
        continue
      }

      if (periodGap === 2 && previous.roomKey !== current.roomKey) {
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
  const waitingPenalty = waitingGapCount * 100
  const mealBreakPenalty = (offMealBreakCount * 150) + (mealBreakDistancePenalty * 25)
  const waitingScore = waitingPenalty + mealBreakPenalty
  const score = overlapPenalty + classMismatchPenalty + sequencePenalty + movementScore

  return {
    personSlotGroups,
    personOverlaps,
    sequenceViolations,
    classMismatches,
    personWaitingSummaries,
    summary: {
      personOverlapGroupCount,
      personOverlapCount,
      sequenceViolationCount,
      sequenceExcessCount,
      classMismatchCount,
      movementPenalty,
      waitingGapCount,
      forcedBreakCount,
      offMealBreakCount,
      mealBreakDistancePenalty,
      overlapPenalty,
      classMismatchPenalty,
      sequencePenalty,
      movementScore,
      waitingPenalty,
      mealBreakPenalty,
      waitingScore,
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

const normalizeReference = (value) => compactText(value)

const getIssueTargetReferences = (validationResult = {}, allowedIssueTypes = null) => {
  const allowedTypes = allowedIssueTypes instanceof Set
    ? allowedIssueTypes
    : Array.isArray(allowedIssueTypes)
      ? new Set(allowedIssueTypes)
      : null

  const issues = Array.isArray(validationResult?.issues) ? validationResult.issues : []
  const references = new Set()

  for (const issue of issues) {
    const issueType = compactText(issue?.type)
    if (allowedTypes && !allowedTypes.has(issueType)) {
      continue
    }

    const issueReferences = Array.isArray(issue?.references)
      ? issue.references
      : [issue?.reference]

    issueReferences
      .map(normalizeReference)
      .filter(Boolean)
      .forEach((reference) => references.add(reference))
  }

  return references
}

const hasOfferActivity = (offer) => {
  if (!offer || typeof offer !== "object") {
    return false
  }

  return offer.isValidated === true ||
    (Array.isArray(offer.submit) && offer.submit.length > 0)
}

const hasProtectedPlanningState = (context = {}) => {
  if (!context || context.isEmpty) {
    return false
  }

  const tpi = context.tpi || {}
  return hasOfferActivity(tpi?.expert1?.offres) ||
    hasOfferActivity(tpi?.expert2?.offres) ||
    hasOfferActivity(tpi?.boss?.offres)
}

const hasSealedPlanningState = (context = {}) => {
  if (!context || context.isEmpty) {
    return false
  }

  return isTpiPlanningSealed(context.tpi)
}

const buildContextSnapshot = (context = {}) => ({
  reference: normalizeReference(context.reference),
  candidat: compactText(context?.tpi?.candidat),
  dateKey: compactText(context.roomDateKey),
  period: context.period,
  roomName: compactText(context.roomName),
  roomSite: compactText(context.roomSite),
  isEmpty: context.isEmpty === true
})

const buildSwapPreview = (leftContext, rightContext) => ({
  left: buildContextSnapshot(leftContext),
  right: buildContextSnapshot(rightContext)
})

const buildAnalysisIssueKeys = (analysis = {}) => {
  const keys = new Set()

  ;(Array.isArray(analysis.personOverlaps) ? analysis.personOverlaps : []).forEach((issue) => {
    keys.add([
      "person_overlap",
      compactText(issue.personId || issue.personName),
      compactText(issue.slotKey),
      (Array.isArray(issue.references) ? issue.references : [])
        .map(normalizeReference)
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right))
        .join(",")
    ].join("|"))
  })

  ;(Array.isArray(analysis.sequenceViolations) ? analysis.sequenceViolations : []).forEach((issue) => {
    keys.add([
      "consecutive_limit",
      compactText(issue.personId || issue.personName),
      compactText(issue.consecutiveCount),
      (Array.isArray(issue.slotKeys) ? issue.slotKeys : [])
        .map(compactText)
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right))
        .join(",")
    ].join("|"))
  })

  ;(Array.isArray(analysis.classMismatches) ? analysis.classMismatches : []).forEach((issue) => {
    keys.add([
      "room_class_mismatch",
      normalizeReference(issue.reference),
      compactText(issue.roomSite),
      compactText(issue.roomName),
      compactText(issue.slotKey)
    ].join("|"))
  })

  return keys
}

const hasNewAnalysisIssues = (candidate, current) => {
  const currentKeys = buildAnalysisIssueKeys(current)
  const candidateKeys = buildAnalysisIssueKeys(candidate)

  for (const key of candidateKeys) {
    if (!currentKeys.has(key)) {
      return true
    }
  }

  return false
}

const getAnalysisIssueLoad = (analysis = {}) => {
  const summary = analysis.summary || {}
  return Number(summary.personOverlapCount || 0) +
    Number(summary.classMismatchCount || 0) +
    Number(summary.sequenceExcessCount || 0)
}

const buildPersonWaitingSummaryMap = (analysis = {}) => {
  const summaries = Array.isArray(analysis.personWaitingSummaries)
    ? analysis.personWaitingSummaries
    : []

  return new Map(
    summaries
      .map((summary) => [
        compactText(summary.personKey || summary.personId || summary.personName),
        {
          waitingGapCount: Number(summary.waitingGapCount || 0),
          waitingScore: Number(summary.waitingScore || 0)
        }
      ])
      .filter(([personKey]) => Boolean(personKey))
  )
}

const hasPersonWaitingRegression = (candidate, current) => {
  const candidateScores = buildPersonWaitingSummaryMap(candidate)
  const currentScores = buildPersonWaitingSummaryMap(current)

  for (const [personKey, currentSummary] of currentScores.entries()) {
    const candidateSummary = candidateScores.get(personKey) || {
      waitingGapCount: 0,
      waitingScore: 0
    }

    if (candidateSummary.waitingGapCount > currentSummary.waitingGapCount) {
      return true
    }

    if (
      candidateSummary.waitingGapCount === currentSummary.waitingGapCount &&
      candidateSummary.waitingScore > currentSummary.waitingScore
    ) {
      return true
    }
  }

  return false
}

const hasPlanningQualityRegression = (candidate, current) => {
  const guardedSummaryFields = [
    "personOverlapCount",
    "classMismatchCount",
    "sequenceViolationCount",
    "sequenceExcessCount"
  ]

  return guardedSummaryFields.some((field) =>
    Number(candidate?.summary?.[field] || 0) > Number(current?.summary?.[field] || 0)
  )
}

const shouldConsiderOptimizationSwap = (leftContext, rightContext, options = {}) => {
  const targetReferences = options.targetReferences instanceof Set
    ? options.targetReferences
    : new Set()
  const targetScope = options.targetScope === "expanded" ? "expanded" : "strict"
  const leftReference = normalizeReference(leftContext.reference)
  const rightReference = normalizeReference(rightContext.reference)
  const leftIsTarget = leftReference && targetReferences.has(leftReference)
  const rightIsTarget = rightReference && targetReferences.has(rightReference)

  if (options.sameSiteOnly === true && leftContext.roomSite !== rightContext.roomSite) {
    return false
  }

  if (hasSealedPlanningState(leftContext) || hasSealedPlanningState(rightContext)) {
    return false
  }

  if (options.preserveValidated === true) {
    if (hasProtectedPlanningState(leftContext) || hasProtectedPlanningState(rightContext)) {
      return false
    }
  }

  if (targetReferences.size === 0) {
    return true
  }

  if (!leftIsTarget && !rightIsTarget) {
    return false
  }

  if (targetScope === "expanded") {
    return true
  }

  return (leftIsTarget || leftContext.isEmpty) && (rightIsTarget || rightContext.isEmpty)
}

const isBetterAnalysis = (candidate, current, options = {}) => {
  if (!current) {
    return true
  }

  if (options.reduceWaitingTime === true) {
    const orderedSummaryFields = [
      "personOverlapCount",
      "classMismatchCount",
      "sequenceViolationCount",
      "waitingGapCount",
      "offMealBreakCount",
      "mealBreakDistancePenalty",
      "sequenceExcessCount",
      "movementPenalty",
      "score"
    ]

    for (const field of orderedSummaryFields) {
      const candidateValue = Number(candidate.summary?.[field] || 0)
      const currentValue = Number(current.summary?.[field] || 0)

      if (candidateValue !== currentValue) {
        return candidateValue < currentValue
      }
    }

    return false
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
  const sameDateOnly = options.sameDateOnly !== false
  const targetReferences = options?.targetReferences instanceof Set
    ? options.targetReferences
    : new Set((Array.isArray(options?.targetReferences) ? options.targetReferences : [])
      .map(normalizeReference)
      .filter(Boolean))

  let workingRooms = clonePlanningRooms(roomEntries)
  let currentAnalysis = analyzePlanningRooms(workingRooms, { soutenanceDates: normalizedDates })
  const baselineSummary = currentAnalysis.summary
  const timeline = currentAnalysis.timeline
  const roomContexts = currentAnalysis.roomContexts
  let swapCount = 0
  const swaps = []

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const slotContexts = buildSlotContexts(workingRooms, roomContexts, timeline)
    const contextsByDate = new Map()

    slotContexts.forEach((context, index) => {
      if (!context.slotKey) {
        return
      }

      const groupKey = sameDateOnly ? context.roomDateKey || "" : "__all__"
      if (!contextsByDate.has(groupKey)) {
        contextsByDate.set(groupKey, [])
      }

      contextsByDate.get(groupKey).push({
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

          if (
            targetReferences.size === 0 &&
            leftContext.period === rightContext.period
          ) {
            continue
          }

          if (leftContext.isEmpty && rightContext.isEmpty) {
            continue
          }

          if (!shouldConsiderOptimizationSwap(leftContext, rightContext, {
            ...options,
            targetReferences
          })) {
            continue
          }

          if (!canPlaceTpiInRoom(leftContext.tpi, rightContext) || !canPlaceTpiInRoom(rightContext.tpi, leftContext)) {
            continue
          }

          const nextRooms = cloneRoomsForSwap(workingRooms, leftContext, rightContext)
          const nextAnalysis = analyzePlanningRooms(nextRooms, { soutenanceDates: normalizedDates })

          if (
            options.reduceWaitingTime === true &&
            (
              hasPlanningQualityRegression(nextAnalysis, currentAnalysis) ||
              (
                options.preventPersonWaitingRegression !== false &&
                hasPersonWaitingRegression(nextAnalysis, currentAnalysis)
              )
            )
          ) {
            continue
          }

          if (!isBetterAnalysis(nextAnalysis, currentAnalysis, options)) {
            continue
          }

          if (options.preventNewIssues === true && hasNewAnalysisIssues(nextAnalysis, currentAnalysis)) {
            continue
          }

          if (options.requireIssueReduction === true && getAnalysisIssueLoad(nextAnalysis) >= getAnalysisIssueLoad(currentAnalysis)) {
            continue
          }

          if (!bestCandidate || isBetterAnalysis(nextAnalysis, bestCandidate.analysis, options)) {
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

    swaps.push(buildSwapPreview(bestCandidate.leftContext, bestCandidate.rightContext))
    workingRooms = bestCandidate.rooms
    currentAnalysis = bestCandidate.analysis
    swapCount += 1
  }

  return {
    rooms: workingRooms,
    changed: swapCount > 0,
    swapCount,
    swaps,
    targetReferences: Array.from(targetReferences),
    before: baselineSummary,
    after: {
      ...currentAnalysis.summary,
      personOverlaps: currentAnalysis.personOverlaps,
      sequenceViolations: currentAnalysis.sequenceViolations,
      classMismatches: currentAnalysis.classMismatches,
      personWaitingSummaries: currentAnalysis.personWaitingSummaries
    }
  }
}

export const buildTargetedPlanningOptimizationProposal = (roomEntries, options = {}) => {
  const settings = options.settings || {}
  const selectedIssueTypes = Array.isArray(settings.issueTypes) && settings.issueTypes.length > 0
    ? settings.issueTypes
    : ["person_overlap", "consecutive_limit", "room_class_mismatch"]
  const reduceWaitingTime = settings.reduceWaitingTime === true
  const targetReferences = getIssueTargetReferences(options.validationResult, selectedIssueTypes)
  const beforeAnalysis = analyzePlanningRooms(roomEntries, {
    soutenanceDates: options.soutenanceDates || []
  })

  if (targetReferences.size === 0 && !reduceWaitingTime) {
    return {
      rooms: Array.isArray(roomEntries) ? roomEntries : [],
      changed: false,
      swapCount: 0,
      swaps: [],
      targetReferences: [],
      reason: "no_target_references",
      before: beforeAnalysis.summary,
      after: {
        ...beforeAnalysis.summary,
        personOverlaps: beforeAnalysis.personOverlaps,
        sequenceViolations: beforeAnalysis.sequenceViolations,
        classMismatches: beforeAnalysis.classMismatches,
        personWaitingSummaries: beforeAnalysis.personWaitingSummaries
      }
    }
  }

  return optimizePlanningRooms(roomEntries, {
    soutenanceDates: options.soutenanceDates || [],
    maxPasses: Number.isInteger(Number(settings.maxSwaps)) && Number(settings.maxSwaps) > 0
      ? Number(settings.maxSwaps)
      : 3,
    targetReferences,
    targetScope: settings.mode === "expanded" ? "expanded" : "strict",
    sameDateOnly: true,
    sameSiteOnly: settings.sameSiteOnly !== false,
    preserveValidated: settings.preserveValidated !== false,
    preventNewIssues: true,
    requireIssueReduction: targetReferences.size > 0,
    reduceWaitingTime
  })
}
