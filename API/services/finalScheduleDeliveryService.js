const { jsPDF } = require('jspdf')
const mongoose = require('mongoose')

const Person = require('../models/personModel')
const PublicationVersion = require('../models/publicationVersionModel')
const { FinalScheduleDelivery } = require('../models/finalScheduleDeliveryModel')
const coordinationCatalogService = require('./coordinationCatalogService')
const emailService = require('./emailService')
const publishedSoutenanceService = require('./publishedSoutenanceService')
const {
  formatTpiStakeholderRoleLabel
} = require('../modules/stakeholders/stakeholderDefinitions')

const ICAL_TIMEZONE = 'Europe/Zurich'
const PDF_MARGIN = 12
const PENDING_DELIVERY_STALE_MS = 15 * 60 * 1000
const PERSONAL_PDF_COLUMNS = [
  { key: 'dateLabel', label: 'Date', width: 28 },
  { key: 'timeLabel', label: 'Horaire', width: 26 },
  { key: 'locationLabel', label: 'Salle', width: 34 },
  { key: 'reference', label: 'TPI', width: 32 },
  { key: 'candidateName', label: 'Candidat', width: 42 },
  { key: 'roleLabels', label: 'Rôle', width: 28 }
]
const GLOBAL_PDF_COLUMNS = [
  { key: 'dateLabel', label: 'Date', width: 28 },
  { key: 'timeLabel', label: 'Horaire', width: 24 },
  { key: 'site', label: 'Site', width: 23 },
  { key: 'roomName', label: 'Salle', width: 30 },
  { key: 'reference', label: 'TPI', width: 32 },
  { key: 'candidateName', label: 'Candidat', width: 44 },
  { key: 'expert1Name', label: 'Expert 1', width: 38 },
  { key: 'expert2Name', label: 'Expert 2', width: 38 },
  { key: 'projectLeadName', label: 'CDP', width: 36 }
]
const ZIP_UTF8_FLAG = 0x0800
const ZIP_STORE_METHOD = 0

const ZIP_CRC_TABLE = Array.from({ length: 256 }, (_, tableIndex) => {
  let value = tableIndex
  for (let bitIndex = 0; bitIndex < 8; bitIndex += 1) {
    value = (value & 1)
      ? (0xedb88320 ^ (value >>> 1))
      : (value >>> 1)
  }
  return value >>> 0
})

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function parseYear(value) {
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    const error = new Error('Année invalide.')
    error.statusCode = 400
    throw error
  }

  return parsed
}

function parseOptionalPositiveInteger(value) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function getPositiveInteger(value) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function getNonNegativeInteger(value) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function formatPersonName(person = {}) {
  person = person || {}

  return [
    compactText(person.firstName),
    compactText(person.lastName)
  ].filter(Boolean).join(' ').trim()
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  return date && !Number.isNaN(date.getTime()) ? date : null
}

function normalizeDateKey(value) {
  const date = normalizeDate(value)
  if (date) {
    return date.toISOString().slice(0, 10)
  }

  const raw = compactText(value)
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ''
}

