import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
for (const [url, name] of [['http://localhost:3000/sign-in','academy-signin'], ['http://localhost:3000/dashboard','academy-dashboard-try']]) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 }).catch(()=>{})
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `D:/Repositories/starci-academy-backend/.claude/packages/grammar/reference-renders/${name}.png` })
  console.log('shot', name, page.url())
}
await browser.close()
