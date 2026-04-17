import React from 'react'

const BreakLine = ({ duration, detailLevel = 2 }) => {
  const normalizedDetailLevel = [0, 1, 2, 3].includes(Number(detailLevel))
    ? Number(detailLevel)
    : 2

  return (
    <div className={`breakLine detail-level-${normalizedDetailLevel}`}>
      {normalizedDetailLevel <= 1 ? (
        <span className="breakLine-line" aria-hidden="true" />
      ) : (
        <span>&#8987; {duration} min</span>
      )}
    </div>
  )
}

export default BreakLine
