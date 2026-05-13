const Person = require('../models/personModel')
const PublicationVersion = require('../models/publicationVersionModel')
const { PublicationChangeNotification } = require('../models/publicationChangeNotificationModel')
const accessLinkTokenService = require('../modules/accessLinks/tokenService')
const emailService = require('./emailService')
const { getSharedEmailSettingsIfAvailable } = require('./coordinationCatalogService')
const { buildDefensePublicPath } = require('../utils/publicRoutes')
const {
  getSoutenanceAccessLinkSource
} = require('../modules/accessLinks/constants')
const {
  formatTpiStakeholderRoleLabel
} = require('../modules/stakeholders/stakeholderDefinitions')

const DEFENSE_ROLES = Object.freeze([
  {
    key: 'candidat',
    getPersonId: (entry) => entry?.candidatPersonId,
    getName: (entry) => entry?.candidat
  },
  {
    key: 'expert1',
    getPersonId: (entry) => entry?.expert1?.personId,
    getName: (entry) => entry?.expert1?.name
  },
  {
    key: 'expert2',
    getPersonId: (entry) => entry?.expert2?.personId,
    getName: (entry) => entry?.expert2?.name
  },
  {
    key: 'chef_projet',
    getPersonId: (entry) => entry?.boss?.personId,
    getName: (entry) => entry?.boss?.name
  }
])

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function normalizeTextToken(value) {
  return compactText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function normalizeReference(value) {
  return normalizeTextToken(value)
    .replace(/^tpi-\d{4}-/i, '')
    .replace(/^0+(?=\d)/, '')
}

function normalizeDateKey(value) {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10)
  }

  const rawValue = compactText(value)
  const match = rawValue.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : rawValue
}

