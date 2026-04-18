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

const MAX_PROPOSALS_PER_TPI = 3

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

function getModeSummary(state) {
  if (state?.mode === 'ok') {
    return 'OK prêt'
  }

  if (state?.mode === 'proposal') {
    const proposalCount = Array.isArray(state.selectedSlotIds) ? state.selectedSlotIds.length : 0
    if (proposalCount > 0) {
      return `${proposalCount}/${MAX_PROPOSALS_PER_TPI} propositions`
    }

    if (state.specialEnabled) {
      return 'Demande spéciale'
    }

    return 'Proposition en cours'
  }

  return 'Réponse à saisir'
}

function buildProposalContextSummary(group) {
  const candidateClass = compactText(group?.proposalContext?.candidateClassLabel || group?.tpi?.classe)
  const source = group?.proposalContext?.source

  if (!candidateClass && source !== 'planning_config') {
    return ''
  }

  if (source === 'planning_config' && candidateClass) {
    return `Créneaux filtrés selon la configuration ${candidateClass}.`
  }

  if (source === 'planning_config') {
    return 'Créneaux filtrés selon la configuration annuelle.'
  }

  if (candidateClass) {
    return `Classe ${candidateClass}.`
  }

  return ''
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

  const toggleProposalSlot = useCallback((tpiId, slotId) => {
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

      if (currentSelection.length >= MAX_PROPOSALS_PER_TPI) {
        setSubmitError(`Maximum ${MAX_PROPOSALS_PER_TPI} créneaux proposés par TPI.`)
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
      return {
        tpiId,
        summary: getModeSummary(responses[tpiId])
      }
    })
  }, [pendingVotes, responses])

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
          Votes en attente ({pendingVotes.length} TPI)
        </h2>
        <p className="panel-description">
          Pour chaque TPI, choisissez simplement <strong>OK</strong> si la date fixée convient,
          ou <strong>Proposition</strong> pour suggérer jusqu&apos;à 3 créneaux du planning,
          avec au besoin une demande spéciale libre.
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
          const state = responses[tpiId] || {
            mode: '',
            selectedSlotIds: [],
            specialEnabled: false,
            specialReason: '',
            specialDate: ''
          }
          const isExpanded = String(selectedTpi) === tpiId
          const summaryEntry = votingSummary.find((entry) => entry.tpiId === tpiId)

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
                  <span className="slots-count">
                    {proposalOptions.length} option{proposalOptions.length > 1 ? 's' : ''} de proposition
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
                      <p>Si elle convient, validez directement en OK.</p>
                    </div>
                    <span className="slot-group-badge pending">Réponse simple</span>
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
                          <span>{fixedSlot.slot?.startTime} - {fixedSlot.slot?.endTime}</span>
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
                      <span>La date fixée me convient.</span>
                    </button>
                    <button
                      type="button"
                      className={`vote-mode-card ${state.mode === 'proposal' ? 'active proposal' : ''}`}
                      onClick={() => setMode(tpiId, 'proposal')}
                    >
                      <strong>Proposition</strong>
                      <span>Je propose d&apos;autres créneaux ou une demande spéciale.</span>
                    </button>
                  </div>

                  {state.mode === 'proposal' && (
                    <>
                      <div className="slot-group-header alternative-group">
                        <div>
                          <h3>Créneaux à proposer</h3>
                          <p>
                            Choisissez jusqu&apos;à {MAX_PROPOSALS_PER_TPI} créneaux du planning.
                            Les propositions sélectionnées seront transmises à l&apos;administration.
                          </p>
                          {proposalContextSummary ? (
                            <p className="proposal-context-note">
                              {proposalContextSummary}
                            </p>
                          ) : null}
                        </div>
                        <span className="slot-group-badge alternatives">
                          {state.selectedSlotIds.length}/{MAX_PROPOSALS_PER_TPI} sélectionnés
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
                              onClick={() => toggleProposalSlot(tpiId, slotId)}
                            >
                              <div className="slot-card-head">
                                <span className="slot-card-label">
                                  {option.source === 'existing_vote' ? 'Déjà proposé' : 'Planning'}
                                </span>
                                <span className={`slot-state-chip ${isSelected ? 'preferred' : 'default'}`}>
                                  {isSelected ? 'Sélectionné' : 'Ajouter'}
                                </span>
                              </div>

                              <div className="slot-info">
                                <div className="slot-line slot-date">
                                  <CalendarIcon className="slot-icon" />
                                  <span>{formatSlotDate(option.slot)}</span>
                                </div>
                                <div className="slot-line slot-time">
                                  <TimeIcon className="slot-icon" />
                                  <span>{option.slot?.startTime} - {option.slot?.endTime}</span>
                                </div>
                                {option.slot?.room?.name ? (
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

                      <div className="special-request-box">
                        <div className="special-request-toggle-row">
                          <span className="special-request-toggle-label">Ajouter une demande spéciale</span>
                          <BinaryToggle
                            value={Boolean(state.specialEnabled)}
                            onChange={(nextValue) => toggleSpecialRequest(tpiId, nextValue)}
                            name={`special-request-${tpiId}`}
                            className="special-request-toggle"
                            ariaLabel="Ajouter une demande spéciale"
                            iconOnly
                            trueLabel="Demande spéciale activée"
                            falseLabel="Demande spéciale désactivée"
                            trueIcon={AlertIcon}
                            falseIcon={CloseIcon}
                          />
                        </div>
                        <p className="special-request-help">
                          Utilisez cette option si vous devez sortir des créneaux disponibles
                          et transmettre une contrainte précise à l&apos;administration.
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
                    </>
                  )}

                  <div className="card-footer">
                    <div className="card-footer-note">
                      {state.mode === 'ok'
                        ? 'La date fixée sera validée telle quelle.'
                        : state.mode === 'proposal'
                          ? 'La date fixée sera refusée et vos propositions seront enregistrées.'
                          : 'Choisissez une réponse avant de soumettre.'}
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
