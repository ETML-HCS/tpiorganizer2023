import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo
} from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "react-toastify"
import { IS_DEBUG, STORAGE_KEYS, YEARS_CONFIG } from "../config/appConfig"
import { authPlanningService, workflowPlanningService } from "../services/planningService"
import { writeStorageValue } from "../utils/storage"
import IconButtonContent from "./shared/IconButtonContent"
import {
  ArrowRightIcon,
  CalendarIcon,
  ClipboardIcon,
  CloseIcon,
  ConfigurationIcon,
  DashboardIcon,
  GestionTpiIcon,
  KeyIcon,
  SettingsIcon,
  StarsIcon,
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
  gestionTpi: GestionTpiIcon,
  users: UsersIcon,
  clipboard: ClipboardIcon,
  key: KeyIcon,
  stars: StarsIcon,
  test: TestTubeIcon,
  configuration: ConfigurationIcon,
  settings: SettingsIcon
}

const HomeIcon = ({ name, className }) => {
  const Icon = HOME_ICONS[name] || HOME_ICONS.dashboard
  return <Icon className={className} />
}

const PRIMARY_ITEMS = [
  {
    name: "Planification",
    special: "planningWorkflow",
    icon: "workflow",
    tone: "primary",
    description: "Construire la planification annuelle avant l'ouverture des votes.",
    actionLabel: "Choisir une année"
  },
  {
    name: "Planning",
    special: "planningVotes",
    icon: "clipboard",
    tone: "accent",
    description: "Suivre les votes et l'état annuel du planning.",
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
    icon: "gestionTpi",
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
    icon: "stars",
    tone: "neutral",
    description: "Accéder aux formulaires et au suivi des notes.",
    actionLabel: "Ouvrir"
  },
  {
    name: "Configuration",
    link: "/configuration",
    icon: "configuration",
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

const DEV_ACCESS_ITEMS = [
  {
    dialog: "voteTest",
    title: "Tester les votes",
    description: "Envoyer les emails de test vote vers une adresse choisie.",
    meta: "Année + email"
  },
  {
    dialog: "soutenanceTest",
    title: "Tester les soutenances",
    description: "Envoyer les emails de test soutenance vers une adresse choisie.",
    meta: "Année + email"
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

const SelectionMenu = ({
  title,
  onClose,
  onYearSelect,
  initialYear = YEARS_CONFIG.getCurrentYear()
}) => {
  const selectRef = useRef(null)
  const years = useMemo(() => generateYears().slice().reverse(), [])
  const defaultYear = useMemo(() => {
    const normalizedInitialYear = String(initialYear)

    if (years.some((year) => String(year) === normalizedInitialYear)) {
      return normalizedInitialYear
    }

    return years.length > 0 ? String(years[0]) : ""
  }, [initialYear, years])
  const [selectedYear, setSelectedYear] = useState(defaultYear)

  useEffect(() => {
    selectRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedYear(defaultYear)
  }, [defaultYear])

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

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!selectedYear) {
      return
    }

    onYearSelect(selectedYear)
  }

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
          <button
            type='button'
            className='home-dialog-close icon-button'
            onClick={onClose}
            aria-label='Fermer'
            title='Fermer'
          >
            <IconButtonContent label='Fermer' icon={CloseIcon} />
          </button>
        </div>

        <form className='home-dialog-form' onSubmit={handleSubmit}>
          <select
            ref={selectRef}
            className='home-dialog-select'
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
            aria-label="Sélection de l'année"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          <div className='home-dialog-actions'>
            <button
              type='submit'
              className='home-dialog-submit'
              disabled={!selectedYear}
            >
              Ouvrir
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const DevAccessMenu = ({
  title,
  description,
  submitLabel,
  onClose,
  onSubmit,
  isSubmitting,
  initialYear = YEARS_CONFIG.getCurrentYear()
}) => {
  const emailRef = useRef(null)
  const years = useMemo(() => generateYears().slice().reverse(), [])
  const defaultYear = useMemo(() => {
    const normalizedInitialYear = String(initialYear)

    if (years.some((year) => String(year) === normalizedInitialYear)) {
      return normalizedInitialYear
    }

    return years.length > 0 ? String(years[0]) : ""
  }, [initialYear, years])
  const [selectedYear, setSelectedYear] = useState(defaultYear)
  const [email, setEmail] = useState("")
  const [reference, setReference] = useState("")

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedYear(defaultYear)
  }, [defaultYear])

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

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!selectedYear || !email.trim()) {
      return
    }

    onSubmit({
      year: selectedYear,
      email: email.trim(),
      reference: reference.trim()
    })
  }

  return (
    <div className='home-overlay' onClick={onClose}>
      <div
        className='home-dialog'
        role='dialog'
        aria-modal='true'
        aria-labelledby='home-dev-access-title'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='home-dialog-head'>
          <h2 id='home-dev-access-title'>{title}</h2>
          <button
            type='button'
            className='home-dialog-close icon-button'
            onClick={onClose}
            aria-label='Fermer'
            title='Fermer'
          >
            <IconButtonContent label='Fermer' icon={CloseIcon} />
          </button>
        </div>

        <p className='home-dialog-copy'>{description}</p>

        <form className='home-dialog-form' onSubmit={handleSubmit}>
          <label className='home-dialog-field'>
            <span>Année</span>
            <select
              className='home-dialog-select'
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              aria-label="Sélection de l'année"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className='home-dialog-field'>
            <span>Email de test</span>
            <input
              ref={emailRef}
              type='email'
              className='home-dialog-input'
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder='prenom.nom@example.test'
              autoComplete='email'
              aria-label='Email de test'
            />
          </label>

          <label className='home-dialog-field'>
            <span>Référence ciblée</span>
            <input
              type='text'
              className='home-dialog-input'
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder='Optionnel: TPI-2026-001'
              aria-label='Référence ciblée'
            />
            <small className='home-dialog-help'>
              Optionnel. Laisser vide pour prendre le premier dossier disponible.
            </small>
          </label>

          <div className='home-dialog-actions'>
            <button
              type='submit'
              className='home-dialog-submit'
              disabled={!selectedYear || !email.trim() || isSubmitting}
            >
              {isSubmitting ? "Envoi..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const DevAccessResultMenu = ({ payload, onClose }) => {
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

  const title = payload?.kind === "soutenance"
    ? "Emails de test soutenance"
    : "Emails de test vote"

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
        aria-labelledby='home-dev-links-title'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='home-dialog-head'>
          <h2 id='home-dev-links-title'>{title}</h2>
          <button
            type='button'
            className='home-dialog-close icon-button'
            onClick={onClose}
            aria-label='Fermer'
            title='Fermer'
          >
            <IconButtonContent label='Fermer' icon={CloseIcon} />
          </button>
        </div>

        <div className='home-dialog-summary'>
          <strong>
            {payload?.summary?.emailsSucceeded || 0}/{payload?.summary?.emailsSent || 0} email(s)
            envoyé(s)
          </strong>
          <span>{payload?.sentTo || "Adresse inconnue"}</span>
          {payload?.reference ? <span>{payload.reference}</span> : null}
        </div>

        <div className='home-vote-links-grid'>
          {links.map((link) => (
            <article key={`${link.role || "link"}-${link.url}`} className='home-vote-link-card'>
              <strong>{link.roleLabel || link.role || "Lien"}</strong>
              <span>{link.viewer?.name || link.voter?.name || "Personne inconnue"}</span>
              <span className='home-vote-link-status'>
                {link.emailDelivery?.success
                  ? `Envoyé à ${link.emailDelivery.sentTo}`
                  : link.emailDelivery?.error || "Lien généré sans confirmation d'envoi"}
              </span>

              <div className='home-vote-link-actions'>
                <button
                  type='button'
                  className='icon-button'
                  onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
                  aria-label='Ouvrir'
                  title='Ouvrir'
                >
                  <IconButtonContent label='Ouvrir' icon={ArrowRightIcon} />
                </button>
                <button
                  type='button'
                  className='secondary icon-button'
                  onClick={() => handleCopy(link.url)}
                  aria-label='Copier'
                  title='Copier'
                >
                  <IconButtonContent label='Copier' icon={ClipboardIcon} />
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
  const [isSendingDevAccess, setIsSendingDevAccess] = useState(false)
  const [devAccessPayload, setDevAccessPayload] = useState(null)

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

  const handleCloseDevAccessResult = useCallback(() => {
    setDevAccessPayload(null)
    setActiveDialog(null)
  }, [])

  const handleSubmitDevAccess = useCallback(
    async ({ year, email, reference }) => {
      const dialogType = activeDialog

      if (!year || !email || isSendingDevAccess) {
        return
      }

      setIsSendingDevAccess(true)
      handleCloseDialog()

      const isVoteTest = dialogType === "voteTest"
      const loadingToastId = toast.loading(
        isVoteTest
          ? `Envoi des emails de test vote ${year}...`
          : `Envoi des emails de test soutenance ${year}...`,
        {
          position: "top-center"
        }
      )

      try {
        const result = isVoteTest
          ? await workflowPlanningService.sendDevVoteEmails(year, email, {
              reference,
              baseUrl: window.location.origin
            })
          : await workflowPlanningService.sendDevSoutenanceEmails(year, email, {
              reference,
              baseUrl: window.location.origin
            })

        toast.update(loadingToastId, {
          render: `${result?.summary?.emailsSucceeded || 0}/${result?.summary?.emailsSent || 0} email(s) de test envoyé(s).`,
          type: "success",
          isLoading: false,
          autoClose: 3500,
          closeOnClick: true,
          closeButton: true
        })

        setDevAccessPayload(result)
        setActiveDialog("devAccessResult")
      } catch (error) {
        const errorMessage = error?.data?.error || error?.message || "Impossible d'envoyer les emails de test."

        toast.update(loadingToastId, {
          render: errorMessage,
          type: "error",
          isLoading: false,
          autoClose: 5000,
          closeOnClick: true,
          closeButton: true
        })
      } finally {
        setIsSendingDevAccess(false)
      }
    },
    [activeDialog, handleCloseDialog, isSendingDevAccess]
  )

  const handleYearSelect = useCallback(
    (year) => {
      if (!year) {
        return
      }

      handleCloseDialog()

      if (activeDialog === "planningWorkflow") {
        authPlanningService.clearSession()
        writeStorageValue(STORAGE_KEYS.PLANNING_SELECTED_YEAR, String(year))
        navigate('/planification')
        return
      }

      if (activeDialog === "planningVotes") {
        authPlanningService.clearSession()
        writeStorageValue(STORAGE_KEYS.PLANNING_SELECTED_YEAR, String(year))
        navigate(`/planning/${year}`)
        return
      }

      navigate(`/Soutenances/${year}`)
    },
    [activeDialog, handleCloseDialog, navigate]
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
            <p>Actions de test réservées au mode debug.</p>
          </div>

          <div className='home-dev-grid'>
            {DEV_ACCESS_ITEMS.map((item, index) => (
              <button
                key={item.dialog}
                type='button'
                className='home-dev-action'
                style={{ "--home-card-delay": `${320 + index * 45}ms` }}
                onClick={() => handleOpenDialog(item.dialog)}
                disabled={isSendingDevAccess}
              >
                <span className='home-dev-action-icon'>
                  <HomeIcon name='test' className='home-card-svg' />
                </span>

                <span className='home-dev-action-copy'>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </span>

                <span className='home-dev-action-meta'>{item.meta}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {activeDialog === "planningVotes" && (
        <SelectionMenu
          title='Planning annuel'
          onClose={handleCloseDialog}
          onYearSelect={handleYearSelect}
        />
      )}

      {activeDialog === "planningWorkflow" && (
        <SelectionMenu
          title='Planification annuelle'
          onClose={handleCloseDialog}
          onYearSelect={handleYearSelect}
        />
      )}

      {activeDialog === "voteTest" && (
        <DevAccessMenu
          title='Test des votes'
          description="Le système envoie les emails de test vote vers l'adresse choisie et conserve des liens ouvrables/copiables."
          submitLabel='Envoyer les emails'
          onClose={handleCloseDialog}
          onSubmit={handleSubmitDevAccess}
          isSubmitting={isSendingDevAccess}
        />
      )}

      {activeDialog === "soutenanceTest" && (
        <DevAccessMenu
          title='Test des soutenances'
          description="Le système envoie les emails de test soutenance vers l'adresse choisie et cible une soutenance publiée."
          submitLabel='Envoyer les emails'
          onClose={handleCloseDialog}
          onSubmit={handleSubmitDevAccess}
          isSubmitting={isSendingDevAccess}
        />
      )}

      {activeDialog === "devAccessResult" && (
        <DevAccessResultMenu payload={devAccessPayload} onClose={handleCloseDevAccessResult} />
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
