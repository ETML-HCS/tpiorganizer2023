import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 900 } })

await page.route(/\/api\/soutenances\/\d+/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
  { _id:'room-1', site:'ETML', date:'2026-06-10', name:'Salle normale', roomClassMode:'', configSite:{breakline:0,tpiTime:1,firstTpiStart:8,numSlots:3}, tpiDatas:[{id:'a',refTpi:'1',candidat:'Alice',expert1:{name:'E1'},expert2:{name:'E2'},boss:{name:'Boss'} }]},
  { _id:'room-2', site:'CFPV', date:'2026-06-10', name:'Salle MATU', roomClassMode:'matu', configSite:{breakline:0,tpiTime:1,firstTpiStart:8,numSlots:3}, tpiDatas:[{id:'b',refTpi:'2',candidat:'Bob',expert1:{name:'B1'},expert2:{name:'B2'},boss:{name:'Boss'} }]}
] })) )
await page.route('**/api/experts**', route => route.fulfill({ status: 200, contentType:'application/json', body:'[]' }))

await page.goto('http://127.0.0.1:4173/soutenances/2026?preview=1', { waitUntil:'networkidle' })
await page.click('button:has-text("SalleClasse")')
await page.waitForTimeout(300)

const info1 = await page.evaluate(() => {
  const headers = Array.from(document.querySelectorAll('.mobile-room-filter .room-header'))
  return headers.map((h) => ({
    room: h.querySelector('.room-header-name')?.textContent,
    badge: h.querySelector('.soutenance-room-class-badge')?.textContent || '',
    headerHeight: Math.round(h.getBoundingClientRect().height)
  }))
})

await page.click('button:has-text("Salle suivante")')
await page.waitForTimeout(250)
const info2 = await page.evaluate(() => {
  const h = document.querySelector('.mobile-room-filter .room-header')
  return {
    room: h?.querySelector('.room-header-name')?.textContent || '',
    badge: h?.querySelector('.soutenance-room-class-badge')?.textContent || '',
    headerHeight: h ? Math.round(h.getBoundingClientRect().height) : null
  }
})

console.log(JSON.stringify({ info1, info2 }, null, 2))
await page.screenshot({ path:'mobile-header-final.png', fullPage:true })
await browser.close()
