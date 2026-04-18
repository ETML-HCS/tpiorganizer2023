import React, { useEffect, useMemo, useState } from 'react'

import { personService } from '../../services/planningService'
import {
  normalizeTpiForForm,
  normalizeTpiForSave
} from './tpiManagementUtils.js'

const emptyFormState = normalizeTpiForForm(null)

const PERSON_FIELD_CONFIG = [
  {
    name: 'candidat',
    idName: 'candidatPersonId',
    label: 'Candidat',
    role: 'candidat',
    required: true
  },
  {
    name: 'expert1',
    idName: 'expert1PersonId',
    label: 'Expert 1',
    role: 'expert',
    required: true
  },
  {
    name: 'expert2',
    idName: 'expert2PersonId',
    label: 'Expert 2',
    role: 'expert',
    required: true
  },
  {
    name: 'boss',
    idName: 'bossPersonId',
    label: 'Encadrant',
    role: 'chef_projet',
    required: true
  }
]

const normalizeLookupValue = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const formatPersonLabel = (person) =>
  [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim()

const formatPersonDisplay = (person) => {
  const name = formatPersonLabel(person)
  const email = String(person?.email || '').trim()

  if (!name) {
    return email
  }

  return email ? `${name} (${email})` : name
}

const resolveUniquePerson = (people = [], value = '') => {
  const normalizedValue = normalizeLookupValue(value)

  if (!normalizedValue) {
    return null
  }

  const matches = (Array.isArray(people) ? people : []).filter((person) => {
    const nameMatch = normalizeLookupValue(formatPersonLabel(person)) === normalizedValue
    const emailMatch = normalizeLookupValue(person?.email) === normalizedValue

    return nameMatch || emailMatch
  })

  return matches.length === 1 ? matches[0] : null
}

const TpiForm = ({ onSave, tpiToLoad, initialTpi = null, onClose, year }) => {
  const [formData, setFormData] = useState(emptyFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [people, setPeople] = useState([])
  const [isLoadingPeople, setIsLoadingPeople] = useState(false)
  const [peopleError, setPeopleError] = useState(null)

  useEffect(() => {
    let isCancelled = false

    const loadPeople = async () => {
      setIsLoadingPeople(true)
      setPeopleError(null)

      try {
        const data = await personService.getAll()
        if (!isCancelled) {
          setPeople(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        if (!isCancelled) {
          setPeople([])
          setPeopleError(
            error?.data?.error ||
            error?.message ||
            'Impossible de charger le référentiel Parties prenantes.'
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingPeople(false)
        }
      }
    }

    loadPeople().catch(console.error)

    return () => {
      isCancelled = true
    }
  }, [])

  const peopleByRole = useMemo(() => {
    const groups = {
      candidat: [],
      expert: [],
      chef_projet: []
    }

    const currentYear = year ? Number(year) : null

    for (const person of people) {
      const roles = Array.isArray(person?.roles) ? person.roles : []

      for (const role of roles) {
        if (!groups[role]) {
          continue
        }

        // Filtrer les candidats par année
        // - Si candidateYears est vide → montrer (rétrocompatibilité)
        // - Si candidateYears contient l'année → montrer
        // - Sinon → cacher
        if (role === 'candidat' && currentYear) {
          const candidateYears = Array.isArray(person.candidateYears) ? person.candidateYears : []
          if (candidateYears.length > 0 && !candidateYears.includes(currentYear)) {
            continue // Candidat pas lié à cette année
          }
        }

        groups[role].push(person)
      }
    }

    return groups
  }, [people, year])

  const getPeopleForRole = (role) => peopleByRole[role] || []

  useEffect(() => {
    setFormData(normalizeTpiForForm(tpiToLoad || initialTpi))
  }, [initialTpi, tpiToLoad])

  useEffect(() => {
    if (people.length === 0) {
      return
    }

    setFormData((previousValue) => {
      let nextValue = previousValue
      let hasChanges = false

      for (const field of PERSON_FIELD_CONFIG) {
        const currentPersonId = previousValue[field.idName]
        if (currentPersonId) {
          continue
        }

        const resolvedPerson = resolveUniquePerson(peopleByRole[field.role] || [], previousValue[field.name])

        if (!resolvedPerson) {
          continue
        }

        nextValue = {
          ...nextValue,
          [field.idName]: String(resolvedPerson._id)
        }
        hasChanges = true
      }

      return hasChanges ? nextValue : previousValue
    })
  }, [people, peopleByRole])

  const resetForm = () => {
    setFormData(normalizeTpiForForm(initialTpi))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const savedTpi = await onSave(normalizeTpiForSave(formData))

      if (savedTpi) {
        resetForm()
        onClose?.()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    resetForm()
    onClose?.()
  }

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setFormData((prevData) => ({
      ...prevData,
      [name]: value
    }))
  }

  const handlePersonInputChange = (field, idName, role) => (event) => {
    const { value } = event.target
    const resolvedPerson = resolveUniquePerson(getPeopleForRole(role), value)

    setFormData((prevData) => ({
      ...prevData,
      [field]: value,
      [idName]: resolvedPerson ? String(resolvedPerson._id) : ''
    }))
  }

  const handlePersonSelectChange = (field) => (event) => {
    const selectedId = event.target.value || ''
    const selectedPerson = selectedId
      ? getPeopleForRole(field.role).find((person) => String(person._id) === String(selectedId))
      : null

    setFormData((prevData) => ({
      ...prevData,
      [field.name]: selectedPerson ? formatPersonLabel(selectedPerson) : prevData[field.name],
      [field.idName]: selectedId
    }))
  }

  const prefillStakeholderFromRegistry = (field) => {
    const currentValue = String(formData[field.name] || '').trim()
    const resolvedPerson = resolveUniquePerson(getPeopleForRole(field.role), currentValue)

    if (!resolvedPerson) {
      return
    }

    setFormData((prevData) => ({
      ...prevData,
      [field.name]: formatPersonLabel(resolvedPerson),
      [field.idName]: String(resolvedPerson._id)
    }))
  }

  const getPersonFieldStatus = (field) => {
    const currentName = String(formData[field.name] || '').trim()
    const currentPersonId = String(formData[field.idName] || '').trim()

    if (currentPersonId) {
      return {
        tone: 'linked',
        message: 'Référentiel Parties prenantes lié'
      }
    }

    if (currentName) {
      return {
        tone: 'pending',
        message: 'Nom présent, liaison au référentiel à compléter'
      }
    }

    return {
      tone: field.required ? 'missing' : 'neutral',
      message: field.required
        ? 'Nom requis. La liaison au référentiel peut être faite plus tard.'
        : 'Facultatif. Saisie libre ou liaison ultérieure.'
    }
  }

  const isEditing = Boolean(tpiToLoad)
  const isPrefilledCreate = Boolean(!isEditing && initialTpi)

  return (
    <div className='containerForm'>
      <form className='tpi-form-card' onSubmit={handleSubmit}>
        <div className='tpi-form-topline'>
          <div>
            <span className='tpi-management-tools-label'>
              {isEditing ? 'Edition' : 'Creation'}
            </span>
            <h3>{isEditing ? `Modifier ${formData.refTpi}` : 'Creer une fiche TPI'}</h3>
          </div>

          <p>
            {isPrefilledCreate
              ? 'Prérempli depuis la fiche Planning. Vérifie puis complète les champs manquants avant enregistrement.'
              : 'Structure normalisee pour les experts, lieux, dates et evaluation.'}
          </p>
        </div>

        <div className='tpi-form-grid'>
          <section className='tpi-form-section'>
            <h4>Identification</h4>

            <div className='form-row'>
              <label htmlFor='refTpi'>Reference</label>
              <input
                id='refTpi'
                type='text'
                name='refTpi'
                value={formData.refTpi}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className='form-row'>
              <label htmlFor='classe'>Classe</label>
              <input
                id='classe'
                type='text'
                name='classe'
                value={formData.classe}
                onChange={handleInputChange}
              />
            </div>

            <div className='form-row'>
              <label htmlFor='tags'>Tags</label>
              <input
                id='tags'
                type='text'
                name='tags'
                value={formData.tags}
                onChange={handleInputChange}
                placeholder='React, reseau, cybersecurite'
              />
            </div>
          </section>

          <section className='tpi-form-section'>
            <h4>Personnes</h4>

            <p className='tpi-form-note'>
              Les quatre rôles sont obligatoires.
              La création manuelle attend des parties prenantes valides dans le référentiel.
            </p>

            {isLoadingPeople ? (
              <p className='tpi-form-note'>Chargement du référentiel Parties prenantes...</p>
            ) : null}

            {peopleError ? (
              <p className='tpi-form-note error'>{peopleError}</p>
            ) : null}

            {PERSON_FIELD_CONFIG.map((field) => {
              const rolePeople = getPeopleForRole(field.role)
              const hasSelection = Boolean(formData[field.idName])
              const fieldStatus = getPersonFieldStatus(field)

              return (
                <div className='form-row' key={field.name}>
                  <label htmlFor={field.name}>
                    {field.label}
                    {field.required && <span className='form-required'> *</span>}
                  </label>

                  <div className='tpi-person-field-shell'>
                    <input
                      id={field.name}
                      type='text'
                      name={field.name}
                      value={formData[field.name] || ''}
                      onChange={handlePersonInputChange(field.name, field.idName, field.role)}
                      placeholder={`Nom ou email du ${field.label.toLowerCase()}`}
                      required={Boolean(field.required)}
                    />

                    <div className='tpi-person-link-row'>
                      <select
                        value={formData[field.idName] || ''}
                        onChange={handlePersonSelectChange(field)}
                      >
                        <option value=''>Lier plus tard</option>
                        {rolePeople
                          .filter((person) => person.isActive !== false)
                          .sort((a, b) => a.lastName.localeCompare(b.lastName))
                          .map((person) => (
                            <option key={person._id} value={person._id}>
                              {formatPersonDisplay(person)}
                            </option>
                          ))}
                      </select>

                      <button
                        type='button'
                        className='tpi-person-link-action secondary'
                        onClick={() => prefillStakeholderFromRegistry(field)}
                        disabled={!String(formData[field.name] || '').trim()}
                        title='Tenter une liaison automatique depuis le référentiel'
                      >
                        Lier
                      </button>

                      {hasSelection ? (
                        <button
                          type='button'
                          className='tpi-person-link-action secondary subtle'
                          onClick={() => {
                            setFormData((prevData) => ({
                              ...prevData,
                              [field.idName]: ''
                            }))
                          }}
                        >
                          Délier
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <span className={`tpi-form-link-status ${fieldStatus.tone}`}>
                    {fieldStatus.message}
                  </span>
                </div>
              )
            })}
          </section>

          <section className='tpi-form-section tpi-form-section-wide'>
            <h4>Projet</h4>

            <div className='form-row'>
              <label htmlFor='sujet'>Sujet</label>
              <input
                id='sujet'
                type='text'
                name='sujet'
                value={formData.sujet}
                onChange={handleInputChange}
              />
            </div>

            <div className='form-row textarea'>
              <label htmlFor='description'>Description</label>
              <textarea
                id='description'
                name='description'
                value={formData.description}
                onChange={handleInputChange}
                rows='4'
              />
            </div>
          </section>

          <section className='tpi-form-section'>
            <h4>Lieu</h4>

            <div className='form-row'>
              <label htmlFor='lieuEntreprise'>Entreprise</label>
              <input
                id='lieuEntreprise'
                type='text'
                name='lieuEntreprise'
                value={formData.lieuEntreprise}
                onChange={handleInputChange}
              />
            </div>

            <div className='form-row'>
              <label htmlFor='lieuSite'>Site</label>
              <input
                id='lieuSite'
                type='text'
                name='lieuSite'
                value={formData.lieuSite}
                onChange={handleInputChange}
              />
            </div>

            <div className='form-row'>
              <label htmlFor='salle'>Salle</label>
              <input
                id='salle'
                type='text'
                name='salle'
                value={formData.salle}
                onChange={handleInputChange}
              />
            </div>
          </section>

          <section className='tpi-form-section'>
            <h4>Dates</h4>

            <div className='tpi-form-date-grid'>
              <div className='form-row stacked'>
                <label htmlFor='dateDepart'>Depart</label>
                <input
                  id='dateDepart'
                  type='date'
                  name='dateDepart'
                  value={formData.dateDepart}
                  onChange={handleInputChange}
                />
              </div>

              <div className='form-row stacked'>
                <label htmlFor='dateFin'>Fin</label>
                <input
                  id='dateFin'
                  type='date'
                  name='dateFin'
                  value={formData.dateFin}
                  onChange={handleInputChange}
                />
              </div>

              <div className='form-row stacked'>
                <label htmlFor='date1ereVisite'>1re visite</label>
                <input
                  id='date1ereVisite'
                  type='date'
                  name='date1ereVisite'
                  value={formData.date1ereVisite}
                  onChange={handleInputChange}
                />
              </div>

              <div className='form-row stacked'>
                <label htmlFor='date2emeVisite'>2e visite</label>
                <input
                  id='date2emeVisite'
                  type='date'
                  name='date2emeVisite'
                  value={formData.date2emeVisite}
                  onChange={handleInputChange}
                />
              </div>

              <div className='form-row stacked'>
                <label htmlFor='dateRenduFinal'>Rendu final</label>
                <input
                  id='dateRenduFinal'
                  type='date'
                  name='dateRenduFinal'
                  value={formData.dateRenduFinal}
                  onChange={handleInputChange}
                />
              </div>

              <div className='form-row stacked'>
                <label htmlFor='dateSoutenance'>Soutenance</label>
                <input
                  id='dateSoutenance'
                  type='date'
                  name='dateSoutenance'
                  value={formData.dateSoutenance}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </section>

          <section className='tpi-form-section tpi-form-section-wide'>
            <h4>Liens et evaluation</h4>

            <div className='form-row'>
              <label htmlFor='lienDepot'>Depot git</label>
              <input
                id='lienDepot'
                type='text'
                name='lienDepot'
                value={formData.lienDepot}
                onChange={handleInputChange}
              />
            </div>

            <div className='form-row'>
              <label htmlFor='noteEvaluation'>Note</label>
              <input
                id='noteEvaluation'
                type='number'
                min='1'
                max='6'
                step='0.1'
                name='noteEvaluation'
                value={formData.noteEvaluation}
                onChange={handleInputChange}
              />
            </div>

            <div className='form-row'>
              <label htmlFor='lienEvaluation'>Lien evaluation</label>
              <input
                id='lienEvaluation'
                type='text'
                name='lienEvaluation'
                value={formData.lienEvaluation}
                onChange={handleInputChange}
              />
            </div>
          </section>
        </div>

        <div className='form-row save'>
          <button id='btConcel' type='button' onClick={handleCancel}>
            Annuler
          </button>
          <button type='submit' disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default TpiForm
