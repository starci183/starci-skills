import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const svg = readFileSync('D:/Repositories/starci-academy-fe/design-plans/dashboard-rail-main-v1/baseline-desktop.svg', 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`)
await page.waitForTimeout(800)
await page.screenshot({ path: 'reference-renders/academy-dashboard-baseline.png', fullPage: true })
console.log('done')
await browser.close()
