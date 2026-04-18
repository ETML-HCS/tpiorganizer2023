import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import NewRoomForm from './NewRoomForm'

describe('NewRoomForm', () => {
  test('n affiche que les salles encore libres pour la date et le site sélectionnés', async () => {
    render(
      <NewRoomForm
        onNewRoom={jest.fn()}
        setShowForm={jest.fn()}
        soutenanceDates={[
          { date: '2026-06-10' },
          { date: '2026-06-11' }
        ]}
        roomCatalogBySite={{
          ETML: ['A101', 'B202']
        }}
        existingRooms={[
          { site: 'ETML', date: '2026-06-10', name: 'A101' }
        ]}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'B202' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('option', { name: 'A101' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Date/i), { target: { value: '2026-06-11' } })

    expect(screen.getByRole('option', { name: 'A101' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'B202' })).toBeInTheDocument()
  })
})
