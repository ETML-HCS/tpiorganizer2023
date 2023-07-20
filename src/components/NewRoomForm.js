import React, { useState } from 'react';

const NewRoomForm = ({ onNewRoom, configData }) => {
  
  const [date, setDate] = useState('');
  const [nameRoom, setNameRoom] = useState('');
  const [site, setSite] = useState('');
  const [availableRooms, setAvailableRooms] = useState([]);

  const handleFormSubmit = (e) => {
    e.preventDefault();

    if (date && nameRoom && site) {
      onNewRoom({ date, nameRoom, site });
      setDate('');
      setNameRoom('');
      setSite('');
    }
  };

  const handleSiteChange = (e) => {
    console.log(configData);

    const selectedSite = e.target.value;
    setSite(selectedSite);
    
    if (selectedSite === 'ETML') {
      // Utiliser configData.etml.rooms pour accéder aux salles ETML
      const rooms = configData.etml.rooms;
      setAvailableRooms(rooms);
    } else if (selectedSite === 'CFPV') {
      // Utiliser configData.cfpv.rooms pour accéder aux salles CFPV
      const rooms = configData.cfpv.rooms;
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
        value={nameRoom}
        onChange={(e) => setNameRoom(e.target.value)}
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
