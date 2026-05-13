import { buildPlanningSlotKey, buildValidationMarkers } from "./tpiScheduleValidationMarkers"

const makeCard = (refTpi, candidat, expert1, expert2, boss) => ({
  refTpi,
  candidat,
  expert1: { name: expert1 },
  expert2: { name: expert2 },
  boss: { name: boss }
})

const makeCardWithStakeholders = (refTpi, overrides = {}) => ({
  refTpi,
  candidat: `Candidat ${refTpi}`,
  candidatPersonId: '',
  expert1: { name: `Expert 1 ${refTpi}`, personId: '' },
  expert2: { name: `Expert 2 ${refTpi}`, personId: '' },
  boss: { name: `Chef ${refTpi}`, personId: '' },
  ...overrides
})

const makeRoom = ({ date, name, site = "ETML", cards }) => ({
  date,
  name,
  site,
  tpiDatas: cards
})

describe("tpiScheduleValidationMarkers", () => {
  it("marque les cartes impliquees par ref, personne et slot", () => {
    const rooms = [
      makeRoom({
        date: "2026-06-10",
        name: "A101",
        cards: [
          makeCard("TPI-001", "Alice Martin", "Ada Lovelace", "Grace Hopper", "Boss 1"),
          makeCard("TPI-002", "Bob Dupont", "Ada Lovelace", "Expert 2", "Boss 2")
        ]
      }),
      makeRoom({
        date: "2026-06-10",
        name: "A102",
        cards: [
          makeCard("TPI-003", "Chloe Bernard", "Ada Lovelace", "Expert 4", "Grace Hopper")
        ]
      })
    ]

    const validationResult = {
      issues: [
        {
          type: "person_overlap",
          personName: "Ada Lovelace",
          dateKey: "2026-06-10",
          period: 1,
          references: ["TPI-001", "TPI-003"],
          message: "Ada Lovelace est affecté à plusieurs TPI sur le même créneau."
        },
        {
          type: "room_class_mismatch",
          reference: "TPI-002",
          message: "TPI-002 est associé à une salle non compatible."
        },
        {
          type: "consecutive_limit",
          personName: "Grace Hopper",
          consecutiveCount: 5,
          slotKeys: ["2026-06-10|1"],
          message: "Grace Hopper a 5 TPI consécutifs."
        }
      ]
    }

    const markers = buildValidationMarkers(rooms, validationResult)
    const slotA101P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "A101"
    })
    const slotA101P2 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 2,
      site: "ETML",
      roomName: "A101"
    })
    const slotA102P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "A102"
    })

    expect(markers[slotA101P1]).toBeDefined()
    expect(markers[slotA101P1]).toMatchObject({
      hasError: true,
      primaryIssueType: "person_overlap",
      tone: "danger",
      issueTones: ["danger", "sequence"],
      hasMultipleIssueTypes: true
    })
    expect(markers[slotA101P1].messages).toContain("Ada Lovelace est affecté à plusieurs TPI sur le même créneau.")
    expect(markers[slotA101P1].messages).toContain("Grace Hopper a 5 TPI consécutifs.")

    expect(markers[slotA101P2]).toBeDefined()
    expect(markers[slotA101P2]).toMatchObject({
      primaryIssueType: "room_class_mismatch",
      tone: "room"
    })
    expect(markers[slotA101P2].messages).toEqual([
      "TPI-002 est associé à une salle non compatible."
    ])

    expect(markers[slotA102P1]).toBeDefined()
    expect(markers[slotA102P1]).toMatchObject({
      primaryIssueType: "person_overlap",
      tone: "danger"
    })
    expect(markers[slotA102P1].messages).toContain("Ada Lovelace est affecté à plusieurs TPI sur le même créneau.")
  })

  it("marque aussi les conflits locaux avant une validation backend", () => {
    const rooms = [
      makeRoom({
        date: "2026-06-10",
        name: "A101",
        cards: [
          makeCard("TPI-001", "Alice Martin", "Ada Lovelace", "Grace Hopper", "Boss 1")
        ]
      }),
      makeRoom({
        date: "2026-06-10",
        name: "A102",
        cards: [
          makeCard("TPI-002", "Bob Dupont", "Ada Lovelace", "Expert 2", "Boss 2")
        ]
      })
    ]

    const markers = buildValidationMarkers(rooms, null, {
      conflictCount: 1,
      conflicts: [
        {
          personName: "Ada Lovelace",
          slotKey: "2026-06-10|1",
          period: 1,
          references: ["TPI-001", "TPI-002"]
        }
      ]
    })

    const slotA101P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "A101"
    })
    const slotA102P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "A102"
    })

    expect(markers[slotA101P1]).toBeDefined()
    expect(markers[slotA102P1]).toBeDefined()
    expect(markers[slotA101P1].messages[0]).toMatch(/Ada Lovelace est affecté à plusieurs TPI/)
    expect(markers[slotA102P1].messages[0]).toMatch(/Ada Lovelace est affecté à plusieurs TPI/)
  })

  it("fait correspondre les references backend completes avec les refTpi numeriques des cartes", () => {
    const rooms = [
      makeRoom({
        date: "2026-06-10",
        name: "A101",
        cards: [
          makeCard(1, "Alice Martin", "Ada Lovelace", "Grace Hopper", "Boss 1")
        ]
      }),
      makeRoom({
        date: "2026-06-10",
        name: "A102",
        cards: [
          makeCard(3, "Bob Dupont", "Ada Lovelace", "Expert 2", "Boss 2")
        ]
      })
    ]

    const markers = buildValidationMarkers(rooms, {
      issues: [
        {
          type: "person_overlap",
          severity: "error",
          personName: "Ada Lovelace",
          dateKey: "2026-06-10",
          period: 1,
          references: ["TPI-2026-1", "TPI-2026-3"],
          message: "Ada Lovelace est affecté à plusieurs TPI sur le même créneau."
        }
      ]
    })

    const slotA101P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "A101"
    })
    const slotA102P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "A102"
    })

    expect(markers[slotA101P1]).toMatchObject({
      hasError: true,
      primaryIssueType: "person_overlap",
      tone: "danger"
    })
    expect(markers[slotA102P1]).toMatchObject({
      hasError: true,
      primaryIssueType: "person_overlap",
      tone: "danger"
    })
  })

  it("fait correspondre les references backend avec zeros et les refTpi numeriques", () => {
    const rooms = [
      makeRoom({
        date: "2026-06-10",
        name: "A101",
        cards: [
          makeCard(1, "Alice Martin", "Ada Lovelace", "Grace Hopper", "Boss 1")
        ]
      })
    ]

    const markers = buildValidationMarkers(rooms, {
      issues: [
        {
          type: "room_class_mismatch",
          severity: "error",
          reference: "TPI-2026-001",
          message: "TPI-2026-001 est associé à une salle non compatible."
        }
      ]
    })

    const slotA101P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "A101"
    })

    expect(markers[slotA101P1]).toMatchObject({
      hasError: true,
      primaryIssueType: "room_class_mismatch",
      tone: "room"
    })
  })

  it("utilise id comme reference de secours quand refTpi est absent", () => {
    const rooms = [
      makeRoom({
        date: "2026-06-10",
        name: "A101",
        cards: [
          {
            id: "TPI-2026-7",
            candidat: "Alice Martin",
            expert1: { name: "Ada Lovelace" },
            expert2: { name: "Grace Hopper" },
            boss: { name: "Boss 1" }
          }
        ]
      })
    ]

    const markers = buildValidationMarkers(rooms, {
      issues: [
        {
          type: "legacy_tpi_not_imported",
          reference: "TPI-2026-7",
          message: "TPI-2026-7 doit etre controle."
        }
      ]
    })

    const slotA101P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "A101"
    })

    expect(markers[slotA101P1]).toMatchObject({
      hasError: true,
      primaryIssueType: "legacy_tpi_not_imported",
      tone: "import"
    })
  })

  it("ne marque pas une reference de conflit de creneau si la carte locale a change de periode", () => {
    const rooms = [
      makeRoom({
        date: "2026-06-10",
        name: "A101",
        cards: [
          makeCard("", "", "", "", ""),
          makeCard(1, "Alice Martin", "Ada Lovelace", "Grace Hopper", "Boss 1")
        ]
      })
    ]

    const markers = buildValidationMarkers(rooms, {
      issues: [
        {
          type: "person_overlap",
          severity: "error",
          personName: "Ada Lovelace",
          dateKey: "2026-06-10",
          period: 1,
          references: ["TPI-2026-1"],
          message: "Ada Lovelace est affecté à plusieurs TPI sur le même créneau."
        }
      ]
    })

    const slotA101P2 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 2,
      site: "ETML",
      roomName: "A101"
    })

    expect(markers[slotA101P2]).toBeUndefined()
  })

  it("retombe sur la personne et le creneau quand les references backend ne matchent aucune carte", () => {
    const rooms = [
      makeRoom({
        date: "2026-06-10",
        name: "A101",
        cards: [
          makeCard("TPI-local-1", "Alice Martin", "Ada Lovelace", "Grace Hopper", "Boss 1")
        ]
      }),
      makeRoom({
        date: "2026-06-10",
        name: "A102",
        cards: [
          makeCard("TPI-local-2", "Bob Dupont", "Ada Lovelace", "Expert 2", "Boss 2")
        ]
      })
    ]

    const markers = buildValidationMarkers(rooms, {
      issues: [
        {
          type: "person_overlap",
          severity: "error",
          personName: "Ada Lovelace",
          dateKey: "2026-06-10",
          period: 1,
          references: ["TPI-2026-999", "TPI-2026-998"],
          message: "Ada Lovelace est affecté à plusieurs TPI sur le même créneau."
        }
      ]
    })

    const slotA101P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "A101"
    })
    const slotA102P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "A102"
    })

    expect(markers[slotA101P1]).toMatchObject({
      hasError: true,
      primaryIssueType: "person_overlap"
    })
    expect(markers[slotA102P1]).toMatchObject({
      hasError: true,
      primaryIssueType: "person_overlap"
    })
  })

  it("ne marque pas un room_overlap si la salle locale ne correspond plus a l issue", () => {
    const rooms = [
      makeRoom({
        date: "2026-06-10",
        name: "B21",
        site: "VENNES",
        cards: [
          makeCard(24, "Alice Martin", "Ada Lovelace", "Grace Hopper", "Boss 1")
        ]
      })
    ]

    const markers = buildValidationMarkers(rooms, {
      issues: [
        {
          type: "room_overlap",
          severity: "error",
          dateKey: "2026-06-10",
          period: 1,
          site: "VENNES",
          roomName: "B22",
          references: ["TPI-2026-24", "TPI-2026-40"],
          message: "La salle VENNES B22 est utilisee par plusieurs TPI sur le meme creneau."
        }
      ]
    })

    const slotB21P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "VENNES",
      roomName: "B21"
    })

    expect(markers[slotB21P1]).toBeUndefined()
  })

  it("marque un room_overlap quand les references et le slot local correspondent", () => {
    const rooms = [
      makeRoom({
        date: "2026-06-10",
        name: "B22",
        site: "VENNES",
        cards: [
          makeCard(24, "Alice Martin", "Ada Lovelace", "Grace Hopper", "Boss 1")
        ]
      })
    ]

    const markers = buildValidationMarkers(rooms, {
      issues: [
        {
          type: "room_overlap",
          severity: "error",
          dateKey: "2026-06-10",
          period: 1,
          site: "VENNES",
          roomName: "B22",
          references: ["TPI-2026-024", "TPI-2026-40"],
          message: "La salle VENNES B22 est utilisee par plusieurs TPI sur le meme creneau."
        }
      ]
    })

    const slotB22P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "VENNES",
      roomName: "B22"
    })

    expect(markers[slotB22P1]).toMatchObject({
      hasError: true,
      primaryIssueType: "room_overlap",
      tone: "danger"
    })
  })

  it("marque A23 et B22 quand le conflit backend cible le personId de Patrick Chenaux", () => {
    const rooms = [
      makeRoom({
        date: "2026-06-10",
        name: "A23",
        cards: [
          makeCardWithStakeholders("TPI-A23", {
            expert1: { name: "Patrick Chenaux", personId: "person-patrick-chenaux" }
          })
        ]
      }),
      makeRoom({
        date: "2026-06-10",
        name: "B22",
        cards: [
          makeCardWithStakeholders("TPI-B22", {
            expert2: { name: "P. Chenaux", personId: "person-patrick-chenaux" }
          })
        ]
      })
    ]

    const markers = buildValidationMarkers(rooms, {
      issues: [
        {
          type: "person_overlap",
          severity: "error",
          personId: "person-patrick-chenaux",
          personName: "Patrick Chenaux",
          dateKey: "2026-06-10",
          period: 1,
          references: [],
          message: "Patrick Chenaux est affecté à plusieurs TPI sur le même créneau."
        }
      ]
    })

    const slotA23P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "A23"
    })
    const slotB22P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "B22"
    })

    expect(markers[slotA23P1]).toMatchObject({
      hasError: true,
      issueTypes: ["person_overlap"]
    })
    expect(markers[slotB22P1]).toMatchObject({
      hasError: true,
      issueTypes: ["person_overlap"]
    })
  })

  it("marque une limite consecutive par personId meme si les noms affiches different", () => {
    const rooms = [
      makeRoom({
        date: "2026-06-10",
        name: "A101",
        cards: [
          makeCardWithStakeholders("TPI-A", {
            expert1: { name: "Patrick Chenaux", personId: "person-patrick-chenaux" }
          }),
          makeCardWithStakeholders("TPI-B", {
            expert1: { name: "P. Chenaux", personId: "person-patrick-chenaux" }
          })
        ]
      })
    ]

    const markers = buildValidationMarkers(rooms, {
      issues: [
        {
          type: "consecutive_limit",
          severity: "error",
          personId: "person-patrick-chenaux",
          personName: "Patrick Chenaux",
          consecutiveCount: 5,
          slotKeys: ["2026-06-10|1", "2026-06-10|2"],
          message: "Patrick Chenaux a 5 TPI consécutifs."
        }
      ]
    })

    const slotA101P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "A101"
    })
    const slotA101P2 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 2,
      site: "ETML",
      roomName: "A101"
    })

    expect(markers[slotA101P1]).toMatchObject({
      hasError: true,
      primaryIssueType: "consecutive_limit",
      tone: "sequence"
    })
    expect(markers[slotA101P2]).toMatchObject({
      hasError: true,
      primaryIssueType: "consecutive_limit",
      tone: "sequence"
    })
  })

  it("retrouve une personne par nom meme si les accents different", () => {
    const rooms = [
      makeRoom({
        date: "2026-06-10",
        name: "A23",
        cards: [
          makeCardWithStakeholders("TPI-A23", {
            expert1: { name: "Nemanja Pantic", personId: "" }
          })
        ]
      }),
      makeRoom({
        date: "2026-06-10",
        name: "B22",
        cards: [
          makeCardWithStakeholders("TPI-B22", {
            expert2: { name: "Némanja Pantic", personId: "" }
          })
        ]
      })
    ]

    const markers = buildValidationMarkers(rooms, {
      issues: [
        {
          type: "person_overlap",
          severity: "error",
          personName: "Nemanja Pantic",
          dateKey: "2026-06-10",
          period: 1,
          references: [],
          message: "Nemanja Pantic est affecté à plusieurs TPI sur le même créneau."
        }
      ]
    })

    const slotA23P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "A23"
    })
    const slotB22P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "B22"
    })

    expect(markers[slotA23P1]).toMatchObject({
      hasError: true,
      issueTypes: ["person_overlap"]
    })
    expect(markers[slotB22P1]).toMatchObject({
      hasError: true,
      issueTypes: ["person_overlap"]
    })
  })

  it("ne transforme pas un avertissement d override en erreur visuelle", () => {
    const rooms = [
      makeRoom({
        date: "2026-06-10",
        name: "A101",
        cards: [
          makeCard("TPI-001", "Alice Martin", "Grace Hopper", "Expert 2", "Boss 1")
        ]
      })
    ]

    const markers = buildValidationMarkers(rooms, {
      issues: [
        {
          type: "consecutive_limit",
          severity: "warning",
          isConstraintOverride: true,
          personName: "Grace Hopper",
          slotKeys: ["2026-06-10|1"],
          message: "Grace Hopper a 5 TPI consécutifs."
        }
      ]
    })

    const slotA101P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "A101"
    })

    expect(markers[slotA101P1]).toBeDefined()
    expect(markers[slotA101P1].hasError).toBe(false)
    expect(markers[slotA101P1].hasWarning).toBe(true)
    expect(markers[slotA101P1]).toMatchObject({
      severity: "warning",
      primaryIssueType: "consecutive_limit",
      tone: "sequence"
    })
  })

  it("ne duplique pas le message quand backend et analyse locale remontent le meme conflit", () => {
    const rooms = [
      makeRoom({
        date: "2026-06-10",
        name: "A101",
        cards: [
          makeCard("TPI-001", "Alice Martin", "Ada Lovelace", "Grace Hopper", "Boss 1")
        ]
      }),
      makeRoom({
        date: "2026-06-10",
        name: "A102",
        cards: [
          makeCard("TPI-002", "Bob Dupont", "Ada Lovelace", "Expert 2", "Boss 2")
        ]
      })
    ]

    const duplicateMessage = "Ada Lovelace est affecté à plusieurs TPI sur le même créneau (TPI-001, TPI-002)."
    const markers = buildValidationMarkers(rooms, {
      issues: [
        {
          type: "person_overlap",
          severity: "error",
          personName: "Ada Lovelace",
          dateKey: "2026-06-10",
          period: 1,
          references: ["TPI-001", "TPI-002"],
          message: duplicateMessage
        }
      ]
    }, {
      personOverlaps: [
        {
          personName: "Ada Lovelace",
          slotKey: "2026-06-10|1",
          period: 1,
          references: ["TPI-001", "TPI-002"]
        }
      ]
    })

    const slotA101P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "A101"
    })

    expect(markers[slotA101P1].messages).toEqual([duplicateMessage])
    expect(markers[slotA101P1].issueTypes).toEqual(["person_overlap"])
  })

  it("affiche un avertissement inconnu en ton warning et sans erreur", () => {
    const rooms = [
      makeRoom({
        date: "2026-06-10",
        name: "A101",
        cards: [
          makeCard("TPI-001", "Alice Martin", "Grace Hopper", "Expert 2", "Boss 1")
        ]
      })
    ]

    const markers = buildValidationMarkers(rooms, {
      issues: [
        {
          type: "manual_warning",
          severity: "warning",
          reference: "TPI-001",
          message: "Controle manuel requis."
        }
      ]
    })

    const slotA101P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "A101"
    })

    expect(markers[slotA101P1]).toMatchObject({
      hasError: false,
      hasWarning: true,
      severity: "warning",
      primaryIssueType: "manual_warning",
      tone: "warning"
    })
  })

  it("marque les issues inconnues par reference avec un ton de repli", () => {
    const rooms = [
      makeRoom({
        date: "2026-06-10",
        name: "A101",
        cards: [
          makeCard("TPI-001", "Alice Martin", "Grace Hopper", "Expert 2", "Boss 1")
        ]
      })
    ]

    const markers = buildValidationMarkers(rooms, {
      issues: [
        {
          type: "legacy_tpi_not_imported",
          reference: "TPI-001",
          message: "TPI-001 n'a pas pu être importé."
        }
      ]
    })

    const slotA101P1 = buildPlanningSlotKey({
      dateValue: "2026-06-10",
      period: 1,
      site: "ETML",
      roomName: "A101"
    })

    expect(markers[slotA101P1]).toMatchObject({
      hasError: true,
      primaryIssueType: "legacy_tpi_not_imported",
      tone: "import",
      messages: ["TPI-001 n'a pas pu être importé."]
    })
  })
})
