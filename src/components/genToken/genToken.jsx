import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import PageToolbar from '../shared/PageToolbar'
import { YEARS_CONFIG } from '../../config/appConfig'
import {
  planningConfigService,
  planningCatalogService,
  workflowPlanningService
} from '../../services/planningService'

import '../../css/genToken/genToken.css'

const LINK_TYPE_FILTERS = [
  { value: 'all', label: 'Tous les liens' },
  { value: 'vote', label: 'Votes' },
  { value: 'soutenance', label: 'Défenses' },
  { value: 'arbitrage', label: 'Arbitrage' }
]

const LINK_TYPE_FILTER_VALUES = new Set(LINK_TYPE_FILTERS.map((filter) => filter.value))
const DEFAULT_EMAIL_SETTINGS = {
  senderName: 'TPI Organizer',
  senderEmail: '',
  senderArbitrageName: '',
  senderArbitrageEmail: '',
  replyToEmail: '',
  defaultDeliveryMode: 'outlook'
}
const DEFAULT_PUBLICATION_SETTINGS = {
  publicBaseUrl: 'https://tpi26.ch'
}
const DEFAULT_ACCESS_LINK_SETTINGS = {
  defaultVoteLinkTarget: 'app',
  defaultSoutenanceLinkTarget: 'app'
}

function formatRoleLabel(role) {
  if (role === 'expert1') {
    return 'Expert 1'
  }

  if (role === 'expert2') {
    return 'Expert 2'
  }

  if (role === 'chef_projet') {
    return 'Chef de projet'
  }

  if (role === 'expert') {
    return 'Expert'
  }

  if (role === 'candidat') {
    return 'Candidat'
  }

  return String(role || '').trim()
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

function isPastDate(value) {
  if (!value) {
    return false
  }

  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date <= new Date()
}

function normalizeEmailSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {}
  const defaultDeliveryMode = String(source.defaultDeliveryMode || DEFAULT_EMAIL_SETTINGS.defaultDeliveryMode).trim()

  return {
    senderName: String(source.senderName || DEFAULT_EMAIL_SETTINGS.senderName).trim() || DEFAULT_EMAIL_SETTINGS.senderName,
    senderEmail: String(source.senderEmail || '').trim().toLowerCase(),
    senderArbitrageName: String(source.senderArbitrageName || '').trim(),
    senderArbitrageEmail: String(source.senderArbitrageEmail || '').trim().toLowerCase(),
    replyToEmail: String(source.replyToEmail || '').trim().toLowerCase(),
    defaultDeliveryMode: defaultDeliveryMode === 'automatic' ? 'automatic' : 'outlook'
  }
}

