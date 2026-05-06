import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { useLocation, useNavigate } from 'react-router-dom'

import BinaryToggle from '../shared/BinaryToggle'
import {
  AlertIcon,
  BanIcon as DisableIcon,
  CandidateIcon as CandidateRoleIcon,
  CheckIcon,
  ChevronDownIcon,
  ExpertIcon as ExpertRoleIcon,
  MailIcon,
  MailOffIcon as NoEmailIcon,
  PlusIcon,
  ProjectLeadIcon as ChefProjetRoleIcon,
  QuestionIcon,
  SearchIcon,
  UploadIcon,
  UserIcon,
  UsersIcon
} from '../shared/InlineIcons'
import { personService } from '../../services/coordinationService'
import { STORAGE_KEYS, YEARS_CONFIG } from '../../config/appConfig'
import { readJSONListValue, writeJSONValue } from '../../utils/storage'
import { getPreferredCoordinationYear, persistCoordinationYear } from '../../utils/coordinationYear'
import {
  PREFERRED_SOUTENANCE_CHOICE_FIELDS,
  buildPreferredSoutenanceChoices,
  buildPreferredSoutenanceDates,
  formatPreferredSoutenanceChoicesForPreview,
  getPreferredSoutenanceChoiceInputValues
} from '../../utils/preferredSoutenanceUtils'
import {
  PROJECT_LEAD_AVAILABILITY_DAYS,
  PROJECT_LEAD_AVAILABILITY_LABELS,
  PROJECT_LEAD_AVAILABILITY_SHORT_LABELS,
  createDefaultProjectLeadAvailability,
  defaultAvailabilityToProjectLeadAvailability,
  formatProjectLeadAvailabilityDayTitle,
  getNextProjectLeadAvailabilityValue,
  normalizeProjectLeadAvailabilityMap,
  projectLeadAvailabilityToDefaultAvailability
} from '../../utils/projectLeadAvailability'
import {
  ROLE_OPTIONS,
  TPI_RELATION_ROLES,
  buildStakeholderStats,
  createEmptyStakeholderForm,
  draftToStakeholderForm,
  filterStakeholders,
  findMatchingStakeholder,
  formatPersonName,
  getPersonEmail,
  getPersonIdentityKey,
  getStakeholderDraftRank,
  getStakeholderDraftStatus,
  getStakeholderRoleLabel,
  groupStakeholdersByIdentity,
  normalizeCandidateYears,
  normalizeRoleList,
  normalizeStakeholderRole,
  normalizeWhitespace,
  stakeholderFormToPayload,
  stakeholderToForm,
  validateStakeholderForm
} from '../../utils/stakeholderRules'
import { buildSyntheticStakeholderEmail } from './stakeholderDraftEmailUtils'
import {
  IMPORT_FIELD_LABELS,
  buildStakeholderImportPreview,
  normalizeImportOptions
} from './stakeholderImportUtils'

import '../../css/partiesPrenantes/partiesPrenantes.css'

const ROLE_ICONS = {
  candidat: CandidateRoleIcon,
  expert: ExpertRoleIcon,
  chef_projet: ChefProjetRoleIcon,
  admin: UserIcon
}

const IMPORTABLE_ROLES = ROLE_OPTIONS.filter((role) => role.value !== 'admin')
const DRAFT_FILTERS = [
  { value: 'actionable', label: 'À traiter' },
  { value: 'create', label: 'À créer' },
  { value: 'enrich', label: 'À enrichir' },
  { value: 'resolved', label: 'Couverts' },
  { value: 'all', label: 'Tous' }
]

const emptyPreferredChoiceInputs = Object.fromEntries(
  PREFERRED_SOUTENANCE_CHOICE_FIELDS.flatMap(({ dateField, slotField }) => ([
    [dateField, ''],
    [slotField, '']
  ]))
)

const formatShortId = (person = {}) => {
  const shortId = Number.parseInt(person?.shortId, 10)

  return Number.isInteger(shortId) && shortId > 0
    ? `#${String(shortId).padStart(3, '0')}`
    : ''
}

const sortPeopleByName = (people = []) =>
  [...people].sort((left, right) =>
    formatPersonName(left).localeCompare(formatPersonName(right), 'fr', {
      numeric: true,
      sensitivity: 'base'
    })
  )

const getPrimaryRole = (person = {}) => {
  const roles = normalizeRoleList(person?.roles)

  if (roles.includes('candidat')) return 'candidat'
  if (roles.includes('expert')) return 'expert'
  if (roles.includes('chef_projet')) return 'chef_projet'
  if (roles.includes('admin')) return 'admin'
  return 'expert'
}

const formatRoles = (roles = []) =>
  normalizeRoleList(roles)
    .map((role) => getStakeholderRoleLabel(role))
    .join(', ') || 'Aucun rôle'

const buildFormState = (person = null, year = null) => {
  if (!person) {
    return {
      ...createEmptyStakeholderForm(year),
      ...emptyPreferredChoiceInputs,
      projectLeadAvailability: createDefaultProjectLeadAvailability()
    }
  }

  return {
    ...stakeholderToForm(person, year),
    projectLeadAvailability: defaultAvailabilityToProjectLeadAvailability(person?.defaultAvailability),
    ...getPreferredSoutenanceChoiceInputValues(
      person?.preferredSoutenanceChoices || [],
      person?.preferredSoutenanceDates || []
    )
  }
}

