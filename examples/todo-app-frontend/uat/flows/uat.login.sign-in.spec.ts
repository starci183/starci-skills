import { expect, test } from '@playwright/test';
import { readAccounts } from '../lib/flow-records';
import { LIVE_LOGIN_AUTHORIZED, passwordFor } from '../lib/run-context';
import { recordAssertion, walkStep } from '../lib/steps';

const API_BASE_URL = process.env.UAT_API_BASE_URL ?? 'http://localhost:3001';

/**
 * A correctly-headed read against the real API (x-session-token, not the browser's own
 * "authorization: Bearer" - see uat.task.create.spec.ts's fr.task.create note for the same
 * mismatch), used only to establish ground truth for what this person's own list actually
 * contains; the browser is still what every recorded UX/business observation is read from.
 */
const apiListTasks = async (token: string): Promise<ReadonlyArray<{ taskId: string }> | null> => {
  const res = await fetch(`${API_BASE_URL}/tasks`, { headers: { 'x-session-token': token } });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { tasks?: Array<{ taskId: string }> } | null;
  return body?.tasks ?? null;
};

/**
 * uat.login.sign-in (examples/todo-app-backend/.starciwork/features/login/uat/sign-in/index.yaml):
 *   1. Sign in with the seeded person.
 *   2. See the empty task list.
 *   3. Close the session cookie and return; still signed in.
 *   4. Submit a wrong password and read the refusal.
 *
 * Step 3's own wording ("session cookie") does not match the actual mechanism: src/modules/session's
 * token lives in `window.localStorage`, not a cookie. This spec is written against the real code, so it
 * reloads the page and reads localStorage back rather than a cookie jar; the record's prose is stale
 * against its own implementation (reported to the caller, not silently corrected here).
 *
 * Steps 1-3 need a session actually *created* on a backend - a write to the shared Postgres another
 * lane owns. This harness was authorized only to use a reachable shared API read-only, for step 4's
 * wrong-password refusal, which creates no session. `LIVE_LOGIN_AUTHORIZED`
 * (../lib/run-context.ts) gates the difference: when false, steps 1-3 are not attempted and their
 * assertions are recorded `observed: 'not-run'` rather than skipped silently or faked as passing.
 */
