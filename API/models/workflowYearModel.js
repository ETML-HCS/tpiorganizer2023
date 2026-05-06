const mongoose = require('mongoose')

const LEGACY_WORKFLOW_STATES = ['planning', 'voting_open', 'published']
const WORKFLOW_PHASES = ['planning', 'votes', 'arbitrage', 'defenses']

const phaseEventSchema = new mongoose.Schema(
  {
    phase: {
      type: String,
      enum: WORKFLOW_PHASES,
      required: true
    },
    active: {
      type: Boolean,
      required: true
    },
    previousActive: {
      type: Boolean,
      default: false
    },
    actorId: {
      type: String,
      default: null
    },
    actorEmail: {
      type: String,
      default: null
    },
    reason: {
      type: String,
      default: ''
    },
    at: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
)

const workflowYearSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  state: {
    type: String,
    enum: LEGACY_WORKFLOW_STATES,
    default: 'planning',
    index: true
  },
  activePhases: {
    type: [{
      type: String,
      enum: WORKFLOW_PHASES
    }],
    default: () => ['planning'],
    index: true
  },
  planningAt: {
    type: Date,
    default: Date.now
  },
  votingOpenedAt: {
    type: Date,
    default: null
  },
  arbitrageOpenedAt: {
    type: Date,
    default: null
  },
  publishedAt: {
    type: Date,
    default: null
  },
  lastPhaseChangeAt: {
    type: Date,
    default: Date.now
  },
  phaseEvents: [phaseEventSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

workflowYearSchema.pre('save', function() {
  this.updatedAt = new Date()
})

const WorkflowYear = mongoose.models.WorkflowYear || mongoose.model(
  'WorkflowYear',
  workflowYearSchema,
  'workflowYears'
)

module.exports = {
  WorkflowYear,
  WORKFLOW_PHASES
}