const buildDraftFormState = (draft = {}, year = null) => {
  const baseForm = draftToStakeholderForm(draft, year)

  if (!baseForm.email) {
    baseForm.email = buildSyntheticStakeholderEmail({
      firstName: baseForm.firstName,
      lastName: baseForm.lastName,
      role: baseForm.roles[0],
      year: draft?.year || year,
      seed: draft?.id || draft?.name || ''
    })
    baseForm.sendEmails = false
  }

  return {
    ...baseForm,
    ...emptyPreferredChoiceInputs,
    projectLeadAvailability: createDefaultProjectLeadAvailability()
  }
}

const buildFormPayload = (form = {}) => {
  const payload = stakeholderFormToPayload(form)
  const roles = normalizeRoleList(form.roles)
  const preferredSoutenanceChoices = buildPreferredSoutenanceChoices(
    PREFERRED_SOUTENANCE_CHOICE_FIELDS.map(({ dateField, slotField }) => ({
      date: form[dateField],
      period: form[slotField]
    }))
  )

  return {
    ...payload,
    ...(roles.includes('chef_projet')
      ? {
          defaultAvailability: projectLeadAvailabilityToDefaultAvailability(form.projectLeadAvailability)
        }
      : {}),
    preferredSoutenanceChoices,
    preferredSoutenanceDates: buildPreferredSoutenanceDates([], preferredSoutenanceChoices)
  }
}

const normalizeSavedPerson = (result) => result?.person || result

const normalizeLocalReturnPath = (value = '') => {
  const normalizedValue = normalizeWhitespace(value)

  if (
    !normalizedValue ||
    !normalizedValue.startsWith('/') ||
    normalizedValue.startsWith('//') ||
    normalizedValue.includes('://')
  ) {
    return ''
  }

  return normalizedValue
}

const buildRouteTarget = (locationSearch = '') => {
  const params = new URLSearchParams(locationSearch)

  return {
    personId: params.get('personId') || '',
    name: params.get('name') || '',
    role: params.get('role') || '',
    year: params.get('year') || '',
    returnTo: normalizeLocalReturnPath(params.get('returnTo') || ''),
    tab: params.get('tab') || ''
  }
}

const shouldShowDraftForFilter = (statusType, filter) => {
  if (filter === 'all') return true
  if (filter === 'actionable') return statusType === 'create' || statusType === 'enrich'
  return statusType === filter
}

function StakeholderRoleChip({ role, selected, onToggle }) {
  const Icon = ROLE_ICONS[role.value] || UserIcon

  return (
    <button
      type='button'
      className={`stakeholders-role-chip role-${role.value}${selected ? ' is-active' : ''}`}
      onClick={() => onToggle(role.value)}
      title={role.label}
      aria-pressed={selected}
    >
      <Icon className='stakeholders-role-chip-icon' />
      <span>{role.label}</span>
      {selected ? <CheckIcon className='stakeholders-role-chip-check' /> : null}
    </button>
  )
}

