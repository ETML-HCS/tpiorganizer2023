import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'

import PlanningDashboard from './PlanningDashboard'
import * as coordinationServices from '../../services/coordinationService'
import * as tpiController from '../tpiControllers/TpiController.jsx'
import { ROUTES, STORAGE_KEYS } from '../../config/appConfig'
import { renderWithRouter } from '../../test-utils/renderWithRouter'
import { writeJSONValue } from '../../utils/storage'

jest.mock('../../config/appConfig', () => {
  const actual = jest.requireActual('../../config/appConfig')
  return {
    ...actual,
    IS_DEBUG: true
  }
})

jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn()
  }
}))

jest.mock('./TpiPlanningList', () => ({ tpis, onSelectTpi }) => (
  <div>
    <div data-testid='mock-tpi-count'>{Array.isArray(tpis) ? tpis.length : 0}</div>
    <div data-testid='mock-tpi-refs'>
      {Array.isArray(tpis) ? tpis.map((tpi) => tpi.reference).filter(Boolean).join(', ') : ''}
    </div>
    {Array.isArray(tpis) && tpis.length > 0 ? (
      <button type='button' onClick={() => onSelectTpi(tpis[0])}>
        Sélectionner un TPI
      </button>
    ) : (
      <div>Liste coordination</div>
    )}
  </div>
))

jest.mock('./VotingPanel', () => () => <div>Votes</div>)
jest.mock('./ConflictResolver', () => ({ focusTpiId }) => (
  <div>
    Conflits
    {focusTpiId ? <span>Focus résolution {focusTpiId}</span> : null}
  </div>
))
jest.mock('../shared/PageToolbar', () => ({ children, title }) => (
  <div>
    <h1>{title}</h1>
    {children}
  </div>
))

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid='location-display'>{`${location.pathname}${location.search}`}</div>
}

function renderDashboard({
  initialEntries = ['/'],
  year = '2026',
  isAdmin = true,
  children = null
} = {}) {
  return renderWithRouter(
    <>
      <PlanningDashboard year={year} isAdmin={isAdmin} />
      {children}
    </>,
    { initialEntries }
  )
}

function buildVoteProposalTpi(overrides = {}) {
  return {
    _id: 'coordination-vote-1',
    reference: 'TPI-2026-042',
    status: 'voting',
    sujet: 'Sujet vote',
    candidat: { firstName: 'Nora', lastName: 'Martin' },
    expert1: { firstName: 'Bob', lastName: 'Expert' },
    expert2: { firstName: 'Carla', lastName: 'Expert' },
    chefProjet: { firstName: 'Diane', lastName: 'Boss' },
    proposedSlots: [
      {
        slot: {
          _id: 'slot-fixed',
          date: '2026-06-10T08:00:00.000Z',
          startTime: '08:00',
          endTime: '12:00',
          room: { name: 'A101' }
        }
      }
    ],
    votingSession: {
      deadline: '2026-06-20T08:00:00.000Z',
      voteSummary: {
        expert1Voted: true,
        expert2Voted: true,
        chefProjetVoted: false
      }
    },
    voteRoleStatus: {
      expert1: { decision: 'accepted', responseMode: 'ok' },
      expert2: { decision: 'rejected', responseMode: 'proposal', alternativeCount: 1 },
      chef_projet: { decision: 'pending', responseMode: 'pending' }
    },
    voteStats: {
      totalVotes: 3,
      pendingVotes: 1,
      acceptedVotes: 1,
      preferredVotes: 1,
      rejectedVotes: 1,
      respondedVotes: 2
    },
    voteDecision: {
      slots: [
        {
          slotId: 'slot-fixed',
          isFixed: true,
          slot: {
            _id: 'slot-fixed',
            date: '2026-06-10T08:00:00.000Z',
            startTime: '08:00',
            endTime: '12:00',
            room: { name: 'A101' }
          },
          positiveCount: 1,
          rejectedCount: 1,
          pendingCount: 1,
          respondedCount: 2,
          roleDecisions: [
            { role: 'expert1', decision: 'accepted', voterName: 'Bob Expert' },
            { role: 'expert2', decision: 'rejected', voterName: 'Carla Expert', comment: 'Pas disponible' },
            { role: 'chef_projet', decision: 'pending', voterName: 'Diane Boss' }
          ]
        },
        {
          slotId: 'slot-alt',
          isFixed: false,
          slot: {
            _id: 'slot-alt',
            date: '2026-06-11T08:00:00.000Z',
            startTime: '13:00',
            endTime: '17:00',
            room: { name: 'B202' }
          },
          positiveCount: 1,
          rejectedCount: 0,
          pendingCount: 2,
          respondedCount: 1,
          roleDecisions: [
            { role: 'expert1', decision: 'pending', voterName: 'Bob Expert' },
            {
              role: 'expert2',
              decision: 'preferred',
              voteId: 'vote-alt-expert2',
              voterName: 'Carla Expert',
              priority: 1,
              availabilityException: true,
              specialRequestReason: 'Indisponible le matin',
              specialRequestDate: '2026-06-13T08:00:00.000Z'
            },
            { role: 'chef_projet', decision: 'pending', voterName: 'Diane Boss' }
          ]
        }
      ]
    },
    ...overrides
  }
}

