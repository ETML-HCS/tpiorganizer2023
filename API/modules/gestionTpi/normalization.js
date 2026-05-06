const {
  DEFAULT_JOURNAL_STATUS,
  DEFAULT_REPORT_STATUS,
  DEFAULT_TPI_STATUS,
  JOURNAL_STATUS_VALUES,
  REPORT_STATUS_VALUES,
  TPI_STATUS_VALUES
} = require('./constants')

const PLACEHOLDER_EMPTY_VALUES = new Set(['null', 'undefined'])

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  const normalizedValue = String(value).trim()

  return PLACEHOLDER_EMPTY_VALUES.has(normalizedValue.toLowerCase())
    ? ''
    : normalizedValue
}

function normalizeOptionalText(value) {
  return compactText(value)
}

function normalizeNullableText(value) {
  const normalized = normalizeOptionalText(value)
  return normalized || null
}

function normalizeYear(value) {
  const normalized = compactText(value)

  if (!/^\d{4}$/.test(normalized)) {
    return null
  }

  const parsed = Number.parseInt(normalized, 10)
  return parsed > 0 ? parsed : null
}

function uniqueList(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)))
}

function normalizeEnumValue(value, allowedValues, fallbackValue) {
  const normalized = compactText(value).toLowerCase()
  return allowedValues.includes(normalized) ? normalized : fallbackValue
}

function normalizeTpiStatus(value) {
  return normalizeEnumValue(value, TPI_STATUS_VALUES, DEFAULT_TPI_STATUS)
}

function normalizeJournalStatus(value) {
  return normalizeEnumValue(value, JOURNAL_STATUS_VALUES, DEFAULT_JOURNAL_STATUS)
}

function normalizeReportStatus(value) {
  return normalizeEnumValue(value, REPORT_STATUS_VALUES, DEFAULT_REPORT_STATUS)
}

function normalizePersonId(value) {
  if (!value) {
    return null
  }

  if (value?._id) {
    return normalizeNullableText(value._id)
  }

  return normalizeNullableText(value)
}

function normalizeDateValue(value) {
  const normalized = normalizeOptionalText(value)

  if (!normalized) {
    return null
  }

  const parsedDate = new Date(normalized)
  return Number.isNaN(parsedDate.getTime()) ? normalized : normalized
}

function normalizeDateObject(source = {}) {
  return {
    soutenance: normalizeDateValue(source.soutenance ?? source.dateSoutenance),
    depart: normalizeDateValue(source.depart ?? source.debut ?? source.dateDepart),
    fin: normalizeDateValue(source.fin ?? source.dateFin),
    premiereVisite: normalizeDateValue(source.premiereVisite ?? source.date1ereVisite),
    deuxiemeVisite: normalizeDateValue(source.deuxiemeVisite ?? source.date2emeVisite),
    renduFinal: normalizeDateValue(source.renduFinal ?? source.dateRenduFinal)
  }
}

function normalizeJournalEntry(entry = {}) {
  return {
    date: normalizeDateValue(entry.date ?? entry.at),
    title: normalizeOptionalText(entry.title ?? entry.titre),
    comment: normalizeOptionalText(entry.comment ?? entry.notes ?? entry.description),
    url: normalizeOptionalText(entry.url ?? entry.lien)
  }
}

function normalizeJournal(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}

  return {
    status: normalizeJournalStatus(source.status),
    lastEntryAt: normalizeDateValue(source.lastEntryAt ?? source.derniereEntreeAt),
    url: normalizeOptionalText(source.url ?? source.lien),
    notes: normalizeOptionalText(source.notes),
    entries: Array.isArray(source.entries)
      ? source.entries.map(normalizeJournalEntry).filter((entry) =>
          entry.date || entry.title || entry.comment || entry.url
        )
      : []
  }
}

