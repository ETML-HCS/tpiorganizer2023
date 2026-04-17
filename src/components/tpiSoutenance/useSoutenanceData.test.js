import { createSchedule, isFilterApplied } from './useSoutenanceData'

jest.mock('../../services/apiService', () => ({
  soutenancesService: {
    getPublishedByYear: jest.fn(),
    getExpertsOrBoss: jest.fn(),
    updateOffers: jest.fn()
  }
}))

jest.mock('../../services/planningService', () => ({
  workflowPlanningService: {
    resolveMagicLink: jest.fn()
  }
}))

jest.mock('../Tools', () => ({
  showNotification: jest.fn()
}))

jest.mock('./TpiSoutenanceParts', () => ({
  formatDate: jest.fn(() => '10 juin 2026'),
  getRoomSchedule: jest.fn(() => [])
}))

describe('useSoutenanceData helpers', () => {
  test('createSchedule applique la pause uniquement entre les créneaux', () => {
    const schedule = createSchedule({
      configSite: {
        breakline: 0.5,
        tpiTime: 1,
        firstTpiStart: 8,
        numSlots: 9
      }
    })

    expect(schedule).toHaveLength(9)
    expect(schedule[0]).toEqual({
      startTime: '08:00',
      endTime: '09:00'
    })
    expect(schedule[1]).toEqual({
      startTime: '09:30',
      endTime: '10:30'
    })
    expect(schedule[8]).toEqual({
      startTime: '20:00',
      endTime: '21:00'
    })
  })

  test('isFilterApplied detecte aussi les filtres site, date et salle', () => {
    const baseFilters = {
      site: '',
      date: '',
      candidate: '',
      experts: '',
      projectManagerButton: '',
      projectManager: '',
      nameRoom: ''
    }

    expect(isFilterApplied(baseFilters)).toBe(false)
    expect(isFilterApplied({ ...baseFilters, site: 'ETML' })).toBe(true)
    expect(isFilterApplied({ ...baseFilters, date: '10 juin 2026' })).toBe(true)
    expect(isFilterApplied({ ...baseFilters, nameRoom: 'A101' })).toBe(true)
  })
})