function formatDateLabel(value) {
  const date = normalizeDate(value)
  if (!date) {
    return compactText(value) || 'Date à confirmer'
  }

  return date.toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function formatDateTimeLabel(value) {
  const date = normalizeDate(value)
  if (!date) {
    return ''
  }

  return date.toLocaleString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function sanitizeFileNamePart(value, fallback = 'soutenances') {
  const normalized = compactText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || fallback
}

function normalizeZipPathSegment(value, fallback = 'element') {
  return sanitizeFileNamePart(value, fallback).replace(/^\.+$/, fallback)
}

function escapeCsvField(value) {
  const text = compactText(value)
  return /[;"\r\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text
}

function buildCsvLine(values = []) {
  return values.map(escapeCsvField).join(';')
}

function encodeMimeHeader(value) {
  const text = compactText(value).replace(/[\r\n]+/g, ' ')
  if (!text) {
    return ''
  }

  return /^[\x20-\x7e]+$/.test(text)
    ? text
    : `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`
}

function encodeMimeAddressName(value) {
  const text = compactText(value).replace(/[\r\n]+/g, ' ')
  if (!text) {
    return ''
  }

  return /^[\x20-\x7e]+$/.test(text)
    ? `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    : encodeMimeHeader(text)
}

function buildMimeAddressHeader(name, email) {
  const safeEmail = compactText(email).replace(/[<>\r\n]+/g, '')
  const safeName = encodeMimeAddressName(name)
  return safeName ? `${safeName} <${safeEmail}>` : safeEmail
}

function foldBase64Content(content) {
  return normalizeZipEntryContent(content)
    .toString('base64')
    .replace(/.{1,76}/g, '$&\r\n')
    .trimEnd()
}

function buildMimeBoundary(prefix, target) {
  return [
    '----',
    prefix,
    sanitizeFileNamePart(target.personId || target.personName, 'participant'),
    Date.now().toString(36)
  ].join('_')
}

function buildScheduleFromRoomConfig(room = {}) {
  if (!room?.configSite) {
    return []
  }

  const totalSlots = getPositiveInteger(room.configSite.numSlots) || 0
  const breakDuration = Number(room.configSite.breakline) || 0
  const slotDuration = Number(room.configSite.tpiTime) || 0
  let currentTime = Number(room.configSite.firstTpiStart) || 0

  if (totalSlots <= 0 || slotDuration <= 0) {
    return []
  }

  return Array.from({ length: totalSlots }, (_, index) => {
    const startTime = currentTime
    const endTime = currentTime + slotDuration
    const startHours = Math.floor(startTime)
    const startMinutes = Math.floor((startTime % 1) * 60)
    const endHours = Math.floor(endTime)
    const endMinutes = Math.floor((endTime % 1) * 60)

    currentTime = index < totalSlots - 1
      ? endTime + breakDuration
      : endTime

    return {
      startTime: `${startHours < 10 ? `0${startHours}` : startHours}:${String(startMinutes).padStart(2, '0')}`,
      endTime: `${endHours < 10 ? `0${endHours}` : endHours}:${String(endMinutes).padStart(2, '0')}`
    }
  })
}

function getScheduleForRoom(room, schedule = []) {
  const roomSchedule = buildScheduleFromRoomConfig(room)
  return roomSchedule.length > 0 ? roomSchedule : schedule
}

function getLegacyScheduleIndex(tpiData, fallbackIndex = 0) {
  const originalIndex = getNonNegativeInteger(tpiData?.originalIndex)
  if (originalIndex !== null) {
    return originalIndex
  }

  const period = getPositiveInteger(tpiData?.period)
  if (period !== null) {
    return period - 1
  }

  const parsedIndex = getNonNegativeInteger(compactText(tpiData?.id).split('_').pop())
  return parsedIndex === null ? fallbackIndex : parsedIndex
}

function getDisplayedSlot(tpiData, schedule, fallbackIndex = 0) {
  if (tpiData?.startTime && tpiData?.endTime) {
    return {
      startTime: tpiData.startTime,
      endTime: tpiData.endTime
    }
  }

  const safeSchedule = Array.isArray(schedule) ? schedule : []

  return safeSchedule[getLegacyScheduleIndex(tpiData, fallbackIndex)] || {
    startTime: '',
    endTime: ''
  }
}

function getRoomSlotCount(room, schedule = []) {
  const roomSchedule = getScheduleForRoom(room, schedule)
  const tpiDatas = Array.isArray(room?.tpiDatas) ? room.tpiDatas : []
  const configuredSlots = getPositiveInteger(room?.configSite?.numSlots) || 0
  const maxTpiIndex = tpiDatas.reduce(
    (maxIndex, tpiData, index) => Math.max(maxIndex, getLegacyScheduleIndex(tpiData, index)),
    -1
  )

  return Math.max(
    configuredSlots,
    roomSchedule.length,
    tpiDatas.length,
    maxTpiIndex + 1,
    0
  )
}

function getRoomSlots(room, schedule = []) {
  const roomSchedule = getScheduleForRoom(room, schedule)
  const slotCount = getRoomSlotCount(room, roomSchedule)
  const slots = Array.from({ length: slotCount }, (_, index) => ({
    index,
    tpiData: null,
    displayedSlot: roomSchedule[index] || { startTime: '', endTime: '' }
  }))

  const tpiDatas = Array.isArray(room?.tpiDatas) ? room.tpiDatas : []
  tpiDatas.forEach((tpiData, fallbackIndex) => {
    const slotIndex = getLegacyScheduleIndex(tpiData, fallbackIndex)

    if (slotIndex < 0 || slotIndex >= slots.length) {
      return
    }

    slots[slotIndex] = {
      index: slotIndex,
      tpiData,
      displayedSlot: getDisplayedSlot(tpiData, roomSchedule, slotIndex)
    }
  })

  return slots
}

function hasPublishedDefense(tpiData = {}) {
  return Boolean(
    compactText(tpiData.refTpi) ||
    compactText(tpiData.candidat) ||
    compactText(tpiData.candidatPersonId)
  )
}

function getParticipantEntries(tpiData = {}) {
  return [
    {
      role: 'candidat',
      personId: compactText(tpiData.candidatPersonId),
      name: compactText(tpiData.candidat)
    },
    {
      role: 'expert1',
      personId: compactText(tpiData.expert1?.personId),
      name: compactText(tpiData.expert1?.name)
    },
    {
      role: 'expert2',
      personId: compactText(tpiData.expert2?.personId),
      name: compactText(tpiData.expert2?.name)
    },
    {
      role: 'chef_projet',
      personId: compactText(tpiData.boss?.personId),
      name: compactText(tpiData.boss?.name)
    }
  ].filter((entry) => entry.personId)
}

function getRoleLabel(role) {
  return formatTpiStakeholderRoleLabel(role)
}

function buildEventFromRoomSlot(room, tpiData, slot, index) {
  const startTime = compactText(slot?.startTime)
  const endTime = compactText(slot?.endTime)
  if (!hasPublishedDefense(tpiData) || !startTime || !endTime) {
    return null
  }

  const participants = getParticipantEntries(tpiData)
  const roleLabelsByPersonId = new Map()
  for (const participant of participants) {
    const current = roleLabelsByPersonId.get(participant.personId) || []
    current.push(getRoleLabel(participant.role))
    roleLabelsByPersonId.set(participant.personId, current)
  }

  const dateKey = normalizeDateKey(room.date)
  const roomName = compactText(room.name) || 'Salle à confirmer'
  const site = compactText(room.site)
  const locationLabel = [roomName, site].filter(Boolean).join(' - ')
  const reference = compactText(tpiData.refTpi) || `TPI ${index + 1}`

  return {
    id: `${dateKey}-${roomName}-${reference}-${index}`,
    date: room.date,
    dateKey,
    dateLabel: formatDateLabel(room.date),
    startTime,
    endTime,
    timeLabel: `${startTime} - ${endTime}`,
    site,
    roomName,
    locationLabel,
    reference,
    candidateName: compactText(tpiData.candidat) || 'Candidat à confirmer',
    expert1Name: compactText(tpiData.expert1?.name),
    expert2Name: compactText(tpiData.expert2?.name),
    projectLeadName: compactText(tpiData.boss?.name),
    participants,
    roleLabelsByPersonId
  }
}

function compareScheduleEvents(left, right) {
  return compactText(left.dateKey).localeCompare(compactText(right.dateKey)) ||
    compactText(left.startTime).localeCompare(compactText(right.startTime)) ||
    compactText(left.site).localeCompare(compactText(right.site), 'fr') ||
    compactText(left.roomName).localeCompare(compactText(right.roomName), 'fr') ||
    compactText(left.reference).localeCompare(compactText(right.reference), 'fr')
}

function collectScheduleEvents(rooms = []) {
  return (Array.isArray(rooms) ? rooms : [])
    .flatMap((room) => (
      getRoomSlots(room).map(({ tpiData, displayedSlot, index }) => (
        tpiData ? buildEventFromRoomSlot(room, tpiData, displayedSlot, index) : null
      ))
    ))
    .filter(Boolean)
    .sort(compareScheduleEvents)
}

function buildRecipientSchedules(events = []) {
  const byPersonId = new Map()

  for (const event of events) {
    for (const participant of event.participants) {
      if (!byPersonId.has(participant.personId)) {
        byPersonId.set(participant.personId, {
          personId: participant.personId,
          fallbackName: participant.name,
          roles: new Set(),
          events: []
        })
      }

      const schedule = byPersonId.get(participant.personId)
      schedule.roles.add(participant.role)
      schedule.events.push({
        ...event,
        roleLabels: event.roleLabelsByPersonId.get(participant.personId) || [getRoleLabel(participant.role)]
      })
    }
  }

  return Array.from(byPersonId.values())
    .map((schedule) => ({
      ...schedule,
      roles: Array.from(schedule.roles),
      events: schedule.events.sort(compareScheduleEvents)
    }))
    .sort((left, right) => compactText(left.fallbackName).localeCompare(compactText(right.fallbackName), 'fr'))
}

async function loadPublication(year, publicationVersion = null) {
  const normalizedVersion = parseOptionalPositiveInteger(publicationVersion)
  const query = normalizedVersion
    ? { year, version: normalizedVersion }
    : { year, isActive: true }

  const publication = await PublicationVersion.findOne(query)
    .sort({ publishedAt: -1, version: -1 })
    .lean()

  if (!publication) {
    return {
      publication: null,
      rooms: []
    }
  }

  const rooms = await publishedSoutenanceService.listPublishedSoutenances(year, {
    version: publication.version
  })

  return {
    publication,
    rooms: Array.isArray(rooms) ? rooms : []
  }
}

async function loadPeopleById(personIds = []) {
  const uniqueIds = Array.from(new Set(personIds.map(compactText).filter(Boolean)))
  if (uniqueIds.length === 0) {
    return new Map()
  }

  let people = []
  try {
    people = await Person.find({ _id: { $in: uniqueIds } })
      .select('firstName lastName email roles sendEmails')
      .lean()
  } catch (error) {
    if (error?.name !== 'CastError') {
      throw error
    }

    const validObjectIds = uniqueIds.filter((personId) => mongoose.isValidObjectId(personId))
    people = validObjectIds.length > 0
      ? await Person.find({ _id: { $in: validObjectIds } })
        .select('firstName lastName email roles sendEmails')
        .lean()
      : []
  }

  return new Map(
    (Array.isArray(people) ? people : [])
      .filter((person) => person?._id)
      .map((person) => [String(person._id), person])
  )
}

async function loadDeliveriesByPersonId(year, publicationVersion) {
  if (!publicationVersion) {
    return new Map()
  }

  const deliveries = await FinalScheduleDelivery.find({
    year,
    publicationVersion
  }).lean()

  return new Map(
    (Array.isArray(deliveries) ? deliveries : [])
      .filter((delivery) => delivery?.personId)
      .map((delivery) => [String(delivery.personId), delivery])
  )
}

function buildTargetFromSchedule(schedule, peopleById, deliveriesByPersonId) {
  const person = peopleById.get(schedule.personId) || null
  const personObjectId = person?._id ? String(person._id) : ''
  const personName = formatPersonName(person) || schedule.fallbackName || 'Partie prenante'
  const recipientEmail = compactText(person?.email).toLowerCase()
  const existingDelivery = deliveriesByPersonId.get(personObjectId || schedule.personId) || null
  const hasValidPersonId = mongoose.isValidObjectId(schedule.personId)
  const hasRegistryPerson = Boolean(personObjectId)
  const sendDisabled = hasRegistryPerson && person?.sendEmails === false
  const skippedReason = !hasValidPersonId
    ? 'invalid_person_id'
    : !hasRegistryPerson
      ? 'person_not_found'
      : !recipientEmail
        ? 'missing_email'
        : sendDisabled
          ? 'send_emails_disabled'
          : ''
  const canSendEmail = !skippedReason

  return {
    personId: schedule.personId,
    personObjectId,
    personName,
    recipientEmail,
    roles: schedule.roles,
    roleLabels: schedule.roles.map(getRoleLabel),
    tpiCount: schedule.events.length,
    events: schedule.events,
    canSendEmail,
    skippedReason,
    alreadySent: existingDelivery?.status === 'sent',
    inProgress: existingDelivery?.status === 'pending',
    deliveryStatus: existingDelivery?.status || '',
    sentAt: existingDelivery?.sentAt || null,
    messageId: existingDelivery?.messageId || ''
  }
}

function summarizeTargets(targets = []) {
  const recipientCount = targets.length
  const sendableCount = targets.filter((target) => target.canSendEmail).length
  const alreadySentCount = targets.filter((target) => target.alreadySent).length
  const inProgressCount = targets.filter((target) => target.inProgress).length
  const disabledEmailCount = targets.filter((target) => target.skippedReason === 'send_emails_disabled').length
  const missingEmailCount = targets.filter((target) => target.skippedReason === 'missing_email').length
  const personNotFoundCount = targets.filter((target) => target.skippedReason === 'person_not_found').length
  const invalidPersonIdCount = targets.filter((target) => target.skippedReason === 'invalid_person_id').length

  return {
    recipientCount,
    sendableCount,
    pendingSendCount: targets.filter((target) => target.canSendEmail && !target.alreadySent && !target.inProgress).length,
    alreadySentCount,
    inProgressCount,
    disabledEmailCount,
    missingEmailCount,
    personNotFoundCount,
    invalidPersonIdCount,
    attachmentCountPerRecipient: 3
  }
}

function toPreviewRecipient(target) {
  return {
    personId: target.personId,
    personName: target.personName,
    recipientEmail: target.recipientEmail,
    roleLabels: target.roleLabels,
    tpiCount: target.tpiCount,
    canSendEmail: target.canSendEmail,
    skippedReason: target.skippedReason,
    alreadySent: target.alreadySent,
    inProgress: target.inProgress,
    deliveryStatus: target.deliveryStatus,
    sentAt: target.sentAt
  }
}

async function buildFinalScheduleContext({ year, publicationVersion = null }) {
  const normalizedYear = parseYear(year)
  const { publication, rooms } = await loadPublication(normalizedYear, publicationVersion)

  if (!publication) {
    return {
      year: normalizedYear,
      available: false,
      reason: 'no_active_publication',
      publicationVersion: null,
      rooms: [],
      events: [],
      targets: []
    }
  }

  const events = collectScheduleEvents(rooms)
  const schedules = buildRecipientSchedules(events)
  const [peopleById, deliveriesByPersonId] = await Promise.all([
    loadPeopleById(schedules.map((schedule) => schedule.personId)),
    loadDeliveriesByPersonId(normalizedYear, publication.version)
  ])
  const targets = schedules.map((schedule) => (
    buildTargetFromSchedule(schedule, peopleById, deliveriesByPersonId)
  ))

  return {
    year: normalizedYear,
    available: true,
    publication,
    publicationVersion: publication.version,
    publicationPublishedAt: publication.publishedAt || null,
    rooms,
    events,
    targets
  }
}

async function previewFinalScheduleDelivery({ year, publicationVersion = null } = {}) {
  const context = await buildFinalScheduleContext({ year, publicationVersion })

  if (!context.available) {
    return {
      success: true,
      year: context.year,
      available: false,
      reason: context.reason,
      summary: summarizeTargets([]),
      recipients: []
    }
  }

  const roomCount = Array.isArray(context.rooms) ? context.rooms.length : 0
  const uniqueTpiReferences = new Set(
    context.events.map((event) => compactText(event.reference)).filter(Boolean)
  )

  return {
    success: true,
    year: context.year,
    available: true,
    publicationVersion: context.publicationVersion,
    publicationPublishedAt: context.publicationPublishedAt,
    roomCount,
    tpiCount: uniqueTpiReferences.size,
    summary: summarizeTargets(context.targets),
    recipients: context.targets.map(toPreviewRecipient)
  }
}

function escapeIcsText(value) {
  return compactText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function buildICalDateTime(dateValue, timeValue) {
  const dateKey = normalizeDateKey(dateValue)
  const [hours, minutes] = compactText(timeValue).split(':')

  if (!dateKey || !hours || !minutes) {
    return ''
  }

  return `${dateKey.replace(/-/g, '')}T${hours.padStart(2, '0')}${minutes.padStart(2, '0')}00`
}

function foldIcsLine(line) {
  const safeLine = String(line || '')
  if (safeLine.length <= 74) {
    return safeLine
  }

  const chunks = []
  let remaining = safeLine
  while (remaining.length > 74) {
    chunks.push(remaining.slice(0, 74))
    remaining = ` ${remaining.slice(74)}`
  }
  chunks.push(remaining)
  return chunks.join('\r\n')
}

function buildIcalContent(events = [], personId = 'participant') {
  const dtStamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z/g, 'Z')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//tpiOrganizer2023//FinalSchedule//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    `TZID:${ICAL_TIMEZONE}`,
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE'
  ]

  events.forEach((event, index) => {
    const start = buildICalDateTime(event.date, event.startTime)
    const end = buildICalDateTime(event.date, event.endTime)
    if (!start || !end) {
      return
    }

    const uid = [
      sanitizeFileNamePart(personId, 'person'),
      sanitizeFileNamePart(event.reference, 'tpi'),
      event.dateKey,
      index
    ].join('-')
    const description = [
      `Défense de TPI ${event.candidateName}`,
      `Expert 1: ${event.expert1Name || '-'}`,
      `Expert 2: ${event.expert2Name || '-'}`,
      `Chef de projet: ${event.projectLeadName || '-'}`
    ].join('\n')

    lines.push(
      'BEGIN:VEVENT',
      `DTSTAMP:${dtStamp}`,
      `UID:${uid}@tpi-organizer`,
      `DTSTART;TZID=${ICAL_TIMEZONE}:${start}`,
      `DTEND;TZID=${ICAL_TIMEZONE}:${end}`,
      `SUMMARY:${escapeIcsText(`Défense TPI ${event.reference} - ${event.candidateName}`)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `LOCATION:${escapeIcsText(event.locationLabel)}`,
      'TRANSP:OPAQUE',
      'CLASS:PUBLIC',
      'END:VEVENT'
    )
  })

  lines.push('END:VCALENDAR')
  return lines.map(foldIcsLine).join('\r\n')
}

function drawPdfHeader(doc, title, subtitle = '') {
  doc.setFillColor(15, 118, 110)
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(title, PDF_MARGIN, 11)

  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(subtitle, doc.internal.pageSize.getWidth() - PDF_MARGIN, 11, { align: 'right' })
  }

  doc.setTextColor(15, 23, 42)
}

