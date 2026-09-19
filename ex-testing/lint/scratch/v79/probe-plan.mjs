// v7-9 diagnostic: what does /plan/usage actually render with 40 active seeded tasks?
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, '../../../..');
const require = createRequire(path.join(skillRoot, 'examples/todo-app-frontend/package.json'));
const { chromium } = require('playwright');

const A = 'http://localhost:3001/graphql';
const g = async (q, v, t) => (await (await fetch(A, {
  method: 'POST', headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) },
  body: JSON.stringify({ query: q, variables: v ?? {} }),
})).json());
const psql = sql => execFileSync('docker', ['exec', 'compose-postgres-1', 'psql', '-U', 'postgres', '-d', 'todo', '-t', '-A', '-c', sql], { encoding: 'utf8' }).trim();

const tk = (await g('mutation S($i: SignInInput!){signIn(input:$i){sessionToken}}', { i: { email: 'demo@todo.dev', password: 'todo-demo-pass' } })).data.signIn.sessionToken;
const pid = psql(`select person_id from sessions where token = '${tk}'`);
psql(`delete from tasks where id like 'v79-plan-seed-%'`);
psql(`insert into tasks (id, owner, title, complete) select 'v79-plan-seed-' || generate_series(1,40), '${pid}', 'Seeded task ' || generate_series(1,40), false`);
console.log('seeded rows', psql(`select count(*) from tasks where id like 'v79-plan-seed-%' and complete = false`));
console.log('planUsage', JSON.stringify(await g('query{planUsage{plan cap activeCount}}', null, tk)));

const browser = await chromium.launch({ args: ['--disable-lcd-text'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await context.addInitScript(t => window.localStorage.setItem('todo-app.session-token', t), tk);
const page = await context.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('console.error:', m.text().slice(0, 200)); });
await page.goto('http://localhost:3000/plan/usage', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
console.log('URL', page.url());
console.log('TEXT:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 900));
fs.writeFileSync(path.join(here, 'plan-probe.html'), await page.content());
await page.screenshot({ path: path.join(here, 'plan-probe.png'), fullPage: true });
await browser.close();
psql(`delete from tasks where id like 'v79-plan-seed-%'`);
console.log('cleaned');
