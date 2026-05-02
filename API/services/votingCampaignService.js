const TpiPlanning = require('../models/tpiPlanningModel')
const Vote = require('../models/voteModel')
const emailService = require('./emailService')
const magicLinkV2Service = require('./magicLinkV2Service')
const { getSharedEmailSettingsIfAvailable } = require('./planningCatalogService')
const { getActivePublicationVersion } = require('./publishedSoutenanceService')
const {
  getPlanningConfigIfAvailable,
  normalizeWorkflowSettings
} = require('./planningConfigService')
const schedulingService = require('./schedulingService')
const staticVotePublicationService = require('./staticVotePublicationService')
const { filterPlanifiableTpis } = require('./tpiPlanningVisibility')

const DAY_IN_MS = 24 * 60 * 60 * 1000
const HOUR_IN_MS = 60 * 60 * 1000

function getDisplayName(person) {
  if (!person) {
    return ''
  }

  if (typeof person.fullName === 'string' && person.fullName.trim().length > 0) {
    return person.fullName
  }

  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim()
}

function toRoleLabel(role) {
  if (role === 'expert1' || role === 'expert2') {
    return 'Expert'
  }

  return 'Chef de projet'
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
    entry.roleLabels.add(toRoleLabel(role))
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
    { person: tpi.expert1, role: 'expert1' },
    { person: tpi.expert2, role: 'expert2' },
    { person: tpi.chefProjet, role: 'chef_projet' }
  ]

  return rawVoters.filter(voter => canReceiveAutomaticEmail(voter.person))
}

