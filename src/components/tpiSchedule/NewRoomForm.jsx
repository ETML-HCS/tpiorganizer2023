import React, { useState } from "react";
import { showNotification } from "../Utils";

const NewRoomForm = ({ onNewRoom, setShowForm, configData }) => {
  const [date, setDate] = useState("");
  const [nameRoom, setNameRoom] = useState("");
  const [site, setSite] = useState("");
  const [availableRooms, setAvailableRooms] = useState([]);

  const handleFormSubmit = (e) => {
    e.preventDefault();

    if (date && nameRoom && site) {
      onNewRoom({ date, nameRoom, site });
      setShowForm(false);
      setDate(date);
      setNameRoom(nameRoom);
      setSite(site);
    } else {
      showNotification(
        "Veuillez saisir les informations demandées avant de valider la salle, s'il vous plaît.",
        3000
      );
    }
  };

  const handleCancel = () => {
    // Reset the form fields and hide the form
    setDate("");
    setNameRoom("");
    setSite("");
    setAvailableRooms([]);
    setShowForm(false);
  };

  const handleSiteChange = (e) => {
    const selectedSite = e.target.value;
    setSite(selectedSite);

    if (selectedSite === "ETML") {
      // Utiliser configData.etml.rooms pour accéder aux salles ETML
      const rooms = configData.etml.rooms;
      setAvailableRooms(rooms);
    } else if (selectedSite === "CFPV") {
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
      <select id="site" value={site} onChange={handleSiteChange} required>
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

      <div
        type="submit"
        onClick={handleFormSubmit}
        style={{
          fontWeight: "bolder",
          backgroundColor: "#0074D9",
          color: "white",
          padding: "3px",
          textAlign: "center",
        }}
      >
        Valider
      </div>
      <div
        style={{
          position: "absolute",
          top: "4px",
          right: "15px",
          cursor: "pointer",
          fontSize: "20px",
          fontWeight: "bold",
        }}
        onClick={handleCancel}
      >
        &times;
      </div>
    </form>
  );
};

export default NewRoomForm;
