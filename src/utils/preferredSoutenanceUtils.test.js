import {
  buildPreferredSoutenanceChoices,
  formatPreferredSoutenanceChoiceLabel,
  getPreferredSoutenanceChoiceInputValues
} from './preferredSoutenanceUtils'

describe('preferredSoutenanceUtils', () => {
  test('buildPreferredSoutenanceChoices dedupe les dates et conserve le créneau le plus précis', () => {
    expect(buildPreferredSoutenanceChoices([
      { date: '2026-06-10' },
      { date: '2026-06-10', period: 3 },
      { date: '2026-06-12', period: 1 },
      '2026-06-13',
      '2026-06-14'
    ])).toEqual([
      { date: '2026-06-10', period: 3 },
      { date: '2026-06-12', period: 1 },
      { date: '2026-06-13' }
    ])
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

  test('formatPreferredSoutenanceChoiceLabel affiche le créneau quand il est connu', () => {
    expect(formatPreferredSoutenanceChoiceLabel({ date: '2026-06-10', period: 4 })).toMatch(/créneau 4/i)
  })
})
