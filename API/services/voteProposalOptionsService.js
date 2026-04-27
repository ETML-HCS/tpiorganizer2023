function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function normalizeClassToken(value) {
  return compactText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase()
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

function formatDateLabel(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return compactText(value)
  }

  return date.toLocaleDateString('fr-CH', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function parseTimeToMinutes(value) {
  const text = compactText(value)
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?$/)

  if (!match) {
    return null
  }

  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2] || '0', 10)

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes < 0 || minutes >= 60) {
    return null
  }

  return (hours * 60) + minutes
}

function formatMinutesAsTime(value) {
  if (!Number.isFinite(Number(value))) {
    return ''
  }

  const totalMinutes = Math.max(0, Math.round(Number(value)))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function normalizeTimeLabel(value) {
  const minutes = parseTimeToMinutes(value)
  return minutes === null ? compactText(value) : formatMinutesAsTime(minutes)
}

function toPositiveNumber(value, fallback) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback
}

function countConfiguredPeriodsForWindow(siteConfig = {}, windowPeriod = 'AM') {
  const numSlots = Number.parseInt(siteConfig?.numSlots, 10)
  const normalizedNumSlots = Number.isInteger(numSlots) && numSlots > 0 ? numSlots : 8
  const firstStartMinutes = parseTimeToMinutes(siteConfig?.firstTpiStartTime || '08:00')
  const slotStepMinutes =
    toPositiveNumber(siteConfig?.tpiTimeMinutes, 60) +
    Math.max(0, Number(siteConfig?.breaklineMinutes || 0))

  if (firstStartMinutes !== null && slotStepMinutes > 0) {
    let count = 0
    for (let period = 1; period <= normalizedNumSlots; period += 1) {
      const periodStart = firstStartMinutes + ((period - 1) * slotStepMinutes)
      const periodWindow = periodStart < (12 * 60) ? 'AM' : 'PM'

      if (periodWindow === windowPeriod) {
        count += 1
      }
    }

    if (count > 0) {
      return count
    }
  }

  return windowPeriod === 'AM'
    ? Math.ceil(normalizedNumSlots / 2)
    : Math.floor(normalizedNumSlots / 2)
}

function resolveSlotWindowPeriod(slot) {
  const startMinutes = parseTimeToMinutes(slot?.startTime)

  if (startMinutes !== null) {
    return startMinutes < (12 * 60) ? 'AM' : 'PM'
  }

  const normalizedPeriod = normalizeClassToken(slot?.period)
  if (
    normalizedPeriod.includes('PM') ||
    normalizedPeriod.includes('APRES') ||
    normalizedPeriod.includes('AFTER')
  ) {
    return 'PM'
  }

  if (
    normalizedPeriod.includes('AM') ||
    normalizedPeriod.includes('MATIN') ||
    normalizedPeriod.includes('MORNING')
  ) {
    return 'AM'
  }

  const periodNumber = Number.parseInt(compactText(slot?.period), 10)
  if (Number.isInteger(periodNumber)) {
    return periodNumber <= 4 ? 'AM' : 'PM'
  }

  return 'AM'
}

function buildSlotQueueKey(slot) {
  const dateKey = toIsoDateKey(slot?.date)
  const windowPeriod = resolveSlotWindowPeriod(slot)
  const site = normalizeClassToken(slot?.room?.site)

  return [dateKey, windowPeriod, site].join('|')
}

function matchesToken(left, right) {
  const normalizedLeft = normalizeClassToken(left)
  const normalizedRight = normalizeClassToken(right)

  if (!normalizedLeft || !normalizedRight) {
    return false
  }

  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.startsWith(normalizedRight) ||
    normalizedRight.startsWith(normalizedLeft)
  )
}

function isMatuToken(value) {
  const normalizedValue = normalizeClassToken(value)

  return (
    normalizedValue === 'M' ||
    normalizedValue === 'MATU' ||
    normalizedValue.startsWith('M')
  )
}

function normalizeConfigDateClasses(entry) {
  return Array.isArray(entry?.classes)
    ? entry.classes
      .map((value) => normalizeClassToken(value))
      .filter(Boolean)
    : []
}

function isMatuConfigDate(entry) {
  return Boolean(entry?.min) || normalizeConfigDateClasses(entry).some(isMatuToken)
}

function normalizeSoutenanceDateEntry(value, classType = {}) {
  if (!value && value !== 0) {
    return null
  }

  const source = value && typeof value === 'object' ? value : { date: value }
  const date = toIsoDateKey(source.date || source.value || source.label)

  if (!date) {
    return null
  }

  const code = normalizeClassToken(classType?.code)
  const prefix = normalizeClassToken(classType?.prefix || code.slice(0, 1))
  const sourceClasses = Array.isArray(source.classes)
    ? source.classes
    : []
  const classes = Array.from(new Set([
    ...sourceClasses.map((entryClass) => normalizeClassToken(entryClass)),
    code,
    prefix
  ].filter(Boolean)))

  return {
    ...source,
    date,
    classes,
    special: source.special === true,
    min: source.min === true
  }
}

