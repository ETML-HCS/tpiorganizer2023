import React, { useState, useEffect } from 'react'
import CryptoJS from 'crypto-js'
import PageToolbar from '../shared/PageToolbar'
import apiService from '../../services/apiService'

import '../../css/genToken/genToken.css'

const TokenGenerator = ({ toggleArrow, isArrowUp }) => {
  const [secretKey, setSecretKey] = useState('')
  const [experts, setExperts] = useState([])
  const [generatedUrls, setGeneratedUrls] = useState([])
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())
  const [isLoadingExperts, setIsLoadingExperts] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const canGenerate = secretKey.trim().length > 0 && Array.isArray(experts) && experts.length > 0
  const hasGeneratedUrls = generatedUrls.length > 0

  useEffect(() => {
    let isCancelled = false

    const loadExperts = async () => {
      setIsLoadingExperts(true)
      setErrorMessage('')

      try {
        const response = await apiService.get('/api/experts/emails')

        if (!isCancelled) {
          setExperts(Array.isArray(response) ? response : [])
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error)
        if (!isCancelled) {
          setExperts([])
          setErrorMessage(
            error?.message || 'Impossible de charger la liste des experts.'
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingExperts(false)
        }
      }
    }

    loadExperts()

    return () => {
      isCancelled = true
    }
  }, [])

  const handleGenerateTokens = async () => {
    if (!canGenerate) {
      return
    }

    setIsGenerating(true)
    setErrorMessage('')
    setGeneratedUrls([])

    const urls = []
    const update = []
    const soutenanceBaseUrl = `${window.location.origin}/Soutenances/${selectedYear}`

    for (const { email, name } of experts) {
      const token = CryptoJS.SHA256(email + secretKey).toString()
      const url = `${soutenanceBaseUrl}?token=${token}`

      update.push({ token, email, name })
      urls.push({ email, name, url })
    }

    try {
      await apiService.put('/api/experts/putTokens', update)
      setGeneratedUrls(urls)
    } catch (error) {
      console.error(
        'Erreur lors de la sauvegarde des tokens:',
        error
      )
      setErrorMessage(
        error?.message || 'Impossible de sauvegarder les tokens en base.'
      )
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className='token-generator-page page-with-toolbar'>
      <PageToolbar
        id='tools'
        className='token-generator-tools'
        eyebrow='Tokens'
        title='Générateur de tokens'
        meta={
          <span className='page-tools-chip'>
            {isLoadingExperts
              ? 'Chargement...'
              : Array.isArray(experts)
                ? `${experts.length} expert(s)`
                : experts
                  ? '1 expert'
                  : '0 expert'}
          </span>
        }
        toggleArrow={toggleArrow}
        isArrowUp={isArrowUp}
        ariaLabel='Outils du générateur de tokens'
      >
        <div className='page-tools-grid'>
          <label className='page-tools-field' htmlFor='year'>
            <span className='page-tools-field-label'>Année</span>
            <select
              id='year'
              className='page-tools-field-control'
              value={selectedYear}
              onChange={e => setSelectedYear(Number.parseInt(e.target.value, 10))}
            >
              {[2022, 2023, 2024, 2025, 2026, 2027].map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className='page-tools-field' htmlFor='secretKey'>
            <span className='page-tools-field-label'>Clé secrète</span>
            <input
              id='secretKey'
              type='password'
              className='page-tools-field-control'
              placeholder='Saisir la clé secrète'
              value={secretKey}
              onChange={e => setSecretKey(e.target.value)}
            />
          </label>

          <div className='page-tools-field page-tools-field-action'>
            <button
              type='button'
              className='page-tools-action-btn primary'
              onClick={handleGenerateTokens}
              disabled={!canGenerate || isGenerating || isLoadingExperts}
            >
              {isGenerating ? 'Génération...' : 'Générer les tokens'}
            </button>
          </div>
        </div>

      </PageToolbar>

      <section className='token-generator-results'>
        <div className='token-generator-results-shell'>
          {errorMessage ? (
            <div className='token-generator-alert' role='alert'>
              {errorMessage}
            </div>
          ) : null}

          <div className='token-generator-results-head'>
            <div>
              <span className='token-generator-results-kicker'>
                Diffusion experts
              </span>
              <h2>Liens d&apos;accès générés</h2>
              <p>
                Chaque URL pointe vers le calendrier des soutenances de {selectedYear}.
              </p>
            </div>

            <span className='token-generator-results-count'>
              {generatedUrls.length} lien{generatedUrls.length > 1 ? 's' : ''}
            </span>
          </div>

          {hasGeneratedUrls ? (
            <ul className='list-group'>
              {generatedUrls.map(({ email, name, url }, index) => (
                <li key={index} className='list-group-item'>
                  <div className='token-link-meta'>
                    <span className='token-link-name'>{name || 'Expert sans nom'}</span>
                    <span className='token-link-email'>{email}</span>
                  </div>

                  <div className='token-link-route'>
                    <span className='token-link-year'>{selectedYear}</span>
                    <a href={url} target='_blank' rel='noopener noreferrer'>
                      {url}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className='token-generator-empty-state'>
              <h3>Aucun lien généré</h3>
              <p>
                Renseignez une clé secrète puis lancez la génération pour préparer
                les accès experts.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default TokenGenerator
