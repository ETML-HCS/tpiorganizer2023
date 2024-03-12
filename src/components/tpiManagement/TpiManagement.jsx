import React, { useState, useEffect } from "react";

import { saveTpiToServer, getTpiFromServer } from "./TpiData.jsx";
import TpiForm from "./TpiForm.jsx";
import TpiList from "./TpiList.jsx";
import TpiManagementButtons from "./TpiManagementButtons.jsx";
import { updateMarginTopPage } from "../Tools.jsx";

import "../../css/tpiManagement/tpiManagementStyle.css";

const TpiManagement = ({ toggleArrow, isArrowUp }) => {
  const [newTpi, setNewTpi] = useState(false);
  const [tpiList, setTpiList] = useState([]);

  useEffect(() => {
    // Utilisez useEffect pour charger les données de TPI lors du montage du composant
    async function fetchData() {
      updateMarginTopPage(5);
      try {
        const data = await getTpiFromServer();
        setTpiList(data);
      } catch (error) {
        // Gérer les erreurs éventuelles ici
        console.error(
          "Erreur lors de la récupération des TPI depuis le serveur:",
          error
        );
      }
    }
    fetchData();

    // Le tableau vide comme deuxième argument signifie que cette fonction s'exécutera
    // une seule fois lors du montage initial du composant
  }, []);

  const handleSaveTpi = async (tpiDetails) => {
    try {
      await saveTpiToServer(tpiDetails);

      // Après avoir enregistré avec succès, mettez à jour la liste des TPI en récupérant à nouveau les données du serveur
      const updatedTpiList = await getTpiFromServer();
      setTpiList(updatedTpiList);
    } catch (error) {
      // Gérer les erreurs éventuelles ici
      console.error("Erreur lors de la sauvegarde du TPI:", error);
    }
  };
  const handleOnClose = () => {
    setNewTpi(false);
  };

  return (
    <>
      <TpiManagementButtons
        newTpi={newTpi}
        onNewTpi={setNewTpi}
        toggleArrow={toggleArrow}
        isArrowUp={isArrowUp}
      />

      <div className="container">
        {newTpi && <TpiForm onSave={handleSaveTpi} onClose={handleOnClose} />}

        <TpiList tpiList={tpiList} onSave={handleSaveTpi} />
      </div>
    </>
  );
};

export default TpiManagement;
