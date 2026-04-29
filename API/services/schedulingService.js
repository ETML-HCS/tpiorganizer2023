/**
 * Service de génération et matching des créneaux
 * Implémente les règles métier de planification des TPI
 */

const mongoose = require('mongoose')
const Slot = require('../models/slotModel')
const Person = require('../models/personModel')
const TpiPlanning = require('../models/tpiPlanningModel')
const Vote = require('../models/voteModel')
const { getRoomCompatibilityReport } = require('./roomClassCompatibilityService')
const {
  buildOccupiedStepKeys,
  buildTimelineIndex,
  getMaxConsecutiveTpiLimit,
  MAX_CONSECUTIVE_TPI,
  OCCUPIED_SLOT_STATUSES,
  slotContainsPerson,
  toTimeStepKey
} = require('./planningRuleUtils')

// Constantes
const VOTING_DEADLINE_DAYS = 7

function getPersonDisplayName(person) {
  if (!person) {
    return 'Personne inconnue'
  }

  if (typeof person.fullName === 'string' && person.fullName.trim()) {
    return person.fullName.trim()
  }

  const pieces = [person.firstName, person.lastName]
    .filter(value => typeof value === 'string' && value.trim().length > 0)
    .map(value => value.trim())

  if (pieces.length > 0) {
    return pieces.join(' ')
  }

  return String(person._id || person.id || 'Personne inconnue')
}

function toIdString(value) {
  if (!value) {
    return ''
  }

  return String(value?._id || value?.id || value)
}

/**
 * Génère tous les créneaux pour une période donnée
 * @param {Number} year - Année de défense
 * @param {Array} dates - Liste des dates de défense
 * @param {Object} siteConfig - Configuration du site (salles, périodes, etc.)
 */
async function generateSlotsForPeriod(year, dates, siteConfig) {
  const results = []
  
  for (const date of dates) {
    const slots = await Slot.generateDaySlots(year, date, siteConfig.site, siteConfig)
    results.push(...slots)
  }
  
  return results
}

/**
 * Trouve les créneaux disponibles pour un TPI
 * Prend en compte les disponibilités du chef de projet
 * @param {ObjectId} tpiPlanningId - ID du TPI
 * @returns {Array} Liste des créneaux disponibles avec scores
 */
async function findAvailableSlotsForTpi(tpiPlanningId) {
  const tpi = await TpiPlanning.findById(tpiPlanningId)
    .populate('candidat expert1 expert2 chefProjet')
  
  if (!tpi) {
    throw new Error('TPI non trouvé')
  }
  
  // Récupérer tous les créneaux disponibles pour l'année
  const availableSlots = await Slot.find({
    year: tpi.year,
    status: 'available'
  }).sort({ date: 1, period: 1 })
  
  const scoredSlots = []
  
  for (const slot of availableSlots) {
    const score = await calculateSlotScore(slot, tpi)
    
    if (score.isValid) {
      scoredSlots.push({
        slot: slot._id,
        score: score.totalScore,
        reason: score.reasons.join(', '),
        availability: score.availability
      })
    }
  }
  
  // Trier par score décroissant
  scoredSlots.sort((a, b) => b.score - a.score)
  
  return scoredSlots
}

/**
 * Calcule le score d'un créneau pour un TPI
 * @param {Object} slot - Le créneau à évaluer
 * @param {Object} tpi - Le TPI avec les personnes peuplées
 * @returns {Object} Score et raisons
 */
