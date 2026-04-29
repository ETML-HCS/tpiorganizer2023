import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import TpiForm from './TpiForm.jsx'
import { buildTpiDetailsLink } from '../tpiDetail/tpiDetailUtils.js'
import {
  CheckIcon,
  CloseIcon,
  FileTextIcon,
  ListIcon,
  PencilIcon,
  RefreshIcon,
  SaveIcon
} from '../shared/InlineIcons.jsx'
import { getPlanningClassDisplayInfo } from '../tpiPlanning/planningClassUtils.js'
import { getPlanningPerimeterState } from '../../utils/planningScopeUtils.js'
import {
  buildTpiTagProfile,
  formatDisplayDate,
  getCategoryChipClass,
  getCategoryLabelFromKey,
  getMissingStakeholders,
  getStakeholderIssues,
  getTpiLocationLabel,
  getTpiTimelineLabel,
  matchesSearch,
  normalizeTpiForForm,
  normalizeTpiForSave,
  splitTags
} from './tpiManagementUtils.js'
import { ROUTES } from '../../config/appConfig'

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

const buildStakeholderDetailsLink = (tpi, field, year) => {
  const personId = String(tpi?.[field.idName] || '').trim()
  const personName = String(readStakeholderFieldValue(tpi, field.name) || '').trim()
  const tpiRef = String(tpi?.refTpi || '').trim()
  const params = new URLSearchParams()

  if (personId) {
    params.set('personId', personId)
  }

  if (personName) {
    params.set('name', personName)
  }

  params.set('role', field.role)
  params.set('tab', 'create')

  if (year) {
    params.set('year', String(year))
  }

  if (year && tpiRef) {
    const returnToParams = new URLSearchParams({
      year: String(year),
      focus: tpiRef,
      edit: '1'
    })
    params.set('returnTo', `${ROUTES.GESTION_TPI}?${returnToParams.toString()}`)
  }

  return `${ROUTES.PARTIES_PRENANTES}?${params.toString()}`
}

