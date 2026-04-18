const { defineConfig, loadEnv } = require('vite')
const path = require('path')
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
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined
            }

            if (
              id.includes('react-dom') ||
              id.includes(`${path.sep}react${path.sep}`) ||
              id.includes('/react/') ||
              id.includes('\\react\\') ||
              id.includes('scheduler')
            ) {
              return 'react-vendor'
            }

            if (id.includes('react-router')) {
              return 'router-vendor'
            }

            if (id.includes('react-toastify')) {
              return 'toastify-vendor'
            }

            if (id.includes('react-dnd')) {
              return 'dnd-vendor'
            }

            if (id.includes('@fortawesome')) {
              return 'icons-vendor'
            }

            if (id.includes('pdf-lib')) {
              return 'pdf-vendor'
            }

            return 'vendor'
          }
        }
      }
    },
    server: {
      port: 3000
    },
    preview: {
      port: 4173
    }
  }
})
