// Scratch harness for impl.share.todo-app-frontend.invite-screen rendered evidence.
// Runs the CURRENT worktree's production build on :3010 against the live backend on :3001.
// The only non-real seam: CORS headers are rewritten in the Playwright route so the browser
// page on :3010 may call the backend on :3001 (the backend whitelists :3000 only). Every
// request still executes against the real backend and real database.
import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.SHARE_BASE_URL ?? 'http://localhost:3010';
const GRAPHQL = process.env.SHARE_GRAPHQL_URL ?? 'http://localhost:3001/graphql';
const TASK_SHARED = 'f8b489c4-0544-45f4-8eeb-67e6af5c8c86';
const TASK_EMPTY = '353ccc7c-5e79-40ee-a5dd-754375cb36eb';
const PAT_INVITATION = 'f6b911ce-6b09-4b90-b06f-16b6902a7558';
const OWNER_TOKEN = process.env.SHARE_OWNER_TOKEN;
const INVITEE_TOKEN = process.env.SHARE_INVITEE_TOKEN;
const OUT = path.resolve('../todo-app-backend/.starciwork/features/share/impl/todo-app-frontend/invite-screen/assets');

if (!OWNER_TOKEN || !INVITEE_TOKEN) throw new Error('SHARE_OWNER_TOKEN and SHARE_INVITEE_TOKEN env vars are required');
fs.mkdirSync(OUT, { recursive: true });

let delayInvite = false;
const graphqlRoute = async route => {
  const body = route.request().postData() ?? '';
  if (delayInvite && body.includes('invite(input')) {
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  const response = await route.fetch();
  await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } });
};

const graphql = (token, query, variables) => fetch(GRAPHQL, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ query, variables }),
}).then(r => r.json());

const psql = sql => execSync(
  `docker exec todo-app-dev-postgres-1 psql -U postgres -d todo -t -c "${sql}"`,
  { stdio: ['ignore', 'pipe', 'inherit'] },
).toString().trim();

const run = async () => {
  // LCD (subpixel) text antialiasing paints coloured fringes on every glyph; the canon palette
  // check reads them as off-brand buckets. Greyscale AA keeps the capture's palette honest.
  const browser = await chromium.launch({ args: ['--disable-lcd-text', '--disable-font-subpixel-positioning'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 880 } });
  await context.route('**/graphql', graphqlRoute);
  await context.addInitScript(token => window.localStorage.setItem('todo-app.session-token', token), OWNER_TOKEN);
  const page = await context.newPage();
  page.on('dialog', dialog => void dialog.accept());
  const consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(`console: ${message.text()}`); });

  const shareUrl = task => `${BASE}/tasks/${task}/share`;
  const snap = async (name, fullPage = true) => {
    // Mobile stays viewport-sized: the shell's compactNavigation is position:sticky bottom, and a
    // fullPage stitch paints it mid-page over real rows - an artifact, not the served layout.
    await page.screenshot({ path: path.join(OUT, `running-page-${name}.png`), fullPage });
    fs.writeFileSync(path.join(OUT, `running-page-${name}.html`), await page.content());
    console.log(`captured ${name}`);
  };
  const collaboratorRow = email => page.locator('li', { hasText: email });
  const inviteViaUi = async email => {
    delayInvite = true;
    await page.getByLabel('Email address').fill(email);
    await page.getByRole('button', { name: 'Send invitation' }).click();
    await page.waitForTimeout(700);
  };
  const settleInvite = async email => {
    await collaboratorRow(email).waitFor({ timeout: 15000 });
    delayInvite = false;
  };
  const revokeViaUi = async email => {
    await collaboratorRow(email).getByRole('button', { name: 'Revoke' }).click();
    await collaboratorRow(email).getByText('Revoked').waitFor({ timeout: 15000 });
  };
  const dropRow = email => psql(`delete from invitations where task_id='${TASK_SHARED}' and email='${email}';`);

  // ---------- desktop-1280: empty, pending-list, inviting ----------
  await page.goto(shareUrl(TASK_EMPTY), { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Share this task' }).waitFor();
  await page.waitForTimeout(1500);
  if (await page.getByRole('heading', { name: 'Collaborators' }).count() !== 0) throw new Error('empty task unexpectedly shows a collaborator list');
  await snap('empty-desktop-1280');

  await page.goto(shareUrl(TASK_SHARED), { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Collaborators' }).waitFor();
  await collaboratorRow('pat@example.com').waitFor();
  await collaboratorRow('sam@example.com').waitFor();
  await snap('pending-list-desktop-1280');

  await inviteViaUi('lee@example.com');
  await snap('inviting-desktop-1280');
  await settleInvite('lee@example.com');
  await revokeViaUi('lee@example.com');
  dropRow('lee@example.com');

  // ---------- mobile-390: empty, pending-list, inviting ----------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(shareUrl(TASK_EMPTY), { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Share this task' }).waitFor();
  await page.waitForTimeout(1500);
  if (await page.getByRole('heading', { name: 'Collaborators' }).count() !== 0) throw new Error('empty task unexpectedly shows a collaborator list (mobile)');
  await snap('empty-mobile-390', false);

  await page.goto(shareUrl(TASK_SHARED), { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Collaborators' }).waitFor();
  await collaboratorRow('pat@example.com').waitFor();
  await snap('pending-list-mobile-390', false);

  await inviteViaUi('kim@example.com');
  await snap('inviting-mobile-390', false);
  await settleInvite('kim@example.com');
  await revokeViaUi('kim@example.com');
  dropRow('kim@example.com');

  // ---------- accept pat through the real mutation ----------
  const accepted = await graphql(INVITEE_TOKEN,
    'mutation A($input: AcceptInvitationInput!) { acceptInvitation(input: $input) { invitationId status } }',
    { input: { invitationId: PAT_INVITATION, email: 'pat@example.com' } });
  if (accepted?.data?.acceptInvitation?.status !== 'accepted') throw new Error(`accept failed: ${JSON.stringify(accepted)}`);
  console.log('pat@example.com accepted via acceptInvitation mutation');

  // ---------- desktop-1280: accepted, refused ----------
  await page.setViewportSize({ width: 1280, height: 880 });
  await page.goto(shareUrl(TASK_SHARED), { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Collaborators' }).waitFor();
  await collaboratorRow('pat@example.com').getByText('Accepted').waitFor();
  await snap('accepted-desktop-1280');

  await page.getByLabel('Email address').fill('not-an-email');
  await page.getByRole('button', { name: 'Send invitation' }).click();
  await page.getByText('Enter a valid email address.').waitFor();
  await snap('refused-desktop-1280');

  // ---------- mobile-390: accepted, refused ----------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(shareUrl(TASK_SHARED), { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Collaborators' }).waitFor();
  await collaboratorRow('pat@example.com').getByText('Accepted').waitFor();
  await snap('accepted-mobile-390', false);

  await page.getByLabel('Email address').fill('not-an-email');
  await page.getByRole('button', { name: 'Send invitation' }).click();
  await page.getByText('Enter a valid email address.').waitFor();
  await snap('refused-mobile-390', false);

  console.log(`console errors: ${consoleErrors.length}`);
  for (const error of consoleErrors.slice(0, 10)) console.log(`  ${error}`);
  await browser.close();
};

run().catch(error => { console.error('CAPTURE FAILED', error); process.exit(1); });
