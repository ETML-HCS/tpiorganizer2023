const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

const rootDir = path.resolve(__dirname, '..', '..')
const isProduction = process.env.NODE_ENV === 'production'
const preferredEnvFiles = isProduction
  ? ['.env.production.local', '.env.production']
  : ['.env.local', '.env']

for (const fileName of preferredEnvFiles) {
  const filePath = path.join(rootDir, fileName)

  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override: false })
  }
}

module.exports = {
  rootDir,
  preferredEnvFiles
}
