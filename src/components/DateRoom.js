import React from "react";
import TpiSlot from "./TpiSlot";
import BreakLine from "./BreakLine";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import "../css/componentsStyles.css";

const DateRoom = ({
  date,
  roomIndex,
  name,
  site,
  tpiData,
  onDelete,
  isEditOfRoom,
  onUpdateTpi,
  siteData,
  onSwapTpiCards,
}) => {
  // Fonction pour générer l'ID TPI en fonction de la position (site, room et slots)
  const generateUniqueID = (siteIndex, roomIndex, slotIndex) => {
    return `${siteIndex}_${roomIndex}_${slotIndex}`;
  };

  const numSlots = siteData.numSlots;
  const slots = Array(numSlots).fill(null);

  const breakDurationMinutes = Math.floor(siteData.breakline * 60); // Durée de la pause en minutes
  const tpiDurationMinutes = siteData.tpiTime * 60; // Durée du TPI en minutes
  const firstTpiStartHour = siteData.firstTpiStart; // Heure de début du premier TPI en heures décimales

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="room">
        <div className={`date-room site_${site.toLowerCase()}`}>
          <div className="date">{date}</div>
          <div className="nameRoom">Room: {name}</div>
          {slots.map((_, index) => {
            // Appeler la fonction generateUniqueID pour générer l'ID TPI
            const tpiID = generateUniqueID(site, roomIndex, index);

            const tpi = tpiData[index] || {}; // Récupère le TPI correspondant à l'index s'il existe, sinon utilise un objet vide

            const startTimeMinutes = Math.floor(
              index * (tpiDurationMinutes + breakDurationMinutes) +
                firstTpiStartHour * 60
            );
            const endTimeMinutes = startTimeMinutes + tpiDurationMinutes;

            const startTimeHours = Math.floor(startTimeMinutes / 60)
              .toString()
              .padStart(2, "0");
            const startTimeMinutesFormatted = (startTimeMinutes % 60)
              .toString()
              .padStart(2, "0");
            const endTimeHours = Math.floor(endTimeMinutes / 60)
              .toString()
              .padStart(2, "0");
            const endTimeMinutesFormatted = (endTimeMinutes % 60)
              .toString()
              .padStart(2, "0");

            const startTime = `${startTimeHours}:${startTimeMinutesFormatted}`;
            const endTime = `${endTimeHours}:${endTimeMinutesFormatted}`;

            return (
              <React.Fragment key={index}>
                <TpiSlot
                  tpiID={tpiID}
                  slotIndex={index}
                  roomIndex={roomIndex}
                  tpiData={tpiData}
                  startTime={startTime}
                  endTime={endTime}
                  candidat={tpi.candidat}
                  expert1={tpi.expert1}
                  expert2={tpi.expert2}
                  onUpdateTpi={(updatedTpi) => onUpdateTpi(index, updatedTpi)}
                  isEditTPISlot={isEditOfRoom}
                  onSwapTpiCardsProp={onSwapTpiCards}
                />
                {index !== numSlots - 1 && (
                  <BreakLine duration={breakDurationMinutes} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div className="buttonDelete">
          <button onClick={onDelete}>Supprimer</button>
        </div>
      </div>
    </DndProvider>
  );
};

export default DateRoom;
