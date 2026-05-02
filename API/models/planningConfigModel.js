const mongoose = require('mongoose')

const planningDateSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true
    },
    min: {
      type: Boolean,
      default: false
    },
    special: {
      type: Boolean,
      default: false
    },
    classes: {
      type: [String],
      default: []
    },
    label: {
      type: String,
      default: ''
    }
  },
  { _id: false }
)

const planningClassTypeSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: ''
    },
    code: {
      type: String,
      required: true
    },
    prefix: {
      type: String,
      default: ''
    },
    label: {
      type: String,
      default: ''
    },
    startDate: {
      type: String,
      default: ''
    },
    endDate: {
      type: String,
      default: ''
    },
    soutenanceDates: {
      type: [planningDateSchema],
      default: []
    },
    notes: {
      type: String,
      default: ''
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  { _id: false }
)

const planningSiteScheduleSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: ''
    },
    siteId: {
      type: String,
      default: ''
    },
    siteCode: {
      type: String,
      required: true
    },
    label: {
      type: String,
      default: ''
    },
    planningColor: {
      type: String,
      default: ''
    },
    tpiColor: {
      type: String,
      default: ''
    },
    soutenanceColor: {
      type: String,
      default: ''
    },
    breaklineMinutes: {
      type: Number,
      default: 10
    },
    tpiTimeMinutes: {
      type: Number,
      default: 60
    },
    firstTpiStartTime: {
      type: String,
      default: '08:00'
    },
    numSlots: {
      type: Number,
      default: 8
    },
    maxConsecutiveTpi: {
      type: Number,
      default: 4
    },
    minTpiPerRoom: {
      type: Number,
      default: 3
    },
    manualRoomTarget: {
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
    }
  },
  { _id: false }
)

const planningWorkflowSettingsSchema = new mongoose.Schema(
  {
    voteDeadlineDays: {
      type: Number,
      default: 7
    },
    maxVoteProposals: {
      type: Number,
      default: 3
    },
    allowSpecialVoteRequest: {
      type: Boolean,
      default: true
    },
    automaticVoteRemindersEnabled: {
      type: Boolean,
      default: false
    },
    voteReminderLeadHours: {
      type: Number,
      default: 48
    },
    maxVoteReminders: {
      type: Number,
      default: 1
    },
    voteReminderCooldownHours: {
      type: Number,
      default: 24
    }
  },
  { _id: false }
)

const planningAccessLinkSettingsSchema = new mongoose.Schema(
  {
    voteLinkValidityHours: {
      type: Number,
      default: 24 * 7
    },
    voteLinkMaxUses: {
      type: Number,
      default: 20
    },
    soutenanceLinkValidityHours: {
      type: Number,
      default: 24 * 4
    },
    soutenanceLinkMaxUses: {
      type: Number,
      default: 60
    }
  },
  { _id: false }
)

const planningConfigSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  schemaVersion: {
    type: Number,
    default: 2
  },
  classTypes: {
    type: [planningClassTypeSchema],
    default: []
  },
  soutenanceDates: {
    type: [planningDateSchema],
    default: []
  },
  siteConfigs: {
    type: [planningSiteScheduleSchema],
    default: []
  },
  workflowSettings: {
    type: planningWorkflowSettingsSchema,
    default: () => ({})
  },
  accessLinkSettings: {
    type: planningAccessLinkSettingsSchema,
    default: () => ({})
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

planningConfigSchema.pre('save', function() {
  this.updatedAt = new Date()
})

const PlanningConfig = mongoose.models.PlanningConfig || mongoose.model(
  'PlanningConfig',
  planningConfigSchema,
  'planningConfigs'
)

module.exports = PlanningConfig
