import React, { Fragment, useState, useEffect, useCallback, useMemo, useLayoutEffect } from "react"
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
  useNavigate,
  useParams
} from "react-router-dom"

import Home from "./components/Home"
import TpiSchedule from "./components/tpiSchedule/TpiSchedule"
import TpiManagement from "./components/tpiManagement/TpiManagement"
import TpiTracker from "./components/tpiTracker/TpiTracker"
import TpiSoutenance from "./components/tpiSoutenance/TpiSoutenance"
import TokenGenerator from "./components/genToken/GenToken"
import LoginPage from "./components/LoginPage"
import TpiEval from "./components/tpiEval/TpiEval"
import PartiesPrenantes from "./components/partiesPrenantes/PartiesPrenantes"
import PlanningConfiguration from "./components/planningConfiguration/PlanningConfiguration"
import Footer from "./components/footer/Footer"
import { PlanningDashboard } from "./components/tpiPlanning"

import { toast } from "react-toastify"

import { authService } from "./services/apiService"
import { authPlanningService } from "./services/planningService"
import {
  STORAGE_KEYS,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  IS_ADMIN_UI_ENABLED
} from "./config/appConfig"
import {
  getStoredAuthToken,
  decodeJwtPayload,
  readStorageValue,
  removeStorageValue,
  writeStorageValue
} from "./utils/storage"

import "./css/globalStyles.css"

// Chemins exclus de l'en-tête
const HEADER_EXCLUDED_PATHS = ['/', '/login']
const SOUTENANCE_PATH_REGEX = /^\/Soutenances\/\d{4}$/i
const TOOLBAR_DEFAULT_OPEN_PATHS = [
  '/planification',
  '/gestionTPI',
  '/partiesPrenantes',
  '/suiviEtudiants',
  '/genTokens',
  '/TpiEval'
]

const isToolbarPage = (pathname) =>
  TOOLBAR_DEFAULT_OPEN_PATHS.includes(pathname) || pathname.startsWith('/planning/')

const compactText = (value) => {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

const getHeaderContextLabel = (pathname, search = "") => {
  const params = new URLSearchParams(search)

  if (pathname === "/") {
    return "Accueil"
  }

  if (pathname === "/planification") {
    return "Planification"
  }

  if (pathname === "/configuration") {
    return "Configuration"
  }

  if (pathname === "/gestionTPI") {
    return "Gestion TPI"
  }

  if (pathname === "/partiesPrenantes") {
    return "Parties prenantes"
  }

  if (pathname === "/suiviEtudiants") {
    return "Suivi étudiants"
  }

  if (pathname === "/genTokens") {
    return "Génération tokens"
  }

  if (pathname === "/TpiEval") {
    return "Évaluation"
  }

  if (SOUTENANCE_PATH_REGEX.test(pathname)) {
    const year = pathname.split('/').pop()
    return `Soutenances ${year}`
  }

  if (pathname.startsWith('/planning/')) {
    const year = pathname.split('/').pop()
    return params.get('tab') === 'votes'
      ? `Suivi votes ${year}`
      : `Planning ${year}`
  }

  return ""
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

const PlanningVotesRoute = ({ isAuthenticated, toggleArrow, isArrowUp }) => {
  const { year } = useParams()
  const location = useLocation()
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

  const isAdminView = Boolean(isAuthenticated && IS_ADMIN_UI_ENABLED && !isVotePreview && !hasVoteMagicLinkSession)

  if (!isAuthenticated && !hasPlanningSession && !hasMagicLink) {
    return <Navigate to='/login' replace />
  }

  return (
    <PlanningDashboard
      year={parseInt(year, 10)}
      isAdmin={isAdminView}
      toggleArrow={toggleArrow}
      isArrowUp={isArrowUp}
    />
  )
}

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
  const headerContextLabel = useMemo(
    () => getHeaderContextLabel(location.pathname, location.search),
    [location.pathname, location.search]
  )

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

    const toolsElement = document.getElementById("tools")
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
  }, [isArrowUp, isToolbarRoute, location.pathname])

  useLayoutEffect(() => {
    const rootElement = document.documentElement
    const headerElement = document.getElementById("header")
    const toolsElement = isToolbarRoute ? document.getElementById("tools") : null

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
  }, [isArrowUp, isToolbarRoute, location.pathname])

  // Toggle arrow mémorisé avec useCallback
  const toggleArrow = useCallback(() => {
    const elementTools = document.getElementById("tools")
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
  }, [])

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
              {headerContextLabel ? (
                <span className='app-header-context-label'>{headerContextLabel}</span>
              ) : null}
              <span className='app-header-date'>{dateFormatted}</span>
            </div>

            <div id='right' className='app-header-meta app-header-meta-session'>
              <div id='planning-header-slot' className='app-header-planification-slot'></div>
              {isToolbarRoute ? (
                <button
                  onClick={toggleArrow}
                  id='downArrowButton'
                  className={`collapse-toggle collapse-toggle-header app-header-tools-toggle ${
                    !isArrowUp ? 'active' : ''
                  }`.trim()}
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
                  <span className='collapse-toggle-label'>Outils</span>
                  <span className='collapse-toggle-icon' aria-hidden='true'></span>
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
                <TpiSchedule toggleArrow={toggleArrow} isArrowUp={isArrowUp} />
              }
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
              element={
                <TpiTracker
                  toggleArrow={toggleArrow}
                  isArrowUp={isArrowUp}
                />
              }
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
            <Route path='*' element={<Navigate to='/' replace />} />
          </>
        )}

        {/* Routes toujours accessibles, authentifié ou non */}
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
