const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')

const {
  buildStaticAccessDeniedHtml,
  buildStaticDefenseHtml,
  buildStaticDefensePhp,
  flattenPublishedRooms,
  getStaticPublicationStatus,
  listStaticPublicationAccessLinks
} = require('../services/staticDefensePublicationService')
const { MagicLink } = require('../models/magicLinkModel')
const Person = require('../models/personModel')
const { replaceProperty, makeQueryResult } = require('./helpers/stubSandbox')

const STATIC_PUBLICATION_ENV_KEYS = [
  'FTP_HOST',
  'FTP_PASSWORD',
  'FTP_PORT',
  'FTP_PROTOCOL',
  'FTP_REMOTE_DIR',
  'FTP_STATIC_DEFENSE_PUBLIC_PATH',
  'FTP_STATIC_DEFENSE_REMOTE_DIR',
  'FTP_STATIC_REMOTE_DIR',
  'FTP_STATIC_PUBLIC_PATH',
  'FTP_USER',
  'PUBLICATION_FTP_PROTOCOL',
  'PUBLIC_SITE_BASE_URL',
  'STATIC_DEFENSE_PUBLIC_PATH',
  'STATIC_DEFENSE_PUBLICATION_PUBLIC_PATH',
  'STATIC_PUBLIC_BASE_URL',
  'STATIC_PUBLIC_PATH',
  'STATIC_PUBLICATION_DIR',
  'STATIC_PUBLICATION_PUBLIC_PATH'
]

async function withPublicationEnv(values, run) {
  const previousValues = new Map(
    STATIC_PUBLICATION_ENV_KEYS.map((key) => [key, process.env[key]])
  )

  for (const key of STATIC_PUBLICATION_ENV_KEYS) {
    delete process.env[key]
  }

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) {
      process.env[key] = value
    }
  }

  try {
    return await run()
  } finally {
    for (const key of STATIC_PUBLICATION_ENV_KEYS) {
      const previousValue = previousValues.get(key)
      if (previousValue === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = previousValue
      }
    }
  }
}

function extractStaticPayload(html) {
  const match = html.match(/<script id="defense-data" type="application\/json">([\s\S]*?)<\/script>/)
  assert.ok(match, 'static defense payload script should exist')
  return match[1]
}

function extractStaticRuntimeScript(html) {
  const scripts = Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))
  const runtimeScript = scripts.find(([, content]) => content.includes('function getFilteredRooms'))
  assert.ok(runtimeScript, 'static defense runtime script should exist')
  return runtimeScript[1]
}

function createFakeStaticElement(id) {
  const classes = new Set()
  const listeners = new Map()

  return {
    id,
    textContent: '',
    innerHTML: '',
    className: '',
    disabled: false,
    href: '',
    value: '',
    style: {
      setProperty() {}
    },
    classList: {
      add(className) {
        classes.add(className)
      },
      remove(className) {
        classes.delete(className)
      },
      toggle(className, force) {
        const shouldAdd = force === undefined ? !classes.has(className) : Boolean(force)
        if (shouldAdd) {
          classes.add(className)
        } else {
          classes.delete(className)
        }
        return shouldAdd
      },
      contains(className) {
        return classes.has(className)
      }
    },
    addEventListener(eventName, handler) {
      const handlers = listeners.get(eventName) || []
      handlers.push(handler)
      listeners.set(eventName, handlers)
    },
    dispatchEvent(event = {}) {
      const eventName = event.type || event
      const handlers = listeners.get(eventName) || []
      handlers.forEach((handler) => handler(event))
    },
    click() {
      this.dispatchEvent({ type: 'click', target: this })
    },
    setAttribute(name, value) {
      this[name] = String(value)
    },
    removeAttribute(name) {
      delete this[name]
    }
  }
}

