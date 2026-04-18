import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo
} from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import { IS_DEBUG, YEARS_CONFIG } from "../config/appConfig"
import { authPlanningService, workflowPlanningService } from "../services/planningService"
import {
  CalendarIcon,
  ClipboardIcon,
  DashboardIcon,
  FileTextIcon,
  KeyIcon,
  SettingsIcon,
  TestTubeIcon,
  UsersIcon,
  WorkflowIcon
} from "./shared/InlineIcons"

import "../css/home.css"

const generateYears = () => YEARS_CONFIG.getAvailableYears()

const HOME_ICONS = {
  dashboard: DashboardIcon,
  workflow: WorkflowIcon,
  calendar: CalendarIcon,
  file: FileTextIcon,
  users: UsersIcon,
  clipboard: ClipboardIcon,
  key: KeyIcon,
  test: TestTubeIcon,
  settings: SettingsIcon
}

const HomeIcon = ({ name, className }) => {
  const Icon = HOME_ICONS[name] || HOME_ICONS.dashboard
  return <Icon className={className} />
}

const PRIMARY_ITEMS = [
  {
    name: "Planification",
    link: "/planification",
    icon: "workflow",
    tone: "primary",
    description: "Construire et ajuster le planning des soutenances.",
    actionLabel: "Ouvrir"
  },
  {
    name: "Suivi votes",
    special: "planningVotes",
    icon: "clipboard",
    tone: "accent",
    description: "Ouvrir la vue de votes et choisir l'année à consulter.",
    actionLabel: "Choisir une année"
  },
  {
    name: "Soutenances",
    special: "soutenance",
    icon: "calendar",
    tone: "warm",
    description: "Consulter le calendrier des soutenances par année.",
    actionLabel: "Choisir une année"
  }
]

const ADMIN_ITEMS = [
  {
    name: "Gestion TPI",
    link: "/gestionTPI",
    icon: "file",
    tone: "neutral",
    description: "Mettre à jour les fiches, imports et référentiels.",
    actionLabel: "Ouvrir"
  },
  {
    name: "Parties prenantes",
    link: "/partiesPrenantes",
    icon: "users",
    tone: "neutral",
    description: "Gérer experts, candidats et responsables.",
    actionLabel: "Ouvrir"
  },
  {
    name: "Suivi des profils",
    link: "/suiviEtudiants",
    icon: "users",
    tone: "neutral",
    description: "Contrôler les comptes et les accès utilisateurs.",
    actionLabel: "Ouvrir"
  },
  {
    name: "Évaluation",
    link: "/TpiEval",
    icon: "clipboard",
    tone: "neutral",
    description: "Accéder aux formulaires et au suivi des notes.",
    actionLabel: "Ouvrir"
  },
  {
    name: "Configuration",
    link: "/configuration",
    icon: "settings",
    tone: "primary",
    description: "Régler l'année active, les salles et les paramètres.",
    actionLabel: "Ouvrir"
  },
  {
    name: "Liens d'accès",
    link: "/genTokens",
    icon: "key",
    tone: "neutral",
    description: "Préparer les magic links vote et soutenance par personne.",
    actionLabel: "Ouvrir"
  }
]

const ActionCard = ({ item, onOpenDialog, delayMs = 0 }) => {
  const cardStyle = { "--home-card-delay": `${delayMs}ms` }

  const content = (
    <>
      <span className={`home-card-icon home-card-icon-${item.tone}`}>
        <HomeIcon name={item.icon} className='home-card-svg' />
      </span>

      <div className='home-card-content'>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
      </div>

      <span className='home-card-meta'>{item.actionLabel}</span>
    </>
  )

  if (item.special) {
    return (
      <button
        type='button'
        className={`home-card home-card-${item.tone}`}
        style={cardStyle}
        onClick={() => onOpenDialog(item.special)}
      >
        {content}
      </button>
    )
  }

  return (
    <Link to={item.link} className={`home-card home-card-${item.tone}`} style={cardStyle}>
      {content}
    </Link>
  )
}

