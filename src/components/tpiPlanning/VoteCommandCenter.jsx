import { useEffect, useMemo, useRef, useState } from 'react'
import { IS_DEBUG } from '../../config/appConfig'
import {
  AlertIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  FileTextIcon,
  MailIcon,
  PinIcon,
  RefreshIcon,
  SendIcon,
  VoteIcon,
  WrenchIcon
} from '../shared/InlineIcons'
import { normalizeCoordinationStatus, COORDINATION_STATUS } from '../../constants/coordinationStatus'
import { STATIC_VOTE_REGENERATION_NOTICE } from '../../constants/staticVotePublication'
import {
  VOTING_STAKEHOLDER_ROLES,
  getTpiRelationRoleLabel
} from '../../utils/stakeholderRules'
import './VoteCommandCenter.css'

const VOTE_ROLE_ORDER = VOTING_STAKEHOLDER_ROLES
const PROJECT_LEAD_FORCE_OK_ROLES = ['chef_projet']
const EXPERT_FORCE_OK_ROLES = VOTE_ROLE_ORDER.filter((role) => role !== 'chef_projet')

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function normalizeVoteCommentText(value) {
  return compactText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function isOnlyAvailabilityVoteComment(value) {
  return normalizeVoteCommentText(value).includes('seule disponibilite signalee')
}

function getVoterRoleLabel(role) {
  return getTpiRelationRoleLabel(role, 'Role')
}

function hasVoteRoleResponded(roleStatus) {
  const responseMode = compactText(roleStatus?.responseMode)
  const decision = compactText(roleStatus?.decision)

  return responseMode === 'ok' ||
    responseMode === 'proposal' ||
    (decision && decision !== 'pending')
}

function getVoteRoleTone(roleStatus) {
  if (!hasVoteRoleResponded(roleStatus)) {
    return 'pending'
  }

  const responseMode = compactText(roleStatus?.responseMode)
  const decision = compactText(roleStatus?.decision)

  if (roleStatus?.hardConstraint) {
    return 'hard'
  }

  if (responseMode === 'ok' || decision === 'accepted') {
    return 'ok'
  }

  if (
    responseMode === 'proposal' ||
    decision === 'preferred' ||
    Number(roleStatus?.alternativeCount || 0) > 0 ||
    roleStatus?.availabilityException ||
    compactText(roleStatus?.specialRequestReason)
  ) {
    return 'proposal'
  }

  if (decision === 'rejected') {
    return 'rejected'
  }

  return 'answered'
}

function getVoteRoleStatusLabel(roleStatus) {
  const tone = getVoteRoleTone(roleStatus)

  if (tone === 'ok') {
    return 'OK'
  }

  if (tone === 'proposal') {
    return 'Proposition'
  }

  if (tone === 'rejected') {
    return 'Refus'
  }

  if (tone === 'hard') {
    return 'Bloquant'
  }

  if (tone === 'answered') {
    return 'Repondu'
  }

  return 'Attente'
}

function getSlotDecisionTone(decision) {
  if (decision === 'accepted') {
    return 'ok'
  }

  if (decision === 'preferred') {
    return 'proposal'
  }

  if (decision === 'rejected') {
    return 'rejected'
  }

  return 'pending'
}

function getSlotDecisionLabel(decision, isFixed) {
  if (decision === 'accepted') {
    return isFixed ? 'OK' : 'Accepte'
  }

  if (decision === 'preferred') {
    return 'Propose'
  }

  if (decision === 'rejected') {
    return isFixed ? 'Refus' : 'Non retenu'
  }

  return 'Attente'
}

function formatVoteDate(value) {
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

function formatSpecialRequestDate(value) {
  const label = formatVoteDate(value)
  return label ? `Date demandée ${label}` : ''
}

function getAdminSlotActionLabel(slot) {
  if (slot?.positiveCount >= 3) {
    return 'Valider'
  }

  if (slot?.positiveCount === 2) {
    return 'Valider 2/3'
  }

  return 'Choisir'
}

function getSlotHasHardConstraint(slot) {
  return Boolean(slot?.hasHardConstraint) ||
    (Array.isArray(slot?.roleDecisions) ? slot.roleDecisions : [])
      .some((decision) => decision?.hardConstraint || isOnlyAvailabilityVoteComment(decision?.comment))
}

function getBestDecisionSlot(row) {
  const slots = Array.isArray(row?.decisionSlots) ? row.decisionSlots : []

  return slots
    .filter((slot) => compactText(slot?.slotId))
    .slice()
    .sort((left, right) => {
      const leftHard = getSlotHasHardConstraint(left) ? 1 : 0
      const rightHard = getSlotHasHardConstraint(right) ? 1 : 0

      if (leftHard !== rightHard) {
        return leftHard - rightHard
      }

      if (Number(right.positiveCount || 0) !== Number(left.positiveCount || 0)) {
        return Number(right.positiveCount || 0) - Number(left.positiveCount || 0)
      }

      if (Number(left.rejectedCount || 0) !== Number(right.rejectedCount || 0)) {
        return Number(left.rejectedCount || 0) - Number(right.rejectedCount || 0)
      }

      return compactText(left.label).localeCompare(compactText(right.label), 'fr')
    })[0] || null
}

function formatSatisfactionSlot(slot) {
  if (!slot) {
    return 'Créneau inconnu'
  }

  const room = slot.room && typeof slot.room === 'object' ? slot.room : {}
  const startTime = compactText(slot.startTime)
  const periodLabel = startTime
    ? (parseInt(startTime, 10) < 12 ? 'Matin' : 'Après-midi')
    : compactText(slot.period)
  return [
    formatVoteDate(slot.date),
    periodLabel,
    compactText(room.name || slot.roomName)
  ].filter(Boolean).join(' · ') || 'Créneau inconnu'
}

function getMovedVoteSatisfaction(row) {
  const satisfaction = row?.tpi?.voteDecision?.satisfaction
  return satisfaction?.movedAfterVotes ? satisfaction : null
}

function getLatestResolutionProposal(row) {
  const proposals = Array.isArray(row?.resolutionProposals) ? row.resolutionProposals : []

  return proposals
    .slice()
    .sort((left, right) => new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime())[0] || null
}

function getResolutionStatusTone(status) {
  if (status === 'accepted') {
    return 'accepted'
  }

  if (status === 'rejected') {
    return 'rejected'
  }

  if (status === 'expired') {
    return 'expired'
  }

  if (status === 'failed' || status === 'cancelled') {
    return 'failed'
  }

  if (status === 'partial') {
    return 'partial'
  }

  return 'sent'
}

function getResolutionStatusLabel(proposal) {
  const status = compactText(proposal?.status)

  if (status === 'accepted') {
    return 'Accord complet'
  }

  if (status === 'rejected') {
    return 'Refus reçu'
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

  return 'Proposition transmise'
}

function getResolutionStatusDetail(proposal) {
  const counts = proposal?.counts || {}
  const accepted = Number(counts.accepted || 0)
  const rejected = Number(counts.rejected || 0)
  const total = Number(counts.total || 0)

  if (rejected > 0) {
    return `${rejected} refus à traiter`
  }

  if (total > 0) {
    return `${accepted}/${total} accord${accepted > 1 ? 's' : ''}`
  }

  return compactText(proposal?.proposedSlotLabel) || 'Retour attendu'
}

function getResolutionRecipientLabel(status) {
  if (status === 'delivery_failed') {
    return 'Email échec'
  }

  if (status === 'accepted') {
    return 'OK'
  }

  if (status === 'rejected') {
    return 'Refus'
  }

  return 'Attente'
}

function getResolutionRecipients(proposal) {
  return (Array.isArray(proposal?.recipients) ? proposal.recipients : [])
    .slice()
    .sort((left, right) => {
      const roleDiff = VOTE_ROLE_ORDER.indexOf(left?.role) - VOTE_ROLE_ORDER.indexOf(right?.role)

      if (roleDiff !== 0) {
        return roleDiff
      }

      return compactText(left?.name).localeCompare(compactText(right?.name), 'fr')
    })
}

function getCaseDescriptor(row, checkedConstraint = null) {
  const bestSlot = getBestDecisionSlot(row)

  if (row?.bucket === 'manual') {
    return {
      tone: 'manual',
      label: 'Arbitrage',
      detail: bestSlot
        ? `Meilleur choix: ${bestSlot.label} (${bestSlot.positiveCount}/3)`
        : 'Forcage requis'
    }
  }

  if (checkedConstraint?.hasHardConstraint || row?.hasHardConstraint) {
    return {
      tone: 'hard',
      label: 'Contrainte',
      detail: checkedConstraint?.conflictMessages?.[0] || row?.constraintSummary?.recommendation || 'A verifier'
    }
  }

  if (row?.bucket === 'pending') {
    return {
      tone: 'pending',
      label: 'Relance',
      detail: row.missingLabels?.length
        ? `Manque: ${row.missingLabels.join(', ')}`
        : 'Vote manquant'
    }
  }

  if (row?.bucket === 'ready') {
    if (bestSlot?.positiveCount >= VOTE_ROLE_ORDER.length) {
      return {
        tone: 'ready',
        label: 'Consensus',
        detail: `${bestSlot.label} - 3/3`
      }
    }

    return {
      tone: 'review',
      label: 'Decision',
      detail: bestSlot
        ? `${bestSlot.label} - ${bestSlot.positiveCount}/3`
        : 'A trancher'
    }
  }

  if (row?.bucket === 'confirmed') {
    return {
      tone: 'confirmed',
      label: 'Confirme',
      detail: row.fixedSlotLabel || 'Défense confirmée'
    }
  }

  return {
    tone: 'neutral',
    label: 'Suivi',
    detail: row?.deadlineLabel || 'A verifier'
  }
}

function getCasePriority(row, checkedConstraint = null) {
  if (row?.bucket === 'manual') {
    return 10
  }

  if (checkedConstraint?.hasHardConstraint || row?.hasHardConstraint) {
    return 20
  }

  if (row?.bucket === 'ready') {
    const bestSlot = getBestDecisionSlot(row)
    return bestSlot?.positiveCount >= VOTE_ROLE_ORDER.length ? 30 : 40
  }

  if (row?.bucket === 'pending') {
    return 50
  }

  if (row?.bucket === 'confirmed') {
    return 90
  }

  return 70
}

function flattenSections(sections = []) {
  return sections.flatMap((section) => Array.isArray(section?.rows) ? section.rows : [])
}

function hasReceivedVoteResponse(row) {
  return Number(row?.respondedCount || 0) > 0
}

function getRowFixedDecisionSlot(row) {
  return (Array.isArray(row?.decisionSlots) ? row.decisionSlots : [])
    .find((slot) => slot?.isFixed && compactText(slot?.slotId)) || null
}

function canForceOkRole(row, role, onlyMissing = false) {
  if (!row || !role) {
    return false
  }

  if (normalizeCoordinationStatus(row.tpi?.status) === COORDINATION_STATUS.CONFIRMED) {
    return false
  }

  if (!getRowFixedDecisionSlot(row)) {
    return false
  }

  const roleEntry = (Array.isArray(row.roleEntries) ? row.roleEntries : [])
    .find((entry) => entry.role === role)

  if (!roleEntry) {
    return false
  }

  if (onlyMissing) {
    return !hasVoteRoleResponded(roleEntry.status)
  }

  return getVoteRoleTone(roleEntry.status) !== 'ok'
}

function getForceOkTargets(rows = [], roles = [], onlyMissing = true) {
  const tpiIds = []
  let roleCount = 0

  for (const row of Array.isArray(rows) ? rows : []) {
    const matchingRoles = roles.filter((role) => canForceOkRole(row, role, onlyMissing))

    if (matchingRoles.length === 0) {
      continue
    }

    const tpiId = compactText(row?.id || row?.tpi?._id)
    if (tpiId) {
      tpiIds.push(tpiId)
    }
    roleCount += matchingRoles.length
  }

  return {
    tpiIds: Array.from(new Set(tpiIds)),
    roleCount
  }
}

function getQueueTitle(row) {
  if (row?.bucket === 'pending') {
    return 'À relancer'
  }

  if (row?.bucket === 'ready') {
    return 'Prêts pour clôture'
  }

  if (row?.bucket === 'manual') {
    return 'À résoudre'
  }

  if (row?.bucket === 'confirmed') {
    return 'Confirmés'
  }

  return 'File de traitement'
}

function formatConstraintCheckedAt(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getDecisionForRole(slot, role) {
  return (Array.isArray(slot?.roleDecisions) ? slot.roleDecisions : [])
    .find((decision) => compactText(decision?.role) === role) || {
      role,
      decision: 'pending',
      voterName: ''
    }
}

function getRoleProcessingScore(entry) {
  const tone = getVoteRoleTone(entry?.status)

  if (tone === 'hard') {
    return 0
  }

  if (tone === 'proposal') {
    return 1
  }

  if (tone === 'rejected') {
    return 2
  }

  if (hasVoteRoleResponded(entry?.status)) {
    return 3
  }

  return 4
}

function getDefaultSelectedRole(row) {
  const entries = Array.isArray(row?.roleEntries) ? row.roleEntries : []

  return entries
    .slice()
    .sort((left, right) => {
      const scoreDiff = getRoleProcessingScore(left) - getRoleProcessingScore(right)

      if (scoreDiff !== 0) {
        return scoreDiff
      }

      return VOTE_ROLE_ORDER.indexOf(left.role) - VOTE_ROLE_ORDER.indexOf(right.role)
    })[0]?.role || VOTE_ROLE_ORDER[0]
}

function getRecommendationTitle(row, descriptor) {
  if (row?.bucket === 'pending') {
    return 'Relance ciblée'
  }

  return descriptor?.detail || 'À traiter'
}

function getPrimaryAction({
  workflowState,
  isPublishedState,
  hasActiveSnapshot,
  canStartVotes,
  canPublish,
  hasLegacyImportGap,
  workflowActionLoading,
  stats,
  staticVotePublicationInfo,
  onFreezePlanification,
  onStartVotesCampaign,
  onRemindVotes,
  onSyncStaticVotePublication,
  onCloseVotes,
  onPublishDefinitive,
  onOpenPublishedView
}) {
  if (!hasActiveSnapshot) {
    return {
      key: 'freeze',
      label: 'Geler snapshot',
      detail: 'Avant ouverture des votes',
      buttonLabel: 'Geler snapshot',
      icon: <CheckIcon className="button-icon" />,
      onClick: onFreezePlanification,
      disabled: workflowActionLoading || hasLegacyImportGap
    }
  }

  if (Number(stats.totalTpis || 0) > 0 && Number(stats.responseTpis || 0) === 0) {
    return {
      key: 'startVotes',
      label: 'Ouvrir campagne',
      detail: `${stats.totalTpis} TPI prets`,
      buttonLabel: 'Ouvrir votes',
      icon: <ArrowRightIcon className="button-icon" />,
      onClick: onStartVotesCampaign,
      disabled: workflowActionLoading || !canStartVotes || hasLegacyImportGap
    }
  }

  if (staticVotePublicationInfo?.available && staticVotePublicationInfo?.syncSecretConfigured) {
    return {
      key: 'staticVoteSync',
      label: 'Importer réponses web',
      detail: 'Mini-site prêt à synchroniser',
      buttonLabel: 'Importer',
      ariaLabel: 'Importer réponses web',
      icon: <RefreshIcon className="button-icon" />,
      onClick: onSyncStaticVotePublication,
      disabled: workflowActionLoading
    }
  }

  if (Number(stats.missingVotes || 0) > 0) {
    return {
      key: 'remindVotes',
      label: 'Relancer',
      detail: `${stats.missingVotes} reponse${stats.missingVotes > 1 ? 's' : ''} manquante${stats.missingVotes > 1 ? 's' : ''}`,
      buttonLabel: 'Relancer',
      ariaLabel: 'Relancer sans réponse',
      icon: <MailIcon className="button-icon" />,
      onClick: onRemindVotes,
      disabled: workflowActionLoading
    }
  }

  if (Number(stats.totalTpis || 0) > 0) {
    return {
      key: 'closeVotes',
      label: 'Clore campagne',
      detail: `${stats.readyTpis} TPI complet${stats.readyTpis > 1 ? 's' : ''}`,
      buttonLabel: 'Clore campagne',
      icon: <ArrowRightIcon className="button-icon" />,
      onClick: onCloseVotes,
      disabled: workflowActionLoading || Number(stats.totalTpis || 0) === 0
    }
  }

  if (isPublishedState) {
    return {
      key: 'published',
      label: 'Agenda publie',
      detail: `${stats.confirmedTpis} TPI confirmés`,
      buttonLabel: 'Ouvrir défenses',
      icon: <CheckIcon className="button-icon" />,
      onClick: onOpenPublishedView,
      disabled: workflowActionLoading
    }
  }

  return {
    key: 'publish',
    label: 'Verifier workflow',
    detail: workflowState || 'Etat inconnu',
    buttonLabel: 'Publier',
    ariaLabel: 'Publier défenses',
    icon: <CheckIcon className="button-icon" />,
    onClick: onPublishDefinitive,
    disabled: workflowActionLoading || !canPublish
  }
}

const WorkflowActionButton = ({
  actionKey,
  primaryActionKey,
  className = 'secondary',
  disabled = false,
  isActionRunning,
  onClick,
  icon,
  children,
  runningLabel,
  title,
  ariaLabel
}) => {
  if (actionKey === primaryActionKey) {
    return null
  }

  const running = isActionRunning(actionKey)

  return (
    <button
      type="button"
      className={`workflow-btn ${className}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
    >
      {icon}
      {running ? runningLabel : children}
    </button>
  )
}

const VoteCommandCenter = ({
  year,
  workflowState,
  isPublishedState,
  hasActiveSnapshot,
  canStartVotes,
  canPublish,
  hasLegacyImportGap,
  hasBlockedValidation,
  workflowActionLoading,
  isActionRunning,
  stats,
  activeSections,
  allRows,
  filteredRows,
  checkedConstraintByTpiId,
  constraintCheckResult,
  staticVotePublicationInfo,
  defenseChangeNotificationInfo,
  finalScheduleDeliveryPreview,
  preferenceActionLoadingKey,
  proposalMoveLoadingKey,
  proposalMoveApplying,
  resolutionProposalSubmitting = false,
  onAutomatePlanification,
  onValidatePlanification,
  onFreezePlanification,
  onSyncPlanificationFromCoordination,
  onStartVotesCampaign,
  onStartVotesCampaignWithoutEmails,
  onRemindVotes,
  onOpenVoteAccessPreview,
  onGenerateStaticVotePublication,
  onPublishStaticVotePublication,
  onSyncStaticVotePublication,
  onCloseVotes,
  onCheckVoteConstraints,
  onPublishDefinitive,
  onSendPublicationLinks,
  onPreviewFinalScheduleDelivery,
  onSendFinalScheduleDelivery,
  onSendDefenseChangeNotifications,
  onOpenPublishedView,
  onOpenManualResolver,
  onSelectTpi,
  onForceVoteSlot,
  onForceVoteOk,
  onReviewVoteProposalMove,
  onOpenResolutionProposal,
  onInsertProposalPreference
}) => {
  const rows = useMemo(() => {
    const activeRows = flattenSections(activeSections)
    const hasActiveSections = Array.isArray(activeSections) && activeSections.length > 0
    const sourceRows = hasActiveSections ? activeRows : (filteredRows || [])

    return sourceRows
      .filter(hasReceivedVoteResponse)
      .slice()
      .sort((left, right) => {
        const leftConstraint = checkedConstraintByTpiId?.[left.id]
        const rightConstraint = checkedConstraintByTpiId?.[right.id]
        const priorityDiff = getCasePriority(left, leftConstraint) - getCasePriority(right, rightConstraint)

        if (priorityDiff !== 0) {
          return priorityDiff
        }

        return compactText(left.reference).localeCompare(compactText(right.reference), 'fr')
      })
  }, [activeSections, filteredRows, checkedConstraintByTpiId])

  const responseAllRowsCount = useMemo(() => (
    (Array.isArray(allRows) ? allRows : []).filter(hasReceivedVoteResponse).length
  ), [allRows])
  const movedVoteRelaunchRows = useMemo(() => (
    (Array.isArray(allRows) ? allRows : [])
      .filter((row) => {
        const satisfaction = getMovedVoteSatisfaction(row)
        return satisfaction && Number(satisfaction.touchedRoleCount || 0) > 0
      })
  ), [allRows])
  const movedVoteRelaunchTpiIds = useMemo(() => (
    movedVoteRelaunchRows.map((row) => compactText(row.id)).filter(Boolean)
  ), [movedVoteRelaunchRows])
  const movedVoteRelaunchRoleCount = movedVoteRelaunchRows.reduce(
    (total, row) => total + Number(getMovedVoteSatisfaction(row)?.touchedRoleCount || 0),
    0
  )
  const projectLeadForceOkTargets = useMemo(() => (
    getForceOkTargets(allRows, PROJECT_LEAD_FORCE_OK_ROLES, true)
  ), [allRows])
  const expertForceOkTargets = useMemo(() => (
    getForceOkTargets(allRows, EXPERT_FORCE_OK_ROLES, true)
  ), [allRows])
  const constraintConflicts = useMemo(() => (
    Array.isArray(constraintCheckResult?.conflicts)
      ? constraintCheckResult.conflicts
      : []
  ), [constraintCheckResult])
  const constraintPreviewConflicts = useMemo(() => (
    constraintConflicts.slice(0, 6)
  ), [constraintConflicts])
  const hiddenConstraintCount = Math.max(constraintConflicts.length - constraintPreviewConflicts.length, 0)
  const constraintCheckedAtLabel = formatConstraintCheckedAt(constraintCheckResult?.checkedAt)
  const defenseChangeSummary = defenseChangeNotificationInfo?.summary || {}
  const pendingDefenseChangeNotifications = Number(defenseChangeSummary.pendingRecipientCount || 0)
  const sentDefenseChangeNotifications = Number(defenseChangeSummary.sentRecipientCount || 0)
  const changedDefenseCount = Number(defenseChangeSummary.changedDefenseCount || 0)
  const hasDefenseChangePublication = defenseChangeNotificationInfo?.hasCurrentPublication === true
  const hasDefenseChangeBaseline = defenseChangeNotificationInfo?.hasPreviousPublication === true
  const defenseChangeButtonLabel = pendingDefenseChangeNotifications > 0
    ? `Notifier changements (${pendingDefenseChangeNotifications})`
    : sentDefenseChangeNotifications > 0 && changedDefenseCount > 0
      ? 'Changements notifiés'
      : changedDefenseCount > 0
        ? 'Aucun email à envoyer'
        : 'Aucun changement'
  const defenseChangeButtonTitle = pendingDefenseChangeNotifications > 0
    ? `${changedDefenseCount} défense(s) modifiée(s), ${pendingDefenseChangeNotifications} notification(s) à transmettre.`
    : !hasDefenseChangePublication
      ? 'Aucune publication de défenses active.'
      : !hasDefenseChangeBaseline
        ? 'Première publication: utiliser l’envoi normal des liens, pas une notification de changement.'
        : sentDefenseChangeNotifications > 0 && changedDefenseCount > 0
          ? 'Les parties prenantes concernées par les changements ont déjà été notifiées.'
          : 'Aucune modification entre les deux dernières publications des défenses.'
  const finalScheduleSummary = finalScheduleDeliveryPreview?.summary || {}
  const finalScheduleAvailable = finalScheduleDeliveryPreview?.available === true
  const finalSchedulePendingCount = Number(finalScheduleSummary.pendingSendCount || 0)
  const finalScheduleAlreadySentCount = Number(finalScheduleSummary.alreadySentCount || 0)
  const finalScheduleInProgressCount = Number(finalScheduleSummary.inProgressCount || 0)
  const finalScheduleRecipientCount = Number(finalScheduleSummary.recipientCount || 0)
  const finalScheduleSkippedConfigCount = Number(finalScheduleSummary.disabledEmailCount || 0) +
    Number(finalScheduleSummary.missingEmailCount || 0) +
    Number(finalScheduleSummary.personNotFoundCount || 0) +
    Number(finalScheduleSummary.invalidPersonIdCount || 0)
  const finalSchedulePreviewLabel = finalScheduleAvailable
    ? finalSchedulePendingCount > 0
      ? `Prêt: ${finalSchedulePendingCount} à envoyer`
      : finalScheduleInProgressCount > 0
        ? `En cours: ${finalScheduleInProgressCount}`
        : 'A jour'
    : finalScheduleDeliveryPreview
      ? 'Publication manquante'
      : 'Préparer final'
  const finalScheduleStatusNote = [
    `${finalScheduleRecipientCount} destinataire(s)`,
    finalScheduleAlreadySentCount > 0 ? `${finalScheduleAlreadySentCount} déjà envoyé(s)` : '',
    finalScheduleInProgressCount > 0 ? `${finalScheduleInProgressCount} en cours` : '',
    finalScheduleSkippedConfigCount > 0 ? `${finalScheduleSkippedConfigCount} non envoyable(s)` : ''
  ].filter(Boolean).join(', ')
  const finalScheduleSendDisabled = workflowActionLoading ||
    !finalScheduleAvailable ||
    finalSchedulePendingCount <= 0 ||
    typeof onSendFinalScheduleDelivery !== 'function'

  const [selectedCaseId, setSelectedCaseId] = useState('')
  const detailPanelRef = useRef(null)
  const [readyWorkspaceHeight, setReadyWorkspaceHeight] = useState(null)

  useEffect(() => {
    if (!rows.length) {
      setSelectedCaseId('')
      return
    }

    if (!rows.some((row) => row.id === selectedCaseId)) {
      setSelectedCaseId(rows[0].id)
    }
  }, [rows, selectedCaseId])

  useEffect(() => {
    if (!constraintCheckResult?.checkedAt || constraintConflicts.length === 0 || rows.length === 0) {
      return
    }

    const conflictIds = new Set(constraintConflicts.map((conflict) => compactText(conflict?.tpiId)))
    const firstVisibleConflict = rows.find((row) => conflictIds.has(compactText(row.id)))

    if (firstVisibleConflict && selectedCaseId !== firstVisibleConflict.id) {
      setSelectedCaseId(firstVisibleConflict.id)
    }
  }, [constraintCheckResult?.checkedAt, constraintConflicts, rows, selectedCaseId])

  const selectedRow = rows.find((row) => row.id === selectedCaseId) || rows[0] || null
  const isReadyToCloseWorkspace = (
    (Array.isArray(activeSections)
      && activeSections.length === 1
      && compactText(activeSections[0]?.id) === 'ready')
    || compactText(selectedRow?.bucket) === 'ready'
  )
  const readyWorkspaceHeightStyle = isReadyToCloseWorkspace && Number.isFinite(readyWorkspaceHeight)
    ? { '--vote-command-ready-workspace-height': `${readyWorkspaceHeight}px` }
    : {}

  useEffect(() => {
    if (!isReadyToCloseWorkspace) {
      setReadyWorkspaceHeight(null)
      return
    }

    const detailPanel = detailPanelRef.current
    if (!detailPanel) {
      return
    }

    const updateHeight = () => {
      const nextHeight = Math.ceil(detailPanel.getBoundingClientRect().height)

      if (nextHeight > 0) {
        setReadyWorkspaceHeight((currentHeight) => (
          currentHeight === nextHeight ? currentHeight : nextHeight
        ))
      }
    }

    let raf = 0
    const queueMeasure = () => {
      if (raf) {
        window.cancelAnimationFrame(raf)
      }

      raf = window.requestAnimationFrame(updateHeight)
    }

    updateHeight()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(queueMeasure)
      observer.observe(detailPanel)

      window.addEventListener('resize', queueMeasure)
      return () => {
        observer.disconnect()
        window.removeEventListener('resize', queueMeasure)
        if (raf) {
          window.cancelAnimationFrame(raf)
        }
      }
    }

    window.addEventListener('resize', queueMeasure)
    return () => {
      window.removeEventListener('resize', queueMeasure)
      if (raf) {
        window.cancelAnimationFrame(raf)
      }
    }
  }, [isReadyToCloseWorkspace])

  const selectedConstraint = selectedRow ? checkedConstraintByTpiId?.[selectedRow.id] : null
  const selectedDescriptor = selectedRow ? getCaseDescriptor(selectedRow, selectedConstraint) : null
  const selectedBestSlot = selectedRow ? getBestDecisionSlot(selectedRow) : null
  const selectedSatisfaction = selectedRow ? getMovedVoteSatisfaction(selectedRow) : null
  const selectedResolutionProposal = selectedRow ? getLatestResolutionProposal(selectedRow) : null
  const selectedResolutionTone = getResolutionStatusTone(selectedResolutionProposal?.status)
  const selectedResolutionSlot = selectedResolutionProposal
    ? (
        (Array.isArray(selectedRow?.decisionSlots) ? selectedRow.decisionSlots : []).find((slot) =>
          compactText(slot?.slotId) === compactText(selectedResolutionProposal?.proposedSlotId)
        ) || {
          slotId: compactText(selectedResolutionProposal?.proposedSlotId),
          label: compactText(selectedResolutionProposal?.proposedSlotLabel) || 'Créneau proposé',
          positiveCount: Number(selectedResolutionProposal?.counts?.accepted || 0),
          rejectedCount: Number(selectedResolutionProposal?.counts?.rejected || 0)
        }
      )
    : null
  const canOpenResolutionProposal = Boolean(
    selectedRow &&
    normalizeCoordinationStatus(selectedRow.tpi?.status) !== COORDINATION_STATUS.CONFIRMED &&
    (selectedRow.hasHardConstraint || selectedConstraint?.hasHardConstraint || selectedRow.bucket === 'manual')
  )
  const selectedResolutionCandidateSlot = selectedResolutionSlot || selectedBestSlot
  const canSendResolutionProposal = Boolean(
    canOpenResolutionProposal &&
    compactText(selectedResolutionCandidateSlot?.slotId)
  )
  const canConfirmResolutionProposal = Boolean(
    selectedResolutionProposal?.status === 'accepted' &&
    compactText(selectedResolutionSlot?.slotId) &&
    normalizeCoordinationStatus(selectedRow?.tpi?.status) !== COORDINATION_STATUS.CONFIRMED
  )
  const inboxTitle = selectedRow ? getQueueTitle(selectedRow) : 'Réponses reçues'
  const [selectedRoleByCaseId, setSelectedRoleByCaseId] = useState({})
  const selectedRole = selectedRow
    ? selectedRoleByCaseId[selectedRow.id] || getDefaultSelectedRole(selectedRow)
    : ''

  const selectedRoleEntry = selectedRow?.roleEntries.find((entry) => entry.role === selectedRole) ||
    selectedRow?.roleEntries.find((entry) => entry.role === getDefaultSelectedRole(selectedRow)) ||
    null
  const selectedRoleTone = selectedRoleEntry ? getVoteRoleTone(selectedRoleEntry.status) : 'pending'
  const selectedRoleHasResponded = selectedRoleEntry ? hasVoteRoleResponded(selectedRoleEntry.status) : false
  const selectedRoleProposal = selectedRow?.proposalSummaries.find((summary) => summary.role === selectedRoleEntry?.role) || null
  const selectedRoleProposalSlotsById = useMemo(() => {
    const slotsById = new Map()

    if (!selectedRoleProposal?.slots?.length) {
      return slotsById
    }

    selectedRoleProposal.slots.forEach((slot) => {
      const slotId = compactText(slot?.slotId)
      if (slotId) {
        slotsById.set(slotId, slot)
      }
    })

    return slotsById
  }, [selectedRoleProposal])
  const selectedRoleSlotDecisions = useMemo(() => {
    if (!selectedRow || !selectedRoleEntry) {
      return []
    }

    return selectedRow.decisionSlots.map((slot) => {
      const rawDecision = getDecisionForRole(slot, selectedRoleEntry.role)
      const slotId = compactText(slot.slotId)
      const isOnlyAvailabilityProposal = Boolean(
        selectedRoleProposal?.hasHardConstraint &&
        isOnlyAvailabilityVoteComment(selectedRoleProposal?.comment) &&
        selectedRoleProposalSlotsById.has(slotId) &&
        rawDecision?.decision === 'preferred'
      )
      const decision = isOnlyAvailabilityProposal
        ? {
            ...rawDecision,
            comment: rawDecision.comment || 'Seule disponibilité signalée.',
            hardConstraint: true
          }
        : rawDecision
      const isRiskSlot = selectedConstraint?.hasHardConstraint && (
        slot.hasHardConstraint ||
        selectedConstraint.riskySlotIds?.includes(slotId)
      )

      return {
        slot,
        decision,
        proposalSlot: selectedRoleProposalSlotsById.get(slotId) || null,
        tone: decision.hardConstraint || isOnlyAvailabilityVoteComment(decision.comment)
          ? 'hard'
          : getSlotDecisionTone(decision.decision),
        isRiskSlot
      }
    })
  }, [selectedRow, selectedRoleEntry, selectedConstraint, selectedRoleProposal, selectedRoleProposalSlotsById])
  const selectedRoleVoterName = compactText(selectedRoleEntry?.status?.voterName) ||
    selectedRoleSlotDecisions.map((item) => compactText(item.decision?.voterName)).find(Boolean) ||
    compactText(selectedRoleProposal?.voterName)
  const selectedRoleSpecialDateLabel = formatSpecialRequestDate(selectedRoleProposal?.specialRequestDate)
  const selectedRoleSpecialDateShortLabel = formatVoteDate(selectedRoleProposal?.specialRequestDate)
  const selectedRoleComment = compactText(selectedRoleProposal?.comment)
  const selectedRoleSpecialPreview = [
    selectedRoleSpecialDateShortLabel,
    compactText(selectedRoleProposal?.specialRequestReason),
    selectedRoleComment
  ].filter(Boolean).join(' · ')
  const selectedRoleHasSpecialRequest = Boolean(
    selectedRoleProposal?.hasAvailabilityException ||
    selectedRoleProposal?.hasHardConstraint ||
    selectedRoleComment ||
    compactText(selectedRoleProposal?.specialRequestReason) ||
    selectedRoleSpecialDateLabel
  )
  const selectedRoleHasHardSlotDecision = selectedRoleSlotDecisions.some((item) =>
    item.decision?.hardConstraint || isOnlyAvailabilityVoteComment(item.decision?.comment)
  )
  const selectedRoleHasOnlyAvailabilityHardSlot = selectedRoleSlotDecisions.some((item) =>
    !item.slot?.isFixed &&
    item.decision?.hardConstraint &&
    isOnlyAvailabilityVoteComment(item.decision?.comment || selectedRoleProposal?.comment)
  )
  const selectedRoleShouldShowSpecialRequest = selectedRoleHasSpecialRequest && !selectedRoleHasHardSlotDecision
  const selectedRoleCanForceOk = Boolean(
    selectedRow &&
    selectedRoleEntry &&
    typeof onForceVoteOk === 'function' &&
    canForceOkRole(selectedRow, selectedRoleEntry.role, false)
  )

  const primaryAction = getPrimaryAction({
    workflowState,
    isPublishedState,
    hasActiveSnapshot,
    canStartVotes,
    canPublish,
    hasLegacyImportGap,
    workflowActionLoading,
    stats,
    staticVotePublicationInfo,
    onFreezePlanification,
    onStartVotesCampaign,
    onRemindVotes,
    onSyncStaticVotePublication,
    onCloseVotes,
    onPublishDefinitive,
    onOpenPublishedView
  })

  return (
    <section className="vote-command-center" aria-labelledby="vote-command-title">
      <div className="vote-command-hero">
        <div className="vote-command-title-block">
          <span className="vote-command-kicker">Votes</span>
          <h2 id="vote-command-title">
            <VoteIcon className="section-title-icon" />
            Campagne de votes {year}
          </h2>
          <div className="vote-command-statusline" aria-label="Etat de la campagne">
            <span>{stats.receivedVotes}/{stats.expectedVotes} votes recus</span>
            <span>{stats.completionRate}%</span>
            <span>
              {Number(stats.hardConstraintTpis || 0) > 0
                ? `${stats.hardConstraintTpis} contrainte${stats.hardConstraintTpis > 1 ? 's' : ''}`
                : `${stats.manualTpis} à résoudre`}
            </span>
          </div>
        </div>

        <div className={`vote-command-primary state-${workflowState}`}>
          <span>Action suivante</span>
          <strong>{primaryAction.label}</strong>
          <p>{primaryAction.detail}</p>
          <button
            type="button"
            className="workflow-btn primary"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            title={primaryAction.ariaLabel || primaryAction.label}
            aria-label={primaryAction.ariaLabel || primaryAction.label}
          >
            {primaryAction.icon}
            {isActionRunning(primaryAction.key) ? 'Traitement...' : primaryAction.buttonLabel}
          </button>
        </div>
      </div>

      <div className="vote-command-progress" aria-label="Resume de campagne">
        <div className="vote-command-progress-main">
          <span style={{ width: `${stats.completionRate}%` }} />
        </div>
        <dl>
          <div>
            <dt>Avec réponse</dt>
            <dd>{stats.responseTpis}</dd>
          </div>
          <div>
            <dt>Complets</dt>
            <dd>{stats.readyTpis}</dd>
          </div>
          <div>
            <dt>Demandes</dt>
            <dd>{stats.proposalTpis}</dd>
          </div>
          <div>
            <dt>Contraintes</dt>
            <dd>{stats.hardConstraintTpis}</dd>
          </div>
        </dl>
      </div>

      <div className="vote-command-actions" aria-label="Actions disponibles">
        <div className="vote-command-action-group">
            <span className="vote-command-action-group-title">Planification</span>
            <WorkflowActionButton
              actionKey="autoPlan"
              primaryActionKey={primaryAction.key}
              className="secondary"
              onClick={onAutomatePlanification}
              disabled={workflowActionLoading || !onAutomatePlanification}
              isActionRunning={isActionRunning}
              icon={<RefreshIcon className="button-icon" />}
              runningLabel="Calcul..."
              title="Reconstruire automatiquement la planification depuis la configuration."
            >
              Automatiser
            </WorkflowActionButton>
            <WorkflowActionButton
              actionKey="validate"
              primaryActionKey={primaryAction.key}
              className="neutral"
              onClick={onValidatePlanification}
              disabled={workflowActionLoading}
              isActionRunning={isActionRunning}
              icon={<AlertIcon className="button-icon" />}
              runningLabel="Verification..."
              title="Verifier les conflits avant ouverture."
            >
              Vérifier coordination
            </WorkflowActionButton>
            <WorkflowActionButton
              actionKey="freeze"
              primaryActionKey={primaryAction.key}
              className="secondary"
              onClick={onFreezePlanification}
              disabled={workflowActionLoading || hasLegacyImportGap}
              isActionRunning={isActionRunning}
              icon={<CheckIcon className="button-icon" />}
              runningLabel="Gel..."
              title="Geler la version de planification a voter."
            >
              Geler snapshot
            </WorkflowActionButton>
            <WorkflowActionButton
              actionKey="syncPlanification"
              primaryActionKey={primaryAction.key}
              className="neutral"
              onClick={onSyncPlanificationFromCoordination}
              disabled={workflowActionLoading || !onSyncPlanificationFromCoordination}
              isActionRunning={isActionRunning}
              icon={<RefreshIcon className="button-icon" />}
              runningLabel="Sync..."
              title="Reconstruire Planification depuis Coordination et geler un nouveau snapshot."
            >
              Sync + gel
            </WorkflowActionButton>
            <WorkflowActionButton
              actionKey="startVotes"
              primaryActionKey={primaryAction.key}
              className="primary"
              onClick={onStartVotesCampaign}
              disabled={workflowActionLoading || !canStartVotes || hasLegacyImportGap}
              isActionRunning={isActionRunning}
              icon={<ArrowRightIcon className="button-icon" />}
              runningLabel="Ouverture..."
              title={hasLegacyImportGap
                ? 'Des TPI de GestionTPI ne sont pas encore presents dans Coordination.'
                : hasBlockedValidation
                  ? 'La verification a detecte des anomalies; l action reste possible côté admin.'
                  : !hasActiveSnapshot
                    ? 'Aucun snapshot actif.'
                    : 'Ouvrir la campagne sans envoyer d emails.'}
            >
              Ouvrir votes
            </WorkflowActionButton>
            {IS_DEBUG ? (
              <WorkflowActionButton
                actionKey="startVotesNoEmail"
                primaryActionKey={primaryAction.key}
                className="secondary"
                ariaLabel="Ouvrir votes sans emails"
                onClick={onStartVotesCampaignWithoutEmails}
                disabled={workflowActionLoading || !canStartVotes || hasLegacyImportGap}
                isActionRunning={isActionRunning}
                icon={<VoteIcon className="button-icon" />}
                runningLabel="Ouverture..."
                title="Mode debug: ouvre la campagne sans envoyer les emails automatiques."
              >
                Ouvrir sans emails
              </WorkflowActionButton>
            ) : null}
        </div>

        <div className="vote-command-action-group">
            <span className="vote-command-action-group-title">Campagne</span>
            {movedVoteRelaunchTpiIds.length > 0 ? (
              <WorkflowActionButton
                actionKey="remindMovedVotes"
                primaryActionKey={primaryAction.key}
                className="warning"
                onClick={() => onRemindVotes?.({
                  actionKey: 'remindMovedVotes',
                  tpiIds: movedVoteRelaunchTpiIds,
                  movedOnly: true
                })}
                disabled={workflowActionLoading || typeof onRemindVotes !== 'function'}
                isActionRunning={isActionRunning}
                icon={<MailIcon className="button-icon" />}
                runningLabel="Relance..."
                title="Relancer uniquement les parties prenantes non satisfaites par un TPI déplacé."
                ariaLabel="Relancer les TPI déplacés"
              >
                Relancer déplacés ({movedVoteRelaunchRoleCount})
              </WorkflowActionButton>
            ) : null}
            <WorkflowActionButton
              actionKey="remindVotes"
              primaryActionKey={primaryAction.key}
              className="neutral"
              onClick={onRemindVotes}
              disabled={workflowActionLoading || Number(stats.missingVotes || 0) === 0}
              isActionRunning={isActionRunning}
              icon={<MailIcon className="button-icon" />}
              runningLabel="Relance..."
              title="Renvoyer les liens aux personnes qui n'ont pas encore vote."
              ariaLabel="Relancer sans réponse"
            >
              Relancer
            </WorkflowActionButton>
            <WorkflowActionButton
              actionKey="forceOkProjectLeads"
              primaryActionKey={primaryAction.key}
              className="secondary"
              onClick={() => onForceVoteOk?.({
                actionKey: 'forceOkProjectLeads',
                roles: PROJECT_LEAD_FORCE_OK_ROLES,
                tpiIds: projectLeadForceOkTargets.tpiIds,
                onlyMissing: true,
                label: 'les chefs de projet en attente'
              })}
              disabled={workflowActionLoading || projectLeadForceOkTargets.roleCount === 0 || typeof onForceVoteOk !== 'function'}
              isActionRunning={isActionRunning}
              icon={<CheckIcon className="button-icon" />}
              runningLabel="Forçage..."
              title="Forcer OK pour tous les chefs de projet qui n'ont pas encore répondu."
              ariaLabel="Forcer OK chefs de projet en attente"
            >
              OK chefs ({projectLeadForceOkTargets.roleCount})
            </WorkflowActionButton>
            <WorkflowActionButton
              actionKey="forceOkExperts"
              primaryActionKey={primaryAction.key}
              className="secondary"
              onClick={() => onForceVoteOk?.({
                actionKey: 'forceOkExperts',
                roles: EXPERT_FORCE_OK_ROLES,
                tpiIds: expertForceOkTargets.tpiIds,
                onlyMissing: true,
                label: 'les experts en attente'
              })}
              disabled={workflowActionLoading || expertForceOkTargets.roleCount === 0 || typeof onForceVoteOk !== 'function'}
              isActionRunning={isActionRunning}
              icon={<CheckIcon className="button-icon" />}
              runningLabel="Forçage..."
              title="Forcer OK pour tous les experts qui n'ont pas encore répondu."
              ariaLabel="Forcer OK experts en attente"
            >
              OK experts ({expertForceOkTargets.roleCount})
            </WorkflowActionButton>
            <WorkflowActionButton
              actionKey="closeVotes"
              primaryActionKey={primaryAction.key}
              className="primary"
              onClick={onCloseVotes}
              disabled={workflowActionLoading || Number(stats.totalTpis || 0) === 0}
              isActionRunning={isActionRunning}
              icon={<ArrowRightIcon className="button-icon" />}
              runningLabel="Clôture..."
              title="Clore la campagne et classer chaque TPI."
            >
              Clore campagne
            </WorkflowActionButton>
        </div>

        <div className="vote-command-action-group">
            <span className="vote-command-action-group-title">Vote web</span>
            <p className="vote-command-action-warning">
              {STATIC_VOTE_REGENERATION_NOTICE}
            </p>
            {IS_DEBUG ? (
              <WorkflowActionButton
                actionKey="voteAccessPreview"
                primaryActionKey={primaryAction.key}
                className="open"
                onClick={onOpenVoteAccessPreview}
                disabled={workflowActionLoading}
                isActionRunning={isActionRunning}
                icon={<VoteIcon className="button-icon" />}
                runningLabel="Ouverture..."
                title="Ouvre l'aperçu des liens de vote."
              >
                Voir liens vote
              </WorkflowActionButton>
            ) : null}
            <WorkflowActionButton
              actionKey="staticVoteGenerate"
              primaryActionKey={primaryAction.key}
              className="secondary"
              onClick={onGenerateStaticVotePublication}
              disabled={workflowActionLoading || Number(stats.totalTpis || 0) === 0}
              isActionRunning={isActionRunning}
              icon={<VoteIcon className="button-icon" />}
              runningLabel="Generation..."
              title="Préparer localement la publication PHP de vote."
              ariaLabel="Préparer vote web"
            >
              Préparer
            </WorkflowActionButton>
            <WorkflowActionButton
              actionKey="staticVotePublish"
              primaryActionKey={primaryAction.key}
              className="open"
              onClick={onPublishStaticVotePublication}
              disabled={workflowActionLoading || !staticVotePublicationInfo?.available}
              isActionRunning={isActionRunning}
              icon={<SendIcon className="button-icon" />}
              runningLabel="Publication..."
              title={staticVotePublicationInfo?.available
                ? 'Publier le dossier vote genere par FTP.'
                : 'Generer le mini-site vote avant de publier.'}
              ariaLabel="Mettre vote web en ligne"
            >
              Publier web
            </WorkflowActionButton>
            <WorkflowActionButton
              actionKey="staticVoteSync"
              primaryActionKey={primaryAction.key}
              className="neutral"
              onClick={onSyncStaticVotePublication}
              disabled={workflowActionLoading || !staticVotePublicationInfo?.syncSecretConfigured}
              isActionRunning={isActionRunning}
              icon={<RefreshIcon className="button-icon" />}
              runningLabel="Sync..."
              title={staticVotePublicationInfo?.syncSecretConfigured
                ? 'Importer les reponses stockees sur le mini-site vote.'
                : 'Configurer STATIC_VOTE_SYNC_SECRET avant de synchroniser.'}
              ariaLabel="Importer réponses web"
            >
              Importer
            </WorkflowActionButton>
        </div>

        {Number(stats.responseTpis || 0) > 0 || Number(stats.manualTpis || 0) > 0 ? (
          <div className="vote-command-action-group">
            <span className="vote-command-action-group-title">Traitement</span>
            {Number(stats.responseTpis || 0) > 0 ? (
              <WorkflowActionButton
                actionKey="checkConstraints"
                primaryActionKey={primaryAction.key}
                className="warning"
                onClick={onCheckVoteConstraints}
                disabled={workflowActionLoading}
                isActionRunning={isActionRunning}
                icon={<AlertIcon className="button-icon" />}
                runningLabel="Verification..."
                title="Repérer les contraintes dures signalées dans les réponses reçues."
                ariaLabel="Vérifier contraintes"
              >
                Vérifier
              </WorkflowActionButton>
            ) : null}

            {Number(stats.manualTpis || 0) > 0 ? (
              <WorkflowActionButton
                actionKey="openManual"
                primaryActionKey={primaryAction.key}
                className="open"
                onClick={() => onOpenManualResolver(null)}
                disabled={workflowActionLoading}
                isActionRunning={isActionRunning}
                icon={<WrenchIcon className="button-icon" />}
                runningLabel="Ouverture..."
                title="Ouvrir la vue de résolution manuelle."
                ariaLabel="Ouvrir la vue pour résoudre les créneaux manuels."
              >
                Résoudre
              </WorkflowActionButton>
            ) : null}
          </div>
        ) : null}

        <div className="vote-command-action-group">
            <span className="vote-command-action-group-title">Publication</span>
            <WorkflowActionButton
              actionKey="publish"
              primaryActionKey={primaryAction.key}
              className="success"
              onClick={onPublishDefinitive}
              disabled={workflowActionLoading || !canPublish}
              isActionRunning={isActionRunning}
              icon={<CheckIcon className="button-icon" />}
              runningLabel="Publication..."
              title="Publier les défenses selon les données disponibles."
              ariaLabel="Publier défenses"
            >
              Publier
            </WorkflowActionButton>
            <WorkflowActionButton
              actionKey="sendLinks"
              primaryActionKey={primaryAction.key}
              className="secondary"
              onClick={onSendPublicationLinks}
              disabled={workflowActionLoading || !onSendPublicationLinks}
              isActionRunning={isActionRunning}
              icon={<MailIcon className="button-icon" />}
              runningLabel="Envoi..."
              title="Envoyer les liens personnels de consultation des défenses."
              ariaLabel="Envoyer liens défense."
            >
              Envoyer liens
            </WorkflowActionButton>
            <WorkflowActionButton
              actionKey="previewFinalScheduleDelivery"
              primaryActionKey={primaryAction.key}
              className="neutral"
              onClick={onPreviewFinalScheduleDelivery}
              disabled={workflowActionLoading || typeof onPreviewFinalScheduleDelivery !== 'function'}
              isActionRunning={isActionRunning}
              icon={<FileTextIcon className="button-icon" />}
              runningLabel="Préparation..."
              title="Préparer l’aperçu des emails finaux avec iCal et PDF joints."
              ariaLabel="Préparer l’envoi final des horaires."
            >
              {finalSchedulePreviewLabel}
            </WorkflowActionButton>
            <WorkflowActionButton
              actionKey="sendFinalScheduleDelivery"
              primaryActionKey={primaryAction.key}
              className="success"
              onClick={onSendFinalScheduleDelivery}
              disabled={finalScheduleSendDisabled}
              isActionRunning={isActionRunning}
              icon={<SendIcon className="button-icon" />}
              runningLabel="Envoi..."
              title={finalScheduleAvailable
                ? 'Envoyer iCal personnel, PDF personnel et PDF global des salles.'
                : 'Préparer l’aperçu final avant l’envoi.'}
              ariaLabel="Envoyer les horaires définitifs avec pièces jointes."
            >
              Envoyer horaires
            </WorkflowActionButton>
            {finalScheduleDeliveryPreview ? (
              <span className={`vote-command-action-note ${finalScheduleAvailable ? 'is-ok' : 'is-warning'}`.trim()}>
                {finalScheduleAvailable
                  ? `${finalScheduleStatusNote}.`
                  : 'Aucune publication de défenses active: publier les défenses avant l’envoi final.'}
              </span>
            ) : null}
            {pendingDefenseChangeNotifications > 0 ? (
              <span className="vote-command-action-warning">
                {changedDefenseCount} défense{changedDefenseCount > 1 ? 's' : ''} modifiée{changedDefenseCount > 1 ? 's' : ''}, notification ciblée à transmettre.
              </span>
            ) : null}
            <WorkflowActionButton
              actionKey="notifyDefenseChanges"
              primaryActionKey={primaryAction.key}
              className={pendingDefenseChangeNotifications > 0 ? 'warning' : 'neutral'}
              onClick={onSendDefenseChangeNotifications}
              disabled={workflowActionLoading || !onSendDefenseChangeNotifications || pendingDefenseChangeNotifications <= 0}
              isActionRunning={isActionRunning}
              icon={<MailIcon className="button-icon" />}
              runningLabel="Notification..."
              title={defenseChangeButtonTitle}
              ariaLabel="Notifier les changements des défenses."
            >
              {defenseChangeButtonLabel}
            </WorkflowActionButton>
            <WorkflowActionButton
              actionKey="published"
              primaryActionKey={primaryAction.key}
              className="success"
              onClick={onOpenPublishedView}
              disabled={workflowActionLoading}
              isActionRunning={isActionRunning}
              icon={<CheckIcon className="button-icon" />}
              runningLabel="Ouverture..."
              title="Afficher les défenses publiées."
              ariaLabel="Ouvrir défenses."
            >
              Ouvrir défenses
            </WorkflowActionButton>
        </div>
      </div>

      {constraintCheckResult ? (
        <div className={`vote-command-alert ${constraintCheckResult.conflictCount > 0 ? 'is-warning' : 'is-ok'}`}>
          <div>
            <strong>
              {constraintCheckResult.conflictCount > 0
                ? `${constraintCheckResult.impactedTpiCount} TPI avec contrainte dure`
                : 'Aucune contrainte dure'}
            </strong>
            <span>
              {constraintCheckResult.conflictCount > 0
                ? `${constraintCheckResult.conflictCount} signalement${constraintCheckResult.conflictCount > 1 ? 's' : ''} à traiter.`
                : `${constraintCheckResult.checkedResponseTpiCount || 0} TPI avec réponse vérifié${Number(constraintCheckResult.checkedResponseTpiCount || 0) > 1 ? 's' : ''}.`}
              {constraintCheckedAtLabel ? ` · ${constraintCheckedAtLabel}` : ''}
            </span>
          </div>
          {constraintPreviewConflicts.length > 0 ? (
            <ul>
              {constraintPreviewConflicts.map((conflict, index) => (
                <li key={`${conflict.tpiId}-${conflict.role || index}`}>
                  <button
                    type="button"
                    className="vote-command-alert-item"
                    onClick={() => setSelectedCaseId(compactText(conflict.tpiId))}
                    aria-label={`Afficher ${conflict.reference} pour traiter la contrainte.`}
                  >
                    <span>{conflict.reference}</span>
                    <strong>{conflict.message}</strong>
                    <small>{conflict.recommendation}</small>
                  </button>
                </li>
              ))}
              {hiddenConstraintCount > 0 ? (
                <li className="vote-command-alert-more">
                  {hiddenConstraintCount} autre{hiddenConstraintCount > 1 ? 's' : ''} signalement{hiddenConstraintCount > 1 ? 's' : ''}.
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}

      {Number(stats.totalTpis || 0) === 0 ? (
        <div className="vote-command-empty">
          <strong>Aucune donnee de vote visible pour cette annee.</strong>
          <p>Snapshot requis avant campagne.</p>
        </div>
      ) : responseAllRowsCount === 0 ? (
        <div className="vote-command-empty">
          <strong>Aucune réponse reçue pour le moment.</strong>
          <p>La liste affichera uniquement les TPI dès qu'un expert ou chef de projet aura répondu.</p>
        </div>
      ) : (
        <div
          className={`vote-command-workspace${isReadyToCloseWorkspace ? ' vote-command-workspace-ready' : ''}`}
          style={readyWorkspaceHeightStyle}
        >
          <aside className="vote-command-inbox" aria-label="File des réponses reçues">
            <div className="vote-command-inbox-head">
              <div>
                <h3>{inboxTitle}</h3>
                <span>{rows.length}/{responseAllRowsCount} TPI avec réponse</span>
              </div>
            </div>

            <div className="vote-command-case-list">
              {rows.length > 0 ? rows.map((row) => {
                const checkedConstraint = checkedConstraintByTpiId?.[row.id]
                const descriptor = getCaseDescriptor(row, checkedConstraint)
                const hasCheckedConstraint = Boolean(checkedConstraint?.hasHardConstraint)
                const latestResolutionProposal = getLatestResolutionProposal(row)

                return (
                  <article
                    key={row.id}
                    className={`vote-command-case is-${descriptor.tone} ${selectedRow?.id === row.id ? 'is-selected' : ''} ${hasCheckedConstraint ? 'has-hard-constraint' : ''}`}
                  >
                    <button
                      type="button"
                      className="vote-command-case-main"
                      onClick={() => setSelectedCaseId(row.id)}
                      aria-pressed={selectedRow?.id === row.id}
                    >
                      <span className="vote-command-case-status">{descriptor.label}</span>
                      <strong>{row.reference}</strong>
                      <span>{row.candidate}</span>
                      <small>{descriptor.detail}</small>
                      {latestResolutionProposal ? (
                        <small className={`vote-command-resolution-inline is-${getResolutionStatusTone(latestResolutionProposal.status)}`}>
                          {getResolutionStatusLabel(latestResolutionProposal)} · {getResolutionStatusDetail(latestResolutionProposal)}
                        </small>
                      ) : null}
                    </button>
                    {row.bucket === 'manual' ? (
                      <button
                        type="button"
                        className="vote-command-case-action is-force"
                        onClick={() => onOpenManualResolver(row.tpi)}
                        title={`Résoudre le créneau manuel de ${row.reference} depuis la file.`}
                        aria-label={`Résoudre le créneau manuel de ${row.reference} depuis la file.`}
                      >
                        Résoudre
                      </button>
                    ) : null}
                  </article>
                )
              }) : (
                <div className="vote-command-case-empty">
                  Aucune réponse dans cette file avec les filtres actuels.
                </div>
              )}
            </div>
          </aside>

          <section className="vote-command-detail" aria-label="Dossier vote selectionne" ref={detailPanelRef}>
            {selectedRow ? (
              <>
                <header className="vote-command-detail-head">
                  <div>
                    <h3>Dossier {selectedRow.reference}</h3>
                    <p>{selectedRow.candidate}</p>
                  </div>
                  <div className="vote-command-detail-actions">
                    <button
                      type="button"
                      className="vote-command-link-button"
                      onClick={() => onSelectTpi(selectedRow.tpi)}
                      aria-label={`Afficher la fiche ${selectedRow.reference}.`}
                    >
                      <FileTextIcon className="button-icon" />
                      Voir fiche
                    </button>
                    {selectedRow.bucket === 'manual' ? (
                      <button
                        type="button"
                        className="vote-command-link-button is-force"
                        onClick={() => onOpenManualResolver(selectedRow.tpi)}
                        aria-label={`Résoudre le créneau manuel de ${selectedRow.reference} depuis le détail.`}
                      >
                        <WrenchIcon className="button-icon" />
                        Résoudre
                      </button>
                    ) : null}
                    {canSendResolutionProposal && selectedResolutionProposal?.status !== 'accepted' ? (
                      <button
                        type="button"
                        className="vote-command-link-button is-resolution"
                        onClick={() => onOpenResolutionProposal?.(selectedRow.tpi, selectedRow, selectedResolutionCandidateSlot)}
                        disabled={resolutionProposalSubmitting}
                        title="Envoyer un email avec lien d'accord ou refus."
                        aria-label={`Transmettre une proposition d'arbitrage pour ${selectedRow.reference}.`}
                      >
                        <MailIcon className="button-icon" />
                        {resolutionProposalSubmitting ? '...' : 'Informer'}
                      </button>
                    ) : null}
                    {selectedBestSlot && !selectedRow.hasHardConstraint && normalizeCoordinationStatus(selectedRow.tpi?.status) !== COORDINATION_STATUS.CONFIRMED ? (
                      <button
                        type="button"
                        className="vote-command-link-button is-primary"
                        onClick={() => onForceVoteSlot(selectedRow.tpi, selectedBestSlot)}
                        disabled={workflowActionLoading}
                        aria-label={`${getAdminSlotActionLabel(selectedBestSlot)} la recommandation pour ${selectedRow.reference}.`}
                        title={`${getAdminSlotActionLabel(selectedBestSlot)} ${selectedBestSlot.label}.`}
                      >
                        <CheckIcon className="button-icon" />
                        {getAdminSlotActionLabel(selectedBestSlot)}
                      </button>
                    ) : null}
                    {canConfirmResolutionProposal ? (
                      <button
                        type="button"
                        className="vote-command-link-button is-primary"
                        onClick={() => onForceVoteSlot(selectedRow.tpi, selectedResolutionSlot)}
                        disabled={workflowActionLoading}
                        title={`Confirmer ${selectedResolutionSlot.label} après accord complet.`}
                        aria-label={`Confirmer ${selectedResolutionSlot.label} après accord complet pour ${selectedRow.reference}.`}
                      >
                        <CheckIcon className="button-icon" />
                        Confirmer
                      </button>
                    ) : null}
                  </div>
                </header>

                <div className="vote-command-recommendation">
                  <strong>{getRecommendationTitle(selectedRow, selectedDescriptor)}</strong>
                  <span>
                    {selectedRow.respondedCount}/3 reponses
                  </span>
                </div>

                {selectedSatisfaction ? (
                  <div className={`vote-command-satisfaction ${Number(selectedSatisfaction.delta || 0) >= 0 ? 'is-better' : 'is-worse'}`}>
                    <strong>
                      Déplacement: {selectedSatisfaction.currentPositiveCount}/3 accord{Number(selectedSatisfaction.currentPositiveCount || 0) > 1 ? 's' : ''}
                      {' '}
                      contre {selectedSatisfaction.baselinePositiveCount}/3 sur la base
                    </strong>
                    <span>
                      {formatSatisfactionSlot(selectedSatisfaction.baselineSlot)} → {formatSatisfactionSlot(selectedSatisfaction.currentSlot)}
                    </span>
                    {Number(selectedSatisfaction.touchedRoleCount || 0) > 0 ? (
                      <small>
                        Relance ciblée: {selectedSatisfaction.touchedRoles.map((entry) =>
                          compactText(entry.voterName) || getVoterRoleLabel(entry.role)
                        ).filter(Boolean).join(', ')}
                      </small>
                    ) : (
                      <small>Aucune relance nécessaire: toutes les parties prenantes sont satisfaites.</small>
                    )}
                  </div>
                ) : null}

                <div className="vote-command-detail-facts">
                  <span>
                    <CalendarIcon className="inline-icon" />
                    {selectedRow.fixedSlotLabel}
                    {selectedRow.hasLivePlanningSlot ? (
                      <small>Planification courante</small>
                    ) : null}
                  </span>
                  <span>{selectedRow.deadlineLabel || 'Echeance non definie'}</span>
                </div>

                {selectedResolutionProposal ? (
                  <div className={`vote-command-resolution is-${selectedResolutionTone}`}>
                    <div className="vote-command-resolution-head">
                      <div>
                        <strong>{getResolutionStatusLabel(selectedResolutionProposal)}</strong>
                        <span>{getResolutionStatusDetail(selectedResolutionProposal)}</span>
                      </div>
                      <small>{selectedResolutionProposal.proposedSlotLabel || selectedResolutionSlot?.label || 'Créneau proposé'}</small>
                    </div>
                    <div className="vote-command-resolution-recipients">
                      {getResolutionRecipients(selectedResolutionProposal).map((recipient) => {
                        const responseStatus = compactText(recipient?.responseStatus) || 'pending'
                        const recipientState = compactText(recipient?.deliveryStatus) === 'failed'
                          ? 'delivery_failed'
                          : responseStatus
                        const note = [
                          compactText(recipient?.deliveryError),
                          compactText(recipient?.responseReason),
                          compactText(recipient?.alternativeProposal)
                        ].filter(Boolean).join(' · ')

                        return (
                          <div key={`${recipient.role}-${recipient.email || recipient.name}`} className={`vote-command-resolution-recipient is-${recipientState}`}>
                            <span>{recipient.roleLabel || getVoterRoleLabel(recipient.role)}</span>
                            <strong>{getResolutionRecipientLabel(recipientState)}</strong>
                            {note ? <small title={note}>{note}</small> : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="vote-command-roles" role="tablist" aria-label={`Votes ${selectedRow.reference}`}>
                  {selectedRow.roleEntries.map((entry) => {
                    const tone = getVoteRoleTone(entry.status)
                    const isActiveRole = selectedRoleEntry?.role === entry.role

                    return (
                      <button
                        key={entry.role}
                        type="button"
                        role="tab"
                        aria-selected={isActiveRole}
                        className={`vote-command-role is-${tone} ${isActiveRole ? 'is-active' : ''}`}
                        onClick={() => setSelectedRoleByCaseId((current) => ({
                          ...current,
                          [selectedRow.id]: entry.role
                        }))}
                        title={entry.status?.specialRequestReason || undefined}
                      >
                        <strong>{entry.label}</strong>
                        <span>{getVoteRoleStatusLabel(entry.status)}</span>
                      </button>
                    )
                  })}
                </div>

                {selectedRoleEntry ? (
                  <div
                    className={`vote-command-role-detail is-${selectedRoleTone}`}
                    role="tabpanel"
                    aria-label={`Réponse ${selectedRoleEntry.label} ${selectedRow.reference}`}
                  >
                    <div className="vote-command-role-detail-head">
                      <div>
                        <strong>Réponse de {selectedRoleEntry.label}</strong>
                        <span>{selectedRoleVoterName || 'Personne non identifiée'}</span>
                      </div>
                      <div className="vote-command-role-detail-actions">
                        <p>
                          {selectedRoleHasResponded
                            ? 'Ce rôle a répondu. Les choix ci-dessous sont ceux à traiter.'
                            : 'Aucune réponse reçue pour ce rôle.'}
                        </p>
                        {selectedRoleCanForceOk ? (
                          <button
                            type="button"
                            className="vote-command-mini-button is-force-ok"
                            onClick={() => onForceVoteOk?.({
                              roles: [selectedRoleEntry.role],
                              tpiIds: [selectedRow.id],
                              onlyMissing: false,
                              label: `${selectedRoleEntry.label} de ${selectedRow.reference}`
                            })}
                            disabled={workflowActionLoading}
                            title={`Forcer OK pour ${selectedRoleEntry.label} sur ${selectedRow.reference}.`}
                            aria-label={`Forcer OK pour ${selectedRoleEntry.label} sur ${selectedRow.reference}.`}
                          >
                            <CheckIcon className="button-icon" />
                            Forcer OK
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {selectedRoleShouldShowSpecialRequest ? (
                      <span
                        className={`vote-command-special ${selectedRoleProposal?.hasHardConstraint ? 'is-hard' : 'is-special'}`}
                        title={[
                          selectedRoleProposal?.hasHardConstraint ? 'Contrainte dure' : '',
                          selectedRoleSpecialDateLabel,
                          selectedRoleProposal?.specialRequestReason
                        ].map(compactText).filter(Boolean).join(' - ')}
                      >
                        {selectedRoleProposal?.hasHardConstraint ? 'Contrainte dure' : 'Demande spécifique'}{selectedRoleSpecialPreview ? ` ${selectedRoleSpecialPreview}` : ''}
                      </span>
                    ) : null}

                    <div className="vote-command-role-slot-list">
                      {selectedRoleSlotDecisions.map(({ slot, decision, proposalSlot, tone, isRiskSlot }) => {
                        const isOnlyAvailabilityNote = isOnlyAvailabilityVoteComment(decision.comment)
                        const isBlockingDecision = Boolean(decision.hardConstraint || isOnlyAvailabilityNote)
                        const isConfirmedCase = normalizeCoordinationStatus(selectedRow.tpi?.status) === COORDINATION_STATUS.CONFIRMED
                        const shouldHideOnlyAvailabilityNote = Boolean(
                          slot.isFixed &&
                          selectedRoleHasOnlyAvailabilityHardSlot &&
                          isOnlyAvailabilityNote
                        )
                        const note = [
                          shouldHideOnlyAvailabilityNote ? '' : decision.comment,
                          decision.specialRequestReason
                        ].map(compactText).filter(Boolean).join(' · ')
                        const moveKey = `${selectedRow.id}:${slot.slotId}:move`
                        const preferenceKey = `${proposalSlot?.voteId || selectedRoleEntry.role}:${slot.slotId}`
                        const isMoveLoading = proposalMoveLoadingKey === `${selectedRow.id}:${slot.slotId}` ||
                          proposalMoveLoadingKey === `${compactText(selectedRow.tpi?._id)}:${slot.slotId}`
                        const isPreferenceLoading = preferenceActionLoadingKey === preferenceKey
                        const canSaveProposalPreference = Boolean(proposalSlot?.voteId)
                        const canShowSlotActions = Boolean(!isConfirmedCase || canSaveProposalPreference)

                        return (
                          <article
                            key={`${selectedRoleEntry.role}-${slot.slotId}`}
                            className={`vote-command-role-slot is-${tone} ${isRiskSlot ? 'is-risk' : ''}`}
                          >
                            <div className="vote-command-role-slot-main">
                              <span>
                                {slot.isFixed
                                  ? 'Créneau proposé'
                                  : isOnlyAvailabilityNote
                                    ? 'Seule disponibilité'
                                    : isBlockingDecision
                                      ? 'Blocant'
                                      : 'Alternative'}
                              </span>
                              <strong>{slot.label}</strong>
                            </div>
                            <span className={`vote-command-role-decision is-${tone}`}>
                              {decision.hardConstraint ? 'Contrainte dure' : getSlotDecisionLabel(decision.decision, slot.isFixed)}
                            </span>
                            {note ? <p>{note}</p> : null}
                            <div className="vote-command-role-slot-meta">
                              <span>{slot.positiveCount}/3 accord</span>
                              <span>{slot.rejectedCount} refus</span>
                            </div>
                            {canShowSlotActions ? (
                              <div className="vote-command-role-slot-actions">
                                {!isConfirmedCase ? (
                                  <button
                                    type="button"
                                    className={`vote-command-slot-action ${slot.positiveCount >= 3 ? 'is-consensus' : ''}`}
                                    onClick={() => onForceVoteSlot(selectedRow.tpi, slot)}
                                    disabled={workflowActionLoading}
                                    title={`${getAdminSlotActionLabel(slot)} ${slot.label}.`}
                                    aria-label={`${getAdminSlotActionLabel(slot)} ${slot.label} pour ${selectedRow.reference}.`}
                                  >
                                    {getAdminSlotActionLabel(slot)}
                                  </button>
                                ) : null}
                                {!isConfirmedCase && proposalSlot && !isBlockingDecision ? (
                                  <button
                                    type="button"
                                    className="vote-command-mini-button"
                                    onClick={() => onReviewVoteProposalMove(selectedRow.tpi, selectedRoleProposal, proposalSlot)}
                                    disabled={isMoveLoading || proposalMoveApplying}
                                    title={`Tester le déplacement de ${selectedRow.reference} vers ${proposalSlot.label}.`}
                                    aria-label={`Tester le déplacement de ${selectedRow.reference} vers ${proposalSlot.label}.`}
                                    data-action-key={moveKey}
                                  >
                                    <ArrowRightIcon className="button-icon" />
                                    {isMoveLoading ? '...' : 'Tester'}
                                  </button>
                                ) : null}
                                {canSaveProposalPreference ? (
                                  <button
                                    type="button"
                                    className="vote-command-mini-button is-preference"
                                    onClick={() => onInsertProposalPreference(selectedRoleProposal, proposalSlot)}
                                    disabled={isPreferenceLoading}
                                    title="Enregistrer cette proposition comme date idéale du votant, sans déplacer le TPI."
                                    aria-label={`Enregistrer ${proposalSlot.label} comme date idéale de ${selectedRoleVoterName || selectedRoleEntry.label}.`}
                                  >
                                    <PinIcon className="button-icon" />
                                    {isPreferenceLoading ? '...' : 'Préférence'}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </article>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="vote-command-empty">
                <strong>Aucun dossier selectionne.</strong>
                <p>Les filtres actuels ne retournent aucun vote.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  )
}

export default VoteCommandCenter
