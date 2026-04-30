import { getPlanningClassModeLabel } from "../components/tpiPlanning/planningClassUtils"
import { resolvePlanningCatalogSite } from "../components/tpiPlanning/planningCatalogUtils"

export const DEFAULT_PLANNING_ROOM_SLOTS = 8
const DEFAULT_PLANNING_TPI_TIME_MINUTES = 60
const DEFAULT_PLANNING_BREAKLINE_MINUTES = 10
const DEFAULT_MIN_TPI_PER_ROOM = 3

const compactText = (value) => {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

const normalizeKey = (value) =>
  compactText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase()

const normalizeDateOnly = (value) => {
  if (!value) {
    return ""
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed
    }

    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10)
  }

  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10)
}

const normalizeDateList = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .map((value) => normalizeDateOnly(value))
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right))

const getPersonLabel = (person) => {
  if (!person) {
    return ""
  }

  if (typeof person === "string" || typeof person === "number") {
    return compactText(person)
  }

  if (typeof person !== "object") {
    return ""
  }

  const fullName = [person.firstName, person.lastName]
    .map((part) => compactText(part))
    .filter(Boolean)
    .join(" ")

  return (
    compactText(fullName) ||
    compactText(person.name) ||
    compactText(person.fullName) ||
    compactText(person.label) ||
    compactText(person.email)
  )
}

const getPersonIdentity = (person) => {
  if (!person) {
    return ""
  }

  if (typeof person === "string" || typeof person === "number") {
    return normalizeKey(person)
  }

  if (typeof person !== "object") {
    return ""
  }

  const rawIdentity = compactText(
    person._id ||
    person.id ||
    person.personId ||
    person.email ||
    person.reference
  )

  if (rawIdentity) {
    return normalizeKey(rawIdentity)
  }

  return normalizeKey(getPersonLabel(person))
}

const getTpiSiteValue = (tpi) =>
  compactText(
    tpi?.lieu?.site ||
    tpi?.site ||
    tpi?.room?.site ||
    tpi?.salle?.site
  )

const getTpiStakeholderIds = (tpi) => [
  getPersonIdentity(tpi?.candidat),
  getPersonIdentity(tpi?.expert1 || tpi?.experts?.[1] || tpi?.experts?.["1"]),
  getPersonIdentity(tpi?.expert2 || tpi?.experts?.[2] || tpi?.experts?.["2"]),
  getPersonIdentity(tpi?.chefProjet || tpi?.boss)
].filter(Boolean)

const countActiveRooms = (site) =>
  Array.isArray(site?.roomDetails)
    ? site.roomDetails.filter((room) => room?.active !== false).length
    : 0

const hasManualRoomTarget = (value) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0

const incrementNumericMap = (map, key, increment = 1) => {
  const normalizedKey = compactText(key)
  if (!normalizedKey) {
    return
  }

  map.set(normalizedKey, Number(map.get(normalizedKey) || 0) + Number(increment || 0))
}

const buildSiteConfigIndex = (siteConfigs = []) => {
  const byId = new Map()
  const byCode = new Map()

  for (const siteConfig of Array.isArray(siteConfigs) ? siteConfigs : []) {
    const siteId = normalizeKey(siteConfig?.siteId)
    const siteCode = normalizeKey(siteConfig?.siteCode)

    if (siteId) {
      byId.set(siteId, siteConfig)
    }

    if (siteCode) {
      byCode.set(siteCode, siteConfig)
    }
  }

  return { byId, byCode }
}

const findSiteConfig = (site, siteConfigIndex) => {
  const siteId = normalizeKey(site?.id)
  const siteCode = normalizeKey(site?.code)

  if (siteId && siteConfigIndex.byId.has(siteId)) {
    return siteConfigIndex.byId.get(siteId)
  }

  if (siteCode && siteConfigIndex.byCode.has(siteCode)) {
    return siteConfigIndex.byCode.get(siteCode)
  }

  return null
}

