const mongoose = require('mongoose')

const Person = require('../../models/personModel')
const TpiModelsYear = require('../../models/tpiModels')
const TpiPlanning = require('../../models/tpiCoordinationModel')
const { deleteTpiCatalogByYear } = require('../../services/tpiCatalogService')
const { enrichLegacyTpisWithDerivedDates } = require('../../services/legacyTpiDateEnrichmentService')
const { normalizeText } = require('../../services/personIdentityService')
const { resolveUniquePersonForRole } = require('../../services/personRegistryService')
const {
  linkLegacyTpiStakeholders,
  validateLegacyTpiStakeholders
} = require('../../services/tpiStakeholderService')
const {
  buildLifecycleSnapshot,
  validateStatusTransition,
  validateTpiRules
} = require('./rules')
const { TPI_STATUS } = require('./constants')
const {
  compactText,
  normalizePersonId,
  normalizeTpiDossierRef,
  normalizeTpiPayload,
  normalizeYear,
  toPlainObject
} = require('./normalization')

const PERSON_SELECT_FIELDS = 'firstName lastName email roles candidateYears isActive'
const LEGACY_TPI_PERSON_ID_FIELDS = Object.freeze([
  'candidatPersonId',
  'expert1PersonId',
  'expert2PersonId',
  'bossPersonId'
])
const STATUSES_REQUIRING_VALIDATED_STAKEHOLDERS = new Set([
  TPI_STATUS.READY_FOR_PLANNING,
  TPI_STATUS.IMPORTED_TO_PLANNING,
  TPI_STATUS.DEFENSE_SCHEDULED,
  TPI_STATUS.JOURNAL_REVIEW,
  TPI_STATUS.REPORT_REVIEW,
  TPI_STATUS.COMPLETED
])
const defaultTpiPlanningFind = TpiPlanning.find

class GestionTpiError extends Error {
  constructor(message, statusCode = 400, details = {}) {
    super(message)
    this.name = 'GestionTpiError'
    this.statusCode = statusCode
    this.details = details
  }
}

function normalizeCandidateQuery(value = '') {
  return normalizeText(value).toLowerCase()
}

function hasYearValue(value) {
  return compactText(value) !== ''
}

function extractLegacyTpiParticipantLinkUpdates(previousTpi = {}, nextTpi = {}) {
  const updates = {}

  for (const fieldName of LEGACY_TPI_PERSON_ID_FIELDS) {
    const previousValue = normalizePersonId(previousTpi?.[fieldName])
    const nextValue = normalizePersonId(nextTpi?.[fieldName])

    if (!previousValue && nextValue) {
      updates[fieldName] = nextValue
    }
  }

  return updates
}

async function loadActivePeople() {
  return await Person.find({ isActive: true })
    .select(PERSON_SELECT_FIELDS)
    .lean()
}

function buildStakeholderState(validation) {
  return {
    isComplete: validation.isComplete,
    isResolved: validation.unresolvedRoles.length === 0,
    isValidated: validation.isValidated,
    missingRoles: validation.missingRoles,
    unresolvedRoles: validation.unresolvedRoles
  }
}

function addValidationSnapshot(tpi, validation, ruleValidation, lifecycle) {
  return {
    ...tpi,
    status: lifecycle.status,
    stakeholderState: buildStakeholderState(validation),
    lifecycle,
    validation: {
      ...(tpi.validation && typeof tpi.validation === 'object' ? tpi.validation : {}),
      issues: ruleValidation.issues,
      isValid: ruleValidation.isValid,
      lastValidatedAt: new Date().toISOString()
    }
  }
}

async function hydrateLegacyTpisFromPeopleRegistry(year, models = [], people = null) {
  const sourceModels = Array.isArray(models) ? models : []

  if (sourceModels.length === 0) {
    return []
  }

  const activePeople = Array.isArray(people) ? people : await loadActivePeople()
  const TpiModel = TpiModelsYear(year)
  const bulkOperations = []

  const hydratedModels = sourceModels.map((model) => {
    const plainModel = toPlainObject(model)
    const { tpi: linkedModel, validation } = linkLegacyTpiStakeholders(plainModel, activePeople, { year })
    const linkUpdates = extractLegacyTpiParticipantLinkUpdates(plainModel, linkedModel)

    if (plainModel?._id && Object.keys(linkUpdates).length > 0) {
      bulkOperations.push({
        updateOne: {
          filter: { _id: plainModel._id },
          update: { $set: linkUpdates }
        }
      })
    }

    return {
      tpi: linkedModel,
      stakeholderValidation: validation
    }
  })

  if (bulkOperations.length > 0) {
    await TpiModel.bulkWrite(bulkOperations)
  }

  return hydratedModels
}

