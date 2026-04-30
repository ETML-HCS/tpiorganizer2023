import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'

import PlanningDashboard from './PlanningDashboard'
import * as planningServices from '../../services/planningService'
import * as tpiController from '../tpiControllers/TpiController.jsx'
import { ROUTES } from '../../config/appConfig'
import { renderWithRouter } from '../../test-utils/renderWithRouter'

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

jest.mock('./PlanningCalendar', () => () => <div>Calendrier</div>)

jest.mock('./TpiPlanningList', () => ({ tpis, onSelectTpi }) => (
  Array.isArray(tpis) && tpis.length > 0 ? (
    <button type='button' onClick={() => onSelectTpi(tpis[0])}>
      Sélectionner un TPI
    </button>
  ) : (
    <div>Liste planning</div>
  )
))

jest.mock('./VotingPanel', () => () => <div>Votes</div>)
jest.mock('./ConflictResolver', () => ({ focusTpiId }) => (
  <div>
    Conflits
    {focusTpiId ? <span>Focus forçage {focusTpiId}</span> : null}
  </div>
))
jest.mock('./ImportPanel', () => () => <div>Import</div>)
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
    _id: 'planning-vote-1',
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
    jest.spyOn(planningServices.planningCatalogService, 'getGlobal').mockResolvedValue({ sites: [] })
    jest.spyOn(planningServices.planningConfigService, 'getByYear').mockResolvedValue({ classTypes: [], siteConfigs: [] })
    jest.spyOn(planningServices.tpiPlanningService, 'getByYear').mockResolvedValue([
      {
        _id: 'planning-1',
        reference: 'TPI-2026-001',
        status: 'draft',
        sujet: 'Sujet planning',
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
    jest.spyOn(planningServices.tpiPlanningService, 'forceSlot').mockResolvedValue({
      success: true
    })
    jest.spyOn(planningServices.tpiPlanningService, 'simulateMoveToSlot').mockResolvedValue({
      success: true,
      canMove: true,
      status: 'clear',
      message: 'Déplacement possible sans conflit détecté.',
      tpi: { _id: 'planning-vote-1', reference: 'TPI-2026-042' },
      currentSlot: { _id: 'slot-fixed', label: '10.06.2026 · 08:00-12:00 · A101' },
      targetSlot: { _id: 'slot-alt', label: '11.06.2026 · 13:00-17:00 · B202' },
      conflicts: [],
      swapCandidate: null
    })
    jest.spyOn(planningServices.tpiPlanningService, 'moveToSlot').mockResolvedValue({
      success: true
    })
    jest.spyOn(planningServices.voteService, 'addProposalToPreferences').mockResolvedValue({
      success: true,
      added: true,
      voter: { name: 'Carla Expert' }
    })
    jest.spyOn(planningServices.slotService, 'getCalendar').mockResolvedValue([])
    jest.spyOn(planningServices.workflowPlanningService, 'getYearState').mockResolvedValue({ state: 'planning' })
    jest.spyOn(planningServices.workflowPlanningService, 'getActiveSnapshot').mockResolvedValue(null)
    jest.spyOn(planningServices.workflowPlanningService, 'startVotesWithoutEmails').mockResolvedValue({
      success: true,
      workflowState: 'voting_open',
      tpiCount: 1,
      totalEmails: 0,
      successfulEmails: 0,
      failedEmails: 0,
      emailsSkipped: true,
      details: []
    })
    jest.spyOn(planningServices.workflowPlanningService, 'automatePlanification').mockResolvedValue({
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
  })

  test('ouvre une sidebar allégée quand un TPI est sélectionné', async () => {
    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: /liste complète/i }))
    fireEvent.click(await screen.findByRole('button', { name: /sélectionner un tpi/i }))

    expect(await screen.findByRole('dialog', { name: /tpi-2026-001/i })).toBeInTheDocument()
    expect(screen.getByText(/fiche planning/i)).toBeInTheDocument()
    expect(screen.getByText('Alice Durand', { selector: '.panel-candidate' })).toBeInTheDocument()
    expect(screen.getByText('Sujet planning', { selector: '.panel-subject' })).toBeInTheDocument()
    expect(screen.getByText(/participants/i, { selector: 'h4' })).toBeInTheDocument()
    expect(screen.getByText(/votes/i, { selector: 'h4' })).toBeInTheDocument()
    expect(screen.queryByText(/lecture croisée gestiontpi \/ planning/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/navigation interne de la fiche/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ouvrir la fiche/i })).toHaveAttribute('href', '/tpi/2026/TPI-2026-001')
  })

  test('reste stable quand les services de planning renvoient des listes vides ou nulles', async () => {
    planningServices.planningCatalogService.getGlobal.mockResolvedValue(null)
    planningServices.planningConfigService.getByYear.mockResolvedValue(null)
    planningServices.tpiPlanningService.getByYear.mockResolvedValue(null)
    planningServices.slotService.getCalendar.mockResolvedValue(null)
    planningServices.workflowPlanningService.getYearState.mockResolvedValue(null)
    planningServices.workflowPlanningService.getActiveSnapshot.mockResolvedValue(null)
    tpiController.getTpiModels.mockResolvedValue(null)

    renderDashboard({ initialEntries: ['/planning/2026?tab=votes'] })

    expect(await screen.findByRole('heading', { name: /campagne de votes 2026/i })).toBeInTheDocument()
    expect(screen.queryByText(/workflow planification/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/poste de pilotage du workflow/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Erreur lors du chargement des données de planification/i)).not.toBeInTheDocument()
  })

  test('applique automatiquement un focus transmis par la fiche TPI', async () => {
    renderDashboard({ initialEntries: ['/planning/2026?tab=list&focus=TPI-2026-001'] })

    expect(await screen.findByDisplayValue('TPI-2026-001')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /tpi-2026-001/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ouvrir la fiche/i })).toHaveAttribute('href', '/tpi/2026/TPI-2026-001')
    expect(screen.getByText(/focus actif: TPI-2026-001/i)).toBeInTheDocument()
  })

  test('signale explicitement un focus sans résultat visible', async () => {
    renderDashboard({ initialEntries: ['/planning/2026?tab=list&focus=TPI-2026-999'] })

    expect(await screen.findByDisplayValue('TPI-2026-999')).toBeInTheDocument()
    expect(screen.getByText(/aucun tpi visible ne correspond/i)).toBeInTheDocument()
  })

  test('ne rend plus le bloc workflow admin', async () => {
    renderDashboard()

    expect(await screen.findByRole('heading', { name: /campagne de votes 2026/i })).toBeInTheDocument()
    expect(screen.queryByText(/poste de pilotage du workflow/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /automatiser planification/i })).not.toBeInTheDocument()
  })

  test('ouvre les votes sans emails depuis le cockpit votes debug', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    planningServices.workflowPlanningService.getActiveSnapshot.mockResolvedValue({
      version: 2,
      isActive: true
    })

    renderDashboard({ initialEntries: ['/planning/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', { name: /ouvrir votes sans emails/i }))

    await waitFor(() => {
      expect(planningServices.workflowPlanningService.startVotesWithoutEmails).toHaveBeenCalledWith('2026')
    })

    confirmSpy.mockRestore()
  })

  test('ouvre l aperçu des liens vote depuis le cockpit votes debug', async () => {
    planningServices.workflowPlanningService.getYearState.mockResolvedValue({ state: 'voting_open' })
    const targetYear = '2026'

    renderDashboard({
      initialEntries: [`/planning/${targetYear}?tab=votes`],
      year: targetYear,
      children: <LocationDisplay />
    })

    fireEvent.click(await screen.findByRole('button', { name: /aperçu des liens vote/i }))

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        `${ROUTES.GEN_TOKENS}?year=${targetYear}&type=vote&auto=1`
      )
    })
  })

  test('affiche le cockpit admin de campagne avec la file des votes a relancer', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true)
    planningServices.workflowPlanningService.getYearState.mockResolvedValue({ state: 'voting_open' })
    planningServices.tpiPlanningService.getByYear.mockResolvedValue([
      {
        _id: 'planning-vote-1',
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
        }
      }
    ])

    renderDashboard({ initialEntries: ['/planning/2026?tab=votes'] })

    expect(await screen.findByRole('heading', { name: /campagne de votes 2026/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /relancer non-repondants/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /a relancer/i })).toBeInTheDocument()
    expect(screen.getByText('TPI-2026-042')).toBeInTheDocument()
    expect(screen.getByText(/manque: chef de projet/i)).toBeInTheDocument()
    expect(screen.getByText(/créneaux votés/i)).toBeInTheDocument()
    expect(screen.getAllByText(/proposition/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/11\.06\.2026 · 13:00-17:00 · B202/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/propositions reçues/i)).toBeInTheDocument()
    expect(screen.getAllByText('Expert 2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Carla Expert').length).toBeGreaterThan(0)
    expect(screen.queryByText(new RegExp(String.fromCodePoint(0x1f538), 'i'))).not.toBeInTheDocument()
    expect(screen.queryByText(/Choix 1/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Perso\. 13\.06\.2026 · Indisponible le matin/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', {
      name: /ajouter 11\.06\.2026 .* b202 aux dates idéales de carla expert/i
    }))

    await waitFor(() => {
      expect(planningServices.voteService.addProposalToPreferences).toHaveBeenCalledWith('vote-alt-expert2')
    })

    fireEvent.click(screen.getByRole('button', {
      name: /simuler le déplacement de tpi-2026-042 vers 11\.06\.2026 .* b202/i
    }))

    expect(await screen.findByRole('dialog', { name: /simulation déplacement/i })).toBeInTheDocument()
    expect(planningServices.tpiPlanningService.simulateMoveToSlot).toHaveBeenCalledWith(
      'planning-vote-1',
      'slot-alt'
    )
    expect(await screen.findByText(/déplacement possible sans conflit détecté/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /déplacer et confirmer/i }))

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled()
      expect(planningServices.tpiPlanningService.moveToSlot).toHaveBeenCalledWith(
        'planning-vote-1',
        'slot-alt',
        expect.stringMatching(/Carla Expert/i)
      )
    })
  })

  test('affiche le blocage quand un déplacement proposé crée un conflit', async () => {
    planningServices.workflowPlanningService.getYearState.mockResolvedValue({ state: 'voting_open' })
    planningServices.tpiPlanningService.getByYear.mockResolvedValue([buildVoteProposalTpi()])
    planningServices.tpiPlanningService.simulateMoveToSlot.mockResolvedValueOnce({
      success: false,
      canMove: false,
      status: 'blocked',
      message: 'Conflit détecté sur le créneau proposé.',
      tpi: { _id: 'planning-vote-1', reference: 'TPI-2026-042' },
      currentSlot: { _id: 'slot-fixed', label: '10.06.2026 · 08:00-12:00 · A101' },
      targetSlot: { _id: 'slot-alt', label: '11.06.2026 · 13:00-17:00 · B202' },
      conflicts: [
        { type: 'person_overlap', person: 'Diane Boss' }
      ],
      swapCandidate: null
    })

    renderDashboard({ initialEntries: ['/planning/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', {
      name: /simuler le déplacement de tpi-2026-042 vers 11\.06\.2026 .* b202/i
    }))

    expect(await screen.findByRole('dialog', { name: /simulation déplacement/i })).toBeInTheDocument()
    expect(await screen.findByText(/déplacement bloqué/i)).toBeInTheDocument()
    expect(await screen.findByText(/Diane Boss est déjà engagé sur ce créneau/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /déplacer et confirmer/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /ouvrir le forçage/i }))

    expect(await screen.findByText(/focus forçage planning-vote-1/i)).toBeInTheDocument()
    expect(planningServices.tpiPlanningService.moveToSlot).not.toHaveBeenCalled()
  })

  test('n applique pas le déplacement proposé quand la confirmation admin est annulée', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)
    planningServices.workflowPlanningService.getYearState.mockResolvedValue({ state: 'voting_open' })
    planningServices.tpiPlanningService.getByYear.mockResolvedValue([buildVoteProposalTpi()])

    renderDashboard({ initialEntries: ['/planning/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', {
      name: /simuler le déplacement de tpi-2026-042 vers 11\.06\.2026 .* b202/i
    }))

    fireEvent.click(await screen.findByRole('button', { name: /déplacer et confirmer/i }))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Déplacer et confirmer TPI-2026-042 vers 11\.06\.2026/i)
      )
    })
    expect(planningServices.tpiPlanningService.moveToSlot).not.toHaveBeenCalled()
  })

  test('signale une proposition déjà présente dans les dates idéales', async () => {
    planningServices.workflowPlanningService.getYearState.mockResolvedValue({ state: 'voting_open' })
    planningServices.tpiPlanningService.getByYear.mockResolvedValue([buildVoteProposalTpi()])
    planningServices.voteService.addProposalToPreferences.mockResolvedValueOnce({
      success: true,
      added: false,
      voter: { name: 'Carla Expert' }
    })

    renderDashboard({ initialEntries: ['/planning/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', {
      name: /ajouter 11\.06\.2026 .* b202 aux dates idéales de carla expert/i
    }))

    await waitFor(() => {
      expect(planningServices.voteService.addProposalToPreferences).toHaveBeenCalledWith('vote-alt-expert2')
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Carla Expert: proposition déjà présente dans les dates idéales.')
    })
    expect(await screen.findByText(/Carla Expert: proposition déjà présente dans les dates idéales/i)).toBeInTheDocument()
  })

  test('ouvre le forçage depuis une ligne de vote à traiter', async () => {
    planningServices.workflowPlanningService.getYearState.mockResolvedValue({ state: 'voting_open' })
    planningServices.tpiPlanningService.getByYear.mockResolvedValue([
      {
        _id: 'planning-manual-1',
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

    renderDashboard({ initialEntries: ['/planning/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', { name: /forcer un créneau pour tpi-2026-077/i }))

    expect(await screen.findByRole('heading', { name: /créneaux à forcer/i })).toBeInTheDocument()
    expect(screen.getByText(/focus forçage planning-manual-1/i)).toBeInTheDocument()
  })

  test('permet de confirmer directement un créneau depuis le détail des votes admin', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
    planningServices.workflowPlanningService.getYearState.mockResolvedValue({ state: 'voting_open' })
    planningServices.tpiPlanningService.getByYear.mockResolvedValue([
      {
        _id: 'planning-ready-1',
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

    renderDashboard({ initialEntries: ['/planning/2026?tab=votes'] })

    fireEvent.click(await screen.findByRole('button', { name: /valider 12\.06\.2026 .* tpi-2026-088/i }))

    await waitFor(() => {
      expect(planningServices.tpiPlanningService.forceSlot).toHaveBeenCalledWith(
        'planning-ready-1',
        'slot-consensus',
        expect.stringMatching(/consensus 3\/3/i)
      )
    })

    confirmSpy.mockRestore()
  })

  test('n affiche pas les TPI legacy non importés hors des sites configurés', async () => {
    planningServices.planningConfigService.getByYear.mockResolvedValue({
      classTypes: [],
      siteConfigs: [
        { siteCode: 'ETML', active: true }
      ]
    })
    tpiController.getTpiModels.mockResolvedValue([
      {
        refTpi: '9001',
        candidat: 'Alice Hors Planning',
        site: 'CFPV',
        expert1: { name: '' },
        expert2: { name: '' },
        boss: { name: '' }
      }
    ])

    renderDashboard({ initialEntries: ['/planning/2026?tab=votes'] })

    await waitFor(() => {
      expect(planningServices.planningConfigService.getByYear).toHaveBeenCalledWith('2026')
    })

    expect(await screen.findByRole('heading', { name: /campagne de votes 2026/i })).toBeInTheDocument()
    expect(screen.queryByText(/Perimetre Planning 2026/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/1 TPI hors site/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Sites planifies: ETML/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/CFPV: 1/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/tpi non importés/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/TPI-2026-9001/i)).not.toBeInTheDocument()
  })
})