function drawPdfFooter(doc, pageIndex, pageCount, generatedAtLabel) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text(`Généré le ${generatedAtLabel}`, PDF_MARGIN, pageHeight - 7)
  doc.text(`${pageIndex}/${pageCount}`, pageWidth - PDF_MARGIN, pageHeight - 7, { align: 'right' })
  doc.setTextColor(15, 23, 42)
}

function splitPdfText(doc, value, width) {
  const text = compactText(Array.isArray(value) ? value.join(', ') : value)
  return doc.splitTextToSize(text || '-', Math.max(width - 3, 4))
}

function renderTable(doc, rows, columns, options = {}) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const generatedAtLabel = options.generatedAtLabel || formatDateTimeLabel(new Date())
  const pageBottom = pageHeight - 14
  let y = options.startY || 28

  const drawHeader = () => {
    let x = PDF_MARGIN
    doc.setFillColor(226, 232, 240)
    doc.rect(PDF_MARGIN, y, pageWidth - (PDF_MARGIN * 2), 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(15, 23, 42)
    for (const column of columns) {
      doc.text(column.label, x + 1.5, y + 4.7)
      x += column.width
    }
    y += 8
  }

  drawHeader()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(options.fontSize || 7)

  for (const [rowIndex, row] of rows.entries()) {
    const cellLines = columns.map((column) => splitPdfText(doc, row[column.key], column.width))
    const rowHeight = Math.max(8, ...cellLines.map((lines) => lines.length * 3.3 + 3))

    if (y + rowHeight > pageBottom) {
      doc.addPage()
      drawPdfHeader(doc, options.title || '', options.subtitle || '')
      y = 28
      drawHeader()
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(options.fontSize || 7)
    }

    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 250, 252)
      doc.rect(PDF_MARGIN, y - 1, pageWidth - (PDF_MARGIN * 2), rowHeight, 'F')
    }

    let x = PDF_MARGIN
    doc.setTextColor(15, 23, 42)
    for (const [columnIndex, column] of columns.entries()) {
      doc.text(cellLines[columnIndex], x + 1.5, y + 3.5)
      x += column.width
    }

    y += rowHeight
  }

  const pageCount = doc.getNumberOfPages()
  for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
    doc.setPage(pageIndex)
    drawPdfFooter(doc, pageIndex, pageCount, generatedAtLabel)
  }
}

