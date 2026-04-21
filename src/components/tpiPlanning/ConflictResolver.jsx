import React, { useState, useCallback } from 'react'
import { tpiPlanningService } from '../../services/planningService'
import {
  AlertIcon,
  BanIcon,
  CalendarIcon,
  CandidateIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  DocumentIcon,
  ExpertIcon,
  ProjectLeadIcon,
  QuestionIcon,
  RoomIcon,
  TimeIcon,
  WrenchIcon
} from '../shared/InlineIcons'
import './ConflictResolver.css'

/**
 * Composant pour résoudre les conflits de planification
 * Permet l'intervention manuelle quand le vote automatique échoue
 */
const ConflictResolver = ({ conflicts, calendarData, onForceSlot, onReload }) => {
  const [selectedConflict, setSelectedConflict] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [reason, setReason] = useState('')
  const [isResolving, setIsResolving] = useState(false)
  const [resolveError, setResolveError] = useState(null)
  const [showAvailableSlots, setShowAvailableSlots] = useState(false)
  const [isResendingVotes, setIsResendingVotes] = useState(false)
  const [resendVotesError, setResendVotesError] = useState(null)

  /**
   * Analyse les votes d'un TPI pour identifier le type de conflit
   */
  const analyzeConflict = useCallback((tpi) => {
    const votes = tpi.votingSession?.votes || []
    const slots = tpi.proposedSlots || []

    // Compter les votes par créneau
    const slotVotes = {}
    slots.forEach(ps => {
      slotVotes[ps.slot?._id] = {
        slot: ps.slot,
        accepted: 0,
        rejected: 0,
        preferred: 0,
        pending: 0,
        voters: []
      }
    })

    votes.forEach(vote => {
      const slotId = vote.slot?.toString()
      if (slotVotes[slotId]) {
        slotVotes[slotId][vote.decision]++
        slotVotes[slotId].voters.push({
          name: vote.voterName,
          role: vote.voterRole,
          decision: vote.decision,
          comment: vote.comment
        })
      }
    })

    // Identifier le type de conflit
    let conflictType = 'unknown'
    let description = ''

    const hasUnanimous = Object.values(slotVotes).some(sv => sv.accepted + sv.preferred === 3)
    const allRejected = Object.values(slotVotes).every(sv => sv.rejected > 0)
    const hasPending = Object.values(slotVotes).some(sv => sv.pending > 0)

    if (hasPending) {
      conflictType = 'incomplete'
      description = 'Tous les votes n\'ont pas été reçus'
    } else if (allRejected) {
      conflictType = 'all_rejected'
      description = 'Tous les créneaux ont été rejetés par au moins une personne'
    } else if (!hasUnanimous) {
      conflictType = 'no_consensus'
      description = 'Aucun créneau n\'a obtenu l\'accord de tous les participants'
    }

    return {
      type: conflictType,
      description,
      slotVotes: Object.values(slotVotes)
    }
  }, [])

  /**
   * Résout le conflit en forçant un créneau
   */
  const handleResolve = useCallback(async () => {
    if (!selectedConflict || !selectedSlot || !reason.trim()) {
      setResolveError('Veuillez sélectionner un créneau et indiquer une raison')
      return
    }

    setIsResolving(true)
    setResolveError(null)

    try {
      await onForceSlot(selectedConflict._id, selectedSlot, reason)
      
      // Reset et fermer
      setSelectedConflict(null)
      setSelectedSlot(null)
      setReason('')
      
    } catch (error) {
      setResolveError('Erreur lors de la résolution du conflit')
      console.error(error)
    } finally {
      setIsResolving(false)
    }
  }, [selectedConflict, selectedSlot, reason, onForceSlot])

  /**
   * Renvoie les demandes de vote pour un TPI
   */
  const handleResendVotes = useCallback(async () => {
    if (!selectedConflict?._id) {
      setResendVotesError('Aucun TPI sélectionné')
      return
    }

    setIsResendingVotes(true)
    setResendVotesError(null)

    try {
      const data = await tpiPlanningService.resendVotes(selectedConflict._id)
      
      // Afficher un message de succès
      alert(`Demandes de vote renvoyées avec succès (${data.emailsSent} emails envoyés)`)
      
    } catch (error) {
      setResendVotesError('Erreur lors de l\'envoi des demandes de vote: ' + error.message)
      console.error(error)
    } finally {
      setIsResendingVotes(false)
    }
  }, [selectedConflict])

  /**
   * Récupère l'icône selon le type de conflit
   */
  const getConflictIcon = (type) => {
    const icons = {
      'incomplete': TimeIcon,
      'all_rejected': BanIcon,
      'no_consensus': AlertIcon,
      'unknown': QuestionIcon
    }
    return icons[type] || AlertIcon
  }

  /**
   * Récupère la couleur selon la décision
   */
  const getDecisionColor = (decision) => {
    const colors = {
      'accepted': '#4caf50',
      'preferred': '#2196f3',
      'rejected': '#f44336',
      'pending': '#ff9800'
    }
    return colors[decision] || '#9e9e9e'
  }

  if (conflicts.length === 0) {
    return (
      <div className="conflict-resolver empty">
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            <CheckIcon />
          </span>
          <h3>Aucun conflit à résoudre</h3>
          <p>Tous les TPI ont été planifiés avec succès ou sont en cours de vote.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="conflict-resolver">
      <div className="resolver-header">
        <h2>
          <span className="resolver-title-icon" aria-hidden="true">
            <AlertIcon />
          </span>
          Conflits à résoudre ({conflicts.length})
        </h2>
        <p className="resolver-description">
          Ces TPI nécessitent une intervention manuelle car le processus de vote 
          automatique n'a pas pu aboutir à un consensus.
        </p>
      </div>

      {resolveError && (
        <div className="alert alert-error">
          <span className="alert-copy">
            <AlertIcon className="alert-icon" />
            {resolveError}
          </span>
          <button onClick={() => setResolveError(null)}>×</button>
        </div>
      )}

      <div className="conflicts-grid">
        {conflicts.map(tpi => {
          const analysis = analyzeConflict(tpi)
          const isSelected = selectedConflict?._id === tpi._id
          const ConflictTypeIcon = getConflictIcon(analysis.type)

          return (
            <div 
              key={tpi._id} 
              className={`conflict-card ${isSelected ? 'selected' : ''}`}
            >
              <div 
                className="conflict-header"
                onClick={() => setSelectedConflict(isSelected ? null : tpi)}
              >
                <div className="conflict-info">
                  <span className="conflict-icon">
                    <ConflictTypeIcon />
                  </span>
                  <div className="conflict-title">
                    <span className="tpi-ref">{tpi.reference}</span>
                    <span className="conflict-type">{analysis.description}</span>
                  </div>
                </div>
                <div className="conflict-meta">
                    <span className="conflict-candidate">
                      <CandidateIcon className="conflict-candidate-icon" />
                      <span>{tpi.candidat?.firstName} {tpi.candidat?.lastName}</span>
                    </span>
                  <span className="expand-icon">
                    {isSelected ? <ChevronDownIcon /> : <ChevronRightIcon />}
                  </span>
                </div>
              </div>

              {isSelected && (
                <div className="conflict-content">
                  {/* Participants */}
                  <div className="participants-section">
                    <h4>
                      <span className="section-icon" aria-hidden="true">
                        <CandidateIcon />
                      </span>
                      Participants
                    </h4>
                    <div className="participants-list">
                      <div className="participant">
                        <span className="role">
                          <ExpertIcon className="participant-icon" />
                          Expert 1:
                        </span>
                        <span className="name">{tpi.expert1?.firstName} {tpi.expert1?.lastName}</span>
                      </div>
                      <div className="participant">
                        <span className="role">
                          <ExpertIcon className="participant-icon" />
                          Expert 2:
                        </span>
                        <span className="name">{tpi.expert2?.firstName} {tpi.expert2?.lastName}</span>
                      </div>
                      <div className="participant">
                        <span className="role">
                          <ProjectLeadIcon className="participant-icon" />
                          Chef de projet:
                        </span>
                        <span className="name">{tpi.chefProjet?.firstName} {tpi.chefProjet?.lastName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Résumé des votes par créneau */}
                  <div className="votes-summary-section">
                    <h4>
                      <span className="section-icon" aria-hidden="true">
                        <DocumentIcon />
                      </span>
                      Résumé des votes
                    </h4>
                    <div className="slots-votes-list">
                      {analysis.slotVotes.map((sv, idx) => (
                        <div 
                          key={idx} 
                          className={`slot-vote-summary ${selectedSlot === sv.slot?._id ? 'selected' : ''}`}
                          onClick={() => setSelectedSlot(sv.slot?._id)}
                        >
                          <div className="slot-info">
                            <span className="slot-date">
                              <CalendarIcon className="slot-meta-icon" />
                              {sv.slot?.date ? new Date(sv.slot.date).toLocaleDateString('fr-CH') : 'N/A'}
                            </span>
                            <span className="slot-time">{sv.slot?.startTime}</span>
                            <span className="slot-room">
                              <RoomIcon className="slot-meta-icon" />
                              {sv.slot?.room?.name}
                            </span>
                          </div>
                          
                          <div className="votes-bars">
                            {sv.preferred > 0 && (
                              <span className="vote-badge preferred">
                                <CheckIcon className="vote-badge-icon" />
                                {sv.preferred}
                              </span>
                            )}
                            {sv.accepted > 0 && (
                              <span className="vote-badge accepted">
                                <CheckIcon className="vote-badge-icon" />
                                {sv.accepted}
                              </span>
                            )}
                            {sv.rejected > 0 && (
                              <span className="vote-badge rejected">
                                <CloseIcon className="vote-badge-icon" />
                                {sv.rejected}
                              </span>
                            )}
                            {sv.pending > 0 && (
                              <span className="vote-badge pending">
                                <TimeIcon className="vote-badge-icon" />
                                {sv.pending}
                              </span>
                            )}
                          </div>

                          {/* Détails des votants */}
                          <div className="voters-details">
                            {sv.voters.map((voter, vidx) => (
                              <div 
                                key={vidx} 
                                className={`voter-detail ${voter.decision}`}
                                style={{ borderLeftColor: getDecisionColor(voter.decision) }}
                              >
                                <span className="voter-name">{voter.name}</span>
                                <span className="voter-role">({voter.role})</span>
                                {voter.comment && (
                                  <span className="voter-comment">"{voter.comment}"</span>
                                )}
                              </div>
                            ))}
                          </div>

                          {selectedSlot === sv.slot?._id && (
                            <div className="select-indicator">
                              <CheckIcon className="select-indicator-icon" />
                              Sélectionné
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section de résolution */}
                  <div className="resolution-section">
                    <h4>Résolution manuelle</h4>
                    
                    {selectedSlot ? (
                      <div className="resolution-form">
                        <div className="selected-slot-preview">
                          <span>Créneau sélectionné pour forcer l'attribution</span>
                        </div>
                        
                        <div className="form-group">
                          <label>Raison de l'intervention manuelle *</label>
                          <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Expliquez pourquoi vous forcez cette attribution (ex: accord téléphonique, contrainte externe, etc.)"
                            rows={3}
                          />
                        </div>

                        <div className="resolution-actions">
                          <button
                            className="btn-cancel"
                            onClick={() => {
                              setSelectedSlot(null)
                              setReason('')
                            }}
                          >
                            Annuler
                          </button>
                          <button
                            className="btn-resolve"
                            onClick={handleResolve}
                            disabled={isResolving || !reason.trim()}
                          >
                            {isResolving ? (
                              <>
                                <span className="spinner-small"></span>
                                Résolution en cours...
                              </>
                            ) : (
                              <>
                                <WrenchIcon className="button-icon" />
                                Forcer l'attribution
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="select-slot-prompt">
                        <p>Cliquez sur un créneau ci-dessus pour le sélectionner et forcer l'attribution</p>
                      </div>
                    )}
                  </div>

                  {/* Actions alternatives */}
                  <div className="alternative-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => setShowAvailableSlots(!showAvailableSlots)}
                    >
                      <CalendarIcon className="button-icon" />
                      {showAvailableSlots ? 'Masquer' : 'Voir'} autres créneaux disponibles
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={handleResendVotes}
                      disabled={isResendingVotes || !selectedConflict?._id}
                    >
                      {isResendingVotes ? (
                        <>
                          <span className="spinner-small"></span>
                          Envoi en cours...
                        </>
                      ) : (
                        <>Renvoyer les demandes de vote</>
                      )}
                    </button>
                    {resendVotesError && (
                      <div className="error-message">{resendVotesError}</div>
                    )}
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

export default ConflictResolver
