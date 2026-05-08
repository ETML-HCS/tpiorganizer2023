// Migration de stabilisation globale apres refonte gestion-tpi / coordination / acces-liens.
// Par defaut, le script est en dry-run. Utiliser --apply pour ecrire en base.
require('dotenv').config()

const path = require('path')
const mongoose = require('mongoose')

const { connectToDatabase } = require(path.join(__dirname, '..', 'API', 'config', 'dbConfig'))
const TpiCoordination = require(path.join(__dirname, '..', 'API', 'models', 'tpiCoordinationModel'))
const CoordinationSnapshot = require(path.join(__dirname, '..', 'API', 'models', 'coordinationSnapshotModel'))
const WorkflowYearModel = require(path.join(__dirname, '..', 'API', 'models', 'workflowYearModel'))
const TpiModelsYear = require(path.join(__dirname, '..', 'API', 'models', 'tpiModels'))
const {
  normalizeCoordinationStatus
} = require(path.join(__dirname, '..', 'API', 'modules', 'coordination', 'status'))

const LEGACY_STATUS_ALIASES = Object.freeze({
  requires_manual_intervention: 'manual_required'
})

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    apply: false,
    year: null,
    includeLegacyCatalog: false
  }

  for (const arg of argv) {
    if (arg === '--apply') {
      options.apply = true
      continue
    }

    if (arg === '--dry-run') {
      options.apply = false
      continue
    }

    if (arg === '--include-legacy-catalog') {
      options.includeLegacyCatalog = true
      continue
    }

    if (arg.startsWith('--year=')) {
      options.year = parseYear(arg.slice('--year='.length))
      continue
    }

    if (/^\d{4}$/.test(arg)) {
      options.year = parseYear(arg)
      continue
    }
  }

  return options
}

function parseYear(value) {
  if (!/^\d{4}$/.test(String(value))) {
    throw new Error(`Annee invalide: ${value}`)
  }

  const year = Number.parseInt(String(value), 10)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error(`Annee invalide: ${value}`)
  }

  return year
}

function normalizeLegacyStatus(value) {
  const rawValue = String(value || '').trim()
  return LEGACY_STATUS_ALIASES[rawValue] || normalizeCoordinationStatus(rawValue)
}

function buildYearFilter(year) {
  return Number.isInteger(year) ? { year } : {}
}

function buildStatusMigrationFilter(year = null) {
  return {
    ...buildYearFilter(year),
    status: { $in: Object.keys(LEGACY_STATUS_ALIASES) }
  }
}

function buildStatusMigrationUpdate() {
  return {
    $set: {
      status: LEGACY_STATUS_ALIASES.requires_manual_intervention
    },
    $push: {
      history: {
        action: 'migration.refactor_global.normalize_status',
        at: new Date(),
        details: {
          from: 'requires_manual_intervention',
          to: LEGACY_STATUS_ALIASES.requires_manual_intervention
        }
      }
    }
  }
}

function normalizeSnapshotEntry(entry = {}) {
  const normalizedStatus = normalizeLegacyStatus(entry.status)
  if (!entry.status || normalizedStatus === entry.status) {
    return {
      changed: false,
      entry
    }
  }

  return {
    changed: true,
    entry: {
      ...entry,
      status: normalizedStatus
    }
  }
}

function normalizeSnapshotDocument(snapshot = {}) {
  const entries = Array.isArray(snapshot.entries) ? snapshot.entries : []
  let changed = false

  const normalizedEntries = entries.map((entry) => {
    const result = normalizeSnapshotEntry(entry)
    changed = changed || result.changed
    return result.entry
  })

  return {
    changed,
    entries: normalizedEntries
  }
}

async function countCoordinationStatusAliases({ year = null }) {
  return await TpiCoordination.countDocuments(buildStatusMigrationFilter(year))
}

async function migrateCoordinationStatusAliases({ year = null, apply = false }) {
  const filter = buildStatusMigrationFilter(year)
  const matched = await TpiCoordination.countDocuments(filter)

  if (!apply || matched === 0) {
    return {
      collection: 'tpiPlannings',
      matched,
      modified: 0,
      dryRun: !apply
    }
  }

  const result = await TpiCoordination.updateMany(filter, buildStatusMigrationUpdate())
  return {
    collection: 'tpiPlannings',
    matched,
    modified: result.modifiedCount || 0,
    dryRun: false
  }
}

