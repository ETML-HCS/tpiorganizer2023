const test = require('node:test')
const assert = require('node:assert/strict')

const TpiPlanning = require('../models/tpiPlanningModel')
const emailService = require('../services/emailService')
const magicLinkV2Service = require('../services/magicLinkV2Service')
const votingCampaignService = require('../services/votingCampaignService')
const Vote = require('../models/voteModel')
const schedulingService = require('../services/schedulingService')

function patchMethod(target, key, implementation) {
  const original = target[key]
  target[key] = implementation
  return () => {
    target[key] = original
  }
}

function loadVotingCampaignServiceWithPatches({
  getPlanningConfig = async () => ({}),
  filterPlanifiableTpis = (tpis) => tpis
} = {}) {
  const servicePath = require.resolve('../services/votingCampaignService')
  const planningConfigService = require('../services/planningConfigService')
  const planningVisibilityService = require('../services/tpiPlanningVisibility')

  const restorePlanningConfig = patchMethod(planningConfigService, 'getPlanningConfig', getPlanningConfig)
  const restorePlanningConfigIfAvailable = patchMethod(planningConfigService, 'getPlanningConfigIfAvailable', getPlanningConfig)
  const restoreVisibility = patchMethod(planningVisibilityService, 'filterPlanifiableTpis', filterPlanifiableTpis)

  delete require.cache[servicePath]

  return {
    service: require('../services/votingCampaignService'),
    restore() {
      restoreVisibility()
      restorePlanningConfigIfAvailable()
      restorePlanningConfig()
      delete require.cache[servicePath]
    }
  }
}

