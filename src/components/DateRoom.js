import React from 'react';
import TPISlot from './TpiSlot';
import BreakLine from './BreakLine';
import '../css/componentsStyles.css'

const DateRoom = ({ date, room, numSlots = 8, breakDuration = 10, site, onDelete }) => {
  const slots = Array(numSlots).fill(null);

  return (
    <div className='room'>
      <div className={`date-room site_${site.toLowerCase()}`}>
        <div className='date'>{date}</div>
        <div className='nameRoom'>Room: {room}</div>
        {slots.map((_, index) => (
          <React.Fragment key={index}>
            <TPISlot site={site} />
            {index !== slots.length - 1 && <BreakLine duration={breakDuration} />}
          </React.Fragment>
        ))}
      </div>
      <div className='buttonDelete'>
          <button onClick={onDelete}>Supprimer</button>
        </div>
    </div>


  );
};

export default DateRoom;
