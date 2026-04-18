import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import PlanningDashboard from './PlanningDashboard'
import * as planningServices from '../../services/planningService'
import * as tpiController from '../tpiControllers/TpiController.jsx'
import { tpiDossierService } from '../../services/tpiDossierService'

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
jest.mock('./ConflictResolver', () => () => <div>Conflits</div>)
jest.mock('./ImportPanel', () => () => <div>Import</div>)
jest.mock('../shared/PageToolbar', () => ({ children, title }) => (
  <div>
    <h1>{title}</h1>
    {children}
  </div>
))

describe('PlanningDashboard', () => {
  beforeEach(() => {
    jest.spyOn(planningServices.planningCatalogService, 'getGlobal').mockResolvedValue({ sites: [] })
    jest.spyOn(planningServices.planningConfigService, 'getByYear').mockResolvedValue({ classTypes: [] })
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
    jest.spyOn(planningServices.slotService, 'getCalendar').mockResolvedValue([])
    jest.spyOn(planningServices.workflowPlanningService, 'getYearState').mockResolvedValue({ state: 'planning' })
    jest.spyOn(planningServices.workflowPlanningService, 'getActiveSnapshot').mockResolvedValue(null)
    jest.spyOn(tpiController, 'getTpiModels').mockResolvedValue([])
    jest.spyOn(tpiDossierService, 'getByRef').mockResolvedValue({
      year: 2026,
      identifiers: {
        legacyRef: '001',
        workflowReference: 'TPI-2026-001'
      },
      legacy: {
        exists: true,
        data: {
          sujet: 'Sujet dossier',
          candidat: 'Alice Durand',
          experts: {
            1: 'Bob Expert',
            2: 'Carla Expert'
          },
          boss: 'Diane Boss',
          tags: []
        },
        stakeholderState: {
          isComplete: true,
          isResolved: true,
          missingRoles: [],
          unresolvedRoles: []
        }
      },
      planning: {
        exists: true,
        data: {
          _id: 'planning-1',
          reference: 'TPI-2026-001',
          status: 'draft',
          sujet: 'Sujet dossier',
          candidat: { firstName: 'Alice', lastName: 'Durand' },
          expert1: { firstName: 'Bob', lastName: 'Expert' },
          expert2: { firstName: 'Carla', lastName: 'Expert' },
          chefProjet: { firstName: 'Diane', lastName: 'Boss' }
        },
        voteSummary: {
          totalVotes: 0,
          pendingVotes: 0,
          acceptedVotes: 0,
          preferredVotes: 0,
          rejectedVotes: 0,
          respondedVotes: 0
        },
        workflowVoteSummary: {
          expert1Voted: false,
          expert2Voted: false,
          chefProjetVoted: false
        },
        votes: [],
        plannedSlot: null
      },
      consistency: {
        importedToPlanning: true,
        issues: []
      }
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('charge le dossier partagé dans la sidebar quand un TPI est sélectionné', async () => {
    render(
      <MemoryRouter>
        <PlanningDashboard year='2026' isAdmin />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: /^TPI/i }))
    fireEvent.click(await screen.findByRole('button', { name: /sélectionner un tpi/i }))

    await waitFor(() => {
      expect(tpiDossierService.getByRef).toHaveBeenCalledWith('2026', 'TPI-2026-001')
    })

    expect(await screen.findByText('Sujet dossier', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ouvrir la fiche/i })).toHaveAttribute('href', '/tpi/2026/TPI-2026-001')
  })

  test('applique automatiquement un focus transmis par la fiche TPI', async () => {
    render(
      <MemoryRouter initialEntries={['/planning/2026?tab=list&focus=TPI-2026-001']}>
        <PlanningDashboard year='2026' isAdmin />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(tpiDossierService.getByRef).toHaveBeenCalledWith('2026', 'TPI-2026-001')
    })

    expect(await screen.findByDisplayValue('TPI-2026-001')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /tpi-2026-001/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ouvrir la fiche/i })).toHaveAttribute('href', '/tpi/2026/TPI-2026-001')
    expect(screen.getByText(/focus actif: TPI-2026-001/i)).toBeInTheDocument()
  })

  test('signale explicitement un focus sans résultat visible', async () => {
    render(
      <MemoryRouter initialEntries={['/planning/2026?tab=list&focus=TPI-2026-999']}>
        <PlanningDashboard year='2026' isAdmin />
      </MemoryRouter>
    )

    expect(await screen.findByDisplayValue('TPI-2026-999')).toBeInTheDocument()
    expect(screen.getByText(/aucun tpi visible ne correspond/i)).toBeInTheDocument()
    expect(tpiDossierService.getByRef).not.toHaveBeenCalled()
  })
})