test('sendSoutenanceLinksForYear skips recipients with sendEmails disabled', async () => {
  const sentEmails = []
  const confirmedTpis = [
    {
      candidat: {
        _id: 'candidate-1',
        firstName: 'Alice',
        lastName: 'Martin',
        email: 'draft.candidat.alice.2026.abc123@tpiorganizer.ch',
        sendEmails: false
      },
      expert1: {
        _id: 'expert-1',
        firstName: 'Eva',
        lastName: 'Expert',
        email: 'eva.expert@example.com',
        sendEmails: true
      },
      expert2: {
        _id: 'expert-2',
        firstName: 'Nina',
        lastName: 'NoMail',
        email: '',
        sendEmails: true
      },
      chefProjet: {
        _id: 'boss-1',
        firstName: 'Paul',
        lastName: 'Chef',
        email: 'paul.chef@example.com',
        sendEmails: true
      }
    }
  ]

  const restore = [
    patchMethod(TpiPlanning, 'find', () => ({
      populate() {
        return this
      },
      select: async () => confirmedTpis
    })),
    patchMethod(magicLinkV2Service, 'createSoutenanceMagicLink', async ({ person }) => ({
      url: `https://example.test/magic/${person._id}`,
      expiresAt: new Date('2026-06-01T10:00:00.000Z')
    })),
    patchMethod(emailService, 'sendEmail', async (email) => {
      sentEmails.push(email)
      return {
        success: true
      }
    })
  ]

  try {
    const result = await votingCampaignService.sendSoutenanceLinksForYear(2026, 'https://example.test', 4)

    assert.deepEqual(sentEmails, ['eva.expert@example.com', 'paul.chef@example.com'])
    assert.equal(result.recipientsCount, 2)
    assert.equal(result.emailsSent, 2)
    assert.equal(result.emailsSucceeded, 2)
    assert.equal(result.publicationVersion, 4)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('startVotesCampaign opens voting without sending emails when skipEmails is enabled', async () => {
  const fixedNow = Date.parse('2026-04-01T00:00:00.000Z')
  const savedTpis = []
  const voteUpdates = []
  const sentVoteRequests = []
  const createdVoteLinks = []
  const tpi = {
    _id: 'planning-1',
    status: 'pending_slots',
    reference: 'TPI-2026-001',
    proposedSlots: [
      {
        slot: {
          _id: 'slot-1',
          date: new Date('2026-06-10T08:00:00.000Z'),
          period: 'AM',
          startTime: '08:00',
          endTime: '08:45',
          room: { name: 'A101' }
        }
      }
    ],
    expert1: {
      _id: 'expert-1',
      firstName: 'Eva',
      lastName: 'Expert',
      email: 'eva.expert@example.com',
      sendEmails: true
    },
    expert2: {
      _id: 'expert-2',
      firstName: 'Nina',
      lastName: 'Expert',
      email: 'nina.expert@example.com',
      sendEmails: true
    },
    chefProjet: {
      _id: 'boss-1',
      firstName: 'Paul',
      lastName: 'Chef',
      email: 'paul.chef@example.com',
      sendEmails: true
    },
    save: async function save() {
      savedTpis.push({
        status: this.status,
        votingSession: this.votingSession
      })
    }
  }

  const query = {
    populate() {
      return this
    },
    then(resolve, reject) {
      return Promise.resolve([tpi]).then(resolve, reject)
    }
  }

  const { service, restore: restoreService } = loadVotingCampaignServiceWithPatches({
    getPlanningConfig: async () => ({
      workflowSettings: {
        voteDeadlineDays: 10
      }
    })
  })
  const restore = [
    restoreService,
    patchMethod(Date, 'now', () => fixedNow),
    patchMethod(TpiPlanning, 'find', () => query),
    patchMethod(Vote, 'findOneAndUpdate', async (filter) => {
      voteUpdates.push(filter)
      return {
        _id: `vote-${voteUpdates.length}`
      }
    }),
    patchMethod(emailService, 'sendVoteRequests', async (...args) => {
      sentVoteRequests.push(args)
      return []
    }),
    patchMethod(magicLinkV2Service, 'createVoteMagicLink', async (...args) => {
      createdVoteLinks.push(args)
      return {
        url: 'https://example.test/magic'
      }
    })
  ]

  try {
    const result = await service.startVotesCampaign(2026, 'https://example.test', {
      skipEmails: true
    })

    assert.equal(result.tpiCount, 1)
    assert.equal(result.totalEmails, 0)
    assert.equal(result.successfulEmails, 0)
    assert.equal(result.failedEmails, 0)
    assert.equal(result.emailsSkipped, true)
    assert.equal(result.details[0].emailsSent, 0)
    assert.equal(result.details[0].emailsSucceeded, 0)
    assert.equal(savedTpis.length, 1)
    assert.equal(savedTpis[0].status, 'voting')
    assert.equal(Boolean(savedTpis[0].votingSession?.startedAt), true)
    assert.equal(savedTpis[0].votingSession.deadline.toISOString(), '2026-04-11T00:00:00.000Z')
    assert.equal(voteUpdates.length, 3)
    assert.equal(sentVoteRequests.length, 0)
    assert.equal(createdVoteLinks.length, 0)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('startVotesCampaign sends one vote link per stakeholder for all their TPI', async () => {
  const createdVoteLinks = []
  const sentDigestTargets = []
  const sentVoteRequests = []
  const voteUpdates = []
  const savedTpis = []

  const alice = {
    _id: 'person-alice',
    firstName: 'Alice',
    lastName: 'Expert',
    email: 'alice@example.com',
    sendEmails: true
  }
  const bob = {
    _id: 'person-bob',
    firstName: 'Bob',
    lastName: 'Expert',
    email: 'bob@example.com',
    sendEmails: true
  }
  const carla = {
    _id: 'person-carla',
    firstName: 'Carla',
    lastName: 'Boss',
    email: 'carla@example.com',
    sendEmails: true
  }
  const david = {
    _id: 'person-david',
    firstName: 'David',
    lastName: 'Expert',
    email: 'david@example.com',
    sendEmails: true
  }

  function makeTpi(id, reference, expert2) {
    return {
      _id: id,
      status: 'pending_slots',
      reference,
      sujet: `Sujet ${reference}`,
      candidat: {
        _id: `candidate-${id}`,
        firstName: `Candidat ${id}`,
        lastName: 'Test'
      },
      proposedSlots: [
        {
          slot: {
            _id: `slot-${id}`,
            date: new Date('2026-06-10T08:00:00.000Z'),
            period: 'AM',
            startTime: '08:00',
            endTime: '08:45',
            room: { name: 'A101' }
          }
        }
      ],
      expert1: alice,
      expert2,
      chefProjet: carla,
      save: async function save() {
        savedTpis.push({
          id: this._id,
          status: this.status,
          votingSession: this.votingSession
        })
      }
    }
  }

  const tpis = [
    makeTpi('planning-1', 'TPI-2026-001', bob),
    makeTpi('planning-2', 'TPI-2026-002', david)
  ]

  const query = {
    populate() {
      return this
    },
    then(resolve, reject) {
      return Promise.resolve(tpis).then(resolve, reject)
    }
  }

  const { service, restore: restoreService } = loadVotingCampaignServiceWithPatches()
  const restore = [
    restoreService,
    patchMethod(TpiPlanning, 'find', () => query),
    patchMethod(Vote, 'findOneAndUpdate', async (filter) => {
      voteUpdates.push(filter)
      return {
        _id: `vote-${voteUpdates.length}`
      }
    }),
    patchMethod(magicLinkV2Service, 'createVoteMagicLink', async (params) => {
      createdVoteLinks.push(params)
      return {
        url: `https://example.test/planning/${params.year}?ml=${params.person._id}`,
        expiresAt: new Date('2026-05-01T12:00:00.000Z')
      }
    }),
    patchMethod(emailService, 'sendVoteDigestRequests', async (targets) => {
      sentDigestTargets.push(...targets)
      return targets.map((target) => ({
        email: target.email,
        success: true
      }))
    }),
    patchMethod(emailService, 'sendVoteRequests', async (...args) => {
      sentVoteRequests.push(args)
      return []
    })
  ]

  try {
    const result = await service.startVotesCampaign(2026, 'https://example.test')

    assert.equal(result.tpiCount, 2)
    assert.equal(result.totalEmails, 4)
    assert.equal(result.successfulEmails, 4)
    assert.equal(createdVoteLinks.length, 4)
    assert.equal(sentDigestTargets.length, 4)
    assert.equal(sentVoteRequests.length, 0)
    assert.equal(voteUpdates.length, 6)
    assert.equal(savedTpis.length, 2)

    assert.equal(createdVoteLinks.every((link) => link.role === null), true)
    assert.equal(
      createdVoteLinks.every((link) => link.scope?.kind === 'stakeholder_votes'),
      true
    )
    assert.equal(
      createdVoteLinks.some((link) => Object.prototype.hasOwnProperty.call(link.scope || {}, 'tpiId')),
      false
    )

    const aliceTarget = sentDigestTargets.find((target) => target.email === 'alice@example.com')
    const carlaTarget = sentDigestTargets.find((target) => target.email === 'carla@example.com')
    const bobTarget = sentDigestTargets.find((target) => target.email === 'bob@example.com')

    assert.ok(aliceTarget)
    assert.ok(carlaTarget)
    assert.ok(bobTarget)
    assert.deepEqual(
      aliceTarget.tpis.map((tpi) => tpi.reference),
      ['TPI-2026-001', 'TPI-2026-002']
    )
    assert.deepEqual(
      carlaTarget.tpis.map((tpi) => tpi.reference),
      ['TPI-2026-001', 'TPI-2026-002']
    )
    assert.deepEqual(
      bobTarget.tpis.map((tpi) => tpi.reference),
      ['TPI-2026-001']
    )
    assert.equal(result.details[0].emailsSent, 3)
    assert.equal(result.details[1].emailsSent, 3)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('remindPendingVotes skips automatic reminders when annual setting is disabled', async () => {
  let tpiQueryCalled = false
  const { service, restore: restoreService } = loadVotingCampaignServiceWithPatches({
    getPlanningConfig: async () => ({
      workflowSettings: {
        automaticVoteRemindersEnabled: false
      }
    })
  })
  const restore = [
    restoreService,
    patchMethod(TpiPlanning, 'find', () => {
      tpiQueryCalled = true
      return {
        populate() {
          return this
        },
        select: async () => []
      }
    })
  ]

  try {
    const result = await service.remindPendingVotes(2026, 'https://example.test', {
      automatic: true,
      now: new Date('2026-04-02T00:00:00.000Z')
    })

    assert.equal(result.automatic, true)
    assert.equal(result.skipped, true)
    assert.equal(result.reason, 'automatic_reminders_disabled')
    assert.equal(result.emailsSent, 0)
    assert.equal(tpiQueryCalled, false)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('remindPendingVotes sends automatic reminders only inside configured window', async () => {
  const sentDigestTargets = []
  const createdVoteLinks = []
  const updates = []
  const now = new Date('2026-04-02T00:00:00.000Z')
  const voter = {
    _id: 'person-alice',
    firstName: 'Alice',
    lastName: 'Expert',
    email: 'alice@example.com',
    sendEmails: true
  }

  function makeTpi(id, reference, votingSession) {
    return {
      _id: id,
      reference,
      sujet: `Sujet ${reference}`,
      site: 'ETML',
      candidat: {
        _id: `candidate-${id}`,
        firstName: `Candidat ${id}`,
        lastName: 'Test'
      },
      expert1: voter,
      expert2: voter,
      chefProjet: voter,
      votingSession
    }
  }

  const dueTpi = makeTpi('planning-due', 'TPI-2026-001', {
    deadline: new Date('2026-04-03T12:00:00.000Z'),
    remindersCount: 0,
    lastReminderSentAt: null
  })
  const futureTpi = makeTpi('planning-future', 'TPI-2026-002', {
    deadline: new Date('2026-04-05T12:00:00.000Z'),
    remindersCount: 0,
    lastReminderSentAt: null
  })
  const maxedTpi = makeTpi('planning-maxed', 'TPI-2026-003', {
    deadline: new Date('2026-04-03T12:00:00.000Z'),
    remindersCount: 1,
    lastReminderSentAt: null
  })
  const cooldownTpi = makeTpi('planning-cooldown', 'TPI-2026-004', {
    deadline: new Date('2026-04-03T12:00:00.000Z'),
    remindersCount: 0,
    lastReminderSentAt: new Date('2026-04-01T18:00:00.000Z')
  })
  const tpis = [dueTpi, futureTpi, maxedTpi, cooldownTpi]
  const pendingVotes = [
    {
      tpiPlanning: dueTpi._id,
      voter,
      voterRole: 'expert1',
      slot: {
        _id: 'slot-due',
        date: new Date('2026-06-10T08:00:00.000Z'),
        period: 'AM',
        startTime: '08:00',
        endTime: '08:45',
        room: { name: 'A101' }
      }
    }
  ]

  const { service, restore: restoreService } = loadVotingCampaignServiceWithPatches({
    getPlanningConfig: async () => ({
      workflowSettings: {
        automaticVoteRemindersEnabled: true,
        voteReminderLeadHours: 48,
        maxVoteReminders: 1,
        voteReminderCooldownHours: 24
      }
    })
  })
  const restore = [
    restoreService,
    patchMethod(TpiPlanning, 'find', () => ({
      populate() {
        return this
      },
      select: async () => tpis
    })),
    patchMethod(Vote, 'find', (query) => {
      assert.deepEqual(query.tpiPlanning.$in, [dueTpi._id])
      return {
        populate() {
          return this
        },
        select: async () => pendingVotes
      }
    }),
    patchMethod(magicLinkV2Service, 'createVoteMagicLink', async (params) => {
      createdVoteLinks.push(params)
      return {
        url: `https://example.test/planning/${params.year}?ml=${params.person._id}`,
        expiresAt: new Date('2026-04-09T00:00:00.000Z')
      }
    }),
    patchMethod(emailService, 'sendVoteDigestRequests', async (targets, options = {}) => {
      assert.equal(options.reminder, true)
      sentDigestTargets.push(...targets)
      return targets.map((target) => ({
        email: target.email,
        success: true
      }))
    }),
    patchMethod(TpiPlanning, 'updateMany', async (filter, update) => {
      updates.push({ filter, update })
      return { modifiedCount: 1 }
    })
  ]

  try {
    const result = await service.remindPendingVotes(2026, 'https://example.test', {
      automatic: true,
      now
    })

    assert.equal(result.automatic, true)
    assert.equal(result.skipped, false)
    assert.equal(result.tpiCount, 4)
    assert.equal(result.eligibleTpiCount, 1)
    assert.equal(result.reminderTargets, 1)
    assert.equal(result.emailsSent, 1)
    assert.equal(result.emailsSucceeded, 1)
    assert.equal(createdVoteLinks.length, 1)
    assert.equal(sentDigestTargets.length, 1)
    assert.deepEqual(
      sentDigestTargets[0].tpis.map((tpi) => tpi.reference),
      ['TPI-2026-001']
    )
    assert.equal(updates.length, 1)
    assert.deepEqual(updates[0].filter._id.$in, [dueTpi._id])
    assert.deepEqual(updates[0].update.$set, {
      'votingSession.lastReminderSentAt': now
    })
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('closeVotesCampaign confirme tous les TPI dont les trois rôles ont voté OK', async () => {
  const confirmedSlots = new Map([
    ['planning-1', 'slot-1'],
    ['planning-2', 'slot-2']
  ])
  const tpis = [
    {
      _id: 'planning-1',
      reference: 'TPI-2026-001',
      conflicts: [],
      save: async function save() { return this }
    },
    {
      _id: 'planning-2',
      reference: 'TPI-2026-002',
      conflicts: [],
      save: async function save() { return this }
    }
  ]
  const votesByTpi = new Map(
    tpis.map((tpi) => [
      tpi._id,
      [
        { voterRole: 'expert1', decision: 'accepted' },
        { voterRole: 'expert2', decision: 'accepted' },
        { voterRole: 'chef_projet', decision: 'accepted' }
      ]
    ])
  )
  const confirmedTpiIds = []

  const restore = [
    patchMethod(TpiPlanning, 'find', async (query) => {
      assert.equal(query.year, 2026)
      assert.deepEqual(query.status.$in, ['voting', 'pending_validation'])
      return tpis
    }),
    patchMethod(Vote, 'find', (query) => ({
      select: async () => votesByTpi.get(String(query.tpiPlanning)) || []
    })),
    patchMethod(Vote, 'findUnanimousSlot', async (tpiId) => confirmedSlots.get(String(tpiId))),
    patchMethod(schedulingService, 'confirmSlotForTpi', async (tpiId, slotId) => {
      confirmedTpiIds.push(String(tpiId))
      assert.equal(slotId, confirmedSlots.get(String(tpiId)))
      return {
        success: true
      }
    })
  ]

  try {
    const result = await votingCampaignService.closeVotesCampaign(2026)

    assert.equal(result.tpiProcessed, 2)
    assert.equal(result.confirmedCount, 2)
    assert.equal(result.manualRequiredCount, 0)
    assert.deepEqual(confirmedTpiIds, ['planning-1', 'planning-2'])
    assert.deepEqual(
      result.details.map((detail) => detail.status),
      ['confirmed', 'confirmed']
    )
    assert.deepEqual(
      result.details.map((detail) => detail.allVotesIn),
      [true, true]
    )
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})
