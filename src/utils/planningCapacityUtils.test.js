import { buildPlanningRoomSizingOverview } from "./planningCapacityUtils"

describe("planningCapacityUtils", () => {
  const makePerson = (id, firstName, lastName) => ({
    _id: id,
    firstName,
    lastName
  })

  it("calculates a theoretical room optimum without inflating it because of repeated stakeholders", () => {
    const overview = buildPlanningRoomSizingOverview({
      tpis: [
        {
          site: "sebeillon",
          classe: "cid4a",
          candidat: makePerson("cand-1", "Alice", "One"),
          expert1: makePerson("expert-1", "Marie", "Dupont"),
          expert2: makePerson("expert-2", "Nadia", "Rossi"),
          chefProjet: makePerson("boss-1", "Paul", "Martin")
        },
        {
          site: "SEBEILLON",
          classe: "CID4A",
          candidat: makePerson("cand-2", "Bob", "Two"),
          expert1: makePerson("expert-1", "Marie", "Dupont"),
          expert2: makePerson("expert-2", "Nadia", "Rossi"),
          chefProjet: makePerson("boss-1", "Paul", "Martin")
        },
        {
          site: "SEBEILLON",
          classe: "cid4a",
          candidat: makePerson("cand-3", "Charly", "Three"),
          expert1: makePerson("expert-1", "Marie", "Dupont"),
          expert2: makePerson("expert-2", "Nadia", "Rossi"),
          chefProjet: makePerson("boss-1", "Paul", "Martin")
        },
        {
          site: "SEBEILLON",
          classe: "cid4a",
          candidat: makePerson("cand-4", "Diane", "Four"),
          expert1: makePerson("expert-1", "Marie", "Dupont"),
          expert2: makePerson("expert-2", "Nadia", "Rossi"),
          chefProjet: makePerson("boss-1", "Paul", "Martin")
        }
      ],
      catalogSites: [
        {
          id: "site-sebeillon",
          code: "SEBEILLON",
          label: "Sébeillon",
          active: true,
          roomDetails: [
            { id: "room-1", code: "A101", label: "A101", active: true },
            { id: "room-2", code: "A102", label: "A102", active: true }
          ]
        }
      ],
      siteConfigs: [
        {
          siteId: "site-sebeillon",
          siteCode: "SEBEILLON",
          numSlots: 4,
          tpiTimeMinutes: 60,
          breaklineMinutes: 10
        }
      ]
    })

    expect(overview.totals.tpiCount).toBe(4)
    expect(overview.totals.activeRoomCount).toBe(2)
    expect(overview.totals.theoreticalRooms).toBe(1)
    expect(overview.totals.operationalRooms).toBe(1)
    expect(overview.totals.recommendedRooms).toBe(1)
    expect(overview.totals.roomGap).toBe(-1)
    expect(overview.totals.shortageRooms).toBe(0)
    expect(overview.totals.surplusRooms).toBe(1)

    expect(overview.sites).toHaveLength(1)
    expect(overview.sites[0].siteLabel).toBe("Sébeillon")
    expect(overview.sites[0].siteStatusLabel).toBe("Actif")
    expect(overview.sites[0].classTypeCounts).toEqual([{ code: "CFC", count: 4 }])
    expect(overview.sites[0].scheduleLabel).toBe("4 créneaux/salle · 60 min/TPI · pause 10 min")
    expect(overview.sites[0].typeBreakdowns).toEqual([
      expect.objectContaining({
        code: "CFC",
        tpiCount: 4,
        dateCount: 0,
        optimalRooms: 1
      })
    ])
    expect(overview.sites[0].constraintHints).toContain("Conflits de parties prenantes à vérifier en planification.")
  })

  it("keeps catalog sites visible even without TPI and flags missing sites", () => {
    const overview = buildPlanningRoomSizingOverview({
      tpis: [
        {
          classe: "matu3a",
          candidat: makePerson("cand-5", "Eva", "Five"),
          expert1: makePerson("expert-3", "Noah", "Green"),
          expert2: makePerson("expert-4", "Lina", "Blue"),
          chefProjet: makePerson("boss-2", "Sara", "White")
        }
      ],
      catalogSites: [
        {
          id: "site-a",
          code: "SITEA",
          label: "Site A",
          active: true,
          roomDetails: [
            { id: "room-1", code: "R1", label: "R1", active: true }
          ]
        }
      ],
      siteConfigs: [
        {
          siteId: "site-a",
          siteCode: "SITEA",
          numSlots: 8
        }
      ]
    })

    expect(overview.sites).toHaveLength(2)
    expect(overview.sites[0].siteLabel).toBe("Site A")
    expect(overview.sites[0].tpiCount).toBe(0)
    expect(overview.sites[0].recommendedRooms).toBe(0)
    expect(overview.sites[0].roomGap).toBe(-1)
    expect(overview.sites[1].siteLabel).toBe("Sans site")
    expect(overview.totals.shortageRooms).toBe(1)
    expect(overview.totals.surplusRooms).toBe(1)
    expect(overview.totals.roomGap).toBe(0)
    expect(overview.notes).toContain("1 TPI sans site")
  })

  it("uses a manual room target when provided on the site config", () => {
    const overview = buildPlanningRoomSizingOverview({
      tpis: [
        {
          site: "SEBEILLON",
          classe: "cid4a",
          candidat: makePerson("cand-1", "Alice", "One")
        },
        {
          site: "SEBEILLON",
          classe: "cid4a",
          candidat: makePerson("cand-2", "Bob", "Two")
        }
      ],
      catalogSites: [
        {
          id: "site-sebeillon",
          code: "SEBEILLON",
          label: "Sébeillon",
          active: true,
          roomDetails: [
            { id: "room-1", code: "A101", label: "A101", active: true }
          ]
        }
      ],
      siteConfigs: [
        {
          siteId: "site-sebeillon",
          siteCode: "SEBEILLON",
          numSlots: 4,
          manualRoomTarget: 3
        }
      ]
    })

    expect(overview.sites).toHaveLength(1)
    expect(overview.sites[0].recommendedRooms).toBe(1)
    expect(overview.sites[0].targetRooms).toBe(3)
    expect(overview.sites[0].usesManualRoomTarget).toBe(true)
    expect(overview.sites[0].roomGap).toBe(2)
    expect(overview.totals.targetRooms).toBe(3)
    expect(overview.totals.manualOverrideCount).toBe(1)
  })

  it("reuses the same room names across multiple configured soutenance dates", () => {
    const overview = buildPlanningRoomSizingOverview({
      tpis: Array.from({ length: 16 }, (_, index) => ({
        site: "SEBEILLON",
        classe: "CFC",
        candidat: makePerson(`cand-${index + 1}`, `Cand${index + 1}`, "Multi")
      })),
      catalogSites: [
        {
          id: "site-sebeillon",
          code: "SEBEILLON",
          label: "Sébeillon",
          active: true,
          roomDetails: [
            { id: "room-1", code: "A101", label: "A101", active: true }
          ]
        }
      ],
      siteConfigs: [
        {
          siteId: "site-sebeillon",
          siteCode: "SEBEILLON",
          numSlots: 8
        }
      ],
      classTypes: [
        {
          code: "CFC",
          prefix: "C",
          label: "CFC",
          soutenanceDates: [
            { date: "2026-06-10" },
            { date: "2026-06-11" }
          ]
        }
      ]
    })

    expect(overview.sites[0].theoreticalRooms).toBe(1)
    expect(overview.sites[0].recommendedRooms).toBe(1)
    expect(overview.sites[0].roomGap).toBe(0)
  })

  it("sizes from configured soutenance dates even when fixed planning dates already exist", () => {
    const overview = buildPlanningRoomSizingOverview({
      tpis: Array.from({ length: 9 }, (_, index) => ({
        site: "SEBEILLON",
        classe: "CFC",
        candidat: makePerson(`cand-same-${index + 1}`, `CandSame${index + 1}`, "Daily"),
        confirmedSlot: {
          date: "2026-06-10T08:00:00.000Z"
        }
      })),
      catalogSites: [
        {
          id: "site-sebeillon",
          code: "SEBEILLON",
          label: "Sébeillon",
          active: true,
          roomDetails: [
            { id: "room-1", code: "A101", label: "A101", active: true }
          ]
        }
      ],
      siteConfigs: [
        {
          siteId: "site-sebeillon",
          siteCode: "SEBEILLON",
          numSlots: 8
        }
      ],
      classTypes: [
        {
          code: "CFC",
          prefix: "C",
          label: "CFC",
          soutenanceDates: [
            { date: "2026-06-10" },
            { date: "2026-06-11" }
          ]
        }
      ]
    })

    expect(overview.sites[0].theoreticalRooms).toBe(1)
    expect(overview.sites[0].recommendedRooms).toBe(1)
    expect(overview.sites[0].roomGap).toBe(0)
    expect(overview.sites[0].typeBreakdowns).toEqual([
      expect.objectContaining({
        code: "CFC",
        dateCount: 2,
        optimalRooms: 1
      })
    ])
  })

  it("can ignore unmatched sites from the dimensioning output in catalog-only mode", () => {
    const overview = buildPlanningRoomSizingOverview({
      tpis: [
        {
          site: "SITE-SUPPRIME",
          classe: "cid4a",
          candidat: makePerson("cand-1", "Alice", "One")
        }
      ],
      catalogSites: [],
      siteConfigs: [],
      catalogOnly: true
    })

    expect(overview.sites).toHaveLength(0)
    expect(overview.totals.tpiCount).toBe(0)
    expect(overview.totals.targetRooms).toBe(0)
    expect(overview.notes).toContain("1 TPI hors catalogue ignoré du dimensionnement")
  })
})
