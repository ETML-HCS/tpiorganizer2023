import axios from 'axios'

// Pour accéder à la variable d'environnement REACT_APP_DEBUG
const debugMode = process.env.REACT_APP_DEBUG === 'true'

// Pour accéder à la variable d'environnement REACT_APP_API_URL
const apiUrl = debugMode
  ? process.env.REACT_APP_API_URL_TRUE
  : process.env.REACT_APP_API_URL_FALSE

const saveTpiRoomUrl = `${apiUrl}/api/save-tpi-rooms`
const getTpiRoomsUrl = `${apiUrl}/api/get-tpi-rooms`

// Fonction pour transmettre les données à la base de données
export const transmitToDatabase = async data => {
  // Obtenir l'année courante

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

export const checkRoomExistenceById = async idRoom => {
  // Validation de l'ID de la salle
  if (!idRoom) {
    throw new Error("L'ID de la salle est requis pour la vérification.")
  }

  try {
    const response = await axios.get(
      `${apiUrl}/api/check-room-existence/${idRoom}`
    )

    console.log(
      "Réponse reçue de l'API pour l'existence de la salle:",
      response.data
    )

    // Vérifier si la réponse est valide et contient les champs nécessaires
    if (response.data && 'exists' in response.data && '_id' in response.data) {
      return response.data // { exists: true/false, _id: roomId }
    } else {
      throw new Error("Réponse de l'API invalide ou incomplète.")
    }
  } catch (error) {
    console.error(
      `Erreur lors de la vérification de l'existence de la salle: ${error.message}`
    )
    throw error // Propager l'erreur pour une gestion externe
  }
}

export const createTpiRooms = async roomData => {
  try {
    const existingRoom = await checkRoomExistenceById(roomData.idRoom)
    if (existingRoom && existingRoom.exists) {
      // Si la salle existe déjà, la mettre à jour
      const updatedRoom = await updateTpiRoom(existingRoom._id, roomData)
      return updatedRoom
    } else {
      // Si la salle n'existe pas, en créer une nouvelle
      const response = await axios.post(saveTpiRoomUrl, roomData)
      return response.data
    }
  } catch (error) {
    console.error(
      `Erreur lors de la création ou de la mise à jour de la salle de TPI: ${error.message}`
    )
    throw error
  }
}

export const createTpiCollectionForYear = async (year, roomData) => {
  try {
    const response = await axios.post(
      `${apiUrl}/create-tpi-collection/${year}`,
      roomData
    )
    if (response.status === 200) {
      console.log(`Collection TPI pour l'année ${year} créée avec succès.`)
      return response.data
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

export const getTpiRooms = async () => {
  try {
    const response = await axios.get(getTpiRoomsUrl)
    return response.data
  } catch (error) {
    console.error(
      `Erreur lors de la récupération des salles de TPI: ${error.message}`
    )
    throw error
  }
}

// Fonction pour mettre à jour une salle de TPI
export const updateTpiRoom = async (roomId, roomData) => {
  // Validation de base des entrées
  if (!roomId || !roomData) {
    throw new Error(
      "L'ID de la salle et les données sont requis pour la mise à jour."
    )
  }

  try {
    // Utilisez l'URL complète pour l'endpoint de mise à jour
    console.log('updateTpiRoom: ', roomId, ' ici data: ', roomData)

    const response = await axios.put(
      `${apiUrl}/update-tpi-room/${roomId}`,
      roomData
    )

    // Vérification de la réponse de l'API
    if (!response || response.status !== 200) {
      throw new Error(
        'La réponse de la mise à jour de la salle de TPI est invalide.'
      )
    }

    // Renvoyez les données mises à jour ou un message de succès
    return (
      response.data || {
        message: 'Mise à jour réussie sans données retournées.'
      }
    )
  } catch (error) {
    // Gestion des erreurs avec plus de détails
    console.error(
      `Erreur lors de la mise à jour de la salle de TPI (ID: ${roomId}): ${error.message}`
    )
    throw new Error(`Erreur de mise à jour: ${error.message}`)
  }
}

export const deleteTpiRoom = async roomId => {
  console.log(roomId)
  try {
    const response = await axios.delete(`${apiUrl}/delete-tpi-room/${roomId}`)
    return response.data
  } catch (error) {
    console.error(
      `Erreur lors de la suppression de la salle de TPI: ${error.message}`
    )
    throw error
  }
}
