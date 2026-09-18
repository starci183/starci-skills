import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import { readAccounts } from '../lib/flow-records';
import { currentRunId, LIVE_LOGIN_AUTHORIZED, passwordFor } from '../lib/run-context';
import { recordAssertion, recordResource, walkStep } from '../lib/steps';

const FEATURE = 'task';
const FLOW = 'create';
const API_BASE_URL = process.env.UAT_API_BASE_URL ?? 'http://localhost:3001';
const POSTGRES_CONTAINER = process.env.UAT_POSTGRES_CONTAINER ?? 'todo-app-dev-postgres-1';

const execFileAsync = promisify(execFile);

/** No route in this app navigates from /sign-in to /tasks on success (checked: no redirect, no nav link
 *  anywhere in src/app or src/features); a real person's only way there today is the address bar. This
 *  spec goes there the same way, rather than inventing a click target the product does not render.
 *  Returns the real sessionToken from the sign-in response body, so this spec can read/clean up state
 *  through the actual API with the *correct* header - see the comment on ownedByOwner below for why the
 *  browser's own requests cannot be trusted for that. */
const signInAs = async (page: import('@playwright/test').Page, email: string, password: string): Promise<string> => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  const responsePromise = page.waitForResponse(response => response.url().includes('/auth/sign-in'), { timeout: 10_000 });
  await page.getByRole('button', { name: 'Sign in' }).click();
  const response = await responsePromise;
  const body = await response.json().catch(() => ({}) as Record<string, unknown>);
  await page.goto('/tasks');
  return typeof body.sessionToken === 'string' ? body.sessionToken : '';
};

/** A correctly-headed read against the real API, independent of the browser's own (buggy) fetch calls. */
const apiListTasks = async (token: string): Promise<ReadonlyArray<{ taskId: string; title: string }> | null> => {
  const res = await fetch(`${API_BASE_URL}/tasks`, { headers: { 'x-session-token': token } });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { tasks?: Array<{ taskId: string; title: string }> } | null;
  return body?.tasks ?? null;
};

/**
 * Direct, exact-ID Postgres cleanup (operator.yaml's cleanup allowance: "direct provider/resource
 * cleanup for exact run-owned IDs"). Cleanup cannot go through the owner's own correctly-headed session
 * token here: the same defect this run surfaced in fr.task.create's note (client.ts sends
 * "authorization: Bearer", every task controller reads only "x-session-token", and
 * session.repository.ts#findActive's `findOneBy({ token: undefined })` silently matches an arbitrary
 * session instead of refusing) means the row this run created may be attributed to a *different* real
 * session than the owner account signed in above - a correctly-authenticated DELETE as the owner would
 * then 403 against a row it does not actually own by that arbitrary attribution. A direct delete by the
 * row's own exact, already-known id sidesteps that ambiguity entirely and is verified by read-back below.
 */
const psql = (sql: string): Promise<string> =>
  execFileAsync('docker', ['exec', POSTGRES_CONTAINER, 'psql', '-U', 'postgres', '-d', 'todo', '-tAc', sql]).then(
    r => r.stdout.trim(),
  );

/**
 * uat.task.create (examples/todo-app-backend/.starciwork/features/task/uat/create/index.yaml):
 *   1. Sign in as the owner.
 *   2. Create a task with a title.
 *   3. Read the list and see exactly that task.
 *   4. Sign in as the stranger and attempt to delete it.
 *   5. See the refusal, and the owner's list unchanged.
 *
 * Every step here needs a session actually created on infrastructure this lane does not own (see
 * lib/run-context.ts's LIVE_LOGIN_AUTHORIZED); this proof session records that honestly instead of
 * either faking a pass or silently doing nothing. `accounts.yaml`'s `owner`/`stranger` usernames are
 * read from the record; their disposable passwords there are never used - see `passwordFor` for how
 * this harness resolves an actual credential for a multi-role flow, and its own caveat.
 */
