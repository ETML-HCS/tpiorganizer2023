import { STORAGE_KEYS } from "../config/appConfig"

const LEGACY_STORAGE_KEYS = {
  TOKEN: "token",
  ORGANIZER_DATA: "organizerData",
  EVALUATION_DATA: "evaluationData",
  TPI_LIST: "tpiList",
  PLANNING_USER: "planningUser"
}

const hasLocalStorage = () => {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage)
  } catch {
    return false
  }
}

const getStorage = () => {
  return hasLocalStorage() ? window.localStorage : null
}

const normalizeBase64Url = (value) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4

  if (padding === 0) {
    return normalized
  }

  return normalized + "=".repeat(4 - padding)
}

const normalizeEndpointPath = (endpoint = "") => {
  if (typeof endpoint !== "string") {
    return ""
  }

  return endpoint.split("?")[0].split("#")[0]
}

const getCurrentPathname = () => {
  if (typeof window === "undefined") {
    return ""
  }

  return typeof window.location?.pathname === "string"
    ? window.location.pathname
    : ""
}

export const getAuthScopeForEndpoint = (endpoint = "") => {
  const path = normalizeEndpointPath(endpoint)

  if (
    path === "/api/auth/login" ||
    path.startsWith("/api/planning/auth/") ||
    path.startsWith("/api/magic-link/")
  ) {
    return "public"
  }

  if (
    path === "/api/planning" ||
    path.startsWith("/api/planning/") ||
    path === "/api/workflow" ||
    path.startsWith("/api/workflow/")
  ) {
    return "planning"
  }

  return "app"
}

const shouldPreferPlanningToken = (endpoint = "") => {
  const path = normalizeEndpointPath(endpoint)
  const currentPathname = getCurrentPathname()

  if (!(path === "/api/planning" || path.startsWith("/api/planning/") || path === "/api/workflow" || path.startsWith("/api/workflow/"))) {
    return false
  }

  return currentPathname === "/planning" || currentPathname.startsWith("/planning/")
}

export const decodeJwtPayload = (token) => {
  if (typeof token !== "string" || token.trim().length === 0) {
    return null
  }

  const parts = token.split(".")
  if (parts.length < 2) {
    return null
  }

  try {
    const base64 = normalizeBase64Url(parts[1])

    if (typeof window !== "undefined" && typeof window.atob === "function") {
      const json = window.atob(base64)
      return JSON.parse(json)
    }

    if (typeof Buffer !== "undefined") {
      return JSON.parse(Buffer.from(base64, "base64").toString("utf8"))
    }
  } catch {
    return null
  }

  return null
}

const isJwtExpired = (token, graceSeconds = 0) => {
  const payload = decodeJwtPayload(token)

  if (!payload || typeof payload.exp !== "number") {
    return true
  }

  const nowInSeconds = Math.floor(Date.now() / 1000)
  return payload.exp <= nowInSeconds + graceSeconds
}

const createStorageId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const readStorageValue = (key, fallback = null) => {
  const storage = getStorage()
  if (!storage) {
    return fallback
  }

  try {
    const value = storage.getItem(key)
    return value === null ? fallback : value
  } catch {
    return fallback
  }
}

export const writeStorageValue = (key, value) => {
  const storage = getStorage()
  if (!storage) {
    return false
  }

  try {
    storage.setItem(key, String(value))
    return true
  } catch {
    return false
  }
}

