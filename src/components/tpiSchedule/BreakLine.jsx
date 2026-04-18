import React from 'react'

const BreakLine = ({ duration, detailLevel = 2 }) => {
  const normalizedDetailLevel = [0, 1, 2, 3].includes(Number(detailLevel))
    ? Number(detailLevel)
    : 2

  return (
    <div
      className={`breakLine detail-level-${normalizedDetailLevel}`}
      aria-label={`Pause ${duration} minutes`}
    >
      {normalizedDetailLevel <= 1 ? (
        <span className="breakLine-line" aria-hidden="true" />
      ) : (
        <span className="breakLine-badge">
          <span className="breakLine-icon" aria-hidden="true">&#8987;</span>
          <span className="breakLine-label">Pause</span>
          <span className="breakLine-duration">{duration}</span>
          <span className="breakLine-unit">min</span>
        </span>
      )}
    </div>
  )
}

export default BreakLine
