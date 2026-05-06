const crypto = require('crypto')
const fs = require('fs')
const net = require('net')
const path = require('path')
const { rootDir } = require('../config/loadEnv')
const { listPublishedSoutenances } = require('./publishedSoutenanceService')
const { MagicLink } = require('../models/magicLinkModel')
const Person = require('../models/personModel')
const { getSharedPublicationSettingsIfAvailable } = require('./coordinationCatalogService')
const { ACCESS_LINK_SOURCES } = require('../modules/accessLinks/constants')
const {
  getPublicationDeploymentConfigIfAvailable
} = require('./publicationDeploymentConfigService')
const {
  formatTpiStakeholderRoleLabel
} = require('../modules/stakeholders/stakeholderDefinitions')

const DEFAULT_OUTPUT_ROOT = path.resolve(rootDir, 'static-publication')
const DEFAULT_PUBLIC_BASE_URL = 'https://tpi26.ch'
const FTP_RESPONSE_TIMEOUT_MS = 15000
const DEFAULT_STATIC_PUBLIC_PATH_PREFIX = 'soutenances'
const STATIC_VOTE_LINK_CIPHER = 'aes-256-gcm'
const STATIC_VOTE_LINK_KEY_PREFIX = 'tpi-static-defense-linked-vote:'
const STATIC_MAGIC_LINK_BOOTSTRAP_PLACEHOLDER = '<!-- STATIC_MAGIC_LINK_BOOTSTRAP -->'
const STATIC_ROLE_LABELS = Object.freeze({
  candidat: formatTpiStakeholderRoleLabel('candidat'),
  expert1: formatTpiStakeholderRoleLabel('expert1'),
  expert2: formatTpiStakeholderRoleLabel('expert2'),
  chefProjet: formatTpiStakeholderRoleLabel('chef_projet')
})
const STATIC_SLOT_NAME_MAX_LENGTH = 24

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function parseYear(value) {
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    const error = new Error('Annee invalide pour la publication statique.')
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

function toIsoDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10)
  }

  const raw = compactText(value)
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : raw
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
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date)
}

