const Person = require('../models/personModel')
const TpiModelsYear = require('../models/tpiModels')
const TpiPlanning = require('../models/tpiPlanningModel')
const Vote = require('../models/voteModel')
const { validateLegacyTpiStakeholders } = require('./tpiStakeholderService')
const { enrichLegacyTpisWithDerivedDates } = require('./legacyTpiDateEnrichmentService')

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function uniqueList(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)))
}

function normalizeTpiDossierRef(year, ref) {
  const rawRef = compactText(ref)
  const workflowPrefix = `TPI-${year}-`
  const isWorkflowReference = rawRef.toUpperCase().startsWith(workflowPrefix.toUpperCase())
  const legacyRef = compactText(isWorkflowReference ? rawRef.slice(workflowPrefix.length) : rawRef)
  const workflowReference = compactText(legacyRef ? `${workflowPrefix}${legacyRef}` : rawRef)

  return {
    rawRef,
    legacyRef,
    workflowReference,
    legacyCandidates: uniqueList([rawRef, legacyRef, workflowReference]),
    workflowCandidates: uniqueList([rawRef, workflowReference])
  }
}

async function resolveQueryResult(query) {
  if (!query) {
    return null
  }

  if (typeof query.lean === 'function') {
    return await query.lean()
  }

  return await query
}

async function findLegacyTpi(year, normalizedRef) {
  if (!normalizedRef?.legacyCandidates?.length) {
    return null
  }

  return await resolveQueryResult(
    TpiModelsYear(year).findOne({
      refTpi: { $in: normalizedRef.legacyCandidates }
    })
  )
}

async function findPlanningTpi(year, normalizedRef) {
  if (!normalizedRef?.workflowCandidates?.length) {
    return null
  }

  const query = TpiPlanning.findOne({
    year,
    reference: { $in: normalizedRef.workflowCandidates }
  })
    .populate('candidat expert1 expert2 chefProjet', 'firstName lastName email roles')
    .populate('proposedSlots.slot', 'date period startTime endTime room status')
    .populate('confirmedSlot', 'date period startTime endTime room status')

  return await resolveQueryResult(query)
}

async function findPlanningVotes(tpiPlanningId) {
  if (!compactText(tpiPlanningId)) {
    return []
  }

  const query = Vote.find({ tpiPlanning: tpiPlanningId })
    .populate('slot', 'date period startTime endTime room status')
    .populate('voter', 'firstName lastName email')
    .sort({ createdAt: 1 })

  const votes = await resolveQueryResult(query)
  return Array.isArray(votes) ? votes : []
}

function buildVoteSummary(votes = []) {
  const safeVotes = Array.isArray(votes) ? votes : []

  return safeVotes.reduce((summary, vote) => {
    const decision = compactText(vote?.decision) || 'pending'

    summary.totalVotes += 1

    if (decision === 'accepted') {
      summary.acceptedVotes += 1
    } else if (decision === 'preferred') {
      summary.preferredVotes += 1
    } else if (decision === 'rejected') {
      summary.rejectedVotes += 1
    } else {
      summary.pendingVotes += 1
    }

    if (decision !== 'pending') {
      summary.respondedVotes += 1
    }

    return summary
  }, {
    totalVotes: 0,
    pendingVotes: 0,
    acceptedVotes: 0,
    preferredVotes: 0,
    rejectedVotes: 0,
    respondedVotes: 0
  })
}

function getPlannedSlot(tpi) {
  if (!tpi) {
    return null
  }

  if (tpi.confirmedSlot) {
    return tpi.confirmedSlot
  }

  const proposedSlot = Array.isArray(tpi.proposedSlots)
    ? tpi.proposedSlots.find((entry) => entry?.slot)?.slot || null
    : null

  return proposedSlot
}

