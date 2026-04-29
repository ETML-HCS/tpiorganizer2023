import React, { useEffect, useRef, useState } from "react"
import { toast } from "react-toastify"

import NewEvaluationForm from "./NewEvaluationForm"
import {
  filterEvaluationsByQuery,
  getEvaluationStorageKey,
  normalizeEvaluationList
} from "./tpiEvalUtils"
import IconButtonContent from "../shared/IconButtonContent"
import PageToolbar from "../shared/PageToolbar"
import { CloseIcon, PlusIcon, UploadIcon } from "../shared/InlineIcons"
import { MAIN_NAVIGATION_LINKS } from "../shared/mainNavigation"
import { API_URL, ROUTES, STORAGE_KEYS } from "../../config/appConfig"
import {
  readJSONListValue,
  upsertJSONListValue,
} from "../../utils/storage"

import "../../css/tpiEval/tpiEval.css"

const apiUrl = API_URL

//#region:fonctions

/**
 * Effectue une requête pour récupérer le TPI en fonction du nom du candidat.
 * @param {string} candidateName - Le nom du candidat pour lequel récupérer le TPI.
 * @returns {object} Le TPI trouvé pour le candidat spécifié.
 */
async function getTpiByCandidate(year, candidateName) {
  try {
    // Définir les options de la requête, y compris l'en-tête personnalisé
    const requestOptions = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }

    // Effectuer une requête GET à l'API pour récupérer le TPI par nom de candidat
    const response = await fetch(
      `${apiUrl}/api/tpi/${year}/byCandidate/${encodeURIComponent(String(candidateName || ''))}`,
      requestOptions
    )

    // Vérifier si la réponse est OK (200)
    if (!response.ok) {
      throw new Error("Erreur fetch...")
    }

    // Extraire les données JSON de la réponse
    const tpi = await response.json()

    // Retourner le TPI récupéré
    return tpi
  } catch (error) {
    console.error("Erreur lors de la récupération du TPI par candidat :", error)
    throw error
  }
}

//#endregion

//#region : composants internes

