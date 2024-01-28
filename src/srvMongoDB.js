const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

const db = require('./config/dbConfig')
const mongoose = require('mongoose')

const nodemailer = require('nodemailer')

const PropositionSchema = require('./models/propositionModel')
const TpiModels = require('./models/tpiModels')
const User = require('./models/userModels')
const {
  createTpiRoomModel,
  createCustomTpiRoomModel,
  tpiRoomSchema
} = require('./models/tpiRoomsModels')

const TpiExperts = require('./models/tpiExpertsModel')

const app = express()
const port = 5000

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send('App is Working')
})

// Configurer Nodemailer avec vos paramètres d'envoi d'email

app.post('/api/send-email', async (req, res) => {
  const { email, url } = req.body
  // Logique pour envoyer l'email avec Nodemailer
  // ...
})

/**
 * Recherche un responsable par son nom dans la base de données.
 *
 * @param {String} bossName - Le nom du responsable à rechercher.
 * @returns {Promise} - Une promesse qui se résout avec le document trouvé ou null si aucun n'a été trouvé.
 */
function findResponsableByName (bossName) {
  return tpiExperts.findOne({ boss: bossName }).exec()
}

// ... (la fonction findResponsableByName définie précédemment)

// Route GET pour chercher un responsable par son nom
app.get('/makeToken/:bossName', (req, res) => {
  const bossName = req.params.bossName

  findResponsableByName(bossName)
    .then(responsable => {
      if (responsable) {
        res.json(responsable)
      } else {
        res.status(404).send('Responsable non trouvé')
      }
    })
    .catch(error => {
      res.status(500).send('Erreur du serveur')
      console.error(error)
    })
})

app.get('/api/experts/emails', async (req, res) => {
  try {
    console.log('Début de la récupération des emails depuis la base de données')
    const experts = await TpiExperts.find({}, 'email')
    console.log(`Emails récupérés : ${experts.length}`)
    res.json(experts.map(expert => expert.email))
  } catch (error) {
    console.error('Erreur lors de la récupération des emails :', error)
    res.status(500).send('Erreur lors de la récupération des emails')
  }
})

app.get('/api/experts/listExpertsOrBoss', async (req, res) => {
  try {
    console.log('Début de la récupération des emails depuis la base de données')
    const list = await TpiExperts.find()
    console.log(`list récupérées : ${list.length}`)
    res.json(list)
  } catch (error) {
    console.error('Erreur lors de la récupération des emails :', error)
    res.status(500).send('Erreur lors de la récupération des emails')
  }
})

app.put('/api/experts/putTokens', async (req, res) => {
  try {
    const updates = req.body

    if (!Array.isArray(updates)) {
      return res
        .status(400)
        .send("Le format des données envoyées n'est pas valide")
    }

    for (const update of updates) {
      const updateData = { token: update.token }
      if (update.token) {
        updateData.date = new Date() // Définir la date lors de la mise à jour du token
      }

      await TpiExperts.updateOne({ email: update.email }, { $set: updateData })
    }

    res.send('Tokens mis à jour avec succès')
  } catch (error) {
    console.error('Erreur lors de la mise à jour des tokens:', error)
    res.status(500).send('Erreur interne du serveur')
  }
})

// Create a collection from 'planification' during publication
// for display purposes and validation by concerned parties
app.get('/api/tpiyear/:year', async (req, res) => {
  const year = req.params.year
  const collectionName = `tpiSoutenance_${year}`

  console.log(`Request received to fetch rooms for the year: ${year}`)

  try {
    console.log(
      `Attempting to connect to MongoDB collection: ${collectionName}`
    )

    // Utilisez la fonction de création de modèle personnalisé
    const DataRooms = createCustomTpiRoomModel(collectionName)

    console.log(`Fetching all rooms in the collection: ${collectionName}`)
    const rooms = await DataRooms.find()

    console.log(`Number of rooms found for the year ${year}: ${rooms.length}`)
    res.json(rooms)
  } catch (error) {
    console.error(`Error fetching rooms for the year ${year}:`, error)
    res
      .status(500)
      .json({ error: `Internal server error for the year ${year}` })
  }
})

function extraireIndexes (chaine) {
  // Utilisation d'une expression régulière pour extraire les nombres
  const nombres = chaine.match(/\d+/g)

  // Si la chaîne ne contient pas au moins deux nombres, retourner null
  if (nombres && nombres.length >= 2) {
    const salle = parseInt(nombres[0], 10) // Le premier nombre est l'index de la salle
    const tpi = parseInt(nombres[1], 10) // Le deuxième nombre est l'index du TPI
    return { salle, tpi }
  } else {
    return null // Retourner null si les nombres ne sont pas trouvés
  }
}

