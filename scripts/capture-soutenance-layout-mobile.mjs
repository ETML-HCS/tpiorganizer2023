import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4173/soutenances/2026'

const scenarios = [
  {
    id: 'mobile-normal',
    rooms: [{ _id:'room-1', site:'ETML', date:'2026-06-10', name:'Salle 101', roomClassMode:'', configSite:{breakline:0,tpiTime:1,firstTpiStart:8,numSlots:3}, tpiDatas:[{id:'r1',refTpi:'1',candidat:'Alice',expert1:{name:'A1'},expert2:{name:'A2'},boss:{name:'Boss'}}] }]
  },
  {
    id: 'mobile-matu',
    rooms: [{ _id:'room-2', site:'CFPV', date:'2026-06-10', name:'Salle MATU', roomClassMode:'matu', configSite:{breakline:0,tpiTime:1,firstTpiStart:8,numSlots:3}, tpiDatas:[{id:'r2',refTpi:'2',candidat:'Bob',expert1:{name:'B1'},expert2:{name:'B2'},boss:{name:'Boss'}}] }]
  },
  {
    id: 'mobile-mixed',
    rooms: [
      { _id:'room-3', site:'ETML', date:'2026-06-10', name:'Salle normale', roomClassMode:'', configSite:{breakline:0,tpiTime:1,firstTpiStart:8,numSlots:3}, tpiDatas:[{id:'r3',refTpi:'3',candidat:'Céline',expert1:{name:'C1'},expert2:{name:'C2'},boss:{name:'BossC'}}] },
      { _id:'room-4', site:'CFPV', date:'2026-06-10', name:'Salle spéciale', roomClassMode:'matu', configSite:{breakline:0,tpiTime:1,firstTpiStart:8,numSlots:3}, tpiDatas:[{id:'r4',refTpi:'4',candidat:'David',expert1:{name:'D1'},expert2:{name:'D2'},boss:{name:'BossD'}}] }
    ]
  }
]

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 1000 } })

await page.route(/\/api\/soutenances\/\d+/, async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(page.fixtureData || scenarios[0].rooms)
  })
})
await page.route('**/api/experts**', async route => {
  await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
})

for (const scenario of scenarios) {
  page.fixtureData = scenario.rooms
  await page.goto(`${baseUrl}?preview=1`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(250)
  await page.click('button:has-text("SalleClasse")')
  await page.waitForTimeout(250)

  const headers = await page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll(
        '.tpi-soutenance-page .room-header, .tpi-soutenance-page [class^="header_"]'
      )
    )
    return nodes.map((el) => {
      const rect = el.getBoundingClientRect()
      const next = el.nextElementSibling
      const nextRect = next ? next.getBoundingClientRect() : null
      return {
        room: el.querySelector('.room-header-name')?.textContent || '',
        badge: el.querySelector('.soutenance-room-class-badge')?.textContent || '',
        headerHeight: Math.round(rect.height),
        firstSlotOffsetTop: nextRect ? Math.round(nextRect.top - rect.top) : null
      }
    })
  })

  console.log(JSON.stringify({scenario: scenario.id, headers}, null, 2))
  await page.screenshot({ path: `screenshot-${scenario.id}-mobile.png`, fullPage: true })
}

await browser.close()
