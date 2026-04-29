import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import Home from './Home'
import { STORAGE_KEYS, YEARS_CONFIG } from '../config/appConfig'
import * as planningServices from '../services/planningService'

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
  return <div data-testid='location-display'>{location.pathname}</div>
}

describe('Home', () => {
  beforeEach(() => {
    window.localStorage.clear()
    jest.spyOn(planningServices.workflowPlanningService, 'getYearState').mockResolvedValue({
      state: 'planning'
    })
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
          <Route path='/planning/:year' element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    )

    const yearSelect = screen.getByLabelText(/année active/i)
    expect(yearSelect).toHaveValue(targetYear)

    fireEvent.click(screen.getByRole('button', { name: /planification/i }))

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/planification')
    })

    expect(window.localStorage.getItem(STORAGE_KEYS.PLANNING_SELECTED_YEAR)).toBe(targetYear)
  })

  test('redirige le raccourci planning vers le dashboard votes de l année active', async () => {
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
          <Route path='/planning/:year' element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/année active/i), {
      target: { value: targetYear }
    })

    fireEvent.click(screen.getByRole('button', { name: /^Planning/i }))

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(`/planning/${targetYear}`)
    })

    expect(window.localStorage.getItem(STORAGE_KEYS.PLANNING_SELECTED_YEAR)).toBe(targetYear)
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

  test('désactive les actions de vote tant que les votes ne sont pas ouverts', async () => {
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
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(planningServices.workflowPlanningService.getYearState).toHaveBeenCalledWith(targetYear)
      expect(screen.getByRole('button', { name: /liens de vote/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /emails vote/i })).toBeDisabled()
    })

    expect(screen.getAllByText(/votes ouverts uniquement/i)).toHaveLength(2)
  })

  test('autorise le mode test vote quand les votes sont ouverts', async () => {
    const targetYear = String(YEARS_CONFIG.getCurrentYear())
    planningServices.workflowPlanningService.getYearState.mockResolvedValueOnce({
      state: 'voting_open'
    })

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

    await waitFor(() => {
      expect(planningServices.workflowPlanningService.getYearState).toHaveBeenCalledWith(targetYear)
      expect(screen.getByRole('button', { name: /emails vote/i })).toBeEnabled()
    })

    const voteTestButton = screen.getByRole('button', { name: /emails vote/i })

    fireEvent.click(voteTestButton)

    expect(await screen.findByRole('dialog', { name: /test des votes/i })).toBeInTheDocument()
  })
})
