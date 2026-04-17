import React from 'react'
import { useDrop } from 'react-dnd'

import TpiCard from './TpiCard'
import { ItemTypes } from './Constants'
import { createEmptyTpi } from './tpiScheduleData'

const TpiSlot = ({
  tpiData,
  isEditTPICard,
  timeValues,
  onUpdateTpi,
  onSwapTpiCardsProp,
  detailLevel = 2,
  roomSite = '',
  roomName = '',
  roomDate = '',
  peopleRegistry = [],
  stakeholderShortIdHints = {},
  soutenanceDates = [],
  validationMarker = null
}) => {
  const safeTpiData = tpiData || createEmptyTpi()

  const handleUpdateTpiCard = updatedTpi => {
    // Mettre à jour l'état local si nécessaire
    onUpdateTpi(updatedTpi) // Propager l'update à DateRoom
  }

  const [{ isOver }, dropRef] = useDrop({
    accept: ItemTypes.TPI_CARD,
    drop: item => {
      const draggedTpi = item?.tpi?.id
      if (!draggedTpi || !safeTpiData.id) {
        return
      }
      onSwapTpiCardsProp(draggedTpi, safeTpiData.id)
    },
    collect: monitor => ({
      isOver: monitor.isOver()
    })
  })

  // permet d'ajout un encadrage vert afin de visualiser les tpi acceptés
  const isExpert1Validated =
    safeTpiData.expert1?.offres?.isValidated
  const isExpert2Validated =
    safeTpiData.expert2?.offres?.isValidated
  const isBossValidated = safeTpiData.boss?.offres?.isValidated

  // Vérifier que toutes les propriétés isValidated existent et sont true
  const tpiIsValidatedForAll =
    isExpert1Validated && isExpert2Validated && isBossValidated

  return (
    <div
      ref={dropRef}
      className={`tpiSlot detail-level-${detailLevel} ${isOver ? 'dragOver' : ''}`}
      id={`green-${tpiIsValidatedForAll}`}
    >
      <div className={`timeSlot`}>
        <p className='top'>{timeValues[0]}</p>
        <p className='bottom'>{timeValues[1]}</p>
      </div>
      <TpiCard
        tpi={safeTpiData}
        isEditingTpiCard={isEditTPICard}
        onUpdateTpi={handleUpdateTpiCard}
        detailLevel={detailLevel}
        roomSite={roomSite}
        roomName={roomName}
        roomDate={roomDate}
        peopleRegistry={peopleRegistry}
        stakeholderShortIdHints={stakeholderShortIdHints}
        soutenanceDates={soutenanceDates}
        hasValidationError={Boolean(validationMarker?.hasError)}
        validationErrorMessages={Array.isArray(validationMarker?.messages) ? validationMarker.messages : []}
      />
    </div>
  )
}
export default TpiSlot
