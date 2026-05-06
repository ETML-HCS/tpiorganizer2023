const TpiPlanning = require('../models/tpiCoordinationModel')
const Vote = require('../models/voteModel')
const Person = require('../models/personModel')
const emailService = require('./emailService')
const accessLinkTokenService = require('../modules/accessLinks/tokenService')
const { getSharedEmailSettingsIfAvailable } = require('./coordinationCatalogService')
const {
  getActivePublicationVersion,
  getPublicationVersion
} = require('./publishedSoutenanceService')
const {
  getPlanningConfigIfAvailable,
  normalizeWorkflowSettings
} = require('./coordinationConfigService')
const schedulingService = require('./schedulingService')
const staticVotePublicationService = require('./staticVotePublicationService')
const { filterPlanifiableTpis } = require('./coordinationTpiVisibility')
const { buildDefensePublicPath } = require('../utils/publicRoutes')
const {
  normalizeVoteLinkTarget,
  normalizeSoutenanceLinkTarget,
  getVoteGeneratedAccessLinkSources,
  getSoutenanceAccessLinkSource,
  getSoutenanceGeneratedAccessLinkSources
} = require('../modules/accessLinks/constants')
const {
  COORDINATION_PROPOSAL_READY_STATUSES,
  COORDINATION_VOTE_STATUSES
} = require('../modules/coordination/status')
const {
  VOTING_STAKEHOLDER_ROLES,
  formatTpiStakeholderRoleLabel
} = require('../modules/stakeholders/stakeholderDefinitions')

const DAY_IN_MS = 24 * 60 * 60 * 1000
const HOUR_IN_MS = 60 * 60 * 1000
const AUTOMATIC_EMAIL_SENDS_ENABLED = false
const AUTOMATIC_EMAIL_SENDS_DISABLED_REASON = 'automatic_email_sends_disabled'

function shouldSkipAutomaticEmailSends(options = {}) {
  return options?.skipEmails === true || AUTOMATIC_EMAIL_SENDS_ENABLED !== true
}

function getAutomaticEmailSkipReason(options = {}) {
  if (AUTOMATIC_EMAIL_SENDS_ENABLED !== true) {
    return AUTOMATIC_EMAIL_SENDS_DISABLED_REASON
  }

  return options?.skipEmails === true ? 'requested' : null
}

function getDisplayName(person) {
  if (!person) {
    return ''
  }

  if (typeof person.fullName === 'string' && person.fullName.trim().length > 0) {
    return person.fullName
  }

  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim()
}

function canReceiveAutomaticEmail(person) {
  return Boolean(person?.email) && person?.sendEmails !== false
}

function buildSlotsPayloadFromProposedSlots(proposedSlots) {
  const entries = []

  for (const proposedSlot of proposedSlots || []) {
    const slot = proposedSlot.slot
    if (!slot) {
      continue
    }

    entries.push({
      date: slot.date ? new Date(slot.date).toLocaleDateString('fr-CH') : '',
      period: slot.period,
      startTime: slot.startTime || '',
      endTime: slot.endTime || '',
      room: slot.room?.name || ''
    })
  }

  return entries
}

function buildSlotsPayloadFromVotes(votes) {
  const seen = new Set()
  const entries = []

  for (const vote of votes) {
    const slot = vote.slot
    if (!slot) {
      continue
    }

    const uniqueKey = `${slot._id || ''}`
    if (seen.has(uniqueKey)) {
      continue
    }
    seen.add(uniqueKey)

    entries.push({
      date: slot.date ? new Date(slot.date).toLocaleDateString('fr-CH') : '',
      period: slot.period,
      startTime: slot.startTime || '',
      endTime: slot.endTime || '',
      room: slot.room?.name || ''
    })
  }

  return entries
}

function getTpiCandidateName(tpi) {
  return getDisplayName(tpi?.candidat)
}

function normalizeTargetPersonId(person) {
  return person?._id ? String(person._id) : ''
}

function ensureVoteEmailTarget(targetsByPersonId, year, person) {
  const personId = normalizeTargetPersonId(person)

  if (!personId || !person?.email) {
    return null
  }

  if (!targetsByPersonId.has(personId)) {
    targetsByPersonId.set(personId, {
      person,
      personId,
      email: person.email,
      personName: getDisplayName(person),
      year,
      deadlines: [],
      roles: new Set(),
      tpisById: new Map()
    })
  }

  return targetsByPersonId.get(personId)
}

