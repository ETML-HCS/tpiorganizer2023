const mongoose = require('mongoose')

const MAGIC_LINK_TYPES = ['vote', 'soutenance']

const magicLinkSchema = new mongoose.Schema({
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  rawToken: {
    type: String,
    default: '',
    select: false
  },
  type: {
    type: String,
    enum: MAGIC_LINK_TYPES,
    required: true,
    index: true
  },
  year: {
    type: Number,
    required: true,
    index: true
  },
  recipientEmail: {
    type: String,
    required: true,
    index: true
  },
  personId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person',
    default: null,
    index: true
  },
  personName: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    default: null
  },
  scope: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  redirectPath: {
    type: String,
    required: true
  },
  maxUses: {
    type: Number,
    default: 1
  },
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsedAt: {
    type: Date,
    default: null
  },
  revokedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
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

magicLinkSchema.index({ type: 1, year: 1, createdAt: -1 })

magicLinkSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

const MagicLink = mongoose.models.MagicLink || mongoose.model(
  'MagicLink',
  magicLinkSchema,
  'magicLinks'
)

module.exports = {
  MagicLink,
  MAGIC_LINK_TYPES
}
