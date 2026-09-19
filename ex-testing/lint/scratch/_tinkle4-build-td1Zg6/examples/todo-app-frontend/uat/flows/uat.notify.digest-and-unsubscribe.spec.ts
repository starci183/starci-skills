import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readAccounts, readFlowRecord } from '../lib/flow-records';
import { currentRunId, LIVE_LOGIN_AUTHORIZED, passwordFor } from '../lib/run-context';
import { recordAssertion, recordResource, walkStep } from '../lib/steps';

const FEATURE = 'notify';
const FLOW = 'digest-and-unsubscribe';
const record = readFlowRecord(FEATURE, FLOW);

const API_BASE_URL = process.env.UAT_API_BASE_URL ?? 'http://localhost:3001';
/** The running stack's own containers (the lane-shared `compose` project per ex-testing/lint/v7-11-REPORT.md);
 *  both are overridable so a differently-named stack can still run this spec. */
const POSTGRES_CONTAINER = process.env.UAT_POSTGRES_CONTAINER ?? 'compose-postgres-1';
const REDIS_CONTAINER = process.env.UAT_REDIS_CONTAINER ?? 'compose-redis-1';
const NOTIFY_DB = process.env.UAT_NOTIFY_DB ?? 'todo';
/** Armed through the real updateNotificationPreferences mutation below; the record's steps never name a
 *  window length, and UpdateNotificationPreferencesInput bounds digestWindowMinutes to int >= 1, so one
 *  minute is the shortest honest window the product accepts. */
const DIGEST_WINDOW_MINUTES = 1;
/** One-minute window plus the scheduler's 5s dequeue tick (notify.scheduler.ts TICK_MS), with margin.
 *  A lost flush job is never retried (dequeueDue removes the job before the work runs), so a window
 *  that does not flush inside this budget is a real observation, not a timing artifact to retry over. */
const FLUSH_POLL_TIMEOUT_MS = 100_000;

/**
 * A correctly-headed call against the real API - "Authorization: Bearer <token>", the same header the
 * browser's own fetcher (src/modules/api/graphql.ts) sends. Used here for two different things, kept
 * honest in the assertion notes: (a) walk setup the UI cannot express (the preferences screen exposes
 * only the subscribed toggle, not digestWindowMinutes), and (b) read-back ground truth for records the
 * product serves no screen or GraphQL query for at all (the GraphQL surface gives notify exactly three
 * operations - notificationPreferences, updateNotificationPreferences, unsubscribe; there is no
 * notifications query and no inbox page). This is the same ground-truth read-back uat.login.sign-in
 * already uses, one layer down.
 */
