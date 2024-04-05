import React, { useContext, useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { getYear } from 'date-fns'

function showPopup (textHTML) {
  return new Promise((resolve, reject) => {
    // Récupérer l'élément popup et son contenu
    const popup = document.getElementById('popup')
    const popupContent = document.getElementById('popup-content')

    // Mettre à jour le contenu de la popup
    popupContent.innerHTML = textHTML

    // Afficher la popup
    popup.style.display = 'block'

    // Ajouter un gestionnaire d'événement au clic sur un bouton radio
    popupContent.addEventListener('change', event => {
      // Vérifier si un bouton radio est sélectionné
      if (event.target.type === 'radio' && event.target.checked) {
        const selectedCandidat = event.target.value
        console.log('Candidat sélectionné :', selectedCandidat)
        popup.style.display = 'none'
        resolve(selectedCandidat)
      }
    })

    // Ajouter un gestionnaire d'événement pour masquer la popup lorsqu'on clique en dehors
    popup.onclick = event => {
      if (event.target === popup) {
        popup.style.display = 'none'
        reject(new Error('Popup fermée sans sélection de candidat'))
      }
    }
  })
}

const insertDetails = c => {
  if (c != null) {
    
    const refCandidat = document.getElementById('refCandidat')

    const entrepriseNameInput = document.getElementById('txtEntreprise')
    const entreprisePhoneInput = document.getElementById('txtEntreprisePhone')
    const entrepriseEmailInput = document.getElementById('txtEntrepriseEmail')

    const candidatNameInput = document.getElementById('txtCandidat.e')

    const expert1NameInput = document.getElementById('txtExpert1')

    const expert2NameInput = document.getElementById('txtExpert2')

    // Insérer les détails de l'entreprise
    refCandidat.value = c.refTpi
    entrepriseNameInput.value = 'ETML /CFPV '
    entreprisePhoneInput.value = '+41 21 316 77 77'
    entrepriseEmailInput.value = '@eduvaud.ch'

    // Insérer les détails du candidat
    candidatNameInput.value = c.candidat

    // Insérer les détails du premier expert
    expert1NameInput.value = c.expert1

    // Insérer les détails du deuxième expert
    expert2NameInput.value = c.expert2
  }
}

const HeaderLine = ({ isVisible, searchCandidat }) => {
  const [searchThisCandidat, setSearchThisCandidat] = useState('')
  const [tpiMatches, setTpiMatches] = useState(null)
  const [selectedCandidat, setSelectedCandidat] = useState(null)

  useEffect(() => {
    insertDetails(selectedCandidat)
  }, [selectedCandidat])
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Attendre que la promesse se résolve pour obtenir les données
        const data = await tpiMatches;
  
        console.log('Données récupérées :', data);
  
        // Initialisez une variable pour stocker les noms des candidats
        let candidats = '';
  
        // Parcourez chaque élément de tpiMatches et récupérez le nom du candidat
        data.forEach(element => {
          // Créez un bouton radio avec le nom du candidat comme label
          candidats += `<div>
            <input type="radio" id="${element._id}" name="candidat" value="${element.candidat}">
            <label for="${element._id}">${element.candidat}</label>
          </div>`;
        });
  
        // Appelez la fonction showPopup avec les noms des candidats
        showPopup(candidats)
          .then(selectedCandidateName => {
            // Trouvez l'objet du candidat sélectionné dans la liste tpiMatches
            const selectedCandidate = data.find(
              candidate => candidate.candidat === selectedCandidateName
            );
            if (selectedCandidate) {
              // Stockez le candidat sélectionné
              setSelectedCandidat(selectedCandidate);
              console.log('selection: ', selectedCandidate);
            } else {
              console.error('Candidat non trouvé dans la liste des candidats');
            }
          })
          .catch(error => {
            console.error(error.message);
            // Gérer les erreurs de la popup
          });
      } catch (error) {
        console.error('Erreur lors de la récupération des données :', error);
        // Gérer les erreurs de la promesse
      }
    };
  
    // Appel de la fonction fetchData pour récupérer les données
    fetchData();
  }, [tpiMatches]); // Observateur pour les changements de tpiMatches
  
  const handleSearchClick = () => {
    // Mettez ici le code pour gérer le clic sur le bouton de recherche du candidat
    console.log('Recherche du candidat avec le terme :', searchThisCandidat)
    const year = 2023 //new Date().getFullYear(); // Obtenir l'année actuelle
    const matches = searchCandidat(year, searchThisCandidat)
    setTpiMatches(matches) // Mettre à jour l'état local avec les résultats de la recherche
  }

  const handleInputChange = event => {
    setSearchThisCandidat(event.target.value)
  }

  return (
    <div className='headerPage'>
      <div className={`headerQualification ${isVisible ? '' : 'hidden'}`}>
        Procédure de qualification : 88600/1/2/3 Informaticienne
        CFC/Informaticien CFC (Ordonnance 2014)
      </div>
      <div className={`headerFormulaire ${isVisible ? '' : 'hidden'}`}>
        Formulaire d’évaluation Candidat/-e:{' '}
        <span  id='refPage'>
          <input
            id='refCandidat'
            type='text'
            placeholder='Nom du candidat'
            value={searchThisCandidat}
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

const Header = ({ label1, label2 }) => {
  return (
    <>
      <div className='identityHeader'>
        {label1 && <FormField id={1} label={label1} />}
        {label2 && <FormField id={2} label={label2} />}
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
