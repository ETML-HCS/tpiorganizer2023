import coordinationWorkflow from '../../shared/coordinationWorkflow.json'

export const COORDINATION_STATUS = Object.freeze(
  Object.fromEntries(
    Object.keys(coordinationWorkflow.statuses).map((status) => [
      status.toUpperCase(),
      status
    ])
  )
)

export const COORDINATION_STATUS_LABELS = coordinationWorkflow.statuses
export const COORDINATION_STATUS_VALUES = Object.keys(coordinationWorkflow.statuses)
export const COORDINATION_STATUS_TRANSITIONS = coordinationWorkflow.transitions
export const COORDINATION_STATUS_ALIASES = coordinationWorkflow.aliases

export const normalizeCoordinationStatus = status => {
  const normalized = String(status || '').trim().toLowerCase()
  return COORDINATION_STATUS_ALIASES[normalized] || normalized
}

export const MANUAL_REQUIRED_COORDINATION_STATUSES = [
  COORDINATION_STATUS.MANUAL_REQUIRED
]

export const getCoordinationStatusLabel = status => {
  const normalizedStatus = normalizeCoordinationStatus(status)
  return COORDINATION_STATUS_LABELS[normalizedStatus] || normalizedStatus || 'Inconnu'
}

export const PLANNING_STATUS = COORDINATION_STATUS
export const PLANNING_STATUS_LABELS = COORDINATION_STATUS_LABELS
export const PLANNING_STATUS_VALUES = COORDINATION_STATUS_VALUES
export const PLANNING_STATUS_TRANSITIONS = COORDINATION_STATUS_TRANSITIONS
export const PLANNING_STATUS_ALIASES = COORDINATION_STATUS_ALIASES
export const MANUAL_REQUIRED_STATUSES = MANUAL_REQUIRED_COORDINATION_STATUSES
export const normalizePlanningStatus = normalizeCoordinationStatus
export const getPlanningStatusLabel = getCoordinationStatusLabel
