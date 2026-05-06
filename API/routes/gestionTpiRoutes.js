const express = require('express')

const { requireAppAuth } = require('../middleware/appAuth')
const {
  requireNonEmptyBody,
  requireObjectIdParam,
  requireYearParam
} = require('../middleware/requestValidation')
const {
  GestionTpiError,
  deleteGestionTpiYear,
  findGestionTpisByCandidate,
  listGestionTpis,
  saveGestionTpi,
  updateGestionTpi
} = require('../modules/gestionTpi/catalogService')

const router = express.Router()

function sendGestionTpiError(res, error, fallbackMessage) {
  if (error instanceof GestionTpiError || error?.statusCode) {
    return res.status(error.statusCode || 400).json({
      error: error.message,
      details: error.details || {}
    })
  }

  console.error(fallbackMessage, error)
  return res.status(500).json({ error: fallbackMessage })
}

async function listTpisHandler(req, res) {
  try {
    const year = req.validatedParams?.year || req.query.year
    const tpis = await listGestionTpis(year)
    return res.json(tpis)
  } catch (error) {
    return sendGestionTpiError(res, error, 'Error retrieving TPI models')
  }
}

async function saveTpiHandler(req, res) {
  try {
    const savedTpi = await saveGestionTpi(req.validatedParams.year, req.body)
    return res.json(savedTpi)
  } catch (error) {
    return sendGestionTpiError(res, error, 'Error saving TPI model')
  }
}

async function updateTpiHandler(req, res) {
  try {
    const updatedTpi = await updateGestionTpi(
      req.validatedParams.year,
      req.validatedParams.id,
      req.body
    )

    return res.json(updatedTpi)
  } catch (error) {
    return sendGestionTpiError(res, error, 'Erreur lors de la mise à jour du TPI.')
  }
}

async function findByCandidateHandler(req, res) {
  try {
    const tpis = await findGestionTpisByCandidate(
      req.validatedParams.year,
      req.params.candidateName
    )

    return res.json(tpis)
  } catch (error) {
    return sendGestionTpiError(res, error, 'Error retrieving TPI models by candidate')
  }
}

async function deleteYearHandler(req, res) {
  if (req.body?.confirm !== true) {
    return res.status(400).json({ error: 'Confirmation requise.' })
  }

  try {
    const result = await deleteGestionTpiYear(req.validatedParams.year)

    return res.json({
      message: `Les TPI de l'année ${result.year} ont été supprimés.`,
      year: result.year,
      deletedCount: result.deletedCount
    })
  } catch (error) {
    return sendGestionTpiError(res, error, 'Erreur lors de la suppression des TPI.')
  }
}

router.get(
  '/gestion-tpi/:year/tpis',
  requireAppAuth,
  requireYearParam('year'),
  listTpisHandler
)

router.post(
  '/gestion-tpi/:year/tpis',
  requireAppAuth,
  requireYearParam('year'),
  requireNonEmptyBody('Données TPI requises.'),
  saveTpiHandler
)

router.put(
  '/gestion-tpi/:year/tpis/:id',
  requireAppAuth,
  requireYearParam('year'),
  requireObjectIdParam('id', 'Identifiant TPI'),
  requireNonEmptyBody('Données de mise à jour requises.'),
  updateTpiHandler
)

router.get(
  '/gestion-tpi/:year/by-candidate/:candidateName',
  requireAppAuth,
  requireYearParam('year'),
  findByCandidateHandler
)

router.post(
  '/gestion-tpi/:year/delete',
  requireAppAuth,
  requireYearParam('year'),
  requireNonEmptyBody('Confirmation requise.'),
  deleteYearHandler
)

module.exports = router
