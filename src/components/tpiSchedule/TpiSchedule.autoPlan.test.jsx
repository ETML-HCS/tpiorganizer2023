import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import TpiSchedule from './TpiSchedule'
import { getTpiModels } from '../tpiControllers/TpiController'
import { showNotification } from '../Tools'
import { planningConfigService, workflowPlanningService } from '../../services/planningService'
import { installFetchMock } from '../../test-utils/mockFetch'
import { renderWithRouter } from '../../test-utils/renderWithRouter'

jest.mock('../../config/appConfig', () => {
  const actual = jest.requireActual('../../config/appConfig')
  return {
    ...actual,
    IS_DEBUG: true
  }
})

jest.mock('./TpiScheduleButtons', () => {
  return function MockTpiScheduleButtons({
    onAutomatePlanification,
    onOpenVotesWithoutEmails,
    onShowNewRoomForm,
    onCreateRoom,
    showNewRoomForm,
    roomsCount,
    usedTpiCount,
    totalTpiCount
  }) {
    return (
      <div data-testid="mock-toolbar">
        <button type="button" onClick={onAutomatePlanification}>
          auto-plan
        </button>
        <button type="button" onClick={onOpenVotesWithoutEmails}>
          open-votes-no-email
        </button>
        <button type="button" onClick={onShowNewRoomForm}>
          open-manual-room-form
        </button>
        {showNewRoomForm ? (
          <button
            type="button"
            onClick={() => onCreateRoom?.({
              date: '2026-06-10',
              nameRoom: 'A101',
              site: 'etml'
            })}
          >
            submit-manual-room
          </button>
        ) : null}
        <div>{`rooms:${roomsCount}`}</div>
        <div>{`usage:${usedTpiCount}/${totalTpiCount}`}</div>
      </div>
    )
  }
})

jest.mock('./DateRoom', () => {
  return function MockDateRoom({ roomData }) {
    return <div data-testid="mock-date-room">{roomData?.name || 'room-without-name'}</div>
  }
})

jest.mock('../Tools', () => ({
  showNotification: jest.fn()
}))

jest.mock('../tpiControllers/TpiController', () => ({
  getTpiModels: jest.fn(() => Promise.resolve([]))
}))

jest.mock('../tpiControllers/TpiRoomsController', () => ({
  createTpiCollectionForYear: jest.fn(),
  publishSoutenancesFromPlanning: jest.fn(),
  transmitToDatabase: jest.fn(() => Promise.resolve(true))
}))

jest.mock('../../services/planningService', () => ({
  workflowPlanningService: {
    automatePlanification: jest.fn(),
    startVotesWithoutEmails: jest.fn(),
    getYearState: jest.fn(() => Promise.resolve({ state: 'planning' })),
    getActiveSnapshot: jest.fn(() => Promise.resolve(null))
  },
  planningCatalogService: {
    getGlobal: jest.fn(() => Promise.resolve(null))
  },
  planningConfigService: {
    getByYear: jest.fn(() => Promise.resolve(null))
  },
  personService: {
    getAll: jest.fn(() => Promise.resolve([]))
  }
}))

function renderSchedule() {
  return renderWithRouter(<TpiSchedule />, {
    initialEntries: ['/planification']
  })
}

