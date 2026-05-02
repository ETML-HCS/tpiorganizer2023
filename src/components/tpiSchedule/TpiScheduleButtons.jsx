import React, { useEffect, useMemo, useState, useRef } from "react"
import { createPortal } from "react-dom"
import { Link, useLocation } from "react-router-dom"
import { IS_DEBUG } from "../../config/appConfig"
import PageToolbar from "../shared/PageToolbar"
import { MAIN_NAVIGATION_LINKS } from "../shared/mainNavigation"
import IconButtonContent from "../shared/IconButtonContent"
import NewRoomForm from "./NewRoomForm"
import {
  ArrowRightIcon,
  BanIcon,
  ChartIcon,
  CheckIcon,
  ConfigurationIcon,
  CollapseIcon,
  DownloadIcon,
  ExpandIcon,
  MailIcon,
  PencilIcon,
  RefreshIcon,
  RoomAddIcon,
  SaveIcon,
  SearchIcon,
  SendIcon,
  SnowflakeIcon,
  TrashIcon,
  UploadIcon,
  VoteIcon,
  WrapIcon,
  WrenchIcon
} from "../shared/InlineIcons"
import {
  getSoutenanceDateBadgeLabel,
  getSoutenanceDateBadgeTone,
  normalizeSoutenanceDateEntries
} from "./soutenanceDateUtils"

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

