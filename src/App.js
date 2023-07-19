import React, { Fragment, useState, useEffect } from 'react';
import NavButton from './components/NavButtons';
import DateRoom from './components/DateRoom';
import './css/globalStyles.css';


const App = () => {

  useEffect(() => {
    const updateRoomPaddingTop = () => {
      const rootElement = document.getElementById('root');
      const headerElement = document.getElementById('header');

      const { height } = headerElement.getBoundingClientRect();

      rootElement.style.setProperty('--room-padding-top', `${height + 6}px`);
    };

    window.addEventListener('load', updateRoomPaddingTop);
    window.addEventListener('resize', updateRoomPaddingTop);

    return () => {
      window.removeEventListener('load', updateRoomPaddingTop);
      window.removeEventListener('resize', updateRoomPaddingTop);
    };
  }, []);

  const dateAujourdhui = new Date();
  const dateFormatted = dateAujourdhui.toLocaleDateString();

  const [newRooms, setNewRooms] = useState([]);
  const [isEditing, setIsEditing] = useState(false);

  const handleNewRoom = (roomInfo) => {
    console.log('Nouvelle salle ajoutée :', roomInfo);

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
        link.download = "rooms.json";
        link.click();

        URL.revokeObjectURL(url);
      })
      .catch((error) => {
        console.error("Erreur lors de l'enregistrement des données :", error);
      });
  };

  return (
    <Fragment>
      <div id='header'>
        <div id="title">
          <span id="left"> <span className="etml">ETML</span> / CFPV</span>
          <span id="center">&#xF3; 2023</span>
          <span id="right" className="dateToday">aujourd'hui: {dateFormatted}</span>
        </div>
        <NavButton
          onNewRoom={handleNewRoom}
          onToggleEditing={toggleEditing}
          onSave={handleSave}
        />
      </div>

      {newRooms.map((room, index) => (
        <DateRoom
          key={index} // Ajoutez une prop key unique en utilisant l'index
          roomIndex={index}
          date={room.date}
          name={room.nameRoom}
          site={room.site}
          tpiData={room.tpiData}
          isEditOfRoom={isEditing}
          onUpdateTpi={(tpiIndex, updatedTpi) => handleUpdateTpi(index, tpiIndex, updatedTpi)}
          onDelete={() => {
            console.log('Suppression de la salle :', room);
            setNewRooms((prevRooms) => {
              const updatedRooms = [...prevRooms];
              updatedRooms.splice(index, 1);
              return updatedRooms;
            });
          }}
        />
      ))}
    </Fragment>
  );
};

export default App;
