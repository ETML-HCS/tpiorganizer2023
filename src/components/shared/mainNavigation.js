import { ROUTES } from "../../config/appConfig"

export const MAIN_NAVIGATION_LINKS = [
  { label: "Accueil", to: "/", title: "Accueil", match: ["/"] },
  { label: "Planification", to: ROUTES.PLANIFICATION, title: "Planification", match: [ROUTES.PLANIFICATION] },
  { label: "Planning", to: ROUTES.PLANNING, title: "Workflow de planning et votes", match: [ROUTES.PLANNING, `${ROUTES.PLANNING}/`, ROUTES.PLANIFICATION_VOTES_LEGACY] },
  { label: "Configuration", to: "/configuration", title: "Configuration générale", match: ["/configuration"] },
  { label: "Gestion TPI", to: ROUTES.GESTION_TPI, title: "Gestion des dossiers TPI", match: [ROUTES.GESTION_TPI, ROUTES.GESTION_TPI_LEGACY, "/tpi/"] },
  { label: "Parties prenantes", to: ROUTES.PARTIES_PRENANTES, title: "Gestion des parties prenantes", match: [ROUTES.PARTIES_PRENANTES, ROUTES.PARTIES_PRENANTES_LEGACY] },
  { label: "Évaluation", to: ROUTES.TPI_EVAL, title: "Module d’évaluation", match: [ROUTES.TPI_EVAL, ROUTES.TPI_EVAL_LEGACY] },
  { label: "Liens d'accès", to: ROUTES.GEN_TOKENS, title: "Aperçu et génération des liens d’accès", match: [ROUTES.GEN_TOKENS, ROUTES.GEN_TOKENS_LEGACY] }
]