function parsePositiveInteger(value, fallback = null) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseNonNegativeInteger(value, fallback = null) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function formatDecimalTime(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return ''
  }

  const totalMinutes = Math.round(numericValue * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function buildScheduleFromRoom(room) {
  const configSite = room?.configSite || {}
  const totalSlots = parsePositiveInteger(configSite.numSlots, 0)
  const tpiDuration = Number(configSite.tpiTime || 0)
  const breakDuration = Number(configSite.breakline || 0)
  let currentTime = Number(configSite.firstTpiStart || 0)

  if (totalSlots <= 0 || !Number.isFinite(tpiDuration) || tpiDuration <= 0) {
    return []
  }

  return Array.from({ length: totalSlots }, (_, index) => {
    const startTime = currentTime
    const endTime = currentTime + tpiDuration

    currentTime = index < totalSlots - 1
      ? endTime + (Number.isFinite(breakDuration) ? breakDuration : 0)
      : endTime

    return {
      startTime: formatDecimalTime(startTime),
      endTime: formatDecimalTime(endTime)
    }
  })
}

function getLegacyScheduleIndex(tpiData, fallbackIndex = 0) {
  const originalIndex = parseNonNegativeInteger(tpiData?.originalIndex, null)
  if (originalIndex !== null) {
    return originalIndex
  }

  const period = parsePositiveInteger(tpiData?.period, null)
  if (period !== null) {
    return period - 1
  }

  const idIndex = parseNonNegativeInteger(compactText(tpiData?.id).split('_').pop(), null)
  return idIndex === null ? fallbackIndex : idIndex
}

function getTimeRange(tpiData, schedule, fallbackIndex) {
  if (tpiData?.startTime && tpiData?.endTime) {
    return `${tpiData.startTime} - ${tpiData.endTime}`
  }

  const slotIndex = getLegacyScheduleIndex(tpiData, fallbackIndex)
  const slot = Array.isArray(schedule) ? schedule[slotIndex] : null

  if (slot?.startTime && slot?.endTime) {
    return `${slot.startTime} - ${slot.endTime}`
  }

  return ''
}

function normalizeRoomClass(room) {
  const value = compactText(room?.roomClassMode).toLowerCase()

  if (value === 'matu') {
    return 'MATU'
  }

  if (value === 'special') {
    return 'SPECIAL'
  }

  return ''
}

function flattenPublishedRooms(rooms) {
  const rows = []

  for (const room of Array.isArray(rooms) ? rooms : []) {
    const schedule = buildScheduleFromRoom(room)
    const tpiDatas = Array.isArray(room?.tpiDatas) ? room.tpiDatas : []

    tpiDatas.forEach((tpiData, index) => {
      const candidate = compactText(tpiData?.candidat)
      const refTpi = compactText(tpiData?.refTpi)
      const expert1 = compactText(tpiData?.expert1?.name)
      const expert2 = compactText(tpiData?.expert2?.name)
      const projectManager = compactText(tpiData?.boss?.name)

      if (!candidate && !refTpi && !expert1 && !expert2 && !projectManager) {
        return
      }

      rows.push({
        id: compactText(tpiData?.id) || `${compactText(room?.idRoom || room?._id)}-${index}`,
        refTpi,
        date: toIsoDate(room?.date),
        dateLabel: formatDateLabel(room?.date),
        site: compactText(room?.site),
        room: compactText(room?.name || room?.nameRoom),
        classType: normalizeRoomClass(room),
        time: getTimeRange(tpiData, schedule, index),
        candidate,
        expert1,
        expert2,
        projectManager,
        searchText: [
          refTpi,
          candidate,
          expert1,
          expert2,
          projectManager,
          compactText(room?.site),
          compactText(room?.name || room?.nameRoom),
          normalizeRoomClass(room)
        ].join(' ').toLowerCase()
      })
    })
  }

  return rows.sort((a, b) => (
    `${a.date}|${a.time}|${a.site}|${a.room}|${a.candidate}`
      .localeCompare(`${b.date}|${b.time}|${b.site}|${b.room}|${b.candidate}`, 'fr')
  ))
}

function getOutputRoot() {
  const configuredPath = compactText(process.env.STATIC_PUBLICATION_DIR)
  return configuredPath
    ? path.resolve(rootDir, configuredPath)
    : DEFAULT_OUTPUT_ROOT
}

function getOutputDir(year) {
  return path.join(getOutputRoot(), 'defenses', String(parseYear(year)))
}

function getManifestPath(year) {
  return path.join(getOutputDir(year), 'manifest.json')
}

function getIndexPath(year) {
  return path.join(getOutputDir(year), 'index.html')
}

function getPhpIndexPath(year) {
  return path.join(getOutputDir(year), 'index.php')
}

function getDeniedIndexPath(year) {
  return path.join(getOutputDir(year), 'index-denied.html')
}

function getPreviewPath(year) {
  return `/api/workflow/${parseYear(year)}/static-publication/preview`
}

function withPublicationYear(value, year) {
  return compactText(value).replace(/\{year\}/g, String(parseYear(year)))
}

function normalizeSlashPath(value) {
  const normalized = compactText(value)
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/\/+$/, '')

  if (!normalized || normalized === '.') {
    return '/'
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

function joinSlashPaths(basePath, childPath) {
  const normalizedBase = normalizeSlashPath(basePath)
  const normalizedChild = compactText(childPath)
    .replace(/\\/g, '/')
    .replace(/^\/+/g, '')
    .replace(/\/+$/g, '')

  if (!normalizedChild || normalizedChild === '.') {
    return normalizedBase
  }

  if (normalizedBase === '/') {
    return `/${normalizedChild}`
  }

  return `${normalizedBase}/${normalizedChild}`
}

function getDefaultStaticPublicPath(year) {
  return `/${DEFAULT_STATIC_PUBLIC_PATH_PREFIX}-${parseYear(year)}`
}

function derivePublicPathFromRemoteDir(remoteDir, year) {
  const normalizedRemoteDir = normalizeSlashPath(withPublicationYear(remoteDir, year))
  const publicRootMatch = normalizedRemoteDir.match(/\/(?:public_html|htdocs|www)(?:\/(.*))?$/i)

  if (publicRootMatch) {
    return normalizeSlashPath(publicRootMatch[1] || '/')
  }

  return normalizedRemoteDir
}

function normalizeStaticPublicPath(year, deploymentConfig = null) {
  const normalizedYear = parseYear(year)
  const configuredDeploymentPath = compactText(
    deploymentConfig?.defensePublicPath ||
    deploymentConfig?.publicPath
  )
  const configuredPublicPath = compactText(
    configuredDeploymentPath ||
    process.env.STATIC_DEFENSE_PUBLIC_PATH ||
    process.env.STATIC_DEFENSE_PUBLICATION_PUBLIC_PATH ||
    process.env.FTP_STATIC_DEFENSE_PUBLIC_PATH ||
    process.env.STATIC_SOUTENANCE_PUBLIC_PATH ||
    process.env.STATIC_SOUTENANCE_PUBLICATION_PUBLIC_PATH ||
    process.env.FTP_STATIC_SOUTENANCE_PUBLIC_PATH ||
    process.env.STATIC_PUBLIC_PATH ||
    process.env.STATIC_PUBLICATION_PUBLIC_PATH ||
    process.env.FTP_STATIC_PUBLIC_PATH
  )

  if (configuredPublicPath) {
    return normalizeSlashPath(withPublicationYear(configuredPublicPath, normalizedYear))
  }

  const configuredStaticRemoteDir = compactText(
    deploymentConfig?.defenseRemoteDir ||
    deploymentConfig?.staticRemoteDir ||
    process.env.FTP_STATIC_DEFENSE_REMOTE_DIR ||
    process.env.FTP_STATIC_SOUTENANCE_REMOTE_DIR ||
    process.env.FTP_STATIC_REMOTE_DIR
  )
  const configuredRemoteBaseDir = compactText(deploymentConfig?.remoteDir || process.env.FTP_REMOTE_DIR)

  if (configuredStaticRemoteDir && !configuredRemoteBaseDir) {
    return derivePublicPathFromRemoteDir(configuredStaticRemoteDir, normalizedYear)
  }

  return getDefaultStaticPublicPath(normalizedYear)
}

function normalizeRemoteDir(year, deploymentConfig = null) {
  const normalizedYear = parseYear(year)
  const remoteBaseDir = compactText(deploymentConfig?.remoteDir || process.env.FTP_REMOTE_DIR)
  const staticRemoteDir = compactText(
    deploymentConfig?.defenseRemoteDir ||
    deploymentConfig?.staticRemoteDir ||
    process.env.FTP_STATIC_DEFENSE_REMOTE_DIR ||
    process.env.FTP_STATIC_SOUTENANCE_REMOTE_DIR ||
    process.env.FTP_STATIC_REMOTE_DIR
  )
  const defaultStaticDir = `${DEFAULT_STATIC_PUBLIC_PATH_PREFIX}-${normalizedYear}`

  if (staticRemoteDir) {
    const configuredStaticDir = withPublicationYear(staticRemoteDir, normalizedYear)
    return remoteBaseDir && !configuredStaticDir.startsWith('/')
      ? joinSlashPaths(withPublicationYear(remoteBaseDir, normalizedYear), configuredStaticDir)
      : normalizeSlashPath(configuredStaticDir)
  }

  if (remoteBaseDir) {
    return joinSlashPaths(withPublicationYear(remoteBaseDir, normalizedYear), defaultStaticDir)
  }

  return normalizeSlashPath(defaultStaticDir)
}

function getRemoteDirCandidates(remoteDir) {
  const normalizedRemoteDir = normalizeSlashPath(remoteDir)
  const candidates = [normalizedRemoteDir]
  const withoutHomePrefix = normalizedRemoteDir.match(/^\/home\/[^/]+\/(.+)$/i)

  if (withoutHomePrefix) {
    candidates.push(normalizeSlashPath(withoutHomePrefix[1]))
  }

  return Array.from(new Set(candidates))
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

async function getConfiguredVotePublicBaseUrl(deploymentConfig = null) {
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
  const baseUrl = compactText(
    await getConfiguredPublicBaseUrl(deploymentConfig)
  ).replace(/\/+$/, '')
  const publicPath = normalizeStaticPublicPath(year, deploymentConfig)

  return `${baseUrl}${publicPath === '/' ? '/' : `${publicPath}/`}`
}

function loadSoutenanceCss() {
  const cssPath = path.resolve(rootDir, 'src/css/tpiSoutenance/tpiSoutenance.css')

  try {
    return fs.readFileSync(cssPath, 'utf8')
  } catch (error) {
    return ''
  }
}

function normalizeSoutenanceColor(value) {
  const hex = compactText(value).replace(/^#/, '')

  if (/^[\da-fA-F]{3}$/.test(hex)) {
    return `#${hex
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toUpperCase()}`
  }

  if (/^[\da-fA-F]{6}$/.test(hex)) {
    return `#${hex.toUpperCase()}`
  }

  return ''
}

function normalizeOptionalSoutenanceColor(source = {}) {
  const sourceObject = source && typeof source === 'object' ? source : {}
  const keys = ['soutenanceColor', 'defenseColor', 'defenceColor']

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(sourceObject, key)) {
      return normalizeSoutenanceColor(sourceObject[key])
    }
  }

  return ''
}

function hexToRgba(color, alpha = 1) {
  const normalizedColor = normalizeSoutenanceColor(color)

  if (!normalizedColor) {
    return `rgba(71, 85, 105, ${alpha})`
  }

  const hex = normalizedColor.slice(1)
  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function getRoomClassFilterValue(room) {
  const roomClassMode = compactText(room?.roomClassMode).toLowerCase()

  if (roomClassMode === 'matu') {
    return 'matu'
  }

  if (roomClassMode === 'special') {
    return 'special'
  }

  return 'noBadge'
}

function getRoomClassBadgeClass(roomClassLabel) {
  const normalizedLabel = compactText(roomClassLabel).toLowerCase()

  if (normalizedLabel === 'matu') {
    return 'is-matu'
  }

  if (normalizedLabel === 'special') {
    return 'is-special'
  }

  return ''
}

function normalizeRoomClassModeValue(value) {
  const normalizedValue = compactText(value).toLowerCase()

  if (normalizedValue === 'matu') {
    return 'matu'
  }

  if (normalizedValue === 'special') {
    return 'special'
  }

  return ''
}

function buildStaticRoomStyle(room) {
  const color = normalizeOptionalSoutenanceColor(room?.configSite)

  if (!color) {
    return {}
  }

  return {
    '--soutenance-room-accent': color,
    '--soutenance-room-accent-soft': hexToRgba(color, 0.22),
    '--soutenance-room-accent-faint': hexToRgba(color, 0.08)
  }
}

function normalizeStaticRooms(rooms = []) {
  return (Array.isArray(rooms) ? rooms : []).map((room) => {
    const classLabel = normalizeRoomClass(room)
    const roomStyle = buildStaticRoomStyle(room)
    const tpiDatas = (Array.isArray(room?.tpiDatas) ? room.tpiDatas : [])
      .map((tpiData, index) => ({
        ...tpiData,
        originalIndex: getLegacyScheduleIndex(tpiData, index)
      }))

    return {
      ...room,
      tpiDatas,
      _static: {
        dateLabel: formatDateLabel(room?.date),
        classLabel,
        classBadgeClass: getRoomClassBadgeClass(classLabel),
        classFilterValue: getRoomClassFilterValue(room),
        roomClassName: Object.keys(roomStyle).length > 0 ? 'has-soutenance-color' : '',
        roomStyle
      }
    }
  })
}

function rowsToRooms(rows = []) {
  const roomsByKey = new Map()

  for (const row of Array.isArray(rows) ? rows : []) {
    const key = `${row.date || ''}|${row.site || ''}|${row.room || ''}`
    if (!roomsByKey.has(key)) {
      roomsByKey.set(key, {
        idRoom: key,
        site: row.site || '',
        name: row.room || '',
        date: row.date || '',
        roomClassMode: normalizeRoomClassModeValue(row.classType),
        configSite: {},
        tpiDatas: []
      })
    }

    roomsByKey.get(key).tpiDatas.push({
      id: row.id || `${key}-${roomsByKey.get(key).tpiDatas.length}`,
      refTpi: row.refTpi || '',
      candidat: row.candidate || '',
      expert1: { name: row.expert1 || '' },
      expert2: { name: row.expert2 || '' },
      boss: { name: row.projectManager || '' },
      startTime: String(row.time || '').split(' - ')[0] || '',
      endTime: String(row.time || '').split(' - ')[1] || ''
    })
  }

  return Array.from(roomsByKey.values())
}

function buildStaticSoutenanceCss() {
  return `${loadSoutenanceCss()}

:root {
  --app-page-width: 1840px;
  --app-ui-font-family: "Trebuchet MS", "Segoe UI", Arial, sans-serif;
  --app-border: #dbe4ee;
  --app-border-soft: #dce9ff;
  --app-surface: #ffffff;
  --app-text-main: #0f172a;
  --app-text-muted: #4b5563;
  --app-shadow-card: 0 10px 24px rgba(15, 23, 42, 0.08);
  --room-padding-top: 0px;
}

body {
  margin: 0;
  background: #f5f7fb;
}

.tpi-soutenance-page.static-soutenance-page {
  padding-top: var(--soutenance-space-3);
}

.static-soutenance-page .soutenance-toolbar-hero-content {
  max-width: min(100%, 860px);
}

.static-soutenance-page .static-hero-pdf-action {
  min-width: 56px;
  min-height: 34px;
  width: auto;
  height: 36px;
  padding: 0 12px;
  border: 2px solid rgba(248, 250, 252, 0.86);
  border-radius: 999px;
  background: #ffffff;
  color: #1d4ed8;
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.22);
  cursor: pointer;
}

.static-soutenance-page .static-hero-pdf-action:hover {
  background: #ffffff;
  filter: brightness(0.96);
  transform: translateY(-1px);
}

.static-soutenance-page .static-role-letter {
  font-size: 0.68rem;
  font-weight: 900;
  line-height: 1;
  color: var(--stakeholder-icon-stroke);
}

.static-soutenance-page .soutenance-filter-actions {
  min-width: 0;
}

.static-soutenance-page .static-filter-result {
  color: #64748b;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.static-soutenance-page .static-admin-filters {
  padding: var(--soutenance-space-2);
}

.static-soutenance-page .static-admin-filters .soutenance-toolbar-filters {
  justify-content: flex-start;
}

.static-soutenance-page .static-admin-view-toggle {
  border-color: #1d4ed8;
  background: #1d4ed8;
  color: #ffffff;
}

.static-soutenance-page .static-admin-view-toggle[aria-pressed="true"] {
  border-color: #0f766e;
  background: #0f766e;
}

.static-soutenance-page .static-hidden {
  display: none !important;
}

.static-soutenance-page .static-print-schedule {
  display: none;
}

@media print {
  body {
    background: #ffffff;
  }

  .tpi-soutenance-page.static-soutenance-page {
    max-width: none;
    padding: 0;
  }

  .static-soutenance-page .soutenance-toolbar,
  .static-soutenance-page #focus-banner,
  .static-soutenance-page #soutenances,
  .static-soutenance-page #static-person-ical {
    display: none !important;
  }

  .static-soutenance-page .static-print-schedule {
    display: block !important;
    color: #111827;
    font-family: Arial, Helvetica, sans-serif;
  }

  .static-soutenance-page .static-print-title {
    margin: 0 0 3mm;
    color: #111827;
    font-size: 15pt;
    line-height: 1.2;
  }

  .static-soutenance-page .static-print-meta {
    margin: 0 0 5mm;
    color: #4b5563;
    font-size: 9pt;
  }

  .static-soutenance-page .static-print-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
  }

  .static-soutenance-page .static-print-table th,
  .static-soutenance-page .static-print-table td {
    padding: 2.4mm 2mm;
    border: 1px solid #d1d5db;
    text-align: left;
    vertical-align: top;
  }

  .static-soutenance-page .static-print-table th {
    background: #f3f4f6;
    color: #111827;
    font-weight: 700;
  }

  .static-soutenance-page .static-print-table tr {
    break-inside: avoid;
  }

  .static-soutenance-page .static-print-time {
    white-space: nowrap;
    font-weight: 700;
  }

  .static-soutenance-page .static-print-location strong,
  .static-soutenance-page .static-print-location span {
    display: block;
  }

  .static-soutenance-page .static-print-location span {
    color: #4b5563;
    font-size: 8pt;
  }

  .static-soutenance-page .static-print-empty {
    margin: 0;
    color: #4b5563;
    font-size: 10pt;
  }
}

`
}

function buildStaticDefenseHtml({ year, generatedAt, rooms = [], rows = [] }) {
  const normalizedYear = parseYear(year)
  const normalizedRooms = normalizeStaticRooms(
    Array.isArray(rooms) && rooms.length > 0 ? rooms : rowsToRooms(rows)
  )
  const payload = {
    year: normalizedYear,
    generatedAt,
    rooms: normalizedRooms
  }
  const css = buildStaticSoutenanceCss()

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Défenses ${escapeHtml(normalizedYear)}</title>
  <style>${css}</style>
</head>
<body>
  <div class="tpi-soutenance-page static-soutenance-page">
    <header class="soutenance-toolbar">
      <div class="soutenance-toolbar-head soutenance-toolbar-hero has-fullscreen-action">
        <div class="soutenance-toolbar-hero-content">
          <div class="title">Défenses ${escapeHtml(normalizedYear)}</div>
          <p class="soutenance-toolbar-greeting">Version statique publiée pour consultation.</p>
          <span class="static-filter-result" id="result-count"></span>
        </div>
        <button
          type="button"
          class="soutenance-hero-fullscreen-action static-hero-pdf-action"
          id="static-print"
          title="Imprimer la page"
          aria-label="Imprimer la page"
        >PDF</button>
      </div>
    </header>

    <section
      class="soutenance-toolbar static-admin-filters static-hidden"
      id="static-admin-filters"
      aria-label="Filtres de la vue générale admin"
    >
      <div class="soutenance-toolbar-filters">
        <label class="soutenance-filter-block">
          <select
            id="static-admin-filter-date"
            aria-label="Filtrer la vue admin par date"
            disabled
          >
            <option value="">Date</option>
          </select>
        </label>
        <label class="soutenance-filter-block">
          <select
            id="static-admin-filter-class-type"
            aria-label="Filtrer la vue admin par type de classe"
            disabled
          >
            <option value="">Type</option>
            <option value="matu">MATU</option>
            <option value="special">SPECIAL</option>
            <option value="noBadge">Sans badge</option>
          </select>
        </label>
      </div>
    </section>

    <section class="soutenance-focus-banner static-hidden" id="focus-banner">
      <div>
        <strong id="focus-title"></strong>
        <p id="focus-text"></p>
      </div>
    </section>

    <div id="soutenances" class="soutenances">
      <section class="soutenance-main-area">
        <div class="soutenance-empty-state static-hidden" id="empty-state">
          <strong>Aucune défense à afficher.</strong>
          <p>Aucun résultat pour ces filtres.</p>
        </div>
        <div
          id="rooms"
          class="salles-container"
          role="list"
          aria-label="Liste des salles"
          style="--soutenance-grid-columns: 4;"
        ></div>
      </section>
    </div>

    <section
      class="static-print-schedule"
      id="static-print-schedule"
      aria-label="Horaires à imprimer"
    ></section>

    <section class="soutenance-person-ical static-hidden" id="static-person-ical">
      <p id="static-person-actions-copy">Télécharger votre iCal pour insérer vos défenses dans votre agenda Outlook.</p>
      <div class="soutenance-person-ical-actions">
        <button
          type="button"
          class="soutenance-person-ical-button"
          id="static-person-ical-download"
          aria-label="Télécharger votre iCal Outlook"
          disabled
        >
          <span id="static-person-ical-label">Télécharger votre iCal</span>
        </button>
        <a
          class="soutenance-person-vote-button static-hidden"
          id="static-person-vote-link"
          href="#"
          target="_blank"
          rel="noopener noreferrer"
        >Demander une modification</a>
        <button
          type="button"
          class="soutenance-person-ical-button static-admin-view-toggle static-hidden"
          id="static-admin-view-toggle"
          aria-label="Afficher la vue générale administrateur"
          aria-pressed="false"
          disabled
        >Vue générale admin</button>
      </div>
    </section>
  </div>

  <script id="defense-data" type="application/json">${serializeJsonForHtml(payload)}</script>
  ${STATIC_MAGIC_LINK_BOOTSTRAP_PLACEHOLDER}
  <script>
    (function () {
      var payload = JSON.parse(document.getElementById('defense-data').textContent);
      var rooms = Array.isArray(payload.rooms) ? payload.rooms : [];
      var queryParams = new URLSearchParams(window.location.search);
      var magicLinkToken = (queryParams.get('ml') || '').trim();
      var serverMagicLinkValidated = window.__STATIC_MAGIC_LINK_VALIDATED__ === true;
      var serverMagicLinkViewer = window.__STATIC_MAGIC_LINK_VIEWER__ || null;
      var magicLinkViewer = serverMagicLinkViewer;
      var magicLinkPending = Boolean(magicLinkToken && !serverMagicLinkValidated);
      var magicLinkError = '';
      var roomsNode = document.getElementById('rooms');
      var emptyNode = document.getElementById('empty-state');
      var resultCount = document.getElementById('result-count');
      var soutenances = document.getElementById('soutenances');
      var focusBanner = document.getElementById('focus-banner');
      var focusTitle = document.getElementById('focus-title');
      var focusText = document.getElementById('focus-text');
      var personIcalNode = document.getElementById('static-person-ical');
      var personIcalButton = document.getElementById('static-person-ical-download');
      var personIcalLabel = document.getElementById('static-person-ical-label');
      var personActionsCopy = document.getElementById('static-person-actions-copy');
      var personVoteLink = document.getElementById('static-person-vote-link');
      var adminViewToggle = document.getElementById('static-admin-view-toggle');
      var adminFiltersNode = document.getElementById('static-admin-filters');
      var adminDateFilter = document.getElementById('static-admin-filter-date');
      var adminClassTypeFilter = document.getElementById('static-admin-filter-class-type');
      var printScheduleNode = document.getElementById('static-print-schedule');
      var SLOT_NAME_MAX_LENGTH = ${STATIC_SLOT_NAME_MAX_LENGTH};
      var currentPersonIcalEvents = [];
      var adminGeneralView = false;
      var filters = {
        site: '',
        date: '',
        reference: '',
        candidate: '',
        experts: '',
        projectManagerButton: '',
        projectManager: '',
        classType: '',
        nameRoom: ''
      };

      function normalizeText(value) {
        return String(value || '').toLowerCase();
      }

      function html(value) {
        return String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function truncateSlotName(value) {
        var text = String(value || '');
        if (text.length <= SLOT_NAME_MAX_LENGTH) {
          return {
            text: text,
            isTruncated: false
          };
        }

        return {
          text: text.substring(0, SLOT_NAME_MAX_LENGTH - 3) + '...',
          isTruncated: true
        };
      }

      function renderSlotName(value) {
        var originalText = String(value || '');
        var truncated = truncateSlotName(originalText);
        var className = truncated.isTruncated ? 'truncated-text' : 'nameTpi';
        var title = truncated.isTruncated ? ' title="' + html(originalText) + '"' : '';

        return '<span class="' + className + '"' + title + '>' + html(truncated.text) + '</span>';
      }

      function normalizeReference(value) {
        return normalizeText(value).replace(/^tpi-\\d{4}-/i, '');
      }

      function matchesReferenceFilter(filterValue, reference) {
        var normalizedFilter = normalizeReference(filterValue);
        var normalizedReference = normalizeReference(reference);
        var rawFilter = normalizeText(filterValue);
        var rawReference = normalizeText(reference);
        return Boolean(normalizedFilter && normalizedReference && (
          normalizedFilter === normalizedReference || rawFilter === rawReference
        ));
      }

      function isAdminViewer(viewer) {
        if (!viewer) {
          return false;
        }

        if (viewer.isAdmin === true) {
          return true;
        }

        var roles = Array.isArray(viewer.roles) ? viewer.roles : [];
        return roles.some(function (role) {
          return String(role || '').trim().toLowerCase() === 'admin';
        });
      }

      function isAdminGeneralViewActive() {
        return Boolean(adminGeneralView && isAdminViewer(magicLinkViewer));
      }

      function getEffectiveFilters() {
        if (!isAdminGeneralViewActive()) {
          return filters;
        }

        return {
          site: '',
          date: filters.date,
          reference: '',
          candidate: '',
          experts: '',
          projectManagerButton: '',
          projectManager: '',
          classType: filters.classType,
          nameRoom: ''
        };
      }

      function getUniqueAdminDateOptions() {
        var seen = new Set();
        return rooms.reduce(function (options, room) {
          var label = (room._static && room._static.dateLabel) || room.date || '';
          if (!label || seen.has(label)) {
            return options;
          }

          seen.add(label);
          options.push(label);
          return options;
        }, []);
      }

      function populateAdminFilters() {
        if (adminDateFilter) {
          adminDateFilter.innerHTML = '<option value="">Date</option>' + getUniqueAdminDateOptions()
            .map(function (date) {
              return '<option value="' + html(date) + '">' + html(date) + '</option>';
            })
            .join('');
        }
      }

      function setSelectValue(select, value) {
        if (!select) {
          return;
        }

        select.value = value || '';
        if (select.value !== (value || '')) {
          select.value = '';
        }
      }

      function updateFilterQueryParam(name, value) {
        if (!window.history || typeof window.history.replaceState !== 'function') {
          return;
        }

        var nextUrl = new URL(window.location.href);
        if (value) {
          nextUrl.searchParams.set(name, value);
        } else {
          nextUrl.searchParams.delete(name);
        }
        queryParams = new URLSearchParams(nextUrl.search);
        window.history.replaceState({}, '', nextUrl.toString());
      }

      function syncAdminFilters() {
        var isGeneralView = isAdminGeneralViewActive();

        if (adminFiltersNode) {
          adminFiltersNode.classList.toggle('static-hidden', !isGeneralView);
        }

        if (adminDateFilter) {
          adminDateFilter.disabled = !isGeneralView;
          setSelectValue(adminDateFilter, filters.date);
        }

        if (adminClassTypeFilter) {
          adminClassTypeFilter.disabled = !isGeneralView;
          setSelectValue(adminClassTypeFilter, filters.classType);
        }
      }

      function getRoomSlots(room) {
        var schedule = buildSchedule(room);
        var tpiDatas = Array.isArray(room.tpiDatas) ? room.tpiDatas : [];
        var configuredSlots = parsePositiveInteger(room.configSite && room.configSite.numSlots, 0);
        var maxTpiIndex = tpiDatas.reduce(function (maxIndex, tpiData, index) {
          return Math.max(maxIndex, getLegacyScheduleIndex(tpiData, index));
        }, -1);
        var slotCount = Math.max(configuredSlots, schedule.length, tpiDatas.length, maxTpiIndex + 1, 0);
        var slots = Array.from({ length: slotCount }, function (_, index) {
          return {
            index: index,
            tpiData: null,
            displayedSlot: schedule[index] || { startTime: '', endTime: '' }
          };
        });

        tpiDatas.forEach(function (tpiData, fallbackIndex) {
          var slotIndex = getLegacyScheduleIndex(tpiData, fallbackIndex);
          if (slotIndex < 0 || slotIndex >= slots.length) {
            return;
          }

          slots[slotIndex] = {
            index: slotIndex,
            tpiData: tpiData,
            displayedSlot: getDisplayedSlot(tpiData, schedule, slotIndex)
          };
        });

        return slots;
      }

      function parsePositiveInteger(value, fallback) {
        var parsed = Number.parseInt(String(value), 10);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
      }

      function parseNonNegativeInteger(value, fallback) {
        var parsed = Number.parseInt(String(value), 10);
        return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
      }

      function decimalTime(value) {
        var numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
          return '';
        }
        var totalMinutes = Math.round(numericValue * 60);
        var hours = Math.floor(totalMinutes / 60);
        var minutes = totalMinutes % 60;
        return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
      }

      function buildSchedule(room) {
        var configSite = room.configSite || {};
        var totalSlots = parsePositiveInteger(configSite.numSlots, 0);
        var breakDuration = Number(configSite.breakline || 0);
        var slotDuration = Number(configSite.tpiTime || 0);
        var currentTime = Number(configSite.firstTpiStart || 0);
        if (totalSlots <= 0 || !Number.isFinite(slotDuration) || slotDuration <= 0) {
          return [];
        }
        return Array.from({ length: totalSlots }, function (_, index) {
          var startTime = currentTime;
          var endTime = currentTime + slotDuration;
          currentTime = index < totalSlots - 1 ? endTime + (Number.isFinite(breakDuration) ? breakDuration : 0) : endTime;
          return { startTime: decimalTime(startTime), endTime: decimalTime(endTime) };
        });
      }

      function getLegacyScheduleIndex(tpiData, fallbackIndex) {
        var originalIndex = parseNonNegativeInteger(tpiData && tpiData.originalIndex, null);
        if (originalIndex !== null) return originalIndex;
        var period = parsePositiveInteger(tpiData && tpiData.period, null);
        if (period !== null) return period - 1;
        var idIndex = parseNonNegativeInteger(String((tpiData && tpiData.id) || '').split('_').pop(), null);
        return idIndex === null ? fallbackIndex : idIndex;
      }

      function getDisplayedSlot(tpiData, schedule, fallbackIndex) {
        if (tpiData && tpiData.startTime && tpiData.endTime) {
          return { startTime: tpiData.startTime, endTime: tpiData.endTime };
        }
        return schedule[getLegacyScheduleIndex(tpiData, fallbackIndex)] || { startTime: '', endTime: '' };
      }

      function formatTimeRange(startTime, endTime) {
        return startTime && endTime ? startTime + ' - ' + endTime : 'Horaire indisponible';
      }

      function shouldShowEmptySlots() {
        if ((magicLinkViewer && !isAdminGeneralViewActive()) || magicLinkPending || magicLinkError) {
          return false;
        }

        var effectiveFilters = getEffectiveFilters();
        var activeKeys = Object.keys(effectiveFilters).filter(function (key) {
          return effectiveFilters[key];
        });
        var structural = new Set(['date', 'nameRoom', 'classType']);
        return activeKeys.length === 0 || activeKeys.every(function (key) {
          return structural.has(key);
        });
      }

      function roomMatches(room) {
        var effectiveFilters = getEffectiveFilters();
        if (effectiveFilters.classType && ((room._static && room._static.classFilterValue) || 'noBadge') !== effectiveFilters.classType) return false;
        if (effectiveFilters.nameRoom && room.name !== effectiveFilters.nameRoom) return false;
        if (effectiveFilters.site && room.site !== effectiveFilters.site) return false;
        if (effectiveFilters.date && ((room._static && room._static.dateLabel) !== effectiveFilters.date && room.date !== effectiveFilters.date)) return false;
        return true;
      }

      function doesTpiMatchViewer(tpi, viewer) {
        if (!viewer || (!viewer.personId && !viewer.name)) return true;
        var participantIds = [
          tpi.candidatPersonId,
          tpi.expert1 && tpi.expert1.personId,
          tpi.expert2 && tpi.expert2.personId,
          tpi.boss && tpi.boss.personId
        ].filter(Boolean).map(String);
        if (viewer.personId && participantIds.indexOf(String(viewer.personId)) >= 0) return true;
        var viewerName = normalizeText(viewer.name);
        if (!viewerName) return false;
        return [
          tpi.candidat,
          tpi.expert1 && tpi.expert1.name,
          tpi.expert2 && tpi.expert2.name,
          tpi.boss && tpi.boss.name
        ].some(function (name) {
          return normalizeText(name).includes(viewerName);
        });
      }

      function tpiMatches(tpi) {
        var effectiveFilters = getEffectiveFilters();
        if (!tpi) return false;
        if (magicLinkPending || magicLinkError) return false;
        if (!isAdminGeneralViewActive() && !doesTpiMatchViewer(tpi, magicLinkViewer)) return false;
        if (effectiveFilters.reference && !matchesReferenceFilter(effectiveFilters.reference, tpi.refTpi)) return false;
        if (effectiveFilters.candidate && !normalizeText(tpi.candidat).includes(normalizeText(effectiveFilters.candidate))) return false;
        if (effectiveFilters.experts && !(
          normalizeText(tpi.expert1 && tpi.expert1.name).includes(normalizeText(effectiveFilters.experts)) ||
          normalizeText(tpi.expert2 && tpi.expert2.name).includes(normalizeText(effectiveFilters.experts))
        )) return false;
        if (effectiveFilters.projectManager && !normalizeText(tpi.boss && tpi.boss.name).includes(normalizeText(effectiveFilters.projectManager))) return false;
        if (effectiveFilters.projectManagerButton && !(
          normalizeText(tpi.expert1 && tpi.expert1.name).includes(normalizeText(effectiveFilters.projectManagerButton)) ||
          normalizeText(tpi.expert2 && tpi.expert2.name).includes(normalizeText(effectiveFilters.projectManagerButton)) ||
          normalizeText(tpi.boss && tpi.boss.name).includes(normalizeText(effectiveFilters.projectManagerButton))
        )) return false;
        return true;
      }

      function getFilteredRooms() {
        return rooms.flatMap(function (room) {
          if (!roomMatches(room)) return [];
          var tpis = (Array.isArray(room.tpiDatas) ? room.tpiDatas : []).filter(tpiMatches);
          if (tpis.length === 0) return [];
          return Object.assign({}, room, { tpiDatas: tpis });
        });
      }

      function getMagicLinkViewerRooms() {
        if (!magicLinkViewer || (!magicLinkViewer.personId && !magicLinkViewer.name)) {
          return [];
        }

        return rooms.flatMap(function (room) {
          var tpis = (Array.isArray(room.tpiDatas) ? room.tpiDatas : []).filter(function (tpi) {
            return tpi && tpi.refTpi && doesTpiMatchViewer(tpi, magicLinkViewer);
          });

          return tpis.length > 0 ? [Object.assign({}, room, { tpiDatas: tpis })] : [];
        });
      }

      function escapeIcsText(value) {
        var slash = String.fromCharCode(92);
        return String(value || '')
          .split(slash).join(slash + slash)
          .split(String.fromCharCode(13)).join(slash + 'n')
          .split(String.fromCharCode(10)).join(slash + 'n')
          .split(',').join(slash + ',')
          .split(';').join(slash + ';');
      }

      function buildICalDate(dateValue) {
        var parsedDate = new Date(dateValue);
        if (Number.isNaN(parsedDate.getTime())) {
          return '';
        }

        return parsedDate.toISOString().slice(0, 10).replace(/-/g, '');
      }

      function buildICalDateTime(dateValue, timeValue) {
        var datePart = buildICalDate(dateValue);
        var parts = String(timeValue || '').split(':');
        if (!datePart || parts.length < 2 || !parts[0] || !parts[1]) {
          return '';
        }

        return datePart + 'T' + parts[0].padStart(2, '0') + parts[1].padStart(2, '0') + '00';
      }

      function buildIcalEvent(entry, dtStamp, index) {
        var room = entry.salle || {};
        var tpi = entry.tpi || {};
        var start = buildICalDateTime(room.date, entry.startTime);
        var end = buildICalDateTime(room.date, entry.endTime);

        if (!start || !end) {
          return null;
        }

        var eventUid = [payload.year, tpi.refTpi || 'tpi', tpi.id || room.idRoom || room.name || 'room', index].join('-');
        var eventSummary = 'Défense TPI ' + (tpi.refTpi || 'sans-référence') + ' - ' + (tpi.candidat || '');
        var eventDescription = [
          'Défense de TPI ' + (tpi.candidat || ''),
          ${JSON.stringify(STATIC_ROLE_LABELS.expert1)} + ': ' + ((tpi.expert1 && tpi.expert1.name) || ''),
          ${JSON.stringify(STATIC_ROLE_LABELS.expert2)} + ': ' + ((tpi.expert2 && tpi.expert2.name) || ''),
          ${JSON.stringify(STATIC_ROLE_LABELS.chefProjet)} + ': ' + ((tpi.boss && tpi.boss.name) || '')
        ].join(String.fromCharCode(10));
        var location = [room.site, room.name].filter(Boolean).join(' - ');

        return [
          'BEGIN:VEVENT',
          'DTSTAMP:' + dtStamp,
          'UID:' + escapeIcsText(eventUid),
          'DTSTART;TZID=Europe/Berlin:' + start,
          'DTEND;TZID=Europe/Berlin:' + end,
          'SUMMARY:' + escapeIcsText(eventSummary),
          'DESCRIPTION:' + escapeIcsText(eventDescription),
          'LOCATION:' + escapeIcsText(location),
          'TRANSP:TRANSPARENT',
          'CLASS:PUBLIC',
          'END:VEVENT'
        ].join(String.fromCharCode(10));
      }

      function buildIcalContent(events) {
        var dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\\.\\d{3}Z/g, 'Z');
        var lines = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//tpiOrganizer2023//iCal',
          'BEGIN:VTIMEZONE',
          'TZID:Europe/Berlin',
          'BEGIN:DAYLIGHT',
          'TZOFFSETFROM:+0100',
          'TZOFFSETTO:+0200',
          'DTSTART:19700329T020000',
          'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
          'END:DAYLIGHT',
          'BEGIN:STANDARD',
          'TZOFFSETFROM:+0200',
          'TZOFFSETTO:+0100',
          'DTSTART:19701025T030000',
          'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
          'END:STANDARD',
          'END:VTIMEZONE'
        ];

        events.forEach(function (event, index) {
          var eventBlock = buildIcalEvent(event, dtStamp, index);
          if (eventBlock) {
            lines.push(eventBlock);
          }
        });

        lines.push('END:VCALENDAR');
        return lines.join(String.fromCharCode(10));
      }

      function collectIcalEvents(sourceRooms) {
        return sourceRooms.flatMap(function (room) {
          return getRoomSlots(room)
            .filter(function (slot) {
              return Boolean(slot.tpiData && slot.tpiData.refTpi);
            })
            .map(function (slot) {
              var displayedSlot = slot.displayedSlot || getDisplayedSlot(slot.tpiData, buildSchedule(room), slot.index);
              return {
                salle: room,
                tpi: slot.tpiData,
                startTime: displayedSlot.startTime,
                endTime: displayedSlot.endTime
              };
            })
            .filter(function (entry) {
              return Boolean(entry.startTime && entry.endTime);
            });
        });
      }

      function sanitizeFileName(value) {
        return String(value || 'soutenances')
          .normalize('NFD')
          .replace(/[\\u0300-\\u036f]/g, '')
          .replace(/[^\\w.-]+/g, '_')
          .replace(/^_+|_+$/g, '');
      }

      function downloadPersonIcal() {
        if (currentPersonIcalEvents.length === 0) {
          return;
        }

        var icalContent = buildIcalContent(currentPersonIcalEvents);
        var blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var anchor = document.createElement('a');
        var baseName = magicLinkViewer && magicLinkViewer.name ? magicLinkViewer.name : 'soutenances';

        anchor.href = url;
        anchor.download = sanitizeFileName(baseName) + '_soutenances.ics';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      }

      function updateAdminViewQueryParam() {
        if (!window.history || typeof window.history.replaceState !== 'function') {
          return;
        }

        var nextUrl = new URL(window.location.href);
        if (isAdminGeneralViewActive()) {
          nextUrl.searchParams.set('view', 'admin');
          nextUrl.searchParams.delete('mode');
          nextUrl.searchParams.delete('admin');
          nextUrl.searchParams.delete('adminView');
        } else {
          nextUrl.searchParams.delete('view');
          nextUrl.searchParams.delete('mode');
          nextUrl.searchParams.delete('admin');
          nextUrl.searchParams.delete('adminView');
        }

        queryParams = new URLSearchParams(nextUrl.search);
        window.history.replaceState({}, '', nextUrl.toString());
      }

      function setAdminGeneralView(nextValue) {
        adminGeneralView = Boolean(nextValue && isAdminViewer(magicLinkViewer));
        updateAdminViewQueryParam();
        render();
      }

      function syncAdminViewToggle() {
        if (!adminViewToggle) {
          return;
        }

        var hasAdminAccess = isAdminViewer(magicLinkViewer);
        var isGeneralView = isAdminGeneralViewActive();

        adminViewToggle.classList.toggle('static-hidden', !hasAdminAccess);
        adminViewToggle.disabled = !hasAdminAccess;
        adminViewToggle.setAttribute('aria-pressed', isGeneralView ? 'true' : 'false');
        adminViewToggle.textContent = isGeneralView ? 'Vue personnelle' : 'Vue générale admin';
        adminViewToggle.setAttribute(
          'aria-label',
          isGeneralView
            ? 'Revenir à votre vue personnelle'
            : 'Afficher la vue générale administrateur'
        );
        adminViewToggle.title = isGeneralView
          ? 'Revenir à votre vue personnelle'
          : 'Afficher toutes les défenses; seuls date et type de classe restent pris en compte.';
      }

      function syncPersonIcal() {
        var personRooms = getMagicLinkViewerRooms();
        currentPersonIcalEvents = collectIcalEvents(personRooms);
        var hasIcalEvents = currentPersonIcalEvents.length > 0;
        var voteAccessUrl = magicLinkViewer && magicLinkViewer.voteAccessUrl ? String(magicLinkViewer.voteAccessUrl) : '';
        var hasVoteAccess = Boolean(voteAccessUrl);
        var hasAdminAccess = isAdminViewer(magicLinkViewer);
        var shouldShow = Boolean(magicLinkViewer && (hasIcalEvents || hasVoteAccess || hasAdminAccess));

        personIcalNode.classList.toggle('static-hidden', !shouldShow);
        personIcalButton.disabled = !hasIcalEvents;
        personIcalButton.classList.toggle('static-hidden', !hasIcalEvents);
        personVoteLink.classList.toggle('static-hidden', !hasVoteAccess);
        syncAdminViewToggle();

        if (hasVoteAccess) {
          personVoteLink.href = voteAccessUrl;
          personVoteLink.setAttribute(
            'aria-label',
            'Demander une modification de créneau pour ' + (magicLinkViewer.name || 'vos défenses')
          );
        } else {
          personVoteLink.href = '#';
        }

        if (personActionsCopy) {
          personActionsCopy.textContent = hasAdminAccess
            ? (isAdminGeneralViewActive()
              ? 'Vue générale active. Vous pouvez revenir à votre vue personnelle.'
              : 'Votre lien administrateur permet aussi d afficher la vue générale.')
            : hasVoteAccess
              ? 'Télécharger votre iCal ou demander une modification de créneau.'
              : 'Télécharger votre iCal pour insérer vos défenses dans votre agenda Outlook.';
        }

        if (hasIcalEvents) {
          personIcalButton.setAttribute(
            'aria-label',
            'Télécharger votre iCal Outlook pour ' + (magicLinkViewer.name || 'vos défenses')
          );
          personIcalLabel.textContent = 'Télécharger votre iCal (' + currentPersonIcalEvents.length + ')';
        }
      }

      function collectPrintRows(sourceRooms) {
        return sourceRooms.flatMap(function (room) {
          return getRoomSlots(room)
            .filter(function (slot) {
              return Boolean(slot.tpiData && slot.tpiData.refTpi);
            })
            .map(function (slot) {
              var displayedSlot = slot.displayedSlot || getDisplayedSlot(slot.tpiData, buildSchedule(room), slot.index);
              var tpi = slot.tpiData || {};
              return {
                date: (room._static && room._static.dateLabel) || room.date || '',
                time: formatTimeRange(displayedSlot.startTime, displayedSlot.endTime),
                site: room.site || '',
                room: room.name || '',
                candidate: tpi.candidat || tpi.refTpi || 'Défense',
                sortKey: [
                  room.date || '',
                  displayedSlot.startTime || '',
                  room.site || '',
                  room.name || '',
                  tpi.candidat || ''
                ].join('|')
              };
            });
        }).sort(function (left, right) {
          return left.sortKey.localeCompare(right.sortKey, 'fr');
        });
      }

      function renderPrintSchedule(filteredRooms) {
        if (!printScheduleNode) {
          return;
        }

        var rows = collectPrintRows(filteredRooms);
        var title = magicLinkViewer && magicLinkViewer.name
          ? 'Horaires de ' + magicLinkViewer.name
          : 'Horaires des défenses ' + payload.year;
        var meta = rows.length + ' défense' + (rows.length > 1 ? 's' : '');

        if (magicLinkPending) {
          printScheduleNode.innerHTML =
            '<h1 class="static-print-title">Horaires des défenses ' + html(payload.year) + '</h1>' +
            '<p class="static-print-empty">Lien magique en cours de vérification.</p>';
          return;
        }

        if (magicLinkError) {
          printScheduleNode.innerHTML =
            '<h1 class="static-print-title">Horaires des défenses ' + html(payload.year) + '</h1>' +
            '<p class="static-print-empty">' + html(magicLinkError) + '</p>';
          return;
        }

        if (rows.length === 0) {
          printScheduleNode.innerHTML =
            '<h1 class="static-print-title">' + html(title) + '</h1>' +
            '<p class="static-print-empty">Aucun horaire à imprimer.</p>';
          return;
        }

        printScheduleNode.innerHTML =
          '<h1 class="static-print-title">' + html(title) + '</h1>' +
          '<p class="static-print-meta">' + html(meta) + '</p>' +
          '<table class="static-print-table">' +
          '<thead><tr><th>Date</th><th>Horaire</th><th>Salle</th><th>Candidat</th></tr></thead>' +
          '<tbody>' +
          rows.map(function (row) {
            var siteHtml = row.site ? '<span>' + html(row.site) + '</span>' : '';
            return '<tr>' +
              '<td>' + html(row.date) + '</td>' +
              '<td class="static-print-time">' + html(row.time) + '</td>' +
              '<td class="static-print-location"><strong>' + html(row.room || 'Salle à confirmer') + '</strong>' + siteHtml + '</td>' +
              '<td>' + html(row.candidate) + '</td>' +
              '</tr>';
          }).join('') +
          '</tbody></table>';
      }

      function isAnyFilterApplied() {
        var effectiveFilters = getEffectiveFilters();
        return Boolean((magicLinkViewer && !isAdminGeneralViewActive()) || magicLinkPending || magicLinkError) || Object.keys(effectiveFilters).some(function (key) {
          return Boolean(effectiveFilters[key]);
        });
      }

      function styleText(styleObject, roomIndex) {
        var style = Object.assign({ '--room-reveal-index': roomIndex }, styleObject || {});
        return Object.keys(style).map(function (key) {
          return key + ':' + style[key];
        }).join(';');
      }

      function normalizeStakeholderIconKey(stakeholderIcons, type) {
        var icons = stakeholderIcons && typeof stakeholderIcons === 'object' ? stakeholderIcons : {};
        var fallback = type === 'candidate' ? 'candidate' : 'participant';
        return String(icons[type] || (type === 'projectManager' ? icons.boss : '') || fallback).trim() || fallback;
      }

      function candidateIconSvg() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="stakeholder-icon-svg">' +
          '<path d="M7 10.6v4.15c1.2 1.3 2.88 1.95 5 1.95s3.8-.65 5-1.95V10.6l-5 2.7-5-2.7Z" fill="var(--role-icon-soft, #bfdbfe)" stroke="none"></path>' +
          '<path d="M12 3.5 2.8 8.2 12 13l9.2-4.8L12 3.5Z" fill="var(--role-icon-primary, #60a5fa)" stroke="var(--role-icon-stroke, #1d4ed8)" stroke-width="1.35" stroke-linejoin="round"></path>' +
          '<path d="M5.2 9.45v4.75m13.6-5.95v5.95M7 10.6l5 2.7 5-2.7" fill="none" stroke="var(--role-icon-stroke, #1d4ed8)" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"></path>' +
          '<circle cx="18.8" cy="14.2" r="1.15" fill="var(--role-icon-stroke, #1d4ed8)" stroke="none"></circle>' +
          '</svg>';
      }

      function expertIconSvg(badge) {
        var badgeText = badge
          ? '<text x="12" y="11.25" text-anchor="middle" dominant-baseline="middle" fill="var(--role-icon-stroke, #854d0e)" stroke="none" font-size="7.2" font-weight="800" font-family="Arial, Helvetica, sans-serif">' + html(badge) + '</text>'
          : '';
        return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="stakeholder-icon-svg">' +
          '<path d="M5.1 13.55C5.38 9.75 7.75 6.7 10.95 6v4.45h2.1V6c3.2.7 5.57 3.75 5.85 7.55H5.1Z" fill="var(--role-icon-soft, #fef08a)" stroke="none"></path>' +
          '<path d="M4.2 13.3h15.6c.75 0 1.35.6 1.35 1.35S20.55 16 19.8 16H4.2c-.75 0-1.35-.6-1.35-1.35s.6-1.35 1.35-1.35Z" fill="var(--role-icon-primary, #facc15)" stroke="var(--role-icon-stroke, #854d0e)" stroke-width="1.25" stroke-linejoin="round"></path>' +
          '<path d="M5.15 13.35C5.5 9.2 8.35 6 12 6s6.5 3.2 6.85 7.35M10.95 6v4.45m2.1-4.45v4.45M4.2 16h15.6" fill="none" stroke="var(--role-icon-stroke, #854d0e)" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"></path>' +
          badgeText +
          '</svg>';
      }

      function projectLeadIconSvg() {
        return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="stakeholder-icon-svg">' +
          '<path d="M5.1 13.55C5.38 9.75 7.75 6.7 10.95 6v4.45h2.1V6c3.2.7 5.57 3.75 5.85 7.55H5.1Z" fill="var(--role-icon-soft, #fecaca)" stroke="none"></path>' +
          '<path d="M4.2 13.3h15.6c.75 0 1.35.6 1.35 1.35S20.55 16 19.8 16H4.2c-.75 0-1.35-.6-1.35-1.35s.6-1.35 1.35-1.35Z" fill="var(--role-icon-primary, #ef4444)" stroke="var(--role-icon-stroke, #7f1d1d)" stroke-width="1.25" stroke-linejoin="round"></path>' +
          '<path d="M5.15 13.35C5.5 9.2 8.35 6 12 6s6.5 3.2 6.85 7.35M10.95 6v4.45m2.1-4.45v4.45M4.2 16h15.6" fill="none" stroke="var(--role-icon-stroke, #7f1d1d)" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"></path>' +
          '</svg>';
      }

      function roleIcon(type, label, stakeholderIcons) {
        var resolvedIconKey = normalizeStakeholderIconKey(stakeholderIcons, type);
        var isCandidateIcon = type === 'candidate' || resolvedIconKey.indexOf('candidate-') === 0;
        var isProjectLead = type === 'projectManager';
        var badge = resolvedIconKey === 'participant' || resolvedIconKey.indexOf('helmet-') === 0
          ? (type === 'expert1' ? '1' : type === 'expert2' ? '2' : '')
          : '';
        var icon = isCandidateIcon
          ? candidateIconSvg()
          : isProjectLead
            ? projectLeadIconSvg()
            : expertIconSvg(badge);
        return '<span class="stakeholder-icon stakeholder-icon--' + html(type) + ' stakeholder-icon--visual-' + html(resolvedIconKey) + '" role="img" aria-label="' + html(label) + '" title="' + html(label) + '">' +
          icon +
          '</span>';
      }

      function renderTpiSlot(room, roomIndex, slot, visibleIndex, anyFilterApplied) {
        var tpi = slot.tpiData || {};
        var hasPublishedTpi = Boolean(tpi.refTpi);
        var displayedSlot = slot.displayedSlot || { startTime: '', endTime: '' };
        var stakeholderIcons = (room.configSite && room.configSite.stakeholderIcons) || {};
        var hasRange = Boolean(displayedSlot.startTime && displayedSlot.endTime);
        var time = formatTimeRange(displayedSlot.startTime, displayedSlot.endTime);
        var effectiveFilters = getEffectiveFilters();
        var selectedClass = effectiveFilters.reference && matchesReferenceFilter(effectiveFilters.reference, tpi.refTpi) ? ' is-selected' : '';
        var filterlessClass = !anyFilterApplied ? ' is-filterless' : '';
        var timeHtml = hasRange
          ? '<span>' + html(displayedSlot.startTime) + '</span><span aria-hidden="true">-</span><span>' + html(displayedSlot.endTime) + '</span>'
          : html(time);

        if (!hasPublishedTpi) {
          return '<div class="tpi-data tpi-slot is-slot-empty' + filterlessClass + '" style="--slot-reveal-index:' + visibleIndex + '" title="' + html(room.site + '\\n' + ((room._static && room._static.dateLabel) || '') + '\\n' + time) + '" aria-label="Créneau vide ' + html(time) + '">' +
            '<div class="slot-time-row"><div class="slot-time slot-time--empty' + (!anyFilterApplied ? ' slot-time--header' : '') + (hasRange ? ' slot-time--range' : '') + '">' + timeHtml + '</div></div>' +
            '<div class="tpi-row-block slot-row--empty" aria-hidden="true"><span class="slot-value"></span></div>' +
            '<div class="tpi-row-block slot-row--empty" aria-hidden="true"><span class="slot-value"></span></div>' +
            '<div class="tpi-row-block slot-row--empty" aria-hidden="true"><span class="slot-value"></span></div>' +
            '<div class="tpi-row-block slot-row--empty" aria-hidden="true"><span class="slot-value"></span></div>' +
            '</div>';
        }

        return '<div class="tpi-data tpi-slot' + filterlessClass + selectedClass + '" id="' + html(tpi.id) + '" style="--slot-reveal-index:' + visibleIndex + '" title="' + html(room.site + '\\n' + ((room._static && room._static.dateLabel) || '') + '\\n' + time) + '">' +
          '<div class="slot-time-row"><div class="slot-time' + (!anyFilterApplied ? ' slot-time--header' : '') + (hasRange ? ' slot-time--range' : '') + '">' + timeHtml + '</div></div>' +
          '<div class="tpi-row-block tpi-row-block--candidate" style="grid-template-columns:auto minmax(0, 1fr) auto">' +
          roleIcon('candidate', ${JSON.stringify(STATIC_ROLE_LABELS.candidat)}, stakeholderIcons) + '<span class="slot-value">' + renderSlotName(tpi.candidat) + '</span><span class="stakeholder-icon-spacer" aria-hidden="true"></span></div>' +
          '<div class="tpi-row-block" style="grid-template-columns:auto minmax(0, 1fr) minmax(var(--soutenance-grid-actions), auto)">' +
          roleIcon('expert1', ${JSON.stringify(STATIC_ROLE_LABELS.expert1)}, stakeholderIcons) + '<span class="slot-value">' + renderSlotName(tpi.expert1 && tpi.expert1.name) + '</span><span></span></div>' +
          '<div class="tpi-row-block" style="grid-template-columns:auto minmax(0, 1fr) minmax(var(--soutenance-grid-actions), auto)">' +
          roleIcon('expert2', ${JSON.stringify(STATIC_ROLE_LABELS.expert2)}, stakeholderIcons) + '<span class="slot-value">' + renderSlotName(tpi.expert2 && tpi.expert2.name) + '</span><span></span></div>' +
          '<div class="tpi-row-block" style="grid-template-columns:auto minmax(0, 1fr) minmax(var(--soutenance-grid-actions), auto)">' +
          roleIcon('projectManager', ${JSON.stringify(STATIC_ROLE_LABELS.chefProjet)}, stakeholderIcons) + '<span class="slot-value">' + renderSlotName(tpi.boss && tpi.boss.name) + '</span><span></span></div>' +
          '</div>';
      }

      function renderRoom(room, roomIndex, anyFilterApplied, showEmpty) {
        var staticData = room._static || {};
        var roomClass = ['salle', room.site, staticData.roomClassName].filter(Boolean).join(' ');
        var classBadge = staticData.classLabel
          ? '<span class="soutenance-room-class-badge ' + html(staticData.classBadgeClass || '') + '" title="Salle ' + html(staticData.classLabel) + '" aria-label="Salle ' + html(staticData.classLabel) + '">' + html(staticData.classLabel) + '</span>'
          : '';
        var slots = getRoomSlots(room);
        var visibleSlots = showEmpty ? slots : slots.filter(function (slot) {
          return Boolean(slot.tpiData && slot.tpiData.refTpi);
        });

        return '<article class="' + html(roomClass) + '" role="listitem" style="' + html(styleText(staticData.roomStyle, roomIndex)) + '">' +
          '<header class="room-header' + (staticData.classLabel ? ' has-room-badge' : '') + '">' +
          '<div class="room-header-badges"><span class="site">' + html(room.site) + '</span>' + classBadge + '</div>' +
          '<div class="room-header-date">' + html(staticData.dateLabel || room.date) + '</div>' +
          '<div class="soutenance-room-title-row"><div class="room-header-name">' + html(room.name) + '</div></div>' +
          '</header>' +
          visibleSlots.map(function (slot, visibleIndex) {
            return renderTpiSlot(room, roomIndex, slot, visibleIndex, anyFilterApplied);
          }).join('') +
          '</article>';
      }

      function readUrlFilters() {
        var dateParam = queryParams.get('date') || '';
        var matchedRoom = rooms.find(function (room) {
          return room.date === dateParam || (room._static && room._static.dateLabel === dateParam);
        });
        filters.date = matchedRoom ? ((matchedRoom._static && matchedRoom._static.dateLabel) || matchedRoom.date) : dateParam;
        filters.site = queryParams.get('site') || '';
        filters.nameRoom = queryParams.get('nameRoom') || queryParams.get('room') || '';
        filters.classType = queryParams.get('classType') || '';
        filters.experts = queryParams.get('experts') || queryParams.get('expert') || '';
        filters.projectManager = queryParams.get('projectManager') || queryParams.get('cdp') || '';
        filters.candidate = queryParams.get('candidate') || queryParams.get('candidat') || '';
        filters.reference = queryParams.get('focus') || queryParams.get('reference') || queryParams.get('ref') || '';
        var person = queryParams.get('person') || queryParams.get('q') || '';
        if (person && !filters.experts && !filters.projectManager && !filters.candidate) {
          filters.experts = person;
          filters.projectManager = person;
          filters.candidate = person;
        }
      }

      function shouldOpenAdminGeneralViewFromUrl() {
        var viewParam = normalizeText(queryParams.get('view') || queryParams.get('mode') || '');
        var adminParam = normalizeText(queryParams.get('admin') || queryParams.get('adminView') || '');

        return viewParam === 'admin' || viewParam === 'general' || adminParam === '1' || adminParam === 'true';
      }

      function renderFocusBanner(filteredRooms) {
        if (magicLinkPending) {
          focusBanner.className = 'soutenance-focus-banner is-ready';
          focusTitle.textContent = 'Lien magique en cours de vérification';
          focusText.textContent = 'La vue personnelle se charge.';
          return;
        }

        if (magicLinkError) {
          focusBanner.className = 'soutenance-focus-banner is-missing';
          focusTitle.textContent = 'Lien magique invalide';
          focusText.textContent = magicLinkError;
          return;
        }

        if (isAdminGeneralViewActive()) {
          focusBanner.className = 'soutenance-focus-banner is-ready';
          focusTitle.textContent = 'Vue générale admin';
          focusText.textContent = 'Toutes les défenses publiées sont affichées. Seuls les filtres date et type de classe restent appliqués.';
          return;
        }

        if (magicLinkViewer && (magicLinkViewer.name || magicLinkViewer.personId)) {
          focusBanner.className = 'soutenance-focus-banner is-ready';
          focusTitle.textContent = 'Vue personnelle';
          focusText.textContent = magicLinkViewer.name
            ? 'Défenses liées à ' + magicLinkViewer.name + '.'
            : 'Défenses liées à votre lien magique.';
          return;
        }

        if (!filters.reference) {
          focusBanner.classList.add('static-hidden');
          return;
        }

        var hasResults = filteredRooms.length > 0;
        focusBanner.className = 'soutenance-focus-banner ' + (hasResults ? 'is-ready' : 'is-missing');
        focusTitle.textContent = 'Défense ciblée: ' + filters.reference;
        focusText.textContent = hasResults
          ? 'Affichage de la fiche ciblée.'
          : 'Aucune défense publiée ne correspond à ' + filters.reference + ' pour ' + payload.year + '.';
      }

      function render() {
        var anyFilterApplied = isAnyFilterApplied();
        var showEmpty = shouldShowEmptySlots();
        var filteredRooms = getFilteredRooms();
        roomsNode.style.setProperty('--soutenance-grid-columns', String(Math.max(1, Math.min(5, getResponsiveColumns()))));
        roomsNode.innerHTML = filteredRooms.map(function (room, index) {
          return renderRoom(room, index, anyFilterApplied, showEmpty);
        }).join('');
        emptyNode.classList.toggle('static-hidden', filteredRooms.length > 0 || magicLinkPending);
        soutenances.className = 'soutenances' + (anyFilterApplied ? ' filterActive' : '');
        var count = filteredRooms.reduce(function (total, room) {
          return total + (room.tpiDatas || []).filter(function (tpi) { return Boolean(tpi.refTpi); }).length;
        }, 0);
        resultCount.textContent = magicLinkPending ? 'Vérification du lien...' : count + ' défense(s)';
        renderFocusBanner(filteredRooms);
        renderPrintSchedule(filteredRooms);
        syncPersonIcal();
        syncAdminFilters();
      }

      function getResponsiveColumns() {
        var width = window.innerWidth || 1280;
        if (width <= 680) return 1;
        if (width <= 980) return 2;
        if (width <= 1280) return 3;
        if (width <= 1660) return 4;
        return 5;
      }

      async function resolveMagicLink() {
        if (serverMagicLinkValidated) {
          magicLinkPending = false;
          render();
          return;
        }

        if (!magicLinkToken) {
          return;
        }

        try {
          var response = await fetch('/api/magic-link/resolve?token=' + encodeURIComponent(magicLinkToken), {
            headers: {
              Accept: 'application/json'
            },
            credentials: 'same-origin'
          });
          var data = await response.json().catch(function () { return {}; });

          if (!response.ok) {
            throw new Error(data.error || 'Lien magique invalide ou expiré.');
          }

          if (data.type !== 'soutenance') {
            throw new Error('Ce lien magique ne donne pas accès aux défenses.');
          }

          if (data.year && String(data.year) !== String(payload.year)) {
            throw new Error('Ce lien cible l annee ' + data.year + ' et non ' + payload.year + '.');
          }

          magicLinkViewer = data.viewer || null;
          if (shouldOpenAdminGeneralViewFromUrl()) {
            adminGeneralView = isAdminViewer(magicLinkViewer);
          }
        } catch (error) {
          magicLinkError = error && error.message ? error.message : 'Lien magique invalide ou expiré.';
        } finally {
          magicLinkPending = false;
          render();
        }
      }

      populateAdminFilters();
      readUrlFilters();
      adminGeneralView = shouldOpenAdminGeneralViewFromUrl() && isAdminViewer(magicLinkViewer);
      function triggerStaticPrint() {
        var printButton = document.getElementById('static-print');
        var originalLabel = printButton ? printButton.textContent : '';
        var restoreButton = function () {
          if (!printButton) return;
          printButton.disabled = false;
          printButton.textContent = originalLabel || 'PDF';
        };

        if (printButton) {
          printButton.disabled = true;
          printButton.textContent = 'PDF...';
        }

        window.addEventListener('afterprint', restoreButton, { once: true });
        window.focus();

        try {
          window.print();
        } finally {
          window.setTimeout(restoreButton, 1400);
        }
      }

      document.getElementById('static-print').addEventListener('click', triggerStaticPrint);
      personIcalButton.addEventListener('click', downloadPersonIcal);
      adminViewToggle.addEventListener('click', function () {
        setAdminGeneralView(!isAdminGeneralViewActive());
      });
      adminDateFilter.addEventListener('change', function () {
        filters.date = adminDateFilter.value || '';
        updateFilterQueryParam('date', filters.date);
        render();
      });
      adminClassTypeFilter.addEventListener('change', function () {
        filters.classType = adminClassTypeFilter.value || '';
        updateFilterQueryParam('classType', filters.classType);
        render();
      });
      window.addEventListener('resize', render);
      render();
      resolveMagicLink();
    })();
  </script>
</body>
</html>`
}

function buildStaticAccessDeniedHtml(year) {
  const normalizedYear = parseYear(year)

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Accès protégé</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #f8fafc;
      color: #0f172a;
      font-family: Arial, Helvetica, sans-serif;
    }
    main {
      width: min(92vw, 520px);
      padding: 28px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
    }
    h1 {
      margin: 0 0 10px;
      font-size: 1.4rem;
    }
    p {
      margin: 0;
      color: #475569;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <main>
    <h1>Accès protégé</h1>
    <p>La consultation des défenses ${escapeHtml(normalizedYear)} nécessite un lien magique valide.</p>
  </main>
</body>
</html>`
}

