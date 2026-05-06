const crypto = require('crypto')
const mongoose = require('mongoose')

const TpiPlanning = require('../models/tpiCoordinationModel')
const Slot = require('../models/slotModel')
const Vote = require('../models/voteModel')
const {
  ResolutionProposal
} = require('../models/resolutionProposalModel')
const emailService = require('./emailService')
const coordinationConfigService = require('./coordinationConfigService')
const staticVotePublicationService = require('./staticVotePublicationService')
const {
  TPI_STAKEHOLDER_RELATIONS,
  VOTING_STAKEHOLDER_ROLES
} = require('../modules/stakeholders/stakeholderDefinitions')
const accessLinkPolicy = require('../../shared/accessLinkPolicy.json')

const DEFAULT_EXPIRY_HOURS = accessLinkPolicy.defaultSettings.voteLinkValidityHours
const RECIPIENT_ROLES = VOTING_STAKEHOLDER_ROLES
const ROLE_LABELS = Object.freeze(
  Object.fromEntries(
    TPI_STAKEHOLDER_RELATIONS.map((relation) => [
      relation.key,
      relation.displayLabel
    ])
  )
)

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function toIdString(value) {
  if (!value) {
    return ''
  }

  if (value._id) {
    return String(value._id)
  }

  return String(value)
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(compactText(value))
}

function createHttpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

async function resolveResolutionProposalExpiryHours(year, expiresInHours = null) {
  const explicitHours = Number.parseInt(String(expiresInHours || ''), 10)
  if (Number.isInteger(explicitHours) && explicitHours > 0) {
    return explicitHours
  }

  try {
    const config = await coordinationConfigService.getPlanningConfigIfAvailable(year)
    const settings = coordinationConfigService.normalizeAccessLinkSettings(config?.accessLinkSettings)
    return settings.voteLinkValidityHours
  } catch (error) {
    console.warn(
      `Impossible de charger la duree des liens d'arbitrage ${year}:`,
      error?.message || error
    )
    return DEFAULT_EXPIRY_HOURS
  }
}

function isDebugModeEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.REACT_APP_DEBUG === 'true'
}

function shouldUseDevMode(value) {
  if (value !== true) {
    return false
  }

  if (!isDebugModeEnabled()) {
    throw createHttpError(403, 'Mode DEV indisponible hors environnement debug.')
  }

  return true
}

function hashToken(token) {
  return crypto.createHash('sha256').update(compactText(token)).digest('hex')
}

function createToken() {
  return crypto.randomBytes(32).toString('hex')
}

function formatPersonName(person, fallback = '') {
  const fullName = compactText(person?.fullName)
  if (fullName) {
    return fullName
  }

  return [
    compactText(person?.firstName),
    compactText(person?.lastName)
  ].filter(Boolean).join(' ') || fallback
}

function normalizePeriodLabel(value) {
  const normalized = compactText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (normalized.includes('matin')) {
    return 'Matin'
  }

  if (normalized.includes('apres') || normalized.includes('pm')) {
    return 'Après-midi'
  }

  return compactText(value)
}

function parseTimeToMinutes(value) {
  const match = compactText(value).match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (!match) {
    return null
  }

  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2] || '0', 10)

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes < 0 || minutes >= 60) {
    return null
  }

  return (hours * 60) + minutes
}

