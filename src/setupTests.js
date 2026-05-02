// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

jest.mock('react-router-dom', () => {
  const React = require('react')
  const actual = jest.requireActual('react-router-dom')
  const defaultFutureFlags = {
    v7_relativeSplatPath: true,
    v7_startTransition: true
  }

  function TestMemoryRouter({ future, ...props }) {
    return React.createElement(actual.MemoryRouter, {
      ...props,
      future: {
        ...defaultFutureFlags,
        ...(future || {})
      }
    })
  }

  function TestBrowserRouter({ future, ...props }) {
    return React.createElement(actual.BrowserRouter, {
      ...props,
      future: {
        ...defaultFutureFlags,
        ...(future || {})
      }
    })
  }

  return {
    ...actual,
    BrowserRouter: TestBrowserRouter,
    MemoryRouter: TestMemoryRouter
  }
})
