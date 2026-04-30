const Slot = require('../models/slotModel')
const TpiPlanning = require('../models/tpiPlanningModel')
const Vote = require('../models/voteModel')
const { createTpiRoomModel } = require('../models/tpiRoomsModels')
const {
  MIN_TPI_PER_OPEN_ROOM,
  MAX_CONSECUTIVE_TPI,
  buildTimelineIndex,
  getMaxConsecutiveTpiLimit,
  getMinTpiPerOpenRoomTarget,
  toTimeStepKey
} = require('./planningRuleUtils')
const { getSharedPlanningCatalog } = require('./planningCatalogService')
const { getPlanningConfig } = require('./planningConfigService')
const {
  getRoomCompatibilityReport,
  inferTpiClassMode
} = require('./roomClassCompatibilityService')
const { buildVoteProposalContext } = require('./voteProposalOptionsService')
const {
  buildPlanifiableTpiQuery,
  filterPlanifiableTpis
} = require('./tpiPlanningVisibility')
const {
  normalizePreferredSoutenanceChoices
} = require('./personRegistryService')

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function normalizeLookup(value) {
  return compactText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase()
}

function toObjectIdString(value) {
  if (!value) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (value._id) {
    return String(value._id)
  }

  if (value.id) {
    return String(value.id)
  }

  return ''
}

function toIsoDateKey(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().slice(0, 10)
}

function normalizeDateKeyList(values = []) {
  const normalizedValues = []
  const seen = new Set()

  for (const value of (Array.isArray(values) ? values : [values])) {
    const dateKey = toIsoDateKey(value)

    if (!dateKey || seen.has(dateKey)) {
      continue
    }

    seen.add(dateKey)
    normalizedValues.push(dateKey)
  }

  return normalizedValues
}

function parseTimeToMinutes(value, fallbackMinutes = 8 * 60) {
  const text = compactText(value)
  if (!text) {
    return fallbackMinutes
  }

  const [hoursText, minutesText] = text.split(':')
  const hours = Number.parseInt(hoursText, 10)
  const minutes = Number.parseInt(minutesText || '0', 10)

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes < 0 || minutes >= 60) {
    return fallbackMinutes
  }

  return hours * 60 + minutes
}

function minutesToTimeString(totalMinutes) {
  const normalized = Math.max(Number(totalMinutes) || 0, 0)
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function formatPersonName(person) {
  if (!person) {
    return ''
  }

  if (typeof person.fullName === 'string' && person.fullName.trim()) {
    return person.fullName.trim()
  }

  const parts = [person.firstName, person.lastName]
    .map((part) => compactText(part))
    .filter(Boolean)

  if (parts.length > 0) {
    return parts.join(' ')
  }

  return compactText(person.email || person._id || person.id)
}

function parseTimeToDecimal(value) {
  const text = compactText(value)
  if (!text) {
    return 0
  }

  const [hoursText, minutesText] = text.split(':')
  const hours = Number.parseInt(hoursText, 10)
  const minutes = Number.parseInt(minutesText || '0', 10)

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return 0
  }

  return hours + (minutes / 60)
}

function buildStableNumericId(value) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

function extractLegacyRef(reference) {
  const rawReference = compactText(reference)
  const workflowMatch = rawReference.match(/^TPI-\d{4}-(.+)$/i)

  return workflowMatch?.[1]
    ? compactText(workflowMatch[1])
    : ''
}

function getLegacyReferenceValue(tpi) {
  const legacyReference = extractLegacyRef(tpi?.reference)
  if (legacyReference) {
    return legacyReference
  }

  return compactText(tpi?.reference) || null
}

function createEmptyLegacyOffers() {
  return {
    isValidated: false,
    submit: []
  }
}

function createEmptyLegacyTpiData(roomKey, periodIndex, slot = null) {
  return {
    refTpi: null,
    id: `${roomKey}_${periodIndex}`,
    period: periodIndex + 1,
    startTime: compactText(slot?.startTime),
    endTime: compactText(slot?.endTime),
    candidat: '',
    candidatPersonId: '',
    expert1: {
      name: '',
      personId: '',
      offres: createEmptyLegacyOffers()
    },
    expert2: {
      name: '',
      personId: '',
      offres: createEmptyLegacyOffers()
    },
    boss: {
      name: '',
      personId: '',
      offres: createEmptyLegacyOffers()
    }
  }
}

function inferLegacyRoomClassMode(entries = []) {
  const classModes = Array.from(
    new Set(
      (Array.isArray(entries) ? entries : [])
        .map((entry) => inferTpiClassMode(entry?.tpi))
        .filter(Boolean)
    )
  )

  return classModes.length === 1
    ? classModes[0]
    : null
}

function buildLegacyRoomConfig(slot, maxPeriod) {
  return {
    breakline: Number(slot?.config?.breakAfter || 0) / 60,
    tpiTime: Number(slot?.config?.duration || 60) / 60,
    firstTpiStart: parseTimeToDecimal(slot?.startTime),
    numSlots: maxPeriod,
    maxConsecutiveTpi: getMaxConsecutiveTpiLimit(slot?.config?.maxConsecutiveTpi, MAX_CONSECUTIVE_TPI),
    minTpiPerRoom: getMinTpiPerOpenRoomTarget(slot?.config?.minTpiPerRoom, MIN_TPI_PER_OPEN_ROOM)
  }
}

function getParticipantRecords(tpi) {
  return [
    { role: 'candidat', person: tpi?.candidat },
    { role: 'expert1', person: tpi?.expert1 },
    { role: 'expert2', person: tpi?.expert2 },
    { role: 'chefProjet', person: tpi?.chefProjet }
  ]
    .map((entry) => ({
      ...entry,
      personId: toObjectIdString(entry.person),
      personName: formatPersonName(entry.person),
      preferredChoices: normalizePreferredSoutenanceChoices(
        entry.person?.preferredSoutenanceChoices || [],
        entry.person?.preferredSoutenanceDates || []
      ),
      preferredDateKeys: normalizeDateKeyList(entry.person?.preferredSoutenanceDates || [])
    }))
    .filter((entry) => Boolean(entry.personId))
}

function getParticipantPreferredChoices(participant) {
  const directChoices = normalizePreferredSoutenanceChoices(
    participant?.preferredChoices || participant?.preferredSoutenanceChoices || [],
    participant?.preferredDateKeys || []
  )

  if (directChoices.length > 0) {
    return directChoices
  }

  return normalizePreferredSoutenanceChoices(
    participant?.person?.preferredSoutenanceChoices || [],
    participant?.person?.preferredSoutenanceDates || []
  )
}

function getParticipantPreferredDateKeys(participant) {
  const directKeys = Array.from(
    new Set(getParticipantPreferredChoices(participant).map((choice) => compactText(choice?.date)).filter(Boolean))
  )
  if (directKeys.length > 0) {
    return directKeys
  }

  return normalizeDateKeyList(participant?.person?.preferredSoutenanceDates || [])
}

function getParticipantPreferenceScore(participant, dateKey, period) {
  const preferredChoices = getParticipantPreferredChoices(participant)
  const matchingDateChoices = preferredChoices.filter((choice) => choice?.date === dateKey)

  if (matchingDateChoices.length === 0) {
    return 0
  }

  return matchingDateChoices.some((choice) => Number(choice?.period) === Number(period))
    ? 2
    : 1
}

