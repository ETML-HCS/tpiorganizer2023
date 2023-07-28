import React, { Fragment, useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Home from "./components/Home";
import TpiSchedule from "./components/tpiSchedule/tpiSchedule";
import TpiManagement from "./components/tpiManagement/TpiManagement";
import TpiTracker from "./components/tpiTracker/TpiTracker";

import "./css/globalStyles.css";

const App = () => {
  const [isArrowUp, setIsArrowUp] = useState(false);
  const dateAujourdhui = new Date();
  const dateFormatted = dateAujourdhui.toLocaleDateString();

  useEffect(() => {
    const updateRoomPaddingTop = () => {
      const rootElement = document.getElementById("root");
      const headerElement = document.getElementById("header");

      const { height } = headerElement.getBoundingClientRect();
      const paddingTop = isArrowUp ? height+32 : 55;
      rootElement.style.setProperty("--room-padding-top", `${paddingTop}px`);
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
    <Router>
      <Fragment>
        {/* Entête */}
        {
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
          </div>
        }
        {/* Les routes du programme */}
        {
          <Routes>
            <Route path="/" element={<Home />}>
              {/* Page d'accueil (peut-être la liste des salles) */}
            </Route>
            <Route
              path="/planification"
              element={
                <TpiSchedule toggleArrow={toggleArrow} isArrowUp={isArrowUp} />
              }
            />
            <Route
              path="/gestion-tpi"
              element={
                <TpiManagement
                  toggleArrow={toggleArrow}
                  isArrowUp={isArrowUp}
                />
              }
            ></Route>
            <Route
              path="/suivi-etudiants"
              element={
                <TpiTracker toggleArrow={toggleArrow} isArrowUp={isArrowUp} />
              }
            ></Route>
          </Routes>
        }
      </Fragment>
    </Router>
  );
};
export default App;
