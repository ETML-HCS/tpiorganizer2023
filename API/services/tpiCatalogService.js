const TpiModelsYear = require('../models/tpiModels')
const { normalizeYear } = require('../modules/gestionTpi/normalization')

async function deleteTpiCatalogByYear(year, modelFactory = TpiModelsYear) {
  const normalizedYear = normalizeYear(year)

  if (!normalizedYear) {
    throw new Error('Année invalide.')
  }

  const TpiModel = modelFactory(normalizedYear)
  const result = await TpiModel.deleteMany({})

  return {
    year: normalizedYear,
    deletedCount: Number(result?.deletedCount || 0)
  }
}

module.exports = {
  deleteTpiCatalogByYear
}
