// Fonction pour sauvegarder un TPI dans localStorage
export const saveTpi = (tpiDetails) => {
  console.log("Save TPI: ", tpiDetails);
  // Vérifier si les champs obligatoires sont remplis
  if (!tpiDetails.refTpi || !tpiDetails.candidat || !tpiDetails.boss) {
    // Afficher un message d'erreur indiquant que certains champs sont obligatoires
    const errorMessage = document.createElement("div");
    errorMessage.innerText = "Veuillez remplir tous les champs obligatoires.";
    errorMessage.className = "errorMessage show";
    document.body.appendChild(errorMessage);

    // Supprimer le message d'erreur après quelques secondes (par exemple, 3 secondes)
    setTimeout(() => {
      errorMessage.classList.remove("show");
      document.body.removeChild(errorMessage);
    }, 3000);

    // Sortir de la fonction sans sauvegarder les données s'il manque des champs obligatoires
    return;
  }

  // Récupérer la liste des TPIs existants depuis le localStorage
  const tpiList = JSON.parse(localStorage.getItem("tpiList")) || [];

  // Vérifier si le TPI existe déjà en fonction de son refTpi
  const existingTpiIndex = tpiList.findIndex((tpi) => tpi.refTpi === tpiDetails.refTpi);

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
  const message = isUpdate ? "Mise à jour du TPI ref " + tpiDetails.refTpi : "Sauvegarde du TPI ref " + tpiDetails.refTpi;

  const saveMessage = document.createElement("div");
  saveMessage.innerText = message;
  saveMessage.className = "saveMessage show";
  document.body.appendChild(saveMessage);

  // Supprimer le message après quelques secondes (par exemple, 3 secondes)
  setTimeout(() => {
    saveMessage.classList.remove("show");
    document.body.removeChild(saveMessage);
  }, 3000);
};


// Fonction pour récupérer la liste des TPI depuis localStorage
export const getTpiList = () => {
  return JSON.parse(localStorage.getItem("tpiList")) || [];
};
