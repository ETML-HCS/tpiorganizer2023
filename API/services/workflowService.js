const mongoose = require('mongoose')

const WorkflowAuditEvent = require('../models/workflowAuditEventModel')
const PlanningSnapshot = require('../models/coordinationSnapshotModel')
const { WorkflowYear, WORKFLOW_PHASES } = require('../models/workflowYearModel')
const TpiPlanning = require('../models/tpiCoordinationModel')
const Slot = require('../models/slotModel')
const Vote = require('../models/voteModel')
const PublicationVersion = require('../models/publicationVersionModel')
const { MagicLink } = require('../models/magicLinkModel')
const { AccessLinkLog } = require('../models/accessLinkLogModel')

const LEGACY_STATE_PHASES = Object.freeze({
  planning: 'planning',
  voting_open: 'votes',
  published: 'defenses'
})
const WORKFLOW_PHASE_ALIASES = Object.freeze({
  planning: 'planning',
  planification: 'planning',
  preparation: 'planning',
  vote: 'votes',
  votes: 'votes',
  voting: 'votes',
  voting_open: 'votes',
  arbitrage: 'arbitrage',
  arbitration: 'arbitrage',
  defense: 'defenses',
  defenses: 'defenses',
  defence: 'defenses',
  defences: 'defenses',
  soutenance: 'defenses',
  soutenances: 'defenses',
  publication: 'defenses',
  published: 'defenses'
})

function normalizeActor(user) {
  return {
    id: user?.id ? String(user.id) : null,
    email: typeof user?.email === 'string' ? user.email : null,
    roles: Array.isArray(user?.roles) ? user.roles : []
  }
}

function normalizeWorkflowPhase(value) {
  const normalized = typeof value === 'string'
    ? value.trim().toLowerCase()
    : ''

  return WORKFLOW_PHASE_ALIASES[normalized] || null
}

function isWorkflowPhase(value) {
  return Boolean(normalizeWorkflowPhase(value))
}

function normalizeActivePhases(workflow = {}) {
  const phases = Array.isArray(workflow?.activePhases)
    ? workflow.activePhases
    : null

  if (phases) {
    return Array.from(new Set(
      phases
        .map((phase) => normalizeWorkflowPhase(phase))
        .filter(Boolean)
    ))
  }

  const legacyPhase = LEGACY_STATE_PHASES[workflow?.state]
  return legacyPhase ? [legacyPhase] : ['planning']
}

function getLegacyStateFromPhases(activePhases = []) {
  const active = new Set(
    (Array.isArray(activePhases) ? activePhases : [])
      .map((phase) => normalizeWorkflowPhase(phase))
      .filter(Boolean)
  )

  if (active.has('defenses')) {
    return 'published'
  }

  if (active.has('votes') || active.has('arbitrage')) {
    return 'voting_open'
  }

  return 'planning'
}

function isWorkflowPhaseActive(workflow = {}, phase) {
  const normalizedPhase = normalizeWorkflowPhase(phase)
  if (!normalizedPhase) {
    return false
  }

  return normalizeActivePhases(workflow).includes(normalizedPhase)
}

function getPhaseActivatedAt(workflow, phase) {
  if (phase === 'planning') {
    return workflow.planningAt
  }

  if (phase === 'votes') {
    return workflow.votingOpenedAt
  }

  if (phase === 'arbitrage') {
    return workflow.arbitrageOpenedAt
  }

  if (phase === 'defenses') {
    return workflow.publishedAt
  }

  return null
}

function buildPhaseMap(workflow) {
  const active = new Set(normalizeActivePhases(workflow))

  return WORKFLOW_PHASES.reduce((acc, phase) => {
    acc[phase] = {
      active: active.has(phase),
      activatedAt: getPhaseActivatedAt(workflow, phase) || null
    }
    return acc
  }, {})
}

function toPublicWorkflow(workflow) {
  const activePhases = normalizeActivePhases(workflow)
  const state = getLegacyStateFromPhases(activePhases)

  return {
    year: workflow.year,
    state,
    legacyState: workflow.state || state,
    activePhases,
    phases: buildPhaseMap(workflow),
    planningAt: workflow.planningAt,
    votingOpenedAt: workflow.votingOpenedAt,
    arbitrageOpenedAt: workflow.arbitrageOpenedAt,
    publishedAt: workflow.publishedAt,
    lastPhaseChangeAt: workflow.lastPhaseChangeAt,
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
      activePhases: ['planning'],
      planningAt: now,
      lastPhaseChangeAt: now
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

async function setWorkflowPhaseActive({
  year,
  phase,
  active,
  user,
  reason = ''
}) {
  const normalizedPhase = normalizeWorkflowPhase(phase)
  if (!normalizedPhase) {
    throw new Error('Phase workflow invalide.')
  }

  const workflow = await getOrCreateWorkflow(year)
  const currentPhases = normalizeActivePhases(workflow)
  const currentlyActive = currentPhases.includes(normalizedPhase)
  const nextActive = active === true

  if (currentlyActive === nextActive) {
    return {
      changed: false,
      phase: normalizedPhase,
      active: nextActive,
      workflow: toPublicWorkflow(workflow)
    }
  }

  const now = new Date()
  const nextPhases = nextActive
    ? Array.from(new Set([...currentPhases, normalizedPhase]))
    : currentPhases.filter((entry) => entry !== normalizedPhase)

  workflow.activePhases = nextPhases
  workflow.state = getLegacyStateFromPhases(nextPhases)
  workflow.lastPhaseChangeAt = now

  if (normalizedPhase === 'planning' && nextActive && !workflow.planningAt) {
    workflow.planningAt = now
  }

  if (normalizedPhase === 'votes' && nextActive && !workflow.votingOpenedAt) {
    workflow.votingOpenedAt = now
  }

  if (normalizedPhase === 'arbitrage' && nextActive && !workflow.arbitrageOpenedAt) {
    workflow.arbitrageOpenedAt = now
  }

  if (normalizedPhase === 'defenses' && nextActive && !workflow.publishedAt) {
    workflow.publishedAt = now
  }

  if (!Array.isArray(workflow.phaseEvents)) {
    workflow.phaseEvents = []
  }

  workflow.phaseEvents.push({
    phase: normalizedPhase,
    active: nextActive,
    previousActive: currentlyActive,
    actorId: user?.id ? String(user.id) : null,
    actorEmail: typeof user?.email === 'string' ? user.email : null,
    reason: String(reason || '').trim(),
    at: now
  })

  await workflow.save()

  await writeAuditEvent({
    year,
    action: 'workflow.phase.toggle',
    user,
    payload: {
      phase: normalizedPhase,
      active: nextActive,
      previousActive: currentlyActive,
      activePhases: nextPhases,
      reason: String(reason || '').trim()
    },
    success: true
  })

  return {
    changed: true,
    phase: normalizedPhase,
    active: nextActive,
    workflow: toPublicWorkflow(workflow)
  }
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
  const accessLinkLogsResult = await AccessLinkLog.deleteMany({ year })
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
    accessLinkLogs: accessLinkLogsResult.deletedCount || 0,
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
  WORKFLOW_PHASES,
  isWorkflowPhase,
  isWorkflowPhaseActive,
  getWorkflowYearState,
  normalizeWorkflowPhase,
  setWorkflowPhaseActive,
  listWorkflowAuditEvents,
  resetWorkflowYear,
  logWorkflowAuditEvent: writeAuditEvent,
  hasActivePlanningSnapshot
}
