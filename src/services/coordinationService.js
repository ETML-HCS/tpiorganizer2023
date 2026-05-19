/**
 * Service de coordination côté client.
 * Les exports historiques en Planning restent disponibles pour compatibilité.
 */

import apiService from './apiService'
import { STORAGE_KEYS, TIMEOUTS } from '../config/appConfig'
import {
  readJSONValue,
  readStorageValue,
  removeStorageValue,
  writeJSONValue,
  writeStorageValue
} from '../utils/storage'

const COORDINATION_BASE_URL = '/api/coordination'
const WORKFLOW_BASE_URL = '/api/workflow'
const STATIC_PUBLICATION_TIMEOUT = 120000

function buildStartVotesBody(legacyRooms = null, options = {}) {
  const body = Array.isArray(legacyRooms) ? { legacyRooms } : {}

  body.skipEmails = true

  if (options.fromArbitrage === true) {
    body.fromArbitrage = true
  }

  if (options.voteLinkTarget) {
    body.voteLinkTarget = options.voteLinkTarget
  }

  if (options.votePublicUrl) {
    body.votePublicUrl = options.votePublicUrl
  }

  return body
}

function appendSoutenanceLinkOptions(body, options = {}) {
  if (options.baseUrl) {
    body.baseUrl = options.baseUrl
  }

  if (options.soutenanceLinkTarget) {
    body.soutenanceLinkTarget = options.soutenanceLinkTarget
  }

  if (options.soutenancePublicUrl) {
    body.soutenancePublicUrl = options.soutenancePublicUrl
  }

  if (options.publicationPublicUrl) {
    body.publicationPublicUrl = options.publicationPublicUrl
  }

  return body
}

/**
 * Service d'authentification par Magic Link
 */
export const authCoordinationService = {
  /**
   * Demande l'envoi d'un magic link par email
   */
  requestMagicLink: async (email) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/auth/magic-link`, { email })
  },

  /**
   * Vérifie un magic link et retourne un token de session
   */
  verifyMagicLink: async (token, email) => {
    const params = new URLSearchParams({ token, email })
    return await apiService.get(`${COORDINATION_BASE_URL}/auth/verify?${params}`)
  },

  /**
   * Stocke le token de session
   */
  setSessionToken: (token) => {
    writeStorageValue(STORAGE_KEYS.COORDINATION_SESSION_TOKEN, token)
  },

  /**
   * Récupère le token de session
   */
  getSessionToken: () => {
    return readStorageValue(STORAGE_KEYS.COORDINATION_SESSION_TOKEN, '')
  },

  /**
   * Supprime le token de session (déconnexion)
   */
  clearSession: () => {
    removeStorageValue(STORAGE_KEYS.COORDINATION_SESSION_TOKEN)
    removeStorageValue(STORAGE_KEYS.COORDINATION_USER)
  },

  /**
   * Récupère l'utilisateur connecté
   */
  getCurrentUser: () => {
    return readJSONValue(STORAGE_KEYS.COORDINATION_USER, null, ['planningUser'])
  },

  /**
   * Stocke l'utilisateur connecté
   */
  setCurrentUser: (user) => {
    if (user == null) {
      removeStorageValue(STORAGE_KEYS.COORDINATION_USER)
      return
    }

    writeJSONValue(STORAGE_KEYS.COORDINATION_USER, user)
  }
}

/**
 * Service de gestion des personnes
 */
export const personService = {
  /**
   * Liste toutes les personnes avec filtres optionnels
   */
  getAll: async (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.role) params.append('role', filters.role)
    if (filters.site) params.append('site', filters.site)
    if (filters.search) params.append('search', filters.search)
    if (filters.sendEmails !== undefined) params.append('sendEmails', String(filters.sendEmails))

    const queryString = params.toString()
    return await apiService.get(`${COORDINATION_BASE_URL}/persons${queryString ? `?${queryString}` : ''}`)
  },

  /**
   * Crée une nouvelle personne
   */
  create: async (personData) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/persons`, personData)
  },

  /**
   * Met a jour une personne
   */
  update: async (personId, personData) => {
    return await apiService.put(`${COORDINATION_BASE_URL}/persons/${personId}`, personData)
  },

  /**
   * Fusionne plusieurs fiches en conservant une fiche cible
   */
  merge: async (targetPersonId, sourcePersonIds = [], options = {}) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/persons/merge`, {
      targetPersonId,
      sourcePersonIds,
      allowDifferentIdentity: options.allowDifferentIdentity === true
    })
  },

  /**
   * Importe un lot de personnes depuis un contenu CSV/TSV
   */
  importFromContent: async (content, options = {}) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/persons/import`, {
      content,
      defaultSite: typeof options.defaultSite === 'string' ? options.defaultSite : '',
      defaultRoles: Array.isArray(options.defaultRoles)
        ? options.defaultRoles
        : (typeof options.defaultRole === 'string' && options.defaultRole
            ? [options.defaultRole]
            : [])
    })
  },

  /**
   * Desactive une personne
   */
  remove: async (personId) => {
    return await apiService.delete(`${COORDINATION_BASE_URL}/persons/${personId}`)
  },

}

