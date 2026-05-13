const mongoose = require('mongoose')

const Slot = require('../models/slotModel')
const Person = require('../models/personModel')
const TpiPlanning = require('../models/tpiCoordinationModel')
const Vote = require('../models/voteModel')
const TpiModelsYear = require('../models/tpiModels')
const { createTpiRoomModel } = require('../models/tpiRoomsModels')
const { findOrCreatePerson } = require('./csvImportService')
const {
  getPlanningConfig,
  normalizeWorkflowSettings
} = require('./coordinationConfigService')
const { isExternalPlanningSite, isPlanifiableTpi } = require('./coordinationTpiVisibility')
const { personHasRole } = require('./personRegistryService')
const {
  linkLegacyTpiStakeholders,
  validateLegacyTpiStakeholders
} = require('./tpiStakeholderService')
const {
  normalizeTpiDossierRef
} = require('../modules/gestionTpi/normalization')

const DAY_IN_MS = 24 * 60 * 60 * 1000
const defaultTpiPlanningFindOne = TpiPlanning.findOne
const defaultTpiPlanningUpdateOne = TpiPlanning.updateOne

function toPlainObject(value) {
  if (!value) {
    return null
  }

  if (typeof value.toObject === 'function') {
    return value.toObject({ depopulate: true, minimize: false, versionKey: false })
  }

  return JSON.parse(JSON.stringify(value))
}

function normalizeString(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  // Filtrer les valeurs "NULL", "null", "undefined", ""
  if (trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
    return ''
  }
  return trimmed
}

function normalizeRef(value) {
  return normalizeString(value == null ? '' : String(value))
}

function parsePositiveInteger(value, fallback = null) {
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}

function normalizeDateOnly(rawDate) {
  if (!rawDate) {
    return null
  }

  const date = new Date(rawDate)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function normalizeLegacyRoom(rawRoom, index = 0) {
  const room = toPlainObject(rawRoom) || {}
  const tpiDatas = Array.isArray(room.tpiDatas) ? room.tpiDatas : []

  return {
    ...room,
    idRoom: Number.isInteger(Number(room.idRoom))
      ? Number(room.idRoom)
      : Date.now() + index,
    lastUpdate: Number(room.lastUpdate) || Date.now(),
    site: normalizeString(room.site),
    date: normalizeDateOnly(room.date),
    name: normalizeString(room.name || room.nameRoom || `Salle ${index + 1}`),
    configSite: room.configSite || {},
    tpiDatas: tpiDatas.map((tpiData, tpiIndex) => normalizeLegacyTpiData(tpiData, tpiIndex))
  }
}

function normalizeLegacyTpiData(rawTpiData, index = 0) {
  const tpiData = toPlainObject(rawTpiData) || {}
  const expert1 = tpiData.expert1 && typeof tpiData.expert1 === 'object'
    ? tpiData.expert1
    : {}
  const expert2 = tpiData.expert2 && typeof tpiData.expert2 === 'object'
    ? tpiData.expert2
    : {}
  const boss = tpiData.boss && typeof tpiData.boss === 'object'
    ? tpiData.boss
    : {}

  return {
    ...tpiData,
    refTpi: tpiData.refTpi == null ? null : String(tpiData.refTpi).trim(),
    id: normalizeString(tpiData.id),
    period: index + 1,
    startTime: normalizeString(tpiData.startTime),
    endTime: normalizeString(tpiData.endTime),
    candidat: normalizeString(tpiData.candidat),
    expert1: {
      ...expert1,
      name: normalizeString(expert1.name)
    },
    expert2: {
      ...expert2,
      name: normalizeString(expert2.name)
    },
    boss: {
      ...boss,
      name: normalizeString(boss.name)
    }
  }
}

const LEGACY_TPI_PERSON_ID_FIELDS = Object.freeze([
  'candidatPersonId',
  'expert1PersonId',
  'expert2PersonId',
  'bossPersonId'
])

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      const trimmed = value.trim()
      // Filtrer "NULL", "null", "undefined"
      if (trimmed.toLowerCase() !== 'null' && trimmed.toLowerCase() !== 'undefined') {
        return trimmed
      }
    }

    if (Number.isFinite(value) && String(value).trim()) {
      return String(value).trim()
    }
  }

  return null
}

function pickFirstDefined(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') {
      return value
    }
  }

  return null
}

function hasLegacyStakeholderIdentity(tpiData = {}) {
  return Boolean(
    pickFirstNonEmpty(
      tpiData?.candidat,
      tpiData?.expert1?.name,
      tpiData?.expert2?.name,
      tpiData?.boss?.name
    ) ||
    pickFirstDefined(
      tpiData?.candidatPersonId,
      tpiData?.expert1PersonId,
      tpiData?.expert1?.personId,
      tpiData?.expert2PersonId,
      tpiData?.expert2?.personId,
      tpiData?.bossPersonId,
      tpiData?.boss?.personId
    )
  )
}

