import React, { useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'

import {
  buildGestionTpiCreateLink,
  buildGestionTpiFocusLink,
  buildLegacyPrefillFromDossier,
  buildPartiesPrenantesLink,
  buildPlanningFocusLink,
  buildPlanningTabLink,
  buildSoutenanceFocusLink,
  compactText,
  formatDateTime,
  formatPersonName,
  formatVoteDecision,
  formatVoteRole,
  getLegacyExpert,
  getPlannedSlotLabel,
  getPlanningStatusMeta,
  isLikelyUrl,
  readObjectId
} from './tpiDetailUtils'

import './TpiDetailPage.css'

const STAKEHOLDER_ROLE_META = {
  candidat: { label: 'Candidat', routeRole: 'candidat' },
  expert1: { label: 'Expert 1', routeRole: 'expert' },
  expert2: { label: 'Expert 2', routeRole: 'expert' },
  chef_projet: { label: 'Chef de projet', routeRole: 'chef_projet' }
}

const DetailItem = ({ label, value, tone = '' }) => (
  <article className={`tpi-detail-item ${tone ? `is-${tone}` : ''}`.trim()}>
    <span>{label}</span>
    <strong>{value || '—'}</strong>
  </article>
)

function getCompletenessLabel(stakeholderState, hasLegacyData) {
  if (!stakeholderState) {
    return hasLegacyData ? 'Inconnue' : 'Indisponible'
  }

  return stakeholderState.isComplete ? 'Complète' : 'Incomplète'
}

function getResolutionLabel(stakeholderState, hasLegacyData) {
  if (!stakeholderState) {
    return hasLegacyData ? 'Inconnue' : 'Indisponible'
  }

  return stakeholderState.isResolved ? 'Résolue' : 'À confirmer'
}

function normalizeSupplementalIssue(issue, index) {
  if (typeof issue === 'string') {
    const message = compactText(issue)

    if (!message) {
      return null
    }

    return {
      key: `validation-${index}-${message}`,
      type: 'Validation planning',
      message
    }
  }

  const type = compactText(issue?.type) || 'Validation planning'
  const message = compactText(issue?.message)

  if (!message) {
    return null
  }

  return {
    key: compactText(issue?.key) || `${type}-${message}-${index}`,
    type,
    message
  }
}

function normalizeStakeholderRoleKey(role) {
  const normalizedRole = compactText(role).toLowerCase()

  switch (normalizedRole) {
    case 'candidat':
      return 'candidat'
    case 'expert1':
    case 'expert_1':
    case 'expert 1':
      return 'expert1'
    case 'expert2':
    case 'expert_2':
    case 'expert 2':
      return 'expert2'
    case 'chef_projet':
    case 'chef projet':
    case 'chef de projet':
    case 'boss':
      return 'chef_projet'
    default:
      return ''
  }
}

function getStakeholderTarget(roleKey, legacyTpi, planningTpi) {
  switch (roleKey) {
    case 'candidat':
      return {
        label: STAKEHOLDER_ROLE_META.candidat.label,
        routeRole: STAKEHOLDER_ROLE_META.candidat.routeRole,
        name: compactText(legacyTpi?.candidat) || formatPersonName(planningTpi?.candidat),
        personId: compactText(legacyTpi?.candidatPersonId) || readObjectId(planningTpi?.candidat)
      }
    case 'expert1':
      return {
        label: STAKEHOLDER_ROLE_META.expert1.label,
        routeRole: STAKEHOLDER_ROLE_META.expert1.routeRole,
        name: getLegacyExpert(legacyTpi, '1') || formatPersonName(planningTpi?.expert1),
        personId: compactText(legacyTpi?.expert1PersonId) || readObjectId(planningTpi?.expert1)
      }
    case 'expert2':
      return {
        label: STAKEHOLDER_ROLE_META.expert2.label,
        routeRole: STAKEHOLDER_ROLE_META.expert2.routeRole,
        name: getLegacyExpert(legacyTpi, '2') || formatPersonName(planningTpi?.expert2),
        personId: compactText(legacyTpi?.expert2PersonId) || readObjectId(planningTpi?.expert2)
      }
    case 'chef_projet':
      return {
        label: STAKEHOLDER_ROLE_META.chef_projet.label,
        routeRole: STAKEHOLDER_ROLE_META.chef_projet.routeRole,
        name: compactText(legacyTpi?.boss) || formatPersonName(planningTpi?.chefProjet),
        personId: compactText(legacyTpi?.bossPersonId) || readObjectId(planningTpi?.chefProjet)
      }
    default:
      return null
  }
}

function getMissingLegacyFields(legacyTpi, planningTpi) {
  const fields = []

  if (!compactText(planningTpi?.sujet) && !compactText(legacyTpi?.sujet)) {
    fields.push('sujet')
  }

  if (!compactText(planningTpi?.classe) && !compactText(legacyTpi?.classe)) {
    fields.push('classe')
  }

  if (!compactText(planningTpi?.site) && !compactText(legacyTpi?.site) && !compactText(legacyTpi?.lieu?.site)) {
    fields.push('site')
  }

  if (!compactText(planningTpi?.entreprise?.nom) && !compactText(legacyTpi?.lieu?.entreprise)) {
    fields.push('entreprise')
  }

  if (!compactText(legacyTpi?.lienDepot)) {
    fields.push('dépôt git')
  }

  return fields
}

function getRemediationPriorityMeta(priority) {
  if (priority <= 1) {
    return { label: 'Action prioritaire', tone: 'warning' }
  }

  if (priority === 2) {
    return { label: 'Étape suivante', tone: 'secondary' }
  }

  return { label: 'Complément', tone: 'muted' }
}

function buildRemediationCards({
  dossier,
  legacyTpi,
  planningTpi,
  stakeholderState,
  plannedSlot,
  planningStatus,
  workflowReference,
  legacyRef
}) {
  const cards = []
  const focusReference = workflowReference || legacyRef
  const missingLegacyFields = getMissingLegacyFields(legacyTpi, planningTpi)
  const missingRoleLabels = Array.isArray(stakeholderState?.missingRoles)
    ? stakeholderState.missingRoles.map((role) => STAKEHOLDER_ROLE_META[normalizeStakeholderRoleKey(role)]?.label || role)
    : []
  const unresolvedRoleKeys = Array.isArray(stakeholderState?.unresolvedRoles)
    ? stakeholderState.unresolvedRoles
      .map(normalizeStakeholderRoleKey)
      .filter(Boolean)
    : []
  const unresolvedTargets = unresolvedRoleKeys
    .map((roleKey) => getStakeholderTarget(roleKey, legacyTpi, planningTpi))
    .filter((target) => target && (target.name || target.personId))

  if (!dossier?.legacy?.exists && focusReference) {
    cards.push({
      key: 'create-legacy',
      priority: 1,
      tone: 'warning',
      title: 'Créer la fiche GestionTPI',
      description: 'Le TPI existe dans Planning, mais aucune fiche legacy correspondante n’a été trouvée.',
      tags: ['GestionTPI absent', 'Préremplissage possible'],
      actions: [
        {
          key: 'create-legacy',
          label: 'Créer dans Gestion TPI',
          to: buildGestionTpiCreateLink(dossier?.year, focusReference),
          state: {
            prefillTpi: buildLegacyPrefillFromDossier(dossier)
          },
          tone: 'warning'
        },
        {
          key: 'open-planning',
          label: 'Voir dans Planning',
          to: buildPlanningFocusLink(dossier?.year, focusReference),
          tone: 'secondary'
        }
      ]
    })
  }

  if (dossier?.legacy?.exists && missingLegacyFields.length > 0 && focusReference) {
    cards.push({
      key: 'complete-legacy',
      priority: 3,
      tone: 'warning',
      title: 'Compléter la fiche GestionTPI',
      description: `Des informations restent absentes: ${missingLegacyFields.join(', ')}.`,
      tags: ['Données incomplètes'],
      actions: [
        {
          key: 'edit-legacy',
          label: 'Modifier dans Gestion TPI',
          to: buildGestionTpiFocusLink(dossier?.year, focusReference, { edit: true }),
          tone: 'warning'
        }
      ]
    })
  }

  if (dossier?.legacy?.exists && missingRoleLabels.length > 0 && focusReference) {
    cards.push({
      key: 'missing-stakeholders',
      priority: 1,
      tone: 'warning',
      title: 'Compléter les parties prenantes',
      description: `Rôles manquants dans GestionTPI: ${missingRoleLabels.join(', ')}.`,
      tags: ['Blocage import planning'],
      actions: [
        {
          key: 'edit-stakeholders',
          label: 'Compléter dans Gestion TPI',
          to: buildGestionTpiFocusLink(dossier?.year, focusReference, { edit: true }),
          tone: 'warning'
        }
      ]
    })
  }

  if (dossier?.legacy?.exists && unresolvedRoleKeys.length > 0) {
    cards.push({
      key: 'resolve-registry',
      priority: 2,
      tone: 'warning',
      title: 'Lier au référentiel Parties prenantes',
      description: 'Certaines personnes sont saisies dans la fiche, mais ne sont pas encore confirmées dans le référentiel.',
      tags: unresolvedRoleKeys.map((roleKey) => STAKEHOLDER_ROLE_META[roleKey]?.label || roleKey),
      actions: [
        ...unresolvedTargets.map((target) => ({
          key: `registry-${target.label}`,
          label: `Ouvrir ${target.label}`,
          to: buildPartiesPrenantesLink({
            personId: target.personId,
            name: target.name,
            role: target.routeRole
          }),
          tone: 'secondary'
        })),
        focusReference ? {
          key: 'edit-registry-source',
          label: 'Modifier la source Gestion TPI',
          to: buildGestionTpiFocusLink(dossier?.year, focusReference, { edit: true }),
          tone: 'secondary'
        } : null
      ].filter(Boolean)
    })
  }

  if (dossier?.legacy?.exists && !dossier?.planning?.exists && focusReference) {
    const isBlockedByStakeholders = missingRoleLabels.length > 0 || unresolvedRoleKeys.length > 0

    cards.push({
      key: 'missing-planning',
      priority: isBlockedByStakeholders ? 3 : 2,
      tone: 'warning',
      title: 'Synchroniser vers Planning',
      description: isBlockedByStakeholders
        ? 'Le TPI n’apparaît pas encore dans Planning. Les parties prenantes doivent être validées avant synchronisation.'
        : 'Le TPI n’apparaît pas encore dans Planning. Vérifie le suivi des TPI non importés et relance le workflow annuel si nécessaire.',
      tags: ['Planning absent'],
      actions: [
        {
          key: 'planning-votes',
          label: 'Voir le suivi Planning',
          to: buildPlanningTabLink(dossier?.year, 'votes', { focus: focusReference }),
          tone: 'primary'
        },
        {
          key: 'legacy-source',
          label: 'Ouvrir Gestion TPI',
          to: buildGestionTpiFocusLink(dossier?.year, focusReference),
          tone: 'secondary'
        }
      ]
    })
  }

  if (dossier?.planning?.exists && !plannedSlot && focusReference) {
    cards.push({
      key: 'missing-slot',
      priority: planningStatus.toLowerCase() === 'published' ? 1 : 2,
      tone: planningStatus.toLowerCase() === 'published' ? 'warning' : 'secondary',
      title: 'Assigner un créneau',
      description: 'Aucun créneau confirmé n’est visible pour ce TPI dans le workflow.',
      tags: ['Créneau manquant'],
      actions: [
        {
          key: 'planning-slot',
          label: 'Ouvrir Planning',
          to: buildPlanningFocusLink(dossier?.year, focusReference),
          tone: 'primary'
        }
      ]
    })
  }

  if (
    dossier?.planning?.exists &&
    Number(dossier?.planning?.voteSummary?.pendingVotes || 0) > 0 &&
    focusReference &&
    ['voting', 'voting_open', 'confirmed'].includes(planningStatus.toLowerCase())
  ) {
    cards.push({
      key: 'pending-votes',
      priority: 4,
      tone: 'secondary',
      title: 'Suivre les votes en attente',
      description: `${Number(dossier?.planning?.voteSummary?.pendingVotes || 0)} vote(s) restent en attente sur ce dossier.`,
      tags: ['Workflow en cours'],
      actions: [
        {
          key: 'planning-votes-open',
          label: 'Ouvrir le suivi des votes',
          to: buildPlanningTabLink(dossier?.year, 'votes', { focus: focusReference }),
          tone: 'primary'
        }
      ]
    })
  }

  return cards.sort((left, right) => {
    const leftPriority = Number(left?.priority || 99)
    const rightPriority = Number(right?.priority || 99)

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority
    }

    return String(left?.title || '').localeCompare(String(right?.title || ''), 'fr')
  })
}

