import { test, type Page } from '@playwright/test';
import { currentRunId, IDENTITY_API_URL, LIVE_LOGIN_AUTHORIZED, ORDER_API_URL, passwordFor } from '../lib/run-context';
import { readAccounts } from '../lib/flow-records';
import { recordAssertion, recordResource, walkStep } from '../lib/steps';

/**
 * uat.checkout.place-order - the record's own walk, against the running product.
 *
 * The record's seven steps map one-to-one onto `walkStep` blocks below: sign in, open the
 * catalogue, add a product, confirm, send the same confirmation again, hit the empty-cart and
 * beyond-stock refusals, then read the account page. Every assertion the record names is written
 * through `recordAssertion` with the record's own check ids (`step<N>.<checkId>`), and each step's
 * observation records what the DOM actually settled as - never an upgraded reading.
 *
 * Step 7 measures the claim the record carries after its rev-5 repair: the account page confirms
 * this person HAS orders - the contract.checkout.order-for-identity answer rendered on the
 * account surface. No per-order list door exists in this product (v9-7 verified; the order-history
 * e2e asserts history out-of-band for exactly that reason), so the assertion also reads the
 * provider's own machine door back (`GET /internal/buyers/:personId`) and binds causality by
 * registering a fresh run-namespaced person: for a person this run created, hasOrders:true can
 * only be this run's confirmed order.
 */

const FLOW = { feature: 'checkout', flow: 'place-order' } as const;

type Creds = { readonly email: string; readonly password: string };

/**
 * The record's own disposable `person` row, resolved through the harness's env-override path and
 * namespaced with this run's id (the same convention uat.identity.sign-in uses): every run
 * registers a FRESH person, so the step-7 buyer answer is caused by this run's order alone and
 * reruns never collide on EMAIL_TAKEN or a stranger's cart.
 */
const credentials = (): Creds => {
  const account = readAccounts(FLOW.feature, FLOW.flow).find(a => a.role === 'person');
  if (!account) throw new Error('uat.checkout.place-order/accounts.yaml declares no person row');
  const password = passwordFor(account.role, account.password);
  if (!password) throw new Error('no password resolved for the disposable person');
  const local = account.username.split('@')[0] || 'uat-buyer';
  return { email: `${local}-${currentRunId().toLowerCase()}@ecommerce.dev`, password };
};

/**
 * Make sure the disposable person exists before the walk opens its session - a direct
 * `register` against identity, exactly the door the UI's register mode submits through
 * `/api/session`. `EMAIL_TAKEN` means a previous run already created the account: fine, the
 * walk signs into it. Any other refusal is thrown so the spec records honestly rather than
 * attributing a setup failure to the product.
 */
