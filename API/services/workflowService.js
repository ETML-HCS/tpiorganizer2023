const mongoose = require('mongoose')

const WorkflowAuditEvent = require('../models/workflowAuditEventModel')
const PlanningSnapshot = require('../models/planningSnapshotModel')
const { WorkflowYear, WORKFLOW_STATES } = require('../models/workflowYearModel')
const TpiPlanning = require('../models/tpiPlanningModel')
const Slot = require('../models/slotModel')
const Vote = require('../models/voteModel')
const PublicationVersion = require('../models/publicationVersionModel')
const { MagicLink } = require('../models/magicLinkModel')

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

function isTransitionAllowed(from, to, options = {}) {
  if (options?.allowDirectPublication === true && from === 'planning' && to === 'published') {
    return true
  }

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

async function transitionWorkflowYear({
  year,
  targetState,
  user,
  allowDirectPublication = false
}) {
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

  if (!isTransitionAllowed(currentState, targetState, { allowDirectPublication })) {
    const error = new WorkflowTransitionError('Transition workflow invalide.', {
      currentState,
      targetState,
      allowedTransitions: getAllowedTransitions(currentState)
    })
    throw error
  }

  const now = new Date()

  if (targetState === 'voting_open' || (targetState === 'published' && currentState === 'planning')) {
    const activeSnapshot = await hasActivePlanningSnapshot(year)
    if (!activeSnapshot) {
      const error = new WorkflowTransitionError(
        targetState === 'published'
          ? 'Impossible de publier sans snapshot gele.'
          : 'Impossible d\'ouvrir le vote sans snapshot gele.',
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

async function clearCollectionIfExists(collectionName) {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return {
      collection: collectionName,
      existed: false,
      deletedCount: 0,
      skipped: true
    }
  }

  const exists = await mongoose.connection.db
    .listCollections({ name: collectionName })
    .hasNext()

  if (!exists) {
    return {
      collection: collectionName,
      existed: false,
      deletedCount: 0,
      skipped: false
    }
  }

  const collection = mongoose.connection.db.collection(collectionName)
  const result = await collection.deleteMany({})

  return {
    collection: collectionName,
    existed: true,
    deletedCount: result.deletedCount || 0,
    skipped: false
  }
}

async function resetWorkflowYear({ year, user }) {
  const tpis = await TpiPlanning.find({ year })
    .select('_id')
    .lean()
  const tpiIds = tpis.map(tpi => tpi._id)
  const slots = await Slot.find({ year })
    .select('_id')
    .lean()
  const slotIds = slots.map(slot => slot._id)
  const voteFilters = []

  if (tpiIds.length > 0) {
    voteFilters.push({ tpiPlanning: { $in: tpiIds } })
  }

  if (slotIds.length > 0) {
    voteFilters.push({ slot: { $in: slotIds } })
  }

  const votesResult = voteFilters.length > 0
    ? await Vote.deleteMany({ $or: voteFilters })
    : { deletedCount: 0 }
  const slotsResult = await Slot.deleteMany({ year })
  const tpiPlanningResult = await TpiPlanning.deleteMany({ year })
  const snapshotsResult = await PlanningSnapshot.deleteMany({ year })
  const publicationVersionsResult = await PublicationVersion.deleteMany({ year })
  const magicLinksResult = await MagicLink.deleteMany({ year })
  const workflowYearsResult = await WorkflowYear.deleteMany({ year })
  const legacyCollections = await Promise.all([
    clearCollectionIfExists(`tpiRooms_${year}`),
    clearCollectionIfExists(`tpiSoutenance_${year}`)
  ])

  const deleted = {
    votes: votesResult.deletedCount || 0,
    slots: slotsResult.deletedCount || 0,
    tpiPlannings: tpiPlanningResult.deletedCount || 0,
    planningSnapshots: snapshotsResult.deletedCount || 0,
    publicationVersions: publicationVersionsResult.deletedCount || 0,
    magicLinks: magicLinksResult.deletedCount || 0,
    workflowYears: workflowYearsResult.deletedCount || 0,
    legacyCollections
  }

  await writeAuditEvent({
    year,
    action: 'workflow.reset',
    user,
    payload: deleted,
    success: true
  })

  return {
    year,
    deleted
  }
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
  resetWorkflowYear,
  logWorkflowAuditEvent: writeAuditEvent,
  hasActivePlanningSnapshot
}