async function loadVotingTpisForYear(year) {
  const [planningConfig, tpis] = await Promise.all([
    getPlanningConfigIfAvailable(year),
    TpiPlanning.find({
      year,
      status: { $in: ['voting', 'pending_slots'] },
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

function normalizeVoteLinkTarget(value) {
  const normalized = compactText(value).toLowerCase()
  return normalized === 'static' || normalized === 'publication' ? 'static' : 'app'
}

async function resolveVoteMagicLinkTarget(year, baseUrl, options = {}) {
  const configuredTarget = normalizeVoteLinkTarget(
    options.voteLinkTarget ||
    process.env.STATIC_VOTE_LINK_TARGET ||
    process.env.VOTE_LINK_TARGET
  )

  if (configuredTarget !== 'static') {
    return {
      baseUrl,
      redirectPath: `/planning/${year}`,
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

async function startVotesCampaign(year, baseUrl, options = {}) {
  const skipEmails = options?.skipEmails === true
  const { planningConfig, tpis } = await loadVotingTpisForYear(year)
  const workflowSettings = normalizeWorkflowSettings(planningConfig?.workflowSettings)
  const emailTargetsByPersonId = new Map()

  let totalEmails = 0
  let successfulEmails = 0
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
    const voteLinkTarget = await resolveVoteMagicLinkTarget(year, baseUrl, options)

    for (const target of emailTargetsByPersonId.values()) {
      const link = await magicLinkV2Service.createVoteMagicLink({
        year,
        person: target.person,
        role: null,
        scope: {
          year,
          kind: 'stakeholder_votes'
        },
        accessLinkSettings: planningConfig?.accessLinkSettings,
        baseUrl: voteLinkTarget.baseUrl,
        redirectPath: voteLinkTarget.redirectPath
      })

      digestTargets.push({
        ...finalizeVoteEmailTarget(target, link),
        tpiIds: Array.from(target.tpisById.keys())
      })
    }

    const emailSettings = await getSharedEmailSettingsIfAvailable()
    const mailResults = await emailService.sendVoteDigestRequests(digestTargets, { emailSettings })
    const resultByEmail = new Map(mailResults.map((result) => [result.email, result]))
    totalEmails = mailResults.length
    successfulEmails = mailResults.filter(result => result.success).length

    for (const detail of details) {
      const detailTargets = digestTargets.filter((target) => target.tpiIds.includes(detail.tpiId))
      detail.emailsSent = detailTargets.length
      detail.emailsSucceeded = detailTargets.filter((target) => resultByEmail.get(target.email)?.success).length
    }
  }

  return {
    tpiCount: tpis.length,
    totalEmails,
    successfulEmails,
    failedEmails: Math.max(totalEmails - successfulEmails, 0),
    emailsSkipped: skipEmails,
    details
  }
}

async function remindPendingVotes(year, baseUrl, options = {}) {
  const automatic = options?.automatic === true
  const planningConfig = await getPlanningConfigIfAvailable(year)
  const workflowSettings = normalizeWorkflowSettings(planningConfig?.workflowSettings)
  const now = resolveDate(options?.now) || new Date()

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
  const voteLinkTarget = await resolveVoteMagicLinkTarget(year, baseUrl, options)
  for (const target of targetsByPersonId.values()) {
    const link = await magicLinkV2Service.createVoteMagicLink({
      year,
      person: target.person,
      role: null,
      scope: {
        year,
        kind: 'stakeholder_votes',
        source: 'vote_reminder'
      },
      accessLinkSettings: planningConfig?.accessLinkSettings,
      baseUrl: voteLinkTarget.baseUrl,
      redirectPath: voteLinkTarget.redirectPath
    })

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
    reminderTargets: digestTargets.length,
    emailsSent,
    emailsSucceeded,
    emailsFailed: Math.max(emailsSent - emailsSucceeded, 0),
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

  return (
    votedRoles.has('expert1') &&
    votedRoles.has('expert2') &&
    votedRoles.has('chef_projet')
  )
}

async function closeVotesCampaign(year) {
  const [planningConfig, rawTpis] = await Promise.all([
    getPlanningConfigIfAvailable(year),
    TpiPlanning.find({
      year,
      status: { $in: ['voting', 'pending_validation'] }
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
  return [tpi.candidat, tpi.expert1, tpi.expert2, tpi.chefProjet]
    .filter(Boolean)
}

async function sendSoutenanceLinksForYear(year, baseUrl, publicationVersion = null) {
  const [planningConfig, rawConfirmedTpis] = await Promise.all([
    getPlanningConfigIfAvailable(year),
    TpiPlanning.find({
      year,
      status: 'confirmed',
      confirmedSlot: { $ne: null }
    })
      .populate('candidat expert1 expert2 chefProjet', 'firstName lastName email sendEmails')
      .select('reference candidat expert1 expert2 chefProjet site')
  ])
  const confirmedTpis = filterPlanifiableTpis(rawConfirmedTpis, planningConfig)

  const recipientsById = new Map()

  for (const tpi of confirmedTpis) {
    const participants = listSoutenanceRecipientsFromTpi(tpi)

    for (const person of participants) {
      if (!person?._id || !canReceiveAutomaticEmail(person)) {
        continue
      }

      const key = String(person._id)
      if (!recipientsById.has(key)) {
        recipientsById.set(key, person)
      }
    }
  }

  let emailsSent = 0
  let emailsSucceeded = 0
  const activePublication = publicationVersion
    ? { version: publicationVersion }
    : await getActivePublicationVersion(year)
  const scopedPublicationVersion = activePublication?.version || null
  const emailSettings = await getSharedEmailSettingsIfAvailable()

  for (const person of recipientsById.values()) {
    const link = await magicLinkV2Service.createSoutenanceMagicLink({
      year,
      person,
      scope: {
        kind: 'published_soutenances',
        publicationVersion: scopedPublicationVersion
      },
      accessLinkSettings: planningConfig?.accessLinkSettings,
      baseUrl
    })

    const result = await emailService.sendEmail(person.email, 'soutenanceAccess', {
      recipientName: getDisplayName(person),
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
    recipientsCount: recipientsById.size,
    publicationVersion: scopedPublicationVersion,
    emailsSent,
    emailsSucceeded,
    emailsFailed: Math.max(emailsSent - emailsSucceeded, 0)
  }
}

module.exports = {
  startVotesCampaign,
  remindPendingVotes,
  isTpiEligibleForAutomaticReminder,
  closeVotesCampaign,
  sendSoutenanceLinksForYear
}
