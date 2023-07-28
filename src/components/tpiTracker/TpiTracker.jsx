import React, { useState, useEffect } from "react";
import { AES, enc } from "crypto-js";

import Register from "./Register";
import RegisterToProjects from "./RegisterToProjets";
import TpiTrackerButtons from "./TpiTrackerButtons";

import usersData from "../../config/subscribers.json";
import "../../css/tpiTracker/tpiTrackerStyle.css";

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
  const [password, setPassword] = useState("");
  const [usersDataState, setUsersDataState] = useState([]);

  useEffect(() => {
    // Affichez la valeur mise à jour de usersDataState
    console.log(usersDataState);
  }, [usersDataState]);

  useEffect(() => {
    // Déchiffrez les mots de passe des utilisateurs en utilisant le mot de passe "secret"
    const decryptedUsersData = usersData.map((user) => {
      return {
        ...user,
        password: decryptData(user.password, "secret"),
      };
    });
    // Définissez les données déchiffrées comme état usersDataState
    setUsersDataState(decryptedUsersData);
  }, []);

  // Fonction pour déchiffrer les données en utilisant AES
  const decryptData = (encryptedData, password) => {
    try {
      const bytes = AES.decrypt(encryptedData.toString(), password);
      const decryptedData = bytes.toString(enc.Utf8);
      return decryptedData;
    } catch (error) {
      console.error("Erreur lors du déchiffrement des données :", error);
      return null;
    }
  };

  const handleLogin = () => {
    const user = usersDataState.find(
      (userData) => userData.username === username
    );
    if (user && password === user.password) {
      onLogin(username, user.role);
    } else {
      alert("Identifiants incorrects");
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
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleLogin}>Se connecter</button>
    </div>
  );
};

const TpiTracker = ({ toggleArrow, isArrowUp }) => {
  const [user, setUser] = useState(null);

  const handleOnLogin = (username, role) => {
    setUser({ username, role });
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
            <h1>Bienvenue, {user.username} !</h1>
            {user.role === "etudiant" ? (
              <RegisterToProjects userRole="etudiant" />
            ) : user.role === "boss" ? (
              <RegisterToProjects userRole="boss" />
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
          <Register />
        </div>
      )}
    </>
  );
};

export default TpiTracker;
