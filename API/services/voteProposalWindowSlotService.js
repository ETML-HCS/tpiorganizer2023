const Slot = require('../models/slotModel')
const {
  buildMissingConfiguredWindowSlotDocuments
} = require('./voteProposalOptionsService')

const PROPOSAL_WINDOW_SLOT_STATUSES = new Set(['available', 'proposed', 'pending_votes'])

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function getSlotUniqueFilter(slotDocument = {}) {
  const date = new Date(slotDocument.date)
  const dateKey = Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
  const dateStart = dateKey ? new Date(`${dateKey}T00:00:00.000Z`) : slotDocument.date
  const dateEnd = dateKey ? new Date(dateStart.getTime() + 24 * 60 * 60 * 1000) : slotDocument.date

  return {
    year: slotDocument.year,
    date: {
      $gte: dateStart,
      $lt: dateEnd
    },
    period: slotDocument.period,
    'room.name': compactText(slotDocument?.room?.name)
  }
}

function isProposalWindowSlotDocument(slotDocument) {
  return Boolean(slotDocument?._id) && PROPOSAL_WINDOW_SLOT_STATUSES.has(slotDocument?.status)
}

async function ensureConfiguredWindowSlotDocuments(slotDocuments = [], options = {}) {
  const sourceSlotDocuments = Array.isArray(slotDocuments) ? slotDocuments : []
  const missingSlotDocuments = buildMissingConfiguredWindowSlotDocuments(sourceSlotDocuments, options)

  if (missingSlotDocuments.length === 0) {
    return sourceSlotDocuments
  }

  const ensuredSlotDocuments = []

  for (const slotDocument of missingSlotDocuments) {
    const roomName = compactText(slotDocument?.room?.name)

    if (!slotDocument?.year || !slotDocument?.date || !slotDocument?.period || !roomName) {
      continue
    }

    const slotFilter = getSlotUniqueFilter(slotDocument)
    let ensuredSlot = null

    try {
      ensuredSlot = await Slot.findOneAndUpdate(
        slotFilter,
        { $setOnInsert: slotDocument },
        {
          new: true,
          setDefaultsOnInsert: true,
          upsert: true
        }
      )
        .select('date period startTime endTime room status assignedTpi config')
        .lean()
    } catch (error) {
      if (error?.code !== 11000) {
        throw error
      }

      ensuredSlot = await Slot.findOne(slotFilter)
        .select('date period startTime endTime room status assignedTpi config')
        .lean()
    }

    if (isProposalWindowSlotDocument(ensuredSlot)) {
      ensuredSlotDocuments.push(ensuredSlot)
    }
  }

  return sourceSlotDocuments.concat(ensuredSlotDocuments)
}

module.exports = {
  ensureConfiguredWindowSlotDocuments
}
