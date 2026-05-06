const express = require('express')

const TpiExperts = require('../models/tpiExpertsModel')
const { requireAppAuth, verifyAppSessionToken } = require('../middleware/appAuth')
const { requireYearParam } = require('../middleware/requestValidation')
const {
  getSoutenanceModel,
  listPublishedSoutenances,
  publishSoutenanceRoom,
  publishConfirmedPlanningSoutenances,
  updatePublishedSoutenanceOffers
} = require('../services/publishedSoutenanceService')
const accessLinkTokenService = require('../modules/accessLinks/tokenService')

const router = express.Router()
const DEFENSE_API_PREFIXES = ['/defenses', '/soutenances']
const DEFENSE_ACCESS_REQUIRED_ERROR = 'Code ou lien magique requis pour afficher les defenses.'

function buildDefenseApiRoutes(suffix) {
  return DEFENSE_API_PREFIXES.map(prefix => `${prefix}${suffix}`)
}

function buildPublishFromPlanificationRoutes() {
  return [
    ...buildDefenseApiRoutes('/:year/publish-from-planification'),
    ...buildDefenseApiRoutes('/:year/publish-from-planning')
  ]
}

function isValidRole(role) {
  return ['expert1', 'expert2', 'boss'].includes(role)
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  return authHeader.substring(7)
}

function getQueryToken(req, keys) {
  for (const key of keys) {
    const value = req.query[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function tryResolveAdminSession(req) {
  const token = getBearerToken(req)

  if (!token) {
    return null
  }

  try {
    const session = verifyAppSessionToken(token)
    if (Array.isArray(session?.roles) && session.roles.includes('admin')) {
      return session
    }
  } catch (error) {
    return null
  }

  return null
}

function shouldUseAdminGeneralView(req) {
  const view = typeof req.query.view === 'string'
    ? req.query.view.trim().toLowerCase()
    : ''
  const adminView = typeof req.query.adminView === 'string'
    ? req.query.adminView.trim().toLowerCase()
    : typeof req.query.admin === 'string'
      ? req.query.admin.trim().toLowerCase()
      : ''

  return view === 'admin' || view === 'general' || adminView === '1' || adminView === 'true'
}

async function resolveLegacyViewer(token) {
  if (!token) {
    return null
  }

  return await TpiExperts.findOne({ token }).select('name role').lean()
}

async function resolveSoutenanceViewer(magicLinkToken, year, req = null) {
  if (!magicLinkToken) {
    return null
  }

  const resolved = await accessLinkTokenService.resolveMagicLink(magicLinkToken, {
    request: req
  })

  if (resolved?.link?.type !== 'soutenance') {
    const error = new Error('Ce lien n est pas un lien de défense.')
    error.statusCode = 403
    throw error
  }

  if (Number(resolved.link.year) !== Number(year)) {
    const error = new Error(`Ce lien cible l annee ${resolved.link.year} et non ${year}.`)
    error.statusCode = 403
    throw error
  }

  return {
    viewerPersonId: resolved.link.personId ? String(resolved.link.personId) : null,
    viewerName: resolved.link.personName || null,
    viewerRole: resolved.link.scope?.viewerRole || resolved.link.scope?.role || null,
    publicationVersion: resolved.link.scope?.publicationVersion || null,
    isAdmin: Array.isArray(resolved.person?.roles) && resolved.person.roles.includes('admin')
  }
}

router.get(buildDefenseApiRoutes('/:year'), requireYearParam('year'), async (req, res) => {
  try {
    const adminSession = tryResolveAdminSession(req)
    const magicLinkToken = getQueryToken(req, ['ml'])
    const legacyToken = getQueryToken(req, ['token', 'code'])

    let accessOptions = {}

    if (magicLinkToken) {
      accessOptions = await resolveSoutenanceViewer(magicLinkToken, req.params.year, req)
      if (accessOptions.isAdmin === true && shouldUseAdminGeneralView(req)) {
        accessOptions = {
          version: accessOptions.publicationVersion || null
        }
      } else if (accessOptions.publicationVersion) {
        accessOptions.version = accessOptions.publicationVersion
      }
    } else if (adminSession) {
      accessOptions = {}
    } else if (legacyToken) {
      const legacyViewer = await resolveLegacyViewer(legacyToken)
      if (!legacyViewer) {
        return res.status(401).json({ error: 'Token legacy invalide.' })
      }

      accessOptions = {
        viewerName: legacyViewer.name
      }
    } else {
      return res.status(401).json({ error: DEFENSE_ACCESS_REQUIRED_ERROR })
    }

    const rooms = await listPublishedSoutenances(req.params.year, accessOptions)

    return res.json(rooms)
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message })
    }

    console.error(`Error fetching défenses for year ${req.params.year}:`, error)
    return res.status(500).json({
      error: `Internal server error for the year ${req.params.year}`
    })
  }
})

