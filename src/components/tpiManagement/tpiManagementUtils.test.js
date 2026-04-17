import {
  hasMissingStakeholders,
  getMissingStakeholders,
  getStakeholderIssues,
  hasStakeholderIssues,
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
})
