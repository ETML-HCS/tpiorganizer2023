const mongoose = require('mongoose')

const WORKFLOW_STATES = ['planning', 'voting_open', 'published']

const transitionEntrySchema = new mongoose.Schema(
  {
    from: {
      type: String,
      enum: [...WORKFLOW_STATES, null],
      default: null
    },
    to: {
      type: String,
      enum: WORKFLOW_STATES,
      required: true
    },
    actorId: {
      type: String,
      default: null
    },
    actorEmail: {
      type: String,
      default: null
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
    enum: WORKFLOW_STATES,
    default: 'planning',
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
  publishedAt: {
    type: Date,
    default: null
  },
  lastTransitionAt: {
    type: Date,
    default: Date.now
  },
  transitions: [transitionEntrySchema],
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
  WORKFLOW_STATES
}
