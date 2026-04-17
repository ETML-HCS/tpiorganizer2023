const createCorsOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production'
  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)

  return {
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true)
      }

      if (!isProduction) {
        return callback(null, true)
      }

      if (allowedOrigins.length === 0) {
        return callback(new Error('CORS_ORIGIN doit être défini en production'))
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      return callback(new Error(`Origine CORS non autorisée: ${origin}`))
    }
  }
}

const createRateLimiter = ({
  windowMs,
  max,
  message
}) => {
  const hits = new Map()

  const cleanup = () => {
    const now = Date.now()

    for (const [key, timestamps] of hits.entries()) {
      const recent = timestamps.filter(timestamp => timestamp > now - windowMs)

      if (recent.length === 0) {
        hits.delete(key)
      } else if (recent.length !== timestamps.length) {
        hits.set(key, recent)
      }
    }
  }

  const timer = setInterval(cleanup, windowMs)
  if (typeof timer.unref === 'function') {
    timer.unref()
  }

  return (req, res, next) => {
    const key = req.ip || 'unknown'
    const now = Date.now()
    const timestamps = hits.get(key) || []
    const recent = timestamps.filter(timestamp => timestamp > now - windowMs)

    if (recent.length >= max) {
      return res.status(429).json({ error: message })
    }

    recent.push(now)
    hits.set(key, recent)
    return next()
  }
}

module.exports = {
  createCorsOptions,
  createRateLimiter
}
