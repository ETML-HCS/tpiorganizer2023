import React, { useEffect, useMemo, useRef, useState } from 'react'

import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

import TpiSlot from './TpiSlot'
import BreakLine from './BreakLine'
import {
  createEmptyTpi
} from './tpiScheduleData'
import {
  normalizeSoutenanceDateEntries
} from './soutenanceDateUtils'
import {
  inferRoomClassMode
} from './tpiScheduleFilters'
import {
  buildPlanningSlotKey
} from './tpiScheduleValidationMarkers'
import { CheckIcon, PencilIcon, TrashIcon } from '../shared/InlineIcons'

import '../../css/tpiShedule/tpiSheduleStyle.css'


function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

const DEFAULT_SITE_PLANNING_COLORS = [
  '#1D4ED8',
  '#0F766E',
  '#BE185D',
  '#7C3AED',
  '#C2410C',
  '#0891B2',
  '#4F46E5',
  '#65A30D'
]

function toDateInputValue(dateValue) {
  if (!dateValue) {
    return ''
  }

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().slice(0, 10)
}

function normalizeRoomNameKey(value) {
  return String(value || '').trim().toLowerCase()
}

function resolveMinutes(value, legacyHoursValue, fallbackMinutes) {
  const normalizedMinutes = String(value ?? '').trim()
  const directMinutes = normalizedMinutes === '' ? Number.NaN : Number(normalizedMinutes)
  if (Number.isFinite(directMinutes) && directMinutes >= 0) {
    return directMinutes
  }

  const normalizedLegacyHours = String(legacyHoursValue ?? '').trim()
  const legacyHours = normalizedLegacyHours === '' ? Number.NaN : Number(normalizedLegacyHours)
  if (Number.isFinite(legacyHours) && legacyHours >= 0) {
    return Math.round(legacyHours * 60)
  }

  return fallbackMinutes
}

function resolveStartTimeMinutes(timeValue, legacyHourValue, fallbackMinutes) {
  const normalizedTime = String(timeValue || '').trim()
  if (/^\d{1,2}:\d{2}$/.test(normalizedTime)) {
    const [hoursPart, minutesPart] = normalizedTime.split(':')
    const hours = Number.parseInt(hoursPart, 10)
    const minutes = Number.parseInt(minutesPart, 10)

    if (Number.isInteger(hours) && Number.isInteger(minutes) && hours >= 0 && minutes >= 0 && minutes < 60) {
      return hours * 60 + minutes
    }
  }

  const legacyHours = Number(legacyHourValue)
  if (Number.isFinite(legacyHours) && legacyHours >= 0) {
    return Math.round(legacyHours * 60)
  }

  return fallbackMinutes
}

function normalizePlanningColor(value) {
  const hex = String(value || '').trim().replace(/^#/, '')

  if (/^[\da-fA-F]{3}$/.test(hex)) {
    return `#${hex
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toUpperCase()}`
  }

  if (/^[\da-fA-F]{6}$/.test(hex)) {
    return `#${hex.toUpperCase()}`
  }

  return ''
}

function getDefaultPlanningColor(seed = '', fallbackIndex = 0) {
  const normalizedSeed = String(seed || '').trim().toUpperCase()

  if (!normalizedSeed) {
    return DEFAULT_SITE_PLANNING_COLORS[Math.abs(Number(fallbackIndex) || 0) % DEFAULT_SITE_PLANNING_COLORS.length]
  }

  let hash = 0
  for (const character of normalizedSeed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return DEFAULT_SITE_PLANNING_COLORS[hash % DEFAULT_SITE_PLANNING_COLORS.length]
}

function hexToRgba(color, alpha = 1) {
  const normalizedColor = normalizePlanningColor(color)
  if (!normalizedColor) {
    return `rgba(37, 99, 235, ${alpha})`
  }

  const hex = normalizedColor.slice(1)
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function parseHexColor(color) {
  const normalizedColor = normalizePlanningColor(color)
  if (!normalizedColor) {
    return null
  }

  const hex = normalizedColor.slice(1)
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16)
  }
}

function toHexChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()
}

function rgbToHex({ red, green, blue }) {
  return `#${toHexChannel(red)}${toHexChannel(green)}${toHexChannel(blue)}`
}

