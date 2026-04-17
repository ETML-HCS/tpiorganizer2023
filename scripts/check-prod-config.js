const requiredSecrets = ['AUTH_SESSION_SECRET', 'JWT_SECRET']
const requiredSmtpVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']

const errors = []

const pushError = message => {
  errors.push(message)
}

if (process.env.NODE_ENV !== 'production') {
  pushError('NODE_ENV doit être fixé à "production"')
}

if (process.env.SKIP_APP_AUTH === 'true') {
  pushError('SKIP_APP_AUTH ne doit jamais être "true" en production')
}

if (process.env.REACT_APP_DEBUG === 'true') {
  pushError('REACT_APP_DEBUG ne doit jamais être "true" en production')
}

if (process.env.AUTH_USER_PLAIN || process.env.AUTH_PASS_PLAIN) {
  pushError('AUTH_USER_PLAIN/AUTH_PASS_PLAIN ne doivent pas être utilisés en production')
}

if (!process.env.AUTH_USER_HASH || !process.env.AUTH_PASS_HASH) {
  pushError('AUTH_USER_HASH et AUTH_PASS_HASH sont requis en production')
}

if (!requiredSecrets.some(key => Boolean(process.env[key]))) {
  pushError('AUTH_SESSION_SECRET ou JWT_SECRET est requis en production')
}

const secret = process.env.AUTH_SESSION_SECRET || process.env.JWT_SECRET || ''

if (secret && secret.length < 64) {
  pushError('AUTH_SESSION_SECRET/JWT_SECRET doit faire au moins 64 caractères')
}

const hasDbUri = Boolean(process.env.DB_URI)
const hasDbClusterConfig = ['DB_CLUSTER', 'DB_NAME', 'DB_USERNAME', 'DB_PASSWORD'].every(
  key => Boolean(process.env[key])
)

if (!hasDbUri && !hasDbClusterConfig) {
  pushError('DB_URI ou DB_CLUSTER/DB_NAME/DB_USERNAME/DB_PASSWORD est requis en production')
}

for (const key of requiredSmtpVars) {
  if (!process.env[key]) {
    pushError(`${key} est requis en production`)
  }
}

if (!process.env.CORS_ORIGIN) {
  pushError('CORS_ORIGIN doit être défini en production')
} else if (process.env.CORS_ORIGIN.includes('*')) {
  pushError('CORS_ORIGIN ne doit pas utiliser * en production')
}

if (errors.length > 0) {
  console.error('Configuration de production invalide:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exitCode = 1
} else {
  console.log('Configuration de production valide.')
}
