import React, { Fragment, useEffect, useState } from "react"
import { buildSoutenanceRoomAppearance } from "../../config/soutenanceAppearance"

function TruncatedText({ text = "", maxLength }) {
  const isTruncated = text.length > maxLength
  return (
    <div
      title={isTruncated ? text : ""}
      className={isTruncated ? "truncated-text" : "nameTpi"}
    >
      {isTruncated ? `${text.substring(0, maxLength - 3)}...` : text}
    </div>
  )
}

const formatDate = (dateString) => {
  const options = { year: "numeric", month: "long", day: "numeric" }
  return new Intl.DateTimeFormat("fr-FR", options).format(new Date(dateString))
}

function renderSchedule(schedule) {
  return (
    <div className='horairesBox'>
      {schedule.map((slot, i) => (
        <div key={i} className={`horaire_${i}-${slot.startTime}`}>
          <p className='startTime'>{slot.startTime}</p>
          <p className='startTime'> - </p>
          <p className='endTime'>{slot.endTime}</p>
        </div>
      ))}
    </div>
  )
}

function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) {
    return "Horaire indisponible"
  }

  return `${startTime} - ${endTime}`
}

function getRoomClassLabel(room) {
  const roomClassMode = String(room?.roomClassMode || "").toLowerCase()

  if (roomClassMode === "matu") {
    return "matu"
  }

  if (roomClassMode === "special") {
    return "SPECIAL"
  }

  return ""
}

const ROOM_CLASS_TYPE_FILTER_OPTIONS = [
  { value: "matu", label: "MATU" },
  { value: "special", label: "SPECIAL" },
  { value: "noBadge", label: "Sans badge" }
]

function getRoomClassFilterValue(room) {
  const normalizedLabel = String(getRoomClassLabel(room) || "").toLowerCase()

  if (normalizedLabel === "matu") {
    return "matu"
  }

  if (normalizedLabel === "special") {
    return "special"
  }

  return "noBadge"
}

function getRoomClassFilterLabel(value) {
  return ROOM_CLASS_TYPE_FILTER_OPTIONS.find((option) => option.value === value)?.label || ""
}

function getRoomClassBadgeClass(label) {
  const normalizedLabel = String(label || "").toLowerCase()

  if (normalizedLabel === "matu") {
    return "is-matu"
  }

  if (normalizedLabel === "special") {
    return "is-special"
  }

  return ""
}

function getPositiveInteger(value) {
  const parsedValue = Number.parseInt(value, 10)
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null
}

function getNonNegativeInteger(value) {
  const parsedValue = Number.parseInt(value, 10)
  return Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : null
}

function buildScheduleFromRoomConfig(room) {
  if (!room?.configSite) {
    return []
  }

  const totalSlots = getPositiveInteger(room.configSite.numSlots) || 0
  const breakDuration = Number(room.configSite.breakline) || 0
  const slotDuration = Number(room.configSite.tpiTime) || 0
  let currentTime = Number(room.configSite.firstTpiStart) || 0

  if (totalSlots <= 0 || slotDuration <= 0) {
    return []
  }

  return Array.from({ length: totalSlots }, (_, index) => {
    const startTime = currentTime
    const endTime = currentTime + slotDuration
    const startHours = Math.floor(startTime)
    const startMinutes = Math.floor((startTime % 1) * 60)
    const endHours = Math.floor(endTime)
    const endMinutes = Math.floor((endTime % 1) * 60)

    currentTime = index < totalSlots - 1
      ? endTime + breakDuration
      : endTime

    return {
      startTime: `${startHours < 10 ? `0${startHours}` : startHours}:${String(startMinutes).padStart(2, "0")}`,
      endTime: `${endHours < 10 ? `0${endHours}` : endHours}:${String(endMinutes).padStart(2, "0")}`
    }
  })
}

function getScheduleForRoom(room, schedule = []) {
  const roomSchedule = buildScheduleFromRoomConfig(room)
  return roomSchedule.length > 0 ? roomSchedule : schedule
}

