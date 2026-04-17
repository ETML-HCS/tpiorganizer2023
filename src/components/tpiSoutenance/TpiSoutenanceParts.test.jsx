import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MobileRoomFilter } from './TpiSoutenanceParts'

const buildRoom = (name, date, candidat) => ({
  site: 'ETML',
  date,
  name,
  tpiDatas: [
    {
      id: `${name}-tpi-1`,
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
      <MobileRoomFilter rooms={rooms} schedule={[]} />
    )

    expect(screen.getByText('Salle A')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Droite/i }))
    expect(screen.getByText('Salle B')).toBeInTheDocument()

    rerender(<MobileRoomFilter rooms={[rooms[0]]} schedule={[]} />)

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

    render(<MobileRoomFilter rooms={rooms} schedule={[]} />)

    expect(screen.getByLabelText(/Salle SPECIAL/i)).toBeInTheDocument()
  })
})
