import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CryptoJS from 'crypto-js';

const urlApi = 'http://localhost:5000';


const TokenGenerator = () => {
  const [secretKey, setSecretKey] = useState('');
  const [emails, setEmails] = useState([]);
  const [generatedUrls, setGeneratedUrls] = useState([]);

  useEffect(() => {
    // Chargement des emails depuis MongoDB
    const loadEmails = async () => {
      try {
        const response = await axios.get(`${urlApi}/api/experts/emails`);
        console.log(response.data);
        setEmails(response.data);
      } catch (error) {
        console.error('Erreur lors du chargement des emails:', error);
      }
    };

    loadEmails();
  }, []);

  const handleGenerateTokens = async () => {
    console.log('Début de la génération des tokens...');
    const urls = [];
    const update = [];

    for (const email of emails) {
      console.log(`Traitement de l'email : ${email}`);
      const token = CryptoJS.SHA256(email + secretKey).toString();
      const url = `localhost/soutenance/2024?token=${token}`;
      console.log(`Token généré pour ${email} : ${token}`);

      update.push({ token, email })
      urls.push({ email, url });
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
      {/* Clé secrète _soutenances_2024_ */}
      <div>
        {generatedUrls.map(({ email, url }, index) => (
          <div key={index}>{`${email}: ${url}`}</div>
        ))}
      </div>
    </div>
  );
};

export default TokenGenerator;
