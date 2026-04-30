export function installFetchMock(implementation) {
  const originalFetch = global.fetch
  const fetchMock = jest.fn(implementation)

  global.fetch = fetchMock

  return {
    fetchMock,
    restore() {
      if (originalFetch) {
        global.fetch = originalFetch
      } else {
        delete global.fetch
      }
    }
  }
}
