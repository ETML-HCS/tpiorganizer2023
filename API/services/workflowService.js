const WorkflowAuditEvent = require('../models/workflowAuditEventModel')
const PlanningSnapshot = require('../models/planningSnapshotModel')
const { WorkflowYear, WORKFLOW_STATES } = require('../models/workflowYearModel')

const WORKFLOW_TRANSITIONS = Object.freeze({
  planning: ['voting_open'],
  voting_open: ['published'],
  published: []
})

class WorkflowTransitionError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'WorkflowTransitionError'
    this.statusCode = 409
    this.details = details
  }
}

function normalizeActor(user) {
  return {
    id: user?.id ? String(user.id) : null,
    email: typeof user?.email === 'string' ? user.email : null,
    roles: Array.isArray(user?.roles) ? user.roles : []
  }
}

function getAllowedTransitions(state) {
  return WORKFLOW_TRANSITIONS[state] || []
}

function isWorkflowState(value) {
  return typeof value === 'string' && WORKFLOW_STATES.includes(value)
}

function isTransitionAllowed(from, to) {
  return getAllowedTransitions(from).includes(to)
}

function toPublicWorkflow(workflow) {
  return {
    year: workflow.year,
    state: workflow.state,
    allowedTransitions: getAllowedTransitions(workflow.state),
    planningAt: workflow.planningAt,
    votingOpenedAt: workflow.votingOpenedAt,
    publishedAt: workflow.publishedAt,
    lastTransitionAt: workflow.lastTransitionAt,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt
  }
}

async function writeAuditEvent({
  year,
  action,
  user,
  payload = {},
  success = true,
  error = null
}) {
  try {
    await WorkflowAuditEvent.create({
      year,
      action,
      success,
      actor: normalizeActor(user),
      payload,
      error
    })
  } catch (auditError) {
    console.error('Erreur ecriture audit workflow:', auditError)
  }
}

async function hasActivePlanningSnapshot(year) {
  const snapshot = await PlanningSnapshot.findOne({ year, isActive: true })
    .select('_id version hash frozenAt')
    .lean()

  return snapshot || null
}

async function getOrCreateWorkflow(year) {
  const existing = await WorkflowYear.findOne({ year })
  if (existing) {
    return existing
  }

  const now = new Date()

  try {
    return await WorkflowYear.create({
      year,
      state: 'planning',
      planningAt: now,
      lastTransitionAt: now
    })
  } catch (error) {
    if (error?.code === 11000) {
      const conflicted = await WorkflowYear.findOne({ year })
      if (conflicted) {
        return conflicted
      }
    }

    throw error
  }
}

async function getWorkflowYearState(year) {
  const workflow = await getOrCreateWorkflow(year)
  return toPublicWorkflow(workflow)
}

async function transitionWorkflowYear({ year, targetState, user }) {
  if (!isWorkflowState(targetState)) {
    throw new Error('Etat workflow invalide.')
  }

  const workflow = await getOrCreateWorkflow(year)
  const currentState = workflow.state

  if (currentState === targetState) {
    return {
      changed: false,
      workflow: toPublicWorkflow(workflow)
    }
  }

  if (!isTransitionAllowed(currentState, targetState)) {
    const error = new WorkflowTransitionError('Transition workflow invalide.', {
      currentState,
      targetState,
      allowedTransitions: getAllowedTransitions(currentState)
    })
    throw error
  }

  const now = new Date()

  if (targetState === 'voting_open') {
    const activeSnapshot = await hasActivePlanningSnapshot(year)
    if (!activeSnapshot) {
      const error = new WorkflowTransitionError(
        'Impossible d\'ouvrir le vote sans snapshot gele.',
        {
          currentState,
          targetState,
          allowedTransitions: getAllowedTransitions(currentState),
          reason: 'missing_planning_snapshot'
        }
      )
      throw error
    }
  }

  workflow.state = targetState
  workflow.lastTransitionAt = now

  if (targetState === 'voting_open' && !workflow.votingOpenedAt) {
    workflow.votingOpenedAt = now
  }

  if (targetState === 'published' && !workflow.publishedAt) {
    workflow.publishedAt = now
  }

  workflow.transitions.push({
    from: currentState,
    to: targetState,
    actorId: user?.id ? String(user.id) : null,
    actorEmail: typeof user?.email === 'string' ? user.email : null,
    at: now
  })

  await workflow.save()

  await writeAuditEvent({
    year,
    action: 'workflow.transition',
    user,
    payload: {
      from: currentState,
      to: targetState
    },
    success: true
  })

  return {
    changed: true,
    workflow: toPublicWorkflow(workflow)
  }
}

async function safeAuditTransitionFailure({ year, user, targetState, error }) {
  const currentState =
    error?.details?.currentState ||
    null

  await writeAuditEvent({
    year,
    action: 'workflow.transition',
    user,
    payload: {
      from: currentState,
      to: targetState
    },
    success: false,
    error: error?.message || 'Transition invalide'
  })
}

async function listWorkflowAuditEvents(year, limit = 100) {
  const normalizedLimit = Number.isInteger(limit)
    ? Math.max(1, Math.min(limit, 500))
    : 100

  return await WorkflowAuditEvent.find({ year })
    .sort({ createdAt: -1 })
    .limit(normalizedLimit)
    .lean()
}

module.exports = {
  WORKFLOW_STATES,
  WORKFLOW_TRANSITIONS,
  WorkflowTransitionError,
  getAllowedTransitions,
  isTransitionAllowed,
  isWorkflowState,
  getWorkflowYearState,
  transitionWorkflowYear,
  safeAuditTransitionFailure,
  listWorkflowAuditEvents,
  logWorkflowAuditEvent: writeAuditEvent,
  hasActivePlanningSnapshot
}
