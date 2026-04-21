import React, { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRightIcon,
  CandidateIcon,
  ExpertIcon,
  ProjectLeadIcon,
  UsersIcon,
  VoteIcon,
  WorkflowIcon,
  CloseIcon,
  FileTextIcon,
  RefreshIcon,
  SaveIcon
} from '../shared/InlineIcons.jsx'

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

const SignalCard = ({ label, value, helper = '', tone = '' }) => (
  <article className={`tpi-detail-signal-card ${tone ? `is-${tone}` : ''}`.trim()}>
    <span>{label}</span>
    <strong>{value || '—'}</strong>
    {helper ? <p>{helper}</p> : null}
  </article>
)

const StageCard = ({ icon: Icon, label, value, helper = '', tone = '' }) => (
  <article className={`tpi-detail-stage-card ${tone ? `is-${tone}` : ''}`.trim()}>
    <div className='tpi-detail-stage-icon' aria-hidden='true'>
      {Icon ? <Icon /> : null}
    </div>
    <div className='tpi-detail-stage-copy'>
      <span>{label}</span>
      <strong>{value || '—'}</strong>
      {helper ? <p>{helper}</p> : null}
    </div>
  </article>
)

const ShortcutLink = ({ label, href }) => (
  <a className='tpi-detail-shortcut-link' href={href}>
    <span>{label}</span>
    <ArrowRightIcon className='tpi-detail-shortcut-icon' />
  </a>
)

