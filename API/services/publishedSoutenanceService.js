const { createCustomTpiRoomModel } = require('../models/tpiRoomsModels')
const PublicationVersion = require('../models/publicationVersionModel')
const TpiPlanning = require('../models/tpiPlanningModel')
const TpiModelsYear = require('../models/tpiModels')
const { getSharedPlanningCatalog } = require('./planningCatalogService')
const { getPlanningConfig } = require('./planningConfigService')
const { inferTpiClassMode } = require('./roomClassCompatibilityService')
const { buildLegacyRefFilter } = require('./legacyTpiDateEnrichmentService')

const DEFAULT_STAKEHOLDER_ICONS = {
  candidate: 'candidate',
  expert1: 'participant',
  expert2: 'participant',
  projectManager: 'participant'
}
const CANDIDATE_STAKEHOLDER_ICON_VALUES = new Set([
  'candidate',
  'candidate-green',
  'candidate-violet',
  'candidate-rose',
  'candidate-gold'
])
const HELMET_STAKEHOLDER_ICON_VALUES = new Set([
  'participant',
  'helmet-orange',
  'helmet-green',
  'helmet-blue',
  'helmet-black',
  'helmet-gray'
])
const STAKEHOLDER_ICON_VALUES = new Set([
  ...CANDIDATE_STAKEHOLDER_ICON_VALUES,
  ...HELMET_STAKEHOLDER_ICON_VALUES
])

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function normalizeSoutenanceColor(value) {
  const hex = compactText(value).replace(/^#/, '')

  if (/^[\da-fA-F]{3}$/.test(hex)) {
    return `#${hex
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toUpperCase()}`
  }

  if (/^[\da-fA-F]{6}$/.test(hex)) {
    return `#${hex.toUpperCase()}`
  }

  return ''
}

function normalizeStakeholderIconKey(value, fallback = 'participant', role = '') {
  const normalizedValue = compactText(value)
  const allowedValues = role === 'candidate'
    ? CANDIDATE_STAKEHOLDER_ICON_VALUES
    : role
      ? HELMET_STAKEHOLDER_ICON_VALUES
      : STAKEHOLDER_ICON_VALUES
  const defaultFallback = role === 'candidate' ? DEFAULT_STAKEHOLDER_ICONS.candidate : 'participant'
  const normalizedFallback = compactText(fallback)
  const safeFallback = allowedValues.has(normalizedFallback) ? normalizedFallback : defaultFallback

  return allowedValues.has(normalizedValue)
    ? normalizedValue
    : safeFallback
}

function normalizeStakeholderIcons(value = {}) {
  const source = value && typeof value === 'object' ? value : {}

  return {
    candidate: normalizeStakeholderIconKey(source.candidate, DEFAULT_STAKEHOLDER_ICONS.candidate, 'candidate'),
    expert1: normalizeStakeholderIconKey(source.expert1, DEFAULT_STAKEHOLDER_ICONS.expert1, 'expert1'),
    expert2: normalizeStakeholderIconKey(source.expert2, DEFAULT_STAKEHOLDER_ICONS.expert2, 'expert2'),
    projectManager: normalizeStakeholderIconKey(
      source.projectManager || source.boss,
      DEFAULT_STAKEHOLDER_ICONS.projectManager,
      'projectManager'
    )
  }
}

function getSoutenanceModel(year) {
  return createCustomTpiRoomModel(`tpiSoutenance_${year}`)
}

function buildStableNumericId(value) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

function parseTimeToDecimal(time) {
  if (!time) {
    return 0
  }

  if (typeof time === 'number' && Number.isFinite(time)) {
    return time
  }

  const [hours, minutes] = String(time).split(':').map(Number)
  if (!Number.isFinite(hours)) {
    return 0
  }

  return hours + ((Number.isFinite(minutes) ? minutes : 0) / 60)
}

function parsePositiveInteger(value, fallback = 0) {
  const parsedValue = Number.parseInt(String(value), 10)
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback
}

function parseNonNegativeInteger(value, fallback = null) {
  const parsedValue = Number.parseInt(String(value), 10)
  return Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : fallback
}

function parsePositiveNumber(value, fallback = 0) {
  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback
}

function normalizeSiteCode(value) {
  return compactText(value).toUpperCase()
}

function getPlanningSiteConfig(planningConfig, siteCode) {
  const normalizedSiteCode = normalizeSiteCode(siteCode)
  if (!normalizedSiteCode) {
    return null
  }

  return (Array.isArray(planningConfig?.siteConfigs) ? planningConfig.siteConfigs : [])
    .find((siteConfig) =>
      siteConfig?.active !== false &&
      normalizeSiteCode(siteConfig?.siteCode || siteConfig?.code || siteConfig?.label) === normalizedSiteCode
    ) || null
}

function getPublishedTpiSlotIndex(tpiData, fallbackIndex = 0) {
  const period = parsePositiveInteger(tpiData?.period, 0)
  if (period > 0) {
    return period - 1
  }

  const idIndex = parseNonNegativeInteger(String(tpiData?.id || '').split('_').pop(), null)
  return idIndex === null ? fallbackIndex : idIndex
}

function buildRoomKey(room) {
  const date = room?.date ? new Date(room.date) : null
  const dateKey = Number.isFinite(date?.getTime?.())
    ? date.toISOString().split('T')[0]
    : compactText(room?.date || 'date')

  return compactText(room?.key) || `${compactText(room?.site)}_${compactText(room?.name)}_${dateKey}`
}

function buildConfigSiteFromPlanning(roomConfig = {}, siteConfig = null, totalSlots = 0) {
  const nextConfig = roomConfig && typeof roomConfig === 'object' ? { ...roomConfig } : {}

  if (siteConfig) {
    nextConfig.breakline = parsePositiveNumber(siteConfig.breaklineMinutes, parsePositiveNumber(nextConfig.breakline, 0) * 60) / 60
    nextConfig.tpiTime = parsePositiveNumber(siteConfig.tpiTimeMinutes, parsePositiveNumber(nextConfig.tpiTime, 1) * 60) / 60
    nextConfig.firstTpiStart = parseTimeToDecimal(siteConfig.firstTpiStartTime || nextConfig.firstTpiStart)
    nextConfig.minTpiPerRoom = parsePositiveInteger(siteConfig.minTpiPerRoom, parsePositiveInteger(nextConfig.minTpiPerRoom, 3))
  }

  if (!parsePositiveInteger(nextConfig.minTpiPerRoom, 0)) {
    nextConfig.minTpiPerRoom = 3
  }
  nextConfig.numSlots = totalSlots
  return nextConfig
}

function enrichPublishedRoomsScheduleConfig(rooms = [], planningConfig = null) {
  return cloneRooms(rooms).map((room) => {
    const tpiDatas = Array.isArray(room?.tpiDatas) ? room.tpiDatas : []
    const siteConfig = getPlanningSiteConfig(planningConfig, room?.site)
    const configuredSlotCount = parsePositiveInteger(siteConfig?.numSlots, 0)
    const existingConfiguredSlotCount = parsePositiveInteger(room?.configSite?.numSlots, 0)
    const maxTpiIndex = tpiDatas.reduce(
      (maxIndex, tpiData, index) => Math.max(maxIndex, getPublishedTpiSlotIndex(tpiData, index)),
      -1
    )
    const totalSlots = Math.max(
      configuredSlotCount,
      existingConfiguredSlotCount,
      tpiDatas.length,
      maxTpiIndex + 1,
      0
    )
    const roomKey = buildRoomKey(room)
    const expandedTpiDatas = Array.from(
      { length: totalSlots },
      (_, index) => createEmptyTpiData(roomKey, index)
    )

    tpiDatas.forEach((tpiData, fallbackIndex) => {
      const slotIndex = getPublishedTpiSlotIndex(tpiData, fallbackIndex)
      if (slotIndex < 0 || slotIndex >= expandedTpiDatas.length) {
        return
      }

      expandedTpiDatas[slotIndex] = tpiData
    })

    return {
      ...room,
      configSite: buildConfigSiteFromPlanning(room?.configSite, siteConfig, totalSlots),
      tpiDatas: expandedTpiDatas
    }
  })
}

async function loadPlanningConfigSafe(year) {
  try {
    return await getPlanningConfig(year)
  } catch (error) {
    console.error('Erreur chargement configuration planning pour publication défenses:', error)
    return null
  }
}

function getPersonDisplayName(person) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim()
}

