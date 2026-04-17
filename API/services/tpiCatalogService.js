const TpiModelsYear = require('../models/tpiModels')

async function deleteTpiCatalogByYear(year, modelFactory = TpiModelsYear) {
  const normalizedYear = Number.parseInt(year, 10)

  if (!Number.isInteger(normalizedYear)) {
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
