const mongoose = require('mongoose');

const tpiConfigSchema = new mongoose.Schema({
  school: {
    type: String,
    required: true,
    unique: true,
  },
  rooms: {
    type: [String],
    required: true,
  },
  breakline: {
    type: Number,
    required: true,
  },
  tpiTime: {
    type: Number,
    required: true,
  },
  firstTpiStart: {
    type: Number,
    required: true,
  },
  numSlots: {
    type: Number,
    required: true,
  },
});

const TpiConfig = mongoose.model('TpiConfig', tpiConfigSchema);

module.exports = TpiConfig;
