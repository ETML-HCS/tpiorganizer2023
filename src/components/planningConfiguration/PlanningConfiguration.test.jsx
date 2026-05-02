import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import PlanningConfiguration from './PlanningConfiguration'
import {
  publicationDeploymentConfigService,
  planningCatalogService,
  planningConfigService
} from '../../services/planningService'
import * as tpiController from '../tpiControllers/TpiController.jsx'

jest.mock('../../services/planningService', () => ({
  publicationDeploymentConfigService: {
    get: jest.fn(),
    save: jest.fn()
  },
  planningCatalogService: {
    getGlobal: jest.fn(),
    saveGlobal: jest.fn()
  },
  planningConfigService: {
    getByYear: jest.fn(),
    saveByYear: jest.fn()
  }
}))

jest.mock('../tpiControllers/TpiController.jsx', () => ({
  getTpiModels: jest.fn()
}))

const mockCatalog = {
  key: 'shared',
  schemaVersion: 2,
  emailSettings: {
    senderName: 'TPI Organizer',
    senderEmail: '',
    replyToEmail: '',
    defaultDeliveryMode: 'outlook'
  },
  publicationSettings: {
    publicBaseUrl: 'https://tpi26.ch'
  },
  sites: [
    {
      id: 'site-etml',
      code: 'ETML',
      label: 'ETML',
      planningColor: '#1D4ED8',
      tpiColor: '',
      address: {
        line1: '',
        line2: '',
        postalCode: '',
        city: '',
        canton: '',
        country: 'Suisse'
      },
      roomDetails: [
        {
          id: 'room-a101',
          code: 'A101',
          label: 'A101',
          capacity: 18,
          notes: '',
          active: true
        }
      ],
      classGroups: [
        {
          id: 'grp-cfc',
          baseType: 'CFC',
          label: 'CFC',
          classes: [
            {
              id: 'class-cfc-1',
              baseType: 'CFC',
              code: 'CFC1',
              label: 'CFC 1',
              description: '',
              active: true
            }
          ]
        },
        {
          id: 'grp-fpa',
          baseType: 'FPA',
          label: 'FPA',
          classes: []
        },
        {
          id: 'grp-matu',
          baseType: 'MATU',
          label: 'MATU',
          classes: []
        }
      ],
      notes: '',
      active: true
    }
  ]
}

const mockPublicationDeploymentConfig = {
  key: 'static-publication',
  protocol: 'ftp',
  host: 'ftp.tpi26.ch',
  port: 21,
  username: 'publisher',
  hasPassword: true,
  passwordUpdatedAt: '2026-01-15T10:00:00.000Z',
  remoteDir: '/home/account/domains/tpi26.ch/public_html',
  staticRemoteDir: 'soutenances-{year}',
  publicBaseUrl: 'https://tpi26.ch',
  publicPath: '/soutenances-{year}'
}

const mockYearConfig = {
  year: 2026,
  schemaVersion: 2,
  workflowSettings: {
    voteDeadlineDays: 7,
    maxVoteProposals: 3,
    allowSpecialVoteRequest: true,
    automaticVoteRemindersEnabled: false,
    voteReminderLeadHours: 48,
    maxVoteReminders: 1,
    voteReminderCooldownHours: 24
  },
  accessLinkSettings: {
    voteLinkValidityHours: 168,
    voteLinkMaxUses: 20,
    soutenanceLinkValidityHours: 96,
    soutenanceLinkMaxUses: 60
  },
  classTypes: [
    {
      id: 'annual-cfc',
      code: 'CFC',
      prefix: 'C',
      label: 'CFC',
      startDate: '',
      endDate: '',
      soutenanceDates: [],
      notes: '',
      active: true
    }
  ],
  siteConfigs: [
    {
      id: 'site-config-etml',
      siteId: 'site-etml',
      siteCode: 'ETML',
      breaklineMinutes: 10,
      tpiTimeMinutes: 60,
      firstTpiStartTime: '08:00',
      numSlots: 8,
      minTpiPerRoom: 3,
      notes: '',
      active: true
    }
  ]
}

