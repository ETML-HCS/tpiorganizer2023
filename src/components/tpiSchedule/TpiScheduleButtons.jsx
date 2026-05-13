import React, { useEffect, useMemo, useState, useRef } from "react"
import { createPortal } from "react-dom"
import { Link, useLocation } from "react-router-dom"
import PageToolbar from "../shared/PageToolbar"
import { MAIN_NAVIGATION_LINKS } from "../shared/mainNavigation"
import IconButtonContent from "../shared/IconButtonContent"
import NewRoomForm from "./NewRoomForm"
import {
  ArrowRightIcon,
  BanIcon,
  ChartIcon,
  CheckIcon,
  CollapseIcon,
  DataEditIcon,
  DatabaseLoadIcon,
  DatabaseSendIcon,
  DownloadIcon,
  ExpandIcon,
  GearIcon,
  JsonExportIcon,
  JsonImportIcon,
  LocalSaveIcon,
  MailIcon,
  PencilIcon,
  QuestionIcon,
  RefreshIcon,
  RoomBatchAddIcon,
  RoomAddIcon,
  SearchIcon,
  SendIcon,
  SnowflakeIcon,
  TrashIcon,
  VoteIcon,
  WrapIcon,
  WrenchIcon
} from "../shared/InlineIcons"
import {
  getSoutenanceDateBadgeLabel,
  getSoutenanceDateBadgeTone,
  normalizeSoutenanceDateEntries,
  normalizeSoutenanceDateValue
} from "./soutenanceDateUtils"
import { isValidationWarningIssue } from "./tpiScheduleValidationUtils"
import { STATIC_VOTE_REGENERATION_NOTICE } from "../../constants/staticVotePublication"

const formatPublicationTargetLabel = (url) => {
  const rawUrl = typeof url === "string" ? url.trim() : ""
  if (!rawUrl) {
    return "le site publication"
  }

  try {
    return new URL(rawUrl).host || rawUrl
  } catch (error) {
    return rawUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "") || "le site publication"
  }
}

const normalizeRoomDateFilterValue = (value) => {
  const rawValue = String(value || "").trim()
  return normalizeSoutenanceDateValue(rawValue) || rawValue
}

const normalizeRoomDateFilterValues = (values) => {
  const source = Array.isArray(values) ? values : [values]

  return Array.from(
    new Set(source.map((value) => normalizeRoomDateFilterValue(value)).filter(Boolean))
  )
}

const compactRoomDateFilterLabel = (value) => {
  const text = String(value || "").trim()
  const swissDateMatch = text.match(/(\d{2}\.\d{2})(?:\.\d{4})?/)
  if (swissDateMatch) {
    return swissDateMatch[1]
  }

  const isoDateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoDateMatch) {
    return `${isoDateMatch[3]}.${isoDateMatch[2]}`
  }

  return text
}

