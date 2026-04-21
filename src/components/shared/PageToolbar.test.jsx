import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import PageToolbar from './PageToolbar'

function renderToolbar(props = {}) {
  return render(
    <MemoryRouter>
      <PageToolbar {...props} />
    </MemoryRouter>
  )
}

describe('PageToolbar', () => {
  test('ne rend rien si aucun contenu utile n est fourni', () => {
    const { container } = renderToolbar()

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
  })

  test('n affiche pas de corps vide quand seules les métadonnées et actions sont utiles', () => {
    const { container } = renderToolbar({
      title: 'Bibliothèque des évaluations',
      actions: <button type='button'>Nouvelle évaluation</button>,
      meta: <span>4 enreg.</span>
    })

    expect(screen.getByRole('toolbar')).toBeInTheDocument()
    expect(screen.getByText('Bibliothèque des évaluations')).toBeInTheDocument()
    expect(container.querySelector('.page-tools-body')).toBeNull()
  })
})
