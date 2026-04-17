import React, { useState, useEffect, Fragment } from "react"

import { useParams } from "react-router-dom"
import RenderRooms from "./TpiSoutenanceRooms"
import { useSoutenanceData } from "./useSoutenanceData"
import {
  MobileMesTpiFilter,
  MobileRoomFilter,
  SoutenanceDesktopHeader,
  formatDate,
  getRoomSchedule,
  renderSchedule
} from "./TpiSoutenanceParts"

import "../../css/tpiSoutenance/tpiSoutenance.css"

// Pour accéder à la variable d'environnement REACT_APP_API_URL
const isDemo = process.env.REACT_APP_DEBUG === "true" // affiche version démonstration

const TpiSoutenance = () => {
  const { year } = useParams()
  const [isOn, setIsOn] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [activeMobileFilter, setActiveMobileFilter] = useState("all")

  const {
    token,
    soutenanceData,
    expertOrBoss,
    listOfExpertsOrBoss,
    isLoading,
    error,
    filters,
    filteredData,
    uniqueSalles,
    uniqueDates,
    uniqueSites,
    uniqueCandidates,
    uniqueExperts,
    uniqueProjectManagers,
    loadData,
    updateFilter,
    updateSoutenanceData,
    schedule,
    displayedSchedule,
    isFilterApplied
  } = useSoutenanceData(year)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50)
    const handleResize = () => setIsMobile(window.innerWidth <= 500)

    window.addEventListener("scroll", handleScroll)
    window.addEventListener("resize", handleResize)
    handleResize()

    return () => {
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  if (isLoading) {
    return <div>Chargement...</div>
  }
  if (error) {
    return <div>Erreur : {error}</div>
  }

  //Permet d'orienter l'appel du composant React pour la version mobile
  const handleClickFiltersSmartphone = (filter) => {
    setActiveMobileFilter(filter)
  }

  return (
    <div className='tpi-soutenance-page'>
      {isMobile && (
        <Fragment>
          <div className='message-smartphone'>
            <p>
              TpiOrganizer est en cours de développement et la fonctionnalité
              smartphone ne fonctionne pas de manière satisfaisante. Merci de
              vous connecter avec un ordinateur.
            </p>
          </div>

          {/* Render filters for smartphone */}
          <div className='filters-smartphone'>
            <button
              type='button'
              className='smartphone'
              onClick={() => handleClickFiltersSmartphone("MesTPI")}
            >
              Mes TPI
            </button>
            <button
              type='button'
              className='smartphone'
              onClick={() => handleClickFiltersSmartphone("SalleClasse")}
            >
              Salle
              <br />
              Classe
            </button>
          </div>

          {activeMobileFilter === "MesTPI" && (
            <MobileMesTpiFilter mesTpi={filteredData} hasToken={Boolean(token)} />
          )}

          {activeMobileFilter === "SalleClasse" && (
            // Rendu pour le filtre 'SalleClasse'
            <MobileRoomFilter rooms={soutenanceData} schedule={schedule} />
          )}
        </Fragment>
      )}

      {!isMobile && (
        <Fragment>
          <SoutenanceDesktopHeader
            isScrolled={isScrolled}
            isDemo={isDemo}
            year={year}
            expertOrBoss={expertOrBoss}
            isOn={isOn}
            setIsOn={setIsOn}
            updateFilter={updateFilter}
            filters={filters}
            uniqueExperts={uniqueExperts}
            uniqueProjectManagers={uniqueProjectManagers}
            uniqueCandidates={uniqueCandidates}
            uniqueDates={uniqueDates}
            uniqueSites={uniqueSites}
            uniqueSalles={uniqueSalles}
          />

          <div
            id='soutenances'
            className={`soutenances ${isFilterApplied ? "filterActive" : ""}`}
          >
            <div className='dataGrid'>
              {/* Affichez renderSchedule(schedule) seulement si aucun filtre spécifique n'est appliqué */}
              {!isFilterApplied && renderSchedule(displayedSchedule)}
              <RenderRooms
                year={year}
                tpiDatas={filteredData}
                schedule={schedule}
                listOfPerson={listOfExpertsOrBoss}
                isAnyFilterApplied={isFilterApplied}
                loadData={loadData}
                token={token}
                isOn={isOn}
                updateSoutenanceData={updateSoutenanceData}
              />
            </div>
          </div>
        </Fragment>
      )}
    </div>
  )
}
export default TpiSoutenance
