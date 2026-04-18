import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import PlanningConfiguration from './PlanningConfiguration'
import {
  planningCatalogService,
  planningConfigService,
  tpiPlanningService
} from '../../services/planningService'

jest.mock('../../services/planningService', () => ({
  planningCatalogService: {
    getGlobal: jest.fn(),
    saveGlobal: jest.fn()
  },
  planningConfigService: {
    getByYear: jest.fn(),
    saveByYear: jest.fn()
  },
  tpiPlanningService: {
    getByYear: jest.fn()
  }
}))

const mockCatalog = {
  key: 'shared',
  schemaVersion: 2,
  sites: [
    {
      id: 'site-etml',
      code: 'ETML',
      label: 'ETML',
      planningColor: '#1D4ED8',
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

const mockYearConfig = {
  year: 2026,
  schemaVersion: 2,
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
      notes: '',
      active: true
    }
  ]
}

const mockYearConfigWithCustomTypes = {
  year: 2026,
  schemaVersion: 2,
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
      notes: '',
      active: true
    }
  ]
}

describe('PlanningConfiguration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    planningCatalogService.getGlobal.mockResolvedValue(mockCatalog)
    planningCatalogService.saveGlobal.mockImplementation(async (payload) => payload)
    planningConfigService.getByYear.mockResolvedValue(mockYearConfig)
    planningConfigService.saveByYear.mockImplementation(async (_year, payload) => payload)
    tpiPlanningService.getByYear.mockResolvedValue([])
  })

  test('replie un site en masquant son contenu', async () => {
    render(<PlanningConfiguration />)

    const collapseButton = await screen.findByRole('button', {
      name: /Réduire le site ETML/i
    })
    const siteCard = collapseButton.closest('article')

    const body = document.getElementById(collapseButton.getAttribute('aria-controls'))
    expect(body).not.toHaveAttribute('hidden')

    fireEvent.click(collapseButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ouvrir le site ETML/i })).toBeInTheDocument()
    })
    expect(body).toHaveAttribute('hidden')
    expect(within(siteCard).queryByRole('heading', { name: 'ETML' })).not.toBeInTheDocument()
    expect(within(siteCard).getByText('ETML · A101')).toBeInTheDocument()
  })

  test("n'affiche plus le champ Adresse 2 dans un site", async () => {
    render(<PlanningConfiguration />)

    await screen.findByRole('button', { name: 'Supprimer le site' })

    expect(screen.queryByLabelText('Adresse 2')).not.toBeInTheDocument()
  })

  test('replie une famille de classes en masquant son contenu', async () => {
    render(<PlanningConfiguration />)

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

    const type1Heading = await screen.findByRole('heading', { name: 'Type 1' })
    const type1Card = type1Heading.closest('article')
    expect(type1Card).not.toBeNull()

    fireEvent.click(within(type1Card).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Type 1' })).not.toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: 'Type 2' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'CFC' }).length).toBeGreaterThan(0)
  })

  test('replie un type en affichant uniquement sa ligne de résumé', async () => {
    planningConfigService.getByYear.mockResolvedValueOnce(mockYearConfigWithCustomTypes)

    render(<PlanningConfiguration />)

    const collapseButton = await screen.findByRole('button', {
      name: /Réduire le type Type 2/i
    })
    const typeCard = collapseButton.closest('article')

    fireEvent.click(collapseButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ouvrir le type Type 2/i })).toBeInTheDocument()
    })

    expect(within(typeCard).queryByRole('heading', { name: 'Type 2' })).not.toBeInTheDocument()
    expect(within(typeCard).queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
    expect(within(typeCard).getByText('T2 · Type 2 · Période non définie')).toBeInTheDocument()
  })

  test('applique une cible manuelle dans le dimensionnement', async () => {
    tpiPlanningService.getByYear.mockResolvedValueOnce([
      {
        site: 'ETML',
        classe: 'CFC'
      }
    ])

    render(<PlanningConfiguration />)

    const sizingSection = (await screen.findByRole('heading', { name: 'Salles à prévoir' })).closest('section')
    const manualTargetInput = await screen.findByLabelText('Rooms / date')

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
    tpiPlanningService.getByYear.mockResolvedValueOnce([
      {
        site: 'ETML',
        classe: 'CFC'
      }
    ])

    render(<PlanningConfiguration />)

    const sizingSection = (await screen.findByRole('heading', { name: 'Salles à prévoir' })).closest('section')
    await waitFor(() => {
      expect(within(sizingSection).getByText('ETML')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le site' }))

    await waitFor(() => {
      expect(within(sizingSection).queryByText('ETML')).not.toBeInTheDocument()
    })
    expect(within(sizingSection).getByText('1 TPI hors catalogue ignoré du dimensionnement')).toBeInTheDocument()
  })

  test('génère des rooms depuis la cible manuelle du site', async () => {
    render(<PlanningConfiguration />)

    const targetInput = await screen.findByLabelText('Rooms / date')
    fireEvent.change(targetInput, { target: { value: '3' } })

    fireEvent.click(screen.getByRole('button', { name: 'Créer 2' }))

    expect(screen.getByDisplayValue('ETML 01')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ETML 02')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('A101').length).toBeGreaterThan(0)
  })

  test("affiche une aide hover sur le champ Rooms / date", async () => {
    render(<PlanningConfiguration />)

    const roomDateLabel = await screen.findByText('Rooms / date')

    expect(roomDateLabel).toHaveAttribute(
      'title',
      'Nombre de rooms à prévoir pour chaque date sur ce site. Laisser vide pour utiliser le calcul automatique.'
    )
  })

  test("enregistre un paramètre annuel modifié depuis le bouton principal", async () => {
    render(<PlanningConfiguration />)

    const removeSiteButton = await screen.findByRole('button', { name: 'Supprimer le site' })
    const siteCard = removeSiteButton.closest('article')
    const slotInput = within(siteCard).getByLabelText('Créneaux / room')

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

  test("enregistre ensemble le catalogue et l'année depuis le bouton principal", async () => {
    render(<PlanningConfiguration />)

    const removeSiteButton = await screen.findByRole('button', { name: 'Supprimer le site' })
    const siteCard = removeSiteButton.closest('article')
    const slotInput = within(siteCard).getByLabelText('Créneaux / room')
    const siteNameInput = within(siteCard).getAllByLabelText('Nom')[0]

    fireEvent.change(slotInput, { target: { value: '9' } })
    fireEvent.change(siteNameInput, { target: { value: 'ETML Renommé' } })
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

  test("n'enregistre plus un type supprimé", async () => {
    planningConfigService.getByYear.mockResolvedValueOnce(mockYearConfigWithCustomTypes)

    render(<PlanningConfiguration />)

    const type1Heading = await screen.findByRole('heading', { name: 'Type 1' })
    fireEvent.click(within(type1Heading.closest('article')).getByRole('button', { name: 'Supprimer' }))
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
