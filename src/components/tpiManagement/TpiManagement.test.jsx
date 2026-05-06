import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'

import TpiManagement from './TpiManagement.jsx'
import { getTpiFromServer } from './TpiData.jsx'
import { createTpiModel, updateTpiModel } from '../tpiControllers/TpiController.jsx'
import { coordinationCatalogService, coordinationConfigService } from '../../services/coordinationService'

const mockTpiList = jest.fn(() => <div data-testid="mock-tpi-list" />)
const mockTpiForm = jest.fn(() => <div data-testid="mock-tpi-form" />)

jest.mock('./TpiList.jsx', () => {
  const React = require('react')

  return function MockTpiList(props) {
    mockTpiList(props)
    return React.createElement('div', { 'data-testid': 'mock-tpi-list' })
  }
})

jest.mock('./TpiForm.jsx', () => {
  return function MockTpiForm(props) {
    mockTpiForm(props)
    return <div data-testid="mock-tpi-form" />
  }
})

jest.mock('./TpiManagementButtons.jsx', () => {
  return function MockTpiManagementButtons() {
    return <div data-testid="mock-tpi-management-buttons" />
  }
})

jest.mock('./TpiData.jsx', () => ({
  getTpiFromServer: jest.fn(),
  saveTpiToServer: jest.fn()
}))

jest.mock('../tpiControllers/TpiController.jsx', () => ({
  createTpiModel: jest.fn(),
  updateTpiModel: jest.fn()
}))

jest.mock('../../services/coordinationService', () => ({
  coordinationCatalogService: {
    getGlobal: jest.fn()
  },
  coordinationConfigService: {
    getByYear: jest.fn()
  }
}))

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return { promise, resolve, reject }
}

function NavigateToYearButton({ year }) {
  const navigate = useNavigate()

  return (
    <button type="button" onClick={() => navigate(`/gestionTPI?year=${year}`)}>
      Changer année
    </button>
  )
}

