import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import PageToolbar from '../shared/PageToolbar'
import { YEARS_CONFIG } from '../../config/appConfig'
import { workflowPlanningService } from '../../services/planningService'

import '../../css/genToken/genToken.css'

const LINK_TYPE_FILTERS = [
  { value: 'all', label: 'Tous les liens' },
  { value: 'vote', label: 'Votes' },
  { value: 'soutenance', label: 'Soutenances' }
]

const LINK_TYPE_FILTER_VALUES = new Set(LINK_TYPE_FILTERS.map((filter) => filter.value))

function formatRoleLabel(role) {
  if (role === 'expert1') {
    return 'Expert 1'
  }

  if (role === 'expert2') {
    return 'Expert 2'
  }

  if (role === 'chef_projet') {
    return 'Chef de projet'
  }

  if (role === 'expert') {
    return 'Expert'
  }

  if (role === 'candidat') {
    return 'Candidat'
  }

  return String(role || '').trim()
}

function formatWorkflowLabel(state) {
  if (state === 'planning') {
    return 'Planification'
  }

  if (state === 'voting_open') {
    return 'Votes ouverts'
  }

  if (state === 'published') {
    return 'Publication active'
  }

  return String(state || 'Inconnu')
}

function formatDateTime(value) {
  if (!value) {
    return 'Date inconnue'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Date inconnue'
  }

  return date.toLocaleString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function copyToClipboard(value) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'readonly')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

