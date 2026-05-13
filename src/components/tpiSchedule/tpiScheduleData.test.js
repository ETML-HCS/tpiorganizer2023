import {
  isTpiPlanningSealed,
  normalizeBooleanFlag,
  normalizeRoom,
  normalizeTpi
} from './tpiScheduleData'

describe('tpiScheduleData planning seal', () => {
  it('normalise explicitement les valeurs booléennes du verrou', () => {
    expect(normalizeBooleanFlag(true)).toBe(true)
    expect(normalizeBooleanFlag(false)).toBe(false)
    expect(normalizeBooleanFlag('true')).toBe(true)
    expect(normalizeBooleanFlag('false')).toBe(false)
    expect(normalizeBooleanFlag('oui')).toBe(true)
    expect(normalizeBooleanFlag('non')).toBe(false)
    expect(normalizeBooleanFlag(1)).toBe(true)
    expect(normalizeBooleanFlag(0)).toBe(false)
  })

  it('conserve les alias historiques sans transformer la chaîne false en verrou actif', () => {
    expect(normalizeTpi({ refTpi: 'TPI-001', isPlanningSealed: 'false' })).toMatchObject({
      refTpi: 'TPI-001',
      isPlanningSealed: false
    })
    expect(normalizeTpi({ refTpi: 'TPI-002', planningSealed: 'true' })).toMatchObject({
      refTpi: 'TPI-002',
      isPlanningSealed: true
    })
    expect(isTpiPlanningSealed({ isSealed: 1 })).toBe(true)
  })

  it('conserve le verrou pendant la normalisation complete d une room', () => {
    const room = normalizeRoom({
      name: 'A101',
      date: '2026-06-10',
      tpiDatas: [
        { refTpi: 'TPI-LOCK', candidat: 'Alice', isPlanningSealed: 'true' },
        { refTpi: 'TPI-FREE', candidat: 'Bob', isPlanningSealed: 'false' }
      ]
    })

    expect(room.tpiDatas[0]).toMatchObject({
      refTpi: 'TPI-LOCK',
      isPlanningSealed: true
    })
    expect(room.tpiDatas[1]).toMatchObject({
      refTpi: 'TPI-FREE',
      isPlanningSealed: false
    })
  })

  it('realigne les périodes des TPI sur les slots affichés', () => {
    const room = normalizeRoom({
      name: 'A101',
      date: '2026-06-10',
      tpiDatas: [
        { refTpi: 'TPI-1', period: 7 },
        { refTpi: 'TPI-2', period: 1 }
      ]
    })

    expect(room.tpiDatas[0]).toMatchObject({ refTpi: 'TPI-1', period: 1 })
    expect(room.tpiDatas[1]).toMatchObject({ refTpi: 'TPI-2', period: 2 })
  })
})
