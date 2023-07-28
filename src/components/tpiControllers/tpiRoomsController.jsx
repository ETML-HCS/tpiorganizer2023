import axios from 'axios';

const apiUrl = 'http://localhost:5000';
const saveTpiRoomUrl = `${apiUrl}/save-tpi-rooms`;
const getTpiRoomsUrl = `${apiUrl}/get-tpi-rooms`;


export const createTpiRooms = async (roomData) => {
  try {
    // Récupérer les salles de TPI existantes depuis la base de données
    const existingRooms = await getTpiRooms();

    // Vérifier si une salle avec le même idRoom existe déjà
    const existingRoom = existingRooms.find((room) => room.idRoom === roomData.idRoom);

    if (existingRoom) {
      console.log("idRoom: ", existingRoom.idRoom);
      // Si la salle existe déjà, la mettre à jour
      return await updateTpiRoom(existingRoom._id, roomData);
    } else {
      // Si la salle n'existe pas, en créer une nouvelle
      const response = await axios.post(saveTpiRoomUrl, roomData);
      return response.data;
    }
  } catch (error) {
    console.error(`Erreur lors de la création ou de la mise à jour de la salle de TPI: ${error.message}`);
    throw error;
  }
};

export const getTpiRooms = async () => {
  try {
    const response = await axios.get(getTpiRoomsUrl);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la récupération des salles de TPI: ${error.message}`);
    throw error;
  }
};

export const updateTpiRoom = async (roomId, roomData) => {
  try {
    const response = await axios.put(`${apiUrl}/update-tpi-room/${roomId}`, roomData);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la mise à jour de la salle de TPI: ${error.message}`);
    throw error;
  }
};

export const deleteTpiRoom = async (roomId) => {
  try {
    const response = await axios.delete(`${apiUrl}/delete-tpi-room/${roomId}`);
    return response.data;
  } catch (error) {
    console.error(`Erreur lors de la suppression de la salle de TPI: ${error.message}`);
    throw error;
  }
};