const StakeholderLink = ({ tpi, field, year, children }) => {
  const personName = String(readStakeholderFieldValue(tpi, field.name) || '').trim()
  const personId = String(tpi?.[field.idName] || '').trim()

  if (!personName) {
    return <span>{children}</span>
  }

  return (
    <Link
      to={buildStakeholderDetailsLink(tpi, field, year)}
      className='tpi-stakeholder-link'
      aria-label={personId
        ? `Ouvrir la fiche de ${personName}`
        : 'Ouvrir la recherche de la personne dans Parties prenantes'}
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

const normalizeManagedRef = (value) =>
  String(value || '')
    .trim()
    .replace(/^TPI-\d{4}-/i, '')

const BULK_EDIT_FIELDS = [
  { key: 'classe', label: 'Classe', type: 'text', placeholder: 'CID4A' },
  { key: 'sujet', label: 'Sujet', type: 'text', placeholder: 'Sujet commun' },
  { key: 'lieuSite', label: 'Site', type: 'text', placeholder: 'ETML' },
  { key: 'lieuEntreprise', label: 'Entreprise', type: 'text', placeholder: 'Entreprise' },
  { key: 'dateDepart', label: 'Début', type: 'date', placeholder: '' },
  { key: 'dateFin', label: 'Fin', type: 'date', placeholder: '' },
  { key: 'tags', label: 'Tags', type: 'text', placeholder: 'React, API, infra' }
]

const DEFAULT_BULK_FIELD_VALUES = BULK_EDIT_FIELDS.reduce((accumulator, field) => ({
  ...accumulator,
  [field.key]: ''
}), {})

const DEFAULT_BULK_FIELD_SELECTION = BULK_EDIT_FIELDS.reduce((accumulator, field) => ({
  ...accumulator,
  [field.key]: false
}), {})

const mergeBulkTags = (currentValue, nextValue, mode = 'replace') => {
  if (mode !== 'append') {
    return splitTags(nextValue).join(', ')
  }

  return Array.from(new Set([
    ...splitTags(currentValue),
    ...splitTags(nextValue)
  ])).join(', ')
}

const applyBulkEditToTpi = (tpi, selectedFields, fieldValues, tagMode) => {
  const nextFormState = {
    ...normalizeTpiForForm(tpi)
  }

  BULK_EDIT_FIELDS.forEach((field) => {
    if (!selectedFields[field.key]) {
      return
    }

    if (field.key === 'tags') {
      nextFormState.tags = mergeBulkTags(nextFormState.tags, fieldValues.tags, tagMode)
      return
    }

    nextFormState[field.key] = fieldValues[field.key]
  })

  return normalizeTpiForSave(nextFormState)
}

const TpiList = ({
  tpiList,
  onSave,
  onBulkSave,
  year,
  searchTerm = '',
  onSearchTermChange = () => {},
  focusedTpiRef = '',
  requestedEditRef = '',
  planningCatalogSites = [],
  planningClassTypes = [],
  planningSoutenanceDates = [],
  planningSiteConfigs = []
}) => {
  const [editingTpiId, setEditingTpiId] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [planningScopeFilter, setPlanningScopeFilter] = useState('all')
  const [stakeholderFilter, setStakeholderFilter] = useState(() =>
    tpiList.some((tpi) => getMissingStakeholders(tpi).length > 0) ? 'missing' : 'all'
  )
  const [displayMode, setDisplayMode] = useState('cards')
  const [cardColumns, setCardColumns] = useState(4)
  const [cardGridWidth, setCardGridWidth] = useState(0)
  const [displayOptions, setDisplayOptions] = useState(DEFAULT_DISPLAY_OPTIONS)
  const [isBulkMode, setIsBulkMode] = useState(false)
  const [selectedRefs, setSelectedRefs] = useState([])
  const [bulkFieldSelection, setBulkFieldSelection] = useState(DEFAULT_BULK_FIELD_SELECTION)
  const [bulkFieldValues, setBulkFieldValues] = useState(DEFAULT_BULK_FIELD_VALUES)
  const [bulkTagMode, setBulkTagMode] = useState('replace')
  const [isBulkSaving, setIsBulkSaving] = useState(false)
  const [bulkFeedback, setBulkFeedback] = useState(null)
  const cardGridRef = useRef(null)
  const profiles = useMemo(
    () =>
      tpiList.map((tpi) => ({
        tpi,
        profile: buildTpiTagProfile(tpi),
        planningPerimeter: getPlanningPerimeterState(tpi, planningSiteConfigs, year),
        classResolution: getPlanningClassDisplayInfo(
          tpi.classe,
          planningClassTypes,
          planningCatalogSites,
          tpi.site || tpi.lieu?.site
        )
      }))
        .map((entry) => {
          const stakeholderIssues = entry.planningPerimeter.isPlanifiable
            ? getStakeholderIssues(entry.tpi)
            : {
                missingStakeholders: [],
                missingLinks: [],
                hasIssues: false,
                summary: entry.planningPerimeter.reason || 'Hors planification'
              }

          return {
            ...entry,
            stakeholderIssues,
            missingStakeholders: stakeholderIssues.missingStakeholders
          }
        }),
    [planningCatalogSites, planningClassTypes, planningSiteConfigs, tpiList, year]
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
      { key: 'all', label: 'Tout', count: profiles.length },
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
      profiles.filter(({ tpi, profile, stakeholderIssues, missingStakeholders, planningPerimeter }) => {
        const matchesCategory =
          categoryFilter === 'all' || profile.categoryKeys.includes(categoryFilter)
        const matchesPlanningScope =
          planningScopeFilter === 'all' ||
          (planningScopeFilter === 'planifiable' && planningPerimeter.isPlanifiable) ||
          (planningScopeFilter === 'out-of-scope' && !planningPerimeter.isPlanifiable)
        const matchesStakeholder = stakeholderFilter === 'all' ||
          (stakeholderFilter === 'missing' && missingStakeholders.length > 0) ||
          (stakeholderFilter === 'issues' && stakeholderIssues.hasIssues)

        return matchesCategory &&
          matchesPlanningScope &&
          matchesStakeholder &&
          matchesSearch(tpi, searchTerm, profile)
      }),
    [categoryFilter, planningScopeFilter, profiles, searchTerm, stakeholderFilter]
  )

  const missingStakeholderCount = useMemo(
    () => profiles.filter(({ planningPerimeter, missingStakeholders }) => planningPerimeter.isPlanifiable && missingStakeholders.length > 0).length,
    [profiles]
  )
  const stakeholderIssueCount = useMemo(
    () => profiles.filter(({ planningPerimeter, stakeholderIssues }) => planningPerimeter.isPlanifiable && stakeholderIssues.hasIssues).length,
    [profiles]
  )
  const planifiableCount = useMemo(
    () => profiles.filter(({ planningPerimeter }) => planningPerimeter.isPlanifiable).length,
    [profiles]
  )
  const outOfScopeCount = useMemo(
    () => profiles.filter(({ planningPerimeter }) => !planningPerimeter.isPlanifiable).length,
    [profiles]
  )
  const hasMissingStakeholderFilter = missingStakeholderCount > 0
  const hasStakeholderIssueFilter = stakeholderIssueCount > 0
  const hasPlanningScopeFilter = outOfScopeCount > 0
  const hasActiveFilters =
    categoryFilter !== 'all' ||
    planningScopeFilter !== 'all' ||
    stakeholderFilter !== 'all' ||
    Boolean(searchTerm)
  const selectedRefSet = useMemo(() => new Set(selectedRefs), [selectedRefs])
  const selectedProfiles = useMemo(
    () =>
      profiles.filter(({ tpi }) => selectedRefSet.has(normalizeManagedRef(tpi?.refTpi))),
    [profiles, selectedRefSet]
  )
  const selectedCount = selectedProfiles.length
  const selectedVisibleCount = useMemo(
    () =>
      filteredProfiles.filter(({ tpi }) => selectedRefSet.has(normalizeManagedRef(tpi?.refTpi))).length,
    [filteredProfiles, selectedRefSet]
  )
  const allFilteredSelected = filteredProfiles.length > 0 &&
    filteredProfiles.every(({ tpi }) => selectedRefSet.has(normalizeManagedRef(tpi?.refTpi)))
  const enabledBulkFieldCount = useMemo(
    () => Object.values(bulkFieldSelection).filter(Boolean).length,
    [bulkFieldSelection]
  )
  const resetBulkEditor = useCallback(() => {
    setBulkFieldSelection(DEFAULT_BULK_FIELD_SELECTION)
    setBulkFieldValues(DEFAULT_BULK_FIELD_VALUES)
    setBulkTagMode('replace')
  }, [])
  const effectiveCardColumns = useMemo(
    () => getEffectiveCardColumns(cardGridWidth, cardColumns),
    [cardColumns, cardGridWidth]
  )
  const activeFilterLabels = useMemo(() => {
    const labels = []
    const activeCategory = categoryOptions.find((option) => option.key === categoryFilter)

    if (activeCategory && activeCategory.key !== 'all') {
      labels.push(activeCategory.label)
    }

    if (planningScopeFilter === 'planifiable') {
      labels.push('Planif.')
    }

    if (planningScopeFilter === 'out-of-scope') {
      labels.push('Hors pér.')
    }

    if (stakeholderFilter === 'missing') {
      labels.push('PP manquantes')
    }

    if (stakeholderFilter === 'issues') {
      labels.push('PP incorrectes')
    }

    if (searchTerm) {
      labels.push(`Recherche "${searchTerm}"`)
    }

    return labels
  }, [categoryFilter, categoryOptions, planningScopeFilter, searchTerm, stakeholderFilter])

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
    setSelectedRefs([])
    setIsBulkMode(false)
    setBulkFeedback(null)
    resetBulkEditor()
  }, [resetBulkEditor, year])

  useEffect(() => {
    const availableRefs = new Set(
      profiles
        .map(({ tpi }) => normalizeManagedRef(tpi?.refTpi))
        .filter(Boolean)
    )

    setSelectedRefs((currentSelection) => {
      const nextSelection = currentSelection.filter((refKey) => availableRefs.has(refKey))

      if (
        nextSelection.length === currentSelection.length &&
        nextSelection.every((refKey, index) => refKey === currentSelection[index])
      ) {
        return currentSelection
      }

      return nextSelection
    })
  }, [profiles])

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
  }

  const handleFormClose = () => {
    setEditingTpiId(null)
  }

  const clearFilters = () => {
    setCategoryFilter('all')
    setPlanningScopeFilter('all')
    setStakeholderFilter('all')
    onSearchTermChange('')
  }

  const handleToggleBulkMode = () => {
    setBulkFeedback(null)
    setIsBulkMode((currentValue) => {
      const nextValue = !currentValue

      if (!nextValue) {
        setSelectedRefs([])
        resetBulkEditor()
      }

      return nextValue
    })
  }

  const handleToggleSelection = (tpiRef) => {
    const normalizedRef = normalizeManagedRef(tpiRef)

    if (!normalizedRef) {
      return
    }

    if (!isBulkMode) {
      setIsBulkMode(true)
    }

    setBulkFeedback(null)
    setSelectedRefs((currentSelection) =>
      currentSelection.includes(normalizedRef)
        ? currentSelection.filter((entry) => entry !== normalizedRef)
        : [...currentSelection, normalizedRef]
    )
  }

  const handleSelectAllFiltered = () => {
    const filteredRefs = filteredProfiles
      .map(({ tpi }) => normalizeManagedRef(tpi?.refTpi))
      .filter(Boolean)

    if (filteredRefs.length === 0) {
      return
    }

    setBulkFeedback(null)
    setSelectedRefs((currentSelection) => {
      const currentSet = new Set(currentSelection)
      const shouldClearVisibleSelection = filteredRefs.every((refKey) => currentSet.has(refKey))

      if (shouldClearVisibleSelection) {
        return currentSelection.filter((refKey) => !filteredRefs.includes(refKey))
      }

      return Array.from(new Set([...currentSelection, ...filteredRefs]))
    })
  }

  const handleClearSelection = () => {
    setBulkFeedback(null)
    setSelectedRefs([])
  }

  const toggleDisplayOption = (key) => {
    setDisplayOptions((current) => ({
      ...current,
      [key]: !current[key]
    }))
  }

  const handleBulkFieldToggle = (fieldKey) => {
    setBulkFeedback(null)
    setBulkFieldSelection((currentSelection) => ({
      ...currentSelection,
      [fieldKey]: !currentSelection[fieldKey]
    }))
  }

  const handleBulkFieldValueChange = (fieldKey) => (event) => {
    setBulkFeedback(null)
    setBulkFieldValues((currentValues) => ({
      ...currentValues,
      [fieldKey]: event.target.value
    }))
  }

  const handleResetBulkEditor = () => {
    setBulkFeedback(null)
    resetBulkEditor()
  }

  const executeBulkSaveFallback = async (payloads) => {
    const failures = []
    let successCount = 0

    for (const payload of payloads) {
      try {
        const savedTpi = await onSave(payload)

        if (savedTpi) {
          successCount += 1
        } else {
          failures.push({
            refTpi: payload?.refTpi,
            message: 'Erreur lors de la sauvegarde'
          })
        }
      } catch (saveError) {
        failures.push({
          refTpi: payload?.refTpi,
          message: saveError?.message || 'Erreur lors de la sauvegarde'
        })
      }
    }

    return {
      total: payloads.length,
      successCount,
      failureCount: failures.length,
      failures
    }
  }

  const handleBulkSubmit = async (event) => {
    event.preventDefault()

    if (selectedProfiles.length === 0) {
      setBulkFeedback({
        tone: 'warning',
        message: 'Sélectionne au moins une fiche avant de lancer une modification groupée.',
        details: []
      })
      return
    }

    if (enabledBulkFieldCount === 0) {
      setBulkFeedback({
        tone: 'warning',
        message: 'Coche au moins un champ à appliquer sur la sélection.',
        details: []
      })
      return
    }

    setIsBulkSaving(true)
    setBulkFeedback(null)

    try {
      const payloads = selectedProfiles.map(({ tpi }) => {
        const payload = applyBulkEditToTpi(tpi, bulkFieldSelection, bulkFieldValues, bulkTagMode)

        return tpi?._id
          ? { ...payload, _id: tpi._id }
          : payload
      })
      const result = typeof onBulkSave === 'function'
        ? await onBulkSave(payloads)
        : await executeBulkSaveFallback(payloads)
      const successCount = Number(result?.successCount || 0)
      const failureCount = Number(result?.failureCount || 0)
      const failures = Array.isArray(result?.failures) ? result.failures : []

      if (successCount > 0) {
        const failedRefSet = new Set(
          failures
            .map((failure) => normalizeManagedRef(failure?.refTpi))
            .filter(Boolean)
        )

        setBulkFeedback({
          tone: failureCount > 0 ? 'warning' : 'success',
          message: failureCount > 0
            ? `${successCount} fiche(s) mises à jour, ${failureCount} à reprendre.`
            : `${successCount} fiche(s) mises à jour d'un coup.`,
          details: failures.slice(0, 4)
        })

        if (failureCount > 0) {
          setSelectedRefs((currentSelection) =>
            currentSelection.filter((refKey) => failedRefSet.has(refKey))
          )
        } else {
          setSelectedRefs([])
        }

        resetBulkEditor()
        return
      }

      setBulkFeedback({
        tone: 'error',
        message: 'Aucune fiche n’a pu être mise à jour.',
        details: failures.slice(0, 4)
      })
    } catch (bulkError) {
      setBulkFeedback({
        tone: 'error',
        message: bulkError?.message || 'Impossible de lancer la mise à jour groupée.',
        details: []
      })
    } finally {
      setIsBulkSaving(false)
    }
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

  useEffect(() => {
    const normalizedRequestedRef = normalizeManagedRef(requestedEditRef)

    if (!normalizedRequestedRef) {
      return
    }

    const matchingTpi = tpiList.find((tpi) => normalizeManagedRef(tpi?.refTpi) === normalizedRequestedRef)

    if (!matchingTpi) {
      return
    }

    setEditingTpiId((currentEditingRef) => {
      if (normalizeManagedRef(currentEditingRef) === normalizedRequestedRef) {
        return currentEditingRef
      }

      return normalizedRequestedRef
    })
  }, [requestedEditRef, tpiList])

  const normalizedFocusedRef = normalizeManagedRef(focusedTpiRef)
  return (
    <div className='tpi-list-shell'>
      <div className='tpi-toolbar-row' aria-label='Pilotage de la liste'>
        <section className='tpi-control-panel tpi-control-panel-view' aria-label='Affichage'>
          <div className='tpi-control-panel-head'>
            <div>
              <span>Vue</span>
              <h3>Affichage</h3>
            </div>

            <div className='tpi-display-toggle' role='group' aria-label='Mode affichage'>
              <button
                type='button'
                className={displayMode === 'cards' ? 'active' : ''}
                onClick={() => setDisplayMode('cards')}
                aria-pressed={displayMode === 'cards'}
              >
                Cartes
              </button>
              <button
                type='button'
                className={displayMode === 'table' ? 'active' : ''}
                onClick={() => setDisplayMode('table')}
                aria-pressed={displayMode === 'table'}
              >
                Tableau
              </button>
            </div>
          </div>

          <div className='tpi-display-controls-top'>
            {displayMode === 'cards' && (
              <div className='tpi-density-toggle' aria-label='Cartes par ligne'>
                <span>Densité</span>
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

            <div className='tpi-bulk-mode-launcher'>
              <button
                type='button'
                className={`tpi-bulk-mode-toggle ${isBulkMode ? 'active' : ''}`.trim()}
                onClick={handleToggleBulkMode}
                aria-pressed={isBulkMode}
                aria-label={isBulkMode ? 'Fermer le mode lot' : 'Mode lot'}
              >
                <ListIcon className='tpi-action-icon' />
                <span>{isBulkMode ? '×' : 'Lot'}</span>
              </button>

              {selectedCount > 0 ? (
                <span className='tpi-bulk-count-pill'>
                  <CheckIcon className='tpi-action-icon' />
                  <strong>{selectedCount}</strong>
                  <span>sélection</span>
                </span>
              ) : null}
            </div>
          </div>

          <div className='tpi-display-controls-bottom' aria-label='Champs visibles'>
            <span>Champs</span>
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
        </section>

        <section className='tpi-control-panel tpi-control-panel-quality' aria-label='Qualité'>
          <div className='tpi-control-panel-head'>
            <div>
              <span>Contrôles</span>
              <h3>Qualité</h3>
            </div>

            {hasActiveFilters && (
              <button type='button' className='tpi-clear-filters-button' onClick={clearFilters}>
                Effacer
              </button>
            )}
          </div>

          {hasStakeholderIssueFilter ? (
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
          ) : (
            <span className='tpi-control-empty'>Parties prenantes complètes</span>
          )}

          {hasPlanningScopeFilter ? (
            <div
              className='tpi-display-controls-planning'
              aria-label='Filtre périmètre planning'
            >
              <span>Planification</span>
              <button
                type='button'
                className={planningScopeFilter === 'planifiable' ? 'active' : ''}
                onClick={() => setPlanningScopeFilter('planifiable')}
              >
                Planif.
                <strong>{planifiableCount}</strong>
              </button>
              <button
                type='button'
                className={planningScopeFilter === 'out-of-scope' ? 'active' : ''}
                onClick={() => setPlanningScopeFilter('out-of-scope')}
              >
                Hors pér.
                <strong>{outOfScopeCount}</strong>
              </button>
              <button
                type='button'
                className={planningScopeFilter === 'all' ? 'active' : ''}
                onClick={() => setPlanningScopeFilter('all')}
              >
                Tout
                <strong>{profiles.length}</strong>
              </button>
            </div>
          ) : (
            <span className='tpi-control-empty'>Périmètre planning complet</span>
          )}
        </section>

        <section className='tpi-control-panel tpi-control-panel-axes' aria-label='Axes'>
          <div className='tpi-control-panel-head'>
            <div>
              <span>Typologie</span>
              <h3>Axes</h3>
            </div>
          </div>

          <div className='tpi-category-strip tpi-axis-strip' aria-label='Filtre par axe'>
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
          </div>
        </section>
      </div>

      {activeFilterLabels.length > 0 ? (
        <div className='tpi-list-mini-stats' aria-label='Filtres actifs'>
          {activeFilterLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      ) : null}

      {isBulkMode ? (
        <section className='tpi-bulk-editor-shell'>
          <div className='tpi-bulk-editor-head'>
            <div>
              <span className='tpi-management-toolbar-label'>Lot</span>
              <h3>{selectedCount > 0 ? `${selectedCount} fiche(s) sélectionnée(s)` : 'Sélection en attente'}</h3>
            </div>

            <p>
              Coche les fiches puis applique.
            </p>
          </div>

          <div className='tpi-bulk-editor-toolbar'>
            <span>{selectedVisibleCount}/{filteredProfiles.length} visible(s) cochée(s)</span>
            <button
              type='button'
              className={`tpi-bulk-toolbar-button ${allFilteredSelected ? 'active' : ''}`.trim()}
              onClick={handleSelectAllFiltered}
              disabled={filteredProfiles.length === 0}
            >
              <CheckIcon className='tpi-action-icon' />
              <span>{allFilteredSelected ? 'Retirer visibles' : 'Prendre visibles'}</span>
            </button>
            <button
              type='button'
              className='tpi-bulk-toolbar-button'
              onClick={handleClearSelection}
              disabled={selectedCount === 0}
            >
              <CloseIcon className='tpi-action-icon' />
              <span>Vider</span>
            </button>
            <button
              type='button'
              className='tpi-bulk-toolbar-button'
              onClick={handleResetBulkEditor}
              disabled={enabledBulkFieldCount === 0 && !Object.values(bulkFieldValues).some(Boolean)}
            >
              <RefreshIcon className='tpi-action-icon' />
              <span>Réinitialiser</span>
            </button>
          </div>

          {bulkFeedback ? (
            <div className={`tpi-bulk-feedback is-${bulkFeedback.tone || 'info'}`}>
              <strong>{bulkFeedback.message}</strong>
              {Array.isArray(bulkFeedback.details) && bulkFeedback.details.length > 0 ? (
                <ul>
                  {bulkFeedback.details.map((detail) => (
                    <li key={`${detail.refTpi}-${detail.message}`}>
                      <strong>{detail.refTpi}</strong>
                      <span>{detail.message}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <form className='tpi-bulk-editor-form' onSubmit={handleBulkSubmit}>
            <div className='tpi-bulk-editor-grid'>
              {BULK_EDIT_FIELDS.map((field) => (
                <label
                  key={field.key}
                  className={`tpi-bulk-field ${bulkFieldSelection[field.key] ? 'is-active' : ''}`.trim()}
                >
                  <span className='tpi-bulk-field-head'>
                    <input
                      type='checkbox'
                      checked={bulkFieldSelection[field.key]}
                      onChange={() => handleBulkFieldToggle(field.key)}
                    />
                    <span>{field.label}</span>
                  </span>

                  <input
                    type={field.type}
                    value={bulkFieldValues[field.key]}
                    onChange={handleBulkFieldValueChange(field.key)}
                    placeholder={field.placeholder}
                    disabled={!bulkFieldSelection[field.key]}
                  />

                  {field.key === 'tags' ? (
                    <select
                      value={bulkTagMode}
                      onChange={(event) => setBulkTagMode(event.target.value)}
                      disabled={!bulkFieldSelection.tags}
                    >
                      <option value='replace'>Remplacer les tags</option>
                      <option value='append'>Ajouter aux tags</option>
                    </select>
                  ) : null}
                </label>
              ))}
            </div>

            <div className='tpi-bulk-editor-actions'>
              <button
                type='submit'
                className='tpi-bulk-submit'
                disabled={selectedCount === 0 || enabledBulkFieldCount === 0 || isBulkSaving}
              >
                <SaveIcon className='tpi-action-icon' />
                <span>{isBulkSaving ? 'Application...' : 'Appliquer à la sélection'}</span>
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {editingTpiId && (
        <section className='tpi-management-editor-shell'>
          <div className='tpi-management-editor-header'>
            <div>
              <span className='tpi-management-toolbar-label'>Edition</span>
              <h2>TPI {editingTpiId}</h2>
            </div>
            <p>Sauvegarde dans l&apos;année active.</p>
          </div>

          <TpiForm
            tpiToLoad={tpiList.find((tpi) => tpi.refTpi === editingTpiId)}
            onSave={onSave}
            onClose={handleFormClose}
            year={year}
            planningCatalogSites={planningCatalogSites}
            planningClassTypes={planningClassTypes}
            planningSoutenanceDates={planningSoutenanceDates}
          />
        </section>
      )}

      {filteredProfiles.length === 0 ? (
        <div className='tpi-management-state-card empty'>
          <h3>Aucun TPI à afficher</h3>
          <p>Modifiez la recherche ou les filtres.</p>
        </div>
      ) : displayMode === 'cards' ? (
        <div
          ref={cardGridRef}
          className='tpi-card-grid'
          style={{ gridTemplateColumns: `repeat(${effectiveCardColumns}, minmax(0, 1fr))` }}
        >
          {filteredProfiles.map(({ tpi, profile, stakeholderIssues, classResolution, planningPerimeter }) => {
            const classChipLabel = String(
              classResolution?.classLabel || classResolution?.displayClassLabel || ''
            ).trim()
            const classCode = String(classResolution?.classCode || '').trim()
            const classTypeLabel = String(classResolution?.displayTypeLabel || '').trim()
            const classTitle = [
              classChipLabel ? `Classe ${classChipLabel}` : '',
              classCode && classChipLabel && classCode !== classChipLabel ? `Code ${classCode}` : '',
              classTypeLabel ? `Type ${classTypeLabel}` : '',
              classResolution?.siteLabel || tpi.site || tpi.lieu?.site ? `Site ${classResolution?.siteLabel || tpi.site || tpi.lieu?.site}` : ''
            ]
              .filter(Boolean)
              .join(' · ')
            const missingStakeholders = stakeholderIssues.missingStakeholders
            const missingStakeholderLinks = stakeholderIssues.missingLinks
            const isFocused = normalizedFocusedRef && normalizeManagedRef(tpi.refTpi) === normalizedFocusedRef
            const isSelected = selectedRefSet.has(normalizeManagedRef(tpi.refTpi))
            const cardStateClass = !planningPerimeter.isPlanifiable
              ? 'is-out-of-scope'
              : stakeholderIssues.hasIssues
                ? 'has-stakeholder-warning'
                : 'is-ready'
            const cardStateLabel = !planningPerimeter.isPlanifiable
              ? planningPerimeter.reason || 'Hors planification'
              : stakeholderIssues.hasIssues
                ? stakeholderIssues.summary
                : 'Prête pour le planning'

            return (
              <article
                key={tpi.refTpi}
                className={`tpi-card ${cardStateClass} ${isFocused ? 'is-focused' : ''} ${isSelected ? 'is-selected' : ''}`.trim()}
              >
                <div className='tpi-card-header'>
                  <div className='tpi-card-header-main'>
                    <div className='tpi-card-badges'>
                      <span className={getCategoryChipClass(profile.primaryCategoryKey)}>
                        {profile.primaryCategory}
                      </span>
                      {profile.domainLabel && profile.domainLabel !== profile.primaryCategory && (
                        <span className='tpi-domain-chip'>{profile.domainLabel}</span>
                      )}
                      {classChipLabel ? (
                        <span className='tpi-class-chip' title={classTitle || classChipLabel}>
                          {classChipLabel}
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

                  <div className='tpi-card-actions'>
                    {isBulkMode ? (
                      <button
                        type='button'
                        className={`tpi-card-select-toggle ${isSelected ? 'is-selected' : ''}`.trim()}
                        onClick={() => handleToggleSelection(tpi.refTpi)}
                        aria-pressed={isSelected}
                        title={isSelected ? `Retirer ${tpi.refTpi} de la sélection` : `Ajouter ${tpi.refTpi} à la sélection`}
                      >
                        <CheckIcon className='tpi-action-icon' />
                        <span className='sr-only'>
                          {isSelected ? `Retirer ${tpi.refTpi} de la sélection` : `Ajouter ${tpi.refTpi} à la sélection`}
                        </span>
                      </button>
                    ) : null}
                    <Link
                      to={buildTpiDetailsLink(year, tpi.refTpi)}
                      className='tpi-card-icon-button tpi-card-open'
                      title={`Ouvrir la fiche ${tpi.refTpi}`}
                    >
                      <FileTextIcon className='tpi-action-icon' />
                      <span className='sr-only'>Ouvrir la fiche</span>
                    </Link>
                    <button
                      type='button'
                      className='tpi-card-icon-button tpi-card-edit'
                      onClick={() => handleEdit(tpi.refTpi)}
                      title={`Modifier ${tpi.refTpi}`}
                    >
                      <PencilIcon className='tpi-action-icon' />
                      <span className='sr-only'>Modifier la fiche</span>
                    </button>
                  </div>
                </div>

                <div className={`tpi-card-status-row ${cardStateClass}`}>
                  <span aria-hidden='true' />
                  <strong>{cardStateLabel}</strong>
                </div>

                <div className='tpi-card-main-copy'>
                  <span>Candidat</span>
                  <h3 className='tpi-card-candidate'>
                    <StakeholderLink tpi={tpi} field={stakeholderFields.candidat} year={year}>
                      {tpi.candidat || 'Candidat non renseigné'}
                    </StakeholderLink>
                  </h3>
                  <p className='tpi-card-title'>{tpi.sujet || 'Sujet non renseigné'}</p>
                </div>

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

                  {!planningPerimeter.isPlanifiable ? (
                    <span
                      className='tpi-tag tpi-tag-scope'
                      title={planningPerimeter.reason}
                    >
                      Hors planification
                    </span>
                  ) : null}

                  {isFocused ? (
                    <span className='tpi-tag tpi-tag-focus'>
                      Fiche ciblée
                    </span>
                  ) : null}
                </div>

                <dl className='tpi-card-meta'>
                  <div>
                    <dt>Encadrant</dt>
                    <dd>
                      <StakeholderLink tpi={tpi} field={stakeholderFields.boss} year={year}>
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
                  <span className='tpi-card-footer-hint'>
                    {tpi?.dates?.soutenance
                      ? `Défense ${formatDisplayDate(tpi.dates.soutenance)}`
                      : 'Défense à planifier'}
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className='tpi-table-shell'>
          <table className='tpiTable'>
            <thead>
              <tr>
                {isBulkMode ? <th className='tpi-table-selection-col'>Lot</th> : null}
                <th>Ref</th>
                <th>Candidat</th>
                <th>Classe</th>
                <th>Axe</th>
                <th>Sujet</th>
                <th>Tags</th>
                <th>Lieu</th>
                <th>Défense</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map(({ tpi, profile, stakeholderIssues, classResolution, planningPerimeter }) => {
                const classDisplay = classResolution?.displayLabel || String(tpi.classe || '').trim() || 'Non renseignée'
                const missingStakeholders = stakeholderIssues.missingStakeholders
                const missingStakeholderLinks = stakeholderIssues.missingLinks
                const isFocused = normalizedFocusedRef && normalizeManagedRef(tpi.refTpi) === normalizedFocusedRef
                const isSelected = selectedRefSet.has(normalizeManagedRef(tpi.refTpi))

                return (
                  <tr key={tpi.refTpi} className={`${isFocused ? 'is-focused' : ''} ${isSelected ? 'is-selected' : ''}`.trim()}>
                    {isBulkMode ? (
                      <td className='tpi-table-selection-cell'>
                        <button
                          type='button'
                          className={`tpi-card-select-toggle ${isSelected ? 'is-selected' : ''}`.trim()}
                          onClick={() => handleToggleSelection(tpi.refTpi)}
                          aria-pressed={isSelected}
                          title={isSelected ? `Retirer ${tpi.refTpi} de la sélection` : `Ajouter ${tpi.refTpi} à la sélection`}
                        >
                          <CheckIcon className='tpi-action-icon' />
                          <span className='sr-only'>
                            {isSelected ? `Retirer ${tpi.refTpi} de la sélection` : `Ajouter ${tpi.refTpi} à la sélection`}
                          </span>
                        </button>
                      </td>
                    ) : null}
                    <td>{tpi.refTpi}</td>
                    <td>
                      <StakeholderLink tpi={tpi} field={stakeholderFields.candidat} year={year}>
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
                      {!planningPerimeter.isPlanifiable ? (
                        <span
                          className='tpi-table-link-warning tpi-table-link-scope'
                          title={planningPerimeter.reason}
                        >
                          Hors planification
                        </span>
                      ) : null}
                      <Link
                        to={buildTpiDetailsLink(year, tpi.refTpi)}
                        className='tpi-card-icon-button tpi-table-open'
                        title={`Ouvrir la fiche ${tpi.refTpi}`}
                      >
                        <FileTextIcon className='tpi-action-icon' />
                        <span className='sr-only'>Ouvrir la fiche</span>
                      </Link>
                      <button
                        type='button'
                        className='tpi-card-icon-button tpi-table-edit'
                        onClick={() => handleEdit(tpi.refTpi)}
                        title={`Modifier ${tpi.refTpi}`}
                      >
                        <PencilIcon className='tpi-action-icon' />
                        <span className='sr-only'>Modifier la fiche</span>
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
