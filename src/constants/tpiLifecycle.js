import lifecycleConfig from '../../shared/gestionTpiLifecycle.json'

export const TPI_STATUS_LABELS = lifecycleConfig.statuses
export const TPI_STATUS_VALUES = Object.keys(lifecycleConfig.statuses)
export const TPI_TRANSITIONS = lifecycleConfig.transitions
export const JOURNAL_STATUS_LABELS = lifecycleConfig.journalStatuses
export const JOURNAL_STATUS_VALUES = Object.keys(lifecycleConfig.journalStatuses)
export const REPORT_STATUS_LABELS = lifecycleConfig.reportStatuses
export const REPORT_STATUS_VALUES = Object.keys(lifecycleConfig.reportStatuses)

export const DEFAULT_TPI_STATUS = 'draft'
export const DEFAULT_JOURNAL_STATUS = 'not_started'
export const DEFAULT_REPORT_STATUS = 'not_started'

export const getTpiStatusLabel = (status) =>
  TPI_STATUS_LABELS[status] || TPI_STATUS_LABELS[DEFAULT_TPI_STATUS]

export const getJournalStatusLabel = (status) =>
  JOURNAL_STATUS_LABELS[status] || JOURNAL_STATUS_LABELS[DEFAULT_JOURNAL_STATUS]

export const getReportStatusLabel = (status) =>
  REPORT_STATUS_LABELS[status] || REPORT_STATUS_LABELS[DEFAULT_REPORT_STATUS]

export default lifecycleConfig
