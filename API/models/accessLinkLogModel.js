const mongoose = require('mongoose')
const accessLinkPolicy = require('../../shared/accessLinkPolicy.json')
const { ACCESS_LINK_TYPE_VALUES } = require('../modules/accessLinks/constants')

const ACCESS_LINK_LOG_STATUSES = Object.freeze([...accessLinkPolicy.logStatuses])

const accessLinkLogSchema = new mongoose.Schema({
  tokenHash: {
    type: String,
    default: '',
    index: true
  },
  type: {
    type: String,
    enum: [...ACCESS_LINK_TYPE_VALUES, null],
    default: null,
    index: true
  },
  year: {
    type: Number,
    default: null,
    index: true
  },
  personId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person',
    default: null,
    index: true
  },
  recipientEmail: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ACCESS_LINK_LOG_STATUSES,
    required: true,
    index: true
  },
  reason: {
    type: String,
    default: ''
  },
  redirectPath: {
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
  ip: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
})

accessLinkLogSchema.index({ year: 1, type: 1, createdAt: -1 })
accessLinkLogSchema.index({ year: 1, status: 1, createdAt: -1 })

const AccessLinkLog = mongoose.models.AccessLinkLog || mongoose.model(
  'AccessLinkLog',
  accessLinkLogSchema,
  'accessLinkLogs'
)

module.exports = {
  AccessLinkLog,
  ACCESS_LINK_LOG_STATUSES
}
