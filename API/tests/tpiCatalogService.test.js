const test = require('node:test')
const assert = require('node:assert/strict')

const { deleteTpiCatalogByYear } = require('../services/tpiCatalogService')

test('deleteTpiCatalogByYear deletes the whole year catalog', async () => {
  let calledWithYear = null
  let calledWithFilter = null

  const result = await deleteTpiCatalogByYear(2026, (year) => {
    calledWithYear = year

    return {
      deleteMany: async (filter) => {
        calledWithFilter = filter
        return { deletedCount: 17 }
      }
    }
  })

  assert.equal(calledWithYear, 2026)
  assert.deepEqual(calledWithFilter, {})
  assert.equal(result.year, 2026)
  assert.equal(result.deletedCount, 17)
})

test('deleteTpiCatalogByYear rejects an invalid year', async () => {
  await assert.rejects(
    () => deleteTpiCatalogByYear('abc', () => ({ deleteMany: async () => ({ deletedCount: 0 }) })),
    /Année invalide\./
  )
})
