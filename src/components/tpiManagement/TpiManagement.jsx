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
import { coordinationCatalogService, coordinationConfigService } from '../../services/coordinationService'
import {
  getCoordinationYearFromSearch,
  getPreferredCoordinationYear,
  persistCoordinationYear
} from '../../utils/coordinationYear.js'
import { getPlanningPerimeterState } from '../../utils/coordinationScopeUtils.js'
import { getStakeholderIssues } from './tpiManagementUtils.js'
import { getTpiRelationRoleLabel } from '../../utils/stakeholderRules.js'

import '../../css/tpiManagement/tpiManagementStyle.css'

const generateAvailableYears = () => YEARS_CONFIG.getAvailableYears()
const REQUIRED_TPI_RELATIONS_LABEL = [
  getTpiRelationRoleLabel('candidat'),
  getTpiRelationRoleLabel('expert1'),
  getTpiRelationRoleLabel('expert2'),
  getTpiRelationRoleLabel('chef_projet')
].join(', ')

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
  const [year, setYear] = useState(() => getPreferredCoordinationYear(location.search))
  const [searchTerm, setSearchTerm] = useState('')
  const [planningScopeFilter, setPlanningScopeFilter] = useState('all')
  const [stakeholderFilter, setStakeholderFilter] = useState('all')
  const fetchRequestIdRef = useRef(0)

  const availableYears = useMemo(
    () => generateAvailableYears().slice().sort((left, right) => right - left),
    []
  )
  const requestedYear = useMemo(() => {
    return getCoordinationYearFromSearch(location.search)
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

  const planningScopeStats = useMemo(() => {
    return tpiList.reduce(
      (stats, tpi) => {
        const planningPerimeter = getPlanningPerimeterState(tpi, planningSiteConfigs, year)

        if (planningPerimeter.isPlanifiable) {
          stats.planifiable += 1
        } else {
          stats.outOfScope += 1
        }

        stats.total += 1
        return stats
      },
      { planifiable: 0, outOfScope: 0, total: 0 }
    )
  }, [planningSiteConfigs, tpiList, year])

  const stakeholderStats = useMemo(() => {
    return tpiList.reduce(
      (stats, tpi) => {
        const planningPerimeter = getPlanningPerimeterState(tpi, planningSiteConfigs, year)

        stats.total += 1

        if (!planningPerimeter.isPlanifiable) {
          return stats
        }

        const stakeholderIssues = getStakeholderIssues(tpi)

        if (stakeholderIssues.missingStakeholders.length > 0) {
          stats.missing += 1
        }

        if (stakeholderIssues.hasIssues) {
          stats.issues += 1
        }

        return stats
      },
      { missing: 0, issues: 0, total: 0 }
    )
  }, [planningSiteConfigs, tpiList, year])

  const fetchData = useCallback(async () => {
    const requestId = fetchRequestIdRef.current + 1
    fetchRequestIdRef.current = requestId
    setIsLoading(true)
    setError(null)

    try {
      const [data, catalog, config] = await Promise.all([
        getTpiFromServer(year),
        coordinationCatalogService.getGlobal().catch((err) => {
          console.error('Erreur lors du chargement du catalogue central:', err)
          return null
        }),
        coordinationConfigService.getByYear(year).catch((err) => {
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
    setPlanningScopeFilter('all')
    setStakeholderFilter('all')
  }, [availableYears, requestedYear, year])

  useEffect(() => {
    persistCoordinationYear(year)
  }, [year])

  useEffect(() => {
    setPlanningScopeFilter('all')
    setStakeholderFilter('all')
  }, [year])

  useEffect(() => {
    if (planningScopeFilter === 'planifiable' && planningScopeStats.planifiable === 0) {
      setPlanningScopeFilter('all')
    }

    if (planningScopeFilter === 'out-of-scope' && planningScopeStats.outOfScope === 0) {
      setPlanningScopeFilter('all')
    }
  }, [planningScopeFilter, planningScopeStats.outOfScope, planningScopeStats.planifiable])

  useEffect(() => {
    if (stakeholderFilter === 'missing' && stakeholderStats.missing === 0) {
      setStakeholderFilter('all')
    }

    if (stakeholderFilter === 'issues' && stakeholderStats.issues === 0) {
      setStakeholderFilter('all')
    }
  }, [stakeholderFilter, stakeholderStats.issues, stakeholderStats.missing])

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
        <section className='tpi-management-hero' aria-labelledby='tpi-management-title'>
          <div className='tpi-management-hero-copy'>
            <h1 id='tpi-management-title'>Catalogue {year}</h1>
          </div>

          <div className='tpi-management-hero-side'>
            {planningScopeStats.total > 0 ? (
              <div className='tpi-management-planning-filter' role='group' aria-label='Filtre périmètre coordination'>
                <button
                  type='button'
                  className={planningScopeFilter === 'planifiable' ? 'active' : ''}
                  onClick={() => setPlanningScopeFilter('planifiable')}
                  aria-pressed={planningScopeFilter === 'planifiable'}
                >
                  Planif.
                  <strong>{planningScopeStats.planifiable}</strong>
                </button>
                <button
                  type='button'
                  className={planningScopeFilter === 'out-of-scope' ? 'active' : ''}
                  onClick={() => setPlanningScopeFilter('out-of-scope')}
                  aria-pressed={planningScopeFilter === 'out-of-scope'}
                >
                  Hors pér.
                  <strong>{planningScopeStats.outOfScope}</strong>
                </button>
                <button
                  type='button'
                  className={planningScopeFilter === 'all' ? 'active' : ''}
                  onClick={() => setPlanningScopeFilter('all')}
                  aria-pressed={planningScopeFilter === 'all'}
                >
                  Tout
                  <strong>{planningScopeStats.total}</strong>
                </button>
              </div>
            ) : null}

            {stakeholderStats.issues > 0 ? (
              <div className='tpi-management-stakeholder-filter' role='group' aria-label='Filtre parties prenantes'>
                {stakeholderStats.missing > 0 ? (
                  <button
                    type='button'
                    className={stakeholderFilter === 'missing' ? 'active' : ''}
                    onClick={() => setStakeholderFilter('missing')}
                    aria-pressed={stakeholderFilter === 'missing'}
                  >
                    PP manquantes
                    <strong>{stakeholderStats.missing}</strong>
                  </button>
                ) : null}
                <button
                  type='button'
                  className={stakeholderFilter === 'issues' ? 'active' : ''}
                  onClick={() => setStakeholderFilter('issues')}
                  aria-pressed={stakeholderFilter === 'issues'}
                >
                  PP incorrectes
                  <strong>{stakeholderStats.issues}</strong>
                </button>
                <button
                  type='button'
                  className={stakeholderFilter === 'all' ? 'active' : ''}
                  onClick={() => setStakeholderFilter('all')}
                  aria-pressed={stakeholderFilter === 'all'}
                >
                  Toutes
                  <strong>{stakeholderStats.total}</strong>
                </button>
              </div>
            ) : null}

            <label className='tpi-management-search-panel' htmlFor='heroTpiSearchInput'>
              <span className='tpi-management-search-label'>Recherche</span>
              <input
                id='heroTpiSearchInput'
                type='search'
                className='tpi-management-hero-search'
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder='Référence, candidat, classe'
                aria-label='Rechercher un TPI'
              />
            </label>

            {requestedFocus ? (
              <div className='tpi-management-focus-panel' aria-label='Dossier ciblé'>
                <span>{requestedEditRef ? 'Édition ciblée' : requestedCreate ? 'Création ciblée' : 'Focus'}</span>
                <strong>{requestedFocus}</strong>
              </div>
            ) : null}
          </div>
        </section>

        {newTpi && (
          <section className='tpi-management-editor-shell'>
            <div className='tpi-management-editor-header'>
              <div>
                <span className='tpi-management-toolbar-label'>Creation</span>
                <h2>Nouveau TPI</h2>
              </div>
              <p>{REQUIRED_TPI_RELATIONS_LABEL} requis.</p>
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
              <p>Récupération des fiches {year}.</p>
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
            planningScopeFilter={planningScopeFilter}
            onPlanningScopeFilterChange={setPlanningScopeFilter}
            stakeholderFilter={stakeholderFilter}
            onStakeholderFilterChange={setStakeholderFilter}
          />
        )}
      </section>
    </div>
  </>
  )
}

export default TpiManagement
