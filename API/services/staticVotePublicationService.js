const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

const { rootDir } = require('../config/loadEnv')
const TpiPlanning = require('../models/tpiPlanningModel')
const Vote = require('../models/voteModel')
const { MagicLink } = require('../models/magicLinkModel')
const schedulingService = require('./schedulingService')
const { getSharedPublicationSettingsIfAvailable } = require('./planningCatalogService')
const {
  getPublicationDeploymentConfigIfAvailable
} = require('./publicationDeploymentConfigService')
const {
  SimpleFtpClient,
  getFtpConfig,
  joinSlashPaths,
  normalizeSlashPath
} = require('./staticDefensePublicationService')

const DEFAULT_OUTPUT_ROOT = path.resolve(rootDir, 'static-publication')
const DEFAULT_PUBLIC_BASE_URL = 'https://tpi26.ch'
const DEFAULT_STATIC_VOTE_PATH_PREFIX = 'votes'
const STATIC_VOTE_BOOTSTRAP_PLACEHOLDER = '<!-- STATIC_VOTE_BOOTSTRAP -->'
const STATIC_VOTE_IMPORT_PREFIX = 'static-vote'
const VOTE_TPI_STATUSES = ['voting', 'pending_validation']
const ALLOWED_RESPONSE_MODES = new Set(['ok', 'proposal'])

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function parseYear(value) {
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    const error = new Error('Annee invalide pour la publication vote.')
    error.statusCode = 400
    throw error
  }

  return parsed
}

function escapeHtml(value) {
  return compactText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function serializeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

function serializeJsonForPhp(value) {
  return JSON.stringify(value)
    .replace(/<\?/g, '<\\/')
    .replace(/<\/script/gi, '<\\/script')
}

function toIdString(value) {
  if (!value) {
    return ''
  }

  return String(value?._id || value?.id || value)
}

function toDateOrNull(value) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toIsoDate(value) {
  const date = toDateOrNull(value)
  return date ? date.toISOString().slice(0, 10) : ''
}

function formatDateLabel(value) {
  const isoDate = toIsoDate(value)
  if (!isoDate) {
    return ''
  }

  const date = new Date(`${isoDate}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    return isoDate
  }

  return new Intl.DateTimeFormat('fr-CH', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date)
}

function formatPersonName(person) {
  if (!person) {
    return ''
  }

  if (typeof person.fullName === 'string' && person.fullName.trim()) {
    return person.fullName.trim()
  }

  if (typeof person.name === 'string' && person.name.trim()) {
    return person.name.trim()
  }

  return [person.firstName, person.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function getOutputRoot() {
  const configuredPath = compactText(
    process.env.STATIC_VOTE_PUBLICATION_DIR ||
    process.env.STATIC_PUBLICATION_DIR
  )

  return configuredPath
    ? path.resolve(rootDir, configuredPath)
    : DEFAULT_OUTPUT_ROOT
}

function getOutputDir(year) {
  return path.join(getOutputRoot(), 'votes', String(parseYear(year)))
}

function getIndexPath(year) {
  return path.join(getOutputDir(year), 'index.html')
}

function getPhpIndexPath(year) {
  return path.join(getOutputDir(year), 'index.php')
}

function getSyncPhpPath(year) {
  return path.join(getOutputDir(year), 'sync.php')
}

function getDeniedIndexPath(year) {
  return path.join(getOutputDir(year), 'index-denied.html')
}

function getHtaccessPath(year) {
  return path.join(getOutputDir(year), '.htaccess')
}

function getManifestPath(year) {
  return path.join(getOutputDir(year), 'manifest.json')
}

function getPreviewPath(year) {
  return `/api/workflow/${parseYear(year)}/static-votes/preview`
}

function withPublicationYear(value, year) {
  return compactText(value).replace(/\{year\}/g, String(parseYear(year)))
}

function getDefaultStaticVotePublicPath(year) {
  return `/${DEFAULT_STATIC_VOTE_PATH_PREFIX}-${parseYear(year)}`
}

function normalizeVotePublicPath(year, deploymentConfig = null) {
  const normalizedYear = parseYear(year)
  const configuredDeploymentPath = compactText(deploymentConfig?.votePublicPath)
  const configuredPublicPath = compactText(
    configuredDeploymentPath ||
    process.env.STATIC_VOTE_PUBLIC_PATH ||
    process.env.STATIC_VOTE_PUBLICATION_PUBLIC_PATH ||
    process.env.FTP_STATIC_VOTE_PUBLIC_PATH
  )

  if (configuredPublicPath) {
    return normalizeSlashPath(withPublicationYear(configuredPublicPath, normalizedYear))
  }

  return getDefaultStaticVotePublicPath(normalizedYear)
}

function normalizeVoteRemoteDir(year, deploymentConfig = null) {
  const normalizedYear = parseYear(year)
  const remoteBaseDir = compactText(deploymentConfig?.remoteDir || process.env.FTP_REMOTE_DIR)
  const voteRemoteDir = compactText(deploymentConfig?.voteRemoteDir || process.env.FTP_STATIC_VOTE_REMOTE_DIR)
  const defaultVoteDir = `${DEFAULT_STATIC_VOTE_PATH_PREFIX}-${normalizedYear}`

  if (voteRemoteDir) {
    const configuredVoteDir = withPublicationYear(voteRemoteDir, normalizedYear)
    return remoteBaseDir && !configuredVoteDir.startsWith('/')
      ? joinSlashPaths(withPublicationYear(remoteBaseDir, normalizedYear), configuredVoteDir)
      : normalizeSlashPath(configuredVoteDir)
  }

  if (remoteBaseDir) {
    return joinSlashPaths(withPublicationYear(remoteBaseDir, normalizedYear), defaultVoteDir)
  }

  return normalizeSlashPath(defaultVoteDir)
}

function normalizePublicBaseUrl(value, fallback = DEFAULT_PUBLIC_BASE_URL) {
  const rawValue = compactText(value)
  const rawFallback = compactText(fallback) || DEFAULT_PUBLIC_BASE_URL
  const candidate = rawValue || rawFallback
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`

  try {
    const url = new URL(withProtocol)
    url.hash = ''
    url.search = ''
    return url.toString().replace(/\/+$/, '')
  } catch (error) {
    return rawFallback.replace(/\/+$/, '')
  }
}

async function getConfiguredPublicBaseUrl(deploymentConfig = null) {
  const configuredDeploymentUrl = compactText(deploymentConfig?.publicBaseUrl)
  const publicationSettings = await getSharedPublicationSettingsIfAvailable()
  const configuredCatalogUrl = compactText(publicationSettings?.publicBaseUrl)
  const configuredEnvUrl = compactText(
    process.env.STATIC_VOTE_PUBLIC_BASE_URL ||
    process.env.STATIC_PUBLIC_BASE_URL ||
    process.env.PUBLIC_SITE_BASE_URL
  )
  const normalizedDefaultUrl = normalizePublicBaseUrl(DEFAULT_PUBLIC_BASE_URL)
  const normalizedDeploymentUrl = configuredDeploymentUrl
    ? normalizePublicBaseUrl(configuredDeploymentUrl)
    : ''
  const normalizedCatalogUrl = configuredCatalogUrl
    ? normalizePublicBaseUrl(configuredCatalogUrl)
    : ''

  if (normalizedDeploymentUrl && normalizedDeploymentUrl !== normalizedDefaultUrl) {
    return normalizedDeploymentUrl
  }

  if (normalizedCatalogUrl && normalizedCatalogUrl !== normalizedDefaultUrl) {
    return normalizedCatalogUrl
  }

  return normalizePublicBaseUrl(
    configuredEnvUrl ||
    normalizedDeploymentUrl ||
    normalizedCatalogUrl ||
    DEFAULT_PUBLIC_BASE_URL
  )
}

async function getPublicUrl(year, deploymentConfig = null) {
  const baseUrl = compactText(await getConfiguredPublicBaseUrl(deploymentConfig)).replace(/\/+$/, '')
  const publicPath = normalizeVotePublicPath(year, deploymentConfig)

  return `${baseUrl}${publicPath === '/' ? '/' : `${publicPath}/`}`
}

function buildPublicUrlLinkTarget(rawPublicUrl) {
  const publicUrl = compactText(rawPublicUrl)

  if (!publicUrl) {
    return null
  }

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(publicUrl)
    ? publicUrl
    : `https://${publicUrl}`

  try {
    const url = new URL(withProtocol)
    return {
      baseUrl: `${url.protocol}//${url.host}`,
      redirectPath: `${url.pathname || '/'}${url.search || ''}` || '/'
    }
  } catch (error) {
    return null
  }
}

async function getStaticVoteLinkTarget(year, explicitPublicUrl = '') {
  const publicUrl = compactText(explicitPublicUrl) || await getPublicUrl(year)
  const target = buildPublicUrlLinkTarget(publicUrl)

  if (!target) {
    const error = new Error('URL publique de vote statique invalide ou absente.')
    error.statusCode = 400
    throw error
  }

  return target
}

function getSyncSecret() {
  return compactText(process.env.STATIC_VOTE_SYNC_SECRET)
}

function getSlotIdFromProposedSlot(proposedSlot) {
  return toIdString(proposedSlot?.slot)
}

function getFixedSlotIdFromTpi(tpi) {
  const fixedSlot = Array.isArray(tpi?.proposedSlots)
    ? tpi.proposedSlots.find((proposedSlot) => proposedSlot?.slot)
    : null

  return getSlotIdFromProposedSlot(fixedSlot)
}

function buildSlotPayload(slot) {
  const date = toIsoDate(slot?.date)
  const roomName = compactText(slot?.room?.name)
  const roomSite = compactText(slot?.room?.site)
  const startTime = compactText(slot?.startTime)
  const endTime = compactText(slot?.endTime)

  return {
    id: toIdString(slot),
    date,
    dateLabel: formatDateLabel(slot?.date),
    period: Number.parseInt(String(slot?.period || ''), 10) || null,
    startTime,
    endTime,
    roomName,
    roomSite,
    label: [
      formatDateLabel(slot?.date),
      startTime && endTime ? `${startTime} - ${endTime}` : '',
      roomName
    ].filter(Boolean).join(' | ')
  }
}

function buildCampaignId(year, groups = []) {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      year: parseYear(year),
      groups: groups.map((group) => ({
        personId: group.personId,
        tpiId: group.tpi?.id,
        fixedVoteId: group.fixedVoteId,
        proposals: group.proposalOptions.map((option) => option.slotId)
      }))
    }))
    .digest('hex')

  return `vote-${parseYear(year)}-${hash.slice(0, 16)}`
}

