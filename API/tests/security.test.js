const test = require('node:test')
const assert = require('node:assert/strict')

const {
  assertProductionAuthSafety,
  isDevAuthBypassEnabled
} = require('../middleware/appAuth')

test('Production mode rejects auth bypass flags', () => {
  const originalEnv = { ...process.env }

  try {
    process.env.NODE_ENV = 'production'
    process.env.SKIP_APP_AUTH = 'true'
    process.env.REACT_APP_DEBUG = 'true'

    assert.equal(isDevAuthBypassEnabled(), false)
    assert.throws(
      () => assertProductionAuthSafety(),
      /Configuration d'authentification de production invalide/
    )
  } finally {
    process.env = originalEnv
  }
})
