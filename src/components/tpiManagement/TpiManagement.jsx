import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { saveTpiToServer, getTpiFromServer } from './TpiData.jsx'
import TpiForm from './TpiForm.jsx'
import TpiList from './TpiList.jsx'
import TpiManagementButtons from './TpiManagementButtons.jsx'
import { createTpiModel, updateTpiModel } from '../tpiControllers/TpiController.jsx'
import { extractLegacyRefFromWorkflowReference } from '../tpiDetail/tpiDetailUtils.js'
import { getPlanningClassPeriod } from '../tpiPlanning/planningClassUtils.js'
import { YEARS_CONFIG } from '../../config/appConfig'
import { planningCatalogService, planningConfigService } from '../../services/planningService'
import { getPlanningPerimeterState } from '../../utils/planningScopeUtils.js'
import {
  hasMissingStakeholders,
  shouldDisplayTag,
  splitTags
} from './tpiManagementUtils.js'

import '../../css/tpiManagement/tpiManagementStyle.css'

const generateAvailableYears = () => YEARS_CONFIG.getAvailableYears()

const TpiManagement = ({ toggleArrow, isArrowUp }) => {
  const location = useLocation()
  const [newTpi, setNewTpi] = useState(false)
  const [tpiList, setTpiList] = useState([])
  const [planningCatalogSites, setPlanningCatalogSites] = useState([])
  const [planningClassTypes, setPlanningClassTypes] = useState([])
  const [planningSoutenanceDates, setPlanningSoutenanceDates] = useState([])
  const [planningSiteConfigs, setPlanningSiteConfigs] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [searchTerm, setSearchTerm] = useState('')
  const fetchRequestIdRef = useRef(0)

  const availableYears = useMemo(
    () => generateAvailableYears().slice().sort((left, right) => right - left),
    []
  )
  const requestedYear = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const value = Number.parseInt(params.get('year'), 10)

    return Number.isInteger(value) ? value : null
  }, [location.search])
  const requestedFocus = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return extractLegacyRefFromWorkflowReference(params.get('focus'), requestedYear || year)
  }, [location.search, requestedYear, year])
  const requestedEditRef = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const editFlag = String(params.get('edit') || '').trim().toLowerCase()

    if (!requestedFocus || !['1', 'true', 'yes'].includes(editFlag)) {
      return ''
    }

    return requestedFocus
  }, [location.search, requestedFocus])
  const requestedCreate = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const createFlag = String(params.get('new') || '').trim().toLowerCase()

    return ['1', 'true', 'yes'].includes(createFlag)
  }, [location.search])
  const requestedPrefillTpi = useMemo(() => {
    if (!requestedCreate) {
      return null
    }

    const prefillTpi = location.state?.prefillTpi
    return prefillTpi && typeof prefillTpi === 'object' ? prefillTpi : null
  }, [location.state, requestedCreate])
  const enrichedRequestedPrefillTpi = useMemo(() => {
    if (!requestedPrefillTpi) {
      return null
    }

    const classPeriod = getPlanningClassPeriod(
      requestedPrefillTpi?.classe,
      planningClassTypes,
      planningCatalogSites,
      requestedPrefillTpi?.site || requestedPrefillTpi?.lieu?.site
    )

    return {
      ...requestedPrefillTpi,
      dateDepart: requestedPrefillTpi?.dateDepart || classPeriod.startDate || '',
      dateFin: requestedPrefillTpi?.dateFin || classPeriod.endDate || ''
    }
  }, [planningCatalogSites, planningClassTypes, requestedPrefillTpi])

  const fetchData = useCallback(async () => {
    const requestId = fetchRequestIdRef.current + 1
    fetchRequestIdRef.current = requestId
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

      if (fetchRequestIdRef.current !== requestId) {
        return
      }

      setTpiList(Array.isArray(data) ? data : [])
      setPlanningCatalogSites(Array.isArray(catalog?.sites) ? catalog.sites : [])
      setPlanningClassTypes(Array.isArray(config?.classTypes) ? config.classTypes : [])
      setPlanningSoutenanceDates(Array.isArray(config?.soutenanceDates) ? config.soutenanceDates : [])
      setPlanningSiteConfigs(Array.isArray(config?.siteConfigs) ? config.siteConfigs : [])
    } catch (err) {
      if (fetchRequestIdRef.current !== requestId) {
        return
      }

      console.error('Erreur lors de la recuperation des TPI:', err)
      setError('Impossible de charger les TPI pour cette annee.')
      setTpiList([])
      setPlanningCatalogSites([])
      setPlanningClassTypes([])
      setPlanningSoutenanceDates([])
      setPlanningSiteConfigs([])
    } finally {
      if (fetchRequestIdRef.current === requestId) {
        setIsLoading(false)
      }
    }
  }, [year])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    return () => {
      fetchRequestIdRef.current += 1
    }
  }, [])

  useEffect(() => {
    if (!requestedYear || !availableYears.includes(requestedYear) || requestedYear === year) {
      return
    }

    setYear(requestedYear)
    setNewTpi(false)
  }, [availableYears, requestedYear, year])

  useEffect(() => {
    setSearchTerm(requestedFocus)
  }, [requestedFocus])

  useEffect(() => {
    if (!requestedCreate) {
      return
    }

    setNewTpi(true)
  }, [requestedCreate])

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

  const handleBulkSave = useCallback(
    async (tpiBatch = []) => {
      const normalizedBatch = Array.isArray(tpiBatch) ? tpiBatch.filter(Boolean) : []
      const failures = []
      let successCount = 0

      for (const tpiDetails of normalizedBatch) {
        try {
          const tpiId = String(tpiDetails?._id || '').trim()

          if (tpiId) {
            const { _id, ...updatePayload } = tpiDetails
            await updateTpiModel(tpiId, year, updatePayload)
          } else {
            await createTpiModel(tpiDetails, year, { validationMode: 'manual' })
          }

          successCount += 1
        } catch (saveError) {
          failures.push({
            refTpi: String(tpiDetails?.refTpi || '').trim() || 'Référence inconnue',
            message: saveError?.message || 'Erreur lors de la sauvegarde'
          })
        }
      }

      if (successCount > 0) {
        await fetchData()
      }

      return {
        total: normalizedBatch.length,
        successCount,
        failureCount: failures.length,
        failures
      }
    },
    [fetchData, year]
  )

  const handleYearChange = useCallback((selectedYear) => {
    setYear(Number(selectedYear))
    setNewTpi(false)
  }, [])

  const overviewStats = useMemo(() => {
    const uniqueCompanies = new Set()
    const uniqueTags = new Set()
    let plannedSoutenances = 0
    let missingStakeholdersCount = 0
    let planifiableCount = 0
    let outOfScopeCount = 0

    tpiList.forEach((tpi) => {
      const planningPerimeter = getPlanningPerimeterState(tpi, planningSiteConfigs, year)

      if (tpi?.lieu?.entreprise) {
        uniqueCompanies.add(tpi.lieu.entreprise)
      }

      if (tpi?.dates?.soutenance) {
        plannedSoutenances += 1
      }

      splitTags(tpi?.tags)
        .filter(shouldDisplayTag)
        .forEach((tag) => uniqueTags.add(tag))

      if (planningPerimeter.isPlanifiable) {
        planifiableCount += 1
      } else {
        outOfScopeCount += 1
      }

      if (planningPerimeter.isPlanifiable && hasMissingStakeholders(tpi)) {
        missingStakeholdersCount += 1
      }
    })

    return {
      companies: uniqueCompanies.size,
      tags: uniqueTags.size,
      soutenances: plannedSoutenances,
      missingStakeholders: missingStakeholdersCount,
      planifiable: planifiableCount,
      outOfScope: outOfScopeCount
    }
  }, [planningSiteConfigs, tpiList, year])

  const overviewChips = useMemo(
    () => [
      { label: 'Fiches', value: tpiList.length },
      { label: 'Entreprises', value: overviewStats.companies || 0 },
      { label: 'Soutenances', value: overviewStats.soutenances || 0 }
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
              {requestedFocus ? (
                <span className='tpi-management-chip tpi-management-chip-focus'>
                  <strong>{requestedFocus}</strong>
                  <span>{requestedEditRef ? 'Édition ciblée' : requestedCreate ? 'Création ciblée' : 'Focus'}</span>
                </span>
              ) : null}
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

            <TpiForm
              onSave={handleSaveTpi}
              onClose={handleOnClose}
              year={year}
              initialTpi={requestedCreate ? enrichedRequestedPrefillTpi : null}
              planningCatalogSites={planningCatalogSites}
              planningClassTypes={planningClassTypes}
              planningSoutenanceDates={planningSoutenanceDates}
            />
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
            onBulkSave={handleBulkSave}
            year={year}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            focusedTpiRef={requestedFocus}
            requestedEditRef={requestedEditRef}
            planningCatalogSites={planningCatalogSites}
            planningClassTypes={planningClassTypes}
            planningSoutenanceDates={planningSoutenanceDates}
            planningSiteConfigs={planningSiteConfigs}
          />
        )}
      </section>
    </div>
  </>
  )
}

export default TpiManagement
