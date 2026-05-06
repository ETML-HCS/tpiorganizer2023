const accessLinkPolicy = require('../../../shared/accessLinkPolicy.json')

const ACCESS_LINK_TYPES = Object.freeze({
  VOTE: accessLinkPolicy.types.vote,
  SOUTENANCE: accessLinkPolicy.types.soutenance
})

const ACCESS_LINK_TYPE_VALUES = Object.freeze(Object.values(ACCESS_LINK_TYPES))

const ACCESS_LINK_SOURCES = Object.freeze({
  ADMIN_APP: accessLinkPolicy.sources.adminApp,
  ADMIN_APP_PREVIEW: accessLinkPolicy.sources.adminAppPreview,
  ADMIN_PUBLICATION: accessLinkPolicy.sources.adminPublication,
  ADMIN_PUBLICATION_PREVIEW: accessLinkPolicy.sources.adminPublicationPreview,
  ADMIN_STATIC_VOTE: accessLinkPolicy.sources.adminStaticVote,
  ADMIN_STATIC_VOTE_PREVIEW: accessLinkPolicy.sources.adminStaticVotePreview
})

const DEFAULT_EXPIRY_HOURS = Object.freeze({
  [ACCESS_LINK_TYPES.VOTE]: accessLinkPolicy.defaultSettings.voteLinkValidityHours,
  [ACCESS_LINK_TYPES.SOUTENANCE]: accessLinkPolicy.defaultSettings.soutenanceLinkValidityHours
})

const DEFAULT_MAX_USES = Object.freeze({
  [ACCESS_LINK_TYPES.VOTE]: accessLinkPolicy.defaultSettings.voteLinkMaxUses,
  [ACCESS_LINK_TYPES.SOUTENANCE]: accessLinkPolicy.defaultSettings.soutenanceLinkMaxUses
})

const DEFAULT_ACCESS_LINK_SETTINGS = Object.freeze({
  ...accessLinkPolicy.defaultSettings
})

const ADMIN_ACCESS_REVOKE_SOURCES = Object.freeze([
  ACCESS_LINK_SOURCES.ADMIN_APP_PREVIEW,
  ACCESS_LINK_SOURCES.ADMIN_APP
])

const ADMIN_PUBLICATION_ACCESS_REVOKE_SOURCES = Object.freeze([
  ACCESS_LINK_SOURCES.ADMIN_PUBLICATION_PREVIEW,
  ACCESS_LINK_SOURCES.ADMIN_PUBLICATION
])

const ADMIN_STATIC_VOTE_ACCESS_REVOKE_SOURCES = Object.freeze([
  ACCESS_LINK_SOURCES.ADMIN_STATIC_VOTE_PREVIEW,
  ACCESS_LINK_SOURCES.ADMIN_STATIC_VOTE
])

function isAccessLinkType(type) {
  return ACCESS_LINK_TYPE_VALUES.includes(type)
}

function normalizeVoteLinkTarget(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === accessLinkPolicy.targets.static || normalized === accessLinkPolicy.targets.publication
    ? accessLinkPolicy.targets.static
    : accessLinkPolicy.targets.app
}

function normalizeSoutenanceLinkTarget(value) {
  return String(value || '').trim().toLowerCase() === accessLinkPolicy.targets.publication
    ? accessLinkPolicy.targets.publication
    : accessLinkPolicy.targets.app
}

function getVoteAccessLinkSource(target) {
  return normalizeVoteLinkTarget(target) === 'static'
    ? ACCESS_LINK_SOURCES.ADMIN_STATIC_VOTE
    : ACCESS_LINK_SOURCES.ADMIN_APP
}

function getVoteAccessRevokeSources(target) {
  return normalizeVoteLinkTarget(target) === 'static'
    ? [...ADMIN_STATIC_VOTE_ACCESS_REVOKE_SOURCES]
    : [...ADMIN_ACCESS_REVOKE_SOURCES]
}

function getVoteGeneratedAccessLinkSources(target) {
  return [getVoteAccessLinkSource(target)]
}

function getSoutenanceAccessLinkSource(target) {
  return normalizeSoutenanceLinkTarget(target) === 'publication'
    ? ACCESS_LINK_SOURCES.ADMIN_PUBLICATION
    : ACCESS_LINK_SOURCES.ADMIN_APP
}

function getSoutenanceAccessRevokeSources(target) {
  return normalizeSoutenanceLinkTarget(target) === 'publication'
    ? [...ADMIN_PUBLICATION_ACCESS_REVOKE_SOURCES]
    : [...ADMIN_ACCESS_REVOKE_SOURCES]
}

function getSoutenanceGeneratedAccessLinkSources(target) {
  return [getSoutenanceAccessLinkSource(target)]
}

module.exports = {
  ACCESS_LINK_TYPES,
  ACCESS_LINK_TYPE_VALUES,
  ACCESS_LINK_SOURCES,
  DEFAULT_EXPIRY_HOURS,
  DEFAULT_MAX_USES,
  DEFAULT_ACCESS_LINK_SETTINGS,
  ADMIN_ACCESS_REVOKE_SOURCES,
  ADMIN_PUBLICATION_ACCESS_REVOKE_SOURCES,
  ADMIN_STATIC_VOTE_ACCESS_REVOKE_SOURCES,
  ADMIN_ACCESS_LINK_SOURCE: ACCESS_LINK_SOURCES.ADMIN_APP,
  ADMIN_PUBLICATION_ACCESS_LINK_SOURCE: ACCESS_LINK_SOURCES.ADMIN_PUBLICATION,
  ADMIN_STATIC_VOTE_ACCESS_LINK_SOURCE: ACCESS_LINK_SOURCES.ADMIN_STATIC_VOTE,
  isAccessLinkType,
  normalizeVoteLinkTarget,
  normalizeSoutenanceLinkTarget,
  getVoteAccessLinkSource,
  getVoteAccessRevokeSources,
  getVoteGeneratedAccessLinkSources,
  getSoutenanceAccessLinkSource,
  getSoutenanceAccessRevokeSources,
  getSoutenanceGeneratedAccessLinkSources
}