function formatDate(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function getSlotPeriodLabel(slot) {
  const displayPeriod = normalizePeriodLabel(slot?.display?.periodLabel)
  if (displayPeriod) {
    return displayPeriod
  }

  const storedPeriod = normalizePeriodLabel(slot?.period)
  if (storedPeriod) {
    return storedPeriod
  }

  const startMinutes = parseTimeToMinutes(slot?.startTime)
  if (startMinutes === null) {
    return 'Demi-journée'
  }

  return startMinutes < (12 * 60) ? 'Matin' : 'Après-midi'
}

function getRoomName(slot) {
  return compactText(slot?.room?.name || slot?.room)
}

function getRoomSite(slot) {
  return compactText(slot?.room?.site || slot?.site)
}

function buildSlotSnapshot(slot) {
  const dateLabel = formatDate(slot?.date)
  const periodLabel = getSlotPeriodLabel(slot)
  const roomLabel = getRoomName(slot)

  return {
    label: [dateLabel, periodLabel, roomLabel].filter(Boolean).join(' · ') || 'Créneau proposé',
    date: slot?.date || null,
    period: periodLabel,
    startTime: compactText(slot?.startTime),
    endTime: compactText(slot?.endTime),
    room: roomLabel,
    site: getRoomSite(slot)
  }
}

function buildProposalUrl(baseUrl, year, token) {
  const normalizedBase = compactText(baseUrl).replace(/\/+$/, '') || 'http://localhost:3000'
  return new URL(`/arbitrage-${year}/${token}`, `${normalizedBase}/`).toString()
}

function buildStaticVoteProposalUrl(baseUrl, year, token) {
  return staticVotePublicationService.buildStaticVoteArbitrageUrl(baseUrl, year, token)
}

function normalizeRecipientRoles(value) {
  const source = Array.isArray(value) && value.length > 0 ? value : RECIPIENT_ROLES
  const normalized = []

  source.forEach((role) => {
    const text = compactText(role)
    if (RECIPIENT_ROLES.includes(text) && !normalized.includes(text)) {
      normalized.push(text)
    }
  })

  return normalized.length > 0 ? normalized : RECIPIENT_ROLES
}

function getPersonForRole(tpi, role) {
  if (role === 'chef_projet') {
    return tpi?.chefProjet || null
  }

  return tpi?.[role] || null
}

function buildRecipients(tpi, roles) {
  return roles.map((role) => {
    const person = getPersonForRole(tpi, role)

    return {
      role,
      roleLabel: ROLE_LABELS[role] || role,
      person,
      name: formatPersonName(person, ROLE_LABELS[role] || role),
      email: compactText(person?.email).toLowerCase(),
      sendEmails: person?.sendEmails !== false
    }
  })
}

function computeStatus(proposal, now = new Date()) {
  if (!proposal) {
    return 'sent'
  }

  if (proposal.status === 'cancelled' || proposal.status === 'failed') {
    return proposal.status
  }

  const expiresAt = proposal.expiresAt ? new Date(proposal.expiresAt) : null
  const recipients = Array.isArray(proposal.recipients) ? proposal.recipients : []
  const rejectedCount = recipients.filter((recipient) => recipient.responseStatus === 'rejected').length
  const acceptedCount = recipients.filter((recipient) => recipient.responseStatus === 'accepted').length
  const respondedCount = acceptedCount + rejectedCount

  if (rejectedCount > 0) {
    return 'rejected'
  }

  if (recipients.length > 0 && acceptedCount === recipients.length) {
    return 'accepted'
  }

  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt <= now) {
    return 'expired'
  }

  if (respondedCount > 0) {
    return 'partial'
  }

  return 'sent'
}

function buildCounts(proposal) {
  const recipients = Array.isArray(proposal?.recipients) ? proposal.recipients : []
  const accepted = recipients.filter((recipient) => recipient.responseStatus === 'accepted').length
  const rejected = recipients.filter((recipient) => recipient.responseStatus === 'rejected').length

  return {
    total: recipients.length,
    pending: Math.max(recipients.length - accepted - rejected, 0),
    accepted,
    rejected,
    responded: accepted + rejected
  }
}

function sanitizeRecipient(recipient) {
  return {
    role: compactText(recipient?.role),
    roleLabel: ROLE_LABELS[recipient?.role] || compactText(recipient?.role),
    personId: toIdString(recipient?.person),
    name: compactText(recipient?.name),
    email: compactText(recipient?.email),
    publicUrl: compactText(recipient?.publicUrl),
    responseStatus: compactText(recipient?.responseStatus) || 'pending',
    responseReason: compactText(recipient?.responseReason),
    alternativeProposal: compactText(recipient?.alternativeProposal),
    respondedAt: recipient?.respondedAt || null,
    deliveryStatus: compactText(recipient?.deliveryStatus) || 'pending',
    deliveryError: compactText(recipient?.deliveryError),
    sentAt: recipient?.sentAt || null
  }
}

function getTpiProposalSlotIds(tpi) {
  const slotIds = new Set()
  const confirmedSlotId = toIdString(tpi?.confirmedSlot)

  if (confirmedSlotId) {
    slotIds.add(confirmedSlotId)
  }

  for (const proposedSlot of Array.isArray(tpi?.proposedSlots) ? tpi.proposedSlots : []) {
    const slotId = toIdString(proposedSlot?.slot || proposedSlot)
    if (slotId) {
      slotIds.add(slotId)
    }
  }

  return slotIds
}

