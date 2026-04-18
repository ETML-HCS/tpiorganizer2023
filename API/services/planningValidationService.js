const crypto = require('crypto')

const PlanningSnapshot = require('../models/planningSnapshotModel')
const Person = require('../models/personModel')
const Slot = require('../models/slotModel')
const TpiPlanning = require('../models/tpiPlanningModel')
const TpiModelsYear = require('../models/tpiModels')
const { filterPlanifiableTpis } = require('./tpiPlanningVisibility')
const { isExternalPlanningSite } = require('./tpiPlanningVisibility')
const {
  buildOccupiedStepKeys,
  buildTimelineIndex,
  MAX_CONSECUTIVE_TPI,
  OCCUPIED_SLOT_STATUSES,
  toTimeStepKey
} = require('./planningRuleUtils')
const { getRoomCompatibilityReport } = require('./roomClassCompatibilityService')
const { validateLegacyTpiStakeholders } = require('./tpiStakeholderService')

class PlanningFreezeError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'PlanningFreezeError'
    this.statusCode = 409
    this.details = details
  }
}

function toIsoDateKey(rawDate) {
  if (!rawDate) {
    return ''
  }

  const date = new Date(rawDate)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().split('T')[0]
}

function normalizeText(value) {
  return String(value || '').trim()
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeText(value)
    if (normalized) {
      return normalized
    }
  }

  return ''
}

function toRoomModeLabel(mode) {
  return mode === 'matu' ? 'MATU' : ''
}

