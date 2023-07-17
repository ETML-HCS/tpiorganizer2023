import React, { useState } from 'react';
import NewRoomForm from './NewRoomForm';

const NavButton = ({ onNewRoom }) => {
  const [showForm, setShowForm] = useState(false);

  const handleAddRoom = () => {
    setShowForm(true);
  };

  const handleNewRoom = (roomInfo) => {
    // Gérer les informations de la nouvelle salle (ex : les afficher, les enregistrer, etc.)
    console.log(roomInfo);
    
    onNewRoom(roomInfo); // Appeler la fonction onNewRoom transmise en tant que prop

    // Cacher le formulaire après l'ajout de la salle
    setShowForm(false);
  };

  const handleSend = () => {
    // Gérer l'événement du bouton "Send"
    console.log("Send button clicked");
  };

  const handleEdition = () => {
    // Gérer l'événement du bouton "Edition"
    console.log("Edition button clicked");
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
          <button id="btEdition" onClick={handleEdition}>
            &#x1F4DD; Edition
          </button>
        </>
      )}
    </div>
  );
};

export default NavButton;
