import {
  buildStakeholderImportPreview,
  detectImportDelimiter,
  normalizeImportOptions,
  parseImportDelimitedLine
} from './stakeholderImportUtils'

describe('stakeholderImportUtils', () => {
  it('détecte les formats CSV/TSV supportés', () => {
    expect(detectImportDelimiter('Nom;email\nAlice;a@example.com')).toBe(';')
    expect(detectImportDelimiter('Nom,email\nAlice,a@example.com')).toBe(',')
    expect(detectImportDelimiter('Nom\temail\nAlice\ta@example.com')).toBe('\t')
  })

  it('parse les cellules citées sans casser les séparateurs internes', () => {
    expect(parseImportDelimitedLine('"Alice; Martin";alice@example.com', ';')).toEqual([
      'Alice; Martin',
      'alice@example.com'
    ])
  })

  it('prévisualise les colonnes obligatoires et les lignes exemples', () => {
    const preview = buildStakeholderImportPreview([
      'Candidat;Expert mail;tel;site',
      'Alice Martin;alice@example.com;079 000 00 00;Vennes'
    ].join('\n'))

    expect(preview.canImport).toBe(true)
    expect(preview.recognizedFields).toEqual(['name', 'email', 'phone', 'site'])
    expect(preview.sampleRows[0]).toMatchObject({
      name: 'Alice Martin',
      email: 'alice@example.com',
      phone: '079 000 00 00',
      site: 'Vennes'
    })
  })

  it('refuse une prévisualisation sans nom ou email', () => {
    const preview = buildStakeholderImportPreview('Nom;site\nAlice Martin;Vennes')

    expect(preview.canImport).toBe(false)
    expect(preview.missingRequiredFields).toEqual(['email'])
  })

  it('normalise les options d import en excluant le rôle admin', () => {
    expect(normalizeImportOptions({
      defaultSite: ' Vennes ',
      defaultRoles: ['expert1', 'admin']
    })).toEqual({
      defaultSite: 'Vennes',
      defaultRoles: ['expert']
    })
  })
})