function addTpiToVoteEmailTarget(targetsByPersonId, {
  year,
  tpi,
  person,
  role,
  slots = []
}) {
  const target = ensureVoteEmailTarget(targetsByPersonId, year, person)
  const tpiId = tpi?._id ? String(tpi._id) : ''

  if (!target || !tpiId) {
    return
  }

  if (tpi?.votingSession?.deadline) {
    target.deadlines.push(tpi.votingSession.deadline)
  }

  if (!target.tpisById.has(tpiId)) {
    target.tpisById.set(tpiId, {
      id: tpiId,
      reference: tpi.reference || '',
      subject: tpi.sujet || '',
      candidateName: getTpiCandidateName(tpi),
      roleLabels: new Set(),
      slots
    })
  }

  const entry = target.tpisById.get(tpiId)
  const seenSlots = new Set(
    (Array.isArray(entry.slots) ? entry.slots : [])
      .map((slot) => [
        slot?.date,
        slot?.period,
        slot?.startTime,
        slot?.endTime,
        slot?.room
      ].join('|'))
  )

  for (const slot of Array.isArray(slots) ? slots : []) {
    const slotKey = [
      slot?.date,
      slot?.period,
      slot?.startTime,
      slot?.endTime,
      slot?.room
    ].join('|')

    if (seenSlots.has(slotKey)) {
      continue
    }

    seenSlots.add(slotKey)
    entry.slots.push(slot)
  }

  if (role) {
    entry.roleLabels.add(formatTpiStakeholderRoleLabel(role))
    target.roles.add(role)
  }
}

function formatEarliestDeadline(deadlines = [], fallbackDate = null) {
  const validDates = (Array.isArray(deadlines) ? deadlines : [])
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime())

  const deadline = validDates[0] || fallbackDate
  return deadline ? new Date(deadline).toLocaleDateString('fr-CH') : ''
}

function getVoteTargetSendPriority(target) {
  if (!target?.roles || typeof target.roles.has !== 'function') {
    return 2
  }

  if (target.roles.has('chef_projet')) {
    return 0
  }

  if (target.roles.has('expert1') || target.roles.has('expert2')) {
    return 1
  }

  return 2
}

function finalizeVoteEmailTarget(target, link) {
  const tpis = Array.from(target.tpisById.values())
    .map((entry) => ({
      ...entry,
      roleLabel: Array.from(entry.roleLabels).filter(Boolean).join(', '),
      roleLabels: undefined
    }))
    .sort((left, right) => String(left.reference).localeCompare(String(right.reference)))

  return {
    email: target.email,
    personName: target.personName,
    year: target.year,
    url: link.url,
    deadline: formatEarliestDeadline(target.deadlines, link.expiresAt),
    tpis
  }
}

function buildTpiVoters(tpi) {
  const rawVoters = [
    { person: tpi.chefProjet, role: 'chef_projet' },
    { person: tpi.expert1, role: 'expert1' },
    { person: tpi.expert2, role: 'expert2' }
  ]

  return rawVoters.filter(voter => canReceiveAutomaticEmail(voter.person))
}

async function loadVotingTpisForYear(year) {
  const [planningConfig, tpis] = await Promise.all([
    getPlanningConfigIfAvailable(year),
    TpiPlanning.find({
      year,
      status: { $in: COORDINATION_PROPOSAL_READY_STATUSES },
      proposedSlots: { $exists: true, $ne: [] }
    })
      .populate('candidat expert1 expert2 chefProjet', 'firstName lastName email sendEmails')
      .populate('proposedSlots.slot')
  ])

  return {
    planningConfig,
    tpis: filterPlanifiableTpis(tpis, planningConfig)
  }
}

function buildVoteDeadlineDate(workflowSettings = {}) {
  const settings = normalizeWorkflowSettings(workflowSettings)
  return new Date(Date.now() + settings.voteDeadlineDays * DAY_IN_MS)
}

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function buildPublicUrlLinkTarget(rawPublicUrl, fallbackBaseUrl, fallbackRedirectPath) {
  const publicUrl = compactText(rawPublicUrl)

  if (!publicUrl) {
    return null
  }

  if (publicUrl.startsWith('/')) {
    return {
      baseUrl: fallbackBaseUrl,
      redirectPath: publicUrl
    }
  }

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(publicUrl)
    ? publicUrl
    : `https://${publicUrl}`

  try {
    const url = new URL(withProtocol)
    return {
      baseUrl: `${url.protocol}//${url.host}`,
      redirectPath: `${url.pathname || fallbackRedirectPath}${url.search || ''}` || fallbackRedirectPath
    }
  } catch (error) {
    return null
  }
}

