const mongoose = require('mongoose')

const planningSnapshotSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true,
    index: true
  },
  version: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  frozenAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  frozenBy: {
    id: { type: String, default: null },
    email: { type: String, default: null }
  },
  hash: {
    type: String,
    required: true
  },
  source: {
    totalTpis: { type: Number, default: 0 },
    plannedTpis: { type: Number, default: 0 },
    unplannedTpis: { type: Number, default: 0 }
  },
  validationSummary: {
    hasHardConflicts: { type: Boolean, default: false },
    hardConflictCount: { type: Number, default: 0 },
    personOverlapCount: { type: Number, default: 0 },
    roomOverlapCount: { type: Number, default: 0 }
  },
  hardConflicts: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  entries: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

planningSnapshotSchema.index({ year: 1, version: -1 }, { unique: true })
planningSnapshotSchema.index({ year: 1, isActive: 1, frozenAt: -1 })

planningSnapshotSchema.pre('save', function() {
  this.updatedAt = new Date()
})

const PlanningSnapshot = mongoose.models.PlanningSnapshot || mongoose.model(
  'PlanningSnapshot',
  planningSnapshotSchema,
  'planningSnapshots'
)

module.exports = PlanningSnapshot
