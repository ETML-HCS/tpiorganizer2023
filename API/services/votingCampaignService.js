const TpiPlanning = require('../models/tpiPlanningModel')
const Vote = require('../models/voteModel')
const emailService = require('./emailService')
const magicLinkV2Service = require('./magicLinkV2Service')
const { getActivePublicationVersion } = require('./publishedSoutenanceService')
const { getPlanningConfigIfAvailable } = require('./planningConfigService')
const schedulingService = require('./schedulingService')
const { filterPlanifiableTpis } = require('./tpiPlanningVisibility')

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

  return filterPlanifiableTpis(tpis, planningConfig)
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
  const tpis = await loadVotingTpisForYear(year)

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
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        remindersCount: 0,
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
        tpi.votingSession.deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
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

    let emailsSent = 0
    let emailsSucceeded = 0

    if (!skipEmails) {
      const slots = buildSlotsPayloadFromProposedSlots(tpi.proposedSlots)
      const magicLinks = []

      for (const voter of voters) {
        const link = await magicLinkV2Service.createVoteMagicLink({
          year,
          person: voter.person,
          role: voter.role,
          scope: {
            tpiId: String(tpi._id),
            reference: tpi.reference
          },
          baseUrl
        })
        magicLinks.push({
          ...link,
          email: voter.person.email,
          personName: getDisplayName(voter.person),
          role: voter.role,
          slots
        })
      }

      const mailResults = await emailService.sendVoteRequests(tpi, magicLinks)
      emailsSent = mailResults.length
      emailsSucceeded = mailResults.filter(result => result.success).length
      totalEmails += emailsSent
      successfulEmails += emailsSucceeded
    }

    details.push({
      tpiId: String(tpi._id),
      reference: tpi.reference,
      voters: voters.length,
      emailsSent,
      emailsSucceeded
    })
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

async function remindPendingVotes(year, baseUrl) {
  const [planningConfig, rawTpis] = await Promise.all([
    getPlanningConfigIfAvailable(year),
    TpiPlanning.find({ year, status: 'voting' })
      .populate('candidat expert1 expert2 chefProjet', 'firstName lastName email sendEmails')
      .select('reference sujet votingSession candidat expert1 expert2 chefProjet site')
  ])
  const tpis = filterPlanifiableTpis(rawTpis, planningConfig)

  if (tpis.length === 0) {
    return {
      tpiCount: 0,
      reminderTargets: 0,
      emailsSent: 0,
      emailsSucceeded: 0
    }
  }

  const tpiById = new Map(tpis.map(tpi => [String(tpi._id), tpi]))
  const tpiIds = tpis.map(tpi => tpi._id)

  const pendingVotes = await Vote.find({
    tpiPlanning: { $in: tpiIds },
    decision: 'pending'
  })
    .populate('slot', 'date period startTime endTime room')
    .populate('voter', 'firstName lastName email sendEmails')
    .select('tpiPlanning voter voterRole slot')

  const groupedByTpiAndVoter = new Map()
  for (const vote of pendingVotes) {
    const tpiId = String(vote.tpiPlanning)
    const voterId = vote.voter?._id ? String(vote.voter._id) : null

    if (!voterId || !vote.voter?.email) {
      continue
    }

    const key = `${tpiId}|${voterId}`
    if (!groupedByTpiAndVoter.has(key)) {
      groupedByTpiAndVoter.set(key, {
        tpiId,
        voter: vote.voter,
        voterRole: vote.voterRole,
        votes: []
      })
    }

    groupedByTpiAndVoter.get(key).votes.push(vote)
  }

  let emailsSent = 0
  let emailsSucceeded = 0
  const touchedTpiIds = new Set()

  for (const target of groupedByTpiAndVoter.values()) {
    // Ne pas relancer les personnes qui ne veulent pas d'emails
    if (target.voter.sendEmails === false) {
      continue
    }

    const tpi = tpiById.get(target.tpiId)
    if (!tpi) {
      continue
    }

    const slots = buildSlotsPayloadFromVotes(target.votes)
    const link = await magicLinkV2Service.createVoteMagicLink({
      year,
      person: target.voter,
      role: target.voterRole,
      scope: {
        tpiId: target.tpiId
      },
      baseUrl
    })

    const result = await emailService.sendEmail(target.voter.email, 'voteReminder', {
      recipientName: getDisplayName(target.voter),
      candidateName: getDisplayName(tpi.candidat),
      tpiReference: tpi.reference,
      role: toRoleLabel(target.voterRole),
      slots,
      deadline: tpi.votingSession?.deadline
        ? new Date(tpi.votingSession.deadline).toLocaleDateString('fr-CH')
        : '',
      magicLinkUrl: link.url
    })

    emailsSent += 1
    if (result.success) {
      emailsSucceeded += 1
    }
    touchedTpiIds.add(target.tpiId)
  }

  if (touchedTpiIds.size > 0) {
    await TpiPlanning.updateMany(
      { _id: { $in: Array.from(touchedTpiIds) } },
      { $inc: { 'votingSession.remindersCount': 1 } }
    )
  }

  return {
    tpiCount: tpis.length,
    reminderTargets: groupedByTpiAndVoter.size,
    emailsSent,
    emailsSucceeded,
    emailsFailed: Math.max(emailsSent - emailsSucceeded, 0)
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

  for (const person of recipientsById.values()) {
    const link = await magicLinkV2Service.createSoutenanceMagicLink({
      year,
      person,
      scope: {
        kind: 'published_soutenances',
        publicationVersion: scopedPublicationVersion
      },
      baseUrl
    })

    const result = await emailService.sendEmail(person.email, 'soutenanceAccess', {
      recipientName: getDisplayName(person),
      year,
      magicLinkUrl: link.url,
      deadline: link.expiresAt.toLocaleDateString('fr-CH')
    })

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
  closeVotesCampaign,
  sendSoutenanceLinksForYear
}
