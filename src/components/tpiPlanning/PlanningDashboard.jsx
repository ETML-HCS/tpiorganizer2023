import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { authPlanningService, planningCatalogService, planningConfigService, tpiPlanningService, slotService, voteService, workflowPlanningService } from '../../services/planningService'
import { tpiDossierService } from '../../services/tpiDossierService'
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
import TpiDetailSections from '../tpiDetail/TpiDetailSections'
import { buildPlanningOnlyDossier, buildTpiDetailsLink } from '../tpiDetail/tpiDetailUtils'
import {
  MANUAL_REQUIRED_STATUSES,
  normalizePlanningStatus,
  PLANNING_STATUS
} from '../../constants/planningStatus'
import { buildValidationToast } from '../../utils/workflowFeedback'
import './PlanningDashboard.css'

const WORKFLOW_LABELS = {
  planning: 'Planification',
  voting_open: 'Votes ouverts',
  published: 'Publie'
}

const WORKFLOW_ACTION_LABELS = {
  validate: 'Verifier conflits',
  freeze: 'Geler snapshot',
  startVotes: 'Ouvrir votes',
  remindVotes: 'Relancer votes',
  closeVotes: 'Clore votes',
  publish: 'Publier definitif',
  sendLinks: 'Envoyer liens soutenance'
}

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

function normalizeSiteValue(value) {
  return compactText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()
}

