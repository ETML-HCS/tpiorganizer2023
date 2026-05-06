const mongoose = require('mongoose')
const Schema = mongoose.Schema
const {
  COORDINATION_STATUS,
  COORDINATION_STATUS_LABELS,
  COORDINATION_STATUS_VALUES
} = require('../modules/coordination/status')

/**
 * Schéma de coordination TPI.
 * Le nom de modèle et la collection Mongo restent hérités pour éviter une migration de données.
 */
const tpiPlanningSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, auto: true },

  // Référence TPI (ex: TPI-2026-001)
  reference: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Année de défense
  year: { type: Number, required: true, index: true },

  // === PERSONNES LIÉES (OBLIGATOIRES) ===

  // Candidat
  candidat: {
    type: Schema.Types.ObjectId,
    ref: 'Person',
    required: true
  },

  // Expert 1
  expert1: {
    type: Schema.Types.ObjectId,
    ref: 'Person',
    required: true
  },

  // Expert 2
  expert2: {
    type: Schema.Types.ObjectId,
    ref: 'Person',
    required: true
  },

  // Chef de projet
  chefProjet: {
    type: Schema.Types.ObjectId,
    ref: 'Person',
    required: true
  },

  // === INFORMATIONS TPI ===

  sujet: { type: String },
  description: { type: String },

  entreprise: {
    nom: { type: String },
    adresse: { type: String },
    contact: { type: String }
  },

  classe: { type: String },
  site: { type: String }, // ETML, CFPV

  // Dates importantes
  dates: {
    soutenance: { type: Date },
    debut: { type: Date },
    fin: { type: Date },
    premiereVisite: { type: Date },
    deuxiemeVisite: { type: Date },
    renduFinal: { type: Date }
  },

  // === WORKFLOW DE PLANIFICATION ===

  // État global du TPI
  status: {
    type: String,
    enum: COORDINATION_STATUS_VALUES,
    default: COORDINATION_STATUS.DRAFT,
    index: true
  },

  // Créneaux proposés (générés automatiquement)
  proposedSlots: [{
    slot: { type: Schema.Types.ObjectId, ref: 'Slot' },
    proposedAt: { type: Date, default: Date.now },
    score: { type: Number }, // Score de pertinence calculé
    reason: { type: String } // Raison de la proposition
  }],

  // Créneau confirmé (après validation)
  confirmedSlot: {
    type: Schema.Types.ObjectId,
    ref: 'Slot',
    default: null
  },

  // Date/heure de défense confirmée
  soutenanceDateTime: { type: Date },

  // Salle confirmée
  soutenanceRoom: { type: String },

  // === WORKFLOW DE VOTE ===

  votingSession: {
    // Date de début de la session de vote
    startedAt: { type: Date },
    // Date limite pour voter
    deadline: { type: Date },
    // Nombre de rappels envoyés
    remindersCount: { type: Number, default: 0 },
    // Dernier rappel envoyé pour éviter les relances automatiques trop rapprochées
    lastReminderSentAt: { type: Date },
    // Résumé des votes
    voteSummary: {
      expert1Voted: { type: Boolean, default: false },
      expert2Voted: { type: Boolean, default: false },
      chefProjetVoted: { type: Boolean, default: false }
    }
  },

  // === GESTION DES CONFLITS ===

  conflicts: [{
    type: {
      type: String,
      enum: [
        'person_overlap',
        'room_overlap',
        'consecutive_limit',
        'room_class_mismatch',
        'no_common_slot',
        'availability_override',
        'automatic_constraint_override'
      ]
    },
    description: { type: String },
    involvedPersons: [{ type: Schema.Types.ObjectId, ref: 'Person' }],
    detectedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    resolution: { type: String }
  }],

  // === EXCEPTIONS ET INTERVENTIONS MANUELLES ===

  manualOverride: {
    isManual: { type: Boolean, default: false },
    reason: { type: String },
    overriddenBy: { type: Schema.Types.ObjectId, ref: 'Person' },
    overriddenAt: { type: Date }
  },

  // === NOTIFICATIONS ENVOYÉES ===

  notifications: [{
    type: {
      type: String,
      enum: ['vote_request', 'reminder', 'confirmation', 'conflict', 'manual_request']
    },
    recipients: [{ type: Schema.Types.ObjectId, ref: 'Person' }],
    sentAt: { type: Date },
    channel: { type: String, enum: ['email', 'sms', 'app'] },
    status: { type: String, enum: ['sent', 'delivered', 'failed'] }
  }],

  // === ÉVALUATION (après défense) ===

  evaluation: {
    note: { type: Number, min: 0, max: 6 },
    commentaires: { type: String },
    documentUrl: { type: String }
  },

  // === MÉTADONNÉES ===

  tags: [{ type: String }],

  history: [{
    action: { type: String },
    by: { type: Schema.Types.ObjectId, ref: 'Person' },
    at: { type: Date, default: Date.now },
    details: { type: Schema.Types.Mixed }
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Person' }
})

// Index composés
tpiPlanningSchema.index({ year: 1, status: 1 })
tpiPlanningSchema.index({ candidat: 1, year: 1 })
tpiPlanningSchema.index({ expert1: 1, year: 1 })
tpiPlanningSchema.index({ expert2: 1, year: 1 })
tpiPlanningSchema.index({ chefProjet: 1, year: 1 })
tpiPlanningSchema.index({ confirmedSlot: 1 })

// Middleware pre-save
tpiPlanningSchema.pre('save', function() {
  this.updatedAt = new Date()
})

// Méthode pour ajouter une entrée à l'historique
tpiPlanningSchema.methods.addHistory = function(action, userId, details = {}) {
  this.history.push({
    action,
    by: userId,
    at: new Date(),
    details
  })
  return this.save()
}

// Méthode pour vérifier si tous les votes sont collectés
tpiPlanningSchema.methods.areAllVotesIn = function() {
  const { voteSummary } = this.votingSession
  return voteSummary.expert1Voted && voteSummary.expert2Voted && voteSummary.chefProjetVoted
}

// Méthode pour obtenir toutes les personnes impliquées
tpiPlanningSchema.methods.getAllPersonIds = function() {
  return [this.candidat, this.expert1, this.expert2, this.chefProjet]
}

// Méthode virtuelle pour le statut lisible
tpiPlanningSchema.virtual('statusLabel').get(function() {
  return COORDINATION_STATUS_LABELS[this.status] || this.status
})

// Méthode statique pour générer une référence unique
tpiPlanningSchema.statics.generateReference = async function(year) {
  const count = await this.countDocuments({ year })
  return `TPI-${year}-${(count + 1).toString().padStart(3, '0')}`
}

const TpiPlanning = mongoose.model('TpiPlanning', tpiPlanningSchema, 'tpiPlannings')

module.exports = TpiPlanning