// fonction qui met à jour l'élèment offres
app.put('/api/tpiyear/:year/:id/:tpiRef/:expertOrBoss', async (req, res) => {
  const year = req.params.year
  const indexes = extraireIndexes(req.params.tpiRef)
  const expertOrBoss = req.params.expertOrBoss

  console.log(
    'année: ',
    year,
    'indexes : ',
    indexes,
    ' expert ? ',
    expertOrBoss
  )

  try {
    // Récupérez les données de soutenance à partir de l'API
    const collectionName = `tpiSoutenance_${year}`
    const DataRooms = createCustomTpiRoomModel(collectionName)
    const soutenanceData = await DataRooms.find()

    // Assurez-vous que les index sont valides
    if (
      indexes.salle >= 0 &&
      indexes.tpi >= 0 &&
      indexes.salle < soutenanceData.length
    ) {
      // Identifiez l'objet tpiDatas spécifique dans la liste
      const specificTpiDatas =
        soutenanceData[indexes.salle].tpiDatas[indexes.tpi]

      // Assurez-vous que tpiDatas est un objet
      if (
        typeof specificTpiDatas === 'object' &&
        !Array.isArray(specificTpiDatas)
      ) {
        // Mise à jour du document dans la base de données
        let updateQuery = {}
        updateQuery[`tpiDatas.${indexes.tpi}.${expertOrBoss}.offres`] =
          req.body.offres

        console.log(updateQuery)

        const result = await DataRooms.updateOne(
          {
            _id: soutenanceData[indexes.salle]._id,
            [`tpiDatas.${indexes.tpi}.${expertOrBoss}`]: { $exists: true }
          },
          { $set: updateQuery }
        )

        // Vérifier si un document a été effectivement mis à jour
        if (result.matchedCount === 0) {
          console.log(
            'Aucun document correspondant trouvé pour la mise à jour.'
          )
        } else if (result.modifiedCount === 0) {
          console.log('Document trouvé mais pas de modifications apportées.')
        } else {
          console.log('Document mis à jour avec succès.')
        }

        res
          .status(200)
          .json({ message: 'Soutenance data updated successfully' })
      } else {
        console.error('tpiDatas is not an object')
        res.status(400).json({ error: 'tpiDatas is not an object' })
      }
    } else {
      console.error('Invalid indexes')
      res.status(400).json({ error: 'Invalid indexes' })
    }
  } catch (error) {
    console.error(`Error adding offer for the year ${year}:`, error)
    res
      .status(500)
      .json({ error: `Internal server error for the year ${year}` })
  }
})

// fonction qui met à jour l'élément submit de offres
app.put(
  '/api/save-propositions/:year/:expertOrBoss/:tpi_id',
  async (req, res) => {
    const { year, expertOrBoss } = req.params
    const indexes = extraireIndexes(req.params.tpi_id) // { salle: x, tpi: y }
    const propositionsData = req.body
    const collectionName = `tpiSoutenance_${year}`

    const DataRooms = mongoose.model(
      collectionName,
      tpiRoomSchema,
      collectionName
    )

    try {
      // Identifier le document spécifique à mettre à jour
      const rooms = await DataRooms.find()
      const salleId = rooms[indexes.salle]._id

      console.log('salle id :', salleId)

      let updateQuery = {}
      updateQuery[`tpiDatas.${indexes.tpi}.${expertOrBoss}.offres`] =
        propositionsData

      console.log(propositionsData)

      const result = await DataRooms.updateOne(
        {
          _id: salleId,
          [`tpiDatas.${indexes.tpi}.${expertOrBoss}`]: { $exists: true }
        },
        { $set: updateQuery }
      )

      // Vérifier si un document a été effectivement mis à jour
      if (result.matchedCount === 0) {
        console.log('Aucun document correspondant trouvé pour la mise à jour.')
      } else if (result.modifiedCount === 0) {
        console.log('Document trouvé mais pas de modifications apportées.')
      } else {
        console.log('Document mis à jour avec succès.')
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error)
      res.status(500).json({ error: 'Erreur lors de la mise à jour' })
    }
  }
)

