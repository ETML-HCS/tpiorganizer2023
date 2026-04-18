const express = require('express')

const { requireAppAuth } = require('../middleware/appAuth')
const { requireYearParam } = require('../middleware/requestValidation')
const tpiDossierService = require('../services/tpiDossierService')

const router = express.Router()

router.get('/tpi-dossier/:year/:ref', requireAppAuth, requireYearParam('year'), async (req, res) => {
  const ref = typeof req.params.ref === 'string'
    ? req.params.ref.trim()
    : ''

  if (!ref) {
    return res.status(400).json({ error: 'Référence TPI requise.' })
  }

  try {
    const dossier = await tpiDossierService.getTpiDossierByRef(req.validatedParams.year, ref)

    if (!dossier) {
      return res.status(404).json({ error: 'TPI introuvable.' })
    }

    return res.json(dossier)
  } catch (error) {
    console.error('Erreur lors de la récupération du dossier TPI :', error)
    return res.status(500).json({ error: 'Erreur lors de la récupération du dossier TPI.' })
  }
})

module.exports = router
