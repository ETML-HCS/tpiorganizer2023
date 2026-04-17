import React from 'react'
import { render, waitFor } from '@testing-library/react'

import TpiManagement from './TpiManagement.jsx'
import { getTpiFromServer } from './TpiData.jsx'
import { planningCatalogService, planningConfigService } from '../../services/planningService'

const mockTpiList = jest.fn(() => <div data-testid="mock-tpi-list" />)

jest.mock('./TpiList.jsx', () => {
  const React = require('react')

  return function MockTpiList(props) {
    mockTpiList(props)
    return React.createElement('div', { 'data-testid': 'mock-tpi-list' })
  }
})

jest.mock('./TpiForm.jsx', () => {
  return function MockTpiForm() {
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

    render(<TpiManagement toggleArrow={() => {}} isArrowUp={true} />)

    await waitFor(() => {
      const lastCallProps = mockTpiList.mock.calls[mockTpiList.mock.calls.length - 1]?.[0]
      expect(lastCallProps?.planningCatalogSites).toEqual(sites)
    })

    await waitFor(() => {
      const lastCallProps = mockTpiList.mock.calls[mockTpiList.mock.calls.length - 1]?.[0]
      expect(lastCallProps?.planningClassTypes).toEqual(classTypes)
    })
  })
})
