const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

const rootDir = path.resolve(__dirname, '..', '..')
const apiDir = path.resolve(__dirname, '..')
const isProduction = process.env.NODE_ENV === 'production'
const preferredEnvFiles = isProduction
  ? ['.env.production.local', '.env.production']
  : ['.env.local', '.env']
const envFilePaths = [
  ...preferredEnvFiles.map(fileName => path.join(rootDir, fileName)),
  ...preferredEnvFiles.map(fileName => path.join(apiDir, fileName))
]

for (const filePath of envFilePaths) {
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override: false, quiet: true })
  }
}

module.exports = {
  rootDir,
  preferredEnvFiles,
  envFilePaths
}
