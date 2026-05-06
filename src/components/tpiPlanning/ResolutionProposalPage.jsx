import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { resolutionProposalService } from '../../services/coordinationService'
import {
  AlertIcon,
  CalendarIcon,
  CheckIcon,
  CloseIcon,
  FileTextIcon,
  MailIcon,
  SendIcon,
  UserIcon
} from '../shared/InlineIcons'
import { getTpiRelationRoleLabel } from '../../utils/stakeholderRules'
import './ResolutionProposalPage.css'

const CANDIDATE_ROLE_LABEL = getTpiRelationRoleLabel('candidat')

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function getStatusLabel(status) {
  if (status === 'accepted') {
    return 'Accord transmis'
  }

  if (status === 'rejected') {
    return 'Refus transmis'
  }

  if (status === 'expired') {
    return 'Proposition expirée'
  }

  if (status === 'failed') {
    return 'Envoi échoué'
  }

  if (status === 'cancelled') {
    return 'Proposition annulée'
  }

  if (status === 'partial') {
    return 'Réponses partielles'
  }

  return 'Réponse attendue'
}

function getRecipientStatusLabel(status) {
  if (status === 'accepted') {
    return 'Accord déjà transmis'
  }

  if (status === 'rejected') {
    return 'Refus déjà transmis'
  }

  return 'Réponse attendue'
}

function formatDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