function getDatePreferenceScore(task, dateKey) {
  if (!dateKey) {
    return 0
  }

  return (Array.isArray(task?.participants) ? task.participants : []).reduce(
    (total, participant) => total + (getParticipantPreferredDateKeys(participant).includes(dateKey) ? 1 : 0),
    0
  )
}

function getPlacementPreferenceScore(task, dateKey, period) {
  if (!dateKey || !Number.isInteger(Number(period))) {
    return 0
  }

  return (Array.isArray(task?.participants) ? task.participants : []).reduce(
    (total, participant) => total + getParticipantPreferenceScore(participant, dateKey, period),
    0
  )
}

function getTaskPreferredDateWeight(task) {
  const allowedDateKeys = Array.isArray(task?.allowedDateKeys) ? task.allowedDateKeys : []
  const siteNumSlots = Number.isInteger(Number(task?.siteContext?.numSlots)) && Number(task.siteContext.numSlots) > 0
    ? Number(task.siteContext.numSlots)
    : 0

  return allowedDateKeys.reduce((bestScore, dateKey) => {
    const dateScore = getDatePreferenceScore(task, dateKey)
    let slotScore = 0

    for (let period = 1; period <= siteNumSlots; period += 1) {
      slotScore = Math.max(slotScore, getPlacementPreferenceScore(task, dateKey, period))
    }

    return Math.max(bestScore, slotScore || dateScore)
  }, 0)
}

function getTpiFixedDateKeys(tpi) {
  return normalizeDateKeyList([
    tpi?.dates?.soutenance,
    tpi?.dateSoutenance,
    tpi?.soutenanceDateTime
  ])
}

function resolveTaskAllowedDateKeys(tpi, proposalAllowedDateKeys = []) {
  const classAllowedDateKeys = normalizeDateKeyList(proposalAllowedDateKeys)
  const fixedDateKeys = getTpiFixedDateKeys(tpi)

  if (fixedDateKeys.length === 0) {
    return classAllowedDateKeys
  }

  if (classAllowedDateKeys.length === 0) {
    return fixedDateKeys
  }

  const fixedDateSet = new Set(fixedDateKeys)
  const compatibleFixedDates = classAllowedDateKeys.filter((dateKey) => fixedDateSet.has(dateKey))

  return compatibleFixedDates.length > 0
    ? compatibleFixedDates
    : classAllowedDateKeys
}

function buildSiteContextIndex(catalogSites = [], planningConfig = {}) {
  const siteConfigs = Array.isArray(planningConfig?.siteConfigs) ? planningConfig.siteConfigs : []
  const siteConfigById = new Map()
  const siteConfigByCode = new Map()

  for (const siteConfig of siteConfigs) {
    const siteId = normalizeLookup(siteConfig?.siteId)
    const siteCode = normalizeLookup(siteConfig?.siteCode)

    if (siteId) {
      siteConfigById.set(siteId, siteConfig)
    }

    if (siteCode) {
      siteConfigByCode.set(siteCode, siteConfig)
    }
  }

  const siteContexts = []
  const siteContextByKey = new Map()

  for (const catalogSite of Array.isArray(catalogSites) ? catalogSites : []) {
    const siteId = compactText(catalogSite?.id)
    const siteCode = compactText(catalogSite?.code || catalogSite?.label).toUpperCase()
    const siteLabel = compactText(catalogSite?.label || catalogSite?.code || siteId)
    const activeRooms = Array.isArray(catalogSite?.roomDetails)
      ? catalogSite.roomDetails
        .filter((room) => room?.active !== false)
        .sort((left, right) => {
          const leftOrder = Number.isFinite(Number(left?.order)) ? Number(left.order) : Number.MAX_SAFE_INTEGER
          const rightOrder = Number.isFinite(Number(right?.order)) ? Number(right.order) : Number.MAX_SAFE_INTEGER

          if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder
          }

          return compactText(left?.label || left?.code).localeCompare(compactText(right?.label || right?.code))
        })
      : []
    const roomNames = activeRooms
      .map((room) => compactText(room?.label || room?.code))
      .filter(Boolean)
    const roomCapacityByName = new Map(
      activeRooms.map((room) => [
        compactText(room?.label || room?.code),
        Number.isFinite(Number(room?.capacity)) ? Number(room.capacity) : 1
      ])
    )
    const configMatch =
      siteConfigById.get(normalizeLookup(siteId)) ||
      siteConfigByCode.get(normalizeLookup(siteCode)) ||
      {}

    const siteKey = normalizeLookup(siteCode || siteId || siteLabel)
    const context = {
      siteKey,
      siteId,
      siteCode,
      siteLabel,
      roomNames,
      roomCapacityByName,
      numSlots: Number.isInteger(Number(configMatch?.numSlots)) && Number(configMatch.numSlots) > 0
        ? Number(configMatch.numSlots)
        : 8,
      maxConsecutiveTpi: getMaxConsecutiveTpiLimit(configMatch?.maxConsecutiveTpi, MAX_CONSECUTIVE_TPI),
      tpiTimeMinutes: Number.isFinite(Number(configMatch?.tpiTimeMinutes)) && Number(configMatch.tpiTimeMinutes) > 0
        ? Number(configMatch.tpiTimeMinutes)
        : 60,
      breaklineMinutes: Number.isFinite(Number(configMatch?.breaklineMinutes)) && Number(configMatch.breaklineMinutes) >= 0
        ? Number(configMatch.breaklineMinutes)
        : 10,
      firstTpiStartTime: compactText(configMatch?.firstTpiStartTime) || '08:00',
      manualRoomTarget: Number.isFinite(Number(configMatch?.manualRoomTarget)) && Number(configMatch.manualRoomTarget) >= 0
        ? Number(configMatch.manualRoomTarget)
        : null,
      minTpiPerRoom: getMinTpiPerOpenRoomTarget(
        configMatch?.minTpiPerRoom ?? configMatch?.minTpiPerOpenRoom ?? configMatch?.minRoomLoad,
        MIN_TPI_PER_OPEN_ROOM
      )
    }

    siteContexts.push(context)
    siteContextByKey.set(siteKey, context)
    if (siteId) {
      siteContextByKey.set(normalizeLookup(siteId), context)
    }
    if (siteCode) {
      siteContextByKey.set(normalizeLookup(siteCode), context)
    }
    if (siteLabel) {
      siteContextByKey.set(normalizeLookup(siteLabel), context)
    }
  }

  return {
    siteContexts,
    resolveSiteContext(siteValue) {
      const normalizedSite = normalizeLookup(siteValue)
      return normalizedSite ? siteContextByKey.get(normalizedSite) || null : null
    }
  }
}

function buildSchedulingTask(tpi, planningConfig, resolveSiteContext) {
  const siteValue = compactText(tpi?.site)
  const siteContext = resolveSiteContext(siteValue)
  const proposalContext = buildVoteProposalContext(tpi, planningConfig)
  const allowedDateKeys = resolveTaskAllowedDateKeys(tpi, proposalContext?.allowedDateKeys)
  const participants = getParticipantRecords(tpi)

  return {
    tpi,
    tpiId: toObjectIdString(tpi?._id),
    reference: compactText(tpi?.reference),
    siteValue,
    siteContext,
    allowedDateKeys,
    participants,
    preferredDateWeight: getTaskPreferredDateWeight({
      allowedDateKeys,
      participants,
      siteContext
    }),
    repeatedParticipantWeight: 0,
    issues: []
  }
}