async function resolveVoteMagicLinkTarget(year, baseUrl, options = {}) {
  const configuredTarget = normalizeVoteLinkTarget(
    options.voteLinkTarget ||
    options.accessLinkSettings?.defaultVoteLinkTarget ||
    process.env.STATIC_VOTE_LINK_TARGET ||
    process.env.VOTE_LINK_TARGET
  )

  if (configuredTarget !== 'static') {
    return {
      baseUrl,
      redirectPath: `/coordination/${year}`,
      linkTarget: 'app'
    }
  }

  const publicUrl = compactText(
    options.votePublicUrl ||
    options.staticVotePublicUrl ||
    process.env.STATIC_VOTE_PUBLIC_URL
  )
  const target = await staticVotePublicationService.getStaticVoteLinkTarget(year, publicUrl)

  return {
    ...target,
    linkTarget: 'static'
  }
}

async function resolveSoutenanceMagicLinkTarget(year, baseUrl, options = {}) {
  const configuredTarget = normalizeSoutenanceLinkTarget(
    options.soutenanceLinkTarget ||
    options.accessLinkSettings?.defaultSoutenanceLinkTarget
  )
  const fallbackRedirectPath = buildDefensePublicPath(year)

  if (configuredTarget !== 'publication') {
    return {
      baseUrl,
      redirectPath: fallbackRedirectPath,
      linkTarget: 'app'
    }
  }

  const publicationTarget = buildPublicUrlLinkTarget(
    options.soutenancePublicUrl ||
    options.publicationPublicUrl ||
    options.staticSoutenancePublicUrl ||
    options.staticDefensePublicUrl ||
    process.env.STATIC_DEFENSE_PUBLIC_URL ||
    process.env.STATIC_DEFENSE_PUBLICATION_PUBLIC_URL ||
    process.env.STATIC_SOUTENANCE_PUBLIC_URL ||
    process.env.STATIC_SOUTENANCE_PUBLICATION_PUBLIC_URL ||
    process.env.STATIC_PUBLICATION_PUBLIC_URL,
    baseUrl,
    fallbackRedirectPath
  )

  return {
    ...(publicationTarget || {
      baseUrl,
      redirectPath: fallbackRedirectPath
    }),
    linkTarget: 'publication'
  }
}

async function findGeneratedVoteAccessLink({
  year,
  person,
  baseUrl,
  target
}) {
  if (typeof accessLinkTokenService.findReusableMagicLink !== 'function') {
    return null
  }

  const link = await accessLinkTokenService.findReusableMagicLink({
    year,
    type: 'vote',
    person,
    scope: {
      year,
      kind: 'stakeholder_votes',
      tpiId: null,
      voterRole: null
    },
    sources: getVoteGeneratedAccessLinkSources(target),
    baseUrl
  })

  return link?.url ? link : null
}

async function findGeneratedSoutenanceAccessLink({
  year,
  person,
  publicationVersion,
  baseUrl,
  target
}) {
  if (typeof accessLinkTokenService.findReusableMagicLink !== 'function') {
    return null
  }

  const link = await accessLinkTokenService.findReusableMagicLink({
    year,
    type: 'soutenance',
    person,
    scope: {
      publicationVersion: publicationVersion || null
    },
    sources: getSoutenanceGeneratedAccessLinkSources(target),
    baseUrl
  })

  return link?.url ? link : null
}

async function createGeneratedSoutenanceAccessLink({
  year,
  person,
  publicationVersion,
  baseUrl,
  redirectPath,
  target
}) {
  return await accessLinkTokenService.createSoutenanceMagicLink({
    year,
    person,
    scope: {
      kind: 'published_soutenances',
      publicationVersion: publicationVersion || null,
      source: getSoutenanceAccessLinkSource(target)
    },
    baseUrl,
    redirectPath,
    persistToken: true
  })
}

function buildMissingAccessLinkTarget(target) {
  return {
    personId: target?.personId || normalizeTargetPersonId(target?.person),
    email: target?.email || target?.person?.email || '',
    personName: target?.personName || getDisplayName(target?.person),
    tpiIds: target?.tpisById instanceof Map
      ? Array.from(target.tpisById.keys())
      : []
  }
}

function resolveDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isTpiEligibleForAutomaticReminder(tpi, workflowSettings = {}, now = new Date()) {
  const settings = normalizeWorkflowSettings(workflowSettings)

  if (settings.automaticVoteRemindersEnabled !== true || settings.maxVoteReminders <= 0) {
    return false
  }

  const session = tpi?.votingSession || {}
  const deadline = resolveDate(session.deadline)
  const referenceDate = resolveDate(now) || new Date()

  if (!deadline || deadline.getTime() <= referenceDate.getTime()) {
    return false
  }

  const millisecondsBeforeDeadline = deadline.getTime() - referenceDate.getTime()
  if (millisecondsBeforeDeadline > settings.voteReminderLeadHours * HOUR_IN_MS) {
    return false
  }

  const remindersCount = Number.parseInt(String(session.remindersCount ?? 0), 10)
  if (Number.isInteger(remindersCount) && remindersCount >= settings.maxVoteReminders) {
    return false
  }

  const lastReminderSentAt = resolveDate(session.lastReminderSentAt)
  if (lastReminderSentAt) {
    const cooldownEndsAt = lastReminderSentAt.getTime() + settings.voteReminderCooldownHours * HOUR_IN_MS
    if (cooldownEndsAt > referenceDate.getTime()) {
      return false
    }
  }

  return true
}

