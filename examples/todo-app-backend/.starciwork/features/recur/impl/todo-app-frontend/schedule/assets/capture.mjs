/**
 * impl.recur.todo-app-frontend.schedule running-page captures.
 *
 * Drives the real served build of examples/todo-app-frontend through ui.recur.schedule's four
 * states at the record's two viewports and writes, beside this script, one
 * running-page-<state>-<viewport>.png plus the matching markup the layout asks to keep beside
 * each capture (schemas/work-layout.yaml's frontendCaptures note).
 *
 * Every state is reached through the page's own controls - nothing is staged in the DOM:
 *   no-rule  a fresh visit renders only the make-recurring form
 *   refused  Every N days + n=0 + the direction's retained values, submitted -> the form refuses
 *   active   the same form saved with n=2 against the live API -> summary + upcoming + End rule
 *   ended    End rule confirmed -> previews gone, materialised history kept
 *
 * The demo session for the two post-creation states comes from a real signIn against the dev API;
 * the refused state needs no session (the refusal is the form's own draft validation, exactly as
 * fr.recur.make-recurring's positive-integer invariant specifies).
 *
 * Usage (replayable, cwd = the frontend repo):
 *   node ../todo-app-backend/.starciwork/features/recur/impl/todo-app-frontend/schedule/assets/capture.mjs \
 *     [webUrl] [apiGraphqlUrl]
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendPkg = path.resolve(here, '../../../../../../../../todo-app-frontend/package.json');
const require = createRequire(frontendPkg);
const { chromium } = require('playwright');

const WEB = process.argv[2] ?? 'http://localhost:3117';
const API = process.argv[3] ?? 'http://localhost:3003/graphql';
const TASK = 'Water the plants';
const PAGE_URL = `${WEB}/recur?task=${encodeURIComponent(TASK)}`;

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

const signIn = async () => {
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: 'mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken } }',
      variables: { input: { email: 'demo@todo.dev', password: 'todo-demo-pass' } },
    }),
  });
  const body = await response.json();
  const token = body?.data?.signIn?.sessionToken;
  if (typeof token !== 'string') throw new Error(`signIn refused: ${JSON.stringify(body)}`);
  return token;
};

const shot = async (page, name, fullPage) => {
  // The Next.js dev-tools overlay is build tooling, not product chrome; it is removed so the
  // capture shows only the implemented surface.
  await page.evaluate(() => document.querySelectorAll('nextjs-portal').forEach(el => el.remove()));
  // Interactions (radio focus, submit scroll-into-view) move the scroll position; the capture is of
  // the rendered screen from the top, matching the direction's own framing. Desktop captures the
  // full page; mobile captures the viewport - the shell's sticky bottom navigation bar is
  // viewport-pinned chrome, and a full-page stitch would paint it mid-document over the form.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(here, `running-page-${name}.png`), fullPage });
  writeFileSync(path.join(here, `running-page-${name}.html`), await page.content());
  console.log(`captured running-page-${name}.png`);
};

const capture = async (viewport) => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });

  // --- no-rule ---
  await page.goto(PAGE_URL, { waitUntil: 'networkidle' });
  await page.getByRole('radio', { name: 'Every N days' }).waitFor();
  await shot(page, `no-rule-${viewport.name}`, viewport.name === 'desktop');

  // --- refused: every-n-days with n=0, the direction's retained draft ---
  await page.getByRole('radio', { name: 'Every N days' }).check();
  await page.getByLabel('Every (days)').fill('0');
  await page.getByLabel('Time of day').fill('09:00');
  await page.getByLabel('Time zone').fill('Asia/Bangkok');
  await page.getByLabel('Start date').fill('2026-09-21');
  await page.getByRole('button', { name: 'Save schedule' }).click();
  await page.getByText('Enter a number of days greater than zero.').waitFor();
  await shot(page, `refused-${viewport.name}`, viewport.name === 'desktop');

  // --- active: signed in (the token is written before the reload so useSessionToken reads it at
  // mount), then the same make-recurring form saved with a valid n=2 against the live API ---
  const token = await signIn();
  await page.evaluate(value => window.localStorage.setItem('todo-app.session-token', value), token);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('radio', { name: 'Every N days' }).check();
  await page.getByLabel('Every (days)').fill('2');
  await page.getByRole('button', { name: 'Save schedule' }).click();
  await page.getByText('Upcoming occurrences').waitFor();
  await shot(page, `active-${viewport.name}`, viewport.name === 'desktop');

  // --- ended: End rule confirmed in place ---
  await page.getByRole('button', { name: 'End rule' }).click();
  await page.getByRole('button', { name: 'End rule', exact: true }).last().click();
  await page.getByText('Nothing upcoming').waitFor();
  await shot(page, `ended-${viewport.name}`, viewport.name === 'desktop');

  await browser.close();
};

for (const viewport of VIEWPORTS) {
  try {
    await capture(viewport);
  } catch (error) {
    console.error(`capture ${viewport.name} failed:`, error);
    process.exitCode = 1;
  }
}
