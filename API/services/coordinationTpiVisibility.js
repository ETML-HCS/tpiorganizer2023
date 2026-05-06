const EXTERNAL_SITE_TOKEN = 'horsetml'

function normalizeSiteValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()
    .trim()
}

function isExternalPlanningSite(value) {
  const normalized = normalizeSiteValue(value)
  return normalized.includes(EXTERNAL_SITE_TOKEN)
}

function buildConfiguredPlanningSiteKeys(planningConfig = null) {
  const siteConfigs = Array.isArray(planningConfig?.siteConfigs)
    ? planningConfig.siteConfigs
    : null

  if (!siteConfigs) {
    return null
  }

  const siteKeys = new Set()

  for (const siteConfig of siteConfigs) {
    if (siteConfig?.active === false) {
      continue
    }

    const normalizedSiteCode = normalizeSiteValue(siteConfig?.siteCode)
    if (normalizedSiteCode) {
      siteKeys.add(normalizedSiteCode)
    }
  }

  return siteKeys
}

function isConfiguredPlanningSite(value, planningConfig = null) {
  const normalized = normalizeSiteValue(value)
  if (!normalized) {
    return false
  }

  const siteKeys = buildConfiguredPlanningSiteKeys(planningConfig)
  if (!(siteKeys instanceof Set)) {
    return true
  }

  if (siteKeys.size === 0) {
    return false
  }

  return siteKeys.has(normalized)
}

function resolveTpiSiteValue(tpi) {
  const siteCandidates = [
    tpi?.lieu?.site,
    tpi?.site
  ]

  for (const candidate of siteCandidates) {
    if (String(candidate || '').trim()) {
      return candidate
    }
  }

  return ''
}

function isPlanifiableTpi(tpi, planningConfig = null) {
  const siteValue = resolveTpiSiteValue(tpi)
  const configuredSiteKeys = buildConfiguredPlanningSiteKeys(planningConfig)

  if (isExternalPlanningSite(siteValue)) {
    return false
  }

  if (!(configuredSiteKeys instanceof Set)) {
    return true
  }

  return isConfiguredPlanningSite(siteValue, planningConfig)
}

function buildPlanifiableTpiQuery(year) {
  return {
    year,
    $and: [
      {
        $or: [
          { site: { $exists: false } },
          { site: null },
          { site: '' },
          { site: { $not: { $regex: 'hors[-\\s]*etml', $options: 'i' } } }
        ]
      }
    ]
  }
}

function filterPlanifiableTpis(tpis = [], planningConfig = null) {
  return Array.isArray(tpis)
    ? tpis.filter((tpi) => isPlanifiableTpi(tpi, planningConfig))
    : []
}

module.exports = {
  buildPlanifiableTpiQuery,
  buildConfiguredPlanningSiteKeys,
  filterPlanifiableTpis,
  isConfiguredPlanningSite,
  isPlanifiableTpi,
  isExternalPlanningSite,
  normalizeSiteValue
}
