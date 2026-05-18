import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'

import TpiSchedule from './TpiSchedule'
import { getTpiModels } from '../tpiControllers/TpiController'
import { replacePlanningRoomsInDatabase } from '../tpiControllers/TpiRoomsController'
import { showNotification } from '../Tools'
import { coordinationConfigService, workflowCoordinationService } from '../../services/coordinationService'
import { installFetchMock } from '../../test-utils/mockFetch'
import { renderWithRouter } from '../../test-utils/renderWithRouter'

let mockLastDropConfig = null

jest.mock('react-dnd', () => {
  const React = require('react')

  return {
    DndProvider: ({ children }) => React.createElement(
      'div',
      { 'data-testid': 'dnd-provider' },
      children
    ),
    useDrag: () => [{ isDragging: false }, jest.fn()],
    useDrop: (config) => {
      mockLastDropConfig = config
      return [{ isDropOver: false, canDropAssignedTpi: false }, jest.fn()]
    }
  }
})

jest.mock('react-dnd-html5-backend', () => ({
  HTML5Backend: jest.fn()
}))

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
    onValidatePlanification,
    onOpenVotesWithoutEmails,
    onSendBD,
    onPublishStaticPublication,
    onShowNewRoomForm,
    onCreateRoom,
    onToggleRoomsChronologicalSortMode,
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
        <button type="button" onClick={onValidatePlanification}>
          validate-plan
        </button>
        <button type="button" onClick={onOpenVotesWithoutEmails}>
          open-votes-no-email
        </button>
        <button type="button" onClick={onSendBD}>
          send-db
        </button>
        <button type="button" onClick={onPublishStaticPublication}>
          static-publish
        </button>
        <button type="button" onClick={onShowNewRoomForm}>
          open-manual-room-form
        </button>
        <button type="button" onClick={onToggleRoomsChronologicalSortMode}>
          sort-rooms
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
  publishSoutenancesFromPlanification: jest.fn(),
  publishSoutenancesFromPlanning: jest.fn(),
  replacePlanningRoomsInDatabase: jest.fn(() => Promise.resolve({
    exactMatch: true,
    roomCount: 1,
    tpiCount: 1
  })),
  transmitToDatabase: jest.fn(() => Promise.resolve(true))
}))

