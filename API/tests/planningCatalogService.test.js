const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildDefaultPlanningCatalog,
  normalizeStoredCatalog
} = require('../services/planningCatalogService')

test('buildDefaultPlanningCatalog retourne un catalogue partage vide et reutilisable', () => {
  const catalog = buildDefaultPlanningCatalog()

  assert.equal(catalog.key, 'shared')
  assert.equal(catalog.schemaVersion, 2)
  assert.deepEqual(catalog.sites, [])
  assert.deepEqual(catalog.emailSettings, {
    senderName: 'TPI Organizer',
    senderEmail: '',
    replyToEmail: '',
    defaultDeliveryMode: 'outlook'
  })
  assert.deepEqual(catalog.publicationSettings, {
    publicBaseUrl: 'https://tpi26.ch'
  })
})

test('normalizeStoredCatalog conserve les sites, les adresses, les salles et les classes par site', () => {
  const catalog = normalizeStoredCatalog({
    key: 'shared',
    emailSettings: {
      senderName: 'Commission TPI',
      senderEmail: ' TPI@EXAMPLE.CH ',
      replyToEmail: ' SUPPORT@EXAMPLE.CH ',
      defaultDeliveryMode: 'automatic'
    },
    publicationSettings: {
      publicBaseUrl: ' publication.example.ch/ '
    },
    stakeholderIcons: {
      candidate: 'candidate-violet',
      expert1: 'helmet-orange',
      expert2: 'helmet-blue',
      projectManager: 'helmet-gray'
    },
    sites: [
      {
        code: 'ETML',
        label: 'ETML Sébeillon',
        planningColor: '#14532d',
        tpiColor: '#fee2e2',
        soutenanceColor: '#0f766e',
        address: {
          street: 'Avenue de Sévelin 32',
          zip: '1004',
          city: 'Lausanne',
          canton: 'VD',
          country: 'Suisse'
        },
        roomDetails: [
          { code: 'N101', label: 'N101', capacity: 20, soutenanceColor: '#be185d' },
          { code: 'N101', label: 'N101', capacity: 20 },
          { code: 'N102', label: 'N102', capacity: 24, active: false }
        ],
        classGroups: [
          {
            baseType: 'CFC',
            classes: [
              { code: 'CID', label: 'CID', description: 'Classe CID' }
            ]
          }
        ],
        notes: 'Site principal'
      },
      {
        code: 'CFPV',
        name: 'CFPV Centre',
        address: {
          line1: 'Rue de la Concorde 10',
          postalCode: '2000',
          city: 'Neuchâtel'
        },
        rooms: ['C01', 'C01', 'C02'],
        notes: 'Site secondaire'
      }
    ]
  })

  const etml = catalog.sites.find((site) => site.code === 'ETML')
  const cfpv = catalog.sites.find((site) => site.code === 'CFPV')

  assert.ok(etml)
  assert.ok(cfpv)
  assert.equal(etml.label, 'ETML Sébeillon')
  assert.equal(etml.planningColor, '#14532D')
  assert.equal(etml.tpiColor, '#FEE2E2')
  assert.equal(etml.soutenanceColor, '#0F766E')
  assert.deepEqual(catalog.stakeholderIcons, {
    candidate: 'candidate-violet',
    expert1: 'helmet-orange',
    expert2: 'helmet-blue',
    projectManager: 'helmet-gray'
  })
  assert.deepEqual(catalog.emailSettings, {
    senderName: 'Commission TPI',
    senderEmail: 'tpi@example.ch',
    replyToEmail: 'support@example.ch',
    defaultDeliveryMode: 'automatic'
  })
  assert.deepEqual(catalog.publicationSettings, {
    publicBaseUrl: 'https://publication.example.ch'
  })
  assert.deepEqual(etml.rooms, ['N101', 'N102'])
  assert.equal(etml.roomDetails.length, 2)
  assert.equal(etml.roomDetails[0].code, 'N101')
  assert.equal(etml.roomDetails[0].capacity, 20)
  assert.equal(etml.roomDetails[0].soutenanceColor, '#BE185D')
  assert.equal(etml.roomDetails[1].code, 'N102')
  assert.equal(etml.roomDetails[1].active, false)
  assert.deepEqual(
    etml.classGroups.map((group) => group.baseType),
    ['CFC', 'FPA', 'MATU']
  )
  assert.equal(etml.classGroups[0].classes.length, 1)
  assert.equal(etml.classGroups[0].classes[0].code, 'CID')
  assert.equal(etml.classGroups[0].classes[0].description, 'Classe CID')
  assert.equal(etml.address.line1, 'Avenue de Sévelin 32')
  assert.equal(etml.address.postalCode, '1004')
  assert.equal(etml.address.city, 'Lausanne')
  assert.equal(etml.address.canton, 'VD')
  assert.equal(etml.address.country, 'Suisse')
  assert.equal(etml.notes, 'Site principal')
  assert.equal(cfpv.label, 'CFPV Centre')
  assert.deepEqual(cfpv.rooms, ['C01', 'C02'])
  assert.deepEqual(
    cfpv.classGroups.map((group) => group.baseType),
    ['CFC', 'FPA', 'MATU']
  )
  assert.equal(cfpv.address.line1, 'Rue de la Concorde 10')
  assert.equal(cfpv.address.postalCode, '2000')
  assert.equal(cfpv.address.city, 'Neuchâtel')
  assert.equal(cfpv.notes, 'Site secondaire')
})

test('normalizeStoredCatalog retire les sites absents du payload explicite', () => {
  const catalog = normalizeStoredCatalog(
    {
      key: 'shared',
      sites: [
        {
          id: 'site-etml',
          code: 'ETML',
          label: 'ETML'
        }
      ]
    },
    {
      key: 'shared',
      schemaVersion: 2,
      sites: [
        {
          id: 'site-etml',
          code: 'ETML',
          label: 'ETML'
        },
        {
          id: 'site-cfpv',
          code: 'CFPV',
          label: 'CFPV'
        }
      ]
    }
  )

  assert.deepEqual(
    catalog.sites.map((site) => site.code),
    ['ETML']
  )
})

test('normalizeStoredCatalog conserve les couleurs de salle du fallback avec une liste rooms simple', () => {
  const catalog = normalizeStoredCatalog(
    {
      key: 'shared',
      sites: [
        {
          code: 'ETML',
          rooms: ['N101']
        }
      ]
    },
    {
      key: 'shared',
      schemaVersion: 2,
      sites: [
        {
          code: 'ETML',
          roomDetails: [
            {
              id: 'room-n101',
              code: 'N101',
              label: 'N101',
              soutenanceColor: '#be185d'
            }
          ]
        }
      ]
    }
  )

  assert.equal(catalog.sites[0].roomDetails[0].id, 'room-n101')
  assert.equal(catalog.sites[0].roomDetails[0].soutenanceColor, '#BE185D')
})

test('normalizeStoredCatalog conserve la suppression explicite de toutes les salles d un site', () => {
  const catalog = normalizeStoredCatalog(
    {
      key: 'shared',
      sites: [
        {
          id: 'site-etml',
          code: 'ETML',
          label: 'ETML',
          roomDetails: []
        }
      ]
    },
    {
      key: 'shared',
      schemaVersion: 2,
      sites: [
        {
          id: 'site-etml',
          code: 'ETML',
          label: 'ETML',
          roomDetails: [
            { code: 'A101', label: 'A101' },
            { code: 'A102', label: 'A102' }
          ]
        }
      ]
    }
  )

  assert.equal(catalog.sites[0].roomDetails.length, 0)
  assert.deepEqual(catalog.sites[0].rooms, [])
})
