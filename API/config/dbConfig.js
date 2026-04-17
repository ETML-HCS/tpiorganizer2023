require('./loadEnv')
const mongoose = require('mongoose')

const MONGO_CONFIG_WARNING =
  'Configuration MongoDB incomplète. Définissez DB_URI ou DB_CLUSTER/DB_NAME/DB_USERNAME/DB_PASSWORD.'

function buildMongoUri(env = process.env) {
  const explicitUri = env.DB_URI
  if (explicitUri) {
    return explicitUri
  }

  const dbName = env.DB_NAME
  const cluster = env.DB_CLUSTER

  if (cluster && cluster.includes('localhost') && dbName) {
    return `mongodb://${cluster}/${dbName}`
  }

  const username = env.DB_USERNAME
    ? encodeURIComponent(env.DB_USERNAME)
    : ''
  const password = env.DB_PASSWORD
    ? encodeURIComponent(env.DB_PASSWORD)
    : ''

  if (cluster && dbName && username && password) {
    return `mongodb+srv://${username}:${password}@${cluster}/${dbName}`
  }

  return null
}

async function connectToDatabase(options = {}) {
  const {
    env = process.env,
    logger = console
  } = options

  const uri = buildMongoUri(env)
  if (!uri) {
    logger.warn(MONGO_CONFIG_WARNING)
    return false
  }

  if (mongoose.connection.readyState !== 0) {
    return true
  }

  try {
    await mongoose.connect(uri)
    return true
  } catch (error) {
    logger.error('Erreur de connexion à MongoDB :', error)
    return false
  }
}

module.exports = {
  buildMongoUri,
  connectToDatabase,
  db: mongoose.connection,
  MONGO_CONFIG_WARNING
}