function createPdfBuffer(doc) {
  return Buffer.from(doc.output('arraybuffer'))
}

function buildPersonalPdfBuffer({ target, year, publicationVersion, generatedAtLabel }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const title = `Horaire personnel TPI ${year}`
  const subtitle = `${target.personName} - publication ${publicationVersion}`
  drawPdfHeader(doc, title, subtitle)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`${target.tpiCount} défense(s)`, PDF_MARGIN, 25)

  renderTable(
    doc,
    target.events.map((event) => ({
      ...event,
      roleLabels: Array.isArray(event.roleLabels) ? event.roleLabels.join(', ') : event.roleLabels
    })),
    PERSONAL_PDF_COLUMNS,
    {
      title,
      subtitle,
      startY: 31,
      generatedAtLabel,
      fontSize: 7
    }
  )

  return createPdfBuffer(doc)
}

function buildGlobalRoomsPdfBuffer({ events, year, publicationVersion, generatedAtLabel }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const title = `Planification des salles TPI ${year}`
  const subtitle = `Vue globale - publication ${publicationVersion}`
  drawPdfHeader(doc, title, subtitle)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`${events.length} défense(s) planifiée(s)`, PDF_MARGIN, 25)

  renderTable(doc, events, GLOBAL_PDF_COLUMNS, {
    title,
    subtitle,
    startY: 31,
    generatedAtLabel,
    fontSize: 6.5
  })

  return createPdfBuffer(doc)
}

