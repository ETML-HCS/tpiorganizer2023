import React, { useState, useEffect } from "react";
import { useDrag } from "react-dnd";
import { ItemTypes } from "./Constants"; // You'll define this later

const TpiCard = ({ tpi, isEditingTpiCard, onUpdateTpi }) => {
  const [editedTpi, setEditedTpi] = useState(tpi);

  useEffect(() => {
    // Mettre à jour l'état editedTpi seulement si la prop tpi change
    setEditedTpi(tpi);
  }, [tpi]);

  useEffect(() => {
    // Mettre à jour le TPI sur l'action d'édition lorsque isEditingTpiCard est vrai
    if (isEditingTpiCard) {
      onUpdateTpi(editedTpi);
    }
  }, [isEditingTpiCard]);

  const handleChange = (e, field) => {
    setEditedTpi((prevTpi) => ({
      ...prevTpi,
      [field]: e.target.value,
    }));
  };

  const [{ isDragging }, dragRef] = useDrag({
    type: ItemTypes.TPI_CARD,
    item: { tpi },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div ref={dragRef} className={`tpiCard ${isDragging ? "dragging" : ""}`}>
      {isEditingTpiCard ? (
        <>
          <input
            type="text"
            className="edit"
            value={editedTpi.candidat || ""}
            onChange={(e) => handleChange(e, "candidat")}
          />
          <input
            type="text"
            className="edit"
            value={editedTpi.expert1 || ""}
            onChange={(e) => handleChange(e, "expert1")}
          />
          <input
            type="text"
            className="edit"
            value={editedTpi.expert2 || ""}
            onChange={(e) => handleChange(e, "expert2")}
          />
          <input
            type="text"
            className="edit"
            value={editedTpi.boss || ""}
            onChange={(e) => handleChange(e, "boss")}
          />
        </>
      ) : (
        <>
          <div className="debug">{editedTpi.id}</div>
          <div className="candidat">
            <span role="img" aria-label="star" className="star-icon">
              ⭐️
            </span>
            {editedTpi.candidat}
          </div>
          <div className="expert">
            <span role="img" aria-label="checkmark" className=" boss-icon " >
              ✔️
            </span>
            {editedTpi.expert1}
          </div>
          <div className="expert">
            <span role="img" aria-label="checkmark">
              ✔️
            </span>
            {editedTpi.expert2}
          </div>
          <div className="boss">
            <span role="img" aria-label="boss">
              👔
            </span>
            {editedTpi.boss}
          </div>
        </>
      )}
    </div>
  );
};

export default TpiCard;
