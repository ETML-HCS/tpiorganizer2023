/**
 * Le module TpiEval permet la saisie, la lecture et la modification des évaluations lors de soutenances.
 * Fonctionnalités :
 * - Simulation de génération de fichiers PDF.
 * - Sauvegarde automatique toutes les 2 minutes (local storage).
 * - Lecture ou modification des évaluations personnelles.
 * - Lecture seule des évaluations des collègues.
 * - Suppression autorisée pour les évaluations non transmises uniquement.
 *    Les évaluations sauvegardées en base de données sont immuables.
 *    Seul l'administrateur peut les supprimer.
 *
 * Base de données :
 * - Stocke toutes les évaluations avec leurs détails.
 * - Permet la recherche et la distinction entre évaluations personnelles et celles des autres.
 *    Cela détermine les permissions de lecture ou de modification.
 */

import React, { useState, useEffect } from 'react'

import NewEvaluationForm from './NewEvaluationForm'

import '../../css/tpiEval/tpiEval.css'

// Pour accéder à la variable d'environnement REACT_APP_DEBUG
const debugMode = process.env.REACT_APP_DEBUG === 'true'

// Pour accéder à la variable d'environnement REACT_APP_API_URL
const apiUrl = debugMode
  ? process.env.REACT_APP_API_URL_TRUE
  : process.env.REACT_APP_API_URL_FALSE

//#region:fonctions
/**
 * Fonction pour récupérer le nom de l'expert à partir du token.
 * @param {string} token Le token de l'expert.
 * @returns {Promise<string|null>} Le nom de l'expert ou null en cas d'erreur.
 */
async function getExpertNameByToken (token) {
  try {
    // Faire une requête GET vers le chemin '/api/experts/getNameByToken' avec le token comme paramètre
    const response = await fetch(`/api/experts/getNameByToken?token=${token}`)

    // Vérifier si la réponse est OK (code de statut HTTP 200)
    if (!response.ok) {
      // Gérer les erreurs de réponse
      const errorData = await response.json()
      throw new Error(errorData.error)
    }

    // Extraire les données JSON de la réponse
    const data = await response.json()

    // Retourner le nom de l'expert
    return data.name
  } catch (error) {
    // Gérer les erreurs
    console.error("Erreur lors de la récupération du nom de l'expert :", error)
    // Retourner null ou une chaîne vide ou une valeur par défaut selon le cas
    return null
  }
}

/**
 * Effectue une requête pour récupérer le TPI en fonction du nom du candidat.
 * @param {string} candidateName - Le nom du candidat pour lequel récupérer le TPI.
 * @returns {object} Le TPI trouvé pour le candidat spécifié.
 */
async function getTpiByCandidate (year, candidateName) {
  try {
    // Définir les options de la requête, y compris l'en-tête personnalisé
    const requestOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }

    // Effectuer une requête GET à l'API pour récupérer le TPI par nom de candidat
    const response = await fetch(
      `${apiUrl}/api/tpi/${year}/byCandidate/${candidateName}`,
      requestOptions
    )

    // Vérifier si la réponse est OK (200)
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération du TPI par candidat')
    }

    // Extraire les données JSON de la réponse
    const tpi = await response.json()

    // Retourner le TPI récupéré
    return tpi
  } catch (error) {
    console.error('Erreur lors de la récupération du TPI par candidat :', error)
    throw error
  }
}

// Définir une fonction pour récupérer
// les évaluations pour une année spécifique
async function getEvaluationsForYear (year) {
  try {
    // Effectuer une requête GET vers la route '/evaluations/:year'
    const response = await fetch(`${apiUrl}/load-tpiEvals/${year}`)

    // Vérifier si la réponse est ok (statut 200)
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des évaluations')
    }

    // Convertir la réponse en JSON
    const evaluations = await response.json()

    // Retourner les évaluations récupérées
    return evaluations
  } catch (error) {
    // En cas d'erreur, afficher un message d'erreur dans la console
    console.error('Erreur:', error.message)
    // Retourner null en cas d'erreur pour indiquer un échec
    return null
  }
}
//#endregion

//#region : composants internes

