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
import { authCoordinationService } from "./services/coordinationService"
import {
  STORAGE_KEYS,
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
const TokenGenerator = lazy(() => import("./components/genToken/genToken"))
const LoadingPage = lazy(() => import("./components/LoadingPage"))
const TpiEval = lazy(() => import("./components/tpiEval/TpiEval"))
const PartiesPrenantes = lazy(() => import("./components/partiesPrenantes/PartiesPrenantes"))
const PlanningConfiguration = lazy(() => import("./components/planningConfiguration/PlanningConfiguration"))
const TpiDetailPage = lazy(() => import("./components/tpiDetail/TpiDetailPage"))
const PlanningDashboard = lazy(() => import("./components/tpiPlanning/PlanningDashboard"))
const ResolutionProposalPage = lazy(() => import("./components/tpiPlanning/ResolutionProposalPage"))

// Chemins exclus de l'en-tête
const HEADER_EXCLUDED_PATHS = ['/', '/login']
const SOUTENANCE_PATH_REGEX = /^\/(?:defenses?|soutenance(?:s)?)\/\d{4}$/i
const RESOLUTION_PROPOSAL_PATH_REGEX = /^\/(?:(?:arbitrage|propose)-\d{4}|propose\/\d{4})\/[^/]+$/i
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
  ROUTES.TPI_EVAL_LEGACY
]
const PAGE_TOOLBAR_SELECTOR = "[data-page-toolbar='true']"
const PAGE_TOOLBAR_LAYOUT_EVENT = "tpi:page-toolbar-layout"

const isPlanningToolbarPage = (pathname) =>
  pathname === ROUTES.PLANIFICATION ||
  pathname === ROUTES.COORDINATION ||
  pathname.startsWith(`${ROUTES.COORDINATION}/`) ||
  pathname === ROUTES.COORDINATION_LEGACY ||
  pathname.startsWith(`${ROUTES.COORDINATION_LEGACY}/`) ||
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
    return "Chargement · TPI Organizer"
  }

  const moduleLabel = compactText(currentModule?.label)

  if (!moduleLabel || moduleLabel === "TPI Organizer") {
    return "TPI Organizer"
  }

  return `${moduleLabel} · TPI Organizer`
}

