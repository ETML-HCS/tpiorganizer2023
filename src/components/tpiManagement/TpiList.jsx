import React, { useState } from "react";
import TpiForm from "./TpiForm";

const TpiList = ({ tpiList,onSave }) => {

  const [editingTpiId, setEditingTpiId] = useState(null);

  const handleEdit = (tpiRef) => {
    setEditingTpiId(tpiRef);
    
  };

  const handleFormClose = () => {
    setEditingTpiId(null);
    console.log("valeur editing: ",editingTpiId);
  } 

  return (
    <>
      <h2>Liste des TPI :</h2>
      {tpiList.length === 0 ? (
        <p>Aucun TPI trouvé.</p>
      ) : (
        <ul className="tpiList">
          {tpiList.map((tpi) => (
            <li key={tpi.refTpi}>
              {editingTpiId === tpi.refTpi ? (
                // Formulaire d'édition si l'ID d'édition correspond à l'ID du TPI actuel
                <TpiForm
                  tpiToLoad={tpi}
                  onSave={onSave}
                  onClose={handleFormClose}
                />
              ) : (
                // Affichage normal si l'ID d'édition ne correspond pas à l'ID du TPI actuel
                <>
                  <span>ID : {tpi.refTpi}</span>
                  <span>Candidat : {tpi.candidat}</span>
                  <span>Expert 1 : {tpi.expert1}</span>
                  <span>Expert 2 : {tpi.expert2}</span>
                  <span>Boss : {tpi.boss}</span>

                  <button onClick={() => handleEdit(tpi.refTpi)}>
                    Modifier
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

export default TpiList;
