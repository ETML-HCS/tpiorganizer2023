import React, { Fragment, useState } from "react"

import CreneauPropositionPopup from "./CreneauPropositionPopup"
import TpiSoutenanceActionButtons from "./TpiSoutenanceActionButtons"
import {
  TruncatedText,
  formatDate,
  formatTimeRange,
  getDisplayedSlot,
  getRoomClassLabel,
  getRoomSchedule
} from "./TpiSoutenanceParts"

import { showNotification } from "../Tools"

const RenderRooms = ({
  year,
  tpiDatas,
  schedule,
  listOfPerson,
  isAnyFilterApplied,
  loadData,
  token,
  isOn,
  updateSoutenanceData
}) => {
  const [showPopup, setShowPopup] = useState(false)
  const [currentTpiData, setCurrentTpiData] = useState(null)
  const [scheduleSuggester, setScheduleSuggester] = useState(null)

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

  const downloadICal = (salle, tpi) => {
    const displayedSlot = getDisplayedSlot(tpi, schedule)
    const timeStart = displayedSlot.startTime
    const timeEnd = displayedSlot.endTime

    if (!timeStart || !timeEnd) {
      showNotification("Horaire de soutenance indisponible pour l'export iCal", "error")
      return
    }

    const formattedDate = new Date(salle.date)
      .toISOString()
      .slice(0, 19)
      .replace(/[-:]/g, "")

    const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//tpiOrganizer2023//iCal
BEGIN:VTIMEZONE
TZID:Europe/Berlin
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
DTSTAMP:20240401T131913Z
UID:${tpi.refTpi}
DTSTART;TZID=Europe/Berlin:${formattedDate.replace(
      "T000000",
      "T" + timeStart.replace(":", "") + "00"
    )}
DTEND;TZID=Europe/Berlin:${formattedDate.replace(
      "T000000",
      "T" + timeEnd.replace(":", "") + "00"
    )}
SUMMARY:Soutenance TPI ${tpi.refTpi} - ${tpi.candidat} ${timeStart}-${timeEnd}
DESCRIPTION:Soutenance de TPI ${tpi.candidat}\\nExpert 1: ${
      tpi.expert1.name
    }\\nExpert 2: ${tpi.expert2.name}\\nEncadrant: ${tpi.boss.name}
LOCATION:${salle.name}
TRANSP:TRANSPARENT
CLASS:PUBLIC
END:VEVENT
END:VCALENDAR`

    const blob = new Blob([icalContent], { type: "text/calendar" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${tpi.candidat}_TPI.ics`
    a.style.display = "none"

    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className='salles-container'>
      {tpiDatas.map((salle, indexSalle) => (
        <div key={indexSalle} className={`salle ${salle.site}`}>
          <span className='site'>{salle.site}</span>
          <div className={`header_${indexSalle}`}>
            <h3>{formatDate(salle.date)}</h3>
            <div className='soutenance-room-title-row'>
              <h4>{salle.name}</h4>
              {getRoomClassLabel(salle) ? (
                <span
                  className='soutenance-room-class-badge is-matu'
                  title='Salle SPECIAL'
                  aria-label='Salle SPECIAL'
                >
                  {getRoomClassLabel(salle)}
                </span>
              ) : null}
            </div>
            <div className='header-row'>
              <div className='header-cell'>Nom du Candidat</div>
              <div className='header-cell'>Expert 1</div>
              <div className='header-cell'>Expert 2</div>
              <div className='header-cell'>Chef de Projet</div>
            </div>
          </div>

          {getRoomSchedule(salle, schedule).map((slot, index) => {
            const tpiData = salle.tpiDatas ? salle.tpiDatas[index] : null
            const { expert1, expert2, boss } = tpiData || {}

            const findPersonTokenByName = (name) => {
              const person = listOfPerson.find((personItem) => personItem.name === name)
              if (person) {
                return person.token
              }

              console.log(`La personne avec le nom "${name}" n'existe pas.`)
              return undefined
            }

            const expert1Token = findPersonTokenByName(expert1?.name)
            const expert2Token = findPersonTokenByName(expert2?.name)
            const bossToken = findPersonTokenByName(boss?.name)

            if (!tpiData) return null

            const displayedSlot = getDisplayedSlot(tpiData, schedule, index)

            return (
              <Fragment key={`${indexSalle}-${slot.startTime}-${slot.endTime}`}>
                <div
                  className='tpi-data'
                  id={tpiData?.id}
                  title={`${salle.site}\n${formatDate(salle.date)}\n${
                    formatTimeRange(displayedSlot.startTime, displayedSlot.endTime)
                  }`}
                >
                  <div
                    className={`${
                      !isAnyFilterApplied ? "no-filter" : "time-label"
                    }`}
                  >
                    {formatTimeRange(displayedSlot.startTime, displayedSlot.endTime)}
                  </div>

                  <div className='tpi-container'>
                    {tpiData.candidat && (
                      <button
                        type='button'
                        className='btniCal'
                        onClick={() => downloadICal(salle, tpiData)}
                      >
                        iCal &#x1F4E5;
                      </button>
                    )}

                    <div className='tpi-entry tpi-candidat'>
                      <div className='tpi-entry'>
                        <TruncatedText
                          text={tpiData?.candidat}
                          maxLength={25}
                        />
                      </div>
                    </div>

                    <div
                      className={`tpi-entry ${
                        !isOn && token && expert1Token !== token ? "gris" : ""
                      }`}
                    >
                      <div className='tpi-expert1'>Expert1 {": "}</div>

                      <div
                        className={`tpi-entry ${
                          !isOn && token === expert1Token ? "stabilo" : ""
                        }`}
                      >
                        <TruncatedText
                          text={tpiData?.expert1.name}
                          maxLength={20}
                        />
                      </div>
                      <TpiSoutenanceActionButtons
                        participantName={tpiData?.expert1.name}
                        expertOrBoss='expert1'
                        tpiData={tpiData}
                        listOfPerson={listOfPerson}
                        token={token}
                        onAccept={(selectedTpiData, role) =>
                          handleAcceptClick(year, selectedTpiData, role)
                        }
                        onProposition={handlePropositionClick}
                      />
                    </div>

                    <div
                      className={`tpi-entry ${
                        !isOn && token && expert2Token !== token ? "gris" : ""
                      }`}
                    >
                      <div className='tpi-expert2'>Expert2 {": "}</div>

                      <div
                        className={`tpi-entry ${
                          !isOn && token === expert2Token ? "stabilo" : ""
                        }`}
                      >
                        <TruncatedText
                          text={tpiData?.expert2.name}
                          maxLength={20}
                        />
                      </div>

                      <TpiSoutenanceActionButtons
                        participantName={tpiData?.expert2.name}
                        expertOrBoss='expert2'
                        tpiData={tpiData}
                        listOfPerson={listOfPerson}
                        token={token}
                        onAccept={(selectedTpiData, role) =>
                          handleAcceptClick(year, selectedTpiData, role)
                        }
                        onProposition={handlePropositionClick}
                      />
                    </div>

                    <div
                      className={`tpi-entry ${
                        !isOn && token && bossToken !== token ? "gris" : ""
                      }`}
                    >
                      <div className='tpi-boss'>CDP {" >> "}</div>
                      <div
                        className={`tpi-entry ${
                          !isOn && token === bossToken ? "stabilo" : ""
                        }`}
                      >
                        <TruncatedText
                          text={tpiData?.boss.name}
                          maxLength={20}
                        />
                      </div>
                      <TpiSoutenanceActionButtons
                        participantName={tpiData?.boss.name}
                        expertOrBoss='boss'
                        tpiData={tpiData}
                        listOfPerson={listOfPerson}
                        token={token}
                        onAccept={(selectedTpiData, role) =>
                          handleAcceptClick(year, selectedTpiData, role)
                        }
                        onProposition={handlePropositionClick}
                      />
                    </div>
                  </div>
                </div>
              </Fragment>
            )
          })}
        </div>
      ))}
      {showPopup && (
        <CreneauPropositionPopup
          expertOrBoss={scheduleSuggester}
          tpiData={currentTpiData}
          schedule={schedule}
          fermerPopup={logAndClosePopup}
        />
      )}
    </div>
  )
}

export default RenderRooms
