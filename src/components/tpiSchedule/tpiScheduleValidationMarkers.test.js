import { buildPlanningSlotKey, buildValidationMarkers } from "./tpiScheduleValidationMarkers"

const makeCard = (refTpi, candidat, expert1, expert2, boss) => ({
  refTpi,
  candidat,
  expert1: { name: expert1 },
  expert2: { name: expert2 },
  boss: { name: boss }
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
    expect(markers[slotA101P1].messages).toContain("Ada Lovelace est affecté à plusieurs TPI sur le même créneau.")
    expect(markers[slotA101P1].messages).toContain("Grace Hopper a 5 TPI consécutifs.")

    expect(markers[slotA101P2]).toBeDefined()
    expect(markers[slotA101P2].messages).toEqual([
      "TPI-002 est associé à une salle non compatible."
    ])

    expect(markers[slotA102P1]).toBeDefined()
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
})