async function listStaticVoteAccessLinks(year) {
  const normalizedYear = parseYear(year)
  const now = new Date()
  const links = await MagicLink.find({
    type: 'vote',
    year: normalizedYear,
    revokedAt: null,
    expiresAt: { $gt: now }
  })
    .select('tokenHash personId personName recipientEmail expiresAt maxUses usageCount scope')
    .lean()

  return (Array.isArray(links) ? links : [])
    .filter((link) => {
      const tokenHash = compactText(link?.tokenHash)
      if (!tokenHash) {
        return false
      }

      const maxUses = Number(link?.maxUses || 0)
      const usageCount = Number(link?.usageCount || 0)
      return maxUses <= 0 || usageCount < maxUses
    })
    .map((link) => ({
      year: normalizedYear,
      hash: compactText(link.tokenHash),
      personId: link.personId ? String(link.personId) : null,
      name: compactText(link.personName) || null,
      email: compactText(link.recipientEmail) || null,
      scope: link.scope && typeof link.scope === 'object' && !Array.isArray(link.scope)
        ? link.scope
        : {},
      expiresAt: link.expiresAt instanceof Date
        ? link.expiresAt.toISOString()
        : new Date(link.expiresAt).toISOString()
    }))
}

function sortVoteSlots(slots = [], tpi) {
  const orderedSlotIds = Array.isArray(tpi?.proposedSlots)
    ? tpi.proposedSlots
      .map(getSlotIdFromProposedSlot)
      .filter(Boolean)
    : []
  const slotOrder = new Map(orderedSlotIds.map((slotId, index) => [slotId, index]))

  return [...slots].sort((left, right) => {
    const leftOrder = slotOrder.has(left.slotId) ? slotOrder.get(left.slotId) : Number.MAX_SAFE_INTEGER
    const rightOrder = slotOrder.has(right.slotId) ? slotOrder.get(right.slotId) : Number.MAX_SAFE_INTEGER

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    return String(left.slot?.label || '').localeCompare(String(right.slot?.label || ''), 'fr')
  })
}

async function buildStaticVoteCampaignPayload(year, generatedAt = new Date().toISOString()) {
  const normalizedYear = parseYear(year)
  const tpis = await TpiPlanning.find({
    year: normalizedYear,
    status: { $in: VOTE_TPI_STATUSES }
  })
    .populate('candidat', 'firstName lastName name fullName')
    .populate('proposedSlots.slot', 'date period startTime endTime room status')
    .select('reference sujet year status candidat proposedSlots')
    .sort({ reference: 1 })

  if (!Array.isArray(tpis) || tpis.length === 0) {
    return {
      year: normalizedYear,
      generatedAt,
      campaignId: buildCampaignId(normalizedYear, []),
      groups: []
    }
  }

  const tpiById = new Map(tpis.map((tpi) => [toIdString(tpi), tpi]))
  const votes = await Vote.find({
    tpiPlanning: { $in: tpis.map((tpi) => tpi._id) },
    decision: 'pending'
  })
    .populate('slot', 'date period startTime endTime room status')
    .populate('voter', 'firstName lastName name fullName email')
    .select('tpiPlanning slot voter voterRole decision')
    .sort({ createdAt: 1 })

  const groupsByKey = new Map()

  for (const vote of Array.isArray(votes) ? votes : []) {
    const tpiId = toIdString(vote?.tpiPlanning)
    const tpi = tpiById.get(tpiId)
    const personId = toIdString(vote?.voter)
    const slotId = toIdString(vote?.slot)

    if (!tpi || !personId || !slotId) {
      continue
    }

    const groupKey = `${personId}:${tpiId}`

    if (!groupsByKey.has(groupKey)) {
      groupsByKey.set(groupKey, {
        personId,
        personName: formatPersonName(vote.voter),
        personEmail: compactText(vote?.voter?.email),
        tpi: {
          id: tpiId,
          reference: compactText(tpi.reference),
          subject: compactText(tpi.sujet),
          candidateName: formatPersonName(tpi.candidat),
          status: compactText(tpi.status)
        },
        fixedVoteId: '',
        fixedSlotId: '',
        fixedSlot: null,
        proposalOptions: [],
        slots: []
      })
    }

    groupsByKey.get(groupKey).slots.push({
      voteId: toIdString(vote),
      voterRole: compactText(vote.voterRole),
      slotId,
      slot: buildSlotPayload(vote.slot)
    })
  }

  const groups = []

  for (const group of groupsByKey.values()) {
    const tpi = tpiById.get(group.tpi.id)
    const fixedSlotId = getFixedSlotIdFromTpi(tpi)
    const sortedSlots = sortVoteSlots(group.slots, tpi)
    const fixedEntry = sortedSlots.find((slot) => slot.slotId === fixedSlotId) || sortedSlots[0] || null

    if (!fixedEntry) {
      continue
    }

    groups.push({
      personId: group.personId,
      personName: group.personName,
      personEmail: group.personEmail,
      tpi: group.tpi,
      fixedVoteId: fixedEntry.voteId,
      fixedSlotId: fixedEntry.slotId,
      fixedSlot: fixedEntry.slot,
      proposalOptions: sortedSlots
        .filter((slot) => slot.slotId !== fixedEntry.slotId)
        .map((slot) => ({
          voteId: slot.voteId,
          slotId: slot.slotId,
          slot: slot.slot,
          source: 'existing_vote'
        }))
    })
  }

  groups.sort((left, right) => (
    `${left.personName}|${left.tpi.reference}`
      .localeCompare(`${right.personName}|${right.tpi.reference}`, 'fr')
  ))

  return {
    year: normalizedYear,
    generatedAt,
    campaignId: buildCampaignId(normalizedYear, groups),
    groups
  }
}

