import {
  inferRoomClassMode,
  matchesClassFilterForRoom
} from './tpiScheduleFilters'

describe('tpiScheduleFilters', () => {
  it('keeps only M classes on MATU dates even when the room name is not M-prefixed', () => {
    const roomClassMode = inferRoomClassMode({
      roomName: 'Vennes - A01',
      roomDateEntry: { date: '2026-06-10', min: true },
      allowedPrefixes: []
    })

    expect(roomClassMode).toBe('matu')
    expect(matchesClassFilterForRoom({ classe: 'MIN4' }, [], roomClassMode)).toBe(true)
    expect(matchesClassFilterForRoom({ classe: 'DEV4' }, [], roomClassMode)).toBe(false)
    expect(matchesClassFilterForRoom({ classe: '' }, [], roomClassMode)).toBe(true)
  })

  it('hides M classes on non-MATU dates', () => {
    const roomClassMode = inferRoomClassMode({
      roomName: 'Sébeillon-N501',
      roomDateEntry: { date: '2026-06-11', special: true },
      allowedPrefixes: []
    })

    expect(roomClassMode).toBe('nonM')
    expect(matchesClassFilterForRoom({ classe: 'MIN4' }, [], roomClassMode)).toBe(false)
    expect(matchesClassFilterForRoom({ classe: 'DEV4' }, [], roomClassMode)).toBe(true)
  })

  it('falls back to explicit prefixes when no date flag is available', () => {
    const roomClassMode = inferRoomClassMode({
      roomName: '',
      allowedPrefixes: ['M']
    })

    expect(roomClassMode).toBe('matu')
    expect(matchesClassFilterForRoom({ classe: 'MIN4' }, ['M'], roomClassMode)).toBe(true)
    expect(matchesClassFilterForRoom({ classe: 'DEV4' }, ['M'], roomClassMode)).toBe(false)
  })
})
