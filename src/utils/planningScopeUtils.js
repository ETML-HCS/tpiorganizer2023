const EXTERNAL_SITE_TOKEN = 'horsetml'

export const normalizePlanningSiteValue = (value) =>
  String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()

export const isExternalPlanningSite = (value) =>
  normalizePlanningSiteValue(value).includes(EXTERNAL_SITE_TOKEN)

export const buildConfiguredPlanningSiteKeys = (siteConfigs = []) => {
  const keys = new Set()

  ;(Array.isArray(siteConfigs) ? siteConfigs : []).forEach((siteConfig) => {
    if (siteConfig?.active === false) {
      return
    }

    const normalizedSiteCode = normalizePlanningSiteValue(siteConfig?.siteCode)
    if (normalizedSiteCode) {
      keys.add(normalizedSiteCode)
    }
  })

  return keys
}

export const getActivePlanningSiteLabels = (siteConfigs = []) =>
  (Array.isArray(siteConfigs) ? siteConfigs : [])
    .filter((siteConfig) => siteConfig?.active !== false)
    .map((siteConfig) => String(siteConfig?.label || siteConfig?.siteCode || siteConfig?.siteId || '').trim())
    .filter(Boolean)

export const resolvePlanningSiteValue = (tpi = {}) =>
  String(tpi?.lieu?.site || tpi?.site || '').trim()

export const getPlanningPerimeterState = (tpi = {}, siteConfigs = [], year = '') => {
  const siteValue = resolvePlanningSiteValue(tpi)
  const normalizedSite = normalizePlanningSiteValue(siteValue)
  const configuredSiteKeys = buildConfiguredPlanningSiteKeys(siteConfigs)
  const activeSiteLabels = getActivePlanningSiteLabels(siteConfigs)
  const hasConfiguredSites = configuredSiteKeys.size > 0
  const isExternalSite = isExternalPlanningSite(siteValue)
  const isConfiguredSite = Boolean(normalizedSite) && configuredSiteKeys.has(normalizedSite)
  const isPlanifiable = !isExternalSite && hasConfiguredSites && isConfiguredSite

  let reason = ''
  if (isPlanifiable) {
    reason = 'Dans le périmètre Planning.'
  } else if (isExternalSite) {
    reason = siteValue
      ? `Site ${siteValue} marqué hors planification.`
      : 'Fiche marquée hors planification.'
  } else if (!hasConfiguredSites) {
    reason = year
      ? `Aucun site actif n'est configuré pour ${year}.`
      : "Aucun site actif n'est configuré."
  } else if (!siteValue) {
    reason = 'Site non renseigné, hors Configuration Sites.'
  } else {
    reason = year
      ? `Site ${siteValue} non actif dans Configuration Sites ${year}.`
      : `Site ${siteValue} non actif dans Configuration Sites.`
  }

  return {
    siteValue,
    normalizedSite,
    hasConfiguredSites,
    activeSiteLabels,
    isExternalSite,
    isConfiguredSite,
    isPlanifiable,
    reason
  }
}
