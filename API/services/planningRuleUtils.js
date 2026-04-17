const OCCUPIED_SLOT_STATUSES = Object.freeze(['confirmed', 'pending_votes', 'proposed'])
const MAX_CONSECUTIVE_TPI = 4

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
  MAX_CONSECUTIVE_TPI,
  normalizeDateKey,
  OCCUPIED_SLOT_STATUSES,
  slotContainsPerson,
  toTimeStepKey
}
