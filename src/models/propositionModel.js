const mongoose = require('mongoose');

const PropositionSchema = new mongoose.Schema({
  userNameAsk: String, // Nom de l'utilisateur qui fait la demande
  tpi_id: String, // Identifiant du TPI
  propositions: [{
    date: String, // Date de la proposition
    creneau: String // Créneau de la proposition
  }]
});

module.exports = PropositionSchema;
