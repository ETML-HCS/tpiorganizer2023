import {
  getPlanningClassDisplayInfo,
  getPlanningClassModeDetails,
  getPlanningClassModeLabel,
  getPlanningClassPeriod
} from './planningClassUtils'

describe('planningClassUtils', () => {
  it('resolves a class from the site catalog regardless of case', () => {
    const catalogSites = [
      {
        code: 'SEBEILLON',
        label: 'Sébeillon',
        classGroups: [
          {
            baseType: 'CFC',
            label: 'CFC',
            classes: [
              {
                code: 'CID4A',
                label: 'CID4A',
                description: 'Informatique de gestion'
              }
            ]
          }
        ]
      }
    ]

    const details = getPlanningClassModeDetails('cid4a', [], catalogSites, 'sebeillon')

    expect(details.code).toBe('CFC')
    expect(details.classCode).toBe('CID4A')
    expect(details.classLabel).toBe('CID4A')
    expect(details.siteLabel).toBe('Sébeillon')
    expect(getPlanningClassModeLabel('cid4a', [], catalogSites, 'sebeillon')).toBe('CFC')
  })

  it('keeps the annual fallback when the catalog does not contain the class', () => {
    const classTypes = [
      {
        code: 'MATU',
        prefix: 'M',
        label: 'MATU',
        startDate: '2026-01-05',
        endDate: '2026-06-30'
      }
    ]

    const details = getPlanningClassModeDetails('Mid3A', classTypes)

    expect(details.code).toBe('MATU')
    expect(details.classCode).toBe('MID3A')
    expect(getPlanningClassPeriod('Mid3A', classTypes)).toEqual({
      startDate: '2026-01-05',
      endDate: '2026-06-30'
    })
  })

  it('keeps code-only labels even when human-readable labels differ', () => {
    const classTypes = [
      {
        code: 'CFC',
        label: 'Formation CFC',
        prefix: 'C'
      }
    ]

    const catalogSites = [
      {
        code: 'SEBEILLON',
        label: 'Sébeillon',
        classGroups: [
          {
            baseType: 'CFC',
            label: 'Formation CFC',
            classes: [
              {
                code: 'CID4A',
                label: 'Informatique de gestion',
                description: 'Informatique de gestion'
              }
            ]
          }
        ]
      }
    ]

    const displayInfo = getPlanningClassDisplayInfo('cid4a', classTypes, catalogSites, 'sebeillon')

    expect(displayInfo.displayClassLabel).toBe('CID4A')
    expect(displayInfo.displayTypeLabel).toBe('CFC')
    expect(displayInfo.displayLabel).toBe('CID4A · CFC')
  })

  ;['FPA', 'MATU'].forEach((classCode) => {
    it(`shows ${classCode} on a single label without duplicating the code`, () => {
      const displayInfo = getPlanningClassDisplayInfo(classCode)

      expect(displayInfo.hasSpecificClass).toBe(false)
      expect(displayInfo.displayClassLabel).toBe(classCode)
      expect(displayInfo.displayTypeLabel).toBe(classCode)
      expect(displayInfo.displayLabel).toBe(classCode)
    })
  })
})