function isExternalPlanningSite(value) {
  return normalizeSiteValue(value).includes('horsetml')
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

/**
 * Dashboard principal pour la planification des soutenances TPI
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
  const [validationResult, setValidationResult] = useState(null)
  
  // États de l'interface
  const [activeTab, setActiveTab] = useState(() => requestedTab || 'calendar')
  const [selectedTpi, setSelectedTpi] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [workflowActionLoading, setWorkflowActionLoading] = useState(false)
  const [pendingWorkflowAction, setPendingWorkflowAction] = useState('')
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [selectedTpiDossier, setSelectedTpiDossier] = useState(null)
  const [selectedTpiDossierLoading, setSelectedTpiDossierLoading] = useState(false)
  const [selectedTpiDossierError, setSelectedTpiDossierError] = useState('')
  const [appliedFocus, setAppliedFocus] = useState('')

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

      setPlanningClassTypes(Array.isArray(planningConfigResponse?.classTypes) ? planningConfigResponse.classTypes : [])
      setPlanningCatalogSites(Array.isArray(planningCatalogResponse?.sites) ? planningCatalogResponse.sites : [])
      
      setTpis(tpisResponse)
      setLegacyTpis(legacyTpisResponse)
      setCalendarData(calendarResponse)
      setPendingVotes(votesResponse)
      setWorkflow(workflowResponse)
      setActiveSnapshot(snapshotResponse)
      
      // Identifier les conflits
      const tpisWithConflicts = tpisResponse.filter(tpi => 
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

  const hasVotingCandidates = useMemo(() => {
    return visibleTpis.some(tpi => tpi.proposedSlots && tpi.proposedSlots.length > 0)
  }, [visibleTpis])

  const voteTrackingTpis = useMemo(() => {
    if (!isAdmin) {
      return []
    }

    return visibleTpis.filter((tpi) => {
      const normalizedStatus = normalizePlanningStatus(tpi.status)
      return normalizedStatus !== PLANNING_STATUS.DRAFT
    })
  }, [visibleTpis, isAdmin])

  // TPI legacy non importés (dans le legacy mais pas dans tpiPlannings)
  const notImportedLegacyTpis = useMemo(() => {
    if (!isAdmin || !legacyTpis.length) return []

    // Extraire les refsTpi des TPI importés (format TPI-2026-XXX)
    const importedRefs = new Set(
      tpis.map(tpi => {
        // reference = "TPI-2026-2246" -> extraire "2246"
        const match = tpi.reference?.match(/TPI-\d+-(.+)/)
        return match ? match[1] : null
      }).filter(Boolean)
    )

    return legacyTpis.filter(tpi => {
      if (isExternalPlanningSite(tpi?.lieu?.site || tpi?.site)) {
        return false
      }

      const ref = tpi.refTpi || tpi.id
      return ref && !importedRefs.has(String(ref).trim())
    })
  }, [legacyTpis, tpis, isAdmin])

  const legacyTpiCount = legacyTpis.length
  const hasLegacyPlanningData = isAdmin && stats.total === 0 && legacyTpiCount > 0
  const hasLegacyImportGap = notImportedLegacyTpis.length > 0
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
            messages: []
          }
        }

        const target = byTpiId[tpiId]
        const label = getValidationIssueLabel(issue)
        const message = compactText(issue?.message)

        target.count += 1
        target.issues.push(issue)

        if (label && !target.labels.includes(label)) {
          target.labels.push(label)
        }

        if (message && !target.messages.includes(message)) {
          target.messages.push(message)
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
  const canStartVotes = isPlanningState && hasActiveSnapshot
  const canPublish = isVotingState || isPublishedState

  const selectedTpiValidationMessages = useMemo(() => {
    if (!selectedTpi) {
      return []
    }

    return validationAnnotations.byTpiId[compactText(selectedTpi._id)]?.messages || []
  }, [selectedTpi, validationAnnotations.byTpiId])

  const selectedTpiFallbackDossier = useMemo(() => {
    if (!selectedTpi) {
      return null
    }

    return buildPlanningOnlyDossier({
      year,
      planningTpi: selectedTpi
    })
  }, [selectedTpi, year])

  const selectedTpiDetailLink = useMemo(() => {
    if (!selectedTpi) {
      return '/gestionTPI'
    }

    return buildTpiDetailsLink(
      year,
      compactText(selectedTpi.reference) || compactText(selectedTpi._id)
    )
  }, [selectedTpi, year])

  const selectedTpiDisplayDossier = useMemo(() => {
    const selectedWorkflowId = compactText(selectedTpi?._id)
    const dossierWorkflowId = compactText(selectedTpiDossier?.planning?.data?._id)

    if (selectedWorkflowId && dossierWorkflowId && selectedWorkflowId === dossierWorkflowId) {
      return selectedTpiDossier
    }

    return selectedTpiFallbackDossier
  }, [selectedTpi, selectedTpiDossier, selectedTpiFallbackDossier])
  const focusedTpiMatch = useMemo(() => {
    if (!requestedFocus) {
      return null
    }

    return visibleTpis.find((tpi) => matchesFocusReference(tpi?.reference, requestedFocus)) || null
  }, [requestedFocus, visibleTpis])
  const hasFocusWithoutMatch = Boolean(requestedFocus) && !focusedTpiMatch

  useEffect(() => {
    if (!selectedTpi || !isAdmin) {
      setSelectedTpiDossier(null)
      setSelectedTpiDossierLoading(false)
      setSelectedTpiDossierError('')
      return
    }

    const selectedReference = compactText(selectedTpi.reference)

    if (!selectedReference) {
      setSelectedTpiDossier(null)
      setSelectedTpiDossierLoading(false)
      setSelectedTpiDossierError('Référence Planning introuvable pour cette fiche.')
      return
    }

    let isCancelled = false

    const loadSelectedTpiDossier = async () => {
      setSelectedTpiDossier(null)
      setSelectedTpiDossierLoading(true)
      setSelectedTpiDossierError('')

      try {
        const response = await tpiDossierService.getByRef(year, selectedReference)

        if (!isCancelled) {
          setSelectedTpiDossier(response)
        }
      } catch (loadError) {
        if (!isCancelled) {
          setSelectedTpiDossier(null)
          setSelectedTpiDossierError(
            getApiErrorMessage(loadError, 'Impossible de charger la lecture croisée de ce TPI.')
          )
        }
      } finally {
        if (!isCancelled) {
          setSelectedTpiDossierLoading(false)
        }
      }
    }

    void loadSelectedTpiDossier()

    return () => {
      isCancelled = true
    }
  }, [isAdmin, selectedTpi, year])

  useEffect(() => {
    if (!requestedFocus) {
      setAppliedFocus('')
      return
    }

    if (appliedFocus === requestedFocus || isLoading) {
      return
    }

    if (activeTab !== 'list') {
      setActiveTab('list')
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
    visibleTpis
  ])

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
      console.log(`[WORKFLOW] Exécution action: ${actionKey}`)
      const result = await run()
      console.log(`[WORKFLOW] Résultat ${actionKey}:`, result)

      if (reloadAfterSuccess) {
        console.log(`[WORKFLOW] Rechargement données après ${actionKey}`)
        await loadData()
      }

      const builtMessage = typeof successBuilder === 'function'
        ? successBuilder(result)
        : successBuilder

      if (builtMessage) {
        console.log(`[WORKFLOW] Message succès: ${builtMessage}`)
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
      confirmMessage: 'Confirmer la publication definitive des soutenances ?',
      run: () => workflowPlanningService.publishDefinitive(year),
      successBuilder: (result) => {
        const sent = result?.sentLinks
        const sentLabel = sent
          ? ` Liens soutenance: ${sent.emailsSucceeded || 0}/${sent.emailsSent || 0}.`
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
        return `Liens soutenance envoyes: ${sent?.emailsSucceeded || 0}/${sent?.emailsSent || 0}.`
      },
      errorFallback: 'Erreur lors de l envoi des liens soutenance.'
    })
  }, [year, executeWorkflowAction])

  const handleOpenPublishedView = useCallback(() => {
    window.location.href = `/Soutenances/${year}`
  }, [year])

  const handleExitScopedVoteView = useCallback(() => {
    authPlanningService.clearSession()
    window.location.href = `/planning/${year}`
  }, [year])

  // Onglets de navigation
  const tabs = useMemo(() => {
    if (isScopedVoteViewer) {
      return [
        { id: 'votes', label: 'Votes', icon: <VoteIcon className='page-tools-tab-icon-svg' />, count: stats.pendingVotes },
        { id: 'list', label: 'Mes TPI', icon: <ListIcon className='page-tools-tab-icon-svg' />, count: stats.total }
      ]
    }

    // Onglets pour le suivi de votes admin (planning/{year}?tab=votes)
    return [
      { id: 'votes', label: 'Suivi des votes', icon: <VoteIcon className='page-tools-tab-icon-svg' />, count: voteTrackingTpis.length },
      { id: 'list', label: 'TPI', icon: <ListIcon className='page-tools-tab-icon-svg' />, count: stats.total },
      { id: 'conflicts', label: 'Manuels', icon: <WrenchIcon className='page-tools-tab-icon-svg' />, count: stats.conflicts }
    ]
  }, [isScopedVoteViewer, stats.pendingVotes, stats.total, stats.conflicts, voteTrackingTpis.length])

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
          ? `${manualRequiredCount} TPI en manuel`
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

  /**
   * Callback après import réussi
   */
  const handleImportComplete = useCallback((type, results) => {
    console.log(`Import ${type} terminé:`, results)
    // Recharger les données après import
    loadData()
    // Passer à l'onglet approprié
    if (type === 'csv') {
      setActiveTab('list')
    }
  }, [loadData])

  useEffect(() => {
    if (requestedTab && tabs.some(tab => tab.id === requestedTab)) {
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
    if (!tabExists) {
      setActiveTab(tabs[0]?.id || 'votes')
    }
  }, [requestedTab, isScopedVoteViewer, activeTab, tabs, navigate, location.pathname, location.search])

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
                to={`/planning/${year}?tab=votes`}
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
        bodyClassName="planning-dashboard-tools-body"
      >
        {isScopedVoteViewer && (
          <section className="workflow-actions">
            <div className="workflow-state-badge state-voting_open">
              Vue vote personnelle
            </div>
            <button
              type="button"
              className="workflow-btn neutral"
              onClick={handleExitScopedVoteView}
              title="Quitter le mode vote et revenir à la vue globale."
            >
              Quitter le mode vote
            </button>
          </section>
        )}

        {!isAdmin && !isScopedVoteViewer && (
          <section className="workflow-actions">
            <div className="workflow-state-badge" style={{background: '#ffebee', color: '#c62828'}}>
              Accès admin requis
            </div>
          </section>
        )}

        {isAdmin && (
          <section className="workflow-actions">
            <div className={`workflow-state-badge state-${workflowState}`}>
              Workflow: {workflowLabel}
            </div>
            <div className="workflow-steps">
              {workflowSteps.map(step => (
                <div
                  key={step.id}
                  className={`workflow-step ${step.done ? 'done' : ''} ${step.warning ? 'warning' : ''}`}
                >
                  <span className="workflow-step-icon">
                    {step.done ? <CheckIcon /> : <CalendarIcon />}
                  </span>
                  <span className="workflow-step-label">{step.label}</span>
                  {step.warning && <span className="workflow-step-warning">{step.warning}</span>}
                </div>
              ))}
            </div>
            {workflowActionLoading && (
              <div className="workflow-progress">
                Action en cours: {WORKFLOW_ACTION_LABELS[pendingWorkflowAction] || 'Traitement'}
              </div>
            )}
            <div className="workflow-buttons">
              {/* Section Planification - visible uniquement en état Planification */}
              {isPlanningState && (
                <div className="workflow-section">
                  <h4 className="section-title">
                    <CalendarIcon className="section-title-icon" />
                    Planification
                  </h4>
                  <div className="section-buttons">
                    <button
                      className="workflow-btn secondary"
                      onClick={handleValidatePlanification}
                      disabled={workflowActionLoading}
                      title="Verifier les conflits dans la planification actuelle."
                    >
                      <SearchIcon className="button-icon" />
                      {isActionRunning('validate') ? 'Verification...' : 'Verifier conflits'}
                    </button>
                    <button
                      className="workflow-btn primary"
                      onClick={handleFreezePlanification}
                      disabled={workflowActionLoading || hasLegacyImportGap}
                      title={hasLegacyImportGap
                        ? 'Des TPI de GestionTPI ne sont pas encore présents dans Planning. Corriger avant le gel.'
                        : 'Figer la version de planification a soumettre au vote.'}
                    >
                      <ArrowRightIcon className="button-icon" />
                      {isActionRunning('freeze') ? 'Gel en cours...' : 'Geler snapshot'}
                    </button>
                    <button
                      className="workflow-btn primary"
                      onClick={handleStartVotesCampaign}
                      disabled={workflowActionLoading || !canStartVotes || hasLegacyImportGap}
                      title={hasLegacyImportGap
                        ? 'Des TPI de GestionTPI ne sont pas encore présents dans Planning.'
                        : !hasActiveSnapshot
                        ? 'Geler un snapshot d\'abord.'
                        : hasVotingCandidates
                          ? 'Lancer la campagne de votes.'
                          : 'Proposer des creneaux aux TPI d\'abord.'}
                    >
                      <ArrowRightIcon className="button-icon" />
                      {isActionRunning('startVotes') ? 'Ouverture...' : 'Ouvrir votes'}
                    </button>
                  </div>
                </div>
              )}

              {/* Section Votes - visible uniquement en état Votes */}
              {isVotingState && (
                <div className="workflow-section">
                  <h4 className="section-title">
                    <VoteIcon className="section-title-icon" />
                    Votes
                  </h4>
                  <div className="section-buttons">
                    <Link
                      to={`/planning/${year}?tab=votes`}
                      className="workflow-btn open workflow-link-btn"
                      title="Ouvrir le suivi des votes."
                    >
                      <VoteIcon className="button-icon" />
                      Suivre votes
                    </Link>
                    <button
                      className="workflow-btn neutral"
                      onClick={handleRemindVotes}
                      disabled={workflowActionLoading}
                      title="Renvoyer les liens magiques aux personnes qui n'ont pas encore voté."
                    >
                      <MailIcon className="button-icon" />
                      {isActionRunning('remindVotes') ? 'Relance...' : 'Renvoyer liens'}
                    </button>
                    <button
                      className="workflow-btn primary"
                      onClick={handleCloseVotes}
                      disabled={workflowActionLoading}
                      title="Clore la campagne et classer confirmed/manual_required."
                    >
                      <ArrowRightIcon className="button-icon" />
                      {isActionRunning('closeVotes') ? 'Cloture...' : 'Clore votes'}
                    </button>
                  </div>
                </div>
              )}

              {/* Section Publication - visible en états Votes ou Publication */}
              {(isVotingState || isPublishedState) && (
                <div className="workflow-section">
                  <h4 className="section-title">
                    <CheckIcon className="section-title-icon" />
                    Publication
                  </h4>
                  <div className="section-buttons">
                    <button
                      className="workflow-btn success"
                      onClick={handlePublishDefinitive}
                      disabled={workflowActionLoading || !canPublish}
                      title="Publier la version definitive vers Soutenances."
                    >
                      <CheckIcon className="button-icon" />
                      {isActionRunning('publish') ? 'Publication...' : 'Publier definitif'}
                    </button>
                    <button
                      className="workflow-btn neutral"
                      onClick={handleSendPublicationLinks}
                      disabled={workflowActionLoading}
                      title="Renvoyer les liens de soutenance par email."
                    >
                      <MailIcon className="button-icon" />
                      {isActionRunning('sendLinks') ? 'Envoi...' : 'Envoyer liens soutenance'}
                    </button>
                    <button
                      className="workflow-btn open"
                      onClick={handleOpenPublishedView}
                      disabled={workflowActionLoading}
                    >
                      <PinIcon className="button-icon" />
                      Ouvrir Soutenances
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </PageToolbar>

      {/* Message d'erreur */}
      {error && (
        <div className="error-banner">
          <span className="banner-copy">
            <AlertIcon className="banner-icon" />
            {error}
          </span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {successMessage && (
        <div className="success-banner">
          <span className="banner-copy">
            <CheckIcon className="banner-icon" />
            {successMessage}
          </span>
          <button onClick={() => setSuccessMessage(null)}>×</button>
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
            onClick={() => navigate('/gestionTPI')}
          >
            Ouvrir Gestion TPI
          </button>
        </div>
      )}

      {/* Navigation par onglets */}
      <nav className="dashboard-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className="tab-badge">{tab.count}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Barre de filtres */}
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
          >
            <RefreshIcon className="button-icon" />
            Actualiser
          </button>
        )}
      </div>

      {requestedFocus && (
        <section className={`planning-focus-banner ${hasFocusWithoutMatch ? 'is-missing' : 'is-ready'}`}>
          <div className="planning-focus-banner-copy">
            <strong>Focus actif: {requestedFocus}</strong>
            <p>
              {hasFocusWithoutMatch
                ? `Aucun TPI visible ne correspond à ${requestedFocus} pour l'année ${year}.`
                : `La liste et le panneau détail sont centrés sur ${focusedTpiMatch?.reference || requestedFocus}.`}
            </p>
          </div>

          <div className="planning-focus-banner-actions">
            {focusedTpiMatch && compactText(selectedTpi?._id) !== compactText(focusedTpiMatch?._id) ? (
              <button
                type="button"
                className="planning-focus-banner-btn"
                onClick={() => setSelectedTpi(focusedTpiMatch)}
              >
                Ouvrir le TPI ciblé
              </button>
            ) : null}
            <button
              type="button"
              className="planning-focus-banner-btn secondary"
              onClick={clearFocusedSearch}
            >
              Effacer le focus
            </button>
          </div>
        </section>
      )}

      {/* Contenu principal - Dashboard suivi de votes */}
      <main className="dashboard-content">
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
                        onClick={() => navigate('/gestionTPI')}
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
            />
          </>
        )}

        {activeTab === 'votes' && isAdmin && (
          <section className="vote-tracking-panel">
            <div className="vote-tracking-header">
              <h2>
                <VoteIcon className="section-title-icon" />
                Dashboard de suivi des votes - {year}
              </h2>
              <p>
                Visualisez l'avancement des votes, relancez les non-répondants, et validez manuellement les TPI en attente.
                Une fois tous les votes clôturés, vous pourrez publier l'agenda officiel des soutenances.
              </p>
            </div>

            {voteTrackingTpis.length === 0 ? (
              <div className="vote-tracking-empty">
                <strong>Aucune donnée de vote visible pour cette année.</strong>
                <p>
                  Si tu viens de geler un planning, vérifie que tu l'as fait sur la même année
                  que celle ouverte ici, puis recharge la page de suivi.
                </p>
              </div>
            ) : (
              <>
                <TpiPlanningList
                  tpis={voteTrackingTpis}
                  selectedTpi={selectedTpi}
                  onSelectTpi={setSelectedTpi}
                  onProposeSlots={handleProposeSlots}
                  isAdmin={isAdmin}
                  showVoteRoleDetails
                  classTypes={planningClassTypes}
                  planningCatalogSites={planningCatalogSites}
                  validationIssuesByTpiId={validationAnnotations.byTpiId}
                />

                {/* Section TPI non importés */}
                {notImportedLegacyTpis.length > 0 && (
                  <div className="not-imported-section">
                    <h3>
                      <CloseIcon className="section-title-icon" />
                      TPI non importés ({notImportedLegacyTpis.length})
                    </h3>
                    <p className="not-imported-hint">
                      Ces TPI existent dans GestionTPI mais n'ont pas pu être importés lors du gel.
                      Vérifiez que toutes les parties prenantes (candidat, 2 experts, chef de projet) sont renseignées.
                    </p>
                    <div className="not-imported-list">
                      {notImportedLegacyTpis.map((tpi) => {
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
              </>
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
                TPI nécessitant une action manuelle
              </h2>
              <p>
                Ces TPI n'ont pas pu être clôturés automatiquement après les votes.
                Vous devez forcer un créneau ou marquer comme validé manuellement.
              </p>
            </div>
            <ConflictResolver
              conflicts={conflicts}
              calendarData={calendarData}
              onForceSlot={handleForceSlot}
              onReload={loadData}
            />
          </section>
        )}
      </main>

      {/* Panel de détails TPI (sidebar) */}
      {selectedTpi && (
        <aside className="tpi-detail-panel">
          <div className="panel-header">
            <h3>
              <FileTextIcon className="section-title-icon" />
              {compactText(selectedTpi.reference) ? selectedTpi.reference : 'Détails TPI'}
            </h3>
            <button 
              className="close-panel"
              onClick={() => setSelectedTpi(null)}
            >
              ×
            </button>
          </div>
          
          <div className="panel-content">
            {selectedTpiDossierLoading ? (
              <div className="tpi-detail-panel-state">
                Chargement de la lecture croisée GestionTPI / Planning.
              </div>
            ) : null}

            {selectedTpiDossierError ? (
              <div className="tpi-detail-panel-state error">
                {selectedTpiDossierError}
              </div>
            ) : null}

            <TpiDetailSections
              dossier={selectedTpiDisplayDossier}
              supplementalIssues={selectedTpiValidationMessages}
              showSummary={false}
              showOverview={false}
              className='is-panel'
            />
          </div>

          <div className="panel-actions">
            {isAdmin ? (
              <Link
                className="btn-secondary"
                to={selectedTpiDetailLink}
              >
                Ouvrir la fiche
              </Link>
            ) : null}
            {isAdmin && selectedTpi.status === 'draft' ? (
              <button
                className="btn-primary"
                onClick={() => handleProposeSlots(selectedTpi._id)}
              >
                <VoteIcon className="button-icon" />
                Lancer le vote
              </button>
            ) : null}
          </div>
        </aside>
      )}
    </div>
  )
}

export default PlanningDashboard
