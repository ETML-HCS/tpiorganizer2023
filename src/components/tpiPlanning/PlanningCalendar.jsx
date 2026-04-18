import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { schedulingService } from '../../services/planningService'
import { getStoredAuthToken } from '../../utils/storage'
import {
  AlertIcon,
  CalendarIcon,
  CandidateIcon,
  CheckIcon,
  DocumentIcon,
  DragIcon,
  RoomIcon
} from '../shared/InlineIcons'
import { getPlanningClassDisplayInfo, getPlanningClassPeriod } from './planningClassUtils'
import './PlanningCalendar.css'

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

const compactPlanningText = (value) => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

const normalizePlanningLookup = (value) =>
  compactPlanningText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase()

const normalizePlanningColor = (value) => {
  const hex = compactPlanningText(value).replace(/^#/, '')

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

const getDefaultPlanningColor = (seed = '', fallbackIndex = 0) => {
  const normalizedSeed = compactPlanningText(seed).toUpperCase()

  if (!normalizedSeed) {
    return DEFAULT_SITE_PLANNING_COLORS[Math.abs(Number(fallbackIndex) || 0) % DEFAULT_SITE_PLANNING_COLORS.length]
  }

  let hash = 0
  for (const character of normalizedSeed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return DEFAULT_SITE_PLANNING_COLORS[hash % DEFAULT_SITE_PLANNING_COLORS.length]
}

const hexToRgba = (color, alpha = 1) => {
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

const buildRoomAccentStyle = (color) => {
  const accent = normalizePlanningColor(color) || getDefaultPlanningColor(color)

  return {
    '--planning-room-accent': accent,
    '--planning-room-accent-soft': hexToRgba(accent, 0.12),
    '--planning-room-accent-softer': hexToRgba(accent, 0.07),
    '--planning-room-accent-border': hexToRgba(accent, 0.26)
  }
}

/**
 * Composant calendrier avec drag & drop pour la planification des TPI
 * Affiche les créneaux et permet l'attribution visuelle
 */
const PlanningCalendar = ({ 
  calendarData, 
  tpis, 
  selectedTpi, 
  onSelectTpi, 
  onDragDrop,
  isAdmin,
  year,
  classTypes = [],
  planningCatalogSites = []
}) => {
  const parsedYear = Number.parseInt(year, 10)
  const planningYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear()

  const compactText = useCallback((value) => {
    if (value === null || value === undefined) {
      return ""
    }

    return String(value).trim()
  }, [])

  const formatCandidateName = useCallback((candidate) => {
    if (!candidate) {
      return ""
    }

    if (typeof candidate === "object") {
      return [
        candidate.firstName,
        candidate.lastName,
        candidate.name
      ].filter(Boolean).join(" ").trim()
    }

    return compactText(candidate)
  }, [compactText])

  const getDragStatusLabel = useCallback((status) => {
    if (!status) return ''
    if (status === 'draft') return 'Brouillon'
    if (status === 'voting') return 'En vote'
    if (status === 'confirmed') return 'Confirmé'
    return status
  }, [])

  // États locaux
  const [currentWeek, setCurrentWeek] = useState(() => new Date(planningYear, 0, 1))
  const [draggedTpi, setDraggedTpi] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [isAssigning, setIsAssigning] = useState(false)
  const [highlightedSlots, setHighlightedSlots] = useState([])
  
  const dragRef = useRef(null)
  const hasUserNavigatedRef = useRef(false)

  useEffect(() => {
    hasUserNavigatedRef.current = false
    setCurrentWeek(new Date(planningYear, 0, 1))
  }, [planningYear])

  useEffect(() => {
    if (hasUserNavigatedRef.current) {
      return
    }

    const firstCalendarEntry = calendarData.find((entry) => entry?.date)
    if (!firstCalendarEntry?.date) {
      return
    }

    const firstDate = new Date(firstCalendarEntry.date)
    if (Number.isNaN(firstDate.getTime())) {
      return
    }

    if (firstDate.getFullYear() !== planningYear) {
      return
    }

    setCurrentWeek(firstDate)
  }, [calendarData, planningYear])

  // Périodes de la journée
  const periods = [
    { id: 'matin', label: 'Matin', time: '08:00 - 12:00' },
    { id: 'apres-midi', label: 'Après-midi', time: '13:30 - 17:30' }
  ]

  /**
   * Génère les jours de la semaine courante
   */
  const weekDays = useMemo(() => {
    const days = []
    const start = new Date(currentWeek)
    start.setDate(start.getDate() - start.getDay() + 1) // Lundi
    
    for (let i = 0; i < 5; i++) { // Lundi à Vendredi
      const day = new Date(start)
      day.setDate(start.getDate() + i)
      days.push(day)
    }
    return days
  }, [currentWeek])

  /**
   * Récupère les données d'un jour spécifique
   */
  const getDayData = useCallback((date) => {
    const dateStr = date.toISOString().split('T')[0]
    return calendarData.find(d => d.date === dateStr)
  }, [calendarData])

  /**
   * Navigation entre les semaines
   */
  const navigateWeek = useCallback((direction) => {
    hasUserNavigatedRef.current = true
    setCurrentWeek(prev => {
      const newDate = new Date(prev || new Date(planningYear, 0, 1))
      newDate.setDate(newDate.getDate() + (direction * 7))
      return newDate
    })
  }, [planningYear])

  /**
   * Début du drag d'un TPI
   */
  const handleDragStart = useCallback(async (e, tpi) => {
    if (!isAdmin || tpi.status === 'confirmed') return
    
    setDraggedTpi(tpi)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', tpi._id)
    
    // Charger les disponibilités pour ce TPI
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:6000/api'
      const year = planningYear
      const token = getStoredAuthToken('/api/planning')
      const headers = {}

      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(
        `${apiUrl}/planning/availability/${year}/${tpi._id}`,
        {
          headers
        }
      )
      
      if (response.ok) {
        const availableSlots = await response.json()
        // Extraire les IDs des créneaux disponibles
        const availableSlotIds = availableSlots.map(s => s.slotDetails?.id || s.slot).filter(Boolean)
        setHighlightedSlots(availableSlotIds)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des disponibilités:', error)
    }
    
    dragRef.current = tpi
  }, [isAdmin, planningYear])

  /**
   * Entrée sur une zone de drop
   */
  const handleDragEnter = useCallback((e, slotId) => {
    e.preventDefault()
    if (draggedTpi) {
      setDropTarget(slotId)
    }
  }, [draggedTpi])

  /**
   * Sortie d'une zone de drop
   */
  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    if (e.target === e.currentTarget) {
      setDropTarget(null)
    }
  }, [])

  /**
   * Autorisation du drop
   */
  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  /**
   * Drop d'un TPI sur un créneau
   */
  const handleDrop = useCallback(async (e, slot) => {
    e.preventDefault()
    
    if (!draggedTpi || !isAdmin) {
      setDraggedTpi(null)
      setDropTarget(null)
      setHighlightedSlots([])
      return
    }

    // Vérifier que le slot est disponible
    if (slot.status !== 'available') {
      alert('Ce créneau n\'est pas disponible')
      setDraggedTpi(null)
      setDropTarget(null)
      setHighlightedSlots([])
      return
    }

    setIsAssigning(true)

    try {
      const result = await schedulingService.assignSlot(slot.id, draggedTpi._id)
      
      if (result.success) {
        // Notifier le parent
        onDragDrop(draggedTpi._id, slot.id)
      } else {
        alert(result.message || 'Erreur lors de l\'attribution')
      }
    } catch (error) {
      console.error('Erreur drag & drop:', error)
      alert('Erreur lors de l\'attribution du créneau')
    } finally {
      setDraggedTpi(null)
      setDropTarget(null)
      setHighlightedSlots([])
      setIsAssigning(false)
    }
  }, [draggedTpi, isAdmin, onDragDrop])

  /**
   * Fin du drag
   */
  const handleDragEnd = useCallback(() => {
    setDraggedTpi(null)
    setDropTarget(null)
    setHighlightedSlots([])
    dragRef.current = null
  }, [])

  /**
   * Rendu d'une cellule de créneau
   */
  const renderSlotCell = useCallback((dayData, period, room) => {
    if (!dayData || !dayData.rooms[room]) {
      return (
        <div className="slot-cell empty">
          <span className="slot-empty-text" aria-hidden="true" />
        </div>
      )
    }

    const slot = dayData.rooms[room].find(s => s.period === period)
    
    if (!slot) {
      return (
        <div className="slot-cell empty">
          <span className="slot-empty-text" aria-hidden="true" />
        </div>
      )
    }

    const isDroppable = slot.status === 'available' && draggedTpi
    const isTarget = dropTarget === slot.id
    const isHighlighted = highlightedSlots.includes(slot.id)

    const classNames = [
      'slot-cell',
      `status-${slot.status}`,
      isDroppable ? 'droppable' : '',
      isTarget ? 'drop-target' : '',
      isHighlighted ? 'highlighted' : ''
    ].filter(Boolean).join(' ')

    return (
      <div
        className={classNames}
        onDragEnter={(e) => handleDragEnter(e, slot.id)}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, slot)}
      >
        {slot.tpi ? (
          <div 
            className="slot-tpi"
            onClick={() => onSelectTpi(tpis.find(t => t.reference === slot.tpi.reference))}
          >
            {compactText(slot.tpi.reference) ? (
              <span className="tpi-ref">{compactText(slot.tpi.reference)}</span>
            ) : null}
            {formatCandidateName(slot.tpi.candidat) ? (
              <span className="tpi-candidat">{formatCandidateName(slot.tpi.candidat)}</span>
            ) : null}
          </div>
        ) : (
          <div className="slot-available">
            <span className="slot-time">{slot.startTime}</span>
            {isDroppable && (
              <span className="drop-hint">Déposer ici</span>
            )}
          </div>
        )}
      </div>
    )
  }, [draggedTpi, dropTarget, highlightedSlots, tpis, onSelectTpi, handleDragEnter, handleDragLeave, handleDragOver, handleDrop])

  /**
   * Récupère toutes les salles uniques
   */
  const allRooms = useMemo(() => {
    const rooms = new Set()
    calendarData.forEach(day => {
      Object.keys(day.rooms || {}).forEach(room => rooms.add(room))
    })
    return Array.from(rooms).sort()
  }, [calendarData])

  const roomSiteMetaByName = useMemo(() => {
    const map = new Map()
    const catalogSites = Array.isArray(planningCatalogSites) ? planningCatalogSites : []

    catalogSites.forEach((site, siteIndex) => {
      const siteLabel = compactText(site?.label || site?.code || '')
      const siteCode = compactText(site?.code || siteLabel).toUpperCase()
      const siteColor = normalizePlanningColor(
        site?.planningColor || site?.color || getDefaultPlanningColor(siteCode || siteLabel, siteIndex)
      )
      const roomDetails = Array.isArray(site?.roomDetails)
        ? site.roomDetails
        : Array.isArray(site?.rooms)
          ? site.rooms.map((room) =>
              typeof room === 'object'
                ? room
                : { code: room, label: room }
            )
          : []

      roomDetails.forEach((room) => {
        const roomTokens = [
          room?.label,
          room?.code,
          typeof room === 'string' ? room : ''
        ]

        roomTokens.forEach((token) => {
          const lookupKey = normalizePlanningLookup(token)
          if (!lookupKey || map.has(lookupKey)) {
            return
          }

          map.set(lookupKey, {
            siteLabel: siteLabel || siteCode,
            siteCode,
            siteColor
          })
        })
      })
    })

    return map
  }, [compactText, planningCatalogSites])

  // Format de date pour l'en-tête
  const formatDate = (date) => {
    return date.toLocaleDateString('fr-CH', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    })
  }

  return (
    <div className="planning-calendar">
      {/* Navigation des semaines */}
      <div className="calendar-navigation">
        <button 
          className="nav-btn"
          onClick={() => navigateWeek(-1)}
        >
          ← Semaine précédente
        </button>
        
        <span className="current-week">
          Semaine du {weekDays[0]?.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
        
        <button 
          className="nav-btn"
          onClick={() => navigateWeek(1)}
        >
          Semaine suivante →
        </button>
      </div>

      {/* Liste des TPI à placer (drag source) */}
      {isAdmin && (
        <div className="tpi-drag-source">
          <h4>
            <CandidateIcon className="section-icon" />
            TPI à planifier
          </h4>
          <div className="draggable-tpis">
            {tpis
              .filter(tpi => tpi.status !== 'confirmed')
              .map(tpi => (
                (() => {
                  const candidateName = [
                    tpi.candidat?.firstName,
                    tpi.candidat?.lastName
                  ].filter(Boolean).join(' ').trim()
                    || formatCandidateName(tpi.candidat)
                  const tpiSite = tpi.site || tpi.lieu?.site
                  const classInfo = getPlanningClassDisplayInfo(tpi.classe, classTypes, planningCatalogSites, tpiSite)
                  const classDisplayLabel = classInfo.displayClassLabel || compactText(tpi.classe)
                  const classTypeLabel = classInfo.displayTypeLabel
                  const classModePeriod = getPlanningClassPeriod(tpi.classe, classTypes, planningCatalogSites, tpiSite)
                  const classModePeriodLabel = [classModePeriod.startDate, classModePeriod.endDate]
                    .filter(Boolean)
                    .join(' → ')
                  const classModeTitle = classInfo
                    ? [
                        classDisplayLabel ? `Classe ${classDisplayLabel}` : '',
                        classInfo.hasSpecificClass && classTypeLabel ? `Type ${classTypeLabel}` : '',
                        classInfo.siteLabel || tpiSite ? `Site ${classInfo.siteLabel || tpiSite}` : '',
                        classModePeriodLabel || ''
                      ].filter(Boolean).join(' · ')
                    : ''
                  const metaItems = [
                    classDisplayLabel
                      ? {
                          key: 'class',
                          label: classDisplayLabel
                        }
                      : null,
                    (classInfo.siteLabel || tpiSite)
                      ? { key: 'site', label: classInfo.siteLabel || tpiSite }
                      : null
                  ].filter(Boolean)

                  return (
                <div
                  key={tpi._id}
                  className={`draggable-tpi ${selectedTpi?._id === tpi._id ? 'selected' : ''} status-${tpi.status}`}
                  draggable={isAdmin && tpi.status !== 'confirmed'}
                  onDragStart={(e) => handleDragStart(e, tpi)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelectTpi(tpi)}
                >
                  <div className="draggable-tpi-head">
                    <div className="draggable-tpi-head-copy">
                      <span className="tpi-drag-kicker">TPI</span>
                      {compactText(tpi.reference) ? (
                        <span className="tpi-drag-ref">{compactText(tpi.reference)}</span>
                      ) : null}
                    </div>
                    {getDragStatusLabel(tpi.status) ? (
                      <span className={`tpi-drag-status status-${tpi.status}`}>
                        {getDragStatusLabel(tpi.status)}
                      </span>
                    ) : null}
                  </div>
                    <div className="draggable-tpi-body">
                      <span className="tpi-drag-avatar" aria-hidden="true">
                        <CandidateIcon />
                      </span>
                      <div className="tpi-drag-copy">
                        {candidateName ? (
                          <span className="tpi-drag-name">{candidateName}</span>
                        ) : null}
                        {metaItems.length > 0 && (
                          <div className="tpi-drag-meta">
                            {metaItems.map((item) => (
                              <span key={item.key} className="tpi-drag-chip">
                                {item.label}
                              </span>
                            ))}
                            {classInfo.hasSpecificClass && classTypeLabel ? (
                              <span className="tpi-drag-chip tpi-drag-chip-matu" title={classModeTitle || classTypeLabel}>
                                {classTypeLabel}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  <div className="draggable-tpi-foot">
                    <span className="tpi-drag-hint">
                      <DragIcon />
                      Glisser pour poser
                    </span>
                    <span className="tpi-drag-grip" aria-hidden="true">
                      <DragIcon />
                    </span>
                  </div>
                </div>
                  )
                })()
              ))}
          </div>
        </div>
      )}

      {/* Grille du calendrier */}
      <div className="calendar-grid">
        {/* En-tête des colonnes (jours) */}
        <div className="calendar-header">
          <div className="header-cell corner">Salle / Période</div>
          {weekDays.map(day => (
            <div key={day.toISOString()} className="header-cell day">
              <CalendarIcon className="header-icon" />
              {formatDate(day)}
            </div>
          ))}
        </div>

        {/* Corps du calendrier */}
        <div className="calendar-body">
          {allRooms.map(room => {
            const roomSiteMeta = roomSiteMetaByName.get(normalizePlanningLookup(room)) || null

            return (
              <React.Fragment key={room}>
                {periods.map(period => (
                  <div key={`${room}-${period.id}`} className="calendar-row">
                    <div
                      className="row-header"
                      style={roomSiteMeta ? buildRoomAccentStyle(roomSiteMeta.siteColor) : undefined}
                    >
                      <span className="room-name">
                        <RoomIcon className="room-icon" />
                        {room}
                      </span>
                      <div className="row-header-tags">
                        {roomSiteMeta?.siteLabel ? (
                          <span className="room-site-badge">
                            {roomSiteMeta.siteLabel}
                          </span>
                        ) : null}
                        <span className="period-name">{period.label}</span>
                      </div>
                    </div>
                    {weekDays.map(day => (
                      <div key={`${room}-${period.id}-${day.toISOString()}`} className="cell-wrapper">
                        {renderSlotCell(getDayData(day), period.id, room)}
                      </div>
                    ))}
                  </div>
                ))}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* Légende */}
      <div className="calendar-legend">
        <div className="legend-item">
          <span className="legend-color available"><CheckIcon /></span>
          <span>Disponible</span>
        </div>
        <div className="legend-item">
          <span className="legend-color assigned"><DocumentIcon /></span>
          <span>Assigné</span>
        </div>
        <div className="legend-item">
          <span className="legend-color blocked"><AlertIcon /></span>
          <span>Bloqué</span>
        </div>
        <div className="legend-item">
          <span className="legend-color voting"><CalendarIcon /></span>
          <span>En vote</span>
        </div>
      </div>

      {/* Indicateur de chargement pendant l'assignation */}
      {isAssigning && (
        <div className="assigning-overlay">
          <div className="assigning-spinner">
            <div className="spinner"></div>
            <p>Attribution en cours...</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default PlanningCalendar
