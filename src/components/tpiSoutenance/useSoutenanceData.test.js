import {
  buildDateFilterOptions,
  createSchedule,
  filterRooms,
  isFilterApplied,
  matchesReferenceFilter,
  sortFilterTextValues
} from './useSoutenanceData'
import { formatDate, getRoomClassFilterValue } from './TpiSoutenanceParts'

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
  formatDate: jest.fn(),
  getLegacyScheduleIndex: jest.fn((tpi, index) => index),
  getRoomClassFilterValue: jest.fn(),
  getRoomSchedule: jest.fn(() => [])
}))

describe('useSoutenanceData helpers', () => {
  beforeEach(() => {
    formatDate.mockImplementation((date) => {
    const labels = {
      '2026-04-30': '30 avril 2026',
      '2026-05-01': '1 mai 2026',
      '2026-06-10': '10 juin 2026'
    }

    return labels[date] || String(date || '')
    })
    getRoomClassFilterValue.mockImplementation((room) => (
      room?.roomClassMode === 'matu'
        ? 'matu'
        : room?.roomClassMode === 'special'
          ? 'special'
          : 'noBadge'
    ))
  })

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
      reference: '',
      candidate: '',
      experts: '',
      projectManagerButton: '',
      projectManager: '',
      classType: '',
      nameRoom: ''
    }

    expect(isFilterApplied(baseFilters)).toBe(false)
    expect(isFilterApplied({ ...baseFilters, site: 'ETML' })).toBe(true)
    expect(isFilterApplied({ ...baseFilters, date: '10 juin 2026' })).toBe(true)
    expect(isFilterApplied({ ...baseFilters, nameRoom: 'A101' })).toBe(true)
    expect(isFilterApplied({ ...baseFilters, classType: 'matu' })).toBe(true)
    expect(isFilterApplied({ ...baseFilters, reference: 'TPI-2026-2163' })).toBe(true)
  })

  test('filterRooms filtre les salles par type de classe affiché', () => {
    const baseFilters = {
      site: '',
      date: '',
      reference: '',
      candidate: '',
      experts: '',
      projectManagerButton: '',
      projectManager: '',
      classType: '',
      nameRoom: ''
    }
    const rooms = [
      {
        name: 'M101',
        site: 'ETML',
        date: '2026-06-10',
        roomClassMode: 'matu',
        tpiDatas: [{
          refTpi: '2101',
          candidat: 'Alice',
          expert1: { name: 'Expert 1' },
          expert2: { name: 'Expert 2' },
          boss: { name: 'Chef 1' }
        }]
      },
      {
        name: 'S101',
        site: 'ETML',
        date: '2026-06-10',
        roomClassMode: 'special',
        tpiDatas: [{
          refTpi: '2102',
          candidat: 'Bob',
          expert1: { name: 'Expert 3' },
          expert2: { name: 'Expert 4' },
          boss: { name: 'Chef 2' }
        }]
      },
      {
        name: 'A101',
        site: 'ETML',
        date: '2026-06-10',
        roomClassMode: null,
        tpiDatas: [{
          refTpi: '2103',
          candidat: 'Chloé',
          expert1: { name: 'Expert 5' },
          expert2: { name: 'Expert 6' },
          boss: { name: 'Chef 3' }
        }]
      }
    ]

    expect(getRoomClassFilterValue(rooms[0])).toBe('matu')
    expect(getRoomClassFilterValue(rooms[1])).toBe('special')
    expect(getRoomClassFilterValue(rooms[2])).toBe('noBadge')
    expect(filterRooms(rooms, { ...baseFilters, classType: 'matu' })).toEqual([rooms[0]])
    expect(filterRooms(rooms, { ...baseFilters, classType: 'special' })).toEqual([rooms[1]])
    expect(filterRooms(rooms, { ...baseFilters, classType: 'noBadge' })).toEqual([rooms[2]])
  })

  test('matchesReferenceFilter accepte les références workflow et legacy', () => {
    expect(matchesReferenceFilter('2163', '2163')).toBe(true)
    expect(matchesReferenceFilter('2163', 'TPI-2026-2163')).toBe(true)
    expect(matchesReferenceFilter('TPI-2026-2163', '2163')).toBe(true)
    expect(matchesReferenceFilter('TPI-2026-2163', 'TPI-2026-2163')).toBe(true)
    expect(matchesReferenceFilter('9999', 'TPI-2026-2163')).toBe(false)
  })

  test('sortFilterTextValues trie les options alphabétiquement en évitant les doublons et les valeurs vides', () => {
    expect(
      sortFilterTextValues(['Salle 10', 'Salle 2', '', 'Salle 1', 'Salle 2', null])
    ).toEqual(['Salle 1', 'Salle 2', 'Salle 10'])
  })

  test('buildDateFilterOptions trie les dates chronologiquement avant de les afficher', () => {
    expect(formatDate('2026-04-30')).toBe('30 avril 2026')
    expect(
      buildDateFilterOptions([
        { date: '2026-06-10' },
        { date: '2026-05-01' },
        { date: '2026-06-10' },
        { date: '2026-04-30' }
      ])
    ).toEqual(['30 avril 2026', '1 mai 2026', '10 juin 2026'])
  })
})
