const {
  DEFAULT_TPI_STATUS,
  TPI_STATUS,
  TPI_TRANSITIONS,
  isTpiStatus,
  lifecycleConfig
} = require('./constants')
const {
  compactText,
  normalizeDateValue,
  normalizeTpiStatus
} = require('./normalization')
const { COORDINATION_STATUS, normalizeCoordinationStatus } = require('../coordination/status')

function toDate(value) {
  const normalized = normalizeDateValue(value)

  if (!normalized) {
    return null
  }

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function issue(type, severity, message, details = {}) {
  return {
    type,
    severity,
    message,
    ...details
  }
}

function hasBlockingIssues(issues = []) {
  return (Array.isArray(issues) ? issues : []).some((entry) => entry?.severity === 'error')
}

function validateDateOrder(tpi = {}) {
  const issues = []
  const dates = tpi.dates || {}
  const dateMap = {
    depart: toDate(dates.depart),
    fin: toDate(dates.fin),
    premiereVisite: toDate(dates.premiereVisite),
    deuxiemeVisite: toDate(dates.deuxiemeVisite),
    renduFinal: toDate(dates.renduFinal),
    soutenance: toDate(dates.soutenance)
  }

  for (const [fieldName, rawValue] of Object.entries(dates)) {
    if (rawValue && !toDate(rawValue)) {
      issues.push(issue(
        'invalid_date',
        'error',
        `Date TPI invalide: ${fieldName}.`,
        { field: `dates.${fieldName}` }
      ))
    }
  }

  if (dateMap.depart && dateMap.fin && dateMap.depart > dateMap.fin) {
    issues.push(issue(
      'tpi_date_order',
      'error',
      'La date de debut doit preceder la date de fin.',
      { fields: ['dates.depart', 'dates.fin'] }
    ))
  }

  if (dateMap.premiereVisite && dateMap.depart && dateMap.premiereVisite < dateMap.depart) {
    issues.push(issue(
      'visit_before_start',
      'error',
      'La premiere visite ne peut pas preceder le debut du TPI.',
      { fields: ['dates.depart', 'dates.premiereVisite'] }
    ))
  }

  if (dateMap.premiereVisite && dateMap.fin && dateMap.premiereVisite > dateMap.fin) {
    issues.push(issue(
      'visit_after_end',
      'error',
      'La premiere visite doit rester dans la periode du TPI.',
      { fields: ['dates.premiereVisite', 'dates.fin'] }
    ))
  }

  if (dateMap.deuxiemeVisite && dateMap.premiereVisite && dateMap.deuxiemeVisite < dateMap.premiereVisite) {
    issues.push(issue(
      'second_visit_before_first',
      'error',
      'La deuxieme visite ne peut pas preceder la premiere visite.',
      { fields: ['dates.premiereVisite', 'dates.deuxiemeVisite'] }
    ))
  }

  if (dateMap.deuxiemeVisite && dateMap.fin && dateMap.deuxiemeVisite > dateMap.fin) {
    issues.push(issue(
      'visit_after_end',
      'error',
      'La deuxieme visite doit rester dans la periode du TPI.',
      { fields: ['dates.deuxiemeVisite', 'dates.fin'] }
    ))
  }

  if (dateMap.renduFinal && dateMap.fin && dateMap.renduFinal < dateMap.fin) {
    issues.push(issue(
      'report_due_before_end',
      'error',
      'Le rendu final ne peut pas preceder la fin du TPI.',
      { fields: ['dates.fin', 'dates.renduFinal'] }
    ))
  }

  if (dateMap.soutenance && dateMap.renduFinal && dateMap.soutenance < dateMap.renduFinal) {
    issues.push(issue(
      'defense_before_report_due',
      'error',
      'La defense ne peut pas preceder le rendu final.',
      { fields: ['dates.renduFinal', 'dates.soutenance'] }
    ))
  }

  return issues
}

function validateJournalRules(tpi = {}) {
  const issues = []
  const dates = tpi.dates || {}
  const journal = tpi.journal || {}
  const startDate = toDate(dates.depart)
  const endDate = toDate(dates.renduFinal) || toDate(dates.fin) || toDate(dates.soutenance)
  const lastEntryDate = toDate(journal.lastEntryAt)

  if (journal.lastEntryAt && !lastEntryDate) {
    issues.push(issue(
      'invalid_journal_date',
      'error',
      'La derniere entree du journal a une date invalide.',
      { field: 'journal.lastEntryAt' }
    ))
  }

  if (journal.status && journal.status !== 'not_started' && !startDate) {
    issues.push(issue(
      'journal_requires_start_date',
      'error',
      'Le suivi du journal exige une date de debut TPI.',
      { field: 'dates.depart' }
    ))
  }

  if (lastEntryDate && startDate && lastEntryDate < startDate) {
    issues.push(issue(
      'journal_before_start',
      'error',
      'Une entree de journal ne peut pas preceder le debut du TPI.',
      { fields: ['dates.depart', 'journal.lastEntryAt'] }
    ))
  }

  if (lastEntryDate && endDate && lastEntryDate > endDate) {
    issues.push(issue(
      'journal_after_end',
      'warning',
      'La derniere entree de journal est posterieure a la periode attendue.',
      { fields: ['journal.lastEntryAt', 'dates.renduFinal'] }
    ))
  }

  for (const [index, entry] of (Array.isArray(journal.entries) ? journal.entries : []).entries()) {
    const entryDate = toDate(entry?.date)

    if (entry?.date && !entryDate) {
      issues.push(issue(
        'invalid_journal_entry_date',
        'error',
        `Entree de journal ${index + 1}: date invalide.`,
        { field: `journal.entries.${index}.date` }
      ))
      continue
    }

    if (entryDate && startDate && entryDate < startDate) {
      issues.push(issue(
        'journal_entry_before_start',
        'error',
        `Entree de journal ${index + 1}: date avant le debut du TPI.`,
        { field: `journal.entries.${index}.date` }
      ))
    }
  }

  return issues
}

function validateRapportRules(tpi = {}) {
  const issues = []
  const dates = tpi.dates || {}
  const rapport = tpi.rapport || {}
  const startDate = toDate(dates.depart)
  const dueDate = toDate(rapport.dueAt) || toDate(dates.renduFinal)
  const submittedAt = toDate(rapport.submittedAt)
  const requiresSubmission = ['submitted', 'validated', 'rejected'].includes(rapport.status)

  if (rapport.submittedAt && !submittedAt) {
    issues.push(issue(
      'invalid_report_submission_date',
      'error',
      'La date de depot du rapport est invalide.',
      { field: 'rapport.submittedAt' }
    ))
  }

  if (rapport.dueAt && !toDate(rapport.dueAt)) {
    issues.push(issue(
      'invalid_report_due_date',
      'error',
      'La date limite du rapport est invalide.',
      { field: 'rapport.dueAt' }
    ))
  }

  if (requiresSubmission && !submittedAt && !compactText(rapport.url)) {
    issues.push(issue(
      'report_submission_missing',
      'error',
      'Un rapport depose, valide ou rejete doit avoir une date de depot ou un lien.',
      { fields: ['rapport.submittedAt', 'rapport.url'] }
    ))
  }

  if (submittedAt && startDate && submittedAt < startDate) {
    issues.push(issue(
      'report_before_start',
      'error',
      'Le rapport ne peut pas etre depose avant le debut du TPI.',
      { fields: ['dates.depart', 'rapport.submittedAt'] }
    ))
  }

  if (submittedAt && dueDate && submittedAt > dueDate) {
    issues.push(issue(
      'report_submitted_late',
      'warning',
      'Le rapport est depose apres le delai prevu.',
      { fields: ['rapport.submittedAt', 'rapport.dueAt'] }
    ))
  }

  return issues
}

function validateTpiRules(tpi = {}) {
  const issues = [
    ...validateDateOrder(tpi),
    ...validateJournalRules(tpi),
    ...validateRapportRules(tpi)
  ]

  return {
    isValid: !hasBlockingIssues(issues),
    issues
  }
}

function canTransitionTpiStatus(fromStatus, toStatus) {
  const normalizedFrom = normalizeTpiStatus(fromStatus || DEFAULT_TPI_STATUS)
  const normalizedTo = normalizeTpiStatus(toStatus || normalizedFrom)

  if (normalizedFrom === normalizedTo) {
    return true
  }

  return (TPI_TRANSITIONS[normalizedFrom] || []).includes(normalizedTo)
}

function validateStatusTransition(fromStatus, toStatus) {
  const normalizedFrom = normalizeTpiStatus(fromStatus || DEFAULT_TPI_STATUS)
  const normalizedTo = normalizeTpiStatus(toStatus || normalizedFrom)

  if (canTransitionTpiStatus(normalizedFrom, normalizedTo)) {
    return {
      isValid: true,
      from: normalizedFrom,
      to: normalizedTo,
      issue: null
    }
  }

  return {
    isValid: false,
    from: normalizedFrom,
    to: normalizedTo,
    issue: issue(
      'invalid_status_transition',
      'error',
      `Transition TPI impossible: ${lifecycleConfig.statuses[normalizedFrom]} -> ${lifecycleConfig.statuses[normalizedTo]}.`,
      {
        from: normalizedFrom,
        to: normalizedTo,
        allowedTransitions: TPI_TRANSITIONS[normalizedFrom] || []
      }
    )
  }
}

const STATUS_PROGRESS_RANK = Object.freeze({
  [TPI_STATUS.DRAFT]: 0,
  [TPI_STATUS.STAKEHOLDERS_PENDING]: 1,
  [TPI_STATUS.READY_FOR_PLANNING]: 2,
  [TPI_STATUS.IMPORTED_TO_PLANNING]: 3,
  [TPI_STATUS.DEFENSE_SCHEDULED]: 4,
  [TPI_STATUS.JOURNAL_REVIEW]: 5,
  [TPI_STATUS.REPORT_REVIEW]: 6,
  [TPI_STATUS.COMPLETED]: 7,
  [TPI_STATUS.CANCELLED]: 99
})

function readExplicitLifecycleStatus(tpi = {}) {
  const status = compactText(tpi.status)
  return isTpiStatus(status) ? status : null
}

function deriveCoordinationLifecycleStatus(planningTpi = null) {
  if (!planningTpi) {
    return null
  }

  const status = normalizeCoordinationStatus(planningTpi.status)

  if (status === COORDINATION_STATUS.CANCELLED) {
    return TPI_STATUS.CANCELLED
  }

  if (status === COORDINATION_STATUS.COMPLETED) {
    return TPI_STATUS.COMPLETED
  }

  if (status === COORDINATION_STATUS.CONFIRMED) {
    return TPI_STATUS.DEFENSE_SCHEDULED
  }

  return TPI_STATUS.IMPORTED_TO_PLANNING
}

function chooseMostAdvancedStatus(currentStatus, derivedStatus) {
  if (!derivedStatus) {
    return currentStatus
  }

  if (!currentStatus) {
    return derivedStatus
  }

  if (derivedStatus === TPI_STATUS.CANCELLED || currentStatus === TPI_STATUS.CANCELLED) {
    return derivedStatus === TPI_STATUS.CANCELLED ? derivedStatus : currentStatus
  }

  const currentRank = STATUS_PROGRESS_RANK[currentStatus] ?? 0
  const derivedRank = STATUS_PROGRESS_RANK[derivedStatus] ?? 0

  return derivedRank > currentRank ? derivedStatus : currentStatus
}

function deriveLifecycleStatus({
  tpi = {},
  stakeholderValidation = null,
  planningTpi = null
} = {}) {
  const explicitStatus = readExplicitLifecycleStatus(tpi)
  const coordinationStatus = deriveCoordinationLifecycleStatus(planningTpi)
  const defenseDateStatus = tpi?.dates?.soutenance
    ? TPI_STATUS.DEFENSE_SCHEDULED
    : null

  if (coordinationStatus) {
    return chooseMostAdvancedStatus(explicitStatus, coordinationStatus)
  }

  if (defenseDateStatus) {
    return chooseMostAdvancedStatus(explicitStatus, defenseDateStatus)
  }

  if (explicitStatus) {
    return explicitStatus
  }

  if (stakeholderValidation && !stakeholderValidation.isValidated) {
    return TPI_STATUS.STAKEHOLDERS_PENDING
  }

  if (stakeholderValidation?.isValidated) {
    return TPI_STATUS.READY_FOR_PLANNING
  }

  return DEFAULT_TPI_STATUS
}

function buildLifecycleSnapshot({
  tpi = {},
  stakeholderValidation = null,
  planningTpi = null,
  ruleIssues = []
} = {}) {
  const status = deriveLifecycleStatus({
    tpi,
    stakeholderValidation,
    planningTpi
  })
  const issues = Array.isArray(ruleIssues) ? ruleIssues : []

  return {
    status,
    label: lifecycleConfig.statuses[status] || status,
    canTransitionTo: TPI_TRANSITIONS[status] || [],
    blockingIssueCount: issues.filter((entry) => entry?.severity === 'error').length,
    warningCount: issues.filter((entry) => entry?.severity === 'warning').length
  }
}

module.exports = {
  buildLifecycleSnapshot,
  canTransitionTpiStatus,
  deriveLifecycleStatus,
  hasBlockingIssues,
  validateDateOrder,
  validateJournalRules,
  validateRapportRules,
  validateStatusTransition,
  validateTpiRules
}
