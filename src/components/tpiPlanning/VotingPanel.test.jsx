import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import VotingPanel from './VotingPanel'
import { voteService } from '../../services/coordinationService'

jest.mock('../../services/coordinationService', () => ({
  voteService: {
    respondToVote: jest.fn()
  }
}))

const buildPendingVotes = () => [
  {
    tpi: {
      _id: 'tpi-1',
      reference: 'TPI-2026-001',
      candidat: { firstName: 'Alice', lastName: 'Durand' }
    },
    fixedVoteId: 'vote-fixed',
    fixedSlot: {
      voteId: 'vote-fixed',
      slot: {
        _id: 'slot-fixed',
        date: '2026-06-10T08:00:00.000Z',
        startTime: '08:00',
        endTime: '12:00',
        room: { name: 'A101' }
      }
    },
    slots: [
      {
        voteId: 'vote-fixed',
        slot: {
          _id: 'slot-fixed',
          date: '2026-06-10T08:00:00.000Z',
          startTime: '08:00',
          endTime: '12:00',
          room: { name: 'A101' }
        }
      }
    ],
    proposalOptions: [
      {
        slotId: 'slot-alt-1',
        slot: {
          _id: 'slot-alt-1',
          date: '2026-06-11T08:00:00.000Z',
          startTime: '08:00',
          endTime: '12:00',
          room: { name: 'A102' }
        },
        source: 'planning_option',
        display: {
          isGroupedWindow: true,
          periodLabel: 'Matin',
          timeRangeLabel: '08:00 - 12:00',
          exactTimeLabel: '08:00 - 12:00',
          showExactTime: false
        },
        queue: {
          count: 2,
          capacity: 4,
          nextPosition: 3,
          source: 'votes'
        }
      },
      {
        slotId: 'slot-alt-2',
        slot: {
          _id: 'slot-alt-2',
          date: '2026-06-11T13:00:00.000Z',
          startTime: '13:00',
          endTime: '17:00',
          room: { name: 'B201' }
        },
        source: 'planning_option',
        display: {
          isGroupedWindow: true,
          periodLabel: 'Après-midi',
          timeRangeLabel: '13:00 - 17:00',
          exactTimeLabel: '13:00 - 17:00',
          showExactTime: false
        }
      },
      {
        slotId: 'slot-alt-3',
        slot: {
          _id: 'slot-alt-3',
          date: '2026-06-13T08:00:00.000Z',
          startTime: '08:00',
          endTime: '12:00',
          room: { name: 'B202' }
        },
        source: 'existing_vote'
      },
      {
        slotId: 'slot-alt-4',
        slot: {
          _id: 'slot-alt-4',
          date: '2026-06-14T13:00:00.000Z',
          startTime: '13:00',
          endTime: '17:00',
          room: { name: 'B203' }
        },
        source: 'planning_option'
      }
    ]
  }
]

