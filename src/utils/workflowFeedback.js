export const buildValidationToast = (year, result) => {
  const summary = result?.summary || {}
  const hardConflictCount = Number(summary.hardConflictCount || 0)
  const personOverlapCount = Number(summary.personOverlapCount || 0)
  const roomOverlapCount = Number(summary.roomOverlapCount || 0)
  const classMismatchCount = Number(summary.classMismatchCount || 0)
  const sequenceViolationCount = Number(summary.sequenceViolationCount || 0)
  const importIssueCount = Number(summary.importIssueCount || 0)
  const unplannedTpiCount = Number(summary.unplannedTpiCount || 0)
  const issueCount = Number(summary.issueCount || hardConflictCount)

  if (issueCount > 0) {
    const details = []

    if (personOverlapCount > 0) {
      details.push(`${personOverlapCount} conflit(s) personne`)
    }

    if (roomOverlapCount > 0) {
      details.push(`${roomOverlapCount} conflit(s) salle`)
    }

    if (classMismatchCount > 0) {
      details.push(`${classMismatchCount} incompatibilité(s) de salle`)
    }

    if (sequenceViolationCount > 0) {
      details.push(`${sequenceViolationCount} séquence(s) trop longue(s)`)
    }

    if (unplannedTpiCount > 0) {
      details.push(`${unplannedTpiCount} TPI sans créneau`)
    }

    if (importIssueCount > 0) {
      details.push(`${importIssueCount} écart(s) GestionTPI/workflow`)
    }

    const extra = details.length > 0 ? ` (${details.join(', ')})` : ''

    return {
      level: 'warning',
      message: `Vérification ${year} terminée: ${issueCount} erreur(s) bloquante(s) détectée(s)${extra}.`,
      toastId: `workflow-validate-${year}`
    }
  }

  return {
    level: 'success',
    message: `Vérification ${year} terminée: planning valide, aucune contrainte bloquante détectée.`,
    toastId: `workflow-validate-${year}`
  }
}

export const buildOptimizationToast = (year, result) => {
  const optimization = result?.optimization || {}
  const swapCount = Number(optimization.swapCount || 0)
  const before = optimization.before || {}
  const after = optimization.after || {}

  if (swapCount <= 0) {
    const classMismatchAfter = Number(after.classMismatchCount || 0)
    const classMismatchText = classMismatchAfter > 0
      ? ` (${classMismatchAfter} incompatibilité(s) de salle restantes)`
      : ''

    return {
      level: 'info',
      message: `Optimisation ${year}: aucune amélioration sûre trouvée${classMismatchText}.`,
      toastId: `workflow-optimize-${year}`
    }
  }

  const scoreBefore = Number(before.score || 0)
  const scoreAfter = Number(after.score || 0)
  const personBefore = Number(before.personOverlapCount || 0)
  const personAfter = Number(after.personOverlapCount || 0)
  const classMismatchBefore = Number(before.classMismatchCount || 0)
  const classMismatchAfter = Number(after.classMismatchCount || 0)
  const sequenceBefore = Number(before.sequenceExcessCount || 0)
  const sequenceAfter = Number(after.sequenceExcessCount || 0)
  const details = []

  if (personBefore !== personAfter) {
    details.push(`${personBefore}→${personAfter} conflit(s) personne`)
  }

  if (sequenceBefore !== sequenceAfter) {
    details.push(`${sequenceBefore}→${sequenceAfter} séquence(s) surchargée(s)`)
  }

  if (classMismatchBefore !== classMismatchAfter) {
    details.push(`${classMismatchBefore}→${classMismatchAfter} incompatibilité(s) de salle`)
  } else if (classMismatchAfter > 0) {
    details.push(`${classMismatchAfter} incompatibilité(s) de salle restantes`)
  }

  const detailText = details.length > 0 ? ` (${details.join(', ')})` : ''
  const scoreText = scoreBefore !== scoreAfter
    ? `, score ${scoreBefore}→${scoreAfter}`
    : ''

  return {
    level: 'success',
    message: `Optimisation ${year} appliquée: ${swapCount} échange(s)${scoreText}${detailText}.`,
    toastId: `workflow-optimize-${year}`
  }
}
