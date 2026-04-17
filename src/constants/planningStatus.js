export const PLANNING_STATUS = {
  DRAFT: 'draft',
  VOTING: 'voting',
  CONFIRMED: 'confirmed',
  MANUAL_REQUIRED: 'manual_required'
}

export const LEGACY_MANUAL_REQUIRED_STATUS = 'requires_manual_intervention'

export const MANUAL_REQUIRED_STATUSES = [
  PLANNING_STATUS.MANUAL_REQUIRED,
  LEGACY_MANUAL_REQUIRED_STATUS
]

export const normalizePlanningStatus = status => {
  if (MANUAL_REQUIRED_STATUSES.includes(status)) {
    return PLANNING_STATUS.MANUAL_REQUIRED
  }

  return status
}