import { useState } from "react"

import { showNotification } from "../Tools.jsx"
import PageToolbar from "../shared/PageToolbar.jsx"
import { MAIN_NAVIGATION_LINKS } from "../shared/mainNavigation.js"
import { getTrackerRoleLabel } from "./trackerRoles.js"

const TpiTrackerButtons = ({ toggleArrow, isArrowUp, user }) => {
  const isConnected = Boolean(user)
  const [activeTab, setActiveTab] = useState("shortcuts")
  const roleLabel = isConnected ? getTrackerRoleLabel(user?.role) : "Utilisateur"

  const toolbarTabs = [
    { id: "shortcuts", label: "Raccourcis" },
    { id: "account", label: "Compte" }
  ]

  const notifyComingSoon = (label) => {
    showNotification(`${label} bientôt disponible.`, "info", 2500)
  }

  return (
    <PageToolbar
      id='tools'
      className='tpi-tracker-tools'
      eyebrow='Actions rapides'
      title='Raccourcis et compte'
      description='Cette barre sert à ouvrir les raccourcis du profil, suivre l’état de session et accéder aux autres écrans du module.'
      meta={
        <span className='page-tools-chip'>
          {isConnected ? `Connecté · ${roleLabel}` : "Hors ligne"}
        </span>
      }
      tabs={toolbarTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabListLabel='Sections des actions rapides'
      navigationLinks={MAIN_NAVIGATION_LINKS}
      toggleArrow={toggleArrow}
      isArrowUp={isArrowUp}
      ariaLabel='Barre d’actions du module'
    >
      {activeTab === "shortcuts" ? (
        isConnected ? (
          <div className='page-tools-inline-row'>
            <button
              id='btMyTPI'
              type='button'
              className='page-tools-action-btn primary'
              onClick={() => notifyComingSoon("Mes TPI")}
            >
              Mes TPI
            </button>
            <button
              id='btPlanner'
              type='button'
              className='page-tools-action-btn secondary'
              onClick={() => notifyComingSoon("Planification")}
            >
              Planification
            </button>
            <button
              id='btCompte'
              type='button'
              className='page-tools-action-btn secondary'
              onClick={() => notifyComingSoon("Compte")}
            >
              Compte
            </button>
          </div>
        ) : (
          <span className='page-tools-chip'>
            Connectez-vous pour afficher les raccourcis.
          </span>
        )
      ) : (
        <div className='page-tools-inline-row'>
          <span className='page-tools-chip'>
            {isConnected
              ? `Login : ${user?.login || "non renseigné"}`
              : "Aucun compte actif"}
          </span>
          <span className='page-tools-chip'>
            {isConnected ? `Rôle : ${roleLabel}` : "Connexion requise"}
          </span>
        </div>
      )}
    </PageToolbar>
  )
}

export default TpiTrackerButtons
