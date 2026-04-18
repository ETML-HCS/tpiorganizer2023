import React, { Fragment, useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { buildTpiDetailsLink } from "../tpiDetail/tpiDetailUtils"

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
  return room?.roomClassMode === "matu" ? "SPECIAL" : ""
}

function getLegacyScheduleIndex(tpiData, fallbackIndex = 0) {
  if (Number.isInteger(tpiData?.originalIndex)) {
    return tpiData.originalIndex
  }

  const parsedIndex = parseInt(tpiData?.id?.split("_").pop(), 10)
  return Number.isNaN(parsedIndex) ? fallbackIndex : parsedIndex
}

function getDisplayedSlot(tpiData, schedule, fallbackIndex = 0) {
  if (tpiData?.startTime && tpiData?.endTime) {
    return {
      startTime: tpiData.startTime,
      endTime: tpiData.endTime
    }
  }

  return schedule[getLegacyScheduleIndex(tpiData, fallbackIndex)] || {
    startTime: "",
    endTime: ""
  }
}

function getRoomSchedule(room, schedule) {
  if (!room?.tpiDatas?.length) {
    return schedule
  }

  return room.tpiDatas.map((tpiData, index) => getDisplayedSlot(tpiData, schedule, index))
}

const MobileMesTpiFilter = ({ mesTpi, hasToken, year }) => {
  useEffect(() => {
    const msgClass = document.querySelector(".message-smartphone")
    const filtersClass = document.querySelector(".filters-smartphone")
    if (msgClass) {
      msgClass.remove()
    }
    if (filtersClass) {
      filtersClass.remove()
    }
  }, [])

  if (!hasToken) {
    return <div>Chargement en cours...</div>
  }

  return (
    <Fragment>
      <h1 className='title'>Soutenance TPI - Version mobile</h1>
      <br />
      <div className='salles-container-smartphone'>
        {mesTpi.map((salle, indexSalle) => (
          <div key={indexSalle} className={`salle ${salle.site}`}>
            <div className={`header_${indexSalle}`}>
              <h3>{formatDate(salle.date)}</h3>
              <h4>{salle.name}</h4>
            </div>

            {salle.tpiDatas.map((tpi, indexTpi) => {
              const { candidat, expert1, expert2, boss } = tpi || {}
              return (
                <Fragment key={`${indexSalle}-${indexTpi}`}>
                  <div className='tpi-data mobile-tpi-data' id={tpi?.id}>
                    {tpi?.refTpi ? (
                      <Link
                        className='btnTpiDossier'
                        to={buildTpiDetailsLink(year, tpi.refTpi)}
                        title={`Ouvrir la fiche ${tpi.refTpi}`}
                      >
                        Fiche
                      </Link>
                    ) : null}

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

                      <div className='tpi-entry'>
                        <div className='tpi-boss'>
                          {" "}
                          cdp {" > "}
                          {boss.name}
                        </div>
                      </div>
                    </div>
                  </div>
                </Fragment>
              )
            })}
          </div>
        ))}
      </div>
    </Fragment>
  )
}

