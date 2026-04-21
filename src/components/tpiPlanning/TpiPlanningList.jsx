import React, { useState, useCallback, useMemo } from 'react'
import {
  MANUAL_REQUIRED_STATUSES,
  normalizePlanningStatus,
  PLANNING_STATUS
} from '../../constants/planningStatus'
import {
  AlertIcon,
  BriefcaseIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  DocumentIcon,
  InboxIcon,
  ListIcon,
  PinIcon,
  RoomIcon,
  TimeIcon,
  VoteIcon,
  WrenchIcon
} from '../shared/InlineIcons'
import { getPlanningClassDisplayInfo, getPlanningClassPeriod } from './planningClassUtils'
import './TpiPlanningList.css'

function getPlannedSlot(tpi) {
  return (
    tpi?.confirmedSlot ||
    tpi?.proposedSlots?.find(proposedSlot => proposedSlot?.slot)?.slot ||
    null
  )
}

function compactText(value) {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

function formatCandidateName(candidate) {
  if (!candidate) {
    return ""
  }

  if (typeof candidate === "object") {
    return [
      candidate.firstName,
      candidate.lastName,
      candidate.name
    ].filter(Boolean).join(" ").trim()
  }

  return compactText(candidate)
}

function formatPersonName(person) {
  if (!person) {
    return ""
  }

  if (typeof person === "object") {
    return [
      person.firstName,
      person.lastName,
      person.name
    ].filter(Boolean).join(" ").trim()
  }

  return compactText(person)
}

const STATUS_META = {
  [PLANNING_STATUS.DRAFT]: { label: 'Brouillon', Icon: DocumentIcon },
  [PLANNING_STATUS.VOTING]: { label: 'En vote', Icon: CalendarIcon },
  [PLANNING_STATUS.CONFIRMED]: { label: 'Confirmé', Icon: CheckIcon },
  [PLANNING_STATUS.MANUAL_REQUIRED]: { label: 'Intervention requise', Icon: AlertIcon }
}

function getValidationIssueDetail(annotation) {
  if (!annotation?.count) {
    return ''
  }

  return `${annotation.count} anomalie${annotation.count > 1 ? 's' : ''}`
}

function getValidationIssueReason(annotation) {
  const firstReason = compactText(annotation?.reasons?.[0])
  const extraReasonCount = Math.max((annotation?.reasons?.length || 0) - 1, 0)

  if (firstReason) {
    return `${firstReason}${extraReasonCount > 0 ? ` +${extraReasonCount}` : ''}`
  }

  const firstLabel = compactText(annotation?.labels?.[0])
  const extraLabelCount = Math.max((annotation?.labels?.length || 0) - 1, 0)

  if (!firstLabel) {
    return ''
  }

  return `${firstLabel}${extraLabelCount > 0 ? ` +${extraLabelCount}` : ''}`
}

const getStatusMeta = (status) => {
  if (!status) {
    return {
      label: '',
      Icon: AlertIcon
    }
  }

  const normalizedStatus = normalizePlanningStatus(status)
  return STATUS_META[normalizedStatus] || {
    label: status || 'Inconnu',
    Icon: AlertIcon
  }
}

const ROLE_LABELS = {
  expert1: 'Expert 1',
  expert2: 'Expert 2',
  chef_projet: 'Chef'
}

const getVoteDecisionMeta = (status) => {
  const responseMode = status?.responseMode || ''
  const decision = status?.decision || status

  if (responseMode === 'ok' || decision === 'accepted') {
    return { label: 'OK', tone: 'accepted' }
  }

  if (responseMode === 'proposal') {
    return { label: 'Propose', tone: 'preferred' }
  }

  if (decision === 'rejected') {
    return { label: 'NOK', tone: 'rejected' }
  }

  if (decision === 'preferred') {
    return { label: 'Propose', tone: 'preferred' }
  }

  return { label: 'En attente', tone: 'pending' }
}

/**
 * Liste des TPI avec leur statut de planification
 * Permet de voir et gérer tous les TPI d'une année
 */
const TpiPlanningList = ({
  tpis,
  selectedTpi,
  onSelectTpi,
  onProposeSlots,
  isAdmin,
  showVoteRoleDetails = false,
  classTypes = [],
  planningCatalogSites = [],
  validationIssuesByTpiId = {},
  prioritizeValidationIssues = false
}) => {
  const [sortField, setSortField] = useState('reference')
  const [sortDirection, setSortDirection] = useState('asc')
  const [expandedTpi, setExpandedTpi] = useState(null)

  /**
   * Tri des TPI
   */
  const sortedTpis = useMemo(() => {
    return [...tpis].sort((a, b) => {
      const validationCountA = Number(validationIssuesByTpiId?.[String(a?._id || '')]?.count || 0)
      const validationCountB = Number(validationIssuesByTpiId?.[String(b?._id || '')]?.count || 0)

      if (prioritizeValidationIssues && validationCountA !== validationCountB) {
        return validationCountB - validationCountA
      }

      let valueA, valueB
      const normalizedStatusA = normalizePlanningStatus(a.status)
      const normalizedStatusB = normalizePlanningStatus(b.status)

      switch (sortField) {
        case 'reference':
          valueA = a.reference || ''
          valueB = b.reference || ''
          break
        case 'candidat':
          valueA = `${a.candidat?.lastName || ''} ${a.candidat?.firstName || ''}`
          valueB = `${b.candidat?.lastName || ''} ${b.candidat?.firstName || ''}`
          break
        case 'status':
          valueA = normalizedStatusA || ''
          valueB = normalizedStatusB || ''
          break
        case 'date':
          valueA = getPlannedSlot(a)?.date || '9999-99-99'
          valueB = getPlannedSlot(b)?.date || '9999-99-99'
          break
        default:
          valueA = a[sortField] || ''
          valueB = b[sortField] || ''
      }

      const comparison = valueA.localeCompare(valueB)
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [tpis, sortField, sortDirection, prioritizeValidationIssues, validationIssuesByTpiId])

  /**
   * Gère le changement de tri
   */
  const handleSort = useCallback((field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }, [sortField])

  /**
   * Toggle l'expansion des détails d'un TPI
   */
  const toggleExpand = useCallback((tpiId) => {
    setExpandedTpi(prev => prev === tpiId ? null : tpiId)
  }, [])

  /**
   * Obtient le libellé du statut
   */
  const getStatusLabel = (status) => {
    return getStatusMeta(status).label
  }

  /**
   * Rendu de l'en-tête de colonne triable
   */
  const renderSortHeader = (field, label) => {
    const isActive = sortField === field
    return (
      <th 
        className={`sortable ${isActive ? 'active' : ''}`}
        onClick={() => handleSort(field)}
      >
        {label}
        <span className="sort-indicator">
          {isActive ? (sortDirection === 'asc' ? '▲' : '▼') : '○'}
        </span>
      </th>
    )
  }

  /**
   * Rendu des informations de vote d'un TPI
   */
  const renderVotingInfo = (tpi) => {
    if (!tpi.votingSession) return null

    const voteSummary = tpi.votingSession.voteSummary || {}
    const voteStats = tpi.voteStats || {}
    const voteRoleStatus = tpi.voteRoleStatus || {}
    const acceptedVotes = Number(voteStats.acceptedVotes || 0) + Number(voteStats.preferredVotes || 0)
    const votesReceived = [
      voteSummary.expert1Voted,
      voteSummary.expert2Voted,
      voteSummary.chefProjetVoted
    ].filter(Boolean).length
    const votesRequired = 3
    const deadline = tpi.votingSession.deadline
    const hasConflicts = (tpi.conflicts || []).length > 0

    return (
      <div className="voting-info">
        <div className="votes-progress">
          <div 
            className="progress-bar"
            style={{ width: `${(votesReceived / votesRequired) * 100}%` }}
          />
          <span className="progress-text">{votesReceived}/{votesRequired} votes</span>
        </div>
        {(voteStats.totalVotes || 0) > 0 && (
          <div className="votes-breakdown">
            <span className="votes-accepted">
              <CheckIcon className="vote-metric-icon" />
              {acceptedVotes} acceptés
            </span>
            <span className="votes-pending">
              <TimeIcon className="vote-metric-icon" />
              {voteStats.pendingVotes} en attente
            </span>
            <span className="votes-rejected">
              <CloseIcon className="vote-metric-icon" />
              {voteStats.rejectedVotes} refusés
            </span>
          </div>
        )}
        {showVoteRoleDetails && (
          <div className="vote-role-summary" aria-label="État des votes par rôle">
            {Object.entries(voteRoleStatus).map(([role, status]) => {
              const meta = getVoteDecisionMeta(status)
              const roleLabel = ROLE_LABELS[role] || role

              return (
                <span key={role} className={`vote-role-chip ${meta.tone}`}>
                  <strong>{roleLabel}</strong>
                  <span>{meta.label}</span>
                  {(status?.alternativeCount || 0) > 0 ? (
                    <em>{status.alternativeCount} alt.</em>
                  ) : null}
                </span>
              )
            })}
          </div>
        )}
        {deadline && (
          <span className="voting-deadline">
            <TimeIcon className="vote-metric-icon" />
            Deadline: {new Date(deadline).toLocaleDateString('fr-CH')}
          </span>
        )}
        {hasConflicts && (
          <span className="voting-conflict">
            <AlertIcon className="vote-metric-icon" />
            Conflit détecté
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="tpi-planning-list">
      <div className="list-header">
        <h2 className="list-title">
          <ListIcon className="list-title-icon" />
          Liste des TPI ({tpis.length})
        </h2>
      </div>

      <div className="table-container">
        <table className="tpi-table">
          <thead>
            <tr>
              {renderSortHeader('reference', 'Référence')}
              {renderSortHeader('candidat', 'Candidat')}
              <th>Expert 1</th>
              <th>Expert 2</th>
              <th>Chef de projet</th>
              {renderSortHeader('status', 'Statut')}
              {renderSortHeader('date', 'Date soutenance')}
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sortedTpis.map(tpi => (
              <React.Fragment key={tpi._id}>
                {(() => {
                  const normalizedStatus = normalizePlanningStatus(tpi.status)
                  const statusMeta = getStatusMeta(tpi.status)
                  const StatusIcon = statusMeta.Icon
                  const candidateName = formatCandidateName(tpi.candidat)
                  const expert1Name = formatPersonName(tpi.expert1)
                  const expert2Name = formatPersonName(tpi.expert2)
                  const chefProjetName = formatPersonName(tpi.chefProjet)
                  const plannedSlot = getPlannedSlot(tpi)
                  const plannedSlotDate = plannedSlot?.date ? new Date(plannedSlot.date) : null
                  const plannedSlotDateLabel = plannedSlotDate && !Number.isNaN(plannedSlotDate.getTime())
                    ? plannedSlotDate.toLocaleDateString('fr-CH')
                    : ""
                  const plannedRoom = compactText(plannedSlot?.room?.name)
                  const tpiSite = tpi.site || tpi.lieu?.site
                  const classInfo = getPlanningClassDisplayInfo(tpi.classe, classTypes, planningCatalogSites, tpiSite)
                  const classDisplayLabel = classInfo.displayClassLabel || compactText(tpi.classe)
                  const classTypeLabel = classInfo.displayTypeLabel
                  const classModePeriod = getPlanningClassPeriod(tpi.classe, classTypes, planningCatalogSites, tpiSite)
                  const classModeTitle = classInfo
                    ? [
                        classDisplayLabel ? `Classe ${classDisplayLabel}` : '',
                        classInfo.hasSpecificClass && classTypeLabel ? `Type ${classTypeLabel}` : '',
                        classInfo.siteLabel || tpiSite ? `Site ${classInfo.siteLabel || tpiSite}` : '',
                        [classModePeriod.startDate, classModePeriod.endDate].filter(Boolean).join(' → ')
                      ].filter(Boolean).join(' · ')
                    : ''
                  const proposedSlots = Array.isArray(tpi.proposedSlots)
                    ? tpi.proposedSlots.filter((ps) => Boolean(ps?.slot))
                    : []
                  const acceptedVotes = Number(tpi.voteStats?.acceptedVotes || 0) + Number(tpi.voteStats?.preferredVotes || 0)
                  const pendingVotes = Number(tpi.voteStats?.pendingVotes || 0)
                  const rejectedVotes = Number(tpi.voteStats?.rejectedVotes || 0)
                  const voteRoleStatus = tpi.voteRoleStatus || {}
                  const validationAnnotation = validationIssuesByTpiId?.[String(tpi?._id || '')] || null
                  const hasValidationIssues = Boolean(validationAnnotation?.count)
                  const validationSummary = getValidationIssueDetail(validationAnnotation)
                  const validationReason = getValidationIssueReason(validationAnnotation)
                  const validationTitle = validationAnnotation?.messages?.join('\n') || undefined

                  return (
                <tr 
                  className={`
                    tpi-row 
                    ${selectedTpi?._id === tpi._id ? 'selected' : ''}
                    ${expandedTpi === tpi._id ? 'expanded' : ''}
                    status-${normalizedStatus}
                    ${hasValidationIssues ? 'has-validation-issues' : ''}
                  `}
                  onClick={() => onSelectTpi(tpi)}
                >
                  <td className="cell-reference">
                    <button 
                      className="expand-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleExpand(tpi._id)
                      }}
                    >
                      {expandedTpi === tpi._id ? <ChevronDownIcon /> : <ChevronRightIcon />}
                    </button>
                    <div className="reference-content">
                      <div className="reference-main">
                        {compactText(tpi.reference) ? <span>{tpi.reference}</span> : null}
                        {hasValidationIssues ? (
                          <span className="validation-badge" title={validationTitle}>
                            À corriger
                          </span>
                        ) : null}
                      </div>
                      {hasValidationIssues && validationSummary ? (
                        <span className="validation-hint" title={validationTitle}>
                          {validationSummary}
                        </span>
                      ) : null}
                      {hasValidationIssues && validationReason ? (
                        <span className="validation-reason" title={validationTitle}>
                          {validationReason}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="cell-candidat">
                    {candidateName || classDisplayLabel ? (
                      <div className="person-info">
                        <div className="person-info-top">
                          {candidateName ? (
                            <span className="person-name">
                              {candidateName}
                            </span>
                          ) : (
                            <span className="person-name person-name-placeholder" aria-hidden="true" />
                          )}
                          {classDisplayLabel ? (
                            <span
                              className="person-class-badge is-matu person-class-badge-top"
                              title={classModeTitle || `Classe ${classDisplayLabel}`}
                              aria-label={classModeTitle || `Classe ${classDisplayLabel}`}
                            >
                              {classDisplayLabel}
                            </span>
                          ) : null}
                        </div>
                        {classInfo.hasSpecificClass && classTypeLabel ? (
                          <span className="person-class" title={classModeTitle || classTypeLabel}>
                            {classTypeLabel}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="cell-expert">
                    {expert1Name}
                  </td>
                  <td className="cell-expert">
                    {expert2Name}
                  </td>
                  <td className="cell-chef">
                    {chefProjetName}
                  </td>
                  <td className="cell-status">
                    {getStatusLabel(tpi.status) ? (
                      <span className={`status-badge status-${normalizedStatus}`}>
                        <StatusIcon className="status-badge-icon" />
                        {getStatusLabel(tpi.status)}
                      </span>
                    ) : null}
                    {(tpi.voteStats?.totalVotes || 0) > 0 && normalizedStatus === PLANNING_STATUS.VOTING && (
                      <div className="vote-mini-summary">
                        <span className="vote-mini-ok">
                          <CheckIcon className="vote-metric-icon" />
                          {acceptedVotes}
                        </span>
                        <span className="vote-mini-pending">
                          <TimeIcon className="vote-metric-icon" />
                          {pendingVotes}
                        </span>
                        {rejectedVotes > 0 && (
                          <span className="vote-mini-rejected">
                            <CloseIcon className="vote-metric-icon" />
                            {rejectedVotes}
                          </span>
                        )}
                      </div>
                    )}
                    {showVoteRoleDetails && normalizedStatus === PLANNING_STATUS.VOTING ? (
                      <div className="vote-role-summary compact">
                        {Object.entries(voteRoleStatus).map(([role, status]) => {
                          const meta = getVoteDecisionMeta(status)
                          const roleLabel = ROLE_LABELS[role] || role

                          return (
                            <span key={role} className={`vote-role-chip ${meta.tone}`}>
                              <strong>{roleLabel}</strong>
                              <span>{meta.label}</span>
                            </span>
                          )
                        })}
                      </div>
                    ) : null}
                  </td>
                  <td className="cell-date">
                    {plannedSlot ? (
                      <div className="confirmed-date">
                        {plannedSlotDateLabel ? (
                          <span className="date">{plannedSlotDateLabel}</span>
                        ) : null}
                        {compactText(plannedSlot.startTime) ? (
                          <span className="time">{plannedSlot.startTime}</span>
                        ) : null}
                        {plannedRoom ? (
                          <span className="room">{plannedRoom}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  {isAdmin && (
                    <td className="cell-actions">
                      {normalizedStatus === PLANNING_STATUS.DRAFT && (
                        <button
                          className="btn-action btn-vote btn-icon-only"
                          onClick={(e) => {
                            e.stopPropagation()
                            onProposeSlots(tpi._id)
                          }}
                          title="Lancer le processus de vote"
                          aria-label="Lancer le processus de vote"
                        >
                          <VoteIcon />
                          <span className="sr-only">Voter</span>
                        </button>
                      )}
                      {MANUAL_REQUIRED_STATUSES.includes(normalizePlanningStatus(tpi.status)) && (
                        <button
                          className="btn-action btn-resolve btn-icon-only"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectTpi(tpi)
                          }}
                          title="Résoudre le conflit"
                          aria-label="Résoudre le conflit"
                        >
                          <WrenchIcon />
                          <span className="sr-only">Résoudre</span>
                        </button>
                      )}
                    </td>
                  )}
                </tr>
                  )
                })()}

                {/* Détails étendus */}
                {expandedTpi === tpi._id && (
                  <tr className="tpi-details-row">
                    <td colSpan={isAdmin ? 8 : 7}>
                      <div className="tpi-details">
                        {compactText(tpi.sujet) ? (
                          <div className="detail-section">
                            <h4 className="detail-section-title">
                              <DocumentIcon className="detail-section-icon" />
                              Sujet
                            </h4>
                            <p>{tpi.sujet}</p>
                          </div>
                        ) : null}
                        
                        {compactText(tpi.entreprise) ? (
                          <div className="detail-section">
                            <h4 className="detail-section-title">
                              <BriefcaseIcon className="detail-section-icon" />
                              Entreprise
                            </h4>
                            <p>{tpi.entreprise}</p>
                          </div>
                        ) : null}

                        {compactText(tpi.site || tpi.lieu?.site) ? (
                          <div className="detail-section">
                            <h4 className="detail-section-title">
                              <PinIcon className="detail-section-icon" />
                              Site
                            </h4>
                            <p>{tpi.site || tpi.lieu?.site}</p>
                          </div>
                        ) : null}

                        {tpi.status === 'voting' && (
                          <div className="detail-section voting-section">
                            <h4 className="detail-section-title">
                              <VoteIcon className="detail-section-icon" />
                              Statut du vote
                            </h4>
                            {renderVotingInfo(tpi)}
                          </div>
                        )}

                        {tpi.proposedSlots && tpi.proposedSlots.length > 0 && (
                          <div className="detail-section">
                            <h4 className="detail-section-title">
                              <CalendarIcon className="detail-section-icon" />
                              Date fixée + alternatives
                            </h4>
                            <div className="proposed-slots">
                              {tpi.proposedSlots.map((ps, idx) => {
                                const slot = ps.slot || {}
                                const slotDate = slot.date ? new Date(slot.date) : null
                                const slotDateLabel = slotDate && !Number.isNaN(slotDate.getTime())
                                  ? slotDate.toLocaleDateString('fr-CH')
                                  : ""
                                const slotTime = compactText(slot.startTime)
                                const slotRoom = compactText(slot.room?.name)

                                if (!slotDateLabel && !slotTime && !slotRoom) {
                                  return null
                                }

                                return (
                                <div key={idx} className="proposed-slot">
                                  <div className="proposed-slot-head">
                                    {idx === 0 ? (
                                      <span className="slot-rank">Date fixée</span>
                                    ) : (
                                      <span className="slot-rank">{`Alternative ${idx}`}</span>
                                    )}
                                    {Number.isFinite(Number(ps.score)) ? (
                                      <span className="slot-score">Score {ps.score}</span>
                                    ) : null}
                                  </div>
                                  <div className="proposed-slot-meta">
                                    {slotDateLabel ? (
                                      <span className="slot-chip">
                                        <CalendarIcon />
                                        {slotDateLabel}
                                      </span>
                                    ) : null}
                                    {slotTime ? (
                                      <span className="slot-chip">
                                        <TimeIcon />
                                        {slotTime}
                                      </span>
                                    ) : null}
                                  {slotRoom ? (
                                      <span className="slot-chip">
                                        <RoomIcon />
                                        {slotRoom}
                                      </span>
                                    ) : null}
                                    {classInfo.hasSpecificClass && classTypeLabel ? (
                                      <span className="slot-chip slot-chip-matu" title={classModeTitle || classTypeLabel}>
                                        {classTypeLabel}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {tpis.length === 0 && (
        <div className="empty-list">
          <span className="empty-icon" aria-hidden="true">
            <InboxIcon />
          </span>
          <p>Aucun TPI trouvé</p>
        </div>
      )}
    </div>
  )
}

export default TpiPlanningList
