import {
  createEmptyOffer,
  normalizeTpi
} from "./tpiScheduleData"

const SYNC_FIELD_LABELS = Object.freeze({
  refTpi: "reference",
  candidat: "candidat",
  candidatPersonId: "ID candidat",
  classe: "classe",
  expert1Name: "expert 1",
  expert1PersonId: "ID expert 1",
  expert2Name: "expert 2",
  expert2PersonId: "ID expert 2",
  bossName: "chef de projet",
  bossPersonId: "ID chef",
  lieuEntreprise: "entreprise",
  lieuSite: "site",
  sujet: "sujet",
  description: "description"
})
const INTERNAL_PERSON_ID_FIELDS = new Set([
  "candidatPersonId",
  "expert1PersonId",
  "expert2PersonId",
  "bossPersonId"
])
const OPTIONAL_PLANNING_METADATA_FIELDS = new Set([
  "classe",
  "lieuEntreprise",
  "lieuSite",
  "sujet",
  "description"
])

export const compactTpiSyncText = (value) => {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

const normalizeComparableText = (value) =>
  compactTpiSyncText(value).replace(/\s+/g, " ")

const normalizeComparableKey = (value) =>
  normalizeComparableText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .toLocaleLowerCase("fr")

const firstComparableText = (...values) => {
  for (const value of values) {
    const normalizedValue = normalizeComparableText(value)
    if (normalizedValue) {
      return normalizedValue
    }
  }

  return ""
}

export const normalizeTpiSyncRefKey = (value) =>
  normalizeComparableText(value).toLowerCase()

const readObjectValue = (value, key) => {
  if (!value || typeof value !== "object") {
    return ""
  }

  return value[key]
}

const readStakeholderName = (source, objectField, expertsIndex = null) => {
  if (expertsIndex !== null) {
    const expertValue = source?.experts?.[String(expertsIndex)] ?? source?.experts?.[expertsIndex]
    if (expertValue !== null && expertValue !== undefined) {
      return expertValue
    }
  }

  const stakeholder = source?.[objectField]

  if (typeof stakeholder === "string") {
    return stakeholder
  }

  return readObjectValue(stakeholder, "name")
}

export const getGestionTpiSyncFields = (sourceModel = {}) => {
  const source = sourceModel && typeof sourceModel === "object" ? sourceModel : {}

  return {
    refTpi: normalizeComparableText(source.refTpi ?? source.tpiRef ?? source.reference),
    candidat: normalizeComparableText(source.candidat),
    candidatPersonId: normalizeComparableText(source.candidatPersonId),
    classe: normalizeComparableText(source.classe),
    expert1Name: normalizeComparableText(readStakeholderName(source, "expert1", 1)),
    expert1PersonId: normalizeComparableText(source.expert1PersonId),
    expert2Name: normalizeComparableText(readStakeholderName(source, "expert2", 2)),
    expert2PersonId: normalizeComparableText(source.expert2PersonId),
    bossName: normalizeComparableText(
      readStakeholderName(source, "boss") || readStakeholderName(source, "chefProjet")
    ),
    bossPersonId: normalizeComparableText(source.bossPersonId ?? source.chefProjetPersonId),
    lieuEntreprise: firstComparableText(source.lieu?.entreprise, source.entreprise),
    lieuSite: firstComparableText(source.lieu?.site, source.site),
    sujet: normalizeComparableText(source.sujet),
    description: normalizeComparableText(source.description ?? source.domaine)
  }
}

export const getPlanningTpiSyncFields = (planningTpi = {}) => {
  const tpi = normalizeTpi(planningTpi)

  return {
    refTpi: normalizeComparableText(tpi.refTpi),
    candidat: normalizeComparableText(tpi.candidat),
    candidatPersonId: normalizeComparableText(tpi.candidatPersonId),
    classe: normalizeComparableText(tpi.classe),
    expert1Name: normalizeComparableText(tpi.expert1?.name),
    expert1PersonId: normalizeComparableText(tpi.expert1?.personId),
    expert2Name: normalizeComparableText(tpi.expert2?.name),
    expert2PersonId: normalizeComparableText(tpi.expert2?.personId),
    bossName: normalizeComparableText(tpi.boss?.name),
    bossPersonId: normalizeComparableText(tpi.boss?.personId),
    lieuEntreprise: normalizeComparableText(tpi.lieu?.entreprise),
    lieuSite: normalizeComparableText(tpi.lieu?.site ?? tpi.site),
    sujet: normalizeComparableText(tpi.sujet),
    description: normalizeComparableText(tpi.description)
  }
}

export const getTpiSyncChangedFields = (planningTpi = {}, sourceModel = {}) => {
  if (!sourceModel || typeof sourceModel !== "object") {
    return []
  }

  const planningFields = getPlanningTpiSyncFields(planningTpi)
  const sourceFields = getGestionTpiSyncFields(sourceModel)

  return Object.keys(SYNC_FIELD_LABELS).filter((fieldName) => {
    const planningValue = planningFields[fieldName]
    const sourceValue = sourceFields[fieldName]
    const planningKey = normalizeComparableKey(planningValue)
    const sourceKey = normalizeComparableKey(sourceValue)

    if (planningKey === sourceKey) {
      return false
    }

    if (INTERNAL_PERSON_ID_FIELDS.has(fieldName)) {
      return Boolean(planningValue && sourceValue)
    }

    if (OPTIONAL_PLANNING_METADATA_FIELDS.has(fieldName)) {
      return Boolean(planningValue)
    }

    return true
  })
}

export const getTpiSyncChangedLabels = (changedFields = []) =>
  (Array.isArray(changedFields) ? changedFields : [])
    .map((fieldName) => SYNC_FIELD_LABELS[fieldName])
    .filter(Boolean)

export const hasPlanningTpiSyncDifference = (planningTpi = {}, sourceModel = {}) =>
  getTpiSyncChangedFields(planningTpi, sourceModel).length > 0

export const buildGestionTpiSyncModelMap = (sourceModels = []) => {
  const modelsByRef = new Map()

  for (const model of Array.isArray(sourceModels) ? sourceModels : []) {
    const refKey = normalizeTpiSyncRefKey(model?.refTpi ?? model?.tpiRef ?? model?.reference)

    if (refKey && !modelsByRef.has(refKey)) {
      modelsByRef.set(refKey, model)
    }
  }

  return modelsByRef
}

export const buildPlanningTpiSyncSummary = (rooms = [], sourceModels = []) => {
  if (!Array.isArray(sourceModels)) {
    return {
      count: null,
      refs: [],
      entries: []
    }
  }

  const sourceModelsByRef = buildGestionTpiSyncModelMap(sourceModels)
  const refs = new Set()
  const entries = []

  for (const [roomIndex, room] of (Array.isArray(rooms) ? rooms : []).entries()) {
    const tpiDatas = Array.isArray(room?.tpiDatas) ? room.tpiDatas : []

    for (const [tpiIndex, tpi] of tpiDatas.entries()) {
      const refKey = normalizeTpiSyncRefKey(tpi?.refTpi)
      if (!refKey) {
        continue
      }

      const sourceModel = sourceModelsByRef.get(refKey)
      if (!sourceModel) {
        continue
      }

      const changedFields = getTpiSyncChangedFields(tpi, sourceModel)
      if (changedFields.length === 0) {
        continue
      }

      const sourceFields = getGestionTpiSyncFields(sourceModel)
      const refTpi = sourceFields.refTpi || compactTpiSyncText(tpi?.refTpi)

      refs.add(refKey)
      entries.push({
        slotKey: `${roomIndex}:${tpiIndex}`,
        roomIndex,
        tpiIndex,
        refTpi,
        sourceModel,
        changedFields,
        changedLabels: getTpiSyncChangedLabels(changedFields)
      })
    }
  }

  return {
    count: refs.size,
    refs: Array.from(refs),
    entries
  }
}

export const buildPlanningTpiFromGestionModel = (
  currentTpi = {},
  sourceModel = {},
  options = {}
) => {
  const preserveOffers = options.preserveOffers !== false
  const current = normalizeTpi(currentTpi)
  const sourceFields = getGestionTpiSyncFields(sourceModel)
  const resolveOffer = (role) => preserveOffers
    ? current?.[role]?.offres || createEmptyOffer()
    : createEmptyOffer()

  return normalizeTpi({
    ...current,
    refTpi: sourceFields.refTpi || current.refTpi,
    candidat: sourceFields.candidat,
    candidatPersonId: sourceFields.candidatPersonId,
    classe: sourceFields.classe,
    lieu: {
      entreprise: sourceFields.lieuEntreprise,
      site: sourceFields.lieuSite
    },
    site: sourceFields.lieuSite,
    sujet: sourceFields.sujet,
    description: sourceFields.description,
    expert1: {
      name: sourceFields.expert1Name,
      personId: sourceFields.expert1PersonId,
      offres: resolveOffer("expert1")
    },
    expert2: {
      name: sourceFields.expert2Name,
      personId: sourceFields.expert2PersonId,
      offres: resolveOffer("expert2")
    },
    boss: {
      name: sourceFields.bossName,
      personId: sourceFields.bossPersonId,
      offres: resolveOffer("boss")
    }
  })
}
