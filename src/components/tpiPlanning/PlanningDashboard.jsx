import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { authPlanningService, planningCatalogService, planningConfigService, tpiPlanningService, slotService, voteService, workflowPlanningService } from '../../services/planningService'
import { IS_DEBUG, ROUTES } from '../../config/appConfig'
import { getTpiModels } from '../tpiControllers/TpiController.jsx'
import PlanningCalendar from './PlanningCalendar'
import TpiPlanningList from './TpiPlanningList'
import VotingPanel from './VotingPanel'
import ConflictResolver from './ConflictResolver'
import ImportPanel from './ImportPanel'
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
  PinIcon,
  RefreshIcon,
  SearchIcon,
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
  normalizePlanningStatus,
  PLANNING_STATUS
} from '../../constants/planningStatus'
import { getActivePlanningSiteLabels, getPlanningPerimeterState } from '../../utils/planningScopeUtils'
import { buildValidationToast, extractValidationResultFromError } from '../../utils/workflowFeedback'
import { YEARS_CONFIG } from '../../config/appConfig'
import './PlanningDashboard.css'

const WORKFLOW_LABELS = {
  planning: 'Planification',
  voting_open: 'Votes ouverts',
  published: 'Publie'
}

const WORKFLOW_ACTION_LABELS = {
  autoPlan: 'Automatiser planification',
  validate: 'Verifier conflits',
  freeze: 'Geler snapshot',
  startVotes: 'Ouvrir votes',
  startVotesNoEmail: 'Ouvrir votes sans emails',
  remindVotes: 'Relancer votes',
  closeVotes: 'Clore votes',
  publish: 'Publier definitif',
  sendLinks: 'Envoyer liens défense'
}

const shouldLogWorkflowDebug = IS_DEBUG && process.env.NODE_ENV !== 'test'

function logWorkflowDebug(...args) {
  if (shouldLogWorkflowDebug) {
    console.log(...args)
  }
}

const STATUS_FILTER_LABELS = {
  all: 'Tous les statuts',
  [PLANNING_STATUS.DRAFT]: 'Brouillons',
  [PLANNING_STATUS.VOTING]: 'En vote',
  [PLANNING_STATUS.CONFIRMED]: 'Confirmes',
  [PLANNING_STATUS.MANUAL_REQUIRED]: 'Intervention requise'
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
    title: 'Tous les TPI',
    adminDescription: 'Suivi global des réponses, relances et clôture.',
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
    kicker: 'Forçage',
    title: 'À forcer',
    adminDescription: 'Choisis un TPI, sélectionne un créneau, indique la raison.',
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
  legacy_tpi_not_imported: 'Absent de Planning'
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
  if (!role) {
    return ""
  }

  if (role === "expert1") {
    return "Expert 1"
  }

  if (role === "expert2") {
    return "Expert 2"
  }

  if (role === "chef_projet") {
    return "Chef de projet"
  }

  return compactText(role)
}

const VOTE_ROLE_ORDER = ['expert1', 'expert2', 'chef_projet']

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

function formatVoteDeadline(value) {
  const label = formatVoteDate(value)
  return label ? `Echeance ${label}` : ''
}

function formatVoteSlotLabel(slot) {
  if (!slot) {
    return 'Aucun creneau fixe'
  }

  const dateLabel = formatVoteDate(slot.date)
  const timeLabel = [slot.startTime, slot.endTime].filter(Boolean).join('-')
  const roomLabel = compactText(slot.room?.name || slot.room)

  return [dateLabel, timeLabel, roomLabel].filter(Boolean).join(' · ') || 'Creneau a verifier'
}

