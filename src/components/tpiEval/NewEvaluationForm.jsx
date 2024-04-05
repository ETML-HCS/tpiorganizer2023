import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSave, faSnowflake, faTrash } from '@fortawesome/free-solid-svg-icons'

import { PDFDocument, PdfJustify, StandardFonts } from 'pdf-lib'

import {
  HeaderLine,
  Header,
  ProfessionalCompetenciesDescription
} from './headerForm/HeaderForm'
import { Section, TablePoints } from './headerForm/Section'

import '../../css/tpiEval/newEvaluationForm.css'
import { el } from 'date-fns/locale'

// Pour accéder à la variable d'environnement REACT_APP_DEBUG
const debugMode = process.env.REACT_APP_DEBUG === 'true'

// Pour accéder à la variable d'environnement REACT_APP_API_URL
const apiUrl = debugMode
  ? process.env.REACT_APP_API_URL_TRUE
  : process.env.REACT_APP_API_URL_FALSE

function getFieldValue (inputName) {
  // Recherche de l'élément de formulaire par id
  const fieldById = document.getElementById(inputName)
  if (fieldById) {
    console.log('id', fieldById)
    return fieldById.innerText
  }

  // Recherche de l'élément de formulaire par nom
  const fieldByName = document.querySelector(`[name="${inputName}"]`)
  if (fieldByName) {
    return fieldByName.value
  }

  // Si aucun élément correspondant n'est trouvé
  console.log(
    `Le champ avec le nom ou l'identifiant "${inputName}" n'a pas été trouvé dans le formulaire.`
  )
  return null // Ou une autre valeur par défaut selon vos besoins
}

// Fonction pour peupler tous les champs du PDF 
// en fonction des données saisies dans le formulaire web
const populatePdfFields = async () => {
  try {
    // Appeler l'API pour récupérer le contenu du fichier PDF (obligatoire)
    const response = await fetch(`${apiUrl}/api/get-pdf`)
    const existingPdfBytes = await response.arrayBuffer()

    const copiedPdfBytes = new Uint8Array(existingPdfBytes) // Créer une copie du document PDF

    const pdfDoc = await PDFDocument.load(copiedPdfBytes) // Charger la copie du document PDF

    const form = pdfDoc.getForm() // Récupérer le formulaire du PDF

    const fields = form.getFields() // tous les champs

    const fieldMappings = {
      headerCandidat1: 'Candidat.eName',
      headerCandidat2: 'Candidat.eName',
      headerCandidat3: 'Candidat.eName',
      headerCandidat4: 'Candidat.eName',
      headerCandidat5: 'Candidat.eName',
      headerCandidat6: 'Candidat.eName',
      nameBoss: 'EntrepriseName',
      telBoss: 'EntreprisePhone',
      emailBoss: 'EntrepriseEmail',
      nameCandidat: 'Candidat.eName',
      telCandidat: 'Candidat.ePhone',
      emailCandidat: 'Candidat.eEmail',
      nameEpx1: 'Expert1Name',
      telExp1: 'Expert1Phone',
      emailExp1: 'Expert1Email',
      nameExp2: 'Expert2Name',
      telExp2: 'Expert2Phone',
      emailExp2: 'Expert2Email',
      A1pt: 'A1pt',
      A1just: 'A1just',
      A2pt: 'A2pt',
      A2just: 'A2just',
      A3pt: 'A3pt',
      A3just: 'A3just',
      A4pt: 'A4pt',
      A4just: 'A4just',
      A5pt: 'A5pt',
      A5just: 'A5just',
      A6pt: 'A6pt',
      A6just: 'A6just',
      A7pt: 'A7pt',
      A7just: 'A7just',
      A8pt: 'A8pt',
      A8just: 'A8just',
      A9pt: 'A9pt',
      A9just: 'A9just',
      A10pt: 'A10pt',
      A10just: 'A10just',
      A11pt: 'A11pt',
      A11just: 'A11just',
      A12pt: 'A12pt',
      A12just: 'A12just',
      A13pt: 'A13pt',
      A13just: 'A13just',
      A14pt: 'A14pt',
      A14just: 'A14just',
      A15pt: 'A15pt',
      A15just: 'A15just',
      A16pt: 'A16pt',
      A16just: 'A16just',
      A17pt: 'A17pt',
      A17just: 'A17just',
      A18pt: 'A18pt',
      A18just: 'A18just',
      A19pt: 'A19pt',
      A19just: 'A19just',
      A20pt: 'A20pt',
      A20just: 'A20just',
      Asomme: 'Asomme',
      B1pt: 'B1pt',
      B1just: 'B1just',
      B2pt: 'B2pt',
      B2just: 'B2just',
      B3pt: 'B3pt',
      B3just: 'B3just',
      B4pt: 'B4pt',
      B4just: 'B4just',
      B5pt: 'B5pt',
      B5just: 'B5just',
      B6pt: 'B6pt',
      B6just: 'B6just',
      B7pt: 'B7pt',
      B7just: 'B7just',
      B8pt: 'B8pt',
      B8just: 'B8just',
      B9pt: 'B9pt',
      B9just: 'B9just',
      B10pt: 'B10pt',
      B10just: 'B10just',
      Bsomme: 'Bsomme',
      C1pt: 'C1pt',
      C1just: 'C1just',
      C2pt: 'C2pt',
      C2just: 'C2just',
      C3pt: 'C3pt',
      C3just: 'C3just',
      C4pt: 'C4pt',
      C4just: 'C4just',
      C5pt: 'C5pt',
      C5just: 'C5just',
      C6pt: 'C6pt',
      C6just: 'C6just',
      C7pt: 'C7pt',
      C7just: 'C7just',
      C8pt: 'C8pt',
      C8just: 'C8just',
      C9pt: 'C9pt',
      C9just: 'C9just',
      C10pt: 'C10pt',
      C10just: 'C10just',
      Csomme: 'Csomme',
      Contraction_Asomme: 'Contraction_Asomme',
      Contraction_Bsomme: 'Contraction_Bsomme',
      Contraction_Csomme: 'Contraction_Csomme',
      Contraction_ABCsomme: 'Contraction_ABCsomme',
      Contraction_note: 'Contraction_note',
      remarque: 'remarque'
    }

    // Parcourir tous les champs du formulaire web
    for (const fieldName in fieldMappings) {
      // Récupérer le nom du champ correspondant dans le formulaire PDF
      const pdfFieldName = fieldName

      // Récupérer le champ du formulaire PDF
      const pdfField = fields.find(field => field.getName() === pdfFieldName)

      // Récupérer le nom du champ du formulaire web
      const inputName = fieldMappings[fieldName]

      // Récupérer la valeur du champ du formulaire web
      const fieldValue = getFieldValue(inputName)

      // Modifier la taille de la police du champ PDF
      const fontSize = 12 // Taille de police souhaitée (en points)
      pdfField.setFontSize(fontSize) // Définir la taille de police

      // Remplir le champ du formulaire PDF avec la valeur du champ du formulaire web
      pdfField.setText(fieldValue)

      // Rendre le champ PDF en lecture seule
      pdfField.enableReadOnly()

      // Afficher un message indiquant que le champ PDF a été rempli avec succès
      console.log(
        `Le champ PDF "${pdfFieldName}" a été rempli avec la valeur : ${fieldValue}`
      )
    }

    // Enregistrer le PDF modifié dans un nouveau buffer
    const modifiedPdfBytes = await pdfDoc.save()

    // Convertir les bytes du PDF en blob
    const pdfBlob = new Blob([modifiedPdfBytes], { type: 'application/pdf' })

    // Créer une URL à partir du blob
    const pdfUrl = URL.createObjectURL(pdfBlob)
    // Ouvrir le PDF dans une nouvelle fenêtre
    window.open(pdfUrl)
  } catch (error) {
    console.error('Erreur lors de la récupération du document PDF:', error)
  }
}