describe('VotingPanel', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    voteService.respondToVote.mockResolvedValue({
      success: true
    })
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  test('envoie une réponse OK pour la date fixée', async () => {
    render(<VotingPanel pendingVotes={buildPendingVotes()} onVoteSubmitted={jest.fn()} />)

    fireEvent.click(screen.getByText('TPI-2026-001'))
    fireEvent.click(screen.getByRole('button', { name: /^OK/i }))
    fireEvent.click(screen.getByRole('button', { name: /Envoyer ma réponse/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(voteService.respondToVote).toHaveBeenCalledTimes(1)
    expect(voteService.respondToVote).toHaveBeenCalledWith('tpi-1', {
      fixedVoteId: 'vote-fixed',
      mode: 'ok',
      proposedSlotIds: [],
      onlyAvailabilitySlotIds: [],
      hardConstraint: false,
      specialRequest: null
    })
  })

  test('réinitialise propositions et demande spéciale quand on repasse sur OK', async () => {
    render(<VotingPanel pendingVotes={buildPendingVotes()} onVoteSubmitted={jest.fn()} />)

    fireEvent.click(screen.getByText('TPI-2026-001'))
    fireEvent.click(screen.getByRole('button', { name: /^Proposer/i }))
    fireEvent.click(screen.getAllByRole('checkbox', { name: /Matin|Après-midi/i })[0])
    fireEvent.click(screen.getByLabelText(/Ajouter une demande spéciale hors liste/i))
    fireEvent.change(screen.getByLabelText(/Date demandée/i), {
      target: { value: '2026-06-20' }
    })
    fireEvent.change(screen.getByLabelText(/Raison \/ contexte/i), {
      target: { value: 'Déplacement impossible' }
    })

    fireEvent.click(screen.getByRole('button', { name: /^OK/i }))
    fireEvent.click(screen.getByRole('button', { name: /Envoyer ma réponse/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(voteService.respondToVote).toHaveBeenCalledWith('tpi-1', {
      fixedVoteId: 'vote-fixed',
      mode: 'ok',
      proposedSlotIds: [],
      onlyAvailabilitySlotIds: [],
      hardConstraint: false,
      specialRequest: null
    })
  })

  test('permet de proposer jusqu à 3 créneaux', async () => {
    render(<VotingPanel pendingVotes={buildPendingVotes()} onVoteSubmitted={jest.fn()} />)

    fireEvent.click(screen.getByText('TPI-2026-001'))
    fireEvent.click(screen.getByRole('button', { name: /^Proposer/i }))

    expect(screen.getAllByTestId('proposal-day-card')).toHaveLength(3)
    expect(screen.getAllByRole('checkbox', { name: /Matin/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('checkbox', { name: /Après-midi/i }).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Créneau indicatif 13:00 - 17:00/)).not.toBeInTheDocument()
    expect(screen.getByText(/À coordonner/)).toBeInTheDocument()
    expect(screen.getByText(/2\/4/)).toBeInTheDocument()
    expect(screen.getAllByTitle(/2 votes favorables sur 4 places indicatives/).length).toBeGreaterThan(0)

    const proposalInputs = screen.getAllByRole('checkbox', { name: /Matin|Après-midi/i })
    fireEvent.click(proposalInputs[0])
    fireEvent.click(proposalInputs[1])

    expect(screen.getByText(/n°3\/4/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Envoyer ma réponse/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(voteService.respondToVote).toHaveBeenCalledWith('tpi-1', {
      fixedVoteId: 'vote-fixed',
      mode: 'proposal',
      proposedSlotIds: ['slot-alt-1', 'slot-alt-2'],
      onlyAvailabilitySlotIds: [],
      hardConstraint: false,
      specialRequest: null
    })
  })

  test('retire la seule disponibilité si la demi-journée associée est décochée', async () => {
    render(<VotingPanel pendingVotes={buildPendingVotes()} onVoteSubmitted={jest.fn()} />)

    fireEvent.click(screen.getByText('TPI-2026-001'))
    fireEvent.click(screen.getByRole('button', { name: /^Proposer/i }))

    const morning = screen.getByRole('checkbox', { name: /Matin ½ journée/i })
    const afternoon = screen.getByRole('checkbox', { name: /Après-midi ½ journée/i })
    const onlyAvailability = screen.getAllByRole('checkbox', { name: /Seule disponibilité/i })[0]

    expect(onlyAvailability).toBeDisabled()
    fireEvent.click(morning)
    expect(onlyAvailability).not.toBeDisabled()
    fireEvent.click(onlyAvailability)
    expect(onlyAvailability).toBeChecked()

    fireEvent.click(morning)
    expect(onlyAvailability).toBeDisabled()
    expect(onlyAvailability).not.toBeChecked()

    fireEvent.click(afternoon)
    fireEvent.click(screen.getByRole('button', { name: /Envoyer ma réponse/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(voteService.respondToVote).toHaveBeenCalledWith('tpi-1', {
      fixedVoteId: 'vote-fixed',
      mode: 'proposal',
      proposedSlotIds: ['slot-alt-2'],
      onlyAvailabilitySlotIds: [],
      hardConstraint: false,
      specialRequest: null
    })
  })

  test('transmet la seule disponibilité pour une date sélectionnée', async () => {
    render(<VotingPanel pendingVotes={buildPendingVotes()} onVoteSubmitted={jest.fn()} />)

    fireEvent.click(screen.getByText('TPI-2026-001'))
    fireEvent.click(screen.getByRole('button', { name: /^Proposer/i }))

    const firstProposal = screen.getByRole('checkbox', { name: /Matin ½ journée/i })
    fireEvent.click(firstProposal)
    const onlyAvailability = screen.getAllByRole('checkbox', { name: /Seule disponibilité/i })[0]
    expect(onlyAvailability).not.toBeDisabled()
    fireEvent.click(onlyAvailability)
    fireEvent.change(screen.getByLabelText(/Remarque optionnelle/i), {
      target: { value: 'Disponible uniquement ce matin-là' }
    })

    fireEvent.click(screen.getByRole('button', { name: /Envoyer ma réponse/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(voteService.respondToVote).toHaveBeenCalledWith('tpi-1', {
      fixedVoteId: 'vote-fixed',
      mode: 'proposal',
      proposedSlotIds: ['slot-alt-1'],
      onlyAvailabilitySlotIds: ['slot-alt-1'],
      hardConstraint: false,
      remark: 'Disponible uniquement ce matin-là',
      specialRequest: null
    })
  })

  test('affiche une erreur lorsqu on dépasse 3 propositions', () => {
    render(<VotingPanel pendingVotes={buildPendingVotes()} onVoteSubmitted={jest.fn()} />)

    fireEvent.click(screen.getByText('TPI-2026-001'))
    fireEvent.click(screen.getByRole('button', { name: /^Proposer/i }))

    const proposalInputs = screen.getAllByRole('checkbox', { name: /Matin|Après-midi/i })
    fireEvent.click(proposalInputs[0])
    fireEvent.click(proposalInputs[1])
    fireEvent.click(proposalInputs[2])

    expect(screen.getByText(/^3\/3$/)).toBeInTheDocument()

    fireEvent.click(proposalInputs[3])

    expect(screen.getByText(/Maximum 3 créneaux proposés par TPI\./)).toBeInTheDocument()
    expect(screen.getByText(/^3\/3$/)).toBeInTheDocument()
    expect(voteService.respondToVote).not.toHaveBeenCalled()
  })

  test('respecte la limite de propositions fournie par la configuration', () => {
    const pendingVotes = buildPendingVotes().map((group) => ({
      ...group,
      voteSettings: {
        maxProposalsPerTpi: 2,
        allowSpecialRequest: false
      }
    }))

    render(<VotingPanel pendingVotes={pendingVotes} onVoteSubmitted={jest.fn()} />)

    fireEvent.click(screen.getByText('TPI-2026-001'))
    fireEvent.click(screen.getByRole('button', { name: /^Proposer/i }))

    const proposalInputs = screen.getAllByRole('checkbox', { name: /Matin|Après-midi/i })
    fireEvent.click(proposalInputs[0])
    fireEvent.click(proposalInputs[1])

    expect(screen.getByText(/^2\/2$/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Ajouter une demande spéciale hors liste/i)).not.toBeInTheDocument()

    fireEvent.click(proposalInputs[2])

    expect(screen.getByText(/Maximum 2 créneaux proposés par TPI\./)).toBeInTheDocument()
    expect(voteService.respondToVote).not.toHaveBeenCalled()
  })

  test('autorise une demande spéciale avec date et raison', async () => {
    render(<VotingPanel pendingVotes={buildPendingVotes()} onVoteSubmitted={jest.fn()} />)

    fireEvent.click(screen.getByText('TPI-2026-001'))
    fireEvent.click(screen.getByRole('button', { name: /^Proposer/i }))

    fireEvent.click(screen.getByLabelText(/Ajouter une demande spéciale hors liste/i))
    fireEvent.change(screen.getByLabelText(/Date demandée/i), {
      target: { value: '2026-06-20' }
    })
    fireEvent.change(screen.getByLabelText(/Raison \/ contexte/i), {
      target: { value: 'Déplacement impossible avant cette date' }
    })

    fireEvent.click(screen.getByRole('button', { name: /Envoyer ma réponse/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(voteService.respondToVote).toHaveBeenCalledWith('tpi-1', {
      fixedVoteId: 'vote-fixed',
      mode: 'proposal',
      proposedSlotIds: [],
      onlyAvailabilitySlotIds: [],
      hardConstraint: false,
      specialRequest: {
        reason: 'Déplacement impossible avant cette date',
        requestedDate: '2026-06-20'
      }
    })
  })

  test('la demande spéciale hors liste remplace les dates proposées', async () => {
    render(<VotingPanel pendingVotes={buildPendingVotes()} onVoteSubmitted={jest.fn()} />)

    fireEvent.click(screen.getByText('TPI-2026-001'))
    fireEvent.click(screen.getByRole('button', { name: /^Proposer/i }))

    const proposalInputs = screen.getAllByRole('checkbox', { name: /Matin|Après-midi/i })
    fireEvent.click(proposalInputs[0])
    expect(screen.getByText(/^1\/3$/)).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/Ajouter une demande spéciale hors liste/i))
    expect(screen.getByText(/^0\/3$/)).toBeInTheDocument()
    expect(proposalInputs[0]).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Date demandée/i), {
      target: { value: '2026-06-20' }
    })
    fireEvent.change(screen.getByLabelText(/Raison \/ contexte/i), {
      target: { value: 'Besoin d’une date hors liste' }
    })
    fireEvent.click(screen.getByRole('button', { name: /Envoyer ma réponse/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(voteService.respondToVote).toHaveBeenCalledWith('tpi-1', {
      fixedVoteId: 'vote-fixed',
      mode: 'proposal',
      proposedSlotIds: [],
      onlyAvailabilitySlotIds: [],
      hardConstraint: false,
      specialRequest: {
        reason: 'Besoin d’une date hors liste',
        requestedDate: '2026-06-20'
      }
    })
  })

  test('la contrainte dure nettoie les propositions et bloque les options incompatibles', async () => {
    render(<VotingPanel pendingVotes={buildPendingVotes()} onVoteSubmitted={jest.fn()} />)

    fireEvent.click(screen.getByText('TPI-2026-001'))
    fireEvent.click(screen.getByRole('button', { name: /^Proposer/i }))

    const morning = screen.getByRole('checkbox', { name: /Matin ½ journée/i })
    fireEvent.click(morning)
    fireEvent.click(screen.getAllByRole('checkbox', { name: /Seule disponibilité/i })[0])
    expect(screen.getByText(/^1\/3$/)).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/Aucune date proposée ne convient/i))

    expect(screen.getByText(/^0\/3$/)).toBeInTheDocument()
    expect(morning).toBeDisabled()
    expect(screen.queryByLabelText(/Ajouter une demande spéciale hors liste/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Envoyer ma réponse/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(voteService.respondToVote).toHaveBeenCalledWith('tpi-1', {
      fixedVoteId: 'vote-fixed',
      mode: 'proposal',
      proposedSlotIds: [],
      onlyAvailabilitySlotIds: [],
      hardConstraint: true,
      specialRequest: null
    })
  })

  test('autorise une contrainte dure sans autre créneau', async () => {
    render(<VotingPanel pendingVotes={buildPendingVotes()} onVoteSubmitted={jest.fn()} />)

    fireEvent.click(screen.getByText('TPI-2026-001'))
    fireEvent.click(screen.getByRole('button', { name: /^Proposer/i }))
    fireEvent.click(screen.getByLabelText(/Aucune date proposée ne convient/i))
    fireEvent.click(screen.getByRole('button', { name: /Envoyer ma réponse/i }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(voteService.respondToVote).toHaveBeenCalledWith('tpi-1', {
      fixedVoteId: 'vote-fixed',
      mode: 'proposal',
      proposedSlotIds: [],
      onlyAvailabilitySlotIds: [],
      hardConstraint: true,
      specialRequest: null
    })
  })
})
