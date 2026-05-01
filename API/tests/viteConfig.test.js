const assert = require('node:assert/strict')
const test = require('node:test')

const { getManualChunkName } = require('../../vite.config.js')

test('manualChunks keeps React runtime in react-vendor on POSIX and Windows paths', () => {
  assert.equal(
    getManualChunkName('/repo/node_modules/react/jsx-runtime.js'),
    'react-vendor'
  )
  assert.equal(
    getManualChunkName('X:\\repo\\node_modules\\react-dom\\client.js'),
    'react-vendor'
  )
  assert.equal(
    getManualChunkName('/repo/node_modules/scheduler/index.js'),
    'react-vendor'
  )
})

test('manualChunks leaves route-only heavy dependencies with their lazy routes', () => {
  assert.equal(
    getManualChunkName('/repo/node_modules/react-dnd/dist/index.js'),
    undefined
  )
  assert.equal(
    getManualChunkName('/repo/node_modules/@react-dnd/invariant/dist/index.js'),
    undefined
  )
  assert.equal(
    getManualChunkName('/repo/node_modules/jspdf/dist/jspdf.es.min.js'),
    undefined
  )
  assert.equal(
    getManualChunkName('/repo/node_modules/core-js/internals/global-this.js'),
    undefined
  )
  assert.equal(
    getManualChunkName('X:\\repo\\node_modules\\html2canvas\\dist\\html2canvas.js'),
    undefined
  )
})

test('manualChunks keeps pdf-lib shared between lazy PDF routes', () => {
  assert.equal(
    getManualChunkName('/repo/node_modules/pdf-lib/es/index.js'),
    'pdf-lib-vendor'
  )
  assert.equal(
    getManualChunkName('/repo/node_modules/@pdf-lib/standard-fonts/es/index.js'),
    'pdf-lib-vendor'
  )
})

test('manualChunks isolates reusable parser dependencies', () => {
  assert.equal(
    getManualChunkName('/repo/node_modules/papaparse/papaparse.js'),
    'csv-vendor'
  )
})

test('manualChunks leaves app modules outside vendor chunks', () => {
  assert.equal(
    getManualChunkName('/repo/src/components/Home.jsx'),
    undefined
  )
})
