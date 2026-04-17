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

function filterPlanifiableTpis(tpis = []) {
  return Array.isArray(tpis)
    ? tpis.filter((tpi) => !isExternalPlanningSite(tpi?.site))
    : []
}

module.exports = {
  buildPlanifiableTpiQuery,
  filterPlanifiableTpis,
  isExternalPlanningSite,
  normalizeSiteValue
}
