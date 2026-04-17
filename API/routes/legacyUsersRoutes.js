const express = require('express')

const User = require('../models/userModels')
const { requireAppAuth } = require('../middleware/appAuth')
const {
  requireNonEmptyBody,
  requireObjectIdParam
} = require('../middleware/requestValidation')

const router = express.Router()

router.post('/inscription', requireAppAuth, requireNonEmptyBody('Données utilisateur requises.'), async (req, res) => {
  try {
    const user = new User(req.body)
    const savedUser = await user.save()
    res.status(201).json(savedUser)
  } catch (error) {
    console.error("Erreur lors de l'inscription de l'utilisateur :", error)
    res.status(error?.name === 'ValidationError' ? 400 : 500).json({
      error:
        error?.name === 'ValidationError'
          ? error.message
          : "Erreur lors de l'inscription de l'utilisateur"
    })
  }
})

router.get('/suivi-etudiants', requireAppAuth, async (req, res) => {
  try {
    const users = await User.find()
    res.json(users)
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs :', error)
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' })
  }
})

router.put(
  '/suivi-etudiants/:id',
  requireAppAuth,
  requireObjectIdParam('id', 'Identifiant utilisateur'),
  requireNonEmptyBody('Données de mise à jour requises.'),
  async (req, res) => {
    try {
      const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
      })

      if (!updatedUser) {
        return res.status(404).json({ error: 'Utilisateur introuvable' })
      }

      return res.json(updatedUser)
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'utilisateur :", error)
      return res.status(error?.name === 'ValidationError' ? 400 : 500).json({
        error:
          error?.name === 'ValidationError'
            ? error.message
            : "Erreur lors de la mise à jour de l'utilisateur"
      })
    }
  }
)

router.delete(
  '/suivi-etudiants/:id',
  requireAppAuth,
  requireObjectIdParam('id', 'Identifiant utilisateur'),
  async (req, res) => {
    try {
      const deletedUser = await User.findByIdAndDelete(req.params.id)

      if (!deletedUser) {
        return res.status(404).json({ error: 'Utilisateur introuvable' })
      }

      return res.json({ message: 'Utilisateur supprimé avec succès' })
    } catch (error) {
      console.error("Erreur lors de la suppression de l'utilisateur :", error)
      return res.status(500).json({ error: "Erreur lors de la suppression de l'utilisateur" })
    }
  }
)

module.exports = router
