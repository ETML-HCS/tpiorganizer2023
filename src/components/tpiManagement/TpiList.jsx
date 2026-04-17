import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import TpiForm from './TpiForm.jsx'
import { getPlanningClassDisplayInfo } from '../tpiPlanning/planningClassUtils.js'
import {
  buildTpiTagProfile,
  formatDisplayDate,
  getCategoryChipClass,
  getCategoryLabelFromKey,
  getMissingStakeholders,
  getStakeholderIssues,
  getTpiLocationLabel,
  getTpiTimelineLabel,
  matchesSearch
} from './tpiManagementUtils.js'

const DISPLAY_FIELDS = [
  { key: 'showTagsPreview', label: 'Tags' },
  { key: 'showLocation', label: 'Lieu' },
  { key: 'showDates', label: 'Dates' },
  { key: 'showExperts', label: 'Experts' },
  { key: 'showEvaluation', label: 'Note' }
]

const DEFAULT_DISPLAY_OPTIONS = {
  showTagsPreview: true,
  showLocation: true,
  showDates: true,
  showExperts: true,
  showEvaluation: false
}

const CARD_LAYOUT_OPTIONS = [3, 4, 5]
const CARD_GRID_GAP = 16
const MIN_CARD_WIDTH = 260

const getExpertsLabel = (tpi) => {
  const expert1 = tpi?.experts?.['1']
  const expert2 = tpi?.experts?.['2']

  return [expert1, expert2].filter(Boolean).join(' / ') || 'Experts non assignés'
}

const getEvaluationLabel = (tpi) => {
  if (typeof tpi?.evaluation?.note === 'number') {
    return `${tpi.evaluation.note}/6`
  }

  return 'Pas encore évalué'
}

const formatTagCountLabel = (count) => `${count} tag${count > 1 ? 's' : ''}`

const readStakeholderFieldValue = (tpi, fieldName) => {
  if (!tpi || !fieldName) {
    return ''
  }

  if (Array.isArray(fieldName)) {
    return fieldName.reduce((current, key) => current?.[key], tpi) || ''
  }

  return tpi?.[fieldName] || ''
}

const buildStakeholderDetailsLink = (tpi, field) => {
  const personId = String(tpi?.[field.idName] || '').trim()
  const personName = String(readStakeholderFieldValue(tpi, field.name) || '').trim()
  const params = new URLSearchParams()

  if (personId) {
    params.set('personId', personId)
  }

  if (personName) {
    params.set('name', personName)
  }

  params.set('role', field.role)

  return `/partiesPrenantes?${params.toString()}`
}

const StakeholderLink = ({ tpi, field, children }) => {
  const personName = String(readStakeholderFieldValue(tpi, field.name) || '').trim()
  const personId = String(tpi?.[field.idName] || '').trim()

  if (!personName) {
    return <span>{children}</span>
  }

  return (
    <Link
      to={buildStakeholderDetailsLink(tpi, field)}
      className='tpi-stakeholder-link'
      title={personId ? 'Ouvrir la fiche de la personne' : 'Ouvrir la recherche de la personne dans Parties prenantes'}
    >
      {children}
    </Link>
  )
}

const getEffectiveCardColumns = (containerWidth, preferredColumns) => {
  if (!containerWidth) {
    return preferredColumns
  }

  const availableColumns = Math.max(
    1,
    Math.floor((containerWidth + CARD_GRID_GAP) / (MIN_CARD_WIDTH + CARD_GRID_GAP))
  )

  return Math.max(1, Math.min(preferredColumns, availableColumns))
}

