import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { authCoordinationService, coordinationCatalogService, coordinationConfigService, resolutionProposalService, tpiCoordinationService, slotService, voteService, workflowCoordinationService } from '../../services/coordinationService'
import { IS_DEBUG, ROUTES, STORAGE_KEYS, YEARS_CONFIG } from '../../config/appConfig'
import { getTpiModels } from '../tpiControllers/TpiController.jsx'
import TpiPlanningList from './TpiPlanningList'
import VotingPanel from './VotingPanel'
import VoteCommandCenter from './VoteCommandCenter'
import ConflictResolver from './ConflictResolver'
import PageToolbar from '../shared/PageToolbar'
import {
  AlertIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  CloseIcon,
  FileTextIcon,
  ListIcon,
  MailIcon,
  RefreshIcon,
  SearchIcon,
  SendIcon,
  VoteIcon,
  WrenchIcon
} from '../shared/InlineIcons'
import {
  buildTpiDetailsLink,
  formatPersonName,
  getPlanningStatusMeta
} from '../tpiDetail/tpiDetailUtils'
import {
  MANUAL_REQUIRED_STATUSES,
  normalizeCoordinationStatus,
  COORDINATION_STATUS
} from '../../constants/coordinationStatus'
import { STATIC_VOTE_REGENERATION_CONFIRM_MESSAGE } from '../../constants/staticVotePublication'
import {
  VOTING_STAKEHOLDER_ROLES,
  getTpiRelationRoleLabel
} from '../../utils/stakeholderRules'
import { getPlanningPerimeterState } from '../../utils/coordinationScopeUtils'
import { buildValidationToast, extractValidationResultFromError } from '../../utils/workflowFeedback'
import { writeJSONValue } from '../../utils/storage'
import './PlanningDashboard.css'

const WORKFLOW_LABELS = {
  planning: 'Planification',
  voting_open: 'Votes ouverts',
  published: 'Publie'
}

const shouldLogWorkflowDebug = IS_DEBUG && process.env.NODE_ENV !== 'test'

function logWorkflowDebug(...args) {
  if (shouldLogWorkflowDebug) {
    console.debug(...args)
  }
}

const STATUS_FILTER_LABELS = {
  all: 'Tous les statuts',
  [COORDINATION_STATUS.DRAFT]: 'Brouillons',
  [COORDINATION_STATUS.VOTING]: 'En vote',
  [COORDINATION_STATUS.CONFIRMED]: 'Confirmes',
  [COORDINATION_STATUS.MANUAL_REQUIRED]: 'Intervention requise'
}

const TAB_PRESENTATIONS = {
  list: {
    kicker: 'Pilotage',
    title: 'Recherche complète',
    adminDescription: 'Vue secondaire pour retrouver un TPI précis.',
    viewerDescription: 'Tes TPI et leur état.'
  },
  votes: {
    kicker: 'Campagne',
    title: 'Réponses reçues',
    adminDescription: 'Uniquement les TPI pour lesquels au moins une réponse est arrivée.',
    viewerDescription: 'Réponds aux votes ouverts.'
  },
  'vote-pending': {
    kicker: 'Relances',
    title: 'À relancer',
    adminDescription: 'TPI avec au moins une réponse de vote manquante.',
    viewerDescription: 'Votes encore en attente.'
  },
  'vote-ready': {
    kicker: 'Clôture',
    title: 'Prêts à clore',
    adminDescription: 'TPI dont les trois rôles ont répondu.',
    viewerDescription: 'Votes complets.'
  },
  conflicts: {
    kicker: 'Arbitrage',
    title: 'À résoudre',
    adminDescription: 'Choisis un TPI, sélectionne le créneau retenu, indique la raison.',
    viewerDescription: 'Aucune action manuelle.'
  }
}

const VOTE_WORKFLOW_TAB_IDS = ['votes', 'vote-pending', 'vote-ready']

const VALIDATION_ISSUE_LABELS = {
  person_overlap: 'Conflit de personne',
  room_overlap: 'Conflit de salle',
  consecutive_limit: 'TPI consécutifs',
  room_class_mismatch: 'Salle incompatible',
  unplanned_tpi: 'Sans créneau',
  legacy_tpi_missing_reference: 'Référence GestionTPI manquante',
  legacy_tpi_missing_stakeholders: 'Parties prenantes incomplètes',
  legacy_tpi_unresolved_stakeholders: 'Parties prenantes non validées',
  legacy_tpi_not_imported: 'Absent de Coordination'
}

function getApiErrorMessage(err, fallbackMessage) {
  return err?.data?.error || err?.message || fallbackMessage
}

function normalizeListResponse(value) {
  return Array.isArray(value) ? value : []
}

function getValidationIssueLabel(issue) {
  if (!issue?.type) {
    return 'Anomalie de planification'
  }

  return VALIDATION_ISSUE_LABELS[issue.type] || issue.type
}

function isValidationWarningIssue(issue) {
  return compactText(issue?.severity).toLowerCase() === 'warning' ||
    issue?.isConstraintOverride === true
}

function getPersonId(value) {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (value._id) {
    return String(value._id)
  }

  if (value.id) {
    return String(value.id)
  }

  return null
}

function isTpiVisibleForViewer(tpi, viewerPersonId) {
  if (!viewerPersonId) {
    return true
  }

  const relatedIds = [
    getPersonId(tpi.expert1),
    getPersonId(tpi.expert2),
    getPersonId(tpi.chefProjet)
  ]

  return relatedIds.includes(viewerPersonId)
}

