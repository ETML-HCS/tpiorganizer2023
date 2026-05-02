import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import PageToolbar from '../shared/PageToolbar'
import { YEARS_CONFIG } from '../../config/appConfig'
import {
  planningCatalogService,
  workflowPlanningService
} from '../../services/planningService'

import '../../css/genToken/genToken.css'

const LINK_TYPE_FILTERS = [
  { value: 'all', label: 'Tous les liens' },
  { value: 'vote', label: 'Votes' },
  { value: 'soutenance', label: 'Défenses' }
]

const LINK_TYPE_FILTER_VALUES = new Set(LINK_TYPE_FILTERS.map((filter) => filter.value))
const DEFAULT_EMAIL_SETTINGS = {
  senderName: 'TPI Organizer',
  senderEmail: '',
  replyToEmail: '',
  defaultDeliveryMode: 'outlook'
}
const DEFAULT_PUBLICATION_SETTINGS = {
  publicBaseUrl: 'https://tpi26.ch'
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

function normalizeEmailSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {}
  const defaultDeliveryMode = String(source.defaultDeliveryMode || DEFAULT_EMAIL_SETTINGS.defaultDeliveryMode).trim()

  return {
    senderName: String(source.senderName || DEFAULT_EMAIL_SETTINGS.senderName).trim() || DEFAULT_EMAIL_SETTINGS.senderName,
    senderEmail: String(source.senderEmail || '').trim().toLowerCase(),
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

function getPublicationGeneratedLinkCount(versionEntry) {
  const generatedCount = Number.parseInt(String(versionEntry?.generatedLinkCount || ''), 10)
  return Number.isInteger(generatedCount) && generatedCount > 0 ? generatedCount : 0
}

function formatPublicationLinkCountLabel(versionEntry) {
  const recoverableCount = getPublicationRecoverableLinkCount(versionEntry)
  if (recoverableCount > 0) {
    return ` · ${recoverableCount} lien${recoverableCount > 1 ? 's' : ''}`
  }

  const generatedCount = getPublicationGeneratedLinkCount(versionEntry)
  return generatedCount > 0
    ? ` · ${generatedCount} non récupérable${generatedCount > 1 ? 's' : ''}`
    : ''
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
    .filter((entry) => Number.isInteger(Number(entry?.version)) && Number(entry.version) > 0)
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

function buildInvitationSubject(year, publicationVersion) {
  return `Horaire des défenses TPI ${year}${publicationVersion ? ` - v${publicationVersion}` : ''}`
}

function buildInvitationBody({ person, link, year, emailSettings }) {
  const recipientName = person?.name || ''
  const publicationVersion = getInvitationLinkVersion(link)
  const expiry = link?.expiresAt ? formatDateTime(link.expiresAt) : ''
  const contactEmail = emailSettings.replyToEmail || emailSettings.senderEmail
  const senderName = emailSettings.senderName || DEFAULT_EMAIL_SETTINGS.senderName

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
    expiry ? `Validité : ${expiry}` : null,
    contactEmail ? `Pour toute question : ${contactEmail}` : null,
    '',
    'Meilleures salutations',
    senderName
  ].filter((line) => line !== null).join('\n')
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
  const subject = buildInvitationSubject(year, publicationVersion)
  const body = buildInvitationBody({
    person,
    link,
    year,
    emailSettings
  })

  return {
    key: `${person.id || to}-${publicationVersion || 'publication'}-${link.url}`,
    to,
    name: person.name || to,
    publicationVersion,
    subject,
    body,
    mailto: buildMailtoUrl({ to, subject, body })
  }
}

function buildInvitationDrafts(people, options = {}) {
  const selectedPublicationVersion = getPublicationVersionRequest(options.selectedPublicationVersion)
  const year = options.year
  const emailSettings = normalizeEmailSettings(options.emailSettings)
  const drafts = []

  for (const entry of Array.isArray(people) ? people : []) {
    for (const link of Array.isArray(entry?.soutenanceLinks) ? entry.soutenanceLinks : []) {
      if (!link?.url) {
        continue
      }

      const linkPublicationVersion = getInvitationLinkVersion(link)
      if (selectedPublicationVersion && linkPublicationVersion !== selectedPublicationVersion) {
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

const LinkRow = ({
  label,
  subtitle,
  badges = [],
  details = [],
  url,
  expiresAt,
  generated = false,
  recoverable = true,
  onCopy,
  onOpen,
  onEmail = null
}) => {
  const hasUrl = typeof url === 'string' && url.length > 0
  const placeholderLabel = generated
    ? recoverable === false
      ? 'Lien généré avant persistance'
      : 'Lien généré sans URL récupérable'
    : 'Lien non généré'

  return (
    <article className='token-access-link-row'>
      <div className='token-access-link-copy'>
        <div className='token-access-link-head'>
          <strong>{label}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
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
          {expiresAt ? `Expire le ${formatDateTime(expiresAt)}` : 'Expiration définie à la génération'}
        </span>
      </div>

      <div className='token-access-link-actions'>
        <button
          type='button'
          className='token-access-btn secondary'
          onClick={hasUrl ? onCopy : undefined}
          disabled={!hasUrl}
          title={hasUrl ? `Copier le lien : ${url}` : 'Lien à générer'}
          aria-label={`Copier le lien ${label}`}
        >
          Copier
        </button>
        <button
          type='button'
          className='token-access-btn primary'
          onClick={hasUrl ? onOpen : undefined}
          disabled={!hasUrl}
          title={hasUrl ? `Ouvrir le lien : ${url}` : 'Lien à générer'}
          aria-label={`Ouvrir le lien ${label}`}
        >
          Ouvrir
        </button>
        {onEmail ? (
          <button
            type='button'
            className='token-access-btn secondary'
            onClick={hasUrl ? onEmail : undefined}
            disabled={!hasUrl}
            title={hasUrl ? 'Préparer un email Outlook pour ce lien.' : 'Lien à générer'}
            aria-label={`Préparer un email ${label}`}
          >
            Email
          </button>
        ) : null}
      </div>
    </article>
  )
}

const PersonCard = ({ entry, onCopy, onOpen, onEmailSoutenance }) => {
  const roleLabels = Array.isArray(entry?.person?.roles)
    ? entry.person.roles.map((role) => formatRoleLabel(role))
    : []
  const voteLinks = Array.isArray(entry?.voteLinks) ? entry.voteLinks : []
  const soutenanceLinks = Array.isArray(entry?.soutenanceLinks) ? entry.soutenanceLinks : []
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
                generated={link.generated === true}
                recoverable={link.recoverable !== false}
                onCopy={() => onCopy(link.url)}
                onOpen={() => onOpen(link.url)}
                onEmail={() => onEmailSoutenance(entry, link)}
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
                generated={link.generated === true}
                recoverable={link.recoverable !== false}
                onCopy={() => onCopy(link.url)}
                onOpen={() => onOpen(link.url)}
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

    const loadStaticPublicationStatus = async () => {
      try {
        const [status, voteStatus] = await Promise.all([
          workflowPlanningService.getStaticPublicationStatus(selectedYear),
          workflowPlanningService.getStaticVotePublicationStatus(selectedYear)
        ])
        if (!isCancelled) {
          setStaticPublicationInfo(status || null)
          setStaticVotePublicationInfo(voteStatus || null)
        }
      } catch (error) {
        if (!isCancelled) {
          setStaticPublicationInfo(null)
          setStaticVotePublicationInfo(null)
        }
      }
    }

    loadStaticPublicationStatus()

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

      if (linkTypeFilter === 'vote' && !hasVoteLinks) {
        return false
      }

      if (linkTypeFilter === 'soutenance' && !hasSoutenanceLinks) {
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
        )
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

  const loadAccessLinksPreview = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++accessLinkRequestIdRef.current
    setIsPreviewLoading(true)
    setErrorMessage('')
    if (!silent) {
      setSuccessMessage('')
    }
    setInvitationDrafts([])

    try {
      const publicationVersion = getPublicationVersionRequest(selectedPublicationVersion)
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
          `Aperçu préparé: ${preview?.summary?.peopleCount || 0} personne(s), ${preview?.summary?.voteLinkCount || 0} lien(s) vote, ${preview?.summary?.soutenanceLinkCount || 0} lien(s) défense, ${preview?.summary?.generatedLinkCount || 0} disponible(s).`
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
        `${result?.summary?.peopleCount || 0} personne(s) préparée(s), ${result?.summary?.voteLinkCount || 0} lien(s) vote, ${result?.summary?.soutenanceLinkCount || 0} lien(s) défense généré(s).`
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
    loadAccessLinksPreview({ silent: true })
  }, [loadAccessLinksPreview])

  const handleCopy = async (url) => {
    try {
      await copyToClipboard(url)
      setSuccessMessage('Lien copié dans le presse-papiers.')
      setErrorMessage('')
    } catch (error) {
      setErrorMessage('Impossible de copier ce lien.')
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

    if (!previewPayload?.summary?.soutenanceGeneratedLinkCount) {
      setErrorMessage("Aucun lien de défense disponible. Générez les liens d'accès avant de préparer les emails.")
      setSuccessMessage('')
      return
    }

    if (!isPublicationSelectionSynced) {
      setErrorMessage("La publication sélectionnée ne correspond pas aux liens affichés. Préparez l'aperçu ou régénérez les liens pour cette publication.")
      setSuccessMessage('')
      return
    }

    const drafts = buildInvitationDrafts(filteredPeople, {
      year: selectedYear,
      selectedPublicationVersion: selectedPublicationVersionValue,
      emailSettings
    })

    if (drafts.length === 0) {
      setInvitationDrafts([])
      setErrorMessage("Aucun lien de défense généré ne correspond au filtre actuel.")
      setSuccessMessage('')
      return
    }

    setInvitationDrafts(drafts)
    setErrorMessage('')
    setSuccessMessage(
      `${drafts.length} invitation${drafts.length > 1 ? 's' : ''} Outlook préparée${drafts.length > 1 ? 's' : ''}. Le premier brouillon va s'ouvrir.`
    )
    openOutlookDraft(drafts[0])
  }

  const handlePrepareSingleOutlookInvitation = (entry, link) => {
    if (!prepareWithOutlook) {
      setErrorMessage("L'envoi automatique n'est pas activé pour le moment. Cochez Outlook pour préparer les messages.")
      setSuccessMessage('')
      return
    }

    if (!link?.url) {
      setErrorMessage("Générez ce lien avant de préparer l'email.")
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
    setSuccessMessage(`Invitation Outlook préparée pour ${draft.name}.`)
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
  const prepareEmailsTitle = !isPublicationSelectionSynced
    ? "Préparez ou générez les liens pour la publication sélectionnée."
    : !hasGeneratedSoutenanceLinks
      ? "Générez les liens de défense avant de préparer les emails."
      : prepareWithOutlook
        ? 'Préparer les invitations Outlook pour les liens de défense filtrés.'
        : "L'envoi automatique est désactivé pour le moment."
  const generateLinksLabel = previewPayload?.hasGeneratedLinks ? 'Regénérer les liens' : 'Générer les liens'
  const generateLinksTitle = previewPayload?.hasGeneratedLinks
    ? 'Remplacer les liens d’accès admin déjà générés.'
    : 'Générer les liens d’accès.'
  const isBusy = isPreviewLoading || isGenerating
  const publicationSiteLinksTitle = canUsePublicationSiteLinks
    ? `Générer les liens de défense vers ${staticPublicationPublicUrl}.`
    : 'URL publique de publication indisponible. Vérifiez la configuration et la génération statique.'
  const votePublicationSiteLinksTitle = canUseVotePublicationSiteLinks
    ? `Générer les liens de vote vers ${staticVotePublicationPublicUrl}.`
    : 'URL publique de vote statique indisponible. Générez la publication vote avant de cibler le mini-site.'
  const handleShowSuggestedPublication = () => {
    if (!suggestedPublicationWithLinks?.version) {
      return
    }

    setSelectedPublicationVersion(String(suggestedPublicationWithLinks.version))
    setErrorMessage('')
    setSuccessMessage('')
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
                !hasGeneratedSoutenanceLinks ||
                !prepareWithOutlook ||
                !isPublicationSelectionSynced
              }
              title={prepareEmailsTitle}
              aria-label='Préparer invitations Outlook'
            >
              Préparer emails
            </button>
          </div>
        </div>

        <div className='token-access-toolbar-note'>
          L’aperçu recharge les liens déjà générés quand ils sont encore valides. La génération remplace les liens admin du site choisi. Le site publication ne concerne que les liens de défense. L’envoi automatique reste désactivé: le mode Outlook prépare seulement des brouillons.
        </div>
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
                La publication affichée v{publicationVersion || 'active'} n’a pas encore de liens générés.
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
                <span>Disponibles</span>
                <strong>{previewSummary.generatedLinkCount || 0}</strong>
              </article>

              <article className='token-access-summary-card'>
                <span>Votes en attente</span>
                <strong>{previewContexts?.vote?.tpiCount || 0} TPI</strong>
              </article>
            </div>
          ) : null}

          {invitationDrafts.length > 0 ? (
            <section className='token-access-draft-panel' aria-label='Invitations Outlook préparées'>
              <div className='token-access-draft-head'>
                <div>
                  <h3>Invitations Outlook</h3>
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
                      <small>{draft.subject}</small>
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
                Aucun lien ne correspond au filtre actuel.
              </p>
            </div>
          ) : (
            <div className='token-access-person-list'>
              {filteredPeople.map((entry) => (
                <PersonCard
                  key={entry?.person?.id || entry?.person?.email}
                  entry={entry}
                  onCopy={handleCopy}
                  onOpen={handleOpen}
                  onEmailSoutenance={handlePrepareSingleOutlookInvitation}
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