function isEmptyLegacyPlanningSlot(tpiData = {}, legacyTpi = null) {
  if (legacyTpi) {
    return false
  }

  if (normalizeRef(tpiData?.refTpi)) {
    return false
  }

  return !hasLegacyStakeholderIdentity(tpiData)
}

function normalizeLinkedPersonId(value) {
  if (!value) {
    return ''
  }

  if (value?._id) {
    return String(value._id)
  }

  return String(value).trim()
}

function extractLegacyTpiParticipantLinkUpdates(previousTpi = {}, nextTpi = {}) {
  const updates = {}

  for (const fieldName of LEGACY_TPI_PERSON_ID_FIELDS) {
    const previousValue = normalizeLinkedPersonId(previousTpi?.[fieldName])
    const nextValue = normalizeLinkedPersonId(nextTpi?.[fieldName])

    if (!previousValue && nextValue) {
      updates[fieldName] = nextValue
    }
  }

  return updates
}

function buildReference(year, legacyRef, fallbackIndex) {
  const refDescriptor = normalizeTpiDossierRef(year, legacyRef)
  if (refDescriptor.workflowReference) {
    return refDescriptor.workflowReference
  }

  return `TPI-${year}-${String(fallbackIndex).padStart(3, '0')}`
}

function buildSlotTimes(roomConfig = {}, tpiData = {}) {
  const firstTpiStart = Number(roomConfig.firstTpiStart) || 8
  const tpiTime = Number(roomConfig.tpiTime) || 1
  const breakline = Number(roomConfig.breakline) || 0.1667
  const period = parsePositiveInteger(tpiData.period, 1) || 1

  const startHour = firstTpiStart + (period - 1) * (tpiTime + breakline)
  const startMinutes = Math.round((startHour % 1) * 60)
  const startTime = `${Math.floor(startHour)}:${startMinutes.toString().padStart(2, '0')}`

  const endHour = startHour + tpiTime
  const endMinutes = Math.round((endHour % 1) * 60)
  const endTime = `${Math.floor(endHour)}:${endMinutes.toString().padStart(2, '0')}`

  return { startTime, endTime }
}

function buildSlotIdentity({ year, date, period, roomName, roomSite }) {
  const dateValue = date instanceof Date ? date : new Date(date)
  const dateKey = Number.isNaN(dateValue.getTime())
    ? ''
    : dateValue.toISOString().slice(0, 10)

  return {
    key: [
      Number.parseInt(String(year), 10) || '',
      dateKey,
      Number.parseInt(String(period), 10) || '',
      normalizeString(roomSite),
      normalizeString(roomName)
    ].join('|'),
    dateKey
  }
}

function buildLegacySlotDocument({
  year,
  date,
  period,
  slotTimes,
  roomName,
  roomSite,
  roomConfig = {},
  tpiId = null,
  assignments = null
}) {
  const isAssigned = Boolean(tpiId)

  return {
    year,
    date,
    period,
    startTime: slotTimes.startTime,
    endTime: slotTimes.endTime,
    room: {
      name: roomName,
      site: roomSite,
      capacity: Number(roomConfig.capacity) || 1
    },
    status: isAssigned ? 'pending_votes' : 'available',
    assignedTpi: tpiId,
    assignments: assignments || {},
    config: {
      duration: (Number(roomConfig.tpiTime) || 1) * 60,
      breakAfter: (Number(roomConfig.breakline) || 0.1667) * 60,
      minTpiPerRoom: Number.isInteger(Number(roomConfig.minTpiPerRoom)) && Number(roomConfig.minTpiPerRoom) > 0
        ? Number(roomConfig.minTpiPerRoom)
        : 3
    },
    history: []
  }
}

function toObjectIdOrNull(value) {
  if (!value) {
    return null
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return value
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    return null
  }

  return new mongoose.Types.ObjectId(String(value))
}

async function resolveParticipantPerson({ personId, name, role, site, year }) {
  const normalizedPersonId = toObjectIdOrNull(personId)

  if (normalizedPersonId) {
    const foundPerson = await Person.findById(normalizedPersonId)

    if (foundPerson && foundPerson.isActive !== false && personHasRole(foundPerson, role, { year })) {
      return foundPerson
    }
  }

  return await findOrCreatePerson(name, role, site, { year })
}

async function loadLegacyRooms(year, legacyRooms = null) {
  if (Array.isArray(legacyRooms)) {
    return legacyRooms
      .map((room, index) => normalizeLegacyRoom(room, index))
      .filter(room => room && room.date && room.name && Array.isArray(room.tpiDatas))
  }

  const RoomModel = createTpiRoomModel(year)
  const rooms = await RoomModel.find().lean()
  return rooms
    .map((room, index) => normalizeLegacyRoom(room, index))
    .filter(room => room && room.date && room.name && Array.isArray(room.tpiDatas))
}

async function loadLegacyTpis(year) {
  try {
    const LegacyTpiModel = TpiModelsYear(year)
    const tpis = await LegacyTpiModel.find().lean()
    return Array.isArray(tpis) ? tpis.map(toPlainObject).filter(Boolean) : []
  } catch (error) {
    return []
  }
}

