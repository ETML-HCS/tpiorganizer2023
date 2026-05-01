const { defineConfig, loadEnv } = require('vite')
const react = require('@vitejs/plugin-react')

const normalizeModuleId = (id = '') => String(id).replace(/\\/g, '/')

const getNodePackageName = (normalizedId) => {
  const match = normalizedId.match(/\/node_modules\/((?:@[^/]+\/)?[^/]+)/)
  return match?.[1] || ''
}

const isNodePackage = (normalizedId, packageName) => {
  return getNodePackageName(normalizedId) === packageName
}

const isPdfLibPackage = (packageName) =>
  packageName === 'pdf-lib' ||
  packageName === 'tslib' ||
  packageName.startsWith('@pdf-lib/')

const lazyRouteDependencyPackages = new Set([
  '@babel/runtime',
  'canvg',
  'core-js',
  'dnd-core',
  'dompurify',
  'fast-deep-equal',
  'fflate',
  'html2canvas',
  'jspdf',
  'pako',
  'performance-now',
  'raf',
  'react-dnd',
  'react-dnd-html5-backend',
  'redux',
  'rgbcolor',
  'stackblur-canvas',
  'svg-pathdata'
])

const isLazyRouteDependencyPackage = (packageName) =>
  lazyRouteDependencyPackages.has(packageName) ||
  packageName.startsWith('@react-dnd/')

const getManualChunkName = (id) => {
  const normalizedId = normalizeModuleId(id)
  const packageName = getNodePackageName(normalizedId)

  if (!packageName) {
    return undefined
  }

  if (
    isNodePackage(normalizedId, 'react') ||
    isNodePackage(normalizedId, 'react-dom') ||
    isNodePackage(normalizedId, 'scheduler')
  ) {
    return 'react-vendor'
  }

  if (
    isNodePackage(normalizedId, 'react-router') ||
    isNodePackage(normalizedId, 'react-router-dom')
  ) {
    return 'router-vendor'
  }

  if (isNodePackage(normalizedId, 'react-toastify')) {
    return 'toastify-vendor'
  }

  if (isNodePackage(normalizedId, 'papaparse')) {
    return 'csv-vendor'
  }

  if (isPdfLibPackage(packageName)) {
    return 'pdf-lib-vendor'
  }

  if (isLazyRouteDependencyPackage(packageName)) {
    return undefined
  }

  return 'vendor'
}

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
          manualChunks: getManualChunkName
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

module.exports.getManualChunkName = getManualChunkName
