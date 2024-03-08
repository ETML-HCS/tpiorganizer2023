import React, { useState } from 'react'

import NewRoomForm from './newRoomForm'
import axios from 'axios'

// Pour accéder à la variable d'environnement REACT_APP_DEBUG
const debugMode = process.env.REACT_APP_DEBUG === 'true' // Convertir en booléen si nécessaire
// Pour accéder à la variable d'environnement REACT_APP_API_URL
const apiUrl = debugMode
  ? process.env.REACT_APP_API_URL_TRUE
  : process.env.REACT_APP_API_URL_FALSE

const TpiScheduleButtons = ({
  onNewRoom,
  onToggleEditing,
  onSave,
  OnSendBD,
  onExport,
  onPublish,
  configData,
  onLoadConfig,
  toggleArrow,
  onFetchConfig
}) => {
  const [showForm, setShowForm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedYear, setSelectedYear] = useState(null)

  const years = [2023, 2024, 2025, 2026]

  // Appelle la fonction fournie par le composant parent
  const handleFetchConfig = selectedYear => {
    console.log(selectedYear)
    onFetchConfig(selectedYear)
  }

  const handleAddRoom = () => {
    setShowForm(true)
  }

  const handleSendConfig = () => {
    OnSendBD()
  }

  const handleEdition = () => {
    setIsEditing(prevState => !prevState)
    onToggleEditing(prevState => !prevState)
  }

  const handleExport = () => {
    setIsEditing(false)
    onToggleEditing(false)
    onExport()
  }

  const handleSave = () => {
    onSave()
  }

  const handlePublish = () => {
    onPublish()
  }

  const handleFileChange = event => {
    const file = event.target.files[0]
    if (file) {
      // Charger le fichier .json en utilisant FileReader
      const fileReader = new FileReader()
      fileReader.onload = e => {
        const jsonData = e.target.result
        onLoadConfig(jsonData) // Appeler la fonction pour traiter les données chargées
      }
      fileReader.readAsText(file)
    }
  }

  const handleRapatrierClick = async year => {
    try {
      // Télécharger la collection (a) tpiSoutenance_2024 (représentant les salles) :
      // Cette collection reflète la vue des experts et du responsable.
      // Télécharger la collection (b) tpiRooms_2024 (représentant également les salles) :
      // Cette collection est la vue de l'organisateur.
      // Pour chaque salle de la collection (a) :
      // Extraire les parties tpiDatas (objets tpi) des experts1, experts2 et du responsable, contenant les offres.
      // Écraser les parties correspondantes dans la salle de la collection (b) :
      // tpiDatas (objets tpi) des experts1, experts2 et du responsable.
      // Comme les indexes sont identiques entre les deux collections,
      // envisager simplement de reprendre toute la collection (a) pour écraser la collection (b) pourrait être une option ?

      try {
        const response = await axios.post(
          `${apiUrl}/overwrite-tpi-rooms/${year}`
        )
        console.log(response.data.message) // Print the response message
      } catch (error) {
        console.error('Error overwriting TPI rooms:', error)
      }

      console.log('Mise à jour des offres terminée avec succès.')
    } catch (error) {
      console.error('Erreur lors de la mise à jour des offres :', error)
    }
  }

  return (
    <div id='tools'>
      {showForm ? (
        <NewRoomForm
          onNewRoom={onNewRoom}
          configData={configData}
          setShowForm={setShowForm}
        />
      ) : (
        <>
          <button
            id='btNewRoom'
            onClick={handleAddRoom}
            title='Ajouter une nouvelle salle'
          >
            Ajouter salle &#x1F4DA;
          </button>

          <button
            id='btSendConfig'
            onClick={handleSendConfig}
            title='Transmettre les salles vers la base de données'
          >
            Salles{`->`}BDD 🧬
          </button>

          {isEditing && (
            <button
              id='btExport'
              onClick={handleExport}
              title='Exporter les données'
            >
              Exporter &#x1F4E5;
            </button>
          )}

          <button
            id='btEdition'
            onClick={handleEdition}
            title='Basculer en mode édition'
          >
            Modifier &#x1F4DD;
          </button>

          <button
            id='btSave'
            onClick={handleSave}
            title='Enregistrer les modifications'
          >
            Enregistrer &#x1F4BE;
          </button>

          <label
            htmlFor='configFile'
            style={{ padding: '1px 6px', height: '24px' }}
            id='btLoadFile'
            title='Charger un fichier de configuration'
          >
            Charger &#x1F4C2;
          </label>

          <input
            type='file'
            id='configFile'
            accept='.json'
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <button
            onClick={() => handleFetchConfig(selectedYear)}
            id='btFetchConfig'
            title='Charger les salles depuis la base de données'
          >
            Salles{'<-'}BDD🧬
          </button>

          <button
            onClick={handlePublish}
            id='btPublier'
            title='Publier les informations'
          >
            Publier 📅
          </button>

          <div>
            <h1>List of Years</h1>
            <label>Select a year:</label>
            <select
              onChange={e => setSelectedYear(parseInt(e.target.value))}
              value={selectedYear || ''}
            >
              <option value=''>Select Year</option>
              {years.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <button
              className='publish-button'
              onClick={() => handleRapatrierClick(selectedYear)}
              title={`Rapatrier les informations pour l'année ${
                selectedYear || '??'
              } ↩️`}
              disabled={!selectedYear}
            >
              Rapatrier ↩️
            </button>
          </div>

          <div
            onClick={() => toggleArrow(!toggleArrow)} // Utilisez une fonction pour mettre à jour l'état
            id='upArrowButton'
            className={!toggleArrow ? '' : 'active'} // Assurez-vous que la logique conditionnelle correspond à l'état désiré
          >
            ▲ ▲ ▲{' '}
          </div>
        </>
      )}
    </div>
  )
}

export default TpiScheduleButtons
