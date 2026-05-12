const mongoose = require('mongoose')

const publicationChangeNotificationSchema = new mongoose.Schema({
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
  previousPublicationVersion: {
    type: Number,
    default: null
  },
  personId: {
    type: String,
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
    enum: ['sent', 'failed'],
    required: true,
    index: true
  },
  sentAt: {
    type: Date,
    default: null
  },
  messageId: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  },
  changeKeys: {
    type: [String],
    default: []
  },
  linkTarget: {
    type: String,
    enum: ['app', 'publication'],
    default: 'app'
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

publicationChangeNotificationSchema.index(
  { year: 1, publicationVersion: 1, personId: 1 },
  { unique: true }
)

publicationChangeNotificationSchema.pre('save', function() {
  this.updatedAt = new Date()
})

const PublicationChangeNotification = mongoose.models.PublicationChangeNotification || mongoose.model(
  'PublicationChangeNotification',
  publicationChangeNotificationSchema,
  'publicationChangeNotifications'
)

module.exports = {
  PublicationChangeNotification
}
