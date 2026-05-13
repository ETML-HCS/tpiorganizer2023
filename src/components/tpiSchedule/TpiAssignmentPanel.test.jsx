import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import TpiAssignmentPanel from './TpiAssignmentPanel'

const mockUseDrag = jest.fn(() => [{ isDragging: false }, jest.fn()])
const PANEL_COLLAPSED_STORAGE_KEY = 'tpiOrganizer.planning.assignmentPanelCollapsed'

jest.mock('react-dnd', () => ({
  useDrag: (config) => mockUseDrag(config)
}))

const makeEntry = (overrides = {}) => ({
  key: overrides.refTpi || 'TPI-001',
  refTpi: overrides.refTpi || 'TPI-001',
  candidat: overrides.candidat || 'Alice Martin',
  classe: overrides.classe || 'DEV4',
  site: overrides.site || 'ETML',
  sujet: overrides.sujet || 'Projet métier',
  tpi: {
    refTpi: overrides.refTpi || 'TPI-001',
    candidat: overrides.candidat || 'Alice Martin',
    classe: overrides.classe || 'DEV4',
    site: overrides.site || 'ETML',
    sujet: overrides.sujet || 'Projet métier',
    expert1: { name: 'Expert 1' },
    expert2: { name: 'Expert 2' },
    boss: { name: 'Chef' }
  }
})

describe('TpiAssignmentPanel', () => {
  beforeEach(() => {
    mockUseDrag.mockClear()
    window.localStorage.removeItem(PANEL_COLLAPSED_STORAGE_KEY)
  })

  it('filtre les TPI à placer par recherche, classe et site', () => {
    render(
      <TpiAssignmentPanel
        unassignedTpis={[
          makeEntry({ refTpi: 'TPI-001', candidat: 'Alice Martin', classe: 'DEV4', site: 'ETML' }),
          makeEntry({ refTpi: 'TPI-002', candidat: 'Bob Dupont', classe: 'MIN4', site: 'CFPV' })
        ]}
      />
    )

    expect(screen.getByRole('list', { name: /TPI non attribués/i })).toHaveTextContent('TPI-001')
    expect(screen.getByRole('list', { name: /TPI non attribués/i })).toHaveTextContent('TPI-002')

    fireEvent.change(screen.getByRole('searchbox', { name: /Rechercher un TPI/i }), {
      target: { value: 'alice' }
    })

    expect(screen.getByRole('list', { name: /TPI non attribués/i })).toHaveTextContent('TPI-001')
    expect(screen.queryByText('TPI-002')).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: /Filtrer par classe/i }), {
      target: { value: 'MIN4' }
    })

    expect(screen.getByText('Aucun résultat.')).toBeInTheDocument()
  })

  it('expose les TPI non attribués comme source drag/drop dédiée', () => {
    const entry = makeEntry({ refTpi: 'TPI-099', candidat: 'Nora Queue' })

    render(<TpiAssignmentPanel unassignedTpis={[entry]} />)

    expect(mockUseDrag).toHaveBeenCalledTimes(1)
    expect(mockUseDrag.mock.calls[0][0].item()).toEqual({
      source: 'unassigned',
      tpi: entry.tpi
    })
  })

  it('affiche les problèmes dans l onglet dédié', () => {
    render(
      <TpiAssignmentPanel
        unassignedTpis={[]}
        problemItems={[
          {
            key: 'conflict-1',
            type: 'conflict',
            label: 'Ada Lovelace',
            detail: '2026-06-10 · slot 2 · TPI-001, TPI-002'
          }
        ]}
      />
    )

    fireEvent.click(screen.getByRole('tab', { name: /Problèmes/i }))

    expect(screen.getByRole('list', { name: /Problèmes de planification/i })).toHaveTextContent('Ada Lovelace')
    expect(screen.getByText(/TPI-001, TPI-002/i)).toBeInTheDocument()
  })

  it('réduit et rouvre le bloc avec un bouton icône', () => {
    render(<TpiAssignmentPanel unassignedTpis={[makeEntry()]} />)

    const collapseButton = screen.getByRole('button', { name: /Réduire Placement TPI à traiter/i })
    expect(collapseButton).toHaveTextContent('')
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true')
    expect(collapseButton).toHaveAttribute('aria-controls', 'planning-assignment-panel-body')

    fireEvent.click(collapseButton)

    expect(screen.queryByRole('list', { name: /TPI non attribués/i })).not.toBeInTheDocument()
    expect(window.localStorage.getItem(PANEL_COLLAPSED_STORAGE_KEY)).toBe('true')

    const openButton = screen.getByRole('button', { name: /Ouvrir Placement TPI à traiter/i })
    expect(openButton).toHaveTextContent('')
    expect(openButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(openButton)

    expect(screen.getByRole('list', { name: /TPI non attribués/i })).toHaveTextContent('TPI-001')
    expect(window.localStorage.getItem(PANEL_COLLAPSED_STORAGE_KEY)).toBe('false')
  })

  it('restaure l état réduit enregistré localement', () => {
    window.localStorage.setItem(PANEL_COLLAPSED_STORAGE_KEY, 'true')

    render(<TpiAssignmentPanel unassignedTpis={[makeEntry()]} />)

    expect(screen.getByRole('button', { name: /Ouvrir Placement TPI à traiter/i })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: /TPI non attribués/i })).not.toBeInTheDocument()
  })
})
