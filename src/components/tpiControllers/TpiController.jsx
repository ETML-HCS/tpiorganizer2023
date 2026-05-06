import { gestionTpiService } from '../../services/gestionTpiService'

export const createTpiModel = async (modelData, year, options = {}) => {
  try {
    return await gestionTpiService.save(year, modelData, options)
  } catch (error) {
    console.error('Erreur lors de la creation du modele de TPI:', error)
    throw new Error(
      error?.data?.error ||
      "Une erreur est survenue lors de la creation du modele de TPI. Veuillez reessayer plus tard."
    )
  }
}

export const getTpiModels = async (year) => {
  try {
    return await gestionTpiService.listByYear(year)
  } catch (error) {
    console.error('Erreur lors de la recuperation des modeles de TPI:', error)
    throw new Error(
      "Une erreur est survenue lors de la recuperation des modeles de TPI. Veuillez reessayer plus tard."
    )
  }
}

export const updateTpiModel = async (modelId, year, updateData) => {
  try {
    return await gestionTpiService.update(year, modelId, updateData)
  } catch (error) {
    console.error('Erreur lors de la mise a jour du TPI:', error)
    throw new Error('Erreur lors de la mise a jour du TPI.')
  }
}

export const deleteTpiModelsByYear = async (year) => {
  try {
    return await gestionTpiService.deleteYear(year)
  } catch (error) {
    console.error('Erreur lors de la suppression des TPI de l année:', error)
    throw new Error('Erreur lors de la suppression des TPI de l année.')
  }
}
