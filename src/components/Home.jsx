import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'

import '../css/home.css' // Fichier CSS pour les styles spécifiques à la page Home

const colors = ['#007bff', '#28a745', '#6f42c1']

const pastelColors = [
  '#87CEEB', // Bleu ciel pastel
  '#FFA07A', // Saumon clair
  '#17a2b8'
]

const SoutenanceMenu = ({ onClose }) => {
  const navigate = useNavigate()
  const years = [2020, 2023, 2024, 2025, 2026]

  const handleYearSelect = year => {
    onClose()
    navigate(`/calendrierDefenses/${year}`)
  }

  return (
    <div className='soutenance-menu'>
      <h2>Sélectionnez une année</h2>
      <select onChange={e => handleYearSelect(e.target.value)} defaultValue=''>
        <option value='' disabled>
          Choisissez une année
        </option>
        {years.map(year => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
      <button onClick={onClose}>Fermer</button>
    </div>
  )
}

const Home = () => {
  const [showSoutenanceMenu, setShowSoutenanceMenu] = useState(false)

  const handleSoutenanceClick = () => {
    setShowSoutenanceMenu(true)
  }

  // Tableau d'objets pour définir les boutons avec leurs noms et liens associés
  const buttons = [
    {
      name: 'Planification des TPI',
      link: '/planification'
    },
    {
      name: 'Gestion des TPI',
      link: '/gestionTPI'
    },
    {
      name: 'Calendrier des défenses',
      link: '/calendrierDefenses'
    },
    {
      name: 'Suivi des étudiants',
      link: '/suiviEtudiants'
    },
    {
      name: 'Évaluation du TPI',
      link: '/evaluationTPI'
    },
    {
      name: 'Rapports et statistiques',
      link: '/rapportStatistiques'
    },
    {
      name: 'Archiver TPI',
      link: '/archiverTPI'
    },
    {
      name: 'Alertes et notifications',
      link: '/alertesNotifications'
    },
    {
      name: 'Importer/Exporter des données',
      link: '/importerExporterDonnees'
    },
    {
      name: 'Génération des tokens',
      link: '/genTokens'
    }
  ]

  return (
    <div className='home'>
      {/* Contenu de l'accueil */}
      <h1 className='home-title'>TPI Organizer version 2023</h1>
      <p className='home-description'>
        TPIorganizer version 2023 est une application React permettant
        d'organiser et de gérer les soutenances de TPI (Travaux de fin d'études)
        selon différentes dates et salles.
      </p>

      {/* Générer les boutons à partir du tableau d'objets */}
      <div className='button-container'>
        {buttons.map((button, index) => {
          if (button.name === 'Calendrier des défenses') {
            return (
              <div
                key={index}
                className='custom-button'
                style={{ backgroundColor: pastelColors[index % colors.length] }}
                onClick={handleSoutenanceClick}
              >
                {button.name}
              </div>
            )
          }
          return (
            <Link
              to={button.link}
              key={index}
              style={{ textDecoration: 'none' }}
            >
              <div
                className='custom-button'
                style={{ backgroundColor: colors[index % colors.length] }}
              >
                {button.name}
              </div>
            </Link>
          )
        })}
      </div>
      {showSoutenanceMenu && (
        <SoutenanceMenu onClose={() => setShowSoutenanceMenu(false)} />
      )}
    </div>
  )
}

export default Home
