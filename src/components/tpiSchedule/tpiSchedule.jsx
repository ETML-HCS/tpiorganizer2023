import React, { useState, useEffect } from 'react'

import TpiScheduleButtons from './TpiScheduleButtons'
import { showNotification } from '../Utils'

import {
  createTpiCollectionForYear,
  transmitToDatabase
} from '../tpiControllers/TpiRoomsController'

import DateRoom from './DateRoom'

// Pour accéder à la variable d'environnement REACT_APP_DEBUG
const debugMode = process.env.REACT_APP_DEBUG === 'true' // Convertir en booléen si nécessaire

// Pour accéder à la variable d'environnement REACT_APP_API_URL
const apiUrl = process.env.REACT_APP_API_URL

function updateTpiDatas (room) {
  // Parcours de chaque tpiData dans room.tpiDatas
  for (let tpiDatas of room.tpiDatas) {
    tpiDatas.expert1.offres = updateSchema()
    tpiDatas.expert2.offres = updateSchema()
    tpiDatas.boss.offres = updateSchema()
  }
  return room
}

function updateSchema () {
  return {
    offres: { isValidated: false, submit: [] }
  }
}

const TpiSchedule = ({ toggleArrow, isArrowUp }) => {
  const [newRooms, setNewRooms] = useState([])
  const [isEditing, setIsEditing] = useState(false)

  function getSecondsSinceEpoch () {
    // Convertir la chaîne de caractères en objet Date
    const date = new Date('2023-07-27')

    // Vérifier si la date est valide
    if (isNaN(date.getTime())) {
      throw new Error('La date fournie est invalide.')
    }
    const millisecondsSinceEpoch = Date.now() - date.getTime()
    const secondsSinceEpoch = Math.floor(millisecondsSinceEpoch / 1000)
    return secondsSinceEpoch
  }

  const configO2023 = require('../../config/configO2023.json')

  if (!configO2023) {
    showNotification(
      'Erreur lors du chargement du fichier de configuration.',
      'error'
    )
  }

  const fetchData = async () => {
    const savedData = localStorage.getItem('organizerData')
    if (savedData) {
      const savedRooms = JSON.parse(savedData)

      if (Array.isArray(savedRooms)) {
        setNewRooms(savedRooms)
      } else {
        // Si savedRooms n'est pas un tableau,
        // définis-le comme un nouveau tableau contenant uniquement cet objet
        setNewRooms([savedRooms])
      }
      showNotification(`Données chargées (localstorage)`, 3000)
      console.log('TpiSchedule FetchData:', savedRooms)
    } else {
      showNotification(
        'Aucune donnée sauvegardée trouvée dans le stockage local.',
        3000
      )
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handlePublish = async year => {
    const soutenancePageUrl = `/soutenance/${year}`

    try {
      for (const room of newRooms) {
        try {
          await createTpiCollectionForYear(year, updateTpiDatas(room))
        } catch (error) {
          console.error(
            'Erreur lors de la création de la salle de TPI : ',
            error
          )
          return
        }
      }
      // Navigation vers la page de soutenance
      window.location.href = soutenancePageUrl

      // Afficher un message de succès
      showNotification(
        `Les soutenances ont été publiées. Voir: ${soutenancePageUrl}`,
        3000
      )
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des soutenances :', error)
      // Afficher une notification d'erreur à l'utilisateur
    }
  }

  const handleNewRoom = roomInfo => {
    // Récupérer la configuration du site à partir de la configuration générale
    const configSite = configO2023[roomInfo.site.toLowerCase()]

    // Vérifier si le site existe dans la configuration
    if (!configSite) {
      showNotification(
        `Site "${roomInfo.site}" non trouvé dans la configuration.`,
        3000
      )
      return
    }
    // Créer une nouvelle salle avec les informations fournies et un tableau de TPIs vides
    const newRoom = {
      idRoom: getSecondsSinceEpoch(),
      // Ajouter la date et l'heure de sauvegarde au moment de la création ou de la mise à jour
      lastUpdate: ' ',
      site: roomInfo.site,
      date: roomInfo.date,
      name: roomInfo.nameRoom,
      // Copier les propriétés de configuration spécifiques au site
      configSite: {
        breakline: configSite.breakline,
        tpiTime: configSite.tpiTime,
        firstTpiStart: configSite.firstTpiStart,
        numSlots: configSite.numSlots
      },
      // Créer un tableau rempli d'objets TPI vides en fonction du nombre de slots
      tpiDatas: Array.from({ length: configSite.numSlots }, () => ({
        refTpi: null,
        id: '',
        candidat: '',
        // null n'est pas accepté alors afin de construire l'arbre offres
        // initialisation à false
        expert1: { name: '', offres: { isValidated: false, submit: [] } },
        expert2: { name: '', offres: { isValidated: false, submit: [] } },
        boss: { name: '', offres: { isValidated: false, submit: [] } }
      }))
    }

    // Mettre à jour l'état newRooms en utilisant la fonction setNewRooms pour ajouter la nouvelle salle
    setNewRooms(prevRooms => [...prevRooms, newRoom])

    // sauvegarde
    saveDataToLocalStorage([...newRooms, newRoom])

    // Afficher un message dans la console pour indiquer que la salle a été ajoutée
    console.log('Salle ajoutée :', newRoom)
  }

  const handleDelete = async idRoomToDelete => {
    try {
      const existingDataJSON = localStorage.getItem('organizerData')

      if (!existingDataJSON) {
        console.error('Aucune donnée trouvée dans localStorage')
        showNotification(
          'Erreur lors de la suppression de la salle: aucune donnée trouvée',
          3000,
          'error'
        )
        return
      }

      let existingData
      try {
        existingData = JSON.parse(existingDataJSON)
      } catch (error) {
        console.error('Erreur de formatage JSON dans localStorage', error)
        showNotification(
          'Erreur de formatage des données sauvegardées',
          3000,
          'error'
        )
        return
      }

      let updatedData
      if (Array.isArray(existingData)) {
        // Cas où existingData est un tableau
        updatedData = existingData.filter(
          item => item.idRoom !== idRoomToDelete
        )
      } else if (
        existingData.idRoom &&
        existingData.idRoom === idRoomToDelete
      ) {
        // Cas où existingData est un objet unique correspondant à la salle à supprimer
        updatedData = []
      } else {
        // Cas où existingData est un objet unique mais pas la salle à supprimer
        updatedData = [existingData]
      }

      localStorage.setItem('organizerData', JSON.stringify(updatedData))
      setNewRooms(prevRooms =>
        prevRooms.filter(room => room.idRoom !== idRoomToDelete)
      )

      showNotification(`Salle ${idRoomToDelete} supprimée`, 3000, 'success')
    } catch (error) {
      console.error('Erreur lors de la suppression de la salle :', error)
      showNotification(
        `Erreur lors de la suppression de la salle : ${error.message}`,
        3000,
        'error'
      )
    }
  }

  const handleUpdateTpi = async (roomIndex, tpiIndex, updatedTpi) => {
    // Mettre à jour la salle de TPI dans newRooms
    setNewRooms(prevRooms => {
      const updatedRooms = [...prevRooms]
      updatedRooms[roomIndex].tpiDatas[tpiIndex] = updatedTpi
      return updatedRooms
    })

    try {
      // Mettre à jour les données dans la BD immédiatement
      const updatedRoom = {
        ...newRooms[roomIndex]
      }
      await saveDataToLocalStorage(updatedRoom)
    } catch (error) {
      showNotification(
        `Erreur lors de la mise à jour de la salle de TPI dans la base de données : ${error}`,
        'error'
      )
    }
  }

  const toggleEditing = () => {
    setIsEditing(prevIsEditing => !prevIsEditing)
  }

  // Fonction pour sauvegarder les données dans localStorage
  const saveDataToLocalStorage = data => {
    data.lastUpdate = Date.now()
    return new Promise(resolve => {
      const jsonData = JSON.stringify(data)
      localStorage.setItem('organizerData', jsonData)
      resolve()
    })
  }

  // Fonction pour gérer le processus de sauvegarde des données
  const handleSave = async () => {
    console.log('handleSave newRooms: ', newRooms)

    // Étape 1: Mettre à jour la propriété lastUpdate pour chaque salle avec la nouvelle date
    const updatedRooms = newRooms.map(room => ({
      ...room,
      // Mettre à jour avec la nouvelle date
      lastUpdate: new Date().getTime()
    }))

    // Mettre à jour l'état newRooms avec la liste des salles mises à jour
    setNewRooms(updatedRooms)

    // Sauvegarder les données dans localStorage avec la nouvelle date
    saveDataToLocalStorage(updatedRooms)

    // Afficher le message de sauvegarde avec une durée de 3 secondes
    showNotification('Données sauvegardées avec succès !', 3000)
  }

  const handleExport = async () => {
    if (newRooms.length === 0) {
      showNotification('Aucune salle à sauvegarder.', 3000)
      return
    }

    try {
      // Mise à jour de chaque TPI dans chaque salle
      for (const room of newRooms) {
        for (const tpi of room.tpiDatas) {
          // Supposons que handleUpdateTpi est une fonction qui retourne une promesse
          await handleUpdateTpi(room.idRoom, tpi.id, tpi)
        }
      }

      // Conversion des salles mises à jour en format JSON
      const jsonRooms = JSON.stringify(newRooms)

      // Création de l'objet Blob et du lien de téléchargement
      const blob = new Blob([jsonRooms], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'backupRooms.json'
      link.click()
      URL.revokeObjectURL(url)

      showNotification('Exportation réussie.')
    } catch (error) {
      console.error("Erreur lors de l'exportation des données :", error)
      showNotification("Erreur lors de l'exportation.")
    }
  }

  // Fonction pour charger les données depuis le fichier JSON
  const handleLoadConfig = jsonData => {
    try {
      const parsedData = JSON.parse(jsonData)
      // Vérifier que les données chargées sont un tableau
      if (Array.isArray(parsedData)) {
        // Mettre à jour les salles avec les nouvelles données
        setNewRooms(parsedData)
        showNotification('Données chargées avec succès !', 3000)
      } else {
        showNotification(
          'Le fichier JSON ne contient pas un tableau valide.',
          3000
        )
      }
    } catch (error) {
      console.error('Erreur lors du traitement du fichier JSON :', error)
    }
  }

  const handleSwapTpiCards = (draggedTpiID, targetTpiID) => {
    console.log('Nombre de salles: ', newRooms.length)

    // Recherche des salles qui contiennent les TPI correspondants
    const draggedTpiRoomIndex = newRooms.findIndex(room =>
      room.tpiDatas.some(tpi => tpi.id === draggedTpiID)
    )

    const targetTpiRoomIndex = newRooms.findIndex(room =>
      room.tpiDatas.some(tpi => tpi.id === targetTpiID)
    )

    // Vérifier si les TPI et les salles correspondantes ont été trouvés
    if (draggedTpiRoomIndex === -1 || targetTpiRoomIndex === -1) {
      showNotification('TPI ou salle invalide.', 3000)
      return
    }

    // Trouver l'index du tpiDatas correspondant au draggedTpiID et au targetTpiID dans leurs salles respectives
    const draggedTpiRoom = newRooms[draggedTpiRoomIndex]
    const targetTpiRoom = newRooms[targetTpiRoomIndex]

    const draggedTpiIndex = draggedTpiRoom.tpiDatas.findIndex(
      tpi => tpi.id === draggedTpiID
    )
    const targetTpiIndex = targetTpiRoom.tpiDatas.findIndex(
      tpi => tpi.id === targetTpiID
    )

    // Vérifier si les tpi correspondants ont été trouvés
    if (draggedTpiIndex === -1 || targetTpiIndex === -1) {
      showNotification('ID de tpi invalide.', 3000)
      return
    }

    // Effectuer le swap en utilisant une variable temporaire
    const tempTpi = { ...draggedTpiRoom.tpiDatas[draggedTpiIndex] }
    draggedTpiRoom.tpiDatas[draggedTpiIndex] = {
      ...targetTpiRoom.tpiDatas[targetTpiIndex]
    }
    targetTpiRoom.tpiDatas[targetTpiIndex] = tempTpi

    // Créer un nouvel objet newRooms avec les modifications effectuées
    const updatedNewRooms = newRooms.map((room, index) => {
      if (index === draggedTpiRoomIndex) {
        return draggedTpiRoom
      } else if (index === targetTpiRoomIndex) {
        return targetTpiRoom
      } else {
        return room
      }
    })

    // Mettre à jour l'état avec le nouvel objet newRooms
    setNewRooms(updatedNewRooms)
    saveDataToLocalStorage(updatedNewRooms)
  }

  const handleonFetchConfig = async () => {
    // Prévoir une amélioration de ce système
    const currentYear = new Date().getFullYear()

    try {
      const response = await fetch(`${apiUrl}/api/tpiRoomYear/${currentYear}`)

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération de la configuration.')
      }

      const configData = await response.json() // Convertir la réponse en JSON

      // Effacer les données existantes dans localStorage
      localStorage.removeItem('organizerData')

      // Enregistrer les nouvelles données dans localStorage
      localStorage.setItem('organizerData', JSON.stringify(configData))

      console.log(
        "Configuration chargée pour l'année",
        currentYear,
        ':',
        configData
      )
    } catch (error) {
      console.error('Erreur lors du chargement de la configuration:', error)
      // Gérer l'erreur ici (par exemple, afficher une notification)
    }
  }

  const handleTransmitToDatabase = async () => {
    let roomsData

    try {
      // Sauvegarde de l'état actuel des salles
      if (handleSave && typeof handleSave === 'function') {
        // Pour rappel, cette fonction modifie la date de dernière mise à jour...
        handleSave()
      }

      const newRoomsData = localStorage.getItem('organizerData')
      if (!newRoomsData) {
        throw new Error('Aucune donnée trouvée dans localStorage')
      }
      roomsData = JSON.parse(newRoomsData)

      if (!Array.isArray(roomsData) || roomsData.length === 0) {
        throw new Error(
          'Le contenu de "organizerData" n\'est pas un tableau ou est vide.'
        )
      }

      // Parcours des données des salles
      for (const room of roomsData) {
        // Transformation du schéma   const updatedRoom = updateTpiDatas(room);
        const isDataTransmitted = await transmitToDatabase(room)

        if (isDataTransmitted) {
          showNotification('Données transmises avec succès', 3000, 'success')
          console.log('Données transmises avec succès')
        } else {
          showNotification('Erreur lors de la transmission', 3000, 'error')
          throw new Error('Données non transmises')
        }
      }
    } catch (error) {
      console.error('Erreur lors de la transmission des données :', error)
      showNotification(error.message, 3000, 'error')
    }
  }

  return (
    <>
      <TpiScheduleButtons
        configData={configO2023}
        onNewRoom={handleNewRoom}
        onToggleEditing={toggleEditing}
        onExport={handleExport}
        onSave={handleSave}
        onLoadConfig={handleLoadConfig}
        onPublish={() => {
          const uniqueDate =
            newRooms.length > 0 ? newRooms[0].date.substring(0, 4) : null
          if (uniqueDate) {
            handlePublish(uniqueDate)
          } else {
            console.error('Aucune date disponible dans la liste des salles')
          }
        }}
        toggleArrow={toggleArrow}
        isArrowUp={isArrowUp}
        onFetchConfig={handleonFetchConfig}
        OnSendBD={handleTransmitToDatabase}
      />

      <div id='rooms'>
        {newRooms.map((room, indexRoom) => (
          <DateRoom
            key={indexRoom}
            roomIndex={indexRoom}
            roomData={room}
            isEditOfRoom={isEditing}
            onUpdateTpi={(tpiIndex, updatedTpi) =>
              handleUpdateTpi(indexRoom /*room.idRoom*/, tpiIndex, updatedTpi)
            }
            onSwapTpiCards={(draggedTpi, targetTpi) =>
              handleSwapTpiCards(draggedTpi, targetTpi)
            }
            onDelete={() => handleDelete(room.idRoom)}
          />
        ))}
      </div>
    </>
  )
}
export default TpiSchedule