function toPersonView(person, fallbackRole) {
  if (!person) {
    return {
      role: fallbackRole,
      personId: null,
      fullName: ''
    }
  }

  const personId = person?._id
    ? String(person._id)
    : typeof person === 'string'
      ? person
      : null

  const fullName = [person?.firstName, person?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()

  return {
    role: fallbackRole,
    personId,
    fullName
  }
}

function buildPlanningEntryFromTpi(tpi) {
  const plannedSlot =
    tpi?.confirmedSlot ||
    tpi?.proposedSlots?.find(proposedSlot => proposedSlot?.slot)?.slot ||
    null

  if (!plannedSlot) {
    return null
  }

  const slot = plannedSlot
  const slotDate = slot.date ? new Date(slot.date) : null

  return {
    tpiId: String(tpi._id),
    reference: tpi.reference || '',
    status: tpi.status || '',
    classe: normalizeText(tpi.classe),
    slot: {
      slotId: slot._id ? String(slot._id) : null,
      date: slotDate ? slotDate.toISOString() : null,
      dateKey: toIsoDateKey(slotDate),
      period: slot.period || null,
      startTime: slot.startTime || '',
      endTime: slot.endTime || '',
      room: {
        site: slot.room?.site || '',
        name: slot.room?.name || ''
      }
    },
    participants: [
      toPersonView(tpi.candidat, 'candidat'),
      toPersonView(tpi.expert1, 'expert1'),
      toPersonView(tpi.expert2, 'expert2'),
      toPersonView(tpi.chefProjet, 'chef_projet')
    ]
  }
}

function compareEntries(a, b) {
  const aSlot = a.slot || {}
  const bSlot = b.slot || {}

  const left = [
    aSlot.dateKey || '',
    String(aSlot.period || 0),
    aSlot.room?.site || '',
    aSlot.room?.name || '',
    a.reference || ''
  ].join('|')

  const right = [
    bSlot.dateKey || '',
    String(bSlot.period || 0),
    bSlot.room?.site || '',
    bSlot.room?.name || '',
    b.reference || ''
  ].join('|')

  return left.localeCompare(right)
}

function buildEntriesFromTpis(tpis) {
  return tpis
    .map(buildPlanningEntryFromTpi)
    .filter(Boolean)
    .sort(compareEntries)
}

function buildSlotKey(slot) {
  return `${slot.dateKey}|${slot.period}`
}

function buildRoomKey(slot) {
  return `${slot.dateKey}|${slot.period}|${slot.room?.site || ''}|${slot.room?.name || ''}`
}

function addToSetMap(targetMap, key, value) {
  if (!targetMap.has(key)) {
    targetMap.set(key, new Set())
  }

  targetMap.get(key).add(value)
}

function detectHardConflicts(entries) {
  const personAccumulator = new Map()
  const roomAccumulator = new Map()

  for (const entry of entries) {
    const slotKey = buildSlotKey(entry.slot)
    const roomKey = buildRoomKey(entry.slot)

    addToSetMap(roomAccumulator, roomKey, entry.reference)

    for (const participant of entry.participants || []) {
      if (!participant.personId) {
        continue
      }

      const personKey = `${slotKey}|${participant.personId}`
      if (!personAccumulator.has(personKey)) {
        personAccumulator.set(personKey, {
          slotKey,
          roleSamples: new Set(),
          personId: participant.personId,
          personName: participant.fullName || '',
          references: new Set()
        })
      }

      const current = personAccumulator.get(personKey)
      current.roleSamples.add(participant.role)
      current.references.add(entry.reference)
      if (!current.personName && participant.fullName) {
        current.personName = participant.fullName
      }
    }
  }

  const personOverlaps = []
  for (const value of personAccumulator.values()) {
    const references = Array.from(value.references)
    if (references.length < 2) {
      continue
    }

    const [dateKey, periodText] = value.slotKey.split('|')
    personOverlaps.push({
      type: 'person_overlap',
      dateKey,
      period: Number.parseInt(periodText, 10),
      personId: value.personId,
      personName: value.personName,
      roles: Array.from(value.roleSamples),
      references: references.sort()
    })
  }

  const roomOverlaps = []
  for (const [roomKey, referencesSet] of roomAccumulator.entries()) {
    const references = Array.from(referencesSet)
    if (references.length < 2) {
      continue
    }

    const [dateKey, periodText, site, roomName] = roomKey.split('|')
    roomOverlaps.push({
      type: 'room_overlap',
      dateKey,
      period: Number.parseInt(periodText, 10),
      site,
      roomName,
      references: references.sort()
    })
  }

  personOverlaps.sort((left, right) => {
    const leftKey = `${left.dateKey}|${left.period}|${left.personName}|${left.personId}`
    const rightKey = `${right.dateKey}|${right.period}|${right.personName}|${right.personId}`
    return leftKey.localeCompare(rightKey)
  })

  roomOverlaps.sort((left, right) => {
    const leftKey = `${left.dateKey}|${left.period}|${left.site}|${left.roomName}`
    const rightKey = `${right.dateKey}|${right.period}|${right.site}|${right.roomName}`
    return leftKey.localeCompare(rightKey)
  })

  const hardConflicts = [...personOverlaps, ...roomOverlaps]

  return {
    hardConflicts,
    personOverlaps,
    roomOverlaps,
    summary: {
      hasHardConflicts: hardConflicts.length > 0,
      hardConflictCount: hardConflicts.length,
      personOverlapCount: personOverlaps.length,
      roomOverlapCount: roomOverlaps.length
    }
  }
}

function normalizePersonId(person) {
  if (!person) {
    return null
  }

  if (typeof person === 'string') {
    return person
  }

  if (person._id) {
    return String(person._id)
  }

  return null
}

function getPersonDisplayName(person) {
  if (!person) {
    return 'Personne inconnue'
  }

  return [person.firstName, person.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Personne inconnue'
}

function formatSlotLabel(slot) {
  if (!slot) {
    return 'créneau inconnu'
  }

  const date = new Date(slot.date)
  const dateLabel = Number.isNaN(date.getTime())
    ? String(slot.date || '').trim()
    : date.toLocaleDateString('fr-CH', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit'
      })

  const periodLabel = Number.isInteger(Number(slot.period))
    ? `P${Number(slot.period)}`
    : 'P?'
  const roomLabel = [slot.room?.site, slot.room?.name].filter(Boolean).join(' ')

  return [dateLabel, periodLabel, roomLabel].filter(Boolean).join(' • ')
}

function detectSequenceViolations(slots) {
  const timeline = buildTimelineIndex(slots)
  const personMetadata = new Map()

  for (const slot of slots) {
    if (!OCCUPIED_SLOT_STATUSES.includes(slot.status)) {
      continue
    }

    const key = toTimeStepKey(slot.date, slot.period)
    if (!key || !timeline.indexByKey.has(key)) {
      continue
    }

    const assignments = slot.assignments || {}
    const roleEntries = [
      ['candidat', assignments.candidat],
      ['expert1', assignments.expert1],
      ['expert2', assignments.expert2],
      ['chef_projet', assignments.chefProjet]
    ]

    for (const [role, participant] of roleEntries) {
      const personId = normalizePersonId(participant)
      if (!personId) {
        continue
      }

      if (!personMetadata.has(personId)) {
        personMetadata.set(personId, {
          personId,
          personName: getPersonDisplayName(participant),
          roles: new Set(),
          slotLabels: new Map(),
          slotReferences: new Map()
        })
      }

      const current = personMetadata.get(personId)
      current.roles.add(role)
      if (!current.personName || current.personName === 'Personne inconnue') {
        current.personName = getPersonDisplayName(participant)
      }
      current.slotLabels.set(key, formatSlotLabel(slot))

      const slotReference = normalizeText(slot?.assignedTpi?.reference)
      if (slotReference) {
        if (!current.slotReferences.has(key)) {
          current.slotReferences.set(key, new Set())
        }

        current.slotReferences.get(key).add(slotReference)
      }
    }
  }

  const issues = []

  for (const participant of personMetadata.values()) {
    const occupiedIndices = Array.from(
      buildOccupiedStepKeys(slots, participant.personId)
    )
      .map((key) => timeline.indexByKey.get(key))
      .filter((value) => Number.isInteger(value))
      .sort((left, right) => left - right)

    if (occupiedIndices.length <= MAX_CONSECUTIVE_TPI) {
      continue
    }

    let runStart = occupiedIndices[0]
    let runEnd = occupiedIndices[0]

    for (let index = 1; index < occupiedIndices.length; index += 1) {
      const currentIndex = occupiedIndices[index]
      if (currentIndex === runEnd + 1) {
        runEnd = currentIndex
        continue
      }

      const runLength = runEnd - runStart + 1
      if (runLength > MAX_CONSECUTIVE_TPI) {
        const runKeys = timeline.timeSteps.slice(runStart, runEnd + 1)
        const slotLabels = runKeys
          .map((key) => participant.slotLabels.get(key))
          .filter(Boolean)
        const references = Array.from(
          new Set(
            runKeys.flatMap((key) => Array.from(participant.slotReferences.get(key) || []))
          )
        ).sort()

        issues.push({
          type: 'consecutive_limit',
          personId: participant.personId,
          personName: participant.personName,
          consecutiveCount: runLength,
          slotLabels,
          references,
          message: `${participant.personName} a ${runLength} TPI consécutifs. Une pause d'un créneau est obligatoire avant de reprendre.`
        })
      }

      runStart = currentIndex
      runEnd = currentIndex
    }

    const finalRunLength = runEnd - runStart + 1
    if (finalRunLength > MAX_CONSECUTIVE_TPI) {
      const runKeys = timeline.timeSteps.slice(runStart, runEnd + 1)
      const slotLabels = runKeys
        .map((key) => participant.slotLabels.get(key))
        .filter(Boolean)
      const references = Array.from(
        new Set(
          runKeys.flatMap((key) => Array.from(participant.slotReferences.get(key) || []))
        )
      ).sort()

      issues.push({
        type: 'consecutive_limit',
        personId: participant.personId,
        personName: participant.personName,
        consecutiveCount: finalRunLength,
        slotLabels,
        references,
        message: `${participant.personName} a ${finalRunLength} TPI consécutifs. Une pause d'un créneau est obligatoire avant de reprendre.`
      })
    }
  }

  issues.sort((left, right) => {
    const leftKey = `${left.personName}|${left.consecutiveCount || 0}|${(left.slotLabels || []).join('|')}`
    const rightKey = `${right.personName}|${right.consecutiveCount || 0}|${(right.slotLabels || []).join('|')}`
    return leftKey.localeCompare(rightKey)
  })

  return issues
}

function buildUnplannedTpiIssues(tpis) {
  return (Array.isArray(tpis) ? tpis : [])
    .filter((tpi) => !['cancelled', 'completed'].includes(normalizeText(tpi?.status)))
    .filter((tpi) => !buildPlanningEntryFromTpi(tpi))
    .map((tpi) => ({
      type: 'unplanned_tpi',
      severity: 'error',
      tpiId: tpi?._id ? String(tpi._id) : null,
      reference: normalizeText(tpi?.reference),
      status: normalizeText(tpi?.status),
      message: `${normalizeText(tpi?.reference) || 'TPI sans référence'} n'a aucun créneau proposé ou confirmé dans Planning.`
    }))
    .sort((left, right) => String(left.reference || '').localeCompare(String(right.reference || '')))
}

function buildRoomClassMismatchIssues(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const compatibility = getRoomCompatibilityReport(entry?.slot?.room, entry)

      if (compatibility.compatible) {
        return null
      }

      const roomModeLabel = toRoomModeLabel(compatibility.roomClassMode)
      const roomLabel = roomModeLabel ? `salle ${roomModeLabel}` : 'salle non compatible'

      return {
        type: 'room_class_mismatch',
        severity: 'error',
        reference: normalizeText(entry?.reference),
        roomName: normalizeText(entry?.slot?.room?.name),
        roomSite: normalizeText(entry?.slot?.room?.site),
        roomClassMode: compatibility.roomClassMode,
        tpiClassMode: compatibility.tpiClassMode,
        message: `${normalizeText(entry?.reference) || 'TPI sans référence'} est associé à une ${roomLabel}.`
      }
    })
    .filter(Boolean)
    .sort((left, right) => String(left.reference || '').localeCompare(String(right.reference || '')))
}

