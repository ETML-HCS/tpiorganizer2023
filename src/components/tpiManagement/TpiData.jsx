import { createTpiModel, getTpiModels } from '../tpiControllers/TpiController.jsx'
import { showNotification } from '../Tools.jsx'

// Fonction pour sauvegarder un TPI dans la base de données via le serveur
export const saveTpiToServer = async (tpiDetails, year) => {
  // Vérifier si les champs obligatoires sont remplis
  if (!tpiDetails.refTpi || !tpiDetails.candidat || !tpiDetails.experts?.[1] || !tpiDetails.experts?.[2] || !tpiDetails.boss) {
    // Afficher un message d'erreur indiquant que certains champs sont obligatoires
    showNotification(
      'Reference, candidat, expert 1, expert 2 et chef de projet sont requis.',
      'error',
      3000
    )
    // Sortir de la fonction sans sauvegarder les données s'il manque des champs obligatoires
    return null
  }

  if (!year) {
    showNotification("Impossible de sauvegarder sans annee selectionnee.", 'error', 3000)
    return null
  }

  try {
    // Appeler la fonction du client pour créer ou mettre à jour le modèle de TPI dans la base de données via le serveur
    const savedModel = await createTpiModel(tpiDetails, year)

    // Afficher le message en conséquence
    const message = savedModel
      ? 'TPI sauvegardé avec succès - ref ' + savedModel.refTpi
      : 'Erreur lors de la sauvegarde du TPI'

    showNotification(message, savedModel ? 'success' : 'error', 3000)
    return savedModel
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du TPI:', error)
    showNotification(
      'Erreur lors de la sauvegarde du TPI. Veuillez reessayer plus tard.',
      'error',
      3000
    )
    return null
  }
}

// Fonction pour récupérer la liste des TPI depuis le serveur
export const getTpiFromServer = async year => {
  // Ajoute le paramètre 'year'
  try {
    // Appeler la fonction du client pour récupérer les modèles de TPI depuis le serveur en fonction de l'année
    const tpiModels = await getTpiModels(year)

    // Afficher le message en cas de succès

    return tpiModels
  } catch (error) {
    console.error(
      'Erreur lors de la récupération des TPI depuis le serveur:',
      error
    )

    showNotification(
      'Erreur lors de la récupération des TPI depuis le serveur. Veuillez réessayer plus tard.',
      'error',
      3000
    )
    throw error
  }
}
