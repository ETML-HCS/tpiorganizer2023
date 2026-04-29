import {
  PREFERRED_SOUTENANCE_CHOICE_FIELDS,
  buildPreferredSoutenanceChoices,
  buildPreferredSoutenanceDates,
  formatPreferredSoutenanceChoiceLabel,
  getPreferredSoutenanceChoiceInputValues
} from './preferredSoutenanceUtils'

describe('preferredSoutenanceUtils', () => {
  test('buildPreferredSoutenanceChoices dedupe les choix identiques et conserve les créneaux différents du même jour', () => {
    expect(buildPreferredSoutenanceChoices([
      { date: '2026-06-10' },
      { date: '2026-06-10', period: 3 },
      { date: '2026-06-10', period: 6 },
      { date: '2026-06-12', period: 1 },
      '2026-06-13',
      '2026-06-14'
    ])).toEqual([
      { date: '2026-06-10', period: 3 },
      { date: '2026-06-10', period: 6 },
      { date: '2026-06-12', period: 1 }
    ])
  })

  test('buildPreferredSoutenanceDates expose les dates uniques pour le champ legacy', () => {
    expect(buildPreferredSoutenanceDates([
      { date: '2026-06-10', period: 3 },
      { date: '2026-06-10', period: 6 },
      { date: '2026-06-12', period: 1 }
    ])).toEqual(['2026-06-10', '2026-06-12'])
  })

  test('getPreferredSoutenanceChoiceInputValues répartit dates et créneaux dans le formulaire', () => {
    expect(getPreferredSoutenanceChoiceInputValues([
      { date: '2026-06-10', period: 2 },
      { date: '2026-06-12' }
    ])).toEqual({
      preferredSoutenanceDate1: '2026-06-10',
      preferredSoutenanceSlot1: '2',
      preferredSoutenanceDate2: '2026-06-12',
      preferredSoutenanceSlot2: '',
      preferredSoutenanceDate3: '',
      preferredSoutenanceSlot3: ''
    })
  })

  test('getPreferredSoutenanceChoiceInputValues conserve deux créneaux sur le même jour', () => {
    expect(getPreferredSoutenanceChoiceInputValues([
      { date: '2026-06-10', period: 2 },
      { date: '2026-06-10', period: 6 }
    ])).toEqual({
      preferredSoutenanceDate1: '2026-06-10',
      preferredSoutenanceSlot1: '2',
      preferredSoutenanceDate2: '2026-06-10',
      preferredSoutenanceSlot2: '6',
      preferredSoutenanceDate3: '',
      preferredSoutenanceSlot3: ''
    })
  })

  test('formatPreferredSoutenanceChoiceLabel affiche le créneau quand il est connu', () => {
    expect(formatPreferredSoutenanceChoiceLabel({ date: '2026-06-10', period: 4 })).toMatch(/créneau 4/i)
  })

  test('les champs de dates idéales n affichent plus le marqueur visuel', () => {
    expect(PREFERRED_SOUTENANCE_CHOICE_FIELDS.map(({ label }) => label)).toEqual([
      'Préférence 1',
      'Préférence 2',
      'Préférence 3'
    ])
    expect(PREFERRED_SOUTENANCE_CHOICE_FIELDS.map(({ label }) => label).join(' ')).not.toContain(
      String.fromCodePoint(0x1f538)
    )
  })
})