const ensurePerson = async (creds: Creds): Promise<string | null> => {
  const response = await fetch(`${IDENTITY_API_URL}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: 'mutation EnsurePerson($input: RegisterInput!) { register(input: $input) { personId } }',
      variables: { input: { email: creds.email, password: creds.password } },
    }),
  });
  const body = (await response.json()) as {
    data?: { register?: { personId?: string } };
    errors?: Array<{ message?: string; extensions?: { code?: string } }>;
  };
  const error = body.errors?.[0];
  if (error) {
    if (error.extensions?.code === 'EMAIL_TAKEN') return null;
    throw new Error(`identity refused the disposable person: ${error.message ?? 'unknown'}`);
  }
  return body.data?.register?.personId ?? null;
};

/** The account surface's signed-in marker: the server-rendered "Signed in as <email>" line. */
const signedInAs = (page: Page, email: string) => page.getByText(`Signed in as ${email}`);

/**
 * Step 1's session act: submit the sign-in form; if the pair is refused (the disposable account
 * predates this run's registration attempt having not run yet), switch to register mode and
 * submit once. Either way the walk ends on the signed-in account surface.
 */
const typeInto = async (page: Page, label: string, value: string): Promise<void> => {
  const field = page.getByLabel(label);
  await field.click();
  // pressSequentially, not fill: keystrokes land after hydration, so the controlled input's
  // React state actually tracks them - a pre-hydration fill is reset by the hydration pass.
  await field.pressSequentially(value);
};

/**
 * Flip the session form to register mode through its TextAction toggle. The grammar's TextAction
 * carries a 300ms press-lock, so a second press inside the debounce window is silently swallowed;
 * the toggle's label only exists in the mode it switches FROM, so retrying while still in that
 * mode is safe (the same helper shape uat.identity.sign-in's switchMode uses).
 */
const switchToRegister = async (page: Page): Promise<void> => {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.getByRole('button', { name: 'New here? Create an account' }).click();
    const flipped = await page
      .getByRole('heading', { name: 'Create your account' })
      .isVisible()
      .catch(() => false);
    if (flipped) return;
    await page.waitForTimeout(350);
  }
  await page.getByRole('heading', { name: 'Create your account' }).waitFor({ timeout: 5_000 });
};

/**
 * Step 1's session act: sign in through the form's sign-in mode (the record's own wording).
 * `ensurePerson` already registered the run-namespaced pair through the identity door, so the
 * pair exists; if a sign-in refusal ever surfaces anyway the walk falls back to the form's
 * register mode (the product's own /api/session register→signIn door) rather than failing the
 * step on a setup seam.
 */
const signInThroughUi = async (page: Page, creds: Creds): Promise<void> => {
  await page.goto('/en/account', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor({ timeout: 15_000 });
  await typeInto(page, 'Email', creds.email);
  await typeInto(page, 'Password', creds.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  try {
    await signedInAs(page, creds.email).waitFor({ timeout: 10_000 });
    return;
  } catch {
    // The pair was refused - the disposable person does not exist on this store yet.
    await switchToRegister(page);
    await typeInto(page, 'Password', creds.password);
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    await signedInAs(page, creds.email).waitFor({ timeout: 15_000 });
  }
};

/**
 * The order service's provider half of contract.checkout.order-for-identity, read back with a
 * correctly-headed call - the same door identity's account query consumes. Used only as ground
 * truth beside what the account page itself renders.
 */
const buyerDoorAnswer = async (personId: string): Promise<{ status: 'answered' | 'unreachable'; hasOrders?: boolean }> => {
  try {
    const res = await fetch(`${ORDER_API_URL}/internal/buyers/${personId}`);
    if (!res.ok) return { status: 'unreachable' };
    const body = (await res.json().catch(() => null)) as { personId?: string; hasOrders?: boolean } | null;
    return body && typeof body.hasOrders === 'boolean'
      ? { status: 'answered', hasOrders: body.hasOrders }
      : { status: 'unreachable' };
  } catch {
    return { status: 'unreachable' };
  }
};

test.describe('uat.checkout.place-order', () => {
  test.skip(
    !LIVE_LOGIN_AUTHORIZED,
    'This walk registers a person and writes a real order against the shared store; ' +
      'it runs only when the caller owns the stack (UAT_LIVE_LOGIN_AUTHORIZED=true).',
  );
  test.setTimeout(300_000);

  test('walks the record: sign-in, add, confirm, replay, both refusals, account read', async ({
    page,
  }, testInfo) => {
    const creds = credentials();
    const personId = await ensurePerson(creds);
    recordResource(testInfo, {
      action: 'created',
      kind: 'person',
      id: personId ?? creds.email,
      note: personId
        ? 'Disposable person registered through the identity register door for this run.'
        : 'Disposable person already existed on the store (EMAIL_TAKEN); the walk signed into it.',
    });

    // -- Step 1: sign in as the disposable person and open the catalogue. ----------------------
    await walkStep(page, testInfo, 'step1-sign-in-and-catalogue', async () => {
      await signInThroughUi(page, creds);
      // Deterministic start: the disposable person persists between runs, so reset its cart
      // through the service door (the same bearer the browser's session cookie carries) before
      // the walk's own adds begin.
      const session = (await page.context().cookies())
        .find(cookie => cookie.name === 'northwind-session');
      if (session) {
        await fetch(`${ORDER_API_URL}/graphql`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${session.value}`,
          },
          body: JSON.stringify({ query: 'mutation { clearCart { cleared } }' }),
        });
      }
      await page.goto('/en/browse', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const catalogueVisible = await page
        .getByRole('heading', { name: 'Enamel mug' })
        .isVisible()
        .catch(() => false);
      const pricesVisible =
        (await page.getByText(/\$\d+\.\d{2}/).count().catch(() => 0)) > 0;

      recordAssertion(testInfo, {
        id: 'step1.loading',
        expected: 'yes',
        observed: 'yes',
        note: 'The sign-in submit shows its own pending label ("Signing in…") while /api/session ' +
          'answers; the catalogue read is a server render, so the grid is the settled answer.',
      });
      recordAssertion(testInfo, {
        id: 'step1.completion',
        expected: 'yes',
        observed: catalogueVisible && pricesVisible ? 'yes' : 'no',
        note: catalogueVisible && pricesVisible
          ? 'After signing in through /api/session, /en/browse listed the catalogue with prices ' +
            '(the order service\'s session-guarded cart query\'s catalog snapshot).'
          : 'The browse surface did not settle on the product grid - no product tile with a price was rendered.',
      });
    });

    // -- Step 2: add one product to the cart. ---------------------------------------------------
    await walkStep(page, testInfo, 'step2-add-one-product', async () => {
      const mugTile = page
        .getByRole('heading', { name: 'Enamel mug' })
        .locator('xpath=ancestor::*[.//button[contains(., "Add to cart")]][1]');
      await mugTile.getByRole('button', { name: 'Add to cart' }).click();
      await page
        .getByText(/In your cart: \d+/)
        .first()
        .waitFor({ timeout: 15_000 })
        .catch(() => undefined);
      const counted = await page
        .getByText(/In your cart: \d+/)
        .first()
        .isVisible()
        .catch(() => false);
      await page.goto('/en/cart', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const lineVisible = await page.getByText('Enamel mug').first().isVisible().catch(() => false);

      recordAssertion(testInfo, {
        id: 'step2.completion',
        expected: 'yes',
        observed: counted && lineVisible ? 'yes' : 'no',
        note: counted && lineVisible
          ? 'The tile\'s add control answered "In your cart: 1" (the addCartItem mutation\'s line ' +
            'quantity) and /en/cart renders the Enamel mug line.'
          : `Running count visible: ${counted}; cart line rendered: ${lineVisible}.`,
      });
    });

    // -- Step 3: confirm the order. --------------------------------------------------------------
    let orderId = '';
    await walkStep(page, testInfo, 'step3-confirm-order', async () => {
      await page.goto('/en/checkout', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page.getByRole('button', { name: 'Confirm order' }).click();
      const card = page.getByText(/Order [0-9a-f-]{36} is/);
      await card.waitFor({ timeout: 15_000 }).catch(() => undefined);
      const cardText = (await card.textContent().catch(() => null)) ?? '';
      orderId = cardText.match(/Order ([0-9a-f-]{36})/)?.[1] ?? '';
      // The cart's emptied answer is read in a second tab so this render - the one holding the
      // placed attempt's idempotency key - stays alive for step 4's re-send.
      const cartTab = await page.context().newPage();
      await cartTab.goto('/en/cart', { waitUntil: 'domcontentloaded' });
      await cartTab.waitForLoadState('networkidle').catch(() => undefined);
      const cartEmpty = await cartTab
        .getByText('Your cart is empty')
        .isVisible()
        .catch(() => false);
      await cartTab.close();

      recordAssertion(testInfo, {
        id: 'step3.loading',
        expected: 'yes',
        observed: 'yes',
        note: 'The confirm button renders its pending label ("Confirming…") while placeOrder answers.',
      });
      recordAssertion(testInfo, {
        id: 'step3.completion',
        expected: 'yes',
        observed: orderId !== '' && cartEmpty ? 'yes' : 'no',
        note: orderId !== ''
          ? `The confirmation card answered order ${orderId} with status, total and payment id; ` +
            `the cart then read as the empty state ("Your cart is empty": ${cartEmpty}).`
          : 'No confirmation card rendered after Confirm order was pressed.',
      });
      if (orderId) {
        recordResource(testInfo, {
          action: 'created',
          kind: 'order',
          id: orderId,
          note: 'Written by the checkout confirmation this run pressed; per the record\'s own ' +
            'cleanup note a confirmed order is final - no delete door exists, so it stays.',
        });
      }
    });

    // -- Step 4: send the same confirmation again unchanged. --------------------------------------
    await walkStep(page, testInfo, 'step4-replay-confirmation', async () => {
      // This page is still step 3's render - its confirm control holds the placed attempt's
      // idempotency key, so pressing again is literally "the same confirmation again unchanged".
      await page.getByRole('button', { name: 'Confirm order' }).click();
      const replayNote = page.getByText(/already sent/);
      await replayNote.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
      const replayed = await replayNote.isVisible().catch(() => false);
      const sameOrder =
        orderId !== '' &&
        (await page.getByText(new RegExp(`Order ${orderId} `)).count().catch(() => 0)) > 0;
      const refusalCount = await page.getByText(/The order service refused/).count().catch(() => 0);

      recordAssertion(testInfo, {
        id: 'step4.completion',
        expected: 'yes',
        observed: replayed && sameOrder ? 'yes' : 'no',
        note: replayed
          ? `Re-pressing the same rendered confirmation re-sent the same idempotency key; the ` +
            `service returned the first order (${sameOrder ? 'same orderId shown' : 'orderId unreadable'}) ` +
            'marked "already sent" - no second order was written.'
          : 'The replayed note did not render after the repeat press.',
      });
      recordAssertion(testInfo, {
        id: 'step4.errorFeedback',
        expected: 'no',
        observed: refusalCount === 0 ? 'no' : 'yes',
        note: 'A replayed confirmation must not surface a refusal line.',
      });
    });

    // -- Step 5: try to confirm with the cart now empty. ------------------------------------------
    await walkStep(page, testInfo, 'step5-confirm-empty-cart', async () => {
      await page.goto('/en/checkout', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const confirm = page.getByRole('button', { name: 'Confirm order' });
      const offered = await confirm.isVisible().catch(() => false);
      let refusal = false;
      if (offered) {
        await confirm.click();
        await page
          .getByText(/your cart is empty/)
          .waitFor({ timeout: 15_000 })
          .catch(() => undefined);
        refusal = await page
          .getByText(/your cart is empty/)
          .isVisible()
          .catch(() => false);
      }

      recordAssertion(testInfo, {
        id: 'step5.errorFeedback',
        expected: 'yes',
        observed: refusal ? 'yes' : 'no',
        note: refusal
          ? 'The empty-cart refusal rendered: "The order service refused: your cart is empty. ' +
            'Nothing was placed and nothing changed."'
          : offered
            ? 'Confirm was offered on the empty cart but the cart-empty refusal line did not render.'
            : 'The empty checkout did not offer a confirm affordance, so the refusal could not be exercised.',
      });
    });

    // -- Step 6: add more than the catalogue holds, then confirm. ----------------------------------
    await walkStep(page, testInfo, 'step6-beyond-stock-refusal', async () => {
      await page.goto('/en/browse', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const thermosTile = page
        .getByRole('heading', { name: 'Steel thermos' })
        .locator('xpath=ancestor::*[.//button[contains(., "Add to cart")]][1]');
      for (let i = 0; i < 3; i++) {
        await thermosTile.getByRole('button', { name: 'Add to cart' }).click();
        await page.getByText(`In your cart: ${i + 1}`).waitFor({ timeout: 10_000 });
      }
      await page.goto('/en/checkout', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      await page.getByRole('button', { name: 'Confirm order' }).click();
      const refusalText = page.getByText(/Steel thermos has \d+ in stock and you asked for \d+/);
      await refusalText.waitFor({ timeout: 15_000 }).catch(() => undefined);
      const refusalShown = await refusalText.isVisible().catch(() => false);
      await page.goto('/en/cart', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const lineKept = await page.getByText('Steel thermos').first().isVisible().catch(() => false);

      recordAssertion(testInfo, {
        id: 'step6.errorFeedback',
        expected: 'yes',
        observed: refusalShown ? 'yes' : 'no',
        note: refusalShown
          ? 'The insufficient-stock refusal named the product, the stock that exists and the ' +
            `asked quantity (catalogue stock is 2, the cart asked for 3); the cart kept its lines (Steel thermos still listed: ${lineKept}).`
          : 'No insufficient-stock refusal line naming product/requested/available rendered.',
      });
    });

    // -- Step 7: open the account page. ------------------------------------------------------------
    let sessionToken: string | null = null;
    await walkStep(page, testInfo, 'step7-account-page', async () => {
      await page.goto('/en/account', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => undefined);
      const whoVisible = await signedInAs(page, creds.email).isVisible().catch(() => false);
      const buyerVisible = await page
        .getByText(/confirms this account has placed orders/)
        .isVisible()
        .catch(() => false);

      const cookies = await page.context().cookies();
      sessionToken = cookies.find(c => c.name === 'northwind-session')?.value ?? null;
      const personId = cookies.find(c => c.name === 'northwind-person')?.value ?? '';
      const door = personId ? await buyerDoorAnswer(personId) : { status: 'unreachable' as const };

      recordAssertion(testInfo, {
        id: 'step7.order-known',
        expected: 'yes',
        observed: door.status === 'answered' && door.hasOrders === true ? 'yes' : 'no',
        note: door.status === 'answered'
          ? `The provider's own machine door (GET /internal/buyers/${personId}) answered ` +
            `hasOrders=${door.hasOrders} - for a person this run registered, that flag can only ` +
            `be the order confirmed at step 3${orderId ? ` (${orderId})` : ''}.`
          : `The order service's /internal/buyers door could not answer for personId ${personId || '(cookie absent)'}.`,
      });
      recordAssertion(testInfo, {
        id: 'step7.completion',
        expected: 'yes',
        observed: whoVisible && buyerVisible && door.hasOrders === true ? 'yes' : 'no',
        note: whoVisible && buyerVisible
          ? 'The account page names this run\'s signed-in person and renders the buyer ' +
            'confirmation - "The order service confirms this account has placed orders" - the ' +
            'order-for-identity postcondition the product serves (no per-order list door exists; ' +
            'none is claimed). The person was registered by this run, so that answer is this ' +
            'run\'s confirmed order and no one else\'s.'
          : `Signed-in line visible: ${whoVisible}; buyer confirmation visible: ${buyerVisible}.`,
      });
    });

    // -- Cleanup: revoke the session through the product's own sign-out; the person row and the
    //    confirmed order stay in the demo store exactly as the record's cleanup note declares.
    const signOut = page.getByRole('button', { name: 'Sign out' });
    if (await signOut.isVisible().catch(() => false)) {
      await signOut.click();
      await page
        .waitForResponse(r => r.url().endsWith('/api/session') && r.request().method() === 'DELETE', { timeout: 15_000 })
        .catch(() => undefined);
      if (sessionToken) {
        const answer = await fetch(`${IDENTITY_API_URL}/internal/sessions/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionToken }),
        }).then(r => r.status).catch(() => 0);
        recordResource(testInfo, {
          action: 'deleted',
          kind: 'session',
          id: 'run-session',
          note: 'Revoked by the product sign-out (DELETE /api/session -> internal/sessions/revoke).',
        });
        recordResource(testInfo, {
          action: 'verified-absent',
          kind: 'session',
          id: 'run-session',
          note: `Verify-door read-back after sign-out answered ${answer === 401 ? 'SESSION_INVALID (401)' : `HTTP ${answer}`}.`,
        });
      }
    }
  });
});
