import { createTpiModel, getTpiModels } from "../tpiControllers/TpiController";
import { showNotification } from "../Utils";

// Fonction pour sauvegarder un TPI dans la base de données via le serveur
export const saveTpiToServer = async (tpiDetails) => {
  console.log("Save TPI to server: ", tpiDetails);

  // Vérifier si les champs obligatoires sont remplis
  if (!tpiDetails.refTpi || !tpiDetails.candidat || !tpiDetails.boss) {
    // Afficher un message d'erreur indiquant que certains champs sont obligatoires
    showNotification("Veuillez remplir tous les champs obligatoires.",3000);
    // Sortir de la fonction sans sauvegarder les données s'il manque des champs obligatoires
    return;
  }
  try {
    // Appeler la fonction du client pour créer ou mettre à jour le modèle de TPI dans la base de données via le serveur
    const savedModel = await createTpiModel(tpiDetails);

    // Afficher le message en conséquence
    const message = savedModel
      ? "TPI sauvegardé avec succès - ref " + savedModel.refTpi
      : "Erreur lors de la sauvegarde du TPI";

      showNotification(message,3000);
      
  } catch (error) {
    console.error("Erreur lors de la sauvegarde du TPI:", error);
    // Afficher un message d'erreur en cas d'échec de la sauvegarde
    const errorMessage = document.createElement("div");
    errorMessage.innerText =
      "Erreur lors de la sauvegarde du TPI. Veuillez réessayer plus tard.";
    errorMessage.className = "errorMessage show";
    document.body.appendChild(errorMessage);

    // Supprimer le message d'erreur après quelques secondes (par exemple, 3 secondes)
    setTimeout(() => {
      errorMessage.classList.remove("show");
      document.body.removeChild(errorMessage);
    }, 3000);
  }
};

// Ancienne fonction pour sauvegarder un TPI dans localStorage (version locale)
export const saveTpi = (tpiDetails) => {
  console.log("Save TPI: ", tpiDetails);

  // Vérifier si les champs obligatoires sont remplis
  if (!tpiDetails.refTpi || !tpiDetails.candidat || !tpiDetails.boss) {

    // Afficher un message d'erreur indiquant que certains champs sont obligatoires
    showNotification("Veuillez remplir tous les champs obligatoires.", 3000);
    // Sortir de la fonction sans sauvegarder les données s'il manque des champs obligatoires
    return;
  }

  // Récupérer la liste des TPIs existants depuis le localStorage
  const tpiList = JSON.parse(localStorage.getItem("tpiList")) || [];

  // Vérifier si le TPI existe déjà en fonction de son refTpi
  const existingTpiIndex = tpiList.findIndex(
    (tpi) => tpi.refTpi === tpiDetails.refTpi
  );

  let isUpdate = false; // Variable pour indiquer si c'est une mise à jour

  if (existingTpiIndex !== -1) {
    // Si le TPI existe déjà (mise à jour), remplacez les données du TPI existant
    tpiList[existingTpiIndex] = tpiDetails;
    isUpdate = true; // Marquer comme mise à jour
  } else {
    // Si le TPI n'existe pas (nouvelle sauvegarde), ajoutez-le à la liste
    tpiList.push(tpiDetails);
  }

  // Enregistrez la liste mise à jour des TPIs dans le localStorage
  localStorage.setItem("tpiList", JSON.stringify(tpiList));

  // Afficher le message en conséquence
  const message = isUpdate
    ? "Mise à jour du TPI ref " + tpiDetails.refTpi
    : "Sauvegarde du TPI ref " + tpiDetails.refTpi;

  showNotification(message, 3000);
};

// Fonction pour récupérer la liste des TPI depuis localStorage
export const getTpiList = () => {
  return JSON.parse(localStorage.getItem("tpiList")) || [];
};

// Fonction pour récupérer la liste des TPI depuis le serveur
export const getTpiFromServer = async () => {
  try {
    // Appeler la fonction du client pour récupérer les modèles de TPI depuis le serveur
    const tpiModels = await getTpiModels();

    // Afficher le message en cas de succès
    console.log("TPI récupérés depuis le serveur:", tpiModels);

    return tpiModels;
  } catch (error) {
    console.error(
      "Erreur lors de la récupération des TPI depuis le serveur:",
      error
    );

    showNotification(
      "Erreur lors de la récupération des TPI depuis le serveur. Veuillez réessayer plus tard.",
      3000
    );
  }
};
