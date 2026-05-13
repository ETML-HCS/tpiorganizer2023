const test = require('node:test')
const assert = require('node:assert/strict')

const Person = require('../models/personModel')
const TpiModelsYear = require('../models/tpiModels')
const TpiPlanning = require('../models/tpiCoordinationModel')
const {
  listGestionTpis,
  saveGestionTpi,
  updateGestionTpi
} = require('../modules/gestionTpi/catalogService')
const { makeQueryResult, withStubSandbox } = require('./helpers/stubSandbox')

function stubPeople(sandbox, people = []) {
  sandbox.replace(Person, 'find', () => ({
    select() {
      return {
        lean: async () => people
      }
    }
  }))
}

test('listGestionTpis rejects partial year values', async () => {
  await assert.rejects(
    () => listGestionTpis('2026abc'),
    (error) => {
      assert.equal(error.statusCode, 400)
      assert.equal(error.message, 'Année invalide.')
      return true
    }
  )
})

test('listGestionTpis maps workflow-prefixed refs to coordination lifecycle status', async () => {
  await withStubSandbox(async (sandbox) => {
    const tpiModel = TpiModelsYear(2026)
    let capturedPlanningQuery = null

    stubPeople(sandbox, [
      { _id: 'candidate-1', firstName: 'Alice', lastName: 'Candidate', roles: ['candidat'], candidateYears: [2026], isActive: true },
      { _id: 'expert-1', firstName: 'Expert', lastName: 'One', roles: ['expert'], isActive: true },
      { _id: 'expert-2', firstName: 'Expert', lastName: 'Two', roles: ['expert'], isActive: true },
      { _id: 'boss-1', firstName: 'Chef', lastName: 'Projet', roles: ['chef_projet'], isActive: true }
    ])
    sandbox.replace(tpiModel, 'find', async () => ([{
      _id: 'legacy-tpi-42',
      refTpi: 'TPI-2026-042',
      candidat: 'Alice Candidate',
      candidatPersonId: 'candidate-1',
      experts: {
        1: 'Expert One',
        2: 'Expert Two'
      },
      expert1PersonId: 'expert-1',
      expert2PersonId: 'expert-2',
      boss: 'Chef Projet',
      bossPersonId: 'boss-1',
      status: 'ready_for_planning',
      dates: {
        depart: '2026-03-01',
        fin: '2026-06-01'
      }
    }]))
    sandbox.replace(tpiModel, 'bulkWrite', async () => ({ modifiedCount: 0 }))
    sandbox.replace(TpiPlanning, 'find', (query) => {
      capturedPlanningQuery = query
      const refs = Array.isArray(query?.reference?.$in) ? query.reference.$in : []

      return makeQueryResult(
        refs.includes('TPI-2026-042')
          ? [{
              _id: 'planning-tpi-42',
              reference: 'TPI-2026-042',
              status: 'confirmed',
              confirmedSlot: 'slot-1'
            }]
          : []
      )
    })

    const tpis = await listGestionTpis(2026)

    assert.ok(capturedPlanningQuery.reference.$in.includes('TPI-2026-042'))
    assert.equal(tpis[0].status, 'defense_scheduled')
    assert.equal(tpis[0].lifecycle.status, 'defense_scheduled')
  })
})

test('saveGestionTpi rejects blocking TPI rule issues before writing', async () => {
  await withStubSandbox(async (sandbox) => {
    const tpiModel = TpiModelsYear(2026)
    let wasWriteCalled = false

    stubPeople(sandbox)
    sandbox.replace(tpiModel, 'findOneAndUpdate', async () => {
      wasWriteCalled = true
      return null
    })

    await assert.rejects(
      () => saveGestionTpi(2026, {
        validationMode: 'import',
        refTpi: '2163',
        candidat: 'Alice Candidate',
        experts: {
          1: 'Expert One',
          2: 'Expert Two'
        },
        boss: 'Chef Projet',
        dates: {
          depart: '2026-06-10',
          fin: '2026-06-01'
        }
      }),
      (error) => {
        assert.equal(error.statusCode, 400)
        assert.equal(error.details.issues[0].type, 'tpi_date_order')
        return true
      }
    )

    assert.equal(wasWriteCalled, false)
  })
})

