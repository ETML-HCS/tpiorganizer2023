import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import PlanningCalendar from './PlanningCalendar'
import { schedulingService } from '../../services/planningService'

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
    getAvailability: jest.fn(),
    assignSlot: jest.fn()
  }
}))

describe('PlanningCalendar', () => {
  beforeEach(() => {
    schedulingService.getAvailability.mockResolvedValue([])
  })

  afterEach(() => {
    jest.clearAllMocks()
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
      expect(schedulingService.getAvailability).toHaveBeenCalled()
    })

    expect(schedulingService.getAvailability).toHaveBeenCalledWith(2026, 'tpi-1')
  })

  test('affiche la couleur et le badge du site pour une room du calendrier', () => {
    const calendarData = [
      {
        date: '2026-06-10',
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

    render(
      <PlanningCalendar
        calendarData={calendarData}
        tpis={[]}
        selectedTpi={null}
        onSelectTpi={jest.fn()}
        onDragDrop={jest.fn()}
        isAdmin={false}
        year="2026"
        planningCatalogSites={[
          {
            id: 'site-etml',
            code: 'ETML',
            label: 'ETML',
            planningColor: '#14532d',
            roomDetails: [
              {
                id: 'room-a101',
                code: 'A101',
                label: 'A101'
              }
            ]
          }
        ]}
      />
    )

    const rowHeader = screen.getAllByText('A101')[0].closest('.row-header')
    expect(rowHeader).not.toBeNull()
    expect(within(rowHeader).getByText('ETML')).toBeInTheDocument()
    expect(rowHeader.style.getPropertyValue('--planning-room-accent')).toBe('#14532D')
  })
})
