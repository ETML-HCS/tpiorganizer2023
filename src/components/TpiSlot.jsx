import React, { useState } from 'react';
import { useDrop } from 'react-dnd';
import TpiCard from './TpiCard';
import { ItemTypes } from './Constants';

const TpiSlot = ({ tpiData, isEditTPISlot, startTime, endTime, onUpdateTpi, onSwapTpiCardsProp }) => {

  // Utiliser l'ID TPI généré pour le TpiSlot
  const [isEditing, setIsEditing] = useState(false);
  const [editedTpi, setEditedTpi] = useState({ startTime, endTime });

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    onUpdateTpi(editedTpi);
  };

  const handleUpdateTpiCard = (updatedTpi) => {
    setEditedTpi(updatedTpi);
    onUpdateTpi(updatedTpi);
  };

  const [{ isOver }, dropRef] = useDrop({
    accept: ItemTypes.TPI_CARD,
    drop: (item) => {
      console.log("drop called with:", item.tpi.id);
      const draggedTpi = item.tpi.id;
      console.log("drop called with:", tpiData.id);
      onSwapTpiCardsProp(draggedTpi, tpiData.id);
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
        tpi={tpiData}
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
