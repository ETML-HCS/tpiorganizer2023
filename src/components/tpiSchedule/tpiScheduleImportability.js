function normalizeImportValue(value) {
  if (value === null || value === undefined) {
    return ""
  }

  const normalized = String(value).trim()
  if (!normalized) {
    return ""
  }

  const lowered = normalized.toLowerCase()
  return lowered === "null" || lowered === "undefined"
    ? ""
    : normalized
}

function hasImportValue(value) {
  return Boolean(normalizeImportValue(value))
}

function hasRoleAssignment(name, personId) {
  return hasImportValue(name) || hasImportValue(personId)
}

export function hasMeaningfulPlanningAssignment(tpi = {}) {
  return [
    tpi?.refTpi,
    tpi?.candidat,
    tpi?.candidatPersonId,
    tpi?.expert1?.name,
    tpi?.expert1?.personId,
    tpi?.expert2?.name,
    tpi?.expert2?.personId,
    tpi?.boss?.name,
    tpi?.boss?.personId
  ].some(hasImportValue)
}

export function isPlanningTpiImportable(tpi = {}) {
  if (!hasMeaningfulPlanningAssignment(tpi)) {
    return true
  }

  return (
    hasRoleAssignment(tpi?.candidat, tpi?.candidatPersonId) &&
    hasRoleAssignment(tpi?.expert1?.name, tpi?.expert1?.personId) &&
    hasRoleAssignment(tpi?.expert2?.name, tpi?.expert2?.personId) &&
    hasRoleAssignment(tpi?.boss?.name, tpi?.boss?.personId)
  )
}

export function getNonImportableTpiRefs(rooms = []) {
  const refs = new Set()

  for (const room of Array.isArray(rooms) ? rooms : []) {
    for (const tpi of Array.isArray(room?.tpiDatas) ? room.tpiDatas : []) {
      if (!hasMeaningfulPlanningAssignment(tpi) || isPlanningTpiImportable(tpi)) {
        continue
      }

      const ref = normalizeImportValue(tpi?.refTpi || tpi?.id)
      if (ref) {
        refs.add(ref)
      }
    }
  }

  return Array.from(refs)
}

