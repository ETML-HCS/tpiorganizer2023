import React, { useState, useEffect, Fragment, useMemo } from 'react';

import { useLocation, useParams } from 'react-router-dom'
import CreneauPropositionPopup from './CreneauPropositionPopup'

import { showNotification } from '../Utils'

import '../../css/tpiSoutenance/tpiSoutenance.css'

const isDemo = true; // affiche version démonstration 

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
          <p className='startTime'> - </p>
          <p className='endTime'>{slot.endTime}</p>
        </div>
      ))}
    </div>
  )
}

const RenderRooms = ({ year, tpiDatas, schedule, listOfPerson, filters }) => {
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
    // const acceptButtonText = '✔';

    // Taille du bouton HTML
    const buttonSize = 21; // Taille du bouton en pixels

    const acceptButtonColorNOT = '#1C2033'; // Couleur par défaut

    const acceptButtonSvgNot = (
      <svg
        width={buttonSize}
        height={buttonSize}
        viewBox="0 0 512 512"
        style={{ color: acceptButtonColorNOT }} // Utilisation de la variable de couleur
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        {/* Conteneur SVG */}
        <svg width="100%" height="100%" viewBox="0 0 16 14" fill={acceptButtonColorNOT} role="img" xmlns="http://www.w3.org/2000/svg">
          <g fill={acceptButtonColorNOT}>
            <path fill="currentColor" d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
          </g>
        </svg>
      </svg>
    );

    const acceptButtonColorOK = '#00ff08';

    const acceptButtonSvgOK = (
      <svg
        width={buttonSize}
        height={buttonSize}
        viewBox="0 0 512 512"
        style={{ color: acceptButtonColorOK }} // Utilisation de la variable de couleur
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        {/* Conteneur SVG */}
        <svg width="100%" height="100%" viewBox="0 0 16 14" fill={acceptButtonColorOK} role="img" xmlns="http://www.w3.org/2000/svg">
          <g fill={acceptButtonColorOK}>
            <path fill="currentColor" d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
          </g>
        </svg>
      </svg>
    );

    // Emoji par défaut pour le bouton de proposition
    // const submitButtonEmoji = '📅';
    const submitButtonColor = '#000000'; // Couleur par défaut

    const submitButtonSvg = (
      <svg
        width={buttonSize}
        height={buttonSize}
        viewBox="0 0 512 512"
        style={{ color: submitButtonColor }}
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        {/* Conteneur SVG */}
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill={submitButtonColor} xmlns="http://www.w3.org/2000/svg">
          <g fill={submitButtonColor}>
            <path fill="currentColor" d="m21.7 13.35l-1 1l-2.05-2l1-1c.2-.21.54-.22.77 0l1.28 1.28c.19.2.19.52 0 .72M12 18.94V21h2.06l6.06-6.12l-2.05-2L12 18.94M5 19h5v2H5a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h1V1h2v2h8V1h2v2h1a2 2 0 0 1 2 2v4H5v10M5 5v2h14V5H5Z" />
          </g>
        </svg>
      </svg>
    );

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
          {isValidatedClass === 'true' ? acceptButtonSvgOK : isValidatedClass === 'false' ? 'X' : acceptButtonSvgNot}

        </button>
        <button
          title={`${proposedSlot}`}
          className={`button-${submitClass}`}
          onClick={() => token === paramsToken && handlePropositionClick(tpiData, expertOrBoss)}>
          {submitClass === 'has-values' ? '-' : submitClass === 'empty' ? submitButtonSvg : ''}
        </button>
      </span>
    )
  }

  const isAnyFilterApplied = filters.expert !== "" || filters.candidate !== "" || filters.projectManager !== "";

  return (
    <div className='salles-container'>
      {tpiDatas.map((salle, indexSalle) => (

        <div key={indexSalle} className={`salle ${salle.site}`}>
          <div className={`header_${indexSalle}`}>
            <h3>{formatDate(salle.date)}</h3>
            <h4>{salle.name}</h4>
            <div class="header-row">
              <div class="header-cell">Nom du Candidat</div>
              <div class="header-cell">Expert 1</div>
              <div class="header-cell">Expert 2</div>
              <div class="header-cell">Chef de Projet</div>
            </div>
          </div>

          {schedule.map((slot, index) => {
            // Assurez-vous que tpiData est défini avant de l'utiliser
            const tpiData = salle.tpiDatas ? salle.tpiDatas[index] : null;

            // Continuez uniquement si tpiData est défini
            if (!tpiData) return null;

            // Extrait le numéro de ligne à partir de l'ID de tpiData
            const lineNumber = tpiData.id.split('_').pop();

            return (
              <Fragment key={`${indexSalle}-${slot.startTime}-${slot.endTime}`}>

                <div className='tpi-data' id={tpiData?.id}>
                  <div className={`${!isAnyFilterApplied ? 'no-filter' : 'time-label'}`}>
                    {`${schedule[lineNumber].startTime} - ${schedule[lineNumber].endTime}`}
                  </div>

                  <div className='tpi-container'>
                    <div className='tpi-entry no-buttons'>
                      {/* Candidat:{' '} */}
                      <TruncatedText text={tpiData?.candidat} maxLength={30} />
                    </div>

                    <div className='tpi-entry'>
                      <div className='tpi-expert1'>
                        Expert1 :{' '}
                        <TruncatedText text={tpiData?.expert1.name} maxLength={25} />
                      </div>
                      {renderActionButtons(tpiData, tpiData?.expert1.name, 'expert1')}
                    </div>

                    <div className='tpi-entry'>
                      <div className='tpi-expert2'>
                        Expert2 :{' '}
                        <TruncatedText text={tpiData?.expert2.name} maxLength={25} />
                      </div>
                      {renderActionButtons(tpiData, tpiData?.expert2.name, 'expert2')}
                    </div>

                    <div className='tpi-entry'>
                      <div className='tpi-boss'>
                        CDP&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {' '}
                        <TruncatedText text={tpiData?.boss.name} maxLength={25} />
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

  // filtres 

  const [filters, setFilters] = useState({
    site: '',
    date: '',
    candidate: '',
    expert: '',
    projectManager: ''
  });

  const filteredData = useMemo(() => {
    return soutenanceData.flatMap(room => {
      // Filtre les TPIs dans chaque salle basée sur les critères de filtre
      const filteredTpis = room.tpiDatas.filter(tpi => {
        return (!filters.site || room.site === filters.site) &&
          (!filters.date || formatDate(room.date) === filters.date) &&
          (!filters.candidate || tpi.candidat.toLowerCase().includes(filters.candidate.toLowerCase())) &&
          (!filters.expert || [tpi.expert1?.name, tpi.expert2?.name].some(name => name && name.toLowerCase().includes(filters.expert.toLowerCase()))) &&
          (!filters.projectManager || (tpi.boss?.name && tpi.boss.name.toLowerCase().includes(filters.projectManager.toLowerCase())));
      });

      // Retourne une copie de l'objet salle avec les TPIs filtrés si des TPIs correspondent aux filtres
      if (filteredTpis.length > 0) {
        return { ...room, tpiDatas: filteredTpis };
      } else {
        return [];  // Retourne un tableau vide si aucun TPI ne correspond aux filtres dans cette salle
      }
    });
  }, [soutenanceData, filters]); // Dépendances : `soutenanceData` et `filters`


  const uniqueDates = useMemo(() => {
    const dates = soutenanceData.map(tpi => formatDate(tpi.date));
    return [...new Set(dates)].sort();
  }, [soutenanceData]);

  const uniqueSites = useMemo(() => {
    const sites = soutenanceData.map(tpi => tpi.site);
    return [...new Set(sites)].sort();
  }, [soutenanceData]);

  const uniqueCandidates = useMemo(() => {
    const candidates = new Set(soutenanceData.flatMap(room => room.tpiDatas.map(tpi => tpi.candidat)));
    return Array.from(candidates).sort();
  }, [soutenanceData]);

  const uniqueExperts = useMemo(() => {
    const experts = new Set(soutenanceData.flatMap(room => room.tpiDatas.flatMap(tpi => [tpi.expert1?.name, tpi.expert2?.name].filter(name => name))));
    return Array.from(experts).sort();
  }, [soutenanceData]);

  const uniqueProjectManagers = useMemo(() => {
    const managers = new Set(soutenanceData.flatMap(room => room.tpiDatas.map(tpi => tpi.boss?.name).filter(name => name)));
    return Array.from(managers).sort();
  }, [soutenanceData]);


  const updateFilter = (filterName, value) => {
    setFilters(prevFilters => ({ ...prevFilters, [filterName]: value }));
  };

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

  const isFilterApplied = filters.expert !== "" || filters.candidate !== "" || filters.projectManager !== "";




  // Ajout de champs d'entrée pour les filtres restants
  return (
    <Fragment>

      <h1 className={isDemo ? 'demo' : 'title'}> Soutenances de {year}</h1>

      <div className='filters'>
        <select value={filters.date} onChange={e => updateFilter('date', e.target.value)}>
          <option value="">Toutes les dates</option>
          {uniqueDates.map(date => (
            <option key={date} value={date}>{date}</option>
          ))}
        </select>

        <select value={filters.site} onChange={e => updateFilter('site', e.target.value)}>
          <option value="">Tous les sites</option>
          {uniqueSites.map(site => (
            <option key={site} value={site}>{site}</option>
          ))}
        </select>

        <select value={filters.expert} onChange={e => updateFilter('expert', e.target.value)}>
          <option value="">Tous les experts</option>
          {uniqueExperts.map(expert => (
            <option key={expert} value={expert}>{expert}</option>
          ))}
        </select>

        <select value={filters.candidate} onChange={e => updateFilter('candidate', e.target.value)}>
          <option value="">Tous les candidats</option>
          {uniqueCandidates.map(candidate => (
            <option key={candidate} value={candidate}>{candidate}</option>
          ))}
        </select>

        <select value={filters.projectManager} onChange={e => updateFilter('projectManager', e.target.value)}>
          <option value="">Tous les chefs de projet</option>
          {uniqueProjectManagers.map(manager => (
            <option key={manager} value={manager}>{manager}</option>
          ))}
        </select>
      </div>

      <div id='soutenances'>
        <div className='dataGrid'>
          {/* Affichez renderSchedule(schedule) seulement si aucun filtre spécifique n'est appliqué */}
          {!isFilterApplied && renderSchedule(schedule)}
          <RenderRooms
            year={year}
            tpiDatas={filteredData} // normalement ici c'est soutenancedata 
            schedule={schedule}
            listOfPerson={listOfExpertsOrBoss}
            filters={filters} />
        </div>
      </div>







    </Fragment >
  )
}
export default TpiSoutenance