const ResolutionProposalPage = ({ year: routeYear }) => {
  const params = useParams()
  const token = compactText(params.token)
  const displayYear = routeYear || params.year || ''
  const [proposal, setProposal] = useState(null)
  const [decision, setDecision] = useState('accepted')
  const [reason, setReason] = useState('')
  const [alternativeProposal, setAlternativeProposal] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const loadProposal = useCallback(async () => {
    if (!token) {
      setError('Lien de proposition incomplet.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const result = await resolutionProposalService.getPublic(token)
      setProposal(result)
      const currentStatus = compactText(result?.recipient?.responseStatus)
      if (currentStatus === 'accepted' || currentStatus === 'rejected') {
        setDecision(currentStatus)
        setReason(compactText(result?.recipient?.responseReason))
        setAlternativeProposal(compactText(result?.recipient?.alternativeProposal))
      }
    } catch (err) {
      setError(err?.message || 'Proposition indisponible.')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadProposal()
  }, [loadProposal])

  const isReadOnly = useMemo(() => {
    const proposalStatus = compactText(proposal?.status)
    const recipientStatus = compactText(proposal?.recipient?.responseStatus)

    return submitted ||
      proposalStatus === 'expired' ||
      proposalStatus === 'cancelled' ||
      proposalStatus === 'failed' ||
      recipientStatus === 'accepted' ||
      recipientStatus === 'rejected'
  }, [proposal, submitted])

  const slotLabel = compactText(proposal?.proposedSlotLabel) ||
    compactText(proposal?.proposedSlot?.label) ||
    'Créneau proposé'
  const deadlineLabel = formatDate(proposal?.expiresAt)
  const recipientRoleLabel = compactText(proposal?.recipient?.roleLabel) || 'Partie prenante'
  const recipientName = compactText(proposal?.recipient?.name)
  const readOnlyState = (() => {
    const proposalStatus = compactText(proposal?.status)

    if (proposalStatus === 'expired') {
      return {
        tone: 'error',
        message: 'Cette proposition est expirée.'
      }
    }

    if (proposalStatus === 'cancelled') {
      return {
        tone: 'error',
        message: 'Cette proposition n’est plus active.'
      }
    }

    if (proposalStatus === 'failed') {
      return {
        tone: 'error',
        message: 'Cette proposition doit être renvoyée par l’administration.'
      }
    }

    return {
      tone: 'success',
      message: 'Réponse enregistrée. La coordination peut maintenant traiter ce retour.'
    }
  })()

  const handleSubmit = async (event) => {
    event.preventDefault()
    const normalizedDecision = decision === 'rejected' ? 'rejected' : 'accepted'

    if (normalizedDecision === 'rejected' && !compactText(reason)) {
      setError('Une raison est requise en cas de refus.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const result = await resolutionProposalService.respondPublic(token, {
        decision: normalizedDecision,
        reason,
        alternativeProposal
      })
      const nextProposal = result?.proposal || result
      setProposal(nextProposal)
      setSubmitted(true)
      toast.success('Réponse transmise.')
    } catch (err) {
      setError(err?.message || 'Réponse impossible.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="resolution-proposal-page">
      <section className="resolution-proposal-shell" aria-label="Proposition d'arbitrage">
        <header className="resolution-proposal-header">
          <div className="resolution-proposal-heading">
            <span className="resolution-proposal-kicker">
              <MailIcon className="inline-icon" />
              Arbitrage{displayYear ? ` ${displayYear}` : ''}
            </span>
            <div>
              <h1>{proposal?.tpiReference || 'TPI'}</h1>
              <p>{proposal?.candidateName || `${CANDIDATE_ROLE_LABEL} non renseigné`}</p>
            </div>
          </div>
          {proposal ? (
            <div className="resolution-proposal-status-block" aria-label="État de la proposition">
              <span className="resolution-proposal-status-label">État</span>
              <span className={`resolution-proposal-status is-${proposal.status || 'sent'}`}>
                {getStatusLabel(proposal.status)}
              </span>
            </div>
          ) : null}
        </header>

        {isLoading ? (
          <div className="resolution-proposal-state">
            Chargement de la proposition...
          </div>
        ) : error && !proposal ? (
          <div className="resolution-proposal-state is-error">
            <AlertIcon className="inline-icon" />
            {error}
          </div>
        ) : proposal ? (
          <form className="resolution-proposal-form" onSubmit={handleSubmit}>
            <section className="resolution-proposal-summary" aria-label="Résumé de la proposition">
              <div className="resolution-proposal-section-title">
                <span className="resolution-proposal-section-icon">
                  <CalendarIcon className="inline-icon" />
                </span>
                <div>
                  <h2>Créneau proposé</h2>
                  <p>Décision attendue pour débloquer la planification.</p>
                </div>
              </div>

              <div className="resolution-proposal-slot">
                <strong>{slotLabel}</strong>
                {deadlineLabel ? <span>Réponse attendue avant le {deadlineLabel}</span> : null}
              </div>

              <div className="resolution-proposal-section-title is-compact">
                <span className="resolution-proposal-section-icon">
                  <FileTextIcon className="inline-icon" />
                </span>
                <h2>Dossier</h2>
              </div>

              <dl className="resolution-proposal-facts">
                <div>
                  <dt>Sujet</dt>
                  <dd>{proposal.subject || 'Non renseigné'}</dd>
                </div>
                <div>
                  <dt>Destinataire</dt>
                  <dd>{recipientName ? `${recipientRoleLabel} · ${recipientName}` : recipientRoleLabel}</dd>
                </div>
                <div>
                  <dt>Statut</dt>
                  <dd>{getRecipientStatusLabel(proposal.recipient?.responseStatus)}</dd>
                </div>
              </dl>

              {proposal.message ? (
                <div className="resolution-proposal-message">
                  <h2>Message</h2>
                  <p>{proposal.message}</p>
                </div>
              ) : null}
            </section>

            <section className="resolution-proposal-response">
              <div className="resolution-proposal-section-title">
                <span className="resolution-proposal-section-icon">
                  <UserIcon className="inline-icon" />
                </span>
                <div>
                  <h2>Votre réponse</h2>
                  <p>{recipientName ? `${recipientRoleLabel} · ${recipientName}` : recipientRoleLabel}</p>
                </div>
              </div>

              <div className="resolution-proposal-response-note">
                <MailIcon className="inline-icon" />
                <p>La réponse sera transmise à l'administration de la coordination.</p>
              </div>

              <div className="resolution-proposal-choice" role="radiogroup" aria-label="Réponse à la proposition">
                <label className={`resolution-proposal-option is-accept ${decision === 'accepted' ? 'is-selected' : ''}`.trim()}>
                  <input
                    type="radio"
                    name="decision"
                    value="accepted"
                    checked={decision === 'accepted'}
                    disabled={isReadOnly}
                    onChange={() => setDecision('accepted')}
                  />
                  <span className="resolution-proposal-option-icon">
                    <CheckIcon className="inline-icon" />
                  </span>
                  <span>
                    <strong>J'accepte</strong>
                    <small>Le créneau proposé me convient.</small>
                  </span>
                </label>
                <label className={`resolution-proposal-option is-reject ${decision === 'rejected' ? 'is-selected' : ''}`.trim()}>
                  <input
                    type="radio"
                    name="decision"
                    value="rejected"
                    checked={decision === 'rejected'}
                    disabled={isReadOnly}
                    onChange={() => setDecision('rejected')}
                  />
                  <span className="resolution-proposal-option-icon">
                    <CloseIcon className="inline-icon" />
                  </span>
                  <span>
                    <strong>Je refuse</strong>
                    <small>Je précise la raison et une alternative si possible.</small>
                  </span>
                </label>
              </div>

              {decision === 'rejected' ? (
                <div className="resolution-proposal-fields">
                  <label>
                    Raison du refus
                    <textarea
                      value={reason}
                      required
                      disabled={isReadOnly}
                      onChange={(event) => setReason(event.target.value)}
                      rows={4}
                    />
                  </label>
                  <label>
                    Proposition éventuelle
                    <textarea
                      value={alternativeProposal}
                      disabled={isReadOnly}
                      onChange={(event) => setAlternativeProposal(event.target.value)}
                      rows={3}
                    />
                  </label>
                </div>
              ) : null}

              {error ? (
                <div className="resolution-proposal-state is-error">
                  <AlertIcon className="inline-icon" />
                  {error}
                </div>
              ) : null}

              {isReadOnly ? (
                <div className={`resolution-proposal-state is-${readOnlyState.tone}`}>
                  {readOnlyState.message}
                </div>
              ) : (
                <button
                  type="submit"
                  className="resolution-proposal-submit"
                  disabled={isSubmitting}
                >
                  <SendIcon className="button-icon" />
                  {isSubmitting ? 'Envoi...' : 'Envoyer ma réponse'}
                </button>
              )}
            </section>
          </form>
        ) : null}
      </section>
    </main>
  )
}

export default ResolutionProposalPage
