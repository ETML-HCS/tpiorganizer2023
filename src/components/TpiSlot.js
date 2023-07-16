import React from 'react';
import TPICard from './TpiCard';

const TPISlot = ({ startTime, endTime, candidat, expert1, expert2, boss }) => {
  return (
    <div className="tpiSlot">
      <div className="timeSlot">
        <p className='top' >Début : {startTime}</p>
        <p className='bottom' >Fin : {endTime}</p>
      </div>
      <div className="tpiCard">
        <TPICard candidat={candidat} expert1={expert1} expert2={expert2} boss={boss} />
      </div>
    </div>
  );
};

export default TPISlot;
