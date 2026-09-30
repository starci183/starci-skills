import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * scripts/live-proof.mjs - walks the checkout flow against the two services started on the host (see
 * .starcistacks/dev/README.md `up`), through the public GraphQL doors only:
 *
 *   identity: register, signIn (a wrong pair and an unknown email refuse alike), /health with real dependencies
 *   order:    the bearer token is verified against identity over real GraphQL, cart upsert, confirmation,
 *             the idempotency replay, the insufficient-stock and empty-cart refusals, the unauthenticated refusal
 *   contract: identity `account` answers hasOrders, which identity can only know by asking order's `buyerStatus`
 *             with the caller's own bearer token.
 *
 * The catalog comes from `.starcistacks/dev/seeds/order-catalog.sql`, applied once after `npm run migrate`. Ports
 * are read from `.starcistacks/dev/infra/metadata.json`. Any refusal exits non-zero naming its step; run with
 * --expect-down against a stopped stack to see the honest negative first.
 */

const here = dirname(fileURLToPath(import.meta.url));
const metadata = join(resolve(here, '..'), '.starcistacks', 'dev', 'infra', 'metadata.json');
if (!existsSync(metadata)) throw new Error(`no metadata.json at ${metadata}`);
const { ports } = JSON.parse(readFileSync(metadata, 'utf8'));
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

