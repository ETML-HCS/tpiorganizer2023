import { normalizeSoutenanceDateValue } from "./soutenanceDateUtils"

const compactText = (value) => {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

const normalizeName = (value) => compactText(value).replace(/\s+/g, " ").toLowerCase()

const toUniqueSortedValues = (values) => {
  return Array.from(
    new Set((Array.isArray(values) ? values : []).map((value) => compactText(value)).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right))
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

const getTpiReference = (tpi) => compactText(tpi?.refTpi)

const getTpiParticipantNames = (tpi) => {
  return new Set(
    [
      tpi?.candidat,
      tpi?.expert1?.name,
      tpi?.expert2?.name,
      tpi?.boss?.name
    ]
      .map((value) => normalizeName(value))
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
        participantNames: getTpiParticipantNames(tpi)
      }

      slots.push(slot)

      if (slot.reference) {
        if (!slotsByReference.has(slot.reference)) {
          slotsByReference.set(slot.reference, [])
        }
        slotsByReference.get(slot.reference).push(slot)
      }
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
      hasError: true,
      issueTypes: [],
      messages: []
    })
  }

  const current = markers.get(slotKey)
  const type = compactText(issue?.type)
  const message = compactText(issue?.message)

  if (type && !current.issueTypes.includes(type)) {
    current.issueTypes.push(type)
  }

  if (message && !current.messages.includes(message)) {
    current.messages.push(message)
  }
}

export const buildValidationMarkers = (roomEntries, validationResult) => {
  const issues = Array.isArray(validationResult?.issues) ? validationResult.issues : []
  const { slots, slotsByReference } = buildSlotIndex(roomEntries)
  const markers = new Map()

  for (const issue of issues) {
    const type = compactText(issue?.type)

    if (!type) {
      continue
    }

    if (type === "room_class_mismatch") {
      const reference = compactText(issue?.reference)
      const matchingSlots = reference ? slotsByReference.get(reference) || [] : []
      matchingSlots.forEach((slot) => addMarker(markers, slot.slotKey, issue))
      continue
    }

    if (type === "person_overlap") {
      const references = toUniqueSortedValues(issue?.references)

      if (references.length > 0) {
        references.forEach((reference) => {
          const matchingSlots = slotsByReference.get(reference) || []
          matchingSlots.forEach((slot) => addMarker(markers, slot.slotKey, issue))
        })
        continue
      }

      const personName = normalizeName(issue?.personName)
      const issueStepKey = buildStepKey(issue?.dateKey, issue?.period)

      slots
        .filter((slot) => slot.stepKey === issueStepKey && slot.participantNames.has(personName))
        .forEach((slot) => addMarker(markers, slot.slotKey, issue))
      continue
    }

    if (type === "consecutive_limit") {
      const personName = normalizeName(issue?.personName)
      const slotKeys = new Set(toUniqueSortedValues(issue?.slotKeys))

      if (!personName || slotKeys.size === 0) {
        continue
      }

      slots
        .filter((slot) => slotKeys.has(slot.stepKey) && slot.participantNames.has(personName))
        .forEach((slot) => addMarker(markers, slot.slotKey, issue))
      continue
    }

    if (type === "room_overlap") {
      const references = toUniqueSortedValues(issue?.references)

      if (references.length > 0) {
        references.forEach((reference) => {
          const matchingSlots = slotsByReference.get(reference) || []
          matchingSlots.forEach((slot) => addMarker(markers, slot.slotKey, issue))
        })
      }
    }
  }

  return Object.fromEntries(markers)
}
