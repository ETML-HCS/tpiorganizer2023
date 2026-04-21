import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ConflictResolver from './ConflictResolver'
import { tpiPlanningService } from '../../services/planningService'

jest.mock('../shared/InlineIcons', () => {
  const React = require('react')

  const MockIcon = ({ className = '' }) => <span className={className} />

  return {
    AlertIcon: MockIcon,
    BanIcon: MockIcon,
    CalendarIcon: MockIcon,
    CandidateIcon: MockIcon,
    CheckIcon: MockIcon,
    ChevronDownIcon: MockIcon,
    ChevronRightIcon: MockIcon,
    CloseIcon: MockIcon,
    DocumentIcon: MockIcon,
    ExpertIcon: MockIcon,
    ProjectLeadIcon: MockIcon,
    QuestionIcon: MockIcon,
    RoomIcon: MockIcon,
    TimeIcon: MockIcon,
    WrenchIcon: MockIcon
  }
})

jest.mock('../../services/planningService', () => ({
  tpiPlanningService: {
    resendVotes: jest.fn()
  }
}))

const buildConflict = () => ({
  _id: '507f1f77bcf86cd799439011',
  reference: 'TPI-2026-001',
  candidat: { firstName: 'Alice', lastName: 'Durand' },
  expert1: { firstName: 'Bob', lastName: 'Expert' },
  expert2: { firstName: 'Carla', lastName: 'Expert' },
  chefProjet: { firstName: 'Diane', lastName: 'Boss' },
  votingSession: {
    votes: [
      {
        slot: 'slot-1',
        voterName: 'Bob Expert',
        voterRole: 'expert1',
        decision: 'accepted',
        comment: ''
      }
    ]
  },
  proposedSlots: [
    {
      slot: {
        _id: 'slot-1',
        date: '2026-06-10T08:00:00.000Z',
        startTime: '08:00',
        room: { name: 'A101' }
      }
    }
  ]
})

describe('ConflictResolver', () => {
  beforeEach(() => {
    tpiPlanningService.resendVotes.mockResolvedValue({ emailsSent: 3 })
    const alertMock = jest.fn()
    global.alert = alertMock
    window.alert = alertMock
  })

  afterEach(() => {
    jest.clearAllMocks()
    delete window.alert
    delete global.alert
  })

  test('ne plante pas au premier rendu avant la sélection d un conflit', () => {
    render(
      <ConflictResolver
        conflicts={[buildConflict()]}
        calendarData={[]}
        onForceSlot={jest.fn()}
        onReload={jest.fn()}
      />
    )

    expect(screen.getByText('TPI-2026-001')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Renvoyer les demandes de vote/i })).toBeNull()
  })

  test('renvoie les votes via le service de planification central', async () => {
    render(
      <ConflictResolver
        conflicts={[buildConflict()]}
        calendarData={[]}
        onForceSlot={jest.fn()}
        onReload={jest.fn()}
      />
    )

    fireEvent.click(screen.getByText('TPI-2026-001'))
    fireEvent.click(screen.getByRole('button', { name: /Renvoyer les demandes de vote/i }))

    await waitFor(() => {
      expect(tpiPlanningService.resendVotes).toHaveBeenCalledWith('507f1f77bcf86cd799439011')
    })

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        'Demandes de vote renvoyées avec succès (3 emails envoyés)'
      )
    })
  })
})