function EvaluationList ({ evaluations, setLoadTpiEval }) {
  const [filterEnterprise, setFilterEnterprise] = useState('')

  const handleOnClisk_tpiEval = dataTpiEval => {
    setLoadTpiEval(dataTpiEval)
  }

  const filteredEvaluations = evaluations.filter(evaluation =>
    evaluation.datasHeader.EntrepriseName.replace('ETML /', '')
      .toLowerCase()
      .includes(filterEnterprise.toLowerCase())
  )

  return (
    <div className='evaluation-list'>
      <h2>Liste des évaluations</h2>
      <input
        type='text'
        placeholder="Filtrer par CDP..."
        value={filterEnterprise}
        onChange={e => setFilterEnterprise(e.target.value)}
      />
      <ul className='evaluation-items'>
        {filteredEvaluations.map((evaluation, index) => (
          <li
            key={index}
            className='evaluation-item'
            title={`Description : ${evaluation.tpiRemarque}\nNote : ${evaluation.noteObtenu}`}
            onClick={() => handleOnClisk_tpiEval(evaluation)}
          >
            <span className='evaluations-year'>{evaluations.year}</span>

            <p className='evaluation-ref'>Refs: {evaluation.tpiRef}</p>

            <p className='evaluation-candidate'>
              {evaluation.datasHeader['Candidat.eName']}
            </p>

            <p className='evaluation-expert1'>
              {evaluation.datasHeader.Expert1Name}
            </p>

            <p className='evaluation-expert2'>
              {evaluation.datasHeader.Expert2Name}
            </p>

            <p className='evaluation-company'>
              {evaluation.datasHeader.EntrepriseName.replace('ETML /', '')}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
//#endregion

// Composant principal
function TpiEvalModule () {
  // État pour stocker les informations d'évaluation
  const [evaluations, setEvaluations] = useState([])
  const [isNewEval, setIsNewEval] = useState(false)
  const [datasEval, setDatasEval] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filterEvaluationsByCandidate = () => {
    return evaluations.filter(evaluation => {
      return evaluation.datasHeader['Candidat.eName']
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    })
  }

  useEffect(() => {
    const year = 2023
    // Appeler la fonction getEvaluationsForYear pour récupérer les évaluations pour l'année 2023
    getEvaluationsForYear(year)
      .then(evaluations => {
        if (evaluations) {
          evaluations.year = year
          // Mettre à jour l'état avec les évaluations récupérées
          setEvaluations(evaluations)
        } else {
          // Gérer le cas où la récupération des évaluations a échoué
          console.log(
            "Échec de la récupération des évaluations pour l'année 2023"
          )
        }
      })
      .catch(error => {
        // Gérer les erreurs de récupération des évaluations
        console.error('Erreur lors de la récupération des évaluations:', error)
      })
  }, []) // Le tableau vide des dépendances signifie que ce useEffect s'exécutera uniquement après le premier rendu

  // Le useEffect suivant est utilisé pour déclencher la création d'une nouvelle évaluation
  useEffect(() => {
    if (datasEval != null) {
      setIsNewEval(true)
    }
  }, [datasEval])

  const handleNewEval = () => {
    setIsNewEval(previousState => !previousState)
    if (datasEval) {
      setDatasEval(null)
    }
  }

  // TODO: Ajouter d'autres fonctions et composants nécessaires
  return (
    <div id='tpiEval'>
      <h1>TpiEval</h1>
      <nav>
        <button id='btnNewEval' type='button' onClick={handleNewEval}>
          NewEval ?
        </button>
      </nav>

      <main>
        <p>
          Pour commencer, utilisez le bouton ci-dessus afin de créer une
          nouvelle évaluation. Si vous préférez, vous pouvez également parcourir
          les évaluations existantes ci-dessous.
        </p>
        <p>
          <strong>
            Veuillez noter qu'il est uniquement possible de modifier vos propres
            évaluations.
          </strong>
        </p>
      </main>

      <section id='newEvalForm'>
        {isNewEval && (
          <NewEvaluationForm
            searchCandidat={getTpiByCandidate}
            loadTpiEval={datasEval}
            setLoadTpiEval={setDatasEval}
          />
        )}
      </section>

      <EvaluationList evaluations={evaluations} setLoadTpiEval={setDatasEval} />

      {/* Exemple : <AdminControls saveEvaluations={saveEvaluations} /> */}
    </div>
  )
}

export default TpiEvalModule