function buildAttachments({ target, year, publicationVersion, globalRoomsPdf, generatedAtLabel }) {
  const fileBase = `${year}_${sanitizeFileNamePart(target.personName, 'participant')}`
  const icalContent = buildIcalContent(target.events, target.personId)
  const personalPdf = buildPersonalPdfBuffer({
    target,
    year,
    publicationVersion,
    generatedAtLabel
  })

  return [
    {
      filename: `${fileBase}_horaire.ics`,
      content: Buffer.from(icalContent, 'utf8'),
      contentType: 'text/calendar; charset=utf-8; method=PUBLISH'
    },
    {
      filename: `${fileBase}_horaire_personnel.pdf`,
      content: personalPdf,
      contentType: 'application/pdf'
    },
    {
      filename: `${year}_planification_salles.pdf`,
      content: globalRoomsPdf,
      contentType: 'application/pdf'
    }
  ]
}

function getZipDosDateTime(value = new Date()) {
  const date = normalizeDate(value) || new Date()
  const safeYear = Math.min(Math.max(date.getFullYear(), 1980), 2107)

  return {
    dosTime: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    dosDate: ((safeYear - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  }
}

function getCrc32(contentBuffer) {
  let crc = 0xffffffff

  for (const byte of contentBuffer) {
    crc = ZIP_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

function normalizeZipEntryContent(content) {
  if (Buffer.isBuffer(content)) {
    return content
  }

  return Buffer.from(String(content || ''), 'utf8')
}

function createZipBuffer(entries = []) {
  const localParts = []
  const centralParts = []
  const { dosTime, dosDate } = getZipDosDateTime()
  let offset = 0

  for (const rawEntry of entries) {
    const filename = compactText(rawEntry.path).replace(/\\/g, '/')
    if (!filename) {
      continue
    }

    const filenameBuffer = Buffer.from(filename, 'utf8')
    const contentBuffer = normalizeZipEntryContent(rawEntry.content)
    const crc32 = getCrc32(contentBuffer)

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(ZIP_UTF8_FLAG, 6)
    localHeader.writeUInt16LE(ZIP_STORE_METHOD, 8)
    localHeader.writeUInt16LE(dosTime, 10)
    localHeader.writeUInt16LE(dosDate, 12)
    localHeader.writeUInt32LE(crc32, 14)
    localHeader.writeUInt32LE(contentBuffer.length, 18)
    localHeader.writeUInt32LE(contentBuffer.length, 22)
    localHeader.writeUInt16LE(filenameBuffer.length, 26)
    localHeader.writeUInt16LE(0, 28)

    localParts.push(localHeader, filenameBuffer, contentBuffer)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(ZIP_UTF8_FLAG, 8)
    centralHeader.writeUInt16LE(ZIP_STORE_METHOD, 10)
    centralHeader.writeUInt16LE(dosTime, 12)
    centralHeader.writeUInt16LE(dosDate, 14)
    centralHeader.writeUInt32LE(crc32, 16)
    centralHeader.writeUInt32LE(contentBuffer.length, 20)
    centralHeader.writeUInt32LE(contentBuffer.length, 24)
    centralHeader.writeUInt16LE(filenameBuffer.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)

    centralParts.push(centralHeader, filenameBuffer)
    offset += localHeader.length + filenameBuffer.length + contentBuffer.length
  }

  const centralDirectoryOffset = offset
  const centralDirectorySize = centralParts.reduce((total, part) => total + part.length, 0)
  const entryCount = centralParts.length / 2
  const endHeader = Buffer.alloc(22)
  endHeader.writeUInt32LE(0x06054b50, 0)
  endHeader.writeUInt16LE(0, 4)
  endHeader.writeUInt16LE(0, 6)
  endHeader.writeUInt16LE(entryCount, 8)
  endHeader.writeUInt16LE(entryCount, 10)
  endHeader.writeUInt32LE(centralDirectorySize, 12)
  endHeader.writeUInt32LE(centralDirectoryOffset, 16)
  endHeader.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, ...centralParts, endHeader])
}

function buildManualEmailContent({ target, year, publicationVersion, roomCount, generatedAtLabel, emailSettings }) {
  const templateData = emailService.buildTemplateData({
    recipientName: target.personName,
    year,
    publicationVersion,
    tpiCount: target.tpiCount,
    roomCount,
    generatedAtLabel
  }, { emailSettings })

  return emailService.emailTemplates.soutenanceSchedulePackage(templateData)
}

function buildOutlookDraftEml({ target, emailContent, attachments = [], emailSettings }) {
  const sender = emailService.resolveMailSender(emailSettings)
  const mixedBoundary = buildMimeBoundary('mixed', target)
  const alternativeBoundary = buildMimeBoundary('alternative', target)
  const textContent = compactText(emailContent.text)
  const htmlContent = compactText(emailContent.html)
  const lines = [
    `From: ${sender.header}`,
    `To: ${buildMimeAddressHeader(target.personName, target.recipientEmail)}`,
    `Subject: ${encodeMimeHeader(emailContent.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'X-Unsent: 1',
    'Content-Class: urn:content-classes:message',
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    '',
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    '',
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    foldBase64Content(Buffer.from(textContent, 'utf8')),
    '',
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    foldBase64Content(Buffer.from(htmlContent, 'utf8')),
    '',
    `--${alternativeBoundary}--`
  ]

  for (const attachment of attachments) {
    const filename = sanitizeFileNamePart(attachment.filename, 'piece_jointe')
    lines.push(
      '',
      `--${mixedBoundary}`,
      `Content-Type: ${attachment.contentType || 'application/octet-stream'}; name="${filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${filename}"`,
      '',
      foldBase64Content(attachment.content)
    )
  }

  lines.push('', `--${mixedBoundary}--`, '')
  return lines.join('\r\n')
}

function buildManualPackageSummary(targets = [], packagedTargets = []) {
  const targetSummary = summarizeTargets(targets)

  return {
    ...targetSummary,
    packagedCount: packagedTargets.length,
    skippedCount: Math.max(targets.length - packagedTargets.length, 0)
  }
}

function buildManualManifestCsv({ targets = [], publicationVersion, year, generatedAtLabel }) {
  const lines = [
    buildCsvLine([
      'Nom',
      'Email',
      'TPI',
      'Publication',
      'Généré le',
      'Statut',
      'Fichiers'
    ])
  ]

  for (const target of targets) {
    const baseName = `${year}_${sanitizeFileNamePart(target.personName, 'participant')}`
    lines.push(buildCsvLine([
      target.personName,
      target.recipientEmail,
      target.tpiCount,
      publicationVersion,
      generatedAtLabel,
      'brouillon Outlook à envoyer',
      [
        `${baseName}_outlook.eml`,
        `${baseName}_horaire.ics`,
        `${baseName}_horaire_personnel.pdf`,
        `${year}_planification_salles.pdf`
      ].join(' | ')
    ]))
  }

  return `${lines.join('\r\n')}\r\n`
}

async function buildManualFinalSchedulePackage({
  year,
  publicationVersion = null,
  forceResend = false
} = {}) {
  const context = await buildFinalScheduleContext({ year, publicationVersion })

  if (!context.available) {
    return {
      success: false,
      year: context.year,
      available: false,
      reason: context.reason,
      summary: buildManualPackageSummary([], [])
    }
  }

  const generatedAt = new Date()
  const generatedAtLabel = formatDateTimeLabel(generatedAt)
  const emailSettings = await coordinationCatalogService.getSharedEmailSettingsIfAvailable()
  const globalRoomsPdf = buildGlobalRoomsPdfBuffer({
    events: context.events,
    year: context.year,
    publicationVersion: context.publicationVersion,
    generatedAtLabel
  })
  const roomCount = Array.isArray(context.rooms) ? context.rooms.length : 0
  const packageTargets = context.targets.filter((target) => (
    target.canSendEmail &&
    (forceResend === true || (!target.alreadySent && !target.inProgress))
  ))
  const zipEntries = [
    {
      path: 'README.txt',
      content: [
        `Paquet Outlook manuel horaires définitifs TPI ${context.year}`,
        `Publication: ${context.publicationVersion}`,
        `Généré le: ${generatedAtLabel}`,
        `Destinataires préparés: ${packageTargets.length}`,
        '',
        'Chaque dossier destinataire contient un brouillon Outlook .eml, le message HTML/TXT, le fichier iCal personnel, le PDF personnel et le PDF global des salles.',
        'Ouvrir le fichier .eml dans Outlook, vérifier le message, puis cliquer sur Envoyer.',
        'Aucun email SMTP n’a été envoyé par cette action.'
      ].join('\r\n')
    },
    {
      path: 'manifest.csv',
      content: buildManualManifestCsv({
        targets: packageTargets,
        publicationVersion: context.publicationVersion,
        year: context.year,
        generatedAtLabel
      })
    }
  ]

  packageTargets.forEach((target, index) => {
    const folderName = [
      String(index + 1).padStart(2, '0'),
      normalizeZipPathSegment(target.personName, 'participant'),
      normalizeZipPathSegment(target.personId, 'person').slice(-8)
    ].filter(Boolean).join('_')
    const folderPath = `destinataires/${folderName}`
    const emailContent = buildManualEmailContent({
      target,
      year: context.year,
      publicationVersion: context.publicationVersion,
      roomCount,
      generatedAtLabel,
      emailSettings
    })
    const attachments = buildAttachments({
      target,
      year: context.year,
      publicationVersion: context.publicationVersion,
      globalRoomsPdf,
      generatedAtLabel
    })
    const emlFilename = `${context.year}_${sanitizeFileNamePart(target.personName, 'participant')}_outlook.eml`

    zipEntries.push(
      {
        path: `${folderPath}/${emlFilename}`,
        content: buildOutlookDraftEml({
          target,
          emailContent,
          attachments,
          emailSettings
        })
      },
      {
        path: `${folderPath}/message.txt`,
        content: [
          `À: ${target.recipientEmail}`,
          `Sujet: ${emailContent.subject}`,
          '',
          compactText(emailContent.text)
        ].join('\r\n')
      },
      {
        path: `${folderPath}/message.html`,
        content: emailContent.html
      },
      ...attachments.map((attachment) => ({
        path: `${folderPath}/${attachment.filename}`,
        content: attachment.content
      }))
    )
  })

  const filename = [
    context.year,
    'horaires_definitifs',
    `publication_${context.publicationVersion}`,
    'outlook.zip'
  ].join('_')

  return {
    success: true,
    year: context.year,
    available: true,
    publicationVersion: context.publicationVersion,
    filename,
    contentType: 'application/zip',
    buffer: createZipBuffer(zipEntries),
    summary: buildManualPackageSummary(context.targets, packageTargets)
  }
}

async function markDelivery({
  year,
  publicationVersion,
  target,
  status,
  messageId = '',
  error = '',
  attachmentCount = 0,
  sentAt = null
}) {
  const personId = target.personObjectId || target.personId

  return await FinalScheduleDelivery.findOneAndUpdate(
    {
      year,
      publicationVersion,
      personId
    },
    {
      $set: {
        recipientEmail: target.recipientEmail || '',
        recipientName: target.personName || '',
        status,
        messageId,
        error,
        tpiCount: target.tpiCount || 0,
        attachmentCount,
        sentAt,
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    {
      upsert: true,
      new: true
    }
  )
}

async function reserveDelivery({
  year,
  publicationVersion,
  target,
  forceResend = false
}) {
  const personId = target.personObjectId || target.personId

  if (!mongoose.isValidObjectId(personId)) {
    return {
      reserved: false,
      skippedReason: 'invalid_person_id'
    }
  }

  const staleBefore = new Date(Date.now() - PENDING_DELIVERY_STALE_MS)
  const reusableStatuses = ['failed', 'skipped']
  const filter = {
    year,
    publicationVersion,
    personId
  }

  if (forceResend !== true) {
    filter.$or = [
      { status: { $in: reusableStatuses } },
      { status: 'pending', updatedAt: { $lt: staleBefore } },
      { status: { $exists: false } }
    ]
  }

  try {
    const reservation = await FinalScheduleDelivery.findOneAndUpdate(
      filter,
      {
        $set: {
          recipientEmail: target.recipientEmail || '',
          recipientName: target.personName || '',
          status: 'pending',
          messageId: '',
          error: '',
          tpiCount: target.tpiCount || 0,
          attachmentCount: 0,
          sentAt: null,
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      {
        upsert: true,
        new: true
      }
    )

    return {
      reserved: true,
      reservation
    }
  } catch (error) {
    if (error?.code !== 11000) {
      throw error
    }

    const current = await FinalScheduleDelivery.findOne({
      year,
      publicationVersion,
      personId
    }).lean()

    return {
      reserved: false,
      skippedReason: current?.status === 'sent'
        ? 'already_sent'
        : current?.status === 'pending'
          ? 'send_in_progress'
          : 'delivery_locked',
      delivery: current || null
    }
  }
}

function summarizeSendResults(results = []) {
  const isSentResult = (result) => (
    result.deliveryStatus === 'sent' ||
    result.deliveryStatus === 'sent_unrecorded'
  )

  return {
    requestedCount: results.length,
    sentCount: results.filter(isSentResult).length,
    skippedCount: results.filter((result) => result.deliveryStatus === 'skipped').length,
    failedCount: results.filter((result) => result.deliveryStatus === 'failed').length,
    alreadySentCount: results.filter((result) => result.skippedReason === 'already_sent').length,
    inProgressCount: results.filter((result) => result.skippedReason === 'send_in_progress').length,
    recordingFailedCount: results.filter((result) => result.deliveryStatus === 'sent_unrecorded').length
  }
}

async function sendFinalScheduleDelivery({
  year,
  publicationVersion = null,
  forceResend = false
} = {}) {
  const context = await buildFinalScheduleContext({ year, publicationVersion })

  if (!context.available) {
    return {
      success: false,
      year: context.year,
      available: false,
      reason: context.reason,
      summary: summarizeSendResults([]),
      results: []
    }
  }

  const generatedAtLabel = formatDateTimeLabel(new Date())
  const emailSettings = await coordinationCatalogService.getSharedEmailSettingsIfAvailable()
  const globalRoomsPdf = buildGlobalRoomsPdfBuffer({
    events: context.events,
    year: context.year,
    publicationVersion: context.publicationVersion,
    generatedAtLabel
  })
  const roomCount = Array.isArray(context.rooms) ? context.rooms.length : 0
  const results = []

  for (const target of context.targets) {
    if (!target.canSendEmail) {
      results.push({
        personId: target.personId,
        recipientName: target.personName,
        recipientEmail: target.recipientEmail,
        deliveryStatus: 'skipped',
        skippedReason: target.skippedReason,
        tpiCount: target.tpiCount
      })
      continue
    }

    if (target.alreadySent && forceResend !== true) {
      results.push({
        personId: target.personId,
        recipientName: target.personName,
        recipientEmail: target.recipientEmail,
        deliveryStatus: 'skipped',
        skippedReason: 'already_sent',
        sentAt: target.sentAt,
        messageId: target.messageId,
        tpiCount: target.tpiCount
      })
      continue
    }

    try {
      const reservation = await reserveDelivery({
        year: context.year,
        publicationVersion: context.publicationVersion,
        target,
        forceResend
      })

      if (!reservation.reserved) {
        results.push({
          personId: target.personId,
          recipientName: target.personName,
          recipientEmail: target.recipientEmail,
          deliveryStatus: 'skipped',
          skippedReason: reservation.skippedReason,
          sentAt: reservation.delivery?.sentAt || null,
          messageId: reservation.delivery?.messageId || '',
          tpiCount: target.tpiCount
        })
        continue
      }

      const attachments = buildAttachments({
        target,
        year: context.year,
        publicationVersion: context.publicationVersion,
        globalRoomsPdf,
        generatedAtLabel
      })
      const delivery = await emailService.sendEmail(
        target.recipientEmail,
        'soutenanceSchedulePackage',
        {
          recipientName: target.personName,
          year: context.year,
          publicationVersion: context.publicationVersion,
          tpiCount: target.tpiCount,
          roomCount,
          generatedAtLabel
        },
        {
          emailSettings,
          attachments
        }
      )

      const sentAt = delivery.success ? new Date() : null
      try {
        await markDelivery({
          year: context.year,
          publicationVersion: context.publicationVersion,
          target,
          status: delivery.success ? 'sent' : 'failed',
          messageId: delivery.messageId || '',
          error: delivery.error || '',
          attachmentCount: attachments.length,
          sentAt
        })
      } catch (recordError) {
        if (delivery.success) {
          results.push({
            personId: target.personId,
            recipientName: target.personName,
            recipientEmail: target.recipientEmail,
            deliveryStatus: 'sent_unrecorded',
            messageId: delivery.messageId || '',
            error: `Email envoyé mais statut non enregistré: ${recordError?.message || 'erreur inconnue'}`,
            attachmentCount: attachments.length,
            sentAt: sentAt ? sentAt.toISOString() : null,
            tpiCount: target.tpiCount
          })
          continue
        }

        throw recordError
      }

      results.push({
        personId: target.personId,
        recipientName: target.personName,
        recipientEmail: target.recipientEmail,
        deliveryStatus: delivery.success ? 'sent' : 'failed',
        messageId: delivery.messageId || '',
        error: delivery.error || '',
        attachmentCount: attachments.length,
        sentAt: sentAt ? sentAt.toISOString() : null,
        tpiCount: target.tpiCount
      })
    } catch (error) {
      await markDelivery({
        year: context.year,
        publicationVersion: context.publicationVersion,
        target,
        status: 'failed',
        error: error?.message || 'Erreur lors de l’envoi.'
      })

      results.push({
        personId: target.personId,
        recipientName: target.personName,
        recipientEmail: target.recipientEmail,
        deliveryStatus: 'failed',
        error: error?.message || 'Erreur lors de l’envoi.',
        tpiCount: target.tpiCount
      })
    }
  }

  const summary = summarizeSendResults(results)
  const refreshedPreview = await previewFinalScheduleDelivery({
    year: context.year,
    publicationVersion: context.publicationVersion
  })

  return {
    success: summary.failedCount === 0 && summary.recordingFailedCount === 0,
    year: context.year,
    available: true,
    publicationVersion: context.publicationVersion,
    roomCount,
    tpiCount: context.events.length,
    summary,
    preview: refreshedPreview,
    results
  }
}

module.exports = {
  buildFinalScheduleContext,
  buildIcalContent,
  buildPersonalPdfBuffer,
  buildGlobalRoomsPdfBuffer,
  buildManualFinalSchedulePackage,
  collectScheduleEvents,
  previewFinalScheduleDelivery,
  sendFinalScheduleDelivery
}