function formatDateLabel(value) {
  const dateKey = normalizeDateKey(value)
  if (!dateKey) {
    return ''
  }

  const date = new Date(`${dateKey}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    return dateKey
  }

  return date.toLocaleDateString('fr-CH', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function getDefenseRoomName(room = {}) {
  return compactText(room.name || room.nameRoom || room.room)
}

function getDefensePeriod(entry = {}) {
  const period = Number.parseInt(String(entry.period || ''), 10)
  return Number.isInteger(period) && period > 0 ? period : null
}

function getDefenseTimeRange(entry = {}) {
  const startTime = compactText(entry.startTime)
  const endTime = compactText(entry.endTime)

  if (startTime && endTime) {
    return `${startTime} - ${endTime}`
  }

  return ''
}

function getPersonKey(person = {}) {
  const personId = compactText(person.personId)
  if (personId) {
    return `id:${personId}`
  }

  const name = normalizeTextToken(person.name)
  return name ? `name:${name}` : ''
}

function buildDefenseStakeholders(tpiData = {}) {
  return DEFENSE_ROLES.reduce((acc, role) => {
    acc[role.key] = {
      role: role.key,
      roleLabel: formatTpiStakeholderRoleLabel(role.key),
      personId: compactText(role.getPersonId(tpiData)),
      name: compactText(role.getName(tpiData))
    }
    return acc
  }, {})
}

function hasRealDefenseData(tpiData = {}) {
  return Boolean(
    compactText(tpiData.refTpi) ||
    compactText(tpiData.candidat) ||
    compactText(tpiData.expert1?.name) ||
    compactText(tpiData.expert2?.name) ||
    compactText(tpiData.boss?.name)
  )
}

function buildDefenseEntry(room = {}, tpiData = {}, fallbackIndex = 0) {
  if (!hasRealDefenseData(tpiData)) {
    return null
  }

  const reference = compactText(tpiData.refTpi)
  const legacyId = compactText(tpiData.id)
  const key = normalizeReference(reference) || `legacy:${legacyId || fallbackIndex}`
  const date = normalizeDateKey(room.date)
  const period = getDefensePeriod(tpiData)
  const timeRange = getDefenseTimeRange(tpiData)
  const site = compactText(room.site)
  const roomName = getDefenseRoomName(room)
  const stakeholders = buildDefenseStakeholders(tpiData)

  return {
    key,
    legacyId,
    reference: reference || legacyId || key,
    date,
    dateLabel: formatDateLabel(date),
    site,
    room: roomName,
    period,
    startTime: compactText(tpiData.startTime),
    endTime: compactText(tpiData.endTime),
    timeRange,
    slotKey: [date, period || '', timeRange].join('|'),
    candidateName: stakeholders.candidat.name,
    stakeholders
  }
}

function indexPublicationDefenses(rooms = []) {
  const defensesByKey = new Map()

  for (const room of Array.isArray(rooms) ? rooms : []) {
    const tpiDatas = Array.isArray(room?.tpiDatas) ? room.tpiDatas : []

    tpiDatas.forEach((tpiData, index) => {
      const entry = buildDefenseEntry(room, tpiData, index)
      if (!entry) {
        return
      }

      defensesByKey.set(entry.key, entry)
    })
  }

  return defensesByKey
}

function formatDefenseLocation(entry = {}) {
  return [
    entry.dateLabel || entry.date,
    entry.timeRange || (entry.period ? `Période ${entry.period}` : ''),
    entry.site,
    entry.room
  ].filter(Boolean).join(' · ')
}

function getRoleChangeFields(previous = {}, current = {}) {
  return DEFENSE_ROLES
    .filter((role) => {
      const previousStakeholder = previous.stakeholders?.[role.key] || {}
      const currentStakeholder = current.stakeholders?.[role.key] || {}
      return getPersonKey(previousStakeholder) !== getPersonKey(currentStakeholder)
    })
    .map((role) => ({
      key: role.key,
      label: formatTpiStakeholderRoleLabel(role.key),
      previous: previous.stakeholders?.[role.key] || null,
      current: current.stakeholders?.[role.key] || null
    }))
}

function getChangedFieldLabels(previous = {}, current = {}) {
  const labels = []

  if (previous.date !== current.date) {
    labels.push('date')
  }

  if (previous.slotKey !== current.slotKey) {
    labels.push('horaire')
  }

  if (previous.site !== current.site) {
    labels.push('site')
  }

  if (previous.room !== current.room) {
    labels.push('salle')
  }

  for (const roleChange of getRoleChangeFields(previous, current)) {
    labels.push(roleChange.label)
  }

  return Array.from(new Set(labels))
}

function listDefenseStakeholders(entry = {}) {
  if (!entry || typeof entry !== 'object') {
    return []
  }

  return DEFENSE_ROLES
    .map((role) => entry.stakeholders?.[role.key])
    .filter((person) => person && (person.personId || person.name))
}

function mergeImpactedStakeholders(...entries) {
  const stakeholdersByKey = new Map()

  for (const entry of entries) {
    for (const stakeholder of listDefenseStakeholders(entry)) {
      const key = stakeholder.personId || getPersonKey(stakeholder)
      if (!key) {
        continue
      }

      stakeholdersByKey.set(key, stakeholder)
    }
  }

  return Array.from(stakeholdersByKey.values())
}

function buildDefenseChange({ kind, previous = null, current = null }) {
  const source = current || previous || {}
  const changedFieldLabels = kind === 'updated'
    ? getChangedFieldLabels(previous, current)
    : []

  return {
    key: source.key,
    kind,
    reference: source.reference || '',
    candidateName: source.candidateName || '',
    previous: previous
      ? {
          date: previous.date,
          dateLabel: previous.dateLabel,
          site: previous.site,
          room: previous.room,
          period: previous.period,
          timeRange: previous.timeRange,
          locationLabel: formatDefenseLocation(previous)
        }
      : null,
    current: current
      ? {
          date: current.date,
          dateLabel: current.dateLabel,
          site: current.site,
          room: current.room,
          period: current.period,
          timeRange: current.timeRange,
          locationLabel: formatDefenseLocation(current)
        }
      : null,
    changedFields: changedFieldLabels,
    reasonLabels: kind === 'added'
      ? ['défense ajoutée']
      : kind === 'removed'
        ? ['défense retirée']
        : changedFieldLabels,
    impactedStakeholders: mergeImpactedStakeholders(previous, current)
  }
}

function hasDefenseChanged(previous, current) {
  return getChangedFieldLabels(previous, current).length > 0
}

function diffPublicationDefenses(previousRooms = [], currentRooms = []) {
  const previousIndex = indexPublicationDefenses(previousRooms)
  const currentIndex = indexPublicationDefenses(currentRooms)
  const keys = Array.from(new Set([
    ...previousIndex.keys(),
    ...currentIndex.keys()
  ])).sort((left, right) => left.localeCompare(right, 'fr'))
  const changes = []

  for (const key of keys) {
    const previous = previousIndex.get(key) || null
    const current = currentIndex.get(key) || null

    if (!previous && current) {
      changes.push(buildDefenseChange({ kind: 'added', current }))
      continue
    }

    if (previous && !current) {
      changes.push(buildDefenseChange({ kind: 'removed', previous }))
      continue
    }

    if (previous && current && hasDefenseChanged(previous, current)) {
      changes.push(buildDefenseChange({ kind: 'updated', previous, current }))
    }
  }

  return changes
}

function normalizePublicationVersionNumber(value) {
  const version = Number.parseInt(String(value || ''), 10)
  return Number.isInteger(version) && version > 0 ? version : null
}

async function loadPublicationPair(year, requestedCurrentVersion = null) {
  const normalizedYear = Number.parseInt(String(year), 10)
  const normalizedCurrentVersion = normalizePublicationVersionNumber(requestedCurrentVersion)
  const currentPublication = normalizedCurrentVersion
    ? await PublicationVersion.findOne({
      year: normalizedYear,
      version: normalizedCurrentVersion
    }).lean()
    : await PublicationVersion.findOne({
      year: normalizedYear,
      isActive: true
    }).sort({ version: -1 }).lean()

  if (!currentPublication) {
    return {
      currentPublication: null,
      previousPublication: null
    }
  }

  const previousPublication = await PublicationVersion.findOne({
    year: normalizedYear,
    version: { $lt: currentPublication.version }
  }).sort({ version: -1 }).lean()

  return {
    currentPublication,
    previousPublication
  }
}

function addRecipientChange(recipientsByPersonId, stakeholder, change) {
  const personId = compactText(stakeholder?.personId)
  if (!personId) {
    return
  }

  if (!recipientsByPersonId.has(personId)) {
    recipientsByPersonId.set(personId, {
      personId,
      fallbackName: compactText(stakeholder.name),
      roles: new Set(),
      changesByKey: new Map()
    })
  }

  const recipient = recipientsByPersonId.get(personId)
  if (stakeholder.role) {
    recipient.roles.add(stakeholder.role)
  }

  const changeKey = `${change.kind}:${change.key}`
  if (!recipient.changesByKey.has(changeKey)) {
    recipient.changesByKey.set(changeKey, {
      key: change.key,
      kind: change.kind,
      reference: change.reference,
      candidateName: change.candidateName,
      reasonLabels: change.reasonLabels,
      previousLocationLabel: change.previous?.locationLabel || '',
      currentLocationLabel: change.current?.locationLabel || ''
    })
  }
}

function buildImpactedRecipientEntries(changes = []) {
  const recipientsByPersonId = new Map()
  const missingStakeholders = []

  for (const change of Array.isArray(changes) ? changes : []) {
    for (const stakeholder of Array.isArray(change.impactedStakeholders) ? change.impactedStakeholders : []) {
      if (!stakeholder.personId) {
        missingStakeholders.push({
          name: compactText(stakeholder.name),
          role: stakeholder.role,
          roleLabel: stakeholder.roleLabel,
          reference: change.reference
        })
        continue
      }

      addRecipientChange(recipientsByPersonId, stakeholder, change)
    }
  }

  return {
    recipients: Array.from(recipientsByPersonId.values()).map((recipient) => ({
      personId: recipient.personId,
      fallbackName: recipient.fallbackName,
      roles: Array.from(recipient.roles),
      changes: Array.from(recipient.changesByKey.values())
    })),
    missingStakeholders
  }
}

function formatPersonName(person = {}, fallback = '') {
  return compactText(
    person.fullName ||
    [person.firstName, person.lastName].filter(Boolean).join(' ')
  ) || fallback
}

function canReceiveDefenseChangeEmail(person = {}) {
  return Boolean(person?._id && person?.email) && person.sendEmails !== false
}

function getDeliveryStatusFromNotification(notification = null) {
  if (notification?.status === 'sent') {
    return 'sent'
  }

  if (notification?.status === 'failed') {
    return 'failed'
  }

  return 'pending'
}

async function loadNotificationRecordsByPersonId({ year, publicationVersion }) {
  const records = await PublicationChangeNotification.find({
    year,
    publicationVersion: publicationVersion || null
  })
    .select('personId status sentAt error messageId updatedAt createdAt')
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean()
  const recordsByPersonId = new Map()

  for (const record of Array.isArray(records) ? records : []) {
    const personId = compactText(record?.personId)
    if (!personId) {
      continue
    }

    if (!recordsByPersonId.has(personId)) {
      recordsByPersonId.set(personId, record)
    }
  }

  return recordsByPersonId
}

async function attachRecipientPeople({
  year,
  publicationVersion,
  recipients
}) {
  const personIds = Array.from(new Set(
    (Array.isArray(recipients) ? recipients : [])
      .map((recipient) => recipient.personId)
      .filter(Boolean)
  ))

  if (personIds.length === 0) {
    return []
  }

  const [people, notificationRecordsByPersonId] = await Promise.all([
    Person.find({
      _id: { $in: personIds },
      isActive: true
    })
      .select('firstName lastName email roles sendEmails')
      .lean(),
    loadNotificationRecordsByPersonId({
      year,
      publicationVersion
    })
  ])
  const peopleById = new Map(
    (Array.isArray(people) ? people : [])
      .filter((person) => person?._id)
      .map((person) => [String(person._id), person])
  )

  return recipients.map((recipient) => {
    const person = peopleById.get(recipient.personId) || null
    const notificationRecord = notificationRecordsByPersonId.get(recipient.personId) || null
    const deliveryStatus = getDeliveryStatusFromNotification(notificationRecord)

    return {
      ...recipient,
      person: person
        ? {
            id: String(person._id),
            firstName: compactText(person.firstName),
            lastName: compactText(person.lastName),
            name: formatPersonName(person, recipient.fallbackName),
            email: compactText(person.email),
            roles: Array.isArray(person.roles) ? person.roles : [],
            sendEmails: person.sendEmails !== false
          }
        : null,
      canSendEmail: canReceiveDefenseChangeEmail(person),
      notificationStatus: deliveryStatus,
      notificationSentAt: notificationRecord?.sentAt || null,
      notificationError: notificationRecord?.error || ''
    }
  })
}

async function markDefenseChangeNotificationDelivery({
  year,
  publicationVersion,
  previousPublicationVersion = null,
  recipient,
  status,
  messageId = '',
  error = '',
  sentAt = new Date(),
  linkTarget = 'app'
}) {
  const normalizedStatus = status === 'sent' ? 'sent' : 'failed'
  const now = new Date()
  const parsedSentAt = sentAt instanceof Date ? sentAt : new Date(sentAt || Date.now())

  return await PublicationChangeNotification.findOneAndUpdate(
    {
      year,
      publicationVersion,
      personId: recipient.personId
    },
    {
      $set: {
        previousPublicationVersion: previousPublicationVersion || null,
        recipientEmail: recipient.person?.email || '',
        recipientName: recipient.person?.name || recipient.fallbackName || '',
        status: normalizedStatus,
        sentAt: normalizedStatus === 'sent' && !Number.isNaN(parsedSentAt.getTime())
          ? parsedSentAt
          : null,
        messageId: compactText(messageId),
        error: compactText(error).slice(0, 1000),
        changeKeys: (Array.isArray(recipient.changes) ? recipient.changes : [])
          .map((change) => compactText(change.key))
          .filter(Boolean),
        linkTarget: linkTarget === 'publication' ? 'publication' : 'app',
        updatedAt: now
      },
      $setOnInsert: {
        createdAt: now
      }
    },
    {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true
    }
  )
}

function buildEmptyPreview({
  year,
  currentPublication = null,
  previousPublication = null,
  reason = ''
}) {
  return {
    year,
    currentVersion: currentPublication?.version || null,
    previousVersion: previousPublication?.version || null,
    hasCurrentPublication: Boolean(currentPublication),
    hasPreviousPublication: Boolean(previousPublication),
    shouldNotify: false,
    reason,
    summary: {
      changedDefenseCount: 0,
      changeCount: 0,
      impactedRecipientCount: 0,
      emailableRecipientCount: 0,
      pendingRecipientCount: 0,
      sentRecipientCount: 0,
      failedRecipientCount: 0,
      missingStakeholderCount: 0
    },
    changes: [],
    recipients: [],
    missingStakeholders: []
  }
}

function summarizeRecipients(recipients = []) {
  const emailableRecipients = recipients.filter((recipient) => recipient.canSendEmail)
  const pendingRecipients = emailableRecipients.filter((recipient) => recipient.notificationStatus !== 'sent')
  const sentRecipients = emailableRecipients.filter((recipient) => recipient.notificationStatus === 'sent')
  const failedRecipients = emailableRecipients.filter((recipient) => recipient.notificationStatus === 'failed')

  return {
    impactedRecipientCount: recipients.length,
    emailableRecipientCount: emailableRecipients.length,
    pendingRecipientCount: pendingRecipients.length,
    sentRecipientCount: sentRecipients.length,
    failedRecipientCount: failedRecipients.length
  }
}

async function previewDefenseChangeNotifications({
  year,
  publicationVersion = null
}) {
  const normalizedYear = Number.parseInt(String(year), 10)
  const {
    currentPublication,
    previousPublication
  } = await loadPublicationPair(normalizedYear, publicationVersion)

  if (!currentPublication) {
    return buildEmptyPreview({
      year: normalizedYear,
      reason: 'missing_current_publication'
    })
  }

  if (!previousPublication) {
    return buildEmptyPreview({
      year: normalizedYear,
      currentPublication,
      reason: 'missing_previous_publication'
    })
  }

  const changes = diffPublicationDefenses(
    previousPublication.rooms,
    currentPublication.rooms
  )
  const {
    recipients,
    missingStakeholders
  } = buildImpactedRecipientEntries(changes)
  const hydratedRecipients = await attachRecipientPeople({
    year: normalizedYear,
    publicationVersion: currentPublication.version,
    recipients
  })
  const recipientSummary = summarizeRecipients(hydratedRecipients)
  const changedDefenseCount = new Set(changes.map((change) => change.key)).size

  return {
    year: normalizedYear,
    currentVersion: currentPublication.version,
    previousVersion: previousPublication.version,
    hasCurrentPublication: true,
    hasPreviousPublication: true,
    shouldNotify: recipientSummary.pendingRecipientCount > 0,
    reason: changes.length > 0 ? 'changes_detected' : 'no_changes',
    summary: {
      changedDefenseCount,
      changeCount: changes.length,
      ...recipientSummary,
      missingStakeholderCount: missingStakeholders.length
    },
    changes,
    recipients: hydratedRecipients,
    missingStakeholders
  }
}

function buildNotificationScope(publicationVersion, source) {
  return {
    kind: 'published_soutenances',
    publicationVersion: publicationVersion || null,
    source
  }
}

async function resolveDefenseChangeMagicLink({
  year,
  person,
  publicationVersion,
  baseUrl,
  redirectPath,
  linkTarget
}) {
  const source = getSoutenanceAccessLinkSource(linkTarget)
  const scope = {
    publicationVersion: publicationVersion || null
  }
  const existingLink = await accessLinkTokenService.findReusableMagicLink({
    year,
    type: 'soutenance',
    person,
    scope,
    sources: [source],
    baseUrl
  })

  if (existingLink?.url) {
    return existingLink
  }

  if (linkTarget === 'publication') {
    return {
      id: '',
      url: '',
      expiresAt: null,
      error: 'Lien personnel de publication absent. Regénérez puis republiez le site statique avant l’envoi.'
    }
  }

  return await accessLinkTokenService.createSoutenanceMagicLink({
    year,
    person,
    scope: buildNotificationScope(publicationVersion, source),
    baseUrl,
    redirectPath: redirectPath || buildDefensePublicPath(year),
    persistToken: true
  })
}

function formatEmailDeadline(value) {
  const date = value ? new Date(value) : null
  if (date && !Number.isNaN(date.getTime())) {
    return date.toLocaleDateString('fr-CH')
  }

  return 'selon la configuration active'
}

function toEmailChange(change = {}) {
  return {
    reference: change.reference,
    candidateName: change.candidateName,
    reasonLabels: change.reasonLabels,
    previousLocationLabel: change.previousLocationLabel,
    currentLocationLabel: change.currentLocationLabel
  }
}

async function sendDefenseChangeNotifications({
  year,
  publicationVersion = null,
  baseUrl,
  redirectPath = null,
  linkTarget = 'app',
  forceResend = false
}) {
  const normalizedYear = Number.parseInt(String(year), 10)
  const preview = await previewDefenseChangeNotifications({
    year: normalizedYear,
    publicationVersion
  })
  const currentVersion = preview.currentVersion
  const emailSettings = await getSharedEmailSettingsIfAvailable()
  const results = []

  if (!preview.shouldNotify && forceResend !== true) {
    return {
      success: true,
      year: normalizedYear,
      preview,
      summary: {
        requestedCount: 0,
        sentCount: 0,
        skippedCount: 0,
        failedCount: 0
      },
      results
    }
  }

  for (const recipient of preview.recipients) {
    if (!recipient.canSendEmail || !recipient.person?.email) {
      results.push({
        personId: recipient.personId,
        recipientName: recipient.person?.name || recipient.fallbackName,
        recipientEmail: recipient.person?.email || '',
        deliveryStatus: 'skipped',
        error: 'Adresse email indisponible ou envoi désactivé.'
      })
      continue
    }

    if (recipient.notificationStatus === 'sent' && forceResend !== true) {
      results.push({
        personId: recipient.personId,
        recipientName: recipient.person.name,
        recipientEmail: recipient.person.email,
        deliveryStatus: 'skipped',
        sentAt: recipient.notificationSentAt,
        error: 'Notification déjà envoyée.'
      })
      continue
    }

    try {
      const person = {
        _id: recipient.person.id,
        firstName: recipient.person.firstName || recipient.person.name,
        lastName: recipient.person.lastName || '',
        email: recipient.person.email,
        roles: recipient.person.roles,
        sendEmails: recipient.person.sendEmails
      }
      const link = await resolveDefenseChangeMagicLink({
        year: normalizedYear,
        person,
        publicationVersion: currentVersion,
        baseUrl,
        redirectPath,
        linkTarget
      })

      if (!link?.url) {
        const linkError = compactText(link?.error) || 'Lien personnel indisponible.'
        await markDefenseChangeNotificationDelivery({
          year: normalizedYear,
          publicationVersion: currentVersion,
          previousPublicationVersion: preview.previousVersion,
          recipient,
          status: 'failed',
          error: linkError,
          linkTarget
        })

        results.push({
          personId: recipient.personId,
          recipientName: recipient.person.name,
          recipientEmail: recipient.person.email,
          deliveryStatus: 'failed',
          error: linkError
        })
        continue
      }

      const sentAt = new Date()
      const delivery = await emailService.sendEmail(recipient.person.email, 'defenseChangeNotification', {
        recipientName: recipient.person.name,
        recipientRoles: recipient.roles,
        year: normalizedYear,
        publicationVersion: currentVersion,
        previousPublicationVersion: preview.previousVersion,
        magicLinkUrl: link.url,
        deadline: formatEmailDeadline(link.expiresAt),
        changes: recipient.changes.map(toEmailChange)
      }, { emailSettings })

      await markDefenseChangeNotificationDelivery({
        year: normalizedYear,
        publicationVersion: currentVersion,
        previousPublicationVersion: preview.previousVersion,
        recipient,
        status: delivery.success ? 'sent' : 'failed',
        messageId: delivery.messageId || '',
        error: delivery.error || '',
        sentAt,
        linkTarget
      })

      results.push({
        personId: recipient.personId,
        recipientName: recipient.person.name,
        recipientEmail: recipient.person.email,
        deliveryStatus: delivery.success ? 'sent' : 'failed',
        sentAt: delivery.success ? sentAt.toISOString() : null,
        messageId: delivery.messageId || '',
        error: delivery.error || '',
        changeCount: recipient.changes.length
      })
    } catch (error) {
      results.push({
        personId: recipient.personId,
        recipientName: recipient.person.name,
        recipientEmail: recipient.person.email,
        deliveryStatus: 'failed',
        error: error?.message || 'Erreur lors de l’envoi.'
      })
    }
  }

  const sentCount = results.filter((entry) => entry.deliveryStatus === 'sent').length
  const skippedCount = results.filter((entry) => entry.deliveryStatus === 'skipped').length
  const failedCount = results.filter((entry) => entry.deliveryStatus === 'failed').length
  const refreshedPreview = await previewDefenseChangeNotifications({
    year: normalizedYear,
    publicationVersion: currentVersion
  })

  return {
    success: failedCount === 0,
    year: normalizedYear,
    preview: refreshedPreview,
    summary: {
      requestedCount: results.length,
      sentCount,
      skippedCount,
      failedCount
    },
    results
  }
}

module.exports = {
  buildImpactedRecipientEntries,
  diffPublicationDefenses,
  indexPublicationDefenses,
  previewDefenseChangeNotifications,
  sendDefenseChangeNotifications
}