function buildTimeline(tasks = []) {
  const maxPeriodsByDate = new Map()

  for (const task of tasks) {
    const numSlots = Number(task?.siteContext?.numSlots || 0)
    for (const dateKey of Array.isArray(task?.allowedDateKeys) ? task.allowedDateKeys : []) {
      if (!dateKey || numSlots <= 0) {
        continue
      }

      const previousValue = Number(maxPeriodsByDate.get(dateKey) || 0)
      if (numSlots > previousValue) {
        maxPeriodsByDate.set(dateKey, numSlots)
      }
    }
  }

  const timelineSlots = []

  for (const [dateKey, numSlots] of maxPeriodsByDate.entries()) {
    for (let period = 1; period <= numSlots; period += 1) {
      timelineSlots.push({
        date: dateKey,
        period
      })
    }
  }

  timelineSlots.sort((left, right) => {
    const leftKey = `${toIsoDateKey(left.date)}|${String(left.period).padStart(2, '0')}`
    const rightKey = `${toIsoDateKey(right.date)}|${String(right.period).padStart(2, '0')}`
    return leftKey.localeCompare(rightKey)
  })

  return buildTimelineIndex(timelineSlots)
}

function buildFrequencyIndex(tasks = []) {
  const frequency = new Map()

  for (const task of tasks) {
    for (const participant of task.participants || []) {
      frequency.set(
        participant.personId,
        Number(frequency.get(participant.personId) || 0) + 1
      )
    }
  }

  return frequency
}

function getSiteDateKey(siteContext, dateKey) {
  return `${compactText(siteContext?.siteKey)}|${compactText(dateKey)}`
}

function getRoomKey(siteContext, roomName) {
  return `${compactText(siteContext?.siteKey)}|${compactText(roomName)}`
}

function getRoomSlotKey(siteContext, roomName, dateKey, period) {
  return `${getRoomKey(siteContext, roomName)}|${compactText(dateKey)}|${period}`
}

function getGeneratedRoomsForDate(state, siteContext, dateKey) {
  const siteDateKey = getSiteDateKey(siteContext, dateKey)
  if (!state.generatedRoomsBySiteDate.has(siteDateKey)) {
    state.generatedRoomsBySiteDate.set(siteDateKey, [])
  }

  return state.generatedRoomsBySiteDate.get(siteDateKey)
}

function buildSyntheticRoomName(siteContext, index) {
  const roomIndex = Number(index) + 1
  const siteCode = compactText(siteContext?.siteCode || siteContext?.siteLabel || 'ROOM').toUpperCase()
  return `${siteCode} ${String(roomIndex).padStart(2, '0')}`
}

function getRoomNameAt(siteContext, index) {
  const roomNames = Array.isArray(siteContext?.roomNames) ? siteContext.roomNames : []
  if (index < roomNames.length) {
    return roomNames[index]
  }

  return buildSyntheticRoomName(siteContext, index)
}

function getRoomIndexForName(siteContext, roomName) {
  const roomNames = Array.isArray(siteContext?.roomNames) ? siteContext.roomNames : []
  const existingIndex = roomNames.findIndex((candidate) => compactText(candidate) === compactText(roomName))

  if (existingIndex >= 0) {
    return existingIndex
  }

  return roomNames.length + 100
}

function isRoomCompatibleWithTask(siteContext, roomName, task) {
  const compatibility = getRoomCompatibilityReport(
    {
      name: roomName,
      roomName,
      site: siteContext?.siteCode || siteContext?.siteLabel || siteContext?.siteKey || ''
    },
    task?.tpi
  )

  return compatibility.compatible
}

function getNextCandidateRoomName(siteContext, generatedRooms = [], task = null) {
  const generatedRoomNames = new Set(
    (Array.isArray(generatedRooms) ? generatedRooms : [])
      .map((roomName) => compactText(roomName))
      .filter(Boolean)
  )
  const configuredRoomNames = Array.isArray(siteContext?.roomNames)
    ? siteContext.roomNames
      .map((roomName) => compactText(roomName))
      .filter(Boolean)
    : []

  for (const roomName of configuredRoomNames) {
    if (generatedRoomNames.has(roomName)) {
      continue
    }

    if (!task || isRoomCompatibleWithTask(siteContext, roomName, task)) {
      return roomName
    }
  }

  let syntheticIndex = configuredRoomNames.length
  for (let guard = 0; guard < 1000; guard += 1) {
    const roomName = buildSyntheticRoomName(siteContext, syntheticIndex)
    syntheticIndex += 1

    if (generatedRoomNames.has(roomName)) {
      continue
    }

    if (!task || isRoomCompatibleWithTask(siteContext, roomName, task)) {
      return roomName
    }
  }

  return ''
}

function buildState() {
  return {
    generatedRoomsBySiteDate: new Map(),
    roomAssignments: new Map(),
    personOccupancyByTimeKey: new Map(),
    personOccupiedKeysById: new Map(),
    personDailyRoomByDate: new Map(),
    personDailyPeriodsByDate: new Map()
  }
}

function cloneSetMap(source) {
  const clone = new Map()

  for (const [key, value] of source.entries()) {
    clone.set(key, value instanceof Set ? new Set(value) : value)
  }

  return clone
}

function cloneNestedSetMap(source) {
  const clone = new Map()

  for (const [key, nestedMap] of source.entries()) {
    const nestedClone = new Map()

    for (const [nestedKey, value] of nestedMap.entries()) {
      nestedClone.set(nestedKey, value instanceof Set ? new Set(value) : value)
    }

    clone.set(key, nestedClone)
  }

  return clone
}

function cloneState(state) {
  const generatedRoomsBySiteDate = new Map()

  for (const [key, roomNames] of state.generatedRoomsBySiteDate.entries()) {
    generatedRoomsBySiteDate.set(key, Array.isArray(roomNames) ? [...roomNames] : roomNames)
  }

  return {
    generatedRoomsBySiteDate,
    roomAssignments: new Map(state.roomAssignments),
    personOccupancyByTimeKey: cloneSetMap(state.personOccupancyByTimeKey),
    personOccupiedKeysById: cloneSetMap(state.personOccupiedKeysById),
    personDailyRoomByDate: cloneNestedSetMap(state.personDailyRoomByDate),
    personDailyPeriodsByDate: cloneNestedSetMap(state.personDailyPeriodsByDate)
  }
}

function markPersonOnTimeKey(state, personId, timeKey) {
  if (!state.personOccupancyByTimeKey.has(timeKey)) {
    state.personOccupancyByTimeKey.set(timeKey, new Set())
  }

  state.personOccupancyByTimeKey.get(timeKey).add(personId)

  if (!state.personOccupiedKeysById.has(personId)) {
    state.personOccupiedKeysById.set(personId, new Set())
  }

  state.personOccupiedKeysById.get(personId).add(timeKey)
}

