import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * scripts/live-proof.mjs - the executable answer to the question this example exists to survive:
 * does the migrated layout actually RUN at nivo-shape on a second repo? It walks the full checkout
 * flow against the two services started on the host (see .starcistacks/dev/README.md `up`),
 * exercising exactly the seams the records claim:
 *
 *   identity: register (demo door), sign-in (fr.identity.sign-in), /health with real dependencies
 *   order:    session verification against identity over real HTTP (sds.checkout.order-flow),
 *             cart upsert, confirmation (t-stock/t-pay/t-confirm), the idempotency replay, the
 *             insufficient-stock refusal, the empty-cart refusal, the unauthenticated refusals
 *   contract: order-for-identity - GET /accounts/:personId on identity answering hasOrders, which
 *             identity can only know by asking order over real HTTP. Nothing is shared between
 *             the two services but the database *names*, and even those are disjoint schemas.
 *
 * Every number (port, total, stock) is derived from metadata.json or the catalog the migrations
 * seeded - nothing here is a fixture, and any refusal exits non-zero naming its step.
 * Run with --expect-down against a stopped stack to see the honest negative first.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

function loadPorts() {
  const file = join(repoRoot, 'metadata.json');
  if (!existsSync(file)) throw new Error(`no metadata.json at ${file}`);
  return JSON.parse(readFileSync(file, 'utf8')).ports;
}

const ports = loadPorts();
const IDENTITY = `http://127.0.0.1:${ports.identityApi}`;
const ORDER = `http://127.0.0.1:${ports.orderApi}`;

const steps = [];
let failures = 0;

