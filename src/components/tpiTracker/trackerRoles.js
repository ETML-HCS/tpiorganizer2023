export const TRACKER_ROLE_CONFIG = {
  student: {
    label: "Étudiant",
    className: "student",
    summary: "Consulte ses TPI, suit les défenses et garde un accès simple à son parcours.",
    highlights: [
      "Consulter les projets liés au compte",
      "Préparer les défenses",
      "Vérifier les informations de suivi"
    ]
  },
  projectManager: {
    label: "Chef de projet",
    className: "projectManager",
    summary: "Coordonne les affectations et supervise les projets qui lui sont associés.",
    highlights: [
      "Retrouver les projets encadrés",
      "Suivre les étapes du dossier",
      "Accéder aux raccourcis du suivi"
    ]
  },
  dean: {
    label: "Doyen",
    className: "dean",
    summary: "Dispose d’une vue de pilotage pour valider et superviser les comptes.",
    highlights: [
      "Contrôler les inscriptions",
      "Superviser l’ensemble du module",
      "Accéder aux actions d’administration"
    ]
  },
  expert: {
    label: "Expert",
    className: "expert",
    summary: "Accède aux défenses et aux projets qui nécessitent son expertise.",
    highlights: [
      "Retrouver les projets à traiter",
      "Préparer les défenses",
      "Vérifier les accès du compte"
    ]
  }
}

const TRACKER_ROLE_ALIASES = {
  etudiant: "student",
  student: "student",
  boss: "projectManager",
  chef_projet: "projectManager",
  chefprojet: "projectManager",
  projectmanager: "projectManager",
  doyen: "dean",
  admin: "dean",
  dean: "dean",
  expert: "expert"
}

const normalizeTrackerRoleKey = (role) => {
  if (typeof role !== "string") {
    return ""
  }

  const compactRole = role
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_")
    .toLowerCase()

  return TRACKER_ROLE_ALIASES[compactRole] || role.trim()
}

export const TRACKER_ROLE_OPTIONS = Object.entries(TRACKER_ROLE_CONFIG).map(([value, config]) => ({
  value,
  ...config
}))

export const TRACKER_ROLE_KEYS = Object.freeze(Object.keys(TRACKER_ROLE_CONFIG))

export const getTrackerRoleKey = (role) => normalizeTrackerRoleKey(role)

export const getTrackerRoleConfig = (role) => {
  const key = getTrackerRoleKey(role)
  return TRACKER_ROLE_CONFIG[key] || null
}

export const getTrackerRoleLabel = (role) => getTrackerRoleConfig(role)?.label || "Utilisateur"

export const getTrackerRoleClassName = (role) => getTrackerRoleConfig(role)?.className || ""

export const isTrackerRole = (role) => Boolean(getTrackerRoleConfig(role))