async function assertSlotCanBeProposedForTpi(tpi, slotId) {
  const normalizedSlotId = toIdString(slotId)

  if (getTpiProposalSlotIds(tpi).has(normalizedSlotId)) {
    return
  }

  const existingVote = await Vote.exists({
    tpiPlanning: tpi._id,
    slot: normalizedSlotId
  })

  if (!existingVote) {
    throw createHttpError(400, 'Ce créneau ne fait pas partie des options votées pour ce TPI.')
  }
}

function assertTpiCanReceiveResolutionProposal(tpi) {
  const status = compactText(tpi?.status)

  if (['confirmed', 'completed', 'cancelled'].includes(status)) {
    throw createHttpError(409, 'Ce TPI est déjà clôturé pour l’arbitrage.')
  }
}

function getUnavailableRecipientLabels(recipients) {
  return recipients
    .filter((recipient) => !recipient.email || !recipient.sendEmails)
    .map((recipient) => recipient.roleLabel || ROLE_LABELS[recipient.role] || recipient.role)
}

function getFailedDeliveryLabels(recipients) {
  return recipients
    .filter((recipient) => recipient.deliveryStatus === 'failed')
    .map((recipient) => recipient.name || ROLE_LABELS[recipient.role] || recipient.role)
}

function serializeProposal(proposal, options = {}) {
  if (!proposal) {
    return null
  }

  const source = typeof proposal.toObject === 'function' ? proposal.toObject() : proposal
  const status = computeStatus(source)
  const counts = buildCounts(source)

  const serialized = {
    id: toIdString(source._id),
    year: Number(source.year || 0),
    tpiId: toIdString(source.tpiPlanning),
    tpiReference: compactText(source.tpiReference),
    candidateName: compactText(source.candidateName),
    subject: compactText(source.subject),
    proposedSlotId: toIdString(source.proposedSlot),
    proposedSlot: source.proposedSlotSnapshot || {},
    proposedSlotLabel: compactText(source.proposedSlotSnapshot?.label),
    message: compactText(source.message),
    status,
    devMode: source.devMode === true,
    counts,
    recipients: options.includeRecipients === false
      ? []
      : (Array.isArray(source.recipients) ? source.recipients : []).map(sanitizeRecipient),
    createdAt: source.createdAt || null,
    sentAt: source.sentAt || null,
    expiresAt: source.expiresAt || null
  }

  if (Array.isArray(options.devLinks) && options.devLinks.length > 0) {
    serialized.devLinks = options.devLinks
  }

  return serialized
}

async function listResolutionProposalSummariesForTpis(tpiIds = []) {
  const ids = (Array.isArray(tpiIds) ? tpiIds : [])
    .map(toIdString)
    .filter(isValidObjectId)

  if (ids.length === 0) {
    return new Map()
  }

  const proposals = await ResolutionProposal.find({ tpiPlanning: { $in: ids } })
    .sort({ createdAt: -1 })

  const byTpiId = new Map()
  proposals.forEach((proposal) => {
    const serialized = serializeProposal(proposal)
    const tpiId = serialized?.tpiId

    if (!tpiId) {
      return
    }

    if (!byTpiId.has(tpiId)) {
      byTpiId.set(tpiId, [])
    }

    byTpiId.get(tpiId).push(serialized)
  })

  return byTpiId
}

