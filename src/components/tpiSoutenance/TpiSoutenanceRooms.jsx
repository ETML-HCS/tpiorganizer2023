import React, { Fragment, useEffect, useMemo, useRef, useState } from "react"
import CreneauPropositionPopup from "./CreneauPropositionPopup"
import TpiSoutenanceActionButtons from "./TpiSoutenanceActionButtons"
import {
  TruncatedText,
  formatDate,
  formatTimeRange,
  getDisplayedSlot,
  getRoomClassLabel,
  getRoomClassBadgeClass,
  getRoomSlots
} from "./TpiSoutenanceParts"
import {
  buildSoutenanceRoomAppearance,
  resolveStakeholderIconKey
} from "../../config/soutenanceAppearance"
import {
  CandidateIcon,
  ExpertIcon,
  ProjectLeadIcon
} from "../shared/InlineIcons"

import { showNotification } from "../Tools"

const ICS_SUMMARY_PREFIX = "Défense TPI"
const MAX_CHAR_CLASS = /[^\w.-]+/g
const TPI_SLOT_NAME_MAX_LENGTH = 28

const escapeIcsText = (value) =>
  String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")

const buildICalDate = (dateValue) => {
  const parsedDate = new Date(dateValue)
  if (Number.isNaN(parsedDate.getTime())) {
    return ""
  }

  return parsedDate.toISOString().slice(0, 10).replace(/-/g, "")
}

const buildICalDateTime = (dateValue, timeValue) => {
  const datePart = buildICalDate(dateValue)
  if (!datePart || !timeValue) {
    return ""
  }

  const [hours, minutes] = String(timeValue).split(":")
  if (!hours || !minutes) {
    return ""
  }

  return `${datePart}T${hours.padStart(2, "0")}${minutes.padStart(2, "0")}00`
}

const buildIcalEvent = ({ salle, tpi, startTime, endTime }, dtStamp, index) => {
  const start = buildICalDateTime(salle.date, startTime)
  const end = buildICalDateTime(salle.date, endTime)
  if (!start || !end) {
    return null
  }

  const eventUid = `${tpi.refTpi || "tpi"}-${tpi._id || salle._id || salle.name || "room"}-${index}`
  const eventSummary = `${ICS_SUMMARY_PREFIX} ${tpi.refTpi || "sans-référence"} - ${tpi.candidat}`
  const eventDescription = `Défense de TPI ${tpi.candidat}\\nExpert 1: ${
    tpi.expert1?.name
  }\\nExpert 2: ${tpi.expert2?.name}\\nEncadrant: ${tpi.boss?.name}`

  return [
    "BEGIN:VEVENT",
    `DTSTAMP:${dtStamp}`,
    `UID:${eventUid}`,
    `DTSTART;TZID=Europe/Berlin:${start}`,
    `DTEND;TZID=Europe/Berlin:${end}`,
    `SUMMARY:${escapeIcsText(eventSummary)}`,
    `DESCRIPTION:${escapeIcsText(eventDescription)}`,
    `LOCATION:${escapeIcsText(salle.name)}`,
    "TRANSP:TRANSPARENT",
    "CLASS:PUBLIC",
    "END:VEVENT"
  ].join("\n")
}

const buildIcalContent = (events) => {
  const dtStamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z/g, "Z")

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//tpiOrganizer2023//iCal",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Berlin",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "DTSTART:19700329T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "DTSTART:19701025T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "END:VTIMEZONE"
  ]

  events.forEach((event, index) => {
    const eventBlock = buildIcalEvent(event, dtStamp, index)
    if (eventBlock) {
      lines.push(eventBlock)
    }
  })

  lines.push("END:VCALENDAR")
  return lines.join("\n")
}

const collectFilteredIcalEvents = (rooms, schedule) =>
  rooms.flatMap((room) => {
    return collectRoomIcalEvents(room, getRoomSlots(room, schedule), schedule)
  })

const collectRoomIcalEvents = (room, roomSlots, schedule) =>
  roomSlots
    .filter(({ tpiData }) => Boolean(tpiData?.refTpi))
    .map(({ tpiData, index, displayedSlot }) => {
      const slot = displayedSlot || getDisplayedSlot(tpiData, schedule, index)

      return {
        salle: room,
        tpi: tpiData,
        startTime: slot.startTime,
        endTime: slot.endTime
      }
    })
    .filter((entry) => entry.startTime && entry.endTime)

