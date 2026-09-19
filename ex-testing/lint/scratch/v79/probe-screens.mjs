// v7-9 diagnostic #3: how does each of the five rendered screens behave under the candidate
// capture conventions? One screenshot per screen per config, run through the canon checks.
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

const WEB = 'http://localhost:3000';
const API = 'http://localhost:3001/graphql';
const brand = parseYaml(fs.readFileSync(path.join(skillRoot, 'examples/todo-app-backend/.starciwork/brand/index.yaml'), 'utf8')).brand;
const family = brand.identity?.family;
const cards = cardClassesOf({ family });

const gql = async (query, variables, token) => {
  const res = await fetch(API, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  });
  return res.json();
};
const signIn = async (email, password) => {
  const body = await gql('mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken } }',
    { input: { email, password } });
  const token = body?.data?.signIn?.sessionToken;
  if (!token) throw new Error(`signIn refused for ${email}: ${JSON.stringify(body)}`);
  return token;
};

const token = await signIn('demo@todo.dev', 'todo-demo-pass');

// One representative URL per screen; the readiness marker is text that must be on screen.
const SCREENS = [
  { id: 'sign-in', path: '/sign-in', ready: 'Welcome back', auth: false },
  { id: 'notify', path: '/notify/preferences', ready: 'Email digest' },
  { id: 'plan', path: '/plan/usage', ready: 'of cap' },
  { id: 'recur', path: '/recur', ready: 'Repeat' },
  { id: 'share', path: '/tasks', ready: 'Tasks' },
];
const CONFIGS = [
  { label: 'dsf2-lcdoff', args: ['--disable-lcd-text', '--disable-font-subpixel-positioning'], dsf: 2 },
  { label: 'dsf3-lcdoff', args: ['--disable-lcd-text', '--disable-font-subpixel-positioning'], dsf: 3 },
];

for (const config of CONFIGS) {
  const browser = await chromium.launch({ args: config.args });
  for (const screen of SCREENS) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: config.dsf });
    if (screen.auth) await context.addInitScript(t => window.localStorage.setItem('todo-app.session-token', t), token);
    const page = await context.newPage();
    try {
      await page.goto(`${WEB}${screen.path}`, { waitUntil: 'networkidle' });
      await page.getByText(screen.ready).first().waitFor({ timeout: 15_000 });
      await page.waitForTimeout(500);
      const pngFile = path.join(here, `screens-${config.label}-${screen.id}.png`);
      await page.screenshot({ path: pngFile, fullPage: true });
      const html = await page.content();
      const png = decodePng(fs.readFileSync(pngFile));
      const [off, prim] = checkPalette({ png, brand });
      const ent = checkEntityListInCard(html, { family, cards: cards.classes });
      const offenders = (off.evidence.offenders ?? []).map(o => `${o.hex}(${Math.round(o.share * 100)}% dE${o.deltaE})`).join(' ');
      console.log(`${config.label} ${screen.id.padEnd(9)} ${png.width}x${png.height} palette=${off.outcome.padEnd(4)} primary=${prim.outcome.padEnd(4)} entity=${ent.outcome.padEnd(4)}${offenders ? ` | ${offenders}` : ''}${ent.outcome === 'fail' ? ` | ${ent.detail}` : ''}`);
    } catch (error) {
      console.log(`${config.label} ${screen.id.padEnd(9)} PROBE FAILED: ${String(error.message).split('\n')[0]}`);
    }
    await context.close();
  }
  await browser.close();
}
