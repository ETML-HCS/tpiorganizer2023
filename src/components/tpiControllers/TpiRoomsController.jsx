import apiService, { soutenancesService } from '../../services/apiService'

export const transmitToDatabase = async data => {
  const currentYear = data.date.substring(0, 4)

  try {
    const response = await apiService.post(`/api/save-tpi-rooms/${currentYear}`, data)
    return Boolean(response)
  } catch (error) {
    console.error(
      'Erreur lors de la transmission des données à la base de données :',
      error
    )
    return false
  }
}

export const replacePlanningRoomsInDatabase = async (year, rooms = []) => {
  try {
    return await apiService.post(`/api/save-tpi-rooms/${year}/replace`, {
      rooms: Array.isArray(rooms) ? rooms : []
    })
  } catch (error) {
    console.error(
      `Erreur lors du remplacement vérifié de la planification ${year} en base de données :`,
      error
    )
    throw error
  }
}

export const createTpiCollectionForYear = async (year, roomData) => {
  try {
    const response = await soutenancesService.publishRoom(year, roomData)
    if (response) {
      return response
    } else {
      console.error(
        `Erreur lors de la création de la collection TPI pour l'année ${year}`
      )
      return null
    }
  } catch (error) {
    console.error(
      `Erreur réseau lors de la création de la collection TPI pour l'année ${year}: ${error.message}`
    )
    throw error
  }
}

export const publishSoutenancesFromPlanification = async year => {
  try {
    return await soutenancesService.publishFromPlanification(year)
  } catch (error) {
    console.error(
      `Erreur réseau lors de la publication des défenses depuis la planification pour l'année ${year}: ${error.message}`
    )
    throw error
  }
}

export const publishSoutenancesFromPlanning = publishSoutenancesFromPlanification
