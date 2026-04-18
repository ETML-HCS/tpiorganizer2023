import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import PageToolbar from '../shared/PageToolbar'
import { MAIN_NAVIGATION_LINKS } from '../shared/mainNavigation'
import { tpiDossierService } from '../../services/tpiDossierService'
import { createTpiModel, updateTpiModel } from '../tpiControllers/TpiController.jsx'
import TpiDetailSections from './TpiDetailSections'
import { compactText, buildLegacyPayloadFromDossier } from './tpiDetailUtils'

const TpiDetailPage = ({ toggleArrow, isArrowUp }) => {
  const { year, ref } = useParams()
  const [dossier, setDossier] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [legacyMutationPending, setLegacyMutationPending] = useState(false)
  const [legacyMutationFeedback, setLegacyMutationFeedback] = useState(null)

  const loadDossier = useCallback(async (options = {}) => {
    const { silent = false } = options

    if (!silent) {
      setIsLoading(true)
    }

    setError('')

    try {
      const response = await tpiDossierService.getByRef(year, ref)

      setDossier(response)
      return response
    } catch (loadError) {
      setDossier(null)
      setError(
        loadError?.data?.error ||
        loadError?.message ||
        'Impossible de charger le dossier TPI.'
      )
      return null
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
    }
  }, [ref, year])

  useEffect(() => {
    void loadDossier()
  }, [loadDossier])

  const handleLegacyQuickSave = useCallback(async (quickDraft) => {
    if (!dossier?.legacy?.exists || !dossier?.identifiers?.legacyId) {
      return false
    }

    setLegacyMutationPending(true)
    setLegacyMutationFeedback(null)

    try {
      const payload = buildLegacyPayloadFromDossier(dossier, {
        sujet: quickDraft?.sujet,
        classe: quickDraft?.classe,
        lieu: {
          entreprise: quickDraft?.lieuEntreprise,
          site: quickDraft?.lieuSite
        },
        lienDepot: quickDraft?.lienDepot
      })

      await updateTpiModel(dossier.identifiers.legacyId, year, payload)
      await loadDossier({ silent: true })
      setLegacyMutationFeedback({
        tone: 'success',
        message: 'Fiche GestionTPI mise à jour depuis la vue détail.'
      })
      return true
    } catch (saveError) {
      setLegacyMutationFeedback({
        tone: 'error',
        message: saveError?.message || 'Impossible de mettre à jour la fiche GestionTPI.'
      })
      return false
    } finally {
      setLegacyMutationPending(false)
    }
  }, [dossier, loadDossier, year])

  const handleLegacyQuickCreate = useCallback(async () => {
    if (dossier?.legacy?.exists) {
      return false
    }

    setLegacyMutationPending(true)
    setLegacyMutationFeedback(null)

    try {
      const payload = buildLegacyPayloadFromDossier(dossier)
      await createTpiModel(payload, year, { validationMode: 'manual' })
      await loadDossier({ silent: true })
      setLegacyMutationFeedback({
        tone: 'success',
        message: 'Fiche GestionTPI créée depuis la vue détail.'
      })
      return true
    } catch (createError) {
      setLegacyMutationFeedback({
        tone: 'error',
        message: createError?.message || 'Impossible de créer la fiche GestionTPI depuis cette vue.'
      })
      return false
    } finally {
      setLegacyMutationPending(false)
    }
  }, [dossier, loadDossier, year])

  const displayReference = useMemo(() => {
    return compactText(dossier?.identifiers?.workflowReference) ||
      compactText(dossier?.identifiers?.legacyRef) ||
      compactText(ref)
  }, [dossier, ref])
  const navigationLinks = MAIN_NAVIGATION_LINKS

  return (
    <div className='tpi-detail-page'>
      <PageToolbar
        id='tpi-detail-tools'
        eyebrow='Fiche TPI'
        title={displayReference ? `Dossier ${displayReference}` : 'Dossier TPI'}
        description='Lecture croisée de la fiche GestionTPI et du workflow Planning.'
        navigationLinks={navigationLinks}
        toggleArrow={toggleArrow}
        isArrowUp={isArrowUp}
        meta={(
          <div className='tpi-detail-toolbar-meta'>
            <span className='tpi-detail-pill'>Année {year}</span>
            <span className={`tpi-detail-pill ${dossier?.legacy?.exists ? 'is-ready' : 'is-muted'}`}>
              GestionTPI {dossier?.legacy?.exists ? 'liée' : 'absente'}
            </span>
            <span className={`tpi-detail-pill ${dossier?.planning?.exists ? 'is-ready' : 'is-muted'}`}>
              Planning {dossier?.planning?.exists ? 'lié' : 'absent'}
            </span>
          </div>
        )}
        actions={(
          <div className='tpi-detail-toolbar-actions'>
            <Link className='tpi-detail-toolbar-link' to='/gestionTPI'>
              Gestion TPI
            </Link>
            <Link className='tpi-detail-toolbar-link' to={`/planning/${year}`}>
              Planning {year}
            </Link>
            <Link className='tpi-detail-toolbar-link' to={`/Soutenances/${year}`}>
              Soutenances {year}
            </Link>
          </div>
        )}
      />

      <div className='container tpi-detail-content'>
        {isLoading ? (
          <section className='tpi-detail-state-card'>
            <h2>Chargement</h2>
            <p>Récupération du dossier TPI en cours.</p>
          </section>
        ) : null}

        {!isLoading && error ? (
          <section className='tpi-detail-state-card error'>
            <h2>Chargement impossible</h2>
            <p>{error}</p>
          </section>
        ) : null}

        {!isLoading && !error && dossier ? (
          <TpiDetailSections
            dossier={dossier}
            quickActions={{
              isPending: legacyMutationPending,
              feedback: legacyMutationFeedback,
              onSaveLegacy: handleLegacyQuickSave,
              onCreateLegacy: handleLegacyQuickCreate
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

export default TpiDetailPage
