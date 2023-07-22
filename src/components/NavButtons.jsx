import React, { useState } from "react";
import NewRoomForm from "./NewRoomForm";

const NavButtons = ({
  onNewRoom,
  onToggleEditing,
  onSave,
  onExport,
  configData,
  onLoadConfig,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleAddRoom = () => {
    setShowForm(true);
  };

  const handleSend = () => {};

  const handleEdition = () => {
    setIsEditing(true);
    onToggleEditing((boolean) => !boolean);
  };

  const handleExport = () => {
    setIsEditing(false);
    onToggleEditing(false);
    onExport();
  };

  const handleSave = () => {
    onSave();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Charger le fichier .json en utilisant FileReader
      const fileReader = new FileReader();
      fileReader.onload = (e) => {
        const jsonData = e.target.result;
        onLoadConfig(jsonData); // Appeler la fonction pour traiter les données chargées
      };
      fileReader.readAsText(file);
    }
  };
  

  return (
    <div id="tools">
      {showForm ? (
        <NewRoomForm
          onNewRoom={onNewRoom}
          configData={configData}
          setShowForm={setShowForm}
        />
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
          <label htmlFor="configFile" className="button-label">
            &#x1F4C2; Charger Config
          </label>
          <input
            type="file"
            id="configFile"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </>
      )}
    </div>
  );
};

export default NavButtons;