function extractDataFromElements (attributeName) {
  const elementsWithData = document.querySelectorAll(`[${attributeName}]`)
  const datas = {}

  elementsWithData.forEach(element => {
    const attributeValue = element.getAttribute(attributeName)

    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      const inputValue = element.value
      datas[attributeValue] = inputValue
    } else {
      datas[attributeValue] = null
    }
  })

  return datas
}

function showPopup (textHTML) {
  // Récupérer l'élément popup et son contenu
  const popup = document.getElementById('popup')
  const popupContent = document.getElementById('popup-content')

  // Mettre à jour le contenu de la popup
  popupContent.innerHTML = textHTML

  // Afficher la popup
  popup.style.display = 'block'

  popup.onclick = () => {
    popup.style.display = 'none'
  }
}

function NewEvaluationForm ({ addEvaluation,searchCandidat }) {
  const [data, setData] = useState()

  const interval = 120000

  useEffect(() => {
    const saveData = () => {
      if (data) {
        try {
          const jsonData = JSON.stringify(data)
          localStorage.setItem('newEvalForm', jsonData)
          console.log('Données sauvegardées avec succès:', jsonData)
        } catch (error) {
          console.error(
            'Erreur lors de la sauvegarde des données JSON :',
            error
          )
        }
      } else {
        console.log('Aucune données à sauvegarder.')
      }
    }

    const saveDataInterval = setInterval(saveData, interval)

    const loadData = () => {
      const savedData = localStorage.getItem('newEvalForm')
     
      if (savedData !== null && savedData !== undefined) {
        try {
          const parsedData = JSON.parse(savedData)
          console.log('Données récupérées :', parsedData)
          setData(parsedData)
        } catch (error) {
          console.error("Erreur lors de l'analyse des données JSON :", error)
        }
      } else {
        console.log('Aucune donnée trouvée dans le localStorage.')
      }
    }

    loadData()

    return () => clearInterval(saveDataInterval)
  }, [data, interval])

  // json =>  partie(string) maxPoints(int): pointsObtenus(int):
  const [resultsOfParts, setResultsOfParts] = useState([
    {
      rowTitle: 'Partie A',
      maxPoints: 60,
      pointsObtenus: 0
    },
    {
      rowTitle: 'Partie B',
      maxPoints: 30,
      pointsObtenus: 0
    },
    {
      rowTitle: 'Partie C',
      maxPoints: 30,
      pointsObtenus: 0
    },
    {
      rowTitle: 'Somme de A + B + C',
      maxPoints: 120,
      pointsObtenus: 0
    },
    {
      rowTitle: 'Note (5 * somme / 120) + 1',
      pointsObtenus: 0
    }
  ])

  // json => title(string) questions[{idCritere,question,pt,justification}]
  const questionOfList = {
    A: {
      title: 'Partie A : Compétences professionnelles',
      questions: [
        {
          idCritere: 'A1',
          question: 'Gestion de projet et planification',
          help: 'Les mandats complexes sont résolus à l’aide d’une méthode de gestion de projets. Pour les travaux pratiques également, il convient d’analyser les relations, de planifier le système cible, de comparer les variantes et d’élaborer un plan d’action.<br><h3>Niveau de qualité 3</h3>1. La méthode de gestion de projet choisie est citée dans le rapport. La méthode est appropriée au mandat.<br>2. La méthode de gestion de projet a été correctement mise en œuvre en pratique durant le TPI.<br>3. L’utilisation correcte de la méthode de projet est visible dans la documentation.<br>4. Le mandat du cahier des charges a été analysé de manière approfondie et affiné. Les 4 points sont remplis entièrement<br><h3>Niveau de qualité 2</h3>Trois des points mentionnés sont accomplis<br><h3>Niveau de qualité 1</h3>Deux des points mentionnés sont accomplis<br><h3>Niveau de qualité 0</h3> Uniquement un ou aucun des points mentionnés ne sont accomplis. ',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A2',
          question: 'Acquisition du savoir',
          help: "Les informations à disposition sont aussi multiples que variées. Le ou la candidat-e peut sélectionner les supports et les canaux d’informations en fonction de la tâche à exécuter, évaluer les informations et les exploiter conformément au but recherché.<br><h3>Niveau de qualité 3</h3>1. Le journal de travail, le rapport de projet ou le protocole des discussions avec le supérieur professionnel démontrent clairement l’acquisition de connaissances<br>2. Sélectionne les sources d'informations alignées aux besoins de ses tâches.<br>3. Choisit judicieusement les sources d'informations et les utilise (transfert du savoir).<br>4. Les sources sont clairement référencées et les parties prenantes au projet peuvent facilement reconstruire le processus d’acquisition de connaissances.<br><h3>Niveau de qualité 2</h3>Trois des critères d'évaluation précités sont remplis.<br><h3>Niveau de qualité 1</h3>Deux des critères d'évaluation précités sont remplis.<br><h3>Niveau de qualité 0</h3> Moins de deux des critères d'évaluation sont remplis. ",
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A3',
          question: 'Calendrier / planification',
          help: "Afin de pouvoir contrôler l’avancement du travail et d’identifier suffisamment tôt des écarts par rapport au calendrier fixé, une comparaison régulière est effectuée entre la situation actuelle et la situation escomptée.Niveau de qualité 3<br>1. Un axe temporel absolu a été défini (Date)<br>2. L'axe temporel est structuré de manière raisonnable (Blocs de 2 ou 4 heures)<br>3. Des activités appropriées ont été formées. Elles couvrent l'entier du travail à réaliser.<br>4. L’ordre de déroulement des tâches est judicieux.<br>5. La répartition du temps des activités est planifiée de manière réaliste.<br>6. La comparaison entre la planification initiale et l’état actuel est transparente et correcte. Les 6 points sont remplis et correctement décrits<br><h3>Niveau de qualité 2</h3>Quatre ou cinq des points mentionnés sont remplis<br><h3>Niveau de qualité 1</h3>Deux ou trois des points mentionnés sont remplis<br><h3>Niveau de qualité 0</h3> Un seul ou aucun des points mentionnés n’est rempli.",
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A4',
          question: 'Compréhension conceptuelle',
          help: 'L’énoncé de la tâche, son contexte et le développement de solutions peuvent être présentés de façon simplifiée à l’aide de concepts ou de modèles. A cet égard, les détails sont sciemment laissés de côté et seul l’essentiel est montré (p. ex. points clés, lignes directrices, obstacles).<br><h3>Niveau de qualité 3</h3>1. Définit des concepts ou des modèles structurants<br>2. Les principaux aspects structurants du mandat sont mis en évidence.<br>3. Démontre (dans le rapport du TPI, lors de la présentation ou dans le cadre d’une discussion technique)<br>4. Connait bien les interactions entre les parties/sous-systèmes du travail a réaliser.<br><h3>Niveau de qualité 2</h3>Les deux premiers points ainsi que les points trois ou quatre sont remplis.<br><h3>Niveau de qualité 1</h3>Les deux premiers points sont remplis<br><h3>Niveau de qualité 0</h3> Le point 1 n’est pas rempli ',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A5',
          question:
            'Environnement de projet : limites du système / interfaces avec le monde extérieur',
          help: "L’intégration du mandat dans son environnement est documentée.<br><h3>Niveau de qualité 3</h3>Le candidat connait les limites de l'environnement de son projet et peut les décrire. Il connait en détail les différentes interfaces et les a documentées.<br><h3>Niveau de qualité 2</h3>Le candidat connaît les interfaces mais ne sait que partiellement ce qu'elles engendrent ou elles ne sont que partiellement documentées.<br><h3>Niveau de qualité 1</h3>Le candidat se représente vaguement l'environnement et ne connaît pas les interfaces ou ne les a quasiment pas documentées.<br><h3>Niveau de qualité 0</h3> Le candidat ne porte attention qu'à son projet et ne s'inquiète/ne sait pas ce qui se passe dans l'environnement proche du projet ou n’a rien documenté. ",
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A6',
          question: 'Test de la solution (planification et exécution)',
          help: 'Chaque solution doit être testée avant sa remise. Un concept de tests est élaboré à cet effet. Il décrit ce qui va être testé et comment.<br><h3>Niveau de qualité 3</h3>1. Le concept de test contient le périmètre (environnement)<br>2. ... un scenario de test (script) comprenant des cas de tests pertinents<br>3. ... les moyens et les méthodes de tests utilisées<br>4. ... les résultats attendus<br>5. Les tests décrits ci-dessus ont tous été effectués<br><h3>Niveau de qualité 2</h3>Quatre des aspects cités sont bien remplis.<br><h3>Niveau de qualité 1</h3>Trois des aspects sont bien remplis ou la solution a été vérifiée sans concept de tests.<br><h3>Niveau de qualité 0</h3> Moins de trois aspects sont bien remplis. ',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A7',
          question:
            'Volonté de performance / engagement / attitude au travail / mise en œuvre',
          help: 'Le ou la candidat-e fait montre de sa volonté de performance non seulement par sa persévérance et sa flexibilité, mais aussi en traitant de façon adéquate les résultats de son travail dans le cadre du mandat confié. Les connaissances acquises à l’école et en entreprise sont utilisées dans différentes situations et permettent d’entreprendre des actions selon les objectifs visés.<br><h3>Niveau de qualité 3</h3>L’élaboration des résultats du travail montre que le candidat réfléchit au- delà de la donnée du problème et complète les éléments manquants ce qui montre qu’il comprend la tâche dans son ensemble. Le candidat utilise son temps et ses compétences pour obtenir des résultats optimaux dans son travail. Il connaît les bases théoriques des techniques utilisées et a pu les utiliser de la meilleure manière dans le cadre du TPI. Son approche des problématiques démontre une démarche ciblée de l’objectif à atteindre.<br><h3>Niveau de qualité 2</h3>L’élaboration des résultats du travail montre que le candidat réfléchit au- delà de la donnée du problème et complète les éléments manquants ce qui montre qu’il comprend la tâche dans son ensemble. Le candidat utilise son temps et ses compétences pour obtenir de bons résultats dans son travail. Il connaît les bases théoriques des techniques utilisées mais ne les utilise pas toujours de manière adéquate. Son approche des problématiques ne démontre pas toujours une démarche ciblée de l’objectif a atteindre.<br><h3>Niveau de qualité 1</h3>L’élaboration des résultats démontre que le candidat se donne de la peine à réaliser la donnée du problème à satisfaction. Le candidat utilise son temps et ses compétences pour obtenir des résultats de travail suffisants. Il oublie parfois de porter attention au temps qui s’écoule et se satisfait de résultats se trouvant à un stade de réalisation précoce. Les bases théoriques néccessaires sont lacunaires et rendent difficile l’atteinte d’une approche ciblée de la démarche pour atteindre l’objectif.<br><h3>Niveau de qualité 0</h3> Dans l’élaboration des résultats du travail il est difficile de vérifier que le candidat s’est donné de la peine pour accomplir la tâche de manière satisfaisante. Il n’investit du temps et n’utilise ses compétences que sur demande et fournit des résultats limite satisfaisants ou de qualité discutable. Il oublie de porter attention au temps écoulé ou se satisfait de résultats qui nécessitent d’être retravaillés à plusieurs reprises. Les connaissances théoriques sont lacunaires ou absentes. ',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A8',
          question: 'Autonomie de travail',
          help: 'Le ou la candidat-e se procure et élabore les informations requises, cherche des variantes de solution et prend des décisions de façon compétente et professionnelle. Il ou elle répartit son travail et détermine ainsi le bon déroulement de son TPI.<br><h3>Niveau de qualité 3</h3>1. Sait distinguer l’essentiel du superflu et établir des priorités<br>2. Il utilise les moyens dont il dispose et arrive à les utiliser de manière autonome pour obtenir les informations nécessaires.<br>3. N’a besoin d’aucun soutien injustifié d’autres professionnels.<h3>Niveau de qualité 2</h3>Deux des points mentionnés sont remplis.<br><h3>Niveau de qualité 1</h3>Un des points est rempli ou les trois sont en partie remplis.<br><h3>Niveau de qualité 0</h3> Aucun des points n’est rempli. Ou le candidat ne demande aucune information ou aide supplémentaire, bien que cela aurait été nécessaire pour la progression et la réussite de son travail. ',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A9',
          question: 'Connaissances professionnelles et application adéquate',
          help: 'L’expert se distingue du néophyte dans la mesure où ses actions sont guidées par l’application cohérente du savoir acquis en fonction d’une situation donnée. Il ne sait pas seulement ce qu’il fait, mais aussi pourquoi et comment procéder correctement. Un travail efficient exige de bien connaître les méthodes et les produits requis et de maîtriser leur utilisation.<br><h3>Niveau de qualité 3</h3>Le candidat a démontré tout au long de son travail, qu’il dispose des connaissances professionnelles de base et des connaissances techniques nécessaires à ses tâches et qu’il les applique de façon cohérente dans chaque situation. Le candidat applique avec assurance les compétences nécessaires à l’utilisation des produits mis en oeuvre pour atteindre l’objectif fixé et le fait de manière routinière et sans aucune erreur.<br><h3>Niveau de qualité 2</h3>Des déclarations incertaines ou imprécises de terminologies ou connaissances professionnelles démontrent des faiblesses. Le candidat n’utilise les connaissances nécessaires aux produits utilisés uniquement au moyen de détours ou de recherches et la mise en oeuvre est parfois fastidieuse et il ne sait pas comment les utiliser.<br><h3>Niveau de qualité 1</h3>Le candidat élude la question ou fait des déclarations erronées. Il répond par des déclarations basées sur des préjugés irréfléchis ou des opinions personnelles qui démontrent de grandes lacunes au niveau des connaissances professionnelles. Le candidat utilise les produits mis en œuvre de manière incomplète, incertaine et superficielle. Il n’utilise parfois pas les bons produits qui ne sont pas adaptés pour l’atteinte de l’objectif.<br><h3>Niveau de qualité 0</h3> Le candidat ne connait pas les bases techniques nécessaires à la réalisation de son travail ou il ne fait pas le lien avec ce qu’il a appris. Le candidat ne connait pas les produits mis en oeuvre, ce qui se ressent par une démarche très incertaine. Il ne trouve pas les fonctionnalités demandées ou uniquement après une longue recherche. Il utilise les produits nécessaires de manière erronée ou ne les utilise pas du tout. ',

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A10',
          question: 'Utilisation du jargon / terminologie métier appropriée',
          help: 'Le vocabulaire technique sert à expliquer des situations ou contenus spécifiques. L’utilisation de termes spécialisés est conforme à leur acception et correcte. Le ou la candidat-e est à même d’expliquer de façon compréhensible les termes techniques et acronymes utilisés.<br><h3>Niveau de qualité 3</h3>1. Le candidat utilise systématiquement la terminologie appropriée et usuelle de la profession pour expliquer les situations spécifiques.<br>2. Dans ce cadre, les termes techniques sont utilisés correctement et de manière précise.<br>3. Les termes et acronymes sont utilisés au bon endroit et peuvent être expliqués par le candidat sur demande.<br>4. L’explication des termes techniques est irréprochable.<br><h3>Niveau de qualité 2</h3>Trois des points mentionnés sont remplis.<br><h3>Niveau de qualité 1</h3>Deux des points mentionnés sont remplis ou les quatre sont remplis partiellement.<br><h3>Niveau de qualité 0</h3> Un seul ou aucun des points mentionnés n’est rempli. ',

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A11',
          question: 'Procédure de travail et méthode professionnelle',
          help: 'La bonne procédure de travail et une méthode professionnelle appropriée sont appliquées aux différentes tâches à effectuer.<br><h3>Niveau de qualité 3</h3>Choisit des méthodes et techniques appropriées aux tâches concernées. Celles-ci sont mise en œuvre correctement et dans leur intégralité.<br><h3>Niveau de qualité 2</h3>Les méthodes sont appropriées et correctes mais mises en œuvre de manière incomplète.<br><h3>Niveau de qualité 1</h3>Les méthodes sont appropriées mais pas mises en œuvre correctement.<br><h3>Niveau de qualité 0</h3> Pas de choix ou choix inapproprié de méthodes et techniques. ',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A12',
          question: 'Organisation des résultats du travail',
          help: 'Un classement des documents systématique et bien organisé permet d’exploiter au mieux les résultats du travail (documentation, code source, manuels, etc.). Afin de pouvoir accéder en tout temps aux résultats, le ou la candidat-e organise et sauvegarde ses documents. Une organisation correcte se reflétera ensuite dans la documentation.<br><h3>Niveau de qualité 3</h3>1. La gestion des versions des résultats du travail est correcte et reflète bien l’état de développement et permet de retrouver chaque version précédente.<br>2. L’organisation des documents permet de retrouver et de disposer de chaque version différente.<br>3. Les résultats du travail (documentation, code, manuels, etc.) sont enregistrés au moins une fois par jour.<br>4. La restauration des documents enregistrée est assurée.<br>5. L’ergonomie de la place de travail (physique et informatique) a été prise en compte. Elle est mise en place en fonction des besoins tout au long du TPI.<br>6. Les points 1 à 5 sont tous décrits et retraçables dans le rapport du TPI.<br><h3>Niveau de qualité 2</h3>Cinq des points mentionnés sont remplis.<br><h3>Niveau de qualité 1</h3>Quatre des points mentionnés sont remplis.<br><h3>Niveau de qualité 0</h3> Trois points mentionnés ou moins sont remplis. ',

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A13',
          question: 'Performance',
          help: "L’étendue et le degré de finition du produit correspondent au temps investi.<br><h3>Niveau de qualité 3</h3>L'efficacité/la performance du candidat ainsi que l’étendue et le dégré de finition/réalisation du produit correspondent au résultat attendu d'un professionnel du métier. Tout le potentiel à retirer de la donnée du problème du TPI ressort clairement et a été réalisé dans le temps imparti par le cahier des charges.<br><h3>Niveau de qualité 2</h3>L’étendue et le degré de finition/réalisation du produit correspondent au résultat d’un professionnel du métier. Le potentiel de la donnée du problème du TPI a été correctement réalisé dans les temps.<br><h3>Niveau de qualité 1</h3>L’étendue et le degré de finition/réalisation du produit correspondent partiellement au résultat attendu d’un professionnel du métier. Le potentiel de la donnée du problème n’a été que partiellement réalisé dans le temps imparti.<br><h3>Niveau de qualité 0</h3> L’étendue et le degré de finition/réalisation du produit ne correspondent en grande partie pas au résultat attendu d’un professionnel. Le potentiel de la donnée du problème n’a pas été mis en oeuvre dans le temps imparti ou que dans certains cas. ",

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A14',
          question:
            'Point techniques évalués spécifiques au projet (Point 8.1 du CdC)',
          help: "Le candidat a-t-il répondu/fait l'ensemble des points techniques évalués spécifiques au projet de manière correcte et suffisamment professionnelle? L’étendue et le degré de finition du produit correspondent au temps investi.<br><h3>Niveau de qualité 3</h3>Le candidat a traité de manière professionnelle le point technique. Toutes les parties du point sont fournies correctement et avec compétences professionnelles. Le candidat peut également répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 2</h3>Le candidat a négligé un ou plusieurs aspects du point technique peu important ou un aspect d'importance cruciale n'est pas suffisamment éclairci. Le candidat peut également principalement répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 1</h3>Le candidat a négligé un aspect du point technique de grande importance ou des aspects d'importance cruciale ne sont pas suffisamment éclaircis. Le candidat fournit souvent des réponses erronées ou imprécises.<br><h3>Niveau de qualité 0</h3> Le candidat n'a pas répondu correctement au point technique. ",

          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A15',
          question:
            'Point techniques évalués spécifiques au projet (Point 8.2 du CdC)',
          help: "Le candidat a-t-il répondu/fait l'ensemble des points techniques évalués spécifiques au projet de manière correcte et suffisamment professionnelle? L’étendue et le degré de finition du produit correspondent au temps investi.<br><h3>Niveau de qualité 3</h3>Le candidat a traité de manière professionnelle le point technique. Toutes les parties du point sont fournies correctement et avec compétences professionnelles. Le candidat peut également répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 2</h3>Le candidat a négligé un ou plusieurs aspects du point technique peu important ou un aspect d'importance cruciale n'est pas suffisamment éclairci. Le candidat peut également principalement répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 1</h3>Le candidat a négligé un aspect du point technique de grande importance ou des aspects d'importance cruciale ne sont pas suffisamment éclaircis. Le candidat fournit souvent des réponses erronées ou imprécises.<br><h3>Niveau de qualité 0</h3> Le candidat n'a pas répondu correctement au point technique. ",

          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A16',
          question:
            'Point techniques évalués spécifiques au projet (Point 8.3 du CdC)',
          help: "Le candidat a-t-il répondu/fait l'ensemble des points techniques évalués spécifiques au projet de manière correcte et suffisamment professionnelle? L’étendue et le degré de finition du produit correspondent au temps investi.<br><h3>Niveau de qualité 3</h3>Le candidat a traité de manière professionnelle le point technique. Toutes les parties du point sont fournies correctement et avec compétences professionnelles. Le candidat peut également répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 2</h3>Le candidat a négligé un ou plusieurs aspects du point technique peu important ou un aspect d'importance cruciale n'est pas suffisamment éclairci. Le candidat peut également principalement répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 1</h3>Le candidat a négligé un aspect du point technique de grande importance ou des aspects d'importance cruciale ne sont pas suffisamment éclaircis. Le candidat fournit souvent des réponses erronées ou imprécises.<br><h3>Niveau de qualité 0</h3> Le candidat n'a pas répondu correctement au point technique. ",

          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A17',
          question:
            'Point techniques évalués spécifiques au projet (Point 8.4 du CdC)',
          help: "Le candidat a-t-il répondu/fait l'ensemble des points techniques évalués spécifiques au projet de manière correcte et suffisamment professionnelle? L’étendue et le degré de finition du produit correspondent au temps investi.<br><h3>Niveau de qualité 3</h3>Le candidat a traité de manière professionnelle le point technique. Toutes les parties du point sont fournies correctement et avec compétences professionnelles. Le candidat peut également répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 2</h3>Le candidat a négligé un ou plusieurs aspects du point technique peu important ou un aspect d'importance cruciale n'est pas suffisamment éclairci. Le candidat peut également principalement répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 1</h3>Le candidat a négligé un aspect du point technique de grande importance ou des aspects d'importance cruciale ne sont pas suffisamment éclaircis. Le candidat fournit souvent des réponses erronées ou imprécises.<br><h3>Niveau de qualité 0</h3> Le candidat n'a pas répondu correctement au point technique. ",

          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A18',
          question:
            'Point techniques évalués spécifiques au projet (Point 8.5 du CdC)',
          help: "Le candidat a-t-il répondu/fait l'ensemble des points techniques évalués spécifiques au projet de manière correcte et suffisamment professionnelle? L’étendue et le degré de finition du produit correspondent au temps investi.<br><h3>Niveau de qualité 3</h3>Le candidat a traité de manière professionnelle le point technique. Toutes les parties du point sont fournies correctement et avec compétences professionnelles. Le candidat peut également répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 2</h3>Le candidat a négligé un ou plusieurs aspects du point technique peu important ou un aspect d'importance cruciale n'est pas suffisamment éclairci. Le candidat peut également principalement répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 1</h3>Le candidat a négligé un aspect du point technique de grande importance ou des aspects d'importance cruciale ne sont pas suffisamment éclaircis. Le candidat fournit souvent des réponses erronées ou imprécises.<br><h3>Niveau de qualité 0</h3> Le candidat n'a pas répondu correctement au point technique. ",

          fieldText: '',

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A19',
          question:
            'Point techniques évalués spécifiques au projet (Point 8.6 du CdC)',
          help: "Le candidat a-t-il répondu/fait l'ensemble des points techniques évalués spécifiques au projet de manière correcte et suffisamment professionnelle? L’étendue et le degré de finition du produit correspondent au temps investi.<br><h3>Niveau de qualité 3</h3>Le candidat a traité de manière professionnelle le point technique. Toutes les parties du point sont fournies correctement et avec compétences professionnelles. Le candidat peut également répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 2</h3>Le candidat a négligé un ou plusieurs aspects du point technique peu important ou un aspect d'importance cruciale n'est pas suffisamment éclairci. Le candidat peut également principalement répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 1</h3>Le candidat a négligé un aspect du point technique de grande importance ou des aspects d'importance cruciale ne sont pas suffisamment éclaircis. Le candidat fournit souvent des réponses erronées ou imprécises.<br><h3>Niveau de qualité 0</h3> Le candidat n'a pas répondu correctement au point technique. ",

          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A20',
          question:
            'Point techniques évalués spécifiques au projet (Point 8.7 du CdC)',
          help: "Le candidat a-t-il répondu/fait l'ensemble des points techniques évalués spécifiques au projet de manière correcte et suffisamment professionnelle? L’étendue et le degré de finition du produit correspondent au temps investi.<br><h3>Niveau de qualité 3</h3>Le candidat a traité de manière professionnelle le point technique. Toutes les parties du point sont fournies correctement et avec compétences professionnelles. Le candidat peut également répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 2</h3>Le candidat a négligé un ou plusieurs aspects du point technique peu important ou un aspect d'importance cruciale n'est pas suffisamment éclairci. Le candidat peut également principalement répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 1</h3>Le candidat a négligé un aspect du point technique de grande importance ou des aspects d'importance cruciale ne sont pas suffisamment éclaircis. Le candidat fournit souvent des réponses erronées ou imprécises.<br><h3>Niveau de qualité 0</h3> Le candidat n'a pas répondu correctement au point technique. ",

          fieldText: '',
          pt: 0,
          justification: ''
        }
      ]
    },
    B: {
      title: 'Partie B : Documentation / rapport du TPI',
      questions: [
        {
          idCritere: 'B1',
          question: 'Résumé du rapport du TPI / version succincte de la doc.',
          help: "Un résumé conceptuel du travail effectué et du résultat obtenu permet aux lecteurs impliqués dans le projet (supérieur, experts) de mieux comprendre le travail fourni. La version succincte ne contient pas de graphiques, mais uniquement du texte.  <br> <h3>Niveau de qualité 3 </h3>1. Le résumé est destiné à un public professionnel de la branche (langage, style, niveau de détail et termes techniques utilisés)<br>2. Il contient trois paragraphes : Situation de départ, mise en œuvre, résultats.  <br>3. Le résumé contient pour l'ensemble des points précités que des aspects essentiels.<br>4. Il n'est pas plus long qu'une page A4 de texte et ne contient pas de graphiques  <br> <h3>Niveau de qualité 2 </h3>Trois des points sont remplis.  <br> <h3>Niveau de qualité 1</h3>Deux des points sont remplis.  <br> <h3>Niveau de qualité 0</h3>Moins de deux points sont remplis.",

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B2',
          question: 'Tenue du journal de travail',
          help: "Le journal de travail sert à documenter les activités quotidiennes, les problèmes rencontrés ainsi que les éventuels travaux imprévus, aides et heures supplémentaires. Il est clairement structuré et se réfère au plan du projet.  <br> <h3>Niveau de qualité 3 </h3>1. La structure et la présentation sont claires. 2. Toutes les activités planifiées ainsi que les imprévus et les heures supplémentaires y sont mentionnés. 3. Les succès et les échecs sont mentionnés. 4. Le travail journalier et son appréciation critique y figurent.  <br> <h3>Niveau de qualité 2 </h3>Trois des points d'évaluation sont remplis.  <br> <h3>Niveau de qualité 1</h3>Deux points d'évaluation sont remplis.  <br> <h3>Niveau de qualité 0</h3>Moins de deux exigences sont remplies ou l'aide de la part d'une personne tierce n'est pas mentionnée ou de toute évidence les heures supplémentaires effectuées ne sont pas mentionnées. ",

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B3',
          question: 'Capacité de réflexion',
          help: "La réflexion est la capacité de la personne en formation d'analyser la manière dont elle a exécuté la tâche dans son ensemble et d'identifier les points où elle pourrait s'améliorer. Ces constats sont documentés dans le journal de travail et dans la conclusion.  <br> <h3>Niveau de qualité 3 </h3>1. Le rapport contient une réflexion critique du candidat sur l'approche qu'il a suivie et les résultats obtenus.<br>2. Compare les variantes de solutions possibles ou justifie pourquoi il n'y a pas de variantes.  <br>3. Tire ses propres conclusions qui reflètent sa réflexion.<br>4. Le mot de la fin/la conclusion comprend un bilan personnel.  <br> <h3>Niveau de qualité 2 </h3>Trois des points cités sont remplis.  <br> <h3>Niveau de qualité 1</h3>Deux des points cités sont remplis ou les quatre points sont partiellement remplis.  <br> <h3>Niveau de qualité 0</h3>Un ou aucun des points mentionnés n'est rempli. ",

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B4',
          question: 'Structure',
          help: "Une documentation est compréhensible lorsqu'elle est conçue de manière claire pour un spécialiste extérieur. Les diverses étapes suivent un fil rouge et présentent une structure cohérente.  <br> <h3>Niveau de qualité 3 </h3>1. La documentation est divisée en chapitres en rapport avec les thèmes et les points principaux du projet.<br>2. La documentation est clairement structurée et les titres utilisés contiennent un contenu approprié.  <br>3. L'ordre des thèmes traités dans la documentation est bien coordonné.<br>4. La conception des titres, textes et graphiques simplifie la lecture du rapport et ne l'entrave en aucun cas.  <br> <h3>Niveau de qualité 2 </h3>Trois des points cités sont remplis.  <br> <h3>Niveau de qualité 1</h3>Deux des points cités sont remplis ou les quatre points sont partiellement remplis.  <br> <h3>Niveau de qualité 0</h3>Un ou aucun des points cités n'est rempli.",

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B5',
          question: 'Pertinence',
          help: 'L\'auteur de la documentation va à l\'essentiel en fournissant toutes les informations pertinentes sans entrer dans des détails superflus.  <br> <h3>Niveau de qualité 3 </h3>Le texte du rapport du TPI est conçu de façon optimale et les informations sont concises et les plus pertinentes possibles. Il comprend une suite logique et ne contient pas plus de détails que nécessaire à une exception près si cela est nécessaire à la compréhension d\'un thème. Il ne contient pas d\'informations superflues de ""remplissage"".  <br> <h3>Niveau de qualité 2 </h3>Le texte du rapport contient au maximum pour deux points (sous-chapitres) les faiblesses suivantes : Texte trop long (remplissage) / Texte redondant / texte non pertinent / des informations importantes manquent / des informations nécessaires à comprendre des explications sont manquantes.  <br> <h3>Niveau de qualité 1</h3>Le texte du rapport contient les faiblesses suivantes pour trois points au maximum : Texte trop long (remplissage) / Texte redondant / texte non pertinent / des informations importantes manquent / des informations nécessaires à comprendre des explications sont manquantes.  <br> <h3>Niveau de qualité 0</h3>Le texte du rapport contient au maximum pour plus de trois points (sous- chapitres) les faiblesses suivantes : Texte trop long (remplissage) / Texte redondant / texte non pertinent / des informations importantes manquent / des informations nécessaires à comprendre des explications sont manquantes. ',

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B6',
          question: 'Respect des prescriptions formelles du rapport du TPI',
          help: "Il s'agit ici d'évaluer le caractère exhaustif de la documentation du point de vue formel, conformément aux prescriptions de l'expert en chef cantonal.  <br> <h3>Niveau de qualité 3 </h3>1. La mise en page et le contenu du PDF et du fichier Word/de la version imprimée sont identiques<br>2. Le rapport est séparé en deux parties distinctes. Le code source est annexé.  <br>3. Le rapport contient : L'organisation du projet, le journal, le planning.  <br>4. Le rapport du TPI contient une table des matières à jour (num. page etc.).<br>5. Le rapport contient une liste des sources et références complète et structurée.  <br>6. Le rapport du TPI contient un entête et un pied de page sur toutes les pages comprenant la date d'impression et le nom du candidat.<br>7. Le rapport du TPI contient un glossaire trié alphabétiquement comprenant les termes spécifiques au TPI.  <br> <h3>Niveau de qualité 2 </h3>Le point 1 et 5 autres points sont entièrement remplis.  <br> <h3>Niveau de qualité 1</h3>Le point 1 et au moins 3 autres sont remplis.  <br> <h3>Niveau de qualité 0</h3>Le niveau de qualité 1 n'est pas atteint ou moins de cinq points sont atteints.",

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B7',
          question: 'Expression écrite et style / orthographe et grammaire',
          help: "L'expression écrite est un vecteur essentiel de transmission et de compréhension des informations et des résultats. Lorsqu'ils sont utilisés à bon escient, de manière correcte et en adéquation avec les destinataires (p. ex. département informatique, spécialistes, tierces personnes), les termes techniques constituent une aide précieuse à la communication pour les informaticiens. L'orthographe influe fortement sur la lisibilité et la compréhensibilité du texte. Un travail soigneux et l'utilisation appropriée des dictionnaires et des outils de correction grammaticale permettent d'éviter les fautes d'orthographe.  <br> <h3>Niveau de qualité 3 </h3>	1.	Le langage utilisé est clair et compréhensible (structure des phrases, ordre des mots utilisés) dans l'entier du rapport du TPI, écrit dans un style fluide avec des phrases complètes et parfaitement formulées.   <br>	2.	Les termes techniques sont utilisés correctement et dans le registre approprié.   <br>	3.	Le rapport du TPI contient peu d'erreur d'orthographe ou de grammaire.   <br>	4.	Les correcteurs électroniques d'orthographe et de grammaire ont été utilisés.   <h3>Niveau de qualité 2 </h3>Trois des points mentionnés sont remplis.  <br> <h3>Niveau de qualité 1</h3>Deux des points mentionnés sont remplis ou trois sont partiellement remplis.  <br> <h3>Niveau de qualité 0</h3>Uniquement un point est rempli ou tous les points sont remplis partiellement. ",

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B8',
          question: 'Présentation',
          help: "La documentation est la carte de visite du travail pratique. Sa présentation témoigne de la cohérence et de l'adéquation du travail du ou de la candidat-e.  <br> <h3>Niveau de qualité 3 </h3>	1.	La présentation contient une numérotation des pages appropriée.   <br>	2.	Le saut de page est utilisé de manière appropriée ou n'entrave pas le  flux de la lecture du rapport.   <br>	3.	Chaque page contient des informations et pas seulement une ligne de  texte ou de titre.   <br>	4.	La présentation est appropriée et propre.   <h3>Niveau de qualité 2 </h3>Trois points sont remplis.  <h3>Niveau de qualité 1</h3>Deux points sont remplis.  <h3>Niveau de qualité 0</h3>Moins de deux points sont remplis. ",

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B9',
          question: 'Graphiques, images, diagrammes et tableaux',
          help: "Les graphiques, images, diagrammes et tableaux servent à présenter une matière complexe, à la rendre compréhensible ou à la structurer.  <br> <h3>Niveau de qualité 3 </h3>	1.	Des graphiques, images, diagrammes ou des tableaux sont utilisés aux endroits adéquats et permettent de mieux se représenter le contenu du rapport du TPI et rendre le texte plus compréhensible.   <br>	2.	Le choix du schéma/de la représentation est approprié dans l'entier du TPI.   <br>	3.	Les images sont visuellement lisibles   <br>	4.	Les images sont compréhensibles au niveau du contenu.   <br>	5.	Les illustrations sont pertinentes et représentatives.   <br>	6.	Les illustrations sont expliquées dans une légende ou un texte.   <br>	7.	Les illustrations sont appropriées au contexte.   <h3>Niveau de qualité 2 </h3>6 aspects sont bien remplis.  <h3>Niveau de qualité 1</h3>4 aspects sont bien remplis.  <h3>Niveau de qualité 0</h3>Moins de 4 aspects sont bien remplis.",

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B10',
          question:
            'Documentation de la procédure de tests et de ses résultats',
          help: "Les résultats des tests sont compréhensibles et reproductibles lorsque l'installation de test, les méthodes et les outils utilisés à cet effet sont décrits de telle manière que des spécialistes externes puissent exécuter eux-mêmes la procédure. Tous les tests, prévus ou imprévus, sont documentés.  <br> <h3>Niveau de qualité 3 </h3>	1.	Le protocole de tests est basé sur l'équipement de test, les scénarios de tests et les moyens d'aide à disposition.   <br>	2.	Il est facilement compréhensible.   <br>	3.	Les actions et les paramètres sont décrits sans aucune ambiguité.   <br>	4.	Tous les résultats des tests sont documentés.   <h3>Niveau de qualité 2 </h3>Trois des aspects sont bien remplis.  <br> <h3>Niveau de qualité 1</h3>Deux des aspects sont bien remplis.  <br> <h3>Niveau de qualité 0</h3>Moins de deux aspects sont bien remplis.",

          pt: 0,
          justification: ''
        }
      ]
    },
    C: {
      title: 'Partie C : Entretien professionnel et présentation',
      questions: [
        {
          idCritere: 'C1',
          question: 'Gestion du temps, structure',
          help: "La structure et le contenu de la présentation se limitent aux principaux aspects (tâches, déroulement, résultats) du TPI. Le temps imparti pour la présentation doit être respecté.<h3>Niveau de qualité 3</h3>1. La présentation comporte une introduction avec un bref aperçu qui fait le lien avec la suite de la présentation et contient donc une partie centrale ainsi qu'une conclusion comprenant une évaluation critique du travail effectué.<br>2. La présentation fait ressortir les aspects essentiels du résultat du TPI.<br>3. La présentation se concentre sur les aspects pertinents.<br>4. La présentation est faite dans un ordre logique et construite de<br>manière cohérente.<br>5. Le temps de présentation est strictement respecté.<br><h3>Niveau de qualité 2</h3>Trois points des points 1 à 4 sont remplis ou le temps de présentation n'a pas été dépassé de plus de 2 minutes.<br><h3>Niveau de qualité 1</h3>Deux points des points 1 à 4 sont respectés ou le temps de présentation n'a pas été dépassé ou été inférieur de plus de 4 minutes.<br><h3>Niveau de qualité 0</h3>Un seul point des points 1 à 4 est rempli ou le temps de présentation a été dépassé ou été inférieur de plus de 4 minutes.",

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C2',
          question: 'Présentation : Utilisation de médias, aspects techniques',
          help: "Pour la présentation du projet, des outils techniques<br>sont utilisés seuls ou en combinaison. Le ou la candidat-e doit savoir les utiliser correctement et à bon escient.<h3>Niveau de qualité 3</h3>1. Utilise les moyens techniques appropriés pour appuyer la présentation<br>2. Utilise correctement les moyens techniques à disposition.<br>3. Le langage et les médias utilisés sont idéalement choisis et se<br>complètent parfaitement.<br><h3>Niveau de qualité 2</h3>Deux des points mentionnés sont remplis ou deux points sont partiellement remplis.<br><h3>Niveau de qualité 1</h3>Un des points mentionnés est rempli ou trois points sont partiellement remplis.<br><h3>Niveau de qualité 0</h3>Aucun des points mentionnés n'est rempli.",

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C3',
          question: 'Technique de présentation',
          help: "La présentation se fait dans la langue employée à l'école. Le ou la candidat-e doit formuler des phrases correctes et intelligibles. Les formulations et le langage technique sont en adéquation avec le public cible (spécialistes, experts). Le volume de la voix, la vitesse d'élocution ainsi que la gestuelle sont adaptés au public cible et aux locaux.<br><h3>Niveau de qualité 3</h3>1. Les déclarations sont parfaitement formulées.<br>2. Les phrases sont formulées de manière claire, complète et<br>linguistiquement correcte.<br>3. La discussion est claire.<br>4. La gestuelle/les mimiques sont adaptées au public cible.<br>5. Un contact visuel fréquent est visible et ce avec tous les auditeurs.<br><h3>Niveau de qualité 2</h3>Quatre points sont remplis. <br><h3>Niveau de qualité 1</h3>Trois points sont remplis.<br><h3>Niveau de qualité 0</h3>Deux points ou moins de deux points sont remplis.",

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C4',
          question: "Echange d'information avec les experts durant le TPI",
          help: "L'échange d'informations entre le candidat et les experts s'est fait correctement durant toute la procédure du TPI<br><h3>Niveau de qualité 3</h3>Le candidat a toujours répondu durant le TPI dans un délai acceptable aux questions et demandes des experts.<br>Le candidat a envoyé à chaque échéance les documents<br>demandés<br><h3>Niveau de qualité 2</h3>Le candidat n'a pas répondu dans un délai acceptable, ou n'a pas envoyé un document dans les délais entre une et deux fois.<br><h3>Niveau de qualité 1</h3>Le candidat n'a pas répondu dans un délai acceptable, ou n'a pas envoyé un document dans les délais entre trois et quatre fois.<br><h3>Niveau de qualité 0</h3>Le candidat n'a pas répondu dans un délai acceptable, ou n'a pas envoyé un document dans les délais plus de quatre fois.",

          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C5',
          question: 'Question des experts 1',
          help: "Le candidat est-il apte à répondre à la question/l'ensemble des experts<br>concernant son travail de manière correcte et suffisamment professionnelle?<br>L'étendue et le degré de finition du produit correspondent au temps investi.<br><h3>Niveau de qualité 3</h3>Les réponses aux questions traitent de tous les aspects de façon professionnelle et différenciée. Les déclarations faites sont, lorsque nécessaire, étayées par des exemples ou assorties de conclusions logiques. Les réponses sont correctes et reflètent les compétences techniques. Le ou la candidat-e peut aussi fournir des renseignements précis sur des détails. Il ou elle répond avec exactitude aux questions des experts, pose des questions si nécessaire et adopte un comportement correct<br><h3>Niveau de qualité 2</h3>Les réponses aux questions négligent un ou plusieurs aspects peu importants ou un aspect d'importance cruciale n'est pas suffisamment éclairci. La plupart des déclarations sont illustrées par des exemples ou des conclusions logiques lorsque cela est nécessaire. Le candidat fournit principalement des réponses correctes et peut généralement répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 1</h3>Les réponses aux questions négligent un aspect de grande importance ou des aspects d'importance cruciale ne sont pas suffisamment éclaircis. Un grand nombre de déclarations ne sont pas illustrées par des exemples ou des conclusions logiques lorsque cela est nécessaire. Le candidat fournit souvent des réponses erronées ou imprécises.<br><h3>Niveau de qualité 0</h3>Le candidat ne peut pas répondre correctement à la question/à l'ensemble de questions concernant son travail d'examen.",

          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C6',
          question: 'Question des experts 2',
          help: "Le candidat est-il apte à répondre à la question/l'ensemble des experts<br>concernant son travail de manière correcte et suffisamment professionnelle?<br>L'étendue et le degré de finition du produit correspondent au temps investi.<br><h3>Niveau de qualité 3</h3>Les réponses aux questions traitent de tous les aspects de façon professionnelle et différenciée. Les déclarations faites sont, lorsque nécessaire, étayées par des exemples ou assorties de conclusions logiques. Les réponses sont correctes et reflètent les compétences techniques. Le ou la candidat-e peut aussi fournir des renseignements précis sur des détails. Il ou elle répond avec exactitude aux questions des experts, pose des questions si nécessaire et adopte un comportement correct<br><h3>Niveau de qualité 2</h3>Les réponses aux questions négligent un ou plusieurs aspects peu importants ou un aspect d'importance cruciale n'est pas suffisamment éclairci. La plupart des déclarations sont illustrées par des exemples ou des conclusions logiques lorsque cela est nécessaire. Le candidat fournit principalement des réponses correctes et peut généralement répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 1</h3>Les réponses aux questions négligent un aspect de grande importance ou des aspects d'importance cruciale ne sont pas suffisamment éclaircis. Un grand nombre de déclarations ne sont pas illustrées par des exemples ou des conclusions logiques lorsque cela est nécessaire. Le candidat fournit souvent des réponses erronées ou imprécises.<br><h3>Niveau de qualité 0</h3>Le candidat ne peut pas répondre correctement à la question/à l'ensemble de questions concernant son travail d'examen.",

          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C7',
          question: 'Question des experts 3',
          help: "Le candidat est-il apte à répondre à la question/l'ensemble des experts<br>concernant son travail de manière correcte et suffisamment professionnelle?<br>L'étendue et le degré de finition du produit correspondent au temps investi.<br><h3>Niveau de qualité 3</h3>Les réponses aux questions traitent de tous les aspects de façon professionnelle et différenciée. Les déclarations faites sont, lorsque nécessaire, étayées par des exemples ou assorties de conclusions logiques. Les réponses sont correctes et reflètent les compétences techniques. Le ou la candidat-e peut aussi fournir des renseignements précis sur des détails. Il ou elle répond avec exactitude aux questions des experts, pose des questions si nécessaire et adopte un comportement correct<br><h3>Niveau de qualité 2</h3>Les réponses aux questions négligent un ou plusieurs aspects peu importants ou un aspect d'importance cruciale n'est pas suffisamment éclairci. La plupart des déclarations sont illustrées par des exemples ou des conclusions logiques lorsque cela est nécessaire. Le candidat fournit principalement des réponses correctes et peut généralement répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 1</h3>Les réponses aux questions négligent un aspect de grande importance ou des aspects d'importance cruciale ne sont pas suffisamment éclaircis. Un grand nombre de déclarations ne sont pas illustrées par des exemples ou des conclusions logiques lorsque cela est nécessaire. Le candidat fournit souvent des réponses erronées ou imprécises.<br><h3>Niveau de qualité 0</h3>Le candidat ne peut pas répondre correctement à la question/à l'ensemble de questions concernant son travail d'examen.",

          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C8',
          question: 'Question des experts 4',
          help: "Le candidat est-il apte à répondre à la question/l'ensemble des experts<br>concernant son travail de manière correcte et suffisamment professionnelle?<br>L'étendue et le degré de finition du produit correspondent au temps investi.<br><h3>Niveau de qualité 3</h3>Les réponses aux questions traitent de tous les aspects de façon professionnelle et différenciée. Les déclarations faites sont, lorsque nécessaire, étayées par des exemples ou assorties de conclusions logiques. Les réponses sont correctes et reflètent les compétences techniques. Le ou la candidat-e peut aussi fournir des renseignements précis sur des détails. Il ou elle répond avec exactitude aux questions des experts, pose des questions si nécessaire et adopte un comportement correct<br><h3>Niveau de qualité 2</h3>Les réponses aux questions négligent un ou plusieurs aspects peu importants ou un aspect d'importance cruciale n'est pas suffisamment éclairci. La plupart des déclarations sont illustrées par des exemples ou des conclusions logiques lorsque cela est nécessaire. Le candidat fournit principalement des réponses correctes et peut généralement répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 1</h3>Les réponses aux questions négligent un aspect de grande importance ou des aspects d'importance cruciale ne sont pas suffisamment éclaircis. Un grand nombre de déclarations ne sont pas illustrées par des exemples ou des conclusions logiques lorsque cela est nécessaire. Le candidat fournit souvent des réponses erronées ou imprécises.<br><h3>Niveau de qualité 0</h3>Le candidat ne peut pas répondre correctement à la question/à l'ensemble de questions concernant son travail d'examen.",

          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C9',
          question: 'Question des experts 5',
          help: "Le candidat est-il apte à répondre à la question/l'ensemble des experts<br>concernant son travail de manière correcte et suffisamment professionnelle?<br>L'étendue et le degré de finition du produit correspondent au temps investi.<br><h3>Niveau de qualité 3</h3>Les réponses aux questions traitent de tous les aspects de façon professionnelle et différenciée. Les déclarations faites sont, lorsque nécessaire, étayées par des exemples ou assorties de conclusions logiques. Les réponses sont correctes et reflètent les compétences techniques. Le ou la candidat-e peut aussi fournir des renseignements précis sur des détails. Il ou elle répond avec exactitude aux questions des experts, pose des questions si nécessaire et adopte un comportement correct<br><h3>Niveau de qualité 2</h3>Les réponses aux questions négligent un ou plusieurs aspects peu importants ou un aspect d'importance cruciale n'est pas suffisamment éclairci. La plupart des déclarations sont illustrées par des exemples ou des conclusions logiques lorsque cela est nécessaire. Le candidat fournit principalement des réponses correctes et peut généralement répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 1</h3>Les réponses aux questions négligent un aspect de grande importance ou des aspects d'importance cruciale ne sont pas suffisamment éclaircis. Un grand nombre de déclarations ne sont pas illustrées par des exemples ou des conclusions logiques lorsque cela est nécessaire. Le candidat fournit souvent des réponses erronées ou imprécises.<br><h3>Niveau de qualité 0</h3>Le candidat ne peut pas répondre correctement à la question/à l'ensemble de questions concernant son travail d'examen.",

          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C10',
          question: 'Question des experts 6',
          help: "Le candidat est-il apte à répondre à la question/l'ensemble des experts<br>concernant son travail de manière correcte et suffisamment professionnelle?<br>L'étendue et le degré de finition du produit correspondent au temps investi.<br><h3>Niveau de qualité 3</h3>Les réponses aux questions traitent de tous les aspects de façon professionnelle et différenciée. Les déclarations faites sont, lorsque nécessaire, étayées par des exemples ou assorties de conclusions logiques. Les réponses sont correctes et reflètent les compétences techniques. Le ou la candidat-e peut aussi fournir des renseignements précis sur des détails. Il ou elle répond avec exactitude aux questions des experts, pose des questions si nécessaire et adopte un comportement correct<br><h3>Niveau de qualité 2</h3>Les réponses aux questions négligent un ou plusieurs aspects peu importants ou un aspect d'importance cruciale n'est pas suffisamment éclairci. La plupart des déclarations sont illustrées par des exemples ou des conclusions logiques lorsque cela est nécessaire. Le candidat fournit principalement des réponses correctes et peut généralement répondre à des questions détaillées par des renseignements précis.<br><h3>Niveau de qualité 1</h3>Les réponses aux questions négligent un aspect de grande importance ou des aspects d'importance cruciale ne sont pas suffisamment éclaircis. Un grand nombre de déclarations ne sont pas illustrées par des exemples ou des conclusions logiques lorsque cela est nécessaire. Le candidat fournit souvent des réponses erronées ou imprécises.<br><h3>Niveau de qualité 0</h3>Le candidat ne peut pas répondre correctement à la question/à l'ensemble de questions concernant son travail d'examen.",

          fieldText: '',
          pt: 0,
          justification: ''
        }
      ]
    }
  }

  function calculerNoteFinale (results) {
    const note = (5 * results[3].pointsObtenus) / results[3].maxPoints + 1
    return Math.round(note * 10) / 10 // Arrondi à une seule décimale après la virgule
  }

  const updatePoints = (i, totalPts) => {
    setResultsOfParts(prevResults => {
      // Copie de prevPage6Note pour éviter les mutations directes
      const newResults = [...prevResults]

      // Mettre à jour les points obtenus pour la partie spécifique
      newResults[i].pointsObtenus = totalPts

      // Mettre à jour la partie "somme de a+b+c"
      newResults[3].pointsObtenus =
        newResults[0].pointsObtenus +
        newResults[1].pointsObtenus +
        newResults[2].pointsObtenus

      // Mettre à jour les points obtenus pour la partie "Note Finale"
      newResults[4].pointsObtenus = calculerNoteFinale(newResults)

      return newResults
    })
  }

  const handleSave = () => {
    const datasHeader = extractDataFromElements('data-header')
    const datasJustification = extractDataFromElements('data-justification')
    const dataPTechPlus = extractDataFromElements('data-ptechplus')
    const dataPTechSelected = extractDataFromElements('data-ptechselected')
    const dataPoints = extractDataFromElements('data-point')
    const data = {
      datasHeader: datasHeader,
      datasJustification: datasJustification,
      dataPTechPlus: dataPTechPlus,
      dataPTechSelected: dataPTechSelected,
      dataPoints: dataPoints,
      pointsObtenusA: resultsOfParts[0].pointsObtenus,
      pointsObtenusB: resultsOfParts[1].pointsObtenus,
      pointsObtenusC: resultsOfParts[2].pointsObtenus,
      pointsObtenusABC: resultsOfParts[3].pointsObtenus,
      noteObtenu: resultsOfParts[4].pointsObtenus
    }

    setData(data)

    // Affichage dans la console
    console.log('Données sauvegardées :', data)
  }

  const handleFreeze = async () => {
    // Désactiver tous les champs de formulaire après avoir figé les données
    const inputFields = document.querySelectorAll('input, textarea')
    inputFields.forEach(field => {
      field.disabled = true
    })

    // Ajouter le membre freeze aux données avec la valeur "yes"
    const dataWithFreeze = { ...data, freeze: 'yes' }
    if (data !== null) {
      populatePdfFields()
    } else {
      alert("Le système a besoin d'une sauvegarde avant de faire un freeze")
    }
  }

  const handleClear = () => {
    setData('')
  }



  return (
    <>
      <div id='page1'>
        <HeaderLine isVisible={true} searchCandidat={searchCandidat}/>
        <Header
          label1={'Entreprise formatrice/Chef de Projet'}
          label2={'Candidat.e'}
        />
        <Header label1={'Expert 1'} label2={'Expert 2'} />

        <ProfessionalCompetenciesDescription />
      </div>

      {Object.values(questionOfList).map((section, index) => (
        <div key={index + 2} id={`page${index + 2}`}>
          <HeaderLine isVisible={false} />
          <Section
            title={section.title}
            questions={section.questions}
            results={resultsOfParts[index]}
            updatePoints={totalPts => updatePoints(index, totalPts)}
          />
        </div>
      ))}

      <div id='page6'>
        <HeaderLine isVisible={false} />
        <TablePoints title={'Contraction'} results={resultsOfParts} />

        <h2>Remarques</h2>

        <div className='remaque'>
          <textarea
            name='remarque'
            id='remarque'
            rows='11'
            cols='30'
          ></textarea>
        </div>
      </div>

      <div className='btn_validation'>
        <button
          type='button'
          onClick={handleFreeze}
          title='Impression finale'
          className='freeze-button'
        >
          <span>Freeze </span>
          <FontAwesomeIcon icon={faSnowflake} />
        </button>

        <button
          type='button'
          onClick={handleSave}
          title='Enregistrer'
          className='save-button'
        >
          <span>Enregistrer </span>
          <FontAwesomeIcon icon={faSave} />
        </button>

        <button
          type='button'
          onClick={handleClear}
          title='Réinitialiser'
          className='reset-button'
        >
          <span>Réinitialiser </span>
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>
    </>
  )
}

export default NewEvaluationForm