function setPersonDailyRoom(state, personId, dateKey, roomKey) {
  if (!state.personDailyRoomByDate.has(personId)) {
    state.personDailyRoomByDate.set(personId, new Map())
  }

  const byDate = state.personDailyRoomByDate.get(personId)
  if (!byDate.has(dateKey)) {
    byDate.set(dateKey, new Set())
  }

  byDate.get(dateKey).add(roomKey)
}

function addPersonDailyPeriod(state, personId, dateKey, period) {
  if (!state.personDailyPeriodsByDate.has(personId)) {
    state.personDailyPeriodsByDate.set(personId, new Map())
  }

  const byDate = state.personDailyPeriodsByDate.get(personId)
  if (!byDate.has(dateKey)) {
    byDate.set(dateKey, new Set())
  }

  byDate.get(dateKey).add(Number(period))
}

function getPreferredRoomsForTask(state, task, dateKey) {
  const roomWeights = new Map()

  for (const participant of task.participants || []) {
    const roomKeys = state.personDailyRoomByDate.get(participant.personId)?.get(dateKey)
    if (!(roomKeys instanceof Set)) {
      continue
    }

    for (const roomKey of roomKeys) {
      roomWeights.set(roomKey, Number(roomWeights.get(roomKey) || 0) + 1)
    }
  }

  return Array.from(roomWeights.entries())
    .map(([roomKey, weight]) => ({ roomKey, weight }))
    .sort((left, right) => {
      if (right.weight !== left.weight) {
        return right.weight - left.weight
      }

      return String(left.roomKey || '').localeCompare(String(right.roomKey || ''))
    })
}

function hasPersonConflictOnTimeKey(state, task, timeKey) {
  const occupiedPeople = state.personOccupancyByTimeKey.get(timeKey)
  if (!occupiedPeople) {
    return false
  }

  return (task.participants || []).some((participant) => occupiedPeople.has(participant.personId))
}

function exceedsConsecutiveLimit(state, timeline, personId, timeKey, maxConsecutiveTpi = MAX_CONSECUTIVE_TPI) {
  const candidateIndex = timeline.indexByKey.get(timeKey)
  if (!Number.isInteger(candidateIndex)) {
    return false
  }

  const occupiedKeys = state.personOccupiedKeysById.get(personId)

  let leftIndex = candidateIndex
  while (leftIndex > 0) {
    const previousKey = timeline.timeSteps[leftIndex - 1]
    if (!occupiedKeys?.has(previousKey)) {
      break
    }
    leftIndex -= 1
  }

  let rightIndex = candidateIndex
  while (rightIndex < timeline.timeSteps.length - 1) {
    const nextKey = timeline.timeSteps[rightIndex + 1]
    if (!occupiedKeys?.has(nextKey)) {
      break
    }
    rightIndex += 1
  }

  const consecutiveCount = rightIndex - leftIndex + 1
  return consecutiveCount > getMaxConsecutiveTpiLimit(maxConsecutiveTpi, MAX_CONSECUTIVE_TPI)
}

function isParticipantAvailable(participant, dateKey, period) {
  if (!participant?.person) {
    return false
  }

  if (typeof participant.person.isAvailableOn === 'function') {
    return participant.person.isAvailableOn(new Date(`${dateKey}T08:00:00.000Z`), period)
  }

  return true
}

function buildCandidateRooms(state, siteContext, dateKey, preferredRooms = [], task = null) {
  const generatedRooms = getGeneratedRoomsForDate(state, siteContext, dateKey)
  const candidateRooms = new Map()

  const addCandidateRoom = (roomName, options = {}) => {
    const normalizedRoomName = compactText(roomName)
    if (!normalizedRoomName) {
      return
    }

    if (task && !isRoomCompatibleWithTask(siteContext, normalizedRoomName, task)) {
      return
    }

    const existing = candidateRooms.get(normalizedRoomName)
    const nextValue = {
      roomName: normalizedRoomName,
      isNew: options.isNew === true,
      roomIndex: getRoomIndexForName(siteContext, normalizedRoomName),
      preferredRoomWeight: Number.isFinite(Number(options.preferredRoomWeight))
        ? Number(options.preferredRoomWeight)
        : 0
    }

    if (existing) {
      existing.isNew = existing.isNew && nextValue.isNew
      existing.preferredRoomWeight = Math.max(existing.preferredRoomWeight, nextValue.preferredRoomWeight)
      existing.roomIndex = Math.min(existing.roomIndex, nextValue.roomIndex)
      return
    }

    candidateRooms.set(normalizedRoomName, nextValue)
  }

  for (const preferredRoom of Array.isArray(preferredRooms) ? preferredRooms : []) {
    const roomKey = compactText(preferredRoom?.roomKey)
    const [, roomName] = roomKey.split('|')
    addCandidateRoom(roomName, {
      isNew: !generatedRooms.includes(roomName),
      preferredRoomWeight: preferredRoom?.weight || 0
    })
  }

  for (const roomName of generatedRooms) {
    addCandidateRoom(roomName, {
      isNew: false,
      preferredRoomWeight: 0
    })
  }

  const nextRoomName = getNextCandidateRoomName(siteContext, generatedRooms, task)
  if (!generatedRooms.includes(nextRoomName)) {
    addCandidateRoom(nextRoomName, {
      isNew: true,
      preferredRoomWeight: 0
    })
  }

  if (candidateRooms.size === 0) {
    addCandidateRoom(getNextCandidateRoomName(siteContext, [], task) || getRoomNameAt(siteContext, 0), {
      isNew: true,
      preferredRoomWeight: 0
    })
  }

  return Array.from(candidateRooms.values()).sort((left, right) => {
    if (right.preferredRoomWeight !== left.preferredRoomWeight) {
      return right.preferredRoomWeight - left.preferredRoomWeight
    }

    if (left.isNew !== right.isNew) {
      return left.isNew ? 1 : -1
    }

    if (left.roomIndex !== right.roomIndex) {
      return left.roomIndex - right.roomIndex
    }

    return left.roomName.localeCompare(right.roomName)
  })
}

function computeProximityPenalty(state, task, dateKey, period) {
  const distances = []

  for (const participant of task.participants || []) {
    const occupiedPeriods = state.personDailyPeriodsByDate.get(participant.personId)?.get(dateKey)
    if (!occupiedPeriods || occupiedPeriods.size === 0) {
      continue
    }

    let minDistance = Number.MAX_SAFE_INTEGER
    for (const occupiedPeriod of occupiedPeriods) {
      minDistance = Math.min(minDistance, Math.abs(Number(occupiedPeriod) - Number(period)))
    }

    if (Number.isFinite(minDistance) && minDistance !== Number.MAX_SAFE_INTEGER) {
      distances.push(minDistance)
    }
  }

  return distances.length > 0
    ? Math.min(...distances)
    : 0
}

