const express = require('express')

const magicLinkV2Service = require('../services/magicLinkV2Service')
const legacyMagicLinkService = require('../services/magicLinkService')

const router = express.Router()

router.get('/resolve', async (req, res) => {
  const token = typeof req.query.token === 'string'
    ? req.query.token.trim()
    : typeof req.query.ml === 'string'
      ? req.query.ml.trim()
      : ''

  if (!magicLinkV2Service.isTokenLooksValid(token)) {
    return res.status(400).json({ error: 'Token invalide.' })
  }

  try {
    const resolved = await magicLinkV2Service.resolveMagicLink(token)
    const { link, person } = resolved

    let sessionToken = null
    if (link.type === 'vote') {
      if (!person) {
        return res.status(404).json({ error: 'Utilisateur de vote introuvable.' })
      }

      sessionToken = legacyMagicLinkService.generateSessionToken({
        _id: person._id,
        email: person.email,
        roles: person.roles
      }, {
        authContext: {
          type: 'vote_magic_link',
          year: link.year,
          personId: link.personId ? String(link.personId) : null,
          role: link.role || null,
          scope: link.scope || {}
        }
      })
    }

    return res.status(200).json({
      success: true,
      type: link.type,
      year: link.year,
      redirectPath: link.redirectPath,
      role: link.role || null,
      scope: link.scope || {},
      expiresAt: link.expiresAt,
      sessionToken,
      viewer: {
        personId: link.personId ? String(link.personId) : null,
        name: link.personName || null,
        email: link.recipientEmail || null
      }
    })
  } catch (error) {
    const statusCode = error.statusCode || 500

    if (statusCode >= 500) {
      console.error('Erreur resolution magic link:', error)
    }

    return res.status(statusCode).json({
      error: error.message || 'Erreur lors de la resolution du magic link.'
    })
  }
})

module.exports = router
