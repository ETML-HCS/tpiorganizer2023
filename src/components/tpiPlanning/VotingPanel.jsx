import React, { useCallback, useMemo, useState } from 'react'
import { voteService } from '../../services/planningService'
import BinaryToggle from '../shared/BinaryToggle'
import {
  AlertIcon,
  CalendarIcon,
  CandidateIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  RoomIcon,
  SendIcon,
  TimeIcon
} from '../shared/InlineIcons'
import './VotingPanel.css'

const DEFAULT_MAX_PROPOSALS_PER_TPI = 3

function normalizeVoteSettings(group = {}) {
  const source = group?.voteSettings && typeof group.voteSettings === 'object'
    ? group.voteSettings
    : {}
  const rawMax = source.maxProposalsPerTpi ?? source.maxVoteProposals
  const maxProposals = Number.parseInt(String(rawMax), 10)

  return {
    maxProposalsPerTpi: Number.isInteger(maxProposals) && maxProposals > 0
      ? maxProposals
      : DEFAULT_MAX_PROPOSALS_PER_TPI,
    allowSpecialRequest: source.allowSpecialRequest !== false && source.allowSpecialVoteRequest !== false
  }
}

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function formatCandidateName(candidate) {
  if (!candidate) {
    return ''
  }

  if (typeof candidate === 'object') {
    return [candidate.firstName, candidate.lastName, candidate.name]
      .filter(Boolean)
      .join(' ')
      .trim()
  }

  return compactText(candidate)
}

function formatSlotDate(slot) {
  const date = new Date(slot?.date)
  if (Number.isNaN(date.getTime())) {
    return 'Date inconnue'
  }

  return date.toLocaleDateString('fr-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

function parseTimeToMinutes(value) {
  const match = compactText(value).match(/^(\d{1,2})(?::(\d{2}))?$/)

  if (!match) {
    return null
  }

  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2] || '0', 10)

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes < 0 || minutes >= 60) {
    return null
  }

  return (hours * 60) + minutes
}

