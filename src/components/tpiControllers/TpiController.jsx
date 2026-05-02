import apiService from '../../services/apiService'

export const createTpiModel = async (modelData, year, options = {}) => {
  try {
    return await apiService.post(`/api/save-tpi/${year}`, {
      ...modelData,
      validationMode: options.validationMode || 'manual'
    })
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
    return await apiService.get(`/api/get-tpi?year=${year}`)
  } catch (error) {
    console.error('Erreur lors de la recuperation des modeles de TPI:', error)
    throw new Error(
      "Une erreur est survenue lors de la recuperation des modeles de TPI. Veuillez reessayer plus tard."
    )
  }
}

export const updateTpiModel = async (modelId, year, updateData) => {
  try {
    return await apiService.put(`/api/update-tpi/${year}/${modelId}`, updateData)
  } catch (error) {
    console.error('Erreur lors de la mise a jour du TPI:', error)
    throw new Error('Erreur lors de la mise a jour du TPI.')
  }
}

export const deleteTpiModelsByYear = async (year) => {
  try {
    return await apiService.post(`/api/delete-tpi-year/${year}`, { confirm: true })
  } catch (error) {
    console.error('Erreur lors de la suppression des TPI de l année:', error)
    throw new Error('Erreur lors de la suppression des TPI de l année.')
  }
}