function buildPlanningDraftFromLegacyTpi({ year, legacyTpi, linkedPersonIds = {}, createdById = null }) {
  const legacyRef = normalizeRef(legacyTpi?.refTpi || legacyTpi?.id)
  const reference = buildReference(year, legacyRef, 0)
  const candidat = toObjectIdOrNull(linkedPersonIds.candidatPersonId || legacyTpi?.candidatPersonId)
  const expert1 = toObjectIdOrNull(linkedPersonIds.expert1PersonId || legacyTpi?.expert1PersonId)
  const expert2 = toObjectIdOrNull(linkedPersonIds.expert2PersonId || legacyTpi?.expert2PersonId)
  const chefProjet = toObjectIdOrNull(linkedPersonIds.bossPersonId || legacyTpi?.bossPersonId)

  return {
    reference,
    year,
    candidat,
    expert1,
    expert2,
    chefProjet,
    sujet: pickFirstNonEmpty(legacyTpi?.sujet, legacyTpi?.titre),
    description: pickFirstNonEmpty(legacyTpi?.description),
    entreprise: pickFirstNonEmpty(legacyTpi?.lieu?.entreprise, legacyTpi?.entreprise)
      ? { nom: pickFirstNonEmpty(legacyTpi?.lieu?.entreprise, legacyTpi?.entreprise) }
      : undefined,
    classe: pickFirstNonEmpty(legacyTpi?.classe),
    site: pickFirstNonEmpty(legacyTpi?.lieu?.site, legacyTpi?.site),
    dates: {
      soutenance: normalizeDateOnly(legacyTpi?.dates?.soutenance || legacyTpi?.dateSoutenance),
      debut: normalizeDateOnly(legacyTpi?.dates?.depart || legacyTpi?.dates?.debut),
      fin: normalizeDateOnly(legacyTpi?.dates?.fin),
      premiereVisite: normalizeDateOnly(legacyTpi?.dates?.premiereVisite),
      deuxiemeVisite: normalizeDateOnly(legacyTpi?.dates?.deuxiemeVisite),
      renduFinal: normalizeDateOnly(legacyTpi?.dates?.renduFinal)
    },
    status: 'draft',
    proposedSlots: [],
    confirmedSlot: null,
    soutenanceDateTime: null,
    soutenanceRoom: '',
    conflicts: [],
    manualOverride: {
      isManual: false,
      reason: '',
      overriddenBy: null,
      overriddenAt: null
    },
    notifications: [],
    evaluation: legacyTpi?.evaluation || undefined,
    tags: Array.isArray(legacyTpi?.tags) ? legacyTpi.tags.filter(Boolean) : [],
    history: [],
    createdBy: createdById
  }
}

function canQueryPlanningModel() {
  return mongoose.connection.readyState === 1 ||
    TpiPlanning.findOne !== defaultTpiPlanningFindOne ||
    TpiPlanning.updateOne !== defaultTpiPlanningUpdateOne
}

function buildPlanningReferenceCandidates(year, legacyRef) {
  const refDescriptor = normalizeTpiDossierRef(year, legacyRef)
  return Array.from(new Set(
    (refDescriptor.workflowCandidates || [])
      .map(normalizeRef)
      .filter(Boolean)
  ))
}

function buildLegacyRoomRefCandidates(year, legacyRef) {
  const refDescriptor = normalizeTpiDossierRef(year, legacyRef)
  return Array.from(new Set(
    [refDescriptor.legacyRef, refDescriptor.rawRef]
      .map(normalizeRef)
      .filter((ref) => /^\d+$/.test(ref))
      .flatMap((ref) => [ref, Number.parseInt(ref, 10)])
  ))
}

