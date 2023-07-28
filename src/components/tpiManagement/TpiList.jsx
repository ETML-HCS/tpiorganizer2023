import React, { useState } from "react";
import TpiForm from "./TpiForm";

const TpiList = ({ tpiList, onSave }) => {
  const [editingTpiId, setEditingTpiId] = useState(null);

  const handleEdit = (tpiRef) => {
    console.log(tpiRef);
    setEditingTpiId(tpiRef);
  };

  const handleFormClose = () => {
    setEditingTpiId(null);
    console.log("valeur editing: ", editingTpiId);
  };

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
                  <span>
                    <strong>ID : {tpi.refTpi} </strong>
                  </span>
                  <span className="displayTags">{tpi.tags}</span>
                  <span style={{textAlign:"center"}}>
                    <strong>{tpi.candidat} </strong>
                  </span>
                  <span style={{ color: "#1e82ff" }}>{tpi.sujet}</span>

                  <span>Exp1 : {tpi.expert1}</span>
                  <span>Exp2 : {tpi.expert2}</span>
                  <span> &raquo; {tpi.boss}</span>
                  <span>Lieu : {tpi.lieu}</span>
                  <span>{tpi.tags}</span>

                  <div
                    className="btEdit"
                    onClick={() => handleEdit(tpi.refTpi)}
                  >
                    Modifier
                  </div>
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
