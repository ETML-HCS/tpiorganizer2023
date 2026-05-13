import {
  buildGestionTpiSyncModelMap,
  buildPlanningTpiFromGestionModel,
  buildPlanningTpiSyncSummary,
  buildRoomsWithGestionTpiSync,
  getGestionTpiSyncFields,
  getTpiSyncChangedFields,
  hasPlanningTpiSyncDifference
} from './tpiScheduleSync'

const sourceTpi = {
  refTpi: 'TPI-001',
  candidat: 'Alice Martin',
  candidatPersonId: 'candidate-1',
  classe: 'MID4A',
  experts: {
    1: 'Expert One',
    2: 'Expert Two'
  },
  expert1PersonId: 'expert-1',
  expert2PersonId: 'expert-2',
  boss: 'Chef Projet',
  bossPersonId: 'boss-1',
  lieu: {
    entreprise: 'ETML',
    site: 'Vennes'
  },
  sujet: 'Sujet synchronisé',
  description: 'Description synchronisée'
}

const planningTpi = {
  refTpi: 'TPI-001',
  candidat: 'Alice Old',
  candidatPersonId: 'candidate-old',
  classe: 'OLD',
  expert1: {
    name: 'Expert Old',
    personId: 'expert-old',
    offres: {
      isValidated: true,
      submit: [{ date: '2026-06-10', creneau: 1 }]
    }
  },
  expert2: {
    name: 'Expert Two',
    personId: 'expert-2',
    offres: {
      isValidated: false,
      submit: []
    }
  },
  boss: {
    name: 'Chef Projet',
    personId: 'boss-1',
    offres: {
      isValidated: false,
      submit: []
    }
  },
  lieu: {
    entreprise: 'ETML',
    site: 'Vennes'
  },
  sujet: 'Ancien sujet',
  description: 'Ancienne description'
}

