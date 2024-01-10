const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

db = require('./config/dbConfig')
const mongoose = require('mongoose')

const PropositionSchema = require('./models/propositionModel')
const TpiModels = require('./models/tpiModels')
const User = require('./models/userModels')
const TpiRooms = require('./models/tpiRoomsModels')

const app = express()
const port = 5000

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.send('App is Working')
})

app.get('/api/tpiyear/:year', async (req, res) => {
  const year = req.params.year
  const collectionName = `tpi${year}`

  console.log(`Requête reçue pour récupérer les salles de l'année : ${year}`)

  try {
    console.log(
      `Tentative de connexion à la collection MongoDB : ${collectionName}`
    )
    const DataRooms = mongoose.model(
      collectionName,
      TpiRooms.schema,
      collectionName
    )

    console.log(
      `Recherche de toutes les salles dans la collection : ${collectionName}`
    )
    const salles = await DataRooms.find()

    console.log(
      `Nombre de salles trouvées pour l'année ${year}: ${salles.length}`
    )
    res.json(salles)
  } catch (error) {
    console.error(
      `Erreur lors de la récupération des salles pour l'année ${year}:`,
      error
    )
    res
      .status(500)
      .json({ error: `Erreur interne du serveur pour l'année ${year}` })
  }
})

app.post('/api/save-propositions/:year', async (req, res) => {
  const year = req.params.year
  const collectionName = `proposition_${year}`

  // Utilisez mongoose.model pour créer un modèle basé sur le schéma et le nom de collection spécifiques à l'année
  const PropositionModel = mongoose.model(
    collectionName,
    PropositionSchema,
    collectionName
  )

  const propositionsData = req.body

  try {
    // Créez une nouvelle instance du modèle et sauvegardez les données
    const newProposition = new PropositionModel(propositionsData)
    await newProposition.save()

    res.status(200).json({ message: 'Propositions enregistrées avec succès' })
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des propositions:', error)
    res
      .status(500)
      .json({ error: 'Erreur lors de la sauvegarde des propositions' })
  }
})

/** #region: TPI MODEL */

app.post('/save-tpi', async (req, res) => {
  try {
    const modelData = req.body
    // Utilisez findOneAndUpdate avec upsert pour simplifier la logique
    const savedModel = await TpiModels.findOneAndUpdate(
      { refTpi: modelData.refTpi },
      modelData,
      { upsert: true, new: true }
    )

    console.log('Modèle de TPI traité avec succès:', savedModel)
    res.json(savedModel)
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du modèle de TPI:", error)
    res
      .status(500)
      .json({ error: "Erreur lors de l'enregistrement du modèle de TPI" })
  }
})

app.get('/api/check-room-existence/:idRoom', async (req, res) => {
  const idRoom = req.params.idRoom

  // Validation de l'ID
  if (!idRoom) {
    return res.status(400).json({ message: "L'ID de la salle est requis." })
  }

  try {
    console.log(`Vérification de l'existence de la salle avec l'ID : ${idRoom}`)
    const room = await TpiRooms.findOne({ idRoom: idRoom }).exec()

    if (!room) {
      console.log(`Aucune salle correspondante trouvée pour l'ID : ${idRoom}`)
      return res.status(404).json({ exists: false })
    }

    console.log(
      `Salle correspondante trouvée avec l'ID : ${idRoom}, ID de la salle : ${room.idRoom}`
    )
    res.json({ exists: true, idRoom: room.idRoom })
  } catch (error) {
    console.error(
      `Erreur lors de la vérification de l'existence de la salle : ${error.message}`
    )
    res.status(500).json({ message: error.message })
  }
})

// Route pour récupérer tous les modèles de TPI
app.get('/get-tpi', async (req, res) => {
  console.log('get-tpi')
  try {
    const models = await TpiModels.find()
    console.log('Modèles de TPI récupérés:', models)
    res.json(models)
  } catch (error) {
    console.error('Erreur lors de la récupération des modèles de TPI:', error)
    res
      .status(500)
      .json({ error: 'Erreur lors de la récupération des modèles de TPI' })
  }
})

