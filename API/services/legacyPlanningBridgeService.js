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
const PRESERVED_VOTE_FIELDS = Object.freeze([
  '_id',
  'decision',
  'comment',
  'availabilityException',
  'hardConstraint',
  'specialRequestReason',
  'specialRequestDate',
  'priority',
  'votedAt',
  'magicLinkUsed',
  'reminders',
  'createdAt',
  'updatedAt'
])

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

function getVoteTransferSlotKey(slot = {}, year = null) {
  if (!slot) {
    return ''
  }

  return buildSlotIdentity({
    year: year || slot.year,
    date: slot.date,
    period: slot.period,
    roomName: slot.room?.name,
    roomSite: slot.room?.site
  }).key
}

function toIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function buildVoteTransferKey({ reference, voterRole, voter, slotKey }) {
  return [
    normalizeString(reference),
    normalizeString(voterRole),
    normalizeLinkedPersonId(voter),
    normalizeString(slotKey)
  ].join('|')
}

function buildVoteResponseTransferKey({ reference, voterRole, voter }) {
  return [
    normalizeString(reference),
    normalizeString(voterRole),
    normalizeLinkedPersonId(voter)
  ].join('|')
}

function hasSubmittedVote(vote = {}) {
  return Boolean(vote?.decision && vote.decision !== 'pending')
}

function clonePreservedVoteValue(value) {
  if (value instanceof Date) {
    return new Date(value.getTime())
  }

  if (Array.isArray(value)) {
    return value.map((entry) => clonePreservedVoteValue(entry))
  }

  if (value && typeof value === 'object') {
    return { ...value }
  }

  return value
}

function buildVoteDocumentWithPreservedResponse(baseVoteDoc, preservedVote = null) {
  const voteDoc = {
    ...baseVoteDoc,
    decision: 'pending'
  }

  if (!preservedVote) {
    return voteDoc
  }

  for (const field of PRESERVED_VOTE_FIELDS) {
    if (preservedVote[field] !== undefined) {
      voteDoc[field] = clonePreservedVoteValue(preservedVote[field])
    }
  }

  return voteDoc
}