async function calculateSlotScore(slot, tpi) {
  const result = {
    isValid: true,
    totalScore: 0,
    reasons: [],
    availability: {
      candidat: false,
      expert1: false,
      expert2: false,
      chefProjet: false
    }
  }
  
  const date = slot.date
  const period = slot.period
  const compatibility = getRoomCompatibilityReport(slot?.room, tpi)

  if (!compatibility.compatible) {
    result.isValid = false
    result.reasons.push(`Salle incompatible: ${slot?.room?.name || 'salle inconnue'}`)
    return result
  }
  
  // 1. Vérifier la disponibilité du chef de projet (PRIORITAIRE)
  const chefProjetAvailable = await checkPersonAvailability(tpi.chefProjet, date, period, slot._id)
  result.availability.chefProjet = chefProjetAvailable.available
  
  if (!chefProjetAvailable.available) {
    result.isValid = false
    result.reasons.push(`Chef de projet non disponible: ${chefProjetAvailable.reason}`)
    return result
  }
  result.totalScore += 30 // Bonus fort pour disponibilité chef de projet
  result.reasons.push('Chef de projet disponible')
  
  // 2. Vérifier le candidat
  const candidatAvailable = await checkPersonAvailability(tpi.candidat, date, period, slot._id)
  result.availability.candidat = candidatAvailable.available
  
  if (!candidatAvailable.available) {
    result.isValid = false
    result.reasons.push(`Candidat non disponible: ${candidatAvailable.reason}`)
    return result
  }
  result.totalScore += 25
  result.reasons.push('Candidat disponible')
  
  // 3. Vérifier les experts (on peut proposer même si non disponibles, ils voteront)
  const expert1Available = await checkPersonAvailability(tpi.expert1, date, period, slot._id)
  result.availability.expert1 = expert1Available.available
  
  if (expert1Available.available) {
    result.totalScore += 20
    result.reasons.push('Expert 1 disponible')
  } else {
    result.totalScore -= 5
    result.reasons.push(`Expert 1 à confirmer: ${expert1Available.reason}`)
  }
  
  const expert2Available = await checkPersonAvailability(tpi.expert2, date, period, slot._id)
  result.availability.expert2 = expert2Available.available
  
  if (expert2Available.available) {
    result.totalScore += 20
    result.reasons.push('Expert 2 disponible')
  } else {
    result.totalScore -= 5
    result.reasons.push(`Expert 2 à confirmer: ${expert2Available.reason}`)
  }
  
  // 4. Vérifier la règle des TPI consécutifs
  const consecutiveCheck = await checkConsecutiveRule([
    tpi.candidat?._id || tpi.candidat,
    tpi.expert1._id,
    tpi.expert2._id,
    tpi.chefProjet._id
  ], date, period, {
    maxConsecutiveTpi: slot?.config?.maxConsecutiveTpi
  })
  
  if (!consecutiveCheck.valid) {
    result.reasons.push(`Attention: ${consecutiveCheck.reason}`)
    result.isValid = false
    return result
  }
  
  // 5. Bonus si le site correspond
  if (slot.room.site === tpi.site) {
    result.totalScore += 10
    result.reasons.push('Site correspondant')
  }
  
  return result
}

/**
 * Vérifie la disponibilité d'une personne sur un créneau
 */
async function checkPersonAvailability(person, date, period, slotId) {
  if (!person) {
    return { available: false, reason: 'Personne non renseignée' }
  }

  // 1. Vérifier les disponibilités par défaut et exceptions
  if (typeof person.isAvailableOn === 'function' && !person.isAvailableOn(date, period)) {
    return { available: false, reason: 'Indisponibilité déclarée' }
  }
  
  // 2. Vérifier s'il n'est pas déjà assigné à un autre TPI
  const existingAssignment = await Slot.findOne({
    _id: { $ne: slotId },
    date: date,
    period: period,
    status: { $in: OCCUPIED_SLOT_STATUSES },
    $or: [
      { 'assignments.candidat': person._id },
      { 'assignments.expert1': person._id },
      { 'assignments.expert2': person._id },
      { 'assignments.chefProjet': person._id }
    ]
  })
  
  if (existingAssignment) {
    return { available: false, reason: 'Déjà assigné à un autre TPI' }
  }
  
  return { available: true, reason: '' }
}

/**
 * Vérifie la règle des TPI consécutifs max
 */
