import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { showNotification } from '../Tools.jsx'
import config from '../../config/configO2023.json'

const CreneauPropositionPopup = ({
  expertOrBoss,
  tpiData,
  schedule,
  fermerPopup
}) => {
  const [propositions, setPropositions] = useState([])
  const [selectedDate, setSelectedDate] = useState('')
  // const [selectedDate, setSelectedDate] = useState('');
  const [selectedCreneau, setSelectedCreneau] = useState('')
  const [forceRender, setForceRender] = useState(false)

  const { year } = useParams() // Extrait l'année des paramètres d'URL

  // Pour accéder à la variable d'environnement REACT_APP_DEBUG
  const debugMode = process.env.REACT_APP_DEBUG === 'true' // Convertir en booléen si nécessaire

  // Pour accéder à la variable d'environnement REACT_APP_API_URL
  const apiUrl = debugMode
    ? process.env.REACT_APP_API_URL_TRUE
    : process.env.REACT_APP_API_URL_FALSE

  useEffect(() => {
    if (schedule.length > 0) {
      const premierCreneau = `${schedule[0].startTime} - ${schedule[0].endTime}`
      setSelectedCreneau(premierCreneau)
    }
  }, [schedule])

  const ajouterProposition = () => {
    // Vérification de la sélection de la date et du créneau
    if (selectedDate && selectedCreneau) {
      if (propositions.length < 3) {
        // Vérifie les doublons avant d'ajouter
        if (
          !propositions.some(
            prop =>
              prop.date === selectedDate && prop.creneau === selectedCreneau
          )
        ) {
          setPropositions([
            ...propositions,
            { date: selectedDate, creneau: selectedCreneau }
          ])
        } else {
          showNotification('Cette proposition a déjà été faite.', 2000)
        }
      } else {
        showNotification('Vous ne pouvez pas ajouter plus de 3 propositions.')
      }
    } else {
      showNotification('Veuillez sélectionner une date et un créneau.')
    }
  }

  const handleDateChange = e => {
    setSelectedDate(e.target.value)
  }

  const sauvegarderPropositions = async () => {
    const url = `${apiUrl}/api/save-propositions/${year}/${expertOrBoss}/${tpiData.id}/${tpiData._id}`

    const propositionsData = {
      isValidated: false,
      submit: propositions
    }

    try {
      const response = await envoyerRequete(url, 'PUT', propositionsData)
      traiterReponse(response)
    } catch (error) {
      console.error('Erreur :', error)
      afficherNotificationErreur()
    } finally {
      // Mettre à jour l'état pour forcer un re-render
      setForceRender(prevState => !prevState)
      fermerPopup()
    }
  }

  const envoyerRequete = async (url, method, body) => {
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(
        'Erreur lors de la mise à jour des propositions acceptées'
      )
    }
    return response
  }

  const traiterReponse = response => {
    showNotification('Propositions mises à jour avec succès', 'success')
  }

  const afficherNotificationErreur = () => {
    showNotification('Erreur lors de la mise à jour de la proposition', 'error')
  }

  // Conversion des créneaux en  pair de périodes
  const p = ['01', '03', '05', '07', '09', '11', '13', '15', '17']

  return (
    <div className='popup-container'>
      <div className='popup'>
        <h3>Propositions de créneau pour {tpiData?.candidat}</h3>

        <select value={selectedDate} onChange={handleDateChange}>
          <option value=''>Sélectionnez une date</option>
          {config.soutenanceDates.map(date => (
            <option key={date} value={date}>
              {date}
            </option>
          ))}
        </select>

        <select
          value={selectedCreneau}
          onChange={e => setSelectedCreneau(e.target.value)}
        >
          {schedule.map((creneau, index) => (
            <option
              key={`select_${index}-${creneau}`}
              value={`${creneau.startTime} - ${creneau.endTime}`}
            >
              {`P${p[index]} \u00A0\u00A0 ${creneau.startTime} - ${creneau.endTime}`}
            </option>
          ))}
        </select>

        {/* Désactive le bouton si la date ou le créneau n'est pas sélectionné */}
        <button
          id='btnAddDate'
          onClick={ajouterProposition}
          disabled={!selectedDate || !selectedCreneau}
        >
          Ajouter
        </button>
        <ul>
          <h4> Ci-dessous vos propositions : </h4>
          {propositions.map((prop, index) => (
            <li key={`Creneau_${index}`}>{`${prop.date} - ${prop.creneau}`}</li>
          ))}
        </ul>
        <span>
          <button id='btnSave' onClick={sauvegarderPropositions}>
            Sauvegarder
          </button>

          <button id='btnClose' onClick={fermerPopup}>
            Fermer
          </button>
        </span>
      </div>
    </div>
  )
}
export default CreneauPropositionPopup
