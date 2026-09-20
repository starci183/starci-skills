/**
 * impl.recur.todo-app-frontend.schedule running-page captures (lane v7-9 re-capture, 2026-09-19).
 *
 * Drives the real served production build of examples/todo-app-frontend through ui.recur.schedule's
 * four declared states at its two declared viewports and writes, beside this script, one
 * running-page-<state>-<viewport>.png plus the matching markup the layout asks to keep beside
 * each capture (schemas/work-layout.yaml's frontendCaptures note).
 *
 * Every state is reached through the page's own controls - nothing is staged in the DOM:
 *   no-rule  a fresh visit renders only the make-recurring form
 *   refused  Every N days + n=0 + the direction's retained values, submitted -> the form refuses
 *   active   the same form saved with n=2 against the live API -> summary + upcoming + End rule
 *   ended    End rule confirmed -> previews gone, materialised history kept
 *
 * The task the schedule is built for is created through the real `createTask` mutation and deleted
 * again at the end of the run, so a replay leaves no row behind. The demo session comes from a real
 * signIn against the dev API; the refused state needs no session (the refusal is the form's own
 * draft validation, exactly as fr.recur.make-recurring's positive-integer invariant specifies).
 *
 * Capture convention, shared by every re-captured todo frontend node (see the notify node's
 * capture.mjs header for the measurement behind it): grayscale antialiasing plus
 * deviceScaleFactor 4, and settle() before every shot so no capture records a CSS transition.
 *
 * Usage (replayable, cwd = anywhere):
 *   node examples/todo-app-backend/.starciwork/features/recur/impl/todo-app-frontend/schedule/assets/capture.mjs \
 *     [webUrl] [apiGraphqlUrl]
 */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendPkg = path.resolve(here, '../../../../../../../../todo-app-frontend/package.json');
const require = createRequire(frontendPkg);
const { chromium } = require('playwright');

const WEB = process.argv[2] ?? 'http://localhost:3000';
const API = process.argv[3] ?? 'http://localhost:3001/graphql';
const TASK = 'Water the plants';
const LAUNCH_ARGS = ['--disable-lcd-text', '--disable-font-subpixel-positioning'];
const DEVICE_SCALE_FACTOR = Number(process.env.CAPTURE_DSF ?? 4);
const OUT_DIR = process.env.CAPTURE_DIR ?? here;

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800, fullPage: true },
  // Mobile keeps the declared 390 width and stays a plain viewport shot (no stitch - the sticky
  // compactNavigation would paint mid-page). The height is grown to the document's scroll height
  // once the state has settled (see shot()), capped so a runaway page cannot blow up the raster;
  // a tall phone frames the whole form, primary action included, instead of cropping it.
  { name: 'mobile', width: 390, height: 844, fullPage: false, growToDocument: true },
];
const MOBILE_MAX_HEIGHT = 1600;

const gql = async (query, variables, token) => {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  });
  return res.json();
};

const signIn = async () => {
  const body = await gql('mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken } }', {
    input: { email: 'demo@todo.dev', password: 'todo-demo-pass' },
  });
  const token = body?.data?.signIn?.sessionToken;
  if (typeof token !== 'string') throw new Error(`signIn refused: ${JSON.stringify(body)}`);
  return token;
};

/** The schedule screen is built for one task by title; make sure this run owns one. */
const ensureTask = async token => {
  const existing = await gql('query { tasks { taskId title } }', null, token);
  const found = (existing?.data?.tasks ?? []).find(task => task.title === TASK);
  if (found) return { taskId: found.taskId, created: false };
  const created = await gql('mutation Create($input: CreateTaskInput!) { createTask(input: $input) { taskId } }',
    { input: { title: TASK } }, token);
  const taskId = created?.data?.createTask?.taskId;
  if (!taskId) throw new Error(`createTask refused: ${JSON.stringify(created)}`);
  return { taskId, created: true };
};

/**
 * A state change repaints the primary Button through a CSS transition; capturing mid-transition
 * records a blend no brand token declares. Poll the painted surfaces until they stop moving.
 */