function formatTime(value) {
  const minutes = parseTimeToMinutes(value)
  if (minutes === null) {
    return compactText(value)
  }

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function buildSlotTimeDisplay(slot, option = null) {
  const display = option?.display || slot?.display || {}
  const periodLabel = compactText(display.periodLabel)
  const timeRangeLabel = compactText(display.timeRangeLabel)
  const exactTimeLabel = compactText(display.exactTimeLabel)
  const shouldShowExactTime = option
    ? display.showExactTime === true
    : display.showExactTime !== false

  if (periodLabel && timeRangeLabel) {
    const tooltip = [
      `${periodLabel}: ${timeRangeLabel}`,
      exactTimeLabel ? `Créneau représentatif: ${exactTimeLabel}` : ''
    ].filter(Boolean).join('\n')

    return {
      primary: option?.display?.isGroupedWindow ? periodLabel : `${periodLabel} (${timeRangeLabel})`,
      secondary: shouldShowExactTime && exactTimeLabel ? `Créneau indicatif ${exactTimeLabel}` : '',
      tooltip
    }
  }

  const startTime = formatTime(slot?.startTime)
  const endTime = formatTime(slot?.endTime)
  const startMinutes = parseTimeToMinutes(slot?.startTime)
  const isMorning = startMinutes === null || startMinutes < (12 * 60)

  return {
    primary: isMorning ? 'Matin (08:00 - 12:00)' : 'Après-midi (13:00 - fin de journée)',
    secondary: !option && startTime && endTime ? `Créneau indicatif ${startTime} - ${endTime}` : '',
    tooltip: startTime && endTime ? `${startTime} - ${endTime}` : ''
  }
}

function createDefaultResponseState() {
  return {
    mode: '',
    selectedSlotIds: [],
    specialEnabled: false,
    specialReason: '',
    specialDate: ''
  }
}

function normalizeProposalOptions(group) {
  if (Array.isArray(group?.proposalOptions) && group.proposalOptions.length > 0) {
    return group.proposalOptions
  }

  return (group?.slots || [])
    .slice(1)
    .map((entry) => ({
      slotId: entry?.slot?._id ? String(entry.slot._id) : '',
      voteId: entry?.voteId ? String(entry.voteId) : null,
      slot: entry?.slot || null,
      source: 'existing_vote',
      score: null,
      reason: ''
    }))
    .filter((entry) => entry.slotId)
}

function getModeSummary(state, maxProposals = DEFAULT_MAX_PROPOSALS_PER_TPI) {
  if (state?.mode === 'ok') {
    return 'OK prêt'
  }

  if (state?.mode === 'proposal') {
    const proposalCount = Array.isArray(state.selectedSlotIds) ? state.selectedSlotIds.length : 0
    if (proposalCount > 0) {
      return `${proposalCount}/${maxProposals} propositions`
    }

    if (state.specialEnabled) {
    return 'Demande spéciale'
    }

    return 'Proposition'
  }

  return 'Réponse à saisir'
}

function getQueueBadgeLabel(option, isSelected) {
  const queueCount = Number(option?.queue?.count)
  if (!Number.isFinite(queueCount) || queueCount < 0) {
    return ''
  }

  const normalizedCount = Math.floor(queueCount)
  const capacity = Number(option?.queue?.capacity)
  const capacitySuffix = Number.isFinite(capacity) && capacity > 0
    ? `/${Math.floor(capacity)}`
    : ''

  if (isSelected) {
    return `n°${normalizedCount + 1}${capacitySuffix}`
  }

  return `${normalizedCount}${capacitySuffix}`
}

function getQueueBadgeTitle(option, isSelected) {
  const queueCount = Number(option?.queue?.count)
  if (!Number.isFinite(queueCount) || queueCount < 0) {
    return ''
  }

  const normalizedCount = Math.floor(queueCount)
  const capacity = Number(option?.queue?.capacity)
  const capacityLabel = Number.isFinite(capacity) && capacity > 0
    ? ` sur ${Math.floor(capacity)} places indicatives`
    : ''

  if (isSelected) {
    return `Avec votre proposition, vous seriez le vote favorable n°${normalizedCount + 1}${capacityLabel} sur cette demi-journée.`
  }

  return `${normalizedCount} vote${normalizedCount > 1 ? 's' : ''} favorable${normalizedCount > 1 ? 's' : ''}${capacityLabel} sur cette demi-journée.`
}

function getProposalCardLabel(option) {
  if (option?.display?.isGroupedWindow) {
    return '½ journée'
  }

  return option?.source === 'existing_vote' ? 'Déjà proposé' : 'Planning'
}

function getProposalCardTitle(option, isSelected) {
  const timeDisplay = buildSlotTimeDisplay(option?.slot, option)
  const parts = [
    formatSlotDate(option?.slot),
    timeDisplay.tooltip || timeDisplay.primary,
    option?.slot?.room?.name && !option?.display?.isGroupedWindow ? `Salle ${option.slot.room.name}` : '',
    getQueueBadgeTitle(option, isSelected),
    isSelected ? 'Cliquez pour retirer cette proposition.' : 'Cliquez pour proposer cette demi-journée.'
  ]

  return parts.filter(Boolean).join('\n')
}

function buildProposalContextSummary(group) {
  const candidateClass = compactText(group?.proposalContext?.candidateClassLabel || group?.tpi?.classe)
  const source = group?.proposalContext?.source

  if (!candidateClass && source !== 'planning_config') {
    return ''
  }

  if (source === 'planning_config' && candidateClass) {
    return `Filtre ${candidateClass}`
  }

  if (source === 'planning_config') {
    return 'Filtre annuel'
  }

  if (candidateClass) {
    return `Classe ${candidateClass}.`
  }

  return ''
}

function buildProposalContextTitle(group) {
  const candidateClass = compactText(group?.proposalContext?.candidateClassLabel || group?.tpi?.classe)
  const source = group?.proposalContext?.source

  if (source === 'planning_config' && candidateClass) {
    return `Créneaux filtrés selon la configuration ${candidateClass}.`
  }

  if (source === 'planning_config') {
    return 'Créneaux filtrés selon la configuration annuelle.'
  }

  return candidateClass ? `Classe ${candidateClass}.` : ''
}

const SlotTimeDisplay = ({ slot, option = null }) => {
  const timeDisplay = buildSlotTimeDisplay(slot, option)

  return (
    <span
      className={timeDisplay.tooltip ? 'hover-detail' : undefined}
      data-tooltip={timeDisplay.tooltip || undefined}
      title={timeDisplay.tooltip || undefined}
    >
      {timeDisplay.primary}
      {timeDisplay.secondary ? (
        <small className="slot-time-detail">
          {timeDisplay.secondary}
        </small>
      ) : null}
    </span>
  )
}

const VotingPanel = ({ pendingVotes, onVoteSubmitted }) => {
  const [selectedTpi, setSelectedTpi] = useState(null)
  const [responses, setResponses] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(null)

  const updateResponseState = useCallback((tpiId, updater) => {
    const key = String(tpiId)
    setResponses((prev) => {
      const currentState = prev[key] || createDefaultResponseState()

      const nextState = typeof updater === 'function'
        ? updater(currentState)
        : { ...currentState, ...updater }

      return {
        ...prev,
        [key]: nextState
      }
    })
  }, [])

  const setMode = useCallback((tpiId, mode) => {
    updateResponseState(tpiId, (currentState) => ({
      ...currentState,
      mode,
      selectedSlotIds: mode === 'ok' ? [] : currentState.selectedSlotIds || [],
      specialEnabled: mode === 'ok' ? false : currentState.specialEnabled || false,
      specialReason: mode === 'ok' ? '' : currentState.specialReason || '',
      specialDate: mode === 'ok' ? '' : currentState.specialDate || ''
    }))
    setSubmitError(null)
  }, [updateResponseState])

  const toggleProposalSlot = useCallback((tpiId, slotId, maxProposals = DEFAULT_MAX_PROPOSALS_PER_TPI) => {
    updateResponseState(tpiId, (currentState) => {
      const currentSelection = Array.isArray(currentState.selectedSlotIds)
        ? currentState.selectedSlotIds
        : []
      const isSelected = currentSelection.includes(slotId)

      if (isSelected) {
        setSubmitError(null)
        return {
          ...currentState,
          selectedSlotIds: currentSelection.filter((currentId) => currentId !== slotId)
        }
      }

      if (currentSelection.length >= maxProposals) {
        setSubmitError(`Maximum ${maxProposals} créneau${maxProposals > 1 ? 'x' : ''} proposé${maxProposals > 1 ? 's' : ''} par TPI.`)
        return currentState
      }

      setSubmitError(null)
      return {
        ...currentState,
        selectedSlotIds: [...currentSelection, slotId]
      }
    })
  }, [updateResponseState])

  const toggleSpecialRequest = useCallback((tpiId, enabled) => {
    updateResponseState(tpiId, (currentState) => ({
      ...currentState,
      specialEnabled: enabled,
      specialReason: enabled ? currentState.specialReason || '' : '',
      specialDate: enabled ? currentState.specialDate || '' : ''
    }))
    setSubmitError(null)
  }, [updateResponseState])

  const updateSpecialField = useCallback((tpiId, field, value) => {
    updateResponseState(tpiId, { [field]: value })
    setSubmitError(null)
  }, [updateResponseState])

  const handleSubmitVote = useCallback(async (group) => {
    const tpiId = String(group?.tpi?._id || '')
    const state = responses[tpiId] || createDefaultResponseState()
    const voteSettings = normalizeVoteSettings(group)
    const fixedVoteId = group?.fixedVoteId
      || (group?.fixedSlot?.voteId ? String(group.fixedSlot.voteId) : '')

    if (!tpiId || !fixedVoteId) {
      setSubmitError('Impossible d’identifier la date fixée pour ce vote.')
      return
    }

    if (!state.mode) {
      setSubmitError('Choisissez d’abord OK ou Proposition.')
      return
    }

    if (state.mode === 'proposal' && state.selectedSlotIds.length === 0 && !state.specialEnabled) {
      setSubmitError('Ajoutez au moins un créneau ou activez la demande spéciale.')
      return
    }

    if (state.mode === 'proposal' && state.selectedSlotIds.length > voteSettings.maxProposalsPerTpi) {
      setSubmitError(`Maximum ${voteSettings.maxProposalsPerTpi} créneau${voteSettings.maxProposalsPerTpi > 1 ? 'x' : ''} proposé${voteSettings.maxProposalsPerTpi > 1 ? 's' : ''} par TPI.`)
      return
    }

    if (state.specialEnabled && !voteSettings.allowSpecialRequest) {
      setSubmitError('La demande spéciale est désactivée pour cette année.')
      return
    }

    if (state.specialEnabled && (!compactText(state.specialReason) || !compactText(state.specialDate))) {
      setSubmitError('La demande spéciale nécessite une date et une raison.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(null)

    try {
      await voteService.respondToVote(tpiId, {
        fixedVoteId,
        mode: state.mode,
        proposedSlotIds: state.mode === 'proposal' ? state.selectedSlotIds : [],
        specialRequest: state.specialEnabled
          ? {
              reason: state.specialReason,
              requestedDate: state.specialDate
            }
          : null
      })

      setSubmitSuccess(
        state.mode === 'ok'
          ? 'Vote enregistré: date fixée validée.'
          : 'Vote enregistré: proposition transmise.'
      )

      setTimeout(() => {
        onVoteSubmitted()
        setSelectedTpi(null)
        setResponses({})
        setSubmitSuccess(null)
      }, 1400)
    } catch (error) {
      setSubmitError(error?.data?.error || error?.message || 'Erreur lors de la soumission du vote.')
    } finally {
      setIsSubmitting(false)
    }
  }, [onVoteSubmitted, responses])

  const votingSummary = useMemo(() => {
    return pendingVotes.map((group) => {
      const tpiId = String(group?.tpi?._id || '')
      const voteSettings = normalizeVoteSettings(group)
      return {
        tpiId,
        summary: getModeSummary(responses[tpiId], voteSettings.maxProposalsPerTpi)
      }
    })
  }, [pendingVotes, responses])

  const headerVoteSettings = normalizeVoteSettings(pendingVotes[0])

  if (pendingVotes.length === 0) {
    return (
      <div className="voting-panel empty">
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            <CheckIcon />
          </span>
          <h3>Aucun vote en attente</h3>
          <p>Vous n&apos;avez pas de créneau à valider pour le moment.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="voting-panel">
      <div className="panel-header">
        <h2>
          <span className="panel-title-icon" aria-hidden="true">
            <CalendarIcon />
          </span>
          Votes ({pendingVotes.length})
        </h2>
        <p
          className="panel-description hover-detail"
          data-tooltip={`Pour chaque TPI, choisissez OK si la date fixée convient, ou Proposition pour suggérer jusqu'à ${headerVoteSettings.maxProposalsPerTpi} demi-journées${headerVoteSettings.allowSpecialRequest ? ' avec une demande spéciale si nécessaire' : ''}.`}
          title={`Pour chaque TPI, choisissez OK si la date fixée convient, ou Proposition pour suggérer jusqu'à ${headerVoteSettings.maxProposalsPerTpi} demi-journées${headerVoteSettings.allowSpecialRequest ? ' avec une demande spéciale si nécessaire' : ''}.`}
        >
          <strong>OK</strong> ou <strong>Proposition</strong>.
        </p>
      </div>

      {submitError && (
        <div className="alert alert-error">
          <span className="alert-copy">
            <AlertIcon className="alert-icon" />
            {submitError}
          </span>
          <button onClick={() => setSubmitError(null)}>×</button>
        </div>
      )}

      {submitSuccess && (
        <div className="alert alert-success">
          <span className="alert-copy">
            <CheckIcon className="alert-icon" />
            {submitSuccess}
          </span>
        </div>
      )}

      <div className="voting-list">
        {pendingVotes.map((group) => {
          const tpi = group.tpi || {}
          const tpiId = String(tpi._id || '')
          const fixedSlot = group.fixedSlot || group.slots?.[0] || null
          const proposalOptions = normalizeProposalOptions(group)
          const proposalContextSummary = buildProposalContextSummary(group)
          const proposalContextTitle = buildProposalContextTitle(group)
          const voteSettings = normalizeVoteSettings(group)
          const state = responses[tpiId] || {
            mode: '',
            selectedSlotIds: [],
            specialEnabled: false,
            specialReason: '',
            specialDate: ''
          }
          const isExpanded = String(selectedTpi) === tpiId
          const summaryEntry = votingSummary.find((entry) => entry.tpiId === tpiId)
          const proposalCountLabel = `${proposalOptions.length} option${proposalOptions.length > 1 ? 's' : ''}`

          return (
            <div
              key={tpiId}
              className={`voting-card ${isExpanded ? 'expanded' : ''}`}
            >
              <div
                className="card-header"
                onClick={() => setSelectedTpi((prev) => prev === tpiId ? null : tpiId)}
              >
                <div className="tpi-info">
                  <span className="tpi-role-icon" aria-hidden="true">
                    <CandidateIcon />
                  </span>
                  <span className="tpi-ref">{compactText(tpi.reference) || 'TPI'}</span>
                  <span className="tpi-candidat">{formatCandidateName(tpi.candidat)}</span>
                </div>

                <div className="voting-meta">
                  <span
                    className="slots-count hover-detail"
                    data-tooltip={`${proposalCountLabel} de proposition disponible${proposalOptions.length > 1 ? 's' : ''} pour ce TPI.`}
                    title={`${proposalCountLabel} de proposition disponible${proposalOptions.length > 1 ? 's' : ''} pour ce TPI.`}
                  >
                    {proposalCountLabel}
                  </span>
                  <span className={`preferred-count ${state.mode ? 'full' : ''}`}>
                    {summaryEntry?.summary || 'Réponse à saisir'}
                  </span>
                  <span className="expand-icon">
                    {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="card-content">
                  <div className="slot-group-header">
                    <div>
                      <h3>Date fixée</h3>
                      <p title="Si cette date convient, validez directement avec OK.">Validez si OK.</p>
                    </div>
                    <span
                      className="slot-group-badge pending hover-detail"
                      data-tooltip="Réponse simple: la date fixée est acceptée telle quelle."
                      title="Réponse simple: la date fixée est acceptée telle quelle."
                    >
                      OK
                    </span>
                  </div>

                  {fixedSlot ? (
                    <div className="slot-vote-card fixed-slot">
                      <div className="slot-info">
                        <div className="slot-line slot-date">
                          <CalendarIcon className="slot-icon" />
                          <span>{formatSlotDate(fixedSlot.slot)}</span>
                        </div>
                        <div className="slot-line slot-time">
                          <TimeIcon className="slot-icon" />
                          <SlotTimeDisplay slot={fixedSlot.slot} />
                        </div>
                        {fixedSlot.slot?.room?.name ? (
                          <div className="slot-line slot-room">
                            <RoomIcon className="slot-icon" />
                            <span>{fixedSlot.slot.room.name}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="empty-slot-state">
                      Aucune date fixée disponible pour ce TPI.
                    </div>
                  )}

                  <div className="vote-mode-grid">
                    <button
                      type="button"
                      className={`vote-mode-card ${state.mode === 'ok' ? 'active ok' : ''}`}
                      onClick={() => setMode(tpiId, 'ok')}
                    >
                      <strong>OK</strong>
                      <span title="La date fixée me convient.">Me convient.</span>
                    </button>
                    <button
                      type="button"
                      className={`vote-mode-card ${state.mode === 'proposal' ? 'active proposal' : ''}`}
                      onClick={() => setMode(tpiId, 'proposal')}
                    >
                      <strong>Proposer</strong>
                      <span title="Je propose d'autres demi-journées ou une demande spéciale.">Autre choix.</span>
                    </button>
                  </div>

                  {state.mode === 'proposal' && (
                    <>
                      <div className="slot-group-header alternative-group">
                        <div>
                          <h3>Propositions</h3>
                          <p title={`Choisissez jusqu'à ${voteSettings.maxProposalsPerTpi} demi-journées. Les propositions sélectionnées seront transmises à l'administration.`}>
                            Max {voteSettings.maxProposalsPerTpi} demi-journées.
                          </p>
                          {proposalContextSummary ? (
                            <p
                              className="proposal-context-note hover-detail"
                              data-tooltip={proposalContextTitle || undefined}
                              title={proposalContextTitle || undefined}
                            >
                              {proposalContextSummary}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className="slot-group-badge alternatives hover-detail"
                          data-tooltip={`${state.selectedSlotIds.length} proposition${state.selectedSlotIds.length > 1 ? 's' : ''} sélectionnée${state.selectedSlotIds.length > 1 ? 's' : ''} sur ${voteSettings.maxProposalsPerTpi} possibles.`}
                          title={`${state.selectedSlotIds.length} proposition${state.selectedSlotIds.length > 1 ? 's' : ''} sélectionnée${state.selectedSlotIds.length > 1 ? 's' : ''} sur ${voteSettings.maxProposalsPerTpi} possibles.`}
                        >
                          {state.selectedSlotIds.length}/{voteSettings.maxProposalsPerTpi}
                        </span>
                      </div>

                      <div className="alternatives-grid">
                        {proposalOptions.length > 0 ? proposalOptions.map((option, index) => {
                          const slotId = String(option.slotId || '')
                          const isSelected = state.selectedSlotIds.includes(slotId)

                          return (
                            <button
                              type="button"
                              key={slotId || `${tpiId}-${index}`}
                              className={`slot-vote-card alternative proposal-select-card ${isSelected ? 'preferred' : ''}`}
                              onClick={() => toggleProposalSlot(tpiId, slotId, voteSettings.maxProposalsPerTpi)}
                              title={getProposalCardTitle(option, isSelected)}
                            >
                              <div className="slot-card-head">
                                <span
                                  className="slot-card-label hover-detail"
                                  data-tooltip={getProposalCardTitle(option, isSelected)}
                                  title={getProposalCardTitle(option, isSelected)}
                                >
                                  {getProposalCardLabel(option)}
                                </span>
                                {getQueueBadgeLabel(option, isSelected) ? (
                                  <span
                                    className="slot-queue-chip hover-detail"
                                    data-tooltip={getQueueBadgeTitle(option, isSelected)}
                                    title={getQueueBadgeTitle(option, isSelected)}
                                  >
                                    {getQueueBadgeLabel(option, isSelected)}
                                  </span>
                                ) : null}
                                <span
                                  className={`slot-state-chip ${isSelected ? 'preferred' : 'default'} hover-detail`}
                                  data-tooltip={isSelected ? 'Cliquez pour retirer cette proposition.' : 'Cliquez pour ajouter cette demi-journée.'}
                                  title={isSelected ? 'Cliquez pour retirer cette proposition.' : 'Cliquez pour ajouter cette demi-journée.'}
                                >
                                  {isSelected ? 'Pris' : '+'}
                                </span>
                              </div>

                              <div className="slot-info">
                                <div className="slot-line slot-date">
                                  <CalendarIcon className="slot-icon" />
                                  <span>{formatSlotDate(option.slot)}</span>
                                </div>
                                <div className="slot-line slot-time">
                                  <TimeIcon className="slot-icon" />
                                  <SlotTimeDisplay slot={option.slot} option={option} />
                                </div>
                                {option.slot?.room?.name && !option.display?.isGroupedWindow ? (
                                  <div className="slot-line slot-room">
                                    <RoomIcon className="slot-icon" />
                                    <span>{option.slot.room.name}</span>
                                  </div>
                                ) : null}
                              </div>
                            </button>
                          )
                        }) : (
                          <div className="empty-slot-state">
                            Aucun autre créneau compatible n&apos;est disponible pour le moment.
                          </div>
                        )}
                      </div>

                      {voteSettings.allowSpecialRequest ? (
                        <div className="special-request-box">
                          <div className="special-request-toggle-row">
                            <span
                              className="special-request-toggle-label hover-detail"
                              data-tooltip="Activez cette option si aucune demi-journée ne convient ou si vous avez une contrainte précise."
                              title="Activez cette option si aucune demi-journée ne convient ou si vous avez une contrainte précise."
                            >
                              Demande spéciale
                            </span>
                            <BinaryToggle
                              value={Boolean(state.specialEnabled)}
                              onChange={(nextValue) => toggleSpecialRequest(tpiId, nextValue)}
                              name={`special-request-${tpiId}`}
                              className="special-request-toggle"
                              ariaLabel="Activation de la demande spéciale"
                              iconOnly
                              trueLabel="Ajouter une demande spéciale"
                              falseLabel="Ne pas ajouter de demande spéciale"
                              trueIcon={AlertIcon}
                              falseIcon={CloseIcon}
                            />
                          </div>
                          <p
                            className="special-request-help hover-detail"
                            data-tooltip="Utilisez cette option si vous devez sortir des créneaux disponibles et transmettre une contrainte précise à l'administration."
                            title="Utilisez cette option si vous devez sortir des créneaux disponibles et transmettre une contrainte précise à l'administration."
                          >
                            Hors planning ou contrainte.
                          </p>

                          {state.specialEnabled && (
                            <div className="special-request-fields">
                              <label className="special-request-field">
                                <span>Date demandée</span>
                                <input
                                  type="date"
                                  value={state.specialDate}
                                  onChange={(event) => updateSpecialField(tpiId, 'specialDate', event.target.value)}
                                />
                              </label>
                              <label className="special-request-field special-request-field-wide">
                                <span>Raison / contexte</span>
                                <textarea
                                  rows={3}
                                  value={state.specialReason}
                                  onChange={(event) => updateSpecialField(tpiId, 'specialReason', event.target.value)}
                                  placeholder="Expliquez la contrainte, le contexte ou la demande particulière..."
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </>
                  )}

                  <div className="card-footer">
                    <div className="card-footer-note">
                      {state.mode === 'ok'
                        ? 'Date validée.'
                        : state.mode === 'proposal'
                          ? 'Propositions envoyées.'
                          : 'Choisissez OK ou Proposition.'}
                    </div>
                    <button
                      className="btn-submit-votes"
                      onClick={() => handleSubmitVote(group)}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="spinner-small"></span>
                          Envoi en cours...
                        </>
                      ) : (
                        <>
                          <SendIcon className="button-icon" />
                          Envoyer ma réponse
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default VotingPanel
