import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import TpiManagement from './TpiManagement.jsx'
import { getTpiFromServer } from './TpiData.jsx'
import { planningCatalogService, planningConfigService } from '../../services/planningService'

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

jest.mock('../../services/planningService', () => ({
  planningCatalogService: {
    getGlobal: jest.fn()
  },
  planningConfigService: {
    getByYear: jest.fn()
  }
}))

describe('TpiManagement', () => {
beforeEach(() => {
    mockTpiList.mockClear()
    mockTpiForm.mockClear()
    getTpiFromServer.mockReset()
    planningCatalogService.getGlobal.mockReset()
    planningConfigService.getByYear.mockReset()
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

    const sites = [
      {
        code: 'SEBEILLON',
        label: 'Sébeillon',
        classGroups: []
      }
    ]

    getTpiFromServer.mockResolvedValue([])
    planningCatalogService.getGlobal.mockResolvedValue({ sites })
    planningConfigService.getByYear.mockResolvedValue({ classTypes })

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
  })

  it('propage le focus et l édition demandés par les query params à la liste TPI', async () => {
    getTpiFromServer.mockResolvedValue([])
    planningCatalogService.getGlobal.mockResolvedValue({ sites: [] })
    planningConfigService.getByYear.mockResolvedValue({ classTypes: [] })

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

  it('ouvre la création préremplie depuis l état de navigation quand la fiche legacy est absente', async () => {
    getTpiFromServer.mockResolvedValue([])
    planningCatalogService.getGlobal.mockResolvedValue({ sites: [] })
    planningConfigService.getByYear.mockResolvedValue({ classTypes: [] })

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
                sujet: 'Sujet planning'
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
        sujet: 'Sujet planning',
        dateDepart: '',
        dateFin: ''
      })
    })
  })

  it('complète les dates de période du préremplissage depuis le type de classe annuel', async () => {
    getTpiFromServer.mockResolvedValue([])
    planningCatalogService.getGlobal.mockResolvedValue({ sites: [] })
    planningConfigService.getByYear.mockResolvedValue({
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
})
