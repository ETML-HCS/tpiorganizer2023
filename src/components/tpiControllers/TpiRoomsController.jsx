import axios from 'axios'
import { API_URL } from '../../config/appConfig'
import { soutenancesService } from '../../services/apiService'

const apiUrl = API_URL

const saveTpiRoomUrl = `${apiUrl}/api/save-tpi-rooms`

export const transmitToDatabase = async data => {
  const currentYear = data.date.substring(0, 4)
  const url = `${saveTpiRoomUrl}/${currentYear}`

  try {
    const response = await axios.post(url, data)

    if (response.status === 200) {
      return true
    } else {
      return false
    }
  } catch (error) {
    console.error(
      'Erreur lors de la transmission des données à la base de données :',
      error
    )
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

export const publishSoutenancesFromPlanning = async year => {
  try {
    return await soutenancesService.publishFromPlanning(year)
  } catch (error) {
    console.error(
      `Erreur réseau lors de la publication des défenses depuis le planning pour l'année ${year}: ${error.message}`
    )
    throw error
  }
}
