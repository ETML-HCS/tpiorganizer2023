import {
  getTrackerRoleClassName,
  getTrackerRoleConfig,
  getTrackerRoleLabel,
  isTrackerRole
} from "./trackerRoles.js"

const RegisterToProjects = ({ userRole }) => {
  const normalizedRole = isTrackerRole(userRole) ? userRole : ""
  const roleClassName = getTrackerRoleClassName(normalizedRole)
  const roleLabel = getTrackerRoleLabel(normalizedRole)
  const roleConfig = getTrackerRoleConfig(normalizedRole)
  const highlights = roleConfig?.highlights?.length
    ? roleConfig.highlights
    : [
        "Le profil connecté garde un accès minimal au suivi.",
        "La complétion détaillée se fait dans l'écran métier concerné.",
        "Les raccourcis restent disponibles dans la barre d'outils."
      ]

  return (
    <section
      className={`tracker-panel tracker-project-card ${
        roleClassName ? `tracker-project-card--${roleClassName}` : ""
      }`.trim()}
    >
      <div className='tracker-card-head'>
        <span className='tracker-panel-eyebrow'>Inscription aux projets</span>
        <span className='tracker-card-status'>
          {highlights.length > 0 ? `${highlights.length} repères` : "Vue limitée"}
        </span>
      </div>

      <h2>{roleLabel}</h2>
      <p className='tracker-card-copy'>
        Cet espace centralise les affectations disponibles pour le profil
        connecté. La complétion détaillée se fait ensuite dans le module métier
        concerné.
      </p>

      {roleConfig?.summary ? (
        <p className='tracker-project-summary'>{roleConfig.summary}</p>
      ) : null}

      <ul className='tracker-highlight-list'>
        {highlights.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <div className='tracker-project-note'>
        <span>Prochaine étape</span>
        <p>Les liens métier restent accessibles depuis le suivi principal.</p>
      </div>
    </section>
  )
}

export default RegisterToProjects
