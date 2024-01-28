const mongoose = require('mongoose')

const propositionSchema = new mongoose.Schema({
  date: Date,
  creneau: String
})

const offreDataSchema = new mongoose.Schema({
  isValidated: Boolean,
  submit: [propositionSchema],
})

const tpiDataSchema = new mongoose.Schema({
  refTpi: {
    type: Number
  },
  id: { type: String },
  candidat: 
  { 
    type:String 
  },
 expert1: { 
    name: String,
    offres: offreDataSchema
  },
  expert2: { 
    name: String,
    offres: offreDataSchema
  },
  boss: { 
    name: String,
    offres: offreDataSchema 
  },
})

const tpiRoomSchema = new mongoose.Schema({
  idRoom: {
    type: Number,
    unique: true,
    required: true
  },
  lastUpdate: {
    type: Number
  },
  site: {
    type: String
  },
  date: {
    type: Date
  },
  name: {
    type: String
  },
  configSite: {
    breakline: Number,
    tpiTime: Number,
    firstTpiStart: Number,
    numSlots: Number
  },
  tpiDatas: [tpiDataSchema]
})

// Exporte une fonction pour créer un modèle avec un nom de collection personnalisé
const createTpiRoomModel = year => {
  const collectionName = `tpiRooms_${year}`
  return mongoose.model(collectionName, tpiRoomSchema, collectionName)
}

const createCustomTpiRoomModel = collectionName => {
  return mongoose.model(collectionName, tpiRoomSchema, collectionName)
}

// Exportez les schémas ainsi que les fonctions de création de modèles
module.exports = {
  createTpiRoomModel,
  createCustomTpiRoomModel,
  tpiDataSchema,
  tpiRoomSchema,
  offreDataSchema,
  propositionSchema
}
