import axios from 'axios';

const apiUrl = 'http://localhost:5000';
const createUserUrl = `${apiUrl}/inscription`;
const getUsersUrl = `${apiUrl}/suivi-etudiants`;

export const createUser = async (userData) => {
  try {
    const response = await axios.post(createUserUrl, userData);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    throw new Error('Une erreur est survenue lors de la création de l\'utilisateur. Veuillez réessayer plus tard.');
  }
};

export const getUsers = async () => {
  try {
    const response = await axios.get(getUsersUrl);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    throw new Error('Une erreur est survenue lors de la récupération des utilisateurs. Veuillez réessayer plus tard.');
  }
};

export const updateUser = async (userId, userData) => {
  try {
    const response = await axios.put(`${apiUrl}/suivi-etudiants/${userId}`, userData);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
    throw new Error('Une erreur est survenue lors de la mise à jour de l\'utilisateur. Veuillez réessayer plus tard.');
  }
};

export const deleteUser = async (userId) => {
  try {
    const response = await axios.delete(`${apiUrl}/suivi-etudiants/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    throw new Error('Une erreur est survenue lors de la suppression de l\'utilisateur. Veuillez réessayer plus tard.');
  }
};