function getLegacyScheduleIndex(tpiData, fallbackIndex = 0) {
  const originalIndex = getNonNegativeInteger(tpiData?.originalIndex)
  if (originalIndex !== null) {
    return originalIndex
  }

  const period = getPositiveInteger(tpiData?.period)
  if (period !== null) {
    return period - 1
  }

  const parsedIndex = getNonNegativeInteger(tpiData?.id?.split("_").pop())
  return parsedIndex === null ? fallbackIndex : parsedIndex
}

function getDisplayedSlot(tpiData, schedule, fallbackIndex = 0) {
  if (tpiData?.startTime && tpiData?.endTime) {
    return {
      startTime: tpiData.startTime,
      endTime: tpiData.endTime
    }
  }

  const safeSchedule = Array.isArray(schedule) ? schedule : []

  return safeSchedule[getLegacyScheduleIndex(tpiData, fallbackIndex)] || {
    startTime: "",
    endTime: ""
  }
}

function getRoomSchedule(room, schedule) {
  return getRoomSlots(room, schedule).map((slot) => slot.displayedSlot)
}

function getRoomSlotCount(room, schedule = []) {
  const roomSchedule = getScheduleForRoom(room, schedule)
  const tpiDatas = Array.isArray(room?.tpiDatas) ? room.tpiDatas : []
  const configuredSlots = getPositiveInteger(room?.configSite?.numSlots) || 0
  const maxTpiIndex = tpiDatas.reduce(
    (maxIndex, tpiData, index) => Math.max(maxIndex, getLegacyScheduleIndex(tpiData, index)),
    -1
  )

  return Math.max(
    configuredSlots,
    roomSchedule.length,
    tpiDatas.length,
    maxTpiIndex + 1,
    0
  )
}

function getRoomSlots(room, schedule = []) {
  const roomSchedule = getScheduleForRoom(room, schedule)
  const slotCount = getRoomSlotCount(room, roomSchedule)
  const slots = Array.from({ length: slotCount }, (_, index) => ({
    index,
    tpiData: null,
    displayedSlot: roomSchedule[index] || { startTime: "", endTime: "" }
  }))

  const tpiDatas = Array.isArray(room?.tpiDatas) ? room.tpiDatas : []
  tpiDatas.forEach((tpiData, fallbackIndex) => {
    const slotIndex = getLegacyScheduleIndex(tpiData, fallbackIndex)

    if (slotIndex < 0 || slotIndex >= slots.length) {
      return
    }

    slots[slotIndex] = {
      index: slotIndex,
      tpiData,
      displayedSlot: getDisplayedSlot(tpiData, roomSchedule, slotIndex)
    }
  })

  return slots
}

const MobileMesTpiFilter = ({ mesTpi, hasToken, year, focusReference }) => {
  if (!hasToken) {
    return <div>Chargement en cours...</div>
  }

  return (
    <section className='mobile-mes-tpi' aria-label='Mes défenses'>
      <header className='soutenance-mobile-head'>
        <h1 className='title'>Défense TPI - Version mobile</h1>
      </header>
      <div className='salles-container-smartphone'>
        {mesTpi.map((salle, indexSalle) => {
          const roomClassLabel = getRoomClassLabel(salle)
          const roomClassBadgeClass = getRoomClassBadgeClass(roomClassLabel)
          const roomAppearance = buildSoutenanceRoomAppearance(salle)

          return (
            <div
              key={indexSalle}
              className={`salle ${salle.site} ${roomAppearance.className}`.trim()}
              style={{
                "--room-reveal-index": indexSalle,
                ...(roomAppearance.style || {})
              }}
            >
              <header className={`room-header ${roomClassLabel ? "has-room-badge" : ""}`}>
                <div className='room-header-badges'>
                  <span className='site'>{salle.site}</span>
                  {roomClassLabel ? (
                    <span
                      className={`soutenance-room-class-badge ${roomClassBadgeClass}`.trim()}
                      title={`Salle ${roomClassLabel}`}
                      aria-label={`Salle ${roomClassLabel}`}
                    >
                      {roomClassLabel}
                    </span>
                  ) : null}
                </div>
                <div className='room-header-date'>{formatDate(salle.date)}</div>
                <div className='soutenance-room-title-row'>
                  <div className='room-header-name'>{salle.name}</div>
                </div>
              </header>

              {salle.tpiDatas.map((tpi, indexTpi) => {
                const { candidat, expert1, expert2, boss } = tpi || {}
                return (
                  <Fragment key={`${indexSalle}-${indexTpi}`}>
                    <div
                      className={`tpi-data mobile-tpi-data ${focusReference === tpi?.refTpi ? "is-selected" : ""}`.trim()}
                      id={tpi?.id}
                      style={{ "--slot-reveal-index": indexTpi }}
                    >
                      <div className='tpi-container'>
                        <div className='tpi-entry'>
                          <div className='tpi-candidat'>{candidat}</div>
                        </div>
                        <div className='tpi-entry'>
                          <div className='tpi-expert1'>{expert1.name}</div>
                        </div>
                        <div className='tpi-entry'>
                          <div className='tpi-expert2'>{expert2.name}</div>
                        </div>

                        <div className='tpi-entry' style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
                          <div>{boss?.name}</div>
                        </div>
                      </div>
                    </div>
                  </Fragment>
                )
              })}
            </div>
          )
        })}
      </div>
    </section>
  )
}

