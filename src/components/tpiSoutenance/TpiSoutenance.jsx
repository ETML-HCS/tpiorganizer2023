import React, { useState, useEffect, Fragment } from "react"

import { useLocation, useNavigate, useParams } from "react-router-dom"
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
  const location = useLocation()
  const navigate = useNavigate()
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
  const focusReference = String(filters.reference || '').trim()
  const hasFocusedResults = filteredData.length > 0

  const clearFocusedView = () => {
    const params = new URLSearchParams(location.search)
    params.delete("focus")
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : ""
      },
      { replace: true }
    )
    updateFilter("reference", "")
  }

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

          {focusReference && (
            <section className={`soutenance-focus-banner ${hasFocusedResults ? "is-ready" : "is-missing"}`}>
              <div>
                <strong>Focus actif: {focusReference}</strong>
                <p>
                  {hasFocusedResults
                    ? "La vue mobile est filtrée sur la fiche ciblée."
                    : "Aucune soutenance publiée ne correspond à cette référence."}
                </p>
              </div>
              <button type='button' onClick={clearFocusedView}>
                Effacer le focus
              </button>
            </section>
          )}

          {activeMobileFilter === "MesTPI" && (
            <MobileMesTpiFilter mesTpi={filteredData} hasToken={Boolean(token)} year={year} />
          )}

          {activeMobileFilter === "SalleClasse" && (
            // Rendu pour le filtre 'SalleClasse'
            <MobileRoomFilter rooms={soutenanceData} schedule={schedule} year={year} />
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

          {focusReference && (
            <section className={`soutenance-focus-banner ${hasFocusedResults ? "is-ready" : "is-missing"}`}>
              <div>
                <strong>Focus actif: {focusReference}</strong>
                <p>
                  {hasFocusedResults
                    ? "Les salles publiées sont filtrées sur la fiche ciblée."
                    : `Aucune soutenance publiée ne correspond à ${focusReference} pour ${year}.`}
                </p>
              </div>
              <button type='button' onClick={clearFocusedView}>
                Effacer le focus
              </button>
            </section>
          )}

          <div
            id='soutenances'
            className={`soutenances ${isFilterApplied ? "filterActive" : ""}`}
          >
            <div className='dataGrid'>
              {/* Affichez renderSchedule(schedule) seulement si aucun filtre spécifique n'est appliqué */}
              {!isFilterApplied && renderSchedule(displayedSchedule)}
              {filteredData.length === 0 ? (
                <div className='soutenance-empty-state'>
                  <strong>Aucune soutenance à afficher.</strong>
                  <p>
                    {focusReference
                      ? `La référence ${focusReference} n'est pas visible dans les soutenances publiées avec les filtres actuels.`
                      : "Aucun résultat ne correspond aux filtres sélectionnés."}
                  </p>
                </div>
              ) : null}
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