const TpiList = ({
  tpiList,
  onSave,
  year,
  searchTerm = '',
  onSearchTermChange = () => {},
  planningCatalogSites = [],
  planningClassTypes = []
}) => {
  const [editingTpiId, setEditingTpiId] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stakeholderFilter, setStakeholderFilter] = useState(() =>
    tpiList.some((tpi) => getMissingStakeholders(tpi).length > 0) ? 'missing' : 'all'
  )
  const [displayMode, setDisplayMode] = useState('cards')
  const [cardColumns, setCardColumns] = useState(4)
  const [expandedTpiId, setExpandedTpiId] = useState(null)
  const [cardGridWidth, setCardGridWidth] = useState(0)
  const [displayOptions, setDisplayOptions] = useState(DEFAULT_DISPLAY_OPTIONS)
  const cardGridRef = useRef(null)

  const profiles = useMemo(
    () =>
      tpiList.map((tpi) => ({
        tpi,
        profile: buildTpiTagProfile(tpi),
        stakeholderIssues: getStakeholderIssues(tpi),
        missingStakeholders: getMissingStakeholders(tpi),
        classResolution: getPlanningClassDisplayInfo(
          tpi.classe,
          planningClassTypes,
          planningCatalogSites,
          tpi.site || tpi.lieu?.site
        )
      })),
    [planningCatalogSites, planningClassTypes, tpiList]
  )

  const categoryOptions = useMemo(() => {
    const counts = new Map()

    profiles.forEach(({ profile }) => {
      const keys = profile.categoryKeys.length > 0
        ? profile.categoryKeys
        : [profile.primaryCategoryKey]

      keys.forEach((key) => {
        const current = counts.get(key) || {
          key,
          label: getCategoryLabelFromKey(key),
          count: 0
        }

        current.count += 1
        counts.set(key, current)
      })
    })

    return [
      { key: 'all', label: 'Tous', count: profiles.length },
      ...Array.from(counts.values()).sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count
        }

        return left.label.localeCompare(right.label, 'fr')
      })
    ]
  }, [profiles])

  const filteredProfiles = useMemo(
    () =>
      profiles.filter(({ tpi, profile, stakeholderIssues, missingStakeholders }) => {
        const matchesCategory =
          categoryFilter === 'all' || profile.categoryKeys.includes(categoryFilter)
        const matchesStakeholder = stakeholderFilter === 'all' ||
          (stakeholderFilter === 'missing' && missingStakeholders.length > 0) ||
          (stakeholderFilter === 'issues' && stakeholderIssues.hasIssues)

        return matchesCategory && matchesStakeholder && matchesSearch(tpi, searchTerm, profile)
      }),
    [categoryFilter, profiles, searchTerm, stakeholderFilter]
  )

  const summaryStats = useMemo(() => {
    const uniqueAxes = new Set()
    const uniqueTags = new Set()

    profiles.forEach(({ profile }) => {
      profile.categoryKeys.forEach((key) => uniqueAxes.add(key))
      profile.rawTags.forEach((tag) => uniqueTags.add(tag))
    })

    return {
      axes: uniqueAxes.size,
      tags: uniqueTags.size
    }
  }, [profiles])

  const missingStakeholderCount = useMemo(
    () => profiles.filter(({ missingStakeholders }) => missingStakeholders.length > 0).length,
    [profiles]
  )
  const stakeholderIssueCount = useMemo(
    () => profiles.filter(({ stakeholderIssues }) => stakeholderIssues.hasIssues).length,
    [profiles]
  )

  const hasMissingStakeholderFilter = missingStakeholderCount > 0
  const hasStakeholderIssueFilter = stakeholderIssueCount > 0
  const hasActiveFilters =
    categoryFilter !== 'all' || stakeholderFilter !== 'all' || Boolean(searchTerm)

  const effectiveCardColumns = useMemo(
    () => getEffectiveCardColumns(cardGridWidth, cardColumns),
    [cardColumns, cardGridWidth]
  )

  const stakeholderFields = {
    candidat: { name: 'candidat', idName: 'candidatPersonId', role: 'candidat' },
    expert1: { name: ['experts', '1'], idName: 'expert1PersonId', role: 'expert' },
    expert2: { name: ['experts', '2'], idName: 'expert2PersonId', role: 'expert' },
    boss: { name: 'boss', idName: 'bossPersonId', role: 'chef_projet' }
  }

  useEffect(() => {
    setStakeholderFilter(hasMissingStakeholderFilter ? 'missing' : 'all')
  }, [hasMissingStakeholderFilter, year])

  useEffect(() => {
    if (displayMode !== 'cards') {
      return undefined
    }

    const node = cardGridRef.current
    if (!node) {
      return undefined
    }

    const updateWidth = (nextWidth) => {
      setCardGridWidth((currentWidth) => {
        if (Math.abs(currentWidth - nextWidth) < 1) {
          return currentWidth
        }

        return nextWidth
      })
    }

    const measure = () => {
      updateWidth(node.getBoundingClientRect().width)
    }

    measure()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0]

        if (entry?.contentRect?.width) {
          updateWidth(entry.contentRect.width)
        }
      })

      observer.observe(node)

      return () => observer.disconnect()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure)

      return () => window.removeEventListener('resize', measure)
    }

    return undefined
  }, [displayMode, filteredProfiles.length])

  const handleEdit = (tpiRef) => {
    setEditingTpiId(tpiRef)
    setExpandedTpiId(tpiRef)
  }

  const handleFormClose = () => {
    setEditingTpiId(null)
  }

  const toggleExpandedCard = (tpiRef) => {
    setExpandedTpiId((current) => (current === tpiRef ? null : tpiRef))
  }

  const clearFilters = () => {
    setCategoryFilter('all')
    setStakeholderFilter('all')
    onSearchTermChange('')
  }

  const toggleDisplayOption = (key) => {
    setDisplayOptions((current) => ({
      ...current,
      [key]: !current[key]
    }))
  }

  const getCardBadge = (profile) => {
    if (profile.totalTags === 0) {
      return 'Pas de tag saisi'
    }

    if (!displayOptions.showTagsPreview) {
      return formatTagCountLabel(profile.totalTags)
    }

    return profile.previewTags.length > 0
      ? formatTagCountLabel(profile.previewTags.length)
      : formatTagCountLabel(profile.totalTags)
  }
  return (
    <div className='tpi-list-shell'>
      <div className='tpi-toolbar-row'>
        <div className='tpi-display-options' aria-label='Affichage'>
          <div className='tpi-display-controls-top'>
            <span>Affichage</span>

            <div className='tpi-display-toggle' role='tablist' aria-label='Mode affichage'>
              <button
                type='button'
                className={displayMode === 'cards' ? 'active' : ''}
                onClick={() => setDisplayMode('cards')}
              >
                Cartes
              </button>
              <button
                type='button'
                className={displayMode === 'table' ? 'active' : ''}
                onClick={() => setDisplayMode('table')}
              >
                Tableau
              </button>
            </div>

            {displayMode === 'cards' && (
              <div className='tpi-density-toggle' aria-label='Cartes par ligne'>
                {CARD_LAYOUT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type='button'
                    className={cardColumns === option ? 'active' : ''}
                    onClick={() => setCardColumns(option)}
                    aria-pressed={cardColumns === option}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className='tpi-display-controls-bottom'>
            {DISPLAY_FIELDS.map((field) => (
              <label key={field.key} className='tpi-option-toggle'>
                <input
                  type='checkbox'
                  checked={displayOptions[field.key]}
                  onChange={() => toggleDisplayOption(field.key)}
                />
                <span>{field.label}</span>
              </label>
            ))}
          </div>

          {hasStakeholderIssueFilter && (
            <div
              className='tpi-display-controls-stakeholder'
              aria-label='Filtre parties prenantes'
            >
              <span>Parties prenantes</span>
              {hasMissingStakeholderFilter && (
                <button
                  type='button'
                  className={stakeholderFilter === 'missing' ? 'active' : ''}
                  onClick={() => setStakeholderFilter('missing')}
                >
                  Manquantes
                  <strong>{missingStakeholderCount}</strong>
                </button>
              )}
              <button
                type='button'
                className={stakeholderFilter === 'issues' ? 'active' : ''}
                onClick={() => setStakeholderFilter('issues')}
              >
                Incorrectes
                <strong>{stakeholderIssueCount}</strong>
              </button>
              <button
                type='button'
                className={stakeholderFilter === 'all' ? 'active' : ''}
                onClick={() => setStakeholderFilter('all')}
              >
                Toutes
                <strong>{profiles.length}</strong>
              </button>
            </div>
          )}
        </div>

        <div className='tpi-category-strip tpi-axis-strip' aria-label='Filtre par axe'>
          <span>Axes</span>
          {categoryOptions.map((option) => (
            <button
              key={option.key}
              type='button'
              className={categoryFilter === option.key ? 'active' : ''}
              onClick={() => setCategoryFilter(option.key)}
            >
              {option.label}
              <strong>{option.count}</strong>
            </button>
          ))}
          {hasActiveFilters && (
            <button type='button' className='clear' onClick={clearFilters}>
              Effacer
            </button>
          )}
        </div>
      </div>

      <div className='tpi-list-mini-stats'>
        <span>{summaryStats.axes} axes distincts</span>
        <span>{summaryStats.tags} tags nettoyés</span>
        {hasMissingStakeholderFilter ? (
          <span>{missingStakeholderCount} fiche(s) avec PP manquantes</span>
        ) : null}
        {hasStakeholderIssueFilter ? (
          <span>{stakeholderIssueCount} fiche(s) avec PP incorrectes</span>
        ) : null}
      </div>

      {editingTpiId && (
        <section className='tpi-management-editor-shell'>
          <div className='tpi-management-editor-header'>
            <div>
              <span className='tpi-management-toolbar-label'>Edition</span>
              <h2>TPI {editingTpiId}</h2>
            </div>
            <p>Les modifications sont sauvegardees dans la collection de l&apos;annee active.</p>
          </div>

          <TpiForm
            tpiToLoad={tpiList.find((tpi) => tpi.refTpi === editingTpiId)}
            onSave={onSave}
            onClose={handleFormClose}
          />
        </section>
      )}

      {filteredProfiles.length === 0 ? (
        <div className='tpi-management-state-card empty'>
          <h3>Aucun TPI à afficher</h3>
          <p>Elargissez la recherche ou retirez le filtre actif pour retrouver les fiches.</p>
        </div>
      ) : displayMode === 'cards' ? (
        <div
          ref={cardGridRef}
          className='tpi-card-grid'
          style={{ gridTemplateColumns: `repeat(${effectiveCardColumns}, minmax(0, 1fr))` }}
        >
          {filteredProfiles.map(({ tpi, profile, stakeholderIssues, classResolution }) => {
            const classCode = String(classResolution?.displayClassLabel || '').trim()
            const classTypeLabel = String(classResolution?.displayTypeLabel || '').trim()
            const classTitle = [
              classResolution?.displayLabel ? `Classe ${classResolution.displayLabel}` : '',
              classResolution?.siteLabel || tpi.site || tpi.lieu?.site ? `Site ${classResolution?.siteLabel || tpi.site || tpi.lieu?.site}` : ''
            ]
              .filter(Boolean)
              .join(' · ')
            const isExpanded = expandedTpiId === tpi.refTpi
            const missingStakeholders = stakeholderIssues.missingStakeholders
            const missingStakeholderLinks = stakeholderIssues.missingLinks

            return (
              <article key={tpi.refTpi} className={`tpi-card ${isExpanded ? 'expanded' : ''}`}>
                <div className='tpi-card-header'>
                  <div className='tpi-card-header-main'>
                    <div className='tpi-card-badges'>
                      <span className={getCategoryChipClass(profile.primaryCategoryKey)}>
                        {profile.primaryCategory}
                      </span>
                      {profile.domainLabel && profile.domainLabel !== profile.primaryCategory && (
                        <span className='tpi-domain-chip'>{profile.domainLabel}</span>
                      )}
                      {classCode ? (
                        <span className='tpi-class-chip' title={classTitle || classCode}>
                          {classCode}
                        </span>
                      ) : null}
                      {classResolution?.hasSpecificClass && classTypeLabel ? (
                        <span className='tpi-class-type-chip' title={classTitle || classTypeLabel}>
                          {classTypeLabel}
                        </span>
                      ) : null}
                    </div>

                    <div className='tpi-ref-badge'>#{tpi.refTpi}</div>
                  </div>

                  <button
                    type='button'
                    className='tpi-card-edit'
                    onClick={() => handleEdit(tpi.refTpi)}
                  >
                    Modifier
                  </button>
                </div>

                <h3 className='tpi-card-candidate'>
                  <StakeholderLink tpi={tpi} field={stakeholderFields.candidat}>
                    {tpi.candidat || 'Candidat non renseigné'}
                  </StakeholderLink>
                </h3>
                <p className='tpi-card-title'>{tpi.sujet || 'Sujet non renseigné'}</p>

                <div className='tpi-card-summary'>
                  {displayOptions.showTagsPreview && profile.previewTags.length > 0 ? (
                    profile.previewTags.map((tag) => (
                      <span key={`${tpi.refTpi}-${tag}`} className='tpi-tag'>
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className='tpi-tag muted'>{getCardBadge(profile)}</span>
                  )}

                  {displayOptions.showTagsPreview &&
                    profile.totalTags > profile.previewTags.length && (
                      <span className='tpi-tag muted'>
                        +{profile.totalTags - profile.previewTags.length}
                      </span>
                    )}

                  {missingStakeholders.length > 0 ? (
                    <span
                      className='tpi-tag tpi-tag-danger'
                      title={`Parties prenantes manquantes: ${missingStakeholders.join(', ')}`}
                    >
                      PP incompletes
                    </span>
                  ) : null}

                  {missingStakeholderLinks.length > 0 ? (
                    <span
                      className='tpi-tag tpi-tag-warning'
                      title={`Liaisons à compléter: ${missingStakeholderLinks.join(', ')}`}
                    >
                      Liaison PP à compléter
                    </span>
                  ) : null}
                </div>

                <dl className='tpi-card-meta'>
                  <div>
                    <dt>Encadrant</dt>
                    <dd>
                      <StakeholderLink tpi={tpi} field={stakeholderFields.boss}>
                        {tpi.boss || 'Non renseigné'}
                      </StakeholderLink>
                    </dd>
                  </div>

                  {displayOptions.showLocation && (
                    <div>
                      <dt>Lieu</dt>
                      <dd>{getTpiLocationLabel(tpi)}</dd>
                    </div>
                  )}

                  {displayOptions.showDates && (
                    <div>
                      <dt>Dates</dt>
                      <dd>{getTpiTimelineLabel(tpi)}</dd>
                    </div>
                  )}

                  {displayOptions.showExperts && (
                    <div>
                      <dt>Experts</dt>
                      <dd>{getExpertsLabel(tpi)}</dd>
                    </div>
                  )}

                  {displayOptions.showEvaluation && (
                    <div>
                      <dt>Évaluation</dt>
                      <dd>{getEvaluationLabel(tpi)}</dd>
                    </div>
                  )}
                </dl>

                <div className='tpi-card-footer'>
                  <button
                    type='button'
                    className='tpi-card-details-toggle'
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpandedCard(tpi.refTpi)}
                  >
                    {isExpanded ? 'Masquer les détails' : 'Détails'}
                  </button>
                </div>

                {isExpanded && (
                  <div className='tpi-card-details' aria-live='polite'>
                    <div className='tpi-detail-grid'>
                      <article>
                        <span>Classe</span>
                        <strong>{classCode || 'Non renseignée'}</strong>
                      </article>
                      {classResolution?.hasSpecificClass ? (
                        <article>
                          <span>Type de base</span>
                          <strong>{classTypeLabel || 'Non renseigné'}</strong>
                        </article>
                      ) : null}
                      <article>
                        <span>Site</span>
                        <strong>{classResolution?.siteLabel || tpi.site || tpi.lieu?.site || 'Non renseigné'}</strong>
                      </article>
                      <article>
                        <span>Domaine détecté</span>
                        <strong>{profile.domainLabel || 'Non renseigné'}</strong>
                      </article>
                      <article>
                        <span>Lieu complet</span>
                        <strong>{getTpiLocationLabel(tpi)}</strong>
                      </article>
                      <article>
                        <span>Période</span>
                        <strong>{getTpiTimelineLabel(tpi)}</strong>
                      </article>
                      <article>
                        <span>Évaluation</span>
                        <strong>{getEvaluationLabel(tpi)}</strong>
                      </article>
                      <article>
                        <span>Dépôt</span>
                        <strong>{tpi.lienDepot ? 'Lien disponible' : 'Aucun lien'}</strong>
                      </article>
                      <article>
                        <span>Etat PP</span>
                        <strong>
                          {stakeholderIssues.summary}
                        </strong>
                      </article>
                    </div>

                    <div className='tpi-detail-section'>
                      <h4>Experts</h4>
                      <div className='tpi-inline-values'>
                        <span>
                          Expert 1:{' '}
                          <StakeholderLink tpi={tpi} field={stakeholderFields.expert1}>
                            {tpi?.experts?.['1'] || 'Non renseigné'}
                          </StakeholderLink>
                        </span>
                        <span>
                          Expert 2:{' '}
                          <StakeholderLink tpi={tpi} field={stakeholderFields.expert2}>
                            {tpi?.experts?.['2'] || 'Non renseigné'}
                          </StakeholderLink>
                        </span>
                      </div>
                    </div>

                    <div className='tpi-detail-section'>
                      <h4>Axes techniques</h4>
                      <div className='tpi-tag-groups'>
                        {profile.groupedTags.length > 0 ? (
                          profile.groupedTags.map((group) => (
                            <section key={group.key} className='tpi-tag-group'>
                              <div className='tpi-tag-group-header'>
                                <span className={getCategoryChipClass(group.key)}>
                                  {group.label}
                                </span>
                                <small>{group.count} tag{group.count > 1 ? 's' : ''}</small>
                              </div>
                              <div className='tpi-tag-row'>
                                {group.tags.map((entry) => (
                                  <span key={`${tpi.refTpi}-${group.key}-${entry.label}`} className='tpi-tag'>
                                    {entry.label}
                                  </span>
                                ))}
                              </div>
                            </section>
                          ))
                        ) : (
                          <p>Aucun tag saisi pour cette fiche.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <div className='tpi-table-shell'>
          <table className='tpiTable'>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Candidat</th>
                <th>Classe</th>
                <th>Axe</th>
                <th>Sujet</th>
                <th>Tags</th>
                <th>Lieu</th>
                <th>Soutenance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map(({ tpi, profile, stakeholderIssues, classResolution }) => {
                const classDisplay = classResolution?.displayLabel || String(tpi.classe || '').trim() || 'Non renseignée'
                const missingStakeholders = stakeholderIssues.missingStakeholders
                const missingStakeholderLinks = stakeholderIssues.missingLinks

                return (
                  <tr key={tpi.refTpi}>
                    <td>{tpi.refTpi}</td>
                    <td>
                      <StakeholderLink tpi={tpi} field={stakeholderFields.candidat}>
                        {tpi.candidat || 'Candidat non renseigné'}
                      </StakeholderLink>
                    </td>
                    <td>{classDisplay}</td>
                    <td>{profile.primaryCategory}</td>
                    <td>{tpi.sujet || 'Non renseigné'}</td>
                    <td>{profile.previewTags.join(', ') || 'Aucun'}</td>
                    <td>{getTpiLocationLabel(tpi)}</td>
                    <td>
                      {tpi?.dates?.soutenance
                        ? formatDisplayDate(tpi.dates.soutenance)
                        : 'A planifier'}
                    </td>
                    <td>
                      {missingStakeholders.length > 0 ? (
                        <span
                          className='tpi-table-link-warning tpi-table-link-danger'
                          title={`Parties prenantes manquantes: ${missingStakeholders.join(', ')}`}
                        >
                          PP incompletes
                        </span>
                      ) : null}
                      {missingStakeholderLinks.length > 0 ? (
                        <span
                          className='tpi-table-link-warning'
                          title={`Liaisons à compléter: ${missingStakeholderLinks.join(', ')}`}
                        >
                          A completer
                        </span>
                      ) : null}
                      <button
                        type='button'
                        className='tpi-table-edit'
                        onClick={() => handleEdit(tpi.refTpi)}
                      >
                        Modifier
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default TpiList
