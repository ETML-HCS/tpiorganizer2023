import React, { useState } from "react";
import Papa from "papaparse";
import { updateMarginTopPage } from "../Utils";
import {
  createTpiModel,
  getTpiModels,
  updateTpiModel,
} from "../tpiControllers/TpiController";

const TpiManagementButtons = ({ onNewTpi, newTpi, toggleArrow, isArrowUp }) => {
  // État pour gérer l'affichage du formulaire d'importation
  const [showImportForm, setShowImportForm] = useState(false);

  const handleNewTpi = () => {
    onNewTpi((newTpi) => !newTpi);
  };

  // Gestionnaire d'événements pour le bouton "Importer une liste de TPI"
  const handleImportTpi = () => {
    setShowImportForm(true);
    updateMarginTopPage(200);
  };

  const handleCancelImport = () => {
    setShowImportForm(false); // Masquer le formulaire en cas d'annulation
    updateMarginTopPage(60);
  };

  // Gestionnaire d'événements pour soumettre le formulaire d'importation
  const handleSubmitImportForm = async (event) => {
    event.preventDefault();

    // Récupérer les données du fichier importé
    const fileInput = event.target.elements.fileInput;
    const file = fileInput.files[0];

    // Vérifier si un fichier a été sélectionné
    if (!file) {
      alert("Veuillez sélectionner un fichier à importer.");
      return;
    }

    // Utiliser PapaParse pour parser le fichier CSV
    Papa.parse(file, {
      header: true,
      complete: async (result) => {
        // Une fois que le fichier CSV est parsé, obtenez les données
        const importedData = result.data;

        // Pour chaque entrée du fichier CSV, créer le modèle TpiData et enregistrer dans la base de données
        for (const entry of importedData) {
          let expert1 = "";
          let expert2 = "";

          // Vérifier si le champ "Expert no" est "1" ou "2"
          if (entry["Expert no"] === "1" || entry["Expert no"] === "2") {
            // Si "Expert no" est "1" ou "2", utiliser "Expert" comme expert1 ou expert2
            expert1 = entry["Expert no"] === "1" ? entry["Expert"] : "";
            expert2 = entry["Expert no"] === "2" ? entry["Expert"] : "";
          } else {
            // Sinon, utiliser les champs "Expert 1" et "Expert 2" directement
            expert1 = entry["Expert 1"];
            expert2 = entry["Expert 2"];
          }
          console.log("Les experts: ", expert1, " ", expert2);

          const parseDate = (dateStr) => {
            if (!dateStr) return null;

            // Extraire les parties de la date
            const parts = dateStr.split(".");
            const day = parts[0];
            const month = parts[1];
            const year = `20${parts[2]}`; // Ajouter le préfixe "20" pour avoir l'année à 4 chiffres

            // Créer une date au format "yyyy-mm-dd"
            const formattedDate = `${year}-${month}-${day}`;

            return new Date(formattedDate);
          };

          const tpiModelData = {
            refTpi: entry["N° de TPI"],
            candidat: entry["Candidat"],
            expert1,
            expert2,
            boss: entry["Chef de projet"],
            lieu: entry["Lieu"],
            sujet: entry["Sujet"],
            description: entry["Domaine"],
            tags: entry["Mots clés"] ? entry["Mots clés"].split(",") : [],
            dateDepart: parseDate(entry["Début"]), // Convertir la date de début
            dateFin: parseDate(entry["Fin"]), // Convertir la date de fin
            // ... autres propriétés du modèle tpiData ...
          };

          console.log("tpiModelDat", tpiModelData);
          try {
            // Recherchez un modèle TPI existant avec le même numéro de référence (refTpi)
            const existingTpiModels = await getTpiModels();
            const existingTpiModel = existingTpiModels.find(
              (model) => model.refTpi === tpiModelData.refTpi
            );

            if (existingTpiModel) {
              // Si un modèle TPI existe déjà avec le même numéro, complétez les champs vides du modèle existant
              if (!existingTpiModel.expert1) {
                existingTpiModel.expert1 = tpiModelData.expert1;
              }
              if (!existingTpiModel.expert2) {
                existingTpiModel.expert2 = tpiModelData.expert2;
              }

              if (!existingTpiModel.lieu) {
                existingTpiModel.lieu = tpiModelData.lieu;
              }

              if (!existingTpiModel.dateDepart) {
                existingTpiModel.dateDepart = tpiModelData.dateDepart;
              }

              if (!existingTpiModel.dateFin) {
                existingTpiModel.dateFin = tpiModelData.dateFin;
              }

              if (!existingTpiModel.sujet) {
                existingTpiModel.sujet = tpiModelData.sujet;
                console.log(tpiModelData.sujet);
              }

              if (!existingTpiModel.tags) {
                existingTpiModel.tags = tpiModelData.tags;
              }
              // Mettez à jour le modèle TPI existant dans la base de données en utilisant votre API
              const updatedTpiModel = await updateTpiModel(
                existingTpiModel._id, // Assurez-vous que votre modèle TPI a une propriété "_id" qui représente son identifiant unique
                existingTpiModel
              );
              console.log("Modèle TPI mis à jour :", updatedTpiModel);
            } else {
              // Si aucun modèle TPI n'existe avec le même numéro, enregistrez le modèle TPI dans la base de données en utilisant votre API
              const newTpiModel = await createTpiModel(tpiModelData);
              console.log("Nouveau modèle TPI enregistré :", newTpiModel);
            }
          } catch (error) {
            console.error("Erreur lors du traitement du modèle TPI :", error);
          }
        }
        // Réinitialiser le formulaire et masquer le formulaire d'importation
        event.target.reset();
        setShowImportForm(false);
      },
    });
  };

  return (
    <div id="tools">
      <button id="btNewTpi" onClick={handleNewTpi}>
        {newTpi ? (
          <>
            <span role="img" aria-label="Close">
              ❌
            </span>{" "}
            Fermer
          </>
        ) : (
          <>
            <span role="img" aria-label="New TPI">
              📝
            </span>{" "}
            Nouveau TPI
          </>
        )}
      </button>

      <button id="btImportTpi" onClick={handleImportTpi}>
        <span role="img" aria-label="Import TPI">
          📥
        </span>{" "}
        Importer
      </button>

      {/* Afficher le formulaire d'importation si showImportForm est vrai */}
      {showImportForm && (
        <div
          style={{
            position: "static",
            display: "flex",
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px",
            marginBottom: "10px",
            backgroundColor: "rgba(255, 255, 255, 0.8)",
          }}
        >
          <form onSubmit={handleSubmitImportForm}>
            <label htmlFor="fileInput">
              Choisir un fichier CSV :
              <input
                type="file"
                id="fileInput"
                name="fileInput"
                accept=".csv"
              />
            </label>
            <span>
              <button type="submit">Importer</button>
              <button type="button" onClick={handleCancelImport}>
                {" "}
                Annuler{" "}
              </button>
            </span>
          </form>
        </div>
      )}

      <div
        onClick={toggleArrow}
        id="upArrowButton"
        className={!isArrowUp ? "" : "active"}
        aria-label={isArrowUp ? "Arrow up" : "Arrow down"}
      >
        ▲ ▲ ▲
      </div>
    </div>
  );
};

export default TpiManagementButtons;
