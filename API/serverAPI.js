//#region : dépendances
const { rootDir } = require('./config/loadEnv')
const fs = require('fs')
const express = require('express')
const cors = require('cors')

const { connectToDatabase } = require('./config/dbConfig')
// const bodyParser = require('body-parser')
// const nodemailer = require('nodemailer')
// const { is } = require('date-fns/locale')

const path = require('path')
const app = express()
//#endregion

//#region : models
const { Evaluation, TpiEvalCollection } = require('./models/tpiEvalModel')

const TpiModelsYear = require('./models/tpiModels')
const {
  createCustomTpiRoomModel,
  tpiRoomSchema
} = require('./models/tpiRoomsModels')
const {
  listPublishedSoutenances,
  updatePublishedSoutenanceOffersByLegacyId
} = require('./services/publishedSoutenanceService')

const { assertProductionAuthSafety } = require('./middleware/appAuth')
const {
  requireAllowedParam,
  requireNonEmptyBody,
  requireYearParam
} = require('./middleware/requestValidation')
const { createCorsOptions, createRateLimiter } = require('./middleware/security')

// Import des routes
const legacyAuthRoutes = require('./routes/legacyAuthRoutes')
const legacyUsersRoutes = require('./routes/legacyUsersRoutes')
const legacyAdminRoutes = require('./routes/legacyAdminRoutes')
const legacyExpertsRoutes = require('./routes/legacyExpertsRoutes')
const legacySoutenanceRoutes = require('./routes/legacySoutenanceRoutes') // Backward compatibility for legacy tokens
const magicLinkRoutes = require('./routes/magicLinkRoutes')
const planningRoutes = require('./routes/planningRoutes')
const workflowRoutes = require('./routes/workflowRoutes')
const importRoutes = require('./routes/importRoutes')

// Constante pour vérifier si l'application est en mode démo
const isDemo = process.env.NODE_ENV !== 'production' && process.env.REACT_APP_DEBUG === 'true'

assertProductionAuthSafety()

// Port utilisé par l'application : PORT (prioritaire) puis 5000/6000 selon debug
const port = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : (isDemo ? 5000 : 6000)

//#region : API
app.use(cors(createCorsOptions()))
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '10mb' }))

const globalApiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number.parseInt(process.env.API_RATE_LIMIT_MAX || '300', 10),
  message: 'Trop de requêtes, réessayez plus tard.'
})

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
  message: 'Trop de tentatives de connexion, réessayez plus tard.'
})

app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next()
  }

  return globalApiLimiter(req, res, next)
})
app.use('/api/auth', authLimiter)

// Legacy auth & admin routes
app.use('/api/auth', legacyAuthRoutes)
app.use('/api', legacyUsersRoutes)
app.use('/api', legacyAdminRoutes)
app.use('/api', legacyExpertsRoutes)

// Auth via magic links (v2)
app.use('/api/magic-link', magicLinkRoutes)

// Soutenances (backward compatible with legacy tokens + new magic links)
app.use('/api', legacySoutenanceRoutes)

// Planning workflow (modern system)
app.use('/api/planning', planningRoutes)
app.use('/api/workflow', workflowRoutes)
app.use('/api/import', importRoutes)

app.get('/', (req, res) => {
  res.send(`App is Working\nport: ${port}\nthis version is demo: ${isDemo}`)
})

// Configurer Nodemailer avec vos paramètres d'envoi d'email
app.post('/api/send-email', async (req, res) => {
  const { email, url } = req.body
  // Logique pour envoyer l'email avec Nodemailer
  // ...
})