async function createResolutionProposal({
  tpiId,
  slotId,
  message = '',
  recipientRoles = [],
  baseUrl = '',
  linkTarget = 'app',
  createdBy = null,
  emailSettings = null,
  expiresInHours = null,
  devMode = false
}) {
  if (!isValidObjectId(tpiId)) {
    throw createHttpError(400, 'Identifiant TPI invalide.')
  }

  if (!isValidObjectId(slotId)) {
    throw createHttpError(400, 'Identifiant créneau invalide.')
  }

  const useDevMode = shouldUseDevMode(devMode)
  const [tpi, slot] = await Promise.all([
    TpiPlanning.findById(tpiId)
      .populate('candidat expert1 expert2 chefProjet', 'firstName lastName email sendEmails')
      .populate('proposedSlots.slot confirmedSlot', 'date period startTime endTime room status'),
    Slot.findById(slotId)
  ])

  if (!tpi) {
    throw createHttpError(404, 'TPI introuvable.')
  }

  if (!slot) {
    throw createHttpError(404, 'Créneau proposé introuvable.')
  }

  assertTpiCanReceiveResolutionProposal(tpi)
  await assertSlotCanBeProposedForTpi(tpi, slot._id)

  const roles = normalizeRecipientRoles(recipientRoles)
  const recipientDrafts = buildRecipients(tpi, roles)
  const unavailableRecipients = getUnavailableRecipientLabels(recipientDrafts)

  if (!useDevMode && unavailableRecipients.length > 0) {
    throw createHttpError(
      400,
      `Destinataire(s) sans email actif: ${unavailableRecipients.join(', ')}.`
    )
  }

  const safeHours = await resolveResolutionProposalExpiryHours(tpi.year, expiresInHours)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + safeHours * 60 * 60 * 1000)
  const slotSnapshot = buildSlotSnapshot(slot)
  const normalizedMessage = compactText(message).slice(0, 2000)
  const useStaticVoteLink = linkTarget === 'staticVote'
  recipientDrafts.forEach((recipient) => {
    const tokenPayload = {
      year: tpi.year,
      nonce: createToken(),
      tpiId: toIdString(tpi._id),
      tpiReference: compactText(tpi.reference),
      candidateName: formatPersonName(tpi.candidat, 'Candidat non renseigné'),
      subject: compactText(tpi.sujet),
      proposedSlotId: toIdString(slot._id),
      proposedSlotLabel: slotSnapshot.label,
      proposedSlot: slotSnapshot,
      message: normalizedMessage,
      role: recipient.role,
      roleLabel: recipient.roleLabel,
      personId: toIdString(recipient.person),
      recipientName: recipient.name,
      recipientEmail: recipient.email,
      expiresAt: expiresAt.toISOString()
    }
    recipient.token = useStaticVoteLink
      ? staticVotePublicationService.createStaticVoteArbitrageToken(tokenPayload)
      : createToken()
    recipient.tokenHash = hashToken(recipient.token)
    recipient.publicUrl = useStaticVoteLink
      ? buildStaticVoteProposalUrl(baseUrl, tpi.year, recipient.token)
      : buildProposalUrl(baseUrl, tpi.year, recipient.token)
  })

  const proposal = await ResolutionProposal.create({
    year: tpi.year,
    tpiPlanning: tpi._id,
    tpiReference: compactText(tpi.reference),
    candidateName: formatPersonName(tpi.candidat, 'Candidat non renseigné'),
    subject: compactText(tpi.sujet),
    proposedSlot: slot._id,
    proposedSlotSnapshot: slotSnapshot,
    message: normalizedMessage,
    status: 'sent',
    devMode: useDevMode,
    recipients: recipientDrafts.map((recipient) => ({
      role: recipient.role,
      person: recipient.person?._id || null,
      name: recipient.name,
      email: recipient.email,
      tokenHash: recipient.tokenHash,
      publicUrl: recipient.publicUrl,
      deliveryStatus: useDevMode
        ? 'skipped'
        : recipient.email && recipient.sendEmails ? 'pending' : 'skipped',
      deliveryError: useDevMode ? 'Mode DEV: email non envoyé.' : ''
    })),
    createdBy: isValidObjectId(createdBy) ? createdBy : null,
    sentAt: now,
    expiresAt
  })

  const devLinks = []
  for (let index = 0; index < proposal.recipients.length; index += 1) {
    const recipient = proposal.recipients[index]
    const draft = recipientDrafts[index]
    const url = compactText(recipient.publicUrl) || buildProposalUrl(baseUrl, tpi.year, draft.token)

    if (useDevMode) {
      recipient.deliveryStatus = 'skipped'
      recipient.deliveryError = 'Mode DEV: email non envoyé.'
      devLinks.push({
        role: draft.role,
        roleLabel: draft.roleLabel,
        name: draft.name,
        email: draft.email,
        url
      })
      continue
    }

    if (!draft?.email || !draft.sendEmails) {
      recipient.deliveryStatus = 'skipped'
      continue
    }

    const result = await emailService.sendEmail(draft.email, 'resolutionProposal', {
      recipientName: draft.name,
      roleLabel: draft.roleLabel,
      year: tpi.year,
      candidateName: proposal.candidateName,
      tpiReference: proposal.tpiReference,
      tpiSubject: proposal.subject,
      proposedSlotLabel: slotSnapshot.label,
      adminMessage: proposal.message,
      magicLinkUrl: url,
      deadline: formatDate(expiresAt)
    }, { emailSettings, expiresInHours: safeHours })

    recipient.deliveryStatus = result?.success ? 'sent' : 'failed'
    recipient.deliveryError = result?.success ? '' : compactText(result?.error || 'Envoi impossible.')
    recipient.sentAt = result?.success ? new Date() : null
  }

  const failedDeliveries = getFailedDeliveryLabels(proposal.recipients)
  if (failedDeliveries.length > 0) {
    proposal.status = 'failed'
    await proposal.save()
    throw createHttpError(
      502,
      `Envoi impossible pour: ${failedDeliveries.join(', ')}.`
    )
  }

  proposal.status = computeStatus(proposal)
  await proposal.save()

  return serializeProposal(proposal, {
    devLinks: useDevMode ? devLinks : []
  })
}

