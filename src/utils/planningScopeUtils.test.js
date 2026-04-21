import {
  buildConfiguredPlanningSiteKeys,
  getPlanningPerimeterState,
  normalizePlanningSiteValue
} from './planningScopeUtils'

describe('planningScopeUtils', () => {
  it('keeps only active site codes as planning perimeter keys', () => {
    const siteKeys = buildConfiguredPlanningSiteKeys([
      { siteCode: 'Vennes', label: 'ETML / CFPV', active: true },
      { siteCode: 'CFPV', active: false },
      { label: 'Lausanne', active: true }
    ])

    expect(siteKeys.has(normalizePlanningSiteValue('Vennes'))).toBe(true)
    expect(siteKeys.has(normalizePlanningSiteValue('ETML / CFPV'))).toBe(false)
    expect(siteKeys.has(normalizePlanningSiteValue('Lausanne'))).toBe(false)
    expect(siteKeys.has(normalizePlanningSiteValue('CFPV'))).toBe(false)
  })

  it('matches a TPI only when its site equals the configured site code', () => {
    const siteConfigs = [
      { siteCode: 'Vennes', label: 'ETML / CFPV', active: true }
    ]

    expect(getPlanningPerimeterState({
      lieu: { site: 'Vennes' }
    }, siteConfigs).isPlanifiable).toBe(true)

    expect(getPlanningPerimeterState({
      lieu: { site: 'ETML / CFPV' }
    }, siteConfigs).isPlanifiable).toBe(false)
  })
})
