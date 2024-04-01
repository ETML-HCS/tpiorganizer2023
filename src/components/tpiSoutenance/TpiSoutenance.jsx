import React, { useState, useEffect, Fragment, useMemo } from 'react'

import { useLocation, useParams } from 'react-router-dom'
import CreneauPropositionPopup from './CreneauPropositionPopup'

import { showNotification } from '../Tools'

import '../../css/tpiSoutenance/tpiSoutenance.css'

// Pour accéder à la variable d'environnement REACT_APP_API_URL
const isDemo = process.env.REACT_APP_DEBUG === 'true' // affiche version démonstration

// Pour accéder à la variable d'environnement REACT_APP_API_URL
const apiUrl = isDemo
  ? process.env.REACT_APP_API_URL_TRUE
  : process.env.REACT_APP_API_URL_FALSE

const useToken = () => {
  const location = useLocation()
  const queryParams = new URLSearchParams(location.search)
  return queryParams.get('token')
}

const fetchSoutenanceData = async year => {
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
  try {
    const listOfExpertsOrBoss = await fetch(
      `${apiUrl}/api/experts/listExpertsOrBoss`
    )

    if (listOfExpertsOrBoss.ok) {
      return await listOfExpertsOrBoss.json()
    } else {
      showNotification(
        'Erreur lors de la récupération de la liste des experts',
        'error'
      )
      return null
    }
  } catch (error) {
    showNotification(`Erreur réseau: ${error}`, 'error') // Correction ici
    return null
  }
}

const updateSoutenanceData = async (year, propositions, tpi, expertOrBoss) => {
  try {
    const response = await fetch(
      `${apiUrl}/api/tpiyear/${year}/${tpi._id}/${tpi.id}/${expertOrBoss}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(propositions)
      }
    )

    if (response.ok) {
      showNotification(
        `Données de soutenance mises à jour avec succès pour l'année ${year}`
      )
    } else {
      showNotification(
        `Erreur lors de la mise à jour des données de soutenance pour l'année ${year}`,
        'error'
      )
    }
  } catch (error) {
    showNotification(
      'Erreur réseau lors de la mise à jour des données de soutenance:',
      error
    )
  }
}

function TruncatedText ({ text, maxLength }) {
  const isTruncated = text.length > maxLength
  return (
    <div
      title={isTruncated ? text : ''}
      className={isTruncated ? 'truncated-text' : 'nameTpi'}
    >
      {isTruncated ? `${text.substring(0, maxLength - 3)}...` : text}
    </div>
  )
}

// Fonction pour formater la date
const formatDate = dateString => {
  const options = { year: 'numeric', month: 'long', day: 'numeric' }
  return new Intl.DateTimeFormat('fr-FR', options).format(new Date(dateString))
}