describe('tpiScheduleSync', () => {
  test('détecte les TPI planifiés qui diffèrent de GestionTPI', () => {
    const summary = buildPlanningTpiSyncSummary(
      [
        {
          tpiDatas: [
            planningTpi,
            { refTpi: 'TPI-002', candidat: 'Bob' }
          ]
        }
      ],
      [
        sourceTpi,
        { refTpi: 'TPI-002', candidat: 'Bob' }
      ]
    )

    expect(summary.count).toBe(1)
    expect(summary.entries).toHaveLength(1)
    expect(summary.entries[0]).toMatchObject({
      slotKey: '0:0',
      refTpi: 'TPI-001'
    })
    expect(summary.entries[0].changedLabels).toEqual(
      expect.arrayContaining(['candidat', 'expert 1', 'sujet'])
    )
  })

  test('détecte les champs internes absents des anciennes cartes même si les noms visibles sont identiques', () => {
    const summary = buildPlanningTpiSyncSummary(
      [
        {
          tpiDatas: [
            {
              refTpi: 'TPI-001',
              candidat: 'Alice Martin',
              expert1: { name: 'Expert One', offres: {} },
              expert2: { name: 'Expert Two', offres: {} },
              boss: { name: 'Chef Projet', offres: {} }
            }
          ]
        }
      ],
      [sourceTpi]
    )

    expect(summary.count).toBe(1)
    expect(summary.entries[0].changedFields).toEqual(
      expect.arrayContaining(['candidatPersonId', 'expert1PersonId', 'expert2PersonId', 'bossPersonId'])
    )
  })

  test('détecte les métadonnées absentes des anciennes cartes planifiées', () => {
    const summary = buildPlanningTpiSyncSummary(
      [
        {
          tpiDatas: [
            {
              refTpi: 'TPI-001',
              candidat: 'Alice Martin',
              expert1: { name: 'Expert One', offres: {} },
              expert2: { name: 'Expert Two', offres: {} },
              boss: { name: 'Chef Projet', offres: {} },
              lieu: {}
            }
          ]
        }
      ],
      [sourceTpi]
    )

    expect(summary.count).toBe(1)
    expect(summary.entries[0].changedFields).toEqual(
      expect.arrayContaining(['classe', 'lieuEntreprise', 'lieuSite', 'sujet', 'description'])
    )
  })

  test('ignore les variations de casse, espaces, accents et apostrophes typographiques', () => {
    const summary = buildPlanningTpiSyncSummary(
      [
        {
          tpiDatas: [
            {
              refTpi: ' tpi-001 ',
              candidat: " elise   d'arc ",
              expert1: { name: 'expert one', personId: 'expert-1', offres: {} },
              expert2: { name: 'EXPERT TWO', personId: 'expert-2', offres: {} },
              boss: { name: 'chef projet', personId: 'boss-1', offres: {} },
              candidatPersonId: 'candidate-1',
              classe: 'MID4A',
              lieu: {
                entreprise: 'ETML',
                site: 'Vennes'
              },
              sujet: 'Sujet synchronisé',
              description: 'Description synchronisée'
            }
          ]
        }
      ],
      [
        {
          ...sourceTpi,
          candidat: 'Élise d’Arc'
        }
      ]
    )

    expect(summary.count).toBe(0)
    expect(summary.entries).toEqual([])
  })

  test('compte une référence TPI une seule fois même si plusieurs slots doivent être mis à jour', () => {
    const summary = buildPlanningTpiSyncSummary(
      [
        {
          tpiDatas: [
            planningTpi,
            {
              ...planningTpi,
              id: 'duplicate-slot',
              candidat: 'Alice Encore Old'
            }
          ]
        }
      ],
      [sourceTpi]
    )

    expect(summary.count).toBe(1)
    expect(summary.refs).toEqual(['tpi-001'])
    expect(summary.entries).toHaveLength(2)
    expect(summary.entries.map((entry) => entry.slotKey)).toEqual(['0:0', '0:1'])
  })

  test('retourne un état indéterminé tant que les modèles GestionTPI ne sont pas chargés', () => {
    const summary = buildPlanningTpiSyncSummary([{ tpiDatas: [planningTpi] }], null)

    expect(summary).toEqual({
      count: null,
      refs: [],
      entries: []
    })
  })

  test('détecte toujours un vrai changement de nom visible', () => {
    expect(
      getTpiSyncChangedFields(
        {
          refTpi: 'TPI-001',
          candidat: 'Alice Dupont',
          expert1: { name: 'Expert One', offres: {} },
          expert2: { name: 'Expert Two', offres: {} },
          boss: { name: 'Chef Projet', offres: {} }
        },
        sourceTpi
      )
    ).toEqual(expect.arrayContaining(['candidat']))
  })

  test('détecte une différence d ID interne quand les deux valeurs sont connues', () => {
    expect(
      getTpiSyncChangedFields(
        {
          refTpi: 'TPI-001',
          candidat: 'Alice Martin',
          candidatPersonId: 'candidate-other',
          expert1: { name: 'Expert One', personId: 'expert-other', offres: {} },
          expert2: { name: 'Expert Two', personId: 'expert-2', offres: {} },
          boss: { name: 'Chef Projet', personId: 'boss-1', offres: {} }
        },
        sourceTpi
      )
    ).toEqual(expect.arrayContaining(['candidatPersonId', 'expert1PersonId']))
  })

  test('détecte les métadonnées quand elles existent déjà dans la planification', () => {
    expect(getTpiSyncChangedFields(planningTpi, sourceTpi)).toEqual(
      expect.arrayContaining(['classe', 'sujet', 'description'])
    )
  })

  test('normalise les alias GestionTPI utilisés par les anciens flux', () => {
    expect(
      getGestionTpiSyncFields({
        tpiRef: 'TPI-ALT',
        candidat: 'Alice Martin',
        expert1: 'Expert Un',
        expert2: 'Expert Deux',
        chefProjet: 'Chef Projet',
        chefProjetPersonId: 'boss-alt',
        entreprise: 'ETML',
        site: 'Vennes',
        domaine: 'Ancien domaine'
      })
    ).toMatchObject({
      refTpi: 'TPI-ALT',
      expert1Name: 'Expert Un',
      expert2Name: 'Expert Deux',
      bossName: 'Chef Projet',
      bossPersonId: 'boss-alt',
      lieuEntreprise: 'ETML',
      lieuSite: 'Vennes',
      description: 'Ancien domaine'
    })
  })

  test('indexe les modèles GestionTPI par référence normalisée et conserve le premier doublon', () => {
    const modelsByRef = buildGestionTpiSyncModelMap([
      { refTpi: ' TPI-001 ', candidat: 'Premier' },
      { reference: 'tpi-001', candidat: 'Doublon' },
      { tpiRef: 'TPI-002', candidat: 'Deuxième' }
    ])

    expect(modelsByRef.get('tpi-001')).toMatchObject({ candidat: 'Premier' })
    expect(modelsByRef.get('tpi-002')).toMatchObject({ candidat: 'Deuxième' })
  })

  test('construit une carte planifiée synchronisée en conservant les offres existantes', () => {
    const updatedTpi = buildPlanningTpiFromGestionModel(planningTpi, sourceTpi)

    expect(updatedTpi).toMatchObject({
      refTpi: 'TPI-001',
      candidat: 'Alice Martin',
      candidatPersonId: 'candidate-1',
      classe: 'MID4A',
      expert1: {
        name: 'Expert One',
        personId: 'expert-1'
      },
      sujet: 'Sujet synchronisé',
      description: 'Description synchronisée'
    })
    expect(updatedTpi.expert1.offres.submit).toEqual([
      { date: '2026-06-10', creneau: 1 }
    ])
  })

  test('réinitialise les offres quand la synchronisation ne doit pas les préserver', () => {
    const updatedTpi = buildPlanningTpiFromGestionModel(planningTpi, sourceTpi, {
      preserveOffers: false
    })

    expect(updatedTpi.expert1.offres).toEqual({
      isValidated: false,
      submit: []
    })
  })

  test('conserve le créneau existant pendant une synchronisation', () => {
    const updatedTpi = buildPlanningTpiFromGestionModel(
      {
        ...planningTpi,
        period: 3
      },
      sourceTpi
    )

    expect(updatedTpi.period).toBe(3)
  })

  test('conserve le verrou de planification pendant une synchronisation', () => {
    const updatedTpi = buildPlanningTpiFromGestionModel(
      {
        ...planningTpi,
        isPlanningSealed: true
      },
      sourceTpi
    )

    expect(updatedTpi.isPlanningSealed).toBe(true)
  })

  test('synchronise les salles ciblées en conservant les offres et les créneaux', () => {
    const summary = buildPlanningTpiSyncSummary(
      [
        {
          idRoom: 1,
          lastUpdate: 100,
          tpiDatas: [
            planningTpi,
            { refTpi: 'TPI-002', candidat: 'Bob' }
          ]
        }
      ],
      [sourceTpi]
    )

    const result = buildRoomsWithGestionTpiSync(
      [
        {
          idRoom: 1,
          lastUpdate: 100,
          tpiDatas: [
            planningTpi,
            { refTpi: 'TPI-002', candidat: 'Bob' }
          ]
        }
      ],
      summary.entries,
      [sourceTpi],
      { updatedAt: 1234 }
    )

    expect(result.refCount).toBe(1)
    expect(result.updatedSlotCount).toBe(1)
    expect(result.rooms[0].lastUpdate).toBe(1234)
    expect(result.rooms[0].tpiDatas[0]).toMatchObject({
      refTpi: 'TPI-001',
      candidat: 'Alice Martin',
      period: null,
      sujet: 'Sujet synchronisé'
    })
    expect(result.rooms[0].tpiDatas[0].expert1.offres.submit).toEqual([
      { date: '2026-06-10', creneau: 1 }
    ])
    expect(result.rooms[0].tpiDatas[1]).toEqual({ refTpi: 'TPI-002', candidat: 'Bob' })
  })

  test('ignore les différences après synchronisation', () => {
    const updatedTpi = buildPlanningTpiFromGestionModel(planningTpi, sourceTpi)

    expect(getTpiSyncChangedFields(updatedTpi, sourceTpi)).toEqual([])
    expect(hasPlanningTpiSyncDifference(updatedTpi, sourceTpi)).toBe(false)
  })
})
