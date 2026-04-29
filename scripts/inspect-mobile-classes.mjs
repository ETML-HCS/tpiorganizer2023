import { chromium } from 'playwright'

const url = 'http://127.0.0.1:4173/soutenances/2026'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 700 } })

await page.route(/\/api\/soutenances\/\d+/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ _id:'room-1', site:'ETML', date:'2026-06-10', name:'Salle normale', roomClassMode:'matu', configSite:{breakline:0,tpiTime:1,firstTpiStart:8,numSlots:3}, tpiDatas:[{id:'a',refTpi:'1',candidat:'Alice',expert1:{name:'E1'},expert2:{name:'E2'},boss:{name:'Boss'} }]} ]) }))
await page.route('**/api/experts**', route => route.fulfill({ status:200, contentType:'application/json', body:'[]' }))

await page.goto(`${url}?preview=1`, { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
await page.click('button:has-text("SalleClasse")')
await page.waitForTimeout(300)

const report = await page.evaluate(() => {
  const allEls = Array.from(document.querySelectorAll('.tpi-soutenance-page *')).map((el) => ({
    cls: Array.from(el.classList).join(' ')
  }))

  const classCounter = {}
  for (const entry of allEls) {
    for (const c of entry.cls ? entry.cls.split(' ') : []) {
      if (!c) continue
      classCounter[c] = (classCounter[c] || 0) + 1
    }
  }

  const top = [...document.querySelectorAll('.tpi-soutenance-page')]
  const roomNames = Array.from(document.querySelectorAll('.room-header-name,.room-header')).map((node) => node.textContent)

  return {
    classCount: Object.entries(classCounter).filter(([, n]) => n >= 1).slice(0, 80),
    roomNameCount: roomNames.length,
    roomNames: roomNames.slice(0, 8),
    htmlSnippet: document.body.innerHTML.slice(document.body.innerHTML.indexOf('Salle normale') - 200, document.body.innerHTML.indexOf('Salle normale') + 500)
  }
})

console.log(JSON.stringify(report, null, 2))
await browser.close()
