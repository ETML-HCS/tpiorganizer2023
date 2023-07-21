import React, { useState } from 'react';
import { useDrop } from 'react-dnd';
import TpiCard from './TpiCard';
import { ItemTypes } from './Constants';

const TpiSlot = ({ tpiID, isEditTPISlot, startTime = "08:00", endTime = "09:00", candidat, expert1, expert2, boss, onUpdateTpi, onSwapTpiCardsProp }) => {

  // Utiliser l'ID TPI généré pour le TpiSlot
  const [isEditing, setIsEditing] = useState(false);
  const [editedTpi, setEditedTpi] = useState({
    id: tpiID,
    startTime,
    endTime,
    candidat,
    expert1,
    expert2,
    boss,
  });
  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    onUpdateTpi(editedTpi);
  };

  const handleUpdateTpiCard = (updatedTpi) => {
    setEditedTpi(updatedTpi);
    onUpdateTpi(updatedTpi); // Appeler la fonction de rappel onUpdateTpi avec les données mises à jour
  };

  const [{ isOver }, dropRef] = useDrop({
    accept: ItemTypes.TPI_CARD,
    drop: (item) => {
      console.log("drop called with:", item.tpi.id);
      const draggedTpi = item.tpi.id;
      console.log("drop called with:", editedTpi.id);
      onSwapTpiCardsProp(draggedTpi, editedTpi.id);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  return (
    <div ref={dropRef} className={`tpiSlot ${isOver ? 'dragOver' : ''}`}>
      <div className="timeSlot">
        {isEditing ? (
          <>
            <input
              type="time"
              className="top edit"
              value={editedTpi.startTime}
              onChange={(e) =>
                setEditedTpi((prevTpi) => ({
                  ...prevTpi,
                  startTime: e.target.value,
                }))
              }
            />
            <input
              type="time"
              className="bottom edit"
              value={editedTpi.endTime}
              onChange={(e) =>
                setEditedTpi((prevTpi) => ({
                  ...prevTpi,
                  endTime: e.target.value,
                }))
              }
            />
          </>
        ) : (
          <>
            <p className="top">{startTime}</p>
            <p className="bottom">{endTime}</p>
          </>
        )}
      </div>

      <TpiCard
        tpi={{
          ...editedTpi,
          id: tpiID, // Passer l'ID TPI au composant TpiCard
        }}
        isEditingTpiCard={isEditTPISlot}
        onUpdateTpi={handleUpdateTpiCard}
      />

      {!isEditing && isEditTPISlot && (
        <div className="editButton">
          <button onClick={handleEdit}>Edit</button>
        </div>
      )}
      {isEditing && isEditTPISlot && (
        <div className="saveButton">
          <button onClick={handleSave}>Save</button>
        </div>
      )}
    </div>
  );
};

export default TpiSlot;
