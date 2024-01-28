const mongoose = require('mongoose');

const PropositionSchema = new mongoose.Schema({
  isValidated: Boolean,
  propositions: [{
    date: String, // Date de la proposition
    creneau: String // Créneau de la proposition
  }]
});

module.exports = PropositionSchema;
