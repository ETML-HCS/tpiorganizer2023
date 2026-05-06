const express = require('express')

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

const router = express.Router()
const TpiRooms = createCustomTpiRoomModel('tpiRooms')

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
  requireNonEmptyBody('Données de défense requises.'),
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
