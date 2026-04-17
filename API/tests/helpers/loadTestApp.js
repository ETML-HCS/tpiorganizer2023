const path = require('path')

function clearModule(modulePath) {
  try {
    delete require.cache[require.resolve(modulePath)]
  } catch (error) {
    // Ignore cache misses during test bootstrapping.
  }
}

function loadTestApp(env = {}) {
  const originalEnv = { ...process.env }

  const applyEnv = nextEnv => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key]
    }

    Object.assign(process.env, nextEnv)
  }

  applyEnv({ ...originalEnv, ...env })

  const modulesToClear = [
    path.resolve(__dirname, '../../config/loadEnv.js'),
    path.resolve(__dirname, '../../config/dbConfig.js'),
    path.resolve(__dirname, '../../middleware/appAuth.js'),
    path.resolve(__dirname, '../../routes/legacySoutenanceRoutes.js'), // Backward compat
    path.resolve(__dirname, '../../routes/magicLinkRoutes.js'),
    path.resolve(__dirname, '../../routes/legacyAdminRoutes.js'),
    path.resolve(__dirname, '../../services/legacyPlanningBridgeService.js'),
    path.resolve(__dirname, '../../services/tpiPlanningVisibility.js'),
    path.resolve(__dirname, '../../services/workflowService.js'),
    path.resolve(__dirname, '../../services/planningValidationService.js'),
    path.resolve(__dirname, '../../services/votingCampaignService.js'),
    path.resolve(__dirname, '../../services/magicLinkV2Service.js'),
    path.resolve(__dirname, '../../services/tpiCatalogService.js'),
    path.resolve(__dirname, '../../services/planningConfigService.js'),
    path.resolve(__dirname, '../../services/planningCatalogService.js'),
    path.resolve(__dirname, '../../models/workflowYearModel.js'),
    path.resolve(__dirname, '../../models/workflowAuditEventModel.js'),
    path.resolve(__dirname, '../../models/planningSnapshotModel.js'),
    path.resolve(__dirname, '../../models/publicationVersionModel.js'),
    path.resolve(__dirname, '../../models/planningConfigModel.js'),
    path.resolve(__dirname, '../../models/planningSharedCatalogModel.js'),
    path.resolve(__dirname, '../../models/magicLinkModel.js'),
    path.resolve(__dirname, '../../services/publishedSoutenanceService.js'),
    path.resolve(__dirname, '../../routes/workflowRoutes.js'),
    path.resolve(__dirname, '../../routes/planningRoutes.js'),
    path.resolve(__dirname, '../../routes/importRoutes.js'),
    path.resolve(__dirname, '../../serverAPI.js')
  ]

  modulesToClear.forEach(clearModule)

  const serverModule = require('../../serverAPI')

  return {
    app: serverModule.app,
    restoreEnv() {
      applyEnv(originalEnv)
      modulesToClear.forEach(clearModule)
    }
  }
}

module.exports = {
  loadTestApp
}
