import React, { useContext, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'

const HeaderLine = ({ isVisible }) => {
  const [searchTerm, setSearchTerm] = useState('')

  const handleSearchClick = () => {
    // Mettez ici le code pour gérer le clic sur le bouton de recherche du candidat
    console.log('Recherche du candidat avec le terme:', searchTerm)
  }

  const handleInputChange = event => {
    setSearchTerm(event.target.value)
  }
  return (
    <div className='headerPage'>
      <div className={`headerQualification ${isVisible ? '' : 'hidden'}`}>
        Procédure de qualification : 88600/1/2/3 Informaticienne
        CFC/Informaticien CFC (Ordonnance 2014)
      </div>
      <div className={`headerFormulaire ${isVisible ? '' : 'hidden'}`}>
        Formulaire d’évaluation Candidat/-e:{' '}
        <span id='refCandidat'>
          <input
            type='text'
            placeholder='Nom du candidat'
            value={searchTerm}
            onChange={handleInputChange}
          />
          <button id='searchCandidat' onClick={handleSearchClick}>
            <FontAwesomeIcon icon={faArrowRight} /> Importer ce candidat
          </button>
        </span>
      </div>
    </div>
  )
}

const FormField = ({ id, label }) => {
  const labelValid = label
  if (label.split(' ')[0] === 'Expert') {
    label = label.split(' ')[0] + label.split(' ')[1]
  }

  return (
    <div className='headerField'>
      <label
        htmlFor={`txt${label.split(' ')[0]}`}
        className={`label_${label.split(' ')[0]}`}
      >
        {labelValid}:
      </label>
      <input
        data-header={`${label.split(' ')[0]}Name`}
        tabIndex={id}
        id={`txt${label.split(' ')[0]}`}
        name={`${label.split(' ')[0]}Name`}
        type='text'
        placeholder={`${label}...`}
        className={`label_${label.split(' ')[0]}`}
      />

      <label
        htmlFor={`txt${label.split(' ')[0]}Phone`}
        className={`label_${label.split(' ')[0]}`}
      >
        Telephone:
      </label>
      <input
        tabIndex={id + 1}
        id={`txt${label.split(' ')[0]}Phone`}
        name={`${label.split(' ')[0]}Phone`}
        data-header={`${label.split(' ')[0]}Phone`}
        type='tel'
        placeholder='Telephone...'
        className={`Phone_${label.split(' ')[0]}`}
      />

      <label
        htmlFor={`txt${label.split(' ')[0]}Email`}
        className={`label_${label.split(' ')[0]}`}
      >
        email :
      </label>
      <input
        tabIndex={id + 2}
        id={`txt${label.split(' ')[0]}Email`}
        name={`${label.split(' ')[0]}Email`}
        data-header={`${label.split(' ')[0]}Email`}
        type='email'
        placeholder='Email...'
        className={`Email${label.split(' ')[0]}`}
      />
    </div>
  )
}

const Header = ({ label1, label2, label3, label4 }) => {
  return (
    <>
      <div className='identityHeader'>
        {label1 && <FormField id={1} label={label1} />}
        {label2 && <FormField id={2} label={label2} />}
        {label3 && <FormField id={3} label={label3} />}
        {label4 && <FormField id={4} label={label4} />}
      </div>
    </>
  )
}

const ProfessionalCompetenciesDescription = () => {
  return (
    <div>
      <p>
        Ce document ne doit en aucun cas être montré au candidat après
        l’attribution des points. Conseils pour l’évaluation et l’attribution de
        la note Documentation Les experts/expertes traitent tous les documents
        de manière confidentielle. La conservation des dossiers est régie par le
        droit cantonal. Evaluation Le/la chef/-e de projet du TPI et les
        experts/expertes évaluent les compétences professionnelles élargies, le
        résultat et les compétences professionnelles. L’évaluation du TPI est
        répartie comme suit :
      </p>
      <p>Partie A: Compétences professionnelles (20 critères)</p>
      <ul>
        <li>6 critères relatifs à l’analyse et au concept</li>
        <li>
          7 critères relatifs à la réalisation, aux tests et au résultats du TPI
        </li>
        <li>
          7 critères spécifiques à la tâche demandée par le supérieur
          professionnel
        </li>
      </ul>
      <p>Partie B: Documentation / rapport du TPI (10 critères)</p>
      <p>Partie C: Entretien professionnel et présentation (10 critères)</p>
    </div>
  )
}

export { Header, HeaderLine, ProfessionalCompetenciesDescription }
