import {
  buildEvaluationSearchText,
  filterEvaluationsByQuery,
  getEvaluationStorageKey,
  normalizeEvaluationList
} from "./tpiEvalUtils"

test("getEvaluationStorageKey prefers the explicit evaluation id", () => {
  expect(
    getEvaluationStorageKey({
      id: 42,
      year: 2026,
      tpiRef: "TPI-001"
    })
  ).toBe("42")
})

test("getEvaluationStorageKey falls back to year and reference", () => {
  expect(
    getEvaluationStorageKey({
      year: 2026,
      tpiRef: "TPI-001"
    })
  ).toBe("2026:TPI-001")
})

test("normalizeEvaluationList always returns an array", () => {
  expect(normalizeEvaluationList(null)).toEqual([])
  expect(normalizeEvaluationList({ id: 1 })).toEqual([{ id: 1 }])
  expect(normalizeEvaluationList([{ id: 1 }, null, { id: 2 }])).toEqual([
    { id: 1 },
    { id: 2 }
  ])
})

test("buildEvaluationSearchText combines the relevant fields", () => {
  const text = buildEvaluationSearchText({
    tpiRef: "TPI-001",
    year: 2026,
    tpiRemarque: "Projet web",
    datasHeader: {
      EntrepriseName: "ETML / ACME",
      "Candidat.eName": "Ada Lovelace"
    }
  })

  expect(text).toContain("tpi-001")
  expect(text).toContain("2026")
  expect(text).toContain("projet web")
  expect(text).toContain("acme")
  expect(text).toContain("ada lovelace")
})

test("filterEvaluationsByQuery matches candidate, company and reference", () => {
  const evaluations = [
    {
      tpiRef: "TPI-001",
      datasHeader: {
        EntrepriseName: "ETML / ACME",
        "Candidat.eName": "Ada Lovelace"
      }
    },
    {
      tpiRef: "TPI-002",
      datasHeader: {
        EntrepriseName: "ETML / Globex",
        "Candidat.eName": "Grace Hopper"
      }
    }
  ]

  expect(filterEvaluationsByQuery(evaluations, "lovelace")).toHaveLength(1)
  expect(filterEvaluationsByQuery(evaluations, "globex")).toHaveLength(1)
  expect(filterEvaluationsByQuery(evaluations, "TPI-002")).toHaveLength(1)
  expect(filterEvaluationsByQuery(evaluations, "")).toHaveLength(2)
})