function StakeholderEditor({
  form,
  selectedPerson,
  year,
  onChange,
  onSubmit,
  onNew,
  onDisable,
  onMergeDuplicates,
  duplicateCount,
  isSaving,
  isDisabling
}) {
  const roles = normalizeRoleList(form.roles)
  const isCandidate = roles.includes('candidat')
  const isProjectLead = roles.includes('chef_projet')
  const roleErrors = validateStakeholderForm(form)
  const availableYears = YEARS_CONFIG.getAvailableYears().slice().sort((left, right) => right - left)
  const projectLeadAvailability = normalizeProjectLeadAvailabilityMap(form.projectLeadAvailability)

  const updateField = (field, value) => {
    onChange({
      ...form,
      [field]: value
    })
  }

  const toggleRole = (role) => {
    const normalizedRole = normalizeStakeholderRole(role)

    if (!normalizedRole) {
      return
    }

    const nextRoles = roles.includes(normalizedRole)
      ? roles.filter((currentRole) => currentRole !== normalizedRole)
      : [...roles, normalizedRole]

    onChange({
      ...form,
      roles: nextRoles,
      candidateYears: nextRoles.includes('candidat')
        ? normalizeCandidateYears(form.candidateYears).length > 0
          ? normalizeCandidateYears(form.candidateYears)
          : [year]
        : []
    })
  }

  const toggleCandidateYear = (candidateYear) => {
    const currentYears = normalizeCandidateYears(form.candidateYears)
    const nextYears = currentYears.includes(candidateYear)
      ? currentYears.filter((yearValue) => yearValue !== candidateYear)
      : [...currentYears, candidateYear].sort((left, right) => left - right)

    updateField('candidateYears', nextYears)
  }

  const toggleProjectLeadAvailability = (dayKey) => {
    onChange({
      ...form,
      projectLeadAvailability: {
        ...projectLeadAvailability,
        [dayKey]: getNextProjectLeadAvailabilityValue(projectLeadAvailability[dayKey])
      }
    })
  }

  const preferredPreview = formatPreferredSoutenanceChoicesForPreview(
    PREFERRED_SOUTENANCE_CHOICE_FIELDS.map(({ dateField, slotField }) => ({
      date: form[dateField],
      period: form[slotField]
    }))
  )

  return (
    <form className='stakeholders-editor' onSubmit={onSubmit}>
      <div className='stakeholders-panel-head'>
        <div>
          <span className='stakeholders-eyebrow'>
            {selectedPerson ? 'Modification' : 'Création'}
          </span>
          <h2>{selectedPerson ? formatPersonName(selectedPerson) : 'Nouvelle partie prenante'}</h2>
        </div>
        <div className='stakeholders-editor-head-actions'>
          <StakeholderRulesMenu form={form} />
          <button type='button' className='secondary stakeholders-icon-button' onClick={onNew} title='Créer une fiche'>
            <PlusIcon className='stakeholders-button-icon' />
          </button>
        </div>
      </div>

      {selectedPerson ? (
        <div className='stakeholders-selected-meta'>
          <span>{formatShortId(selectedPerson) || selectedPerson._id}</span>
          <span>{formatRoles(selectedPerson.roles)}</span>
          <span>{selectedPerson.sendEmails === false ? 'Emails désactivés' : 'Emails actifs'}</span>
        </div>
      ) : null}

      <div className='stakeholders-form-grid'>
        <label>
          <span>Prénom</span>
          <input
            value={form.firstName}
            onChange={(event) => updateField('firstName', event.target.value)}
            required
          />
        </label>
        <label>
          <span>Nom</span>
          <input
            value={form.lastName}
            onChange={(event) => updateField('lastName', event.target.value)}
            required
          />
        </label>
        <label>
          <span>Email</span>
          <input
            type='email'
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            required
          />
        </label>
        <label>
          <span>Téléphone</span>
          <input value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
        </label>
        <label>
          <span>Site</span>
          <input value={form.site} onChange={(event) => updateField('site', event.target.value)} />
        </label>
        <label>
          <span>Entreprise</span>
          <input value={form.entreprise} onChange={(event) => updateField('entreprise', event.target.value)} />
        </label>
      </div>

      <section className='stakeholders-editor-section'>
        <div className='stakeholders-section-head'>
          <h3>Rôles et responsabilités</h3>
          <span>{roles.length} rôle(s)</span>
        </div>
        <div className='stakeholders-role-chips'>
          {ROLE_OPTIONS.map((role) => (
            <StakeholderRoleChip
              key={role.value}
              role={role}
              selected={roles.includes(role.value)}
              onToggle={toggleRole}
            />
          ))}
        </div>
      </section>

      {isProjectLead ? (
        <section className='stakeholders-editor-section stakeholders-project-lead-availability'>
          <div className='stakeholders-section-head'>
            <h3>Disponibilité Lu-Ve</h3>
            <span>{getStakeholderRoleLabel('chef_projet')}</span>
          </div>
          <div className='stakeholders-availability-grid'>
            {PROJECT_LEAD_AVAILABILITY_DAYS.map((day) => {
              const availabilityValue = projectLeadAvailability[day.key]
              const title = [
                formatProjectLeadAvailabilityDayTitle(day, availabilityValue),
                'Cliquer pour changer: journée, matin, après-midi, disponible.'
              ].join('\n')

              return (
                <button
                  key={day.key}
                  type='button'
                  className={`stakeholders-availability-button is-${availabilityValue}`}
                  onClick={() => toggleProjectLeadAvailability(day.key)}
                  aria-label={`${day.longLabel} - ${PROJECT_LEAD_AVAILABILITY_LABELS[availabilityValue]}`}
                  title={title}
                >
                  <strong>{day.label}</strong>
                  <span>{PROJECT_LEAD_AVAILABILITY_SHORT_LABELS[availabilityValue]}</span>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      {isCandidate ? (
        <section className='stakeholders-editor-section'>
          <div className='stakeholders-section-head'>
            <h3>Années de candidature</h3>
            <span>{normalizeCandidateYears(form.candidateYears).join(', ') || 'Aucune'}</span>
          </div>
          <div className='stakeholders-year-chips'>
            {availableYears.map((candidateYear) => {
              const selected = normalizeCandidateYears(form.candidateYears).includes(candidateYear)
              return (
                <button
                  key={candidateYear}
                  type='button'
                  className={`stakeholders-year-chip${selected ? ' is-active' : ''}`}
                  onClick={() => toggleCandidateYear(candidateYear)}
                >
                  {candidateYear}
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className='stakeholders-editor-section'>
        <div className='stakeholders-section-head'>
          <h3>Préférences défense</h3>
          <span>{preferredPreview}</span>
        </div>
        <div className='stakeholders-preferences-grid'>
          {PREFERRED_SOUTENANCE_CHOICE_FIELDS.map(({ dateField, slotField, label }) => (
            <div key={dateField} className='stakeholders-preference-row'>
              <label>
                <span>{label}</span>
                <input
                  type='date'
                  value={form[dateField] || ''}
                  onChange={(event) => updateField(dateField, event.target.value)}
                />
              </label>
              <label>
                <span>Créneau</span>
                <input
                  type='number'
                  min='1'
                  value={form[slotField] || ''}
                  onChange={(event) => updateField(slotField, event.target.value)}
                  placeholder='Optionnel'
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className='stakeholders-editor-section stakeholders-toggle-section'>
        <label className='stakeholders-toggle-field'>
          <span>Emails</span>
          <BinaryToggle
            value={form.sendEmails !== false}
            onChange={(value) => updateField('sendEmails', value)}
            name='stakeholder-send-emails'
            trueLabel='Actifs'
            falseLabel='Coupés'
            trueIcon={MailIcon}
            falseIcon={NoEmailIcon}
            compact
          />
        </label>
        <label className='stakeholders-toggle-field'>
          <span>Statut</span>
          <BinaryToggle
            value={form.isActive !== false}
            onChange={(value) => updateField('isActive', value)}
            name='stakeholder-is-active'
            trueLabel='Active'
            falseLabel='Inactive'
            trueIcon={CheckIcon}
            falseIcon={DisableIcon}
            compact
          />
        </label>
      </section>

      {roleErrors.length > 0 ? (
        <div className='stakeholder-alert error'>
          {roleErrors.map((error) => <span key={error}>{error}</span>)}
        </div>
      ) : null}

      <div className='stakeholders-actions'>
        {selectedPerson && duplicateCount > 1 ? (
          <button type='button' className='secondary' onClick={onMergeDuplicates}>
            Fusionner {duplicateCount - 1} doublon(s)
          </button>
        ) : null}
        {selectedPerson ? (
          <button
            type='button'
            className='danger'
            onClick={onDisable}
            disabled={isDisabling}
          >
            {isDisabling ? 'Désactivation...' : 'Désactiver'}
          </button>
        ) : null}
        <button type='submit' disabled={isSaving || roleErrors.length > 0}>
          {isSaving ? 'Enregistrement...' : selectedPerson ? 'Enregistrer' : 'Créer'}
        </button>
      </div>
    </form>
  )
}

function StakeholderRulesMenu({ form }) {
  const selectedRoles = normalizeRoleList(form.roles)
  const selectedRoleOptions = ROLE_OPTIONS.filter((role) => selectedRoles.includes(role.value))

  return (
    <details className='stakeholders-rules-menu'>
      <summary title='Règles métier'>
        <QuestionIcon className='stakeholders-button-icon' />
        <span>Règles métier</span>
        <ChevronDownIcon className='stakeholders-rules-menu-chevron' />
      </summary>

      <div className='stakeholders-rules-menu-popover'>
        <section className='stakeholders-rules-menu-section'>
          <h3>Relations TPI</h3>
          <div className='stakeholders-relation-list'>
            {TPI_RELATION_ROLES.map((relation) => (
              <article key={relation.key} className='stakeholders-relation-row'>
                <strong>{relation.label}</strong>
                <span>{getStakeholderRoleLabel(relation.role)}</span>
                <small>{relation.responsibility}</small>
              </article>
            ))}
          </div>
        </section>

        {selectedRoleOptions.length > 0 ? (
          <section className='stakeholders-rules-menu-section'>
            <h3>Responsabilités de cette fiche</h3>
            <div className='stakeholders-responsibility-list'>
              {selectedRoleOptions.map((role) => (
                <article key={role.value} className='stakeholders-responsibility-row'>
                  <strong>{role.label}</strong>
                  {role.responsibilities.map((responsibility) => (
                    <span key={responsibility}>{responsibility}</span>
                  ))}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </details>
  )
}

function StakeholderList({
  people,
  selectedPersonId,
  onSelect,
  isLoading,
  duplicateGroups
}) {
  if (isLoading) {
    return <div className='stakeholders-empty'>Chargement...</div>
  }

  if (people.length === 0) {
    return <div className='stakeholders-empty'>Aucune partie prenante trouvée.</div>
  }

  const duplicateIds = new Set(duplicateGroups.flatMap((group) => group.map((person) => String(person._id))))

  return (
    <div className='stakeholders-list'>
      {people.map((person) => {
        const primaryRole = getPrimaryRole(person)
        const Icon = ROLE_ICONS[primaryRole] || UserIcon
        const isSelected = String(person._id) === String(selectedPersonId)
        const email = getPersonEmail(person)
        const hasEmail = Boolean(email)
        const shortId = formatShortId(person)
        const site = normalizeWhitespace(person.site) || 'Site non défini'

        return (
          <button
            type='button'
            key={person._id}
            data-stakeholder-id={person._id}
            className={`stakeholder-row role-${primaryRole}${isSelected ? ' active' : ''}${person.isActive === false ? ' is-inactive' : ''}`}
            onClick={() => onSelect(person)}
          >
            <span className='stakeholder-row-icon-shell'>
              <Icon className='stakeholder-row-icon' />
            </span>
            <span className='stakeholder-row-main'>
              <span className='stakeholder-row-heading'>
                <strong>{formatPersonName(person) || person.email || 'Sans nom'}</strong>
                {duplicateIds.has(String(person._id)) ? <span className='stakeholder-duplicate-chip'>Doublon</span> : null}
              </span>
              <span className={`stakeholder-row-email${hasEmail ? '' : ' is-missing'}`}>
                {hasEmail ? email : 'Email manquant'}
              </span>
              <span className='stakeholder-row-meta' aria-label={formatRoles(person.roles)}>
                <span>{site}</span>
                {shortId ? <span>{shortId}</span> : null}
              </span>
            </span>
            <span className={`stakeholder-email-state${hasEmail ? '' : ' is-missing'}`}>
              {hasEmail ? <MailIcon /> : <NoEmailIcon />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function StakeholderDraftsPanel({
  drafts,
  people,
  filter,
  onFilterChange,
  onOpenDraft,
  onRemoveDraft,
  onClearResolved
}) {
  const draftRows = useMemo(() => drafts
    .map((draft) => ({
      draft,
      status: getStakeholderDraftStatus(draft, people)
    }))
    .sort((left, right) => {
      const rankDelta = getStakeholderDraftRank(left.status.type) - getStakeholderDraftRank(right.status.type)
      if (rankDelta !== 0) return rankDelta

      return normalizeWhitespace(left.draft.name).localeCompare(normalizeWhitespace(right.draft.name), 'fr', {
        numeric: true,
        sensitivity: 'base'
      })
    }), [drafts, people])
  const visibleDraftRows = draftRows.filter((row) => shouldShowDraftForFilter(row.status.type, filter))
  const resolvedCount = draftRows.filter((row) => row.status.type === 'resolved').length

  return (
    <div className='stakeholders-tab-panel'>
      <div className='stakeholders-panel-head'>
        <div>
          <span className='stakeholders-eyebrow'>Complétion</span>
          <h2>Brouillons Gestion TPI</h2>
        </div>
        <button
          type='button'
          className='secondary'
          onClick={onClearResolved}
          disabled={resolvedCount === 0}
        >
          Nettoyer couverts
        </button>
      </div>

      <div className='stakeholders-filter-pills'>
        {DRAFT_FILTERS.map((option) => (
          <button
            key={option.value}
            type='button'
            className={filter === option.value ? 'is-active' : ''}
            onClick={() => onFilterChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {visibleDraftRows.length === 0 ? (
        <div className='stakeholders-empty'>Aucun brouillon dans ce filtre.</div>
      ) : (
        <div className='stakeholders-draft-list'>
          {visibleDraftRows.map(({ draft, status }) => (
            <article key={draft.id || `${draft.role}-${draft.name}-${draft.year}`} className={`stakeholders-draft-card is-${status.type}`}>
              <div className='stakeholders-draft-card-head'>
                <div>
                  <span>{getStakeholderRoleLabel(draft.role)}</span>
                  <strong>{draft.name}</strong>
                </div>
                <strong>{status.label}</strong>
              </div>
              <div className='stakeholders-draft-meta'>
                {draft.year ? <span>{draft.year}</span> : null}
                {draft.site ? <span>{draft.site}</span> : null}
                {draft.refs?.length ? <span>{draft.refs.join(', ')}</span> : null}
              </div>
              <div className='stakeholders-draft-needs'>
                {(status.needs.length > 0 ? status.needs : ['Aucune action']).map((need) => (
                  <span key={need}>{need}</span>
                ))}
              </div>
              <div className='stakeholders-draft-actions'>
                <button type='button' onClick={() => onOpenDraft(draft, status)}>
                  {status.person ? 'Ouvrir fiche' : 'Créer fiche'}
                </button>
                <button type='button' className='secondary' onClick={() => onRemoveDraft(draft)}>
                  Ignorer
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function StakeholderImportPanel({
  importText,
  importRoles,
  importDefaultSite,
  importReport,
  isImporting,
  onImportTextChange,
  onImportRoleToggle,
  onDefaultSiteChange,
  onImport,
  onFileSelected
}) {
  const preview = useMemo(() => buildStakeholderImportPreview(importText), [importText])

  return (
    <div className='stakeholders-tab-panel'>
      <div className='stakeholders-panel-head'>
        <div>
          <span className='stakeholders-eyebrow'>Import</span>
          <h2>CSV / TSV</h2>
        </div>
        <label className='secondary stakeholders-file-button'>
          <UploadIcon className='stakeholders-button-icon' />
          Fichier
          <input type='file' accept='.csv,.tsv,.txt' onChange={onFileSelected} />
        </label>
      </div>

      <div className='stakeholders-import-controls'>
        <label>
          <span>Site par défaut</span>
          <input value={importDefaultSite} onChange={(event) => onDefaultSiteChange(event.target.value)} />
        </label>
        <div className='stakeholders-import-roles'>
          {IMPORTABLE_ROLES.map((role) => {
            const selected = importRoles.includes(role.value)
            const Icon = ROLE_ICONS[role.value] || UserIcon

            return (
              <button
                key={role.value}
                type='button'
                className={selected ? 'is-active' : ''}
                onClick={() => onImportRoleToggle(role.value)}
              >
                <Icon className='stakeholders-button-icon' />
                {role.label}
              </button>
            )
          })}
        </div>
      </div>

      <textarea
        className='stakeholders-import-text'
        value={importText}
        onChange={(event) => onImportTextChange(event.target.value)}
        placeholder='Nom;email;tel;site'
        rows={8}
      />

      <div className={`stakeholders-import-preview${preview.canImport ? '' : ' is-warning'}`}>
        <div className='stakeholders-import-preview-head'>
          <strong>{preview.dataRowCount} ligne(s)</strong>
          <span>{preview.delimiterLabel}</span>
        </div>

        {preview.missingRequiredFields.length > 0 ? (
          <p>
            Colonnes requises manquantes: {preview.missingRequiredFields.map((field) => IMPORT_FIELD_LABELS[field]).join(', ')}
          </p>
        ) : null}

        {preview.sampleRows.length > 0 ? (
          <table className='stakeholders-import-table'>
            <thead>
              <tr>
                <th>Ligne</th>
                <th>Nom</th>
                <th>Email</th>
                <th>Site</th>
              </tr>
            </thead>
            <tbody>
              {preview.sampleRows.map((row) => (
                <tr key={row.lineNumber}>
                  <td>{row.lineNumber}</td>
                  <td>{row.name}</td>
                  <td>{row.email}</td>
                  <td>{row.site}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className='stakeholders-actions'>
        <button type='button' onClick={onImport} disabled={!preview.canImport || isImporting}>
          {isImporting ? 'Import...' : 'Importer'}
        </button>
      </div>

      {importReport ? (
        <div className='stakeholders-import-report'>
          <strong>Résultat</strong>
          <span>Créées: {importReport.created || 0}</span>
          <span>Mises à jour: {importReport.updated || 0}</span>
          <span>Doublons: {importReport.duplicates || 0}</span>
          <span>Ignorées: {importReport.skipped || 0}</span>
        </div>
      ) : null}
    </div>
  )
}

function StakeholderOperationsPanel({
  activeTab,
  onTabChange,
  draftProps,
  importProps
}) {
  return (
    <section className='stakeholders-operations-panel'>
      <div className='stakeholders-panel-head stakeholders-operations-head'>
        <div className='stakeholders-tabs' role='tablist' aria-label='Actions parties prenantes'>
          <button
            type='button'
            role='tab'
            aria-selected={activeTab === 'drafts'}
            className={activeTab === 'drafts' ? 'is-active' : ''}
            onClick={() => onTabChange('drafts')}
          >
            Complétion
          </button>
          <button
            type='button'
            role='tab'
            aria-selected={activeTab === 'import'}
            className={activeTab === 'import' ? 'is-active' : ''}
            onClick={() => onTabChange('import')}
          >
            Import
          </button>
        </div>
      </div>

      {activeTab === 'drafts' ? (
        <StakeholderDraftsPanel {...draftProps} />
      ) : (
        <StakeholderImportPanel {...importProps} />
      )}
    </section>
  )
}

const PartiesPrenantes = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const fileInputReaderRef = useRef(0)
  const [people, setPeople] = useState([])
  const [pendingDrafts, setPendingDrafts] = useState(() =>
    readJSONListValue(STORAGE_KEYS.PENDING_STAKEHOLDER_IMPORT, [])
  )
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [form, setForm] = useState(() => buildFormState(null, getPreferredCoordinationYear(location.search)))
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [emailFilter, setEmailFilter] = useState('')
  const [draftFilter, setDraftFilter] = useState('actionable')
  const [operationsTab, setOperationsTab] = useState('drafts')
  const [importText, setImportText] = useState('')
  const [importRoles, setImportRoles] = useState(['expert'])
  const [importDefaultSite, setImportDefaultSite] = useState('')
  const [importReport, setImportReport] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDisabling, setIsDisabling] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState(null)
  const [hasLoadedPeople, setHasLoadedPeople] = useState(false)

  const year = useMemo(() => getPreferredCoordinationYear(location.search), [location.search])
  const routeTarget = useMemo(() => buildRouteTarget(location.search), [location.search])
  const selectedPerson = useMemo(
    () => people.find((person) => String(person._id) === String(selectedPersonId)) || null,
    [people, selectedPersonId]
  )
  const duplicateGroups = useMemo(() => groupStakeholdersByIdentity(people), [people])
  const selectedDuplicateGroup = useMemo(() => {
    if (!selectedPerson) return []
    const identityKey = getPersonIdentityKey(selectedPerson)
    return duplicateGroups.find((group) => group.some((person) => getPersonIdentityKey(person) === identityKey)) || []
  }, [duplicateGroups, selectedPerson])
  const stats = useMemo(() => buildStakeholderStats(people, pendingDrafts), [people, pendingDrafts])
  const siteOptions = useMemo(() => Array.from(
    new Set(people.map((person) => normalizeWhitespace(person.site)).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right, 'fr')), [people])
  const visiblePeople = useMemo(() => sortPeopleByName(filterStakeholders(people, {
    search,
    role: roleFilter,
    site: siteFilter,
    emailFilter
  })), [emailFilter, people, roleFilter, search, siteFilter])

  const persistPendingDrafts = useCallback((nextDrafts) => {
    setPendingDrafts(nextDrafts)
    writeJSONValue(STORAGE_KEYS.PENDING_STAKEHOLDER_IMPORT, nextDrafts)
  }, [])

  const loadPeople = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await personService.getAll()
      setPeople(Array.isArray(data) ? data : [])
      setHasLoadedPeople(true)
    } catch (err) {
      setError(err?.data?.error || err?.message || 'Impossible de charger les parties prenantes.')
      setPeople([])
      setHasLoadedPeople(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    persistCoordinationYear(year)
  }, [year])

  useEffect(() => {
    void loadPeople()
  }, [loadPeople])

  useEffect(() => {
    persistPendingDrafts(readJSONListValue(STORAGE_KEYS.PENDING_STAKEHOLDER_IMPORT, []))
  }, [persistPendingDrafts])

  useEffect(() => {
    if (!hasLoadedPeople || (!routeTarget.personId && !routeTarget.name)) {
      return
    }

    const matchedById = routeTarget.personId
      ? people.find((person) => String(person._id) === String(routeTarget.personId))
      : null
    const matchedByIdentity = matchedById || findMatchingStakeholder(people, {
      name: routeTarget.name,
      role: routeTarget.role,
      year: routeTarget.year || year
    })

    if (matchedByIdentity) {
      setSelectedPersonId(String(matchedByIdentity._id))
      setForm(buildFormState(matchedByIdentity, year))
      return
    }

    if (routeTarget.name) {
      const draftForm = buildDraftFormState({
        name: routeTarget.name,
        role: routeTarget.role,
        year: routeTarget.year || year
      }, year)
      setSelectedPersonId('')
      setForm(draftForm)
    }
  }, [hasLoadedPeople, people, routeTarget, year])

  const handleSelectPerson = useCallback((person) => {
    setSelectedPersonId(String(person._id))
    setForm(buildFormState(person, year))
  }, [year])

  const handleNewPerson = useCallback(() => {
    setSelectedPersonId('')
    setForm(buildFormState(null, year))
  }, [year])

  const removeDraft = useCallback((targetDraft) => {
    persistPendingDrafts(
      pendingDrafts.filter((draft) => (draft.id || `${draft.role}-${draft.name}-${draft.year}`) !== (targetDraft.id || `${targetDraft.role}-${targetDraft.name}-${targetDraft.year}`))
    )
  }, [pendingDrafts, persistPendingDrafts])

  const removeDraftsCoveredByPerson = useCallback((person) => {
    if (!person) return

    persistPendingDrafts(
      pendingDrafts.filter((draft) => {
        const status = getStakeholderDraftStatus(draft, [person])
        return status.type !== 'resolved'
      })
    )
  }, [pendingDrafts, persistPendingDrafts])

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault()
    const errors = validateStakeholderForm(form)

    if (errors.length > 0) {
      toast.error(errors[0])
      return
    }

    setIsSaving(true)

    try {
      const payload = buildFormPayload(form)
      const result = selectedPerson
        ? await personService.update(String(selectedPerson._id), payload)
        : await personService.create(payload)
      const savedPerson = normalizeSavedPerson(result)

      toast.success(selectedPerson ? 'Partie prenante mise à jour.' : 'Partie prenante créée.')
      await loadPeople()
      if (savedPerson?._id) {
        setSelectedPersonId(String(savedPerson._id))
        setForm(buildFormState(savedPerson, year))
        removeDraftsCoveredByPerson(savedPerson)
      }

      if (routeTarget.returnTo) {
        navigate(routeTarget.returnTo)
      }
    } catch (err) {
      toast.error(err?.data?.error || err?.message || 'Enregistrement impossible.')
    } finally {
      setIsSaving(false)
    }
  }, [form, loadPeople, navigate, removeDraftsCoveredByPerson, routeTarget.returnTo, selectedPerson, year])

  const handleDisablePerson = useCallback(async () => {
    if (!selectedPerson) {
      return
    }

    setIsDisabling(true)

    try {
      await personService.remove(String(selectedPerson._id))
      toast.success('Partie prenante désactivée.')
      setSelectedPersonId('')
      setForm(buildFormState(null, year))
      await loadPeople()
    } catch (err) {
      toast.error(err?.data?.error || err?.message || 'Désactivation impossible.')
    } finally {
      setIsDisabling(false)
    }
  }, [loadPeople, selectedPerson, year])

  const handleMergeDuplicates = useCallback(async () => {
    if (!selectedPerson || selectedDuplicateGroup.length <= 1) {
      return
    }

    const sourceIds = selectedDuplicateGroup
      .filter((person) => String(person._id) !== String(selectedPerson._id))
      .map((person) => String(person._id))

    const confirmed = window.confirm(`Fusionner ${sourceIds.length} doublon(s) dans ${formatPersonName(selectedPerson)} ?`)
    if (!confirmed) {
      return
    }

    try {
      const result = await personService.merge(String(selectedPerson._id), sourceIds)
      const mergedPerson = normalizeSavedPerson(result?.targetPerson || result)
      toast.success('Doublons fusionnés.')
      await loadPeople()
      if (mergedPerson?._id) {
        setSelectedPersonId(String(mergedPerson._id))
      }
    } catch (err) {
      toast.error(err?.data?.error || err?.message || 'Fusion impossible.')
    }
  }, [loadPeople, selectedDuplicateGroup, selectedPerson])

  const handleOpenDraft = useCallback((draft, status) => {
    if (status.person) {
      handleSelectPerson(status.person)
      return
    }

    setSelectedPersonId('')
    setForm(buildDraftFormState(draft, year))
  }, [handleSelectPerson, year])

  const handleClearResolvedDrafts = useCallback(() => {
    persistPendingDrafts(
      pendingDrafts.filter((draft) => getStakeholderDraftStatus(draft, people).type !== 'resolved')
    )
  }, [pendingDrafts, people, persistPendingDrafts])

  const handleSearchSubmit = useCallback((event) => {
    event.preventDefault()
    setSearch(normalizeWhitespace(searchInput))
  }, [searchInput])

  const handleImportRoleToggle = useCallback((role) => {
    const normalizedRole = normalizeStakeholderRole(role)
    if (!normalizedRole || normalizedRole === 'admin') {
      return
    }

    setImportRoles((currentRoles) => {
      const nextRoles = currentRoles.includes(normalizedRole)
        ? currentRoles.filter((currentRole) => currentRole !== normalizedRole)
        : [...currentRoles, normalizedRole]

      return nextRoles.length > 0 ? nextRoles : ['expert']
    })
  }, [])

  const handleImport = useCallback(async () => {
    const preview = buildStakeholderImportPreview(importText)
    if (!preview.canImport) {
      toast.error('Import incomplet: colonnes Nom et Email requises.')
      return
    }

    setIsImporting(true)

    try {
      const options = normalizeImportOptions({
        defaultSite: importDefaultSite,
        defaultRoles: importRoles
      })
      const result = await personService.importFromContent(importText, options)

      setImportReport(result)
      toast.success('Import terminé.')
      await loadPeople()
    } catch (err) {
      toast.error(err?.data?.error || err?.message || 'Import impossible.')
    } finally {
      setIsImporting(false)
    }
  }, [importDefaultSite, importRoles, importText, loadPeople])

  const handleFileSelected = useCallback((event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const readerId = fileInputReaderRef.current + 1
    fileInputReaderRef.current = readerId
    const reader = new FileReader()
    reader.onload = () => {
      if (fileInputReaderRef.current === readerId) {
        setImportText(String(reader.result || ''))
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }, [])

  const statCards = [
    { label: 'Actives', value: stats.total, detail: 'référentiel', Icon: UsersIcon, tone: 'neutral' },
    { label: 'Candidats', value: stats.roleCounts.candidat, detail: `année ${year}`, Icon: CandidateRoleIcon, tone: 'candidate' },
    { label: 'Experts', value: stats.roleCounts.expert, detail: 'votes et défense', Icon: ExpertRoleIcon, tone: 'expert' },
    { label: 'À traiter', value: stats.draftStatusCounts.create + stats.draftStatusCounts.enrich, detail: 'brouillons TPI', Icon: AlertIcon, tone: 'warning' }
  ]

  return (
    <div className='stakeholders-page'>
      <header className='stakeholders-page-header'>
        <div className='stakeholders-hero-content'>
          <span className='stakeholders-eyebrow'>Référentiel</span>
          <h1>Parties prenantes</h1>

          <form className='stakeholders-hero-search' onSubmit={handleSearchSubmit}>
            <label className='stakeholders-search-field'>
              <SearchIcon className='stakeholders-search-icon' />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder='Rechercher une partie prenante'
                aria-label='Rechercher une partie prenante'
              />
            </label>
            <button type='submit' className='stakeholders-icon-button' title='Rechercher' aria-label='Rechercher'>
              <SearchIcon className='stakeholders-button-icon' />
            </button>
          </form>

          <div className='stakeholders-hero-filters' aria-label='Filtres des parties prenantes'>
            <label>
              <span>Rôle</span>
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value=''>Tous</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Site</span>
              <select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}>
                <option value=''>Tous</option>
                {siteOptions.map((site) => (
                  <option key={site} value={site}>{site}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Email</span>
              <select value={emailFilter} onChange={(event) => setEmailFilter(event.target.value)}>
                <option value=''>Tous</option>
                <option value='with'>Avec email</option>
                <option value='without'>Sans email</option>
              </select>
            </label>
          </div>
        </div>
        <div className='stakeholders-page-stats'>
          {statCards.map((stat) => {
            const Icon = stat.Icon
            return (
              <article key={stat.label} className={`stakeholders-page-stat is-${stat.tone}`}>
                <Icon className='stakeholders-page-stat-icon' />
                <span>
                  <strong>{stat.value}</strong>
                  <small>{stat.label}</small>
                  <small>{stat.detail}</small>
                </span>
              </article>
            )
          })}
        </div>
      </header>

      {error ? (
        <div className='stakeholder-alert error'>{error}</div>
      ) : null}

      <main className='stakeholders-main-grid'>
        <section className='stakeholders-list-panel'>
          <div className='stakeholders-panel-head'>
            <div className='stakeholders-list-title'>
              <h2>Référentiel</h2>
              <span>{visiblePeople.length} fiche{visiblePeople.length > 1 ? 's' : ''}</span>
            </div>
            <button type='button' className='secondary stakeholders-icon-button' onClick={handleNewPerson} title='Nouvelle fiche'>
              <PlusIcon className='stakeholders-button-icon' />
            </button>
          </div>
          <StakeholderList
            people={visiblePeople}
            selectedPersonId={selectedPersonId}
            onSelect={handleSelectPerson}
            isLoading={isLoading}
            duplicateGroups={duplicateGroups}
          />
        </section>

        <section className='stakeholders-workspace'>
          <StakeholderEditor
            form={form}
            selectedPerson={selectedPerson}
            year={year}
            onChange={setForm}
            onSubmit={handleSubmit}
            onNew={handleNewPerson}
            onDisable={handleDisablePerson}
            onMergeDuplicates={handleMergeDuplicates}
            duplicateCount={selectedDuplicateGroup.length}
            isSaving={isSaving}
            isDisabling={isDisabling}
          />
        </section>
      </main>

      <StakeholderOperationsPanel
        activeTab={operationsTab}
        onTabChange={setOperationsTab}
        draftProps={{
          drafts: pendingDrafts,
          people,
          filter: draftFilter,
          onFilterChange: setDraftFilter,
          onOpenDraft: handleOpenDraft,
          onRemoveDraft: removeDraft,
          onClearResolved: handleClearResolvedDrafts
        }}
        importProps={{
          importText,
          importRoles,
          importDefaultSite,
          importReport,
          isImporting,
          onImportTextChange: setImportText,
          onImportRoleToggle: handleImportRoleToggle,
          onDefaultSiteChange: setImportDefaultSite,
          onImport: handleImport,
          onFileSelected: handleFileSelected
        }}
      />
    </div>
  )
}

export default PartiesPrenantes