function buildLegacyConsistencyIssues(legacyTpi, stakeholderState, planningTpi) {
  const issues = []

  if (legacyTpi && !planningTpi) {
    issues.push({
      type: 'legacy_tpi_not_imported',
      severity: 'warning',
      message: 'Fiche présente dans GestionTPI mais absente de Planning.'
    })
  }

  if (!legacyTpi && planningTpi) {
    issues.push({
      type: 'planning_tpi_missing_legacy',
      severity: 'warning',
      message: 'Fiche présente dans Planning mais absente de GestionTPI.'
    })
  }

  if (legacyTpi && stakeholderState && stakeholderState.isComplete === false) {
    issues.push({
      type: 'legacy_tpi_missing_stakeholders',
      severity: 'warning',
      message: `GestionTPI: parties prenantes manquantes (${stakeholderState.missingRoles.join(', ')}).`
    })
  }

  if (legacyTpi && stakeholderState && stakeholderState.isResolved === false) {
    issues.push({
      type: 'legacy_tpi_unresolved_stakeholders',
      severity: 'warning',
      message: `GestionTPI: parties prenantes à confirmer dans le référentiel (${stakeholderState.unresolvedRoles.join(', ')}).`
    })
  }

  return issues
}

async function buildLegacyStakeholderState(legacyTpi, year) {
  if (!legacyTpi) {
    return {
      isComplete: false,
      isResolved: false,
      isValidated: false,
      missingRoles: [],
      unresolvedRoles: []
    }
  }

  const people = await Person.find({ isActive: true })
    .select('firstName lastName email roles candidateYears')
    .lean()

  const validation = validateLegacyTpiStakeholders(legacyTpi, {
    people,
    year,
    requireResolved: true
  })

  return {
    isComplete: validation.isComplete,
    isResolved: validation.unresolvedRoles.length === 0,
    isValidated: validation.isValidated,
    missingRoles: validation.missingRoles,
    unresolvedRoles: validation.unresolvedRoles
  }
}

async function getTpiDossierByRef(year, ref) {
  const normalizedYear = Number.parseInt(year, 10)
  const normalizedRef = normalizeTpiDossierRef(normalizedYear, ref)

  if (!Number.isInteger(normalizedYear) || !normalizedRef.rawRef) {
    return null
  }

  const [legacyTpi, planningTpi] = await Promise.all([
    findLegacyTpi(normalizedYear, normalizedRef),
    findPlanningTpi(normalizedYear, normalizedRef)
  ])

  if (!legacyTpi && !planningTpi) {
    return null
  }

  const [enrichedLegacyTpi] = legacyTpi
    ? await enrichLegacyTpisWithDerivedDates(normalizedYear, [legacyTpi])
    : [null]

  const stakeholderState = enrichedLegacyTpi
    ? await buildLegacyStakeholderState(enrichedLegacyTpi, normalizedYear)
    : {
        isComplete: false,
        isResolved: false,
        isValidated: false,
        missingRoles: [],
        unresolvedRoles: []
      }

  const planningVotes = planningTpi?._id
    ? await findPlanningVotes(planningTpi._id)
    : []

  return {
    year: normalizedYear,
    ref: normalizedRef.legacyRef || normalizedRef.rawRef,
    identifiers: {
      legacyRef: normalizedRef.legacyRef || compactText(enrichedLegacyTpi?.refTpi),
      workflowReference: compactText(planningTpi?.reference) || normalizedRef.workflowReference,
      legacyId: compactText(enrichedLegacyTpi?._id),
      workflowId: compactText(planningTpi?._id)
    },
    legacy: {
      exists: Boolean(enrichedLegacyTpi),
      data: enrichedLegacyTpi || null,
      stakeholderState
    },
    planning: {
      exists: Boolean(planningTpi),
      data: planningTpi || null,
      votes: planningVotes,
      voteSummary: buildVoteSummary(planningVotes),
      workflowVoteSummary: planningTpi?.votingSession?.voteSummary || null,
      plannedSlot: getPlannedSlot(planningTpi)
    },
    consistency: {
      importedToPlanning: Boolean(enrichedLegacyTpi && planningTpi),
      issues: buildLegacyConsistencyIssues(enrichedLegacyTpi, stakeholderState, planningTpi)
    }
  }
}

module.exports = {
  buildVoteSummary,
  getTpiDossierByRef,
  normalizeTpiDossierRef
}
