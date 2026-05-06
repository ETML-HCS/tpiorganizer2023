import { STORAGE_KEYS, YEARS_CONFIG } from "../config/appConfig"
import { readStorageValue, writeStorageValue } from "./storage"

export const normalizeCoordinationYear = (value) => {
  const parsedYear = Number.parseInt(String(value ?? ""), 10)

  return YEARS_CONFIG.isSupportedYear(parsedYear) ? parsedYear : null
}

export const getFallbackCoordinationYear = () => {
  const currentYear = YEARS_CONFIG.getCurrentYear()

  if (YEARS_CONFIG.isSupportedYear(currentYear)) {
    return currentYear
  }

  const availableYears = YEARS_CONFIG.getAvailableYears()

  return availableYears.length > 0
    ? availableYears[availableYears.length - 1]
    : currentYear
}

export const getStoredCoordinationYear = () => {
  return normalizeCoordinationYear(
    readStorageValue(STORAGE_KEYS.COORDINATION_SELECTED_YEAR, "")
  ) || getFallbackCoordinationYear()
}

export const getCoordinationYearFromSearch = (search = "") => {
  const params = new URLSearchParams(search || "")

  return normalizeCoordinationYear(params.get("year"))
}

export const getPreferredCoordinationYear = (search = "") => {
  return getCoordinationYearFromSearch(search) || getStoredCoordinationYear()
}

export const persistCoordinationYear = (value) => {
  const normalizedYear = normalizeCoordinationYear(value)

  if (!normalizedYear) {
    return null
  }

  writeStorageValue(STORAGE_KEYS.COORDINATION_SELECTED_YEAR, String(normalizedYear))

  return normalizedYear
}

export const appendCoordinationYearQuery = (target, year) => {
  const normalizedYear = normalizeCoordinationYear(year)

  if (!normalizedYear || typeof target !== "string" || !target || target === "/") {
    return target
  }

  const [pathAndSearch, hash = ""] = target.split("#")
  const [pathname, search = ""] = pathAndSearch.split("?")
  const params = new URLSearchParams(search)
  params.set("year", String(normalizedYear))

  const query = params.toString()

  return `${pathname}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`
}

export const normalizePlanningYear = normalizeCoordinationYear
export const getFallbackPlanningYear = getFallbackCoordinationYear
export const getStoredPlanningYear = getStoredCoordinationYear
export const getPlanningYearFromSearch = getCoordinationYearFromSearch
export const getPreferredPlanningYear = getPreferredCoordinationYear
export const persistPlanningYear = persistCoordinationYear
export const appendPlanningYearQuery = appendCoordinationYearQuery