jest.mock('../../services/coordinationService', () => ({
  workflowCoordinationService: {
    automatePlanification: jest.fn(),
    validatePlanification: jest.fn(),
    startVotesWithoutEmails: jest.fn(),
    publishDefinitive: jest.fn(),
    publishStaticPublication: jest.fn(),
    getYearState: jest.fn(() => Promise.resolve({ state: 'planning' })),
    getActiveSnapshot: jest.fn(() => Promise.resolve(null))
  },
  coordinationCatalogService: {
    getGlobal: jest.fn(() => Promise.resolve(null))
  },
  coordinationConfigService: {
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
    mockLastDropConfig = null
    window.localStorage.clear()
    fetchMock = installFetchMock()
    jest.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    fetchMock.restore()
  })

  test('affiche les salles en ordre chronologique quand le tri du header est activé', async () => {
    window.localStorage.setItem('organizerData', JSON.stringify([
      {
        idRoom: 1,
        name: 'Salle tardive',
        site: 'ETML',
        date: '2026-06-12',
        tpiDatas: []
      },
      {
        idRoom: 2,
        name: 'Salle matinale',
        site: 'ETML',
        date: '2026-06-10',
        tpiDatas: []
      },
      {
        idRoom: 3,
        name: 'Salle milieu',
        site: 'ETML',
        date: '2026-06-11',
        tpiDatas: []
      }
    ]))

    renderSchedule()

    const getRoomNames = () =>
      screen.getAllByTestId('mock-date-room').map((node) => node.textContent)

    await waitFor(() => {
      expect(getRoomNames()).toEqual(['Salle tardive', 'Salle matinale', 'Salle milieu'])
    })

    fireEvent.click(screen.getByRole('button', { name: /sort-rooms/i }))

    await waitFor(() => {
      expect(getRoomNames()).toEqual(['Salle matinale', 'Salle milieu', 'Salle tardive'])
    })
  })

  test('injecte directement les salles legacy générées après auto-planification', async () => {
    workflowCoordinationService.automatePlanification.mockResolvedValue({
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
      expect(workflowCoordinationService.automatePlanification).toHaveBeenCalledWith(2026)
    })

    expect(await screen.findByText('A101')).toBeInTheDocument()
    expect(screen.getAllByTestId('dnd-provider')).toHaveLength(1)
    expect(screen.getByTestId('mock-toolbar')).toHaveTextContent('rooms:1')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('vérifier les conflits ne modifie pas automatiquement les salles locales', async () => {
    const localRooms = [
      {
        idRoom: 1,
        lastUpdate: 100,
        site: 'ETML',
        date: '2026-06-10',
        name: 'A23',
        configSite: { numSlots: 2 },
        tpiDatas: [
          {
            refTpi: 'TPI-A23',
            id: 'slot-a23-1',
            candidat: 'Alice Example',
            expert1: { name: 'Patrick Chenaux', personId: 'patrick-chenaux', offres: {} },
            expert2: { name: 'Expert A', offres: {} },
            boss: { name: 'Chef A', offres: {} },
            classe: 'MIN4'
          },
          {
            refTpi: '',
            id: 'slot-a23-2',
            candidat: '',
            expert1: { name: '', offres: {} },
            expert2: { name: '', offres: {} },
            boss: { name: '', offres: {} }
          }
        ]
      },
      {
        idRoom: 2,
        lastUpdate: 100,
        site: 'ETML',
        date: '2026-06-10',
        name: 'B22',
        configSite: { numSlots: 2 },
        tpiDatas: [
          {
            refTpi: 'TPI-B22',
            id: 'slot-b22-1',
            candidat: 'Bob Example',
            expert1: { name: 'Expert B', offres: {} },
            expert2: { name: 'Patrick Chenaux', personId: 'patrick-chenaux', offres: {} },
            boss: { name: 'Chef B', offres: {} },
            classe: 'MIN4'
          },
          {
            refTpi: '',
            id: 'slot-b22-2',
            candidat: '',
            expert1: { name: '', offres: {} },
            expert2: { name: '', offres: {} },
            boss: { name: '', offres: {} }
          }
        ]
      }
    ]
    const initialJson = JSON.stringify(localRooms)
    window.localStorage.setItem('organizerData', initialJson)
    workflowCoordinationService.validatePlanification.mockResolvedValue({
      year: 2026,
      checkedAt: '2026-05-13T10:00:00.000Z',
      summary: {
        issueCount: 1,
        hardConflictCount: 1,
        personOverlapCount: 1,
        isValid: false
      },
      issues: [
        {
          type: 'person_overlap',
          personId: 'patrick-chenaux',
          personName: 'Patrick Chenaux',
          dateKey: '2026-06-10',
          period: 1,
          references: ['TPI-A23', 'TPI-B22']
        }
      ]
    })

    renderSchedule()

    expect(await screen.findByText('A23')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /validate-plan/i }))

    await waitFor(() => {
      expect(workflowCoordinationService.validatePlanification).toHaveBeenCalled()
    })

    expect(window.localStorage.getItem('organizerData')).toBe(initialJson)
    expect(workflowCoordinationService.validatePlanification.mock.calls[0][2][0].tpiDatas[0].refTpi).toBe('TPI-A23')
    expect(workflowCoordinationService.validatePlanification.mock.calls[0][2][1].tpiDatas[0].refTpi).toBe('TPI-B22')
  })

  test('ne reconstruit pas la planification pendant une vérification si les votes sont actifs', async () => {
    workflowCoordinationService.getYearState.mockResolvedValueOnce({
      state: 'voting_open',
      activePhases: ['planning', 'votes'],
      phases: {
        planning: { active: true },
        votes: { active: true }
      }
    })
    window.localStorage.setItem('organizerData', JSON.stringify([
      {
        idRoom: 1,
        name: 'A23',
        site: 'VENNES',
        date: '2026-06-10',
        tpiDatas: [
          {
            refTpi: 'TPI-A23',
            candidat: 'Alice Example',
            expert1: { name: 'Expert A' },
            expert2: { name: 'Expert B' },
            boss: { name: 'Chef A' }
          }
        ]
      }
    ]))
    workflowCoordinationService.validatePlanification.mockResolvedValue({
      year: 2026,
      checkedAt: '2026-05-13T10:00:00.000Z',
      summary: {
        issueCount: 0,
        hardConflictCount: 0,
        isValid: true
      },
      issues: []
    })

    renderSchedule()

    fireEvent.click(await screen.findByRole('button', { name: /validate-plan/i }))

    await waitFor(() => {
      expect(workflowCoordinationService.validatePlanification).toHaveBeenCalled()
    })

    expect(workflowCoordinationService.validatePlanification.mock.calls[0][2]).toBeNull()
  })

  test('aligne le compteur Données sur les TPI réellement planifiables', async () => {
    coordinationConfigService.getByYear.mockResolvedValue({
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

    workflowCoordinationService.automatePlanification.mockResolvedValue({
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

  test('signale les écarts GestionTPI au chargement sans modifier automatiquement les salles locales', async () => {
    window.localStorage.setItem('organizerData', JSON.stringify([
      {
        idRoom: 1,
        lastUpdate: 100,
        site: 'ETML',
        date: '2026-06-10',
        name: 'A101',
        configSite: {
          numSlots: 1
        },
        tpiDatas: [
          {
            refTpi: '2247',
            candidat: 'Ancien Nom',
            candidatPersonId: 'candidate-old',
            expert1: {
              name: 'Expert Ancien',
              personId: 'expert-old',
              offres: {
                isValidated: true,
                submit: [{ date: '2026-06-10', creneau: 1 }]
              }
            },
            expert2: { name: 'Expert Two', personId: 'expert-2', offres: {} },
            boss: { name: 'Chef Projet', personId: 'boss-1', offres: {} },
            sujet: 'Ancien sujet'
          }
        ]
      }
    ]))

    getTpiModels.mockResolvedValue([
      {
        refTpi: '2247',
        candidat: 'Alice Example',
        candidatPersonId: 'candidate-1',
        experts: {
          1: 'Expert One',
          2: 'Expert Two'
        },
        expert1PersonId: 'expert-1',
        expert2PersonId: 'expert-2',
        boss: 'Chef Projet',
        bossPersonId: 'boss-1',
        classe: 'INF4A',
        lieu: {
          entreprise: 'Entreprise Test',
          site: 'ETML'
        },
        sujet: 'Sujet mis à jour',
        description: 'Description mise à jour'
      }
    ])

    renderSchedule()

    await waitFor(() => {
      const storedRooms = JSON.parse(window.localStorage.getItem('organizerData'))

      expect(storedRooms[0].tpiDatas[0]).toMatchObject({
        refTpi: '2247',
        candidat: 'Ancien Nom',
        candidatPersonId: 'candidate-old',
        sujet: 'Ancien sujet'
      })
      expect(storedRooms[0].tpiDatas[0].expert1).toMatchObject({
        name: 'Expert Ancien',
        personId: 'expert-old',
        offres: {
          isValidated: true,
          submit: [{ date: '2026-06-10', creneau: 1 }]
        }
      })
    })

    await waitFor(() => {
      expect(showNotification).toHaveBeenCalledWith(
        '1 TPI à synchroniser depuis GestionTPI. Utilise "Sync tout" pour appliquer les changements.',
        'info',
        2400
      )
    })

    fireEvent.click(screen.getByRole('tab', { name: /À vérifier/i }))

    expect(screen.getByRole('list', { name: /Points de planification à vérifier/i })).toHaveTextContent('Aucun point à vérifier.')
    expect(screen.queryByText(/GestionTPI:/i)).not.toBeInTheDocument()
  })

  test('remet un TPI planifié dans la liste à placer via le panneau TPI à traiter', async () => {
    coordinationConfigService.getByYear.mockResolvedValue({
      siteConfigs: [
        {
          siteCode: 'ETML',
          active: true
        }
      ]
    })
    window.localStorage.setItem('organizerData', JSON.stringify([
      {
        idRoom: 1,
        lastUpdate: 100,
        site: 'ETML',
        date: '2026-06-10',
        name: 'A101',
        configSite: {
          numSlots: 1
        },
        tpiDatas: [
          {
            refTpi: '2247',
            id: 'slot-2247',
            candidat: 'Alice Example',
            expert1: { name: 'Expert One', offres: {} },
            expert2: { name: 'Expert Two', offres: {} },
            boss: { name: 'Chef Projet', offres: {} }
          }
        ]
      }
    ]))
    getTpiModels.mockResolvedValue([
      {
        refTpi: '2247',
        candidat: 'Alice Example',
        classe: 'INF4A',
        lieu: {
          site: 'ETML'
        },
        sujet: 'Sujet test'
      }
    ])

    renderSchedule()

    expect(await screen.findByText('A101')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('mock-toolbar')).toHaveTextContent('usage:1/1')
      expect(mockLastDropConfig).toBeTruthy()
    })

    act(() => {
      mockLastDropConfig.drop({
        tpi: {
          id: 'slot-2247',
          refTpi: '2247'
        }
      }, { didDrop: () => false })
    })

    await waitFor(() => {
      const storedRooms = JSON.parse(window.localStorage.getItem('organizerData'))

      expect(storedRooms[0].tpiDatas[0]).toMatchObject({
        refTpi: null,
        id: 'slot-2247',
        candidat: '',
        period: 1
      })
      expect(screen.getByRole('list', { name: /TPI non attribués/i })).toHaveTextContent('2247')
    })
    expect(showNotification).toHaveBeenCalledWith(
      'TPI 2247 remis dans la liste à placer.',
      'success',
      3000
    )
  })

  test('remplace la planification distante et affiche une confirmation 100% vérifiée', async () => {
    window.localStorage.setItem('organizerData', JSON.stringify([
      {
        idRoom: 1,
        lastUpdate: 100,
        site: 'ETML',
        date: '2026-06-10',
        name: 'A101',
        configSite: {
          numSlots: 1
        },
        tpiDatas: [
          {
            refTpi: '2247',
            candidat: 'Alice Example',
            expert1: { name: 'Expert One', offres: {} },
            expert2: { name: 'Expert Two', offres: {} },
            boss: { name: 'Chef Projet', offres: {} }
          }
        ]
      }
    ]))
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
    replacePlanningRoomsInDatabase.mockResolvedValue({
      exactMatch: true,
      roomCount: 1,
      tpiCount: 1
    })

    renderSchedule()

    fireEvent.click(await screen.findByRole('button', { name: /send-db/i }))

    await waitFor(() => {
      expect(replacePlanningRoomsInDatabase).toHaveBeenCalledTimes(1)
    })

    expect(replacePlanningRoomsInDatabase.mock.calls[0][0]).toBe(2026)
    expect(replacePlanningRoomsInDatabase.mock.calls[0][1]).toHaveLength(1)
    expect(showNotification).toHaveBeenCalledWith(
      'Sauvegarde BDD 2026 vérifiée à 100%: 1 salle(s), 1 TPI.',
      'success',
      5000
    )
    expect(alertSpy).toHaveBeenCalledWith(
      'Sauvegarde BDD 2026 vérifiée à 100%: 1 salle(s), 1 TPI.'
    )
  })

  test('publie les défenses courantes avant le transfert statique tpi26', async () => {
    window.localStorage.setItem('organizerData', JSON.stringify([
      {
        idRoom: 1,
        lastUpdate: 100,
        site: 'ETML',
        date: '2026-06-10',
        name: 'A101',
        configSite: {
          numSlots: 1
        },
        tpiDatas: [
          {
            refTpi: '2247',
            candidat: 'Alice Example',
            expert1: { name: 'Expert One', offres: {} },
            expert2: { name: 'Expert Two', offres: {} },
            boss: { name: 'Chef Projet', offres: {} }
          }
        ]
      }
    ]))
    workflowCoordinationService.publishDefinitive.mockResolvedValue({
      success: true,
      workflowState: 'published',
      message: '1 salle publiée depuis la planification courante'
    })
    workflowCoordinationService.publishStaticPublication.mockResolvedValue({
      success: true,
      available: true,
      defenseCount: 1,
      roomCount: 1,
      publicUrl: 'https://tpi26.ch/soutenances-2026/',
      publishedAt: '2026-05-18T10:00:00.000Z'
    })

    renderSchedule()

    fireEvent.click(await screen.findByRole('button', { name: /static-publish/i }))

    await waitFor(() => {
      expect(workflowCoordinationService.publishDefinitive).toHaveBeenCalledTimes(1)
      expect(workflowCoordinationService.publishStaticPublication).toHaveBeenCalledTimes(1)
    })

    expect(workflowCoordinationService.publishDefinitive.mock.calls[0][0]).toBe(2026)
    expect(workflowCoordinationService.publishDefinitive.mock.calls[0][1]).toHaveLength(1)
    expect(
      workflowCoordinationService.publishDefinitive.mock.invocationCallOrder[0]
    ).toBeLessThan(
      workflowCoordinationService.publishStaticPublication.mock.invocationCallOrder[0]
    )
    expect(showNotification).toHaveBeenCalledWith(
      'Défenses publiées puis transfert FTP réussi: 1 défense(s) en ligne sur https://tpi26.ch/soutenances-2026/.',
      'success',
      3000
    )
  })

  test('ouvre les votes sans emails depuis le workflow debug', async () => {
    workflowCoordinationService.startVotesWithoutEmails.mockResolvedValue({
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
      expect(workflowCoordinationService.startVotesWithoutEmails).toHaveBeenCalledTimes(1)
    })

    const [selectedYear, rooms] = workflowCoordinationService.startVotesWithoutEmails.mock.calls[0]
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