// Définir un endpoint pour récupérer le contenu d'un fichier PDF
app.get('/api/get-pdf', async (req, res) => {
  try {
    const configuredPdfPath = process.env.TPI_EVAL_PDF_PATH || './models/mEvalV3.pdf'
    const pdfFilePath = path.isAbsolute(configuredPdfPath)
      ? configuredPdfPath
      : path.resolve(rootDir, configuredPdfPath)

    // Vérifier si le chemin contient bien un fichier PDF
    if (!pdfFilePath.toLowerCase().endsWith('.pdf')) {
      console.error('Le chemin spécifié ne pointe pas vers un fichier PDF')
      return res
        .status(400)
        .send('Le chemin spécifié ne pointe pas vers un fichier PDF')
    }

    // Lire le contenu du fichier PDF de manière asynchrone
    const pdfData = await fs.promises.readFile(pdfFilePath)

    // Envoyer le contenu du fichier PDF en tant que réponse
    res.setHeader('Content-Type', 'application/pdf')
    res.send(pdfData)
  } catch (error) {
    console.error('Erreur lors de la récupération du fichier PDF:', error)
    res.status(500).send('Erreur lors de la récupération du fichier PDF')
  }
})

// routes pour les évaluations (tpiEval)

// Route POST pour sauvegarder une nouvelle évaluation
app.post('/save-tpiEval', requireNonEmptyBody("Données d'évaluation requises."), async (req, res) => {
  try {
    // Extraire les données de la requête
    const evaluationData = req.body

    if (!evaluationData.year) {
      return res.status(400).json({ message: 'Année requise.' })
    }

    // Vérifier si la collection pour l'année donnée existe déjà
    let evalCollection = await TpiEvalCollection.findOne({
      year: evaluationData.year
    })

    // Si la collection n'existe pas, la créer
    if (!evalCollection) {
      // Utiliser evaluationData.year pour définir l'année
      evalCollection = new TpiEvalCollection({ year: evaluationData.year })
    }

    // Créer une nouvelle instance d'évaluation avec les données reçues
    const newEvaluation = new Evaluation(evaluationData)

    // Sauvegarder la nouvelle évaluation dans la base de données
    const savedEvaluation = await newEvaluation.save()

    // Ajouter l'identifiant de la nouvelle évaluation à la collection d'évaluations de l'année correspondante
    evalCollection.evaluations.push(savedEvaluation._id)
    await evalCollection.save()

    // Envoyer la nouvelle évaluation sauvegardée en tant que réponse
    res.status(201).json(savedEvaluation)
  } catch (error) {
    // En cas d'erreur, envoyer un code d'état 500 (Internal Server Error) avec le message d'erreur
    res.status(500).json({ message: error.message })
  }
})

// Route GET pour récupérer la collection d'évaluations pour une année donnée
app.get('/load-tpiEvals/:year', requireYearParam('year'), async (req, res) => {
  try {
    // Extraire l'année de la requête
    const { year } = req.validatedParams

    // Trouver la collection d'évaluations pour l'année spécifiée
    const evalCollection = await TpiEvalCollection.findOne({ year }).populate(
      'evaluations'
    )

    // Vérifier si la collection existe
    if (!evalCollection) {
      return res.status(404).json({
        message: "Aucune collection d'évaluations trouvée pour cette année."
      })
    }

    // Récupérer les évaluations associées à cette collection
    const evaluations = evalCollection.evaluations

    // Envoyer les évaluations récupérées en tant que réponse
    res.status(200).json(evaluations)
  } catch (error) {
    // En cas d'erreur, envoyer un code d'état 500 (Internal Server Error) avec le message d'erreur
    res.status(500).json({ message: error.message })
  }
})

// Route GET pour récupérer les années des collections d'évaluations disponibles
app.get('/available-years', async (req, res) => {
  try {
    // Récupérer les années des collections d'évaluations existantes dans la base de données
    const availableYears = await TpiEvalCollection.distinct('year')

    // Envoyer les années disponibles en tant que réponse
    res.status(200).json(availableYears)
  } catch (error) {
    // En cas d'erreur, envoyer un code d'état 500 (Internal Server Error) avec le message d'erreur
    res.status(500).json({ message: error.message })
  }
})

//#endregion

