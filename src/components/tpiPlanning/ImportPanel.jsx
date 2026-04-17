import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { API_URL } from '../../config/appConfig'
import './ImportPanel.css'

const API_BASE = API_URL

/**
 * Génère les jours ouvrés entre deux dates (sans week-end)
 */
const generateWorkDays = (start, end) => {
  const days = []
  const current = new Date(start)
  const endDate = new Date(end)
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Pas dimanche ni samedi
      days.push(current.toISOString().split('T')[0])
    }
    current.setDate(current.getDate() + 1)
  }
  return days
}

/**
 * Panel d'import CSV pour la planification
 */
const ImportPanel = ({ year, onImportComplete }) => {
  // États pour CSV
  const [csvFile, setCsvFile] = useState(null)
  const [csvValidation, setCsvValidation] = useState(null)
  const [csvResults, setCsvResults] = useState(null)
  const [csvLoading, setCsvLoading] = useState(false)
  const [debugInfo, setDebugInfo] = useState(null)
  
  // Période de soutenance
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [site, setSite] = useState('Vennes')

  // Les dates sont connues dès qu'un CSV valide est détecté
  const datesLocked = useMemo(() => Boolean(csvValidation?.valid), [csvValidation])
  
  // Dates spécifiques des soutenances (sélection manuelle)
  const [selectedDates, setSelectedDates] = useState([])
  const [useSpecificDates, setUseSpecificDates] = useState(false)
  
  // Erreurs
  const [error, setError] = useState(null)
  
  // Refs pour les inputs
  const csvInputRef = useRef(null)

  /**
   * Jours ouvrés dans la période sélectionnée
   */
  const availableWorkDays = useMemo(() => {
    if (!startDate || !endDate) return []
    return generateWorkDays(startDate, endDate)
  }, [startDate, endDate])

  /**
   * Toggle une date dans la sélection
   */
  const toggleDate = useCallback((date) => {
    setSelectedDates(prev => {
      if (prev.includes(date)) {
        return prev.filter(d => d !== date)
      }
      return [...prev, date].sort()
    })
  }, [])

  /**
   * Sélectionner/Désélectionner toutes les dates
   */
  const toggleAllDates = useCallback(() => {
    if (selectedDates.length === availableWorkDays.length) {
      setSelectedDates([])
    } else {
      setSelectedDates([...availableWorkDays])
    }
  }, [selectedDates, availableWorkDays])

  /**
   * Gestion de la sélection du fichier CSV
   */
  const handleCsvSelect = useCallback(async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setCsvFile(file)
    setCsvResults(null)
    setCsvValidation(null)
    setError(null)
    setDebugInfo({ phase: 'validate:start', file: file.name, api: `${API_BASE}/api/import/csv/validate` })
    
    // Valider automatiquement
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(`${API_BASE}/api/import/csv/validate`, {
        method: 'POST',
        body: formData
      })
      
      setDebugInfo(prev => ({ ...prev, phase: 'validate:response', status: response.status }))

      const validation = await response.json()
      setDebugInfo(prev => ({ ...prev, phase: 'validate:done', rowCount: validation.rowCount || 0 }))
      setCsvValidation(validation)
      
    } catch (err) {
      setError('Erreur lors de la validation du fichier')
      setDebugInfo(prev => ({ ...prev, phase: 'validate:error', error: err.message, errorType: err.name }))
    }
  }, [])

  /**
   * Import du fichier CSV
   */
  const handleCsvImport = useCallback(async () => {
    if (!csvFile) {
      setError('Veuillez sélectionner un fichier CSV')
      return
    }
    
    if (csvValidation && !csvValidation.valid) {
      setError('Le fichier CSV contient des erreurs')
      return
    }
    
    setCsvLoading(true)
    setError(null)
    setDebugInfo({ phase: 'import:start', file: csvFile.name, api: `${API_BASE}/api/import/csv/tpi`, year, site })
    
    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      formData.append('year', year.toString())
      formData.append('site', site)
      
      const response = await fetch(`${API_BASE}/api/import/csv/tpi`, {
        method: 'POST',
        body: formData
      })
      
      setDebugInfo(prev => ({ ...prev, phase: 'import:response', status: response.status }))

      if (!response.ok) {
        const err = await response.json()
        setDebugInfo(prev => ({ ...prev, phase: 'import:error', error: err.error || 'unknown' }))
        throw new Error(err.error || 'Erreur lors de l\'import')
      }
      
      const results = await response.json()
      setCsvResults(results)
      setDebugInfo(prev => ({ ...prev, phase: 'import:done', created: results.created, updated: results.updated, skipped: results.skipped }))
      
      if (onImportComplete) {
        onImportComplete('csv', results)
      }
      
    } catch (err) {
      setError(err.message)
      setDebugInfo(prev => ({ ...prev, phase: 'import:catch', error: err.message }))
    } finally {
      setCsvLoading(false)
    }
  }, [csvFile, csvValidation, year, site, onImportComplete])

  /**
   * Reset des formulaires
   */
  const resetCsv = useCallback(() => {
    setCsvFile(null)
    setCsvValidation(null)
    setCsvResults(null)
    if (csvInputRef.current) csvInputRef.current.value = ''
  }, [])

  // Préremplir les dates de soutenance avec l'année de la route si vides
  useEffect(() => {
    const yearStr = year.toString()
    if (!startDate) setStartDate(`${yearStr}-01-01`)
    if (!endDate) setEndDate(`${yearStr}-12-31`)
  }, [year, startDate, endDate])

  return (
    <div className="import-panel">
      <div className="panel-header">
        <h2>📥 Import des données</h2>
        <p>Importez la liste des TPI au format CSV. Les parties prenantes se gèrent dans le module dédié.</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Configuration période */}
      <div className="config-section">
        <h3>⚙️ Configuration</h3>
        {debugInfo && (
          <div className="debug-box">
            <strong>Debug CSV</strong>
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        )}
        {datesLocked && (
          <p className="hint">
            Les dates sont verrouillées car elles sont déjà présentes dans le CSV validé.
          </p>
        )}
        <div className="config-grid">
          <div className="form-group">
            <label>Année cible</label>
            <input type="text" value={year} readOnly />
          </div>
          <div className="form-group">
            <label>Date début soutenances</label>
            <input
              type="date"
              value={startDate}
              min={`${year}-01-01`}
              max={`${year}-12-31`}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={datesLocked}
              title={datesLocked ? 'Dates déjà présentes dans le CSV' : undefined}
            />
          </div>
          <div className="form-group">
            <label>Date fin soutenances</label>
            <input
              type="date"
              value={endDate}
              min={`${year}-01-01`}
              max={`${year}-12-31`}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={datesLocked}
              title={datesLocked ? 'Dates déjà présentes dans le CSV' : undefined}
            />
          </div>
          <div className="form-group">
            <label>Site</label>
            <select value={site} onChange={(e) => setSite(e.target.value)}>
              <option value="Vennes">Vennes</option>
              <option value="Sébeillon">Sébeillon</option>
              <option value="Autre">Autre</option>
            </select>
          </div>
        </div>
        
        {/* Sélection des dates spécifiques de soutenances */}
        {availableWorkDays.length > 0 && (
          <div className="dates-selection">
            <div className="dates-header">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={useSpecificDates}
                  onChange={(e) => setUseSpecificDates(e.target.checked)}
                />
                <span>Sélectionner les jours spécifiques des soutenances</span>
              </label>
              {useSpecificDates && (
                <button 
                  type="button" 
                  className="btn-link"
                  onClick={toggleAllDates}
                >
                  {selectedDates.length === availableWorkDays.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              )}
            </div>
            
            {useSpecificDates && (
              <div className="dates-grid">
                {availableWorkDays.map(date => {
                  const d = new Date(date)
                  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
                  const dayName = dayNames[d.getDay()]
                  const formattedDate = d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' })
                  
                  return (
                    <label 
                      key={date} 
                      className={`date-chip ${selectedDates.includes(date) ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDates.includes(date)}
                        onChange={() => toggleDate(date)}
                      />
                      <span className="day-name">{dayName}</span>
                      <span className="date-value">{formattedDate}</span>
                    </label>
                  )
                })}
              </div>
            )}
            
            {useSpecificDates && selectedDates.length > 0 && (
              <p className="dates-summary">
                📅 {selectedDates.length} jour{selectedDates.length > 1 ? 's' : ''} de soutenance sélectionné{selectedDates.length > 1 ? 's' : ''}
              </p>
            )}
            
            {!useSpecificDates && (
              <p className="dates-summary">
                📅 Tous les jours ouvrés ({availableWorkDays.length} jours) seront analysés
              </p>
            )}
          </div>
        )}
      </div>

      <div className="import-sections">
        <div className="import-section csv-section">
          <h3>📋 Liste des TPI (CSV)</h3>
          <p className="section-description">
            Importez un fichier CSV avec les colonnes : Candidat, Expert1, Expert2, 
            ChefProjet (optionnel), Titre, Sujet, Entreprise
          </p>
          
          <div className="file-input-wrapper">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleCsvSelect}
              id="csv-input"
            />
            <label htmlFor="csv-input" className="file-input-label">
              📁 Sélectionner le fichier CSV
            </label>
          </div>

          {csvValidation && (
            <div className={`validation-result ${csvValidation.valid ? 'valid' : 'invalid'}`}>
              {csvValidation.valid ? (
                <>
                  <h4>✅ Fichier valide</h4>
                  <div className="validation-stats">
                    <span>📊 {csvValidation.rowCount} TPI détectés</span>
                    <span>📏 Délimiteur: "{csvValidation.delimiter}"</span>
                  </div>
                  
                  <h5>Colonnes mappées :</h5>
                  <ul className="mapped-columns">
                    {csvValidation.mappedColumns?.map((col, idx) => (
                      <li key={idx}>
                        <span className="original">{col.original}</span>
                        <span className="arrow">→</span>
                        <span className="mapped">{col.mappedTo}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {csvValidation.preview && (
                    <details className="preview-details">
                      <summary>Aperçu des données</summary>
                      <table className="preview-table">
                        <thead>
                          <tr>
                            <th>Candidat</th>
                            <th>Expert 1</th>
                            <th>Expert 2</th>
                            <th>Titre</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvValidation.preview.map((row, idx) => (
                            <tr key={idx}>
                              <td>{row.candidat}</td>
                              <td>{row.expert1}</td>
                              <td>{row.expert2}</td>
                              <td>{row.titre?.substring(0, 30)}...</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                  
                  <div className="section-actions">
                    <button className="btn-secondary" onClick={resetCsv}>
                      Annuler
                    </button>
                    <button 
                      className="btn-primary" 
                      onClick={handleCsvImport}
                      disabled={csvLoading}
                    >
                      {csvLoading ? '⏳ Import en cours...' : `📥 Importer ${csvValidation.rowCount} TPI`}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h4>❌ Fichier invalide</h4>
                  <p className="error-msg">{csvValidation.error}</p>
                  <button className="btn-secondary" onClick={resetCsv}>
                    Réessayer
                  </button>
                </>
              )}
            </div>
          )}

          {csvResults && (
            <div className="import-results">
              <h4>✅ Import terminé</h4>
              <div className="results-stats">
                <span className="stat success">✓ {csvResults.created} créés</span>
                <span className="stat info">↻ {csvResults.updated} mis à jour</span>
                <span className="stat error">✗ {csvResults.skipped} ignorés</span>
              </div>
              
              {csvResults.errors?.length > 0 && (
                <details className="results-details">
                  <summary>Voir les erreurs ({csvResults.errors.length})</summary>
                  <ul>
                    {csvResults.errors.map((err, idx) => (
                      <li key={idx} className="result-item error">
                        <span>Ligne {err.line}</span>
                        <span className="error-msg">{err.error}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImportPanel
