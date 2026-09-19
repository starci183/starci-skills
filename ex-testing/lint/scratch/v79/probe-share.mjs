// v7-9 diagnostic: what does the share screen actually render for this task?
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(here, '../../../..');
const require = createRequire(path.join(skillRoot, 'examples/todo-app-frontend/package.json'));
const { chromium } = require('playwright');

const API = 'http://localhost:3001/graphql';
const gql = async (query, variables, token) => (await (await fetch(API, {
  method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify({ query, variables: variables ?? {} }),
})).json());

const token = (await gql('mutation SignIn($input: SignInInput!){signIn(input:$input){sessionToken}}',
  { input: { email: 'demo@todo.dev', password: 'todo-demo-pass' } }))?.data?.signIn?.sessionToken;
const tasks = await gql('query{tasks{taskId title complete}}', null, token);
console.log('tasks', JSON.stringify(tasks));
const id = process.argv[2] ?? tasks?.data?.tasks?.[0]?.taskId;
console.log('target', id);

const browser = await chromium.launch({ args: ['--disable-lcd-text'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 938 }, deviceScaleFactor: 2 });
await context.addInitScript(t => window.localStorage.setItem('todo-app.session-token', t), token);
const page = await context.newPage();
await page.goto(`http://localhost:3000/tasks/${id}/share`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const states = await page.evaluate(() => [...document.querySelectorAll('[data-state]')]
  .map(el => `${el.tagName.toLowerCase()}.${(el.className ?? '').toString().split(' ')[0]}=${el.dataset.state}`));
console.log('data-state elements:', JSON.stringify(states));
console.log('body text head:', (await page.locator('main').innerText().catch(() => '')).slice(0, 600).replaceAll('\n', ' / '));
fs.writeFileSync(path.join(here, 'share-probe.html'), await page.content());
await page.screenshot({ path: path.join(here, 'share-probe.png'), fullPage: true });
await browser.close();
