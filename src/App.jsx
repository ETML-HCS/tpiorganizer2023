import React, { Fragment, Suspense, lazy, useState, useEffect, useCallback, useMemo, useLayoutEffect } from "react"
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
  useParams
} from "react-router-dom"

import Footer from "./components/footer/Footer"
import { ChevronDownIcon, WrenchIcon } from "./components/shared/InlineIcons"

import { toast } from "react-toastify"

import { authService } from "./services/apiService"
import { authPlanningService } from "./services/planningService"
import {
  STORAGE_KEYS,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  IS_ADMIN_UI_ENABLED,
  YEARS_CONFIG
} from "./config/appConfig"
import {
  getStoredAuthToken,
  decodeJwtPayload,
  readStorageValue,
  removeStorageValue,
  writeStorageValue
} from "./utils/storage"

import "./css/globalStyles.css"

const Home = lazy(() => import("./components/Home"))
const TpiSchedule = lazy(() => import("./components/tpiSchedule/TpiSchedule"))
const TpiManagement = lazy(() => import("./components/tpiManagement/TpiManagement"))
const TpiTracker = lazy(() => import("./components/tpiTracker/TpiTracker"))
const TpiSoutenance = lazy(() => import("./components/tpiSoutenance/TpiSoutenance"))
const TokenGenerator = lazy(() => import("./components/genToken/GenToken"))
const LoginPage = lazy(() => import("./components/LoginPage"))
const TpiEval = lazy(() => import("./components/tpiEval/TpiEval"))
const PartiesPrenantes = lazy(() => import("./components/partiesPrenantes/PartiesPrenantes"))
const PlanningConfiguration = lazy(() => import("./components/planningConfiguration/PlanningConfiguration"))
const TpiDetailPage = lazy(() => import("./components/tpiDetail/TpiDetailPage"))
const PlanningDashboard = lazy(() => import("./components/tpiPlanning/PlanningDashboard"))

// Chemins exclus de l'en-tête
const HEADER_EXCLUDED_PATHS = ['/', '/login']
const SOUTENANCE_PATH_REGEX = /^\/Soutenances\/\d{4}$/i
const TOOLBAR_DEFAULT_OPEN_PATHS = [
  '/planification',
  '/gestionTPI',
  '/partiesPrenantes',
  '/genTokens',
  '/TpiEval'
]

const isToolbarPage = (pathname) =>
  TOOLBAR_DEFAULT_OPEN_PATHS.includes(pathname) ||
  pathname === '/planning' ||
  pathname.startsWith('/planning/') ||
  pathname.startsWith('/tpi/')