function runStaticDefenseRuntime(html, viewer) {
  const elements = new Map()
  const getElement = (id) => {
    if (!elements.has(id)) {
      elements.set(id, createFakeStaticElement(id))
    }

    return elements.get(id)
  }

  getElement('defense-data').textContent = extractStaticPayload(html)

  const windowObject = {
    location: {
      href: 'https://tpi26.test/soutenances-2026/?ml=test-token',
      search: '?ml=test-token'
    },
    history: {
      replaceState() {}
    },
    innerWidth: 1280,
    __STATIC_MAGIC_LINK_VALIDATED__: true,
    __STATIC_MAGIC_LINK_VIEWER__: viewer,
    addEventListener() {},
    focus() {},
    setTimeout() {}
  }

  const context = {
    window: windowObject,
    document: {
      getElementById: getElement,
      createElement: (tagName) => ({
        ...createFakeStaticElement(tagName),
        click() {}
      }),
      body: {
        appendChild() {},
        removeChild() {}
      }
    },
    URL,
    URLSearchParams,
    Blob: function Blob() {},
    console,
    encodeURIComponent,
    Intl,
    Promise,
    Set,
    Map,
    Array,
    Object,
    String,
    Number,
    Math,
    Date,
    JSON,
    RegExp
  }
  context.globalThis = context

  vm.runInNewContext(extractStaticRuntimeScript(html), context)
  return elements
}

test('flattenPublishedRooms prepares defense rows with schedule data', () => {
  const rows = flattenPublishedRooms([
    {
      idRoom: 1,
      site: 'ETML',
      name: 'A101',
      date: '2026-06-10',
      roomClassMode: 'matu',
      configSite: {
        numSlots: 2,
        firstTpiStart: 8,
        tpiTime: 1,
        breakline: 0.25
      },
      tpiDatas: [
        {
          id: 'room-1_1',
          period: 2,
          refTpi: '2163',
          candidat: 'Alice Candidate',
          expert1: { name: 'Expert One' },
          expert2: { name: 'Expert Two' },
          boss: { name: 'Boss One' }
        }
      ]
    }
  ])

  assert.equal(rows.length, 1)
  assert.equal(rows[0].date, '2026-06-10')
  assert.equal(rows[0].site, 'ETML')
  assert.equal(rows[0].room, 'A101')
  assert.equal(rows[0].classType, 'MATU')
  assert.equal(rows[0].time, '09:15 - 10:15')
  assert.equal(rows[0].candidate, 'Alice Candidate')
})

test('flattenPublishedRooms laisse les salles AUTRE sans badge', () => {
  const rows = flattenPublishedRooms([
    {
      idRoom: 2,
      site: 'ETML',
      name: 'A102',
      date: '2026-06-11',
      roomClassMode: 'other',
      configSite: {
        numSlots: 1,
        firstTpiStart: 8,
        tpiTime: 1,
        breakline: 0.25
      },
      tpiDatas: [
        {
          id: 'room-2_0',
          period: 1,
          refTpi: '2164',
          candidat: 'Bob Candidate'
        }
      ]
    }
  ])

  assert.equal(rows.length, 1)
  assert.equal(rows[0].classType, '')
})

