import React, { Fragment, useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Navigate, useNavigate } from 'react-router-dom';



import Home from "./components/Home";
import TpiSchedule from "./components/tpiSchedule/TpiSchedule";
import TpiManagement from "./components/tpiManagement/TpiManagement";
import TpiTracker from "./components/tpiTracker/TpiTracker";
import TpiSoutenance from './components/tpiSoutenance/TpiSoutenance';
import TokenGenerator from "./components/genToken/genToken";
import LoginPage from "./components/loginPage";

import "./css/globalStyles.css";
import { showNotification } from "./components/Utils";

//#region Layout
const Layout = ({ isAuthenticated, login, logout }) => {
  const location = useLocation();
  const dateAujourdhui = new Date();
  const dateFormatted = dateAujourdhui.toLocaleDateString();
  const [isArrowUp, setIsArrowUp] = useState(false);

  // Fonction pour vérifier si l'entête doit être affiché
  const shouldShowHeader = () => {
    return !location.pathname.startsWith('/soutenance/');
  };

  const navigate = useNavigate();
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/'); // Redirigez l'utilisateur après la connexion
    }
  }, [isAuthenticated]); // Ajoutez navigate comme dépendance

  useEffect(() => {
    const updateRoomPaddingTop = () => {
      const rootElement = document.getElementById("root");
      const headerElement = document.getElementById("header");

      // Si l'entête est présent, ajustez le padding en conséquence
      if (headerElement) {
        const { height } = headerElement.getBoundingClientRect();
        const paddingTop = isArrowUp ? height + 32 : 55;
        rootElement.style.setProperty("--room-padding-top", `${paddingTop}px`);
      } else {
        // Si l'entête n'est pas présent, appliquez un padding par défaut ou une autre logique adaptée
        const defaultPadding = "10";
        rootElement.style.setProperty("--room-padding-top", `${defaultPadding}px`);
      }
    };
    updateRoomPaddingTop(); // Appeler la fonction ici pour mettre à jour le padding lors du rendu initial
    window.addEventListener("load", updateRoomPaddingTop);
    window.addEventListener("resize", updateRoomPaddingTop);
  }, [isArrowUp]);

  const toggleArrow = () => {
    const upArrowButton = document.getElementById("upArrowButton");
    const downArrowButton = document.getElementById("downArrowButton");
    const elementTools = document.getElementById("tools");

    if (!upArrowButton || !downArrowButton || !elementTools) {
      return; // Vérifie si les éléments existent avant de continuer
    }

    if (isArrowUp) {
      upArrowButton.style.display = "none";
      downArrowButton.style.display = "block";
      elementTools.style.display = "none";
    } else {
      upArrowButton.style.display = "block";
      downArrowButton.style.display = "none";
      elementTools.style.display = "block";
    }

    setIsArrowUp((prevIsArrowUp) => !prevIsArrowUp);
  };

  return (
    <Fragment>
      {/* Entête */}
      {shouldShowHeader() && (
        <div id="header">
          <div id="title">
            <span id="left">
              <span className="etml">ETML</span> / CFPV{" "}
            </span>
            <span id="center">&#xF3; 2023</span>
            <span id="right" className="dateToday">
              aujourd'hui: {dateFormatted}{" "}
            </span>
          </div>
          <button
            onClick={toggleArrow}
            id="downArrowButton"
            className={!isArrowUp ? "active" : ""}
          >
            ▼ ▼ ▼
          </button>
        </div>)
      }

      {/* Configuration des Routes */}
      <Routes>
        {/* Redirection par défaut vers la page de connexion si non authentifié */}
        {!isAuthenticated && <Route path="*" element={<Navigate to="/login" replace />} />}

        {/* Route pour la page de connexion */}
        <Route path="/login" element={<LoginPage login={login} />} />

        {/* Routes accessibles une fois authentifié */}
        {isAuthenticated && (
          <>
            <Route path="/" element={<Home />} />
            <Route path="/planification" element={<TpiSchedule />} />
            <Route path="/gestion-tpi" element={<TpiManagement />} />
            <Route path="/suivi-etudiants" element={<TpiTracker />} />
            <Route path="/gen-tokens" element={<TokenGenerator />} />
            {/* Autres routes protégées */}
          </>
        )}

        {/* Routes toujours accessibles, authentifié ou non */}
        <Route path="/soutenance/:year" element={<TpiSoutenance />} />
      </Routes>

    </Fragment >
  );
};
//#endregion


//#region APP
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Simulez une fonction de connexion. dans une application réelle, vous devriez vérifier les identifiants de l'utilisateur, par exemple via une requête à une API.
  const login = (username, password) => {
    if (username === 'etmlAdmin' && password === 'Venir de Vennes, quelle veine !') {
      setIsAuthenticated(true);
      // Pas besoin d'appeler navigate ici, useEffect s'en chargera
    } else {
      showNotification('Identifiants incorrects', 'info');
    }
  };

  // Fonction de déconnexion
  const logout = () => {
    setIsAuthenticated(false);
  };

  console.log(isAuthenticated)

  return (
    <Router>
      <Layout isAuthenticated={isAuthenticated} login={login} logout={logout} />
    </Router>
  );
};
//#endregion

export default App;
