const mongoose = require('mongoose');

const tpiSchema = new mongoose.Schema({
    refTpi: {
      type: String,
      unique:true,
    },
    candidat:String,      
    expert1: String, // Non obligatoire
    expert2: String, // Non obligatoire
    boss: String,
    lieu:String,
    sujet: String,   
    description: String, // Non obligatoire
    tags: [String], // Tableau de chaînes (non obligatoire)
    dateSoutenance: Date, // Non obligatoire
    dateDepart: Date, // Non obligatoire
    dateFin: Date, // Non obligatoire
    date1ereVisite: Date, // Non obligatoire
    date2emeVisite: Date, // Non obligatoire
    dateRenduFinal: Date, // Non obligatoire
    lienDepot: String, // Non obligatoire
    noteEvaluation: Number, // Non obligatoire
    lienEvaluation: String, // Non obligatoire
  },{
    collection: 'tpiList'
  });

const TpiModels = mongoose.model('tpiList', tpiSchema);

module.exports = TpiModels;