async function migrateSnapshotStatusAliases({ year = null, apply = false }) {
  const snapshots = await CoordinationSnapshot.find(buildYearFilter(year))
  let matched = 0
  let modified = 0

  for (const snapshot of snapshots) {
    const result = normalizeSnapshotDocument(snapshot.toObject ? snapshot.toObject() : snapshot)
    if (!result.changed) {
      continue
    }

    matched += 1

    if (apply) {
      snapshot.entries = result.entries
      await snapshot.save()
      modified += 1
    }
  }

  return {
    collection: 'planningSnapshots',
    matched,
    modified,
    dryRun: !apply
  }
}

async function inspectWorkflowYears({ year = null }) {
  const workflows = await WorkflowYearModel.WorkflowYear.find(buildYearFilter(year)).lean()
  return {
    collection: 'workflowYears',
    matched: workflows.length,
    modified: 0,
    dryRun: true,
    note: 'Aucune ecriture: les phases workflow ne stockent pas le statut TPI manual_required.'
  }
}

async function inspectLegacyCatalog({ year = null }) {
  if (!Number.isInteger(year)) {
    return {
      collection: 'tpiList_<year>',
      matched: 0,
      modified: 0,
      dryRun: true,
      note: 'Ignoré: fournir --year pour inspecter le catalogue legacy annuel.'
    }
  }

  const LegacyTpi = TpiModelsYear(year)
  const missingLinks = await LegacyTpi.countDocuments({
    $or: [
      { candidatPersonId: { $in: [null, undefined] } },
      { expert1PersonId: { $in: [null, undefined] } },
      { expert2PersonId: { $in: [null, undefined] } },
      { bossPersonId: { $in: [null, undefined] } }
    ]
  })

  return {
    collection: `tpiList_${year}`,
    matched: missingLinks,
    modified: 0,
    dryRun: true,
    note: 'Inspection seulement: les liens personnes se reconstruisent via Gestion TPI/Parties prenantes.'
  }
}

async function runMigration(options = {}) {
  const normalizedOptions = {
    apply: options.apply === true,
    year: Number.isInteger(options.year) ? options.year : null,
    includeLegacyCatalog: options.includeLegacyCatalog === true
  }

  const results = []
  results.push(await migrateCoordinationStatusAliases(normalizedOptions))
  results.push(await migrateSnapshotStatusAliases(normalizedOptions))
  results.push(await inspectWorkflowYears(normalizedOptions))

  if (normalizedOptions.includeLegacyCatalog) {
    results.push(await inspectLegacyCatalog(normalizedOptions))
  }

  return {
    options: normalizedOptions,
    results
  }
}

function printReport(report) {
  const mode = report.options.apply ? 'APPLY' : 'DRY-RUN'
  const scope = report.options.year ? `annee ${report.options.year}` : 'toutes annees'

  console.log(`\nMigration refactor-global - ${mode} - ${scope}`)
  console.log('='.repeat(60))

  for (const result of report.results) {
    console.log(`- ${result.collection}: ${result.matched} a traiter, ${result.modified} modifies${result.dryRun ? ' (dry-run)' : ''}`)
    if (result.note) {
      console.log(`  ${result.note}`)
    }
  }

  if (!report.options.apply) {
    console.log('\nAucune ecriture effectuee. Relancer avec --apply pour appliquer.')
  }
}

async function main() {
  const options = parseArgs()
  const connected = await connectToDatabase()

  if (!connected) {
    throw new Error('Connexion MongoDB indisponible.')
  }

  try {
    const report = await runMigration(options)
    printReport(report)
  } finally {
    await mongoose.connection.close()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message)
    process.exit(1)
  })
}

module.exports = {
  LEGACY_STATUS_ALIASES,
  buildStatusMigrationFilter,
  buildStatusMigrationUpdate,
  normalizeLegacyStatus,
  normalizeSnapshotDocument,
  normalizeSnapshotEntry,
  parseArgs,
  parseYear,
  runMigration
}
