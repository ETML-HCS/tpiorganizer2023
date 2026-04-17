import React from 'react'
import { render, screen } from '@testing-library/react'
import DateRoom from './DateRoom'

jest.mock('react-dnd', () => ({
  DndProvider: ({ children }) => <>{children}</>
}))

jest.mock('react-dnd-html5-backend', () => ({
  HTML5Backend: {}
}))

jest.mock('./TpiSlot', () => () => <div data-testid="tpi-slot" />)
jest.mock('./BreakLine', () => () => <div data-testid="break-line" />)

describe('DateRoom', () => {
  test('affiche le badge MATU sur une salle dont la date est rattachée à MATU', () => {
    render(
      <DateRoom
        roomData={{
          site: 'ETML',
          name: 'Sébeillon-N501',
          date: '2026-06-10',
          configSite: {
            numSlots: 1,
            breakline: 0.1667,
            tpiTime: 1,
            firstTpiStart: 8
          },
          tpiDatas: [null]
        }}
        roomIndex={0}
        onDelete={jest.fn()}
        onUpdateRoom={jest.fn()}
        isEditOfRoom={false}
        onUpdateTpi={jest.fn()}
        onSwapTpiCards={jest.fn()}
        soutenanceDates={[{ date: '2026-06-10', classes: ['MATU', 'M'] }]}
      />
    )

    expect(screen.getByLabelText(/Salle MATU/i)).toBeInTheDocument()
    expect(screen.getAllByText('MATU').length).toBeGreaterThan(0)
  })
})
