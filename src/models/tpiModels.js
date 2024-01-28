const mongoose = require('mongoose');

const tpiSchema = new mongoose.Schema({
    refTpi: {
      type: String,
      unique:true,
    },
    candidat:String,      
    expert1: String, 
    expert2: String, 
    boss: String,
    lieu:String,
    sujet: String,   
    description: String, 
    tags: [String], // Tableau de chaînes (non obligatoire)
    dateSoutenance: Date, 
    dateDepart: Date, 
    dateFin: Date, 
    date1ereVisite: Date, 
    date2emeVisite: Date, 
    dateRenduFinal: Date, 
    lienDepot: String, 
    noteEvaluation: Number, 
    lienEvaluation: String, 
  },{
    collection: 'tpiList'
  });

const TpiModels = mongoose.model('tpiList', tpiSchema);

module.exports = TpiModels;