app.put('/update-tpi/:id', async (req, res) => {
  const tpiId = req.params.id
  const updateData = req.body

  // Validation de base (peut être améliorée avec des bibliothèques comme Joi)
  if (
    !tpiId ||
    typeof tpiId !== 'string' ||
    Object.keys(updateData).length === 0
  ) {
    return res.status(400).json({ error: 'Données invalides fournies.' })
  }

  try {
    // Vérifie d'abord si le TPI existe
    const existingTpi = await TpiModels.findById(tpiId)
    if (!existingTpi) {
      return res.status(404).json({ error: 'TPI non trouvé.' })
    }

    // Mise à jour du TPI
    const updatedTpi = await TpiModels.findByIdAndUpdate(tpiId, updateData, {
      new: true
    })
    console.log('TPI mis à jour avec succès:', updatedTpi)
    res.json(updatedTpi)
  } catch (error) {
    console.error('Erreur lors de la mise à jour du TPI:', error)
  }
})

// Route pour récupérer un modèle de TPI par son ID
app.get('/get-tpi/:id', async (req, res) => {
  const tpiId = req.params.id

  try {
    const tpi = await TpiModels.findById(tpiId)
    if (!tpi) {
      console.log('Aucun TPI trouvé avec cet ID:', tpiId)
      res.status(404).json({ error: 'Aucun TPI trouvé avec cet ID' })
    } else {
      console.log('TPI récupéré avec succès:', tpi)
      res.json(tpi)
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du TPI:', error)
    res.status(500).json({ error: 'Erreur lors de la récupération du TPI' })
  }
})
/** #endregion*/

/**#region: TPI rooms */

// Route pour enregistrer une nouvelle salle de TPI
app.post('/save-tpi-rooms', async (req, res) => {
  try {
    const roomData = req.body
    console.log(roomData)
    const newRoom = new TpiRooms(roomData)
    const savedRooms = await newRoom.save()
    console.log('Salle de TPI enregistrée avec succès:', savedRooms)
    res.json(savedRooms)
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de la salle de TPI:", error)
    res
      .status(500)
      .json({ error: "Erreur lors de l'enregistrement de la salle de TPI" })
  }
})

// Route pour récupérer toutes les salles de TPI
app.get('/get-tpi-rooms', async (req, res) => {
  try {
    const rooms = await TpiRooms.find()
    console.log('Salles de TPI récupérées:', rooms)
    res.json(rooms)
  } catch (error) {
    console.error('Erreur lors de la récupération des salles de TPI:', error)
    res
      .status(500)
      .json({ error: 'Erreur lors de la récupération des salles de TPI' })
  }
})

app.post('/create-tpi-collection/:year', async (req, res) => {
  const year = req.params.year
  const roomData = req.body

  try {
    // Création dynamique d'un modèle Mongoose pour la collection spécifique à l'année
    const TpiModel = mongoose.model(
      `TpiRoom_${year}`,
      TpiRooms.schema,
      `tpi${year}`
    )

    // Création d'un nouveau document basé sur les données reçues
    const newTpiRoom = new TpiModel(roomData)
    await newTpiRoom.save()

    res.status(200).json({
      message: `Collection TPI pour l'année ${year} créée avec succès.`
    })
  } catch (error) {
    console.error(
      `Erreur lors de la création de la collection TPI pour l'année ${year}: ${error}`
    )
    res.status(500).json({ error: error.message })
  }
})

// Route pour récupérer une salle de TPI par son ID
app.get('/get-tpi-room/:id', async (req, res) => {
  try {
    const roomId = req.params.id
    const room = await TpiRooms.findById(roomId)
    console.log('Salle de TPI récupérée:', room)
    res.json(room)
  } catch (error) {
    console.error('Erreur lors de la récupération de la salle de TPI:', error)
    res
      .status(500)
      .json({ error: 'Erreur lors de la récupération de la salle de TPI' })
  }
})

// Route pour mettre à jour une salle de TPI
app.put('/update-tpi-room/:id', async (req, res) => {
  try {
    const roomId = req.params.id
    const roomData = req.body

    console.log('donnée traitée : ', roomId, ' data :', roomData)

    // Vérifiez si la salle de TPI existe avant de la mettre à jour
    const existingRoom = await TpiRooms.findById(roomId)

    if (!existingRoom) {
      return res.status(404).json({ error: 'Salle de TPI non trouvée' })
    }

    // Mettez à jour la salle de TPI
    const updatedRoom = await TpiRooms.findByIdAndUpdate(roomId, roomData, {
      new: true
    })

    console.log('Salle de TPI mise à jour:', updatedRoom)
    res.json(updatedRoom)
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la salle de TPI:', error)
    res
      .status(500)
      .json({ error: 'Erreur lors de la mise à jour de la salle de TPI' })
  }
})

// Route pour supprimer une salle de TPI
app.delete('/delete-tpi-room/:id', async (req, res) => {
  try {
    const roomId = req.params.id
    await TpiRooms.findByIdAndDelete(roomId)
    console.log('Salle de TPI supprimée avec succès.')
    res.json({ message: 'Salle de TPI supprimée avec succès.' })
  } catch (error) {
    console.error('Erreur lors de la suppression de la salle de TPI:', error)
    res
      .status(500)
      .json({ error: 'Erreur lors de la suppression de la salle de TPI' })
  }
})
/**#endregion */

/**#region: tpiUsers */
// Route pour la création d'un nouvel utilisateur
app.post('/inscription', async (req, res) => {
  try {
    const userData = req.body // Récupérer les données d'inscription envoyées depuis le client

    // Traiter les données d'inscription et enregistrer dans la base de données (utilisez le modèle User ici)
    const user = new User(userData)
    const savedUser = await user.save()
    console.log('Utilisateur enregistré avec succès:', savedUser)
    // Répondre au client avec les données enregistrées (vous pouvez renvoyer seulement l'ID ou l'objet complet, selon vos besoins)
    res.json(savedUser)
  } catch (error) {
    console.error(
      "Erreur lors de l'enregistrement des données d'inscription :",
      error
    )
    res.status(500).json({
      error: "Erreur lors de l'enregistrement des données d'inscription"
    })
  }
})

// Route pour récupérer tous les utilisateurs
app.get('/suivi-etudiants', async (req, res) => {
  try {
    // Utilisez la méthode find() pour récupérer tous les utilisateurs depuis la base de données
    const users = await User.find()
    // Répondre au client avec les données récupérées
    res.json(users)
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs :', error)
    res
      .status(500)
      .json({ error: 'Erreur lors de la récupération des utilisateurs' })
  }
})

// Route pour mettre à jour un utilisateur par son ID
app.put('/suivi-etudiants/:id', async (req, res) => {
  const userId = req.params.id
  const updateData = req.body

  try {
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true
    })
    console.log('Utilisateur mis à jour avec succès:', updatedUser)
    res.json(updatedUser)
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'utilisateur :", error)
    res
      .status(500)
      .json({ error: "Erreur lors de la mise à jour de l'utilisateur" })
  }
})

// Route pour supprimer un utilisateur par son ID
app.delete('/suivi-etudiants/:id', async (req, res) => {
  const userId = req.params.id

  try {
    const deletedUser = await User.findByIdAndDelete(userId)
    console.log('Utilisateur supprimé avec succès:', deletedUser)
    res.json(deletedUser)
  } catch (error) {
    console.error("Erreur lors de la suppression de l'utilisateur :", error)
    res
      .status(500)
      .json({ error: "Erreur lors de la suppression de l'utilisateur" })
  }
})

/**#endregion */
app.listen(port, () => {
  console.log(`Serveur backend en cours d'exécution sur le port ${port}`)
})
