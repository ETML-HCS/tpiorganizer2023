import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import TpiSoutenance from './TpiSoutenance'
import { useSoutenanceData } from './useSoutenanceData'

jest.mock('./useSoutenanceData', () => ({
  useSoutenanceData: jest.fn()
}))

jest.mock('./TpiSoutenanceRooms', () => () => <div>Rooms</div>)

jest.mock('./TpiSoutenanceParts', () => ({
  MobileMesTpiFilter: () => <div>Mobile mes TPI</div>,
  MobileRoomFilter: () => <div>Mobile salles</div>,
  SoutenanceDesktopHeader: () => <div>Header desktop</div>,
  formatDate: jest.fn(() => '10 juin 2026'),
  getRoomSchedule: jest.fn(() => []),
  renderSchedule: jest.fn(() => <div>Schedule</div>)
}))

describe('TpiSoutenance focus UX', () => {
  beforeEach(() => {
    useSoutenanceData.mockReset()
    window.innerWidth = 1200
  })

  test('affiche une bannière de focus et un état vide explicite quand aucune soutenance ne correspond', async () => {
    useSoutenanceData.mockReturnValue({
      token: '',
      magicLinkViewer: null,
      soutenanceData: [],
      expertOrBoss: null,
      listOfExpertsOrBoss: [],
      isLoading: false,
      error: null,
      filters: {
        site: '',
        date: '',
        reference: '2163',
        candidate: '',
        experts: '',
        projectManagerButton: '',
        projectManager: '',
        nameRoom: ''
      },
      filteredData: [],
      uniqueSalles: [],
      uniqueDates: [],
      uniqueSites: [],
      uniqueCandidates: [],
      uniqueExperts: [],
      uniqueProjectManagers: [],
      loadData: jest.fn(),
      updateFilter: jest.fn(),
      updateSoutenanceData: jest.fn(),
      schedule: [],
      displayedSchedule: [],
      isFilterApplied: true
    })

    render(
      <MemoryRouter initialEntries={['/Soutenances/2026?focus=2163']}>
        <Routes>
          <Route path='/Soutenances/:year' element={<TpiSoutenance />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/focus actif: 2163/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/aucune soutenance à afficher/i)).toBeInTheDocument()
    expect(screen.getByText(/la référence 2163 n'est pas visible/i)).toBeInTheDocument()
  })

  test('permet d effacer le focus courant', async () => {
    const updateFilter = jest.fn()

    useSoutenanceData.mockReturnValue({
      token: '',
      magicLinkViewer: null,
      soutenanceData: [
        {
          site: 'ETML',
          date: '2026-06-10',
          name: 'A101',
          tpiDatas: [{ refTpi: '2163', candidat: 'Alice' }]
        }
      ],
      expertOrBoss: null,
      listOfExpertsOrBoss: [],
      isLoading: false,
      error: null,
      filters: {
        site: '',
        date: '',
        reference: '2163',
        candidate: '',
        experts: '',
        projectManagerButton: '',
        projectManager: '',
        nameRoom: ''
      },
      filteredData: [
        {
          site: 'ETML',
          date: '2026-06-10',
          name: 'A101',
          tpiDatas: [{ refTpi: '2163', candidat: 'Alice' }]
        }
      ],
      uniqueSalles: [],
      uniqueDates: [],
      uniqueSites: [],
      uniqueCandidates: [],
      uniqueExperts: [],
      uniqueProjectManagers: [],
      loadData: jest.fn(),
      updateFilter,
      updateSoutenanceData: jest.fn(),
      schedule: [],
      displayedSchedule: [],
      isFilterApplied: true
    })

    render(
      <MemoryRouter initialEntries={['/Soutenances/2026?focus=2163']}>
        <Routes>
          <Route path='/Soutenances/:year' element={<TpiSoutenance />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /effacer le focus/i }))

    expect(updateFilter).toHaveBeenCalledWith('reference', '')
  })
})
