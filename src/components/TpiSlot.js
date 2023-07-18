import React, { useState } from 'react';
import TPICard from './TpiCard';

const TPISlot = ({
  isEditTPISlot,
  startTime,
  endTime,
  candidat,
  expert1,
  expert2,
  boss,
  onUpdateTpi,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTpi, setEditedTpi] = useState({
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

  return (
    <div className="tpiSlot">
      <div className="timeSlot">
        {isEditing ? (
          <>
            <input
              type="time"
              className="top"
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
              className="bottom"
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
            <p className="top">Début : {startTime}</p>
            <p className="bottom">Fin : {endTime}</p>
          </>
        )}
      </div>
      <TPICard
        tpi={editedTpi}
        isEditingTpiCard={isEditTPISlot}
        onUpdateTpi={(updatedTpi) => setEditedTpi(updatedTpi)}
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

export default TPISlot;
