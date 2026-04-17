const mongoose = require('mongoose')
const Schema = mongoose.Schema

/**
 * Schéma Créneau - Représente un slot temporel disponible pour un TPI
 * Un créneau = Date + Période + Salle
 */
const slotSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, auto: true },
  
  // Année de soutenance
  year: { type: Number, required: true, index: true },
  
  // Date du créneau
  date: { type: Date, required: true, index: true },
  
  // Numéro de période (1-8 typiquement)
  period: { 
    type: Number, 
    required: true,
    min: 1,
    max: 10
  },
  
  // Heure de début calculée (ex: 8:00, 9:10, etc.)
  startTime: { type: String },
  
  // Heure de fin calculée
  endTime: { type: String },
  
  // Salle / Classe
  room: {
    name: { type: String, required: true },
    site: { type: String, required: true }, // ETML, CFPV, etc.
    capacity: { type: Number, default: 1 }
  },
  
  // État du créneau
  status: {
    type: String,
    enum: [
      'available',      // Disponible pour planification
      'proposed',       // Proposé, en attente de votes
      'pending_votes',  // En cours de vote
      'confirmed',      // Confirmé et validé
      'blocked',        // Bloqué (conflit ou manuel)
      'cancelled'       // Annulé
    ],
    default: 'available',
    index: true
  },
  
  // TPI assigné (si confirmé)
  assignedTpi: { 
    type: Schema.Types.ObjectId, 
    ref: 'TpiPlanning',
    default: null
  },
  
  // Personnes assignées à ce créneau
  assignments: {
    candidat: { type: Schema.Types.ObjectId, ref: 'Person' },
    expert1: { type: Schema.Types.ObjectId, ref: 'Person' },
    expert2: { type: Schema.Types.ObjectId, ref: 'Person' },
    chefProjet: { type: Schema.Types.ObjectId, ref: 'Person' }
  },
  
  // Métadonnées de configuration
  config: {
    duration: { type: Number, default: 60 }, // Durée en minutes
    breakAfter: { type: Number, default: 10 } // Pause après en minutes
  },
  
  // Historique des modifications
  history: [{
    action: { type: String },
    by: { type: Schema.Types.ObjectId, ref: 'Person' },
    at: { type: Date, default: Date.now },
    details: { type: String }
  }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// Index composé pour recherche rapide
slotSchema.index({ year: 1, date: 1, period: 1, 'room.name': 1 }, { unique: true })
slotSchema.index({ status: 1, year: 1 })
slotSchema.index({ 'assignments.candidat': 1 })
slotSchema.index({ 'assignments.expert1': 1 })
slotSchema.index({ 'assignments.expert2': 1 })
slotSchema.index({ 'assignments.chefProjet': 1 })

// Méthode pour vérifier si le créneau est disponible
slotSchema.methods.isAvailable = function() {
  return this.status === 'available'
}

// Méthode pour vérifier les conflits avec une personne
slotSchema.methods.hasConflictWith = function(personId) {
  const assignments = this.assignments
  return (
    (assignments.candidat && assignments.candidat.equals(personId)) ||
    (assignments.expert1 && assignments.expert1.equals(personId)) ||
    (assignments.expert2 && assignments.expert2.equals(personId)) ||
    (assignments.chefProjet && assignments.chefProjet.equals(personId))
  )
}

// Middleware pre-save
slotSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

// Méthode statique pour générer les créneaux d'une journée
slotSchema.statics.generateDaySlots = async function(year, date, site, config) {
  const slots = []
  const { rooms, numSlots, firstTpiStart, tpiTime, breakline } = config
  
  for (const roomName of rooms) {
    for (let period = 1; period <= numSlots; period++) {
      // Calculer l'heure de début
      const startHour = firstTpiStart + (period - 1) * (tpiTime + breakline)
      const startMinutes = Math.round((startHour % 1) * 60)
      const startTime = `${Math.floor(startHour)}:${startMinutes.toString().padStart(2, '0')}`
      
      // Calculer l'heure de fin
      const endHour = startHour + tpiTime
      const endMinutes = Math.round((endHour % 1) * 60)
      const endTime = `${Math.floor(endHour)}:${endMinutes.toString().padStart(2, '0')}`
      
      slots.push({
        year,
        date: new Date(date),
        period,
        startTime,
        endTime,
        room: {
          name: roomName,
          site
        },
        config: {
          duration: tpiTime * 60,
          breakAfter: breakline * 60
        },
        status: 'available'
      })
    }
  }
  
  return this.insertMany(slots, { ordered: false }).catch(err => {
    // Ignorer les erreurs de doublon
    if (err.code !== 11000) throw err
    return slots
  })
}

const Slot = mongoose.model('Slot', slotSchema, 'slots')

module.exports = Slot