function buildVoteSummaryFromDocuments(voteDocs = []) {
  return {
    expert1Voted: voteDocs.some((vote) => vote.voterRole === 'expert1' && hasSubmittedVote(vote)),
    expert2Voted: voteDocs.some((vote) => vote.voterRole === 'expert2' && hasSubmittedVote(vote)),
    chefProjetVoted: voteDocs.some((vote) => vote.voterRole === 'chef_projet' && hasSubmittedVote(vote))
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

function buildLegacySlotAssignmentFields({
  slotTimes,
  roomName,
  roomSite,
  roomConfig = {},
  tpiId,
  assignments = null
}) {
  const slotDocument = buildLegacySlotDocument({
    year: 2000,
    date: new Date('2000-01-01T00:00:00.000Z'),
    period: 1,
    slotTimes,
    roomName,
    roomSite,
    roomConfig,
    tpiId,
    assignments
  })

  return {
    startTime: slotDocument.startTime,
    endTime: slotDocument.endTime,
    room: slotDocument.room,
    status: slotDocument.status,
    assignedTpi: slotDocument.assignedTpi,
    assignments: slotDocument.assignments,
    config: slotDocument.config
  }
}

function buildArchivedVoteSlotDocument(slot = {}, now = new Date()) {
  const room = slot.room && typeof slot.room === 'object' ? slot.room : {}

  return {
    year: slot.year,
    date: slot.date,
    period: slot.period,
    startTime: slot.startTime || '',
    endTime: slot.endTime || '',
    room: {
      name: room.name || '',
      site: room.site || '',
      capacity: Number(room.capacity) || 1
    },
    status: 'blocked',
    assignedTpi: null,
    assignments: {},
    config: slot.config && typeof slot.config === 'object'
      ? { ...slot.config }
      : {},
    history: [{
      action: 'archived_vote_slot_after_planning_move',
      at: now,
      details: 'Créneau conservé pour comparer les réponses de vote après déplacement.'
    }]
  }
}

function buildVoteHistorySlotSnapshot(slot = null) {
  if (!slot) {
    return null
  }

  const room = slot.room && typeof slot.room === 'object' ? slot.room : {}

  return {
    _id: slot._id || null,
    year: slot.year || null,
    date: slot.date || null,
    period: slot.period || '',
    startTime: slot.startTime || '',
    endTime: slot.endTime || '',
    room: {
      name: room.name || '',
      site: room.site || '',
      capacity: Number(room.capacity) || 1
    }
  }
}

async function findSlotByTransferSlot(slot = {}, year = null) {
  const room = slot.room && typeof slot.room === 'object' ? slot.room : {}
  const normalizedYear = Number.parseInt(String(year || slot.year), 10)
  const period = Number.parseInt(String(slot.period), 10)
  const date = slot.date ? new Date(slot.date) : null
  const roomName = pickFirstNonEmpty(room.name)
  const roomSite = pickFirstNonEmpty(room.site)

  if (!Number.isInteger(normalizedYear) || Number.isNaN(date?.getTime()) || !Number.isInteger(period) || !roomName || !roomSite) {
    return null
  }

  return Slot.findOne({
    year: normalizedYear,
    date,
    period,
    'room.name': roomName,
    'room.site': roomSite
  })
}

async function ensureArchivedVoteSlot({
  year,
  slot,
  slotKey,
  processedSlotKeys,
  now
}) {
  if (!slot || !slotKey) {
    return null
  }

  const existingProcessed = processedSlotKeys.get(slotKey)
  if (existingProcessed?.slot) {
    return existingProcessed.slot
  }

  const existingSlot = await findSlotByTransferSlot(slot, year)
  if (existingSlot) {
    processedSlotKeys.set(slotKey, {
      reference: '',
      date: toIsoDate(slot.date),
      period: slot.period,
      roomName: slot.room?.name || '',
      roomSite: slot.room?.site || '',
      slot: existingSlot,
      archivedVoteOnly: existingSlot.status === 'blocked' && !existingSlot.assignedTpi
    })
    return existingSlot
  }

  try {
    const archivedSlot = await Slot.create(buildArchivedVoteSlotDocument({
      ...slot,
      year
    }, now))
    processedSlotKeys.set(slotKey, {
      reference: '',
      date: toIsoDate(slot.date),
      period: slot.period,
      roomName: slot.room?.name || '',
      roomSite: slot.room?.site || '',
      slot: archivedSlot,
      archivedVoteOnly: true
    })
    return archivedSlot
  } catch (error) {
    if (error?.code === 11000) {
      return findSlotByTransferSlot(slot, year)
    }

    throw error
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

async function loadExistingTpisForVoteTransfer(year) {
  const query = TpiPlanning.find({ year })

  if (query && typeof query.select === 'function') {
    const selected = query.select('_id reference proposedSlots.slot')
    return selected && typeof selected.lean === 'function'
      ? await selected.lean()
      : await selected
  }

  if (query && typeof query.distinct === 'function') {
    const ids = await query.distinct('_id')
    return (Array.isArray(ids) ? ids : []).map((id) => ({ _id: id }))
  }

  return []
}

async function loadExistingSlotsById(slotIds = []) {
  const normalizedSlotIds = [...new Set(
    (Array.isArray(slotIds) ? slotIds : [])
      .map(normalizeLinkedPersonId)
      .filter(Boolean)
  )]

  if (normalizedSlotIds.length === 0) {
    return new Map()
  }

  const query = Slot.find({ _id: { $in: normalizedSlotIds } })

  if (query && typeof query.select === 'function') {
    const selected = query.select('_id year date period startTime endTime room status assignedTpi config')
    const slots = selected && typeof selected.lean === 'function'
      ? await selected.lean()
      : await selected

    return new Map(
      (Array.isArray(slots) ? slots : [])
        .filter((slot) => slot?._id)
        .map((slot) => [normalizeLinkedPersonId(slot._id), slot])
    )
  }

  return new Map()
}

async function loadExistingVotesForTransfer(existingTpis = []) {
  const normalizedTpis = Array.isArray(existingTpis) ? existingTpis : []
  const existingTpiIds = normalizedTpis
    .map((tpi) => tpi?._id)
    .filter(Boolean)
  const tpiReferenceById = new Map(
    normalizedTpis
      .filter((tpi) => tpi?._id)
      .map((tpi) => [normalizeLinkedPersonId(tpi._id), normalizeString(tpi.reference)])
  )
  const baselineSlotIdByReference = new Map(
    normalizedTpis
      .filter((tpi) => tpi?._id)
      .map((tpi) => {
        const fixedSlot = Array.isArray(tpi.proposedSlots)
          ? tpi.proposedSlots.find((proposedSlot) => proposedSlot?.slot)
          : null

        return [
          normalizeString(tpi.reference),
          normalizeLinkedPersonId(fixedSlot?.slot)
        ]
      })
      .filter(([reference, slotId]) => reference && slotId)
  )

  if (existingTpiIds.length === 0) {
    return {
      tpiIds: [],
      votesByTransferKey: new Map(),
      submittedVotesByReference: new Map(),
      baselineSlotKeyByReference: new Map(),
      baselineSlotByReference: new Map(),
      submittedVoteCount: 0,
      submittedResponseKeys: new Set()
    }
  }

  const query = Vote.find({ tpiPlanning: { $in: existingTpiIds } })
  const selected = query && typeof query.select === 'function'
    ? query.select(PRESERVED_VOTE_FIELDS.concat(['tpiPlanning', 'slot', 'voter', 'voterRole']).join(' '))
    : query
  const oldVotes = selected && typeof selected.lean === 'function'
    ? await selected.lean()
    : await selected
  const normalizedVotes = Array.isArray(oldVotes) ? oldVotes : []
  const slotsById = await loadExistingSlotsById([
    ...normalizedVotes.map((vote) => vote.slot),
    ...baselineSlotIdByReference.values()
  ])
  const votesByTransferKey = new Map()
  const submittedVotesByReference = new Map()
  const baselineSlotKeyByReference = new Map()
  const baselineSlotByReference = new Map()
  const submittedResponseKeys = new Set()
  let submittedVoteCount = 0

  for (const [reference, slotId] of baselineSlotIdByReference.entries()) {
    const slot = slotsById.get(slotId)
    const slotKey = getVoteTransferSlotKey(slot)
    if (slotKey) {
      baselineSlotKeyByReference.set(reference, slotKey)
      baselineSlotByReference.set(reference, slot)
    }
  }

  for (const vote of normalizedVotes) {
    const tpiId = normalizeLinkedPersonId(vote?.tpiPlanning)
    const reference = tpiReferenceById.get(tpiId)
    const slot = slotsById.get(normalizeLinkedPersonId(vote?.slot))
    const slotKey = getVoteTransferSlotKey(slot)

    if (!reference || !slotKey) {
      continue
    }

    const responseKey = buildVoteResponseTransferKey({
      reference,
      voterRole: vote.voterRole,
      voter: vote.voter
    })
    const transferKey = buildVoteTransferKey({
      reference,
      voterRole: vote.voterRole,
      voter: vote.voter,
      slotKey
    })
    const enrichedVote = {
      ...vote,
      reference,
      slot,
      slotKey,
      transferKey,
      responseKey
    }

    if (hasSubmittedVote(vote)) {
      submittedVoteCount += 1
      submittedResponseKeys.add(responseKey)

      if (!submittedVotesByReference.has(reference)) {
        submittedVotesByReference.set(reference, [])
      }
      submittedVotesByReference.get(reference).push(enrichedVote)
    }

    if (!votesByTransferKey.has(transferKey)) {
      votesByTransferKey.set(transferKey, enrichedVote)
    }
  }

  return {
    tpiIds: existingTpiIds,
    votesByTransferKey,
    submittedVotesByReference,
    baselineSlotKeyByReference,
    baselineSlotByReference,
    submittedVoteCount,
    submittedResponseKeys
  }
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

  const existingVoteTransfer = await loadExistingVotesForTransfer(
    await loadExistingTpisForVoteTransfer(normalizedYear)
  )
  if (existingVoteTransfer.tpiIds.length > 0) {
    await Vote.deleteMany({ tpiPlanning: { $in: existingVoteTransfer.tpiIds } })
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
    missingReferences: [],
    preservedVoteCount: 0,
    preservedSubmittedVoteCount: 0,
    droppedSubmittedVoteCount: 0,
    preservedSubmittedResponseCount: 0,
    droppedSubmittedResponseCount: 0,
    movedVoteTpiCount: 0,
    movedVoteStakeholderCount: 0
  }

  const processedReferences = new Set()
  const processedSlotKeys = new Map()
  const preservedSubmittedResponseKeys = new Set()

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
      let existingSlotEntry = processedSlotKeys.get(slotIdentity.key)

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

      if (existingSlotEntry && !existingSlotEntry.archivedVoteOnly) {
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
      const slotKey = existingSlotEntry
        ? buildSlotIdentity({
            year: normalizedYear,
            date: existingSlotEntry.date,
            period: existingSlotEntry.period,
            roomName: existingSlotEntry.roomName,
            roomSite: existingSlotEntry.roomSite
          }).key
        : slotIdentity.key
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
      } else if (existingSlotEntry?.archivedVoteOnly) {
        const assignmentFields = buildLegacySlotAssignmentFields({
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
        })
        await Slot.updateOne(
          { _id: slot._id },
          {
            $set: assignmentFields,
            $push: {
              history: {
                action: 'archived_vote_slot_reused_by_planning',
                by: createdById,
                at: now,
                details: 'Créneau de comparaison réutilisé par la nouvelle planification.'
              }
            }
          }
        )
        Object.assign(slot, assignmentFields)
        existingSlotEntry = {
          ...existingSlotEntry,
          reference,
          date: slotIdentity.dateKey,
          period,
          roomName,
          roomSite: participantSite,
          slot,
          archivedVoteOnly: false
        }
        processedSlotKeys.set(slotIdentity.key, existingSlotEntry)
        createdSlot = true
      }

      const currentStakeholderIds = new Set([
        normalizeLinkedPersonId(expert1._id),
        normalizeLinkedPersonId(expert2._id),
        normalizeLinkedPersonId(chefProjet._id)
      ].filter(Boolean))
      const referenceKey = normalizeString(reference)
      const preservedOldVoteIds = new Set()
      const countPreservedVote = (preservedVote) => {
        const oldVoteId = normalizeLinkedPersonId(preservedVote?._id)
        const identityKey = oldVoteId || preservedVote?.transferKey || ''
        if (identityKey && preservedOldVoteIds.has(identityKey)) {
          return
        }

        if (identityKey) {
          preservedOldVoteIds.add(identityKey)
        }

        summary.preservedVoteCount += 1
        if (hasSubmittedVote(preservedVote)) {
          summary.preservedSubmittedVoteCount += 1
          preservedSubmittedResponseKeys.add(buildVoteResponseTransferKey({
            reference,
            voterRole: preservedVote.voterRole,
            voter: preservedVote.voter
          }))
        }
      }
      const voteDocs = [
        { voter: expert1._id, voterRole: 'expert1' },
        { voter: expert2._id, voterRole: 'expert2' },
        { voter: chefProjet._id, voterRole: 'chef_projet' }
      ].map((voteIdentity) => {
        const transferKey = buildVoteTransferKey({
          reference,
          voterRole: voteIdentity.voterRole,
          voter: voteIdentity.voter,
          slotKey
        })
        const preservedVote = existingVoteTransfer.votesByTransferKey.get(transferKey)
        const voteDoc = buildVoteDocumentWithPreservedResponse({
          tpiPlanning: tpi._id,
          slot: slot._id,
          ...voteIdentity
        }, preservedVote)

        if (preservedVote) {
          countPreservedVote(preservedVote)
        }

        return voteDoc
      })
      const existingVoteDocKeys = new Set(
        voteDocs.map((vote) => [
          normalizeLinkedPersonId(vote.voter),
          normalizeLinkedPersonId(vote.slot)
        ].join('|'))
      )
      const submittedVotesForReference = existingVoteTransfer.submittedVotesByReference.get(referenceKey) || []

      for (const preservedVote of submittedVotesForReference) {
        const preservedSlotKey = preservedVote.slotKey
        const voterId = normalizeLinkedPersonId(preservedVote.voter)

        if (!preservedSlotKey || preservedSlotKey === slotKey || !currentStakeholderIds.has(voterId)) {
          continue
        }

        const archivedSlot = await ensureArchivedVoteSlot({
          year: normalizedYear,
          slot: preservedVote.slot,
          slotKey: preservedSlotKey,
          processedSlotKeys,
          now
        })
        const archivedSlotId = normalizeLinkedPersonId(archivedSlot?._id)
        const voteDocKey = [voterId, archivedSlotId].join('|')

        if (!archivedSlotId || existingVoteDocKeys.has(voteDocKey)) {
          continue
        }

        const archivedVoteDoc = buildVoteDocumentWithPreservedResponse({
          tpiPlanning: tpi._id,
          slot: archivedSlot._id,
          voter: preservedVote.voter,
          voterRole: preservedVote.voterRole
        }, preservedVote)

        voteDocs.push(archivedVoteDoc)
        existingVoteDocKeys.add(voteDocKey)
        countPreservedVote(preservedVote)
      }
      const voteSummary = buildVoteSummaryFromDocuments(voteDocs)
      const baselineSlotKey = existingVoteTransfer.baselineSlotKeyByReference.get(referenceKey)
      const baselineSlot = existingVoteTransfer.baselineSlotByReference.get(referenceKey)
      const movedAfterVotes = Boolean(
        baselineSlotKey &&
        baselineSlotKey !== slotKey &&
        submittedVotesForReference.length > 0
      )
      const touchedRoles = voteDocs
        .filter((vote) => normalizeLinkedPersonId(vote.slot) === normalizeLinkedPersonId(slot._id))
        .filter((vote) => !['accepted', 'preferred'].includes(vote.decision))
        .map((vote) => vote.voterRole)
        .filter(Boolean)
      const moveHistoryEntry = movedAfterVotes
        ? {
            action: 'planning_slot_moved_after_votes',
            by: createdById,
            at: now,
            details: {
              previousSlotKey: baselineSlotKey,
              currentSlotKey: slotKey,
              previousSlot: buildVoteHistorySlotSnapshot(baselineSlot),
              currentSlot: buildVoteHistorySlotSnapshot(slot),
              touchedRoles,
              source: 'legacy_planning_rebuild'
            }
          }
        : null
      if (moveHistoryEntry) {
        summary.movedVoteTpiCount += 1
        summary.movedVoteStakeholderCount += touchedRoles.length
      }

      const planningUpdate = {
        $set: {
            proposedSlots: [{
              slot: slot._id,
              proposedAt: now,
              score: 100,
              reason: 'Import legacy depuis la planification'
            }],
            'votingSession.voteSummary': voteSummary,
            updatedAt: now
        }
      }
      if (moveHistoryEntry) {
        planningUpdate.$push = { history: moveHistoryEntry }
      }

      await TpiPlanning.updateOne({ _id: tpi._id }, planningUpdate)

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

  summary.droppedSubmittedVoteCount = Math.max(
    existingVoteTransfer.submittedVoteCount - summary.preservedSubmittedVoteCount,
    0
  )
  summary.preservedSubmittedResponseCount = preservedSubmittedResponseKeys.size
  summary.droppedSubmittedResponseCount = Math.max(
    existingVoteTransfer.submittedResponseKeys.size - summary.preservedSubmittedResponseCount,
    0
  )

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