const TpiScheduleButtons = ({
  onToggleEditing,
  onDeleteAllRooms = null,
  onSave,
  onSendBD,
  onExport,
  onLoadConfig,
  onFetchConfig,
  selectedYear,
  availableYears = [],
  workflowState = "planning",
  activeSnapshotVersion = null,
  workflowActionLoading = false,
  pendingWorkflowAction = "",
  validationResult = null,
  validationOptimizationProposal = null,
  validationOptimizationSettings = null,
  onValidationOptimizationSettingsChange = null,
  onApplyValidationOptimization = null,
  onAutomatePlanification,
  onValidatePlanification,
  onFreezeSnapshot,
  onOpenVotes,
  onOpenVotesWithoutEmails = null,
  onOpenVoteAccessPreview = null,
  onRemindVotes,
  onCloseVotes,
  onPublishDefinitive,
  onDeactivatePublication = null,
  workflowPhases = null,
  onWorkflowPhaseToggle = null,
  onSendSoutenanceLinks,
  onGenerateStaticPublication = null,
  onPreviewStaticPublication = null,
  onPublishStaticPublication = null,
  staticPublicationInfo = null,
  onGenerateStaticVotePublication = null,
  onPublishStaticVotePublication = null,
  onSyncStaticVotePublication = null,
  staticVotePublicationInfo = null,
  onOpenVotesTracking,
  onOpenSoutenances,
  roomsCount = 0,
  totalRoomsCount = roomsCount,
  usedTpiCount = null,
  totalTpiCount = null,
  tpiSyncCount = null,
  isTpiSyncRefreshing = false,
  onRefreshTpiSyncStatus = null,
  onSyncAllTpisFromGestion = null,
  localConflictCount = 0,
  tpiCardDetailLevel = 2,
  onTpiCardDetailLevelChange = null,
  roomFilters = { site: "", date: "", room: "" },
  roomSiteOptions = [],
  roomDateOptions = [],
  roomNameOptions = [],
  onRoomFiltersChange = null,
  onClearRoomFilters = null,
  soutenanceDates = [],
  roomCatalogBySite = {},
  onGenerateRoomsFromCatalog = null,
  onShowNewRoomForm = null,
  onCreateRoom = null,
  onCancelCreateRoom = null,
  showNewRoomForm = false,
  existingRooms = [],
  isRoomsFocusMode = false,
  isRoomsWrapMode = false,
  onToggleRoomsFocusMode = null,
  onToggleRoomsWrapMode = null,
  nonImportableTpiCount = 0,
  roomsHashAtFreeze = null,
  currentRoomsHash = null,
  toggleArrow,
  isArrowUp
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [activeToolTab, setActiveToolTab] = useState("data")
  const [activeWorkflowTab, setActiveWorkflowTab] = useState("preparation")
  const fileInputRef = useRef(null)
  const roomFilterMenuRef = useRef(null)
  const roomDateFilterRef = useRef(null)
  const location = useLocation()

  const years = useMemo(() => {
    const parsedYears = availableYears
      .map((year) => Number.parseInt(year, 10))
      .filter((year) => Number.isInteger(year))

    if (Number.isInteger(Number(selectedYear))) {
      parsedYears.push(Number(selectedYear))
    }

    const uniqueYears = Array.from(new Set(parsedYears))

    if (uniqueYears.length === 0) {
      return [new Date().getFullYear()]
    }

    return uniqueYears.sort((a, b) => a - b)
  }, [availableYears, selectedYear])

  const effectiveYear = Number.isInteger(Number(selectedYear))
    ? Number(selectedYear)
    : years[years.length - 1]

  const hasSnapshot = Boolean(activeSnapshotVersion)
  const isPhaseActive = (phase) => {
    if (workflowPhases?.[phase] && typeof workflowPhases[phase].active === "boolean") {
      return workflowPhases[phase].active
    }

    if (phase === "planning") {
      return workflowState === "planning"
    }

    if (phase === "votes") {
      return workflowState === "voting_open"
    }

    if (phase === "defenses") {
      return workflowState === "published"
    }

    return false
  }
  const isPublishedState = isPhaseActive("defenses")
  const workflowPhaseControls = [
    { id: "planning", label: "Planification", icon: WrenchIcon },
    { id: "votes", label: "Votes", icon: VoteIcon },
    { id: "arbitrage", label: "Arbitrage", icon: PencilIcon },
    { id: "defenses", label: "Défenses", icon: CheckIcon }
  ]
  const isActionRunning = (actionKey) =>
    workflowActionLoading && pendingWorkflowAction === actionKey
  const planningHeaderSlot =
    typeof document !== "undefined"
      ? document.getElementById("planning-header-slot")
      : null

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined
    }

    const closeRoomFilterMenus = () => {
      if (roomDateFilterRef.current) {
        roomDateFilterRef.current.open = false
      }

      if (roomFilterMenuRef.current) {
        roomFilterMenuRef.current.open = false
      }
    }

    const handlePointerDown = (event) => {
      const filterMenu = roomFilterMenuRef.current
      if (!filterMenu?.open) {
        return
      }

      if (event.target instanceof Node && filterMenu.contains(event.target)) {
        return
      }

      closeRoomFilterMenus()
    }

    const handleKeyDown = (event) => {
      if (event.key !== "Escape" || !roomFilterMenuRef.current?.open) {
        return
      }

      event.preventDefault()
      closeRoomFilterMenus()
    }

    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  // Le gel est-il déjà fait ET les salles n'ont pas changé ?
  const roomsUnchangedSinceFreeze = roomsHashAtFreeze && currentRoomsHash && roomsHashAtFreeze === currentRoomsHash
  const isAlreadyFrozen = hasSnapshot && roomsUnchangedSinceFreeze
  const hasStaleSnapshot = hasSnapshot && currentRoomsHash && roomsHashAtFreeze && !roomsUnchangedSinceFreeze
  const hasSuccessfulValidation =
    !validationResult ||
    Number(validationResult?.year) !== Number(effectiveYear) ||
    validationResult?.summary?.isValid === true
  const hasBlockedValidation =
    Boolean(validationResult) &&
    Number(validationResult?.year) === Number(effectiveYear) &&
    validationResult?.summary?.isValid === false
  const validationYear = Number.parseInt(validationResult?.year, 10)
  const validationSummary = validationResult?.summary || {}
  const validationIssues = Array.isArray(validationResult?.issues) ? validationResult.issues : []
  const validationIssueCount = Number(validationSummary.issueCount || validationSummary.hardConflictCount || 0)
  const validationWarningCount = Number(
    validationSummary.warningCount ??
      validationIssues.filter(isValidationWarningIssue).length
  )
  const validationDisplayedIssues = validationIssues.filter((issue) =>
    validationIssueCount > 0
      ? !isValidationWarningIssue(issue)
      : isValidationWarningIssue(issue)
  )
  const validationClassMismatchCount = Number(validationSummary.classMismatchCount || 0)
  const validationSequenceViolationCount = Number(validationSummary.sequenceViolationCount || 0)
  const validationImportIssueCount = Number(validationSummary.importIssueCount || 0)
  const validationUnplannedTpiCount = Number(validationSummary.unplannedTpiCount || 0)
  const validationCheckedAt = validationResult?.checkedAt
    ? new Date(validationResult.checkedAt)
    : null
  const validationCheckedAtLabel =
    validationCheckedAt && !Number.isNaN(validationCheckedAt.getTime())
      ? validationCheckedAt.toLocaleString("fr-CH")
      : ""
  const hasValidationForCurrentYear =
    Number.isInteger(validationYear) && validationYear === Number(effectiveYear)

  useEffect(() => {
    if (!hasValidationForCurrentYear || !validationResult) {
      return
    }

    setActiveToolTab("workflow")
    setActiveWorkflowTab("optimization")
  }, [hasValidationForCurrentYear, validationResult])

  const isValidationSuccessful =
    hasValidationForCurrentYear && Boolean(validationResult?.summary) && validationIssueCount === 0
  const hasTpiUsageCount =
    Number.isInteger(usedTpiCount) && Number.isInteger(totalTpiCount)
  const hasLocalConflictCount = Number.isInteger(localConflictCount) && localConflictCount > 0
  const deleteAllRoomsCount = Number.isFinite(Number(totalRoomsCount))
    ? Number(totalRoomsCount)
    : Number(roomsCount) || 0

  const validationLabel = isActionRunning("validate")
    ? "Vérification..."
    : isValidationSuccessful
      ? "Vérifié"
      : "Vérifier conflits"
  const editButtonLabel = isEditing ? "Édition activée" : "Mode édition"
  const automatePlanificationLabel = isActionRunning("autoPlan")
    ? "Automatisation..."
    : "Automatiser planification"
  const freezeSnapshotLabel = isActionRunning("freeze")
    ? "Gel..."
    : isAlreadyFrozen
      ? `Gelé v${activeSnapshotVersion}`
      : "Geler snapshot"
  const openVotesLabel = isActionRunning("startVotes") ? "Ouverture..." : "Ouvrir votes"
  const openVotesWithoutEmailsLabel = isActionRunning("startVotesNoEmail")
    ? "Ouverture..."
    : "Ouvrir votes sans emails"
  const trackVotesLabel = "Suivre votes"
  const remindVotesLabel = isActionRunning("remindVotes") ? "Relance..." : "Relancer votes"
  const closeVotesLabel = isActionRunning("closeVotes") ? "Clôture..." : "Clore votes"
  const publishDefinitiveLabel = isActionRunning("publish")
    ? "Publication..."
    : "Publier défenses"
  const deactivatePublicationLabel = isActionRunning("deactivatePublication")
    ? "Désactivation..."
    : "Désactiver défenses"
  const sendLinksLabel = isActionRunning("sendLinks") ? "Envoi..." : "Envoyer liens"
  const openSoutenancesLabel = "Ouvrir Défenses"
  const generateStaticPublicationLabel = isActionRunning("staticGenerate")
    ? "Génération..."
    : "Générer page statique"
  const previewStaticPublicationLabel = "Prévisualiser"
  const staticPublicationPublicUrl = typeof staticPublicationInfo?.publicUrl === "string"
    ? staticPublicationInfo.publicUrl
    : ""
  const staticPublicationTargetLabel = formatPublicationTargetLabel(staticPublicationPublicUrl)
  const publishStaticPublicationLabel = isActionRunning("staticPublish")
    ? "Publication FTP..."
    : `Publier sur ${staticPublicationTargetLabel}`
  const staticVotePublicationPublicUrl = typeof staticVotePublicationInfo?.publicUrl === "string"
    ? staticVotePublicationInfo.publicUrl
    : ""
  const staticVotePublicationTargetLabel = formatPublicationTargetLabel(staticVotePublicationPublicUrl)
  const generateStaticVotePublicationLabel = isActionRunning("staticVoteGenerate")
    ? "Génération vote..."
    : "Générer vote web"
  const publishStaticVotePublicationLabel = isActionRunning("staticVotePublish")
    ? "Publication vote..."
    : `Publier vote sur ${staticVotePublicationTargetLabel}`
  const syncStaticVotePublicationLabel = isActionRunning("staticVoteSync")
    ? "Sync vote..."
    : "Sync vote web"
  const workflowActionLabels = {
    autoPlan: "Automatisation",
    validate: "Vérification",
    freeze: "Gel du snapshot",
    startVotes: "Ouverture des votes",
    startVotesNoEmail: "Ouverture des votes sans emails",
    remindVotes: "Relance des votes",
    closeVotes: "Clôture des votes",
    publish: "Publication",
    deactivatePublication: "Désactivation publication",
    phaseToggle: "Activation de phase",
    sendLinks: "Envoi des liens",
    staticGenerate: "Génération page statique",
    staticPublish: "Publication FTP",
    staticVoteGenerate: "Génération mini-site vote",
    staticVotePublish: "Publication mini-site vote",
    staticVoteSync: "Synchronisation votes web"
  }

  const validationIssueDetails = []
  if (validationSummary.personOverlapCount > 0) {
    validationIssueDetails.push(`${validationSummary.personOverlapCount} conflit(s) personne`)
  }
  if (validationSummary.roomOverlapCount > 0) {
    validationIssueDetails.push(`${validationSummary.roomOverlapCount} conflit(s) salle`)
  }
  if (validationClassMismatchCount > 0) {
    validationIssueDetails.push(`${validationClassMismatchCount} incompatibilité(s) de salle`)
  }
  if (validationSequenceViolationCount > 0) {
    validationIssueDetails.push(`${validationSequenceViolationCount} séquence(s) trop longue(s)`)
  }
  if (validationUnplannedTpiCount > 0) {
    validationIssueDetails.push(`${validationUnplannedTpiCount} TPI sans créneau`)
  }
  if (validationImportIssueCount > 0) {
    validationIssueDetails.push(`${validationImportIssueCount} écart(s) GestionTPI/workflow`)
  }
  const validationIssueDetailText = validationIssueDetails.length > 0
    ? ` (${validationIssueDetails.join(', ')})`
    : ''
  const optimizationIssueTypes = ["person_overlap", "consecutive_limit", "room_class_mismatch"]
  const optimizationProfileOptions = [
    {
      id: "corrections",
      label: "Corrections",
      title: "Corriger uniquement les conflits détectés par la vérification.",
      settings: {
        profile: "corrections",
        mode: "strict",
        maxSwaps: 3,
        sameSiteOnly: true,
        preserveValidated: true,
        reduceWaitingTime: false,
        issueTypes: optimizationIssueTypes
      }
    },
    {
      id: "attentes",
      label: "Attentes",
      title: "Réduire les attentes des parties prenantes sans ajouter de conflit.",
      settings: {
        profile: "attentes",
        mode: "strict",
        maxSwaps: 3,
        sameSiteOnly: true,
        preserveValidated: true,
        reduceWaitingTime: true,
        issueTypes: optimizationIssueTypes
      }
    },
    {
      id: "equilibre",
      label: "Équilibré",
      title: "Combiner correction des conflits et réduction des attentes dans le même site.",
      settings: {
        profile: "equilibre",
        mode: "expanded",
        maxSwaps: 5,
        sameSiteOnly: true,
        preserveValidated: true,
        reduceWaitingTime: true,
        issueTypes: optimizationIssueTypes
      }
    }
  ]
  const optimizationSettings = {
    profile: typeof validationOptimizationSettings?.profile === "string"
      ? validationOptimizationSettings.profile
      : "corrections",
    mode: validationOptimizationSettings?.mode === "expanded" ? "expanded" : "strict",
    maxSwaps: Number.isInteger(Number(validationOptimizationSettings?.maxSwaps))
      ? Number(validationOptimizationSettings.maxSwaps)
      : 3,
    sameSiteOnly: validationOptimizationSettings?.sameSiteOnly !== false,
    preserveValidated: validationOptimizationSettings?.preserveValidated !== false,
    reduceWaitingTime: validationOptimizationSettings?.reduceWaitingTime === true,
    issueTypes: Array.isArray(validationOptimizationSettings?.issueTypes)
      ? validationOptimizationSettings.issueTypes
      : optimizationIssueTypes
  }
  const optimizationIssueTypeOptions = [
    { id: "person_overlap", label: "Personnes" },
    { id: "consecutive_limit", label: "Séquences" },
    { id: "room_class_mismatch", label: "Salles" }
  ]
  const optimizationProposal = validationOptimizationProposal || null
  const optimizationCanApply = Boolean(optimizationProposal?.changed) && typeof onApplyValidationOptimization === "function"
  const optimizationSwapCount = Number(optimizationProposal?.swapCount || 0)
  const optimizationApplyButtonLabel = optimizationCanApply
    ? `Appliquer ${optimizationSwapCount} échange${optimizationSwapCount > 1 ? "s" : ""}`
    : hasValidationForCurrentYear
      ? "Aucune proposition"
      : validationLabel
  const optimizationTargetCount = Array.isArray(optimizationProposal?.targetReferences)
    ? optimizationProposal.targetReferences.length
    : 0
  const optimizationBefore = optimizationProposal?.before || {}
  const optimizationAfter = optimizationProposal?.after || {}
  const optimizationSummaryItems = []

  if (Number(optimizationBefore.personOverlapCount || 0) !== Number(optimizationAfter.personOverlapCount || 0)) {
    optimizationSummaryItems.push(`${Number(optimizationBefore.personOverlapCount || 0)}→${Number(optimizationAfter.personOverlapCount || 0)} conflits personne`)
  }

  if (Number(optimizationBefore.sequenceExcessCount || 0) !== Number(optimizationAfter.sequenceExcessCount || 0)) {
    optimizationSummaryItems.push(`${Number(optimizationBefore.sequenceExcessCount || 0)}→${Number(optimizationAfter.sequenceExcessCount || 0)} surcharge séquence`)
  }

  if (Number(optimizationBefore.classMismatchCount || 0) !== Number(optimizationAfter.classMismatchCount || 0)) {
    optimizationSummaryItems.push(`${Number(optimizationBefore.classMismatchCount || 0)}→${Number(optimizationAfter.classMismatchCount || 0)} incompatibilités salle`)
  }

  if (Number(optimizationBefore.waitingGapCount || 0) !== Number(optimizationAfter.waitingGapCount || 0)) {
    optimizationSummaryItems.push(`${Number(optimizationBefore.waitingGapCount || 0)}→${Number(optimizationAfter.waitingGapCount || 0)} créneau(x) d'attente`)
  }

  if (Number(optimizationBefore.offMealBreakCount || 0) !== Number(optimizationAfter.offMealBreakCount || 0)) {
    optimizationSummaryItems.push(`${Number(optimizationBefore.offMealBreakCount || 0)}→${Number(optimizationAfter.offMealBreakCount || 0)} pause(s) hors repas`)
  }

  const shouldShowOptimizationPanel = hasValidationForCurrentYear

  const updateOptimizationSettings = (patch) => {
    if (typeof onValidationOptimizationSettingsChange === "function") {
      onValidationOptimizationSettingsChange({
        ...optimizationSettings,
        profile: Object.prototype.hasOwnProperty.call(patch, "profile")
          ? patch.profile
          : "custom",
        ...patch
      })
    }
  }

  const applyOptimizationProfile = (profile) => {
    updateOptimizationSettings(profile.settings)
  }

  const toggleOptimizationIssueType = (issueType) => {
    const currentTypes = new Set(optimizationSettings.issueTypes)

    if (currentTypes.has(issueType) && currentTypes.size > 1) {
      currentTypes.delete(issueType)
    } else {
      currentTypes.add(issueType)
    }

    updateOptimizationSettings({ issueTypes: Array.from(currentTypes) })
  }

  const formatOptimizationSlot = (slot) => {
    if (slot?.isEmpty) {
      return [slot?.roomName, slot?.period ? `slot ${slot.period}` : ""]
        .filter(Boolean)
        .join(" · ") || "slot vide"
    }

    return [
      slot?.reference || "TPI",
      slot?.roomName,
      slot?.period ? `slot ${slot.period}` : ""
    ].filter(Boolean).join(" · ")
  }

  const validationTooltip = isValidationSuccessful
    ? `Vérification ${effectiveYear} déjà effectuée${validationCheckedAtLabel ? ` le ${validationCheckedAtLabel}` : ""}.`
    : hasValidationForCurrentYear && validationIssueCount > 0
      ? `Vérification ${effectiveYear} terminée: ${validationIssueCount} erreur(s) détectée(s)${validationIssueDetailText}.`
      : hasValidationForCurrentYear && validationWarningCount > 0
        ? `Vérification ${effectiveYear} terminée: ${validationWarningCount} avertissement(s) de contrainte indiqué(s) sur les cartes.`
      : hasLocalConflictCount
        ? `${localConflictCount} conflit(s) détecté(s) dans la planification locale. Lance la vérification pour obtenir le détail et préparer les optimisations proposées.`
        : "Vérifier l'unicité par créneau, la séquence des TPI et les déplacements avant le snapshot."
  const workflowBadge = validationIssueCount > 0
    ? String(validationIssueCount)
    : validationWarningCount > 0
      ? String(validationWarningCount)
    : hasLocalConflictCount
      ? String(localConflictCount)
      : ""
  const totalTpiBadge = Number.isInteger(Number(totalTpiCount)) && Number(totalTpiCount) > 0
    ? String(totalTpiCount)
    : ""
  const hasTpiSyncCount = Number.isInteger(Number(tpiSyncCount))
  const normalizedTpiSyncCount = hasTpiSyncCount ? Number(tpiSyncCount) : null
  const syncTpiLabel = isTpiSyncRefreshing
    ? "Sync (...)"
    : `Sync (${normalizedTpiSyncCount ?? "..."})`
  const syncAllTpiLabel = normalizedTpiSyncCount > 0
    ? `Sync tout (${normalizedTpiSyncCount})`
    : "Sync tout"

  const workflowTabs = useMemo(() => ([
    {
      id: "preparation",
      label: "Préparation",
      state: "planning",
      icon: WrenchIcon
    },
    {
      id: "optimization",
      label: "Optimisation",
      icon: WrenchIcon
    },
    {
      id: "vote",
      label: "Vote",
      state: "voting_open",
      icon: VoteIcon
    },
    {
      id: "finalisation",
      label: "Finalisation",
      state: "published",
      icon: CheckIcon
    },
    {
      id: "phases",
      label: "Phases",
      icon: PencilIcon
    },
    {
      id: "static-publication",
      label: "Page statique",
      icon: DownloadIcon
    }
  ]), [])

  const staticPublicationGeneratedAt = staticPublicationInfo?.generatedAt
    ? new Date(staticPublicationInfo.generatedAt)
    : null
  const staticPublicationGeneratedAtLabel =
    staticPublicationGeneratedAt && !Number.isNaN(staticPublicationGeneratedAt.getTime())
      ? staticPublicationGeneratedAt.toLocaleString("fr-CH")
      : ""
  const staticPublicationAvailable = staticPublicationInfo?.available === true
  const staticPublicationPublishedAt = staticPublicationInfo?.publishedAt
    ? new Date(staticPublicationInfo.publishedAt)
    : null
  const staticPublicationPublishedAtLabel =
    staticPublicationPublishedAt && !Number.isNaN(staticPublicationPublishedAt.getTime())
      ? staticPublicationPublishedAt.toLocaleString("fr-CH")
      : ""
  const staticPublicationLastPublishAt = staticPublicationInfo?.lastPublishAt
    ? new Date(staticPublicationInfo.lastPublishAt)
    : null
  const staticPublicationLastPublishAtLabel =
    staticPublicationLastPublishAt && !Number.isNaN(staticPublicationLastPublishAt.getTime())
      ? staticPublicationLastPublishAt.toLocaleString("fr-CH")
      : ""
  const staticPublicationLastPublishStatus = String(staticPublicationInfo?.lastPublishStatus || "")
  const staticPublicationLastPublishMessage = typeof staticPublicationInfo?.lastPublishMessage === "string"
    ? staticPublicationInfo.lastPublishMessage.trim()
    : ""
  const canPreviewStaticPublication = staticPublicationAvailable && typeof onPreviewStaticPublication === "function"
  const canPublishStaticPublication = staticPublicationAvailable && typeof onPublishStaticPublication === "function"
  const staticPublicationStatusTone = isActionRunning("staticPublish")
    ? "pending"
    : staticPublicationLastPublishStatus === "error"
      ? "error"
      : staticPublicationPublishedAtLabel || staticPublicationLastPublishStatus === "success"
        ? "success"
        : staticPublicationAvailable
          ? "ready"
          : "idle"
  const staticPublicationStatusItems = []

  if (isActionRunning("staticGenerate")) {
    staticPublicationStatusItems.push("Génération locale en cours...")
  } else if (staticPublicationGeneratedAtLabel) {
    staticPublicationStatusItems.push(`Dernière génération: ${staticPublicationGeneratedAtLabel}`)
  } else if (staticPublicationInfo) {
    staticPublicationStatusItems.push("Aucune génération locale disponible.")
  } else {
    staticPublicationStatusItems.push("Statut local non chargé.")
  }

  if (isActionRunning("staticPublish")) {
    staticPublicationStatusItems.push("Publication FTP en cours...")
  } else if (staticPublicationLastPublishStatus === "error") {
    const failedAt = staticPublicationLastPublishAtLabel
      ? ` (${staticPublicationLastPublishAtLabel})`
      : ""
    const errorMessage = staticPublicationLastPublishMessage || "erreur inconnue"
    staticPublicationStatusItems.push(`Publication FTP échouée${failedAt}: ${errorMessage}`)

    if (staticPublicationPublishedAtLabel) {
      staticPublicationStatusItems.push(`Dernière réussite FTP: ${staticPublicationPublishedAtLabel}`)
    }
  } else if (staticPublicationPublishedAtLabel) {
    staticPublicationStatusItems.push(`Publication FTP réussie: ${staticPublicationPublishedAtLabel}`)
  } else if (staticPublicationLastPublishStatus === "success" && staticPublicationLastPublishAtLabel) {
    staticPublicationStatusItems.push(`Publication FTP réussie: ${staticPublicationLastPublishAtLabel}`)
  } else if (staticPublicationAvailable) {
    staticPublicationStatusItems.push("Publication FTP: en attente.")
  }

  if (staticPublicationAvailable && staticPublicationPublicUrl) {
    const urlLabel = staticPublicationPublishedAtLabel || staticPublicationLastPublishStatus === "success"
      ? "URL publique"
      : "URL cible"
    staticPublicationStatusItems.push(`${urlLabel}: ${staticPublicationPublicUrl}`)
  }
  const staticPublicationStatusSummary = isActionRunning("staticGenerate")
    ? "Génération..."
    : isActionRunning("staticPublish")
      ? "Publication..."
      : staticPublicationLastPublishStatus === "error"
        ? "FTP échoué"
        : staticPublicationPublishedAtLabel || staticPublicationLastPublishStatus === "success"
          ? "Publié"
          : staticPublicationAvailable
            ? "Prêt FTP"
            : "À générer"

  const staticVotePublicationGeneratedAt = staticVotePublicationInfo?.generatedAt
    ? new Date(staticVotePublicationInfo.generatedAt)
    : null
  const staticVotePublicationGeneratedAtLabel =
    staticVotePublicationGeneratedAt && !Number.isNaN(staticVotePublicationGeneratedAt.getTime())
      ? staticVotePublicationGeneratedAt.toLocaleString("fr-CH")
      : ""
  const staticVotePublicationAvailable = staticVotePublicationInfo?.available === true
  const staticVotePublicationPublishedAt = staticVotePublicationInfo?.publishedAt
    ? new Date(staticVotePublicationInfo.publishedAt)
    : null
  const staticVotePublicationPublishedAtLabel =
    staticVotePublicationPublishedAt && !Number.isNaN(staticVotePublicationPublishedAt.getTime())
      ? staticVotePublicationPublishedAt.toLocaleString("fr-CH")
      : ""
  const staticVotePublicationLastPublishAt = staticVotePublicationInfo?.lastPublishAt
    ? new Date(staticVotePublicationInfo.lastPublishAt)
    : null
  const staticVotePublicationLastPublishAtLabel =
    staticVotePublicationLastPublishAt && !Number.isNaN(staticVotePublicationLastPublishAt.getTime())
      ? staticVotePublicationLastPublishAt.toLocaleString("fr-CH")
      : ""
  const staticVotePublicationLastSyncAt = staticVotePublicationInfo?.lastSyncAt
    ? new Date(staticVotePublicationInfo.lastSyncAt)
    : null
  const staticVotePublicationLastSyncAtLabel =
    staticVotePublicationLastSyncAt && !Number.isNaN(staticVotePublicationLastSyncAt.getTime())
      ? staticVotePublicationLastSyncAt.toLocaleString("fr-CH")
      : ""
  const staticVotePublicationLastPublishStatus = String(staticVotePublicationInfo?.lastPublishStatus || "")
  const staticVotePublicationLastPublishMessage = typeof staticVotePublicationInfo?.lastPublishMessage === "string"
    ? staticVotePublicationInfo.lastPublishMessage.trim()
    : ""
  const staticVotePublicationLastSyncStatus = String(staticVotePublicationInfo?.lastSyncStatus || "")
  const staticVotePublicationLastSyncMessage = typeof staticVotePublicationInfo?.lastSyncMessage === "string"
    ? staticVotePublicationInfo.lastSyncMessage.trim()
    : ""
  const staticVotePublicationLastSyncImportedCount = Number(staticVotePublicationInfo?.lastSyncImportedCount || 0)
  const staticVotePublicationLastSyncReceivedCount = Number(staticVotePublicationInfo?.lastSyncReceivedCount || 0)
  const staticVotePublicationLastSyncFailedCount = Number(staticVotePublicationInfo?.lastSyncFailedCount || 0)
  const staticVoteSyncSecretConfigured = staticVotePublicationInfo?.syncSecretConfigured === true
  const staticVoteSiteSyncSecretConfigured = staticVotePublicationInfo?.siteSyncSecretConfigured === true
  const canPublishStaticVotePublication =
    staticVotePublicationAvailable && typeof onPublishStaticVotePublication === "function"
  const canSyncStaticVotePublication =
    staticVoteSyncSecretConfigured && typeof onSyncStaticVotePublication === "function"
  const canOpenStaticVoteAccessPreview = typeof onOpenVoteAccessPreview === "function"
  const staticVotePublicationStatusTone = isActionRunning("staticVoteGenerate") || isActionRunning("staticVotePublish") || isActionRunning("staticVoteSync")
    ? "pending"
    : staticVotePublicationLastPublishStatus === "error" || staticVotePublicationLastSyncStatus === "error"
      ? "error"
      : staticVotePublicationPublishedAtLabel || staticVotePublicationLastPublishStatus === "success" || staticVotePublicationLastSyncStatus === "success"
        ? "success"
        : staticVotePublicationAvailable
          ? "ready"
          : "idle"
  const staticVotePublicationStatusItems = []

  if (isActionRunning("staticVoteGenerate")) {
    staticVotePublicationStatusItems.push("Génération locale vote en cours...")
  } else if (staticVotePublicationGeneratedAtLabel) {
    staticVotePublicationStatusItems.push(`Dernière génération vote: ${staticVotePublicationGeneratedAtLabel}`)
  } else if (staticVotePublicationInfo) {
    staticVotePublicationStatusItems.push("Aucune génération vote locale disponible.")
  } else {
    staticVotePublicationStatusItems.push("Statut vote non chargé.")
  }

  if (isActionRunning("staticVotePublish")) {
    staticVotePublicationStatusItems.push("Publication FTP vote en cours...")
  } else if (staticVotePublicationLastPublishStatus === "error") {
    const failedAt = staticVotePublicationLastPublishAtLabel
      ? ` (${staticVotePublicationLastPublishAtLabel})`
      : ""
    const errorMessage = staticVotePublicationLastPublishMessage || "erreur inconnue"
    staticVotePublicationStatusItems.push(`Publication FTP vote échouée${failedAt}: ${errorMessage}`)

    if (staticVotePublicationPublishedAtLabel) {
      staticVotePublicationStatusItems.push(`Dernière réussite FTP vote: ${staticVotePublicationPublishedAtLabel}`)
    }
  } else if (staticVotePublicationPublishedAtLabel) {
    staticVotePublicationStatusItems.push(`Publication FTP vote réussie: ${staticVotePublicationPublishedAtLabel}`)
  } else if (staticVotePublicationLastPublishStatus === "success" && staticVotePublicationLastPublishAtLabel) {
    staticVotePublicationStatusItems.push(`Publication FTP vote réussie: ${staticVotePublicationLastPublishAtLabel}`)
  } else if (staticVotePublicationAvailable) {
    staticVotePublicationStatusItems.push("Publication FTP vote: en attente.")
  }

  if (isActionRunning("staticVoteSync")) {
    staticVotePublicationStatusItems.push("Synchronisation votes web en cours...")
  } else if (staticVotePublicationLastSyncAtLabel) {
    const syncPrefix = staticVotePublicationLastSyncStatus === "error"
      ? "Synchronisation vote échouée"
      : "Dernière synchronisation vote"
    const syncSummary = staticVotePublicationLastSyncReceivedCount > 0 || staticVotePublicationLastSyncImportedCount > 0 || staticVotePublicationLastSyncFailedCount > 0
      ? `: ${staticVotePublicationLastSyncImportedCount}/${staticVotePublicationLastSyncReceivedCount} importé(s), ${staticVotePublicationLastSyncFailedCount} erreur(s)`
      : ""
    const syncMessage = staticVotePublicationLastSyncMessage
      ? ` - ${staticVotePublicationLastSyncMessage}`
      : ""
    staticVotePublicationStatusItems.push(`${syncPrefix}: ${staticVotePublicationLastSyncAtLabel}${syncSummary}${syncMessage}`)
  }

  if (staticVotePublicationInfo) {
    staticVotePublicationStatusItems.push(
      staticVoteSyncSecretConfigured
        ? "Secret sync local configuré."
        : "Secret sync local manquant."
    )

    if (staticVoteSiteSyncSecretConfigured) {
      staticVotePublicationStatusItems.push("Secret sync inclus dans le site généré.")
    }
  }

  if (staticVotePublicationAvailable && staticVotePublicationPublicUrl) {
    const urlLabel = staticVotePublicationPublishedAtLabel || staticVotePublicationLastPublishStatus === "success"
      ? "URL vote publique"
      : "URL vote cible"
    staticVotePublicationStatusItems.push(`${urlLabel}: ${staticVotePublicationPublicUrl}`)
  }
  const staticVotePublicationStatusSummary = isActionRunning("staticVoteGenerate")
    ? "Génération..."
    : isActionRunning("staticVotePublish")
      ? "Publication..."
      : isActionRunning("staticVoteSync")
        ? "Sync..."
        : staticVotePublicationLastPublishStatus === "error"
          ? "FTP échoué"
          : staticVotePublicationLastSyncStatus === "error"
            ? "Sync échouée"
            : staticVotePublicationLastSyncStatus === "success"
              ? "Sync OK"
              : staticVotePublicationPublishedAtLabel || staticVotePublicationLastPublishStatus === "success"
                ? "Publié"
                : staticVotePublicationAvailable
                  ? "Prêt FTP"
                  : "À générer"

  const toolbarTabs = useMemo(() => [
    {
      id: "data",
      label: "Données",
      badge: totalTpiBadge
    },
    {
      id: "rooms",
      label: "Salles",
      badge: Number.isInteger(Number(roomsCount)) && Number(roomsCount) > 0
        ? String(roomsCount)
        : ""
    },
    {
      id: "workflow",
      label: "Workflow",
      badge: workflowBadge
    }
  ], [roomsCount, totalTpiBadge, workflowBadge])

  const navigationLinks = useMemo(() => {
    if (location.pathname === "/planification") {
      return MAIN_NAVIGATION_LINKS.filter((link) => link.to !== "/planification")
    }

    return MAIN_NAVIGATION_LINKS
  }, [location.pathname])

  const cardDetailOptions = useMemo(() => [
    {
      level: 0,
      label: "0",
      title: "Identifiants des parties prenantes sur une ligne",
      description: "IDs PP"
    },
    {
      level: 1,
      label: "1",
      title: "Nom du candidat uniquement",
      description: "Candidat seul"
    },
    {
      level: 2,
      label: "2",
      title: "Candidat, experts et chef de projet",
      description: "Équipe"
    },
    {
      level: 3,
      label: "3",
      title: "Tous les détails disponibles",
      description: "Complet"
    }
  ], [])

  const normalizedRoomSiteOptions = useMemo(() => {
    const options = Array.isArray(roomSiteOptions) ? roomSiteOptions : []
    return Array.from(new Set(options.map((site) => String(site || "").trim()).filter(Boolean)))
      .sort((left, right) => left.localeCompare(right))
  }, [roomSiteOptions])

  const normalizedRoomDateOptions = useMemo(() => {
    const options = Array.isArray(roomDateOptions) ? roomDateOptions : []
    const optionsByValue = new Map()

    options.forEach((option) => {
      const rawValue = option && typeof option === "object"
        ? String(option.value || "").trim()
        : String(option || "").trim()

      const value = normalizeSoutenanceDateValue(rawValue) || rawValue
      if (!value || optionsByValue.has(value)) {
        return
      }

      const rawLabel = option && typeof option === "object"
        ? String(option.label || option.value || "").trim()
        : rawValue

      optionsByValue.set(value, {
        value,
        label: rawLabel || value
      })
    })

    return Array.from(optionsByValue.values())
  }, [roomDateOptions])

  const selectedRoomDateFilters = useMemo(() => {
    return normalizeRoomDateFilterValues([
      ...(Array.isArray(roomFilters?.date) ? roomFilters.date : [roomFilters?.date]),
      ...(Array.isArray(roomFilters?.dates) ? roomFilters.dates : [roomFilters?.dates])
    ])
  }, [roomFilters?.date, roomFilters?.dates])

  const selectedRoomDateFilterSet = useMemo(() => {
    return new Set(selectedRoomDateFilters)
  }, [selectedRoomDateFilters])
  const selectedRoomDateFilterLabels = useMemo(() => {
    const labelsByValue = new Map(normalizedRoomDateOptions.map((option) => [option.value, option.label]))

    return selectedRoomDateFilters.map((value) => labelsByValue.get(value) || value)
  }, [normalizedRoomDateOptions, selectedRoomDateFilters])

  const normalizedRoomNameOptions = useMemo(() => {
    const options = Array.isArray(roomNameOptions) ? roomNameOptions : []

    return options
      .map((option) => {
        if (option && typeof option === "object") {
          return {
            value: String(option.value || "").trim(),
            label: String(option.label || option.value || "").trim()
          }
        }

        const value = String(option || "").trim()
        return {
          value,
          label: value
        }
      })
      .filter((option) => Boolean(option.value))
      .sort((left, right) => left.label.localeCompare(right.label))
  }, [roomNameOptions])

  const normalizedRoomCatalogBySite = useMemo(() => {
    const source = roomCatalogBySite && typeof roomCatalogBySite === "object" ? roomCatalogBySite : {}
    const siteKeys = Array.from(
      new Set(
        Object.keys(source || {})
          .map((site) => String(site || "").trim().toUpperCase())
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right))

    return siteKeys.reduce((acc, site) => {
      const rooms = Array.isArray(source[site]) ? source[site] : []
      acc[site] = Array.from(
        new Set(rooms.map((room) => String(room || "").trim()).filter(Boolean))
      ).sort((left, right) => left.localeCompare(right))
      return acc
    }, {})
  }, [roomCatalogBySite])

  const roomCatalogSiteOptions = useMemo(() => {
    return Object.keys(normalizedRoomCatalogBySite).sort((left, right) => left.localeCompare(right))
  }, [normalizedRoomCatalogBySite])

  const normalizedSoutenanceDates = useMemo(() => {
    return normalizeSoutenanceDateEntries(soutenanceDates)
  }, [soutenanceDates])
  const hasActiveRoomFilters = Boolean(roomFilters?.site || selectedRoomDateFilters.length > 0 || roomFilters?.room)
  const activeRoomFilterCount = [
    roomFilters?.site,
    selectedRoomDateFilters.length > 0,
    roomFilters?.room
  ].filter(Boolean).length
  const roomDateFilterSummaryLabel = selectedRoomDateFilters.length > 0
    ? [
        compactRoomDateFilterLabel(selectedRoomDateFilterLabels[0]),
        selectedRoomDateFilters.length > 1 ? `+${selectedRoomDateFilters.length - 1}` : ""
      ].filter(Boolean).join(" ")
    : "Dates"
  const roomDateFilterTitle = selectedRoomDateFilterLabels.length > 0
    ? `Dates: ${selectedRoomDateFilterLabels.join(", ")}`
    : "Filtrer par date"

  const handleRoomDateFilterToggle = (dateValue) => {
    const value = normalizeRoomDateFilterValue(dateValue)
    if (!value || typeof onRoomFiltersChange !== "function") {
      return
    }

    const nextDateSet = new Set(selectedRoomDateFilters)
    if (nextDateSet.has(value)) {
      nextDateSet.delete(value)
    } else {
      nextDateSet.add(value)
    }

    const orderedDates = normalizedRoomDateOptions
      .map((option) => option.value)
      .filter((optionValue) => nextDateSet.has(optionValue))

    const remainingDates = Array.from(nextDateSet).filter((optionValue) => !orderedDates.includes(optionValue))
    onRoomFiltersChange({ date: [...orderedDates, ...remainingDates] })
  }

  const handleClearRoomDateFilters = () => {
    if (typeof onRoomFiltersChange === "function") {
      onRoomFiltersChange({ date: [] })
    }
  }

  const handleToggleRoomsFocusMode = () => {
    if (!isRoomsFocusMode) {
      setActiveToolTab("rooms")
    }

    if (typeof onToggleRoomsFocusMode === "function") {
      onToggleRoomsFocusMode()
    }
  }

  const handleToggleRoomsWrapMode = () => {
    if (typeof onToggleRoomsWrapMode === "function") {
      onToggleRoomsWrapMode()
    }
  }

  const planningHeaderPortal = !isRoomsFocusMode && planningHeaderSlot
    ? createPortal(
        <div className="app-header-planification-slot">
          {typeof onRoomFiltersChange === "function" ? (
            <details
              ref={roomFilterMenuRef}
              className={`app-header-planification-filter-menu ${hasActiveRoomFilters ? "is-active" : ""}`.trim()}
            >
              <summary
                aria-label={
                  hasActiveRoomFilters
                    ? `${activeRoomFilterCount} filtre${activeRoomFilterCount > 1 ? "s" : ""} actif${activeRoomFilterCount > 1 ? "s" : ""}`
                    : "Filtres de planification"
                }
                title="Filtrer site, date ou salle"
              >
                <SearchIcon className="app-header-planification-filter-icon" />
                {activeRoomFilterCount > 0 ? (
                  <span className="app-header-planification-filter-count">
                    {activeRoomFilterCount}
                  </span>
                ) : null}
              </summary>
              <div className="app-header-planification-filter-panel">
                <div className="app-header-planification-filter-head">
                  <div className="app-header-planification-filter-head-actions">
                    <span
                      className="app-header-planification-filter-status"
                      role="status"
                      title={`${roomsCount}/${totalRoomsCount} salles`}
                    >
                      {roomsCount}/{totalRoomsCount}
                    </span>
                    <button
                      type="button"
                      className="app-header-planification-filter-reset"
                      onClick={() => onClearRoomFilters?.()}
                      disabled={!hasActiveRoomFilters}
                      aria-label="Réinitialiser les filtres"
                      title="Réinitialiser les filtres"
                    >
                      <RefreshIcon />
                    </button>
                  </div>
                </div>

                <label className="app-header-planification-filter-field">
                  <select
                    className="app-header-planification-filter-control"
                    value={roomFilters?.site || ""}
                    onChange={(event) => onRoomFiltersChange({ site: event.target.value })}
                    aria-label="Filtrer par site"
                  >
                    <option value="">Site</option>
                    {normalizedRoomSiteOptions.map((site) => (
                      <option key={site} value={site}>
                        {site}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="app-header-planification-filter-field">
                  <details ref={roomDateFilterRef} className="app-header-planification-date-filter">
                    <summary
                      aria-label="Filtrer par date"
                      title={roomDateFilterTitle}
                    >
                      {roomDateFilterSummaryLabel}
                    </summary>
                    <div className="app-header-planification-date-options" role="group" aria-label="Dates">
                      {selectedRoomDateFilters.length > 0 ? (
                        <div className="app-header-planification-date-options-head">
                          <button
                            type="button"
                            onClick={handleClearRoomDateFilters}
                          >
                            Effacer
                          </button>
                        </div>
                      ) : null}
                      {normalizedRoomDateOptions.length === 0 ? (
                        <span className="app-header-planification-date-empty">Aucune</span>
                      ) : normalizedRoomDateOptions.map((option) => {
                        const isSelected = selectedRoomDateFilterSet.has(option.value)

                        return (
                          <label
                            key={option.value}
                            className={`app-header-planification-date-option ${isSelected ? "is-selected" : ""}`.trim()}
                          >
                            <input
                              type="checkbox"
                              value={option.value}
                              checked={isSelected}
                              onChange={() => handleRoomDateFilterToggle(option.value)}
                            />
                            <span>{option.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </details>
                </div>

                <label className="app-header-planification-filter-field">
                  <select
                    className="app-header-planification-filter-control"
                    value={roomFilters?.room || ""}
                    onChange={(event) => onRoomFiltersChange({ room: event.target.value })}
                    aria-label="Filtrer par salle"
                  >
                    <option value="">Salle</option>
                    {normalizedRoomNameOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

              </div>
            </details>
          ) : null}
          {typeof onToggleRoomsWrapMode === "function" ? (
            <button
              type="button"
              className={`page-tools-action-btn secondary planning-room-wrap-toggle app-header-planification-wrap-toggle ${isRoomsWrapMode ? "active" : ""}`.trim()}
              onClick={handleToggleRoomsWrapMode}
              aria-pressed={isRoomsWrapMode}
              aria-label={isRoomsWrapMode ? "Désactiver le retour à la ligne" : "Activer le retour à la ligne"}
              title={isRoomsWrapMode ? "Désactiver le retour à la ligne" : "Afficher les salles sur plusieurs lignes"}
              data-testid="planning-room-wrap-toggle"
            >
              <span className="planning-room-wrap-toggle-icon" aria-hidden="true">
                <WrapIcon />
              </span>
            </button>
          ) : null}
          {typeof onToggleRoomsFocusMode === "function" ? (
            <button
              type="button"
              className={`page-tools-action-btn secondary planning-room-focus-toggle app-header-planification-focus-toggle ${isRoomsFocusMode ? "active" : ""}`.trim()}
              onClick={handleToggleRoomsFocusMode}
              aria-pressed={isRoomsFocusMode}
              aria-label={isRoomsFocusMode ? "Quitter le plein écran focus" : "Activer le plein écran focus"}
              title={isRoomsFocusMode ? "Quitter le plein écran focus" : "Afficher uniquement les salles en plein écran"}
              data-testid="planning-room-focus-toggle"
            >
              <span className="planning-room-focus-toggle-icon" aria-hidden="true">
                {isRoomsFocusMode ? <CollapseIcon /> : <ExpandIcon />}
              </span>
            </button>
          ) : null}
          <details className="app-header-planification-legend-menu">
            <summary
              aria-label="Légende des couleurs de vérification"
              title="Légende des couleurs de vérification"
            >
              <QuestionIcon />
            </summary>
            <div className="app-header-planification-legend-panel" role="list">
              <span className="app-header-planification-legend-item" role="listitem">
                <i className="validation-color-swatch validation-color-swatch--danger" aria-hidden="true" />
                <b>Rouge</b>
                <em>même créneau</em>
              </span>
              <span className="app-header-planification-legend-item" role="listitem">
                <i className="validation-color-swatch validation-color-swatch--sequence" aria-hidden="true" />
                <b>Orange</b>
                <em>TPI consécutifs</em>
              </span>
              <span className="app-header-planification-legend-item" role="listitem">
                <i className="validation-color-swatch validation-color-swatch--room" aria-hidden="true" />
                <b>Bleu</b>
                <em>salle/type</em>
              </span>
              <span className="app-header-planification-legend-item" role="listitem">
                <i className="validation-color-swatch validation-color-swatch--import" aria-hidden="true" />
                <b>Gris</b>
                <em>import/planif.</em>
              </span>
            </div>
          </details>
          <span className="app-header-planification-snapshot">
            Snapshot : {hasSnapshot ? `v${activeSnapshotVersion}` : "—"}
          </span>
          <span className="app-header-planification-year">
            Année {effectiveYear}
          </span>
        </div>,
        planningHeaderSlot
      )
    : null

  const handleToggleEditing = () => {
    setIsEditing((prev) => !prev)
    if (onToggleEditing) {
      onToggleEditing()
    }
  }

  const handleDeleteAllRooms = () => {
    if (typeof onDeleteAllRooms !== "function") {
      return
    }

    const didDelete = onDeleteAllRooms()
    if (didDelete !== false) {
      setIsEditing(false)
    }
  }

  const handleFileLoad = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result
      if (content && onLoadConfig) {
        onLoadConfig(content)
      }
    }
    reader.readAsText(file)

    // Reset pour permettre de recharger le même fichier
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <>
      {planningHeaderPortal}

      {!isRoomsFocusMode ? (
        <PageToolbar
          id="tools"
          className="planning-tools"
          flatHeader
          title={`Planification ${effectiveYear}`}
          description="Données, salles, workflow."
          tabs={toolbarTabs}
          activeTab={activeToolTab}
          onTabChange={setActiveToolTab}
          tabListLabel="Sections de planification"
          tabsClassName="planning-tools-tabs"
          navigationLinks={navigationLinks}
          toggleArrow={toggleArrow}
          isArrowUp={isArrowUp}
          ariaLabel="Outils de planification"
          bodyClassName="planning-tools-body"
        >
      {activeToolTab === "data" ? (
        <section className="planning-tools-panel planning-tools-panel-data">
          <div className="planning-tools-button-row planning-tools-button-grid">
            <button
              type="button"
              className={`page-tools-action-btn secondary icon-button ${
                isEditing || hasTpiUsageCount ? "icon-button--with-badge" : ""
              } ${isEditing ? "active-edit" : ""}`.trim()}
              onClick={handleToggleEditing}
              aria-label={editButtonLabel}
              title={
                hasTpiUsageCount
                  ? `Activer ou désactiver l'édition des cartes et des salles. ${usedTpiCount}/${totalTpiCount} TPI utilisés.`
                  : "Activer ou désactiver l'édition des cartes et des salles."
              }
            >
              <IconButtonContent
                label={editButtonLabel}
                icon={DataEditIcon}
                iconClassName="planning-button-icon"
                badge={isEditing && hasTpiUsageCount ? `${usedTpiCount}/${totalTpiCount}` : null}
                badgeClassName="ui-button-badge planning-edit-toggle-count"
              />
            </button>

            {isEditing ? (
              <button
                type="button"
                className="planning-data-btn delete-all icon-button"
                onClick={handleDeleteAllRooms}
                aria-label="Supprimer tout"
                title={
                  deleteAllRoomsCount > 0
                    ? `Supprimer toutes les salles de la planification (${deleteAllRoomsCount}).`
                    : "Aucune salle à supprimer."
                }
                disabled={!onDeleteAllRooms || deleteAllRoomsCount <= 0}
              >
                <IconButtonContent
                  label="Supprimer tout"
                  icon={TrashIcon}
                  iconClassName="planning-button-icon"
                />
              </button>
            ) : null}

            <button
              type="button"
              className={`planning-data-btn sync icon-button icon-button--with-badge ${
                normalizedTpiSyncCount > 0 ? "has-sync" : ""
              }`.trim()}
              onClick={onRefreshTpiSyncStatus}
              aria-label={syncTpiLabel}
              title={
                normalizedTpiSyncCount > 0
                  ? `${normalizedTpiSyncCount} TPI planifié(s) diffèrent de GestionTPI. Ce bouton recalcule uniquement le compteur.`
                  : "Recalculer les différences entre GestionTPI et la planification sans modifier les slots."
              }
              disabled={isTpiSyncRefreshing || typeof onRefreshTpiSyncStatus !== "function"}
            >
              <IconButtonContent
                label={syncTpiLabel}
                icon={RefreshIcon}
                showLabel
                iconClassName="planning-button-icon"
              />
            </button>

            {normalizedTpiSyncCount > 0 ? (
              <button
                type="button"
                className="planning-data-btn sync-all icon-button icon-button--with-badge"
                onClick={onSyncAllTpisFromGestion}
                aria-label={syncAllTpiLabel}
                title={`Mettre à jour les ${normalizedTpiSyncCount} TPI détectés dans la planification.`}
                disabled={isTpiSyncRefreshing || typeof onSyncAllTpisFromGestion !== "function"}
              >
                <IconButtonContent
                  label={syncAllTpiLabel}
                  icon={CheckIcon}
                  showLabel
                  iconClassName="planning-button-icon"
                />
              </button>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              id="planning-file-input"
              data-testid="planning-file-input"
              accept=".json"
              style={{ display: "none" }}
              onChange={handleFileLoad}
            />
            <label
              htmlFor="planning-file-input"
              className="planning-tools-file-label icon-button"
              title="Importer un fichier JSON de configuration (salles et TPI)."
            >
              <IconButtonContent
                label="Importer JSON"
                icon={JsonImportIcon}
                iconClassName="planning-button-icon"
              />
            </label>

            <button
              type="button"
              className="planning-data-btn save icon-button"
              onClick={onSave}
              aria-label="Sauvegarder localement"
              title="Enregistrer la configuration courante dans le navigateur."
            >
              <IconButtonContent
                label="Sauvegarder localement"
                icon={LocalSaveIcon}
                iconClassName="planning-button-icon"
              />
            </button>

            <button
              type="button"
              className="planning-data-btn export icon-button"
              onClick={onExport}
              aria-label="Exporter JSON"
              title="Télécharger une sauvegarde JSON de la configuration."
            >
              <IconButtonContent
                label="Exporter JSON"
                icon={JsonExportIcon}
                iconClassName="planning-button-icon"
              />
            </button>

            <button
              type="button"
              className="planning-data-btn fetch icon-button"
              onClick={() => onFetchConfig?.(effectiveYear)}
              aria-label="Charger BDD"
              title={`Recharger la configuration ${effectiveYear} depuis la base de données.`}
            >
              <IconButtonContent
                label="Charger BDD"
                icon={DatabaseLoadIcon}
                iconClassName="planning-button-icon"
              />
            </button>

            <button
              type="button"
              className="planning-data-btn transmit icon-button"
              onClick={onSendBD}
              aria-label="Envoyer BDD"
              title="Synchroniser la configuration courante vers la base de données."
            >
              <IconButtonContent
                label="Envoyer BDD"
                icon={DatabaseSendIcon}
                iconClassName="planning-button-icon"
              />
            </button>
          </div>
        </section>
      ) : null}

      {activeToolTab === "rooms" ? (
        <section className="planning-tools-panel planning-tools-panel-rooms">
          <div className="planning-tools-panel-head">
            <div className="planning-tools-panel-copy">
              <h4>Configuration</h4>
              <p>Dates, sites et salles.</p>
            </div>
            <div className="planning-room-form-head-actions">
              {typeof onTpiCardDetailLevelChange === "function" ? (
                <div
                  className="planning-room-density planning-room-density--header"
                  role="radiogroup"
                  aria-label="Niveau de détail des cartes TPI"
                >
                  <div className="planning-room-density-options">
                    {cardDetailOptions.map((option) => {
                      const isSelected = Number(tpiCardDetailLevel) === option.level

                      return (
                        <label
                          key={option.level}
                          className={`planning-room-density-option ${isSelected ? "active" : ""}`}
                          title={option.title}
                        >
                          <input
                            type="radio"
                            name="planning-tpi-card-detail-level"
                            value={option.level}
                            checked={isSelected}
                            onChange={() => onTpiCardDetailLevelChange(option.level)}
                            aria-label={option.title}
                          />
                          <span className="planning-room-density-value">{option.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              {typeof onShowNewRoomForm === "function" ? (
                <button
                  type="button"
                  className="page-tools-action-btn primary icon-button"
                  onClick={onShowNewRoomForm}
                  aria-label="Créer une room"
                  title="Créer une room manuellement"
                >
                  <IconButtonContent
                    label="Créer une room"
                    icon={RoomAddIcon}
                    iconClassName="planning-button-icon"
                  />
                </button>
              ) : null}
              {typeof onGenerateRoomsFromCatalog === "function" ? (
                <button
                  type="button"
                  className="page-tools-action-btn secondary icon-button"
                  onClick={onGenerateRoomsFromCatalog}
                  aria-label="Créer les rooms de la planification"
                  title="Créer les rooms de la planification"
                >
                  <IconButtonContent
                    label="Créer les rooms de la planification"
                    icon={RoomBatchAddIcon}
                    iconClassName="planning-button-icon"
                  />
                </button>
              ) : null}
              <Link
                to="/configuration"
                className="page-tools-action-btn primary icon-button"
                aria-label="Ouvrir Configuration"
                title="Ouvrir le module Configuration"
              >
                <IconButtonContent
                  label="Ouvrir Configuration"
                  icon={GearIcon}
                  iconClassName="planning-button-icon"
                />
              </Link>
            </div>
          </div>

          {showNewRoomForm && typeof onCreateRoom === "function" ? (
            <NewRoomForm
              onNewRoom={onCreateRoom}
              setShowForm={(nextValue) => {
                if (!nextValue) {
                  onCancelCreateRoom?.()
                }
              }}
              soutenanceDates={soutenanceDates}
              roomCatalogBySite={roomCatalogBySite}
              existingRooms={existingRooms}
              selectedYear={effectiveYear}
            />
          ) : null}

          <div className="planning-room-overview-grid">
            <article className="planning-room-overview-card">
              <div className="planning-room-overview-head">
                <h5>Dates</h5>
              </div>

              {normalizedSoutenanceDates.length > 0 ? (
                <div className="planning-room-dates-list planning-room-dates-list--compact">
                  {normalizedSoutenanceDates.map((date) => (
                    (() => {
                      const badgeLabel = getSoutenanceDateBadgeLabel(date)
                      const badgeTone = getSoutenanceDateBadgeTone(date)

                      return (
                        <span
                          key={date.date}
                          className="planning-room-date-chip planning-room-date-chip--compact"
                          aria-label={date.label}
                        >
                          <span>{date.label}</span>
                          {badgeLabel ? (
                            <span
                              className={`planning-room-date-chip-badge ${
                                badgeTone ? badgeTone : ""
                              }`.trim()}
                            >
                              {badgeLabel}
                            </span>
                          ) : null}
                        </span>
                      )
                    })()
                  ))}
                </div>
              ) : (
                <div className="planning-room-dates-empty">
                  Aucune date.
                </div>
              )}
            </article>

            <article className="planning-room-overview-card">
              <div className="planning-room-overview-head">
                <h5>Sites</h5>
              </div>

              {roomCatalogSiteOptions.length > 0 ? (
                <div className="planning-room-site-list">
                  {roomCatalogSiteOptions.map((site) => {
                    const roomNames = normalizedRoomCatalogBySite[site] || []
                    const siteLabel = String(site || "").trim().toUpperCase()

                    return (
                      <div key={site} className="planning-room-site-overview">
                        <div className="planning-room-site-overview-head">
                          <strong>{siteLabel}</strong>
                        </div>

                        {roomNames.length > 0 ? (
                          <div className="planning-room-dates-list planning-room-dates-list--compact">
                            {roomNames.map((roomName) => (
                              <span
                                key={`${site}-${roomName}`}
                                className="planning-room-date-chip planning-room-date-chip--compact"
                                aria-label={roomName}
                              >
                                <span>{roomName}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="planning-room-dates-empty">
                            Aucun nom.
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="planning-room-dates-empty">
                  Aucun site.
                </div>
              )}
            </article>
          </div>
        </section>
      ) : null}
      {activeToolTab === "workflow" ? (
        <section className="planning-tools-panel planning-tools-panel-workflow">
          {workflowActionLoading ? (
            <div className="planning-workflow-progress">
              Action en cours : {workflowActionLabels[pendingWorkflowAction] || pendingWorkflowAction || "workflow"}
            </div>
          ) : null}

          <div className="planning-workflow-topbar">
            <div
              className="planning-workflow-tabs page-tools-tabs"
              role="tablist"
              aria-label="Menus du pilotage"
            >
              {workflowTabs.map((tab) => {
                const isActive = activeWorkflowTab === tab.id

                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    className={`page-tools-tab ${isActive ? "active" : ""}`.trim()}
                    aria-selected={isActive}
                    aria-controls={`planning-workflow-panel-${tab.id}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveWorkflowTab(tab.id)}
                    title={tab.label}
                  >
                    {tab.icon ? (
                      <span className="page-tools-tab-icon" aria-hidden="true">
                        <tab.icon />
                      </span>
                    ) : null}
                    <span className="page-tools-tab-label">{tab.label}</span>
                  </button>
                )
              })}
            </div>

            <div
              className={`planning-workflow-stage ${
                activeWorkflowTab === "static-publication"
                  ? "planning-workflow-stage-static"
                  : activeWorkflowTab === "phases"
                    ? "planning-workflow-stage-phases"
                    : ""
              }`.trim()}
            >
              {activeWorkflowTab === "preparation" ? (
                <section
                  className="planning-workflow-section"
                  id="planning-workflow-panel-preparation"
                  role="tabpanel"
                >
                  <div className="planning-workflow-section-actions">
                    <button
                      type="button"
                      className="planning-workflow-btn primary"
                      onClick={onAutomatePlanification}
                      disabled={workflowActionLoading || !onAutomatePlanification}
                      title="Créer automatiquement les salles nécessaires et placer les TPI selon la configuration annuelle."
                      aria-label={automatePlanificationLabel}
                    >
                      <IconButtonContent
                        label={automatePlanificationLabel}
                        icon={WrenchIcon}
                        showLabel
                        iconClassName="planning-button-icon"
                      />
                    </button>

                    <button
                      type="button"
                      className={`planning-workflow-btn neutral ${
                        isValidationSuccessful ? "validated" : ""
                      }`.trim()}
                      onClick={onValidatePlanification}
                      disabled={workflowActionLoading || isValidationSuccessful}
                      title={validationTooltip}
                      aria-label={validationLabel}
                    >
                      <IconButtonContent
                        label={validationLabel}
                        icon={isValidationSuccessful ? CheckIcon : SearchIcon}
                        showLabel
                        iconClassName="planning-button-icon"
                      />
                    </button>

                    <button
                      type="button"
                      className="planning-workflow-btn primary"
                      onClick={onFreezeSnapshot}
                      disabled={workflowActionLoading || isAlreadyFrozen || nonImportableTpiCount > 0}
                      aria-label={freezeSnapshotLabel}
                      title={
                        nonImportableTpiCount > 0
                          ? "Corrige les TPI non importables avant de geler le snapshot."
                          : isAlreadyFrozen
                            ? `Snapshot v${activeSnapshotVersion} déjà gelé. Modifie une salle pour créer une nouvelle version.`
                            : "Figer la version planification à soumettre aux votes."
                      }
                    >
                      <IconButtonContent
                        label={freezeSnapshotLabel}
                        icon={SnowflakeIcon}
                        showLabel
                        iconClassName="planning-button-icon"
                      />
                    </button>
                  </div>
                </section>
              ) : null}

              {activeWorkflowTab === "optimization" ? (
                <section
                  className="planning-workflow-section planning-workflow-section-optimization"
                  id="planning-workflow-panel-optimization"
                  role="tabpanel"
                >
                  <div className="planning-validation-optimization-screen-head">
                    <div>
                      <strong>
                        {hasValidationForCurrentYear
                          ? "Optimisation"
                          : "Vérification requise"}
                      </strong>
                      <span>
                        {hasValidationForCurrentYear
                          ? `Année ${effectiveYear} vérifiée`
                          : `Aucun résultat de vérification pour ${effectiveYear}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`planning-workflow-btn ${
                        optimizationCanApply || !hasValidationForCurrentYear
                          ? "primary"
                          : "neutral"
                      } planning-validation-optimization-primary-apply`}
                      onClick={
                        hasValidationForCurrentYear
                          ? onApplyValidationOptimization
                          : onValidatePlanification
                      }
                      disabled={
                        workflowActionLoading ||
                        (hasValidationForCurrentYear
                          ? !optimizationCanApply
                          : !onValidatePlanification)
                      }
                      aria-label={
                        hasValidationForCurrentYear
                          ? "Appliquer l'optimisation ciblée"
                          : validationLabel
                      }
                      title={
                        hasValidationForCurrentYear
                          ? optimizationCanApply
                            ? "Appliquer les échanges proposés puis relancer la vérification."
                            : "Aucun échange sûr n'est disponible avec les options actuelles."
                          : "Lancer une vérification avant de proposer une optimisation."
                      }
                    >
                      <IconButtonContent
                        label={optimizationApplyButtonLabel}
                        icon={hasValidationForCurrentYear ? WrenchIcon : CheckIcon}
                        showLabel
                        iconClassName="planning-button-icon"
                      />
                    </button>
                  </div>

                  <div className={`planning-validation-optimization-screen-card ${
                    optimizationCanApply
                      ? "is-ready"
                      : hasValidationForCurrentYear
                        ? "is-empty"
                        : "needs-validation"
                  }`}>
                    <div className="planning-validation-optimization-screen-copy">
                      <strong>
                        {optimizationCanApply
                          ? "Proposition prête"
                          : hasValidationForCurrentYear
                            ? "Rien à appliquer"
                            : "Vérifie d'abord la planification"}
                      </strong>
                      <span>
                        {optimizationCanApply
                          ? `${optimizationSwapCount} échange${optimizationSwapCount > 1 ? "s" : ""} prêt${optimizationSwapCount > 1 ? "s" : ""}`
                          : hasValidationForCurrentYear
                            ? "Options actuelles sans proposition applicable."
                            : "Vérification nécessaire avant proposition."}
                      </span>
                    </div>
                    {optimizationCanApply ? (
                      <span className="planning-validation-optimization-screen-chip">
                        {optimizationTargetCount > 0
                          ? `${optimizationTargetCount} TPI`
                          : "Global"}
                      </span>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {activeWorkflowTab === "vote" ? (
                <section
                  className="planning-workflow-section"
                  id="planning-workflow-panel-vote"
                  role="tabpanel"
                >
                  <div className="planning-workflow-section-actions">
                    <button
                      type="button"
                      className="planning-workflow-btn primary"
                      onClick={onOpenVotes}
                      disabled={workflowActionLoading || !onOpenVotes}
                      aria-label={openVotesLabel}
                      title={
                        hasStaleSnapshot
                          ? "La planification a changé depuis le dernier snapshot. Une confirmation admin sera demandée."
                          : hasBlockedValidation
                            ? "La vérification a détecté des anomalies. Une confirmation admin sera demandée."
                            : "Ouvrir la campagne de votes sans envoyer d'emails."
                      }
                    >
                      <IconButtonContent
                        label={openVotesLabel}
                        icon={VoteIcon}
                        showLabel
                        iconClassName="planning-button-icon"
                      />
                    </button>

                    <button
                      type="button"
                      className="planning-workflow-btn secondary"
                      onClick={onOpenVotesWithoutEmails}
                      disabled={workflowActionLoading || !onOpenVotesWithoutEmails}
                      title="Ouvrir la campagne de votes sans envoyer les emails automatiques."
                      aria-label={openVotesWithoutEmailsLabel}
                    >
                      <IconButtonContent
                        label={openVotesWithoutEmailsLabel}
                        icon={VoteIcon}
                        showLabel
                        iconClassName="planning-button-icon"
                      />
                    </button>

                    <button
                      type="button"
                      className="planning-workflow-btn open"
                      onClick={onOpenVoteAccessPreview}
                      disabled={workflowActionLoading || !onOpenVoteAccessPreview}
                      title="Ouvre l'aperçu des liens de vote préfiltré sur cette année."
                      aria-label="Aperçu des liens vote"
                    >
                      <IconButtonContent
                        label="Aperçu des liens vote"
                        icon={SearchIcon}
                        showLabel
                        iconClassName="planning-button-icon"
                      />
                    </button>

                    <button
                      type="button"
                      className="planning-workflow-btn neutral"
                      onClick={onOpenVotesTracking}
                      disabled={workflowActionLoading || !onOpenVotesTracking}
                      title="Ouvrir la page de suivi des votes pour cette année."
                      aria-label={trackVotesLabel}
                    >
                      <IconButtonContent
                        label={trackVotesLabel}
                        icon={ChartIcon}
                        showLabel
                        iconClassName="planning-button-icon"
                      />
                    </button>

                    <button
                      type="button"
                      className="planning-workflow-btn neutral"
                      onClick={onRemindVotes}
                      disabled={workflowActionLoading || !onRemindVotes}
                      title="Relancer les non-répondants."
                      aria-label={remindVotesLabel}
                    >
                      <IconButtonContent
                        label={remindVotesLabel}
                        icon={MailIcon}
                        showLabel
                        iconClassName="planning-button-icon"
                      />
                    </button>

                    <button
                      type="button"
                      className="planning-workflow-btn neutral"
                      onClick={onCloseVotes}
                      disabled={workflowActionLoading || !onCloseVotes}
                      title="Clore la campagne de votes."
                      aria-label={closeVotesLabel}
                    >
                      <IconButtonContent
                        label={closeVotesLabel}
                        icon={BanIcon}
                        showLabel
                        iconClassName="planning-button-icon"
                      />
                    </button>
                  </div>
                </section>
              ) : null}

              {activeWorkflowTab === "finalisation" ? (
                <section
                  className="planning-workflow-section"
                  id="planning-workflow-panel-finalisation"
                  role="tabpanel"
                >
                  <div className="planning-workflow-section-actions">
                    <button
                      type="button"
                      className="planning-workflow-btn success"
                      onClick={onPublishDefinitive}
                      disabled={workflowActionLoading || !onPublishDefinitive}
                      title={
                        hasStaleSnapshot
                          ? "La planification a changé depuis le dernier snapshot. Une confirmation admin sera demandée."
                          : hasBlockedValidation
                            ? "La vérification a détecté des anomalies. Une confirmation admin sera demandée."
                            : "Publier les défenses selon les données disponibles."
                      }
                      aria-label={publishDefinitiveLabel}
                    >
                      <IconButtonContent
                        label={publishDefinitiveLabel}
                        icon={CheckIcon}
                        showLabel
                        iconClassName="planning-button-icon"
                      />
                    </button>

                    <button
                      type="button"
                      className="planning-workflow-btn success"
                      onClick={onSendSoutenanceLinks}
                      disabled={workflowActionLoading || !onSendSoutenanceLinks}
                      title="Renvoyer les magic links de défense."
                      aria-label={sendLinksLabel}
                    >
                      <IconButtonContent
                        label={sendLinksLabel}
                        icon={SendIcon}
                        showLabel
                        iconClassName="planning-button-icon"
                      />
                    </button>

                    <button
                      type="button"
                      className="planning-workflow-btn neutral"
                      onClick={onDeactivatePublication}
                      disabled={workflowActionLoading || !onDeactivatePublication}
                      title={
                        isPublishedState
                          ? "Désactiver la publication des défenses et révoquer les liens de défense."
                          : "Révoquer les liens de défense existants si une publication active est présente."
                      }
                      aria-label={deactivatePublicationLabel}
                    >
                      <IconButtonContent
                        label={deactivatePublicationLabel}
                        icon={BanIcon}
                        showLabel
                        iconClassName="planning-button-icon"
                      />
                    </button>

                    <button
                      type="button"
                      className="planning-workflow-btn open"
                      onClick={onOpenSoutenances}
                      disabled={workflowActionLoading}
                      aria-label={openSoutenancesLabel}
                      title="Ouvrir le module Défenses."
                    >
                      <IconButtonContent
                        label={openSoutenancesLabel}
                        icon={ArrowRightIcon}
                        showLabel
                        iconClassName="planning-button-icon"
                      />
                    </button>
                  </div>
                </section>
              ) : null}

              {activeWorkflowTab === "phases" ? (
                <section
                  className="planning-workflow-section planning-workflow-section-phases"
                  id="planning-workflow-panel-phases"
                  role="tabpanel"
                >
                  <div className="planning-workflow-phase-actions" aria-label="Activation des phases">
                    {workflowPhaseControls.map((phase) => {
                      const phaseActive = isPhaseActive(phase.id)
                      const phaseLabel = `${phaseActive ? "Désactiver" : "Activer"} ${phase.label}`

                      return (
                        <button
                          key={phase.id}
                          type="button"
                          className={`planning-workflow-btn phase-toggle ${phaseActive ? "active" : ""}`.trim()}
                          onClick={() => onWorkflowPhaseToggle?.(phase.id, !phaseActive)}
                          disabled={workflowActionLoading || !onWorkflowPhaseToggle}
                          title={phaseLabel}
                          aria-label={phaseLabel}
                          aria-pressed={phaseActive}
                        >
                          <IconButtonContent
                            label={phase.label}
                            icon={phase.icon}
                            showLabel
                            iconClassName="planning-button-icon"
                          />
                        </button>
                      )
                    })}
                  </div>
                </section>
              ) : null}

              {activeWorkflowTab === "static-publication" ? (
                <section
                  className="planning-workflow-static-stack"
                  id="planning-workflow-panel-static-publication"
                  role="tabpanel"
                >
                  <div className="planning-workflow-section planning-workflow-section-static">
                    <div className="planning-static-publication-copy">
                      <div className="planning-static-publication-head">
                        <strong>Page publique statique</strong>
                        <span
                          className={`planning-static-publication-chip planning-static-publication-chip--${staticPublicationStatusTone}`}
                        >
                          {staticPublicationStatusSummary}
                        </span>
                      </div>
                      <p>
                        Génère une page HTML autonome pour les soutenances, vérifie le rendu localement,
                        puis publie le dossier prêt à consulter sur {staticPublicationTargetLabel} par FTP.
                      </p>
                      <div
                        className={`planning-static-publication-status planning-static-publication-status--${staticPublicationStatusTone}`}
                        role="status"
                        aria-live="polite"
                        aria-label={staticPublicationStatusItems.join(". ")}
                        tabIndex={0}
                      >
                        <span className="planning-static-publication-status-label">
                          Détails
                        </span>
                        {staticPublicationStatusItems.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                    </div>
                    <div className="planning-workflow-section-actions">
                      <button
                        type="button"
                        className="planning-workflow-btn primary"
                        onClick={onGenerateStaticPublication}
                        disabled={workflowActionLoading || !onGenerateStaticPublication}
                        title="Générer le dossier HTML statique depuis les défenses publiées."
                        aria-label={generateStaticPublicationLabel}
                      >
                        <IconButtonContent
                          label={generateStaticPublicationLabel}
                          icon={DownloadIcon}
                          showLabel
                          iconClassName="planning-button-icon"
                        />
                      </button>

                      <button
                        type="button"
                        className="planning-workflow-btn neutral"
                        onClick={onPreviewStaticPublication}
                        disabled={workflowActionLoading || !canPreviewStaticPublication}
                        title={
                          staticPublicationAvailable
                            ? "Ouvrir la page statique générée en prévisualisation."
                            : "Génère la page statique avant la prévisualisation."
                        }
                        aria-label={previewStaticPublicationLabel}
                      >
                        <IconButtonContent
                          label={previewStaticPublicationLabel}
                          icon={SearchIcon}
                          showLabel
                          iconClassName="planning-button-icon"
                        />
                      </button>

                      <button
                        type="button"
                        className="planning-workflow-btn success"
                        onClick={onPublishStaticPublication}
                        disabled={workflowActionLoading || !canPublishStaticPublication}
                        title={
                          staticPublicationAvailable
                            ? `Publier le dossier généré sur ${staticPublicationTargetLabel} via FTP.`
                            : "Génère la page statique avant la publication FTP."
                        }
                        aria-label={publishStaticPublicationLabel}
                      >
                        <IconButtonContent
                          label={publishStaticPublicationLabel}
                          icon={SendIcon}
                          showLabel
                          iconClassName="planning-button-icon"
                        />
                      </button>
                    </div>
                  </div>

                  <div className="planning-workflow-section planning-workflow-section-static planning-workflow-section-static-vote">
                    <div className="planning-static-publication-copy">
                      <div className="planning-static-publication-head">
                        <strong>Mini-site vote</strong>
                        <span
                          className={`planning-static-publication-chip planning-static-publication-chip--${staticVotePublicationStatusTone}`}
                        >
                          {staticVotePublicationStatusSummary}
                        </span>
                      </div>
                      <p>
                        Publie uniquement les formulaires PHP accessibles par liens personnels.
                        Le suivi reste dans l'application et la synchronisation se lance au chargement.
                      </p>
                      <p className="planning-static-publication-warning">
                        {STATIC_VOTE_REGENERATION_NOTICE}
                      </p>
                      <div
                        className={`planning-static-publication-status planning-static-publication-status--${staticVotePublicationStatusTone}`}
                        role="status"
                        aria-live="polite"
                        aria-label={staticVotePublicationStatusItems.join(". ")}
                        tabIndex={0}
                      >
                        <span className="planning-static-publication-status-label">
                          Détails
                        </span>
                        {staticVotePublicationStatusItems.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                    </div>
                    <div className="planning-workflow-section-actions">
                      <button
                        type="button"
                        className="planning-workflow-btn primary"
                        onClick={onGenerateStaticVotePublication}
                        disabled={workflowActionLoading || !onGenerateStaticVotePublication}
                        title="Générer localement le mini-site PHP de vote avec les liens personnels."
                        aria-label={generateStaticVotePublicationLabel}
                      >
                        <IconButtonContent
                          label={generateStaticVotePublicationLabel}
                          icon={VoteIcon}
                          showLabel
                          iconClassName="planning-button-icon"
                        />
                      </button>

                      <button
                        type="button"
                        className="planning-workflow-btn open"
                        onClick={onOpenVoteAccessPreview}
                        disabled={workflowActionLoading || !canOpenStaticVoteAccessPreview}
                        title="Ouvrir l'aperçu des liens personnels de vote."
                        aria-label="Liens vote"
                      >
                        <IconButtonContent
                          label="Liens vote"
                          icon={SearchIcon}
                          showLabel
                          iconClassName="planning-button-icon"
                        />
                      </button>

                      <button
                        type="button"
                        className="planning-workflow-btn success"
                        onClick={onPublishStaticVotePublication}
                        disabled={workflowActionLoading || !canPublishStaticVotePublication}
                        title={
                          staticVotePublicationAvailable
                            ? `Publier le dossier vote généré sur ${staticVotePublicationTargetLabel} via FTP.`
                            : "Génère le mini-site vote avant la publication FTP."
                        }
                        aria-label={publishStaticVotePublicationLabel}
                      >
                        <IconButtonContent
                          label={publishStaticVotePublicationLabel}
                          icon={SendIcon}
                          showLabel
                          iconClassName="planning-button-icon"
                        />
                      </button>

                      <button
                        type="button"
                        className="planning-workflow-btn neutral"
                        onClick={onSyncStaticVotePublication}
                        disabled={workflowActionLoading || !canSyncStaticVotePublication}
                        title={
                          staticVoteSyncSecretConfigured
                            ? "Importer les réponses JSONL stockées sur le mini-site vote."
                            : "Configure STATIC_VOTE_SYNC_SECRET avant de synchroniser."
                        }
                        aria-label={syncStaticVotePublicationLabel}
                      >
                        <IconButtonContent
                          label={syncStaticVotePublicationLabel}
                          icon={RefreshIcon}
                          showLabel
                          iconClassName="planning-button-icon"
                        />
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </div>

          {validationResult ? (
            <div
              className={`planning-validation-report ${
                validationIssueCount > 0
                  ? "has-issues"
                  : validationWarningCount > 0
                    ? "has-warnings"
                    : "is-valid"
              }`}
            >
              <div className="planning-validation-report-head">
                <strong>
                  {validationIssueCount > 0
                    ? `Erreurs détectées: ${validationIssueCount}`
                    : validationWarningCount > 0
                      ? `Avertissements: ${validationWarningCount}`
                    : "Planification valide"}
                </strong>
                <span>
                  {validationCheckedAtLabel
                    ? `Vérifié le ${validationCheckedAtLabel}`
                    : `Année ${effectiveYear}`}
                </span>
              </div>

              {validationIssueCount > 0 || validationWarningCount > 0 ? (
                <ul className="planning-validation-report-list">
                  {validationDisplayedIssues.slice(0, 6).map((issue, index) => (
                    <li key={`${issue.type || "issue"}-${index}`}>
                      {issue.message || "Contrainte bloquante détectée."}
                    </li>
                  ))}
                  {validationDisplayedIssues.length > 6 ? (
                    <li className="planning-validation-report-more">
                      + {validationDisplayedIssues.length - 6} autre(s) élément(s)
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="planning-validation-report-ok">
                  Aucune contrainte bloquante détectée.
                </p>
              )}

              {shouldShowOptimizationPanel ? (
                <details
                  className="planning-validation-optimization"
                  open={optimizationCanApply || activeWorkflowTab === "optimization"}
                >
                  <summary>
                    <span>Optimisations ciblées</span>
                    <span>
                      {optimizationCanApply
                        ? `${optimizationSwapCount} échange(s)`
                        : "Aucune proposition"}
                    </span>
                  </summary>

                  <div className="planning-validation-optimization-controls">
                    <div className="planning-validation-optimization-types planning-validation-optimization-profiles" aria-label="Profils d'optimisation">
                      {optimizationProfileOptions.map((profile) => (
                        <button
                          key={profile.id}
                          type="button"
                          className={optimizationSettings.profile === profile.id ? "active" : ""}
                          onClick={() => applyOptimizationProfile(profile)}
                          title={profile.title}
                        >
                          {profile.label}
                        </button>
                      ))}
                    </div>

                    <div className="planning-validation-optimization-segment" aria-label="Périmètre optimisation">
                      <button
                        type="button"
                        className={optimizationSettings.mode === "strict" ? "active" : ""}
                        onClick={() => updateOptimizationSettings({ mode: "strict" })}
                      >
                        Strict
                      </button>
                      <button
                        type="button"
                        className={optimizationSettings.mode === "expanded" ? "active" : ""}
                        onClick={() => updateOptimizationSettings({ mode: "expanded" })}
                      >
                        Élargi
                      </button>
                    </div>

                    <label className="planning-validation-optimization-select">
                      <span>Échanges</span>
                      <select
                        value={optimizationSettings.maxSwaps}
                        onChange={(event) => updateOptimizationSettings({
                          maxSwaps: Number(event.target.value)
                        })}
                      >
                        {[1, 2, 3, 5].map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </label>

                    <label className="planning-validation-optimization-check">
                      <input
                        type="checkbox"
                        checked={optimizationSettings.sameSiteOnly}
                        onChange={(event) => updateOptimizationSettings({
                          sameSiteOnly: event.target.checked
                        })}
                      />
                      <span>Même site</span>
                    </label>

                    <label className="planning-validation-optimization-check">
                      <input
                        type="checkbox"
                        checked={optimizationSettings.preserveValidated}
                        onChange={(event) => updateOptimizationSettings({
                          preserveValidated: event.target.checked
                        })}
                      />
                      <span>Préserver votés</span>
                    </label>

                    <label
                      className="planning-validation-optimization-check"
                      title="Compacte les passages des personnes sans dépasser la limite de TPI consécutifs; les pauses aux créneaux 4/5 sont favorisées."
                    >
                      <input
                        type="checkbox"
                        checked={optimizationSettings.reduceWaitingTime}
                        onChange={(event) => updateOptimizationSettings({
                          reduceWaitingTime: event.target.checked
                        })}
                      />
                      <span>Réduire attentes</span>
                    </label>
                  </div>

                  <div className="planning-validation-optimization-types" aria-label="Types d'erreurs à optimiser">
                    {optimizationIssueTypeOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={optimizationSettings.issueTypes.includes(option.id) ? "active" : ""}
                        onClick={() => toggleOptimizationIssueType(option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {optimizationCanApply ? (
                    <>
                      <div className="planning-validation-optimization-summary">
                        <span>
                          {optimizationTargetCount > 0
                            ? `${optimizationTargetCount} TPI concerné(s)`
                            : "Attente globale"}
                        </span>
                        {optimizationSummaryItems.length > 0 ? (
                          optimizationSummaryItems.map((item) => (
                            <span key={item}>{item}</span>
                          ))
                        ) : (
                          <span>Score {Number(optimizationBefore.score || 0)}→{Number(optimizationAfter.score || 0)}</span>
                        )}
                      </div>

                      <ol className="planning-validation-optimization-swaps">
                        {(Array.isArray(optimizationProposal?.swaps) ? optimizationProposal.swaps : [])
                          .slice(0, 4)
                          .map((swap, index) => (
                            <li key={`${formatOptimizationSlot(swap.left)}-${formatOptimizationSlot(swap.right)}-${index}`}>
                              {formatOptimizationSlot(swap.left)} ↔ {formatOptimizationSlot(swap.right)}
                            </li>
                          ))}
                      </ol>

                      <button
                        type="button"
                        className="planning-workflow-btn primary planning-validation-optimization-apply"
                        onClick={onApplyValidationOptimization}
                        disabled={workflowActionLoading}
                        aria-label="Appliquer cette proposition"
                        title="Appliquer les échanges proposés puis relancer la vérification."
                      >
                        <IconButtonContent
                          label="Appliquer"
                          icon={WrenchIcon}
                          showLabel
                          iconClassName="planning-button-icon"
                        />
                      </button>
                    </>
                  ) : (
                    <p className="planning-validation-optimization-empty">
                      Aucun échange sûr avec ces options.
                    </p>
                  )}
                </details>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
        </PageToolbar>
      ) : null}
    </>
  )
}

export default TpiScheduleButtons
