import React, { Fragment, useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import NavButton from "./components/NavButtons";
import DateRoom from "./components/DateRoom";
import Home from "./components/Home";
import PublishedLink from "./components/PublishedLink";
import "./css/globalStyles.css";

const App = () => {
  const dateAujourdhui = new Date();
  const dateFormatted = dateAujourdhui.toLocaleDateString();

  const [newRooms, setNewRooms] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [publishedLink, setPublishedLink] = useState(null);
  const [isArrowUp, setIsArrowUp] = useState(false);

  const configO2023 = require("./config/configO2023.json");
  if (!configO2023) {
    console.error("Erreur lors du chargement du fichier de configuration.");
  }

  useEffect(() => {
    const updateRoomPaddingTop = () => {
      const rootElement = document.getElementById("root");
      const headerElement = document.getElementById("header");

      const { height } = headerElement.getBoundingClientRect();
      const paddingTop = isArrowUp ? height + 12 : 70;

      rootElement.style.setProperty("--room-padding-top", `${paddingTop}px`);
    };

    updateRoomPaddingTop(); // Appeler la fonction ici pour mettre à jour le padding lors du rendu initial

    window.addEventListener("load", updateRoomPaddingTop);
    window.addEventListener("resize", updateRoomPaddingTop);

    return () => {
      window.removeEventListener("load", updateRoomPaddingTop);
      window.removeEventListener("resize", updateRoomPaddingTop);
    };
  }, [isArrowUp]); // Ajouter isArrowUp comme dépendance ici

  // Charger les données depuis localStorage au chargement de l'application
  useEffect(() => {
    const savedData = localStorage.getItem("organizerData");
    if (savedData) {
      setNewRooms(JSON.parse(savedData));
    }
  }, []);

  
  const toggleArrow = () => {

    const upArrowButton = document.getElementById("upArrowButton");
    const downArrowButton = document.getElementById("downArrowButton");
    const elementTools = document.getElementById("tools");

    if (isArrowUp) {
      upArrowButton.style.display = "none";
      downArrowButton.style.display = "block";
      elementTools.style.display ="none";

    } else {
      elementTools.style.display ="block";
      upArrowButton.style.display = "block";
      downArrowButton.style.display = "none";
    }
    setIsArrowUp((prevIsArrowUp) => !prevIsArrowUp);
  };


  // Fonction pour générer le lien de publication
  const handlePublish = () => {
    // Générez l'URL pour le lien publié
    const publishedUrl = `/${generateRandomLinkName()}`;

    // Sauvegardez le lien dans l'état
    setPublishedLink(publishedUrl);
  };

  // Fonction pour générer un nom de lien aléatoire (pour la démo)
  const generateRandomLinkName = () => {
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let linkName = "";
    for (let i = 0; i < 8; i++) {
      linkName += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return linkName;
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

    // Ajouter la nouvelle salle à la liste des salles existantes
    setNewRooms((prevRooms) => [...prevRooms, newRoom]);

    // sauvegarde
    saveDataToLocalStorage([...newRooms, newRoom]);

    // Afficher un message dans la console pour indiquer que la salle a été ajoutée
    console.log("Salle ajoutée :", newRoom);
  };

  const handleUpdateTpi = (roomIndex, tpiIndex, updatedTpi) => {
    setNewRooms((prevRooms) => {
      const updatedRooms = [...prevRooms];
      updatedRooms[roomIndex].tpiDatas[tpiIndex] = updatedTpi;
      return updatedRooms;
    });
  };

  const toggleEditing = () => {
    setIsEditing((prevIsEditing) => !prevIsEditing);
  };

  // Fonction pour sauvegarder les données dans localStorage
  const saveDataToLocalStorage = (data) => {
    const jsonData = JSON.stringify(data);
    localStorage.setItem("organizerData", jsonData);
  };

  const handleSave = () => {
    console.log("App.js, newRooms: ", newRooms);

    if (newRooms.length === 0) {
      console.log("Aucune salle à sauvegarder.");
      return;
    }

    // Mettre à jour les données dans localStorage
    saveDataToLocalStorage(newRooms);

    console.log("Données sauvegardées dans localStorage.");

    // Afficher un message temporaire pour informer l'utilisateur que les données ont été sauvegardées
    const saveMessage = document.createElement("div");
    saveMessage.innerText = "Données sauvegardées avec succès !";
    saveMessage.className = "saveMessage";
    document.body.appendChild(saveMessage);

    // Supprimer le message après quelques secondes (par exemple, 3 secondes)
    setTimeout(() => {
      document.body.removeChild(saveMessage);
    }, 3000);
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

    console.log(updatedNewRooms);
  };

  return (
    <Router>
      <Fragment>
        {/* Votre entête */}
        {configO2023 && (
          <div id="header">
            <div id="title">
              <span id="left">
                <span className="etml">ETML</span> / CFPV{" "}
              </span>
              <span id="center">&#xF3; 2023</span>
              <span id="right" className="dateToday">
                aujourd'hui: {dateFormatted}{" "}
              </span>
            </div>
            <button onClick={toggleArrow} id="downArrowButton" className={!isArrowUp ? "active" : ""}>
              ▼ ▼ ▼
            </button>
            <NavButton
              configData={configO2023}
              onNewRoom={handleNewRoom}
              onToggleEditing={toggleEditing}
              onExport={handleExport}
              onSave={handleSave}
              onLoadConfig={handleLoadConfig}
              onPublish={handlePublish}
              setPublishedLink={setPublishedLink}
              toggleArrow={toggleArrow}
              isArrowUp={isArrowUp}
            />
            {publishedLink && (
              <div style={{ marginTop: "20px" }}>
                <p>Votre planification a été publiée avec succès !</p>
                <p>Accédez-y en utilisant le lien ci-dessous :</p>
                <div
                  style={{
                    backgroundColor: "#f0f0f0",
                    padding: "10px",
                    wordBreak: "break-all",
                    width: "fit-content",
                  }}
                >
                  <Link to={publishedLink}>{publishedLink}</Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Les routes pour afficher les salles et créneaux de soutenance */}
        {configO2023 && (
          <Routes>
            <Route path="/" element={<Home />}>
              {/* Page d'accueil (peut-être la liste des salles) */}
            </Route>

            <Route
              path="/prog"
              element={
                <>
                  {newRooms.map((room, index) => (
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
                      onDelete={() => {
                        console.log("Suppression de la salle :", room);
                        setNewRooms((prevRooms) => {
                          const updatedRooms = [...prevRooms];
                          updatedRooms.splice(index, 1);
                          return updatedRooms;
                        });
                      }}
                    />
                  ))}
                </>
              }
            />
          </Routes>
        )}
      </Fragment>
    </Router>
  );
};

export default App;
