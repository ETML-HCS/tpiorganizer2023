import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CryptoJS from 'crypto-js';

// Pour accéder à la variable d'environnement REACT_APP_DEBUG
const debugMode = process.env.REACT_APP_DEBUG === 'true'; // Convertir en booléen si nécessaire
// Pour accéder à la variable d'environnement REACT_APP_API_URL
const apiUrl = debugMode ? process.env.REACT_APP_API_URL_TRUE : process.env.REACT_APP_API_URL_FALSE;

console.log('val de apiurl : ',apiUrl)

const TokenGenerator = () => {
  const [secretKey, setSecretKey] = useState('');
  const [experts, setExperts] = useState([]); // Renommé pour refléter qu'il contient plus que des emails
  const [generatedUrls, setGeneratedUrls] = useState([]);
  const [selectedYear, setSelectedYear] = useState(2024); // Ajout de l'état pour l'année sélectionnée

  useEffect(() => {
    const loadEmails = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/experts/emails`);
        setExperts(response.data); // Ajusté pour utiliser setExperts
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      }
    };

    loadEmails();
  }, []);

  const handleGenerateTokens = async () => {
    console.log('Début de la génération des tokens...');
    const urls = [];
    const update = [];

    console.log(experts)

    for (const { email, name } of experts) { // Déstructuration pour obtenir email et name
      const token = CryptoJS.SHA256(email + secretKey).toString();
      const url = `/calendrierDefenses/${selectedYear}?token=${token}`; // Utilisation de l'année sélectionnée

      update.push({ token, email, name });
      urls.push({ email, name, url });
    }
    try {
      const response = await axios.put(`${apiUrl}/api/experts/putTokens`, update);

    } catch (error) {
      console.error(`Erreur lors de la sauvegarde dans la base de données pour ${update} :`, error);
    }

    console.log('Génération des tokens terminée.');
    setGeneratedUrls(urls);
  };

  return (
    <div className="container" style={{ marginTop: "30px" }}>
      <h2>Générateur de Tokens</h2>
      <div className="form-group">
        <label htmlFor="year">Année :</label>
        <select id="year" className="form-control" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
          {[2022, 2023, 2024, 2025, 2026, 2027].map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <input
          type="text"
          className="form-control"
          placeholder="Clé secrète"
          value={secretKey}
          onChange={e => setSecretKey(e.target.value)}
        />
      </div>
      <div className="form-group">
        <button className="btn btn-primary" onClick={handleGenerateTokens}>Générer Tokens</button>
      </div>
      <ul className="list-group">
        {generatedUrls.map(({ email, name, url }, index) => (
          <li key={index} className="list-group-item">
            <strong>{name} ({email}):
              <br />
            </strong> <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TokenGenerator;
