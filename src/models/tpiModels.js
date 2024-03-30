const mongoose = require('mongoose');

// Définition du schéma pour les TPI (Travaux Pratiques et d'Intégration)
const tpiSchema = new mongoose.Schema({
    refTpi: {
      type: String,
      unique: true, // La référence du TPI doit être unique
      required: true // La référence du TPI est obligatoire
    },
    candidat: String, // Nom du candidat
    expert1: String, // Nom du premier expert
    expert2: String, // Nom du deuxième expert
    boss: String, // Nom du responsable
    lieu: String, // Lieu où se déroule le TPI
    sujet: String, // Sujet du TPI
    description: String, // Description du TPI
    tags: [String], // Liste de tags associés au TPI
    dateSoutenance: Date, // Date de soutenance du TPI
    dateDepart: Date, // Date de début du TPI
    dateFin: Date, // Date de fin du TPI
    date1ereVisite: Date, // Date de la première visite
    date2emeVisite: Date, // Date de la deuxième visite
    dateRenduFinal: Date, // Date de rendu final
    lienDepot: String, // Lien pour le dépôt du TPI
    noteEvaluation: Number, // Note attribuée lors de l'évaluation
    lienEvaluation: String // Lien vers l'évaluation
  },{
    collection: 'tpiList'
  });

// Exporte une fonction pour créer un modèle avec un nom de collection personnalisé
const TpiModelsYear = year => {
  const collectionName = `tpiList_${year}`
  return mongoose.model(collectionName, tpiSchema, collectionName)
}

module.exports = TpiModelsYear;
