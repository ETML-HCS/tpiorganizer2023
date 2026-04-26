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
import { readStorageValue, writeStorageValue } from "../utils/storage"
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
  MailIcon,
  MailOffIcon,
  SettingsIcon,
  StarsIcon,
  TestTubeIcon,
  UsersIcon,
  VoteIcon,
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
  mail: MailIcon,
  mailOff: MailOffIcon,
  stars: StarsIcon,
  test: TestTubeIcon,
  vote: VoteIcon,
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
    actionLabel: "Ouvrir"
  },
  {
    name: "Planning",
    special: "planningVotes",
    icon: "clipboard",
    tone: "accent",
    description: "Suivre les votes et l'état annuel du planning.",
    actionLabel: "Ouvrir"
  },
  {
    name: "Soutenances",
    special: "soutenance",
    icon: "calendar",
    tone: "warm",
    description: "Consulter le calendrier des soutenances par année.",
    actionLabel: "Ouvrir"
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
    dialog: "voteLinks",
    title: "Liens de vote",
    description: "Générer les magic links vote d'un TPI sans envoyer d'email.",
    meta: "Année + référence",
    icon: "vote",
    requiresEmail: false,
    requiredWorkflowState: "voting_open"
  },
  {
    dialog: "voteTest",
    title: "Emails vote",
    description: "Envoyer les emails de test vote vers une adresse choisie.",
    meta: "Année + email",
    icon: "mail",
    requiresEmail: true,
    requiredWorkflowState: "voting_open"
  },
  {
    dialog: "soutenanceTest",
    title: "Emails soutenance",
    description: "Envoyer les emails de test soutenance vers une adresse choisie.",
    meta: "Année + email",
    icon: "mailOff",
    requiresEmail: true,
    requiredWorkflowState: "published"
  }
]

const ActionCard = ({ item, onOpenDialog, activeYear, delayMs = 0 }) => {
  const cardStyle = { "--home-card-delay": `${delayMs}ms` }
  const actionLabel = item.special && activeYear
    ? `${item.actionLabel} ${activeYear}`
    : item.actionLabel

  const content = (
    <>
      <span className={`home-card-icon home-card-icon-${item.tone}`}>
        <HomeIcon name={item.icon} className='home-card-svg' />
      </span>

      <div className='home-card-content'>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
      </div>

      <span className='home-card-meta'>{actionLabel}</span>
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

const HomeSection = ({ title, description, items, onOpenDialog, activeYear, delayBase = 0 }) => (
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
          activeYear={activeYear}
          delayMs={delayBase + 50 + index * 45}
        />
      ))}
    </div>
  </section>
)

