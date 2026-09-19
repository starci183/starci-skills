// v7-9 diagnostic #2: which capture setting actually clears palette-off-brand?
// Same page, same served build, four browser configurations; run the canon checks on each PNG.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, '../../../..');
const require = createRequire(path.join(skillRoot, 'examples/todo-app-frontend/package.json'));
const { chromium } = require('playwright');
const { decodePng, checkPalette, checkEntityListInCard, cardClassesOf } = await import(pathToFileURL(path.join(skillRoot, 'checks/render.mjs')).href);
const { parseYaml } = await import(pathToFileURL(path.join(skillRoot, 'core/yaml.mjs')).href);

const WEB = process.env.WEB ?? 'http://localhost:3000';
const API = process.env.API ?? 'http://localhost:3001/graphql';
const ROUTE = process.env.ROUTE ?? '/notify/preferences';
const READY = process.env.READY ?? 'Email digest';
const brand = parseYaml(fs.readFileSync(path.join(skillRoot, 'examples/todo-app-backend/.starciwork/brand/index.yaml'), 'utf8')).brand;
const cards = cardClassesOf({ family: brand.identity?.family });

const token = (await (await fetch(API, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query: 'mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken } }', variables: { input: { email: 'demo@todo.dev', password: 'todo-demo-pass' } } }),
})).json())?.data?.signIn?.sessionToken;
if (!token) throw new Error('no session token');

const CONFIGS = [
  { label: 'dsf1-lcdon', args: [], dsf: 1 },
  { label: 'dsf1-lcdoff', args: ['--disable-lcd-text', '--disable-font-subpixel-positioning'], dsf: 1 },
  { label: 'dsf2-lcdon', args: [], dsf: 2 },
  { label: 'dsf2-lcdoff', args: ['--disable-lcd-text', '--disable-font-subpixel-positioning'], dsf: 2 },
  { label: 'dsf2-lcdoff-srgb', args: ['--disable-lcd-text', '--disable-font-subpixel-positioning', '--force-color-profile=srgb'], dsf: 2 },
  { label: 'dsf3-lcdoff', args: ['--disable-lcd-text', '--disable-font-subpixel-positioning'], dsf: 3 },
  { label: 'dsf3-lcdon', args: [], dsf: 3 },
  { label: 'dsf4-lcdoff', args: ['--disable-lcd-text', '--disable-font-subpixel-positioning'], dsf: 4 },
];

const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
for (const config of CONFIGS.filter(c => !only || only.includes(c.label))) {
  // Chromium launch args are process-wide: each configuration needs its own browser instance.
  const browser = await chromium.launch(config.args.length ? { args: config.args } : {});
  const context = await browser.newContext({ viewport: { width: Number(process.env.VW ?? 1280), height: Number(process.env.VH ?? 800) }, deviceScaleFactor: config.dsf });
  await context.addInitScript(t => window.localStorage.setItem('todo-app.session-token', t), token);
  const page = await context.newPage();
  await page.goto(`${WEB}${ROUTE}`, { waitUntil: 'networkidle' });
  await page.getByText(READY).waitFor();
  await page.waitForTimeout(600);
  const pngFile = path.join(here, `matrix-${config.label}.png`);
  await page.screenshot({ path: pngFile, fullPage: true });
  const html = await page.content();
  fs.writeFileSync(path.join(here, `matrix-${config.label}.html`), html);
  const png = decodePng(fs.readFileSync(pngFile));
  const results = checkPalette({ png, brand });
  const entity = checkEntityListInCard(html, { family: brand.identity?.family, cards: cards.classes });
  const offenders = (results.find(r => r.id === 'palette-off-brand').evidence.offenders ?? [])
    .map(o => `${o.hex}(${Math.round(o.share * 100)}% dE${o.deltaE}→${o.nearest})`).join(' ');
  console.log(`${config.label} ${png.width}x${png.height} saturated=${results.find(r => r.id === 'palette-off-brand').evidence.saturatedPixels}`);
  for (const r of results) console.log(`   ${r.id}: ${r.outcome}${r.id === 'palette-off-brand' && offenders ? ` | ${offenders}` : ''}`);
  console.log(`   entity-list-in-card: ${entity.outcome} — ${entity.detail.slice(0, 200)}`);
  await context.close();
  await browser.close();
}