async function checkConsecutiveRule(personIds, date, period, options = {}) {
  const candidateDate = new Date(date)
  const year = candidateDate.getFullYear()
  const candidateKey = toTimeStepKey(candidateDate, period)
  const maxConsecutiveTpi = getMaxConsecutiveTpiLimit(options?.maxConsecutiveTpi, MAX_CONSECUTIVE_TPI)

  if (!candidateKey) {
    return { valid: true, reason: '' }
  }

  const allSlots = await Slot.find({ year })
    .select('date period status assignments room')
    .sort({ date: 1, period: 1, 'room.name': 1 })

  const timeline = buildTimelineIndex(allSlots)
  const candidateIndex = timeline.indexByKey.get(candidateKey)

  if (candidateIndex === undefined) {
    return { valid: true, reason: '' }
  }

  const normalizedPersonIds = [...new Set(
    (personIds || [])
      .filter(Boolean)
      .map(personId => String(personId))
  )]

  for (const personId of normalizedPersonIds) {
    const occupiedStepKeys = buildOccupiedStepKeys(allSlots, personId)
    occupiedStepKeys.add(candidateKey)

    let leftIndex = candidateIndex
    while (leftIndex > 0 && occupiedStepKeys.has(timeline.timeSteps[leftIndex - 1])) {
      leftIndex -= 1
    }

    let rightIndex = candidateIndex
    while (rightIndex < timeline.timeSteps.length - 1 && occupiedStepKeys.has(timeline.timeSteps[rightIndex + 1])) {
      rightIndex += 1
    }

    const consecutive = rightIndex - leftIndex + 1
    if (consecutive > maxConsecutiveTpi) {
      const person = await Person.findById(personId)
      const personName = getPersonDisplayName(person)

      return {
        valid: false,
        reason: `${personName} a déjà ${consecutive} TPI consécutifs. Une pause d'un créneau est requise.`
      }
    }
  }

  return { valid: true, reason: '' }
}

/**
 * Propose des créneaux pour un TPI et initie le vote
 */
async function proposeSlotsAndInitiateVoting(tpiPlanningId, maxSlots = 4) {
  const tpi = await TpiPlanning.findById(tpiPlanningId)
  
  if (!tpi) {
    throw new Error('TPI non trouvé')
  }
  
  // 1. Trouver les créneaux disponibles
  const availableSlots = await findAvailableSlotsForTpi(tpiPlanningId)
  
  if (availableSlots.length === 0) {
    // Aucun créneau disponible - intervention manuelle requise
    tpi.status = 'manual_required'
    tpi.conflicts.push({
      type: 'no_common_slot',
      description: 'Aucun créneau disponible pour toutes les personnes',
      detectedAt: new Date()
    })
    await tpi.save()
    
    return {
      success: false,
      message: 'Aucun créneau disponible, intervention manuelle requise',
      tpi
    }
  }
  
  // 2. Sélectionner les meilleurs créneaux (1 date fixée + jusqu'à 3 alternatives)
  const selectedSlots = availableSlots.slice(0, maxSlots)
  
  // 3. Mettre à jour le TPI avec les créneaux proposés
  tpi.proposedSlots = selectedSlots
  tpi.status = 'voting'
  tpi.votingSession = {
    startedAt: new Date(),
    deadline: new Date(Date.now() + VOTING_DEADLINE_DAYS * 24 * 60 * 60 * 1000),
    remindersCount: 0,
    voteSummary: {
      expert1Voted: false,
      expert2Voted: false,
      chefProjetVoted: false
    }
  }
  
  await tpi.save()
  
  // 4. Créer les votes en attente pour chaque créneau et chaque personne
  const voters = [
    { person: tpi.expert1, role: 'expert1' },
    { person: tpi.expert2, role: 'expert2' },
    { person: tpi.chefProjet, role: 'chef_projet' }
  ]
  
  for (const slotInfo of selectedSlots) {
    for (const voter of voters) {
      await Vote.create({
        tpiPlanning: tpi._id,
        slot: slotInfo.slot,
        voter: voter.person,
        voterRole: voter.role,
        decision: 'pending'
      })
    }
    
    // Mettre à jour le statut du créneau
    await Slot.findByIdAndUpdate(slotInfo.slot, { status: 'proposed' })
  }
  
  // 5. Ajouter à l'historique
  await tpi.addHistory('slots_proposed', null, {
    slotsCount: selectedSlots.length,
    deadline: tpi.votingSession.deadline
  })
  
  return {
    success: true,
    message: `${selectedSlots.length} créneaux proposés, en attente de votes`,
    tpi,
    proposedSlots: selectedSlots
  }
}

/**
 * Enregistre un vote et vérifie si la validation automatique est possible
 */