function enumerateCandidatePlacements(task, state, timeline) {
  const placements = []
  const siteContext = task?.siteContext

  if (!siteContext || !Array.isArray(task?.allowedDateKeys) || task.allowedDateKeys.length === 0) {
    return placements
  }

  task.allowedDateKeys.forEach((dateKey, dateIndex) => {
    const preferredRooms = getPreferredRoomsForTask(state, task, dateKey)
    const candidateRooms = buildCandidateRooms(state, siteContext, dateKey, preferredRooms, task)

    for (let period = 1; period <= siteContext.numSlots; period += 1) {
      const timeKey = toTimeStepKey(dateKey, period)
      if (!timeKey) {
        continue
      }

      if (hasPersonConflictOnTimeKey(state, task, timeKey)) {
        continue
      }

      const hasUnavailableParticipant = (task.participants || []).some((participant) =>
        !isParticipantAvailable(participant, dateKey, period)
      )
      if (hasUnavailableParticipant) {
        continue
      }

      const breaksConsecutiveRule = (task.participants || []).some((participant) =>
        exceedsConsecutiveLimit(state, timeline, participant.personId, timeKey, siteContext.maxConsecutiveTpi)
      )
      if (breaksConsecutiveRule) {
        continue
      }

      for (const room of candidateRooms) {
        const roomSlotKey = getRoomSlotKey(siteContext, room.roomName, dateKey, period)
        if (state.roomAssignments.has(roomSlotKey)) {
          continue
        }

        placements.push({
          dateKey,
          period,
          roomName: room.roomName,
          siteKey: siteContext.siteKey,
          siteCode: siteContext.siteCode,
          roomKey: getRoomKey(siteContext, room.roomName),
          isNewRoom: room.isNew,
          roomIndex: room.roomIndex,
          preferredRoomWeight: Number(room.preferredRoomWeight || 0),
          dateIndex,
          preferredPreferenceScore: getPlacementPreferenceScore(task, dateKey, period),
          preferredParticipantCount: getDatePreferenceScore(task, dateKey),
          proximityPenalty: computeProximityPenalty(state, task, dateKey, period)
        })
      }
    }
  })

  placements.sort((left, right) => {
    if (left.isNewRoom !== right.isNewRoom) {
      return left.isNewRoom ? 1 : -1
    }

    if (left.preferredRoomWeight !== right.preferredRoomWeight) {
      return right.preferredRoomWeight - left.preferredRoomWeight
    }

    if (left.preferredPreferenceScore !== right.preferredPreferenceScore) {
      return right.preferredPreferenceScore - left.preferredPreferenceScore
    }

    if (left.preferredParticipantCount !== right.preferredParticipantCount) {
      return right.preferredParticipantCount - left.preferredParticipantCount
    }

    if (left.dateIndex !== right.dateIndex) {
      return left.dateIndex - right.dateIndex
    }

    if (left.proximityPenalty !== right.proximityPenalty) {
      return left.proximityPenalty - right.proximityPenalty
    }

    if (left.period !== right.period) {
      return left.period - right.period
    }

    if (left.roomIndex !== right.roomIndex) {
      return left.roomIndex - right.roomIndex
    }

    return left.roomName.localeCompare(right.roomName)
  })

  return placements
}

function applyPlacement(state, task, placement) {
  const siteContext = task.siteContext
  const siteDateRooms = getGeneratedRoomsForDate(state, siteContext, placement.dateKey)

  if (!siteDateRooms.includes(placement.roomName)) {
    siteDateRooms.push(placement.roomName)
  }

  const roomSlotKey = getRoomSlotKey(siteContext, placement.roomName, placement.dateKey, placement.period)
  state.roomAssignments.set(roomSlotKey, {
    task,
    placement
  })

  const timeKey = toTimeStepKey(placement.dateKey, placement.period)
  const roomKey = getRoomKey(siteContext, placement.roomName)

  for (const participant of task.participants || []) {
    markPersonOnTimeKey(state, participant.personId, timeKey)
    setPersonDailyRoom(state, participant.personId, placement.dateKey, roomKey)
    addPersonDailyPeriod(state, participant.personId, placement.dateKey, placement.period)
  }
}

function createManualIssue(task, reason) {
  return {
    tpiId: task.tpiId,
    reference: task.reference,
    reason
  }
}

function compareTaskSearchEntries(left, right) {
  if (left.candidates.length !== right.candidates.length) {
    return left.candidates.length - right.candidates.length
  }

  const leftDateCount = Array.isArray(left.task?.allowedDateKeys) ? left.task.allowedDateKeys.length : 0
  const rightDateCount = Array.isArray(right.task?.allowedDateKeys) ? right.task.allowedDateKeys.length : 0

  if (leftDateCount !== rightDateCount) {
    return leftDateCount - rightDateCount
  }

  if (right.task.repeatedParticipantWeight !== left.task.repeatedParticipantWeight) {
    return right.task.repeatedParticipantWeight - left.task.repeatedParticipantWeight
  }

  if (right.task.preferredDateWeight !== left.task.preferredDateWeight) {
    return right.task.preferredDateWeight - left.task.preferredDateWeight
  }

  return compactText(left.task.reference).localeCompare(compactText(right.task.reference))
}

function buildSearchEntries(tasks, state, timeline) {
  return tasks.map((task, index) => ({
    index,
    task,
    candidates: enumerateCandidatePlacements(task, state, timeline)
  }))
}

function searchCompleteAssignments(tasks, timeline, options = {}) {
  const nodeLimit = Number.isInteger(Number(options.nodeLimit)) && Number(options.nodeLimit) > 0
    ? Number(options.nodeLimit)
    : 50000
  let visitedNodes = 0

  const visit = (remainingTasks, state, assignments) => {
    visitedNodes += 1

    if (visitedNodes > nodeLimit) {
      return null
    }

    if (remainingTasks.length === 0) {
      return {
        assignments,
        state
      }
    }

    const entries = buildSearchEntries(remainingTasks, state, timeline)
    if (entries.some((entry) => entry.candidates.length === 0)) {
      return null
    }

    entries.sort(compareTaskSearchEntries)
    const selectedEntry = entries[0]
    const nextRemainingTasks = remainingTasks.filter((_, index) => index !== selectedEntry.index)

    for (const placement of selectedEntry.candidates) {
      const nextState = cloneState(state)
      applyPlacement(nextState, selectedEntry.task, placement)

      const result = visit(
        nextRemainingTasks,
        nextState,
        [
          ...assignments,
          {
            task: selectedEntry.task,
            placement
          }
        ]
      )

      if (result) {
        return result
      }
    }

    return null
  }

  const result = visit(tasks, buildState(), [])

  return result
    ? {
        ...result,
        visitedNodes,
        exhausted: false
      }
    : {
        assignments: null,
        state: null,
        visitedNodes,
        exhausted: visitedNodes > nodeLimit
      }
}

function computeGreedyAssignments(tasks, timeline) {
  const assignments = []
  const manualRequired = []
  const state = buildState()

  while (tasks.length > 0) {
    let bestIndex = -1
    let bestCandidates = []

    for (let index = 0; index < tasks.length; index += 1) {
      const task = tasks[index]
      const candidates = enumerateCandidatePlacements(task, state, timeline)

      if (bestIndex === -1 || candidates.length < bestCandidates.length) {
        bestIndex = index
        bestCandidates = candidates
      }

      if (candidates.length === 0) {
        break
      }
    }

    const [task] = tasks.splice(bestIndex, 1)

    if (!bestCandidates || bestCandidates.length === 0) {
      manualRequired.push(createManualIssue(task, 'Aucun créneau valide sans conflit n a pu etre trouve.'))
      continue
    }

    const placement = bestCandidates[0]
    applyPlacement(state, task, placement)
    assignments.push({
      task,
      placement
    })
  }

  return {
    assignments,
    manualRequired,
    generatedRoomsBySiteDate: state.generatedRoomsBySiteDate
  }
}

