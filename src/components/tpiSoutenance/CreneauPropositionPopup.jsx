import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom'
import { showNotification } from "../Utils"


const CreneauPropositionPopup = ({ how, fermerPopup, tpiData, schedule }) => {
  const [propositions, setPropositions] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedCreneau, setSelectedCreneau] = useState('');

  const { year } = useParams(); // Extrait l'année des paramètres d'URL

  useEffect(() => {
    if (schedule.length > 0) {
      const premierCreneau = `${schedule[0].startTime} - ${schedule[0].endTime}`;
      setSelectedCreneau(premierCreneau);
    }
  }, [schedule]);

  const ajouterProposition = () => {
    // Vérification de la sélection de la date et du créneau
    if (selectedDate && selectedCreneau) {
      if (propositions.length < 3) {
        // Vérifie les doublons avant d'ajouter
        if (!propositions.some(prop => prop.date === selectedDate && prop.creneau === selectedCreneau)) {
          setPropositions([...propositions, { date: selectedDate, creneau: selectedCreneau }]);
        } else {
          showNotification("Cette proposition a déjà été faite.", 2000);
        }
      } else {
        showNotification("Vous ne pouvez pas ajouter plus de 3 propositions.");
      }
    } else {
      showNotification("Veuillez sélectionner une date et un créneau.");
    }
  };

  const sauvegarderPropositions = async () => {
    const apiUrl = 'http://localhost:5000';
    const url = `${apiUrl}/api/save-propositions/${year}`;

    const propositionsData = {
      userNameAsk: how, // Utilisez la propriété correcte ici
      tpi_id: tpiData.candidat,
      propositions: propositions // Envoyez le tableau de propositions directement
    };

    console.log("propositions: ", propositionsData);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(propositionsData)
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde des propositions');
      }

      const responseData = await response.json();
      console.log('Propositions sauvegardées avec succès', responseData);
      fermerPopup();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des propositions:', error);
    }
  };


  return (
    <div className='popup-container'>
      <div className='popup'>
        <h3>Propositions de créneau pour {tpiData?.candidat}</h3>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
        <select
          value={selectedCreneau}
          onChange={(e) => setSelectedCreneau(e.target.value)}
        >
          {schedule.map((creneau, index) => (
            <option key={`select_${index}`} value={`${creneau.startTime} - ${creneau.endTime}`}>
              {`${creneau.startTime} - ${creneau.endTime}`}
            </option>
          ))}
        </select>

        {/* Désactive le bouton si la date ou le créneau n'est pas sélectionné */}
        <button id='btnAddDate' onClick={ajouterProposition} disabled={!selectedDate || !selectedCreneau}>
          Ajouter
        </button>
        <ul>
          <h4> Ci-dessous vos propositions : </h4>
          {propositions.map((prop, index) => (
            <li key={`Creneau_${index}`}>{`${prop.date} - ${prop.creneau}`}</li>
          ))}
        </ul>
        <span>
          <button id='btnSave' onClick={sauvegarderPropositions}>Sauvegarder</button>
          <button id='btnClose' onClick={fermerPopup}>Fermer</button>
        </span>

      </div>
    </div >
  );
};
export default CreneauPropositionPopup;
