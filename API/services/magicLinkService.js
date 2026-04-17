/**
 * Service de gestion des Magic Links
 * Permet aux experts de se connecter sans mot de passe via un lien unique
 */

const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const Person = require('../models/personModel')
const { verifyAppSessionToken } = require('../middleware/appAuth')

// Durée de validité du magic link (24 heures par défaut)
const MAGIC_LINK_EXPIRY_HOURS = 24

/**
 * Génère un magic link pour une personne
 * @param {String} email - Email de la personne
 * @returns {Object} Token et URL du magic link
 */
async function generateMagicLink(email, baseUrl) {
  const person = await Person.findOne({ email: email.toLowerCase() })
  
  if (!person) {
    throw new Error('Aucun compte trouvé avec cet email')
  }
  
  // Générer un token sécurisé
  const token = crypto.randomBytes(32).toString('hex')
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
  
  // Définir l'expiration
  const expires = new Date(Date.now() + MAGIC_LINK_EXPIRY_HOURS * 60 * 60 * 1000)
  
  // Sauvegarder le token hashé
  person.magicLinkToken = hashedToken
  person.magicLinkExpires = expires
  await person.save()
  
  // Construire l'URL (on envoie le token non hashé)
  const magicLinkUrl = `${baseUrl}/auth/verify?token=${token}&email=${encodeURIComponent(email)}`
  
  return {
    token,
    url: magicLinkUrl,
    expiresAt: expires,
    personId: person._id,
    personName: person.fullName
  }
}

/**
 * Vérifie un magic link et connecte l'utilisateur
 * @param {String} token - Token reçu
 * @param {String} email - Email de la personne
 * @returns {Object} Personne authentifiée
 */
async function verifyMagicLink(token, email) {
  // Hasher le token reçu pour comparaison
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
  
  const person = await Person.findOne({
    email: email.toLowerCase(),
    magicLinkToken: hashedToken,
    magicLinkExpires: { $gt: new Date() }
  })
  
  if (!person) {
    throw new Error('Lien invalide ou expiré')
  }
  
  // Invalider le token après utilisation
  person.magicLinkToken = undefined
  person.magicLinkExpires = undefined
  person.lastLogin = new Date()
  await person.save()
  
  return {
    success: true,
    person: {
      id: person._id,
      email: person.email,
      firstName: person.firstName,
      lastName: person.lastName,
      roles: person.roles
    }
  }
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error('Variable d\'environnement manquante : JWT_SECRET')
  }

  return secret
}

function generateSessionToken(person, extraClaims = {}) {
  const payload = {
    id: person._id || person.id,
    email: person.email,
    roles: person.roles,
    ...extraClaims
  }
  
  const expiresIn = '24h'
  
  return jwt.sign(payload, getJwtSecret(), { expiresIn })
}

/**
 * Vérifie un JWT de session
 */
function verifySessionToken(token) {
  try {
    return jwt.verify(token, getJwtSecret())
  } catch (error) {
    throw new Error('Session invalide ou expirée')
  }
}

function normalizeAuthenticatedUser(decoded, source) {
  const normalizedRoles = Array.isArray(decoded?.roles) ? decoded.roles : []

  return {
    ...decoded,
    id: decoded?.id ? String(decoded.id) : decoded?.sub ? String(decoded.sub) : null,
    email: typeof decoded?.email === 'string' ? decoded.email : null,
    roles: normalizedRoles,
    authSource: source
  }
}

function verifyAnySessionToken(token) {
  try {
    const decoded = verifySessionToken(token)

    if (decoded?.sub && !decoded?.id && !decoded?.authContext) {
      return normalizeAuthenticatedUser(decoded, 'app')
    }

    return normalizeAuthenticatedUser(decoded, 'planning')
  } catch (planningError) {
    try {
      const decoded = verifyAppSessionToken(token)
      return normalizeAuthenticatedUser(decoded, 'app')
    } catch (appError) {
      throw planningError
    }
  }
}

/**
 * Middleware d'authentification pour les routes protégées
 */
function authMiddleware(req, res, next) {
  if (process.env.SKIP_PLANNING_AUTH === 'true') {
    return next()
  }
  
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non authentifié' })
  }
  
  const token = authHeader.substring(7)
  
  try {
    req.user = verifyAnySessionToken(token)
    next()
  } catch (error) {
    return res.status(401).json({ error: error.message })
  }
}

/**
 * Middleware pour vérifier un rôle spécifique
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' })
    }
    
    const hasRole = roles.some(role => req.user.roles.includes(role))
    
    if (!hasRole) {
      return res.status(403).json({ error: 'Accès non autorisé' })
    }
    
    next()
  }
}

module.exports = {
  generateMagicLink,
  verifyMagicLink,
  generateSessionToken,
  verifySessionToken,
  authMiddleware,
  requireRole,
  MAGIC_LINK_EXPIRY_HOURS
}
