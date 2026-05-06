const express = require('express')

const accessLinkTokenService = require('../modules/accessLinks/tokenService')
const { ACCESS_LINK_SOURCES } = require('../modules/accessLinks/constants')
const legacyMagicLinkService = require('../services/magicLinkService')
const staticVotePublicationService = require('../services/staticVotePublicationService')

const router = express.Router()

function getRequestBaseUrl(req) {
  const origin = typeof req.get === 'function' ? req.get('origin') : ''
  const fallback = `${req.protocol}://${req.get('host')}`
  const value = typeof origin === 'string' && origin.trim()
    ? origin.trim()
    : fallback

  return value.replace(/\/+$/, '')
}

async function findLinkedVoteAccess(link, person, req) {
  if (link?.type !== 'soutenance' || !person?._id) {
    return null
  }

  const commonQuery = {
    year: link.year,
    type: 'vote',
    person,
    scope: {
      year: link.year,
      kind: 'stakeholder_votes'
    }
  }
  const requestBaseUrl = getRequestBaseUrl(req)
  const staticVoteBaseUrl = await staticVotePublicationService
    .getPublicUrl(link.year)
    .catch(() => '')

  let linkedVote = staticVoteBaseUrl
    ? await accessLinkTokenService.findReusableMagicLink({
      ...commonQuery,
      sources: [ACCESS_LINK_SOURCES.ADMIN_STATIC_VOTE],
      baseUrl: staticVoteBaseUrl
    })
    : null

  if (!linkedVote?.url) {
    linkedVote = await accessLinkTokenService.findReusableMagicLink({
      ...commonQuery,
      sources: [ACCESS_LINK_SOURCES.ADMIN_APP],
      baseUrl: requestBaseUrl
    })
  }

  if (!linkedVote?.url) {
    return null
  }

  return {
    url: linkedVote.url,
    expiresAt: linkedVote.expiresAt || null,
    maxUses: linkedVote.maxUses,
    usageCount: linkedVote.usageCount,
    availabilityStatus: linkedVote.availabilityStatus || 'available'
  }
}

router.get('/resolve', async (req, res) => {
  const token = typeof req.query.token === 'string'
    ? req.query.token.trim()
    : typeof req.query.ml === 'string'
      ? req.query.ml.trim()
      : ''

  if (!accessLinkTokenService.isTokenLooksValid(token)) {
    return res.status(400).json({ error: 'Token invalide.' })
  }

  try {
    const resolved = await accessLinkTokenService.resolveMagicLink(token, {
      request: req
    })
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

    const linkedVoteAccess = await findLinkedVoteAccess(link, person, req)
    const viewerRoles = Array.isArray(person?.roles)
      ? person.roles.map((role) => String(role || '').trim()).filter(Boolean)
      : []

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
        email: link.recipientEmail || null,
        roles: viewerRoles,
        isAdmin: viewerRoles.includes('admin'),
        voteAccessUrl: linkedVoteAccess?.url || null,
        voteAccessExpiresAt: linkedVoteAccess?.expiresAt || null
      },
      linkedVoteAccess
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