function extractLegacyRefFromWorkflowReference(reference, year) {
  const normalizedReference = normalizeText(reference)
  const prefix = `TPI-${year}-`

  if (!normalizedReference.startsWith(prefix)) {
    return null
  }

  return normalizedReference.slice(prefix.length).trim() || null
}

async function loadLegacyTpis(year) {
  try {
    return await TpiModelsYear(year).find().lean()
  } catch (error) {
    return []
  }
}

async function loadActiveStakeholders() {
  return await Person.find({ isActive: true })
    .select('firstName lastName email roles candidateYears isActive')
    .lean()
}

function buildLegacyConsistencyIssues({ year, legacyTpis, workflowTpis, people = [] }) {
  const workflowRefs = new Set(
    (Array.isArray(workflowTpis) ? workflowTpis : [])
      .map((tpi) => extractLegacyRefFromWorkflowReference(tpi?.reference, year))
      .filter(Boolean)
  )

  return (Array.isArray(legacyTpis) ? legacyTpis : [])
    .map((legacyTpi) => {
      const legacyRef = pickFirstNonEmpty(legacyTpi?.refTpi, legacyTpi?.id)
      const legacySite = pickFirstNonEmpty(legacyTpi?.lieu?.site, legacyTpi?.site)

      if (isExternalPlanningSite(legacySite)) {
        return null
      }

      if (!legacyRef) {
        return {
          type: 'legacy_tpi_missing_reference',
          severity: 'error',
          message: 'Un TPI de GestionTPI n a aucune référence exploitable pour la synchronisation vers Planning.'
        }
      }

      const workflowReference = `TPI-${year}-${legacyRef}`
      const stakeholderValidation = validateLegacyTpiStakeholders(legacyTpi, {
        people,
        year,
        requireResolved: true
      })

      if (stakeholderValidation.missingRoles.length > 0) {
        return {
          type: 'legacy_tpi_missing_stakeholders',
          severity: 'error',
          legacyRef,
          reference: workflowReference,
          missingStakeholders: stakeholderValidation.missingRoles,
          message: `${workflowReference} ne peut pas être synchronisé vers Planning: parties prenantes incomplètes (${stakeholderValidation.missingRoles.join(', ')}).`
        }
      }

      if (stakeholderValidation.unresolvedRoles.length > 0) {
        return {
          type: 'legacy_tpi_unresolved_stakeholders',
          severity: 'error',
          legacyRef,
          reference: workflowReference,
          unresolvedStakeholders: stakeholderValidation.unresolvedRoles,
          message: `${workflowReference} doit être confirmé dans Parties prenantes avant synchronisation (${stakeholderValidation.unresolvedRoles.join(', ')}).`
        }
      }

      if (workflowRefs.has(legacyRef)) {
        return null
      }

      return {
        type: 'legacy_tpi_not_imported',
        severity: 'error',
        legacyRef,
        reference: workflowReference,
        message: `${workflowReference} existe dans GestionTPI mais n'est pas présent dans Planning. Placez-le dans Planification avant le gel.`
      }
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftKey = `${left.reference || ''}|${left.type}`
      const rightKey = `${right.reference || ''}|${right.type}`
      return leftKey.localeCompare(rightKey)
    })
}

