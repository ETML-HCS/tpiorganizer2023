import React from 'react'
import { useDrop } from 'react-dnd'

import TpiCard from './tpiCard'
import { ItemTypes } from './constants'

const TpiSlot = ({
  tpiData,
  isEditTPICard,
  timeValues,
  onUpdateTpi,
  onSwapTpiCardsProp
}) => {
  const handleUpdateTpiCard = updatedTpi => {
    // Mettre à jour l'état local si nécessaire
    onUpdateTpi(updatedTpi) // Propager l'update à DateRoom
  }

  const [{ isOver }, dropRef] = useDrop({
    accept: ItemTypes.TPI_CARD,
    drop: item => {
      console.log('drop called with:', item.tpi.id)
      const draggedTpi = item.tpi.id
      console.log('drop called with:', tpiData.id)
      onSwapTpiCardsProp(draggedTpi, tpiData.id)
    },
    collect: monitor => ({
      isOver: monitor.isOver()
    })
  })

  // permet d'ajout un encadrage vert afin de visualiser les tpi acceptés
  const isExpert1Validated =
    tpiData.expert1.offres && tpiData.expert1.offres.isValidated
  const isExpert2Validated =
    tpiData.expert2.offres && tpiData.expert2.offres.isValidated
  const isBossValidated = tpiData.boss.offres && tpiData.boss.offres.isValidated

  // Vérifier que toutes les propriétés isValidated existent et sont true
  const tpiIsValidatedForAll =
    isExpert1Validated && isExpert2Validated && isBossValidated

  return (
    <div
      ref={dropRef}
      className={`tpiSlot ${isOver ? 'dragOver' : ''}`}
      id={`green-${tpiIsValidatedForAll}`}
    >
      <div className={`timeSlot`}>
        <p className='top'>{timeValues[0]}</p>
        <p className='bottom'>{timeValues[1]}</p>
        <span>{}</span>
      </div>
      <TpiCard
        tpi={tpiData}
        isEditingTpiCard={isEditTPICard}
        onUpdateTpi={handleUpdateTpiCard}
      />
    </div>
  )
}
export default TpiSlot