function buildStaticVoteUnavailableHtml(year, title = 'Vote non disponible', message = 'Le module de vote est protege par lien personnel.') {
  const normalizedYear = parseYear(year)

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(title)} ${normalizedYear}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, Arial, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f7f9; color: #172033; }
    main { width: min(520px, calc(100vw - 32px)); background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 28px; box-shadow: 0 20px 60px rgba(23, 32, 51, .08); }
    h1 { margin: 0 0 10px; font-size: 1.45rem; }
    p { margin: 0; color: #526071; line-height: 1.55; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </main>
</body>
</html>`
}

function buildStaticVoteHtml({ year, generatedAt, campaignId, groups = [] }) {
  const normalizedYear = parseYear(year)

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Votes planning ${normalizedYear}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, Arial, sans-serif;
      --ink: #172033;
      --muted: #617084;
      --line: #d8dee8;
      --panel: #fff;
      --page: #f6f7f9;
      --accent: #0f766e;
      --danger: #b42318;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--page); color: var(--ink); }
    button, input, textarea { font: inherit; }
    .vote-shell { width: min(1080px, calc(100vw - 32px)); margin: 0 auto; padding: 24px 0 40px; }
    .vote-header { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; padding: 10px 0 22px; }
    .vote-header h1 { margin: 0; font-size: clamp(1.45rem, 3vw, 2rem); letter-spacing: 0; }
    .vote-header p { margin: 6px 0 0; color: var(--muted); }
    .vote-meta { text-align: right; color: var(--muted); font-size: .92rem; }
    .vote-list { display: grid; gap: 14px; }
    .vote-card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 18px; box-shadow: 0 10px 30px rgba(23, 32, 51, .06); }
    .vote-card.is-submitted { border-color: rgba(15, 118, 110, .45); }
    .vote-card-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 14px; }
    .vote-card h2 { margin: 0; font-size: 1.12rem; letter-spacing: 0; }
    .vote-card p { margin: 4px 0 0; color: var(--muted); }
    .vote-chip { display: inline-flex; align-items: center; min-height: 28px; padding: 4px 9px; border-radius: 999px; background: #edf7f5; color: #0b5e57; font-size: .85rem; white-space: nowrap; }
    .vote-section { border-top: 1px solid var(--line); padding-top: 14px; margin-top: 14px; }
    .vote-slot { display: grid; gap: 4px; padding: 12px; border: 1px solid var(--line); border-radius: 8px; background: #fbfcfe; }
    .vote-slot strong { font-size: .98rem; }
    .vote-slot span { color: var(--muted); font-size: .92rem; }
    .vote-mode { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
    .vote-mode label, .vote-proposal label, .vote-special label { display: flex; gap: 9px; align-items: flex-start; border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: #fff; cursor: pointer; }
    .vote-mode strong, .vote-proposal strong { display: block; }
    .vote-mode span, .vote-proposal span { display: block; color: var(--muted); font-size: .9rem; margin-top: 2px; }
    .vote-proposals { display: grid; gap: 10px; margin-top: 10px; }
    .vote-special { display: grid; gap: 10px; margin-top: 12px; }
    .vote-special-fields { display: grid; grid-template-columns: minmax(0, 180px) minmax(0, 1fr); gap: 10px; margin-top: 8px; }
    .vote-special-fields input, .vote-special-fields textarea { width: 100%; border: 1px solid var(--line); border-radius: 8px; padding: 10px; background: #fff; color: var(--ink); }
    .vote-special-fields textarea { min-height: 78px; resize: vertical; }
    .vote-actions { display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-top: 16px; }
    .vote-status { color: var(--muted); font-size: .92rem; }
    .vote-status.is-error { color: var(--danger); }
    .vote-status.is-success { color: var(--accent); }
    .vote-submit { border: 0; border-radius: 8px; background: var(--accent); color: white; padding: 10px 14px; cursor: pointer; }
    .vote-submit:disabled { opacity: .55; cursor: default; }
    .vote-empty { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 24px; color: var(--muted); }
    @media (max-width: 720px) {
      .vote-header, .vote-card-header, .vote-actions { display: grid; text-align: left; }
      .vote-meta { text-align: left; }
      .vote-mode, .vote-special-fields { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="vote-shell">
    <header class="vote-header">
      <div>
        <h1>Votes planning ${normalizedYear}</h1>
        <p id="vote-viewer">Lien personnel en verification.</p>
      </div>
      <div class="vote-meta">
        <div>Campagne ${escapeHtml(campaignId || '')}</div>
        <div>Genere le ${escapeHtml(generatedAt || '')}</div>
      </div>
    </header>
    <main id="vote-root" class="vote-list" aria-live="polite"></main>
  </div>
  ${STATIC_VOTE_BOOTSTRAP_PLACEHOLDER}
  <script>
    (function () {
      var bootstrap = window.__STATIC_VOTE_BOOTSTRAP__ || {};
      var groups = Array.isArray(bootstrap.groups) ? bootstrap.groups : [];
      var submittedTpiIds = new Set(Array.isArray(bootstrap.submittedTpiIds) ? bootstrap.submittedTpiIds : []);
      var root = document.getElementById('vote-root');
      var viewer = document.getElementById('vote-viewer');

      function escapeText(value) {
        return String(value == null ? '' : value);
      }

      function setViewer() {
        var name = bootstrap.viewer && bootstrap.viewer.name ? bootstrap.viewer.name : '';
        viewer.textContent = name ? 'Connecte: ' + name : 'Lien personnel valide.';
      }

      function buildSubmitUrl() {
        var url = new URL(window.location.href);
        url.searchParams.set('action', 'submit');
        return url.toString();
      }

      function createSlotNode(slot) {
        var node = document.createElement('div');
        node.className = 'vote-slot';
        var title = document.createElement('strong');
        title.textContent = escapeText(slot && slot.label ? slot.label : 'Creneau');
        var meta = document.createElement('span');
        meta.textContent = [
          slot && slot.roomSite ? slot.roomSite : '',
          slot && slot.period ? 'Periode ' + slot.period : ''
        ].filter(Boolean).join(' | ');
        node.append(title, meta);
        return node;
      }

      function getCardState(card) {
        var modeInput = card.querySelector('input[name="' + card.dataset.groupName + '-mode"]:checked');
        var mode = modeInput ? modeInput.value : '';
        var proposedSlotIds = Array.from(card.querySelectorAll('input[data-proposal-slot]:checked'))
          .map(function (input) { return input.value; });
        var specialEnabled = Boolean(card.querySelector('input[data-special-enabled]:checked'));
        var reason = card.querySelector('[data-special-reason]');
        var date = card.querySelector('[data-special-date]');

        return {
          mode: mode,
          proposedSlotIds: proposedSlotIds,
          specialRequest: specialEnabled ? {
            reason: reason ? reason.value.trim() : '',
            requestedDate: date ? date.value : ''
          } : null
        };
      }

      function setStatus(card, text, kind) {
        var status = card.querySelector('[data-status]');
        status.textContent = text || '';
        status.className = 'vote-status' + (kind ? ' is-' + kind : '');
      }

      async function submitGroup(card, group) {
        var state = getCardState(card);

        if (state.mode !== 'ok' && state.mode !== 'proposal') {
          setStatus(card, 'Choisissez OK ou Proposition.', 'error');
          return;
        }

        if (state.mode === 'proposal' && state.proposedSlotIds.length === 0 && !state.specialRequest) {
          setStatus(card, 'Choisissez un creneau alternatif ou une demande speciale.', 'error');
          return;
        }

        if (state.specialRequest && (!state.specialRequest.reason || !state.specialRequest.requestedDate)) {
          setStatus(card, 'La demande speciale exige une date et une raison.', 'error');
          return;
        }

        var submitButton = card.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        setStatus(card, 'Envoi en cours...', '');

        try {
          var response = await fetch(buildSubmitUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              campaignId: bootstrap.campaignId,
              tpiId: group.tpi.id,
              fixedVoteId: group.fixedVoteId,
              mode: state.mode,
              proposedSlotIds: state.mode === 'proposal' ? state.proposedSlotIds : [],
              specialRequest: state.mode === 'proposal' ? state.specialRequest : null
            })
          });
          var data = await response.json().catch(function () { return {}; });

          if (!response.ok || data.success !== true) {
            throw new Error(data.error || 'Reponse refusee.');
          }

          submittedTpiIds.add(group.tpi.id);
          card.classList.add('is-submitted');
          setStatus(card, 'Vote enregistre.', 'success');
        } catch (error) {
          submitButton.disabled = false;
          setStatus(card, error && error.message ? error.message : 'Erreur lors de l envoi.', 'error');
        }
      }

      function renderGroup(group, index) {
        var card = document.createElement('form');
        card.className = 'vote-card';
        card.dataset.groupName = 'vote-' + index;

        if (submittedTpiIds.has(group.tpi.id)) {
          card.classList.add('is-submitted');
        }

        var header = document.createElement('div');
        header.className = 'vote-card-header';
        var titleBlock = document.createElement('div');
        var title = document.createElement('h2');
        title.textContent = [group.tpi.reference, group.tpi.candidateName].filter(Boolean).join(' - ');
        var subject = document.createElement('p');
        subject.textContent = group.tpi.subject || 'Sujet non renseigne';
        titleBlock.append(title, subject);
        var chip = document.createElement('span');
        chip.className = 'vote-chip';
        chip.textContent = submittedTpiIds.has(group.tpi.id) ? 'Deja transmis' : 'A repondre';
        header.append(titleBlock, chip);

        var fixedSection = document.createElement('section');
        fixedSection.className = 'vote-section';
        var fixedTitle = document.createElement('h3');
        fixedTitle.textContent = 'Date fixee';
        fixedSection.append(fixedTitle, createSlotNode(group.fixedSlot));

        var mode = document.createElement('div');
        mode.className = 'vote-mode';
        mode.innerHTML =
          '<label><input type="radio" name="' + card.dataset.groupName + '-mode" value="ok"><span><strong>OK</strong><span>Je valide la date fixee.</span></span></label>' +
          '<label><input type="radio" name="' + card.dataset.groupName + '-mode" value="proposal"><span><strong>Proposition</strong><span>Je propose un autre creneau.</span></span></label>';

        var proposalSection = document.createElement('section');
        proposalSection.className = 'vote-section';
        var proposalTitle = document.createElement('h3');
        proposalTitle.textContent = 'Alternatives';
        var proposalList = document.createElement('div');
        proposalList.className = 'vote-proposals';
        (group.proposalOptions || []).forEach(function (option) {
          var label = document.createElement('label');
          label.className = 'vote-proposal';
          label.innerHTML = '<input type="checkbox" data-proposal-slot value="' + escapeText(option.slotId) + '">';
          var span = document.createElement('span');
          var strong = document.createElement('strong');
          strong.textContent = option.slot && option.slot.label ? option.slot.label : 'Creneau alternatif';
          var small = document.createElement('span');
          small.textContent = option.slot && option.slot.roomSite ? option.slot.roomSite : '';
          span.append(strong, small);
          label.append(span);
          proposalList.append(label);
        });
        if (!proposalList.children.length) {
          var emptyProposal = document.createElement('p');
          emptyProposal.textContent = 'Aucun creneau alternatif publie.';
          proposalList.append(emptyProposal);
        }
        proposalSection.append(proposalTitle, proposalList);

        var special = document.createElement('section');
        special.className = 'vote-section vote-special';
        special.innerHTML =
          '<label><input type="checkbox" data-special-enabled><span><strong>Demande speciale</strong><span>Date hors liste ou contrainte a signaler.</span></span></label>' +
          '<div class="vote-special-fields"><input type="date" data-special-date><textarea data-special-reason placeholder="Raison"></textarea></div>';

        var actions = document.createElement('div');
        actions.className = 'vote-actions';
        var status = document.createElement('span');
        status.dataset.status = 'true';
        status.className = 'vote-status';
        status.textContent = submittedTpiIds.has(group.tpi.id) ? 'Vote deja transmis.' : '';
        var button = document.createElement('button');
        button.className = 'vote-submit';
        button.type = 'submit';
        button.textContent = 'Envoyer';
        button.disabled = submittedTpiIds.has(group.tpi.id);
        actions.append(status, button);

        card.append(header, fixedSection, mode, proposalSection, special, actions);
        card.addEventListener('submit', function (event) {
          event.preventDefault();
          submitGroup(card, group);
        });

        return card;
      }

      function render() {
        setViewer();
        root.textContent = '';

        if (!groups.length) {
          var empty = document.createElement('div');
          empty.className = 'vote-empty';
          empty.textContent = 'Aucun vote ouvert pour ce lien.';
          root.append(empty);
          return;
        }

        groups.forEach(function (group, index) {
          root.append(renderGroup(group, index));
        });
      }

      render();
    })();
  </script>
  <script type="application/json" id="static-vote-debug">${serializeJsonForHtml({
    year: normalizedYear,
    generatedAt,
    campaignId,
    groupCount: groups.length
  })}</script>
</body>
</html>`
}

