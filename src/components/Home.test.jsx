import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import Home from './Home'
import { STORAGE_KEYS, YEARS_CONFIG } from '../config/appConfig'

jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    loading: jest.fn(),
    update: jest.fn()
  }
}))

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid='location-display'>{location.pathname}</div>
}

describe('Home', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test('redirige le raccourci planification vers la page de planification de l année choisie', async () => {
    const targetYear = String(YEARS_CONFIG.getCurrentYear())

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path='/'
            element={
              <>
                <Home />
                <LocationDisplay />
              </>
            }
          />
          <Route path='/planification' element={<LocationDisplay />} />
          <Route path='/planning/:year' element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /planification/i }))

    const yearSelect = await screen.findByLabelText(/sélection de l'année/i)
    expect(yearSelect).toHaveValue(targetYear)

    fireEvent.click(screen.getByRole('button', { name: /^ouvrir$/i }))

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/planification')
    })

    expect(window.localStorage.getItem(STORAGE_KEYS.PLANNING_SELECTED_YEAR)).toBe(targetYear)
  })

  test('redirige le raccourci planning vers le dashboard votes de l année choisie', async () => {
    const targetYear = String(YEARS_CONFIG.getCurrentYear())

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path='/'
            element={
              <>
                <Home />
                <LocationDisplay />
              </>
            }
          />
          <Route path='/planning/:year' element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /^Planning/i }))

    const yearSelect = await screen.findByLabelText(/sélection de l'année/i)
    expect(yearSelect).toHaveValue(targetYear)

    fireEvent.click(screen.getByRole('button', { name: /^ouvrir$/i }))

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(`/planning/${targetYear}`)
    })
  })

  test('redirige le raccourci soutenances vers l année courante par défaut', async () => {
    const targetYear = String(YEARS_CONFIG.getCurrentYear())

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path='/'
            element={
              <>
                <Home />
                <LocationDisplay />
              </>
            }
          />
          <Route path='/Soutenances/:year' element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /^soutenances consulter/i }))

    const yearSelect = await screen.findByLabelText(/sélection de l'année/i)
    expect(yearSelect).toHaveValue(targetYear)

    fireEvent.click(screen.getByRole('button', { name: /^ouvrir$/i }))

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        `/Soutenances/${targetYear}`
      )
    })
  })
})
