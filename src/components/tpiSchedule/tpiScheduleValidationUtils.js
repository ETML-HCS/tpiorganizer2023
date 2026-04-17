const compactText = (value) => {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

const toIntegerOrNull = (value) => {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) ? parsed : null
}

const toUniqueSortedValues = (values) => {
  return Array.from(
    new Set((Array.isArray(values) ? values : []).map((value) => compactText(value)).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right))
}

const toRoomModeLabel = (mode) => mode === "matu" ? "MATU" : ""

export const buildValidationIssueKey = (issue = {}) => {
  const type = compactText(issue.type)

  if (type === "person_overlap") {
    const references = toUniqueSortedValues(issue.references).join(",")
    return [
      type,
      compactText(issue.dateKey),
      compactText(issue.period),
      compactText(issue.personName || issue.personId),
      references
    ].join("|")
  }

  if (type === "room_overlap") {
    const references = toUniqueSortedValues(issue.references).join(",")
    return [
      type,
      compactText(issue.dateKey),
      compactText(issue.period),
      compactText(issue.site),
      compactText(issue.roomName),
      references
    ].join("|")
  }

  if (type === "consecutive_limit") {
    const slotLabels = toUniqueSortedValues(issue.slotLabels || issue.slotKeys).join("|")
    return [
      type,
      compactText(issue.personName || issue.personId),
      compactText(issue.consecutiveCount),
      slotLabels
    ].join("|")
  }

  if (type === "room_class_mismatch") {
    return [
      type,
      compactText(issue.reference),
      compactText(issue.roomSite),
      compactText(issue.roomName),
      compactText(issue.roomClassMode),
      compactText(issue.tpiClassMode)
    ].join("|")
  }

  return [type, compactText(issue.message)].join("|")
}

export const buildLocalValidationIssues = (analysis = {}) => {
  const personOverlapIssues = (Array.isArray(analysis.personOverlaps) ? analysis.personOverlaps : [])
    .map((conflict) => {
      const [dateKey, periodText] = String(conflict?.slotKey || "").split("|")
      const references = toUniqueSortedValues(conflict?.references)
      const personName = compactText(conflict?.personName) || "Personne inconnue"

      if (references.length < 2) {
        return null
      }

      return {
        type: "person_overlap",
        severity: "error",
        dateKey: compactText(dateKey),
        period: toIntegerOrNull(periodText) ?? toIntegerOrNull(conflict?.period),
        personId: "",
        personName,
        references,
        roles: toUniqueSortedValues(conflict?.roles),
        message: `${personName} est affecté à plusieurs TPI sur le même créneau (${references.join(", ")}).`
      }
    })
    .filter(Boolean)

  const sequenceIssues = (Array.isArray(analysis.sequenceViolations) ? analysis.sequenceViolations : [])
    .map((issue) => {
      const personName = compactText(issue?.personName) || "Personne inconnue"
      const consecutiveCount = toIntegerOrNull(issue?.consecutiveCount) || 0
      const slotKeys = toUniqueSortedValues(issue?.slotKeys)

      if (consecutiveCount <= 4 || slotKeys.length === 0) {
        return null
      }

      return {
        type: "consecutive_limit",
        severity: "error",
        personId: "",
        personName,
        consecutiveCount,
        slotKeys,
        message: `${personName} a ${consecutiveCount} TPI consécutifs. Une pause d'un créneau est obligatoire avant de reprendre.`
      }
    })
    .filter(Boolean)

  const classMismatchIssues = (Array.isArray(analysis.classMismatches) ? analysis.classMismatches : [])
    .map((issue) => {
      const roomModeLabel = toRoomModeLabel(issue?.roomClassMode)
      const tpiLabel = [issue?.reference, issue?.candidat, issue?.classe]
        .map((value) => compactText(value))
        .filter(Boolean)
        .join(" - ")
      const roomLabel = roomModeLabel
        ? `salle ${roomModeLabel}`
        : "salle non compatible"

      return {
        type: "room_class_mismatch",
        severity: "error",
        reference: compactText(issue?.reference),
        roomName: compactText(issue?.roomName),
        roomSite: compactText(issue?.roomSite),
        roomClassMode: compactText(issue?.roomClassMode),
        tpiClassMode: compactText(issue?.tpiClassMode),
        message: `${tpiLabel || "TPI inconnu"} est associé à une ${roomLabel}.`
      }
    })
    .filter((issue) => Boolean(issue.reference || issue.roomName || issue.message))

  const issues = [
    ...personOverlapIssues,
    ...sequenceIssues,
    ...classMismatchIssues
  ]

  return {
    issues,
    summary: {
      personOverlapCount: personOverlapIssues.length,
      roomOverlapCount: 0,
      sequenceViolationCount: sequenceIssues.length,
      classMismatchCount: classMismatchIssues.length,
      issueCount: issues.length,
      hardConflictCount: issues.length
    }
  }
}

export const buildValidationResultFromSources = (year, validationResponse, localAnalysis = {}) => {
  const backendSummary = validationResponse?.summary || {}
  const backendIssuesSource = Array.isArray(validationResponse?.issues)
    ? validationResponse.issues
    : Array.isArray(validationResponse?.hardConflicts)
      ? validationResponse.hardConflicts
      : []
  const localValidation = buildLocalValidationIssues(localAnalysis)
  const mergedIssuesMap = new Map()

  for (const issue of [...backendIssuesSource, ...localValidation.issues]) {
    const issueKey = buildValidationIssueKey(issue)
    if (!mergedIssuesMap.has(issueKey)) {
      mergedIssuesMap.set(issueKey, issue)
    }
  }

  const mergedIssues = Array.from(mergedIssuesMap.values())
  const typeCounts = mergedIssues.reduce((acc, issue) => {
    const type = compactText(issue?.type)
    if (type) {
      acc[type] = (acc[type] || 0) + 1
    }
    return acc
  }, {})

  return {
    year: Number(year),
    checkedAt: validationResponse?.checkedAt || new Date().toISOString(),
    summary: {
      ...backendSummary,
      personOverlapCount: Number(typeCounts.person_overlap || 0),
      roomOverlapCount: Number(typeCounts.room_overlap || 0),
      sequenceViolationCount: Number(typeCounts.consecutive_limit || 0),
      classMismatchCount: Number(typeCounts.room_class_mismatch || 0),
      issueCount: mergedIssues.length,
      hardConflictCount: mergedIssues.length,
      isValid: mergedIssues.length === 0
    },
    issues: mergedIssues
  }
}