const PdfPreviewIcon = () => (
  <svg
    aria-hidden='true'
    className='soutenance-toolbar-icon'
    viewBox='0 0 24 24'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
  >
    <path
      d='M1.5 12c2.4-4 5.7-6 10.5-6s8.1 2 10.5 6c-2.4 4-5.7 6-10.5 6S3.9 16 1.5 12Z'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
    <path
      d='M9.5 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
)

const PdfFileIcon = () => (
  <svg
    aria-hidden='true'
    className='soutenance-toolbar-icon'
    viewBox='0 0 24 24'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
  >
    <path
      d='M6 3h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
    <path
      d='M14 3v5h5'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
    <path
      d='M8 13h8M8 17h8M9 9h1.5M9 14.5h1.5'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinecap='round'
    />
  </svg>
)

const FullscreenIcon = () => (
  <svg
    aria-hidden='true'
    className='soutenance-fullscreen-action-icon'
    viewBox='0 0 24 24'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
  >
    <path
      d='M8 3H4a1 1 0 0 0-1 1v4M16 3h4a1 1 0 0 1 1 1v4M8 21H4a1 1 0 0 1-1-1v-4M16 21h4a1 1 0 0 0 1-1v-4'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
    <path
      d='M9 8H6V5M15 8h3V5M9 16H6v3M15 16h3v3'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
)

const getFullscreenElement = () => {
  if (typeof document === "undefined") {
    return null
  }

  return document.fullscreenElement || document.webkitFullscreenElement || null
}