app.post('/save-tpi-rooms/:year', async (req, res) => {
  const year = req.params.year
  const roomData = req.body

  try {
    const TpiModel = createTpiRoomModel(year)

    // Affiche la valeur de roomData.idRoom et son type pour le débogage
    console.log('roomData.idRoom  ', roomData.idRoom)
    console.log('Type de roomData.idRoom : ', typeof roomData.idRoom)

    // Vérifiez si une salle TPI avec la même idRoom existe déjà
    const existingRoom = await TpiModel.findOne({ idRoom: roomData.idRoom })

    if (existingRoom) {
      // Si la salle existe déjà, mettez à jour ses données
      await TpiModel.updateOne({ idRoom: roomData.idRoom }, roomData)

      // Affiche un message de succès en cas de mise à jour
      console.log(`Salle TPI mise à jour pour l'année ${year}:`, roomData)
      res.json(roomData)
    } else {
      console.log('aucune salle ne possède cet id ', roomData.idRoom)
      // Si la salle n'existe pas, créez une nouvelle salle TPI
      const newTpiRoom = new TpiModel({ ...roomData, year })
      console.log('contenu de newTpiRoom: ', newTpiRoom)
      await newTpiRoom.save()

      // Affiche un message de succès en cas de création
      console.log(
        `Salle TPI pour l'année ${year} enregistrée avec succès:`,
        newTpiRoom
      )
      res.json(newTpiRoom)
    }
  } catch (error) {
    // En cas d'erreur, affiche l'erreur détaillée pour le débogage
    console.error(
      `Erreur lors de la gestion de la salle TPI pour l'année ${year}:`,
      error
    )

    // Répond avec un statut 500 et un message d'erreur JSON
    res.status(500).json({
      error: `Erreur lors de la gestion de la salle TPI pour l'année ${year}`
    })
  }
})

// TPI MODEL

app.post('/save-tpi', async (req, res) => {
  try {
    const modelData = req.body
    const savedModel = await TpiModels.findOneAndUpdate(
      { refTpi: modelData.refTpi },
      modelData,
      { upsert: true, new: true }
    )

    console.log('TPI model processed successfully:', savedModel)
    res.json(savedModel)
  } catch (error) {
    console.error('Error saving TPI model:', error)
    res.status(500).json({ error: 'Error saving TPI model' })
  }
})

app.get('/api/check-room-existence/:idRoom', async (req, res) => {
  const idRoom = req.params.idRoom

  // Validate the ID
  if (!idRoom) {
    return res.status(400).json({ message: 'Room ID is required.' })
  }

  try {
    console.log(`Checking the existence of the room with ID: ${idRoom}`)
    const room = await TpiRooms.findOne({ idRoom: idRoom }).exec()

    if (!room) {
      console.log(`No matching room found for ID: ${idRoom}`)
      return res.status(404).json({ exists: false })
    }

    console.log(
      `Matching room found with ID: ${idRoom}, Room ID: ${room.idRoom}`
    )
    res.json({ exists: true, idRoom: room.idRoom })
  } catch (error) {
    console.error(`Error checking room existence: ${error.message}`)
    res.status(500).json({ message: error.message })
  }
})

// Route to get all TPI models
app.get('/get-tpi', async (req, res) => {
  console.log('get-tpi')
  try {
    const models = await TpiModels.find()
    console.log('TPI models retrieved:', models)
    res.json(models)
  } catch (error) {
    console.error('Error retrieving TPI models:', error)
    res.status(500).json({ error: 'Error retrieving TPI models' })
  }
})

app.put('/update-tpi/:id', async (req, res) => {
  const tpiId = req.params.id
  const updateData = req.body

  // Basic validation (can be improved with libraries like Joi)
  if (
    !tpiId ||
    typeof tpiId !== 'string' ||
    Object.keys(updateData).length === 0
  ) {
    return res.status(400).json({ error: 'Invalid data provided.' })
  }

  try {
    // First, check if the TPI exists
    const existingTpi = await TpiModels.findById(tpiId)
    if (!existingTpi) {
      return res.status(404).json({ error: 'TPI not found.' })
    }

    // Update the TPI
    const updatedTpi = await TpiModels.findByIdAndUpdate(tpiId, updateData, {
      new: true
    })
    console.log('TPI updated successfully:', updatedTpi)
    res.json(updatedTpi)
  } catch (error) {
    console.error('Error updating TPI:', error)
    res.status(500).json({ error: 'Error updating TPI' })
  }
})

app.get('/get-tpi/:id', async (req, res) => {
  const tpiId = req.params.id

  try {
    const tpi = await TpiModels.findById(tpiId)
    if (!tpi) {
      console.log('No TPI found with this ID:', tpiId)
      res.status(404).json({ error: 'No TPI found with this ID' })
    } else {
      console.log('TPI retrieved successfully:', tpi)
      res.json(tpi)
    }
  } catch (error) {
    console.error('Error retrieving TPI:', error)
    res.status(500).json({ error: 'Error retrieving TPI' })
  }
})