function getPersonId(person) {
  if (!person?._id) {
    return null
  }

  return String(person._id)
}

function createEmptyOffers() {
  return {
    isValidated: false,
    submit: []
  }
}

function createEmptyTpiData(roomKey, periodIndex) {
  return {
    refTpi: null,
    id: `${roomKey}_${periodIndex}`,
    period: periodIndex + 1,
    startTime: '',
    endTime: '',
    candidat: '',
    expert1: { name: '', offres: createEmptyOffers() },
    expert2: { name: '', offres: createEmptyOffers() },
    boss: { name: '', offres: createEmptyOffers() }
  }
}

function inferFirstTpiStart(slot, tpiTime, breakline) {
  const slotStart = parseTimeToDecimal(slot?.startTime)
  const period = parsePositiveInteger(slot?.period, 1)

  return slotStart - ((period - 1) * (tpiTime + breakline))
}

function buildRoomConfig(slot, totalSlots, appearance = {}, siteConfig = null) {
  const breaklineMinutes = parsePositiveNumber(
    siteConfig?.breaklineMinutes,
    parsePositiveNumber(slot?.config?.breakAfter, 0)
  )
  const tpiTimeMinutes = parsePositiveNumber(
    siteConfig?.tpiTimeMinutes,
    parsePositiveNumber(slot?.config?.duration, 60)
  )
  const breakline = breaklineMinutes / 60
  const tpiTime = tpiTimeMinutes / 60
  const configuredFirstStart = compactText(siteConfig?.firstTpiStartTime)

  return {
    breakline,
    tpiTime,
    firstTpiStart: configuredFirstStart
      ? parseTimeToDecimal(configuredFirstStart)
      : inferFirstTpiStart(slot, tpiTime, breakline),
    numSlots: totalSlots,
    ...(appearance.soutenanceColor !== undefined ? { soutenanceColor: appearance.soutenanceColor } : {}),
    ...(appearance.stakeholderIcons ? { stakeholderIcons: appearance.stakeholderIcons } : {})
  }
}