const MobileRoomFilter = ({
  rooms,
  schedule,
  year,
  focusReference,
  showEmptySlots = true
}) => {
  const [roomIndex, setRoomIndex] = useState(0)

  useEffect(() => {
    if (!rooms.length) {
      return
    }

    setRoomIndex((prevIndex) => Math.min(prevIndex, rooms.length - 1))
  }, [rooms.length])

  if (!rooms.length) {
    return <div className='mobile-room-filter'>Aucune salle disponible</div>
  }

  const safeRoomIndex = Math.min(roomIndex, rooms.length - 1)
  const currentRoom = rooms[safeRoomIndex]
  const currentRoomSlots = getRoomSlots(currentRoom, schedule)
  const visibleCurrentRoomSlots = showEmptySlots
    ? currentRoomSlots
    : currentRoomSlots.filter(({ tpiData }) => Boolean(tpiData?.refTpi))
  const roomClassLabel = getRoomClassLabel(currentRoom)
  const roomCounter = `${safeRoomIndex + 1}/${rooms.length}`
  const roomAppearance = buildSoutenanceRoomAppearance(currentRoom)

  const handleNextRoom = () => {
    setRoomIndex((prevIndex) => (prevIndex + 1) % rooms.length)
  }

  const handlePreviousRoom = () => {
    setRoomIndex((prevIndex) => (prevIndex - 1 + rooms.length) % rooms.length)
  }

  return (
    <div className='mobile-room-filter' aria-label={`Salles (${rooms.length})`}>
      <div
        key={safeRoomIndex}
        className={`salle ${currentRoom.site} ${roomAppearance.className}`.trim()}
        style={{
          "--room-reveal-index": safeRoomIndex,
          ...(roomAppearance.style || {})
        }}
      >
        <div className='mobile-room-filter-head'>
          <span className='mobile-room-counter'>Salle {roomCounter}</span>
        </div>
        <header className={`room-header ${roomClassLabel ? "has-room-badge" : ""}`}>
          <div className='room-header-badges'>
            <span className='site'>{currentRoom.site}</span>
            {roomClassLabel ? (
              <span
                className={`soutenance-room-class-badge ${getRoomClassBadgeClass(roomClassLabel)}`.trim()}
                title={`Salle ${roomClassLabel}`}
                aria-label={`Salle ${roomClassLabel}`}
              >
                {roomClassLabel}
              </span>
            ) : null}
          </div>
          <div className='room-header-date'>{formatDate(currentRoom.date)}</div>
          <div className='soutenance-room-title-row'>
            <div className='room-header-name'>{currentRoom.name}</div>
          </div>
        </header>
        {visibleCurrentRoomSlots.map(({ tpiData, index, displayedSlot }) => {
          const { candidat, expert1, expert2, boss } = tpiData || {}
          const hasPublishedTpi = Boolean(tpiData?.refTpi)
          const ficheUrl = hasPublishedTpi ? `/tpi/${year}/${tpiData.refTpi}` : null
          return (
            <React.Fragment key={index}>
              <div
                className={`tpi-data ${!hasPublishedTpi ? "is-slot-empty" : ""} ${focusReference === tpiData?.refTpi ? "is-selected" : ""}`.trim()}
                id={tpiData?.id}
                style={{ "--slot-reveal-index": index }}
              >
                <div className='time-label'>
                  {formatTimeRange(displayedSlot.startTime, displayedSlot.endTime)}
                </div>
                <div className={`tpi-container ${!hasPublishedTpi ? "tpi-container--empty" : ""}`.trim()}>
                  {hasPublishedTpi ? (
                    <>
                      <div className='tpi-entry tpi-candidat'>
                        <TruncatedText text={candidat} maxLength={20} />
                      </div>
                      <div className='tpi-entry' style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
                        <TruncatedText text={expert1?.name} maxLength={20} />
                      </div>
                      <div className='tpi-entry' style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
                        <TruncatedText text={expert2?.name} maxLength={20} />
                      </div>
                      <div className='tpi-entry' style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
                        <TruncatedText text={boss?.name} maxLength={20} />
                      </div>
                      {ficheUrl ? (
                        <a className='tpi-room-fiche-link' href={ficheUrl}>
                          fiche
                        </a>
                      ) : null}
                    </>
                  ) : (
                    [0, 1, 2, 3].map((placeholderIndex) => (
                      <div
                        key={placeholderIndex}
                        className='tpi-entry tpi-entry--empty'
                        aria-hidden='true'
                      />
                    ))
                  )}
                </div>
              </div>
            </React.Fragment>
          )
        })}
      </div>
      <div className='mobile-room-filter-nav'>
        <button
          className='mobile-room-filter-btn'
          onClick={handlePreviousRoom}
          title="Voir la salle précédente"
          aria-label="Salle précédente"
        >
          ◀︎
        </button>
        <span className='mobile-room-filter-counter' aria-live='polite'>
          {roomCounter}
        </span>
        <button
          className='mobile-room-filter-btn'
          onClick={handleNextRoom}
          title="Voir la salle suivante"
          aria-label="Salle suivante"
        >
          ▶︎
        </button>
      </div>
    </div>
  )
}

const ToggleFilterButton = ({ isOn, setIsOn, updateFilter, expertOrBoss }) => {
  const role =
    expertOrBoss.role === "projectManager"
      ? "projectManagerButton"
      : "experts"

  const handleClick = () => {
    setIsOn((prevIsOn) => {
      const newIsOn = !prevIsOn
      if (newIsOn) {
        updateFilter(role, expertOrBoss.name)
      } else {
        updateFilter(role, "")
      }

      return newIsOn
    })
  }

  return (
    <button
      className={`btnFilters ${isOn ? "active" : "inactive"}`}
      onClick={handleClick}
    >
      {"Mes TPI"}
    </button>
  )
}

