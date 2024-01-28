import React, { useState, useEffect, Fragment } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import CreneauPropositionPopup from './CreneauPropositionPopup'

import { showNotification } from '../Utils'

import '../../css/tpiSoutenance/tpiSoutenance.css'

const fetchSoutenanceData = async year => {
  const apiUrl = 'http://localhost:5000'
  try {
    const response = await fetch(`${apiUrl}/api/tpiyear/${year}`)

    if (response.ok) {
      return await response.json()
    } else {
      showNotification('Erreur lors de la récupération des données', 'error')
      return null
    }
  } catch (error) {
    showNotification(`Erreur réseau: {error}`, 'error')
    return null
  }
}

const fetchTpiListExperts = async () => {
  const apiUrl = 'http://localhost:5000';
  try {
    const listOfExpertsOrBoss = await fetch(`${apiUrl}/api/experts/listExpertsOrBoss`);

    if (listOfExpertsOrBoss.ok) {
      return await listOfExpertsOrBoss.json();
    } else {
      showNotification('Erreur lors de la récupération de la liste des experts', 'error');
      return null;
    }
  } catch (error) {
    showNotification(`Erreur réseau: ${error}`, 'error'); // Correction ici
    return null;
  }
};


const updateSoutenanceData = async (year, propositions, tpi, expertOrBoss) => {
  const apiUrl = 'http://localhost:5000';
  try {
    const response = await fetch(`${apiUrl}/api/tpiyear/${year}/${tpi._id}/${tpi.id}/${expertOrBoss}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(propositions),
    });

    if (response.ok) {
      showNotification(`Données de soutenance mises à jour avec succès pour l'année ${year}`);
    } else {
      showNotification(`Erreur lors de la mise à jour des données de soutenance pour l'année ${year}`, 'error');
    }
  } catch (error) {
    showNotification('Erreur réseau lors de la mise à jour des données de soutenance:', error);
  }
};


function TruncatedText({ text, maxLength }) {
  const isTruncated = text.length > maxLength
  return (
    <span
      title={isTruncated ? text : ''}
      className={isTruncated ? 'truncated-text' : 'nameTpi'}
    >
      {isTruncated ? `${text.substring(0, maxLength - 3)}...` : text}
    </span>
  )
}

// Fonction pour formater la date
const formatDate = dateString => {
  const options = { year: 'numeric', month: 'long', day: 'numeric' }
  return new Intl.DateTimeFormat('fr-FR', options).format(new Date(dateString))
}

function renderSchedule(schedule) {
  return (
    <div className='horairesBox'>
      {schedule.map((slot, i) => (
        <div key={i} className={`horaire_${i}-${slot.startTime}`}>
          <p className='startTime'>{slot.startTime}</p>
          <p className='endTime'>{slot.endTime}</p>
        </div>
      ))}
    </div>
  )
}

