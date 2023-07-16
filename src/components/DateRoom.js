import React from 'react';
import TPISlot from './TpiSlot';
import BreakLine from './BreakLine';

const DateRoom = ({ date, room, numSlots = 8, breakDuration = 10, onDelete }) => {
 
  const slots = Array(numSlots).fill(null);

  return (
    <div className="date-room">
      <h3>{date}</h3>
      <p>Room: {room}</p>
      {slots.map((_, index) => (
        <React.Fragment key={index}>
          <TPISlot />
          {index !== slots.length - 1 && <BreakLine duration={breakDuration} />}
        </React.Fragment>
      ))}
      <button onClick={onDelete}>Supprimer</button>
    </div>
  );
};

export default DateRoom;