test.describe('uat.login.sign-in', () => {
  test('walks ui.login.sign-in states and the wrong-password refusal', async ({ page }, testInfo) => {
    await page.goto('/sign-in');

    await walkStep(page, testInfo, 'empty', async () => {
      const form = page.locator('form[data-state]');
      await expect(form).toHaveAttribute('data-state', 'empty');
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
      recordAssertion(testInfo, {
        id: 'ux.sign-in.validation-feedback',
        expected: 'yes',
        observed: 'yes',
        note: 'The submit button stays disabled while either field is empty (SignInFormView disabled logic).',
      });
    });

    if (LIVE_LOGIN_AUTHORIZED) {
      const person = readAccounts('login', 'sign-in').find(a => a.role === 'person');
      if (!person) throw new Error('login/sign-in accounts.yaml is missing a person role.');
      const personPassword = passwordFor(person.role);
      if (!personPassword) throw new Error('No credential resolved for person; set UAT_DEMO_PASSWORD or UAT_PASSWORD_PERSON.');

      let signedInOk = false;
      let personToken = '';
      await walkStep(page, testInfo, 'signed-in', async () => {
        await page.getByLabel('Email').fill(person.username);
        await page.getByLabel('Password').fill(personPassword);
        const responsePromise = page.waitForResponse(response => response.url().includes('/auth/sign-in'), { timeout: 10_000 });
        await page.getByRole('button', { name: 'Sign in' }).click();
        const response = await responsePromise;
        signedInOk = response.ok();
        if (signedInOk) {
          const body = (await response.json().catch(() => null)) as { sessionToken?: string } | null;
          personToken = typeof body?.sessionToken === 'string' ? body.sessionToken : '';
        } else {
          recordAssertion(testInfo, {
            id: 'fr.login.sign-in',
            expected: 'yes',
            observed: 'no',
            note: `POST /auth/sign-in for ${person.username} returned ${response.status()}; the seeded person could not sign in.`,
          });
        }
      });

      if (!signedInOk) {
        recordAssertion(testInfo, {
          id: 'br.login.session.restores',
          expected: 'yes',
          observed: 'not-run',
          note: 'Depends on the real signed-in session above, which the sign-in call itself refused.',
        });
        await page.goto('/sign-in');
      } else {
        // No route in this app navigates from /sign-in to /tasks on success (checked: no redirect
        // anywhere in src/app or src/features; SignInFormBlock only clears submitting/refusal, so the
        // form itself renders no success state at all) - a real person's only way there today is the
        // address bar (grit #36). Recorded as its own observed `no` per the caller's instruction, kept
        // separate from whether the list itself, once reached, is correct.
        recordAssertion(testInfo, {
          id: 'ux.sign-in.lands-on-task-list',
          expected: 'yes',
          observed: 'no',
          note: 'Signing in does not navigate anywhere; this harness then navigated to /tasks by URL to keep walking the flow.',
        });

        // Ground truth for what this person's own list actually contains, read through the correct
        // header rather than trusted from the browser's own (mis-headed) fetch - see the module note.
        const groundTruth = personToken ? await apiListTasks(personToken) : null;
        const expectedState = groundTruth === null ? null : groundTruth.length === 0 ? 'empty' : groundTruth.length === 1 ? 'one-task' : 'many-tasks';
        const mismatchNote = (state: string | null, count: number | undefined) =>
          `but a correctly-headed API read-back shows ${person.username} actually owns ${count ?? 0} task(s) ` +
          `(expected data-state="${expectedState}"). src/modules/api/client.ts sends an "authorization: Bearer" ` +
          'header while every backend task controller reads only "x-session-token", and ' +
          'session.repository.ts#findActive\'s `findOneBy({ token })` with that undefined token silently ' +
          "matches an arbitrary session instead of refusing - so the browser's own GET /tasks does not " +
          'reliably read this person\'s own list. A real FE/BE integration + authorization defect this ' +
          'live run surfaced, not a selector or environment gap.';

        await walkStep(page, testInfo, 'task-list-after-sign-in', async () => {
          await page.goto('/tasks');
          const list = page.locator('[data-state]').first();
          await expect(list).toBeVisible({ timeout: 10_000 });
          const state = await list.getAttribute('data-state');
          const matches = expectedState !== null && state === expectedState;
          recordAssertion(testInfo, {
            id: 'fr.login.sign-in',
            expected: 'yes',
            observed: matches ? 'yes' : 'no',
            note: expectedState === null
              ? `After navigating to /tasks by URL, the browser rendered data-state="${state}", but the ` +
                `correctly-headed API read-back for ${person.username} itself failed, so this cannot be ` +
                "confirmed as that person's own list."
              : matches
                ? `After navigating to /tasks by URL, the browser rendered data-state="${state}", matching a ` +
                  `correctly-headed API read-back of ${person.username}'s own ${groundTruth?.length ?? 0} task(s).`
                : `After navigating to /tasks by URL, the browser rendered data-state="${state}", ${mismatchNote(state, groundTruth?.length)}`,
          });
        });

        await walkStep(page, testInfo, 'session-restores-on-reload', async () => {
          await page.reload();
          const list = page.locator('[data-state]').first();
          await expect(list).toBeVisible({ timeout: 10_000 });
          const state = await list.getAttribute('data-state');
          const matches = expectedState !== null && state === expectedState;
          recordAssertion(testInfo, {
            id: 'br.login.session.restores',
            expected: 'yes',
            observed: matches ? 'yes' : 'no',
            note: 'The session token lives in localStorage, not a cookie - the record\'s own wording is ' +
              'stale against src/modules/session - so reloading /tasks re-read it without ' +
              `re-authenticating; the list rendered data-state="${state}" after reload. ` +
              (expectedState === null
                ? `The correctly-headed API read-back for ${person.username} itself failed, so this cannot be ` +
                  "confirmed as that person's own list."
                : matches
                  ? `This matches a correctly-headed API read-back of ${person.username}'s own ${groundTruth?.length ?? 0} task(s).`
                  : mismatchNote(state, groundTruth?.length)),
          });
        });

        await page.goto('/sign-in');
      }
    } else {
      recordAssertion(testInfo, {
        id: 'fr.login.sign-in',
        expected: 'yes',
        observed: 'not-run',
        note: 'A successful sign-in writes a session row to the shared, other-lane-owned Postgres. This ' +
          'lane is authorized only for the read-only wrong-password check below, so this step is not-run here.',
      });
      recordAssertion(testInfo, {
        id: 'br.login.session.restores',
        expected: 'yes',
        observed: 'not-run',
        note: 'Depends on the real signed-in session from fr.login.sign-in above; not-run for the same reason.',
      });
    }

    await walkStep(page, testInfo, 'filled', async () => {
      await page.getByLabel('Email').fill('demo@todo.dev');
      await page.getByLabel('Password').fill('a-wrong-password');
      const form = page.locator('form[data-state]');
      await expect(form).toHaveAttribute('data-state', 'filled');
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    });

    await walkStep(page, testInfo, 'working-and-refused', async () => {
      const submit = page.getByRole('button', { name: 'Sign in' });
      const responsePromise = page
        .waitForResponse(response => response.url().includes('/auth/sign-in'), { timeout: 10_000 })
        .catch(() => null);
      await submit.click();
      // 'working' is transient: the button relabels to 'Signing in...' only while the request is in flight.
      await expect(page.getByRole('button', { name: 'Signing in...' })).toBeVisible({ timeout: 5_000 }).catch(() => undefined);
      const response = await responsePromise;

      if (!response) {
        recordAssertion(testInfo, {
          id: 'ux.sign-in.error-feedback',
          expected: 'yes',
          observed: 'not-run',
          note: 'No response observed from /auth/sign-in within the timeout; the API origin did not answer.',
        });
        recordAssertion(testInfo, {
          id: 'br.login.password.sign-in',
          expected: 'yes',
          observed: 'not-run',
          note: 'Same reason: no backend response to compare against a normalized refusal message.',
        });
        return;
      }

      const form = page.locator('form[data-state]');
      await expect(form).toHaveAttribute('data-state', 'refused', { timeout: 10_000 });
      // Scoped inside the form: a bare page.getByRole('alert') also matches Next.js's own
      // "__next-route-announcer__" (role="alert", always present once the app has done any
      // navigation), which this run only discovered by actually reaching this checkpoint against a
      // live app instead of stopping at "no response" as every prior run did.
      const refusal = form.getByRole('alert');
      await expect(refusal).toBeVisible();
      await expect(refusal).toHaveText('That email and password do not match.');
      recordAssertion(testInfo, {
        id: 'ux.sign-in.error-feedback',
        expected: 'yes',
        observed: 'yes',
        note: 'form[data-state="refused"] renders a role="alert" message after the wrong-password submit.',
      });
      recordAssertion(testInfo, {
        id: 'br.login.password.sign-in',
        expected: 'yes',
        observed: 'yes',
        note: 'The refusal text is the one normalized SIGN_IN_REFUSAL_MESSAGE regardless of which half of ' +
          'the pair was wrong (src/modules/api/auth.ts) - the same text an unknown email would produce.',
      });
    });
  });
});
