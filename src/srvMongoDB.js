// Importez la fonction ObjectId de la bibliothèque MongoDB native
const { ObjectId } = require('mongodb')

const express = require('express')
const cors = require('cors')

const db = require('./config/dbConfig')

const bodyParser = require('body-parser')
const nodemailer = require('nodemailer')
const mongoose = require('mongoose')

const TpiModelsYear = require('./models/tpiModels')
const User = require('./models/userModels')
const {
  createTpiRoomModel,
  createCustomTpiRoomModel,
  tpiRoomSchema
} = require('./models/tpiRoomsModels')

const TpiExperts = require('./models/tpiExpertsModel')
const { is } = require('date-fns/locale')

const app = express()

const isDemo = process.env.REACT_APP_DEBUG === 'true'
const port = isDemo ? 5000 : 6000

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send(`App is Working\nport: ${port}\nthis version is demo: ${isDemo}`)
})

// const pour les messages d'erreurs

const ERROR_MESSAGES = {
  MISSING_TOKEN: 'Token manquant dans la requête.',
  EXPERT_NOT_FOUND: 'Aucun expert trouvé avec ce token.',
  INTERNAL_ERROR: "Erreur interne lors de la récupération du nom de l'expert."
}

// Configurer Nodemailer avec vos paramètres d'envoi d'email

app.post('/api/send-email', async (req, res) => {
  const { email, url } = req.body
  // Logique pour envoyer l'email avec Nodemailer
  // ...
})

//#region TpiList (tpiExperts)

/**
 * Recherche des TPI dans la base de données dont le nom du candidat commence par la valeur spécifiée.
 * @param {string} candidateName - Le début du nom du candidat pour lequel rechercher les TPI.
 * @returns {array} Les TPI trouvés dont le nom du candidat commence par la valeur spécifiée.
 */
app.get('/api/tpi/:year/byCandidate/:candidateName', async (req, res) => {
  try {
    // Récupérer le début du nom du candidat depuis les paramètres de la requête
    const candidateNameStart = req.params.candidateName;
    // Récupérer l'année depuis les paramètres de la requête
    const year = req.params.year;

    // Afficher un message dans la console pour indiquer le début de la recherche
    console.log(`Recherche des TPI de l'année ${year} dont le nom du candidat commence par "${candidateNameStart}"...`);

    // Rechercher les TPI dans la base de données dont le nom du candidat commence par la valeur spécifiée
    const tpiList = await TpiModelsYear(year).find({ candidat: { $regex: `^${candidateNameStart}`, $options: 'i' } });

    // Vérifier si des TPI ont été trouvés pour le candidat
    if (tpiList.length === 0) {
      // Afficher un message dans la console si aucun TPI n'a été trouvé
      console.log(`Aucun TPI trouvé pour le candidat dont le nom commence par "${candidateNameStart}"`);
      // Retourner une réponse JSON avec un code d'erreur 404 si aucun TPI n'a été trouvé
      return res.status(404).json({ error: 'Aucun TPI trouvé pour ce candidat' });
    }

    // Afficher les TPI trouvés dans la console
    console.log(`TPIs trouvés pour le candidat dont le nom commence par "${candidateNameStart}":`, tpiList);

    // Ajouter des en-têtes à la réponse pour fournir des informations supplémentaires sur la ressource retournée
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Comment', 'Ressource TPI par nom de candidat');

    // Retourner les TPI trouvés dans la réponse JSON
    res.json(tpiList);
  } catch (error) {
    // Afficher un message d'erreur dans la console en cas d'erreur
    console.error('Erreur lors de la recherche des TPI par candidat :', error);
    // Retourner une réponse d'erreur avec un code d'erreur 500 en cas d'erreur interne du serveur
    res.status(500).send('Erreur interne du serveur');
  }
});


/**
 * Recherche un responsable par son nom dans la base de données.
 *
 * @param {String} bossName - Le nom du responsable à rechercher.
 * @returns {Promise} - Une promesse qui se résout avec le document trouvé ou null si aucun n'a été trouvé.
 */
function findResponsableByName (bossName) {
  return TpiExperts.findOne({ boss: bossName }).exec()
}

