const express = require('express')

const { authenticateAdmin, createAppSessionToken } = require('../middleware/appAuth')
const {
  requireNonEmptyBody,
  requireStringBodyFields
} = require('../middleware/requestValidation')

const router = express.Router()

router.get('/session', (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'Session application active',
      token: createAppSessionToken('admin')
    })
  } catch (error) {
    console.error('Erreur lors du demarrage de la session:', error)
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    })
  }
})

router.post(
  '/login',
  requireNonEmptyBody('Nom d\'utilisateur et mot de passe requis'),
  requireStringBodyFields(['username', 'password'], 'Nom d\'utilisateur et mot de passe requis'),
  async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nom d\'utilisateur et mot de passe requis'
      })
    }

    const result = await authenticateAdmin(username, password)

    if (!result) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants incorrects'
      })
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('Erreur lors de l\'authentification:', error)
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    })
  }
})

module.exports = router