const settle = async page => {
  await page.waitForFunction(() => {
    const painted = [...document.querySelectorAll('button')]
      .map(button => `${button.textContent?.trim()}:${getComputedStyle(button).backgroundColor}`)
      .join('|');
    if (window.__captureSettleMark !== painted) {
      window.__captureSettleMark = painted;
      return false;
    }
    return true;
  }, null, { timeout: 5000, polling: 100 }).catch(() => undefined);
  await page.waitForTimeout(250);
};

const shot = async (page, name, viewport) => {
  mkdirSync(OUT_DIR, { recursive: true });
  // The Next.js dev-tools overlay is build tooling, not product chrome; it is removed so the
  // capture shows only the implemented surface.
  await page.evaluate(() => document.querySelectorAll('nextjs-portal').forEach(el => el.remove()));
  // Interactions (radio focus, submit scroll-into-view) move the scroll position; the capture is of
  // the rendered screen from the top, matching the direction's own framing. Desktop captures the
  // full page; mobile captures the viewport - the shell's sticky bottom navigation bar is
  // viewport-pinned chrome, and a full-page stitch would paint it mid-document over the form.
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  if (viewport.growToDocument) {
    const height = Math.min(
      Math.max(await page.evaluate(() => document.documentElement.scrollHeight), viewport.height),
      MOBILE_MAX_HEIGHT,
    );
    if (height !== viewport.height) {
      await page.setViewportSize({ width: viewport.width, height });
      await page.evaluate(() => window.scrollTo(0, 0));
      await settle(page);
    }
  }
  await page.screenshot({ path: path.join(OUT_DIR, `running-page-${name}.png`), fullPage: viewport.fullPage });
  writeFileSync(path.join(OUT_DIR, `running-page-${name}.html`), await page.content());
  console.log(`captured running-page-${name}.png`);
};

const PAGE_URL = `${WEB}/recur?task=${encodeURIComponent(TASK)}`;
const browser = await chromium.launch({ args: LAUNCH_ARGS });

for (const viewport of VIEWPORTS) {
  try {
    const token = await signIn();
    const { taskId, created } = await ensureTask(token);
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });
    await context.addInitScript(value => window.localStorage.setItem('todo-app.session-token', value), token);
    const page = await context.newPage();

    // --- no-rule ---
    await page.goto(PAGE_URL, { waitUntil: 'networkidle' });
    await page.getByRole('radio', { name: 'Every N days' }).waitFor();
    await shot(page, `no-rule-${viewport.name}`, viewport);

    // --- refused: every-n-days with n=0, the direction's retained draft ---
    await page.getByRole('radio', { name: 'Every N days' }).check();
    await page.getByLabel('Every (days)').fill('0');
    await page.getByLabel('Time of day').fill('09:00');
    await page.getByLabel('Time zone').fill('Asia/Bangkok');
    await page.getByLabel('Start date').fill('2026-09-21');
    await page.getByRole('button', { name: 'Save schedule' }).click();
    await page.getByText('Enter a number of days greater than zero.').waitFor();
    await shot(page, `refused-${viewport.name}`, viewport);

    // --- active: the same make-recurring form saved with a valid n=2 against the live API ---
    await page.getByLabel('Every (days)').fill('2');
    await page.getByRole('button', { name: 'Save schedule' }).click();
    await page.getByText('Upcoming occurrences').waitFor();
    await shot(page, `active-${viewport.name}`, viewport);

    // --- ended: End rule confirmed in place ---
    await page.getByRole('button', { name: 'End rule' }).click();
    await page.getByRole('button', { name: 'End rule', exact: true }).last().click();
    await page.getByText('Nothing upcoming').waitFor();
    await shot(page, `ended-${viewport.name}`, viewport);

    await context.close();
    // Leave no fixture behind: the rule is already ended, so the task is this run's only row.
    if (created) await gql('mutation Delete($id: ID!) { deleteTask(id: $id) { __typename }', { id: taskId }, token);
  } catch (error) {
    console.error(`capture ${viewport.name} failed:`, error);
    process.exitCode = 1;
  }
}
await browser.close();
console.log('capture: 8 running-page captures for ui.recur.schedule');