function normalizePublicBaseUrl(value, fallback = DEFAULT_PUBLICATION_SETTINGS.publicBaseUrl) {
  const rawValue = String(value || '').trim()
  const rawFallback = String(fallback || DEFAULT_PUBLICATION_SETTINGS.publicBaseUrl).trim()
  const candidate = rawValue || rawFallback

  if (!candidate) {
    return ''
  }

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`

  try {
    const url = new URL(withProtocol)
    url.hash = ''
    url.search = ''
    return url.toString().replace(/\/+$/, '')
  } catch (error) {
    return rawFallback
  }
}

function normalizePublicationSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {}

  return {
    publicBaseUrl: normalizePublicBaseUrl(
      source.publicBaseUrl || source.staticPublicBaseUrl || source.publicSiteBaseUrl || source.domain
    )
  }
}

function normalizeVoteLinkTarget(value, fallback = DEFAULT_ACCESS_LINK_SETTINGS.defaultVoteLinkTarget) {
  const normalized = String(value || fallback || '').trim().toLowerCase()
  return normalized === 'static' || normalized === 'publication' ? 'static' : 'app'
}

function normalizeSoutenanceLinkTarget(value, fallback = DEFAULT_ACCESS_LINK_SETTINGS.defaultSoutenanceLinkTarget) {
  return String(value || fallback || '').trim().toLowerCase() === 'publication' ? 'publication' : 'app'
}

function normalizeAccessLinkSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {}

  return {
    defaultVoteLinkTarget: normalizeVoteLinkTarget(
      source.defaultVoteLinkTarget ?? source.voteLinkTarget ?? source.voteTarget
    ),
    defaultSoutenanceLinkTarget: normalizeSoutenanceLinkTarget(
      source.defaultSoutenanceLinkTarget ?? source.soutenanceLinkTarget ?? source.publicationLinkTarget
    )
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

function getPublicationVersionRequest(value) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function formatPublicationVersionLabel(versionEntry) {
  if (!versionEntry?.version) {
    return 'Publication active'
  }

  const generatedLabel = formatPublicationLinkCountLabel(versionEntry)

  return `Publication v${versionEntry.version}${versionEntry.isActive ? ' · active' : ''}${generatedLabel}`
}

function getPublicationRecoverableLinkCount(versionEntry) {
  const recoverableCount = Number.parseInt(String(versionEntry?.recoverableGeneratedLinkCount || ''), 10)
  return Number.isInteger(recoverableCount) && recoverableCount > 0 ? recoverableCount : 0
}

function formatPublicationLinkCountLabel(versionEntry) {
  const recoverableCount = getPublicationRecoverableLinkCount(versionEntry)
  if (recoverableCount > 0) {
    return ` · ${recoverableCount} lien${recoverableCount > 1 ? 's' : ''}`
  }

  return ''
}

function formatActivePublicationOptionLabel(availableVersions = [], context = {}) {
  const activeVersion = availableVersions.find((entry) => entry?.isActive)
  const version = activeVersion?.version || context?.publicationVersion

  if (!version) {
    return 'Publication active'
  }

  return `Publication active (v${version})${formatPublicationLinkCountLabel(activeVersion)}`
}

function buildPublicationVersionOptions(context = {}) {
  const availableVersions = Array.isArray(context?.availableVersions)
    ? context.availableVersions
    : []
  const options = availableVersions
    .filter((entry) =>
      Number.isInteger(Number(entry?.version)) &&
      Number(entry.version) > 0 &&
      entry.isActive !== true &&
      getPublicationRecoverableLinkCount(entry) > 0
    )
    .map((entry) => ({
      value: String(entry.version),
      label: formatPublicationVersionLabel(entry),
      isActive: entry.isActive === true
    }))

  if (options.length > 0) {
    return [
      { value: 'active', label: formatActivePublicationOptionLabel(availableVersions, context) },
      ...options
    ]
  }

  if (context?.publicationVersion) {
    return [
      { value: 'active', label: 'Publication active' },
      { value: String(context.publicationVersion), label: `Publication v${context.publicationVersion}` }
    ]
  }

  return [{ value: 'active', label: 'Publication active' }]
}

function getInvitationLinkVersion(link) {
  const parsed = Number.parseInt(String(link?.publicationVersion || ''), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function compactDraftText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function getInvitationLinkType(link) {
  const type = compactDraftText(link?.type).toLowerCase()
  if (type === 'vote' || type === 'soutenance' || type === 'arbitrage') {
    return type
  }

  return getInvitationLinkVersion(link) ? 'soutenance' : 'vote'
}

function formatDraftTypeLabel(type) {
  if (type === 'vote') {
    return 'Vote'
  }

  if (type === 'arbitrage') {
    return 'Arbitrage'
  }

  return 'Défense'
}

function getDraftSenderName(emailSettings, type = 'soutenance') {
  if (type === 'arbitrage') {
    return (
      emailSettings.senderArbitrageName ||
      emailSettings.senderName ||
      DEFAULT_EMAIL_SETTINGS.senderName
    )
  }

  return emailSettings.senderName || DEFAULT_EMAIL_SETTINGS.senderName
}

function getDraftContactEmail(emailSettings, type = 'soutenance') {
  if (type === 'arbitrage') {
    return emailSettings.replyToEmail || emailSettings.senderArbitrageEmail || emailSettings.senderEmail
  }

  return emailSettings.replyToEmail || emailSettings.senderEmail
}

function getDraftExpiryLine(link, prefix = 'Validité') {
  return link?.expiresAt ? `${prefix} : ${formatDateTime(link.expiresAt)}` : null
}

function getLinkEmailAvailabilityStatus(link) {
  const explicitStatus = compactDraftText(link?.availabilityStatus).toLowerCase()
  if (explicitStatus) {
    return explicitStatus
  }

  if (!link?.url) {
    return 'missing'
  }

  if (link?.revokedAt) {
    return 'revoked'
  }

  if (isPastDate(link?.expiresAt)) {
    return 'expired'
  }

  const maxUses = Number.parseInt(String(link?.maxUses || 0), 10)
  const usageCount = Number.parseInt(String(link?.usageCount || 0), 10)
  if (Number.isInteger(maxUses) && maxUses > 0 && Number.isInteger(usageCount) && usageCount >= maxUses) {
    return 'exhausted'
  }

  return 'available'
}

function canPrepareEmailForLink(link) {
  return Boolean(link?.url) && getLinkEmailAvailabilityStatus(link) === 'available'
}

function buildVoteInvitationSubject(year, link) {
  const label = formatVoteLinkLabel(link)
  return `Votes de défense TPI ${year}${label ? ` - ${label}` : ''}`
}

function buildVoteInvitationBody({ person, link, year, emailSettings }) {
  const recipientName = person?.name || ''
  const tpis = getVoteLinkTpiEntries(link)
  const tpiLines = tpis.map((tpi) => {
    const details = [
      tpi.candidateName,
      tpi.roleLabel,
      tpi.subject
    ].filter(Boolean).join(' · ')

    return `- ${tpi.reference || 'TPI'}${details ? ` : ${details}` : ''}`
  })
  const contactEmail = getDraftContactEmail(emailSettings, 'vote')
  const senderName = getDraftSenderName(emailSettings, 'vote')

  return [
    `Bonjour${recipientName ? ` ${recipientName}` : ''},`,
    '',
    `Votre réponse est attendue pour les votes de défense TPI ${year}.`,
    tpiLines.length > 0 ? tpiLines.join('\n') : null,
    '',
    'Vous pouvez répondre avec votre lien personnel :',
    link.url,
    '',
    'Ce lien est personnel et ne doit pas être transmis.',
    getDraftExpiryLine(link),
    contactEmail ? `Pour toute question : ${contactEmail}` : null,
    '',
    'Meilleures salutations',
    senderName
  ].filter((line) => line !== null).join('\n')
}

function buildSoutenanceInvitationSubject(year, publicationVersion) {
  return `Horaire des défenses TPI ${year}${publicationVersion ? ` - v${publicationVersion}` : ''}`
}

function buildSoutenanceInvitationBody({ person, link, year, emailSettings }) {
  const recipientName = person?.name || ''
  const publicationVersion = getInvitationLinkVersion(link)
  const contactEmail = getDraftContactEmail(emailSettings, 'soutenance')
  const senderName = getDraftSenderName(emailSettings, 'soutenance')

  return [
    `Bonjour${recipientName ? ` ${recipientName}` : ''},`,
    '',
    `L'horaire des défenses TPI ${year} est disponible.`,
    '',
    'Vous pouvez le consulter avec votre lien personnel :',
    link.url,
    '',
    'Ce lien est personnel et ne doit pas être transmis.',
    publicationVersion ? `Version publiée : v${publicationVersion}` : null,
    getDraftExpiryLine(link),
    contactEmail ? `Pour toute question : ${contactEmail}` : null,
    '',
    'Meilleures salutations',
    senderName
  ].filter((line) => line !== null).join('\n')
}

function buildArbitrageInvitationSubject(year, link) {
  return `Proposition d'arbitrage TPI ${year}${link?.reference ? ` - ${link.reference}` : ''}`
}

function buildArbitrageInvitationBody({ person, link, year, emailSettings }) {
  const recipientName = person?.name || ''
  const contactEmail = getDraftContactEmail(emailSettings, 'arbitrage')
  const senderName = getDraftSenderName(emailSettings, 'arbitrage')
  const responseStatus = compactDraftText(link?.responseStatus)

  return [
    `Bonjour${recipientName ? ` ${recipientName}` : ''},`,
    '',
    `Une proposition d'arbitrage TPI ${year} est à confirmer.`,
    link?.reference ? `Référence : ${link.reference}` : null,
    link?.candidateName ? `Candidat : ${link.candidateName}` : null,
    link?.subject ? `Sujet : ${link.subject}` : null,
    link?.proposedSlotLabel ? `Créneau proposé : ${link.proposedSlotLabel}` : null,
    link?.message ? `Message : ${link.message}` : null,
    responseStatus && responseStatus !== 'pending'
      ? `Réponse actuelle : ${formatArbitrageResponseStatus(responseStatus)}`
      : null,
    '',
    'Vous pouvez répondre avec votre lien personnel :',
    link.url,
    '',
    'Ce lien est personnel et ne doit pas être transmis.',
    getDraftExpiryLine(link, 'Réponse souhaitée avant'),
    contactEmail ? `Pour toute question : ${contactEmail}` : null,
    '',
    'Meilleures salutations',
    senderName
  ].filter((line) => line !== null).join('\n')
}

function buildInvitationSubject({ link, year, type }) {
  if (type === 'vote') {
    return buildVoteInvitationSubject(year, link)
  }

  if (type === 'arbitrage') {
    return buildArbitrageInvitationSubject(year, link)
  }

  return buildSoutenanceInvitationSubject(year, getInvitationLinkVersion(link))
}

function buildInvitationBody({ person, link, year, emailSettings, type }) {
  if (type === 'vote') {
    return buildVoteInvitationBody({ person, link, year, emailSettings })
  }

  if (type === 'arbitrage') {
    return buildArbitrageInvitationBody({ person, link, year, emailSettings })
  }

  return buildSoutenanceInvitationBody({ person, link, year, emailSettings })
}

