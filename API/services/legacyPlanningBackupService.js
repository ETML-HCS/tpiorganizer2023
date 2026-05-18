const { createTpiRoomModel } = require('../models/tpiRoomsModels')

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function parseYear(value) {
  const year = Number.parseInt(String(value), 10)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    const error = new Error('Année invalide pour la sauvegarde de planification.')
    error.statusCode = 400
    throw error
  }

  return year
}

function toPlainObject(value) {
  if (!value) {
    return value
  }

  if (typeof value.toObject === 'function') {
    return value.toObject({ depopulate: true, versionKey: false })
  }

  return value
}

function normalizeDateKey(value) {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isFinite(date?.getTime?.())) {
    return date.toISOString().slice(0, 10)
  }

  const rawValue = compactText(value)
  const match = rawValue.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : rawValue
}

function normalizeNullableNumber(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value === 1
  }

  const normalizedValue = compactText(value).toLowerCase()
  if (!normalizedValue) {
    return false
  }

  return ['true', '1', 'yes', 'y', 'on', 'oui'].includes(normalizedValue)
}

function normalizeOffer(offer = {}) {
  const source = offer && typeof offer === 'object' ? offer : {}
  const submit = Array.isArray(source.submit) ? source.submit : []

  return {
    isValidated: source.isValidated === null || source.isValidated === undefined
      ? null
      : normalizeBoolean(source.isValidated),
    submit: submit.map((entry) => ({
      date: normalizeDateKey(entry?.date),
      creneau: compactText(entry?.creneau)
    }))
  }
}

function normalizeParticipant(participant = {}) {
  const source = participant && typeof participant === 'object' ? participant : {}

  return {
    name: compactText(source.name),
    personId: compactText(source.personId),
    offres: normalizeOffer(source.offres)
  }
}

function normalizeConstraintWarning(warning = {}) {
  return {
    type: compactText(warning?.type),
    message: compactText(warning?.message || warning?.description)
  }
}

function normalizeTpiData(tpiData = {}, fallbackPeriod = 0) {
  const source = tpiData && typeof tpiData === 'object' ? tpiData : {}
  const period = normalizeNullableNumber(source.period)

  return {
    refTpi: compactText(source.refTpi),
    id: compactText(source.id),
    candidatPersonId: compactText(source.candidatPersonId),
    period: period || fallbackPeriod || null,
    startTime: compactText(source.startTime),
    endTime: compactText(source.endTime),
    classe: compactText(source.classe),
    lieu: {
      entreprise: compactText(source.lieu?.entreprise || source.entreprise),
      site: compactText(source.lieu?.site || source.site)
    },
    site: compactText(source.site || source.lieu?.site),
    sujet: compactText(source.sujet),
    description: compactText(source.description || source.domaine),
    candidat: compactText(source.candidat),
    expert1: normalizeParticipant(source.expert1),
    expert2: normalizeParticipant(source.expert2),
    boss: normalizeParticipant(source.boss),
    isPlanningSealed: normalizeBoolean(source.isPlanningSealed),
    isConstraintOverride: normalizeBoolean(source.isConstraintOverride),
    planningOverrideReason: compactText(source.planningOverrideReason),
    constraintWarnings: (Array.isArray(source.constraintWarnings) ? source.constraintWarnings : [])
      .map(normalizeConstraintWarning)
      .filter((warning) => warning.type || warning.message)
  }
}

function normalizeConfigSite(configSite = {}) {
  const source = configSite && typeof configSite === 'object' ? configSite : {}

  return {
    siteId: compactText(source.siteId),
    siteCode: compactText(source.siteCode),
    label: compactText(source.label),
    active: normalizeBoolean(source.active),
    breakline: normalizeNullableNumber(source.breakline),
    breaklineMinutes: normalizeNullableNumber(source.breaklineMinutes),
    tpiTime: normalizeNullableNumber(source.tpiTime),
    tpiTimeMinutes: normalizeNullableNumber(source.tpiTimeMinutes),
    firstTpiStart: normalizeNullableNumber(source.firstTpiStart),
    firstTpiStartTime: compactText(source.firstTpiStartTime),
    numSlots: normalizeNullableNumber(source.numSlots),
    minTpiPerRoom: normalizeNullableNumber(source.minTpiPerRoom),
    maxConsecutiveTpi: normalizeNullableNumber(source.maxConsecutiveTpi),
    planningColor: compactText(source.planningColor),
    tpiColor: compactText(source.tpiColor),
    soutenanceColor: compactText(source.soutenanceColor),
    stakeholderIcons: {
      candidate: compactText(source.stakeholderIcons?.candidate),
      expert1: compactText(source.stakeholderIcons?.expert1),
      expert2: compactText(source.stakeholderIcons?.expert2),
      projectManager: compactText(source.stakeholderIcons?.projectManager)
    }
  }
}