function buildStaticVotePhp({ html, year, campaignPayload, accessLinks = [] }) {
  const normalizedYear = parseYear(year)

  const phpPreamble = `<?php
declare(strict_types=1);

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Robots-Tag: noindex, nofollow');

$staticVoteAccessLinks = json_decode(<<<'STATIC_VOTE_ACCESS_JSON'
${serializeJsonForPhp(Array.isArray(accessLinks) ? accessLinks : [])}
STATIC_VOTE_ACCESS_JSON, true) ?: [];

$staticVotePayload = json_decode(<<<'STATIC_VOTE_PAYLOAD_JSON'
${serializeJsonForPhp(campaignPayload || { year: normalizedYear, groups: [] })}
STATIC_VOTE_PAYLOAD_JSON, true) ?: [];

function staticVoteText($value): string
{
    if ($value === null) {
        return '';
    }

    if (is_scalar($value)) {
        return trim((string) $value);
    }

    return '';
}

function staticVoteUnavailable(int $statusCode, string $title, string $message): void
{
    http_response_code($statusCode);
    header('Content-Type: text/html; charset=utf-8');
    $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $safeMessage = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>' . $safeTitle . '</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7f9;color:#172033;font-family:Inter,Arial,sans-serif}main{width:min(520px,calc(100vw - 32px));background:#fff;border:1px solid #d8dee8;border-radius:8px;padding:28px;box-shadow:0 20px 60px rgba(23,32,51,.08)}h1{margin:0 0 10px;font-size:1.45rem}p{margin:0;color:#526071;line-height:1.55}</style></head><body><main><h1>' . $safeTitle . '</h1><p>' . $safeMessage . '</p></main></body></html>';
    exit;
}

function staticVoteJson(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    exit;
}

function staticVoteDataDir(): string
{
    $dir = __DIR__ . DIRECTORY_SEPARATOR . 'data';

    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }

    $htaccess = $dir . DIRECTORY_SEPARATOR . '.htaccess';
    if (!file_exists($htaccess)) {
        file_put_contents($htaccess, "Require all denied\\nDeny from all\\n");
    }

    return $dir;
}

function staticVoteRecordsPath(): string
{
    return staticVoteDataDir() . DIRECTORY_SEPARATOR . 'votes.jsonl';
}

function staticVoteReadRecords(): array
{
    $path = staticVoteRecordsPath();

    if (!file_exists($path)) {
        return [];
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        return [];
    }

    $records = [];
    foreach ($lines as $line) {
        $record = json_decode($line, true);
        if (is_array($record)) {
            $records[] = $record;
        }
    }

    return $records;
}

function staticVoteAppendRecord(array $record): void
{
    $path = staticVoteRecordsPath();
    $encoded = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if (!is_string($encoded) || $encoded === '') {
        staticVoteJson(500, ['success' => false, 'error' => 'Enregistrement impossible.']);
    }

    file_put_contents($path, $encoded . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function staticVoteFindAccessEntry(array $accessLinks, string $tokenHash): ?array
{
    foreach ($accessLinks as $entry) {
        if (!is_array($entry)) {
            continue;
        }

        $candidateHash = staticVoteText($entry['hash'] ?? '');
        if ($candidateHash !== '' && hash_equals($candidateHash, $tokenHash)) {
            return $entry;
        }
    }

    return null;
}

function staticVoteFilteredGroups(array $payload, array $accessEntry): array
{
    $personId = staticVoteText($accessEntry['personId'] ?? '');
    $scope = isset($accessEntry['scope']) && is_array($accessEntry['scope']) ? $accessEntry['scope'] : [];
    $scopeTpiId = staticVoteText($scope['tpiId'] ?? ($scope['tpiPlanningId'] ?? ''));
    $groups = isset($payload['groups']) && is_array($payload['groups']) ? $payload['groups'] : [];
    $filtered = [];

    foreach ($groups as $group) {
        if (!is_array($group)) {
            continue;
        }

        $groupTpi = isset($group['tpi']) && is_array($group['tpi']) ? $group['tpi'] : [];
        $groupTpiId = staticVoteText($groupTpi['id'] ?? '');

        if (
            staticVoteText($group['personId'] ?? '') === $personId &&
            ($scopeTpiId === '' || $groupTpiId === $scopeTpiId)
        ) {
            $filtered[] = $group;
        }
    }

    return $filtered;
}

function staticVoteFindGroup(array $groups, string $tpiId, string $fixedVoteId): ?array
{
    foreach ($groups as $group) {
        if (!is_array($group)) {
            continue;
        }

        $groupTpi = isset($group['tpi']) && is_array($group['tpi']) ? $group['tpi'] : [];
        if (staticVoteText($groupTpi['id'] ?? '') === $tpiId && staticVoteText($group['fixedVoteId'] ?? '') === $fixedVoteId) {
            return $group;
        }
    }

    return null;
}

function staticVoteAllowedProposalSlotIds(array $group): array
{
    $ids = [];
    $options = isset($group['proposalOptions']) && is_array($group['proposalOptions']) ? $group['proposalOptions'] : [];

    foreach ($options as $option) {
        if (is_array($option)) {
            $slotId = staticVoteText($option['slotId'] ?? '');
            if ($slotId !== '') {
                $ids[$slotId] = true;
            }
        }
    }

    return $ids;
}

function staticVoteSubmittedTpiIds(string $tokenHash): array
{
    $ids = [];

    foreach (staticVoteReadRecords() as $record) {
        if (staticVoteText($record['tokenHash'] ?? '') !== $tokenHash) {
            continue;
        }

        $tpiId = staticVoteText($record['tpiId'] ?? '');
        if ($tpiId !== '') {
            $ids[$tpiId] = true;
        }
    }

    return array_values(array_keys($ids));
}

function staticVoteFindExistingSubmission(string $tokenHash, string $campaignId, string $tpiId): ?array
{
    foreach (staticVoteReadRecords() as $record) {
        if (
            staticVoteText($record['tokenHash'] ?? '') === $tokenHash &&
            staticVoteText($record['campaignId'] ?? '') === $campaignId &&
            staticVoteText($record['tpiId'] ?? '') === $tpiId
        ) {
            return $record;
        }
    }

    return null;
}

function staticVoteRandomId(string $tokenHash, string $tpiId): string
{
    try {
        $random = bin2hex(random_bytes(12));
    } catch (Throwable $error) {
        $random = uniqid('', true);
    }

    return hash('sha256', $tokenHash . '|' . $tpiId . '|' . microtime(true) . '|' . $random);
}

function staticVoteHandleSubmit(array $payload, array $accessEntry, string $tokenHash): void
{
    $rawBody = file_get_contents('php://input');
    $body = json_decode(is_string($rawBody) ? $rawBody : '', true);

    if (!is_array($body)) {
        staticVoteJson(400, ['success' => false, 'error' => 'Payload invalide.']);
    }

    $mode = strtolower(staticVoteText($body['mode'] ?? ''));
    $tpiId = staticVoteText($body['tpiId'] ?? '');
    $fixedVoteId = staticVoteText($body['fixedVoteId'] ?? '');
    $campaignId = staticVoteText($payload['campaignId'] ?? '');
    $bodyCampaignId = staticVoteText($body['campaignId'] ?? '');

    if ($campaignId !== '' && $bodyCampaignId !== '' && $campaignId !== $bodyCampaignId) {
        staticVoteJson(409, ['success' => false, 'error' => 'Campagne obsolète.']);
    }

    if ($mode !== 'ok' && $mode !== 'proposal') {
        staticVoteJson(400, ['success' => false, 'error' => 'Mode invalide.']);
    }

    $groups = staticVoteFilteredGroups($payload, $accessEntry);
    $group = staticVoteFindGroup($groups, $tpiId, $fixedVoteId);
    if ($group === null) {
        staticVoteJson(403, ['success' => false, 'error' => 'Vote hors scope du lien.']);
    }

    $rawProposedSlotIds = isset($body['proposedSlotIds']) && is_array($body['proposedSlotIds'])
        ? $body['proposedSlotIds']
        : [];
    $allowedProposalSlotIds = staticVoteAllowedProposalSlotIds($group);
    $proposedSlotIds = [];

    foreach ($rawProposedSlotIds as $slotId) {
        $slotId = staticVoteText($slotId);
        if ($slotId === '') {
            continue;
        }

        if (!isset($allowedProposalSlotIds[$slotId])) {
            staticVoteJson(400, ['success' => false, 'error' => 'Creneau alternatif invalide.']);
        }

        if (!in_array($slotId, $proposedSlotIds, true)) {
            $proposedSlotIds[] = $slotId;
        }
    }

    $specialRequest = isset($body['specialRequest']) && is_array($body['specialRequest'])
        ? $body['specialRequest']
        : null;
    $specialReason = $specialRequest ? staticVoteText($specialRequest['reason'] ?? '') : '';
    $specialDate = $specialRequest ? staticVoteText($specialRequest['requestedDate'] ?? '') : '';
    $hasSpecialRequest = $specialReason !== '' || $specialDate !== '';

    if ($mode === 'ok' && (count($proposedSlotIds) > 0 || $hasSpecialRequest)) {
        staticVoteJson(400, ['success' => false, 'error' => 'Le mode OK ne permet pas de proposition.']);
    }

    if ($mode === 'proposal' && count($proposedSlotIds) === 0 && !$hasSpecialRequest) {
        staticVoteJson(400, ['success' => false, 'error' => 'Choisissez un creneau ou une demande speciale.']);
    }

    if ($hasSpecialRequest && ($specialReason === '' || $specialDate === '')) {
        staticVoteJson(400, ['success' => false, 'error' => 'Demande speciale incomplete.']);
    }

    $existingSubmission = staticVoteFindExistingSubmission($tokenHash, $campaignId, $tpiId);
    if ($existingSubmission !== null) {
        staticVoteJson(409, [
            'success' => false,
            'error' => 'Vote deja transmis pour ce TPI.',
            'id' => staticVoteText($existingSubmission['id'] ?? ''),
        ]);
    }

    $record = [
        'id' => staticVoteRandomId($tokenHash, $tpiId),
        'source' => 'static_vote_php',
        'year' => ${normalizedYear},
        'campaignId' => $campaignId,
        'personId' => staticVoteText($accessEntry['personId'] ?? ''),
        'personName' => staticVoteText($accessEntry['name'] ?? ''),
        'tpiId' => $tpiId,
        'fixedVoteId' => $fixedVoteId,
        'mode' => $mode,
        'proposedSlotIds' => $proposedSlotIds,
        'specialRequest' => $hasSpecialRequest ? [
            'reason' => $specialReason,
            'requestedDate' => $specialDate,
        ] : null,
        'submittedAt' => gmdate('c'),
        'tokenHash' => $tokenHash,
    ];

    staticVoteAppendRecord($record);
    staticVoteJson(200, ['success' => true, 'id' => $record['id'], 'submittedAt' => $record['submittedAt']]);
}

$staticVoteToken = isset($_GET['ml']) && is_string($_GET['ml']) ? trim($_GET['ml']) : '';
if ($staticVoteToken === '' || strlen($staticVoteToken) < 32 || strlen($staticVoteToken) > 256) {
    staticVoteUnavailable(403, 'Lien requis', 'Le vote planning est accessible uniquement avec un lien personnel.');
}

$staticVoteTokenHash = hash('sha256', $staticVoteToken);
$staticVoteAccessEntry = staticVoteFindAccessEntry($staticVoteAccessLinks, $staticVoteTokenHash);

if ($staticVoteAccessEntry === null) {
    staticVoteUnavailable(403, 'Acces refuse', 'Ce lien ne donne pas acces au vote planning.');
}

$staticVoteExpiresAt = isset($staticVoteAccessEntry['expiresAt']) && is_string($staticVoteAccessEntry['expiresAt'])
    ? strtotime($staticVoteAccessEntry['expiresAt'])
    : false;

if ($staticVoteExpiresAt !== false && $staticVoteExpiresAt <= time()) {
    staticVoteUnavailable(410, 'Lien expire', 'Ce lien de vote a expire.');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = isset($_GET['action']) && is_string($_GET['action']) ? trim($_GET['action']) : '';
    if ($action === 'submit') {
        staticVoteHandleSubmit($staticVotePayload, $staticVoteAccessEntry, $staticVoteTokenHash);
    }

    staticVoteJson(404, ['success' => false, 'error' => 'Action inconnue.']);
}

$staticVoteViewer = [
    'personId' => $staticVoteAccessEntry['personId'] ?? null,
    'name' => $staticVoteAccessEntry['name'] ?? null,
    'email' => $staticVoteAccessEntry['email'] ?? null,
];
$staticVoteBrowserPayload = $staticVotePayload;
$staticVoteBrowserPayload['viewer'] = $staticVoteViewer;
$staticVoteBrowserPayload['groups'] = staticVoteFilteredGroups($staticVotePayload, $staticVoteAccessEntry);
$staticVoteBrowserPayload['submittedTpiIds'] = staticVoteSubmittedTpiIds($staticVoteTokenHash);
$staticVoteBootstrap = '<script>window.__STATIC_VOTE_BOOTSTRAP__=' .
    json_encode($staticVoteBrowserPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) .
    ';</script>';
?>
`

  return `${phpPreamble}${html.replace(
    STATIC_VOTE_BOOTSTRAP_PLACEHOLDER,
    '<?php echo $staticVoteBootstrap; ?>'
  )}`
}

