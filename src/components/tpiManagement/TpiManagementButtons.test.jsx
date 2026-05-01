import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import TpiManagementButtons from './TpiManagementButtons.jsx'
import { loadCsvParser } from './csvParserLoader.js'

jest.mock('./csvParserLoader.js', () => ({
  loadCsvParser: jest.fn()
}))

jest.mock('../tpiControllers/TpiController.jsx', () => ({
  createTpiModel: jest.fn(),
  deleteTpiModelsByYear: jest.fn()
}))

jest.mock('../Tools.jsx', () => ({
  showNotification: jest.fn()
}))

const parseCsv = jest.fn()

const renderButtons = () =>
  render(
    <MemoryRouter>
      <TpiManagementButtons
        onNewTpi={jest.fn()}
        newTpi={false}
        onImportComplete={jest.fn()}
        toggleArrow={jest.fn()}
        isArrowUp={true}
        year={2026}
      />
    </MemoryRouter>
  )

describe('TpiManagementButtons', () => {
  beforeEach(() => {
    loadCsvParser.mockReset()
    parseCsv.mockReset()
    loadCsvParser.mockResolvedValue({ parse: parseCsv })
    parseCsv.mockImplementation((file, options) => {
      options.complete({
        meta: {
          fields: ['N° de TPI', 'Candidat', 'Chef de projet', 'Expert 1', 'Expert 2']
        },
        data: [
          {
            'N° de TPI': '2163',
            Candidat: 'Alice Martin',
            'Chef de projet': 'Bob Dupont',
            'Expert 1': 'Claire Expert',
            'Expert 2': 'David Expert'
          }
        ]
      })
    })
  })

  test('ne charge pas le parseur CSV avant la sélection d’un fichier', () => {
    renderButtons()

    expect(loadCsvParser).not.toHaveBeenCalled()
  })

  test('charge le parseur CSV à la demande et prépare le mapping', async () => {
    const { container } = renderButtons()

    fireEvent.click(screen.getByRole('button', { name: 'Importer CSV' }))

    const fileInput = container.querySelector('#fileInput')
    const file = new File(['csv'], 'tpis.csv', { type: 'text/csv' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(loadCsvParser).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(parseCsv).toHaveBeenCalledTimes(1)
    })

    expect(parseCsv).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        header: true,
        skipEmptyLines: true,
        complete: expect.any(Function),
        error: expect.any(Function)
      })
    )
    expect(await screen.findByText('tpis.csv')).toBeInTheDocument()
    expect(screen.getByDisplayValue('N° de TPI')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Candidat')).toBeInTheDocument()
  })
})
