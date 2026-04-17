import {
  normalizePlanningCatalogSites,
  resolvePlanningCatalogClass
} from './planningCatalogUtils'

const compactText = (value) => {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

const normalizeClassValue = (value) =>
  compactText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase()

const matchesPlanningValue = (value, candidate) => {
  const normalizedValue = normalizeClassValue(value)
  const normalizedCandidate = normalizeClassValue(candidate)

  if (!normalizedValue || !normalizedCandidate) {
    return false
  }

  if (normalizedValue === normalizedCandidate) {
    return true
  }

  if (
    normalizedValue.startsWith(normalizedCandidate) ||
    normalizedCandidate.startsWith(normalizedValue)
  ) {
    return true
  }

  if (normalizedValue.length >= 3 && normalizedCandidate.includes(normalizedValue)) {
    return true
  }

  if (normalizedCandidate.length >= 3 && normalizedValue.includes(normalizedCandidate)) {
    return true
  }

  return false
}

const DEFAULT_CLASS_TYPES = [
  { code: "CFC", prefix: "C", label: "CFC", startDate: "", endDate: "" },
  { code: "FPA", prefix: "F", label: "FPA", startDate: "", endDate: "" },
  { code: "MATU", prefix: "M", label: "MATU", startDate: "", endDate: "" }
]

const EMPTY_CLASS_DETAILS = {
  code: "",
  prefix: "",
  label: "",
  startDate: "",
  endDate: "",
  active: false,
  aliases: [],
  siteCode: "",
  siteLabel: "",
  siteId: "",
  classCode: "",
  classLabel: "",
  classDescription: "",
  classGroupId: "",
  classGroupLabel: "",
  classGroupBaseType: "",
  source: ""
}

const normalizePlanningClassType = (entry, index = 0) => {
  const source = entry && typeof entry === "object" ? entry : {}
  const code = normalizeClassValue(source.code || source.label || source.name)
  const prefix = normalizeClassValue(source.prefix || code.slice(0, 1))
  const label = compactText(source.label || source.name || code || `Type ${index + 1}`)

  return {
    code,
    prefix,
    label: label || code,
    startDate: compactText(source.startDate || source.start || ""),
    endDate: compactText(source.endDate || source.end || ""),
    active: source.active !== false,
    aliases: Array.isArray(source.aliases)
      ? source.aliases.map((alias) => normalizeClassValue(alias)).filter(Boolean)
      : []
  }
}

export const normalizePlanningClassTypes = (classTypes = []) => {
  const source = Array.isArray(classTypes) ? classTypes : []
  const normalized = []
  const seen = new Set()

  source.forEach((entry, index) => {
    const normalizedEntry = normalizePlanningClassType(entry, index)
    const dedupeKey = normalizedEntry.code || normalizedEntry.prefix || normalizedEntry.label

    if (!dedupeKey || seen.has(dedupeKey)) {
      return
    }

    seen.add(dedupeKey)
    normalized.push(normalizedEntry)
  })

  return normalized
}

const buildFallbackClassTypes = () => normalizePlanningClassTypes(DEFAULT_CLASS_TYPES)

const findPlanningClassType = (value, classTypes = []) => {
  const normalizedValue = normalizeClassValue(value)

  if (!normalizedValue) {
    return null
  }

  const resolvedClassTypes = normalizePlanningClassTypes(classTypes)
  const candidates = resolvedClassTypes.length > 0 ? resolvedClassTypes : buildFallbackClassTypes()

  return candidates.find((classType) => {
    const tokens = [
      classType.code,
      classType.prefix,
      classType.label,
      ...(Array.isArray(classType.aliases) ? classType.aliases : [])
    ]
      .map((token) => normalizeClassValue(token))
      .filter(Boolean)

    return tokens.some((token) => matchesPlanningValue(normalizedValue, token))
  }) || null
}

const buildResolvedClassDetails = (baseType, overrides = {}) => {
  const resolvedBaseType = baseType && typeof baseType === "object" ? baseType : {}
  const overrideSource = overrides && typeof overrides === "object" ? overrides : {}
  const baseTypeCode = compactText(overrideSource.code || resolvedBaseType.code || "")

  return {
    ...resolvedBaseType,
    code: baseTypeCode,
    prefix: compactText(overrideSource.prefix || resolvedBaseType.prefix || baseTypeCode.slice(0, 1)),
    label: compactText(overrideSource.label || resolvedBaseType.label || baseTypeCode),
    startDate: compactText(overrideSource.startDate || resolvedBaseType.startDate || ""),
    endDate: compactText(overrideSource.endDate || resolvedBaseType.endDate || ""),
    active: overrideSource.active !== undefined ? overrideSource.active : resolvedBaseType.active !== false,
    aliases: Array.isArray(overrideSource.aliases)
      ? overrideSource.aliases
      : Array.isArray(resolvedBaseType.aliases)
        ? resolvedBaseType.aliases
        : [],
    siteCode: compactText(overrideSource.siteCode || ""),
    siteLabel: compactText(overrideSource.siteLabel || ""),
    siteId: compactText(overrideSource.siteId || ""),
    classCode: compactText(overrideSource.classCode || ""),
    classLabel: compactText(overrideSource.classLabel || ""),
    classDescription: compactText(overrideSource.classDescription || ""),
    classGroupId: compactText(overrideSource.classGroupId || ""),
    classGroupLabel: compactText(overrideSource.classGroupLabel || ""),
    classGroupBaseType: compactText(overrideSource.classGroupBaseType || ""),
    source: compactText(overrideSource.source || resolvedBaseType.source || "")
  }
}

export const resolvePlanningClassType = (
  value,
  classTypes = [],
  planningCatalogSites = [],
  siteValue = ""
) => {
  const normalizedValue = normalizeClassValue(value)

  if (!normalizedValue) {
    return null
  }

  const normalizedClassTypes = normalizePlanningClassTypes(classTypes)
  const catalogSites = normalizePlanningCatalogSites(planningCatalogSites)
  const catalogMatch = resolvePlanningCatalogClass(value, catalogSites, siteValue)
  const matchedBaseType = findPlanningClassType(normalizedValue, normalizedClassTypes)
  const fallbackBaseType = matchedBaseType || findPlanningClassType(normalizedValue, buildFallbackClassTypes())

  if (catalogMatch) {
    const catalogBaseTypeCode = normalizeClassValue(
      catalogMatch.group?.baseType ||
      catalogMatch.group?.label ||
      catalogMatch.classEntry?.baseType ||
      fallbackBaseType?.code ||
      normalizedValue
    )
    const catalogBaseType =
      findPlanningClassType(catalogBaseTypeCode, normalizedClassTypes) ||
      fallbackBaseType ||
      findPlanningClassType(catalogBaseTypeCode, buildFallbackClassTypes()) ||
      {
        code: catalogBaseTypeCode,
        prefix: catalogBaseTypeCode.slice(0, 1),
        label: catalogBaseTypeCode,
        startDate: "",
        endDate: "",
        active: true,
        aliases: []
      }

    return buildResolvedClassDetails(catalogBaseType, {
      code: catalogBaseType.code || catalogBaseTypeCode,
      prefix: catalogBaseType.prefix || (catalogBaseType.code || catalogBaseTypeCode).slice(0, 1),
      label: catalogBaseType.label || catalogBaseTypeCode,
      siteCode: catalogMatch.site?.code || "",
      siteLabel: catalogMatch.site?.label || "",
      siteId: catalogMatch.site?.id || "",
      classCode: catalogMatch.classEntry?.code || catalogMatch.group?.baseType || compactText(value),
      classLabel: catalogMatch.classEntry?.label || catalogMatch.classEntry?.code || compactText(value) || catalogMatch.group?.baseType || "",
      classDescription: catalogMatch.classEntry?.description || "",
      classGroupId: catalogMatch.group?.id || "",
      classGroupLabel: catalogMatch.group?.label || catalogMatch.group?.baseType || "",
      classGroupBaseType: catalogMatch.group?.baseType || "",
      source: 'catalog'
    })
  }

  if (fallbackBaseType) {
    return buildResolvedClassDetails(fallbackBaseType, {
      classCode: normalizeClassValue(value) || compactText(value),
      classLabel: normalizeClassValue(value) || compactText(value),
      source: normalizedClassTypes.length > 0 ? 'annual' : 'fallback'
    })
  }

  return null
}

export const getPlanningClassModeLabel = (
  value,
  classTypes = [],
  planningCatalogSites = [],
  siteValue = ""
) => {
  const resolved = resolvePlanningClassType(value, classTypes, planningCatalogSites, siteValue)
  return resolved?.code || ""
}

export const getPlanningClassModeDetails = (
  value,
  classTypes = [],
  planningCatalogSites = [],
  siteValue = ""
) => {
  const resolved = resolvePlanningClassType(value, classTypes, planningCatalogSites, siteValue)
  if (!resolved) {
    return {
      ...EMPTY_CLASS_DETAILS
    }
  }

  return resolved
}

export const getPlanningClassPeriod = (
  value,
  classTypes = [],
  planningCatalogSites = [],
  siteValue = ""
) => {
  const resolved = getPlanningClassModeDetails(value, classTypes, planningCatalogSites, siteValue)

  return {
    startDate: resolved.startDate || "",
    endDate: resolved.endDate || ""
  }
}

export const getPlanningClassDisplayInfo = (
  value,
  classTypes = [],
  planningCatalogSites = [],
  siteValue = ""
) => {
  const resolved = getPlanningClassModeDetails(value, classTypes, planningCatalogSites, siteValue)
  const classCode = compactText(resolved.classCode)
  const typeCode = compactText(resolved.code)
  const hasSpecificClass =
    Boolean(classCode && typeCode && normalizeClassValue(classCode) !== normalizeClassValue(typeCode))

  return {
    ...resolved,
    hasSpecificClass,
    displayClassLabel: hasSpecificClass
      ? classCode
      : typeCode || classCode,
    displayTypeLabel: typeCode,
    displayLabel: hasSpecificClass
      ? [classCode, typeCode].filter(Boolean).join(' · ')
      : typeCode || classCode
  }
}

export const isPlanningMatuClass = (
  value,
  classTypes = [],
  planningCatalogSites = [],
  siteValue = ""
) =>
  getPlanningClassModeLabel(value, classTypes, planningCatalogSites, siteValue) === "MATU"
