import React, { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { Link } from 'react-router-dom'

import { createTpiModel, deleteTpiModelsByYear } from '../tpiControllers/TpiController.jsx'
import IconButtonContent from '../shared/IconButtonContent.jsx'
import PageToolbar from '../shared/PageToolbar.jsx'
import {
  buttonIconProps,
  CloseIcon,
  InboxIcon,
  PencilIcon,
  TrashIcon
} from '../shared/InlineIcons'
import { MAIN_NAVIGATION_LINKS } from '../shared/mainNavigation'
import { showNotification } from '../Tools.jsx'
import { STORAGE_KEYS } from '../../config/appConfig'
import { readJSONListValue, writeJSONValue } from '../../utils/storage'
import {
  IMPORT_FIELD_DEFS,
  buildDefaultImportMapping,
  buildImportProcessingReport,
  getImportMode,
  getMissingRequiredMappingKeys
} from './tpiImportWorkflow.js'
import {
  buildStakeholderDraftEntries,
  mergeStakeholderDraftEntries
} from './tpiStakeholderDraftUtils.js'

const toolsBodyIconProps = buttonIconProps

const ChooseCsvIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...toolsBodyIconProps} {...props}>
    <path d='M3.5 8.5A2.5 2.5 0 0 1 6 6h3l1.8 1.8H18A2.5 2.5 0 0 1 20.5 10v6.5A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5z' />
    <rect x='8.1' y='10.1' width='5.7' height='6.9' rx='1.2' fill='currentColor' opacity='0.14' stroke='none' />
    <path d='M9.6 12.2h2.7M9.6 14.8h2.7' />
  </svg>
)

const DetectColumnsIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...toolsBodyIconProps} {...props}>
    <rect x='4.5' y='5' width='9.5' height='14' rx='2.2' />
    <path d='M7.7 5v14M10.8 5v14' />
    <path d='m17.2 8.4.9 1.9 1.9.9-1.9.9-.9 1.9-.9-1.9-1.9-.9 1.9-.9z' />
  </svg>
)

const SubmitImportIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...toolsBodyIconProps} {...props}>
    <path d='M12 4.5v8.2' />
    <path d='m8.8 9.8 3.2 3.2 3.2-3.2' />
    <path d='M5.5 14.8v2.2A2.5 2.5 0 0 0 8 19.5h8a2.5 2.5 0 0 0 2.5-2.5v-2.2' />
    <path d='M7.2 19.5h9.6' />
    <path d='M7 15.6h10' opacity='0.45' />
  </svg>
)

const ClosePanelIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...toolsBodyIconProps} {...props}>
    <circle cx='12' cy='12' r='7.8' fill='currentColor' opacity='0.12' stroke='none' />
    <circle cx='12' cy='12' r='7.8' />
    <path d='m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6' />
  </svg>
)