const mockYearConfigWithCustomTypes = {
  year: 2026,
  schemaVersion: 2,
  workflowSettings: {
    voteDeadlineDays: 7,
    maxVoteProposals: 3,
    allowSpecialVoteRequest: true,
    automaticVoteRemindersEnabled: false,
    voteReminderLeadHours: 48,
    maxVoteReminders: 1,
    voteReminderCooldownHours: 24
  },
  accessLinkSettings: {
    voteLinkValidityHours: 168,
    voteLinkMaxUses: 20,
    soutenanceLinkValidityHours: 96,
    soutenanceLinkMaxUses: 60
  },
  classTypes: [
    {
      id: 'annual-cfc',
      code: 'CFC',
      prefix: 'C',
      label: 'CFC',
      startDate: '',
      endDate: '',
      soutenanceDates: [],
      notes: '',
      active: true
    },
    {
      id: 'type-1',
      code: 'TYPE1',
      prefix: 'T1',
      label: 'Type 1',
      startDate: '',
      endDate: '',
      soutenanceDates: [],
      notes: '',
      active: true
    },
    {
      id: 'type-2',
      code: 'TYPE2',
      prefix: 'T2',
      label: 'Type 2',
      startDate: '',
      endDate: '',
      soutenanceDates: [],
      notes: '',
      active: true
    }
  ],
  siteConfigs: [
    {
      id: 'site-config-etml',
      siteId: 'site-etml',
      siteCode: 'ETML',
      breaklineMinutes: 10,
      tpiTimeMinutes: 60,
      firstTpiStartTime: '08:00',
      numSlots: 8,
      minTpiPerRoom: 3,
      notes: '',
      active: true
    }
  ]
}

