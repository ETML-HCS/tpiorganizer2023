import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MobileRoomFilter } from './TpiSoutenanceParts'

const buildRoom = (name, date, candidat, refTpi = '2163') => ({
  site: 'ETML',
  date,
  name,
  tpiDatas: [
    {
      id: `${name}-tpi-1`,
      refTpi,
      candidat,
      expert1: { name: 'Expert 1' },
      expert2: { name: 'Expert 2' },
      boss: { name: 'Chef de projet' }
    }
  ]
})

describe('MobileRoomFilter', () => {
  test('reste stable si la liste des salles se réduit après navigation', () => {
    const rooms = [
      buildRoom('Salle A', '2026-06-10', 'Alice Durand'),
      buildRoom('Salle B', '2026-06-11', 'Bob Martin')
    ]

    const { rerender } = render(
      <MemoryRouter>
        <MobileRoomFilter rooms={rooms} schedule={[]} year={2026} />
      </MemoryRouter>
    )

    expect(screen.getByText('Salle A')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Droite/i }))
    expect(screen.getByText('Salle B')).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <MobileRoomFilter rooms={[rooms[0]]} schedule={[]} year={2026} />
      </MemoryRouter>
    )

    expect(screen.getByText('Salle A')).toBeInTheDocument()
    expect(screen.queryByText('Salle B')).not.toBeInTheDocument()
  })

  test('affiche le badge SPECIAL quand la salle publiée est marquée matu', () => {
    const rooms = [
      {
        ...buildRoom('Salle SPECIAL', '2026-06-10', 'Alice Durand'),
        roomClassMode: 'matu'
      }
    ]

    render(
      <MemoryRouter>
        <MobileRoomFilter rooms={rooms} schedule={[]} year={2026} />
      </MemoryRouter>
    )

    expect(screen.getByLabelText(/Salle SPECIAL/i)).toBeInTheDocument()
  })

  test('ajoute un lien fiche dans la vue mobile des salles', () => {
    render(
      <MemoryRouter>
        <MobileRoomFilter
          rooms={[buildRoom('Salle A', '2026-06-10', 'Alice Durand', '3001')]}
          schedule={[]}
          year={2026}
        />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: /fiche/i })).toHaveAttribute('href', '/tpi/2026/3001')
  })
})
