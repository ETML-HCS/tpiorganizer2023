import React from 'react'
import TpiSlot from './tpiSlot'
import BreakLine from './breakLine'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

import '../../css/tpiShedule/tpiSheduleStyle.css'

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

const DateRoom = ({
  roomData,
  roomIndex,
  onDelete,
  isEditOfRoom,
  onUpdateTpi,
  onSwapTpiCards
}) => {
  // Fonction pour générer l'ID TPI en fonction de la position (site, room et slots)
  const generateUniqueID = (siteIndex, roomIndex, slotIndex) => {
    return `${siteIndex}_${roomIndex}_${slotIndex}`
  }

  const numSlots = roomData.configSite.numSlots
  const slots = Array(numSlots).fill(null)

  const breakDurationMinutes = Math.floor(roomData.configSite.breakline * 60) // Durée de la pause en minutes
  const tpiDurationMinutes = roomData.configSite.tpiTime * 60 // Durée du TPI en minutes
  const firstTpiStartHour = roomData.configSite.firstTpiStart // Heure de début du premier TPI en heures décimales

  const formattedDate = format(
    new Date(roomData.date),
    "'" +
    capitalizeFirstLetter(
      format(new Date(roomData.date), 'EEEE', { locale: fr })
    ) +
    "' dd-MM-yyyy",
    { locale: fr }
  )

  return (
    <DndProvider backend={HTML5Backend}>
      <div className='room'>
        <div className={`date-room site_${roomData.site.toLowerCase()}`}>
          <div className='date'>{formattedDate}</div>
          <div className='nameRoom'>{roomData.name}</div>

          {slots.map((_, iSlot) => {
            // Appeler la fonction generateUniqueID pour générer l'ID TPI
            const tpiID = generateUniqueID(
              roomData.site.toLowerCase(),
              roomIndex,
              iSlot
            )
            
            roomData.tpiDatas[iSlot].id = tpiID
            const tpi = roomData.tpiDatas[iSlot]

            const startTimeMinutes = Math.floor(
              iSlot * (tpiDurationMinutes + breakDurationMinutes) +
              firstTpiStartHour * 60
            )
            const endTimeMinutes = startTimeMinutes + tpiDurationMinutes

            const startTimeHours = Math.floor(startTimeMinutes / 60)
              .toString()
              .padStart(2, '0')
            const startTimeMinutesFormatted = (startTimeMinutes % 60)
              .toString()
              .padStart(2, '0')
            const endTimeHours = Math.floor(endTimeMinutes / 60)
              .toString()
              .padStart(2, '0')
            const endTimeMinutesFormatted = (endTimeMinutes % 60)
              .toString()
              .padStart(2, '0')

            const startTime = `${startTimeHours}:${startTimeMinutesFormatted}`
            const endTime = `${endTimeHours}:${endTimeMinutesFormatted}`

            return (
              <React.Fragment key={iSlot}>
                <TpiSlot
                  timeValues={[startTime, endTime]}
                  tpiData={tpi}
                  onUpdateTpi={updatedTpi => onUpdateTpi(iSlot, updatedTpi)}
                  isEditTPICard={isEditOfRoom}
                  onSwapTpiCardsProp={onSwapTpiCards}
                />
                {iSlot !== numSlots - 1 && (
                  <BreakLine duration={breakDurationMinutes} />
                )}
              </React.Fragment>
            )
          })}
        </div>
        <div className='buttonDelete'>
          <button onClick={onDelete}>Supprimer</button>
        </div>
      </div>
    </DndProvider>
  )
}

export default DateRoom
