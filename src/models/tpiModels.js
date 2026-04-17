const mongoose = require('mongoose')

// Définition du schéma pour les TPI
const tpiSchema = new mongoose.Schema(
  {
    refTpi: {
      type: String,
      unique: true, // La référence du TPI doit être unique
      required: true // La référence du TPI est obligatoire
    },
    candidat: {
      type: String,
      required: true // Nom du candidat est obligatoire
    },
    classe: { type: String },
    experts: {
      // Regroupe les experts en un seul champ
      1: { type: String }, // Nom du premier expert (non obligatoire)
      2: { type: String } // Nom du deuxième expert (non obligatoire)
    },
    boss: {
      type: String,
      required: true // Nom du responsable est obligatoire
    },
    lieu: {
      // Regroupe les lieux en un seul champ
      entreprise: { type: String }, // Lieu où se déroule le TPI (non obligatoire)
      site: { type: String }
    },
    sujet: { type: String }, // Sujet du TPI (non obligatoire)
    description: { type: String }, // Description du TPI (non obligatoire)
    tags: [String], // Liste de tags associés au TPI
    dates: {
      // Regroupe les dates en un seul champ
      soutenance: Date, // Date de soutenance du TPI
      depart: { type: Date }, // Date de début du TPI (non obligatoire)
      fin: { type: Date }, // Date de fin du TPI (non obligatoire)
      premiereVisite: { type: Date }, // Date de la première visite (non obligatoire)
      deuxiemeVisite: { type: Date }, // Date de la deuxième visite (non obligatoire)
      renduFinal: { type: Date } // Date de rendu final (non obligatoire)
    },
    lienDepot: { type: String }, // Lien pour le dépôt du TPI (non obligatoire)
    evaluation: {
      // Regroupe les informations d'évaluation en un seul champ
      note: { type: Number }, // Note attribuée lors de l'évaluation (non obligatoire)
      lien: { type: String } // Lien vers l'évaluation (non obligatoire)
    },
    salle: { type: String } // Salle de soutenance (non obligatoire)
  },
  {
    collection: 'tpiList'
  }
)

// Exporte une fonction pour créer un modèle avec un nom de collection personnalisé
const TpiModelsYear = year => {
  const collectionName = `tpiList_${year}`
  return mongoose.model(collectionName, tpiSchema, collectionName)
}

module.exports = TpiModelsYear