function cloneGeneratedRoomsBySiteDate(generatedRoomsBySiteDate = new Map()) {
  const clone = new Map()

  for (const [key, roomNames] of generatedRoomsBySiteDate.entries()) {
    clone.set(key, Array.isArray(roomNames) ? [...roomNames] : [])
  }

  return clone
}

function buildRoomLoadIndex(groupAssignments = []) {
  const roomLoadIndex = new Map()

  for (const assignment of groupAssignments) {
    const roomName = compactText(assignment?.placement?.roomName)
    if (!roomName) {
      continue
    }

    if (!roomLoadIndex.has(roomName)) {
      roomLoadIndex.set(roomName, {
        roomName,
        roomIndex: getRoomIndexForName(assignment?.task?.siteContext, roomName),
        assignments: [],
        occupiedPeriods: new Set()
      })
    }

    const roomLoad = roomLoadIndex.get(roomName)
    roomLoad.assignments.push(assignment)
    roomLoad.occupiedPeriods.add(Number(assignment?.placement?.period))
  }

  return roomLoadIndex
}

function sortRoomLoadsByPressure(left, right) {
  if (right.assignments.length !== left.assignments.length) {
    return right.assignments.length - left.assignments.length
  }

  if (left.roomIndex !== right.roomIndex) {
    return left.roomIndex - right.roomIndex
  }

  return left.roomName.localeCompare(right.roomName)
}

function findMovableAssignment(donorRoom, targetRoom) {
  const donorAssignments = [...donorRoom.assignments]
    .sort((left, right) => {
      const periodCompare = Number(right?.placement?.period || 0) - Number(left?.placement?.period || 0)
      if (periodCompare !== 0) {
        return periodCompare
      }

      return compactText(left?.task?.reference).localeCompare(compactText(right?.task?.reference))
    })

  return donorAssignments.find((assignment) => {
    const period = Number(assignment?.placement?.period)
    if (!Number.isFinite(period) || targetRoom.occupiedPeriods.has(period)) {
      return false
    }

    return isRoomCompatibleWithTask(
      assignment?.task?.siteContext,
      targetRoom.roomName,
      assignment?.task
    )
  }) || null
}

function moveAssignmentToRoom(assignment, donorRoom, targetRoom) {
  const period = Number(assignment?.placement?.period)
  const siteContext = assignment?.task?.siteContext

  donorRoom.assignments = donorRoom.assignments.filter((candidate) => candidate !== assignment)
  donorRoom.occupiedPeriods.delete(period)
  targetRoom.assignments.push(assignment)
  targetRoom.occupiedPeriods.add(period)

  assignment.placement = {
    ...assignment.placement,
    roomName: targetRoom.roomName,
    roomKey: getRoomKey(siteContext, targetRoom.roomName),
    roomIndex: getRoomIndexForName(siteContext, targetRoom.roomName),
    isNewRoom: false
  }
}

function rebalanceOpenRooms(assignments = [], generatedRoomsBySiteDate = new Map(), fallbackMinRoomLoad = MIN_TPI_PER_OPEN_ROOM) {
  const defaultMinRoomLoad = getMinTpiPerOpenRoomTarget(fallbackMinRoomLoad, MIN_TPI_PER_OPEN_ROOM)
  const nextAssignments = (Array.isArray(assignments) ? assignments : []).map((assignment) => ({
    ...assignment,
    placement: assignment?.placement && typeof assignment.placement === 'object'
      ? { ...assignment.placement }
      : assignment?.placement
  }))
  const groupedAssignments = new Map()

  for (const assignment of nextAssignments) {
    const siteContext = assignment?.task?.siteContext
    const dateKey = compactText(assignment?.placement?.dateKey)
    if (!siteContext || !dateKey) {
      continue
    }

    const groupKey = getSiteDateKey(siteContext, dateKey)
    if (!groupedAssignments.has(groupKey)) {
      groupedAssignments.set(groupKey, [])
    }

    groupedAssignments.get(groupKey).push(assignment)
  }

  for (const groupAssignments of groupedAssignments.values()) {
    const roomLoadIndex = buildRoomLoadIndex(groupAssignments)
    const groupMinRoomLoad = getMinTpiPerOpenRoomTarget(
      groupAssignments[0]?.task?.siteContext?.minTpiPerRoom,
      defaultMinRoomLoad
    )

    for (let guard = 0; guard < 1000; guard += 1) {
      const targetRooms = Array.from(roomLoadIndex.values())
        .filter((roomLoad) =>
          roomLoad.assignments.length > 0 &&
          roomLoad.assignments.length < groupMinRoomLoad
        )
        .sort((left, right) => {
          if (left.assignments.length !== right.assignments.length) {
            return left.assignments.length - right.assignments.length
          }

          if (left.roomIndex !== right.roomIndex) {
            return left.roomIndex - right.roomIndex
          }

          return left.roomName.localeCompare(right.roomName)
        })

      if (targetRooms.length === 0) {
        break
      }

      let moved = false

      for (const targetRoom of targetRooms) {
        const donorRooms = Array.from(roomLoadIndex.values())
          .filter((roomLoad) =>
            roomLoad.roomName !== targetRoom.roomName &&
            roomLoad.assignments.length > groupMinRoomLoad
          )
          .sort(sortRoomLoadsByPressure)

        for (const donorRoom of donorRooms) {
          const movableAssignment = findMovableAssignment(donorRoom, targetRoom)
          if (!movableAssignment) {
            continue
          }

          moveAssignmentToRoom(movableAssignment, donorRoom, targetRoom)
          moved = true
          break
        }

        if (moved) {
          break
        }
      }

      if (!moved) {
        break
      }
    }
  }

  return {
    assignments: nextAssignments,
    generatedRoomsBySiteDate: cloneGeneratedRoomsBySiteDate(generatedRoomsBySiteDate)
  }
}

function computeAutomaticAssignments(tasks = []) {
  const timeline = buildTimeline(tasks)
  const frequencyIndex = buildFrequencyIndex(tasks)
  const pendingTasks = tasks
    .map((task) => ({
      ...task,
      preferredDateWeight: Number.isFinite(Number(task?.preferredDateWeight))
        ? Number(task.preferredDateWeight)
        : getTaskPreferredDateWeight(task),
      repeatedParticipantWeight: (task.participants || []).reduce(
        (total, participant) => total + Math.max(Number(frequencyIndex.get(participant.personId) || 0) - 1, 0),
        0
      )
    }))
    .sort((left, right) => {
      if (left.allowedDateKeys.length !== right.allowedDateKeys.length) {
        return left.allowedDateKeys.length - right.allowedDateKeys.length
      }

      if (right.repeatedParticipantWeight !== left.repeatedParticipantWeight) {
        return right.repeatedParticipantWeight - left.repeatedParticipantWeight
      }

      if (right.preferredDateWeight !== left.preferredDateWeight) {
        return right.preferredDateWeight - left.preferredDateWeight
      }

      return left.reference.localeCompare(right.reference)
    })

  const manualRequired = []
  const schedulableTasks = []

  for (const task of pendingTasks) {
    if (!task.siteContext) {
      manualRequired.push(createManualIssue(task, 'Aucun site de planification reconnu pour ce TPI.'))
      continue
    }

    if (!Array.isArray(task.allowedDateKeys) || task.allowedDateKeys.length === 0) {
      manualRequired.push(createManualIssue(task, 'Aucune date de défense configuree pour cette classe.'))
      continue
    }

    schedulableTasks.push(task)
  }

  const searchResult = searchCompleteAssignments(schedulableTasks, timeline)

  if (Array.isArray(searchResult.assignments)) {
    const balancedResult = rebalanceOpenRooms(
      searchResult.assignments,
      searchResult.state.generatedRoomsBySiteDate
    )

    return {
      assignments: balancedResult.assignments,
      manualRequired,
      generatedRoomsBySiteDate: balancedResult.generatedRoomsBySiteDate
    }
  }

  const greedyResult = computeGreedyAssignments([...schedulableTasks], timeline)
  const balancedGreedyResult = rebalanceOpenRooms(
    greedyResult.assignments,
    greedyResult.generatedRoomsBySiteDate
  )

  return {
    assignments: balancedGreedyResult.assignments,
    manualRequired: [
      ...manualRequired,
      ...greedyResult.manualRequired
    ],
    generatedRoomsBySiteDate: balancedGreedyResult.generatedRoomsBySiteDate
  }
}

