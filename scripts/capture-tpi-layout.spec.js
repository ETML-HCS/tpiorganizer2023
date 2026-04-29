const { test } = require('@playwright/test')

const baseUrl = 'http://127.0.0.1:4173/soutenances/2026'

const scenarios = [
  {
    id: 'normal-only',
    variant: 'normal',
    rooms: [
      {
        _id: 'room-1',
        site: 'ETML',
        date: '2026-06-10',
        name: 'Salle 101',
        roomClassMode: '',
        configSite: {
          breakline: 0,
          tpiTime: 1,
          firstTpiStart: 8,
          numSlots: 3
        },
        tpiDatas: [
          {
            id: 'r1-t1',
            refTpi: '2163',
            candidat: 'Alice Durand',
            expert1: { name: 'Expert un' },
            expert2: { name: 'Expert deux' },
            boss: { name: 'CDP un' }
          },
          {
            id: 'r1-t2',
            refTpi: '2164',
            candidat: 'Bob Martin',
            expert1: { name: 'Expert A' },
            expert2: { name: 'Expert B' },
            boss: { name: 'CDP B' }
          }
        ]
      }
    ]
  },
  {
    id: 'matu-only',
    variant: 'matu',
    rooms: [
      {
        _id: 'room-2',
        site: 'CFPV',
        date: '2026-06-10',
        name: 'Salle MATU',
        roomClassMode: 'matu',
        configSite: {
          breakline: 0,
          tpiTime: 1,
          firstTpiStart: 8,
          numSlots: 3
        },
        tpiDatas: [
          {
            id: 'r2-t1',
            refTpi: '2165',
            candidat: 'Camille Vieux',
            expert1: { name: 'Expert 1' },
            expert2: { name: 'Expert 2' },
            boss: { name: 'Chef A' }
          },
          {
            id: 'r2-t2',
            refTpi: '2166',
            candidat: 'Noémie Lemoine',
            expert1: { name: 'Expert 3' },
            expert2: { name: 'Expert 4' },
            boss: { name: 'Chef B' }
          }
        ]
      }
    ]
  },
  {
    id: 'mixed',
    variant: 'mixed',
    rooms: [
      {
        _id: 'room-3',
        site: 'ETML',
        date: '2026-06-10',
        name: 'Salle normale',
        roomClassMode: '',
        configSite: {
          breakline: 0,
          tpiTime: 1,
          firstTpiStart: 8,
          numSlots: 3
        },
        tpiDatas: [
          {
            id: 'r3-t1',
            refTpi: '2167',
            candidat: 'Aline Durieux',
            expert1: { name: 'Expert X' },
            expert2: { name: 'Expert Y' },
            boss: { name: 'Chef C' }
          }
        ]
      },
      {
        _id: 'room-4',
        site: 'CFPV',
        date: '2026-06-10',
        name: 'Salle spéciale',
        roomClassMode: 'matu',
        configSite: {
          breakline: 0,
          tpiTime: 1,
          firstTpiStart: 8,
          numSlots: 3
        },
        tpiDatas: [
          {
            id: 'r4-t1',
            refTpi: '2168',
            candidat: 'Julien L.',
            expert1: { name: 'Expert M' },
            expert2: { name: 'Expert N' },
            boss: { name: 'Chef D' }
          }
        ]
      }
    ]
  }
]

const buildFixture = (variant) => {
  const scenario = scenarios.find((item) => item.variant === variant)
  return scenario ? scenario.rooms : scenarios[0].rooms
}

test('capture and measure soutenance room headers', async ({ page }) => {
  await page.setViewportSize({ width: 1840, height: 1100 })

  await page.route(/\/api\/soutenances\/\d+/, async (route, request) => {
    const reqUrl = new URL(request.url())
    const variant = reqUrl.searchParams.get('preview') || 'normal'

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildFixture(variant))
    })
  })

  await page.route('**/api/experts*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    })
  })

  for (const scenario of scenarios) {
    await page.goto(`${baseUrl}?preview=${scenario.variant}`, {
      waitUntil: 'networkidle'
    })

    await page.waitForTimeout(400)

    const metrics = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('.tpi-soutenance-page .room-header'))

      return headers.map((header) => {
        const slot = header.nextElementSibling
        const headerRect = header.getBoundingClientRect()
        const slotRect = slot ? slot.getBoundingClientRect() : null

        return {
          room: header.querySelector('.room-header-name')?.textContent || '',
          badge: header.querySelector('.soutenance-room-class-badge')?.textContent || '',
          headerHeight: Math.round(headerRect.height),
          headerTop: Math.round(headerRect.top),
          firstSlotOffsetTop: slotRect ? Math.round(slotRect.top - headerRect.top) : null
        }
      })
    })

    console.log(JSON.stringify({ scenario: scenario.id, metrics }, null, 2))
    await page.screenshot({ path: `screenshot-${scenario.id}.png`, fullPage: true })
  }
})