describe('TpiSchedule auto plan', () => {
  let fetchMock

  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    fetchMock = installFetchMock()
    jest.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    fetchMock.restore()
  })

  test('injecte directement les salles legacy générées après auto-planification', async () => {
    workflowPlanningService.automatePlanification.mockResolvedValue({
      success: true,
      summary: {
        plannedCount: 1,
        manualRequiredCount: 0,
        legacyRoomCount: 1
      },
      sync: {
        createdCount: 1
      },
      validation: {
        year: 2026,
        summary: {
          issueCount: 0
        },
        issues: []
      },
      legacyRooms: [
        {
          idRoom: 1,
          lastUpdate: Date.now(),
          site: 'ETML',
          date: '2026-06-10T08:00:00.000Z',
          name: 'A101',
          configSite: {
            numSlots: 1,
            tpiTime: 1,
            breakline: 0.1667
          },
          tpiDatas: [
            {
              refTpi: '2247',
              id: 'TPI-2026-2247',
              candidat: 'Alice Example',
              expert1: { name: 'Expert One', offres: {} },
              expert2: { name: 'Expert Two', offres: {} },
              boss: { name: 'Chef Projet', offres: {} }
            }
          ]
        }
      ]
    })

    renderSchedule()

    expect(await screen.findByText(/aucune salle chargée/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /auto-plan/i }))

    await waitFor(() => {
      expect(workflowPlanningService.automatePlanification).toHaveBeenCalledWith(2026)
    })

    expect(await screen.findByText('A101')).toBeInTheDocument()
    expect(screen.getByTestId('mock-toolbar')).toHaveTextContent('rooms:1')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('aligne le compteur Données sur les TPI réellement planifiables', async () => {
    planningConfigService.getByYear.mockResolvedValue({
      siteConfigs: [
        {
          siteCode: 'VENNES',
          active: true
        }
      ]
    })

    getTpiModels.mockResolvedValue([
      {
        refTpi: '1',
        lieu: { site: 'Vennes' }
      },
      {
        refTpi: '2',
        lieu: { site: 'Hors ETML' }
      }
    ])

    workflowPlanningService.automatePlanification.mockResolvedValue({
      success: true,
      summary: {
        plannedCount: 1,
        manualRequiredCount: 0,
        legacyRoomCount: 1
      },
      sync: {
        createdCount: 1
      },
      validation: {
        year: 2026,
        summary: {
          issueCount: 0
        },
        issues: []
      },
      legacyRooms: [
        {
          idRoom: 1,
          lastUpdate: Date.now(),
          site: 'VENNES',
          date: '2026-06-10T08:00:00.000Z',
          name: 'A101',
          configSite: {
            numSlots: 1,
            tpiTime: 1,
            breakline: 0.1667
          },
          tpiDatas: [
            {
              refTpi: '1',
              id: 'TPI-2026-1',
              candidat: 'Alice Example',
              expert1: { name: 'Expert One', offres: {} },
              expert2: { name: 'Expert Two', offres: {} },
              boss: { name: 'Chef Projet', offres: {} }
            }
          ]
        }
      ]
    })

    renderSchedule()

    fireEvent.click(await screen.findByRole('button', { name: /auto-plan/i }))

    await waitFor(() => {
      expect(screen.getByTestId('mock-toolbar')).toHaveTextContent('usage:1/1')
    })
  })

  test('ouvre les votes sans emails depuis le workflow debug', async () => {
    workflowPlanningService.startVotesWithoutEmails.mockResolvedValue({
      success: true,
      workflowState: 'voting_open',
      tpiCount: 0,
      totalEmails: 0,
      successfulEmails: 0,
      failedEmails: 0,
      emailsSkipped: true,
      details: []
    })

    renderSchedule()

    fireEvent.click(await screen.findByRole('button', { name: /open-votes-no-email/i }))

    await waitFor(() => {
      expect(workflowPlanningService.startVotesWithoutEmails).toHaveBeenCalledTimes(1)
    })

    const [selectedYear, rooms] = workflowPlanningService.startVotesWithoutEmails.mock.calls[0]
    expect(Number.isInteger(Number(selectedYear))).toBe(true)
    expect(Array.isArray(rooms)).toBe(true)
  })

  test('crée une room manuelle puis refuse le doublon date site salle', async () => {
    renderSchedule()

    fireEvent.click(await screen.findByRole('button', { name: /open-manual-room-form/i }))
    fireEvent.click(await screen.findByRole('button', { name: /submit-manual-room/i }))

    await waitFor(() => {
      expect(screen.getByTestId('mock-toolbar')).toHaveTextContent('rooms:1')
    })
    expect(screen.getByText('A101')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /open-manual-room-form/i }))
    fireEvent.click(await screen.findByRole('button', { name: /submit-manual-room/i }))

    await waitFor(() => {
      expect(screen.getByTestId('mock-toolbar')).toHaveTextContent('rooms:1')
    })
    expect(showNotification).toHaveBeenCalledWith(
      'Cette room existe déjà pour cette date et ce site.',
      'error',
      3000
    )
  })
})
