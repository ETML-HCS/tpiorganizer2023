// Script pour reset l'état d'une année et permettre un nouveau gel
require('dotenv').config()
const path = require('path')
const mongoose = require('mongoose')
const { connectToDatabase } = require(path.join(__dirname, '..', 'API', 'config', 'dbConfig'))
const PlanningSnapshot = require(path.join(__dirname, '..', 'API', 'models', 'planningSnapshotModel'))
const WorkflowYearModel = require(path.join(__dirname, '..', 'API', 'models', 'workflowYearModel'))
const TpiPlanning = require(path.join(__dirname, '..', 'API', 'models', 'tpiPlanningModel'))
const Slot = require(path.join(__dirname, '..', 'API', 'models', 'slotModel'))
const Vote = require(path.join(__dirname, '..', 'API', 'models', 'voteModel'))

async function resetYear(year = 2026) {
  console.log(`\n⚠️  RESET de l'année ${year}`)
  console.log('='.repeat(50))

  await connectToDatabase()

  // 1. Supprimer les snapshots
  const deletedSnapshots = await PlanningSnapshot.deleteMany({ year })
  console.log(`📸 Snapshots supprimés: ${deletedSnapshots.deletedCount}`)

  // 2. Supprimer les votes liés aux TPI de cette année
  const tpiIds = await TpiPlanning.find({ year }).distinct('_id')
  if (tpiIds.length > 0) {
    const deletedVotes = await Vote.deleteMany({ tpiPlanning: { $in: tpiIds } })
    console.log(`🗳️ Votes supprimés: ${deletedVotes.deletedCount}`)
  }

  // 3. Supprimer les slots
  const deletedSlots = await Slot.deleteMany({ year })
  console.log(`🕐 Slots supprimés: ${deletedSlots.deletedCount}`)

  // 4. Supprimer les tpiPlannings
  const deletedTpi = await TpiPlanning.deleteMany({ year })
  console.log(`📁 tpiPlannings supprimés: ${deletedTpi.deletedCount}`)

  // 5. Remettre le workflow en état 'planning'
  const workflow = await WorkflowYearModel.WorkflowYear.findOne({ year })
  if (workflow) {
    workflow.state = 'planning'
    workflow.votingOpenedAt = null
    workflow.publishedAt = null
    await workflow.save()
    console.log(`📋 Workflow remis à: planning`)
  } else {
    console.log(`📋 Workflow: NON INITIALISÉ (sera créé au prochain gel)`)
  }

  console.log('\n✅ RESET terminé !')
  console.log(`Vous pouvez maintenant re-cliquer sur "Geler snapshot"`)
  console.log('='.repeat(50) + '\n')

  await mongoose.connection.close()
  process.exit(0)
}

const year = process.argv[2] ? parseInt(process.argv[2]) : 2026
resetYear(year)
