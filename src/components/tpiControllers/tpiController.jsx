import axios from 'axios'

// Pour accéder à la variable d'environnement REACT_APP_DEBUG
const debugMode = process.env.REACT_APP_DEBUG === 'true'

// Pour accéder à la variable d'environnement REACT_APP_API_URL
const apiUrl = debugMode
  ? process.env.REACT_APP_API_URL_TRUE
  : process.env.REACT_APP_API_URL_FALSE

export const createTpiModel = async modelData => {
  try {
    console.log(`${apiUrl}/save-tpi`, modelData)
    const response = await axios.post(`${apiUrl}/api/save-tpi`, modelData)
    return response.data
  } catch (error) {
    console.error('Erreur lors de la création du modèle de TPI:', error)
    throw new Error(
      'Une erreur est survenue lors de la création du modèle de TPI. Veuillez réessayer plus tard.'
    )
  }
}

export const getTpiModels = async (year) => { // Ajoute le paramètre 'year'
  try {
    console.log( `${apiUrl}/api/get-tpi?year=${year}`); // Affiche l'URL avec l'année
    const response = await axios.get(`${apiUrl}/api/get-tpi?year=${year}`); // Ajoute 'year' à l'URL
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des modèles de TPI:', error);
    throw new Error(
      'Une erreur est survenue lors de la récupération des modèles de TPI. Veuillez réessayer plus tard.'
    );
  }
};

export const updateTpiModel = async (modelId, updateData) => {
  try {
    const response = await axios.put(
      `${apiUrl}/update-tpi/${modelId}`,
      updateData
    )
    return response.data
  } catch (error) {
    console.error('Erreur lors de la mise à jour du modèle de TPI:', error)
    throw new Error(
      'Une erreur est survenue lors de la mise à jour du modèle de TPI. Veuillez réessayer plus tard.'
    )
  }
}

export const deleteTpiModel = async modelId => {
  try {
    const response = await axios.delete(`${apiUrl}/delete-tpi/${modelId}`)
    return response.data
  } catch (error) {
    console.error('Erreur lors de la suppression du modèle de TPI:', error)
    throw new Error(
      'Une erreur est survenue lors de la suppression du modèle de TPI. Veuillez réessayer plus tard.'
    )
  }
}
