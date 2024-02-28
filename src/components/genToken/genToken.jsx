import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CryptoJS from 'crypto-js';

const urlApi = 'http://localhost:5000';


const TokenGenerator = () => {
  const [secretKey, setSecretKey] = useState('');
  const [experts, setExperts] = useState([]); // Renommé pour refléter qu'il contient plus que des emails
  const [generatedUrls, setGeneratedUrls] = useState([]);
  useEffect(() => {
    const loadEmails = async () => {
      try {
        const response = await axios.get(`${urlApi}/api/experts/emails`);
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
      const url = `/soutenance/2024?token=${token}`;

      update.push({ token, email, name });
      urls.push({ email, name, url });
    }
    try {
      const response = await axios.put(`${urlApi}/api/experts/putTokens`, update);

    } catch (error) {
      console.error(`Erreur lors de la sauvegarde dans la base de données pour ${update} :`, error);
    }

    console.log('Génération des tokens terminée.');
    setGeneratedUrls(urls);
  };

  return (
    <div style={{ marginTop: '2vh' }}>
      <h2>Générateur de Tokens</h2>
      <input
        type="text"
        placeholder="Clé secrète"
        value={secretKey}
        onChange={e => setSecretKey(e.target.value)}
      />
      <button onClick={handleGenerateTokens}>Générer Tokens</button>
      <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
        {generatedUrls.map(({ email, name, url }, index) => (
          <li key={index} style={{ margin: '10px 0', backgroundColor: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
            <strong>{name} ({email}):</strong> <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TokenGenerator;
