import React, { useState } from 'react';

const TPICard = ({ tpi, isEditingTpiCard, onUpdateTpi }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTpi, setEditedTpi] = useState(tpi || {}); // Assurez-vous que tpi est défini

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    onUpdateTpi(editedTpi);
  };

  const handleChange = (e, field) => {
    setEditedTpi((prevTpi) => ({
      ...prevTpi,
      [field]: e.target.value,
    }));
  };

  return (
    <div className="tpiCard">
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
          <div className='candidat'>Candidat: {editedTpi.candidat}</div>
          <div className='expert'>Expert 1: {editedTpi.expert1}</div>
          <div className='expert' >Expert 2: {editedTpi.expert2}</div>
          <div className='boss'>Chef de projet: {editedTpi.boss}</div>
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

export default TPICard;