function buildPlanningUpdateSetFromLegacyTpi(legacyTpi = {}, linkedPersonIds = {}) {
  const candidat = toObjectIdOrNull(linkedPersonIds.candidatPersonId || legacyTpi?.candidatPersonId)
  const expert1 = toObjectIdOrNull(linkedPersonIds.expert1PersonId || legacyTpi?.expert1PersonId)
  const expert2 = toObjectIdOrNull(linkedPersonIds.expert2PersonId || legacyTpi?.expert2PersonId)
  const chefProjet = toObjectIdOrNull(linkedPersonIds.bossPersonId || legacyTpi?.bossPersonId)
  const soutenanceDate = normalizeDateOnly(legacyTpi?.dates?.soutenance || legacyTpi?.dateSoutenance)
  const updateSet = {
    sujet: pickFirstNonEmpty(legacyTpi?.sujet, legacyTpi?.titre) || '',
    description: pickFirstNonEmpty(legacyTpi?.description) || '',
    'entreprise.nom': pickFirstNonEmpty(legacyTpi?.lieu?.entreprise, legacyTpi?.entreprise) || '',
    classe: pickFirstNonEmpty(legacyTpi?.classe) || '',
    site: pickFirstNonEmpty(legacyTpi?.lieu?.site, legacyTpi?.site) || '',
    'dates.debut': normalizeDateOnly(legacyTpi?.dates?.depart || legacyTpi?.dates?.debut),
    'dates.fin': normalizeDateOnly(legacyTpi?.dates?.fin),
    'dates.premiereVisite': normalizeDateOnly(legacyTpi?.dates?.premiereVisite),
    'dates.deuxiemeVisite': normalizeDateOnly(legacyTpi?.dates?.deuxiemeVisite),
    'dates.renduFinal': normalizeDateOnly(legacyTpi?.dates?.renduFinal),
    tags: Array.isArray(legacyTpi?.tags) ? legacyTpi.tags.filter(Boolean) : [],
    updatedAt: new Date()
  }

  if (soutenanceDate) {
    updateSet['dates.soutenance'] = soutenanceDate
  }

  if (legacyTpi?.evaluation && typeof legacyTpi.evaluation === 'object') {
    updateSet.evaluation = legacyTpi.evaluation
  }

  if (candidat) {
    updateSet.candidat = candidat
  }

  if (expert1) {
    updateSet.expert1 = expert1
  }

  if (expert2) {
    updateSet.expert2 = expert2
  }

  if (chefProjet) {
    updateSet.chefProjet = chefProjet
  }

  return updateSet
}

function buildLegacyRoomTpiUpdateSetFromLegacyTpi(legacyTpi = {}) {
  const expert1Name = pickFirstNonEmpty(legacyTpi?.experts?.['1'], legacyTpi?.experts?.[1], legacyTpi?.expert1)
  const expert2Name = pickFirstNonEmpty(legacyTpi?.experts?.['2'], legacyTpi?.experts?.[2], legacyTpi?.expert2)

  return {
    'tpiDatas.$[tpi].candidat': pickFirstNonEmpty(legacyTpi?.candidat) || '',
    'tpiDatas.$[tpi].candidatPersonId': normalizeLinkedPersonId(legacyTpi?.candidatPersonId),
    'tpiDatas.$[tpi].classe': pickFirstNonEmpty(legacyTpi?.classe) || '',
    'tpiDatas.$[tpi].lieu.entreprise': pickFirstNonEmpty(legacyTpi?.lieu?.entreprise, legacyTpi?.entreprise) || '',
    'tpiDatas.$[tpi].lieu.site': pickFirstNonEmpty(legacyTpi?.lieu?.site, legacyTpi?.site) || '',
    'tpiDatas.$[tpi].site': pickFirstNonEmpty(legacyTpi?.lieu?.site, legacyTpi?.site) || '',
    'tpiDatas.$[tpi].sujet': pickFirstNonEmpty(legacyTpi?.sujet, legacyTpi?.titre) || '',
    'tpiDatas.$[tpi].description': pickFirstNonEmpty(legacyTpi?.description) || '',
    'tpiDatas.$[tpi].expert1.name': expert1Name || '',
    'tpiDatas.$[tpi].expert1.personId': normalizeLinkedPersonId(legacyTpi?.expert1PersonId),
    'tpiDatas.$[tpi].expert2.name': expert2Name || '',
    'tpiDatas.$[tpi].expert2.personId': normalizeLinkedPersonId(legacyTpi?.expert2PersonId),
    'tpiDatas.$[tpi].boss.name': pickFirstNonEmpty(legacyTpi?.boss, legacyTpi?.chefProjet) || '',
    'tpiDatas.$[tpi].boss.personId': normalizeLinkedPersonId(legacyTpi?.bossPersonId || legacyTpi?.chefProjetPersonId)
  }
}

async function resolvePlanningTpiByReference(year, referenceCandidates) {
  const query = TpiPlanning.findOne({
    year,
    reference: { $in: referenceCandidates }
  })

  if (query && typeof query.select === 'function') {
    const selected = query.select('_id reference')
    return selected && typeof selected.lean === 'function'
      ? await selected.lean()
      : await selected
  }

  return await query
}

async function syncPersistedLegacyRoomsFromGestionTpi(year, legacyTpi) {
  if (mongoose.connection.readyState !== 1) {
    return { matchedCount: 0, modifiedCount: 0 }
  }

  const roomRefCandidates = buildLegacyRoomRefCandidates(year, legacyTpi?.refTpi || legacyTpi?.id)
  if (roomRefCandidates.length === 0) {
    return { matchedCount: 0, modifiedCount: 0 }
  }

  const RoomModel = createTpiRoomModel(year)
  return await RoomModel.updateMany(
    { 'tpiDatas.refTpi': { $in: roomRefCandidates } },
    {
      $set: {
        lastUpdate: Date.now(),
        ...buildLegacyRoomTpiUpdateSetFromLegacyTpi(legacyTpi)
      }
    },
    {
      arrayFilters: [
        { 'tpi.refTpi': { $in: roomRefCandidates } }
      ]
    }
  )
}

