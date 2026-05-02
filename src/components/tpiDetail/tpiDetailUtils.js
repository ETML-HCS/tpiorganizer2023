import { ROUTES } from "../../config/appConfig"

export function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

export function formatPersonName(person, fallback = '') {
  if (!person) {
    return fallback
  }

  if (typeof person === 'object') {
    const fullName = [
      person.firstName,
      person.lastName,
      person.name
    ].filter(Boolean).join(' ').trim()

    return fullName || fallback
  }

  return compactText(person) || fallback
}

export function formatDate(value) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return compactText(value) || '—'
  }

  return date.toLocaleDateString('fr-CH')
}

export function formatDateTime(value) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return compactText(value) || '—'
  }

  return date.toLocaleString('fr-CH')
}

export function formatVoteRole(role) {
  if (role === 'expert1') {
    return 'Expert 1'
  }

  if (role === 'expert2') {
    return 'Expert 2'
  }

  if (role === 'chef_projet') {
    return 'Chef de projet'
  }

  return compactText(role) || 'Rôle'
}

export function formatVoteDecision(decision) {
  if (decision === 'accepted') {
    return 'OK'
  }

  if (decision === 'preferred') {
    return 'Préféré'
  }

  if (decision === 'rejected') {
    return 'Refusé'
  }

  return 'En attente'
}

export function getLegacyExpert(legacyTpi, key) {
  return compactText(legacyTpi?.experts?.[key] || legacyTpi?.experts?.[Number(key)] || '')
}

export function getPlannedSlotLabel(slot) {
  if (!slot) {
    return 'Aucun créneau'
  }

  const parts = [
    compactText(slot?.date) ? formatDate(slot.date) : '',
    compactText(slot?.startTime),
    compactText(slot?.room?.name)
  ].filter(Boolean)

  return parts.join(' · ') || 'Créneau disponible'
}

export function buildTpiDetailsLink(year, ref) {
  const normalizedYear = Number.parseInt(year, 10)
  const normalizedRef = compactText(ref)

  if (!Number.isInteger(normalizedYear) || !normalizedRef) {
    return ROUTES.GESTION_TPI
  }

  return `/tpi/${normalizedYear}/${encodeURIComponent(normalizedRef)}`
}

export function buildGestionTpiFocusLink(year, ref, options = {}) {
  const normalizedYear = Number.parseInt(year, 10)
  const normalizedRef = extractLegacyRefFromWorkflowReference(ref, year)
  const params = new URLSearchParams()

  if (Number.isInteger(normalizedYear)) {
    params.set('year', String(normalizedYear))
  }

  if (normalizedRef) {
    params.set('focus', normalizedRef)
  }

  if (options?.edit) {
    params.set('edit', '1')
  }

  const queryString = params.toString()
  return queryString ? `${ROUTES.GESTION_TPI}?${queryString}` : ROUTES.GESTION_TPI
}

export function buildGestionTpiCreateLink(year, ref) {
  const normalizedYear = Number.parseInt(year, 10)
  const normalizedRef = extractLegacyRefFromWorkflowReference(ref, year)
  const params = new URLSearchParams()

  if (Number.isInteger(normalizedYear)) {
    params.set('year', String(normalizedYear))
  }

  if (normalizedRef) {
    params.set('focus', normalizedRef)
  }

  params.set('new', '1')

  const queryString = params.toString()
  return queryString ? `${ROUTES.GESTION_TPI}?${queryString}` : ROUTES.GESTION_TPI
}

export function buildPlanningTabLink(year, tab = 'list', options = {}) {
  const normalizedYear = Number.parseInt(year, 10)
  const normalizedRef = compactText(options?.focus)
  const params = new URLSearchParams()

  if (!Number.isInteger(normalizedYear)) {
    return `/planning/${year}`
  }

  if (compactText(tab)) {
    params.set('tab', compactText(tab))
  }

  if (normalizedRef) {
    params.set('focus', normalizedRef)
  }

  const queryString = params.toString()
  return queryString
    ? `/planning/${normalizedYear}?${queryString}`
    : `/planning/${normalizedYear}`
}

export function buildPlanningFocusLink(year, ref, options = {}) {
  return buildPlanningTabLink(year, options?.tab || 'list', { focus: ref })
}

export function buildSoutenanceFocusLink(year, ref) {
  const normalizedYear = Number.parseInt(year, 10)
  const normalizedRef = compactText(ref)

  if (!Number.isInteger(normalizedYear) || !normalizedRef) {
    return `${ROUTES.SOUTENANCES}/${year}`
  }

  return `${ROUTES.SOUTENANCES}/${normalizedYear}?focus=${encodeURIComponent(normalizedRef)}`
}

