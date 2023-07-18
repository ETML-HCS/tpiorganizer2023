import React, { useState } from 'react';
import NewRoomForm from './NewRoomForm';

const NavButton = ({ onNewRoom, onToggleEditing, onSave }) => {
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleAddRoom = () => {
    setShowForm(true);
  };

  const handleNewRoom = (roomInfo) => {
    console.log('Nouvelle salle ajoutée :', roomInfo);
    onNewRoom(roomInfo);
    setShowForm(false);
  };

  const handleSend = () => {
    console.log("Send button clicked");
  };

  const handleEdition = () => {
    console.log("Edition button clicked");
    setIsEditing(true);
    onToggleEditing(true);
  };

  const handleSave = () => {
    console.log("Save button clicked");
    setIsEditing(false);
    onToggleEditing(false);  
    onSave();
  };
  
  return (
    <div id="tools">
      {showForm ? (
        <NewRoomForm onNewRoom={handleNewRoom} />
      ) : (
        <>
          <button id="btNewRoom" onClick={handleAddRoom}>
            &#x1F4DA; New room
          </button>
          <button id="btSendEmail" onClick={handleSend}>
            &#x1F4E7; Send
          </button>
          {isEditing ? (
            <button id="btSave" onClick={handleSave}>
              Save
            </button>
          ) : null}
          <button id="btEdition" onClick={handleEdition}>
            &#x1F4DD; Edition
          </button>
        </>
      )}
    </div>
  );
};

export default NavButton;
