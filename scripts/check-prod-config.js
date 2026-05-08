const emailService = require('../API/services/emailService')

const requiredSecrets = ['AUTH_SESSION_SECRET', 'JWT_SECRET']
const requiredSmtpVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']

function validateProductionConfig(env = process.env, services = {}) {
  const mail = services.emailService || emailService
  const errors = []
  const warnings = []

  const pushError = message => {
    errors.push(message)
  }

  const pushWarning = message => {
    warnings.push(message)
  }

  if (env.NODE_ENV !== 'production') {
    pushError('NODE_ENV doit être fixé à "production"')
  }

  if (env.SKIP_APP_AUTH === 'true') {
    pushError('SKIP_APP_AUTH ne doit jamais être "true" en production')
  }

  if (env.REACT_APP_DEBUG === 'true') {
    pushError('REACT_APP_DEBUG ne doit jamais être "true" en production')
  }

  if (env.AUTH_USER_PLAIN || env.AUTH_PASS_PLAIN) {
    pushError('AUTH_USER_PLAIN/AUTH_PASS_PLAIN ne doivent pas être utilisés en production')
  }

  if (!env.AUTH_USER_HASH || !env.AUTH_PASS_HASH) {
    pushError('AUTH_USER_HASH et AUTH_PASS_HASH sont requis en production')
  }

  if (!requiredSecrets.some(key => Boolean(env[key]))) {
    pushError('AUTH_SESSION_SECRET ou JWT_SECRET est requis en production')
  }

  const secret = env.AUTH_SESSION_SECRET || env.JWT_SECRET || ''

  if (secret && secret.length < 64) {
    pushError('AUTH_SESSION_SECRET/JWT_SECRET doit faire au moins 64 caractères')
  }

  const hasDbUri = Boolean(env.DB_URI)
  const hasDbClusterConfig = ['DB_CLUSTER', 'DB_NAME', 'DB_USERNAME', 'DB_PASSWORD'].every(
    key => Boolean(env[key])
  )

  if (!hasDbUri && !hasDbClusterConfig) {
    pushError('DB_URI ou DB_CLUSTER/DB_NAME/DB_USERNAME/DB_PASSWORD est requis en production')
  }

  for (const key of requiredSmtpVars) {
    if (!env[key]) {
      pushError(`${key} est requis en production`)
    }
  }

  const smtpFromEmail = mail.extractEmailAddress(env.SMTP_FROM)

  if (env.SMTP_FROM && !smtpFromEmail) {
    pushError('SMTP_FROM doit contenir une adresse email valide, par exemple "TPI 2026 <notifications@example.ch>"')
  }

  if (env.SMTP_ENVELOPE_FROM && !mail.extractEmailAddress(env.SMTP_ENVELOPE_FROM)) {
    pushError('SMTP_ENVELOPE_FROM doit contenir une adresse email valide si elle est définie')
  }

  const hasDkimSetting = Boolean(
    env.SMTP_DKIM_DOMAIN ||
    env.SMTP_DKIM_SELECTOR ||
    env.SMTP_DKIM_PRIVATE_KEY
  )
  const hasDkimDomain = Boolean(env.SMTP_DKIM_DOMAIN || mail.getEmailDomain(env.SMTP_FROM))

  if (hasDkimSetting && (!hasDkimDomain || !env.SMTP_DKIM_SELECTOR || !env.SMTP_DKIM_PRIVATE_KEY)) {
    pushError('SMTP_DKIM_DOMAIN/SMTP_DKIM_SELECTOR/SMTP_DKIM_PRIVATE_KEY doivent être complets pour signer DKIM côté application')
  }

  if (!hasDkimSetting) {
    pushWarning('Vérifier que le fournisseur SMTP signe bien les emails en DKIM et que SPF/DMARC sont configurés sur le domaine de SMTP_FROM')
  }

  if (!env.CORS_ORIGIN) {
    pushError('CORS_ORIGIN doit être défini en production')
  } else if (env.CORS_ORIGIN.includes('*')) {
    pushError('CORS_ORIGIN ne doit pas utiliser * en production')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

function printValidationReport(report, logger = console) {
  if (!report.valid) {
    logger.error('Configuration de production invalide:')
    for (const error of report.errors) {
      logger.error(`- ${error}`)
    }
  }

  for (const warning of report.warnings) {
    logger.warn(`Avertissement: ${warning}`)
  }

  if (report.valid) {
    logger.log('Configuration de production valide.')
  }
}

function main(env = process.env, logger = console) {
  const report = validateProductionConfig(env)
  printValidationReport(report, logger)

  if (!report.valid) {
    process.exitCode = 1
  }

  return report
}

if (require.main === module) {
  main()
}

module.exports = {
  requiredSecrets,
  requiredSmtpVars,
  main,
  printValidationReport,
  validateProductionConfig
}
