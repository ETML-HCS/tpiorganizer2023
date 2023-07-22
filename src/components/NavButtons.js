import React, { useState } from 'react';
import NewRoomForm from './NewRoomForm';

const NavButton = ({ onNewRoom, onToggleEditing, onSave, configData }) => {
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleAddRoom = () => {
    setShowForm(true);
  };

  const handleNewRoom = (roomInfo) => {
    onNewRoom(roomInfo);
    setShowForm(false);
  };

  const handleSend = () => {
  };

  const handleEdition = () => {
    setIsEditing(true);
    onToggleEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    onToggleEditing(false);  
    onSave();
  };


  return (
    <div id="tools">
      {showForm ? (
        <NewRoomForm onNewRoom={handleNewRoom} configData={configData} />
      ) : (
        <>
          <button id="btNewRoom" onClick={handleAddRoom}>
            &#x1F4DA; Nouvelle salle
          </button>
          <button id="btSendEmail" onClick={handleSend}>
            &#x1F4E7; Envoyer
          </button>
          {isEditing ? (
            <button id="btSave" onClick={handleSave}>
              Enregistrer
            </button>
          ) : null}
          <button id="btEdition" onClick={handleEdition}>
            &#x1F4DD; Édition
          </button>
        </>
      )}
    </div>
  );
};

export default NavButton;
