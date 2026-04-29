/**
 * Service API centralisé pour toutes les requêtes HTTP
 * Gère les erreurs, les timeouts et les headers de manière cohérente
 */

import { API_URL, TIMEOUTS, ERROR_MESSAGES, STORAGE_KEYS } from '../config/appConfig'
import {
  LEGACY_STORAGE_KEYS,
  getAuthScopeForEndpoint,
  getStoredAuthToken,
  resolveStoredAuthToken,
  removeStorageValue
} from '../utils/storage'

/**
 * Classe de gestion des erreurs API
 */
class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

/**
 * Fonction utilitaire pour les requêtes fetch avec timeout
 */
const fetchWithTimeout = async (url, options = {}, timeout = TIMEOUTS.API_REQUEST) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new ApiError('La requête a expiré', 408)
    }
    throw error
  }
}

/**
 * Headers par défaut pour les requêtes JSON
 */
const getDefaultHeaders = (endpoint) => {
  const headers = { 'Content-Type': 'application/json' }

  const token = getStoredAuthToken(endpoint)

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

/**
 * Traitement uniforme des réponses
 */
const clearExpiredSessionState = (endpoint, scope) => {
  if (scope === 'public') {
    return
  }

  const { source } = resolveStoredAuthToken(endpoint)

  if (scope === 'app') {
    removeStorageValue(STORAGE_KEYS.IS_AUTHENTICATED)
    removeStorageValue(STORAGE_KEYS.APP_SESSION_TOKEN)
    removeStorageValue(LEGACY_STORAGE_KEYS.TOKEN)
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('tpi:auth-expired', {
          detail: {
            endpoint,
            source: source || 'app'
          }
        })
      )
    }
    return
  }

  if (source === 'planning') {
    removeStorageValue(STORAGE_KEYS.PLANNING_SESSION_TOKEN)
    removeStorageValue(STORAGE_KEYS.PLANNING_USER)
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('tpi:planning-auth-expired', {
          detail: {
            endpoint,
            source
          }
        })
      )
    }
    return
  }

  if (source === 'app' || source === 'legacy') {
    removeStorageValue(STORAGE_KEYS.IS_AUTHENTICATED)
    removeStorageValue(STORAGE_KEYS.APP_SESSION_TOKEN)
    removeStorageValue(LEGACY_STORAGE_KEYS.TOKEN)
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('tpi:auth-expired', {
          detail: {
            endpoint,
            source
          }
        })
      )
    }
  }
}

const handleResponse = async (response, endpoint) => {
  const data = await response.json().catch(() => null)
  const scope = getAuthScopeForEndpoint(endpoint)
  const { source } = resolveStoredAuthToken(endpoint)

  if (!response.ok) {
    const message = endpoint === '/api/auth/login'
      ? data?.message || data?.error || ERROR_MESSAGES.AUTH_FAILED
      : response.status === 401
        ? scope === 'app'
          ? 'Session invalide ou expirée. Veuillez vous reconnecter.'
          : source === 'planning'
            ? 'Session de planification invalide ou expirée. Veuillez rouvrir le lien.'
            : source === 'app' || source === 'legacy'
            ? 'Session invalide ou expirée. Veuillez vous reconnecter.'
            : scope === 'public'
              ? data?.message || data?.error || 'Lien invalide ou expiré.'
              : 'Accès de planification requis.'
        : data?.message || data?.error || ERROR_MESSAGES.NETWORK_ERROR

    if (response.status === 401) {
      clearExpiredSessionState(endpoint, scope)
    }

    throw new ApiError(
      message,
      response.status,
      data
    )
  }

  return data
}

/**
 * Service API principal
 */
