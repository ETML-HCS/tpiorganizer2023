import React from 'react'

import {
  CheckIcon,
  CloseIcon,
  ListIcon,
  PencilIcon
} from '../shared/InlineIcons'

const getProposedSlotTitle = (propositions) => {
  if (!Array.isArray(propositions)) {
    return "Aucune offre faite par le client."
  }

  return propositions.reduce((result, proposition) => {
    const date = new Date(proposition.date).toLocaleDateString()
    return `${result}${date}/${proposition.creneau}\n`
  }, "")
}

const TpiSoutenanceActionButtons = ({
  participantName,
  expertOrBoss,
  tpiData,
  listOfPerson,
  token,
  onAccept,
  onProposition
}) => {
  const offers = tpiData[expertOrBoss]?.offres
  const isValidated = offers?.isValidated
  const submittedOffers = offers?.submit
  const invitationClass = isValidated === null ? "invitation" : ""
  const participantToken = listOfPerson.find(
    (person) => person.name === participantName
  )?.token

  const validationClass =
    isValidated === true ? "true" : isValidated === false ? "false" : "null"

  const submitClass =
    Array.isArray(submittedOffers) && submittedOffers.length === 0
      ? "empty"
      : Array.isArray(submittedOffers)
        ? "has-values"
        : ""

  const isCurrentParticipant = participantToken === token

  return (
    <div className={`action-buttons${invitationClass}`}>
      <button
        type='button'
        title={`Validation\nEn attente: a valider\nValide: creneau confirme\nRefuse: creneau refuse`}
        className={`button-${validationClass}`}
        onClick={() => isCurrentParticipant && onAccept(tpiData, expertOrBoss)}
      >
        {validationClass === "true" ? (
          <CheckIcon />
        ) : validationClass === "false" ? (
          <CloseIcon />
        ) : (
          <CheckIcon />
        )}
      </button>
      <button
        type='button'
        title={getProposedSlotTitle(submittedOffers)}
        className={`button-${submitClass}`}
        onClick={() =>
          isCurrentParticipant && onProposition(tpiData, expertOrBoss, submittedOffers)
        }
      >
        {submitClass === "has-values" ? <ListIcon /> : submitClass === "empty" ? <PencilIcon /> : null}
      </button>
    </div>
  )
}

export default TpiSoutenanceActionButtons
