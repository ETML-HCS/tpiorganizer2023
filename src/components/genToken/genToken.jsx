import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import IconButtonContent from '../shared/IconButtonContent'
import PageToolbar from '../shared/PageToolbar'
import {
  AlertIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CheckIcon,
  ClipboardIcon,
  KeyIcon,
  MailIcon,
  RefreshIcon,
  SearchIcon,
  SendIcon,
  VoteIcon,
  WorkflowIcon
} from '../shared/InlineIcons'
import { STORAGE_KEYS, YEARS_CONFIG } from '../../config/appConfig'
import accessLinkPolicy from '../../../shared/accessLinkPolicy.json'
import {
  STATIC_VOTE_REGENERATION_CONFIRM_MESSAGE,
  STATIC_VOTE_REGENERATION_NOTICE
} from '../../constants/staticVotePublication'
import {
  coordinationConfigService,
  workflowCoordinationService
} from '../../services/coordinationService'
import { readStorageValue, writeStorageValue } from '../../utils/storage'
import { persistCoordinationYear } from '../../utils/coordinationYear'
import { getTpiRelationRoleLabel, normalizeRoleList } from '../../utils/stakeholderRules'

import '../../css/genToken/genToken.css'

const ACCESS_PHASE_FILTERS = [
  { value: 'vote', label: 'Votes' },
  { value: 'soutenance', label: 'Défenses' },
  { value: 'arbitrage', label: 'Arbitrage' }
]

const ACCESS_PHASE_FILTER_VALUES = new Set(ACCESS_PHASE_FILTERS.map((filter) => filter.value))
const DEFAULT_ACCESS_PHASE_FILTERS = ACCESS_PHASE_FILTERS.map((filter) => filter.value)
const DEFAULT_ACCESS_LINK_SETTINGS = Object.freeze({
  ...accessLinkPolicy.defaultSettings
})
const CANDIDATE_ROLE_LABEL = getTpiRelationRoleLabel('candidat')
const ACCESS_EMAIL_DELIVERY_STORAGE_KEY = STORAGE_KEYS.ACCESS_LINK_EMAIL_DELIVERIES || 'accessLinkEmailDeliveries'
const ACCESS_EMAIL_DELIVERY_MODE_STORAGE_KEY = 'accessLinkSoutenanceEmailDeliveryMode'
const ACCESS_EMAIL_MESSAGE_TYPE_STORAGE_KEY = 'accessLinkSoutenanceEmailMessageType'
const ACCESS_EMAIL_DELIVERY_MODES = Object.freeze({
  SMTP: 'smtp',
  OUTLOOK: 'outlook'
})
const ACCESS_EMAIL_MESSAGE_TYPES = Object.freeze({
  STANDARD: 'standard',
  SCHEDULE_UPDATE: 'schedule_update'
})
const ACCESS_AUDIT_ACTION_LABELS = Object.freeze({
  'workflow.access-links.generate': 'Génération accès',
  'workflow.access-links.reconcile': 'Rattrapage défense',
  'workflow.access-links.email-send': 'Email HTML',
  'workflow.access-links.email-test': 'Test email HTML',
  'workflow.access-links.email-reset': 'Reset emails',
  'workflow.publication.publish': 'Publication défense',
  'workflow.publication.send-links': 'Envoi liens défense',
  'workflow.publication.defense-changes.send': 'Notif. changements',
  'workflow.staticPublication.generate': 'Site défense',
  'workflow.staticPublication.publish': 'Publication site défense',
  'workflow.staticVotes.generate': 'Site votes',
  'workflow.staticVotes.publish': 'Publication site votes',
  'workflow.staticVotes.sync': 'Sync site votes'
})
const ACCESS_AUDIT_ACTIONS = new Set(Object.keys(ACCESS_AUDIT_ACTION_LABELS))
const ACCESS_LOG_STATUS_LABELS = Object.freeze({
  success: 'Succès',
  invalid: 'Invalide',
  not_found: 'Introuvable',
  revoked: 'Révoqué',
  expired: 'Expiré',
  exhausted: 'Épuisé',
  error: 'Erreur'
})
const ACCESS_LOG_TYPE_LABELS = Object.freeze({
  vote: 'Vote',
  soutenance: 'Défense',
  arbitrage: 'Arbitrage'
})

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function readAccessEmailDeliveryStore() {
  const rawValue = readStorageValue(ACCESS_EMAIL_DELIVERY_STORAGE_KEY, '{}')

  try {
    const parsed = JSON.parse(rawValue)
    return isPlainObject(parsed) ? parsed : {}
  } catch (error) {
    return {}
  }
}

function readAccessEmailDeliveryLedger(year) {
  const store = readAccessEmailDeliveryStore()
  const yearLedger = store[String(year)]
  return isPlainObject(yearLedger) ? yearLedger : {}
}

function writeAccessEmailDeliveryLedger(year, ledger) {
  const store = readAccessEmailDeliveryStore()
  store[String(year)] = isPlainObject(ledger) ? ledger : {}
  writeStorageValue(ACCESS_EMAIL_DELIVERY_STORAGE_KEY, JSON.stringify(store))
}

function hashAccessEmailKey(value) {
  const text = String(value || '')
  let hash = 0

  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash).toString(36)
}

function getStoredShowCandidatesPreference() {
  return readStorageValue(STORAGE_KEYS.ACCESS_LINK_SHOW_CANDIDATES, 'true') !== 'false'
}

function getStoredSoutenanceEmailDeliveryMode() {
  return readStorageValue(
    ACCESS_EMAIL_DELIVERY_MODE_STORAGE_KEY,
    ACCESS_EMAIL_DELIVERY_MODES.SMTP
  ) === ACCESS_EMAIL_DELIVERY_MODES.OUTLOOK
    ? ACCESS_EMAIL_DELIVERY_MODES.OUTLOOK
    : ACCESS_EMAIL_DELIVERY_MODES.SMTP
}

function getStoredSoutenanceEmailMessageType() {
  return readStorageValue(
    ACCESS_EMAIL_MESSAGE_TYPE_STORAGE_KEY,
    ACCESS_EMAIL_MESSAGE_TYPES.STANDARD
  ) === ACCESS_EMAIL_MESSAGE_TYPES.SCHEDULE_UPDATE
    ? ACCESS_EMAIL_MESSAGE_TYPES.SCHEDULE_UPDATE
    : ACCESS_EMAIL_MESSAGE_TYPES.STANDARD
}

function getStoredAccessYear() {
  const storedYear = Number.parseInt(readStorageValue(STORAGE_KEYS.COORDINATION_SELECTED_YEAR, ''), 10)
  return YEARS_CONFIG.isSupportedYear(storedYear) ? storedYear : null
}

function formatNonZeroCount(value, singularLabel, pluralLabel = `${singularLabel}s`) {
  const count = Number.parseInt(String(value || 0), 10)
  if (!Number.isInteger(count) || count <= 0) {
    return null
  }

  return `${count} ${count > 1 ? pluralLabel : singularLabel}`
}

function isCandidateRole(role) {
  const normalizedRole = String(role || '').trim().toLowerCase()
  return normalizedRole === 'candidat' || normalizedRole === 'candidate'
}

function isExpertRole(role) {
  return normalizeRoleList([role]).includes('expert')
}

function getAccessPersonRoles(person) {
  return normalizeRoleList(person?.roles)
}

function isProjectLeadAccessPerson(person) {
  return getAccessPersonRoles(person).includes('chef_projet')
}

function isStandaloneExpertAccessPerson(person) {
  const roles = getAccessPersonRoles(person)
  return roles.length === 1 && roles.includes('expert')
}

function isCandidateAccessEntry(entry) {
  const roles = getAccessPersonRoles(entry?.person)
  return roles.includes('candidat') || (
    Array.isArray(entry?.person?.roles) && entry.person.roles.some(isCandidateRole)
  )
}

function formatWorkflowLabel(state) {
  if (state === 'planning') {
    return 'Planification'
  }

  if (state === 'voting_open') {
    return 'Votes ouverts'
  }

  if (state === 'published') {
    return 'Publication active'
  }

  return String(state || 'Inconnu')
}

function formatWorkflowPhases(phases, fallbackState) {
  const labels = {
    planning: 'Planification',
    votes: 'Votes',
    arbitrage: 'Arbitrage',
    defenses: 'Défenses'
  }
  const activeLabels = Object.entries(phases || {})
    .filter(([, value]) => value?.active === true)
    .map(([phase]) => labels[phase] || phase)

  return activeLabels.length > 0
    ? activeLabels.join(' + ')
    : formatWorkflowLabel(fallbackState)
}

function toSummaryCount(value) {
  const parsed = Number.parseInt(String(value || 0), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
}

function buildPhaseProgress(total, available) {
  if (total <= 0) {
    return '0'
  }

  return `${Math.min(available, total)}/${total}`
}

function buildGeneratedPhaseState({ total, available, emptyLabel = 'Aucun accès', pendingLabel = 'À générer' }) {
  if (total <= 0) {
    return {
      status: emptyLabel,
      variant: 'neutral'
    }
  }

  if (available >= total) {
    return {
      status: 'Prêt',
      variant: 'ok'
    }
  }

  if (available > 0) {
    return {
      status: 'Partiel',
      variant: 'warning'
    }
  }

  return {
    status: pendingLabel,
    variant: 'warning'
  }
}

export function buildAccessPhaseReadiness(summary = {}, contexts = {}) {
  const voteTotal = toSummaryCount(summary?.voteLinkCount)
  const voteAvailable = toSummaryCount(summary?.voteGeneratedLinkCount)
  const defenseTotal = toSummaryCount(summary?.soutenanceLinkCount)
  const defenseAvailable = toSummaryCount(summary?.soutenanceGeneratedLinkCount)
  const arbitrageTotal = toSummaryCount(summary?.arbitrageLinkCount)
  const arbitrageAvailable = toSummaryCount(summary?.arbitrageGeneratedLinkCount)
  const voteState = buildGeneratedPhaseState({
    total: voteTotal,
    available: voteAvailable,
    emptyLabel: 'Aucun vote',
    pendingLabel: 'À générer'
  })
  const defenseState = buildGeneratedPhaseState({
    total: defenseTotal,
    available: defenseAvailable,
    emptyLabel: 'Aucune publication',
    pendingLabel: 'À générer'
  })
  const arbitrageState = buildGeneratedPhaseState({
    total: arbitrageTotal,
    available: arbitrageAvailable,
    emptyLabel: 'Aucune proposition',
    pendingLabel: 'À créer'
  })

  return [
    {
      id: 'planning',
      label: 'Planification',
      metric: 'Admin',
      status: 'Aucun token requis',
      variant: 'neutral',
      detail: 'Phase pilotée par les actions internes et les droits admin.'
    },
    {
      id: 'vote',
      label: 'Votes',
      metric: buildPhaseProgress(voteTotal, voteAvailable),
      status: voteState.status,
      variant: voteState.variant,
      detail: contexts?.vote?.workflowFreeModeEnabled
        ? 'Chargement autorisé hors phases pour les votes disponibles.'
        : 'État basé sur les votes en attente.'
    },
    {
      id: 'arbitrage',
      label: 'Arbitrage',
      metric: buildPhaseProgress(arbitrageTotal, arbitrageAvailable),
      status: arbitrageState.status,
      variant: arbitrageState.variant,
      detail: 'Les propositions sont créées dans le module vote, puis reprises ici.'
    },
    {
      id: 'soutenance',
      label: 'Défenses',
      metric: buildPhaseProgress(defenseTotal, defenseAvailable),
      status: defenseState.status,
      variant: defenseState.variant,
      detail: contexts?.soutenance?.publicationVersion
        ? `Publication v${contexts.soutenance.publicationVersion}.`
        : 'Aucune publication défense active détectée.'
    }
  ]
}

function formatDateTime(value) {
  if (!value) {
    return 'Date inconnue'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Date inconnue'
  }

  return date.toLocaleString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function isAccessAuditEvent(event) {
  return ACCESS_AUDIT_ACTIONS.has(compactText(event?.action))
}

function getAccessAuditActionLabel(action) {
  const normalizedAction = compactText(action)
  return ACCESS_AUDIT_ACTION_LABELS[normalizedAction] || normalizedAction || 'Action inconnue'
}

function getAccessAuditDetail(event = {}) {
  const action = compactText(event.action)
  const payload = isPlainObject(event.payload) ? event.payload : {}
  const summary = isPlainObject(payload.summary) ? payload.summary : {}

  if (action === 'workflow.access-links.generate') {
    return `${summary.generatedLinkCount || 0} accès disponibles`
  }

  if (action === 'workflow.access-links.reconcile') {
    return `${summary.soutenanceGeneratedLinkCount || 0}/${summary.soutenanceLinkCount || 0} défenses disponibles`
  }

  if (action === 'workflow.access-links.email-send' || action === 'workflow.access-links.email-test') {
    return `${payload.sentCount || 0}/${payload.requestedCount || 0} envoyé(s)${
      payload.failedCount ? `, ${payload.failedCount} échec(s)` : ''
    }`
  }

  if (action === 'workflow.access-links.email-reset') {
    return `${payload.modifiedCount || 0} statut(s) reset`
  }

  if (action === 'workflow.publication.publish') {
    const publicationVersion = payload.publicationVersion || payload.version || summary.publicationVersion
    return publicationVersion ? `Publication v${publicationVersion}` : 'Publication défense'
  }

  if (action === 'workflow.publication.send-links') {
    return `${payload.emailsSucceeded || payload.emailsSent || 0} email(s) transmis`
  }

  if (action.startsWith('workflow.static')) {
    return payload.publicUrl || payload.outputDir || 'Mini-site mis à jour'
  }

  if (event.error) {
    return event.error
  }

  return 'Action enregistrée'
}

function getAccessLogStatusLabel(status) {
  const normalizedStatus = compactText(status)
  return ACCESS_LOG_STATUS_LABELS[normalizedStatus] || normalizedStatus || 'Statut inconnu'
}

function getAccessLogTypeLabel(type) {
  const normalizedType = compactText(type)
  return ACCESS_LOG_TYPE_LABELS[normalizedType] || normalizedType || 'Lien'
}

function getAccessLogDetail(log = {}) {
  const identity = compactText(log.recipientEmail) ||
    compactText(log.role) ||
    compactText(log.redirectPath) ||
    'Destinataire inconnu'
  const reason = compactText(log.reason)

  return reason ? `${identity} - ${reason}` : identity
}

function isPastDate(value) {
  if (!value) {
    return false
  }

  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date <= new Date()
}

function normalizeVoteLinkTarget(value, fallback = DEFAULT_ACCESS_LINK_SETTINGS.defaultVoteLinkTarget) {
  const normalized = String(value || fallback || '').trim().toLowerCase()
  return normalized === accessLinkPolicy.targets.static || normalized === accessLinkPolicy.targets.publication
    ? accessLinkPolicy.targets.static
    : accessLinkPolicy.targets.app
}

function normalizeSoutenanceLinkTarget(value, fallback = DEFAULT_ACCESS_LINK_SETTINGS.defaultSoutenanceLinkTarget) {
  return String(value || fallback || '').trim().toLowerCase() === accessLinkPolicy.targets.publication
    ? accessLinkPolicy.targets.publication
    : accessLinkPolicy.targets.app
}

function normalizeAccessLinkSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {}

  return {
    defaultVoteLinkTarget: normalizeVoteLinkTarget(
      source.defaultVoteLinkTarget ?? source.voteLinkTarget ?? source.voteTarget
    ),
    defaultSoutenanceLinkTarget: normalizeSoutenanceLinkTarget(
      source.defaultSoutenanceLinkTarget ?? source.soutenanceLinkTarget ?? source.publicationLinkTarget
    ),
    workflowFreeModeEnabled: typeof (
      source.workflowFreeModeEnabled ??
      source.freeWorkflowModeEnabled ??
      source.ignoreWorkflowStateForLinks
    ) === 'boolean'
      ? (
          source.workflowFreeModeEnabled ??
          source.freeWorkflowModeEnabled ??
          source.ignoreWorkflowStateForLinks
        )
      : DEFAULT_ACCESS_LINK_SETTINGS.workflowFreeModeEnabled
  }
}

function formatUrlHost(value) {
  const rawValue = String(value || '').trim()
  if (!rawValue) {
    return ''
  }

  try {
    return new URL(rawValue).host || rawValue
  } catch (error) {
    return rawValue.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  }
}

async function copyToClipboard(value) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'readonly')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function getVoteLinkTpiEntries(link) {
  return Array.isArray(link?.tpis) ? link.tpis : []
}

function getVoteLinkTpiCount(link) {
  const tpis = getVoteLinkTpiEntries(link)
  return tpis.length > 0 ? tpis.length : 1
}

function formatVoteLinkLabel(link) {
  const tpis = getVoteLinkTpiEntries(link)

  if (tpis.length > 1) {
    return 'Vote groupé'
  }

  if (tpis.length === 1) {
    return tpis[0]?.reference || link?.reference || 'Vote'
  }

  return link?.reference || 'Vote'
}

function formatVoteLinkSubtitle(link) {
  const tpis = getVoteLinkTpiEntries(link)

  if (tpis.length > 1) {
    return `${tpis.length} TPI à voter`
  }

  const candidateName = tpis[0]?.candidateName || link?.candidateName
  return candidateName ? `${CANDIDATE_ROLE_LABEL}: ${candidateName}` : ''
}

function buildVoteLinkDetails(link) {
  const tpis = getVoteLinkTpiEntries(link)

  if (tpis.length === 1) {
    const [tpi] = tpis
    return [
      tpi?.roleLabel ? {
        key: `${tpi.tpiId || tpi.reference}-role`,
        label: 'Rôle',
        text: tpi.roleLabel
      } : null,
      tpi?.subject ? {
        key: `${tpi.tpiId || tpi.reference}-subject`,
        label: 'Sujet',
        text: tpi.subject
      } : null
    ].filter(Boolean)
  }

  return tpis.map((tpi) => ({
    key: tpi.tpiId || tpi.reference,
    label: tpi.reference || 'TPI',
    text: [
      tpi.candidateName,
      tpi.roleLabel,
      tpi.subject
    ].filter(Boolean).join(' · ')
  }))
}

function formatArbitrageProposalStatus(value) {
  if (value === 'accepted') {
    return 'Accord complet'
  }

  if (value === 'rejected') {
    return 'Refus'
  }

  if (value === 'partial') {
    return 'Réponse partielle'
  }

  if (value === 'expired') {
    return 'Expiré'
  }

  if (value === 'failed') {
    return 'Échec envoi'
  }

  if (value === 'cancelled') {
    return 'Annulé'
  }

  return 'Transmis'
}

function formatArbitrageResponseStatus(value) {
  if (value === 'accepted') {
    return 'OK'
  }

  if (value === 'rejected') {
    return 'Refusé'
  }

  return 'En attente'
}

function formatArbitrageLinkLabel(link) {
  return link?.reference ? `Arbitrage ${link.reference}` : 'Arbitrage'
}

function formatArbitrageLinkSubtitle(link) {
  return [
    link?.candidateName ? `${CANDIDATE_ROLE_LABEL}: ${link.candidateName}` : '',
    link?.proposedSlotLabel || ''
  ].filter(Boolean).join(' · ')
}

function buildArbitrageLinkDetails(link) {
  return [
    {
      key: `${link?.proposalId || link?.reference}-slot`,
      label: 'Créneau proposé',
      text: link?.proposedSlotLabel || 'Non renseigné'
    },
    link?.subject ? {
      key: `${link?.proposalId || link?.reference}-subject`,
      label: 'TPI',
      text: link.subject
    } : null,
    link?.responseReason ? {
      key: `${link?.proposalId || link?.reference}-reason`,
      label: 'Retour',
      text: link.responseReason
    } : null,
    link?.alternativeProposal ? {
      key: `${link?.proposalId || link?.reference}-alternative`,
      label: 'Alternative',
      text: link.alternativeProposal
    } : null
  ].filter(Boolean)
}

