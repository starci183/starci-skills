import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { readAccounts } from '../lib/flow-records';
import { currentRunId, IDENTITY_API_URL, LIVE_LOGIN_AUTHORIZED, passwordFor } from '../lib/run-context';
import { recordAssertion, recordResource, walkStep } from '../lib/steps';

const FEATURE = 'identity';
const FLOW = 'sign-in';

/** The two cookies the shop's own `/api/session` door sets; Playwright reads the jar, httpOnly included. */
const SESSION_COOKIE = 'northwind-session';
const PERSON_COOKIE = 'northwind-person';

const cookieValue = async (context: BrowserContext, name: string): Promise<string | null> =>
  (await context.cookies()).find(c => c.name === name)?.value ?? null;

type VerifyAnswer = { readonly status: 'live' | 'refused' | 'unreachable'; readonly personId?: string };

/**
 * A correctly-headed read-back against the identity service's internal machine door - the same
 * `internal/sessions/verify` the shop's server render and the order service's SessionGuard call -
 * used only to establish ground truth about whether a bearer is alive and which person it names.
 * The browser is still what every recorded UX/business observation is read from.
 */
const verifyDoorAnswer = async (sessionToken: string): Promise<VerifyAnswer> => {
  try {
    const res = await fetch(`${IDENTITY_API_URL}/internal/sessions/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionToken }),
    });
    if (res.status === 401) return { status: 'refused' };
    if (!res.ok) return { status: 'unreachable' };
    const body = (await res.json().catch(() => null)) as { personId?: string } | null;
    return typeof body?.personId === 'string' && body.personId
      ? { status: 'live', personId: body.personId }
      : { status: 'unreachable' };
  } catch {
    return { status: 'unreachable' };
  }
};

/** One submit through the form, returning the door's answer (null when the door never answered). */
const submitPair = async (
  page: Page,
  mode: 'sign-in' | 'register',
  email: string,
  password: string,
): Promise<{ status: number; code: string | null }> => {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  const responsePromise = page.waitForResponse(
    response => response.url().endsWith('/api/session') && response.request().method() === 'POST',
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: mode === 'sign-in' ? 'Sign in' : 'Register' }).click();
  const response = await responsePromise;
  const body = (await response.json().catch(() => null)) as { ok?: boolean; code?: string } | null;
  return { status: response.status(), code: typeof body?.code === 'string' ? body.code : null };
};

/** The button's accessible name while a submit is in flight (dictionary copy, en locale). */
const submittingName = (mode: 'sign-in' | 'register'): string =>
  mode === 'sign-in' ? 'Signing in…' : 'Registering…';

/**
 * Flip the session form's mode through its TextAction toggle. The grammar's TextAction carries a
 * 300ms press-lock (`pressLockRef`) so a second press that lands inside the debounce window is
 * silently swallowed - on loopback a refusal roundtrip can easily finish inside it. The toggle's
 * label only exists in the mode it switches FROM, so a retry while still in that mode is safe;
 * once the flip lands the label changes and the loop exits on the heading.
 */
const switchMode = async (page: Page, to: 'sign-in' | 'register'): Promise<void> => {
  const label = to === 'register' ? 'New here? Create an account' : 'Already have an account? Sign in';
  const heading = to === 'register' ? 'Create your account' : 'Welcome back';
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.getByRole('button', { name: label }).click();
    const flipped = await expect(page.getByRole('heading', { name: heading }))
      .toBeVisible({ timeout: 1_000 })
      .then(() => true, () => false);
    if (flipped) return;
    await page.waitForTimeout(350);
  }
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
};

/** The account page's signed-in line for this person (dictionary copy, en locale). */
const signedInLine = (email: string) => `Signed in as ${email}.`;

/**
 * uat.identity.sign-in (examples/ecommerce-app-be/.starciwork/features/identity/uat/sign-in/index.yaml):
 *   1. Register a new email and password pair; the account page shows that person signed in.
 *   2. Submit the registered email with a wrong password; one uniform refusal, naming neither half.
 *   3. Submit the sign-in form with the password left empty; refused before any credential check.
 *   4. Register the same email again with a different password; a conflict refusal shows, and the
 *      first pair still signs in.
 *   5. Sign in with the registered pair a second time; a session issues again and the account page
 *      keeps showing the same person.
 *
 * The surface is the signed-out `/account` split v9-6 landed (SessionForm on the right of the auth
 * panel), and the session carrier is the `northwind-session` httpOnly cookie the shop's own
 * `/api/session` door sets - the settled landing→shop handoff. Register, sign-in, sign-out
 * (SignOutAction → `DELETE /api/session` → `internal/sessions/revoke`) are all real product acts;
 * nothing here fakes a callback or writes the store directly.
 *
 * Every step writes a person row and session rows on the dev Postgres/Redis, so the whole walk is
 * gated on LIVE_LOGIN_AUTHORIZED (../lib/run-context.ts): without it the assertions are recorded
 * `not-run` rather than attempted against infrastructure this run does not own. The record's own
 * cleanup note says the product exposes no account deletion, so the run-scoped person row
 * (`uat-person-<runId>@ecommerce.dev`, namespaced per _common.md) and the still-live final session
 * are honestly left in the demo store - cleanup.json says so.
 */
test.describe('uat.identity.sign-in', () => {
  test('registers a pair, is refused alike, and signs in twice', async ({ page }, testInfo) => {
    test.setTimeout(120_000);

    const accounts = readAccounts(FEATURE, FLOW);
    const person = accounts.find(a => a.role === 'person');
    if (!person) throw new Error(`${FEATURE}/${FLOW}/accounts.yaml is missing a person role.`);

    // The record declares one synthetic pair; its cleanup note requires a FRESH address per run,
    // so the declared username's local part gets the run id appended (same namespacing _common.md
    // requires for titles). The password resolves through the env-override chain, falling back to
    // the disposable pair the record carries.
    const runId = currentRunId().toLowerCase();
    const declaredLocal = person.username.split('@')[0] || 'uat-person';
    const email = `${declaredLocal}-${runId}@ecommerce.dev`;
    const password = passwordFor(person.role, person.password || null);
    if (!password) throw new Error('No credential resolved for person; set UAT_PASSWORD_PERSON or UAT_DEMO_PASSWORD.');
    const wrongPassword = `not-${password}`;
    const otherPassword = 'a-different-pair-99';
    const unknownEmail = `uat-nobody-${runId}@ecommerce.dev`;

    if (!LIVE_LOGIN_AUTHORIZED) {
      for (const id of ['loading', 'completion', 'errorFeedback', 'validation', 'fr.identity.sign-in', 'br.identity.sign-in']) {
        recordAssertion(testInfo, {
          id,
          expected: 'yes',
          observed: 'not-run',
          note: 'Every step writes person/session rows on the dev Postgres/Redis. UAT_LIVE_LOGIN_AUTHORIZED ' +
            'is not true in this environment, so this flow is not attempted here.',
        });
      }
      return;
    }

    await page.goto('/account');
    await page.waitForURL('**/account', { timeout: 15_000 });
    // The signed-out surface mounts the SessionForm; a still-signed-in cookie from a crashed prior
    // run is cleared by signing out first, so the walk always starts anonymous.
    if ((await page.locator('form[data-state]').count()) === 0) {
      const signOut = page.getByRole('button', { name: 'Sign out' });
      if (await signOut.count()) {
        await signOut.click();
        await page.waitForResponse(r => r.url().endsWith('/api/session') && r.request().method() === 'DELETE', { timeout: 15_000 });
      }
    }
    await expect(page.locator('form[data-state]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    const tokens: string[] = [];
    const persons: string[] = [];
    const captureSession = async (label: string): Promise<void> => {
      const token = await cookieValue(page.context(), SESSION_COOKIE);
      const personId = await cookieValue(page.context(), PERSON_COOKIE);
      if (token) tokens.push(token);
      if (personId) persons.push(personId);
      recordResource(testInfo, {
        action: 'created',
        kind: 'session',
        id: label,
        note: `Session issued by signIn; the bearer value is withheld from evidence (it is a live credential). Cookie northwind-session present: ${token !== null}.`,
      });
    };

    // ---- record order 1: register a new pair; the account page shows that person signed in ----
    await walkStep(page, testInfo, 'register-pair', async () => {
      // A small deliberate delay on the session door makes the transient `working` state observable
      // deterministically instead of racing localhost latency; the response still arrives unedited.
      await page.route('**/api/session', async route => {
        if (route.request().method() === 'POST') await new Promise(r => setTimeout(r, 400));
        await route.continue();
      });
      try {
        await switchMode(page, 'register');

        const responsePromise = page.waitForResponse(
          r => r.url().endsWith('/api/session') && r.request().method() === 'POST',
          { timeout: 15_000 },
        );
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').fill(password);
        await page.getByRole('button', { name: 'Register' }).click();
        const workingObserved = await page
          .getByRole('button', { name: submittingName('register') })
          .isVisible({ timeout: 3_000 })
          .then(() => true, () => false);
        const response = await responsePromise;
        recordAssertion(testInfo, {
          id: 'loading',
          expected: 'yes',
          observed: workingObserved ? 'yes' : 'no',
          note: workingObserved
            ? 'The register submit relabelled to "Registering…" and disabled itself while the request was in flight (SessionForm working state).'
            : 'The pending label was never observed during the register submit.',
        });
        if (response.status() !== 200) {
          recordAssertion(testInfo, {
            id: 'completion',
            expected: 'yes',
            observed: 'no',
            note: `POST /api/session (register) answered ${response.status()}; no session was established.`,
          });
          return;
        }
      } finally {
        await page.unroute('**/api/session');
      }

      await expect(page.getByText(signedInLine(email))).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
      await captureSession('session-1');
      recordResource(testInfo, {
        action: 'created',
        kind: 'person',
        id: email,
        note: 'Disposable person row registered through the shop form (mode=register → identity register + signIn). ' +
          'The record declares cleanup: none - the product exposes no account deletion, so this row stays in the demo store.',
      });
      recordAssertion(testInfo, {
        id: 'completion',
        expected: 'yes',
        observed: 'yes',
        note: `After one POST /api/session (mode=register), the account page re-rendered server-side and shows "${signedInLine(email)}" with the Sign out action - the registered pair signed the person in.`,
      });
      recordAssertion(testInfo, {
        id: 'fr.identity.sign-in',
        expected: 'yes',
        observed: 'yes',
        note: 'Register ran the identity register door then signIn behind it; the opaque bearer landed in the httpOnly northwind-session cookie and the server render verified it to this person.',
      });
    });

    // ---- record order 2: wrong pair → one uniform refusal, naming neither half ----
    await walkStep(page, testInfo, 'wrong-pair-uniform-refusal', async () => {
      // Return to the anonymous surface through the product's own sign-out (DELETE /api/session
      // revokes the bearer at internal/sessions/revoke and clears both cookies).
      await page.getByRole('button', { name: 'Sign out' }).click();
      await page.waitForResponse(r => r.url().endsWith('/api/session') && r.request().method() === 'DELETE', { timeout: 15_000 });
      await expect(page.locator('form[data-state]')).toBeVisible({ timeout: 15_000 });

      const first = tokens[0];
      if (first) {
        const answer = await verifyDoorAnswer(first);
        recordResource(testInfo, { action: 'deleted', kind: 'session', id: 'session-1', note: 'Revoked by the product sign-out (DELETE /api/session → internal/sessions/revoke).' });
        recordResource(testInfo, {
          action: 'verified-absent',
          kind: 'session',
          id: 'session-1',
          note: `Correctly-headed verify-door read-back after sign-out answered ${answer.status === 'refused' ? 'SESSION_INVALID (401)' : answer.status}.`,
        });
      }

      const wrongPair = await submitPair(page, 'sign-in', email, wrongPassword);
      const form = page.locator('form[data-state]');
      await expect(form).toHaveAttribute('data-state', 'refused', { timeout: 10_000 });
      const refusal = form.getByRole('alert');
      await expect(refusal).toBeVisible();
      const refusalText = (await refusal.innerText()).trim();
      recordAssertion(testInfo, {
        id: 'errorFeedback',
        expected: 'yes',
        observed: 'yes',
        note: `The wrong pair was refused with HTTP ${wrongPair.status} (${wrongPair.code}) and the form rendered one role="alert" line: "${refusalText}".`,
      });

      // br.identity.sign-in's uniformity claim: an UNKNOWN email must be refused identically -
      // same status, same business code, same rendered line, nothing naming which half was wrong.
      const unknownPair = await submitPair(page, 'sign-in', unknownEmail, wrongPassword);
      await expect(form).toHaveAttribute('data-state', 'refused', { timeout: 10_000 });
      const refusalText2 = (await refusal.innerText()).trim();
      const uniform =
        wrongPair.status === 401 &&
        unknownPair.status === 401 &&
        wrongPair.code === 'INVALID_CREDENTIALS' &&
        unknownPair.code === 'INVALID_CREDENTIALS' &&
        refusalText === refusalText2;
      recordAssertion(testInfo, {
        id: 'br.identity.sign-in',
        expected: 'yes',
        observed: uniform ? 'yes' : 'no',
        note: uniform
          ? `Wrong-password-on-known-email and any-password-on-unknown-email both answered 401 INVALID_CREDENTIALS and rendered the identical refusal "${refusalText2}" - indistinguishable, naming neither half (ac.identity.sign-in.wrong-pair-is-refused-alike).`
          : `The two refusals differ: known-email/wrong-password was ${wrongPair.status}/${wrongPair.code}/"${refusalText}", unknown-email was ${unknownPair.status}/${unknownPair.code}/"${refusalText2}".`,
      });
    });

    // ---- record order 3: missing half refused before any credential check ----
    await walkStep(page, testInfo, 'missing-half-refused', async () => {
      let doorCalls = 0;
      const counter = (request: { url(): string; method(): string }) => {
        if (request.url().endsWith('/api/session') && request.method() === 'POST') doorCalls += 1;
      };
      page.on('request', counter);
      try {
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').fill('');
        const submit = page.getByRole('button', { name: 'Sign in' });
        await expect(submit).toBeDisabled();
        // Both submit paths the browser offers: Enter inside a field (implicit submission) and a
        // force-click on the disabled button. A disabled control accepts neither - this is the
        // refusal the record names, before any credential check could run.
        await page.getByLabel('Email').press('Enter');
        await submit.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(500);
        recordAssertion(testInfo, {
          id: 'validation',
          expected: 'yes',
          observed: doorCalls === 0 ? 'yes' : 'no',
          note: doorCalls === 0
            ? 'With the password empty the submit stayed disabled; Enter and a forced click produced zero POST /api/session calls - refused before the credential check, exactly as fr.identity.sign-in\'s exception flow states.'
            : `${doorCalls} POST /api/session call(s) fired with an empty password - the missing half reached the door.`,
        });
      } finally {
        page.off('request', counter);
      }
    });

    // ---- record order 4: taken email is a conflict; the first pair still signs in ----
    await walkStep(page, testInfo, 'taken-email-conflict', async () => {
      await switchMode(page, 'register');
      const taken = await submitPair(page, 'register', email, otherPassword);
      const form = page.locator('form[data-state]');
      await expect(form).toHaveAttribute('data-state', 'refused', { timeout: 10_000 });
      const refusal = form.getByRole('alert');
      await expect(refusal).toBeVisible();
      const refusalText = (await refusal.innerText()).trim();
      const conflict = taken.status === 409 && taken.code === 'EMAIL_TAKEN';
      recordAssertion(testInfo, {
        id: 'errorFeedback',
        expected: 'yes',
        observed: conflict ? 'yes' : 'no',
        note: conflict
          ? `Re-registering ${email} answered 409 EMAIL_TAKEN and the form rendered the conflict refusal "${refusalText}".`
          : `Re-registering ${email} answered ${taken.status}/${taken.code} and rendered "${refusalText}" - not the conflict refusal fr.identity.sign-in names.`,
      });

      // "the first pair still signs in": switch back to sign-in mode and use the registered pair.
      await switchMode(page, 'sign-in');
      const signIn = await submitPair(page, 'sign-in', email, password);
      if (signIn.status !== 200) {
        recordAssertion(testInfo, {
          id: 'fr.identity.sign-in',
          expected: 'yes',
          observed: 'no',
          note: `The first pair was refused after the taken-email conflict (${signIn.status}/${signIn.code}).`,
        });
        return;
      }
      await expect(page.getByText(signedInLine(email))).toBeVisible({ timeout: 15_000 });
      await captureSession('session-2');
      recordAssertion(testInfo, {
        id: 'fr.identity.sign-in',
        expected: 'yes',
        observed: 'yes',
        note: 'After the EMAIL_TAKEN conflict the original pair still signed in; the account page shows the same person again.',
      });
    });

    // ---- record order 5: a second sign-in issues a new session for the same person ----
    await walkStep(page, testInfo, 'second-sign-in-new-session', async () => {
      await page.getByRole('button', { name: 'Sign out' }).click();
      await page.waitForResponse(r => r.url().endsWith('/api/session') && r.request().method() === 'DELETE', { timeout: 15_000 });
      await expect(page.locator('form[data-state]')).toBeVisible({ timeout: 15_000 });

      const second = tokens[1];
      if (second) {
        const answer = await verifyDoorAnswer(second);
        recordResource(testInfo, { action: 'deleted', kind: 'session', id: 'session-2', note: 'Revoked by the product sign-out.' });
        recordResource(testInfo, {
          action: 'verified-absent',
          kind: 'session',
          id: 'session-2',
          note: `Verify-door read-back after sign-out answered ${answer.status === 'refused' ? 'SESSION_INVALID (401)' : answer.status}.`,
        });
      }

      const signIn = await submitPair(page, 'sign-in', email, password);
      if (signIn.status !== 200) {
        recordAssertion(testInfo, {
          id: 'completion',
          expected: 'yes',
          observed: 'no',
          note: `The second sign-in was refused (${signIn.status}/${signIn.code}); no new session issued.`,
        });
        return;
      }
      await expect(page.getByText(signedInLine(email))).toBeVisible({ timeout: 15_000 });
      await captureSession('session-3');

      const tokenB = tokens[1];
      const tokenC = tokens[2];
      const fresh = typeof tokenC === 'string' && tokenC.length > 0 && tokenC !== tokenB;
      const verified = fresh ? await verifyDoorAnswer(tokenC as string) : { status: 'unreachable' as const };
      const samePerson = verified.status === 'live' && persons.length > 0 && verified.personId === persons[0];
      recordAssertion(testInfo, {
        id: 'ac.identity.sign-in.known-pair-issues-a-session-token',
        expected: 'yes',
        observed: fresh && verified.status === 'live' && samePerson ? 'yes' : 'no',
        note:
          `The second sign-in set a ${fresh ? 'different' : 'NOT different'} bearer than the first ` +
          `(ac.identity.sign-in.known-pair-issues-a-session-token); the verify door read the new bearer back ` +
          `${verified.status === 'live' ? `live for personId ${verified.personId}` : `as ${verified.status}`} - ` +
          `${samePerson ? 'the same person the account page keeps showing' : 'person match could not be confirmed'}.`,
      });
      recordAssertion(testInfo, {
        id: 'completion',
        expected: 'yes',
        observed: 'yes',
        note: `The account page again shows "${signedInLine(email)}" under the fresh session; session-3 stays live until the identity TTL (the walk's declared end state, per the record's cleanup note).`,
      });
    });
  });
});
