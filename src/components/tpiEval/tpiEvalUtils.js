const normalizeText = (value) => String(value ?? "").trim().toLowerCase()

export const getEvaluationStorageKey = (evaluation) => {
  if (!evaluation || typeof evaluation !== "object") {
    return null
  }

  if (evaluation.id !== undefined && evaluation.id !== null && evaluation.id !== "") {
    return String(evaluation.id)
  }

  const year = evaluation.year !== undefined && evaluation.year !== null
    ? String(evaluation.year)
    : ""
  const tpiRef = evaluation.tpiRef ? String(evaluation.tpiRef) : ""

  if (year || tpiRef) {
    return `${year}:${tpiRef}`.replace(/^:/, "").replace(/:$/, "")
  }

  return null
}

export const normalizeEvaluationList = (evaluations) => {
  if (Array.isArray(evaluations)) {
    return evaluations.filter(Boolean)
  }

  return evaluations ? [evaluations] : []
}

export const buildEvaluationSearchText = (evaluation) => {
  return [
    evaluation?.tpiRef,
    evaluation?.year,
    evaluation?.tpiRemarque,
    evaluation?.datasHeader?.EntrepriseName,
    evaluation?.datasHeader?.["Candidat.eName"],
    evaluation?.datasHeader?.Expert1Name,
    evaluation?.datasHeader?.Expert2Name
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
    .map((value) => String(value))
    .join(" ")
    .toLowerCase()
}

export const filterEvaluationsByQuery = (evaluations, query) => {
  const normalizedQuery = normalizeText(query)
  const normalizedEvaluations = normalizeEvaluationList(evaluations)

  if (!normalizedQuery) {
    return normalizedEvaluations
  }

  return normalizedEvaluations.filter((evaluation) =>
    buildEvaluationSearchText(evaluation).includes(normalizedQuery)
  )
}