function EvaluationList({ evaluations, setLoadTpiEval }) {
  const [filterEnterprise, setFilterEnterprise] = useState("")

  const handleOnClisk_tpiEval = (dataTpiEval) => {
    setLoadTpiEval(dataTpiEval)
  }

  const filteredEvaluations = filterEvaluationsByQuery(evaluations, filterEnterprise)

  const hasEvaluations = filteredEvaluations.length > 0
  const isFiltering = filterEnterprise.trim().length > 0

  return (
    <div className='evaluation-list-shell'>
      <div className='evaluation-list'>
        <div className='evaluation-list-head'>
          <div className='evaluation-list-copy'>
            <span className='evaluation-list-kicker'>Bibliothèque locale</span>
            <h2>Liste des évaluations</h2>
            <p>
              Filtrez ou rouvrez une fiche.
            </p>
          </div>

          <span className='evaluation-list-count'>
            {filteredEvaluations.length} résultat
            {filteredEvaluations.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className='evaluation-filter-row'>
          <input
            type='text'
            className='evaluation-filter'
            placeholder='Filtrer par entreprise...'
            value={filterEnterprise}
            onChange={(e) => setFilterEnterprise(e.target.value)}
          />
        </div>

        {hasEvaluations ? (
          <ul className='evaluation-items'>
            {filteredEvaluations.map((evaluation, index) => (
              <li
                key={getEvaluationStorageKey(evaluation) ?? index}
                className={`evaluation-item ${
                  evaluation?.p_appro ? "modeAppro" : ""
                }`}
                title={`Description : ${evaluation?.tpiRemarque || "—"}\nNote : ${
                  evaluation?.noteObtenu ?? "—"
                }`}
                onClick={() => handleOnClisk_tpiEval(evaluation)}
              >
                <span className='evaluations-year'>{evaluation?.year || "—"}</span>

                <p className='evaluation-ref'>Refs: {evaluation?.tpiRef}</p>

                <p className='evaluation-candidate'>
                  {evaluation?.datasHeader?.["Candidat.eName"]}
                </p>

                <p className='evaluation-expert1'>
                  {evaluation?.datasHeader?.Expert1Name}
                </p>

                <p className='evaluation-expert2'>
                  {evaluation?.datasHeader?.Expert2Name}
                </p>

                <p className='evaluation-company'>
                  {evaluation?.datasHeader?.EntrepriseName?.replace("ETML /", "")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className='evaluation-empty-state'>
            <h3>
              {isFiltering
                ? "Aucune évaluation ne correspond au filtre"
                : "Aucune évaluation enregistrée"}
            </h3>
            <p>
              {isFiltering
                ? "Essayez un autre nom d’entreprise ou retirez le filtre courant."
                : "Créez une nouvelle évaluation ou importez un fichier JSON pour alimenter la liste."}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
//#endregion

// Composant principal
function TpiEvalModule({ toggleArrow, isArrowUp }) {
  // État pour stocker les informations 'évaluation
  const [evaluations, setEvaluations] = useState([])
  const [isNewEval, setIsNewEval] = useState(false)
  const [loadTpiEval, setLoadTpiEval] = useState(null)
  const fileInputRef = useRef(null)
  const hasOpenEvaluation = isNewEval || loadTpiEval !== null
  const navigationLinks = MAIN_NAVIGATION_LINKS.filter(
    (link) => link?.to !== ROUTES.TPI_EVAL
  )

  const loadDataLocally = () => {
    try {
      return normalizeEvaluationList(
        readJSONListValue(STORAGE_KEYS.EVALUATION_DATA, [], ["evaluationData"])
      )
    } catch (error) {
      console.error("Error loading evaluation locally:", error.message)
      return []
    }
  }

  useEffect(() => {
    // Déclaration d'une fonction pour charger les données d'évaluation localement
    const fetchDataLocally = () => {
      try {
        // Charger les données d'évaluation localement
        const evaluationData = loadDataLocally()

        if (evaluationData) {
          // Mettre à jour l'état avec les données d'évaluation chargées
          setEvaluations(evaluationData)
        }
      } catch (error) {
        console.error("Error fetching evaluation data locally:", error.message)
      }
    }

    // Appeler la fonction pour charger les données d'évaluation localement
    fetchDataLocally()

    // Appeler la fonction pour récupérer les évaluations pour chaque année
    // fetchDataForYears();
  }, [])

  // Le useEffect suivant est utilisé pour déclencher la création 'une nouvelle évaluation
  useEffect(() => {
    if (loadTpiEval != null) {
      setIsNewEval(true)
    }
  }, [loadTpiEval])

  const handleNewEval = () => {
    setIsNewEval((previousState) => !previousState)

    if (loadTpiEval) {
      setLoadTpiEval(null)
    }
  }

  /**
   * handleFileSelect
   *
   * Cette fonction est déclenchée lorsque l'utilisateur sélectionne un fichier. Elle effectue les actions suivantes :
   * 1. Lit le fichier sélectionné en tant que texte.
   * 2. Parse le contenu JSON du fichier.
   * 3. Récupère les évaluations existantes du localStorage sous la clé "evaluationData".
   * 4. Vérifie que les données existantes sont bien un tableau.
   * 5. Ajoute la nouvelle évaluation au tableau des évaluations existantes.
   * 6. Stocke les données mises à jour dans le localStorage sous la clé "evaluationData".
   * 7. Affiche une notification toast pour informer l'utilisateur que les données ont été chargées.
   * 8. Rafraîchit la page pour s'assurer que les nouvelles données sont prises en compte.
   */
  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const parsedValue = JSON.parse(e.target.result)
          const importedEvaluations = Array.isArray(parsedValue)
            ? parsedValue
            : [parsedValue]

          importedEvaluations.forEach((evaluation) => {
            if (evaluation && typeof evaluation === "object") {
              upsertJSONListValue(
                STORAGE_KEYS.EVALUATION_DATA,
                evaluation,
                getEvaluationStorageKey,
                ["evaluationData"]
              )
            }
          })

          setEvaluations(
            readJSONListValue(STORAGE_KEYS.EVALUATION_DATA, [], ["evaluationData"])
          )

          toast.success("Données chargées dans le localStorage")
        } catch (error) {
          toast.error(
            "Erreur lors de l'analyse du fichier JSON: " + error.message
          )
        } finally {
          event.target.value = ""
        }
      }
      reader.readAsText(file)
    }
  }

  const handleLoadEval = () => {
    fileInputRef.current?.click()
  }

  const evaluationCount = Array.isArray(evaluations)
    ? evaluations.length
    : evaluations
      ? 1
      : 0
  const loadEvaluationLabel = 'Charger JSON'
  const createEvaluationLabel = hasOpenEvaluation ? 'Fermer le formulaire' : 'Nouvelle évaluation'

  return (
    <div id='tpiEval' className='page-with-toolbar'>
      <input
        ref={fileInputRef}
        type='file'
        id='fileInput'
        accept='.json'
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      <PageToolbar
        id='tools'
        className='tpi-eval-tools'
        eyebrow='Évaluation'
        title='Bibliothèque des évaluations'
        description='Créer, rouvrir, importer.'
        meta={
          <div className='tpi-eval-toolbar-meta'>
            <span className='page-tools-chip'>
              {evaluationCount} enreg.
            </span>
          </div>
        }
        actions={
          <div className='tpi-eval-toolbar-actions'>
            <button
              id='btnLoadEval'
              type='button'
              className='page-tools-action-btn secondary tpi-eval-action-btn icon-button'
              onClick={handleLoadEval}
              aria-label={loadEvaluationLabel}
              title='Importer un fichier JSON d’évaluation existant.'
            >
              <IconButtonContent
                label={loadEvaluationLabel}
                icon={UploadIcon}
                iconClassName='tpi-eval-action-icon'
              />
            </button>

            <button
              id='btnNewEval'
              type='button'
              className='page-tools-action-btn primary tpi-eval-action-btn icon-button'
              onClick={handleNewEval}
              aria-label={createEvaluationLabel}
              title={
                hasOpenEvaluation
                  ? 'Fermer le formulaire d’évaluation courant.'
                  : 'Créer une nouvelle évaluation vide.'
              }
            >
              <IconButtonContent
                label={createEvaluationLabel}
                icon={hasOpenEvaluation ? CloseIcon : PlusIcon}
                iconClassName='tpi-eval-action-icon'
              />
            </button>
          </div>
        }
        navigationLinks={navigationLinks}
        toggleArrow={toggleArrow}
        isArrowUp={isArrowUp}
        ariaLabel='Outils des évaluations TPI'
      />

      {hasOpenEvaluation && (
        <section id='newEvalForm' className='evaluation-form-shell'>
          <div className='evaluation-form-head'>
            <div className='evaluation-form-copy'>
              <span className='evaluation-form-kicker'>Saisie</span>
              <h2>{loadTpiEval ? 'Modifier une évaluation' : 'Nouvelle évaluation'}</h2>
              <p>
                Enregistrement local, liste mise à jour.
              </p>
            </div>
          </div>

          <div className='evaluation-form-body'>
            <NewEvaluationForm
              searchCandidat={getTpiByCandidate}
              loadTpiEval={loadTpiEval}
              setLoadTpiEval={setLoadTpiEval}
              onEvaluationSaved={(savedEvaluation) => {
                setEvaluations((prevEvaluations) => {
                  const currentEvaluations = Array.isArray(prevEvaluations) ? prevEvaluations : []
                  const savedKey = getEvaluationStorageKey(savedEvaluation)

                  if (!savedKey) {
                    return currentEvaluations
                  }

                  const nextEvaluations = currentEvaluations.some(
                    (evaluation) => getEvaluationStorageKey(evaluation) === savedKey
                  )
                    ? currentEvaluations.map((evaluation) =>
                        getEvaluationStorageKey(evaluation) === savedKey
                          ? savedEvaluation
                          : evaluation
                      )
                    : [...currentEvaluations, savedEvaluation]

                  return nextEvaluations
                })
              }}
              onEvaluationDeleted={(deletedId) => {
                setEvaluations((prevEvaluations) => {
                  const currentEvaluations = Array.isArray(prevEvaluations) ? prevEvaluations : []
                  return currentEvaluations.filter(
                    (evaluation) => String(evaluation?.id) !== String(deletedId)
                  )
                })
              }}
            />
          </div>
        </section>
      )}

      <EvaluationList
        evaluations={evaluations}
        setLoadTpiEval={setLoadTpiEval}
      />

      {/* Exemple : <AdminControls saveEvaluations={saveEvaluations} /> */}
    </div>
  )
}

export default TpiEvalModule