async function ensureVotesForTpi(tpi) {
  const voters = buildTpiVoters(tpi)
  const votes = []

  for (const proposedSlot of tpi.proposedSlots || []) {
    const slot = proposedSlot.slot
    if (!slot?._id) {
      continue
    }

    for (const voter of voters) {
      const vote = await Vote.findOneAndUpdate(
        {
          tpiPlanning: tpi._id,
          slot: slot._id,
          voter: voter.person._id,
          voterRole: voter.role
        },
        {
          $set: {
            tpiPlanning: tpi._id,
            slot: slot._id,
            voter: voter.person._id,
            voterRole: voter.role,
            decision: 'pending',
            comment: '',
            availabilityException: false,
            hardConstraint: false,
            specialRequestReason: '',
            specialRequestDate: null,
            votedAt: null,
            magicLinkUsed: null
          },
          $unset: {
            priority: ''
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      )

      votes.push(vote)
    }
  }

  return votes
}

async function ensureVoteRecordsForTpis(tpis = []) {
  let voteCount = 0
  let tpiCount = 0

  for (const tpi of Array.isArray(tpis) ? tpis : []) {
    if (!tpi?._id) {
      continue
    }

    const votes = await ensureVotesForTpi(tpi)
    voteCount += Array.isArray(votes) ? votes.length : 0
    tpiCount += 1
  }

  return {
    tpiCount,
    voteCount
  }
}

async function startVotesCampaign(year, baseUrl, options = {}) {
  const skipEmails = shouldSkipAutomaticEmailSends(options)
  const fromArbitrage = options?.fromArbitrage === true
  const { planningConfig, tpis } = await loadVotingTpisForYear(year)
  const workflowSettings = normalizeWorkflowSettings(planningConfig?.workflowSettings)
  const emailTargetsByPersonId = new Map()
  const emailSettings = await getSharedEmailSettingsIfAvailable()
  const emailOptions = {
    emailSettings,
    fromArbitrage
  }

  let totalEmails = 0
  let successfulEmails = 0
  let missingAccessLinkCount = 0
  const missingAccessLinks = []
  const details = []

  for (const tpi of tpis) {
    const voters = buildTpiVoters(tpi)

    if (tpi.status !== 'voting') {
      tpi.status = 'voting'
    }

    if (!tpi.votingSession) {
      tpi.votingSession = {
        startedAt: new Date(),
        deadline: buildVoteDeadlineDate(workflowSettings),
        remindersCount: 0,
        lastReminderSentAt: null,
        voteSummary: {
          expert1Voted: false,
          expert2Voted: false,
          chefProjetVoted: false
        }
      }
    } else {
      if (!tpi.votingSession.startedAt) {
        tpi.votingSession.startedAt = new Date()
      }

      if (!tpi.votingSession.deadline) {
        tpi.votingSession.deadline = buildVoteDeadlineDate(workflowSettings)
      }

      if (!tpi.votingSession.voteSummary) {
        tpi.votingSession.voteSummary = {
          expert1Voted: false,
          expert2Voted: false,
          chefProjetVoted: false
        }
      }
    }

    await tpi.save()

    await ensureVotesForTpi(tpi)

    const detail = {
      tpiId: String(tpi._id),
      reference: tpi.reference,
      voters: voters.length,
      emailsSent: 0,
      emailsSucceeded: 0
    }
    details.push(detail)

    if (!skipEmails) {
      const slots = buildSlotsPayloadFromProposedSlots(tpi.proposedSlots)
      for (const voter of voters) {
        addTpiToVoteEmailTarget(emailTargetsByPersonId, {
          year,
          person: voter.person,
          role: voter.role,
          tpi,
          slots
        })
      }
    }
  }

  if (!skipEmails && emailTargetsByPersonId.size > 0) {
    const digestTargets = []
    const voteLinkTarget = await resolveVoteMagicLinkTarget(year, baseUrl, {
      ...options,
      accessLinkSettings: planningConfig?.accessLinkSettings
    })

    const sortedTargets = Array.from(emailTargetsByPersonId.values())
      .sort((left, right) => {
        const leftPriority = getVoteTargetSendPriority(left)
        const rightPriority = getVoteTargetSendPriority(right)

        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority
        }

        return String(left.email || '').localeCompare(String(right.email || ''))
      })

    for (const target of sortedTargets) {
      const link = await findGeneratedVoteAccessLink({
        year,
        person: target.person,
        baseUrl: voteLinkTarget.baseUrl,
        target: voteLinkTarget.linkTarget
      })

      if (!link) {
        missingAccessLinks.push(buildMissingAccessLinkTarget(target))
        continue
      }

      digestTargets.push({
        ...finalizeVoteEmailTarget(target, link),
        tpiIds: Array.from(target.tpisById.keys())
      })
    }

    const mailResults = await emailService.sendVoteDigestRequests(digestTargets, emailOptions)
    const resultByEmail = new Map(mailResults.map((result) => [result.email, result]))
    totalEmails = sortedTargets.length
    successfulEmails = mailResults.filter(result => result.success).length
    missingAccessLinkCount = missingAccessLinks.length

    for (const detail of details) {
      const detailTargets = digestTargets.filter((target) => target.tpiIds.includes(detail.tpiId))
      const detailMissingTargets = missingAccessLinks.filter((target) => target.tpiIds.includes(detail.tpiId))
      detail.emailsSent = detailTargets.length
      detail.emailsSucceeded = detailTargets.filter((target) => resultByEmail.get(target.email)?.success).length
      detail.missingAccessLinks = detailMissingTargets.length
    }
  }

  return {
    tpiCount: tpis.length,
    totalEmails,
    successfulEmails,
    failedEmails: Math.max(totalEmails - successfulEmails, 0),
    emailsSkipped: skipEmails,
    emailSkipReason: skipEmails ? getAutomaticEmailSkipReason(options) : null,
    missingAccessLinkCount,
    missingAccessLinks,
    details
  }
}

async function remindPendingVotes(year, baseUrl, options = {}) {
  const automatic = options?.automatic === true
  const planningConfig = await getPlanningConfigIfAvailable(year)
  const workflowSettings = normalizeWorkflowSettings(planningConfig?.workflowSettings)
  const now = resolveDate(options?.now) || new Date()

  if (automatic && AUTOMATIC_EMAIL_SENDS_ENABLED !== true) {
    return {
      tpiCount: 0,
      eligibleTpiCount: 0,
      reminderTargets: 0,
      emailsSent: 0,
      emailsSucceeded: 0,
      emailsFailed: 0,
      automatic: true,
      skipped: true,
      reason: AUTOMATIC_EMAIL_SENDS_DISABLED_REASON
    }
  }

  if (automatic && workflowSettings.automaticVoteRemindersEnabled !== true) {
    return {
      tpiCount: 0,
      eligibleTpiCount: 0,
      reminderTargets: 0,
      emailsSent: 0,
      emailsSucceeded: 0,
      emailsFailed: 0,
      automatic: true,
      skipped: true,
      reason: 'automatic_reminders_disabled'
    }
  }

  const rawTpis = await TpiPlanning.find({ year, status: 'voting' })
    .populate('candidat expert1 expert2 chefProjet', 'firstName lastName email sendEmails')
    .select('reference sujet votingSession candidat expert1 expert2 chefProjet site')
  const tpis = filterPlanifiableTpis(rawTpis, planningConfig)
  const reminderTpis = automatic
    ? tpis.filter((tpi) => isTpiEligibleForAutomaticReminder(tpi, workflowSettings, now))
    : tpis

  if (reminderTpis.length === 0) {
    return {
      tpiCount: tpis.length,
      eligibleTpiCount: 0,
      reminderTargets: 0,
      emailsSent: 0,
      emailsSucceeded: 0,
      emailsFailed: 0,
      automatic,
      skipped: automatic,
      reason: automatic ? 'no_eligible_tpi' : null
    }
  }

  const tpiById = new Map(reminderTpis.map(tpi => [String(tpi._id), tpi]))
  const tpiIds = reminderTpis.map(tpi => tpi._id)

  const pendingVotes = await Vote.find({
    tpiPlanning: { $in: tpiIds },
    decision: 'pending'
  })
    .populate('slot', 'date period startTime endTime room')
    .populate('voter', 'firstName lastName email sendEmails')
    .select('tpiPlanning voter voterRole slot')

  const targetsByPersonId = new Map()
  for (const vote of pendingVotes) {
    const tpiId = String(vote.tpiPlanning)
    const voterId = vote.voter?._id ? String(vote.voter._id) : null

    if (!voterId || !vote.voter?.email) {
      continue
    }

    if (vote.voter.sendEmails === false) {
      continue
    }

    const tpi = tpiById.get(tpiId)
    if (!tpi) {
      continue
    }

    addTpiToVoteEmailTarget(targetsByPersonId, {
      year,
      person: vote.voter,
      role: vote.voterRole,
      tpi,
      slots: buildSlotsPayloadFromVotes([vote])
    })
  }

  const digestTargets = []
  const missingAccessLinks = []
  const voteLinkTarget = await resolveVoteMagicLinkTarget(year, baseUrl, {
    ...options,
    accessLinkSettings: planningConfig?.accessLinkSettings
  })
  for (const target of targetsByPersonId.values()) {
    const link = await findGeneratedVoteAccessLink({
      year,
      person: target.person,
      baseUrl: voteLinkTarget.baseUrl,
      target: voteLinkTarget.linkTarget
    })

    if (!link) {
      missingAccessLinks.push(buildMissingAccessLinkTarget(target))
      continue
    }

    digestTargets.push({
      ...finalizeVoteEmailTarget(target, link),
      tpiIds: Array.from(target.tpisById.keys())
    })
  }

  const emailSettings = await getSharedEmailSettingsIfAvailable()
  const mailResults = await emailService.sendVoteDigestRequests(digestTargets, { reminder: true, emailSettings })
  const emailsSent = mailResults.length
  const emailsSucceeded = mailResults.filter(result => result.success).length
  const touchedTpiIds = new Set()

  for (const target of digestTargets) {
    if (mailResults.find((result) => result.email === target.email)?.success) {
      target.tpiIds.forEach((tpiId) => touchedTpiIds.add(tpiId))
    }
  }

  if (touchedTpiIds.size > 0) {
    await TpiPlanning.updateMany(
      { _id: { $in: Array.from(touchedTpiIds) } },
      {
        $inc: { 'votingSession.remindersCount': 1 },
        $set: { 'votingSession.lastReminderSentAt': now }
      }
    )
  }

  return {
    tpiCount: tpis.length,
    eligibleTpiCount: reminderTpis.length,
    reminderTargets: targetsByPersonId.size,
    emailsSent,
    emailsSucceeded,
    emailsFailed: Math.max(targetsByPersonId.size - emailsSucceeded, 0),
    missingAccessLinkCount: missingAccessLinks.length,
    missingAccessLinks,
    automatic,
    skipped: false,
    reason: null
  }
}

function hasAllVotes(votes) {
  const votedRoles = new Set(
    votes
      .filter(vote => vote.decision && vote.decision !== 'pending')
      .map(vote => vote.voterRole)
  )

  return VOTING_STAKEHOLDER_ROLES.every((role) => votedRoles.has(role))
}

async function closeVotesCampaign(year) {
  const [planningConfig, rawTpis] = await Promise.all([
    getPlanningConfigIfAvailable(year),
    TpiPlanning.find({
      year,
      status: { $in: COORDINATION_VOTE_STATUSES }
    })
  ])
  const tpis = filterPlanifiableTpis(rawTpis, planningConfig)

  let confirmedCount = 0
  let manualRequiredCount = 0
  let unresolvedCount = 0
  const details = []

  for (const tpi of tpis) {
    const votes = await Vote.find({ tpiPlanning: tpi._id }).select('decision voterRole')
    const allVotesIn = hasAllVotes(votes)

    let confirmed = false
    if (allVotesIn) {
      const unanimousSlot = await Vote.findUnanimousSlot(tpi._id)
      if (unanimousSlot) {
        const confirmation = await schedulingService.confirmSlotForTpi(tpi._id, unanimousSlot)
        if (confirmation.success) {
          confirmed = true
          confirmedCount += 1
        } else {
          unresolvedCount += 1
        }
      }
    }

    if (!confirmed) {
      tpi.status = 'manual_required'
      tpi.conflicts.push({
        type: 'no_common_slot',
        description: allVotesIn
          ? 'Cloture de campagne: pas de consensus unanime.'
          : 'Cloture de campagne: votes incomplets.'
      })
      await tpi.save()
      manualRequiredCount += 1
    }

    details.push({
      tpiId: String(tpi._id),
      reference: tpi.reference,
      status: confirmed ? 'confirmed' : 'manual_required',
      allVotesIn
    })
  }

  return {
    tpiProcessed: tpis.length,
    confirmedCount,
    manualRequiredCount,
    unresolvedCount,
    details
  }
}

function listSoutenanceRecipientsFromTpi(tpi) {
  return [
    { person: tpi.candidat, role: 'candidat' },
    { person: tpi.expert1, role: 'expert1' },
    { person: tpi.expert2, role: 'expert2' },
    { person: tpi.chefProjet, role: 'chef_projet' }
  ].filter((entry) => Boolean(entry.person))
}

function addSoutenanceRecipient(recipientsByPersonId, person, role) {
  if (!person?._id || !canReceiveAutomaticEmail(person)) {
    return
  }

  const key = String(person._id)
  if (!recipientsByPersonId.has(key)) {
    recipientsByPersonId.set(key, {
      person,
      roles: new Set()
    })
  }

  const entry = recipientsByPersonId.get(key)
  entry.roles.add(role)

  if (Array.isArray(person.roles) && person.roles.includes('admin')) {
    entry.roles.add('admin')
  }
}

async function addAdminSoutenanceRecipients(recipientsByPersonId) {
  const admins = await Person.find({
    roles: 'admin',
    isActive: true
  })
    .select('firstName lastName email roles sendEmails')
    .lean()
  let addedCount = 0

  for (const admin of Array.isArray(admins) ? admins : []) {
    const beforeCount = recipientsByPersonId.size
    addSoutenanceRecipient(recipientsByPersonId, admin, 'admin')
    if (recipientsByPersonId.size > beforeCount) {
      addedCount += 1
    }
  }

  return addedCount
}

function collectPublishedRoomRecipientRefs(rooms = []) {
  const recipientRefsByKey = new Map()

  for (const room of Array.isArray(rooms) ? rooms : []) {
    for (const tpiData of Array.isArray(room?.tpiDatas) ? room.tpiDatas : []) {
      const refs = [
        { personId: tpiData?.candidatPersonId, role: 'candidat' },
        { personId: tpiData?.expert1?.personId, role: 'expert1' },
        { personId: tpiData?.expert2?.personId, role: 'expert2' },
        { personId: tpiData?.boss?.personId, role: 'chef_projet' }
      ]

      for (const ref of refs) {
        const personId = ref.personId ? String(ref.personId).trim() : ''
        if (!personId) {
          continue
        }

        const key = `${personId}|${ref.role}`
        if (!recipientRefsByKey.has(key)) {
          recipientRefsByKey.set(key, {
            personId,
            role: ref.role
          })
        }
      }
    }
  }

  return Array.from(recipientRefsByKey.values())
}

async function addPublishedRoomRecipients(recipientsByPersonRoleKey, rooms = []) {
  const recipientRefs = collectPublishedRoomRecipientRefs(rooms)
  if (recipientRefs.length === 0) {
    return 0
  }

  const personIds = Array.from(new Set(recipientRefs.map(ref => ref.personId)))
  const people = await Person.find({
    _id: { $in: personIds },
    isActive: true
  })
    .select('firstName lastName email roles sendEmails')
    .lean()
  const peopleById = new Map(
    (Array.isArray(people) ? people : [])
      .filter(person => person?._id)
      .map(person => [String(person._id), person])
  )
  let addedCount = 0

  for (const ref of recipientRefs) {
    const person = peopleById.get(ref.personId)
    const beforeCount = recipientsByPersonRoleKey.size
    addSoutenanceRecipient(recipientsByPersonRoleKey, person, ref.role)
    if (recipientsByPersonRoleKey.size > beforeCount) {
      addedCount += 1
    }
  }

  return addedCount
}

async function addConfirmedPlanningRecipients(recipientsByPersonRoleKey, year, planningConfig) {
  const rawConfirmedTpis = await TpiPlanning.find({
    year,
    status: 'confirmed',
    confirmedSlot: { $ne: null }
  })
  .populate('candidat expert1 expert2 chefProjet', 'firstName lastName email roles sendEmails')
  .select('reference candidat expert1 expert2 chefProjet site')
  const confirmedTpis = filterPlanifiableTpis(rawConfirmedTpis, planningConfig)

  let addedCount = 0

  for (const tpi of confirmedTpis) {
    const participants = listSoutenanceRecipientsFromTpi(tpi)

    for (const participant of participants) {
      const beforeCount = recipientsByPersonRoleKey.size
      addSoutenanceRecipient(recipientsByPersonRoleKey, participant.person, participant.role)
      if (recipientsByPersonRoleKey.size > beforeCount) {
        addedCount += 1
      }
    }
  }

  return addedCount
}

async function loadPublicationRooms(year, publicationVersion = null) {
  const activePublication = publicationVersion
    ? await getPublicationVersion(year, publicationVersion)
    : await getActivePublicationVersion(year)

  return {
    publicationVersion: activePublication?.version || publicationVersion || null,
    rooms: Array.isArray(activePublication?.rooms) ? activePublication.rooms : []
  }
}

async function sendSoutenanceLinksForYear(year, baseUrl, publicationVersion = null, options = {}) {
  const planningConfig = await getPlanningConfigIfAvailable(year)
  const recipientsByPersonId = new Map()
  const optionPublicationRooms = Array.isArray(options?.publicationRooms)
    ? options.publicationRooms
    : []
  let scopedPublicationVersion = publicationVersion || null

  if (optionPublicationRooms.length > 0) {
    await addPublishedRoomRecipients(recipientsByPersonId, optionPublicationRooms)
  }

  if (recipientsByPersonId.size === 0) {
    await addConfirmedPlanningRecipients(recipientsByPersonId, year, planningConfig)
  }

  if (recipientsByPersonId.size === 0 || !scopedPublicationVersion) {
    const publication = await loadPublicationRooms(year, publicationVersion)
    scopedPublicationVersion = publication.publicationVersion
    if (recipientsByPersonId.size === 0) {
      await addPublishedRoomRecipients(recipientsByPersonId, publication.rooms)
    }
  }

  await addAdminSoutenanceRecipients(recipientsByPersonId)

  let emailsSent = 0
  let emailsSucceeded = 0
  let generatedAccessLinkCount = 0
  const missingAccessLinks = []
  const skipEmails = options?.skipEmails === true

  if (skipEmails) {
    return {
      recipientsCount: recipientsByPersonId.size,
      publicationVersion: scopedPublicationVersion,
      emailsSent: 0,
      emailsSucceeded: 0,
      emailsFailed: 0,
      emailsSkipped: true,
      emailSkipReason: AUTOMATIC_EMAIL_SENDS_DISABLED_REASON,
      generatedAccessLinkCount,
      missingAccessLinkCount: 0,
      missingAccessLinks
    }
  }

  const emailSettings = await getSharedEmailSettingsIfAvailable()
  const soutenanceLinkTarget = await resolveSoutenanceMagicLinkTarget(year, baseUrl, {
    ...options,
    accessLinkSettings: planningConfig?.accessLinkSettings
  })

  for (const { person, roles } of recipientsByPersonId.values()) {
    let link = await findGeneratedSoutenanceAccessLink({
      year,
      person,
      publicationVersion: scopedPublicationVersion,
      baseUrl: soutenanceLinkTarget.baseUrl,
      target: soutenanceLinkTarget.linkTarget
    })

    if (!link && options.generateMissingAccessLinks === true) {
      link = await createGeneratedSoutenanceAccessLink({
        year,
        person,
        publicationVersion: scopedPublicationVersion,
        baseUrl: soutenanceLinkTarget.baseUrl,
        redirectPath: soutenanceLinkTarget.redirectPath,
        target: soutenanceLinkTarget.linkTarget
      })
      generatedAccessLinkCount += 1
    }

    if (!link) {
      missingAccessLinks.push({
        personId: normalizeTargetPersonId(person),
        email: person.email || '',
        personName: getDisplayName(person),
        roles: Array.from(roles || []).filter(Boolean)
      })
      continue
    }

    const result = await emailService.sendEmail(person.email, 'soutenanceAccess', {
      recipientName: getDisplayName(person),
      recipientRoles: Array.from(roles || []).filter(Boolean),
      year,
      magicLinkUrl: link.url,
      deadline: link.expiresAt.toLocaleDateString('fr-CH')
    }, { emailSettings })

    emailsSent += 1
    if (result.success) {
      emailsSucceeded += 1
    }
  }

  return {
    recipientsCount: recipientsByPersonId.size,
    publicationVersion: scopedPublicationVersion,
    emailsSent,
    emailsSucceeded,
    emailsFailed: Math.max(recipientsByPersonId.size - emailsSucceeded, 0),
    generatedAccessLinkCount,
    missingAccessLinkCount: missingAccessLinks.length,
    missingAccessLinks
  }
}

module.exports = {
  startVotesCampaign,
  remindPendingVotes,
  isTpiEligibleForAutomaticReminder,
  closeVotesCampaign,
  sendSoutenanceLinksForYear,
  ensureVoteRecordsForTpis
}