// Create a collection from 'planification' during publication
// for display purposes and validation by concerned parties
app.get('/api/tpiyear/:year', requireYearParam('year'), async (req, res) => {
  const year = req.validatedParams.year

  try {
    const rooms = await listPublishedSoutenances(year)

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
app.get('/api/tpiRoomYear/:year', requireYearParam('year'), async (req, res) => {
  const year = req.validatedParams.year
  const collectionName = `tpiRooms_${year}`

  try {
    // Utilisez la fonction de création de modèle personnalisé
    const DataRooms = createCustomTpiRoomModel(collectionName)

    const rooms = await DataRooms.find()
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
app.put(
  '/api/tpiyear/:year/:id/:tpiRef/:expertOrBoss',
  requireYearParam('year'),
  requireAllowedParam('expertOrBoss', ['expert1', 'expert2', 'boss'], 'Rôle invalide.'),
  requireNonEmptyBody('Données d\'offres requises.'),
  async (req, res) => {
  const year = req.validatedParams.year
  const indexes = extraireIndexes(req.params.tpiRef)
  const expertOrBoss = req.params.expertOrBoss

  try {
    if (!indexes) {
      return res.status(400).json({ error: 'Référence TPI invalide.' })
    }

    // Récupérez les données de soutenance à partir de l'API
    const collectionName = `tpiSoutenance_${year}`
    const DataRooms = createCustomTpiRoomModel(collectionName)
    const soutenanceData = await DataRooms.find()

    // Assurez-vous que les index sont valides
    if (indexes.salle >= 0 && indexes.tpi >= 0 && indexes.salle < soutenanceData.length) {
      // Identifiez l'objet tpiDatas spécifique dans la liste
      const specificTpiDatas =
        soutenanceData[indexes.salle].tpiDatas[indexes.tpi]

      // Assurez-vous que tpiDatas est un objet
      if (
        typeof specificTpiDatas === 'object' &&
        !Array.isArray(specificTpiDatas)
      ) {
        // Mise à jour du document dans la base de données
        const updateQuery = {}
        updateQuery[`tpiDatas.${indexes.tpi}.${expertOrBoss}.offres`] =
          req.body.offres

        await DataRooms.updateOne(
          {
            _id: soutenanceData[indexes.salle]._id,
            [`tpiDatas.${indexes.tpi}.${expertOrBoss}`]: { $exists: true }
          },
          { $set: updateQuery }
        )

        // Vérifier si un document a été effectivement mis à jour

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
  }
)

app.put(
  '/api/save-propositions/:year/:expertOrBoss/:tpi_indexes/:tpi_id',
  requireYearParam('year'),
  requireAllowedParam('expertOrBoss', ['expert1', 'expert2', 'boss'], 'Rôle invalide.'),
  requireNonEmptyBody('Données de proposition requises.'),
  async (req, res) => {
    const { expertOrBoss, tpi_indexes } = req.params
    const year = req.validatedParams.year
    const propositionsData = req.body

    try {
      const result = await updatePublishedSoutenanceOffersByLegacyId(
        year,
        tpi_indexes,
        expertOrBoss,
        propositionsData
      )

      if (!result) {
        return res.status(404).json({ error: 'Document TPI non trouvé' })
      }
      res.status(200).json({
        message: 'Document TPI mis à jour avec succès',
        updatedDocument: result.room
      })
    } catch (error) {
      console.error('Erreur lors de la mise à jour du document TPI :', error)
      res
        .status(500)
        .json({ error: 'Erreur lors de la mise à jour du document TPI' })
    }
  }
)

function startServer(options = {}) {
  const { connectDb = true } = options

  if (connectDb) {
    void connectToDatabase()
  }

  return app.listen(port, () => {
    console.log(`Backend server is running on port ${port}`)
  })
}

if (require.main === module) {
  startServer({ connectDb: true })
}

// // Fonction utilitaire pour afficher les routes
// function listRoutes () {
//   app._router.stack.forEach(middleware => {
//     if (middleware.route) {
//       middleware.route contient les informations sur la route
//       console.log(
//         `${Object.keys(middleware.route.methods).join(', ')} -> ${
//           middleware.route.path
//         }`
//       )
//     }
//   })
// }

// // Utilisation de la fonction pour lister les routes
// listRoutes()

module.exports = {
  app,
  startServer
}