export const removeStorageValue = (key) => {
  const storage = getStorage()
  if (!storage) {
    return false
  }

  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export const writeJSONValue = (key, value) => {
  try {
    return writeStorageValue(key, JSON.stringify(value))
  } catch {
    return false
  }
}

export const readJSONValue = (key, fallback = null, legacyKeys = []) => {
  const candidates = [key, ...(legacyKeys || [])].filter(Boolean)

  for (const candidate of candidates) {
    const rawValue = readStorageValue(candidate, null)
    if (rawValue === null || rawValue === "") {
      continue
    }

    try {
      const parsedValue = JSON.parse(rawValue)

      if (candidate !== key) {
        writeJSONValue(key, parsedValue)
      }

      return parsedValue
    } catch {
      continue
    }
  }

  return fallback
}

export const readJSONListValue = (key, fallback = [], legacyKeys = []) => {
  const parsedValue = readJSONValue(key, null, legacyKeys)

  if (Array.isArray(parsedValue)) {
    return parsedValue
  }

  if (parsedValue && typeof parsedValue === "object") {
    return [parsedValue]
  }

  return fallback
}

export const upsertJSONListValue = (key, item, getItemKey = null, legacyKeys = []) => {
  const list = readJSONListValue(key, [], legacyKeys)
  const resolveKey = typeof getItemKey === "function"
    ? getItemKey
    : (value) => value?.id ?? null

  const itemKey = resolveKey(item)
  const hasKey = itemKey !== null && itemKey !== undefined && itemKey !== ""
  const nextItem = item && typeof item === "object" ? { ...item } : item

  if (!hasKey) {
    if (nextItem && typeof nextItem === "object" && nextItem.id == null) {
      nextItem.id = createStorageId()
    }

    const nextList = [...list, nextItem]
    writeJSONValue(key, nextList)
    return nextList
  }

  const normalizedKey = String(itemKey)
  const existingIndex = list.findIndex((existing) => {
    const existingKey = resolveKey(existing)
    const existingId = existing && typeof existing === "object" && existing.id != null
      ? String(existing.id)
      : null

    return (
      (existingKey !== null && existingKey !== undefined && String(existingKey) === normalizedKey) ||
      existingId === normalizedKey
    )
  })

  const mergedItem = nextItem && typeof nextItem === "object"
    ? { ...nextItem, id: nextItem.id != null && nextItem.id !== "" ? nextItem.id : normalizedKey }
    : nextItem

  const nextList = existingIndex === -1
    ? [...list, mergedItem]
    : list.map((existing, index) => {
      if (index !== existingIndex) {
        return existing
      }

      if (!existing || typeof existing !== "object") {
        return mergedItem
      }

      return {
        ...existing,
        ...mergedItem,
        id: existing.id != null && existing.id !== "" ? existing.id : mergedItem?.id ?? normalizedKey
      }
    })

  writeJSONValue(key, nextList)
  return nextList
}

export const removeFromJSONListValue = (key, predicate, legacyKeys = []) => {
  const list = readJSONListValue(key, [], legacyKeys)
  const nextList = list.filter((item) => !predicate(item))
  writeJSONValue(key, nextList)
  return nextList
}

export const getStoredAuthToken = (endpoint = "") => {
  return resolveStoredAuthToken(endpoint).token
}

export const resolveStoredAuthToken = (endpoint = "") => {
  const scope = getAuthScopeForEndpoint(endpoint)

  if (scope === "public") {
    return { token: "", source: null }
  }

  if (scope === "planning") {
    const preferPlanningToken = shouldPreferPlanningToken(endpoint)
    const candidates = preferPlanningToken
      ? [
          { key: STORAGE_KEYS.PLANNING_SESSION_TOKEN, source: "planning", token: readStorageValue(STORAGE_KEYS.PLANNING_SESSION_TOKEN, "") },
          { key: STORAGE_KEYS.APP_SESSION_TOKEN, source: "app", token: readStorageValue(STORAGE_KEYS.APP_SESSION_TOKEN, "") },
          { key: LEGACY_STORAGE_KEYS.TOKEN, source: "legacy", token: readStorageValue(LEGACY_STORAGE_KEYS.TOKEN, "") }
        ]
      : [
          { key: STORAGE_KEYS.APP_SESSION_TOKEN, source: "app", token: readStorageValue(STORAGE_KEYS.APP_SESSION_TOKEN, "") },
          { key: STORAGE_KEYS.PLANNING_SESSION_TOKEN, source: "planning", token: readStorageValue(STORAGE_KEYS.PLANNING_SESSION_TOKEN, "") },
          { key: LEGACY_STORAGE_KEYS.TOKEN, source: "legacy", token: readStorageValue(LEGACY_STORAGE_KEYS.TOKEN, "") }
        ]

    for (const candidate of candidates) {
      const { key, token, source } = candidate
      if (!token) {
        continue
      }

      if (isJwtExpired(token)) {
        removeStorageValue(key)
        if (key === STORAGE_KEYS.PLANNING_SESSION_TOKEN) {
          removeStorageValue(STORAGE_KEYS.PLANNING_USER)
        }
        continue
      }

      return { token, source }
    }

    return { token: "", source: null }
  }

  const candidates = [
    { key: STORAGE_KEYS.APP_SESSION_TOKEN, source: "app", token: readStorageValue(STORAGE_KEYS.APP_SESSION_TOKEN, "") },
    { key: LEGACY_STORAGE_KEYS.TOKEN, source: "legacy", token: readStorageValue(LEGACY_STORAGE_KEYS.TOKEN, "") }
  ]

  for (const candidate of candidates) {
    const { key, token, source } = candidate
    if (!token) {
      continue
    }

    if (isJwtExpired(token)) {
      removeStorageValue(key)
      continue
    }

    return { token, source }
  }

  return { token: "", source: null }
}

export { LEGACY_STORAGE_KEYS }
