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

  it("ecarte une limite consecutive backend absente de la planification locale courante", () => {
    const localAnalysis = {
      personOverlaps: [],
      sequenceViolations: [],
      classMismatches: []
    }

    const result = buildValidationResultFromSources(2026, {
      checkedAt: "2026-04-13T10:00:00.000Z",
      summary: {
        issueCount: 2,
        hardConflictCount: 2,
        sequenceViolationCount: 1,
        importIssueCount: 1
      },
      issues: [
        {
          type: "consecutive_limit",
          severity: "error",
          personId: "person-nemanja-pantic",
          personName: "Nemanja Pantic",
          consecutiveCount: 5,
          maxConsecutiveTpi: 4,
          slotKeys: [
            "2026-06-11|1",
            "2026-06-11|2",
            "2026-06-11|3",
            "2026-06-11|4",
            "2026-06-11|5"
          ],
          message: "Nemanja Pantic a 5 TPI consécutifs."
        },
        {
          type: "legacy_tpi_not_imported",
          severity: "error",
          reference: "TPI-2026-099",
          message: "TPI-2026-099 existe dans GestionTPI mais n'est pas encore intégré."
        }
      ]
    }, localAnalysis)

    expect(result.issues.map((issue) => issue.type)).toEqual(["legacy_tpi_not_imported"])
    expect(result.summary.issueCount).toBe(1)
    expect(result.summary.sequenceViolationCount).toBe(0)
    expect(result.summary.importIssueCount).toBe(1)
    expect(result.summary.isValid).toBe(false)
  })

  it("recalcule l etat bloquant quand un conflit backend localement absent est retire", () => {
    const result = buildValidationResultFromSources(2026, {
      checkedAt: "2026-04-13T10:00:00.000Z",
      summary: {
        hasHardConflicts: true,
        issueCount: 1,
        hardConflictCount: 1,
        sequenceViolationCount: 1
      },
      issues: [
        {
          type: "consecutive_limit",
          severity: "error",
          personName: "Nemanja Pantic",
          consecutiveCount: 5,
          maxConsecutiveTpi: 4,
          slotKeys: [
            "2026-06-11|1",
            "2026-06-11|2",
            "2026-06-11|3",
            "2026-06-11|4",
            "2026-06-11|5"
          ],
          message: "Nemanja Pantic a 5 TPI consécutifs."
        }
      ]
    }, {
      personOverlaps: [],
      sequenceViolations: [],
      classMismatches: []
    })

    expect(result.issues).toHaveLength(0)
    expect(result.summary.issueCount).toBe(0)
    expect(result.summary.hasHardConflicts).toBe(false)
    expect(result.summary.isValid).toBe(true)
  })

  it("conserve une limite consecutive backend confirmee par l analyse locale", () => {
    const localAnalysis = {
      sequenceViolations: [
        {
          personId: "person-nemanja-pantic",
          personName: "Nemanja Pantic",
          consecutiveCount: 5,
          maxConsecutiveTpi: 4,
          slotKeys: [
            "2026-06-11|1",
            "2026-06-11|2",
            "2026-06-11|3",
            "2026-06-11|4",
            "2026-06-11|5"
          ]
        }
      ]
    }

    const result = buildValidationResultFromSources(2026, {
      checkedAt: "2026-04-13T10:00:00.000Z",
      summary: {
        issueCount: 1,
        hardConflictCount: 1,
        sequenceViolationCount: 1
      },
      issues: [
        {
          type: "consecutive_limit",
          severity: "error",
          personId: "person-nemanja-pantic",
          personName: "Nemanja Pantic",
          consecutiveCount: 5,
          maxConsecutiveTpi: 4,
          slotKeys: [
            "2026-06-11|1",
            "2026-06-11|2",
            "2026-06-11|3",
            "2026-06-11|4",
            "2026-06-11|5"
          ],
          message: "Nemanja Pantic a 5 TPI consécutifs."
        }
      ]
    }, localAnalysis)

    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].type).toBe("consecutive_limit")
    expect(result.summary.sequenceViolationCount).toBe(1)
    expect(result.summary.hasHardConflicts).toBe(true)
    expect(result.summary.isValid).toBe(false)
  })

  it("ignore un conflit local de personne avec une seule reference", () => {
    const result = buildLocalValidationIssues({
      personOverlaps: [
        {
          personName: "Ada Lovelace",
          slotKey: "2026-06-10|1",
          period: 1,
          references: ["TPI-001"],
          roles: ["expert1"]
        }
      ]
    })

    expect(result.summary.issueCount).toBe(0)
    expect(result.issues).toHaveLength(0)
  })

  it("conserve le personId dans les issues locales de personne et de sequence", () => {
    const result = buildLocalValidationIssues({
      personOverlaps: [
        {
          personId: "person-ada",
          personName: "Ada Lovelace",
          slotKey: "2026-06-10|1",
          period: 1,
          references: ["TPI-001", "TPI-002"],
          roles: ["expert1"]
        }
      ],
      sequenceViolations: [
        {
          personId: "person-ada",
          personName: "Ada Lovelace",
          consecutiveCount: 5,
          maxConsecutiveTpi: 4,
          slotKeys: ["2026-06-10|1", "2026-06-10|2", "2026-06-10|3", "2026-06-10|4", "2026-06-10|5"]
        }
      ]
    })

    expect(result.summary.issueCount).toBe(2)
    expect(result.issues[0]).toMatchObject({
      type: "person_overlap",
      personId: "person-ada"
    })
    expect(result.issues[1]).toMatchObject({
      type: "consecutive_limit",
      personId: "person-ada"
    })
  })

  it("dedoublonne un conflit backend/local par personId meme si le nom affiche differe", () => {
    const result = buildValidationResultFromSources(2026, {
      checkedAt: "2026-04-13T10:00:00.000Z",
      summary: {
        issueCount: 1,
        hardConflictCount: 1,
        personOverlapCount: 1
      },
      issues: [
        {
          type: "person_overlap",
          severity: "error",
          dateKey: "2026-06-10",
          period: 1,
          personId: "person-patrick-chenaux",
          personName: "Patrick Chenaux",
          references: ["TPI-A23", "TPI-B22"],
          message: "Patrick Chenaux est affecté à plusieurs TPI sur le même créneau."
        }
      ]
    }, {
      personOverlaps: [
        {
          personId: "person-patrick-chenaux",
          personName: "P. Chenaux",
          slotKey: "2026-06-10|1",
          period: 1,
          references: ["TPI-A23", "TPI-B22"],
          roles: ["expert1", "expert2"]
        }
      ]
    })

    expect(result.summary.issueCount).toBe(1)
    expect(result.summary.personOverlapCount).toBe(1)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]).toMatchObject({
      type: "person_overlap",
      personId: "person-patrick-chenaux",
      personName: "Patrick Chenaux"
    })
  })

  it("dedoublonne un conflit backend/local meme si les references ont un format different", () => {
    const result = buildValidationResultFromSources(2026, {
      checkedAt: "2026-04-13T10:00:00.000Z",
      summary: {
        issueCount: 1,
        hardConflictCount: 1,
        personOverlapCount: 1
      },
      issues: [
        {
          type: "person_overlap",
          severity: "error",
          dateKey: "2026-06-10",
          period: 1,
          personName: "Carlos Perez",
          references: ["TPI-2026-1", "TPI-2026-3"],
          message: "Carlos Perez est affecté à plusieurs TPI sur le même créneau."
        }
      ]
    }, {
      personOverlaps: [
        {
          personName: "Carlos Perez",
          slotKey: "2026-06-10|1",
          period: 1,
          references: ["1", "3"],
          roles: ["expert1", "expert2"]
        }
      ]
    })

    expect(result.summary.issueCount).toBe(1)
    expect(result.summary.personOverlapCount).toBe(1)
    expect(result.issues).toHaveLength(1)
  })

  it("dedoublonne un room_overlap duplique par formats de references differents", () => {
    const result = buildValidationResultFromSources(2026, {
      checkedAt: "2026-04-13T10:00:00.000Z",
      summary: {
        issueCount: 2,
        hardConflictCount: 2,
        roomOverlapCount: 2
      },
      issues: [
        {
          type: "room_overlap",
          severity: "error",
          dateKey: "2026-06-10",
          period: 3,
          site: "VENNES",
          roomName: "Vennes - B22",
          references: ["TPI-2026-024", "TPI-2026-040"],
          message: "La salle VENNES Vennes - B22 est utilisee par plusieurs TPI."
        },
        {
          type: "room_overlap",
          severity: "error",
          dateKey: "2026-06-10",
          period: 3,
          site: "VENNES",
          roomName: "Vennes - B22",
          references: ["24", "40"],
          message: "La salle VENNES Vennes - B22 est utilisee par plusieurs TPI."
        }
      ]
    })

    expect(result.summary.issueCount).toBe(1)
    expect(result.summary.roomOverlapCount).toBe(1)
    expect(result.issues).toHaveLength(1)
  })

  it("dedoublonne un room_class_mismatch local/backend par reference normalisee", () => {
    const result = buildValidationResultFromSources(2026, {
      checkedAt: "2026-04-13T10:00:00.000Z",
      summary: {
        issueCount: 1,
        hardConflictCount: 1,
        classMismatchCount: 1
      },
      issues: [
        {
          type: "room_class_mismatch",
          severity: "error",
          reference: "TPI-2026-001",
          roomName: "Vennes - A23",
          roomSite: "VENNES",
          roomClassMode: "matu",
          tpiClassMode: "nonM",
          message: "TPI-2026-001 est associé à une salle MATU."
        }
      ]
    }, {
      classMismatches: [
        {
          reference: "1",
          candidat: "Alice Martin",
          classe: "DEV4",
          roomName: "Vennes - A23",
          roomSite: "VENNES",
          roomClassMode: "matu",
          tpiClassMode: "nonM"
        }
      ]
    })

    expect(result.summary.issueCount).toBe(1)
    expect(result.summary.classMismatchCount).toBe(1)
    expect(result.issues).toHaveLength(1)
  })

  it("ne dedoublonne pas deux conflits de personne sur deux periodes differentes", () => {
    const result = buildValidationResultFromSources(2026, {
      checkedAt: "2026-04-13T10:00:00.000Z",
      summary: {
        issueCount: 2,
        hardConflictCount: 2,
        personOverlapCount: 2
      },
      issues: [
        {
          type: "person_overlap",
          severity: "error",
          dateKey: "2026-06-10",
          period: 1,
          personName: "Carlos Perez",
          references: ["TPI-2026-1", "TPI-2026-3"],
          message: "Carlos Perez est affecté à plusieurs TPI sur le même créneau."
        },
        {
          type: "person_overlap",
          severity: "error",
          dateKey: "2026-06-10",
          period: 4,
          personName: "Carlos Perez",
          references: ["TPI-2026-6", "TPI-2026-8"],
          message: "Carlos Perez est affecté à plusieurs TPI sur le même créneau."
        }
      ]
    })

    expect(result.summary.issueCount).toBe(2)
    expect(result.summary.personOverlapCount).toBe(2)
    expect(result.issues).toHaveLength(2)
  })

  it("ne compte pas un avertissement inconnu comme erreur bloquante", () => {
    const result = buildValidationResultFromSources(2026, {
      checkedAt: "2026-04-13T10:00:00.000Z",
      summary: {
        issueCount: 0,
        hardConflictCount: 0,
        warningCount: 1
      },
      issues: [
        {
          type: "manual_warning",
          severity: "warning",
          reference: "TPI-001",
          message: "Controle manuel requis."
        }
      ]
    })

    expect(result.summary.issueCount).toBe(0)
    expect(result.summary.warningCount).toBe(1)
    expect(result.summary.isValid).toBe(true)
    expect(result.issues).toHaveLength(1)
  })

  it("dedoublonne un avertissement backend d override avec l analyse locale", () => {
    const localAnalysis = {
      sequenceViolations: [
        {
          personName: "Grace Hopper",
          consecutiveCount: 5,
          slotKeys: ["2026-06-11|1", "2026-06-11|2", "2026-06-11|3", "2026-06-11|4", "2026-06-11|5"]
        }
      ]
    }

    const result = buildValidationResultFromSources(2026, {
      checkedAt: "2026-04-13T10:00:00.000Z",
      summary: {
        issueCount: 0,
        hardConflictCount: 0,
        warningCount: 1
      },
      issues: [
        {
          type: "consecutive_limit",
          severity: "warning",
          isConstraintOverride: true,
          personName: "Grace Hopper",
          consecutiveCount: 5,
          slotKeys: ["2026-06-11|1", "2026-06-11|2", "2026-06-11|3", "2026-06-11|4", "2026-06-11|5"],
          message: "Grace Hopper a 5 TPI consécutifs."
        }
      ]
    }, localAnalysis)

    expect(result.summary.issueCount).toBe(0)
    expect(result.summary.warningCount).toBe(1)
    expect(result.summary.isValid).toBe(true)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].severity).toBe("warning")
  })
})