const RenderRooms = ({ year, tpiDatas, schedule, listOfPerson }) => {
  const [showPopup, setShowPopup] = useState(false)
  const [currentTpiData, setCurrentTpiData] = useState(null)
  const [scheduleSuggester, setScheduleSuggester] = useState(null)

  const location = useLocation()
  const queryParams = new URLSearchParams(location.search)
  // const userRole = queryParams.get('role'); // ? role=le role
  const paramsToken = queryParams.get('token') // ? &token

  const handleAcceptClick = async (sendYear, tpiData, expertOrBoss) => {
    try {
      const propositions = {
        offres: {
          isValidated: true,
          submit: []
        }
      };

      // Mettez à jour la base de données avec les données mises à jour
      await updateSoutenanceData(sendYear, propositions, tpiData, expertOrBoss);
    } catch (error) {
      console.error("Erreur lors de la mise à jour des données :", error);
    }
  };

  const handlePropositionClick = (tpiData, expertOrBoss) => {
    // Afficher le popup pour modifier le créneau
    setCurrentTpiData(tpiData);

    if (tpiData[expertOrBoss]?.offres.submit.length > 0) {
      // Si le tableau n'est pas vide, afficher un message d'avertissement
      alert("Attention : En continuant, vous écraserez les demandes précédentes !");
    }
    setScheduleSuggester(expertOrBoss);
    setShowPopup(true);
  }

  // Fonction pour rendre les boutons d'actions
  const renderActionButtons = (tpiData, how, expertOrBoss) => {
    const isExpertValidated = tpiData[expertOrBoss]?.offres?.isValidated;
    const isSubmitButtonActive = tpiData[expertOrBoss]?.offres?.submit;



    // Classe pour indiquer l'invitation à valider (isValidated est null)
    const invitationClass = isExpertValidated === null ? 'invitation' : '';

    // Classe pour indiquer true ou false pour isValidated
    const isValidatedClass = isExpertValidated === true ? 'true' : isExpertValidated === false ? 'false' : 'null';

    // Classe pour submit (soit vide, soit un tableau)
    const submitClass =
      Array.isArray(isSubmitButtonActive) && isSubmitButtonActive.length === 0 ? 'empty' :
        Array.isArray(isSubmitButtonActive) ? 'has-values' : '';

    // Texte par défaut pour le bouton d'acceptation
    const acceptButtonText = '✔';

    // Emoji par défaut pour le bouton de proposition
    const submitButtonEmoji = '?';

    const expertPropositions = (tpiData[expertOrBoss]?.offres && tpiData[expertOrBoss].offres.submit) || null;
    
    let proposedSlot = '';
    if (expertPropositions) {
      for (const proposition of expertPropositions) {
        const date = new Date(proposition.date).toLocaleDateString();
        const creneau = proposition.creneau;
        proposedSlot += `${date}/${creneau}\n`;
      }
    } else {
      // Gérez le cas où expertPropositions est null ici
      // Par exemple, si le client n'a pas encore fait d'offre, vous pouvez afficher un message ou une valeur par défaut
      proposedSlot = "Aucune offre faite par le client.";
    }
    const person = listOfPerson.find(person => person.name === how);
    let token = null; // Initialisez token à null par défaut
    if (person) {
      token = person.token; // Si person est défini, récupérez le token
    }

    return (
      <span className={`action-buttons ${invitationClass}`}>
        <button
          title={`✔\tEn attente de validation\nOK\tCréneau validé\nX\tCréneau refusé`}
          className={`button-${isValidatedClass}`}
          onClick={() => token === paramsToken && handleAcceptClick(year, tpiData, expertOrBoss)}
        >
          {isValidatedClass === 'true' ? 'OK' : isValidatedClass === 'false' ? 'X' : acceptButtonText}

        </button>
        <button
          title={`${proposedSlot}`}
          className={`button-${submitClass}`}
          onClick={() => token === paramsToken && handlePropositionClick(tpiData, expertOrBoss)}>
          {submitClass === 'has-values' ? '-' : submitClass === 'empty' ? submitButtonEmoji : ''}
        </button>
      </span>
    )
  }

  return (
    <div className='salles-container'>
      {tpiDatas.map((salle, indexSalle) => (
        <div className={`salle ${salle.site}`}>
          <div className={`header_${indexSalle}`}>
            <h3>{formatDate(salle.date)}</h3>
            <h4>{salle.name}</h4>
          </div>

          {schedule.map((slot, index) => {
            const tpiData = salle.tpiDatas && salle.tpiDatas[index]
            return (
              <Fragment key={`${indexSalle}-${slot.startTime}-${slot.endTime}`}>

                <div className='tpi-data' id={tpiData?.id}>
                  <div className='tpi-container'>
                    <div className='tpi-entry no-buttons'>
                      Candidat:{' '}
                      <TruncatedText text={tpiData?.candidat} maxLength={30} />
                    </div>

                    <div className='tpi-entry'>
                      <div className='tpi-expert1'>
                        Expert1 :{' '}
                        <TruncatedText text={tpiData?.expert1.name} maxLength={24} />
                      </div>
                      {renderActionButtons(tpiData, tpiData?.expert1.name, 'expert1')}
                    </div>

                    <div className='tpi-entry'>
                      <div className='tpi-expert2'>
                        Expert2 :{' '}
                        <TruncatedText text={tpiData?.expert2.name} maxLength={24} />
                      </div>
                      {renderActionButtons(tpiData, tpiData?.expert2.name, 'expert2')}
                    </div>

                    <div className='tpi-entry'>
                      <div className='tpi-boss'>
                        Mentor  :{' '}
                        <TruncatedText text={tpiData?.boss.name} maxLength={24} />
                      </div>
                      {renderActionButtons(tpiData, tpiData?.boss.name, 'boss')}
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
          expertOrBoss={scheduleSuggester}
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
  const [listOfExpertsOrBoss, setListOfExpertsOrBoss] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    console.log(`Début de l'appel useEffect, année : ${year}`);
    setIsLoading(true);

    fetchSoutenanceData(year).then(data => {
      console.log('Données de soutenance reçues:', data);
      if (data) {
        setSoutenanceData(data);
      } else {
        setError('Impossible de charger les données de soutenance');
        console.error('Erreur lors du chargement des données de soutenance');
      }
      setIsLoading(false);
    });

    fetchTpiListExperts().then(list => {
      console.log('Liste des experts ou responsables reçue:', list);
      if (list) {
        setListOfExpertsOrBoss(list);
      } else {
        setError('Impossible de charger la liste des experts ou responsables');
        console.error('Erreur lors du chargement de la liste des experts ou responsables');
      }
      setIsLoading(false);
    });

    console.log('Appels useEffect terminés');
  }, [year]);


  /**
   * Crée un tableau d'horaires pour les soutenances basé sur les paramètres fournis.
   * Pour chaque créneau, elle calcule l'heure de début et de fin en fonction du temps alloué pour chaque TPI
   * et des pauses, puis formate ces horaires avant de les ajouter au tableau.
   * 
   * @param {Object} soutenanceData - Contient les paramètres de configuration comme le temps par TPI,
   *                                  l'heure de début du premier TPI, et le nombre total de créneaux.
   * @returns {Array} - Un tableau contenant les horaires de début et de fin pour chaque créneau de soutenance.
   */

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


  // Ajout de champs d'entrée pour les filtres restants
  return (
    <Fragment>

      <span className='title'> Soutenances de {year}</span>

      <div id='soutenances'>
        <div className='dataGrid'>
          {renderSchedule(schedule)}
          <RenderRooms year={year} tpiDatas={soutenanceData} schedule={schedule} listOfPerson={listOfExpertsOrBoss} />
        </div>
      </div>
    </Fragment>
  )
}
export default TpiSoutenance
