const PREFERRED_SOUTENANCE_LIMIT = 3

export const PREFERRED_SOUTENANCE_CHOICE_FIELDS = [
  { dateField: 'preferredSoutenanceDate1', slotField: 'preferredSoutenanceSlot1', label: 'Choix 1' },
  { dateField: 'preferredSoutenanceDate2', slotField: 'preferredSoutenanceSlot2', label: 'Choix 2' },
  { dateField: 'preferredSoutenanceDate3', slotField: 'preferredSoutenanceSlot3', label: 'Choix 3' }
]

function normalizeWhitespace(value = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function formatDateInputValue(value = '') {
  const normalizedValue = normalizeWhitespace(value)

  if (!normalizedValue) {
    return ''
  }

  const date = new Date(normalizedValue)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().slice(0, 10)
}

function normalizePositiveInteger(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = Number.parseInt(String(value), 10)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null
}

function normalizePreferredSoutenanceChoice(value) {
  if (!value && value !== 0) {
    return null
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const date = formatDateInputValue(value.date || value.value || value.label || '')

    if (!date) {
      return null
    }

    const period = normalizePositiveInteger(
      value.period ?? value.slot ?? value.creneau ?? value.slotNumber
    )

    return period ? { date, period } : { date }
  }

  const date = formatDateInputValue(value)
  return date ? { date } : null
}

function dedupePreferredSoutenanceChoices(values = []) {
  const normalizedChoices = []
  const choiceIndexByDate = new Map()

  for (const value of (Array.isArray(values) ? values : [values])) {
    const choice = normalizePreferredSoutenanceChoice(value)

    if (!choice) {
      continue
    }

    const existingIndex = choiceIndexByDate.get(choice.date)
    if (!Number.isInteger(existingIndex)) {
      choiceIndexByDate.set(choice.date, normalizedChoices.length)
      normalizedChoices.push(choice)
      if (normalizedChoices.length >= PREFERRED_SOUTENANCE_LIMIT) {
        break
      }
      continue
    }

    const existingChoice = normalizedChoices[existingIndex]
    if ((existingChoice?.period ?? null) === null && Number.isInteger(choice.period)) {
      normalizedChoices[existingIndex] = choice
    }
  }

  return normalizedChoices
}

export function buildPreferredSoutenanceChoices(choices = [], fallbackDates = []) {
  return dedupePreferredSoutenanceChoices([
    ...(Array.isArray(choices) ? choices : [choices]),
    ...(Array.isArray(fallbackDates) ? fallbackDates : [fallbackDates])
  ])
}

export function getPreferredSoutenanceChoicesForPerson(person = {}) {
  return buildPreferredSoutenanceChoices(
    person?.preferredSoutenanceChoices || [],
    person?.preferredSoutenanceDates || []
  )
}

export function buildPreferredSoutenanceDates(choices = [], fallbackDates = []) {
  return buildPreferredSoutenanceChoices(choices, fallbackDates).map((choice) => choice.date)
}

export function getPreferredSoutenanceChoiceInputValues(choices = [], fallbackDates = []) {
  const normalizedChoices = buildPreferredSoutenanceChoices(choices, fallbackDates)

  return Object.fromEntries(
    PREFERRED_SOUTENANCE_CHOICE_FIELDS.flatMap(({ dateField, slotField }, index) => ([
      [dateField, normalizedChoices[index]?.date || ''],
      [slotField, normalizedChoices[index]?.period ? String(normalizedChoices[index].period) : '']
    ]))
  )
}

export function formatPreferredSoutenanceSlotLabel(period) {
  const normalizedPeriod = normalizePositiveInteger(period)
  return normalizedPeriod ? `créneau ${normalizedPeriod}` : ''
}

export function formatPreferredSoutenanceChoiceLabel(choice) {
  const normalizedChoice = normalizePreferredSoutenanceChoice(choice)

  if (!normalizedChoice) {
    return ''
  }

  const dateLabel = new Date(`${normalizedChoice.date}T08:00:00.000Z`).toLocaleDateString('fr-CH')
  const slotLabel = formatPreferredSoutenanceSlotLabel(normalizedChoice.period)

  return slotLabel ? `${dateLabel} · ${slotLabel}` : dateLabel
}

export function formatPreferredSoutenanceChoicesForPreview(choices = [], fallbackDates = []) {
  const normalizedChoices = buildPreferredSoutenanceChoices(choices, fallbackDates)

  return normalizedChoices.length > 0
    ? normalizedChoices.map((choice) => formatPreferredSoutenanceChoiceLabel(choice)).join(', ')
    : 'Aucune date'
}
