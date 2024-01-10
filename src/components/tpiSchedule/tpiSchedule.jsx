import React, { Fragment, useState, useEffect } from "react";
import TpiScheduleButtons from "./TpiScheduleButtons";
import { showNotification } from "../Utils";
import { createTpiCollectionForYear } from "../tpiControllers/TpiRoomsController";
import DateRoom from "./DateRoom";

const TpiSchedule = ({ toggleArrow, isArrowUp }) => {
  const [newRooms, setNewRooms] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isDbDataLoaded, setIsDbDataLoaded] = useState(false); // Créer un état pour garder une trace du chargement des données depuis la base de données

  function getSecondsSinceEpoch() {
    // Convertir la chaîne de caractères en objet Date
    const date = new Date("2023-07-27");

    // Vérifier si la date est valide
    if (isNaN(date.getTime())) {
      throw new Error("La date fournie est invalide.");
    }
    const millisecondsSinceEpoch = Date.now() - date.getTime();
    const secondsSinceEpoch = Math.floor(millisecondsSinceEpoch / 1000);
    return secondsSinceEpoch;
  }

  const configO2023 = require("../../config/configO2023.json");
  if (!configO2023) {
    console.error("Erreur lors du chargement du fichier de configuration.");
  }

  const fetchData = async () => {

    // Récupérer les données sauvegardées dans localStorage
    const savedData = localStorage.getItem("organizerData");

    // Vérifier si des données sont sauvegardées
    if (savedData) {
      // Charger les données dans l'état du composant
      const savedRooms = JSON.parse(savedData);
      setNewRooms(savedRooms);
      console.log("Données chargées depuis le stockage local:", savedRooms);
    } else {
      console.log("Aucune donnée sauvegardée trouvée dans le stockage local.");
      // Vous pouvez initialiser un état vide ici si nécessaire
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePublish = async () => {
    const currentYear = new Date().getFullYear();
    const soutenancePageUrl = `/soutenance/${currentYear}`;
  
    try {
      for (const room of newRooms) {
        try {
          console.log("Données de la salle de TPI : ", room);
          await createTpiCollectionForYear(currentYear, room);
        } catch (error) {
          console.error("Erreur lors de la création de la salle de TPI : ", error);
       
          return;
        }
      }  
      // Navigation vers la page de soutenance
      window.location.href = soutenancePageUrl;
  
      // Afficher un message de succès
      console.log(`Les soutenances ont été publiées. Voir: ${soutenancePageUrl}`);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des soutenances :", error);
      // Afficher une notification d'erreur à l'utilisateur
    }
  };
  

  const handleNewRoom = (roomInfo) => {
    // Récupérer la configuration du site à partir de la configuration générale
    const configSite = configO2023[roomInfo.site.toLowerCase()];

    // Vérifier si le site existe dans la configuration
    if (!configSite) {
      console.error(
        `Site "${roomInfo.site}" non trouvé dans la configuration.`
      );
      return;
    }
    // Créer une nouvelle salle avec les informations fournies et un tableau de TPIs vides
    const newRoom = {
      idRoom: getSecondsSinceEpoch(),
      // Ajouter la date et l'heure de sauvegarde au moment de la création ou de la mise à jour
      lastUpdate: " ",
      site: roomInfo.site,
      date: roomInfo.date,
      name: roomInfo.nameRoom,
      // Copier les propriétés de configuration spécifiques au site
      configSite: {
        breakline: configSite.breakline,
        tpiTime: configSite.tpiTime,
        firstTpiStart: configSite.firstTpiStart,
        numSlots: configSite.numSlots,
      },
      // Créer un tableau rempli d'objets TPI vides en fonction du nombre de slots
      tpiDatas: Array.from({ length: configSite.numSlots }, () => ({
        id: "",
        candidat: " ",
        expert1: " ",
        expert2: " ",
        boss: " ",
      })),
    };

    // Mettre à jour l'état newRooms en utilisant la fonction setNewRooms pour ajouter la nouvelle salle
    setNewRooms((prevRooms) => [...prevRooms, newRoom]);

    // sauvegarde
    saveDataToLocalStorage([...newRooms, newRoom]);

    // Afficher un message dans la console pour indiquer que la salle a été ajoutée
    console.log("Salle ajoutée :", newRoom);
  };

  const handleDelete = async (index) => {
    try {
      const roomIdToDelete = newRooms[index].idRoom;

      // Supprimer l'objet spécifique du localStorage
      const existingDataJSON = localStorage.getItem("organizerData");
      const existingData = JSON.parse(existingDataJSON);

      // Filtrer pour créer un nouveau tableau sans la TpiRoom à supprimer
      const updatedData = existingData.filter(
        (item) => item.idRoom !== roomIdToDelete
      );

      // Mettre à jour le localStorage avec le nouveau tableau
      localStorage.setItem("organizerData", JSON.stringify(updatedData));

      // Mettre à jour l'état pour retirer la salle supprimée de newRooms
      setNewRooms((prevRooms) => {
        const updatedRooms = [...prevRooms];
        updatedRooms.splice(index, 1);
        return updatedRooms;
      });

    } catch (error) {
      console.error("Erreur lors de la suppression de la salle :", error);
      // Vous pouvez également afficher un message d'erreur convivial à l'utilisateur ici si nécessaire
    }
  };

  const handleUpdateTpi = async (roomIndex, tpiIndex, updatedTpi) => {
    // Mettre à jour la salle de TPI dans newRooms
    setNewRooms((prevRooms) => {
      const updatedRooms = [...prevRooms];
      updatedRooms[roomIndex].tpiDatas[tpiIndex] = updatedTpi;
      return updatedRooms;
    });

    try {
      // Mettre à jour les données dans la BD immédiatement
      const updatedRoom = {
        ...newRooms[roomIndex],
        lastUpdate: Date.now(),
      };
      await saveDataToLocalStorage(updatedRoom);
    } catch (error) {
      console.error(
        "Erreur lors de la mise à jour de la salle de TPI dans la base de données :",
        error
      );
      // Gérer l'erreur ici si nécessaire
    }
  };

  const toggleEditing = () => {
    setIsEditing((prevIsEditing) => !prevIsEditing);
  };

  // Fonction pour sauvegarder les données dans localStorage
  const saveDataToLocalStorage = (data) => {
    data.lastUpdate = Date.now();
    return new Promise((resolve) => {
      const jsonData = JSON.stringify(data);
      localStorage.setItem("organizerData", jsonData);
      resolve();
    });
  };

  // Fonction pour gérer le processus de sauvegarde des données
  const handleSave = async () => {
    console.log("App.js, newRooms: ", newRooms);

    // Étape 1: Mettre à jour la propriété lastUpdate pour chaque salle avec la nouvelle date
    const updatedRooms = newRooms.map((room) => ({
      ...room,
      // Mettre à jour avec la nouvelle date
      lastUpdate: new Date().getTime(),
    }));

    // Mettre à jour l'état newRooms avec la liste des salles mises à jour
    setNewRooms(updatedRooms);

    // Sauvegarder les données dans localStorage avec la nouvelle date
    saveDataToLocalStorage(updatedRooms);

    // Afficher le message de sauvegarde avec une durée de 3 secondes
    showNotification("Données sauvegardées avec succès !", 3000);
  };

  const handleExport = () => {
    console.log("App.js, newRooms: ", newRooms);

    if (newRooms.length === 0) {
      console.log("Aucune salle à sauvegarder.");
      return;
    }

    // Créer une copie de la liste des salles (newRooms)
    const updatedRooms = [...newRooms];

    // Créer un tableau de promesses pour les mises à jour de chaque salle et de chaque TPI dans chaque salle
    const updatePromises = updatedRooms.map((room, roomIndex) =>
      Promise.all(
        room.tpiDatas.map((tpi, tpiIndex) =>
          handleUpdateTpi(roomIndex, tpiIndex, tpi)
        )
      )
    );
    // Attendre que toutes les promesses soient résolues (mise à jour de chaque TPI)
    Promise.all(updatePromises)
      .then(() => {
        // Convertir les salles mises à jour en format JSON
        const jsonRooms = JSON.stringify(updatedRooms);

        // Créer un objet Blob à partir du JSON
        const blob = new Blob([jsonRooms], { type: "application/json" });

        // Créer une URL pour le Blob
        const url = URL.createObjectURL(blob);

        // Créer un élément d'ancre (lien) pour le téléchargement du fichier JSON
        const link = document.createElement("a");
        link.href = url;
        link.download = "backupRooms.json";
        link.click();

        // Révoquer l'URL pour libérer les ressources
        URL.revokeObjectURL(url);
      })
      .catch((error) => {
        console.error("Erreur lors de l'enregistrement des données :", error);
      });
  };

  // Fonction pour charger les données depuis le fichier JSON
  const handleLoadConfig = (jsonData) => {
    try {
      const parsedData = JSON.parse(jsonData);
      // Vérifier que les données chargées sont un tableau
      if (Array.isArray(parsedData)) {
        // Mettre à jour les salles avec les nouvelles données
        setNewRooms(parsedData);
        console.log("Données chargées avec succès !");
      } else {
        console.error("Le fichier JSON ne contient pas un tableau valide.");
      }
    } catch (error) {
      console.error("Erreur lors du traitement du fichier JSON :", error);
    }
  };

  const handleSwapTpiCards = (draggedTpiID, targetTpiID) => {
    console.log("Nombre de salles: ", newRooms.length);

    // Recherche des salles qui contiennent les TPI correspondants
    const draggedTpiRoomIndex = newRooms.findIndex((room) =>
      room.tpiDatas.some((tpi) => tpi.id === draggedTpiID)
    );

    const targetTpiRoomIndex = newRooms.findIndex((room) =>
      room.tpiDatas.some((tpi) => tpi.id === targetTpiID)
    );

    // Vérifier si les TPI et les salles correspondantes ont été trouvés
    if (draggedTpiRoomIndex === -1 || targetTpiRoomIndex === -1) {
      console.error("TPI ou salle invalide.");
      return;
    }

    // Trouver l'index du tpiDatas correspondant au draggedTpiID et au targetTpiID dans leurs salles respectives
    const draggedTpiRoom = newRooms[draggedTpiRoomIndex];
    const targetTpiRoom = newRooms[targetTpiRoomIndex];

    const draggedTpiIndex = draggedTpiRoom.tpiDatas.findIndex(
      (tpi) => tpi.id === draggedTpiID
    );
    const targetTpiIndex = targetTpiRoom.tpiDatas.findIndex(
      (tpi) => tpi.id === targetTpiID
    );

    // Vérifier si les tpi correspondants ont été trouvés
    if (draggedTpiIndex === -1 || targetTpiIndex === -1) {
      console.error("ID de tpi invalide.");
      return;
    }

    // Effectuer le swap en utilisant une variable temporaire
    const tempTpi = { ...draggedTpiRoom.tpiDatas[draggedTpiIndex] };
    draggedTpiRoom.tpiDatas[draggedTpiIndex] = {
      ...targetTpiRoom.tpiDatas[targetTpiIndex],
    };
    targetTpiRoom.tpiDatas[targetTpiIndex] = tempTpi;

    // Créer un nouvel objet newRooms avec les modifications effectuées
    const updatedNewRooms = newRooms.map((room, index) => {
      if (index === draggedTpiRoomIndex) {
        return draggedTpiRoom;
      } else if (index === targetTpiRoomIndex) {
        return targetTpiRoom;
      } else {
        return room;
      }
    });

    // Mettre à jour l'état avec le nouvel objet newRooms
    setNewRooms(updatedNewRooms);
    saveDataToLocalStorage(updatedNewRooms);
  };

  return (
    <>
      <TpiScheduleButtons
        configData={configO2023}
        onNewRoom={handleNewRoom}
        onToggleEditing={toggleEditing}
        onExport={handleExport}
        onSave={handleSave}
        onLoadConfig={handleLoadConfig}
        onPublish={handlePublish}
        toggleArrow={toggleArrow}
        isArrowUp={isArrowUp}
      />

      {newRooms === null ? (
        // Si newRooms est null, afficher un message de chargement ou un composant vide
        <div>Chargement en cours...</div>
      ) : (
        // Sinon, effectuer le rendu des salles normalement
        newRooms.map((room, index) => (
          <DateRoom
            key={index}
            roomIndex={index}
            roomData={room}
            isEditOfRoom={isEditing}
            onUpdateTpi={(tpiIndex, updatedTpi) =>
              handleUpdateTpi(index, tpiIndex, updatedTpi)
            }
            onSwapTpiCards={(draggedTpi, targetTpi) =>
              handleSwapTpiCards(draggedTpi, targetTpi)
            }
            // attention il faut obligatoirement passer par une fonction sion elle est toujours appelée
            onDelete={() => handleDelete(index)}
          />
        ))
      )}
    </>
  );
};
export default TpiSchedule;