function inferPublishedRoomClassModeFromEntries(entries = []) {
  const detectedModes = Array.from(
    new Set(
      (Array.isArray(entries) ? entries : [])
        .map((entry) => inferTpiClassMode(entry?.tpi || entry))
        .filter(Boolean)
    )
  )

  return detectedModes.length === 1 ? detectedModes[0] : null
}

async function publishConfirmedPlanningSoutenances(year) {
  return await publishConfirmedPlanningSoutenancesVersioned(year)
}

function cloneRooms(rooms) {
  return JSON.parse(JSON.stringify(Array.isArray(rooms) ? rooms : []))
}

function normalizeViewerName(name) {
  return String(name || '').trim().toLowerCase()
}

function doesTpiDataMatchViewer(tpiData, viewer = {}) {
  if (!viewer.personId && !viewer.name) {
    return true
  }

  const participantIds = [
    tpiData?.candidatPersonId,
    tpiData?.expert1?.personId,
    tpiData?.expert2?.personId,
    tpiData?.boss?.personId
  ]
    .filter(Boolean)
    .map(value => String(value))

  if (viewer.personId && participantIds.includes(String(viewer.personId))) {
    return true
  }

  if (!viewer.name) {
    return false
  }

  const normalizedViewerName = normalizeViewerName(viewer.name)
  const participantNames = [
    tpiData?.candidat,
    tpiData?.expert1?.name,
    tpiData?.expert2?.name,
    tpiData?.boss?.name
  ]

  return participantNames.some(name => normalizeViewerName(name).includes(normalizedViewerName))
}

