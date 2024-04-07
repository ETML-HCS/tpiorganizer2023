const { type } = require('@testing-library/user-event/dist/type')
const mongoose = require('mongoose')

const evaluationSchema = new mongoose.Schema({
  tpiRef: {
    type: String,
    required: true
  },
  tpiRemarque: {
    type: String, 
    require:true
  },
  datasHeader: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  datasJustification: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  dataPTechPlus: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  dataPTechSelected: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  dataPoints: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  pointsObtenusA: {
    type: Number,
    required: true
  },
  pointsObtenusB: {
    type: Number,
    required: true
  },
  pointsObtenusC: {
    type: Number,
    required: true
  },
  pointsObtenusABC: {
    type: Number,
    required: true
  },
  noteObtenu: {
    type: Number,
    required: true
  }
})

const Evaluation = mongoose.model('Evaluation', evaluationSchema)

const tpiEvalCollectionSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true
  },
  evaluations: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evaluation'
    }
  ]
})

const TpiEvalCollection = mongoose.model(
  'TpiEvalCollection',
  tpiEvalCollectionSchema
)

module.exports = { Evaluation, TpiEvalCollection }
