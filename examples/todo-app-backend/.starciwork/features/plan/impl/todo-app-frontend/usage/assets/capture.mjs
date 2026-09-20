/**
 * impl.plan.todo-app-frontend.usage running-page captures (lane v7-9 re-capture, 2026-09-19).
 *
 * Drives the served production build of examples/todo-app-frontend (`next build` + `next start`)
 * through the seven captures impl.plan.todo-app-frontend.usage's `captures:` list names, writing
 * beside this script one .png plus the .html the layout asks to keep beside each capture.
 *
 * The read is the real `planUsage` query against the real API; only the *rows behind it* are
 * staged, because the free-plan cap makes some of the declared states unreachable through the
 * create path (PLAN_CAP_EXCEEDED refuses the 21st task) and SePay is unreachable from dev, so an
 * upgrade cannot be paid. That is the same approach the node's own CAPTURES.md documents; here the
 * staging is confined to rows this script owns and deletes again:
 *   under-cap         8 active seeded tasks            -> "40% of cap"
 *   at-cap           20 active seeded tasks            -> "100% of cap"
 *   over-cap-frozen  40 active seeded tasks            -> "200% of cap", creation paused
 *   paid-unlimited   the seeded subscription row paid  -> "Paid plan", no cap, no bar
 *   refused          a fresh context with no session   -> the page's own session-ended refusal
 *   loading          the real planUsage read delayed   -> the skeleton
 *
 * Capture convention, shared by every re-captured todo frontend node (the measurement behind it is
 * recorded in the notify node's capture.mjs header): grayscale antialiasing plus
 * deviceScaleFactor 4, and settle() before every shot so no capture records a CSS transition.
 *
 * Usage (replayable, cwd = anywhere; needs the dev stack's Postgres reachable in its container):
 *   node examples/todo-app-backend/.starciwork/features/plan/impl/todo-app-frontend/usage/assets/capture.mjs \
 *     [webUrl] [apiGraphqlUrl]
 * Environment:
 *   CAPTURE_PG_CONTAINER  the Postgres container name (default compose-postgres-1)
 *   CAPTURE_PG_DB / CAPTURE_PG_USER  database and role (default todo / postgres)
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendPkg = path.resolve(here, '../../../../../../../../todo-app-frontend/package.json');
const require = createRequire(frontendPkg);
const { chromium } = require('playwright');

const WEB = process.argv[2] ?? 'http://localhost:3000';
const API = process.argv[3] ?? 'http://localhost:3001/graphql';
const PG_CONTAINER = process.env.CAPTURE_PG_CONTAINER ?? 'compose-postgres-1';
const PG_DB = process.env.CAPTURE_PG_DB ?? 'todo';
const PG_USER = process.env.CAPTURE_PG_USER ?? 'postgres';
const LAUNCH_ARGS = ['--disable-lcd-text', '--disable-font-subpixel-positioning'];
const DEVICE_SCALE_FACTOR = Number(process.env.CAPTURE_DSF ?? 4);
const OUT_DIR = process.env.CAPTURE_DIR ?? here;

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };
/** Every row this script inserts carries this id prefix, so cleanup cannot touch anything else. */
const SEED_PREFIX = 'v79-plan-seed-';

const gql = async (query, variables, token) => {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  });
  return res.json();
};

const psql = sql => execFileSync('docker', ['exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', PG_DB, '-t', '-A', '-c', sql],
  { encoding: 'utf8' }).trim();

const signIn = async () => {
  const body = await gql('mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken } }', {
    input: { email: 'demo@todo.dev', password: 'todo-demo-pass' },
  });
  const token = body?.data?.signIn?.sessionToken;
  if (typeof token !== 'string') throw new Error(`signIn refused: ${JSON.stringify(body)}`);
  return token;
};

/** Leaves exactly `count` open seeded tasks owned by this person, nothing else. */
const seedActive = personId => count => {
  psql(`delete from tasks where id like '${SEED_PREFIX}%' and owner = '${personId}'`);
  if (count > 0) {
    psql(`insert into tasks (id, owner, title, complete)
          select '${SEED_PREFIX}' || generate_series(1, ${count}), '${personId}',
                 'Seeded task ' || generate_series(1, ${count}), false`);
  }
};

/**
 * The person may already own tasks this script did not create, so a target active count is reached
 * by topping up from the real read rather than by assuming the seed is the whole list, and the
 * percent the page must paint is taken from that same read - never hardcoded.
 */
const readUsage = async token => {
  const body = await gql('query { planUsage { plan cap activeCount } }', null, token);
  const usage = body?.data?.planUsage;
  if (!usage) throw new Error(`planUsage read refused: ${JSON.stringify(body)}`);
  return usage;
};

const seededActive = personId => Number(psql(
  `select count(*) from tasks where id like '${SEED_PREFIX}%' and owner = '${personId}' and complete = false`));

const stageActive = async (token, personId, target) => {
  const usage = await readUsage(token);
  seedActive(personId)(Math.max(0, target - (usage.activeCount - seededActive(personId))));
  const staged = await readUsage(token);
  if (staged.activeCount !== target) throw new Error(`staged ${staged.activeCount} active tasks, wanted ${target}`);
  return { usage: staged, label: `${Math.round((staged.activeCount / staged.cap) * 100)}% of cap` };
};

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