function filterPublishedRooms(rooms, viewer = {}) {
  if (!viewer.personId && !viewer.name) {
    return cloneRooms(rooms)
  }

  return cloneRooms(rooms).flatMap(room => {
    const filteredTpis = (room.tpiDatas || []).filter(tpiData =>
      doesTpiDataMatchViewer(tpiData, viewer)
    )

    if (filteredTpis.length === 0) {
      return []
    }

    return [{
      ...room,
      tpiDatas: filteredTpis
    }]
  })
}

async function loadSoutenanceAppearance() {
  try {
    const catalog = await getSharedPlanningCatalog()
    const sites = Array.isArray(catalog?.sites) ? catalog.sites : []
    const siteAppearanceByCode = new Map()
    const roomAppearanceByKey = new Map()

    sites.forEach((site) => {
      const siteCode = compactText(site?.code || site?.siteCode || site?.label).toUpperCase()
      if (!siteCode) {
        return
      }

      siteAppearanceByCode.set(siteCode, {
        soutenanceColor: normalizeSoutenanceColor(
          site?.soutenanceColor || site?.defenseColor || site?.defenceColor || ''
        )
      })

      const rooms = Array.isArray(site?.roomDetails) ? site.roomDetails : []
      rooms.forEach((room) => {
        const soutenanceColor = normalizeSoutenanceColor(
          room?.soutenanceColor || room?.defenseColor || room?.defenceColor || ''
        )
        if (!soutenanceColor) {
          return
        }

        const roomKeys = Array.from(new Set([
          compactText(room?.code),
          compactText(room?.label),
          compactText(room?.name)
        ].filter(Boolean)))

        roomKeys.forEach((roomKey) => {
          roomAppearanceByKey.set(`${siteCode}|${roomKey.toUpperCase()}`, {
            soutenanceColor
          })
        })
      })
    })

    return {
      stakeholderIcons: normalizeStakeholderIcons(catalog?.stakeholderIcons),
      siteAppearanceByCode,
      roomAppearanceByKey
    }
  } catch (error) {
    console.error('Erreur chargement apparence défenses:', error)
    return {
      stakeholderIcons: { ...DEFAULT_STAKEHOLDER_ICONS },
      siteAppearanceByCode: new Map(),
      roomAppearanceByKey: new Map()
    }
  }
}

function getRoomAppearance(room, appearance = {}) {
  const siteCode = compactText(room?.site || room?.configSite?.siteCode || '').toUpperCase()
  const siteAppearance = appearance.siteAppearanceByCode instanceof Map
    ? appearance.siteAppearanceByCode.get(siteCode)
    : null
  const roomName = compactText(room?.name || room?.roomName)
  const roomAppearance = appearance.roomAppearanceByKey instanceof Map && siteCode && roomName
    ? appearance.roomAppearanceByKey.get(`${siteCode}|${roomName.toUpperCase()}`)
    : null
  const soutenanceColor = roomAppearance?.soutenanceColor || siteAppearance?.soutenanceColor

  return {
    ...(soutenanceColor !== undefined ? { soutenanceColor: normalizeSoutenanceColor(soutenanceColor) } : {}),
    stakeholderIcons: normalizeStakeholderIcons(appearance.stakeholderIcons)
  }
}

function enrichPublishedRoomsAppearance(rooms = [], appearance = {}) {
  return cloneRooms(rooms).map((room) => {
    const roomAppearance = getRoomAppearance(room, appearance)

    return {
      ...room,
      configSite: {
        ...(room.configSite && typeof room.configSite === 'object' ? room.configSite : {}),
        ...roomAppearance
      }
    }
  })
}

async function getNextPublicationVersion(year) {
  const latest = await PublicationVersion.findOne({ year })
    .sort({ version: -1 })
    .select('version')
    .lean()

  return latest?.version ? latest.version + 1 : 1
}

async function getPublicationVersion(year, version) {
  return await PublicationVersion.findOne({ year, version }).lean()
}

