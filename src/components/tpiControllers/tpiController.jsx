import axios from "axios";

// Pour accéder à la variable d'environnement REACT_APP_DEBUG
const debugMode = process.env.REACT_APP_DEBUG === 'true'; // Convertir en booléen si nécessaire
// Pour accéder à la variable d'environnement REACT_APP_API_URL
const apiUrl = process.env.REACT_APP_API_URL;

export const createTpiModel = async (modelData) => {
  try {
    const response = await axios.post(`${apiUrl}/save-tpi`, modelData);
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la création du modèle de TPI:", error);
    throw new Error(
      "Une erreur est survenue lors de la création du modèle de TPI. Veuillez réessayer plus tard."
    );
  }
};

export const getTpiModels = async () => {
  try {
    const response = await axios.get(`${apiUrl}/get-tpi`);
    return response.data;
    
  } catch (error) {
    console.error("Erreur lors de la récupération des modèles de TPI:", error);
    throw new Error("Une erreur est survenue lors de la récupération des modèles de TPI. Veuillez réessayer plus tard.");
  }
};

export const updateTpiModel = async (modelId, updateData) => {
  try {
    const response = await axios.put(
      `${apiUrl}/update-tpi/${modelId}`,
      updateData
    );
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la mise à jour du modèle de TPI:", error);
    throw new Error(
      "Une erreur est survenue lors de la mise à jour du modèle de TPI. Veuillez réessayer plus tard."
    );
  }
};

export const deleteTpiModel = async (modelId) => {
  try {
    const response = await axios.delete(`${apiUrl}/delete-tpi/${modelId}`);
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la suppression du modèle de TPI:", error);
    throw new Error(
      "Une erreur est survenue lors de la suppression du modèle de TPI. Veuillez réessayer plus tard."
    );
  }
};
