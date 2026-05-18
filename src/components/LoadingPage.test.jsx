import React from 'react'
import { render, screen } from '@testing-library/react'

import LoadingPage from './LoadingPage'

describe('LoadingPage', () => {
  const originalVersionTag = process.env.REACT_APP_VERSION_TAG

  afterEach(() => {
    if (originalVersionTag === undefined) {
      delete process.env.REACT_APP_VERSION_TAG
    } else {
      process.env.REACT_APP_VERSION_TAG = originalVersionTag
    }
  })

  test('affiche la version fournie par le tag Git', () => {
    process.env.REACT_APP_VERSION_TAG = 'vs.260514'

    render(<LoadingPage />)

    expect(screen.getByLabelText('Version vs.260514')).toBeInTheDocument()
    expect(screen.getByText('Version vs.260514')).toBeInTheDocument()
  })

  test('masque la version quand aucun tag Git n est fourni', () => {
    delete process.env.REACT_APP_VERSION_TAG

    render(<LoadingPage />)

    expect(screen.queryByText(/^Version /)).not.toBeInTheDocument()
  })
})