async function getActivePublicationVersion(year) {
  return await PublicationVersion.findOne({ year, isActive: true })
    .sort({ version: -1 })
    .lean()
}

async function loadConfirmedPlanningTpis(year) {
  return await TpiPlanning.find({
    year: parseInt(year, 10),
    status: 'confirmed',
    confirmedSlot: { $ne: null }
  })
    .populate('candidat', 'firstName lastName')
    .populate('expert1', 'firstName lastName')
    .populate('expert2', 'firstName lastName')
    .populate('chefProjet', 'firstName lastName')
    .populate('confirmedSlot')
    .sort({ 'confirmedSlot.date': 1, 'confirmedSlot.period': 1, reference: 1 })
}

async function buildPublishedRoomsFromConfirmedTpis(year) {
  const confirmedTpis = await loadConfirmedPlanningTpis(year)
  const appearance = await loadSoutenanceAppearance()
  const planningConfig = await loadPlanningConfigSafe(year)

  if (confirmedTpis.length === 0) {
    return {
      rooms: [],
      confirmedTpiCount: 0
    }
  }

  const groupedRooms = new Map()

  for (const tpi of confirmedTpis) {
    const slot = tpi.confirmedSlot

    if (!slot) {
      continue
    }

    const dateKey = slot.date.toISOString().split('T')[0]
    const roomKey = `${slot.room.site}_${slot.room.name}_${dateKey}`

    if (!groupedRooms.has(roomKey)) {
      groupedRooms.set(roomKey, {
        key: roomKey,
        site: slot.room.site,
        name: slot.room.name,
        date: slot.date,
        slots: []
      })
    }

    groupedRooms.get(roomKey).slots.push({ tpi, slot })
  }

  const rooms = Array.from(groupedRooms.values())
    .map(room => {
      const sortedSlots = [...room.slots].sort((a, b) => a.slot.period - b.slot.period)
      const maxPeriod = sortedSlots.reduce(
        (maxValue, entry) => Math.max(maxValue, entry.slot.period),
        0
      )
      const siteConfig = getPlanningSiteConfig(planningConfig, room.site)
      const configuredSlotCount = parsePositiveInteger(siteConfig?.numSlots, 0)
      const totalSlots = Math.max(maxPeriod, configuredSlotCount)
      const roomIdentifier = buildStableNumericId(`${year}_${room.key}`)
      const tpiDatas = Array.from(
        { length: totalSlots },
        (_, index) => createEmptyTpiData(room.key, index)
      )

      for (const { tpi, slot } of sortedSlots) {
        const periodIndex = Math.max(slot.period - 1, 0)

        tpiDatas[periodIndex] = {
          refTpi: tpi.reference,
          id: `${room.key}_${periodIndex}`,
          period: slot.period,
          startTime: slot.startTime,
          endTime: slot.endTime,
          candidat: getPersonDisplayName(tpi.candidat),
          candidatPersonId: getPersonId(tpi.candidat),
          expert1: {
            name: getPersonDisplayName(tpi.expert1),
            personId: getPersonId(tpi.expert1),
            offres: createEmptyOffers()
          },
          expert2: {
            name: getPersonDisplayName(tpi.expert2),
            personId: getPersonId(tpi.expert2),
            offres: createEmptyOffers()
          },
          boss: {
            name: getPersonDisplayName(tpi.chefProjet),
            personId: getPersonId(tpi.chefProjet),
            offres: createEmptyOffers()
          }
        }
      }

      return {
        idRoom: roomIdentifier,
        lastUpdate: Date.now(),
        site: room.site,
        date: room.date,
        name: room.name,
        roomClassMode: inferPublishedRoomClassModeFromEntries(sortedSlots),
        configSite: buildRoomConfig(
          sortedSlots[0].slot,
          totalSlots,
          getRoomAppearance(room, appearance),
          siteConfig
        ),
        tpiDatas
      }
    })
    .sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
      if (dateCompare !== 0) {
        return dateCompare
      }

      return a.name.localeCompare(b.name)
    })

  return {
    rooms,
    confirmedTpiCount: confirmedTpis.length
  }
}

