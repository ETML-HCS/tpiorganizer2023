import React from "react"

const buttonSize = 21

const acceptButtonSvgNot = (
  <svg
    width={buttonSize}
    height={buttonSize}
    viewBox='0 0 512 512'
    style={{ color: "#1C2033" }}
    xmlns='http://www.w3.org/2000/svg'
    className='h-full w-full'
  >
    <svg
      width='100%'
      height='100%'
      viewBox='0 0 16 14'
      fill='#1C2033'
      role='img'
      xmlns='http://www.w3.org/2000/svg'
    >
      <g fill='#1C2033'>
        <path
          fill='currentColor'
          d='M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z'
        />
      </g>
    </svg>
  </svg>
)

const acceptButtonSvgOk = (
  <svg
    width={buttonSize}
    height={buttonSize}
    viewBox='0 0 512 512'
    style={{ color: "#00ff08" }}
    xmlns='http://www.w3.org/2000/svg'
    className='h-full w-full'
  >
    <svg
      width='100%'
      height='100%'
      viewBox='0 0 16 14'
      fill='#00ff08'
      role='img'
      xmlns='http://www.w3.org/2000/svg'
    >
      <g fill='#00ff08'>
        <path
          fill='currentColor'
          d='M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z'
        />
      </g>
    </svg>
  </svg>
)

const submitButtonSvg = (
  <svg
    width={buttonSize}
    height={buttonSize}
    viewBox='0 0 512 512'
    style={{ color: "#000000" }}
    xmlns='http://www.w3.org/2000/svg'
    className='h-full w-full'
  >
    <svg
      width='100%'
      height='100%'
      viewBox='0 0 24 24'
      fill='#000000'
      xmlns='http://www.w3.org/2000/svg'
    >
      <g fill='#000000'>
        <path
          fill='currentColor'
          d='m21.7 13.35l-1 1l-2.05-2l1-1c.2-.21.54-.22.77 0l1.28 1.28c.19.2.19.52 0 .72M12 18.94V21h2.06l6.06-6.12l-2.05-2L12 18.94M5 19h5v2H5a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h1V1h2v2h8V1h2v2h1a2 2 0 0 1 2 2v4H5v10M5 5v2h14V5H5Z'
        />
      </g>
    </svg>
  </svg>
)

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
        title={`✔\tEn attente de validation\nOK\tCréneau validé\nX\tCréneau refusé`}
        className={`button-${validationClass}`}
        onClick={() => isCurrentParticipant && onAccept(tpiData, expertOrBoss)}
      >
        {validationClass === "true"
          ? acceptButtonSvgOk
          : validationClass === "false"
          ? "X"
          : acceptButtonSvgNot}
      </button>
      <button
        title={getProposedSlotTitle(submittedOffers)}
        className={`button-${submitClass}`}
        onClick={() =>
          isCurrentParticipant && onProposition(tpiData, expertOrBoss, submittedOffers)
        }
      >
        {submitClass === "has-values"
          ? "-"
          : submitClass === "empty"
          ? submitButtonSvg
          : ""}
      </button>
    </div>
  )
}

export default TpiSoutenanceActionButtons