/**
 * Service de gestion des créneaux
 */
export const slotService = {
  /**
   * Génère les créneaux pour une période
   */
  generate: async (year, dates, siteConfig) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/slots/generate`, {
      year,
      dates,
      siteConfig
    })
  },

  /**
   * Liste les créneaux d'une année
   */
  getByYear: async (year, filters = {}) => {
    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    if (filters.date) params.append('date', filters.date)
    if (filters.site) params.append('site', filters.site)

    const queryString = params.toString()
    return await apiService.get(`${COORDINATION_BASE_URL}/slots/${year}${queryString ? `?${queryString}` : ''}`)
  },

  /**
   * Récupère les créneaux formatés pour le calendrier
   */
  getCalendar: async (year) => {
    return await apiService.get(`${COORDINATION_BASE_URL}/slots/${year}/calendar`)
  }
}

/**
 * Service de gestion des TPI
 */
export const tpiCoordinationService = {
  /**
   * Liste les TPI d'une année
   */
  getByYear: async (year, status = null) => {
    const params = status ? `?status=${status}` : ''
    return await apiService.get(`${COORDINATION_BASE_URL}/tpi/${year}${params}`)
  },

  /**
   * Récupère les détails d'un TPI
   */
  getById: async (year, tpiId) => {
    return await apiService.get(`${COORDINATION_BASE_URL}/tpi/${year}/${tpiId}`)
  },

  /**
   * Crée un nouveau TPI
   */
  create: async (tpiData) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/tpi`, tpiData)
  },

  /**
   * Lance la proposition de créneaux et le vote
   */
  proposeSlots: async (tpiId, maxSlots = 4) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/tpi/${tpiId}/propose-slots`, { maxSlots })
  },

  /**
   * Force manuellement un créneau
   */
  forceSlot: async (tpiId, slotId, reason) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/tpi/${tpiId}/force-slot`, { slotId, reason })
  },

  /**
   * Simule un déplacement de TPI vers un créneau sans modifier la planification
   */
  simulateMoveToSlot: async (tpiId, slotId) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/tpi/${tpiId}/move-to-slot/${slotId}/simulate`, {})
  },

  /**
   * Déplace et confirme un TPI vers un créneau si la simulation est sans conflit
   */
  moveToSlot: async (tpiId, slotId, reason = '') => {
    return await apiService.post(`${COORDINATION_BASE_URL}/tpi/${tpiId}/move-to-slot/${slotId}`, { reason })
  },

  /**
   * Renvoyer les demandes de vote d'un TPI
   */
  resendVotes: async (tpiId, options = {}) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/tpi/${tpiId}/resend-votes`, {
      fromArbitrage: options.fromArbitrage === true
    })
  }
}

/**
 * Service de gestion des propositions d'arbitrage
 */
