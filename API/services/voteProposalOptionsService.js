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
  const configEntries = Array.isArray(planningConfig?.soutenanceDates)
    ? planningConfig.soutenanceDates.filter((entry) => entry?.special !== true)
    : []

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

module.exports = {
  buildVoteProposalContext,
  filterSlotDocumentsForVoteProposal
}
