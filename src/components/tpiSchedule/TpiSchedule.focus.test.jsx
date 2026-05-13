import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TpiSchedule from './TpiSchedule'

jest.mock('react-dnd', () => {
  const React = require('react')

  return {
    DndProvider: ({ children }) => React.createElement(
      'div',
      { 'data-testid': 'dnd-provider' },
      children
    ),
    useDrag: () => [{ isDragging: false }, jest.fn()]
  }
})

jest.mock('react-dnd-html5-backend', () => ({
  HTML5Backend: jest.fn()
}))

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
  publishSoutenancesFromPlanification: jest.fn(),
  publishSoutenancesFromPlanning: jest.fn(),
  transmitToDatabase: jest.fn(() => Promise.resolve(true))
}))

jest.mock('../../services/coordinationService', () => ({
  workflowCoordinationService: {},
  coordinationCatalogService: {
    getGlobal: jest.fn(() => Promise.resolve(null))
  },
  coordinationConfigService: {
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

  test('demande le plein écran natif quand le focus est activé', async () => {
    const hadRequestFullscreen = Object.prototype.hasOwnProperty.call(
      HTMLElement.prototype,
      'requestFullscreen'
    )
    const originalRequestFullscreenDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'requestFullscreen'
    )
    const requestFullscreen = jest.fn(() => Promise.resolve())

    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen
    })

    try {
      render(
        <MemoryRouter initialEntries={['/planification']}>
          <TpiSchedule />
        </MemoryRouter>
      )

      expect(await screen.findByTestId('mock-toolbar')).toBeInTheDocument()

      fireEvent.click(screen.getByTestId('mock-focus-toggle'))

      await waitFor(() => {
        expect(requestFullscreen).toHaveBeenCalledTimes(1)
      })

      expect(requestFullscreen.mock.instances[0]).toHaveClass('planning-schedule-page')
    } finally {
      if (hadRequestFullscreen) {
        Object.defineProperty(
          HTMLElement.prototype,
          'requestFullscreen',
          originalRequestFullscreenDescriptor
        )
      } else {
        delete HTMLElement.prototype.requestFullscreen
      }
    }
  })

  test('quitte le plein écran natif avec Escape', async () => {
    const hadRequestFullscreen = Object.prototype.hasOwnProperty.call(
      HTMLElement.prototype,
      'requestFullscreen'
    )
    const hadExitFullscreen = Object.prototype.hasOwnProperty.call(
      document,
      'exitFullscreen'
    )
    const hadFullscreenElement = Object.prototype.hasOwnProperty.call(
      document,
      'fullscreenElement'
    )
    const originalRequestFullscreenDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'requestFullscreen'
    )
    const originalExitFullscreenDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'exitFullscreen'
    )
    const originalFullscreenElementDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'fullscreenElement'
    )
    let activeFullscreenElement = null
    const requestFullscreen = jest.fn(function requestFullscreenMock() {
      activeFullscreenElement = this
      document.dispatchEvent(new Event('fullscreenchange'))
      return Promise.resolve()
    })
    const exitFullscreen = jest.fn(() => {
      activeFullscreenElement = null
      document.dispatchEvent(new Event('fullscreenchange'))
      return Promise.resolve()
    })

    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen
    })
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreen
    })
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => activeFullscreenElement
    })

    try {
      render(
        <MemoryRouter initialEntries={['/planification']}>
          <TpiSchedule />
        </MemoryRouter>
      )

      expect(await screen.findByTestId('mock-toolbar')).toBeInTheDocument()

      fireEvent.click(screen.getByTestId('mock-focus-toggle'))

      await waitFor(() => {
        expect(requestFullscreen).toHaveBeenCalledTimes(1)
      })

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })

      await waitFor(() => {
        expect(exitFullscreen).toHaveBeenCalledTimes(1)
      })
      await waitFor(() => {
        expect(screen.getByTestId('mock-toolbar')).toBeInTheDocument()
      })
    } finally {
      if (hadRequestFullscreen) {
        Object.defineProperty(
          HTMLElement.prototype,
          'requestFullscreen',
          originalRequestFullscreenDescriptor
        )
      } else {
        delete HTMLElement.prototype.requestFullscreen
      }

      if (hadExitFullscreen) {
        Object.defineProperty(
          document,
          'exitFullscreen',
          originalExitFullscreenDescriptor
        )
      } else {
        delete document.exitFullscreen
      }

      if (hadFullscreenElement) {
        Object.defineProperty(
          document,
          'fullscreenElement',
          originalFullscreenElementDescriptor
        )
      } else {
        delete document.fullscreenElement
      }
    }
  })
})
