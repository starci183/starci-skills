import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { readAccounts, readFlowRecord } from '../lib/flow-records';
import { currentRunId, LIVE_LOGIN_AUTHORIZED, passwordFor } from '../lib/run-context';
import { recordAssertion, recordResource, walkStep } from '../lib/steps';

const FEATURE = 'plan';
const FLOW = 'upgrade-after-cap';
const record = readFlowRecord(FEATURE, FLOW);

const API_BASE_URL = process.env.UAT_API_BASE_URL ?? 'http://localhost:3001';

/**
 * The record's own cleanup line - "delete the 21 run-owned task rows by recorded id" - and the
 * nothing-written read-backs are honored through the shared stack's own psql for the two tables the
 * GraphQL surface never exposes (payment_intents, subscriptions). The container/database belong to
 * whoever booted the shared stack, not to this harness, so both come from the environment, same as
 * uat.share.invite-and-collaborate's invitation cleanup.
 */
const PG_CONTAINER = process.env.UAT_PG_CONTAINER ?? 'compose-postgres-1';
const PG_DATABASE = process.env.UAT_PG_DATABASE ?? 'todo';

type GraphqlBody = {
  data?: Record<string, any> | null;
  errors?: ReadonlyArray<{ message?: string; extensions?: { code?: string } }>;
};

/** One correctly-headed GraphQL call - the same header contract the browser's own fetcher
 * (src/modules/api/graphql.ts) uses. Used for the record's declared effect ("seed 20 active task
 * rows for the owner" - twenty UI creates would be the same writes slower and flakier) and for
 * read-back ground truth; every recorded UX/business observation is still read from the browser. */
