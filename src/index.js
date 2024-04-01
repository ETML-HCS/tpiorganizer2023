import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Si vous souhaitez commencer à mesurer les performances de votre application, passez une fonction
// pour enregistrer les résultats (par exemple: reportWebVitals(console.log))
// ou envoyez vers un point de terminaison d'analyse. Apprenez-en plus: https://bit.ly/CRA-vitals
reportWebVitals();
