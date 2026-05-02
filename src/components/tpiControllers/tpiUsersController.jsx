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
}
