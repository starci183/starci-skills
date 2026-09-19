/**
 * impl.login.todo-app-frontend.sign-in running-page captures (lane v7-9 re-capture).
 *
 * Drives the served production build of examples/todo-app-frontend (`next build` + `next start`)
 * through ui.login.sign-in's four declared states at its two declared viewports and writes, beside
 * this script, one `sign-in-<state>-<viewport>.png` plus the markup the layout asks to keep beside
 * each capture (schemas/work-layout.yaml's frontendCaptures note).
 *
 * Every state is reached the way a reader reaches it: the form's own inputs and the real
 * `signIn` GraphQL mutation the page itself calls. Nothing is staged in the DOM.
 *   empty   a fresh visit with both fields untouched
 *   filled  a valid pair typed into the real fields
 *   working the real mutation held in flight, so the busy label is still painted
 *   refused the real mutation answered with the normalized refusal
 *
 * Capture convention (this is what makes the palette proof measure the design and not the raster):
 *   --disable-lcd-text --disable-font-subpixel-positioning, and deviceScaleFactor 3.
 * Grayscale glyph antialiasing plus a 3x raster keep the accent's edge ramp below the canon's
 * 2%-of-saturated-pixels floor, so `scripts/checks/render.mjs`'s palette-off-brand compares the colours the
 * page is actually made of. At deviceScaleFactor 1 the same build fails the same check on a
 * 5%-share bucket of antialiased accent text edges; that is a property of the raster density, not
 * of the palette. The CSS layout is identical at every scale factor.
 *
 * Usage (replayable, cwd = anywhere):
 *   node examples/todo-app-backend/.starciwork/features/login/impl/todo-app-frontend/sign-in/assets/capture.mjs \
 *     [webUrl] [apiGraphqlUrl]
 * Defaults: http://localhost:3000 and http://localhost:3001/graphql (the dev runbook's ports).
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendPkg = path.resolve(here, '../../../../../../../../todo-app-frontend/package.json');
const require = createRequire(frontendPkg);
const { chromium } = require('playwright');

const WEB = process.argv[2] ?? 'http://localhost:3000';
const API = process.argv[3] ?? 'http://localhost:3001/graphql';
const PERSON = { email: 'demo@todo.dev', password: 'todo-demo-pass' };

const VIEWPORTS = [
  { name: 'desktop-1280', width: 1280, height: 800, fullPage: true },
  { name: 'mobile-390', width: 390, height: 844, fullPage: false },
];
const LAUNCH_ARGS = ['--disable-lcd-text', '--disable-font-subpixel-positioning'];
const DEVICE_SCALE_FACTOR = Number(process.env.CAPTURE_DSF ?? 4);

const stateOf = async page => page.locator('form[data-state]').getAttribute('data-state');

/**
 * A state change repaints the submit control through a CSS transition, and a screenshot taken
 * mid-transition captures a colour the design never declares - the enabled accent went out as a
 * 15%-toward-white blend and failed palette-off-brand. Poll the painted background until it stops
 * moving so every capture is of a settled surface.
 */
const settle = async page => {
  await page.waitForFunction(() => {
    const button = document.querySelector('form[data-state] button[type="submit"]');
    if (!button) return false;
    const painted = getComputedStyle(button).backgroundColor;
    if (window.__captureSettleColor !== painted) {
      window.__captureSettleColor = painted;
      return false;
    }
    return true;
  }, null, { timeout: 5000, polling: 100 }).catch(() => undefined);
  await page.waitForTimeout(250);
};

const snap = async (page, name) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(here, `sign-in-${name}.png`), fullPage: page.__fullPage });
  writeFileSync(path.join(here, `sign-in-${name}.html`), await page.content());
  console.log(`captured sign-in-${name}.png`);
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
for (const viewport of VIEWPORTS) {
  const open = async () => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });
    const page = await context.newPage();
    page.__fullPage = viewport.fullPage;
    return { context, page };
  };
  const form = page => page.locator('form[data-state]');
  const submit = page => page.getByRole('button', { name: /Sign in|Signing in/ });

  // empty: untouched fields, submit disabled.
  let { context, page } = await open();
  await page.goto(`${WEB}/sign-in`, { waitUntil: 'networkidle' });
  await form(page).waitFor();
  if (await stateOf(page) !== 'empty') throw new Error(`${viewport.name}: expected data-state=empty, saw ${await stateOf(page)}`);
  await settle(page);
  await snap(page, `empty-${viewport.name}`);
  await context.close();

  // filled: a valid pair typed into the real fields.
  ({ context, page } = await open());
  await page.goto(`${WEB}/sign-in`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(PERSON.email);
  await page.getByLabel('Password').fill(PERSON.password);
  await page.waitForFunction(() => document.querySelector('form[data-state]')?.dataset.state === 'filled');
  await settle(page);
  await snap(page, `filled-${viewport.name}`);
  await context.close();

  // working: the real mutation is held in flight, so the busy label is what the reader sees.
  ({ context, page } = await open());
  await page.route('**/graphql', async route => {
    await new Promise(resolve => setTimeout(resolve, 4000));
    await route.continue();
  });
  await page.goto(`${WEB}/sign-in`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(PERSON.email);
  await page.getByLabel('Password').fill(PERSON.password);
  await submit(page).click();
  await page.getByRole('button', { name: 'Signing in...' }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  await settle(page);
  await snap(page, `working-${viewport.name}`);
  await context.close();

  // refused: the real mutation answered with the normalized refusal, no interception.
  ({ context, page } = await open());
  await page.goto(`${WEB}/sign-in`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(PERSON.email);
  await page.getByLabel('Password').fill('a-wrong-password');
  const answered = page.waitForResponse(response => response.url().includes('/graphql'), { timeout: 10_000 });
  await submit(page).click();
  await answered;
  await page.waitForFunction(() => document.querySelector('form[data-state]')?.dataset.state === 'refused', null, { timeout: 10_000 });
  await page.getByRole('alert').filter({ hasText: 'That email and password do not match.' }).waitFor();
  await settle(page);
  await snap(page, `refused-${viewport.name}`);
  await context.close();
}
await browser.close();
console.log('capture: all 8 ui.login.sign-in state captures written beside this script');
