const assert = require('node:assert/strict')
const test = require('node:test')

const {
  DEFAULT_YEAR,
  parseArgs,
  parseYear,
  runResetYear
} = require('../../scripts/reset-year')

function createCountDeleteModel({ count = 0, ids = [], calls }) {
  return {
    countDocuments: async (filter) => {
      calls.push(['count', filter])
      return count
    },
    deleteMany: async (filter) => {
      calls.push(['delete', filter])
      return { deletedCount: count }
    },
    find: (filter) => {
      calls.push(['find', filter])
      return {
        distinct: async (field) => {
          calls.push(['distinct', field])
          return ids
        }
      }
    }
  }
}

test('reset-year parseArgs reste en dry-run par defaut', () => {
  assert.deepEqual(parseArgs([]), {
    apply: false,
    year: DEFAULT_YEAR
  })

  assert.deepEqual(parseArgs(['--year=2027', '--apply']), {
    apply: true,
    year: 2027
  })

  assert.deepEqual(parseArgs(['2028', '--apply', '--dry-run']), {
    apply: false,
    year: 2028
  })
})

test('reset-year refuse les annees invalides', () => {
  assert.throws(() => parseYear('1999'), /Annee invalide/)
  assert.throws(() => parseArgs(['--year=2026abc']), /Annee invalide/)
})

test('runResetYear compte les suppressions sans ecrire en dry-run', async () => {
  const calls = []
  const workflow = {
    save: async () => calls.push(['workflow-save'])
  }

  const report = await runResetYear({
    year: 2026,
    apply: false,
    models: {
      PlanningSnapshot: createCountDeleteModel({ count: 2, calls }),
      Vote: createCountDeleteModel({ count: 3, calls }),
      Slot: createCountDeleteModel({ count: 4, calls }),
      TpiPlanning: createCountDeleteModel({ count: 5, ids: ['tpi-1', 'tpi-2'], calls }),
      WorkflowYear: {
        findOne: async (filter) => {
          calls.push(['workflow-find', filter])
          return workflow
        }
      }
    }
  })

  assert.equal(report.options.apply, false)
  assert.equal(report.results.find(result => result.collection === 'planningSnapshots').matched, 2)
  assert.equal(report.results.find(result => result.collection === 'votes').matched, 3)
  assert.equal(report.results.find(result => result.collection === 'workflowYears').modified, 0)
  assert.equal(calls.some(([action]) => action === 'delete'), false)
  assert.equal(calls.some(([action]) => action === 'workflow-save'), false)
})

test('runResetYear supprime et remet les phases uniquement avec apply', async () => {
  const calls = []
  const workflow = {
    state: 'published',
    activePhases: ['published'],
    votingOpenedAt: new Date('2026-01-01T00:00:00Z'),
    arbitrageOpenedAt: new Date('2026-01-02T00:00:00Z'),
    publishedAt: new Date('2026-01-03T00:00:00Z'),
    save: async () => calls.push(['workflow-save'])
  }

  const report = await runResetYear({
    year: 2026,
    apply: true,
    models: {
      PlanningSnapshot: createCountDeleteModel({ count: 2, calls }),
      Vote: createCountDeleteModel({ count: 3, calls }),
      Slot: createCountDeleteModel({ count: 4, calls }),
      TpiPlanning: createCountDeleteModel({ count: 5, ids: ['tpi-1'], calls }),
      WorkflowYear: {
        findOne: async (filter) => {
          calls.push(['workflow-find', filter])
          return workflow
        }
      }
    }
  })

  assert.equal(report.options.apply, true)
  assert.equal(report.results.find(result => result.collection === 'tpiPlannings').deleted, 5)
  assert.equal(report.results.find(result => result.collection === 'workflowYears').modified, 1)
  assert.equal(workflow.state, 'planning')
  assert.deepEqual(workflow.activePhases, ['planning'])
  assert.equal(workflow.votingOpenedAt, null)
  assert.equal(workflow.arbitrageOpenedAt, null)
  assert.equal(workflow.publishedAt, null)
  assert.equal(calls.some(([action]) => action === 'delete'), true)
  assert.equal(calls.some(([action]) => action === 'workflow-save'), true)
})
