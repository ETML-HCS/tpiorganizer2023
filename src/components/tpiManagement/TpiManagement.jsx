// TpiManagement.jsx
import React, { useState } from "react";

import TpiForm from "./TpiForm";
import TpiList from "./TpiList";
import { saveTpi, getTpiList } from "./TpiData";

import TpiManagementButtons from "./TpiManagementButtons";

import "../../css/tpiManagement/tpiManagementStyle.css";

const TpiManagement = ({ toggleArrow, isArrowUp }) => { 
  const [newTpi, setNewTpi] = useState(false);

  // Fonction pour sauvegarder un nouveau TPI
  const handleSaveTpi = (tpiDetails) => {
    saveTpi(tpiDetails); 
  };

  // Récupérer la liste des TPI sauvegardés
  const tpiList = getTpiList();

  return (
    <>
      <TpiManagementButtons
      newTpi={newTpi}
        onNewTpi={setNewTpi}
        toggleArrow={toggleArrow}
        isArrowUp={isArrowUp}
      />

      <div className="container">
        {newTpi && <TpiForm onSave={handleSaveTpi} />}

        <TpiList tpiList={tpiList} onSave={handleSaveTpi} />
      </div>
    </>
  );
};

export default TpiManagement;
