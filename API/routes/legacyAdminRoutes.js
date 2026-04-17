const express = require('express')

const Person = require('../models/personModel')
const TpiModelsYear = require('../models/tpiModels')
const {
  createTpiRoomModel,
  createCustomTpiRoomModel
} = require('../models/tpiRoomsModels')
const { requireAppAuth } = require('../middleware/appAuth')
const {
  requireNonEmptyBody,
  requireObjectIdParam,
  requireStringBodyFields,
  requireYearParam
} = require('../middleware/requestValidation')
const { deleteTpiCatalogByYear } = require('../services/tpiCatalogService')
const {
  normalizeText
} = require('../services/personIdentityService')
const { resolveUniquePersonForRole } = require('../services/personRegistryService')
const { linkLegacyTpiStakeholders, validateLegacyTpiStakeholders } = require('../services/tpiStakeholderService')

const router = express.Router()
const TpiRooms = createCustomTpiRoomModel('tpiRooms')

function normalizeCandidateQuery(value = '') {
  return normalizeText(value).toLowerCase()
}

async function linkTpiParticipantsFromPeopleRegistry(payload, options = {}) {
  const people = await Person.find({ isActive: true })
    .select('firstName lastName email roles candidateYears')
    .lean()
  return linkLegacyTpiStakeholders(payload, people, options).tpi
}

router.post(
  '/save-tpi-rooms/:year',
  requireAppAuth,
  requireYearParam('year'),
  requireNonEmptyBody('Données de salle requises.'),
  requireStringBodyFields(['idRoom'], 'idRoom requis.'),
  async (req, res) => {
  const year = req.params.year
  const roomData = req.body

  try {
    const TpiModel = createTpiRoomModel(year)
    const existingRoom = await TpiModel.findOne({ idRoom: roomData.idRoom })

    if (existingRoom) {
      await TpiModel.updateOne({ idRoom: roomData.idRoom }, roomData)
      return res.json(roomData)
    }

    const newTpiRoom = new TpiModel({ ...roomData, year })
    await newTpiRoom.save()
    return res.json(newTpiRoom)
  } catch (error) {
    console.error(`Erreur lors de la gestion de la salle TPI pour l'année ${year}:`, error)
    return res.status(500).json({
      error: `Erreur lors de la gestion de la salle TPI pour l'année ${year}`
    })
  }
})

router.post(
  '/save-tpi/:year',
  requireAppAuth,
  requireYearParam('year'),
  requireNonEmptyBody('Données TPI requises.'),
  requireStringBodyFields(['refTpi'], 'refTpi requis.'),
  async (req, res) => {
  try {
    const updateData = await linkTpiParticipantsFromPeopleRegistry(req.body, {
      year: req.params.year
    })
    const validationMode = req.body?.validationMode === 'import' ? 'import' : 'manual'

    if (validationMode === 'manual') {
      const people = await Person.find({ isActive: true })
        .select('firstName lastName email roles candidateYears')
        .lean()
      const validation = validateLegacyTpiStakeholders(updateData, {
        people,
        year: req.params.year,
        requireResolved: true
      })

      if (!validation.isValidated) {
        return res.status(400).json({
          error: 'Les parties prenantes doivent être validées dans le référentiel avant la création manuelle du TPI.',
          details: {
            missingRoles: validation.missingRoles,
            unresolvedRoles: validation.unresolvedRoles
          }
        })
      }
    }

    const savedModel = await TpiModelsYear(req.params.year).findOneAndUpdate(
      { refTpi: updateData.refTpi },
      updateData,
      { upsert: true, new: true }
    )

    return res.json(savedModel)
  } catch (error) {
    console.error('Error saving TPI model:', error)
    return res.status(500).json({ error: 'Error saving TPI model' })
  }
})

