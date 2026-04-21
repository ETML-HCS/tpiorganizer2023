import {
  getNonImportableTpiRefs,
  hasMeaningfulPlanningAssignment,
  isPlanningTpiImportable
} from "./tpiScheduleImportability"

describe("tpiScheduleImportability", () => {
  test("ignore les créneaux vides générés avec un id technique", () => {
    const rooms = [
      {
        tpiDatas: [
          {
            id: "vennes_4_7",
            refTpi: null,
            candidat: "",
            candidatPersonId: "",
            expert1: { name: "", personId: "" },
            expert2: { name: "", personId: "" },
            boss: { name: "", personId: "" }
          }
        ]
      }
    ]

    expect(hasMeaningfulPlanningAssignment(rooms[0].tpiDatas[0])).toBe(false)
    expect(getNonImportableTpiRefs(rooms)).toEqual([])
  })

  test("considère importable un TPI résolu via les personId même si le nom local est vide", () => {
    const tpi = {
      refTpi: "35",
      candidat: "",
      candidatPersonId: "cand-001",
      expert1: { name: "", personId: "exp-001" },
      expert2: { name: "", personId: "exp-002" },
      boss: { name: "", personId: "boss-001" }
    }

    expect(hasMeaningfulPlanningAssignment(tpi)).toBe(true)
    expect(isPlanningTpiImportable(tpi)).toBe(true)
    expect(getNonImportableTpiRefs([{ tpiDatas: [tpi] }])).toEqual([])
  })

  test("bloque uniquement les vraies cartes incomplètes", () => {
    const tpi = {
      refTpi: "99",
      candidat: "Alice Example",
      candidatPersonId: "",
      expert1: { name: "Expert One", personId: "" },
      expert2: { name: "", personId: "" },
      boss: { name: "Chef Projet", personId: "" }
    }

    expect(isPlanningTpiImportable(tpi)).toBe(false)
    expect(getNonImportableTpiRefs([{ tpiDatas: [tpi] }])).toEqual(["99"])
  })
})
