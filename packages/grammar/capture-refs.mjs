import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { chromium } from 'playwright'

const root = new URL('./storybook-static', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' }
const server = createServer(async (req, res) => {
  try {
    const p = join(root, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]))
    const body = await readFile(p)
    res.writeHead(200, { 'content-type': mime[extname(p)] ?? 'application/octet-stream' })
    res.end(body)
  } catch { res.writeHead(404); res.end('nf') }
})
await new Promise(r => server.listen(0, r))
const port = server.address().port

const shots = [
  ['grammar-core-anatomy--tasks-screen', 'tasks-screen.png'],
  ['grammar-core-anatomy--sign-in-screen', 'sign-in-screen.png'],
  ['grammar-core-anatomy--empty-state', 'empty-state.png'],
  ['grammar-core-anatomy--primitives', 'primitives.png'],
]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
for (const [id, name] of shots) {
  await page.goto(`http://127.0.0.1:${port}/iframe.html?id=${id}&viewMode=story`)
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `reference-renders/${name}` })
  console.log('captured', name)
}
await browser.close()
server.close()
