import React, { useState } from 'react';
import NewRoomForm from './NewRoomForm';

const NavButtons = ({ onNewRoom, onToggleEditing, onSave, onExport, configData }) => {
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleAddRoom = () => {
    setShowForm(true);
  };

  const handleSend = () => {
  };

  const handleEdition = () => {
    setIsEditing(true);
    onToggleEditing((boolean)=>(!boolean));
  };

  const handleExport = () => {
    setIsEditing(false);
    onToggleEditing(false);  
    onExport();
  };

  const handleSave =() => {}

  return (
    <div id='tools'>
      {showForm ? (
        <NewRoomForm onNewRoom={onNewRoom} configData={configData} setShowForm={setShowForm} />
      ) : (
        <>
          <button id="btNewRoom" onClick={handleAddRoom}>
            &#x1F4DA; Nouvelle salle
          </button>
          <button id="btSendEmail" onClick={handleSend}>
            &#x1F4E7; Envoyer
          </button>
          {isEditing && (
            <button id="btExport" onClick={handleExport}>
              &#x1F4E5; Exporter
            </button>
          )}
          <button id="btEdition" onClick={handleEdition}>
            &#x1F4DD; Modifier
          </button>
          <button id="btSave" onClick={handleSave}>
            &#x1F4BE; Enregistrer
          </button>
        </>
      )}
    </div>
  );
};

export default NavButtons;