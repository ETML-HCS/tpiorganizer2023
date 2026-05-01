const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildStaticDefenseHtml,
  flattenPublishedRooms
} = require('../services/staticDefensePublicationService')

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
})
