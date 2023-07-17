import React, { useState } from 'react';
import roomsData from './rooms.json'; // Importez les données du fichier JSON

const NewRoomForm = ({ onNewRoom }) => {
  const [date, setDate] = useState('');
  const [room, setRoom] = useState('');
  const [site, setSite] = useState('');
  const [availableRooms, setAvailableRooms] = useState([]);

  const handleFormSubmit = (e) => {
    e.preventDefault();

    if (date && room && site) {
      onNewRoom({ date, room, site });
      setDate('');
      setRoom('');
      setSite('');
    }
  };

  const handleSiteChange = async (e) => {
    const selectedSite = e.target.value;
    setSite(selectedSite);
  
    // Mettre à jour les salles disponibles en fonction du choix de l'école
    if (selectedSite === 'ETML') {
      const rooms = roomsData.etml; // Utilisez roomsData.etml pour accéder aux salles ETML
      setAvailableRooms(rooms);
    } else if (selectedSite === 'CFPV') {
      const rooms = roomsData.cfpv; // Utilisez roomsData.cfpv pour accéder aux salles CFPV
      setAvailableRooms(rooms);
    } else {
      setAvailableRooms([]);
    }
  };

  return (
    <form onSubmit={handleFormSubmit}>
      <label htmlFor="date">Date :</label>
      <input
        type="date"
        id="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />

      <label htmlFor="site">Site :</label>
      <select
        id="site"
        value={site}
        onChange={handleSiteChange}
        required
      >
        <option value="">Sélectionner une option</option>
        <option value="ETML">ETML</option>
        <option value="CFPV">CFPV</option>
      </select>

      <label htmlFor="availableRooms">Salles disponibles :</label>
      <select
        id="availableRooms"
        value={room}
        onChange={(e) => setRoom(e.target.value)}
        required
      >
        <option value="">Sélectionner une salle</option>
        {availableRooms.map((availableRoom) => (
          <option key={availableRoom} value={availableRoom}>
            {availableRoom}
          </option>
        ))}
      </select>

      <button type="submit">Valider</button>
    </form>
  );
};

export default NewRoomForm;
