import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import { ItemTypes } from './Constants'; // You'll define this later

const TpiCard = ({ tpi, isEditingTpiCard, onUpdateTpi }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTpi, setEditedTpi] = useState(tpi || {});

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    // Vérifier si tous les champs requis sont remplis
    if (!editedTpi.candidat || !editedTpi.expert1 || !editedTpi.expert2 || !editedTpi.boss) {
      console.log("Veuillez remplir tous les champs avant de sauvegarder.");
      return;
    }
    setIsEditing(false);
    onUpdateTpi(editedTpi);
  };

  const handleChange = (e, field) => {
    setEditedTpi((prevTpi) => ({
      ...prevTpi,
      [field]: e.target.value,
    }));
  };

  const [{ isDragging }, dragRef] = useDrag({
    type: ItemTypes.TPI_CARD,
    item:{ tpi },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div ref={dragRef} className={`tpiCard ${isDragging ? 'dragging' : ''}`} >
      {isEditing ? (
        <>
          <input
            type="text" className='edit'
            value={editedTpi.candidat || ''} // Vérifiez si candidat est défini
            onChange={(e) => handleChange(e, 'candidat')}
          />
          <input
            type="text" className='edit'
            value={editedTpi.expert1 || ''} // Vérifiez si expert1 est défini
            onChange={(e) => handleChange(e, 'expert1')}
          />
          <input
            type="text" className='edit'
            value={editedTpi.expert2 || ''} // Vérifiez si expert2 est défini
            onChange={(e) => handleChange(e, 'expert2')}
          />
          <input
            type="text" className='edit'
            value={editedTpi.boss || ''} // Vérifiez si boss est défini
            onChange={(e) => handleChange(e, 'boss')}
          />
        </>
      ) : (
        <>
          <div className='debug'>{tpi.id}</div>
          <div className='candidat'>{editedTpi.candidat}&nbsp;</div>
          <div className='expert'>{editedTpi.expert1}&nbsp;</div>
          <div className='expert'>{editedTpi.expert2}&nbsp;</div>
          <div className='boss'> &gt; {editedTpi.boss}&nbsp;</div>
        </>
      )}

      {!isEditing && isEditingTpiCard && (
        <div className="editButton">
          <button onClick={handleEdit}>Edit</button>
        </div>
      )}

      {isEditing && isEditingTpiCard && (
        <div className="saveButton">
          <button onClick={handleSave}>Save</button>
        </div>
      )}
    </div>
  );
};

export default TpiCard;
