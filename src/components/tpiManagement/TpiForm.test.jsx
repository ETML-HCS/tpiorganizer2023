import React from 'react'
import { render, screen, within } from '@testing-library/react'

import TpiForm from './TpiForm.jsx'
import { personService } from '../../services/planningService'

jest.mock('../../services/planningService', () => ({
  personService: {
    getAll: jest.fn()
  }
}))

describe('TpiForm', () => {
  beforeEach(() => {
    personService.getAll.mockReset()
    personService.getAll.mockResolvedValue([])
  })

  it('propose les salles et dates de défense via les listes de configuration, y compris SPECIAL', () => {
    render(
      <TpiForm
        onSave={jest.fn()}
        onClose={jest.fn()}
        year={2026}
        tpiToLoad={{
          refTpi: '2163',
          classe: 'CID4A',
          lieu: {
            site: 'ETML'
          },
          salle: 'A101',
          dates: {
            soutenance: '2026-06-10'
          }
        }}
        planningCatalogSites={[
          {
            code: 'ETML',
            label: 'ETML',
            roomDetails: [
              { code: 'A101', label: 'A101', active: true },
              { code: 'A102', label: 'A102', active: true }
            ]
          }
        ]}
        planningClassTypes={[
          {
            code: 'CFC',
            prefix: 'C',
            label: 'CFC',
            soutenanceDates: [
              { date: '2026-06-10', special: true, classes: ['CFC', 'C'] },
              { date: '2026-06-11', classes: ['CFC', 'C'] }
            ]
          }
        ]}
      />
    )

    const roomSelect = screen.getByRole('combobox', { name: /salle/i })
    const soutenanceSelect = screen.getByRole('combobox', { name: /défense/i })

    expect(within(roomSelect).getByRole('option', { name: 'A101' })).toBeInTheDocument()
    expect(within(roomSelect).getByRole('option', { name: 'A102' })).toBeInTheDocument()
    expect(
      within(soutenanceSelect).getByRole('option', { name: /SPECIAL/i })
    ).toBeInTheDocument()
  })

  it('conserve la valeur courante quand elle est hors configuration', () => {
    render(
      <TpiForm
        onSave={jest.fn()}
        onClose={jest.fn()}
        year={2026}
        tpiToLoad={{
          refTpi: '2164',
          classe: 'CID4A',
          lieu: {
            site: 'ETML'
          },
          salle: 'Z999',
          dates: {
            soutenance: '2026-07-02'
          }
        }}
        planningCatalogSites={[
          {
            code: 'ETML',
            label: 'ETML',
            roomDetails: [
              { code: 'A101', label: 'A101', active: true }
            ]
          }
        ]}
        planningClassTypes={[
          {
            code: 'CFC',
            prefix: 'C',
            label: 'CFC',
            soutenanceDates: [
              { date: '2026-06-11', classes: ['CFC', 'C'] }
            ]
          }
        ]}
      />
    )

    const roomSelect = screen.getByRole('combobox', { name: /salle/i })
    const soutenanceSelect = screen.getByRole('combobox', { name: /défense/i })

    expect(roomSelect).toHaveValue('Z999')
    expect(soutenanceSelect).toHaveValue('2026-07-02')
    expect(
      within(roomSelect).getByRole('option', { name: /Z999 \(hors configuration\)/i })
    ).toBeInTheDocument()
    expect(
      within(soutenanceSelect).getByRole('option', { name: /hors configuration/i })
    ).toBeInTheDocument()
  })
})