function getLinkAvailabilityMeta({
  availabilityStatus,
  hasUrl,
  generated,
  recoverable
}) {
  const normalizedStatus = String(availabilityStatus || '').trim().toLowerCase()
  const displayStatus = normalizedStatus || (
    hasUrl
      ? 'available'
      : generated
        ? recoverable === false
          ? 'unrecoverable'
          : 'unavailable'
        : 'missing'
  )

  const statusMeta = {
    available: { label: 'Disponible', variant: 'ok' },
    missing: { label: 'Non généré', variant: 'neutral' },
    unavailable: { label: 'Non disponible', variant: 'warning' },
    unrecoverable: { label: 'Non récupérable', variant: 'danger' },
    expired: { label: 'Expiré', variant: 'warning' },
    revoked: { label: 'Révoqué', variant: 'neutral' },
    exhausted: { label: 'Limite atteinte', variant: 'warning' }
  }[displayStatus]

  return {
    statusLabel: statusMeta?.label || 'Disponible',
    statusVariant: statusMeta?.variant || 'neutral'
  }
}

function getPersonInitials(name, email) {
  const source = String(name || email || '').trim()
  if (!source) {
    return '??'
  }

  const parts = source
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)

  if (parts.length === 0) {
    return source.slice(0, 2).toUpperCase()
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
}

function getAccessLinkPhase(link, fallbackPhase = '') {
  const normalizedType = compactText(link?.type).toLowerCase()
  if (ACCESS_PHASE_FILTER_VALUES.has(normalizedType)) {
    return normalizedType
  }

  return ACCESS_PHASE_FILTER_VALUES.has(fallbackPhase) ? fallbackPhase : 'vote'
}

function getAccessLinkUrl(link) {
  return typeof link?.url === 'string' ? link.url.trim() : ''
}

function canPrepareAccessEmail(person, link) {
  return Boolean(compactText(person?.email) && getAccessLinkUrl(link))
}

function buildAccessEmailDeliveryKey({ year, person, link, phase }) {
  const resolvedPhase = getAccessLinkPhase(link, phase)
  const identity = [
    year,
    person?.id,
    person?.email,
    resolvedPhase,
    link?.url,
    link?.token,
    link?.proposalId,
    link?.publicationVersion,
    link?.reference,
    link?.redirectPath
  ].map(compactText).filter(Boolean).join('|')

  return `${resolvedPhase}-${hashAccessEmailKey(identity)}`
}

function getBackendEmailDelivery(link) {
  const deliveryStatus = compactText(link?.deliveryStatus).toLowerCase()

  if (deliveryStatus === 'sent' || link?.sentAt) {
    return {
      status: 'sent',
      source: 'system',
      sentAt: link?.sentAt || link?.createdAt || null
    }
  }

  if (deliveryStatus === 'failed') {
    return {
      status: 'failed',
      source: 'system',
      sentAt: link?.sentAt || null,
      error: link?.deliveryError || ''
    }
  }

  if (deliveryStatus === 'skipped') {
    return {
      status: 'skipped',
      source: 'system',
      sentAt: link?.sentAt || null
    }
  }

  return null
}

function getEffectiveEmailDelivery({ year, person, link, phase, ledger }) {
  const deliveryKey = buildAccessEmailDeliveryKey({ year, person, link, phase })
  const storedDelivery = isPlainObject(ledger?.[deliveryKey]) ? ledger[deliveryKey] : null
  const backendDelivery = getBackendEmailDelivery(link)

  return {
    deliveryKey,
    delivery: isEmailDeliverySent(backendDelivery) ? backendDelivery : (storedDelivery || backendDelivery)
  }
}

function isEmailDeliverySent(delivery) {
  return compactText(delivery?.status).toLowerCase() === 'sent' &&
    compactText(delivery?.source).toLowerCase() !== 'outlook'
}

function isEmailDeliveryPrepared(delivery) {
  const status = compactText(delivery?.status).toLowerCase()
  const source = compactText(delivery?.source).toLowerCase()
  return status === 'prepared' || (status === 'sent' && source === 'outlook')
}

function isLocalOutlookPreparedDelivery(delivery) {
  return compactText(delivery?.source).toLowerCase() === 'outlook' &&
    isEmailDeliveryPrepared(delivery)
}

function isSystemEmailDeliveryResettable(delivery) {
  const status = compactText(delivery?.status).toLowerCase()
  const source = compactText(delivery?.source).toLowerCase()

  return source === 'system' && ['sent', 'failed', 'skipped'].includes(status)
}

function getPublicationVersionSortValue(link) {
  const version = Number.parseInt(String(link?.publicationVersion || 0), 10)
  return Number.isInteger(version) ? version : 0
}

function selectPrimarySoutenanceEmailTarget(targets) {
  return [...targets]
    .filter((target) => getAccessLinkUrl(target.link))
    .sort((left, right) => getPublicationVersionSortValue(right.link) - getPublicationVersionSortValue(left.link))[0] || null
}

function formatSoutenanceLinkLabel(link) {
  return `Publication ${link?.publicationVersion || 'active'}`
}

function formatSoutenanceLinkSubtitle() {
  return 'Vue filtrée sur les défenses publiées'
}

function getPrimarySoutenanceLink(entry) {
  return selectPrimarySoutenanceEmailTarget(
    (Array.isArray(entry?.soutenanceLinks) ? entry.soutenanceLinks : [])
      .map((link) => ({ phase: 'soutenance', link }))
  )?.link || null
}

function buildSoutenanceEmailTarget({ entry, year, ledger = {} }) {
  const link = getPrimarySoutenanceLink(entry)

  if (!canPrepareAccessEmail(entry?.person, link)) {
    return null
  }

  const { deliveryKey, delivery } = getEffectiveEmailDelivery({
    year,
    person: entry?.person,
    link,
    phase: 'soutenance',
    ledger
  })

  return {
    deliveryKey,
    delivery,
    person: entry?.person,
    link,
    phase: 'soutenance',
    label: formatSoutenanceLinkLabel(link),
    subtitle: formatSoutenanceLinkSubtitle()
  }
}

function isSoutenanceEmailTargetSmtpSendable(target) {
  return Boolean(
    target?.deliveryKey &&
    compactText(target?.link?.id) &&
    canPrepareAccessEmail(target?.person, target?.link) &&
    !isEmailDeliverySent(target?.delivery)
  )
}

function isSoutenanceEmailTargetOutlookSendable(target) {
  return Boolean(
    target?.deliveryKey &&
    canPrepareAccessEmail(target?.person, target?.link) &&
    !isEmailDeliverySent(target?.delivery) &&
    !isEmailDeliveryPrepared(target?.delivery)
  )
}

function isSoutenanceEmailTargetRelanceable(target) {
  return Boolean(
    target?.deliveryKey &&
    compactText(target?.link?.id) &&
    canPrepareAccessEmail(target?.person, target?.link)
  )
}

function buildSoutenanceEmailAutomationGroup(targets = []) {
  const normalizedTargets = Array.isArray(targets) ? targets.filter(Boolean) : []
  const pendingTargets = normalizedTargets.filter(isSoutenanceEmailTargetSmtpSendable)
  const outlookPendingTargets = normalizedTargets.filter(isSoutenanceEmailTargetOutlookSendable)
  const sentCount = normalizedTargets.filter((target) => isEmailDeliverySent(target.delivery)).length
  const preparedCount = normalizedTargets.filter((target) => isEmailDeliveryPrepared(target.delivery)).length
  const resettableTargets = normalizedTargets.filter((target) => isSystemEmailDeliveryResettable(target.delivery))

  return {
    targets: normalizedTargets,
    pendingTargets,
    outlookPendingTargets,
    resettableTargets,
    totalCount: normalizedTargets.length,
    pendingCount: pendingTargets.length,
    outlookPendingCount: outlookPendingTargets.length,
    sentCount,
    preparedCount,
    resettableCount: resettableTargets.length
  }
}

function getSoutenanceEmailAudience(person) {
  if (isCandidateAccessEntry({ person })) {
    return 'candidate'
  }

  if (isProjectLeadAccessPerson(person)) {
    return 'cdp'
  }

  if (isStandaloneExpertAccessPerson(person)) {
    return 'expert'
  }

  return 'autre'
}

function getSoutenanceEmailAudienceLabel(audience) {
  if (audience === 'cdp') {
    return getTpiRelationRoleLabel('chef_projet')
  }

  if (audience === 'expert') {
    return getTpiRelationRoleLabel('expert')
  }

  if (audience === 'candidate') {
    return CANDIDATE_ROLE_LABEL
  }

  return 'Autre'
}

function buildSoutenanceEmailRequestTarget(target) {
  return {
    clientKey: target?.deliveryKey || '',
    linkId: compactText(target?.link?.id),
    personId: compactText(target?.person?.id),
    recipientName: compactText(target?.person?.name),
    recipientEmail: compactText(target?.person?.email),
    recipientAudience: compactText(target?.audience),
    recipientRoles: Array.isArray(target?.person?.roles) ? target.person.roles : [],
    url: getAccessLinkUrl(target?.link),
    expiresAt: target?.link?.expiresAt || null
  }
}

function buildSoutenanceResponseDeadlineCopy(person) {
  const roles = getAccessPersonRoles(person)

  if (roles.includes('chef_projet')) {
    return 'Merci de faire votre retour dans les 3 jours uniquement si une modification est indispensable.'
  }

  if (roles.includes('expert')) {
    return 'Merci de faire votre retour dans les 5 jours maximum uniquement si une modification est indispensable.'
  }

  return ''
}

function listEntryEmailTargets(entry, selectedPhaseFilters = DEFAULT_ACCESS_PHASE_FILTERS) {
  const selectedPhaseSet = new Set(selectedPhaseFilters)
  const targets = []
  const soutenanceTargets = []

  if (selectedPhaseSet.has('vote')) {
    for (const link of Array.isArray(entry?.voteLinks) ? entry.voteLinks : []) {
      targets.push({ phase: 'vote', link })
    }
  }

  if (selectedPhaseSet.has('soutenance')) {
    for (const link of Array.isArray(entry?.soutenanceLinks) ? entry.soutenanceLinks : []) {
      soutenanceTargets.push({ phase: 'soutenance', link })
    }
  }

  const primarySoutenanceTarget = selectPrimarySoutenanceEmailTarget(soutenanceTargets)
  if (primarySoutenanceTarget) {
    return [primarySoutenanceTarget]
  }

  targets.push(...soutenanceTargets)

  if (selectedPhaseSet.has('arbitrage')) {
    for (const link of Array.isArray(entry?.arbitrageLinks) ? entry.arbitrageLinks : []) {
      targets.push({ phase: 'arbitrage', link })
    }
  }

  return targets
}

function buildEntryEmailState({ entry, year, selectedPhaseFilters, ledger }) {
  const targets = listEntryEmailTargets(entry, selectedPhaseFilters)
    .filter((target) => getAccessLinkUrl(target.link))
  const sendableTargets = targets.filter((target) => canPrepareAccessEmail(entry?.person, target.link))

  if (targets.length > 0 && sendableTargets.length === 0) {
    return {
      variant: 'blocked',
      label: 'Email manquant',
      detail: '0 prêt',
      sentCount: 0,
      preparedCount: 0,
      totalCount: 0
    }
  }

  if (sendableTargets.length === 0) {
    return {
      variant: 'none',
      label: 'Aucun email',
      detail: 'Aucun lien prêt',
      sentCount: 0,
      preparedCount: 0,
      totalCount: 0
    }
  }

  let sentCount = 0
  let preparedCount = 0
  let failedCount = 0
  let lastSentAt = null
  let lastPreparedAt = null

  for (const target of sendableTargets) {
    const { delivery } = getEffectiveEmailDelivery({
      year,
      person: entry?.person,
      link: target.link,
      phase: target.phase,
      ledger
    })

    if (isEmailDeliverySent(delivery)) {
      sentCount += 1
      const sentTime = delivery?.sentAt ? new Date(delivery.sentAt).getTime() : 0
      if (sentTime && (!lastSentAt || sentTime > new Date(lastSentAt).getTime())) {
        lastSentAt = delivery.sentAt
      }
    } else if (isEmailDeliveryPrepared(delivery)) {
      preparedCount += 1
      const preparedAt = delivery?.preparedAt || delivery?.sentAt
      const preparedTime = preparedAt ? new Date(preparedAt).getTime() : 0
      if (preparedTime && (!lastPreparedAt || preparedTime > new Date(lastPreparedAt).getTime())) {
        lastPreparedAt = preparedAt
      }
    } else if (compactText(delivery?.status).toLowerCase() === 'failed') {
      failedCount += 1
    }
  }

  if (sentCount === sendableTargets.length) {
    return {
      variant: 'sent',
      label: 'Email transmis',
      detail: lastSentAt ? formatDateTime(lastSentAt) : `${sentCount}/${sendableTargets.length}`,
      sentCount,
      preparedCount,
      totalCount: sendableTargets.length
    }
  }

  if (preparedCount === sendableTargets.length) {
    return {
      variant: 'prepared',
      label: 'Outlook préparé',
      detail: lastPreparedAt ? formatDateTime(lastPreparedAt) : `${preparedCount}/${sendableTargets.length}`,
      sentCount,
      preparedCount,
      totalCount: sendableTargets.length
    }
  }

  const handledCount = sentCount + preparedCount
  const hasMixedHandledDeliveries = sentCount > 0 && preparedCount > 0
  if (handledCount > 0) {
    return {
      variant: 'partial',
      label: hasMixedHandledDeliveries
        ? 'Traitement partiel'
        : preparedCount > 0
          ? 'Préparation partielle'
          : 'Transmission partielle',
      detail: `${handledCount}/${sendableTargets.length}`,
      sentCount,
      preparedCount,
      totalCount: sendableTargets.length
    }
  }

  if (failedCount > 0) {
    return {
      variant: 'failed',
      label: 'Échec email',
      detail: `${failedCount} échec${failedCount > 1 ? 's' : ''}`,
      sentCount,
      preparedCount,
      totalCount: sendableTargets.length
    }
  }

  return {
    variant: 'pending',
    label: 'À envoyer',
    detail: `${sendableTargets.length} prêt${sendableTargets.length > 1 ? 's' : ''}`,
    sentCount,
    preparedCount,
    totalCount: sendableTargets.length
  }
}

function buildAccessEmailSummary(people, year, ledger, selectedPhaseFilters) {
  let readyCount = 0
  let sentCount = 0
  let preparedCount = 0
  let blockedCount = 0
  let failedCount = 0
  let lastSentAt = null
  let lastPreparedAt = null

  for (const entry of Array.isArray(people) ? people : []) {
    const targets = listEntryEmailTargets(entry, selectedPhaseFilters)
      .filter((target) => getAccessLinkUrl(target.link))

    for (const target of targets) {
      if (!canPrepareAccessEmail(entry?.person, target.link)) {
        blockedCount += 1
        continue
      }

      readyCount += 1
      const { delivery } = getEffectiveEmailDelivery({
        year,
        person: entry?.person,
        link: target.link,
        phase: target.phase,
        ledger
      })

      if (isEmailDeliverySent(delivery)) {
        sentCount += 1
        const sentTime = delivery?.sentAt ? new Date(delivery.sentAt).getTime() : 0
        if (sentTime && (!lastSentAt || sentTime > new Date(lastSentAt).getTime())) {
          lastSentAt = delivery.sentAt
        }
      } else if (isEmailDeliveryPrepared(delivery)) {
        preparedCount += 1
        const preparedAt = delivery?.preparedAt || delivery?.sentAt
        const preparedTime = preparedAt ? new Date(preparedAt).getTime() : 0
        if (preparedTime && (!lastPreparedAt || preparedTime > new Date(lastPreparedAt).getTime())) {
          lastPreparedAt = preparedAt
        }
      } else if (compactText(delivery?.status).toLowerCase() === 'failed') {
        failedCount += 1
      }
    }
  }

  const handledCount = sentCount + preparedCount
  const pendingCount = Math.max(readyCount - handledCount, 0)
  const ratio = readyCount > 0 ? handledCount / readyCount : 0
  const variant = readyCount <= 0
    ? blockedCount > 0 ? 'blocked' : 'none'
    : sentCount === readyCount
      ? 'sent'
      : preparedCount === readyCount
        ? 'prepared'
        : handledCount > 0
          ? 'partial'
          : failedCount > 0
            ? 'failed'
            : 'pending'

  return {
    readyCount,
    sentCount,
    preparedCount,
    pendingCount,
    blockedCount,
    failedCount,
    lastSentAt,
    lastPreparedAt,
    ratio,
    variant,
    progressLabel: readyCount > 0
      ? sentCount > 0 && preparedCount > 0
        ? `${handledCount}/${readyCount} traités`
        : preparedCount > 0
          ? `${handledCount}/${readyCount} préparés`
          : `${sentCount}/${readyCount} transmis`
      : blockedCount > 0
        ? 'Email manquant'
        : 'Aucun lien prêt'
  }
}

function getEmailDeliveryDisplayMeta(delivery, canPrepareEmail) {
  const status = compactText(delivery?.status).toLowerCase()

  if (isEmailDeliveryPrepared(delivery)) {
    const preparedAt = delivery?.preparedAt || delivery?.sentAt
    const preparedAtLabel = preparedAt ? formatDateTime(preparedAt) : ''
    return {
      variant: 'prepared',
      label: 'Outlook préparé',
      detail: preparedAtLabel ? `Préparé le ${preparedAtLabel}` : 'Brouillon Outlook ouvert',
      buttonLabel: 'Réouvrir Outlook',
      buttonIcon: MailIcon
    }
  }

  if (status === 'sent') {
    const sentAtLabel = delivery?.sentAt ? formatDateTime(delivery.sentAt) : ''
    return {
      variant: 'sent',
      label: 'Email transmis',
      detail: sentAtLabel ? `Transmis le ${sentAtLabel}` : 'Transmission enregistrée',
      buttonLabel: 'Réouvrir Outlook',
      buttonIcon: CheckIcon
    }
  }

  if (status === 'failed') {
    return {
      variant: 'failed',
      label: 'Échec email',
      detail: delivery?.error || 'Envoi automatique échoué',
      buttonLabel: 'Réessayer via Outlook',
      buttonIcon: MailIcon
    }
  }

  if (status === 'skipped') {
    return {
      variant: 'blocked',
      label: 'Email ignoré',
      detail: 'Envoi automatique désactivé',
      buttonLabel: 'Préparer Outlook',
      buttonIcon: MailIcon
    }
  }

  return {
    variant: canPrepareEmail ? 'pending' : 'blocked',
    label: canPrepareEmail ? 'À envoyer' : 'Email impossible',
    detail: canPrepareEmail ? 'Outlook non transmis' : 'Adresse ou lien manquant',
    buttonLabel: 'Préparer Outlook',
    buttonIcon: MailIcon
  }
}