async function step(name, run) {
  try {
    const note = await run();
    steps.push({ name, ok: true });
    console.log(`PASS ${name}${note ? ` (${note})` : ''}`);
  } catch (error) {
    failures += 1;
    steps.push({ name, ok: false });
    console.log(`FAIL ${name}: ${String(error?.message ?? error)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function okStatus(status) {
  return status === 200 || status === 201;
}

async function http(base, method, path, { body, token, headers } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(5000),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* empty or non-JSON answers are legal for refusals */
  }
  return { status: response.status, payload };
}

async function addLine(token, productId, quantity) {
  const added = await http(ORDER, 'POST', '/cart/items', { token, body: { productId, quantity } });
  assert(added.status === 200 || added.status === 201, `add ${productId} x${quantity} answered ${added.status}`);
  return added.payload.item;
}

async function cartLines(token, lines) {
  await http(ORDER, 'DELETE', '/cart', { token });
  for (const line of lines) await addLine(token, line.productId, line.quantity);
}

const email = `proof-${Date.now()}@ecommerce.dev`;
const password = 'live-proof-password';
const run = process.argv.slice(2);

if (run.includes('--expect-down')) {
  // The honest negative: against a down stack every door must refuse, not hang or fake ok.
  let reached = 0;
  for (const base of [IDENTITY, ORDER]) {
    try {
      const { status } = await http(base, 'GET', '/health');
      if (status === 200) reached += 1;
    } catch {
      /* refused - expected */
    }
  }
  if (reached === 0) {
    console.log('OK down-stack: both services refuse, no answer was faked');
    process.exitCode = 0;
  } else {
    console.log(`FAIL down-stack: ${reached} service(s) answered while the stack was supposed to be down`);
    process.exitCode = 1;
  }
} else {
  await step('health: identity answers ok with real Postgres+Redis behind it', async () => {
    const { status, payload } = await http(IDENTITY, 'GET', '/health');
    assert(status === 200 && payload?.status === 'ok', `identity /health answered ${status} ${JSON.stringify(payload)}`);
    return JSON.stringify(payload.checks);
  });

  await step('health: order answers ok and its identity check is a real HTTP call', async () => {
    const { status, payload } = await http(ORDER, 'GET', '/health');
    assert(status === 200 && payload?.status === 'ok', `order /health answered ${status} ${JSON.stringify(payload)}`);
    return JSON.stringify(payload.checks);
  });

  let personId = '';
  let sessionToken = '';
  await step('ac.identity.sign-in.known-pair-issues-a-session-token on the wire', async () => {
    const registered = await http(IDENTITY, 'POST', '/auth/register', { body: { email, password } });
    assert(okStatus(registered.status), `register answered ${registered.status}`);
    personId = registered.payload.personId;
    const signedIn = await http(IDENTITY, 'POST', '/auth/sign-in', { body: { email, password } });
    assert(okStatus(signedIn.status), `sign-in answered ${signedIn.status}`);
    sessionToken = signedIn.payload.sessionToken;
    assert(typeof sessionToken === 'string' && sessionToken.length > 20, 'no session token came back');
    return personId;
  });

  await step('ac.identity.sign-in.wrong-pair-is-refused-alike on the wire', async () => {
    const wrongPassword = await http(IDENTITY, 'POST', '/auth/sign-in', { body: { email, password: 'not-the-password' } });
    const unknownEmail = await http(IDENTITY, 'POST', '/auth/sign-in', { body: { email: `ghost-${Date.now()}@ecommerce.dev`, password } });
    assert(wrongPassword.status === 401 && unknownEmail.status === 401, `refusals were ${wrongPassword.status}/${unknownEmail.status}`);
    assert(JSON.stringify(wrongPassword.payload) === JSON.stringify(unknownEmail.payload), 'the two refusals were distinguishable');
  });

  await step('contract.checkout.order-for-identity: a fresh person has no orders (identity asks order over HTTP)', async () => {
    const before = await http(IDENTITY, 'GET', `/accounts/${personId}`);
    assert(before.status === 200, `accounts answered ${before.status}`);
    assert(before.payload.hasOrders === false, `fresh person came back a buyer: ${JSON.stringify(before.payload)}`);
  });

  await step('sds.checkout.order-flow: an unauthenticated cart read is refused at the door', async () => {
    const { status, payload } = await http(ORDER, 'GET', '/cart');
    assert(status === 401 && payload?.code === 'SESSION_INVALID', `cart without a token answered ${status} ${JSON.stringify(payload)}`);
    const bad = await http(ORDER, 'GET', '/cart', { token: 'not-a-live-session' });
    assert(bad.status === 401, `wrong token answered ${bad.status}`);
  });

  await step('sds.checkout.order-flow: the live session verifies through identity and the cart opens', async () => {
    const good = await http(ORDER, 'GET', '/cart', { token: sessionToken });
    assert(good.status === 200, `live token answered ${good.status}`);
    assert(Array.isArray(good.payload.catalog) && good.payload.catalog.length === 3, 'the seeded catalog did not arrive');
    return `catalog: ${good.payload.catalog.map((p) => `${p.id}=${p.stock}`).join(' ')}`;
  });

  await step('fr.checkout.place-order: adding the same product twice accumulates one line', async () => {
    await cartLines(sessionToken, [{ productId: 'sku-mug', quantity: 2 }]);
    const again = await addLine(sessionToken, 'sku-mug', 1);
    assert(again.quantity === 3, `upsert did not accumulate: ${JSON.stringify(again)}`);
  });

  await step('ac.checkout.place-order.empty-cart-is-refused', async () => {
    await http(ORDER, 'DELETE', '/cart', { token: sessionToken });
    const refused = await http(ORDER, 'POST', '/orders', { token: sessionToken });
    assert(refused.status === 400 && refused.payload?.code === 'CHECKOUT_REFUSED' && refused.payload.reason === 'cart-empty',
      `empty confirmation answered ${refused.status} ${JSON.stringify(refused.payload)}`);
  });

  await step('ac.checkout.place-order.stock-is-checked-at-confirmation: a beyond-stock line refuses by name and changes nothing', async () => {
    const before = await http(ORDER, 'GET', '/cart', { token: sessionToken });
    const stockBefore = Object.fromEntries(before.payload.catalog.map((p) => [p.id, p.stock]));
    await cartLines(sessionToken, [{ productId: 'sku-mug', quantity: 2 }, { productId: 'sku-thermos', quantity: 1000 }]);
    const refused = await http(ORDER, 'POST', '/orders', { token: sessionToken });
    assert(refused.status === 409 && refused.payload?.reason === 'insufficient-stock' && refused.payload.productId === 'sku-thermos',
      `beyond-stock confirmation answered ${refused.status} ${JSON.stringify(refused.payload)}`);
    const cart = await http(ORDER, 'GET', '/cart', { token: sessionToken });
    assert(cart.payload.items.some((line) => line.productId === 'sku-thermos'), 'the refused cart lost its line');
    for (const [id, stock] of Object.entries(stockBefore)) {
      const now = cart.payload.catalog.find((p) => p.id === id).stock;
      assert(now === stock, `the refused confirmation moved stock for ${id}: ${stock} -> ${now}`);
    }
  });

  let orderId = '';
  let expectedTotal = 0;
  await step('sds.checkout.order-flow t-confirm: the confirmation writes order, payment and stock, and clears the cart', async () => {
    const before = await http(ORDER, 'GET', '/cart', { token: sessionToken });
    const mug = before.payload.catalog.find((p) => p.id === 'sku-mug');
    expectedTotal = mug.priceMinorUnits * 2;
    await cartLines(sessionToken, [{ productId: 'sku-mug', quantity: 2 }]);
    const placed = await http(ORDER, 'POST', '/orders', { token: sessionToken, headers: { 'idempotency-key': 'live-proof-key-1' } });
    assert(okStatus(placed.status), `confirmation answered ${placed.status} ${JSON.stringify(placed.payload)}`);
    assert(placed.payload.status === 'confirmed', `confirmation answered ${placed.payload.status}`);
    assert(placed.payload.totalMinorUnits === expectedTotal, `total ${placed.payload.totalMinorUnits} != ${expectedTotal}`);
    assert(placed.payload.replayed === false, 'a first confirmation must not present itself as a replay');
    assert(typeof placed.payload.paymentId === 'string' && placed.payload.paymentId.length > 10, 'no payment was captured');
    orderId = placed.payload.orderId;
    const after = await http(ORDER, 'GET', '/cart', { token: sessionToken });
    assert(after.payload.items.length === 0, 'the confirmed cart was not cleared');
    const mugNow = after.payload.catalog.find((p) => p.id === 'sku-mug').stock;
    assert(mugNow === mug.stock - 2, `stock did not move: ${mug.stock} -> ${mugNow}`);
    return `order ${orderId}, total ${expectedTotal}`;
  });

  await step('sds.checkout.order-flow: a replayed Idempotency-Key returns the first answer, not a second order', async () => {
    const replay = await http(ORDER, 'POST', '/orders', { token: sessionToken, headers: { 'idempotency-key': 'live-proof-key-1' } });
    assert(okStatus(replay.status), `replay answered ${replay.status}`);
    assert(replay.payload.orderId === orderId, 'the replay returned a different order');
    assert(replay.payload.replayed === true, 'the replay did not present itself as a replay');
  });

  await step('br.checkout.place-order: the same Idempotency-Key belongs to a person, not to the whole catalog', async () => {
    // A second, fresh person reusing this run's key gets their own first answer - never the first
    // person's order. This is what makes the proof repeatable against the same dev database.
    const otherEmail = `proof-other-${Date.now()}@ecommerce.dev`;
    const registered = await http(IDENTITY, 'POST', '/auth/register', { body: { email: otherEmail, password } });
    assert(okStatus(registered.status), `register (other person) answered ${registered.status}`);
    const signedIn = await http(IDENTITY, 'POST', '/auth/sign-in', { body: { email: otherEmail, password } });
    assert(okStatus(signedIn.status), `sign-in (other person) answered ${signedIn.status}`);
    const otherToken = signedIn.payload.sessionToken;
    await cartLines(otherToken, [{ productId: 'sku-notebook', quantity: 1 }]);
    const placed = await http(ORDER, 'POST', '/orders', { token: otherToken, headers: { 'idempotency-key': 'live-proof-key-1' } });
    assert(okStatus(placed.status), `other person's confirmation answered ${placed.status} ${JSON.stringify(placed.payload)}`);
    assert(placed.payload.replayed === false, "the other person's first confirmation came back as someone else's replay");
    assert(placed.payload.orderId !== orderId, 'the shared key string returned the first person\'s order');
    return `other order ${placed.payload.orderId}`;
  });

  await step('ac.checkout.place-order.becomes-a-buyer: identity learns the person has orders', async () => {
    const after = await http(IDENTITY, 'GET', `/accounts/${personId}`);
    assert(after.status === 200, `accounts answered ${after.status}`);
    assert(after.payload.hasOrders === true, `the buyer is not a buyer: ${JSON.stringify(after.payload)}`);
  });

  const passed = steps.length - failures;
  console.log(`\nlive-proof: ${passed}/${steps.length} steps passed`);
  process.exitCode = failures === 0 ? 0 : 1;
}
