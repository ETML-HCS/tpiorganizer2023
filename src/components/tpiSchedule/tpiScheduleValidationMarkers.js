import { normalizeSoutenanceDateValue } from "./soutenanceDateUtils"
import {
  buildLocalValidationIssues,
  isValidationWarningIssue
} from "./tpiScheduleValidationUtils"

const compactText = (value) => {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

const normalizePersonName = (value) =>
  compactText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()

const normalizePersonId = (value) => compactText(value)

const buildPersonIdKey = (value) => {
  const personId = normalizePersonId(value)
  return personId ? `id:${personId}` : ""
}

const buildPersonNameKey = (value) => {
  const name = normalizePersonName(value)
  return name ? `name:${name}` : ""
}

const getIssuePersonKeys = (issue = {}) => [
  buildPersonIdKey(issue.personId),
  buildPersonNameKey(issue.personName)
].filter(Boolean)

const toUniqueSortedValues = (values) => {
  return Array.from(
    new Set((Array.isArray(values) ? values : []).map((value) => compactText(value)).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right))
}

const normalizeReferenceLookupKey = (value) => {
  const text = compactText(value).toUpperCase()

  if (!text) {
    return ""
  }

  const tpiMatch = text.match(/^TPI-(?:\d{4}-)?(.+)$/)
  const referenceBody = tpiMatch ? tpiMatch[1] : text

  if (/^\d+$/.test(referenceBody)) {
    return String(Number.parseInt(referenceBody, 10))
  }

  return referenceBody
}

const getReferenceLookupKeys = (value) => {
  const normalizedKey = normalizeReferenceLookupKey(value)
  return normalizedKey ? [normalizedKey] : []
}

const getSlotsByReference = (slotsByReference, reference) => {
  const slotsByKey = new Map()

  getReferenceLookupKeys(reference).forEach((lookupKey) => {
    ;(slotsByReference.get(lookupKey) || []).forEach((slot) => {
      slotsByKey.set(slot.slotKey, slot)
    })
  })

  return Array.from(slotsByKey.values())
}

export const VALIDATION_ISSUE_MARKER_STYLES = {
  person_overlap: {
    tone: "danger",
    priority: 10
  },
  room_overlap: {
    tone: "danger",
    priority: 15
  },
  consecutive_limit: {
    tone: "sequence",
    priority: 30
  },
  room_class_mismatch: {
    tone: "room",
    priority: 40
  },
  unplanned_tpi: {
    tone: "planning",
    priority: 50
  },
  legacy_tpi_missing_reference: {
    tone: "import",
    priority: 55
  },
  legacy_tpi_missing_stakeholders: {
    tone: "import",
    priority: 55
  },
  legacy_tpi_unresolved_stakeholders: {
    tone: "import",
    priority: 55
  },
  legacy_tpi_not_imported: {
    tone: "import",
    priority: 55
  },
  availability_override: {
    tone: "warning",
    priority: 60
  },
  automatic_constraint_override: {
    tone: "warning",
    priority: 60
  }
}

const FALLBACK_VALIDATION_ISSUE_MARKER_STYLE = {
  tone: "danger",
  priority: 90
}

export const getValidationIssueMarkerStyle = (issue = {}) => {
  const issueType = compactText(issue?.type)
  const baseStyle = VALIDATION_ISSUE_MARKER_STYLES[issueType] || FALLBACK_VALIDATION_ISSUE_MARKER_STYLE
  const isWarning = isValidationWarningIssue(issue)

  return {
    issueType,
    tone: isWarning && !VALIDATION_ISSUE_MARKER_STYLES[issueType]
      ? "warning"
      : baseStyle.tone,
    priority: Number(baseStyle.priority || FALLBACK_VALIDATION_ISSUE_MARKER_STYLE.priority) + (isWarning ? 100 : 0)
  }
}

const buildStepKey = (dateValue, period) => {
  const dateKey = normalizeSoutenanceDateValue(dateValue)
  const normalizedPeriod = Number.parseInt(String(period), 10)

  if (!dateKey || !Number.isInteger(normalizedPeriod)) {
    return ""
  }

  return `${dateKey}|${normalizedPeriod}`
}

export const buildPlanningSlotKey = ({ dateValue, period, site, roomName }) => {
  return [
    buildStepKey(dateValue, period),
    compactText(site).toUpperCase(),
    compactText(roomName)
  ].join("|")
}

const getTpiReference = (tpi) => compactText(tpi?.refTpi || tpi?.id)

const getTpiParticipantKeys = (tpi) => {
  return new Set(
    [
      [tpi?.candidatPersonId, tpi?.candidat],
      [tpi?.expert1?.personId, tpi?.expert1?.name],
      [tpi?.expert2?.personId, tpi?.expert2?.name],
      [tpi?.boss?.personId, tpi?.boss?.name]
    ]
      .flatMap(([personId, name]) => [
        buildPersonIdKey(personId),
        buildPersonNameKey(name)
      ])
      .filter(Boolean)
  )
}

const buildSlotIndex = (roomEntries) => {
  const slots = []
  const slotsByReference = new Map()

  for (const room of Array.isArray(roomEntries) ? roomEntries : []) {
    const tpiDatas = Array.isArray(room?.tpiDatas) ? room.tpiDatas : []

    tpiDatas.forEach((tpi, index) => {
      const period = index + 1
      const slotKey = buildPlanningSlotKey({
        dateValue: room?.date,
        period,
        site: room?.site,
        roomName: room?.name || room?.nameRoom
      })
      const slot = {
        slotKey,
        stepKey: buildStepKey(room?.date, period),
        dateKey: normalizeSoutenanceDateValue(room?.date),
        period,
        site: compactText(room?.site).toUpperCase(),
        roomName: compactText(room?.name || room?.nameRoom),
        reference: getTpiReference(tpi),
        participantKeys: getTpiParticipantKeys(tpi)
      }

      slots.push(slot)

      getReferenceLookupKeys(slot.reference).forEach((lookupKey) => {
        if (!slotsByReference.has(lookupKey)) {
          slotsByReference.set(lookupKey, [])
        }
        slotsByReference.get(lookupKey).push(slot)
      })
    })
  }

  return {
    slots,
    slotsByReference
  }
}

const addMarker = (markers, slotKey, issue) => {
  if (!slotKey) {
    return
  }

  if (!markers.has(slotKey)) {
    markers.set(slotKey, {
      hasError: false,
      hasWarning: false,
      severity: "none",
      primaryIssueType: "",
      tone: "",
      issueTones: [],
      issueTypes: [],
      hasMultipleIssueTypes: false,
      messages: []
    })
  }

  const current = markers.get(slotKey)
  if (isValidationWarningIssue(issue)) {
    current.hasWarning = true
  } else {
    current.hasError = true
  }
  current.severity = current.hasError
    ? "error"
    : current.hasWarning
      ? "warning"
      : "none"

  const type = compactText(issue?.type)
  const message = compactText(issue?.message)
  const markerStyle = getValidationIssueMarkerStyle(issue)

  if (type && !current.issueTypes.includes(type)) {
    current.issueTypes.push(type)
  }

  if (markerStyle.tone && !current.issueTones.includes(markerStyle.tone)) {
    current.issueTones.push(markerStyle.tone)
  }

  if (
    markerStyle.issueType &&
    (!current.primaryIssueType || markerStyle.priority < current.priority)
  ) {
    current.primaryIssueType = markerStyle.issueType
    current.tone = markerStyle.tone
    current.priority = markerStyle.priority
  }

  current.hasMultipleIssueTypes = current.issueTypes.length > 1

  if (message && !current.messages.includes(message)) {
    current.messages.push(message)
  }
}

export const buildValidationMarkers = (roomEntries, validationResult, localAnalysis = null) => {
  const validationIssues = Array.isArray(validationResult?.issues) ? validationResult.issues : []
  const localIssues = localAnalysis
    ? buildLocalValidationIssues(localAnalysis).issues
    : []
  const issues = [...validationIssues, ...localIssues]
  const { slots, slotsByReference } = buildSlotIndex(roomEntries)
  const markers = new Map()

  const issueMatchesSlotStep = (issue, slot) => {
    const issueStepKey = buildStepKey(issue?.dateKey, issue?.period)
    return !issueStepKey || slot.stepKey === issueStepKey
  }

  for (const issue of issues) {
    const type = compactText(issue?.type)

    if (!type) {
      continue
    }

    if (type === "room_class_mismatch") {
      const reference = compactText(issue?.reference)
      const matchingSlots = reference ? getSlotsByReference(slotsByReference, reference) : []
      matchingSlots.forEach((slot) => addMarker(markers, slot.slotKey, issue))
      continue
    }

    if (type === "person_overlap") {
      const references = toUniqueSortedValues(issue?.references)

      if (references.length > 0) {
        const matchedSlots = []
        references.forEach((reference) => {
          getSlotsByReference(slotsByReference, reference)
            .filter((slot) => issueMatchesSlotStep(issue, slot))
            .forEach((slot) => matchedSlots.push(slot))
        })

        if (matchedSlots.length > 0) {
          matchedSlots.forEach((slot) => addMarker(markers, slot.slotKey, issue))
          continue
        }
      }

      const personKeys = getIssuePersonKeys(issue)
      const issueStepKey = buildStepKey(issue?.dateKey, issue?.period)

      slots
        .filter((slot) =>
          slot.stepKey === issueStepKey &&
          personKeys.some((personKey) => slot.participantKeys.has(personKey))
        )
        .forEach((slot) => addMarker(markers, slot.slotKey, issue))
      continue
    }

    if (type === "consecutive_limit") {
      const personKeys = getIssuePersonKeys(issue)
      const slotKeys = new Set(toUniqueSortedValues(issue?.slotKeys))

      if (personKeys.length === 0 || slotKeys.size === 0) {
        continue
      }

      slots
        .filter((slot) =>
          slotKeys.has(slot.stepKey) &&
          personKeys.some((personKey) => slot.participantKeys.has(personKey))
        )
        .forEach((slot) => addMarker(markers, slot.slotKey, issue))
      continue
    }

    if (type === "room_overlap") {
      const references = toUniqueSortedValues(issue?.references)

      if (references.length > 0) {
        const issueStepKey = buildStepKey(issue?.dateKey, issue?.period)
        const issueSite = compactText(issue?.site || issue?.roomSite).toUpperCase()
        const issueRoomName = compactText(issue?.roomName)

        references.forEach((reference) => {
          getSlotsByReference(slotsByReference, reference)
            .filter((slot) =>
              (!issueStepKey || slot.stepKey === issueStepKey) &&
              (!issueSite || slot.site === issueSite) &&
              (!issueRoomName || slot.roomName === issueRoomName)
            )
            .forEach((slot) => addMarker(markers, slot.slotKey, issue))
        })
      }
      continue
    }

    const references = toUniqueSortedValues([
      issue?.reference,
      ...(Array.isArray(issue?.references) ? issue.references : [])
    ])

    if (references.length > 0) {
      references.forEach((reference) => {
        const matchingSlots = getSlotsByReference(slotsByReference, reference)
        matchingSlots.forEach((slot) => addMarker(markers, slot.slotKey, issue))
      })
    }
  }

  return Object.fromEntries(markers)
}
