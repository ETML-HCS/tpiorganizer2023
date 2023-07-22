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
            Nouvelle salle &#x1F4DA;
          </button>
          <button id="btSendEmail" onClick={handleSend}>
            Envoyer &#x1F4E7;
          </button>
          {isEditing && (
            <button id="btExport" onClick={handleExport}>
              Exporter &#x1F4E5;
            </button>
          )}
          <button id="btEdition" onClick={handleEdition}>
            Modifier &#x1F4DD;
          </button>
          <button id="btSave" onClick={handleSave}>
            Enregistrer &#x1F4BE;
          </button>
          <label htmlFor="configFile" id="btLoadFile" className="btInput">
            Charger Fichier  &#x1F4C2;
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
