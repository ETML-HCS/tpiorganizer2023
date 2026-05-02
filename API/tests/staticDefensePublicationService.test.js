const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  buildStaticAccessDeniedHtml,
  buildStaticDefenseHtml,
  buildStaticDefensePhp,
  flattenPublishedRooms,
  getStaticPublicationStatus
} = require('../services/staticDefensePublicationService')

const STATIC_PUBLICATION_ENV_KEYS = [
  'FTP_HOST',
  'FTP_PASSWORD',
  'FTP_PORT',
  'FTP_PROTOCOL',
  'FTP_REMOTE_DIR',
  'FTP_STATIC_REMOTE_DIR',
  'FTP_STATIC_PUBLIC_PATH',
  'FTP_USER',
  'PUBLICATION_FTP_PROTOCOL',
  'PUBLIC_SITE_BASE_URL',
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

test('buildStaticDefenseHtml embeds data and static rendering script in one html file', () => {
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
  assert.match(html, /id="defense-data"/)
  assert.match(html, /tpi-soutenance-page static-soutenance-page/)
  assert.match(html, /soutenance-toolbar/)
  assert.match(html, /salles-container/)
  assert.match(html, /Alice Candidate/)
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
  assert.match(html, /id="static-person-ical"/)
  assert.match(html, /id="static-person-ical-download"/)
  assert.match(html, /buildIcalContent/)
  assert.match(html, /getMagicLinkViewerRooms/)
  assert.match(html, /STATIC_MAGIC_LINK_BOOTSTRAP/)
  assert.match(html, /__STATIC_MAGIC_LINK_VALIDATED__/)
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
        expiresAt: '2026-06-01T10:00:00.000Z'
      }
    ]
  })

  assert.match(php, /^<\?php/)
  assert.match(php, /hash\('sha256', \$staticToken\)/)
  assert.match(php, /hash_equals\(\$candidateHash, \$staticTokenHash\)/)
  assert.match(php, /__STATIC_MAGIC_LINK_VALIDATED__/)
  assert.match(php, /Alice Candidate/)
  assert.doesNotMatch(php, /STATIC_MAGIC_LINK_BOOTSTRAP/)
})

test('buildStaticAccessDeniedHtml does not expose defense data', () => {
  const html = buildStaticAccessDeniedHtml(2026)

  assert.match(html, /Accès protégé/)
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
