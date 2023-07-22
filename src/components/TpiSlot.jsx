import React from 'react';
import { useDrop } from 'react-dnd';
import TpiCard from './TpiCard';
import { ItemTypes } from './Constants';

const TpiSlot = ({ tpiData, isEditTPICard, timeValues, onUpdateTpi, onSwapTpiCardsProp }) => {

  // Utiliser l'ID TPI généré pour le TpiSlot
  const handleUpdateTpiCard = (updatedTpi) => {
    onUpdateTpi(updatedTpi);
  };

  const [{ isOver }, dropRef] = useDrop({
    accept: ItemTypes.TPI_CARD,
    drop: (item) => {
      console.log("drop called with:", item.tpi.id);
      const draggedTpi = item.tpi.id;
      console.log("drop called with:", tpiData.id);
      onSwapTpiCardsProp(draggedTpi, tpiData.id);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  return (
    <div ref={dropRef} className={`tpiSlot ${isOver ? 'dragOver' : ''}`}>
      <div className="timeSlot">
        <p className="top">{timeValues[0]}</p>
        <p className="bottom">{timeValues[1]}</p>
      </div>
      <TpiCard
        tpi={tpiData}
        isEditingTpiCard={isEditTPICard}
        onUpdateTpi={handleUpdateTpiCard}
      />
    </div>
  );
};
export default TpiSlot;
