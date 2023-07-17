import React, { Fragment, useState } from 'react';
import NavButton from './components/NavButtons';
import DateRoom from './components/DateRoom';
import './css/globalStyles.css';

const App = () => {
  const dateAujourdhui = new Date();
  const dateFormatted = dateAujourdhui.toLocaleDateString();

  const [newRooms, setNewRooms] = useState([]);
  const [isEditing, setIsEditing] = useState(false);

  const handleNewRoom = (roomInfo) => {
    console.log('Nouvelle salle ajoutée :', roomInfo);
    setNewRooms([...newRooms, roomInfo]);
  };

  const toggleEditing = () => {
    setIsEditing(!isEditing);
  };

  return (
    <Fragment>
      <div id='header'>
        <div id="title">
          <span id="left"> <span className="etml">ETML</span> / CFPV</span>
          <span id="center">&#xF3; 2023</span>
          <span id="right" className="dateToday">aujourd'hui: {dateFormatted}</span>
        </div>
        <NavButton onNewRoom={handleNewRoom} onToggleEditing={toggleEditing} />
      </div>

      {newRooms.map((room, index) => (
        <DateRoom
          key={index}
          date={room.date}
          site={room.site}
          room={room.room}
          isEditOfRoom={isEditing}
          onDelete={() => {
            console.log('Suppression de la salle :', room);
            const updatedRooms = [...newRooms];
            updatedRooms.splice(index, 1);
            setNewRooms(updatedRooms);
          }}
        />
      ))}
    </Fragment>
  );
};

export default App;
