const mongoose = require('mongoose')

const FINAL_SCHEDULE_DELIVERY_STATUSES = Object.freeze([
  'pending',
  'sent',
  'failed',
  'skipped'
])

const finalScheduleDeliverySchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true,
    index: true
  },
  publicationVersion: {
    type: Number,
    required: true,
    index: true
  },
  personId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person',
    required: true,
    index: true
  },
  recipientEmail: {
    type: String,
    default: ''
  },
  recipientName: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: FINAL_SCHEDULE_DELIVERY_STATUSES,
    required: true,
    index: true
  },
  messageId: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  },
  tpiCount: {
    type: Number,
    default: 0
  },
  attachmentCount: {
    type: Number,
    default: 0
  },
  sentAt: {
    type: Date,
    default: null,
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

finalScheduleDeliverySchema.index(
  { year: 1, publicationVersion: 1, personId: 1 },
  { unique: true }
)
finalScheduleDeliverySchema.index({ year: 1, publicationVersion: 1, status: 1 })

finalScheduleDeliverySchema.pre('save', function() {
  this.updatedAt = new Date()
})

const FinalScheduleDelivery = mongoose.models.FinalScheduleDelivery || mongoose.model(
  'FinalScheduleDelivery',
  finalScheduleDeliverySchema,
  'finalScheduleDeliveries'
)

module.exports = {
  FinalScheduleDelivery,
  FINAL_SCHEDULE_DELIVERY_STATUSES
}
