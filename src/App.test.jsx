import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

import App from './App'

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

jest.mock('./components/LoginPage', () => function MockLoginPage() {
  return <div data-testid='login-page'>Login</div>
})

jest.mock('./components/tpiPlanning/PlanningDashboard', () => function MockPlanningDashboard({ isAdmin }) {
  return <div data-testid='planning-dashboard'>planning {isAdmin ? 'admin' : 'magic'}</div>
})

jest.mock('./components/tpiSoutenance/TpiSoutenance', () => function MockTpiSoutenance() {
  return <div data-testid='soutenance-page'>Défenses</div>
})

jest.mock('./components/tpiEval/TpiEval', () => function MockTpiEval() {
  return <div data-testid='tpi-eval-page'>Evaluation</div>
})

jest.mock('./services/apiService', () => ({
  authService: {
    login: jest.fn()
  }
}))

jest.mock('./services/planningService', () => ({
  authPlanningService: {
    getCurrentUser: jest.fn(() => null),
    clearSession: jest.fn()
  }
}))

describe('App routing access', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test('blocks modules for unauthenticated stakeholders', async () => {
    window.history.pushState({}, '', '/TpiEval')

    render(<App />)

    expect(await screen.findByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('tpi-eval-page')).not.toBeInTheDocument()
  })

  test('keeps vote and défense magic-link pages accessible without an admin session', async () => {
    window.history.pushState({}, '', '/planning/2026?ml=test-token')

    const { unmount } = render(<App />)

    expect(await screen.findByTestId('planning-dashboard')).toHaveTextContent('planning magic')
    unmount()

    window.history.pushState({}, '', '/defenses/2026?ml=test-token')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('soutenance-page')).toBeInTheDocument()
    })
  })

  test('blocks défense pages without admin session, code or magic link', async () => {
    window.history.pushState({}, '', '/defenses/2026')

    render(<App />)

    expect(await screen.findByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('soutenance-page')).not.toBeInTheDocument()
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
