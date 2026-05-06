export const PROJECT_LEAD_AVAILABILITY_DAYS = Object.freeze([
  Object.freeze({ key: 'monday', dayOfWeek: 1, label: 'Lu', longLabel: 'Lundi' }),
  Object.freeze({ key: 'tuesday', dayOfWeek: 2, label: 'Ma', longLabel: 'Mardi' }),
  Object.freeze({ key: 'wednesday', dayOfWeek: 3, label: 'Me', longLabel: 'Mercredi' }),
  Object.freeze({ key: 'thursday', dayOfWeek: 4, label: 'Je', longLabel: 'Jeudi' }),
  Object.freeze({ key: 'friday', dayOfWeek: 5, label: 'Ve', longLabel: 'Vendredi' })
])

export const PROJECT_LEAD_AVAILABILITY_CYCLE = Object.freeze([
  'available',
  'unavailable',
  'morning',
  'afternoon'
])

export const PROJECT_LEAD_AVAILABILITY_LABELS = Object.freeze({
  available: 'Disponible',
  unavailable: 'Indisponible toute la journée',
  morning: 'Indisponible le matin',
  afternoon: "Indisponible l'après-midi"
})

export const PROJECT_LEAD_AVAILABILITY_SHORT_LABELS = Object.freeze({
  available: 'Dispo',
  unavailable: 'Journée',
  morning: 'Matin',
  afternoon: 'Après-midi'
})

const PROJECT_LEAD_AVAILABILITY_BY_DAY = Object.freeze(
  PROJECT_LEAD_AVAILABILITY_DAYS.reduce((daysByIndex, day) => ({
    ...daysByIndex,
    [day.dayOfWeek]: day
  }), {})
)

const PROJECT_LEAD_AVAILABILITY_BY_KEY = Object.freeze(
  PROJECT_LEAD_AVAILABILITY_DAYS.reduce((daysByKey, day) => ({
    ...daysByKey,
    [day.key]: day
  }), {})
)

export function normalizeProjectLeadAvailabilityValue(value) {
  const normalizedValue = String(value || '').trim().toLowerCase()

  return PROJECT_LEAD_AVAILABILITY_CYCLE.includes(normalizedValue)
    ? normalizedValue
    : 'available'
}

export function createDefaultProjectLeadAvailability() {
  return PROJECT_LEAD_AVAILABILITY_DAYS.reduce((availability, day) => ({
    ...availability,
    [day.key]: 'available'
  }), {})
}

export function normalizeProjectLeadAvailabilityMap(availability = {}) {
  const source = availability && typeof availability === 'object' ? availability : {}

  return PROJECT_LEAD_AVAILABILITY_DAYS.reduce((normalized, day) => ({
    ...normalized,
    [day.key]: normalizeProjectLeadAvailabilityValue(source[day.key])
  }), {})
}

export function getNextProjectLeadAvailabilityValue(currentValue) {
  const normalizedCurrentValue = normalizeProjectLeadAvailabilityValue(currentValue)
  const currentIndex = PROJECT_LEAD_AVAILABILITY_CYCLE.indexOf(normalizedCurrentValue)
  const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 1

  return PROJECT_LEAD_AVAILABILITY_CYCLE[nextIndex % PROJECT_LEAD_AVAILABILITY_CYCLE.length]
}

function normalizeAvailabilityPeriods(periods = []) {
  return Array.from(
    new Set(
      (Array.isArray(periods) ? periods : [periods])
        .map((period) => Number.parseInt(period, 10))
        .filter((period) => period === 1 || period === 2)
    )
  ).sort((left, right) => left - right)
}

function availabilityValueToPeriods(value) {
  switch (normalizeProjectLeadAvailabilityValue(value)) {
    case 'unavailable':
      return []
    case 'morning':
      return [2]
    case 'afternoon':
      return [1]
    case 'available':
    default:
      return [1, 2]
  }
}

function periodsToAvailabilityValue(periods = []) {
  const normalizedPeriods = normalizeAvailabilityPeriods(periods)
  const hasMorning = normalizedPeriods.includes(1)
  const hasAfternoon = normalizedPeriods.includes(2)

  if (hasMorning && hasAfternoon) {
    return 'available'
  }

  if (hasMorning) {
    return 'afternoon'
  }

  if (hasAfternoon) {
    return 'morning'
  }

  return 'unavailable'
}

export function defaultAvailabilityToProjectLeadAvailability(defaultAvailability = []) {
  const hasDeclaredAvailability =
    Array.isArray(defaultAvailability) && defaultAvailability.length > 0
  const availability = hasDeclaredAvailability
    ? PROJECT_LEAD_AVAILABILITY_DAYS.reduce((values, day) => ({
        ...values,
        [day.key]: 'unavailable'
      }), {})
    : createDefaultProjectLeadAvailability()

  for (const entry of Array.isArray(defaultAvailability) ? defaultAvailability : []) {
    const dayOfWeek = Number.parseInt(entry?.dayOfWeek, 10)
    const day = PROJECT_LEAD_AVAILABILITY_BY_DAY[dayOfWeek]

    if (day) {
      availability[day.key] = periodsToAvailabilityValue(entry?.periods)
    }
  }

  return availability
}

export function projectLeadAvailabilityToDefaultAvailability(availability = {}) {
  const normalizedAvailability = normalizeProjectLeadAvailabilityMap(availability)

  return PROJECT_LEAD_AVAILABILITY_DAYS.map((day) => ({
    dayOfWeek: day.dayOfWeek,
    periods: availabilityValueToPeriods(normalizedAvailability[day.key])
  }))
}

export function getProjectLeadAvailabilityDayForDate(dateKey = '') {
  const normalizedDateKey = String(dateKey || '').trim().slice(0, 10)

  if (!normalizedDateKey) {
    return null
  }

  const date = new Date(`${normalizedDateKey}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return PROJECT_LEAD_AVAILABILITY_BY_DAY[date.getDay()] || null
}

export function getProjectLeadAvailabilityStateForDate(defaultAvailability = [], dateKey = '') {
  const day = getProjectLeadAvailabilityDayForDate(dateKey)

  if (!day) {
    return 'available'
  }

  return defaultAvailabilityToProjectLeadAvailability(defaultAvailability)[day.key] || 'available'
}

export function isProjectLeadAvailabilityBlockingHalfDay(availabilityValue, halfDay) {
  const normalizedValue = normalizeProjectLeadAvailabilityValue(availabilityValue)

  return normalizedValue === 'unavailable' ||
    (normalizedValue === 'morning' && halfDay === 'morning') ||
    (normalizedValue === 'afternoon' && halfDay === 'afternoon')
}

export function formatProjectLeadAvailabilityDayTitle(dayOrKey, availabilityValue) {
  const day = typeof dayOrKey === 'string'
    ? PROJECT_LEAD_AVAILABILITY_BY_KEY[dayOrKey]
    : dayOrKey
  const statusLabel =
    PROJECT_LEAD_AVAILABILITY_LABELS[normalizeProjectLeadAvailabilityValue(availabilityValue)] ||
    PROJECT_LEAD_AVAILABILITY_LABELS.available

  return day ? `${day.longLabel}: ${statusLabel}` : statusLabel
}
