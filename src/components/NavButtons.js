import React, { useState } from 'react';

const NavButton = () => {
  const [selectedOption, setSelectedOption] = useState('');

  const handleAddClass = () => {
    // Ajouter une classe au bouton
    // ...
  };

  const handleOptionChange = (event) => {
    setSelectedOption(event.target.value);
  };

  return (
    <div id="tools">
        <button id="btNewRoom" onClick={handleAddClass}> &#x1F4DA; New room</button>
        <button id="btSendEmail" onClick={handleAddClass}>&#x1F4E7; Send</button>
        <button id="btEdition" onClick={handleAddClass}>&#x1F4DD; Edition</button>
        
        <select id="btSites" value={selectedOption} onChange={handleOptionChange}>
            <option value="">Sélectionner une option</option>
            <option value="ETML">ETML</option>
            <option value="CFPV">CFPV</option>
        </select>

    </div>
  );
};

export default NavButton;
