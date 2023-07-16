// TPICard.js
import React from 'react';

const TPICard = ({ candidat, expert1, expert2, chefDeProjet }) => {
  return (
    <div className="tpi-card">
      <h4>Candidat: {candidat}</h4>
      <p>Expert 1: {expert1}</p>
      <p>Expert 2: {expert2}</p>
      <p>Chef de projet: {chefDeProjet}</p>
    </div>
  );
};

export default TPICard;
