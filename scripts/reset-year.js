// Script pour inspecter ou reinitialiser les donnees et phases d'une annee.
// Par defaut, aucune suppression n'est effectuee. Utiliser --apply pour ecrire en base.
require('dotenv').config()

const path = require('path')
const mongoose = require('mongoose')

const { connectToDatabase } = require(path.join(__dirname, '..', 'API', 'config', 'dbConfig'))
const PlanningSnapshot = require(path.join(__dirname, '..', 'API', 'models', 'planningSnapshotModel'))
const WorkflowYearModel = require(path.join(__dirname, '..', 'API', 'models', 'workflowYearModel'))
const TpiPlanning = require(path.join(__dirname, '..', 'API', 'models', 'tpiPlanningModel'))
const Slot = require(path.join(__dirname, '..', 'API', 'models', 'slotModel'))
const Vote = require(path.join(__dirname, '..', 'API', 'models', 'voteModel'))

const DEFAULT_YEAR = 2026

const defaultModels = {
  PlanningSnapshot,
  WorkflowYear: WorkflowYearModel.WorkflowYear,
  TpiPlanning,
  Slot,
  Vote
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

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    apply: false,
    year: DEFAULT_YEAR
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

function readDeletedCount(result) {
  return Number.isInteger(result?.deletedCount) ? result.deletedCount : 0
}

async function countOrDelete(model, filter, apply) {
  const matched = await model.countDocuments(filter)

  if (!apply || matched === 0) {
    return {
      matched,
      deleted: 0
    }
  }

  const result = await model.deleteMany(filter)

  return {
    matched,
    deleted: readDeletedCount(result)
  }
}

async function findTpiPlanningIds(TpiPlanningModel, year) {
  const query = TpiPlanningModel.find({ year })

  if (query && typeof query.distinct === 'function') {
    return await query.distinct('_id')
  }

  if (typeof TpiPlanningModel.distinct === 'function') {
    return await TpiPlanningModel.distinct('_id', { year })
  }

  return []
}

async function resetWorkflowYear({ WorkflowYear, year, apply }) {
  const workflow = await WorkflowYear.findOne({ year })

  if (!workflow) {
    return {
      collection: 'workflowYears',
      matched: 0,
      deleted: 0,
      modified: 0,
      dryRun: !apply,
      note: 'Aucune phase a remettre: workflow annuel absent.'
    }
  }

  if (!apply) {
    return {
      collection: 'workflowYears',
      matched: 1,
      deleted: 0,
      modified: 0,
      dryRun: true,
      note: 'Les phases seraient remises a planning.'
    }
  }

  workflow.state = 'planning'
  workflow.activePhases = ['planning']
  workflow.votingOpenedAt = null
  workflow.arbitrageOpenedAt = null
  workflow.publishedAt = null
  await workflow.save()

  return {
    collection: 'workflowYears',
    matched: 1,
    deleted: 0,
    modified: 1,
    dryRun: false
  }
}

async function runResetYear(options = {}) {
  const year = parseYear(options.year ?? DEFAULT_YEAR)
  const apply = options.apply === true
  const models = options.models || defaultModels
  const tpiPlanningIds = await findTpiPlanningIds(models.TpiPlanning, year)

  const snapshots = await countOrDelete(models.PlanningSnapshot, { year }, apply)
  const votes = tpiPlanningIds.length > 0
    ? await countOrDelete(models.Vote, { tpiPlanning: { $in: tpiPlanningIds } }, apply)
    : { matched: 0, deleted: 0 }
  const slots = await countOrDelete(models.Slot, { year }, apply)
  const tpis = await countOrDelete(models.TpiPlanning, { year }, apply)
  const workflow = await resetWorkflowYear({
    WorkflowYear: models.WorkflowYear,
    year,
    apply
  })

  return {
    options: {
      year,
      apply
    },
    results: [
      {
        collection: 'planningSnapshots',
        matched: snapshots.matched,
        deleted: snapshots.deleted,
        modified: 0,
        dryRun: !apply
      },
      {
        collection: 'votes',
        matched: votes.matched,
        deleted: votes.deleted,
        modified: 0,
        dryRun: !apply
      },
      {
        collection: 'slots',
        matched: slots.matched,
        deleted: slots.deleted,
        modified: 0,
        dryRun: !apply
      },
      {
        collection: 'tpiPlannings',
        matched: tpis.matched,
        deleted: tpis.deleted,
        modified: 0,
        dryRun: !apply
      },
      workflow
    ]
  }
}

function printReport(report, logger = console) {
  const mode = report.options.apply ? 'APPLY' : 'DRY-RUN'

  logger.log(`\nReset annee ${report.options.year} - ${mode}`)
  logger.log('='.repeat(50))

  for (const result of report.results) {
    const actionLabel = result.deleted > 0
      ? `${result.deleted} supprime(s)`
      : result.modified > 0
        ? `${result.modified} modifie(s)`
        : '0 modification'

    logger.log(
      `- ${result.collection}: ${result.matched} trouve(s), ${actionLabel}${result.dryRun ? ' (dry-run)' : ''}`
    )

    if (result.note) {
      logger.log(`  ${result.note}`)
    }
  }

  if (!report.options.apply) {
    logger.log('\nAucune suppression effectuee. Relancer avec --apply pour appliquer.')
  }
}

async function resetYear(year = DEFAULT_YEAR, options = {}) {
  const connected = await connectToDatabase()

  if (!connected) {
    throw new Error('Connexion MongoDB indisponible.')
  }

  const report = await runResetYear({
    year,
    apply: options.apply === true
  })

  printReport(report, options.logger || console)
  return report
}

async function main() {
  const options = parseArgs()

  try {
    await resetYear(options.year, { apply: options.apply })
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
  DEFAULT_YEAR,
  parseArgs,
  parseYear,
  printReport,
  resetYear,
  runResetYear
}
