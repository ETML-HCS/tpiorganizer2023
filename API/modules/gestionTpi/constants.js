const lifecycleConfig = require('../../../shared/gestionTpiLifecycle.json')

const TPI_STATUS = Object.freeze(
  Object.fromEntries(
    Object.keys(lifecycleConfig.statuses).map((status) => [
      status.toUpperCase(),
      status
    ])
  )
)

const TPI_STATUS_VALUES = Object.freeze(Object.keys(lifecycleConfig.statuses))
const JOURNAL_STATUS_VALUES = Object.freeze(Object.keys(lifecycleConfig.journalStatuses))
const REPORT_STATUS_VALUES = Object.freeze(Object.keys(lifecycleConfig.reportStatuses))
const TPI_TRANSITIONS = Object.freeze(lifecycleConfig.transitions)

const DEFAULT_TPI_STATUS = 'draft'
const DEFAULT_JOURNAL_STATUS = 'not_started'
const DEFAULT_REPORT_STATUS = 'not_started'

function isTpiStatus(value) {
  return TPI_STATUS_VALUES.includes(value)
}

function isJournalStatus(value) {
  return JOURNAL_STATUS_VALUES.includes(value)
}

function isReportStatus(value) {
  return REPORT_STATUS_VALUES.includes(value)
}

module.exports = {
  DEFAULT_JOURNAL_STATUS,
  DEFAULT_REPORT_STATUS,
  DEFAULT_TPI_STATUS,
  JOURNAL_STATUS_VALUES,
  REPORT_STATUS_VALUES,
  TPI_STATUS,
  TPI_STATUS_VALUES,
  TPI_TRANSITIONS,
  isJournalStatus,
  isReportStatus,
  isTpiStatus,
  lifecycleConfig
}
