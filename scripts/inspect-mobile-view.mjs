import { chromium } from 'playwright'

const url = 'http://127.0.0.1:4173/soutenances/2026?preview=1'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 700 } })

await page.route(/\/api\/soutenances\/\d+/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
  { _id: 'r1', site:'ETML', date:'2026-06-10', name:'Salle normale', roomClassMode:'', configSite:{breakline:0,tpiTime:1,firstTpiStart:8,numSlots:3}, tpiDatas:[{id:'a',refTpi:'1',candidat:'Alice',expert1:{name:'E1'},expert2:{name:'E2'},boss:{name:'Boss'} }]} 
] ) }))
await page.route('**/api/experts**', (route)=> route.fulfill({status:200,contentType:'application/json',body:'[]'}))

await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)

const report = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button')).map((b) => ({ text: b.textContent.trim() }))
  return {
    isMobile: window.innerWidth <= 500,
    buttonCount: buttons.length,
    buttons,
    pageTitle: document.title,
    bodyStart: document.body.textContent.slice(0, 500)
  }
})

console.log(JSON.stringify(report, null, 2))

await browser.close()