test('saveGestionTpi persists journal, report and lifecycle fields', async () => {
  await withStubSandbox(async (sandbox) => {
    const tpiModel = TpiModelsYear(2026)
    let capturedUpdate = null

    stubPeople(sandbox, [
      { _id: 'candidate-1', firstName: 'Alice', lastName: 'Candidate', roles: ['candidat'], candidateYears: [2026], isActive: true },
      { _id: 'expert-1', firstName: 'Expert', lastName: 'One', roles: ['expert'], isActive: true },
      { _id: 'expert-2', firstName: 'Expert', lastName: 'Two', roles: ['expert'], isActive: true },
      { _id: 'boss-1', firstName: 'Chef', lastName: 'Projet', roles: ['chef_projet'], isActive: true }
    ])
    sandbox.replace(tpiModel, 'findOneAndUpdate', async (filter, update) => {
      capturedUpdate = { filter, update }
      return { _id: 'saved-tpi', ...update }
    })

    const saved = await saveGestionTpi(2026, {
      refTpi: '2163',
      candidat: 'Alice Candidate',
      experts: {
        1: 'Expert One',
        2: 'Expert Two'
      },
      boss: 'Chef Projet',
      dates: {
        depart: '2026-03-01',
        fin: '2026-06-01',
        renduFinal: '2026-06-05'
      },
      journal: {
        status: 'in_progress',
        lastEntryAt: '2026-04-10'
      },
      rapport: {
        status: 'submitted',
        submittedAt: '2026-06-04',
        url: 'https://example.test/rapport.pdf'
      }
    })

    assert.equal(saved._id, 'saved-tpi')
    assert.equal(capturedUpdate.filter.refTpi, '2163')
    assert.equal(capturedUpdate.update.candidatPersonId, 'candidate-1')
    assert.equal(capturedUpdate.update.status, 'ready_for_planning')
    assert.equal(capturedUpdate.update.journal.status, 'in_progress')
    assert.equal(capturedUpdate.update.rapport.status, 'submitted')
    assert.equal(capturedUpdate.update.validation.isValid, true)
  })
})

test('saveGestionTpi synchronizes the matching planning TPI after upsert', async () => {
  await withStubSandbox(async (sandbox) => {
    const tpiModel = TpiModelsYear(2026)
    let capturedPlanningQuery = null
    let capturedPlanningUpdate = null

    stubPeople(sandbox, [
      { _id: '507f1f77bcf86cd799439011', firstName: 'Alice', lastName: 'Candidate', roles: ['candidat'], candidateYears: [2026], isActive: true },
      { _id: '507f1f77bcf86cd799439012', firstName: 'Expert', lastName: 'One', roles: ['expert'], isActive: true },
      { _id: '507f1f77bcf86cd799439013', firstName: 'Expert', lastName: 'Two', roles: ['expert'], isActive: true },
      { _id: '507f1f77bcf86cd799439014', firstName: 'Chef', lastName: 'Projet', roles: ['chef_projet'], isActive: true }
    ])
    sandbox.replace(tpiModel, 'findOneAndUpdate', async (filter, update) => ({
      _id: '507f1f77bcf86cd799439021',
      ...update
    }))
    sandbox.replace(TpiPlanning, 'findOne', (query) => {
      capturedPlanningQuery = query
      return makeQueryResult({
        _id: '507f1f77bcf86cd799439099',
        reference: 'TPI-2026-2163'
      })
    })
    sandbox.replace(TpiPlanning, 'updateOne', async (filter, update) => {
      capturedPlanningUpdate = { filter, update }
      return { matchedCount: 1, modifiedCount: 1 }
    })

    await saveGestionTpi(2026, {
      refTpi: '2163',
      candidat: 'Alice Candidate',
      experts: {
        1: 'Expert One',
        2: 'Expert Two'
      },
      boss: 'Chef Projet',
      classe: 'INF4A',
      sujet: 'Sujet mis a jour',
      description: 'Description mise a jour',
      lieu: {
        entreprise: 'Entreprise Test',
        site: 'ETML'
      },
      dates: {
        depart: '2026-03-01',
        fin: '2026-06-01'
      }
    })

    assert.deepEqual(capturedPlanningQuery.reference.$in, ['2163', 'TPI-2026-2163'])
    assert.equal(String(capturedPlanningUpdate.filter._id), '507f1f77bcf86cd799439099')
    assert.equal(capturedPlanningUpdate.update.$set.sujet, 'Sujet mis a jour')
    assert.equal(capturedPlanningUpdate.update.$set.description, 'Description mise a jour')
    assert.equal(capturedPlanningUpdate.update.$set.classe, 'INF4A')
    assert.equal(capturedPlanningUpdate.update.$set.site, 'ETML')
    assert.equal(capturedPlanningUpdate.update.$set['entreprise.nom'], 'Entreprise Test')
    assert.equal(String(capturedPlanningUpdate.update.$set.candidat), '507f1f77bcf86cd799439011')
    assert.equal(String(capturedPlanningUpdate.update.$set.expert1), '507f1f77bcf86cd799439012')
    assert.equal(String(capturedPlanningUpdate.update.$set.expert2), '507f1f77bcf86cd799439013')
    assert.equal(String(capturedPlanningUpdate.update.$set.chefProjet), '507f1f77bcf86cd799439014')
  })
})

