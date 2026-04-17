import React, { useState } from 'react'

import '../css/loginPage.css'

const LoginPage = ({ login }) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async event => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const maybePromise = login?.(username, password)
      if (maybePromise && typeof maybePromise.then === 'function') {
        await maybePromise
      }
    } catch (err) {
      setError(err?.message || 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='login-page'>
      <div className='login-hero'>
        <p className='badge'>Portail TPI</p>
        <h1>Connexion sécurisée</h1>
        <p className='subtitle'>Accédez au suivi des soutenances, votes experts et réservations de salles.</p>
      </div>

      <div className='login-card'>
        <div className='card-header'>
          <div className='brand'>TPI Organizer</div>
          <div className='hint'>Identifiez-vous pour continuer</div>
        </div>

        <form className='login-form' onSubmit={handleSubmit}>
          <div className='form-group'>
            <label htmlFor='username'>Nom d'utilisateur</label>
            <div className='input-wrapper'>
              <span className='input-icon'>👤</span>
              <input
                type='text'
                id='username'
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder='prenom.nom@domaine.ch'
                autoComplete='username'
                required
              />
            </div>
          </div>

          <div className='form-group'>
            <label htmlFor='password'>Mot de passe</label>
            <div className='input-wrapper'>
              <span className='input-icon'>🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                id='password'
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder='••••••••'
                autoComplete='current-password'
                required
              />
              <button
                type='button'
                className='toggle-visibility'
                onClick={() => setShowPassword(prev => !prev)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && <div className='error-message'>⚠️ {error}</div>}

          <button className='button-login' type='submit' disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>

          <p className='helper-text'>
            Besoin d'aide ? Contactez l'administration ou utilisez le lien magique reçu par email.
          </p>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
