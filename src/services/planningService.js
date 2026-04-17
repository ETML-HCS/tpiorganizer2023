/**
 * Service de planification côté client
 * Gère les appels API pour le système de planification des TPI
 */

import apiService from './apiService'
import { STORAGE_KEYS } from '../config/appConfig'
import {
  readJSONValue,
  readStorageValue,
  removeStorageValue,
  writeJSONValue,
  writeStorageValue
} from '../utils/storage'

const PLANNING_BASE_URL = '/api/planning'
const WORKFLOW_BASE_URL = '/api/workflow'

/**
 * Service d'authentification par Magic Link
 */
export const authPlanningService = {
  /**
   * Demande l'envoi d'un magic link par email
   */
  requestMagicLink: async (email) => {
    return await apiService.post(`${PLANNING_BASE_URL}/auth/magic-link`, { email })
  },

  /**
   * Vérifie un magic link et retourne un token de session
   */
  verifyMagicLink: async (token, email) => {
    const params = new URLSearchParams({ token, email })
    return await apiService.get(`${PLANNING_BASE_URL}/auth/verify?${params}`)
  },

  /**
   * Stocke le token de session
   */
  setSessionToken: (token) => {
    writeStorageValue(STORAGE_KEYS.PLANNING_SESSION_TOKEN, token)
  },

  /**
   * Récupère le token de session
   */
  getSessionToken: () => {
    return readStorageValue(STORAGE_KEYS.PLANNING_SESSION_TOKEN, '')
  },

  /**
   * Supprime le token de session (déconnexion)
   */
  clearSession: () => {
    removeStorageValue(STORAGE_KEYS.PLANNING_SESSION_TOKEN)
    removeStorageValue(STORAGE_KEYS.PLANNING_USER)
  },

  /**
   * Récupère l'utilisateur connecté
   */
  getCurrentUser: () => {
    return readJSONValue(STORAGE_KEYS.PLANNING_USER, null, ['planningUser'])
  },

  /**
   * Stocke l'utilisateur connecté
   */
  setCurrentUser: (user) => {
    if (user == null) {
      removeStorageValue(STORAGE_KEYS.PLANNING_USER)
      return
    }

    writeJSONValue(STORAGE_KEYS.PLANNING_USER, user)
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
    return await apiService.get(`${PLANNING_BASE_URL}/persons${queryString ? `?${queryString}` : ''}`)
  },

  /**
   * Crée une nouvelle personne
   */
  create: async (personData) => {
    return await apiService.post(`${PLANNING_BASE_URL}/persons`, personData)
  },

  /**
   * Met a jour une personne
   */
  update: async (personId, personData) => {
    return await apiService.put(`${PLANNING_BASE_URL}/persons/${personId}`, personData)
  },

  /**
   * Fusionne plusieurs fiches en conservant une fiche cible
   */
  merge: async (targetPersonId, sourcePersonIds = [], options = {}) => {
    return await apiService.post(`${PLANNING_BASE_URL}/persons/merge`, {
      targetPersonId,
      sourcePersonIds,
      allowDifferentIdentity: options.allowDifferentIdentity === true
    })
  },

  /**
   * Importe un lot de personnes depuis un contenu CSV/TSV
   */
  importFromContent: async (content, options = {}) => {
    return await apiService.post(`${PLANNING_BASE_URL}/persons/import`, {
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
    return await apiService.delete(`${PLANNING_BASE_URL}/persons/${personId}`)
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
    return await apiService.post(`${PLANNING_BASE_URL}/slots/generate`, {
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
    return await apiService.get(`${PLANNING_BASE_URL}/slots/${year}${queryString ? `?${queryString}` : ''}`)
  },

  /**
   * Récupère les créneaux formatés pour le calendrier
   */
  getCalendar: async (year) => {
    return await apiService.get(`${PLANNING_BASE_URL}/slots/${year}/calendar`)
  }
}

/**
 * Service de gestion des TPI
 */
export const tpiPlanningService = {
  /**
   * Liste les TPI d'une année
   */
  getByYear: async (year, status = null) => {
    const params = status ? `?status=${status}` : ''
    return await apiService.get(`${PLANNING_BASE_URL}/tpi/${year}${params}`)
  },

  /**
   * Récupère les détails d'un TPI
   */
  getById: async (year, tpiId) => {
    return await apiService.get(`${PLANNING_BASE_URL}/tpi/${year}/${tpiId}`)
  },

  /**
   * Crée un nouveau TPI
   */
  create: async (tpiData) => {
    return await apiService.post(`${PLANNING_BASE_URL}/tpi`, tpiData)
  },

  /**
   * Lance la proposition de créneaux et le vote
   */
  proposeSlots: async (tpiId, maxSlots = 4) => {
    return await apiService.post(`${PLANNING_BASE_URL}/tpi/${tpiId}/propose-slots`, { maxSlots })
  },

  /**
   * Force manuellement un créneau
   */
  forceSlot: async (tpiId, slotId, reason) => {
    return await apiService.post(`${PLANNING_BASE_URL}/tpi/${tpiId}/force-slot`, { slotId, reason })
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
    return await apiService.get(`${PLANNING_BASE_URL}/votes/pending`)
  },

  /**
   * Répond au vote d'un TPI avec le nouveau flux OK ou Proposition
   */
  respondToVote: async (tpiId, payload) => {
    return await apiService.post(`${PLANNING_BASE_URL}/votes/respond/${tpiId}`, payload)
  },

  /**
   * Soumet un vote
   */
  submitVote: async (voteId, decision, comment = '', priority = 1) => {
    return await apiService.post(`${PLANNING_BASE_URL}/votes/${voteId}`, {
      decision,
      comment,
      priority
    })
  },

  /**
   * Soumet plusieurs votes en une fois
   */
  submitBulkVotes: async (votes) => {
    return await apiService.post(`${PLANNING_BASE_URL}/votes/bulk`, { votes })
  }
}

/**
 * Service de configuration de planification
 */
export const planningConfigService = {
  getByYear: async (year) => {
    return await apiService.get(`${PLANNING_BASE_URL}/config/${year}`)
  },

  saveByYear: async (year, config) => {
    return await apiService.put(`${PLANNING_BASE_URL}/config/${year}`, config)
  }
}

/**
 * Service de catalogue partagé des sites et salles
 */
export const planningCatalogService = {
  getGlobal: async () => {
    return await apiService.get(`${PLANNING_BASE_URL}/catalog`)
  },

  saveGlobal: async (catalog) => {
    return await apiService.put(`${PLANNING_BASE_URL}/catalog`, catalog)
  }
}

/**
 * Service de planification et drag & drop
 */
export const schedulingService = {
  /**
   * Récupère les créneaux disponibles pour un TPI
   */
  getAvailability: async (year, tpiId) => {
    return await apiService.get(`${PLANNING_BASE_URL}/availability/${year}/${tpiId}`)
  },

  /**
   * Assigne un TPI à un créneau (drag & drop)
   */
  assignSlot: async (slotId, tpiId) => {
    return await apiService.post(`${PLANNING_BASE_URL}/assign/${slotId}`, { tpiId })
  }
}

/**
 * Service workflow annuel (3 etapes)
 */
export const workflowPlanningService = {
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

  startVotes: async (year, legacyRooms = null) => {
    const body = Array.isArray(legacyRooms) ? { legacyRooms } : {}
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/votes/start`, body)
  },

  createDevVoteLinks: async (year, baseUrl = null) => {
    const body = {}

    if (baseUrl) {
      body.baseUrl = baseUrl
    }

    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/votes/dev-links`, body)
  },

  remindVotes: async (year) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/votes/remind`, {})
  },

  closeVotes: async (year) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/votes/close`, {})
  },

  publishDefinitive: async (year) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/publication/publish`, {})
  },

  sendPublicationLinks: async (year) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/publication/send-links`, {})
  },

  rollbackPublication: async (year, version) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/publication/rollback/${version}`, {})
  },

  transition: async (year, targetState) => {
    return await apiService.post(`${WORKFLOW_BASE_URL}/${year}/transition`, { targetState })
  },

  resolveMagicLink: async (token) => {
    const params = new URLSearchParams({ token })
    return await apiService.get(`/api/magic-link/resolve?${params}`)
  }
}

const planningService = {
  auth: authPlanningService,
  persons: personService,
  slots: slotService,
  tpiPlanning: tpiPlanningService,
  votes: voteService,
  scheduling: schedulingService,
  workflow: workflowPlanningService,
  planningCatalog: planningCatalogService
}

export default planningService