const createBucket = (meta = {}) => ({
  key: compactText(meta.key),
  siteId: compactText(meta.siteId),
  siteCode: compactText(meta.siteCode).toUpperCase(),
  siteLabel: compactText(meta.siteLabel) || "Sans site",
  siteKind: compactText(meta.siteKind) || "unspecified",
  siteOrder: Number.isFinite(Number(meta.siteOrder)) ? Number(meta.siteOrder) : Number.MAX_SAFE_INTEGER,
  siteActive: meta.siteActive !== false,
  activeRoomCount: Number.isFinite(Number(meta.activeRoomCount)) ? Number(meta.activeRoomCount) : 0,
  slotsPerRoom: Number.isFinite(Number(meta.slotsPerRoom)) && Number(meta.slotsPerRoom) > 0
    ? Number(meta.slotsPerRoom)
    : DEFAULT_PLANNING_ROOM_SLOTS,
  tpiTimeMinutes: Number.isFinite(Number(meta.tpiTimeMinutes)) && Number(meta.tpiTimeMinutes) > 0
    ? Number(meta.tpiTimeMinutes)
    : DEFAULT_PLANNING_TPI_TIME_MINUTES,
  breaklineMinutes: Number.isFinite(Number(meta.breaklineMinutes)) && Number(meta.breaklineMinutes) >= 0
    ? Number(meta.breaklineMinutes)
    : DEFAULT_PLANNING_BREAKLINE_MINUTES,
  minTpiPerRoom: Number.isInteger(Number(meta.minTpiPerRoom)) && Number(meta.minTpiPerRoom) > 0
    ? Number(meta.minTpiPerRoom)
    : DEFAULT_MIN_TPI_PER_ROOM,
  manualRoomTarget: hasManualRoomTarget(meta.manualRoomTarget)
    ? Number(meta.manualRoomTarget)
    : null,
  matchedSite: meta.matchedSite || null,
  hasMissingSite: meta.hasMissingSite === true,
  hasUnmatchedSite: meta.hasUnmatchedSite === true,
  tpis: [],
  classTypeCounts: new Map(),
  typeBreakdowns: new Map(),
  stakeholderCounts: new Map(),
  dateLoadCounts: new Map(),
  undatedTpiCount: 0
})

const incrementMap = (map, key, increment = 1) => {
  const normalizedKey = compactText(key)
  if (!normalizedKey) {
    return
  }

  map.set(normalizedKey, (map.get(normalizedKey) || 0) + increment)
}

const buildClassTypeCode = (tpi, classTypes = [], catalogSites = [], siteValue = "") => {
  const resolved = compactText(
    getPlanningClassModeLabel(tpi?.classe, classTypes, catalogSites, siteValue)
  ).toUpperCase()

  if (resolved) {
    return resolved
  }

  const rawClass = compactText(tpi?.classe).toUpperCase()
  return rawClass || "AUTRE"
}

const buildClassTypeDateIndex = (classTypes = []) => {
  const byCode = new Map()
  const byPrefix = new Map()

  for (const classType of Array.isArray(classTypes) ? classTypes : []) {
    const dateKeys = normalizeDateList(
      Array.isArray(classType?.soutenanceDates)
        ? classType.soutenanceDates.map((entry) => entry?.date)
        : []
    )

    if (dateKeys.length === 0) {
      continue
    }

    const codeKey = normalizeKey(classType?.code)
    const prefixKey = normalizeKey(classType?.prefix)

    if (codeKey) {
      byCode.set(codeKey, dateKeys)
    }

    if (prefixKey) {
      byPrefix.set(prefixKey, dateKeys)
    }
  }

  return { byCode, byPrefix }
}

const resolveClassTypeDateKeys = (classTypeCode, classTypeDateIndex) => {
  const codeKey = normalizeKey(classTypeCode)

  if (!codeKey) {
    return []
  }

  const codeDates = classTypeDateIndex?.byCode?.get(codeKey)
  if (Array.isArray(codeDates) && codeDates.length > 0) {
    return codeDates
  }

  const prefixKey = normalizeKey(codeKey.slice(0, 1))
  const prefixDates = classTypeDateIndex?.byPrefix?.get(prefixKey)
  return Array.isArray(prefixDates) ? prefixDates : []
}

const getTpiActualDateKeys = (tpi) =>
  normalizeDateList([
    tpi?.confirmedSlot?.date,
    tpi?.soutenanceDateTime,
    tpi?.dates?.soutenance
  ])

