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
 *   unsubscribe-link  /notify/unsubscribe?token=<sessionToken> drives the real unsubscribe
 *                 mutation; the backend operation is session-bound, so the link carries the
 *                 session token the way the implementation documents in its index.yaml
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

const WEB = process.argv[2] ?? 'http://localhost:3210';
const API = process.argv[3] ?? 'http://localhost:3901/graphql';

const VIEWPORTS = [
  { name: 'desktop-1280', width: 1280, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
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

const capture = async (page, name) => {
  mkdirSync(here, { recursive: true });
  await page.screenshot({ path: path.join(here, `${name}.png`), fullPage: true });
  writeFileSync(path.join(here, `${name}.html`), await page.content());
  console.log('captured', name);
};

const seedToken = token => `window.localStorage.setItem('todo-app.session-token', ${JSON.stringify(token)});`;

const isOp = (request, needle) => request.method() === 'POST' && (request.postData() || '').includes(needle);

const run = async () => {
  const token = await signIn();
  console.log('session', token.slice(0, 8));
  const browser = await chromium.launch();

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    await context.addInitScript(seedToken(token));

    // subscribed: real read renders the On toggle.
    await setUnsubscribed(token, false);
    let page = await context.newPage();
    await page.goto(`${WEB}/notify/preferences`, { waitUntil: 'networkidle' });
    await page.getByText('On', { exact: true }).waitFor();
    await capture(page, `preferences-subscribed-${viewport.name}`);
    await page.close();

    // loading: the real read is held in flight so the skeleton stays rendered.
    page = await context.newPage();
    await page.route('**/graphql', route => {
      if (isOp(route.request(), 'notificationPreferences')) {
        setTimeout(() => route.continue(), 30000);
      } else route.continue();
    });
    await page.goto(`${WEB}/notify/preferences`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Email digest');
    await page.waitForTimeout(1500);
    await capture(page, `preferences-loading-${viewport.name}`);
    await page.unrouteAll();
    await page.close();

    // unsubscribed: real write then real read renders Off plus the polite confirmation.
    await setUnsubscribed(token, true);
    page = await context.newPage();
    await page.goto(`${WEB}/notify/preferences`, { waitUntil: 'networkidle' });
    await page.getByText('You are unsubscribed from the email digest.').waitFor();
    await capture(page, `preferences-unsubscribed-${viewport.name}`);
    await page.close();

    // refused: the real write is answered with a GraphQL error; the toggle keeps its
    // pre-save value and the assertive sentence renders above it.
    await setUnsubscribed(token, false);
    page = await context.newPage();
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
    await page.unrouteAll();
    await page.close();

    // saving: the real write is held in flight so the disabled busy label stays rendered.
    page = await context.newPage();
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
    await page.unrouteAll();
    await page.close();

    // unsubscribe-link: signed-out projection; the real unsubscribe mutation runs through
    // the session-bound backend operation the UI record's derivation names.
    page = await context.newPage();
    await page.goto(`${WEB}/notify/unsubscribe?token=${token}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Unsubscribe from email' }).click();
    await page.getByText('You are unsubscribed from email.').waitFor();
    await capture(page, `unsubscribe-link-unsubscribed-${viewport.name}`);
    await page.close();

    await context.close();
  }

  await setUnsubscribed(token, false);
  await browser.close();
  console.log('done');
};

run().catch(error => {
  console.error(error);
  process.exit(1);
});
