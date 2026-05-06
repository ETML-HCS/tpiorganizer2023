import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import TokenGenerator, { buildAccessPhaseReadiness } from './genToken'
import { STORAGE_KEYS } from '../../config/appConfig'
import {
  coordinationConfigService,
  workflowCoordinationService
} from '../../services/coordinationService'

jest.mock('../../services/coordinationService', () => ({
  coordinationConfigService: {
    getByYear: jest.fn()
  },
  workflowCoordinationService: {
    getStaticPublicationStatus: jest.fn(),
    getStaticVotePublicationStatus: jest.fn(),
    previewAccessLinks: jest.fn(),
    generateAccessLinks: jest.fn(),
    previewSoutenanceAccessEmail: jest.fn(),
    sendSoutenanceAccessEmails: jest.fn(),
    generateStaticVotePublication: jest.fn(),
    publishStaticVotePublication: jest.fn()
  }
}))

const emptyAccessPreview = {
  success: true,
  workflowState: 'planning',
  workflowPhases: {},
  activePhases: [],
  linksGenerated: false,
  hasGeneratedLinks: false,
  summary: {
    peopleCount: 0,
    voteLinkCount: 0,
    voteGeneratedLinkCount: 0,
    soutenanceLinkCount: 0,
    soutenanceGeneratedLinkCount: 0,
    arbitrageLinkCount: 0,
    arbitrageGeneratedLinkCount: 0,
    generatedLinkCount: 0,
    unavailableGeneratedLinkCount: 0
  },
  contexts: {
    vote: {
      tpiCount: 0,
      workflowFreeModeEnabled: false
    },
    soutenance: {
      publicationVersion: null,
      availableVersions: []
    },
    arbitrage: {}
  },
  people: []
}

function createAccessPreview(overrides = {}) {
  return {
    ...emptyAccessPreview,
    ...overrides,
    summary: {
      ...emptyAccessPreview.summary,
      ...(overrides.summary || {})
    },
    contexts: {
      ...emptyAccessPreview.contexts,
      ...(overrides.contexts || {}),
      vote: {
        ...emptyAccessPreview.contexts.vote,
        ...(overrides.contexts?.vote || {})
      },
      soutenance: {
        ...emptyAccessPreview.contexts.soutenance,
        ...(overrides.contexts?.soutenance || {})
      },
      arbitrage: {
        ...emptyAccessPreview.contexts.arbitrage,
        ...(overrides.contexts?.arbitrage || {})
      }
    },
    people: overrides.people || emptyAccessPreview.people
  }
}