const sanitizeFileName = (value) =>
  String(value || "soutenances")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(MAX_CHAR_CLASS, "_")
    .replace(/^_+|_+$/g, "")

const STAKEHOLDER_ICON_LABELS = {
  candidate: "Candidat",
  expert1: "Expert 1",
  expert2: "Expert 2",
  projectManager: "Chef de projet"
}

const STAKEHOLDER_ICON_BADGES = {
  expert1: "1",
  expert2: "2"
}

const STAKEHOLDER_ICON_COMPONENTS = {
  candidate: CandidateIcon,
  expert1: ExpertIcon,
  expert2: ExpertIcon,
  projectManager: ProjectLeadIcon
}

const isCandidateAcademicIconKey = (iconKey) =>
  iconKey === "candidate" || String(iconKey || "").startsWith("candidate-")

const getStakeholderIconComponent = (type, iconKey) => {
  if (type === "candidate" || isCandidateAcademicIconKey(iconKey)) {
    return CandidateIcon
  }

  return type === "projectManager" ? ProjectLeadIcon : ExpertIcon
}

const isHelmetIconKey = (iconKey) =>
  iconKey === "participant" || String(iconKey || "").startsWith("helmet-")

const StakeholderIcon = ({ type, iconKey, label }) => {
  const accessibleLabel = label || STAKEHOLDER_ICON_LABELS[type] || "Participant"
  const resolvedIconKey = iconKey || type
  const Icon = getStakeholderIconComponent(type, resolvedIconKey) || STAKEHOLDER_ICON_COMPONENTS[type] || ExpertIcon
  const badge = isHelmetIconKey(resolvedIconKey) ? STAKEHOLDER_ICON_BADGES[type] : undefined

  return (
    <span
      className={`stakeholder-icon stakeholder-icon--${type} stakeholder-icon--visual-${resolvedIconKey}`}
      role='img'
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      <Icon
        className='stakeholder-icon-svg'
        badge={badge}
      />
    </span>
  )
}

const IcalDownloadIcon = () => (
  <svg
    className='ical-download-icon'
    viewBox='0 0 24 24'
    focusable='false'
    aria-hidden='true'
  >
    <path
      className='ical-download-icon-stroke'
      d='M7 3.75v2.5M17 3.75v2.5M4.75 9h14.5M6.25 5.5h11.5c1.1 0 2 .9 2 2v10.25c0 1.1-.9 2-2 2H6.25c-1.1 0-2-.9-2-2V7.5c0-1.1.9-2 2-2Z'
      fill='none'
    />
    <path
      className='ical-download-icon-stroke'
      d='M12 11.5v5M9.85 14.85 12 17l2.15-2.15'
      fill='none'
    />
  </svg>
)

const ClearPersonFilterIcon = () => (
  <svg
    className='clear-person-filter-icon'
    viewBox='0 0 24 24'
    focusable='false'
    aria-hidden='true'
  >
    <circle className='clear-person-filter-icon-bg' cx='12' cy='12' r='8.8' />
    <path
      className='clear-person-filter-icon-stroke'
      d='M8.35 8.35 15.65 15.65M15.65 8.35 8.35 15.65'
      fill='none'
    />
  </svg>
)

const getFullscreenElement = () => {
  if (typeof document === "undefined") {
    return null
  }

  return document.fullscreenElement || document.webkitFullscreenElement || null
}