function mergeConfigDateEntries(entries = []) {
  const mergedByDate = new Map()

  for (const rawEntry of Array.isArray(entries) ? entries : []) {
    const entry = normalizeSoutenanceDateEntry(rawEntry)

    if (!entry) {
      continue
    }

    const current = mergedByDate.get(entry.date)
    if (!current) {
      mergedByDate.set(entry.date, entry)
      continue
    }

    mergedByDate.set(entry.date, {
      ...current,
      min: current.min || entry.min,
      special: current.special || entry.special,
      classes: Array.from(new Set([
        ...(current.classes || []),
        ...(entry.classes || [])
      ].filter(Boolean)))
    })
  }

  return Array.from(mergedByDate.values()).sort((left, right) =>
    String(left.date).localeCompare(String(right.date))
  )
}

function getConfigDateEntries(planningConfig = {}) {
  const topLevelEntries = Array.isArray(planningConfig?.soutenanceDates)
    ? planningConfig.soutenanceDates
    : []

  if (topLevelEntries.length > 0) {
    return mergeConfigDateEntries(topLevelEntries)
  }

  const classTypeEntries = []
  for (const classType of Array.isArray(planningConfig?.classTypes) ? planningConfig.classTypes : []) {
    for (const entry of Array.isArray(classType?.soutenanceDates) ? classType.soutenanceDates : []) {
      const normalizedEntry = normalizeSoutenanceDateEntry(entry, classType)
      if (normalizedEntry) {
        classTypeEntries.push(normalizedEntry)
      }
    }
  }

  return mergeConfigDateEntries(classTypeEntries)
}

function resolveTpiClassProfile(tpi, planningConfig = {}) {
  const rawClass = compactText(tpi?.classe)
  const normalizedClass = normalizeClassToken(rawClass)
  const classTypes = Array.isArray(planningConfig?.classTypes) ? planningConfig.classTypes : []

  const matchedClassType = classTypes.find((classType) => {
    const candidateTokens = [
      classType?.code,
      classType?.prefix,
      classType?.label
    ]

    return candidateTokens.some((candidateToken) => matchesToken(normalizedClass, candidateToken))
  }) || null

  const code = normalizeClassToken(matchedClassType?.code)
  const prefix = normalizeClassToken(matchedClassType?.prefix || code.slice(0, 1))
  const label = compactText(matchedClassType?.label || code || rawClass)
  const isMatu =
    isMatuToken(normalizedClass) ||
    isMatuToken(code) ||
    isMatuToken(prefix)

  return {
    rawClass,
    normalizedClass,
    code,
    prefix,
    label,
    isMatu,
    tokens: [normalizedClass, code, prefix].filter(Boolean)
  }
}

function matchesConfigDateForProfile(entry, classProfile) {
  const entryClasses = normalizeConfigDateClasses(entry)

  if (entryClasses.length === 0) {
    return false
  }

  return classProfile.tokens.some((token) =>
    entryClasses.some((entryClass) => matchesToken(token, entryClass))
  )
}

function getAllowedConfigDateEntries(tpi, planningConfig = {}) {
  const configEntries = getConfigDateEntries(planningConfig)
    .filter((entry) => entry?.special !== true)

  if (configEntries.length === 0) {
    return []
  }

  const classProfile = resolveTpiClassProfile(tpi, planningConfig)
  const exactMatches = configEntries.filter((entry) =>
    matchesConfigDateForProfile(entry, classProfile)
  )

  if (exactMatches.length > 0) {
    return exactMatches
  }

  const typedFallback = classProfile.isMatu
    ? configEntries.filter((entry) => isMatuConfigDate(entry))
    : configEntries.filter((entry) => !isMatuConfigDate(entry))

  if (typedFallback.length > 0) {
    return typedFallback
  }

  return configEntries
}

function buildVoteProposalContext(tpi, planningConfig = {}) {
  const classProfile = resolveTpiClassProfile(tpi, planningConfig)
  const allowedDateEntries = getAllowedConfigDateEntries(tpi, planningConfig)

  return {
    candidateClass: classProfile.rawClass,
    candidateClassLabel: classProfile.label || classProfile.rawClass,
    classCode: classProfile.code,
    isMatu: classProfile.isMatu,
    allowedDateKeys: allowedDateEntries
      .map((entry) => toIsoDateKey(entry?.date))
      .filter(Boolean),
    allowedDateLabels: allowedDateEntries
      .map((entry) => formatDateLabel(entry?.date))
      .filter(Boolean),
    source: allowedDateEntries.length > 0 ? 'planning_config' : 'planning_slots'
  }
}

function filterSlotDocumentsForVoteProposal(slotDocuments = [], proposalContext = {}) {
  const allowedDateKeys = new Set(
    Array.isArray(proposalContext?.allowedDateKeys)
      ? proposalContext.allowedDateKeys.filter(Boolean)
      : []
  )

  if (allowedDateKeys.size === 0) {
    return Array.isArray(slotDocuments) ? slotDocuments : []
  }

  return (Array.isArray(slotDocuments) ? slotDocuments : []).filter((slotDocument) =>
    allowedDateKeys.has(toIsoDateKey(slotDocument?.date))
  )
}

