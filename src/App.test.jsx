import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

import App from './App'
import { STORAGE_KEYS } from './config/appConfig'
import { authService } from './services/apiService'

jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn()
  }
}))

jest.mock('./components/footer/Footer', () => function MockFooter() {
  return <footer data-testid='footer' />
})

jest.mock('./components/LoadingPage', () => function MockLoadingPage() {
  return <div data-testid='loading-page'>TPI Organizer</div>
})

jest.mock('./components/tpiSchedule/TpiSchedule', () => function MockTpiSchedule({ isArrowUp }) {
  return <div data-testid='tpi-schedule'>planification {isArrowUp ? 'open' : 'closed'}</div>
})

jest.mock('./components/tpiPlanning/PlanningDashboard', () => function MockPlanningDashboard({ isAdmin }) {
  return <div data-testid='planning-dashboard'>coordination {isAdmin ? 'admin' : 'magic'}</div>
})

jest.mock('./components/tpiSoutenance/TpiSoutenance', () => function MockTpiSoutenance() {
  return <div data-testid='soutenance-page'>Défenses</div>
})

jest.mock('./components/tpiEval/TpiEval', () => function MockTpiEval() {
  return <div data-testid='tpi-eval-page'>Evaluation</div>
})

jest.mock('./services/apiService', () => ({
  authService: {
    startSession: jest.fn(),
    login: jest.fn()
  }
}))

jest.mock('./services/coordinationService', () => ({
  authCoordinationService: {
    getCurrentUser: jest.fn(() => null),
    clearSession: jest.fn()
  }
}))

const createSessionToken = (payload = {}) => {
  const encodeBase64Url = (value) =>
    window.btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

  return [
    encodeBase64Url({ alg: 'HS256', typ: 'JWT' }),
    encodeBase64Url({
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'admin',
      ...payload
    }),
    'signature'
  ].join('.')
}

describe('App routing access', () => {
  beforeEach(() => {
    window.localStorage.clear()
    authService.startSession.mockReset()
    authService.startSession.mockResolvedValue({
      success: true,
      token: createSessionToken()
    })
  })

  test('opens modules without showing a login form', async () => {
    window.history.pushState({}, '', '/TpiEval')

    render(<App />)

    expect(await screen.findByTestId('tpi-eval-page')).toBeInTheDocument()
    expect(screen.queryByTestId('loading-page')).not.toBeInTheDocument()
  })

  test('starts the planification tools collapsed by default', async () => {
    window.localStorage.setItem(STORAGE_KEYS.APP_SESSION_TOKEN, createSessionToken())
    window.history.pushState({}, '', '/planification')

    render(<App />)

    expect(await screen.findByTestId('tpi-schedule')).toHaveTextContent('planification closed')
    expect(screen.getByRole('button', { name: 'Afficher les outils' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })

  test('keeps vote and défense magic-link pages accessible without an admin session', async () => {
    window.history.pushState({}, '', '/coordination/2026?ml=test-token')

    const { unmount } = render(<App />)

    expect(await screen.findByTestId('planning-dashboard')).toHaveTextContent('coordination magic')
    unmount()

    window.history.pushState({}, '', '/defenses/2026?ml=test-token')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('soutenance-page')).toBeInTheDocument()
    })
  })

  test('opens defense pages without admin login, code or magic link', async () => {
    window.history.pushState({}, '', '/defenses/2026')

    render(<App />)

    expect(await screen.findByTestId('soutenance-page')).toBeInTheDocument()
  })

  test('redirects legacy défense URLs to the canonical defenses URL', async () => {
    window.history.pushState({}, '', '/Soutenances/2026?ml=test-token')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('soutenance-page')).toBeInTheDocument()
      expect(window.location.pathname).toBe('/defenses/2026')
      expect(window.location.search).toBe('?ml=test-token')
    })
  })
})