function isStoredMagicLinkUsable(link, now = new Date()) {
  if (!link || link.revokedAt) {
    return false
  }

  const expiresAt = link.expiresAt ? new Date(link.expiresAt) : null
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt <= now) {
    return false
  }

  const maxUses = Number(link.maxUses || 0)
  const usageCount = Number(link.usageCount || 0)

  return maxUses <= 0 || usageCount < maxUses
}

function buildStoredMagicLinkUrl(baseUrl, redirectPath, token) {
  const rawToken = compactText(token)
  const normalizedBase = compactText(baseUrl).replace(/\/+$/, '')
  const rawPath = compactText(redirectPath)

  if (!rawToken || !normalizedBase || !rawPath) {
    return ''
  }

  try {
    const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
    const url = new URL(normalizedPath, `${normalizedBase}/`)
    url.searchParams.set('ml', rawToken)
    return url.toString()
  } catch (error) {
    return ''
  }
}

function deriveLinkedVoteKey(rawDefenseToken) {
  return crypto
    .createHash('sha256')
    .update(`${STATIC_VOTE_LINK_KEY_PREFIX}${compactText(rawDefenseToken)}`)
    .digest()
}

function encryptLinkedVoteAccessUrl(voteUrl, rawDefenseToken) {
  const normalizedVoteUrl = compactText(voteUrl)
  const normalizedDefenseToken = compactText(rawDefenseToken)

  if (!normalizedVoteUrl || !normalizedDefenseToken) {
    return null
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(
    STATIC_VOTE_LINK_CIPHER,
    deriveLinkedVoteKey(normalizedDefenseToken),
    iv
  )
  const encrypted = Buffer.concat([
    cipher.update(normalizedVoteUrl, 'utf8'),
    cipher.final()
  ])
  const tag = cipher.getAuthTag()

  return {
    cipher: STATIC_VOTE_LINK_CIPHER,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    value: encrypted.toString('base64')
  }
}

function getLinkedVoteSourceRank(link = {}) {
  const source = compactText(link?.scope?.source)

  if (source === ACCESS_LINK_SOURCES.ADMIN_STATIC_VOTE) {
    return 0
  }

  if (source === ACCESS_LINK_SOURCES.ADMIN_APP) {
    return 1
  }

  return 2
}

function getLinkCreatedAtTime(link = {}) {
  const date = link?.createdAt ? new Date(link.createdAt) : null
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0
}

function isBetterLinkedVoteCandidate(candidate, current) {
  if (!current) {
    return true
  }

  const candidateRank = getLinkedVoteSourceRank(candidate)
  const currentRank = getLinkedVoteSourceRank(current)

  if (candidateRank !== currentRank) {
    return candidateRank < currentRank
  }

  return getLinkCreatedAtTime(candidate) > getLinkCreatedAtTime(current)
}

async function buildLinkedVoteAccessByPersonId(year, deploymentConfig = null) {
  const normalizedYear = parseYear(year)
  const now = new Date()
  const baseUrl = await getConfiguredVotePublicBaseUrl(deploymentConfig)
  const links = await MagicLink.find({
    type: 'vote',
    year: normalizedYear,
    revokedAt: null,
    expiresAt: { $gt: now },
    'scope.source': {
      $in: [
        ACCESS_LINK_SOURCES.ADMIN_APP,
        ACCESS_LINK_SOURCES.ADMIN_STATIC_VOTE
      ]
    }
  })
    .select('+rawToken tokenHash personId personName recipientEmail redirectPath expiresAt maxUses usageCount scope createdAt revokedAt')
    .sort({ createdAt: -1 })
    .lean()

  const byPersonId = new Map()

  for (const link of Array.isArray(links) ? links : []) {
    const personId = link?.personId ? String(link.personId) : ''

    if (!personId || !isStoredMagicLinkUsable(link, now)) {
      continue
    }

    const rawToken = compactText(link.rawToken)
    const voteUrl = buildStoredMagicLinkUrl(baseUrl, link.redirectPath || `/coordination/${normalizedYear}`, rawToken)

    if (!voteUrl) {
      continue
    }

    const current = byPersonId.get(personId)
    if (isBetterLinkedVoteCandidate(link, current?.link)) {
      byPersonId.set(personId, {
        link,
        url: voteUrl,
        expiresAt: link.expiresAt instanceof Date
          ? link.expiresAt.toISOString()
          : new Date(link.expiresAt).toISOString()
      })
    }
  }

  return byPersonId
}

async function buildPublicationAccessRolesByPersonId(personIds = []) {
  const uniquePersonIds = Array.from(
    new Set(
      (Array.isArray(personIds) ? personIds : [])
        .map((personId) => compactText(personId))
        .filter(Boolean)
    )
  )

  if (uniquePersonIds.length === 0) {
    return new Map()
  }

  const people = await Person.find({
    _id: { $in: uniquePersonIds }
  })
    .select('roles')
    .lean()

  return new Map(
    (Array.isArray(people) ? people : [])
      .filter((person) => person?._id)
      .map((person) => [
        String(person._id),
        Array.isArray(person.roles)
          ? person.roles.map((role) => compactText(role)).filter(Boolean)
          : []
      ])
  )
}

function buildStaticDefensePhp({ html, year, accessLinks = [] }) {
  const accessPayload = Array.isArray(accessLinks) ? accessLinks : []
  const normalizedYear = parseYear(year)
  const phpPreamble = `<?php
declare(strict_types=1);

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Robots-Tag: noindex, nofollow');

$staticAccessLinks = json_decode(<<<'STATIC_ACCESS_JSON'
${serializeJsonForPhp(accessPayload)}
STATIC_ACCESS_JSON, true) ?: [];

function staticPublicationDeny(int $statusCode = 403): void
{
    http_response_code($statusCode);
    header('Content-Type: text/html; charset=utf-8');
    echo <<<'STATIC_DENIED_HTML'
${buildStaticAccessDeniedHtml(normalizedYear)}
STATIC_DENIED_HTML;
    exit;
}

function staticPublicationText($value): string
{
    if ($value === null) {
        return '';
    }

    if (is_scalar($value)) {
        return trim((string) $value);
    }

    return '';
}

function staticPublicationDecryptLinkedVoteUrl(array $accessEntry, string $rawDefenseToken): string
{
    if (!function_exists('openssl_decrypt')) {
        return '';
    }

    $voteAccess = isset($accessEntry['voteAccess']) && is_array($accessEntry['voteAccess'])
        ? $accessEntry['voteAccess']
        : [];
    $encrypted = isset($voteAccess['encryptedUrl']) && is_array($voteAccess['encryptedUrl'])
        ? $voteAccess['encryptedUrl']
        : [];

    if (staticPublicationText($encrypted['cipher'] ?? '') !== '${STATIC_VOTE_LINK_CIPHER}') {
        return '';
    }

    $iv = base64_decode(staticPublicationText($encrypted['iv'] ?? ''), true);
    $tag = base64_decode(staticPublicationText($encrypted['tag'] ?? ''), true);
    $cipherText = base64_decode(staticPublicationText($encrypted['value'] ?? ''), true);

    if ($iv === false || $tag === false || $cipherText === false) {
        return '';
    }

    $key = hash('sha256', '${STATIC_VOTE_LINK_KEY_PREFIX}' . $rawDefenseToken, true);
    $decrypted = openssl_decrypt($cipherText, '${STATIC_VOTE_LINK_CIPHER}', $key, OPENSSL_RAW_DATA, $iv, $tag);

    if (!is_string($decrypted) || $decrypted === '') {
        return '';
    }

    if (!preg_match('/^https?:\\/\\//i', $decrypted)) {
        return '';
    }

    return $decrypted;
}

$staticToken = isset($_GET['ml']) && is_string($_GET['ml']) ? trim($_GET['ml']) : '';

if ($staticToken === '' || strlen($staticToken) < 32 || strlen($staticToken) > 256) {
    staticPublicationDeny(403);
}

$staticTokenHash = hash('sha256', $staticToken);
$staticAccessEntry = null;

foreach ($staticAccessLinks as $candidateAccessEntry) {
    $candidateHash = isset($candidateAccessEntry['hash']) && is_string($candidateAccessEntry['hash'])
        ? $candidateAccessEntry['hash']
        : '';

    if ($candidateHash !== '' && hash_equals($candidateHash, $staticTokenHash)) {
        $staticAccessEntry = $candidateAccessEntry;
        break;
    }
}

if (!is_array($staticAccessEntry)) {
    staticPublicationDeny(403);
}

$staticExpiresAt = isset($staticAccessEntry['expiresAt']) && is_string($staticAccessEntry['expiresAt'])
    ? strtotime($staticAccessEntry['expiresAt'])
    : false;

if ($staticExpiresAt !== false && $staticExpiresAt <= time()) {
    staticPublicationDeny(410);
}

$staticViewer = [
    'personId' => $staticAccessEntry['personId'] ?? null,
    'name' => $staticAccessEntry['name'] ?? null,
    'email' => $staticAccessEntry['email'] ?? null,
    'roles' => isset($staticAccessEntry['roles']) && is_array($staticAccessEntry['roles'])
        ? array_values($staticAccessEntry['roles'])
        : [],
    'isAdmin' => ($staticAccessEntry['isAdmin'] ?? false) === true,
];
$staticLinkedVoteUrl = staticPublicationDecryptLinkedVoteUrl($staticAccessEntry, $staticToken);

if ($staticLinkedVoteUrl !== '') {
    $staticViewer['voteAccessUrl'] = $staticLinkedVoteUrl;
    $staticViewer['voteAccessExpiresAt'] = $staticAccessEntry['voteAccess']['expiresAt'] ?? null;
}

$staticMagicLinkBootstrap = '<script>window.__STATIC_MAGIC_LINK_VALIDATED__=true;window.__STATIC_MAGIC_LINK_VIEWER__=' .
    json_encode($staticViewer, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) .
    ';</script>';
?>
`

  return `${phpPreamble}${html.replace(
    STATIC_MAGIC_LINK_BOOTSTRAP_PLACEHOLDER,
    '<?php echo $staticMagicLinkBootstrap; ?>'
  )}`
}

async function listStaticPublicationAccessLinks(year, deploymentConfig = null) {
  const normalizedYear = parseYear(year)
  const now = new Date()
  const linkedVoteAccessByPersonId = await buildLinkedVoteAccessByPersonId(normalizedYear, deploymentConfig)
  const links = await MagicLink.find({
    type: 'soutenance',
    year: normalizedYear,
    revokedAt: null,
    expiresAt: { $gt: now }
  })
    .select('+rawToken tokenHash personId personName recipientEmail expiresAt maxUses usageCount')
    .lean()
  const rolesByPersonId = await buildPublicationAccessRolesByPersonId(
    (Array.isArray(links) ? links : []).map((link) => link?.personId)
  )

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
    .map((link) => {
      const personId = link.personId ? String(link.personId) : ''
      const roles = rolesByPersonId.get(personId) || []
      const linkedVoteAccess = personId ? linkedVoteAccessByPersonId.get(personId) : null
      const encryptedVoteUrl = linkedVoteAccess?.url
        ? encryptLinkedVoteAccessUrl(linkedVoteAccess.url, link.rawToken)
        : null

      return {
        year: normalizedYear,
        hash: compactText(link.tokenHash),
        personId: personId || null,
        name: compactText(link.personName) || null,
        email: compactText(link.recipientEmail) || null,
        roles,
        isAdmin: roles.includes('admin'),
        expiresAt: link.expiresAt instanceof Date
          ? link.expiresAt.toISOString()
          : new Date(link.expiresAt).toISOString(),
        ...(encryptedVoteUrl
          ? {
            voteAccess: {
              encryptedUrl: encryptedVoteUrl,
                expiresAt: linkedVoteAccess.expiresAt || null,
                source: compactText(linkedVoteAccess.link?.scope?.source) || null
              }
            }
          : {})
      }
    })
}

async function writeStaticPublicationAccessFiles({ year, html, deploymentConfig = null }) {
  const normalizedYear = parseYear(year)
  const phpIndexPath = getPhpIndexPath(normalizedYear)
  const deniedIndexPath = getDeniedIndexPath(normalizedYear)
  const accessLinks = await listStaticPublicationAccessLinks(normalizedYear, deploymentConfig)

  await fs.promises.writeFile(
    phpIndexPath,
    buildStaticDefensePhp({
      html,
      year: normalizedYear,
      accessLinks
    }),
    'utf8'
  )
  await fs.promises.writeFile(
    deniedIndexPath,
    buildStaticAccessDeniedHtml(normalizedYear),
    'utf8'
  )

  return {
    phpIndexPath,
    deniedIndexPath,
    accessLinkCount: accessLinks.length
  }
}

async function getStaticPublicationStatus(year, deploymentConfig = null) {
  const normalizedYear = parseYear(year)
  const resolvedDeploymentConfig = deploymentConfig || await getPublicationDeploymentConfigIfAvailable()
  const manifestPath = getManifestPath(normalizedYear)
  const indexPath = getIndexPath(normalizedYear)

  let manifest = null
  try {
    manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'))
  } catch (error) {
    manifest = null
  }

  const available = fs.existsSync(indexPath)

  const publicUrl = await getPublicUrl(normalizedYear, resolvedDeploymentConfig)

  return {
    ...(manifest || {}),
    available,
    year: normalizedYear,
    outputDir: getOutputDir(normalizedYear),
    indexPath,
    phpIndexPath: getPhpIndexPath(normalizedYear),
    deniedIndexPath: getDeniedIndexPath(normalizedYear),
    manifestPath,
    previewPath: available ? getPreviewPath(normalizedYear) : null,
    publicUrl,
    remoteDir: normalizeRemoteDir(normalizedYear, resolvedDeploymentConfig)
  }
}

async function generateStaticDefensesSite(year) {
  const normalizedYear = parseYear(year)
  const deploymentConfig = await getPublicationDeploymentConfigIfAvailable()
  const generatedAt = new Date().toISOString()
  const rooms = await listPublishedSoutenances(normalizedYear)
  const rows = flattenPublishedRooms(rooms)
  const outputDir = getOutputDir(normalizedYear)
  const indexPath = getIndexPath(normalizedYear)
  const phpIndexPath = getPhpIndexPath(normalizedYear)
  const deniedIndexPath = getDeniedIndexPath(normalizedYear)
  const manifestPath = getManifestPath(normalizedYear)
  const html = buildStaticDefenseHtml({
    year: normalizedYear,
    generatedAt,
    rooms,
    rows
  })
  const publicUrl = await getPublicUrl(normalizedYear, deploymentConfig)
  const manifest = {
    year: normalizedYear,
    generatedAt,
    roomCount: Array.isArray(rooms) ? rooms.length : 0,
    defenseCount: rows.length,
    previewPath: getPreviewPath(normalizedYear),
    publicUrl,
    remoteDir: normalizeRemoteDir(normalizedYear, deploymentConfig)
  }

  await fs.promises.mkdir(outputDir, { recursive: true })
  await fs.promises.writeFile(indexPath, html, 'utf8')
  const accessFiles = await writeStaticPublicationAccessFiles({
    year: normalizedYear,
    html,
    deploymentConfig
  })
  manifest.accessLinkCount = accessFiles.accessLinkCount
  manifest.phpIndexPath = phpIndexPath
  manifest.deniedIndexPath = deniedIndexPath
  await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

  return {
    success: true,
    available: true,
    outputDir,
    indexPath,
    phpIndexPath,
    deniedIndexPath,
    manifestPath,
    accessLinkCount: accessFiles.accessLinkCount,
    ...manifest
  }
}

class SimpleFtpClient {
  constructor({ host, port = 21, user, password }) {
    this.host = host
    this.port = port
    this.user = user
    this.password = password
    this.socket = null
    this.buffer = ''
    this.pending = []
  }

  connect() {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port })
      this.socket = socket
      socket.setEncoding('utf8')
      socket.setTimeout(FTP_RESPONSE_TIMEOUT_MS)
      socket.on('data', (chunk) => this.handleData(chunk))
      socket.on('timeout', () => reject(new Error('Timeout FTP.')))
      socket.on('error', reject)
      socket.on('connect', async () => {
        try {
          await this.readResponse()
          await this.command(`USER ${this.user}`)
          await this.command(`PASS ${this.password}`)
          await this.command('TYPE I')
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  handleData(chunk) {
    this.buffer += chunk
    this.flushResponses()
  }

  flushResponses() {
    if (this.pending.length === 0) {
      return
    }

    const parsed = this.tryParseResponse()
    if (!parsed) {
      return
    }

    const { resolve, reject, timer } = this.pending.shift()
    clearTimeout(timer)

    if (parsed.code >= 400) {
      reject(new Error(`Erreur FTP ${parsed.code}: ${parsed.message}`))
      return
    }

    resolve(parsed)
    this.flushResponses()
  }

  tryParseResponse() {
    const parsedLines = []
    let offset = 0

    while (offset < this.buffer.length) {
      const newlineIndex = this.buffer.indexOf('\n', offset)
      if (newlineIndex < 0) {
        break
      }

      const rawLine = this.buffer.slice(offset, newlineIndex).replace(/\r$/, '')
      parsedLines.push({
        text: rawLine,
        endOffset: newlineIndex + 1
      })
      offset = newlineIndex + 1
    }

    if (parsedLines.length === 0) {
      return null
    }

    const firstMatch = parsedLines[0].text.match(/^(\d{3})([\s-])(.*)$/)
    if (!firstMatch) {
      return null
    }

    const code = firstMatch[1]
    let endIndex = -1

    if (firstMatch[2] === ' ') {
      endIndex = 0
    } else {
      endIndex = parsedLines.findIndex((line, index) => (
        index > 0 && line.text.startsWith(`${code} `)
      ))
    }

    if (endIndex < 0) {
      return null
    }

    const responseLines = parsedLines.slice(0, endIndex + 1).map((line) => line.text)
    this.buffer = this.buffer.slice(parsedLines[endIndex].endOffset)

    return {
      code: Number.parseInt(code, 10),
      message: responseLines.join('\n')
    }
  }

  readResponse() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout reponse FTP.'))
      }, FTP_RESPONSE_TIMEOUT_MS)
      this.pending.push({ resolve, reject, timer })
      this.flushResponses()
    })
  }

  async command(command) {
    this.socket.write(`${command}\r\n`)
    return await this.readResponse()
  }

  async enterPassiveMode() {
    const response = await this.command('PASV')
    const match = response.message.match(/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/)
    if (!match) {
      throw new Error('Reponse PASV invalide.')
    }

    const [, h1, h2, h3, h4, p1, p2] = match.map(Number)
    const passiveHost = `${h1}.${h2}.${h3}.${h4}`
    const passivePort = (p1 * 256) + p2

    return {
      host: passiveHost.startsWith('10.') || passiveHost.startsWith('192.168.')
        ? this.host
        : passiveHost,
      port: passivePort
    }
  }

  async ensureDirectoryCandidate(remoteDir) {
    const parts = compactText(remoteDir)
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
    const publicRootIndex = parts.findIndex((part) => /^(public_html|htdocs|www)$/i.test(part))
    const createFromIndex = publicRootIndex >= 0 ? publicRootIndex + 1 : 0

    await this.command('CWD /')

    for (const [index, part] of parts.entries()) {
      try {
        await this.command(`CWD ${part}`)
      } catch (error) {
        if (index < createFromIndex) {
          throw error
        }

        await this.command(`MKD ${part}`).catch(() => null)
        await this.command(`CWD ${part}`)
      }
    }

    return normalizeSlashPath(remoteDir)
  }

  async ensureDirectory(remoteDir) {
    let lastError = null
    const attemptedDirs = []

    for (const candidate of getRemoteDirCandidates(remoteDir)) {
      attemptedDirs.push(candidate)
      try {
        return await this.ensureDirectoryCandidate(candidate)
      } catch (error) {
        lastError = error
      }
    }

    const error = new Error(
      `Dossier FTP introuvable: ${attemptedDirs.join(', ')}. ` +
      'Verifiez que FTP_REMOTE_DIR correspond au dossier racine visible par ce compte FTP.'
    )
    error.cause = lastError
    throw error
  }

  uploadFile(localPath, remoteName) {
    return new Promise(async (resolve, reject) => {
      let dataSocket = null

      try {
        const passive = await this.enterPassiveMode()
        dataSocket = net.createConnection(passive)
        dataSocket.on('error', reject)

        await new Promise((dataResolve, dataReject) => {
          dataSocket.once('connect', dataResolve)
          dataSocket.once('error', dataReject)
        })

        this.socket.write(`STOR ${remoteName}\r\n`)
        const preliminary = await this.readResponse()
        if (preliminary.code < 100 || preliminary.code >= 200) {
          throw new Error(`Reponse FTP STOR inattendue: ${preliminary.message}`)
        }

        const readStream = fs.createReadStream(localPath)
        readStream.on('error', reject)
        dataSocket.on('close', async () => {
          try {
            await this.readResponse()
            resolve()
          } catch (error) {
            reject(error)
          }
        })
        readStream.pipe(dataSocket)
      } catch (error) {
        if (dataSocket) {
          dataSocket.destroy()
        }
        reject(error)
      }
    })
  }

  async close() {
    if (!this.socket) {
      return
    }

    try {
      await this.command('QUIT')
    } catch (error) {
      // Ignore close errors.
    } finally {
      this.socket.destroy()
    }
  }
}