async function registerVoteAndCheckValidation(voteId, decision, comment = '') {
  const vote = await Vote.findById(voteId)
  
  if (!vote) {
    throw new Error('Vote non trouvé')
  }
  
  // Enregistrer le vote
  vote.decision = decision
  vote.comment = comment
  vote.votedAt = new Date()
  await vote.save()
  
  // Mettre à jour le résumé des votes dans le TPI
  const tpi = await TpiPlanning.findById(vote.tpiPlanning)
  
  if (vote.voterRole === 'expert1') {
    tpi.votingSession.voteSummary.expert1Voted = true
  } else if (vote.voterRole === 'expert2') {
    tpi.votingSession.voteSummary.expert2Voted = true
  } else if (vote.voterRole === 'chef_projet') {
    tpi.votingSession.voteSummary.chefProjetVoted = true
  }
  
  await tpi.save()
  
  // Vérifier si tous les votes sont collectés pour au moins un créneau
  const unanimousSlot = await Vote.findUnanimousSlot(tpi._id)
  
  if (unanimousSlot) {
    // Validation automatique possible !
    return await confirmSlotForTpi(tpi._id, unanimousSlot)
  }
  
  // Vérifier si tous ont voté mais sans consensus
  if (tpi.areAllVotesIn()) {
    // Chercher le meilleur compromis
    const bestSlot = await findBestCompromiseSlot(tpi._id)
    
    if (bestSlot) {
      tpi.status = 'pending_validation'
      await tpi.save()
      
      return {
        success: true,
        message: 'Tous les votes collectés, validation manuelle requise',
        suggestedSlot: bestSlot,
        tpi
      }
    } else {
      tpi.status = 'manual_required'
      await tpi.save()
      
      return {
        success: false,
        message: 'Aucun consensus trouvé, intervention manuelle requise',
        tpi
      }
    }
  }
  
  return {
    success: true,
    message: 'Vote enregistré, en attente des autres votes',
    tpi
  }
}

/**
 * Trouve le meilleur compromis parmi les créneaux votés
 */
async function findBestCompromiseSlot(tpiPlanningId) {
  const pipeline = [
    { $match: { tpiPlanning: new mongoose.Types.ObjectId(tpiPlanningId) } },
    { $group: {
      _id: '$slot',
      acceptedCount: {
        $sum: { $cond: [{ $in: ['$decision', ['accepted', 'preferred']] }, 1, 0] }
      },
      preferredCount: {
        $sum: { $cond: [{ $eq: ['$decision', 'preferred'] }, 1, 0] }
      },
      rejectedCount: {
        $sum: { $cond: [{ $eq: ['$decision', 'rejected'] }, 1, 0] }
      }
    }},
    { $match: { rejectedCount: { $lt: 2 } } }, // Max 1 rejet
    { $sort: { preferredCount: -1, acceptedCount: -1 } },
    { $limit: 1 }
  ]
  
  const result = await Vote.aggregate(pipeline)
  return result.length > 0 ? result[0]._id : null
}

/**
 * Confirme un créneau pour un TPI
 */
function getSlotId(value) {
  return toIdString(value?.slot || value)
}

function getTpiSlotIds(tpi) {
  const slotIds = new Set()
  const confirmedSlotId = getSlotId(tpi?.confirmedSlot)

  if (confirmedSlotId) {
    slotIds.add(confirmedSlotId)
  }

  for (const proposedSlot of Array.isArray(tpi?.proposedSlots) ? tpi.proposedSlots : []) {
    const proposedSlotId = getSlotId(proposedSlot)
    if (proposedSlotId) {
      slotIds.add(proposedSlotId)
    }
  }

  return Array.from(slotIds)
}

function getTpiCurrentSlotId(tpi) {
  const confirmedSlotId = getSlotId(tpi?.confirmedSlot)
  if (confirmedSlotId) {
    return confirmedSlotId
  }

  const fixedProposal = Array.isArray(tpi?.proposedSlots)
    ? tpi.proposedSlots.find((proposedSlot) => getSlotId(proposedSlot))
    : null

  return getSlotId(fixedProposal)
}

function getTpiAssignmentPayload(tpi) {
  return {
    candidat: tpi.candidat,
    expert1: tpi.expert1,
    expert2: tpi.expert2,
    chefProjet: tpi.chefProjet
  }
}

