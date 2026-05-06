import {
  ROLE_OPTIONS,
  TPI_RELATION_LABELS,
  TPI_RELATION_ROLES,
  buildStakeholderStats,
  draftToStakeholderForm,
  filterStakeholders,
  getStakeholderDraftStatus,
  getTpiRelationRoleLabel,
  normalizeTpiRelationRole,
  normalizeRoleList,
  personHasStakeholderRole,
  splitStakeholderName,
  stakeholderFormToPayload,
  validateStakeholderForm
} from './stakeholderRules'

const people = [
  {
    _id: 'candidate-1',
    firstName: 'Alice',
    lastName: 'Martin',
    email: 'alice@example.com',
    roles: ['candidat'],
    candidateYears: [2026],
    site: 'Vennes',
    isActive: true
  },
  {
    _id: 'expert-1',
    firstName: 'Bob',
    lastName: 'Expert',
    email: 'bob@example.com',
    roles: ['expert'],
    site: 'Vennes',
    isActive: true
  },
  {
    _id: 'partial-lead',
    firstName: 'Diane',
    lastName: 'Boss',
    email: '',
    roles: ['chef_projet'],
    site: 'Sébeillon',
    isActive: true
  }
]

describe('stakeholderRules', () => {
  it('expose les rôles et relations depuis la définition partagée', () => {
    expect(ROLE_OPTIONS.map((role) => role.value)).toEqual([
      'candidat',
      'expert',
      'chef_projet',
      'admin'
    ])
    expect(TPI_RELATION_ROLES.map((relation) => relation.key)).toEqual([
      'candidat',
      'expert1',
      'expert2',
      'chef_projet'
    ])
    expect(TPI_RELATION_LABELS).toEqual({
      candidat: 'Candidat',
      expert1: 'Expert 1',
      expert2: 'Expert 2',
      chef_projet: 'Chef de projet'
    })
  })

  it('normalise les rôles legacy vers les rôles du référentiel', () => {
    expect(normalizeRoleList(['expert1', 'boss', 'admin'])).toEqual(['expert', 'chef_projet', 'admin'])
    expect(normalizeRoleList(['expert2', 'responsable'])).toEqual(['expert', 'chef_projet'])
  })

  it('normalise et formate les relations TPI depuis le catalogue partagé', () => {
    expect(normalizeTpiRelationRole('expert 1')).toBe('expert1')
    expect(normalizeTpiRelationRole('responsable')).toBe('chef_projet')
    expect(getTpiRelationRoleLabel('expert_2')).toBe('Expert 2')
    expect(getTpiRelationRoleLabel('boss')).toBe('Chef de projet')
    expect(getTpiRelationRoleLabel('expert')).toBe('Expert')
    expect(getTpiRelationRoleLabel('', 'Rôle')).toBe('Rôle')
  })

  it('ignore les placeholders textuels dans les noms', () => {
    expect(splitStakeholderName('null')).toEqual({ firstName: '', lastName: '' })
    expect(splitStakeholderName('Alice Martin')).toEqual({ firstName: 'Alice', lastName: 'Martin' })
  })

  it('filtre les candidats sur l année TPI demandée', () => {
    expect(personHasStakeholderRole(people[0], 'candidat', { year: 2026 })).toBe(true)
    expect(personHasStakeholderRole(people[0], 'candidat', { year: 2027 })).toBe(false)
    expect(personHasStakeholderRole(people[1], 'expert1', { year: 2027 })).toBe(true)
  })

  it('calcule les statuts de brouillon création, enrichissement et couverture', () => {
    expect(getStakeholderDraftStatus({ name: 'Alice Martin', role: 'candidat', year: 2026 }, people)).toMatchObject({
      type: 'resolved',
      person: people[0]
    })
    expect(getStakeholderDraftStatus({ name: 'Diane Boss', role: 'chef_projet', year: 2026 }, people)).toMatchObject({
      type: 'enrich',
      needs: ['Email à compléter']
    })
    expect(getStakeholderDraftStatus({ name: 'Carla Expert', role: 'expert', year: 2026 }, people)).toMatchObject({
      type: 'create'
    })
  })

  it('construit un formulaire depuis un brouillon candidat', () => {
    expect(draftToStakeholderForm({
      name: 'Alice Martin',
      role: 'candidat',
      year: 2026,
      site: 'Vennes',
      entreprise: 'ACME'
    })).toMatchObject({
      firstName: 'Alice',
      lastName: 'Martin',
      roles: ['candidat'],
      candidateYears: [2026],
      site: 'Vennes',
      entreprise: 'ACME'
    })
  })

  it('valide les données obligatoires et sérialise le payload API', () => {
    expect(validateStakeholderForm({
      firstName: '',
      lastName: 'Martin',
      email: 'alice@example.com',
      roles: ['candidat'],
      candidateYears: []
    })).toEqual(['Prénom requis.', 'Un candidat doit être associé à au moins une année.'])

    expect(stakeholderFormToPayload({
      firstName: ' Alice ',
      lastName: ' Martin ',
      email: 'ALICE@EXAMPLE.COM',
      roles: ['candidat', 'expert'],
      candidateYears: ['2026', '2026', 2025],
      sendEmails: false,
      isActive: true
    })).toMatchObject({
      firstName: 'Alice',
      lastName: 'Martin',
      email: 'alice@example.com',
      roles: ['candidat', 'expert'],
      candidateYears: [2025, 2026],
      sendEmails: false
    })
  })

  it('autorise les combinaisons de droits applicatifs et responsabilités TPI', () => {
    expect(validateStakeholderForm({
      firstName: 'Ada',
      lastName: 'Admin',
      email: 'ada@example.com',
      roles: ['admin', 'expert'],
      candidateYears: []
    })).toEqual([])
  })

  it('filtre et agrège les parties prenantes', () => {
    expect(filterStakeholders(people, { role: 'expert1', search: 'bob' })).toHaveLength(1)
    expect(filterStakeholders(people, { emailFilter: 'without' })).toEqual([people[2]])

    expect(buildStakeholderStats(people, [
      { name: 'Alice Martin', role: 'candidat', year: 2026 },
      { name: 'Carla Expert', role: 'expert', year: 2026 }
    ])).toMatchObject({
      total: 3,
      roleCounts: {
        candidat: 1,
        expert: 1,
        chef_projet: 1,
        admin: 0
      },
      draftStatusCounts: {
        create: 1,
        enrich: 0,
        resolved: 1
      }
    })
  })
})