async function findPlanningTpisForLegacyRefs(year, legacyRefs = []) {
  const refDescriptors = (Array.isArray(legacyRefs) ? legacyRefs : [])
    .map((ref) => normalizeTpiDossierRef(year, ref))
    .filter((descriptor) => descriptor.rawRef)

  if (refDescriptors.length === 0) {
    return new Map()
  }

  const canQueryPlanning = mongoose.connection.readyState === 1 ||
    TpiPlanning.find !== defaultTpiPlanningFind

  if (!canQueryPlanning) {
    return new Map()
  }

  const workflowRefs = Array.from(new Set(
    refDescriptors
      .flatMap((descriptor) => descriptor.workflowCandidates)
      .map(compactText)
      .filter(Boolean)
  ))
  const planningTpis = await TpiPlanning.find({
    year,
    reference: { $in: workflowRefs }
  })
    .select('_id reference status confirmedSlot')
    .lean()

  const planningByReference = new Map()

  for (const tpi of Array.isArray(planningTpis) ? planningTpis : []) {
    const normalizedRef = normalizeTpiDossierRef(year, tpi.reference)

    for (const candidate of normalizedRef.legacyCandidates) {
      const lookupKey = compactText(candidate)

      if (lookupKey) {
        planningByReference.set(lookupKey, tpi)
      }
    }
  }

  return planningByReference
}

async function listGestionTpis(year) {
  const normalizedYear = normalizeYear(year)

  if (!normalizedYear) {
    throw new GestionTpiError(hasYearValue(year) ? 'Année invalide.' : 'Année manquante.', 400)
  }

  const models = await TpiModelsYear(normalizedYear).find()
  const people = await loadActivePeople()
  const hydratedModels = await hydrateLegacyTpisFromPeopleRegistry(normalizedYear, models, people)
  const enrichedModels = await enrichLegacyTpisWithDerivedDates(
    normalizedYear,
    hydratedModels.map((entry) => entry.tpi)
  )
  const stakeholderById = new Map(
    hydratedModels.map((entry) => [
      compactText(entry.tpi?._id),
      entry.stakeholderValidation
    ])
  )
  const planningByLegacyRef = await findPlanningTpisForLegacyRefs(
    normalizedYear,
    enrichedModels.map((tpi) => tpi?.refTpi)
  )

  return enrichedModels.map((tpi) => {
    const stakeholderValidation = stakeholderById.get(compactText(tpi?._id)) ||
      validateLegacyTpiStakeholders(tpi, {
        people,
        year: normalizedYear,
        requireResolved: true
      })
    const planningTpi = planningByLegacyRef.get(compactText(tpi?.refTpi)) || null
    const ruleValidation = validateTpiRules(tpi)
    const lifecycle = buildLifecycleSnapshot({
      tpi,
      stakeholderValidation,
      planningTpi,
      ruleIssues: ruleValidation.issues
    })

    return addValidationSnapshot(tpi, stakeholderValidation, ruleValidation, lifecycle)
  })
}

async function linkTpiParticipantsFromPeopleRegistry(payload, options = {}) {
  const people = await loadActivePeople()
  return {
    people,
    ...linkLegacyTpiStakeholders(payload, people, options)
  }
}

function assertRuleValidation(ruleValidation) {
  if (ruleValidation.isValid) {
    return
  }

  throw new GestionTpiError('Les règles TPI ne sont pas respectées.', 400, {
    issues: ruleValidation.issues
  })
}

function assertStakeholderValidation(validation) {
  if (validation.isValidated) {
    return
  }

  throw new GestionTpiError(
    'Les parties prenantes doivent être validées dans le référentiel avant la création manuelle du TPI.',
    400,
    {
      missingRoles: validation.missingRoles,
      unresolvedRoles: validation.unresolvedRoles
    }
  )
}