describe('PlanningConfiguration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    publicationDeploymentConfigService.get.mockResolvedValue(mockPublicationDeploymentConfig)
    publicationDeploymentConfigService.save.mockImplementation(async (payload) => ({
      ...mockPublicationDeploymentConfig,
      ...payload,
      hasPassword: Boolean(payload.password) || (payload.clearPassword === true ? false : mockPublicationDeploymentConfig.hasPassword),
      password: undefined
    }))
    planningCatalogService.getGlobal.mockResolvedValue(mockCatalog)
    planningCatalogService.saveGlobal.mockImplementation(async (payload) => payload)
    planningConfigService.getByYear.mockResolvedValue(mockYearConfig)
    planningConfigService.saveByYear.mockImplementation(async (_year, payload) => payload)
    tpiController.getTpiModels.mockResolvedValue([])
  })

  const ensureOpen = async (openName, closeName) => {
    const closeButton = screen.queryByRole('button', { name: closeName })
    if (closeButton) {
      return closeButton
    }

    fireEvent.click(await screen.findByRole('button', { name: openName }))
    return screen.findByRole('button', { name: closeName })
  }

  const openYearPanel = async () =>
    ensureOpen(/Ouvrir le bloc année/i, /Réduire le bloc année/i)

  const openWorkflowCard = async () => {
    await openYearPanel()

    const heading = screen.queryByRole('heading', { name: 'Vote' })
    if (heading) {
      return heading.closest('article')
    }

    fireEvent.click(await screen.findByRole('button', {
      name: /Ouvrir la configuration de vote/i
    }))
    return (await screen.findByRole('heading', { name: 'Vote' })).closest('article')
  }

  const openAccessLinkCard = async () => {
    await openYearPanel()

    const heading = screen.queryByRole('heading', { name: 'Liens' })
    if (heading) {
      return heading.closest('article')
    }

    fireEvent.click(await screen.findByRole('button', {
      name: /Ouvrir la configuration des liens d'accès/i
    }))
    return (await screen.findByRole('heading', { name: 'Liens' })).closest('article')
  }

  const openCatalogPanel = async () =>
    ensureOpen(/Ouvrir le bloc sites/i, /Réduire le bloc sites/i)

  const openCapacityPanel = async () =>
    ensureOpen(/Ouvrir le dimensionnement des salles/i, /Réduire le dimensionnement des salles/i)

  const openSiteCard = async (siteName = 'ETML') => {
    await openCatalogPanel()

    const closeButton = screen.queryByRole('button', {
      name: new RegExp(`Réduire le site ${siteName}`, 'i')
    })
    if (closeButton) {
      return closeButton.closest('article')
    }

    const openButton = await screen.findByRole('button', {
      name: new RegExp(`Ouvrir le site ${siteName}`, 'i')
    })
    const siteCard = openButton.closest('article')
    fireEvent.click(openButton)
    await screen.findByRole('button', {
      name: new RegExp(`Réduire le site ${siteName}`, 'i')
    })
    return siteCard
  }

  const openSiteTab = async (siteName = 'ETML', tabName = /Salles/i) => {
    const siteCard = await openSiteCard(siteName)
    fireEvent.click(within(siteCard).getByRole('tab', { name: tabName }))
    return siteCard
  }

  const openSiteRooms = async (siteName = 'ETML') =>
    openSiteTab(siteName, /Salles/i)

  const openSiteGeneral = async (siteName = 'ETML') =>
    openSiteTab(siteName, /Site/i)

  const openSiteSchedule = async (siteName = 'ETML') => {
    const siteCard = await openSiteTab(siteName, /Rythme/i)
    const closeButton = within(siteCard).queryByRole('button', {
      name: new RegExp(`Réduire le rythme ${siteName}`, 'i')
    })
    if (closeButton) {
      return closeButton
    }

    fireEvent.click(within(siteCard).getByRole('button', {
      name: new RegExp(`Ouvrir le rythme ${siteName}`, 'i')
    }))
    return within(siteCard).findByRole('button', {
      name: new RegExp(`Réduire le rythme ${siteName}`, 'i')
    })
  }

  const openSiteClasses = async (siteName = 'ETML') => {
    const siteCard = await openSiteTab(siteName, /Classes/i)
    const closeButton = within(siteCard).queryByRole('button', {
      name: new RegExp(`Réduire les classes de ${siteName}`, 'i')
    })
    if (closeButton) {
      return closeButton.closest('article')
    }

    const openButton = within(siteCard).getByRole('button', {
      name: new RegExp(`Ouvrir les classes de ${siteName}`, 'i')
    })
    const classCard = openButton.closest('article')
    fireEvent.click(openButton)
    await within(siteCard).findByRole('button', {
      name: new RegExp(`Réduire les classes de ${siteName}`, 'i')
    })
    return classCard
  }

  const openClassType = async (typeName) => {
    await openYearPanel()

    const heading = screen.queryByRole('heading', { name: typeName })
    if (heading) {
      return heading.closest('article')
    }

    fireEvent.click(await screen.findByRole('button', {
      name: new RegExp(`Ouvrir le type ${typeName}`, 'i')
    }))
    return (await screen.findByRole('heading', { name: typeName })).closest('article')
  }

  const openDefenseCard = async () => {
    await openCatalogPanel()

    const heading = screen.queryByRole('heading', { name: 'Personnalisation des soutenances' })
    if (heading) {
      return heading.closest('article')
    }

    fireEvent.click(await screen.findByRole('button', {
      name: /Ouvrir la personnalisation des soutenances/i
    }))
    return (await screen.findByRole('heading', { name: 'Personnalisation des soutenances' })).closest('article')
  }

  const openEmailCard = async () => {
    await openCatalogPanel()

    const heading = screen.queryByRole('heading', { name: 'Email' })
    if (heading) {
      return heading.closest('article')
    }

    fireEvent.click(await screen.findByRole('button', {
      name: /Ouvrir la configuration email/i
    }))
    return (await screen.findByRole('heading', { name: 'Email' })).closest('article')
  }

  const openPublicationCard = async () => {
    await openCatalogPanel()

    const heading = screen.queryByRole('heading', { name: 'Publication' })
    if (heading) {
      return heading.closest('article')
    }

    fireEvent.click(await screen.findByRole('button', {
      name: /Ouvrir la configuration publication/i
    }))
    return (await screen.findByRole('heading', { name: 'Publication' })).closest('article')
  }

  test('replie un site en masquant son contenu', async () => {
    render(<PlanningConfiguration />)

    const siteCard = await openSiteCard()
    const collapseButton = await screen.findByRole('button', {
      name: /Réduire le site ETML/i
    })

    const body = document.getElementById(collapseButton.getAttribute('aria-controls'))
    expect(body).not.toHaveAttribute('hidden')

    fireEvent.click(collapseButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ouvrir le site ETML/i })).toBeInTheDocument()
    })
    expect(body).toHaveAttribute('hidden')
    expect(within(siteCard).queryByRole('heading', { name: 'ETML' })).not.toBeInTheDocument()
    expect(within(siteCard).getByText(/ETML · A101 · 1\/1 salle active · 8 créneaux/i)).toBeInTheDocument()
  })

  test('ouvre et replie tous les sites depuis le bloc sites', async () => {
    render(<PlanningConfiguration />)

    fireEvent.click(await screen.findByRole('button', {
      name: /Ouvrir tous les sites/i
    }))

    expect(await screen.findByRole('button', {
      name: /Réduire le bloc sites/i
    })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'ETML' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', {
      name: /Réduire tous les sites/i
    }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ouvrir le site ETML/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole('heading', { name: 'ETML' })).not.toBeInTheDocument()
  })

  test('replie le rythme du site en masquant les champs temps', async () => {
    render(<PlanningConfiguration />)

    await openSiteSchedule()
    const collapseButton = await screen.findByRole('button', {
      name: /Réduire le rythme ETML/i
    })
    const body = document.getElementById(collapseButton.getAttribute('aria-controls'))

    expect(body).not.toHaveAttribute('hidden')
    expect(within(body).getByLabelText('Premier TPI')).toBeInTheDocument()

    fireEvent.click(collapseButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ouvrir le rythme ETML/i })).toBeInTheDocument()
    })
    expect(body).toHaveAttribute('hidden')
  })

  test("n'affiche plus le champ Adresse 2 dans un site", async () => {
    render(<PlanningConfiguration />)

    await openSiteGeneral()

    expect(screen.queryByLabelText('Adresse 2')).not.toBeInTheDocument()
  })

  test('replie une famille de classes en masquant son contenu', async () => {
    render(<PlanningConfiguration />)

    await openSiteClasses()
    fireEvent.click(await screen.findByRole('button', {
      name: /Ouvrir le groupe CFC/i
    }))
    const collapseButton = await screen.findByRole('button', {
      name: /Réduire le groupe CFC/i
    })

    const body = document.getElementById(collapseButton.getAttribute('aria-controls'))
    expect(body).not.toHaveAttribute('hidden')

    fireEvent.click(collapseButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ouvrir le groupe CFC/i })).toBeInTheDocument()
    })
    expect(body).toHaveAttribute('hidden')
  })

  test('supprime un type custom sans supprimer les autres types', async () => {
    planningConfigService.getByYear.mockResolvedValueOnce(mockYearConfigWithCustomTypes)

    render(<PlanningConfiguration />)

    const type1Card = await openClassType('Type 1')
    expect(type1Card).not.toBeNull()

    fireEvent.click(within(type1Card).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Type 1' })).not.toBeInTheDocument()
    })

    expect(screen.getByText('T2 · Type 2 · Période non définie')).toBeInTheDocument()
    expect(screen.getByText('C · CFC · Période non définie')).toBeInTheDocument()
  })

  test('replie un type en affichant uniquement sa ligne de résumé', async () => {
    planningConfigService.getByYear.mockResolvedValueOnce(mockYearConfigWithCustomTypes)

    render(<PlanningConfiguration />)

    const typeCard = await openClassType('Type 2')
    const collapseButton = await screen.findByRole('button', {
      name: /Réduire le type Type 2/i
    })

    fireEvent.click(collapseButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ouvrir le type Type 2/i })).toBeInTheDocument()
    })

    expect(within(typeCard).queryByRole('heading', { name: 'Type 2' })).not.toBeInTheDocument()
    expect(within(typeCard).queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
    expect(within(typeCard).getByText('T2 · Type 2 · Période non définie')).toBeInTheDocument()
  })

  test('rappelle le format SPECIAL au survol des dates de défense', async () => {
    planningConfigService.getByYear.mockResolvedValueOnce(mockYearConfigWithCustomTypes)

    render(<PlanningConfiguration />)

    const typeCard = await openClassType('Type 1')
    const help = within(typeCard).getByLabelText('Format des dates de défense')

    expect(help).toHaveAttribute('data-tooltip', expect.stringContaining('SPECIAL'))
    expect(help).toHaveAttribute('title', expect.stringContaining('2026-06-12 SPECIAL'))
  })

  test("ouvre et replie tous les types depuis la section Types", async () => {
    planningConfigService.getByYear.mockResolvedValueOnce(mockYearConfigWithCustomTypes)

    render(<PlanningConfiguration />)

    await openYearPanel()

    fireEvent.click(await screen.findByRole('button', {
      name: /Ouvrir tous les types de l'année/i
    }))

    expect(await screen.findByRole('button', {
      name: /Réduire le bloc année/i
    })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Type 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Type 2' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', {
      name: /Réduire tous les types de l'année/i
    }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ouvrir le type Type 1/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole('heading', { name: 'Type 1' })).not.toBeInTheDocument()
  })

  test('applique une cible manuelle dans le dimensionnement', async () => {
    tpiController.getTpiModels.mockResolvedValueOnce([
      {
        lieu: {
          site: 'ETML'
        },
        classe: 'CFC'
      }
    ])

    render(<PlanningConfiguration />)

    await openCapacityPanel()
    const sizingSection = (await screen.findByRole('heading', { name: 'Salles à prévoir' })).closest('section')
    const manualTargetInput = await screen.findByLabelText('Salles / date')

    fireEvent.change(manualTargetInput, { target: { value: '4' } })

    await waitFor(() => {
      expect(
        within(sizingSection).getByText(
          (_, node) =>
            node?.classList?.contains('configuration-capacity-site-stat') &&
            /Manuel\s*4/i.test(node.textContent || '')
        )
      ).toBeInTheDocument()
    })
    expect(within(sizingSection).getByText(/4 manuelles/i)).toBeInTheDocument()
  })

  test('retire un site supprimé du panneau de dimensionnement', async () => {
    tpiController.getTpiModels.mockResolvedValueOnce([
      {
        lieu: {
          site: 'ETML'
        },
        classe: 'CFC'
      }
    ])

    render(<PlanningConfiguration />)

    await openCapacityPanel()
    const sizingSection = (await screen.findByRole('heading', { name: 'Salles à prévoir' })).closest('section')
    await waitFor(() => {
      expect(within(sizingSection).getByText('ETML')).toBeInTheDocument()
    })

    await openSiteCard()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le site' }))

    await waitFor(() => {
      expect(within(sizingSection).queryByText('ETML')).not.toBeInTheDocument()
    })
    expect(within(sizingSection).getByText('Aucun site à dimensionner.')).toBeInTheDocument()
  })

  test('dimensionne depuis les TPI legacy de GestionTPI', async () => {
    tpiController.getTpiModels.mockResolvedValueOnce([
      {
        refTpi: '1655',
        classe: 'CFC',
        candidat: 'Cand Legacy',
        experts: {
          1: 'Expert 1',
          2: 'Expert 2'
        },
        boss: 'Boss Legacy',
        lieu: {
          site: 'ETML'
        },
        dates: {
          soutenance: '2026-06-10'
        }
      }
    ])

    render(<PlanningConfiguration />)

    await openCapacityPanel()
    const sizingSection = (await screen.findByRole('heading', { name: 'Salles à prévoir' })).closest('section')
    await waitFor(() => {
      expect(within(sizingSection).getByText('ETML')).toBeInTheDocument()
    })
    expect(tpiController.getTpiModels).toHaveBeenCalledWith(2026)
  })

  test('génère des rooms depuis la cible manuelle du site', async () => {
    render(<PlanningConfiguration />)

    await openSiteSchedule()
    const targetInput = await screen.findByLabelText('Salles / date')
    fireEvent.change(targetInput, { target: { value: '3' } })
    await openSiteRooms()

    fireEvent.click(screen.getByRole('button', { name: 'Créer 2' }))

    expect(screen.getByDisplayValue('ETML 01')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ETML 02')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('A101').length).toBeGreaterThan(0)
  })

  test("affiche une aide hover sur le champ Salles / date", async () => {
    render(<PlanningConfiguration />)

    const roomDateLabel = await screen.findByText('Salles / date')

    expect(roomDateLabel).toHaveAttribute(
      'title',
      'Nombre de salles à prévoir pour chaque date sur ce site. Laisser vide pour utiliser le calcul automatique.'
    )
  })

  test("enregistre un paramètre annuel modifié depuis le bouton principal", async () => {
    render(<PlanningConfiguration />)

    await openSiteSchedule()
    const siteCard = screen.getByRole('button', { name: 'Supprimer le site' }).closest('article')
    const slotInput = within(siteCard).getByLabelText('Créneaux / salle')

    fireEvent.change(slotInput, { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(planningConfigService.saveByYear).toHaveBeenCalledTimes(1)
    })
    expect(planningCatalogService.saveGlobal).not.toHaveBeenCalled()
    expect(planningConfigService.saveByYear).toHaveBeenCalledWith(
      2026,
      expect.objectContaining({
        siteConfigs: expect.arrayContaining([
          expect.objectContaining({
            siteId: 'site-etml',
            numSlots: 9
          })
        ])
      })
    )
  })

  test("enregistre les règles de vote annuelles", async () => {
    render(<PlanningConfiguration />)

    const workflowCard = await openWorkflowCard()
    fireEvent.change(within(workflowCard).getByLabelText('Délai vote (jours)'), {
      target: { value: '10' }
    })
    fireEvent.change(within(workflowCard).getByLabelText('Propositions max'), {
      target: { value: '4' }
    })
    fireEvent.click(within(workflowCard).getByLabelText('Fermée'))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(planningConfigService.saveByYear).toHaveBeenCalledTimes(1)
    })
    expect(planningConfigService.saveByYear).toHaveBeenCalledWith(
      2026,
      expect.objectContaining({
        workflowSettings: {
          voteDeadlineDays: 10,
          maxVoteProposals: 4,
          allowSpecialVoteRequest: false,
          automaticVoteRemindersEnabled: false,
          voteReminderLeadHours: 48,
          maxVoteReminders: 1,
          voteReminderCooldownHours: 24
        }
      })
    )
  })

  test("enregistre les rappels automatiques de vote", async () => {
    render(<PlanningConfiguration />)

    const workflowCard = await openWorkflowCard()
    const reminderToggle = within(workflowCard).getByRole('radiogroup', {
      name: 'Rappels automatiques de vote'
    })

    fireEvent.click(within(reminderToggle).getByLabelText('Active'))
    fireEvent.change(within(workflowCard).getByLabelText('Avant échéance (h)'), {
      target: { value: '36' }
    })
    fireEvent.change(within(workflowCard).getByLabelText('Rappels max'), {
      target: { value: '2' }
    })
    fireEvent.change(within(workflowCard).getByLabelText('Intervalle (h)'), {
      target: { value: '12' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(planningConfigService.saveByYear).toHaveBeenCalledTimes(1)
    })
    expect(planningConfigService.saveByYear).toHaveBeenCalledWith(
      2026,
      expect.objectContaining({
        workflowSettings: {
          voteDeadlineDays: 7,
          maxVoteProposals: 3,
          allowSpecialVoteRequest: true,
          automaticVoteRemindersEnabled: true,
          voteReminderLeadHours: 36,
          maxVoteReminders: 2,
          voteReminderCooldownHours: 12
        }
      })
    )
  })

  test("enregistre les règles annuelles des liens d'accès", async () => {
    render(<PlanningConfiguration />)

    const accessLinkCard = await openAccessLinkCard()
    fireEvent.change(within(accessLinkCard).getByLabelText('Lien vote (heures)'), {
      target: { value: '72' }
    })
    fireEvent.change(within(accessLinkCard).getByLabelText('Usages vote'), {
      target: { value: '12' }
    })
    fireEvent.change(within(accessLinkCard).getByLabelText('Lien défense (heures)'), {
      target: { value: '240' }
    })
    fireEvent.change(within(accessLinkCard).getByLabelText('Usages défense'), {
      target: { value: '90' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(planningConfigService.saveByYear).toHaveBeenCalledTimes(1)
    })
    expect(planningConfigService.saveByYear).toHaveBeenCalledWith(
      2026,
      expect.objectContaining({
        accessLinkSettings: {
          voteLinkValidityHours: 72,
          voteLinkMaxUses: 12,
          soutenanceLinkValidityHours: 240,
          soutenanceLinkMaxUses: 90
        }
      })
    )
  })

  test("enregistre la limite de TPI à la suite du site", async () => {
    render(<PlanningConfiguration />)

    await openSiteSchedule()
    const siteCard = screen.getByRole('button', { name: 'Supprimer le site' }).closest('article')
    const maxConsecutiveInput = within(siteCard).getByLabelText('TPI à la suite max')

    expect(maxConsecutiveInput).toHaveValue(4)

    fireEvent.change(maxConsecutiveInput, { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(planningConfigService.saveByYear).toHaveBeenCalledTimes(1)
    })
    expect(planningConfigService.saveByYear).toHaveBeenCalledWith(
      2026,
      expect.objectContaining({
        siteConfigs: expect.arrayContaining([
          expect.objectContaining({
            siteId: 'site-etml',
            maxConsecutiveTpi: 3
          })
        ])
      })
    )
  })

  test("enregistre le minimum cible de TPI par salle du site", async () => {
    render(<PlanningConfiguration />)

    await openSiteSchedule()
    const siteCard = screen.getByRole('button', { name: 'Supprimer le site' }).closest('article')
    const minTpiInput = within(siteCard).getByLabelText('TPI min / salle')

    expect(minTpiInput).toHaveValue(3)

    fireEvent.change(minTpiInput, { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(planningConfigService.saveByYear).toHaveBeenCalledTimes(1)
    })
    expect(planningConfigService.saveByYear).toHaveBeenCalledWith(
      2026,
      expect.objectContaining({
        siteConfigs: expect.arrayContaining([
          expect.objectContaining({
            siteId: 'site-etml',
            minTpiPerRoom: 2
          })
        ])
      })
    )
  })

  test("enregistre ensemble le catalogue et l'année depuis le bouton principal", async () => {
    render(<PlanningConfiguration />)

    const siteCard = await openSiteGeneral()
    const siteNameInput = within(siteCard).getAllByLabelText('Nom')[0]
    fireEvent.change(siteNameInput, { target: { value: 'ETML Renommé' } })

    await openSiteSchedule()
    const slotInput = within(siteCard).getByLabelText('Créneaux / salle')

    fireEvent.change(slotInput, { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(planningCatalogService.saveGlobal).toHaveBeenCalledTimes(1)
      expect(planningConfigService.saveByYear).toHaveBeenCalledTimes(1)
    })
    expect(planningCatalogService.saveGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        sites: expect.arrayContaining([
          expect.objectContaining({
            id: 'site-etml',
            label: 'ETML Renommé'
          })
        ])
      })
    )
    expect(planningConfigService.saveByYear).toHaveBeenCalledWith(
      2026,
      expect.objectContaining({
        siteConfigs: expect.arrayContaining([
          expect.objectContaining({
            siteId: 'site-etml',
            numSlots: 9
          })
        ])
      })
    )
  })

  test('enregistre la couleur planning du site dans le catalogue', async () => {
    render(<PlanningConfiguration />)

    await openSiteGeneral()
    const colorInput = await screen.findByLabelText('Couleur planning')
    fireEvent.change(colorInput, { target: { value: '#14532d' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(planningCatalogService.saveGlobal).toHaveBeenCalled()
    })

    expect(planningCatalogService.saveGlobal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sites: expect.arrayContaining([
          expect.objectContaining({
            id: 'site-etml',
            planningColor: '#14532D'
          })
        ])
      })
    )
  })

  test('enregistre la configuration email dans le catalogue', async () => {
    render(<PlanningConfiguration />)

    const emailCard = await openEmailCard()
    fireEvent.change(within(emailCard).getByLabelText('Nom expéditeur'), {
      target: { value: 'Commission TPI' }
    })
    fireEvent.change(within(emailCard).getByLabelText('Email expéditeur'), {
      target: { value: 'TPI@EXAMPLE.CH' }
    })
    fireEvent.change(within(emailCard).getByLabelText('Réponse à'), {
      target: { value: 'SUPPORT@EXAMPLE.CH' }
    })
    fireEvent.change(within(emailCard).getByLabelText('Mode par défaut'), {
      target: { value: 'automatic' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(planningCatalogService.saveGlobal).toHaveBeenCalled()
    })

    expect(planningCatalogService.saveGlobal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        emailSettings: {
          senderName: 'Commission TPI',
          senderEmail: 'tpi@example.ch',
          replyToEmail: 'support@example.ch',
          defaultDeliveryMode: 'automatic'
        }
      })
    )
  })

  test('enregistre le domaine de publication dans la configuration deploiement', async () => {
    render(<PlanningConfiguration />)

    const publicationCard = await openPublicationCard()
    fireEvent.change(within(publicationCard).getByLabelText('URL publique'), {
      target: { value: 'publication.example.ch/' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(publicationDeploymentConfigService.save).toHaveBeenCalled()
      expect(planningCatalogService.saveGlobal).toHaveBeenCalled()
    })

    expect(publicationDeploymentConfigService.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        publicBaseUrl: 'https://publication.example.ch'
      })
    )

    expect(planningCatalogService.saveGlobal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        publicationSettings: {
          publicBaseUrl: 'https://publication.example.ch'
        }
      })
    )
  })

  test('enregistre les identifiants publication sans les mettre dans le catalogue', async () => {
    render(<PlanningConfiguration />)

    const publicationCard = await openPublicationCard()
    fireEvent.change(within(publicationCard).getByLabelText('Protocole'), {
      target: { value: 'sftp' }
    })
    fireEvent.change(within(publicationCard).getByLabelText('Host'), {
      target: { value: 'sftp.example.ch' }
    })
    fireEvent.change(within(publicationCard).getByLabelText('Port'), {
      target: { value: '2222' }
    })
    fireEvent.change(within(publicationCard).getByLabelText('Utilisateur'), {
      target: { value: 'deploy' }
    })
    fireEvent.change(within(publicationCard).getByLabelText('Mot de passe'), {
      target: { value: 'secret-value' }
    })
    fireEvent.change(within(publicationCard).getByLabelText('Dossier distant'), {
      target: { value: '/var/www/tpi26.ch' }
    })
    fireEvent.change(within(publicationCard).getByLabelText('Sous-dossier'), {
      target: { value: 'planning-{year}' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(publicationDeploymentConfigService.save).toHaveBeenCalled()
    })

    expect(publicationDeploymentConfigService.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        protocol: 'sftp',
        host: 'sftp.example.ch',
        port: 2222,
        username: 'deploy',
        password: 'secret-value',
        clearPassword: false,
        remoteDir: '/var/www/tpi26.ch',
        staticRemoteDir: 'planning-{year}'
      })
    )
    expect(planningCatalogService.saveGlobal).not.toHaveBeenCalled()
  })

  test('enregistre la couleur TPI du site dans le catalogue', async () => {
    render(<PlanningConfiguration />)

    await openSiteGeneral()
    const colorInput = await screen.findByLabelText('Couleur TPI')
    fireEvent.change(colorInput, { target: { value: '#fee2e2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(planningCatalogService.saveGlobal).toHaveBeenCalled()
    })

    expect(planningCatalogService.saveGlobal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sites: expect.arrayContaining([
          expect.objectContaining({
            id: 'site-etml',
            tpiColor: '#FEE2E2'
          })
        ])
      })
    )
  })

  test('enregistre la couleur défenses du site dans le catalogue', async () => {
    render(<PlanningConfiguration />)

    await openDefenseCard()
    const colorInput = await screen.findByLabelText('Couleur défenses ETML')
    fireEvent.change(colorInput, { target: { value: '#0f766e' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(planningCatalogService.saveGlobal).toHaveBeenCalled()
    })

    expect(planningCatalogService.saveGlobal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sites: expect.arrayContaining([
          expect.objectContaining({
            id: 'site-etml',
            soutenanceColor: '#0F766E'
          })
        ])
      })
    )
  })

  test('enregistre la couleur salle de défense dans le catalogue', async () => {
    render(<PlanningConfiguration />)

    await openDefenseCard()
    const roomColorInput = await screen.findByLabelText('Couleur salle de défense A101')
    fireEvent.change(roomColorInput, { target: { value: '#be185d' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(planningCatalogService.saveGlobal).toHaveBeenCalled()
    })

    expect(planningCatalogService.saveGlobal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sites: expect.arrayContaining([
          expect.objectContaining({
            id: 'site-etml',
            roomDetails: expect.arrayContaining([
              expect.objectContaining({
                id: 'room-a101',
                soutenanceColor: '#BE185D'
              })
            ])
          })
        ])
      })
    )
  })

  test('enregistre les SVG de parties prenantes dans le bloc salles de défense', async () => {
    render(<PlanningConfiguration />)

    const iconCard = await openDefenseCard()
    expect(iconCard.querySelectorAll('.configuration-defense-role-icon-svg').length).toBeGreaterThan(0)
    const candidateSelect = within(iconCard).getByLabelText('Icône pour Candidat')
    expect(Array.from(candidateSelect.options).map((option) => option.value)).toEqual([
      'candidate',
      'candidate-green',
      'candidate-violet',
      'candidate-rose',
      'candidate-gold'
    ])
    await waitFor(() => {
      expect(candidateSelect).toBeEnabled()
    })

    fireEvent.change(candidateSelect, { target: { value: 'candidate-green' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(planningCatalogService.saveGlobal).toHaveBeenCalled()
    })

    expect(planningCatalogService.saveGlobal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stakeholderIcons: expect.objectContaining({
          candidate: 'candidate-green',
          expert1: 'participant',
          expert2: 'participant',
          projectManager: 'participant'
        })
      })
    )
  })

  test('enregistre une variante de casque coloree pour un role', async () => {
    render(<PlanningConfiguration />)

    const iconCard = await openDefenseCard()
    const greenHelmetExpert = within(iconCard).getByLabelText('Icône pour Expert 1')
    expect(Array.from(greenHelmetExpert.options).map((option) => option.value)).toEqual([
      'participant',
      'helmet-orange',
      'helmet-green',
      'helmet-blue',
      'helmet-black',
      'helmet-gray'
    ])
    await waitFor(() => {
      expect(greenHelmetExpert).toBeEnabled()
    })

    fireEvent.change(greenHelmetExpert, { target: { value: 'helmet-green' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(planningCatalogService.saveGlobal).toHaveBeenCalled()
    })

    expect(planningCatalogService.saveGlobal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        stakeholderIcons: expect.objectContaining({
          expert1: 'helmet-green'
        })
      })
    )
  })

  test('replie le bloc personnalisation des soutenances', async () => {
    render(<PlanningConfiguration />)

    await openDefenseCard()
    const collapseButton = screen.getByRole('button', {
      name: /Réduire la personnalisation des soutenances/i
    })
    const body = document.getElementById(collapseButton.getAttribute('aria-controls'))

    fireEvent.click(collapseButton)

    expect(screen.getByRole('button', { name: /Ouvrir la personnalisation des soutenances/i })).toBeInTheDocument()
    expect(body).toHaveAttribute('hidden')
  })

  test("n'enregistre plus un type supprimé", async () => {
    planningConfigService.getByYear.mockResolvedValueOnce(mockYearConfigWithCustomTypes)

    render(<PlanningConfiguration />)

    const type1Card = await openClassType('Type 1')
    fireEvent.click(within(type1Card).getByRole('button', { name: 'Supprimer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(planningConfigService.saveByYear).toHaveBeenCalled()
    })

    expect(planningConfigService.saveByYear).toHaveBeenLastCalledWith(
      2026,
      expect.objectContaining({
        classTypes: expect.not.arrayContaining([
          expect.objectContaining({ code: 'TYPE1' })
        ])
      })
    )
  })

  test("n'enregistre plus un site supprimé", async () => {
    render(<PlanningConfiguration />)

    await openSiteCard()
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer le site' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(planningCatalogService.saveGlobal).toHaveBeenCalled()
    })

    expect(planningCatalogService.saveGlobal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sites: []
      })
    )
    expect(planningConfigService.saveByYear).toHaveBeenLastCalledWith(
      2026,
      expect.objectContaining({
        siteConfigs: []
      })
    )
  })
})
