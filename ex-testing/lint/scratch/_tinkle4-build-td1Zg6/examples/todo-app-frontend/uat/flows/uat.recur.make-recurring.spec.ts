import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { readAccounts, readFlowRecord } from '../lib/flow-records';
import { currentRunId, LIVE_LOGIN_AUTHORIZED, passwordFor } from '../lib/run-context';
import { recordAssertion, recordResource, walkStep } from '../lib/steps';

const FEATURE = 'recur';
const FLOW = 'make-recurring';
const record = readFlowRecord(FEATURE, FLOW);
const API_BASE_URL = process.env.UAT_API_BASE_URL ?? 'http://localhost:3001';

/**
 * The API's generation tick interval is the stack's own RECUR_TICK_CRON (AppConfigService's declared
 * default is `*\/5 * * * *` - every five minutes on the wall-clock marks). The lane's live probe on
 * 2026-09-19 measured ~80s from rule creation to first materialisation, so a covered window can take
 * up to one full tick period to appear; the waits below bound that honestly instead of faking a tick.
 */
const TICK_WAIT_MS = 390_000;
const TICK_BOUNDARY_MS = 5 * 60_000;

const signInAs = async (page: import('@playwright/test').Page, email: string, password: string): Promise<string> => {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  const responsePromise = page.waitForResponse(response => response.url().includes('/graphql'), { timeout: 10_000 });
  await page.getByRole('button', { name: 'Sign in' }).click();
  const response = await responsePromise;
  const body = (await response.json().catch(() => null)) as { data?: { signIn?: { sessionToken?: string } } } | null;
  await page.waitForURL('**/tasks', { timeout: 10_000 });
  return body?.data?.signIn?.sessionToken ?? '';
};

type Upcoming = {
  materialised: Array<{ occurrenceId: string; localDate: string; status: string }>;
  previewDates: Array<string>;
};

/**
 * A correctly-headed read of the rule's upcoming occurrences (`Authorization: Bearer`, the same
 * header the browser's own fetcher sends) - used only to learn when the scheduler's real tick has
 * written a row and to re-read the settled state across a later tick boundary. Every UX/business
 * observation the run records is still read from what a browser page renders.
 */
