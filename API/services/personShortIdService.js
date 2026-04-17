const mongoose = require('mongoose')

const AppCounter = require('../models/appCounterModel')
const Person = require('../models/personModel')

const PERSON_SHORT_ID_COUNTER_KEY = 'person-short-id'
const MAX_PERSON_SHORT_ID = 999

let fallbackSequence = 0

function normalizeShortId(value) {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function hasDatabaseConnection() {
  return mongoose.connection.readyState === 1
}

async function bootstrapCounterIfNeeded() {
  if (!hasDatabaseConnection()) {
    return null
  }

  const existingCounter = await AppCounter.findById(PERSON_SHORT_ID_COUNTER_KEY)
  if (existingCounter) {
    return existingCounter
  }

  const highestPerson = await Person.findOne({
    shortId: { $exists: true, $ne: null }
  })
    .select('shortId')
    .sort({ shortId: -1 })
    .lean()

  try {
    return await AppCounter.create({
      _id: PERSON_SHORT_ID_COUNTER_KEY,
      seq: normalizeShortId(highestPerson?.shortId) || 0
    })
  } catch (error) {
    if (error?.code === 11000) {
      return await AppCounter.findById(PERSON_SHORT_ID_COUNTER_KEY)
    }

    throw error
  }
}

async function reserveNextPersonShortId() {
  if (!hasDatabaseConnection()) {
    fallbackSequence += 1

    if (fallbackSequence > MAX_PERSON_SHORT_ID) {
      throw new Error(`Limite des identifiants courts atteinte (${MAX_PERSON_SHORT_ID}).`)
    }

    return fallbackSequence
  }

  await bootstrapCounterIfNeeded()

  const counter = await AppCounter.findOneAndUpdate(
    { _id: PERSON_SHORT_ID_COUNTER_KEY },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )

  const nextShortId = normalizeShortId(counter?.seq)

  if (!nextShortId) {
    throw new Error("Impossible d'attribuer un identifiant court.")
  }

  if (nextShortId > MAX_PERSON_SHORT_ID) {
    throw new Error(`Limite des identifiants courts atteinte (${MAX_PERSON_SHORT_ID}).`)
  }

  return nextShortId
}

async function ensurePersonShortId(person, options = {}) {
  const persist = options.persist !== false
  const currentShortId = normalizeShortId(person?.shortId)

  if (!person || currentShortId) {
    return person
  }

  const nextShortId = await reserveNextPersonShortId()

  if (typeof person.set === 'function') {
    person.set('shortId', nextShortId)
  } else {
    person.shortId = nextShortId
  }

  if (!persist) {
    return person
  }

  if (typeof person.save === 'function') {
    await person.save()
    return person
  }

  if (person?._id && hasDatabaseConnection()) {
    const updatedPerson = await Person.findByIdAndUpdate(
      person._id,
      { shortId: nextShortId },
      { new: true, runValidators: true }
    )

    if (updatedPerson) {
      return updatedPerson
    }
  }

  return person
}

async function backfillMissingPersonShortIds() {
  if (!hasDatabaseConnection()) {
    return 0
  }

  await bootstrapCounterIfNeeded()

  const missingPeople = await Person.find({
    $or: [
      { shortId: { $exists: false } },
      { shortId: null }
    ]
  })
    .sort({ createdAt: 1, _id: 1 })

  for (const person of missingPeople) {
    await ensurePersonShortId(person)
  }

  return missingPeople.length
}

async function resetPersonShortIdSequence() {
  fallbackSequence = 0

  if (!hasDatabaseConnection()) {
    return
  }

  await AppCounter.deleteOne({ _id: PERSON_SHORT_ID_COUNTER_KEY })
}

module.exports = {
  MAX_PERSON_SHORT_ID,
  backfillMissingPersonShortIds,
  ensurePersonShortId,
  resetPersonShortIdSequence
}
