const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const mongoose = require('mongoose')

const serverApiPath = path.resolve(__dirname, '../serverAPI.js')
const dbConfigPath = path.resolve(__dirname, '../config/dbConfig.js')
const loadEnvPath = path.resolve(__dirname, '../config/loadEnv.js')

function clearModule(modulePath) {
  try {
    delete require.cache[require.resolve(modulePath)]
  } catch (error) {
    // Ignore cache misses during test setup.
  }
}

function loadServerApi(env = {}) {
  const originalEnv = { ...process.env }

  for (const key of Object.keys(process.env)) {
    delete process.env[key]
  }

  Object.assign(process.env, originalEnv, env)

  clearModule(serverApiPath)
  clearModule(dbConfigPath)
  clearModule(loadEnvPath)

  return {
    serverApi: require(serverApiPath),
    restoreEnv() {
      for (const key of Object.keys(process.env)) {
        delete process.env[key]
      }

      Object.assign(process.env, originalEnv)
      clearModule(serverApiPath)
      clearModule(dbConfigPath)
      clearModule(loadEnvPath)
    }
  }
}

test('startServer waits for MongoDB connection before listening', async () => {
  const originalConnect = mongoose.connect
  const { serverApi, restoreEnv } = loadServerApi({
    DB_URI: 'mongodb://localhost:27017/tpiorganizer_test',
    JWT_SECRET: 'test-secret'
  })

  let connectResolved = false
  const fakeServer = {
    close() {},
    once() {},
    off() {}
  }
  const originalListen = serverApi.app.listen

  mongoose.connect = async uri => {
    assert.equal(uri, 'mongodb://localhost:27017/tpiorganizer_test')
    await new Promise(resolve => setTimeout(resolve, 20))
    connectResolved = true
    return mongoose
  }

  serverApi.app.listen = (requestedPort, callback) => {
    assert.equal(connectResolved, true)
    setImmediate(callback)
    return fakeServer
  }

  try {
    const server = await serverApi.startServer({
      connectDb: true,
      logger: {
        log: () => {},
        warn: () => {},
        error: () => {}
      }
    })

    assert.equal(server, fakeServer)
  } finally {
    serverApi.app.listen = originalListen
    mongoose.connect = originalConnect
    restoreEnv()
  }
})

test('startServer aborts when MongoDB connection fails', async () => {
  const originalConnect = mongoose.connect
  const { serverApi, restoreEnv } = loadServerApi({
    DB_URI: 'mongodb://localhost:27017/tpiorganizer_test',
    JWT_SECRET: 'test-secret'
  })

  let listenCalls = 0
  const originalListen = serverApi.app.listen

  mongoose.connect = async () => {
    throw new Error('connect failed')
  }

  serverApi.app.listen = () => {
    listenCalls += 1
    throw new Error('listen should not be called')
  }

  try {
    await assert.rejects(
      serverApi.startServer({
        connectDb: true,
        logger: {
          log: () => {},
          warn: () => {},
          error: () => {}
        }
      }),
      error => {
        assert.equal(error.code, 'DATABASE_UNAVAILABLE')
        assert.equal(error.statusCode, 503)
        assert.equal(error.message, 'Connexion MongoDB impossible. Backend non demarre.')
        return true
      }
    )

    assert.equal(listenCalls, 0)
  } finally {
    serverApi.app.listen = originalListen
    mongoose.connect = originalConnect
    restoreEnv()
  }
})

test('startServer propagates listen errors', async () => {
  const { serverApi, restoreEnv } = loadServerApi({
    JWT_SECRET: 'test-secret'
  })

  const originalListen = serverApi.app.listen
  const listenError = new Error('listen failed')

  serverApi.app.listen = () => {
    const fakeServer = {
      once(eventName, handler) {
        if (eventName === 'error') {
          setImmediate(() => handler(listenError))
        }
      },
      off() {}
    }

    return fakeServer
  }

  try {
    await assert.rejects(
      serverApi.startServer({
        connectDb: false,
        logger: {
          log: () => {},
          warn: () => {},
          error: () => {}
        }
      }),
      listenError
    )
  } finally {
    serverApi.app.listen = originalListen
    restoreEnv()
  }
})
