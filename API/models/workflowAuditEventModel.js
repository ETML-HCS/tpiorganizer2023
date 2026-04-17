const mongoose = require('mongoose')

const actorSchema = new mongoose.Schema(
  {
    id: { type: String, default: null },
    email: { type: String, default: null },
    roles: { type: [String], default: [] }
  },
  { _id: false }
)

const workflowAuditEventSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  success: {
    type: Boolean,
    default: true
  },
  actor: {
    type: actorSchema,
    default: () => ({})
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  error: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
})

workflowAuditEventSchema.index({ year: 1, createdAt: -1 })

const WorkflowAuditEvent = mongoose.models.WorkflowAuditEvent || mongoose.model(
  'WorkflowAuditEvent',
  workflowAuditEventSchema,
  'workflowAuditEvents'
)

module.exports = WorkflowAuditEvent
