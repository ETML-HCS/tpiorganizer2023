import React from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

export function makeRouterWrapper({
  initialEntries = ['/'],
  initialIndex,
  routerProps = {}
} = {}) {
  return function RouterWrapper({ children }) {
    return (
      <MemoryRouter
        initialEntries={initialEntries}
        initialIndex={initialIndex}
        {...routerProps}
      >
        {children}
      </MemoryRouter>
    )
  }
}

export function renderWithRouter(ui, options = {}) {
  const {
    route = '/',
    initialEntries = [route],
    initialIndex,
    routerProps,
    ...renderOptions
  } = options

  return render(ui, {
    wrapper: makeRouterWrapper({ initialEntries, initialIndex, routerProps }),
    ...renderOptions
  })
}
