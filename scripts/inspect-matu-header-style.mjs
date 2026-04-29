import { chromium } from "playwright"

const baseUrl = 'http://127.0.0.1:4173/soutenances/2026'

const scenarios = [
  {
    id: 'normal',
    rooms: [
      {
        _id: 'r1', site: 'ETML', date: '2026-06-10', name: 'Salle normale', roomClassMode: '', configSite: { breakline: 0, tpiTime: 1, firstTpiStart: 8, numSlots: 3 },
        tpiDatas: [{ id: 'n1', refTpi: 'N1', candidat: 'Alice', expert1: { name: 'E1' }, expert2: { name: 'E2' }, boss: { name: 'Boss' } }]
      }
    ]
  },
  {
    id: 'matu',
    rooms: [
      {
        _id: 'r2', site: 'CFPV', date: '2026-06-10', name: 'Salle MATU', roomClassMode: 'matu', configSite: { breakline: 0, tpiTime: 1, firstTpiStart: 8, numSlots: 3 },
        tpiDatas: [{ id: 'm1', refTpi: 'M1', candidat: 'Bob', expert1: { name: 'E1' }, expert2: { name: 'E2' }, boss: { name: 'Boss' } }]
      }
    ]
  }
]

const run = async ({ viewport, mobile }) => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport })

  await page.route(/\/api\/soutenances\/\d+/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(page.fixtureData) })
  })
  await page.route('**/api/experts**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })

  for (const scenario of scenarios) {
    page.fixtureData = scenario.rooms
    const url = mobile ? `${baseUrl}?preview=1` : baseUrl
    await page.goto(url, { waitUntil: 'networkidle' })

    if (mobile) {
      const btn = await page.locator('button:has-text("SalleClasse")')
      if (await btn.count() > 0) {
        await btn.first().click()
        await page.waitForTimeout(200)
      }
    }

    const data = await page.evaluate(() => {
      const room = document.querySelector('.tpi-soutenance-page .salle')
      if (!room) {
        return { missing: true }
      }
      const header = room.querySelector('.room-header')
      const slot = room.querySelector('.tpi-data')
      const roomName = room.querySelector('.room-header-name')
      const badge = room.querySelector('.soutenance-room-class-badge')

      const styleObj = (selector) => {
        const el = room.querySelector(selector)
        if (!el) return null
        const rect = el.getBoundingClientRect()
        const cs = window.getComputedStyle(el)
        return {
          rect: {
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            top: Math.round(rect.top)
          },
          style: {
            fontSize: cs.fontSize,
            lineHeight: cs.lineHeight,
            padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
            margin: `${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}`,
            overflow: cs.overflow,
            whiteSpace: cs.whiteSpace,
            textOverflow: cs.textOverflow,
            display: cs.display,
            height: cs.height,
            minHeight: cs.minHeight,
            maxHeight: cs.maxHeight
          }
        }
      }

      const cs = window.getComputedStyle(header)
      return {
        room: roomName?.textContent || '',
        roomClass: badge?.textContent || '',
        roomClasses: room.className,
        header: {
          rect: {
            w: Math.round(header.getBoundingClientRect().width),
            h: Math.round(header.getBoundingClientRect().height),
            top: Math.round(header.getBoundingClientRect().top)
          },
          gridTemplateRows: cs.gridTemplateRows,
          rowGap: cs.rowGap,
          padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
          margin: `${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}`,
          height: cs.height,
          minHeight: cs.minHeight,
          maxHeight: cs.maxHeight
        },
        date: styleObj('.room-header-date'),
        title: styleObj('.room-header-name'),
        badges: styleObj('.room-header-badges'),
        slotOffsetTop: slot ? Math.round(slot.getBoundingClientRect().top - header.getBoundingClientRect().top) : null,
        slotHeight: slot ? Math.round(slot.getBoundingClientRect().height) : null
      }
    })

    console.log(JSON.stringify({ viewport, mobile, scenario: scenario.id, data }, null, 2))
  }

  await browser.close()
}

await run({ viewport: { width: 1400, height: 900 }, mobile: false })
await run({ viewport: { width: 390, height: 1000 }, mobile: true })
