import {
  buildValidationToast,
  extractValidationResultFromError
} from './workflowFeedback'

describe('extractValidationResultFromError', () => {
  test('reconstruit un resultat de validation a partir des details d erreur', () => {
    const result = extractValidationResultFromError(2026, {
      data: {
        details: {
          year: 2026,
          summary: {
            issueCount: 2,
            hardConflictCount: 2,
            importIssueCount: 2
          },
          issues: [
            {
              type: 'legacy_tpi_missing_reference',
              message: 'TPI sans reference exploitable.'
            }
          ]
        }
      }
    })

    expect(result).not.toBeNull()
    expect(result.year).toBe(2026)
    expect(result.summary.isValid).toBe(false)
    expect(result.summary.issueCount).toBe(2)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].type).toBe('legacy_tpi_missing_reference')
  })

  test('ignore les erreurs sans details de validation exploitables', () => {
    expect(extractValidationResultFromError(2026, { data: { error: 'boom' } })).toBeNull()
  })
})

describe('buildValidationToast', () => {
  test('annonce les overrides de contraintes comme avertissements', () => {
    const toast = buildValidationToast(2026, {
      summary: {
        issueCount: 0,
        hardConflictCount: 0,
        warningCount: 2,
        constraintOverrideWarningCount: 2
      }
    })

    expect(toast.level).toBe('warning')
    expect(toast.message).toMatch(/2 avertissement\(s\) de contrainte/)
    expect(toast.message).toMatch(/planification valide/)
  })
})
