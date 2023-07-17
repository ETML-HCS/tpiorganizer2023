import React, { useState } from "react";

const TPICard = ({ isEditingTpiCard, candidat, expert1, expert2, boss }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCandidat, setEditedCandidat] = useState(candidat);
  const [editedExpert1, setEditedExpert1] = useState(expert1);
  const [editedExpert2, setEditedExpert2] = useState(expert2);
  const [editedBoss, setEditedBoss] = useState(boss);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    console.log("Save button clicked");
    // Perform save logic here
    // You can update the backend or store the edited values as needed
    // For this example, I'll just update the edited values in the component state
    setEditedCandidat(editedCandidat);
    setEditedExpert1(editedExpert1);
    setEditedExpert2(editedExpert2);
    setEditedBoss(editedBoss);
  };

  return (
    <div className="tpiCard">
      {isEditing ? (
        <>
          <input
            type="text"
            value={editedCandidat}
            onChange={(e) => setEditedCandidat(e.target.value)}
          />
          <input
            type="text"
            value={editedExpert1}
            onChange={(e) => setEditedExpert1(e.target.value)}
          />
          <input
            type="text"
            value={editedExpert2}
            onChange={(e) => setEditedExpert2(e.target.value)}
          />
          <textarea
            value={editedBoss}
            onChange={(e) => setEditedBoss(e.target.value)}
          />
        </>
      ) : (
        <>
          <div className="candidat">Candidat: {editedCandidat}</div>
          <div className="expert">Expert 1: {editedExpert1}</div>
          <div className="expert">Expert 2: {editedExpert2}</div>
          <div className="boss">Chef de projet: {editedBoss}</div>
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
