const mongoose = require('mongoose')

const publicationVersionSchema = new mongoose.Schema({
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
  publishedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  publishedBy: {
    id: { type: String, default: null },
    email: { type: String, default: null }
  },
  rooms: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  source: {
    confirmedTpiCount: { type: Number, default: 0 },
    roomsCount: { type: Number, default: 0 }
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

publicationVersionSchema.index({ year: 1, version: -1 }, { unique: true })
publicationVersionSchema.index({ year: 1, isActive: 1, publishedAt: -1 })

publicationVersionSchema.pre('save', function() {
  this.updatedAt = new Date()
})

const PublicationVersion = mongoose.models.PublicationVersion || mongoose.model(
  'PublicationVersion',
  publicationVersionSchema,
  'publicationVersions'
)

module.exports = PublicationVersion
