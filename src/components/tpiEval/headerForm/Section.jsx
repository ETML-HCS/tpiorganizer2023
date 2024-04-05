import { React, Fragment, useState } from 'react'

const TableFooter = ({ partNumber, maxPoints, totalPoints }) => {
  return (
    <tfoot>
      <tr>
        <td
          colSpan={2}
        >{`Total partie ${partNumber} (${maxPoints} points max)`}</td>
        <td colSpan={2} id={`${partNumber.split(' ')[1]}somme`}>
          {totalPoints}
        </td>
      </tr>
    </tfoot>
  )
}

function replaceDigit (string, replacement) {
  // Diviser la chaîne en utilisant '_'
  const parts = string.split('_')
  // Remplacer le troisième élément par la valeur de remplacement
  parts[2] = replacement
  // Rejoindre les parties en utilisant '_'
  return parts.join('_')
}

const Question = ({ question, updatePts }) => {
  const [points, setPoints] = useState(question.pt)
  const [justification, setJustification] = useState('')
  const [additionalInputs, setAdditionalInputs] = useState(0) // État pour le nombre d'inputs texte supplémentaires
  const [selectedQuestion, setSelectedQuestion] = useState(null) // État pour suivre la question sélectionnée
  const [isActif, setIsActif] = useState(false)

  const handlePointsChange = e => {
    const newPoints = parseInt(e.target.value)
    if (!isNaN(newPoints) && newPoints >= 0 && newPoints <= 3) {
      setPoints(newPoints)
      updatePts(newPoints)
    }
  }

  const handleJustificationChange = e => {
    setJustification(e.target.value)
  }

  const addTextField = () => {
    if (selectedQuestion != null) {
      const splitId = selectedQuestion.split('_').slice(0, -1).join('_') // Pour conserver toutes les parties sauf la dernière
      const newSplitId = 'inputsAdd' + splitId.substring('input'.length) // Remplacez 'inputsAdd' par la nouvelle valeur
      const inputsAdd_id = document.getElementById(newSplitId)
      inputsAdd_id.style.display = 'block'
    }
    setAdditionalInputs(prevInputs => prevInputs + 1) // Ajoute un input texte supplémentaire à chaque clic sur le bouton "+"
    setIsActif(true)
  }

  const removeTextField = () => {
    if (additionalInputs > 0) {
      setAdditionalInputs(prevInputs => prevInputs - 1) // Supprime un input texte supplémentaire à chaque clic sur le bouton "-"
    }

    // Vérifiez si additionalInputs sera égal à 0 après la soustraction
    // Si c'est le cas, définissez isActif sur false, sinon définissez-le sur true
    setIsActif(additionalInputs > 1) // Si additionalInputs est supérieur à 1, isActif sera true, sinon false
  }

  const selectQuestion = sourceId => {
    // Remplace le chiffre x dans sourceId par '0'
    const targetId = replaceDigit(sourceId, '0')

    // Met à jour la question sélectionnée avec targetId (la question modifiée)
    setSelectedQuestion(targetId)

    // Cache la zone d'entrée d'identifiant inputsAdd_A
    const inputsAdd_id = document.getElementById(
      `inputsAdd_${sourceId.split('_')[1]}`
    )

    if (inputsAdd_id) {
      inputsAdd_id.style.display = 'none'
    }

    // Echange le contenu de l'input qui contient l'identifiant avec celui de targetId
    const sourceInput = document.getElementById(sourceId)
    const targetInput = document.getElementById(targetId)

    if (sourceInput && targetInput) {
      const tempValue = sourceInput.value
      sourceInput.value = targetInput.value
      targetInput.value = tempValue
    }
  }

  const handleClickHelp = (textHTML) => {
    // Récupérer l'élément popup et son contenu
    const popup = document.getElementById('popup');
    const popupContent = document.getElementById('popup-content');
    
    // Mettre à jour le contenu de la popup
    popupContent.innerHTML = textHTML;
  
    // Afficher la popup
    popup.style.display = 'block';

    popup.onclick =hidePopup
  }
  
  function hidePopup () {
    var popup = document.getElementById('popup')
    popup.style.display = 'none'
  }

  const isNewQuestion = question.fieldText !== undefined

  return (
    <>
      <tr>
        <td onClick={()=>handleClickHelp(question.help)}>
          <div className='critere-id col-1'>{question.idCritere}</div>
        </td>

        <td className='question col-2'>
          {question.question}

          {/* Affichage du bouton uniquement si le champ fieldText est défini */}
          {isNewQuestion && (
            <div className='textField' id={`div_${question.idCritere}`}>
              <input
                type='text'
                className='input_questionAdd'
                name={question.idCritere}
                id={`input_${question.idCritere}_0`}
                data-ptechselected={`input_${question.idCritere}`}
              />

              <span className='btn_question'>
                <button
                  type='button'
                  className='btn_questionAdd'
                  onClick={addTextField}
                >
                  {' '}
                  +{' '}
                </button>

                <button
                  type='button'
                  className={`btn_questionMinus ${isActif ? '' : 'disabled'}`}
                  onClick={removeTextField}
                >
                  {' '}
                  -{' '}
                </button>
              </span>

              {/* Affichage des inputs texte supplémentaires */}
              <div id={`inputsAdd_${question.idCritere}`}>
                {Array.from({ length: additionalInputs }).map((_, index) => (
                  <div
                    key={`additionalInput_${index}`}
                    id={`additionalInput_${index}`}
                  >
                    <button
                      type='button'
                      onClick={() =>
                        selectQuestion(
                          `input_${question.idCritere}_${index + 2}`
                        )
                      }
                      className='btn_Selected'
                    >
                      {'\u279C'}
                    </button>
                    <input
                      type='text'
                      name={question.idCritere}
                      id={`input_${question.idCritere}_${index + 2}`}
                      data-ptechplus={`input_${question.idCritere}_${
                        index + 2
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </td>

        <td className='points col-3'>
          <input
            type='number'
            value={points}
            onChange={handlePointsChange}
            min='0'
            max='3'
            name={`${question.idCritere}pt`}
            data-point={`${question.idCritere}`}
          />
        </td>
        <td className='justification col-4'>
          <textarea
            value={justification}
            onChange={handleJustificationChange}
            data-justification={`${question.idCritere}`}
            name={`${question.idCritere}just`}
          />
        </td>
      </tr>
    </>
  )
}

const Section = ({ title, questions, results, updatePoints }) => {
  const [totalPoints, setTotalPoints] = useState(0)
  const [questionPoints, setQuestionPoints] = useState(
    Array(questions.length).fill(0)
  )

  const updateTotalPoints = (index, pts) => {
    const newQuestionPoints = [...questionPoints]
    newQuestionPoints[index] = pts

    const newTotalPoints = newQuestionPoints.reduce((acc, pt) => acc + pt, 0)

    setQuestionPoints(newQuestionPoints)
    setTotalPoints(newTotalPoints)
    updatePoints(newTotalPoints)
  }

  return (
    <Fragment>
      <h2 className='titleSection'>{title}</h2>
      <div className='tQuestions'>
        <table>
          <thead>
            <tr>
              <th className='col-1'></th>
              <th className='col-2'>Question</th>
              <th className='col-3'>Point</th>
              <th className='col-4'>Justification</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((question, index) => (
              <Question
                key={index}
                question={question}
                updatePts={pts => updateTotalPoints(index, pts)}
              />
            ))}
          </tbody>
          <TableFooter
            partNumber={results.rowTitle}
            maxPoints={results.maxPoints}
            totalPoints={results.pointsObtenus}
          />
        </table>
      </div>
    </Fragment>
  )
}

const ViewPoints = () => {
  return (
    <>
      <table id='viewPoints'>
        <thead>
          <tr>
            <th>Points</th>
            <th>Note</th>
            <th>Points</th>
            <th>Note</th>
            <th>Points</th>
            <th>Note</th>
            <th>Points</th>
            <th>Note</th>
            <th>Points</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>0-1</td>
            <td>1.0</td>
            <td>23-25</td>
            <td>2.0</td>
            <td>47-49</td>
            <td>3.0</td>
            <td>71-73</td>
            <td>4.0</td>
            <td>95-97</td>
            <td>5.0</td>
          </tr>
          <tr>
            <td>2-3</td>
            <td>1.1</td>
            <td>26-27</td>
            <td>2.1</td>
            <td>50-51</td>
            <td>3.1</td>
            <td>74-75</td>
            <td>4.1</td>
            <td>98-99</td>
            <td>5.1</td>
          </tr>
          <tr>
            <td>4-5</td>
            <td>1.2</td>
            <td>28-29</td>
            <td>2.2</td>
            <td>52-53</td>
            <td>3.2</td>
            <td>76-77</td>
            <td>4.2</td>
            <td>100-101</td>
            <td>5.2</td>
          </tr>
          <tr>
            <td>6-8</td>
            <td>1.3</td>
            <td>30-32</td>
            <td>2.3</td>
            <td>54-56</td>
            <td>3.3</td>
            <td>78-80</td>
            <td>4.3</td>
            <td>102-104</td>
            <td>5.3</td>
          </tr>
          <tr>
            <td>9-10</td>
            <td>1.4</td>
            <td>33-34</td>
            <td>2.4</td>
            <td>57-58</td>
            <td>3.4</td>
            <td>81-82</td>
            <td>4.4</td>
            <td>105-106</td>
            <td>5.4</td>
          </tr>
          <tr>
            <td>11-13</td>
            <td>1.5</td>
            <td>35-37</td>
            <td>2.5</td>
            <td>59-61</td>
            <td>3.5</td>
            <td>83-85</td>
            <td>4.5</td>
            <td>107-109</td>
            <td>5.5</td>
          </tr>
          <tr>
            <td>14-15</td>
            <td>1.6</td>
            <td>38-39</td>
            <td>2.6</td>
            <td>62-53</td>
            <td>3.6</td>
            <td>86-87</td>
            <td>4.6</td>
            <td>110-111</td>
            <td>5.6</td>
          </tr>
          <tr>
            <td>16-17</td>
            <td>1.7</td>
            <td>40-41</td>
            <td>2.7</td>
            <td>64-65</td>
            <td>3.7</td>
            <td>88-89</td>
            <td>4.7</td>
            <td>112-113</td>
            <td>5.7</td>
          </tr>
          <tr>
            <td>18-20</td>
            <td>1.8</td>
            <td>42-44</td>
            <td>2.8</td>
            <td>66-68</td>
            <td>3.8</td>
            <td>90-92</td>
            <td>4.8</td>
            <td>114-116</td>
            <td>5.8</td>
          </tr>
          <tr>
            <td>21-22</td>
            <td>1.9</td>
            <td>45-46</td>
            <td>2.9</td>
            <td>69-70</td>
            <td>3.9</td>
            <td>93-94</td>
            <td>4.9</td>
            <td>117-118</td>
            <td>5.9</td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td>119-120</td>
            <td>6.0</td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

const TablePoints = ({ title, results }) => {
  return (
    <>
      <h2>{title}</h2>
      <div className='tSommes'>
        <table>
          <thead>
            <tr>
              <th>Somme des différentes parties</th>
              <th>Nombre de points max</th>
              <th>Points obtenus</th>
            </tr>
          </thead>
          <tbody className='tbodyContraction'>
            {results.map((r, index) => {
              return (
                <tr key={index}>
                  {(() => {
                    let id
                    if (
                      r.rowTitle.split(' ')[1] !== 'A' &&
                      r.rowTitle.split(' ')[1] !== 'B' &&
                      r.rowTitle.split(' ')[1] !== 'C'
                    ) {
                      if (r.rowTitle.split(' ')[0] === 'Note') {
                        id = 'note'
                      } else {
                        id = 'ABCsomme'
                      }
                    } else {
                      id = r.rowTitle.split(' ')[1] + 'somme'
                    }
                    return (
                      <>
                        <td>{r.rowTitle}</td>
                        <td>{r.maxPoints}</td>
                        <td id={`Contraction_${id}`}>{r.pointsObtenus}</td>
                      </>
                    )
                  })()}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ViewPoints />
    </>
  )
}

export { Section, TablePoints }