/** One GraphQL call; answers the data and the first error (code and params), or the HTTP status of a non-GraphQL answer. */
async function gql(base, query, variables, token) {
  const response = await fetch(`${base}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(5000),
  });
  const payload = await response.json().catch(() => null);
  const error = payload?.errors?.[0];
  return { status: response.status, data: payload?.data ?? null, code: error?.extensions?.code ?? null, params: error?.extensions?.params ?? {} };
}

async function health(base) {
  const response = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) });
  return { status: response.status, payload: await response.json().catch(() => null) };
}

const REGISTER = 'mutation ($input: RegisterInput!) { register(input: $input) { personId } }';
const SIGN_IN = 'mutation ($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }';
const ACCOUNT = '{ account { personId email hasOrders } }';
const CART = '{ cart { items { productId quantity } catalog { id name priceMinorUnits stock } } }';
const ADD = 'mutation ($input: AddCartItemInput!) { addCartItem(input: $input) { item { productId quantity } } }';
const CLEAR = 'mutation { clearCart { cleared } }';
const PLACE = 'mutation ($input: PlaceOrderInput!) { placeOrder(input: $input) { orderId status totalMinorUnits currency paymentId replayed } }';

async function cartLines(token, lines) {
  await gql(ORDER, CLEAR, {}, token);
  for (const line of lines) {
    const added = await gql(ORDER, ADD, { input: line }, token);
    assert(added.data?.addCartItem, `add ${line.productId} x${line.quantity} answered ${added.code ?? added.status}`);
  }
}

async function newBuyer(tag, password) {
  const email = `proof-${tag}-${Date.now()}@ecommerce.dev`;
  const registered = await gql(IDENTITY, REGISTER, { input: { email, password } });
  assert(registered.data?.register, `register answered ${registered.code ?? registered.status}`);
  const signedIn = await gql(IDENTITY, SIGN_IN, { input: { email, password } });
  assert(signedIn.data?.signIn, `signIn answered ${signedIn.code ?? signedIn.status}`);
  return { email, personId: registered.data.register.personId, token: signedIn.data.signIn.sessionToken };
}

const password = `live-proof-${Date.now()}`;

if (process.argv.slice(2).includes('--expect-down')) {
  // The honest negative: against a down stack every door must refuse, not hang or fake ok.
  let reached = 0;
  for (const base of [IDENTITY, ORDER]) {
    try {
      if ((await health(base)).status === 200) reached += 1;
    } catch {
      /* refused - expected */
    }
  }
  console.log(reached === 0 ? 'OK down-stack: both services refuse, no answer was faked' : `FAIL down-stack: ${reached} service(s) answered`);
  process.exitCode = reached === 0 ? 0 : 1;
} else {
  await step('health: identity answers ok with real Postgres and Redis behind it', async () => {
    const { status, payload } = await health(IDENTITY);
    assert(status === 200 && payload?.status === 'ok', `identity /health answered ${status} ${JSON.stringify(payload)}`);
    return JSON.stringify(payload.checks);
  });

  await step('health: order answers ok and its identity check is a real HTTP call', async () => {
    const { status, payload } = await health(ORDER);
    assert(status === 200 && payload?.status === 'ok', `order /health answered ${status} ${JSON.stringify(payload)}`);
    return JSON.stringify(payload.checks);
  });

  let buyer;
  await step('identity: register then signIn issues a session token', async () => {
    buyer = await newBuyer('main', password);
    assert(typeof buyer.token === 'string' && buyer.token.length > 20, 'no session token came back');
    return buyer.personId;
  });

  await step('identity: a wrong password and an unknown email are refused alike', async () => {
    const wrongPassword = await gql(IDENTITY, SIGN_IN, { input: { email: buyer.email, password: `${password}-wrong` } });
    const unknownEmail = await gql(IDENTITY, SIGN_IN, { input: { email: `ghost-${Date.now()}@ecommerce.dev`, password } });
    assert(wrongPassword.code === 'ACCOUNT_INVALID_CREDENTIALS' && unknownEmail.code === wrongPassword.code, `refusals were ${wrongPassword.code}/${unknownEmail.code}`);
  });

  await step('contract: a fresh person has no orders (identity asks order with the caller token)', async () => {
    const before = await gql(IDENTITY, ACCOUNT, {}, buyer.token);
    assert(before.data?.account?.hasOrders === false, `fresh person came back ${JSON.stringify(before.data)} ${before.code ?? ''}`);
  });

  await step('order: a cart read without a live session is refused at the door', async () => {
    const anonymous = await gql(ORDER, CART, {});
    assert(anonymous.code === 'IDENTITY_UNAUTHENTICATED', `cart without a token answered ${anonymous.code ?? anonymous.status}`);
    const dead = await gql(ORDER, CART, {}, 'not-a-live-session');
    assert(dead.code === 'IDENTITY_UNAUTHENTICATED', `wrong token answered ${dead.code ?? dead.status}`);
  });

  await step('order: the live session verifies through identity and the cart opens', async () => {
    const good = await gql(ORDER, CART, {}, buyer.token);
    assert(good.data?.cart?.catalog?.length === 3, `the seeded catalog did not arrive: ${good.code ?? JSON.stringify(good.data)}`);
    return `catalog: ${good.data.cart.catalog.map((p) => `${p.id}=${p.stock}`).join(' ')}`;
  });

  await step('order: adding the same product twice accumulates one line', async () => {
    await cartLines(buyer.token, [{ productId: 'sku-mug', quantity: 2 }]);
    const again = await gql(ORDER, ADD, { input: { productId: 'sku-mug', quantity: 1 } }, buyer.token);
    assert(again.data?.addCartItem?.item?.quantity === 3, `upsert did not accumulate: ${JSON.stringify(again.data)}`);
  });

  await step('order: an empty cart is refused by name', async () => {
    await gql(ORDER, CLEAR, {}, buyer.token);
    const refused = await gql(ORDER, PLACE, { input: {} }, buyer.token);
    assert(refused.code === 'ORDER_CART_EMPTY', `empty confirmation answered ${refused.code ?? refused.status}`);
  });

  await step('order: a beyond-stock line refuses by name, keeps the cart and moves no stock', async () => {
    const before = await gql(ORDER, CART, {}, buyer.token);
    const stockBefore = Object.fromEntries(before.data.cart.catalog.map((p) => [p.id, p.stock]));
    await cartLines(buyer.token, [{ productId: 'sku-mug', quantity: 2 }, { productId: 'sku-thermos', quantity: 1000 }]);
    const refused = await gql(ORDER, PLACE, { input: {} }, buyer.token);
    assert(refused.code === 'ORDER_INSUFFICIENT_STOCK' && refused.params.productId === 'sku-thermos', `beyond-stock confirmation answered ${refused.code} ${JSON.stringify(refused.params)}`);
    const cart = await gql(ORDER, CART, {}, buyer.token);
    assert(cart.data.cart.items.some((line) => line.productId === 'sku-thermos'), 'the refused cart lost its line');
    for (const [id, stock] of Object.entries(stockBefore)) {
      const now = cart.data.cart.catalog.find((p) => p.id === id).stock;
      assert(now === stock, `the refused confirmation moved stock for ${id}: ${stock} -> ${now}`);
    }
  });

  let orderId = '';
  await step('order: the confirmation writes order, payment and stock, and clears the cart', async () => {
    const before = await gql(ORDER, CART, {}, buyer.token);
    const mug = before.data.cart.catalog.find((p) => p.id === 'sku-mug');
    await cartLines(buyer.token, [{ productId: 'sku-mug', quantity: 2 }]);
    const placed = await gql(ORDER, PLACE, { input: { idempotencyKey: 'live-proof-key-1' } }, buyer.token);
    const order = placed.data?.placeOrder;
    assert(order?.status === 'confirmed', `confirmation answered ${placed.code ?? JSON.stringify(placed.data)}`);
    assert(order.totalMinorUnits === mug.priceMinorUnits * 2, `total ${order.totalMinorUnits} != ${mug.priceMinorUnits * 2}`);
    assert(order.replayed === false && typeof order.paymentId === 'string', 'a first confirmation must not be a replay and must capture a payment');
    orderId = order.orderId;
    const after = await gql(ORDER, CART, {}, buyer.token);
    assert(after.data.cart.items.length === 0, 'the confirmed cart was not cleared');
    const mugNow = after.data.cart.catalog.find((p) => p.id === 'sku-mug').stock;
    assert(mugNow === mug.stock - 2, `stock did not move: ${mug.stock} -> ${mugNow}`);
    return `order ${orderId}`;
  });

  await step('order: a replayed idempotency key returns the first answer, not a second order', async () => {
    const replay = await gql(ORDER, PLACE, { input: { idempotencyKey: 'live-proof-key-1' } }, buyer.token);
    assert(replay.data?.placeOrder?.orderId === orderId && replay.data.placeOrder.replayed === true, `replay answered ${JSON.stringify(replay.data)}`);
  });

  await step('order: the same idempotency key belongs to a person, not to the whole catalog', async () => {
    const other = await newBuyer('other', password);
    await cartLines(other.token, [{ productId: 'sku-notebook', quantity: 1 }]);
    const placed = await gql(ORDER, PLACE, { input: { idempotencyKey: 'live-proof-key-1' } }, other.token);
    assert(placed.data?.placeOrder?.replayed === false && placed.data.placeOrder.orderId !== orderId, "the other person's first confirmation came back as someone else's replay");
    return `other order ${placed.data.placeOrder.orderId}`;
  });

  await step('contract: identity learns the person is a buyer', async () => {
    const after = await gql(IDENTITY, ACCOUNT, {}, buyer.token);
    assert(after.data?.account?.hasOrders === true, `the buyer is not a buyer: ${JSON.stringify(after.data)}`);
  });

  console.log(`\nlive-proof: ${steps.length - failures}/${steps.length} steps passed`);
  process.exitCode = failures === 0 ? 0 : 1;
}