function normalizeRoom(room = {}, fallbackIndex = 0) {
  const source = toPlainObject(room) || {}
  const tpiDatas = Array.isArray(source.tpiDatas) ? source.tpiDatas : []

  return {
    idRoom: normalizeNullableNumber(source.idRoom) || fallbackIndex + 1,
    lastUpdate: normalizeNullableNumber(source.lastUpdate) || null,
    site: compactText(source.site),
    date: normalizeDateKey(source.date),
    name: compactText(source.name || source.nameRoom),
    roomClassMode: compactText(source.roomClassMode),
    configSite: normalizeConfigSite(source.configSite),
    tpiDatas: tpiDatas.map((tpiData, index) => normalizeTpiData(tpiData, index + 1))
  }
}

function normalizeRooms(rooms = []) {
  return (Array.isArray(rooms) ? rooms : [])
    .map(normalizeRoom)
    .sort((left, right) => (
      left.date.localeCompare(right.date) ||
      left.site.localeCompare(right.site) ||
      left.name.localeCompare(right.name) ||
      left.idRoom - right.idRoom
    ))
}

function countVisibleTpis(rooms = []) {
  return (Array.isArray(rooms) ? rooms : []).reduce((total, room) => {
    const tpiCount = Array.isArray(room?.tpiDatas)
      ? room.tpiDatas.filter((tpiData) => (
        compactText(tpiData?.refTpi) ||
        compactText(tpiData?.candidat) ||
        compactText(tpiData?.expert1?.name) ||
        compactText(tpiData?.expert2?.name) ||
        compactText(tpiData?.boss?.name)
      )).length
      : 0

    return total + tpiCount
  }, 0)
}

function assertUniqueRoomIds(rooms = []) {
  const seenIds = new Set()

  for (const room of Array.isArray(rooms) ? rooms : []) {
    const idRoom = normalizeNullableNumber(room?.idRoom)

    if (!idRoom) {
      const error = new Error('Chaque salle doit avoir un idRoom valide avant la sauvegarde BDD.')
      error.statusCode = 400
      throw error
    }

    if (seenIds.has(idRoom)) {
      const error = new Error(`idRoom dupliqué dans la planification: ${idRoom}.`)
      error.statusCode = 400
      throw error
    }

    seenIds.add(idRoom)
  }
}

async function validateRoomsBeforeReplace(TpiRoomModel, rooms = []) {
  if (typeof TpiRoomModel !== 'function') {
    return
  }

  for (const room of rooms) {
    const document = new TpiRoomModel(room)
    await document.validate()
  }
}

function buildBackupVerification(expectedRooms = [], storedRooms = []) {
  const expected = normalizeRooms(expectedRooms)
  const stored = normalizeRooms(storedRooms)
  const expectedJson = JSON.stringify(expected)
  const storedJson = JSON.stringify(stored)

  return {
    exactMatch: expectedJson === storedJson,
    expectedRoomCount: expected.length,
    storedRoomCount: stored.length,
    expectedTpiCount: countVisibleTpis(expected),
    storedTpiCount: countVisibleTpis(stored)
  }
}

async function replacePlanningRoomsForYear(year, rooms, options = {}) {
  const normalizedYear = parseYear(year)
  const sourceRooms = Array.isArray(rooms) ? rooms : []
  const modelFactory = options.modelFactory || createTpiRoomModel
  const TpiRoomModel = modelFactory(normalizedYear)

  assertUniqueRoomIds(sourceRooms)
  await validateRoomsBeforeReplace(TpiRoomModel, sourceRooms)

  await TpiRoomModel.deleteMany({})

  if (sourceRooms.length > 0) {
    await TpiRoomModel.insertMany(sourceRooms, { ordered: true })
  }

  const storedRooms = await TpiRoomModel.find().lean()
  const verification = buildBackupVerification(sourceRooms, storedRooms)

  if (!verification.exactMatch) {
    const error = new Error('La vérification BDD a échoué: la base ne correspond pas à la planification envoyée.')
    error.statusCode = 409
    error.details = verification
    throw error
  }

  return {
    success: true,
    exactMatch: true,
    year: normalizedYear,
    roomCount: verification.storedRoomCount,
    tpiCount: verification.storedTpiCount,
    verifiedAt: new Date().toISOString(),
    verification
  }
}

module.exports = {
  buildBackupVerification,
  normalizeRooms,
  replacePlanningRoomsForYear
}