function buildHealthSummary({
  dossier,
  remediationCards,
  mergedIssues,
  stakeholderState,
  plannedSlot,
  planningStatusMeta
}) {
  const hasLegacy = Boolean(dossier?.legacy?.exists)
  const hasPlanning = Boolean(dossier?.planning?.exists)
  const missingRolesCount = Number(stakeholderState?.missingRoles?.length || 0)
  const unresolvedRolesCount = Number(stakeholderState?.unresolvedRoles?.length || 0)
  const missingSlotCount = hasPlanning && !plannedSlot ? 1 : 0
  const missingLegacyCount = hasLegacy ? 0 : 1
  const blockingCount = missingRolesCount + unresolvedRolesCount + missingSlotCount + missingLegacyCount
  const nextCard = remediationCards[0] || null
  const nextAction = nextCard?.actions?.[0] || null

  if (blockingCount === 0 && mergedIssues.length === 0) {
    return {
      tone: 'ready',
      label: 'Dossier prêt',
      summary: 'Le dossier est exploitable tel quel. Aucune correction immédiate n’est visible sur la fiche.',
      checkpoints: [
        { key: 'legacy', label: 'GestionTPI', value: hasLegacy ? 'OK' : 'Absente', tone: hasLegacy ? 'ready' : 'warning' },
        { key: 'planning', label: 'Planning', value: hasPlanning ? planningStatusMeta.label : 'Absent', tone: hasPlanning ? 'ready' : 'warning' },
        { key: 'blockers', label: 'Blocages', value: 'Aucun', tone: 'ready' },
        { key: 'next', label: 'Suite', value: 'Aucune action urgente', tone: 'ready' }
      ],
      nextCard,
      nextAction
    }
  }

  if (blockingCount > 0) {
    return {
      tone: 'warning',
      label: 'Dossier à débloquer',
      summary: `Des éléments bloquants empêchent le dossier d’être complet ou exploitable sans intervention (${blockingCount}).`,
      checkpoints: [
        { key: 'legacy', label: 'GestionTPI', value: hasLegacy ? 'Présente' : 'À créer', tone: hasLegacy ? 'ready' : 'warning' },
        { key: 'planning', label: 'Planning', value: hasPlanning ? planningStatusMeta.label : 'Absent', tone: hasPlanning ? '' : 'warning' },
        { key: 'blockers', label: 'Blocages', value: String(blockingCount), tone: 'warning' },
        { key: 'next', label: 'Priorité', value: nextCard?.title || 'Analyser le dossier', tone: nextCard ? 'warning' : '' }
      ],
      nextCard,
      nextAction
    }
  }

  return {
    tone: 'secondary',
    label: 'Dossier à compléter',
    summary: `Le dossier est lisible, mais ${mergedIssues.length} point(s) de cohérence ou de suivi demandent encore une action.`,
    checkpoints: [
      { key: 'legacy', label: 'GestionTPI', value: hasLegacy ? 'Présente' : 'Absente', tone: hasLegacy ? 'ready' : 'warning' },
      { key: 'planning', label: 'Planning', value: hasPlanning ? planningStatusMeta.label : 'Absent', tone: hasPlanning ? '' : 'warning' },
      { key: 'issues', label: 'Contrôles', value: String(mergedIssues.length), tone: mergedIssues.length > 0 ? 'warning' : 'ready' },
      { key: 'next', label: 'Prochaine action', value: nextCard?.title || 'Ajuster les données', tone: '' }
    ],
    nextCard,
    nextAction
  }
}

