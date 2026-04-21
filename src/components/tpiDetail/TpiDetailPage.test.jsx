import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import TpiDetailPage from './TpiDetailPage.jsx'
import { tpiDossierService } from '../../services/tpiDossierService'
import { createTpiModel, updateTpiModel } from '../tpiControllers/TpiController.jsx'

jest.mock('../../services/tpiDossierService', () => ({
  tpiDossierService: {
    getByRef: jest.fn()
  }
}))

jest.mock('../tpiControllers/TpiController.jsx', () => ({
  createTpiModel: jest.fn(),
  updateTpiModel: jest.fn()
}))

describe('TpiDetailPage', () => {
  beforeEach(() => {
    tpiDossierService.getByRef.mockReset()
    createTpiModel.mockReset()
    updateTpiModel.mockReset()
  })

  it('charge et affiche le dossier agrégé d un TPI', async () => {
    tpiDossierService.getByRef.mockResolvedValue({
      year: 2026,
      identifiers: {
        legacyRef: '2163',
        workflowReference: 'TPI-2026-2163'
      },
      legacy: {
        exists: true,
        data: {
          candidat: 'Alice Martin',
          sujet: 'Sujet legacy',
          classe: 'CID4A',
          lienDepot: 'https://git.example.com/tpi-2163',
          lieu: {
            site: 'ETML',
            entreprise: 'Entreprise'
          },
          boss: 'Diane Boss',
          experts: {
            1: 'Bob Expert',
            2: 'Carla Expert'
          },
          tags: ['web', 'api']
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
          status: 'published',
          candidat: { firstName: 'Alice', lastName: 'Martin' },
          expert1: { firstName: 'Bob', lastName: 'Expert' },
          expert2: { firstName: 'Carla', lastName: 'Expert' },
          chefProjet: { firstName: 'Diane', lastName: 'Boss' }
        },
        votes: [],
        voteSummary: {
          totalVotes: 3,
          pendingVotes: 1,
          acceptedVotes: 1,
          preferredVotes: 1,
          rejectedVotes: 0,
          respondedVotes: 2
        },
        workflowVoteSummary: {
          expert1Voted: true,
          expert2Voted: false,
          chefProjetVoted: true
        },
        plannedSlot: {
          date: '2026-06-10',
          startTime: '08:00',
          room: { name: 'A101' }
        }
      },
      consistency: {
        importedToPlanning: true,
        issues: []
      }
    })

    render(
      <MemoryRouter initialEntries={['/tpi/2026/2163']}>
        <Routes>
          <Route path='/tpi/:year/:ref' element={<TpiDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(tpiDossierService.getByRef).toHaveBeenCalledWith('2026', '2163')
    })

    expect(await screen.findByText(/dossier tpi-2026-2163/i)).toBeInTheDocument()
    expect(screen.getByText(/santé du dossier/i)).toBeInTheDocument()
    expect(screen.getByText(/lecture croisée gestiontpi \/ planning/i)).toBeInTheDocument()
    expect(screen.getByText(/dossier prêt/i)).toBeInTheDocument()
    expect(screen.getAllByText('Alice Martin').length).toBeGreaterThan(0)
    expect(screen.getByText('Sujet legacy', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText('Entreprise', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getAllByText(/A101/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /voir dans planning/i })).toHaveAttribute(
      'href',
      '/planning/2026?tab=list&focus=TPI-2026-2163'
    )
    expect(screen.getByRole('link', { name: /voir dans gestion tpi/i })).toHaveAttribute(
      'href',
      '/gestionTPI?year=2026&focus=2163'
    )
    expect(screen.getByRole('link', { name: /modifier dans gestion tpi/i })).toHaveAttribute(
      'href',
      '/gestionTPI?year=2026&focus=2163&edit=1'
    )
    expect(screen.getByRole('link', { name: /voir dans soutenances/i })).toHaveAttribute(
      'href',
      '/Soutenances/2026?focus=TPI-2026-2163'
    )
    expect(screen.getByRole('link', { name: /ouvrir le dépôt/i })).toHaveAttribute(
      'href',
      'https://git.example.com/tpi-2163'
    )
  })

  it('propose une création préremplie dans GestionTPI quand seule la fiche Planning existe', async () => {
    tpiDossierService.getByRef.mockResolvedValue({
      year: 2026,
      identifiers: {
        legacyRef: '999',
        workflowReference: 'TPI-2026-999'
      },
      legacy: {
        exists: false,
        data: null,
        stakeholderState: null
      },
      planning: {
        exists: true,
        data: {
          reference: 'TPI-2026-999',
          status: 'draft',
          sujet: 'Sujet planning only',
          candidat: { _id: 'candidate-1', firstName: 'Alice', lastName: 'Martin' },
          expert1: { _id: 'expert-1', firstName: 'Bob', lastName: 'Expert' },
          expert2: { _id: 'expert-2', firstName: 'Carla', lastName: 'Expert' },
          chefProjet: { _id: 'boss-1', firstName: 'Diane', lastName: 'Boss' },
          classe: 'CID4A',
          site: 'ETML',
          entreprise: { nom: 'Entreprise' }
        },
        votes: [],
        voteSummary: {
          totalVotes: 0,
          pendingVotes: 0,
          acceptedVotes: 0,
          preferredVotes: 0,
          rejectedVotes: 0,
          respondedVotes: 0
        },
        workflowVoteSummary: null,
        plannedSlot: null
      },
      consistency: {
        importedToPlanning: false,
        issues: [
          {
            type: 'planning_tpi_missing_legacy',
            message: 'Fiche présente dans Planning mais absente de GestionTPI.'
          }
        ]
      }
    })

    render(
      <MemoryRouter initialEntries={['/tpi/2026/TPI-2026-999']}>
        <Routes>
          <Route path='/tpi/:year/:ref' element={<TpiDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText(/correction et complétion/i)).toBeInTheDocument()
    expect(screen.getAllByText(/action prioritaire/i).length).toBeGreaterThan(0)

    const createLinks = screen.getAllByRole('link', { name: /créer dans gestion tpi/i })
    expect(createLinks[0]).toHaveAttribute('href', '/gestionTPI?year=2026&focus=999&new=1')
  })

  it('propose des liens ciblés vers Parties prenantes pour les rôles non résolus', async () => {
    tpiDossierService.getByRef.mockResolvedValue({
      year: 2026,
      identifiers: {
        legacyRef: '2164',
        workflowReference: 'TPI-2026-2164'
      },
      legacy: {
        exists: true,
        data: {
          candidat: 'Alice Martin',
          expert1PersonId: '',
          experts: {
            1: 'Bob Expert',
            2: 'Carla Expert'
          },
          boss: 'Diane Boss',
          sujet: 'Sujet incomplet'
        },
        stakeholderState: {
          isComplete: true,
          isResolved: false,
          missingRoles: [],
          unresolvedRoles: ['expert1']
        }
      },
      planning: {
        exists: false,
        data: null,
        votes: [],
        voteSummary: {
          totalVotes: 0,
          pendingVotes: 0,
          acceptedVotes: 0,
          preferredVotes: 0,
          rejectedVotes: 0,
          respondedVotes: 0
        },
        workflowVoteSummary: null,
        plannedSlot: null
      },
      consistency: {
        importedToPlanning: false,
        issues: []
      }
    })

    render(
      <MemoryRouter initialEntries={['/tpi/2026/2164']}>
        <Routes>
          <Route path='/tpi/:year/:ref' element={<TpiDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findAllByText(/lier au référentiel parties prenantes/i)).toHaveLength(3)
    expect(
      screen.getAllByRole('link', { name: /ouvrir expert 1/i }).some((link) =>
        link.getAttribute('href') ===
          '/partiesPrenantes?name=Bob+Expert&role=expert&tab=create&year=2026&returnTo=%2Ftpi%2F2026%2FTPI-2026-2164'
      )
    ).toBe(true)
    expect(
      screen.getAllByRole('link', { name: /ouvrir candidat/i }).some((link) =>
        link.getAttribute('href') ===
          '/partiesPrenantes?name=Alice+Martin&role=candidat&tab=create&year=2026&returnTo=%2Ftpi%2F2026%2FTPI-2026-2164'
      )
    ).toBe(true)
  })

  it('permet de créer directement une fiche legacy de base depuis la fiche détail', async () => {
    tpiDossierService.getByRef
      .mockResolvedValueOnce({
        year: 2026,
        identifiers: {
          legacyRef: '777',
          workflowReference: 'TPI-2026-777'
        },
        legacy: {
          exists: false,
          data: null,
          stakeholderState: null
        },
        planning: {
          exists: true,
          data: {
            status: 'draft',
            sujet: 'Sujet planning direct',
            candidat: { _id: 'candidate-1', firstName: 'Alice', lastName: 'Martin' },
            expert1: { _id: 'expert-1', firstName: 'Bob', lastName: 'Expert' },
            expert2: { _id: 'expert-2', firstName: 'Carla', lastName: 'Expert' },
            chefProjet: { _id: 'boss-1', firstName: 'Diane', lastName: 'Boss' },
            classe: 'CID4A',
            site: 'ETML',
            entreprise: { nom: 'Entreprise' }
          },
          votes: [],
          voteSummary: {
            totalVotes: 0,
            pendingVotes: 0,
            acceptedVotes: 0,
            preferredVotes: 0,
            rejectedVotes: 0,
            respondedVotes: 0
          },
          workflowVoteSummary: null,
          plannedSlot: null
        },
        consistency: {
          importedToPlanning: false,
          issues: []
        }
      })
      .mockResolvedValueOnce({
        year: 2026,
        identifiers: {
          legacyRef: '777',
          workflowReference: 'TPI-2026-777'
        },
        legacy: {
          exists: true,
          data: {
            _id: 'legacy-777',
            refTpi: '777',
            candidat: 'Alice Martin',
            experts: { 1: 'Bob Expert', 2: 'Carla Expert' },
            boss: 'Diane Boss',
            sujet: 'Sujet planning direct'
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
            status: 'draft',
            sujet: 'Sujet planning direct'
          },
          votes: [],
          voteSummary: {
            totalVotes: 0,
            pendingVotes: 0,
            acceptedVotes: 0,
            preferredVotes: 0,
            rejectedVotes: 0,
            respondedVotes: 0
          },
          workflowVoteSummary: null,
          plannedSlot: null
        },
        consistency: {
          importedToPlanning: true,
          issues: []
        }
      })
    createTpiModel.mockResolvedValue({ refTpi: '777' })

    render(
      <MemoryRouter initialEntries={['/tpi/2026/TPI-2026-777']}>
        <Routes>
          <Route path='/tpi/:year/:ref' element={<TpiDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: /créer la fiche de base ici/i }))

    await waitFor(() => {
      expect(createTpiModel).toHaveBeenCalledWith(
        expect.objectContaining({
          refTpi: '777',
          candidat: 'Alice Martin',
          boss: 'Diane Boss',
          sujet: 'Sujet planning direct'
        }),
        '2026',
        { validationMode: 'manual' }
      )
    })

    expect(await screen.findByText(/fiche gestiontpi créée depuis la vue détail/i)).toBeInTheDocument()
  })

  it('permet de corriger rapidement les champs legacy directement sur la fiche', async () => {
    tpiDossierService.getByRef
      .mockResolvedValueOnce({
        year: 2026,
        identifiers: {
          legacyRef: '2165',
          workflowReference: 'TPI-2026-2165',
          legacyId: 'legacy-2165'
        },
        legacy: {
          exists: true,
          data: {
            _id: 'legacy-2165',
            refTpi: '2165',
            candidat: 'Alice Martin',
            candidatPersonId: 'candidate-1',
            classe: '',
            lienDepot: '',
            lieu: {
              site: '',
              entreprise: ''
            },
            boss: 'Diane Boss',
            bossPersonId: 'boss-1',
            experts: {
              1: 'Bob Expert',
              2: 'Carla Expert'
            },
            expert1PersonId: 'expert-1',
            expert2PersonId: 'expert-2',
            sujet: 'Sujet à corriger'
          },
          stakeholderState: {
            isComplete: true,
            isResolved: true,
            missingRoles: [],
            unresolvedRoles: []
          }
        },
        planning: {
          exists: false,
          data: null,
          votes: [],
          voteSummary: {
            totalVotes: 0,
            pendingVotes: 0,
            acceptedVotes: 0,
            preferredVotes: 0,
            rejectedVotes: 0,
            respondedVotes: 0
          },
          workflowVoteSummary: null,
          plannedSlot: null
        },
        consistency: {
          importedToPlanning: false,
          issues: []
        }
      })
      .mockResolvedValueOnce({
        year: 2026,
        identifiers: {
          legacyRef: '2165',
          workflowReference: 'TPI-2026-2165',
          legacyId: 'legacy-2165'
        },
        legacy: {
          exists: true,
          data: {
            _id: 'legacy-2165',
            refTpi: '2165',
            candidat: 'Alice Martin',
            candidatPersonId: 'candidate-1',
            classe: 'CID4A',
            lienDepot: 'https://git.example.com/2165',
            lieu: {
              site: 'ETML',
              entreprise: 'Entreprise'
            },
            boss: 'Diane Boss',
            bossPersonId: 'boss-1',
            experts: {
              1: 'Bob Expert',
              2: 'Carla Expert'
            },
            expert1PersonId: 'expert-1',
            expert2PersonId: 'expert-2',
            sujet: 'Sujet à corriger'
          },
          stakeholderState: {
            isComplete: true,
            isResolved: true,
            missingRoles: [],
            unresolvedRoles: []
          }
        },
        planning: {
          exists: false,
          data: null,
          votes: [],
          voteSummary: {
            totalVotes: 0,
            pendingVotes: 0,
            acceptedVotes: 0,
            preferredVotes: 0,
            rejectedVotes: 0,
            respondedVotes: 0
          },
          workflowVoteSummary: null,
          plannedSlot: null
        },
        consistency: {
          importedToPlanning: false,
          issues: []
        }
      })
    updateTpiModel.mockResolvedValue({ _id: 'legacy-2165' })

    render(
      <MemoryRouter initialEntries={['/tpi/2026/2165']}>
        <Routes>
          <Route path='/tpi/:year/:ref' element={<TpiDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText(/édition rapide des champs legacy/i)).toBeInTheDocument()
    const quickEditForm = screen.getByTestId('tpi-detail-quick-edit-form')
    const quickEditFormQueries = within(quickEditForm)

    fireEvent.input(quickEditFormQueries.getByLabelText('Classe'), { target: { value: 'CID4A' } })
    fireEvent.input(quickEditFormQueries.getByLabelText('Entreprise'), { target: { value: 'Entreprise' } })
    fireEvent.input(quickEditFormQueries.getByLabelText('Site'), { target: { value: 'ETML' } })
    fireEvent.input(quickEditFormQueries.getByLabelText('Dépôt git'), { target: { value: 'https://git.example.com/2165' } })

    await waitFor(() => {
      expect(quickEditFormQueries.getByLabelText('Classe')).toHaveValue('CID4A')
      expect(quickEditFormQueries.getByLabelText('Entreprise')).toHaveValue('Entreprise')
      expect(quickEditFormQueries.getByLabelText('Site')).toHaveValue('ETML')
      expect(quickEditFormQueries.getByLabelText('Dépôt git')).toHaveValue('https://git.example.com/2165')
    })

    fireEvent.click(quickEditFormQueries.getByRole('button', { name: /enregistrer sur la fiche/i }))

    await waitFor(() => {
      expect(updateTpiModel).toHaveBeenCalledWith(
        'legacy-2165',
        '2026',
        expect.objectContaining({
          refTpi: '2165',
          classe: 'CID4A',
          lienDepot: 'https://git.example.com/2165',
          lieu: expect.objectContaining({
            entreprise: 'Entreprise',
            site: 'ETML'
          })
        })
      )
    })

    expect(await screen.findByText(/fiche gestiontpi mise à jour depuis la vue détail/i)).toBeInTheDocument()
  })

  it('propose de reprendre les valeurs planning dans l édition rapide', async () => {
    tpiDossierService.getByRef.mockResolvedValue({
      year: 2026,
      identifiers: {
        legacyRef: '2166',
        workflowReference: 'TPI-2026-2166',
        legacyId: 'legacy-2166'
      },
      legacy: {
        exists: true,
        data: {
          _id: 'legacy-2166',
          refTpi: '2166',
          candidat: 'Alice Martin',
          candidatPersonId: 'candidate-1',
          classe: '',
          lienDepot: '',
          lieu: {
            site: '',
            entreprise: ''
          },
          boss: 'Diane Boss',
          bossPersonId: 'boss-1',
          experts: {
            1: 'Bob Expert',
            2: 'Carla Expert'
          },
          expert1PersonId: 'expert-1',
          expert2PersonId: 'expert-2',
          sujet: 'Sujet legacy'
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
          status: 'draft',
          sujet: 'Sujet planning',
          classe: 'CID4A',
          site: 'ETML',
          entreprise: {
            nom: 'Entreprise'
          }
        },
        votes: [],
        voteSummary: {
          totalVotes: 0,
          pendingVotes: 0,
          acceptedVotes: 0,
          preferredVotes: 0,
          rejectedVotes: 0,
          respondedVotes: 0
        },
        workflowVoteSummary: null,
        plannedSlot: null
      },
      consistency: {
        importedToPlanning: true,
        issues: []
      }
    })

    render(
      <MemoryRouter initialEntries={['/tpi/2026/2166']}>
        <Routes>
          <Route path='/tpi/:year/:ref' element={<TpiDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    const quickEditForm = await screen.findByTestId('tpi-detail-quick-edit-form')
    const quickEditFormQueries = within(quickEditForm)

    fireEvent.click(screen.getByRole('button', { name: /reprendre toutes les valeurs planning/i }))

    await waitFor(() => {
      expect(quickEditFormQueries.getByLabelText('Classe')).toHaveValue('CID4A')
      expect(quickEditFormQueries.getByLabelText('Entreprise')).toHaveValue('Entreprise')
      expect(quickEditFormQueries.getByLabelText('Site')).toHaveValue('ETML')
      expect(quickEditFormQueries.getByLabelText('Sujet')).toHaveValue('Sujet planning')
    })
  })
})