const getPreferredCoordinationYear = () => {
  const storedYear = Number.parseInt(
    readStorageValue(STORAGE_KEYS.COORDINATION_SELECTED_YEAR, ""),
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
    : getPreferredCoordinationYear()
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const hasMagicLink = queryParams.has('ml')
  const isVotePreview = queryParams.get('previewVote') === '1'
  const planningSessionToken = getStoredAuthToken('/api/coordination')
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
      authCoordinationService.clearSession()
    }

    setIsSessionNormalized(true)
  }, [shouldResetScopedVoteSession])

  useEffect(() => {
    if (YEARS_CONFIG.isSupportedYear(normalizedYear)) {
      writeStorageValue(STORAGE_KEYS.COORDINATION_SELECTED_YEAR, String(normalizedYear))
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
    return <Navigate to={`${ROUTES.COORDINATION}/${normalizedYear}${location.search || ''}`} replace />
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

const SPLASH_MIN_DURATION_MS = process.env.NODE_ENV === 'test' ? 0 : 2500

const waitForSplashDuration = async (startedAt) => {
  const remainingDuration = SPLASH_MIN_DURATION_MS - (Date.now() - startedAt)

  if (remainingDuration <= 0) {
    return
  }

  await new Promise((resolve) => setTimeout(resolve, remainingDuration))
}

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

const CanonicalRouteRedirect = ({ to }) => {
  const location = useLocation()

  return <Navigate to={`${to}${location.search || ''}`} replace />
}

const CoordinationLegacyRedirect = ({ preferredYear, includeVotesTab = false }) => {
  const { year } = useParams()
  const location = useLocation()
  const routeYear = Number.parseInt(year, 10)
  const targetYear = YEARS_CONFIG.isSupportedYear(routeYear)
    ? routeYear
    : preferredYear
  const searchParams = new URLSearchParams(location.search)

  if (includeVotesTab && !searchParams.has('tab')) {
    searchParams.set('tab', 'votes')
  }

  const search = searchParams.toString()

  return (
    <Navigate
      to={`${ROUTES.COORDINATION}/${targetYear}${search ? `?${search}` : ''}`}
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
const Layout = ({ isAuthenticated, isBootstrapping, refreshSession }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const isToolbarRoute = useMemo(() => isToolbarPage(location.pathname), [location.pathname])
  const [isArrowUp, setIsArrowUp] = useState(() =>
    shouldOpenToolbarByDefault(location.pathname)
  )
  const preferredPlanningYear = getPreferredCoordinationYear()
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
           !SOUTENANCE_PATH_REGEX.test(location.pathname) &&
           !RESOLUTION_PROPOSAL_PATH_REGEX.test(location.pathname)
  }, [location.pathname])

  const isToolbarCollapsed = useMemo(() => {
    return isToolbarRoute && !isArrowUp
  }, [isArrowUp, isToolbarRoute])
  const getToolbarElement = useCallback(
    () => document.querySelector(PAGE_TOOLBAR_SELECTOR),
    []
  )

  // Redirection de l'ancien chemin de connexion vers l'accueil
  useEffect(() => {
    if (isAuthenticated && location.pathname === '/login') {
      navigate("/")
    }
  }, [isAuthenticated, navigate, location.pathname])

  useEffect(() => {
    const handleSessionExpired = () => {
      refreshSession({ silent: true })
      toast.warning("Session renouvelee automatiquement.", {
        toastId: 'app-session-expired'
      })
    }

    window.addEventListener('tpi:auth-expired', handleSessionExpired)

    return () => {
      window.removeEventListener('tpi:auth-expired', handleSessionExpired)
    }
  }, [refreshSession])

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

  if (isBootstrapping) {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <LoadingPage />
      </Suspense>
    )
  }

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

            </div>
          </div>
        </div>
      )}

      {/* Configuration des Routes */}
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          {/* Redirection par défaut vers l'ancien chemin de chargement si la session auto échoue */}
          {!isAuthenticated && (
            <Route path='*' element={<Navigate to='/login' replace />} />
          )}

          {/* Ancienne route de connexion: ecran de chargement seulement */}
          <Route path='/login' element={<LoadingPage />} />

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
                element={<CanonicalRouteRedirect to={ROUTES.GESTION_TPI} />}
              />
              <Route
                path={ROUTES.PARTIES_PRENANTES}
                element={<PartiesPrenantes />}
              />
              <Route
                path={ROUTES.PARTIES_PRENANTES_LEGACY}
                element={<CanonicalRouteRedirect to={ROUTES.PARTIES_PRENANTES} />}
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
                element={<CanonicalRouteRedirect to={ROUTES.GEN_TOKENS} />}
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
            path={ROUTES.COORDINATION}
            element={<Navigate to={`${ROUTES.COORDINATION}/${preferredPlanningYear}`} replace />}
          />
          <Route
            path={`${ROUTES.COORDINATION}/:year`}
            element={
              <PlanningVotesRoute
                isAuthenticated={isAuthenticated}
                toggleArrow={toggleArrow}
                isArrowUp={isArrowUp}
              />
            }
          />
          <Route
            path={ROUTES.COORDINATION_VOTES}
            element={
              <PlanningVotesRoute
                isAuthenticated={isAuthenticated}
                toggleArrow={toggleArrow}
                isArrowUp={isArrowUp}
              />
            }
          />
          <Route
            path={ROUTES.COORDINATION_LEGACY}
            element={<CoordinationLegacyRedirect preferredYear={preferredPlanningYear} />}
          />
          <Route
            path={`${ROUTES.COORDINATION_LEGACY}/:year`}
            element={<CoordinationLegacyRedirect preferredYear={preferredPlanningYear} />}
          />
          <Route
            path={ROUTES.COORDINATION_VOTES_LEGACY}
            element={<CoordinationLegacyRedirect preferredYear={preferredPlanningYear} includeVotesTab />}
          />
          <Route
            path={ROUTES.PLANIFICATION_VOTES_LEGACY}
            element={
              <CoordinationLegacyRedirect preferredYear={preferredPlanningYear} includeVotesTab />
            }
          />
          {YEARS_CONFIG.getAvailableYears().map((proposalYear) => (
            <Fragment key={`arbitrage-links-${proposalYear}`}>
              <Route
                path={`/arbitrage-${proposalYear}/:token`}
                element={<ResolutionProposalPage year={proposalYear} />}
              />
              <Route
                path={`/propose-${proposalYear}/:token`}
                element={<ResolutionProposalPage year={proposalYear} />}
              />
            </Fragment>
          ))}
          <Route
            path='/propose/:year/:token'
            element={<ResolutionProposalPage />}
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
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  const refreshSession = useCallback(async ({ silent = false } = {}) => {
    const splashStartedAt = Date.now()

    if (!silent) {
      setIsBootstrapping(true)
    }

    try {
      const existingSessionToken = getStoredAuthToken('/api')

      if (existingSessionToken && !silent) {
        writeStorageValue(STORAGE_KEYS.IS_AUTHENTICATED, "true")
        setIsAuthenticated(true)
        return
      }

      const data = await authService.startSession()

      if (data.success && data.token) {
        writeStorageValue(STORAGE_KEYS.IS_AUTHENTICATED, "true")
        writeStorageValue(STORAGE_KEYS.APP_SESSION_TOKEN, data.token)
        setIsAuthenticated(true)
        return
      }

      throw new Error(data.message || "Impossible de demarrer la session")
    } catch (error) {
      console.error("Erreur au demarrage de la session:", error)
      removeStorageValue(STORAGE_KEYS.IS_AUTHENTICATED)
      removeStorageValue(STORAGE_KEYS.APP_SESSION_TOKEN)
      setIsAuthenticated(false)
      toast.error("Impossible de demarrer la session de l'application.", {
        toastId: 'app-session-start-failed'
      })
    } finally {
      if (!silent) {
        await waitForSplashDuration(splashStartedAt)
        setIsBootstrapping(false)
      }
    }
  }, [])

  useEffect(() => {
    refreshSession()
  }, [refreshSession])

  return (
    <Router>
      <Layout
        isAuthenticated={isAuthenticated}
        isBootstrapping={isBootstrapping}
        refreshSession={refreshSession}
      />
    </Router>
  )
}
//#endregion

export default App
