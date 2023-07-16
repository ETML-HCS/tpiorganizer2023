import React from 'react';
import TPICard from './TpiCard';

const TPISlot = ({ startTime, endTime, candidat, expert1, expert2, chefDeProjet }) => {
  return (
    <div className="tpi-slot">
      <div className="time">
        <p>Début : {startTime}</p>
        <p>Fin : {endTime}</p>
      </div>
      <div className="tpi-card">
        <TPICard candidat={candidat} expert1={expert1} expert2={expert2} chefDeProjet={chefDeProjet} />
      </div>
    </div>
  );
};

export default TPISlot;