const TpiScheduleButtons = ({
  onToggleEditing,
  onDeleteAllRooms = null,
  onSave,
  onSendBD,
  onExport,
  onLoadConfig,
  onFetchConfig,
  selectedYear,
  onYearChange,
  availableYears = [],
  workflowState = "planning",
  activeSnapshotVersion = null,
  workflowActionLoading = false,
  pendingWorkflowAction = "",
  validationResult = null,
  onAutomatePlanification,
  onValidatePlanification,
  onFreezeSnapshot,
  onOpenVotes,
  onOpenVotesWithoutEmails = null,
  onOpenVoteAccessPreview = null,
  onRemindVotes,
  onCloseVotes,
  onPublishDefinitive,
  onSendSoutenanceLinks,
  onGenerateStaticPublication = null,
  onPreviewStaticPublication = null,
  onPublishStaticPublication = null,
  staticPublicationInfo = null,
  onOpenVotesTracking,
  onOpenSoutenances,
  roomsCount = 0,
  totalRoomsCount = roomsCount,
  usedTpiCount = null,
  totalTpiCount = null,
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
  const isPlanningState = workflowState === "planning"
  const isVotingState = workflowState === "voting_open"
  const isPublishedState = workflowState === "published"
  const canOpenVoteTracking = isVotingState || isPublishedState
  const isActionRunning = (actionKey) =>
    workflowActionLoading && pendingWorkflowAction === actionKey
  const planningHeaderSlot =
    typeof document !== "undefined"
      ? document.getElementById("planning-header-slot")
      : null

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
  const canStartVotes = isPlanningState && hasSnapshot && !hasStaleSnapshot && hasSuccessfulValidation
  const canPublishDirect = isPlanningState && canStartVotes
  const canPublishDefinitive = canPublishDirect || isVotingState || isPublishedState

  const validationYear = Number.parseInt(validationResult?.year, 10)
  const validationSummary = validationResult?.summary || {}
  const validationIssueCount = Number(validationSummary.issueCount || validationSummary.hardConflictCount || 0)
  const validationClassMismatchCount = Number(validationSummary.classMismatchCount || 0)
  const validationSequenceViolationCount = Number(validationSummary.sequenceViolationCount || 0)
  const validationImportIssueCount = Number(validationSummary.importIssueCount || 0)
  const validationUnplannedTpiCount = Number(validationSummary.unplannedTpiCount || 0)
  const validationIssues = Array.isArray(validationResult?.issues) ? validationResult.issues : []
  const validationCheckedAt = validationResult?.checkedAt
    ? new Date(validationResult.checkedAt)
    : null
  const validationCheckedAtLabel =
    validationCheckedAt && !Number.isNaN(validationCheckedAt.getTime())
      ? validationCheckedAt.toLocaleString("fr-CH")
      : ""
  const hasValidationForCurrentYear =
    Number.isInteger(validationYear) && validationYear === Number(effectiveYear)
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
    : isPlanningState
      ? "Publier sans votes"
      : "Publier définitif"
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
  const workflowActionLabels = {
    autoPlan: "Automatisation",
    validate: "Vérification",
    freeze: "Gel du snapshot",
    startVotes: "Ouverture des votes",
    startVotesNoEmail: "Ouverture des votes sans emails",
    remindVotes: "Relance des votes",
    closeVotes: "Clôture des votes",
    publish: "Publication",
    sendLinks: "Envoi des liens",
    staticGenerate: "Génération page statique",
    staticPublish: "Publication FTP"
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

  const validationTooltip = isValidationSuccessful
    ? `Vérification ${effectiveYear} déjà effectuée${validationCheckedAtLabel ? ` le ${validationCheckedAtLabel}` : ""}.`
    : hasValidationForCurrentYear && validationIssueCount > 0
      ? `Vérification ${effectiveYear} terminée: ${validationIssueCount} erreur(s) détectée(s)${validationIssueDetailText}.`
      : hasLocalConflictCount
        ? `${localConflictCount} conflit(s) détecté(s) dans le planning local. Lance la vérification pour tenter une optimisation automatique et obtenir le détail.`
        : "Optimiser puis vérifier l'unicité par créneau, la séquence des TPI et les déplacements avant le snapshot."
  const workflowBadge = validationIssueCount > 0
    ? String(validationIssueCount)
    : hasLocalConflictCount
      ? String(localConflictCount)
      : ""
  const totalTpiBadge = Number.isInteger(Number(totalTpiCount)) && Number(totalTpiCount) > 0
    ? String(totalTpiCount)
    : ""

  const workflowTabs = useMemo(() => ([
    {
      id: "preparation",
      label: "Préparation",
      state: "planning",
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

  useEffect(() => {
    const nextActiveWorkflowTab =
      workflowTabs.find((tab) => tab.state === workflowState)?.id || "preparation"
    setActiveWorkflowTab(nextActiveWorkflowTab)
  }, [workflowState, workflowTabs])

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
  }, [roomDateOptions])

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

  const handleYearChange = (event) => {
    const parsedYear = Number.parseInt(event.target.value, 10)
    if (Number.isInteger(parsedYear) && onYearChange) {
      onYearChange(parsedYear)
    }
  }

  const planningHeaderPortal = !isRoomsFocusMode && planningHeaderSlot
    ? createPortal(
        <div className="app-header-planification-slot">
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
              aria-label={isRoomsFocusMode ? "Quitter le mode focus" : "Activer le mode focus"}
              title={isRoomsFocusMode ? "Quitter le mode focus" : "Afficher uniquement les salles"}
              data-testid="planning-room-focus-toggle"
            >
              <span className="planning-room-focus-toggle-icon" aria-hidden="true">
                {isRoomsFocusMode ? <CollapseIcon /> : <ExpandIcon />}
              </span>
            </button>
          ) : null}
          <span className="app-header-planification-snapshot">
            Snapshot : {hasSnapshot ? `v${activeSnapshotVersion}` : "—"}
          </span>
          <label className="app-header-planification-year" htmlFor="planning-year-select">
            <select
              id="planning-year-select"
              onChange={handleYearChange}
              value={effectiveYear}
              aria-label="Année"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
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
                icon={PencilIcon}
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
                    ? `Supprimer toutes les salles du planning (${deleteAllRoomsCount}).`
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
                icon={UploadIcon}
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
                icon={SaveIcon}
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
                icon={DownloadIcon}
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
                icon={RefreshIcon}
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
                icon={SendIcon}
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
              <p>Crée les salles du planning depuis Configuration.</p>
            </div>
            <div className="planning-room-form-head-actions">
              {typeof onShowNewRoomForm === "function" ? (
                <button
                  type="button"
                  className="page-tools-action-btn primary"
                  onClick={onShowNewRoomForm}
                  aria-label="Créer une room"
                  title="Créer une room manuellement"
                >
                  <IconButtonContent
                    label="Créer une room"
                    icon={RoomAddIcon}
                    iconClassName="planning-button-icon"
                    showLabel={true}
                  />
                </button>
              ) : null}
              {typeof onGenerateRoomsFromCatalog === "function" ? (
                <button
                  type="button"
                  className="page-tools-action-btn secondary icon-button"
                  onClick={onGenerateRoomsFromCatalog}
                  aria-label="Créer les rooms du planning"
                  title="Créer les rooms du planning"
                >
                  <IconButtonContent
                    label="Créer les rooms du planning"
                    icon={RoomAddIcon}
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
                  icon={ConfigurationIcon}
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

          {typeof onRoomFiltersChange === "function" ? (
            <div className="planning-room-actions-row">
              {typeof onTpiCardDetailLevelChange === "function" ? (
                <div
                  className="planning-room-density"
                  role="radiogroup"
                  aria-label="Niveau de détail des cartes TPI"
                >
                  <span className="planning-room-density-label">Cartes</span>
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

              <div className="planning-room-filters">
                <div className="page-tools-field planning-room-filter">
                  <select
                    className="page-tools-field-control"
                    value={roomFilters?.site || ""}
                    onChange={(event) => onRoomFiltersChange({ site: event.target.value })}
                    aria-label="Filtrer par site"
                  >
                    <option value="">Tous</option>
                    {normalizedRoomSiteOptions.map((site) => (
                      <option key={site} value={site}>
                        {site}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="page-tools-field planning-room-filter">
                  <select
                    className="page-tools-field-control"
                    value={roomFilters?.date || ""}
                    onChange={(event) => onRoomFiltersChange({ date: event.target.value })}
                    aria-label="Filtrer par date"
                  >
                    <option value="">Toutes</option>
                    {normalizedRoomDateOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="page-tools-field planning-room-filter">
                  <select
                    className="page-tools-field-control"
                    value={roomFilters?.room || ""}
                    onChange={(event) => onRoomFiltersChange({ room: event.target.value })}
                    aria-label="Filtrer par salle"
                  >
                    <option value="">Toutes</option>
                    {normalizedRoomNameOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="page-tools-action-btn secondary planning-room-filter-reset icon-button"
                  onClick={onClearRoomFilters}
                  aria-label="Réinitialiser les filtres"
                  title="Réinitialiser les filtres"
                  disabled={!(roomFilters?.site || roomFilters?.date || roomFilters?.room)}
                >
                  <IconButtonContent
                    label="Réinitialiser les filtres"
                    icon={RefreshIcon}
                    iconClassName="planning-button-icon"
                  />
                </button>
              </div>
            </div>
          ) : null}
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
              aria-label="Étapes du workflow"
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
                activeWorkflowTab === "static-publication" ? "planning-workflow-stage-static" : ""
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
                      disabled={workflowActionLoading || !isPlanningState || !onAutomatePlanification}
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
                      disabled={workflowActionLoading || !isPlanningState || isValidationSuccessful}
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
                      disabled={workflowActionLoading || !isPlanningState || isAlreadyFrozen || nonImportableTpiCount > 0}
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
                      disabled={workflowActionLoading || !canStartVotes}
                      aria-label={openVotesLabel}
                      title={
                        hasStaleSnapshot
                          ? "La planification a changé depuis le dernier snapshot. Geler une nouvelle version avant d'ouvrir les votes."
                          : hasBlockedValidation
                            ? "La vérification a détecté des anomalies. Corrigez-les avant d'ouvrir les votes."
                          : canStartVotes
                            ? "Ouvrir la campagne de votes."
                            : "Snapshot requis avant ouverture des votes."
                      }
                    >
                      <IconButtonContent
                        label={openVotesLabel}
                        icon={VoteIcon}
                        showLabel
                        iconClassName="planning-button-icon"
                      />
                    </button>

                    {IS_DEBUG ? (
                      <button
                        type="button"
                        className="planning-workflow-btn secondary"
                        onClick={onOpenVotesWithoutEmails}
                        disabled={workflowActionLoading || !canStartVotes || !onOpenVotesWithoutEmails}
                        title={
                          hasStaleSnapshot
                            ? "La planification a changé depuis le dernier snapshot. Geler une nouvelle version avant d'ouvrir les votes."
                            : hasBlockedValidation
                              ? "La vérification a détecté des anomalies. Corrigez-les avant d'ouvrir les votes."
                              : canStartVotes
                                ? "Ouvrir la campagne de votes sans envoyer les emails automatiques."
                                : "Snapshot requis avant ouverture des votes."
                        }
                        aria-label={openVotesWithoutEmailsLabel}
                      >
                        <IconButtonContent
                          label={openVotesWithoutEmailsLabel}
                          icon={VoteIcon}
                          showLabel
                          iconClassName="planning-button-icon"
                        />
                      </button>
                    ) : null}

                    {IS_DEBUG ? (
                      <button
                        type="button"
                        className="planning-workflow-btn open"
                        onClick={onOpenVoteAccessPreview}
                        disabled={workflowActionLoading || !isVotingState || !onOpenVoteAccessPreview}
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
                    ) : null}

                    <button
                      type="button"
                      className="planning-workflow-btn neutral"
                      onClick={onOpenVotesTracking}
                      disabled={workflowActionLoading || !canOpenVoteTracking || !onOpenVotesTracking}
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
                      disabled={workflowActionLoading || !isVotingState}
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
                      disabled={workflowActionLoading || !isVotingState}
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
                      disabled={workflowActionLoading || !canPublishDefinitive}
                      title={
                        isPlanningState
                          ? hasStaleSnapshot
                            ? "La planification a changé depuis le dernier snapshot. Geler une nouvelle version avant de publier."
                            : hasBlockedValidation
                              ? "La vérification a détecté des anomalies. Corrigez-les avant de publier."
                              : canPublishDirect
                                ? "Confirmer les créneaux du snapshot et publier sans campagne de votes."
                                : "Snapshot validé requis avant publication directe."
                          : "Publier la version définitive dans Défenses."
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
                      disabled={workflowActionLoading || !isPublishedState}
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

              {activeWorkflowTab === "static-publication" ? (
                <section
                  className="planning-workflow-section planning-workflow-section-static"
                  id="planning-workflow-panel-static-publication"
                  role="tabpanel"
                >
                  <div className="planning-static-publication-copy">
                    <strong>Page publique statique</strong>
                    <p>
                      Génère une page HTML autonome pour les soutenances, vérifie le rendu localement,
                      puis publie le dossier prêt à consulter sur {staticPublicationTargetLabel} par FTP.
                    </p>
                    <div
                      className={`planning-static-publication-status planning-static-publication-status--${staticPublicationStatusTone}`}
                      role="status"
                      aria-live="polite"
                    >
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
                </section>
              ) : null}
            </div>
          </div>

          {validationResult ? (
            <div
              className={`planning-validation-report ${
                validationIssueCount > 0 ? "has-issues" : "is-valid"
              }`}
            >
              <div className="planning-validation-report-head">
                <strong>
                  {validationIssueCount > 0
                    ? `Erreurs détectées: ${validationIssueCount}`
                    : "Planning valide"}
                </strong>
                <span>
                  {validationCheckedAtLabel
                    ? `Vérifié le ${validationCheckedAtLabel}`
                    : `Année ${effectiveYear}`}
                </span>
              </div>

              {validationIssueCount > 0 ? (
                <ul className="planning-validation-report-list">
                  {validationIssues.slice(0, 6).map((issue, index) => (
                    <li key={`${issue.type || "issue"}-${index}`}>
                      {issue.message || "Contrainte bloquante détectée."}
                    </li>
                  ))}
                  {validationIssues.length > 6 ? (
                    <li className="planning-validation-report-more">
                      + {validationIssues.length - 6} autre(s) erreur(s)
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="planning-validation-report-ok">
                  Aucune contrainte bloquante détectée.
                </p>
              )}
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
