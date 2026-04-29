/**
 * Configuration centralisée de l'application TPI Organizer
 * Toutes les constantes et configurations globales sont définies ici
 */

// Mode debug basé sur la variable d'environnement
export const IS_DEBUG = process.env.REACT_APP_DEBUG === 'true'

// Ce flag ne protège que l'interface. La sécurité réelle reste côté API.
export const IS_ADMIN_UI_ENABLED = process.env.REACT_APP_ENABLE_ADMIN_UI === 'true'

// Secret de chiffrement legacy pour TpiTracker.
// Exposé côté client, il ne constitue donc pas une protection forte.
export const TPI_TRACKER_SECRET = process.env.REACT_APP_TPI_TRACKER_SECRET || ''

// URL de l'API selon l'environnement
// En dev, toujours pointer sur 5001 (backend) ; en prod, 6000
// Permet d'override via REACT_APP_API_URL_TRUE/FALSE dans .env.local
export const API_URL = IS_DEBUG
  ? process.env.REACT_APP_API_URL_TRUE || 'http://localhost:5001'
  : process.env.REACT_APP_API_URL_FALSE || 'http://localhost:6000'

// Debug : log l'URL API au démarrage sans polluer les tests.
if (IS_DEBUG && process.env.NODE_ENV !== 'test') {
  console.info('[appConfig] API_URL:', API_URL)
}

// Configuration des années
const configuredMinYear = Number.parseInt(process.env.REACT_APP_MIN_YEAR || '2023', 10)
const configuredFutureOffset = Number.parseInt(process.env.REACT_APP_YEAR_FUTURE_OFFSET || '1', 10)
const fallbackCurrentYear = new Date().getFullYear()

export const YEARS_CONFIG = {
  MIN_YEAR: Number.isInteger(configuredMinYear) ? configuredMinYear : 2023,
  FUTURE_OFFSET: Number.isInteger(configuredFutureOffset) ? configuredFutureOffset : 1,
  getCurrentYear: () => new Date().getFullYear(),
  // Génère les années disponibles dynamiquement entre une borne min et max.
  getAvailableYears: (options = {}) => {
    // Compatibilité: ancien appel getAvailableYears(range)
    if (typeof options === 'number') {
      const range = options
      const currentYear = new Date().getFullYear()
      return Array.from(
        { length: range * 2 + 1 },
        (_, i) => currentYear - range + i
      )
    }

    const currentYear = new Date().getFullYear()
    const minYear = Number.isInteger(options.minYear)
      ? options.minYear
      : YEARS_CONFIG.MIN_YEAR
    const maxYear = Number.isInteger(options.maxYear)
      ? options.maxYear
      : currentYear + YEARS_CONFIG.FUTURE_OFFSET

    if (maxYear < minYear) {
      return [fallbackCurrentYear]
    }

    return Array.from(
      { length: maxYear - minYear + 1 },
      (_, index) => minYear + index
    )
  },
  // Vérifie si une année est supportée par l'interface.
  isSupportedYear: (year) => YEARS_CONFIG.getAvailableYears().includes(Number(year))
}

// Messages d'erreur centralisés
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Erreur de connexion au serveur',
  AUTH_FAILED: 'Identifiants incorrects',
  LOAD_FAILED: 'Impossible de charger les données',
  SAVE_FAILED: 'Erreur lors de la sauvegarde',
  NOT_FOUND: 'Ressource non trouvée'
}

// Messages de succès
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Connexion réussie',
  LOGOUT_SUCCESS: 'Déconnexion réussie',
  SAVE_SUCCESS: 'Sauvegarde réussie',
  DELETE_SUCCESS: 'Suppression réussie'
}

// Configuration des routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  PLANIFICATION: '/planification',
  PLANNING: '/planning',
  PLANIFICATION_VOTES: '/planning/:year/votes',
  PLANNING_VOTES_LEGACY: '/planification-votes/:year',
  GESTION_TPI: '/gestion-tpi',
  GESTION_TPI_LEGACY: '/gestionTPI',
  PARTIES_PRENANTES: '/parties-prenantes',
  PARTIES_PRENANTES_LEGACY: '/partiesPrenantes',
  SUIVI_ETUDIANTS: '/suivi-etudiants',
  SUIVI_ETUDIANTS_LEGACY: '/suiviEtudiants',
  SOUTENANCES: '/defenses',
  SOUTENANCES_LEGACY: '/Soutenances',
  SOUTENANCES_LEGACY_LOWER: '/soutenances',
  SOUTENANCE_LEGACY: '/Soutenance',
  SOUTENANCE_LEGACY_LOWER: '/soutenance',
  DEFENSE_LEGACY: '/defense',
  TPI_EVAL: '/evaluation',
  TPI_EVAL_LEGACY: '/TpiEval',
  GEN_TOKENS: '/acces-liens',
  GEN_TOKENS_LEGACY: '/genTokens'
}

// Durées (en millisecondes)
export const TIMEOUTS = {
  NOTIFICATION: 3000,
  API_REQUEST: 10000,
  DEBOUNCE: 300
}

// Configuration localStorage
export const STORAGE_KEYS = {
  IS_AUTHENTICATED: 'isAuthenticated',
  APP_SESSION_TOKEN: 'appSessionToken',
  PLANNING_SESSION_TOKEN: 'planningSessionToken',
  PLANNING_SELECTED_YEAR: 'planningSelectedYear',
  PLANNING_SOUTENANCE_DATES: 'planningSoutenanceDates',
  PLANNING_ROOM_NAMES: 'planningRoomNames',
  TPI_CARD_DETAIL_LEVEL: 'tpiCardDetailLevel',
  ORGANIZER_DATA: 'organizerData',
  EVALUATION_DATA: 'evaluationData',
  TPI_LIST: 'tpiList',
  PENDING_STAKEHOLDER_IMPORT: 'pendingStakeholderImport',
  PLANNING_USER: 'planningUser',
  USER_PREFERENCES: 'userPreferences'
}

// Export par défaut de toute la config
const config = {
  IS_DEBUG,
  IS_ADMIN_UI_ENABLED,
  TPI_TRACKER_SECRET,
  API_URL,
  YEARS_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  ROUTES,
  TIMEOUTS,
  STORAGE_KEYS
}

export default config