export const resolutionProposalService = {
  create: async (tpiId, payload = {}) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/tpi/${tpiId}/resolution-proposals`, payload)
  },

  getPublic: async (token) => {
    return await apiService.get(`${COORDINATION_BASE_URL}/resolution-proposals/public/${encodeURIComponent(token)}`)
  },

  respondPublic: async (token, payload = {}) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/resolution-proposals/public/${encodeURIComponent(token)}/respond`, payload)
  }
}

/**
 * Service de gestion des votes
 */
export const voteService = {
  /**
   * Récupère les votes en attente pour l'utilisateur
   */
  getPending: async () => {
    return await apiService.get(`${COORDINATION_BASE_URL}/votes/pending`)
  },

  /**
   * Répond au vote d'un TPI avec le nouveau flux OK ou Proposition
   */
  respondToVote: async (tpiId, payload) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/votes/respond/${tpiId}`, payload)
  },

  /**
   * Soumet un vote
   */
  submitVote: async (voteId, decision, comment = '', priority = 1) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/votes/${voteId}`, {
      decision,
      comment,
      priority
    })
  },

  /**
   * Soumet plusieurs votes en une fois
   */
  submitBulkVotes: async (votes) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/votes/bulk`, { votes })
  },

  /**
   * Force une réponse OK admin pour des rôles de vote.
   */
  forceOk: async (payload) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/votes/force-ok`, payload)
  },

  /**
   * Ajoute un choix proposé aux dates idéales du votant
   */
  addProposalToPreferences: async (voteId) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/votes/${voteId}/preferred-soutenance-choice`, {})
  }
}

/**
 * Service de configuration de planification
 */
export const coordinationConfigService = {
  getByYear: async (year) => {
    return await apiService.get(`${COORDINATION_BASE_URL}/config/${year}`)
  },

  saveByYear: async (year, config) => {
    return await apiService.put(`${COORDINATION_BASE_URL}/config/${year}`, config)
  }
}

/**
 * Service de catalogue partagé des sites et salles
 */
export const coordinationCatalogService = {
  getGlobal: async () => {
    return await apiService.get(`${COORDINATION_BASE_URL}/catalog`)
  },

  saveGlobal: async (catalog) => {
    return await apiService.put(`${COORDINATION_BASE_URL}/catalog`, catalog)
  }
}

export const publicationDeploymentConfigService = {
  get: async () => {
    return await apiService.get(`${WORKFLOW_BASE_URL}/static-publication/config`)
  },

  save: async (config) => {
    return await apiService.put(`${WORKFLOW_BASE_URL}/static-publication/config`, config)
  }
}

/**
 * Service d'affectation des créneaux.
 */
export const schedulingService = {
  /**
   * Récupère les créneaux disponibles pour un TPI
   */
  getAvailability: async (year, tpiId) => {
    return await apiService.get(`${COORDINATION_BASE_URL}/availability/${year}/${tpiId}`)
  },

  /**
   * Assigne un TPI à un créneau (drag & drop)
   */
  assignSlot: async (slotId, tpiId) => {
    return await apiService.post(`${COORDINATION_BASE_URL}/assign/${slotId}`, { tpiId })
  }
}

/**
 * Service de pilotage annuel: coordination, votes, publications et phases admin.
 */
export const workflowCoordinationService = {
  getYearState: async (year) => {
    return await apiService.get(`${WORKFLOW_BASE_URL}/${year}`)
  },

  getAudit: async (year, limit = 100) => {
    return await apiService.get(`${WORKFLOW_BASE_URL}/${year}/audit?limit=${limit}`)
  },

  validatePlanification: async (year, includeEntries = false, legacyRooms = null) => {
    if (Array.isArray(legacyRooms)) {
      return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/planification/validate`, {
        includeEntries,
        legacyRooms
      })
    }

    const query = includeEntries ? '?includeEntries=true' : ''
    return await apiService.get(`${WORKFLOW_BASE_URL}/${year}/planification/validate${query}`)
  },

  automatePlanification: async (year) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/planification/auto-plan`, {})
  },

  getActiveSnapshot: async (year, includeEntries = false) => {
    const query = includeEntries ? '?includeEntries=true' : ''
    return await apiService.get(`${WORKFLOW_BASE_URL}/${year}/planification/snapshot${query}`)
  },

  freezePlanification: async (year, allowHardConflicts = false, legacyRooms = null) => {
    const body = {
      allowHardConflicts
    }

    if (Array.isArray(legacyRooms)) {
      body.legacyRooms = legacyRooms
    }

    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/planification/freeze`, body)
  },

  syncPlanificationFromCoordination: async (year, allowHardConflicts = false) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/planification/sync-from-coordination`, {
      allowHardConflicts
    })
  },

  startVotes: async (year, legacyRooms = null, options = {}) => {
    return await apiService.post(
      `${WORKFLOW_BASE_URL}/${year}/votes/start`,
      buildStartVotesBody(legacyRooms, options)
    )
  },

  startVotesWithoutEmails: async (year, legacyRooms = null) => {
    return await apiService.post(
      `${WORKFLOW_BASE_URL}/${year}/votes/start`,
      buildStartVotesBody(legacyRooms, { skipEmails: true })
    )
  },

  createDevVoteLinks: async (year, baseUrl = null, options = {}) => {
    const body = {}

    if (baseUrl) {
      body.baseUrl = baseUrl
    }

    if (typeof options.reference === 'string') {
      body.reference = options.reference
    }

    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/votes/dev-links`, body)
  },

  sendDevVoteEmails: async (year, email, options = {}) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/votes/dev-email`, {
      email,
      reference: typeof options.reference === 'string' ? options.reference : '',
      baseUrl: options.baseUrl || null
    })
  },

  sendDevSoutenanceEmails: async (year, email, options = {}) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/publication/dev-email`, {
      email,
      reference: typeof options.reference === 'string' ? options.reference : '',
      baseUrl: options.baseUrl || null
    })
  },

  previewAccessLinks: async (year, baseUrl = null, options = {}) => {
    const body = {}

    if (baseUrl) {
      body.baseUrl = baseUrl
    }

    if (options.publicationVersion) {
      body.publicationVersion = options.publicationVersion
    }

    if (options.soutenanceLinkTarget) {
      body.soutenanceLinkTarget = options.soutenanceLinkTarget
    }

    if (options.soutenancePublicUrl) {
      body.soutenancePublicUrl = options.soutenancePublicUrl
    }

    if (options.voteLinkTarget) {
      body.voteLinkTarget = options.voteLinkTarget
    }

    if (options.votePublicUrl) {
      body.votePublicUrl = options.votePublicUrl
    }

    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/access-links/preview`, body)
  },

  generateAccessLinks: async (year, baseUrl = null, options = {}) => {
    const body = {}

    if (baseUrl) {
      body.baseUrl = baseUrl
    }

    if (options.publicationVersion) {
      body.publicationVersion = options.publicationVersion
    }

    if (options.soutenanceLinkTarget) {
      body.soutenanceLinkTarget = options.soutenanceLinkTarget
    }

    if (options.soutenancePublicUrl) {
      body.soutenancePublicUrl = options.soutenancePublicUrl
    }

    if (options.voteLinkTarget) {
      body.voteLinkTarget = options.voteLinkTarget
    }

    if (options.votePublicUrl) {
      body.votePublicUrl = options.votePublicUrl
    }

    return await apiService.post(
      `${WORKFLOW_BASE_URL}/${year}/access-links/generate`,
      body,
      STATIC_PUBLICATION_TIMEOUT
    )
  },

  reconcileAccessLinks: async (year, baseUrl = null, options = {}) => {
    const body = {}

    if (baseUrl) {
      body.baseUrl = baseUrl
    }

    if (Array.isArray(options.phases) && options.phases.length > 0) {
      body.phases = options.phases
    } else if (options.phase) {
      body.phase = options.phase
    }

    if (options.publicationVersion) {
      body.publicationVersion = options.publicationVersion
    }

    if (options.soutenanceLinkTarget) {
      body.soutenanceLinkTarget = options.soutenanceLinkTarget
    }

    if (options.soutenancePublicUrl) {
      body.soutenancePublicUrl = options.soutenancePublicUrl
    }

    if (options.voteLinkTarget) {
      body.voteLinkTarget = options.voteLinkTarget
    }

    if (options.votePublicUrl) {
      body.votePublicUrl = options.votePublicUrl
    }

    return await apiService.post(
      `${WORKFLOW_BASE_URL}/${year}/access-links/reconcile`,
      body,
      STATIC_PUBLICATION_TIMEOUT
    )
  },

  previewSoutenanceAccessEmail: async (year, target = {}, options = {}) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/access-links/email-preview`, {
      template: 'soutenanceAccess',
      target,
      messageType: options?.messageType || target?.messageType || 'standard'
    })
  },

  sendSoutenanceAccessEmails: async (year, targets = [], options = {}) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/access-links/send-soutenance-emails`, {
      targets,
      testEmail: options?.testEmail || '',
      forceResend: options?.forceResend === true,
      messageType: options?.messageType || 'standard',
      baseUrl: options?.baseUrl || null
    }, TIMEOUTS.EMAIL_SEND)
  },

  resetAccessLinkEmailDeliveries: async (year, options = {}) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/access-links/email-deliveries/reset`, {
      type: options.type || 'soutenance',
      linkIds: Array.isArray(options.linkIds) ? options.linkIds : []
    })
  },

  getAccessLinkLogs: async (year, options = {}) => {
    const params = new URLSearchParams()

    if (options.type) {
      params.set('type', options.type)
    }

    if (options.status) {
      params.set('status', options.status)
    }

    if (options.personId) {
      params.set('personId', options.personId)
    }

    if (options.limit) {
      params.set('limit', String(options.limit))
    }

    const query = params.toString()
    return await apiService.get(`${WORKFLOW_BASE_URL}/${year}/access-links/logs${query ? `?${query}` : ''}`)
  },

  remindVotes: async (year, options = {}) => {
    const body = options.automatic === true ? { automatic: true } : {}
    if (options.voteLinkTarget) {
      body.voteLinkTarget = options.voteLinkTarget
    }
    if (options.votePublicUrl) {
      body.votePublicUrl = options.votePublicUrl
    }
    if (Array.isArray(options.tpiIds) && options.tpiIds.length > 0) {
      body.tpiIds = options.tpiIds
    }
    if (options.movedOnly === true) {
      body.movedOnly = true
    }
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/votes/remind`, body)
  },

  closeVotes: async (year) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/votes/close`, {})
  },

  publishDefinitive: async (year, legacyRooms = null, options = {}) => {
    const body = appendSoutenanceLinkOptions(
      Array.isArray(legacyRooms) ? { legacyRooms } : {},
      options
    )

    return await apiService.post(
      `${WORKFLOW_BASE_URL}/${year}/publication/publish`,
      body
    )
  },

  deactivatePublication: async (year) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/publication/deactivate`, {})
  },

  sendPublicationLinks: async (year, options = {}) => {
    return await apiService.post(
      `${WORKFLOW_BASE_URL}/${year}/publication/send-links`,
      appendSoutenanceLinkOptions({}, options)
    )
  },

  previewFinalScheduleDelivery: async (year, options = {}) => {
    const params = new URLSearchParams()
    if (options.publicationVersion) {
      params.set('publicationVersion', String(options.publicationVersion))
    }

    const query = params.toString()
    return await apiService.get(
      `${WORKFLOW_BASE_URL}/${year}/publication/final-schedule/preview${query ? `?${query}` : ''}`
    )
  },

  sendFinalScheduleDelivery: async (year, options = {}) => {
    return await apiService.post(
      `${WORKFLOW_BASE_URL}/${year}/publication/final-schedule/send`,
      {
        publicationVersion: options?.publicationVersion || null,
        forceResend: options?.forceResend === true
      },
      TIMEOUTS.EMAIL_SEND
    )
  },

  getDefenseChangeNotificationPreview: async (year, options = {}) => {
    const params = new URLSearchParams()
    if (options.publicationVersion) {
      params.set('publicationVersion', String(options.publicationVersion))
    }

    const query = params.toString()
    return await apiService.get(
      `${WORKFLOW_BASE_URL}/${year}/publication/defense-changes/preview${query ? `?${query}` : ''}`
    )
  },

  sendDefenseChangeNotifications: async (year, options = {}) => {
    const body = appendSoutenanceLinkOptions({}, options)

    if (options.publicationVersion) {
      body.publicationVersion = options.publicationVersion
    }

    if (options.forceResend === true) {
      body.forceResend = true
    }

    return await apiService.post(
      `${WORKFLOW_BASE_URL}/${year}/publication/defense-changes/send`,
      body,
      TIMEOUTS.EMAIL_SEND
    )
  },

  getStaticPublicationStatus: async (year) => {
    return await apiService.get(`${WORKFLOW_BASE_URL}/${year}/static-publication/status`)
  },

  generateStaticPublication: async (year) => {
    return await apiService.post(
      `${WORKFLOW_BASE_URL}/${year}/static-publication/generate`,
      {},
      STATIC_PUBLICATION_TIMEOUT
    )
  },

  publishStaticPublication: async (year) => {
    return await apiService.post(
      `${WORKFLOW_BASE_URL}/${year}/static-publication/publish`,
      {},
      STATIC_PUBLICATION_TIMEOUT
    )
  },

  getStaticVotePublicationStatus: async (year) => {
    return await apiService.get(`${WORKFLOW_BASE_URL}/${year}/static-votes/status`)
  },

  generateStaticVotePublication: async (year) => {
    return await apiService.post(
      `${WORKFLOW_BASE_URL}/${year}/static-votes/generate`,
      {},
      STATIC_PUBLICATION_TIMEOUT
    )
  },

  publishStaticVotePublication: async (year) => {
    return await apiService.post(
      `${WORKFLOW_BASE_URL}/${year}/static-votes/publish`,
      {},
      STATIC_PUBLICATION_TIMEOUT
    )
  },

  syncStaticVotePublication: async (year, options = {}) => {
    const body = {}

    if (typeof options.remoteUrl === 'string' && options.remoteUrl.trim()) {
      body.remoteUrl = options.remoteUrl.trim()
    }

    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/static-votes/sync`, body)
  },

  resetYear: async (year) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/reset`, {
      confirmation: `RECOMMENCER ${year}`
    })
  },

  rollbackPublication: async (year, version) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/publication/rollback/${version}`, {})
  },

  setPhaseActive: async (year, phase, active, options = {}) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/phases/${encodeURIComponent(phase)}`, {
      active: active === true,
      ...(typeof options.reason === 'string' && options.reason.trim()
        ? { reason: options.reason.trim() }
        : {})
    })
  },

  resolveMagicLink: async (token) => {
    const params = new URLSearchParams({ token })
    return await apiService.get(`/api/magic-link/resolve?${params}`)
  }
}

export const authPlanningService = authCoordinationService
export const tpiPlanningService = tpiCoordinationService
export const planningConfigService = coordinationConfigService
export const planningCatalogService = coordinationCatalogService
export const workflowPlanningService = workflowCoordinationService

const coordinationService = {
  auth: authCoordinationService,
  persons: personService,
  slots: slotService,
  tpiCoordination: tpiCoordinationService,
  tpiPlanning: tpiCoordinationService,
  resolutionProposals: resolutionProposalService,
  votes: voteService,
  scheduling: schedulingService,
  workflow: workflowCoordinationService,
  coordinationCatalog: coordinationCatalogService,
  planningCatalog: coordinationCatalogService,
  publicationDeploymentConfig: publicationDeploymentConfigService
}

export default coordinationService
