const mongoose = require('mongoose')
const { VOTING_STAKEHOLDER_ROLES } = require('../modules/stakeholders/stakeholderDefinitions')

const RECIPIENT_RESPONSE_STATUSES = ['pending', 'accepted', 'rejected']
const RECIPIENT_DELIVERY_STATUSES = ['pending', 'sent', 'failed', 'skipped']
const RESOLUTION_PROPOSAL_STATUSES = ['sent', 'partial', 'accepted', 'rejected', 'expired', 'cancelled', 'failed']

const resolutionProposalRecipientSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: VOTING_STAKEHOLDER_ROLES,
    required: true
  },
  person: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person',
    default: null
  },
  name: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  },
  tokenHash: {
    type: String,
    required: true
  },
  publicUrl: {
    type: String,
    default: ''
  },
  responseStatus: {
    type: String,
    enum: RECIPIENT_RESPONSE_STATUSES,
    default: 'pending'
  },
  responseReason: {
    type: String,
    default: ''
  },
  alternativeProposal: {
    type: String,
    default: ''
  },
  respondedAt: {
    type: Date,
    default: null
  },
  deliveryStatus: {
    type: String,
    enum: RECIPIENT_DELIVERY_STATUSES,
    default: 'pending'
  },
  deliveryError: {
    type: String,
    default: ''
  },
  sentAt: {
    type: Date,
    default: null
  }
}, { _id: false })

const slotSnapshotSchema = new mongoose.Schema({
  label: { type: String, default: '' },
  date: { type: Date, default: null },
  period: { type: String, default: '' },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  room: { type: String, default: '' },
  site: { type: String, default: '' }
}, { _id: false })

const resolutionProposalSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true,
    index: true
  },
  tpiPlanning: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TpiPlanning',
    required: true,
    index: true
  },
  tpiReference: {
    type: String,
    default: ''
  },
  candidateName: {
    type: String,
    default: ''
  },
  subject: {
    type: String,
    default: ''
  },
  proposedSlot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Slot',
    required: true,
    index: true
  },
  proposedSlotSnapshot: {
    type: slotSnapshotSchema,
    default: () => ({})
  },
  message: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: RESOLUTION_PROPOSAL_STATUSES,
    default: 'sent',
    index: true
  },
  devMode: {
    type: Boolean,
    default: false
  },
  recipients: {
    type: [resolutionProposalRecipientSchema],
    default: []
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person',
    default: null
  },
  sentAt: {
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

resolutionProposalSchema.index({ tpiPlanning: 1, createdAt: -1 })
resolutionProposalSchema.index({ 'recipients.tokenHash': 1 })

resolutionProposalSchema.pre('save', function() {
  this.updatedAt = new Date()
})

const ResolutionProposal = mongoose.models.ResolutionProposal || mongoose.model(
  'ResolutionProposal',
  resolutionProposalSchema,
  'resolutionProposals'
)

module.exports = {
  ResolutionProposal,
  RECIPIENT_RESPONSE_STATUSES,
  RESOLUTION_PROPOSAL_STATUSES
}
