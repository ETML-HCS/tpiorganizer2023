const mongoose = require('mongoose')
const Schema = mongoose.Schema

const appCounterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
}, {
  versionKey: false
})

const AppCounter = mongoose.models.AppCounter || mongoose.model('AppCounter', appCounterSchema, 'app_counters')

module.exports = AppCounter