const AnchorPill = ({ label, href, count = '' }) => (
  <a className='tpi-detail-anchor-link' href={href}>
    <span>{label}</span>
    {count ? <strong>{count}</strong> : null}
  </a>
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

function normalizeComparisonValue(value) {
  return compactText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function getComparisonStatusMeta(status) {
  switch (status) {
    case 'aligned':
      return { label: 'Aligné', tone: 'ready' }
    case 'mismatch':
      return { label: 'Écart', tone: 'warning' }
    case 'legacy_only':
      return { label: 'Legacy seul', tone: 'secondary' }
    case 'planning_only':
      return { label: 'Planning seul', tone: 'secondary' }
    default:
      return { label: 'Absent', tone: 'muted' }
  }
}

function buildComparisonRow(label, legacyValue, planningValue) {
  const normalizedLegacyValue = compactText(legacyValue)
  const normalizedPlanningValue = compactText(planningValue)
  const hasLegacyValue = Boolean(normalizedLegacyValue)
  const hasPlanningValue = Boolean(normalizedPlanningValue)

  let status = 'missing'

  if (hasLegacyValue && hasPlanningValue) {
    status = normalizeComparisonValue(normalizedLegacyValue) === normalizeComparisonValue(normalizedPlanningValue)
      ? 'aligned'
      : 'mismatch'
  } else if (hasLegacyValue) {
    status = 'legacy_only'
  } else if (hasPlanningValue) {
    status = 'planning_only'
  }

  return {
    key: label,
    label,
    legacyValue: normalizedLegacyValue || '—',
    planningValue: normalizedPlanningValue || '—',
    status,
    statusMeta: getComparisonStatusMeta(status)
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
  legacyRef,
  detailReturnPath
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
            role: target.routeRole,
            tab: 'create',
            year: dossier?.year,
            returnTo: detailReturnPath
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
      title: 'Integrer au workflow de planification',
      description: isBlockedByStakeholders
        ? 'Le TPI n’apparaît pas encore dans le workflow de planification. Les parties prenantes doivent être validées avant intégration.'
        : 'Le TPI n’apparaît pas encore dans le workflow de planification. Vérifie le suivi des TPI non intégrés et relance le workflow annuel si nécessaire.',
      tags: ['Workflow absent'],
      actions: [
        {
          key: 'planning-votes',
          label: 'Voir le suivi de planification',
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

function buildQuickEditPlanningDraft(dossier) {
  const planningTpi = dossier?.planning?.data || null

  return {
    sujet: compactText(planningTpi?.sujet),
    classe: compactText(planningTpi?.classe),
    lieuEntreprise: compactText(planningTpi?.entreprise?.nom),
    lieuSite: compactText(planningTpi?.site),
    lienDepot: ''
  }
}

const TpiDetailSections = ({
  dossier,
  supplementalIssues = [],
  showSummary = true,
  showOverview = true,
  overviewActions = [],
  quickActions = null,
  className = '',
  variant = 'full'
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
  const classValue = compactText(planningTpi?.classe) || compactText(legacyTpi?.classe)
  const siteValue = compactText(planningTpi?.site) || compactText(legacyTpi?.site) || compactText(legacyTpi?.lieu?.site)
  const companyValue = compactText(planningTpi?.entreprise?.nom) || compactText(legacyTpi?.lieu?.entreprise)
  const workflowReference = compactText(dossier?.identifiers?.workflowReference)
  const legacyRef = compactText(dossier?.identifiers?.legacyRef)
  const displayReference = workflowReference || legacyRef || compactText(dossier?.ref)
  const detailReturnPath = dossier?.year && displayReference
    ? `/tpi/${dossier.year}/${encodeURIComponent(displayReference)}`
    : ''
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
  const totalVotesCount = Number(voteSummary.totalVotes || 0)
  const pendingVotesCount = Number(voteSummary.pendingVotes || 0)
  const respondedVotesCount = Number(voteSummary.respondedVotes || 0)
  const favorableVotesCount = Number(voteSummary.acceptedVotes || 0) + Number(voteSummary.preferredVotes || 0)
  const visibleOverviewPills = [
    {
      key: 'planning-status',
      className: `tpi-detail-pill is-${planningStatusMeta.tone}`,
      label: planningStatusMeta.label
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
    legacyRef,
    detailReturnPath
  })
  const hasSubject = Boolean(compactText(planningTpi?.sujet) || compactText(legacyTpi?.sujet))
  const hasClass = Boolean(classValue)
  const hasSite = Boolean(siteValue)
  const hasCompany = Boolean(companyValue)
  const hasDepositLink = Boolean(depositLink)
  const directActionsEnabled = Boolean(quickActions?.onSaveLegacy || quickActions?.onCreateLegacy)
  const quickActionFeedback = quickActions?.feedback || null
  const isQuickActionPending = quickActions?.isPending === true
  const stakeholderTargets = useMemo(() => ([
    getStakeholderTarget('candidat', legacyTpi, planningTpi),
    getStakeholderTarget('expert1', legacyTpi, planningTpi),
    getStakeholderTarget('expert2', legacyTpi, planningTpi),
    getStakeholderTarget('chef_projet', legacyTpi, planningTpi)
  ].filter(Boolean)), [legacyTpi, planningTpi])
  const comparisonRows = useMemo(() => ([
    buildComparisonRow('Sujet', compactText(legacyTpi?.sujet), compactText(planningTpi?.sujet)),
    buildComparisonRow('Classe', compactText(legacyTpi?.classe), compactText(planningTpi?.classe)),
    buildComparisonRow(
      'Site',
      compactText(legacyTpi?.site) || compactText(legacyTpi?.lieu?.site),
      compactText(planningTpi?.site)
    ),
    buildComparisonRow(
      'Entreprise',
      compactText(legacyTpi?.lieu?.entreprise),
      compactText(planningTpi?.entreprise?.nom)
    ),
    buildComparisonRow('Candidat', compactText(legacyTpi?.candidat), formatPersonName(planningTpi?.candidat)),
    buildComparisonRow('Expert 1', getLegacyExpert(legacyTpi, '1'), formatPersonName(planningTpi?.expert1)),
    buildComparisonRow('Expert 2', getLegacyExpert(legacyTpi, '2'), formatPersonName(planningTpi?.expert2)),
    buildComparisonRow('Chef de projet', compactText(legacyTpi?.boss), formatPersonName(planningTpi?.chefProjet))
  ]), [legacyTpi, planningTpi])
  const comparisonSummary = useMemo(() => comparisonRows.reduce((summary, row) => {
    summary[row.status] = Number(summary[row.status] || 0) + 1
    return summary
  }, {
    aligned: 0,
    mismatch: 0,
    legacy_only: 0,
    planning_only: 0,
    missing: 0
  }), [comparisonRows])
  const comparisonAttentionCount = useMemo(
    () => comparisonRows.filter((row) => row.status !== 'aligned').length,
    [comparisonRows]
  )
  const comparisonAlignedCount = useMemo(
    () => comparisonRows.filter((row) => row.status === 'aligned').length,
    [comparisonRows]
  )
  const healthSummary = buildHealthSummary({
    dossier,
    remediationCards,
    mergedIssues,
    stakeholderState,
    plannedSlot,
    planningStatusMeta
  })
  const stakeholderSummaryTone = !dossier?.legacy?.exists
    ? 'muted'
    : stakeholderState?.isResolved
      ? 'ready'
      : stakeholderState?.isComplete
        ? 'secondary'
        : 'warning'
  const [comparisonFilter, setComparisonFilter] = useState(
    comparisonAttentionCount > 0 ? 'attention' : 'all'
  )
  const isPanelVariant = variant === 'panel'
  const shouldRenderSummaryGrid = showSummary && !showOverview
  const showAnchorNav = !isPanelVariant
  const showHealthSection = !isPanelVariant
  const showDirectActionsSection = !isPanelVariant && directActionsEnabled
  const showRemediationSection = !isPanelVariant && remediationCards.length > 0
  const showComparisonSection = !isPanelVariant
  const showStakeholderShortcuts = !isPanelVariant
  const showVotesTable = !isPanelVariant
  const quickEditFields = useMemo(() => ([
    { key: 'sujet', label: 'Sujet', type: 'text', placeholder: 'Sujet du TPI' },
    { key: 'classe', label: 'Classe', type: 'text', placeholder: 'Classe' },
    { key: 'lieuEntreprise', label: 'Entreprise', type: 'text', placeholder: 'Entreprise' },
    { key: 'lieuSite', label: 'Site', type: 'text', placeholder: 'Site' },
    { key: 'lienDepot', label: 'Dépôt git', type: 'url', placeholder: 'https://...' }
  ]), [])
  const quickEditDefaults = useMemo(() => buildQuickEditDraft(dossier), [dossier])
  const quickEditPlanningValues = useMemo(() => buildQuickEditPlanningDraft(dossier), [dossier])
  const quickEditFormRef = useRef(null)
  const availablePlanningSuggestionCount = useMemo(
    () =>
      quickEditFields.filter((field) => (
        compactText(quickEditPlanningValues[field.key]) &&
        compactText(quickEditPlanningValues[field.key]) !== compactText(quickEditDefaults[field.key])
      )).length,
    [quickEditDefaults, quickEditFields, quickEditPlanningValues]
  )
  const overviewFacts = useMemo(() => ([
    {
      key: 'workflow-ref',
      label: 'Référence workflow',
      value: workflowReference || 'Non créée',
      helper: workflowReference ? 'Identifiant du workflow Planning' : 'Aucune référence Planning visible',
      tone: workflowReference ? 'ready' : 'warning'
    },
    {
      key: 'legacy-ref',
      label: 'Référence legacy',
      value: legacyRef || 'Non créée',
      helper: dossier?.legacy?.exists ? 'Fiche GestionTPI trouvée' : 'Création legacy encore nécessaire',
      tone: dossier?.legacy?.exists ? 'ready' : 'warning'
    },
    {
      key: 'class-site',
      label: 'Classe / site',
      value: [classValue, siteValue].filter(Boolean).join(' · ') || 'Non renseignés',
      helper: companyValue || 'Entreprise non renseignée',
      tone: hasClass && hasSite ? 'ready' : hasClass || hasSite ? 'secondary' : 'warning'
    },
    {
      key: 'slot',
      label: 'Créneau',
      value: plannedSlotLabel,
      helper: dossier?.planning?.exists ? planningStatusMeta.label : 'Workflow absent',
      tone: plannedSlot ? 'ready' : dossier?.planning?.exists ? 'warning' : 'muted'
    },
    {
      key: 'votes',
      label: 'Votes',
      value: totalVotesCount > 0 ? `${respondedVotesCount}/${totalVotesCount} reçus` : 'Aucun vote',
      helper: pendingVotesCount > 0
        ? `${pendingVotesCount} en attente`
        : totalVotesCount > 0
          ? `${favorableVotesCount} favorable(s)`
          : 'Campagne non démarrée',
      tone: pendingVotesCount > 0 ? 'warning' : totalVotesCount > 0 ? 'ready' : 'muted'
    },
    {
      key: 'coherence',
      label: 'Contrôles',
      value: mergedIssues.length > 0
        ? `${mergedIssues.length} anomalie${mergedIssues.length > 1 ? 's' : ''}`
        : 'Aucune alerte',
      helper: healthSummary.tone === 'ready'
        ? 'Dossier exploitable immédiatement'
        : healthSummary.tone === 'warning'
          ? 'Intervention prioritaire encore visible'
          : 'Quelques ajustements restent à prévoir',
      tone: mergedIssues.length > 0 ? 'warning' : 'ready'
    }
  ]), [
    classValue,
    companyValue,
    dossier?.legacy?.exists,
    dossier?.planning?.exists,
    favorableVotesCount,
    hasClass,
    hasSite,
    healthSummary.label,
    legacyRef,
    mergedIssues.length,
    pendingVotesCount,
    plannedSlot,
    plannedSlotLabel,
    planningStatusMeta.label,
    respondedVotesCount,
    siteValue,
    totalVotesCount,
    workflowReference
  ])
  const stageItems = useMemo(() => {
    const stakeholderValue = !dossier?.legacy?.exists
      ? 'En attente de fiche'
      : stakeholderState?.isResolved
        ? 'Référentiel validé'
        : stakeholderState?.isComplete
          ? 'Liaisons à confirmer'
          : 'Parties à compléter'
    const stakeholderHelper = stakeholderState?.missingRoles?.length
      ? `Rôles manquants: ${stakeholderState.missingRoles.join(', ')}`
      : stakeholderState?.unresolvedRoles?.length
        ? `Rôles à relier: ${stakeholderState.unresolvedRoles.join(', ')}`
        : dossier?.legacy?.exists
          ? 'Les personnes clés sont exploitables'
          : 'Le référentiel dépend de la fiche source'
    const planningTone = !dossier?.planning?.exists
      ? 'warning'
      : plannedSlot
        ? 'ready'
        : planningStatusMeta.tone === 'warning'
          ? 'warning'
          : 'secondary'
    const votingValue = totalVotesCount > 0
      ? `${respondedVotesCount}/${totalVotesCount} votes`
      : dossier?.planning?.exists
        ? 'Votes non démarrés'
        : 'En attente de planning'
    const votingHelper = plannedSlot
      ? `Créneau ${plannedSlotLabel}`
      : dossier?.planning?.exists
        ? 'Créneau encore à confirmer'
        : 'Publier le TPI avant la campagne de votes'
    const votingTone = plannedSlot && pendingVotesCount === 0 && totalVotesCount > 0
      ? 'ready'
      : plannedSlot || totalVotesCount > 0
        ? 'secondary'
        : 'muted'

    return [
      {
        key: 'legacy',
        icon: FileTextIcon,
        label: '1. Fiche source',
        value: dossier?.legacy?.exists ? 'GestionTPI prête' : 'À créer',
        helper: dossier?.legacy?.exists
          ? (legacyRef || 'Référence legacy détectée')
          : 'Création possible depuis les données Planning',
        tone: dossier?.legacy?.exists ? 'ready' : 'warning'
      },
      {
        key: 'stakeholders',
        icon: UsersIcon,
        label: '2. Référentiel',
        value: stakeholderValue,
        helper: stakeholderHelper,
        tone: stakeholderSummaryTone
      },
      {
        key: 'planning',
        icon: WorkflowIcon,
        label: '3. Planning',
        value: dossier?.planning?.exists ? planningStatusMeta.label : 'Non importé',
        helper: dossier?.planning?.exists
          ? (plannedSlot ? plannedSlotLabel : 'Aucun créneau confirmé')
          : 'Le TPI n’apparaît pas dans le workflow',
        tone: planningTone
      },
      {
        key: 'votes',
        icon: VoteIcon,
        label: '4. Votes / soutenance',
        value: votingValue,
        helper: votingHelper,
        tone: votingTone
      }
    ]
  }, [
    dossier?.legacy?.exists,
    dossier?.planning?.exists,
    legacyRef,
    pendingVotesCount,
    plannedSlot,
    plannedSlotLabel,
    planningStatusMeta.label,
    planningStatusMeta.tone,
    respondedVotesCount,
    stakeholderState,
    stakeholderSummaryTone,
    totalVotesCount
  ])
  const overviewShortcuts = useMemo(() => {
    const correctionHref = directActionsEnabled
      ? '#tpi-detail-direct-actions'
      : remediationCards.length > 0
        ? '#tpi-detail-correction'
        : '#tpi-detail-comparison'

    return [
      {
        key: 'correction',
        label: directActionsEnabled || remediationCards.length > 0
          ? 'Aller aux corrections'
          : 'Voir la lecture croisée',
        href: correctionHref
      },
      { key: 'stakeholders', label: 'Parties prenantes', href: '#tpi-detail-stakeholders' },
      { key: 'planning', label: 'Planning et votes', href: '#tpi-detail-planning' },
      { key: 'issues', label: 'Contrôles', href: '#tpi-detail-issues' }
    ]
  }, [directActionsEnabled, remediationCards.length])
  const overviewPeople = useMemo(() => ([
    {
      key: 'candidate',
      icon: CandidateIcon,
      label: 'Candidat',
      value: candidateName || 'Non renseigné'
    },
    {
      key: 'expert1',
      icon: ExpertIcon,
      label: 'Expert 1',
      value: expert1Name || 'Non renseigné'
    },
    {
      key: 'expert2',
      icon: ExpertIcon,
      label: 'Expert 2',
      value: expert2Name || 'Non renseigné'
    },
    {
      key: 'project-lead',
      icon: ProjectLeadIcon,
      label: 'Chef de projet',
      value: projectLeadName || 'Non renseigné'
    }
  ]), [candidateName, expert1Name, expert2Name, projectLeadName])
  const correctionSectionTarget = directActionsEnabled
    ? '#tpi-detail-direct-actions'
    : remediationCards.length > 0
      ? '#tpi-detail-correction'
      : '#tpi-detail-comparison'
  const anchorLinks = useMemo(() => ([
    { key: 'health', label: 'État', href: '#tpi-detail-health' },
    {
      key: 'correction',
      label: directActionsEnabled || remediationCards.length > 0 ? 'Corrections' : 'Lecture croisée',
      href: correctionSectionTarget,
      count: directActionsEnabled
        ? 'direct'
        : remediationCards.length > 0
          ? String(remediationCards.length)
          : ''
    },
    {
      key: 'comparison',
      label: 'Lecture croisée',
      href: '#tpi-detail-comparison',
      count: comparisonAttentionCount > 0 ? String(comparisonAttentionCount) : ''
    },
    {
      key: 'stakeholders',
      label: 'Parties prenantes',
      href: '#tpi-detail-stakeholders',
      count: Number(stakeholderState?.missingRoles?.length || 0) + Number(stakeholderState?.unresolvedRoles?.length || 0) > 0
        ? String(Number(stakeholderState?.missingRoles?.length || 0) + Number(stakeholderState?.unresolvedRoles?.length || 0))
        : ''
    },
    {
      key: 'planning',
      label: 'Planning / votes',
      href: '#tpi-detail-planning',
      count: pendingVotesCount > 0 ? String(pendingVotesCount) : ''
    },
    {
      key: 'issues',
      label: 'Contrôles',
      href: '#tpi-detail-issues',
      count: mergedIssues.length > 0 ? String(mergedIssues.length) : ''
    }
  ]), [
    comparisonAttentionCount,
    correctionSectionTarget,
    directActionsEnabled,
    mergedIssues.length,
    pendingVotesCount,
    remediationCards.length,
    stakeholderState
  ])
  const filteredComparisonRows = useMemo(() => {
    if (comparisonFilter === 'attention') {
      return comparisonRows.filter((row) => row.status !== 'aligned')
    }

    if (comparisonFilter === 'aligned') {
      return comparisonRows.filter((row) => row.status === 'aligned')
    }

    return comparisonRows
  }, [comparisonFilter, comparisonRows])

  const handleQuickEditCancel = () => {
    quickEditFormRef.current?.reset()
  }

  const updateQuickEditFieldValue = (fieldKey, nextValue) => {
    const fieldNode = quickEditFormRef.current?.elements?.namedItem(fieldKey)

    if (!fieldNode || typeof fieldNode === 'undefined') {
      return
    }

    fieldNode.value = nextValue || ''
  }

  const handleApplyPlanningValue = (fieldKey) => {
    updateQuickEditFieldValue(fieldKey, quickEditPlanningValues[fieldKey] || '')
  }

  const handleApplyAllPlanningValues = () => {
    quickEditFields.forEach((field) => {
      const planningValue = compactText(quickEditPlanningValues[field.key])

      if (!planningValue) {
        return
      }

      updateQuickEditFieldValue(field.key, planningValue)
    })
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
          <div className='tpi-detail-overview-main'>
            <div className='tpi-detail-overview-copy'>
              <span className='tpi-detail-overview-kicker'>
                {displayReference ? `Fiche ${displayReference}` : 'Fiche TPI'}
              </span>
              <h2 className='tpi-detail-overview-title'>{candidateName || 'Candidat non renseigné'}</h2>
              <p className='tpi-detail-overview-subtitle'>{subject}</p>
            </div>

            <div className='tpi-detail-overview-people'>
              {overviewPeople.map((person) => (
                <article key={person.key} className='tpi-detail-overview-persona'>
                  <div className='tpi-detail-overview-persona-icon' aria-hidden='true'>
                    <person.icon />
                  </div>
                  <div className='tpi-detail-overview-persona-copy'>
                    <strong>{person.label}</strong>
                    <span>{person.value}</span>
                  </div>
                </article>
              ))}
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

            <div className='tpi-detail-overview-shortcuts'>
              {overviewShortcuts.map((shortcut) => (
                <ShortcutLink key={shortcut.key} label={shortcut.label} href={shortcut.href} />
              ))}
            </div>
          </div>

          <aside className='tpi-detail-overview-panel'>
            <div className='tpi-detail-overview-facts'>
              {overviewFacts.map((fact) => (
                <SignalCard
                  key={fact.key}
                  label={fact.label}
                  value={fact.value}
                  helper={fact.helper}
                  tone={fact.tone}
                />
              ))}
            </div>

            <div className='tpi-detail-stage-shell'>
              <div className='tpi-detail-stage-head'>
                <span>Lecture du dossier</span>
                <strong>Parcours opérationnel</strong>
              </div>

              <div className='tpi-detail-stage-list'>
                {stageItems.map((item) => (
                  <StageCard
                    key={item.key}
                    icon={item.icon}
                    label={item.label}
                    value={item.value}
                    helper={item.helper}
                    tone={item.tone}
                  />
                ))}
              </div>
            </div>
          </aside>
        </section>
      ) : null}

      {showAnchorNav ? (
        <nav className='tpi-detail-anchor-nav' aria-label='Navigation interne de la fiche'>
          {anchorLinks.map((link) => (
            <AnchorPill
              key={link.key}
              label={link.label}
              href={link.href}
              count={link.count}
            />
          ))}
        </nav>
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

      <div className={`tpi-detail-layout ${isPanelVariant ? 'is-panel-layout' : ''}`.trim()}>
        {!isPanelVariant ? (
          <div className='tpi-detail-layout-primary'>
            {showHealthSection ? (
              <section
                id='tpi-detail-health'
                className={`tpi-detail-section-card tpi-detail-health is-${healthSummary.tone}`}
              >
                <div className='tpi-detail-section-head'>
                  <div className='tpi-detail-health-copy'>
                    <span className={`tpi-detail-health-kicker is-${healthSummary.tone}`}>Santé du dossier</span>
                    <h2>{healthSummary.label}</h2>
                    <p>{healthSummary.summary}</p>
                  </div>
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
            ) : null}

            {showDirectActionsSection ? (
              <section id='tpi-detail-direct-actions' className='tpi-detail-section-card'>
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
                        title='Créer la fiche de base ici'
                      >
                        <FileTextIcon className='tpi-detail-direct-button-icon' />
                        <span>{isQuickActionPending ? 'Création...' : 'Créer la fiche'}</span>
                        <span className='sr-only'>
                          {isQuickActionPending ? 'Création...' : 'Créer la fiche de base ici'}
                        </span>
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

                    {availablePlanningSuggestionCount > 0 ? (
                      <div className='tpi-detail-direct-suggestions'>
                        <span>{availablePlanningSuggestionCount} reprise(s) possible(s) depuis Planning</span>
                        <button
                          type='button'
                          className='tpi-detail-direct-button'
                          onClick={handleApplyAllPlanningValues}
                          disabled={isQuickActionPending}
                          title='Reprendre toutes les valeurs Planning disponibles'
                        >
                          <RefreshIcon className='tpi-detail-direct-button-icon' />
                          <span>Reprendre Planning</span>
                          <span className='sr-only'>Reprendre toutes les valeurs Planning</span>
                        </button>
                      </div>
                    ) : null}

                    <form
                      className='tpi-detail-quick-edit-form'
                      data-testid='tpi-detail-quick-edit-form'
                      onSubmit={handleQuickEditSubmit}
                      ref={quickEditFormRef}
                    >
                      <div className='tpi-detail-quick-edit-grid'>
                        {quickEditFields.map((field) => (
                          <div key={field.key} className='tpi-detail-quick-edit-field'>
                            <div className='tpi-detail-quick-edit-label-row'>
                              <label htmlFor={`quick-edit-${field.key}`}>{field.label}</label>
                              {compactText(quickEditPlanningValues[field.key]) &&
                              compactText(quickEditPlanningValues[field.key]) !== compactText(quickEditDefaults[field.key]) ? (
                                <button
                                  type='button'
                                  className='tpi-detail-quick-edit-field-action'
                                  onClick={() => handleApplyPlanningValue(field.key)}
                                  title={`Reprendre la valeur Planning pour ${field.label}`}
                                >
                                  <RefreshIcon className='tpi-detail-direct-button-icon' />
                                  <span className='sr-only'>{`Reprendre la valeur Planning pour ${field.label}`}</span>
                                </button>
                              ) : null}
                            </div>
                            <input
                              id={`quick-edit-${field.key}`}
                              defaultValue={quickEditDefaults[field.key] || ''}
                              name={field.key}
                              type={field.type}
                              aria-label={field.label}
                              placeholder={field.placeholder}
                            />
                            {compactText(quickEditPlanningValues[field.key]) ? (
                              <small className='tpi-detail-quick-edit-hint'>
                                Planning: {quickEditPlanningValues[field.key]}
                              </small>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      <div className='tpi-detail-direct-action-buttons'>
                        <button
                          type='button'
                          className='tpi-detail-direct-button'
                          onClick={handleQuickEditCancel}
                          disabled={isQuickActionPending}
                          title='Réinitialiser'
                        >
                          <CloseIcon className='tpi-detail-direct-button-icon' />
                          <span>Réinitialiser</span>
                          <span className='sr-only'>Réinitialiser</span>
                        </button>
                        <button
                          type='submit'
                          className='tpi-detail-direct-button is-primary'
                          disabled={isQuickActionPending}
                          title='Enregistrer sur la fiche'
                        >
                          <SaveIcon className='tpi-detail-direct-button-icon' />
                          <span>{isQuickActionPending ? 'Enregistrement...' : 'Enregistrer'}</span>
                          <span className='sr-only'>
                            {isQuickActionPending ? 'Enregistrement...' : 'Enregistrer sur la fiche'}
                          </span>
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </section>
            ) : null}

            {showRemediationSection ? (
              <section id='tpi-detail-correction' className='tpi-detail-section-card'>
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

            {showComparisonSection ? (
              <section id='tpi-detail-comparison' className='tpi-detail-section-card'>
                <div className='tpi-detail-section-head'>
                  <h2>Lecture croisée GestionTPI / Planning</h2>
                  <p>Vue comparative des champs critiques pour repérer immédiatement les écarts entre la fiche legacy et le workflow.</p>
                </div>

                <div className='tpi-detail-section-meta tpi-detail-comparison-stats'>
                  {comparisonSummary.aligned > 0 ? (
                    <span className='tpi-detail-comparison-pill is-ready'>
                      {comparisonSummary.aligned} aligné{comparisonSummary.aligned > 1 ? 's' : ''}
                    </span>
                  ) : null}
                  {comparisonSummary.mismatch > 0 ? (
                    <span className='tpi-detail-comparison-pill is-warning'>
                      {comparisonSummary.mismatch} écart{comparisonSummary.mismatch > 1 ? 's' : ''}
                    </span>
                  ) : null}
                  {comparisonSummary.legacy_only > 0 ? (
                    <span className='tpi-detail-comparison-pill is-secondary'>
                      {comparisonSummary.legacy_only} legacy seul{comparisonSummary.legacy_only > 1 ? 's' : ''}
                    </span>
                  ) : null}
                  {comparisonSummary.planning_only > 0 ? (
                    <span className='tpi-detail-comparison-pill is-secondary'>
                      {comparisonSummary.planning_only} planning seul{comparisonSummary.planning_only > 1 ? 's' : ''}
                    </span>
                  ) : null}
                  {comparisonSummary.missing > 0 ? (
                    <span className='tpi-detail-comparison-pill is-muted'>
                      {comparisonSummary.missing} absent{comparisonSummary.missing > 1 ? 's' : ''}
                    </span>
                  ) : null}
                </div>

                <div className='tpi-detail-comparison-toolbar'>
                  <div className='tpi-detail-filter-strip' role='group' aria-label='Filtrer la lecture croisée'>
                    <button
                      type='button'
                      className={comparisonFilter === 'attention' ? 'active' : ''}
                      aria-pressed={comparisonFilter === 'attention'}
                      onClick={() => setComparisonFilter('attention')}
                    >
                      À corriger
                      <strong>{comparisonAttentionCount}</strong>
                    </button>
                    <button
                      type='button'
                      className={comparisonFilter === 'all' ? 'active' : ''}
                      aria-pressed={comparisonFilter === 'all'}
                      onClick={() => setComparisonFilter('all')}
                    >
                      Vue complète
                      <strong>{comparisonRows.length}</strong>
                    </button>
                    <button
                      type='button'
                      className={comparisonFilter === 'aligned' ? 'active' : ''}
                      aria-pressed={comparisonFilter === 'aligned'}
                      onClick={() => setComparisonFilter('aligned')}
                    >
                      Alignés
                      <strong>{comparisonAlignedCount}</strong>
                    </button>
                  </div>

                  <p className='tpi-detail-comparison-helper'>
                    {comparisonFilter === 'attention'
                      ? 'Affiche uniquement les champs à vérifier ou à compléter.'
                      : comparisonFilter === 'aligned'
                        ? 'Affiche uniquement les champs cohérents entre GestionTPI et Planning.'
                        : 'Affiche l’ensemble des champs comparés.'}
                  </p>
                </div>

                <div className='tpi-detail-table-shell'>
                  <table className='tpi-detail-table tpi-detail-comparison-table'>
                    <thead>
                      <tr>
                        <th>Champ</th>
                        <th>GestionTPI</th>
                        <th>Planning</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredComparisonRows.length > 0 ? (
                        filteredComparisonRows.map((row) => (
                          <tr key={row.key}>
                            <td>{row.label}</td>
                            <td>{row.legacyValue}</td>
                            <td>{row.planningValue}</td>
                            <td>
                              <span className={`tpi-detail-comparison-pill is-${row.statusMeta.tone}`}>
                                {row.statusMeta.label}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan='4'>
                            <p className='tpi-detail-empty tpi-detail-table-empty'>
                              Aucun champ ne correspond à ce filtre.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        <div className='tpi-detail-layout-secondary'>
          <section id='tpi-detail-project' className='tpi-detail-section-card'>
            <div className='tpi-detail-section-head'>
              <h2>Projet et références</h2>
              <p>Les repères utiles du dossier, sans répéter le suivi workflow déjà visible plus haut.</p>
            </div>

            <div className='tpi-detail-section-meta'>
              <span className={`tpi-detail-pill is-${workflowReference ? 'ready' : 'warning'}`}>
                {workflowReference ? 'Workflow lié' : 'Workflow absent'}
              </span>
              <span className={`tpi-detail-pill is-${legacyRef ? 'ready' : 'warning'}`}>
                {legacyRef ? 'Référence legacy trouvée' : 'Référence legacy absente'}
              </span>
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
                value={classValue || 'Non renseignée'}
                tone={hasClass ? '' : 'warning'}
              />
              <DetailItem
                label='Site'
                value={siteValue || 'Non renseigné'}
                tone={hasSite ? '' : 'warning'}
              />
              <DetailItem
                label='Entreprise'
                value={companyValue || 'Non renseignée'}
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

          <section id='tpi-detail-stakeholders' className='tpi-detail-section-card'>
            <div className='tpi-detail-section-head'>
              <h2>Parties prenantes</h2>
              <p>Statut de complétude, résolution dans le référentiel et accès direct aux fiches parties prenantes.</p>
            </div>

            <div className='tpi-detail-section-meta'>
              <span className={`tpi-detail-pill is-${stakeholderState?.isComplete === false ? 'warning' : dossier?.legacy?.exists ? 'ready' : 'muted'}`}>
                {getCompletenessLabel(stakeholderState, dossier?.legacy?.exists)}
              </span>
              <span className={`tpi-detail-pill is-${stakeholderState?.isResolved === false ? 'warning' : dossier?.legacy?.exists ? 'ready' : 'muted'}`}>
                {getResolutionLabel(stakeholderState, dossier?.legacy?.exists)}
              </span>
            </div>

            <div className='tpi-detail-grid'>
              {stakeholderTargets.map((target) => (
                <DetailItem
                  key={target.label}
                  label={target.label}
                  value={target.name || 'Non renseigné'}
                  tone={target.name ? '' : 'warning'}
                />
              ))}
            </div>

            {showStakeholderShortcuts ? (
              <div className='tpi-detail-overview-actions'>
                {stakeholderTargets.map((target) => (
                  target.name || target.personId ? (
                    <ActionLink
                      key={`stakeholder-${target.label}`}
                      action={{
                        key: `stakeholder-${target.label}`,
                        label: `Ouvrir ${target.label}`,
                        to: buildPartiesPrenantesLink({
                          personId: target.personId,
                          name: target.name,
                          role: target.routeRole,
                          tab: 'create',
                          year: dossier?.year,
                          returnTo: detailReturnPath
                        }),
                        tone: 'secondary'
                      }}
                      className='tpi-detail-overview-link'
                    />
                  ) : null
                ))}
              </div>
            ) : null}

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

          <section id='tpi-detail-planning' className='tpi-detail-section-card'>
            <div className='tpi-detail-section-head'>
              <h2>Planning et votes</h2>
              <p>État workflow, créneau retenu et réponses de vote visibles.</p>
            </div>

            <div className='tpi-detail-section-meta'>
              <span className={`tpi-detail-pill is-${planningStatusMeta.tone}`}>{planningStatusMeta.label}</span>
              <span className={`tpi-detail-pill is-${pendingVotesCount > 0 ? 'warning' : totalVotesCount > 0 ? 'ready' : 'muted'}`}>
                {pendingVotesCount > 0 ? `${pendingVotesCount} vote(s) en attente` : totalVotesCount > 0 ? 'Votes à jour' : 'Campagne vide'}
              </span>
            </div>

            <div className='tpi-detail-grid'>
              <DetailItem label='Statut workflow' value={planningStatusMeta.label} />
              <DetailItem label='Créneau retenu' value={plannedSlotLabel} tone={plannedSlot ? 'ready' : 'warning'} />
              <DetailItem
                label='Votes reçus'
                value={`${respondedVotesCount}/${totalVotesCount}`}
              />
              <DetailItem
                label='Votes en attente'
                value={String(pendingVotesCount)}
                tone={pendingVotesCount > 0 ? 'warning' : 'ready'}
              />
              <DetailItem
                label='Acceptés + préférés'
                value={String(favorableVotesCount)}
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

            {votes.length > 0 && showVotesTable ? (
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
            ) : votes.length > 0 ? (
              <p className='tpi-detail-empty'>Le détail complet des votes est disponible dans la fiche complète.</p>
            ) : (
              <p className='tpi-detail-empty'>Aucun vote enregistré pour ce dossier.</p>
            )}
          </section>

          <section id='tpi-detail-issues' className='tpi-detail-section-card'>
            <div className='tpi-detail-section-head'>
              <h2>Contrôles de cohérence</h2>
              <p>Écarts visibles entre GestionTPI et Planning pour cette fiche.</p>
            </div>

            <div className='tpi-detail-section-meta'>
              <span className={`tpi-detail-pill is-${mergedIssues.length > 0 ? 'warning' : 'ready'}`}>
                {mergedIssues.length > 0
                  ? `${mergedIssues.length} point(s) à corriger`
                  : 'Aucune incohérence détectée'}
              </span>
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
      </div>
    </div>
  )
}

export default TpiDetailSections
