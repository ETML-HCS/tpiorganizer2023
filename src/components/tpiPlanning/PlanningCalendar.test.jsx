import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import PlanningCalendar from './PlanningCalendar'

jest.mock('../shared/InlineIcons', () => {
  const React = require('react')

  const MockIcon = ({ className = '' }) => <span className={className} />

  return {
    AlertIcon: MockIcon,
    CalendarIcon: MockIcon,
    CandidateIcon: MockIcon,
    CheckIcon: MockIcon,
    DocumentIcon: MockIcon,
    DragIcon: MockIcon,
    RoomIcon: MockIcon
  }
})

jest.mock('../../services/planningService', () => ({
  schedulingService: {
    assignSlot: jest.fn()
  }
}))

jest.mock('../../utils/storage', () => ({
  getStoredAuthToken: jest.fn(() => null)
}))

describe('PlanningCalendar', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => []
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete global.fetch
  })

  test('utilise l annee de la route pour charger les disponibilites', async () => {
    const calendarData = [
      {
        date: '2024-06-10',
        rooms: {
          A101: [
            {
              id: 'slot-1',
              period: 'matin',
              status: 'available',
              startTime: '08:00'
            }
          ]
        }
      }
    ]

    const tpis = [
      {
        _id: 'tpi-1',
        reference: 'TPI-2026-001',
        candidat: { firstName: 'Alice', lastName: 'Durand' },
        status: 'draft'
      }
    ]

    render(
      <PlanningCalendar
        calendarData={calendarData}
        tpis={tpis}
        selectedTpi={null}
        onSelectTpi={jest.fn()}
        onDragDrop={jest.fn()}
        isAdmin
        year="2026"
      />
    )

    fireEvent.dragStart(screen.getByText('TPI-2026-001'), {
      dataTransfer: {
        effectAllowed: '',
        setData: jest.fn()
      }
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    expect(global.fetch.mock.calls[0][0]).toContain(
      '/planning/availability/2026/tpi-1'
    )
  })
})
