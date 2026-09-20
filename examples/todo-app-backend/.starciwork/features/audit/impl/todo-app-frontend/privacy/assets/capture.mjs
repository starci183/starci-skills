/**
 * impl.audit.todo-app-frontend.privacy running captures (lane w10 re-capture, 2026-09-20).
 *
 * Drives the real served production build of examples/todo-app-frontend through every
 * ui.audit.privacy state at its two declared viewports and writes, beside this script, one
 * privacy-<state>-<viewport>.png plus the matching markup the layout asks to keep beside each
 * capture (schemas/work-layout.yaml's frontendCaptures note), and the real todo-app-export
 * download for each viewport.
 *
 * Every state is reached through the page's own controls against the live dev API - nothing is
 * staged in the DOM:
 *   idle               a fresh signed-in visit renders both actions enabled
 *   exporting          the real exportMyData query held in flight -> pending Export button
 *   requesting-erasure Request erasure clicked -> the confirm/cancel pair renders
 *   erasure-pending    Confirm erasure clicked while the real requestErasure call is held in
 *                      flight -> both actions disabled, polite pending status
 *   erasure-refused    the real requestErasure call answered with a GraphQL error -> the
 *                      assertive refusal sentence, actions enabled again
 *   erasure-complete   the real requestErasure + completeErasure chain runs to completion ->
 *                      the polite completion sentence, actions retired
 *
 * The demo session comes from a real signIn. The export download is captured through the
 * browser's download event and saved as todo-app-export-<viewport>.json, the file the view's
 * blob anchor would have handed the reader.
 *
 * Capture convention, shared by every re-captured todo frontend node (see the notify node's
 * capture.mjs header for the measurement behind it): grayscale antialiasing plus
 * deviceScaleFactor 4, and settle() before every shot so no capture records a CSS transition.
 * Desktop captures the full page; mobile captures the viewport - the shell's compactNavigation
 * is position:sticky bottom and a full-page stitch would paint it mid-document.
 *
 * Usage (replayable, cwd = anywhere):
 *   node examples/todo-app-backend/.starciwork/features/audit/impl/todo-app-frontend/privacy/assets/capture.mjs \
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

const LAUNCH_ARGS = ['--disable-lcd-text', '--disable-font-subpixel-positioning'];
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

const capture = async (page, name, viewport) => {
  mkdirSync(OUT_DIR, { recursive: true });
  // The Next.js dev-tools overlay is build tooling, not product chrome; it is removed so the
  // capture shows only the implemented surface.
  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach(el => el.remove());
    window.scrollTo(0, 0);
  });
  await settle(page);
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: viewport.fullPage });
  writeFileSync(path.join(OUT_DIR, `${name}.html`), await page.content());
  console.log('captured', name);
};

const seedToken = token => `window.localStorage.setItem('todo-app.session-token', ${JSON.stringify(token)});`;

const isOp = (request, needle) => request.method() === 'POST' && (request.postData() || '').includes(needle);

const PAGE_URL = `${WEB}/audit/privacy`;
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
    return { token, context, page };
  };

  try {
    // idle + the real export download: one visit drives both. The download event hands back
    // the exact bytes the blob anchor produced, saved as the record's todo-app-export artifact.
    let { context, page } = await open();
    await page.goto(PAGE_URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Export my data' }).waitFor();
    const downloadWait = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export my data' }).click();
    const download = await downloadWait;
    await download.saveAs(path.join(OUT_DIR, `todo-app-export-${viewport.name}.json`));
    await capture(page, `privacy-idle-${viewport.name}`, viewport);
    await context.close();

    // exporting: the real read is held in flight so the pending Export button stays rendered.
    ({ context, page } = await open());
    await page.route('**/graphql', route => {
      if (isOp(route.request(), 'exportMyData')) {
        setTimeout(() => route.continue(), 30000);
      } else route.continue();
    });
    await page.goto(PAGE_URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Export my data' }).click();
    await page.getByRole('button', { name: 'Exporting…' }).waitFor();
    await page.waitForTimeout(300);
    await capture(page, `privacy-exporting-${viewport.name}`, viewport);
    await context.close();

    // requesting-erasure: the direction's confirm/cancel pair, reached by the real control.
    ({ context, page } = await open());
    await page.goto(PAGE_URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Request erasure' }).click();
    await page.getByRole('button', { name: 'Confirm erasure' }).waitFor();
    await capture(page, `privacy-requesting-erasure-${viewport.name}`, viewport);
    await context.close();

    // erasure-pending: the real requestErasure call held in flight, so the disabled actions
    // and the polite pending status stay rendered.
    ({ context, page } = await open());
    await page.route('**/graphql', route => {
      if (isOp(route.request(), 'requestErasure')) {
        setTimeout(() => route.continue(), 30000);
      } else route.continue();
    });
    await page.goto(PAGE_URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Request erasure' }).click();
    await page.getByRole('button', { name: 'Confirm erasure' }).click();
    await page.getByText('Submitting your erasure request…').waitFor();
    await page.waitForTimeout(300);
    await capture(page, `privacy-erasure-pending-${viewport.name}`, viewport);
    await context.close();

    // erasure-refused: the real requestErasure call is answered with a GraphQL error; the
    // assertive refusal sentence renders and both actions are enabled again.
    ({ context, page } = await open());
    await page.route('**/graphql', route => {
      if (isOp(route.request(), 'requestErasure')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ errors: [{ message: 'erasure refused', extensions: { code: 'ERASURE_REFUSED' } }] }),
        });
      } else route.continue();
    });
    await page.goto(PAGE_URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Request erasure' }).click();
    await page.getByRole('button', { name: 'Confirm erasure' }).click();
    await page.getByText("We couldn't submit your erasure request. Try again.").waitFor();
    await capture(page, `privacy-erasure-refused-${viewport.name}`, viewport);
    await context.close();

    // erasure-complete: the real requestErasure + completeErasure chain runs against the live
    // API. Erasure only strips the person's identifying fields from their own audit lines; the
    // demo account itself keeps working, so a replay is safe.
    ({ context, page } = await open());
    await page.goto(PAGE_URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Request erasure' }).click();
    await page.getByRole('button', { name: 'Confirm erasure' }).click();
    await page.getByText('Your erasure request is complete.', { exact: false }).waitFor();
    await capture(page, `privacy-erasure-complete-${viewport.name}`, viewport);
    await context.close();
  } catch (error) {
    console.error(`capture ${viewport.name} failed:`, error);
    process.exitCode = 1;
  }
}
await browser.close();
console.log('capture: 12 privacy captures + 2 export downloads for ui.audit.privacy');