async function syncGestionTpiToPlanning({ year, legacyTpi, linkedPersonIds = {} } = {}) {
  const normalizedYear = Number.parseInt(String(year), 10)
  const plainLegacyTpi = toPlainObject(legacyTpi) || {}
  const referenceCandidates = buildPlanningReferenceCandidates(
    normalizedYear,
    plainLegacyTpi?.refTpi || plainLegacyTpi?.id
  )
  const summary = {
    year: Number.isInteger(normalizedYear) ? normalizedYear : null,
    referenceCandidates,
    updatedPlanningCount: 0,
    updatedLegacyRoomCount: 0,
    skippedMissingReference: false
  }

  if (!Number.isInteger(normalizedYear) || referenceCandidates.length === 0) {
    summary.skippedMissingReference = true
    return summary
  }

  if (canQueryPlanningModel()) {
    const existingPlanningTpi = await resolvePlanningTpiByReference(normalizedYear, referenceCandidates)

    if (existingPlanningTpi?._id) {
      await TpiPlanning.updateOne(
        { _id: existingPlanningTpi._id },
        {
          $set: buildPlanningUpdateSetFromLegacyTpi(plainLegacyTpi, linkedPersonIds)
        }
      )
      summary.updatedPlanningCount = 1
    }
  }

  const legacyRoomResult = await syncPersistedLegacyRoomsFromGestionTpi(normalizedYear, plainLegacyTpi)
  summary.updatedLegacyRoomCount = Number(
    legacyRoomResult?.modifiedCount ??
    legacyRoomResult?.nModified ??
    legacyRoomResult?.matchedCount ??
    0
  )

  return summary
}

async function syncLegacyCatalogToPlanning({ year, createdBy = null }) {
  const normalizedYear = Number.parseInt(String(year), 10)
  if (!Number.isInteger(normalizedYear)) {
    throw new Error('Annee invalide pour la synchronisation du catalogue legacy.')
  }

  const planningConfig = await getPlanningConfig(normalizedYear)
  const [legacyTpis, activePeople, existingPlanningTpis] = await Promise.all([
    loadLegacyTpis(normalizedYear),
    Person.find({ isActive: true })
      .select('firstName lastName email roles candidateYears isActive')
      .lean(),
    TpiPlanning.find({ year: normalizedYear })
      .select('reference')
      .lean()
  ])

  const createdById = toObjectIdOrNull(createdBy?.id || createdBy?._id || createdBy)
  const LegacyTpiModel = TpiModelsYear(normalizedYear)
  const existingReferences = new Set(
    existingPlanningTpis
      .map((tpi) => normalizeString(tpi?.reference))
      .filter(Boolean)
  )
  const existingPlanningByReference = new Map(
    existingPlanningTpis
      .map((tpi) => [normalizeString(tpi?.reference), tpi])
      .filter(([reference]) => Boolean(reference))
  )
  const summary = {
    year: normalizedYear,
    totalLegacyTpis: Array.isArray(legacyTpis) ? legacyTpis.length : 0,
    planifiableLegacyTpis: 0,
    createdCount: 0,
    updatedExistingCount: 0,
    skippedExistingCount: 0,
    skippedMissingReferenceCount: 0,
    skippedInvalidStakeholdersCount: 0,
    outOfScopeCount: 0
  }
  const legacyBulkOperations = []
  const planningBulkOperations = []
  const planningCreates = []

  for (const rawLegacyTpi of Array.isArray(legacyTpis) ? legacyTpis : []) {
    const plainLegacyTpi = toPlainObject(rawLegacyTpi) || {}

    if (!isPlanifiableTpi(plainLegacyTpi, planningConfig)) {
      summary.outOfScopeCount += 1
      continue
    }

    summary.planifiableLegacyTpis += 1

    const { tpi: linkedLegacyTpi } = linkLegacyTpiStakeholders(plainLegacyTpi, activePeople, {
      year: normalizedYear
    })
    const linkUpdates = extractLegacyTpiParticipantLinkUpdates(plainLegacyTpi, linkedLegacyTpi)

    if (plainLegacyTpi?._id && Object.keys(linkUpdates).length > 0) {
      legacyBulkOperations.push({
        updateOne: {
          filter: { _id: plainLegacyTpi._id },
          update: { $set: linkUpdates }
        }
      })
    }

    const legacyRef = normalizeRef(linkedLegacyTpi?.refTpi || linkedLegacyTpi?.id)
    if (!legacyRef) {
      summary.skippedMissingReferenceCount += 1
      continue
    }

    const reference = buildReference(normalizedYear, legacyRef, 0)
    if (existingReferences.has(reference)) {
      const existingPlanningTpi = existingPlanningByReference.get(reference)

      if (existingPlanningTpi?._id) {
        planningBulkOperations.push({
          updateOne: {
            filter: { _id: existingPlanningTpi._id },
            update: {
              $set: buildPlanningUpdateSetFromLegacyTpi(linkedLegacyTpi)
            }
          }
        })
      }

      summary.skippedExistingCount += 1
      continue
    }

    const stakeholderValidation = validateLegacyTpiStakeholders(linkedLegacyTpi, {
      people: activePeople,
      year: normalizedYear,
      requireResolved: true
    })

    if (!stakeholderValidation.isValidated) {
      summary.skippedInvalidStakeholdersCount += 1
      continue
    }

    const planningDraft = buildPlanningDraftFromLegacyTpi({
      year: normalizedYear,
      legacyTpi: linkedLegacyTpi,
      linkedPersonIds: stakeholderValidation.linkedPersonIds,
      createdById
    })

    if (!planningDraft.candidat || !planningDraft.expert1 || !planningDraft.expert2 || !planningDraft.chefProjet) {
      summary.skippedInvalidStakeholdersCount += 1
      continue
    }

    planningCreates.push(planningDraft)
    existingReferences.add(reference)
  }

  if (legacyBulkOperations.length > 0) {
    await LegacyTpiModel.bulkWrite(legacyBulkOperations)
  }

  if (planningBulkOperations.length > 0) {
    await TpiPlanning.bulkWrite(planningBulkOperations, { ordered: false })
    summary.updatedExistingCount = planningBulkOperations.length
  }

  if (planningCreates.length > 0) {
    await TpiPlanning.insertMany(planningCreates, { ordered: false })
    summary.createdCount = planningCreates.length
  }

  return summary
}