async function releaseTpiSlotsExcept(tpi, selectedSlotId) {
  const targetTpiId = toIdString(tpi?._id)
  const selectedId = toIdString(selectedSlotId)
  const slotIdsToRelease = getTpiSlotIds(tpi).filter((slotId) => slotId && slotId !== selectedId)

  if (!targetTpiId || slotIdsToRelease.length === 0) {
    return
  }

  await Slot.updateMany(
    {
      _id: { $in: slotIdsToRelease },
      $or: [
        { assignedTpi: tpi._id },
        { assignedTpi: null },
        { assignedTpi: { $exists: false } }
      ]
    },
    {
      $set: {
        status: 'available',
        assignedTpi: null,
        assignments: {}
      }
    }
  )
}

function formatSlotLabel(slot) {
  if (!slot) {
    return ''
  }

  const date = new Date(slot.date)
  const dateLabel = Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('fr-CH')
  const timeLabel = [slot.startTime, slot.endTime].filter(Boolean).join('-')
  const roomLabel = slot.room?.name || ''

  return [dateLabel, timeLabel, roomLabel].filter(Boolean).join(' · ')
}

function serializeSlotForPlanning(slot) {
  if (!slot) {
    return null
  }

  const rawSlot = typeof slot.toObject === 'function'
    ? slot.toObject()
    : slot
  const assignedTpi = rawSlot.assignedTpi && typeof rawSlot.assignedTpi === 'object'
    ? rawSlot.assignedTpi
    : null

  return {
    _id: toIdString(rawSlot),
    label: formatSlotLabel(rawSlot),
    date: rawSlot.date || null,
    period: rawSlot.period || null,
    startTime: rawSlot.startTime || '',
    endTime: rawSlot.endTime || '',
    room: rawSlot.room || null,
    status: rawSlot.status || '',
    assignedTpi: assignedTpi
      ? {
          _id: toIdString(assignedTpi),
          reference: assignedTpi.reference || '',
          candidat: getPersonDisplayName(assignedTpi.candidat)
        }
      : rawSlot.assignedTpi
        ? { _id: toIdString(rawSlot.assignedTpi) }
        : null
  }
}

async function confirmSlotForTpi(tpiPlanningId, slotId, options = {}) {
  const tpi = await TpiPlanning.findById(tpiPlanningId)
  const slot = await Slot.findById(slotId)
  
  if (!tpi || !slot) {
    throw new Error('TPI ou créneau non trouvé')
  }
  
  // Vérifier une dernière fois les conflits
  const finalCheck = await checkFinalConflicts(tpi, slot, {
    ignoreSlotIds: options.ignoreSlotIds || []
  })
  
  if (!finalCheck.valid) {
    return {
      success: false,
      message: `Conflit détecté: ${finalCheck.reason}`,
      conflicts: finalCheck.conflicts
    }
  }

  const alreadyHadConfirmedSlot = Boolean(getSlotId(tpi.confirmedSlot))

  await releaseTpiSlotsExcept(tpi, slot._id)
  
  // Confirmer le créneau
  slot.status = 'confirmed'
  slot.assignedTpi = tpi._id
  slot.assignments = getTpiAssignmentPayload(tpi)
  await slot.save()
  
  // Mettre à jour le TPI
  tpi.status = 'confirmed'
  tpi.confirmedSlot = slot._id
  tpi.soutenanceDateTime = slot.date
  tpi.soutenanceRoom = slot.room?.name || ''

  if (options.manualOverride) {
    tpi.manualOverride = options.manualOverride
  }
  
  await tpi.addHistory(options.historyAction || 'slot_confirmed', options.historyUser || null, {
    slotId: slot._id,
    date: slot.date,
    room: slot.room?.name || '',
    ...(options.historyDetails || {})
  })
  
  // Mettre à jour les statistiques des personnes
  await updatePersonStats(tpi, slot, {
    incrementCounts: !alreadyHadConfirmedSlot
  })
  
  return {
    success: true,
    message: 'Créneau confirmé avec succès',
    tpi,
    slot
  }
}

/**
 * Vérifie les conflits finaux avant confirmation
 */
