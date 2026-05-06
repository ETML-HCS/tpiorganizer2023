const coordinationWorkflow = require('../../../shared/coordinationWorkflow.json')

const COORDINATION_STATUS = Object.freeze(
  Object.fromEntries(
    Object.keys(coordinationWorkflow.statuses).map((status) => [
      status.toUpperCase(),
      status
    ])
  )
)

const COORDINATION_STATUS_VALUES = Object.freeze(Object.keys(coordinationWorkflow.statuses))
const COORDINATION_STATUS_LABELS = Object.freeze({ ...coordinationWorkflow.statuses })
const COORDINATION_STATUS_TRANSITIONS = Object.freeze({ ...coordinationWorkflow.transitions })
const COORDINATION_STATUS_ALIASES = Object.freeze({ ...coordinationWorkflow.aliases })
const COORDINATION_VOTE_STATUSES = Object.freeze([...coordinationWorkflow.voteStatuses])
const COORDINATION_WORKFLOW_FREE_VOTE_STATUSES = Object.freeze([...coordinationWorkflow.workflowFreeVoteStatuses])
const COORDINATION_PROPOSAL_READY_STATUSES = Object.freeze([...coordinationWorkflow.proposalReadyStatuses])

function normalizeCoordinationStatus(status) {
  const normalized = String(status || '').trim().toLowerCase()
  return COORDINATION_STATUS_ALIASES[normalized] || normalized
}

function isCoordinationStatus(status) {
  return COORDINATION_STATUS_VALUES.includes(normalizeCoordinationStatus(status))
}

function canTransitionCoordinationStatus(fromStatus, toStatus) {
  const from = normalizeCoordinationStatus(fromStatus)
  const to = normalizeCoordinationStatus(toStatus)

  if (!from || !to || !isCoordinationStatus(from) || !isCoordinationStatus(to)) {
    return false
  }

  return from === to || (COORDINATION_STATUS_TRANSITIONS[from] || []).includes(to)
}

module.exports = {
  COORDINATION_PROPOSAL_READY_STATUSES,
  COORDINATION_STATUS,
  COORDINATION_STATUS_ALIASES,
  COORDINATION_STATUS_LABELS,
  COORDINATION_STATUS_TRANSITIONS,
  COORDINATION_STATUS_VALUES,
  COORDINATION_VOTE_STATUSES,
  COORDINATION_WORKFLOW_FREE_VOTE_STATUSES,
  canTransitionCoordinationStatus,
  coordinationWorkflow,
  isCoordinationStatus,
  normalizeCoordinationStatus,

  PLANNING_PROPOSAL_READY_STATUSES: COORDINATION_PROPOSAL_READY_STATUSES,
  PLANNING_STATUS: COORDINATION_STATUS,
  PLANNING_STATUS_ALIASES: COORDINATION_STATUS_ALIASES,
  PLANNING_STATUS_LABELS: COORDINATION_STATUS_LABELS,
  PLANNING_STATUS_TRANSITIONS: COORDINATION_STATUS_TRANSITIONS,
  PLANNING_STATUS_VALUES: COORDINATION_STATUS_VALUES,
  PLANNING_VOTE_STATUSES: COORDINATION_VOTE_STATUSES,
  PLANNING_WORKFLOW_FREE_VOTE_STATUSES: COORDINATION_WORKFLOW_FREE_VOTE_STATUSES,
  canTransitionPlanningStatus: canTransitionCoordinationStatus,
  isPlanningStatus: isCoordinationStatus,
  normalizePlanningStatus: normalizeCoordinationStatus,
  planningWorkflow: coordinationWorkflow
}
