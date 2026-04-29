import React, { useEffect, useMemo, useState } from "react"
import { AES, enc } from "crypto-js"

import Register from "./Register.jsx"
import RegisterToProjects from "./RegisterToProjects.jsx"
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

const TRACKER_ACTIONS = [
  {
    title: "Mes TPI",
    text: "Projets liés."
  },
  {
    title: "Planification",
    text: "Calendrier lié."
  },
  {
    title: "Compte",
    text: "Identité et accès."
  }
]

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
            Profil <strong>{roleLabel}</strong>.
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
            ? "Chargement"
            : `${users.length} comptes`}
        </span>
      </div>

      <h2>Connexion</h2>
      <p className='tracker-card-copy'>
        Entrez vos identifiants.
      </p>

      <div className='tracker-field-grid'>
        <InputField
          className='tracker-field--full'
          type='text'
          placeholder='Identifiant'
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
        {isLoadingUsers ? "Chargement..." : "Connexion"}
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
        Aucun écran dédié pour ce rôle.
      </p>
    </section>
  )
}

const TpiTracker = () => {
  const [user, setUser] = useState(null)

  const handleOnLogin = (loggedInUser) => {
    setUser(loggedInUser)
  }

  return (
    <div className='tpi-tracker-page page-with-toolbar'>
      <div className='tracker-page-shell'>
        {!user ? (
          <div className='tracker-auth-grid tracker-auth-grid--compact'>
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
