/**
 * impl.share.todo-app-frontend.invite-screen running-page captures (lane v7-9, 2026-09-19).
 *
 * Replaces the dead scratch harness this node used to point at
 * (examples/todo-app-frontend/capture-share.mjs, whose owner/viewer/invitation UUIDs and
 * /en/tasks/<uuid>/share route have not existed in the frontend since the [lang] shell moved the
 * routes - v6-3 audit finding 4). Every fixture here is created through the real GraphQL API.
 *
 * Drives the served production build of examples/todo-app-frontend (`next build` + `next start`)
 * through ui.share.invite's five declared states at its two declared viewports, writing beside
 * this script one running-page-<state>-<viewport>.png plus the markup kept beside each capture.
 * Each capture is confirmed against the view's own `div[data-state]` marker, never a guess:
 *   empty        a task with no invitation row at all - revoking leaves a `revoked` row behind and
 *                ShareInviteView resolves any row to pending-list, so this state needs a fresh task
 *   inviting     the real `invite` mutation held in flight, so the pending submit is what is painted
 *   pending-list two real invitations (pat@ viewer, sam@ editor) read back through the page
 *   accepted     a third invitation, addressed to demo2@todo.dev and accepted by that person through
 *                the real acceptInvitation mutation, read back beside the two pending ones
 *   refused      the real collaborators read answered with a GraphQL error, the page's own refusal
 *
 * A separate task per clean-slate state is what keeps the run honest: the states are mutually
 * exclusive in the data and the API has no un-revoke. Every task this run creates is deleted again.
 *
 * Capture convention, shared by every re-captured todo frontend node (the measurement behind it is
 * recorded in the notify node's capture.mjs header): grayscale antialiasing plus
 * deviceScaleFactor 4, and settle() before every shot so no capture records a CSS transition.
 *
 * Usage (replayable, cwd = anywhere):
 *   node examples/todo-app-backend/.starciwork/features/share/impl/todo-app-frontend/invite-screen/assets/capture.mjs \
 *     [webUrl] [apiGraphqlUrl]
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
const LAUNCH_ARGS = ['--disable-lcd-text', '--disable-font-subpixel-positioning'];
const DEVICE_SCALE_FACTOR = Number(process.env.CAPTURE_DSF ?? 4);
const OUT_DIR = process.env.CAPTURE_DIR ?? here;
const PG_CONTAINER = process.env.CAPTURE_PG_CONTAINER ?? 'compose-postgres-1';
const PG_DB = process.env.CAPTURE_PG_DB ?? 'todo';
const PG_USER = process.env.CAPTURE_PG_USER ?? 'postgres';

/**
 * revokeCollaborator leaves a `revoked` row and deleteTask does not cascade, so an API-only cleanup
 * cannot fully retract an invitation. The rows this run owns are deleted by their recorded task ids
 * and nothing else, which is what lets the run claim no unresolved owned resources.
 */
const dropRowsFor = taskIds => {
  if (!taskIds.length) return;
  const list = taskIds.map(id => `'${id.replaceAll("'", "''")}'`).join(', ');
  execFileSync('docker', ['exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', PG_DB, '-c',
    `delete from invitations where task_id in (${list})`], { stdio: 'pipe' });
};

const VIEWPORTS = [
  { name: 'desktop-1280', width: 1280, height: 938, fullPage: true },
  { name: 'mobile-390', width: 390, height: 844, fullPage: false },
];

const OWNER = { email: 'demo@todo.dev', password: 'todo-demo-pass' };
const INVITEE = { email: 'demo2@todo.dev', password: 'todo-demo-pass-2' };

const gql = async (query, variables, token) => {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  });
  return res.json();
};

const signIn = async ({ email, password }) => {
  const body = await gql('mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken } }',
    { input: { email, password } });
  const token = body?.data?.signIn?.sessionToken;
  if (typeof token !== 'string') throw new Error(`signIn refused for ${email}: ${JSON.stringify(body)}`);
  return token;
};

const settle = async page => {
  await page.waitForFunction(() => {
    const painted = [...document.querySelectorAll('button')]
      .map(button => `${button.textContent?.trim()}:${getComputedStyle(button).backgroundColor}:${button.dataset.loading}`)
      .join('|');
    if (window.__captureSettleMark !== painted) {
      window.__captureSettleMark = painted;
      return false;
    }
    return true;
  }, null, { timeout: 5000, polling: 100 }).catch(() => undefined);
  await page.waitForTimeout(250);
};

const shot = async (page, name, fullPage) => {
  mkdirSync(OUT_DIR, { recursive: true });
  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach(el => el.remove());
    window.scrollTo(0, 0);
  });
  await settle(page);
  await page.screenshot({ path: path.join(OUT_DIR, `running-page-${name}.png`), fullPage });
  writeFileSync(path.join(OUT_DIR, `running-page-${name}.html`), await page.content());
  console.log(`captured running-page-${name}.png`);
};

const expectState = async (page, state) =>
  page.locator(`[data-state="${state}"]`).first().waitFor({ timeout: 15_000 });

const bodyOf = route => route.request().postData() ?? '';
const isInvite = text => /nvite/.test(text) && /mutation/i.test(text);

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const ownerToken = await signIn(OWNER);
const createdTasks = [];

