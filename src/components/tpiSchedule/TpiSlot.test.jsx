import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
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

  it('affiche le bouton de sync sous l heure uniquement en mode édition', () => {
    const onSyncTpiFromGestion = jest.fn()
    const syncEntry = {
      refTpi: 'TPI-001',
      changedLabels: ['candidat', 'expert 1']
    }

    const { rerender } = render(
      <TpiSlot
        tpiData={makeTpi(2)}
        isEditTPICard={false}
        timeValues={['13:00', '14:00']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={jest.fn()}
        tpiSyncEntry={syncEntry}
        onSyncTpiFromGestion={onSyncTpiFromGestion}
      />
    )

    expect(screen.queryByRole('button', { name: /Synchroniser TPI-001/i })).not.toBeInTheDocument()

    rerender(
      <TpiSlot
        tpiData={makeTpi(2)}
        isEditTPICard
        timeValues={['13:00', '14:00']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={jest.fn()}
        tpiSyncEntry={syncEntry}
        onSyncTpiFromGestion={onSyncTpiFromGestion}
      />
    )

    const syncButton = screen.getByRole('button', { name: /Synchroniser TPI-001/i })
    expect(syncButton.querySelector('svg')).not.toBeNull()

    fireEvent.click(syncButton)

    expect(onSyncTpiFromGestion).toHaveBeenCalledTimes(1)
  })
})