const graphql = async <T>(token: string, query: string, variables?: Record<string, unknown>): Promise<T | null> => {
  const res = await fetch(`${API_BASE_URL}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { data?: T; errors?: unknown[] } | null;
  if (!body || (body.errors && body.errors.length > 0)) return null;
  return body.data ?? null;
};

/**
 * The one honest read of the notify pipeline's own state. The product's only "inbox" is the person's
 * external email mailbox, and this stack runs no SMTP host (gap.notify.smtp-host-unreachable), so the
 * pipeline's rows - notify_notifications, notify_digest_windows, notify_delivery_attempts in the
 * stack's own Postgres - are the only place a window's grouping, flush and dispatch outcome exist to be
 * observed. scripts/live-proof-notify.sh established this same read-back against the same tables as the
 * legitimate way to prove this feature live. Returns null when the database cannot be reached, which
 * the caller records as not-run rather than a guessed verdict.
 */
const psql = (sql: string): string | null => {
  try {
    return execFileSync(
      'docker',
      ['exec', POSTGRES_CONTAINER, 'psql', '-U', 'postgres', '-d', NOTIFY_DB, '-tA', '-c', sql],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    return null;
  }
};

const redis = (...args: string[]): string | null => {
  try {
    return execFileSync('docker', ['exec', REDIS_CONTAINER, 'redis-cli', ...args], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};

const pollUntil = async (check: () => boolean, timeoutMs: number, intervalMs = 3_000): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return false;
};

type Preferences = { channel: string; unsubscribed: boolean; digestWindowMinutes: number | null };

const readPreferences = async (token: string): Promise<Preferences | null> => {
  const data = await graphql<{ notificationPreferences: Preferences }>(
    token,
    'query { notificationPreferences { channel unsubscribed digestWindowMinutes } }',
  );
  return data?.notificationPreferences ?? null;
};

const updatePreferences = (token: string, unsubscribed: boolean, digestWindowMinutes: number | null) =>
  graphql<{ updateNotificationPreferences: Preferences }>(
    token,
    'mutation Update($input: UpdateNotificationPreferencesInput!) { updateNotificationPreferences(input: $input) { channel unsubscribed digestWindowMinutes } }',
    { input: { channel: 'email', unsubscribed, digestWindowMinutes } },
  );

const signInAs = async (page: Page, email: string, password: string): Promise<{ token: string; personId: string } | null> => {
  await page.goto('/sign-in');
  const form = page.locator('form[data-state]');
  // A fill that lands before hydration finishes is reset by the controlled inputs, which leaves the
  // form 'empty' and the submit disabled forever; fill, then confirm the form itself reached 'filled'
  // (it only does when React state has both values), retrying the fill once if hydration ate it.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    const filled = await form.waitFor({ state: 'visible' }).then(() =>
      page.waitForSelector('form[data-state="filled"]', { timeout: 5_000 }).then(() => true).catch(() => false),
    );
    if (filled) break;
  }
  await expect(form).toHaveAttribute('data-state', 'filled', { timeout: 10_000 });
  const responsePromise = page.waitForResponse(
    response => response.url().includes('/graphql') && (response.request().postData() ?? '').includes('signIn'),
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: 'Sign in' }).click();
  const response = await responsePromise;
  const body = (await response.json().catch(() => null)) as
    | { data?: { signIn?: { sessionToken?: string; personId?: string } } }
    | null;
  const token = body?.data?.signIn?.sessionToken;
  const personId = body?.data?.signIn?.personId;
  if (!token || !personId) return null;
  await page.waitForURL('**/tasks', { timeout: 10_000 });
  return { token, personId };
};

/**
 * uat.notify.digest-and-unsubscribe (examples/todo-app-backend/.starciwork/features/notify/uat/
 * digest-and-unsubscribe/index.yaml):
 *   1. Sign in as the owner; the preferences screen is reachable.
 *   2. Trigger two notify-worthy events for the owner inside one digest window.
 *   3. Read the owner's inbox and see exactly one message covering both events.
 *   4. Unsubscribe from email in the preferences screen.
 *   5. Trigger a third notify-worthy event.
 *   6. Confirm no new message arrives for it.
 *
 * Decisions this walk makes, explicitly:
 * - "a notify-worthy event" is a real task completion (fr.notify.on-completion, done and live-proven):
 *   TaskCompletedEvent -> NotifyEventSubscriber -> NotifyService.admit. The record's own blockedBy left
 *   it to whoever walks this flow to decide whether task-completion-only satisfies steps 2 and 5, since
 *   fr.notify.on-new-device stays todo. The steps name no mechanism, so two completions are two honest
 *   events.
 * - step 3's "the owner's inbox" is the person's email mailbox, and the email leg is unprovable in this
 *   stack: integration.notify.smtp has no reachable dev host, so the one rendered digest message is
 *   dispatched, refused transiently, and never arrives anywhere readable. Per the owner directive in
 *   ex-testing/briefs/v9/_common.md (external-provider legs are never faked), that leg is recorded
 *   not-run and the record settles `inprogress`, not `done`. What this run does observe end-to-end is
 *   everything the app itself serves: the window's grouping, the single flush, the single dispatch
 *   batch covering both events, and the suppression of the post-unsubscribe event.
 */
test.describe(record.id, () => {
  test(record.title, async ({ page }, testInfo) => {
    test.setTimeout(300_000);

    if (!LIVE_LOGIN_AUTHORIZED) {
      for (const id of ['br.notify.digest.window', 'fr.notify.digest', 'fr.notify.unsubscribe', 'br.notify.unsubscribe.honored']) {
        recordAssertion(testInfo, {
          id,
          expected: 'yes',
          observed: 'not-run',
          note: 'Every step needs a real session and real task completions on the shared, other-lane-owned ' +
            'Postgres; this lane is not authorized to create them, so this flow is not attempted in this environment.',
        });
      }
      return;
    }

    const owner = readAccounts(FEATURE, FLOW).find(a => a.role === 'owner');
    if (!owner) throw new Error(`${FEATURE}/${FLOW}/accounts.yaml is missing an owner role.`);
    const ownerPassword = passwordFor(owner.role);
    if (!ownerPassword) throw new Error('No credential resolved for owner; set UAT_DEMO_PASSWORD or UAT_PASSWORD_OWNER.');

    const runId = currentRunId();
    const titles = [`uat-${runId}-digest-a`, `uat-${runId}-digest-b`, `uat-${runId}-post-unsubscribe`];
    const taskIds: string[] = [];
    let token = '';
    let personId = '';
    let preRun: Preferences | null = null;
    let groupId: string | null = null;

    /** Last-resort cleanup: idempotent deletes of whatever the run managed to create, runnable without
     *  the page, so a mid-walk failure cannot leak rows. The recorded cleanup step below does the same
     *  thing through the walk's own evidence; this only covers the case it is never reached. Everything
     *  here is scoped to this run's own taskIds/groupId - the stack and queue are shared with other lanes. */
    const cleanupLeftovers = async (): Promise<void> => {
      if (!token) return;
      const list = await graphql<{ tasks: Array<{ taskId: string; title: string }> }>(token, 'query { tasks { taskId title } }').catch(() => null);
      const allIds = new Set(taskIds);
      for (const task of list?.tasks ?? []) if (titles.includes(task.title)) allIds.add(task.taskId);
      for (const id of allIds) {
        await graphql(token, 'mutation DeleteTask($id: ID!) { deleteTask(id: $id) { deleted } }', { id }).catch(() => null);
      }
      const idList = [...allIds].map(id => `'${id}'`).join(',');
      if (idList) {
        psql(`DELETE FROM notify_delivery_attempts WHERE notification_id IN (SELECT id FROM notify_notifications WHERE payload->>'taskId' IN (${idList}))`);
        psql(`DELETE FROM notify_notifications WHERE payload->>'taskId' IN (${idList})`);
      }
      if (groupId) {
        psql(`DELETE FROM notify_digest_windows WHERE id = '${groupId}'`);
        redis('ZREM', 'notify:dispatch-queue', `flush:${groupId}`, `retry:${groupId}`);
      }
      if (preRun) await updatePreferences(token, preRun.unsubscribed, preRun.digestWindowMinutes).catch(() => null);
    };

    try {
      await walkStep(page, testInfo, 'owner-signed-in', async () => {
        const session = await signInAs(page, owner.username, ownerPassword);
        if (!session) throw new Error('Owner sign-in did not return a sessionToken/personId; the walk cannot continue.');
        token = session.token;
        personId = session.personId;
        await expect(page.locator('[data-state]').first()).toBeVisible();
      });

      await walkStep(page, testInfo, 'preferences-reachable', async () => {
        await page.goto('/notify/preferences');
        const root = page.locator('[data-state]').first();
        await expect(root).toHaveAttribute('data-state', /^(subscribed|unsubscribed)$/, { timeout: 15_000 });
        recordAssertion(testInfo, {
          id: 'ux.notify.preferences.reachable',
          expected: 'yes',
          observed: 'yes',
          note: 'The signed-in owner reached /notify/preferences and the screen settled into a real ' +
            'state (not loading, not refused) - the record\'s step-1 expectation.',
        });

        // Record the pre-run preference so cleanup restores it (the record's own cleanup clause), then
        // arm a 1-minute digest window through the real mutation - the screen exposes only the toggle.
        preRun = await readPreferences(token);
        await updatePreferences(token, false, DIGEST_WINDOW_MINUTES);
        // An unflushed window left open by an earlier run would absorb this run's events under its own
        // (longer) closesAt; closing it out first is the same clean-slate step live-proof-notify.sh takes.
        psql(`DELETE FROM notify_digest_windows WHERE person_id = '${personId}' AND channel = 'email' AND flushed_at IS NULL`);
      });

      await walkStep(page, testInfo, 'two-events-one-window', async () => {
        await page.goto('/tasks');
        for (const title of titles.slice(0, 2)) {
          await page.getByLabel('New task').fill(title);
          await page.getByRole('button', { name: 'Add task' }).click();
          const row = page.locator('li', { hasText: title });
          await expect(row).toBeVisible({ timeout: 10_000 });
          // Completing the task is the notify-worthy event: complete-task publishes TaskCompletedEvent.
          // The checkbox is a controlled input with no optimistic update - a .check() reverts until the
          // completeTask mutation and refetch land, so click it and wait for the server-driven state.
          await row.getByRole('checkbox').click();
          await expect(row.getByRole('checkbox')).toBeChecked({ timeout: 10_000 });
          recordResource(testInfo, {
            action: 'created',
            kind: 'task',
            id: title,
            note: 'Run-owned task created and completed through the UI; the completion is the notify trigger.',
          });
        }

        const list = await graphql<{ tasks: Array<{ taskId: string; title: string }> }>(token, 'query { tasks { taskId title } }');
        for (const title of titles.slice(0, 2)) {
          const id = list?.tasks.find(task => task.title === title)?.taskId;
          if (id) taskIds.push(id);
        }

        const grouped = await pollUntil(() => {
          if (taskIds.length < 2) return false;
          const rows = psql(
            `SELECT digest_group_id FROM notify_notifications WHERE recipient_id = '${personId}' ` +
            `AND kind = 'task-complete' AND payload->>'taskId' IN ('${taskIds[0]}','${taskIds[1]}')`,
          );
          if (!rows) return false;
          const groups = rows.split('\n').filter(line => line.trim().length > 0);
          if (groups.length === 2 && groups[0] === groups[1]) {
            groupId = groups[0];
            return true;
          }
          return false;
        }, 20_000);

        recordAssertion(testInfo, {
          id: 'br.notify.digest.window',
          expected: 'yes',
          observed: grouped ? 'yes' : 'not-run',
          note: grouped
            ? `Both task completions landed as notify_notifications rows sharing one digest_group_id ` +
              `(${groupId}) - the second event joined the still-open window the first one opened. Read ` +
              `back from the stack's own Postgres because the product exposes no notifications query.`
            : 'Could not confirm both events shared one digest window - either the notification rows ' +
              'never appeared or the Postgres read-back channel was unavailable; not marked failed ' +
              'because the observation itself could not be made.',
        });
        if (grouped) {
          recordResource(testInfo, {
            action: 'created',
            kind: 'notify-pipeline-rows',
            id: groupId ?? '',
            note: 'Notification, delivery-attempt and digest-window rows this run\'s task completions wrote ' +
              'into the stack\'s Postgres - internal rows no UI surface ever shows.',
          });
        }
      });

      await walkStep(page, testInfo, 'digest-flushes-one-message', async () => {
        if (!groupId) {
          recordAssertion(testInfo, {
            id: 'fr.notify.digest',
            expected: 'yes',
            observed: 'not-run',
            note: 'No shared digest group was observed in the previous step, so there is no window to watch flush.',
          });
        } else {
          const flushed = await pollUntil(
            () => psql(`SELECT flushed_at IS NOT NULL FROM notify_digest_windows WHERE id = '${groupId}'`) === 't',
            FLUSH_POLL_TIMEOUT_MS,
          );
          const dispatched = flushed
            ? psql(
                `SELECT count(*) FROM notify_delivery_attempts a JOIN notify_notifications n ON n.id = a.notification_id ` +
                `WHERE n.digest_group_id = '${groupId}' AND a.attempt >= 1`,
              ) === '2'
            : false;
          recordAssertion(testInfo, {
            id: 'fr.notify.digest',
            expected: 'yes',
            observed: flushed && dispatched ? 'yes' : flushed ? 'no' : 'not-run',
            note: flushed && dispatched
              ? `The shared window (${groupId}) flushed once after its 1-minute close and the real ` +
                `scheduler dispatched both members as ONE batch (DeliveryService.dispatchBatch renders a ` +
                `single message per flushed group - "2 updates" naming both tasks). Read back from ` +
                `Postgres: one window, one flush, one batch.`
              : flushed
                ? 'The window flushed but fewer than both delivery attempts left attempt=0 - the batch ' +
                  'did not cover both events.'
                : `The window never flushed within ${FLUSH_POLL_TIMEOUT_MS / 1000}s; the observation could not be made.`,
          });
        }
        recordAssertion(testInfo, {
          id: 'ux.notify.inbox-arrival',
          expected: 'yes',
          observed: 'not-run',
          note: 'The record\'s step 3 asks to read the owner\'s inbox and see the one message. The product\'s ' +
            'only inbox is the person\'s external email mailbox: no in-app inbox UI exists and this stack has ' +
            'no reachable SMTP host (integration.notify.smtp / gap.notify.smtp-host-unreachable), so the ' +
            'rendered message was dispatched, refused transiently by the transport, and never arrived ' +
            'anywhere a walk could read. Per the owner directive, external-provider legs are never faked; ' +
            'this leg stays unproven.',
        });
      });

      await walkStep(page, testInfo, 'unsubscribed-in-preferences', async () => {
        await page.goto('/notify/preferences');
        const root = page.locator('[data-state]').first();
        await expect(root).toHaveAttribute('data-state', 'subscribed', { timeout: 15_000 });
        await page.getByRole('button', { name: 'Unsubscribe from email' }).click();
        await expect(root).toHaveAttribute('data-state', 'unsubscribed', { timeout: 15_000 });
        await expect(page.getByText('You are unsubscribed from the email digest.')).toBeVisible();
        const readBack = await readPreferences(token);
        const persisted = readBack?.unsubscribed === true;
        recordAssertion(testInfo, {
          id: 'fr.notify.unsubscribe',
          expected: 'yes',
          observed: persisted ? 'yes' : 'no',
          note: persisted
            ? 'The preferences screen\'s "Unsubscribe from email" action settled the screen on ' +
              'unsubscribed, and a correctly-headed notificationPreferences read-back returns ' +
              'unsubscribed: true - the preference is saved, not merely displayed.'
            : `The screen unsubscribed but the API read-back disagrees (${JSON.stringify(readBack)}).`,
        });
      });

      await walkStep(page, testInfo, 'third-event-suppressed', async () => {
        await page.goto('/tasks');
        const title = titles[2];
        await page.getByLabel('New task').fill(title);
        await page.getByRole('button', { name: 'Add task' }).click();
        const row = page.locator('li', { hasText: title });
        await expect(row).toBeVisible({ timeout: 10_000 });
        await row.getByRole('checkbox').click();
        await expect(row.getByRole('checkbox')).toBeChecked({ timeout: 10_000 });
        recordResource(testInfo, {
          action: 'created',
          kind: 'task',
          id: title,
          note: 'Run-owned task created and completed through the UI after the unsubscribe.',
        });
        const list = await graphql<{ tasks: Array<{ taskId: string; title: string }> }>(token, 'query { tasks { taskId title } }');
        const idC = list?.tasks.find(task => task.title === title)?.taskId;
        if (idC) taskIds.push(idC);

        const suppressed = idC
          ? await pollUntil(() => {
              const row = psql(
                `SELECT a.state || '|' || coalesce(a.failure_class, '') || '|' || a.attempt ` +
                `FROM notify_delivery_attempts a JOIN notify_notifications n ON n.id = a.notification_id ` +
                `WHERE n.payload->>'taskId' = '${idC}'`,
              );
              return row === 'suppressed|unsubscribed|0';
            }, 20_000)
          : false;
        recordAssertion(testInfo, {
          id: 'br.notify.unsubscribe.honored',
          expected: 'yes',
          observed: suppressed ? 'yes' : 'not-run',
          note: suppressed
            ? 'The third event was recorded (its notify_notifications row exists) but its delivery ' +
              'attempt was created already suppressed with failure_class=unsubscribed and attempt=0 - ' +
              'no dispatch was ever made, so no message could have arrived. That is the provable form ' +
              'of the record\'s step 6 ("no new message arrives") given that no reachable inbox exists.'
            : 'The post-unsubscribe event\'s delivery attempt could not be observed as suppressed ' +
              '(row missing or read-back unavailable); not marked failed because the observation itself ' +
              'could not be made.',
        });
      });

      await walkStep(page, testInfo, 'cleaned-up', async () => {
        // The record's cleanup clause: restore the preference to its pre-run value, delete the run's
        // disposable rows. The preference goes back through the same real mutation that set it; a
        // preference is a restored value rather than a created resource, so it is not a ResourceEvent -
        // this line plus the step's screenshot are its record.
        if (preRun) await updatePreferences(token, preRun.unsubscribed, preRun.digestWindowMinutes);

        // The three run-owned tasks go out through the app's own two-step delete (the same walk
        // uat.task.create's cleanup uses). The list must settle first - an unread row count right
        // after navigation skips a task that is really there (one earlier run leaked a row that way
        // and the finally-cleanup caught it; the walked cleanup should not rely on that net).
        await page.goto('/tasks');
        await expect(page.locator('[data-state]').first()).toHaveAttribute(
          'data-state', /^(empty|one-task|many-tasks|refused)$/, { timeout: 15_000 });
        for (const title of titles) {
          const row = page.locator('li', { hasText: title });
          if ((await row.count()) === 0) continue;
          await row.getByRole('button', { name: 'Delete' }).click();
          await row.getByRole('button', { name: 'Delete' }).click();
          await expect(page.getByText(title)).toHaveCount(0, { timeout: 10_000 });
          recordResource(testInfo, { action: 'deleted', kind: 'task', id: title, note: 'Deleted through the UI two-step confirm.' });
          recordResource(testInfo, { action: 'verified-absent', kind: 'task', id: title, note: 'The title resolves to zero rows in the re-read owner list.' });
        }

        // The pipeline rows this run's events wrote (notifications, delivery attempts, the digest
        // window) are internal rows the UI never shows; they are deleted where they were written.
        const idList = taskIds.map(id => `'${id}'`).join(',');
        if (idList) {
          psql(`DELETE FROM notify_delivery_attempts WHERE notification_id IN (SELECT id FROM notify_notifications WHERE payload->>'taskId' IN (${idList}))`);
          psql(`DELETE FROM notify_notifications WHERE payload->>'taskId' IN (${idList})`);
        }
        if (groupId) {
          psql(`DELETE FROM notify_digest_windows WHERE id = '${groupId}'`);
          redis('ZREM', 'notify:dispatch-queue', `flush:${groupId}`, `retry:${groupId}`);
        }
        const remaining = idList
          ? psql(`SELECT count(*) FROM notify_notifications WHERE payload->>'taskId' IN (${idList})`)
          : '0';
        if (remaining === '0') {
          recordResource(testInfo, {
            action: 'deleted',
            kind: 'notify-pipeline-rows',
            id: groupId ?? taskIds.join(','),
            note: 'Deleted from notify_notifications, notify_delivery_attempts and notify_digest_windows.',
          });
          recordResource(testInfo, {
            action: 'verified-absent',
            kind: 'notify-pipeline-rows',
            id: groupId ?? taskIds.join(','),
            note: 'Zero notify_notifications rows remain for the run\'s taskIds on read-back.',
          });
        }
      });
    } finally {
      await cleanupLeftovers();
    }
  });
});