const formatScheduleLabel = (slotsPerRoom, tpiTimeMinutes, breaklineMinutes, minTpiPerRoom) =>
  `${slotsPerRoom} créneaux/salle · min ${minTpiPerRoom} TPI/salle · ${tpiTimeMinutes} min/TPI · pause ${breaklineMinutes} min`

const formatDateLabel = (dateKey) => {
  const date = new Date(dateKey)

  if (Number.isNaN(date.getTime())) {
    return compactText(dateKey)
  }

  return date.toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "2-digit"
  })
}

const getOrCreateTypeBreakdown = (bucket, classTypeCode) => {
  const code = compactText(classTypeCode) || "AUTRE"

  if (!bucket.typeBreakdowns.has(code)) {
    bucket.typeBreakdowns.set(code, {
      code,
      tpiCount: 0,
      undatedTpiCount: 0,
      dateKeys: new Set(),
      dateLoadCounts: new Map(),
      usesConfiguredDates: false,
      usesPlannedDates: false
    })
  }

  return bucket.typeBreakdowns.get(code)
}

const finalizeTypeBreakdown = (typeBreakdown, slotsPerRoom) => {
  const dateKeys = Array.from(typeBreakdown?.dateKeys || []).sort((left, right) => left.localeCompare(right))
  const peakDailyLoad = Array.from(typeBreakdown?.dateLoadCounts?.values?.() || []).reduce(
    (maxValue, value) => Math.max(maxValue, Number(value) || 0),
    0
  )
  const optimalRooms = peakDailyLoad > 0
    ? Math.ceil(peakDailyLoad / slotsPerRoom)
    : typeBreakdown.undatedTpiCount > 0
      ? Math.ceil(typeBreakdown.undatedTpiCount / slotsPerRoom)
      : 0
  const averageLoadPerDate = dateKeys.length > 0
    ? Number(typeBreakdown.tpiCount || 0) / dateKeys.length
    : null

  return {
    code: compactText(typeBreakdown?.code) || "AUTRE",
    tpiCount: Number(typeBreakdown?.tpiCount || 0),
    undatedTpiCount: Number(typeBreakdown?.undatedTpiCount || 0),
    dateCount: dateKeys.length,
    dateKeys,
    dateLabels: dateKeys.map((dateKey) => formatDateLabel(dateKey)),
    peakDailyLoad,
    averageLoadPerDate,
    optimalRooms,
    datesSource: typeBreakdown?.usesConfiguredDates
      ? "configured"
      : typeBreakdown?.usesPlannedDates
        ? "planned"
        : "missing"
  }
}

const finalizeBucket = (bucket) => {
  const tpiCount = bucket.tpis.length
  const repeatedStakeholderCount = Array.from(bucket.stakeholderCounts.values()).reduce(
    (count, value) => count + Math.max(0, value - 1),
    0
  )
  const peakDailyLoad = Array.from(bucket.dateLoadCounts.values()).reduce(
    (maxValue, value) => Math.max(maxValue, Number(value) || 0),
    0
  )
  const datedTheoreticalRooms = peakDailyLoad > 0
    ? Math.ceil(peakDailyLoad / bucket.slotsPerRoom)
    : 0
  const undatedTheoreticalRooms = bucket.undatedTpiCount > 0
    ? Math.ceil(bucket.undatedTpiCount / bucket.slotsPerRoom)
    : 0
  const theoreticalRooms = datedTheoreticalRooms + undatedTheoreticalRooms
  const operationalRooms = theoreticalRooms
  const recommendedRooms = theoreticalRooms
  const usesManualRoomTarget = hasManualRoomTarget(bucket.manualRoomTarget)
  const targetRooms = usesManualRoomTarget ? Number(bucket.manualRoomTarget) : recommendedRooms
  const currentCapacity = bucket.activeRoomCount * bucket.slotsPerRoom
  const roomGap = targetRooms - bucket.activeRoomCount
  const classTypeCounts = Array.from(bucket.classTypeCounts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count
      }

      return left.code.localeCompare(right.code)
    })
  const typeBreakdowns = Array.from(bucket.typeBreakdowns.values())
    .map((typeBreakdown) => finalizeTypeBreakdown(typeBreakdown, bucket.slotsPerRoom))
    .sort((left, right) => {
      if (right.tpiCount !== left.tpiCount) {
        return right.tpiCount - left.tpiCount
      }

      return left.code.localeCompare(right.code)
    })
  const constraintHints = [
    repeatedStakeholderCount > 0 ? "Conflits de parties prenantes à vérifier en planification." : null,
    bucket.undatedTpiCount > 0 ? `${bucket.undatedTpiCount} TPI sans dates de défense configurées.` : null
  ].filter(Boolean)

  return {
    ...bucket,
    tpiCount,
    repeatedStakeholderCount,
    peakDailyLoad,
    datedTheoreticalRooms,
    undatedTpiCount: bucket.undatedTpiCount,
    theoreticalRooms,
    operationalRooms,
    recommendedRooms,
    targetRooms,
    usesManualRoomTarget,
    currentCapacity,
    roomGap,
    sizingStatus: roomGap > 0 ? "alert" : roomGap < 0 ? "surplus" : "ok",
    classTypeCounts,
    typeBreakdowns,
    classTypeSummary: classTypeCounts
      .map((entry) => `${entry.code} ${entry.count}`)
      .join(" · "),
    scheduleLabel: formatScheduleLabel(
      bucket.slotsPerRoom,
      bucket.tpiTimeMinutes,
      bucket.breaklineMinutes,
      bucket.minTpiPerRoom
    ),
    constraintHints,
    siteStatusLabel: bucket.siteKind === "catalog"
      ? (bucket.siteActive ? "Actif" : "Inactif")
      : bucket.siteKind === "fallback"
        ? "À rattacher"
        : "Sans site"
  }
}