test('updateGestionTpi rejects invalid status transitions', async () => {
  await withStubSandbox(async (sandbox) => {
    const tpiModel = TpiModelsYear(2026)
    let wasUpdateCalled = false

    stubPeople(sandbox)
    sandbox.replace(tpiModel, 'findById', async () => ({
      _id: '507f1f77bcf86cd799439011',
      status: 'draft',
      statusHistory: []
    }))
    sandbox.replace(tpiModel, 'findByIdAndUpdate', async () => {
      wasUpdateCalled = true
      return null
    })

    await assert.rejects(
      () => updateGestionTpi(2026, '507f1f77bcf86cd799439011', {
        refTpi: '2163',
        candidat: 'Alice Candidate',
        experts: {
          1: 'Expert One',
          2: 'Expert Two'
        },
        boss: 'Chef Projet',
        status: 'completed'
      }),
      (error) => {
        assert.equal(error.statusCode, 400)
        assert.equal(error.details.type, 'invalid_status_transition')
        return true
      }
    )

    assert.equal(wasUpdateCalled, false)
  })
})

test('updateGestionTpi rejects coordination-ready status with unresolved stakeholders', async () => {
  await withStubSandbox(async (sandbox) => {
    const tpiModel = TpiModelsYear(2026)
    let wasUpdateCalled = false

    stubPeople(sandbox, [
      { _id: 'candidate-1', firstName: 'Alice', lastName: 'Candidate', roles: ['candidat'], candidateYears: [2026], isActive: true },
      { _id: 'expert-1', firstName: 'Expert', lastName: 'One', roles: ['expert'], isActive: true },
      { _id: 'boss-1', firstName: 'Chef', lastName: 'Projet', roles: ['chef_projet'], isActive: true }
    ])
    sandbox.replace(tpiModel, 'findById', async () => ({
      _id: '507f1f77bcf86cd799439011',
      refTpi: '2163',
      candidat: 'Alice Candidate',
      experts: {
        1: 'Expert One',
        2: 'Expert Two'
      },
      boss: 'Chef Projet',
      status: 'draft',
      statusHistory: []
    }))
    sandbox.replace(tpiModel, 'findByIdAndUpdate', async () => {
      wasUpdateCalled = true
      return null
    })

    await assert.rejects(
      () => updateGestionTpi(2026, '507f1f77bcf86cd799439011', {
        status: 'ready_for_planning'
      }),
      (error) => {
        assert.equal(error.statusCode, 400)
        assert.equal(error.message, 'Le statut demandé exige des parties prenantes validées.')
        assert.deepEqual(error.details.unresolvedRoles, ['expert2'])
        return true
      }
    )

    assert.equal(wasUpdateCalled, false)
  })
})

test('updateGestionTpi preserves existing fields on partial updates', async () => {
  await withStubSandbox(async (sandbox) => {
    const tpiModel = TpiModelsYear(2026)
    let capturedUpdate = null

    stubPeople(sandbox)
    sandbox.replace(tpiModel, 'findById', async () => ({
      _id: '507f1f77bcf86cd799439011',
      refTpi: '2163',
      candidat: 'Alice Candidate',
      experts: {
        1: 'Expert One',
        2: 'Expert Two'
      },
      boss: 'Chef Projet',
      status: 'ready_for_planning',
      dates: {
        depart: '2026-03-01',
        fin: '2026-06-01'
      },
      statusHistory: []
    }))
    sandbox.replace(tpiModel, 'findByIdAndUpdate', async (id, update) => {
      capturedUpdate = update
      return { _id: id, ...update }
    })

    await updateGestionTpi(2026, '507f1f77bcf86cd799439011', {
      sujet: 'Sujet mis a jour'
    })

    assert.equal(capturedUpdate.refTpi, '2163')
    assert.equal(capturedUpdate.candidat, 'Alice Candidate')
    assert.equal(capturedUpdate.experts[1], 'Expert One')
    assert.equal(capturedUpdate.experts[2], 'Expert Two')
    assert.equal(capturedUpdate.boss, 'Chef Projet')
    assert.equal(capturedUpdate.sujet, 'Sujet mis a jour')
  })
})
