// Importation de Mongoose et définition du schéma
const mongoose = require('mongoose')
const Schema = mongoose.Schema

// Schéma pour les experts TPI
const tpiExpertsSchema = new Schema({
  _id: Schema.Types.ObjectId,
  id: Number,
  name: String,
  site: String,
  email: String,
  role:String,
  contact: { // Regroupe les informations de contact en un seul champ
    phone: { type: String }, 
    email: { type: String }
  },
  token: { type: String },
  date: {
    type: Date,
    default: function () {
      return this.token ? Date.now() : null
    }
  }
})

const TpiExperts = mongoose.model('tpiExperts', tpiExpertsSchema, 'tpiExperts') // Le troisième argument spécifie le nom exact de la collection.

module.exports = TpiExperts