const RenderRooms = ({
  year,
  tpiDatas,
  schedule,
  listOfPerson,
  layoutColumns,
  focusReference = "",
  isAnyFilterApplied,
  aggregatedICalPersonLabel,
  showEmptySlots = true,
  personIcalFilter = null,
  onClearPersonFilters,
  loadData,
  token,
  isOn,
  updateSoutenanceData
}) => {
  const hideLegacyActions = true
  const isPersonIcalMode = Boolean(personIcalFilter)
  const personFilterRoleLabel =
    personIcalFilter?.role === "projectManager" ? "chef de projet" : "expert"
  const clearPersonFilterLabel = personIcalFilter?.name
    ? `Désactiver le filtre sur ${personIcalFilter.name} et afficher toutes les défenses`
    : `Désactiver le filtre ${personFilterRoleLabel} et afficher toutes les défenses`
  const [showPopup, setShowPopup] = useState(false)
  const [currentTpiData, setCurrentTpiData] = useState(null)
  const [scheduleSuggester, setScheduleSuggester] = useState(null)
  const sallesContainerRef = useRef(null)
  const [focusScale, setFocusScale] = useState(1)

  useEffect(() => {
    const sallesContainer = sallesContainerRef.current
    if (!sallesContainer) {
      return undefined
    }

    let animationFrame = null
    const requestFrame = typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame.bind(window)
      : (callback) => window.setTimeout(callback, 0)
    const cancelFrame = typeof window.cancelAnimationFrame === "function"
      ? window.cancelAnimationFrame.bind(window)
      : (frameId) => window.clearTimeout(frameId)

    const updateFocusScale = () => {
      if (animationFrame) {
        cancelFrame(animationFrame)
      }

      animationFrame = requestFrame(() => {
        animationFrame = null
        const fullscreenRoot = sallesContainer.closest(".soutenances")
        const fullscreenElement = getFullscreenElement()
        const isSoutenanceFullscreen =
          fullscreenRoot && fullscreenElement === fullscreenRoot

        if (!isSoutenanceFullscreen) {
          setFocusScale(1)
          return
        }

        const roomElements = Array.from(sallesContainer.querySelectorAll(".salle"))
        const tallestRoomHeight = roomElements.reduce(
          (maxHeight, roomElement) => Math.max(maxHeight, roomElement.scrollHeight || 0),
          0
        )

        if (!tallestRoomHeight || !fullscreenRoot) {
          setFocusScale(1)
          return
        }

        const fullscreenStyles = window.getComputedStyle(fullscreenRoot)
        const paddingTop = Number.parseFloat(fullscreenStyles.paddingTop) || 0
        const paddingBottom = Number.parseFloat(fullscreenStyles.paddingBottom) || 0
        const availableHeight = Math.max(
          1,
          fullscreenRoot.clientHeight - paddingTop - paddingBottom
        )
        const nextScale = Math.min(
          1,
          Math.max(0.3, availableHeight / tallestRoomHeight)
        )
        const roundedScale = Math.round(nextScale * 1000) / 1000

        setFocusScale((previousScale) =>
          Math.abs(previousScale - roundedScale) > 0.005 ? roundedScale : previousScale
        )
      })
    }

    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(updateFocusScale)
      : null

    resizeObserver?.observe(sallesContainer)
    window.addEventListener("resize", updateFocusScale)
    document.addEventListener("fullscreenchange", updateFocusScale)
    document.addEventListener("webkitfullscreenchange", updateFocusScale)
    updateFocusScale()

    return () => {
      if (animationFrame) {
        cancelFrame(animationFrame)
      }
      resizeObserver?.disconnect()
      window.removeEventListener("resize", updateFocusScale)
      document.removeEventListener("fullscreenchange", updateFocusScale)
      document.removeEventListener("webkitfullscreenchange", updateFocusScale)
    }
  }, [tpiDatas, schedule, showEmptySlots])

  const handleAcceptClick = async (sendYear, tpiData, expertOrBoss) => {
    try {
      const propositions = {
        offres: {
          isValidated: true,
          submit: []
        }
      }

      await updateSoutenanceData(sendYear, propositions, tpiData, expertOrBoss)
      loadData()
    } catch (error) {
      console.error("Erreur lors de la mise à jour des données :", error)
    }
  }

  const handlePropositionClick = (tpiData, expertOrBoss, submittedOffers) => {
    setCurrentTpiData(tpiData)

    if (Array.isArray(submittedOffers) && submittedOffers.length > 0) {
      alert(
        "Attention : En continuant, vous écraserez les demandes précédentes !"
      )
    }

    setScheduleSuggester(expertOrBoss)
    setShowPopup(true)
  }

  const logAndClosePopup = () => {
    setShowPopup(false)
    loadData()
  }

  const findPersonTokenByName = (name) => {
    if (!name || !(listOfPerson || []).length) {
      return undefined
    }

    const person = (listOfPerson || []).find((personItem) => personItem.name === name)
    if (person) {
      return person.token
    }

    return undefined
  }

  const downloadIcalEvents = (events, fileBase, errorMessage) => {
    if (!events.length) {
      showNotification(errorMessage, "error")
      return
    }

    const icalContent = buildIcalContent(events)
    const blob = new Blob([icalContent], { type: "text/calendar" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${sanitizeFileName(fileBase)}.ics`
    a.style.display = "none"

    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const downloadTpiICal = (salle, tpiData, displayedSlot) => {
    downloadIcalEvents(
      [
        {
          salle,
          tpi: tpiData,
          startTime: displayedSlot.startTime,
          endTime: displayedSlot.endTime
        }
      ].filter((entry) => entry.startTime && entry.endTime),
      `${tpiData?.refTpi || "tpi"}_${tpiData?.candidat || "defense"}`,
      "Horaire de défense indisponible pour l'export iCal"
    )
  }

  const downloadRoomICal = (salle, roomIcalEvents) => {
    downloadIcalEvents(
      roomIcalEvents,
      `${buildICalDate(salle.date) || "date"}_${salle.site || "site"}_${salle.name || "salle"}`,
      "Aucune défense exportable dans cette salle"
    )
  }

  const filteredIcalEvents = useMemo(
    () => collectFilteredIcalEvents(tpiDatas, schedule),
    [tpiDatas, schedule]
  )

  const downloadFilteredICal = () => {
    if (filteredIcalEvents.length === 0) {
      showNotification("Horaire de défense indisponible pour l'export iCal", "error")
      return
    }

    const fileBase = sanitizeFileName(
      aggregatedICalPersonLabel || "soutenances_filtrees"
    )
    downloadIcalEvents(
      filteredIcalEvents,
      `${fileBase}_soutenances`,
      "Horaire de défense indisponible pour l'export iCal"
    )
  }

  return (
    <>
      {isAnyFilterApplied && !hideLegacyActions ? (
        <div className='soutenance-filtered-export'>
          <button
            type='button'
            className='btniCal btniCal--filtered'
            disabled={filteredIcalEvents.length === 0}
            title='Exporter iCal'
            onClick={() =>
              downloadFilteredICal()
            }
          >
            {`iCal ${aggregatedICalPersonLabel ? aggregatedICalPersonLabel + " " : ""}(${filteredIcalEvents.length})`}
          </button>
        </div>
      ) : null}

      <div
        ref={sallesContainerRef}
        className='salles-container'
        role='list'
        aria-label='Liste des salles'
        style={{
          "--soutenance-grid-columns": Math.max(1, Math.min(5, Number(layoutColumns) || 1)),
          "--soutenance-fullscreen-columns": Math.max(1, tpiDatas.length),
          "--soutenance-focus-scale": focusScale,
          "--soutenance-focus-inverse-scale": focusScale > 0 ? 1 / focusScale : 1
        }}
      >
        {tpiDatas.map((salle, indexSalle) => {
          const roomClassLabel = getRoomClassLabel(salle)
          const roomClassBadgeClass = getRoomClassBadgeClass(roomClassLabel)
          const roomAppearance = buildSoutenanceRoomAppearance(salle)
          const roomSlots = getRoomSlots(salle, schedule)
          const visibleRoomSlots = showEmptySlots
            ? roomSlots
            : roomSlots.filter(({ tpiData }) => Boolean(tpiData?.refTpi))
          const roomIcalEvents = collectRoomIcalEvents(salle, roomSlots, schedule)

          return (
            <article
              key={indexSalle}
              className={`salle ${salle.site} ${roomAppearance.className}`.trim()}
              role='listitem'
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
                  {!isPersonIcalMode ? (
                    <button
                      type='button'
                      className='btniCal btniCal--room'
                      disabled={roomIcalEvents.length === 0}
                      title='Exporter iCal'
                      aria-label={`Exporter iCal de la salle ${salle.name}`}
                      onClick={() => downloadRoomICal(salle, roomIcalEvents)}
                    >
                      <IcalDownloadIcon />
                    </button>
                  ) : null}
                </div>
              </header>

              {visibleRoomSlots.map(({ tpiData, index, displayedSlot }, visibleIndex) => {
                const { expert1, expert2, boss } = tpiData || {}
                const stakeholderIcons = salle?.configSite?.stakeholderIcons || {}
                const hasPublishedTpi = Boolean(tpiData?.refTpi)
                const expert1Token = hasPublishedTpi ? findPersonTokenByName(expert1?.name) : undefined
                const expert2Token = hasPublishedTpi ? findPersonTokenByName(expert2?.name) : undefined
                const bossToken = hasPublishedTpi ? findPersonTokenByName(boss?.name) : undefined

                const candidateRowClass = !isAnyFilterApplied ? "is-filterless" : ""
                const expert1LockedClass = !isOn && token && expert1Token !== token ? "is-dim" : ""
                const expert2LockedClass = !isOn && token && expert2Token !== token ? "is-dim" : ""
                const bossLockedClass = !isOn && token && bossToken !== token ? "is-dim" : ""
                const expert1FocusClass = !isOn && token === expert1Token ? "is-focus" : ""
                const expert2FocusClass = !isOn && token === expert2Token ? "is-focus" : ""
                const bossFocusClass = !isOn && token === bossToken ? "is-focus" : ""
                const candidateTime = formatTimeRange(displayedSlot.startTime, displayedSlot.endTime)
                const hasCandidateTimeRange = displayedSlot.startTime && displayedSlot.endTime
                const slotKey = `${indexSalle}-${tpiData?._id || tpiData?.id || tpiData?.refTpi || `empty-${index}`}`

                  if (!hasPublishedTpi) {
                    return (
                      <Fragment key={slotKey}>
                        <div
                          className={`tpi-data tpi-slot is-slot-empty ${candidateRowClass}`.trim()}
                          style={{ "--slot-reveal-index": visibleIndex }}
                          title={`${salle.site}\n${formatDate(salle.date)}\n${candidateTime}`}
                          aria-label={`Créneau vide ${candidateTime}`}
                        >
                          <div className='slot-time-row'>
                            <div className={`slot-time slot-time--empty ${!isAnyFilterApplied ? "slot-time--header" : ""} ${hasCandidateTimeRange ? "slot-time--range" : ""}`.trim()}>
                              {hasCandidateTimeRange ? (
                                <>
                                  <span>{displayedSlot.startTime}</span>
                                  <span aria-hidden='true'>-</span>
                                  <span>{displayedSlot.endTime}</span>
                                </>
                              ) : (
                                candidateTime
                              )}
                            </div>
                          </div>

                          {[0, 1, 2, 3].map((placeholderIndex) => (
                            <div
                              key={placeholderIndex}
                              className='tpi-row-block slot-row--empty'
                              aria-hidden='true'
                            >
                              <span className='slot-value' />
                            </div>
                          ))}
                        </div>
                      </Fragment>
                    )
                  }

                  return (
                    <Fragment key={slotKey}>
                      <div
                        className={`tpi-data tpi-slot ${candidateRowClass} ${focusReference === tpiData?.refTpi ? "is-selected" : ""}`.trim()}
                        id={tpiData?.id}
                        style={{ "--slot-reveal-index": visibleIndex }}
                        title={`${salle.site}\n${formatDate(salle.date)}\n${
                          formatTimeRange(displayedSlot.startTime, displayedSlot.endTime)
                        }`}
                      >
                        <div className='slot-time-row'>
                          <div className={`slot-time ${!isAnyFilterApplied ? "slot-time--header" : ""} ${hasCandidateTimeRange ? "slot-time--range" : ""}`.trim()}>
                            {hasCandidateTimeRange ? (
                              <>
                                <span>{displayedSlot.startTime}</span>
                                <span aria-hidden='true'>-</span>
                                <span>{displayedSlot.endTime}</span>
                              </>
                            ) : (
                              candidateTime
                            )}
                          </div>

                          {!isPersonIcalMode && tpiData.candidat ? (
                            <button
                              type='button'
                              className='btniCal btniCal--tpi'
                              disabled={!displayedSlot.startTime || !displayedSlot.endTime}
                              title='Exporter iCal'
                              aria-label={`Exporter iCal du TPI ${tpiData.refTpi}`}
                              onClick={() => downloadTpiICal(salle, tpiData, displayedSlot)}
                            >
                              <IcalDownloadIcon />
                            </button>
                          ) : null}
                        </div>

                        <div className='tpi-row-block tpi-row-block--candidate' style={{ gridTemplateColumns: "auto minmax(0, 1fr) auto" }}>
                          <StakeholderIcon
                            type='candidate'
                            iconKey={resolveStakeholderIconKey(stakeholderIcons, "candidate")}
                            label='Candidat'
                          />
                          <span className='slot-value'>
                            <TruncatedText text={tpiData?.candidat} maxLength={TPI_SLOT_NAME_MAX_LENGTH} />
                          </span>
                          <span className='stakeholder-icon-spacer' aria-hidden='true' />
                        </div>

                        <div
                          className={`tpi-row-block ${expert1LockedClass} ${expert1FocusClass}`}
                          style={{ gridTemplateColumns: "auto minmax(0, 1fr) minmax(var(--soutenance-grid-actions), auto)" }}
                        >
                          <StakeholderIcon
                            type='expert1'
                            iconKey={resolveStakeholderIconKey(stakeholderIcons, "expert1")}
                            label='Expert 1'
                          />
                          <span className='slot-value'>
                            <TruncatedText text={tpiData?.expert1?.name} maxLength={TPI_SLOT_NAME_MAX_LENGTH} />
                          </span>
                          {!hideLegacyActions ? (
                            <TpiSoutenanceActionButtons
                              participantName={tpiData?.expert1?.name}
                              expertOrBoss='expert1'
                              tpiData={tpiData}
                              listOfPerson={listOfPerson}
                              token={token}
                              onAccept={(selectedTpiData, role) =>
                                handleAcceptClick(year, selectedTpiData, role)
                              }
                              onProposition={handlePropositionClick}
                            />
                          ) : null}
                        </div>

                        <div
                          className={`tpi-row-block ${expert2LockedClass} ${expert2FocusClass}`}
                          style={{ gridTemplateColumns: "auto minmax(0, 1fr) minmax(var(--soutenance-grid-actions), auto)" }}
                        >
                          <StakeholderIcon
                            type='expert2'
                            iconKey={resolveStakeholderIconKey(stakeholderIcons, "expert2")}
                            label='Expert 2'
                          />
                          <span className='slot-value'>
                            <TruncatedText text={tpiData?.expert2?.name} maxLength={TPI_SLOT_NAME_MAX_LENGTH} />
                          </span>
                          {!hideLegacyActions ? (
                            <TpiSoutenanceActionButtons
                              participantName={tpiData?.expert2?.name}
                              expertOrBoss='expert2'
                              tpiData={tpiData}
                              listOfPerson={listOfPerson}
                              token={token}
                              onAccept={(selectedTpiData, role) =>
                                handleAcceptClick(year, selectedTpiData, role)
                              }
                              onProposition={handlePropositionClick}
                            />
                          ) : null}
                        </div>

                        <div
                          className={`tpi-row-block ${bossLockedClass} ${bossFocusClass}`}
                          style={{ gridTemplateColumns: "auto minmax(0, 1fr) minmax(var(--soutenance-grid-actions), auto)" }}
                        >
                          <StakeholderIcon
                            type='projectManager'
                            iconKey={resolveStakeholderIconKey(stakeholderIcons, "projectManager")}
                            label='Chef de projet'
                          />
                          <span className='slot-value'>
                            <TruncatedText text={tpiData?.boss?.name} maxLength={TPI_SLOT_NAME_MAX_LENGTH} />
                          </span>
                          {!hideLegacyActions ? (
                            <TpiSoutenanceActionButtons
                              participantName={tpiData?.boss?.name}
                              expertOrBoss='boss'
                              tpiData={tpiData}
                              listOfPerson={listOfPerson}
                              token={token}
                              onAccept={(selectedTpiData, role) =>
                                handleAcceptClick(year, selectedTpiData, role)
                              }
                              onProposition={handlePropositionClick}
                            />
                          ) : null}
                        </div>
                      </div>
                    </Fragment>
                  )
                })}
          </article>
        )})}
      </div>

      {isPersonIcalMode && filteredIcalEvents.length > 0 ? (
        <section className='soutenance-person-ical'>
          <p>
            Télécharger votre iCal pour insérer vos défenses dans votre agenda Outlook.
          </p>
          <div className='soutenance-person-ical-actions'>
            <button
              type='button'
              className='soutenance-person-ical-button'
              onClick={downloadFilteredICal}
              aria-label={`Télécharger votre iCal Outlook pour ${personIcalFilter.name}`}
            >
              <IcalDownloadIcon />
              <span>Télécharger votre iCal</span>
            </button>
            {typeof onClearPersonFilters === "function" ? (
              <button
                type='button'
                className='soutenance-clear-person-filter'
                onClick={onClearPersonFilters}
                aria-label={clearPersonFilterLabel}
                data-tooltip={clearPersonFilterLabel}
              >
                <ClearPersonFilterIcon />
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {showPopup && (
        <CreneauPropositionPopup
          expertOrBoss={scheduleSuggester}
          tpiData={currentTpiData}
          schedule={schedule}
          fermerPopup={logAndClosePopup}
        />
      )}
    </>
  )
}

export default RenderRooms
