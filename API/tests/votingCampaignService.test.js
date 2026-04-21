const test = require('node:test')
const assert = require('node:assert/strict')

const TpiPlanning = require('../models/tpiPlanningModel')
const emailService = require('../services/emailService')
const magicLinkV2Service = require('../services/magicLinkV2Service')
const votingCampaignService = require('../services/votingCampaignService')
const Vote = require('../models/voteModel')

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
  const restoreVisibility = patchMethod(planningVisibilityService, 'filterPlanifiableTpis', filterPlanifiableTpis)

  delete require.cache[servicePath]

  return {
    service: require('../services/votingCampaignService'),
    restore() {
      restoreVisibility()
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
    assert.equal(voteUpdates.length, 3)
    assert.equal(sentVoteRequests.length, 0)
    assert.equal(createdVoteLinks.length, 0)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})
