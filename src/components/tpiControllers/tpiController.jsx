import axios from "axios";

// Remplacez l'URL par celle de votre serveur (si déplacé chez un opérateur)
const apiUrl = "http://localhost:5000";

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
    throw new Error(
      "Une erreur est survenue lors de la récupération des modèles de TPI. Veuillez réessayer plus tard."
    );
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