function getFtpConfig(deploymentConfig = null) {
  const protocol = compactText(
    deploymentConfig?.protocol ||
    process.env.PUBLICATION_FTP_PROTOCOL ||
    process.env.FTP_PROTOCOL ||
    'ftp'
  ).toLowerCase()
  const host = compactText(deploymentConfig?.host || process.env.FTP_HOST)
  const user = compactText(deploymentConfig?.username || deploymentConfig?.user || process.env.FTP_USER)
  const password = compactText(deploymentConfig?.password || process.env.FTP_PASSWORD)
  const defaultPort = ['sftp', 'ssh'].includes(protocol) ? 22 : 21
  const port = parsePositiveInteger(deploymentConfig?.port || process.env.FTP_PORT, defaultPort)

  if (protocol !== 'ftp') {
    const error = new Error(`Protocole ${protocol.toUpperCase()} non pris en charge par la publication automatique actuelle.`)
    error.statusCode = 501
    throw error
  }

  if (!host || !user || !password) {
    const error = new Error('Configuration FTP incomplete.')
    error.statusCode = 500
    throw error
  }

  return {
    protocol,
    host,
    user,
    password,
    port
  }
}

async function publishStaticDefensesSite(year) {
  const normalizedYear = parseYear(year)
  const deploymentConfig = await getPublicationDeploymentConfigIfAvailable({ includeSecret: true })
  const status = await getStaticPublicationStatus(normalizedYear, deploymentConfig)

  if (!status.available) {
    const error = new Error('Genere la page statique avant la publication FTP.')
    error.statusCode = 409
    throw error
  }

  const html = await fs.promises.readFile(status.indexPath, 'utf8')
  const accessFiles = await writeStaticPublicationAccessFiles({
    year: normalizedYear,
    html,
    deploymentConfig
  })
  const remoteDir = normalizeRemoteDir(normalizedYear, deploymentConfig)
  const publishedAt = new Date().toISOString()
  const publicUrl = await getPublicUrl(normalizedYear, deploymentConfig)
  const manifest = {
    year: normalizedYear,
    generatedAt: status.generatedAt || null,
    publishedAt,
    roomCount: status.roomCount || 0,
    defenseCount: status.defenseCount || 0,
    accessLinkCount: accessFiles.accessLinkCount,
    previewPath: getPreviewPath(normalizedYear),
    publicUrl,
    remoteDir
  }

  const ftpClient = new SimpleFtpClient(getFtpConfig(deploymentConfig))

  try {
    await ftpClient.connect()
    manifest.remoteDir = await ftpClient.ensureDirectory(remoteDir)
    await ftpClient.uploadFile(accessFiles.deniedIndexPath, 'index.html')
    await ftpClient.uploadFile(accessFiles.phpIndexPath, 'index.php')
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

module.exports = {
  SimpleFtpClient,
  buildStaticAccessDeniedHtml,
  buildStaticDefenseHtml,
  buildStaticDefensePhp,
  flattenPublishedRooms,
  generateStaticDefensesSite,
  getFtpConfig,
  getIndexPath,
  getStaticPublicationStatus,
  joinSlashPaths,
  listStaticPublicationAccessLinks,
  normalizeSlashPath,
  publishStaticDefensesSite
}
