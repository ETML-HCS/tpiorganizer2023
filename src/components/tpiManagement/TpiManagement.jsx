import React, { useState, useEffect, useCallback, useMemo } from 'react'

import { saveTpiToServer, getTpiFromServer } from './TpiData.jsx'
import TpiForm from './TpiForm.jsx'
import TpiList from './TpiList.jsx'
import TpiManagementButtons from './TpiManagementButtons.jsx'
import { YEARS_CONFIG } from '../../config/appConfig'
import { planningCatalogService, planningConfigService } from '../../services/planningService'
import {
  hasMissingStakeholders,
  shouldDisplayTag,
  splitTags
} from './tpiManagementUtils.js'

import '../../css/tpiManagement/tpiManagementStyle.css'

const generateAvailableYears = () => YEARS_CONFIG.getAvailableYears()

const TpiManagement = ({ toggleArrow, isArrowUp }) => {
  const [newTpi, setNewTpi] = useState(false)
  const [tpiList, setTpiList] = useState([])
  const [planningCatalogSites, setPlanningCatalogSites] = useState([])
  const [planningClassTypes, setPlanningClassTypes] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [searchTerm, setSearchTerm] = useState('')

  const availableYears = useMemo(
    () => generateAvailableYears().slice().sort((left, right) => right - left),
    []
  )

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [data, catalog, config] = await Promise.all([
        getTpiFromServer(year),
        planningCatalogService.getGlobal().catch((err) => {
          console.error('Erreur lors du chargement du catalogue central:', err)
          return null
        }),
        planningConfigService.getByYear(year).catch((err) => {
          if (err?.status !== 404) {
            console.error('Erreur lors du chargement de la configuration annuelle:', err)
          }

          return null
        })
      ])

      setTpiList(Array.isArray(data) ? data : [])
      setPlanningCatalogSites(Array.isArray(catalog?.sites) ? catalog.sites : [])
      setPlanningClassTypes(Array.isArray(config?.classTypes) ? config.classTypes : [])
    } catch (err) {
      console.error('Erreur lors de la recuperation des TPI:', err)
      setError('Impossible de charger les TPI pour cette annee.')
      setTpiList([])
      setPlanningCatalogSites([])
      setPlanningClassTypes([])
    } finally {
      setIsLoading(false)
    }
  }, [year])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleSaveTpi = useCallback(
    async (tpiDetails) => {
      const savedTpi = await saveTpiToServer(tpiDetails, year)

      if (savedTpi) {
        await fetchData()
      }

      return savedTpi
    },
    [fetchData, year]
  )

  const handleOnClose = useCallback(() => {
    setNewTpi(false)
  }, [])

  const handleYearChange = useCallback((selectedYear) => {
    setYear(Number(selectedYear))
    setNewTpi(false)
  }, [])

  const overviewStats = useMemo(() => {
    const uniqueCompanies = new Set()
    const uniqueTags = new Set()
    let plannedSoutenances = 0
    let missingStakeholdersCount = 0

    tpiList.forEach((tpi) => {
      if (tpi?.lieu?.entreprise) {
        uniqueCompanies.add(tpi.lieu.entreprise)
      }

      if (tpi?.dates?.soutenance) {
        plannedSoutenances += 1
      }

      splitTags(tpi?.tags)
        .filter(shouldDisplayTag)
        .forEach((tag) => uniqueTags.add(tag))

      if (hasMissingStakeholders(tpi)) {
        missingStakeholdersCount += 1
      }
    })

    return {
      companies: uniqueCompanies.size,
      tags: uniqueTags.size,
      soutenances: plannedSoutenances,
      missingStakeholders: missingStakeholdersCount
    }
  }, [tpiList])

  const overviewChips = useMemo(
    () => [
      { label: 'Année', value: year },
      { label: 'Fiches', value: tpiList.length },
      { label: 'Entreprises', value: overviewStats.companies || 0 },
      { label: 'Tags', value: overviewStats.tags || 0 },
      { label: 'Soutenances', value: overviewStats.soutenances || 0 },
      { label: 'PP', value: overviewStats.missingStakeholders || 0 }
    ],
    [overviewStats, tpiList.length, year]
  )

  return (
    <>
      <TpiManagementButtons
        newTpi={newTpi}
        onNewTpi={setNewTpi}
        onImportComplete={fetchData}
        toggleArrow={toggleArrow}
        isArrowUp={isArrowUp}
        year={year}
        tpiCount={tpiList.length}
      />

      <div className='container tpi-management-page'>
        <section className='tpi-management-hero'>
          <div className='tpi-management-hero-copy'>
            <span className='tpi-management-kicker'>Catalogue TPI</span>
            <h1>Fiches de l&apos;année {year}</h1>

            <div className='tpi-management-chips' aria-label='Contexte'>
              {overviewChips.map((chip) => (
                <span key={chip.label} className='tpi-management-chip'>
                  <strong>{chip.value}</strong>
                  <span>{chip.label}</span>
                </span>
              ))}
            </div>
          </div>

          <div className='tpi-management-hero-side'>
            <div className='tpi-management-year-panel'>
              <div className='tpi-management-year-picker'>
                {availableYears.map((availableYear) => (
                  <button
                    key={availableYear}
                    type='button'
                    onClick={() => handleYearChange(availableYear)}
                    className={year === availableYear ? 'active' : ''}
                    aria-pressed={year === availableYear}
                  >
                    {availableYear}
                  </button>
                ))}
              </div>
              <input
                id='heroTpiSearchInput'
                type='search'
                className='tpi-management-hero-search'
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder='Recher.'
                aria-label='Rechercher un TPI'
              />
            </div>
          </div>
        </section>

        {newTpi && (
          <section className='tpi-management-editor-shell'>
            <div className='tpi-management-editor-header'>
              <div>
                <span className='tpi-management-toolbar-label'>Creation</span>
                <h2>Nouveau TPI</h2>
              </div>
              <p>Les quatre parties prenantes sont requises: candidat, expert 1, expert 2 et chef de projet.</p>
            </div>

            <TpiForm onSave={handleSaveTpi} onClose={handleOnClose} year={year} />
          </section>
        )}

        <section className='tpi-management-content'>
          {isLoading && (
            <div className='tpi-management-state-card'>
              <h3>Chargement en cours</h3>
              <p>Recuperation des fiches TPI de l&apos;annee {year}.</p>
            </div>
          )}

          {!isLoading && error && (
            <div className='tpi-management-state-card error'>
              <h3>Chargement impossible</h3>
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !error && (
          <TpiList
            tpiList={tpiList}
            onSave={handleSaveTpi}
            year={year}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            planningCatalogSites={planningCatalogSites}
            planningClassTypes={planningClassTypes}
          />
        )}
      </section>
    </div>
  </>
  )
}

export default TpiManagement