export const buildPlanningRoomSizingOverview = ({
  tpis = [],
  catalogSites = [],
  siteConfigs = [],
  classTypes = [],
  catalogOnly = false
} = {}) => {
  const sourceTpis = Array.isArray(tpis) ? tpis : []
  const normalizedCatalogSites = Array.isArray(catalogSites) ? catalogSites.filter(Boolean) : []
  const siteConfigIndex = buildSiteConfigIndex(siteConfigs)
  const classTypeDateIndex = buildClassTypeDateIndex(classTypes)
  const buckets = new Map()
  const bucketOrder = []
  let fallbackOrder = 0
  let missingSiteCount = 0
  let unmatchedSiteCount = 0

  normalizedCatalogSites.forEach((site, index) => {
    const siteKey = normalizeKey(site?.id || site?.code || site?.label || `site-${index}`)
    if (!siteKey) {
      return
    }

    const siteConfig = findSiteConfig(site, siteConfigIndex)
    const bucketKey = `catalog:${siteKey}`
    const bucket = createBucket({
      key: bucketKey,
      siteId: compactText(site?.id || siteKey),
      siteCode: compactText(site?.code || "").toUpperCase(),
      siteLabel: compactText(site?.label || site?.code || `Site ${index + 1}`),
      siteKind: "catalog",
      siteOrder: Number.isFinite(Number(site?.order)) ? Number(site.order) : index,
      siteActive: site?.active !== false,
      activeRoomCount: countActiveRooms(site),
      slotsPerRoom: Number.isFinite(Number(siteConfig?.numSlots)) && Number(siteConfig.numSlots) > 0
        ? Number(siteConfig.numSlots)
        : DEFAULT_PLANNING_ROOM_SLOTS,
      tpiTimeMinutes: Number.isFinite(Number(siteConfig?.tpiTimeMinutes)) && Number(siteConfig.tpiTimeMinutes) > 0
        ? Number(siteConfig.tpiTimeMinutes)
        : DEFAULT_PLANNING_TPI_TIME_MINUTES,
      breaklineMinutes: Number.isFinite(Number(siteConfig?.breaklineMinutes)) && Number(siteConfig.breaklineMinutes) >= 0
        ? Number(siteConfig.breaklineMinutes)
        : DEFAULT_PLANNING_BREAKLINE_MINUTES,
      minTpiPerRoom: Number.isInteger(Number(siteConfig?.minTpiPerRoom)) && Number(siteConfig.minTpiPerRoom) > 0
        ? Number(siteConfig.minTpiPerRoom)
        : DEFAULT_MIN_TPI_PER_ROOM,
      manualRoomTarget: siteConfig?.manualRoomTarget,
      matchedSite: site
    })

    buckets.set(bucketKey, bucket)
    bucketOrder.push(bucketKey)
  })

  sourceTpis.forEach((tpi) => {
    const rawSiteValue = getTpiSiteValue(tpi)
    const matchedSite = rawSiteValue ? resolvePlanningCatalogSite(rawSiteValue, normalizedCatalogSites) : null
    let bucketKey = ""

    if (matchedSite) {
      const matchedKey = normalizeKey(matchedSite.id || matchedSite.code || rawSiteValue)
      bucketKey = `catalog:${matchedKey}`

      if (!buckets.has(bucketKey)) {
        const siteConfig = findSiteConfig(matchedSite, siteConfigIndex)
        buckets.set(bucketKey, createBucket({
          key: bucketKey,
          siteId: compactText(matchedSite.id || matchedSite.code || rawSiteValue),
          siteCode: compactText(matchedSite.code || "").toUpperCase(),
          siteLabel: compactText(matchedSite.label || matchedSite.code || rawSiteValue),
          siteKind: "catalog",
          siteOrder: normalizedCatalogSites.findIndex((site) => normalizeKey(site?.id || site?.code || site?.label) === matchedKey),
          siteActive: matchedSite.active !== false,
          activeRoomCount: countActiveRooms(matchedSite),
          slotsPerRoom: Number.isFinite(Number(siteConfig?.numSlots)) && Number(siteConfig.numSlots) > 0
            ? Number(siteConfig.numSlots)
            : DEFAULT_PLANNING_ROOM_SLOTS,
          tpiTimeMinutes: Number.isFinite(Number(siteConfig?.tpiTimeMinutes)) && Number(siteConfig.tpiTimeMinutes) > 0
            ? Number(siteConfig.tpiTimeMinutes)
            : DEFAULT_PLANNING_TPI_TIME_MINUTES,
          breaklineMinutes: Number.isFinite(Number(siteConfig?.breaklineMinutes)) && Number(siteConfig.breaklineMinutes) >= 0
            ? Number(siteConfig.breaklineMinutes)
            : DEFAULT_PLANNING_BREAKLINE_MINUTES,
          minTpiPerRoom: Number.isInteger(Number(siteConfig?.minTpiPerRoom)) && Number(siteConfig.minTpiPerRoom) > 0
            ? Number(siteConfig.minTpiPerRoom)
            : DEFAULT_MIN_TPI_PER_ROOM,
          manualRoomTarget: siteConfig?.manualRoomTarget,
          matchedSite
        }))
        bucketOrder.push(bucketKey)
      }
    } else if (rawSiteValue) {
      unmatchedSiteCount += 1
      if (catalogOnly) {
        return
      }
      const fallbackKey = normalizeKey(rawSiteValue) || `site-${fallbackOrder + 1}`
      bucketKey = `fallback:${fallbackKey}`

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, createBucket({
          key: bucketKey,
          siteId: fallbackKey,
          siteCode: normalizeKey(rawSiteValue),
          siteLabel: rawSiteValue,
          siteKind: "fallback",
          siteOrder: normalizedCatalogSites.length + fallbackOrder + 1,
          activeRoomCount: 0,
          slotsPerRoom: DEFAULT_PLANNING_ROOM_SLOTS,
          tpiTimeMinutes: DEFAULT_PLANNING_TPI_TIME_MINUTES,
          breaklineMinutes: DEFAULT_PLANNING_BREAKLINE_MINUTES,
          hasUnmatchedSite: true
        }))
        bucketOrder.push(bucketKey)
        fallbackOrder += 1
      }
    } else {
      missingSiteCount += 1
      if (catalogOnly) {
        return
      }
      bucketKey = "unspecified"

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, createBucket({
          key: bucketKey,
          siteId: bucketKey,
          siteCode: "",
          siteLabel: "Sans site",
          siteKind: "unspecified",
          siteOrder: Number.MAX_SAFE_INTEGER,
          activeRoomCount: 0,
          slotsPerRoom: DEFAULT_PLANNING_ROOM_SLOTS,
          tpiTimeMinutes: DEFAULT_PLANNING_TPI_TIME_MINUTES,
          breaklineMinutes: DEFAULT_PLANNING_BREAKLINE_MINUTES,
          hasMissingSite: true
        }))
        bucketOrder.push(bucketKey)
      }
    }

    const bucket = buckets.get(bucketKey)
    if (!bucket) {
      return
    }

    bucket.tpis.push(tpi)

    const classTypeCode = buildClassTypeCode(tpi, classTypes, normalizedCatalogSites, rawSiteValue)
    incrementMap(bucket.classTypeCounts, classTypeCode)
    const typeBreakdown = getOrCreateTypeBreakdown(bucket, classTypeCode)
    typeBreakdown.tpiCount += 1

    const actualDateKeys = getTpiActualDateKeys(tpi)
    const configuredDateKeys = resolveClassTypeDateKeys(classTypeCode, classTypeDateIndex)
    const effectiveDateKeys = configuredDateKeys.length > 0 ? configuredDateKeys : actualDateKeys

    if (effectiveDateKeys.length > 0) {
      const loadShare = 1 / effectiveDateKeys.length
      for (const dateKey of effectiveDateKeys) {
        incrementNumericMap(bucket.dateLoadCounts, dateKey, loadShare)
        incrementNumericMap(typeBreakdown.dateLoadCounts, dateKey, loadShare)
        typeBreakdown.dateKeys.add(dateKey)
      }

      if (configuredDateKeys.length > 0) {
        typeBreakdown.usesConfiguredDates = true
      } else {
        typeBreakdown.usesPlannedDates = true
      }
    } else {
      bucket.undatedTpiCount += 1
      typeBreakdown.undatedTpiCount += 1
    }

    for (const stakeholderId of getTpiStakeholderIds(tpi)) {
      incrementMap(bucket.stakeholderCounts, stakeholderId)
    }
  })

  const sites = bucketOrder
    .map((bucketKey) => buckets.get(bucketKey))
    .filter(Boolean)
    .map(finalizeBucket)
    .sort((left, right) => {
      const kindPriority = {
        catalog: 0,
        fallback: 1,
        unspecified: 2
      }

      const leftPriority = kindPriority[left.siteKind] ?? 9
      const rightPriority = kindPriority[right.siteKind] ?? 9

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }

      if (left.siteOrder !== right.siteOrder) {
        return left.siteOrder - right.siteOrder
      }

      if (right.tpiCount !== left.tpiCount) {
        return right.tpiCount - left.tpiCount
      }

      return left.siteLabel.localeCompare(right.siteLabel, "fr")
    })

  const totals = sites.reduce(
    (accumulator, site) => {
      accumulator.tpiCount += site.tpiCount
      accumulator.activeRoomCount += site.activeRoomCount
      accumulator.currentCapacity += site.currentCapacity
      accumulator.theoreticalRooms += site.theoreticalRooms
      accumulator.operationalRooms += site.operationalRooms
      accumulator.recommendedRooms += site.recommendedRooms
      accumulator.targetRooms += site.targetRooms
      accumulator.repeatedStakeholderCount += site.repeatedStakeholderCount
      accumulator.shortageRooms += Math.max(0, site.roomGap)
      accumulator.surplusRooms += Math.max(0, -site.roomGap)
      accumulator.roomGap += site.roomGap
      accumulator.manualOverrideCount += site.usesManualRoomTarget ? 1 : 0
      return accumulator
    },
    {
      tpiCount: 0,
      activeRoomCount: 0,
      currentCapacity: 0,
      theoreticalRooms: 0,
      operationalRooms: 0,
      recommendedRooms: 0,
      targetRooms: 0,
      repeatedStakeholderCount: 0,
      shortageRooms: 0,
      surplusRooms: 0,
      roomGap: 0,
      manualOverrideCount: 0
    }
  )

  const notes = []
  if (missingSiteCount > 0) {
    notes.push(
      catalogOnly
        ? `${missingSiteCount} TPI sans site ignoré${missingSiteCount > 1 ? "s" : ""} du dimensionnement`
        : `${missingSiteCount} TPI sans site`
    )
  }

  if (unmatchedSiteCount > 0) {
    notes.push(
      catalogOnly
        ? `${unmatchedSiteCount} TPI hors catalogue ignoré${unmatchedSiteCount > 1 ? "s" : ""} du dimensionnement`
        : `${unmatchedSiteCount} TPI hors catalogue`
    )
  }

  return {
    totals,
    sites,
    notes,
    missingSiteCount,
    unmatchedSiteCount,
    hasPartialData: notes.length > 0
  }
}
