import React, { useEffect, useRef, useState } from 'react'
import { useDrop } from 'react-dnd'

import TpiCard from './TpiCard'
import { ItemTypes } from './Constants'
import { createEmptyTpi, isTpiPlanningSealed } from './tpiScheduleData'
import { LockIcon, RefreshIcon } from '../shared/InlineIcons'

const compactText = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

const tpiHasVisibleContent = (tpi) => Boolean(
  compactText(tpi?.refTpi) ||
  compactText(tpi?.candidat) ||
  compactText(tpi?.expert1?.name) ||
  compactText(tpi?.expert2?.name) ||
  compactText(tpi?.boss?.name) ||
  compactText(tpi?.sujet) ||
  compactText(tpi?.description)
)

const TpiSlot = ({
  tpiData,
  isEditTPICard,
  timeValues,
  onUpdateTpi,
  onSwapTpiCardsProp,
  onDropUnassignedTpi,
  swapAssistState = '',
  isSwapAssistActive = false,
  onSelectTpiForSwap = null,
  onAssistedSwapToSlot = null,
  detailLevel = 2,
  roomSite = '',
  roomName = '',
  roomDate = '',
  roomPeriod = null,
  roomScheduleContext = null,
  peopleRegistry = [],
  stakeholderShortIdHints = {},
  soutenanceDates = [],
  validationMarker = null,
  tpiSyncEntry = null,
  onSyncTpiFromGestion = null
}) => {
  const safeTpiData = tpiData || createEmptyTpi()
  const [isSealMenuOpen, setIsSealMenuOpen] = useState(false)
  const [sealMenuPosition, setSealMenuPosition] = useState({ left: 8, top: 34 })
  const slotRef = useRef(null)
  const sealMenuRef = useRef(null)
  const isPlanningSealed = isTpiPlanningSealed(safeTpiData)
  const hasVisibleTpi = tpiHasVisibleContent(safeTpiData)
  const canTogglePlanningSeal = hasVisibleTpi && typeof onUpdateTpi === 'function'
  const shouldShowSealButton = canTogglePlanningSeal && (isEditTPICard || isPlanningSealed)
  const sealActionLabel = isPlanningSealed ? 'Déverrouiller ce TPI' : 'Verrouiller ce TPI'
  const sealActionTitle = isPlanningSealed
    ? 'TPI scellé: les déplacements manuels et les optimisations ne peuvent pas le bouger.'
    : 'Sceller ce TPI pour empêcher tout déplacement manuel ou automatique.'
  const normalizedSwapAssistState = ['source', 'target', 'warning', 'blocked'].includes(swapAssistState)
    ? swapAssistState
    : ''
  const canUseAssistedSwapTarget =
    isSwapAssistActive &&
    normalizedSwapAssistState &&
    !isPlanningSealed &&
    !['source', 'blocked'].includes(normalizedSwapAssistState)
  const hasTpiSyncDifference = Boolean(tpiSyncEntry)
  const syncTitle = hasTpiSyncDifference
    ? `Synchroniser ${tpiSyncEntry.refTpi || safeTpiData.refTpi || 'ce TPI'} depuis GestionTPI${
        Array.isArray(tpiSyncEntry.changedLabels) && tpiSyncEntry.changedLabels.length > 0
          ? `: ${tpiSyncEntry.changedLabels.join(', ')}`
          : ''
      }`
    : ''

  const handleUpdateTpiCard = updatedTpi => {
    // Mettre à jour l'état local si nécessaire
    onUpdateTpi(updatedTpi) // Propager l'update à DateRoom
  }

  const handleTogglePlanningSeal = (event) => {
    event?.preventDefault?.()
    event?.stopPropagation?.()

    if (!canTogglePlanningSeal) {
      return
    }

    onUpdateTpi({
      ...safeTpiData,
      isPlanningSealed: !isPlanningSealed
    })
    setIsSealMenuOpen(false)
  }

  const getContextMenuPosition = (event) => {
    const rect = slotRef.current?.getBoundingClientRect?.()

    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return { left: 8, top: 34 }
    }

    const menuWidth = 206
    const menuHeight = 44
    const rawLeft = Number(event.clientX) - rect.left
    const rawTop = Number(event.clientY) - rect.top
    const maxLeft = Math.max(8, rect.width - menuWidth)
    const maxTop = Math.max(8, rect.height - menuHeight)

    return {
      left: Math.round(Math.max(8, Math.min(rawLeft, maxLeft))),
      top: Math.round(Math.max(8, Math.min(rawTop, maxTop)))
    }
  }

  const handleSlotContextMenu = (event) => {
    if (!canTogglePlanningSeal) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setSealMenuPosition(getContextMenuPosition(event))
    setIsSealMenuOpen(true)
  }

  useEffect(() => {
    if (!isSealMenuOpen) {
      return undefined
    }

    const handleClickOutside = (event) => {
      if (sealMenuRef.current?.contains(event.target)) {
        return
      }

      setIsSealMenuOpen(false)
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsSealMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isSealMenuOpen])

  const handleSelectOrSwap = (event) => {
    event?.preventDefault?.()
    event?.stopPropagation?.()

    if (isPlanningSealed) {
      return
    }

    if (canUseAssistedSwapTarget) {
      if (typeof onAssistedSwapToSlot === 'function') {
        onAssistedSwapToSlot(safeTpiData.id)
      }
      return
    }

    if (isSwapAssistActive && normalizedSwapAssistState === 'blocked') {
      return
    }

    if (
      !isEditTPICard &&
      hasVisibleTpi &&
      typeof onSelectTpiForSwap === 'function'
    ) {
      onSelectTpiForSwap({
        tpi: safeTpiData,
        slotId: safeTpiData.id
      })
    }
  }

  const handleSlotClick = () => {
    if (isPlanningSealed) {
      return
    }

    if (canUseAssistedSwapTarget && typeof onAssistedSwapToSlot === 'function') {
      onAssistedSwapToSlot(safeTpiData.id)
    }
  }

  const [{ isOver }, dropRef] = useDrop({
    accept: ItemTypes.TPI_CARD,
    drop: item => {
      if (isPlanningSealed || isTpiPlanningSealed(item?.tpi)) {
        return
      }

      if (item?.source === 'unassigned') {
        if (typeof onDropUnassignedTpi === 'function') {
          onDropUnassignedTpi(item.tpi, safeTpiData.id)
        }
        return
      }

      const draggedTpi = item?.tpi?.id
      if (!draggedTpi || !safeTpiData.id) {
        return
      }
      if (typeof onSwapTpiCardsProp === 'function') {
        onSwapTpiCardsProp(draggedTpi, safeTpiData.id)
      }
    },
    collect: monitor => ({
      isOver: monitor.isOver()
    })
  })

  const setSlotNode = (node) => {
    slotRef.current = node
    if (typeof dropRef === 'function') {
      dropRef(node)
    }
  }

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
      ref={setSlotNode}
      className={`tpiSlot detail-level-${detailLevel} ${isOver ? 'dragOver' : ''} ${
        hasTpiSyncDifference ? 'has-sync-diff' : ''
      } ${
        normalizedSwapAssistState ? `swap-assist-${normalizedSwapAssistState}` : ''
      } ${
        isPlanningSealed ? 'is-planning-sealed' : ''
      }`.trim()}
      id={`green-${tpiIsValidatedForAll}`}
      data-swap-assist-state={normalizedSwapAssistState}
      data-planning-sealed={isPlanningSealed ? 'true' : undefined}
      onClick={handleSlotClick}
      onContextMenu={handleSlotContextMenu}
    >
      <div className={`timeSlot ${shouldShowSealButton ? 'has-seal-control' : ''}`.trim()}>
        <p className='top'>{timeValues[0]}</p>
        <p className='bottom'>{timeValues[1]}</p>
        {shouldShowSealButton ? (
          <button
            type='button'
            className={`tpi-slot-seal-button ${isPlanningSealed ? 'is-sealed' : ''}`}
            onClick={handleTogglePlanningSeal}
            aria-pressed={isPlanningSealed}
            aria-label={sealActionLabel}
            title={sealActionTitle}
          >
            <LockIcon />
          </button>
        ) : null}
        {isEditTPICard && hasTpiSyncDifference ? (
          <button
            type='button'
            className='tpi-slot-sync-button'
            onClick={onSyncTpiFromGestion}
            aria-label={syncTitle}
            title={syncTitle}
            disabled={typeof onSyncTpiFromGestion !== 'function'}
          >
            <RefreshIcon />
          </button>
        ) : null}
      </div>
      {isSealMenuOpen ? (
        <div
          ref={sealMenuRef}
          className='tpi-slot-context-menu'
          role='menu'
          style={{
            left: `${sealMenuPosition.left}px`,
            top: `${sealMenuPosition.top}px`
          }}
        >
          <button
            type='button'
            className={`tpi-slot-context-menu-item ${isPlanningSealed ? 'is-sealed' : ''}`}
            onClick={handleTogglePlanningSeal}
            role='menuitem'
          >
            <LockIcon />
            <span>{sealActionLabel}</span>
          </button>
        </div>
      ) : null}
      <TpiCard
        tpi={safeTpiData}
        isEditingTpiCard={isEditTPICard}
        onUpdateTpi={handleUpdateTpiCard}
        detailLevel={detailLevel}
        roomSite={roomSite}
        roomName={roomName}
        roomDate={roomDate}
        roomPeriod={roomPeriod ?? safeTpiData?.period}
        roomScheduleContext={roomScheduleContext}
        peopleRegistry={peopleRegistry}
        stakeholderShortIdHints={stakeholderShortIdHints}
        soutenanceDates={soutenanceDates}
        hasValidationError={Boolean(validationMarker?.hasError)}
        hasValidationWarning={Boolean(validationMarker?.hasWarning)}
        validationIssueTypes={Array.isArray(validationMarker?.issueTypes) ? validationMarker.issueTypes : []}
        primaryValidationIssueType={validationMarker?.primaryIssueType || ''}
        validationTone={validationMarker?.tone || ''}
        validationErrorMessages={Array.isArray(validationMarker?.messages) ? validationMarker.messages : []}
        isSwapSelected={normalizedSwapAssistState === 'source'}
        isSwapCandidate={canUseAssistedSwapTarget}
        onActivateTpi={handleSelectOrSwap}
      />
    </div>
  )
}
export default TpiSlot