async function syncLegacyPublishedRooms(year, rooms) {
  const DataRooms = getSoutenanceModel(year)

  await DataRooms.deleteMany({})

  if (!Array.isArray(rooms) || rooms.length === 0) {
    return []
  }

  return await DataRooms.insertMany(rooms)
}

async function syncPublishedSoutenancesToTpiCatalog(year, rooms, modelFactory = TpiModelsYear) {
  const TpiModel = modelFactory(parseInt(year, 10))
  const updates = []

  for (const room of Array.isArray(rooms) ? rooms : []) {
    const soutenanceDate = room?.date ? new Date(room.date) : null

    if (!Number.isFinite(soutenanceDate?.getTime?.())) {
      continue
    }

    for (const tpiData of Array.isArray(room?.tpiDatas) ? room.tpiDatas : []) {
      if (!tpiData?.refTpi) {
        continue
      }

      updates.push({
        updateOne: {
          filter: buildLegacyRefFilter('refTpi', tpiData.refTpi, year),
          update: {
            $set: {
              'dates.soutenance': soutenanceDate,
              salle: room.name || '',
              ...(room.site ? { 'lieu.site': room.site } : {})
            }
          }
        }
      })
    }
  }

  if (updates.length === 0) {
    return {
      matchedCount: 0,
      modifiedCount: 0
    }
  }

  return await TpiModel.bulkWrite(updates, { ordered: false })
}

async function publishConfirmedPlanningSoutenancesVersioned(year, user = null) {
  const normalizedYear = parseInt(year, 10)
  const { rooms, confirmedTpiCount } = await buildPublishedRoomsFromConfirmedTpis(normalizedYear)
  const version = await getNextPublicationVersion(normalizedYear)

  await PublicationVersion.updateMany(
    { year: normalizedYear, isActive: true },
    { $set: { isActive: false } }
  )

  const publicationVersion = await PublicationVersion.create({
    year: normalizedYear,
    version,
    isActive: true,
    publishedAt: new Date(),
    publishedBy: {
      id: user?.id ? String(user.id) : null,
      email: typeof user?.email === 'string' ? user.email : null
    },
    rooms,
    source: {
      confirmedTpiCount,
      roomsCount: rooms.length
    }
  })

  try {
    await syncLegacyPublishedRooms(normalizedYear, rooms)
  } catch (error) {
    console.error('Erreur synchro collection legacy défenses:', error)
  }

  try {
    await syncPublishedSoutenancesToTpiCatalog(normalizedYear, rooms)
  } catch (error) {
    console.error('Erreur synchro collection tpiList défenses:', error)
  }

  return {
    rooms,
    publicationVersion: publicationVersion.toObject()
  }
}

async function rollbackPublicationVersion(year, version) {
  const normalizedYear = parseInt(year, 10)
  const normalizedVersion = parseInt(version, 10)
  const targetVersion = await PublicationVersion.findOne({
    year: normalizedYear,
    version: normalizedVersion
  })

  if (!targetVersion) {
    const error = new Error('Version de publication introuvable.')
    error.statusCode = 404
    throw error
  }

  await PublicationVersion.updateMany(
    { year: normalizedYear, isActive: true },
    { $set: { isActive: false } }
  )

  targetVersion.isActive = true
  await targetVersion.save()

  try {
    await syncLegacyPublishedRooms(normalizedYear, targetVersion.rooms || [])
  } catch (error) {
    console.error('Erreur synchro rollback collection legacy défenses:', error)
  }

  try {
    await syncPublishedSoutenancesToTpiCatalog(normalizedYear, targetVersion.rooms || [])
  } catch (error) {
    console.error('Erreur synchro rollback collection tpiList défenses:', error)
  }

  return {
    publicationVersion: targetVersion.toObject()
  }
}

