const DEFAULT_SOUTENANCE_SITE_COLORS = Object.freeze({
  ETML: "#6700E3",
  CFPV: "#DE2092"
})

export const DEFAULT_STAKEHOLDER_ICON_KEYS = Object.freeze({
  candidate: "candidate",
  expert1: "participant",
  expert2: "participant",
  projectManager: "participant"
})

export const STAKEHOLDER_ICON_OPTIONS = Object.freeze([
  { value: "candidate", label: "Candidat" },
  { value: "participant", label: "Participant" }
])

const STAKEHOLDER_ICON_VALUES = new Set(STAKEHOLDER_ICON_OPTIONS.map((option) => option.value))

export function normalizeSoutenanceColor(value) {
  const hex = String(value || "").trim().replace(/^#/, "")

  if (/^[\da-fA-F]{3}$/.test(hex)) {
    return `#${hex
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toUpperCase()}`
  }

  if (/^[\da-fA-F]{6}$/.test(hex)) {
    return `#${hex.toUpperCase()}`
  }

  return ""
}

export function normalizeOptionalSoutenanceColor(source = {}, fallback = {}) {
  const sourceObject = source && typeof source === "object" ? source : {}
  const fallbackObject = fallback && typeof fallback === "object" ? fallback : {}
  const keys = ["soutenanceColor", "defenseColor", "defenceColor"]

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(sourceObject, key)) {
      return normalizeSoutenanceColor(sourceObject[key])
    }
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(fallbackObject, key)) {
      return normalizeSoutenanceColor(fallbackObject[key])
    }
  }

  return ""
}

export function getDefaultSoutenanceColor(siteCode = "") {
  const normalizedSiteCode = String(siteCode || "").trim().toUpperCase()
  return DEFAULT_SOUTENANCE_SITE_COLORS[normalizedSiteCode] || "#475569"
}

export function resolveSoutenanceColor(source = {}, siteCode = "") {
  return normalizeOptionalSoutenanceColor(source) || getDefaultSoutenanceColor(siteCode)
}

function hexToRgba(color, alpha = 1) {
  const normalizedColor = normalizeSoutenanceColor(color)

  if (!normalizedColor) {
    return `rgba(71, 85, 105, ${alpha})`
  }

  const hex = normalizedColor.slice(1)
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function buildSoutenanceRoomAppearance(room = {}) {
  const configSite = room?.configSite && typeof room.configSite === "object"
    ? room.configSite
    : {}
  const color = normalizeOptionalSoutenanceColor(configSite)

  if (!color) {
    return {
      className: "",
      style: undefined
    }
  }

  return {
    className: "has-soutenance-color",
    style: {
      "--soutenance-room-accent": color,
      "--soutenance-room-accent-soft": hexToRgba(color, 0.22),
      "--soutenance-room-accent-faint": hexToRgba(color, 0.08)
    }
  }
}

export function normalizeStakeholderIconKey(value, fallback = "participant") {
  const normalizedValue = String(value || "").trim()
  return STAKEHOLDER_ICON_VALUES.has(normalizedValue)
    ? normalizedValue
    : fallback
}

export function normalizeStakeholderIcons(source = {}, fallback = DEFAULT_STAKEHOLDER_ICON_KEYS) {
  const sourceObject = source && typeof source === "object" ? source : {}
  const rawIcons = sourceObject.stakeholderIcons && typeof sourceObject.stakeholderIcons === "object"
    ? sourceObject.stakeholderIcons
    : sourceObject
  const fallbackIcons = fallback && typeof fallback === "object" ? fallback : DEFAULT_STAKEHOLDER_ICON_KEYS

  return {
    candidate: normalizeStakeholderIconKey(rawIcons.candidate, fallbackIcons.candidate || DEFAULT_STAKEHOLDER_ICON_KEYS.candidate),
    expert1: normalizeStakeholderIconKey(rawIcons.expert1, fallbackIcons.expert1 || DEFAULT_STAKEHOLDER_ICON_KEYS.expert1),
    expert2: normalizeStakeholderIconKey(rawIcons.expert2, fallbackIcons.expert2 || DEFAULT_STAKEHOLDER_ICON_KEYS.expert2),
    projectManager: normalizeStakeholderIconKey(
      rawIcons.projectManager || rawIcons.boss,
      fallbackIcons.projectManager || DEFAULT_STAKEHOLDER_ICON_KEYS.projectManager
    )
  }
}

export function resolveStakeholderIconKey(stakeholderIcons = {}, type = "") {
  const icons = normalizeStakeholderIcons(stakeholderIcons)
  return icons[type] || DEFAULT_STAKEHOLDER_ICON_KEYS[type] || "participant"
}