export function getPlanningStatusMeta(status) {
  const normalizedStatus = compactText(status).toLowerCase()

  switch (normalizedStatus) {
    case 'draft':
      return { label: 'Brouillon', tone: 'muted' }
    case 'planning':
      return { label: 'Planification', tone: 'muted' }
    case 'voting':
    case 'voting_open':
      return { label: 'Votes ouverts', tone: 'warning' }
    case 'confirmed':
      return { label: 'Confirmé', tone: 'ready' }
    case 'manual_required':
      return { label: 'Intervention requise', tone: 'warning' }
    case 'published':
      return { label: 'Publié', tone: 'ready' }
    default:
      return {
        label: compactText(status) || 'Hors planning',
        tone: compactText(status) ? 'muted' : 'muted'
      }
  }
}

export function isLikelyUrl(value) {
  const normalizedValue = compactText(value)
  return /^https?:\/\//i.test(normalizedValue)
}

export function buildPartiesPrenantesLink({
  personId = '',
  name = '',
  role = '',
  tab = '',
  year = '',
  returnTo = ''
} = {}) {
  const params = new URLSearchParams()
  const normalizedPersonId = compactText(personId)
  const normalizedName = compactText(name)
  const normalizedRole = compactText(role)
  const normalizedTab = compactText(tab)
  const normalizedYear = compactText(year)
  const normalizedReturnTo = compactText(returnTo)

  if (normalizedPersonId) {
    params.set('personId', normalizedPersonId)
  }

  if (normalizedName) {
    params.set('name', normalizedName)
  }

  if (normalizedRole) {
    params.set('role', normalizedRole)
  }

  if (normalizedTab) {
    params.set('tab', normalizedTab)
  }

  if (normalizedYear) {
    params.set('year', normalizedYear)
  }

  if (normalizedReturnTo.startsWith('/')) {
    params.set('returnTo', normalizedReturnTo)
  }

  const queryString = params.toString()
  return queryString ? `${ROUTES.PARTIES_PRENANTES}?${queryString}` : ROUTES.PARTIES_PRENANTES
}

export function extractLegacyRefFromWorkflowReference(reference, year) {
  const normalizedReference = compactText(reference)
  const normalizedYear = Number.parseInt(year, 10)

  if (!normalizedReference) {
    return ''
  }

  if (Number.isInteger(normalizedYear)) {
    const yearPattern = new RegExp(`^TPI-${normalizedYear}-(.+)$`, 'i')
    const yearMatch = normalizedReference.match(yearPattern)

    if (yearMatch?.[1]) {
      return compactText(yearMatch[1])
    }
  }

  const genericMatch = normalizedReference.match(/^TPI-\d{4}-(.+)$/i)
  if (genericMatch?.[1]) {
    return compactText(genericMatch[1])
  }

  return normalizedReference
}

export function readObjectId(value) {
  if (!value) {
    return ''
  }

  if (typeof value === 'string') {
    return compactText(value)
  }

  return compactText(value?._id || value?.id)
}

export function buildLegacyPrefillFromDossier(dossier) {
  if (!dossier) {
    return null
  }

  const planningTpi = dossier?.planning?.data || null
  const plannedSlot = dossier?.planning?.plannedSlot || null
  const workflowReference = compactText(dossier?.identifiers?.workflowReference)
  const legacyRef = compactText(dossier?.identifiers?.legacyRef) ||
    extractLegacyRefFromWorkflowReference(workflowReference, dossier?.year)

  if (!planningTpi && !legacyRef) {
    return null
  }

  return {
    refTpi: legacyRef,
    candidat: formatPersonName(planningTpi?.candidat),
    candidatPersonId: readObjectId(planningTpi?.candidat),
    classe: compactText(planningTpi?.classe),
    expert1: formatPersonName(planningTpi?.expert1),
    expert1PersonId: readObjectId(planningTpi?.expert1),
    expert2: formatPersonName(planningTpi?.expert2),
    expert2PersonId: readObjectId(planningTpi?.expert2),
    boss: formatPersonName(planningTpi?.chefProjet),
    bossPersonId: readObjectId(planningTpi?.chefProjet),
    sujet: compactText(planningTpi?.sujet),
    description: compactText(planningTpi?.description),
    tags: Array.isArray(planningTpi?.tags) ? planningTpi.tags.filter(Boolean) : [],
    lieu: {
      entreprise: compactText(planningTpi?.entreprise?.nom),
      site: compactText(planningTpi?.site)
    },
    salle: compactText(plannedSlot?.room?.name),
    dateSoutenance: compactText(plannedSlot?.date),
    dateDepart: compactText(planningTpi?.dates?.debut || planningTpi?.dates?.depart),
    dateFin: compactText(planningTpi?.dates?.fin),
    date1ereVisite: compactText(planningTpi?.dates?.premiereVisite),
    date2emeVisite: compactText(planningTpi?.dates?.deuxiemeVisite),
    dateRenduFinal: compactText(planningTpi?.dates?.renduFinal),
    lienDepot: ''
  }
}

