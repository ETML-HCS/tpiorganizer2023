import React, { useState } from 'react'
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

// Fonction pour peupler tous les champs du PDF en fonction des données saisies dans le formulaire web
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

function NewEvaluationForm () {
  const [data, setData] = useState()
  const [frozenData, setFrozenData] = useState(null)

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
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A2',
          question: 'Acquisition du savoir',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A3',
          question: 'Calendrier / planification',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A4',
          question: 'Compréhension conceptuelle',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A5',
          question:
            'Environnement de projet : limites du système / interfaces avec le monde extérieur',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A6',
          question: 'Test de la solution (planification et exécution)',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A7',
          question:
            'Volonté de performance / engagement / attitude au travail / mise en œuvre',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A8',
          question: 'Autonomie de travail',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A9',
          question: 'Connaissances professionnelles et application adéquate',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A10',
          question: 'Utilisation du jargon / terminologie métier appropriée',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A11',
          question: 'Procédure de travail et méthode professionnelle',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A12',
          question: 'Organisation des résultats du travail',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A13',
          question: 'Performance',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A14',
          question:
            'Point techniques évalués spécifiques au projet (Point 8.1 du CdC)',
          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A15',
          question:
            'Point techniques évalués spécifiques au projet (Point 8.2 du CdC)',
          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A16',
          question:
            'Point techniques évalués spécifiques au projet (Point 8.3 du CdC)',
          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A17',
          question:
            'Point techniques évalués spécifiques au projet (Point 8.4 du CdC)',
          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A18',
          question:
            'Point techniques évalués spécifiques au projet (Point 8.5 du CdC)',
          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A19',
          question:
            'Point techniques évalués spécifiques au projet (Point 8.6 du CdC)',
          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'A20',
          question:
            'Point techniques évalués spécifiques au projet (Point 8.7 du CdC)',
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
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B2',
          question: 'Tenue du journal de travail',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B3',
          question: 'Capacité de réflexion',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B4',
          question: 'Structure',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B5',
          question: 'Pertinence',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B6',
          question: 'Respect des prescriptions formelles du rapport du TPI',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B7',
          question: 'Expression écrite et style / orthographe et grammaire',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B8',
          question: 'Présentation',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B9',
          question: 'Graphiques, images, diagrammes et tableaux',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'B10',
          question:
            'Documentation de la procédure de tests et de ses résultats',
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
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C2',
          question: 'Présentation : Utilisation de médias, aspects techniques',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C3',
          question: 'Technique de présentation',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C4',
          question: "Echange d'information avec les experts durant le TPI",
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C5',
          question: 'Question des experts 1',
          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C6',
          question: 'Question des experts 2',
          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C7',
          question: 'Question des experts 3',
          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C8',
          question: 'Question des experts 4',
          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C9',
          question: 'Question des experts 5',
          fieldText: '',
          pt: 0,
          justification: ''
        },
        {
          idCritere: 'C10',
          question: 'Question des experts 6',
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

    console.log('Données figées :', dataWithFreeze)

    if (data !== null) {
      populatePdfFields()
    } else {
      alert("Le système a besoin d'une sauvegarde avant de faire un freeze")
    }
  }

  const handleClear = () => {
    // Logique pour effacer les données
    setData('')
  }

  return (
    <>
      <div id='page1'>
        <HeaderLine isVisible={true} />
        <Header
          label1={'Entreprise formatrice/Chef de Projet'}
          label2={'Candidat.e'}
        />
        <Header label3={'Expert 1'} label4={'Expert 2'} />

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
        <button type='button' onClick={handleSave}>
          Save <FontAwesomeIcon icon={faSave} />
        </button>
        <button type='button' onClick={handleFreeze}>
          Freeze <FontAwesomeIcon icon={faSnowflake} />
        </button>
        <button type='button' onClick={handleClear}>
          Reset <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>
    </>
  )
}

export default NewEvaluationForm
