import React, { useContext, useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { getYear } from 'date-fns'

// Pour accéder à la variable d'environnement REACT_APP_DEBUG
const debugMode = process.env.REACT_APP_DEBUG === 'true'

// Pour accéder à la variable d'environnement REACT_APP_API_URL
const apiUrl = debugMode
  ? process.env.REACT_APP_API_URL_TRUE
  : process.env.REACT_APP_API_URL_FALSE

async function getExpertByName (name) {
  try {
    const response = await fetch(`${apiUrl}/api/expert/${name}`)
    if (!response.ok) {
      throw new Error('Expert not found')
    }
    const data = await response.json()
    const expert = data.expert
    console.log('getExpertByName: ', expert)
    return expert
  } catch (error) {
    console.error('Error:', error.message)
    return null
  }
}

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

const insertDetails = async (c, refCandidat) => {
  if (c != null) {
    const entrepriseNameInput = document.getElementById('txtEntreprise')
    const entreprisePhoneInput = document.getElementById('txtEntreprisePhone')
    const entrepriseEmailInput = document.getElementById('txtEntrepriseEmail')
    const candidatNameInput = document.getElementById('txtCandidat.e')
    const expert1NameInput = document.getElementById('txtExpert1')
    const expert1EmailInput = document.getElementById('txtExpert1Email')
    const expert2NameInput = document.getElementById('txtExpert2')
    const expert2EmailInput = document.getElementById('txtExpert2Email')
    const remarque = document.getElementsByName('remarque')[0]

    const refTpi = document.querySelectorAll('refCandidat')

    // Insérer les détails de l'entreprise
    entrepriseNameInput.value = 'ETML / ' + c.boss
    entreprisePhoneInput.value = '+41 21 316 77 77'
    const entrepriseExpert = await getExpertByName(c.boss)
    entrepriseEmailInput.value = entrepriseExpert ? entrepriseExpert.email : ''

    // Insérer les détails du candidat
    candidatNameInput.value = c.candidat

    // Insérer les détails du premier expert
    expert1NameInput.value = c.expert1
    const expert1 = await getExpertByName(c.expert1)
    expert1EmailInput.value = expert1 ? expert1.email : ''

    // Insérer les détails du deuxième expert
    expert2NameInput.value = c.expert2
    const expert2 = await getExpertByName(c.expert2)
    expert2EmailInput.value = expert2 ? expert2.email : ''

    remarque.value = 'Sujet : ' + c.sujet

    refTpi.forEach(element => {
      element.textContent = c.refTpi
    })

    // Nécessité d'appliquer cette opération pour supprimer le focus causé par le bouton de recherche
    refCandidat(c.refTpi)
  }
}

const HeaderLine = ({ isVisible, searchCandidat }) => {
  const [searchThisCandidat, setSearchThisCandidat] = useState('')
  const [tpiMatches, setTpiMatches] = useState(null)
  const [selectedCandidat, setSelectedCandidat] = useState(null)

  useEffect(() => {
    insertDetails(selectedCandidat, setSearchThisCandidat)
  }, [selectedCandidat])
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (tpiMatches !== null) { // Vérifiez si tpiMatches n'est pas null
          // Attendre que la promesse se résolve pour obtenir les données
          const data = await tpiMatches;
  
          if (data !== undefined) { // Vérifiez si data n'est pas undefined
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
                } else {
                  console.error('Candidat non trouvé dans la liste des candidats');
                }
              })
              .catch(error => {
                console.error(error.message);
                // Gérer les erreurs de la popup
              });
          } else {
            console.error('Données non définies');
          }
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des données :', error);
        // Gérer les erreurs de la promesse
      }
    };
  
    // Appel de la fonction fetchData pour récupérer les données
    fetchData();
  }, [tpiMatches]);
  
  
  const handleSearchClick = () => {
    // Mettez ici le code pour gérer le clic sur le bouton de recherche du candidat
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
        <span id='refPage'>
          <input
            name='refCandidat'
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
