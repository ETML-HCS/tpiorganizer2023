import React, { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TpiCard from './TpiCard'

jest.mock('react-dnd', () => ({
  useDrag: () => [{ isDragging: false }, jest.fn()]
}))

const baseTpi = {
  refTpi: 'TPI-000',
  candidat: 'Candidat courant',
  expert1: { name: 'Exp 1', offres: { submit: [] } },
  expert2: { name: 'Exp 2', offres: { submit: [] } },
  boss: { name: 'Boss', offres: { submit: [] } }
}

const roomProps = {
  isEditingTpiCard: true,
  roomSite: 'ETML',
  roomName: 'Sébeillon-N501',
  roomDate: '2026-06-10',
  soutenanceDates: [{ date: '2026-06-10', classes: ['MATU', 'M'] }]
}

function TpiCardHarness({ initialTpi = baseTpi }) {
  const [currentTpi, setCurrentTpi] = useState(initialTpi)

  return (
    <TpiCard
      tpi={currentTpi}
      onUpdateTpi={setCurrentTpi}
      {...roomProps}
    />
  )
}

const renderWithRouter = (ui) => render(
  <MemoryRouter>
    {ui}
  </MemoryRouter>
)

describe('TpiCard editing overlay', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ([
        {
          refTpi: 'TPI-001',
          candidat: 'Alice Martin',
          classe: 'MIN4',
          sujet: 'Projet A',
          experts: { 1: 'Expert 1', 2: 'Expert 2' },
          boss: 'Chef'
        },
        {
          refTpi: 'TPI-002',
          candidat: 'Bob Dupont',
          classe: 'DEV4',
          sujet: 'Projet B',
          experts: { 1: 'Expert 3', 2: 'Expert 4' },
          boss: 'Chef'
        }
      ])
    }))
  })

  afterEach(() => {
    delete global.fetch
  })

  it('opens the selector without crashing and starts loading models', async () => {
    renderWithRouter(
      <TpiCard
        tpi={baseTpi}
        onUpdateTpi={jest.fn()}
        {...roomProps}
      />
    )

    await screen.findByRole('button', { name: /⌕/ })

    fireEvent.click(screen.getByRole('button', { name: /⌕/ }))

    expect(await screen.findByRole('dialog', { name: /Sélectionner un TPI/i })).toBeInTheDocument()
    expect(screen.getByText(/Salle MATU/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Rechercher par ref, nom, classe ou sujet/i)).toHaveFocus()
  })

  it('retire un TPI de la liste après attribution', async () => {
    renderWithRouter(<TpiCardHarness />)

    await screen.findByRole('button', { name: /⌕/ })

    fireEvent.click(screen.getByRole('button', { name: /⌕/ }))

    expect(await screen.findByRole('dialog', { name: /Sélectionner un TPI/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /TPI-001/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /TPI-001/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Sélectionner un TPI/i })).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /⌕/ }))

    expect(await screen.findByRole('dialog', { name: /Sélectionner un TPI/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /TPI-001/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Aucun TPI ne correspond à cette recherche/i)).toBeInTheDocument()
  })

  it('affiche un cadre rouge quand la carte porte une erreur de validation', async () => {
    renderWithRouter(
      <TpiCard
        tpi={baseTpi}
        onUpdateTpi={jest.fn()}
        hasValidationError
        validationErrorMessages={['Ada Lovelace est affecté à plusieurs TPI sur le même créneau.']}
        {...roomProps}
        isEditingTpiCard={false}
      />
    )

    expect(await screen.findByText(/Candidat courant/i)).toBeInTheDocument()
    expect(screen.getByRole('article', { name: /TPI/i })).toHaveClass('has-validation-error')
  })

  it('affiche les identifiants des parties prenantes dans la vue 0', async () => {
    renderWithRouter(
      <TpiCard
        tpi={{
          ...baseTpi,
          candidatPersonId: 'cand-001',
          expert1: { name: 'Exp 1', personId: 'exp-001', offres: { submit: [] } },
          expert2: { name: 'Exp 2', personId: 'exp-002', offres: { submit: [] } },
          boss: { name: 'Boss', personId: 'cdp-001', offres: { submit: [] } }
        }}
        onUpdateTpi={jest.fn()}
        {...roomProps}
        isEditingTpiCard={false}
        detailLevel={0}
        peopleRegistry={[
          {
            _id: 'cand-001',
            shortId: 1,
            firstName: 'Candidat',
            lastName: 'courant',
            roles: ['candidat'],
            candidateYears: [2026],
            isActive: true
          },
          {
            _id: 'exp-001',
            shortId: 2,
            firstName: 'Exp',
            lastName: '1',
            roles: ['expert'],
            isActive: true
          },
          {
            _id: 'exp-002',
            shortId: 3,
            firstName: 'Exp',
            lastName: '2',
            roles: ['expert'],
            isActive: true
          },
          {
            _id: 'cdp-001',
            shortId: 4,
            firstName: 'Boss',
            lastName: '',
            roles: ['chef_projet'],
            isActive: true
          }
        ]}
      />
    )

    expect(await screen.findByText('C-001')).toBeInTheDocument()
    expect(screen.getByText('E-002')).toBeInTheDocument()
    expect(screen.getByText('E-003')).toBeInTheDocument()
    expect(screen.getByText('P-004')).toBeInTheDocument()
    expect(screen.queryByText(/Candidat courant/i)).not.toBeInTheDocument()
  })

  it('résout les identifiants manquants depuis le référentiel parties prenantes', async () => {
    renderWithRouter(
      <TpiCard
        tpi={baseTpi}
        onUpdateTpi={jest.fn()}
        {...roomProps}
        isEditingTpiCard={false}
        detailLevel={0}
        peopleRegistry={[
          {
            _id: 'cand-reg-001',
            shortId: 11,
            firstName: 'Candidat',
            lastName: 'courant',
            roles: ['candidat'],
            candidateYears: [2026],
            isActive: true
          },
          {
            _id: 'exp-reg-001',
            shortId: 21,
            firstName: 'Exp',
            lastName: '1',
            roles: ['expert'],
            isActive: true
          },
          {
            _id: 'exp-reg-002',
            shortId: 22,
            firstName: 'Exp',
            lastName: '2',
            roles: ['expert'],
            isActive: true
          },
          {
            _id: 'boss-reg-001',
            shortId: 31,
            firstName: 'Boss',
            roles: ['chef_projet'],
            isActive: true
          }
        ]}
      />
    )

    expect(await screen.findByText('C-011')).toBeInTheDocument()
    expect(screen.getByText('E-021')).toBeInTheDocument()
    expect(screen.getByText('E-022')).toBeInTheDocument()
    expect(screen.getByText('P-031')).toBeInTheDocument()
  })

  it('utilise la seconde passe quand un numéro PP a déjà été résolu ailleurs', async () => {
    renderWithRouter(
      <TpiCard
        tpi={baseTpi}
        onUpdateTpi={jest.fn()}
        {...roomProps}
        isEditingTpiCard={false}
        detailLevel={0}
        peopleRegistry={[
          {
            _id: 'exp-duplicate-1',
            shortId: 91,
            firstName: 'Exp',
            lastName: '1',
            roles: ['expert'],
            isActive: true
          },
          {
            _id: 'exp-duplicate-2',
            shortId: 92,
            firstName: 'Exp',
            lastName: '1',
            roles: ['expert'],
            isActive: true
          }
        ]}
        stakeholderShortIdHints={{
          'candidat|candidat courant': 'C-041',
          'expert|exp 1': 'E-021',
          'expert|exp 2': 'E-022',
          'chef_projet|boss': 'P-031'
        }}
      />
    )

    expect(await screen.findByText('C-041')).toBeInTheDocument()
    expect(screen.getByText('E-021')).toBeInTheDocument()
    expect(screen.getByText('E-022')).toBeInTheDocument()
    expect(screen.getByText('P-031')).toBeInTheDocument()
  })

  it('expose un lien discret vers la fiche TPI dans la vue de planification', async () => {
    renderWithRouter(
      <TpiCard
        tpi={baseTpi}
        onUpdateTpi={jest.fn()}
        {...roomProps}
        isEditingTpiCard={false}
      />
    )

    expect(await screen.findByRole('link', { name: /ouvrir la fiche tpi-000/i })).toHaveAttribute(
      'href',
      '/tpi/2026/TPI-000'
    )
  })
})
