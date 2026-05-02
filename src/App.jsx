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
import { MAIN_NAVIGATION_LINKS } from "./components/shared/mainNavigation"

import { toast } from "react-toastify"

import { authService } from "./services/apiService"
import { authPlanningService } from "./services/planningService"
import {
  STORAGE_KEYS,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  IS_ADMIN_UI_ENABLED,
  YEARS_CONFIG,
  ROUTES
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
const SOUTENANCE_PATH_REGEX = /^\/(?:defenses?|soutenance(?:s)?)\/\d{4}$/i
const SOUTENANCE_ROUTE_ALIASES = [
  ROUTES.SOUTENANCES_LEGACY,
  ROUTES.SOUTENANCES_LEGACY_LOWER,
  ROUTES.SOUTENANCE_LEGACY,
  ROUTES.SOUTENANCE_LEGACY_LOWER,
  ROUTES.DEFENSE_LEGACY
]
const APP_HEADER_MODULE_LINKS = [
  ...MAIN_NAVIGATION_LINKS,
  {
    label: "Suivi des profils",
    title: "Suivi des profils",
    match: [ROUTES.SUIVI_ETUDIANTS, ROUTES.SUIVI_ETUDIANTS_LEGACY]
  },
  {
    label: "Défenses",
    title: "Agenda des défenses",
    match: [
      ROUTES.SOUTENANCES,
      `${ROUTES.SOUTENANCES}/`,
      ...SOUTENANCE_ROUTE_ALIASES,
      ...SOUTENANCE_ROUTE_ALIASES.map((routePath) => `${routePath}/`)
    ]
  }
]
const STATIC_TOOLBAR_PATHS = [
  ROUTES.PLANIFICATION,
  ROUTES.GESTION_TPI,
  '/configuration',
  ROUTES.GEN_TOKENS,
  ROUTES.TPI_EVAL,
  ROUTES.GESTION_TPI_LEGACY,
  ROUTES.GEN_TOKENS_LEGACY,
  ROUTES.TPI_EVAL_LEGACY
]
const PAGE_TOOLBAR_SELECTOR = "[data-page-toolbar='true']"
const PAGE_TOOLBAR_LAYOUT_EVENT = "tpi:page-toolbar-layout"

const isPlanningToolbarPage = (pathname) =>
  pathname === ROUTES.PLANIFICATION ||
  pathname === ROUTES.PLANNING ||
  pathname.startsWith(`${ROUTES.PLANNING}/`) ||
  pathname.startsWith('/planification-votes/')

const isToolbarPage = (pathname) =>
  STATIC_TOOLBAR_PATHS.includes(pathname) ||
  isPlanningToolbarPage(pathname) ||
  pathname.startsWith('/tpi/')

const shouldOpenToolbarByDefault = (pathname) =>
  isToolbarPage(pathname) && !isPlanningToolbarPage(pathname)

const isVisibleFixedToolbar = (element) => {
  if (!element || typeof window === "undefined") {
    return false
  }

  const style = window.getComputedStyle(element)

  return style.position === "fixed" &&
    style.display !== "none" &&
    style.visibility !== "hidden"
}

const compactText = (value) => {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

const routePatternMatchesPathname = (pathname, routePattern) => {
  const normalizedPattern = compactText(routePattern)

  if (!normalizedPattern) {
    return false
  }

  if (normalizedPattern === "/") {
    return pathname === "/"
  }

  if (normalizedPattern.includes(":")) {
    const dynamicSegmentIndex = normalizedPattern.indexOf(":")
    const staticPrefix = normalizedPattern.slice(0, dynamicSegmentIndex)

    return pathname.startsWith(staticPrefix)
  }

  if (normalizedPattern.endsWith("/")) {
    return pathname.startsWith(normalizedPattern)
  }

  return pathname === normalizedPattern
}

const getAppHeaderModule = (pathname) => {
  const moduleLink = APP_HEADER_MODULE_LINKS.find((link) =>
    (link.match || [link.to]).some((routePattern) =>
      routePatternMatchesPathname(pathname, routePattern)
    )
  )

  return {
    label: moduleLink?.label || "TPI Organizer",
    title: moduleLink?.title || moduleLink?.label || "TPI Organizer"
  }
}

const getBrowserTitle = (pathname, currentModule) => {
  if (pathname === "/login") {
    return "Connexion · TPI Organizer"
  }

  const moduleLabel = compactText(currentModule?.label)

  if (!moduleLabel || moduleLabel === "TPI Organizer") {
    return "TPI Organizer"
  }

  return `${moduleLabel} · TPI Organizer`
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

const SoutenanceRedirect = ({ preferredYear }) => {
  const { year } = useParams()
  const location = useLocation()
  const routeYear = Number.parseInt(year, 10)
  const targetYear = YEARS_CONFIG.isSupportedYear(routeYear)
    ? routeYear
    : preferredYear

  return (
    <Navigate
      to={`${ROUTES.SOUTENANCES}/${targetYear}${location.search || ''}`}
      replace
    />
  )
}

const hasSoutenanceAccessParam = (search = "") => {
  const queryParams = new URLSearchParams(search)

  return ['ml', 'token', 'code'].some((key) =>
    typeof queryParams.get(key) === 'string' &&
    queryParams.get(key).trim().length > 0
  )
}

const SoutenanceRoute = ({ isAuthenticated }) => {
  const location = useLocation()

  if (!isAuthenticated && !hasSoutenanceAccessParam(location.search)) {
    return <Navigate to='/login' replace />
  }

  return <TpiSoutenance />
}

//#region Layout
const Layout = ({ isAuthenticated, login, logout }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const isToolbarRoute = useMemo(() => isToolbarPage(location.pathname), [location.pathname])
  const [isArrowUp, setIsArrowUp] = useState(() =>
    shouldOpenToolbarByDefault(location.pathname)
  )
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
  const currentModule = useMemo(
    () => getAppHeaderModule(location.pathname),
    [location.pathname]
  )

  useEffect(() => {
    if (typeof document === "undefined") {
      return
    }

    document.title = getBrowserTitle(location.pathname, currentModule)
  }, [currentModule, location.pathname])

  // Fonction mémorisée pour déterminer si l'en-tête doit être affiché
  const shouldShowHeader = useMemo(() => {
    return !HEADER_EXCLUDED_PATHS.includes(location.pathname) &&
           !SOUTENANCE_PATH_REGEX.test(location.pathname)
  }, [location.pathname])

  const isToolbarCollapsed = useMemo(() => {
    return isToolbarRoute && !isArrowUp
  }, [isArrowUp, isToolbarRoute])
  const getToolbarElement = useCallback(
    () => document.querySelector(PAGE_TOOLBAR_SELECTOR),
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
    setIsArrowUp(shouldOpenToolbarByDefault(location.pathname))
  }, [location.pathname])

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
    if (!rootElement) {
      return undefined
    }

    let resizeObserver = null
    let observedHeaderElement = null
    let observedToolsElement = null

    const observeLayoutElement = (element, target) => {
      if (!resizeObserver || !element) {
        return
      }

      if (target === "header" && observedHeaderElement !== element) {
        if (observedHeaderElement) {
          resizeObserver.unobserve(observedHeaderElement)
        }
        resizeObserver.observe(element)
        observedHeaderElement = element
      }

      if (target === "tools" && observedToolsElement !== element) {
        if (observedToolsElement) {
          resizeObserver.unobserve(observedToolsElement)
        }
        resizeObserver.observe(element)
        observedToolsElement = element
      }
    }

    const updateLayoutMetrics = () => {
      const headerElement = document.getElementById("header")
      const toolsElement = isToolbarRoute ? getToolbarElement() : null
      observeLayoutElement(headerElement, "header")
      observeLayoutElement(toolsElement, "tools")
      const headerHeight = headerElement
        ? Math.ceil(headerElement.getBoundingClientRect().height)
        : 0
      const toolsHeight =
        isToolbarRoute && isArrowUp && isVisibleFixedToolbar(toolsElement)
          ? Math.ceil(toolsElement.getBoundingClientRect().height)
          : 0
      const contentOffset = Math.max(headerHeight + toolsHeight + 12, headerHeight + 12, 72)

      rootElement.style.setProperty("--app-header-height", `${Math.max(headerHeight, 0)}px`)
      rootElement.style.setProperty("--app-tools-height", `${Math.max(toolsHeight, 0)}px`)
      if (location.pathname === ROUTES.PLANIFICATION) {
        rootElement.style.setProperty("--room-padding-top", isArrowUp ? "210px" : "30px")
      } else {
        rootElement.style.setProperty("--room-padding-top", `${contentOffset}px`)
      }
    }

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        updateLayoutMetrics()
      })
    }

    updateLayoutMetrics()

    window.addEventListener("resize", updateLayoutMetrics)
    window.addEventListener(PAGE_TOOLBAR_LAYOUT_EVENT, updateLayoutMetrics)

    return () => {
      window.removeEventListener("resize", updateLayoutMetrics)
      window.removeEventListener(PAGE_TOOLBAR_LAYOUT_EVENT, updateLayoutMetrics)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
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
              <span className='app-header-module' title={currentModule.title}>
                <span className='app-header-module-kicker'>Module</span>
                <span className='app-header-module-name'>{currentModule.label}</span>
              </span>
            </div>

            <div className='app-header-center'>
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
                  <span className='app-header-tools-toggle-label' aria-hidden='true'>
                    Outils
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
                path={ROUTES.PLANIFICATION}
                element={
                  <TpiSchedule
                    toggleArrow={toggleArrow}
                    isArrowUp={isArrowUp}
                  />
                }
              />
              <Route
                path='/planification/legacy'
                element={<Navigate to={ROUTES.PLANIFICATION} replace />}
              />
              <Route
                path='/configuration'
                element={
                  <PlanningConfiguration
                    toggleArrow={toggleArrow}
                    isArrowUp={isArrowUp}
                  />
                }
              />
              <Route
                path={ROUTES.GESTION_TPI}
                element={
                  <TpiManagement
                    toggleArrow={toggleArrow}
                    isArrowUp={isArrowUp}
                  />
                }
              />
              <Route
                path={ROUTES.GESTION_TPI_LEGACY}
                element={
                  <TpiManagement
                    toggleArrow={toggleArrow}
                    isArrowUp={isArrowUp}
                  />
                }
              />
              <Route
                path={ROUTES.PARTIES_PRENANTES}
                element={<PartiesPrenantes />}
              />
              <Route
                path={ROUTES.PARTIES_PRENANTES_LEGACY}
                element={<PartiesPrenantes />}
              />
              <Route
                path={ROUTES.SUIVI_ETUDIANTS}
                element={<TpiTracker />}
              />
              <Route
                path={ROUTES.SUIVI_ETUDIANTS_LEGACY}
                element={<TpiTracker />}
              />
              <Route
                path={ROUTES.GEN_TOKENS}
                element={
                  <TokenGenerator
                    toggleArrow={toggleArrow}
                    isArrowUp={isArrowUp}
                  />
                }
              />
              <Route
                path={ROUTES.GEN_TOKENS_LEGACY}
                element={
                  <TokenGenerator
                    toggleArrow={toggleArrow}
                    isArrowUp={isArrowUp}
                  />
                }
              />
              <Route
                path={ROUTES.TPI_EVAL}
                element={<TpiEval toggleArrow={toggleArrow} isArrowUp={isArrowUp} />}
              />
              <Route
                path={ROUTES.TPI_EVAL_LEGACY}
                element={<TpiEval toggleArrow={toggleArrow} isArrowUp={isArrowUp} />}
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
            path={`${ROUTES.PLANNING}/:year`}
            element={
              <PlanningVotesRoute
                isAuthenticated={isAuthenticated}
                toggleArrow={toggleArrow}
                isArrowUp={isArrowUp}
              />
            }
          />
          <Route
            path={ROUTES.PLANIFICATION_VOTES}
            element={
              <PlanningVotesRoute
                isAuthenticated={isAuthenticated}
                toggleArrow={toggleArrow}
                isArrowUp={isArrowUp}
              />
            }
          />
          <Route
            path={ROUTES.PLANIFICATION_VOTES_LEGACY}
            element={
              <PlanningVotesRoute
                isAuthenticated={isAuthenticated}
                toggleArrow={toggleArrow}
                isArrowUp={isArrowUp}
              />
            }
          />
          <Route
            path={ROUTES.SOUTENANCES}
            element={
              <SoutenanceRedirect preferredYear={preferredPlanningYear} />
            }
          />
          {SOUTENANCE_ROUTE_ALIASES.map((routePath) => (
            <Route
              key={routePath}
              path={routePath}
              element={<SoutenanceRedirect preferredYear={preferredPlanningYear} />}
            />
          ))}
          <Route
            path={`${ROUTES.SOUTENANCES}/:year`}
            element={<SoutenanceRoute isAuthenticated={isAuthenticated} />}
          />
          {SOUTENANCE_ROUTE_ALIASES.map((routePath) => (
            <Route
              key={`${routePath}/:year`}
              path={`${routePath}/:year`}
              element={<SoutenanceRedirect preferredYear={preferredPlanningYear} />}
            />
          ))}
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