async function findProposalByToken(token) {
  const tokenHash = hashToken(token)
  const proposal = await ResolutionProposal.findOne({ 'recipients.tokenHash': tokenHash })

  if (!proposal) {
    throw createHttpError(404, 'Lien de proposition introuvable.')
  }

  const recipientIndex = (Array.isArray(proposal.recipients) ? proposal.recipients : [])
    .findIndex((recipient) => recipient.tokenHash === tokenHash)

  if (recipientIndex < 0) {
    throw createHttpError(404, 'Lien de proposition introuvable.')
  }

  return {
    proposal,
    recipient: proposal.recipients[recipientIndex],
    recipientIndex
  }
}

async function getPublicResolutionProposal(token) {
  const { proposal, recipient } = await findProposalByToken(token)
  const status = computeStatus(proposal)

  if (status === 'expired') {
    proposal.status = 'expired'
    await proposal.save()
    throw createHttpError(410, 'Cette proposition est expirée.')
  }

  if (status === 'cancelled' || status === 'failed') {
    throw createHttpError(410, 'Cette proposition n’est plus active.')
  }

  const serialized = serializeProposal(proposal)

  return {
    ...serialized,
    recipient: sanitizeRecipient(recipient),
    recipients: []
  }
}

async function respondToResolutionProposal(token, payload = {}) {
  const { proposal, recipient } = await findProposalByToken(token)
  const status = computeStatus(proposal)

  if (status === 'expired') {
    proposal.status = 'expired'
    await proposal.save()
    throw createHttpError(410, 'Cette proposition est expirée.')
  }

  if (status === 'cancelled' || status === 'failed') {
    throw createHttpError(410, 'Cette proposition n’est plus active.')
  }

  const decision = compactText(payload.decision).toLowerCase()
  if (!['accepted', 'rejected'].includes(decision)) {
    throw createHttpError(400, 'Réponse invalide.')
  }

  const currentResponseStatus = compactText(recipient.responseStatus)
  if (['accepted', 'rejected'].includes(currentResponseStatus)) {
    if (currentResponseStatus === decision) {
      return {
        ...serializeProposal(proposal),
        recipient: sanitizeRecipient(recipient),
        recipients: []
      }
    }

    throw createHttpError(409, 'Réponse déjà enregistrée.')
  }

  const reason = compactText(payload.reason).slice(0, 2000)
  const alternativeProposal = compactText(payload.alternativeProposal).slice(0, 2000)

  if (decision === 'rejected' && !reason) {
    throw createHttpError(400, 'Une raison est requise en cas de refus.')
  }

  recipient.responseStatus = decision
  recipient.responseReason = decision === 'rejected' ? reason : ''
  recipient.alternativeProposal = decision === 'rejected' ? alternativeProposal : ''
  recipient.respondedAt = new Date()
  proposal.status = computeStatus(proposal)
  await proposal.save()

  return {
    ...serializeProposal(proposal),
    recipient: sanitizeRecipient(recipient),
    recipients: []
  }
}

module.exports = {
  DEFAULT_EXPIRY_HOURS,
  ROLE_LABELS,
  buildProposalUrl,
  buildSlotSnapshot,
  computeStatus,
  createResolutionProposal,
  getPublicResolutionProposal,
  hashToken,
  listResolutionProposalSummariesForTpis,
  resolveResolutionProposalExpiryHours,
  respondToResolutionProposal,
  serializeProposal
}