const SoutenanceDesktopHeader = ({
  isDemo,
  year,
  expertOrBoss,
  isOn,
  setIsOn,
  updateFilter,
  filters,
  onGeneratePdf,
  onPreviewPdf,
  isPrintEnabled,
  pdfViewMode,
  onPdfViewModeChange,
  pdfOrientationMode,
  onPdfOrientationModeChange,
  hasToken,
  uniqueExperts,
  uniqueProjectManagers,
  uniqueCandidates,
  uniqueDates,
  uniqueSites,
  uniqueSalles
}) => {
  const userGreeting = hasToken
    ? `Bonjour ${expertOrBoss?.name || "Collaborateur"}`
    : ""
  const [isFullscreen, setIsFullscreen] = useState(Boolean(getFullscreenElement()))

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(getFullscreenElement()))
    }

    document.addEventListener("fullscreenchange", syncFullscreenState)
    document.addEventListener("webkitfullscreenchange", syncFullscreenState)
    syncFullscreenState()

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState)
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState)
    }
  }, [])

  const handleFullscreenClick = async (event) => {
    const fullscreenElement = getFullscreenElement()

    if (fullscreenElement) {
      const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen
      if (exitFullscreen) {
        await exitFullscreen.call(document)
      }
      return
    }

    const fullscreenTarget =
      document.getElementById("soutenances") ||
      event.currentTarget.closest(".tpi-soutenance-page") ||
      document.documentElement
    const requestFullscreen =
      fullscreenTarget.requestFullscreen ||
      fullscreenTarget.webkitRequestFullscreen

    if (requestFullscreen) {
      await requestFullscreen.call(fullscreenTarget)
    }
  }

  return (
    <header className='soutenance-toolbar'>
      <div className={`soutenance-toolbar-head soutenance-toolbar-hero has-fullscreen-action ${isFullscreen ? "is-fullscreen-active" : ""}`.trim()}>
        <div className='soutenance-toolbar-hero-content'>
          <div className={isDemo ? "demo" : "title"}>
            Défenses {year}
          </div>
          {isDemo ? <span className='soutenance-hero-status'>Version démo active</span> : null}
          {userGreeting ? (
            <p className='soutenance-toolbar-greeting'>{userGreeting}</p>
          ) : null}
        </div>

        <button
          type='button'
          className='soutenance-hero-fullscreen-action'
          onClick={handleFullscreenClick}
          title={isFullscreen ? "Quitter le plein écran" : "Passer en plein écran"}
          aria-label={isFullscreen ? "Quitter le plein écran" : "Passer en plein écran"}
        >
          <FullscreenIcon />
        </button>
      </div>

      <div className='soutenance-toolbar-filters'>
        <div className='soutenance-filter-actions'>
          <div className='soutenance-pdf-split'>
            <button
              type='button'
              className='btnPrint btnPrint--ghost btnPdfSplit btnPdfSplit--left'
              onClick={onPreviewPdf}
              disabled={!isPrintEnabled}
              title='Prévisualiser le PDF'
              aria-label='Prévisualiser le PDF'
            >
              <PdfPreviewIcon />
              <span className='soutenance-sr-only'>Prévisualiser PDF</span>
            </button>
            <button
              type='button'
              className='btnPrint btnPdfSplit btnPdfSplit--right'
              onClick={onGeneratePdf}
              disabled={!isPrintEnabled}
              title='Générer le PDF'
              aria-label='Générer le PDF'
            >
              <PdfFileIcon />
              <span className='soutenance-sr-only'>Générer PDF</span>
            </button>
          </div>
          <label className='soutenance-filter-block soutenance-filter-block--inline'>
            <select
              aria-label='Vue PDF'
              value={pdfViewMode}
              onChange={(e) => onPdfViewModeChange(e.target.value)}
            >
              <option value='general'>Vue générale</option>
              <option value='rooms'>Par salle</option>
              <option value='roomGrid'>Planning salles</option>
              <option value='people'>Par expert/CDP</option>
            </select>
          </label>
          <label className='soutenance-filter-block soutenance-filter-block--inline'>
            <select
              aria-label='Orientation PDF'
              value={pdfOrientationMode}
              onChange={(e) => onPdfOrientationModeChange(e.target.value)}
            >
              <option value='auto'>Auto (ajusté)</option>
              <option value='portrait'>Portrait</option>
              <option value='landscape'>Paysage</option>
            </select>
          </label>

          {expertOrBoss && expertOrBoss.name !== null && expertOrBoss.role !== "candidate" && (
            <ToggleFilterButton
              isOn={isOn}
              setIsOn={setIsOn}
              updateFilter={updateFilter}
              expertOrBoss={expertOrBoss}
            />
          )}
        </div>

        <label className='soutenance-filter-block'>
          <select
            aria-label='Filtrer par date'
            value={filters.date}
            onChange={(e) => updateFilter("date", e.target.value)}
          >
            <option value=''>Date</option>
            {uniqueDates.map((date) => (
              <option key={date} value={date}>
                {date}
              </option>
            ))}
          </select>
        </label>

        <label className='soutenance-filter-block'>
          <select
            aria-label='Filtrer par site'
            value={filters.site}
            onChange={(e) => updateFilter("site", e.target.value)}
          >
            <option value=''>Site</option>
            {uniqueSites.map((site) => (
              <option key={site} value={site}>
                {site}
              </option>
            ))}
          </select>
        </label>

        <label className='soutenance-filter-block'>
          <select
            aria-label='Filtrer par salle'
            value={filters.nameRoom}
            onChange={(e) => updateFilter("nameRoom", e.target.value)}
          >
            <option value=''>Salle</option>
            {uniqueSalles.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className='soutenance-filter-block'>
          <select
            aria-label='Filtrer par type de classe'
            value={filters.classType || ""}
            onChange={(e) => updateFilter("classType", e.target.value)}
          >
            <option value=''>Type</option>
            {ROOM_CLASS_TYPE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {!expertOrBoss && (
          <label className='soutenance-filter-block'>
            <select
              aria-label='Filtrer par expert'
              value={filters.experts}
              onChange={(e) => updateFilter("experts", e.target.value)}
            >
              <option value=''>Expert</option>
              {uniqueExperts.map((expert) => (
                <option key={expert} value={expert}>
                  {expert}
                </option>
              ))}
            </select>
          </label>
        )}

        {!expertOrBoss && (
          <label className='soutenance-filter-block'>
            <select
              aria-label='Filtrer par chef de projet'
              value={filters.projectManager}
              onChange={(e) => updateFilter("projectManager", e.target.value)}
            >
              <option value=''>CDP</option>
              {uniqueProjectManagers.map((manager) => (
                <option key={manager} value={manager}>
                  {manager}
                </option>
              ))}
            </select>
          </label>
        )}

        {!expertOrBoss && (
          <label className='soutenance-filter-block'>
            <select
              aria-label='Filtrer par candidat'
              value={filters.candidate}
              onChange={(e) => updateFilter("candidate", e.target.value)}
            >
              <option value=''>Candidat</option>
              {uniqueCandidates.map((candidate) => {
                if (candidate.trim() !== "") {
                  return (
                    <option key={candidate} value={candidate}>
                      {candidate}
                    </option>
                  )
                }
                return null
              })}
            </select>
          </label>
        )}
      </div>

    </header>
  )
}

export {
  MobileMesTpiFilter,
  MobileRoomFilter,
  SoutenanceDesktopHeader,
  TruncatedText,
  formatDate,
  formatTimeRange,
  getDisplayedSlot,
  getLegacyScheduleIndex,
  getRoomClassFilterLabel,
  getRoomClassFilterValue,
  getRoomSlotCount,
  getRoomSlots,
  getRoomClassLabel,
  getRoomClassBadgeClass,
  getRoomSchedule,
  ROOM_CLASS_TYPE_FILTER_OPTIONS,
  renderSchedule
}