// TPI ROOMS
app.post('/create-tpi-collection/:year', async (req, res) => {
  const year = req.params.year
  const roomData = req.body

  try {
    // Utilisez la fonction createCustomTpiRoomModel pour créer le modèle
    const collectionName = `tpiSoutenance_${year}`
    const TpiModel = createCustomTpiRoomModel(collectionName)

    const newTpiRoom = new TpiModel(roomData)
    await newTpiRoom.save()

    res.status(200).json({
      message: `TPI collection for the year ${year} created successfully.`
    })
  } catch (error) {
    console.error(
      `Error creating TPI collection for the year ${year}: ${error}`
    )
    res.status(500).json({ error: error.message })
  }
})

app.get('/get-tpi-rooms', async (req, res) => {
  try {
    const rooms = await TpiRooms.find()
    console.log('TPI rooms retrieved:', rooms)
    res.json(rooms)
  } catch (error) {
    console.error('Error retrieving TPI rooms:', error)
    res.status(500).json({ error: 'Error retrieving TPI rooms' })
  }
})

app.get('/get-tpi-room/:id', async (req, res) => {
  try {
    const roomId = req.params.id
    const room = await TpiRooms.findById(roomId)
    console.log('TPI room retrieved:', room)
    res.json(room)
  } catch (error) {
    console.error('Error retrieving TPI room:', error)
    res.status(500).json({ error: 'Error retrieving TPI room' })
  }
})

app.put('/update-tpi-room/:id', async (req, res) => {
  try {
    const roomId = req.params.id
    const roomData = req.body

    console.log('Data processed:', roomId, ' data:', roomData)

    const existingRoom = await TpiRooms.findById(roomId)

    if (!existingRoom) {
      return res.status(404).json({ error: 'TPI room not found' })
    }

    const updatedRoom = await TpiRooms.findByIdAndUpdate(roomId, roomData, {
      new: true
    })

    console.log('TPI room updated:', updatedRoom)
    res.json(updatedRoom)
  } catch (error) {
    console.error('Error updating TPI room:', error)
    res.status(500).json({ error: 'Error updating TPI room' })
  }
})

app.delete('/delete-tpi-room/:id', async (req, res) => {
  try {
    const roomId = req.params.id
    await TpiRooms.findByIdAndDelete(roomId)
    console.log('TPI room deleted successfully.')
    res.json({ message: 'TPI room deleted successfully.' })
  } catch (error) {
    console.error('Error deleting TPI room:', error)
    res.status(500).json({ error: 'Error deleting TPI room' })
  }
})

// TPI USERS

app.post('/inscription', async (req, res) => {
  try {
    const userData = req.body
    const user = new User(userData)
    const savedUser = await user.save()
    console.log('User registered successfully:', savedUser)
    res.json(savedUser)
  } catch (error) {
    console.error('Error registering user:', error)
    res.status(500).json({
      error: 'Error registering user'
    })
  }
})

app.get('/suivi-etudiants', async (req, res) => {
  try {
    const users = await User.find()
    res.json(users)
  } catch (error) {
    console.error('Error retrieving users:', error)
    res.status(500).json({ error: 'Error retrieving users' })
  }
})

app.put('/suivi-etudiants/:id', async (req, res) => {
  const userId = req.params.id
  const updateData = req.body

  try {
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true
    })
    console.log('User updated successfully:', updatedUser)
    res.json(updatedUser)
  } catch (error) {
    console.error('Error updating user:', error)
    res.status(500).json({ error: 'Error updating user' })
  }
})

// Route to overwrite data in tpiRooms_2024 with tpiSoutenance_2024
app.post('/overwrite-tpi-rooms/:year', async (req, res) => {
  const year = req.params.year
  const collectionNameSoutenance = `tpiSoutenance_${year}`
  const collectionNameRooms = `tpiRooms_${year}`

  try {
    // Create models for both collections
    const TpiRoomModelSoutenance = createCustomTpiRoomModel(
      collectionNameSoutenance
    )
    const TpiRoomModelRooms = createCustomTpiRoomModel(collectionNameRooms)

    // Retrieve all data from the tpiSoutenance_2024 collection
    const soutenanceData = await TpiRoomModelSoutenance.find()

    // Delete all data from the tpiRooms_2024 collection
    await TpiRoomModelRooms.deleteMany({})

    // Insert data from tpiSoutenance_2024 into tpiRooms_2024
    await TpiRoomModelRooms.insertMany(soutenanceData)

    res
      .status(200)
      .json({
        message: `Data from collection ${collectionNameSoutenance} has been overwritten into collection ${collectionNameRooms}`
      })
  } catch (error) {
    console.error('Error overwriting data:', error)
    res.status(500).json({ error: 'Error overwriting data' })
  }
})

app.listen(port, () => {
  console.log(`Backend server is running on port ${port}`)
})