function normalizeRapport(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}

  return {
    status: normalizeReportStatus(source.status),
    submittedAt: normalizeDateValue(source.submittedAt ?? source.deposeAt),
    dueAt: normalizeDateValue(source.dueAt ?? source.echeanceAt),
    url: normalizeOptionalText(source.url ?? source.lien),
    feedback: normalizeOptionalText(source.feedback ?? source.commentaire)
  }
}

function normalizeEvaluation(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
  const rawNote = source.note ?? source.noteEvaluation
  const note = rawNote === null || rawNote === undefined || rawNote === ''
    ? null
    : Number(rawNote)

  return {
    note: Number.isFinite(note) ? note : null,
    lien: normalizeOptionalText(source.lien ?? source.lienEvaluation)
  }
}

function normalizeTpiPayload(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input)
    ? input
    : {}
  const experts = source.experts && typeof source.experts === 'object'
    ? source.experts
    : {}

  return {
    refTpi: normalizeOptionalText(source.refTpi ?? source.tpiRef ?? source.reference),
    candidat: normalizeOptionalText(source.candidat),
    candidatPersonId: normalizePersonId(source.candidatPersonId),
    classe: normalizeOptionalText(source.classe),
    experts: {
      1: normalizeOptionalText(experts['1'] ?? experts[1] ?? source.expert1),
      2: normalizeOptionalText(experts['2'] ?? experts[2] ?? source.expert2)
    },
    expert1PersonId: normalizePersonId(source.expert1PersonId),
    expert2PersonId: normalizePersonId(source.expert2PersonId),
    boss: normalizeOptionalText(source.boss ?? source.chefProjet),
    bossPersonId: normalizePersonId(source.bossPersonId ?? source.chefProjetPersonId),
    lieu: {
      entreprise: normalizeOptionalText(source.lieu?.entreprise ?? source.entreprise),
      site: normalizeOptionalText(source.lieu?.site ?? source.site)
    },
    sujet: normalizeOptionalText(source.sujet),
    description: normalizeOptionalText(source.description ?? source.domaine),
    tags: Array.isArray(source.tags)
      ? uniqueList(source.tags.map(normalizeOptionalText))
      : uniqueList(compactText(source.tags).split(/[;,|/]+|\n+/g).map(normalizeOptionalText)),
    dates: normalizeDateObject(source.dates || source),
    lienDepot: normalizeOptionalText(source.lienDepot),
    evaluation: normalizeEvaluation(source.evaluation || source),
    salle: normalizeOptionalText(source.salle),
    status: source.status ? normalizeTpiStatus(source.status) : undefined,
    journal: normalizeJournal(source.journal),
    rapport: normalizeRapport(source.rapport)
  }
}

function normalizeTpiDossierRef(year, ref) {
  const rawRef = compactText(ref)
  const workflowPrefix = `TPI-${year}-`
  const isWorkflowReference = rawRef.toUpperCase().startsWith(workflowPrefix.toUpperCase())
  const legacyRef = compactText(isWorkflowReference ? rawRef.slice(workflowPrefix.length) : rawRef)
  const workflowReference = compactText(legacyRef ? `${workflowPrefix}${legacyRef}` : rawRef)

  return {
    rawRef,
    legacyRef,
    workflowReference,
    legacyCandidates: uniqueList([rawRef, legacyRef, workflowReference]),
    workflowCandidates: uniqueList([rawRef, workflowReference])
  }
}

function toPlainObject(value) {
  if (!value) {
    return value
  }

  if (typeof value.toObject === 'function') {
    return value.toObject({ depopulate: true, minimize: false, versionKey: false })
  }

  return { ...value }
}

module.exports = {
  compactText,
  normalizeDateValue,
  normalizeJournal,
  normalizeJournalStatus,
  normalizeNullableText,
  normalizeOptionalText,
  normalizePersonId,
  normalizeRapport,
  normalizeReportStatus,
  normalizeTpiDossierRef,
  normalizeTpiPayload,
  normalizeTpiStatus,
  normalizeYear,
  toPlainObject,
  uniqueList
}
