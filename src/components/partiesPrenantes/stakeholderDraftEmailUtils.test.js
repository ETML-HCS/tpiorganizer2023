import { buildSyntheticStakeholderEmail } from './stakeholderDraftEmailUtils'

describe('stakeholderDraftEmailUtils', () => {
  it('builds a stable synthetic candidate email in the tpiorganizer.ch domain', () => {
    const firstEmail = buildSyntheticStakeholderEmail({
      firstName: 'Alice',
      lastName: 'Martin',
      role: 'candidat',
      year: 2026,
      seed: 'draft-1'
    })
    const secondEmail = buildSyntheticStakeholderEmail({
      firstName: 'Alice',
      lastName: 'Martin',
      role: 'candidat',
      year: 2026,
      seed: 'draft-1'
    })

    expect(firstEmail).toBe(secondEmail)
    expect(firstEmail).toMatch(/^d\.c\.amartin\.26\.[a-z0-9]{6}@tpiorganizer\.ch$/)
  })

  it('uses the seed to avoid collisions between otherwise identical draft emails', () => {
    const firstEmail = buildSyntheticStakeholderEmail({
      firstName: 'Alice',
      lastName: 'Martin',
      role: 'candidat',
      year: 2026,
      seed: 'draft-1'
    })
    const secondEmail = buildSyntheticStakeholderEmail({
      firstName: 'Alice',
      lastName: 'Martin',
      role: 'candidat',
      year: 2026,
      seed: 'draft-2'
    })

    expect(firstEmail).not.toBe(secondEmail)
  })

  it('keeps long candidate draft emails compact', () => {
    const email = buildSyntheticStakeholderEmail({
      firstName: 'Maximilien-Alexandre',
      lastName: 'de La Rochefoucauld-Montpensier',
      role: 'candidat',
      year: 2026,
      seed: 'draft-long'
    })

    const [localPart] = email.split('@')

    expect(localPart).toHaveLength(23)
    expect(email).toMatch(/^d\.c\.[a-z0-9]{2,9}\.26\.[a-z0-9]{6}@tpiorganizer\.ch$/)
  })
})