function buildStaticVoteSyncPhp({ year, syncSecret }) {
  const normalizedYear = parseYear(year)

  return `<?php
declare(strict_types=1);

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Robots-Tag: noindex, nofollow');
header('Content-Type: application/json; charset=utf-8');

$staticVoteSyncSecret = json_decode(<<<'STATIC_VOTE_SYNC_SECRET_JSON'
${serializeJsonForPhp(compactText(syncSecret))}
STATIC_VOTE_SYNC_SECRET_JSON, true);

function staticVoteSyncRespond(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if (!is_string($staticVoteSyncSecret) || trim($staticVoteSyncSecret) === '') {
    staticVoteSyncRespond(503, ['success' => false, 'error' => 'Synchronisation non configuree.']);
}

$providedSecret = '';
if (isset($_SERVER['HTTP_X_SYNC_SECRET']) && is_string($_SERVER['HTTP_X_SYNC_SECRET'])) {
    $providedSecret = trim($_SERVER['HTTP_X_SYNC_SECRET']);
} elseif (isset($_GET['secret']) && is_string($_GET['secret'])) {
    $providedSecret = trim($_GET['secret']);
}

if ($providedSecret === '' || !hash_equals($staticVoteSyncSecret, $providedSecret)) {
    staticVoteSyncRespond(403, ['success' => false, 'error' => 'Secret invalide.']);
}

$recordsPath = __DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'votes.jsonl';
$records = [];

if (file_exists($recordsPath)) {
    $lines = file($recordsPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (is_array($lines)) {
        foreach ($lines as $line) {
            $record = json_decode($line, true);
            if (is_array($record) && (int)($record['year'] ?? 0) === ${normalizedYear}) {
                $records[] = $record;
            }
        }
    }
}

staticVoteSyncRespond(200, [
    'success' => true,
    'year' => ${normalizedYear},
    'records' => $records,
    'count' => count($records),
]);
`
}