function buildAccessEmailDraft({ year, person, link, phase, label, subtitle, messageType = ACCESS_EMAIL_MESSAGE_TYPES.STANDARD }) {
  const personName = compactText(person?.name)
  const greeting = personName ? `Bonjour ${personName},` : 'Bonjour,'
  const url = getAccessLinkUrl(link)
  const isScheduleUpdateMessage = messageType === ACCESS_EMAIL_MESSAGE_TYPES.SCHEDULE_UPDATE
  const reference = compactText(link?.reference || label)
  const expiryValue = link?.expiresAt
    ? formatDateTime(link.expiresAt)
    : 'selon la configuration active'
  const expiryLine = link?.expiresAt
    ? `Validité du lien: ${expiryValue}.`
    : 'Validité du lien: selon la configuration active.'
  const soutenanceResponseDeadlineCopy = buildSoutenanceResponseDeadlineCopy(person)
  const tpiLines = getVoteLinkTpiEntries(link)
    .map((tpi) => [
      compactText(tpi.reference),
      compactText(tpi.candidateName),
      compactText(tpi.roleLabel)
    ].filter(Boolean).join(' - '))
    .filter(Boolean)

  const phaseCopy = {
    vote: {
      subject: reference ? `Vote TPI - ${reference}` : `Vote TPI ${year}`,
      intro: 'Voici votre lien personnel pour accéder au vote TPI.'
    },
    soutenance: {
      subject: `Horaire des défenses TPI ${year} - lien personnel`,
      intro: `L’horaire des défenses TPI ${year} est publié. Vous pouvez consulter votre vue personnelle avec le lien ci-dessous.`,
      extraLines: [
        'Ce lien donne aussi accès au téléchargement iCal et, si nécessaire, au formulaire de demande de modification.',
        'Merci de considérer l’horaire comme définitif. Une demande de modification ne doit être déposée qu’en cas d’empêchement réel et important, après avoir vérifié qu’aucune adaptation de votre côté n’est possible.',
        'Les possibilités de déplacement sont très limitées. Toute demande sera examinée, mais aucune modification ne peut être garantie.'
      ]
    },
    arbitrage: {
      subject: reference ? `Arbitrage TPI - ${reference}` : `Arbitrage TPI ${year}`,
      intro: 'Voici votre lien personnel pour répondre à la proposition d’arbitrage.'
    }
  }[phase] || {
    subject: `Lien d'accès TPI ${year}`,
    intro: 'Voici votre lien personnel d’accès.'
  }

  const contextLines = [
    phase === 'arbitrage' && link?.proposedSlotLabel ? `Créneau proposé: ${link.proposedSlotLabel}` : '',
    phase === 'vote' && tpiLines.length > 0 ? `Dossiers concernés:\n${tpiLines.map((line) => `- ${line}`).join('\n')}` : ''
  ].filter(Boolean)

  if (phase === 'soutenance' && isScheduleUpdateMessage) {
    return {
      to: compactText(person?.email),
      subject: `Mise à jour de l’horaire des défenses TPI ${year}`,
      body: [
        greeting,
        '',
        `Nous avons modifié l’horaire des défenses TPI ${year}.`,
        '',
        'Merci de contrôler votre vue personnelle avec le lien ci-dessous et de vérifier si les modifications vous conviennent.',
        '',
        'Lien personnel',
        url,
        '',
        'Ce qu’il faut vérifier',
        '- la date, l’heure et la salle de vos défenses;',
        '- les éventuelles adaptations depuis la dernière publication;',
        '- votre calendrier personnel ou professionnel.',
        '',
        ...(soutenanceResponseDeadlineCopy
          ? [
              'Retour attendu',
              soutenanceResponseDeadlineCopy.replace('uniquement si une modification est indispensable', 'si la nouvelle planification pose un empêchement réel'),
              ''
            ]
          : []),
        'Si tout est en ordre, aucune action n’est nécessaire.',
        '',
        'Si une modification vous pose un problème important, utilisez le formulaire accessible depuis votre lien personnel. Les possibilités de déplacement restent limitées et aucune nouvelle adaptation ne peut être garantie.',
        '',
        'Validité du lien',
        `${expiryValue}.`,
        '',
        'Ce lien est personnel.',
        '',
        'Meilleures salutations'
      ].join('\n')
    }
  }

  if (phase === 'soutenance') {
    return {
      to: compactText(person?.email),
      subject: phaseCopy.subject,
      body: [
        greeting,
        '',
        `L’horaire des défenses TPI ${year} est publié.`,
        '',
        'Vous pouvez consulter votre vue personnelle avec le lien ci-dessous.',
        '',
        'Lien personnel',
        url,
        '',
        'Important',
        'Ce lien donne aussi accès au téléchargement iCal et, si nécessaire, au formulaire de demande de modification.',
        '',
        ...(soutenanceResponseDeadlineCopy
          ? [
              'Retour attendu',
              soutenanceResponseDeadlineCopy,
              ''
            ]
          : []),
        'Merci de considérer l’horaire comme définitif.',
        '',
        'Une demande de modification ne doit être déposée qu’en cas d’empêchement réel et important, après avoir vérifié qu’aucune adaptation de votre côté n’est possible.',
        '',
        'Les possibilités de déplacement sont très limitées. Toute demande sera examinée, mais aucune modification ne peut être garantie.',
        '',
        'Validité du lien',
        `${expiryValue}.`,
        '',
        'Ce lien est personnel.',
        '',
        'Meilleures salutations'
      ].join('\n')
    }
  }

  return {
    to: compactText(person?.email),
    subject: phaseCopy.subject,
    body: [
      greeting,
      '',
      phaseCopy.intro,
      ...contextLines,
      ...(Array.isArray(phaseCopy.extraLines) ? ['', ...phaseCopy.extraLines] : []),
      '',
      phase === 'soutenance' ? 'Ouvrir ma vue personnelle:' : '',
      url,
      '',
      expiryLine,
      'Ce lien est personnel.',
      '',
      'Meilleures salutations'
    ].filter((line) => line !== '').join('\n')
  }
}

function buildMailtoUrl({ to, subject, body }) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function openMailtoDraft(mailtoUrl) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (typeof window.open === 'function') {
      window.open(mailtoUrl, '_blank', 'noopener,noreferrer')
      return
    }
  } catch (error) {
    if (window.location) {
      window.location.href = mailtoUrl
    }
    return
  }

  if (window.location) {
    window.location.href = mailtoUrl
  }
}

function buildOutlookPreparedDeliveryEntry({
  target,
  preparedAt,
  recipientEmail = '',
  messageType = ACCESS_EMAIL_MESSAGE_TYPES.STANDARD
}) {
  return {
    status: 'prepared',
    source: 'outlook',
    messageType,
    preparedAt,
    recipientEmail: compactText(recipientEmail || target?.person?.email),
    linkType: target?.phase || 'soutenance',
    linkLabel: target?.label,
    linkUrl: getAccessLinkUrl(target?.link),
    coversChangeRequests: target?.phase === 'soutenance'
  }
}

function buildAccessSummaryMetrics(summary = {}) {
  return [
    {
      id: 'people',
      label: 'Personnes',
      value: summary.peopleCount || 0,
      detail: 'Destinataires uniques'
    },
    {
      id: 'vote',
      label: 'Votes',
      value: summary.voteLinkCount || 0,
      detail: `${summary.voteGeneratedLinkCount || 0} prêts`,
      variant: 'vote'
    },
    {
      id: 'soutenance',
      label: 'Défenses',
      value: summary.soutenanceLinkCount || 0,
      detail: `${summary.soutenanceGeneratedLinkCount || 0} prêts`,
      variant: 'soutenance'
    },
    {
      id: 'arbitrage',
      label: 'Arbitrages',
      value: summary.arbitrageLinkCount || 0,
      detail: `${summary.arbitrageGeneratedLinkCount || 0} prêts`,
      variant: 'arbitrage'
    },
    {
      id: 'generated',
      label: 'Disponibles',
      value: summary.generatedLinkCount || 0,
      detail: 'Liens utilisables',
      variant: 'ok'
    },
    {
      id: 'unavailable',
      label: 'À reprendre',
      value: summary.unavailableGeneratedLinkCount || 0,
      detail: 'Indisponibles',
      variant: summary.unavailableGeneratedLinkCount > 0 ? 'warning' : 'neutral'
    }
  ]
}

const AccessMetricRow = ({ metric }) => {
  return (
    <div className={`token-access-summary-row is-${metric.variant || 'neutral'}`.trim()}>
      <span className='token-access-summary-row-label'>{metric.label}</span>
      <strong>{metric.value}</strong>
      {metric.detail ? <small>{metric.detail}</small> : null}
    </div>
  )
}

const AccessPhaseRow = ({ phase }) => {
  return (
    <article className={`token-access-phase-row is-${phase.variant || 'neutral'}`.trim()}>
      <div className='token-access-phase-row-copy'>
        <span>{phase.label}</span>
        <small>{phase.status}</small>
      </div>
      <strong>{phase.metric}</strong>
    </article>
  )
}

const AccessOverviewCard = ({ item }) => {
  const Icon = item.icon || ClipboardIcon
  const accessibleLabel = [item.label, item.value, item.detail]
    .filter((part) => part !== null && part !== undefined && part !== '')
    .join(' · ')

  return (
    <article
      className={`token-access-overview-card is-${item.variant || 'neutral'}`.trim()}
      aria-label={accessibleLabel}
    >
      <span className='token-access-overview-icon' aria-hidden='true'>
        <Icon />
      </span>
      <span>{item.label}</span>
      <strong>{item.value}</strong>
      {item.detail ? <small>{item.detail}</small> : null}
    </article>
  )
}

const AccessPublicationDiagnostic = ({ context = {}, summary = {} }) => {
  const publicationVersion = context?.publicationVersion || null
  const linkCount = Number(summary?.soutenanceLinkCount || context?.linkCount || 0)
  const generatedCount = Number(summary?.soutenanceGeneratedLinkCount || context?.generatedLinkCount || 0)
  const pendingCount = Math.max(linkCount - generatedCount, 0)
  const versions = Array.isArray(context?.availableVersions) ? context.availableVersions : []
  const activeVersion = versions.find((version) => version.version === publicationVersion) || null
  const reusablePreviousVersions = versions
    .filter((version) => version.version !== publicationVersion)
    .filter((version) => Number(version.recoverableGeneratedLinkCount || version.generatedLinkCount || 0) > 0)
    .slice(0, 3)

  return (
    <div className={`token-access-publication-diagnostic${pendingCount > 0 ? ' has-gap' : ''}`.trim()}>
      <div className='token-access-publication-diagnostic-head'>
        <h3>Publication active</h3>
        <strong>{publicationVersion ? `v${publicationVersion}` : 'Absente'}</strong>
      </div>
      <div className='token-access-publication-diagnostic-grid'>
        <span>
          <strong>{context?.roomsCount || 0}</strong>
          salle{Number(context?.roomsCount || 0) > 1 ? 's' : ''}
        </span>
        <span>
          <strong>{generatedCount}/{linkCount}</strong>
          liens défense
        </span>
        <span>
          <strong>{context?.linkTarget === 'publication' ? 'Site' : 'Local'}</strong>
          cible
        </span>
      </div>
      {pendingCount > 0 ? (
        <p>
          {pendingCount} lien{pendingCount > 1 ? 's' : ''} manquant{pendingCount > 1 ? 's' : ''} pour la publication active.
        </p>
      ) : activeVersion ? (
        <p>La publication active dispose de liens récupérables pour la cible courante.</p>
      ) : null}
      {reusablePreviousVersions.length > 0 ? (
        <small>
          Anciennes versions avec liens: {reusablePreviousVersions.map((version) => `v${version.version}`).join(', ')}
        </small>
      ) : null}
    </div>
  )
}