const TpiManagementButtons = ({
  onNewTpi,
  newTpi,
  onImportComplete,
  toggleArrow,
  isArrowUp,
  year,
  tpiCount = 0
}) => {
  const [showImportForm, setShowImportForm] = useState(false)
  const [importYear, setImportYear] = useState(String(year))
  const [isImporting, setIsImporting] = useState(false)
  const [isDeletingYear, setIsDeletingYear] = useState(false)
  const [isParsingFile, setIsParsingFile] = useState(false)
  const [importFileName, setImportFileName] = useState('')
  const [importHeaders, setImportHeaders] = useState([])
  const [importRows, setImportRows] = useState([])
  const [importMapping, setImportMapping] = useState(() => buildDefaultImportMapping([]))
  const [importFeedback, setImportFeedback] = useState(null)

  useEffect(() => {
    setImportYear(String(year))
  }, [year])

  const handleCancelImport = () => {
    setShowImportForm(false)
  }

  const newTpiButtonLabel = newTpi ? 'Fermer le formulaire' : 'Nouveau TPI'
  const importButtonLabel = showImportForm ? "Fermer l'import" : 'Importer CSV'
  const deleteYearLabel = isDeletingYear ? 'Suppression...' : 'Vider l’année'

  const handleDeleteYearTpis = async () => {
    if (isDeletingYear) {
      return
    }

    const currentYear = Number.parseInt(year, 10)
    const countLabel = Number.isInteger(tpiCount) && tpiCount > 0 ? ` (${tpiCount} fiches)` : ''
    const confirmed = window.confirm(
      `Supprimer tous les TPI de l'année ${currentYear}${countLabel} ?\n\nCette action est irréversible.`
    )

    if (!confirmed) {
      return
    }

    setIsDeletingYear(true)

    try {
      const result = await deleteTpiModelsByYear(currentYear)
      const deletedCount = Number(result?.deletedCount || 0)

      showNotification(
        deletedCount > 0
          ? `${deletedCount} TPI supprimés pour l'année ${currentYear}.`
          : `Aucun TPI à supprimer pour l'année ${currentYear}.`,
        deletedCount > 0 ? 'success' : 'info',
        4000
      )

      setShowImportForm(false)
      setImportFeedback(null)
      await onImportComplete?.()
    } catch (error) {
      console.error('Erreur lors de la suppression des TPI de l année:', error)
      showNotification(
        error?.message || 'Erreur lors de la suppression des TPI de l année.',
        'error',
        4000
      )
    } finally {
      setIsDeletingYear(false)
    }
  }

  const handleImportFileChange = (event) => {
    const input = event.target
    const file = input.files?.[0]

    setImportFeedback(null)

    if (!file) {
      setImportFileName('')
      setImportHeaders([])
      setImportRows([])
      setImportMapping(buildDefaultImportMapping([]))
      input.value = ''
      return
    }

    setIsParsingFile(true)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        try {
          const headers = Array.isArray(result.meta?.fields)
            ? result.meta.fields.filter(Boolean)
            : Object.keys(result.data?.[0] || {})

          if (!headers.length) {
            setImportFeedback({
              type: 'error',
              title: 'CSV vide',
              message: 'Aucune colonne exploitable n’a été trouvée.',
              stats: null,
              issues: []
            })
            setImportFileName('')
            setImportHeaders([])
            setImportRows([])
            setImportMapping(buildDefaultImportMapping([]))
            input.value = ''
            return
          }

          const rows = Array.isArray(result.data)
            ? result.data.filter((row) =>
                Object.values(row || {}).some((value) => String(value ?? '').trim())
              )
            : []

          setImportFileName(file.name)
          setImportHeaders(headers)
          setImportRows(rows)
          setImportMapping(buildDefaultImportMapping(headers))
          setShowImportForm(true)
          input.value = ''
        } catch (error) {
          console.error("Erreur lors de l'analyse du fichier CSV:", error)
          setImportFeedback({
            type: 'error',
            title: 'CSV illisible',
            message: "Le fichier CSV n'a pas pu être analysé.",
            stats: null,
            issues: []
          })
          input.value = ''
        } finally {
          setIsParsingFile(false)
        }
      },
      error: (error) => {
        console.error("Erreur lors de la lecture du fichier CSV:", error)
        setImportFeedback({
          type: 'error',
          title: 'CSV illisible',
          message: 'Le fichier CSV est invalide ou illisible.',
          stats: null,
          issues: []
        })
        setImportFileName('')
        setImportHeaders([])
        setImportRows([])
        setImportMapping(buildDefaultImportMapping([]))
        input.value = ''
        setIsParsingFile(false)
      }
    })
  }

  const handleMappingChange = (fieldKey) => (event) => {
    const { value } = event.target
    setImportMapping((currentMapping) => ({
      ...currentMapping,
      [fieldKey]: value
    }))
    setImportFeedback(null)
  }

  const handleResetMapping = () => {
    setImportMapping(buildDefaultImportMapping(importHeaders))
    setImportFeedback(null)
  }

  const importMode = useMemo(() => getImportMode(importMapping), [importMapping])

  const requiredMappingKeys = useMemo(
    () =>
      importMode === 'legacy'
        ? ['refTpi', 'candidat', 'boss', 'legacyExpert', 'legacyExpertNo']
        : ['refTpi', 'candidat', 'boss', 'expert1', 'expert2'],
    [importMode]
  )

  const requiredFields = useMemo(
    () =>
      requiredMappingKeys
        .map((key) => IMPORT_FIELD_DEFS.find((field) => field.key === key))
        .filter(Boolean),
    [requiredMappingKeys]
  )

  const optionalFields = useMemo(
    () => IMPORT_FIELD_DEFS.filter((field) => !field.required && !field.advanced),
    []
  )

  const legacyFields = useMemo(
    () =>
      IMPORT_FIELD_DEFS.filter(
        (field) => field.advanced && !requiredMappingKeys.includes(field.key)
      ),
    [requiredMappingKeys]
  )
  const importFieldLabelByKey = useMemo(
    () =>
      IMPORT_FIELD_DEFS.reduce((labels, field) => {
        labels[field.key] = field.label
        return labels
      }, {}),
    []
  )

  const mappedImportFieldCount = useMemo(
    () => IMPORT_FIELD_DEFS.filter((field) => Boolean(importMapping[field.key])).length,
    [importMapping]
  )
  const mappedRequiredFieldCount = useMemo(
    () => requiredMappingKeys.filter((key) => Boolean(importMapping[key])).length,
    [importMapping, requiredMappingKeys]
  )
  const importSummaryChips = useMemo(
    () => [
      { label: 'Lignes', value: importRows.length },
      { label: 'Colonnes', value: importHeaders.length },
      {
        label: 'Requis',
        value: `${mappedRequiredFieldCount}/${requiredMappingKeys.length}`
      },
      { label: 'Mappés', value: mappedImportFieldCount },
      { label: 'Mode', value: importMode === 'legacy' ? 'historique' : 'standard' }
    ],
    [
      importHeaders.length,
      importMode,
      importRows.length,
      mappedImportFieldCount,
      mappedRequiredFieldCount,
      requiredMappingKeys.length
    ]
  )
  const missingMappingKeys = useMemo(
    () => getMissingRequiredMappingKeys(importMapping),
    [importMapping]
  )
  const missingMappingLabels = useMemo(
    () => missingMappingKeys.map((key) => importFieldLabelByKey[key] || key),
    [importFieldLabelByKey, missingMappingKeys]
  )
  const canSubmitImport =
    importRows.length > 0 && missingMappingKeys.length === 0 && !isImporting && !isParsingFile
  const toolbarNavigationLinks = useMemo(
    () => MAIN_NAVIGATION_LINKS.filter((link) => link?.to !== '/gestionTPI'),
    []
  )
  const toolbarMeta = useMemo(
    () => (showImportForm ? (
      <div className='tpi-management-toolbar-meta'>
        <span className='page-tools-chip'>Import ouvert</span>
      </div>
    ) : null),
    [showImportForm]
  )

  const renderMappingSelect = (field) => (
    <label
      key={field.key}
      className={`tpi-import-mapping-row ${field.advanced ? 'advanced' : ''} ${
        field.required ? 'required' : 'optional'
      }`}
      htmlFor={`mapping-${field.key}`}
    >
      <span>
        {field.label}
        {field.required ? ' *' : ''}
      </span>
      <select
        id={`mapping-${field.key}`}
        value={importMapping[field.key] || ''}
        onChange={handleMappingChange(field.key)}
      >
        <option value=''>Ignorer</option>
        {importHeaders.map((header) => (
          <option key={`${field.key}-${header}`} value={header}>
            {header}
          </option>
        ))}
      </select>
    </label>
  )

  const handleToggleCreateForm = () => {
    setShowImportForm(false)
    onNewTpi((previousValue) => !previousValue)
  }

  const handleToggleImportSection = () => {
    onNewTpi(false)
    setShowImportForm((previousValue) => !previousValue)
  }

  const handleSubmitImportForm = async (event) => {
    event.preventDefault()

    const selectedYear = Number.parseInt(importYear, 10)
    const missingKeys = getMissingRequiredMappingKeys(importMapping)

    if (!importRows.length) {
      showNotification('Veuillez selectionner un fichier CSV.', 'error', 3000)
      return
    }

    if (!Number.isInteger(selectedYear)) {
      showNotification("L'annee d'importation est invalide.", 'error', 3000)
      return
    }

    if (missingKeys.length > 0) {
      showNotification(
        `Correspondance incomplete: ${missingMappingLabels.join(', ')}.`,
        'error',
        4000
      )
      setImportFeedback({
        type: 'error',
        title: 'Correspondance incomplète',
        message: `Les champs obligatoires suivants doivent être mappés: ${missingMappingLabels.join(', ')}.`,
        stats: {
          totalRows: importRows.length,
          uniqueTpis: 0,
          imported: 0,
          failed: 0,
          skipped: 0,
          duplicates: 0,
          legacyRows: 0
        },
        issues: []
      })
      return
    }

    setIsImporting(true)
    try {
      const { tpis, summary } = buildImportProcessingReport(importRows, importMapping)
      const creationResults = []

      for (const tpi of tpis) {
        try {
          await createTpiModel(tpi, selectedYear, { validationMode: 'import' })
          creationResults.push({
            refTpi: tpi.refTpi,
            status: 'success'
          })
        } catch (creationError) {
          console.error(`Erreur lors de la sauvegarde du TPI ${tpi.refTpi}:`, creationError)
          creationResults.push({
            refTpi: tpi.refTpi,
            status: 'error',
            message: creationError?.message || 'Erreur inconnue'
          })
        }
      }

      const successCount = creationResults.filter((resultItem) => resultItem.status === 'success').length
      const failedRows = creationResults.filter((resultItem) => resultItem.status === 'error')
      const skippedCount = summary.skippedRows.length
      const duplicateCount = summary.duplicateRows.length
      const legacyCount = summary.legacyRows.length
      const importedRefs = new Set(
        creationResults
          .filter((resultItem) => resultItem.status === 'success')
          .map((resultItem) => String(resultItem.refTpi || '').trim())
          .filter(Boolean)
      )
      const importedTpis = tpis.filter((tpi) => importedRefs.has(String(tpi?.refTpi || '').trim()))
      const stakeholderDraftEntries = buildStakeholderDraftEntries(importedTpis, selectedYear)
      const stakeholderDraftCount = stakeholderDraftEntries.length
      const hasIssues = failedRows.length > 0 || skippedCount > 0 || duplicateCount > 0
      const feedbackType = successCount > 0 && !hasIssues ? 'success' : successCount > 0 ? 'warning' : 'error'
      const mainMessage =
        successCount > 0
          ? hasIssues
            ? `Import partiel: ${successCount} TPI importes, ${failedRows.length} en erreur, ${skippedCount} ignores.`
            : `Import OK: ${successCount} TPI importes.`
          : `Import impossible: aucun TPI importé.`

      if (stakeholderDraftCount > 0) {
        const existingDrafts = readJSONListValue(
          STORAGE_KEYS.PENDING_STAKEHOLDER_IMPORT,
          []
        )
        const mergedDrafts = mergeStakeholderDraftEntries(existingDrafts, stakeholderDraftEntries)
        writeJSONValue(STORAGE_KEYS.PENDING_STAKEHOLDER_IMPORT, mergedDrafts)
      }

      setImportFeedback({
        type: feedbackType,
        title:
          feedbackType === 'success'
            ? 'Import valide'
            : feedbackType === 'warning'
              ? 'Import partiel'
              : 'Import à corriger',
        message: mainMessage,
        stats: {
          totalRows: summary.totalRows,
          uniqueTpis: summary.uniqueTpis,
          imported: successCount,
          failed: failedRows.length,
          skipped: skippedCount,
          duplicates: duplicateCount,
          legacyRows: legacyCount,
          stakeholdersPending: stakeholderDraftCount
        },
        issues: [
          ...summary.skippedRows.map((row) => ({
            label: `Ligne ${row.row}${row.ref ? ` - ${row.ref}` : ''}`,
            value: row.reasons.join(', ')
          })),
          ...summary.duplicateRows.map((row) => ({
            label: `Doublon ligne ${row.row}`,
            value: `Référence ${row.ref} ignorée`
          })),
          ...failedRows.map((row) => ({
            label: `TPI ${row.refTpi}`,
            value: row.message
          }))
        ].slice(0, 6)
      })

      showNotification(
        stakeholderDraftCount > 0
          ? `${mainMessage} ${stakeholderDraftCount} fiche(s) parties prenantes a revoir dans le module dedie.`
          : mainMessage,
        feedbackType === 'error'
          ? 'error'
          : feedbackType === 'success'
            ? 'success'
            : 'info',
        4000
      )

      if (!hasIssues) {
        setShowImportForm(false)
        setImportFileName('')
        setImportHeaders([])
        setImportRows([])
        setImportMapping(buildDefaultImportMapping([]))
      }

      if (successCount > 0) {
        await onImportComplete?.()
      }
    } catch (error) {
      console.error("Erreur lors de l'import CSV:", error)
      setImportFeedback({
        type: 'error',
        title: 'Import impossible',
        message: error?.message || "L'import du fichier a échoué.",
        stats: null,
        issues: []
      })
      showNotification("L'import du fichier a echoue.", 'error', 3000)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <PageToolbar
      id='tools'
      className='tpi-management-tools'
      eyebrow='Gestion TPI'
      title={`Catalogue ${year}`}
      description='Créer, importer et nettoyer les fiches TPI d une année depuis un seul point d entrée.'
      meta={toolbarMeta}
      navigationLinks={toolbarNavigationLinks}
      navigationMode='floating'
      toggleArrow={toggleArrow}
      isArrowUp={isArrowUp}
      ariaLabel='Outils de gestion TPI'
      bodyClassName='tpi-management-tools-body'
    >
      <div className='page-tools-actions tpi-management-toolbar-actions'>
        <button
          id='btNewTpi'
          type='button'
          className={`page-tools-action-btn icon-button ${newTpi ? 'primary' : 'secondary'}`}
          onClick={handleToggleCreateForm}
          aria-pressed={newTpi}
          aria-label={newTpiButtonLabel}
          title={newTpiButtonLabel}
        >
          <IconButtonContent
            label={newTpiButtonLabel}
            icon={newTpi ? CloseIcon : PencilIcon}
            iconClassName='tpi-management-action-icon'
          />
        </button>

        <button
          id='btImportTpi'
          type='button'
          className={`page-tools-action-btn icon-button ${showImportForm ? 'primary' : 'secondary'}`}
          onClick={handleToggleImportSection}
          aria-expanded={showImportForm}
          aria-controls='tpi-import-panel'
          aria-label={importButtonLabel}
          title={importButtonLabel}
        >
          <IconButtonContent
            label={importButtonLabel}
            icon={showImportForm ? CloseIcon : InboxIcon}
            iconClassName='tpi-management-action-icon'
          />
        </button>

        {tpiCount > 0 ? (
          <button
            id='btDeleteYearTpi'
            type='button'
            className='page-tools-action-btn secondary danger tpi-management-year-danger icon-button icon-button--with-badge'
            onClick={handleDeleteYearTpis}
            disabled={isDeletingYear || isImporting || isParsingFile}
            aria-label={deleteYearLabel}
            title={`Supprimer tous les TPI de l'année ${year}`}
          >
            <IconButtonContent
              label={deleteYearLabel}
              icon={TrashIcon}
              iconClassName='tpi-management-action-icon'
            />
            <strong aria-hidden='true'>{tpiCount}</strong>
          </button>
        ) : null}
      </div>

      {importFeedback ? (
        <div className={`tpi-import-feedback ${importFeedback.type}`}>
          <div className='tpi-import-feedback-head'>
            <div>
              <span className='tpi-management-tools-label'>Résultat import</span>
              <h3>{importFeedback.title}</h3>
            </div>
            <p>{importFeedback.message}</p>
          </div>

          {importFeedback.stats ? (
            <div className='tpi-import-feedback-stats' aria-label="Résumé de l'import">
              <span>Sources: {importFeedback.stats.totalRows}</span>
              <span>TPIs: {importFeedback.stats.uniqueTpis}</span>
              <span>Créés: {importFeedback.stats.imported}</span>
              <span>Erreurs: {importFeedback.stats.failed}</span>
              <span>Ignorés: {importFeedback.stats.skipped}</span>
              {importFeedback.stats.duplicates > 0 ? (
                <span>Doublons: {importFeedback.stats.duplicates}</span>
              ) : null}
              {importFeedback.stats.legacyRows > 0 ? (
                <span>Lignes fusionnées: {importFeedback.stats.legacyRows}</span>
              ) : null}
              {importFeedback.stats.stakeholdersPending > 0 ? (
                <span>PP à compléter: {importFeedback.stats.stakeholdersPending}</span>
              ) : null}
            </div>
          ) : null}

          {importFeedback.stats?.stakeholdersPending > 0 ? (
            <div className='tpi-import-feedback-actions'>
              <Link
                to='/partiesPrenantes?tab=draft&draftStatus=actionable'
                className='tpi-import-feedback-link'
              >
                Ouvrir la complétion des parties prenantes
              </Link>
            </div>
          ) : null}

          {importFeedback.issues.length > 0 ? (
            <ul className='tpi-import-feedback-list'>
              {importFeedback.issues.map((issue) => (
                <li key={`${issue.label}-${issue.value}`}>
                  <strong>{issue.label}</strong>
                  <span>{issue.value}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {showImportForm ? (
        <div className='tpi-import-panel' id='tpi-import-panel'>
          <div className='tpi-import-panel-header'>
            <div className='tpi-import-panel-heading'>
              <span className='tpi-management-tools-label'>Import CSV</span>
              <h3>Préparer l&apos;import</h3>
              <p>
                Charge un CSV, vérifie l&apos;année, puis relie les colonnes avant de lancer
                l&apos;import.
              </p>
            </div>
            <div className='tpi-import-panel-meta'>
              <span>{importFileName ? 'Fichier prêt' : 'Aucun fichier'}</span>
              <span>Mode: {importMode === 'legacy' ? 'historique' : 'ligne unique'}</span>
              <span>Colonnes: {importHeaders.length}</span>
            </div>
          </div>

          <div className='tpi-import-summary' aria-label="Résumé de l'import CSV">
            {importSummaryChips.map((chip) => (
              <span key={chip.label} className='tpi-import-summary-chip'>
                <strong>{chip.value}</strong>
                <span>{chip.label}</span>
              </span>
            ))}
          </div>

          <form className='tpi-import-form' onSubmit={handleSubmitImportForm}>
            <section className='tpi-import-card tpi-import-source-card'>
              <div className='tpi-import-card-head'>
                <div>
                  <span className='tpi-management-tools-label'>Source</span>
                  <h4>Fichier et année</h4>
                </div>
              </div>

              <div className='tpi-import-source-grid'>
                <div className='tpi-import-file-block'>
                  <label className='page-tools-file-label tpi-import-file-trigger icon-button' htmlFor='fileInput'>
                    <ChooseCsvIcon className='tpi-management-action-icon' aria-hidden='true' />
                    <span className='tpi-management-action-label'>Choisir un CSV</span>
                  </label>
                  <input
                    type='file'
                    id='fileInput'
                    name='fileInput'
                    className='tpi-import-file-input'
                    accept='.csv'
                    onChange={handleImportFileChange}
                  />
                  <div className='tpi-import-file-meta'>
                    <strong>{importFileName || 'Aucun fichier sélectionné'}</strong>
                    <span>
                      {importRows.length > 0
                        ? `${importRows.length} ligne${importRows.length > 1 ? 's' : ''} détectée${
                            importRows.length > 1 ? 's' : ''
                          }`
                        : 'Sélectionne un CSV pour démarrer'}
                    </span>
                  </div>
                </div>

                <label className='tpi-import-field' htmlFor='yearInput'>
                  <span>Année d&apos;import</span>
                  <input
                    type='number'
                    id='yearInput'
                    min='1900'
                    max='2100'
                    step='1'
                    value={importYear}
                    onChange={(event) => setImportYear(event.target.value)}
                    required
                  />
                </label>
              </div>

              <p className='tpi-import-note'>
                Le fichier peut être remplacé à tout moment. L&apos;année sert à enregistrer les
                TPI au bon millésime.
              </p>
            </section>

            <section className='tpi-import-card tpi-import-mapping-card'>
              <div className='tpi-import-card-head'>
                <div>
                  <span className='tpi-management-tools-label'>Mappage</span>
                  <h4>Relier les colonnes</h4>
                </div>
                <button
                  type='button'
                  className='page-tools-action-btn secondary tpi-import-reset icon-button'
                  onClick={handleResetMapping}
                  disabled={!importHeaders.length}
                  aria-label='Détecter'
                  title='Détecter'
                >
                  <DetectColumnsIcon className='tpi-management-action-icon' aria-hidden='true' />
                  <span className='tpi-management-action-label'>Détecter</span>
                </button>
              </div>

              <p className='tpi-import-note'>
                Commence par les champs obligatoires, puis complète les champs utiles si tu veux
                enrichir les fiches.
              </p>

              {importHeaders.length > 0 ? (
                <div className='tpi-import-mapping'>
                  <div className='tpi-import-mapping-section'>
                    <h4>Champs obligatoires</h4>
                    <div className='tpi-import-mapping-grid'>
                      {requiredFields.map((field) => renderMappingSelect(field))}
                    </div>
                  </div>

                  {optionalFields.length > 0 ? (
                    <details className='tpi-import-mapping-optional'>
                      <summary>Champs utiles</summary>
                      <div className='tpi-import-mapping-grid'>
                        {optionalFields.map((field) => renderMappingSelect(field))}
                      </div>
                    </details>
                  ) : null}

                  {legacyFields.length > 0 ? (
                    <details className='tpi-import-mapping-legacy'>
                      <summary>Compatibilité historique</summary>
                      <div className='tpi-import-mapping-grid'>
                        {legacyFields.map((field) => renderMappingSelect(field))}
                      </div>
                    </details>
                  ) : null}
                </div>
              ) : (
                <p className='tpi-import-empty'>Sélectionne un CSV pour afficher les colonnes.</p>
              )}
            </section>

            {missingMappingKeys.length > 0 ? (
              <div className='tpi-import-warning'>
                Champs obligatoires manquants: {missingMappingLabels.join(', ')}.
              </div>
            ) : null}

            <div className='tpi-import-actions'>
              <button
                type='submit'
                className='page-tools-action-btn primary icon-button'
                disabled={!canSubmitImport}
                aria-label={isImporting || isParsingFile ? 'Analyse...' : "Lancer l'import"}
                title={isImporting || isParsingFile ? 'Analyse...' : "Lancer l'import"}
              >
                <SubmitImportIcon className='tpi-management-action-icon' aria-hidden='true' />
                <span className='tpi-management-action-label'>
                  {isImporting || isParsingFile ? 'Analyse...' : "Lancer l'import"}
                </span>
              </button>
              <button
                type='button'
                className='page-tools-action-btn secondary icon-button'
                onClick={handleCancelImport}
                aria-label='Fermer'
                title='Fermer'
              >
                <ClosePanelIcon className='tpi-management-action-icon' aria-hidden='true' />
                <span className='tpi-management-action-label'>Fermer</span>
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </PageToolbar>
  )
}

export default TpiManagementButtons