function assertStatusStakeholderCompatibility(validation, status) {
  if (
    !STATUSES_REQUIRING_VALIDATED_STAKEHOLDERS.has(status) ||
    validation?.isValidated
  ) {
    return
  }

  throw new GestionTpiError(
    'Le statut demandé exige des parties prenantes validées.',
    400,
    {
      status,
      missingRoles: validation.missingRoles || [],
      unresolvedRoles: validation.unresolvedRoles || []
    }
  )
}

async function saveGestionTpi(year, body = {}) {
  const normalizedYear = normalizeYear(year)

  if (!normalizedYear) {
    throw new GestionTpiError('Année invalide.', 400)
  }

  const normalizedPayload = normalizeTpiPayload(body)

  if (!normalizedPayload.refTpi) {
    throw new GestionTpiError('refTpi requis.', 400)
  }

  const {
    tpi: linkedPayload,
    validation: stakeholderValidation,
    people
  } = await linkTpiParticipantsFromPeopleRegistry(normalizedPayload, { year: normalizedYear })
  const validationMode = body?.validationMode === 'import' ? 'import' : 'manual'

  if (validationMode === 'manual') {
    assertStakeholderValidation(
      validateLegacyTpiStakeholders(linkedPayload, {
        people,
        year: normalizedYear,
        requireResolved: true
      })
    )
  }

  const ruleValidation = validateTpiRules(linkedPayload)
  assertRuleValidation(ruleValidation)

  const lifecycle = buildLifecycleSnapshot({
    tpi: linkedPayload,
    stakeholderValidation,
    ruleIssues: ruleValidation.issues
  })
  const nextStatus = linkedPayload.status || lifecycle.status

  assertStatusStakeholderCompatibility(stakeholderValidation, nextStatus)

  const updateData = {
    ...linkedPayload,
    status: nextStatus,
    validation: {
      issues: ruleValidation.issues,
      isValid: ruleValidation.isValid,
      lastValidatedAt: new Date()
    }
  }

  return await TpiModelsYear(normalizedYear).findOneAndUpdate(
    { refTpi: updateData.refTpi },
    updateData,
    { upsert: true, new: true }
  )
}

