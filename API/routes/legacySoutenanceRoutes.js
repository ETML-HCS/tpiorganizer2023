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
const magicLinkV2Service = require('../services/magicLinkV2Service')

const router = express.Router()

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

async function resolveLegacyViewer(token) {
  if (!token) {
    return null
  }

  return await TpiExperts.findOne({ token }).select('name role').lean()
}

async function resolveSoutenanceViewer(magicLinkToken, year) {
  if (!magicLinkToken) {
    return null
  }

  const resolved = await magicLinkV2Service.resolveMagicLink(magicLinkToken)

  if (resolved?.link?.type !== 'soutenance') {
    const error = new Error('Ce lien n est pas un lien de soutenance.')
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
    publicationVersion: resolved.link.scope?.publicationVersion || null
  }
}

router.get('/soutenances/:year', requireYearParam('year'), async (req, res) => {
  try {
    const adminSession = tryResolveAdminSession(req)
    const magicLinkToken = typeof req.query.ml === 'string' ? req.query.ml.trim() : ''
    const legacyToken = typeof req.query.token === 'string' ? req.query.token.trim() : ''

    let accessOptions = {}

    if (adminSession) {
      accessOptions = {}
    } else if (magicLinkToken) {
      accessOptions = await resolveSoutenanceViewer(magicLinkToken, req.params.year)
    } else if (legacyToken) {
      const legacyViewer = await resolveLegacyViewer(legacyToken)
      if (!legacyViewer) {
        return res.status(401).json({ error: 'Token legacy invalide.' })
      }

      accessOptions = {
        viewerName: legacyViewer.name
      }
    } else {
      return res.status(401).json({
        error: 'Authentification ou lien de soutenance requis.'
      })
    }

    const rooms = await listPublishedSoutenances(req.params.year, accessOptions)

    return res.json(rooms)
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message })
    }

    console.error(`Error fetching soutenances for year ${req.params.year}:`, error)
    return res.status(500).json({
      error: `Internal server error for the year ${req.params.year}`
    })
  }
})

router.post(
  '/soutenances/:year/publish-room',
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
    console.error(`Error publishing soutenance room for year ${req.params.year}:`, error)
    return res.status(500).json({
      error: `Erreur lors de la publication de la salle de soutenance pour l'année ${req.params.year}`
    })
  }
})

router.post(
  '/soutenances/:year/publish-from-planning',
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
        ? `${publishedRooms.length} salles publiées depuis le planning confirmé`
        : 'Aucune soutenance confirmée à publier'
    })
  } catch (error) {
    console.error(`Error publishing confirmed planning for year ${req.params.year}:`, error)
    return res.status(500).json({
      error: `Erreur lors de la publication depuis le planning pour l'année ${req.params.year}`
    })
  }
})

router.put(
  '/soutenances/:year/rooms/:roomId/tpis/:tpiDataId/offres/:expertOrBoss',
  requireYearParam('year'),
  async (req, res) => {
  try {
    const { year, roomId, tpiDataId, expertOrBoss } = req.params
    const adminSession = tryResolveAdminSession(req)
    const legacyToken = typeof req.query.token === 'string' ? req.query.token.trim() : ''
    const magicLinkToken = typeof req.query.ml === 'string' ? req.query.ml.trim() : ''

    if (!isValidRole(expertOrBoss)) {
      return res.status(400).json({ error: 'Rôle invalide.' })
    }

    if (magicLinkToken) {
      return res.status(403).json({
        error: 'Lien soutenance en lecture seule.'
      })
    }

    let legacyViewer = null
    if (!adminSession) {
      legacyViewer = await resolveLegacyViewer(legacyToken)
      if (!legacyViewer) {
        return res.status(401).json({
          error: 'Authentification requise pour modifier une soutenance.'
        })
      }
    }

    if (legacyViewer) {
      const DataRooms = getSoutenanceModel(year)
      const room = await DataRooms.findById(roomId)

      if (!room) {
        return res.status(404).json({ error: 'Salle de soutenance introuvable.' })
      }

      const tpiData = room.tpiDatas.id(tpiDataId)

      if (!tpiData) {
        return res.status(404).json({ error: 'Salle de soutenance introuvable.' })
      }

      if (tpiData[expertOrBoss]?.name !== legacyViewer.name) {
        return res.status(403).json({
          error: 'Non autorisé à modifier cette soutenance.'
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
      return res.status(404).json({ error: 'Salle de soutenance introuvable.' })
    }

    return res.status(200).json({
      message: 'Données de soutenance mises à jour avec succès',
      tpiData
    })
  } catch (error) {
    console.error('Erreur lors de la mise à jour des offres de soutenance :', error)
    return res.status(500).json({
      error: 'Erreur lors de la mise à jour des données de soutenance'
    })
  }
})

module.exports = router