function renderSchedule (schedule) {
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

const RenderRooms = ({
  year,
  tpiDatas,
  schedule,
  listOfPerson,
  filters,
  loadData,
  token,
  isOn
}) => {
  const [showPopup, setShowPopup] = useState(false)
  const [currentTpiData, setCurrentTpiData] = useState(null)
  const [scheduleSuggester, setScheduleSuggester] = useState(null)
  const [forceRender, setForceRender] = useState(false)

  const handleAcceptClick = async (sendYear, tpiData, expertOrBoss) => {
    try {
      const propositions = {
        offres: {
          isValidated: true,
          submit: []
        }
      }

      // Attendre la résolution de updateSoutenanceData  const response
      await updateSoutenanceData(sendYear, propositions, tpiData, expertOrBoss)
      // Rafraîchir les données après la mise à jour réussie
      loadData()
      // Mettre à jour l'état pour forcer un re-render
      setForceRender(prevState => !prevState)
    } catch (error) {
      console.error('Erreur lors de la mise à jour des données :', error)
    }
  }

  // Utilisateur fait une proposition (depuis le bouton agenda)
  const handlePropositionClick = (tpiData, expertOrBoss) => {
    // Afficher le popup pour modifier le créneau
    setCurrentTpiData(tpiData)

    if (tpiData[expertOrBoss]?.offres.submit.length > 0) {
      // Si le tableau n'est pas vide, afficher un message d'avertissement
      alert(
        'Attention : En continuant, vous écraserez les demandes précédentes !'
      )
    }
    setScheduleSuggester(expertOrBoss)
    setShowPopup(true)
  }

  // Fonction pour rendre les boutons d'actions
  const renderActionButtons = (tpiData, how, expertOrBoss) => {
    const isExpertValidated = tpiData[expertOrBoss]?.offres?.isValidated
    const isSubmitButtonActive = tpiData[expertOrBoss]?.offres?.submit

    // Classe pour indiquer l'invitation à valider (isValidated est null)
    const invitationClass = isExpertValidated === null ? 'invitation' : ''

    // Classe pour indiquer true ou false pour isValidated
    const isValidatedClass =
      isExpertValidated === true
        ? 'true'
        : isExpertValidated === false
        ? 'false'
        : 'null'

    // Classe pour submit (soit vide, soit un tableau)
    const submitClass =
      Array.isArray(isSubmitButtonActive) && isSubmitButtonActive.length === 0
        ? 'empty'
        : Array.isArray(isSubmitButtonActive)
        ? 'has-values'
        : ''

    // Texte par défaut pour le bouton d'acceptation
    // const acceptButtonText = '✔';

    // Taille du bouton HTML
    const buttonSize = 21 // Taille du bouton en pixels

    const acceptButtonColorNOT = '#1C2033' // Couleur par défaut

    const acceptButtonSvgNot = (
      <svg
        width={buttonSize}
        height={buttonSize}
        viewBox='0 0 512 512'
        style={{ color: acceptButtonColorNOT }} // Utilisation de la variable de couleur
        xmlns='http://www.w3.org/2000/svg'
        className='h-full w-full'
      >
        {/* Conteneur SVG */}
        <svg
          width='100%'
          height='100%'
          viewBox='0 0 16 14'
          fill={acceptButtonColorNOT}
          role='img'
          xmlns='http://www.w3.org/2000/svg'
        >
          <g fill={acceptButtonColorNOT}>
            <path
              fill='currentColor'
              d='M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z'
            />
          </g>
        </svg>
      </svg>
    )

    const acceptButtonColorOK = '#00ff08'

    const acceptButtonSvgOK = (
      <svg
        width={buttonSize}
        height={buttonSize}
        viewBox='0 0 512 512'
        style={{ color: acceptButtonColorOK }} // Utilisation de la variable de couleur
        xmlns='http://www.w3.org/2000/svg'
        className='h-full w-full'
      >
        {/* Conteneur SVG */}
        <svg
          width='100%'
          height='100%'
          viewBox='0 0 16 14'
          fill={acceptButtonColorOK}
          role='img'
          xmlns='http://www.w3.org/2000/svg'
        >
          <g fill={acceptButtonColorOK}>
            <path
              fill='currentColor'
              d='M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z'
            />
          </g>
        </svg>
      </svg>
    )

    // Emoji par défaut pour le bouton de proposition
    // const submitButtonEmoji = '📅';
    const submitButtonColor = '#000000' // Couleur par défaut

    const submitButtonSvg = (
      <svg
        width={buttonSize}
        height={buttonSize}
        viewBox='0 0 512 512'
        style={{ color: submitButtonColor }}
        xmlns='http://www.w3.org/2000/svg'
        className='h-full w-full'
      >
        {/* Conteneur SVG */}
        <svg
          width='100%'
          height='100%'
          viewBox='0 0 24 24'
          fill={submitButtonColor}
          xmlns='http://www.w3.org/2000/svg'
        >
          <g fill={submitButtonColor}>
            <path
              fill='currentColor'
              d='m21.7 13.35l-1 1l-2.05-2l1-1c.2-.21.54-.22.77 0l1.28 1.28c.19.2.19.52 0 .72M12 18.94V21h2.06l6.06-6.12l-2.05-2L12 18.94M5 19h5v2H5a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h1V1h2v2h8V1h2v2h1a2 2 0 0 1 2 2v4H5v10M5 5v2h14V5H5Z'
            />
          </g>
        </svg>
      </svg>
    )

    const expertPropositions =
      (tpiData[expertOrBoss]?.offres && tpiData[expertOrBoss].offres.submit) ||
      null

    let proposedSlot = ''
    if (expertPropositions) {
      for (const proposition of expertPropositions) {
        const date = new Date(proposition.date).toLocaleDateString()
        const creneau = proposition.creneau
        proposedSlot += `${date}/${creneau}\n`
      }
    } else {
      // Gérez le cas où expertPropositions est null ici
      // Par exemple, si le client n'a pas encore fait d'offre, vous pouvez afficher un message ou une valeur par défaut
      proposedSlot = 'Aucune offre faite par le client.'
    }
    const person = listOfPerson.find(person => person.name === how)
    let isTokenThisPerson = null // Initialisez token à null par défaut
    if (person) {
      isTokenThisPerson = person.token // Si person est défini, récupérez le token
    }

    return (
      <div className={`action-buttons${invitationClass}`}>
        <button
          title={`✔\tEn attente de validation\nOK\tCréneau validé\nX\tCréneau refusé`}
          className={`button-${isValidatedClass}`}
          onClick={() =>
            isTokenThisPerson === token &&
            handleAcceptClick(year, tpiData, expertOrBoss)
          }
        >
          {isValidatedClass === 'true'
            ? acceptButtonSvgOK
            : isValidatedClass === 'false'
            ? 'X'
            : acceptButtonSvgNot}
        </button>
        <button
          title={`${proposedSlot}`}
          className={`button-${submitClass}`}
          onClick={() =>
            isTokenThisPerson === token &&
            handlePropositionClick(tpiData, expertOrBoss)
          }
        >
          {submitClass === 'has-values'
            ? '-'
            : submitClass === 'empty'
            ? submitButtonSvg
            : ''}
        </button>
      </div>
    )
  }

  const isAnyFilterApplied =
    filters.experts !== '' ||
    filters.candidate !== '' ||
    filters.projectManager !== '' ||
    filters.projectManagerButton !== ''

  const logAndClosePopup = () => {
    setShowPopup(false) // Assurez-vous que setShowPopup est défini dans le scope de cette fonction
    loadData()
  }

  const downloadICal = (salle, tpi) => {
    const timeTpi = document.querySelector(`#${tpi.id}`).title;

    const timeStart = timeTpi.split('-')[0].trim();
    const timeEnd = timeTpi.split('-')[1].trim();
    
    

    // Convertir la date de la salle au format requis pour DTSTART et DTEND
    const formattedDate = new Date(salle.date)
        .toISOString()
        .slice(0, 19)
        .replace(/[-:]/g, '');

    // Créer le contenu de l'iCal en utilisant les données de tpi
    const icalContent = 
`BEGIN:VCALENDAR
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
DTSTART;TZID=Europe/Berlin:${formattedDate.replace('T000000', 'T' + timeStart.replace(':','')+'00')}
DTEND;TZID=Europe/Berlin:${formattedDate.replace('T000000', 'T' + timeEnd.replace(':','')+'00' )}
SUMMARY:Soutenance ${tpi.refTpi} - ${tpi.candidat} ${timeStart}-${timeEnd}
DESCRIPTION:Soutenance de TPI pour ${tpi.candidat}\\nExpert 1: ${tpi.expert1.name}\\nExpert 2: ${tpi.expert2.name}\\nEncadrant: ${tpi.boss.name}
LOCATION:${salle.name}
TRANSP:TRANSPARENT
CLASS:PUBLIC
END:VEVENT
END:VCALENDAR\r\n
`;
    
    // Créer un objet Blob avec le contenu iCal
    const blob = new Blob([icalContent], { type: 'text/calendar' });

    // Créer un URL à partir du Blob
    const url = URL.createObjectURL(blob);

    // Créer un élément <a> pour déclencher le téléchargement
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tpi.candidat}_TPI.ics`; // Nom du fichier iCal
    a.style.display = 'none'; // Cacher le lien de téléchargement

    // Ajouter l'élément <a> au corps du document
    document.body.appendChild(a);

    // Simuler un clic sur le lien pour démarrer le téléchargement
    a.click();

    // Supprimer l'élément <a> après le téléchargement
    document.body.removeChild(a);

    // Révoquer l'URL de l'objet Blob
    URL.revokeObjectURL(url);
};


  return (
    <div className='salles-container'>
      {tpiDatas.map((salle, indexSalle) => (
        <div key={indexSalle} className={`salle ${salle.site}`}>
          <span className='site'>{salle.site}</span>
          <div className={`header_${indexSalle}`}>
            <h3>{formatDate(salle.date)}</h3>
            <h4>{salle.name}</h4>
            <div className='header-row'>
              <div className='header-cell'>Nom du Candidat</div>
              <div className='header-cell'>Expert 1</div>
              <div className='header-cell'>Expert 2</div>
              <div className='header-cell'>Chef de Projet</div>
            </div>
          </div>

          {schedule.map((slot, index) => {
            // Assurez-vous que tpiData est défini avant de l'utiliser
            const tpiData = salle.tpiDatas ? salle.tpiDatas[index] : null
            const { candidat, expert1, expert2, boss } = tpiData || {}

            // Fonction pour trouver le token d'une personne par son nom
            const findPersonTokenByName = name => {
              // Utilisation de la méthode find pour trouver la personne par son nom
              const person = listOfPerson.find(person => person.name === name)
              // Si la personne est trouvée, retourner son token
              if (person) {
                return person.token
              } else {
                // Si la personne n'est pas trouvée, afficher un message dans la console
                console.log(`La personne avec le nom "${name}" n'existe pas.`)
                // Retourner undefined
                return undefined
              }
            }

            // const candidatToken = findPersonTokenByName(candidat);
            const expert1Token = findPersonTokenByName(expert1?.name)
            const expert2Token = findPersonTokenByName(expert2?.name)
            const bossToken = findPersonTokenByName(boss?.name)

            // Continuez uniquement si tpiData est défini
            if (!tpiData) return null

            // Extrait le numéro de ligne à partir de l'ID de tpiData
            const lineNumber = tpiData.id.split('_').pop()

            return (
              <Fragment key={`${indexSalle}-${slot.startTime}-${slot.endTime}`}>
                <div
                  className='tpi-data'
                  id={tpiData?.id}
                  title={`${schedule[lineNumber].startTime} - ${schedule[lineNumber].endTime}`}
                >
                  <div
                    className={`${
                      !isAnyFilterApplied ? 'no-filter' : 'time-label'
                    }`}
                  >
                    {`${schedule[lineNumber].startTime} - ${schedule[lineNumber].endTime}`}
                  </div>

                  <div className='tpi-container'>
                   {tpiData.candidat && ( 
                   
                   <button
                      type='button'
                      className='btniCal'
                      onClick={() => downloadICal(salle,tpiData)}
                    >
                      iCal &#x1F4E5;
                    </button>
                    )}

                    <div className='tpi-entry tpi-candidat'>
                      <div className='tpi-entry'>
                        <TruncatedText
                          text={tpiData?.candidat}
                          maxLength={30}
                        />
                      </div>
                    </div>

                    <div
                      className={`tpi-entry ${
                        !isOn && token && expert1Token !== token ? 'gris' : ''
                      }`}
                    >
                      <div className='tpi-expert1'>Expert1 {': '}</div>

                      <div
                        className={`tpi-entry ${
                          !isOn && token === expert1Token ? 'stabilo' : ''
                        }`}
                      >
                        <TruncatedText
                          text={tpiData?.expert1.name}
                          maxLength={20}
                        />
                      </div>
                      {renderActionButtons(
                        tpiData,
                        tpiData?.expert1.name,
                        'expert1'
                      )}
                    </div>

                    <div
                      className={`tpi-entry ${
                        !isOn && token && expert2Token !== token ? 'gris' : ''
                      }`}
                    >
                      <div className='tpi-expert2'>Expert2 {': '}</div>

                      <div
                        className={`tpi-entry ${
                          !isOn && token === expert2Token ? 'stabilo' : ''
                        }`}
                      >
                        <TruncatedText
                          text={tpiData?.expert2.name}
                          maxLength={20}
                        />
                      </div>

                      {renderActionButtons(
                        tpiData,
                        tpiData?.expert2.name,
                        'expert2'
                      )}
                    </div>

                    <div
                      className={`tpi-entry ${
                        !isOn && token && bossToken !== token ? 'gris' : ''
                      }`}
                    >
                      <div className='tpi-boss'>CDP {' >> '}</div>
                      <div
                        className={`tpi-entry ${
                          !isOn && token === bossToken ? 'stabilo' : ''
                        }`}
                      >
                        <TruncatedText
                          text={tpiData?.boss.name}
                          maxLength={20}
                        />
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
          fermerPopup={logAndClosePopup} // Utilisation directe de false pour fermer la popup
        />
      )}
    </div>
  )
}

