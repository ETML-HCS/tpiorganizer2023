const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const getEnvOrThrow = key => {
  const value = process.env[key]

  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${key}`)
  }

  return value
}

const isProduction = () => process.env.NODE_ENV === 'production'

const isDevAuthBypassEnabled = () =>
  !isProduction() &&
  process.env.SKIP_APP_AUTH === 'true' &&
  process.env.REACT_APP_DEBUG === 'true'

const assertProductionAuthSafety = () => {
  if (!isProduction()) {
    return
  }

  const issues = []

  if (process.env.SKIP_APP_AUTH === 'true') {
    issues.push('SKIP_APP_AUTH doit rester false ou absent en production')
  }

  if (process.env.REACT_APP_DEBUG === 'true') {
    issues.push('REACT_APP_DEBUG doit rester false en production')
  }

  if (process.env.AUTH_USER_PLAIN || process.env.AUTH_PASS_PLAIN) {
    issues.push('AUTH_USER_PLAIN/AUTH_PASS_PLAIN ne doivent pas être utilisées en production')
  }

  if (issues.length > 0) {
    throw new Error(`Configuration d'authentification de production invalide: ${issues.join(' ; ')}`)
  }
}

const getAuthConfig = () => {
  const plainUsername = process.env.AUTH_USER_PLAIN
  const plainPassword = process.env.AUTH_PASS_PLAIN

  if (isProduction() && (plainUsername || plainPassword)) {
    throw new Error(
      'AUTH_USER_PLAIN/AUTH_PASS_PLAIN sont réservées au développement et ne doivent pas être utilisées en production'
    )
  }

  if (plainUsername || plainPassword) {
    if (!plainUsername || !plainPassword) {
      throw new Error(
        'Variables d\'environnement incomplètes : AUTH_USER_PLAIN et AUTH_PASS_PLAIN sont requises ensemble'
      )
    }

    return {
      source: 'plain',
      hashedUsername: bcrypt.hashSync(plainUsername, 10),
      hashedPassword: bcrypt.hashSync(plainPassword, 10)
    }
  }

  return {
    source: 'hash',
    hashedUsername: getEnvOrThrow('AUTH_USER_HASH'),
    hashedPassword: getEnvOrThrow('AUTH_PASS_HASH')
  }
}

const getSessionSecret = () => process.env.AUTH_SESSION_SECRET || process.env.JWT_SECRET

const createAppSessionToken = username => {
  const secret = getSessionSecret()

  if (!secret) {
    throw new Error('Variable d\'environnement manquante : AUTH_SESSION_SECRET ou JWT_SECRET')
  }

  return jwt.sign(
    {
      sub: username,
      roles: ['admin']
    },
    secret,
    { expiresIn: '8h' }
  )
}

const verifyAppSessionToken = token => {
  const secret = getSessionSecret()

  if (!secret) {
    throw new Error('Variable d\'environnement manquante : AUTH_SESSION_SECRET ou JWT_SECRET')
  }

  return jwt.verify(token, secret)
}

const requireAppAuth = (req, res, next) => {
  if (isDevAuthBypassEnabled()) {
    return next()
  }

  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentification requise' })
  }

  try {
    const token = authHeader.substring(7)
    req.user = verifyAppSessionToken(token)
    return next()
  } catch (error) {
    return res.status(401).json({ message: 'Session invalide ou expirée' })
  }
}

const authenticateAdmin = async (username, password) => {
  if (isDevAuthBypassEnabled()) {
    return {
      success: true,
      message: 'Authentification locale de développement',
      token: createAppSessionToken(username || 'admin')
    }
  }

  const authConfig = getAuthConfig()
  const isPasswordCorrect = await bcrypt.compare(password, authConfig.hashedPassword)
  const isUsernameConfirmed = await bcrypt.compare(username, authConfig.hashedUsername)

  if (!isUsernameConfirmed || !isPasswordCorrect) {
    return null
  }

  return {
    success: true,
    message: 'Authentification réussie',
    token: createAppSessionToken(username)
  }
}

module.exports = {
  assertProductionAuthSafety,
  authenticateAdmin,
  createAppSessionToken,
  getEnvOrThrow,
  getAuthConfig,
  isDevAuthBypassEnabled,
  isProduction,
  requireAppAuth,
  verifyAppSessionToken
}
