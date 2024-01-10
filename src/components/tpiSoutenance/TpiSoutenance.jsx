import React, { useState, useEffect, Fragment } from 'react'
import { useLocation, useParams } from 'react-router-dom'

import { showNotification } from '../Utils'

import CreneauPropositionPopup from './CreneauPropositionPopup'
import '../../css/tpiSoutenance/tpiSoutenance.css'

const fetchSoutenanceData = async year => {
  const apiUrl = 'http://localhost:5000'
  try {
    console.log('API tpiyear  ', year)
    const response = await fetch(`${apiUrl}/api/tpiyear/${year}`)
    if (response.ok) {
      return await response.json()
    } else {
      console.error('Erreur lors de la récupération des données')
      return null
    }
  } catch (error) {
    console.error('Erreur réseau:', error)
    return null
  }
}

function TruncatedText({ text, maxLength }) {
  const isTruncated = text.length > maxLength;
  return (
    <span
      title={isTruncated ? text : ''}
      className={isTruncated ? 'truncated-text' : ''}
    >
      {isTruncated ? `${text.substring(0, maxLength - 3)}...` : text}
    </span>
  );
}




// Fonction pour formater la date
const formatDate = dateString => {
  const options = { year: 'numeric', month: 'long', day: 'numeric' }
  return new Intl.DateTimeFormat('fr-FR', options).format(new Date(dateString))
}

function renderSchedule(schedule) {
  return (
    <div className='horairesBox'>
      {schedule.map((slot, index) => (
        <div key={index} className={`horaire_${index}`}>
          <p className='startTime'>{slot.startTime}</p>
          <p className='endTime'>{slot.endTime}</p>
        </div>
      ))}
    </div>
  )
}

const RenderRooms = ({ filteredData, schedule }) => {
  const [showPopup, setShowPopup] = useState(false)
  const [currentTpiData, setCurrentTpiData] = useState(null)
  const [scheduleSuggester, setScheduleSuggester] = useState(null)

  const location = useLocation()
  const queryParams = new URLSearchParams(location.search)
  // const userRole = queryParams.get('role'); // ? role=le role
  const userName = queryParams.get('name') // ? &name=nom

  const handleAcceptClick = tpiData => {
    // Logique pour gérer l'acceptation du créneau
  }

  const handlePropositionClick = (tpiData, how) => {
    // Afficher le popup pour modifier le créneau
    console.log('tpiData: ', tpiData, ' schedule: ', schedule)
    setCurrentTpiData(tpiData)
    setScheduleSuggester(how)
    setShowPopup(true)
  }

  // Fonction pour rendre les boutons d'actions
  const renderActionButtons = (tpiData, how) => {
    return (
      <span className='action-buttons'>
        <button
          className={
            tpiData.isValidated ? 'button-validated' : 'button-not-validated'
          }
          onClick={() => how === userName && handleAcceptClick(tpiData, how)}
        >
          &#x2713;
        </button>
        <button
          className={
            tpiData.isProposition ? 'button-validated' : 'button-not-validated'
          }
          onClick={() =>
            how === userName && handlePropositionClick(tpiData, how)
          }
        >
          &#x003F;
        </button>
      </span>
    )
  }

  return (
    <div className='salles-container'>
      {filteredData.map((salle, indexSalle) => (
        <div className={`salle ${salle.site}`}>
          <div className={`header_${indexSalle}`}>
            <h3>{formatDate(salle.date)}</h3>
            <h4>{salle.name}</h4>
          </div>

          {schedule.map((slot, index) => {
            const tpiData = salle.tpiDatas && salle.tpiDatas[index]
            return (
              <Fragment key={`${tpiData?.id}`}>
                <div className='tpi-data' id={tpiData?.id}>
                  <div className='tpi-container'>
                    <div className='tpi-entry no-buttons'>
                      Candidat: <TruncatedText text={tpiData?.candidat} maxLength={30} />

                    </div>
                    <div className='tpi-entry'>
                      Exp1: <TruncatedText text={tpiData?.expert1} maxLength={24} />
                      {renderActionButtons(tpiData, tpiData?.expert1)}
                    </div>
                    <div className='tpi-entry'>
                      Exp2: <TruncatedText text={tpiData?.expert2} maxLength={24} />
                      {renderActionButtons(tpiData, tpiData?.expert2)}
                    </div>
                    <div className='tpi-entry'>
                      Lead: <TruncatedText text={tpiData?.boss} maxLength={24} />
                      {renderActionButtons(tpiData, tpiData?.boss)}
                    </div>
                  </div>
                </div>
              </Fragment>
            )
          })}
        </div>
      ))}
      {showPopup && (
        // Composant Popup pour saisir les nouvelles propositions
        <CreneauPropositionPopup
          how={scheduleSuggester}
          tpiData={currentTpiData}
          schedule={schedule}
          fermerPopup={() => setShowPopup(false)}
        />
      )}
    </div>
  )
}

