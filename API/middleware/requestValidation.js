const mongoose = require('mongoose')

const isPlainObject = value =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const sendValidationError = (res, message) => res.status(400).json({ error: message })

const requireNonEmptyBody = (message = 'Corps de requête invalide.') => (req, res, next) => {
  if (!isPlainObject(req.body) || Object.keys(req.body).length === 0) {
    return sendValidationError(res, message)
  }

  return next()
}

const requireArrayBody = (message = 'Le corps de la requête doit être un tableau.') => (
  req,
  res,
  next
) => {
  if (!Array.isArray(req.body) || req.body.length === 0) {
    return sendValidationError(res, message)
  }

  return next()
}

const requireYearParam = paramName => (req, res, next) => {
  const rawYear = String(req.params[paramName] || '').trim()
  const year = Number.parseInt(rawYear, 10)

  if (!Number.isInteger(year) || String(year) !== rawYear) {
    return sendValidationError(res, 'Année invalide.')
  }

  req.validatedParams = req.validatedParams || {}
  req.validatedParams[paramName] = year
  return next()
}

const requireObjectIdParam = (paramName, label = paramName) => (req, res, next) => {
  const value = req.params[paramName]

  if (!mongoose.Types.ObjectId.isValid(value)) {
    return sendValidationError(res, `${label} invalide.`)
  }

  return next()
}

const requireAllowedParam = (paramName, allowedValues, message = 'Valeur invalide.') => (
  req,
  res,
  next
) => {
  if (!allowedValues.includes(req.params[paramName])) {
    return sendValidationError(res, message)
  }

  return next()
}

const requireBodyFields = (fields, message = 'Données de requête invalides.') => (
  req,
  res,
  next
) => {
  if (!isPlainObject(req.body)) {
    return sendValidationError(res, message)
  }

  for (const field of fields) {
    if (!(field in req.body)) {
      return sendValidationError(res, message)
    }
  }

  return next()
}

const requireStringBodyFields = (fields, message = 'Données de requête invalides.') => (
  req,
  res,
  next
) => {
  if (!isPlainObject(req.body)) {
    return sendValidationError(res, message)
  }

  for (const field of fields) {
    const value = req.body[field]

    if (typeof value !== 'string' || value.trim().length === 0) {
      return sendValidationError(res, message)
    }
  }

  return next()
}

module.exports = {
  requireAllowedParam,
  requireArrayBody,
  requireBodyFields,
  requireNonEmptyBody,
  requireObjectIdParam,
  requireStringBodyFields,
  requireYearParam
}