function buildStaticVoteHtaccess() {
  return `Options -Indexes
<FilesMatch "^(votes\\.jsonl)$">
  Require all denied
  Deny from all
</FilesMatch>
RedirectMatch 403 ^.*/data/.*$
`
}

async function writeStaticVoteAccessFiles({ year, html, campaignPayload }) {
  const normalizedYear = parseYear(year)
  const accessLinks = await listStaticVoteAccessLinks(normalizedYear)
  const syncSecret = getSyncSecret()

  await fs.promises.writeFile(
    getPhpIndexPath(normalizedYear),
    buildStaticVotePhp({
      html,
      year: normalizedYear,
      campaignPayload,
      accessLinks
    }),
    'utf8'
  )
  await fs.promises.writeFile(
    getSyncPhpPath(normalizedYear),
    buildStaticVoteSyncPhp({
      year: normalizedYear,
      syncSecret
    }),
    'utf8'
  )
  await fs.promises.writeFile(
    getDeniedIndexPath(normalizedYear),
    buildStaticVoteUnavailableHtml(normalizedYear),
    'utf8'
  )
  await fs.promises.writeFile(
    getHtaccessPath(normalizedYear),
    buildStaticVoteHtaccess(),
    'utf8'
  )

  return {
    accessLinkCount: accessLinks.length,
    syncSecretConfigured: Boolean(syncSecret)
  }
}

async function getStaticVotePublicationStatus(year, deploymentConfig = null) {
  const normalizedYear = parseYear(year)
  const resolvedDeploymentConfig = deploymentConfig || await getPublicationDeploymentConfigIfAvailable()
  const phpIndexPath = getPhpIndexPath(normalizedYear)
  const manifestPath = getManifestPath(normalizedYear)
  const available = fs.existsSync(phpIndexPath)
  let manifest = {}

  if (available && fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'))
    } catch (error) {
      manifest = {}
    }
  }

  return {
    available,
    year: normalizedYear,
    outputDir: getOutputDir(normalizedYear),
    indexPath: getIndexPath(normalizedYear),
    phpIndexPath,
    syncPhpPath: getSyncPhpPath(normalizedYear),
    deniedIndexPath: getDeniedIndexPath(normalizedYear),
    htaccessPath: getHtaccessPath(normalizedYear),
    manifestPath,
    previewPath: available ? getPreviewPath(normalizedYear) : null,
    publicUrl: await getPublicUrl(normalizedYear, resolvedDeploymentConfig),
    remoteDir: normalizeVoteRemoteDir(normalizedYear, resolvedDeploymentConfig),
    generatedAt: manifest.generatedAt || null,
    publishedAt: manifest.publishedAt || null,
    campaignId: manifest.campaignId || null,
    tpiCount: Number(manifest.tpiCount || 0),
    voterCount: Number(manifest.voterCount || 0),
    groupCount: Number(manifest.groupCount || 0),
    accessLinkCount: Number(manifest.accessLinkCount || 0),
    syncSecretConfigured: Boolean(manifest.syncSecretConfigured || getSyncSecret())
  }
}