function compactText(value) {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

function normalizeFocusReference(value) {
  return compactText(value)
    .toLowerCase()
    .replace(/^tpi-\d{4}-/i, '')
}

function matchesFocusReference(reference, focus) {
  const normalizedReference = normalizeFocusReference(reference)
  const normalizedFocus = normalizeFocusReference(focus)

  if (!normalizedReference || !normalizedFocus) {
    return false
  }

  return normalizedReference === normalizedFocus ||
    compactText(reference).toLowerCase() === compactText(focus).toLowerCase()
}

function getValidationIssueReferences(issue) {
  const references = new Set()

  const directReference = compactText(issue?.reference)
  if (directReference) {
    references.add(directReference)
  }

  if (Array.isArray(issue?.references)) {
    issue.references
      .map(reference => compactText(reference))
      .filter(Boolean)
      .forEach(reference => references.add(reference))
  }

  return Array.from(references)
}

function formatValidationCheckedAt(value) {
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

function getVoterRoleLabel(role) {
  return getTpiRelationRoleLabel(role)
}

const VOTE_ROLE_ORDER = VOTING_STAKEHOLDER_ROLES
const CANDIDATE_ROLE_LABEL = getTpiRelationRoleLabel('candidat')
const PROJECT_LEAD_ROLE = 'chef_projet'
const RESOLUTION_RECIPIENT_ROLES = [
  PROJECT_LEAD_ROLE,
  ...VOTING_STAKEHOLDER_ROLES.filter((role) => role !== PROJECT_LEAD_ROLE)
]
const DEFAULT_RESOLUTION_RECIPIENT_ROLES = RESOLUTION_RECIPIENT_ROLES.includes(PROJECT_LEAD_ROLE)
  ? [PROJECT_LEAD_ROLE]
  : RESOLUTION_RECIPIENT_ROLES.slice(0, 1)
const EXPERT_RESOLUTION_RECIPIENT_ROLES = RESOLUTION_RECIPIENT_ROLES.filter((role) =>
  role !== PROJECT_LEAD_ROLE
)

function normalizeResolutionRecipientRoles(value) {
  const source = Array.isArray(value) ? value : DEFAULT_RESOLUTION_RECIPIENT_ROLES
  const selectedRoles = new Set(
    source
      .map((role) => compactText(role))
      .filter((role) => RESOLUTION_RECIPIENT_ROLES.includes(role))
  )
  const roles = RESOLUTION_RECIPIENT_ROLES.filter((role) => selectedRoles.has(role))

  return roles.length > 0 ? roles : DEFAULT_RESOLUTION_RECIPIENT_ROLES
}

function getVoteRoleEntries(tpi) {
  const voteRoleStatus = tpi?.voteRoleStatus || {}

  return VOTE_ROLE_ORDER.map((role) => ({
    role,
    label: getVoterRoleLabel(role),
    status: voteRoleStatus[role] || {
      decision: 'pending',
      responseMode: 'pending',
      votedAt: null,
      alternativeCount: 0,
      availabilityException: false,
      hardConstraint: false,
      specialRequestReason: '',
      specialRequestDate: null
    }
  }))
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

function getVoteFixedSlot(tpi) {
  if (tpi?.confirmedSlot) {
    return tpi.confirmedSlot
  }

  if (!Array.isArray(tpi?.proposedSlots)) {
    return null
  }

  const fixedSlot = tpi.proposedSlots.find((proposedSlot) => proposedSlot?.slot)
  return fixedSlot?.slot || null
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

function toPlanningDateKey(value) {
  const rawValue = compactText(value)
  if (!rawValue) {
    return ''
  }

  const isoDateMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoDateMatch) {
    return isoDateMatch[1]
  }

  const date = new Date(rawValue)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().slice(0, 10)
}

function formatPlanningDateKey(value) {
  const dateKey = toPlanningDateKey(value)
  if (!dateKey) {
    return ''
  }

  const date = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(date.getTime())) {
    return dateKey
  }

  return date.toLocaleDateString('fr-CH', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function addSlotDateKey(target, slot) {
  const dateKey = toPlanningDateKey(slot?.date)
  if (dateKey) {
    target.add(dateKey)
  }
}

function getTpiPlanningDateKeys(tpi) {
  const dateKeys = new Set()

  addSlotDateKey(dateKeys, tpi?.confirmedSlot)

  if (Array.isArray(tpi?.proposedSlots)) {
    tpi.proposedSlots.forEach((proposedSlot) => addSlotDateKey(dateKeys, proposedSlot?.slot))
  }

  if (Array.isArray(tpi?.voteDecision?.slots)) {
    tpi.voteDecision.slots.forEach((decisionSlot) => addSlotDateKey(dateKeys, decisionSlot?.slot))
  }

  return Array.from(dateKeys)
}

function formatVoteDeadline(value) {
  const label = formatVoteDate(value)
  return label ? `Echeance ${label}` : ''
}

function parseVoteTimeToMinutes(value) {
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

function normalizeVotePeriodLabel(value) {
  const normalized = compactText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (normalized.includes('matin')) {
    return 'Matin'
  }

  if (normalized.includes('apres')) {
    return 'Après-midi'
  }

  return ''
}

function getVoteSlotPeriodLabel(slot) {
  const displayPeriod = normalizeVotePeriodLabel(slot?.display?.periodLabel)
  if (displayPeriod) {
    return displayPeriod
  }

  const storedPeriod = normalizeVotePeriodLabel(slot?.period)
  if (storedPeriod) {
    return storedPeriod
  }

  const startMinutes = parseVoteTimeToMinutes(slot?.startTime)
  if (startMinutes === null) {
    return 'Demi-journée'
  }

  return startMinutes < (12 * 60) ? 'Matin' : 'Après-midi'
}

function formatVoteSlotLabel(slot) {
  if (!slot) {
    return 'Aucun creneau fixe'
  }

  const dateLabel = formatVoteDate(slot.date)
  const periodLabel = getVoteSlotPeriodLabel(slot)
  const roomLabel = compactText(slot.room?.name || slot.room)

  return [dateLabel, periodLabel, roomLabel].filter(Boolean).join(' · ') || 'Creneau a verifier'
}

function normalizeVoteSlotDisplayLabel(value) {
  const parts = compactText(value).split('·').map((part) => part.trim())

  if (parts.length < 2) {
    return compactText(value)
  }

  const timeMatch = parts[1].match(/^(\d{1,2}(?::\d{2})?)(?:\s*-\s*.+)?$/)
  if (!timeMatch) {
    return compactText(value)
  }

  const startMinutes = parseVoteTimeToMinutes(timeMatch[1])
  parts[1] = startMinutes === null || startMinutes < (12 * 60) ? 'Matin' : 'Après-midi'

  return parts.filter(Boolean).join(' · ')
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

function getVoteDecisionSlots(tpi) {
  const slots = Array.isArray(tpi?.voteDecision?.slots)
    ? tpi.voteDecision.slots
    : []

  const normalizedSlots = slots
    .filter((slot) => compactText(slot?.slotId))
    .map((slot) => ({
      ...slot,
      label: formatVoteSlotLabel(slot.slot),
      positiveCount: Number(slot.positiveCount || 0),
      rejectedCount: Number(slot.rejectedCount || 0),
      pendingCount: Number(slot.pendingCount || 0),
      respondedCount: Number(slot.respondedCount || 0),
      roleDecisions: Array.isArray(slot.roleDecisions) ? slot.roleDecisions : []
    }))

  const rolesWithOnlyAvailability = new Set()
  normalizedSlots.forEach((slot) => {
    const roleDecisions = Array.isArray(slot.roleDecisions) ? slot.roleDecisions : []
    roleDecisions.forEach((decision) => {
      if (slot.isFixed && isOnlyAvailabilityVoteComment(decision?.comment)) {
        rolesWithOnlyAvailability.add(compactText(decision?.role))
      }
    })
  })

  return normalizedSlots.map((slot) => {
    const roleDecisions = (Array.isArray(slot.roleDecisions) ? slot.roleDecisions : [])
      .map((decision) => {
        const role = compactText(decision?.role)
        const isInferredOnlyAvailability = Boolean(
          role &&
          rolesWithOnlyAvailability.has(role) &&
          !slot.isFixed &&
          decision?.decision === 'preferred'
        )

        return isInferredOnlyAvailability
          ? {
              ...decision,
              comment: decision.comment || 'Seule disponibilité signalée.',
              hardConstraint: true
            }
          : decision
      })

    return {
      ...slot,
      roleDecisions,
      hasHardConstraint: Boolean(slot.hasHardConstraint) ||
        roleDecisions.some((decision) => decision?.hardConstraint)
    }
  })
}

function isGenericVoteProposalComment(value) {
  const normalized = normalizeVoteCommentText(value)

  return normalized === 'proposition de creneaux alternatifs'
}

function getVoteProposalSummaries(tpi) {
  const summariesByRole = new Map()

  const getSummary = (decision) => {
    const role = compactText(decision?.role)

    if (!role) {
      return null
    }

    if (!summariesByRole.has(role)) {
      const voterName = compactText(decision?.voterName)
      summariesByRole.set(role, {
        role,
        roleLabel: getVoterRoleLabel(role),
        voterName,
        slots: [],
        comment: '',
        specialRequestReason: '',
        specialRequestDate: null,
        hasAvailabilityException: false,
        hasHardConstraint: false
      })
    }

    const summary = summariesByRole.get(role)
    const voterName = compactText(decision?.voterName)
    if (voterName && !summary.voterName) {
      summary.voterName = voterName
    }

    return summary
  }

  getVoteDecisionSlots(tpi).forEach((slot) => {
    const slotLabel = compactText(slot?.label)

    slot.roleDecisions.forEach((decision) => {
      const summary = getSummary(decision)
      if (!summary) {
        return
      }

      if (decision.decision === 'preferred' && slotLabel) {
        const alreadyIncluded = summary.slots.some((entry) => entry.slotId === slot.slotId)
        if (!alreadyIncluded) {
          summary.slots.push({
            slotId: slot.slotId,
            voteId: compactText(decision.voteId),
            label: slotLabel,
            priority: Number.isFinite(Number(decision.priority)) ? Number(decision.priority) : null
          })
        }
      }

      if (
        decision.availabilityException ||
        decision.hardConstraint ||
        isOnlyAvailabilityVoteComment(decision.comment) ||
        (compactText(decision.comment) && !isGenericVoteProposalComment(decision.comment)) ||
        compactText(decision.specialRequestReason) ||
        decision.specialRequestDate
      ) {
        const decisionComment = isGenericVoteProposalComment(decision.comment)
          ? ''
          : compactText(decision.comment)
        summary.hasAvailabilityException = true
        summary.hasHardConstraint = summary.hasHardConstraint ||
          Boolean(decision.hardConstraint) ||
          isOnlyAvailabilityVoteComment(decision.comment)
        summary.comment = summary.comment || decisionComment
        summary.specialRequestReason = summary.specialRequestReason || compactText(decision.specialRequestReason)
        summary.specialRequestDate = summary.specialRequestDate || decision.specialRequestDate || null
      }
    })
  })

  return Array.from(summariesByRole.values())
    .map((summary) => ({
      ...summary,
      slots: summary.slots.sort((left, right) => {
        const leftPriority = Number.isFinite(Number(left.priority)) ? Number(left.priority) : Number.MAX_SAFE_INTEGER
        const rightPriority = Number.isFinite(Number(right.priority)) ? Number(right.priority) : Number.MAX_SAFE_INTEGER

        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority
        }

        return left.label.localeCompare(right.label)
      })
    }))
    .filter((summary) =>
      summary.slots.length > 0 ||
      summary.hasAvailabilityException ||
      summary.hasHardConstraint ||
      compactText(summary.comment) ||
      compactText(summary.specialRequestReason) ||
      summary.specialRequestDate
    )
    .sort((left, right) =>
      VOTE_ROLE_ORDER.indexOf(left.role) - VOTE_ROLE_ORDER.indexOf(right.role)
    )
}

function formatSpecialRequestDate(value) {
  const label = formatVoteDate(value)
  return label ? `Date demandée ${label}` : ''
}

function buildVoteProposalMoveReason(tpi, summary, slot) {
  const reference = compactText(tpi?.reference) || 'TPI'
  const voterLabel = [
    compactText(summary?.roleLabel),
    compactText(summary?.voterName)
  ].filter(Boolean).join(' - ')
  const slotLabel = compactText(slot?.label) || compactText(slot?.slotId) || 'créneau proposé'

  return `Déplacement depuis proposition de vote: ${reference} vers ${slotLabel}${voterLabel ? ` (${voterLabel})` : ''}.`
}

function buildResolutionProposalDefaultMessage(tpi, slot) {
  const reference = compactText(tpi?.reference) || 'ce TPI'
  const candidateName = formatPersonName(tpi?.candidat, 'le candidat')
  const slotLabel = compactText(slot?.label) || 'le créneau proposé'

  return `Une contrainte bloque ${reference} (${candidateName}). Je propose de retenir ${slotLabel}. Merci de confirmer votre accord ou d'indiquer la raison du refus avec une proposition éventuelle.`
}

function getMoveSlotLabel(slot, fallback = 'Non défini') {
  const directLabel = normalizeVoteSlotDisplayLabel(slot?.label)
  return directLabel || formatVoteSlotLabel(slot) || fallback
}

function getMoveConflictLabel(conflict) {
  const type = compactText(conflict?.type)

  if (type === 'room_overlap') {
    return conflict?.description || 'Le créneau cible est déjà occupé.'
  }

  if (type === 'person_overlap') {
    const person = compactText(conflict?.person)
    return person
      ? `${person} est déjà engagé sur ce créneau.`
      : 'Une personne est déjà engagée sur ce créneau.'
  }

  if (type === 'room_class_mismatch') {
    return 'La salle ne correspond pas au type de classe du TPI.'
  }

  if (type === 'consecutive_limit') {
    return 'La règle du nombre de défenses consécutives serait dépassée.'
  }

  return conflict?.description || conflict?.message || 'Conflit détecté.'
}

function getHardConstraintDecisionName(decision) {
  return compactText(decision?.voterName) || getVoterRoleLabel(decision?.role) || 'cette personne'
}

function addUniqueText(target, value) {
  const text = compactText(value)
  if (text && !target.includes(text)) {
    target.push(text)
  }
}

function addUniqueReason(target, value) {
  const text = compactText(value)
  if (!text) {
    return
  }

  const normalizedText = normalizeVoteCommentText(text)
  const existingIndex = target.findIndex((existing) => {
    const normalizedExisting = normalizeVoteCommentText(existing)
    return normalizedExisting.includes(normalizedText) || normalizedText.includes(normalizedExisting)
  })

  if (existingIndex === -1) {
    target.push(text)
    return
  }

  if (text.length > target[existingIndex].length) {
    target[existingIndex] = text
  }
}

function getHardConstraintReasonParts(source) {
  return [
    compactText(source?.comment),
    compactText(source?.specialRequestReason),
    formatSpecialRequestDate(source?.specialRequestDate)
  ].filter(Boolean)
}

function formatHardConstraintEntryMessage(entry) {
  const name = compactText(entry?.voterName) || compactText(entry?.roleLabel) || 'cette personne'
  const slotText = entry?.slotLabels?.length
    ? ` sur ${entry.slotLabels.join(', ')}`
    : ''
  const reasonText = entry?.reasons?.length
    ? `: ${entry.reasons.join(' · ')}`
    : ''

  return `Contrainte dure: ${name}${slotText}${reasonText}`
}

function buildVoteConstraintRowSummary(row) {
  const hardEntriesByRole = new Map()
  const riskySlotIds = new Set()
  const addHardEntry = ({ role, roleLabel, voterName, slotLabel, reasonParts = [] }) => {
    const normalizedRole = compactText(role)
    const key = normalizedRole || compactText(voterName) || compactText(roleLabel) || `hard-${hardEntriesByRole.size}`

    if (!hardEntriesByRole.has(key)) {
      hardEntriesByRole.set(key, {
        role: normalizedRole,
        roleLabel: compactText(roleLabel) || getVoterRoleLabel(normalizedRole),
        voterName: compactText(voterName),
        slotLabels: [],
        reasons: []
      })
    }

    const entry = hardEntriesByRole.get(key)
    if (!entry.voterName) {
      entry.voterName = compactText(voterName)
    }

    addUniqueText(entry.slotLabels, slotLabel)
    reasonParts.forEach((reason) => addUniqueReason(entry.reasons, reason))
  }

  const decisionSlots = Array.isArray(row?.decisionSlots) ? row.decisionSlots : []
  const onlyAvailabilityContextsByRole = new Map()
  const getOnlyAvailabilityContext = (decision) => {
    const role = compactText(decision?.role)

    if (!role) {
      return null
    }

    if (!onlyAvailabilityContextsByRole.has(role)) {
      onlyAvailabilityContextsByRole.set(role, {
        role,
        roleLabel: getVoterRoleLabel(role),
        voterName: getHardConstraintDecisionName(decision),
        reasons: [],
        preferredSlotIds: [],
        preferredSlotLabels: [],
        sourceSlotIds: [],
        sourceSlotLabels: []
      })
    }

    const context = onlyAvailabilityContextsByRole.get(role)
    const voterName = getHardConstraintDecisionName(decision)
    if (voterName && !context.voterName) {
      context.voterName = voterName
    }

    return context
  }

  for (const slot of decisionSlots) {
    const roleDecisions = Array.isArray(slot?.roleDecisions) ? slot.roleDecisions : []

    for (const decision of roleDecisions) {
      const context = getOnlyAvailabilityContext(decision)
      if (!context) {
        continue
      }

      if (decision?.decision === 'preferred') {
        addUniqueText(context.preferredSlotIds, slot?.slotId)
        addUniqueText(context.preferredSlotLabels, slot?.label)
      }

      if (isOnlyAvailabilityVoteComment(decision?.comment)) {
        addUniqueText(context.sourceSlotIds, slot?.slotId)
        addUniqueText(context.sourceSlotLabels, slot?.label)
        addUniqueReason(context.reasons, decision.comment)
      }
    }
  }

  for (const entry of Array.isArray(row?.roleEntries) ? row.roleEntries : []) {
    if (!entry?.status?.hardConstraint) {
      continue
    }

    addHardEntry({
      role: entry.role,
      roleLabel: entry.label,
      voterName: entry.status?.voterName,
      reasonParts: getHardConstraintReasonParts(entry.status)
    })
  }

  for (const slot of decisionSlots) {
    const roleDecisions = Array.isArray(slot?.roleDecisions) ? slot.roleDecisions : []

    for (const decision of roleDecisions) {
      if (!decision?.hardConstraint) {
        continue
      }

      riskySlotIds.add(compactText(slot?.slotId))
      addHardEntry({
        role: decision.role,
        roleLabel: getVoterRoleLabel(decision.role),
        voterName: getHardConstraintDecisionName(decision),
        slotLabel: slot?.label,
        reasonParts: getHardConstraintReasonParts(decision)
      })
    }
  }

  const onlyAvailabilityContexts = Array.from(onlyAvailabilityContextsByRole.values())
    .filter((context) => context.reasons.length > 0)

  onlyAvailabilityContexts.forEach((context) => {
    const slotLabels = context.preferredSlotLabels.length > 0
      ? context.preferredSlotLabels
      : context.sourceSlotLabels
    const slotIds = context.preferredSlotIds.length > 0
      ? context.preferredSlotIds
      : context.sourceSlotIds

    slotIds.forEach((slotId) => {
      const text = compactText(slotId)
      if (text) {
        riskySlotIds.add(text)
      }
    })

    if (slotLabels.length === 0) {
      addHardEntry({
        role: context.role,
        roleLabel: context.roleLabel,
        voterName: context.voterName,
        reasonParts: context.reasons
      })
      return
    }

    slotLabels.forEach((slotLabel, index) => {
      addHardEntry({
        role: context.role,
        roleLabel: context.roleLabel,
        voterName: context.voterName,
        slotLabel,
        reasonParts: index === 0 ? context.reasons : []
      })
    })
  })

  const hardEntries = Array.from(hardEntriesByRole.values())
    .sort((left, right) => {
      const roleDiff = VOTE_ROLE_ORDER.indexOf(left.role) - VOTE_ROLE_ORDER.indexOf(right.role)

      if (roleDiff !== 0) {
        return roleDiff
      }

      return compactText(left.voterName || left.roleLabel).localeCompare(
        compactText(right.voterName || right.roleLabel),
        'fr'
      )
    })
  const safeSlots = onlyAvailabilityContexts.length > 0
    ? []
    : decisionSlots
    .filter((slot) => {
      if (slot?.hasHardConstraint) {
        return false
      }

      return !(Array.isArray(slot?.roleDecisions) ? slot.roleDecisions : [])
        .some((decision) => decision?.hardConstraint)
    })
    .sort((left, right) => {
      if (Number(right.positiveCount || 0) !== Number(left.positiveCount || 0)) {
        return Number(right.positiveCount || 0) - Number(left.positiveCount || 0)
      }

      if (Number(left.rejectedCount || 0) !== Number(right.rejectedCount || 0)) {
        return Number(left.rejectedCount || 0) - Number(right.rejectedCount || 0)
      }

      return compactText(left.label).localeCompare(compactText(right.label), 'fr')
    })
  const perfectSlot = safeSlots.find((slot) => Number(slot?.positiveCount || 0) >= VOTE_ROLE_ORDER.length)
  const bestSlot = safeSlots[0] || null
  const conflictMessages = hardEntries.map(formatHardConstraintEntryMessage)

  return {
    hasHardConstraint: hardEntries.length > 0,
    hardEntries,
    riskySlotIds: Array.from(riskySlotIds).filter(Boolean),
    conflictMessages,
    hasPerfectSolution: Boolean(perfectSlot),
    bestSlotLabel: bestSlot ? compactText(bestSlot.label) : '',
    bestSlotPositiveCount: bestSlot ? Number(bestSlot.positiveCount || 0) : 0,
    recommendation: perfectSlot
      ? `Solution sans contrainte détectée sur ${compactText(perfectSlot.label)}.`
      : bestSlot
        ? `Meilleur créneau sans contrainte dure: ${compactText(bestSlot.label)} (${Number(bestSlot.positiveCount || 0)}/3).`
        : 'Aucun créneau exploitable sans contrainte dure. Résolution manuelle requise.'
  }
}

function buildVoteConstraintCheckResult(rows = [], year = null) {
  const checkedRows = Array.isArray(rows) ? rows : []
  const byTpiId = {}
  const conflicts = []

  checkedRows.forEach((row) => {
    const summary = row?.constraintSummary || buildVoteConstraintRowSummary(row)

    if (!summary.hasHardConstraint) {
      return
    }

    byTpiId[row.id] = summary
    summary.hardEntries.forEach((entry) => {
      conflicts.push({
        tpiId: row.id,
        reference: row.reference,
        role: entry.role,
        roleLabel: entry.roleLabel,
        voterName: entry.voterName,
        slotLabels: entry.slotLabels,
        reasons: entry.reasons,
        message: formatHardConstraintEntryMessage(entry),
        recommendation: summary.recommendation
      })
    })
  })

  return {
    year,
    checkedAt: new Date().toISOString(),
    byTpiId,
    conflicts,
    conflictCount: conflicts.length,
    impactedTpiCount: Object.keys(byTpiId).length,
    checkedTpiCount: checkedRows.length,
    checkedResponseTpiCount: checkedRows.filter((row) => Number(row?.respondedCount || 0) > 0).length
  }
}

function buildAdminSlotForceReason(reference, slot) {
  const slotLabel = compactText(slot?.label) || 'créneau sélectionné'
  const voteRatio = `${Number(slot?.positiveCount || 0)}/3`

  if (Number(slot?.positiveCount || 0) >= 3) {
    return `Validation admin depuis le suivi des votes: consensus 3/3 sur ${slotLabel}.`
  }

  return `Choix admin depuis le suivi des votes ${reference}: ${voteRatio} avis favorable(s) sur ${slotLabel}.`
}

function buildVoteWorkflowRow(tpi) {
  const initialRoleEntries = getVoteRoleEntries(tpi)
  const decisionSlots = getVoteDecisionSlots(tpi)
  const blockingRolesFromSlots = new Set()
  decisionSlots.forEach((slot) => {
    const roleDecisions = Array.isArray(slot?.roleDecisions) ? slot.roleDecisions : []
    roleDecisions.forEach((decision) => {
      if (decision?.hardConstraint || isOnlyAvailabilityVoteComment(decision?.comment)) {
        blockingRolesFromSlots.add(compactText(decision?.role))
      }
    })
  })
  const roleEntries = initialRoleEntries.map((entry) =>
    blockingRolesFromSlots.has(entry.role)
      ? {
          ...entry,
          status: {
            ...entry.status,
            hardConstraint: true
          }
        }
      : entry
  )
  const constraintSummary = buildVoteConstraintRowSummary({ decisionSlots, roleEntries })
  const respondedRoles = roleEntries.filter((entry) => hasVoteRoleResponded(entry.status))
  const missingRoles = roleEntries.filter((entry) => !hasVoteRoleResponded(entry.status))
  const normalizedStatus = normalizeCoordinationStatus(tpi?.status)
  const hasManualStatus = MANUAL_REQUIRED_STATUSES.includes(normalizedStatus)
  const hasProposal = roleEntries.some((entry) => getVoteRoleTone(entry.status) === 'proposal')
  const hasSpecialRequest = roleEntries.some((entry) =>
    Boolean(entry.status?.availabilityException) ||
    Boolean(entry.status?.hardConstraint) ||
    Boolean(compactText(entry.status?.specialRequestReason)) ||
    Boolean(entry.status?.specialRequestDate)
  )

  let bucket = 'other'
  if (hasManualStatus) {
    bucket = 'manual'
  } else if (normalizedStatus === COORDINATION_STATUS.CONFIRMED) {
    bucket = 'confirmed'
  } else if (missingRoles.length > 0) {
    bucket = 'pending'
  } else {
    bucket = 'ready'
  }

  return {
    tpi,
    id: compactText(tpi?._id) || compactText(tpi?.reference),
    reference: compactText(tpi?.reference) || 'TPI',
    candidate: formatPersonName(tpi?.candidat, `${CANDIDATE_ROLE_LABEL} non renseigne`),
    status: normalizedStatus,
    roleEntries,
    respondedCount: respondedRoles.length,
    missingCount: missingRoles.length,
    missingLabels: missingRoles.map((entry) => entry.label),
    fixedSlotLabel: formatVoteSlotLabel(getVoteFixedSlot(tpi)),
    decisionSlots,
    proposalSummaries: getVoteProposalSummaries(tpi),
    resolutionProposals: Array.isArray(tpi?.resolutionProposals) ? tpi.resolutionProposals : [],
    constraintSummary,
    hasHardConstraint: constraintSummary.hasHardConstraint,
    deadlineLabel: formatVoteDeadline(tpi?.votingSession?.deadline),
    hasProposal,
    hasSpecialRequest,
    bucket
  }
}

/**
 * Dashboard principal pour la planification des défenses TPI
 * Offre une vue d'ensemble du processus de planification avec calendrier,
 * liste des TPI, panel de vote et gestion des conflits
 */
const PlanningDashboard = ({ year, isAdmin = false, toggleArrow, isArrowUp }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const magicLinkToken = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('ml')
  }, [location.search])
  const requestedTab = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    return typeof tab === 'string' ? tab.trim() : ''
  }, [location.search])
  const requestedFocus = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const focus = params.get('focus')
    return typeof focus === 'string' ? focus.trim() : ''
  }, [location.search])

  // États principaux
  const [tpis, setTpis] = useState([])
  const [legacyTpis, setLegacyTpis] = useState([])
  const [calendarData, setCalendarData] = useState([])
  const [pendingVotes, setPendingVotes] = useState([])
  const [conflicts, setConflicts] = useState([])
  const [workflow, setWorkflow] = useState(null)
  const [activeSnapshot, setActiveSnapshot] = useState(null)
  const [staticPublicationInfo, setStaticPublicationInfo] = useState(null)
  const [staticVotePublicationInfo, setStaticVotePublicationInfo] = useState(null)
  const [defenseChangeNotificationInfo, setDefenseChangeNotificationInfo] = useState(null)
  const [magicLinkViewer, setMagicLinkViewer] = useState(null)
  const [isMagicLinkReady, setIsMagicLinkReady] = useState(false)
  const [planningClassTypes, setPlanningClassTypes] = useState([])
  const [planningCatalogSites, setPlanningCatalogSites] = useState([])
  const [planningSiteConfigs, setPlanningSiteConfigs] = useState([])
  const [validationResult, setValidationResult] = useState(null)
  const [constraintCheckResult, setConstraintCheckResult] = useState(null)
  
  // États de l'interface
  const [activeTab, setActiveTab] = useState(() => requestedTab || 'votes')
  const [selectedTpi, setSelectedTpi] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [workflowActionLoading, setWorkflowActionLoading] = useState(false)
  const [pendingWorkflowAction, setPendingWorkflowAction] = useState('')
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [appliedFocus, setAppliedFocus] = useState('')
  const [manualFocusTpiId, setManualFocusTpiId] = useState('')
  const [proposalMoveReview, setProposalMoveReview] = useState(null)
  const [proposalMoveLoadingKey, setProposalMoveLoadingKey] = useState('')
  const [proposalMoveApplying, setProposalMoveApplying] = useState(false)
  const [resolutionProposalDraft, setResolutionProposalDraft] = useState(null)
  const [resolutionProposalSubmitting, setResolutionProposalSubmitting] = useState(false)
  const [preferenceActionLoadingKey, setPreferenceActionLoadingKey] = useState('')
  const staticVoteAutoSyncYearsRef = useRef(new Set())

  // Filtres
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const fetchStaticVotePublicationStatus = useCallback(async () => {
    if (!isAdmin || typeof workflowCoordinationService.getStaticVotePublicationStatus !== 'function') {
      return null
    }

    try {
      return await workflowCoordinationService.getStaticVotePublicationStatus(year)
    } catch (err) {
      if (err?.status !== 404 && process.env.NODE_ENV !== 'test') {
        console.warn('Statut publication vote statique indisponible:', err)
      }
      return null
    }
  }, [year, isAdmin])

  const fetchStaticPublicationStatus = useCallback(async () => {
    if (!isAdmin || typeof workflowCoordinationService.getStaticPublicationStatus !== 'function') {
      return null
    }

    try {
      return await workflowCoordinationService.getStaticPublicationStatus(year)
    } catch (err) {
      if (err?.status !== 404 && process.env.NODE_ENV !== 'test') {
        console.warn('Statut publication defenses statique indisponible:', err)
      }
      return null
    }
  }, [year, isAdmin])

  const fetchDefenseChangeNotificationPreview = useCallback(async () => {
    if (!isAdmin || typeof workflowCoordinationService.getDefenseChangeNotificationPreview !== 'function') {
      return null
    }

    try {
      return await workflowCoordinationService.getDefenseChangeNotificationPreview(year)
    } catch (err) {
      if (err?.status !== 404 && process.env.NODE_ENV !== 'test') {
        console.warn('Aperçu notifications changements défenses indisponible:', err)
      }
      return null
    }
  }, [year, isAdmin])

  const tryAutoSyncStaticVotes = useCallback(async () => {
    if (!isAdmin || typeof workflowCoordinationService.syncStaticVotePublication !== 'function') {
      return undefined
    }

    const yearKey = String(year)
    if (staticVoteAutoSyncYearsRef.current.has(yearKey)) {
      return undefined
    }

    const status = await fetchStaticVotePublicationStatus()

    if (!status?.available || status?.syncSecretConfigured !== true) {
      return status
    }

    staticVoteAutoSyncYearsRef.current.add(yearKey)

    try {
      const result = await workflowCoordinationService.syncStaticVotePublication(year)
      const syncedAt = new Date().toISOString()

      return {
        ...(status || {}),
        lastSyncAt: syncedAt,
        lastSyncStatus: Number(result?.failedCount || 0) > 0 ? 'warning' : 'success',
        lastSyncMessage: 'Synchronisation automatique au chargement.',
        lastSyncReceivedCount: Number(result?.receivedCount || 0),
        lastSyncImportedCount: Number(result?.importedCount || 0),
        lastSyncFailedCount: Number(result?.failedCount || 0)
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('Synchronisation automatique des votes statiques indisponible:', err)
      }

      return {
        ...(status || {}),
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: 'error',
        lastSyncMessage: getApiErrorMessage(err, 'Synchronisation automatique indisponible.')
      }
    }
  }, [year, isAdmin, fetchStaticVotePublicationStatus])

  /**
   * Charge toutes les données de planification
   */
  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setValidationResult(null)
    setConstraintCheckResult(null)
    
    try {
      const staticVoteAutoSyncResponse = await tryAutoSyncStaticVotes()
      const snapshotRequest = isAdmin
        ? Promise.resolve(workflowCoordinationService.getActiveSnapshot(year))
          .catch(err => {
            if (err?.status === 404) {
              return null
            }
            throw err
          })
        : Promise.resolve(null)

      const workflowRequest = isAdmin
        ? workflowCoordinationService.getYearState(year)
        : Promise.resolve(null)

      const staticVotePublicationRequest = isAdmin
        ? staticVoteAutoSyncResponse !== undefined
          ? Promise.resolve(staticVoteAutoSyncResponse)
          : fetchStaticVotePublicationStatus()
        : Promise.resolve(null)

      const staticPublicationRequest = isAdmin
        ? fetchStaticPublicationStatus()
        : Promise.resolve(null)

      const defenseChangeNotificationRequest = isAdmin
        ? fetchDefenseChangeNotificationPreview()
        : Promise.resolve(null)

      const planningConfigRequest = Promise.resolve(coordinationConfigService.getByYear(year)).catch(err => {
        if (err?.status === 404) {
          return null
        }
        throw err
      })

      const planningCatalogRequest = Promise.resolve(coordinationCatalogService.getGlobal()).catch(err => {
        console.error('Erreur lors du chargement du catalogue central:', err)
        return null
      })

      const legacyTpisRequest = isAdmin
        ? Promise.resolve(getTpiModels(year)).catch(err => {
          if (err?.status === 404) {
            return []
          }
          throw err
        })
        : Promise.resolve([])

      // Charger en parallèle
      const votesRequest = isAdmin
        ? Promise.resolve([])
        : voteService.getPending()

      const [
        planningConfigResponse,
        planningCatalogResponse,
        tpisResponse,
        calendarResponse,
        votesResponse,
        workflowResponse,
        snapshotResponse,
        legacyTpisResponse,
        staticPublicationResponse,
        staticVotePublicationResponse,
        defenseChangeNotificationResponse
      ] = await Promise.all([
        planningConfigRequest,
        planningCatalogRequest,
        tpiCoordinationService.getByYear(year),
        slotService.getCalendar(year),
        votesRequest,
        workflowRequest,
        snapshotRequest,
        legacyTpisRequest,
        staticPublicationRequest,
        staticVotePublicationRequest,
        defenseChangeNotificationRequest
      ])

      const safeTpisResponse = normalizeListResponse(tpisResponse)
      const safeCalendarResponse = normalizeListResponse(calendarResponse)
      const safeVotesResponse = normalizeListResponse(votesResponse)
      const safeLegacyTpisResponse = normalizeListResponse(legacyTpisResponse)

      setPlanningClassTypes(Array.isArray(planningConfigResponse?.classTypes) ? planningConfigResponse.classTypes : [])
      setPlanningCatalogSites(Array.isArray(planningCatalogResponse?.sites) ? planningCatalogResponse.sites : [])
      setPlanningSiteConfigs(Array.isArray(planningConfigResponse?.siteConfigs) ? planningConfigResponse.siteConfigs : [])
      
      setTpis(safeTpisResponse)
      setLegacyTpis(safeLegacyTpisResponse)
      setCalendarData(safeCalendarResponse)
      setPendingVotes(safeVotesResponse)
      setWorkflow(workflowResponse)
      setActiveSnapshot(snapshotResponse)
      setStaticPublicationInfo(staticPublicationResponse)
      setStaticVotePublicationInfo(staticVotePublicationResponse)
      setDefenseChangeNotificationInfo(defenseChangeNotificationResponse)
      
      // Identifier les conflits
      const tpisWithConflicts = safeTpisResponse.filter(tpi =>
        MANUAL_REQUIRED_STATUSES.includes(normalizeCoordinationStatus(tpi.status)) ||
        tpi.votingSession?.hasConflicts
      )
      setConflicts(tpisWithConflicts)
      
    } catch (err) {
      setError(getApiErrorMessage(err, 'Erreur lors du chargement des données de planification'))
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [year, isAdmin, fetchStaticPublicationStatus, fetchStaticVotePublicationStatus, fetchDefenseChangeNotificationPreview, tryAutoSyncStaticVotes])

  useEffect(() => {
    let isCancelled = false

    const resolveMagicLink = async () => {
      if (!magicLinkToken) {
        if (!isCancelled) {
          setIsMagicLinkReady(true)
        }
        return
      }

      try {
        const resolved = await workflowCoordinationService.resolveMagicLink(magicLinkToken)

        if (resolved?.type !== 'vote') {
          if (!isCancelled) {
            setError('Ce lien n est pas un lien de vote.')
            setIsMagicLinkReady(true)
          }
          return
        }

        if (resolved?.sessionToken) {
          authCoordinationService.setSessionToken(resolved.sessionToken)
        }

        if (resolved?.viewer) {
          const viewer = {
            ...resolved.viewer,
            role: resolved.role || null
          }

          authCoordinationService.setCurrentUser(viewer)

          if (!isCancelled) {
            setMagicLinkViewer(viewer)
            setSuccessMessage(
              viewer?.name
                ? `Lien de vote actif pour ${viewer.name}${resolved.role ? ` (${getVoterRoleLabel(resolved.role)})` : ''}.`
                : 'Lien de vote actif.'
            )
          }
        } else if (!isCancelled) {
          setMagicLinkViewer(null)
          setSuccessMessage('Lien de vote actif.')
        }

        const cleanPath = window.location.pathname
        window.history.replaceState({}, '', cleanPath)
      } catch (err) {
        if (!isCancelled) {
          setError(getApiErrorMessage(err, 'Lien magique invalide ou expire.'))
        }
      } finally {
        if (!isCancelled) {
          setIsMagicLinkReady(true)
        }
      }
    }

    resolveMagicLink().catch(console.error)

    return () => {
      isCancelled = true
    }
  }, [magicLinkToken])

  // Chargement initial
  useEffect(() => {
    if (!isMagicLinkReady) {
      return
    }

    loadData()
  }, [isMagicLinkReady, loadData])

  /**
   * TPI filtrés selon les critères de recherche
   */
  const visibleTpis = useMemo(() => {
    const scopedViewerId = !isAdmin ? magicLinkViewer?.personId : null
    if (!scopedViewerId) {
      return tpis
    }

    return tpis.filter(tpi => isTpiVisibleForViewer(tpi, scopedViewerId))
  }, [tpis, isAdmin, magicLinkViewer])

  const planningDateOptions = useMemo(() => {
    const dateKeys = new Set()

    visibleTpis.forEach((tpi) => {
      getTpiPlanningDateKeys(tpi).forEach((dateKey) => dateKeys.add(dateKey))
    })

    return Array.from(dateKeys)
      .sort((left, right) => left.localeCompare(right))
      .map((value) => ({
        value,
        label: formatPlanningDateKey(value) || value
      }))
  }, [visibleTpis])

  useEffect(() => {
    if (!dateFilter) {
      return
    }

    const stillAvailable = planningDateOptions.some((option) => option.value === dateFilter)
    if (!stillAvailable) {
      setDateFilter('')
    }
  }, [dateFilter, planningDateOptions])

  const filteredTpis = useMemo(() => {
    return visibleTpis.filter(tpi => {
      const normalizedStatus = normalizeCoordinationStatus(tpi.status)

      // Filtre par statut
      if (statusFilter !== 'all' && normalizedStatus !== statusFilter) {
        return false
      }

      // Filtre par date de créneau
      if (dateFilter && !getTpiPlanningDateKeys(tpi).includes(dateFilter)) {
        return false
      }
      
      // Filtre par recherche
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchRef = tpi.reference?.toLowerCase().includes(query)
        const matchCandidat = tpi.candidat?.firstName?.toLowerCase().includes(query) ||
                             tpi.candidat?.lastName?.toLowerCase().includes(query)
        const matchSujet = tpi.sujet?.toLowerCase().includes(query)
        
        return matchRef || matchCandidat || matchSujet
      }
      
      return true
    })
  }, [visibleTpis, statusFilter, dateFilter, searchQuery])

  /**
   * Statistiques globales
   */
  const stats = useMemo(() => {
    return {
      total: visibleTpis.length,
      draft: visibleTpis.filter(t => normalizeCoordinationStatus(t.status) === COORDINATION_STATUS.DRAFT).length,
      voting: visibleTpis.filter(t => normalizeCoordinationStatus(t.status) === COORDINATION_STATUS.VOTING).length,
      confirmed: visibleTpis.filter(t => normalizeCoordinationStatus(t.status) === COORDINATION_STATUS.CONFIRMED).length,
      conflicts: conflicts.length,
      pendingVotes: isAdmin
        ? visibleTpis.filter(t => normalizeCoordinationStatus(t.status) !== COORDINATION_STATUS.DRAFT).length
        : pendingVotes.length
    }
  }, [visibleTpis, conflicts, pendingVotes, isAdmin])

  const voteTrackingTpis = useMemo(() => {
    if (!isAdmin) {
      return []
    }

    return visibleTpis.filter((tpi) => {
      const normalizedStatus = normalizeCoordinationStatus(tpi.status)
      return normalizedStatus !== COORDINATION_STATUS.DRAFT
    })
  }, [visibleTpis, isAdmin])

  const filteredVoteTrackingTpis = useMemo(() => {
    if (!isAdmin) {
      return []
    }

    return filteredTpis.filter((tpi) => {
      const normalizedStatus = normalizeCoordinationStatus(tpi.status)
      return normalizedStatus !== COORDINATION_STATUS.DRAFT
    })
  }, [filteredTpis, isAdmin])

  const voteWorkflowRows = useMemo(() => {
    return filteredVoteTrackingTpis.map((tpi) => buildVoteWorkflowRow(tpi))
  }, [filteredVoteTrackingTpis])

  const voteWorkflowAllRows = useMemo(() => {
    return voteTrackingTpis.map((tpi) => buildVoteWorkflowRow(tpi))
  }, [voteTrackingTpis])

  const voteWorkflowResponseRows = useMemo(() => (
    voteWorkflowRows.filter((row) => Number(row.respondedCount || 0) > 0)
  ), [voteWorkflowRows])

  const voteWorkflowAllResponseRows = useMemo(() => (
    voteWorkflowAllRows.filter((row) => Number(row.respondedCount || 0) > 0)
  ), [voteWorkflowAllRows])

  const voteWorkflowStats = useMemo(() => {
    const totalTpis = voteWorkflowAllRows.length
    const expectedVotes = totalTpis * VOTE_ROLE_ORDER.length
    const receivedVotes = voteWorkflowAllRows.reduce((sum, row) => sum + row.respondedCount, 0)
    const missingVotes = Math.max(expectedVotes - receivedVotes, 0)
    const completionRate = expectedVotes > 0
      ? Math.round((receivedVotes / expectedVotes) * 100)
      : 0

    return {
      totalTpis,
      expectedVotes,
      receivedVotes,
      missingVotes,
      completionRate,
      responseTpis: voteWorkflowAllResponseRows.length,
      pendingResponseTpis: voteWorkflowAllResponseRows.filter((row) => row.bucket === 'pending').length,
      readyResponseTpis: voteWorkflowAllResponseRows.filter((row) => row.bucket === 'ready').length,
      pendingTpis: voteWorkflowAllRows.filter((row) => row.bucket === 'pending').length,
      readyTpis: voteWorkflowAllRows.filter((row) => row.bucket === 'ready').length,
      manualTpis: voteWorkflowAllRows.filter((row) => row.bucket === 'manual').length,
      confirmedTpis: voteWorkflowAllRows.filter((row) => row.bucket === 'confirmed').length,
      proposalTpis: voteWorkflowAllRows.filter((row) => row.hasProposal || row.hasSpecialRequest).length,
      hardConstraintTpis: voteWorkflowAllRows.filter((row) => row.hasHardConstraint).length
    }
  }, [voteWorkflowAllRows, voteWorkflowAllResponseRows])

  const voteWorkflowSections = useMemo(() => ([
    {
      id: 'pending',
      title: 'À relancer',
      helper: 'Votes encore manquants. Ce sont les personnes à cibler avant la clôture.',
      rows: voteWorkflowResponseRows.filter((row) => row.bucket === 'pending')
    },
    {
      id: 'ready',
      title: 'Prêts pour clôture',
      helper: 'Les trois rôles ont répondu. La clôture décidera automatiquement ou basculera en manuel.',
      rows: voteWorkflowResponseRows.filter((row) => row.bucket === 'ready')
    },
    {
      id: 'manual',
      title: 'À résoudre',
      helper: 'Ces TPI demandent un arbitrage manuel de créneau avant publication.',
      rows: voteWorkflowResponseRows.filter((row) => row.bucket === 'manual')
    },
    {
      id: 'confirmed',
      title: 'Confirmés',
      helper: 'Les défenses ont un créneau confirmé.',
      rows: voteWorkflowResponseRows.filter((row) => row.bucket === 'confirmed')
    }
  ]), [voteWorkflowResponseRows])

  const activeVoteWorkflowSections = useMemo(() => {
    if (activeTab === 'vote-pending') {
      return voteWorkflowSections.filter((section) => section.id === 'pending')
    }

    if (activeTab === 'vote-ready') {
      return voteWorkflowSections.filter((section) => section.id === 'ready')
    }

    return voteWorkflowSections
  }, [activeTab, voteWorkflowSections])

  const checkedConstraintByTpiId = useMemo(() => (
    constraintCheckResult?.byTpiId && typeof constraintCheckResult.byTpiId === 'object'
      ? constraintCheckResult.byTpiId
      : {}
  ), [constraintCheckResult])

  const legacyPlanningPerimeterEntries = useMemo(() => {
    if (!isAdmin || !legacyTpis.length) {
      return []
    }

    return legacyTpis.map((tpi) => ({
      tpi,
      planningPerimeter: getPlanningPerimeterState(tpi, planningSiteConfigs, year)
    }))
  }, [legacyTpis, isAdmin, planningSiteConfigs, year])

  // TPI legacy non importés (dans le legacy mais pas dans tpiPlannings)
  const notImportedLegacyTpis = useMemo(() => {
    if (!legacyPlanningPerimeterEntries.length) return []

    // Extraire les refsTpi des TPI importés (format TPI-2026-XXX)
    const importedRefs = new Set(
      tpis.map(tpi => {
        // reference = "TPI-2026-2246" -> extraire "2246"
        const match = tpi.reference?.match(/TPI-\d+-(.+)/)
        return match ? match[1] : null
      }).filter(Boolean)
    )

    return legacyPlanningPerimeterEntries
      .filter(({ tpi, planningPerimeter }) => {
        if (!planningPerimeter.isPlanifiable) {
          return false
        }

        const ref = tpi.refTpi || tpi.id
        return ref && !importedRefs.has(String(ref).trim())
      })
      .map(({ tpi }) => tpi)
  }, [legacyPlanningPerimeterEntries, tpis])

  const notImportedLegacyTpisByPlanningPerimeter = notImportedLegacyTpis

  const legacyTpiCount = legacyTpis.length
  const hasLegacyPlanningData = isAdmin && stats.total === 0 && legacyTpiCount > 0
  const hasLegacyImportGap = notImportedLegacyTpisByPlanningPerimeter.length > 0
  const validationAnnotations = useMemo(() => {
    const issues = Array.isArray(validationResult?.issues) ? validationResult.issues : []
    const blockingIssues = issues.filter((issue) => !isValidationWarningIssue(issue))
    const warningIssues = issues.filter(isValidationWarningIssue)

    if (issues.length === 0) {
      return {
        byTpiId: {},
        impactedTpiCount: 0,
        orphanIssues: [],
        totalIssues: 0,
        blockingIssueCount: 0,
        warningCount: 0,
        checkedAtLabel: formatValidationCheckedAt(validationResult?.checkedAt)
      }
    }

    const byTpiId = {}
    const knownTpiIds = new Set(
      tpis
        .map((tpi) => compactText(tpi?._id))
        .filter(Boolean)
    )
    const referenceToTpiId = new Map(
      tpis
        .map((tpi) => [compactText(tpi?.reference), compactText(tpi?._id)])
        .filter(([reference, tpiId]) => reference && tpiId)
    )
    const orphanIssues = []

    issues.forEach((issue) => {
      const matchedTpiIds = new Set()
      const directTpiId = compactText(issue?.tpiId)

      if (directTpiId && knownTpiIds.has(directTpiId)) {
        matchedTpiIds.add(directTpiId)
      }

      getValidationIssueReferences(issue).forEach((reference) => {
        const matchedTpiId = referenceToTpiId.get(reference)
        if (matchedTpiId) {
          matchedTpiIds.add(matchedTpiId)
        }
      })

      if (matchedTpiIds.size === 0) {
        orphanIssues.push({
          ...issue,
          label: getValidationIssueLabel(issue)
        })
        return
      }

      matchedTpiIds.forEach((tpiId) => {
        if (!byTpiId[tpiId]) {
          byTpiId[tpiId] = {
            count: 0,
            issues: [],
            labels: [],
            messages: [],
            reasons: []
          }
        }

        const target = byTpiId[tpiId]
        const label = getValidationIssueLabel(issue)
        const message = compactText(issue?.message)
        const reason = compactText(issue?.reason)

        target.count += 1
        target.issues.push(issue)

        if (label && !target.labels.includes(label)) {
          target.labels.push(label)
        }

        if (message && !target.messages.includes(message)) {
          target.messages.push(message)
        }

        if (reason && !target.reasons.includes(reason)) {
          target.reasons.push(reason)
        }
      })
    })

    orphanIssues.sort((left, right) => {
      const leftKey = `${compactText(left?.reference || left?.legacyRef)}|${compactText(left?.type)}`
      const rightKey = `${compactText(right?.reference || right?.legacyRef)}|${compactText(right?.type)}`
      return leftKey.localeCompare(rightKey)
    })

    return {
      byTpiId,
      impactedTpiCount: Object.keys(byTpiId).length,
      orphanIssues,
      totalIssues: issues.length,
      blockingIssueCount: blockingIssues.length,
      warningCount: warningIssues.length,
      checkedAtLabel: formatValidationCheckedAt(validationResult?.checkedAt)
    }
  }, [tpis, validationResult])
  const validationBlockingIssueCount = Number(
    validationAnnotations.blockingIssueCount ?? validationAnnotations.totalIssues ?? 0
  )
  const validationWarningCount = Number(validationAnnotations.warningCount || 0)
  const validationHasBlockingIssues = validationBlockingIssueCount > 0
  const validationHasWarnings = !validationHasBlockingIssues && validationWarningCount > 0

  const workflowPhases = workflow?.phases || {}
  const isWorkflowPhaseActive = (phase) => {
    if (workflowPhases?.[phase] && typeof workflowPhases[phase].active === 'boolean') {
      return workflowPhases[phase].active
    }

    if (phase === 'planning') {
      return (workflow?.state || 'planning') === 'planning'
    }

    if (phase === 'votes') {
      return workflow?.state === 'voting_open'
    }

    if (phase === 'defenses') {
      return workflow?.state === 'published'
    }

    return false
  }
  const activeWorkflowPhaseLabels = [
    isWorkflowPhaseActive('planning') ? 'Planification' : '',
    isWorkflowPhaseActive('votes') ? 'Votes' : '',
    isWorkflowPhaseActive('arbitrage') ? 'Arbitrage' : '',
    isWorkflowPhaseActive('defenses') ? 'Défenses' : ''
  ].filter(Boolean)
  const workflowState = workflow?.state || 'planning'
  const workflowLabel = activeWorkflowPhaseLabels.length > 0
    ? activeWorkflowPhaseLabels.join(' + ')
    : WORKFLOW_LABELS[workflowState] || workflowState
  const hasActiveSnapshot = Boolean(activeSnapshot?.version)
  const isVotingState = isWorkflowPhaseActive('votes')
  const isPublishedState = isWorkflowPhaseActive('defenses')
  const isScopedVoteViewer = Boolean(!isAdmin && magicLinkViewer?.personId)
  const hasSuccessfulValidation =
    !validationResult ||
    Number(validationResult?.year) !== Number(year) ||
    validationResult?.summary?.isValid === true
  const hasBlockedValidation = Boolean(validationResult) &&
    Number(validationResult?.year) === Number(year) &&
    validationResult?.summary?.isValid === false
  const canStartVotes = !hasLegacyImportGap
  const canPublish = !hasLegacyImportGap

  const selectedTpiValidationMessages = useMemo(() => {
    if (!selectedTpi) {
      return []
    }

    return validationAnnotations.byTpiId[compactText(selectedTpi._id)]?.messages || []
  }, [selectedTpi, validationAnnotations.byTpiId])

  const selectedTpiDetailLink = useMemo(() => {
    if (!selectedTpi) {
      return ROUTES.GESTION_TPI
    }

    return buildTpiDetailsLink(
      year,
      compactText(selectedTpi.reference) || compactText(selectedTpi._id)
    )
  }, [selectedTpi, year])

  const selectedTpiCandidateLabel = useMemo(() => {
    return formatPersonName(
      selectedTpi?.candidat,
      `${CANDIDATE_ROLE_LABEL} non renseigné`
    )
  }, [selectedTpi])
  const selectedTpiSubjectLabel = useMemo(() => {
    return compactText(selectedTpi?.sujet) ||
      'Sujet non renseigné'
  }, [selectedTpi])
  const selectedTpiStatusMeta = useMemo(() => {
    return getPlanningStatusMeta(selectedTpi?.status)
  }, [selectedTpi])
  const selectedTpiSlotLabel = useMemo(() => {
    return formatVoteSlotLabel(selectedTpi?.confirmedSlot || getVoteFixedSlot(selectedTpi))
  }, [selectedTpi])
  const selectedTpiHasSlot = useMemo(() => {
    return Boolean(selectedTpi?.confirmedSlot || getVoteFixedSlot(selectedTpi))
  }, [selectedTpi])
  const selectedTpiIssueCount = useMemo(() => {
    const planningIssues = Array.isArray(selectedTpi?.conflicts)
      ? selectedTpi.conflicts.length
      : 0

    return planningIssues + selectedTpiValidationMessages.length
  }, [selectedTpi, selectedTpiValidationMessages])
  const selectedTpiVoteEntries = useMemo(() => getVoteRoleEntries(selectedTpi), [selectedTpi])
  const selectedTpiRespondedVoteCount = useMemo(() => (
    selectedTpiVoteEntries.filter((entry) => hasVoteRoleResponded(entry.status)).length
  ), [selectedTpiVoteEntries])
  const selectedTpiManualAction = useMemo(() => {
    return MANUAL_REQUIRED_STATUSES.includes(normalizeCoordinationStatus(selectedTpi?.status))
  }, [selectedTpi])
  const focusedTpiMatch = useMemo(() => {
    if (!requestedFocus) {
      return null
    }

    return visibleTpis.find((tpi) => matchesFocusReference(tpi?.reference, requestedFocus)) || null
  }, [requestedFocus, visibleTpis])
  const hasFocusWithoutMatch = Boolean(requestedFocus) && !focusedTpiMatch

  useEffect(() => {
    if (!requestedFocus) {
      setAppliedFocus('')
      return
    }

    if (appliedFocus === requestedFocus || isLoading) {
      return
    }

    const focusTargetTab = isAdmin ? 'votes' : 'list'
    if (activeTab !== focusTargetTab) {
      setActiveTab(focusTargetTab)
    }

    if (statusFilter !== 'all') {
      setStatusFilter('all')
    }

    if (dateFilter) {
      setDateFilter('')
    }

    if (searchQuery !== requestedFocus) {
      setSearchQuery(requestedFocus)
    }

    const matchedTpi = visibleTpis.find((tpi) =>
      matchesFocusReference(tpi?.reference, requestedFocus)
    )

    if (matchedTpi) {
      setSelectedTpi((currentSelection) => {
        if (compactText(currentSelection?._id) === compactText(matchedTpi?._id)) {
          return currentSelection
        }

        return matchedTpi
      })
    }

    setAppliedFocus(requestedFocus)
  }, [
    requestedFocus,
    appliedFocus,
    isLoading,
    activeTab,
    dateFilter,
    searchQuery,
    statusFilter,
    visibleTpis,
    isAdmin
  ])

  useEffect(() => {
    if (!selectedTpi) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setSelectedTpi(null)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [selectedTpi])

  useEffect(() => {
    if (!proposalMoveReview) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow

    const handleEscape = (event) => {
      if (event.key === 'Escape' && !proposalMoveApplying) {
        setProposalMoveReview(null)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [proposalMoveReview, proposalMoveApplying])

  useEffect(() => {
    if (!resolutionProposalDraft) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow

    const handleEscape = (event) => {
      if (event.key === 'Escape' && !resolutionProposalSubmitting) {
        setResolutionProposalDraft(null)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [resolutionProposalDraft, resolutionProposalSubmitting])

  const clearFocusedSearch = useCallback(() => {
    const params = new URLSearchParams(location.search)
    params.delete('focus')
    params.delete('tab')

    setAppliedFocus('')
    setSearchQuery('')
    setSelectedTpi(null)
    setStatusFilter('all')
    setDateFilter('')

    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : ''
      },
      { replace: true }
    )
  }, [location.pathname, location.search, navigate])

  /**
   * Lance le processus de vote pour un TPI
   */
  const handleProposeSlots = useCallback(async (tpiId) => {
    try {
      const result = await tpiCoordinationService.proposeSlots(tpiId)
      
      if (result.success) {
        // Recharger les données
        await loadData()
        setSelectedTpi(null)
      } else {
        setError(result.message || 'Erreur lors de la proposition des créneaux')
      }
    } catch (err) {
      setError('Erreur lors de la proposition des créneaux')
      console.error(err)
    }
  }, [loadData])

  /**
   * Force l'attribution d'un créneau (intervention manuelle)
   */
  const handleForceSlot = useCallback(async (tpiId, slotId, reason) => {
    try {
      const result = await tpiCoordinationService.forceSlot(tpiId, slotId, reason)
      
      if (result.success) {
        await loadData()
        setSelectedTpi(null)
      } else {
        setError(result.message || 'Erreur lors de l\'attribution manuelle')
      }
    } catch (err) {
      setError('Erreur lors de l\'attribution manuelle')
      console.error(err)
    }
  }, [loadData])

  const openManualResolver = useCallback((tpi) => {
    const tpiId = compactText(tpi?._id)
    setManualFocusTpiId(tpiId)
    setSelectedTpi(null)
    setActiveTab('conflicts')
  }, [])

  const handleForceVoteSlot = useCallback(async (tpi, slot) => {
    const tpiId = compactText(tpi?._id)
    const slotId = compactText(slot?.slotId)
    const reference = compactText(tpi?.reference) || 'ce TPI'
    const positiveCount = Number(slot?.positiveCount || 0)

    if (!tpiId || !slotId) {
      setError('Impossible d’identifier le TPI ou le créneau à valider.')
      return
    }

    const actionLabel = positiveCount >= 3
      ? 'valider le consensus'
      : positiveCount === 2
        ? 'valider ce créneau avec 2 avis favorables'
        : 'choisir ce créneau manuellement'
    const confirmation = window.confirm(
      `Confirmer: ${actionLabel} pour ${reference} ?`
    )

    if (!confirmation) {
      return
    }

    try {
      const result = await tpiCoordinationService.forceSlot(
        tpiId,
        slotId,
        buildAdminSlotForceReason(reference, slot)
      )

      if (result?.success) {
        setSuccessMessage(`${reference}: créneau confirmé.`)
        await loadData()
        setSelectedTpi(null)
      } else {
        setError(result?.message || 'Erreur lors de la confirmation du créneau.')
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Erreur lors de la confirmation du créneau.'))
      console.error(err)
    }
  }, [loadData])

  const handleReviewVoteProposalMove = useCallback(async (tpi, summary, slot) => {
    const tpiId = compactText(tpi?._id)
    const slotId = compactText(slot?.slotId)
    const reference = compactText(tpi?.reference) || 'ce TPI'

    if (!tpiId || !slotId) {
      setError('Impossible d’identifier le TPI ou le créneau proposé.')
      return
    }

    const review = {
      status: 'loading',
      tpi,
      summary,
      slot
    }

    setError(null)
    setSelectedTpi(null)
    setProposalMoveReview(review)
    setProposalMoveLoadingKey(`${tpiId}:${slotId}`)

    try {
      const simulation = await tpiCoordinationService.simulateMoveToSlot(tpiId, slotId)
      setProposalMoveReview({
        ...review,
        status: 'ready',
        simulation
      })
    } catch (err) {
      const message = getApiErrorMessage(err, `Impossible de tester le déplacement de ${reference}.`)
      setProposalMoveReview({
        ...review,
        status: 'error',
        message
      })
      setError(message)
      console.error(err)
    } finally {
      setProposalMoveLoadingKey('')
    }
  }, [])

  const handleApplyVoteProposalMove = useCallback(async () => {
    const tpiId = compactText(proposalMoveReview?.tpi?._id)
    const slotId = compactText(proposalMoveReview?.slot?.slotId)
    const reference = compactText(proposalMoveReview?.tpi?.reference) || 'ce TPI'
    const targetSlotLabel = getMoveSlotLabel(
      proposalMoveReview?.simulation?.targetSlot,
      compactText(proposalMoveReview?.slot?.label) || 'ce créneau'
    )

    if (!tpiId || !slotId) {
      setError('Impossible d’identifier le TPI ou le créneau à confirmer.')
      return
    }

    if (!proposalMoveReview?.simulation?.canMove) {
      setError('Le déplacement est bloqué par un conflit. Ouvre la résolution manuelle pour le traiter.')
      return
    }

    const confirmed = window.confirm(
      `Confirmer le déplacement de ${reference} vers ${targetSlotLabel} ?`
    )

    if (!confirmed) {
      return
    }

    setProposalMoveApplying(true)
    setError(null)

    try {
      const result = await tpiCoordinationService.moveToSlot(
        tpiId,
        slotId,
        buildVoteProposalMoveReason(proposalMoveReview.tpi, proposalMoveReview.summary, proposalMoveReview.slot)
      )

      if (result?.success) {
        const message = `${reference}: déplacement confirmé. Lance Sync + gel pour mettre à jour Planification et Défenses.`
        toast.success(message)
        setSuccessMessage(message)
        setProposalMoveReview(null)
        await loadData()
      } else {
        const message = result?.message || 'Le déplacement est impossible avec les contraintes actuelles.'
        setProposalMoveReview((current) => ({
          ...current,
          status: 'ready',
          message,
          simulation: result?.simulation || result || current?.simulation
        }))
        setError(message)
      }
    } catch (err) {
      const message = getApiErrorMessage(err, 'Erreur lors du déplacement du TPI.')
      setError(message)
      console.error(err)
    } finally {
      setProposalMoveApplying(false)
    }
  }, [proposalMoveReview, loadData])

  const handleOpenResolutionProposal = useCallback((tpi, row, slot = null) => {
    const decisionSlots = Array.isArray(row?.decisionSlots) ? row.decisionSlots : []
    const selectedSlot = slot || decisionSlots.find((candidateSlot) => compactText(candidateSlot?.slotId)) || null
    const slotId = compactText(selectedSlot?.slotId)

    if (!tpi || !row || !slotId) {
      setError('Impossible de préparer la proposition: aucun créneau exploitable.')
      return
    }

    setError(null)
    setSelectedTpi(null)
    setResolutionProposalDraft({
      tpi,
      row,
      slotId,
      devMode: IS_DEBUG,
      sentProposal: null,
      recipientRoles: DEFAULT_RESOLUTION_RECIPIENT_ROLES,
      message: buildResolutionProposalDefaultMessage(tpi, selectedSlot)
    })
  }, [])

  const handleSendResolutionProposal = useCallback(async () => {
    const tpiId = compactText(resolutionProposalDraft?.tpi?._id)
    const slotId = compactText(resolutionProposalDraft?.slotId)
    const reference = compactText(resolutionProposalDraft?.tpi?.reference) || 'ce TPI'

    if (!tpiId || !slotId) {
      setError('Impossible d’identifier le TPI ou le créneau proposé.')
      return
    }

    const recipientRoles = normalizeResolutionRecipientRoles(resolutionProposalDraft?.recipientRoles)

    setResolutionProposalSubmitting(true)
    setError(null)

    try {
      const result = await resolutionProposalService.create(tpiId, {
        slotId,
        year,
        message: resolutionProposalDraft?.message,
        recipientRoles,
        baseUrl: window.location.origin,
        devMode: IS_DEBUG && resolutionProposalDraft?.devMode === true
      })

      if (result?.success === false) {
        throw new Error(result?.message || 'Envoi de la proposition impossible.')
      }

      const createdProposal = result?.proposal || result
      const hasDevLinks = Array.isArray(createdProposal?.devLinks) && createdProposal.devLinks.length > 0
      const message = hasDevLinks
        ? `${reference}: liens DEV générés, aucun email envoyé.`
        : `${reference}: proposition transmise.`
      toast.success(message)
      setSuccessMessage(message)
      await loadData()

      if (hasDevLinks) {
        setResolutionProposalDraft((current) => ({
          ...current,
          sentProposal: createdProposal
        }))
        return
      }

      setResolutionProposalDraft(null)
    } catch (err) {
      const message = getApiErrorMessage(err, `Envoi de la proposition impossible pour ${reference}.`)
      setError(message)
      toast.error(message)
      console.error(err)
    } finally {
      setResolutionProposalSubmitting(false)
    }
  }, [resolutionProposalDraft, loadData])

  const handleInsertProposalPreference = useCallback(async (summary, slot) => {
    const voteId = compactText(slot?.voteId)
    const slotId = compactText(slot?.slotId)
    const actionKey = `${voteId || summary?.role || 'vote'}:${slotId || 'slot'}`

    if (!voteId) {
      setError('Impossible d’identifier la préférence à enregistrer.')
      return
    }

    setPreferenceActionLoadingKey(actionKey)
    setError(null)

    try {
      const result = await voteService.addProposalToPreferences(voteId)
      const voterName = compactText(result?.voter?.name) || compactText(summary?.voterName) || summary?.roleLabel || 'Votant'
      const message = result?.added
        ? `${voterName}: préférence enregistrée dans ses dates idéales.`
        : `${voterName}: préférence déjà présente dans ses dates idéales.`

      toast.success(message)
      setSuccessMessage(message)
      await loadData()
    } catch (err) {
      const message = getApiErrorMessage(err, 'Impossible d’enregistrer cette préférence.')
      setError(message)
      console.error(err)
    } finally {
      setPreferenceActionLoadingKey('')
    }
  }, [loadData])

  const isActionRunning = useCallback(
    (actionKey) => workflowActionLoading && pendingWorkflowAction === actionKey,
    [workflowActionLoading, pendingWorkflowAction]
  )

  const executeWorkflowAction = useCallback(async ({
    actionKey,
    confirmMessage = '',
    run,
    successBuilder,
    errorFallback,
    reloadAfterSuccess = false,
    onSuccess = null,
    onError = null
  }) => {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return
    }

    setWorkflowActionLoading(true)
    setPendingWorkflowAction(actionKey)
    setError(null)
    setSuccessMessage(null)

    try {
      logWorkflowDebug(`[WORKFLOW] Exécution action: ${actionKey}`)
      const result = await run()
      logWorkflowDebug(`[WORKFLOW] Résultat ${actionKey}:`, result)

      if (reloadAfterSuccess) {
        logWorkflowDebug(`[WORKFLOW] Rechargement données après ${actionKey}`)
        await loadData()
      }

      const builtMessage = typeof successBuilder === 'function'
        ? successBuilder(result)
        : successBuilder

      if (builtMessage) {
        logWorkflowDebug(`[WORKFLOW] Message succès: ${builtMessage}`)
        setSuccessMessage(builtMessage)
      }

      if (typeof onSuccess === 'function') {
        onSuccess(result)
      }

      return result
    } catch (err) {
      console.error(`[WORKFLOW] Erreur ${actionKey}:`, err)
      const errorMsg = getApiErrorMessage(err, errorFallback)
      console.error(`[WORKFLOW] Message d'erreur: ${errorMsg}`)
      setError(errorMsg)

      if (typeof onError === 'function') {
        onError(errorMsg, err)
      }
    } finally {
      setWorkflowActionLoading(false)
      setPendingWorkflowAction('')
    }
  }, [loadData])

  const handleValidatePlanification = useCallback(async () => {
    const loadingToastId = toast.loading(`Vérification ${year} en cours...`, {
      position: 'top-center'
    })

    const result = await executeWorkflowAction({
      actionKey: 'validate',
      run: () => workflowCoordinationService.validatePlanification(year),
      successBuilder: null,
      errorFallback: 'Erreur lors de la validation de la planification.',
      onSuccess: (validationResult) => {
        setValidationResult(validationResult)
        if (Number(validationResult?.summary?.issueCount || 0) > 0) {
          setStatusFilter('all')
          setSearchQuery('')
          setDateFilter('')
          setActiveTab('list')
        }

        const validationToast = buildValidationToast(year, validationResult)
        toast.update(loadingToastId, {
          render: validationToast.message,
          type: validationToast.level,
          isLoading: false,
          autoClose: 6000,
          closeOnClick: true,
          closeButton: true
        })
      },
      onError: (errorMsg) => {
        setValidationResult(null)
        toast.update(loadingToastId, {
          render: errorMsg,
          type: 'error',
          isLoading: false,
          autoClose: 7000,
          closeOnClick: true,
          closeButton: true
        })
      }
    })

    return result
  }, [year, executeWorkflowAction])

  const handleCheckVoteConstraints = useCallback(() => {
    const result = buildVoteConstraintCheckResult(voteWorkflowAllRows, year)
    setConstraintCheckResult(result)

    if (result.conflictCount > 0) {
      setActiveTab('votes')
      toast.warning(
        `${result.impactedTpiCount} TPI avec contrainte dure (${result.conflictCount} signalement${result.conflictCount > 1 ? 's' : ''}).`,
        { position: 'top-center' }
      )
      return
    }

    toast.success('Aucune contrainte dure bloquante détectée.', {
      position: 'top-center'
    })
  }, [voteWorkflowAllRows, year])

  const handleAutomatePlanification = useCallback(async () => {
    await executeWorkflowAction({
      actionKey: 'autoPlan',
      confirmMessage: `Reconstruire automatiquement la planification ${year} ? Les créneaux proposés actuels seront recalculés à partir de la configuration.`,
      run: () => workflowCoordinationService.automatePlanification(year),
      successBuilder: (result) => {
        const summary = result?.summary || {}
        const syncSummary = result?.sync || {}
        const validationSummary = result?.validation?.summary || {}
        const totalTpis = Number(summary.totalTpis || 0)
        const plannedCount = Number(summary.plannedCount || 0)
        const manualRequiredCount = Number(summary.manualRequiredCount || 0)
        const constraintOverrideCount = Number(summary.constraintOverrideCount || 0)
        const issueCount = Number(validationSummary.issueCount || 0)
        const syncCreatedCount = Number(syncSummary.createdCount || 0)
        const constraintText = constraintOverrideCount > 0
          ? ` ${constraintOverrideCount} TPI placé(s) avec alerte de contrainte.`
          : ''
        const suffix = issueCount > 0
          ? ` ${issueCount} anomalie(s) restent à corriger.`
          : ' Planification prête pour vérification.'
        const syncPrefix = syncCreatedCount > 0
          ? `${syncCreatedCount} TPI intégré(s) depuis GestionTPI dans le workflow. `
          : ''

        return `${syncPrefix}Planification automatique: ${plannedCount}/${totalTpis} TPI placés, ${manualRequiredCount} en manuel, ${Number(summary.slotCount || 0)} créneau(x) généré(s).${constraintText}${suffix}`
      },
      errorFallback: 'Erreur lors de la planification automatique.',
      reloadAfterSuccess: true,
      onSuccess: (result) => {
        if (result?.validation) {
          setValidationResult(result.validation)
        }

        if (
          Number(result?.summary?.manualRequiredCount || 0) > 0 ||
          Number(result?.summary?.constraintOverrideCount || 0) > 0 ||
          Number(result?.validation?.summary?.issueCount || 0) > 0
        ) {
          setStatusFilter('all')
          setSearchQuery('')
          setDateFilter('')
          setActiveTab('list')
        }
      }
    })
  }, [year, executeWorkflowAction])

  const handleFreezePlanification = useCallback(async () => {
    const result = await executeWorkflowAction({
      actionKey: 'freeze',
      confirmMessage: `Confirmer le gel du snapshot de planification ${year} ?`,
      run: () => workflowCoordinationService.freezePlanification(year),
      successBuilder: (result) => `Snapshot v${result?.snapshot?.version || '?'} gele avec succes.`,
      errorFallback: 'Erreur lors du freeze de la planification.',
      reloadAfterSuccess: true
    })

    if (result?.snapshot?.version) {
      setActiveSnapshot({
        ...result.snapshot,
        isActive: true
      })
    }
  }, [year, executeWorkflowAction])

  const handleSyncPlanificationFromCoordination = useCallback(async () => {
    const result = await executeWorkflowAction({
      actionKey: 'syncPlanification',
      confirmMessage: `Synchroniser la Planification ${year} depuis Coordination et geler un nouveau snapshot ?`,
      run: () => workflowCoordinationService.syncPlanificationFromCoordination(year),
      successBuilder: (result) => {
        const summary = result?.summary || {}
        const snapshotVersion = result?.snapshot?.version || '?'
        const tpiCount = Number(summary.tpiCount || 0)
        const roomCount = Number(summary.roomCount || 0)

        return `Planification synchronisée depuis Coordination: ${tpiCount} TPI, ${roomCount} salle(s). Snapshot v${snapshotVersion} gelé.`
      },
      errorFallback: 'Erreur lors de la synchronisation Planification depuis Coordination.',
      reloadAfterSuccess: true
    })

    if (Array.isArray(result?.legacyRooms)) {
      writeJSONValue(STORAGE_KEYS.ORGANIZER_DATA, result.legacyRooms)
    }

    if (result?.snapshot?.version) {
      setActiveSnapshot({
        ...result.snapshot,
        isActive: true
      })
    }
  }, [year, executeWorkflowAction])

  const handleStartVotesCampaign = useCallback(async () => {
    const result = await executeWorkflowAction({
      actionKey: 'startVotes',
      confirmMessage: 'Confirmer l ouverture de la campagne de votes sans envoyer d emails ?',
      run: () => workflowCoordinationService.startVotesWithoutEmails(year),
      successBuilder: (result) => {
        const tpiCount = result?.tpiCount || 0
        return `Campagne ouverte: ${tpiCount} TPI synchronises, aucun email envoye automatiquement.`
      },
      errorFallback: 'Erreur lors du lancement de la campagne de votes.',
      onError: (_errorMessage, error) => {
        const validationFromError = extractValidationResultFromError(year, error)
        if (validationFromError) {
          setValidationResult(validationFromError)
          setStatusFilter('all')
          setSearchQuery('')
          setDateFilter('')
          setActiveTab('list')
        }
      },
      reloadAfterSuccess: true
    })

    if (result?.workflowState) {
      setWorkflow(prev => ({
        ...(prev || {}),
        state: result.workflowState,
        ...(result?.workflow?.phases ? { phases: result.workflow.phases } : {})
      }))
    }
  }, [year, executeWorkflowAction])

  const handleStartVotesCampaignWithoutEmails = useCallback(async () => {
    const result = await executeWorkflowAction({
      actionKey: 'startVotesNoEmail',
      confirmMessage: 'Confirmer l ouverture de la campagne de votes sans envoyer d emails ?',
      run: () => workflowCoordinationService.startVotesWithoutEmails(year),
      successBuilder: (result) => {
        const tpiCount = result?.tpiCount || 0
        return `Campagne ouverte: ${tpiCount} TPI synchronises, aucun email envoye.`
      },
      errorFallback: 'Erreur lors de l ouverture de la campagne de votes sans emails.',
      onError: (_errorMessage, error) => {
        const validationFromError = extractValidationResultFromError(year, error)
        if (validationFromError) {
          setValidationResult(validationFromError)
          setStatusFilter('all')
          setSearchQuery('')
          setDateFilter('')
          setActiveTab('list')
        }
      },
      reloadAfterSuccess: true
    })

    if (result?.workflowState) {
      setWorkflow(prev => ({
        ...(prev || {}),
        state: result.workflowState,
        ...(result?.workflow?.phases ? { phases: result.workflow.phases } : {})
      }))
    }
  }, [year, executeWorkflowAction])

  const handleRemindVotes = useCallback(async () => {
    await executeWorkflowAction({
      actionKey: 'remindVotes',
      run: () => workflowCoordinationService.remindVotes(year),
      successBuilder: (result) =>
        `Relances envoyees: ${result?.emailsSucceeded || 0}/${result?.emailsSent || 0}.`,
      errorFallback: 'Erreur lors de la relance des votes.',
      reloadAfterSuccess: true
    })
  }, [year, executeWorkflowAction])

  const handleCloseVotes = useCallback(async () => {
    await executeWorkflowAction({
      actionKey: 'closeVotes',
      confirmMessage: 'Confirmer la cloture de la campagne de votes ?',
      run: () => workflowCoordinationService.closeVotes(year),
      successBuilder: (result) =>
        `Cloture terminee: ${result?.confirmedCount || 0} confirmes, ${result?.manualRequiredCount || 0} en manuel.`,
      errorFallback: 'Erreur lors de la cloture des votes.',
      reloadAfterSuccess: true
    })
  }, [year, executeWorkflowAction])

  const soutenanceSiteLinkOptions = useMemo(() => {
    const publicUrl = typeof staticPublicationInfo?.publicUrl === 'string'
      ? staticPublicationInfo.publicUrl.trim()
      : ''

    return publicUrl
      ? {
          soutenanceLinkTarget: 'publication',
          soutenancePublicUrl: publicUrl
        }
      : {}
  }, [staticPublicationInfo?.publicUrl])

  const handlePublishDefinitive = useCallback(async () => {
    await executeWorkflowAction({
      actionKey: 'publish',
      confirmMessage: 'Confirmer la publication definitive des défenses ?',
      run: () => workflowCoordinationService.publishDefinitive(year, null, soutenanceSiteLinkOptions),
      successBuilder: (result) => {
        const sent = result?.sentLinks
        const sentLabel = sent?.emailsSkipped
          ? ' Liens défense: non envoyes automatiquement.'
          : sent
          ? ` Liens défense: ${sent.emailsSucceeded || 0}/${sent.emailsSent || 0}.`
          : ''
        return (result?.message || 'Publication definitive terminee.') + sentLabel
      },
      errorFallback: 'Erreur lors de la publication definitive.',
      reloadAfterSuccess: true
    })
  }, [year, executeWorkflowAction, soutenanceSiteLinkOptions])

  const handleSendPublicationLinks = useCallback(async () => {
    await executeWorkflowAction({
      actionKey: 'sendLinks',
      run: () => workflowCoordinationService.sendPublicationLinks(year, soutenanceSiteLinkOptions),
      successBuilder: (result) => {
        const sent = result?.sentLinks
        return `Liens défense envoyes: ${sent?.emailsSucceeded || 0}/${sent?.emailsSent || 0}.`
      },
      errorFallback: 'Erreur lors de l envoi des liens défense.'
    })
  }, [year, executeWorkflowAction, soutenanceSiteLinkOptions])

  const handleSendDefenseChangeNotifications = useCallback(async () => {
    const pendingCount = Number(defenseChangeNotificationInfo?.summary?.pendingRecipientCount || 0)
    const changedDefenseCount = Number(defenseChangeNotificationInfo?.summary?.changedDefenseCount || 0)
    const confirmMessage = pendingCount > 0
      ? `Transmettre la notification de changement à ${pendingCount} partie(s) prenante(s) pour ${changedDefenseCount} défense(s) modifiée(s) ?`
      : ''

    await executeWorkflowAction({
      actionKey: 'notifyDefenseChanges',
      confirmMessage,
      run: () => workflowCoordinationService.sendDefenseChangeNotifications(year, soutenanceSiteLinkOptions),
      successBuilder: (result) => {
        const summary = result?.summary || {}
        return `Notifications changements défenses: ${summary.sentCount || 0} envoyée(s), ${summary.skippedCount || 0} ignorée(s), ${summary.failedCount || 0} échec(s).`
      },
      errorFallback: 'Erreur lors de l’envoi des notifications de changements des défenses.',
      onSuccess: (result) => {
        setDefenseChangeNotificationInfo(result?.preview || null)
      }
    })
  }, [year, executeWorkflowAction, soutenanceSiteLinkOptions, defenseChangeNotificationInfo])

  const handleGenerateStaticVotePublication = useCallback(async () => {
    await executeWorkflowAction({
      actionKey: 'staticVoteGenerate',
      confirmMessage: STATIC_VOTE_REGENERATION_CONFIRM_MESSAGE,
      run: () => workflowCoordinationService.generateStaticVotePublication(year),
      successBuilder: (result) =>
        `Mini-site vote genere: ${result?.groupCount || 0} vote(s), ${result?.accessLinkCount || 0} lien(s).`,
      errorFallback: 'Erreur lors de la generation du mini-site vote.',
      onSuccess: (result) => setStaticVotePublicationInfo(result || null)
    })
  }, [year, executeWorkflowAction])

  const handlePublishStaticVotePublication = useCallback(async () => {
    await executeWorkflowAction({
      actionKey: 'staticVotePublish',
      confirmMessage: 'Confirmer la publication FTP du mini-site vote ?',
      run: () => workflowCoordinationService.publishStaticVotePublication(year),
      successBuilder: (result) => `Mini-site vote publie: ${result?.publicUrl || 'URL publique disponible'}.`,
      errorFallback: 'Erreur lors de la publication FTP du mini-site vote.',
      onSuccess: (result) => setStaticVotePublicationInfo(prev => ({
        ...(prev || {}),
        ...(result || {}),
        available: true
      }))
    })
  }, [year, executeWorkflowAction])

  const handleSyncStaticVotePublication = useCallback(async () => {
    await executeWorkflowAction({
      actionKey: 'staticVoteSync',
      run: () => workflowCoordinationService.syncStaticVotePublication(year),
      successBuilder: (result) =>
        `Mini-site synchronise: ${result?.voteImportedCount ?? result?.importedCount ?? 0}/${result?.voteReceivedCount ?? result?.receivedCount ?? 0} vote(s), ${result?.arbitrageImportedCount || 0}/${result?.arbitrageReceivedCount || 0} arbitrage(s), ${result?.failedCount || 0} erreur(s).`,
      errorFallback: 'Erreur lors de la synchronisation des votes statiques.',
      reloadAfterSuccess: true
    })
  }, [year, executeWorkflowAction])

  const handleOpenPublishedView = useCallback(() => {
    const normalizedYear = Number.parseInt(year, 10)
    const targetYear = YEARS_CONFIG.isSupportedYear(normalizedYear)
      ? normalizedYear
      : YEARS_CONFIG.getCurrentYear()

    navigate(`${ROUTES.SOUTENANCES}/${targetYear}`)
  }, [year, navigate])

  const handleOpenVoteAccessPreview = useCallback(() => {
    const query = new URLSearchParams({
      year: String(year),
      type: 'vote',
      auto: '1'
    })

    navigate(`${ROUTES.GEN_TOKENS}?${query.toString()}`)
  }, [navigate, year])

  const handleExitScopedVoteView = useCallback(() => {
    const parsedYear = Number.parseInt(year, 10)
    const targetYear = YEARS_CONFIG.isSupportedYear(parsedYear)
      ? parsedYear
      : YEARS_CONFIG.getCurrentYear()

    authCoordinationService.clearSession()
    navigate(`${ROUTES.COORDINATION}/${targetYear}`)
  }, [navigate, year])

  // Onglets de navigation
  const tabs = useMemo(() => {
    if (isScopedVoteViewer) {
      return [
        { id: 'votes', label: 'Votes', icon: <VoteIcon className='page-tools-tab-icon-svg' />, count: stats.pendingVotes },
        { id: 'list', label: 'Mes TPI', icon: <ListIcon className='page-tools-tab-icon-svg' />, count: stats.total }
      ]
    }

    return [
      { id: 'votes', label: 'Réponses reçues', icon: <VoteIcon className='page-tools-tab-icon-svg' />, count: voteWorkflowStats.responseTpis },
      { id: 'vote-pending', label: 'À relancer', icon: <MailIcon className='page-tools-tab-icon-svg' />, count: voteWorkflowStats.pendingResponseTpis },
      { id: 'vote-ready', label: 'Prêts à clore', icon: <CheckIcon className='page-tools-tab-icon-svg' />, count: voteWorkflowStats.readyResponseTpis },
      { id: 'conflicts', label: 'À résoudre', icon: <WrenchIcon className='page-tools-tab-icon-svg' />, count: voteWorkflowStats.manualTpis || stats.conflicts }
    ]
  }, [
    isScopedVoteViewer,
    stats.pendingVotes,
    stats.total,
    stats.conflicts,
    voteWorkflowStats.responseTpis,
    voteWorkflowStats.pendingResponseTpis,
    voteWorkflowStats.readyResponseTpis,
    voteWorkflowStats.manualTpis
  ])

  const activeTabPresentation = useMemo(() => {
    const presentation = TAB_PRESENTATIONS[activeTab] || TAB_PRESENTATIONS.list

    return {
      kicker: presentation.kicker,
      title: presentation.title,
      description: isAdmin
        ? presentation.adminDescription
        : presentation.viewerDescription
    }
  }, [activeTab, isAdmin])
  const statusFilterLabel = STATUS_FILTER_LABELS[statusFilter] || STATUS_FILTER_LABELS.all
  const dateFilterLabel = planningDateOptions.find((option) => option.value === dateFilter)?.label ||
    (dateFilter ? formatPlanningDateKey(dateFilter) || dateFilter : '')
  const activeViewCount = (() => {
    if (activeTab === 'list') {
      return filteredTpis.length
    }

    if (activeTab === 'votes') {
      return isAdmin ? filteredVoteTrackingTpis.length : pendingVotes.length
    }

    if (activeTab === 'vote-pending') {
      return voteWorkflowRows.filter((row) => row.bucket === 'pending').length
    }

    if (activeTab === 'vote-ready') {
      return voteWorkflowRows.filter((row) => row.bucket === 'ready').length
    }

    if (activeTab === 'conflicts') {
      return voteWorkflowStats.manualTpis || conflicts.length
    }

    return conflicts.length
  })()
  const isVoteWorkspaceTab = VOTE_WORKFLOW_TAB_IDS.includes(activeTab)
  const visibleTpiSummary = `${activeViewCount} TPI visible${activeViewCount === 1 ? '' : 's'}`
  const completeTpiSummary = `${voteWorkflowStats.readyTpis} complet${voteWorkflowStats.readyTpis === 1 ? '' : 's'}`
  const missingVoteSummary = `${voteWorkflowStats.missingVotes} réponse${voteWorkflowStats.missingVotes === 1 ? '' : 's'} manquante${voteWorkflowStats.missingVotes === 1 ? '' : 's'}`
  const planningCommandSummaryText = isAdmin
    ? `${visibleTpiSummary} · ${completeTpiSummary} · ${missingVoteSummary}`
    : `${activeViewCount} élément${activeViewCount > 1 ? 's' : ''} visible${activeViewCount > 1 ? 's' : ''}`
  const hasDashboardNotices = Boolean(
    error ||
    successMessage ||
    hasLegacyPlanningData
  )
  const proposalMoveSimulation = proposalMoveReview?.simulation || null
  const proposalMoveReference = compactText(proposalMoveReview?.tpi?.reference) ||
    compactText(proposalMoveSimulation?.tpi?.reference) ||
    'TPI'
  const proposalMoveVoterLabel = [
    compactText(proposalMoveReview?.summary?.roleLabel),
    compactText(proposalMoveReview?.summary?.voterName)
  ].filter(Boolean).join(' - ')
  const proposalMoveCurrentSlotLabel = getMoveSlotLabel(
    proposalMoveSimulation?.currentSlot,
    'Aucun créneau actuel'
  )
  const proposalMoveTargetSlotLabel = getMoveSlotLabel(
    proposalMoveSimulation?.targetSlot,
    compactText(proposalMoveReview?.slot?.label) || 'Créneau proposé'
  )
  const proposalMoveConflictLabels = Array.isArray(proposalMoveSimulation?.conflicts)
    ? proposalMoveSimulation.conflicts.map(getMoveConflictLabel)
    : []
  const proposalMoveCanApply = proposalMoveReview?.status === 'ready' &&
    proposalMoveSimulation?.canMove === true
  const proposalMoveConfirmLabel = proposalMoveApplying
    ? `Déplacement de ${proposalMoveReference} en cours.`
    : `Confirmer déplacement sans conflit détecté pour ${proposalMoveReference}.`
  const proposalMoveResolveLabel = `Résoudre manuellement le déplacement de ${proposalMoveReference}.`
  const proposalMoveConfirmTitle = proposalMoveApplying
    ? 'Déplacement en cours.'
    : 'Pas de conflit détecté: déplacement simplifié.'
  const proposalMoveResolveTitle = 'Conflit détecté: résolution manuelle nécessaire.'
  const resolutionProposalSlotOptions = Array.isArray(resolutionProposalDraft?.row?.decisionSlots)
    ? resolutionProposalDraft.row.decisionSlots.filter((slot) => compactText(slot?.slotId))
    : []
  const resolutionProposalSelectedSlot = resolutionProposalSlotOptions.find((slot) =>
    compactText(slot?.slotId) === compactText(resolutionProposalDraft?.slotId)
  ) || resolutionProposalSlotOptions[0] || null
  const resolutionProposalReference = compactText(resolutionProposalDraft?.tpi?.reference) || 'TPI'
  const resolutionProposalCandidate = formatPersonName(resolutionProposalDraft?.tpi?.candidat, `${CANDIDATE_ROLE_LABEL} non renseigné`)
  const resolutionProposalDevLinks = Array.isArray(resolutionProposalDraft?.sentProposal?.devLinks)
    ? resolutionProposalDraft.sentProposal.devLinks
    : []
  const resolutionProposalHasDevResult = resolutionProposalDevLinks.length > 0
  const resolutionProposalRecipientRoles = normalizeResolutionRecipientRoles(resolutionProposalDraft?.recipientRoles)

  useEffect(() => {
    const isHiddenListRequest = isAdmin && requestedTab === 'list'

    if (isHiddenListRequest || (requestedTab && tabs.some(tab => tab.id === requestedTab))) {
      if (activeTab !== requestedTab) {
        setActiveTab(requestedTab)
      }

      const params = new URLSearchParams(location.search)
      params.delete('tab')
      navigate(
        {
          pathname: location.pathname,
          search: params.toString() ? `?${params.toString()}` : ''
        },
        { replace: true }
      )

      return
    }

    if (isScopedVoteViewer && activeTab !== 'votes' && activeTab !== 'list') {
      setActiveTab('votes')
      return
    }

    const tabExists = tabs.some(tab => tab.id === activeTab)
    const isHiddenAdminList = isAdmin && activeTab === 'list'
    if (!tabExists && !isHiddenAdminList) {
      setActiveTab(tabs[0]?.id || 'votes')
    }
  }, [requestedTab, isScopedVoteViewer, activeTab, tabs, navigate, location.pathname, location.search, isAdmin])

  if (isLoading) {
    return (
      <div className="planning-dashboard loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Chargement de la coordination...</p>
        </div>
      </div>
    )
  }

  const dashboardStatsChips = [
    { key: 'total', label: 'TPI', value: stats.total },
    { key: 'draft', label: 'Brouillons', value: stats.draft },
    { key: 'voting', label: 'En vote', value: stats.voting },
    { key: 'confirmed', label: 'Confirmés', value: stats.confirmed },
    { key: 'conflicts', label: 'Conflits', value: stats.conflicts },
    { key: 'pending', label: 'Attente', value: stats.pendingVotes }
  ]

  return (
    <div className="planning-dashboard page-with-toolbar">
      <PageToolbar
        id="tools"
        className="planning-dashboard-tools"
        flatHeader
        title={`Coordination ${year}`}
        description="Workflow, votes, publication."
        meta={
          <div className="planning-dashboard-stats">
            {dashboardStatsChips.map((stat) => (
              <span
                key={stat.key}
                className={`page-tools-chip planning-stat-chip ${stat.key}`}
              >
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </span>
            ))}
          </div>
        }
        actions={
          <div className="planning-dashboard-summary">
            <span className={`page-tools-chip planning-state-chip state-${workflowState}`}>
              {workflowLabel}
            </span>
            {isAdmin && isVotingState && (
              <Link
                to={`${ROUTES.COORDINATION_VOTES.replace(':year', String(year))}?tab=votes`}
                className="page-tools-chip planning-dashboard-votes-link"
                title="Ouvrir le suivi des votes de cette année."
              >
                <VoteIcon className="inline-icon" />
                Suivre votes
              </Link>
            )}
            <span className="page-tools-chip">Année {year}</span>
            <span className="page-tools-chip">
              Snapshot {hasActiveSnapshot ? `v${activeSnapshot.version}` : '—'}
            </span>
          </div>
        }
        toggleArrow={toggleArrow}
        isArrowUp={isArrowUp}
        ariaLabel="Outils de coordination"
      />

      {hasDashboardNotices && (
        <div className="planning-dashboard-notices">
          {error && (
            <div className="error-banner">
              <span className="banner-copy">
                <AlertIcon className="banner-icon" />
                {error}
              </span>
              <button
                type="button"
                onClick={() => setError(null)}
                title="Fermer le message d'erreur."
                aria-label="Fermer le message d'erreur."
              >
                ×
              </button>
            </div>
          )}

          {successMessage && (
            <div className="success-banner">
              <span className="banner-copy">
                <CheckIcon className="banner-icon" />
                {successMessage}
              </span>
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                title="Fermer le message de succès."
                aria-label="Fermer le message de succès."
              >
                ×
              </button>
            </div>
          )}

          {hasLegacyPlanningData && (
            <div className="legacy-planning-banner">
              <div>
                <strong>Les TPI legacy existent, mais pas dans la collection de planification.</strong>
                <p>
                  {legacyTpiCount} fiche{legacyTpiCount > 1 ? 's' : ''} sont encore dans `tpiList_{year}`.
                  La page `/coordination/{year}` lit `tpiPlannings`, qui est vide pour cette année.
                </p>
              </div>
              <button
                type="button"
                className="legacy-planning-button"
                onClick={() => navigate(ROUTES.GESTION_TPI)}
                title="Ouvrir la gestion TPI."
                aria-label="Ouvrir la gestion TPI."
              >
                Gestion TPI
              </button>
            </div>
          )}

        </div>
      )}

      {isScopedVoteViewer && (
        <section className="workflow-actions workflow-actions-personal">
          <div className="workflow-actions-copy">
            <div className="workflow-state-badge state-voting_open">
              Vue vote personnelle
            </div>
            <h3>La page est focalisée sur tes votes.</h3>
            <p>
              Tu peux revenir à la vue globale.
            </p>
          </div>
          <div className="workflow-actions-inline">
            <button
              type="button"
              className="workflow-btn neutral"
              onClick={handleExitScopedVoteView}
              title="Quitter la vue de vote."
            >
              Quitter vote
            </button>
          </div>
        </section>
      )}

      {!isAdmin && !isScopedVoteViewer && (
        <section className="workflow-actions workflow-actions-restricted">
          <div className="workflow-actions-copy">
            <div className="workflow-state-badge state-restricted">
              Acces admin requis
            </div>
            <h3>Le pilotage complet du workflow est reserve a l administration.</h3>
            <p>
              Cette vue publique reste limitee aux actions de vote et a la consultation ciblee.
            </p>
          </div>
        </section>
      )}

      <section className="planning-command-shell">
        <div className="planning-command-head">
          <div className="planning-command-copy">
            <span className="planning-command-kicker">{activeTabPresentation.kicker}</span>
            <h2>{activeTabPresentation.title}</h2>
            <p>{activeTabPresentation.description}</p>
          </div>
          <div className="planning-command-summary">
            <span className="planning-command-chip is-summary">
              {planningCommandSummaryText}
            </span>
            {statusFilter !== 'all' ? (
              <span className="planning-command-chip">
              {statusFilterLabel}
              </span>
            ) : null}
            {dateFilter ? (
              <span className="planning-command-chip is-emphasis">
                Date: {dateFilterLabel}
              </span>
            ) : null}
            {searchQuery ? (
              <span className="planning-command-chip is-emphasis">
                Recherche: {searchQuery}
              </span>
            ) : null}
          </div>
        </div>

          <nav className="dashboard-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
              aria-label={tab.label}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="tab-badge">{tab.count}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="filters-bar">
          <div className="search-input">
            <span className="search-icon">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Rechercher par référence, candidat, sujet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="clear-search"
                onClick={() => setSearchQuery('')}
                title="Effacer la recherche"
                aria-label="Effacer la recherche"
              >
                ×
              </button>
            )}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter"
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous les statuts</option>
            <option value={COORDINATION_STATUS.DRAFT}>Brouillons</option>
            <option value={COORDINATION_STATUS.VOTING}>En vote</option>
            <option value={COORDINATION_STATUS.CONFIRMED}>Confirmés</option>
            <option value={COORDINATION_STATUS.MANUAL_REQUIRED}>Intervention requise</option>
          </select>

          <label className={`date-filter-shell ${dateFilter ? 'is-active' : ''}`.trim()}>
            <CalendarIcon className="date-filter-icon" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="date-filter"
              aria-label="Filtrer par date de défense"
              disabled={planningDateOptions.length === 0}
            >
              <option value="">Toutes les dates</option>
              {planningDateOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {isAdmin && (
            <button
              className="btn-refresh"
              onClick={loadData}
              title="Actualiser les données de coordination."
              aria-label="Actualiser les données de coordination."
            >
              <RefreshIcon className="button-icon" />
              Actualiser
            </button>
          )}

          {isAdmin && activeTab !== 'list' ? (
            <button
              type="button"
              className="btn-refresh secondary"
              onClick={() => setActiveTab('list')}
              title="Ouvrir la liste complète des TPI."
              aria-label="Ouvrir la liste complète des TPI."
            >
              <ListIcon className="button-icon" />
              Liste complète
            </button>
          ) : null}

          {isAdmin && activeTab === 'list' ? (
            <button
              type="button"
              className="btn-refresh secondary"
              onClick={() => setActiveTab('votes')}
              title="Revenir au suivi des votes."
              aria-label="Revenir au suivi des votes."
            >
              <VoteIcon className="button-icon" />
              Retour votes
            </button>
          ) : null}
        </div>

        {requestedFocus && (
          <section className={`planning-focus-banner ${hasFocusWithoutMatch ? 'is-missing' : 'is-ready'}`}>
            <div className="planning-focus-banner-copy">
              <strong>Focus actif: {requestedFocus}</strong>
              <p>
                {hasFocusWithoutMatch
                  ? `Aucun TPI visible ne correspond à ${requestedFocus} pour l'année ${year}.`
                  : `Vue centrée sur ${focusedTpiMatch?.reference || requestedFocus}.`}
              </p>
            </div>

            <div className="planning-focus-banner-actions">
              {focusedTpiMatch && compactText(selectedTpi?._id) !== compactText(focusedTpiMatch?._id) ? (
                <button
                  type="button"
                  className="planning-focus-banner-btn"
                  onClick={() => setSelectedTpi(focusedTpiMatch)}
                  title={`Voir ${focusedTpiMatch.reference || focusedTpiMatch.refTpi || 'cette fiche'}.`}
                  aria-label={`Voir ${focusedTpiMatch.reference || focusedTpiMatch.refTpi || 'cette fiche'}.`}
                >
                  Voir TPI
                </button>
              ) : null}
              <button
                type="button"
                className="planning-focus-banner-btn secondary"
                onClick={clearFocusedSearch}
                title="Annuler le focus sur la recherche."
                aria-label="Annuler le focus sur la recherche."
              >
                Effacer
              </button>
            </div>
          </section>
        )}
      </section>

      {/* Contenu principal - Dashboard suivi de votes */}
      <main className="dashboard-content planning-main-content">
        {activeTab === 'list' && (
          <>
            {validationResult && (
              <section className={`validation-feedback-panel ${
                validationHasBlockingIssues
                  ? 'has-issues'
                  : validationHasWarnings
                    ? 'has-warnings'
                    : 'is-valid'
              }`}>
                <div className="validation-feedback-main">
                  <div>
                    <strong>
                      {validationHasBlockingIssues
                        ? 'Dernière vérification: des corrections sont nécessaires.'
                        : validationHasWarnings
                          ? 'Dernière vérification: contraintes indiquées.'
                        : 'Dernière vérification: aucune anomalie bloquante.'}
                    </strong>
                    <p>
                      {validationHasBlockingIssues
                        ? validationAnnotations.impactedTpiCount > 0
                          ? `${validationAnnotations.impactedTpiCount} TPI sont marqués dans la liste${validationAnnotations.checkedAtLabel ? ` depuis le ${validationAnnotations.checkedAtLabel}` : ''}.`
                          : `${validationAnnotations.orphanIssues.length} TPI doivent être corrigés dans GestionTPI${validationAnnotations.checkedAtLabel ? ` depuis le ${validationAnnotations.checkedAtLabel}` : ''}.`
                        : validationHasWarnings
                          ? `${validationWarningCount} avertissement(s) de contrainte sont indiqués sur les TPI concernés${validationAnnotations.checkedAtLabel ? ` depuis le ${validationAnnotations.checkedAtLabel}` : ''}.`
                        : `La planification est valide${validationAnnotations.checkedAtLabel ? ` au ${validationAnnotations.checkedAtLabel}` : ''}.`}
                    </p>
                  </div>
                  <div className="validation-feedback-summary">
                    <span className={`validation-feedback-badge ${validationHasBlockingIssues ? 'critical' : validationHasWarnings ? 'warning' : 'success'}`}>
                      {validationHasWarnings && !validationHasBlockingIssues
                        ? `${validationWarningCount} avertissement${validationWarningCount > 1 ? 's' : ''}`
                        : `${validationBlockingIssueCount} anomalie${validationBlockingIssueCount > 1 ? 's' : ''}`}
                    </span>
                    <span className="validation-feedback-badge">
                      {validationAnnotations.impactedTpiCount} TPI marqué{validationAnnotations.impactedTpiCount > 1 ? 's' : ''}
                    </span>
                    {validationAnnotations.orphanIssues.length > 0 && (
                      <span className="validation-feedback-badge warning">
                        {validationAnnotations.orphanIssues.length} TPI à corriger dans GestionTPI
                      </span>
                    )}
                  </div>
                </div>

                {validationAnnotations.orphanIssues.length > 0 && (
                  <div className="validation-feedback-orphans">
                    <div className="validation-feedback-orphans-head">
                      <strong>TPI absents de la liste Coordination</strong>
                    <button
                      type="button"
                      className="validation-feedback-link"
                      onClick={() => navigate(ROUTES.GESTION_TPI)}
                      title="Ouvrir la gestion TPI."
                      aria-label="Ouvrir la gestion TPI."
                    >
                      Gestion TPI
                    </button>
                  </div>
                    <div className="validation-feedback-orphan-list">
                      {validationAnnotations.orphanIssues.map((issue, index) => {
                        const issueReference = compactText(issue?.reference || issue?.legacyRef) || 'TPI sans référence'
                        const issueMessage = compactText(issue?.message)

                        return (
                          <div
                            key={`${issueReference}-${issue.type || 'issue'}-${index}`}
                            className="validation-feedback-orphan-item"
                            title={issueMessage || undefined}
                          >
                            <span className="validation-feedback-orphan-ref">{issueReference}</span>
                            <span className="validation-feedback-orphan-label">{issue.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            <TpiPlanningList
              tpis={filteredTpis}
              selectedTpi={selectedTpi}
              onSelectTpi={setSelectedTpi}
              onProposeSlots={handleProposeSlots}
              isAdmin={isAdmin}
              classTypes={planningClassTypes}
              planningCatalogSites={planningCatalogSites}
              validationIssuesByTpiId={validationAnnotations.byTpiId}
              prioritizeValidationIssues={validationAnnotations.impactedTpiCount > 0}
              showVoteRoleDetails={isScopedVoteViewer}
            />
          </>
        )}

        {isVoteWorkspaceTab && isAdmin && (
          <VoteCommandCenter
            year={year}
            workflowState={workflowState}
            isPublishedState={isPublishedState}
            hasActiveSnapshot={hasActiveSnapshot}
            canStartVotes={canStartVotes}
            canPublish={canPublish}
            hasLegacyImportGap={hasLegacyImportGap}
            hasBlockedValidation={hasBlockedValidation}
            workflowActionLoading={workflowActionLoading}
            isActionRunning={isActionRunning}
            stats={voteWorkflowStats}
            activeSections={activeVoteWorkflowSections}
            allRows={voteWorkflowAllRows}
            filteredRows={voteWorkflowRows}
            checkedConstraintByTpiId={checkedConstraintByTpiId}
            constraintCheckResult={constraintCheckResult}
            staticVotePublicationInfo={staticVotePublicationInfo}
            defenseChangeNotificationInfo={defenseChangeNotificationInfo}
            preferenceActionLoadingKey={preferenceActionLoadingKey}
            proposalMoveLoadingKey={proposalMoveLoadingKey}
            proposalMoveApplying={proposalMoveApplying}
            resolutionProposalSubmitting={resolutionProposalSubmitting}
            onAutomatePlanification={handleAutomatePlanification}
            onValidatePlanification={handleValidatePlanification}
            onFreezePlanification={handleFreezePlanification}
            onSyncPlanificationFromCoordination={handleSyncPlanificationFromCoordination}
            onStartVotesCampaign={handleStartVotesCampaign}
            onStartVotesCampaignWithoutEmails={handleStartVotesCampaignWithoutEmails}
            onRemindVotes={handleRemindVotes}
            onOpenVoteAccessPreview={handleOpenVoteAccessPreview}
            onGenerateStaticVotePublication={handleGenerateStaticVotePublication}
            onPublishStaticVotePublication={handlePublishStaticVotePublication}
            onSyncStaticVotePublication={handleSyncStaticVotePublication}
            onCloseVotes={handleCloseVotes}
            onCheckVoteConstraints={handleCheckVoteConstraints}
            onPublishDefinitive={handlePublishDefinitive}
            onSendPublicationLinks={handleSendPublicationLinks}
            onSendDefenseChangeNotifications={handleSendDefenseChangeNotifications}
            onOpenPublishedView={handleOpenPublishedView}
            onOpenManualResolver={openManualResolver}
            onSelectTpi={setSelectedTpi}
            onForceVoteSlot={handleForceVoteSlot}
            onReviewVoteProposalMove={handleReviewVoteProposalMove}
            onOpenResolutionProposal={handleOpenResolutionProposal}
            onInsertProposalPreference={handleInsertProposalPreference}
          />
        )}

        {activeTab === 'votes' && !isAdmin && (
          <VotingPanel
            pendingVotes={pendingVotes}
            onVoteSubmitted={loadData}
          />
        )}

        {activeTab === 'conflicts' && isAdmin && (
          <section className="manual-intervention-panel">
            <div className="manual-header">
              <h2>
                <WrenchIcon className="section-title-icon" />
                Créneaux à résoudre
              </h2>
              <p>
                Sélectionne le TPI, choisis le créneau retenu, puis indique la raison d'arbitrage.
              </p>
            </div>
            <ConflictResolver
              conflicts={conflicts}
              calendarData={calendarData}
              onForceSlot={handleForceSlot}
              onReload={loadData}
              focusTpiId={manualFocusTpiId}
            />
          </section>
        )}
      </main>

      {resolutionProposalDraft && (
        <>
          <button
            type="button"
            className="tpi-detail-panel-backdrop"
            aria-label="Fermer la proposition d'arbitrage"
            onClick={() => {
              if (!resolutionProposalSubmitting) {
                setResolutionProposalDraft(null)
              }
            }}
            title="Fermer la proposition."
          />

          <aside
            className="tpi-detail-panel vote-resolution-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vote-resolution-panel-title"
          >
            <div className="panel-header">
              <div className="panel-header-copy">
                <span className="panel-kicker">Arbitrage votants</span>
                <h3 id="vote-resolution-panel-title">
                  <MailIcon className="section-title-icon" />
                  Informer les parties prenantes
                </h3>
                <p className="panel-candidate">{resolutionProposalReference}</p>
                <p className="panel-subject">{resolutionProposalCandidate}</p>
              </div>

              <button
                type="button"
                className="close-panel"
                onClick={() => setResolutionProposalDraft(null)}
                disabled={resolutionProposalSubmitting}
                aria-label="Fermer la proposition d'arbitrage"
                title="Fermer"
              >
                <CloseIcon className="section-title-icon" />
              </button>
            </div>

            <div className="panel-content vote-resolution-content">
              <section className="vote-resolution-card">
                <h4>Créneau proposé</h4>
                <select
                  className="vote-resolution-select"
                  value={compactText(resolutionProposalDraft.slotId)}
                  disabled={resolutionProposalSubmitting || resolutionProposalHasDevResult}
                  onChange={(event) => {
                    const nextSlotId = event.target.value
                    const previousSlot = resolutionProposalSlotOptions.find((slot) =>
                      compactText(slot?.slotId) === compactText(resolutionProposalDraft?.slotId)
                    )
                    const nextSlot = resolutionProposalSlotOptions.find((slot) =>
                      compactText(slot?.slotId) === nextSlotId
                    )
                    setResolutionProposalDraft((current) => ({
                      ...current,
                      slotId: nextSlotId,
                      message: current.message === buildResolutionProposalDefaultMessage(current.tpi, previousSlot)
                        ? buildResolutionProposalDefaultMessage(current.tpi, nextSlot)
                        : current.message
                    }))
                  }}
                >
                  {resolutionProposalSlotOptions.map((slot) => (
                    <option key={slot.slotId} value={slot.slotId}>
                      {slot.label} · {slot.positiveCount}/3 accord · {slot.rejectedCount} refus
                    </option>
                  ))}
                </select>
                <p>{resolutionProposalSelectedSlot?.label || 'Créneau à confirmer par les parties prenantes.'}</p>
              </section>

              {IS_DEBUG ? (
                <label className="vote-resolution-dev-toggle">
                  <input
                    type="checkbox"
                    checked={resolutionProposalDraft.devMode === true}
                    disabled={resolutionProposalSubmitting || resolutionProposalHasDevResult}
                    onChange={(event) => {
                      setResolutionProposalDraft((current) => ({
                        ...current,
                        devMode: event.target.checked
                      }))
                    }}
                  />
                  <span>
                    Mode DEV
                    <small>Génère les liens sans envoyer d’email réel.</small>
                  </span>
                </label>
              ) : null}

              {resolutionProposalHasDevResult ? (
                <section className="vote-resolution-card is-dev-result">
                  <h4>Liens de test</h4>
                  <p>Aucun email n’a été envoyé. Ouvre un lien pour tester la réponse de ce rôle.</p>
                  <div className="vote-resolution-dev-links">
                    {resolutionProposalDevLinks.map((link) => (
                      <a
                        key={`${link.role}-${link.url}`}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <strong>{link.roleLabel || link.role}</strong>
                        <span>{link.name || link.email || 'Lien de test'}</span>
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="vote-resolution-card">
                <h4>Destinataires</h4>
                <div className="vote-resolution-recipient-presets">
                  <button
                    type="button"
                    className={resolutionProposalRecipientRoles.length === 1 && resolutionProposalRecipientRoles[0] === PROJECT_LEAD_ROLE
                      ? 'is-active'
                      : ''}
                    disabled={resolutionProposalSubmitting || resolutionProposalHasDevResult}
                    onClick={() => {
                      setResolutionProposalDraft((current) => ({
                        ...current,
                        recipientRoles: [PROJECT_LEAD_ROLE]
                      }))
                    }}
                  >
                    {getVoterRoleLabel(PROJECT_LEAD_ROLE)}
                  </button>
                  <button
                    type="button"
                    className={resolutionProposalRecipientRoles.length === EXPERT_RESOLUTION_RECIPIENT_ROLES.length &&
                      EXPERT_RESOLUTION_RECIPIENT_ROLES.every((role) => resolutionProposalRecipientRoles.includes(role))
                      ? 'is-active'
                      : ''}
                    disabled={resolutionProposalSubmitting || resolutionProposalHasDevResult}
                    onClick={() => {
                      setResolutionProposalDraft((current) => ({
                        ...current,
                        recipientRoles: EXPERT_RESOLUTION_RECIPIENT_ROLES
                      }))
                    }}
                  >
                    Experts
                  </button>
                  <button
                    type="button"
                    className={resolutionProposalRecipientRoles.length === RESOLUTION_RECIPIENT_ROLES.length
                      ? 'is-active'
                      : ''}
                    disabled={resolutionProposalSubmitting || resolutionProposalHasDevResult}
                    onClick={() => {
                      setResolutionProposalDraft((current) => ({
                        ...current,
                        recipientRoles: RESOLUTION_RECIPIENT_ROLES
                      }))
                    }}
                  >
                    Tous
                  </button>
                </div>
                <div className="vote-resolution-recipients" role="group" aria-label="Destinataires de la proposition">
                  {RESOLUTION_RECIPIENT_ROLES.map((role) => {
                    const checked = resolutionProposalRecipientRoles.includes(role)

                    return (
                      <label
                        key={role}
                        className={`vote-resolution-recipient-option ${checked ? 'is-selected' : ''}`.trim()}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={resolutionProposalSubmitting || resolutionProposalHasDevResult}
                          onChange={(event) => {
                            const shouldSelect = event.target.checked
                            setResolutionProposalDraft((current) => {
                              const currentRoles = normalizeResolutionRecipientRoles(current?.recipientRoles)
                              const nextRoleSet = new Set(currentRoles)

                              if (shouldSelect) {
                                nextRoleSet.add(role)
                              } else {
                                nextRoleSet.delete(role)
                              }

                              const nextRoles = RESOLUTION_RECIPIENT_ROLES.filter((candidateRole) =>
                                nextRoleSet.has(candidateRole)
                              )

                              return {
                                ...current,
                                recipientRoles: nextRoles.length > 0 ? nextRoles : currentRoles
                              }
                            })
                          }}
                        />
                        <span>{getVoterRoleLabel(role)}</span>
                      </label>
                    )
                  })}
                </div>
              </section>

              <label className="vote-resolution-message">
                Message transmis
                <textarea
                  value={resolutionProposalDraft.message}
                  disabled={resolutionProposalSubmitting || resolutionProposalHasDevResult}
                  rows={5}
                  onChange={(event) => {
                    setResolutionProposalDraft((current) => ({
                      ...current,
                      message: event.target.value
                    }))
                  }}
                />
              </label>
            </div>

            <div className="panel-actions vote-resolution-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setResolutionProposalDraft(null)}
                disabled={resolutionProposalSubmitting}
              >
                {resolutionProposalHasDevResult ? 'Fermer' : 'Annuler'}
              </button>
              {!resolutionProposalHasDevResult ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSendResolutionProposal}
                  disabled={resolutionProposalSubmitting ||
                    !compactText(resolutionProposalDraft.slotId) ||
                    resolutionProposalRecipientRoles.length === 0}
                  title={resolutionProposalDraft.devMode === true
                    ? 'Mode DEV: génère les liens sans envoyer d’email.'
                    : 'Envoie un email avec lien de confirmation ou refus.'}
                  aria-label={`Transmettre la proposition d'arbitrage pour ${resolutionProposalReference}.`}
                >
                  <SendIcon className="button-icon" />
                  {resolutionProposalSubmitting
                    ? 'Envoi...'
                    : resolutionProposalDraft.devMode === true
                      ? 'Générer liens'
                      : 'Transmettre'}
                </button>
              ) : null}
            </div>
          </aside>
        </>
      )}

      {proposalMoveReview && (
        <>
          <button
            type="button"
            className="tpi-detail-panel-backdrop"
            aria-label="Fermer le test de déplacement"
            onClick={() => {
              if (!proposalMoveApplying) {
                setProposalMoveReview(null)
              }
            }}
            title="Fermer le test."
          />

          <aside
            className="tpi-detail-panel vote-move-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vote-move-panel-title"
          >
            <div className="panel-header">
              <div className="panel-header-copy">
                <span className="panel-kicker">Proposition votant</span>
                <h3 id="vote-move-panel-title">
                  <ArrowRightIcon className="section-title-icon" />
                  Test de déplacement
                </h3>
                <p className="panel-candidate">{proposalMoveReference}</p>
                {proposalMoveVoterLabel ? (
                  <p className="panel-subject">{proposalMoveVoterLabel}</p>
                ) : null}
              </div>

              <button
                type="button"
                className="close-panel"
                onClick={() => setProposalMoveReview(null)}
                disabled={proposalMoveApplying}
                aria-label="Fermer le test de déplacement"
                title="Fermer"
              >
                <CloseIcon className="section-title-icon" />
              </button>
            </div>

            <div className="panel-content vote-move-content">
              {proposalMoveReview.status === 'loading' ? (
                <div className="vote-move-state">Test des contraintes en cours...</div>
              ) : null}

              {proposalMoveReview.status === 'error' ? (
                <div className="vote-move-state is-error">
                  {proposalMoveReview.message || 'Simulation impossible.'}
                </div>
              ) : null}

              {proposalMoveSimulation ? (
                <>
                  <section className="vote-move-card">
                    <h4>Créneaux</h4>
                    <dl className="vote-move-slots">
                      <div>
                        <dt>Actuel</dt>
                        <dd>{proposalMoveCurrentSlotLabel}</dd>
                      </div>
                      <div>
                        <dt>Proposé</dt>
                        <dd>{proposalMoveTargetSlotLabel}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className={`vote-move-card ${proposalMoveCanApply ? 'is-ready' : 'is-blocked'}`}>
                    <h4>{proposalMoveCanApply ? 'Déplacement possible' : 'Déplacement bloqué'}</h4>
                    <p>{proposalMoveSimulation.message}</p>

                    {proposalMoveConflictLabels.length > 0 ? (
                      <ul className="vote-move-conflicts">
                        {proposalMoveConflictLabels.map((label, index) => (
                          <li key={`${label}-${index}`}>{label}</li>
                        ))}
                      </ul>
                    ) : null}
                  </section>

                  {proposalMoveSimulation.swapCandidate ? (
                    <section className={`vote-move-card ${proposalMoveSimulation.swapCandidate.canSwap ? 'is-swap' : 'is-blocked'}`}>
                      <h4>{proposalMoveSimulation.swapCandidate.canSwap ? 'Inversion possible' : 'Inversion bloquée'}</h4>
                      <p>{proposalMoveSimulation.swapCandidate.message}</p>
                      {proposalMoveSimulation.swapCandidate.tpi?.reference ? (
                        <p className="vote-move-muted">
                          TPI concerné: {proposalMoveSimulation.swapCandidate.tpi.reference}
                        </p>
                      ) : null}
                    </section>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="panel-actions vote-move-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setProposalMoveReview(null)}
                disabled={proposalMoveApplying}
              >
                Annuler
              </button>
              {proposalMoveCanApply ? (
                <button
                  type="button"
                  className="btn-primary vote-move-action is-safe"
                  onClick={handleApplyVoteProposalMove}
                  disabled={proposalMoveApplying}
                  aria-label={proposalMoveConfirmLabel}
                  title={proposalMoveConfirmTitle}
                >
                  <CheckIcon className="button-icon" />
                  {proposalMoveApplying ? '...' : 'Confirmer'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary vote-move-action is-blocked"
                  onClick={() => {
                    openManualResolver(proposalMoveReview.tpi)
                    setProposalMoveReview(null)
                  }}
                  disabled={proposalMoveReview.status === 'loading'}
                  aria-label={proposalMoveResolveLabel}
                  title={proposalMoveResolveTitle}
                >
                  <WrenchIcon className="button-icon" />
                  Résoudre
                </button>
              )}
            </div>
          </aside>
        </>
      )}

      {/* Panel de détails TPI (sidebar) */}
      {selectedTpi && (
        <>
          <button
            type="button"
            className="tpi-detail-panel-backdrop"
            aria-label="Fermer les détails"
            onClick={() => setSelectedTpi(null)}
            title="Fermer le panneau de détails."
          />

          <aside
            className="tpi-detail-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="planning-detail-panel-title"
          >
            <div className="panel-header">
              <div className="panel-header-copy">
                <span className="panel-kicker">Fiche coordination</span>
                <h3 id="planning-detail-panel-title">
                  <FileTextIcon className="section-title-icon" />
                  {compactText(selectedTpi.reference) ? selectedTpi.reference : 'Détails TPI'}
                </h3>
                <p className="panel-candidate">{selectedTpiCandidateLabel}</p>
                <p className="panel-subject">{selectedTpiSubjectLabel}</p>
                <div className="panel-header-meta">
                  <span className={`panel-pill is-${selectedTpiStatusMeta.tone}`}>
                    {selectedTpiStatusMeta.label}
                  </span>
                  <span className={`panel-pill is-${selectedTpiHasSlot ? 'ready' : 'warning'}`}>
                    {selectedTpiSlotLabel}
                  </span>
                  <span className={`panel-pill is-${selectedTpiIssueCount > 0 ? 'warning' : 'ready'}`}>
                    {selectedTpiIssueCount > 0
                      ? `${selectedTpiIssueCount} point(s) à corriger`
                      : 'Aucune alerte'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="close-panel"
                onClick={() => setSelectedTpi(null)}
                aria-label="Fermer le panneau"
                title="Fermer"
              >
                <CloseIcon className="section-title-icon" />
              </button>
            </div>

            <div className="panel-content">
              <div className="planning-detail-quick">
                <section className="planning-detail-card">
                  <h4>Participants</h4>
                  <dl className="planning-detail-list">
                    <div>
                      <dt>{getVoterRoleLabel('expert1')}</dt>
                      <dd>{formatPersonName(selectedTpi.expert1, 'Non renseigné')}</dd>
                    </div>
                    <div>
                      <dt>{getVoterRoleLabel('expert2')}</dt>
                      <dd>{formatPersonName(selectedTpi.expert2, 'Non renseigné')}</dd>
                    </div>
                    <div>
                      <dt>{getVoterRoleLabel('chef_projet')}</dt>
                      <dd>{formatPersonName(selectedTpi.chefProjet, 'Non renseigné')}</dd>
                    </div>
                  </dl>
                </section>

                <section className="planning-detail-card">
                  <h4>Votes</h4>
                  <div className="planning-detail-vote-status">
                    <strong>{selectedTpiRespondedVoteCount}/{VOTE_ROLE_ORDER.length} réponses</strong>
                    <span>{selectedTpiManualAction ? 'Résolution requise' : selectedTpiStatusMeta.label}</span>
                  </div>
                  <div className="planning-detail-role-grid">
                    {selectedTpiVoteEntries.map((entry) => {
                      const tone = getVoteRoleTone(entry.status)

                      return (
                        <span key={entry.role} className={`planning-detail-role is-${tone}`}>
                          <strong>{entry.label}</strong>
                          <span>{getVoteRoleStatusLabel(entry.status)}</span>
                        </span>
                      )
                    })}
                  </div>
                </section>

                <section className="planning-detail-card">
                  <h4>Créneau</h4>
                  <p className="planning-detail-slot">{selectedTpiSlotLabel}</p>
                  {Array.isArray(selectedTpi.proposedSlots) && selectedTpi.proposedSlots.length > 1 ? (
                    <p className="planning-detail-muted">
                      {selectedTpi.proposedSlots.length - 1} alternative{selectedTpi.proposedSlots.length > 2 ? 's' : ''} disponible{selectedTpi.proposedSlots.length > 2 ? 's' : ''}.
                    </p>
                  ) : null}
                </section>

                {selectedTpiIssueCount > 0 ? (
                  <section className="planning-detail-card is-warning">
                    <h4>À corriger</h4>
                    {selectedTpiValidationMessages.length > 0 ? (
                      <ul className="planning-detail-issues">
                        {selectedTpiValidationMessages.slice(0, 3).map((message, index) => (
                          <li key={`${message}-${index}`}>{message}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="planning-detail-muted">Intervention manuelle nécessaire.</p>
                    )}
                  </section>
                ) : null}
              </div>
            </div>

            <div className="panel-actions">
              {isAdmin && selectedTpiManualAction ? (
                <button
                  className="btn-primary"
                  onClick={() => openManualResolver(selectedTpi)}
                  title="Ouvrir la résolution manuelle pour ce TPI."
                  aria-label="Résoudre le créneau de ce TPI."
                >
                  <WrenchIcon className="button-icon" />
                  Résoudre
                </button>
              ) : null}
              {isAdmin ? (
                <Link
                  className="btn-secondary"
                  to={selectedTpiDetailLink}
                >
                  Fiche complète
                </Link>
              ) : null}
              {isAdmin && selectedTpi.status === 'draft' ? (
                <button
                  className="btn-primary"
                  onClick={() => handleProposeSlots(selectedTpi._id)}
                >
                  <VoteIcon className="button-icon" />
                  Lancer
                </button>
              ) : null}
            </div>
          </aside>
        </>
      )}
    </div>
  )
}

export default PlanningDashboard
