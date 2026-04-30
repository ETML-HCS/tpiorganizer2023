import { buildPlanningConfigForYear, normalizeRoom } from './tpiScheduleData'

describe('tpiScheduleData', () => {
  test('propage la couleur planning du site dans la configuration de salle', () => {
    const config = buildPlanningConfigForYear(
      {
        siteConfigs: [
          {
            siteCode: 'VENNES',
            label: 'Vennes',
            planningColor: '#14532d',
            tpiColor: '#fee2e2',
            numSlots: 6
          }
        ]
      },
      2026
    )

    const room = normalizeRoom(
      {
        site: 'VENNES',
        date: '2026-06-10',
        name: 'Vennes - A101',
        tpiDatas: []
      },
      0,
      config
    )

    expect(room.configSite.planningColor).toBe('#14532D')
    expect(room.configSite.tpiColor).toBe('#FEE2E2')
    expect(room.configSite.numSlots).toBe(6)
    expect(room.configSite.minTpiPerRoom).toBe(3)
  })
})