async function rebuildWorkflowFromLegacyPlanning({
  year,
  legacyRooms = null,
  createdBy = null
}) {
  const normalizedYear = Number.parseInt(String(year), 10)
  if (!Number.isInteger(normalizedYear)) {
    throw new Error('Annee invalide pour la synchronisation de la planification.')
  }

  const planningConfig = await getPlanningConfig(normalizedYear)
  const rooms = await loadLegacyRooms(normalizedYear, legacyRooms)
  const legacyTpis = await loadLegacyTpis(normalizedYear)
  const activePeople = await Person.find({ isActive: true })
    .select('firstName lastName email roles candidateYears isActive')
    .lean()
  const legacyTpiByRef = new Map(
    legacyTpis.map(tpi => [normalizeRef(tpi.refTpi), tpi])
  )

  const existingTpiIds = await TpiPlanning.find({ year: normalizedYear }).distinct('_id')
  if (existingTpiIds.length > 0) {
    await Vote.deleteMany({ tpiPlanning: { $in: existingTpiIds } })
  }

  await Slot.deleteMany({ year: normalizedYear })
  await TpiPlanning.deleteMany({ year: normalizedYear })

  if (Array.isArray(legacyRooms)) {
    const RoomModel = createTpiRoomModel(normalizedYear)
    await RoomModel.deleteMany({})
    if (rooms.length > 0) {
      await RoomModel.insertMany(rooms, { ordered: false }).catch(error => {
        if (error?.code !== 11000) {
          throw error
        }
      })
    }
  }

  const createdById = toObjectIdOrNull(createdBy?.id || createdBy?._id || createdBy)
  const now = new Date()
  const workflowSettings = normalizeWorkflowSettings(planningConfig?.workflowSettings)
  const deadline = new Date(now.getTime() + workflowSettings.voteDeadlineDays * DAY_IN_MS)
  const summary = {
    year: normalizedYear,
    roomCount: rooms.length,
    tpiCount: 0,
    slotCount: 0,
    voteCount: 0,
    skippedEntries: 0,
    emptySlotEntries: 0,
    outOfScopeEntries: 0,
    externalEntries: 0,
    unconfiguredSiteEntries: 0,
    duplicateSlotEntries: 0,
    duplicateSlots: [],
    missingReferences: []
  }

  const processedReferences = new Set()
  const processedSlotKeys = new Map()

  for (const room of rooms) {
    const roomName = room.name || room.nameRoom || `Salle ${summary.roomCount}`
    const roomConfig = room.configSite || {}
    const roomDate = normalizeDateOnly(room.date)
    if (!roomDate) {
      console.warn(`⚠️ Salle ignorée (pas de date): ${roomName}`)
      summary.skippedEntries += Array.isArray(room.tpiDatas) ? room.tpiDatas.length : 0
      continue
    }

    const tpiDatas = Array.isArray(room.tpiDatas) ? room.tpiDatas : []

    for (const [tpiIndex, tpiData] of tpiDatas.entries()) {
      const legacyRef = normalizeRef(tpiData.refTpi || tpiData.id)
      const legacyTpi = legacyRef ? legacyTpiByRef.get(legacyRef) || null : null
      const period = tpiIndex + 1
      const slotTimes = buildSlotTimes(roomConfig, { ...tpiData, period })
      const siteCandidates = [room.site, legacyTpi?.lieu?.site, legacyTpi?.site]
      const planningSiteValue = pickFirstNonEmpty(...siteCandidates)
      const slotSite = pickFirstNonEmpty(
        room.site,
        legacyTpi?.lieu?.site,
        legacyTpi?.site,
        planningSiteValue,
        'Vennes'
      )
      const slotIdentity = buildSlotIdentity({
        year: normalizedYear,
        date: roomDate,
        period,
        roomName,
        roomSite: slotSite
      })
      const existingSlotEntry = processedSlotKeys.get(slotIdentity.key)

      if (isEmptyLegacyPlanningSlot(tpiData, legacyTpi)) {
        if (isPlanifiableTpi({ site: planningSiteValue }, planningConfig) && !existingSlotEntry) {
          const slot = await Slot.create(buildLegacySlotDocument({
            year: normalizedYear,
            date: roomDate,
            period,
            slotTimes,
            roomName,
            roomSite: slotSite,
            roomConfig
          }))
          processedSlotKeys.set(slotIdentity.key, {
            reference: '',
            date: slotIdentity.dateKey,
            period,
            roomName,
            roomSite: slotSite,
            slot
          })
          summary.slotCount += 1
        }

        summary.emptySlotEntries += 1
        continue
      }

      if (!legacyRef) {
        console.warn(`⚠️ TPI ignoré (pas de ref): période ${tpiIndex+1} dans ${roomName}`)
        summary.skippedEntries += 1
        continue
      }

      if (!isPlanifiableTpi({ site: planningSiteValue }, planningConfig)) {
        const isExternalSite = siteCandidates.some(isExternalPlanningSite)
        const skipReason = isExternalSite
          ? 'site externe'
          : 'site hors périmètre de Configuration Sites'

        console.warn(`⚠️ TPI ignoré (${skipReason}): ${legacyRef}`)
        summary.skippedEntries += 1
        summary.outOfScopeEntries += 1
        if (isExternalSite) {
          summary.externalEntries += 1
        } else {
          summary.unconfiguredSiteEntries += 1
        }
        continue
      }

      const participantSite = slotSite

      const candidateName = pickFirstNonEmpty(tpiData.candidat, legacyTpi?.candidat)
      const expert1Name = pickFirstNonEmpty(tpiData.expert1?.name, legacyTpi?.experts?.['1'], legacyTpi?.experts?.[1])
      const expert2Name = pickFirstNonEmpty(tpiData.expert2?.name, legacyTpi?.experts?.['2'], legacyTpi?.experts?.[2])
      const chefProjetName = pickFirstNonEmpty(tpiData.boss?.name, legacyTpi?.boss)

      const candidatePersonId = pickFirstDefined(
        tpiData.candidatPersonId,
        legacyTpi?.candidatPersonId
      )
      const expert1PersonId = pickFirstDefined(
        tpiData.expert1?.personId,
        legacyTpi?.expert1PersonId
      )
      const expert2PersonId = pickFirstDefined(
        tpiData.expert2?.personId,
        legacyTpi?.expert2PersonId
      )
      const chefProjetPersonId = pickFirstDefined(
        tpiData.boss?.personId,
        legacyTpi?.bossPersonId
      )

      const stakeholderValidation = validateLegacyTpiStakeholders({
        candidat: candidateName,
        candidatPersonId: candidatePersonId,
        experts: {
          1: expert1Name,
          2: expert2Name
        },
        expert1PersonId,
        expert2PersonId,
        boss: chefProjetName,
        bossPersonId: chefProjetPersonId
      }, {
        people: activePeople,
        year: normalizedYear,
        requireResolved: true
      })

      if (!stakeholderValidation.isValidated) {
        console.warn(
          `⛔ TPI IGNORÉ (parties prenantes invalides): ${legacyRef} | manquantes=${stakeholderValidation.missingRoles.join(', ') || 'aucune'} | non résolues=${stakeholderValidation.unresolvedRoles.join(', ') || 'aucune'}`
        )
        summary.skippedEntries += 1
        summary.missingReferences.push(legacyRef)
        continue
      }

      const reference = buildReference(normalizedYear, legacyRef, summary.tpiCount + 1)
      if (processedReferences.has(reference)) {
        continue
      }
      processedReferences.add(reference)

      const candidat = await resolveParticipantPerson({
        personId: stakeholderValidation.linkedPersonIds.candidatPersonId || candidatePersonId,
        name: candidateName,
        role: 'candidat',
        site: participantSite,
        year: normalizedYear
      })
      const expert1 = await resolveParticipantPerson({
        personId: stakeholderValidation.linkedPersonIds.expert1PersonId || expert1PersonId,
        name: expert1Name,
        role: 'expert',
        site: participantSite,
        year: normalizedYear
      })
      const expert2 = await resolveParticipantPerson({
        personId: stakeholderValidation.linkedPersonIds.expert2PersonId || expert2PersonId,
        name: expert2Name,
        role: 'expert',
        site: participantSite,
        year: normalizedYear
      })
      const chefProjet = await resolveParticipantPerson({
        personId: stakeholderValidation.linkedPersonIds.bossPersonId || chefProjetPersonId,
        name: chefProjetName,
        role: 'chef_projet',
        site: participantSite,
        year: normalizedYear
      })

      if (!candidat || !expert1 || !expert2 || !chefProjet) {
        summary.skippedEntries += 1
        continue
      }

      if (existingSlotEntry) {
        console.warn(
          `⚠️ Créneau partagé détecté: ${legacyRef} dans ${roomName}, ${slotIdentity.dateKey}, période ${period} déjà utilisé par ${existingSlotEntry.reference}`
        )
        summary.duplicateSlotEntries += 1
        summary.duplicateSlots.push({
          date: slotIdentity.dateKey,
          period,
          roomName,
          reference,
          existingReference: existingSlotEntry.reference
        })
      }

      const tpi = await TpiPlanning.create({
        reference,
        year: normalizedYear,
        candidat: candidat._id,
        expert1: expert1._id,
        expert2: expert2._id,
        chefProjet: chefProjet._id,
        sujet: pickFirstNonEmpty(legacyTpi?.sujet, tpiData?.sujet, tpiData?.titre),
        description: pickFirstNonEmpty(legacyTpi?.description, tpiData?.description),
        entreprise: pickFirstNonEmpty(legacyTpi?.lieu?.entreprise, legacyTpi?.entreprise, tpiData?.entreprise)
          ? { nom: pickFirstNonEmpty(legacyTpi?.lieu?.entreprise, legacyTpi?.entreprise, tpiData?.entreprise) }
          : undefined,
        classe: pickFirstNonEmpty(legacyTpi?.classe, tpiData?.classe),
        site: participantSite,
        dates: {
          soutenance: roomDate,
          debut: normalizeDateOnly(legacyTpi?.dates?.depart || legacyTpi?.dates?.debut),
          fin: normalizeDateOnly(legacyTpi?.dates?.fin),
          premiereVisite: normalizeDateOnly(legacyTpi?.dates?.premiereVisite),
          deuxiemeVisite: normalizeDateOnly(legacyTpi?.dates?.deuxiemeVisite),
          renduFinal: normalizeDateOnly(legacyTpi?.dates?.renduFinal)
        },
        status: 'voting',
        proposedSlots: [],
        confirmedSlot: null,
        soutenanceDateTime: null,
        soutenanceRoom: roomName,
        votingSession: {
          startedAt: now,
          deadline,
          remindersCount: 0,
          voteSummary: {
            expert1Voted: false,
            expert2Voted: false,
            chefProjetVoted: false
          }
        },
        conflicts: [],
        manualOverride: {
          isManual: false,
          reason: '',
          overriddenBy: null,
          overriddenAt: null
        },
        notifications: [],
        evaluation: legacyTpi?.evaluation || undefined,
        tags: Array.isArray(legacyTpi?.tags) ? legacyTpi.tags.filter(Boolean) : [],
        history: [],
        createdBy: createdById
      })

      let createdSlot = false
      let slot = existingSlotEntry?.slot || null
      if (!slot) {
        slot = await Slot.create(buildLegacySlotDocument({
          year: normalizedYear,
          date: roomDate,
          period,
          slotTimes,
          roomName,
          roomSite: participantSite,
          roomConfig,
          tpiId: tpi._id,
          assignments: {
            candidat: candidat._id,
            expert1: expert1._id,
            expert2: expert2._id,
            chefProjet: chefProjet._id
          }
        }))
        createdSlot = true
        processedSlotKeys.set(slotIdentity.key, {
          reference,
          date: slotIdentity.dateKey,
          period,
          roomName,
          roomSite: participantSite,
          slot
        })
      }

      await TpiPlanning.updateOne(
        { _id: tpi._id },
        {
          $set: {
            proposedSlots: [{
              slot: slot._id,
              proposedAt: now,
              score: 100,
              reason: 'Import legacy depuis la planification'
            }],
            updatedAt: now
          }
        }
      )

      const voteDocs = [
        {
          tpiPlanning: tpi._id,
          slot: slot._id,
          voter: expert1._id,
          voterRole: 'expert1'
        },
        {
          tpiPlanning: tpi._id,
          slot: slot._id,
          voter: expert2._id,
          voterRole: 'expert2'
        },
        {
          tpiPlanning: tpi._id,
          slot: slot._id,
          voter: chefProjet._id,
          voterRole: 'chef_projet'
        }
      ]

      await Vote.insertMany(voteDocs, { ordered: false }).catch(error => {
        if (error?.code !== 11000) {
          throw error
        }
      })

      summary.tpiCount += 1
      if (createdSlot) {
        summary.slotCount += 1
      }
      summary.voteCount += voteDocs.length
    }
  }

  return summary
}

module.exports = {
  rebuildWorkflowFromLegacyPlanning,
  syncGestionTpiToPlanning,
  syncLegacyCatalogToPlanning,
  loadLegacyRooms,
  loadLegacyTpis,
  normalizeLegacyRoom,
  normalizeLegacyTpiData,
  normalizeDateOnly
}
