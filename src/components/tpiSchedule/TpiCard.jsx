import React, { useState, useEffect, useRef } from 'react'
import { useDrag } from 'react-dnd'
import { ItemTypes } from './Constants'
import { getTpiModels } from '../tpiControllers/TpiController'

// Fonction pour récupérer l'année initiale à partir du DOM
const getInitialYear = () => {
  const dateElement = document.querySelector('.date')
  if (dateElement) {
    const dateString = dateElement.textContent.trim()
    // Regex pour extraire le jour, le mois et l'année
    const match = dateString.match(/(\w+) (\d{1,2})-(\d{1,2})-(\d{4})/)
    if (match) {
      const day = parseInt(match[2])
      // Soustraire 1 car les mois en JavaScript sont 0-indexés
      const month = parseInt(match[3]) - 1
      const year = parseInt(match[4])
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const date = new Date(year, month, day)
        if (!isNaN(date.getTime())) {
          return date.getFullYear() // Renvoie l'année si la date est valide
        }
      }
    }
  }
  // Utilisation de la date en cours comme valeur par défaut si aucune année n'est trouvée dans le DOM
  return new Date().getFullYear()
}

const TpiCard = ({ tpi, isEditingTpiCard, onUpdateTpi }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [editedTpi, setEditedTpi] = useState(tpi)
  const [tpiList, setTpiList] = useState([])
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [assignedRefTpis, setAssignedRefTpis] = useState([])
  const [location, setLocation] = useState(null)
  const selectRef = useRef(null)
  const refTpiContainerRef = useRef(null)
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const [isPopupVisible, setIsPopupVisible] = useState(false)
  const [popupText, setPopupText] = useState('')

  // Fonction pour afficher la popup avec le texte spécifié
  const handleMouseEnter = text => {
    setPopupText(text) // Définissez le texte de la popup
    setIsPopupVisible(true) // Affichez la popup
  }

  const handleMouseLeave = () => {
    setIsPopupVisible(false)
  }

  const handleToggleSelect = () => {
    setIsSelectOpen(prevState => !prevState)
  }

  // Fonction pour rechercher un parent avec une classe spécifique à partir d'un élément donné
  const findParentWithClass = (element, className) => {
    // Vérifie si l'élément est défini et non nul
    if (!element) return null

    // Initialise la variable currentElement avec l'élément donné
    let currentElement = element

    // Boucle tant que currentElement n'est pas nul
    while (currentElement !== null) {
      // Vérifie si currentElement a une liste de classes et si elle contient la classe spécifiée
      if (
        currentElement.classList &&
        currentElement.classList.contains(className)
      ) {
        // Si la classe est trouvée, retourne l'élément actuel
        return currentElement
      }

      // Passe au parent suivant
      currentElement = currentElement.parentElement
    }

    // Si aucun parent avec la classe spécifiée n'est trouvé, retourne null
    return null
  }

  useEffect(() => {
    // Filtrer les options de TPI pour exclure celles qui ont déjà été attribuées
    const filterAssignedTpiOptions = () => {
      // Filtrer les options déjà attribuées
      const filteredTpiList = tpiList.filter(
        tpiItem => !assignedRefTpis.includes(tpiItem.refTpi)
      )
      // Mettre à jour la liste des options filtrées
      setTpiList(filteredTpiList)
    }

    // Appeler la fonction de filtrage lorsque assignedRefTpis change
    filterAssignedTpiOptions()
  }, [assignedRefTpis]) // Effectuer cette action lorsque assignedRefTpis change

  useEffect(() => {
    // Vérifie si un candidat est sélectionné et si la liste des TPI (Travaux Pratiques Individuels) existe et n'est pas vide
    if (selectedCandidate && tpiList && tpiList.length > 0) {
      // Trouve le TPI correspondant au candidat sélectionné
      const selectedTpi = tpiList.find(
        item => item.refTpi === selectedCandidate
      )

      // Si un TPI correspondant est trouvé
      if (selectedTpi) {
        // Met à jour l'état du TPI édité avec les informations du TPI sélectionné
        setEditedTpi(prevEditedTpi => ({
          ...prevEditedTpi,
          refTpi: selectedTpi.refTpi, // Met à jour la référence du TPI
          candidat: selectedTpi.candidat, // Met à jour le candidat associé
          expert1: { name: selectedTpi.expert1 }, // Met à jour le premier expert
          expert2: { name: selectedTpi.expert2 }, // Met à jour le deuxième expert
          boss: { name: selectedTpi.boss } // Met à jour le responsable
        }))
      }
    }
  }, [selectedCandidate, tpiList]) // Déclenche cet effet à chaque changement de candidat sélectionné ou de liste de TPI

  useEffect(() => {
    setEditedTpi(tpi)
  }, [tpi])

  useEffect(() => {
    if (isEditingTpiCard) {
      onUpdateTpi(editedTpi)
    }
  }, [isEditingTpiCard])

  useEffect(() => {
    // Fonction pour gérer la fermeture de la liste lorsque l'utilisateur clique à l'extérieur du composant
    const handleClickOutside = event => {
      // Récupération des éléments HTML avec la classe 'refTpi'
      const refTpiElements = document.getElementsByClassName('refTpi')

      // Extraction des références des TPI attribués
      const assignedRefTpis = Array.from(refTpiElements).map(element =>
        element.textContent.trim()
      )
      setAssignedRefTpis(assignedRefTpis)

      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsSelectOpen(false)
      }
      // Détermination de l'emplacement en fonction de la classe de l'élément parent
      // Les emplacements possibles sont "ETML-Sébeillon" et "ETML-Vennes"
      if (findParentWithClass(selectRef.current, 'site_etml')) {
        // Si l'élément parent a la classe "site_etml", l'emplacement est "ETML-Sébeillon"
        setLocation('ETML-Sébeillon')
      } else if (findParentWithClass(selectRef.current, 'site_cfpv')) {
        // Si l'élément parent a la classe "site_cfpv", l'emplacement est "ETML-Vennes"
        setLocation('ETML-Vennes')
      }
    }

    // Fonction asynchrone pour récupérer les modèles de TPI
    const fetchTpiModels = async () => {
      // Indiquer que le chargement est en cours
      setIsLoading(true)

      try {
        // Récupération des données sur les modèles de TPI
        const tpiData = await getTpiModels(getInitialYear())
        // Mise à jour de l'état des listes de TPI et de TPI attribués
        setTpiList(tpiData)
      } catch (error) {
        // Gérer les erreurs de chargement
        console.error(
          "Une erreur s'est produite lors du chargement des modèles de TPI :",
          error
        )
      } finally {
        // Indiquer que le chargement est terminé
        setIsLoading(false)
      }
    }

    // Appel de la fonction fetchTpiModels au montage du composant
    fetchTpiModels()

    // Ajout d'un écouteur d'événements pour détecter les clics en dehors du composant
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, []) // Dépendance vide pour n'exécuter qu'une seule fois au montage du composant

  const handleChangeCandidat = (e, field) => {
    const updatedTpi = {
      ...editedTpi,
      [field]: e.target.value
    }
    setEditedTpi(updatedTpi)
    onUpdateTpi(updatedTpi)
  }

  const handleChange = (e, field) => {
    const updatedTpi = {
      ...editedTpi,
      [field]: {
        ...editedTpi[field], // Copie des propriétés actuelles de l'objet imbriqué
        name: e.target.value // Mise à jour de la propriété 'name' de l'objet imbriqué
      }
    }
    setEditedTpi(updatedTpi)
    onUpdateTpi(updatedTpi)
  }

  const handleSelectChange = e => {
    setSelectedCandidate(e.target.value)
  }

  const [{ isDragging }, dragRef] = useDrag({
    type: ItemTypes.TPI_CARD,
    item: { tpi },
    collect: monitor => ({
      isDragging: monitor.isDragging()
    })
  })

  const formatDate = date => {
    const options = { year: '2-digit', month: '2-digit', day: '2-digit' }
    return new Date(date).toLocaleDateString('fr-CH', options)
  }

  const Popup = ({ text }) => {
    return (
      <div className='custom-popup'>
        <div className='popup-content'>{text}</div>
      </div>
    )
  }

  const isExpert1Proposal =
    (tpi.expert1.offres?.submit?.length ?? 0) > 0 ? '🗓️' : ''
  const isExpert2Proposal =
    (tpi.expert2.offres?.submit?.length ?? 0) > 0 ? '🗓️' : ''
  const isBossProposal = (tpi.boss.offres?.submit?.length ?? 0) > 0 ? '🗓️' : ''

  const expert1Title =
    tpi.expert1.offres?.submit
      ?.map(item => `${formatDate(item.date)}/${item.creneau}`)
      .join('\n') ?? ''

  const expert2Title =
    tpi.expert2.offres?.submit
      ?.map(item => `${formatDate(item.date)}/${item.creneau}`)
      .join('\n') ?? ''

  const bossTitle =
    tpi.boss.offres?.submit
      ?.map(item => `${formatDate(item.date)}/${item.creneau}`)
      .join('\n') ?? ''

  // Élément de chargement conditionnel
  if (isLoading) {
    return <div>Chargement en cours...</div>
  }

  return (
    <div ref={dragRef} className={`tpiCard ${isDragging ? 'dragging' : ''}`}>
      {isEditingTpiCard ? (
        <>
          <div className='eidtCandidat'>
            <input
              type='text'
              className='edit'
              value={editedTpi.candidat || ''}
              onChange={e => handleChangeCandidat(e, 'candidat')}
            />
            <div
              ref={refTpiContainerRef}
              style={{ display: 'none' }}
              className='refTpi'
            >
              {editedTpi.refTpi}{' '}
            </div>

            <div className='btTpiListSite' onClick={handleToggleSelect}>
              {' '}
              ▼{' '}
            </div>
            {isSelectOpen && tpiList && (
              <>
                {/* Ouvre la balise select pour afficher les options */}
                <select
                  ref={selectRef}
                  className='edit'
                  value={selectedCandidate}
                  onChange={handleSelectChange}
                >
                  {/* Parcourt la liste de TPI pour créer les options du select */}
                  {tpiList.map(item => {
                    const isMatchingLocation = item.lieu === location
                    const isAssigned = assignedRefTpis.includes(item.refTpi)

                    // Affiche l'option uniquement si le TPI n'est pas déjà assigné et si le lieu correspond à l'emplacement actuel
                    if (!isAssigned && isMatchingLocation) {
                      return (
                        <option key={item.refTpi} value={item.refTpi}>
                          {/* Contenu de l'option (refTpi, candidat) */}
                          {item.refTpi + ' ' + item.candidat}
                        </option>
                      )
                    }
                    console.log("Option non rendue pour l'élément")
                    return null
                  })}
                </select>
              </>
            )}
          </div>

          <input
            type='text'
            className='edit'
            value={editedTpi.expert1.name || ''}
            onChange={e => handleChange(e, 'expert1')}
          />
          <input
            type='text'
            className='edit'
            value={editedTpi.expert2.name || ''}
            onChange={e => handleChange(e, 'expert2')}
          />
          <input
            type='text'
            className='edit'
            value={editedTpi.boss.name || ''}
            onChange={e => handleChange(e, 'boss')}
          />
        </>
      ) : (
        <>
          <div className='debug'>{editedTpi.id}</div>

          <div className='candidat'>
            <span role='img' aria-label='star' className='star-icon'>
              🎓
            </span>
            {editedTpi.candidat}
          </div>

          <div className='expert' title='{expert1Title}'>
            <span role='img' aria-label='checkmark' className='boss-icon'>
              🛠️
            </span>
            {editedTpi.expert1.name}
            <span className='icon-proposal'>{isExpert1Proposal}</span>
          </div>

          <div className='expert' title={expert2Title}>
            <span role='img' aria-label='checkmark'>
              🛠️
            </span>
            {editedTpi.expert2.name}
            <span className='icon-proposal'>{isExpert2Proposal}</span>
          </div>

          <div className='boss' title={bossTitle}>
            <span role='img' aria-label='boss'>
              💼
            </span>
            {editedTpi.boss.name}
            <span className='icon-proposal'>{isBossProposal}</span>
          </div>
        </>
      )}
    </div>
  )
}

export default TpiCard
