const { defineConfig, loadEnv } = require('vite')
const react = require('@vitejs/plugin-react')

module.exports = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const clientEnv = Object.entries(env).reduce((accumulator, [key, value]) => {
    if (key.startsWith('REACT_APP_')) {
      accumulator[key] = value
    }

    return accumulator
  }, { NODE_ENV: mode })

  return {
    plugins: [react()],
    define: {
      'process.env': clientEnv
    },
    build: {
      outDir: 'build',
      emptyOutDir: true
    },
    server: {
      port: 3000
    },
    preview: {
      port: 4173
    }
  }
})