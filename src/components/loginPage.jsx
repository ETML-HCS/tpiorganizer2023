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
    <main className='login-page' aria-labelledby='login-title'>
      <section className='login-card'>
        <header className='card-header'>
          <h1 id='login-title'>Connexion</h1>
          <p className='hint'>Entrez vos identifiants pour continuer.</p>
        </header>

        <form className='login-form' onSubmit={handleSubmit}>
          <div className='form-group'>
            <label htmlFor='username'>Identifiant</label>
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

          <div className='form-group'>
            <div className='password-label-row'>
              <label htmlFor='password'>Mot de passe</label>
              <button
                type='button'
                className='toggle-visibility'
                onClick={() => setShowPassword(prev => !prev)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              id='password'
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder='Mot de passe'
              autoComplete='current-password'
              required
            />
          </div>

          {error ? <div className='error-message'>{error}</div> : null}

          <button className='button-login' type='submit' disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default LoginPage
