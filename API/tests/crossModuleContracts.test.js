const test = require('node:test')
const assert = require('node:assert/strict')

const accessLinkPolicy = require('../../shared/accessLinkPolicy.json')
const gestionTpiLifecycle = require('../../shared/gestionTpiLifecycle.json')
const coordinationWorkflow = require('../../shared/coordinationWorkflow.json')
const Vote = require('../models/voteModel')
const { MagicLink, MAGIC_LINK_TYPES } = require('../models/magicLinkModel')
const { AccessLinkLog, ACCESS_LINK_LOG_STATUSES } = require('../models/accessLinkLogModel')
const { ResolutionProposal } = require('../models/resolutionProposalModel')
const {
  ACCESS_LINK_TYPE_VALUES,
  DEFAULT_ACCESS_LINK_SETTINGS,
  DEFAULT_EXPIRY_HOURS,
  DEFAULT_MAX_USES,
  normalizeSoutenanceLinkTarget,
  normalizeVoteLinkTarget
} = require('../modules/accessLinks/constants')
const {
  TPI_STATUS_VALUES,
  TPI_TRANSITIONS
} = require('../modules/gestionTpi/constants')
const {
  COORDINATION_STATUS_VALUES,
  COORDINATION_VOTE_STATUSES,
  COORDINATION_WORKFLOW_FREE_VOTE_STATUSES,
  canTransitionCoordinationStatus,
  normalizeCoordinationStatus
} = require('../modules/coordination/status')
const { DEFAULT_ACCESS_LINK_SETTINGS: COORDINATION_ACCESS_LINK_SETTINGS } = require('../services/coordinationConfigService')
const { VOTING_STAKEHOLDER_ROLES } = require('../modules/stakeholders/stakeholderDefinitions')

test('access link policy is shared by coordination config, token models and logs', () => {
  const expectedTypes = Object.values(accessLinkPolicy.types)

  assert.deepEqual(ACCESS_LINK_TYPE_VALUES, expectedTypes)
  assert.deepEqual(MAGIC_LINK_TYPES, expectedTypes)
  assert.deepEqual(MagicLink.schema.path('type').enumValues, expectedTypes)
  assert.deepEqual(AccessLinkLog.schema.path('type').enumValues, [...expectedTypes, null])
  assert.deepEqual(ACCESS_LINK_LOG_STATUSES, accessLinkPolicy.logStatuses)
  assert.deepEqual(DEFAULT_ACCESS_LINK_SETTINGS, accessLinkPolicy.defaultSettings)
  assert.deepEqual(COORDINATION_ACCESS_LINK_SETTINGS, accessLinkPolicy.defaultSettings)
  assert.equal(DEFAULT_EXPIRY_HOURS.vote, accessLinkPolicy.defaultSettings.voteLinkValidityHours)
  assert.equal(DEFAULT_MAX_USES.soutenance, accessLinkPolicy.defaultSettings.soutenanceLinkMaxUses)
})

test('access link target aliases normalize consistently across vote and defense flows', () => {
  assert.equal(normalizeVoteLinkTarget('publication'), accessLinkPolicy.targets.static)
  assert.equal(normalizeVoteLinkTarget('static'), accessLinkPolicy.targets.static)
  assert.equal(normalizeVoteLinkTarget('app'), accessLinkPolicy.targets.app)
  assert.equal(normalizeSoutenanceLinkTarget('publication'), accessLinkPolicy.targets.publication)
  assert.equal(normalizeSoutenanceLinkTarget('static'), accessLinkPolicy.targets.app)
})

test('coordination statuses and transitions come from the shared workflow contract', () => {
  assert.deepEqual(COORDINATION_STATUS_VALUES, Object.keys(coordinationWorkflow.statuses))
  assert.deepEqual(COORDINATION_VOTE_STATUSES, coordinationWorkflow.voteStatuses)
  assert.deepEqual(COORDINATION_WORKFLOW_FREE_VOTE_STATUSES, coordinationWorkflow.workflowFreeVoteStatuses)
  assert.equal(normalizeCoordinationStatus('requires_manual_intervention'), 'manual_required')
  assert.equal(canTransitionCoordinationStatus('draft', 'pending_slots'), true)
  assert.equal(canTransitionCoordinationStatus('draft', 'confirmed'), false)
})

test('gestion TPI lifecycle exposes only the shared statuses and transitions', () => {
  assert.deepEqual(TPI_STATUS_VALUES, Object.keys(gestionTpiLifecycle.statuses))
  assert.deepEqual(TPI_TRANSITIONS, gestionTpiLifecycle.transitions)
  assert.equal(TPI_TRANSITIONS.completed.length, 0)
  assert.equal(TPI_TRANSITIONS.ready_for_planning.includes('imported_to_planning'), true)
})

test('voting roles stay aligned between stakeholder definitions, votes and arbitrage proposals', () => {
  assert.deepEqual(VOTING_STAKEHOLDER_ROLES, ['expert1', 'expert2', 'chef_projet'])
  assert.deepEqual(Vote.schema.path('voterRole').enumValues, VOTING_STAKEHOLDER_ROLES)
  assert.deepEqual(ResolutionProposal.schema.path('recipients.role').enumValues, VOTING_STAKEHOLDER_ROLES)
})
