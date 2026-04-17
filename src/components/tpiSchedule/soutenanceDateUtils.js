const compactText = (value) => {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

export const normalizeSoutenanceDateValue = (value) => {
  const text = compactText(value)
  if (!text) {
    return ""
  }

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) {
    return text.slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

export const applySoutenanceDateYear = (value, year) => {
  const normalizedDate = normalizeSoutenanceDateValue(value)
  const parsedYear = Number.parseInt(year, 10)

  if (!normalizedDate || !Number.isInteger(parsedYear)) {
    return normalizedDate
  }

  return `${String(parsedYear).padStart(4, "0")}${normalizedDate.slice(4)}`
}

export const formatSoutenanceDateLabel = (value) => {
  const text = compactText(value)
  if (!text) {
    return ""
  }

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) {
    return text
  }

  return date.toLocaleDateString("fr-CH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  })
}

export const normalizeSoutenanceDateEntry = (value) => {
  if (!value && value !== 0) {
    return null
  }

  const isObjectEntry = value && typeof value === "object"
  const rawDate = isObjectEntry
    ? value.date ?? value.value ?? value.label ?? ""
    : value
  const date = normalizeSoutenanceDateValue(rawDate)

  if (!date) {
    return null
  }

  // Normalize the optional classes array (e.g. ["M"], ["C", "F"])
  const rawClasses = isObjectEntry
    ? (value.classes ?? value.classePrefixes ?? null)
    : null
  const classes = Array.isArray(rawClasses)
    ? rawClasses
        .map((c) => String(c ?? "").trim().toUpperCase())
        .filter(Boolean)
    : []

  return {
    date,
    min: Boolean(
      isObjectEntry && (value.min ?? value.isMin ?? value.minimal ?? value.minDate)
    ),
    special: Boolean(
      isObjectEntry && (value.special ?? value.other ?? value.isSpecial ?? value.specialDate)
    ),
    classes,
    label: formatSoutenanceDateLabel(date)
  }
}

const normalizeSoutenanceDateClasses = (entry) =>
  Array.isArray(entry?.classes)
    ? entry.classes
        .map((value) => String(value ?? "").trim().toUpperCase())
        .filter(Boolean)
    : []

const isMatuSoutenanceClass = (value) => {
  const normalizedValue = String(value ?? "").trim().toUpperCase()

  return normalizedValue === "M" || normalizedValue === "MATU" || normalizedValue.startsWith("M")
}

export const getSoutenanceDateBadgeLabel = (entry) => {
  if (!entry || typeof entry !== "object") {
    return ""
  }

  if (Boolean(entry.min) || normalizeSoutenanceDateClasses(entry).some(isMatuSoutenanceClass)) {
    return "MATU"
  }

  if (Boolean(entry.special)) {
    return "SPECIAL"
  }

  return ""
}

export const getSoutenanceDateBadgeTone = (entry) => {
  const label = getSoutenanceDateBadgeLabel(entry)

  if (label === "MATU") {
    return "matu"
  }

  if (label === "SPECIAL") {
    return "special"
  }

  return ""
}

export const normalizeSoutenanceDateEntries = (values) => {
  const entries = Array.isArray(values) ? values : [values]
  const normalizedByDate = new Map()

  entries.forEach((value) => {
    const entry = normalizeSoutenanceDateEntry(value)
    if (!entry) {
      return
    }

    const current = normalizedByDate.get(entry.date)
    if (!current) {
      normalizedByDate.set(entry.date, entry)
      return
    }

    normalizedByDate.set(entry.date, {
      ...current,
      min: current.min || entry.min,
      special: current.special || entry.special,
      classes: Array.from(new Set([...current.classes, ...entry.classes]))
    })
  })

  return Array.from(normalizedByDate.values()).sort((left, right) => {
    const leftTime = new Date(left.date).getTime()
    const rightTime = new Date(right.date).getTime()

    const leftValid = !Number.isNaN(leftTime)
    const rightValid = !Number.isNaN(rightTime)

    if (leftValid && rightValid) {
      return leftTime - rightTime
    }

    if (leftValid) {
      return -1
    }

    if (rightValid) {
      return 1
    }

    return left.date.localeCompare(right.date)
  })
}

export const extractSoutenanceDateValues = (values) =>
  normalizeSoutenanceDateEntries(values).map((entry) => entry.date)