const api = async (token: string, query: string, variables?: Record<string, unknown>): Promise<GraphqlBody | null> => {
  const res = await fetch(`${API_BASE_URL}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json().catch(() => null)) as GraphqlBody | null;
};

const CREATE_TASK = 'mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { taskId title } }';
const DELETE_TASK = 'mutation DeleteTask($id: ID!) { deleteTask(id: $id) { deleted } }';
const LIST_TASKS = 'query { tasks { taskId title complete } }';
const PLAN_USAGE = 'query { planUsage { plan cap activeCount } }';

/** One read-only psql query against the shared stack's own database; null when docker/psql is
 * unavailable, which callers report honestly instead of guessing. */
const psql = (sql: string): string | null => {
  try {
    return execFileSync('docker', ['exec', PG_CONTAINER, 'psql', '-U', 'postgres', '-d', PG_DATABASE, '-tAc', sql], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

const signInAs = async (page: import('@playwright/test').Page, email: string, password: string) => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForResponse(response => response.url().includes('/graphql'), { timeout: 10_000 });
  await page.waitForURL('**/tasks', { timeout: 10_000 });
};

/**
 * uat.plan.upgrade-after-cap (examples/todo-app-backend/.starciwork/features/plan/uat/
 * upgrade-after-cap/index.yaml):
 *   1. Sign in as an owner already at 20 active tasks; the usage screen shows the at-cap state.
 *   2. Attempt to create a 21st task; the create is refused, naming the cap and the upgrade path.
 *   3. Start checkout for the paid plan and complete it at the gateway sandbox.
 *   4. Return to the app once the gateway acknowledges; the usage screen shows no cap.
 *   5. Create the 21st task and see it appear.
 *
 * What the running product actually serves today (verified in this lane before writing a line):
 *   - The cap half is real: PlanCapGuardPolicy refuses the 21st create with PLAN_CAP_EXCEEDED -
 *     "The free plan holds at most 20 active tasks. Upgrade at /plan/usage to create more." -
 *     before anything is written, and ui.plan.usage renders the at-cap state naming the cap with
 *     an "Upgrade plan" action. Probed live: 20 creates land, activeCount reads 20, the 21st is
 *     refused as quoted.
 *   - The task screen itself renders NO error feedback for that refused create:
 *     TaskListBlock.onCreate drops the mutation rejection (createTask.error is never read), so the
 *     submitted title stays in the input and no alert appears. The cap-and-upgrade naming a person
 *     can read lives on /plan/usage instead. Recorded observed 'no', not faked.
 *   - The gateway leg cannot complete and is not driven: the owner directive forbids simulating
 *     the signed webhook, and the app's own upgradePlan call makes the real SePay request, which
 *     answers "SePay create-intent failed: ... (HTTP 404; no credential is configured)" -
 *     gap.plan.sepay-not-reachable's two measured absences. What the app serves instead is its own
 *     checkout-refusal surface ("Checkout could not be started. Try again from this page."), which
 *     this walk does exercise. UpgradePlanHandler orders the SePay call before any write, so the
 *     refusal leaves no pending subscription or payment intent row - verified by psql read-back.
 *
 * Assertions settle at fail by construction when the create-refusal surface is absent and the
 * gateway leg is not-run; the record stays inprogress, never done, per the amendment.
 */
test.describe(record.id, () => {
  test.setTimeout(120_000); // ~40 real createTask/deleteTask calls make the 30s default too tight.

  test('walks the cap refusal and the upgrade-path surface; the gateway leg stays unproven', async ({ page }, testInfo) => {
    if (!LIVE_LOGIN_AUTHORIZED) {
      for (const id of [
        'fr.plan.usage.view',
        'ac.plan.caps.limit.refuses-over-cap',
        'ux.plan.create-refusal-feedback',
        'ux.plan.checkout-refusal-surface',
        'fr.plan.upgrade',
        'integration.plan.sepay',
      ]) {
        recordAssertion(testInfo, {
          id,
          expected: 'yes',
          observed: 'not-run',
          note: 'Seeding 20 task rows and signing in are real writes on infrastructure this lane does ' +
            'not own; UAT_LIVE_LOGIN_AUTHORIZED is not true, so nothing was attempted.',
        });
      }
      return;
    }

    const owner = readAccounts(FEATURE, FLOW).find(a => a.role === 'owner-at-cap');
    if (!owner) throw new Error(`${FEATURE}/${FLOW}/accounts.yaml is missing an owner-at-cap role.`);
    const ownerPassword = passwordFor(owner.role);
    if (!ownerPassword) throw new Error('No credential resolved for owner-at-cap; set UAT_DEMO_PASSWORD or UAT_PASSWORD_OWNER_AT_CAP.');

    const runId = currentRunId();
    const seedTitle = (n: number) => `uat-${runId}-cap-${String(n).padStart(2, '0')}`;
    const overTitle = `uat-${runId}-cap-over`;
    let ownerToken = '';
    let cap = 20;
    const createdIds: string[] = [];
    const deletedIds = new Set<string>();
    const verifiedIds = new Set<string>();

    /* Idempotent by recorded id: every run-owned row the walk managed to create is removed here,
     * whether the cleanup step was reached or an earlier step aborted. An owner left seeded at the
     * cap would poison every other lane's task creates on this shared account, so the guard runs
     * even on failure paths. */
    const deleteRunTasks = async () => {
      if (!ownerToken) return;
      for (const id of createdIds) {
        if (deletedIds.has(id)) continue;
        const res = await api(ownerToken, DELETE_TASK, { id });
        if (res?.data?.deleteTask?.deleted === true) {
          deletedIds.add(id);
          recordResource(testInfo, {
            action: 'deleted',
            kind: 'task',
            id,
            note: 'Run-owned seed row deleted by its recorded id through the app\'s own deleteTask mutation.',
          });
        }
      }
      const list = await api(ownerToken, LIST_TASKS);
      const present = new Set((list?.data?.tasks ?? []).map((t: { taskId: string }) => t.taskId));
      for (const id of createdIds) {
        if (deletedIds.has(id) && !verifiedIds.has(id) && !present.has(id)) {
          verifiedIds.add(id);
          recordResource(testInfo, {
            action: 'verified-absent',
            kind: 'task',
            id,
            note: 'A correctly-headed tasks read-back lists no run-owned row after the delete.',
          });
        }
      }
    };

    try {
      let personId = '';
      await walkStep(page, testInfo, 'owner-signed-in', async () => {
        await signInAs(page, owner.username, ownerPassword);
        await expect(page.locator('[data-state]').first()).toBeVisible();
        ownerToken = (await page.evaluate(() => window.localStorage.getItem('todo-app.session-token'))) ?? '';
        if (!ownerToken) throw new Error('The signed-in session wrote no session token to localStorage.');
        personId = psql(`SELECT person_id FROM sessions WHERE token = '${ownerToken}'`) ?? '';
      });

      await walkStep(page, testInfo, 'owner-seeded-to-cap', async () => {
        const usage = await api(ownerToken, PLAN_USAGE);
        cap = usage?.data?.planUsage?.cap ?? 20;
        let active = usage?.data?.planUsage?.activeCount ?? 0;
        for (let n = 1; active < cap && n <= cap + 5; n++) {
          const res = await api(ownerToken, CREATE_TASK, { input: { title: seedTitle(n) } });
          const id = res?.data?.createTask?.taskId;
          // A refusal before `cap` means a concurrent lane filled it; the re-read below is the truth.
          if (!id) break;
          createdIds.push(id);
          active++;
          recordResource(testInfo, {
            action: 'created',
            kind: 'task',
            id,
            note: `Run-owned seed row "${seedTitle(n)}" created through the app's own createTask ` +
              'mutation - the record\'s declared "seed 20 active task rows for the owner" effect, ' +
              'written through the real door, not SQL.',
          });
        }
        const settled = await api(ownerToken, PLAN_USAGE);
        const settledActive = settled?.data?.planUsage?.activeCount;
        if (settled?.data?.planUsage?.cap == null || settledActive !== cap) {
          recordAssertion(testInfo, {
            id: 'fr.plan.usage.view',
            expected: 'yes',
            observed: 'no',
            note: `The owner could not be brought to the cap: planUsage reads ` +
              `${JSON.stringify(settled?.data?.planUsage)} after ${createdIds.length} run-owned ` +
              'creates. The at-cap half of this flow is unprovable in this state.',
          });
        }
      });

      await walkStep(page, testInfo, 'usage-shows-at-cap', async () => {
        await page.goto('/plan/usage');
        const body = page.locator('div[data-state]').first();
        await expect(body).not.toHaveAttribute('data-state', 'loading', { timeout: 10_000 });
        const state = (await body.getAttribute('data-state')) ?? '';
        const capNamed = (await page
          .getByText(new RegExp(`used all ${cap} active tasks|limit of ${cap}`))
          .count()) > 0;
        const upgradeVisible = await page.getByRole('button', { name: 'Upgrade plan' }).isVisible().catch(() => false);
        const capState = state === 'at-cap' || state === 'over-cap-frozen';
        if (capState) {
          recordAssertion(testInfo, {
            id: 'fr.plan.usage.view',
            expected: 'yes',
            observed: capNamed && upgradeVisible ? 'yes' : 'no',
            note: `planUsage rendered data-state="${state}" with the cap (${cap}) ` +
              `${capNamed ? 'named in the cap sentence' : 'absent from every visible text'} and the ` +
              `"Upgrade plan" action ${upgradeVisible ? 'present' : 'absent'}. ` +
              (state === 'over-cap-frozen'
                ? 'over-cap-frozen is the same cap-pressure surface once a concurrent run pushed past the cap.'
                : 'This is the record\'s step-1 expectation: the usage screen shows the at-cap state.'),
          });
        }
      });

      await walkStep(page, testInfo, 'twenty-first-create-refused', async () => {
        await page.goto('/tasks');
        await page.getByLabel('New task').fill(overTitle);
        const responsePromise = page
          .waitForResponse(
            r => r.url().includes('/graphql') && (r.request().postData() ?? '').includes('createTask'),
            { timeout: 15_000 },
          )
          .catch(() => null);
        await page.getByRole('button', { name: 'Add task' }).click();
        const response = await responsePromise;
        const body = response ? ((await response.json().catch(() => null)) as GraphqlBody | null) : null;
        // If the cap was open when the click landed (a concurrent lane freed a slot), the row is
        // still run-owned: record it for cleanup and let the assertions below tell the truth.
        const created = body?.data?.createTask?.taskId;
        if (typeof created === 'string' && created) createdIds.push(created);
        const refusal = body?.errors?.[0];
        const namesCapAndPath =
          typeof refusal?.message === 'string' &&
          refusal.message.includes(`${cap}`) &&
          refusal.message.includes('/plan/usage');
        const refusedOnWire = refusal?.extensions?.code === 'PLAN_CAP_EXCEEDED' && namesCapAndPath;
        await expect(page.locator('li', { hasText: overTitle })).toHaveCount(0, { timeout: 5_000 }).catch(() => undefined);
        const list = await api(ownerToken, LIST_TASKS);
        const written = (list?.data?.tasks ?? []).some((t: { title: string }) => t.title === overTitle);
        recordAssertion(testInfo, {
          id: 'ac.plan.caps.limit.refuses-over-cap',
          expected: 'yes',
          observed: refusedOnWire && !written ? 'yes' : 'no',
          note: refusedOnWire && !written
            ? `The ${cap + 1}th create was refused before anything was written: PLAN_CAP_EXCEEDED - ` +
              `"${refusal?.message}" - naming the cap of ${cap} and the upgrade path /plan/usage. ` +
              'The title never appears in the list and a correctly-headed tasks read-back returns no such row.'
            : `Expected a PLAN_CAP_EXCEEDED refusal naming cap ${cap} and /plan/usage; the createTask ` +
              `response was ${JSON.stringify(body)}${written ? ' and the row WAS written' : ''}` +
              `${created ? ` (created id ${created}, tracked run-owned for cleanup)` : ''}.`,
        });
        const refusalRendered =
          (await page.getByText(/at most \d+ active tasks|Upgrade at \/plan\/usage/).count()) > 0;
        recordAssertion(testInfo, {
          id: 'ux.plan.create-refusal-feedback',
          expected: 'yes',
          observed: refusalRendered ? 'yes' : 'no',
          note: refusalRendered
            ? 'The refused create renders the refusal wording on the task screen itself.'
            : 'The task screen renders no error feedback for the refused create: ' +
              'TaskListBlock.onCreate drops the mutation rejection (src/components/blocks/task-list/' +
              'index.tsx never reads createTask.error), the submitted title stays in the input and no ' +
              'alert or banner appears - matching ui.task.list\'s own state vocabulary (empty, ' +
              'one-task, many-tasks, refused-for-read), which names no create-refusal state. The ' +
              'cap-and-upgrade naming a person can actually read is on /plan/usage, which the ' +
              'previous step walked.',
        });
      });

      await walkStep(page, testInfo, 'upgrade-action-refused-at-gateway', async () => {
        const intentsBefore = psql('SELECT count(*) FROM payment_intents');
        const subscriptionBefore = personId
          ? psql(`SELECT status FROM subscriptions WHERE person_id = '${personId}'`)
          : null;
        await page.goto('/plan/usage');
        const body = page.locator('div[data-state]').first();
        await expect(body).not.toHaveAttribute('data-state', 'loading', { timeout: 10_000 });
        const responsePromise = page
          .waitForResponse(
            r => r.url().includes('/graphql') && (r.request().postData() ?? '').includes('upgradePlan'),
            { timeout: 20_000 },
          )
          .catch(() => null);
        await page.getByRole('button', { name: 'Upgrade plan' }).click();
        const response = await responsePromise;
        const upgradeBody = response ? ((await response.json().catch(() => null)) as GraphqlBody | null) : null;
        const checkoutUrl = upgradeBody?.data?.upgradePlan?.checkoutUrl;
        const gatewayAnswer =
          upgradeBody?.errors?.[0]?.message ??
          (checkoutUrl ? `checkout started, url ${checkoutUrl}` : 'no response observed');
        // A real checkoutUrl would mean the gateway leg opened; the walk does not follow it - the
        // owner directive forbids driving the gateway half. Today the call refuses instead.
        const refusalShown = await page
          .getByText('Checkout could not be started. Try again from this page.')
          .waitFor({ state: 'visible', timeout: 10_000 })
          .then(() => true)
          .catch(() => false);
        const intentsAfter = psql('SELECT count(*) FROM payment_intents');
        const subscriptionAfter = personId
          ? psql(`SELECT status FROM subscriptions WHERE person_id = '${personId}'`)
          : null;
        const nothingWritten =
          intentsBefore !== null && intentsAfter !== null && intentsBefore === intentsAfter &&
          subscriptionBefore !== null && subscriptionAfter !== null && subscriptionBefore === subscriptionAfter;
        recordAssertion(testInfo, {
          id: 'ux.plan.checkout-refusal-surface',
          expected: 'yes',
          observed: refusalShown ? 'yes' : 'no',
          note: `The at-cap surface's "Upgrade plan" action was exercised; the app's own upgradePlan ` +
            `call answered ${gatewayAnswer}. The surface ` +
            `${refusalShown ? 'rendered its checkout-refusal sentence' : 'did not render the checkout-refusal sentence'}` +
            `; psql read-back: payment_intents ${intentsBefore} -> ${intentsAfter}, subscription ` +
            `status ${subscriptionBefore} -> ${subscriptionAfter} ` +
            `(${nothingWritten ? 'unchanged - the refused start wrote nothing, matching ' +
              'UpgradePlanHandler\'s gateway-call-first ordering' : 'changed or unreadable'}).`,
        });
        recordAssertion(testInfo, {
          id: 'fr.plan.upgrade',
          expected: 'yes',
          observed: 'not-run',
          note: 'The record\'s checkout leg - complete at the gateway sandbox, webhook confirms, the ' +
            'cap lifts, the 21st task lands - is not walked: the owner directive forbids simulating ' +
            'the signed webhook, and the live leg cannot complete (the app\'s own call above carried ' +
            'the gateway\'s real answer). The upgrade-path surface the app does serve - the at-cap ' +
            'sentence and the exercised Upgrade action\'s refusal - is what this run proves.',
        });
        recordAssertion(testInfo, {
          id: 'integration.plan.sepay',
          expected: 'yes',
          observed: 'not-run',
          note: `The live SePay leg stays unproven (gap.plan.sepay-not-reachable): this run's ` +
            `upgradePlan call returned "${gatewayAnswer}", matching the gap's measured absences - no ` +
            'real credential is configured and the create-intent route is not served by the ' +
            'provider. No webhook was simulated and no fake gateway stood in.',
        });
      });

      await walkStep(page, testInfo, 'run-tasks-deleted-and-verified-absent', async () => {
        await deleteRunTasks();
      });
    } finally {
      // Crash-path twin of the cleanup step: rows a failed step left behind are still run-owned.
      await deleteRunTasks();
    }
  });
});