const TpiSoutenance = () => {
  const { year } = useParams()
  const [soutenanceData, setSoutenanceData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // États pour les critères de filtrage
  const [filterSite, setFilterSite] = useState('')
  const [filterSalle, setFilterSalle] = useState('')
  const [filterExpert1, setFilterExpert1] = useState('')
  const [filterExpert2, setFilterExpert2] = useState('')
  const [filterBoss, setFilterBoss] = useState('')
  const [filterCandidat, setFilterCandidat] = useState('')

  useEffect(() => {
    setIsLoading(true)
    fetchSoutenanceData(year).then(data => {
      if (data) {
        setSoutenanceData(data)
      } else {
        setError('Impossible de charger les données')
      }
      setIsLoading(false)
    })
  }, [year])

  const filteredData = soutenanceData.filter(
    salle =>
      (filterSite === '' ||
        salle.site.toLowerCase().includes(filterSite.toLowerCase())) &&
      (filterSalle === '' ||
        salle.name.toLowerCase().includes(filterSalle.toLowerCase())) &&
      salle.tpiDatas.some(
        tpiData =>
          (filterExpert1 === '' ||
            tpiData.expert1
              .toLowerCase()
              .includes(filterExpert1.toLowerCase())) &&
          (filterExpert2 === '' ||
            tpiData.expert2
              .toLowerCase()
              .includes(filterExpert2.toLowerCase())) &&
          (filterBoss === '' ||
            tpiData.boss.toLowerCase().includes(filterBoss.toLowerCase())) &&
          (filterCandidat === '' ||
            tpiData.candidat
              .toLowerCase()
              .includes(filterCandidat.toLowerCase()))
      )
  )

  function createSchedule(soutenanceData) {
    const schedule = []
    const { breakline, tpiTime, firstTpiStart, numSlots } =
      soutenanceData.configSite
    let currentTime = firstTpiStart

    for (let i = 0; i < numSlots; i++) {
      let startTime = currentTime
      let endTime = currentTime + tpiTime

      let startHours = Math.floor(startTime)
      let startMinutes = Math.floor((startTime % 1) * 60)
      let endHours = Math.floor(endTime)
      let endMinutes = Math.floor((endTime % 1) * 60)

      let startTimeFormatted = `${startHours < 10 ? '0' + startHours : startHours
        }:${startMinutes < 10 ? '0' + startMinutes : startMinutes}`
      let endTimeFormatted = `${endHours < 10 ? '0' + endHours : endHours}:${endMinutes < 10 ? '0' + endMinutes : endMinutes
        }`

      if (i !== 7) {
        endTime += breakline
        currentTime += breakline
      }

      schedule.push({
        startTime: startTimeFormatted,
        endTime: endTimeFormatted
      })

      currentTime = endTime
    }

    return schedule
  }

  // Conditionnez l'appel à createSchedule lorsque soutenanceData est disponible
  const schedule =
    soutenanceData.length > 0 ? createSchedule(soutenanceData[0]) : []

  if (isLoading) {
    return <div>Chargement...</div>
  }

  if (error) {
    return <div>Erreur : {error}</div>
  }

  function createFilterInput(placeholder, value, setValue) {
    return (
      <input
        type='text'
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
      />
    )
  }

  // Ajout de champs d'entrée pour les filtres restants
  return (
    <div className='soutenance'>
      <h1>Soutenances de {year}</h1>

      <div className='filters'>
        {createFilterInput('Filtrer par site', filterSite, setFilterSite)}
        {createFilterInput('Filtrer par salle', filterSalle, setFilterSalle)}
        {createFilterInput(
          'Filtrer par expert 1',
          filterExpert1,
          setFilterExpert1
        )}
        {createFilterInput(
          'Filtrer par expert 2',
          filterExpert2,
          setFilterExpert2
        )}
        {createFilterInput(
          'Filtrer par responsable',
          filterBoss,
          setFilterBoss
        )}
        {createFilterInput(
          'Filtrer par candidat',
          filterCandidat,
          setFilterCandidat
        )}
      </div>

      <div className='dataGrid'>
        {renderSchedule(schedule)}
        <RenderRooms filteredData={filteredData} schedule={schedule} />
      </div>
    </div>
  )
}
export default TpiSoutenance