function normalizeSiteToken(value) {
  return compactText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase()
}

function findSiteConfigForTpi(tpi, planningConfig = {}) {
  const tpiSiteToken = normalizeSiteToken(tpi?.site || tpi?.lieu?.site)

  if (!tpiSiteToken) {
    return null
  }

  return (Array.isArray(planningConfig?.siteConfigs) ? planningConfig.siteConfigs : [])
    .find((siteConfig) => {
      const candidates = [
        siteConfig?.siteId,
        siteConfig?.siteCode,
        siteConfig?.label
      ]

      return candidates.some((candidate) => normalizeSiteToken(candidate) === tpiSiteToken)
    }) || null
}

function buildProposalOptionDisplay(slot, planningConfig = {}, tpi = {}) {
  const siteConfig = findSiteConfigForTpi(tpi, planningConfig) || {}
  const startMinutes = parseTimeToMinutes(slot?.startTime)
  const endMinutes = parseTimeToMinutes(slot?.endTime)
  const exactStartTime = normalizeTimeLabel(slot?.startTime)
  const exactEndTime = normalizeTimeLabel(slot?.endTime)
  const exactTimeLabel = exactStartTime && exactEndTime
    ? `${exactStartTime} - ${exactEndTime}`
    : compactText([slot?.startTime, slot?.endTime].filter(Boolean).join(' - '))
  const windowPeriod = resolveSlotWindowPeriod(slot)
  const isMorning = windowPeriod === 'AM'
  const periodLabel = isMorning ? 'Matin' : 'Après-midi'
  const windowStartTime = isMorning
    ? normalizeTimeLabel(siteConfig?.firstTpiStartTime || '08:00')
    : '13:00'
  const configuredDayEnd = siteConfig?.numSlots
    ? parseTimeToMinutes(siteConfig.firstTpiStartTime || '08:00') +
      (Number(siteConfig.numSlots) - 1) *
        (Number(siteConfig.tpiTimeMinutes || 60) + Number(siteConfig.breaklineMinutes || 0)) +
      Number(siteConfig.tpiTimeMinutes || 60)
    : null
  const windowEndTime = isMorning
    ? '12:00'
    : formatMinutesAsTime(configuredDayEnd || endMinutes || (17 * 60))

  return {
    isGroupedWindow: true,
    showExactTime: false,
    windowPeriod,
    windowCapacity: countConfiguredPeriodsForWindow(siteConfig, windowPeriod),
    periodLabel,
    windowStartTime,
    windowEndTime,
    timeRangeLabel: `${windowStartTime} - ${windowEndTime}`,
    exactStartTime,
    exactEndTime,
    exactTimeLabel
  }
}

function getSlotStatusRank(slot) {
  if (slot?.status === 'available') {
    return 0
  }

  if (!slot?.assignedTpi) {
    return 1
  }

  return 2
}

function buildConfiguredSlotProposalOptions(slotDocuments = [], {
  fixedSlotId = '',
  existingSlotIds = new Set(),
  planningConfig = {},
  proposalContext = {},
  tpi = {},
  source = 'planning_config_window'
} = {}) {
  const optionsByWindow = new Map()
  const filteredSlotDocuments = filterSlotDocumentsForVoteProposal(slotDocuments, proposalContext)

  for (const slotDocument of filteredSlotDocuments) {
    const slotId = slotDocument?._id ? String(slotDocument._id) : ''

    if (!slotId || slotId === fixedSlotId || existingSlotIds.has(slotId)) {
      continue
    }

    const windowKey = buildSlotQueueKey(slotDocument)

    if (!windowKey.replace(/\|/g, '')) {
      continue
    }

    const current = optionsByWindow.get(windowKey)
    if (current && getSlotStatusRank(current.slot) <= getSlotStatusRank(slotDocument)) {
      continue
    }

    optionsByWindow.set(windowKey, {
      slotId,
      voteId: null,
      slot: slotDocument,
      source,
      queueKey: windowKey,
      score: null,
      reason: slotDocument.status === 'available'
        ? 'Créneau disponible selon la configuration'
        : 'Fenêtre de planning proposée selon la configuration',
      display: buildProposalOptionDisplay(slotDocument, planningConfig, tpi),
      availabilityStatus: slotDocument.status === 'available' ? 'available' : 'planning_window'
    })
  }

  return Array.from(optionsByWindow.values()).sort((left, right) => {
    const leftKey = [
      toIsoDateKey(left.slot?.date),
      String(left.display?.windowPeriod || resolveSlotWindowPeriod(left.slot)),
      compactText(left.slot?.room?.site)
    ].join('|')
    const rightKey = [
      toIsoDateKey(right.slot?.date),
      String(right.display?.windowPeriod || resolveSlotWindowPeriod(right.slot)),
      compactText(right.slot?.room?.site)
    ].join('|')

    return leftKey.localeCompare(rightKey)
  })
}

module.exports = {
  buildConfiguredSlotProposalOptions,
  buildProposalOptionDisplay,
  buildSlotQueueKey,
  buildVoteProposalContext,
  filterSlotDocumentsForVoteProposal,
  resolveSlotWindowPeriod
}