function buildSlotTimesForPeriod(siteContext, period) {
  const startMinutes =
    parseTimeToMinutes(siteContext?.firstTpiStartTime, 8 * 60) +
    (Number(period) - 1) * (
      Number(siteContext?.tpiTimeMinutes || 60) +
      Number(siteContext?.breaklineMinutes || 10)
    )
  const endMinutes = startMinutes + Number(siteContext?.tpiTimeMinutes || 60)

  return {
    startTime: minutesToTimeString(startMinutes),
    endTime: minutesToTimeString(endMinutes)
  }
}

function buildAutomaticSlotDocuments(assignments = [], generatedRoomsBySiteDate = new Map()) {
  const assignmentsBySlot = new Map()
  const siteContextsByKey = new Map()

  for (const assignment of assignments) {
    const siteContext = assignment?.task?.siteContext
    if (!siteContext) {
      continue
    }

    siteContextsByKey.set(siteContext.siteKey, siteContext)
    assignmentsBySlot.set(
      getRoomSlotKey(siteContext, assignment.placement.roomName, assignment.placement.dateKey, assignment.placement.period),
      assignment
    )
  }

  const slotDocuments = []

  for (const [siteDateKey, roomNames] of generatedRoomsBySiteDate.entries()) {
    const [siteKey, dateKey] = siteDateKey.split('|')
    const siteContext = siteContextsByKey.get(siteKey)

    if (!siteContext) {
      continue
    }

    const rooms = Array.from(new Set([
      ...roomNames,
      ...(siteContext.manualRoomTarget > 0
        ? Array.from({ length: siteContext.manualRoomTarget }, (_, index) => getRoomNameAt(siteContext, index))
        : [])
    ]))

    for (const roomName of rooms) {
      for (let period = 1; period <= siteContext.numSlots; period += 1) {
        const assignment = assignmentsBySlot.get(getRoomSlotKey(siteContext, roomName, dateKey, period))
        const slotTimes = buildSlotTimesForPeriod(siteContext, period)
        const participantMap = assignment
          ? Object.fromEntries(
              assignment.task.participants.map((participant) => [
                participant.role,
                participant.person?._id || participant.personId
              ])
            )
          : {}

        slotDocuments.push({
          year: Number(assignment?.task?.tpi?.year || new Date(dateKey).getUTCFullYear()),
          date: new Date(`${dateKey}T08:00:00.000Z`),
          period,
          startTime: slotTimes.startTime,
          endTime: slotTimes.endTime,
          room: {
            name: roomName,
            site: siteContext.siteCode || siteContext.siteLabel,
            capacity: Number(siteContext.roomCapacityByName.get(roomName) || 1)
          },
          status: assignment ? 'proposed' : 'available',
          assignedTpi: assignment?.task?.tpi?._id || null,
          assignments: {
            candidat: participantMap.candidat || null,
            expert1: participantMap.expert1 || null,
            expert2: participantMap.expert2 || null,
            chefProjet: participantMap.chefProjet || null
          },
          config: {
            duration: Number(siteContext.tpiTimeMinutes || 60),
            breakAfter: Number(siteContext.breaklineMinutes || 10),
            maxConsecutiveTpi: getMaxConsecutiveTpiLimit(siteContext.maxConsecutiveTpi, MAX_CONSECUTIVE_TPI),
            minTpiPerRoom: getMinTpiPerOpenRoomTarget(siteContext.minTpiPerRoom, MIN_TPI_PER_OPEN_ROOM)
          }
        })
      }
    }
  }

  slotDocuments.sort((left, right) => {
    const leftKey = [
      toIsoDateKey(left.date),
      String(left.period).padStart(2, '0'),
      compactText(left.room?.site),
      compactText(left.room?.name)
    ].join('|')
    const rightKey = [
      toIsoDateKey(right.date),
      String(right.period).padStart(2, '0'),
      compactText(right.room?.site),
      compactText(right.room?.name)
    ].join('|')

    return leftKey.localeCompare(rightKey)
  })

  return slotDocuments
}

function buildLegacyRoomsFromAutomaticSlots(year, slots = [], tasks = []) {
  const normalizedYear = Number.parseInt(String(year), 10)
  const taskById = new Map(
    (Array.isArray(tasks) ? tasks : [])
      .map((task) => [task?.tpiId, task])
      .filter(([taskId, task]) => Boolean(taskId) && Boolean(task))
  )
  const groupedRooms = new Map()

  for (const rawSlot of Array.isArray(slots) ? slots : []) {
    const slot = typeof rawSlot?.toObject === 'function'
      ? rawSlot.toObject({ depopulate: true, versionKey: false })
      : rawSlot
    const dateKey = toIsoDateKey(slot?.date)
    const site = compactText(slot?.room?.site)
    const roomName = compactText(slot?.room?.name)

    if (!dateKey || !site || !roomName) {
      continue
    }

    const roomKey = `${site}|${roomName}|${dateKey}`
    if (!groupedRooms.has(roomKey)) {
      groupedRooms.set(roomKey, {
        key: roomKey,
        site,
        name: roomName,
        date: new Date(`${dateKey}T08:00:00.000Z`),
        slots: []
      })
    }

    const assignedTpiId = toObjectIdString(slot?.assignedTpi)
    const task = assignedTpiId ? taskById.get(assignedTpiId) || null : null
    groupedRooms.get(roomKey).slots.push({
      slot,
      reference: compactText(task?.reference),
      tpi: task?.tpi || null
    })
  }

  return Array.from(groupedRooms.values())
    .map((room) => {
      const sortedSlots = [...room.slots].sort((left, right) => Number(left.slot?.period || 0) - Number(right.slot?.period || 0))
      const slotByPeriod = new Map(
        sortedSlots.map((entry) => [Number(entry.slot?.period || 0), entry])
      )
      const maxPeriod = sortedSlots.reduce(
        (maxValue, entry) => Math.max(maxValue, Number(entry.slot?.period || 0)),
        0
      )
      const tpiDatas = Array.from({ length: maxPeriod }, (_, index) => {
        const entry = slotByPeriod.get(index + 1) || null
        const baseData = createEmptyLegacyTpiData(room.key, index, entry?.slot)

        if (!entry?.tpi) {
          return baseData
        }

        const reference = compactText(entry.tpi.reference || entry.reference)
        return {
          ...baseData,
          refTpi: getLegacyReferenceValue({
            ...entry.tpi,
            reference
          }),
          id: reference || baseData.id,
          candidat: formatPersonName(entry.tpi.candidat),
          candidatPersonId: toObjectIdString(entry.tpi.candidat),
          expert1: {
            name: formatPersonName(entry.tpi.expert1),
            personId: toObjectIdString(entry.tpi.expert1),
            offres: createEmptyLegacyOffers()
          },
          expert2: {
            name: formatPersonName(entry.tpi.expert2),
            personId: toObjectIdString(entry.tpi.expert2),
            offres: createEmptyLegacyOffers()
          },
          boss: {
            name: formatPersonName(entry.tpi.chefProjet),
            personId: toObjectIdString(entry.tpi.chefProjet),
            offres: createEmptyLegacyOffers()
          }
        }
      })

      return {
        idRoom: buildStableNumericId(`${normalizedYear}_${room.key}`),
        lastUpdate: Date.now(),
        site: room.site,
        date: room.date,
        name: room.name,
        roomClassMode: inferLegacyRoomClassMode(sortedSlots),
        configSite: buildLegacyRoomConfig(sortedSlots[0]?.slot, maxPeriod),
        tpiDatas
      }
    })
    .sort((left, right) => {
      const dateCompare = new Date(left.date).getTime() - new Date(right.date).getTime()
      if (dateCompare !== 0) {
        return dateCompare
      }

      const siteCompare = compactText(left.site).localeCompare(compactText(right.site))
      if (siteCompare !== 0) {
        return siteCompare
      }

      return compactText(left.name).localeCompare(compactText(right.name))
    })
}