const HomeSection = ({ title, description, items, onOpenDialog, delayBase = 0 }) => (
  <section
    className='home-section'
    aria-label={title}
    style={{ "--home-section-delay": `${delayBase}ms` }}
  >
    <div className='home-section-head'>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>

    <div className='home-grid'>
      {items.map((item, index) => (
        <ActionCard
          key={item.name}
          item={item}
          onOpenDialog={onOpenDialog}
          delayMs={delayBase + 50 + index * 45}
        />
      ))}
    </div>
  </section>
)

const SelectionMenu = ({ title, onClose, onYearSelect }) => {
  const selectRef = useRef(null)
  const years = useMemo(() => generateYears().slice().reverse(), [])

  useEffect(() => {
    selectRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [onClose])

  return (
    <div className='home-overlay' onClick={onClose}>
      <div
        className='home-dialog'
        role='dialog'
        aria-modal='true'
        aria-labelledby='home-dialog-title'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='home-dialog-head'>
          <h2 id='home-dialog-title'>{title}</h2>
          <button type='button' className='home-dialog-close' onClick={onClose}>
            Fermer
          </button>
        </div>

        <select
          ref={selectRef}
          className='home-dialog-select'
          onChange={(event) => onYearSelect(event.target.value)}
          defaultValue=''
          aria-label="Sélection de l'année"
        >
          <option value='' disabled>
            Choisir une année
          </option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

const VoteLinksMenu = ({ payload, onClose }) => {
  const links = Array.isArray(payload?.links) ? payload.links : []

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [onClose])

  if (!payload) {
    return null
  }

  const handleCopy = async (url) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Lien copié.")
    } catch {
      toast.error("Impossible de copier le lien.")
    }
  }

  return (
    <div className='home-overlay' onClick={onClose}>
      <div
        className='home-dialog home-dialog-wide'
        role='dialog'
        aria-modal='true'
        aria-labelledby='home-vote-links-title'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='home-dialog-head'>
          <h2 id='home-vote-links-title'>Liens de test votes</h2>
          <button type='button' className='home-dialog-close' onClick={onClose}>
            Fermer
          </button>
        </div>

        <div className='home-vote-links-grid'>
          {links.map((link) => (
            <article key={link.role} className='home-vote-link-card'>
              <strong>{link.role}</strong>
              <span>{link.voter?.name || link.voter?.email || "Votant inconnu"}</span>

              <div className='home-vote-link-actions'>
                <button type='button' onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}>
                  Ouvrir
                </button>
                <button type='button' className='secondary' onClick={() => handleCopy(link.url)}>
                  Copier
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

const Home = () => {
  const navigate = useNavigate()
  const [activeDialog, setActiveDialog] = useState(null)
  const [isGeneratingVoteTestLink, setIsGeneratingVoteTestLink] = useState(false)
  const [voteTestPayload, setVoteTestPayload] = useState(null)

  const currentYear = useMemo(() => new Date().getFullYear(), [])
  const availableYears = useMemo(() => generateYears().slice().reverse(), [])

  useEffect(() => {
    if (!activeDialog) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [activeDialog])

  const handleOpenDialog = useCallback((dialog) => {
    setActiveDialog(dialog)
  }, [])

  const handleCloseDialog = useCallback(() => {
    setActiveDialog(null)
  }, [])

  const handleCloseVoteLinks = useCallback(() => {
    setVoteTestPayload(null)
    setActiveDialog(null)
  }, [])

  const handleVoteTestYearSelect = useCallback(
    async (year) => {
      if (!year || isGeneratingVoteTestLink) {
        return
      }

      setIsGeneratingVoteTestLink(true)
      handleCloseDialog()

      const loadingToastId = toast.loading(`Preparation du lien de test ${year}...`, {
        position: "top-center"
      })

      try {
        const result = await workflowPlanningService.createDevVoteLinks(
          year,
          window.location.origin
        )

        toast.update(loadingToastId, {
          render: `3 liens de test prêts pour ${result.reference || year}.`,
          type: "success",
          isLoading: false,
          autoClose: 2500,
          closeOnClick: true,
          closeButton: true
        })

        setVoteTestPayload(result)
        setActiveDialog("voteLinks")
      } catch (error) {
        const errorMessage = error?.data?.error || error?.message || "Impossible de generer le lien de test."

        toast.update(loadingToastId, {
          render: errorMessage,
          type: "error",
          isLoading: false,
          autoClose: 5000,
          closeOnClick: true,
          closeButton: true
        })
      } finally {
        setIsGeneratingVoteTestLink(false)
      }
    },
    [handleCloseDialog, isGeneratingVoteTestLink]
  )

  const handleYearSelect = useCallback(
    async (year) => {
      if (!year) {
        return
      }

      handleCloseDialog()

      if (activeDialog === "planningVotes") {
        authPlanningService.clearSession()
        navigate(`/planning/${year}`)
        return
      }

      if (activeDialog === "voteTest") {
        await handleVoteTestYearSelect(year)
        return
      }

      navigate(`/Soutenances/${year}`)
    },
    [activeDialog, handleCloseDialog, handleVoteTestYearSelect, navigate]
  )

  return (
    <div className='home'>
      <section className='home-intro'>
        <div className='home-intro-copy'>
          <span className='home-intro-eyebrow'>
            <HomeIcon name='dashboard' className='home-intro-eyebrow-icon' />
            Accueil
          </span>

          <h1>Accès rapide aux modules</h1>

          <p>
            Les accès essentiels sont affichés en premier. Les outils d'administration restent en
            dessous.
          </p>
        </div>

        <div className='home-intro-aside' aria-label='Contexte'>
          <span className='home-intro-label'>Année active</span>
          <strong>{currentYear}</strong>
          <span className='home-intro-years'>{availableYears.length} années disponibles</span>
        </div>
      </section>

      <HomeSection
        title='Accès principaux'
        description='Les accès les plus utilisés.'
        items={PRIMARY_ITEMS}
        onOpenDialog={handleOpenDialog}
        delayBase={90}
      />

      <HomeSection
        title='Administration'
        description='Réglages et gestion des données.'
        items={ADMIN_ITEMS}
        onOpenDialog={handleOpenDialog}
        delayBase={190}
      />

      {IS_DEBUG ? (
        <section className='home-section home-section-dev' aria-label='Développement'>
          <div className='home-section-head'>
            <h2>Développement</h2>
            <p>Outil conservé uniquement pour les tests en mode debug.</p>
          </div>

          <button
            type='button'
            className='home-dev-action'
            style={{ "--home-card-delay": "320ms" }}
            onClick={() => handleOpenDialog("voteTest")}
            disabled={isGeneratingVoteTestLink}
          >
            <span className='home-dev-action-icon'>
              <HomeIcon name='test' className='home-card-svg' />
            </span>

            <span className='home-dev-action-copy'>
              <strong>Tester les votes</strong>
              <span>Générer trois liens de test pour une année.</span>
            </span>

            <span className='home-dev-action-meta'>
              {isGeneratingVoteTestLink ? "Préparation..." : "Choisir une année"}
            </span>
          </button>
        </section>
      ) : null}

      {activeDialog === "planningVotes" && (
        <SelectionMenu
          title='Planification avec votes'
          onClose={handleCloseDialog}
          onYearSelect={handleYearSelect}
        />
      )}

      {activeDialog === "voteTest" && (
        <SelectionMenu
          title='Test des votes'
          onClose={handleCloseDialog}
          onYearSelect={handleYearSelect}
        />
      )}

      {activeDialog === "voteLinks" && (
        <VoteLinksMenu payload={voteTestPayload} onClose={handleCloseVoteLinks} />
      )}

      {activeDialog === "soutenance" && (
        <SelectionMenu
          title='Calendrier des défenses'
          onClose={handleCloseDialog}
          onYearSelect={handleYearSelect}
        />
      )}
    </div>
  )
}

export default Home
