const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const mongoose = require('mongoose')

const dbConfigPath = path.resolve(__dirname, '../config/dbConfig.js')
const loadEnvPath = path.resolve(__dirname, '../config/loadEnv.js')

function clearModule(modulePath) {
  try {
    delete require.cache[require.resolve(modulePath)]
  } catch (error) {
    // Ignore cache misses in test bootstrap.
  }
}

function loadDbConfig() {
  clearModule(dbConfigPath)
  clearModule(loadEnvPath)
  return require(dbConfigPath)
}

test('dbConfig import does not trigger mongoose.connect', async () => {
  const originalConnect = mongoose.connect
  let connectCalls = 0

  mongoose.connect = async () => {
    connectCalls += 1
    return mongoose
  }

  try {
    loadDbConfig()
    assert.equal(connectCalls, 0)
  } finally {
    mongoose.connect = originalConnect
    clearModule(dbConfigPath)
  }
})

test('buildMongoUri prioritizes explicit DB_URI', async () => {
  const { buildMongoUri } = loadDbConfig()

  const uri = buildMongoUri({
    DB_URI: 'mongodb://custom-host/custom-db',
    DB_CLUSTER: 'localhost:27017',
    DB_NAME: 'ignoredDb'
  })

  assert.equal(uri, 'mongodb://custom-host/custom-db')
})

test('buildMongoUri supports localhost and atlas formats', async () => {
  const { buildMongoUri } = loadDbConfig()

  const localUri = buildMongoUri({
    DB_CLUSTER: 'localhost:27017',
    DB_NAME: 'tpiorganizer_test'
  })
  assert.equal(localUri, 'mongodb://localhost:27017/tpiorganizer_test')

  const atlasUri = buildMongoUri({
    DB_CLUSTER: 'cluster0.mongodb.net',
    DB_NAME: 'tpiorganizer',
    DB_USERNAME: 'user@example.com',
    DB_PASSWORD: 'pa$$w0rd'
  })
  assert.equal(
    atlasUri,
    'mongodb+srv://user%40example.com:pa%24%24w0rd@cluster0.mongodb.net/tpiorganizer'
  )
})

test('connectToDatabase warns when Mongo config is missing', async () => {
  const { connectToDatabase, MONGO_CONFIG_WARNING } = loadDbConfig()
  const originalConnect = mongoose.connect
  let connectCalls = 0
  const warnings = []

  mongoose.connect = async () => {
    connectCalls += 1
    return mongoose
  }

  try {
    const connected = await connectToDatabase({
      env: {},
      logger: {
        warn: message => warnings.push(message),
        error: () => {}
      }
    })

    assert.equal(connected, false)
    assert.equal(connectCalls, 0)
    assert.deepEqual(warnings, [MONGO_CONFIG_WARNING])
  } finally {
    mongoose.connect = originalConnect
    clearModule(dbConfigPath)
  }
})

test('connectToDatabase uses mongoose.connect when config is valid', async () => {
  const { connectToDatabase } = loadDbConfig()
  const originalConnect = mongoose.connect
  let connectCalls = 0

  mongoose.connect = async uri => {
    connectCalls += 1
    assert.equal(uri, 'mongodb://localhost:27017/tpiorganizer_test')
    return mongoose
  }

  try {
    const connected = await connectToDatabase({
      env: {
        DB_CLUSTER: 'localhost:27017',
        DB_NAME: 'tpiorganizer_test'
      },
      logger: {
        warn: () => {},
        error: () => {}
      }
    })

    assert.equal(connected, true)
    assert.equal(connectCalls, 1)
  } finally {
    mongoose.connect = originalConnect
    clearModule(dbConfigPath)
  }
})

test('connectToDatabase reuses the same pending connection promise', async () => {
  const { connectToDatabase } = loadDbConfig()
  const originalConnect = mongoose.connect
  let connectCalls = 0

  mongoose.connect = async uri => {
    connectCalls += 1
    assert.equal(uri, 'mongodb://localhost:27017/tpiorganizer_test')
    await new Promise(resolve => setTimeout(resolve, 20))
    return mongoose
  }

  try {
    const [firstResult, secondResult] = await Promise.all([
      connectToDatabase({
        env: {
          DB_CLUSTER: 'localhost:27017',
          DB_NAME: 'tpiorganizer_test'
        },
        logger: {
          warn: () => {},
          error: () => {}
        }
      }),
      connectToDatabase({
        env: {
          DB_CLUSTER: 'localhost:27017',
          DB_NAME: 'tpiorganizer_test'
        },
        logger: {
          warn: () => {},
          error: () => {}
        }
      })
    ])

    assert.equal(firstResult, true)
    assert.equal(secondResult, true)
    assert.equal(connectCalls, 1)
  } finally {
    mongoose.connect = originalConnect
    clearModule(dbConfigPath)
  }
})
