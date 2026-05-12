const test = require('node:test')
const assert = require('node:assert/strict')

const WorkflowAuditEvent = require('../models/workflowAuditEventModel')
const { WorkflowYear } = require('../models/workflowYearModel')
const PlanningSnapshot = require('../models/coordinationSnapshotModel')
const TpiPlanning = require('../models/tpiCoordinationModel')
const Slot = require('../models/slotModel')
const Vote = require('../models/voteModel')
const PublicationVersion = require('../models/publicationVersionModel')
const { MagicLink } = require('../models/magicLinkModel')
const { AccessLinkLog } = require('../models/accessLinkLogModel')
const { PublicationChangeNotification } = require('../models/publicationChangeNotificationModel')
const workflowService = require('../services/workflowService')

function patchMethod(target, key, implementation) {
  const original = target[key]
  target[key] = implementation
  return () => {
    target[key] = original
  }
}

function makeLeanQuery(value) {
  return {
    select() {
      return this
    },
    lean: async () => value
  }
}

test('workflow phases list includes independent admin phases', () => {
  assert.deepEqual(
    workflowService.WORKFLOW_PHASES,
    ['planning', 'votes', 'arbitrage', 'defenses']
  )
})

test('normalizes legacy state names to phases', () => {
  assert.equal(workflowService.normalizeWorkflowPhase('planning'), 'planning')
  assert.equal(workflowService.normalizeWorkflowPhase('voting_open'), 'votes')
  assert.equal(workflowService.normalizeWorkflowPhase('published'), 'defenses')
  assert.equal(workflowService.normalizeWorkflowPhase('arbitrage'), 'arbitrage')
  assert.equal(workflowService.isWorkflowPhase('draft'), false)
})

test('setWorkflowPhaseActive activates one phase without disabling others', async () => {
  const workflow = {
    year: 2026,
    state: 'planning',
    activePhases: ['planning'],
    planningAt: new Date('2026-01-10T08:00:00.000Z'),
    votingOpenedAt: null,
    arbitrageOpenedAt: null,
    publishedAt: null,
    lastPhaseChangeAt: new Date('2026-01-10T08:00:00.000Z'),
    createdAt: new Date('2026-01-10T08:00:00.000Z'),
    updatedAt: new Date('2026-01-10T08:00:00.000Z'),
    phaseEvents: [],
    save: async function save() {
      return this
    }
  }
  const auditEvents = []

  const restore = [
    patchMethod(WorkflowYear, 'findOne', async () => workflow),
    patchMethod(WorkflowAuditEvent, 'create', async (payload) => {
      auditEvents.push(payload)
      return payload
    })
  ]

  try {
    const result = await workflowService.setWorkflowPhaseActive({
      year: 2026,
      phase: 'votes',
      active: true,
      user: { id: 'admin-1', email: 'admin@example.com', roles: ['admin'] },
      reason: 'Ouverture admin'
    })

    assert.equal(result.changed, true)
    assert.equal(result.workflow.state, 'voting_open')
    assert.deepEqual(result.workflow.activePhases, ['planning', 'votes'])
    assert.equal(result.workflow.phases.planning.active, true)
    assert.equal(result.workflow.phases.votes.active, true)
    assert.ok(workflow.votingOpenedAt instanceof Date)
    assert.equal(workflow.phaseEvents.length, 1)
    assert.equal(workflow.phaseEvents[0].phase, 'votes')
    assert.equal(workflow.phaseEvents[0].active, true)
    assert.equal(auditEvents.length, 1)
    assert.equal(auditEvents[0].action, 'workflow.phase.toggle')
    assert.deepEqual(auditEvents[0].payload.activePhases, ['planning', 'votes'])
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('setWorkflowPhaseActive deactivates a phase while leaving the rest active', async () => {
  const workflow = {
    year: 2026,
    state: 'published',
    activePhases: ['votes', 'defenses'],
    planningAt: new Date('2026-01-10T08:00:00.000Z'),
    votingOpenedAt: new Date('2026-03-15T08:00:00.000Z'),
    arbitrageOpenedAt: null,
    publishedAt: new Date('2026-04-20T08:00:00.000Z'),
    lastPhaseChangeAt: new Date('2026-04-20T08:00:00.000Z'),
    createdAt: new Date('2026-01-10T08:00:00.000Z'),
    updatedAt: new Date('2026-04-20T08:00:00.000Z'),
    phaseEvents: [],
    save: async function save() {
      return this
    }
  }

  const restore = [
    patchMethod(WorkflowYear, 'findOne', async () => workflow),
    patchMethod(WorkflowAuditEvent, 'create', async (payload) => payload)
  ]

  try {
    const result = await workflowService.setWorkflowPhaseActive({
      year: 2026,
      phase: 'defenses',
      active: false,
      user: { id: 'admin-2', email: 'admin2@example.com', roles: ['admin'] }
    })

    assert.equal(result.changed, true)
    assert.deepEqual(result.workflow.activePhases, ['votes'])
    assert.equal(result.workflow.state, 'voting_open')
    assert.equal(result.workflow.phases.defenses.active, false)
    assert.equal(result.workflow.phases.votes.active, true)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('resetWorkflowYear deletes publication change notification records', async () => {
  const deleteCalls = []
  const restore = [
    patchMethod(TpiPlanning, 'find', () => makeLeanQuery([])),
    patchMethod(Slot, 'find', () => makeLeanQuery([])),
    patchMethod(Vote, 'deleteMany', async (query) => {
      deleteCalls.push({ collection: 'votes', query })
      return { deletedCount: 0 }
    }),
    patchMethod(Slot, 'deleteMany', async (query) => {
      deleteCalls.push({ collection: 'slots', query })
      return { deletedCount: 1 }
    }),
    patchMethod(TpiPlanning, 'deleteMany', async (query) => {
      deleteCalls.push({ collection: 'tpiPlannings', query })
      return { deletedCount: 2 }
    }),
    patchMethod(PlanningSnapshot, 'deleteMany', async (query) => {
      deleteCalls.push({ collection: 'planningSnapshots', query })
      return { deletedCount: 3 }
    }),
    patchMethod(PublicationVersion, 'deleteMany', async (query) => {
      deleteCalls.push({ collection: 'publicationVersions', query })
      return { deletedCount: 4 }
    }),
    patchMethod(MagicLink, 'deleteMany', async (query) => {
      deleteCalls.push({ collection: 'magicLinks', query })
      return { deletedCount: 5 }
    }),
    patchMethod(PublicationChangeNotification, 'deleteMany', async (query) => {
      deleteCalls.push({ collection: 'publicationChangeNotifications', query })
      return { deletedCount: 6 }
    }),
    patchMethod(AccessLinkLog, 'deleteMany', async (query) => {
      deleteCalls.push({ collection: 'accessLinkLogs', query })
      return { deletedCount: 7 }
    }),
    patchMethod(WorkflowYear, 'deleteMany', async (query) => {
      deleteCalls.push({ collection: 'workflowYears', query })
      return { deletedCount: 8 }
    }),
    patchMethod(WorkflowAuditEvent, 'create', async (payload) => payload)
  ]

  try {
    const result = await workflowService.resetWorkflowYear({
      year: 2026,
      user: { id: 'admin-1', email: 'admin@example.test', roles: ['admin'] }
    })

    assert.equal(result.deleted.publicationChangeNotifications, 6)
    assert.ok(deleteCalls.some((call) =>
      call.collection === 'publicationChangeNotifications' &&
      call.query.year === 2026
    ))
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})