function buildValidationIssues(entries, slots, extraIssues = []) {
  const hardConflictData = detectHardConflicts(entries)
  const sequenceViolations = detectSequenceViolations(Array.isArray(slots) ? slots : [])
  const roomClassMismatchIssues = buildRoomClassMismatchIssues(entries)

  const issues = [
    ...hardConflictData.personOverlaps.map((conflict) => ({
      type: conflict.type,
      severity: 'error',
      dateKey: conflict.dateKey,
      period: conflict.period,
      personId: conflict.personId,
      personName: conflict.personName,
      references: conflict.references,
      roles: conflict.roles,
      message: `${conflict.personName} est affecté à plusieurs TPI sur le même créneau (${conflict.references.join(', ')}).`
    })),
    ...hardConflictData.roomOverlaps.map((conflict) => ({
      type: conflict.type,
      severity: 'error',
      dateKey: conflict.dateKey,
      period: conflict.period,
      site: conflict.site,
      roomName: conflict.roomName,
      references: conflict.references,
      message: `La salle ${conflict.site} ${conflict.roomName} est utilisée par plusieurs TPI sur le même créneau (${conflict.references.join(', ')}).`
    })),
    ...sequenceViolations.map((issue) => ({
      ...issue,
      severity: 'error'
    })),
    ...roomClassMismatchIssues,
    ...(Array.isArray(extraIssues) ? extraIssues : [])
  ]

  const importIssueCount = issues.filter((issue) =>
    [
      'legacy_tpi_missing_reference',
      'legacy_tpi_missing_stakeholders',
      'legacy_tpi_unresolved_stakeholders',
      'legacy_tpi_not_imported'
    ]
      .includes(issue?.type)
  ).length
  const unplannedTpiCount = issues.filter((issue) => issue?.type === 'unplanned_tpi').length

  return {
    issues,
    hardConflictSummary: hardConflictData.summary,
    sequenceViolationCount: sequenceViolations.length,
    classMismatchCount: roomClassMismatchIssues.length,
    importIssueCount,
    unplannedTpiCount,
    issueCount: issues.length
  }
}