beforeEach(() => {
  window.localStorage.clear()
  coordinationConfigService.getByYear.mockResolvedValue({ accessLinkSettings: {} })
  workflowCoordinationService.getStaticPublicationStatus.mockResolvedValue({})
  workflowCoordinationService.getStaticVotePublicationStatus.mockResolvedValue({})
  workflowCoordinationService.previewAccessLinks.mockResolvedValue(createAccessPreview())
  workflowCoordinationService.generateAccessLinks.mockResolvedValue(createAccessPreview({
    linksGenerated: true
  }))
  workflowCoordinationService.previewSoutenanceAccessEmail.mockResolvedValue({
    success: true,
    subject: '[TPI Organizer] Horaire des défenses TPI 2026',
    html: '<html><body><a>Ouvrir ma vue personnelle</a></body></html>',
    text: 'Ouvrir ma vue personnelle'
  })
  workflowCoordinationService.sendSoutenanceAccessEmails.mockImplementation(async (year, targets = [], options = {}) => ({
    success: true,
    testMode: Boolean(options.testEmail),
    summary: {
      requestedCount: targets.length,
      sentCount: targets.length,
      skippedCount: 0,
      failedCount: 0
    },
    results: targets.map((target) => ({
      ...target,
      deliveryStatus: 'sent',
      sentAt: '2026-05-06T12:00:00.000Z',
      messageId: 'test-message'
    }))
  }))
  workflowCoordinationService.generateStaticVotePublication.mockResolvedValue({
    publicUrl: 'https://votes.example.ch/votes-2026/'
  })
  workflowCoordinationService.publishStaticVotePublication.mockResolvedValue({
    publicUrl: 'https://votes.example.ch/votes-2026/',
    publishedAt: '2026-05-05T10:00:00.000Z'
  })
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('GenToken phase readiness', () => {
  test('résume la préparation self-service par phase', () => {
    const phases = buildAccessPhaseReadiness(
      {
        voteLinkCount: 4,
        voteGeneratedLinkCount: 2,
        soutenanceLinkCount: 3,
        soutenanceGeneratedLinkCount: 3,
        arbitrageLinkCount: 0,
        arbitrageGeneratedLinkCount: 0
      },
      {
        vote: { workflowFreeModeEnabled: true },
        soutenance: { publicationVersion: 2 }
      }
    )

    expect(phases).toEqual([
      expect.objectContaining({
        id: 'planning',
        status: 'Aucun token requis'
      }),
      expect.objectContaining({
        id: 'vote',
        metric: '2/4',
        status: 'Partiel'
      }),
      expect.objectContaining({
        id: 'arbitrage',
        metric: '0',
        status: 'Aucune proposition'
      }),
      expect.objectContaining({
        id: 'soutenance',
        metric: '3/3',
        status: 'Prêt',
        detail: 'Publication v2.'
      })
    ])
  })
})

describe('GenToken generation command', () => {
  test('génère tous les accès sans appliquer la recherche ni le filtre de phase', async () => {
    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026&phase=vote']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    const searchInput = await screen.findByRole('searchbox', { name: /recherche/i })
    fireEvent.change(searchInput, { target: { value: 'alice' } })

    const generateButton = await screen.findByRole('button', { name: /générer tous les accès/i })
    await waitFor(() => expect(generateButton).toBeEnabled())

    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(workflowCoordinationService.generateAccessLinks).toHaveBeenCalledTimes(1)
    })

    expect(workflowCoordinationService.generateAccessLinks).toHaveBeenCalledWith(
      2026,
      window.location.origin,
      {}
    )

    await waitFor(() => {
      expect(searchInput).toHaveValue('')
    })

    const filterGroup = screen.getByRole('group', { name: /filtrer par type de lien/i })
    expect(within(filterGroup).getByRole('button', { name: /votes/i })).toHaveAttribute('aria-pressed', 'true')
    expect(within(filterGroup).getByRole('button', { name: /défenses/i })).toHaveAttribute('aria-pressed', 'true')
    expect(within(filterGroup).getByRole('button', { name: /arbitrage/i })).toHaveAttribute('aria-pressed', 'true')
  })

  test("utilise l'année stockée quand l'URL ne fournit pas d'année", async () => {
    window.localStorage.setItem(STORAGE_KEYS.COORDINATION_SELECTED_YEAR, '2026')

    render(
      <MemoryRouter initialEntries={['/acces-liens']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    expect(await screen.findByRole('button', { name: /générer tous les accès/i })).toBeInTheDocument()
    expect(screen.queryByText(/Année 2026/i)).not.toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /générer tous les accès/i }))

    await waitFor(() => {
      expect(workflowCoordinationService.generateAccessLinks).toHaveBeenCalledWith(
        2026,
        window.location.origin,
        {}
      )
    })
  })

  test('transmet les cibles publication et mini-site statique à la génération globale', async () => {
    coordinationConfigService.getByYear.mockResolvedValue({
      accessLinkSettings: {
        defaultSoutenanceLinkTarget: 'publication',
        defaultVoteLinkTarget: 'static'
      }
    })
    workflowCoordinationService.getStaticPublicationStatus.mockResolvedValue({
      publicUrl: 'https://publication.example.ch/defenses'
    })
    workflowCoordinationService.getStaticVotePublicationStatus.mockResolvedValue({
      publicUrl: 'https://votes.example.ch/votes-2026/'
    })
    workflowCoordinationService.generateAccessLinks.mockResolvedValue(createAccessPreview({
      linksGenerated: true,
      publicationRefresh: {
        votePublication: {
          publicUrl: 'https://votes.example.ch/votes-2026/'
        },
        soutenancePublication: {
          publicUrl: 'https://publication.example.ch/defenses/'
        }
      }
    }))

    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: /générer tous les accès/i }))

    await waitFor(() => {
      expect(workflowCoordinationService.generateAccessLinks).toHaveBeenCalledTimes(1)
    })

    expect(workflowCoordinationService.generateAccessLinks).toHaveBeenCalledWith(
      2026,
      window.location.origin,
      {
        soutenanceLinkTarget: 'publication',
        soutenancePublicUrl: 'https://publication.example.ch/defenses',
        voteLinkTarget: 'static',
        votePublicUrl: 'https://votes.example.ch/votes-2026/'
      }
    )
    expect(workflowCoordinationService.generateStaticVotePublication).not.toHaveBeenCalled()
    expect(workflowCoordinationService.publishStaticVotePublication).not.toHaveBeenCalled()
  })

  test('permet de revenir aux URLs locales depuis le mode site', async () => {
    workflowCoordinationService.getStaticPublicationStatus.mockResolvedValue({
      publicUrl: 'https://publication.example.ch/defenses'
    })
    workflowCoordinationService.getStaticVotePublicationStatus.mockResolvedValue({
      publicUrl: 'https://votes.example.ch/votes-2026/'
    })

    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    const localToggle = await screen.findByRole('checkbox', { name: /local/i })
    await waitFor(() => expect(localToggle).not.toBeChecked())

    fireEvent.click(localToggle)
    fireEvent.click(await screen.findByRole('button', { name: /générer tous les accès/i }))

    await waitFor(() => {
      expect(workflowCoordinationService.generateAccessLinks).toHaveBeenCalledWith(
        2026,
        window.location.origin,
        {}
      )
    })
  })

  test('force aussi les défenses sur le site quand seule l URL vote est connue côté front', async () => {
    workflowCoordinationService.getStaticPublicationStatus.mockResolvedValue({})
    workflowCoordinationService.getStaticVotePublicationStatus.mockResolvedValue({
      publicUrl: 'https://tpi26.ch/votes-2026/'
    })

    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: /générer tous les accès/i }))

    await waitFor(() => {
      expect(workflowCoordinationService.generateAccessLinks).toHaveBeenCalledWith(
        2026,
        window.location.origin,
        {
          soutenanceLinkTarget: 'publication',
          voteLinkTarget: 'static',
          votePublicUrl: 'https://tpi26.ch/votes-2026/'
        }
      )
    })
  })

  test('affiche la régénération quand des accès existent déjà', async () => {
    workflowCoordinationService.previewAccessLinks.mockResolvedValue(createAccessPreview({
      hasGeneratedLinks: true,
      summary: {
        generatedLinkCount: 2,
        voteLinkCount: 2,
        voteGeneratedLinkCount: 2
      }
    }))

    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    const regenerateButton = await screen.findByRole('button', { name: /regénérer tous les accès/i })
    expect(regenerateButton).toHaveAttribute(
      'title',
      "Remplacer tous les accès générables."
    )
  })

  test('combine les filtres de liens en OR sans libellé phase', async () => {
    workflowCoordinationService.previewAccessLinks.mockResolvedValue(createAccessPreview({
      summary: {
        peopleCount: 3,
        voteLinkCount: 1,
        soutenanceLinkCount: 1,
        arbitrageLinkCount: 1
      },
      people: [
        {
          person: {
            id: 'person-vote',
            name: 'Alice Vote',
            email: 'alice.vote@example.ch',
            roles: ['expert'],
            site: ''
          },
          voteLinks: [{ reference: 'TPI-2026-1' }],
          soutenanceLinks: [],
          arbitrageLinks: []
        },
        {
          person: {
            id: 'person-defense',
            name: 'Bruno Défense',
            email: 'bruno.defense@example.ch',
            roles: ['candidat'],
            site: ''
          },
          voteLinks: [],
          soutenanceLinks: [{ publicationVersion: 1 }],
          arbitrageLinks: []
        },
        {
          person: {
            id: 'person-arbitrage',
            name: 'Carla Arbitrage',
            email: 'carla.arbitrage@example.ch',
            roles: ['chef_projet'],
            site: ''
          },
          voteLinks: [],
          soutenanceLinks: [],
          arbitrageLinks: [{ proposalId: 'proposal-1' }]
        }
      ]
    }))

    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    const filterGroup = await screen.findByRole('group', { name: /filtrer par type de lien/i })
    const voteButton = within(filterGroup).getByRole('button', { name: /votes/i })
    const defenseButton = within(filterGroup).getByRole('button', { name: /défenses/i })
    const arbitrageButton = within(filterGroup).getByRole('button', { name: /arbitrage/i })

    expect(filterGroup).toBeInTheDocument()
    expect(screen.queryByText('Phase')).not.toBeInTheDocument()
    expect(screen.queryByText('Toutes les phases')).not.toBeInTheDocument()
    expect(screen.getByText('Alice Vote')).toBeInTheDocument()
    expect(screen.getByText('Bruno Défense')).toBeInTheDocument()
    expect(screen.getByText('Carla Arbitrage')).toBeInTheDocument()

    fireEvent.click(defenseButton)

    expect(voteButton).toHaveAttribute('aria-pressed', 'true')
    expect(defenseButton).toHaveAttribute('aria-pressed', 'false')
    expect(arbitrageButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Alice Vote')).toBeInTheDocument()
    expect(screen.queryByText('Bruno Défense')).not.toBeInTheDocument()
    expect(screen.getByText('Carla Arbitrage')).toBeInTheDocument()
  })

  test('affiche synthèse et phases dans un panneau direct et compact', async () => {
    workflowCoordinationService.previewAccessLinks.mockResolvedValue(createAccessPreview({
      summary: {
        peopleCount: 1,
        voteLinkCount: 2,
        voteGeneratedLinkCount: 1,
        generatedLinkCount: 1
      },
      people: [
        {
          person: {
            id: 'person-1',
            name: 'Alain Garraux',
            email: 'alain.garraux@eduvaud.ch',
            roles: ['expert'],
            site: ''
          },
          voteLinks: [],
          soutenanceLinks: [],
          arbitrageLinks: []
        }
      ]
    }))

    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    const panel = await screen.findByLabelText('Synthèse des accès')

    expect(panel.parentElement).toHaveClass('has-collapsed-summary')
    expect(screen.getByRole('button', { name: /ouvrir la synthèse des accès/i })).toHaveClass('token-access-summary-floating')
    expect(within(panel).queryByText('Personnes')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /ouvrir la synthèse des accès/i }))

    expect(within(panel).getByRole('heading', { name: /synthèse/i })).toBeInTheDocument()
    expect(within(panel).getByText('1/1 personne(s)')).toBeInTheDocument()
    expect(within(panel).getByText('Personnes')).toBeInTheDocument()
    expect(within(panel).getByText('Disponibles')).toBeInTheDocument()
    expect(within(panel).getByRole('heading', { name: /phases/i })).toBeInTheDocument()
    expect(within(panel).getByText('Aucun token requis')).toBeInTheDocument()
    expect(within(panel).getByText('1/2')).toBeInTheDocument()
    expect(within(panel).getByText('Partiel')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ouvrir synthèse et phases/i })).not.toBeInTheDocument()

    fireEvent.click(within(panel).getByRole('button', { name: /réduire la synthèse des accès/i }))

    expect(panel.parentElement).toHaveClass('has-collapsed-summary')
    expect(screen.getByRole('button', { name: /ouvrir la synthèse des accès/i })).toHaveClass('token-access-summary-floating')
    expect(within(panel).queryByText('Personnes')).not.toBeInTheDocument()
  })

  test('affiche un lien de vote groupé pour tous les TPI du même votant', async () => {
    workflowCoordinationService.previewAccessLinks.mockResolvedValue(createAccessPreview({
      summary: {
        peopleCount: 1,
        voteLinkCount: 1,
        voteGeneratedLinkCount: 1,
        generatedLinkCount: 1
      },
      people: [
        {
          person: {
            id: 'person-1',
            name: 'Alain Garraux',
            email: 'alain.garraux@eduvaud.ch',
            roles: ['expert', 'chef_projet'],
            site: ''
          },
          voteLinks: [
            {
              type: 'vote',
              reference: 'TPI-2026-39, TPI-2026-43, TPI-2026-50',
              roleLabel: 'Partie prenante',
              candidateName: '',
              subject: '3 TPI à traiter',
              url: 'https://tpi26.ch/votes-2026/?ml=token-grouped',
              redirectPath: '/votes-2026/',
              generated: true,
              availabilityStatus: 'available',
              tpis: [
                {
                  reference: 'TPI-2026-39',
                  candidateName: 'Bartou Rayan',
                  roleLabel: 'Chef de projet',
                  subject: 'Site web de gestion de festival de musique'
                },
                {
                  reference: 'TPI-2026-43',
                  candidateName: 'Grisales Betancur Jessica',
                  roleLabel: 'Chef de projet',
                  subject: 'Site web de gestion de vélos perdu'
                },
                {
                  reference: 'TPI-2026-50',
                  candidateName: 'Rodrigues Lopes Diogo Filipe',
                  roleLabel: 'Chef de projet',
                  subject: 'Site web de gestion de travaux dans une maison'
                }
              ]
            }
          ],
          soutenanceLinks: [],
          arbitrageLinks: []
        }
      ]
    }))

    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    const toggle = await screen.findByRole('button', { name: /ouvrir le bloc de Alain Garraux/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('https://tpi26.ch/votes-2026/?ml=token-grouped')).not.toBeInTheDocument()

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByText('Vote groupé')).toBeInTheDocument()
    expect(screen.getAllByText('3 TPI à voter')).toHaveLength(1)
    expect(screen.queryByText(/3 TPI à traiter/i)).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /ouvrir le lien Vote groupé/i })).toHaveLength(1)
    expect(screen.getByText('https://tpi26.ch/votes-2026/?ml=token-grouped')).toBeInTheDocument()
    expect(screen.getAllByText('TPI-2026-39')).toHaveLength(1)
    expect(screen.getAllByText('TPI-2026-43')).toHaveLength(1)
    expect(screen.getAllByText('TPI-2026-50')).toHaveLength(1)
    expect(screen.queryByRole('link', { name: /ouvrir le lien TPI-2026-/i })).not.toBeInTheDocument()
  })

  test('masque le bloc arbitrage vide pour une personne non experte', async () => {
    workflowCoordinationService.previewAccessLinks.mockResolvedValue(createAccessPreview({
      summary: {
        peopleCount: 1,
        voteLinkCount: 1,
        voteGeneratedLinkCount: 1,
        generatedLinkCount: 1
      },
      people: [
        {
          person: {
            id: 'person-project-lead',
            name: 'Camille Projet',
            email: 'camille.projet@example.ch',
            roles: ['chef_projet'],
            site: ''
          },
          voteLinks: [
            {
              reference: 'TPI-2026-22',
              url: 'https://tpi26.ch/votes-2026/?ml=token-project-lead',
              generated: true,
              availabilityStatus: 'available'
            }
          ],
          soutenanceLinks: [],
          arbitrageLinks: []
        }
      ]
    }))

    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: /ouvrir le bloc de Camille Projet/i }))

    expect(screen.getByRole('heading', { name: /liens de vote/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /liens d.arbitrage/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/aucun lien d.arbitrage/i)).not.toBeInTheDocument()
  })

  test('masque les blocs des candidats quand l option est décochée', async () => {
    workflowCoordinationService.previewAccessLinks.mockResolvedValue(createAccessPreview({
      summary: {
        peopleCount: 2,
        voteLinkCount: 1,
        voteGeneratedLinkCount: 1,
        soutenanceLinkCount: 1,
        soutenanceGeneratedLinkCount: 1,
        generatedLinkCount: 2
      },
      people: [
        {
          person: {
            id: 'person-1',
            name: 'Alain Garraux',
            email: 'alain.garraux@eduvaud.ch',
            roles: ['expert'],
            site: ''
          },
          voteLinks: [
            {
              type: 'vote',
              reference: 'TPI-2026-39',
              roleLabel: 'Partie prenante',
              url: 'https://tpi26.ch/coordination/2026?ml=token-vote',
              redirectPath: '/coordination/2026',
              generated: true,
              availabilityStatus: 'available',
              tpis: [
                {
                  reference: 'TPI-2026-39',
                  candidateName: 'Bartou Rayan',
                  roleLabel: 'Expert',
                  subject: 'Site web de gestion'
                }
              ]
            }
          ],
          soutenanceLinks: [],
          arbitrageLinks: []
        },
        {
          person: {
            id: 'candidate-1',
            name: 'Al Hussein Mussa',
            email: 'al.hussein.mussa@example.ch',
            roles: ['candidat'],
            site: ''
          },
          voteLinks: [],
          soutenanceLinks: [
            {
              publicationVersion: 1,
              url: 'https://tpi26.ch/defenses/2026?ml=token-candidate',
              redirectPath: '/defenses/2026',
              generated: true,
              availabilityStatus: 'available'
            }
          ],
          arbitrageLinks: []
        }
      ]
    }))

    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    expect(await screen.findByText('Alain Garraux')).toBeInTheDocument()
    expect(screen.getByText('Al Hussein Mussa')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /ouvrir le bloc de Alain Garraux/i }))

    fireEvent.click(screen.getByRole('checkbox', { name: /candidats/i }))

    expect(screen.getByText('Alain Garraux')).toBeInTheDocument()
    expect(screen.queryByText('Al Hussein Mussa')).not.toBeInTheDocument()
    expect(screen.getAllByText('TPI-2026-39')).not.toHaveLength(0)
    expect(screen.getAllByText(/Candidat: Bartou Rayan/i)).not.toHaveLength(0)
    expect(window.localStorage.getItem(STORAGE_KEYS.ACCESS_LINK_SHOW_CANDIDATES)).toBe('false')
  })

  test('restaure la préférence de masquage des candidats', async () => {
    window.localStorage.setItem(STORAGE_KEYS.ACCESS_LINK_SHOW_CANDIDATES, 'false')
    workflowCoordinationService.previewAccessLinks.mockResolvedValue(createAccessPreview({
      summary: {
        peopleCount: 2,
        voteLinkCount: 1,
        voteGeneratedLinkCount: 1,
        soutenanceLinkCount: 1,
        soutenanceGeneratedLinkCount: 1,
        generatedLinkCount: 1
      },
      people: [
        {
          person: {
            id: 'person-1',
            name: 'Alain Garraux',
            email: 'alain.garraux@eduvaud.ch',
            roles: ['expert'],
            site: ''
          },
          voteLinks: [
            {
              type: 'vote',
              reference: 'TPI-2026-39',
              roleLabel: 'Partie prenante',
              url: 'https://tpi26.ch/coordination/2026?ml=token-vote',
              redirectPath: '/coordination/2026',
              generated: true,
              availabilityStatus: 'available',
              tpis: [
                {
                  reference: 'TPI-2026-39',
                  candidateName: 'Bartou Rayan',
                  roleLabel: 'Expert',
                  subject: 'Site web de gestion'
                }
              ]
            }
          ],
          soutenanceLinks: [],
          arbitrageLinks: []
        },
        {
          person: {
            id: 'candidate-1',
            name: 'Al Hussein Mussa',
            email: 'al.hussein.mussa@example.ch',
            roles: ['candidat'],
            site: ''
          },
          voteLinks: [],
          soutenanceLinks: [
            {
              publicationVersion: 1,
              url: 'https://tpi26.ch/defenses/2026?ml=token-candidate',
              redirectPath: '/defenses/2026',
              generated: true,
              availabilityStatus: 'available'
            }
          ],
          arbitrageLinks: []
        }
      ]
    }))

    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    expect(await screen.findByRole('checkbox', { name: /candidats/i })).not.toBeChecked()
    expect(screen.getByText('Alain Garraux')).toBeInTheDocument()
    expect(screen.queryByText('Al Hussein Mussa')).not.toBeInTheDocument()
  })

  test('prépare un email Outlook depuis un lien sans le compter comme envoi système', async () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => ({}))
    workflowCoordinationService.previewAccessLinks.mockResolvedValue(createAccessPreview({
      summary: {
        peopleCount: 1,
        voteLinkCount: 1,
        voteGeneratedLinkCount: 1,
        generatedLinkCount: 1
      },
      people: [
        {
          person: {
            id: 'person-1',
            name: 'Alain Garraux',
            email: 'alain.garraux@eduvaud.ch',
            roles: ['expert'],
            site: ''
          },
          voteLinks: [
            {
              type: 'vote',
              reference: 'TPI-2026-39',
              url: 'https://tpi26.ch/coordination/2026?ml=token-vote',
              generated: true,
              availabilityStatus: 'available',
              tpis: [
                {
                  reference: 'TPI-2026-39',
                  candidateName: 'Bartou Rayan',
                  roleLabel: 'Expert',
                  subject: 'Site web de gestion'
                }
              ]
            }
          ],
          soutenanceLinks: [],
          arbitrageLinks: []
        }
      ]
    }))

    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: /ouvrir la synthèse des accès/i }))

    expect(await screen.findByText('0/1 transmis')).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /ouvrir le bloc de Alain Garraux/i }))
    fireEvent.click(await screen.findByRole('button', { name: /préparer outlook pour TPI-2026-39/i }))

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^mailto:alain\.garraux%40eduvaud\.ch\?/),
      '_blank',
      'noopener,noreferrer'
    )
    expect(openSpy.mock.calls[0][0]).toContain('token-vote')

    await waitFor(() => {
      expect(screen.getByText('1/1 préparés')).toBeInTheDocument()
    })
    expect(screen.getByText('Outlook préparé')).toBeInTheDocument()

    const deliveryStore = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.ACCESS_LINK_EMAIL_DELIVERIES))
    const [delivery] = Object.values(deliveryStore['2026'])
    expect(delivery).toEqual(expect.objectContaining({
      status: 'prepared',
      source: 'outlook',
      linkUrl: expect.stringContaining('token-vote')
    }))

    openSpy.mockRestore()
  })

  test('affiche un reset Outlook préparé près du bouton synthèse réduit', async () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => ({}))
    workflowCoordinationService.previewAccessLinks.mockResolvedValue(createAccessPreview({
      summary: {
        peopleCount: 1,
        voteLinkCount: 1,
        voteGeneratedLinkCount: 1,
        generatedLinkCount: 1
      },
      people: [
        {
          person: {
            id: 'person-1',
            name: 'Alain Garraux',
            email: 'alain.garraux@eduvaud.ch',
            roles: ['expert'],
            site: ''
          },
          voteLinks: [
            {
              type: 'vote',
              reference: 'TPI-2026-39',
              url: 'https://tpi26.ch/coordination/2026?ml=token-vote',
              generated: true,
              availabilityStatus: 'available'
            }
          ],
          soutenanceLinks: [],
          arbitrageLinks: []
        }
      ]
    }))

    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    await screen.findByLabelText('Synthèse des accès')
    fireEvent.click(await screen.findByRole('button', { name: /ouvrir le bloc de Alain Garraux/i }))
    fireEvent.click(await screen.findByRole('button', { name: /préparer outlook pour TPI-2026-39/i }))

    const resetButton = await screen.findByRole('button', { name: /réinitialiser 1 outlook préparé/i })
    expect(resetButton).toBeInTheDocument()

    fireEvent.click(resetButton)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /réinitialiser 1 outlook préparé/i })).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /ouvrir la synthèse des accès/i }))

    expect(await screen.findByText('0/1 transmis')).toBeInTheDocument()

    openSpy.mockRestore()
  })

  test('prépare un seul email de défense avec la consigne de demande exceptionnelle', async () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => ({}))
    workflowCoordinationService.previewAccessLinks.mockResolvedValue(createAccessPreview({
      summary: {
        peopleCount: 1,
        voteLinkCount: 1,
        voteGeneratedLinkCount: 1,
        soutenanceLinkCount: 1,
        soutenanceGeneratedLinkCount: 1,
        generatedLinkCount: 2
      },
      people: [
        {
          person: {
            id: 'person-1',
            name: 'Alain Garraux',
            email: 'alain.garraux@eduvaud.ch',
            roles: ['expert'],
            site: ''
          },
          voteLinks: [
            {
              type: 'vote',
              reference: 'TPI-2026-39',
              url: 'https://tpi26.ch/votes-2026/?ml=token-vote',
              generated: true,
              availabilityStatus: 'available'
            }
          ],
          soutenanceLinks: [
            {
              type: 'soutenance',
              publicationVersion: 2,
              url: 'https://tpi26.ch/soutenances-2026/?ml=token-defense',
              generated: true,
              availabilityStatus: 'available'
            }
          ],
          arbitrageLinks: []
        }
      ]
    }))

    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: /ouvrir la synthèse des accès/i }))

    expect(await screen.findByText('0/1 transmis')).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /ouvrir le bloc de Alain Garraux/i }))
    fireEvent.click(await screen.findByRole('button', { name: /préparer outlook pour Publication 2/i }))

    await waitFor(() => {
      expect(screen.getByText('1/1 préparés')).toBeInTheDocument()
    })

    const mailto = openSpy.mock.calls[0][0]
    const query = new URLSearchParams(mailto.split('?')[1])
    const body = query.get('body')

    expect(query.get('subject')).toContain('Horaire des défenses TPI 2026')
    expect(body).toContain('**Lien personnel**')
    expect(body).toContain('**Important**')
    expect(body).toContain('**Retour attendu**')
    expect(body).toContain('Merci de faire votre retour dans les 5 jours maximum')
    expect(body).not.toContain('Pour les experts')
    expect(body).toContain('**Validité du lien**')
    expect(body).toContain('L’horaire des défenses TPI 2026 est publié.\n\nVous pouvez consulter')
    expect(body).toContain('Merci de considérer l’horaire comme définitif')
    expect(body).toContain('aucune modification ne peut être garantie')
    expect(body).toContain('token-defense')
    expect(body).not.toContain('token-vote')
    expect(body).not.toContain('Destinataire:')
    expect(body).not.toContain('Contexte:')

    openSpy.mockRestore()
  })

  test('n’affiche plus les anciens boutons Outlook par rôle dans la boîte à outils', async () => {
    workflowCoordinationService.previewAccessLinks.mockResolvedValue(createAccessPreview({
      summary: {
        peopleCount: 2,
        soutenanceLinkCount: 2,
        soutenanceGeneratedLinkCount: 2,
        generatedLinkCount: 2
      },
      people: [
        {
          person: {
            id: 'person-cdp',
            name: 'Camille Projet',
            email: 'camille.projet@example.ch',
            roles: ['chef_projet', 'expert'],
            site: ''
          },
          voteLinks: [],
          soutenanceLinks: [
            {
              type: 'soutenance',
              publicationVersion: 2,
              url: 'https://tpi26.ch/soutenances-2026/?ml=token-cdp',
              generated: true,
              availabilityStatus: 'available'
            }
          ],
          arbitrageLinks: []
        },
        {
          person: {
            id: 'person-expert',
            name: 'Eva Expert',
            email: 'eva.expert@example.ch',
            roles: ['expert'],
            site: ''
          },
          voteLinks: [],
          soutenanceLinks: [
            {
              type: 'soutenance',
              publicationVersion: 2,
              url: 'https://tpi26.ch/soutenances-2026/?ml=token-expert',
              generated: true,
              availabilityStatus: 'available'
            }
          ],
          arbitrageLinks: []
        }
      ]
    }))

    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    expect(await screen.findByRole('button', { name: /ouvrir le module email html/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /emails cdp/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /emails experts/i })).not.toBeInTheDocument()
  })

  test('transmet les emails HTML défense par lot CDP via le serveur', async () => {
    workflowCoordinationService.previewAccessLinks.mockResolvedValue(createAccessPreview({
      summary: {
        peopleCount: 1,
        soutenanceLinkCount: 1,
        soutenanceGeneratedLinkCount: 1,
        generatedLinkCount: 1
      },
      people: [
        {
          person: {
            id: 'person-cdp',
            name: 'Camille Projet',
            email: 'camille.projet@example.ch',
            roles: ['chef_projet'],
            site: ''
          },
          voteLinks: [],
          soutenanceLinks: [
            {
              id: 'link-cdp',
              type: 'soutenance',
              publicationVersion: 2,
              expiresAt: '2026-05-14T21:00:00.000Z',
              url: 'https://tpi26.ch/soutenances-2026/?ml=token-cdp',
              generated: true,
              availabilityStatus: 'available'
            }
          ],
          arbitrageLinks: []
        }
      ]
    }))

    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: /ouvrir le module email html/i }))
    expect(await screen.findByRole('heading', { name: /email html défenses/i })).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /envoyer cdp/i }))

    await waitFor(() => {
      expect(workflowCoordinationService.sendSoutenanceAccessEmails).toHaveBeenCalledWith(
        2026,
        [
          expect.objectContaining({
            linkId: 'link-cdp',
            recipientEmail: 'camille.projet@example.ch',
            recipientAudience: 'cdp',
            recipientRoles: ['chef_projet'],
            url: 'https://tpi26.ch/soutenances-2026/?ml=token-cdp'
          })
        ],
        expect.objectContaining({
          baseUrl: 'http://localhost'
        })
      )
    })

    expect(await screen.findByText(/1 email\(s\) HTML transmis pour les chefs de projet/i)).toBeInTheDocument()
  })

  test('affiche une erreur si le test email HTML échoue côté SMTP', async () => {
    workflowCoordinationService.previewAccessLinks.mockResolvedValue(createAccessPreview({
      summary: {
        peopleCount: 1,
        soutenanceLinkCount: 1,
        soutenanceGeneratedLinkCount: 1,
        generatedLinkCount: 1
      },
      people: [
        {
          person: {
            id: 'person-cdp',
            name: 'Camille Projet',
            email: 'camille.projet@example.ch',
            roles: ['chef_projet'],
            site: ''
          },
          voteLinks: [],
          soutenanceLinks: [
            {
              id: 'link-cdp',
              type: 'soutenance',
              publicationVersion: 2,
              expiresAt: '2026-05-14T21:00:00.000Z',
              url: 'https://tpi26.ch/soutenances-2026/?ml=token-cdp',
              generated: true,
              availabilityStatus: 'available'
            }
          ],
          arbitrageLinks: []
        }
      ]
    }))
    workflowCoordinationService.sendSoutenanceAccessEmails.mockResolvedValueOnce({
      success: false,
      testMode: true,
      summary: {
        requestedCount: 1,
        sentCount: 0,
        skippedCount: 0,
        failedCount: 1
      },
      results: [
        {
          linkId: 'link-cdp',
          deliveryStatus: 'failed',
          error: 'SMTP rejected sender'
        }
      ]
    })

    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: /ouvrir le module email html/i }))
    fireEvent.change(await screen.findByLabelText(/email test/i), {
      target: { value: 'test@example.ch' }
    })
    fireEvent.click(await screen.findByRole('button', { name: /^test$/i }))

    expect(await screen.findByText(/SMTP rejected sender/i)).toBeInTheDocument()
    expect(screen.queryByText(/Email HTML de test envoyé/i)).not.toBeInTheDocument()
  })

  test("reprend l'état email déjà envoyé pour les liens d'arbitrage", async () => {
    workflowCoordinationService.previewAccessLinks.mockResolvedValue(createAccessPreview({
      summary: {
        peopleCount: 1,
        arbitrageLinkCount: 1,
        arbitrageGeneratedLinkCount: 1
      },
      people: [
        {
          person: {
            id: 'person-1',
            name: 'Eva Expert',
            email: 'eva.expert@example.ch',
            roles: ['expert'],
            site: ''
          },
          voteLinks: [],
          soutenanceLinks: [],
          arbitrageLinks: [
            {
              type: 'arbitrage',
              reference: 'TPI-2026-51',
              proposalId: 'proposal-1',
              proposedSlotLabel: '06.05.2026 14:00',
              url: 'https://tpi26.ch/arbitrage/proposal-1',
              generated: true,
              availabilityStatus: 'available',
              deliveryStatus: 'sent',
              sentAt: '2026-05-06T10:30:00.000Z'
            }
          ]
        }
      ]
    }))

    render(
      <MemoryRouter initialEntries={['/acces-liens?year=2026&phase=arbitrage']}>
        <TokenGenerator isArrowUp />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: /ouvrir la synthèse des accès/i }))

    expect(await screen.findByText('1/1 transmis')).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /ouvrir le bloc de Eva Expert/i }))

    expect(screen.getByText(/Transmis le 06\.05\.2026/i)).toBeInTheDocument()
  })
})
