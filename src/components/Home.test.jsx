import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import Home from './Home'
import { STORAGE_KEYS, YEARS_CONFIG } from '../config/appConfig'
import * as coordinationServices from '../services/coordinationService'

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

jest.mock('../config/appConfig', () => {
  const actual = jest.requireActual('../config/appConfig')
  return {
    ...actual,
    IS_DEBUG: true
  }
})

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid='location-display'>{`${location.pathname}${location.search}`}</div>
}

describe('Home', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('redirige le raccourci planification vers la page de planification de l année active', async () => {
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
          <Route path='/coordination/:year' element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    )

    const yearSelect = screen.getByLabelText(/année active/i)
    expect(yearSelect).toHaveValue(targetYear)

    fireEvent.click(screen.getByRole('button', { name: /planification/i }))

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        `/planification?year=${targetYear}`
      )
    })

    expect(window.localStorage.getItem(STORAGE_KEYS.COORDINATION_SELECTED_YEAR)).toBe(targetYear)
  })

  test('redirige le raccourci coordination vers le dashboard votes de l année active', async () => {
    const currentYear = YEARS_CONFIG.getCurrentYear()
    const targetYear = String(
      YEARS_CONFIG.getAvailableYears().find((year) => year !== currentYear) || currentYear
    )

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
          <Route path='/coordination/:year' element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/année active/i), {
      target: { value: targetYear }
    })

    fireEvent.click(screen.getByRole('button', { name: /^Coordination/i }))

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(`/coordination/${targetYear}`)
    })

    expect(window.localStorage.getItem(STORAGE_KEYS.COORDINATION_SELECTED_YEAR)).toBe(targetYear)
  })

  test('redirige le raccourci défenses vers l année courante par défaut', async () => {
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
          <Route path='/defenses/:year' element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    )

    const yearSelect = screen.getByLabelText(/année active/i)
    expect(yearSelect).toHaveValue(targetYear)

    fireEvent.click(screen.getByRole('link', { name: /^Défenses\b/i }))

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        `/defenses/${targetYear}`
      )
    })
  })

  test("ouvre le module liens d'accès sans paramètre d'année", async () => {
    const currentYear = YEARS_CONFIG.getCurrentYear()
    const targetYear = String(
      YEARS_CONFIG.getAvailableYears().find((year) => year !== currentYear) || currentYear
    )

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
          <Route path='/acces-liens' element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/année active/i), {
      target: { value: targetYear }
    })

    fireEvent.click(screen.getByRole('link', { name: /liens d'accès/i }))

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/acces-liens'
      )
    })
  })

  test("passe l'année active aux modules d'administration", async () => {
    const currentYear = YEARS_CONFIG.getCurrentYear()
    const targetYear = String(
      YEARS_CONFIG.getAvailableYears().find((year) => year !== currentYear) || currentYear
    )

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
          <Route path='/gestion-tpi' element={<LocationDisplay />} />
          <Route path='/parties-prenantes' element={<LocationDisplay />} />
          <Route path='/evaluation' element={<LocationDisplay />} />
          <Route path='/configuration' element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/année active/i), {
      target: { value: targetYear }
    })

    fireEvent.click(screen.getByRole('link', { name: /gestion tpi/i }))

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        `/gestion-tpi?year=${targetYear}`
      )
    })
  })

  test('laisse les actions de test vote disponibles sans verrou de phase', async () => {
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
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: /liens de vote/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /emails vote/i })).toBeEnabled()
  })

  test('ouvre le mode test vote depuis l accueil debug', async () => {
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
        </Routes>
      </MemoryRouter>
    )

    const voteTestButton = screen.getByRole('button', { name: /emails vote/i })

    fireEvent.click(voteTestButton)

    expect(await screen.findByRole('dialog', { name: /test des votes/i })).toBeInTheDocument()
  })
})
