// DateRoom.js
import React from 'react';
import TPISlot from './TpiSlot';
import BreakLine from './BreakLine';
import '../css/componentsStyles.css';
const DateRoom = ({ date, name, site, numSlots = 8, breakDuration = 10, tpiData, onDelete, isEditOfRoom, onUpdateTpi }) => {
  const slots = Array(numSlots).fill(null);

  return (
    <div className='room'>
      <div className={`date-room site_${site.toLowerCase()}`}>
        <div className='date'>{date}</div>
        <div className='nameRoom'>Room: {name}</div>
        {slots.map((_, index) => {
          const tpi = tpiData[index] || {}; // Récupère le TPI correspondant à l'index s'il existe, sinon utilise un objet vide

          return (
            <React.Fragment key={index}>
              <TPISlot
                startTime={tpi.startTime}
                endTime={tpi.endTime}
                candidat={tpi.candidat}
                expert1={tpi.expert1}
                expert2={tpi.expert2}
                boss={tpi.boss}
                //onUpdateTpi={(tpiIndex, updatedTpi) => handleUpdateTpi(index, tpiIndex, updatedTpi)}
                onUpdateTpi={(updatedTpi) => onUpdateTpi(index, updatedTpi)}
                isEditTPISlot={isEditOfRoom}
              />
              {index !== numSlots - 1 && <BreakLine duration={breakDuration} />}
            </React.Fragment>
          );
        })}
      </div>
      <div className='buttonDelete'>
        <button onClick={onDelete}>Supprimer</button>
      </div>
    </div>
  );
};

export default DateRoom;