const apiUpcoming = async (token: string, ruleId: string): Promise<Upcoming | null> => {
  const res = await fetch(`${API_BASE_URL}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      query: 'query Q($ruleId: String!) { upcomingOccurrences(ruleId: $ruleId) { materialised { occurrenceId localDate status } previewDates } }',
      variables: { ruleId },
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { data?: { upcomingOccurrences?: Upcoming } } | null;
  return body?.data?.upcomingOccurrences ?? null;
};

/** The real calendar day-of-week of a YYYY-MM-DD date, 0=Sunday..6=Saturday, off `Date.UTC`. */
const weekdayOf = (isoDate: string): number =>
  new Date(`${isoDate}T00:00:00Z`).getUTCDay();

/**
 * The most recent weekday on-or-before today in the local zone, as YYYY-MM-DD. Used as the rule's
 * start date so the covered window [startDate, today] always contains at least one real fire day -
 * a weekday rule created on a weekend (this lane ran on a Saturday) covers nothing otherwise and no
 * tick could ever materialise an occurrence for it.
 */
const mostRecentWeekday = (): string => {
  const day = new Date();
  while (day.getDay() === 0 || day.getDay() === 6) day.setDate(day.getDate() - 1);
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  return `${day.getFullYear()}-${m}-${d}`;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * The stack's Postgres is reached through the compose container that publishes :5432 (the same
 * door the api itself uses). Rules and occurrences have no public delete door - `endRecurrence`
 * only ends a rule and `deleteTask` only removes the backing task row - so run-owned recur rows are
 * removed here by their recorded ids, exactly as v7-11 removed its leaked task row by hand. Every
 * statement is id-scoped; a missing docker/psql leaves the events unrecorded (cleanup.json then
 * honestly shows them unresolved) rather than claiming a delete that did not happen.
 */
const psql = (sql: string): string => {
  const container = execFileSync(
    'docker',
    ['ps', '--format', '{{.Names}}', '--filter', 'publish=5432'],
    { encoding: 'utf8' },
  ).split('\n').map(s => s.trim()).filter(Boolean)[0];
  if (!container) throw new Error('no container publishes :5432');
  return execFileSync('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'todo', '-tAc', sql], { encoding: 'utf8' });
};

/**
 * uat.recur.make-recurring (examples/todo-app-backend/.starciwork/features/recur/uat/make-recurring/index.yaml):
 *   1. Sign in as the owner.
 *   2. Turn a task into a rule that fires every weekday at 09:00 in the owner's own time zone.
 *   3. See the upcoming occurrences preview, and confirm none of them is a weekend date.
 *   4. Wait for (or trigger) a generation run, and see the day's occurrence appear materialised.
 *   5. Complete that occurrence, and see its status become completed.
 *   6. End the rule, and confirm history is preserved and no new occurrence appears after the end date.
 *
 * What the served product actually provides, and how the walk answers each step honestly:
 * - The record's `entry: /tasks/:taskId/schedule` is not served by this app - that route 404s, and
 *   the task list's per-row "Schedule" link points at the same unserved path. The recur screen the
 *   impl record owns is `/<lang>/recur?task=<title>` (it binds the task by title because the
 *   makeRecurring contract takes a title, never a taskId). This walk reaches it by URL, the same
 *   way uat.login.sign-in reaches /sign-in.
 * - The schedule screen keeps the created rule in page session state only (there is no
 *   list-my-rules door to reload it), and it refetches upcomingOccurrences only on save and on
 *   end-confirm. So the tick wait and the step-5 completion attempt happen on a second tab at
 *   /tasks - the app surface where a materialised occurrence actually appears, as a real task row -
 *   while the recur session stays mounted for the end-rule leg.
 * - Step 5's expected "its status becomes completed" has no door in this product: occurrence rows
 *   on the schedule screen are read-only, and the public GraphQL schema exposes no
 *   completeOccurrence/skipOccurrence (only makeRecurring/editRecurrence/endRecurrence/
 *   upcomingOccurrences; OccurrenceService.complete is internal CQRS only). Completing the
 *   occurrence's backing task through the task list sets tasks.complete but never touches
 *   occurrences.status - the run records that observed 'no' instead of faking the leg.
 */
test.describe(record.id, () => {
  test(record.title, async ({ page }, testInfo) => {
    // Two bounded ~6.5 minute waits sit inside this walk (first materialisation, then the next tick
    // boundary re-read) - well past the config's 30s default.
    test.setTimeout(900_000);

    const provesIds = [
      'fr.recur.make-recurring',
      'fr.recur.see-upcoming',
      'fr.recur.end-rule',
      'br.recur.generation.once',
      'br.recur.ending.preserves-history',
      'br.recur.occurrence.owned-by-rule-owner',
    ];
    if (!LIVE_LOGIN_AUTHORIZED) {
      for (const id of provesIds) {
        recordAssertion(testInfo, {
          id,
          expected: 'yes',
          observed: 'not-run',
          note: 'Every step writes real rows (session, task, rule, occurrences) on the shared ' +
            'other-lane-owned stack; this lane is not authorized to create them here, so the flow ' +
            'is not attempted in this environment.',
        });
      }
      return;
    }

    const accounts = readAccounts(FEATURE, FLOW);
    const owner = accounts.find(a => a.role === 'owner');
    if (!owner) throw new Error(`${FEATURE}/${FLOW}/accounts.yaml is missing an owner role.`);
    const ownerPassword = passwordFor(owner.role);
    if (!ownerPassword) throw new Error('No credential resolved for owner; set UAT_DEMO_PASSWORD or UAT_PASSWORD_OWNER.');

    const title = `uat-${currentRunId()}-recur`;
    const startDate = mostRecentWeekday();
    let ownerToken = '';
    let ruleId = '';
    let occurrenceIds: ReadonlyArray<string> = [];
    /** Second tab on the same context: shares the session (localStorage token) so /tasks can be
     *  observed and acted on while the recur page keeps its in-session rule state mounted. */
    let tasksTab: import('@playwright/test').Page | null = null;

    await walkStep(page, testInfo, 'owner-signed-in', async () => {
      ownerToken = await signInAs(page, owner.username, ownerPassword);
      await expect(page.locator('[data-state]').first()).toBeVisible();
    });

    await walkStep(page, testInfo, 'task-created', async () => {
      await page.getByLabel('New task').fill(title);
      await page.getByRole('button', { name: 'Add task' }).click();
      await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
      recordResource(testInfo, {
        action: 'created',
        kind: 'task',
        id: title,
        note: 'Run-owned task row created through the UI, identified by its unique run-scoped title.',
      });
    });

    await walkStep(page, testInfo, 'rule-made-active', async () => {
      // The record's entry route is not served; the recur screen lives at /recur?task=<title>.
      await page.goto(`/recur?task=${encodeURIComponent(title)}`);
      const form = page.locator('form#recur-rule');
      await expect(form).toHaveAttribute('data-state', 'no-rule', { timeout: 15_000 });
      // The owner's own time zone is the form's post-mount default - left untouched per the record's
      // "in the owner's own time zone"; only the start date is set, to the most recent weekday so the
      // covered window contains a real fire day even when the run itself lands on a weekend.
      const zoneInput = page.getByLabel('Time zone');
      await expect(zoneInput).not.toHaveValue('', { timeout: 10_000 });
      await page.getByRole('radio', { name: 'Every weekday' }).check();
      await expect(page.getByLabel('Time of day')).toHaveValue('09:00');
      await page.getByLabel('Start date').fill(startDate);
      const made = page.waitForResponse(
        response => response.url().includes('/graphql') && (response.request().postData() ?? '').includes('makeRecurring'),
        { timeout: 15_000 },
      );
      await page.getByRole('button', { name: 'Save schedule' }).click();
      const body = (await (await made).json().catch(() => null)) as { data?: { makeRecurring?: { ruleId?: string } } } | null;
      ruleId = body?.data?.makeRecurring?.ruleId ?? '';
      // Active state: the form is replaced by the rule summary, the end-rule action and the upcoming card.
      await expect(page.getByRole('button', { name: 'End rule' })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Repeats every weekday at 09:00/)).toBeVisible();
      recordAssertion(testInfo, {
        id: 'fr.recur.make-recurring',
        expected: 'yes',
        observed: ruleId !== '' ? 'yes' : 'no',
        note: `The weekday/09:00 form submission created rule ${ruleId || '(none returned)'} and the ` +
          `screen moved to the active state ("Repeats every weekday at 09:00 ... starting ${startDate}") ` +
          'with an End rule action.',
      });
      recordResource(testInfo, {
        action: 'created',
        kind: 'rule',
        id: ruleId || '(unresolved)',
        note: 'Run-owned recurrence_rules row, id captured from the makeRecurring response.',
      });
    });

    await walkStep(page, testInfo, 'upcoming-preview-weekdays-only', async () => {
      const previewRows = page.locator('li[data-grammar-row]', { hasText: 'Preview - not yet materialised' });
      await expect(previewRows.first()).toBeVisible({ timeout: 15_000 });
      const texts = await previewRows.allInnerTexts();
      const dates = texts.map(t => (t.match(/\d{4}-\d{2}-\d{2}/) ?? [''])[0]);
      const weekendDates = dates.filter(d => d !== '' && (weekdayOf(d) === 0 || weekdayOf(d) === 6));
      recordAssertion(testInfo, {
        id: 'fr.recur.see-upcoming',
        expected: 'yes',
        observed: dates.length > 0 && dates.every(d => d !== '') && weekendDates.length === 0 ? 'yes' : 'no',
        note: `The upcoming card lists ${dates.length} live-computed preview date(s) (${dates.join(', ')}); ` +
          (weekendDates.length === 0
            ? 'none of them is a Saturday or Sunday.'
            : `WEEKEND DATE(S) PRESENT: ${weekendDates.join(', ')}.`),
      });
    });

    await walkStep(page, testInfo, 'generation-tick-materialised', async () => {
      // A real scheduler tick materialises each covered fire date as a real task row owned by the
      // rule's owner - the occurrence appears in the owner's own /tasks list under the rule's title.
      // Poll the correctly-headed read-back to learn when a tick has landed, then read the row off
      // the second tab's rendered list (the recur page only refetches on save/end, so it cannot be
      // the surface this wait observes without losing the session).
      tasksTab = await page.context().newPage();
      await tasksTab.goto('/tasks');
      const deadline = Date.now() + TICK_WAIT_MS;
      let upcoming: Upcoming | null = null;
      while (Date.now() < deadline) {
        upcoming = await apiUpcoming(ownerToken, ruleId);
        if (upcoming && upcoming.materialised.length > 0) break;
        await sleep(10_000);
      }
      occurrenceIds = upcoming?.materialised.map(m => m.occurrenceId) ?? [];
      if (occurrenceIds.length === 0) {
        recordAssertion(testInfo, {
          id: 'br.recur.generation.once',
          expected: 'yes',
          observed: 'not-run',
          note: `No occurrence materialised within ${TICK_WAIT_MS / 1000}s of rule creation - the ` +
            'stack\'s scheduler tick did not fire in the observed window, so the materialisation leg ' +
            'could not be read.',
        });
        return;
      }
      await tasksTab.reload();
      const rows = tasksTab.locator('li', { hasText: title });
      await expect(rows).toHaveCount(1 + occurrenceIds.length, { timeout: 30_000 });
      recordResource(testInfo, {
        action: 'created',
        kind: 'occurrence',
        id: occurrenceIds.join(','),
        note: 'Occurrence row(s) the generator\'s real tick materialised for the covered window ' +
          `[${startDate}..today]; each id is also the backing task row's id.`,
      });
    });

    if (occurrenceIds.length > 0 && tasksTab !== null) {
      await walkStep(tasksTab, testInfo, 'occurrence-complete-attempted', async () => {
        // Record step 5: "Complete that occurrence." The product serves no occurrence-level complete
        // control - schedule-screen occurrence rows are read-only and the public schema has no
        // completeOccurrence/skipOccurrence mutation - so the only completion the app offers is the
        // backing task row's own checkbox. Both run-titled rows are checked so the occurrence's own
        // backing row is covered whichever list position it holds.
        const boxes = tasksTab!.getByRole('checkbox', { name: title });
        await expect(boxes).toHaveCount(1 + occurrenceIds.length, { timeout: 10_000 });
        // The checkbox is controlled: its `checked` prop only flips after completeTask resolves and
        // the list refetches, so click() + the real mutation response is the honest interaction -
        // check() raced that roundtrip on the first run and threw before its state verify landed.
        const checkedStates = async (): Promise<Array<boolean>> =>
          Promise.all(
            Array.from({ length: await boxes.count() }, (_, i) => boxes.nth(i).isChecked()),
          );
        for (;;) {
          const states = await checkedStates();
          const next = states.findIndex(state => !state);
          if (next === -1) break;
          const completed = tasksTab!.waitForResponse(
            response => response.url().includes('/graphql') && (response.request().postData() ?? '').includes('completeTask'),
            { timeout: 15_000 },
          );
          await boxes.nth(next).click();
          await completed;
        }
        // The refetched list re-renders every run-titled row checked - observed, not assumed.
        await expect(async () => {
          expect((await checkedStates()).every(Boolean)).toBe(true);
        }).toPass({ timeout: 15_000 });
      });
    }

    /** The endRecurrence response payload, captured so the walk can prove the rule that ended is the
     *  rule this run created - an earlier run under a stale API process saw the mutation end a
     *  different ruleId entirely while the screen still flipped to "ended". */
    let endedRuleId = '';
    await walkStep(page, testInfo, 'rule-ended-history-preserved', async () => {
      await page.getByRole('button', { name: 'End rule' }).click();
      // The consequence confirm replaces the button inline: "End this rule? ..." + End rule / Keep rule.
      await expect(page.getByText(/End this rule\?/)).toBeVisible({ timeout: 10_000 });
      const ending = page.waitForResponse(
        response => response.url().includes('/graphql') && (response.request().postData() ?? '').includes('endRecurrence'),
        { timeout: 15_000 },
      );
      await page.getByRole('button', { name: 'End rule' }).click();
      const endBody = (await (await ending).json().catch(() => null)) as { data?: { endRecurrence?: { ruleId?: string } } } | null;
      endedRuleId = endBody?.data?.endRecurrence?.ruleId ?? '';
      await expect(page.getByText(/; ended /)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Nothing upcoming')).toBeVisible();
      // History rows: every materialised occurrence still listed with its own status text.
      const history = page.locator('li[data-grammar-row]');
      const historyTexts = await history.allInnerTexts();
      const occurrenceRow = historyTexts.filter(t => t.includes(startDate));
      const occurrenceStatus = occurrenceRow.map(t => (t.match(/materialised|completed|skipped|orphaned/) ?? [''])[0]);
      const historyKept = occurrenceIds.length === 0 || occurrenceRow.length >= occurrenceIds.length;
      recordAssertion(testInfo, {
        id: 'br.recur.occurrence.owned-by-rule-owner',
        expected: 'yes',
        observed: occurrenceStatus.length > 0 && occurrenceStatus.every(s => s === 'completed') ? 'yes' : 'no',
        note: 'Step 5 of this record ("complete that occurrence ... its status becomes completed") has ' +
          'no door in the served product: the schedule screen\'s occurrence rows are read-only ' +
          '(StaticStateRow, no action), the public GraphQL schema registers no completeOccurrence/' +
          'skipOccurrence mutation (OccurrenceService.complete exists but is internal CQRS only), and ' +
          'completing the occurrence\'s backing task row through the task list set tasks.complete yet ' +
          `left the occurrence's own status reading "${occurrenceStatus.join(',') || 'unread'}" on this ` +
          'ended screen - the app cannot produce the designed outcome.',
      });
      recordAssertion(testInfo, {
        id: 'br.recur.ending.preserves-history',
        expected: 'yes',
        observed: historyKept ? 'yes' : 'no',
        note: `After ending, the upcoming card kept all ${occurrenceIds.length} materialised row(s) ` +
          `(status shown: ${occurrenceStatus.join(',') || 'none materialised'}) and shows no preview ` +
          '("Nothing upcoming" + the ended note). The completed/skipped-preservation half of the rule ' +
          'stays unproven here because no completed occurrence could be produced - see the missing ' +
          'complete door above.',
      });
    });

    await walkStep(page, testInfo, 'no-new-occurrence-after-end', async () => {
      // Cross the next five-minute wall boundary plus margin: under the declared `*\/5` ceiling (or any
      // finer override) at least one more real tick has fired since the rule ended, so the re-read
      // observes both "a re-run over an already-covered window writes nothing" (br.recur.generation.once)
      // and "an ended rule produces nothing after its end day" (fr.recur.end-rule).
      const wait = TICK_BOUNDARY_MS - (Date.now() % TICK_BOUNDARY_MS) + 25_000;
      await sleep(wait);
      const after = await apiUpcoming(ownerToken, ruleId);
      const afterIds = after?.materialised.map(m => m.occurrenceId).sort() ?? [];
      // Two distinct facts: the materialised set is frozen across the boundary (generation.once) and,
      // separately, the ended rule's preview is empty (end-rule's contract - e2e asserts both).
      const materialisedFrozen = after !== null
        && afterIds.length === occurrenceIds.length
        && afterIds.every((id, i) => id === [...occurrenceIds].sort()[i]);
      const previewCleared = after !== null && after.previewDates.length === 0;
      recordAssertion(testInfo, {
        id: 'br.recur.generation.once',
        expected: 'yes',
        observed: occurrenceIds.length === 0 || after === null ? 'not-run' : materialisedFrozen ? 'yes' : 'no',
        note: occurrenceIds.length === 0
          ? 'Nothing ever materialised; there was no covered window a re-run could double-write.'
          : `${occurrenceIds.length} occurrence(s) materialised for the covered window; a re-read ` +
            `across the next tick boundary still shows exactly ${afterIds.length} row(s) for ` +
            `rule ${ruleId} - no second occurrence was written for any already-covered date.`,
      });
      recordAssertion(testInfo, {
        id: 'fr.recur.end-rule',
        expected: 'yes',
        observed: after === null ? 'not-run' : (materialisedFrozen && previewCleared && endedRuleId === ruleId) ? 'yes' : 'no',
        note: `The rule ended through the screen's own two-step confirm; endRecurrence's response ` +
          `named rule ${endedRuleId || '(unread)'} ` +
          (endedRuleId === ruleId ? '(this run\'s rule)' : `- expected ${ruleId}!`) +
          `; the ended state shows no preview ("Nothing upcoming" + the ended note) and the ` +
          `post-boundary re-read returned ${afterIds.length} materialised row(s), preview ` +
          `${after?.previewDates.length ?? '?'} - nothing dated after the end day was generated in-window.`,
      });
    });

    if (tasksTab === null) {
      tasksTab = await page.context().newPage();
      await tasksTab.goto('/tasks');
    }
    await walkStep(tasksTab, testInfo, 'cleanup-run-owned-rows', async () => {
      // Both run-titled task rows (the created task and each materialised occurrence's backing row)
      // are removed through the app's own two-step inline confirm.
      const rows = tasksTab!.locator('li', { hasText: title });
      while ((await rows.count()) > 0) {
        const before = await rows.count();
        const row = rows.first();
        await row.getByRole('button', { name: 'Delete' }).click();
        await row.getByRole('button', { name: 'Delete' }).click();
        await expect(rows).toHaveCount(before - 1, { timeout: 10_000 });
      }
      recordResource(testInfo, {
        action: 'deleted',
        kind: 'task',
        id: title,
        note: `All ${1 + occurrenceIds.length} run-titled task row(s) deleted through the UI's ` +
          'two-step confirm on /tasks.',
      });
      recordResource(testInfo, {
        action: 'verified-absent',
        kind: 'task',
        id: title,
        note: 'The re-read task list shows zero rows carrying the run-scoped title.',
      });
      // recurrence_rules and occurrences rows have no public delete door; they are removed by their
      // recorded ids through the stack's own Postgres, then verified absent by read-back.
      if (ruleId !== '') {
        try {
          psql(`DELETE FROM recurrence_rules WHERE id='${ruleId}'`);
          psql(`DELETE FROM occurrences WHERE rule_id='${ruleId}'`);
          const rulesLeft = psql(`SELECT count(*) FROM recurrence_rules WHERE id='${ruleId}'`).trim();
          const occurrencesLeft = psql(`SELECT count(*) FROM occurrences WHERE rule_id='${ruleId}'`).trim();
          if (rulesLeft === '0' && occurrencesLeft === '0') {
            recordResource(testInfo, {
              action: 'deleted',
              kind: 'rule',
              id: ruleId,
              note: 'Run-owned recurrence_rules row deleted by recorded id via the stack\'s Postgres ' +
                '(the product exposes no rule-delete door).',
            });
            recordResource(testInfo, {
              action: 'verified-absent',
              kind: 'rule',
              id: ruleId,
              note: 'SELECT count(*) for the rule id returns 0.',
            });
            recordResource(testInfo, {
              action: 'deleted',
              kind: 'occurrence',
              id: occurrenceIds.join(','),
              note: 'Run-owned occurrences row(s) deleted by recorded rule_id via the stack\'s Postgres.',
            });
            recordResource(testInfo, {
              action: 'verified-absent',
              kind: 'occurrence',
              id: occurrenceIds.join(','),
              note: 'SELECT count(*) for the rule\'s occurrence rows returns 0.',
            });
          }
        } catch {
          // Docker/psql unavailable in this environment: the recur rows stay honestly unresolved in
          // cleanup.json rather than claimed deleted.
        }
      }
    });

    if (tasksTab !== null) await tasksTab.close();
  });
});
