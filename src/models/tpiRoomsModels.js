const mongoose = require('mongoose')

// Définition du schéma pour les salles de TPI
const tpiRoomSchema = new mongoose.Schema(
  {
    idRoom: {
      type: Number,
      unique: true,
      required: true,
      alias: '_id'
    },
    lastUpdate: Date,
    site: String,
    date: Date,
    name: String,
    configSite: {
      breakline: Number,
      tpiTime: Number,
      firstTpiStart: Number,
      numSlots: Number
    },
    tpiDatas: [
      {
        id: {
          type: String,
          unique: true // L'ID doit être unique pour chaque document
        },
        candidat: String,
        expert1: String,
        expert2: String,
        boss: String
      }
    ]
  },
  { collection: 'tpiRooms' }
) // Nom de la collection dans la base de données

// Création du modèle TpiRooms basé sur le schéma tpiRoomSchema
const TpiRooms = mongoose.model('TpiRooms', tpiRoomSchema)

// Exportation du modèle TpiRooms pour pouvoir l'utiliser ailleurs
module.exports = TpiRooms