async function listPublishedSoutenances(year, options = {}) {
  const normalizedYear = parseInt(year, 10)
  const requestedVersion = Number.isInteger(options.version)
    ? options.version
    : parseInt(options.version, 10)

  const explicitVersion = Number.isInteger(requestedVersion)
    ? await getPublicationVersion(normalizedYear, requestedVersion)
    : null

  const activeVersion = explicitVersion || await getActivePublicationVersion(normalizedYear)
  const appearance = await loadSoutenanceAppearance()
  const planningConfig = await loadPlanningConfigSafe(normalizedYear)

  if (activeVersion?.rooms) {
    const scheduledRooms = enrichPublishedRoomsScheduleConfig(activeVersion.rooms, planningConfig)
    return filterPublishedRooms(enrichPublishedRoomsAppearance(scheduledRooms, appearance), {
      personId: options.viewerPersonId || null,
      name: options.viewerName || null
    })
  }

  const DataRooms = getSoutenanceModel(normalizedYear)
  const legacyRooms = await DataRooms.find().lean()

  const scheduledLegacyRooms = enrichPublishedRoomsScheduleConfig(legacyRooms, planningConfig)
  return filterPublishedRooms(enrichPublishedRoomsAppearance(scheduledLegacyRooms, appearance), {
    personId: options.viewerPersonId || null,
    name: options.viewerName || null
  })
}

async function publishSoutenanceRoom(year, roomData) {
  const DataRooms = getSoutenanceModel(year)

  return await DataRooms.findOneAndUpdate(
    { idRoom: roomData.idRoom },
    roomData,
    {
      new: true,
      runValidators: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  )
}

async function updatePublishedSoutenanceOffers(year, roomId, tpiDataId, expertOrBoss, offres) {
  const DataRooms = getSoutenanceModel(year)
  const room = await DataRooms.findById(roomId)

  if (!room) {
    return null
  }

  const tpiData = room.tpiDatas.id(tpiDataId)

  if (!tpiData) {
    return null
  }

  tpiData[expertOrBoss].offres = offres
  await room.save()
  await updateActivePublicationOffersByLegacyId(year, tpiData.id, expertOrBoss, offres)

  return tpiData
}

async function updatePublishedSoutenanceOffersByLegacyId(year, tpiLegacyId, expertOrBoss, offres) {
  const DataRooms = getSoutenanceModel(year)
  const room = await DataRooms.findOne({ 'tpiDatas.id': tpiLegacyId })

  if (!room) {
    return null
  }

  const tpiData = room.tpiDatas.find(entry => entry.id === tpiLegacyId)

  if (!tpiData) {
    return null
  }

  tpiData[expertOrBoss].offres = offres
  await room.save()
  await updateActivePublicationOffersByLegacyId(year, tpiLegacyId, expertOrBoss, offres)

  return {
    room,
    tpiData
  }
}

async function updateActivePublicationOffersByLegacyId(year, tpiLegacyId, expertOrBoss, offres) {
  const activeVersion = await PublicationVersion.findOne({
    year: parseInt(year, 10),
    isActive: true
  })

  if (!activeVersion) {
    return null
  }

  let changed = false

  for (const room of activeVersion.rooms || []) {
    for (const tpiData of room.tpiDatas || []) {
      if (tpiData.id !== tpiLegacyId || !tpiData[expertOrBoss]) {
        continue
      }

      tpiData[expertOrBoss].offres = offres
      changed = true
      break
    }

    if (changed) {
      break
    }
  }

  if (!changed) {
    return null
  }

  activeVersion.markModified('rooms')
  await activeVersion.save()

  return activeVersion
}

module.exports = {
  getSoutenanceModel,
  enrichPublishedRoomsAppearance,
  enrichPublishedRoomsScheduleConfig,
  filterPublishedRooms,
  inferPublishedRoomClassModeFromEntries,
  listPublishedSoutenances,
  publishSoutenanceRoom,
  publishConfirmedPlanningSoutenances,
  syncPublishedSoutenancesToTpiCatalog,
  getActivePublicationVersion,
  getPublicationVersion,
  rollbackPublicationVersion,
  updatePublishedSoutenanceOffers,
  updatePublishedSoutenanceOffersByLegacyId
}