function formatDateTime(value) {
  if (!value) {
    return "date inconnue"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return "date inconnue"
  }

  return date.toLocaleString("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

async function copyToClipboard(value) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.setAttribute("readonly", "readonly")
  textarea.style.position = "absolute"
  textarea.style.left = "-9999px"
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand("copy")
  document.body.removeChild(textarea)
}

const getDevAccessItem = (dialog) =>
  DEV_ACCESS_ITEMS.find((item) => item.dialog === dialog) || null

const WORKFLOW_STATE_REQUIREMENT_LABELS = {
  voting_open: "Votes ouverts uniquement",
  published: "Après publication"
}

const WORKFLOW_STATE_REQUIREMENT_MESSAGES = {
  voting_open: "Disponible uniquement quand les votes sont ouverts.",
  published: "Disponible uniquement après publication."
}

const getWorkflowStateRequirementLabel = (requiredState) =>
  WORKFLOW_STATE_REQUIREMENT_LABELS[requiredState] || "Indisponible"

const getWorkflowStateRequirementMessage = (requiredState) =>
  WORKFLOW_STATE_REQUIREMENT_MESSAGES[requiredState] || "Action indisponible pour le moment."

const getDefaultActiveYear = () => {
  const storedYear = Number.parseInt(
    readStorageValue(STORAGE_KEYS.PLANNING_SELECTED_YEAR, ""),
    10
  )

  if (YEARS_CONFIG.isSupportedYear(storedYear)) {
    return String(storedYear)
  }

  const currentYear = YEARS_CONFIG.getCurrentYear()
  if (YEARS_CONFIG.isSupportedYear(currentYear)) {
    return String(currentYear)
  }

  const years = generateYears()
  return years.length > 0 ? String(years[years.length - 1]) : String(currentYear)
}

const DevAccessMenu = ({
  title,
  description,
  submitLabel,
  onClose,
  onSubmit,
  isSubmitting,
  requiresEmail = true,
  initialYear = YEARS_CONFIG.getCurrentYear()
}) => {
  const emailRef = useRef(null)
  const referenceRef = useRef(null)
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
    if (requiresEmail) {
      emailRef.current?.focus()
      return
    }

    referenceRef.current?.focus()
  }, [requiresEmail])

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

    if (!selectedYear || (requiresEmail && !email.trim())) {
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

          {requiresEmail ? (
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
          ) : null}

          <label className='home-dialog-field'>
            <span>Référence ciblée</span>
            <input
              ref={referenceRef}
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
              disabled={!selectedYear || (requiresEmail && !email.trim()) || isSubmitting}
            >
              {isSubmitting ? "Traitement..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const DevAccessResultMenu = ({ payload, onClose }) => {
  const links = Array.isArray(payload?.links)
    ? payload.links.filter((link) => typeof link?.url === "string" && link.url.length > 0)
    : []
  const hasEmailSummary = typeof payload?.summary?.emailsSent === "number"

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

  const title = payload?.kind === "vote-links"
    ? "Liens de vote"
    : payload?.kind === "soutenance"
    ? "Emails de test soutenance"
    : "Emails de test vote"
  const resultSummary = hasEmailSummary
    ? `${payload?.summary?.emailsSucceeded || 0}/${payload?.summary?.emailsSent || 0} email(s) envoyé(s)`
    : `${links.length} lien(s) généré(s)`

  const handleCopy = async (url) => {
    try {
      await copyToClipboard(url)
      toast.success("Lien copié.")
    } catch {
      toast.error("Impossible de copier le lien.")
    }
  }

  const handleCopyAll = async () => {
    try {
      await copyToClipboard(links.map((link) => link.url).filter(Boolean).join("\n"))
      toast.success("Liens copiés.")
    } catch {
      toast.error("Impossible de copier les liens.")
    }
  }

  const handleOpenFirst = () => {
    const firstUrl = links.find((link) => link.url)?.url

    if (firstUrl) {
      window.open(firstUrl, "_blank", "noopener,noreferrer")
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
          <strong>{resultSummary}</strong>
          {payload?.sentTo ? <span>{payload.sentTo}</span> : null}
          {payload?.reference ? <span>{payload.reference}</span> : null}
        </div>

        {links.length > 0 ? (
          <div className='home-dialog-quick-actions'>
            <button type='button' className='home-dialog-secondary' onClick={handleCopyAll}>
              Copier tous les liens
            </button>
            <button type='button' className='home-dialog-submit' onClick={handleOpenFirst}>
              Ouvrir le premier
            </button>
          </div>
        ) : null}

        <div className='home-vote-links-grid'>
          {links.map((link) => {
            const personName = link.viewer?.name || link.voter?.name || "Personne inconnue"
            const statusLabel = link.emailDelivery
              ? link.emailDelivery.success
                ? `Envoyé à ${link.emailDelivery.sentTo}`
                : link.emailDelivery.error || "Email non confirmé"
              : `Expire le ${formatDateTime(link.expiresAt)}`

            return (
              <article key={`${link.role || "link"}-${link.url}`} className='home-vote-link-card'>
                <strong>{link.roleLabel || link.role || "Lien"}</strong>
                <span>{personName}</span>
                <span className='home-vote-link-status'>{statusLabel}</span>
                <a
                  href={link.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='home-vote-link-url'
                >
                  {link.url}
                </a>

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
            )
          })}
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
  const [activeYear, setActiveYear] = useState(getDefaultActiveYear)
  const [workflowState, setWorkflowState] = useState(null)

  const availableYears = useMemo(() => generateYears().slice().reverse(), [])

  useEffect(() => {
    if (!activeYear) {
      return
    }

    writeStorageValue(STORAGE_KEYS.PLANNING_SELECTED_YEAR, activeYear)
  }, [activeYear])

  useEffect(() => {
    if (!IS_DEBUG || !activeYear) {
      setWorkflowState(null)
      return undefined
    }

    let isCancelled = false
    setWorkflowState(null)

    workflowPlanningService.getYearState(activeYear)
      .then((workflow) => {
        if (isCancelled) {
          return
        }

        setWorkflowState(typeof workflow?.state === "string" ? workflow.state : null)
      })
      .catch(() => {
        if (!isCancelled) {
          setWorkflowState(null)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [activeYear])

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

  const handleActiveYearChange = useCallback((event) => {
    const nextYear = event.target.value

    if (!nextYear) {
      return
    }

    setActiveYear(nextYear)
  }, [])

  const handlePrimaryAccess = useCallback(
    (accessType) => {
      const year = activeYear || String(YEARS_CONFIG.getCurrentYear())

      if (accessType === "planningWorkflow") {
        authPlanningService.clearSession()
        writeStorageValue(STORAGE_KEYS.PLANNING_SELECTED_YEAR, String(year))
        navigate('/planification')
        return
      }

      if (accessType === "planningVotes") {
        authPlanningService.clearSession()
        writeStorageValue(STORAGE_KEYS.PLANNING_SELECTED_YEAR, String(year))
        navigate(`/planning/${year}`)
        return
      }

      if (accessType === "soutenance") {
        navigate(`/Soutenances/${year}`)
      }
    },
    [activeYear, navigate]
  )

  const handleSubmitDevAccess = useCallback(
    async ({ year, email, reference }) => {
      const dialogType = activeDialog
      const dialogConfig = getDevAccessItem(dialogType)
      const requiresEmail = dialogConfig?.requiresEmail !== false

      if (!year || (requiresEmail && !email) || isSendingDevAccess) {
        return
      }

      setIsSendingDevAccess(true)
      handleCloseDialog()

      const isVoteTest = dialogType === "voteTest"
      const isVoteLinks = dialogType === "voteLinks"
      const loadingToastId = toast.loading(
        isVoteLinks
          ? `Génération des liens de vote ${year}...`
          : isVoteTest
          ? `Envoi des emails de test vote ${year}...`
          : `Envoi des emails de test soutenance ${year}...`,
        {
          position: "top-center"
        }
      )

      try {
        const result = isVoteLinks
          ? await workflowPlanningService.createDevVoteLinks(year, window.location.origin, {
              reference
            })
          : isVoteTest
          ? await workflowPlanningService.sendDevVoteEmails(year, email, {
              reference,
              baseUrl: window.location.origin
            })
          : await workflowPlanningService.sendDevSoutenanceEmails(year, email, {
              reference,
              baseUrl: window.location.origin
            })
        const normalizedResult = isVoteLinks
          ? { ...result, kind: "vote-links" }
          : result

        toast.update(loadingToastId, {
          render: isVoteLinks
            ? `${result?.links?.length || 0} lien(s) de vote généré(s).`
            : `${result?.summary?.emailsSucceeded || 0}/${result?.summary?.emailsSent || 0} email(s) de test envoyé(s).`,
          type: "success",
          isLoading: false,
          autoClose: 3500,
          closeOnClick: true,
          closeButton: true
        })

        setDevAccessPayload(normalizedResult)
        setActiveDialog("devAccessResult")
      } catch (error) {
        const errorMessage = error?.data?.error || error?.message || (
          isVoteLinks
            ? "Impossible de générer les liens de vote."
            : "Impossible d'envoyer les emails de test."
        )

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
          <label className='home-intro-year-field'>
            <span className='home-intro-label'>Année active</span>
            <select
              className='home-intro-year-select'
              value={activeYear}
              onChange={handleActiveYearChange}
              aria-label='Année active'
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <span className='home-intro-years'>{availableYears.length} années disponibles</span>
        </div>
      </section>

      <HomeSection
        title='Accès principaux'
        description='Les accès les plus utilisés.'
        items={PRIMARY_ITEMS}
        onOpenDialog={handlePrimaryAccess}
        activeYear={activeYear}
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
            {DEV_ACCESS_ITEMS.map((item, index) => {
              const isLocked =
                Boolean(item.requiredWorkflowState) &&
                workflowState !== item.requiredWorkflowState
              const availabilityLabel = isLocked
                ? getWorkflowStateRequirementLabel(item.requiredWorkflowState)
                : item.meta
              const availabilityMessage = isLocked
                ? getWorkflowStateRequirementMessage(item.requiredWorkflowState)
                : null

              return (
                <button
                  key={item.dialog}
                  type='button'
                  className='home-dev-action'
                  title={availabilityMessage || item.meta}
                  style={{ "--home-card-delay": `${320 + index * 45}ms` }}
                  onClick={() => handleOpenDialog(item.dialog)}
                  disabled={isSendingDevAccess || isLocked}
                >
                  <span className='home-dev-action-icon'>
                    <HomeIcon name={item.icon || "test"} className='home-card-svg' />
                  </span>

                  <span className='home-dev-action-copy'>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </span>

                  <span className='home-dev-action-meta'>{availabilityLabel}</span>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      {activeDialog === "voteLinks" && (
        <DevAccessMenu
          title='Liens de vote'
          description="Le système génère les magic links vote pour le premier dossier disponible, ou pour la référence indiquée."
          submitLabel='Générer les liens'
          onClose={handleCloseDialog}
          onSubmit={handleSubmitDevAccess}
          isSubmitting={isSendingDevAccess}
          requiresEmail={false}
          initialYear={activeYear}
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
          initialYear={activeYear}
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
          initialYear={activeYear}
        />
      )}

      {activeDialog === "devAccessResult" && (
        <DevAccessResultMenu payload={devAccessPayload} onClose={handleCloseDevAccessResult} />
      )}
    </div>
  )
}

export default Home
