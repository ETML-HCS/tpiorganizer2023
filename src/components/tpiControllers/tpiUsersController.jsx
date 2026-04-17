import apiService from '../../services/apiService'

const createUserEndpoint = '/api/inscription'
const getUsersEndpoint = '/api/suivi-etudiants'

export const createUser = async (userData) => {
  try {
    return await apiService.post(createUserEndpoint, userData)
  } catch (error) {
    console.error("Erreur lors de la création de l'utilisateur :", error)
    throw error
  }
};

export const getUsers = async () => {
  try {
    return await apiService.get(getUsersEndpoint)
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs :', error)
    throw error
  }
};

export const updateUser = async (userId, userData) => {
  try {
    if (!userId) {
      throw new Error("L'identifiant utilisateur est requis.")
    }

    return await apiService.put(`/api/suivi-etudiants/${userId}`, userData)
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'utilisateur :", error)
    throw error
  }
};

export const deleteUser = async (userId) => {
  try {
    if (!userId) {
      throw new Error("L'identifiant utilisateur est requis.")
    }

    return await apiService.delete(`/api/suivi-etudiants/${userId}`)
  } catch (error) {
    console.error("Erreur lors de la suppression de l'utilisateur :", error)
    throw error
  }
};
