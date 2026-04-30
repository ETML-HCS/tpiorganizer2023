import React from 'react'
import { render, screen } from '@testing-library/react'
import TpiSlot from './TpiSlot'

jest.mock('react-dnd', () => ({
  useDrop: () => [{ isOver: false }, jest.fn()]
}))

jest.mock('./TpiCard', () => ({
  __esModule: true,
  default: ({ roomPeriod }) => (
    <div data-testid="tpi-card" data-room-period={roomPeriod ?? ''} />
  )
}))

const makeTpi = (period) => ({
  id: 'tpi-1',
  refTpi: 'TPI-001',
  candidat: 'Alice Martin',
  period,
  expert1: { name: 'Expert 1', offres: { isValidated: false, submit: [] } },
  expert2: { name: 'Expert 2', offres: { isValidated: false, submit: [] } },
  boss: { name: 'Chef', offres: { isValidated: false, submit: [] } }
})

describe('TpiSlot', () => {
  it('transmet le créneau de la grille à la carte TPI', () => {
    render(
      <TpiSlot
        tpiData={makeTpi(2)}
        isEditTPICard={false}
        timeValues={['13:00', '14:00']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={jest.fn()}
        roomPeriod={6}
      />
    )

    expect(screen.getByTestId('tpi-card')).toHaveAttribute('data-room-period', '6')
  })

  it('utilise le créneau du TPI en fallback', () => {
    render(
      <TpiSlot
        tpiData={makeTpi(3)}
        isEditTPICard={false}
        timeValues={['10:20', '11:20']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={jest.fn()}
      />
    )

    expect(screen.getByTestId('tpi-card')).toHaveAttribute('data-room-period', '3')
  })
})
