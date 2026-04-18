import React, { useState } from "react"
import { AES } from "crypto-js"

import { createUser } from "../tpiControllers/TpiUsersController.jsx"
import { showNotification } from "../Tools.jsx"
import {
  TRACKER_ROLE_OPTIONS,
  getTrackerRoleConfig,
  getTrackerRoleLabel
} from "./trackerRoles.js"

const EMPTY_FORM_DATA = {
  login: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  role: ""
}

const InputField = ({ label, className = "", type, placeholder, value, onChange, ...props }) => {
  return (
    <label className={`tracker-field ${className}`.trim()}>
      <span className='tracker-sr-only'>{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        aria-label={label}
        {...props}
      />
    </label>
  )
}

const RoleOption = ({ roleOption, isActive, onSelect }) => {
  return (
    <button
      type='button'
      className={`tracker-role-option tracker-role-option--${roleOption.className} ${
        isActive ? "active" : ""
      }`.trim()}
      aria-pressed={isActive}
      onClick={() => onSelect(roleOption.value)}
    >
      <span className='tracker-role-option-label'>{roleOption.label}</span>
      <span className='tracker-role-option-summary'>{roleOption.summary}</span>
    </button>
  )
}

const Register = ({ secret }) => {
  const [activeForm, setActiveForm] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState(() => ({ ...EMPTY_FORM_DATA }))
  const activeRoleConfig = activeForm ? getTrackerRoleConfig(activeForm) : null

  const handleFormSelection = (formType) => {
    setActiveForm(formType)
    setFormData((currentForm) => ({
      ...currentForm,
      role: formType
    }))
  }

  const handleInputChange = (field, value) => {
    setFormData((currentForm) => ({
      ...currentForm,
      [field]: value
    }))
  }

  const resetForm = () => {
    setActiveForm(null)
    setFormData({ ...EMPTY_FORM_DATA })
  }

  const hashToPassword = (password) => {
    return AES.encrypt(String(password || ""), secret).toString()
  }

  const handleRegistration = async (event) => {
    event.preventDefault()

    if (!activeForm) {
      showNotification("Veuillez choisir un profil à inscrire.", "error", 4000)
      return
    }

    if (!secret) {
      showNotification(
        "Le secret de chiffrement du suivi est manquant.",
        "error",
        4000
      )
      return
    }

    const normalizedFormData = {
      ...formData,
      login: formData.login.trim(),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      role: activeForm
    }

    if (
      !normalizedFormData.login ||
      !normalizedFormData.firstName ||
      !normalizedFormData.lastName ||
      !normalizedFormData.email ||
      !normalizedFormData.password
    ) {
      showNotification(
        "Veuillez compléter les champs obligatoires avant l'inscription.",
        "error",
        4000
      )
      return
    }

    setIsSubmitting(true)

    try {
      await createUser({
        ...normalizedFormData,
        password: hashToPassword(normalizedFormData.password)
      })

      showNotification(
        `${getTrackerRoleLabel(activeForm)} inscrit avec succès.`,
        "success",
        3500
      )
      resetForm()
    } catch (error) {
      showNotification(
        error?.message || "Impossible d'inscrire l'utilisateur.",
        "error",
        4000
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className='tracker-panel tracker-register-card'>
      <div className='tracker-card-head'>
        <span className='tracker-panel-eyebrow'>Inscription</span>
        <span className='tracker-card-status'>
          {activeForm
            ? `${getTrackerRoleLabel(activeForm)} sélectionné`
            : `${TRACKER_ROLE_OPTIONS.length} profils`}
        </span>
      </div>

      <div className='tracker-register-intro'>
        <h2>Créer un compte</h2>
        <p className='tracker-card-copy'>
          Choisissez un profil puis complétez les champs obligatoires.
        </p>
      </div>

      <div className='tracker-role-grid' aria-label='Profils à inscrire'>
        {TRACKER_ROLE_OPTIONS.map((roleOption) => (
          <RoleOption
            key={roleOption.value}
            roleOption={roleOption}
            isActive={activeForm === roleOption.value}
            onSelect={handleFormSelection}
          />
        ))}
      </div>

      {activeForm ? (
        <form
          className={`tracker-registration-form tracker-registration-form--${activeForm}`}
          onSubmit={handleRegistration}
        >
          <div className='tracker-registration-summary'>
            <p>
              <strong>Profil:</strong> {getTrackerRoleLabel(activeForm)}.{" "}
              {activeRoleConfig?.summary || "Renseignez les informations du compte."}
            </p>
          </div>

          <div className='tracker-field-grid'>
            <InputField
              label="Login"
              className='tracker-field--full'
              type='text'
              placeholder="Nom d'utilisateur"
              value={formData.login}
              autoComplete='username'
              required
              onChange={(e) => handleInputChange("login", e.target.value)}
            />
            <InputField
              label='Prénom'
              type='text'
              placeholder='Prénom'
              value={formData.firstName}
              autoComplete='given-name'
              required
              onChange={(e) => handleInputChange("firstName", e.target.value)}
            />
            <InputField
              label='Nom de famille'
              type='text'
              placeholder='Nom de famille'
              value={formData.lastName}
              autoComplete='family-name'
              required
              onChange={(e) => handleInputChange("lastName", e.target.value)}
            />
            <InputField
              label='Adresse e-mail'
              className='tracker-field--full'
              type='email'
              placeholder='Adresse e-mail'
              value={formData.email}
              autoComplete='email'
              required
              onChange={(e) => handleInputChange("email", e.target.value)}
            />
            <InputField
              label='Téléphone'
              type='tel'
              placeholder='Téléphone'
              value={formData.phone}
              autoComplete='tel'
              onChange={(e) => handleInputChange("phone", e.target.value)}
            />
            <InputField
              label='Mot de passe'
              type='password'
              placeholder='Mot de passe'
              value={formData.password}
              autoComplete='new-password'
              required
              onChange={(e) => handleInputChange("password", e.target.value)}
            />
          </div>

          <div className='tracker-form-footer'>
            <p className='tracker-form-note'>
              Le mot de passe est chiffré avant l&apos;enregistrement.
            </p>
            <button type='submit' className='tracker-primary-button' disabled={isSubmitting}>
              {isSubmitting
                ? "Enregistrement..."
                : `Créer le compte ${getTrackerRoleLabel(activeForm).toLowerCase()}`}
            </button>
          </div>
        </form>
      ) : (
        <div className='tracker-register-empty'>
          <p>Sélectionnez un profil pour afficher le formulaire.</p>
        </div>
      )}
    </section>
  )
}

export default Register