const MobileRoomFilter = ({ rooms, schedule, year }) => {
  const [roomIndex, setRoomIndex] = useState(0)

  useEffect(() => {
    const msgClass = document.querySelector(".message-smartphone")
    const filtersClass = document.querySelector(".filters-smartphone")
    if (msgClass) {
      msgClass.remove()
    }
    if (filtersClass) {
      filtersClass.remove()
    }
  }, [])

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
  const currentRoomSchedule = getRoomSchedule(currentRoom, schedule)
  const roomClassLabel = getRoomClassLabel(currentRoom)

  const handleNextRoom = () => {
    setRoomIndex((prevIndex) => (prevIndex + 1) % rooms.length)
  }

  const handlePreviousRoom = () => {
    setRoomIndex((prevIndex) => (prevIndex - 1 + rooms.length) % rooms.length)
  }

  return (
    <div className='mobile-room-filter'>
      <div key={safeRoomIndex} className={`salle ${currentRoom.site}`}>
        <span className='site'>{currentRoom.site}</span>
        <div className={`header_${safeRoomIndex}`}>
          <h3>{formatDate(currentRoom.date)}</h3>
          <div className='soutenance-room-title-row'>
            <h4>{currentRoom.name}</h4>
            {roomClassLabel ? (
              <span
                className='soutenance-room-class-badge is-matu'
                title='Salle SPECIAL'
                aria-label='Salle SPECIAL'
              >
                {roomClassLabel}
              </span>
            ) : null}
          </div>
        </div>
        {currentRoom.tpiDatas.map((tpiData, index) => {
          const displayedSlot = currentRoomSchedule[index] || {
            startTime: "",
            endTime: ""
          }
          const { candidat, expert1, expert2, boss } = tpiData
          return (
            <React.Fragment key={index}>
              <div className='tpi-data' id={tpiData.id}>
                {tpiData?.refTpi ? (
                  <Link
                    className='btnTpiDossier'
                    to={buildTpiDetailsLink(year, tpiData.refTpi)}
                    title={`Ouvrir la fiche ${tpiData.refTpi}`}
                  >
                    Fiche
                  </Link>
                ) : null}

                <div className='time-label'>
                  {formatTimeRange(displayedSlot.startTime, displayedSlot.endTime)}
                </div>
                <div className='tpi-container'>
                  <div className='tpi-entry tpi-candidat'>
                    <TruncatedText text={candidat} maxLength={20} />
                  </div>
                  <div className='tpi-entry'>
                    <div className='tpi-expert1'>Expert1: </div>
                    <TruncatedText text={expert1?.name} maxLength={20} />
                  </div>
                  <div className='tpi-entry'>
                    <div className='tpi-expert2'>Expert2: </div>
                    <TruncatedText text={expert2?.name} maxLength={20} />
                  </div>
                  <div className='tpi-entry'>
                    <div className='tpi-boss'>CDP {">>"}</div>
                    <TruncatedText text={boss?.name} maxLength={20} />
                  </div>
                </div>
              </div>
            </React.Fragment>
          )
        })}
      </div>
      <button onClick={handlePreviousRoom}>Gauche</button>
      <button onClick={handleNextRoom}>Droite</button>
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
  isScrolled,
  isDemo,
  year,
  expertOrBoss,
  isOn,
  setIsOn,
  updateFilter,
  filters,
  uniqueExperts,
  uniqueProjectManagers,
  uniqueCandidates,
  uniqueDates,
  uniqueSites,
  uniqueSalles
}) => {
  return (
    <div className={`header-soutenance${isScrolled ? "hidden" : ""}`}>
      <div className={isDemo ? "demo" : "title"}>
        {" "}
        Soutenances de {year}
      </div>

      {expertOrBoss && expertOrBoss.name !== null && (
        <div className='welcom'>
          <p>Bonjour {expertOrBoss.name}</p>
        </div>
      )}
      {!expertOrBoss && (
        <div className='welcom'>
          <p>Bonjour Visiteur</p>
        </div>
      )}

      <div className='filters'>
        {expertOrBoss && expertOrBoss.name !== null && (
          <>
            <div>
              {expertOrBoss.role !== "candidate" && (
                <ToggleFilterButton
                  isOn={isOn}
                  setIsOn={setIsOn}
                  updateFilter={updateFilter}
                  expertOrBoss={expertOrBoss}
                />
              )}
            </div>
          </>
        )}

        {!expertOrBoss && (
          <>
            <select
              value={filters.experts}
              onChange={(e) => updateFilter("experts", e.target.value)}
            >
              <option value=''>Tous les experts</option>
              {uniqueExperts.map((expert) => (
                <option key={expert} value={expert}>
                  {expert}
                </option>
              ))}
            </select>

            <select
              value={filters.projectManager}
              onChange={(e) => updateFilter("projectManager", e.target.value)}
            >
              <option value=''>Tous les chefs de projet</option>
              {uniqueProjectManagers.map((manager) => (
                <option key={manager} value={manager}>
                  {manager}
                </option>
              ))}
            </select>

            <select
              value={filters.candidate}
              onChange={(e) => updateFilter("candidate", e.target.value)}
            >
              <option value=''>Tous les candidats</option>
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
          </>
        )}

        <select
          value={filters.date}
          onChange={(e) => updateFilter("date", e.target.value)}
        >
          <option value=''>Toutes les dates</option>
          {uniqueDates.map((date) => (
            <option key={date} value={date}>
              {date}
            </option>
          ))}
        </select>

        <select
          value={filters.site}
          onChange={(e) => updateFilter("site", e.target.value)}
        >
          <option value=''>Tous les sites</option>
          {uniqueSites.map((site) => (
            <option key={site} value={site}>
              {site}
            </option>
          ))}
        </select>

        <select
          value={filters.nameRoom}
          onChange={(e) => updateFilter("nameRoom", e.target.value)}
        >
          <option value=''>Toutes les salles</option>
          {uniqueSalles.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </div>
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
  getRoomClassLabel,
  getRoomSchedule,
  renderSchedule
}
