const test = require('node:test')
const assert = require('node:assert/strict')

const WorkflowAuditEvent = require('../models/workflowAuditEventModel')
const PlanningSnapshot = require('../models/planningSnapshotModel')
const { WorkflowYear } = require('../models/workflowYearModel')
const workflowService = require('../services/workflowService')

function patchMethod(target, key, implementation) {
  const original = target[key]
  target[key] = implementation
  return () => {
    target[key] = original
  }
}

test('workflow states list includes expected states', () => {
  assert.deepEqual(
    workflowService.WORKFLOW_STATES,
    ['planning', 'voting_open', 'published']
  )
})

test('transition matrix allows only forward workflow', () => {
  assert.equal(workflowService.isTransitionAllowed('planning', 'voting_open'), true)
  assert.equal(workflowService.isTransitionAllowed('voting_open', 'published'), true)

  assert.equal(workflowService.isTransitionAllowed('planning', 'published'), false)
  assert.equal(workflowService.isTransitionAllowed('published', 'planning'), false)
  assert.equal(workflowService.isTransitionAllowed('published', 'voting_open'), false)
})

test('isWorkflowState validates allowed values only', () => {
  assert.equal(workflowService.isWorkflowState('planning'), true)
  assert.equal(workflowService.isWorkflowState('voting_open'), true)
  assert.equal(workflowService.isWorkflowState('published'), true)

  assert.equal(workflowService.isWorkflowState('draft'), false)
  assert.equal(workflowService.isWorkflowState(''), false)
  assert.equal(workflowService.isWorkflowState(null), false)
})

test('transitionWorkflowYear blocks vote opening without active planning snapshot', async () => {
  const workflow = {
    year: 2026,
    state: 'planning',
    planningAt: new Date('2026-01-10T08:00:00.000Z'),
    votingOpenedAt: null,
    publishedAt: null,
    lastTransitionAt: new Date('2026-01-10T08:00:00.000Z'),
    createdAt: new Date('2026-01-10T08:00:00.000Z'),
    updatedAt: new Date('2026-01-10T08:00:00.000Z'),
    transitions: [],
    save: async function save() {
      return this
    }
  }

  const restore = [
    patchMethod(WorkflowYear, 'findOne', async () => workflow),
    patchMethod(PlanningSnapshot, 'findOne', () => ({
      select() {
        return {
          lean: async () => null
        }
      }
    }))
  ]

  try {
    await assert.rejects(
      () => workflowService.transitionWorkflowYear({
        year: 2026,
        targetState: 'voting_open',
        user: { id: 'admin-1', email: 'admin@example.com', roles: ['admin'] }
      }),
      (error) => {
        assert.equal(error.name, 'WorkflowTransitionError')
        assert.equal(error.details.reason, 'missing_planning_snapshot')
        assert.equal(error.details.currentState, 'planning')
        assert.equal(error.details.targetState, 'voting_open')
        return true
      }
    )
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('transitionWorkflowYear records the transition and audit metadata on success', async () => {
  const workflow = {
    year: 2026,
    state: 'planning',
    planningAt: new Date('2026-01-10T08:00:00.000Z'),
    votingOpenedAt: null,
    publishedAt: null,
    lastTransitionAt: new Date('2026-01-10T08:00:00.000Z'),
    createdAt: new Date('2026-01-10T08:00:00.000Z'),
    updatedAt: new Date('2026-01-10T08:00:00.000Z'),
    transitions: [],
    save: async function save() {
      return this
    }
  }
  const auditEvents = []

  const restore = [
    patchMethod(WorkflowYear, 'findOne', async () => workflow),
    patchMethod(PlanningSnapshot, 'findOne', () => ({
      select() {
        return {
          lean: async () => ({
            _id: 'snapshot-1',
            version: 3,
            hash: 'hash-123',
            frozenAt: new Date('2026-03-10T12:00:00.000Z')
          })
        }
      }
    })),
    patchMethod(WorkflowAuditEvent, 'create', async (payload) => {
      auditEvents.push(payload)
      return payload
    })
  ]

  try {
    const result = await workflowService.transitionWorkflowYear({
      year: 2026,
      targetState: 'voting_open',
      user: { id: 'admin-1', email: 'admin@example.com', roles: ['admin'] }
    })

    assert.equal(result.changed, true)
    assert.equal(result.workflow.state, 'voting_open')
    assert.deepEqual(result.workflow.allowedTransitions, ['published'])
    assert.ok(workflow.votingOpenedAt instanceof Date)
    assert.ok(workflow.lastTransitionAt instanceof Date)
    assert.equal(workflow.transitions.length, 1)
    assert.equal(workflow.transitions[0].from, 'planning')
    assert.equal(workflow.transitions[0].to, 'voting_open')
    assert.equal(workflow.transitions[0].actorId, 'admin-1')
    assert.equal(workflow.transitions[0].actorEmail, 'admin@example.com')
    assert.equal(auditEvents.length, 1)
    assert.equal(auditEvents[0].action, 'workflow.transition')
    assert.deepEqual(auditEvents[0].payload, {
      from: 'planning',
      to: 'voting_open'
    })
    assert.equal(auditEvents[0].success, true)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})
