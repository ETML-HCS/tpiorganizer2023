import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import DateRoom from './DateRoom'

jest.mock('react-dnd', () => ({
  DndProvider: ({ children }) => <>{children}</>
}))

jest.mock('react-dnd-html5-backend', () => ({
  HTML5Backend: {}
}))

jest.mock('./TpiSlot', () => ({ timeValues }) => (
  <div data-testid="tpi-slot">{Array.isArray(timeValues) ? timeValues.join(' - ') : ''}</div>
))
jest.mock('./BreakLine', () => ({ duration }) => (
  <div data-testid="break-line">{duration}</div>
))

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

  test('retire les salles déjà prises sur la même date pendant l édition', () => {
    render(
      <DateRoom
        roomData={{
          idRoom: 1,
          site: 'ETML',
          name: 'A101',
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
        isEditOfRoom={true}
        onUpdateTpi={jest.fn()}
        onSwapTpiCards={jest.fn()}
        roomCatalogBySite={{
          ETML: ['A101', 'B202', 'C303']
        }}
        allRooms={[
          { idRoom: 1, site: 'ETML', name: 'A101', date: '2026-06-10' },
          { idRoom: 2, site: 'ETML', name: 'B202', date: '2026-06-10' },
          { idRoom: 3, site: 'ETML', name: 'A101', date: '2026-06-11' }
        ]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Menu de la salle/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Modifier/i }))

    expect(screen.getByRole('option', { name: 'A101' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'C303' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'B202' })).not.toBeInTheDocument()
  })

  test('déclenche la suppression d une occurrence quand l utilisateur confirme', () => {
    const onDelete = jest.fn()
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <DateRoom
        roomData={{
          idRoom: 1,
          site: 'ETML',
          name: 'A101',
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
        onDelete={onDelete}
        onUpdateRoom={jest.fn()}
        isEditOfRoom={true}
        onUpdateTpi={jest.fn()}
        onSwapTpiCards={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Menu de la salle/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Supprimer/i }))

    expect(onDelete).toHaveBeenCalledTimes(1)
    confirmSpy.mockRestore()
  })

  test('utilise les champs de configuration en minutes pour la pause et les horaires', () => {
    render(
      <DateRoom
        roomData={{
          site: 'ETML',
          name: 'A101',
          date: '2026-06-10',
          configSite: {
            numSlots: 2,
            breaklineMinutes: 10,
            tpiTimeMinutes: 60,
            firstTpiStartTime: '08:00'
          },
          tpiDatas: [null, null]
        }}
        roomIndex={0}
        onDelete={jest.fn()}
        onUpdateRoom={jest.fn()}
        isEditOfRoom={false}
        onUpdateTpi={jest.fn()}
        onSwapTpiCards={jest.fn()}
      />
    )

    expect(screen.getByTestId('break-line')).toHaveTextContent('10')
    expect(screen.getAllByTestId('tpi-slot')[0]).toHaveTextContent('08:00 - 09:00')
    expect(screen.getAllByTestId('tpi-slot')[1]).toHaveTextContent('09:10 - 10:10')
  })

  test('applique la couleur de planning configurée pour un site non legacy', () => {
    render(
      <DateRoom
        roomData={{
          site: 'VENNES',
          name: 'Vennes - A101',
          date: '2026-06-10',
          configSite: {
            planningColor: '#14532d',
            numSlots: 1,
            breaklineMinutes: 10,
            tpiTimeMinutes: 60,
            firstTpiStartTime: '08:00'
          },
          tpiDatas: [null]
        }}
        roomIndex={0}
        onDelete={jest.fn()}
        onUpdateRoom={jest.fn()}
        isEditOfRoom={false}
        onUpdateTpi={jest.fn()}
        onSwapTpiCards={jest.fn()}
      />
    )

    const roomElement = screen.getByText('Vennes - A101').closest('.date-room')

    expect(roomElement?.style.getPropertyValue('--dateRoom-bgColor')).toBe('#14532D')
    expect(roomElement).toHaveClass('site_vennes')
  })
})