function computeSnapshotHash(input) {
  const serialized = JSON.stringify(input)
  return crypto.createHash('sha256').update(serialized).digest('hex')
}

async function loadPlanningTpis(year) {
  return filterPlanifiableTpis(await TpiPlanning.find({ year })
    .populate('candidat', 'firstName lastName email')
    .populate('expert1', 'firstName lastName email')
    .populate('expert2', 'firstName lastName email')
    .populate('chefProjet', 'firstName lastName email')
    .populate('proposedSlots.slot')
    .populate('confirmedSlot')
    .lean())
}

async function loadPlanningSlots(year) {
  return await Slot.find({ year })
    .populate('assignments.candidat', 'firstName lastName email')
    .populate('assignments.expert1', 'firstName lastName email')
    .populate('assignments.expert2', 'firstName lastName email')
    .populate('assignments.chefProjet', 'firstName lastName email')
    .populate('assignedTpi', 'reference')
    .lean()
}

async function validatePlanningForYear(year) {
  const [tpis, slots, legacyTpis, people] = await Promise.all([
    loadPlanningTpis(year),
    loadPlanningSlots(year),
    loadLegacyTpis(year),
    loadActiveStakeholders()
  ])
  const entries = buildEntriesFromTpis(tpis)
  const workflowGapIssues = buildUnplannedTpiIssues(tpis)
  const legacyConsistencyIssues = buildLegacyConsistencyIssues({
    year,
    legacyTpis,
    workflowTpis: tpis,
    people
  })
  const validationIssues = buildValidationIssues(
    entries,
    slots,
    [...workflowGapIssues, ...legacyConsistencyIssues]
  )

  const source = {
    totalTpis: tpis.length,
    plannedTpis: entries.length,
    unplannedTpis: Math.max(tpis.length - entries.length, 0),
    totalLegacyTpis: Array.isArray(legacyTpis) ? legacyTpis.length : 0,
    legacyImportGapCount: legacyConsistencyIssues.length
  }

  const issueCount = validationIssues.issueCount
  const hasHardConflicts = issueCount > 0

  return {
    year,
    checkedAt: new Date(),
    source,
    entries,
    hardConflicts: validationIssues.issues,
    issues: validationIssues.issues,
    summary: {
      ...validationIssues.hardConflictSummary,
      hasHardConflicts,
      hardConflictCount: issueCount,
      sequenceViolationCount: validationIssues.sequenceViolationCount,
      classMismatchCount: validationIssues.classMismatchCount,
      importIssueCount: validationIssues.importIssueCount,
      unplannedTpiCount: validationIssues.unplannedTpiCount,
      issueCount,
      isValid: issueCount === 0
    }
  }
}

