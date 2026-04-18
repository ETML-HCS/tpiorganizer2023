import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import RenderRooms from './TpiSoutenanceRooms'

jest.mock('./CreneauPropositionPopup', () => () => null)
jest.mock('./TpiSoutenanceActionButtons', () => () => null)

describe('TpiSoutenanceRooms', () => {
  test('ajoute un accès secondaire vers la fiche TPI publiée', () => {
    render(
      <MemoryRouter>
        <RenderRooms
          year={2026}
          tpiDatas={[
            {
              site: 'ETML',
              date: '2026-06-10',
              name: 'A101',
              tpiDatas: [
                {
                  id: 'tpi-1',
                  refTpi: '2163',
                  candidat: 'Alice Martin',
                  expert1: { name: 'Expert 1' },
                  expert2: { name: 'Expert 2' },
                  boss: { name: 'Chef de projet' }
                }
              ]
            }
          ]}
          schedule={[
            {
              startTime: '08:00',
              endTime: '09:00'
            }
          ]}
          listOfPerson={[
            { name: 'Expert 1', token: 'exp-1' },
            { name: 'Expert 2', token: 'exp-2' },
            { name: 'Chef de projet', token: 'cdp-1' }
          ]}
          isAnyFilterApplied={false}
          loadData={jest.fn()}
          token=''
          isOn={false}
          updateSoutenanceData={jest.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: /fiche/i })).toHaveAttribute('href', '/tpi/2026/2163')
  })
})
