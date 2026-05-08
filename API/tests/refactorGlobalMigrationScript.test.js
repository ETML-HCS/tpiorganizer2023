const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildStatusMigrationFilter,
  buildStatusMigrationUpdate,
  normalizeLegacyStatus,
  normalizeSnapshotDocument,
  parseArgs,
  parseYear,
  runMigration
} = require('../../scripts/refactor-global-migration')
const TpiCoordination = require('../models/tpiCoordinationModel')
const CoordinationSnapshot = require('../models/coordinationSnapshotModel')
const WorkflowYearModel = require('../models/workflowYearModel')
const { withStubSandbox } = require('./helpers/stubSandbox')

test('refactor migration parses dry-run/apply options safely', () => {
  assert.deepEqual(parseArgs([]), {
    apply: false,
    year: null,
    includeLegacyCatalog: false
  })
  assert.deepEqual(parseArgs(['2026', '--apply', '--include-legacy-catalog']), {
    apply: true,
    year: 2026,
    includeLegacyCatalog: true
  })
  assert.deepEqual(parseArgs(['--year=2027', '--dry-run']), {
    apply: false,
    year: 2027,
    includeLegacyCatalog: false
  })
  assert.throws(() => parseYear('1999'), /Annee invalide/)
  assert.throws(() => parseYear('2026abc'), /Annee invalide/)
})

test('refactor migration builds scoped status filters and audit updates', () => {
  assert.deepEqual(buildStatusMigrationFilter(2026), {
    year: 2026,
    status: { $in: ['requires_manual_intervention'] }
  })
  assert.deepEqual(buildStatusMigrationFilter(null), {
    status: { $in: ['requires_manual_intervention'] }
  })

  const update = buildStatusMigrationUpdate()
  assert.equal(update.$set.status, 'manual_required')
  assert.equal(update.$push.history.action, 'migration.refactor_global.normalize_status')
  assert.equal(update.$push.history.details.from, 'requires_manual_intervention')
  assert.equal(update.$push.history.details.to, 'manual_required')
})

test('refactor migration normalizes legacy coordination status aliases', () => {
  assert.equal(normalizeLegacyStatus('requires_manual_intervention'), 'manual_required')
  assert.equal(normalizeLegacyStatus('manual_required'), 'manual_required')
  assert.equal(normalizeLegacyStatus('pending_votes'), 'pending_votes')
  assert.equal(normalizeLegacyStatus('unknown'), 'unknown')
})

test('refactor migration normalizes snapshot entries without mutating unrelated statuses', () => {
  const snapshot = {
    entries: [
      { reference: 'TPI-2026-001', status: 'requires_manual_intervention' },
      { reference: 'TPI-2026-002', status: 'confirmed' }
    ]
  }

  const result = normalizeSnapshotDocument(snapshot)
  assert.equal(result.changed, true)
  assert.deepEqual(result.entries, [
    { reference: 'TPI-2026-001', status: 'manual_required' },
    { reference: 'TPI-2026-002', status: 'confirmed' }
  ])
  assert.equal(snapshot.entries[0].status, 'requires_manual_intervention')
})

test('refactor migration dry-run reports real legacy snapshot collection without writes', async () => {
  await withStubSandbox(async (sandbox) => {
    let updateCalled = false
    const snapshot = {
      entries: [{ reference: 'TPI-2026-001', status: 'requires_manual_intervention' }],
      save: async () => {
        throw new Error('dry-run must not save snapshots')
      }
    }

    sandbox.replace(TpiCoordination, 'countDocuments', async () => 2)
    sandbox.replace(TpiCoordination, 'updateMany', async () => {
      updateCalled = true
      return { modifiedCount: 2 }
    })
    sandbox.replace(CoordinationSnapshot, 'find', async () => [snapshot])
    sandbox.replace(WorkflowYearModel.WorkflowYear, 'find', () => ({
      lean: async () => [{ year: 2026 }]
    }))

    const report = await runMigration({ year: 2026 })

    assert.equal(updateCalled, false)
    assert.deepEqual(report.options, {
      apply: false,
      year: 2026,
      includeLegacyCatalog: false
    })
    assert.deepEqual(report.results.map((result) => result.collection), [
      'tpiPlannings',
      'planningSnapshots',
      'workflowYears'
    ])
    assert.deepEqual(report.results.map((result) => result.modified), [0, 0, 0])
    assert.equal(report.results[1].matched, 1)
  })
})

test('refactor migration apply updates only the scoped status aliases', async () => {
  await withStubSandbox(async (sandbox) => {
    let updateFilter = null
    let snapshotSaveCount = 0
    const snapshot = {
      entries: [{ reference: 'TPI-2026-001', status: 'requires_manual_intervention' }],
      save: async function save() {
        snapshotSaveCount += 1
        return this
      }
    }

    sandbox.replace(TpiCoordination, 'countDocuments', async (filter) => {
      assert.deepEqual(filter, buildStatusMigrationFilter(2026))
      return 2
    })
    sandbox.replace(TpiCoordination, 'updateMany', async (filter, update) => {
      updateFilter = filter
      assert.equal(update.$set.status, 'manual_required')
      return { modifiedCount: 2 }
    })
    sandbox.replace(CoordinationSnapshot, 'find', async (filter) => {
      assert.deepEqual(filter, { year: 2026 })
      return [snapshot]
    })
    sandbox.replace(WorkflowYearModel.WorkflowYear, 'find', () => ({
      lean: async () => []
    }))

    const report = await runMigration({ year: 2026, apply: true })

    assert.deepEqual(updateFilter, buildStatusMigrationFilter(2026))
    assert.equal(snapshotSaveCount, 1)
    assert.equal(snapshot.entries[0].status, 'manual_required')
    assert.equal(report.results[0].modified, 2)
    assert.equal(report.results[1].modified, 1)
    assert.equal(report.results.every((result) => result.dryRun === false || result.collection === 'workflowYears'), true)
  })
})