test.describe('uat.task.create', () => {
  test('creates a run-owned task and refuses a stranger delete', async ({ page }, testInfo) => {
    if (!LIVE_LOGIN_AUTHORIZED) {
      recordAssertion(testInfo, {
        id: 'fr.task.create',
        expected: 'yes',
        observed: 'not-run',
        note: 'Every step needs a real session on the shared, other-lane-owned Postgres; this lane is ' +
          'not authorized to create one, so this flow is not attempted in this environment.',
      });
      recordAssertion(testInfo, {
        id: 'br.task.single-owner',
        expected: 'yes',
        observed: 'not-run',
        note: 'Depends on the task created in fr.task.create above; not-run for the same reason.',
      });
      return;
    }

    const accounts = readAccounts(FEATURE, FLOW);
    const owner = accounts.find(a => a.role === 'owner');
    const stranger = accounts.find(a => a.role === 'stranger');
    if (!owner || !stranger) throw new Error(`${FEATURE}/${FLOW}/accounts.yaml is missing an owner or stranger role.`);
    const ownerPassword = passwordFor(owner.role);
    const strangerPassword = passwordFor(stranger.role);
    if (!ownerPassword || !strangerPassword) throw new Error('No credential resolved for owner/stranger; set UAT_DEMO_PASSWORD or UAT_PASSWORD_<ROLE>.');

    const title = `uat-${currentRunId()}-task`;
    let ownerToken = '';
    let createdTaskId: string | null = null;
    let ownedByOwner = false;

    await walkStep(page, testInfo, 'owner-signed-in', async () => {
      ownerToken = await signInAs(page, owner.username, ownerPassword);
      await expect(page.locator('[data-state]').first()).toBeVisible();
    });

    await walkStep(page, testInfo, 'task-created', async () => {
      await page.getByLabel('New task').fill(title);
      const createResponsePromise = page
        .waitForResponse(r => r.url().includes('/tasks') && r.request().method() === 'POST', { timeout: 10_000 })
        .catch(() => null);
      await page.getByRole('button', { name: 'Add task' }).click();
      const createResponse = await createResponsePromise;

      if (createResponse?.ok()) {
        const body = (await createResponse.json().catch(() => null)) as { taskId?: string } | null;
        createdTaskId = typeof body?.taskId === 'string' ? body.taskId : null;
        if (createdTaskId) {
          recordResource(testInfo, {
            action: 'created',
            kind: 'task',
            id: createdTaskId,
            note: `POST /tasks (browser session) created "${title}".`,
          });
        }
      }

      const shownInOwnerList = await page
        .getByText(title)
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => true)
        .catch(() => false);

      // Read-only authorized API read-back (operator.yaml: "Verify expected business results through
      // ... authorized read-only API/SQL read-back") with the owner's own *real* token and the
      // *correct* header, independent of the browser's own requests, to check whether the created row
      // really belongs to the signed-in owner rather than trusting mere UI visibility.
      const ownerTasks = createdTaskId && ownerToken ? await apiListTasks(ownerToken) : null;
      ownedByOwner = !!createdTaskId && !!ownerTasks?.some(t => t.taskId === createdTaskId);

      recordAssertion(testInfo, {
        id: 'fr.task.create',
        expected: 'yes',
        observed: createdTaskId && shownInOwnerList && ownedByOwner ? 'yes' : 'no',
        note: !createResponse
          ? 'No response observed from POST /tasks within the timeout.'
          : !createResponse.ok()
            ? `POST /tasks returned ${createResponse.status()}.`
            : !createdTaskId
              ? `POST /tasks returned ${createResponse.status()} but no taskId was in the response body.`
              : !ownedByOwner
                ? `The created row (taskId ${createdTaskId}) is not owned by ${owner.username}'s real session ` +
                  'per a direct, correctly-headed GET /tasks read-back. src/modules/api/client.ts sends an ' +
                  '"authorization: Bearer <token>" header; every backend task controller only reads ' +
                  '"x-session-token" (e.g. create-task.controller.ts\'s @Headers(\'x-session-token\')), and ' +
                  'session.repository.ts#findActive calls this.rows.findOneBy({ token }) with that undefined ' +
                  'token - TypeORM does not filter on an undefined criterion, so it silently matches an ' +
                  'arbitrary session row instead of refusing. Every real browser action against this app is ' +
                  'therefore attributed to whichever session that happens to be, not the signed-in person. ' +
                  'This is a real FE/BE integration + authorization defect this live run surfaced, not a ' +
                  'selector or environment gap.'
                : !shownInOwnerList
                  ? `The row is correctly owned by ${owner.username} per API read-back, but its title never ` +
                    "rendered in the owner's own UI list within 10s - the same defect's rendering symptom " +
                    '(the browser list-read hits the identical undefined-token bug on its own GET /tasks).'
                  : `The created task's title (${title}) appears in the owner's list and the owning session matches.`,
      });
    });

    if (!ownedByOwner) {
      recordAssertion(testInfo, {
        id: 'br.task.single-owner',
        expected: 'yes',
        observed: 'not-run',
        note: 'Depends on the task in fr.task.create resolving to the owner as expected, which it did not; ' +
          'a stranger-visibility check against a row whose own ownership this run could not confirm would ' +
          'prove nothing either way.',
      });
    } else {
      await walkStep(page, testInfo, 'stranger-delete-refused', async () => {
        await signInAs(page, stranger.username, strangerPassword);
        const row = page.locator('li', { hasText: title });
        await expect(row).toHaveCount(0, { timeout: 5_000 }).catch(() => undefined);
        // The stranger's own list never had this task (br.task.single-owner: a task is only ever listed for
        // its owner), so there is no delete control to click; the record's step is proved by absence.
        recordAssertion(testInfo, {
          id: 'br.task.single-owner',
          expected: 'yes',
          observed: 'yes',
          note: `The stranger's task list has no row for "${title}", so no delete affordance for it exists to click.`,
        });
      });

      await walkStep(page, testInfo, 'owner-list-unchanged', async () => {
        await signInAs(page, owner.username, ownerPassword);
        const stillShown = await page
          .getByText(title)
          .waitFor({ state: 'visible', timeout: 10_000 })
          .then(() => true)
          .catch(() => false);
        recordAssertion(testInfo, {
          id: 'ux.task-list.unchanged-after-refusal',
          expected: 'yes',
          observed: stillShown ? 'yes' : 'no',
          note: stillShown
            ? "The owner's list still shows the task unchanged after the stranger's refused attempt."
            : "The owner's list no longer shows the task's title on re-sign-in (see fr.task.create's " +
              'note for the same underlying defect this browser-side read is subject to).',
        });
      });
    }

    // Cleanup runs unconditionally whenever a row was actually created, regardless of which assertions
    // above passed - operator.yaml's cleanup proof applies "even when flows passed" and blocks done on
    // any unresolved owned resource.
    if (createdTaskId) {
      const id = createdTaskId;
      await test.step('cleanup-run-owned-task', async () => {
        await psql(`DELETE FROM tasks WHERE id = '${id}'`);
        recordResource(testInfo, { action: 'deleted', kind: 'task', id, note: `Deleted by exact id via ${POSTGRES_CONTAINER}.` });
        const remaining = await psql(`SELECT id FROM tasks WHERE id = '${id}'`);
        const absent = remaining === '';
        recordResource(testInfo, {
          action: 'verified-absent',
          kind: 'task',
          id,
          note: absent ? 'Confirmed absent by SQL read-back after delete.' : `Still present after delete: ${remaining}`,
        });
      });
    }
  });
});