/** A task of this run's own, so each state starts from the data that state declares. */
const newTask = async title => {
  const body = await gql('mutation Create($input: CreateTaskInput!) { createTask(input: $input) { taskId } }',
    { input: { title } }, ownerToken);
  const taskId = body?.data?.createTask?.taskId;
  if (!taskId) throw new Error(`createTask(${title}) refused: ${JSON.stringify(body)}`);
  createdTasks.push(taskId);
  return taskId;
};

const listInvitations = async taskId => {
  const body = await gql('query Collaborators($taskId: ID!) { collaborators(taskId: $taskId) { invitationId email status } }',
    { taskId }, ownerToken).catch(() => null);
  return body?.data?.collaborators ?? [];
};

for (const viewport of VIEWPORTS) {
  const open = async (token = ownerToken) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });
    await context.addInitScript(value => window.localStorage.setItem('todo-app.session-token', value), token);
    return { context, page: await context.newPage() };
  };
  const gotoShare = async (page, taskId) => {
    await page.goto(`${WEB}/tasks/${taskId}/share`, { waitUntil: 'networkidle' });
    await page.locator('[data-state]').first().waitFor({ timeout: 15_000 });
  };
  /** Invites through the page's own form and waits for its own mutation to answer. */
  const inviteThrough = async (page, email, role) => {
    const answered = page.waitForResponse(response =>
      response.url().includes('/graphql') && isInvite(response.request().postData() ?? ''));
    await page.getByLabel('Email address').fill(email);
    await page.getByRole('radio', { name: role, exact: true }).check();
    await page.getByRole('button', { name: 'Send invitation' }).click();
    await answered;
  };

  // empty: a task with no invitation row.
  const emptyTask = await newTask(`Share empty ${viewport.name}`);
  let { context, page } = await open();
  await gotoShare(page, emptyTask);
  await expectState(page, 'empty');
  await shot(page, `empty-${viewport.name}`, viewport.fullPage);
  await context.close();

  // inviting: the real mutation held in flight, so the pending submit stays painted.
  const invitingTask = await newTask(`Share inviting ${viewport.name}`);
  ({ context, page } = await open());
  await page.route('**/graphql', route => {
    if (isInvite(bodyOf(route))) setTimeout(() => route.continue(), 30_000);
    else route.continue();
  });
  await gotoShare(page, invitingTask);
  await page.getByLabel('Email address').fill('kim@example.com');
  await page.getByRole('radio', { name: 'Viewer', exact: true }).check();
  await page.getByRole('button', { name: 'Send invitation' }).click();
  await expectState(page, 'inviting');
  await shot(page, `inviting-${viewport.name}`, viewport.fullPage);
  await context.close();

  // pending-list: two real invitations read back through the owner's page.
  const sharedTask = await newTask(`Share roster ${viewport.name}`);
  ({ context, page } = await open());
  await gotoShare(page, sharedTask);
  await inviteThrough(page, 'pat@example.com', 'Viewer');
  await inviteThrough(page, 'sam@example.com', 'Editor');
  await page.reload({ waitUntil: 'networkidle' });
  await expectState(page, 'pending-list');
  await page.getByText('pat@example.com').waitFor();
  await shot(page, `pending-list-${viewport.name}`, viewport.fullPage);
  await context.close();

  // accepted: a third invitation, accepted by its own invitee through the real mutation.
  ({ context, page } = await open());
  await gotoShare(page, sharedTask);
  await inviteThrough(page, INVITEE.email, 'Editor');
  await context.close();
  const acceptedInvitation = (await listInvitations(sharedTask))
    .find(row => row.email === INVITEE.email && row.status === 'pending');
  if (!acceptedInvitation) throw new Error(`no ${INVITEE.email} invitation to accept on ${sharedTask}`);
  const inviteeToken = await signIn(INVITEE);
  const acceptedBody = await gql('mutation Accept($input: AcceptInvitationInput!) { acceptInvitation(input: $input) { __typename } }',
    { input: { invitationId: acceptedInvitation.invitationId, email: INVITEE.email } }, inviteeToken);
  if (acceptedBody?.errors) throw new Error(`acceptInvitation refused: ${JSON.stringify(acceptedBody.errors)}`);
  ({ context, page } = await open());
  await gotoShare(page, sharedTask);
  await expectState(page, 'accepted');
  await page.getByText(INVITEE.email).waitFor();
  await shot(page, `accepted-${viewport.name}`, viewport.fullPage);
  await context.close();

  // refused: the real collaborators read is answered with a GraphQL error.
  ({ context, page } = await open());
  await page.route('**/graphql', route => {
    if (/collaborators/.test(bodyOf(route))) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ errors: [{ message: 'collaborator read refused', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] }),
      });
    } else route.continue();
  });
  await gotoShare(page, sharedTask);
  await expectState(page, 'refused');
  await shot(page, `refused-${viewport.name}`, viewport.fullPage);
  await context.close();
}

// Leave no fixture behind: the tasks and every invitation row they carry.
for (const taskId of createdTasks) {
  await gql('mutation Delete($id: ID!) { deleteTask(id: $id) { __typename } }', { id: taskId }, ownerToken);
}
dropRowsFor(createdTasks);
await browser.close();
console.log('capture: 10 running-page captures for ui.share.invite');