function countUnique(values = []) {
  return new Set(values.filter(Boolean)).size
}

async function generateStaticVotesSite(year) {
  const normalizedYear = parseYear(year)
  const deploymentConfig = await getPublicationDeploymentConfigIfAvailable()
  const generatedAt = new Date().toISOString()
  const campaignPayload = await buildStaticVoteCampaignPayload(normalizedYear, generatedAt)
  const html = buildStaticVoteHtml(campaignPayload)
  const outputDir = getOutputDir(normalizedYear)

  await fs.promises.mkdir(outputDir, { recursive: true })
  await fs.promises.writeFile(getIndexPath(normalizedYear), buildStaticVoteUnavailableHtml(normalizedYear), 'utf8')

  const accessFiles = await writeStaticVoteAccessFiles({
    year: normalizedYear,
    html,
    campaignPayload
  })
  const publicUrl = await getPublicUrl(normalizedYear, deploymentConfig)
  const manifest = {
    year: normalizedYear,
    generatedAt,
    campaignId: campaignPayload.campaignId,
    tpiCount: countUnique(campaignPayload.groups.map((group) => group.tpi?.id)),
    voterCount: countUnique(campaignPayload.groups.map((group) => group.personId)),
    groupCount: campaignPayload.groups.length,
    accessLinkCount: accessFiles.accessLinkCount,
    syncSecretConfigured: accessFiles.syncSecretConfigured,
    previewPath: getPreviewPath(normalizedYear),
    publicUrl,
    remoteDir: normalizeVoteRemoteDir(normalizedYear, deploymentConfig)
  }

  await fs.promises.writeFile(getManifestPath(normalizedYear), JSON.stringify(manifest, null, 2), 'utf8')

  return {
    success: true,
    available: true,
    outputDir,
    indexPath: getIndexPath(normalizedYear),
    phpIndexPath: getPhpIndexPath(normalizedYear),
    syncPhpPath: getSyncPhpPath(normalizedYear),
    deniedIndexPath: getDeniedIndexPath(normalizedYear),
    htaccessPath: getHtaccessPath(normalizedYear),
    manifestPath: getManifestPath(normalizedYear),
    ...manifest
  }
}

