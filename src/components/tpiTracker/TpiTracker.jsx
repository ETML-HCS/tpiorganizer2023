import React, { useEffect, useMemo, useState } from "react"
import { AES, enc } from "crypto-js"

import Register from "./Register.jsx"
import RegisterToProjects from "./RegisterToProjects.jsx"
import TpiTrackerButtons from "./TpiTrackerButtons.jsx"
import { getUsers } from "../tpiControllers/TpiUsersController.jsx"
import { showNotification } from "../Tools.jsx"
import { ERROR_MESSAGES, TPI_TRACKER_SECRET } from "../../config/appConfig"
import {
  getTrackerRoleConfig,
  getTrackerRoleKey,
  getTrackerRoleLabel,
  isTrackerRole
} from "./trackerRoles.js"

import "../../css/tpiTracker/tpiTrackerStyle.css"

const TRACKER_HERO_METRICS = [
  {
    value: "4",
    label: "rôles couverts",
    detail: "Étudiant, chef de projet, doyen, expert"
  },
  {
    value: "1",
    label: "porte d’entrée",
    detail: "Connexion, inscription et suivi"
  },
  {
    value: "3",
    label: "raccourcis actifs",
    detail: "Mes TPI, planification et compte"
  }
]

const TRACKER_GUIDE_STEPS = [
  {
    title: "Se connecter",
    text: "Utilisez un compte existant pour ouvrir l’espace qui correspond à votre rôle."
  },
  {
    title: "Créer ou vérifier",
    text: "L’inscription reste disponible pour les comptes manquants ou à compléter."
  },
  {
    title: "Continuer dans le module",
    text: "La suite du suivi se fait ensuite dans les écrans métiers du projet."
  }
]

const TRACKER_ACTIONS = [
  {
    title: "Mes TPI",
    text: "Retrouver les projets associés au profil connecté."
  },
  {
    title: "Planification",
    text: "Accéder au calendrier et aux soutenances liées."
  },
  {
    title: "Compte",
    text: "Vérifier l’identité et les informations principales."
  }
]

