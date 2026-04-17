import {
  buildDefaultImportMapping,
  buildImportProcessingReport,
  getMissingRequiredMappingKeys
} from './tpiImportWorkflow.js'

describe('tpiImportWorkflow', () => {
  it('auto-detects the current Excel headers', () => {
    const headers = [
      'N',
      'Eleve',
      'Classe',
      'Ent TPI',
      'Lieu',
      'Chef de projet',
      'Expert1',
      'Expert2',
      'Sujet',
      'Client',
      'Début TPI',
      'Mots clés',
      'Domaine'
    ]

    const mapping = buildDefaultImportMapping(headers)

    expect(mapping.refTpi).toBe('N')
    expect(mapping.candidat).toBe('Eleve')
    expect(mapping.classe).toBe('Classe')
    expect(mapping.entreprise).toBe('Ent TPI')
    expect(mapping.site).toBe('Lieu')
    expect(mapping.boss).toBe('Chef de projet')
    expect(mapping.expert1).toBe('Expert1')
    expect(mapping.expert2).toBe('Expert2')
    expect(mapping.description).toBe('Domaine')
    expect(mapping.tags).toBe('Mots clés')
    expect(getMissingRequiredMappingKeys(mapping)).toEqual([])
  })

  it('imports a compact row with manual mapping and ignores the rest', () => {
    const rows = [
      {
        N: '1001',
        Eleve: 'Alice Martin',
        Classe: '6P',
        'Ent TPI': 'ETML',
        Lieu: 'Vennes',
        'Chef de projet': 'Chef Projet',
        Expert1: 'Expert Un',
        Expert2: 'Expert Deux',
        Sujet: 'Sujet A',
        Client: 'A ignorer',
        'Début TPI': '10.06.2026',
        'Mots clés': 'React, API',
        Domaine: 'Web'
      }
    ]

    const mapping = {
      refTpi: 'N',
      candidat: 'Eleve',
      classe: 'Classe',
      entreprise: 'Ent TPI',
      site: 'Lieu',
      boss: 'Chef de projet',
      expert1: 'Expert1',
      expert2: 'Expert2',
      sujet: 'Sujet',
      description: 'Domaine',
      tags: 'Mots clés',
      salle: '',
      dateDepart: '',
      dateFin: '',
      legacyExpert: '',
      legacyExpertNo: ''
    }

    const report = buildImportProcessingReport(rows, mapping)

    expect(report.summary.mode).toBe('compact')
    expect(report.tpis).toHaveLength(1)
    expect(report.summary.skippedRows).toHaveLength(0)
    expect(report.summary.duplicateRows).toHaveLength(0)
    expect(report.tpis[0]).toMatchObject({
      refTpi: '1001',
      candidat: 'Alice Martin',
      classe: '6P',
      boss: 'Chef Projet',
      experts: {
        1: 'Expert Un',
        2: 'Expert Deux'
      }
    })
  })

  it('preserves classe from the 2026 CSV headers', () => {
    const rows = [
      {
        N: '2308',
        Candidat: 'Tecle Siem Biniam',
        Classe: 'CIN4',
        'Ent TPI': '',
        Lieu: 'A22',
        'Chef de projet': 'Alexis Gugler',
        Expert1: 'Jean-Luc Roduit',
        Expert2: 'Arnaud Sartoni',
        Sujet: 'Déploiement d’un serveur web IIS',
        'Mots clé': 'VPN, IIS',
        Domaine: 'Infrastructure'
      }
    ]

    const mapping = buildDefaultImportMapping(Object.keys(rows[0]))
    const report = buildImportProcessingReport(rows, mapping)

    expect(report.tpis).toHaveLength(1)
    expect(report.tpis[0].classe).toBe('CIN4')
  })

  it('supports legacy rows when expert columns are provided one row at a time', () => {
    const report = buildImportProcessingReport([
      {
        'N° de TPI': '2001',
        Candidat: 'Bob Martin',
        'Chef de projet': 'Chef Projet',
        Expert: 'Expert Un',
        'Expert no': '1'
      },
      {
        'N° de TPI': '2001',
        Candidat: 'Bob Martin',
        'Chef de projet': 'Chef Projet',
        Expert: 'Expert Deux',
        'Expert no': '2'
      }
    ])

    expect(report.summary.mode).toBe('legacy')
    expect(report.tpis).toHaveLength(1)
    expect(report.summary.legacyRows).toHaveLength(2)
    expect(report.tpis[0].experts[1]).toBe('Expert Un')
    expect(report.tpis[0].experts[2]).toBe('Expert Deux')
  })
})
