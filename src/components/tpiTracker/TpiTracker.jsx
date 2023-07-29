import React, { useState, useEffect } from "react";
import { AES, enc } from "crypto-js";

import Register from "./Register";
import RegisterToProjects from "./RegisterToProjets";
import TpiTrackerButtons from "./TpiTrackerButtons";

import { getUsers } from "../tpiControllers/TpiUsersController";

import { showNotification } from "../Utils";

import "../../css/tpiTracker/tpiTrackerStyle.css";

const secret = "Le ciel étoilé brille de mille feux dans la nuit.";

const Home = () => {
  return (
    <div className="home">
      <h1>
        tpiTracker <br /> La nouvelle plateforme pour le suivi des étudiants
      </h1>
      <p>
        Bienvenue sur tpiTracker, la nouvelle plateforme qui s'occupe de
        l'inscription des experts, des chefs de projet, de la création des TPI
        (Travaux Pratiques Industriels) et de leur affectation. Cette plateforme
        permet également la planification des soutenances avec une interface
        intuitive de glisser-déposer (drag and drop).
      </p>
      <p>
        tpiTracker est conçu pour faciliter le suivi des étudiants pendant leur
        TPI, en automatisant certains processus et en permettant une gestion
        efficace des ressources disponibles.
      </p>
      <p>
        Veuillez noter que ce programme est réservé au doyen de l'établissement
        ou aux personnes concernées qui ont reçu des autorisations spéciales
        d'accès.
      </p>
      <p>
        Commencez dès maintenant en vous connectant en tant que doyen ou
        utilisateur autorisé !
      </p>
    </div>
  );
};

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [passwordField, setPasswordField] = useState("");
  // nous ne pouvons initiliser le variable d'état avec getUsers()
  const [usersDataState, setUsersDataState] = useState([]);

  // Utilisation de useEffect pour récupérer les données des utilisateurs une fois que le composant est monté
  useEffect(() => {
    const fetchUsersData = async () => {
      try {
        // Appel à getUsers() pour obtenir les données des utilisateurs
        const usersData = await getUsers();
        setUsersDataState(usersData); // Mettre à jour l'état avec les données des utilisateurs
      } catch (error) {
        console.error(
          "Erreur lors de la récupération des données des utilisateurs :",
          error
        );
        showNotification(
          "Erreur lors de la vérification des identifiants",
          4000
        );
      }
    };

    // Appeler la fonction fetchUsersData pour récupérer les données des utilisateurs
    fetchUsersData();
  }, []);

  const handleLogin = async () => {
    try {
      // Attendre la résolution de la promesse pour obtenir les données des utilisateurs
      const usersData = await usersDataState;

      // Rechercher l'utilisateur dans le tableau résolu (usersData) au lieu de la promesse (usersDataState)
      const user = usersData.find((userData) => userData.login === username);
      if (user) {
        const decryptedPassword = AES.decrypt(user.password, secret).toString(
          enc.Utf8
        );

        if (decryptedPassword === passwordField) {
          onLogin(user);
        } else {
          showNotification("Identifiants incorrects", 4000);
        }
      } else {
        showNotification("Utilisateur non trouvé", 4000);
      }
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des données des utilisateurs :",
        error
      );
      showNotification("Erreur lors de la vérification des identifiants", 4000);
    }
  };

  return (
    <div className="login">
      <h2>Connexion</h2>
      <input
        className="username"
        type="text"
        placeholder="Nom d'utilisateur"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        className="password"
        type="password"
        placeholder="Mot de passe"
        value={passwordField}
        onChange={(e) => setPasswordField(e.target.value)}
      />
      <button onClick={handleLogin}>Se connecter</button>
    </div>
  );
};

const TpiTracker = ({ toggleArrow, isArrowUp }) => {
  const [user, setUser] = useState(null);

  const handleOnLogin = (user) => {
    setUser(user);
  };

  return (
    <>
      <TpiTrackerButtons
        toggleArrow={toggleArrow}
        isArrowUp={isArrowUp}
        user={user}
      />
      {user ? (
        <>
          <div className="container">
            <h1>Bienvenue, {user.firstName} !</h1>
            {user.role === "student" ? (
              <RegisterToProjects userRole="student" />
            ) : user.role === "projectManager" ? (
              <RegisterToProjects userRole="projectManager" />
            ) : user.role === "dean" ? (
              <RegisterToProjects userRole="dean" />
            ) : user.role === "expert" ? (
              <RegisterToProjects userRole="expert" />
            ) : (
              <h2>Role inconnu</h2>
            )}
          </div>
        </>
      ) : (
        <div className="box">
          <Home />
          <Login onLogin={handleOnLogin} />
          <Register secret={secret} />
        </div>
      )}
    </>
  );
};

export default TpiTracker;
