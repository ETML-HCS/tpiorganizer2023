import React, { useState } from 'react';
import { Link } from "react-router-dom";
import { useNavigate  } from 'react-router-dom';

import "../css/home.css"; // Fichier CSS pour les styles spécifiques à la page Home

const colors = [
  "#007bff",
  "#28a745",
  "#ffc107",
  "#dc3545",
  "#6610f2",
  "#fd7e14",
  "#17a2b8",
  "#6f42c1",
];


const SoutenanceMenu = ({ onClose }) => {
  const navigate = useNavigate();
  const years = [2024]; // Exemple d'années

  const handleYearSelect = (year) => {
    onClose();
    navigate(`/soutenance/${year}`);
  };

  return (
    <div className="soutenance-menu">
      <h2>Sélectionnez une année</h2>
      <select onChange={(e) => handleYearSelect(e.target.value)} defaultValue="">
        <option value="" disabled>Choisissez une année</option>
        {years.map(year => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
      <button onClick={onClose}>Fermer</button>
    </div>
  );
};

const Home = () => {

  const [showSoutenanceMenu, setShowSoutenanceMenu] = useState(false);

  const handleSoutenanceClick = () => {
    setShowSoutenanceMenu(true);
  };

  // Tableau d'objets pour définir les boutons avec leurs noms et liens associés
  const buttons = [
    {
      name: "Planification des TPI",
      link: "/planification",
    },
    {
      name: "Gestion des TPI",
      link: "/gestion-tpi",
    },
    {
      name: "Calendrier des défenses",
      link: "/calendrier-defenses",
    },
    {
      name: "Suivi des étudiants",
      link: "/suivi-etudiants",
    },
    {
      name: "Évaluation du TPI",
      link: "/evaluation-tpi",
    },
    {
      name: "Rapports et statistiques",
      link: "/rapports-statistiques",
    },
    {
      name: "Archiver TPI",
      link: "/archiver-tpi",
    },
    {
      name: "Alertes et notifications",
      link: "/alertes-notifications",
    },
    {
      name: "Importer/Exporter des données",
      link: "/importer-exporter-donnees",
    },
    {
      name: "Génération des tokens",
      link: "/gen-tokens",
    },
    {
      name: "Soutenances",
      link: "/soutenance",
    },

  ];

  return (
    <div className="home">
      {/* Contenu de l'accueil */}
      <h1 className="home-title">TPI Organizer version 2023</h1>
      <p className="home-description">
        TPIorganizer version 2023 est une application React permettant
        d'organiser et de gérer les soutenances de TPI (Travaux de fin d'études)
        selon différentes dates et salles.
      </p>

      {/* Générer les boutons à partir du tableau d'objets */}
      <div className="button-container">
      {buttons.map((button, index) => {
        if (button.name === "Soutenances") {
          return (
            <div
              key={index}
              className="custom-button"
              style={{ backgroundColor: colors[index % colors.length] }}
              onClick={handleSoutenanceClick}
            >
              {button.name}
            </div>
          );
        }
        return (
          <Link to={button.link} key={index}>
            <div
              className="custom-button"
              style={{ backgroundColor: colors[index % colors.length] }}
            >
              {button.name}
            </div>
          </Link>
        );
      })}
    </div>
    {showSoutenanceMenu && <SoutenanceMenu onClose={() => setShowSoutenanceMenu(false)} />}
  </div>
  );
};

export default Home;