router.get('/check-room-existence/:idRoom', async (req, res) => {
  if (!req.params.idRoom) {
    return res.status(400).json({ message: 'Room ID is required.' })
  }

  try {
    const room = await TpiRooms.findOne({ idRoom: req.params.idRoom }).exec()

    if (!room) {
      return res.status(404).json({ exists: false })
    }

    return res.json({ exists: true, idRoom: room.idRoom, _id: room._id })
  } catch (error) {
    console.error(`Error checking room existence: ${error.message}`)
    return res.status(500).json({ message: error.message })
  }
})

router.get('/get-tpi', requireAppAuth, async (req, res) => {
  try {
    const year = req.query.year
    const yearNumber = Number.parseInt(year, 10)

    if (!year || !Number.isInteger(yearNumber)) {
      return res.status(400).json({ error: 'Année manquante.' })
    }

    const models = await TpiModelsYear(yearNumber).find()
    return res.json(models)
  } catch (error) {
    console.error('Error retrieving TPI models:', error)
    return res.status(500).json({ error: 'Error retrieving TPI models' })
  }
})

router.get('/tpi/:year/byCandidate/:candidateName', requireAppAuth, requireYearParam('year'), async (req, res) => {
  try {
    const year = req.validatedParams.year
    const candidateName = typeof req.params.candidateName === 'string'
      ? req.params.candidateName.trim()
      : ''

    if (!candidateName) {
      return res.status(400).json({ error: 'Nom du candidat requis.' })
    }

    const [models, people] = await Promise.all([
      TpiModelsYear(year).find().lean(),
      Person.find({ isActive: true })
        .select('firstName lastName email roles')
        .lean()
    ])

    const normalizedQuery = normalizeCandidateQuery(candidateName)
    const resolvedPerson = resolveUniquePersonForRole(candidateName, people, 'candidat', {
      year
    }).person
    const resolvedPersonId = resolvedPerson?._id ? String(resolvedPerson._id) : null

    const matches = models
      .filter((tpi) => {
        const storedCandidate = normalizeCandidateQuery(tpi?.candidat || '')
        const storedCandidatePersonId = tpi?.candidatPersonId ? String(tpi.candidatPersonId) : null

        return Boolean(
          (resolvedPersonId && storedCandidatePersonId === resolvedPersonId) ||
          (normalizedQuery && storedCandidate.includes(normalizedQuery))
        )
      })
      .sort((left, right) => String(left.refTpi || '').localeCompare(String(right.refTpi || ''), 'fr', {
        numeric: true,
        sensitivity: 'base'
      }))

    if (matches.length === 0) {
      return res.status(404).json({ error: 'Aucun TPI trouvé pour ce candidat.' })
    }

    return res.json(matches)
  } catch (error) {
    console.error('Error retrieving TPI models by candidate:', error)
    return res.status(500).json({ error: 'Error retrieving TPI models by candidate' })
  }
})

router.post(
  '/delete-tpi-year/:year',
  requireAppAuth,
  requireYearParam('year'),
  requireNonEmptyBody('Confirmation requise.'),
  async (req, res) => {
    const year = req.validatedParams.year

    if (req.body?.confirm !== true) {
      return res.status(400).json({ error: 'Confirmation requise.' })
    }

    try {
      const result = await deleteTpiCatalogByYear(year)

      return res.json({
        message: `Les TPI de l'année ${year} ont été supprimés.`,
        year: result.year,
        deletedCount: result.deletedCount
      })
    } catch (error) {
      console.error(`Erreur lors de la suppression des TPI de l'année ${year}:`, error)
      return res.status(500).json({ error: 'Erreur lors de la suppression des TPI.' })
    }
  }
)

router.put(
  '/update-tpi/:year/:id',
  requireAppAuth,
  requireYearParam('year'),
  requireObjectIdParam('id', 'Identifiant TPI'),
  requireNonEmptyBody('Données de mise à jour requises.'),
  async (req, res) => {
  const { id, year } = req.params
  const updateData = await linkTpiParticipantsFromPeopleRegistry(req.body, { year })

  if (!id || !year || !updateData || Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'Données invalides fournies.' })
  }

  try {
    const existingTpi = await TpiModelsYear(year).findById(id)

    if (!existingTpi) {
      return res.status(404).json({ error: 'TPI introuvable.' })
    }

    const updatedTpi = await TpiModelsYear(year).findByIdAndUpdate(id, updateData, {
      new: true
    })

    return res.json(updatedTpi)
  } catch (error) {
    console.error('Erreur lors de la mise à jour du TPI :', error)
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du TPI.' })
  }
})