const TpiSoutenance = () => {
  const { year } = useParams()
  const [soutenanceData, setSoutenanceData] = useState([])
  const [expertOrBoss, setExpertOrBoss] = useState(null)
  const [listOfExpertsOrBoss, setListOfExpertsOrBoss] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isOn, setIsOn] = useState(true)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const token = useToken()

  // filtres
  const [filters, setFilters] = useState({
    site: '',
    date: '',
    candidate: '',
    experts: '',
    projectManagerButton: '',
    projectManager: ''
  })

  const filteredData = useMemo(() => {
    return soutenanceData.flatMap(room => {
      // Filtre les TPIs dans chaque salle basée sur les critères de filtre
      const filteredTpis = room.tpiDatas.filter(tpi => {
        return (
          (!filters.site || room.site === filters.site) &&
          (!filters.date || formatDate(room.date) === filters.date) &&
          (!filters.candidate ||
            tpi.candidat
              .toLowerCase()
              .includes(filters.candidate.toLowerCase())) &&
          (!filters.experts || // Nouvelle condition pour les experts
            tpi.expert1?.name
              .toLowerCase()
              .includes(filters.experts.toLowerCase()) ||
            tpi.expert2?.name
              .toLowerCase()
              .includes(filters.experts.toLowerCase())) &&
          (!filters.projectManagerButton || // bouton Mes TPI
            tpi.expert1?.name
              .toLowerCase()
              .includes(filters.projectManagerButton.toLowerCase()) ||
            tpi.expert2?.name
              .toLowerCase()
              .includes(filters.projectManagerButton.toLowerCase()) ||
            tpi.boss?.name
              .toLowerCase()
              .includes(filters.projectManagerButton.toLowerCase())) &&
          (!filters.projectManager ||
            (tpi.boss?.name &&
              tpi.boss.name
                .toLowerCase()
                .includes(filters.projectManager.toLowerCase())))
        )
      })
      // Retourne une copie de l'objet salle avec les TPIs filtrés si des TPIs correspondent aux filtres
      if (filteredTpis.length > 0) {
        return { ...room, tpiDatas: filteredTpis }
      } else {
        return [] // Retourne un tableau vide si aucun TPI ne correspond aux filtres dans cette salle
      }
    })
  }, [soutenanceData, filters]) // Dépendances : `soutenanceData` et `filters`

  // Construction des selects

  const uniqueDates = useMemo(() => {
    const dates = soutenanceData.map(tpi => formatDate(tpi.date))
    return [...new Set(dates)].sort()
  }, [soutenanceData])

  const uniqueSites = useMemo(() => {
    const sites = soutenanceData.map(tpi => tpi.site)
    return [...new Set(sites)].sort()
  }, [soutenanceData])

  const uniqueCandidates = useMemo(() => {
    const candidates = new Set(
      soutenanceData.flatMap(room => room.tpiDatas.map(tpi => tpi.candidat))
    )
    return Array.from(candidates).sort()
  }, [soutenanceData])

  const uniqueExperts = useMemo(() => {
    const experts = new Set(
      soutenanceData.flatMap(room =>
        room.tpiDatas.flatMap(tpi =>
          [tpi.expert1?.name, tpi.expert2?.name].filter(name => name)
        )
      )
    )
    return Array.from(experts).sort()
  }, [soutenanceData])

  const uniqueProjectManagers = useMemo(() => {
    const managers = new Set(
      soutenanceData.flatMap(room =>
        room.tpiDatas.map(tpi => tpi.boss?.name).filter(name => name)
      )
    )
    return Array.from(managers).sort()
  }, [soutenanceData])

  const updateFilter = (filterName, value) => {
    // Pour les autres filtres, met simplement à jour le filtre correspondant
    setFilters(prevFilters => ({
      ...prevFilters,
      [filterName]: value
    }))

    console.log(filters)
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      const data = await fetchSoutenanceData(year)
      if (data) {
        setSoutenanceData(data)
        const expertsList = await fetchTpiListExperts()
        if (expertsList) {
          setListOfExpertsOrBoss(expertsList)
        }
      } else {
        setError('Impossible de charger les données')
      }
    } catch (err) {
      setError('Erreur lors du chargement des données')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Gestion du défilement
    const handleScroll = () => {
      const scrollPosition = window.scrollY
      setIsScrolled(scrollPosition > 50)
    }

    window.addEventListener('scroll', handleScroll)

    // Gestion de la taille de l'écran
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 500)
    }

    handleResize() // Appel initial pour déterminer la taille de l'écran

    window.addEventListener('resize', handleResize)

    // Appel à loadData() à l'intérieur de useEffect
    loadData()

    // Nettoyage des événements lors du démontage du composant
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (listOfExpertsOrBoss && listOfExpertsOrBoss.length > 0) {
      const foundExpertOrBoss = listOfExpertsOrBoss.find(
        item => item.token === token
      )
      // Mettez à jour la variable d'état avec la valeur trouvée
      setExpertOrBoss(foundExpertOrBoss)
      if (foundExpertOrBoss && foundExpertOrBoss.name !== null) {
        // Assurez-vous que expertOrBoss est défini avant de l'utiliser
        foundExpertOrBoss.role === 'projectManager'
          ? updateFilter('projectManagerButton', foundExpertOrBoss.name)
          : updateFilter('experts', foundExpertOrBoss.name)
      }
    }
  }, [listOfExpertsOrBoss, token])

  // Utilisez expertOrBoss dans votre code où vous en avez besoin

  /**
   * Crée un tableau d'horaires pour les soutenances basé sur les paramètres fournis.
   * Pour chaque créneau, elle calcule l'heure de début et de fin en fonction du temps alloué pour chaque TPI
   * et des pauses, puis formate ces horaires avant de les ajouter au tableau.
   *
   * @param {Object} soutenanceData - Contient les paramètres de configuration comme le temps par TPI,
   *                                  l'heure de début du premier TPI, et le nombre total de créneaux.
   * @returns {Array} - Un tableau contenant les horaires de début et de fin pour chaque créneau de soutenance.
   */
  function createSchedule (soutenanceData) {
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

      let startTimeFormatted = `${
        startHours < 10 ? '0' + startHours : startHours
      }:${startMinutes < 10 ? '0' + startMinutes : startMinutes}`
      let endTimeFormatted = `${endHours < 10 ? '0' + endHours : endHours}:${
        endMinutes < 10 ? '0' + endMinutes : endMinutes
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

  /**
   * Composant pour filtrer à l'aide d'un bouton selon les experts donnés en paramètre.
   *
   * @param {Object} props - Les propriétés du composant.
   * @param {boolean} props.isOn - Indique si le filtre est activé ou non.
   * @param {function} props.setIsOn - Fonction pour mettre à jour l'état du filtre.
   * @param {function} props.updateFilter - Fonction pour mettre à jour le filtre.
   * @param {Object} props.expertOrBoss - Informations sur l'expert ou le chef de projet.
   * @returns {JSX.Element} - Élément JSX représentant le bouton de filtre.
   */
  const ToggleFilterButton = ({
    isOn,
    setIsOn,
    updateFilter,
    expertOrBoss
  }) => {
    let role =
      expertOrBoss.role === 'projectManager'
        ? 'projectManagerButton'
        : 'experts'

    const handleClick = () => {
      // Utilisez une fonction de rappel pour garantir que vous utilisez la valeur la plus récente de isOn
      setIsOn(prevIsOn => {
        // Inverse l'état du filtre
        const newIsOn = !prevIsOn
        if (newIsOn) {
          updateFilter(role, expertOrBoss.name)
        } else {
          updateFilter(role, '')
        }
        // Retourne la nouvelle valeur de isOn
        return newIsOn
      })
    }

    return (
      <button
        className={`btnFilters ${isOn ? 'active' : 'inactive'}`}
        onClick={handleClick}
      >
        {`Mes TPI`}
      </button>
    )
  }

  const handleClickFiltersSmartphone = () => {
    // Afficher un message indiquant que la fonction est en cours
    console.log('La fonction de filtrage des smartphones est en cours...')

    // 1. Récupérer les filtres sélectionnés par l'utilisateur
    // Par exemple, vous pouvez utiliser des références aux éléments HTML ou des valeurs stockées dans le state de votre application.

    // 2. Utiliser les filtres pour interroger une source de données contenant des informations sur les smartphones
    // Cela pourrait être une base de données, un service API, ou même un tableau statique dans votre code.

    // 3. Filtrer les smartphones en fonction des critères sélectionnés
    // Par exemple, vous pouvez utiliser des méthodes comme filter() pour filtrer les smartphones qui correspondent aux critères.

    // 4. Afficher la liste filtrée de smartphones
    // Vous pouvez afficher les smartphones dans votre interface utilisateur en utilisant une boucle (par exemple, map()) pour parcourir les résultats filtrés et les afficher dans une liste.

    // Exemple de code pour afficher les smartphones dans la console
    const smartphones = [
      /* Liste des smartphones filtrés */
    ]
    smartphones.forEach((smartphone, index) => {
      console.log(`${index + 1}. ${smartphone.brand} ${smartphone.model}`)
      // Vous pouvez ajouter d'autres propriétés telles que le prix, la capacité de la batterie, etc., en fonction des informations disponibles.
    })

    // 5. Mettre à jour votre interface utilisateur pour afficher la liste de smartphones filtrée
    // Cela dépendra de la manière dont votre application est structurée et implémentée.

    // 6. Gérer les erreurs et les cas où aucun smartphone ne correspond aux critères sélectionnés
    // Assurez-vous de gérer ces cas de manière appropriée pour offrir une expérience utilisateur fluide.
  }

  const isFilterApplied =
    filters.experts !== '' ||
    filters.candidate !== '' ||
    filters.projectManager !== '' ||
    filters.projectManagerButton !== ''

  return (
    <Fragment>
      {isMobile && (
        <Fragment>
          <div className='message-smartphone'>
            <p>
              TpiOrganizer est en cours de développement et la fonctionnalité
              smartphone ne fonctionne pas de manière satisfaisante. Merci de
              vous connecter avec un ordinateur.
            </p>
          </div>

          {/* Render filters for smartphone */}
          <div className='filters-smartphone'>
            <button
              type='button'
              className='smartphone'
              onClick={() => handleClickFiltersSmartphone('Mes TPI')}
            >
              Mes TPI
            </button>
            <button
              type='button'
              className='smartphone'
              onClick={() => handleClickFiltersSmartphone('Candidats')}
            >
              Candidats
            </button>
            <button
              type='button'
              className='smartphone'
              onClick={() => handleClickFiltersSmartphone('Experts')}
            >
              Experts
            </button>
            <button
              type='button'
              className='smartphone'
              onClick={() => handleClickFiltersSmartphone('Encadrant')}
            >
              Encadrant
            </button>
          </div>
        </Fragment>
      )}

      {!isMobile && (
        <Fragment>
          <div className={`header-soutenance${isScrolled ? 'hidden' : ''}`}>
            <h1 className={isDemo ? 'demo' : 'title'}>
              {' '}
              Soutenances de {year}
            </h1>

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
              {/* Afficher des boutons de filtrage direct pour les experts ou les chefs de projet */}
              {expertOrBoss && expertOrBoss.name !== null && (
                <>
                  <div>
                    {/* Vérifier si l'utilisateur est un chef de projet et afficher le bouton de filtrage correspondant */}
                    {expertOrBoss.role !== 'candidate' && (
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

              {/* Afficher les options de filtre spécifiques aux experts */}
              {!expertOrBoss && (
                <>
                  <select
                    value={filters.experts}
                    onChange={e => updateFilter('experts', e.target.value)}
                  >
                    <option value=''>Tous les experts</option>
                    {uniqueExperts.map(expert => (
                      <option key={expert} value={expert}>
                        {expert}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filters.projectManager}
                    onChange={e =>
                      updateFilter('projectManager', e.target.value)
                    }
                  >
                    <option value=''>Tous les chefs de projet</option>
                    {uniqueProjectManagers.map(manager => (
                      <option key={manager} value={manager}>
                        {manager}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filters.candidate}
                    onChange={e => updateFilter('candidate', e.target.value)}
                  >
                    <option value=''>Tous les candidats</option>
                    {uniqueCandidates.map(candidate => {
                      if (candidate.trim() !== '') {
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
                onChange={e => updateFilter('date', e.target.value)}
              >
                <option value=''>Toutes les dates</option>
                {uniqueDates.map(date => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>

              <select
                value={filters.site}
                onChange={e => updateFilter('site', e.target.value)}
              >
                <option value=''>Tous les sites</option>
                {uniqueSites.map(site => (
                  <option key={site} value={site}>
                    {site}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            id='soutenances'
            className={`soutenances ${
              isOn ? 'filterActive' : 'filterInactive'
            }`}
          >
            <div className='dataGrid'>
              {/* Affichez renderSchedule(schedule) seulement si aucun filtre spécifique n'est appliqué */}
              {!isFilterApplied && renderSchedule(schedule)}
              <RenderRooms
                year={year}
                tpiDatas={filteredData}
                schedule={schedule}
                listOfPerson={listOfExpertsOrBoss}
                filters={filters}
                loadData={loadData}
                token={token}
                isOn={isOn}
              />
            </div>
          </div>
        </Fragment>
      )}
    </Fragment>
  )
}
export default TpiSoutenance
