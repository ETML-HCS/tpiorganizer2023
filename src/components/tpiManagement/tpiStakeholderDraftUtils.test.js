import {
  buildStakeholderDraftEntries,
  splitStakeholderDraftName
} from './tpiStakeholderDraftUtils'

describe('tpiStakeholderDraftUtils', () => {
  it('ignores literal null placeholders when building stakeholder drafts', () => {
    const drafts = buildStakeholderDraftEntries(
      [
        {
          refTpi: 'TPI-2026-010',
          candidat: 'Alice Martin',
          experts: {
            1: 'null',
            2: 'Bob Expert'
          },
          boss: ' undefined ',
          lieu: {
            site: 'null',
            entreprise: 'ACME'
          }
        }
      ],
      2026
    )

    expect(drafts).toHaveLength(2)
    expect(drafts[0]).toMatchObject({
      role: 'candidat',
      name: 'Alice Martin',
      year: 2026,
      site: '',
      entreprise: 'ACME',
      candidateYears: [2026],
      refs: ['TPI-2026-010'],
      source: 'gestionTPI'
    })
    expect(drafts[1]).toMatchObject({
      role: 'expert',
      name: 'Bob Expert',
      year: 2026,
      site: '',
      entreprise: 'ACME',
      candidateYears: [],
      refs: ['TPI-2026-010'],
      source: 'gestionTPI'
    })
  })

  it('does not prefill a stakeholder called null', () => {
    expect(splitStakeholderDraftName('null')).toEqual({
      firstName: '',
      lastName: ''
    })
    expect(splitStakeholderDraftName(' undefined ')).toEqual({
      firstName: '',
      lastName: ''
    })
  })
})