const LinkRow = ({ label, subtitle, badges = [], url, expiresAt, onCopy, onOpen }) => (
  <article className='token-access-link-row'>
    <div className='token-access-link-copy'>
      <div className='token-access-link-head'>
        <strong>{label}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>

      {badges.length > 0 ? (
        <div className='token-access-badges'>
          {badges.map((badge) => (
            <span
              key={`${badge.variant || 'default'}-${badge.label}`}
              className={`token-access-badge ${badge.variant ? `is-${badge.variant}` : ''}`.trim()}
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}

      <a href={url} target='_blank' rel='noopener noreferrer' className='token-access-link-url'>
        {url}
      </a>

      <span className='token-access-link-expiry'>
        Expire le {formatDateTime(expiresAt)}
      </span>
    </div>

    <div className='token-access-link-actions'>
      <button type='button' className='token-access-btn secondary' onClick={onCopy}>
        Copier
      </button>
      <button type='button' className='token-access-btn primary' onClick={onOpen}>
        Ouvrir
      </button>
    </div>
  </article>
)

const PersonCard = ({ entry, onCopy, onOpen }) => {
  const roleLabels = Array.isArray(entry?.person?.roles)
    ? entry.person.roles.map((role) => formatRoleLabel(role))
    : []
  const voteLinks = Array.isArray(entry?.voteLinks) ? entry.voteLinks : []
  const soutenanceLinks = Array.isArray(entry?.soutenanceLinks) ? entry.soutenanceLinks : []

  return (
    <article className='token-access-person-card'>
      <header className='token-access-person-head'>
        <div className='token-access-person-identity'>
          <strong>{entry?.person?.name || 'Personne sans nom'}</strong>
          <span>{entry?.person?.email || 'Email manquant'}</span>
        </div>

        <div className='token-access-person-meta'>
          <span className='token-access-count-chip'>
            {voteLinks.length} vote{voteLinks.length > 1 ? 's' : ''}
          </span>
          <span className='token-access-count-chip'>
            {soutenanceLinks.length} soutenance{soutenanceLinks.length > 1 ? 's' : ''}
          </span>
        </div>
      </header>

      <div className='token-access-badges'>
        {roleLabels.map((roleLabel) => (
          <span key={roleLabel} className='token-access-badge'>
            {roleLabel}
          </span>
        ))}

        {entry?.person?.site ? (
          <span className='token-access-badge is-neutral'>{entry.person.site}</span>
        ) : null}
      </div>

      <section className='token-access-link-group'>
        <div className='token-access-section-head'>
          <h3>Liens de vote</h3>
          <span>{voteLinks.length}</span>
        </div>

        {voteLinks.length > 0 ? (
          <div className='token-access-link-list'>
            {voteLinks.map((link) => (
              <LinkRow
                key={`${link.tpiId}-${link.role}-${link.url}`}
                label={link.reference || 'Vote'}
                subtitle={link.candidateName ? `Candidat: ${link.candidateName}` : ''}
                badges={[
                  { label: link.roleLabel || formatRoleLabel(link.role), variant: 'vote' },
                  link.redirectPath ? { label: link.redirectPath, variant: 'neutral' } : null
                ].filter(Boolean)}
                url={link.url}
                expiresAt={link.expiresAt}
                onCopy={() => onCopy(link.url)}
                onOpen={() => onOpen(link.url)}
              />
            ))}
          </div>
        ) : (
          <p className='token-access-empty-inline'>
            Aucun lien de vote actif pour cette personne.
          </p>
        )}
      </section>

      <section className='token-access-link-group'>
        <div className='token-access-section-head'>
          <h3>Liens de consultation des soutenances</h3>
          <span>{soutenanceLinks.length}</span>
        </div>

        {soutenanceLinks.length > 0 ? (
          <div className='token-access-link-list'>
            {soutenanceLinks.map((link) => (
              <LinkRow
                key={`${entry?.person?.id}-publication-${link.publicationVersion || 0}`}
                label={`Publication ${link.publicationVersion || 'active'}`}
                subtitle='Vue filtrée sur les soutenances publiées'
                badges={[
                  { label: 'Soutenance', variant: 'soutenance' },
                  link.redirectPath ? { label: link.redirectPath, variant: 'neutral' } : null
                ].filter(Boolean)}
                url={link.url}
                expiresAt={link.expiresAt}
                onCopy={() => onCopy(link.url)}
                onOpen={() => onOpen(link.url)}
              />
            ))}
          </div>
        ) : (
          <p className='token-access-empty-inline'>
            Aucun lien de soutenance disponible pour cette personne.
          </p>
        )}
      </section>
    </article>
  )
}

const TokenGenerator = ({ toggleArrow, isArrowUp }) => {
  const location = useLocation()
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const requestedYear = Number.parseInt(queryParams.get('year') || '', 10)
  const requestedLinkType = queryParams.get('type')
  const shouldAutoGenerate = queryParams.get('auto') === '1'
  const autoGeneratedRef = useRef(false)
  const [selectedYear, setSelectedYear] = useState(() => (
    YEARS_CONFIG.isSupportedYear(requestedYear)
      ? requestedYear
      : YEARS_CONFIG.getCurrentYear()
  ))
  const [searchQuery, setSearchQuery] = useState('')
  const [linkTypeFilter, setLinkTypeFilter] = useState(() => (
    LINK_TYPE_FILTER_VALUES.has(requestedLinkType)
      ? requestedLinkType
      : 'all'
  ))
  const [previewPayload, setPreviewPayload] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const availableYears = useMemo(
    () => YEARS_CONFIG.getAvailableYears().slice().reverse(),
    []
  )

  useEffect(() => {
    if (YEARS_CONFIG.isSupportedYear(requestedYear)) {
      setSelectedYear(requestedYear)
    }
  }, [requestedYear])

  useEffect(() => {
    if (LINK_TYPE_FILTER_VALUES.has(requestedLinkType)) {
      setLinkTypeFilter(requestedLinkType)
    }
  }, [requestedLinkType])

  useEffect(() => {
    autoGeneratedRef.current = false
  }, [requestedYear, requestedLinkType, shouldAutoGenerate])

  const filteredPeople = useMemo(() => {
    const people = Array.isArray(previewPayload?.people) ? previewPayload.people : []
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return people.filter((entry) => {
      const hasVoteLinks = Array.isArray(entry?.voteLinks) && entry.voteLinks.length > 0
      const hasSoutenanceLinks = Array.isArray(entry?.soutenanceLinks) && entry.soutenanceLinks.length > 0

      if (linkTypeFilter === 'vote' && !hasVoteLinks) {
        return false
      }

      if (linkTypeFilter === 'soutenance' && !hasSoutenanceLinks) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const searchCorpus = [
        entry?.person?.name,
        entry?.person?.email,
        ...(entry?.person?.roles || []),
        ...(entry?.voteLinks || []).flatMap((link) => [
          link.reference,
          link.candidateName,
          link.roleLabel,
          link.subject
        ]),
        ...(entry?.soutenanceLinks || []).map((link) =>
          link.publicationVersion ? `publication ${link.publicationVersion}` : 'publication active'
        )
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchCorpus.includes(normalizedQuery)
    })
  }, [linkTypeFilter, previewPayload?.people, searchQuery])

  const handleGeneratePreview = useCallback(async () => {
    setIsGenerating(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const preview = await workflowPlanningService.previewAccessLinks(
        selectedYear,
        window.location.origin
      )

      setPreviewPayload(preview)
      setSuccessMessage(
        `${preview?.summary?.peopleCount || 0} personne(s) préparée(s), ${preview?.summary?.voteLinkCount || 0} lien(s) vote, ${preview?.summary?.soutenanceLinkCount || 0} lien(s) soutenance.`
      )
    } catch (error) {
      setPreviewPayload(null)
      setErrorMessage(
        error?.data?.error || error?.message || 'Impossible de générer les liens d’accès.'
      )
    } finally {
      setIsGenerating(false)
    }
  }, [selectedYear])

  useEffect(() => {
    if (!shouldAutoGenerate || autoGeneratedRef.current) {
      return
    }

    if (YEARS_CONFIG.isSupportedYear(requestedYear) && selectedYear !== requestedYear) {
      return
    }

    autoGeneratedRef.current = true
    handleGeneratePreview()
  }, [handleGeneratePreview, requestedYear, selectedYear, shouldAutoGenerate])

  const handleCopy = async (url) => {
    try {
      await copyToClipboard(url)
      setSuccessMessage('Lien copié dans le presse-papiers.')
      setErrorMessage('')
    } catch (error) {
      setErrorMessage('Impossible de copier ce lien.')
    }
  }

  const handleOpen = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const previewSummary = previewPayload?.summary || null
  const previewContexts = previewPayload?.contexts || {}
  const workflowLabel = formatWorkflowLabel(previewPayload?.workflowState)
  const publicationVersion = previewContexts?.soutenance?.publicationVersion

  return (
    <div className='token-generator-page page-with-toolbar'>
      <PageToolbar
        id='tools'
        className='token-generator-tools'
        eyebrow='Accès'
        title='Aperçu des magic links'
        description='Générez les vrais liens `vote` et `soutenance` par personne pour une année donnée.'
        meta={
          <div className='token-access-toolbar-meta'>
            <span className='page-tools-chip'>{workflowLabel}</span>
            <span className='page-tools-chip'>
              Publication {publicationVersion ? `v${publicationVersion}` : 'absente'}
            </span>
          </div>
        }
        toggleArrow={toggleArrow}
        isArrowUp={isArrowUp}
        ariaLabel='Outils des liens d accès'
      >
        <div className='page-tools-grid token-access-toolbar-grid'>
          <label className='page-tools-field' htmlFor='year'>
            <span className='page-tools-field-label'>Année</span>
            <select
              id='year'
              className='page-tools-field-control'
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number.parseInt(event.target.value, 10))}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className='page-tools-field' htmlFor='access-search'>
            <span className='page-tools-field-label'>Recherche</span>
            <input
              id='access-search'
              type='search'
              className='page-tools-field-control'
              placeholder='Nom, email, référence, candidat...'
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>

          <label className='page-tools-field' htmlFor='link-type-filter'>
            <span className='page-tools-field-label'>Type</span>
            <select
              id='link-type-filter'
              className='page-tools-field-control'
              value={linkTypeFilter}
              onChange={(event) => setLinkTypeFilter(event.target.value)}
            >
              {LINK_TYPE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className='page-tools-field page-tools-field-action'>
            <button
              type='button'
              className='page-tools-action-btn primary'
              onClick={handleGeneratePreview}
              disabled={isGenerating}
            >
              {isGenerating ? 'Génération...' : 'Générer les liens'}
            </button>
          </div>
        </div>

        <div className='token-access-toolbar-note'>
          Chaque génération crée de nouveaux magic links. Pour vérifier le rendu réel d’un lien externe,
          ouvrez-le dans une fenêtre privée ou sans session admin.
        </div>
      </PageToolbar>

      <section className='token-generator-results'>
        <div className='token-generator-results-shell'>
          {errorMessage ? (
            <div className='token-generator-alert' role='alert'>
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className='token-generator-success' role='status'>
              {successMessage}
            </div>
          ) : null}

          {previewSummary ? (
            <div className='token-access-summary-grid'>
              <article className='token-access-summary-card'>
                <span>Personnes</span>
                <strong>{previewSummary.peopleCount || 0}</strong>
              </article>

              <article className='token-access-summary-card'>
                <span>Liens vote</span>
                <strong>{previewSummary.voteLinkCount || 0}</strong>
              </article>

              <article className='token-access-summary-card'>
                <span>Liens soutenance</span>
                <strong>{previewSummary.soutenanceLinkCount || 0}</strong>
              </article>

              <article className='token-access-summary-card'>
                <span>Votes en attente</span>
                <strong>{previewContexts?.vote?.tpiCount || 0} TPI</strong>
              </article>
            </div>
          ) : null}

          {!previewSummary ? (
            <div className='token-generator-empty-state'>
              <h3>Aucun aperçu généré</h3>
              <p>
                Choisissez une année puis lancez la génération pour obtenir les liens réellement
                utilisables par les personnes externes.
              </p>
            </div>
          ) : filteredPeople.length === 0 ? (
            <div className='token-generator-empty-state'>
              <h3>Aucun résultat</h3>
              <p>
                Aucun lien ne correspond au filtre actuel.
              </p>
            </div>
          ) : (
            <div className='token-access-person-list'>
              {filteredPeople.map((entry) => (
                <PersonCard
                  key={entry?.person?.id || entry?.person?.email}
                  entry={entry}
                  onCopy={handleCopy}
                  onOpen={handleOpen}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default TokenGenerator