// Route GET pour chercher un responsable par son nom
app.get('/api/makeToken/:bossName', (req, res) => {
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
    console.log(
      'Début de la récupération des données des experts depuis la base de données'
    )
    const experts = await TpiExperts.find({}, 'email name') // Inclure 'name'
    console.log(`Données des experts récupérées : ${experts.length}`)

    res.json(
      experts.map(expert => ({
        email: expert.email,
        name: expert.name // Inclure 'name'
      }))
    )
  } catch (error) {
    console.error(
      'Erreur lors de la récupération des données des experts :',
      error
    )
    res
      .status(500)
      .send('Erreur lors de la récupération des données des experts')
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

app.get('/api/experts/getNameByToken', async (req, res) => {
  try {
    // Récupérer le token de la requête
    const token = req.query.token

    // Vérifier si le token est présent dans la requête
    if (!token) {
      return res.status(400).json({ error: ERROR_MESSAGES.MISSING_TOKEN })
    }

    // Rechercher l'expert dans la base de données en utilisant le token
    const expert = await TpiExperts.findOne({ token })

    // Vérifier si un expert a été trouvé
    if (!expert) {
      return res.status(404).json({ error: ERROR_MESSAGES.EXPERT_NOT_FOUND })
    }

    // Retourner le nom de l'expert
    res.json({ name: expert.name })
  } catch (error) {
    console.error("Erreur lors de la récupération du nom de l'expert :", error)
    res.status(500).send(ERROR_MESSAGES.INTERNAL_ERROR)
  }
})

app.put('/api/experts/putTokens', async (req, res) => {
  try {
    const updates = req.body

    // Vérifier si les mises à jour sont envoyées sous forme de tableau
    if (!Array.isArray(updates)) {
      return res
        .status(400)
        .send("Le format des données envoyées n'est pas valide")
    }

    // Parcourir chaque mise à jour et mettre à jour les tokens correspondants
    for (const update of updates) {
      const updateData = { token: update.token }

      // Vérifier si un token est fourni avant de définir la date de mise à jour
      if (update.token) {
        updateData.date = new Date() // Définir la date lors de la mise à jour du token
      }

      // Mettre à jour le token pour l'expert correspondant
      await TpiExperts.updateOne({ email: update.email }, { $set: updateData })
    }

    // Envoyer une réponse indiquant que les tokens ont été mis à jour avec succès
    res.send('Tokens mis à jour avec succès')
  } catch (error) {
    console.error('Erreur lors de la mise à jour des tokens:', error)
    // Envoyer une réponse d'erreur en cas de problème lors de la mise à jour des tokens
    res.status(500).send('Erreur interne du serveur')
  }
})

//#endregion

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

// Create a collection from 'planification' during publication
// for display purposes and validation by concerned parties
app.get('/api/tpiRoomYear/:year', async (req, res) => {
  const year = req.params.year
  const collectionName = `tpiRooms_${year}`

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

app.put(
  '/api/save-propositions/:year/:expertOrBoss/:tpi_indexes/:tpi_id',
  async (req, res) => {
    const { year, expertOrBoss, tpi_indexes, tpi_id } = req.params
    const propositionsData = req.body
    const collectionName = `tpiSoutenance_${year}`

    const DataRooms = mongoose.model(
      collectionName,
      tpiRoomSchema,
      collectionName
    )

    console.log('Tentative de mise à jour dans la collection :', collectionName)
    console.log('Année :', year)
    console.log('Rôle :', expertOrBoss)
    console.log('Indexes extraits :', tpi_indexes)
    console.log("ID de l'objet :", tpi_id)
    console.log('Données de propositions :', propositionsData)

    try {
      // Charger le document TPI correspondant
      const tpiDocument = await DataRooms.findOne({
        'tpiDatas.id': tpi_indexes
      })

      if (!tpiDocument) {
        console.log('Aucun document TPI correspondant trouvé.')
        return res.status(404).json({ error: 'Document TPI non trouvé' })
      }

      // Ajouter la proposition au bon champ (expert ou boss)
      tpiDocument.tpiDatas.forEach(tpiData => {
        if (tpiData.id === tpi_indexes) {
          tpiData[expertOrBoss].offres = propositionsData
        }
      })

      // Mettre à jour le document TPI dans la base de données
      const updatedDocument = await tpiDocument.save()

      console.log('Document TPI mis à jour avec succès :', updatedDocument)
      res.status(200).json({
        message: 'Document TPI mis à jour avec succès',
        updatedDocument
      })
    } catch (error) {
      console.error('Erreur lors de la mise à jour du document TPI :', error)
      res
        .status(500)
        .json({ error: 'Erreur lors de la mise à jour du document TPI' })
    }
  }
)

app.post('/api/save-tpi-rooms/:year', async (req, res) => {
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

app.post('/api/save-tpi', async (req, res) => {
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
app.get('/api/get-tpi', async (req, res) => {
  console.log('get-tpi')
  try {
    let models
    const year = req.query.year // Récupère l'année depuis les paramètres de requête
    console.log('Année spécifiée dans la requête:', year)

    if (year) {
      // Utilise la fonction TpiModelsYear pour obtenir le modèle approprié en fonction de l'année
      const tpiModelsYear = TpiModelsYear(year)
      // Utilise ce modèle pour récupérer les modèles de TPI pour cette année
      models = await tpiModelsYear.find()
      console.log("Modèles de TPI pour l'année", year, 'récupérés:', models)
    } else {
      console.log(
        'Année manquante. Impossible de récupérer les modèles de TPI.'
      )
    }

    console.log('TPI models retrieved:', models)
    res.json(models)
  } catch (error) {
    console.error('Error retrieving TPI models:', error)
    res.status(500).json({ error: 'Error retrieving TPI models' })
  }
})

app.put('/api/update-tpi/:id', async (req, res) => {
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

app.get('/api/get-tpi/:id', async (req, res) => {
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
app.post('/api/create-tpi-collection/:year', async (req, res) => {
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

app.get('/api/get-tpi-rooms', async (req, res) => {
  try {
    const rooms = await TpiRooms.find()
    console.log('TPI rooms retrieved:', rooms)
    res.json(rooms)
  } catch (error) {
    console.error('Error retrieving TPI rooms:', error)
    res.status(500).json({ error: 'Error retrieving TPI rooms' })
  }
})

app.get('/api/get-tpi-room/:id', async (req, res) => {
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

app.put('/api/update-tpi-room/:id', async (req, res) => {
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

app.delete('/api/delete-tpi-room/:id', async (req, res) => {
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

app.post('/api/inscription', async (req, res) => {
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

app.get('/api/suivi-etudiants', async (req, res) => {
  try {
    const users = await User.find()
    res.json(users)
  } catch (error) {
    console.error('Error retrieving users:', error)
    res.status(500).json({ error: 'Error retrieving users' })
  }
})

app.put('/api/suivi-etudiants/:id', async (req, res) => {
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

// Route to overwrite data in tpiRooms_year with tpiSoutenance_year
app.post('/api/overwrite-tpi-rooms/:year', async (req, res) => {
  const year = req.params.year
  const collectionNameSoutenance = `tpiSoutenance_${year}`
  const collectionNameRooms = `tpiRooms_${year}`

  try {
    console.log(
      `Starting data overwrite from ${collectionNameSoutenance} to ${collectionNameRooms}`
    )

    // Create models for both collections
    const TpiRoomModelSoutenance = createCustomTpiRoomModel(
      collectionNameSoutenance
    )
    const TpiRoomModelRooms = createCustomTpiRoomModel(collectionNameRooms)

    // Retrieve all data from the tpiSoutenance_year collection
    console.log(`Retrieving data from ${collectionNameSoutenance}`)
    const soutenanceData = await TpiRoomModelSoutenance.find()

    // Delete all data from the tpiRooms_year collection
    console.log(`Deleting all data from ${collectionNameRooms}`)
    await TpiRoomModelRooms.deleteMany({})

    // Insert data from tpiSoutenance_ into tpiRooms_
    console.log(`Inserting data into ${collectionNameRooms}`)
    await TpiRoomModelRooms.insertMany(soutenanceData)

    console.log(
      `Data from collection ${collectionNameSoutenance} has been successfully overwritten into collection ${collectionNameRooms}`
    )

    res.status(200).json({
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