async function updateGestionTpi(year, id, body = {}) {
  const normalizedYear = normalizeYear(year)
  const tpiId = compactText(id)

  if (!normalizedYear || !tpiId) {
    throw new GestionTpiError('Données invalides fournies.', 400)
  }

  const TpiModel = TpiModelsYear(normalizedYear)
  const existingTpi = await TpiModel.findById(tpiId)

  if (!existingTpi) {
    throw new GestionTpiError('TPI introuvable.', 404)
  }

  const existingPlain = toPlainObject(existingTpi) || {}
  const sourceBody = body && typeof body === 'object' && !Array.isArray(body)
    ? body
    : {}
  const mergedBody = {
    ...existingPlain,
    ...sourceBody,
    experts: {
      ...(existingPlain.experts && typeof existingPlain.experts === 'object' ? existingPlain.experts : {}),
      ...(sourceBody.experts && typeof sourceBody.experts === 'object' ? sourceBody.experts : {})
    },
    lieu: {
      ...(existingPlain.lieu && typeof existingPlain.lieu === 'object' ? existingPlain.lieu : {}),
      ...(sourceBody.lieu && typeof sourceBody.lieu === 'object' ? sourceBody.lieu : {})
    },
    dates: {
      ...(existingPlain.dates && typeof existingPlain.dates === 'object' ? existingPlain.dates : {}),
      ...(sourceBody.dates && typeof sourceBody.dates === 'object' ? sourceBody.dates : {})
    },
    evaluation: {
      ...(existingPlain.evaluation && typeof existingPlain.evaluation === 'object' ? existingPlain.evaluation : {}),
      ...(sourceBody.evaluation && typeof sourceBody.evaluation === 'object' ? sourceBody.evaluation : {})
    },
    journal: {
      ...(existingPlain.journal && typeof existingPlain.journal === 'object' ? existingPlain.journal : {}),
      ...(sourceBody.journal && typeof sourceBody.journal === 'object' ? sourceBody.journal : {})
    },
    rapport: {
      ...(existingPlain.rapport && typeof existingPlain.rapport === 'object' ? existingPlain.rapport : {}),
      ...(sourceBody.rapport && typeof sourceBody.rapport === 'object' ? sourceBody.rapport : {})
    }
  }
  const normalizedPayload = normalizeTpiPayload(mergedBody)
  const {
    tpi: linkedPayload,
    validation: stakeholderValidation
  } = await linkTpiParticipantsFromPeopleRegistry(normalizedPayload, { year: normalizedYear })
  const previousStatus = existingTpi.status || 'draft'
  const nextStatus = linkedPayload.status || previousStatus
  const transition = validateStatusTransition(previousStatus, nextStatus)

  if (!transition.isValid) {
    throw new GestionTpiError('Transition de statut TPI invalide.', 400, transition.issue)
  }

  if (Object.prototype.hasOwnProperty.call(sourceBody, 'status') || transition.from !== transition.to) {
    assertStatusStakeholderCompatibility(stakeholderValidation, transition.to)
  }

  const ruleValidation = validateTpiRules(linkedPayload)
  assertRuleValidation(ruleValidation)

  const lifecycle = buildLifecycleSnapshot({
    tpi: {
      ...linkedPayload,
      status: nextStatus
    },
    stakeholderValidation,
    ruleIssues: ruleValidation.issues
  })
  const statusHistory = Array.isArray(existingTpi.statusHistory)
    ? existingTpi.statusHistory
    : []
  const shouldAppendStatusHistory = transition.from !== transition.to
  const updateData = {
    ...linkedPayload,
    status: transition.to,
    validation: {
      issues: ruleValidation.issues,
      isValid: ruleValidation.isValid,
      lastValidatedAt: new Date()
    }
  }

  if (shouldAppendStatusHistory) {
    updateData.statusHistory = [
      ...statusHistory,
      {
        from: transition.from,
        to: transition.to,
        at: new Date(),
        reason: compactText(body?.statusReason)
      }
    ]
  }

  const updatedTpi = await TpiModel.findByIdAndUpdate(tpiId, updateData, {
    new: true
  })

  return {
    ...(toPlainObject(updatedTpi) || updatedTpi),
    lifecycle
  }
}

async function findGestionTpisByCandidate(year, candidateName) {
  const normalizedYear = normalizeYear(year)
  const normalizedCandidateName = compactText(candidateName)

  if (!normalizedYear) {
    throw new GestionTpiError('Année invalide.', 400)
  }

  if (!normalizedCandidateName) {
    throw new GestionTpiError('Nom du candidat requis.', 400)
  }

  const [models, people] = await Promise.all([
    TpiModelsYear(normalizedYear).find().lean(),
    loadActivePeople()
  ])
  const normalizedQuery = normalizeCandidateQuery(normalizedCandidateName)
  const resolvedPerson = resolveUniquePersonForRole(normalizedCandidateName, people, 'candidat', {
    year: normalizedYear
  }).person
  const resolvedPersonId = resolvedPerson?._id ? String(resolvedPerson._id) : null

  const matches = models
    .filter((tpi) => {
      const storedCandidate = normalizeCandidateQuery(tpi?.candidat || '')
      const storedCandidatePersonId = tpi?.candidatPersonId ? String(tpi.candidatPersonId) : null

      return Boolean(
        (resolvedPersonId && storedCandidatePersonId === resolvedPersonId) ||
        (normalizedQuery && storedCandidate.includes(normalizedQuery))
      )
    })
    .sort((left, right) => String(left.refTpi || '').localeCompare(String(right.refTpi || ''), 'fr', {
      numeric: true,
      sensitivity: 'base'
    }))

  if (matches.length === 0) {
    throw new GestionTpiError('Aucun TPI trouvé pour ce candidat.', 404)
  }

  return matches
}

async function deleteGestionTpiYear(year) {
  return await deleteTpiCatalogByYear(year)
}

module.exports = {
  GestionTpiError,
  deleteGestionTpiYear,
  findGestionTpisByCandidate,
  hydrateLegacyTpisFromPeopleRegistry,
  listGestionTpis,
  saveGestionTpi,
  updateGestionTpi
}
