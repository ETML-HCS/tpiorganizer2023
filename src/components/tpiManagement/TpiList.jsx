import React, { useState } from "react";
import TpiForm from "./tpiForm";

const MAX_DISPLAY_TAGS = 1;

const TpiList = ({ tpiList, onSave }) => {
  const [editingTpiId, setEditingTpiId] = useState(null);
  const [displayedTags, setDisplayedTags] = useState({});

  const handleEdit = (tpiRef) => {
    console.log(tpiRef);
    setEditingTpiId(tpiRef);
  };

  const handleFormClose = () => {
    setEditingTpiId(null);
    console.log("valeur editing: ", editingTpiId);
  };

  const handleTagHover = (tpiRef, tag) => {
    setDisplayedTags((prevDisplayedTags) => ({
      ...prevDisplayedTags,
      [tpiRef]: tag,
    }));
  };

  const handleTagHoverExit = (tpiRef) => {
    setDisplayedTags((prevDisplayedTags) => ({
      ...prevDisplayedTags,
      [tpiRef]: null,
    }));
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
                <TpiForm
                  tpiToLoad={tpi}
                  onSave={onSave}
                  onClose={handleFormClose}
                />
              ) : (
                <div>
                  <span>
                    <strong>ID : {tpi.refTpi} </strong>
                  </span>
                  <div className="displayTagsContainer">
                    {tpi.tags.slice(0, MAX_DISPLAY_TAGS).map((tag, index) => (
                      <span
                        key={index}
                        className="displayTags"
                        onMouseEnter={() => handleTagHover(tpi.refTpi, tag)}
                        onMouseLeave={() => handleTagHoverExit(tpi.refTpi)}
                      >
                        {tag}
                      </span>
                    ))}
                    {tpi.tags.length > MAX_DISPLAY_TAGS && (
                      <span
                        className="hiddenTags"
                        onMouseEnter={() =>
                          handleTagHover(
                            tpi.refTpi,
                            tpi.tags.slice(MAX_DISPLAY_TAGS).join(", ")
                          )
                        }
                        onMouseLeave={() => handleTagHoverExit(tpi.refTpi)}
                      >
                        {displayedTags[tpi.refTpi] ||
                          `+${tpi.tags.length - MAX_DISPLAY_TAGS}`}
                      </span>
                    )}
                  </div>

                  <div style={{ textAlign: "center" }}>
                    <strong>{tpi.candidat} </strong>
                  </div>
                  <span style={{ color: "#1e82ff" }}>{tpi.sujet}</span>

                  <span>Exp1 : {tpi.expert1}</span>
                  <span>Exp2 : {tpi.expert2}</span>
                  <span> &raquo; {tpi.boss}</span>
                  <span>Lieu : {tpi.lieu}</span>
                  {displayedTags[tpi.refTpi] && (
                    <div className="hoveredTag">{displayedTags[tpi.refTpi]}</div>
                  )}

                  <div
                    className="btEdit"
                    onClick={() => handleEdit(tpi.refTpi)}
                  >
                    Modifier
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

export default TpiList;