test('buildStaticDefenseHtml embeds data and static rendering script in one html file', () => {
  const html = buildStaticDefenseHtml({
    year: 2026,
    generatedAt: '2026-05-01T10:00:00.000Z',
    publicationVersion: 2,
    publicationPublishedAt: '2026-04-30T08:30:00.000Z',
    rooms: [
      {
        idRoom: 1,
        date: '2026-06-10',
        site: 'ETML',
        name: 'A101',
        roomClassMode: 'matu',
        configSite: {
          numSlots: 1,
          firstTpiStart: 8,
          tpiTime: 1,
          breakline: 0.25
        },
        tpiDatas: [
          {
            id: 'room-1_1',
            period: 1,
            refTpi: '2163',
            candidat: 'Alice Candidate',
            expert1: { name: 'Expert One' },
            expert2: { name: 'Expert Two' },
            boss: { name: 'Boss One' }
          }
        ]
      }
    ]
  })

  assert.match(html, /<title>Défenses 2026<\/title>/)
  assert.match(html, /rel="icon" href="favicon\.ico"/)
  assert.match(html, /rel="apple-touch-icon" href="logo192\.png"/)
  assert.match(html, /id="defense-data"/)
  assert.match(html, /tpi-soutenance-page static-soutenance-page/)
  assert.match(html, /soutenance-toolbar/)
  assert.doesNotMatch(html, /static-title-version/)
  assert.doesNotMatch(html, />v2<\/span>/)
  assert.match(html, /Publication du/)
  assert.doesNotMatch(html, /page créée le/)
  assert.match(html, /salles-container/)
  assert.match(html, /Alice Candidate/)
  assert.match(html, /MATU/)
  assert.match(html, /URLSearchParams/)
  assert.match(html, /magic-link\/resolve/)
  assert.match(html, /doesTpiMatchViewer/)
  assert.doesNotMatch(html, /Lien filtré/)
  assert.doesNotMatch(html, /id="filter-date"/)
  assert.doesNotMatch(html, /id="copy-link"/)
  assert.doesNotMatch(html, /id="reset-filters"/)
  assert.doesNotMatch(html, /id="static-fullscreen"/)
  assert.doesNotMatch(html, /id="clear-focus"/)
  assert.match(html, /class="soutenance-hero-fullscreen-action static-hero-pdf-action"/)
  assert.match(html, /triggerStaticPrint/)
  assert.match(html, /id="static-print-schedule"/)
  assert.match(html, /renderPrintSchedule/)
  assert.match(html, /static-print-table/)
  assert.match(html, /id="static-person-ical"/)
  assert.match(html, /id="static-person-ical-download"/)
  assert.match(html, /id="static-person-vote-link"/)
  assert.doesNotMatch(html, /id="static-person-vote-meta"/)
  assert.match(html, /id="static-person-publication-warning"/)
  assert.match(html, /Demander une modification/)
  assert.match(html, /Formulaire actif/)
  assert.match(html, /id="static-general-view-toggle"/)
  assert.match(html, /id="static-general-filters"/)
  assert.match(html, /id="static-general-filter-date"/)
  assert.match(html, /id="static-general-filter-class-type"/)
  assert.match(html, /Filtrer la vue générale par date/)
  assert.match(html, /Filtrer la vue générale par type de classe/)
  assert.match(html, /align-items: stretch/)
  assert.match(html, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(html, /static-general-filters \.soutenance-toolbar-filters/)
  assert.match(html, /soutenance-person-vote-button/)
  assert.match(html, /@media \(max-width: 430px\)/)
  assert.match(html, /syncGeneralFilters/)
  assert.match(html, /Vue générale/)
  assert.match(html, /canUseGeneralView/)
  assert.doesNotMatch(html, />Vue admin</)
  assert.doesNotMatch(html, /Vue générale admin/)
  assert.match(html, /getEffectiveFilters/)
  assert.match(html, /buildIcalContent/)
  assert.match(html, /getMagicLinkViewerRooms/)
  assert.match(html, /STATIC_MAGIC_LINK_BOOTSTRAP/)
  assert.match(html, /__STATIC_MAGIC_LINK_VALIDATED__/)

  const payload = JSON.parse(extractStaticPayload(html))
  assert.equal(payload.publicationVersion, 2)
  assert.equal(payload.publicationPublishedAt, '2026-04-30T08:30:00.000Z')
})

test('buildStaticDefenseHtml avertit quand le lien personnel vise une autre publication', () => {
  const html = buildStaticDefenseHtml({
    year: 2026,
    generatedAt: '2026-05-01T10:00:00.000Z',
    publicationVersion: 2,
    rooms: []
  })

  const elements = runStaticDefenseRuntime(html, {
    personId: 'person-1',
    name: 'Alice Expert',
    publicationVersion: 3,
    voteAccessUrl: 'https://tpi26.test/votes-2026/?ml=vote-token',
    voteAccessCreatedAt: '2026-05-02T10:30:00.000Z'
  })
  const warning = elements.get('static-person-publication-warning').textContent

  assert.equal(elements.get('static-person-vote-link').href, 'https://tpi26.test/votes-2026/?ml=vote-token')
  assert.match(warning, /Formulaire v3/)
  assert.match(warning, /du/)
  assert.doesNotMatch(warning, /mini-site/)
  assert.match(warning, /Dates à vérifier/)
})

test('buildStaticDefenseHtml indique la publication source dans la note du formulaire', () => {
  const html = buildStaticDefenseHtml({
    year: 2026,
    generatedAt: '2026-05-01T10:00:00.000Z',
    publicationVersion: 2,
    publicationPublishedAt: '2026-04-30T08:30:00.000Z',
    rooms: []
  })

  const elements = runStaticDefenseRuntime(html, {
    personId: 'person-1',
    name: 'Alice Expert',
    publicationVersion: 2,
    voteAccessUrl: 'https://tpi26.test/votes-2026/?ml=vote-token'
  })
  const warning = elements.get('static-person-publication-warning').textContent

  assert.match(warning, /Formulaire v2/)
  assert.match(warning, /Publication du/)
  assert.doesNotMatch(warning, /Publication v2 du/)
  assert.doesNotMatch(warning, /Page du/)
})

test('buildStaticDefenseHtml ne marque pas le formulaire stale quand le formulaire lie correspond a la publication', () => {
  const html = buildStaticDefenseHtml({
    year: 2026,
    generatedAt: '2026-05-01T10:00:00.000Z',
    publicationVersion: 2,
    publicationPublishedAt: '2026-04-30T08:30:00.000Z',
    rooms: []
  })

  const elements = runStaticDefenseRuntime(html, {
    personId: 'person-1',
    name: 'Alice Expert',
    publicationVersion: 1,
    voteAccessUrl: 'https://tpi26.test/votes-2026/?ml=vote-token',
    voteAccessPublicationVersion: 2,
    voteAccessCreatedAt: '2026-05-02T10:30:00.000Z'
  })
  const warningNode = elements.get('static-person-publication-warning')
  const warning = warningNode.textContent

  assert.match(warning, /Formulaire v2/)
  assert.match(warning, /Publication du/)
  assert.doesNotMatch(warning, /Dates à vérifier/)
  assert.equal(warningNode.classList.contains('is-stale'), false)
})

test('buildStaticDefenseHtml trie la vue personnelle statique par date puis horaire visible', () => {
  const html = buildStaticDefenseHtml({
    year: 2026,
    generatedAt: '2026-05-01T10:00:00.000Z',
    rooms: [
      {
        idRoom: 1,
        date: '2026-06-12',
        site: 'ETML',
        name: 'A101',
        configSite: {
          numSlots: 3,
          firstTpiStart: 8,
          tpiTime: 1,
          breakline: 0.25
        },
        tpiDatas: [
          {
            id: 'room-late-date_0',
            period: 1,
            refTpi: '2165',
            candidat: 'Late Date Candidate',
            expert1: { name: 'Alex Expert', personId: 'person-1' },
            expert2: { name: 'Expert Two' },
            boss: { name: 'Boss One' }
          }
        ]
      },
      {
        idRoom: 2,
        date: '2026-06-10',
        site: 'ETML',
        name: 'A102',
        configSite: {
          numSlots: 3,
          firstTpiStart: 8,
          tpiTime: 1,
          breakline: 0.25
        },
        tpiDatas: [
          {
            id: 'room-late-slot_2',
            period: 3,
            refTpi: '2164',
            candidat: 'Late Slot Candidate',
            expert1: { name: 'Alex Expert', personId: 'person-1' },
            expert2: { name: 'Expert Two' },
            boss: { name: 'Boss One' }
          }
        ]
      },
      {
        idRoom: 3,
        date: '2026-06-10',
        site: 'ETML',
        name: 'A103',
        configSite: {
          numSlots: 3,
          firstTpiStart: 8,
          tpiTime: 1,
          breakline: 0.25
        },
        tpiDatas: [
          {
            id: 'room-early-slot_0',
            period: 1,
            refTpi: '2163',
            candidat: 'Early Slot Candidate',
            expert1: { name: 'Alex Expert', personId: 'person-1' },
            expert2: { name: 'Expert Two' },
            boss: { name: 'Boss One' }
          }
        ]
      },
      {
        idRoom: 4,
        date: '2026-06-09',
        site: 'ETML',
        name: 'A104',
        configSite: {
          numSlots: 1,
          firstTpiStart: 8,
          tpiTime: 1,
          breakline: 0
        },
        tpiDatas: [
          {
            id: 'room-other-person_0',
            period: 1,
            refTpi: '2162',
            candidat: 'Other Person Candidate',
            expert1: { name: 'Other Expert', personId: 'person-2' },
            expert2: { name: 'Expert Two' },
            boss: { name: 'Boss One' }
          }
        ]
      }
    ]
  })

  const elements = runStaticDefenseRuntime(html, {
    personId: 'person-1',
    name: 'Alex Expert'
  })
  const renderedRooms = elements.get('rooms').innerHTML

  const earlySlotPosition = renderedRooms.indexOf('Early Slot Candidate')
  const lateSlotPosition = renderedRooms.indexOf('Late Slot Candidate')
  const lateDatePosition = renderedRooms.indexOf('Late Date Candidate')

  assert.ok(earlySlotPosition >= 0)
  assert.ok(lateSlotPosition >= 0)
  assert.ok(lateDatePosition >= 0)
  assert.ok(earlySlotPosition < lateSlotPosition)
  assert.ok(lateSlotPosition < lateDatePosition)
  assert.doesNotMatch(renderedRooms, /Other Person Candidate/)
})

test('buildStaticDefenseHtml donne la vue générale et ses filtres aux liens non admin', () => {
  const html = buildStaticDefenseHtml({
    year: 2026,
    generatedAt: '2026-05-01T10:00:00.000Z',
    rooms: [
      {
        idRoom: 1,
        date: '2026-06-10',
        site: 'ETML',
        name: 'A101',
        roomClassMode: 'matu',
        configSite: {
          numSlots: 1,
          firstTpiStart: 8,
          tpiTime: 1,
          breakline: 0
        },
        tpiDatas: [
          {
            id: 'room-personal_0',
            period: 1,
            refTpi: '2163',
            candidat: 'Alice Candidate',
            expert1: { name: 'Alex Expert', personId: 'person-1' },
            expert2: { name: 'Expert Two' },
            boss: { name: 'Boss One' }
          }
        ]
      },
      {
        idRoom: 2,
        date: '2026-06-11',
        site: 'ETML',
        name: 'A102',
        roomClassMode: 'special',
        configSite: {
          numSlots: 1,
          firstTpiStart: 9,
          tpiTime: 1,
          breakline: 0
        },
        tpiDatas: [
          {
            id: 'room-other_0',
            period: 1,
            refTpi: '2164',
            candidat: 'Bob Candidate',
            expert1: { name: 'Other Expert', personId: 'person-2' },
            expert2: { name: 'Expert Three' },
            boss: { name: 'Boss Two' }
          }
        ]
      }
    ]
  })

  const elements = runStaticDefenseRuntime(html, {
    personId: 'person-1',
    name: 'Alex Expert',
    roles: ['expert'],
    isAdmin: false
  })
  const roomsNode = elements.get('rooms')
  const generalViewToggle = elements.get('static-general-view-toggle')
  const filtersNode = elements.get('static-general-filters')
  const dateFilter = elements.get('static-general-filter-date')
  const classTypeFilter = elements.get('static-general-filter-class-type')

  assert.match(roomsNode.innerHTML, /Alice Candidate/)
  assert.doesNotMatch(roomsNode.innerHTML, /Bob Candidate/)
  assert.equal(generalViewToggle.disabled, false)
  assert.equal(generalViewToggle.textContent, 'Vue générale')
  assert.equal(generalViewToggle.classList.contains('static-hidden'), false)
  assert.equal(filtersNode.classList.contains('static-hidden'), true)
  assert.equal(elements.get('view-status').textContent, 'Vue pour Alex Expert')

  generalViewToggle.click()

  assert.match(roomsNode.innerHTML, /Alice Candidate/)
  assert.match(roomsNode.innerHTML, /Bob Candidate/)
  assert.equal(generalViewToggle.textContent, 'Vue pour Alex Expert')
  assert.equal(elements.get('view-status').textContent, 'Vue générale')
  assert.equal(filtersNode.classList.contains('static-hidden'), false)
  assert.equal(dateFilter.disabled, false)
  assert.equal(classTypeFilter.disabled, false)
  assert.match(dateFilter.innerHTML, /10\.06\.2026/)
  assert.match(dateFilter.innerHTML, /11\.06\.2026/)

  classTypeFilter.value = 'special'
  classTypeFilter.dispatchEvent({ type: 'change', target: classTypeFilter })

  assert.doesNotMatch(roomsNode.innerHTML, /Alice Candidate/)
  assert.match(roomsNode.innerHTML, /Bob Candidate/)

  classTypeFilter.value = ''
  classTypeFilter.dispatchEvent({ type: 'change', target: classTypeFilter })

  const dateOptionMatch = dateFilter.innerHTML.match(/<option value="([^"]*10\.06\.2026[^"]*)">/)
  assert.ok(dateOptionMatch, 'date filter should expose the first defense date')
  dateFilter.value = dateOptionMatch[1]
  dateFilter.dispatchEvent({ type: 'change', target: dateFilter })

  assert.match(roomsNode.innerHTML, /Alice Candidate/)
  assert.doesNotMatch(roomsNode.innerHTML, /Bob Candidate/)
})

test('buildStaticDefenseHtml applique le tronquage statique des noms de défense à 24 caractères', () => {
  const html = buildStaticDefenseHtml({
    year: 2026,
    generatedAt: '2026-05-01T10:00:00.000Z',
    rooms: [
      {
        idRoom: 1,
        date: '2026-06-10',
        site: 'ETML',
        name: 'A101',
        configSite: {
          numSlots: 1,
          firstTpiStart: 8,
          tpiTime: 1,
          breakline: 0
        },
        tpiDatas: [
          {
            id: 'room-1_0',
            period: 1,
            refTpi: '2163',
            candidat: 'Alice Martin Dupont Très Long',
            expert1: { name: 'Expert Principal Avec Nom Très Long' },
            expert2: { name: 'Expert Secondaire Avec Nom Très Long' },
            boss: { name: 'Chef de Projet Avec Nom Très Long' }
          }
        ]
      }
    ]
  })

  assert.match(html, /var SLOT_NAME_MAX_LENGTH = 24;/)
  assert.match(html, /function renderSlotName/)
  assert.match(html, /className = truncated\.isTruncated \? 'truncated-text' : 'nameTpi'/)
  assert.match(html, /renderSlotName\(tpi\.candidat\)/)
  assert.match(html, /renderSlotName\(tpi\.expert1 && tpi\.expert1\.name\)/)
  assert.match(html, /renderSlotName\(tpi\.boss && tpi\.boss\.name\)/)
})

test('buildStaticDefensePhp gates static data behind a magic link hash', () => {
  const html = buildStaticDefenseHtml({
    year: 2026,
    generatedAt: '2026-05-01T10:00:00.000Z',
    rooms: []
  })
  const php = buildStaticDefensePhp({
    html,
    year: 2026,
    accessLinks: [
      {
        year: 2026,
        hash: 'a'.repeat(64),
        personId: 'person-1',
        name: 'Alice Candidate',
        email: 'alice@example.test',
        publicationVersion: 4,
        roles: ['admin'],
        isAdmin: true,
        expiresAt: '2026-06-01T10:00:00.000Z'
      }
    ]
  })

  assert.match(php, /^<\?php/)
  assert.match(php, /hash\('sha256', \$staticToken\)/)
  assert.match(php, /hash_equals\(\$candidateHash, \$staticTokenHash\)/)
  assert.match(php, /staticPublicationDecryptLinkedVoteUrl/)
  assert.match(php, /voteAccessUrl/)
  assert.match(php, /publicationVersion/)
  assert.match(php, /isAdmin/)
  assert.match(php, /admin/)
  assert.match(php, /__STATIC_MAGIC_LINK_VALIDATED__/)
  assert.match(php, /Alice Candidate/)
  assert.doesNotMatch(php, /STATIC_MAGIC_LINK_BOOTSTRAP/)
})

test('listStaticPublicationAccessLinks chiffre uniquement le lien vote de la meme personne', async () => {
  const calls = []
  const restore = replaceProperty(MagicLink, 'find', (query) => {
    calls.push(query)

    if (query.type === 'vote') {
      return makeQueryResult([
        {
          tokenHash: 'v'.repeat(64),
          rawToken: 'vote-token-person-1',
          personId: 'person-1',
          personName: 'Alice Expert',
          recipientEmail: 'alice@example.test',
          redirectPath: '/votes-2026/',
          scope: {
            source: 'admin_static_vote_access_generated',
            kind: 'stakeholder_votes',
            year: 2026
          },
          expiresAt: new Date('2026-06-01T10:00:00.000Z'),
          maxUses: 20,
          usageCount: 0,
          createdAt: new Date('2026-05-01T10:00:00.000Z')
        },
        {
          tokenHash: 'w'.repeat(64),
          rawToken: 'app-vote-token-person-1',
          personId: 'person-1',
          personName: 'Alice Expert',
          recipientEmail: 'alice@example.test',
          redirectPath: '/coordination/2026',
          scope: {
            source: 'admin_access_generated',
            kind: 'stakeholder_votes',
            year: 2026
          },
          expiresAt: new Date('2026-06-02T10:00:00.000Z'),
          maxUses: 20,
          usageCount: 0,
          createdAt: new Date('2026-05-02T10:00:00.000Z')
        }
      ])
    }

    return makeQueryResult([
      {
        tokenHash: 'a'.repeat(64),
        rawToken: 'defense-token-person-1',
        personId: 'person-1',
        personName: 'Alice Expert',
        recipientEmail: 'alice@example.test',
        scope: {
          publicationVersion: 4,
          source: 'admin_static_soutenance_access_generated',
          kind: 'published_soutenances'
        },
        expiresAt: new Date('2026-05-30T10:00:00.000Z'),
        maxUses: 60,
        usageCount: 0
      },
      {
        tokenHash: 'b'.repeat(64),
        rawToken: 'defense-token-person-2',
        personId: 'person-2',
        personName: 'Bob Expert',
        recipientEmail: 'bob@example.test',
        scope: {
          publicationVersion: 4,
          source: 'admin_static_soutenance_access_generated',
          kind: 'published_soutenances'
        },
        expiresAt: new Date('2026-05-30T10:00:00.000Z'),
        maxUses: 60,
        usageCount: 0
      }
    ])
  })
  const restorePeople = replaceProperty(Person, 'find', (query) => {
    assert.deepEqual([...query._id.$in].sort(), ['person-1', 'person-2'])

    return makeQueryResult([
      {
        _id: 'person-1',
        roles: ['expert', 'admin']
      },
      {
        _id: 'person-2',
        roles: ['expert']
      }
    ])
  })

  try {
    const links = await listStaticPublicationAccessLinks(2026, {
      publicBaseUrl: 'https://tpi26.ch'
    })

    assert.equal(calls[0].type, 'vote')
    assert.equal(calls[1].type, 'soutenance')
    assert.deepEqual(
      calls[0]['scope.source'].$in,
      ['admin_access_generated', 'admin_static_vote_access_generated']
    )
    assert.equal(links.length, 2)
    assert.equal(links[0].publicationVersion, 4)
    assert.deepEqual(links[0].roles, ['expert', 'admin'])
    assert.equal(links[0].isAdmin, true)
    assert.deepEqual(links[1].roles, ['expert'])
    assert.equal(links[1].isAdmin, false)
    assert.equal(links[0].voteAccess.expiresAt, '2026-06-01T10:00:00.000Z')
    assert.equal(links[0].voteAccess.createdAt, '2026-05-01T10:00:00.000Z')
    assert.equal(links[0].voteAccess.source, 'admin_static_vote_access_generated')
    assert.equal(links[0].voteAccess.encryptedUrl.cipher, 'aes-256-gcm')
    assert.equal(links[1].voteAccess, undefined)
    assert.doesNotMatch(JSON.stringify(links), /vote-token-person-1/)
    assert.doesNotMatch(JSON.stringify(links), /app-vote-token-person-1/)
  } finally {
    restorePeople()
    restore()
  }
})

test('buildStaticAccessDeniedHtml does not expose defense data', () => {
  const html = buildStaticAccessDeniedHtml(2026)

  assert.match(html, /Accès protégé/)
  assert.match(html, /rel="icon" href="favicon\.ico"/)
  assert.doesNotMatch(html, /id="defense-data"/)
  assert.doesNotMatch(html, /static-soutenance-page/)
})

test('getStaticPublicationStatus uses FTP_REMOTE_DIR as the webroot upload base', async () => {
  await withPublicationEnv({
    FTP_REMOTE_DIR: '/home/account/domains/tpi26.ch/public_html',
    STATIC_PUBLICATION_DIR: path.join(os.tmpdir(), 'tpiorganizer-static-publication-empty'),
    STATIC_PUBLIC_BASE_URL: 'https://tpi26.ch'
  }, async () => {
    const status = await getStaticPublicationStatus(2026)

    assert.equal(status.remoteDir, '/home/account/domains/tpi26.ch/public_html/soutenances-2026')
    assert.equal(status.publicUrl, 'https://tpi26.ch/soutenances-2026/')
  })
})

test('getStaticPublicationStatus keeps current FTP config ahead of stale manifest paths', async (t) => {
  const publicationRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tpiorganizer-static-publication-'))
  const publicationDir = path.join(publicationRoot, 'defenses', '2026')
  fs.mkdirSync(publicationDir, { recursive: true })
  fs.writeFileSync(path.join(publicationDir, 'index.html'), '<!doctype html><title>old</title>', 'utf8')
  fs.writeFileSync(
    path.join(publicationDir, 'manifest.json'),
    JSON.stringify({
      generatedAt: '2026-05-01T10:00:00.000Z',
      publicUrl: 'https://old.example.invalid/',
      remoteDir: '/old-remote-dir'
    }),
    'utf8'
  )
  t.after(() => fs.rmSync(publicationRoot, { recursive: true, force: true }))

  await withPublicationEnv({
    FTP_REMOTE_DIR: '/home/account/domains/tpi26.ch/public_html',
    STATIC_PUBLICATION_DIR: publicationRoot,
    STATIC_PUBLIC_BASE_URL: 'https://tpi26.ch'
  }, async () => {
    const status = await getStaticPublicationStatus(2026)

    assert.equal(status.available, true)
    assert.equal(status.generatedAt, '2026-05-01T10:00:00.000Z')
    assert.equal(status.remoteDir, '/home/account/domains/tpi26.ch/public_html/soutenances-2026')
    assert.equal(status.publicUrl, 'https://tpi26.ch/soutenances-2026/')
  })
})

test('getStaticPublicationStatus can target the public webroot directly', async () => {
  await withPublicationEnv({
    FTP_REMOTE_DIR: '/home/account/domains/tpi26.ch/public_html',
    FTP_STATIC_REMOTE_DIR: '.',
    STATIC_PUBLIC_PATH: '/',
    STATIC_PUBLICATION_DIR: path.join(os.tmpdir(), 'tpiorganizer-static-publication-root'),
    STATIC_PUBLIC_BASE_URL: 'https://tpi26.ch'
  }, async () => {
    const status = await getStaticPublicationStatus(2026)

    assert.equal(status.remoteDir, '/home/account/domains/tpi26.ch/public_html')
    assert.equal(status.publicUrl, 'https://tpi26.ch/')
  })
})

test('getStaticPublicationStatus accepte les alias explicites de publication defenses', async () => {
  await withPublicationEnv({
    FTP_REMOTE_DIR: '/home/account/domains/tpi26.ch/public_html',
    FTP_STATIC_DEFENSE_REMOTE_DIR: 'defenses-{year}',
    STATIC_DEFENSE_PUBLIC_PATH: '/defenses-{year}',
    STATIC_PUBLICATION_DIR: path.join(os.tmpdir(), 'tpiorganizer-static-publication-defenses'),
    STATIC_PUBLIC_BASE_URL: 'https://tpi26.ch'
  }, async () => {
    const status = await getStaticPublicationStatus(2026)

    assert.equal(status.remoteDir, '/home/account/domains/tpi26.ch/public_html/defenses-2026')
    assert.equal(status.publicUrl, 'https://tpi26.ch/defenses-2026/')
  })
})