router.post(
  '/create-tpi-collection/:year',
  requireAppAuth,
  requireYearParam('year'),
  requireNonEmptyBody('Données TPI requises.'),
  async (req, res) => {
  try {
    const collectionName = `tpiSoutenance_${req.params.year}`
    const TpiModel = createCustomTpiRoomModel(collectionName)
    const newTpiRoom = new TpiModel(req.body)

    await newTpiRoom.save()

    return res.status(200).json({
      message: `TPI collection for the year ${req.params.year} created successfully.`
    })
  } catch (error) {
    console.error(`Error creating TPI collection for the year ${req.params.year}: ${error}`)
    return res.status(500).json({ error: error.message })
  }
})

router.get('/get-tpi-rooms', requireAppAuth, async (req, res) => {
  try {
    const rooms = await TpiRooms.find()
    return res.json(rooms)
  } catch (error) {
    console.error('Error retrieving TPI rooms:', error)
    return res.status(500).json({ error: 'Error retrieving TPI rooms' })
  }
})

router.get('/get-tpi-room/:id', requireAppAuth, async (req, res) => {
  try {
    const room = await TpiRooms.findById(req.params.id)
    return res.json(room)
  } catch (error) {
    console.error('Error retrieving TPI room:', error)
    return res.status(500).json({ error: 'Error retrieving TPI room' })
  }
})

router.put(
  '/update-tpi-room/:id',
  requireAppAuth,
  requireObjectIdParam('id', 'Identifiant de salle'),
  requireNonEmptyBody('Données de mise à jour requises.'),
  async (req, res) => {
  try {
    const existingRoom = await TpiRooms.findById(req.params.id)

    if (!existingRoom) {
      return res.status(404).json({ error: 'TPI room not found' })
    }

    const updatedRoom = await TpiRooms.findByIdAndUpdate(req.params.id, req.body, {
      new: true
    })

    return res.json(updatedRoom)
  } catch (error) {
    console.error('Error updating TPI room:', error)
    return res.status(500).json({ error: 'Error updating TPI room' })
  }
})

router.delete(
  '/delete-tpi-room/:id',
  requireAppAuth,
  requireObjectIdParam('id', 'Identifiant de salle'),
  async (req, res) => {
  try {
    await TpiRooms.findByIdAndDelete(req.params.id)
    return res.json({ message: 'TPI room deleted successfully.' })
  } catch (error) {
    console.error('Error deleting TPI room:', error)
    return res.status(500).json({ error: 'Error deleting TPI room' })
  }
})

router.post(
  '/overwrite-tpi-rooms/:year',
  requireAppAuth,
  requireYearParam('year'),
  requireNonEmptyBody('Données de soutenance requises.'),
  async (req, res) => {
  const year = req.params.year
  const collectionNameSoutenance = `tpiSoutenance_${year}`
  const collectionNameRooms = `tpiRooms_${year}`

  try {
    const TpiRoomModelSoutenance = createCustomTpiRoomModel(collectionNameSoutenance)
    const TpiRoomModelRooms = createCustomTpiRoomModel(collectionNameRooms)
    const soutenanceData = await TpiRoomModelSoutenance.find()

    await TpiRoomModelRooms.deleteMany({})
    await TpiRoomModelRooms.insertMany(soutenanceData)

    return res.status(200).json({
      message: `Data from collection ${collectionNameSoutenance} has been overwritten into collection ${collectionNameRooms}`
    })
  } catch (error) {
    console.error('Error overwriting data:', error)
    return res.status(500).json({ error: 'Error overwriting data' })
  }
})

module.exports = router
