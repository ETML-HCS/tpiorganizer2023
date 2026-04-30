const OCCUPIED_SLOT_STATUSES = Object.freeze(['confirmed', 'pending_votes', 'proposed'])
const MAX_CONSECUTIVE_TPI = 4
const MIN_TPI_PER_OPEN_ROOM = 3

function getMaxConsecutiveTpiLimit(value, fallback = MAX_CONSECUTIVE_TPI) {
  const fallbackLimit = Number.isInteger(Number(fallback)) && Number(fallback) > 0
    ? Number(fallback)
    : MAX_CONSECUTIVE_TPI
  const limit = Number(value)

  return Number.isInteger(limit) && limit > 0
    ? limit
    : fallbackLimit
}

function getMinTpiPerOpenRoomTarget(value, fallback = MIN_TPI_PER_OPEN_ROOM) {
  const fallbackTarget = Number.isInteger(Number(fallback)) && Number(fallback) > 0
    ? Number(fallback)
    : MIN_TPI_PER_OPEN_ROOM
  const target = Number(value)

  return Number.isInteger(target) && target > 0
    ? target
    : fallbackTarget
}

function normalizeDateKey(dateValue) {
  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString().slice(0, 10)
}

function toTimeStepKey(dateValue, period) {
  const dateKey = normalizeDateKey(dateValue)
  if (!dateKey || period === undefined || period === null) {
    return null
  }

  return `${dateKey}#${period}`
}

function slotContainsPerson(slot, personId) {
  if (!slot || !personId) {
    return false
  }

  const assignments = slot.assignments || {}
  const targetId = String(personId)

  return ['candidat', 'expert1', 'expert2', 'chefProjet'].some((role) => {
    const assignedValue = assignments[role]
    const assignedId = assignedValue?._id || assignedValue?.id || assignedValue
    return assignedId && String(assignedId) === targetId
  })
}

function buildTimelineIndex(slots) {
  const timeSteps = []
  const seenKeys = new Set()

  for (const slot of Array.isArray(slots) ? slots : []) {
    const key = toTimeStepKey(slot?.date, slot?.period)
    if (!key || seenKeys.has(key)) {
      continue
    }

    seenKeys.add(key)
    timeSteps.push(key)
  }

  timeSteps.sort((left, right) => {
    const [leftDate, leftPeriod] = String(left || '').split('#')
    const [rightDate, rightPeriod] = String(right || '').split('#')
    const dateCompare = String(leftDate || '').localeCompare(String(rightDate || ''))

    if (dateCompare !== 0) {
      return dateCompare
    }

    const leftPeriodNumber = Number.parseInt(leftPeriod, 10)
    const rightPeriodNumber = Number.parseInt(rightPeriod, 10)

    if (Number.isInteger(leftPeriodNumber) && Number.isInteger(rightPeriodNumber)) {
      return leftPeriodNumber - rightPeriodNumber
    }

    return String(left || '').localeCompare(String(right || ''))
  })

  return {
    timeSteps,
    indexByKey: new Map(timeSteps.map((key, index) => [key, index]))
  }
}

function buildOccupiedStepKeys(slots, personId) {
  const occupiedKeys = new Set()

  for (const slot of Array.isArray(slots) ? slots : []) {
    if (!OCCUPIED_SLOT_STATUSES.includes(slot?.status)) {
      continue
    }

    if (slotContainsPerson(slot, personId)) {
      const key = toTimeStepKey(slot.date, slot.period)
      if (key) {
        occupiedKeys.add(key)
      }
    }
  }

  return occupiedKeys
}

module.exports = {
  buildOccupiedStepKeys,
  buildTimelineIndex,
  getMaxConsecutiveTpiLimit,
  getMinTpiPerOpenRoomTarget,
  MAX_CONSECUTIVE_TPI,
  MIN_TPI_PER_OPEN_ROOM,
  normalizeDateKey,
  OCCUPIED_SLOT_STATUSES,
  slotContainsPerson,
  toTimeStepKey
}