describe('TpiManagement', () => {
beforeEach(() => {
    window.localStorage.clear()
    mockTpiList.mockClear()
    mockTpiForm.mockClear()
    getTpiFromServer.mockReset()
    createTpiModel.mockReset()
    updateTpiModel.mockReset()
    coordinationCatalogService.getGlobal.mockReset()
    coordinationConfigService.getByYear.mockReset()
  })

  it('branche la configuration annuelle et le catalogue central vers la liste TPI', async () => {
    const classTypes = [
      {
        code: 'SPECIAL',
        prefix: 'S',
        label: 'SPECIAL',
        startDate: '2026-01-01',
        endDate: '2026-06-30'
      }
    ]
    const soutenanceDates = [
      {
        date: '2026-06-10',
        special: true,
        classes: ['SPECIAL', 'S']
      }
    ]

    const sites = [
      {
        code: 'SEBEILLON',
        label: 'Sébeillon',
        classGroups: []
      }
    ]

    getTpiFromServer.mockResolvedValue([])
    coordinationCatalogService.getGlobal.mockResolvedValue({ sites })
    coordinationConfigService.getByYear.mockResolvedValue({ classTypes, soutenanceDates })

    render(
      <MemoryRouter>
        <TpiManagement toggleArrow={() => {}} isArrowUp={true} />
      </MemoryRouter>
    )

    await waitFor(() => {
      const lastCallProps = mockTpiList.mock.calls[mockTpiList.mock.calls.length - 1]?.[0]
      expect(lastCallProps?.planningCatalogSites).toEqual(sites)
    })

    await waitFor(() => {
      const lastCallProps = mockTpiList.mock.calls[mockTpiList.mock.calls.length - 1]?.[0]
      expect(lastCallProps?.planningClassTypes).toEqual(classTypes)
    })

    await waitFor(() => {
      const lastCallProps = mockTpiList.mock.calls[mockTpiList.mock.calls.length - 1]?.[0]
      expect(lastCallProps?.planningSoutenanceDates).toEqual(soutenanceDates)
    })
  })

  it('propage le focus et l édition demandés par les query params à la liste TPI', async () => {
    getTpiFromServer.mockResolvedValue([])
    coordinationCatalogService.getGlobal.mockResolvedValue({ sites: [] })
    coordinationConfigService.getByYear.mockResolvedValue({ classTypes: [] })

    render(
      <MemoryRouter initialEntries={['/gestionTPI?focus=2163&edit=1']}>
        <TpiManagement toggleArrow={() => {}} isArrowUp={true} />
      </MemoryRouter>
    )

    await waitFor(() => {
      const lastCallProps = mockTpiList.mock.calls[mockTpiList.mock.calls.length - 1]?.[0]
      expect(lastCallProps?.searchTerm).toBe('2163')
      expect(lastCallProps?.focusedTpiRef).toBe('2163')
      expect(lastCallProps?.requestedEditRef).toBe('2163')
    })
  })

  it('place le filtre de périmètre coordination dans le bandeau et le propage à la liste', async () => {
    getTpiFromServer.mockResolvedValue([
      { refTpi: '3001', site: 'ETML' },
      { refTpi: '3002', site: 'CFPV' }
    ])
    coordinationCatalogService.getGlobal.mockResolvedValue({ sites: [] })
    coordinationConfigService.getByYear.mockResolvedValue({
      classTypes: [],
      siteConfigs: [
        { siteCode: 'ETML', label: 'ETML', active: true }
      ]
    })

    render(
      <MemoryRouter>
        <TpiManagement toggleArrow={() => {}} isArrowUp={true} />
      </MemoryRouter>
    )

    const outOfScopeButton = await screen.findByRole('button', { name: /hors pér\.\s*1/i })
    expect(screen.getByRole('button', { name: /planif\.\s*1/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tout\s*2/i })).toBeInTheDocument()

    fireEvent.click(outOfScopeButton)

    await waitFor(() => {
      const lastCallProps = mockTpiList.mock.calls[mockTpiList.mock.calls.length - 1]?.[0]
      expect(lastCallProps?.planningScopeFilter).toBe('out-of-scope')
    })
  })

  it('affiche le filtre parties prenantes dans le bandeau seulement en cas d incomplétude', async () => {
    getTpiFromServer.mockResolvedValue([
      {
        refTpi: '3001',
        candidat: 'Alice Incomplete',
        candidatPersonId: 'candidat-3001',
        experts: { 1: '', 2: 'Expert Deux' },
        expert1PersonId: null,
        expert2PersonId: 'expert-3001-2',
        boss: 'Boss Test',
        bossPersonId: 'boss-3001',
        site: 'ETML',
        lieu: { site: 'ETML' }
      },
      {
        refTpi: '3002',
        candidat: 'Bruno Link',
        candidatPersonId: null,
        experts: { 1: 'Expert Un', 2: 'Expert Deux' },
        expert1PersonId: 'expert-3002-1',
        expert2PersonId: 'expert-3002-2',
        boss: 'Boss Test',
        bossPersonId: 'boss-3002',
        site: 'ETML',
        lieu: { site: 'ETML' }
      }
    ])
    coordinationCatalogService.getGlobal.mockResolvedValue({ sites: [] })
    coordinationConfigService.getByYear.mockResolvedValue({
      classTypes: [],
      siteConfigs: [
        { siteCode: 'ETML', label: 'ETML', active: true }
      ]
    })

    render(
      <MemoryRouter>
        <TpiManagement toggleArrow={() => {}} isArrowUp={true} />
      </MemoryRouter>
    )

    const missingButton = await screen.findByRole('button', { name: /pp manquantes\s*1/i })
    expect(screen.getByRole('button', { name: /pp incorrectes\s*2/i })).toBeInTheDocument()
    expect(screen.queryByText(/parties prenantes complètes/i)).not.toBeInTheDocument()

    fireEvent.click(missingButton)

    await waitFor(() => {
      const lastCallProps = mockTpiList.mock.calls[mockTpiList.mock.calls.length - 1]?.[0]
      expect(lastCallProps?.stakeholderFilter).toBe('missing')
    })
  })

  it('masque les parties prenantes du bandeau quand elles sont complètes', async () => {
    getTpiFromServer.mockResolvedValue([
      {
        refTpi: '3001',
        candidat: 'Alice Complete',
        candidatPersonId: 'candidat-3001',
        experts: { 1: 'Expert Un', 2: 'Expert Deux' },
        expert1PersonId: 'expert-3001-1',
        expert2PersonId: 'expert-3001-2',
        boss: 'Boss Test',
        bossPersonId: 'boss-3001',
        site: 'ETML',
        lieu: { site: 'ETML' }
      }
    ])
    coordinationCatalogService.getGlobal.mockResolvedValue({ sites: [] })
    coordinationConfigService.getByYear.mockResolvedValue({
      classTypes: [],
      siteConfigs: [
        { siteCode: 'ETML', label: 'ETML', active: true }
      ]
    })

    render(
      <MemoryRouter>
        <TpiManagement toggleArrow={() => {}} isArrowUp={true} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockTpiList).toHaveBeenCalled()
    })

    expect(screen.queryByRole('group', { name: /filtre parties prenantes/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/parties prenantes complètes/i)).not.toBeInTheDocument()
  })

  it('ouvre la création préremplie depuis l état de navigation quand la fiche legacy est absente', async () => {
    getTpiFromServer.mockResolvedValue([])
    coordinationCatalogService.getGlobal.mockResolvedValue({ sites: [] })
    coordinationConfigService.getByYear.mockResolvedValue({ classTypes: [] })

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/gestionTPI',
            search: '?year=2026&focus=2163&new=1',
            state: {
              prefillTpi: {
                refTpi: '2163',
                candidat: 'Alice Martin',
                sujet: 'Sujet coordination'
              }
            }
          }
        ]}
      >
        <TpiManagement toggleArrow={() => {}} isArrowUp={true} />
      </MemoryRouter>
    )

    await waitFor(() => {
      const lastFormProps = mockTpiForm.mock.calls[mockTpiForm.mock.calls.length - 1]?.[0]
      expect(lastFormProps?.initialTpi).toEqual({
        refTpi: '2163',
        candidat: 'Alice Martin',
        sujet: 'Sujet coordination',
        dateDepart: '',
        dateFin: ''
      })
    })
  })

  it('complète les dates de période du préremplissage depuis le type de classe annuel', async () => {
    getTpiFromServer.mockResolvedValue([])
    coordinationCatalogService.getGlobal.mockResolvedValue({ sites: [] })
    coordinationConfigService.getByYear.mockResolvedValue({
      classTypes: [
        {
          code: 'MATU',
          prefix: 'M',
          label: 'MATU',
          startDate: '2026-03-01',
          endDate: '2026-06-03'
        }
      ]
    })

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/gestionTPI',
            search: '?year=2026&focus=999&new=1',
            state: {
              prefillTpi: {
                refTpi: '999',
                candidat: 'Alice Martin',
                classe: 'MID4A'
              }
            }
          }
        ]}
      >
        <TpiManagement toggleArrow={() => {}} isArrowUp={true} />
      </MemoryRouter>
    )

    await waitFor(() => {
      const lastFormProps = mockTpiForm.mock.calls[mockTpiForm.mock.calls.length - 1]?.[0]
      expect(lastFormProps?.initialTpi).toEqual({
        refTpi: '999',
        candidat: 'Alice Martin',
        classe: 'MID4A',
        dateDepart: '2026-03-01',
        dateFin: '2026-06-03'
      })
    })
  })

  it('ignore une réponse tardive de l année précédente après un changement d année', async () => {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const currentYearDeferred = createDeferred()
    const nextYearDeferred = createDeferred()

    getTpiFromServer.mockImplementation((requestedYear) => {
      if (requestedYear === currentYear) {
        return currentYearDeferred.promise
      }

      if (requestedYear === nextYear) {
        return nextYearDeferred.promise
      }

      return Promise.resolve([])
    })
    coordinationCatalogService.getGlobal.mockResolvedValue({ sites: [] })
    coordinationConfigService.getByYear.mockResolvedValue({ classTypes: [] })

    render(
      <MemoryRouter initialEntries={['/gestionTPI']}>
        <NavigateToYearButton year={nextYear} />
        <TpiManagement toggleArrow={() => {}} isArrowUp={true} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(getTpiFromServer).toHaveBeenCalledWith(currentYear)
    })

    fireEvent.click(screen.getByRole('button', { name: /changer année/i }))

    await waitFor(() => {
      expect(getTpiFromServer).toHaveBeenCalledWith(nextYear)
    })

    await act(async () => {
      nextYearDeferred.resolve([{ refTpi: 'NEXT-YEAR' }])
      await Promise.resolve()
    })

    await waitFor(() => {
      const lastListProps = mockTpiList.mock.calls[mockTpiList.mock.calls.length - 1]?.[0]
      expect(lastListProps?.tpiList).toEqual([{ refTpi: 'NEXT-YEAR' }])
    })

    await act(async () => {
      currentYearDeferred.resolve([{ refTpi: 'STALE-YEAR' }])
      await Promise.resolve()
    })

    await waitFor(() => {
      const lastListProps = mockTpiList.mock.calls[mockTpiList.mock.calls.length - 1]?.[0]
      expect(lastListProps?.tpiList).toEqual([{ refTpi: 'NEXT-YEAR' }])
    })
  })

  it('utilise la route de mise à jour pour les modifications groupées des TPI existants', async () => {
    getTpiFromServer.mockResolvedValue([])
    coordinationCatalogService.getGlobal.mockResolvedValue({ sites: [] })
    coordinationConfigService.getByYear.mockResolvedValue({ classTypes: [] })
    updateTpiModel.mockResolvedValue({ _id: '507f1f77bcf86cd799439011', refTpi: '19' })

    render(
      <MemoryRouter>
        <TpiManagement toggleArrow={() => {}} isArrowUp={true} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockTpiList).toHaveBeenCalled()
    })

    const lastListProps = mockTpiList.mock.calls[mockTpiList.mock.calls.length - 1]?.[0]
    let result
    await act(async () => {
      result = await lastListProps.onBulkSave([
        {
          _id: '507f1f77bcf86cd799439011',
          refTpi: '19',
          classe: 'MID4B'
        }
      ])
    })

    expect(updateTpiModel).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.any(Number),
      expect.objectContaining({
        refTpi: '19',
        classe: 'MID4B'
      })
    )
    expect(updateTpiModel.mock.calls[0][2]).not.toHaveProperty('_id')
    expect(createTpiModel).not.toHaveBeenCalled()
    expect(result).toEqual({
      total: 1,
      successCount: 1,
      failureCount: 0,
      failures: []
    })
  })
})
