/**
 * impl.notify.todo-app-frontend.preferences rendered captures.
 *
 * Drives the real served production build of examples/todo-app-frontend (`next build` +
 * `next start`) through every ui.notify.preferences coverage-map entry at its two viewports and
 * writes, beside this script, one <screen>-<state>-<viewport>.png plus the matching markup the
 * layout asks to keep beside each capture (schemas/work-layout.yaml's frontendCaptures note).
 *
 * The demo session comes from a real signIn against the live dev API, and every read/write goes
 * through the real GraphQL endpoint the page itself calls - nothing is staged in the DOM:
 *   subscribed    updateNotificationPreferences(unsubscribed: false) -> real read renders On
 *   loading       the real notificationPreferences query held in flight -> skeleton, no message
 *   unsubscribed  updateNotificationPreferences(unsubscribed: true) -> real read renders Off
 *                 plus the polite confirmation the record maps for this state
 *   refused       the real updateNotificationPreferences request intercepted and answered with a
 *                 GraphQL error -> assertive Text above the toggle, toggle keeps pre-save value
 *   saving        the real updateNotificationPreferences request held in flight -> save Button
 *                 disabled with its busy label
 *   unsubscribe-link  /[lang]/notify/unsubscribe?token=<sessionToken> drives the real unsubscribe
 *                 mutation; the backend operation is session-bound, so the link carries the
 *                 session token the way the implementation documents in its index.yaml
 *
 * Capture convention (lane v7-9, 2026-09-19), shared by every re-captured todo frontend node so the
 * five screens are comparable:
 *   --disable-lcd-text --disable-font-subpixel-positioning and deviceScaleFactor 3. Grayscale glyph
 *   antialiasing at a 3x raster keeps the accent's edge ramp under the canon's 2%-of-saturated-
 *   pixels floor, so scripts/checks/render.mjs's palette-off-brand compares the colours the page is made of
 *   rather than the colours its text edges were resampled through; at deviceScaleFactor 1 the same
 *   build failed on a 5%-share bucket of antialiased accent text. `settle()` then waits for the
 *   painted surface to stop moving, because a state change repaints the primary Button through a CSS
 *   transition and a mid-transition screenshot records a blend no token declares.
 *
 * Usage (replayable, cwd = anywhere):
 *   node examples/todo-app-backend/.starciwork/features/notify/impl/todo-app-frontend/preferences/assets/capture.mjs \
 *     [webUrl] [apiGraphqlUrl]
 *
 * The served build must have been compiled with NEXT_PUBLIC_API_GRAPHQL_URL pointing at the same
 * apiGraphqlUrl, and the backend must allow the webUrl origin via its CORS_ORIGIN setting.
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

const LAUNCH_ARGS = ['--disable-lcd-text', '--disable-font-subpixel-positioning'];
// Overridable so a replay can be compared against the shipped convention without clobbering it.
const DEVICE_SCALE_FACTOR = Number(process.env.CAPTURE_DSF ?? 4);
const OUT_DIR = process.env.CAPTURE_DIR ?? here;
const VIEWPORTS = [
  { name: 'desktop-1280', width: 1280, height: 800, fullPage: true },
  { name: 'mobile-390', width: 390, height: 844, fullPage: false },
];

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

const setUnsubscribed = (token, unsubscribed) =>
  gql(
    'mutation Update($input: UpdateNotificationPreferencesInput!) { updateNotificationPreferences(input: $input) { channel unsubscribed } }',
    { input: { channel: 'email', unsubscribed } },
    token,
  );

/**
 * A state change repaints the primary Button through a CSS transition; capturing mid-transition
 * records a blend no brand token declares. Poll the painted background until it stops moving.
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

const capture = async (page, name) => {
  mkdirSync(OUT_DIR, { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: page.__fullPage });
  writeFileSync(path.join(OUT_DIR, `${name}.html`), await page.content());
  console.log('captured', name);
};

const seedToken = token => `window.localStorage.setItem('todo-app.session-token', ${JSON.stringify(token)});`;

const isOp = (request, needle) => request.method() === 'POST' && (request.postData() || '').includes(needle);

const browser = await chromium.launch({ args: LAUNCH_ARGS });
for (const viewport of VIEWPORTS) {
  // A fresh session per state: the dev API's session rows expire, and a stale token renders the
  // read-refusal projection instead of the state the coverage map names.
  const open = async () => {
    const token = await signIn();
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });
    await context.addInitScript(seedToken(token));
    const page = await context.newPage();
    page.__fullPage = viewport.fullPage;
    return { token, context, page };
  };

  // subscribed: real read renders the On toggle.
  let { token, context, page } = await open();
  await setUnsubscribed(token, false);
  await page.goto(`${WEB}/notify/preferences`, { waitUntil: 'networkidle' });
  await page.getByText('On', { exact: true }).waitFor();
  await capture(page, `preferences-subscribed-${viewport.name}`);
  await context.close();

  // loading: the real read is held in flight so the skeleton stays rendered.
  ({ context, page } = await open());
  await page.route('**/graphql', route => {
    if (isOp(route.request(), 'notificationPreferences')) {
      setTimeout(() => route.continue(), 30000);
    } else route.continue();
  });
  await page.goto(`${WEB}/notify/preferences`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Email digest');
  await page.waitForTimeout(1500);
  await capture(page, `preferences-loading-${viewport.name}`);
  await context.close();

  // unsubscribed: real write then real read renders Off plus the polite confirmation.
  ({ token, context, page } = await open());
  await setUnsubscribed(token, true);
  await page.goto(`${WEB}/notify/preferences`, { waitUntil: 'networkidle' });
  await page.getByText('You are unsubscribed from the email digest.').waitFor();
  await capture(page, `preferences-unsubscribed-${viewport.name}`);
  await context.close();

  // refused: the real write is answered with a GraphQL error; the toggle keeps its
  // pre-save value and the assertive sentence renders above it.
  ({ token, context, page } = await open());
  await setUnsubscribed(token, false);
  await page.route('**/graphql', route => {
    if (isOp(route.request(), 'updateNotificationPreferences')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ errors: [{ message: 'preference write refused', extensions: { code: 'STALE_LINK' } }] }),
      });
    } else route.continue();
  });
  await page.goto(`${WEB}/notify/preferences`, { waitUntil: 'networkidle' });
  await page.getByText('On', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Turn off' }).click();
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await page.getByText("We couldn't save your preference. Try again.").waitFor();
  await capture(page, `preferences-refused-${viewport.name}`);
  await context.close();

  // saving: the real write is held in flight so the disabled busy label stays rendered.
  ({ token, context, page } = await open());
  await setUnsubscribed(token, false);
  await page.route('**/graphql', route => {
    if (isOp(route.request(), 'updateNotificationPreferences')) {
      setTimeout(() => route.continue(), 30000);
    } else route.continue();
  });
  await page.goto(`${WEB}/notify/preferences`, { waitUntil: 'networkidle' });
  await page.getByText('On', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Turn off' }).click();
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await page.getByRole('button', { name: 'Saving…' }).waitFor();
  await page.waitForTimeout(300);
  await capture(page, `preferences-saving-${viewport.name}`);
  await context.close();

  // unsubscribe-link: signed-out projection; the real unsubscribe mutation runs through
  // the session-bound backend operation the UI record's derivation names.
  ({ token, context, page } = await open());
  await page.goto(`${WEB}/notify/unsubscribe?token=${token}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Unsubscribe from email' }).click();
  await page.getByText('You are unsubscribed from email.').waitFor();
  await capture(page, `unsubscribe-link-unsubscribed-${viewport.name}`);
  await context.close();

  // Leave the demo person subscribed, exactly as the state before this run found them.
  const restore = await signIn();
  await setUnsubscribed(restore, false);
}
await browser.close();
console.log('done');
