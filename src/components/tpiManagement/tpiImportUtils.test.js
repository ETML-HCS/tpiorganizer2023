import { buildImportProcessingReport } from './tpiImportUtils.js'

describe('buildImportProcessingReport', () => {
  it('imports a compact row with the expected fields', () => {
    const report = buildImportProcessingReport([
      {
        'N° de TPI': '1001',
        Candidat: 'Alice Martin',
        'Chef de projet': 'Chef Projet',
        'Expert 1': 'Expert Un',
        'Expert 2': 'Expert Deux',
        Entreprise: 'ETML',
        Lieu: 'Vennes',
        Sujet: 'Sujet A',
        Domaine: 'Web',
        'Mots clés': 'React, API'
      }
    ])

    expect(report.tpis).toHaveLength(1)
    expect(report.summary.skippedRows).toHaveLength(0)
    expect(report.summary.duplicateRows).toHaveLength(0)
    expect(report.tpis[0]).toMatchObject({
      refTpi: '1001',
      candidat: 'Alice Martin',
      boss: 'Chef Projet',
      experts: {
        1: 'Expert Un',
        2: 'Expert Deux'
      }
    })
  })

  it('skips an incomplete compact row and explains why', () => {
    const report = buildImportProcessingReport([
      {
        'N° de TPI': '1002',
        Candidat: 'Bob Martin',
        'Chef de projet': 'Chef Projet',
        'Expert 1': 'Expert Un'
      }
    ])

    expect(report.tpis).toHaveLength(0)
    expect(report.summary.skippedRows).toHaveLength(1)
    expect(report.summary.skippedRows[0].reasons).toContain('expert 2')
  })

  it('keeps legacy expert rows and merges the experts by reference', () => {
    const report = buildImportProcessingReport([
      {
        'N° de TPI': '1003',
        Candidat: 'Charlie Martin',
        'Chef de projet': 'Chef Projet',
        Expert: 'Expert Un',
        'Expert no': '1'
      },
      {
        'N° de TPI': '1003',
        Candidat: 'Charlie Martin',
        'Chef de projet': 'Chef Projet',
        Expert: 'Expert Deux',
        'Expert no': '2'
      }
    ])

    expect(report.tpis).toHaveLength(1)
    expect(report.summary.legacyRows).toHaveLength(2)
    expect(report.tpis[0].experts[1]).toBe('Expert Un')
    expect(report.tpis[0].experts[2]).toBe('Expert Deux')
  })
})