const AccessAuditPanel = ({
  events = [],
  isLoading = false,
  error = '',
  onRefresh = null
}) => {
  const accessEvents = Array.isArray(events)
    ? events.filter(isAccessAuditEvent).slice(0, 6)
    : []

  return (
    <div className={`token-access-audit-panel${error ? ' has-error' : ''}`.trim()}>
      <div className='token-access-audit-head'>
        <span className='token-access-audit-icon' aria-hidden='true'>
          <WorkflowIcon />
        </span>
        <div>
          <h3>Historique</h3>
          <p>
            {isLoading
              ? 'Chargement...'
              : `${accessEvents.length} action${accessEvents.length > 1 ? 's' : ''} récente${accessEvents.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          type='button'
          className='token-access-icon-btn secondary token-access-audit-refresh'
          onClick={onRefresh}
          disabled={isLoading}
          aria-label='Rafraîchir l’historique des accès'
          title='Rafraîchir l’historique des accès'
        >
          <IconButtonContent label='Rafraîchir l’historique des accès' icon={RefreshIcon} />
        </button>
      </div>
      {error ? (
        <p className='token-access-audit-empty'>{error}</p>
      ) : accessEvents.length > 0 ? (
        <ol className='token-access-audit-list' aria-label='Dernières actions liens d’accès'>
          {accessEvents.map((event, index) => (
            <li
              key={event.id || event._id || `${event.action}-${event.createdAt}-${index}`}
              className={event.success === false ? 'is-failed' : 'is-success'}
            >
              <span className='token-access-audit-status' aria-hidden='true' />
              <span>
                <strong>{getAccessAuditActionLabel(event.action)}</strong>
                <small>{getAccessAuditDetail(event)}</small>
              </span>
              <time dateTime={event.createdAt || undefined}>{formatDateTime(event.createdAt)}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p className='token-access-audit-empty'>
          Aucune action récente sur les accès.
        </p>
      )}
    </div>
  )
}

const AccessUsagePanel = ({
  logs = [],
  isLoading = false,
  error = '',
  onRefresh = null
}) => {
  const accessLogs = Array.isArray(logs) ? logs.slice(0, 6) : []
  const successCount = accessLogs.filter((log) => log?.status === 'success').length
  const issueCount = Math.max(accessLogs.length - successCount, 0)

  return (
    <div className={`token-access-audit-panel token-access-usage-panel${error ? ' has-error' : ''}`.trim()}>
      <div className='token-access-audit-head'>
        <span className='token-access-audit-icon' aria-hidden='true'>
          <KeyIcon />
        </span>
        <div>
          <h3>Ouvertures</h3>
          <p>
            {isLoading
              ? 'Chargement...'
              : accessLogs.length > 0
                ? `${successCount} succès, ${issueCount} incident${issueCount > 1 ? 's' : ''}`
                : 'Aucune ouverture récente'}
          </p>
        </div>
        <button
          type='button'
          className='token-access-icon-btn secondary token-access-audit-refresh'
          onClick={onRefresh}
          disabled={isLoading}
          aria-label='Rafraîchir les ouvertures des liens'
          title='Rafraîchir les ouvertures des liens'
        >
          <IconButtonContent label='Rafraîchir les ouvertures des liens' icon={RefreshIcon} />
        </button>
      </div>
      {error ? (
        <p className='token-access-audit-empty'>{error}</p>
      ) : accessLogs.length > 0 ? (
        <ol className='token-access-audit-list' aria-label='Dernières ouvertures des liens d’accès'>
          {accessLogs.map((log, index) => (
            <li
              key={log.id || `${log.status}-${log.createdAt}-${index}`}
              className={log.status === 'success' ? 'is-success' : 'is-failed'}
            >
              <span className='token-access-audit-status' aria-hidden='true' />
              <span>
                <strong>{getAccessLogTypeLabel(log.type)} - {getAccessLogStatusLabel(log.status)}</strong>
                <small>{getAccessLogDetail(log)}</small>
              </span>
              <time dateTime={log.createdAt || undefined}>{formatDateTime(log.createdAt)}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p className='token-access-audit-empty'>
          Aucun lien n’a été ouvert récemment.
        </p>
      )}
    </div>
  )
}

const AccessNotice = ({ tone = 'info', role = 'status', children, action = null }) => (
  <div className={`token-generator-notice is-${tone}${action ? ' has-action' : ''}`.trim()} role={role}>
    <span className='token-generator-notice-icon' aria-hidden='true'>
      {tone === 'success' ? <CheckIcon /> : tone === 'warning' || tone === 'danger' ? <AlertIcon /> : <ClipboardIcon />}
    </span>
    <span className='token-generator-notice-copy'>{children}</span>
    {action ? <span className='token-generator-notice-action'>{action}</span> : null}
  </div>
)

const LinkRow = ({
  label,
  subtitle,
  badges = [],
  details = [],
  url,
  expiresAt,
  revokedAt,
  usageCount = 0,
  lastUsedAt = null,
  generated = false,
  recoverable = true,
  availabilityStatus = '',
  emailDelivery = null,
  canPrepareEmail = false,
  onPrepareEmail,
  onCopy,
  onOpen
}) => {
  const hasUrl = typeof url === 'string' && url.length > 0
  const normalizedStatus = String(availabilityStatus || '').trim().toLowerCase()
  const displayStatus = normalizedStatus || (
    hasUrl
      ? 'available'
      : generated
        ? recoverable === false ? 'unrecoverable' : 'unavailable'
        : 'missing'
  )
  const placeholderLabel = displayStatus === 'expired'
    ? 'Lien expiré'
    : displayStatus === 'revoked'
      ? 'Lien révoqué'
      : displayStatus === 'exhausted'
        ? 'Lien utilisé au maximum'
        : generated
          ? recoverable === false || displayStatus === 'unrecoverable'
            ? 'Lien généré avant persistance'
            : 'Lien généré indisponible'
          : 'Lien non généré'
  const unavailableTitle = displayStatus === 'expired'
    ? 'Lien expiré'
    : displayStatus === 'revoked'
      ? 'Lien révoqué'
      : displayStatus === 'exhausted'
        ? 'Lien utilisé au maximum'
        : generated
          ? 'Lien généré mais indisponible'
          : 'Lien à générer'
  const expiryLabel = revokedAt
    ? `Révoqué le ${formatDateTime(revokedAt)}`
    : expiresAt
      ? `${displayStatus === 'expired' || isPastDate(expiresAt) ? 'Expiré' : 'Expire'} le ${formatDateTime(expiresAt)}`
      : 'Expiration définie à la génération'
  const { statusLabel, statusVariant } = getLinkAvailabilityMeta({
    availabilityStatus: displayStatus,
    hasUrl,
    generated,
    recoverable
  })
  const emailMeta = getEmailDeliveryDisplayMeta(emailDelivery, canPrepareEmail)
  const EmailButtonIcon = emailMeta.buttonIcon || MailIcon
  const normalizedUsageCount = Number.parseInt(String(usageCount || 0), 10)
  const hasBeenOpened = Number.isInteger(normalizedUsageCount) && normalizedUsageCount > 0
  const openedLabel = lastUsedAt
    ? `Ouvert le ${formatDateTime(lastUsedAt)}`
    : hasBeenOpened
      ? `Ouvert ${normalizedUsageCount > 1 ? `${normalizedUsageCount} fois` : ''}`.trim()
      : ''
  const [isCopied, setIsCopied] = useState(false)
  const copyResetTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current)
      }
    }
  }, [])

  const handleCopyAction = async () => {
    if (!hasUrl || typeof onCopy !== 'function') {
      return
    }

    try {
      const copied = await Promise.resolve(onCopy(url))
      if (copied !== false) {
        setIsCopied(true)
        if (copyResetTimerRef.current) {
          clearTimeout(copyResetTimerRef.current)
        }
        copyResetTimerRef.current = setTimeout(() => {
          setIsCopied(false)
        }, 1400)
      }
    } catch (error) {
      setIsCopied(false)
    }
  }

  return (
    <article className={`token-access-link-row is-${displayStatus} has-email-${emailMeta.variant}`.trim()}>
      <div className='token-access-link-copy'>
        <div className='token-access-link-head'>
          <strong>{label}</strong>
          <div className='token-access-link-meta'>
            {subtitle ? <span>{subtitle}</span> : null}
            <span className={`token-access-badge is-${statusVariant}`.trim()}>{statusLabel}</span>
            {emailMeta.variant === 'sent' ? (
              <span className='token-access-email-chip is-sent'>Transmis</span>
            ) : null}
            {emailMeta.variant === 'prepared' ? (
              <span className='token-access-email-chip is-prepared'>Préparé</span>
            ) : null}
            {hasBeenOpened ? (
              <span className='token-access-open-chip' title={openedLabel}>Ouvert</span>
            ) : null}
          </div>
        </div>

        {badges.length > 0 ? (
          <div className='token-access-badges'>
            {badges.map((badge) => (
              <span
                key={`${badge.variant || 'default'}-${badge.label}`}
                className={`token-access-badge ${badge.variant ? `is-${badge.variant}` : ''}`.trim()}
              >
                {badge.label}
              </span>
            ))}
          </div>
        ) : null}

        {details.length > 0 ? (
          <div className='token-access-link-details'>
            {details.map((detail) => (
              <span key={detail.key || detail.label} className='token-access-link-detail'>
                <strong>{detail.label}</strong>
                {detail.text ? <span>{detail.text}</span> : null}
              </span>
            ))}
          </div>
        ) : null}

        {hasUrl ? (
          <a
            href={url}
            target='_blank'
            rel='noopener noreferrer'
            className='token-access-link-url'
            title={`Ouvrir le lien : ${label}`}
            aria-label={`Ouvrir le lien ${label}`}
          >
            {url}
          </a>
        ) : (
          <span className='token-access-link-url is-placeholder'>
            {placeholderLabel}
          </span>
        )}

        <span className='token-access-link-expiry'>
          {expiryLabel}
        </span>

        {emailMeta.detail ? (
          <span className={`token-access-link-email-state is-${emailMeta.variant}`.trim()}>
            {emailMeta.detail}
          </span>
        ) : null}

        {openedLabel ? (
          <span className='token-access-link-open-state'>
            {openedLabel}
          </span>
        ) : null}
      </div>

      <div className='token-access-link-actions'>
        <button
          type='button'
          className={`token-access-icon-btn secondary${isCopied ? ' is-success' : ''}`}
          onClick={hasUrl ? handleCopyAction : undefined}
          disabled={!hasUrl}
          title={hasUrl ? `Copier le lien : ${url}` : unavailableTitle}
          aria-label={`Copier le lien ${label}`}
        >
          <IconButtonContent label={isCopied ? 'Lien copié' : `Copier le lien ${label}`} icon={isCopied ? CheckIcon : ClipboardIcon} />
        </button>
        <button
          type='button'
          className='token-access-icon-btn primary'
          onClick={hasUrl ? onOpen : undefined}
          disabled={!hasUrl}
          title={hasUrl ? `Ouvrir le lien : ${url}` : unavailableTitle}
          aria-label={`Ouvrir le lien ${label}`}
        >
          <IconButtonContent label={`Ouvrir le lien ${label}`} icon={ArrowRightIcon} />
        </button>
        <button
          type='button'
          className={`token-access-icon-btn email is-${emailMeta.variant}`.trim()}
          onClick={canPrepareEmail ? onPrepareEmail : undefined}
          disabled={!canPrepareEmail}
          title={canPrepareEmail ? `${emailMeta.buttonLabel}: ${label}` : emailMeta.detail}
          aria-label={`${emailMeta.buttonLabel} pour ${label}`}
        >
          <IconButtonContent label={`${emailMeta.buttonLabel} pour ${label}`} icon={EmailButtonIcon} />
        </button>
      </div>
    </article>
  )
}

const PersonCard = ({
  entry,
  selectedYear,
  selectedPhaseFilters = DEFAULT_ACCESS_PHASE_FILTERS,
  emailDeliveryLedger = {},
  onPrepareEmail,
  onCopy,
  onOpen
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const selectedPhaseSet = new Set(selectedPhaseFilters)
  const showVoteGroup = selectedPhaseSet.has('vote')
  const showSoutenanceGroup = selectedPhaseSet.has('soutenance')
  const showArbitrageGroup = selectedPhaseSet.has('arbitrage')
  const personRoles = Array.isArray(entry?.person?.roles) ? entry.person.roles : []
  const roleLabels = personRoles.map((role) => getTpiRelationRoleLabel(role))
  const voteLinks = Array.isArray(entry?.voteLinks) ? entry.voteLinks : []
  const soutenanceLinks = Array.isArray(entry?.soutenanceLinks) ? entry.soutenanceLinks : []
  const arbitrageLinks = Array.isArray(entry?.arbitrageLinks) ? entry.arbitrageLinks : []
  const shouldShowArbitrageGroup = showArbitrageGroup && (
    arbitrageLinks.length > 0 ||
    personRoles.some(isExpertRole)
  )
  const hasVisiblePhaseGroup = showVoteGroup || showSoutenanceGroup || shouldShowArbitrageGroup
  const voteTpiCount = voteLinks.reduce((total, link) => total + getVoteLinkTpiCount(link), 0)
  const personName = entry?.person?.name || 'Personne sans nom'
  const personCountSummary = [
    formatNonZeroCount(voteTpiCount, 'TPI à voter', 'TPI à voter'),
    formatNonZeroCount(soutenanceLinks.length, 'défense'),
    formatNonZeroCount(arbitrageLinks.length, 'arbitrage')
  ].filter(Boolean).join(' · ') || 'Aucun lien'
  const personContext = [
    ...roleLabels,
    entry?.person?.site
  ].filter(Boolean).join(' · ')
  const emailState = buildEntryEmailState({
    entry,
    year: selectedYear,
    selectedPhaseFilters,
    ledger: emailDeliveryLedger
  })
  const handledEmailCount = (emailState.sentCount || 0) + (emailState.preparedCount || 0)
  const toggleLabel = isExpanded ? `Réduire le bloc de ${personName}` : `Ouvrir le bloc de ${personName}`
  const ToggleIcon = isExpanded ? ChevronDownIcon : ChevronRightIcon

  return (
    <article className={`token-access-person-card is-email-${emailState.variant}${isExpanded ? ' is-expanded' : ' is-collapsed'}`.trim()}>
      <header className={`token-access-person-head${isExpanded ? ' is-expanded' : ''}`.trim()}>
        <div className='token-access-person-main'>
          <span className='token-access-person-avatar' aria-hidden='true'>
            {getPersonInitials(entry?.person?.name, entry?.person?.email)}
          </span>
          <div className='token-access-person-identity'>
            <strong>{personName}</strong>
            <span>{entry?.person?.email || 'Email manquant'}</span>
            {handledEmailCount > 0 ? (
              <span className={`token-access-email-state-badge is-${emailState.variant}`.trim()}>
                {emailState.variant === 'sent'
                  ? 'Email transmis'
                  : emailState.variant === 'prepared'
                    ? 'Outlook préparé'
                    : emailState.sentCount > 0 && emailState.preparedCount > 0
                      ? `${handledEmailCount}/${emailState.totalCount} traités`
                      : emailState.preparedCount > 0
                        ? `${handledEmailCount}/${emailState.totalCount} préparés`
                        : `${handledEmailCount}/${emailState.totalCount} transmis`}
              </span>
            ) : null}
          </div>
        </div>

        {!isExpanded ? (
          <div className='token-access-person-meta'>
            {personCountSummary}
          </div>
        ) : null}

        <button
          type='button'
          className='token-access-icon-btn secondary token-access-person-collapse-btn'
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
          title={toggleLabel}
        >
          <IconButtonContent label={toggleLabel} icon={ToggleIcon} />
        </button>
      </header>

      {isExpanded ? (
        <div className='token-access-person-body'>
          {personContext ? <p className='token-access-person-context'>{personContext}</p> : null}

          {!hasVisiblePhaseGroup ? (
            <p className='token-access-empty-inline'>
              Aucun type de lien sélectionné.
            </p>
          ) : null}

          {showVoteGroup ? (
            <section className='token-access-link-group'>
              <div className='token-access-section-head'>
                <h3>
                  <VoteIcon aria-hidden='true' />
                  Liens de vote
                </h3>
              </div>

              {voteLinks.length > 0 ? (
                <div className='token-access-link-list'>
                  {voteLinks.map((link, index) => {
                    const label = formatVoteLinkLabel(link)
                    const subtitle = formatVoteLinkSubtitle(link)
                    const { deliveryKey, delivery } = getEffectiveEmailDelivery({
                      year: selectedYear,
                      person: entry?.person,
                      link,
                      phase: 'vote',
                      ledger: emailDeliveryLedger
                    })

                    return (
                      <LinkRow
                        key={link.url || `${entry?.person?.id}-vote-${link.reference || index}`}
                        label={label}
                        subtitle={subtitle}
                        details={buildVoteLinkDetails(link)}
                        url={link.url}
                        expiresAt={link.expiresAt}
                        revokedAt={link.revokedAt}
                        usageCount={link.usageCount}
                        lastUsedAt={link.lastUsedAt}
                        generated={link.generated === true}
                        recoverable={link.recoverable !== false}
                        availabilityStatus={link.availabilityStatus}
                        emailDelivery={delivery}
                        canPrepareEmail={canPrepareAccessEmail(entry?.person, link)}
                        onPrepareEmail={() => onPrepareEmail?.({
                          deliveryKey,
                          person: entry?.person,
                          link,
                          phase: 'vote',
                          label,
                          subtitle
                        })}
                        onCopy={() => onCopy(link.url)}
                        onOpen={() => onOpen(link.url)}
                      />
                    )
                  })}
                </div>
              ) : (
                <p className='token-access-empty-inline'>
                  Aucun lien de vote actif pour cette personne.
                </p>
              )}
            </section>
          ) : null}

          {shouldShowArbitrageGroup ? (
            <section className='token-access-link-group'>
              <div className='token-access-section-head'>
                <h3>
                  <WorkflowIcon aria-hidden='true' />
                  Liens d’arbitrage
                </h3>
              </div>

              {arbitrageLinks.length > 0 ? (
                <div className='token-access-link-list'>
                  {arbitrageLinks.map((link, index) => {
                    const label = formatArbitrageLinkLabel(link)
                    const subtitle = formatArbitrageLinkSubtitle(link)
                    const { deliveryKey, delivery } = getEffectiveEmailDelivery({
                      year: selectedYear,
                      person: entry?.person,
                      link,
                      phase: 'arbitrage',
                      ledger: emailDeliveryLedger
                    })

                    return (
                      <LinkRow
                        key={link.url || `${entry?.person?.id}-arbitrage-${link.proposalId || index}`}
                        label={label}
                        subtitle={subtitle}
                        details={buildArbitrageLinkDetails(link)}
                        url={link.url}
                        expiresAt={link.expiresAt}
                        usageCount={link.usageCount}
                        lastUsedAt={link.lastUsedAt}
                        generated={link.generated === true}
                        recoverable={link.recoverable !== false}
                        availabilityStatus={link.availabilityStatus}
                        emailDelivery={delivery}
                        canPrepareEmail={canPrepareAccessEmail(entry?.person, link)}
                        onPrepareEmail={() => onPrepareEmail?.({
                          deliveryKey,
                          person: entry?.person,
                          link,
                          phase: 'arbitrage',
                          label,
                          subtitle
                        })}
                        onCopy={() => onCopy(link.url)}
                        onOpen={() => onOpen(link.url)}
                      />
                    )
                  })}
                </div>
              ) : (
                <p className='token-access-empty-inline'>
                  Aucun lien d’arbitrage généré pour cette personne.
                </p>
              )}
            </section>
          ) : null}

          {showSoutenanceGroup ? (
            <section className='token-access-link-group'>
              <div className='token-access-section-head'>
                <h3>
                  <BriefcaseIcon aria-hidden='true' />
                  Liens de consultation des défenses
                </h3>
              </div>

              {soutenanceLinks.length > 0 ? (
                <div className='token-access-link-list'>
                  {soutenanceLinks.map((link) => {
                    const label = formatSoutenanceLinkLabel(link)
                    const subtitle = formatSoutenanceLinkSubtitle()
                    const { deliveryKey, delivery } = getEffectiveEmailDelivery({
                      year: selectedYear,
                      person: entry?.person,
                      link,
                      phase: 'soutenance',
                      ledger: emailDeliveryLedger
                    })

                    return (
                      <LinkRow
                        key={`${entry?.person?.id}-publication-${link.publicationVersion || 0}`}
                        label={label}
                        subtitle={subtitle}
                        url={link.url}
                        expiresAt={link.expiresAt}
                        revokedAt={link.revokedAt}
                        usageCount={link.usageCount}
                        lastUsedAt={link.lastUsedAt}
                        generated={link.generated === true}
                        recoverable={link.recoverable !== false}
                        availabilityStatus={link.availabilityStatus}
                        emailDelivery={delivery}
                        canPrepareEmail={canPrepareAccessEmail(entry?.person, link)}
                        onPrepareEmail={() => onPrepareEmail?.({
                          deliveryKey,
                          person: entry?.person,
                          link,
                          phase: 'soutenance',
                          label,
                          subtitle
                        })}
                        onCopy={() => onCopy(link.url)}
                        onOpen={() => onOpen(link.url)}
                      />
                    )
                  })}
                </div>
              ) : (
                <p className='token-access-empty-inline'>
                  Aucun lien de défense disponible pour cette personne.
                </p>
              )}
            </section>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

const SoutenanceEmailAutomationPanel = ({
  targets = [],
  summary = null,
  selectedKeys = {},
  selectedCount = 0,
  pendingCount = 0,
  resettableCount = 0,
  sentCount = 0,
  preparedCount = 0,
  deliveryMode = ACCESS_EMAIL_DELIVERY_MODES.SMTP,
  messageType = ACCESS_EMAIL_MESSAGE_TYPES.STANDARD,
  projectLeadGroup = {},
  expertGroup = {},
  preview = null,
  testEmailAddress = '',
  isPreviewLoading = false,
  isSending = false,
  outlookQueueCount = 0,
  onPreview,
  onSendTest,
  onSendAll,
  onSendSelection,
  onSendProjectLeads,
  onSendExperts,
  onResetDeliveries,
  onResetOutlookPrepared,
  onDeliveryModeChange,
  onMessageTypeChange,
  onTestEmailChange,
  onToggleTarget,
  onSelectPending,
  onClearSelection,
  onSendTarget,
  onOpenNextOutlookDraft,
  onClearOutlookQueue,
  canReconcileMissingLinks = false,
  isReconcilingMissingLinks = false,
  onReconcileMissingLinks = null,
  onCollapse
}) => {
  const hasTargets = targets.length > 0
  const previewSubject = compactText(preview?.subject)
  const canSendTest = hasTargets && testEmailAddress.trim() && !isSending
  const targetCount = targets.length
  const selectedLabel = selectedCount === 1 ? 'sélectionné' : 'sélectionnés'
  const contactLabel = targetCount === 1 ? 'contact' : 'contacts'
  const isOutlookMode = deliveryMode === ACCESS_EMAIL_DELIVERY_MODES.OUTLOOK
  const isScheduleUpdateMessage = messageType === ACCESS_EMAIL_MESSAGE_TYPES.SCHEDULE_UPDATE
  const relanceableCount = targets.filter(isSoutenanceEmailTargetRelanceable).length
  const effectivePendingCount = isScheduleUpdateMessage
    ? relanceableCount
    : isOutlookMode
    ? targets.filter(isSoutenanceEmailTargetOutlookSendable).length
    : pendingCount
  const projectLeadPendingCount = isScheduleUpdateMessage
    ? (projectLeadGroup.targets || []).filter(isSoutenanceEmailTargetRelanceable).length
    : isOutlookMode
    ? (projectLeadGroup.outlookPendingCount || 0)
    : (projectLeadGroup.pendingCount || 0)
  const expertPendingCount = isScheduleUpdateMessage
    ? (expertGroup.targets || []).filter(isSoutenanceEmailTargetRelanceable).length
    : isOutlookMode
    ? (expertGroup.outlookPendingCount || 0)
    : (expertGroup.pendingCount || 0)
  const handledCount = isOutlookMode ? preparedCount : sentCount
  const handledLabel = isOutlookMode ? 'préparés' : 'transmis'
  const pendingLabel = isScheduleUpdateMessage ? 'à relancer' : isOutlookMode ? 'à préparer' : 'à envoyer'
  const transportLabel = isScheduleUpdateMessage
    ? (isOutlookMode ? 'à relancer dans Outlook' : 'à relancer par SMTP')
    : isOutlookMode ? 'à préparer dans Outlook' : 'à transmettre par SMTP'
  const resetActionCount = isOutlookMode ? preparedCount : resettableCount
  const resetActionLabel = isOutlookMode ? 'Reset Outlook' : 'Reset envois'
  const resetActionHandler = isOutlookMode ? onResetOutlookPrepared : onResetDeliveries
  const hasOutlookQueue = isOutlookMode && outlookQueueCount > 0
  const expectedSoutenanceLinkCount = Number.parseInt(String(summary?.soutenanceLinkCount || 0), 10) || 0
  const generatedSoutenanceLinkCount = Number.parseInt(String(summary?.soutenanceGeneratedLinkCount || 0), 10) || 0
  const missingGeneratedSoutenanceLinks = !hasTargets &&
    expectedSoutenanceLinkCount > 0 &&
    generatedSoutenanceLinkCount === 0

  return (
    <section id='token-access-email-automation-panel' className='token-access-email-automation' aria-label='Envoi automatique des emails défense'>
      <div className='token-access-email-automation-head'>
        <span className='token-access-email-automation-icon' aria-hidden='true'>
          <SendIcon />
        </span>
        <div className='token-access-email-automation-title'>
          <h2>Email HTML défenses</h2>
          <p>{effectivePendingCount}/{targetCount} {transportLabel}</p>
        </div>
        <div className='token-access-email-automation-summary' aria-label='Résumé email défense'>
          <span className='is-pending'>
            <strong>{effectivePendingCount}</strong>
            {pendingLabel}
          </span>
          <span>
            <strong>{selectedCount}</strong>
            {selectedLabel}
          </span>
          <span className='is-sent'>
            <strong>{handledCount}</strong>
            {handledLabel}
          </span>
          <span>
            <strong>{resettableCount}</strong>
            reset
          </span>
        </div>
        <div className='token-access-email-mode-controls'>
          <label className={`token-access-email-mode-toggle${isOutlookMode ? ' is-active' : ''}`.trim()}>
            <input
              type='checkbox'
              checked={isOutlookMode}
              aria-label='Utiliser Outlook pour transmettre les emails HTML défense'
              onChange={(event) => onDeliveryModeChange?.(
                event.target.checked ? ACCESS_EMAIL_DELIVERY_MODES.OUTLOOK : ACCESS_EMAIL_DELIVERY_MODES.SMTP
              )}
            />
            <span>
              <strong>{isOutlookMode ? 'Outlook' : 'SMTP'}</strong>
              <small>{isOutlookMode ? 'manuel' : 'serveur'}</small>
            </span>
            <i aria-hidden='true' />
          </label>
          <label className={`token-access-email-mode-toggle${isScheduleUpdateMessage ? ' is-active' : ''}`.trim()}>
            <input
              type='checkbox'
              checked={isScheduleUpdateMessage}
              aria-label='Utiliser le message de modification d’horaire'
              onChange={(event) => onMessageTypeChange?.(
                event.target.checked
                  ? ACCESS_EMAIL_MESSAGE_TYPES.SCHEDULE_UPDATE
                  : ACCESS_EMAIL_MESSAGE_TYPES.STANDARD
              )}
            />
            <span>
              <strong>{isScheduleUpdateMessage ? 'Horaire modifié' : 'Horaire publié'}</strong>
              <small>{isScheduleUpdateMessage ? 'relance' : 'standard'}</small>
            </span>
            <i aria-hidden='true' />
          </label>
        </div>
        <button
          type='button'
          className='token-access-icon-btn secondary token-access-email-automation-close'
          aria-label='Réduire le module email HTML'
          aria-expanded='true'
          aria-controls='token-access-email-automation-panel'
          onClick={onCollapse}
        >
          <IconButtonContent label='Réduire le module email HTML' icon={ChevronRightIcon} />
        </button>
      </div>

      {hasOutlookQueue ? (
        <div className='token-access-email-outlook-queue' role='status'>
          <span>
            <strong>{outlookQueueCount}</strong>
            brouillon{outlookQueueCount > 1 ? 's' : ''} Outlook en attente
          </span>
          <button
            type='button'
            className='token-access-email-pill-button is-primary'
            onClick={onOpenNextOutlookDraft}
            disabled={isSending}
          >
            <MailIcon aria-hidden='true' />
            <span>Ouvrir brouillon suivant</span>
          </button>
          <button
            type='button'
            className='token-access-email-pill-button is-muted'
            onClick={onClearOutlookQueue}
            disabled={isSending}
          >
            <RefreshIcon aria-hidden='true' />
            <span>Annuler file</span>
          </button>
        </div>
      ) : null}

      <div className='token-access-email-control-grid'>
        <section className='token-access-email-control-group is-preparation' aria-label='Préparation email HTML'>
          <div className='token-access-email-control-title'>
            <ClipboardIcon aria-hidden='true' />
            <span>
              <strong>Préparation</strong>
              <small>Rendu et test privé</small>
            </span>
          </div>
          <div className='token-access-email-control-row is-preparation-row'>
            <label className='token-access-email-test-control' htmlFor='soutenance-email-test'>
              <span className='sr-only'>Email test</span>
              <input
                id='soutenance-email-test'
                type='email'
                placeholder='adresse privée'
                value={testEmailAddress}
                onChange={(event) => onTestEmailChange?.(event.target.value)}
              />
            </label>
            <button
              type='button'
              className='token-access-email-pill-button'
              onClick={onPreview}
              disabled={!hasTargets || isPreviewLoading || isSending}
            >
              <ClipboardIcon aria-hidden='true' />
              <span>{isPreviewLoading ? 'Prévisualisation...' : 'Prévisualiser'}</span>
            </button>
            <button
              type='button'
              className='token-access-email-pill-button is-primary'
              onClick={onSendTest}
              disabled={!canSendTest}
            >
              <MailIcon aria-hidden='true' />
              <span>Test</span>
            </button>
          </div>
        </section>

        <section className='token-access-email-control-group is-batch' aria-label='Envoi email HTML par lot'>
          <div className='token-access-email-control-title'>
            <SendIcon aria-hidden='true' />
            <span>
              <strong>Lots</strong>
              <small>Tous, CDP ou experts</small>
            </span>
          </div>
          <div className='token-access-email-control-row is-three-columns'>
            <button
              type='button'
              className='token-access-email-pill-button is-primary'
              onClick={onSendAll}
              disabled={effectivePendingCount === 0 || isSending || hasOutlookQueue}
            >
              <SendIcon aria-hidden='true' />
              <span>tous</span>
              <strong>{effectivePendingCount}/{targetCount}</strong>
            </button>
            <button
              type='button'
              className='token-access-email-pill-button is-primary'
              onClick={onSendProjectLeads}
              disabled={projectLeadPendingCount === 0 || isSending || hasOutlookQueue}
            >
              <SendIcon aria-hidden='true' />
              <span>cdp</span>
              <strong>{projectLeadPendingCount}/{projectLeadGroup.totalCount || 0}</strong>
            </button>
            <button
              type='button'
              className='token-access-email-pill-button is-primary'
              onClick={onSendExperts}
              disabled={expertPendingCount === 0 || isSending || hasOutlookQueue}
            >
              <SendIcon aria-hidden='true' />
              <span>experts</span>
              <strong>{expertPendingCount}/{expertGroup.totalCount || 0}</strong>
            </button>
          </div>
        </section>

        <section className='token-access-email-control-group is-selection' aria-label='Envoi email HTML par sélection'>
          <div className='token-access-email-control-title'>
            <CheckIcon aria-hidden='true' />
            <span>
              <strong>Sélection</strong>
              <small>{selectedCount} choisi{selectedCount > 1 ? 's' : ''}</small>
            </span>
          </div>
          <div className='token-access-email-control-row'>
            <button
              type='button'
              className='token-access-email-pill-button is-muted'
              onClick={onSelectPending}
              disabled={effectivePendingCount === 0 || isSending}
            >
              <CheckIcon aria-hidden='true' />
              <span>{isOutlookMode ? 'À préparer' : 'À envoyer'}</span>
            </button>
            <button
              type='button'
              className='token-access-email-pill-button is-muted'
              onClick={onClearSelection}
              disabled={selectedCount === 0 || isSending}
            >
              <RefreshIcon aria-hidden='true' />
              <span>Effacer</span>
            </button>
            <button
              type='button'
              className='token-access-email-pill-button is-muted'
              onClick={resetActionHandler}
              disabled={resetActionCount === 0 || isSending}
            >
              <RefreshIcon aria-hidden='true' />
              <span>{resetActionLabel}</span>
              <strong>{resetActionCount}</strong>
            </button>
            <button
              type='button'
              className='token-access-email-pill-button is-primary'
              onClick={onSendSelection}
              disabled={selectedCount === 0 || isSending || hasOutlookQueue}
            >
              <SendIcon aria-hidden='true' />
              <span>Envoyer sélection</span>
              <strong>{selectedCount}</strong>
            </button>
          </div>
        </section>
      </div>

      <div className='token-access-email-automation-grid'>
        <section className='token-access-email-book-panel' aria-label='Destinataires email défense'>
          <div className='token-access-email-panel-head'>
            <span>
              <strong>Destinataires</strong>
              <small>{targetCount} {contactLabel}</small>
            </span>
            <em>{effectivePendingCount} {pendingLabel}</em>
          </div>
          <div className='token-access-email-book' role='list' aria-label='Carnet d’adresses défense'>
            {targets.length === 0 ? (
              <div className='token-access-email-book-empty'>
                <span>
                  {missingGeneratedSoutenanceLinks
                    ? `${expectedSoutenanceLinkCount} lien(s) défense sont préparés, mais aucun accès n’est encore généré. Créez les liens manquants avant d’utiliser les emails HTML.`
                    : 'Aucun lien de défense disponible.'}
                </span>
                {missingGeneratedSoutenanceLinks && canReconcileMissingLinks ? (
                  <button
                    type='button'
                    className='token-access-email-pill-button is-primary'
                    onClick={onReconcileMissingLinks}
                    disabled={isReconcilingMissingLinks}
                  >
                    <IconButtonContent
                      label={isReconcilingMissingLinks ? 'Rattrapage...' : 'Créer les liens manquants'}
                      icon={RefreshIcon}
                      showLabel
                    />
                  </button>
                ) : null}
              </div>
            ) : targets.map((target) => {
              const deliveryMeta = getEmailDeliveryDisplayMeta(target.delivery, true)
              const isChecked = selectedKeys[target.deliveryKey] === true
              const isHandled = isEmailDeliverySent(target.delivery) || isEmailDeliveryPrepared(target.delivery)
              const isSendable = isOutlookMode
                ? isSoutenanceEmailTargetOutlookSendable(target)
                : isSoutenanceEmailTargetSmtpSendable(target)
              const isRelanceable = isSoutenanceEmailTargetRelanceable(target)
              const isSelectable = isScheduleUpdateMessage ? isRelanceable : isSendable
              const canTriggerTarget = isRelanceable && !isSending && !hasOutlookQueue && (
                isScheduleUpdateMessage || isSendable || isHandled
              )
              const targetActionLabel = isScheduleUpdateMessage || isHandled
                ? 'Relancer'
                : isOutlookMode ? 'Préparer' : 'Envoyer'
              const targetName = target.person?.name || target.person?.email || 'destinataire'

              return (
                <div
                  key={target.deliveryKey}
                  className={`token-access-email-book-row is-${deliveryMeta.variant}${isChecked ? ' is-selected' : ''}`.trim()}
                  role='listitem'
                >
                  <input
                    type='checkbox'
                    checked={isChecked}
                    disabled={!isSelectable || isSending}
                    aria-label={`Sélectionner ${targetName}`}
                    onChange={(event) => onToggleTarget?.(target.deliveryKey, event.target.checked)}
                  />
                  <span className='token-access-email-book-person'>
                    <strong>{target.person?.name || target.person?.email}</strong>
                    <small>{target.person?.email || 'Email manquant'}</small>
                  </span>
                  <span className={`token-access-email-book-audience is-${target.audience}`.trim()}>
                    {target.audienceLabel}
                  </span>
                  <span className={`token-access-email-book-state is-${deliveryMeta.variant}`.trim()}>
                    {isSelectable ? pendingLabel.charAt(0).toUpperCase() + pendingLabel.slice(1) : deliveryMeta.label}
                  </span>
                  <button
                    type='button'
                    className='token-access-email-book-action'
                    onClick={() => onSendTarget?.(target)}
                    disabled={!canTriggerTarget}
                    title={`${targetActionLabel} ${targetName}`}
                    aria-label={`${targetActionLabel} ${targetName}`}
                  >
                    <MailIcon aria-hidden='true' />
                    <span>{targetActionLabel}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        <div className='token-access-email-preview'>
          <div className='token-access-email-preview-head'>
            <strong>Prévisualisation</strong>
            {previewSubject ? <span>{previewSubject}</span> : null}
          </div>
          {preview?.html ? (
            <iframe
              title='Prévisualisation du template email défense'
              srcDoc={preview.html}
            />
          ) : (
            <div className='token-access-email-preview-empty'>
              <ClipboardIcon aria-hidden='true' />
              <span>Prévisualisez le template avant l’envoi.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

const TokenGenerator = ({ toggleArrow, isArrowUp }) => {
  const location = useLocation()
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const requestedLinkType = queryParams.get('phase') || queryParams.get('type')
  const isMountedRef = useRef(false)
  const accessLinkRequestIdRef = useRef(0)
  const accessAuditRequestIdRef = useRef(0)
  const accessUsageRequestIdRef = useRef(0)
  const soutenanceOutlookDraftQueueRef = useRef([])
  const soutenanceOutlookPreparedKeysRef = useRef(new Set())
  const [selectedYear, setSelectedYear] = useState(() => (
    getStoredAccessYear() || YEARS_CONFIG.getCurrentYear()
  ))
  const [searchQuery, setSearchQuery] = useState('')
  const [linkTypeFilters, setLinkTypeFilters] = useState(() => (
    ACCESS_PHASE_FILTER_VALUES.has(requestedLinkType)
      ? [requestedLinkType]
      : DEFAULT_ACCESS_PHASE_FILTERS
  ))
  const [previewPayload, setPreviewPayload] = useState(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [accessLinkSettings, setAccessLinkSettings] = useState(DEFAULT_ACCESS_LINK_SETTINGS)
  const [staticPublicationInfo, setStaticPublicationInfo] = useState(null)
  const [staticVotePublicationInfo, setStaticVotePublicationInfo] = useState(null)
  const [usePublicationSiteLinks, setUsePublicationSiteLinks] = useState(false)
  const [useVotePublicationSiteLinks, setUseVotePublicationSiteLinks] = useState(false)
  const [showCandidateBlocks, setShowCandidateBlocks] = useState(getStoredShowCandidatesPreference)
  const [isSummaryPanelCollapsed, setIsSummaryPanelCollapsed] = useState(true)
  const [isEmailAutomationPanelCollapsed, setIsEmailAutomationPanelCollapsed] = useState(true)
  const [emailDeliveryLedger, setEmailDeliveryLedger] = useState(() => readAccessEmailDeliveryLedger(
    getStoredAccessYear() || YEARS_CONFIG.getCurrentYear()
  ))
  const [selectedSoutenanceEmailKeys, setSelectedSoutenanceEmailKeys] = useState({})
  const [soutenanceEmailPreview, setSoutenanceEmailPreview] = useState(null)
  const [soutenanceEmailDeliveryMode, setSoutenanceEmailDeliveryMode] = useState(getStoredSoutenanceEmailDeliveryMode)
  const [soutenanceEmailMessageType, setSoutenanceEmailMessageType] = useState(getStoredSoutenanceEmailMessageType)
  const [soutenanceOutlookDraftQueue, setSoutenanceOutlookDraftQueue] = useState([])
  const [testEmailAddress, setTestEmailAddress] = useState('')
  const [isEmailPreviewLoading, setIsEmailPreviewLoading] = useState(false)
  const [isAutomaticEmailSending, setIsAutomaticEmailSending] = useState(false)
  const [isReconcilingSoutenanceLinks, setIsReconcilingSoutenanceLinks] = useState(false)
  const [accessAuditEvents, setAccessAuditEvents] = useState([])
  const [isAccessAuditLoading, setIsAccessAuditLoading] = useState(false)
  const [accessAuditError, setAccessAuditError] = useState('')
  const [accessUsageLogs, setAccessUsageLogs] = useState([])
  const [isAccessUsageLoading, setIsAccessUsageLoading] = useState(false)
  const [accessUsageError, setAccessUsageError] = useState('')

  const replaceSoutenanceOutlookDraftQueue = useCallback((queue) => {
    const nextQueue = Array.isArray(queue) ? queue.filter(Boolean) : []
    soutenanceOutlookDraftQueueRef.current = nextQueue
    setSoutenanceOutlookDraftQueue(nextQueue)
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    const loadYearLinkDefaults = async () => {
      const [statusResult, voteStatusResult, configResult] = await Promise.allSettled([
        workflowCoordinationService.getStaticPublicationStatus(selectedYear),
        workflowCoordinationService.getStaticVotePublicationStatus(selectedYear),
        coordinationConfigService.getByYear(selectedYear)
      ])

      if (isCancelled) {
        return
      }

      const status = statusResult.status === 'fulfilled' ? statusResult.value || null : null
      const voteStatus = voteStatusResult.status === 'fulfilled' ? voteStatusResult.value || null : null
      const normalizedLinkSettings = normalizeAccessLinkSettings(
        configResult.status === 'fulfilled' ? configResult.value?.accessLinkSettings : null
      )

      setStaticPublicationInfo(status)
      setStaticVotePublicationInfo(voteStatus)
      setAccessLinkSettings(normalizedLinkSettings)
      setUsePublicationSiteLinks(normalizedLinkSettings.defaultSoutenanceLinkTarget === 'publication')
      setUseVotePublicationSiteLinks(normalizedLinkSettings.defaultVoteLinkTarget === 'static')
    }

    loadYearLinkDefaults()

    return () => {
      isCancelled = true
    }
  }, [selectedYear])

  useEffect(() => {
    persistCoordinationYear(selectedYear)
  }, [selectedYear])

  useEffect(() => {
    setEmailDeliveryLedger(readAccessEmailDeliveryLedger(selectedYear))
    replaceSoutenanceOutlookDraftQueue([])
  }, [replaceSoutenanceOutlookDraftQueue, selectedYear])

  useEffect(() => {
    const preparedKeys = new Set()
    const ledger = isPlainObject(emailDeliveryLedger) ? emailDeliveryLedger : {}

    for (const [deliveryKey, delivery] of Object.entries(ledger)) {
      if (isLocalOutlookPreparedDelivery(delivery)) {
        preparedKeys.add(deliveryKey)
      }
    }

    soutenanceOutlookPreparedKeysRef.current = preparedKeys
  }, [emailDeliveryLedger])

  useEffect(() => {
    writeStorageValue(STORAGE_KEYS.ACCESS_LINK_SHOW_CANDIDATES, showCandidateBlocks ? 'true' : 'false')
  }, [showCandidateBlocks])

  useEffect(() => {
    writeStorageValue(ACCESS_EMAIL_DELIVERY_MODE_STORAGE_KEY, soutenanceEmailDeliveryMode)
    if (soutenanceEmailDeliveryMode !== ACCESS_EMAIL_DELIVERY_MODES.OUTLOOK) {
      replaceSoutenanceOutlookDraftQueue([])
    }
  }, [replaceSoutenanceOutlookDraftQueue, soutenanceEmailDeliveryMode])

  useEffect(() => {
    writeStorageValue(ACCESS_EMAIL_MESSAGE_TYPE_STORAGE_KEY, soutenanceEmailMessageType)
    setSoutenanceEmailPreview(null)
    replaceSoutenanceOutlookDraftQueue([])
  }, [replaceSoutenanceOutlookDraftQueue, soutenanceEmailMessageType])

  useEffect(() => {
    if (ACCESS_PHASE_FILTER_VALUES.has(requestedLinkType)) {
      setLinkTypeFilters([requestedLinkType])
    }
  }, [requestedLinkType])

  const activeLinkTypeFilterSet = useMemo(() => new Set(linkTypeFilters), [linkTypeFilters])
  const areAllLinkTypeFiltersActive = linkTypeFilters.length === DEFAULT_ACCESS_PHASE_FILTERS.length
  const toggleLinkTypeFilter = useCallback((value) => {
    if (!ACCESS_PHASE_FILTER_VALUES.has(value)) {
      return
    }

    setLinkTypeFilters((current) => {
      const nextSet = new Set(Array.isArray(current) ? current.filter((item) => ACCESS_PHASE_FILTER_VALUES.has(item)) : [])
      if (nextSet.has(value)) {
        nextSet.delete(value)
      } else {
        nextSet.add(value)
      }

      return DEFAULT_ACCESS_PHASE_FILTERS.filter((item) => nextSet.has(item))
    })
  }, [])

  const filteredPeople = useMemo(() => {
    const people = Array.isArray(previewPayload?.people) ? previewPayload.people : []
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return people.filter((entry) => {
      if (!showCandidateBlocks && isCandidateAccessEntry(entry)) {
        return false
      }

      const hasVoteLinks = Array.isArray(entry?.voteLinks) && entry.voteLinks.length > 0
      const hasSoutenanceLinks = Array.isArray(entry?.soutenanceLinks) && entry.soutenanceLinks.length > 0
      const hasArbitrageLinks = Array.isArray(entry?.arbitrageLinks) && entry.arbitrageLinks.length > 0

      const matchesSelectedLinkType = (
        (activeLinkTypeFilterSet.has('vote') && hasVoteLinks) ||
        (activeLinkTypeFilterSet.has('soutenance') && hasSoutenanceLinks) ||
        (activeLinkTypeFilterSet.has('arbitrage') && hasArbitrageLinks)
      )

      if (!areAllLinkTypeFiltersActive && !matchesSelectedLinkType) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const searchCorpus = [
        entry?.person?.name,
        entry?.person?.email,
        ...(entry?.person?.roles || []),
        ...(entry?.voteLinks || []).flatMap((link) => [
          link.reference,
          link.candidateName,
          link.roleLabel,
          link.subject,
          ...(getVoteLinkTpiEntries(link).flatMap((tpi) => [
            tpi.reference,
            tpi.candidateName,
            tpi.roleLabel,
            tpi.subject
          ]))
        ]),
        ...(entry?.soutenanceLinks || []).map((link) =>
          link.publicationVersion ? `publication ${link.publicationVersion}` : 'publication active'
        ),
        ...(entry?.arbitrageLinks || []).flatMap((link) => [
          link.reference,
          link.candidateName,
          link.roleLabel,
          link.subject,
          link.proposedSlotLabel,
          formatArbitrageProposalStatus(link.status),
          formatArbitrageResponseStatus(link.responseStatus)
        ])
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchCorpus.includes(normalizedQuery)
    })
  }, [activeLinkTypeFilterSet, areAllLinkTypeFiltersActive, previewPayload?.people, searchQuery, showCandidateBlocks])

  const staticPublicationPublicUrl = typeof staticPublicationInfo?.publicUrl === 'string'
    ? staticPublicationInfo.publicUrl.trim()
    : ''
  const staticVotePublicationPublicUrl = typeof staticVotePublicationInfo?.publicUrl === 'string'
    ? staticVotePublicationInfo.publicUrl.trim()
    : ''
  const localTargetLabel = formatUrlHost(
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  ) || 'localhost'
  const publicationTargetLabel = formatUrlHost(staticPublicationPublicUrl || 'https://tpi26.ch')
  const votePublicationTargetLabel = formatUrlHost(staticVotePublicationPublicUrl)
  const canUsePublicationSiteLinks = Boolean(staticPublicationPublicUrl)
  const canUseVotePublicationSiteLinks = Boolean(staticVotePublicationPublicUrl)
  const hasConfiguredPublicationSiteLinks = accessLinkSettings.defaultSoutenanceLinkTarget === 'publication'
  const hasConfiguredVotePublicationSiteLinks = accessLinkSettings.defaultVoteLinkTarget === 'static'
  const canSelectPublicationSiteLinks = canUsePublicationSiteLinks || hasConfiguredPublicationSiteLinks
  const canSelectVotePublicationSiteLinks = canUseVotePublicationSiteLinks || hasConfiguredVotePublicationSiteLinks
  const accessLinkTargetOptions = useMemo(() => ({
    soutenanceLinkTarget: usePublicationSiteLinks ? 'publication' : 'app',
    ...(usePublicationSiteLinks && staticPublicationPublicUrl ? { soutenancePublicUrl: staticPublicationPublicUrl } : {}),
    voteLinkTarget: useVotePublicationSiteLinks ? 'static' : 'app',
    ...(useVotePublicationSiteLinks && staticVotePublicationPublicUrl ? { votePublicUrl: staticVotePublicationPublicUrl } : {})
  }), [
    staticPublicationPublicUrl,
    staticVotePublicationPublicUrl,
    usePublicationSiteLinks,
    useVotePublicationSiteLinks
  ])

  const loadAccessLinksPreview = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++accessLinkRequestIdRef.current
    setIsPreviewLoading(true)
    setErrorMessage('')
    if (!silent) {
      setSuccessMessage('')
    }

    try {
      const preview = await workflowCoordinationService.previewAccessLinks(
        selectedYear,
        window.location.origin,
        {
          ...accessLinkTargetOptions
        }
      )

      if (requestId !== accessLinkRequestIdRef.current) {
        return
      }

      setPreviewPayload(preview)
      if (!silent) {
        setSuccessMessage(
          `Liens chargés: ${preview?.summary?.peopleCount || 0} personne(s), ${preview?.summary?.voteLinkCount || 0} lien(s) vote, ${preview?.summary?.soutenanceLinkCount || 0} lien(s) défense, ${preview?.summary?.arbitrageLinkCount || 0} lien(s) arbitrage, ${preview?.summary?.generatedLinkCount || 0} accès disponible(s).`
        )
      }
    } catch (error) {
      if (requestId !== accessLinkRequestIdRef.current) {
        return
      }

      setPreviewPayload(null)
      setErrorMessage(
        error?.data?.error || error?.message || 'Impossible de charger les liens d’accès.'
      )
    } finally {
      setIsPreviewLoading(false)
    }
  }, [selectedYear, accessLinkTargetOptions])

  const loadAccessAudit = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++accessAuditRequestIdRef.current
    if (!silent) {
      setIsAccessAuditLoading(true)
    }
    setAccessAuditError('')

    try {
      const result = await workflowCoordinationService.getAudit(selectedYear, 80)

      if (!isMountedRef.current || requestId !== accessAuditRequestIdRef.current) {
        return
      }

      setAccessAuditEvents(Array.isArray(result?.events) ? result.events : [])
    } catch (error) {
      if (!isMountedRef.current || requestId !== accessAuditRequestIdRef.current) {
        return
      }

      setAccessAuditError(
        error?.data?.error || error?.message || 'Historique indisponible.'
      )
    } finally {
      if (isMountedRef.current && requestId === accessAuditRequestIdRef.current) {
        setIsAccessAuditLoading(false)
      }
    }
  }, [selectedYear])

  const loadAccessUsageLogs = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++accessUsageRequestIdRef.current
    if (!silent) {
      setIsAccessUsageLoading(true)
    }
    setAccessUsageError('')

    try {
      const result = await workflowCoordinationService.getAccessLinkLogs(selectedYear, {
        limit: 20
      })

      if (!isMountedRef.current || requestId !== accessUsageRequestIdRef.current) {
        return
      }

      setAccessUsageLogs(Array.isArray(result?.logs) ? result.logs : [])
    } catch (error) {
      if (!isMountedRef.current || requestId !== accessUsageRequestIdRef.current) {
        return
      }

      setAccessUsageError(
        error?.data?.error || error?.message || 'Ouvertures indisponibles.'
      )
    } finally {
      if (isMountedRef.current && requestId === accessUsageRequestIdRef.current) {
        setIsAccessUsageLoading(false)
      }
    }
  }, [selectedYear])

  const handleGenerateLinks = useCallback(async () => {
    if (
      useVotePublicationSiteLinks &&
      typeof window !== 'undefined' &&
      !window.confirm(STATIC_VOTE_REGENERATION_CONFIRM_MESSAGE)
    ) {
      return
    }

    const requestId = ++accessLinkRequestIdRef.current
    setIsGenerating(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const result = await workflowCoordinationService.generateAccessLinks(
        selectedYear,
        window.location.origin,
        {
          ...accessLinkTargetOptions
        }
      )

      if (requestId !== accessLinkRequestIdRef.current) {
        return
      }

      const publicationRefresh = result?.publicationRefresh || null
      if (publicationRefresh?.votePublication) {
        setStaticVotePublicationInfo(publicationRefresh.votePublication)
      }
      if (publicationRefresh?.soutenancePublication) {
        setStaticPublicationInfo(publicationRefresh.soutenancePublication)
      }

      setPreviewPayload(result)
      loadAccessAudit({ silent: true })
      setSearchQuery('')
      setLinkTypeFilters(DEFAULT_ACCESS_PHASE_FILTERS)
      const autoPublishedDefenseVersion = result?.contexts?.soutenance?.autoPublishedPublicationVersion
      const warnings = Array.isArray(result?.warnings) ? result.warnings.filter(Boolean) : []
      setSuccessMessage(
        `${result?.summary?.peopleCount || 0} personne(s) préparée(s), ${result?.summary?.voteGeneratedLinkCount || 0}/${result?.summary?.voteLinkCount || 0} accès vote disponibles, ${result?.summary?.soutenanceGeneratedLinkCount || 0}/${result?.summary?.soutenanceLinkCount || 0} accès défense disponibles, ${result?.summary?.arbitrageLinkCount || 0} accès arbitrage affiché(s).${
          autoPublishedDefenseVersion ? ` Publication défense v${autoPublishedDefenseVersion} créée depuis la planification confirmée.` : ''
        }${
          publicationRefresh?.votePublication?.publicUrl ? ` Mini-site vote rafraîchi: ${publicationRefresh.votePublication.publicUrl}` : ''
        }${
          publicationRefresh?.soutenancePublication?.publicUrl ? ` Mini-site défense rafraîchi: ${publicationRefresh.soutenancePublication.publicUrl}` : ''
        }${
          warnings.length > 0 ? ` Attention: ${warnings.join(' ')}` : ''
        }`
      )
    } catch (error) {
      if (requestId !== accessLinkRequestIdRef.current) {
        return
      }

      setErrorMessage(
        error?.data?.error || error?.message || 'Impossible de générer les liens d’accès.'
      )
    } finally {
      setIsGenerating(false)
    }
  }, [
    accessLinkTargetOptions,
    loadAccessAudit,
    selectedYear,
    useVotePublicationSiteLinks
  ])

  const handleReconcileSoutenanceAccessLinks = useCallback(async () => {
    const requestId = ++accessLinkRequestIdRef.current
    setIsReconcilingSoutenanceLinks(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const result = await workflowCoordinationService.reconcileAccessLinks(
        selectedYear,
        window.location.origin,
        {
          phases: ['soutenance'],
          ...accessLinkTargetOptions
        }
      )

      if (requestId !== accessLinkRequestIdRef.current) {
        return
      }

      setPreviewPayload(result)
      loadAccessAudit({ silent: true })
      setSearchQuery('')
      setLinkTypeFilters(DEFAULT_ACCESS_PHASE_FILTERS)
      const generatedCount = result?.summary?.soutenanceGeneratedLinkCount || 0
      const expectedCount = result?.summary?.soutenanceLinkCount || 0
      setSuccessMessage(
        `Liens défense réconciliés: ${generatedCount}/${expectedCount} accès disponibles pour la publication active.`
      )
    } catch (error) {
      if (requestId !== accessLinkRequestIdRef.current) {
        return
      }

      setErrorMessage(
        error?.data?.error || error?.message || 'Impossible de réconcilier les liens défense.'
      )
    } finally {
      setIsReconcilingSoutenanceLinks(false)
    }
  }, [
    accessLinkTargetOptions,
    loadAccessAudit,
    selectedYear
  ])
  useEffect(() => {
    loadAccessLinksPreview({ silent: true })
  }, [loadAccessLinksPreview])

  useEffect(() => {
    setAccessAuditEvents([])
    setAccessAuditError('')
    setAccessUsageLogs([])
    setAccessUsageError('')
  }, [selectedYear])

  useEffect(() => {
    if (isSummaryPanelCollapsed) {
      return
    }

    loadAccessAudit()
    loadAccessUsageLogs()
  }, [
    isSummaryPanelCollapsed,
    loadAccessAudit,
    loadAccessUsageLogs
  ])

  const handleCopy = async (url) => {
    try {
      await copyToClipboard(url)
      setSuccessMessage('Lien copié dans le presse-papiers.')
      setErrorMessage('')
      return true
    } catch (error) {
      setErrorMessage('Impossible de copier ce lien.')
      return false
    }
  }

  const handleOpen = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handlePrepareEmail = useCallback(({
    deliveryKey,
    person,
    link,
    phase,
    label,
    subtitle
  }) => {
    if (!deliveryKey || !canPrepareAccessEmail(person, link)) {
      setErrorMessage('Impossible de préparer cet email: lien ou adresse manquante.')
      return
    }

    const draft = buildAccessEmailDraft({
      year: selectedYear,
      person,
      link,
      phase,
      label,
      subtitle
    })
    const sentAt = new Date().toISOString()

    openMailtoDraft(buildMailtoUrl(draft))
    setEmailDeliveryLedger((current) => {
      const next = {
        ...current,
        [deliveryKey]: buildOutlookPreparedDeliveryEntry({
          target: {
            person,
            link,
            phase,
            label
          },
          preparedAt: sentAt
        })
      }
      writeAccessEmailDeliveryLedger(selectedYear, next)
      return next
    })
    setErrorMessage('')
    setSuccessMessage(`Email Outlook préparé pour ${person?.name || person?.email} (${label}).`)
  }, [selectedYear])

  const soutenanceEmailAutomationTargets = useMemo(() => {
    const targets = []

    for (const entry of Array.isArray(previewPayload?.people) ? previewPayload.people : []) {
      if (!showCandidateBlocks && isCandidateAccessEntry(entry)) {
        continue
      }

      const target = buildSoutenanceEmailTarget({
        entry,
        year: selectedYear,
        ledger: emailDeliveryLedger
      })

      if (!target) {
        continue
      }

      if (!compactText(target.link?.id)) {
        continue
      }

      const audience = getSoutenanceEmailAudience(entry?.person)
      targets.push({
        ...target,
        audience,
        audienceLabel: getSoutenanceEmailAudienceLabel(audience)
      })
    }

    return targets.sort((left, right) => {
      const leftAudience = String(left.audience || '')
      const rightAudience = String(right.audience || '')
      if (leftAudience !== rightAudience) {
        return leftAudience.localeCompare(rightAudience)
      }

      return String(left.person?.name || left.person?.email || '').localeCompare(
        String(right.person?.name || right.person?.email || '')
      )
    })
  }, [emailDeliveryLedger, previewPayload?.people, selectedYear, showCandidateBlocks])

  const soutenanceEmailAutomationGroups = useMemo(() => ({
    projectLeads: buildSoutenanceEmailAutomationGroup(
      soutenanceEmailAutomationTargets.filter((target) => target.audience === 'cdp')
    ),
    standaloneExperts: buildSoutenanceEmailAutomationGroup(
      soutenanceEmailAutomationTargets.filter((target) => target.audience === 'expert')
    ),
    all: buildSoutenanceEmailAutomationGroup(soutenanceEmailAutomationTargets)
  }), [soutenanceEmailAutomationTargets])

  const selectedSoutenanceEmailTargets = useMemo(() => (
    soutenanceEmailAutomationTargets.filter((target) => selectedSoutenanceEmailKeys[target.deliveryKey] === true)
  ), [selectedSoutenanceEmailKeys, soutenanceEmailAutomationTargets])
  const isSoutenanceScheduleUpdateMessage = soutenanceEmailMessageType === ACCESS_EMAIL_MESSAGE_TYPES.SCHEDULE_UPDATE

  useEffect(() => {
    const validKeys = new Set(soutenanceEmailAutomationTargets.map((target) => target.deliveryKey))
    setSelectedSoutenanceEmailKeys((current) => {
      const next = {}
      let changed = false

      for (const [key, isSelected] of Object.entries(isPlainObject(current) ? current : {})) {
        if (isSelected === true && validKeys.has(key)) {
          next[key] = true
        } else {
          changed = true
        }
      }

      return changed ? next : current
    })
  }, [soutenanceEmailAutomationTargets])

  const handleToggleSoutenanceEmailSelection = useCallback((deliveryKey, checked) => {
    if (!deliveryKey) {
      return
    }

    setSelectedSoutenanceEmailKeys((current) => {
      const next = { ...(isPlainObject(current) ? current : {}) }
      if (checked) {
        next[deliveryKey] = true
      } else {
        delete next[deliveryKey]
      }

      return next
    })
  }, [])

  const handleSelectPendingSoutenanceEmails = useCallback(() => {
    const next = {}
    const pendingTargets = isSoutenanceScheduleUpdateMessage
      ? soutenanceEmailAutomationGroups.all.targets.filter(isSoutenanceEmailTargetRelanceable)
      : soutenanceEmailDeliveryMode === ACCESS_EMAIL_DELIVERY_MODES.OUTLOOK
      ? soutenanceEmailAutomationGroups.all.outlookPendingTargets
      : soutenanceEmailAutomationGroups.all.pendingTargets

    for (const target of pendingTargets || []) {
      next[target.deliveryKey] = true
    }
    setSelectedSoutenanceEmailKeys(next)
  }, [
    isSoutenanceScheduleUpdateMessage,
    soutenanceEmailAutomationGroups.all.targets,
    soutenanceEmailAutomationGroups.all.outlookPendingTargets,
    soutenanceEmailAutomationGroups.all.pendingTargets,
    soutenanceEmailDeliveryMode
  ])

  const handleClearSoutenanceEmailSelection = useCallback(() => {
    setSelectedSoutenanceEmailKeys({})
  }, [])

  const getDefaultSoutenanceEmailTarget = useCallback(() => (
    selectedSoutenanceEmailTargets[0] ||
    (
      soutenanceEmailDeliveryMode === ACCESS_EMAIL_DELIVERY_MODES.OUTLOOK
        ? soutenanceEmailAutomationGroups.all.outlookPendingTargets?.[0]
        : soutenanceEmailAutomationGroups.all.pendingTargets?.[0]
    ) ||
    soutenanceEmailAutomationTargets[0] ||
    null
  ), [
    selectedSoutenanceEmailTargets,
    soutenanceEmailAutomationGroups.all.outlookPendingTargets,
    soutenanceEmailAutomationGroups.all.pendingTargets,
    soutenanceEmailAutomationTargets,
    soutenanceEmailDeliveryMode
  ])

  const handlePreviewSoutenanceEmailTemplate = useCallback(async () => {
    const target = getDefaultSoutenanceEmailTarget()
    if (!target) {
      setErrorMessage('Aucun lien défense disponible pour prévisualiser le template.')
      return
    }

    setIsEmailPreviewLoading(true)
    setErrorMessage('')

    try {
      const preview = await workflowCoordinationService.previewSoutenanceAccessEmail(
        selectedYear,
        buildSoutenanceEmailRequestTarget(target),
        { messageType: soutenanceEmailMessageType }
      )
      setSoutenanceEmailPreview(preview)
    } catch (error) {
      setErrorMessage(
        error?.data?.error || error?.message || 'Impossible de prévisualiser le template email.'
      )
    } finally {
      setIsEmailPreviewLoading(false)
    }
  }, [getDefaultSoutenanceEmailTarget, selectedYear, soutenanceEmailMessageType])

  const applySoutenanceEmailSendResults = useCallback((targets, response, batchLabel, messageType = ACCESS_EMAIL_MESSAGE_TYPES.STANDARD) => {
    const targetByKey = new Map((Array.isArray(targets) ? targets : []).map((target) => [target.deliveryKey, target]))
    const ledgerEntries = {}
    const sentKeys = new Set()

    for (const result of Array.isArray(response?.results) ? response.results : []) {
      const deliveryKey = result.clientKey || result.deliveryKey
      const target = targetByKey.get(deliveryKey)
      if (!deliveryKey || !target) {
        continue
      }

      if (result.deliveryStatus === 'sent') {
        sentKeys.add(deliveryKey)
        ledgerEntries[deliveryKey] = {
          status: 'sent',
          source: 'system',
          messageType,
          sentAt: result.sentAt || new Date().toISOString(),
          recipientEmail: compactText(result.recipientEmail || target.person?.email),
          linkType: 'soutenance',
          linkLabel: target.label,
          linkUrl: getAccessLinkUrl(target.link),
          messageId: compactText(result.messageId),
          coversChangeRequests: true,
          batch: batchLabel
        }
      } else if (result.deliveryStatus === 'failed') {
        ledgerEntries[deliveryKey] = {
          status: 'failed',
          source: 'system',
          messageType,
          recipientEmail: compactText(result.recipientEmail || target.person?.email),
          linkType: 'soutenance',
          linkLabel: target.label,
          linkUrl: getAccessLinkUrl(target.link),
          error: result.error || 'Envoi automatique échoué',
          coversChangeRequests: true,
          batch: batchLabel
        }
      } else if (result.deliveryStatus === 'skipped' && result.sentAt) {
        sentKeys.add(deliveryKey)
        ledgerEntries[deliveryKey] = {
          status: 'sent',
          source: 'system',
          messageType,
          sentAt: result.sentAt,
          recipientEmail: compactText(result.recipientEmail || target.person?.email),
          linkType: 'soutenance',
          linkLabel: target.label,
          linkUrl: getAccessLinkUrl(target.link),
          messageId: compactText(result.messageId),
          coversChangeRequests: true,
          batch: batchLabel
        }
      }
    }

    if (Object.keys(ledgerEntries).length > 0) {
      setEmailDeliveryLedger((current) => {
        const next = {
          ...(isPlainObject(current) ? current : {}),
          ...ledgerEntries
        }
        writeAccessEmailDeliveryLedger(selectedYear, next)
        return next
      })
    }

    if (sentKeys.size > 0) {
      setSelectedSoutenanceEmailKeys((current) => {
        const next = { ...(isPlainObject(current) ? current : {}) }
        for (const key of sentKeys) {
          delete next[key]
        }
        return next
      })
    }
  }, [selectedYear])

  const handleSendSoutenanceEmailTargets = useCallback(async (targets, batchLabel, options = {}) => {
    const selectedTargets = Array.isArray(targets) ? targets.filter(Boolean) : []
    const testEmail = compactText(options.testEmail)
    const messageType = options.messageType || soutenanceEmailMessageType
    const forceResend = options.forceResend === true || messageType === ACCESS_EMAIL_MESSAGE_TYPES.SCHEDULE_UPDATE
    const sendableTargets = testEmail
      ? selectedTargets.filter((target) => compactText(target?.link?.id) && canPrepareAccessEmail(target.person, target.link))
      : selectedTargets.filter(forceResend ? isSoutenanceEmailTargetRelanceable : isSoutenanceEmailTargetSmtpSendable)

    if (sendableTargets.length === 0) {
      setErrorMessage(testEmail
        ? 'Aucun lien défense disponible pour envoyer un test.'
        : 'Aucun destinataire sélectionné ne peut être transmis par SMTP.')
      return
    }

    setIsAutomaticEmailSending(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await workflowCoordinationService.sendSoutenanceAccessEmails(
        selectedYear,
        sendableTargets.map(buildSoutenanceEmailRequestTarget),
        {
          testEmail,
          messageType,
          forceResend,
          baseUrl: typeof window !== 'undefined' ? window.location.origin : null
        }
      )

      loadAccessAudit({ silent: true })
      if (!testEmail) {
        applySoutenanceEmailSendResults(sendableTargets, response, batchLabel, messageType)
        loadAccessLinksPreview({ silent: true })
      }

      const summary = response?.summary || {}
      if (testEmail) {
        const firstFailure = Array.isArray(response?.results)
          ? response.results.find((entry) => entry?.deliveryStatus === 'failed')
          : null

        if (response?.success === false || (summary.failedCount || 0) > 0) {
          setErrorMessage(firstFailure?.error || 'Email HTML de test non envoyé.')
          return
        }

        setSuccessMessage(`Email HTML de test envoyé à ${testEmail}.`)
      } else {
        setSuccessMessage(
          `${summary.sentCount || 0} email(s) HTML transmis pour ${batchLabel}. ${
            summary.skippedCount ? `${summary.skippedCount} déjà envoyé(s). ` : ''
          }${
            summary.failedCount ? `${summary.failedCount} échec(s).` : ''
          }`.trim()
        )
      }
    } catch (error) {
      setErrorMessage(
        error?.data?.error || error?.message || 'Erreur lors de l’envoi automatique des emails.'
      )
    } finally {
      setIsAutomaticEmailSending(false)
    }
  }, [
    applySoutenanceEmailSendResults,
    loadAccessAudit,
    loadAccessLinksPreview,
    selectedYear,
    soutenanceEmailMessageType
  ])

  const recordSoutenanceOutlookPreparedTargets = useCallback((items) => {
    const preparedItems = (Array.isArray(items) ? items : [])
      .filter((item) => item && !item.testEmail && item.target?.deliveryKey)

    if (preparedItems.length === 0) {
      return
    }

    const preparedAt = new Date().toISOString()
    const ledgerEntries = {}
    const preparedKeys = new Set()

    for (const item of preparedItems) {
      preparedKeys.add(item.target.deliveryKey)
      ledgerEntries[item.target.deliveryKey] = buildOutlookPreparedDeliveryEntry({
        target: item.target,
        preparedAt,
        recipientEmail: item.recipientEmail,
        messageType: item.messageType
      })
    }

    soutenanceOutlookPreparedKeysRef.current = new Set([
      ...soutenanceOutlookPreparedKeysRef.current,
      ...preparedKeys
    ])

    setEmailDeliveryLedger((current) => {
      const next = {
        ...(isPlainObject(current) ? current : {}),
        ...ledgerEntries
      }
      writeAccessEmailDeliveryLedger(selectedYear, next)
      return next
    })

    setSelectedSoutenanceEmailKeys((current) => {
      const next = { ...(isPlainObject(current) ? current : {}) }
      for (const key of preparedKeys) {
        delete next[key]
      }
      return next
    })
  }, [selectedYear])

  const handlePrepareSoutenanceEmailTargets = useCallback((targets, batchLabel, options = {}) => {
    const selectedTargets = Array.isArray(targets) ? targets.filter(Boolean) : []
    const testEmail = compactText(options.testEmail)
    const messageType = options.messageType || soutenanceEmailMessageType
    const forceResend = options.forceResend === true || messageType === ACCESS_EMAIL_MESSAGE_TYPES.SCHEDULE_UPDATE
    const queuedDeliveryKeys = new Set(
      soutenanceOutlookDraftQueueRef.current
        .map((item) => compactText(item?.target?.deliveryKey))
        .filter(Boolean)
    )

    if (!testEmail && queuedDeliveryKeys.size > 0) {
      setErrorMessage('Terminez ou annulez la file Outlook en cours avant de relancer un lot.')
      return
    }

    const preparedTargets = testEmail
      ? selectedTargets.filter((target) => canPrepareAccessEmail(target?.person, target?.link))
      : selectedTargets.filter((target) => {
        const deliveryKey = compactText(target?.deliveryKey)
        if (forceResend) {
          return isSoutenanceEmailTargetRelanceable(target) && !queuedDeliveryKeys.has(deliveryKey)
        }

        return (
          isSoutenanceEmailTargetOutlookSendable(target) &&
          !queuedDeliveryKeys.has(deliveryKey) &&
          !soutenanceOutlookPreparedKeysRef.current.has(deliveryKey)
        )
      })

    if (preparedTargets.length === 0) {
      setErrorMessage(testEmail
        ? 'Aucun lien défense disponible pour préparer un test Outlook.'
        : 'Aucun destinataire sélectionné ne peut être préparé dans Outlook.')
      return
    }

    const draftItems = preparedTargets.map((target, index) => {
      const draft = buildAccessEmailDraft({
        year: selectedYear,
        person: target.person,
        link: target.link,
        phase: target.phase,
        label: target.label,
        subtitle: target.subtitle,
        messageType
      })
      const recipientEmail = testEmail || compactText(target.person?.email)

      return {
        target,
        recipientEmail,
        batchLabel,
        batchTotal: preparedTargets.length,
        batchIndex: index,
        testEmail: Boolean(testEmail),
        messageType,
        mailtoUrl: buildMailtoUrl({
          ...draft,
          to: recipientEmail
        })
      }
    })

    const [firstDraft, ...queuedDrafts] = draftItems
    if (!firstDraft) {
      return
    }

    replaceSoutenanceOutlookDraftQueue(queuedDrafts)
    openMailtoDraft(firstDraft.mailtoUrl)
    recordSoutenanceOutlookPreparedTargets([firstDraft])

    setErrorMessage('')
    if (testEmail) {
      setSuccessMessage(queuedDrafts.length > 0
        ? `Premier brouillon Outlook de test préparé pour ${testEmail}. ${queuedDrafts.length} restant(s) à ouvrir.`
        : `Brouillon Outlook de test préparé pour ${testEmail}.`)
      return
    }

    setSuccessMessage(queuedDrafts.length > 0
      ? `1/${preparedTargets.length} brouillon(s) Outlook ouvert(s) pour ${batchLabel}. Cliquez sur “Ouvrir brouillon suivant” pour continuer.`
      : `${preparedTargets.length} brouillon(s) Outlook préparé(s) pour ${batchLabel}.`)
  }, [
    recordSoutenanceOutlookPreparedTargets,
    replaceSoutenanceOutlookDraftQueue,
    selectedYear,
    soutenanceEmailMessageType
  ])

  const handleOpenNextSoutenanceOutlookDraft = useCallback(() => {
    const [nextDraft, ...remainingDrafts] = soutenanceOutlookDraftQueueRef.current
    if (!nextDraft) {
      return
    }

    replaceSoutenanceOutlookDraftQueue(remainingDrafts)
    openMailtoDraft(nextDraft.mailtoUrl)
    recordSoutenanceOutlookPreparedTargets([nextDraft])
    setErrorMessage('')

    const openedCount = Math.max(1, Number(nextDraft.batchTotal || 0) - remainingDrafts.length)
    setSuccessMessage(remainingDrafts.length > 0
      ? `${openedCount}/${nextDraft.batchTotal} brouillon(s) Outlook ouvert(s) pour ${nextDraft.batchLabel}.`
      : `${nextDraft.batchTotal} brouillon(s) Outlook préparé(s) pour ${nextDraft.batchLabel}.`)
  }, [
    recordSoutenanceOutlookPreparedTargets,
    replaceSoutenanceOutlookDraftQueue
  ])

  const handleClearSoutenanceOutlookDraftQueue = useCallback(() => {
    replaceSoutenanceOutlookDraftQueue([])
    setErrorMessage('')
    setSuccessMessage('File Outlook annulée.')
  }, [replaceSoutenanceOutlookDraftQueue])

  const handleSendSelectedSoutenanceEmails = useCallback(() => {
    const options = {
      messageType: soutenanceEmailMessageType,
      forceResend: isSoutenanceScheduleUpdateMessage
    }

    if (soutenanceEmailDeliveryMode === ACCESS_EMAIL_DELIVERY_MODES.OUTLOOK) {
      handlePrepareSoutenanceEmailTargets(selectedSoutenanceEmailTargets, 'la sélection', options)
      return
    }

    handleSendSoutenanceEmailTargets(selectedSoutenanceEmailTargets, 'la sélection', options)
  }, [
    handlePrepareSoutenanceEmailTargets,
    handleSendSoutenanceEmailTargets,
    isSoutenanceScheduleUpdateMessage,
    selectedSoutenanceEmailTargets,
    soutenanceEmailDeliveryMode,
    soutenanceEmailMessageType
  ])

  const handleSendAllSoutenanceEmails = useCallback(() => {
    const options = {
      messageType: soutenanceEmailMessageType,
      forceResend: isSoutenanceScheduleUpdateMessage
    }
    const allTargets = isSoutenanceScheduleUpdateMessage
      ? soutenanceEmailAutomationGroups.all.targets
      : soutenanceEmailAutomationGroups.all.pendingTargets
    const outlookTargets = isSoutenanceScheduleUpdateMessage
      ? soutenanceEmailAutomationGroups.all.targets
      : soutenanceEmailAutomationGroups.all.outlookPendingTargets

    if (soutenanceEmailDeliveryMode === ACCESS_EMAIL_DELIVERY_MODES.OUTLOOK) {
      handlePrepareSoutenanceEmailTargets(
        outlookTargets,
        'tous les destinataires',
        options
      )
      return
    }

    handleSendSoutenanceEmailTargets(
      allTargets,
      'tous les destinataires',
      options
    )
  }, [
    handlePrepareSoutenanceEmailTargets,
    handleSendSoutenanceEmailTargets,
    isSoutenanceScheduleUpdateMessage,
    soutenanceEmailAutomationGroups.all.targets,
    soutenanceEmailAutomationGroups.all.outlookPendingTargets,
    soutenanceEmailAutomationGroups.all.pendingTargets,
    soutenanceEmailDeliveryMode,
    soutenanceEmailMessageType
  ])

  const handleSendProjectLeadSoutenanceEmails = useCallback(() => {
    const options = {
      messageType: soutenanceEmailMessageType,
      forceResend: isSoutenanceScheduleUpdateMessage
    }
    const projectLeadTargets = isSoutenanceScheduleUpdateMessage
      ? soutenanceEmailAutomationGroups.projectLeads.targets
      : soutenanceEmailAutomationGroups.projectLeads.pendingTargets
    const outlookProjectLeadTargets = isSoutenanceScheduleUpdateMessage
      ? soutenanceEmailAutomationGroups.projectLeads.targets
      : soutenanceEmailAutomationGroups.projectLeads.outlookPendingTargets

    if (soutenanceEmailDeliveryMode === ACCESS_EMAIL_DELIVERY_MODES.OUTLOOK) {
      handlePrepareSoutenanceEmailTargets(
        outlookProjectLeadTargets,
        'les chefs de projet',
        options
      )
      return
    }

    handleSendSoutenanceEmailTargets(
      projectLeadTargets,
      'les chefs de projet',
      options
    )
  }, [
    handlePrepareSoutenanceEmailTargets,
    handleSendSoutenanceEmailTargets,
    isSoutenanceScheduleUpdateMessage,
    soutenanceEmailAutomationGroups.projectLeads.targets,
    soutenanceEmailAutomationGroups.projectLeads.outlookPendingTargets,
    soutenanceEmailAutomationGroups.projectLeads.pendingTargets,
    soutenanceEmailDeliveryMode,
    soutenanceEmailMessageType
  ])

  const handleSendStandaloneExpertSoutenanceEmails = useCallback(() => {
    const options = {
      messageType: soutenanceEmailMessageType,
      forceResend: isSoutenanceScheduleUpdateMessage
    }
    const expertTargets = isSoutenanceScheduleUpdateMessage
      ? soutenanceEmailAutomationGroups.standaloneExperts.targets
      : soutenanceEmailAutomationGroups.standaloneExperts.pendingTargets
    const outlookExpertTargets = isSoutenanceScheduleUpdateMessage
      ? soutenanceEmailAutomationGroups.standaloneExperts.targets
      : soutenanceEmailAutomationGroups.standaloneExperts.outlookPendingTargets

    if (soutenanceEmailDeliveryMode === ACCESS_EMAIL_DELIVERY_MODES.OUTLOOK) {
      handlePrepareSoutenanceEmailTargets(
        outlookExpertTargets,
        'les experts',
        options
      )
      return
    }

    handleSendSoutenanceEmailTargets(
      expertTargets,
      'les experts',
      options
    )
  }, [
    handlePrepareSoutenanceEmailTargets,
    handleSendSoutenanceEmailTargets,
    isSoutenanceScheduleUpdateMessage,
    soutenanceEmailAutomationGroups.standaloneExperts.targets,
    soutenanceEmailAutomationGroups.standaloneExperts.outlookPendingTargets,
    soutenanceEmailAutomationGroups.standaloneExperts.pendingTargets,
    soutenanceEmailDeliveryMode,
    soutenanceEmailMessageType
  ])

  const handleSendSoutenanceEmailTest = useCallback(() => {
    const target = getDefaultSoutenanceEmailTarget()
    if (soutenanceEmailDeliveryMode === ACCESS_EMAIL_DELIVERY_MODES.OUTLOOK) {
      handlePrepareSoutenanceEmailTargets(target ? [target] : [], 'test', {
        testEmail: testEmailAddress,
        messageType: soutenanceEmailMessageType
      })
      return
    }

    handleSendSoutenanceEmailTargets(target ? [target] : [], 'test', {
      testEmail: testEmailAddress,
      messageType: soutenanceEmailMessageType
    })
  }, [
    getDefaultSoutenanceEmailTarget,
    handlePrepareSoutenanceEmailTargets,
    handleSendSoutenanceEmailTargets,
    soutenanceEmailDeliveryMode,
    soutenanceEmailMessageType,
    testEmailAddress
  ])

  const handleSendSingleSoutenanceEmail = useCallback((target) => {
    const targetName = target?.person?.name || target?.person?.email || 'ce destinataire'
    const batchLabel = targetName
    const options = {
      messageType: soutenanceEmailMessageType,
      forceResend: true
    }

    if (soutenanceEmailDeliveryMode === ACCESS_EMAIL_DELIVERY_MODES.OUTLOOK) {
      handlePrepareSoutenanceEmailTargets(target ? [target] : [], batchLabel, options)
      return
    }

    handleSendSoutenanceEmailTargets(target ? [target] : [], batchLabel, options)
  }, [
    handlePrepareSoutenanceEmailTargets,
    handleSendSoutenanceEmailTargets,
    soutenanceEmailDeliveryMode,
    soutenanceEmailMessageType
  ])

  const handleResetSoutenanceEmailDeliveries = useCallback(async () => {
    const resettableTargets = soutenanceEmailAutomationGroups.all.resettableTargets || []
    const linkIds = Array.from(new Set(
      resettableTargets
        .map((target) => compactText(target?.link?.id))
        .filter(Boolean)
    ))
    const resetKeys = new Set(resettableTargets.map((target) => target.deliveryKey).filter(Boolean))

    if (linkIds.length === 0 && resetKeys.size === 0) {
      return
    }

    setIsAutomaticEmailSending(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await workflowCoordinationService.resetAccessLinkEmailDeliveries(selectedYear, {
        type: 'soutenance',
        linkIds
      })
      const modifiedCount = Number(response?.modifiedCount ?? response?.matchedCount ?? linkIds.length)

      setEmailDeliveryLedger((current) => {
        const source = isPlainObject(current) ? current : {}
        const next = {}

        for (const [key, delivery] of Object.entries(source)) {
          if (!resetKeys.has(key)) {
            next[key] = delivery
          }
        }

        writeAccessEmailDeliveryLedger(selectedYear, next)
        return next
      })
      setSelectedSoutenanceEmailKeys((current) => {
        const source = isPlainObject(current) ? current : {}
        const next = {}

        for (const [key, isSelected] of Object.entries(source)) {
          if (!resetKeys.has(key)) {
            next[key] = isSelected
          }
        }

        return next
      })
      loadAccessLinksPreview({ silent: true })
      loadAccessAudit({ silent: true })
      setSuccessMessage(`${modifiedCount} envoi(s) défense réinitialisé(s).`)
    } catch (error) {
      setErrorMessage(
        error?.data?.error || error?.message || 'Erreur lors du reset des envois.'
      )
    } finally {
      setIsAutomaticEmailSending(false)
    }
  }, [loadAccessAudit, loadAccessLinksPreview, selectedYear, soutenanceEmailAutomationGroups.all.resettableTargets])

  const handleResetSoutenanceOutlookPrepared = useCallback(() => {
    const preparedKeys = new Set(
      (soutenanceEmailAutomationGroups.all.targets || [])
        .filter((target) => isLocalOutlookPreparedDelivery(target?.delivery))
        .map((target) => target.deliveryKey)
        .filter(Boolean)
    )

    if (preparedKeys.size === 0) {
      return
    }

    soutenanceOutlookPreparedKeysRef.current = new Set(
      [...soutenanceOutlookPreparedKeysRef.current].filter((deliveryKey) => !preparedKeys.has(deliveryKey))
    )

    setEmailDeliveryLedger((current) => {
      const source = isPlainObject(current) ? current : {}
      const next = {}

      for (const [key, delivery] of Object.entries(source)) {
        if (!preparedKeys.has(key)) {
          next[key] = delivery
        }
      }

      writeAccessEmailDeliveryLedger(selectedYear, next)
      return next
    })
    setSelectedSoutenanceEmailKeys((current) => {
      const source = isPlainObject(current) ? current : {}
      const next = {}

      for (const [key, isSelected] of Object.entries(source)) {
        if (!preparedKeys.has(key)) {
          next[key] = isSelected
        }
      }

      return next
    })
    setErrorMessage('')
    setSuccessMessage(`${preparedKeys.size} brouillon(s) Outlook défense réinitialisé(s).`)
  }, [selectedYear, soutenanceEmailAutomationGroups.all.targets])

  const outlookPreparedCount = useMemo(() => (
    Object.values(isPlainObject(emailDeliveryLedger) ? emailDeliveryLedger : {})
      .filter(isLocalOutlookPreparedDelivery)
      .length
  ), [emailDeliveryLedger])

  const handleResetOutlookPrepared = useCallback(() => {
    const currentLedger = isPlainObject(emailDeliveryLedger) ? emailDeliveryLedger : {}
    const nextLedger = {}
    let removedCount = 0

    for (const [key, delivery] of Object.entries(currentLedger)) {
      if (isLocalOutlookPreparedDelivery(delivery)) {
        removedCount += 1
      } else {
        nextLedger[key] = delivery
      }
    }

    if (removedCount === 0) {
      return
    }

    soutenanceOutlookPreparedKeysRef.current = new Set(
      Object.entries(nextLedger)
        .filter(([, delivery]) => isLocalOutlookPreparedDelivery(delivery))
        .map(([deliveryKey]) => deliveryKey)
    )

    writeAccessEmailDeliveryLedger(selectedYear, nextLedger)
    setEmailDeliveryLedger(nextLedger)
    setErrorMessage('')
    setSuccessMessage(`${removedCount} état(s) Outlook préparé réinitialisé(s).`)
  }, [emailDeliveryLedger, selectedYear])

  const previewSummary = previewPayload?.summary || null
  const previewContexts = previewPayload?.contexts || {}
  const phaseReadiness = previewSummary ? buildAccessPhaseReadiness(previewSummary, previewContexts) : []
  const summaryMetrics = previewSummary ? buildAccessSummaryMetrics(previewSummary) : []
  const workflowLabel = formatWorkflowPhases(
    previewPayload?.workflowPhases,
    previewPayload?.workflowState
  )
  const publicationVersion = previewContexts?.soutenance?.publicationVersion
  const hasKnownGeneratedLinks = Boolean(
    previewPayload?.hasGeneratedLinks ||
    previewPayload?.summary?.unavailableGeneratedLinkCount ||
    previewPayload?.summary?.expiredGeneratedLinkCount ||
    previewPayload?.summary?.revokedGeneratedLinkCount ||
    previewPayload?.summary?.exhaustedGeneratedLinkCount ||
    previewPayload?.summary?.unrecoverableGeneratedLinkCount
  )
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    !areAllLinkTypeFiltersActive
  )
  const missingSoutenanceLinkCount = previewSummary
    ? Math.max((previewSummary.soutenanceLinkCount || 0) - (previewSummary.soutenanceGeneratedLinkCount || 0), 0)
    : 0
  const canReconcileSoutenanceLinks = Boolean(
    previewSummary &&
    missingSoutenanceLinkCount > 0 &&
    previewContexts?.soutenance?.publicationVersion
  )
  const resetFilters = useCallback(() => {
    setSearchQuery('')
    setLinkTypeFilters(DEFAULT_ACCESS_PHASE_FILTERS)
  }, [])
  const generateLinksLabel = hasKnownGeneratedLinks ? 'Regénérer tous les accès' : 'Générer tous les accès'
  const generateLinksTitle = hasKnownGeneratedLinks
    ? "Remplacer tous les accès générables."
    : "Générer tous les accès générables."
  const isBusy = isPreviewLoading || isGenerating || isAutomaticEmailSending || isReconcilingSoutenanceLinks
  const previewStatusLabel = isGenerating
    ? 'Génération'
    : isPreviewLoading
      ? 'Lecture'
      : previewPayload
        ? previewPayload.linksGenerated
          ? 'Générés'
          : previewPayload.hasGeneratedLinks
            ? 'Partiels'
            : 'Chargés'
        : 'Non chargés'
  const previewStatusVariant = previewPayload?.linksGenerated
    ? 'ok'
    : previewPayload?.hasGeneratedLinks
      ? 'warning'
      : previewPayload
        ? 'neutral'
        : 'pending'
  const generatedLinkCount = previewSummary?.generatedLinkCount || 0
  const expectedLinkCount = (
    (previewSummary?.voteLinkCount || 0) +
    (previewSummary?.soutenanceLinkCount || 0) +
    (previewSummary?.arbitrageLinkCount || 0)
  )
  const generatedLinkProgress = previewSummary
    ? `${generatedLinkCount}/${expectedLinkCount} disponible${generatedLinkCount > 1 ? 's' : ''}`
    : 'Aucun compteur chargé'
  const publicationOverviewLabel = publicationVersion
    ? `v${publicationVersion}`
    : 'Absente'
  const defenseDestinationLabel = usePublicationSiteLinks
    ? publicationTargetLabel || 'Publication'
    : localTargetLabel
  const voteDestinationLabel = useVotePublicationSiteLinks
    ? votePublicationTargetLabel || 'Mini-site'
    : localTargetLabel
  const accessDestinationLabel = defenseDestinationLabel === voteDestinationLabel
    ? defenseDestinationLabel
    : `${defenseDestinationLabel} / ${voteDestinationLabel}`
  const overviewCards = [
    {
      id: 'workflow',
      label: 'Workflow',
      value: workflowLabel,
      detail: 'Phase active',
      icon: WorkflowIcon
    },
    {
      id: 'links',
      label: 'Liens',
      value: previewStatusLabel,
      detail: generatedLinkProgress,
      icon: KeyIcon,
      variant: previewStatusVariant
    },
    {
      id: 'publication',
      label: 'Publication',
      value: publicationOverviewLabel,
      detail: 'Publication active',
      icon: BriefcaseIcon,
      variant: publicationVersion ? 'soutenance' : 'pending'
    },
    {
      id: 'targets',
      label: 'Cibles',
      value: accessDestinationLabel,
      detail: 'Défenses / votes + arbitrage',
      icon: ArrowRightIcon,
      variant: usePublicationSiteLinks || useVotePublicationSiteLinks ? 'ok' : 'neutral'
    }
  ]
  const statusPanelDescription = previewSummary
    ? `${filteredPeople.length}/${previewSummary.peopleCount || 0} personne(s)`
    : 'Chargement en cours'
  const statusPanelCompactCount = previewSummary
    ? `${filteredPeople.length}/${previewSummary.peopleCount || 0}`
    : '...'
  const emailDeliverySummary = useMemo(() => buildAccessEmailSummary(
    filteredPeople,
    selectedYear,
    emailDeliveryLedger,
    linkTypeFilters
  ), [emailDeliveryLedger, filteredPeople, linkTypeFilters, selectedYear])
  const emailDeliveryProgressStyle = {
    '--token-access-email-progress': `${Math.round(emailDeliverySummary.ratio * 100)}%`
  }
  const emailAutomationTotalCount = soutenanceEmailAutomationGroups.all.totalCount || 0
  const emailAutomationPendingCount = soutenanceEmailAutomationGroups.all.pendingCount || 0
  const emailAutomationCompactCount = previewSummary
    ? `${emailAutomationPendingCount}/${emailAutomationTotalCount}`
    : '...'

  return (
    <div className='token-generator-page page-with-toolbar'>
      <PageToolbar
        id='tools'
        className='token-generator-tools'
        eyebrow='Accès'
        title='Liens d’accès'
        actions={
          <div className='token-access-toolbar-actions'>
            <button
              type='button'
              className='page-tools-action-btn primary'
              onClick={handleGenerateLinks}
              disabled={isBusy}
              title={isGenerating ? 'Génération des liens en cours.' : generateLinksTitle}
              aria-label={isGenerating ? 'Génération...' : generateLinksLabel}
            >
              <IconButtonContent
                label={isGenerating ? 'Génération...' : generateLinksLabel}
                icon={KeyIcon}
                showLabel
              />
            </button>
            {canReconcileSoutenanceLinks ? (
              <button
                type='button'
                className='page-tools-action-btn secondary'
                onClick={handleReconcileSoutenanceAccessLinks}
                disabled={isBusy}
                title='Créer uniquement les liens défense manquants pour la publication active.'
                aria-label={isReconcilingSoutenanceLinks ? 'Rattrapage défense...' : 'Rattraper liens défense'}
              >
                <IconButtonContent
                  label={isReconcilingSoutenanceLinks ? 'Rattrapage...' : 'Rattraper défenses'}
                  icon={RefreshIcon}
                  showLabel
                />
              </button>
            ) : null}
          </div>
        }
        toggleArrow={toggleArrow}
        isArrowUp={isArrowUp}
        ariaLabel='Outils des liens d accès'
        bodyClassName='token-access-toolbar-body'
      >
        <div className='token-access-tools-menu'>
          {isSummaryPanelCollapsed || (previewSummary && isEmailAutomationPanelCollapsed) || outlookPreparedCount > 0 ? (
            <div className='token-access-summary-floating-row'>
              {isSummaryPanelCollapsed ? (
                <button
                  type='button'
                  className='token-access-summary-floating token-access-summary-floating--toolbar'
                  aria-label='Ouvrir la synthèse des accès'
                  aria-expanded='false'
                  aria-controls='token-access-summary-panel'
                  onClick={() => setIsSummaryPanelCollapsed(false)}
                >
                  <KeyIcon aria-hidden='true' />
                  <span>Synthèse</span>
                  <strong>{statusPanelCompactCount}</strong>
                </button>
              ) : null}

              {previewSummary && isEmailAutomationPanelCollapsed ? (
                <button
                  type='button'
                  className='token-access-summary-floating token-access-summary-floating--toolbar token-access-email-menu'
                  aria-label='Ouvrir le module email HTML'
                  aria-expanded='false'
                  aria-controls='token-access-email-automation-panel'
                  onClick={() => setIsEmailAutomationPanelCollapsed(false)}
                >
                  <SendIcon aria-hidden='true' />
                  <span>Emails HTML</span>
                  <strong>{emailAutomationCompactCount}</strong>
                </button>
              ) : null}

              {outlookPreparedCount > 0 ? (
                <button
                  type='button'
                  className='token-access-summary-floating token-access-summary-floating--toolbar token-access-summary-reset'
                  aria-label={`Réinitialiser ${outlookPreparedCount} Outlook préparé`}
                  title={`Réinitialiser ${outlookPreparedCount} état(s) Outlook préparé.`}
                  onClick={handleResetOutlookPrepared}
                >
                  <RefreshIcon aria-hidden='true' />
                  <span>Reset Outlook</span>
                  <strong>{outlookPreparedCount}</strong>
                </button>
              ) : null}
            </div>
          ) : null}

          <section className='token-access-stats-panel' aria-label='État du module liens d’accès'>
            <div className='token-access-stats-panel-head'>
              <strong>État des accès</strong>
              <span>{generatedLinkProgress}</span>
            </div>
            <div className='token-access-overview-strip'>
              {overviewCards.map((item) => (
                <AccessOverviewCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          <div className='token-access-tools-primary'>
            <label className='token-access-search-control' htmlFor='access-search'>
              <span className='page-tools-field-label'>Recherche</span>
              <span className='token-access-search-input-shell'>
                <SearchIcon aria-hidden='true' />
                <input
                  id='access-search'
                  type='search'
                  className='page-tools-field-control'
                  placeholder='Nom, email, référence, candidat...'
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </span>
            </label>

            <div className='token-access-phase-control' role='group' aria-label='Filtrer par type de lien'>
              <div className='token-access-phase-segment'>
                {ACCESS_PHASE_FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type='button'
                    className={`token-access-phase-option${activeLinkTypeFilterSet.has(option.value) ? ' is-active' : ''}`.trim()}
                    aria-pressed={activeLinkTypeFilterSet.has(option.value)}
                    onClick={() => toggleLinkTypeFilter(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <label
              className={`token-access-checkbox-control${usePublicationSiteLinks ? ' is-active' : ''}${!canSelectPublicationSiteLinks ? ' is-disabled' : ''}`.trim()}
              title={canSelectPublicationSiteLinks ? `Défenses: ${usePublicationSiteLinks ? publicationTargetLabel || 'site public' : localTargetLabel}.` : 'Aucune URL publique de défense disponible.'}
            >
              <input
                type='checkbox'
                checked={usePublicationSiteLinks}
                disabled={!canSelectPublicationSiteLinks}
                aria-label='Utiliser le site pour les liens de défense'
                onChange={(event) => setUsePublicationSiteLinks(event.target.checked)}
              />
              <span className='token-access-checkbox-copy'>
                <strong>Défenses</strong>
                <small>{usePublicationSiteLinks ? 'Site' : 'Local'}</small>
              </span>
              <span className='token-access-checkbox-mark' aria-hidden='true' />
            </label>

            <label
              className={`token-access-checkbox-control${useVotePublicationSiteLinks ? ' is-active' : ''}${!canSelectVotePublicationSiteLinks ? ' is-disabled' : ''}`.trim()}
              title={canSelectVotePublicationSiteLinks ? `Votes: ${useVotePublicationSiteLinks ? votePublicationTargetLabel || 'mini-site' : localTargetLabel}.` : 'Aucune URL publique de vote disponible.'}
            >
              <input
                type='checkbox'
                checked={useVotePublicationSiteLinks}
                disabled={!canSelectVotePublicationSiteLinks}
                aria-label='Utiliser le site pour les liens de vote et d’arbitrage'
                onChange={(event) => setUseVotePublicationSiteLinks(event.target.checked)}
              />
              <span className='token-access-checkbox-copy'>
                <strong>Votes + arbitrage</strong>
                <small>{useVotePublicationSiteLinks ? 'Site' : 'Local'}</small>
              </span>
              <span className='token-access-checkbox-mark' aria-hidden='true' />
            </label>

            <label className={`token-access-checkbox-control${showCandidateBlocks ? ' is-active' : ''}`.trim()}>
              <input
                type='checkbox'
                checked={showCandidateBlocks}
                aria-label='Afficher les candidats dans les liens et les emails'
                onChange={(event) => setShowCandidateBlocks(event.target.checked)}
              />
              <span className='token-access-checkbox-copy'>
                <strong>{CANDIDATE_ROLE_LABEL}s</strong>
                <small>Liens + emails</small>
              </span>
              <span className='token-access-checkbox-mark' aria-hidden='true' />
            </label>
          </div>
        </div>

      </PageToolbar>

      <section className='token-generator-results'>
        <div className='token-generator-results-shell'>
          {errorMessage ? (
            <AccessNotice tone='danger' role='alert'>
              {errorMessage}
            </AccessNotice>
          ) : null}

          {successMessage ? (
            <AccessNotice tone='success'>
              {successMessage}
            </AccessNotice>
          ) : null}

          {useVotePublicationSiteLinks ? (
            <AccessNotice tone='warning'>
              {STATIC_VOTE_REGENERATION_NOTICE}
            </AccessNotice>
          ) : null}

          {canReconcileSoutenanceLinks ? (
            <AccessNotice
              tone='warning'
              action={(
                <button
                  type='button'
                  className='token-access-btn secondary'
                  onClick={handleReconcileSoutenanceAccessLinks}
                  disabled={isBusy}
                >
                  <IconButtonContent
                    label={isReconcilingSoutenanceLinks ? 'Rattrapage...' : 'Créer les liens manquants'}
                    icon={RefreshIcon}
                    showLabel
                  />
                </button>
              )}
            >
              Publication défense v{previewContexts.soutenance.publicationVersion}: {missingSoutenanceLinkCount} lien(s) personnel(s) manquant(s) pour les emails HTML.
            </AccessNotice>
          ) : null}

          {previewSummary?.unrecoverableGeneratedLinkCount > 0 ? (
            <AccessNotice tone='danger'>
              {previewSummary.unrecoverableGeneratedLinkCount} lien(s) généré(s) avant la persistance ne peuvent pas être reconstruits. Régénérez une fois pour les rendre relisibles.
            </AccessNotice>
          ) : null}

          <div className={`token-access-results-layout${previewSummary ? '' : ' is-empty'}${isSummaryPanelCollapsed ? ' has-collapsed-summary' : ''}`.trim()}>
            <aside className={`token-access-status-rail${isSummaryPanelCollapsed ? ' is-hidden' : ''}`.trim()} aria-label='Synthèse des accès'>
              {!isSummaryPanelCollapsed ? (
                <section id='token-access-summary-panel' className='token-access-status-panel token-access-status-overview'>
                    <div className='token-access-panel-head'>
                      <span className='token-access-panel-icon' aria-hidden='true'>
                        <KeyIcon />
                      </span>
                      <div className='token-access-panel-title'>
                        <h2>Synthèse</h2>
                        <p>{statusPanelDescription}</p>
                      </div>
                      <button
                        type='button'
                        className='token-access-icon-btn secondary token-access-summary-toggle'
                        aria-label='Réduire la synthèse des accès'
                        aria-expanded='true'
                        aria-controls='token-access-summary-panel'
                        onClick={() => setIsSummaryPanelCollapsed(true)}
                      >
                        <IconButtonContent label='Réduire la synthèse des accès' icon={ChevronRightIcon} />
                      </button>
                    </div>

                    {previewSummary ? (
                      <>
                        <div className='token-access-summary-list' aria-label='Compteurs des accès'>
                          {summaryMetrics.map((metric) => (
                            <AccessMetricRow key={metric.id} metric={metric} />
                          ))}
                        </div>

                        <div className='token-access-status-section'>
                          <h3>Phases</h3>
                          <div className='token-access-phase-list' aria-label='État des accès par phase'>
                            {phaseReadiness.map((phase) => (
                              <AccessPhaseRow key={phase.id} phase={phase} />
                            ))}
                          </div>
                        </div>

                        <div className='token-access-status-section'>
                          <AccessPublicationDiagnostic
                            context={previewContexts.soutenance}
                            summary={previewSummary}
                          />
                        </div>

                        <div className={`token-access-email-console is-${emailDeliverySummary.variant}`.trim()}>
                          <div className='token-access-email-console-head'>
                            <span className='token-access-email-console-icon' aria-hidden='true'>
                              <SendIcon />
                            </span>
                            <div>
                              <h3>Console email</h3>
                              <p>{emailDeliverySummary.progressLabel}</p>
                            </div>
                          </div>
                          <div
                            className='token-access-email-progress'
                            style={emailDeliveryProgressStyle}
                            aria-hidden='true'
                          >
                            <span />
                          </div>
                          <div className='token-access-email-console-metrics'>
                            <span>
                              <strong>{emailDeliverySummary.pendingCount}</strong>
                              à envoyer
                            </span>
                            <span>
                              <strong>{emailDeliverySummary.blockedCount}</strong>
                              bloqué{emailDeliverySummary.blockedCount > 1 ? 's' : ''}
                            </span>
                          </div>
                          {emailDeliverySummary.lastSentAt || emailDeliverySummary.lastPreparedAt ? (
                            <small>
                              Dernier: {formatDateTime(emailDeliverySummary.lastSentAt || emailDeliverySummary.lastPreparedAt)}
                            </small>
                          ) : null}
                        </div>

                        <AccessAuditPanel
                          events={accessAuditEvents}
                          isLoading={isAccessAuditLoading}
                          error={accessAuditError}
                          onRefresh={() => loadAccessAudit()}
                        />

                        <AccessUsagePanel
                          logs={accessUsageLogs}
                          isLoading={isAccessUsageLoading}
                          error={accessUsageError}
                          onRefresh={() => loadAccessUsageLogs()}
                        />
                      </>
                    ) : (
                      <div className='token-access-status-placeholder'>
                        <ClipboardIcon aria-hidden='true' />
                        <span>Les compteurs s’affichent dès que les liens sont chargés.</span>
                      </div>
                    )}
                </section>
              ) : null}
            </aside>

            <main className='token-access-main-panel'>
              {previewSummary && !isEmailAutomationPanelCollapsed ? (
                <SoutenanceEmailAutomationPanel
                  targets={soutenanceEmailAutomationTargets}
                  summary={previewSummary}
                  selectedKeys={selectedSoutenanceEmailKeys}
                  selectedCount={selectedSoutenanceEmailTargets.length}
                  pendingCount={soutenanceEmailAutomationGroups.all.pendingCount}
                  resettableCount={soutenanceEmailAutomationGroups.all.resettableCount}
                  sentCount={soutenanceEmailAutomationGroups.all.sentCount}
                  preparedCount={soutenanceEmailAutomationGroups.all.preparedCount}
                  deliveryMode={soutenanceEmailDeliveryMode}
                  messageType={soutenanceEmailMessageType}
                  projectLeadGroup={soutenanceEmailAutomationGroups.projectLeads}
                  expertGroup={soutenanceEmailAutomationGroups.standaloneExperts}
                  preview={soutenanceEmailPreview}
                  testEmailAddress={testEmailAddress}
                  isPreviewLoading={isEmailPreviewLoading}
                  isSending={isAutomaticEmailSending}
                  outlookQueueCount={soutenanceOutlookDraftQueue.length}
                  onPreview={handlePreviewSoutenanceEmailTemplate}
                  onSendTest={handleSendSoutenanceEmailTest}
                  onSendAll={handleSendAllSoutenanceEmails}
                  onSendSelection={handleSendSelectedSoutenanceEmails}
                  onSendProjectLeads={handleSendProjectLeadSoutenanceEmails}
                  onSendExperts={handleSendStandaloneExpertSoutenanceEmails}
                  onResetDeliveries={handleResetSoutenanceEmailDeliveries}
                  onResetOutlookPrepared={handleResetSoutenanceOutlookPrepared}
                  onDeliveryModeChange={setSoutenanceEmailDeliveryMode}
                  onMessageTypeChange={setSoutenanceEmailMessageType}
                  onTestEmailChange={setTestEmailAddress}
                  onToggleTarget={handleToggleSoutenanceEmailSelection}
                  onSelectPending={handleSelectPendingSoutenanceEmails}
                  onClearSelection={handleClearSoutenanceEmailSelection}
                  onSendTarget={handleSendSingleSoutenanceEmail}
                  onOpenNextOutlookDraft={handleOpenNextSoutenanceOutlookDraft}
                  onClearOutlookQueue={handleClearSoutenanceOutlookDraftQueue}
                  canReconcileMissingLinks={canReconcileSoutenanceLinks}
                  isReconcilingMissingLinks={isReconcilingSoutenanceLinks}
                  onReconcileMissingLinks={handleReconcileSoutenanceAccessLinks}
                  onCollapse={() => setIsEmailAutomationPanelCollapsed(true)}
                />
              ) : null}

              {!previewSummary ? (
                <div className='token-generator-empty-state'>
                  <h3>{isPreviewLoading ? 'Chargement des liens' : 'Aucun lien chargé'}</h3>
                  <p>
                    {isPreviewLoading
                      ? 'Lecture des liens déjà générés.'
                      : 'Les accès se chargent automatiquement. Vous pouvez générer les liens disponibles si nécessaire.'}
                  </p>
                </div>
              ) : filteredPeople.length === 0 ? (
                <div className='token-generator-empty-state'>
                  <h3>Aucun résultat</h3>
                  <p>
                    {hasActiveFilters
                      ? `Aucun résultat pour le filtre actuel${searchQuery ? ` (recherche : ${searchQuery})` : ''}.`
                      : 'Aucun lien disponible pour cette vue.'}
                  </p>
                  {hasActiveFilters ? (
                    <button
                      type='button'
                      className='token-access-btn token-access-filter-reset'
                      onClick={resetFilters}
                    >
                      Réinitialiser les filtres
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className='token-access-person-list'>
                  {filteredPeople.map((entry) => (
                    <PersonCard
                      key={entry?.person?.id || entry?.person?.email}
                      entry={entry}
                      selectedYear={selectedYear}
                      selectedPhaseFilters={linkTypeFilters}
                      emailDeliveryLedger={emailDeliveryLedger}
                      onPrepareEmail={handlePrepareEmail}
                      onCopy={handleCopy}
                      onOpen={handleOpen}
                    />
                  ))}
                </div>
              )}
            </main>
          </div>
        </div>
      </section>
    </div>
  )
}

export default TokenGenerator
