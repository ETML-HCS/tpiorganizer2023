import React, { useState } from 'react';

import './loginPage.css';

const LoginPage = ({ login }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault(); // Empêche le comportement par défaut du formulaire
    login(username, password); // Appelle la fonction de connexion passée en props avec le nom d'utilisateur et le mot de passe
    console.log(login);
  };

  return (
    <div className="login-container">
      <h2>Connexion</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username">Nom d'utilisateur:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Mot de passe:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className='button-login' type="submit">Se connecter</button>
      </form>
    </div>
  );
};

export default LoginPage;