function getVoteDecisionSlots(tpi) {
  const slots = Array.isArray(tpi?.voteDecision?.slots)
    ? tpi.voteDecision.slots
    : []

  return slots
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
        specialRequestReason: '',
        specialRequestDate: null,
        hasAvailabilityException: false
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
        compactText(decision.specialRequestReason) ||
        decision.specialRequestDate
      ) {
        summary.hasAvailabilityException = true
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

function getMoveSlotLabel(slot, fallback = 'Non défini') {
  return compactText(slot?.label) || formatVoteSlotLabel(slot) || fallback
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

function getAdminSlotActionLabel(slot) {
  if (slot?.positiveCount >= 3) {
    return 'Valider'
  }

  if (slot?.positiveCount === 2) {
    return 'Imposer 2/3'
  }

  return 'Forcer'
}

function buildAdminSlotForceReason(reference, slot) {
  const slotLabel = compactText(slot?.label) || 'créneau sélectionné'
  const voteRatio = `${Number(slot?.positiveCount || 0)}/3`

  if (Number(slot?.positiveCount || 0) >= 3) {
    return `Validation admin depuis le suivi des votes: consensus 3/3 sur ${slotLabel}.`
  }

  return `Forçage admin depuis le suivi des votes ${reference}: ${voteRatio} avis favorable(s) sur ${slotLabel}.`
}

function buildVoteWorkflowRow(tpi) {
  const roleEntries = getVoteRoleEntries(tpi)
  const decisionSlots = getVoteDecisionSlots(tpi)
  const respondedRoles = roleEntries.filter((entry) => hasVoteRoleResponded(entry.status))
  const missingRoles = roleEntries.filter((entry) => !hasVoteRoleResponded(entry.status))
  const normalizedStatus = normalizePlanningStatus(tpi?.status)
  const hasManualStatus = MANUAL_REQUIRED_STATUSES.includes(normalizedStatus)
  const hasProposal = roleEntries.some((entry) => getVoteRoleTone(entry.status) === 'proposal')
  const hasSpecialRequest = roleEntries.some((entry) =>
    Boolean(entry.status?.availabilityException) ||
    Boolean(compactText(entry.status?.specialRequestReason)) ||
    Boolean(entry.status?.specialRequestDate)
  )

  let bucket = 'other'
  if (hasManualStatus) {
    bucket = 'manual'
  } else if (normalizedStatus === PLANNING_STATUS.CONFIRMED) {
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
    candidate: formatPersonName(tpi?.candidat, 'Candidat non renseigne'),
    status: normalizedStatus,
    roleEntries,
    respondedCount: respondedRoles.length,
    missingCount: missingRoles.length,
    missingLabels: missingRoles.map((entry) => entry.label),
    fixedSlotLabel: formatVoteSlotLabel(getVoteFixedSlot(tpi)),
    decisionSlots,
    proposalSummaries: getVoteProposalSummaries(tpi),
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
  const [magicLinkViewer, setMagicLinkViewer] = useState(null)
  const [isMagicLinkReady, setIsMagicLinkReady] = useState(false)
  const [planningClassTypes, setPlanningClassTypes] = useState([])
  const [planningCatalogSites, setPlanningCatalogSites] = useState([])
  const [planningSiteConfigs, setPlanningSiteConfigs] = useState([])
  const [validationResult, setValidationResult] = useState(null)
  
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
  const [preferenceActionLoadingKey, setPreferenceActionLoadingKey] = useState('')

  // Filtres
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  /**
   * Charge toutes les données de planification
   */
  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setValidationResult(null)
    
    try {
      const snapshotRequest = isAdmin
        ? Promise.resolve(workflowPlanningService.getActiveSnapshot(year))
          .catch(err => {
            if (err?.status === 404) {
              return null
            }
            throw err
          })
        : Promise.resolve(null)

      const workflowRequest = isAdmin
        ? workflowPlanningService.getYearState(year)
        : Promise.resolve(null)

      const planningConfigRequest = Promise.resolve(planningConfigService.getByYear(year)).catch(err => {
        if (err?.status === 404) {
          return null
        }
        throw err
      })

      const planningCatalogRequest = Promise.resolve(planningCatalogService.getGlobal()).catch(err => {
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

      const [planningConfigResponse, planningCatalogResponse, tpisResponse, calendarResponse, votesResponse, workflowResponse, snapshotResponse, legacyTpisResponse] = await Promise.all([
        planningConfigRequest,
        planningCatalogRequest,
        tpiPlanningService.getByYear(year),
        slotService.getCalendar(year),
        votesRequest,
        workflowRequest,
        snapshotRequest,
        legacyTpisRequest
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
      
      // Identifier les conflits
      const tpisWithConflicts = safeTpisResponse.filter(tpi =>
        MANUAL_REQUIRED_STATUSES.includes(normalizePlanningStatus(tpi.status)) || 
        tpi.votingSession?.hasConflicts
      )
      setConflicts(tpisWithConflicts)
      
    } catch (err) {
      setError(getApiErrorMessage(err, 'Erreur lors du chargement des données de planification'))
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [year, isAdmin])

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
        const resolved = await workflowPlanningService.resolveMagicLink(magicLinkToken)

        if (resolved?.type !== 'vote') {
          if (!isCancelled) {
            setError('Ce lien n est pas un lien de vote.')
            setIsMagicLinkReady(true)
          }
          return
        }

        if (resolved?.sessionToken) {
          authPlanningService.setSessionToken(resolved.sessionToken)
        }

        if (resolved?.viewer) {
          const viewer = {
            ...resolved.viewer,
            role: resolved.role || null
          }

          authPlanningService.setCurrentUser(viewer)

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

  const filteredTpis = useMemo(() => {
    return visibleTpis.filter(tpi => {
      const normalizedStatus = normalizePlanningStatus(tpi.status)

      // Filtre par statut
      if (statusFilter !== 'all' && normalizedStatus !== statusFilter) {
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
  }, [visibleTpis, statusFilter, searchQuery])

  /**
   * Statistiques globales
   */
  const stats = useMemo(() => {
    return {
      total: visibleTpis.length,
      draft: visibleTpis.filter(t => normalizePlanningStatus(t.status) === PLANNING_STATUS.DRAFT).length,
      voting: visibleTpis.filter(t => normalizePlanningStatus(t.status) === PLANNING_STATUS.VOTING).length,
      confirmed: visibleTpis.filter(t => normalizePlanningStatus(t.status) === PLANNING_STATUS.CONFIRMED).length,
      conflicts: conflicts.length,
      pendingVotes: isAdmin
        ? visibleTpis.filter(t => normalizePlanningStatus(t.status) !== PLANNING_STATUS.DRAFT).length
        : pendingVotes.length
    }
  }, [visibleTpis, conflicts, pendingVotes, isAdmin])

  const manualRequiredCount = useMemo(() => {
    return visibleTpis.filter(t => MANUAL_REQUIRED_STATUSES.includes(normalizePlanningStatus(t.status))).length
  }, [visibleTpis])

  const hasManualRequired = useMemo(() => {
    return manualRequiredCount > 0
  }, [manualRequiredCount])

  const voteTrackingTpis = useMemo(() => {
    if (!isAdmin) {
      return []
    }

    return visibleTpis.filter((tpi) => {
      const normalizedStatus = normalizePlanningStatus(tpi.status)
      return normalizedStatus !== PLANNING_STATUS.DRAFT
    })
  }, [visibleTpis, isAdmin])

  const filteredVoteTrackingTpis = useMemo(() => {
    if (!isAdmin) {
      return []
    }

    return filteredTpis.filter((tpi) => {
      const normalizedStatus = normalizePlanningStatus(tpi.status)
      return normalizedStatus !== PLANNING_STATUS.DRAFT
    })
  }, [filteredTpis, isAdmin])

  const voteWorkflowRows = useMemo(() => {
    return filteredVoteTrackingTpis.map((tpi) => buildVoteWorkflowRow(tpi))
  }, [filteredVoteTrackingTpis])

  const voteWorkflowAllRows = useMemo(() => {
    return voteTrackingTpis.map((tpi) => buildVoteWorkflowRow(tpi))
  }, [voteTrackingTpis])

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
      pendingTpis: voteWorkflowAllRows.filter((row) => row.bucket === 'pending').length,
      readyTpis: voteWorkflowAllRows.filter((row) => row.bucket === 'ready').length,
      manualTpis: voteWorkflowAllRows.filter((row) => row.bucket === 'manual').length,
      confirmedTpis: voteWorkflowAllRows.filter((row) => row.bucket === 'confirmed').length,
      proposalTpis: voteWorkflowAllRows.filter((row) => row.hasProposal || row.hasSpecialRequest).length
    }
  }, [voteWorkflowAllRows])

  const voteWorkflowSections = useMemo(() => ([
    {
      id: 'pending',
      title: 'À relancer',
      helper: 'Votes encore manquants. Ce sont les personnes à cibler avant la clôture.',
      rows: voteWorkflowRows.filter((row) => row.bucket === 'pending')
    },
    {
      id: 'ready',
      title: 'Prêts pour clôture',
      helper: 'Les trois rôles ont répondu. La clôture décidera automatiquement ou basculera en manuel.',
      rows: voteWorkflowRows.filter((row) => row.bucket === 'ready')
    },
    {
      id: 'manual',
      title: 'À forcer',
      helper: 'Ces TPI demandent un choix manuel de créneau avant publication.',
      rows: voteWorkflowRows.filter((row) => row.bucket === 'manual')
    },
    {
      id: 'confirmed',
      title: 'Confirmés',
      helper: 'Les défenses ont un créneau confirmé.',
      rows: voteWorkflowRows.filter((row) => row.bucket === 'confirmed')
    }
  ]), [voteWorkflowRows])

  const activeVoteWorkflowSections = useMemo(() => {
    if (activeTab === 'vote-pending') {
      return voteWorkflowSections.filter((section) => section.id === 'pending')
    }

    if (activeTab === 'vote-ready') {
      return voteWorkflowSections.filter((section) => section.id === 'ready')
    }

    return voteWorkflowSections
  }, [activeTab, voteWorkflowSections])

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

  const activePlanningSiteLabels = useMemo(() => {
    return getActivePlanningSiteLabels(planningSiteConfigs)
  }, [planningSiteConfigs])

  const notImportedLegacyTpisByPlanningPerimeter = notImportedLegacyTpis

  const legacyTpiCount = legacyTpis.length
  const hasLegacyPlanningData = isAdmin && stats.total === 0 && legacyTpiCount > 0
  const hasLegacyImportGap = notImportedLegacyTpisByPlanningPerimeter.length > 0
  const validationAnnotations = useMemo(() => {
    const issues = Array.isArray(validationResult?.issues) ? validationResult.issues : []

    if (issues.length === 0) {
      return {
        byTpiId: {},
        impactedTpiCount: 0,
        orphanIssues: [],
        totalIssues: 0,
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
      checkedAtLabel: formatValidationCheckedAt(validationResult?.checkedAt)
    }
  }, [tpis, validationResult])

  const workflowState = workflow?.state || 'planning'
  const workflowLabel = WORKFLOW_LABELS[workflowState] || workflowState
  const hasActiveSnapshot = Boolean(activeSnapshot?.version)
  const isPlanningState = workflowState === 'planning'
  const isVotingState = workflowState === 'voting_open'
  const isPublishedState = workflowState === 'published'
  const isScopedVoteViewer = Boolean(!isAdmin && magicLinkViewer?.personId)
  const hasSuccessfulValidation =
    !validationResult ||
    Number(validationResult?.year) !== Number(year) ||
    validationResult?.summary?.isValid === true
  const hasBlockedValidation = Boolean(validationResult) &&
    Number(validationResult?.year) === Number(year) &&
    validationResult?.summary?.isValid === false
  const canStartVotes = isPlanningState && hasActiveSnapshot && hasSuccessfulValidation
  const canPublishDirect = isPlanningState && canStartVotes && !hasLegacyImportGap
  const canPublish = canPublishDirect || isVotingState || isPublishedState

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
      'Candidat non renseigné'
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
    return MANUAL_REQUIRED_STATUSES.includes(normalizePlanningStatus(selectedTpi?.status))
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

  const clearFocusedSearch = useCallback(() => {
    const params = new URLSearchParams(location.search)
    params.delete('focus')
    params.delete('tab')

    setAppliedFocus('')
    setSearchQuery('')
    setSelectedTpi(null)
    setStatusFilter('all')

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
      const result = await tpiPlanningService.proposeSlots(tpiId)
      
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
      const result = await tpiPlanningService.forceSlot(tpiId, slotId, reason)
      
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

    if (!tpiId || !slotId) {
      setError('Impossible d’identifier le TPI ou le créneau à forcer.')
      return
    }

    const actionLabel = slot?.positiveCount >= 3
      ? 'valider ce créneau'
      : 'forcer ce créneau'
    const confirmation = window.confirm(
      `Confirmer: ${actionLabel} pour ${reference} ?`
    )

    if (!confirmation) {
      return
    }

    try {
      const result = await tpiPlanningService.forceSlot(
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
      const simulation = await tpiPlanningService.simulateMoveToSlot(tpiId, slotId)
      setProposalMoveReview({
        ...review,
        status: 'ready',
        simulation
      })
    } catch (err) {
      const message = getApiErrorMessage(err, `Impossible de simuler le déplacement de ${reference}.`)
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
      setError('Impossible d’identifier le TPI ou le créneau à déplacer.')
      return
    }

    if (!proposalMoveReview?.simulation?.canMove) {
      setError('Le déplacement est bloqué par un conflit. Ouvre le forçage pour le traiter.')
      return
    }

    const confirmed = window.confirm(
      `Déplacer et confirmer ${reference} vers ${targetSlotLabel} ?`
    )

    if (!confirmed) {
      return
    }

    setProposalMoveApplying(true)
    setError(null)

    try {
      const result = await tpiPlanningService.moveToSlot(
        tpiId,
        slotId,
        buildVoteProposalMoveReason(proposalMoveReview.tpi, proposalMoveReview.summary, proposalMoveReview.slot)
      )

      if (result?.success) {
        const message = `${reference}: déplacé et confirmé.`
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

  const handleInsertProposalPreference = useCallback(async (summary, slot) => {
    const voteId = compactText(slot?.voteId)
    const slotId = compactText(slot?.slotId)
    const actionKey = `${voteId || summary?.role || 'vote'}:${slotId || 'slot'}`

    if (!voteId) {
      setError('Impossible d’identifier le vote à ajouter aux dates idéales.')
      return
    }

    setPreferenceActionLoadingKey(actionKey)
    setError(null)

    try {
      const result = await voteService.addProposalToPreferences(voteId)
      const voterName = compactText(result?.voter?.name) || compactText(summary?.voterName) || summary?.roleLabel || 'Votant'
      const message = result?.added
        ? `${voterName}: proposition ajoutée aux dates idéales.`
        : `${voterName}: proposition déjà présente dans les dates idéales.`

      toast.success(message)
      setSuccessMessage(message)
      await loadData()
    } catch (err) {
      const message = getApiErrorMessage(err, 'Impossible d’ajouter cette proposition aux dates idéales.')
      setError(message)
      console.error(err)
    } finally {
      setPreferenceActionLoadingKey('')
    }
  }, [loadData])

  /**
   * Gère le drag & drop d'un TPI sur un créneau
   */
  const handleDragDrop = useCallback(async (tpiId, slotId) => {
    // Le drag & drop est géré dans PlanningCalendar
    // Cette fonction est appelée après confirmation
    await loadData()
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
      run: () => workflowPlanningService.validatePlanification(year),
      successBuilder: null,
      errorFallback: 'Erreur lors de la validation de la planification.',
      onSuccess: (validationResult) => {
        setValidationResult(validationResult)
        if (Number(validationResult?.summary?.issueCount || 0) > 0) {
          setStatusFilter('all')
          setSearchQuery('')
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

  const handleAutomatePlanification = useCallback(async () => {
    await executeWorkflowAction({
      actionKey: 'autoPlan',
      confirmMessage: `Reconstruire automatiquement la planification ${year} ? Les créneaux proposés actuels seront recalculés à partir de la configuration.`,
      run: () => workflowPlanningService.automatePlanification(year),
      successBuilder: (result) => {
        const summary = result?.summary || {}
        const syncSummary = result?.sync || {}
        const validationSummary = result?.validation?.summary || {}
        const totalTpis = Number(summary.totalTpis || 0)
        const plannedCount = Number(summary.plannedCount || 0)
        const manualRequiredCount = Number(summary.manualRequiredCount || 0)
        const issueCount = Number(validationSummary.issueCount || 0)
        const syncCreatedCount = Number(syncSummary.createdCount || 0)
        const suffix = issueCount > 0
          ? ` ${issueCount} anomalie(s) restent à corriger.`
          : ' Planning prêt pour vérification.'
        const syncPrefix = syncCreatedCount > 0
          ? `${syncCreatedCount} TPI intégré(s) depuis GestionTPI dans le workflow. `
          : ''

        return `${syncPrefix}Planification automatique: ${plannedCount}/${totalTpis} TPI placés, ${manualRequiredCount} en manuel, ${Number(summary.slotCount || 0)} créneau(x) généré(s).${suffix}`
      },
      errorFallback: 'Erreur lors de la planification automatique.',
      reloadAfterSuccess: true,
      onSuccess: (result) => {
        if (result?.validation) {
          setValidationResult(result.validation)
        }

        if (Number(result?.summary?.manualRequiredCount || 0) > 0 || Number(result?.validation?.summary?.issueCount || 0) > 0) {
          setStatusFilter('all')
          setSearchQuery('')
          setActiveTab('list')
        }
      }
    })
  }, [year, executeWorkflowAction])

  const handleFreezePlanification = useCallback(async () => {
    const result = await executeWorkflowAction({
      actionKey: 'freeze',
      confirmMessage: `Confirmer le gel du snapshot de planification ${year} ?`,
      run: () => workflowPlanningService.freezePlanification(year),
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

  const handleStartVotesCampaign = useCallback(async () => {
    const result = await executeWorkflowAction({
      actionKey: 'startVotes',
      confirmMessage: 'Confirmer l ouverture de la campagne de votes ?',
      run: () => workflowPlanningService.startVotes(year),
      successBuilder: (result) => {
        const tpiCount = result?.tpiCount || 0
        const successfulEmails = result?.successfulEmails || 0
        const totalEmails = result?.totalEmails || 0
        const emailSuffix = successfulEmails < totalEmails
          ? ` Attention: ${totalEmails - successfulEmails} envoi(s) ont échoué.`
          : ''

        return `Campagne ouverte: ${tpiCount} TPI synchronises, ${successfulEmails}/${totalEmails} emails envoyes.${emailSuffix}`
      },
      errorFallback: 'Erreur lors du lancement de la campagne de votes.',
      onError: (_errorMessage, error) => {
        const validationFromError = extractValidationResultFromError(year, error)
        if (validationFromError) {
          setValidationResult(validationFromError)
          setStatusFilter('all')
          setSearchQuery('')
          setActiveTab('list')
        }
      },
      reloadAfterSuccess: true
    })

    if (result?.workflowState) {
      setWorkflow(prev => ({
        ...(prev || {}),
        state: result.workflowState
      }))
    }
  }, [year, executeWorkflowAction])

  const handleStartVotesCampaignWithoutEmails = useCallback(async () => {
    const result = await executeWorkflowAction({
      actionKey: 'startVotesNoEmail',
      confirmMessage: 'Confirmer l ouverture de la campagne de votes sans envoyer d emails ?',
      run: () => workflowPlanningService.startVotesWithoutEmails(year),
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
          setActiveTab('list')
        }
      },
      reloadAfterSuccess: true
    })

    if (result?.workflowState) {
      setWorkflow(prev => ({
        ...(prev || {}),
        state: result.workflowState
      }))
    }
  }, [year, executeWorkflowAction])

  const handleRemindVotes = useCallback(async () => {
    await executeWorkflowAction({
      actionKey: 'remindVotes',
      run: () => workflowPlanningService.remindVotes(year),
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
      run: () => workflowPlanningService.closeVotes(year),
      successBuilder: (result) =>
        `Cloture terminee: ${result?.confirmedCount || 0} confirmes, ${result?.manualRequiredCount || 0} en manuel.`,
      errorFallback: 'Erreur lors de la cloture des votes.',
      reloadAfterSuccess: true
    })
  }, [year, executeWorkflowAction])

  const handlePublishDefinitive = useCallback(async () => {
    await executeWorkflowAction({
      actionKey: 'publish',
      confirmMessage: 'Confirmer la publication definitive des défenses ?',
      run: () => workflowPlanningService.publishDefinitive(year),
      successBuilder: (result) => {
        const sent = result?.sentLinks
        const sentLabel = sent
          ? ` Liens défense: ${sent.emailsSucceeded || 0}/${sent.emailsSent || 0}.`
          : ''
        return (result?.message || 'Publication definitive terminee.') + sentLabel
      },
      errorFallback: 'Erreur lors de la publication definitive.',
      reloadAfterSuccess: true
    })
  }, [year, executeWorkflowAction])

  const handleSendPublicationLinks = useCallback(async () => {
    await executeWorkflowAction({
      actionKey: 'sendLinks',
      run: () => workflowPlanningService.sendPublicationLinks(year),
      successBuilder: (result) => {
        const sent = result?.sentLinks
        return `Liens défense envoyes: ${sent?.emailsSucceeded || 0}/${sent?.emailsSent || 0}.`
      },
      errorFallback: 'Erreur lors de l envoi des liens défense.'
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

    authPlanningService.clearSession()
    navigate(`${ROUTES.PLANNING}/${targetYear}`)
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
      { id: 'votes', label: 'Tous les TPI', icon: <VoteIcon className='page-tools-tab-icon-svg' />, count: voteTrackingTpis.length },
      { id: 'vote-pending', label: 'À relancer', icon: <MailIcon className='page-tools-tab-icon-svg' />, count: voteWorkflowStats.pendingTpis },
      { id: 'vote-ready', label: 'Prêts à clore', icon: <CheckIcon className='page-tools-tab-icon-svg' />, count: voteWorkflowStats.readyTpis },
      { id: 'conflicts', label: 'À forcer', icon: <WrenchIcon className='page-tools-tab-icon-svg' />, count: voteWorkflowStats.manualTpis || stats.conflicts }
    ]
  }, [
    isScopedVoteViewer,
    stats.pendingVotes,
    stats.total,
    stats.conflicts,
    voteTrackingTpis.length,
    voteWorkflowStats.pendingTpis,
    voteWorkflowStats.readyTpis,
    voteWorkflowStats.manualTpis
  ])

  const workflowSteps = useMemo(() => {
    if (!isAdmin) {
      return []
    }

    return [
      {
        id: 'step-planification',
        label: '1. Planification gelée',
        done: hasActiveSnapshot || isVotingState || isPublishedState
      },
      {
        id: 'step-votes',
        label: '2. Votes',
        done: isPublishedState,
        active: isVotingState,
        warning: isVotingState && hasManualRequired
          ? `${manualRequiredCount} TPI à forcer`
          : ''
      },
      {
        id: 'step-publication',
        label: '3. Publication',
        done: isPublishedState
      }
    ]
  }, [
    isAdmin,
    hasActiveSnapshot,
    isVotingState,
    isPublishedState,
    hasManualRequired,
    manualRequiredCount
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
  const activeSitesSummary = activePlanningSiteLabels.length > 0
    ? activePlanningSiteLabels.join(', ')
    : `Aucun site actif pour ${year}`
  const statusFilterLabel = STATUS_FILTER_LABELS[statusFilter] || STATUS_FILTER_LABELS.all
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

  /**
   * Callback après import réussi
   */
  const handleImportComplete = useCallback((type, results) => {
    logWorkflowDebug(`Import ${type} terminé:`, results)
    // Recharger les données après import
    loadData()
    // Passer à l'onglet approprié
    if (type === 'csv') {
      setActiveTab('list')
    }
  }, [loadData])

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
          <p>Chargement de la planification...</p>
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
        title={`Planning ${year}`}
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
                to={`${ROUTES.PLANIFICATION_VOTES.replace(':year', String(year))}?tab=votes`}
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
        ariaLabel="Outils de planification"
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
                  La page `/planning/{year}` lit `tpiPlannings`, qui est vide pour cette année.
                </p>
              </div>
              <button
                type="button"
                className="legacy-planning-button"
                onClick={() => navigate(ROUTES.GESTION_TPI)}
                title="Ouvrir la gestion TPI."
                aria-label="Ouvrir la gestion TPI."
              >
                Ouvrir Gestion TPI
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
              title="Quitter le mode vote et revenir à la vue globale."
            >
              Quitter le mode vote
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
          >
            <option value="all">Tous les statuts</option>
            <option value={PLANNING_STATUS.DRAFT}>Brouillons</option>
            <option value={PLANNING_STATUS.VOTING}>En vote</option>
            <option value={PLANNING_STATUS.CONFIRMED}>Confirmés</option>
            <option value={PLANNING_STATUS.MANUAL_REQUIRED}>Intervention requise</option>
          </select>

          {isAdmin && (
            <button
              className="btn-refresh"
              onClick={loadData}
              title="Actualiser les données du planning."
              aria-label="Actualiser les données du planning."
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
                  title={`Ouvrir la fiche ${focusedTpiMatch.reference || focusedTpiMatch.refTpi || 'ciblée'}.`}
                  aria-label={`Ouvrir la fiche ${focusedTpiMatch.reference || focusedTpiMatch.refTpi || 'ciblée'}.`}
                >
                  Ouvrir le TPI ciblé
                </button>
              ) : null}
              <button
                type="button"
                className="planning-focus-banner-btn secondary"
                onClick={clearFocusedSearch}
                title="Annuler le focus sur la recherche."
                aria-label="Annuler le focus sur la recherche."
              >
                Effacer le focus
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
              <section className={`validation-feedback-panel ${validationAnnotations.totalIssues > 0 ? 'has-issues' : 'is-valid'}`}>
                <div className="validation-feedback-main">
                  <div>
                    <strong>
                      {validationAnnotations.totalIssues > 0
                        ? 'Dernière vérification: des corrections sont nécessaires.'
                        : 'Dernière vérification: aucune anomalie bloquante.'}
                    </strong>
                    <p>
                      {validationAnnotations.totalIssues > 0
                        ? validationAnnotations.impactedTpiCount > 0
                          ? `${validationAnnotations.impactedTpiCount} TPI sont marqués dans la liste${validationAnnotations.checkedAtLabel ? ` depuis le ${validationAnnotations.checkedAtLabel}` : ''}.`
                          : `${validationAnnotations.orphanIssues.length} TPI doivent être corrigés dans GestionTPI${validationAnnotations.checkedAtLabel ? ` depuis le ${validationAnnotations.checkedAtLabel}` : ''}.`
                        : `Le planning est valide${validationAnnotations.checkedAtLabel ? ` au ${validationAnnotations.checkedAtLabel}` : ''}.`}
                    </p>
                  </div>
                  <div className="validation-feedback-summary">
                    <span className={`validation-feedback-badge ${validationAnnotations.totalIssues > 0 ? 'critical' : 'success'}`}>
                      {validationAnnotations.totalIssues} anomalie{validationAnnotations.totalIssues > 1 ? 's' : ''}
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
                      <strong>TPI absents de la liste Planning</strong>
                    <button
                      type="button"
                      className="validation-feedback-link"
                      onClick={() => navigate(ROUTES.GESTION_TPI)}
                      title="Ouvrir la gestion TPI."
                      aria-label="Ouvrir la gestion TPI."
                    >
                      Ouvrir Gestion TPI
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
          <section className="vote-workflow-panel">
            <div className="vote-workflow-header">
              <div className="vote-workflow-title-block">
                <span className="vote-workflow-kicker">Planification-votes</span>
                <h2>
                  <VoteIcon className="section-title-icon" />
                  Campagne de votes {year}
                </h2>
                <p>
                  Ouvrir, relancer, clore, traiter.
                </p>
              </div>

              <div className={`vote-workflow-next state-${workflowState}`}>
                <span>Prochaine action</span>
                <strong>
                  {isPlanningState
                    ? hasActiveSnapshot
                      ? 'Ouvrir la campagne'
                      : 'Geler un snapshot'
                    : isVotingState
                      ? voteWorkflowStats.missingVotes > 0
                        ? 'Relancer les votes'
                        : 'Clore la campagne'
                      : isPublishedState
                        ? 'Agenda publie'
                        : 'Verifier le workflow'}
                </strong>
                <p>
                  {isPlanningState
                    ? hasActiveSnapshot
                      ? `${voteWorkflowStats.totalTpis} TPI sont prets a recevoir un lien de vote.`
                      : 'La campagne ne peut pas demarrer sans snapshot de planification gele.'
                    : isVotingState
                      ? `${voteWorkflowStats.receivedVotes}/${voteWorkflowStats.expectedVotes} votes recus.`
                      : isPublishedState
                        ? 'Les votes ne sont plus modifiables depuis cette vue.'
                        : 'Etat annuel inattendu pour la campagne.'}
                </p>
              </div>
            </div>

            <div className="vote-workflow-metrics" aria-label="Resume de campagne">
              <article className="vote-workflow-metric is-progress">
                <span>Votes recus</span>
                <strong>{voteWorkflowStats.receivedVotes}/{voteWorkflowStats.expectedVotes}</strong>
                <div className="vote-workflow-progressbar">
                  <span style={{ width: `${voteWorkflowStats.completionRate}%` }} />
                </div>
                <p>{voteWorkflowStats.completionRate}% de la campagne</p>
              </article>
              <article className="vote-workflow-metric">
                <span>A relancer</span>
                <strong>{voteWorkflowStats.pendingTpis}</strong>
                <p>{voteWorkflowStats.missingVotes} vote{voteWorkflowStats.missingVotes > 1 ? 's' : ''} manquant{voteWorkflowStats.missingVotes > 1 ? 's' : ''}</p>
              </article>
              <article className="vote-workflow-metric">
                <span>Prets cloture</span>
                <strong>{voteWorkflowStats.readyTpis}</strong>
                <p>{voteWorkflowStats.proposalTpis} avec proposition ou demande</p>
              </article>
              <article className={`vote-workflow-metric ${voteWorkflowStats.manualTpis > 0 ? 'is-warning' : ''}`}>
                <span>À forcer</span>
                <strong>{voteWorkflowStats.manualTpis}</strong>
                <p>{voteWorkflowStats.confirmedTpis} TPI confirme{voteWorkflowStats.confirmedTpis > 1 ? 's' : ''}</p>
              </article>
            </div>

            <div className="vote-workflow-actions">
              {isPlanningState ? (
                <>
                  <button
                    type="button"
                    className="workflow-btn primary"
                    onClick={handleStartVotesCampaign}
                    disabled={workflowActionLoading || !canStartVotes || hasLegacyImportGap}
                    title={hasLegacyImportGap
                      ? 'Des TPI de GestionTPI ne sont pas encore présents dans Planning.'
                      : hasBlockedValidation
                        ? 'La vérification a détecté des anomalies. Corrigez-les avant d\'ouvrir les votes.'
                        : !hasActiveSnapshot
                        ? 'Geler un snapshot d abord.'
                        : 'Ouvrir la campagne et envoyer les liens de vote.'}
                  >
                    <ArrowRightIcon className="button-icon" />
                    {isActionRunning('startVotes') ? 'Ouverture...' : 'Ouvrir votes'}
                  </button>
                  {IS_DEBUG && (
                    <button
                      type="button"
                      className="workflow-btn secondary"
                      aria-label="Ouvrir votes sans emails"
                      onClick={handleStartVotesCampaignWithoutEmails}
                      disabled={workflowActionLoading || !canStartVotes || hasLegacyImportGap}
                      title={hasLegacyImportGap
                        ? 'Des TPI de GestionTPI ne sont pas encore présents dans Planning.'
                        : hasBlockedValidation
                          ? 'La vérification a détecté des anomalies. Corrigez-les avant d\'ouvrir les votes.'
                          : 'Mode debug: ouvre la campagne sans envoyer les emails automatiques.'}
                    >
                      <VoteIcon className="button-icon" />
                      {isActionRunning('startVotesNoEmail') ? 'Ouverture...' : 'Ouvrir sans emails'}
                    </button>
                  )}
                </>
              ) : null}

              {isVotingState ? (
                <>
                  <button
                    type="button"
                    className="workflow-btn neutral"
                    onClick={handleRemindVotes}
                    disabled={workflowActionLoading || voteWorkflowStats.missingVotes === 0}
                    title="Renvoyer les liens magiques aux personnes qui n'ont pas encore voté."
                  >
                    <MailIcon className="button-icon" />
                    {isActionRunning('remindVotes') ? 'Relance...' : 'Relancer non-repondants'}
                    </button>
                  {IS_DEBUG ? (
                    <button
                      type="button"
                      className="workflow-btn open"
                      onClick={handleOpenVoteAccessPreview}
                      title="Ouvre l'aperçu des liens de vote préfiltré sur cette année."
                    >
                      <VoteIcon className="button-icon" />
                      Aperçu des liens vote
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="workflow-btn primary"
                    onClick={handleCloseVotes}
                    disabled={workflowActionLoading || voteWorkflowStats.totalTpis === 0}
                    title="Clore la campagne et classer chaque TPI en confirme ou manuel."
                  >
                    <ArrowRightIcon className="button-icon" />
                    {isActionRunning('closeVotes') ? 'Cloture...' : 'Clore campagne'}
                  </button>
                </>
              ) : null}

              {voteWorkflowStats.manualTpis > 0 ? (
                <button
                  type="button"
                  className="workflow-btn open"
                  onClick={() => {
                    setManualFocusTpiId('')
                    setActiveTab('conflicts')
                  }}
                  title="Ouvrir la vue pour forcer les créneaux manuels."
                  aria-label="Ouvrir la vue pour forcer les créneaux manuels."
                >
                  <WrenchIcon className="button-icon" />
                  Forcer créneaux
                </button>
              ) : null}

              {isPlanningState || isVotingState ? (
                <button
                  type="button"
                  className="workflow-btn success"
                  onClick={handlePublishDefinitive}
                  disabled={workflowActionLoading || (isPlanningState ? !canPublishDirect : !canPublish)}
                  title={
                    isPlanningState
                      ? hasLegacyImportGap
                        ? 'Des TPI de GestionTPI ne sont pas encore présents dans Planning.'
                        : hasBlockedValidation
                          ? 'La vérification a détecté des anomalies. Corrigez-les avant de publier.'
                          : canPublishDirect
                            ? 'Confirmer les créneaux du snapshot et publier sans campagne de votes.'
                            : 'Geler un snapshot avant publication directe.'
                      : 'Publier les défenses confirmées.'
                  }
                >
                  <CheckIcon className="button-icon" />
                  {isActionRunning('publish')
                    ? 'Publication...'
                    : isPlanningState
                      ? 'Publier sans votes'
                      : 'Publier définitif'}
                </button>
              ) : null}

              {isPublishedState ? (
                <button
                  type="button"
                  className="workflow-btn success"
                  onClick={handleOpenPublishedView}
                  title="Afficher la vue de publication des défenses."
                  aria-label="Ouvrir défenses."
                >
                  <CheckIcon className="button-icon" />
                  Ouvrir défenses
                </button>
              ) : null}
            </div>

            {voteWorkflowStats.totalTpis === 0 ? (
              <div className="vote-workflow-empty-state">
                <strong>Aucune donnée de vote visible pour cette année.</strong>
                <p>
                  Gèle un snapshot, ouvre la campagne, puis recharge cette vue si besoin.
                </p>
              </div>
            ) : (
              <div className="vote-workflow-board">
                <div className="vote-workflow-board-head">
                  <div>
                    <strong>File de traitement</strong>
                    <p>Les filtres et la recherche ci-dessus s'appliquent a cette file.</p>
                  </div>
                  <span>
                    {filteredVoteTrackingTpis.length}/{voteTrackingTpis.length} TPI affiches
                  </span>
                </div>

                <div className="vote-workflow-sections">
                  {activeVoteWorkflowSections.map((section) => (
                    <section
                      key={section.id}
                      className={`vote-workflow-queue is-${section.id}`}
                    >
                      <div className="vote-workflow-queue-head">
                        <div>
                          <h3>{section.title}</h3>
                          <p>{section.helper}</p>
                        </div>
                        <span>{section.rows.length}</span>
                      </div>

                      <div className="vote-workflow-row-list">
                        {section.rows.length > 0 ? section.rows.map((row) => (
                          <article
                            key={row.id}
                            className={`vote-workflow-row ${selectedTpi?._id === row.tpi?._id ? 'is-selected' : ''}`}
                          >
                            <div className="vote-workflow-row-main">
                              <div>
                                <strong>{row.reference}</strong>
                                <p>{row.candidate}</p>
                              </div>
                              <div className="vote-workflow-row-actions">
                                {row.bucket === 'manual' ? (
                                  <button
                                    type="button"
                                    className="vote-workflow-open is-force"
                                    onClick={() => openManualResolver(row.tpi)}
                                    title={`Forcer un créneau pour ${row.reference}.`}
                                    aria-label={`Forcer un créneau pour ${row.reference}.`}
                                  >
                                    Forcer
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="vote-workflow-open"
                                  onClick={() => setSelectedTpi(row.tpi)}
                                  title={`Afficher le résumé ${row.reference}.`}
                                  aria-label={`Afficher le résumé ${row.reference}.`}
                                >
                                  Détails
                                </button>
                              </div>
                            </div>

                            <div className="vote-workflow-slot">
                              <CalendarIcon className="inline-icon" />
                              <span>{row.fixedSlotLabel}</span>
                            </div>

                            <div className="vote-workflow-role-grid" aria-label={`Votes ${row.reference}`}>
                              {row.roleEntries.map((entry) => {
                                const tone = getVoteRoleTone(entry.status)

                                return (
                                  <span
                                    key={entry.role}
                                    className={`vote-workflow-role is-${tone}`}
                                    title={entry.status?.specialRequestReason || undefined}
                                  >
                                    <strong>{entry.label}</strong>
                                    <span>{getVoteRoleStatusLabel(entry.status)}</span>
                                  </span>
                                )
                              })}
                            </div>

                            {row.proposalSummaries.length > 0 ? (
                              <div
                                className="vote-proposal-summary is-compact"
                                aria-label={`Propositions reçues ${row.reference}`}
                              >
                                <div className="vote-proposal-summary-head">
                                  <strong>Propositions reçues</strong>
                                  <span>
                                    {row.proposalSummaries.length} votant{row.proposalSummaries.length > 1 ? 's' : ''}
                                  </span>
                                </div>

                                <div className="vote-proposal-summary-list">
                                  {row.proposalSummaries.map((summary) => {
                                    const voterLabel = [
                                      summary.roleLabel,
                                      summary.voterName
                                    ].map(compactText).filter(Boolean).join(' - ')
                                    const specialDateLabel = formatSpecialRequestDate(summary.specialRequestDate)
                                    const specialDateShortLabel = formatVoteDate(summary.specialRequestDate)
                                    const hasSpecialRequest = Boolean(
                                      summary.hasAvailabilityException ||
                                      compactText(summary.specialRequestReason) ||
                                      specialDateLabel
                                    )
                                    const specialPreview = [
                                      specialDateShortLabel,
                                      compactText(summary.specialRequestReason)
                                    ].filter(Boolean).join(' · ')

                                    return (
                                      <div
                                        key={`${row.id}-${summary.role}`}
                                        className="vote-proposal-summary-item"
                                      >
                                        <span className="vote-proposal-person" title={voterLabel || summary.roleLabel}>
                                          <strong>{summary.roleLabel}</strong>
                                          {summary.voterName ? <span>{summary.voterName}</span> : null}
                                        </span>
                                        <div className="vote-proposal-summary-chips">
                                          {summary.slots.length > 0 ? (
                                            <div className="vote-proposal-choice-list">
                                              {summary.slots.map((slot) => {
                                                const moveKey = `${row.id}:${slot.slotId}:move`
                                                const preferenceKey = `${slot.voteId || summary.role}:${slot.slotId}`
                                                const isMoveLoading = proposalMoveLoadingKey === `${row.id}:${slot.slotId}` ||
                                                  proposalMoveLoadingKey === `${compactText(row.tpi?._id)}:${slot.slotId}`
                                                const isPreferenceLoading = preferenceActionLoadingKey === preferenceKey

                                                return (
                                                  <div
                                                    key={`${summary.role}-${slot.slotId}`}
                                                    className="vote-proposal-choice"
                                                  >
                                                    <span
                                                      className="vote-proposal-chip is-normal"
                                                      title={slot.label}
                                                    >
                                                      {slot.label}
                                                    </span>
                                                    <button
                                                      type="button"
                                                      className="vote-proposal-mini-action"
                                                      onClick={(event) => {
                                                        event.stopPropagation()
                                                        handleReviewVoteProposalMove(row.tpi, summary, slot)
                                                      }}
                                                      disabled={isMoveLoading || proposalMoveApplying}
                                                      title={`Simuler le déplacement de ${row.reference} vers ${slot.label}.`}
                                                      aria-label={`Simuler le déplacement de ${row.reference} vers ${slot.label}.`}
                                                      data-action-key={moveKey}
                                                    >
                                                      <ArrowRightIcon className="button-icon" />
                                                      {isMoveLoading ? '...' : 'Déplacer'}
                                                    </button>
                                                    {slot.voteId ? (
                                                      <button
                                                        type="button"
                                                        className="vote-proposal-mini-action is-preference"
                                                        onClick={(event) => {
                                                          event.stopPropagation()
                                                          handleInsertProposalPreference(summary, slot)
                                                        }}
                                                        disabled={isPreferenceLoading}
                                                        title="Ajouter ce choix aux dates idéales du votant."
                                                        aria-label={`Ajouter ${slot.label} aux dates idéales de ${summary.voterName || summary.roleLabel}.`}
                                                      >
                                                        <PinIcon className="button-icon" />
                                                        {isPreferenceLoading ? '...' : 'Dates idéales'}
                                                      </button>
                                                    ) : null}
                                                  </div>
                                                )
                                              })}
                                            </div>
                                          ) : null}

                                          {hasSpecialRequest ? (
                                            <span
                                              className="vote-proposal-chip is-special"
                                              title={[
                                                specialDateLabel,
                                                summary.specialRequestReason
                                              ].map(compactText).filter(Boolean).join(' - ')}
                                            >
                                              Perso.{specialPreview ? ` ${specialPreview}` : ''}
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            ) : null}

                            {row.decisionSlots.length > 0 ? (
                              <div className="vote-decision-board" aria-label={`Créneaux votés ${row.reference}`}>
                                <div className="vote-decision-head">
                                  <strong>Créneaux votés</strong>
                                  <span>Les 3 rôles doivent être d'accord. L'admin peut trancher.</span>
                                </div>
                                <div className="vote-decision-slot-list">
                                  {row.decisionSlots.map((slot) => (
                                    <div
                                      key={slot.slotId}
                                      className={`vote-decision-slot ${slot.isFixed ? 'is-fixed' : 'is-proposal'} ${slot.positiveCount >= 3 ? 'has-consensus' : ''}`}
                                    >
                                      <div className="vote-decision-slot-main">
                                        <div>
                                          <strong>{slot.label}</strong>
                                          <span>{slot.isFixed ? 'Créneau fixé' : 'Proposition'}</span>
                                        </div>
                                        <span className={`vote-decision-score ${slot.positiveCount >= 3 ? 'is-ok' : slot.positiveCount === 2 ? 'is-warning' : ''}`}>
                                          {slot.positiveCount}/3 accord
                                        </span>
                                      </div>

                                      <div className="vote-decision-role-list">
                                        {slot.roleDecisions.map((decision) => {
                                          const tone = getSlotDecisionTone(decision.decision)
                                          const title = [
                                            decision.voterName,
                                            decision.comment,
                                            decision.specialRequestReason
                                          ].map(compactText).filter(Boolean).join(' · ')

                                          return (
                                            <span
                                              key={`${slot.slotId}-${decision.role}`}
                                              className={`vote-decision-role is-${tone}`}
                                              title={title || undefined}
                                            >
                                              <strong>{getVoterRoleLabel(decision.role)}</strong>
                                              <span>{getSlotDecisionLabel(decision.decision, slot.isFixed)}</span>
                                            </span>
                                          )
                                        })}
                                      </div>

                                      {normalizePlanningStatus(row.tpi?.status) !== PLANNING_STATUS.CONFIRMED ? (
                                        <button
                                          type="button"
                                          className="vote-decision-force"
                                          onClick={() => handleForceVoteSlot(row.tpi, slot)}
                                          disabled={workflowActionLoading}
                                          title={`${getAdminSlotActionLabel(slot)} ${slot.label}.`}
                                          aria-label={`${getAdminSlotActionLabel(slot)} ${slot.label} pour ${row.reference}.`}
                                        >
                                          {getAdminSlotActionLabel(slot)}
                                        </button>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            <div className="vote-workflow-row-foot">
                              <span>{row.respondedCount}/3 reponses</span>
                              {row.missingLabels.length > 0 ? (
                                <span>Manque: {row.missingLabels.join(', ')}</span>
                              ) : row.hasSpecialRequest ? (
                                <span>Demande speciale</span>
                              ) : row.hasProposal ? (
                                <span>Proposition recue</span>
                              ) : (
                                <span>{row.deadlineLabel || 'Complet'}</span>
                              )}
                            </div>
                          </article>
                        )) : (
                          <div className="vote-workflow-empty">
                            Rien dans cette file avec les filtres actuels.
                          </div>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            )}

            {/* Section TPI non importés */}
            {notImportedLegacyTpisByPlanningPerimeter.length > 0 && (
              <div className="not-imported-section">
                <h3>
                  <CloseIcon className="section-title-icon" />
                  TPI non intégrés au workflow ({notImportedLegacyTpisByPlanningPerimeter.length})
                </h3>
                <p className="not-imported-hint">
                  Présents dans GestionTPI, absents du workflow. Complétez les parties prenantes.
                </p>
                <div className="not-imported-list">
                  {notImportedLegacyTpisByPlanningPerimeter.map((tpi) => {
                    const ref = tpi.refTpi || tpi.id || '?'
                    const candidat = tpi.candidat || '—'
                    const reasons = []
                    if (!tpi.expert1?.name || tpi.expert1.name.toLowerCase() === 'null') reasons.push('Expert 1 manquant')
                    if (!tpi.expert2?.name || tpi.expert2.name.toLowerCase() === 'null') reasons.push('Expert 2 manquant')
                    if (!tpi.boss?.name || tpi.boss.name.toLowerCase() === 'null') reasons.push('Chef de projet manquant')
                    if (!tpi.candidat) reasons.push('Candidat manquant')

                    return (
                      <div key={ref} className="not-imported-item">
                        <span className="not-imported-ref">
                          <CloseIcon className="inline-icon" />
                          TPI-{year}-{ref}
                        </span>
                        <span className="not-imported-candidat">{candidat}</span>
                        <span className="not-imported-reason" title={reasons.join(', ')}>
                          <AlertIcon className="inline-icon" />
                          {reasons[0]}{reasons.length > 1 ? ` +${reasons.length - 1}` : ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
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
                Créneaux à forcer
              </h2>
              <p>
                Sélectionne le TPI, choisis le créneau à imposer, puis indique la raison.
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

      {proposalMoveReview && (
        <>
          <button
            type="button"
            className="tpi-detail-panel-backdrop"
            aria-label="Fermer la simulation de déplacement"
            onClick={() => {
              if (!proposalMoveApplying) {
                setProposalMoveReview(null)
              }
            }}
            title="Fermer la simulation."
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
                  Simulation déplacement
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
                aria-label="Fermer la simulation"
                title="Fermer"
              >
                <CloseIcon className="section-title-icon" />
              </button>
            </div>

            <div className="panel-content vote-move-content">
              {proposalMoveReview.status === 'loading' ? (
                <div className="vote-move-state">Simulation des contraintes en cours...</div>
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
                  className="btn-primary"
                  onClick={handleApplyVoteProposalMove}
                  disabled={proposalMoveApplying}
                >
                  <CheckIcon className="button-icon" />
                  {proposalMoveApplying ? 'Déplacement...' : 'Déplacer et confirmer'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    openManualResolver(proposalMoveReview.tpi)
                    setProposalMoveReview(null)
                  }}
                  disabled={proposalMoveReview.status === 'loading'}
                >
                  <WrenchIcon className="button-icon" />
                  Ouvrir le forçage
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
                <span className="panel-kicker">Fiche planning</span>
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
                      <dt>Expert 1</dt>
                      <dd>{formatPersonName(selectedTpi.expert1, 'Non renseigné')}</dd>
                    </div>
                    <div>
                      <dt>Expert 2</dt>
                      <dd>{formatPersonName(selectedTpi.expert2, 'Non renseigné')}</dd>
                    </div>
                    <div>
                      <dt>Chef de projet</dt>
                      <dd>{formatPersonName(selectedTpi.chefProjet, 'Non renseigné')}</dd>
                    </div>
                  </dl>
                </section>

                <section className="planning-detail-card">
                  <h4>Votes</h4>
                  <div className="planning-detail-vote-status">
                    <strong>{selectedTpiRespondedVoteCount}/3 réponses</strong>
                    <span>{selectedTpiManualAction ? 'Forçage requis' : selectedTpiStatusMeta.label}</span>
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
                  title="Ouvrir le formulaire de forçage pour ce TPI."
                  aria-label="Forcer un créneau pour ce TPI."
                >
                  <WrenchIcon className="button-icon" />
                  Forcer un créneau
                </button>
              ) : null}
              {isAdmin ? (
                <Link
                  className="btn-secondary"
                  to={selectedTpiDetailLink}
                  title="Ouvrir la fiche complète du TPI dans la gestion."
                  aria-label="Ouvrir la fiche complète du TPI."
                >
                  Ouvrir la fiche complète
                </Link>
              ) : null}
              {isAdmin && selectedTpi.status === 'draft' ? (
                <button
                  className="btn-primary"
                  onClick={() => handleProposeSlots(selectedTpi._id)}
                  title="Lancer le processus de vote pour ce TPI."
                  aria-label="Lancer le processus de vote pour ce TPI."
                >
                  <VoteIcon className="button-icon" />
                  Lancer le vote
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