describe('PlanningDashboard', () => {
  beforeEach(() => {
    Object.values(toast).forEach((mockFn) => mockFn.mockClear())
    jest.spyOn(coordinationServices.coordinationCatalogService, 'getGlobal').mockResolvedValue({ sites: [] })
    jest.spyOn(coordinationServices.coordinationConfigService, 'getByYear').mockResolvedValue({ classTypes: [], siteConfigs: [] })
    jest.spyOn(coordinationServices.tpiCoordinationService, 'getByYear').mockResolvedValue([
      {
        _id: 'coordination-1',
        reference: 'TPI-2026-001',
        status: 'draft',
        sujet: 'Sujet coordination',
        candidat: { firstName: 'Alice', lastName: 'Durand' },
        expert1: { firstName: 'Bob', lastName: 'Expert' },
        expert2: { firstName: 'Carla', lastName: 'Expert' },
        chefProjet: { firstName: 'Diane', lastName: 'Boss' },
        voteStats: {
          totalVotes: 0,
          pendingVotes: 0,
          acceptedVotes: 0,
          preferredVotes: 0,
          rejectedVotes: 0,
          respondedVotes: 0
        },
        proposedSlots: [],
        confirmedSlot: null,
        votingSession: {
          voteSummary: {
            expert1Voted: false,
            expert2Voted: false,
            chefProjetVoted: false
          }
        }
      }
    ])
    jest.spyOn(coordinationServices.tpiCoordinationService, 'forceSlot').mockResolvedValue({
      success: true
    })
    jest.spyOn(coordinationServices.tpiCoordinationService, 'simulateMoveToSlot').mockResolvedValue({
      success: true,
      canMove: true,
      status: 'clear',
      message: 'Déplacement possible sans conflit détecté.',
      tpi: { _id: 'coordination-vote-1', reference: 'TPI-2026-042' },
      currentSlot: { _id: 'slot-fixed', label: '10.06.2026 · 08:00-12:00 · A101' },
      targetSlot: { _id: 'slot-alt', label: '11.06.2026 · 13:00-17:00 · B202' },
      conflicts: [],
      swapCandidate: null
    })
    jest.spyOn(coordinationServices.tpiCoordinationService, 'moveToSlot').mockResolvedValue({
      success: true
    })
    jest.spyOn(coordinationServices.voteService, 'addProposalToPreferences').mockResolvedValue({
      success: true,
      added: true,
      voter: { name: 'Carla Expert' }
    })
    jest.spyOn(coordinationServices.voteService, 'forceOk').mockResolvedValue({
      success: true,
      forcedRoleCount: 1,
      forcedTpiCount: 1,
      skippedRoleCount: 0
    })
    jest.spyOn(coordinationServices.resolutionProposalService, 'create').mockResolvedValue({
      success: true,
      proposal: {
        id: 'resolution-proposal-1',
        status: 'sent'
      }
    })
    jest.spyOn(coordinationServices.slotService, 'getCalendar').mockResolvedValue([])
    jest.spyOn(coordinationServices.workflowCoordinationService, 'getYearState').mockResolvedValue({ state: 'planning' })
    jest.spyOn(coordinationServices.workflowCoordinationService, 'getActiveSnapshot').mockResolvedValue(null)
    jest.spyOn(coordinationServices.workflowCoordinationService, 'getStaticPublicationStatus').mockResolvedValue({
      available: false,
      publicUrl: ''
    })
    jest.spyOn(coordinationServices.workflowCoordinationService, 'getStaticVotePublicationStatus').mockResolvedValue({
      available: false,
      publicUrl: 'https://tpi26.ch/votes-2026/',
      syncSecretConfigured: false
    })
    jest.spyOn(coordinationServices.workflowCoordinationService, 'getDefenseChangeNotificationPreview').mockResolvedValue({
      hasCurrentPublication: false,
      hasPreviousPublication: false,
      summary: {
        changedDefenseCount: 0,
        pendingRecipientCount: 0,
        sentRecipientCount: 0
      }
    })
    jest.spyOn(coordinationServices.workflowCoordinationService, 'sendDefenseChangeNotifications').mockResolvedValue({
      success: true,
      summary: {
        sentCount: 0,
        skippedCount: 0,
        failedCount: 0
      },
      preview: {
        hasCurrentPublication: true,
        hasPreviousPublication: true,
        summary: {
          changedDefenseCount: 0,
          pendingRecipientCount: 0,
          sentRecipientCount: 0
        }
      }
    })
    jest.spyOn(coordinationServices.workflowCoordinationService, 'generateStaticVotePublication').mockResolvedValue({
      success: true,
      available: true,
      groupCount: 1,
      accessLinkCount: 1,
      syncSecretConfigured: true
    })
    jest.spyOn(coordinationServices.workflowCoordinationService, 'publishStaticVotePublication').mockResolvedValue({
      success: true,
      available: true,
      publicUrl: 'https://tpi26.ch/votes-2026/'
    })
    jest.spyOn(coordinationServices.workflowCoordinationService, 'syncStaticVotePublication').mockResolvedValue({
      success: true,
      receivedCount: 1,
      importedCount: 1,
      failedCount: 0
    })
    jest.spyOn(coordinationServices.workflowCoordinationService, 'startVotesWithoutEmails').mockResolvedValue({
      success: true,
      workflowState: 'voting_open',
      tpiCount: 1,
      totalEmails: 0,
      successfulEmails: 0,
      failedEmails: 0,
      emailsSkipped: true,
      details: []
    })
    jest.spyOn(coordinationServices.workflowCoordinationService, 'syncPlanificationFromCoordination').mockResolvedValue({
      success: true,
      summary: {
        tpiCount: 1,
        roomCount: 1,
        slotCount: 6
      },
      legacyRooms: [
        {
          idRoom: 1001,
          site: 'ETML',
          name: 'A101',
          date: '2026-06-11T08:00:00.000Z',
          tpiDatas: [
            { refTpi: '27', period: 6 }
          ]
        }
      ],
      snapshot: {
        version: 3,
        isActive: true
      }
    })
    jest.spyOn(coordinationServices.workflowCoordinationService, 'automatePlanification').mockResolvedValue({
      success: true,
      summary: {
        totalTpis: 1,
        plannedCount: 1,
        manualRequiredCount: 0,
        slotCount: 8,
        roomCount: 1
      },
      validation: {
        summary: {
          issueCount: 0
        }
      }
    })
    jest.spyOn(tpiController, 'getTpiModels').mockResolvedValue([])
  })

  afterEach(() => {
    jest.restoreAllMocks()
    localStorage.clear()
  })

  test('ouvre une sidebar allégée quand un TPI est sélectionné', async () => {
    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: /liste complète/i }))
    fireEvent.click(await screen.findByRole('button', { name: /sélectionner un tpi/i }))

    expect(await screen.findByRole('dialog', { name: /tpi-2026-001/i })).toBeInTheDocument()
    expect(screen.getByText(/fiche coordination/i)).toBeInTheDocument()
    expect(screen.getByText('Alice Durand', { selector: '.panel-candidate' })).toBeInTheDocument()
    expect(screen.getByText('Sujet coordination', { selector: '.panel-subject' })).toBeInTheDocument()
    expect(screen.getByText(/participants/i, { selector: 'h4' })).toBeInTheDocument()
    expect(screen.getByText(/votes/i, { selector: 'h4' })).toBeInTheDocument()
    expect(screen.queryByText(/lecture croisée gestiontpi \/ coordination/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/navigation interne de la fiche/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /fiche complète/i })).toHaveAttribute('href', '/tpi/2026/TPI-2026-001')
  })

  test('affiche la date courante de Planification dans la fiche Coordination', async () => {
    localStorage.setItem(STORAGE_KEYS.ORGANIZER_DATA, JSON.stringify([
      {
        site: 'ETML',
        name: 'B204',
        date: '2026-06-12',
        configSite: {
          firstTpiStartTime: '13:00',
          tpiTimeMinutes: 60,
          breaklineMinutes: 10
        },
        tpiDatas: [
          { refTpi: '1', period: 2 }
        ]
      }
    ]))

    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: /liste complète/i }))
    fireEvent.click(await screen.findByRole('button', { name: /sélectionner un tpi/i }))

    expect(await screen.findByRole('dialog', { name: /tpi-2026-001/i })).toBeInTheDocument()
    expect(screen.getAllByText(/12\.06\.2026 .* après-midi .* B204/i).length).toBeGreaterThan(0)
  })

  test('met à jour la fiche Coordination quand Planification écrit dans le même onglet', async () => {
    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: /liste complète/i }))
    fireEvent.click(await screen.findByRole('button', { name: /sélectionner un tpi/i }))

    expect(await screen.findByRole('dialog', { name: /tpi-2026-001/i })).toBeInTheDocument()

    act(() => {
      writeJSONValue(STORAGE_KEYS.ORGANIZER_DATA, [
        {
          site: 'ETML',
          name: 'C305',
          date: '2026-06-13',
          configSite: {
            firstTpiStartTime: '08:00',
            tpiTimeMinutes: 60,
            breaklineMinutes: 10
          },
          tpiDatas: [
            { refTpi: 'TPI-2026-001', period: 1 }
          ]
        }
      ])
    })

    await waitFor(() => {
      expect(screen.getAllByText(/13\.06\.2026 .* matin .* C305/i).length).toBeGreaterThan(0)
    })
  })

  test('distingue la planification actuelle des créneaux de vote figés', async () => {
    localStorage.setItem(STORAGE_KEYS.ORGANIZER_DATA, JSON.stringify([
      {
        site: 'ETML',
        name: 'C303',
        date: '2026-06-12',
        configSite: {
          firstTpiStartTime: '08:00',
          tpiTimeMinutes: 60,
          breaklineMinutes: 10
        },
        tpiDatas: [
          { refTpi: '42', period: 1 }
        ]
      }
    ]))
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([buildVoteProposalTpi()])

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    expect(await screen.findByText('TPI-2026-042')).toBeInTheDocument()
    expect(screen.getAllByText(/Planification actuelle/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/12\.06\.2026 .* Matin .* C303/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/^Vote initial$/i)).toBeInTheDocument()
    expect(screen.getAllByText(/10\.06\.2026 .* Matin .* A101/i).length).toBeGreaterThan(0)
  })

  test('marque une alternative comme conforme quand elle correspond à la Planification actuelle', async () => {
    localStorage.setItem(STORAGE_KEYS.ORGANIZER_DATA, JSON.stringify([
      {
        site: 'ETML',
        name: 'C303',
        date: '2026-06-11',
        configSite: {
          firstTpiStartTime: '13:00',
          tpiTimeMinutes: 60,
          breaklineMinutes: 10
        },
        tpiDatas: [
          { refTpi: '42', period: 1 }
        ]
      }
    ]))
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([buildVoteProposalTpi()])

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    expect(await screen.findByText('TPI-2026-042')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /expert 2 ok/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /expert 2 ok/i }))

    expect(screen.getAllByText(/Planification actuelle/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/11\.06\.2026 .* Après-midi .* C303/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/^Conforme$/i)).toBeInTheDocument()
    expect(screen.getAllByText(/^OK$/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/^Vote initial$/i)).toBeInTheDocument()
  })

  test('ne marque pas une alternative conforme quand seule la date correspond sans la demi-journée', async () => {
    localStorage.setItem(STORAGE_KEYS.ORGANIZER_DATA, JSON.stringify([
      {
        site: 'ETML',
        name: 'A22',
        date: '2026-06-11',
        configSite: {
          firstTpiStartTime: '08:00',
          tpiTimeMinutes: 60,
          breaklineMinutes: 10
        },
        tpiDatas: [
          { refTpi: '42', period: 1 }
        ]
      }
    ]))
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([buildVoteProposalTpi()])

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    expect(await screen.findByText('TPI-2026-042')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /expert 2 proposition/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /expert 2 proposition/i }))

    expect(screen.getAllByText(/11\.06\.2026 .* Matin .* A22/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/^Conforme$/i)).not.toBeInTheDocument()
  })

  test('synchronise automatiquement les votes du mini-site au chargement admin', async () => {
    coordinationServices.workflowCoordinationService.getStaticVotePublicationStatus.mockResolvedValueOnce({
      available: true,
      publicUrl: 'https://tpi26.ch/votes-2026/',
      syncSecretConfigured: true
    })

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    await waitFor(() => {
      expect(coordinationServices.workflowCoordinationService.syncStaticVotePublication).toHaveBeenCalledWith('2026')
    })
    expect(await screen.findByText(/Coordination 2026/i)).toBeInTheDocument()
  })

  test('reste stable quand les services de coordination renvoient des listes vides ou nulles', async () => {
    coordinationServices.coordinationCatalogService.getGlobal.mockResolvedValue(null)
    coordinationServices.coordinationConfigService.getByYear.mockResolvedValue(null)
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue(null)
    coordinationServices.slotService.getCalendar.mockResolvedValue(null)
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue(null)
    coordinationServices.workflowCoordinationService.getActiveSnapshot.mockResolvedValue(null)
    tpiController.getTpiModels.mockResolvedValue(null)

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    expect(await screen.findByRole('heading', { name: /campagne de votes 2026/i })).toBeInTheDocument()
    expect(screen.queryByText(/workflow planification/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/poste de pilotage du workflow/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Erreur lors du chargement des données de planification/i)).not.toBeInTheDocument()
  })

  test('applique automatiquement un focus transmis par la fiche TPI', async () => {
    renderDashboard({ initialEntries: ['/coordination/2026?tab=list&focus=TPI-2026-001'] })

    expect(await screen.findByDisplayValue('TPI-2026-001')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /tpi-2026-001/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /fiche complète/i })).toHaveAttribute('href', '/tpi/2026/TPI-2026-001')
    expect(screen.getByText(/focus actif: TPI-2026-001/i)).toBeInTheDocument()
  })

  test('signale explicitement un focus sans résultat visible', async () => {
    renderDashboard({ initialEntries: ['/coordination/2026?tab=list&focus=TPI-2026-999'] })

    expect(await screen.findByDisplayValue('TPI-2026-999')).toBeInTheDocument()
    expect(screen.getByText(/aucun tpi visible ne correspond/i)).toBeInTheDocument()
  })

  test('filtre la coordination par date de défense', async () => {
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([
      {
        _id: 'coordination-date-1',
        reference: 'TPI-2026-010',
        status: 'confirmed',
        candidat: { firstName: 'Alice', lastName: 'Durand' },
        proposedSlots: [
          {
            slot: {
              _id: 'slot-10',
              date: '2026-06-10T08:00:00.000Z',
              startTime: '08:00',
              room: { name: 'A101' }
            }
          }
        ]
      },
      {
        _id: 'coordination-date-2',
        reference: 'TPI-2026-012',
        status: 'confirmed',
        candidat: { firstName: 'Nora', lastName: 'Martin' },
        proposedSlots: [
          {
            slot: {
              _id: 'slot-12',
              date: '2026-06-12T08:00:00.000Z',
              startTime: '08:00',
              room: { name: 'B202' }
            }
          }
        ]
      }
    ])

    renderDashboard({ initialEntries: ['/coordination/2026?tab=list'] })

    expect(await screen.findByTestId('mock-tpi-refs')).toHaveTextContent('TPI-2026-010')
    expect(screen.getByTestId('mock-tpi-refs')).toHaveTextContent('TPI-2026-012')

    fireEvent.change(screen.getByLabelText('Filtrer par date de défense'), {
      target: { value: '2026-06-12' }
    })

    expect(screen.getByTestId('mock-tpi-count')).toHaveTextContent('1')
    expect(screen.getByTestId('mock-tpi-refs')).toHaveTextContent('TPI-2026-012')
    expect(screen.getByTestId('mock-tpi-refs')).not.toHaveTextContent('TPI-2026-010')
    expect(screen.getByText(/Date: ven., 12.06.2026/i)).toBeInTheDocument()
  })

  test('ne rend plus le bloc workflow admin', async () => {
    renderDashboard()

    expect(await screen.findByRole('heading', { name: /campagne de votes 2026/i })).toBeInTheDocument()
    expect(screen.queryByText(/poste de pilotage du workflow/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /automatiser planification/i })).not.toBeInTheDocument()
  })

  test('ouvre les votes sans emails depuis le cockpit votes debug', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    coordinationServices.workflowCoordinationService.getActiveSnapshot.mockResolvedValue({
      version: 2,
      isActive: true
    })

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', { name: /ouvrir votes sans emails/i }))

    await waitFor(() => {
      expect(coordinationServices.workflowCoordinationService.startVotesWithoutEmails).toHaveBeenCalledWith('2026')
    })

    confirmSpy.mockRestore()
  })

  test('ouvre les votes avec la Planification courante quand elle existe', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    const currentRooms = [
      {
        site: 'ETML',
        name: 'D101',
        date: '2026-06-11',
        tpiDatas: [
          { refTpi: '1', period: 1 }
        ]
      }
    ]
    localStorage.setItem(STORAGE_KEYS.ORGANIZER_DATA, JSON.stringify(currentRooms))
    coordinationServices.workflowCoordinationService.getActiveSnapshot.mockResolvedValue({
      version: 2,
      isActive: true
    })

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', { name: /^ouvrir votes$/i }))

    await waitFor(() => {
      expect(coordinationServices.workflowCoordinationService.startVotesWithoutEmails).toHaveBeenCalledWith('2026', currentRooms)
    })

    confirmSpy.mockRestore()
  })

  test('transmet les notifications ciblées après changement de publication des défenses', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    coordinationServices.workflowCoordinationService.getDefenseChangeNotificationPreview.mockResolvedValueOnce({
      hasCurrentPublication: true,
      hasPreviousPublication: true,
      summary: {
        changedDefenseCount: 1,
        pendingRecipientCount: 2,
        sentRecipientCount: 0
      }
    })
    coordinationServices.workflowCoordinationService.sendDefenseChangeNotifications.mockResolvedValueOnce({
      success: true,
      summary: {
        sentCount: 2,
        skippedCount: 0,
        failedCount: 0
      },
      preview: {
        hasCurrentPublication: true,
        hasPreviousPublication: true,
        summary: {
          changedDefenseCount: 1,
          pendingRecipientCount: 0,
          sentRecipientCount: 2
        }
      }
    })

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    expect(await screen.findByText(/Notifier changements \(2\)/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /notifier les changements des défenses/i }))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('2 partie(s) prenante(s)'))
      expect(coordinationServices.workflowCoordinationService.sendDefenseChangeNotifications).toHaveBeenCalledWith('2026', {})
    })
    expect(await screen.findByText(/Notifications changements défenses: 2 envoyée\(s\), 0 ignorée\(s\), 0 échec\(s\)\./i)).toBeInTheDocument()
    expect(screen.getByText(/Changements notifiés/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /notifier les changements des défenses/i })).toBeDisabled()

    confirmSpy.mockRestore()
  })

  test('exporte la planification depuis coordination et met a jour le cache local', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', { name: /coord\. → planif\./i }))

    await waitFor(() => {
      expect(coordinationServices.workflowCoordinationService.syncPlanificationFromCoordination).toHaveBeenCalledWith('2026')
    })

    expect(localStorage.getItem(STORAGE_KEYS.ORGANIZER_DATA)).toContain('A101')
    expect(await screen.findByText(/Planification synchronisée depuis Coordination: 1 TPI, 1 salle/i)).toBeInTheDocument()

    confirmSpy.mockRestore()
  })

  test('ouvre l aperçu des liens vote depuis le cockpit votes debug', async () => {
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    const targetYear = '2026'

    renderDashboard({
      initialEntries: [`/coordination/${targetYear}?tab=votes`],
      year: targetYear,
      children: <LocationDisplay />
    })

    fireEvent.click(await screen.findByRole('button', { name: /voir liens vote/i }))

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        `${ROUTES.GEN_TOKENS}?year=${targetYear}&type=vote&auto=1`
      )
    })
  })

  test('avertit avant de préparer à nouveau le mini-site vote', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([buildVoteProposalTpi()])

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', { name: /préparer vote web/i }))

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Régénérer le mini-site vote'))
    expect(coordinationServices.workflowCoordinationService.generateStaticVotePublication).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  test('affiche le cockpit admin de campagne avec la file des votes a relancer', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true)
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([
      {
        _id: 'coordination-vote-1',
        reference: 'TPI-2026-042',
        status: 'voting',
        sujet: 'Sujet vote',
        candidat: { firstName: 'Nora', lastName: 'Martin' },
        expert1: { firstName: 'Bob', lastName: 'Expert' },
        expert2: { firstName: 'Carla', lastName: 'Expert' },
        chefProjet: { firstName: 'Diane', lastName: 'Boss' },
        proposedSlots: [
          {
            slot: {
              _id: 'slot-fixed',
              date: '2026-06-10T08:00:00.000Z',
              startTime: '08:00',
              endTime: '12:00',
              room: { name: 'A101' }
            }
          }
        ],
        votingSession: {
          deadline: '2026-06-20T08:00:00.000Z',
          voteSummary: {
            expert1Voted: true,
            expert2Voted: true,
            chefProjetVoted: false
          }
        },
        voteRoleStatus: {
          expert1: { decision: 'accepted', responseMode: 'ok' },
          expert2: { decision: 'rejected', responseMode: 'proposal', alternativeCount: 1 },
          chef_projet: { decision: 'pending', responseMode: 'pending' }
        },
        voteStats: {
          totalVotes: 3,
          pendingVotes: 1,
          acceptedVotes: 1,
          preferredVotes: 1,
          rejectedVotes: 1,
          respondedVotes: 2
        },
        voteDecision: {
          slots: [
            {
              slotId: 'slot-fixed',
              isFixed: true,
              slot: {
                _id: 'slot-fixed',
                date: '2026-06-10T08:00:00.000Z',
                startTime: '08:00',
                endTime: '12:00',
                room: { name: 'A101' }
              },
              positiveCount: 1,
              rejectedCount: 1,
              pendingCount: 1,
              respondedCount: 2,
              roleDecisions: [
                { role: 'expert1', decision: 'accepted', voterName: 'Bob Expert' },
                { role: 'expert2', decision: 'rejected', voterName: 'Carla Expert', comment: 'Pas disponible' },
                { role: 'chef_projet', decision: 'pending', voterName: 'Diane Boss' }
              ]
            },
            {
              slotId: 'slot-alt',
              isFixed: false,
              slot: {
                _id: 'slot-alt',
                date: '2026-06-11T08:00:00.000Z',
                period: 'apres-midi',
                startTime: '',
                endTime: '',
                room: { name: 'B202' }
              },
              positiveCount: 1,
              rejectedCount: 0,
              pendingCount: 2,
              respondedCount: 1,
              roleDecisions: [
                { role: 'expert1', decision: 'pending', voterName: 'Bob Expert' },
                {
                  role: 'expert2',
                  decision: 'preferred',
                  voteId: 'vote-alt-expert2',
                  voterName: 'Carla Expert',
                  priority: 1,
                  availabilityException: true,
                  specialRequestReason: 'Indisponible le matin',
                  specialRequestDate: '2026-06-13T08:00:00.000Z'
                },
                { role: 'chef_projet', decision: 'pending', voterName: 'Diane Boss' }
              ]
            }
          ]
        }
      }
    ])

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    expect(await screen.findByRole('heading', { name: /campagne de votes 2026/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /réponses reçues/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /à relancer/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /prêts à clore/i })).toBeInTheDocument()
    expect(screen.getByText(/1 TPI visible · 0 complets · 1 réponse manquante/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /relancer sans réponse/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /à relancer/i })).toBeInTheDocument()
    expect(screen.getByText('TPI-2026-042')).toBeInTheDocument()
    expect(screen.getAllByText(/manque: chef de projet/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/réponse de expert 2/i)).toBeInTheDocument()
    expect(screen.getAllByText(/proposition/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/11\.06\.2026 · après-midi · B202/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/11\.06\.2026 · 13:00-17:00 · B202/i)).not.toBeInTheDocument()
    expect(screen.getAllByText('Expert 2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Carla Expert').length).toBeGreaterThan(0)
    expect(screen.queryByText(new RegExp(String.fromCodePoint(0x1f538), 'i'))).not.toBeInTheDocument()
    expect(screen.queryByText(/Choix 1/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Demande spécifique 13\.06\.2026 · Indisponible le matin/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', {
      name: /enregistrer 11\.06\.2026 .* après-midi .* b202 comme date idéale de carla expert/i
    }))

    await waitFor(() => {
      expect(coordinationServices.voteService.addProposalToPreferences).toHaveBeenCalledWith('vote-alt-expert2')
    })

    fireEvent.click(screen.getByRole('button', {
      name: /tester le déplacement de tpi-2026-042 vers 11\.06\.2026 .* après-midi .* b202/i
    }))

    expect(await screen.findByRole('dialog', { name: /test de déplacement/i })).toBeInTheDocument()
    expect(screen.getAllByText(/11\.06\.2026 · après-midi · B202/i).length).toBeGreaterThan(0)
    expect(coordinationServices.tpiCoordinationService.simulateMoveToSlot).toHaveBeenCalledWith(
      'coordination-vote-1',
      'slot-alt'
    )
    expect(await screen.findByText(/déplacement possible sans conflit détecté/i)).toBeInTheDocument()

    const safeMoveButton = screen.getByRole('button', {
      name: /confirmer déplacement sans conflit détecté pour tpi-2026-042/i
    })
    expect(safeMoveButton).toHaveClass('is-safe')
    expect(safeMoveButton).toHaveAttribute('title', 'Pas de conflit détecté: déplacement simplifié.')

    fireEvent.click(safeMoveButton)

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(coordinationServices.tpiCoordinationService.moveToSlot).toHaveBeenCalledWith(
        'coordination-vote-1',
        'slot-alt',
        expect.stringMatching(/Carla Expert/i)
      )
    })
  })

  test('force OK globalement pour les manquants puis individuellement pour un rôle', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([buildVoteProposalTpi()])

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', { name: /forcer ok chefs de projet en attente/i }))

    await waitFor(() => {
      expect(coordinationServices.voteService.forceOk).toHaveBeenCalledWith({
        year: '2026',
        roles: ['chef_projet'],
        tpiIds: ['coordination-vote-1'],
        onlyMissing: true,
        reason: expect.stringContaining('chefs de projet en attente')
      })
    })
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Seules les réponses manquantes'))

    fireEvent.click(await screen.findByRole('button', { name: /forcer ok pour expert 2 sur tpi-2026-042/i }))

    await waitFor(() => {
      expect(coordinationServices.voteService.forceOk).toHaveBeenLastCalledWith({
        year: '2026',
        roles: ['expert2'],
        tpiIds: ['coordination-vote-1'],
        onlyMissing: false,
        reason: expect.stringContaining('Expert 2 de TPI-2026-042')
      })
    })
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('sera remplacée'))

    confirmSpy.mockRestore()
  })

  test('masque les TPI sans réponse dans le cockpit de votes', async () => {
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([
      buildVoteProposalTpi(),
      buildVoteProposalTpi({
        _id: 'coordination-vote-empty',
        reference: 'TPI-2026-099',
        voteRoleStatus: {
          expert1: { decision: 'pending', responseMode: 'pending' },
          expert2: { decision: 'pending', responseMode: 'pending' },
          chef_projet: { decision: 'pending', responseMode: 'pending' }
        },
        voteStats: {
          totalVotes: 3,
          pendingVotes: 3,
          acceptedVotes: 0,
          preferredVotes: 0,
          rejectedVotes: 0,
          respondedVotes: 0
        },
        voteDecision: {
          slots: [
            {
              slotId: 'slot-empty-fixed',
              isFixed: true,
              slot: {
                _id: 'slot-empty-fixed',
                date: '2026-06-12T08:00:00.000Z',
                startTime: '08:00',
                endTime: '12:00',
                room: { name: 'C303' }
              },
              positiveCount: 0,
              rejectedCount: 0,
              pendingCount: 3,
              respondedCount: 0,
              roleDecisions: [
                { role: 'expert1', decision: 'pending', voterName: 'Bob Expert' },
                { role: 'expert2', decision: 'pending', voterName: 'Carla Expert' },
                { role: 'chef_projet', decision: 'pending', voterName: 'Diane Boss' }
              ]
            }
          ]
        }
      })
    ])

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    expect(await screen.findByRole('heading', { name: /campagne de votes 2026/i })).toBeInTheDocument()
    expect(screen.getByText('TPI-2026-042')).toBeInTheDocument()
    expect(screen.queryByText('TPI-2026-099')).not.toBeInTheDocument()
    expect(screen.getByText(/1\/1 TPI avec réponse/i)).toBeInTheDocument()
  })

  test('relance uniquement les parties prenantes touchées par un déplacement de vote', async () => {
    const movedTpi = buildVoteProposalTpi()
    movedTpi.voteDecision = {
      ...movedTpi.voteDecision,
      satisfaction: {
        movedAfterVotes: true,
        currentSlotId: 'slot-fixed',
        currentSlot: {
          _id: 'slot-fixed',
          date: '2026-06-10T08:00:00.000Z',
          startTime: '08:00',
          endTime: '12:00',
          room: { name: 'A101' }
        },
        currentPositiveCount: 1,
        baselineSlotId: 'slot-alt',
        baselineSlot: {
          _id: 'slot-alt',
          date: '2026-06-11T08:00:00.000Z',
          startTime: '13:00',
          endTime: '17:00',
          room: { name: 'B202' }
        },
        baselinePositiveCount: 2,
        delta: -1,
        touchedRoleCount: 2,
        touchedRoles: [
          { role: 'expert2', voterName: 'Carla Expert', decision: 'rejected' },
          { role: 'chef_projet', voterName: 'Diane Boss', decision: 'pending' }
        ]
      }
    }
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([movedTpi])
    jest.spyOn(coordinationServices.workflowCoordinationService, 'remindVotes').mockResolvedValue({
      success: true,
      emailsSucceeded: 2,
      emailsSent: 2
    })

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', { name: /relancer les tpi déplacés/i }))

    expect(screen.getByText(/Déplacement: 1\/3 accord contre 2\/3 sur la base/i)).toBeInTheDocument()
    expect(screen.getByText(/Relance ciblée: Carla Expert, Diane Boss/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(coordinationServices.workflowCoordinationService.remindVotes).toHaveBeenCalledWith('2026', {
        actionKey: 'remindMovedVotes',
        tpiIds: ['coordination-vote-1'],
        movedOnly: true
      })
    })
    expect(await screen.findByText('Relance ciblée (1 TPI): 2/2.')).toBeInTheDocument()
  })

  test('garde une file filtrée vide quand aucun TPI avec réponse ne correspond', async () => {
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([
      buildVoteProposalTpi({
        _id: 'coordination-vote-ready',
        reference: 'TPI-2026-READY',
        voteRoleStatus: {
          expert1: { decision: 'accepted', responseMode: 'ok' },
          expert2: { decision: 'accepted', responseMode: 'ok' },
          chef_projet: { decision: 'accepted', responseMode: 'ok' }
        },
        voteStats: {
          totalVotes: 3,
          pendingVotes: 0,
          acceptedVotes: 3,
          preferredVotes: 0,
          rejectedVotes: 0,
          respondedVotes: 3
        }
      })
    ])

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    expect(await screen.findByText('TPI-2026-READY')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /à relancer/i }))

    expect(screen.queryByText('TPI-2026-READY')).not.toBeInTheDocument()
    expect(screen.getByText(/aucune réponse dans cette file/i)).toBeInTheDocument()
  })

  test('affiche les commentaires seule disponibilité et contrainte dure dans le suivi des votes', async () => {
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([
      buildVoteProposalTpi({
        voteStats: {
          totalVotes: 3,
          pendingVotes: 0,
          acceptedVotes: 1,
          preferredVotes: 1,
          rejectedVotes: 1,
          respondedVotes: 3
        },
        voteRoleStatus: {
          expert1: { decision: 'accepted', responseMode: 'ok' },
          expert2: { decision: 'rejected', responseMode: 'proposal', hardConstraint: true },
          chef_projet: { decision: 'preferred', responseMode: 'proposal', alternativeCount: 1 }
        },
        voteDecision: {
          slots: [
            {
              slotId: 'slot-fixed',
              isFixed: true,
              slot: {
                _id: 'slot-fixed',
                date: '2026-06-10T08:00:00.000Z',
                startTime: '08:00',
                endTime: '12:00',
                room: { name: 'A101' }
              },
              positiveCount: 1,
              rejectedCount: 1,
              pendingCount: 0,
              respondedCount: 2,
              roleDecisions: [
                { role: 'expert1', decision: 'accepted', voterName: 'Bob Expert' },
                {
                  role: 'expert2',
                  decision: 'rejected',
                  voterName: 'Carla Expert',
                  hardConstraint: true,
                  comment: 'Aucune date proposée ne convient.'
                },
                {
                  role: 'chef_projet',
                  decision: 'rejected',
                  voterName: 'Diane Boss',
                  comment: 'Seule disponibilité signalée. Préférence à confirmer.'
                }
              ]
            },
            {
              slotId: 'slot-alt',
              isFixed: false,
              slot: {
                _id: 'slot-alt',
                date: '2026-06-11T08:00:00.000Z',
                startTime: '13:00',
                endTime: '17:00',
                room: { name: 'B202' }
              },
              positiveCount: 1,
              rejectedCount: 0,
              pendingCount: 2,
              respondedCount: 1,
              roleDecisions: [
                { role: 'expert1', decision: 'pending', voterName: 'Bob Expert' },
                { role: 'expert2', decision: 'rejected', voterName: 'Carla Expert' },
                {
                  role: 'chef_projet',
                  decision: 'preferred',
                  voteId: 'vote-alt-chef',
                  voterName: 'Diane Boss',
                  priority: 1
                }
              ]
            }
          ]
        }
      })
    ])

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    expect(await screen.findByRole('heading', { name: /campagne de votes 2026/i })).toBeInTheDocument()
    expect(screen.getByText(/1 contrainte/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Contrainte dure/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Aucune date proposée ne convient\./i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /vérifier contraintes/i }))

    expect(await screen.findByText(/1 TPI avec contrainte dure/i)).toBeInTheDocument()
    expect(screen.getByText(/2 signalements à traiter/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', {
      name: /afficher tpi-2026-042 pour traiter la contrainte/i
    }).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Contrainte dure: Carla Expert sur 10\.06\.2026 · Matin · A101: Aucune date proposée ne convient\./i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Contrainte dure: Diane Boss sur 11\.06\.2026 · Après-midi · B202: Seule disponibilité signalée\. Préférence à confirmer\./i).length).toBeGreaterThan(0)
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringMatching(/1 TPI avec contrainte dure \(2 signalements\)/i),
      expect.objectContaining({ position: 'top-center' })
    )

    fireEvent.click(screen.getByRole('tab', { name: /chef de projet/i }))

    expect(screen.queryByText(/Demande spécifique Seule disponibilité signalée\. Préférence à confirmer\./i)).not.toBeInTheDocument()
    expect(screen.getAllByText(/^Seule disponibilité$/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Seule disponibilité signalée\. Préférence à confirmer\./i)).toBeInTheDocument()
    expect(screen.queryByRole('button', {
      name: /tester le déplacement de tpi-2026-042 vers 11\.06\.2026/i
    })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {
      name: /enregistrer 11\.06\.2026 .* comme date idéale de diane boss/i
    }))
    await waitFor(() => {
      expect(coordinationServices.voteService.addProposalToPreferences).toHaveBeenCalledWith('vote-alt-chef')
    })
  })

  test('vérifie aussi les contraintes dures portées par le statut du rôle', async () => {
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([
      buildVoteProposalTpi({
        voteRoleStatus: {
          expert1: { decision: 'accepted', responseMode: 'ok' },
          expert2: {
            decision: 'rejected',
            responseMode: 'proposal',
            hardConstraint: true,
            voterName: 'Carla Expert',
            specialRequestReason: 'Indisponible toute la semaine'
          },
          chef_projet: { decision: 'pending', responseMode: 'pending' }
        },
        voteStats: {
          totalVotes: 3,
          pendingVotes: 1,
          acceptedVotes: 1,
          preferredVotes: 0,
          rejectedVotes: 1,
          respondedVotes: 2
        }
      })
    ])

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', { name: /vérifier contraintes/i }))

    expect(await screen.findByText(/1 TPI avec contrainte dure/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Contrainte dure: Carla Expert: Indisponible toute la semaine/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Meilleur créneau sans contrainte dure: 11\.06\.2026 · Après-midi · B202 \(1\/3\)\./i)).toBeInTheDocument()
  })

  test('transmet une proposition d arbitrage depuis un dossier bloquant', async () => {
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([
      buildVoteProposalTpi({
        voteRoleStatus: {
          expert1: { decision: 'accepted', responseMode: 'ok' },
          expert2: {
            decision: 'rejected',
            responseMode: 'proposal',
            hardConstraint: true,
            voterName: 'Carla Expert',
            specialRequestReason: 'Indisponible toute la semaine'
          },
          chef_projet: { decision: 'pending', responseMode: 'pending' }
        }
      })
    ])

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', {
      name: /transmettre une proposition d.arbitrage pour tpi-2026-042/i
    }))

    expect(await screen.findByRole('dialog', { name: /informer les parties prenantes/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /transmettre la proposition d.arbitrage pour tpi-2026-042/i }))

    await waitFor(() => {
      expect(coordinationServices.resolutionProposalService.create).toHaveBeenCalledWith(
        'coordination-vote-1',
        expect.objectContaining({
          slotId: 'slot-alt',
          recipientRoles: ['chef_projet'],
          baseUrl: 'http://localhost'
        })
      )
    })
    expect(toast.success).toHaveBeenCalledWith('TPI-2026-042: proposition transmise.')
  })

  test('génère les liens DEV sans fermer la modale d arbitrage', async () => {
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([
      buildVoteProposalTpi({
        voteRoleStatus: {
          expert1: { decision: 'accepted', responseMode: 'ok' },
          expert2: {
            decision: 'rejected',
            responseMode: 'proposal',
            hardConstraint: true,
            voterName: 'Carla Expert',
            specialRequestReason: 'Indisponible toute la semaine'
          },
          chef_projet: { decision: 'pending', responseMode: 'pending' }
        }
      })
    ])
    coordinationServices.resolutionProposalService.create.mockResolvedValueOnce({
      success: true,
      proposal: {
        id: 'resolution-proposal-dev',
        status: 'sent',
        devMode: true,
        devLinks: [
          {
            role: 'expert1',
            roleLabel: 'Expert 1',
            name: 'Bob Expert',
            url: 'http://localhost/arbitrage-2026/dev-expert1'
          },
          {
            role: 'expert2',
            roleLabel: 'Expert 2',
            name: 'Carla Expert',
            url: 'http://localhost/arbitrage-2026/dev-expert2'
          }
        ]
      }
    })

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', {
      name: /transmettre une proposition d.arbitrage pour tpi-2026-042/i
    }))

    expect(await screen.findByRole('checkbox', { name: /mode dev/i })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: /transmettre la proposition d.arbitrage pour tpi-2026-042/i }))

    await waitFor(() => {
      expect(coordinationServices.resolutionProposalService.create).toHaveBeenCalledWith(
        'coordination-vote-1',
        expect.objectContaining({
          devMode: true
        })
      )
    })
    expect(await screen.findByText(/liens de test/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /expert 1 bob expert/i })).toHaveAttribute(
      'href',
      'http://localhost/arbitrage-2026/dev-expert1'
    )
    expect(toast.success).toHaveBeenCalledWith('TPI-2026-042: liens DEV générés, aucun email envoyé.')
  })

  test('affiche le blocage quand un déplacement proposé crée un conflit', async () => {
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([buildVoteProposalTpi()])
    coordinationServices.tpiCoordinationService.simulateMoveToSlot.mockResolvedValueOnce({
      success: false,
      canMove: false,
      status: 'blocked',
      message: 'Conflit détecté sur le créneau proposé.',
      tpi: { _id: 'coordination-vote-1', reference: 'TPI-2026-042' },
      currentSlot: { _id: 'slot-fixed', label: '10.06.2026 · 08:00-12:00 · A101' },
      targetSlot: { _id: 'slot-alt', label: '11.06.2026 · 13:00-17:00 · B202' },
      conflicts: [
        { type: 'person_overlap', person: 'Diane Boss' }
      ],
      swapCandidate: null
    })

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', {
      name: /tester le déplacement de tpi-2026-042 vers 11\.06\.2026 .* après-midi .* b202/i
    }))

    expect(await screen.findByRole('dialog', { name: /test de déplacement/i })).toBeInTheDocument()
    expect(await screen.findByText(/déplacement bloqué/i)).toBeInTheDocument()
    expect(await screen.findByText(/Diane Boss est déjà engagé sur ce créneau/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /confirmer déplacement/i })).not.toBeInTheDocument()

    const blockedMoveButton = screen.getByRole('button', {
      name: /résoudre manuellement le déplacement de tpi-2026-042/i
    })
    expect(blockedMoveButton).toHaveClass('is-blocked')
    expect(blockedMoveButton).toHaveAttribute('title', 'Conflit détecté: résolution manuelle nécessaire.')

    fireEvent.click(blockedMoveButton)

    expect(await screen.findByText(/focus résolution coordination-vote-1/i)).toBeInTheDocument()
    expect(coordinationServices.tpiCoordinationService.moveToSlot).not.toHaveBeenCalled()
  })

  test('n applique pas le déplacement proposé quand la confirmation admin est annulée', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([buildVoteProposalTpi()])

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', {
      name: /tester le déplacement de tpi-2026-042 vers 11\.06\.2026 .* après-midi .* b202/i
    }))

    fireEvent.click(await screen.findByRole('button', { name: /confirmer déplacement/i }))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Confirmer le déplacement de TPI-2026-042 vers 11\.06\.2026/i)
      )
    })
    expect(coordinationServices.tpiCoordinationService.moveToSlot).not.toHaveBeenCalled()
  })

  test('signale une préférence déjà présente dans les dates idéales', async () => {
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([buildVoteProposalTpi()])
    coordinationServices.voteService.addProposalToPreferences.mockResolvedValueOnce({
      success: true,
      added: false,
      voter: { name: 'Carla Expert' }
    })

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', {
      name: /enregistrer 11\.06\.2026 .* b202 comme date idéale de carla expert/i
    }))

    await waitFor(() => {
      expect(coordinationServices.voteService.addProposalToPreferences).toHaveBeenCalledWith('vote-alt-expert2')
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Carla Expert: préférence déjà présente dans ses dates idéales.')
    })
    expect(await screen.findByText(/Carla Expert: préférence déjà présente dans ses dates idéales/i)).toBeInTheDocument()
  })

  test('garde le bouton préférence disponible pour une proposition déjà confirmée', async () => {
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([
      buildVoteProposalTpi({
        status: 'confirmed',
        confirmedSlot: {
          _id: 'slot-fixed',
          date: '2026-06-10T08:00:00.000Z',
          startTime: '08:00',
          endTime: '12:00',
          room: { name: 'A101' }
        }
      })
    ])

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    expect(await screen.findByText('TPI-2026-042')).toBeInTheDocument()
    expect(screen.queryByRole('button', {
      name: /tester le déplacement de tpi-2026-042 vers 11\.06\.2026/i
    })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', {
      name: /enregistrer 11\.06\.2026 .* comme date idéale de carla expert/i
    }))

    await waitFor(() => {
      expect(coordinationServices.voteService.addProposalToPreferences).toHaveBeenCalledWith('vote-alt-expert2')
    })
  })

  test('ouvre la résolution depuis une ligne de vote à traiter', async () => {
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([
      {
        _id: 'coordination-manual-1',
        reference: 'TPI-2026-077',
        status: 'manual_required',
        sujet: 'Sujet manuel',
        candidat: { firstName: 'Nora', lastName: 'Martin' },
        expert1: { firstName: 'Bob', lastName: 'Expert' },
        expert2: { firstName: 'Carla', lastName: 'Expert' },
        chefProjet: { firstName: 'Diane', lastName: 'Boss' },
        proposedSlots: [
          {
            slot: {
              _id: 'slot-manual',
              date: '2026-06-10T08:00:00.000Z',
              startTime: '08:00',
              endTime: '12:00',
              room: { name: 'A101' }
            }
          }
        ],
        votingSession: {
          deadline: '2026-06-20T08:00:00.000Z',
          voteSummary: {
            expert1Voted: true,
            expert2Voted: true,
            chefProjetVoted: true
          }
        },
        voteRoleStatus: {
          expert1: { decision: 'accepted', responseMode: 'ok' },
          expert2: { decision: 'rejected', responseMode: 'proposal', alternativeCount: 1 },
          chef_projet: { decision: 'accepted', responseMode: 'ok' }
        },
        voteStats: {
          totalVotes: 3,
          pendingVotes: 0,
          acceptedVotes: 2,
          preferredVotes: 0,
          rejectedVotes: 1,
          respondedVotes: 3
        },
        voteDecision: {
          slots: [
            {
              slotId: 'slot-manual',
              isFixed: true,
              slot: {
                _id: 'slot-manual',
                date: '2026-06-10T08:00:00.000Z',
                startTime: '08:00',
                endTime: '12:00',
                room: { name: 'A101' }
              },
              positiveCount: 2,
              rejectedCount: 1,
              pendingCount: 0,
              respondedCount: 3,
              roleDecisions: [
                { role: 'expert1', decision: 'accepted', voterName: 'Bob Expert' },
                { role: 'expert2', decision: 'rejected', voterName: 'Carla Expert', comment: 'Pas disponible' },
                { role: 'chef_projet', decision: 'accepted', voterName: 'Diane Boss' }
              ]
            }
          ]
        }
      }
    ])

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', {
      name: /résoudre le créneau manuel de tpi-2026-077 depuis la file/i
    }))

    expect(await screen.findByRole('heading', { name: /créneaux à résoudre/i })).toBeInTheDocument()
    expect(screen.getByText(/focus résolution coordination-manual-1/i)).toBeInTheDocument()
  })

  test('permet de confirmer directement un créneau depuis le détail des votes admin', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    coordinationServices.workflowCoordinationService.getYearState.mockResolvedValue({ state: 'voting_open' })
    coordinationServices.tpiCoordinationService.getByYear.mockResolvedValue([
      {
        _id: 'coordination-ready-1',
        reference: 'TPI-2026-088',
        status: 'voting',
        sujet: 'Sujet consensus',
        candidat: { firstName: 'Nora', lastName: 'Martin' },
        expert1: { firstName: 'Bob', lastName: 'Expert' },
        expert2: { firstName: 'Carla', lastName: 'Expert' },
        chefProjet: { firstName: 'Diane', lastName: 'Boss' },
        proposedSlots: [
          {
            slot: {
              _id: 'slot-consensus',
              date: '2026-06-12T08:00:00.000Z',
              startTime: '08:00',
              endTime: '12:00',
              room: { name: 'A101' }
            }
          }
        ],
        votingSession: {
          deadline: '2026-06-20T08:00:00.000Z',
          voteSummary: {
            expert1Voted: true,
            expert2Voted: true,
            chefProjetVoted: true
          }
        },
        voteRoleStatus: {
          expert1: { decision: 'accepted', responseMode: 'ok' },
          expert2: { decision: 'accepted', responseMode: 'ok' },
          chef_projet: { decision: 'accepted', responseMode: 'ok' }
        },
        voteStats: {
          totalVotes: 3,
          pendingVotes: 0,
          acceptedVotes: 3,
          preferredVotes: 0,
          rejectedVotes: 0,
          respondedVotes: 3
        },
        voteDecision: {
          slots: [
            {
              slotId: 'slot-consensus',
              isFixed: true,
              slot: {
                _id: 'slot-consensus',
                date: '2026-06-12T08:00:00.000Z',
                startTime: '08:00',
                endTime: '12:00',
                room: { name: 'A101' }
              },
              positiveCount: 3,
              rejectedCount: 0,
              pendingCount: 0,
              respondedCount: 3,
              roleDecisions: [
                { role: 'expert1', decision: 'accepted', voterName: 'Bob Expert' },
                { role: 'expert2', decision: 'accepted', voterName: 'Carla Expert' },
                { role: 'chef_projet', decision: 'accepted', voterName: 'Diane Boss' }
              ]
            }
          ]
        }
      }
    ])

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', { name: /valider 12\.06\.2026 .* tpi-2026-088/i }))

    await waitFor(() => {
      expect(coordinationServices.tpiCoordinationService.forceSlot).toHaveBeenCalledWith(
        'coordination-ready-1',
        'slot-consensus',
        expect.stringMatching(/consensus 3\/3/i)
      )
    })

    confirmSpy.mockRestore()
  })

  test('n affiche pas les TPI legacy non importés hors des sites configurés', async () => {
    coordinationServices.coordinationConfigService.getByYear.mockResolvedValue({
      classTypes: [],
      siteConfigs: [
        { siteCode: 'ETML', active: true }
      ]
    })
    tpiController.getTpiModels.mockResolvedValue([
      {
        refTpi: '9001',
        candidat: 'Alice Hors Coordination',
        site: 'CFPV',
        expert1: { name: '' },
        expert2: { name: '' },
        boss: { name: '' }
      }
    ])

    renderDashboard({ initialEntries: ['/coordination/2026?tab=votes'] })

    await waitFor(() => {
      expect(coordinationServices.coordinationConfigService.getByYear).toHaveBeenCalledWith('2026')
    })

    expect(await screen.findByRole('heading', { name: /campagne de votes 2026/i })).toBeInTheDocument()
    expect(screen.queryByText(/Perimetre Coordination 2026/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/1 TPI hors site/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Sites planifies: ETML/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/CFPV: 1/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/tpi non importés/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/TPI-2026-9001/i)).not.toBeInTheDocument()
  })
})
