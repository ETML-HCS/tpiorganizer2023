const mongoose = require('mongoose')

const Person = require('../models/personModel')
const Slot = require('../models/slotModel')
const TpiPlanning = require('../models/tpiPlanningModel')
const { MagicLink } = require('../models/magicLinkModel')
const {
  isValidEmail,
  isSyntheticOrganizerEmail,
  normalizeEmail,
  resolveUniquePersonFromList
} = require('./personIdentityService')
const { ensurePersonShortId } = require('./personShortIdService')

const ALLOWED_ROLES = new Set(['candidat', 'expert', 'chef_projet', 'admin'])
const PLACEHOLDER_EMPTY_VALUES = new Set(['null', 'undefined'])

class PersonRegistryError extends Error {
  constructor(message, statusCode = 400, details = {}) {
    super(message)
    this.name = 'PersonRegistryError'
    this.statusCode = statusCode
    this.details = details
  }
}

function normalizeTextValue(value) {
  if (typeof value !== 'string') {
    return ''
  }

  const normalizedValue = value.trim()
  return PLACEHOLDER_EMPTY_VALUES.has(normalizedValue.toLowerCase())
    ? ''
    : normalizedValue
}

function normalizeNameKey(value = '') {
  return normalizeTextValue(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getFullNameValue(person = {}) {
  return [person?.firstName, person?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function normalizePersonIdList(personIds = []) {
  return Array.from(
    new Set(
      (Array.isArray(personIds) ? personIds : [personIds])
        .map((value) => normalizeTextValue(value))
        .filter(Boolean)
    )
  )
}

function normalizeBoolean(value, fallbackValue = true) {
  return typeof value === 'boolean' ? value : fallbackValue
}

function normalizeCandidateYears(years = []) {
  return Array.from(
    new Set(
      (Array.isArray(years) ? years : [years])
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value))
    )
  ).sort((left, right) => left - right)
}

function normalizeDateKey(value) {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().slice(0, 10)
}

function normalizePositiveInteger(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function normalizePreferredSoutenanceChoice(value) {
  if (!value && value !== 0) {
    return null
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const date = normalizeDateKey(value.date || value.value || value.label)

    if (!date) {
      return null
    }

    const period = normalizePositiveInteger(
      value.period ?? value.slot ?? value.creneau ?? value.slotNumber
    )

    return period ? { date, period } : { date }
  }

  const date = normalizeDateKey(value)
  return date ? { date } : null
}

function normalizePreferredSoutenanceChoices(choices = [], fallbackDates = []) {
  const normalizedChoices = []

  for (const value of [
    ...(Array.isArray(choices) ? choices : [choices]),
    ...(Array.isArray(fallbackDates) ? fallbackDates : [fallbackDates])
  ]) {
    const choice = normalizePreferredSoutenanceChoice(value)

    if (!choice) {
      continue
    }

    const choicePeriod = Number.isInteger(choice.period) ? choice.period : null
    const exactIndex = normalizedChoices.findIndex((existingChoice) =>
      existingChoice.date === choice.date &&
      (existingChoice.period ?? null) === choicePeriod
    )

    if (exactIndex !== -1) {
      continue
    }

    if (Number.isInteger(choice.period)) {
      const dateOnlyIndex = normalizedChoices.findIndex((existingChoice) =>
        existingChoice.date === choice.date && (existingChoice.period ?? null) === null
      )

      if (dateOnlyIndex !== -1) {
        normalizedChoices[dateOnlyIndex] = choice
        continue
      }

      if (normalizedChoices.length < 3) {
        normalizedChoices.push(choice)
      }
      continue
    }

    const hasChoiceForDate = normalizedChoices.some((existingChoice) => existingChoice.date === choice.date)
    if (!hasChoiceForDate && normalizedChoices.length < 3) {
      normalizedChoices.push(choice)
    }
  }

  return normalizedChoices
}

function normalizePreferredSoutenanceDates(dates = [], fallbackChoices = []) {
  return Array.from(new Set(normalizePreferredSoutenanceChoices(fallbackChoices, dates).map((choice) => choice.date)))
}

function normalizeRoleList(roles = []) {
  return (Array.isArray(roles) ? roles : [roles])
    .map((role) => String(role || '').trim())
    .filter((role) => ALLOWED_ROLES.has(role))
}

function normalizeRoles(roles = ['expert']) {
  const normalized = normalizeRoleList(roles)
  return normalized.length > 0 ? normalized : ['expert']
}

function mergeRoles(existingRoles = [], incomingRoles = ['expert']) {
  const merged = normalizeRoleList(existingRoles)

  for (const role of normalizeRoles(incomingRoles)) {
    if (!merged.includes(role)) {
      merged.push(role)
    }
  }

  return merged.length > 0 ? merged : ['expert']
}

function mergePreferredSoutenanceDates(existingDates = [], incomingDates = []) {
  return normalizePreferredSoutenanceDates(existingDates, incomingDates)
}

function mergePreferredSoutenanceChoices(existingChoices = [], incomingChoices = []) {
  return normalizePreferredSoutenanceChoices([
    ...(Array.isArray(existingChoices) ? existingChoices : [existingChoices]),
    ...(Array.isArray(incomingChoices) ? incomingChoices : [incomingChoices])
  ])
}

function arePreferredSoutenanceChoicesEqual(leftChoices = [], rightChoices = []) {
  const left = normalizePreferredSoutenanceChoices(leftChoices)
  const right = normalizePreferredSoutenanceChoices(rightChoices)

  return (
    left.length === right.length &&
    left.every((choice, index) =>
      choice.date === right[index]?.date &&
      (choice.period ?? null) === (right[index]?.period ?? null)
    )
  )
}

function mapParticipantRoleToRegistryRole(role = '') {
  switch (String(role || '').trim()) {
    case 'expert1':
    case 'expert2':
    case 'expert':
      return 'expert'
    case 'chef_projet':
    case 'boss':
      return 'chef_projet'
    case 'candidat':
      return 'candidat'
    case 'admin':
      return 'admin'
    default:
      return ''
  }
}

function personHasRole(person, requiredRole, options = {}) {
  const normalizedRequiredRole = mapParticipantRoleToRegistryRole(requiredRole)

  if (!normalizedRequiredRole) {
    return true
  }

  const roleSet = new Set(normalizeRoleList(person?.roles))
  if (!roleSet.has(normalizedRequiredRole)) {
    return false
  }

  if (normalizedRequiredRole !== 'candidat') {
    return true
  }

  const requestedYear = Number.parseInt(options.year, 10)
  if (!Number.isInteger(requestedYear)) {
    return true
  }

  const candidateYears = normalizeCandidateYears(person?.candidateYears || [])
  return candidateYears.length === 0 || candidateYears.includes(requestedYear)
}

function filterPeopleByRole(people = [], requiredRole, options = {}) {
  if (!requiredRole) {
    return Array.isArray(people) ? people : []
  }

  return (Array.isArray(people) ? people : []).filter((person) =>
    personHasRole(person, requiredRole, options)
  )
}

function resolveUniquePersonForRole(identifier, people = [], requiredRole, options = {}) {
  const filteredPeople = filterPeopleByRole(people, requiredRole, options)
  return resolveUniquePersonFromList(identifier, filteredPeople)
}

function mergePersonRecord(existingPerson, incoming = {}) {
  const existingRoles = normalizeRoleList(existingPerson?.roles)
  const mergedRoles = mergeRoles(existingRoles, incoming.roles)
  const updates = {}

  const fieldsToFill = ['firstName', 'lastName', 'phone', 'site', 'entreprise']
  for (const field of fieldsToFill) {
    const currentValue = typeof existingPerson?.[field] === 'string'
      ? existingPerson[field].trim()
      : existingPerson?.[field]
    const incomingValue = typeof incoming?.[field] === 'string'
      ? incoming[field].trim()
      : ''

    if ((!currentValue || String(currentValue).trim().length === 0) && incomingValue) {
      updates[field] = incomingValue
    }
  }

  if (existingPerson?.isActive === false && incoming?.isActive !== false) {
    updates.isActive = true
  }

  if (incoming.sendEmails === false) {
    updates.sendEmails = false
  }

  const existingYears = normalizeCandidateYears(existingPerson?.candidateYears || [])
  const incomingYears = normalizeCandidateYears(incoming?.candidateYears || [])
  const mergedYears = Array.from(new Set([...existingYears, ...incomingYears])).sort((a, b) => a - b)

  if (mergedYears.length !== existingYears.length || mergedYears.some((year, index) => year !== existingYears[index])) {
    updates.candidateYears = mergedYears
  }

  const existingPreferredChoices = normalizePreferredSoutenanceChoices(
    existingPerson?.preferredSoutenanceChoices || [],
    existingPerson?.preferredSoutenanceDates || []
  )
  const incomingPreferredChoices = normalizePreferredSoutenanceChoices(
    incoming?.preferredSoutenanceChoices || [],
    incoming?.preferredSoutenanceDates || []
  )
  const mergedPreferredChoices = mergePreferredSoutenanceChoices(existingPreferredChoices, incomingPreferredChoices)
  const existingPreferredDates = normalizePreferredSoutenanceDates(
    existingPerson?.preferredSoutenanceDates || [],
    existingPerson?.preferredSoutenanceChoices || []
  )
  const mergedPreferredDates = mergePreferredSoutenanceDates([], mergedPreferredChoices)

  if (
    mergedPreferredDates.length !== existingPreferredDates.length ||
    mergedPreferredDates.some((date, index) => date !== existingPreferredDates[index])
  ) {
    updates.preferredSoutenanceDates = mergedPreferredDates
  }

  if (!arePreferredSoutenanceChoicesEqual(existingPreferredChoices, mergedPreferredChoices)) {
    updates.preferredSoutenanceChoices = mergedPreferredChoices
  }

  if (
    mergedRoles.length !== existingRoles.length ||
    mergedRoles.some((role, index) => role !== existingRoles[index])
  ) {
    updates.roles = mergedRoles
  }

  return {
    hasChanges: Object.keys(updates).length > 0,
    updates,
    mergedRoles
  }
}

function hasAnyRoleOverlap(existingRoles = [], incomingRoles = []) {
  const existing = new Set(normalizeRoleList(existingRoles))
  const incoming = normalizeRoleList(incomingRoles)

  return incoming.some((role) => existing.has(role))
}

function hasSameIdentity(leftPerson, rightPerson) {
  return normalizeNameKey(getFullNameValue(leftPerson)) === normalizeNameKey(getFullNameValue(rightPerson))
}

function shouldPromoteIncomingEmail(currentEmail, incomingEmail) {
  const normalizedCurrentEmail = normalizeEmail(currentEmail)
  const normalizedIncomingEmail = normalizeEmail(incomingEmail)

  if (!normalizedIncomingEmail) {
    return false
  }

  if (!normalizedCurrentEmail) {
    return true
  }

  return isSyntheticOrganizerEmail(normalizedCurrentEmail) && !isSyntheticOrganizerEmail(normalizedIncomingEmail)
}

async function updateManyPersonReferences(model, fieldName, sourceIds = [], targetId) {
  if (!model || !fieldName || !Array.isArray(sourceIds) || sourceIds.length === 0 || !targetId) {
    return { matchedCount: 0, modifiedCount: 0 }
  }

  return model.updateMany(
    { [fieldName]: { $in: sourceIds } },
    { $set: { [fieldName]: targetId } }
  )
}

async function updateLegacyTpiReferences(fieldName, sourceIds = [], targetId) {
  const connection = mongoose.connection
  const db = connection?.db

  if (!db || typeof db.listCollections !== 'function') {
    return { matchedCount: 0, modifiedCount: 0 }
  }

  const collections = await db.listCollections().toArray()
  const legacyCollections = collections
    .map((entry) => entry?.name || '')
    .filter((name) => /^tpiList_\d+$/.test(name))

  if (legacyCollections.length === 0) {
    return { matchedCount: 0, modifiedCount: 0 }
  }

  const updateResults = await Promise.all(
    legacyCollections.map((collectionName) =>
      db.collection(collectionName).updateMany(
        { [fieldName]: { $in: sourceIds } },
        { $set: { [fieldName]: targetId } }
      )
    )
  )

  return updateResults.reduce((acc, result) => ({
    matchedCount: acc.matchedCount + (result?.matchedCount || 0),
    modifiedCount: acc.modifiedCount + (result?.modifiedCount || 0)
  }), { matchedCount: 0, modifiedCount: 0 })
}

async function mergePeopleIntoTarget(targetPersonId, sourcePersonIds = [], options = {}) {
  const targetId = normalizeTextValue(targetPersonId)
  const normalizedSourceIds = normalizePersonIdList(sourcePersonIds).filter((sourceId) => sourceId !== targetId)
  const allowDifferentIdentity = options?.allowDifferentIdentity === true

  if (!targetId || normalizedSourceIds.length === 0) {
    throw new PersonRegistryError('Au moins une fiche source est requise pour la fusion.')
  }

  const targetPerson = await Person.findById(targetId)

  if (!targetPerson) {
    throw new PersonRegistryError('Fiche cible introuvable.', 404)
  }

  const sourcePeople = await Promise.all(
    normalizedSourceIds.map(async (sourceId) => {
      const person = await Person.findById(sourceId)

      if (!person) {
        throw new PersonRegistryError(`Fiche source introuvable: ${sourceId}`, 404)
      }

      if (!allowDifferentIdentity && !hasSameIdentity(targetPerson, person)) {
        throw new PersonRegistryError(
          'Les fiches à fusionner doivent avoir le même prénom et nom.',
          400,
          { targetPersonId: targetId, sourcePersonId: sourceId }
        )
      }

      return person
    })
  )

  let hasTargetChanges = false
  let targetEmailUpdated = false
  const hadTargetShortId = Number.isInteger(Number(targetPerson?.shortId)) && Number(targetPerson.shortId) > 0

  for (const sourcePerson of sourcePeople) {
    const { hasChanges, updates } = mergePersonRecord(targetPerson, sourcePerson)

    if (shouldPromoteIncomingEmail(targetPerson.email, sourcePerson.email)) {
      updates.email = normalizeEmail(sourcePerson.email)
    }

    if (Object.keys(updates).length > 0) {
      Object.assign(targetPerson, updates)
      hasTargetChanges = true
      targetEmailUpdated = targetEmailUpdated || Boolean(updates.email)
      continue
    }

    hasTargetChanges = hasTargetChanges || hasChanges
  }

  if (!hadTargetShortId) {
    await ensurePersonShortId(targetPerson, { persist: false })
    hasTargetChanges = true
  }

  if (hasTargetChanges) {
    await targetPerson.save()
  }

  const sourceObjectIds = normalizedSourceIds.map((sourceId) => new mongoose.Types.ObjectId(sourceId))
  const targetObjectId = new mongoose.Types.ObjectId(targetId)

  const referenceUpdates = await Promise.all([
    updateManyPersonReferences(TpiPlanning, 'candidat', sourceObjectIds, targetObjectId),
    updateManyPersonReferences(TpiPlanning, 'expert1', sourceObjectIds, targetObjectId),
    updateManyPersonReferences(TpiPlanning, 'expert2', sourceObjectIds, targetObjectId),
    updateManyPersonReferences(TpiPlanning, 'chefProjet', sourceObjectIds, targetObjectId),
    updateManyPersonReferences(Slot, 'assignments.candidat', sourceObjectIds, targetObjectId),
    updateManyPersonReferences(Slot, 'assignments.expert1', sourceObjectIds, targetObjectId),
    updateManyPersonReferences(Slot, 'assignments.expert2', sourceObjectIds, targetObjectId),
    updateManyPersonReferences(Slot, 'assignments.chefProjet', sourceObjectIds, targetObjectId),
    updateManyPersonReferences(MagicLink, 'personId', sourceObjectIds, targetObjectId),
    updateLegacyTpiReferences('candidatPersonId', sourceObjectIds, targetObjectId),
    updateLegacyTpiReferences('expert1PersonId', sourceObjectIds, targetObjectId),
    updateLegacyTpiReferences('expert2PersonId', sourceObjectIds, targetObjectId),
    updateLegacyTpiReferences('bossPersonId', sourceObjectIds, targetObjectId)
  ])

  const deleteResult = await Person.deleteMany({ _id: { $in: sourceObjectIds } })

  return {
    success: true,
    merged: true,
    targetPerson,
    mergedSourceIds: normalizedSourceIds,
    deletedCount: deleteResult?.deletedCount || 0,
    targetEmailUpdated,
    referenceUpdates
  }
}

async function findUniqueActivePersonByName(fullName, expectedRoles = []) {
  const candidatePeople = await Person.find({ isActive: true })
    .select('firstName lastName email roles candidateYears isActive')

  const resolved = resolveUniquePersonFromList(fullName, candidatePeople)

  if (!resolved.person) {
    return null
  }

  if (expectedRoles.length > 0 && !hasAnyRoleOverlap(resolved.person.roles, expectedRoles)) {
    return null
  }

  return resolved.person
}

function normalizePersonPayload(input = {}, options = {}) {
  const partial = options.partial === true
  const normalized = {}

  const assignTrimmedField = (fieldName, config = {}) => {
    const { required = false, defaultValue = undefined } = config
    const rawValue = input?.[fieldName]
    const hasValue = rawValue !== undefined || defaultValue !== undefined || required

    if (!hasValue) {
      return
    }

    const value = rawValue === undefined ? defaultValue : rawValue
    const normalizedValue = normalizeTextValue(value)

    if (required && normalizedValue.length === 0) {
      throw new PersonRegistryError(`${fieldName} requis.`)
    }

    if (!partial || rawValue !== undefined) {
      normalized[fieldName] = normalizedValue
    }
  }

  assignTrimmedField('firstName', { required: !partial })
  assignTrimmedField('lastName', { required: !partial })
  assignTrimmedField('phone')
  assignTrimmedField('site')
  assignTrimmedField('entreprise')

  if (!partial || input?.email !== undefined) {
    const email = normalizeEmail(input?.email || '')

    if (!email) {
      throw new PersonRegistryError('Email requis.')
    }

    if (!isValidEmail(email)) {
      throw new PersonRegistryError('Email invalide.')
    }

    normalized.email = email
  }

  if (!partial || input?.roles !== undefined) {
    const roles = normalizeRoleList(input?.roles)

    if (roles.length === 0) {
      throw new PersonRegistryError('Au moins un rôle valide est requis.')
    }

    normalized.roles = roles
  }

  if (!partial || input?.isActive !== undefined) {
    normalized.isActive = normalizeBoolean(input?.isActive, true)
  }

  if (!partial || input?.sendEmails !== undefined) {
    normalized.sendEmails = normalizeBoolean(input?.sendEmails, true)
  }

  if (!partial || input?.candidateYears !== undefined) {
    normalized.candidateYears = normalizeCandidateYears(input?.candidateYears || [])
  }

  if (
    !partial ||
    input?.preferredSoutenanceDates !== undefined ||
    input?.preferredSoutenanceChoices !== undefined
  ) {
    const preferredSoutenanceChoices = normalizePreferredSoutenanceChoices(
      input?.preferredSoutenanceChoices || [],
      input?.preferredSoutenanceDates || []
    )
    normalized.preferredSoutenanceChoices = preferredSoutenanceChoices
    normalized.preferredSoutenanceDates = normalizePreferredSoutenanceDates([], preferredSoutenanceChoices)
  }

  if (!partial || input?.defaultAvailability !== undefined) {
    normalized.defaultAvailability = Array.isArray(input?.defaultAvailability)
      ? input.defaultAvailability
      : []
  }

  if (!partial || input?.unavailableDates !== undefined) {
    normalized.unavailableDates = Array.isArray(input?.unavailableDates)
      ? input.unavailableDates
      : []
  }

  if (normalized.roles && !normalized.roles.includes('candidat')) {
    normalized.candidateYears = []
  }

  return normalized
}

async function ensureEmailIsUnique(email, excludeId = null) {
  const duplicateFilter = { email }

  if (excludeId) {
    duplicateFilter._id = { $ne: excludeId }
  }

  const duplicate = await Person.findOne(duplicateFilter)
  if (duplicate) {
    throw new PersonRegistryError(
      'Une personne avec cet email existe déjà.',
      409,
      { email }
    )
  }
}

async function createOrMergePerson(input) {
  const payload = normalizePersonPayload(input, { partial: false })
  const existingPerson = await Person.findOne({ email: payload.email })

  if (existingPerson) {
    const { hasChanges, updates } = mergePersonRecord(existingPerson, payload)

    if (hasChanges) {
      Object.assign(existingPerson, updates)
      await ensurePersonShortId(existingPerson, { persist: false })
      await existingPerson.save()

      return {
        success: true,
        created: false,
        merged: true,
        person: existingPerson
      }
    }

    return {
      success: true,
      created: false,
      merged: false,
      unchanged: true,
      person: await ensurePersonShortId(existingPerson)
    }
  }

  const existingByName = await findUniqueActivePersonByName(
    getFullNameValue(payload),
    payload.roles
  )

  if (
    existingByName &&
    (isSyntheticOrganizerEmail(existingByName.email) || !normalizeEmail(existingByName.email))
  ) {
    const { hasChanges, updates } = mergePersonRecord(existingByName, payload)
    const normalizedPayloadEmail = normalizeEmail(payload.email)
    const normalizedExistingEmail = normalizeEmail(existingByName.email)

    if (
      normalizedPayloadEmail &&
      normalizedPayloadEmail !== normalizedExistingEmail
    ) {
      updates.email = normalizedPayloadEmail
    }

    if (Object.keys(updates).length > 0) {
      Object.assign(existingByName, updates)
      await ensurePersonShortId(existingByName, { persist: false })
      await existingByName.save()

      return {
        success: true,
        created: false,
        merged: hasChanges || Boolean(updates.email),
        person: existingByName
      }
    }

    return {
      success: true,
      created: false,
      merged: false,
      unchanged: true,
      person: await ensurePersonShortId(existingByName)
    }
  }

  await ensureEmailIsUnique(payload.email)

  const person = new Person(payload)
  await ensurePersonShortId(person, { persist: false })
  await person.save()

  return {
    success: true,
    created: true,
    merged: false,
    unchanged: false,
    person
  }
}

async function updatePerson(personId, input) {
  const payload = normalizePersonPayload(input, { partial: true })

  if (payload.email) {
    await ensureEmailIsUnique(payload.email, personId)
  }

  const person = await Person.findByIdAndUpdate(
    personId,
    payload,
    {
      new: true,
      runValidators: true
    }
  )

  if (!person) {
    return null
  }

  return await ensurePersonShortId(person)
}

module.exports = {
  ALLOWED_ROLES,
  PersonRegistryError,
  createOrMergePerson,
  ensureEmailIsUnique,
  filterPeopleByRole,
  mapParticipantRoleToRegistryRole,
  mergePersonRecord,
  mergeRoles,
  normalizeCandidateYears,
  normalizePersonPayload,
  normalizeRoleList,
  normalizeRoles,
  personHasRole,
  resolveUniquePersonForRole,
  mergePeopleIntoTarget,
  normalizePreferredSoutenanceDates,
  normalizePreferredSoutenanceChoices,
  updatePerson
}