function mixHexColors(baseColor, targetColor, targetWeight = 0.5) {
  const base = parseHexColor(baseColor)
  const target = parseHexColor(targetColor)

  if (!base || !target) {
    return normalizePlanningColor(baseColor) || normalizePlanningColor(targetColor) || ''
  }

  const safeTargetWeight = Math.max(0, Math.min(1, Number(targetWeight) || 0))
  const baseWeight = 1 - safeTargetWeight

  return rgbToHex({
    red: base.red * baseWeight + target.red * safeTargetWeight,
    green: base.green * baseWeight + target.green * safeTargetWeight,
    blue: base.blue * baseWeight + target.blue * safeTargetWeight
  })
}

function getColorBrightness(color) {
  const rgb = parseHexColor(color)
  if (!rgb) {
    return 0
  }

  return rgb.red * 0.299 + rgb.green * 0.587 + rgb.blue * 0.114
}

function getRoomThemeTextColor(color) {
  const normalizedColor = normalizePlanningColor(color)
  if (!normalizedColor) {
    return '#FFFFFF'
  }

  const brightness = getColorBrightness(normalizedColor)

  return brightness >= 170 ? '#0F172A' : '#FFFFFF'
}

function getContrastingTpiColor(roomColor) {
  const accent = normalizePlanningColor(roomColor) || '#2563EB'
  const brightness = getColorBrightness(accent)

  return brightness >= 170
    ? mixHexColors(accent, '#0F172A', 0.68)
    : mixHexColors(accent, '#FFFFFF', 0.82)
}

function buildTpiPalette(accent, tpiColor) {
  const tpiAccent = normalizePlanningColor(tpiColor) || getContrastingTpiColor(accent)
  const candidateBg = tpiAccent
  const expertsBg = mixHexColors(tpiAccent, accent, 0.10)
  const bossBg = mixHexColors(tpiAccent, accent, 0.18)
  const textColor = getRoomThemeTextColor(expertsBg)

  return {
    '--site-textColor': textColor,
    '--tpi-card-candidat-bgColor': candidateBg,
    '--tpi-card-experts-bgColor': expertsBg,
    '--tpi-card-boss-bgColor': bossBg
  }
}

function buildRoomThemeStyle(siteCode, planningColor, tpiColor) {
  const normalizedSiteCode = String(siteCode || '').trim().toUpperCase()
  const explicitColor = normalizePlanningColor(planningColor)
  const explicitTpiColor = normalizePlanningColor(tpiColor)

  if (!explicitColor && !explicitTpiColor && ['ETML', 'CFPV'].includes(normalizedSiteCode)) {
    return undefined
  }

  const accent = explicitColor || getDefaultPlanningColor(normalizedSiteCode)
  const textColor = getRoomThemeTextColor(accent)
  const metaTextColor =
    textColor === '#0F172A'
      ? 'rgba(15, 23, 42, 0.72)'
      : 'rgba(255, 255, 255, 0.82)'

  return {
    '--dateRoom-bgColor': accent,
    '--dateRoom-textColor': textColor,
    '--dateRoom-metaTextColor': metaTextColor,
    '--breakLine-TextColor': accent,
    '--breakLine-lineColorStart': hexToRgba(accent, 0.08),
    '--breakLine-lineColorEnd': hexToRgba(accent, 0.28),
    '--breakLine-badgeBorderColor': hexToRgba(accent, 0.22),
    '--breakLine-badgeBgColor': 'rgba(255, 255, 255, 0.94)',
    '--tpi-timeSlot-textColor': '#0F172A',
    ...buildTpiPalette(accent, explicitTpiColor)
  }
}

