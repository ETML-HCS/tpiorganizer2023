const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const mongoose = require('mongoose')
const { closeServer, startServer } = require('./helpers/httpTest')

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

test('production app serves the compiled client build without hijacking API routes', async () => {
  const clientBuildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tpiorganizer-client-build-'))
  const assetsDir = path.join(clientBuildDir, 'assets')

  fs.mkdirSync(assetsDir, { recursive: true })
  fs.writeFileSync(
    path.join(clientBuildDir, 'index.html'),
    '<!doctype html><html><head><title>TPI prod</title></head><body><div id="root"></div></body></html>'
  )
  fs.writeFileSync(path.join(assetsDir, 'app.js'), 'console.log("client build")')

  const { serverApi, restoreEnv } = loadServerApi({
    AUTH_PASS_PLAIN: '',
    AUTH_USER_PLAIN: '',
    CLIENT_BUILD_DIR: clientBuildDir,
    CORS_ORIGIN: 'http://127.0.0.1',
    JWT_SECRET: 'x'.repeat(64),
    NODE_ENV: 'production',
    REACT_APP_DEBUG: 'false',
    SKIP_APP_AUTH: 'false'
  })

  let server = null

  try {
    const started = await startServer(serverApi.app)
    server = started.server

    const clientResponse = await fetch(`${started.baseUrl}/planification`)
    assert.equal(clientResponse.status, 200)
    assert.match(await clientResponse.text(), /TPI prod/)

    const assetResponse = await fetch(`${started.baseUrl}/assets/app.js`)
    assert.equal(assetResponse.status, 200)
    assert.match(await assetResponse.text(), /client build/)

    const apiResponse = await fetch(`${started.baseUrl}/api/magic-link/resolve`)
    assert.equal(apiResponse.status, 400)
    assert.match(apiResponse.headers.get('content-type') || '', /application\/json/)
  } finally {
    await closeServer(server)
    restoreEnv()
    fs.rmSync(clientBuildDir, { recursive: true, force: true })
  }
})