async function publishStaticVotesSite(year) {
  const normalizedYear = parseYear(year)
  const deploymentConfig = await getPublicationDeploymentConfigIfAvailable({ includeSecret: true })
  const status = await getStaticVotePublicationStatus(normalizedYear, deploymentConfig)

  if (!status.available) {
    const error = new Error('Genere la publication vote avant la publication FTP.')
    error.statusCode = 409
    throw error
  }

  const php = await fs.promises.readFile(status.phpIndexPath, 'utf8')
  const match = php.match(/STATIC_VOTE_PAYLOAD_JSON'\n([\s\S]*?)\nSTATIC_VOTE_PAYLOAD_JSON/)
  const campaignPayload = match ? JSON.parse(match[1]) : {
    year: normalizedYear,
    generatedAt: status.generatedAt,
    campaignId: status.campaignId,
    groups: []
  }
  const html = buildStaticVoteHtml(campaignPayload)
  const accessFiles = await writeStaticVoteAccessFiles({
    year: normalizedYear,
    html,
    campaignPayload
  })
  const remoteDir = normalizeVoteRemoteDir(normalizedYear, deploymentConfig)
  const publishedAt = new Date().toISOString()
  const manifest = {
    year: normalizedYear,
    generatedAt: status.generatedAt || null,
    publishedAt,
    campaignId: status.campaignId || campaignPayload.campaignId || null,
    tpiCount: status.tpiCount || 0,
    voterCount: status.voterCount || 0,
    groupCount: status.groupCount || 0,
    accessLinkCount: accessFiles.accessLinkCount,
    syncSecretConfigured: accessFiles.syncSecretConfigured,
    previewPath: getPreviewPath(normalizedYear),
    publicUrl: await getPublicUrl(normalizedYear, deploymentConfig),
    remoteDir
  }

  const ftpClient = new SimpleFtpClient(getFtpConfig(deploymentConfig))

  try {
    await ftpClient.connect()
    manifest.remoteDir = await ftpClient.ensureDirectory(remoteDir)
    await ftpClient.uploadFile(status.deniedIndexPath, 'index.html')
    await ftpClient.uploadFile(status.phpIndexPath, 'index.php')
    await ftpClient.uploadFile(status.syncPhpPath, 'sync.php')
    await ftpClient.uploadFile(status.htaccessPath, '.htaccess')
    await fs.promises.writeFile(status.manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
    await ftpClient.uploadFile(status.manifestPath, 'manifest.json')
  } finally {
    await ftpClient.close()
  }

  return {
    success: true,
    available: true,
    ...manifest
  }
}

function normalizeObjectId(value) {
  const text = compactText(value)
  return mongoose.Types.ObjectId.isValid(text) ? text : ''
}

function normalizeStaticVoteRecord(record = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return null
  }

  const mode = compactText(record.mode).toLowerCase()
  const specialRequest = record.specialRequest && typeof record.specialRequest === 'object'
    ? {
        reason: compactText(record.specialRequest.reason),
        requestedDate: toDateOrNull(record.specialRequest.requestedDate)
      }
    : null
  const normalized = {
    id: compactText(record.id || record.submissionId),
    year: parseYear(record.year),
    campaignId: compactText(record.campaignId),
    personId: normalizeObjectId(record.personId),
    tpiId: normalizeObjectId(record.tpiId),
    fixedVoteId: normalizeObjectId(record.fixedVoteId),
    mode,
    proposedSlotIds: Array.isArray(record.proposedSlotIds)
      ? [...new Set(record.proposedSlotIds.map(normalizeObjectId).filter(Boolean))]
      : [],
    specialRequest,
    submittedAt: toDateOrNull(record.submittedAt) || new Date(),
    tokenHash: compactText(record.tokenHash)
  }

  if (!normalized.id || !normalized.personId || !normalized.tpiId || !normalized.fixedVoteId) {
    return null
  }

  if (!ALLOWED_RESPONSE_MODES.has(mode)) {
    return null
  }

  if (normalized.mode === 'ok') {
    normalized.proposedSlotIds = []
    normalized.specialRequest = null
    return normalized
  }

  const hasSpecialReason = Boolean(normalized.specialRequest?.reason)
  const hasSpecialDate = Boolean(normalized.specialRequest?.requestedDate)

  if ((hasSpecialReason || hasSpecialDate) && (!hasSpecialReason || !hasSpecialDate)) {
    return null
  }

  if (normalized.proposedSlotIds.length === 0 && !hasSpecialReason) {
    return null
  }

  return normalized
}

function buildImportKey(record) {
  return `${STATIC_VOTE_IMPORT_PREFIX}:${record.year}:${record.id}`
}

async function importStaticVoteRecord(rawRecord, expectedYear) {
  let record

  try {
    record = normalizeStaticVoteRecord(rawRecord)
  } catch (error) {
    return {
      imported: false,
      skipped: true,
      reason: 'invalid_record'
    }
  }

  if (!record || Number(record.year) !== Number(expectedYear)) {
    return {
      imported: false,
      skipped: true,
      reason: 'invalid_record'
    }
  }

  const importKey = buildImportKey(record)
  const alreadyImported = await Vote.exists({ magicLinkUsed: importKey })

  if (alreadyImported) {
    return {
      imported: false,
      skipped: true,
      reason: 'already_imported',
      importKey
    }
  }

  const tpi = await TpiPlanning.findOne({
    _id: record.tpiId,
    year: record.year
  }).populate('proposedSlots.slot', 'date period startTime endTime room status')

  if (!tpi) {
    return {
      imported: false,
      skipped: false,
      reason: 'tpi_not_found',
      importKey
    }
  }

  if (!VOTE_TPI_STATUSES.includes(compactText(tpi.status))) {
    return {
      imported: false,
      skipped: false,
      reason: 'tpi_not_open',
      importKey
    }
  }

  const roleIds = new Set([
    toIdString(tpi.expert1),
    toIdString(tpi.expert2),
    toIdString(tpi.chefProjet)
  ].filter(Boolean))

  if (roleIds.size > 0 && !roleIds.has(record.personId)) {
    return {
      imported: false,
      skipped: false,
      reason: 'person_out_of_scope',
      importKey
    }
  }

  const existingVotes = await Vote.find({
    tpiPlanning: tpi._id,
    voter: record.personId
  }).select('tpiPlanning slot voter voterRole decision comment availabilityException specialRequestReason specialRequestDate priority magicLinkUsed')

  if (!Array.isArray(existingVotes) || existingVotes.length === 0) {
    return {
      imported: false,
      skipped: false,
      reason: 'votes_not_found',
      importKey
    }
  }

  const existingVotesById = new Map(existingVotes.map((vote) => [toIdString(vote), vote]))
  const existingVotesBySlotId = new Map(existingVotes.map((vote) => [toIdString(vote.slot), vote]))
  const fixedVote = existingVotesById.get(record.fixedVoteId)

  if (!fixedVote) {
    return {
      imported: false,
      skipped: false,
      reason: 'fixed_vote_not_found',
      importKey
    }
  }

  const fixedSlotId = getFixedSlotIdFromTpi(tpi)
  if (fixedSlotId && toIdString(fixedVote.slot) !== fixedSlotId) {
    return {
      imported: false,
      skipped: false,
      reason: 'fixed_vote_mismatch',
      importKey
    }
  }

  const allowedProposalSlotIds = new Set(
    existingVotes
      .map((vote) => toIdString(vote.slot))
      .filter((slotId) => slotId && slotId !== fixedSlotId)
  )

  for (const slotId of record.proposedSlotIds) {
    if (!allowedProposalSlotIds.has(slotId)) {
      return {
        imported: false,
        skipped: false,
        reason: 'proposal_out_of_scope',
        importKey
      }
    }
  }

  const proposalSelectionSet = new Set(record.proposedSlotIds)
  const fixedDecision = record.mode === 'ok' ? 'accepted' : 'rejected'
  const hasSpecialRequest = Boolean(record.specialRequest?.reason || record.specialRequest?.requestedDate)
  const fixedComment = record.mode === 'proposal'
    ? (hasSpecialRequest ? record.specialRequest.reason : 'Proposition de creneaux alternatifs')
    : ''
  const sharedSpecialReason = hasSpecialRequest ? record.specialRequest.reason : ''
  const sharedSpecialDate = hasSpecialRequest ? record.specialRequest.requestedDate : null

  for (const vote of existingVotes) {
    const slotId = toIdString(vote.slot)
    const isFixedSlot = slotId === fixedSlotId
    const isSelectedProposal = proposalSelectionSet.has(slotId)

    vote.decision = isFixedSlot
      ? fixedDecision
      : isSelectedProposal
        ? 'preferred'
        : 'rejected'
    vote.comment = isFixedSlot ? fixedComment : ''
    vote.availabilityException = hasSpecialRequest
    vote.specialRequestReason = sharedSpecialReason
    vote.specialRequestDate = sharedSpecialDate
    vote.priority = isSelectedProposal
      ? record.proposedSlotIds.indexOf(slotId) + 1
      : undefined
    vote.votedAt = record.submittedAt
    vote.magicLinkUsed = importKey
    await vote.save()
  }

  for (const slotId of record.proposedSlotIds) {
    if (existingVotesBySlotId.has(slotId)) {
      continue
    }

    const createdVote = new Vote({
      tpiPlanning: tpi._id,
      slot: slotId,
      voter: record.personId,
      voterRole: fixedVote.voterRole,
      decision: 'preferred',
      comment: '',
      availabilityException: hasSpecialRequest,
      specialRequestReason: sharedSpecialReason,
      specialRequestDate: sharedSpecialDate,
      priority: record.proposedSlotIds.indexOf(slotId) + 1,
      votedAt: record.submittedAt,
      magicLinkUsed: importKey
    })

    await createdVote.save()
  }

  const validation = await schedulingService.registerVoteAndCheckValidation(
    fixedVote._id,
    fixedDecision,
    fixedComment
  )

  return {
    imported: true,
    skipped: false,
    importKey,
    tpiId: record.tpiId,
    personId: record.personId,
    validation
  }
}

async function resolveStaticVoteSyncUrl(year, explicitRemoteUrl = '') {
  const configuredUrl = compactText(
    explicitRemoteUrl ||
    withPublicationYear(process.env.STATIC_VOTE_SYNC_URL || '', year)
  )

  if (configuredUrl) {
    return configuredUrl
  }

  return `${await getPublicUrl(year)}sync.php`
}

async function fetchStaticVoteRecords({ year, remoteUrl = '', syncSecret = '', fetchImpl = null } = {}) {
  const normalizedYear = parseYear(year)
  const resolvedSecret = compactText(syncSecret || getSyncSecret())
  if (!resolvedSecret) {
    const error = new Error('STATIC_VOTE_SYNC_SECRET requis pour synchroniser les votes.')
    error.statusCode = 409
    throw error
  }

  const resolvedUrl = await resolveStaticVoteSyncUrl(normalizedYear, remoteUrl)
  const httpFetch = fetchImpl || global.fetch

  if (typeof httpFetch !== 'function') {
    const error = new Error('fetch indisponible pour la synchronisation des votes.')
    error.statusCode = 500
    throw error
  }

  const response = await httpFetch(resolvedUrl, {
    headers: {
      'X-Sync-Secret': resolvedSecret,
      Accept: 'application/json'
    }
  })
  const body = await response.json().catch(() => null)

  if (!response.ok || !body?.success) {
    const error = new Error(body?.error || `Synchronisation distante refusee (${response.status}).`)
    error.statusCode = response.status || 502
    throw error
  }

  return {
    sourceUrl: resolvedUrl,
    records: Array.isArray(body.records) ? body.records : []
  }
}

async function syncStaticVoteResponses({ year, remoteUrl = '', syncSecret = '', fetchImpl = null } = {}) {
  const normalizedYear = parseYear(year)
  const remote = await fetchStaticVoteRecords({
    year: normalizedYear,
    remoteUrl,
    syncSecret,
    fetchImpl
  })

  const results = []
  let importedCount = 0
  let skippedCount = 0
  let failedCount = 0

  for (const record of remote.records) {
    try {
      const result = await importStaticVoteRecord(record, normalizedYear)
      results.push(result)

      if (result.imported) {
        importedCount += 1
      } else if (result.skipped) {
        skippedCount += 1
      } else {
        failedCount += 1
      }
    } catch (error) {
      failedCount += 1
      results.push({
        imported: false,
        skipped: false,
        reason: error?.message || 'import_failed'
      })
    }
  }

  return {
    success: failedCount === 0,
    year: normalizedYear,
    sourceUrl: remote.sourceUrl,
    receivedCount: remote.records.length,
    importedCount,
    skippedCount,
    failedCount,
    results
  }
}

module.exports = {
  STATIC_VOTE_BOOTSTRAP_PLACEHOLDER,
  buildStaticVoteCampaignPayload,
  buildStaticVoteHtml,
  buildStaticVoteHtaccess,
  buildStaticVotePhp,
  buildStaticVoteSyncPhp,
  buildStaticVoteUnavailableHtml,
  fetchStaticVoteRecords,
  generateStaticVotesSite,
  getIndexPath,
  getPublicUrl,
  getStaticVotePublicationStatus,
  getStaticVoteLinkTarget,
  importStaticVoteRecord,
  listStaticVoteAccessLinks,
  normalizeVotePublicPath,
  normalizeVoteRemoteDir,
  publishStaticVotesSite,
  syncStaticVoteResponses
}