const DateRoom = ({
  roomData,
  roomIndex,
  onDelete,
  onUpdateRoom,
  isEditOfRoom,
  onUpdateTpi,
  onSwapTpiCards,
  tpiCardDetailLevel = 2,
  peopleRegistry = [],
  stakeholderShortIdHints = {},
  soutenanceDates = [],
  roomCatalogBySite = {},
  allRooms = [],
  validationMarkersBySlotKey = {}
}) => {
  // Fonction pour générer l'ID TPI en fonction de la position (site, room et slots)
  const generateUniqueID = (siteIndex, roomIndex, slotIndex) => {
    return `${siteIndex}_${roomIndex}_${slotIndex}`
  }

  const safeRoomData = roomData || {}
  const safeConfigSite = safeRoomData.configSite || {
    breaklineMinutes: 10,
    tpiTimeMinutes: 60,
    firstTpiStartTime: '08:00',
    breakline: 0.1667,
    tpiTime: 1,
    firstTpiStart: 8,
    numSlots: 8
  }
  const numSlots =
    Number.isInteger(safeConfigSite.numSlots) && safeConfigSite.numSlots > 0
      ? safeConfigSite.numSlots
      : 8
  const slots = Array(numSlots).fill(null)

  const breakDurationMinutes = resolveMinutes(
    safeConfigSite.breaklineMinutes,
    safeConfigSite.breakline,
    10
  )
  const tpiDurationMinutes = resolveMinutes(
    safeConfigSite.tpiTimeMinutes,
    safeConfigSite.tpiTime,
    60
  )
  const firstTpiStartMinutes = resolveStartTimeMinutes(
    safeConfigSite.firstTpiStartTime,
    safeConfigSite.firstTpiStart,
    8 * 60
  )

  const parsedDate = new Date(safeRoomData.date)
  const formattedDate = Number.isNaN(parsedDate.getTime())
    ? 'Date invalide'
    : format(
        parsedDate,
        "'" +
          capitalizeFirstLetter(format(parsedDate, 'EEEE', { locale: fr })) +
          "' dd-MM-yyyy",
        { locale: fr }
      )

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isEditingRoom, setIsEditingRoom] = useState(false)
  const [draftName, setDraftName] = useState(safeRoomData.name || '')
  const [draftDate, setDraftDate] = useState(toDateInputValue(safeRoomData.date))
  const menuRef = useRef(null)
  const dateInputRef = useRef(null)
  const roomSelectRef = useRef(null)
  const normalizedSoutenanceDates = useMemo(
    () => normalizeSoutenanceDateEntries(soutenanceDates),
    [soutenanceDates]
  )
  const roomDateKey = toDateInputValue(safeRoomData.date)
  const roomDateEntry = useMemo(
    () => normalizedSoutenanceDates.find((entry) => entry.date === roomDateKey),
    [normalizedSoutenanceDates, roomDateKey]
  )
  const roomClassMode = useMemo(() => inferRoomClassMode({
    roomName: safeRoomData.name,
    roomDateEntry,
    allowedPrefixes: Array.isArray(roomDateEntry?.classes) ? roomDateEntry.classes : []
  }), [roomDateEntry, safeRoomData.name])
  const roomClassBadgeLabel = useMemo(
    () => (roomClassMode === 'matu' ? 'MATU' : ''),
    [roomClassMode]
  )
  const roomThemeStyle = useMemo(
    () => buildRoomThemeStyle(safeRoomData.site, safeConfigSite.planningColor, safeConfigSite.tpiColor),
    [safeConfigSite.planningColor, safeConfigSite.tpiColor, safeRoomData.site]
  )
  const selectedDateKey = toDateInputValue(draftDate || safeRoomData.date)
  const occupiedRoomNameKeys = useMemo(() => {
    const siteKey = String(safeRoomData.site || '').trim().toUpperCase()
    if (!siteKey || !selectedDateKey) {
      return new Set()
    }

    const rooms = Array.isArray(allRooms) ? allRooms : []
    const usedNames = new Set()

    rooms.forEach((room, index) => {
      const sameRoom =
        (safeRoomData.idRoom !== undefined && room?.idRoom === safeRoomData.idRoom) ||
        (safeRoomData.idRoom === undefined && index === roomIndex)

      if (sameRoom) {
        return
      }

      const roomSiteKey = String(room?.site || '').trim().toUpperCase()
      const roomDateKey = toDateInputValue(room?.date)
      const roomNameKey = normalizeRoomNameKey(room?.name || room?.nameRoom)

      if (!roomNameKey) {
        return
      }

      if (roomSiteKey === siteKey && roomDateKey === selectedDateKey) {
        usedNames.add(roomNameKey)
      }
    })

    return usedNames
  }, [allRooms, roomIndex, safeRoomData.date, safeRoomData.idRoom, safeRoomData.site, selectedDateKey])

  const availableRoomNames = useMemo(() => {
    const siteKey = String(safeRoomData.site || '').trim().toUpperCase()
    const rooms = Array.isArray(roomCatalogBySite?.[siteKey]) ? roomCatalogBySite[siteKey] : []
    const normalizedRooms = Array.from(
      new Set(rooms.map((room) => String(room || '').trim()).filter(Boolean))
    )
    const filteredRooms = normalizedRooms.filter(
      (roomName) => !occupiedRoomNameKeys.has(normalizeRoomNameKey(roomName))
    )

    const currentName = String(draftName || safeRoomData.name || '').trim()
    if (!currentName) {
      return filteredRooms
    }

    const availableNames = [currentName, ...filteredRooms]
    const dedupedNames = []
    const seen = new Set()

    availableNames.forEach((roomName) => {
      const key = normalizeRoomNameKey(roomName)
      if (!key || seen.has(key)) {
        return
      }

      seen.add(key)
      dedupedNames.push(roomName)
    })

    return dedupedNames
  }, [draftName, occupiedRoomNameKeys, roomCatalogBySite, safeRoomData.name, safeRoomData.site])

  useEffect(() => {
    setDraftName(safeRoomData.name || '')
    setDraftDate(toDateInputValue(safeRoomData.date))
  }, [safeRoomData.name, safeRoomData.date, roomIndex])

  useEffect(() => {
    if (!isEditOfRoom) {
      setIsMenuOpen(false)
      setIsEditingRoom(false)
    }
  }, [isEditOfRoom])

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
        setIsEditingRoom(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isMenuOpen])

  useEffect(() => {
    if (!isEditingRoom) {
      return
    }

    const focusTimer = window.setTimeout(() => {
      const target = dateInputRef.current || roomSelectRef.current
      target?.focus?.()
    }, 0)

    return () => window.clearTimeout(focusTimer)
  }, [isEditingRoom])

  useEffect(() => {
    if (!isEditingRoom) {
      return
    }

    const currentName = String(draftName || '').trim()
    if (!currentName) {
      return
    }

    const isAvailable = availableRoomNames.some(
      (roomName) => normalizeRoomNameKey(roomName) === normalizeRoomNameKey(currentName)
    )

    if (!isAvailable) {
      setDraftName('')
    }
  }, [availableRoomNames, draftName, isEditingRoom])

  const handleSaveRoom = () => {
    if (typeof onUpdateRoom === 'function') {
      onUpdateRoom(roomIndex, {
        name: draftName.trim() || safeRoomData.name || '',
        date: draftDate || safeRoomData.date || ''
      })
    }

    setIsEditingRoom(false)
    setIsMenuOpen(false)
  }

  const handleDeleteRoom = () => {
    const confirmed = window.confirm(
      `Supprimer la salle "${safeRoomData.name || 'Salle sans nom'}" ?`
    )

    if (!confirmed) {
      setIsMenuOpen(false)
      return
    }

    if (typeof onDelete === 'function') {
      onDelete()
    }
    setIsMenuOpen(false)
  }

  const handleRoomInputKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleSaveRoom()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setIsEditingRoom(false)
      setDraftName(safeRoomData.name || '')
      setDraftDate(toDateInputValue(safeRoomData.date))
    }
  }

  if (!Array.isArray(safeRoomData.tpiDatas)) {
    safeRoomData.tpiDatas = []
  }

  if (!safeRoomData.configSite) {
    safeRoomData.configSite = safeConfigSite
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className='room'>
        <div
          ref={menuRef}
          className={`date-room site_${String(safeRoomData.site || 'etml').toLowerCase()} detail-level-${tpiCardDetailLevel}`}
          style={roomThemeStyle}
        >
          <div className='date-room-topbar'>
            <div className='date-room-copy'>
              {isEditingRoom ? (
                <>
                  <label className='date-room-inline-field'>
                    <span>Date</span>
                    <input
                      ref={dateInputRef}
                      type='date'
                      value={draftDate}
                      onChange={(event) => setDraftDate(event.target.value)}
                      onKeyDown={handleRoomInputKeyDown}
                    />
                  </label>
                  <label className='date-room-inline-field'>
                    <span>Salle</span>
                    <select
                      ref={roomSelectRef}
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      onKeyDown={handleRoomInputKeyDown}
                    >
                      <option value=''>Sélectionner une salle</option>
                      {availableRoomNames.map((roomName) => (
                        <option key={roomName} value={roomName}>
                          {roomName}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <>
                  <div className='date'>{formattedDate}</div>
                  <div className='nameRoom'>{safeRoomData.name || 'Salle sans nom'}</div>
                </>
              )}
            </div>

            <div className='date-room-topbar-right'>
              {roomClassBadgeLabel ? (
                <span
                  className={`date-room-class-badge ${
                    roomClassBadgeLabel === 'MATU'
                      ? 'is-matu'
                      : ''
                  } date-room-class-badge-inline`.trim()}
                  title={roomClassBadgeLabel === 'MATU' ? 'Salle MATU' : undefined}
                  aria-label={roomClassBadgeLabel === 'MATU' ? 'Salle MATU' : undefined}
                >
                  {roomClassBadgeLabel}
                </span>
              ) : null}
              {isEditOfRoom ? (
                <div className='date-room-actions'>
                  {isEditingRoom ? (
                    <>
                      <button
                        type='button'
                        className='date-room-action primary'
                        onClick={handleSaveRoom}
                        title='Enregistrer les modifications de la salle'
                      >
                        <CheckIcon className='date-room-action-icon' />
                        Valider
                      </button>
                      <button
                        type='button'
                        className='date-room-action secondary'
                        onClick={() => {
                          setIsEditingRoom(false)
                          setDraftName(safeRoomData.name || '')
                          setDraftDate(toDateInputValue(safeRoomData.date))
                        }}
                        title='Annuler les modifications de la salle'
                      >
                        Annuler
                      </button>
                    </>
                  ) : (
                    <div className='date-room-menu-wrap'>
                      <button
                        type='button'
                        className='date-room-menu-trigger'
                        aria-haspopup='menu'
                        aria-expanded={isMenuOpen}
                        aria-label='Menu de la salle'
                        onClick={() => setIsMenuOpen((prev) => !prev)}
                        title='Menu de la salle'
                      >
                        ⋮
                      </button>

                      {isMenuOpen ? (
                        <div className='date-room-menu' role='menu'>
                          <button
                            type='button'
                            className='date-room-menu-item'
                            onClick={() => {
                              setIsEditingRoom(true)
                              setIsMenuOpen(false)
                            }}
                            role='menuitem'
                          >
                            <PencilIcon className='date-room-action-icon' />
                            Modifier
                          </button>
                          <button
                            type='button'
                            className='date-room-menu-item danger'
                            onClick={handleDeleteRoom}
                            role='menuitem'
                          >
                            <TrashIcon className='date-room-action-icon' />
                            Supprimer
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {slots.map((_, iSlot) => {
            // Appeler la fonction generateUniqueID pour générer l'ID TPI
            const tpiID = generateUniqueID(
              String(safeRoomData.site || 'etml').toLowerCase(),
              roomIndex,
              iSlot
            )
            
            const slotTpi = safeRoomData.tpiDatas[iSlot] || createEmptyTpi()
            slotTpi.id = tpiID
            safeRoomData.tpiDatas[iSlot] = slotTpi
            const tpi = slotTpi

            const startTimeMinutes = Math.floor(
              iSlot * (tpiDurationMinutes + breakDurationMinutes) +
              firstTpiStartMinutes
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
            const slotValidationKey = buildPlanningSlotKey({
              dateValue: safeRoomData.date,
              period: iSlot + 1,
              site: safeRoomData.site,
              roomName: safeRoomData.name
            })
            const slotValidationMarker = validationMarkersBySlotKey?.[slotValidationKey] || null

            return (
              <React.Fragment key={iSlot}>
                <TpiSlot
                  timeValues={[startTime, endTime]}
                  tpiData={tpi}
                  onUpdateTpi={updatedTpi => onUpdateTpi(iSlot, updatedTpi)}
                  isEditTPICard={isEditOfRoom}
                  onSwapTpiCardsProp={onSwapTpiCards}
                  detailLevel={tpiCardDetailLevel}
                  roomSite={safeRoomData.site}
                  roomName={safeRoomData.name}
                  roomDate={safeRoomData.date}
                  roomScheduleContext={{
                    firstTpiStartMinutes,
                    tpiDurationMinutes,
                    breakDurationMinutes
                  }}
                  peopleRegistry={peopleRegistry}
                  stakeholderShortIdHints={stakeholderShortIdHints}
                  soutenanceDates={soutenanceDates}
                  validationMarker={slotValidationMarker}
                />
                {iSlot !== numSlots - 1 && (
                  <BreakLine duration={breakDurationMinutes} detailLevel={tpiCardDetailLevel} />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>
    </DndProvider>
  )
}

export default DateRoom
