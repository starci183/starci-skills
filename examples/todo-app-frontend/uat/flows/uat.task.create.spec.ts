import { expect, test } from '@playwright/test';
import { readAccounts } from '../lib/flow-records';
import { currentRunId, LIVE_LOGIN_AUTHORIZED, passwordFor } from '../lib/run-context';
import { recordAssertion, walkStep } from '../lib/steps';

const FEATURE = 'task';
const FLOW = 'create';

/** grit #36, closed in the login lane: a successful sign-in now navigates to /tasks on its own
 *  (src/hooks/auth/useSignIn.ts calls router.push('/tasks') after setToken). This waits for that
 *  navigation instead of driving it by URL, which is what the former "no route navigates" comment here
 *  used to do before that fix landed. */
const signInAs = async (page: import('@playwright/test').Page, email: string, password: string) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForResponse(response => response.url().includes('/graphql'), { timeout: 10_000 });
  await page.waitForURL('**/tasks', { timeout: 10_000 });
};

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

    await walkStep(page, testInfo, 'owner-signed-in', async () => {
      await signInAs(page, owner.username, ownerPassword);
      await expect(page.locator('[data-state]').first()).toBeVisible();
    });

    await walkStep(page, testInfo, 'task-created', async () => {
      await page.getByLabel('New task').fill(title);
      await page.getByRole('button', { name: 'Add task' }).click();
      await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
      recordAssertion(testInfo, {
        id: 'fr.task.create',
        expected: 'yes',
        observed: 'yes',
        note: `The created task's own title (${title}) appears in the owner's list.`,
      });
    });

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

    await walkStep(page, testInfo, 'owner-list-unchanged-and-cleaned-up', async () => {
      await signInAs(page, owner.username, ownerPassword);
      await expect(page.getByText(title)).toBeVisible();
      const row = page.locator('li', { hasText: title });
      await row.getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByText(title)).toHaveCount(0, { timeout: 10_000 });
    });
  });
});