const ActionLink = ({ action, className }) => {
  const key = compactText(action?.key) || compactText(action?.label)
  const label = compactText(action?.label)
  const tone = compactText(action?.tone) || 'secondary'

  if (!label || !key) {
    return null
  }

  if (action?.to) {
    return (
      <Link
        key={key}
        className={`${className} is-${tone}`}
        to={action.to}
        state={action.state}
      >
        {label}
      </Link>
    )
  }

  if (action?.href) {
    return (
      <a
        key={key}
        className={`${className} is-${tone}`}
        href={action.href}
        target='_blank'
        rel='noreferrer'
      >
        {label}
      </a>
    )
  }

  return null
}

function buildQuickEditDraft(dossier) {
  const legacyTpi = dossier?.legacy?.data || null

  return {
    sujet: compactText(legacyTpi?.sujet),
    classe: compactText(legacyTpi?.classe),
    lieuEntreprise: compactText(legacyTpi?.lieu?.entreprise),
    lieuSite: compactText(legacyTpi?.lieu?.site),
    lienDepot: compactText(legacyTpi?.lienDepot)
  }
}

const TpiDetailSections = ({
  dossier,
  supplementalIssues = [],
  showSummary = true,
  showOverview = true,
  overviewActions = [],
  quickActions = null,
  className = ''
}) => {
  if (!dossier) {
    return null
  }

  const legacyTpi = dossier?.legacy?.data || null
  const planningTpi = dossier?.planning?.data || null
  const voteSummary = dossier?.planning?.voteSummary || {}
  const workflowVoteSummary = dossier?.planning?.workflowVoteSummary || null
  const stakeholderState = dossier?.legacy?.stakeholderState || null
  const votes = Array.isArray(dossier?.planning?.votes) ? dossier.planning.votes : []
  const plannedSlot = dossier?.planning?.plannedSlot || null
  const planningStatus = compactText(planningTpi?.status)
  const planningStatusMeta = getPlanningStatusMeta(planningStatus)
  const tags = Array.isArray(legacyTpi?.tags) ? legacyTpi.tags.filter(Boolean) : []
  const candidateName = formatPersonName(planningTpi?.candidat, compactText(legacyTpi?.candidat))
  const subject = compactText(planningTpi?.sujet) || compactText(legacyTpi?.sujet) || 'Sujet non renseigné'
  const expert1Name = formatPersonName(planningTpi?.expert1, getLegacyExpert(legacyTpi, '1'))
  const expert2Name = formatPersonName(planningTpi?.expert2, getLegacyExpert(legacyTpi, '2'))
  const projectLeadName = formatPersonName(planningTpi?.chefProjet, compactText(legacyTpi?.boss))
  const depositLink = compactText(legacyTpi?.lienDepot)
  const workflowReference = compactText(dossier?.identifiers?.workflowReference)
  const legacyRef = compactText(dossier?.identifiers?.legacyRef)
  const displayReference = workflowReference || legacyRef || compactText(dossier?.ref)
  const consistencyIssues = Array.isArray(dossier?.consistency?.issues) ? dossier.consistency.issues : []
  const mergedIssues = [
    ...consistencyIssues.map((issue, index) => ({
      key: `${compactText(issue?.type) || 'issue'}-${compactText(issue?.message) || index}`,
      type: compactText(issue?.type) || 'Cohérence',
      message: compactText(issue?.message)
    })),
    ...supplementalIssues
      .map((issue, index) => normalizeSupplementalIssue(issue, index))
      .filter(Boolean)
  ]
  const plannedSlotLabel = getPlannedSlotLabel(plannedSlot)
  const focusReference = workflowReference || legacyRef
  const visibleOverviewPills = [
    {
      key: 'planning-status',
      className: `tpi-detail-pill is-${planningStatusMeta.tone}`,
      label: planningStatusMeta.label
    },
    {
      key: 'legacy-status',
      className: `tpi-detail-pill ${dossier?.legacy?.exists ? 'is-ready' : 'is-muted'}`,
      label: `GestionTPI ${dossier?.legacy?.exists ? 'liée' : 'absente'}`
    },
    {
      key: 'planning-link',
      className: `tpi-detail-pill ${dossier?.planning?.exists ? 'is-ready' : 'is-muted'}`,
      label: `Planning ${dossier?.planning?.exists ? 'lié' : 'absent'}`
    },
    mergedIssues.length > 0 ? {
      key: 'issues',
      className: 'tpi-detail-pill is-warning',
      label: `${mergedIssues.length} anomalie${mergedIssues.length > 1 ? 's' : ''}`
    } : null,
    plannedSlot ? {
      key: 'slot',
      className: 'tpi-detail-pill is-ready',
      label: plannedSlotLabel
    } : null
  ].filter(Boolean)
  const defaultOverviewActions = [
    dossier?.legacy?.exists && focusReference ? {
      key: 'gestion',
      label: 'Voir dans Gestion TPI',
      to: buildGestionTpiFocusLink(dossier?.year, focusReference),
      tone: 'secondary'
    } : null,
    !dossier?.legacy?.exists && focusReference ? {
      key: 'gestion-create',
      label: 'Créer dans Gestion TPI',
      to: buildGestionTpiCreateLink(dossier?.year, focusReference),
      state: {
        prefillTpi: buildLegacyPrefillFromDossier(dossier)
      },
      tone: 'warning'
    } : null,
    dossier?.legacy?.exists && focusReference ? {
      key: 'gestion-edit',
      label: 'Modifier dans Gestion TPI',
      to: buildGestionTpiFocusLink(dossier?.year, focusReference, { edit: true }),
      tone: 'warning'
    } : null,
    focusReference ? {
      key: 'planning',
      label: 'Voir dans Planning',
      to: buildPlanningFocusLink(dossier?.year, focusReference),
      tone: 'primary'
    } : null,
    planningStatus.toLowerCase() === 'published' && focusReference ? {
      key: 'soutenance',
      label: 'Voir dans Soutenances',
      to: buildSoutenanceFocusLink(dossier?.year, focusReference),
      tone: 'secondary'
    } : null,
    isLikelyUrl(depositLink) ? {
      key: 'deposit',
      label: 'Ouvrir le dépôt',
      href: depositLink,
      tone: 'secondary'
    } : null
  ].filter(Boolean)
  const resolvedOverviewActions = Array.isArray(overviewActions) && overviewActions.length > 0
    ? overviewActions
    : defaultOverviewActions
  const remediationCards = buildRemediationCards({
    dossier,
    legacyTpi,
    planningTpi,
    stakeholderState,
    plannedSlot,
    planningStatus,
    workflowReference,
    legacyRef
  })
  const hasSubject = Boolean(compactText(planningTpi?.sujet) || compactText(legacyTpi?.sujet))
  const hasClass = Boolean(compactText(planningTpi?.classe) || compactText(legacyTpi?.classe))
  const hasSite = Boolean(compactText(planningTpi?.site) || compactText(legacyTpi?.site) || compactText(legacyTpi?.lieu?.site))
  const hasCompany = Boolean(compactText(planningTpi?.entreprise?.nom) || compactText(legacyTpi?.lieu?.entreprise))
  const hasDepositLink = Boolean(depositLink)
  const hasCandidate = Boolean(candidateName)
  const hasExpert1 = Boolean(expert1Name)
  const hasExpert2 = Boolean(expert2Name)
  const hasProjectLead = Boolean(projectLeadName)
  const directActionsEnabled = Boolean(quickActions?.onSaveLegacy || quickActions?.onCreateLegacy)
  const quickActionFeedback = quickActions?.feedback || null
  const isQuickActionPending = quickActions?.isPending === true
  const healthSummary = buildHealthSummary({
    dossier,
    remediationCards,
    mergedIssues,
    stakeholderState,
    plannedSlot,
    planningStatusMeta
  })
  const shouldRenderSummaryGrid = showSummary && !showOverview
  const quickEditFields = useMemo(() => ([
    { key: 'sujet', label: 'Sujet', type: 'text', placeholder: 'Sujet du TPI' },
    { key: 'classe', label: 'Classe', type: 'text', placeholder: 'Classe' },
    { key: 'lieuEntreprise', label: 'Entreprise', type: 'text', placeholder: 'Entreprise' },
    { key: 'lieuSite', label: 'Site', type: 'text', placeholder: 'Site' },
    { key: 'lienDepot', label: 'Dépôt git', type: 'url', placeholder: 'https://...' }
  ]), [])
  const quickEditDefaults = useMemo(() => buildQuickEditDraft(dossier), [dossier])
  const quickEditFormKey = useMemo(() => quickEditFields
    .map((field) => `${field.key}:${quickEditDefaults[field.key] || ''}`)
    .join('|'), [quickEditDefaults, quickEditFields])
  const quickEditFormRef = useRef(null)

  const handleQuickEditCancel = () => {
    quickEditFormRef.current?.reset()
  }

  const handleQuickEditSubmit = async (event) => {
    event.preventDefault()

    if (typeof quickActions?.onSaveLegacy !== 'function') {
      return
    }

    const formData = new FormData(event.currentTarget)
    const submittedDraft = quickEditFields.reduce((draft, field) => ({
      ...draft,
      [field.key]: compactText(formData.get(field.key)) || quickEditDefaults[field.key] || ''
    }), {})
    const didSave = await quickActions.onSaveLegacy(submittedDraft)

    if (!didSave) {
      return
    }
  }

  const handleQuickCreate = async () => {
    if (typeof quickActions?.onCreateLegacy !== 'function') {
      return
    }

    await quickActions.onCreateLegacy()
  }

  return (
    <div className={`tpi-detail-sections ${className}`.trim()}>
      {showOverview ? (
        <section className='tpi-detail-section-card tpi-detail-overview'>
          <div className='tpi-detail-overview-copy'>
            <span className='tpi-detail-overview-kicker'>
              {displayReference ? `Fiche ${displayReference}` : 'Fiche TPI'}
            </span>
            <h2 className='tpi-detail-overview-title'>{candidateName || 'Candidat non renseigné'}</h2>
            <p className='tpi-detail-overview-subtitle'>{subject}</p>
          </div>

          <div className='tpi-detail-overview-pills'>
            {visibleOverviewPills.map((pill) => (
              <span key={pill.key} className={pill.className}>
                {pill.label}
              </span>
            ))}
          </div>

          {resolvedOverviewActions.length > 0 ? (
            <div className='tpi-detail-overview-actions'>
              {resolvedOverviewActions.map((action) => (
                <ActionLink
                  key={compactText(action?.key) || compactText(action?.label)}
                  action={action}
                  className='tpi-detail-overview-link'
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {shouldRenderSummaryGrid ? (
        <section className='tpi-detail-summary-grid'>
          <DetailItem
            label='Référence workflow'
            value={workflowReference || 'Non créée'}
            tone={workflowReference ? '' : 'warning'}
          />
          <DetailItem
            label='Référence legacy'
            value={legacyRef || 'Non créée'}
            tone={legacyRef ? '' : 'warning'}
          />
          <DetailItem
            label='Statut planning'
            value={planningStatusMeta.label}
          />
          <DetailItem
            label='Créneau'
            value={plannedSlotLabel}
            tone={plannedSlot ? 'ready' : 'warning'}
          />
        </section>
      ) : null}

      <section className={`tpi-detail-section-card tpi-detail-health is-${healthSummary.tone}`}>
        <div className='tpi-detail-health-copy'>
          <span className={`tpi-detail-health-kicker is-${healthSummary.tone}`}>Santé du dossier</span>
          <h2>{healthSummary.label}</h2>
          <p>{healthSummary.summary}</p>
        </div>

        <div className='tpi-detail-health-grid'>
          {healthSummary.checkpoints.map((checkpoint) => (
            <DetailItem
              key={checkpoint.key}
              label={checkpoint.label}
              value={checkpoint.value}
              tone={checkpoint.tone}
            />
          ))}
        </div>

        {healthSummary.nextCard ? (
          <div className='tpi-detail-health-next-step'>
            <div className='tpi-detail-health-next-copy'>
              <span className={`tpi-detail-health-next-pill is-${getRemediationPriorityMeta(healthSummary.nextCard.priority).tone}`}>
                {getRemediationPriorityMeta(healthSummary.nextCard.priority).label}
              </span>
              <strong>{healthSummary.nextCard.title}</strong>
              <p>
                {healthSummary.nextAction
                  ? 'Commencer par cette action. Les autres compléments restent listés plus bas sur la fiche.'
                  : 'Point principal à traiter sur cette fiche.'}
              </p>
            </div>

            {healthSummary.nextAction ? (
              <div className='tpi-detail-health-next-actions'>
                <ActionLink
                  action={healthSummary.nextAction}
                  className='tpi-detail-remediation-link'
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {directActionsEnabled ? (
        <section className='tpi-detail-section-card'>
          <div className='tpi-detail-section-head'>
            <h2>Correction directe</h2>
            <p>Actions rapides possibles sans quitter la fiche. Le reste continue de pointer vers les écrans métier spécialisés.</p>
          </div>

          {quickActionFeedback ? (
            <div className={`tpi-detail-inline-feedback is-${quickActionFeedback.tone || 'info'}`}>
              <strong>{quickActionFeedback.tone === 'success' ? 'Opération réussie' : 'Action impossible'}</strong>
              <span>{quickActionFeedback.message}</span>
            </div>
          ) : null}

          {!dossier?.legacy?.exists ? (
            <div className='tpi-detail-direct-action-card'>
              <div className='tpi-detail-direct-action-copy'>
                <strong>Créer une fiche GestionTPI de base ici</strong>
                <p>
                  La fiche sera initialisée avec la référence, les parties prenantes et les informations Planning déjà disponibles.
                </p>
              </div>

              <div className='tpi-detail-direct-action-buttons'>
                <button
                  type='button'
                  className='tpi-detail-direct-button is-warning'
                  onClick={handleQuickCreate}
                  disabled={isQuickActionPending}
                >
                  {isQuickActionPending ? 'Création...' : 'Créer la fiche de base ici'}
                </button>
              </div>
            </div>
          ) : (
            <div className='tpi-detail-direct-action-card'>
              <div className='tpi-detail-direct-action-copy'>
                <strong>Édition rapide des champs legacy</strong>
                <p>
                  Tu peux corriger ici les champs les plus courants sans ouvrir `GestionTPI`.
                </p>
              </div>

              <form
                className='tpi-detail-quick-edit-form'
                data-testid='tpi-detail-quick-edit-form'
                key={quickEditFormKey}
                onSubmit={handleQuickEditSubmit}
                ref={quickEditFormRef}
              >
                <div className='tpi-detail-quick-edit-grid'>
                  {quickEditFields.map((field) => (
                    <label key={field.key} className='tpi-detail-quick-edit-field'>
                      <span>{field.label}</span>
                      <input
                        defaultValue={quickEditDefaults[field.key] || ''}
                        name={field.key}
                        type={field.type}
                        aria-label={field.label}
                        placeholder={field.placeholder}
                      />
                    </label>
                  ))}
                </div>

                <div className='tpi-detail-direct-action-buttons'>
                  <button
                    type='button'
                    className='tpi-detail-direct-button'
                    onClick={handleQuickEditCancel}
                    disabled={isQuickActionPending}
                  >
                    Réinitialiser
                  </button>
                  <button
                    type='submit'
                    className='tpi-detail-direct-button is-primary'
                    disabled={isQuickActionPending}
                  >
                    {isQuickActionPending ? 'Enregistrement...' : 'Enregistrer sur la fiche'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      ) : null}

      {remediationCards.length > 0 ? (
        <section className='tpi-detail-section-card'>
          <div className='tpi-detail-section-head'>
            <h2>Correction et complétion</h2>
            <p>Raccourcis ciblés pour corriger les anomalies ou compléter les données de cette fiche.</p>
          </div>

          <div className='tpi-detail-remediation-grid'>
            {remediationCards.map((card) => (
              <article key={card.key} className={`tpi-detail-remediation-card is-${card.tone || 'secondary'}`}>
                <div className='tpi-detail-remediation-copy'>
                  <span className={`tpi-detail-health-next-pill is-${getRemediationPriorityMeta(card.priority).tone}`}>
                    {getRemediationPriorityMeta(card.priority).label}
                  </span>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>

                {Array.isArray(card.tags) && card.tags.length > 0 ? (
                  <div className='tpi-detail-remediation-tags'>
                    {card.tags.map((tag) => (
                      <span key={`${card.key}-${tag}`} className='tpi-detail-remediation-tag'>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className='tpi-detail-remediation-actions'>
                  {card.actions.map((action) => (
                    <ActionLink
                      key={compactText(action?.key) || compactText(action?.label)}
                      action={action}
                      className='tpi-detail-remediation-link'
                    />
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className='tpi-detail-section-card'>
        <div className='tpi-detail-section-head'>
          <h2>Projet et références</h2>
          <p>Les repères utiles du dossier, sans répéter le suivi workflow déjà visible plus haut.</p>
        </div>

        <div className='tpi-detail-grid'>
          <DetailItem
            label='Référence workflow'
            value={workflowReference || 'Non créée'}
            tone={workflowReference ? '' : 'warning'}
          />
          <DetailItem
            label='Référence legacy'
            value={legacyRef || 'Non créée'}
            tone={legacyRef ? '' : 'warning'}
          />
          <DetailItem
            label='Sujet'
            value={subject}
            tone={hasSubject ? '' : 'warning'}
          />
          <DetailItem
            label='Classe'
            value={compactText(planningTpi?.classe) || compactText(legacyTpi?.classe) || 'Non renseignée'}
            tone={hasClass ? '' : 'warning'}
          />
          <DetailItem
            label='Site'
            value={compactText(planningTpi?.site) || compactText(legacyTpi?.site) || compactText(legacyTpi?.lieu?.site) || 'Non renseigné'}
            tone={hasSite ? '' : 'warning'}
          />
          <DetailItem
            label='Entreprise'
            value={compactText(planningTpi?.entreprise?.nom) || compactText(legacyTpi?.lieu?.entreprise) || 'Non renseignée'}
            tone={hasCompany ? '' : 'warning'}
          />
          <DetailItem
            label='Dépôt'
            value={isLikelyUrl(depositLink) ? (
              <a
                className='tpi-detail-item-link'
                href={depositLink}
                target='_blank'
                rel='noreferrer'
              >
                {depositLink}
              </a>
            ) : (depositLink || 'Aucun lien')}
            tone={hasDepositLink ? '' : 'warning'}
          />
        </div>

        <div className='tpi-detail-tag-row'>
          {tags.length > 0 ? tags.map((tag) => (
            <span key={tag} className='tpi-detail-tag'>{tag}</span>
          )) : (
            <span className='tpi-detail-empty'>Aucun tag enregistré.</span>
          )}
        </div>
      </section>

      <section className='tpi-detail-section-card'>
        <div className='tpi-detail-section-head'>
          <h2>Parties prenantes</h2>
          <p>Statut de complétude et de résolution dans le référentiel.</p>
        </div>

        <div className='tpi-detail-grid'>
          <DetailItem label='Candidat' value={candidateName || 'Non renseigné'} tone={hasCandidate ? '' : 'warning'} />
          <DetailItem label='Expert 1' value={expert1Name || 'Non renseigné'} tone={hasExpert1 ? '' : 'warning'} />
          <DetailItem label='Expert 2' value={expert2Name || 'Non renseigné'} tone={hasExpert2 ? '' : 'warning'} />
          <DetailItem label='Chef de projet' value={projectLeadName || 'Non renseigné'} tone={hasProjectLead ? '' : 'warning'} />
        </div>

        <div className='tpi-detail-state-grid'>
          <DetailItem
            label='Complétude'
            value={getCompletenessLabel(stakeholderState, dossier?.legacy?.exists)}
            tone={stakeholderState?.isComplete === false ? 'warning' : ''}
          />
          <DetailItem
            label='Résolution référentiel'
            value={getResolutionLabel(stakeholderState, dossier?.legacy?.exists)}
            tone={stakeholderState?.isResolved === false ? 'warning' : ''}
          />
          <DetailItem
            label='Rôles manquants'
            value={stakeholderState?.missingRoles?.join(', ') || 'Aucun'}
            tone={stakeholderState?.missingRoles?.length ? 'warning' : 'ready'}
          />
          <DetailItem
            label='Rôles non résolus'
            value={stakeholderState?.unresolvedRoles?.join(', ') || 'Aucun'}
            tone={stakeholderState?.unresolvedRoles?.length ? 'warning' : 'ready'}
          />
        </div>
      </section>

      <section className='tpi-detail-section-card'>
        <div className='tpi-detail-section-head'>
          <h2>Planning et votes</h2>
          <p>État workflow, créneau retenu et réponses de vote visibles.</p>
        </div>

        <div className='tpi-detail-grid'>
          <DetailItem label='Statut workflow' value={planningStatusMeta.label} />
          <DetailItem label='Créneau retenu' value={plannedSlotLabel} tone={plannedSlot ? 'ready' : 'warning'} />
          <DetailItem
            label='Votes reçus'
            value={`${Number(voteSummary.respondedVotes || 0)}/${Number(voteSummary.totalVotes || 0)}`}
          />
          <DetailItem
            label='Votes en attente'
            value={String(Number(voteSummary.pendingVotes || 0))}
            tone={Number(voteSummary.pendingVotes || 0) > 0 ? 'warning' : 'ready'}
          />
          <DetailItem
            label='Acceptés + préférés'
            value={String(Number(voteSummary.acceptedVotes || 0) + Number(voteSummary.preferredVotes || 0))}
          />
          <DetailItem
            label='Refusés'
            value={String(Number(voteSummary.rejectedVotes || 0))}
          />
        </div>

        {workflowVoteSummary ? (
          <div className='tpi-detail-inline-list'>
            <span>Expert 1: {workflowVoteSummary.expert1Voted ? 'voté' : 'en attente'}</span>
            <span>Expert 2: {workflowVoteSummary.expert2Voted ? 'voté' : 'en attente'}</span>
            <span>Chef de projet: {workflowVoteSummary.chefProjetVoted ? 'voté' : 'en attente'}</span>
          </div>
        ) : null}

        {votes.length > 0 ? (
          <div className='tpi-detail-table-shell'>
            <table className='tpi-detail-table'>
              <thead>
                <tr>
                  <th>Rôle</th>
                  <th>Décision</th>
                  <th>Votant</th>
                  <th>Créneau</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {votes.map((vote) => (
                  <tr key={compactText(vote?._id) || `${vote?.voterRole}-${vote?.slot?._id || vote?.slot}`}>
                    <td>{formatVoteRole(vote?.voterRole)}</td>
                    <td>{formatVoteDecision(vote?.decision)}</td>
                    <td>{formatPersonName(vote?.voter, '—')}</td>
                    <td>{getPlannedSlotLabel(vote?.slot)}</td>
                    <td>{formatDateTime(vote?.votedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className='tpi-detail-empty'>Aucun vote enregistré pour ce dossier.</p>
        )}
      </section>

      <section className='tpi-detail-section-card'>
        <div className='tpi-detail-section-head'>
          <h2>Contrôles de cohérence</h2>
          <p>Écarts visibles entre GestionTPI et Planning pour cette fiche.</p>
        </div>

        {mergedIssues.length > 0 ? (
          <ul className='tpi-detail-issue-list'>
            {mergedIssues.map((issue) => (
              <li key={issue.key}>
                <strong>{issue.type}</strong>
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className='tpi-detail-empty'>Aucune incohérence bloquante détectée sur cette fiche.</p>
        )}
      </section>
    </div>
  )
}

export default TpiDetailSections