function buildMailtoUrl({ to, subject, body }) {
  const params = new URLSearchParams({
    subject,
    body
  })

  return `mailto:${encodeURIComponent(to)}?${params.toString()}`
}

function buildInvitationDraft({ entry, link, year, emailSettings }) {
  const person = entry?.person || {}
  const to = String(person.email || '').trim()
  const publicationVersion = getInvitationLinkVersion(link)
  const type = getInvitationLinkType(link)
  const subject = buildInvitationSubject({ link, year, type })
  const body = buildInvitationBody({
    person,
    link,
    year,
    emailSettings,
    type
  })

  return {
    key: `${person.id || to}-${type}-${publicationVersion || link.proposalId || link.reference || 'link'}-${link.url}`,
    type,
    to,
    name: person.name || to,
    publicationVersion,
    subject,
    body,
    mailto: buildMailtoUrl({ to, subject, body })
  }
}

function shouldIncludeInvitationLink(link, options = {}) {
  if (!canPrepareEmailForLink(link)) {
    return false
  }

  const type = getInvitationLinkType(link)
  if (options.linkTypeFilter && options.linkTypeFilter !== 'all' && type !== options.linkTypeFilter) {
    return false
  }

  if (type === 'soutenance' && options.selectedPublicationVersion) {
    const selectedPublicationVersion = getPublicationVersionRequest(options.selectedPublicationVersion)
    const linkPublicationVersion = getInvitationLinkVersion(link)
    if (selectedPublicationVersion && linkPublicationVersion !== selectedPublicationVersion) {
      return false
    }
  }

  return true
}

function getEntryInvitationLinks(entry) {
  return [
    ...(Array.isArray(entry?.voteLinks) ? entry.voteLinks : []),
    ...(Array.isArray(entry?.soutenanceLinks) ? entry.soutenanceLinks : []),
    ...(Array.isArray(entry?.arbitrageLinks) ? entry.arbitrageLinks : [])
  ]
}

function buildInvitationDrafts(people, options = {}) {
  const year = options.year
  const emailSettings = normalizeEmailSettings(options.emailSettings)
  const drafts = []

  for (const entry of Array.isArray(people) ? people : []) {
    for (const link of getEntryInvitationLinks(entry)) {
      if (!shouldIncludeInvitationLink(link, options)) {
        continue
      }

      const draft = buildInvitationDraft({
        entry,
        link,
        year,
        emailSettings
      })

      if (draft.to) {
        drafts.push(draft)
      }
    }
  }

  return drafts
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
    return `${tpis.length} TPI à traiter`
  }

  if (tpis.length === 1) {
    return tpis[0]?.reference || link?.reference || 'Vote'
  }

  return link?.reference || 'Vote'
}

function formatVoteLinkSubtitle(link) {
  const tpis = getVoteLinkTpiEntries(link)

  if (tpis.length > 1) {
    return tpis.map((tpi) => tpi.reference).filter(Boolean).join(', ')
  }

  const candidateName = tpis[0]?.candidateName || link?.candidateName
  return candidateName ? `Candidat: ${candidateName}` : ''
}