const shot = async (page, name, { viewport = DESKTOP, fullPage = true } = {}) => {
  mkdirSync(OUT_DIR, { recursive: true });
  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach(el => el.remove());
    window.scrollTo(0, 0);
  });
  await settle(page);
  await page.screenshot({ path: path.join(OUT_DIR, `running-page-${name}.png`), fullPage });
  writeFileSync(path.join(OUT_DIR, `running-page-${name}.html`), await page.content());
  console.log(`captured running-page-${name}.png (${viewport.width}x${viewport.height} dsf${DEVICE_SCALE_FACTOR})`);
};

const open = async (browser, token) => {
  const context = await browser.newContext({
    viewport: DESKTOP,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
  });
  if (token) await context.addInitScript(value => window.localStorage.setItem('todo-app.session-token', value), token);
  return { context, page: await context.newPage() };
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const token = await signIn();
const personId = psql(`select person_id from sessions where token = '${token}'`);
if (!personId) throw new Error('could not resolve the demo person id from the session row');
console.log('person', personId);

/**
 * The person's subscription row is snapshotted before the paid-unlimited staging touches it and
 * restored verbatim afterwards. (An earlier revision upserted plan='paid' on conflict(person_id)
 * and only deleted the staging id on cleanup, which silently left the demo person paid when a
 * pre-existing row carried a different id - planUsage then read cap null and the free-plan
 * states could not be staged.)
 */
const originalSubscription = psql(
  `select coalesce(plan || '|' || status, '') from subscriptions where person_id = '${personId}'`);

const cleanup = async () => {
  seedActive(personId)(0);
  if (originalSubscription) {
    const [plan, status] = originalSubscription.split('|');
    psql(`update subscriptions set plan = '${plan}', status = '${status}' where person_id = '${personId}'`);
  } else {
    psql(`delete from subscriptions where id = 'v79-plan-subscription'`);
  }
};

try {
  // over-cap-frozen, the state the node's desktop and mobile captures stand for.
  const over = await stageActive(token, personId, 40);
  let { context, page } = await open(browser, token);
  await page.goto(`${WEB}/plan/usage`, { waitUntil: 'networkidle' });
  await page.getByText(over.label).waitFor();
  await shot(page, 'desktop', { viewport: DESKTOP, fullPage: true });
  await context.close();

  ({ context, page } = await open(browser, token));
  await page.setViewportSize(MOBILE);
  await page.goto(`${WEB}/plan/usage`, { waitUntil: 'networkidle' });
  await page.getByText(over.label).waitFor();
  await shot(page, 'mobile', { viewport: MOBILE, fullPage: false });
  await context.close();

  // at-cap: exactly the cap.
  const at = await stageActive(token, personId, 20);
  ({ context, page } = await open(browser, token));
  await page.goto(`${WEB}/plan/usage`, { waitUntil: 'networkidle' });
  await page.getByText(at.label).waitFor();
  await shot(page, 'at-cap');
  await context.close();

  // under-cap: well below it.
  const under = await stageActive(token, personId, 8);
  ({ context, page } = await open(browser, token));
  await page.goto(`${WEB}/plan/usage`, { waitUntil: 'networkidle' });
  await page.getByText(under.label).waitFor();
  await shot(page, 'under-cap');
  await context.close();

  // paid-unlimited: stage paid on the person's own subscription row; cleanup() restores the
  // snapshotted plan/status (or deletes the staging row when none existed before).
  if (originalSubscription) {
    psql(`update subscriptions set plan = 'paid', status = 'active' where person_id = '${personId}'`);
  } else {
    psql(`insert into subscriptions (id, person_id, plan, status)
          values ('v79-plan-subscription', '${personId}', 'paid', 'active')`);
  }
  ({ context, page } = await open(browser, token));
  await page.goto(`${WEB}/plan/usage`, { waitUntil: 'networkidle' });
  await page.getByText('Paid plan').waitFor();
  await shot(page, 'paid-unlimited');
  await context.close();
  if (originalSubscription) {
    const [plan, status] = originalSubscription.split('|');
    psql(`update subscriptions set plan = '${plan}', status = '${status}' where person_id = '${personId}'`);
  } else {
    psql(`delete from subscriptions where id = 'v79-plan-subscription'`);
  }

  // refused: no session token at all, so the page paints its own read refusal.
  ({ context, page } = await open(browser, null));
  await page.goto(`${WEB}/plan/usage`, { waitUntil: 'networkidle' });
  await page.getByText('Your session has ended.').waitFor();
  await shot(page, 'refused');
  await context.close();

  // loading: the real read is held in flight so the skeleton is what stays painted.
  ({ context, page } = await open(browser, token));
  await page.route('**/graphql', route => {
    if (/planUsage/.test(route.request().postData() ?? '')) setTimeout(() => route.continue(), 30_000);
    else route.continue();
  });
  await page.goto(`${WEB}/plan/usage`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Plan and usage').waitFor();
  await page.waitForTimeout(1500);
  await shot(page, 'loading');
  await context.close();
} finally {
  await browser.close();
  await cleanup();
}
console.log('capture: 7 running-page captures for ui.plan.usage');