const apiService = {
  /**
   * Requête GET
   */
  get: async (endpoint) => {
    const response = await fetchWithTimeout(`${API_URL}${endpoint}`, {
      method: 'GET',
      headers: getDefaultHeaders(endpoint)
    })
    return handleResponse(response, endpoint)
  },

  /**
   * Requête POST
   */
  post: async (endpoint, body) => {
    const response = await fetchWithTimeout(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: getDefaultHeaders(endpoint),
      body: JSON.stringify(body)
    })
    return handleResponse(response, endpoint)
  },

  /**
   * Requête PUT
   */
  put: async (endpoint, body) => {
    const response = await fetchWithTimeout(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: getDefaultHeaders(endpoint),
      body: JSON.stringify(body)
    })
    return handleResponse(response, endpoint)
  },

  /**
   * Requête DELETE
   */
  delete: async (endpoint) => {
    const response = await fetchWithTimeout(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getDefaultHeaders(endpoint)
    })
    return handleResponse(response, endpoint)
  }
}

// Services spécifiques

/**
 * Service d'authentification
 */
export const authService = {
  login: (username, password) => 
    apiService.post('/api/auth/login', { username, password }),
  
  logout: () => {
    removeStorageValue(STORAGE_KEYS.IS_AUTHENTICATED)
    removeStorageValue(STORAGE_KEYS.APP_SESSION_TOKEN)
    return Promise.resolve()
  }
}

/**
 * Service TPI
 */
export const tpiService = {
  getByYear: (year) => 
    apiService.get(`/api/tpiyear/${year}`),
  
  getByCandidate: (year, candidateName) => 
    apiService.get(`/api/tpi/${year}/byCandidate/${encodeURIComponent(String(candidateName || ''))}`),
  
  save: (tpiData) => 
    apiService.post('/api/tpi', tpiData),
  
  update: (year, tpiId, data) => 
    apiService.put(`/api/tpiyear/${year}/${tpiId}`, data),
  
  delete: (year, tpiId) => 
    apiService.delete(`/api/tpiyear/${year}/${tpiId}`)
}

/**
 * Service Experts
 */
export const expertsService = {
  getAll: () => 
    apiService.get('/api/experts/listExpertsOrBoss'),
  
  getByToken: (token) => 
    apiService.get(`/api/experts/getNameByToken?token=${encodeURIComponent(String(token || ''))}`),
  
  getEmails: () => 
    apiService.get('/api/experts/emails')
}

/**
 * Service Évaluations
 */
export const evaluationsService = {
  getByYear: (year) => 
    apiService.get(`/load-tpiEvals/${year}`),
  
  save: (_year, evalData) => 
    apiService.post('/save-tpiEval', evalData)
}

/**
 * Service Défenses
 */
export const soutenancesService = {
  getByYear: (year) => 
    apiService.get(`/api/defenses/${year}`),

  getPublishedByYear: (year, options = {}) => {
    const params = new URLSearchParams()
    if (options.ml) params.append('ml', options.ml)
    if (options.token) params.append('token', options.token)
    if (options.code) params.append('code', options.code)

    const query = params.toString()
    return apiService.get(`/api/defenses/${year}${query ? `?${query}` : ''}`)
  },

  getExpertsOrBoss: () =>
    expertsService.getAll(),

  publishRoom: (year, roomData) =>
    apiService.post(`/api/defenses/${year}/publish-room`, roomData),

  publishFromPlanning: (year) =>
    apiService.post(`/api/defenses/${year}/publish-from-planning`, {}),

  updateOffers: (
    year,
    roomId,
    tpiDataId,
    expertOrBoss,
    propositions,
    options = {}
  ) => {
    const params = new URLSearchParams()
    if (options.ml) params.append('ml', options.ml)
    if (options.token) params.append('token', options.token)
    if (options.code) params.append('code', options.code)

    const query = params.toString()

    return apiService.put(
      `/api/defenses/${year}/rooms/${roomId}/tpis/${tpiDataId}/offres/${expertOrBoss}${query ? `?${query}` : ''}`,
      propositions
    )
  },

  updateProposition: (year, roomId, tpiDataId, expertOrBoss, propositions) =>
    apiService.put(
      `/api/defenses/${year}/rooms/${roomId}/tpis/${tpiDataId}/offres/${expertOrBoss}`,
      propositions
    )
}

export { ApiError }
export default apiService
