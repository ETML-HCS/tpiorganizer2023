const mongoose = require('mongoose')
const Schema = mongoose.Schema

const preferredSoutenanceChoiceSchema = new Schema(
  {
    date: { type: Date, required: true },
    period: { type: Number, min: 1, default: null }
  },
  { _id: false }
)

/**
 * Schéma Personne - Base commune pour candidat, expert, chef de projet
 * Utilisé pour gérer les disponibilités et les conflits
 */
const personSchema = new Schema({
  // Identifiant unique
  _id: { type: Schema.Types.ObjectId, auto: true },
  
  // Informations personnelles
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Email invalide']
  },
  phone: { type: String },
  
  // Rôle(s) de la personne - une personne peut avoir plusieurs rôles
  roles: [{
    type: String,
    enum: ['candidat', 'expert', 'chef_projet', 'admin'],
    required: true
  }],
  
  // Site principal (ETML, CFPV, etc.)
  site: { type: String },
  
  // Entreprise (pour les candidats et chefs de projet)
  entreprise: { type: String },
  
  // Authentification
  magicLinkToken: { type: String },
  magicLinkExpires: { type: Date },
  lastLogin: { type: Date },
  
  // Disponibilités récurrentes (par défaut)
  // Format: jour de semaine + périodes disponibles
  defaultAvailability: [{
    dayOfWeek: { type: Number, min: 0, max: 6 }, // 0 = Dimanche, 1 = Lundi, etc.
    periods: [{ type: Number }] // Numéros des périodes disponibles
  }],
  
  // Présences importées depuis iCal (par date spécifique)
  // Format: Map de dates ISO -> { matin: bool, 'apres-midi': bool }
  importedPresences: {
    type: Map,
    of: {
      matin: { type: Boolean, default: false },
      'apres-midi': { type: Boolean, default: false }
    },
    default: {}
  },
  
  // Date du dernier import iCal
  lastIcalImport: { type: Date },
  
  // Exceptions de disponibilité (congés, absences)
  unavailableDates: [{
    date: { type: Date },
    allDay: { type: Boolean, default: true },
    periods: [{ type: Number }] // Si allDay = false, périodes indisponibles
  }],
  
  // Statistiques pour équilibrage de charge
  stats: {
    tpiAsExpert: { type: Number, default: 0 },
    tpiAsChefProjet: { type: Number, default: 0 },
    consecutiveTpi: { type: Number, default: 0 }, // Pour la règle des 4 TPI max
    lastTpiDate: { type: Date }
  },
  
  // Quotas annuels
  quotas: {
    maxExpertise: { type: Number, default: 20 },
    maxChefProjet: { type: Number, default: 15 }
  },
  
  // Métadonnées
  shortId: {
    type: Number,
    unique: true,
    sparse: true,
    min: 1,
    max: 999
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },

  // Préférences de communication
  sendEmails: { type: Boolean, default: true }, // Si false, la personne ne reçoit pas d'emails automatiques

  // Années où la personne est candidate (pour le suivi des redoublements)
  // Un candidat est lié à une année précise. En cas de redoublement, ajouter l'année manuellement.
  candidateYears: [{ type: Number }],

  // Dates idéales de soutenance à considérer lors de la planification automatique
  preferredSoutenanceDates: {
    type: [{ type: Date }],
    default: [],
    validate: {
      validator: (value) => Array.isArray(value) && value.length <= 3,
      message: 'Maximum 3 dates de preference de soutenance.'
    }
  },
  preferredSoutenanceChoices: {
    type: [preferredSoutenanceChoiceSchema],
    default: [],
    validate: {
      validator: (value) => Array.isArray(value) && value.length <= 3,
      message: 'Maximum 3 preferences precises de soutenance.'
    }
  }
})

// Index pour recherche rapide
personSchema.index({ email: 1 })
personSchema.index({ shortId: 1 }, { unique: true, sparse: true })
personSchema.index({ roles: 1 })
personSchema.index({ site: 1 })
personSchema.index({ 'stats.consecutiveTpi': 1 })

// Méthode virtuelle pour le nom complet
personSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`
})

// Méthode pour vérifier la disponibilité sur un créneau
personSchema.methods.isAvailableOn = function(date, period) {
  // Vérifier les exceptions (congés, absences)
  const exception = this.unavailableDates.find(u => {
    const uDate = new Date(u.date).toDateString()
    const checkDate = new Date(date).toDateString()
    if (uDate !== checkDate) return false
    if (u.allDay) return true
    return u.periods.includes(period)
  })
  
  if (exception) return false

  const hasImportedPresenceData =
    this.importedPresences instanceof Map
      ? this.importedPresences.size > 0
      : Boolean(this.importedPresences && Object.keys(this.importedPresences).length > 0)
  const hasDefaultAvailability = Array.isArray(this.defaultAvailability) && this.defaultAvailability.length > 0
  
  // Vérifier d'abord les présences importées (par date spécifique)
  const dateStr = new Date(date).toISOString().split('T')[0]
  const importedPresence = this.importedPresences?.get(dateStr)
  
  if (importedPresence) {
    const periodKey = period === 1 || period === 'matin' ? 'matin' : 'apres-midi'
    return importedPresence[periodKey] === true
  }
  
  // Sinon vérifier la disponibilité par défaut
  const dayOfWeek = new Date(date).getDay()
  const defaultAvail = this.defaultAvailability.find(d => d.dayOfWeek === dayOfWeek)
  
  if (!defaultAvail) {
    return !hasImportedPresenceData && !hasDefaultAvailability
  }

  return defaultAvail.periods.includes(period)
}

// Méthode pour vérifier la règle des 4 TPI consécutifs
personSchema.methods.canTakeConsecutiveTpi = function() {
  return this.stats.consecutiveTpi < 4
}

// Middleware pre-save pour mettre à jour updatedAt
personSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

const Person = mongoose.model('Person', personSchema, 'persons')

module.exports = Person
