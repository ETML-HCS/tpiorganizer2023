const express = require('express')

const Person = require('../models/personModel')
const TpiExperts = require('../models/tpiExpertsModel')
const { requireAppAuth } = require('../middleware/appAuth')
const { requireArrayBody } = require('../middleware/requestValidation')
const {
  resolveUniquePersonForRole
} = require('../services/personRegistryService')

const router = express.Router()

const ERROR_MESSAGES = {
  MISSING_TOKEN: 'Token manquant dans la requête.',
  EXPERT_NOT_FOUND: 'Aucun expert trouvé avec ce token.',
  INTERNAL_ERROR: "Erreur interne lors de la récupération du nom de l'expert."
}

function findEncadrantByName(bossName) {
  return TpiExperts.findOne({ boss: bossName }).exec()
}

router.get('/makeToken/:bossName', (req, res) => {
  const bossName = req.params.bossName

  findEncadrantByName(bossName)
    .then(encadrant => {
      if (encadrant) {
        res.json(encadrant)
      } else {
        res.status(404).send('Encadrant non trouvé')
      }
    })
    .catch(error => {
      res.status(500).send('Erreur du serveur')
      console.error(error)
    })
})

router.get('/experts/emails', requireAppAuth, async (req, res) => {
  try {
    const experts = await TpiExperts.find({}, 'email name')

    res.json(
      experts.map(expert => ({
        email: expert.email,
        name: expert.name
      }))
    )
  } catch (error) {
    console.error('Erreur lors de la récupération des données des experts :', error)
    res.status(500).send('Erreur lors de la récupération des données des experts')
  }
})

router.get('/experts/listExpertsOrBoss', async (req, res) => {
  try {
    const list = await TpiExperts.find()
    res.json(list)
  } catch (error) {
    console.error('Erreur lors de la récupération des emails :', error)
    res.status(500).send('Erreur lors de la récupération des emails')
  }
})

router.get('/expert/:name', async (req, res) => {
  try {
    const requestedName = typeof req.params.name === 'string'
      ? req.params.name.trim()
      : ''

    if (!requestedName) {
      return res.status(404).json({ message: 'Expert not found' })
    }

    const people = await Person.find({ isActive: true })
      .select('firstName lastName email phone roles site entreprise')
      .lean()

    const resolvedPerson = resolveUniquePersonForRole(requestedName, people, 'expert').person

    if (resolvedPerson) {
      const name = [resolvedPerson.firstName, resolvedPerson.lastName].filter(Boolean).join(' ').trim()

      return res.status(200).json({
        expert: {
          _id: resolvedPerson._id,
          name,
          email: resolvedPerson.email,
          phone: resolvedPerson.phone || '',
          roles: resolvedPerson.roles || [],
          site: resolvedPerson.site || '',
          entreprise: resolvedPerson.entreprise || ''
        }
      })
    }

    const expert = await TpiExperts.findOne({
      name: new RegExp(`^${requestedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    })

    if (!expert) {
      return res.status(404).json({ message: 'Expert not found' })
    }

    return res.status(200).json({ expert })
  } catch (error) {
    console.error('Error:', error)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
})

router.get('/experts/getNameByToken', async (req, res) => {
  try {
    const token = req.query.token

    if (!token) {
      return res.status(400).json({ error: ERROR_MESSAGES.MISSING_TOKEN })
    }

    const expert = await TpiExperts.findOne({ token })

    if (!expert) {
      return res.status(404).json({ error: ERROR_MESSAGES.EXPERT_NOT_FOUND })
    }

    return res.json({ name: expert.name })
  } catch (error) {
    console.error("Erreur lors de la récupération du nom de l'expert :", error)
    return res.status(500).send(ERROR_MESSAGES.INTERNAL_ERROR)
  }
})

router.put(
  '/experts/putTokens',
  requireAppAuth,
  requireArrayBody("Le format des données envoyées n'est pas valide"),
  async (req, res) => {
  try {
    const updates = req.body

    for (const update of updates) {
      const updateData = { token: update.token }

      if (update.token) {
        updateData.date = new Date()
      }

      await TpiExperts.updateOne({ email: update.email }, { $set: updateData })
    }

    return res.send('Tokens mis à jour avec succès')
  } catch (error) {
    console.error('Erreur lors de la mise à jour des tokens:', error)
    return res.status(500).send('Erreur interne du serveur')
  }
})

module.exports = router