export function buildLegacyPayloadFromDossier(dossier, overrides = {}) {
  const legacyTpi = dossier?.legacy?.data || null
  const prefilledTpi = buildLegacyPrefillFromDossier(dossier) || {}
  const legacyDates = legacyTpi?.dates && typeof legacyTpi.dates === 'object'
    ? legacyTpi.dates
    : {}
  const legacyEvaluation = legacyTpi?.evaluation && typeof legacyTpi.evaluation === 'object'
    ? legacyTpi.evaluation
    : {}
  const overrideLieu = overrides?.lieu && typeof overrides.lieu === 'object'
    ? overrides.lieu
    : {}
  const overrideDates = overrides?.dates && typeof overrides.dates === 'object'
    ? overrides.dates
    : {}
  const overrideEvaluation = overrides?.evaluation && typeof overrides.evaluation === 'object'
    ? overrides.evaluation
    : {}
  const baseExperts = legacyTpi?.experts && typeof legacyTpi.experts === 'object'
    ? legacyTpi.experts
    : {}
  const overrideExperts = overrides?.experts && typeof overrides.experts === 'object'
    ? overrides.experts
    : {}
  const baseTags = Array.isArray(legacyTpi?.tags)
    ? legacyTpi.tags.filter(Boolean)
    : Array.isArray(prefilledTpi?.tags)
      ? prefilledTpi.tags.filter(Boolean)
      : []

  return {
    refTpi: compactText(overrides?.refTpi) || compactText(legacyTpi?.refTpi) || compactText(prefilledTpi?.refTpi),
    candidat: compactText(overrides?.candidat) || compactText(legacyTpi?.candidat) || compactText(prefilledTpi?.candidat),
    candidatPersonId: compactText(overrides?.candidatPersonId) || compactText(legacyTpi?.candidatPersonId) || compactText(prefilledTpi?.candidatPersonId) || null,
    classe: compactText(overrides?.classe) || compactText(legacyTpi?.classe) || compactText(prefilledTpi?.classe),
    experts: {
      1: compactText(overrideExperts?.[1] || overrideExperts?.['1']) ||
        compactText(baseExperts?.[1] || baseExperts?.['1']) ||
        compactText(prefilledTpi?.expert1),
      2: compactText(overrideExperts?.[2] || overrideExperts?.['2']) ||
        compactText(baseExperts?.[2] || baseExperts?.['2']) ||
        compactText(prefilledTpi?.expert2)
    },
    expert1PersonId: compactText(overrides?.expert1PersonId) || compactText(legacyTpi?.expert1PersonId) || compactText(prefilledTpi?.expert1PersonId) || null,
    expert2PersonId: compactText(overrides?.expert2PersonId) || compactText(legacyTpi?.expert2PersonId) || compactText(prefilledTpi?.expert2PersonId) || null,
    boss: compactText(overrides?.boss) || compactText(legacyTpi?.boss) || compactText(prefilledTpi?.boss),
    bossPersonId: compactText(overrides?.bossPersonId) || compactText(legacyTpi?.bossPersonId) || compactText(prefilledTpi?.bossPersonId) || null,
    lieu: {
      entreprise: compactText(overrideLieu?.entreprise) || compactText(legacyTpi?.lieu?.entreprise) || compactText(prefilledTpi?.lieu?.entreprise),
      site: compactText(overrideLieu?.site) || compactText(legacyTpi?.lieu?.site) || compactText(prefilledTpi?.lieu?.site)
    },
    sujet: compactText(overrides?.sujet) || compactText(legacyTpi?.sujet) || compactText(prefilledTpi?.sujet),
    description: compactText(overrides?.description) || compactText(legacyTpi?.description) || compactText(prefilledTpi?.description),
    tags: Array.isArray(overrides?.tags) ? overrides.tags.filter(Boolean) : baseTags,
    dates: {
      soutenance: compactText(overrideDates?.soutenance) || compactText(legacyDates?.soutenance) || compactText(prefilledTpi?.dateSoutenance) || null,
      depart: compactText(overrideDates?.depart) || compactText(legacyDates?.depart) || null,
      fin: compactText(overrideDates?.fin) || compactText(legacyDates?.fin) || null,
      premiereVisite: compactText(overrideDates?.premiereVisite) || compactText(legacyDates?.premiereVisite) || null,
      deuxiemeVisite: compactText(overrideDates?.deuxiemeVisite) || compactText(legacyDates?.deuxiemeVisite) || null,
      renduFinal: compactText(overrideDates?.renduFinal) || compactText(legacyDates?.renduFinal) || null
    },
    lienDepot: compactText(overrides?.lienDepot) || compactText(legacyTpi?.lienDepot) || compactText(prefilledTpi?.lienDepot),
    evaluation: {
      note: overrides?.evaluation?.note ?? legacyEvaluation?.note ?? null,
      lien: compactText(overrideEvaluation?.lien) || compactText(legacyEvaluation?.lien)
    },
    salle: compactText(overrides?.salle) || compactText(legacyTpi?.salle) || compactText(prefilledTpi?.salle)
  }
}
