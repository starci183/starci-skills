// v7-9 diagnostic: does the palette-off-brand refusal come from LCD subpixel text
// antialiasing in the capture, or from colours the app actually paints?
// Same page, same build, two browser launches; run the canon check on both PNGs.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, '../../../..');
const frontendPkg = path.resolve(skillRoot, 'examples/todo-app-frontend/package.json');
const require = createRequire(frontendPkg);
const { chromium } = require('playwright');
const { decodePng, checkPalette } = await import(pathToFileURL(path.join(skillRoot, 'checks/render.mjs')).href);
const { parseYaml } = await import(pathToFileURL(path.join(skillRoot, 'core/yaml.mjs')).href);

const WEB = 'http://localhost:3000';
const API = 'http://localhost:3001/graphql';
const brand = parseYaml(fs.readFileSync(path.join(skillRoot, 'examples/todo-app-backend/.starciwork/brand/index.yaml'), 'utf8')).brand;

const gql = async (query, variables, token) => {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  });
  return res.json();
};

const shoot = async (label, args) => {
  const browser = await chromium.launch(args.length ? { args } : {});
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const token = (await gql('mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken } }',
    { input: { email: 'demo@todo.dev', password: 'todo-demo-pass' } }))?.data?.signIn?.sessionToken;
  await context.addInitScript(t => window.localStorage.setItem('todo-app.session-token', t), token);
  const page = await context.newPage();
  await page.goto(`${WEB}/notify/preferences`, { waitUntil: 'networkidle' });
  await page.getByText('Email digest').waitFor();
  await page.waitForTimeout(800);
  const file = path.join(here, `probe-${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  fs.writeFileSync(path.join(here, `probe-${label}.html`), await page.content());
  await browser.close();
  const png = decodePng(fs.readFileSync(file));
  for (const result of checkPalette({ png, brand })) {
    console.log(`[${label}] ${result.id}: ${result.outcome} — ${result.detail.slice(0, 400)}`);
  }
};

await shoot('lcd-on', []);
await shoot('lcd-off', ['--disable-lcd-text', '--disable-font-subpixel-positioning']);
