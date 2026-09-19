// v7-9 diagnostic #4: the mobile filled sign-in state paints one large accent fill whose OKLab
// bucket mean sits at deltaE 6.44 from the token (tolerance 6.0). Does a denser raster pull the
// bucket mean onto the token? Same state, four scale factors.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, '../../../..');
const require = createRequire(path.join(skillRoot, 'examples/todo-app-frontend/package.json'));
const { chromium } = require('playwright');
const { decodePng, checkPalette } = await import(pathToFileURL(path.join(skillRoot, 'checks/render.mjs')).href);
const { parseYaml } = await import(pathToFileURL(path.join(skillRoot, 'core/yaml.mjs')).href);
const brand = parseYaml(fs.readFileSync(path.join(skillRoot, 'examples/todo-app-backend/.starciwork/brand/index.yaml'), 'utf8')).brand;

const browser = await chromium.launch({ args: ['--disable-lcd-text', '--disable-font-subpixel-positioning'] });
for (const dsf of [1, 2, 3, 4, 5]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dsf });
  const page = await context.newPage();
  await page.goto('http://localhost:3000/sign-in', { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill('demo@todo.dev');
  await page.getByLabel('Password').fill('todo-demo-pass');
  await page.waitForFunction(() => document.querySelector('form[data-state]')?.dataset.state === 'filled');
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(200);
  const file = path.join(here, `dsf-filled-mobile-${dsf}.png`);
  await page.screenshot({ path: file });
  const [off, prim] = checkPalette({ png: decodePng(fs.readFileSync(file)), brand });
  const offenders = (off.evidence.offenders ?? []).map(o => `${o.hex}(${Math.round(o.share * 100)}% dE${o.deltaE})`).join(' ');
  console.log(`dsf${dsf} ${off.outcome}${offenders ? ` | ${offenders}` : ''} | primary=${prim.outcome} | ${prim.detail.slice(0, 110)}`);
  await context.close();
}
await browser.close();
