import React from "react";
import { Link } from "react-router-dom";
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

const Home = () => {
  // Tableau d'objets pour définir les boutons avec leurs noms et liens associés
  const buttons = [
    {
      name: "Planification des TPI",
      link: "/prog",
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
        {buttons.map((button, index) => (
          <Link to={button.link} key={index}>
            <div
              className="custom-button"
              style={{ backgroundColor: colors[index % colors.length] }}
            >
              {button.name}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Home;