async function getNextSnapshotVersion(year) {
  const latest = await PlanningSnapshot.findOne({ year })
    .sort({ version: -1 })
    .select('version')
    .lean()

  return latest?.version ? latest.version + 1 : 1
}

async function freezePlanningSnapshot({ year, user, allowHardConflicts = false }) {
  const validation = await validatePlanningForYear(year)

  if (validation.summary.hasHardConflicts && !allowHardConflicts) {
    throw new PlanningFreezeError(
      'Conflits hard detectes. Freeze refuse.',
      {
        summary: validation.summary,
        hardConflicts: validation.hardConflicts
      }
    )
  }

  const version = await getNextSnapshotVersion(year)
  const frozenAt = new Date()
  const hash = computeSnapshotHash({
    year,
    version,
    source: validation.source,
    summary: validation.summary,
    entries: validation.entries,
    hardConflicts: validation.hardConflicts
  })

  await PlanningSnapshot.updateMany(
    { year, isActive: true },
    { $set: { isActive: false } }
  )

  const frozenBy = {
    id: user?.id ? String(user.id) : null,
    email: typeof user?.email === 'string' ? user.email : null
  }

  const snapshot = await PlanningSnapshot.create({
    year,
    version,
    isActive: true,
    frozenAt,
    frozenBy,
    hash,
    source: validation.source,
    validationSummary: validation.summary,
    hardConflicts: validation.hardConflicts,
    entries: validation.entries
  })

  return {
    snapshot,
    validation
  }
}

async function getActiveSnapshot(year) {
  return await PlanningSnapshot.findOne({ year, isActive: true })
    .sort({ version: -1 })
    .lean()
}

function isValidationAlignedWithSnapshot(snapshot, validation) {
  if (!snapshot || !validation) {
    return false
  }

  const snapshotEntries = Array.isArray(snapshot.entries)
    ? [...snapshot.entries].sort(compareEntries)
    : []
  const validationEntries = Array.isArray(validation.entries)
    ? [...validation.entries].sort(compareEntries)
    : []

  return computeSnapshotHash({ entries: snapshotEntries }) === computeSnapshotHash({ entries: validationEntries })
}

module.exports = {
  PlanningFreezeError,
  buildEntriesFromTpis,
  buildLegacyConsistencyIssues,
  buildPlanningEntryFromTpi,
  buildUnplannedTpiIssues,
  detectHardConflicts,
  buildValidationIssues,
  validatePlanningForYear,
  freezePlanningSnapshot,
  getActiveSnapshot,
  computeSnapshotHash,
  isValidationAlignedWithSnapshot
}
