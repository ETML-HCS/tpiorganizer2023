const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')

const TpiPlanning = require('../models/tpiPlanningModel')
const Slot = require('../models/slotModel')
const Vote = require('../models/voteModel')
const {
  ResolutionProposal
} = require('../models/resolutionProposalModel')
const emailService = require('../services/emailService')
const resolutionProposalService = require('../services/resolutionProposalService')
const { makeQueryResult, withStubSandbox } = require('./helpers/stubSandbox')

function buildPerson(firstName, lastName, email) {
  return {
    _id: new mongoose.Types.ObjectId(),
    firstName,
    lastName,
    email,
    sendEmails: true
  }
}

async function withDebugEnv(run) {
  const previousNodeEnv = process.env.NODE_ENV
  const previousDebug = process.env.REACT_APP_DEBUG

  process.env.NODE_ENV = 'development'
  process.env.REACT_APP_DEBUG = 'true'

  try {
    return await run()
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = previousNodeEnv
    }

    if (previousDebug === undefined) {
      delete process.env.REACT_APP_DEBUG
    } else {
      process.env.REACT_APP_DEBUG = previousDebug
    }
  }
}

test('createResolutionProposal envoie une proposition aux rôles concernés', async () => {
  await withStubSandbox(async (sandbox) => {
    const tpiId = new mongoose.Types.ObjectId()
    const slotId = new mongoose.Types.ObjectId()
    const tpi = {
      _id: tpiId,
      year: 2026,
      reference: 'TPI-2026-001',
      status: 'voting',
      sujet: 'Sujet test',
      candidat: buildPerson('Camille', 'Test', 'candidate@example.com'),
      expert1: buildPerson('Alice', 'Expert', 'alice@example.com'),
      expert2: buildPerson('Benoit', 'Expert', 'benoit@example.com'),
      chefProjet: buildPerson('Claire', 'Projet', 'claire@example.com'),
      proposedSlots: [{ slot: slotId }]
    }
    const slot = {
      _id: slotId,
      date: new Date('2026-06-15T00:00:00.000Z'),
      period: 'morning',
      startTime: '08:30',
      endTime: '11:30',
      room: { name: 'A101', site: 'Site A' }
    }
    const sentEmails = []
    let createdPayload = null

    sandbox.replace(TpiPlanning, 'findById', () => makeQueryResult(tpi))
    sandbox.replace(Slot, 'findById', () => makeQueryResult(slot))
    sandbox.replace(ResolutionProposal, 'create', async (payload) => {
      createdPayload = payload
      return {
        _id: new mongoose.Types.ObjectId(),
        ...payload,
        recipients: payload.recipients.map((recipient) => ({ ...recipient })),
        save: async function save() {
          return this
        }
      }
    })
    sandbox.replace(emailService, 'sendEmail', async (email, template, data) => {
      sentEmails.push({ email, template, data })
      return { success: true }
    })

    const result = await resolutionProposalService.createResolutionProposal({
      tpiId,
      slotId,
      message: 'Merci de confirmer.',
      baseUrl: 'https://example.test',
      emailSettings: {}
    })

    assert.equal(result.status, 'sent')
    assert.equal(result.tpiReference, 'TPI-2026-001')
    assert.equal(result.proposedSlotId, String(slotId))
    assert.match(result.proposedSlotLabel, /15\.06\.2026/)
    assert.equal(createdPayload.recipients.length, 3)
    assert.match(createdPayload.recipients[0].publicUrl, /^https:\/\/example\.test\/arbitrage-2026\//)
    assert.equal(sentEmails.length, 3)
    assert.equal(sentEmails[0].template, 'resolutionProposal')
    assert.match(sentEmails[0].data.magicLinkUrl, /^https:\/\/example\.test\/arbitrage-2026\//)
    assert.equal(result.recipients[0].publicUrl, sentEmails[0].data.magicLinkUrl)
  })
})

test('createResolutionProposal peut cibler le mini-site vote pour l arbitrage', async () => {
  const previousSecret = process.env.STATIC_VOTE_ARBITRAGE_SECRET
  process.env.STATIC_VOTE_ARBITRAGE_SECRET = 'static-arbitrage-secret'

  try {
    await withStubSandbox(async (sandbox) => {
      const tpiId = new mongoose.Types.ObjectId()
      const slotId = new mongoose.Types.ObjectId()
      const tpi = {
        _id: tpiId,
        year: 2026,
        reference: 'TPI-2026-STATIC',
        status: 'voting',
        sujet: 'Sujet statique',
        candidat: buildPerson('Camille', 'Test', 'candidate@example.com'),
        expert1: buildPerson('Alice', 'Expert', 'alice@example.com'),
        expert2: buildPerson('Benoit', 'Expert', 'benoit@example.com'),
        chefProjet: buildPerson('Claire', 'Projet', 'claire@example.com'),
        proposedSlots: [{ slot: slotId }]
      }
      const slot = {
        _id: slotId,
        date: new Date('2026-06-15T00:00:00.000Z'),
        period: 'morning',
        room: { name: 'A101' }
      }
      const sentEmails = []

      sandbox.replace(TpiPlanning, 'findById', () => makeQueryResult(tpi))
      sandbox.replace(Slot, 'findById', () => makeQueryResult(slot))
      sandbox.replace(ResolutionProposal, 'create', async (payload) => ({
        _id: new mongoose.Types.ObjectId(),
        ...payload,
        recipients: payload.recipients.map((recipient) => ({ ...recipient })),
        save: async function save() {
          return this
        }
      }))
      sandbox.replace(emailService, 'sendEmail', async (email, template, data) => {
        sentEmails.push({ email, template, data })
        return { success: true }
      })

      const result = await resolutionProposalService.createResolutionProposal({
        tpiId,
        slotId,
        baseUrl: 'https://tpi26.ch/votes-2026/',
        linkTarget: 'staticVote',
        emailSettings: {}
      })

      assert.match(result.recipients[0].publicUrl, /^https:\/\/tpi26\.ch\/votes-2026\/arbitrage\.php\?token=svra\./)
      assert.equal(result.recipients[0].publicUrl, sentEmails[0].data.magicLinkUrl)
    })
  } finally {
    if (previousSecret === undefined) {
      delete process.env.STATIC_VOTE_ARBITRAGE_SECRET
    } else {
      process.env.STATIC_VOTE_ARBITRAGE_SECRET = previousSecret
    }
  }
})

test('createResolutionProposal en mode DEV génère les liens sans envoyer d email', async () => {
  await withDebugEnv(async () => {
    await withStubSandbox(async (sandbox) => {
      const tpiId = new mongoose.Types.ObjectId()
      const slotId = new mongoose.Types.ObjectId()
      const tpi = {
        _id: tpiId,
        year: 2026,
        reference: 'TPI-2026-DEV',
        status: 'voting',
        sujet: 'Sujet test',
        candidat: buildPerson('Camille', 'Test', 'candidate@example.com'),
        expert1: buildPerson('Alice', 'Expert', ''),
        expert2: buildPerson('Benoit', 'Expert', 'benoit@example.com'),
        chefProjet: buildPerson('Claire', 'Projet', 'claire@example.com'),
        proposedSlots: [{ slot: slotId }]
      }
      const slot = {
        _id: slotId,
        date: new Date('2026-06-15T00:00:00.000Z'),
        period: 'morning',
        room: { name: 'A101', site: 'Site A' }
      }
      let emailCallCount = 0

      sandbox.replace(TpiPlanning, 'findById', () => makeQueryResult(tpi))
      sandbox.replace(Slot, 'findById', () => makeQueryResult(slot))
      sandbox.replace(ResolutionProposal, 'create', async (payload) => ({
        _id: new mongoose.Types.ObjectId(),
        ...payload,
        recipients: payload.recipients.map((recipient) => ({ ...recipient })),
        save: async function save() {
          return this
        }
      }))
      sandbox.replace(emailService, 'sendEmail', async () => {
        emailCallCount += 1
        return { success: true }
      })

      const result = await resolutionProposalService.createResolutionProposal({
        tpiId,
        slotId,
        baseUrl: 'https://example.test',
        devMode: true
      })

      assert.equal(result.devMode, true)
      assert.equal(emailCallCount, 0)
      assert.equal(result.devLinks.length, 3)
      assert.match(result.devLinks[0].url, /^https:\/\/example\.test\/arbitrage-2026\//)
      assert.equal(result.recipients[0].publicUrl, result.devLinks[0].url)
      assert.equal(result.recipients[0].deliveryStatus, 'skipped')
      assert.match(result.recipients[0].deliveryError, /Mode DEV/)
    })
  })
})

test('createResolutionProposal refuse le mode DEV hors debug', async () => {
  const previousNodeEnv = process.env.NODE_ENV
  const previousDebug = process.env.REACT_APP_DEBUG
  process.env.NODE_ENV = 'production'
  process.env.REACT_APP_DEBUG = 'false'

  try {
    await assert.rejects(
      () => resolutionProposalService.createResolutionProposal({
        tpiId: new mongoose.Types.ObjectId(),
        slotId: new mongoose.Types.ObjectId(),
        devMode: true
      }),
      /Mode DEV indisponible/
    )
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = previousNodeEnv
    }

    if (previousDebug === undefined) {
      delete process.env.REACT_APP_DEBUG
    } else {
      process.env.REACT_APP_DEBUG = previousDebug
    }
  }
})

test('createResolutionProposal refuse un créneau hors options votées', async () => {
  await withStubSandbox(async (sandbox) => {
    const tpiId = new mongoose.Types.ObjectId()
    const slotId = new mongoose.Types.ObjectId()
    const tpi = {
      _id: tpiId,
      year: 2026,
      reference: 'TPI-2026-003',
      status: 'voting',
      candidat: buildPerson('Camille', 'Test', 'candidate@example.com'),
      expert1: buildPerson('Alice', 'Expert', 'alice@example.com'),
      expert2: buildPerson('Benoit', 'Expert', 'benoit@example.com'),
      chefProjet: buildPerson('Claire', 'Projet', 'claire@example.com'),
      proposedSlots: []
    }
    const slot = {
      _id: slotId,
      date: new Date('2026-06-15T00:00:00.000Z'),
      period: 'morning',
      room: { name: 'A101' }
    }

    sandbox.replace(TpiPlanning, 'findById', () => makeQueryResult(tpi))
    sandbox.replace(Slot, 'findById', () => makeQueryResult(slot))
    sandbox.replace(Vote, 'exists', () => makeQueryResult(null))

    await assert.rejects(
      () => resolutionProposalService.createResolutionProposal({
        tpiId,
        slotId,
        baseUrl: 'https://example.test'
      }),
      /ne fait pas partie des options votées/
    )
  })
})

test('createResolutionProposal signale un échec email avant de marquer transmis', async () => {
  await withStubSandbox(async (sandbox) => {
    const tpiId = new mongoose.Types.ObjectId()
    const slotId = new mongoose.Types.ObjectId()
    const tpi = {
      _id: tpiId,
      year: 2026,
      reference: 'TPI-2026-004',
      status: 'voting',
      candidat: buildPerson('Camille', 'Test', 'candidate@example.com'),
      expert1: buildPerson('Alice', 'Expert', 'alice@example.com'),
      expert2: buildPerson('Benoit', 'Expert', 'benoit@example.com'),
      chefProjet: buildPerson('Claire', 'Projet', 'claire@example.com'),
      proposedSlots: [{ slot: slotId }]
    }
    const slot = {
      _id: slotId,
      date: new Date('2026-06-15T00:00:00.000Z'),
      period: 'morning',
      room: { name: 'A101' }
    }
    const proposal = {
      _id: new mongoose.Types.ObjectId(),
      recipients: [],
      saveCalls: 0,
      save: async function save() {
        this.saveCalls += 1
        return this
      }
    }

    sandbox.replace(TpiPlanning, 'findById', () => makeQueryResult(tpi))
    sandbox.replace(Slot, 'findById', () => makeQueryResult(slot))
    sandbox.replace(ResolutionProposal, 'create', async (payload) => {
      Object.assign(proposal, {
        ...payload,
        recipients: payload.recipients.map((recipient) => ({ ...recipient }))
      })
      return proposal
    })
    sandbox.replace(emailService, 'sendEmail', async () => ({
      success: false,
      error: 'SMTP indisponible'
    }))

    await assert.rejects(
      () => resolutionProposalService.createResolutionProposal({
        tpiId,
        slotId,
        baseUrl: 'https://example.test'
      }),
      /Envoi impossible pour/
    )

    assert.equal(proposal.status, 'failed')
    assert.equal(proposal.saveCalls, 1)
  })
})

test('respondToResolutionProposal enregistre accord ou refuse sans raison', async () => {
  await withStubSandbox(async (sandbox) => {
    const token = 'public-token'
    const tokenHash = resolutionProposalService.hashToken(token)
    const proposal = {
      _id: new mongoose.Types.ObjectId(),
      year: 2026,
      tpiPlanning: new mongoose.Types.ObjectId(),
      tpiReference: 'TPI-2026-002',
      candidateName: 'Camille Test',
      subject: 'Sujet test',
      proposedSlot: new mongoose.Types.ObjectId(),
      proposedSlotSnapshot: { label: '15.06.2026 · Matin · A101' },
      status: 'sent',
      recipients: [{
        role: 'expert1',
        name: 'Alice Expert',
        email: 'alice@example.com',
        tokenHash,
        responseStatus: 'pending'
      }],
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: new Date(),
      sentAt: new Date(),
      save: async function save() {
        return this
      }
    }

    sandbox.replace(ResolutionProposal, 'findOne', () => makeQueryResult(proposal))

    await assert.rejects(
      () => resolutionProposalService.respondToResolutionProposal(token, {
        decision: 'rejected'
      }),
      /Une raison est requise/
    )

    const result = await resolutionProposalService.respondToResolutionProposal(token, {
      decision: 'accepted'
    })

    assert.equal(result.status, 'accepted')
    assert.equal(result.recipient.responseStatus, 'accepted')
    assert.equal(result.recipients.length, 0)
    assert.ok(proposal.recipients[0].respondedAt)
  })
})

test('respondToResolutionProposal ne permet pas de modifier une réponse enregistrée', async () => {
  await withStubSandbox(async (sandbox) => {
    const token = 'public-token-answered'
    const tokenHash = resolutionProposalService.hashToken(token)
    const proposal = {
      _id: new mongoose.Types.ObjectId(),
      year: 2026,
      tpiPlanning: new mongoose.Types.ObjectId(),
      tpiReference: 'TPI-2026-005',
      candidateName: 'Camille Test',
      subject: 'Sujet test',
      proposedSlot: new mongoose.Types.ObjectId(),
      proposedSlotSnapshot: { label: '15.06.2026 · Matin · A101' },
      status: 'partial',
      recipients: [{
        role: 'expert1',
        name: 'Alice Expert',
        email: 'alice@example.com',
        tokenHash,
        responseStatus: 'accepted',
        respondedAt: new Date()
      }],
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdAt: new Date(),
      sentAt: new Date(),
      save: async function save() {
        throw new Error('save should not be called')
      }
    }

    sandbox.replace(ResolutionProposal, 'findOne', () => makeQueryResult(proposal))

    const idempotentResult = await resolutionProposalService.respondToResolutionProposal(token, {
      decision: 'accepted'
    })

    assert.equal(idempotentResult.recipient.responseStatus, 'accepted')

    await assert.rejects(
      () => resolutionProposalService.respondToResolutionProposal(token, {
        decision: 'rejected',
        reason: 'Finalement non'
      }),
      /Réponse déjà enregistrée/
    )
  })
})
