import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { toast } from 'react-toastify'

import ResolutionProposalPage from './ResolutionProposalPage'
import { resolutionProposalService } from '../../services/planningService'

jest.mock('../../services/planningService', () => ({
  resolutionProposalService: {
    getPublic: jest.fn(),
    respondPublic: jest.fn()
  }
}))

jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn()
  }
}))

function buildProposal(overrides = {}) {
  return {
    id: 'proposal-1',
    year: 2026,
    status: 'sent',
    tpiReference: 'TPI-2026-042',
    candidateName: 'Nora Martin',
    subject: 'Sujet vote',
    proposedSlotLabel: '11.06.2026 · Après-midi · B202',
    message: 'Merci de confirmer.',
    expiresAt: '2026-06-20T08:00:00.000Z',
    recipient: {
      role: 'expert2',
      roleLabel: 'Expert 2',
      name: 'Carla Expert',
      responseStatus: 'pending'
    },
    recipients: [],
    ...overrides
  }
}

function renderPage(path = '/arbitrage-2026/abc-token') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/arbitrage-2026/:token"
          element={<ResolutionProposalPage year={2026} />}
        />
        <Route
          path="/propose-2026/:token"
          element={<ResolutionProposalPage year={2026} />}
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('ResolutionProposalPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('transmet un refus avec raison et proposition éventuelle', async () => {
    const proposal = buildProposal()
    resolutionProposalService.getPublic.mockResolvedValue(proposal)
    resolutionProposalService.respondPublic.mockResolvedValue({
      success: true,
      proposal: buildProposal({
        status: 'rejected',
        recipient: {
          ...proposal.recipient,
          responseStatus: 'rejected',
          responseReason: 'Pas disponible',
          alternativeProposal: 'Plutôt le matin'
        }
      })
    })

    renderPage()

    expect(await screen.findByRole('heading', { name: /TPI-2026-042/i })).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/je refuse/i))
    fireEvent.change(screen.getByLabelText(/raison du refus/i), {
      target: { value: 'Pas disponible' }
    })
    fireEvent.change(screen.getByLabelText(/proposition éventuelle/i), {
      target: { value: 'Plutôt le matin' }
    })
    fireEvent.click(screen.getByRole('button', { name: /envoyer ma réponse/i }))

    await waitFor(() => {
      expect(resolutionProposalService.respondPublic).toHaveBeenCalledWith(
        'abc-token',
        {
          decision: 'rejected',
          reason: 'Pas disponible',
          alternativeProposal: 'Plutôt le matin'
        }
      )
    })
    expect(toast.success).toHaveBeenCalledWith('Réponse transmise.')
  })

  test('affiche une proposition échouée en lecture seule', async () => {
    resolutionProposalService.getPublic.mockResolvedValue(buildProposal({
      status: 'failed'
    }))

    renderPage()

    expect(await screen.findByText(/envoi échoué/i)).toBeInTheDocument()
    expect(screen.getByText(/doit être renvoyée par l’administration/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /envoyer ma réponse/i })).not.toBeInTheDocument()
  })
})