const compactText = (value) => {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

const getConnectedUserName = ({ isAuthenticated, appSessionToken, planningSessionToken }) => {
  const appSessionPayload = decodeJwtPayload(appSessionToken)
  const planningSessionPayload = decodeJwtPayload(planningSessionToken)
  const planningSessionUser = authPlanningService.getCurrentUser()

  if (planningSessionPayload?.authContext?.type === 'vote_magic_link') {
    const userName = compactText(
      planningSessionUser?.name ||
      planningSessionUser?.email ||
      planningSessionPayload?.email ||
      planningSessionPayload?.sub
    )
    const roleLabel = compactText(planningSessionPayload?.authContext?.role)

    if (userName) {
      return roleLabel ? `${userName} (${roleLabel})` : userName
    }

    return 'mode vote'
  }

  if (isAuthenticated) {
    const adminLabel = compactText(
      appSessionPayload?.sub ||
      appSessionPayload?.email ||
      'admin'
    )

    return adminLabel
  }

  return ""
}

const getPreferredPlanningYear = () => {
  const storedYear = Number.parseInt(
    readStorageValue(STORAGE_KEYS.PLANNING_SELECTED_YEAR, ""),
    10
  )

  if (YEARS_CONFIG.isSupportedYear(storedYear)) {
    return storedYear
  }

  return YEARS_CONFIG.getCurrentYear()
}

const PlanningVotesRoute = ({ isAuthenticated, toggleArrow, isArrowUp }) => {
  const { year } = useParams()
  const location = useLocation()
  const routeYear = Number.parseInt(year, 10)
  const normalizedYear = YEARS_CONFIG.isSupportedYear(routeYear)
    ? routeYear
    : getPreferredPlanningYear()
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const hasMagicLink = queryParams.has('ml')
  const isVotePreview = queryParams.get('previewVote') === '1'
  const planningSessionToken = getStoredAuthToken('/api/planning')
  const planningSessionPayload = useMemo(
    () => decodeJwtPayload(planningSessionToken),
    [planningSessionToken]
  )
  const hasVoteMagicLinkSession = planningSessionPayload?.authContext?.type === 'vote_magic_link'
  const hasPlanningSession = Boolean(planningSessionToken)
  const shouldResetScopedVoteSession = Boolean(
    isAuthenticated &&
    IS_ADMIN_UI_ENABLED &&
    !hasMagicLink &&
    !isVotePreview &&
    hasVoteMagicLinkSession
  )
  const [isSessionNormalized, setIsSessionNormalized] = useState(() => !shouldResetScopedVoteSession)

  useEffect(() => {
    if (shouldResetScopedVoteSession) {
      authPlanningService.clearSession()
    }

    setIsSessionNormalized(true)
  }, [shouldResetScopedVoteSession])

  useEffect(() => {
    if (YEARS_CONFIG.isSupportedYear(normalizedYear)) {
      writeStorageValue(STORAGE_KEYS.PLANNING_SELECTED_YEAR, String(normalizedYear))
    }
  }, [normalizedYear])

  if (!isSessionNormalized) {
    return (
      <div className="planning-dashboard loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Retour a la vue globale...</p>
        </div>
      </div>
    )
  }

  if (!YEARS_CONFIG.isSupportedYear(routeYear)) {
    return <Navigate to={`/planning/${normalizedYear}`} replace />
  }

  const isAdminView = Boolean(
    isAuthenticated &&
    IS_ADMIN_UI_ENABLED &&
    !hasMagicLink &&
    !isVotePreview &&
    !hasVoteMagicLinkSession
  )

  if (!isAuthenticated && !hasPlanningSession && !hasMagicLink) {
    return <Navigate to='/login' replace />
  }

  return (
    <PlanningDashboard
      year={normalizedYear}
      isAdmin={isAdminView}
      toggleArrow={toggleArrow}
      isArrowUp={isArrowUp}
    />
  )
}

const RouteLoadingFallback = () => (
  <div className="planning-dashboard loading">
    <div className="loading-spinner">
      <div className="spinner"></div>
      <p>Chargement de la page...</p>
    </div>
  </div>
)

//#region Layout
const Layout = ({ isAuthenticated, login, logout }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const isToolbarRoute = useMemo(() => isToolbarPage(location.pathname), [location.pathname])
  const [isArrowUp, setIsArrowUp] = useState(() => isToolbarRoute)
  const appSessionToken = getStoredAuthToken('/api/me')
  const planningSessionToken = getStoredAuthToken('/api/planning')
  const connectedUserName = useMemo(
    () => getConnectedUserName({
      isAuthenticated,
      appSessionToken,
      planningSessionToken
    }),
    [appSessionToken, isAuthenticated, planningSessionToken]
  )
  const preferredPlanningYear = getPreferredPlanningYear()
  // Mémoriser la date formatée pour éviter les recalculs
  const dateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('fr-CH')
  }, [])

  // Fonction mémorisée pour déterminer si l'en-tête doit être affiché
  const shouldShowHeader = useMemo(() => {
    return !HEADER_EXCLUDED_PATHS.includes(location.pathname) &&
           !SOUTENANCE_PATH_REGEX.test(location.pathname)
  }, [location.pathname])

  const isToolbarCollapsed = useMemo(() => {
    return isToolbarRoute && !isArrowUp
  }, [isArrowUp, isToolbarRoute])
  const getToolbarElement = useCallback(
    () => document.querySelector("[data-page-toolbar='true']"),
    []
  )

  // Redirection après authentification
  useEffect(() => {
    if (isAuthenticated && location.pathname === '/login') {
      navigate("/")
    }
  }, [isAuthenticated, navigate, location.pathname])

  useEffect(() => {
    const handleSessionExpired = () => {
      if (!isAuthenticated) {
        return
      }

      logout()
      navigate('/login', { replace: true })
      toast.warning("Session expirée. Veuillez vous reconnecter.", {
        toastId: 'app-session-expired'
      })
    }

    window.addEventListener('tpi:auth-expired', handleSessionExpired)

    return () => {
      window.removeEventListener('tpi:auth-expired', handleSessionExpired)
    }
  }, [isAuthenticated, logout, navigate])

  useEffect(() => {
    setIsArrowUp(isToolbarRoute)
  }, [isToolbarRoute])

  useLayoutEffect(() => {
    if (!isToolbarRoute) {
      return
    }

    const toolsElement = getToolbarElement()
    const upArrowButton = document.getElementById("upArrowButton")
    const downArrowButton = document.getElementById("downArrowButton")

    if (toolsElement) {
      toolsElement.style.display = isArrowUp ? "block" : "none"
    }

    if (upArrowButton) {
      upArrowButton.style.display = "none"
    }

    if (downArrowButton) {
      downArrowButton.style.display = "inline-flex"
    }
  }, [getToolbarElement, isArrowUp, isToolbarRoute, location.pathname])

  useLayoutEffect(() => {
    const rootElement = document.documentElement
    const headerElement = document.getElementById("header")
    const toolsElement = isToolbarRoute ? getToolbarElement() : null

    if (!rootElement) {
      return undefined
    }

    const updateLayoutMetrics = () => {
      const headerHeight = headerElement
        ? Math.ceil(headerElement.getBoundingClientRect().height)
        : 0
      const toolsHeight =
        isToolbarRoute && isArrowUp && toolsElement && toolsElement.style.display !== "none"
          ? Math.ceil(toolsElement.getBoundingClientRect().height)
          : 0
      const contentOffset = Math.max(headerHeight + toolsHeight + 12, headerHeight + 12, 72)

      rootElement.style.setProperty("--app-header-height", `${Math.max(headerHeight, 0)}px`)
      rootElement.style.setProperty("--app-tools-height", `${Math.max(toolsHeight, 0)}px`)
      if (location.pathname === "/planification") {
        rootElement.style.setProperty("--room-padding-top", isArrowUp ? "210px" : "30px")
      } else {
        rootElement.style.setProperty("--room-padding-top", `${contentOffset}px`)
      }
    }

    updateLayoutMetrics()

    const observers = []

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        updateLayoutMetrics()
      })

      if (headerElement) {
        observer.observe(headerElement)
      }

      if (toolsElement) {
        observer.observe(toolsElement)
      }

      observers.push(observer)
    }

    window.addEventListener("resize", updateLayoutMetrics)

    return () => {
      window.removeEventListener("resize", updateLayoutMetrics)
      observers.forEach((observer) => observer.disconnect())
    }
  }, [getToolbarElement, isArrowUp, isToolbarRoute, location.pathname])

  // Toggle arrow mémorisé avec useCallback
  const toggleArrow = useCallback(() => {
    const elementTools = getToolbarElement()
    const downArrowButton = document.getElementById("downArrowButton")

    if (!elementTools) {
      return
    }

    setIsArrowUp((prev) => {
      const newState = !prev
      elementTools.style.display = newState ? "block" : "none"
      if (downArrowButton) {
        downArrowButton.style.display = "inline-flex"
        downArrowButton.classList.toggle("active", !newState)
      }
      return newState
    })
  }, [getToolbarElement])

  // Handler de déconnexion
  const handleLogout = useCallback(() => {
    logout()
    navigate('/login')
    toast.info("Déconnexion réussie")
  }, [logout, navigate])

  return (
    <Fragment>
      <div id='popup'>
        <div id='popup-content'></div>
      </div>

      {/* Entête */}
        {shouldShowHeader && (
        <div
          id='header'
          className={`app-header ${
            isToolbarCollapsed ? "app-header-translucent" : ""
          }`.trim()}
        >
          <div id='title' className='app-header-top'>
            <div id='left' className='app-header-brand'>
              <span className='app-header-brand-mark'>
                <span className='etml'>ETML</span>
                <span className='app-header-brand-sep'>/</span>
                <span className='cfpv'>CFPV</span>
              </span>
            </div>

            <div className='app-header-center'>
              <span className='app-header-date'>{dateFormatted}</span>
              <div id='page-header-center-slot' className='app-header-page-slot'></div>
            </div>

            <div id='right' className='app-header-meta app-header-meta-session'>
              <div id='planning-header-slot' className='app-header-planification-slot'></div>
              {isToolbarRoute ? (
                <button
                  onClick={toggleArrow}
                  id='downArrowButton'
                  className={`collapse-toggle app-header-tools-toggle ${
                    isArrowUp ? 'active' : ''
                  }`.trim()}
                  aria-expanded={isArrowUp}
                  aria-label={
                    isArrowUp
                      ? "Masquer les outils"
                      : "Afficher les outils"
                  }
                  title={
                    isArrowUp
                      ? "Masquer les outils"
                      : "Afficher les outils"
                  }
                >
                  <span className='sr-only'>Outils</span>
                  <span className='app-header-tools-toggle-glyph' aria-hidden='true'>
                    <WrenchIcon />
                  </span>
                  <span className='collapse-toggle-icon' aria-hidden='true'>
                    <ChevronDownIcon />
                  </span>
                </button>
              ) : null}

              {isAuthenticated ? (
                <div className='app-header-session-pill'>
                  <button
                    onClick={handleLogout}
                    className='app-header-session-logout logout-btn'
                    title='Se déconnecter'
                    aria-label='Se déconnecter'
                  >
                    <span className='app-header-session-logout-name'>
                      {connectedUserName || 'Session'}
                    </span>
                    <span className='app-header-session-logout-icon' aria-hidden='true'>
                      ⎋
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Configuration des Routes */}
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          {/* Redirection par défaut vers la page de connexion si non authentifié */}
          {!isAuthenticated && (
            <Route path='*' element={<Navigate to='/login' replace />} />
          )}

          {/* Route pour la page de connexion */}
          <Route path='/login' element={<LoginPage login={login} />} />

          {/* Routes protégées => authentifié */}
          {isAuthenticated && (
            <>
              <Route path='/' element={<Home />} />
              <Route
                path='/planification'
                element={
                  <TpiSchedule
                    toggleArrow={toggleArrow}
                    isArrowUp={isArrowUp}
                  />
                }
              />
              <Route
                path='/planification/legacy'
                element={<Navigate to='/planification' replace />}
              />
              <Route
                path='/configuration'
                element={<PlanningConfiguration />}
              />
              <Route
                path='/gestionTPI'
                element={
                  <TpiManagement
                    toggleArrow={toggleArrow}
                    isArrowUp={isArrowUp}
                  />
                }
              />
              <Route
                path='/partiesPrenantes'
                element={
                  <PartiesPrenantes
                    toggleArrow={toggleArrow}
                    isArrowUp={isArrowUp}
                  />
                }
              />
              <Route
                path='/suiviEtudiants'
                element={<TpiTracker />}
              />
              <Route
                path='/genTokens'
                element={
                  <TokenGenerator
                    toggleArrow={toggleArrow}
                    isArrowUp={isArrowUp}
                  />
                }
              />
              <Route
                path='/tpi/:year/:ref'
                element={
                  <TpiDetailPage
                    toggleArrow={toggleArrow}
                    isArrowUp={isArrowUp}
                  />
                }
              />
              <Route path='*' element={<Navigate to='/' replace />} />
            </>
          )}

          {/* Routes toujours accessibles, authentifié ou non */}
          <Route
            path='/planning'
            element={<Navigate to={`/planning/${preferredPlanningYear}`} replace />}
          />
          <Route
            path='/planning/:year'
            element={
              <PlanningVotesRoute
                isAuthenticated={isAuthenticated}
                toggleArrow={toggleArrow}
                isArrowUp={isArrowUp}
              />
            }
          />
          <Route
            path='/planification-votes/:year'
            element={
              <PlanningVotesRoute
                isAuthenticated={isAuthenticated}
                toggleArrow={toggleArrow}
                isArrowUp={isArrowUp}
              />
            }
          />
          <Route path='/Soutenances/:year' element={<TpiSoutenance />} />
          <Route
            path='/TpiEval'
            element={<TpiEval toggleArrow={toggleArrow} isArrowUp={isArrowUp} />}
          />
        </Routes>
      </Suspense>

      {/* Pied de page */}
      <Footer />
    </Fragment>
  )
}
//#endregion

//#region APP
const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const legacyAuthFlag = readStorageValue(STORAGE_KEYS.IS_AUTHENTICATED, "") === "true"
    const sessionToken = getStoredAuthToken('/api')

    if (legacyAuthFlag && !sessionToken) {
      removeStorageValue(STORAGE_KEYS.IS_AUTHENTICATED)
      return false
    }

    return Boolean(sessionToken)
  })
  const [isLoading, setIsLoading] = useState(false)

  const loginSecur = useCallback(async (username, password) => {
    if (isLoading) return
    
    setIsLoading(true)
    try {
      const data = await authService.login(username, password)

      if (data.success && data.token) {
        setIsAuthenticated(true)
        writeStorageValue(STORAGE_KEYS.IS_AUTHENTICATED, "true")
        writeStorageValue(STORAGE_KEYS.APP_SESSION_TOKEN, data.token)
        toast.success(SUCCESS_MESSAGES.LOGIN_SUCCESS)
        return data
      }
      throw new Error(data.message || ERROR_MESSAGES.AUTH_FAILED)
    } catch (error) {
      console.error('Erreur de connexion:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [isLoading])

  const logout = useCallback(() => {
    setIsAuthenticated(false)
    removeStorageValue(STORAGE_KEYS.IS_AUTHENTICATED)
    removeStorageValue(STORAGE_KEYS.APP_SESSION_TOKEN)
  }, [])

  return (
    <Router>
      <Layout
        isAuthenticated={isAuthenticated}
        login={loginSecur}
        logout={logout}
      />
    </Router>
  )
}
//#endregion

export default App