async function checkFinalConflicts(tpi, slot, options = {}) {
  const conflicts = []
  const personIds = [tpi.candidat, tpi.expert1, tpi.expert2, tpi.chefProjet]
  const compatibility = getRoomCompatibilityReport(slot?.room, tpi)
  const slotAssignedTpi = toIdString(slot?.assignedTpi)
  const targetTpiId = toIdString(tpi?._id)
  const ignoredSlotIds = new Set(
    (Array.isArray(options.ignoreSlotIds) ? options.ignoreSlotIds : [])
      .map(toIdString)
      .filter(Boolean)
  )
  const slotId = toIdString(slot)

  if (slotAssignedTpi && targetTpiId && slotAssignedTpi !== targetTpiId && !ignoredSlotIds.has(slotId)) {
    conflicts.push({
      type: 'room_overlap',
      roomName: slot?.room?.name || '',
      roomSite: slot?.room?.site || '',
      conflictingTpi: slotAssignedTpi,
      description: 'Ce créneau est déjà réservé par un autre TPI.'
    })
  }

  if (!compatibility.compatible) {
    conflicts.push({
      type: 'room_class_mismatch',
      roomName: slot?.room?.name || '',
      roomSite: slot?.room?.site || '',
      roomClassMode: compatibility.roomClassMode,
      tpiClassMode: compatibility.tpiClassMode
    })
  }
  
  for (const personId of personIds) {
    const conflict = await Slot.findOne({
      _id: { $nin: [slot._id, ...Array.from(ignoredSlotIds)] },
      date: slot.date,
      period: slot.period,
      status: { $in: OCCUPIED_SLOT_STATUSES },
      $or: [
        { 'assignments.candidat': personId },
        { 'assignments.expert1': personId },
        { 'assignments.expert2': personId },
        { 'assignments.chefProjet': personId }
      ]
    })
    
    if (conflict) {
      const person = await Person.findById(personId)
      conflicts.push({
        type: 'person_overlap',
        person: getPersonDisplayName(person),
        conflictingSlot: conflict._id
      })
    }
  }
  
  return {
    valid: conflicts.length === 0,
    reason: conflicts.some((conflict) => conflict.type === 'room_class_mismatch')
      ? 'Incompatibilité de salle détectée'
      : conflicts.some((conflict) => conflict.type === 'room_overlap')
        ? 'Créneau déjà réservé par un autre TPI'
      : conflicts.length > 0
        ? 'Conflit de personnes détecté'
        : '',
    conflicts
  }
}

async function getMoveSimulationContext(tpiPlanningId, slotId) {
  const tpi = await TpiPlanning.findById(tpiPlanningId)
    .populate('confirmedSlot')
    .populate('proposedSlots.slot')

  const targetSlot = await Slot.findById(slotId)
    .populate({
      path: 'assignedTpi',
      select: 'reference candidat',
      populate: {
        path: 'candidat',
        select: 'firstName lastName'
      }
    })

  if (!tpi || !targetSlot) {
    throw new Error('TPI ou créneau non trouvé')
  }

  return {
    tpi,
    targetSlot,
    currentSlotId: getTpiCurrentSlotId(tpi),
    ownedSlotIds: getTpiSlotIds(tpi)
  }
}

async function simulateTpiMoveToSlot(tpiPlanningId, slotId) {
  const { tpi, targetSlot, currentSlotId, ownedSlotIds } = await getMoveSimulationContext(tpiPlanningId, slotId)
  const targetSlotId = toIdString(targetSlot)

  const finalCheck = await checkFinalConflicts(tpi, targetSlot, {
    ignoreSlotIds: ownedSlotIds.filter((ownedSlotId) => ownedSlotId !== targetSlotId)
  })

  const blockingOccupant = targetSlot.assignedTpi &&
    toIdString(targetSlot.assignedTpi) !== toIdString(tpi._id)
      ? targetSlot.assignedTpi
      : null

  let swapCandidate = null
  if (blockingOccupant && currentSlotId) {
    const currentSlot = await Slot.findById(currentSlotId)
    const occupantTpi = await TpiPlanning.findById(blockingOccupant._id || blockingOccupant)

    if (currentSlot && occupantTpi) {
      const swapCheck = await checkFinalConflicts(occupantTpi, currentSlot, {
        ignoreSlotIds: [targetSlotId, currentSlotId]
      })

      swapCandidate = {
        canSwap: swapCheck.valid,
        tpi: {
          _id: toIdString(occupantTpi),
          reference: occupantTpi.reference || ''
        },
        targetSlot: serializeSlotForPlanning(currentSlot),
        conflicts: swapCheck.conflicts || [],
        message: swapCheck.valid
          ? 'Inversion théoriquement possible avec le créneau actuel du TPI.'
          : `Inversion bloquée: ${swapCheck.reason || 'conflit détecté'}.`
      }
    }
  }

  return {
    success: true,
    canMove: finalCheck.valid,
    status: finalCheck.valid ? 'clear' : 'blocked',
    message: finalCheck.valid
      ? 'Déplacement possible sans conflit détecté.'
      : `Déplacement bloqué: ${finalCheck.reason || 'conflit détecté'}.`,
    tpi: {
      _id: toIdString(tpi),
      reference: tpi.reference || ''
    },
    currentSlot: serializeSlotForPlanning(tpi.confirmedSlot || tpi.proposedSlots?.[0]?.slot),
    targetSlot: serializeSlotForPlanning(targetSlot),
    conflicts: finalCheck.conflicts || [],
    swapCandidate
  }
}