const TrackerHero = () => {
  return (
    <section className='tracker-panel tracker-hero-card'>
      <div className='tracker-hero-copy'>
        <span className='tracker-panel-eyebrow'>Vue d’ensemble</span>
        <h1>Une entrée claire vers le suivi des profils</h1>
        <p>
          Le module rassemble la connexion, la création de compte et les
          raccourcis utiles autour des TPI, avec une lecture plus directe du
          rôle connecté.
        </p>
        <div className='tracker-badge-row' aria-label='Profils pris en charge'>
          {["Étudiant", "Chef de projet", "Doyen", "Expert"].map((label) => (
            <span key={label} className='tracker-badge'>
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className='tracker-hero-metrics' aria-label='Résumé du module'>
        {TRACKER_HERO_METRICS.map((metric) => (
          <article key={metric.label} className='tracker-metric-card'>
            <span className='tracker-metric-value'>{metric.value}</span>
            <span className='tracker-metric-label'>{metric.label}</span>
            <p className='tracker-metric-detail'>{metric.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

const TrackerGuide = () => {
  return (
    <aside className='tracker-panel tracker-guide-card'>
      <div className='tracker-card-head'>
        <span className='tracker-panel-eyebrow'>Mode d’emploi</span>
        <span className='tracker-card-status'>3 étapes</span>
      </div>
      <h2>Ce que fait cette page</h2>
      <div className='tracker-step-list'>
        {TRACKER_GUIDE_STEPS.map((step, index) => (
          <article key={step.title} className='tracker-step-item'>
            <span className='tracker-step-index'>0{index + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          </article>
        ))}
      </div>
      <p className='tracker-guide-note'>
        Les comptes hérités restent compatibles avec les nouveaux rôles du
        module.
      </p>
    </aside>
  )
}

const TrackerSessionCard = ({ user }) => {
  const roleConfig = getTrackerRoleConfig(user?.role)
  const roleLabel = getTrackerRoleLabel(user?.role)
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.login ||
    "utilisateur"

  const sessionFacts = useMemo(
    () => [
      { label: "Identifiant", value: user?.login || "Non renseigné" },
      { label: "Email", value: user?.email || "Non renseigné" },
      { label: "Rôle", value: roleLabel }
    ],
    [roleLabel, user?.email, user?.login]
  )

  return (
    <section
      className={`tracker-panel tracker-session-card ${
        roleConfig?.className ? `tracker-session-card--${roleConfig.className}` : ""
      }`.trim()}
    >
      <div className='tracker-card-head'>
        <span className='tracker-panel-eyebrow'>Session active</span>
        <span className='tracker-card-status'>{roleLabel}</span>
      </div>

      <div className='tracker-session-head'>
        <div className='tracker-avatar' aria-hidden='true'>
          {displayName
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
        <div className='tracker-session-copy'>
          <h2>Bienvenue, {displayName}.</h2>
          <p>
            Votre compte est reconnu comme <strong>{roleLabel}</strong>. Les
            cartes ci-dessous résument les prochaines étapes du suivi.
          </p>
        </div>
      </div>

      <dl className='tracker-session-facts'>
        {sessionFacts.map((fact) => (
          <div key={fact.label} className='tracker-session-fact'>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className='tracker-action-grid' aria-label='Raccourcis du module'>
        {TRACKER_ACTIONS.map((action) => (
          <article key={action.title} className='tracker-action-tile'>
            <h3>{action.title}</h3>
            <p>{action.text}</p>
          </article>
        ))}
      </div>

      {roleConfig?.summary ? (
        <p className='tracker-session-summary'>{roleConfig.summary}</p>
      ) : null}
    </section>
  )
}

const InputField = ({ label, className = "", type, placeholder, value, onChange, ...props }) => {
  return (
    <label className={`tracker-field ${className}`.trim()}>
      <span className='tracker-sr-only'>{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        aria-label={label}
        {...props}
      />
    </label>
  )
}

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("")
  const [passwordField, setPasswordField] = useState("")
  const [users, setUsers] = useState([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    let isMounted = true

    const fetchUsersData = async () => {
      setIsLoadingUsers(true)
      setLoadError("")

      try {
        const usersData = await getUsers()

        if (isMounted) {
          setUsers(Array.isArray(usersData) ? usersData : [])
        }
      } catch (error) {
        if (isMounted) {
          setUsers([])
          setLoadError(error?.message || ERROR_MESSAGES.LOAD_FAILED)
          showNotification(
            error?.message || "Impossible de charger les comptes du suivi.",
            "error",
            4000
          )
        }
      } finally {
        if (isMounted) {
          setIsLoadingUsers(false)
        }
      }
    }

    fetchUsersData()

    return () => {
      isMounted = false
    }
  }, [])

  const handleLogin = async (event) => {
    event.preventDefault()

    if (isLoadingUsers) {
      showNotification("Chargement des comptes en cours...", "info", 2500)
      return
    }

    if (loadError) {
      showNotification(loadError, "error", 4000)
      return
    }

    const normalizedUsername = username.trim()
    const normalizedPassword = passwordField.trim()

    if (!normalizedUsername || !normalizedPassword) {
      showNotification(
        "Veuillez renseigner l'identifiant et le mot de passe.",
        "error",
        4000
      )
      return
    }

    if (!TPI_TRACKER_SECRET) {
      showNotification(
        "Le secret de chiffrement du suivi est manquant.",
        "error",
        4000
      )
      return
    }

    const user = users.find((userData) => userData?.login?.trim() === normalizedUsername)

    if (!user) {
      showNotification("Utilisateur non trouvé", "error", 4000)
      return
    }

    const decryptedPassword = AES.decrypt(
      String(user.password || ""),
      TPI_TRACKER_SECRET
    ).toString(enc.Utf8)

    if (decryptedPassword !== normalizedPassword) {
      showNotification("Identifiants incorrects", "error", 4000)
      return
    }

    const normalizedRoleKey = getTrackerRoleKey(user.role)
    const loginRole = isTrackerRole(normalizedRoleKey)
      ? normalizedRoleKey
      : user.role

    onLogin({
      ...user,
      role: loginRole
    })

    showNotification(
      `Connexion réussie. Bonjour ${user.firstName || "utilisateur"}.`,
      "success",
      2500
    )
  }

  return (
    <form className='tracker-panel tracker-login-card' onSubmit={handleLogin}>
      <div className='tracker-card-head'>
        <span className='tracker-panel-eyebrow'>Connexion</span>
        <span className='tracker-card-status'>
          {isLoadingUsers
            ? "Synchronisation en cours"
            : `${users.length} comptes synchronisés`}
        </span>
      </div>

      <h2>Accéder au suivi</h2>
      <p className='tracker-card-copy'>
        Utilisez votre identifiant et votre mot de passe pour afficher le
        parcours associé à votre rôle.
      </p>

      <div className='tracker-field-grid'>
        <InputField
          className='tracker-field--full'
          type='text'
          placeholder="Nom d'utilisateur"
          value={username}
          autoComplete='username'
          onChange={(e) => setUsername(e.target.value)}
        />
        <InputField
          className='tracker-field--full'
          type='password'
          placeholder='Mot de passe'
          value={passwordField}
          autoComplete='current-password'
          onChange={(e) => setPasswordField(e.target.value)}
        />
      </div>

      {loadError ? <p className='tracker-inline-error'>{loadError}</p> : null}

      <button type='submit' className='tracker-primary-button' disabled={isLoadingUsers}>
        {isLoadingUsers ? "Chargement..." : "Se connecter"}
      </button>
    </form>
  )
}

const TrackerEmptyState = () => {
  return (
    <section className='tracker-panel tracker-empty-card'>
      <div className='tracker-card-head'>
        <span className='tracker-panel-eyebrow'>Profil reconnu</span>
        <span className='tracker-card-status'>Panneau indisponible</span>
      </div>
      <h2>Aucun écran d’affectation</h2>
      <p>
        Ce compte est connecté, mais le rôle associé ne dispose pas encore
        d’un écran dédié dans le module.
      </p>
    </section>
  )
}

const TpiTracker = ({ toggleArrow, isArrowUp }) => {
  const [user, setUser] = useState(null)

  const handleOnLogin = (loggedInUser) => {
    setUser(loggedInUser)
  }

  return (
    <div className='tpi-tracker-page page-with-toolbar'>
      <TpiTrackerButtons
        toggleArrow={toggleArrow}
        isArrowUp={isArrowUp}
        user={user}
      />

      <div className='tracker-page-shell'>
        <TrackerHero />

        {!user ? (
          <div className='tracker-auth-grid'>
            <TrackerGuide />
            <Login onLogin={handleOnLogin} />
            <Register secret={TPI_TRACKER_SECRET} />
          </div>
        ) : (
          <div className='tracker-dashboard-grid'>
            <TrackerSessionCard user={user} />
            {isTrackerRole(user.role) ? (
              <RegisterToProjects userRole={user.role} />
            ) : (
              <TrackerEmptyState />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default TpiTracker