async function syncLegacyRoomsFromAutomaticPlanning(year, slots = [], tasks = []) {
  const RoomModel = createTpiRoomModel(year)
  const legacyRooms = buildLegacyRoomsFromAutomaticSlots(year, slots, tasks)

  await RoomModel.deleteMany({})

  if (legacyRooms.length > 0) {
    await RoomModel.insertMany(legacyRooms, { ordered: true })
  }

  return legacyRooms
}

async function autoPlanYear(year) {
  const planningYear = Number.parseInt(String(year), 10)
  if (!Number.isInteger(planningYear)) {
    throw new Error('Annee invalide pour la planification automatique.')
  }

  const [planningConfig, planningCatalog] = await Promise.all([
    getPlanningConfig(planningYear),
    getSharedPlanningCatalog()
  ])

  const rawTpis = await TpiPlanning.find(buildPlanifiableTpiQuery(planningYear))
    .populate('candidat')
    .populate('expert1')
    .populate('expert2')
    .populate('chefProjet')
    .sort({ reference: 1 })

  const planifiableTpis = filterPlanifiableTpis(rawTpis, planningConfig)
    .filter((tpi) => !['cancelled', 'completed'].includes(compactText(tpi?.status)))

  const { resolveSiteContext } = buildSiteContextIndex(
    Array.isArray(planningCatalog?.sites) ? planningCatalog.sites : [],
    planningConfig
  )

  const tasks = planifiableTpis
    .map((tpi) => buildSchedulingTask(tpi, planningConfig, resolveSiteContext))
    .filter((task) => Boolean(task.tpiId))

  const computation = computeAutomaticAssignments(tasks)
  const tpiIds = tasks.map((task) => task.tpi._id)

  if (tpiIds.length > 0) {
    await Vote.deleteMany({ tpiPlanning: { $in: tpiIds } })
  }

  await Slot.deleteMany({ year: planningYear })

  const slotDocuments = buildAutomaticSlotDocuments(
    computation.assignments,
    computation.generatedRoomsBySiteDate
  )
  const insertedSlots = slotDocuments.length > 0
    ? await Slot.insertMany(slotDocuments, { ordered: true })
    : []
  const insertedSlotByKey = new Map(
    insertedSlots.map((slot) => [
      getRoomSlotKey(
        {
          siteKey: normalizeLookup(slot.room?.site),
          siteCode: slot.room?.site
        },
        slot.room?.name,
        toIsoDateKey(slot.date),
        slot.period
      ),
      slot
    ])
  )

  const assignmentsByTpiId = new Map(
    computation.assignments.map((assignment) => [
      assignment.task.tpiId,
      assignment
    ])
  )
  const manualByTpiId = new Map(
    computation.manualRequired.map((entry) => [entry.tpiId, entry])
  )

  const bulkOperations = tasks.map((task) => {
    const assignment = assignmentsByTpiId.get(task.tpiId)
    const manualIssue = manualByTpiId.get(task.tpiId)

    if (assignment) {
      const slot = insertedSlotByKey.get(
        getRoomSlotKey(
          assignment.task.siteContext,
          assignment.placement.roomName,
          assignment.placement.dateKey,
          assignment.placement.period
        )
      )
      const reason = [
        'Planification automatique',
        assignment.placement.dateKey,
        assignment.placement.roomName,
        `P${assignment.placement.period}`
      ].join(' • ')

      return {
        updateOne: {
          filter: { _id: task.tpi._id },
          update: {
            $set: {
              status: 'pending_slots',
              proposedSlots: slot
                ? [{
                    slot: slot._id,
                    proposedAt: new Date(),
                    score: 100,
                    reason
                  }]
                : [],
              confirmedSlot: null,
              soutenanceDateTime: slot?.date || null,
              soutenanceRoom: slot?.room?.name || '',
              conflicts: []
            },
            $unset: {
              votingSession: '',
              manualOverride: ''
            }
          }
        }
      }
    }

    return {
      updateOne: {
        filter: { _id: task.tpi._id },
        update: {
          $set: {
            status: 'manual_required',
            proposedSlots: [],
            confirmedSlot: null,
            soutenanceDateTime: null,
            soutenanceRoom: '',
            conflicts: [{
              type: 'no_common_slot',
              description: manualIssue?.reason || 'Aucun créneau automatique valide n a ete trouve.',
              detectedAt: new Date()
            }]
          },
          $unset: {
            votingSession: '',
            manualOverride: ''
          }
        }
      }
    }
  })

  if (bulkOperations.length > 0) {
    await TpiPlanning.bulkWrite(bulkOperations)
  }

  const legacyRooms = await syncLegacyRoomsFromAutomaticPlanning(planningYear, insertedSlots, tasks)
  const roomCount = new Set(
    insertedSlots.map((slot) => [
      toIsoDateKey(slot.date),
      compactText(slot.room?.site),
      compactText(slot.room?.name)
    ].join('|'))
  ).size

  return {
    year: planningYear,
    totalTpis: tasks.length,
    plannedCount: computation.assignments.length,
    manualRequiredCount: computation.manualRequired.length,
    slotCount: insertedSlots.length,
    roomCount,
    legacyRoomCount: legacyRooms.length,
    legacyRooms,
    manualRequired: computation.manualRequired
  }
}

module.exports = {
  autoPlanYear,
  buildAutomaticSlotDocuments,
  buildLegacyRoomsFromAutomaticSlots,
  computeAutomaticAssignments,
  resolveTaskAllowedDateKeys
}
