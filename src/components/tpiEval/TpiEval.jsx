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
async function getTpiByCandidate(year,candidateName) {
  
  try {
    // Définir les options de la requête, y compris l'en-tête personnalisé
    const requestOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Effectuer une requête GET à l'API pour récupérer le TPI par nom de candidat
    const response = await fetch(`${apiUrl}/api/tpi/${year}/byCandidate/${candidateName}`, requestOptions);
    
    // Vérifier si la réponse est OK (200)
    if (!response.ok) {
      throw new Error('Erreur lors de la récupération du TPI par candidat');
    }

    // Extraire les données JSON de la réponse
    const tpi = await response.json();

    // Retourner le TPI récupéré
    return tpi;
  } catch (error) {
    console.error('Erreur lors de la récupération du TPI par candidat :', error);
    throw error;
  }
}

//#endregion

// Composant principal
function TpiEvalModule () {
  // État pour stocker les informations d'évaluation
  const [evaluations, setEvaluations] = useState([])
  const [isNewEval, SetIsNewEval] = useState(false)

  // Appel unique lors du chargement de la page
  // Charger les évaluations depuis le localstorage
  useEffect(() => {
    // Obtenir les paramètres de l'URL
    const hasToken = new URLSearchParams(window.location.search)

    // test si le token est bon ...
    const isExpert = getExpertNameByToken(hasToken.get('token'))

    // ToDo ...
    /**
     * l'idée étant de valider le token pour ne pas demander les accréditations
     * afficher les evals qui peut modifier et lire
     * afficher les evals qui peux uniquement lire ...
     *
     */

    const savedEvaluations = localStorage.getItem(`tpiEval_${isExpert.name}`)
    if (savedEvaluations) {
      setEvaluations(JSON.parse(savedEvaluations))
    }
  }, [])

  // Fonction pour sauvegarder les évaluations dans le localstorage
  const saveEvaluations = () => {
    localStorage.setItem('evaluations', JSON.stringify(evaluations))
  }

  // Fonction pour ajouter une nouvelle évaluation
  const addEvaluation = newEvaluation => {
    setEvaluations([...evaluations, newEvaluation])
  }

  // Fonction pour supprimer une évaluation
  const deleteEvaluation = index => {
    const updatedEvaluations = evaluations.filter((_, i) => i !== index)
    setEvaluations(updatedEvaluations)
  }

  const handleNewEval = () => {
    SetIsNewEval(previousState => !previousState)
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
        {isNewEval && <NewEvaluationForm addEvaluation={addEvaluation} searchCandidat={getTpiByCandidate} />}
      </section>

      {/* Exemple : <EvaluationList evaluations={evaluations} deleteEvaluation={deleteEvaluation} /> */}
      {/* Exemple : <AdminControls saveEvaluations={saveEvaluations} /> */}
    </div>
  )
}

export default TpiEvalModule
