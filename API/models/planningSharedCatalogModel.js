const mongoose = require('mongoose')

const siteAddressSchema = new mongoose.Schema(
  {
    line1: {
      type: String,
      default: ''
    },
    line2: {
      type: String,
      default: ''
    },
    postalCode: {
      type: String,
      default: ''
    },
    city: {
      type: String,
      default: ''
    },
    canton: {
      type: String,
      default: ''
    },
    country: {
      type: String,
      default: ''
    }
  },
  { _id: false }
)

const roomCatalogSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: ''
    },
    code: {
      type: String,
      default: ''
    },
    label: {
      type: String,
      default: ''
    },
    capacity: {
      type: Number,
      default: null
    },
    notes: {
      type: String,
      default: ''
    },
    active: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
)

const siteClassSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: ''
    },
    code: {
      type: String,
      required: true
    },
    label: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    active: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
)

const siteClassGroupSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: ''
    },
    baseType: {
      type: String,
      required: true
    },
    label: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    active: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      default: 0
    },
    classes: {
      type: [siteClassSchema],
      default: []
    }
  },
  { _id: false }
)

const siteCatalogSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: ''
    },
    code: {
      type: String,
      required: true
    },
    label: {
      type: String,
      default: ''
    },
    address: {
      type: siteAddressSchema,
      default: () => ({})
    },
    rooms: {
      type: [String],
      default: []
    },
    roomDetails: {
      type: [roomCatalogSchema],
      default: []
    },
    classGroups: {
      type: [siteClassGroupSchema],
      default: []
    },
    notes: {
      type: String,
      default: ''
    }
  },
  { _id: false }
)

const planningSharedCatalogSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  schemaVersion: {
    type: Number,
    default: 2
  },
  sites: {
    type: [siteCatalogSchema],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

planningSharedCatalogSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

const PlanningSharedCatalog = mongoose.models.PlanningSharedCatalog || mongoose.model(
  'PlanningSharedCatalog',
  planningSharedCatalogSchema,
  'planningSharedCatalogs'
)

module.exports = PlanningSharedCatalog
