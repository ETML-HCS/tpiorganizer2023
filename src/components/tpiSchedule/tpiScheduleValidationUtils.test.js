import {
  buildLocalValidationIssues,
  buildValidationResultFromSources
} from "./tpiScheduleValidationUtils"

describe("tpiScheduleValidationUtils", () => {
  it("relit les hardConflicts de l API meme quand issues est absent", () => {
    const result = buildValidationResultFromSources(2026, {
      checkedAt: "2026-04-13T10:00:00.000Z",
      summary: {
        issueCount: 1,
        hardConflictCount: 1,
        personOverlapCount: 1
      },
      hardConflicts: [
        {
          type: "person_overlap",
          severity: "error",
          dateKey: "2026-06-10",
          period: 2,
          personName: "Ada Lovelace",
          references: ["TPI-001", "TPI-002"],
          message: "Ada Lovelace est affecté à plusieurs TPI sur le même créneau (TPI-001, TPI-002)."
        }
      ]
    })

    expect(result.summary.issueCount).toBe(1)
    expect(result.summary.personOverlapCount).toBe(1)
    expect(result.summary.isValid).toBe(false)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].type).toBe("person_overlap")
  })

  it("conserve les conflits locaux restants meme si la validation backend revient vide", () => {
    const localAnalysis = {
      personOverlaps: [
        {
          personName: "Grace Hopper",
          slotKey: "2026-06-11|3",
          period: 3,
          references: ["TPI-010", "TPI-011"],
          roles: ["expert1"]
        }
      ],
      sequenceViolations: [
        {
          personName: "Grace Hopper",
          consecutiveCount: 5,
          slotKeys: ["2026-06-11|1", "2026-06-11|2", "2026-06-11|3", "2026-06-11|4", "2026-06-11|5"]
        }
      ],
      classMismatches: [
        {
          reference: "TPI-012",
          candidat: "Linus Torvalds",
          classe: "DEV4",
          roomName: "MATU-1",
          roomSite: "ETML",
          roomClassMode: "matu",
          tpiClassMode: "nonM"
        }
      ]
    }

    const result = buildValidationResultFromSources(2026, {
      checkedAt: "2026-04-13T10:00:00.000Z",
      summary: {
        issueCount: 0,
        hardConflictCount: 0,
        personOverlapCount: 0,
        sequenceViolationCount: 0
      },
      hardConflicts: []
    }, localAnalysis)

    expect(buildLocalValidationIssues(localAnalysis).issues).toHaveLength(3)
    expect(result.summary.issueCount).toBe(3)
    expect(result.summary.personOverlapCount).toBe(1)
    expect(result.summary.sequenceViolationCount).toBe(1)
    expect(result.summary.classMismatchCount).toBe(1)
    expect(result.summary.isValid).toBe(false)
    expect(result.issues.map((issue) => issue.type)).toEqual([
      "person_overlap",
      "consecutive_limit",
      "room_class_mismatch"
    ])
  })
})