async function moveTpiToSlot(tpiPlanningId, slotId, adminId, reason = '') {
  const simulation = await simulateTpiMoveToSlot(tpiPlanningId, slotId)

  if (!simulation.canMove) {
    return {
      ...simulation,
      success: false
    }
  }

  const tpi = await TpiPlanning.findById(tpiPlanningId)
  if (!tpi) {
    throw new Error('TPI non trouvé')
  }

  const overriddenBy = adminId && mongoose.Types.ObjectId.isValid(adminId)
    ? new mongoose.Types.ObjectId(adminId)
    : null
  const targetReason = reason || `Déplacement admin suite à proposition de vote vers ${simulation.targetSlot?.label || slotId}.`

  const result = await confirmSlotForTpi(tpiPlanningId, slotId, {
    ignoreSlotIds: getTpiSlotIds(tpi).filter((ownedSlotId) => ownedSlotId !== toIdString(slotId)),
    historyAction: 'slot_moved_from_vote_proposal',
    historyUser: overriddenBy,
    manualOverride: {
      isManual: true,
      reason: targetReason,
      overriddenBy,
      overriddenAt: new Date()
    },
    historyDetails: {
      reason: targetReason,
      previousSlotId: simulation.currentSlot?._id || null,
      source: 'vote_proposal'
    }
  })

  return {
    ...result,
    simulation,
    moved: Boolean(result?.success)
  }
}

/**
 * Met à jour les statistiques des personnes après confirmation
 */
async function updatePersonStats(tpi, slot, options = {}) {
  const incrementCounts = options.incrementCounts !== false
  const updates = [
    { id: tpi.expert1, field: 'tpiAsExpert' },
    { id: tpi.expert2, field: 'tpiAsExpert' },
    { id: tpi.chefProjet, field: 'tpiAsChefProjet' }
  ]
  
  for (const update of updates) {
    const updatePayload = {
      $set: { 'stats.lastTpiDate': slot.date }
    }

    if (incrementCounts) {
      updatePayload.$inc = { [`stats.${update.field}`]: 1 }
    }

    await Person.findByIdAndUpdate(update.id, updatePayload)
  }
}

/**
 * Force un créneau manuellement (intervention admin)
 */
async function forceSlotManually(tpiPlanningId, slotId, adminId, reason) {
  const tpi = await TpiPlanning.findById(tpiPlanningId)
  
  if (!tpi) {
    throw new Error('TPI non trouvé')
  }

  const overriddenBy = adminId && mongoose.Types.ObjectId.isValid(adminId)
    ? new mongoose.Types.ObjectId(adminId)
    : null

  return await confirmSlotForTpi(tpiPlanningId, slotId, {
    manualOverride: {
      isManual: true,
      reason,
      overriddenBy,
      overriddenAt: new Date()
    },
    historyUser: overriddenBy,
    historyDetails: {
      reason,
      source: 'manual_override'
    }
  })
}

module.exports = {
  generateSlotsForPeriod,
  findAvailableSlotsForTpi,
  proposeSlotsAndInitiateVoting,
  registerVoteAndCheckValidation,
  confirmSlotForTpi,
  forceSlotManually,
  simulateTpiMoveToSlot,
  moveTpiToSlot,
  checkPersonAvailability,
  checkConsecutiveRule,
  MAX_CONSECUTIVE_TPI,
  VOTING_DEADLINE_DAYS
}
