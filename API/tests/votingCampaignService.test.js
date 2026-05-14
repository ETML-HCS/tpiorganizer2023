const test = require('node:test')
const assert = require('node:assert/strict')

const TpiPlanning = require('../models/tpiCoordinationModel')
const emailService = require('../services/emailService')
const accessLinkTokenService = require('../modules/accessLinks/tokenService')
const staticVotePublicationService = require('../services/staticVotePublicationService')
const votingCampaignService = require('../services/votingCampaignService')
const Vote = require('../models/voteModel')
const schedulingService = require('../services/schedulingService')
const Person = require('../models/personModel')
const accessLinkPolicy = require('../../shared/accessLinkPolicy.json')

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
  const coordinationConfigService = require('../services/coordinationConfigService')
  const planningVisibilityService = require('../services/coordinationTpiVisibility')

  const restorePlanningConfig = patchMethod(coordinationConfigService, 'getPlanningConfig', getPlanningConfig)
  const restorePlanningConfigIfAvailable = patchMethod(coordinationConfigService, 'getPlanningConfigIfAvailable', getPlanningConfig)
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
    patchMethod(Person, 'find', (query) => {
      assert.equal(query.roles, 'admin')
      return {
        select() {
          return this
        },
        lean: async () => []
      }
    }),
    patchMethod(accessLinkTokenService, 'findReusableMagicLink', async ({ person, type, scope, sources, baseUrl }) => {
      assert.equal(type, 'soutenance')
      assert.equal(scope.publicationVersion, 4)
      assert.deepEqual(sources, ['admin_access_generated'])
      assert.equal(baseUrl, 'https://example.test')
      return {
        url: `https://example.test/magic/${person._id}`,
        expiresAt: new Date('2026-06-01T10:00:00.000Z'),
        generated: true
      }
    }),
    patchMethod(accessLinkTokenService, 'createSoutenanceMagicLink', async () => {
      throw new Error('Les liens défense doivent être réutilisés, pas générés pendant l envoi.')
    }),
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
    assert.equal(result.missingAccessLinkCount, 0)
    assert.equal(result.publicationVersion, 4)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('sendSoutenanceLinksForYear can use published rooms as recipient source', async () => {
  const sentEmails = []
  const reusableCalls = []
  const people = [
    {
      _id: 'candidate-1',
      firstName: 'Alice',
      lastName: 'Candidate',
      email: 'alice@example.com',
      sendEmails: true
    },
    {
      _id: 'expert-1',
      firstName: 'Eva',
      lastName: 'Expert',
      email: 'eva@example.com',
      sendEmails: true
    },
    {
      _id: 'expert-2',
      firstName: 'No',
      lastName: 'Mail',
      email: 'nomail@example.com',
      sendEmails: false
    },
    {
      _id: 'boss-1',
      firstName: 'Paul',
      lastName: 'Chef',
      email: 'paul@example.com',
      sendEmails: true
    }
  ]
  const publicationRooms = [
    {
      idRoom: 1,
      tpiDatas: [
        {
          candidatPersonId: 'candidate-1',
          expert1: { personId: 'expert-1' },
          expert2: { personId: 'expert-2' },
          boss: { personId: 'boss-1' }
        },
        {
          candidatPersonId: 'candidate-1',
          expert1: { personId: 'expert-1' },
          expert2: { personId: '' },
          boss: { personId: 'boss-1' }
        }
      ]
    }
  ]

  const restore = [
    patchMethod(TpiPlanning, 'find', () => {
      throw new Error('confirmed coordination recipients should not be queried')
    }),
    patchMethod(Person, 'find', (query) => {
      if (query.roles === 'admin') {
        return {
          select() {
            return this
          },
          lean: async () => []
        }
      }

      assert.deepEqual(
        [...query._id.$in].sort(),
        ['boss-1', 'candidate-1', 'expert-1', 'expert-2']
      )

      return {
        select() {
          return this
        },
        lean: async () => people
      }
    }),
    patchMethod(accessLinkTokenService, 'findReusableMagicLink', async ({ person, type, scope, sources, baseUrl }) => {
      reusableCalls.push({ personId: String(person._id), type, scope, sources, baseUrl })
      return {
        url: `https://example.test/magic/${person._id}`,
        expiresAt: new Date('2026-06-01T10:00:00.000Z'),
        generated: true
      }
    }),
    patchMethod(accessLinkTokenService, 'createSoutenanceMagicLink', async () => {
      throw new Error('Les liens défense doivent être réutilisés, pas générés pendant l envoi.')
    }),
    patchMethod(emailService, 'sendEmail', async (email) => {
      sentEmails.push(email)
      return {
        success: true
      }
    })
  ]

  try {
    const result = await votingCampaignService.sendSoutenanceLinksForYear(
      2026,
      'https://example.test',
      9,
      { publicationRooms }
    )

    assert.deepEqual(sentEmails.sort(), [
      'alice@example.com',
      'eva@example.com',
      'paul@example.com'
    ])
    assert.equal(result.recipientsCount, 3)
    assert.equal(result.emailsSent, 3)
    assert.equal(result.emailsSucceeded, 3)
    assert.equal(result.missingAccessLinkCount, 0)
    assert.equal(result.publicationVersion, 9)
    assert.deepEqual(
      reusableCalls.map(entry => `${entry.personId}:${entry.scope.publicationVersion}`).sort(),
      ['boss-1:9', 'candidate-1:9', 'expert-1:9']
    )
    assert.equal(reusableCalls.every((entry) => entry.type === 'soutenance'), true)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('sendSoutenanceLinksForYear envoie aussi les liens defense aux administrateurs actifs', async () => {
  const sentEmails = []
  const people = [
    {
      _id: 'candidate-1',
      firstName: 'Alice',
      lastName: 'Candidate',
      email: 'alice@example.com',
      roles: ['candidat'],
      sendEmails: true
    }
  ]
  const admins = [
    {
      _id: 'admin-1',
      firstName: 'Ada',
      lastName: 'Admin',
      email: 'ada.admin@example.com',
      roles: ['admin'],
      sendEmails: true
    }
  ]
  const publicationRooms = [
    {
      idRoom: 1,
      tpiDatas: [
        {
          candidatPersonId: 'candidate-1'
        }
      ]
    }
  ]

  const restore = [
    patchMethod(TpiPlanning, 'find', () => {
      throw new Error('confirmed coordination recipients should not be queried')
    }),
    patchMethod(Person, 'find', (query) => {
      return {
        select() {
          return this
        },
        lean: async () => query.roles === 'admin' ? admins : people
      }
    }),
    patchMethod(accessLinkTokenService, 'findReusableMagicLink', async ({ person }) => ({
      url: `https://example.test/defenses/2026?ml=${person._id}`,
      expiresAt: new Date('2026-06-01T10:00:00.000Z'),
      generated: true
    })),
    patchMethod(accessLinkTokenService, 'createSoutenanceMagicLink', async () => {
      throw new Error('Les liens défense doivent être réutilisés.')
    }),
    patchMethod(emailService, 'sendEmail', async (email, template, data) => {
      sentEmails.push({ email, template, roles: data.recipientRoles })
      return {
        success: true
      }
    })
  ]

  try {
    const result = await votingCampaignService.sendSoutenanceLinksForYear(
      2026,
      'https://example.test',
      9,
      { publicationRooms }
    )

    assert.deepEqual(
      sentEmails.map((entry) => entry.email).sort(),
      ['ada.admin@example.com', 'alice@example.com']
    )
    assert.deepEqual(
      sentEmails.find((entry) => entry.email === 'ada.admin@example.com').roles,
      ['admin']
    )
    assert.equal(result.recipientsCount, 2)
    assert.equal(result.emailsSent, 2)
    assert.equal(result.emailsSucceeded, 2)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('sendSoutenanceLinksForYear genere les liens defense manquants avant envoi quand demande', async () => {
  const sentEmails = []
  const createCalls = []
  const people = [
    {
      _id: 'expert-1',
      firstName: 'Eva',
      lastName: 'Expert',
      email: 'eva@example.com',
      sendEmails: true
    }
  ]
  const publicationRooms = [
    {
      idRoom: 1,
      tpiDatas: [
        {
          expert1: { personId: 'expert-1' }
        }
      ]
    }
  ]

  const restore = [
    patchMethod(TpiPlanning, 'find', () => {
      throw new Error('Les destinataires doivent venir des salles publiees.')
    }),
    patchMethod(Person, 'find', (query) => {
      if (query.roles === 'admin') {
        return {
          select() {
            return this
          },
          lean: async () => []
        }
      }

      assert.deepEqual([...query._id.$in], ['expert-1'])
      return {
        select() {
          return this
        },
        lean: async () => people
      }
    }),
    patchMethod(accessLinkTokenService, 'findReusableMagicLink', async () => null),
    patchMethod(accessLinkTokenService, 'createSoutenanceMagicLink', async (params) => {
      createCalls.push(params)
      return {
        url: `https://example.test/defenses/2026?ml=created-${createCalls.length}`,
        expiresAt: new Date('2026-06-01T10:00:00.000Z'),
        generated: true
      }
    }),
    patchMethod(emailService, 'sendEmail', async (email) => {
      sentEmails.push(email)
      return {
        success: true
      }
    })
  ]

  try {
    const result = await votingCampaignService.sendSoutenanceLinksForYear(
      2026,
      'https://example.test',
      12,
      {
        publicationRooms,
        generateMissingAccessLinks: true
      }
    )

    assert.deepEqual(sentEmails, ['eva@example.com'])
    assert.equal(createCalls.length, 1)
    assert.equal(createCalls[0].year, 2026)
    assert.equal(createCalls[0].baseUrl, 'https://example.test')
    assert.equal(createCalls[0].redirectPath, '/defenses/2026')
    assert.equal(createCalls[0].persistToken, true)
    assert.deepEqual(createCalls[0].scope, {
      kind: 'published_soutenances',
      publicationVersion: 12,
      source: accessLinkPolicy.sources.adminApp
    })
    assert.equal(result.recipientsCount, 1)
    assert.equal(result.emailsSent, 1)
    assert.equal(result.emailsSucceeded, 1)
    assert.equal(result.generatedAccessLinkCount, 1)
    assert.equal(result.missingAccessLinkCount, 0)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('sendSoutenanceLinksForYear genere les liens defense manquants meme quand les emails sont ignores', async () => {
  const sentEmails = []
  const createCalls = []
  const people = [
    {
      _id: 'expert-1',
      firstName: 'Eva',
      lastName: 'Expert',
      email: 'eva@example.com',
      sendEmails: true
    }
  ]
  const publicationRooms = [
    {
      idRoom: 1,
      tpiDatas: [
        {
          expert1: { personId: 'expert-1' }
        }
      ]
    }
  ]

  const restore = [
    patchMethod(TpiPlanning, 'find', () => {
      throw new Error('Les destinataires doivent venir des salles publiees.')
    }),
    patchMethod(Person, 'find', (query) => {
      if (query.roles === 'admin') {
        return {
          select() {
            return this
          },
          lean: async () => []
        }
      }

      assert.deepEqual([...query._id.$in], ['expert-1'])
      return {
        select() {
          return this
        },
        lean: async () => people
      }
    }),
    patchMethod(accessLinkTokenService, 'findReusableMagicLink', async () => null),
    patchMethod(accessLinkTokenService, 'createSoutenanceMagicLink', async (params) => {
      createCalls.push(params)
      return {
        url: `https://example.test/defenses/2026?ml=created-${createCalls.length}`,
        expiresAt: new Date('2026-06-01T10:00:00.000Z'),
        generated: true
      }
    }),
    patchMethod(emailService, 'sendEmail', async (email) => {
      sentEmails.push(email)
      return {
        success: true
      }
    })
  ]

  try {
    const result = await votingCampaignService.sendSoutenanceLinksForYear(
      2026,
      'https://example.test',
      12,
      {
        publicationRooms,
        generateMissingAccessLinks: true,
        skipEmails: true
      }
    )

    assert.deepEqual(sentEmails, [])
    assert.equal(createCalls.length, 1)
    assert.equal(createCalls[0].year, 2026)
    assert.equal(createCalls[0].baseUrl, 'https://example.test')
    assert.equal(createCalls[0].redirectPath, '/defenses/2026')
    assert.equal(createCalls[0].persistToken, true)
    assert.deepEqual(createCalls[0].scope, {
      kind: 'published_soutenances',
      publicationVersion: 12,
      source: accessLinkPolicy.sources.adminApp
    })
    assert.equal(result.recipientsCount, 1)
    assert.equal(result.emailsSent, 0)
    assert.equal(result.emailsSucceeded, 0)
    assert.equal(result.emailsFailed, 0)
    assert.equal(result.emailsSkipped, true)
    assert.equal(result.generatedAccessLinkCount, 1)
    assert.equal(result.missingAccessLinkCount, 0)
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
    patchMethod(Vote, 'findOneAndUpdate', async (filter, update) => {
      voteUpdates.push({ filter, update })
      return {
        _id: `vote-${voteUpdates.length}`
      }
    }),
    patchMethod(emailService, 'sendVoteRequests', async (...args) => {
      sentVoteRequests.push(args)
      return []
    }),
    patchMethod(accessLinkTokenService, 'createVoteMagicLink', async (...args) => {
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
    const expertVoteUpdate = voteUpdates.find((entry) => entry.filter.voter === 'expert-1')
    assert.deepEqual(expertVoteUpdate.filter, {
      tpiPlanning: 'planning-1',
      slot: 'slot-1',
      voter: 'expert-1'
    })
    assert.equal(expertVoteUpdate.update.$set.voterRole, 'expert1')
    assert.equal(expertVoteUpdate.update.$setOnInsert.decision, 'pending')
    assert.equal(Object.prototype.hasOwnProperty.call(expertVoteUpdate.update.$set, 'decision'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(expertVoteUpdate.update.$set, 'comment'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(expertVoteUpdate.update.$set, 'votedAt'), false)
    assert.equal(Object.prototype.hasOwnProperty.call(expertVoteUpdate.update, '$unset'), false)
    assert.equal(sentVoteRequests.length, 0)
    assert.equal(createdVoteLinks.length, 0)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('startVotesCampaign skips digest emails while automatic sends are disabled', async () => {
  const reusableVoteLinks = []
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
    patchMethod(accessLinkTokenService, 'findReusableMagicLink', async (params) => {
      reusableVoteLinks.push(params)
      return {
        url: `https://example.test/coordination/${params.year}?ml=${params.person._id}`,
        expiresAt: new Date('2026-05-01T12:00:00.000Z'),
        generated: true
      }
    }),
    patchMethod(accessLinkTokenService, 'createVoteMagicLink', async () => {
      throw new Error('Les liens de vote doivent être réutilisés, pas générés pendant la phase.')
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
    assert.equal(result.totalEmails, 0)
    assert.equal(result.successfulEmails, 0)
    assert.equal(result.emailsSkipped, true)
    assert.equal(result.emailSkipReason, 'automatic_email_sends_disabled')
    assert.equal(result.missingAccessLinkCount, 0)
    assert.equal(reusableVoteLinks.length, 0)
    assert.equal(sentDigestTargets.length, 0)
    assert.equal(sentVoteRequests.length, 0)
    assert.equal(voteUpdates.length, 6)
    assert.equal(savedTpis.length, 2)
    assert.equal(result.details[0].emailsSent, 0)
    assert.equal(result.details[1].emailsSent, 0)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('startVotesCampaign does not resolve static vote links while automatic sends are disabled', async () => {
  const reusableVoteLinks = []
  const tpi = {
    _id: 'planning-1',
    status: 'pending_slots',
    reference: 'TPI-2026-001',
    sujet: 'Sujet',
    candidat: { _id: 'candidate-1', firstName: 'Cand', lastName: 'Test' },
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
      _id: 'person-alice',
      firstName: 'Alice',
      lastName: 'Expert',
      email: 'alice@example.com',
      sendEmails: true
    },
    expert2: {
      _id: 'person-bob',
      firstName: 'Bob',
      lastName: 'Expert',
      email: 'bob@example.com',
      sendEmails: true
    },
    chefProjet: {
      _id: 'person-carla',
      firstName: 'Carla',
      lastName: 'Boss',
      email: 'carla@example.com',
      sendEmails: true
    },
    save: async () => {}
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
      accessLinkSettings: {
        defaultVoteLinkTarget: 'static',
        voteLinkValidityHours: accessLinkPolicy.defaultSettings.voteLinkValidityHours,
        voteLinkMaxUses: accessLinkPolicy.defaultSettings.voteLinkMaxUses
      }
    })
  })
  const restore = [
    restoreService,
    patchMethod(TpiPlanning, 'find', () => query),
    patchMethod(Vote, 'findOneAndUpdate', async () => ({ _id: 'vote-1' })),
    patchMethod(staticVotePublicationService, 'getStaticVoteLinkTarget', async () => ({
      baseUrl: 'https://tpi26.ch',
      redirectPath: '/votes-2026/'
    })),
    patchMethod(accessLinkTokenService, 'findReusableMagicLink', async (params) => {
      reusableVoteLinks.push(params)
      return {
        url: `https://tpi26.ch/votes-2026/?ml=${params.person._id}`,
        expiresAt: new Date('2026-05-01T12:00:00.000Z'),
        generated: true
      }
    }),
    patchMethod(accessLinkTokenService, 'createVoteMagicLink', async () => {
      throw new Error('Les liens de vote statiques doivent être réutilisés, pas générés pendant la phase.')
    }),
    patchMethod(emailService, 'sendVoteDigestRequests', async (targets) => {
      return targets.map((target) => ({
        email: target.email,
        success: true
      }))
    })
  ]

  try {
    const result = await service.startVotesCampaign(2026, 'https://example.test')

    assert.equal(result.totalEmails, 0)
    assert.equal(result.successfulEmails, 0)
    assert.equal(result.emailsSkipped, true)
    assert.equal(result.emailSkipReason, 'automatic_email_sends_disabled')
    assert.equal(reusableVoteLinks.length, 0)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('startVotesCampaign does not report missing links while automatic sends are disabled', async () => {
  const sentDigestTargets = []
  const tpi = {
    _id: 'planning-1',
    status: 'pending_slots',
    reference: 'TPI-2026-001',
    sujet: 'Sujet',
    candidat: { _id: 'candidate-1', firstName: 'Cand', lastName: 'Test' },
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
      _id: 'person-alice',
      firstName: 'Alice',
      lastName: 'Expert',
      email: 'alice@example.com',
      sendEmails: true
    },
    expert2: {
      _id: 'person-bob',
      firstName: 'Bob',
      lastName: 'Expert',
      email: 'bob@example.com',
      sendEmails: true
    },
    chefProjet: {
      _id: 'person-carla',
      firstName: 'Carla',
      lastName: 'Boss',
      email: 'carla@example.com',
      sendEmails: true
    },
    save: async () => {}
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
    patchMethod(Vote, 'findOneAndUpdate', async () => ({ _id: 'vote-1' })),
    patchMethod(accessLinkTokenService, 'findReusableMagicLink', async () => null),
    patchMethod(accessLinkTokenService, 'createVoteMagicLink', async () => {
      throw new Error('Aucun lien de secours ne doit être généré.')
    }),
    patchMethod(emailService, 'sendVoteDigestRequests', async (targets) => {
      sentDigestTargets.push(...targets)
      return []
    })
  ]

  try {
    const result = await service.startVotesCampaign(2026, 'https://example.test')

    assert.equal(result.totalEmails, 0)
    assert.equal(result.successfulEmails, 0)
    assert.equal(result.failedEmails, 0)
    assert.equal(result.emailsSkipped, true)
    assert.equal(result.emailSkipReason, 'automatic_email_sends_disabled')
    assert.equal(result.missingAccessLinkCount, 0)
    assert.equal(result.missingAccessLinks.length, 0)
    assert.equal(sentDigestTargets.length, 0)
    assert.equal(result.details[0].emailsSent, 0)
    assert.equal(result.details[0].missingAccessLinks, undefined)
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
    assert.equal(result.reason, 'automatic_email_sends_disabled')
    assert.equal(result.emailsSent, 0)
    assert.equal(tpiQueryCalled, false)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('remindPendingVotes skips automatic reminders while automatic sends are disabled', async () => {
  const sentDigestTargets = []
  const reusableVoteLinks = []
  const updates = []
  let tpiQueryCalled = false
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
    patchMethod(TpiPlanning, 'find', () => {
      tpiQueryCalled = true
      return {
        populate() {
          return this
        },
        select: async () => tpis
      }
    }),
    patchMethod(Vote, 'find', (query) => {
      assert.deepEqual(query.tpiPlanning.$in, [dueTpi._id])
      return {
        populate() {
          return this
        },
        select: async () => pendingVotes
      }
    }),
    patchMethod(accessLinkTokenService, 'findReusableMagicLink', async (params) => {
      reusableVoteLinks.push(params)
      return {
        url: `https://example.test/coordination/${params.year}?ml=${params.person._id}`,
        expiresAt: new Date('2026-04-09T00:00:00.000Z'),
        generated: true
      }
    }),
    patchMethod(accessLinkTokenService, 'createVoteMagicLink', async () => {
      throw new Error('Les liens de relance doivent être réutilisés, pas régénérés.')
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
    assert.equal(result.skipped, true)
    assert.equal(result.reason, 'automatic_email_sends_disabled')
    assert.equal(result.tpiCount, 0)
    assert.equal(result.eligibleTpiCount, 0)
    assert.equal(result.reminderTargets, 0)
    assert.equal(result.emailsSent, 0)
    assert.equal(result.emailsSucceeded, 0)
    assert.equal(tpiQueryCalled, false)
    assert.equal(reusableVoteLinks.length, 0)
    assert.equal(sentDigestTargets.length, 0)
    assert.equal(updates.length, 0)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('remindPendingVotes targets only moved requested TPI when requested', async () => {
  const sentDigestTargets = []
  const reusableVoteLinks = []
  const updates = []
  const voter = {
    _id: 'person-alice',
    firstName: 'Alice',
    lastName: 'Expert',
    email: 'alice@example.com',
    sendEmails: true
  }
  const rejectedVoter = {
    _id: 'person-bob',
    firstName: 'Bob',
    lastName: 'Expert',
    email: 'bob@example.com',
    sendEmails: true
  }

  function makeTpi(id, reference, moved = false) {
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
      votingSession: {
        deadline: new Date('2026-04-03T12:00:00.000Z'),
        remindersCount: 0,
        lastReminderSentAt: null
      },
      proposedSlots: [{ slot: 'slot-moved' }],
      history: moved
        ? [{
            action: 'planning_slot_moved_after_votes',
            details: {
              touchedRoles: ['expert1', 'expert2']
            }
          }]
        : []
    }
  }

  const movedTpi = makeTpi('planning-moved', 'TPI-2026-010', true)
  const notMovedTpi = makeTpi('planning-not-moved', 'TPI-2026-011', false)
  const movedButNotRequestedTpi = makeTpi('planning-moved-not-requested', 'TPI-2026-012', true)
  const tpis = [movedTpi, notMovedTpi, movedButNotRequestedTpi]
  const pendingVotes = [
    {
      tpiPlanning: movedTpi._id,
      voter,
      voterRole: 'expert1',
      decision: 'pending',
      slot: {
        _id: 'slot-moved',
        date: new Date('2026-06-10T08:00:00.000Z'),
        period: 'AM',
        startTime: '08:00',
        endTime: '08:45',
        room: { name: 'A101' }
      }
    },
    {
      tpiPlanning: movedTpi._id,
      voter: rejectedVoter,
      voterRole: 'expert2',
      decision: 'rejected',
      slot: {
        _id: 'slot-moved',
        date: new Date('2026-06-10T08:00:00.000Z'),
        period: 'AM',
        startTime: '08:00',
        endTime: '08:45',
        room: { name: 'A101' }
      }
    },
    {
      tpiPlanning: movedTpi._id,
      voter: {
        _id: 'person-carla',
        firstName: 'Carla',
        lastName: 'Archive',
        email: 'carla@example.com',
        sendEmails: true
      },
      voterRole: 'chef_projet',
      decision: 'rejected',
      slot: {
        _id: 'slot-archived',
        date: new Date('2026-06-09T08:00:00.000Z'),
        period: 'AM',
        startTime: '08:00',
        endTime: '08:45',
        room: { name: 'A099' }
      }
    }
  ]

  const { service, restore: restoreService } = loadVotingCampaignServiceWithPatches()
  const restore = [
    restoreService,
    patchMethod(TpiPlanning, 'find', (query) => {
      assert.deepEqual(query, { year: 2026, status: 'voting' })
      return {
        populate() {
          return this
        },
        select: async () => tpis
      }
    }),
    patchMethod(Vote, 'find', (query) => {
      assert.deepEqual(query.tpiPlanning.$in, [movedTpi._id])
      assert.deepEqual(query.decision, { $nin: ['accepted', 'preferred'] })
      return {
        populate() {
          return this
        },
        select: async () => pendingVotes
      }
    }),
    patchMethod(accessLinkTokenService, 'findReusableMagicLink', async (params) => {
      reusableVoteLinks.push(params)
      return {
        url: `https://example.test/coordination/${params.year}?ml=${params.person._id}`,
        expiresAt: new Date('2026-04-09T00:00:00.000Z'),
        generated: true
      }
    }),
    patchMethod(accessLinkTokenService, 'createVoteMagicLink', async () => {
      throw new Error('Les liens de relance doivent être réutilisés, pas régénérés.')
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
      tpiIds: [movedTpi._id, notMovedTpi._id],
      movedOnly: true,
      now: new Date('2026-04-02T00:00:00.000Z')
    })

    assert.equal(result.movedOnly, true)
    assert.equal(result.requestedTpiCount, 2)
    assert.equal(result.tpiCount, 1)
    assert.equal(result.eligibleTpiCount, 1)
    assert.equal(result.reminderTargets, 2)
    assert.equal(result.emailsSent, 2)
    assert.equal(result.emailsSucceeded, 2)
    assert.equal(reusableVoteLinks.length, 2)
    assert.equal(sentDigestTargets.length, 2)
    assert.deepEqual(
      sentDigestTargets.map((target) => target.email).sort(),
      ['alice@example.com', 'bob@example.com']
    )
    assert.deepEqual(sentDigestTargets.map((target) => target.tpiIds), [[movedTpi._id], [movedTpi._id]])
    assert.deepEqual(updates[0].filter, { _id: { $in: [movedTpi._id] } })
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
