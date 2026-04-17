import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TpiSchedule from './TpiSchedule'

jest.mock('./TpiScheduleButtons', () => {
  return function MockTpiScheduleButtons({
    isRoomsFocusMode,
    isRoomsWrapMode,
    onToggleRoomsFocusMode,
    onToggleRoomsWrapMode
  }) {
    return (
      <div data-testid="mock-toolbar">
        <button type="button" data-testid="mock-focus-toggle" onClick={onToggleRoomsFocusMode}>
          focus
        </button>
        <button type="button" data-testid="mock-wrap-toggle" onClick={onToggleRoomsWrapMode}>
          wrap
        </button>
        <div data-testid="mock-toolbar-state">
          {`focus:${isRoomsFocusMode ? 'on' : 'off'} wrap:${isRoomsWrapMode ? 'on' : 'off'}`}
        </div>
      </div>
    )
  }
})

jest.mock('./DateRoom', () => {
  return function MockDateRoom() {
    return <div data-testid="mock-date-room" />
  }
})

jest.mock('../Tools', () => ({
  showNotification: jest.fn()
}))

jest.mock('../tpiControllers/TpiController', () => ({
  getTpiModels: jest.fn(() => Promise.resolve([]))
}))

jest.mock('../tpiControllers/TpiRoomsController', () => ({
  createTpiCollectionForYear: jest.fn(),
  publishSoutenancesFromPlanning: jest.fn(),
  transmitToDatabase: jest.fn(() => Promise.resolve(true))
}))

jest.mock('../../services/planningService', () => ({
  workflowPlanningService: {},
  planningCatalogService: {
    getGlobal: jest.fn(() => Promise.resolve(null))
  },
  planningConfigService: {
    getByYear: jest.fn(() => Promise.resolve(null))
  },
  personService: {
    getAll: jest.fn(() => Promise.resolve([]))
  }
}))

describe('TpiSchedule focus mode', () => {
  test('cache les barres, force le wrap et se ferme avec Escape', async () => {
    render(
      <MemoryRouter initialEntries={['/planification']}>
        <TpiSchedule />
      </MemoryRouter>
    )

    expect(await screen.findByTestId('mock-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('mock-toolbar-state')).toHaveTextContent('focus:off wrap:off')

    fireEvent.click(screen.getByTestId('mock-focus-toggle'))

    await waitFor(() => {
      expect(screen.queryByTestId('mock-toolbar')).not.toBeInTheDocument()
    })

    const page = document.querySelector('.planning-schedule-page')
    expect(document.body).toHaveClass('planning-focus-mode')
    expect(page).toHaveClass('planning-schedule-page--focus')
    expect(page).toHaveClass('planning-schedule-page--wrap')

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })

    await waitFor(() => {
      expect(screen.getByTestId('mock-toolbar')).toBeInTheDocument()
    })

    expect(screen.getByTestId('mock-toolbar-state')).toHaveTextContent('focus:off wrap:off')
    expect(document.body).not.toHaveClass('planning-focus-mode')
    expect(page).not.toHaveClass('planning-schedule-page--focus')
    expect(page).not.toHaveClass('planning-schedule-page--wrap')
  })
})
