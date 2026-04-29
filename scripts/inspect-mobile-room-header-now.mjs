import { chromium } from 'playwright'

const url = 'http://127.0.0.1:4173/soutenances/2026?preview=1'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 700 } })

await page.route(/\/api\/soutenances\/\d+/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ _id:'room-1', site:'ETML', date:'2026-06-10', name:'Salle MATU', roomClassMode:'matu', configSite:{breakline:0,tpiTime:1,firstTpiStart:8,numSlots:3}, tpiDatas:[{id:'a',refTpi:'1',candidat:'Alice',expert1:{name:'E1'},expert2:{name:'E2'},boss:{name:'Boss'} }] })) }))
await page.route('**/api/experts**', route => route.fulfill({ status: 200, contentType:'application/json', body:'[]' }))

await page.goto(url, { waitUntil:'networkidle' })
await page.waitForTimeout(300)
await page.click('button:has-text("SalleClasse")')
await page.waitForTimeout(250)

const info = await page.evaluate(() => {
  const roomHeader = document.querySelector('.tpi-soutenance-page .room-header')
  const slot = roomHeader?.nextElementSibling
  return {
    room: roomHeader?.querySelector('.room-header-name')?.textContent || '',
    badge: roomHeader?.querySelector('.soutenance-room-class-badge')?.textContent || '',
    headerHeight: roomHeader ? Math.round(roomHeader.getBoundingClientRect().height) : null,
    firstSlotOffsetTop: roomHeader && slot ? Math.round(slot.getBoundingClientRect().top - roomHeader.getBoundingClientRect().top) : null,
    hasSite: !!roomHeader?.querySelector('.site')
  }
})

console.log(info)
await browser.close()
