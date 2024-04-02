/**
 * Le module TpiEval permet la saisie des informations d'évaluation lors d'une soutenance.
 * Le principe est le suivant :
 * - Simulation de la génération d'un fichier PDF.
 * - Sauvegarde automatique toutes les 2 minutes (utilisation du localstorage).
 * - Propose la lecture ou la modification de ses propres évaluations.
 * - Permet la lecture seule des évaluations des collègues.
 * - Autorise la suppression de ses évaluations uniquement si elles n'ont pas été transmises.
 * En effet, une sauvegarde en base de données empêche leur suppression ultérieure.
 * Seul l'administrateur dispose de cette permission.
 */
import axios from 'axios'
import React, { useState, useEffect } from 'react'

import '../../css/tpiEval/tpiEval.css'

/*** Fonctions ***/

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

// Composant principal
function TpiEvalModule () {
  // État pour stocker les informations d'évaluation
  const [evaluations, setEvaluations] = useState([])

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

  // TODO: Ajouter d'autres fonctions et composants nécessaires

  return (
    <div id='tpiEval'>
      <h1>TpiEval</h1>
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

      {/* Composants pour la saisie, la lecture et la modification des évaluations */}
      {/* Exemple : <EvaluationForm addEvaluation={addEvaluation} /> */}
      {/* Exemple : <EvaluationList evaluations={evaluations} deleteEvaluation={deleteEvaluation} /> */}
      {/* Exemple : <AdminControls saveEvaluations={saveEvaluations} /> */}
    </div>
  )
}

export default TpiEvalModule
