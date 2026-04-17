const mongoose = require('mongoose')
const Schema = mongoose.Schema

/**
 * Schéma Vote - Enregistre les votes des experts et chefs de projet sur les créneaux proposés
 */
const voteSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, auto: true },
  
  // TPI concerné
  tpiPlanning: { 
    type: Schema.Types.ObjectId, 
    ref: 'TpiPlanning',
    required: true,
    index: true
  },
  
  // Créneau proposé
  slot: { 
    type: Schema.Types.ObjectId, 
    ref: 'Slot',
    required: true
  },
  
  // Personne qui vote
  voter: { 
    type: Schema.Types.ObjectId, 
    ref: 'Person',
    required: true
  },
  
  // Rôle de la personne pour ce TPI
  voterRole: {
    type: String,
    enum: ['expert1', 'expert2', 'chef_projet'],
    required: true
  },
  
  // Décision
  decision: {
    type: String,
    enum: [
      'pending',    // En attente de réponse
      'accepted',   // Créneau accepté
      'rejected',   // Créneau refusé
      'preferred'   // Créneau préféré (parmi les acceptés)
    ],
    default: 'pending',
    index: true
  },
  
  // Commentaire optionnel
  comment: { type: String },

  // Exception de disponibilité signalée par le votant
  availabilityException: { type: Boolean, default: false },

  // Demande spéciale libre associée à une réponse de vote
  specialRequestReason: { type: String, default: '' },
  specialRequestDate: { type: Date, default: null },
  
  // Priorité donnée par le votant (1 = premier choix)
  priority: { type: Number, min: 1 },
  
  // Date de vote
  votedAt: { type: Date },
  
  // Token magique utilisé pour voter (pour traçabilité)
  magicLinkUsed: { type: String },
  
  // Rappels envoyés
  reminders: [{
    sentAt: { type: Date },
    type: { type: String, enum: ['email', 'sms'] }
  }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// Index composé pour unicité vote par personne par créneau par TPI
voteSchema.index({ tpiPlanning: 1, slot: 1, voter: 1 }, { unique: true })
voteSchema.index({ tpiPlanning: 1, decision: 1 })

// Méthode statique pour vérifier si tous les votes sont collectés pour un TPI
voteSchema.statics.areAllVotesCollected = async function(tpiPlanningId, slotId) {
  const votes = await this.find({ 
    tpiPlanning: tpiPlanningId, 
    slot: slotId,
    decision: { $ne: 'pending' }
  })
  
  // On attend 3 votes: expert1, expert2, chef_projet
  const votedRoles = votes.map(v => v.voterRole)
  return (
    votedRoles.includes('expert1') &&
    votedRoles.includes('expert2') &&
    votedRoles.includes('chef_projet')
  )
}

// Méthode statique pour trouver un créneau unanimement accepté
voteSchema.statics.findUnanimousSlot = async function(tpiPlanningId) {
  const pipeline = [
    { $match: { tpiPlanning: new mongoose.Types.ObjectId(tpiPlanningId) } },
    { $group: {
      _id: '$slot',
      votes: { $push: { decision: '$decision', role: '$voterRole' } },
      acceptedCount: {
        $sum: { $cond: [{ $in: ['$decision', ['accepted', 'preferred']] }, 1, 0] }
      },
      totalVotes: { $sum: 1 }
    }},
    { $match: { acceptedCount: 3, totalVotes: 3 } },
    { $sort: { acceptedCount: -1 } },
    { $limit: 1 }
  ]
  
  const result = await this.aggregate(pipeline)
  return result.length > 0 ? result[0]._id : null
}

// Middleware pre-save
voteSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  if (this.decision !== 'pending' && !this.votedAt) {
    this.votedAt = new Date()
  }
  next()
})

const Vote = mongoose.model('Vote', voteSchema, 'votes')

module.exports = Vote
