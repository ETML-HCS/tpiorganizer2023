// Script de diagnostic pour voir l'état de la BDD
require('dotenv').config()
const path = require('path')
const mongoose = require('mongoose')

// Charger la config BDD
const { connectToDatabase } = require(path.join(__dirname, '..', 'API', 'config', 'dbConfig'))

const TpiPlanning = require(path.join(__dirname, '..', 'API', 'models', 'tpiPlanningModel'))
const PlanningSnapshot = require(path.join(__dirname, '..', 'API', 'models', 'planningSnapshotModel'))
const WorkflowYearModel = require(path.join(__dirname, '..', 'API', 'models', 'workflowYearModel'))
const Slot = require(path.join(__dirname, '..', 'API', 'models', 'slotModel'))
const Vote = require(path.join(__dirname, '..', 'API', 'models', 'voteModel'))
const { createTpiRoomModel } = require(path.join(__dirname, '..', 'API', 'models', 'tpiRoomsModels'))
const TpiModelsYear = require(path.join(__dirname, '..', 'API', 'models', 'tpiModels'))

async function diagnose(year = 2026) {
  console.log('\n' + '='.repeat(60))
  console.log(`  DIAGNOSTIC BDD - Année ${year}`)
  console.log('='.repeat(60))

  await connectToDatabase()
  console.log('✅ Connecté à la BDD\n')

  try {
    // 1. Workflow état
    const workflow = await WorkflowYearModel.WorkflowYear.findOne({ year })
    console.log('\n📋 Workflow:')
    console.log(`   État: ${workflow?.state || 'NON INITIALISÉ'}`)
    if (workflow) {
      console.log(`   Planning at: ${workflow.planningAt}`)
      console.log(`   Voting opened at: ${workflow.votingOpenedAt}`)
      console.log(`   Published at: ${workflow.publishedAt}`)
    }

    // 2. Snapshots
    const snapshots = await PlanningSnapshot.find({ year }).sort({ version: -1 })
    console.log(`\n📸 Snapshots: ${snapshots.length}`)
    snapshots.forEach(s => {
      console.log(`   v${s.version} - ${s.isActive ? 'ACTIF' : 'inactif'} - gelé le ${s.frozenAt}`)
    })

    // 3. tpiPlannings (nouveau système)
    const tpiPlanningsCount = await TpiPlanning.countDocuments({ year })
    console.log(`\n📁 tpiPlannings (nouveau): ${tpiPlanningsCount} fiches`)
    if (tpiPlanningsCount > 0) {
      const sample = await TpiPlanning.findOne({ year }).lean()
      console.log(`   Exemple: ref=${sample.reference}, status=${sample.status}`)
      console.log(`   candidat=${sample.candidat}, expert1=${sample.expert1}, expert2=${sample.expert2}`)
    }

    // 4. Slots
    const slotsCount = await Slot.countDocuments({ year })
    console.log(`\n🕐 Slots: ${slotsCount}`)

    // 5. Votes
    const votesCount = await Vote.countDocuments()
    console.log(`\n🗳️ Votes (toutes années): ${votesCount}`)
    if (tpiPlanningsCount > 0) {
      const tpiIds = await TpiPlanning.find({ year }).distinct('_id')
      const votesForYear = await Vote.countDocuments({ tpiPlanning: { $in: tpiIds } })
      console.log(`   Votes pour ${year}: ${votesForYear}`)
    }

    // 6. Legacy rooms (tpiRooms_2026)
    try {
      const RoomModel = createTpiRoomModel(year)
      const legacyRooms = await RoomModel.find().lean()
      console.log(`\n🏠 tpiRooms_${year} (legacy rooms): ${legacyRooms.length} salles`)
      
      let totalTpiInRooms = 0
      for (const room of legacyRooms) {
        const tpiCount = Array.isArray(room.tpiDatas) ? room.tpiDatas.length : 0
        totalTpiInRooms += tpiCount
        console.log(`   ${room.name}: ${tpiCount} TPI, date=${room.date}, site=${room.site}`)
        if (tpiCount > 0) {
          // Afficher le premier TPI pour voir la structure
          const firstTpi = room.tpiDatas[0]
          console.log(`     └─ 1er TPI: ref=${firstTpi.refTpi || firstTpi.id}`)
          console.log(`        candidat="${firstTpi.candidat}"`)
          console.log(`        expert1.name="${firstTpi.expert1?.name}"`)
          console.log(`        expert2.name="${firstTpi.expert2?.name}"`)
          console.log(`        boss.name="${firstTpi.boss?.name}"`)
        }
      }
      console.log(`   Total TPI dans les salles: ${totalTpiInRooms}`)
    } catch (err) {
      console.log(`\n🏠 tpiRooms_${year}: ERREUR (${err.message})`)
    }

    // 7. Legacy tpis (tpiList_2026)
    try {
      const TpiModelsYear = require('./API/models/tpiModels')
      const LegacyTpiModel = TpiModelsYear(year)
      const legacyTpis = await LegacyTpiModel.find().lean()
      console.log(`\n📄 tpiList_${year} (legacy fiches): ${legacyTpis.length} fiches`)
      if (legacyTpis.length > 0) {
        const first = legacyTpis[0]
        console.log(`   Exemple: refTpi="${first.refTpi}"`)
        console.log(`   candidat="${first.candidat}"`)
        console.log(`   experts: ${JSON.stringify(first.experts)}`)
        console.log(`   boss="${first.boss}"`)
        console.log(`   candidatPersonId=${first.candidatPersonId}`)
        console.log(`   expert1PersonId=${first.expert1PersonId}`)
        console.log(`   expert2PersonId=${first.expert2PersonId}`)
        console.log(`   bossPersonId=${first.bossPersonId}`)
      }
    } catch (err) {
      console.log(`\n📄 tpiList_${year}: ERREUR (${err.message})`)
    }

    console.log('\n' + '='.repeat(60))
    console.log('  FIN DIAGNOSTIC')
    console.log('='.repeat(60) + '\n')

    // Demander si on veut reset
    console.log('⚠️  Pour re-tester le gel, exécutez :')
    console.log(`   node scripts\\reset-year.js ${year}`)

  } catch (err) {
    console.error('Erreur diagnostic:', err)
  } finally {
    await mongoose.connection.close()
    process.exit(0)
  }
}

const year = process.argv[2] ? parseInt(process.argv[2]) : 2026
diagnose(year)
