// nouvelle fonction brouillon ...

import React from "react";
import { createCalendar } from "ical.js"; // Utilise la bibliothèque pour créer le fichier iCalendar

// Fonction pour formater la date au format ISO 8601
function formatDate(date) {
  // Vérifier si la valeur fournie est une chaîne de caractères
  if (typeof date === "string") {
    // Créer un objet Date à partir de la chaîne de caractères
    const parsedDate = new Date(date);
    // Vérifier si la date est valide
    if (!isNaN(parsedDate.getTime())) {
      // Formater la date au format ISO 8601
      return parsedDate.toISOString().replace(/[-:]|\.\d{3}/g, "");
    }
  }
  // Si la valeur fournie n'est pas valide, retourner null
  return null;
}

function generateICSFile(tpiDetails) {
  // Créer un objet d'événement iCalendar à partir des détails fournis
  const event = createCalendar({
    title: `Défense TPI - ${tpiDetails.candidat}`, // Titre de l'événement
    start: formatDate(tpiDetails.startDate),
    end: formatDate(tpiDetails.endDate),
    location: formatLocation(tpiDetails.locations), // Formatage des lieux
    description: formatDescription(tpiDetails), // Formatage de la description
  });

  console.log('generateICS: ',event)

  // Convertir l'objet d'événement en chaîne au format iCalendar (.ics)
  const icsData = event.toString();

  return icsData;
}

// Formatage des lieux (possibilité de plusieurs lieux)
function formatLocation(locations) {
  return locations.join(", ");
}

// Formatage de la description avec les détails du TPI
function formatDescription(tpiDetails) {
  let text =
    `Numéro unique du TPI: ${tpiDetails.tpiNumber}\n\n` +
    `Candidat: ${tpiDetails.candidat}\n` +
    `Expert 1: ${tpiDetails.expert1}\n` +
    `Expert 2: ${tpiDetails.expert2}\n` +
    `Chef de projet: ${tpiDetails.chefProjet}`;
  return text;
}

function downloadTPIEventICSFile(tpiDetails) {

  const icsData = generateICSFile(tpiDetails);

  // Créer un objet Blob à partir des données iCalendar
  const blob = new Blob([icsData], { type: "text/calendar" });

  // Créer un objet URL à partir du Blob
  const url = window.URL.createObjectURL(blob);

  // Créer un lien pour le téléchargement du fichier
  const link = document.createElement("a");
  link.href = url;
  // Nom du fichier téléchargé avec le numéro unique du TPI
  link.setAttribute("download", `TPI_${tpiDetails.tpiNumber}.ics`);
  document.body.appendChild(link);

  // Simuler un clic sur le lien pour déclencher le téléchargement
  link.click();

  // Nettoyer après le téléchargement
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function TPIEventAgendaDownloadButton({ tpiDetails }) {
  const handleDownload = () => {
    downloadTPIEventICSFile(tpiDetails);
  };

  return (
    <button onClick={handleDownload}>
      Télécharger la défense du TPI dans l'agenda
    </button>
  );
}

export default TPIEventAgendaDownloadButton;
