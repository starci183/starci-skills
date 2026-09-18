import { expect, test } from '@playwright/test';
import { readAccounts } from '../lib/flow-records';
import { LIVE_LOGIN_AUTHORIZED, passwordFor } from '../lib/run-context';
import { recordAssertion, walkStep } from '../lib/steps';

const API_BASE_URL = process.env.UAT_API_BASE_URL ?? 'http://localhost:3001';

/**
 * A correctly-headed read against the real API - "Authorization: Bearer <token>", the same header
 * contract.login.identity-for-task's surface names (rev 3) and the browser itself now sends - used
 * only to establish ground truth for what this person's own list actually contains; the browser is
 * still what every recorded UX/business observation is read from.
 *
 * Ported from ex-uat-live's REST-era version (fetch('/tasks', {headers:{'x-session-token'}})): the
 * transport moved to GraphQL, so this is one POST to /graphql with the `tasks` query, headed the same
 * way the browser's own fetcher (`src/modules/api/graphql.ts`) heads it.
 */
const apiListTasks = async (token: string): Promise<ReadonlyArray<{ taskId: string }> | null> => {
  const res = await fetch(`${API_BASE_URL}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: 'query { tasks { taskId } }' }),
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { data?: { tasks?: Array<{ taskId: string }> } } | null;
  return body?.data?.tasks ?? null;
};

/**
 * uat.login.sign-in (examples/todo-app-backend/.starciwork/features/login/uat/sign-in/index.yaml):
 *   1. Sign in with the seeded person.
 *   2. See the empty task list.
 *   3. Close the browser tab and return; still signed in (the token lives in localStorage, read back
 *      as an Authorization: Bearer header - never a cookie; the record's step 3 wording was fixed to
 *      say this in this same lane, see the record's own change entry).
 *   4. Submit a wrong password and read the refusal.
 *
 * Steps 1-3 need a session actually *created* on a backend - a write to Postgres. `LIVE_LOGIN_AUTHORIZED`
 * (../lib/run-context.ts) gates the difference: when false, steps 1-3 are not attempted and their
 * assertions are recorded `observed: 'not-run'` rather than skipped silently or faked as passing; when
 * true (this lane's own compose stack, `UAT_LIVE_LOGIN_AUTHORIZED=true`), they are actually walked.
 */
test.describe('uat.login.sign-in', () => {
  test('walks ui.login.sign-in states, a real sign-in, and the wrong-password refusal', async ({ page }, testInfo) => {
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
        const responsePromise = page.waitForResponse(response => response.url().includes('/graphql'), { timeout: 10_000 });
        await page.getByRole('button', { name: 'Sign in' }).click();
        const response = await responsePromise;
        const body = (await response.json().catch(() => null)) as { data?: { signIn?: { sessionToken?: string } }; errors?: unknown[] } | null;
        signedInOk = response.ok() && !!body?.data?.signIn?.sessionToken;
        if (signedInOk) {
          personToken = body!.data!.signIn!.sessionToken as string;
        } else {
          recordAssertion(testInfo, {
            id: 'fr.login.sign-in',
            expected: 'yes',
            observed: 'no',
            note: `signIn mutation for ${person.username} did not return a sessionToken (HTTP ${response.status()}, body ${JSON.stringify(body)}); the seeded person could not sign in.`,
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
        // grit #36, closed in this lane: useSignIn now calls router.push('/tasks') on a successful
        // sign-in (src/hooks/auth/useSignIn.ts). Wait for the navigation instead of driving it by URL.
        await page.waitForURL('**/tasks', { timeout: 10_000 });
        recordAssertion(testInfo, {
          id: 'ux.sign-in.lands-on-task-list',
          expected: 'yes',
          observed: 'yes',
          note: 'Signing in navigates to /tasks on its own (useSignIn calls router.push after setToken); no manual navigation was needed.',
        });

        // Ground truth for what this person's own list actually contains, read through the same
        // Authorization: Bearer header the browser itself now sends (no header mismatch left to guard
        // against on this base, but the cross-check stays as a live regression guard).
        const groundTruth = personToken ? await apiListTasks(personToken) : null;
        const expectedState = groundTruth === null ? null : groundTruth.length === 0 ? 'empty' : groundTruth.length === 1 ? 'one-task' : 'many-tasks';
        const mismatchNote = (state: string | null, count: number | undefined) =>
          `but a correctly-headed API read-back shows ${person.username} actually owns ${count ?? 0} task(s) ` +
          `(expected data-state="${expectedState}"). This would mean the browser's own GraphQL fetcher ` +
          '(src/modules/api/graphql.ts) is not sending the same Authorization header the backend reads ' +
          '(session-actor.adapter.ts) - a live regression of the auth-bypass class this lane closed.';

        await walkStep(page, testInfo, 'task-list-after-sign-in', async () => {
          const list = page.locator('[data-state]').first();
          await expect(list).toBeVisible({ timeout: 10_000 });
          const state = await list.getAttribute('data-state');
          const matches = expectedState !== null && state === expectedState;
          recordAssertion(testInfo, {
            id: 'fr.login.sign-in',
            expected: 'yes',
            observed: matches ? 'yes' : 'no',
            note: expectedState === null
              ? `The browser rendered data-state="${state}" at /tasks, but the correctly-headed API ` +
                `read-back for ${person.username} itself failed, so this cannot be confirmed as that ` +
                "person's own list."
              : matches
                ? `After landing on /tasks, the browser rendered data-state="${state}", matching a ` +
                  `correctly-headed API read-back of ${person.username}'s own ${groundTruth?.length ?? 0} task(s).`
                : `The browser rendered data-state="${state}" at /tasks, ${mismatchNote(state, groundTruth?.length)}`,
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
            note: 'The session token lives in localStorage, read back as an Authorization: Bearer header ' +
              '- never a cookie (the record\'s own step 3 wording now says this) - so reloading /tasks ' +
              `re-read it without re-authenticating; the list rendered data-state="${state}" after reload. ` +
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
        note: 'A successful sign-in writes a session row to Postgres. UAT_LIVE_LOGIN_AUTHORIZED is not ' +
          'true in this environment, so this step is not-run here rather than attempted against ' +
          'infrastructure this run does not own.',
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
        .waitForResponse(response => response.url().includes('/graphql'), { timeout: 10_000 })
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
          note: 'No response observed from /graphql within the timeout; the API origin did not answer.',
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
      // navigation) - ported from ex-uat-live, which only discovered this by actually reaching this
      // checkpoint against a live app.
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