function buildVoteLinkDetails(link) {
  return getVoteLinkTpiEntries(link).map((tpi) => ({
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
    link?.candidateName ? `Candidat: ${link.candidateName}` : '',
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

const LinkRow = ({
  label,
  subtitle,
  badges = [],
  details = [],
  url,
  expiresAt,
  revokedAt,
  generated = false,
  recoverable = true,
  availabilityStatus = '',
  onCopy,
  onOpen,
  onEmail = null,
  canEmail = true
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
  const canPrepareEmail = hasUrl && canEmail !== false
  const emailUnavailableTitle = hasUrl
    ? `Ré-envoi indisponible: ${statusLabel.toLowerCase()}.`
    : unavailableTitle
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
    <article className='token-access-link-row'>
      <div className='token-access-link-copy'>
        <div className='token-access-link-head'>
          <strong>{label}</strong>
          <div className='token-access-link-meta'>
            {subtitle ? <span>{subtitle}</span> : null}
            <span className={`token-access-badge is-${statusVariant}`.trim()}>{statusLabel}</span>
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
      </div>

      <div className='token-access-link-actions'>
        <button
          type='button'
          className={`token-access-btn secondary${isCopied ? ' is-success' : ''}`}
          onClick={hasUrl ? handleCopyAction : undefined}
          disabled={!hasUrl}
          title={hasUrl ? `Copier le lien : ${url}` : unavailableTitle}
          aria-label={`Copier le lien ${label}`}
        >
          {isCopied ? 'Copié ✓' : 'Copier'}
        </button>
        <button
          type='button'
          className='token-access-btn primary'
          onClick={hasUrl ? onOpen : undefined}
          disabled={!hasUrl}
          title={hasUrl ? `Ouvrir le lien : ${url}` : unavailableTitle}
          aria-label={`Ouvrir le lien ${label}`}
        >
          Ouvrir
        </button>
        {onEmail ? (
          <button
            type='button'
            className='token-access-btn secondary'
            onClick={canPrepareEmail ? onEmail : undefined}
            disabled={!canPrepareEmail}
            title={canPrepareEmail ? 'Préparer un email Outlook pour ce lien.' : emailUnavailableTitle}
            aria-label={`Préparer un email ${label}`}
          >
            Email
          </button>
        ) : null}
      </div>
    </article>
  )
}

const PersonCard = ({ entry, onCopy, onOpen, onEmailLink }) => {
  const roleLabels = Array.isArray(entry?.person?.roles)
    ? entry.person.roles.map((role) => formatRoleLabel(role))
    : []
  const voteLinks = Array.isArray(entry?.voteLinks) ? entry.voteLinks : []
  const soutenanceLinks = Array.isArray(entry?.soutenanceLinks) ? entry.soutenanceLinks : []
  const arbitrageLinks = Array.isArray(entry?.arbitrageLinks) ? entry.arbitrageLinks : []
  const voteTpiCount = voteLinks.reduce((total, link) => total + getVoteLinkTpiCount(link), 0)

  return (
    <article className='token-access-person-card'>
      <header className='token-access-person-head'>
        <div className='token-access-person-identity'>
          <strong>{entry?.person?.name || 'Personne sans nom'}</strong>
          <span>{entry?.person?.email || 'Email manquant'}</span>
        </div>

        <div className='token-access-person-meta'>
          <span className='token-access-count-chip'>
            {voteTpiCount} TPI à voter
          </span>
          <span className='token-access-count-chip'>
            {soutenanceLinks.length} défense{soutenanceLinks.length > 1 ? 's' : ''}
          </span>
          <span className='token-access-count-chip'>
            {arbitrageLinks.length} arbitrage{arbitrageLinks.length > 1 ? 's' : ''}
          </span>
        </div>
      </header>

      <div className='token-access-badges'>
        {roleLabels.map((roleLabel) => (
          <span key={roleLabel} className='token-access-badge'>
            {roleLabel}
          </span>
        ))}

        {entry?.person?.site ? (
          <span className='token-access-badge is-neutral'>{entry.person.site}</span>
        ) : null}
      </div>

      <section className='token-access-link-group'>
        <div className='token-access-section-head'>
          <h3>Liens de vote</h3>
          <span>{voteTpiCount} TPI</span>
        </div>

        {voteLinks.length > 0 ? (
          <div className='token-access-link-list'>
            {voteLinks.map((link, index) => (
              <LinkRow
                key={link.url || `${entry?.person?.id}-vote-${link.reference || index}`}
                label={formatVoteLinkLabel(link)}
                subtitle={formatVoteLinkSubtitle(link)}
                badges={[
                  { label: link.roleLabel || formatRoleLabel(link.role), variant: 'vote' },
                  link.redirectPath ? { label: link.redirectPath, variant: 'neutral' } : null
                ].filter(Boolean)}
                details={buildVoteLinkDetails(link)}
                url={link.url}
                expiresAt={link.expiresAt}
                revokedAt={link.revokedAt}
                generated={link.generated === true}
                recoverable={link.recoverable !== false}
                availabilityStatus={link.availabilityStatus}
                onCopy={() => onCopy(link.url)}
                onOpen={() => onOpen(link.url)}
                onEmail={() => onEmailLink(entry, link)}
                canEmail={canPrepareEmailForLink(link)}
              />
            ))}
          </div>
        ) : (
          <p className='token-access-empty-inline'>
            Aucun lien de vote actif pour cette personne.
          </p>
        )}
      </section>

      <section className='token-access-link-group'>
        <div className='token-access-section-head'>
          <h3>Liens d’arbitrage</h3>
          <span>{arbitrageLinks.length}</span>
        </div>

        {arbitrageLinks.length > 0 ? (
          <div className='token-access-link-list'>
            {arbitrageLinks.map((link, index) => (
              <LinkRow
                key={link.url || `${entry?.person?.id}-arbitrage-${link.proposalId || index}`}
                label={formatArbitrageLinkLabel(link)}
                subtitle={formatArbitrageLinkSubtitle(link)}
                badges={[
                  { label: 'Arbitrage', variant: 'arbitrage' },
                  link.roleLabel ? { label: link.roleLabel, variant: 'neutral' } : null,
                  { label: formatArbitrageProposalStatus(link.status), variant: 'neutral' },
                  { label: formatArbitrageResponseStatus(link.responseStatus), variant: link.responseStatus === 'accepted' ? 'ok' : link.responseStatus === 'rejected' ? 'warning' : 'neutral' },
                  link.devMode ? { label: 'DEV', variant: 'neutral' } : null
                ].filter(Boolean)}
                details={buildArbitrageLinkDetails(link)}
                url={link.url}
                expiresAt={link.expiresAt}
                generated={link.generated === true}
                recoverable={link.recoverable !== false}
                availabilityStatus={link.availabilityStatus}
                onCopy={() => onCopy(link.url)}
                onOpen={() => onOpen(link.url)}
                onEmail={() => onEmailLink(entry, link)}
                canEmail={canPrepareEmailForLink(link)}
              />
            ))}
          </div>
        ) : (
          <p className='token-access-empty-inline'>
            Aucun lien d’arbitrage généré pour cette personne.
          </p>
        )}
      </section>

      <section className='token-access-link-group'>
        <div className='token-access-section-head'>
          <h3>Liens de consultation des défenses</h3>
          <span>{soutenanceLinks.length}</span>
        </div>

        {soutenanceLinks.length > 0 ? (
          <div className='token-access-link-list'>
            {soutenanceLinks.map((link) => (
              <LinkRow
                key={`${entry?.person?.id}-publication-${link.publicationVersion || 0}`}
                label={`Publication ${link.publicationVersion || 'active'}`}
                subtitle='Vue filtrée sur les défenses publiées'
                badges={[
                  { label: 'Défense', variant: 'soutenance' },
                  link.redirectPath ? { label: link.redirectPath, variant: 'neutral' } : null
                ].filter(Boolean)}
                url={link.url}
                expiresAt={link.expiresAt}
                revokedAt={link.revokedAt}
                generated={link.generated === true}
                recoverable={link.recoverable !== false}
                availabilityStatus={link.availabilityStatus}
                onCopy={() => onCopy(link.url)}
                onOpen={() => onOpen(link.url)}
                onEmail={() => onEmailLink(entry, link)}
                canEmail={canPrepareEmailForLink(link)}
              />
            ))}
          </div>
        ) : (
          <p className='token-access-empty-inline'>
            Aucun lien de défense disponible pour cette personne.
          </p>
        )}
      </section>
    </article>
  )
}

const TokenGenerator = ({ toggleArrow, isArrowUp }) => {
  const location = useLocation()
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const requestedYear = Number.parseInt(queryParams.get('year') || '', 10)
  const requestedLinkType = queryParams.get('type')
  const accessLinkRequestIdRef = useRef(0)
  const skipNextAccessLinkPreviewRef = useRef(null)
  const [selectedYear, setSelectedYear] = useState(() => (
    YEARS_CONFIG.isSupportedYear(requestedYear)
      ? requestedYear
      : YEARS_CONFIG.getCurrentYear()
  ))
  const [searchQuery, setSearchQuery] = useState('')
  const [linkTypeFilter, setLinkTypeFilter] = useState(() => (
    LINK_TYPE_FILTER_VALUES.has(requestedLinkType)
      ? requestedLinkType
      : 'all'
  ))
  const [previewPayload, setPreviewPayload] = useState(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [selectedPublicationVersion, setSelectedPublicationVersion] = useState('active')
  const [emailSettings, setEmailSettings] = useState(DEFAULT_EMAIL_SETTINGS)
  const [publicationSettings, setPublicationSettings] = useState(DEFAULT_PUBLICATION_SETTINGS)
  const [accessLinkSettings, setAccessLinkSettings] = useState(DEFAULT_ACCESS_LINK_SETTINGS)
  const [staticPublicationInfo, setStaticPublicationInfo] = useState(null)
  const [staticVotePublicationInfo, setStaticVotePublicationInfo] = useState(null)
  const [usePublicationSiteLinks, setUsePublicationSiteLinks] = useState(false)
  const [useVotePublicationSiteLinks, setUseVotePublicationSiteLinks] = useState(false)
  const [prepareWithOutlook, setPrepareWithOutlook] = useState(true)
  const [invitationDrafts, setInvitationDrafts] = useState([])

  const availableYears = useMemo(
    () => YEARS_CONFIG.getAvailableYears().slice().reverse(),
    []
  )

  useEffect(() => {
    let isCancelled = false

    const loadCatalogSettings = async () => {
      try {
        const catalog = await planningCatalogService.getGlobal()
        if (isCancelled) {
          return
        }

        const normalizedSettings = normalizeEmailSettings(catalog?.emailSettings)
        setEmailSettings(normalizedSettings)
        setPublicationSettings(normalizePublicationSettings(catalog?.publicationSettings))
        setPrepareWithOutlook(normalizedSettings.defaultDeliveryMode !== 'automatic')
      } catch (error) {
        if (!isCancelled) {
          setEmailSettings(DEFAULT_EMAIL_SETTINGS)
          setPublicationSettings(DEFAULT_PUBLICATION_SETTINGS)
          setPrepareWithOutlook(true)
        }
      }
    }

    loadCatalogSettings()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    const loadYearLinkDefaults = async () => {
      const [statusResult, voteStatusResult, configResult] = await Promise.allSettled([
        workflowPlanningService.getStaticPublicationStatus(selectedYear),
        workflowPlanningService.getStaticVotePublicationStatus(selectedYear),
        planningConfigService.getByYear(selectedYear)
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
      setUsePublicationSiteLinks(
        normalizedLinkSettings.defaultSoutenanceLinkTarget === 'publication' &&
        Boolean(typeof status?.publicUrl === 'string' && status.publicUrl.trim())
      )
      setUseVotePublicationSiteLinks(
        normalizedLinkSettings.defaultVoteLinkTarget === 'static' &&
        Boolean(typeof voteStatus?.publicUrl === 'string' && voteStatus.publicUrl.trim())
      )
    }

    loadYearLinkDefaults()

    return () => {
      isCancelled = true
    }
  }, [selectedYear])

  useEffect(() => {
    if (YEARS_CONFIG.isSupportedYear(requestedYear)) {
      setSelectedYear(requestedYear)
    }
  }, [requestedYear])

  useEffect(() => {
    if (LINK_TYPE_FILTER_VALUES.has(requestedLinkType)) {
      setLinkTypeFilter(requestedLinkType)
    }
  }, [requestedLinkType])

  useEffect(() => {
    setInvitationDrafts([])
  }, [selectedPublicationVersion])

  useEffect(() => {
    setSelectedPublicationVersion('active')
    setInvitationDrafts([])
  }, [selectedYear])

  const filteredPeople = useMemo(() => {
    const people = Array.isArray(previewPayload?.people) ? previewPayload.people : []
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return people.filter((entry) => {
      const hasVoteLinks = Array.isArray(entry?.voteLinks) && entry.voteLinks.length > 0
      const hasSoutenanceLinks = Array.isArray(entry?.soutenanceLinks) && entry.soutenanceLinks.length > 0
      const hasArbitrageLinks = Array.isArray(entry?.arbitrageLinks) && entry.arbitrageLinks.length > 0

      if (linkTypeFilter === 'vote' && !hasVoteLinks) {
        return false
      }

      if (linkTypeFilter === 'soutenance' && !hasSoutenanceLinks) {
        return false
      }

      if (linkTypeFilter === 'arbitrage' && !hasArbitrageLinks) {
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
  }, [linkTypeFilter, previewPayload?.people, searchQuery])

  const staticPublicationPublicUrl = typeof staticPublicationInfo?.publicUrl === 'string'
    ? staticPublicationInfo.publicUrl.trim()
    : ''
  const staticVotePublicationPublicUrl = typeof staticVotePublicationInfo?.publicUrl === 'string'
    ? staticVotePublicationInfo.publicUrl.trim()
    : ''
  const configuredPublicationBaseUrl = normalizePublicationSettings(publicationSettings).publicBaseUrl
  const publicationTargetLabel = formatUrlHost(staticPublicationPublicUrl || configuredPublicationBaseUrl)
  const votePublicationTargetLabel = formatUrlHost(staticVotePublicationPublicUrl)
  const canUsePublicationSiteLinks = Boolean(staticPublicationPublicUrl)
  const canUseVotePublicationSiteLinks = Boolean(staticVotePublicationPublicUrl)
  const accessLinkTargetOptions = useMemo(() => ({
    ...(usePublicationSiteLinks && canUsePublicationSiteLinks
      ? {
          soutenanceLinkTarget: 'publication',
          soutenancePublicUrl: staticPublicationPublicUrl
        }
      : {}),
    ...(useVotePublicationSiteLinks && canUseVotePublicationSiteLinks
      ? {
          voteLinkTarget: 'static',
          votePublicUrl: staticVotePublicationPublicUrl
        }
      : {})
  }), [
    canUsePublicationSiteLinks,
    canUseVotePublicationSiteLinks,
    staticPublicationPublicUrl,
    staticVotePublicationPublicUrl,
    usePublicationSiteLinks,
    useVotePublicationSiteLinks
  ])

  useEffect(() => {
    if (usePublicationSiteLinks && !canUsePublicationSiteLinks) {
      setUsePublicationSiteLinks(false)
    }
  }, [canUsePublicationSiteLinks, usePublicationSiteLinks])

  useEffect(() => {
    if (useVotePublicationSiteLinks && !canUseVotePublicationSiteLinks) {
      setUseVotePublicationSiteLinks(false)
    }
  }, [canUseVotePublicationSiteLinks, useVotePublicationSiteLinks])

  const loadAccessLinksPreview = useCallback(async ({ silent = false, publicationVersionValue = selectedPublicationVersion } = {}) => {
    const requestId = ++accessLinkRequestIdRef.current
    setIsPreviewLoading(true)
    setErrorMessage('')
    if (!silent) {
      setSuccessMessage('')
    }
    setInvitationDrafts([])

    try {
      const publicationVersion = getPublicationVersionRequest(publicationVersionValue)
      const preview = await workflowPlanningService.previewAccessLinks(
        selectedYear,
        window.location.origin,
        {
          ...(publicationVersion ? { publicationVersion } : {}),
          ...accessLinkTargetOptions
        }
      )

      if (requestId !== accessLinkRequestIdRef.current) {
        return
      }

      setPreviewPayload(preview)
      if (!silent) {
        setSuccessMessage(
          `Aperçu préparé: ${preview?.summary?.peopleCount || 0} personne(s), ${preview?.summary?.voteLinkCount || 0} lien(s) vote, ${preview?.summary?.soutenanceLinkCount || 0} lien(s) défense, ${preview?.summary?.arbitrageLinkCount || 0} lien(s) arbitrage, ${preview?.summary?.generatedLinkCount || 0} accès disponible(s).`
        )
      }
    } catch (error) {
      if (requestId !== accessLinkRequestIdRef.current) {
        return
      }

      setPreviewPayload(null)
      setErrorMessage(
        error?.data?.error || error?.message || 'Impossible de préparer l’aperçu des liens d’accès.'
      )
    } finally {
      setIsPreviewLoading(false)
    }
  }, [selectedPublicationVersion, selectedYear, accessLinkTargetOptions])

  const handleGeneratePreview = useCallback(async () => {
    await loadAccessLinksPreview({ silent: false })
  }, [loadAccessLinksPreview])

  const handleGenerateLinks = useCallback(async () => {
    const requestId = ++accessLinkRequestIdRef.current
    setIsGenerating(true)
    setErrorMessage('')
    setSuccessMessage('')
    setInvitationDrafts([])

    try {
      const publicationVersion = getPublicationVersionRequest(selectedPublicationVersion)
      const result = await workflowPlanningService.generateAccessLinks(
        selectedYear,
        window.location.origin,
        {
          ...(publicationVersion ? { publicationVersion } : {}),
          ...accessLinkTargetOptions
        }
      )

      if (requestId !== accessLinkRequestIdRef.current) {
        return
      }

      setPreviewPayload(result)
      setSuccessMessage(
        `${result?.summary?.peopleCount || 0} personne(s) préparée(s), ${result?.summary?.voteLinkCount || 0} lien(s) vote, ${result?.summary?.soutenanceLinkCount || 0} lien(s) défense généré(s), ${result?.summary?.arbitrageLinkCount || 0} lien(s) arbitrage affiché(s).`
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
  }, [selectedPublicationVersion, selectedYear, accessLinkTargetOptions])

  useEffect(() => {
    if (skipNextAccessLinkPreviewRef.current === selectedPublicationVersion) {
      skipNextAccessLinkPreviewRef.current = null
      return
    }

    loadAccessLinksPreview({ silent: true })
  }, [loadAccessLinksPreview, selectedPublicationVersion])

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

  const openOutlookDraft = (draft) => {
    if (!draft?.mailto) {
      return
    }

    window.location.href = draft.mailto
  }

  const handlePrepareOutlookInvitations = () => {
    if (!prepareWithOutlook) {
      setErrorMessage("L'envoi automatique n'est pas activé pour le moment. Cochez Outlook pour préparer les messages.")
      setSuccessMessage('')
      return
    }

    if (emailPreparationBlockedByPublication) {
      setErrorMessage("La publication sélectionnée ne correspond pas aux liens affichés. Préparez l'aperçu ou régénérez les liens pour cette publication.")
      setSuccessMessage('')
      return
    }

    const drafts = availableInvitationDrafts

    if (drafts.length === 0) {
      setInvitationDrafts([])
      setErrorMessage("Aucun lien disponible avec email ne correspond au filtre actuel.")
      setSuccessMessage('')
      return
    }

    setInvitationDrafts(drafts)
    setErrorMessage('')
    setSuccessMessage(
      `${drafts.length} email${drafts.length > 1 ? 's' : ''} Outlook préparé${drafts.length > 1 ? 's' : ''}. Le premier brouillon va s'ouvrir.`
    )
    openOutlookDraft(drafts[0])
  }

  const handlePrepareSingleOutlookLinkEmail = (entry, link) => {
    if (!prepareWithOutlook) {
      setErrorMessage("L'envoi automatique n'est pas activé pour le moment. Cochez Outlook pour préparer les messages.")
      setSuccessMessage('')
      return
    }

    if (!link?.url) {
      setErrorMessage("Ce lien n'est pas disponible. Régénérez-le avant de préparer l'email.")
      setSuccessMessage('')
      return
    }

    if (!canPrepareEmailForLink(link)) {
      setErrorMessage("Ce lien n'est plus réutilisable. Régénérez-le avant de préparer l'email.")
      setSuccessMessage('')
      return
    }

    if (getInvitationLinkType(link) === 'soutenance' && !isPublicationSelectionSynced) {
      setErrorMessage("La publication sélectionnée ne correspond pas aux liens affichés. Préparez l'aperçu ou régénérez les liens pour cette publication.")
      setSuccessMessage('')
      return
    }

    const draft = buildInvitationDraft({
      entry,
      link,
      year: selectedYear,
      emailSettings
    })

    if (!draft.to) {
      setErrorMessage("Impossible de préparer l'email: destinataire manquant.")
      setSuccessMessage('')
      return
    }

    setInvitationDrafts([draft])
    setErrorMessage('')
    setSuccessMessage(`Email Outlook préparé pour ${draft.name}.`)
    openOutlookDraft(draft)
  }

  const previewSummary = previewPayload?.summary || null
  const previewContexts = previewPayload?.contexts || {}
  const workflowLabel = formatWorkflowLabel(previewPayload?.workflowState)
  const publicationVersion = previewContexts?.soutenance?.publicationVersion
  const availablePublicationVersions = Array.isArray(previewContexts?.soutenance?.availableVersions)
    ? previewContexts.soutenance.availableVersions
    : []
  const publicationVersionOptions = buildPublicationVersionOptions(previewContexts?.soutenance)
  const selectedPublicationVersionValue = publicationVersionOptions.some((option) => option.value === selectedPublicationVersion)
    ? selectedPublicationVersion
    : 'active'
  const selectedPublicationRequest = getPublicationVersionRequest(selectedPublicationVersionValue)
  const currentPublicationVersion = getPublicationVersionRequest(previewContexts?.soutenance?.publicationVersion)
  const currentRequestedPublicationVersion = getPublicationVersionRequest(previewContexts?.soutenance?.requestedPublicationVersion)
  const activePublicationVersion = getPublicationVersionRequest(
    publicationVersionOptions.find((option) => option.isActive)?.value
  )
  const isPublicationSelectionSynced = !previewPayload
    ? true
    : selectedPublicationRequest
      ? currentPublicationVersion === selectedPublicationRequest
      : currentRequestedPublicationVersion === null ||
        (activePublicationVersion !== null && currentPublicationVersion === activePublicationVersion)
  const hasGeneratedSoutenanceLinks = Boolean(previewPayload?.summary?.soutenanceGeneratedLinkCount)
  const hasKnownGeneratedLinks = Boolean(
    previewPayload?.hasGeneratedLinks ||
    previewPayload?.summary?.unavailableGeneratedLinkCount ||
    previewPayload?.summary?.expiredGeneratedLinkCount ||
    previewPayload?.summary?.revokedGeneratedLinkCount ||
    previewPayload?.summary?.exhaustedGeneratedLinkCount ||
    previewPayload?.summary?.unrecoverableGeneratedLinkCount
  )
  const suggestedPublicationWithLinks = availablePublicationVersions.find((entry) => {
    const version = getPublicationVersionRequest(entry?.version)
    return (
      version &&
      version !== currentPublicationVersion &&
      getPublicationRecoverableLinkCount(entry) > 0
    )
  })
  const shouldSuggestPublicationWithLinks = Boolean(
    previewPayload &&
    !hasGeneratedSoutenanceLinks &&
    suggestedPublicationWithLinks
  )
  const suggestedPublicationLinkCount = getPublicationRecoverableLinkCount(suggestedPublicationWithLinks)
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    linkTypeFilter !== 'all' ||
    selectedPublicationVersionValue !== 'active'
  )
  const publicationFilterLabel = publicationVersionOptions.find((option) => (
    option.value === selectedPublicationVersionValue
  ))?.label
  const linkTypeFilterLabel = LINK_TYPE_FILTERS.find((option) => option.value === linkTypeFilter)?.label || 'Tous les liens'
  const resetFilters = useCallback(() => {
    setSearchQuery('')
    setLinkTypeFilter('all')
    setSelectedPublicationVersion('active')
  }, [])
  const availableInvitationDrafts = useMemo(() => buildInvitationDrafts(filteredPeople, {
    year: selectedYear,
    selectedPublicationVersion: selectedPublicationVersionValue,
    emailSettings,
    linkTypeFilter
  }), [emailSettings, filteredPeople, linkTypeFilter, selectedPublicationVersionValue, selectedYear])
  const hasAvailableInvitationDrafts = availableInvitationDrafts.length > 0
  const emailPreparationBlockedByPublication = !isPublicationSelectionSynced &&
    availableInvitationDrafts.some((draft) => draft.type === 'soutenance')
  const prepareEmailsTitle = emailPreparationBlockedByPublication
    ? "Préparez ou générez les liens pour la publication sélectionnée."
    : !hasAvailableInvitationDrafts
      ? "Aucun lien disponible avec email ne correspond au filtre actuel."
      : prepareWithOutlook
        ? 'Préparer les emails Outlook pour les liens filtrés.'
        : "L'envoi automatique est désactivé pour le moment."
  const generateLinksLabel = hasKnownGeneratedLinks ? 'Regénérer les liens' : 'Générer les liens'
  const generateLinksTitle = hasKnownGeneratedLinks
    ? 'Remplacer les liens d’accès admin déjà générés.'
    : 'Générer les liens d’accès.'
  const isBusy = isPreviewLoading || isGenerating
  const publicationDefaultHint = accessLinkSettings.defaultSoutenanceLinkTarget === 'publication'
    ? ' Cible par défaut configurée.'
    : ''
  const votePublicationDefaultHint = accessLinkSettings.defaultVoteLinkTarget === 'static'
    ? ' Cible par défaut configurée.'
    : ''
  const publicationSiteLinksTitle = canUsePublicationSiteLinks
    ? `Générer les liens de défense vers ${staticPublicationPublicUrl}.${publicationDefaultHint}`
    : `URL publique de publication indisponible. Vérifiez la configuration et la génération statique.${publicationDefaultHint}`
  const votePublicationSiteLinksTitle = canUseVotePublicationSiteLinks
    ? `Générer les liens de vote vers ${staticVotePublicationPublicUrl}.${votePublicationDefaultHint}`
    : `URL publique de vote statique indisponible. Générez la publication vote avant de cibler le mini-site.${votePublicationDefaultHint}`
  const handleShowSuggestedPublication = async () => {
    if (!suggestedPublicationWithLinks?.version) {
      return
    }

    const versionValue = String(suggestedPublicationWithLinks.version)
    skipNextAccessLinkPreviewRef.current = versionValue
    setSelectedPublicationVersion(versionValue)
    setErrorMessage('')
    setSuccessMessage('')
    await loadAccessLinksPreview({
      silent: false,
      publicationVersionValue: versionValue
    })
  }

  return (
    <div className='token-generator-page page-with-toolbar'>
      <PageToolbar
        id='tools'
        className='token-generator-tools'
        eyebrow='Accès'
        title='Liens d’accès'
        description='Aperçu puis génération des magic links.'
        meta={
          <div className='token-access-toolbar-meta'>
            <span className='page-tools-chip'>{workflowLabel}</span>
            <span className='page-tools-chip'>
              Publication {publicationVersion ? `v${publicationVersion}` : 'absente'}
            </span>
            {previewPayload ? (
              <span className='page-tools-chip'>
                {previewPayload.linksGenerated
                  ? 'Liens générés'
                  : previewPayload.hasGeneratedLinks
                    ? 'Liens partiels'
                    : 'Aperçu seul'}
              </span>
            ) : null}
            <span className='page-tools-chip'>
              {usePublicationSiteLinks ? `Site publication · ${publicationTargetLabel || 'non défini'}` : 'Site application'}
            </span>
            {useVotePublicationSiteLinks ? (
              <span className='page-tools-chip'>
                Vote statique · {votePublicationTargetLabel || 'non défini'}
              </span>
            ) : null}
          </div>
        }
        toggleArrow={toggleArrow}
        isArrowUp={isArrowUp}
        ariaLabel='Outils des liens d accès'
      >
        <div className='page-tools-grid token-access-toolbar-grid'>
          <label className='page-tools-field' htmlFor='year'>
            <span className='page-tools-field-label'>Année</span>
            <select
              id='year'
              className='page-tools-field-control'
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number.parseInt(event.target.value, 10))}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className='page-tools-field' htmlFor='access-search'>
            <span className='page-tools-field-label'>Recherche</span>
            <input
              id='access-search'
              type='search'
              className='page-tools-field-control'
              placeholder='Nom, email, référence, candidat...'
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>

          <label className='page-tools-field' htmlFor='link-type-filter'>
            <span className='page-tools-field-label'>Type</span>
            <select
              id='link-type-filter'
              className='page-tools-field-control'
              value={linkTypeFilter}
              onChange={(event) => setLinkTypeFilter(event.target.value)}
            >
              {LINK_TYPE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className='page-tools-field' htmlFor='publication-version-filter'>
            <span className='page-tools-field-label'>Publication</span>
            <select
              id='publication-version-filter'
              className='page-tools-field-control'
              value={selectedPublicationVersionValue}
              onChange={(event) => setSelectedPublicationVersion(event.target.value)}
              disabled={isBusy}
            >
              {publicationVersionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className='page-tools-field token-access-publication-checkbox' htmlFor='use-publication-site-links'>
            <span className='page-tools-field-label'>Site</span>
            <span className='token-access-checkbox-row' title={publicationSiteLinksTitle}>
              <input
                id='use-publication-site-links'
                type='checkbox'
                checked={usePublicationSiteLinks}
                onChange={(event) => setUsePublicationSiteLinks(event.target.checked)}
                disabled={isBusy || !canUsePublicationSiteLinks}
              />
              <span>Publication</span>
            </span>
          </label>

          <label className='page-tools-field token-access-publication-checkbox' htmlFor='use-vote-publication-site-links'>
            <span className='page-tools-field-label'>Votes</span>
            <span className='token-access-checkbox-row' title={votePublicationSiteLinksTitle}>
              <input
                id='use-vote-publication-site-links'
                type='checkbox'
                checked={useVotePublicationSiteLinks}
                onChange={(event) => setUseVotePublicationSiteLinks(event.target.checked)}
                disabled={isBusy || !canUseVotePublicationSiteLinks}
              />
              <span>Mini-site</span>
            </span>
          </label>

          <div className='page-tools-field page-tools-field-action'>
            <button
              type='button'
              className='page-tools-action-btn secondary'
              onClick={handleGeneratePreview}
              disabled={isBusy}
              title={isPreviewLoading ? 'Préparation de l’aperçu en cours.' : 'Préparer l’aperçu des liens d’accès.'}
              aria-label={isPreviewLoading ? 'Préparation de l’aperçu en cours.' : 'Préparer l’aperçu des liens d’accès.'}
            >
              {isPreviewLoading ? 'Préparation...' : 'Préparer l’aperçu'}
            </button>
          </div>

          <div className='page-tools-field page-tools-field-action'>
            <button
              type='button'
              className='page-tools-action-btn primary'
              onClick={handleGenerateLinks}
              disabled={isBusy}
              title={isGenerating ? 'Génération des liens en cours.' : generateLinksTitle}
              aria-label={isGenerating ? 'Génération des liens en cours.' : generateLinksTitle}
            >
              {isGenerating ? 'Génération...' : generateLinksLabel}
            </button>
          </div>

          <label className='page-tools-field token-access-mail-checkbox' htmlFor='prepare-with-outlook'>
            <span className='page-tools-field-label'>Email</span>
            <span className='token-access-checkbox-row'>
              <input
                id='prepare-with-outlook'
                type='checkbox'
                checked={prepareWithOutlook}
                onChange={(event) => setPrepareWithOutlook(event.target.checked)}
              />
              <span>Outlook manuel</span>
            </span>
          </label>

          <div className='page-tools-field page-tools-field-action'>
            <button
              type='button'
              className='page-tools-action-btn secondary'
              onClick={handlePrepareOutlookInvitations}
              disabled={
                isBusy ||
                !hasAvailableInvitationDrafts ||
                !prepareWithOutlook ||
                emailPreparationBlockedByPublication
              }
              title={prepareEmailsTitle}
              aria-label='Préparer emails Outlook'
            >
              Préparer emails
            </button>
          </div>
        </div>

        <div className='token-access-toolbar-note'>
          L’aperçu recharge les liens déjà générés quand ils sont encore valides, et signale les liens expirés ou révoqués. La génération remplace les liens admin du site choisi. Les liens d’arbitrage sont visibles ici uniquement après création dans le module planning vote. L’envoi automatique reste désactivé: le mode Outlook prépare des brouillons de ré-envoi pour les liens vote, défense et arbitrage.
        </div>
        {hasActiveFilters ? (
          <div className='token-access-active-filters'>
            <span>Filtres actifs :</span>
            {searchQuery ? <span className='token-access-filter-chip'>Recherche : «{searchQuery}»</span> : null}
            {linkTypeFilter !== 'all' ? <span className='token-access-filter-chip'>{linkTypeFilterLabel}</span> : null}
            {selectedPublicationVersionValue !== 'active' ? (
              <span className='token-access-filter-chip'>
                {publicationFilterLabel || `Publication ${selectedPublicationVersionValue}`}
              </span>
            ) : null}
            <button
              type='button'
              className='token-access-filter-reset'
              onClick={resetFilters}
              title='Effacer la recherche et les filtres'
            >
              Réinitialiser
            </button>
          </div>
        ) : null}
      </PageToolbar>

      <section className='token-generator-results'>
        <div className='token-generator-results-shell'>
          {errorMessage ? (
            <div className='token-generator-alert' role='alert'>
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className='token-generator-success' role='status'>
              {successMessage}
            </div>
          ) : null}

          {previewSummary?.unrecoverableGeneratedLinkCount > 0 ? (
            <div className='token-generator-alert' role='status'>
              {previewSummary.unrecoverableGeneratedLinkCount} lien(s) généré(s) avant la persistance ne peuvent pas être reconstruits. Régénérez une fois pour les rendre relisibles.
            </div>
          ) : null}

          {shouldSuggestPublicationWithLinks ? (
            <div className='token-generator-alert token-generator-alert-action' role='status'>
              <span>
                La publication affichée v{publicationVersion || 'active'} n’a pas de lien disponible.
                {' '}
                Des liens existent pour la publication v{suggestedPublicationWithLinks.version}
                {' '}
                ({suggestedPublicationLinkCount} lien{suggestedPublicationLinkCount > 1 ? 's' : ''}).
              </span>
              <button
                type='button'
                className='token-access-btn secondary'
                onClick={handleShowSuggestedPublication}
                disabled={isBusy}
              >
                Afficher v{suggestedPublicationWithLinks.version}
              </button>
            </div>
          ) : null}

          {previewSummary ? (
            <div className='token-access-summary-grid'>
              <article className='token-access-summary-card'>
                <span>Personnes</span>
                <strong>{previewSummary.peopleCount || 0}</strong>
              </article>

              <article className='token-access-summary-card'>
                <span>Liens vote</span>
                <strong>{previewSummary.voteLinkCount || 0}</strong>
              </article>

              <article className='token-access-summary-card'>
                <span>Liens défense</span>
                <strong>{previewSummary.soutenanceLinkCount || 0}</strong>
              </article>

              <article className='token-access-summary-card'>
                <span>Liens arbitrage</span>
                <strong>{previewSummary.arbitrageLinkCount || 0}</strong>
              </article>

              <article className='token-access-summary-card'>
                <span>Accès disponibles</span>
                <strong>{previewSummary.generatedLinkCount || 0}</strong>
              </article>

              <article className='token-access-summary-card'>
                <span>Indisponibles</span>
                <strong>{previewSummary.unavailableGeneratedLinkCount || 0}</strong>
              </article>

              <article className='token-access-summary-card'>
                <span>Votes en attente</span>
                <strong>{previewContexts?.vote?.tpiCount || 0} TPI</strong>
              </article>
            </div>
          ) : null}

          {invitationDrafts.length > 0 ? (
            <section className='token-access-draft-panel' aria-label='Emails Outlook préparés'>
              <div className='token-access-draft-head'>
                <div>
                  <h3>Emails Outlook</h3>
                  <p>
                    Ouvrez les brouillons un par un, puis vérifiez et envoyez depuis Outlook.
                  </p>
                </div>
                <span>{invitationDrafts.length}</span>
              </div>

              <div className='token-access-draft-list'>
                {invitationDrafts.map((draft) => (
                  <article key={draft.key} className='token-access-draft-row'>
                    <div className='token-access-draft-copy'>
                      <strong>{draft.name}</strong>
                      <span>{draft.to}</span>
                      <small>{formatDraftTypeLabel(draft.type)} · {draft.subject}</small>
                    </div>
                    <button
                      type='button'
                      className='token-access-btn secondary'
                      onClick={() => openOutlookDraft(draft)}
                      aria-label={`Ouvrir l'email Outlook pour ${draft.name}`}
                    >
                      Ouvrir Outlook
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {!previewSummary ? (
            <div className='token-generator-empty-state'>
              <h3>{isPreviewLoading ? 'Chargement des liens' : 'Aucun aperçu préparé'}</h3>
              <p>
                {isPreviewLoading
                  ? 'Lecture des liens déjà générés pour cette année.'
                  : 'Choisissez une année, puis préparez l’aperçu.'}
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
                  onCopy={handleCopy}
                  onOpen={handleOpen}
                  onEmailLink={handlePrepareSingleOutlookLinkEmail}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default TokenGenerator