router.post(
  buildDefenseApiRoutes('/:year/publish-room'),
  requireAppAuth,
  requireYearParam('year'),
  async (req, res) => {
  try {
    const roomData = req.body

    if (!roomData?.idRoom) {
      return res.status(400).json({ error: 'idRoom requis pour publier une salle.' })
    }

    const savedRoom = await publishSoutenanceRoom(req.params.year, roomData)

    return res.status(200).json(savedRoom)
  } catch (error) {
    console.error(`Error publishing défense room for year ${req.params.year}:`, error)
    return res.status(500).json({
      error: `Erreur lors de la publication de la salle de défense pour l'année ${req.params.year}`
    })
  }
})

router.post(
  buildPublishFromPlanificationRoutes(),
  requireAppAuth,
  requireYearParam('year'),
  async (req, res) => {
  try {
    const publishedResult = await publishConfirmedPlanningSoutenances(req.params.year, req.user)
    const publishedRooms = Array.isArray(publishedResult?.rooms) ? publishedResult.rooms : []

    return res.status(200).json({
      success: true,
      count: publishedRooms.length,
      rooms: publishedRooms,
      publicationVersion: publishedResult?.publicationVersion || null,
      message: publishedRooms.length > 0
        ? `${publishedRooms.length} salles publiées depuis la planification confirmée`
        : 'Aucune défense confirmée à publier'
    })
  } catch (error) {
    console.error(`Error publishing confirmed schedule for year ${req.params.year}:`, error)
    return res.status(500).json({
      error: `Erreur lors de la publication depuis la planification pour l'année ${req.params.year}`
    })
  }
})

router.put(
  buildDefenseApiRoutes('/:year/rooms/:roomId/tpis/:tpiDataId/offres/:expertOrBoss'),
  requireYearParam('year'),
  async (req, res) => {
  try {
    const { year, roomId, tpiDataId, expertOrBoss } = req.params
    const adminSession = tryResolveAdminSession(req)
    const legacyToken = getQueryToken(req, ['token', 'code'])
    const magicLinkToken = getQueryToken(req, ['ml'])

    if (!isValidRole(expertOrBoss)) {
      return res.status(400).json({ error: 'Rôle invalide.' })
    }

    if (magicLinkToken) {
      return res.status(403).json({
        error: 'Lien défense en lecture seule.'
      })
    }

    let legacyViewer = null
    if (!adminSession) {
      legacyViewer = await resolveLegacyViewer(legacyToken)
      if (!legacyViewer) {
        return res.status(401).json({
          error: 'Authentification requise pour modifier une défense.'
        })
      }
    }

    if (legacyViewer) {
      const DataRooms = getSoutenanceModel(year)
      const room = await DataRooms.findById(roomId)

      if (!room) {
        return res.status(404).json({ error: 'Salle de défense introuvable.' })
      }

      const tpiData = room.tpiDatas.id(tpiDataId)

      if (!tpiData) {
        return res.status(404).json({ error: 'Salle de défense introuvable.' })
      }

      if (tpiData[expertOrBoss]?.name !== legacyViewer.name) {
        return res.status(403).json({
          error: 'Non autorisé à modifier cette défense.'
        })
      }
    }

    const tpiData = await updatePublishedSoutenanceOffers(
      year,
      roomId,
      tpiDataId,
      expertOrBoss,
      req.body.offres || req.body
    )

    if (!tpiData) {
      return res.status(404).json({ error: 'Salle de défense introuvable.' })
    }

    return res.status(200).json({
      message: 'Données de défense mises à jour avec succès',
      tpiData
    })
  } catch (error) {
    console.error('Erreur lors de la mise à jour des offres de défense :', error)
    return res.status(500).json({
      error: 'Erreur lors de la mise à jour des données de défense'
    })
  }
})

module.exports = router
