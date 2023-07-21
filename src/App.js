import React, { Fragment, useState, useEffect } from "react";
import NavButton from "./components/NavButtons";
import DateRoom from "./components/DateRoom";
import "./css/globalStyles.css";

const configO2023 = require("./config/configO2023.json");
if (!configO2023) {
  console.error("Erreur lors du chargement du fichier de configuration.");
}

const App = () => {
  useEffect(() => {
    const updateRoomPaddingTop = () => {
      const rootElement = document.getElementById("root");
      const headerElement = document.getElementById("header");

      const { height } = headerElement.getBoundingClientRect();

      rootElement.style.setProperty("--room-padding-top", `${height + 6}px`);
    };

    window.addEventListener("load", updateRoomPaddingTop);
    window.addEventListener("resize", updateRoomPaddingTop);

    return () => {
      window.removeEventListener("load", updateRoomPaddingTop);
      window.removeEventListener("resize", updateRoomPaddingTop);
    };
  }, []);

  const dateAujourdhui = new Date();
  const dateFormatted = dateAujourdhui.toLocaleDateString();

  const [newRooms, setNewRooms] = useState([]);
  const [isEditing, setIsEditing] = useState(false);

  const handleNewRoom = (roomInfo) => {
    console.log("Nouvelle salle ajoutée :", roomInfo);

    const newRoom = {
      date: roomInfo.date,
      site: roomInfo.site,
      nameRoom: roomInfo.nameRoom,
      tpiData: [],
    };

    setNewRooms((prevRooms) => [...prevRooms, newRoom]);
  };

  const handleUpdateTpi = (roomIndex, tpiIndex, updatedTpi) => {
    setNewRooms((prevRooms) => {
      const updatedRooms = [...prevRooms];
      updatedRooms[roomIndex].tpiData[tpiIndex] = updatedTpi;
      return updatedRooms;
    });
  };

  const toggleEditing = () => {
    setIsEditing((prevIsEditing) => !prevIsEditing);
  };

  const handleSave = () => {
    console.log("App.js, newRooms: ", newRooms);

    if (newRooms.length === 0) {
      console.log("Aucune salle à sauvegarder.");
      return;
    }

    const updatedRooms = [...newRooms];

    Promise.all(
      updatedRooms.map((room, roomIndex) =>
        Promise.all(
          room.tpiData.map((tpi, tpiIndex) =>
            handleUpdateTpi(roomIndex, tpiIndex, tpi)
          )
        )
      )
    )
      .then(() => {
        const jsonRooms = JSON.stringify(updatedRooms);

        const blob = new Blob([jsonRooms], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = "backupRooms.json";
        link.click();

        URL.revokeObjectURL(url);
      })
      .catch((error) => {
        console.error("Erreur lors de l'enregistrement des données :", error);
      });
  };

  const handleSwapTpiCards = (roomIndex, draggedTpiID, targetTpiID) => {
    console.log("config ", roomIndex, " > ", draggedTpiID, " > ", targetTpiID);
  
    const [draggedSite, draggedRoom, draggedSlot] = draggedTpiID.split("_");
    const [targetSite, targetRoom, targetSlot] = targetTpiID.split("_");
  
    console.log("config ", draggedSite, " > ", draggedRoom, " > ", draggedSlot);
    console.log("config ", targetSite, " > ", targetRoom, " > ", targetSlot);
  
    // Récupérer la liste newRooms
    const updatedRooms = newRooms.map((room) => ({ ...room }));
  
    // Rechercher la room contenant la carte TPI draggedTpiID
    const draggedRoomIndex = updatedRooms.findIndex((room) => roomIndex === roomIndex && draggedRoom === room.nameRoom);
  
    // Rechercher la room contenant la carte TPI targetTpiID
    const targetRoomIndex = updatedRooms.findIndex((room) => targetSite === room.site && targetRoom === room.nameRoom);
  
    // Vérifier si les deux rooms ont été trouvées
    if (draggedRoomIndex !== -1 && targetRoomIndex !== -1) {
      // Récupérer l'index de la carte TPI draggedTpiID dans draggedRoom
      const draggedTpiIndex = updatedRooms[draggedRoomIndex].tpiData.findIndex((tpi) => draggedSlot === tpi.id);
  
      // Récupérer l'index de la carte TPI targetTpiID dans targetRoom
      const targetTpiIndex = updatedRooms[targetRoomIndex].tpiData.findIndex((tpi) => targetSlot === tpi.id);
  
      // Vérifier si les deux index ont été trouvés
      if (draggedTpiIndex !== -1 && targetTpiIndex !== -1) {
        // Échanger les cartes TPI entre les deux rooms
        const draggedTpi = updatedRooms[draggedRoomIndex].tpiData[draggedTpiIndex];
        updatedRooms[draggedRoomIndex].tpiData[draggedTpiIndex] = updatedRooms[targetRoomIndex].tpiData[targetTpiIndex];
        updatedRooms[targetRoomIndex].tpiData[targetTpiIndex] = draggedTpi;
  
        // Mettre à jour les rooms dans la liste newRooms
        setNewRooms(updatedRooms);
      } else {
        console.error(
          "Erreur lors de l'échange des cartes TPI : L'index de la carte TPI n'a pas été trouvé dans l'une des rooms."
        );
      }
    } else {
      console.error(
        "Erreur lors de l'échange des cartes TPI : L'une des rooms contenant la carte TPI n'a pas été trouvée."
      );
    }
  };
  
  
  return (
    <Fragment>
      {configO2023 && (
        <div id="header">
          <div id="title">
            <span id="left">
              {" "}
              <span className="etml">ETML</span> / CFPV
            </span>
            <span id="center">&#xF3; 2023</span>
            <span id="right" className="dateToday">
              aujourd'hui: {dateFormatted}
            </span>
          </div>
          <NavButton
            configData={configO2023}
            onNewRoom={handleNewRoom}
            onToggleEditing={toggleEditing}
            onSave={handleSave}
          />
        </div>
      )}

      {configO2023 &&
        newRooms.map((room, index) => (
          <DateRoom
            key={index}
            roomIndex={index}
            date={room.date}
            name={room.nameRoom}
            site={room.site}
            siteData={configO2023[room.site.toLowerCase()]}
            tpiData={room.tpiData}
            isEditOfRoom={isEditing}
            onUpdateTpi={(tpiIndex, updatedTpi) =>
              handleUpdateTpi(index, tpiIndex, updatedTpi)
            }
            onDelete={() => {
              console.log("Suppression de la salle :", room);
              setNewRooms((prevRooms) => {
                const updatedRooms = [...prevRooms];
                updatedRooms.splice(index, 1);
                return updatedRooms;
              });
            }}
            // Passer la fonction handleSwapTpiCards en tant que prop
            onSwapTpiCards={(draggedTpi, targetTpi) =>
              handleSwapTpiCards(index, draggedTpi, targetTpi)
            }
          />
        ))}
    </Fragment>
  );
};

export default App;
