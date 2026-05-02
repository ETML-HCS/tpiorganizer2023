const mongoose = require('mongoose')

const publicationDeploymentConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  protocol: {
    type: String,
    enum: ['ftp', 'ftps', 'sftp', 'ssh'],
    default: 'ftp'
  },
  host: {
    type: String,
    default: ''
  },
  port: {
    type: Number,
    default: 21
  },
  username: {
    type: String,
    default: ''
  },
  passwordEncrypted: {
    type: String,
    default: '',
    select: false
  },
  passwordUpdatedAt: {
    type: Date,
    default: null
  },
  remoteDir: {
    type: String,
    default: ''
  },
  staticRemoteDir: {
    type: String,
    default: ''
  },
  publicBaseUrl: {
    type: String,
    default: 'https://tpi26.ch'
  },
  publicPath: {
    type: String,
    default: ''
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

publicationDeploymentConfigSchema.pre('save', function() {
  this.updatedAt = new Date()
})

const PublicationDeploymentConfig = mongoose.models.PublicationDeploymentConfig || mongoose.model(
  'PublicationDeploymentConfig',
  publicationDeploymentConfigSchema,
  'publicationDeploymentConfigs'
)

module.exports = PublicationDeploymentConfig
