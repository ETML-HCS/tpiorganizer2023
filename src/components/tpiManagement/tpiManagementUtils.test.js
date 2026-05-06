import {
  hasMissingStakeholders,
  getMissingStakeholders,
  getStakeholderIssues,
  hasStakeholderIssues,
  getTpiLifecycleSummary,
  normalizeTpiForForm,
  normalizeTpiForSave
} from './tpiManagementUtils.js'

describe('tpiManagementUtils', () => {
  it('preserves linked person identifiers when round-tripping a TPI', () => {
    const sourceTpi = {
      refTpi: 'TPI-2026-001',
      candidat: 'Alice Martin',
      candidatPersonId: 'person-candidate',
      experts: {
        1: 'Expert One',
        2: 'Expert Two'
      },
      expert1PersonId: 'person-expert-1',
      expert2PersonId: 'person-expert-2',
      boss: 'Chef Projet',
      bossPersonId: 'person-boss',
      sujet: 'Sujet de test'
    }

    const formData = normalizeTpiForForm(sourceTpi)

    expect(formData.candidatPersonId).toBe('person-candidate')
    expect(formData.expert1PersonId).toBe('person-expert-1')
    expect(formData.expert2PersonId).toBe('person-expert-2')
    expect(formData.bossPersonId).toBe('person-boss')

    const savedTpi = normalizeTpiForSave(formData)

    expect(savedTpi.candidatPersonId).toBe('person-candidate')
    expect(savedTpi.expert1PersonId).toBe('person-expert-1')
    expect(savedTpi.expert2PersonId).toBe('person-expert-2')
    expect(savedTpi.bossPersonId).toBe('person-boss')
  })

  it('detects missing required stakeholders and unlinked stakeholders separately', () => {
    const sourceTpi = {
      refTpi: 'TPI-2026-002',
      candidat: 'Alice Martin',
      candidatPersonId: 'person-candidate',
      experts: {
        1: 'Expert One',
        2: ''
      },
      expert1PersonId: '',
      expert2PersonId: '',
      boss: '',
      bossPersonId: ''
    }

    expect(getMissingStakeholders(sourceTpi)).toEqual(['expert 2', 'chef de projet'])
    expect(getStakeholderIssues(sourceTpi)).toEqual({
      missingStakeholders: ['expert 2', 'chef de projet'],
      missingLinks: ['expert 1'],
      hasIssues: true,
      summary: 'Manquants: expert 2, chef de projet | Liaisons: expert 1'
    })
    expect(hasMissingStakeholders(sourceTpi)).toBe(true)
    expect(hasStakeholderIssues(sourceTpi)).toBe(true)
  })

  it('does not treat linked-name-only gaps as missing stakeholders', () => {
    const sourceTpi = {
      refTpi: '2163',
      candidat: 'Chasi Sanchez Dario Jhesuanj',
      candidatPersonId: null,
      experts: {
        1: 'Alain Pittet',
        2: 'Karim Bourahla'
      },
      expert1PersonId: 'person-expert-1',
      expert2PersonId: 'person-expert-2',
      boss: 'Laurent Deschamps',
      bossPersonId: 'person-boss'
    }

    expect(getMissingStakeholders(sourceTpi)).toEqual([])
    expect(hasMissingStakeholders(sourceTpi)).toBe(false)
    expect(getStakeholderIssues(sourceTpi)).toEqual({
      missingStakeholders: [],
      missingLinks: ['candidat'],
      hasIssues: true,
      summary: 'Liaisons: candidat'
    })
  })

  it('prefers the stakeholder state computed by the API when available', () => {
    const sourceTpi = {
      refTpi: '2163',
      candidat: 'Chasi Sanchez Dario Jhesuanj',
      candidatPersonId: null,
      experts: {
        1: 'Alain Pittet',
        2: 'Karim Bourahla'
      },
      expert1PersonId: null,
      expert2PersonId: null,
      boss: 'Laurent Deschamps',
      bossPersonId: null,
      stakeholderState: {
        isComplete: true,
        isResolved: true,
        isValidated: true,
        missingRoles: [],
        unresolvedRoles: []
      }
    }

    expect(getMissingStakeholders(sourceTpi)).toEqual([])
    expect(getStakeholderIssues(sourceTpi)).toEqual({
      missingStakeholders: [],
      missingLinks: [],
      hasIssues: false,
      summary: 'Completes'
    })
  })

  it('does not treat a linked stakeholder without copied name as missing', () => {
    const sourceTpi = {
      refTpi: '2163',
      candidat: 'Chasi Sanchez Dario Jhesuanj',
      candidatPersonId: 'person-candidate',
      experts: {
        1: 'Alain Pittet',
        2: 'Karim Bourahla'
      },
      expert1PersonId: 'person-expert-1',
      expert2PersonId: 'person-expert-2',
      boss: '',
      bossPersonId: 'person-boss'
    }

    expect(getMissingStakeholders(sourceTpi)).toEqual([])
    expect(getStakeholderIssues(sourceTpi)).toEqual({
      missingStakeholders: [],
      missingLinks: [],
      hasIssues: false,
      summary: 'Completes'
    })
  })

  it('treats literal null placeholders as missing stakeholder data', () => {
    const sourceTpi = {
      refTpi: 'TPI-2026-003',
      candidat: 'null',
      candidatPersonId: 'null',
      experts: {
        1: 'Expert One',
        2: ' null '
      },
      expert1PersonId: 'person-expert-1',
      expert2PersonId: 'undefined',
      boss: 'undefined',
      bossPersonId: null,
      tags: 'React, null, API'
    }

    const formData = normalizeTpiForForm(sourceTpi)
    const savedTpi = normalizeTpiForSave(formData)

    expect(formData.candidat).toBe('')
    expect(formData.candidatPersonId).toBe('')
    expect(formData.expert2).toBe('')
    expect(formData.boss).toBe('')
    expect(getMissingStakeholders(sourceTpi)).toEqual(['candidat', 'expert 2', 'chef de projet'])
    expect(savedTpi.candidat).toBe('')
    expect(savedTpi.candidatPersonId).toBeNull()
    expect(savedTpi.experts[2]).toBe('')
    expect(savedTpi.tags).toEqual(['React', 'API'])
  })

  it('round-trips lifecycle, journal and report follow-up fields', () => {
    const formData = normalizeTpiForForm({
      refTpi: '2164',
      status: 'defense_scheduled',
      journal: {
        status: 'in_progress',
        lastEntryAt: '2026-04-12T00:00:00.000Z',
        url: 'https://example.test/journal'
      },
      rapport: {
        status: 'submitted',
        submittedAt: '2026-06-04T00:00:00.000Z',
        dueAt: '2026-06-05T00:00:00.000Z',
        url: 'https://example.test/rapport.pdf'
      }
    })

    expect(formData.status).toBe('defense_scheduled')
    expect(formData.journalStatus).toBe('in_progress')
    expect(formData.journalLastEntryAt).toBe('2026-04-12')
    expect(formData.rapportStatus).toBe('submitted')
    expect(formData.rapportSubmittedAt).toBe('2026-06-04')

    const savedTpi = normalizeTpiForSave(formData)

    expect(savedTpi.status).toBe('defense_scheduled')
    expect(savedTpi.journal).toEqual({
      status: 'in_progress',
      lastEntryAt: '2026-04-12',
      url: 'https://example.test/journal',
      notes: ''
    })
    expect(savedTpi.rapport).toEqual({
      status: 'submitted',
      submittedAt: '2026-06-04',
      dueAt: '2026-06-05',
      url: 'https://example.test/rapport.pdf',
      feedback: ''
    })
  })

  it('builds a lifecycle summary from API validation metadata', () => {
    expect(getTpiLifecycleSummary({
      lifecycle: {
        status: 'report_review',
        blockingIssueCount: 0,
        warningCount: 1
      },
      journal: { status: 'validated' },
      rapport: { status: 'submitted' }
    })).toEqual({
      status: 'report_review',
      label: 'Rapport a suivre',
      journalStatus: 'validated',
      journalLabel: 'Valide',
      rapportStatus: 'submitted',
      rapportLabel: 'Depose',
      issueCount: 0,
      warningCount: 1,
      tone: 'warning'
    })
  })

  it('keeps explicit lifecycle counters even when stale validation issues remain', () => {
    expect(getTpiLifecycleSummary({
      lifecycle: {
        status: 'ready_for_planning',
        blockingIssueCount: 0,
        warningCount: 0
      },
      validation: {
        issues: [
          { severity: 'error', type: 'stale' },
          { severity: 'warning', type: 'stale_warning' }
        ]
      }
    })).toMatchObject({
      status: 'ready_for_planning',
      issueCount: 0,
      warningCount: 0,
      tone: 'neutral'
    })
  })
})
