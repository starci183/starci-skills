// v7-7 lane re-proof: regenerate every in-scope ecommerce-app-be evidence.yaml with
// scripts/example-evidence.mjs, run from the ec-be cwd, so recordDigest + codeDigest are recomputed
// from the records as phase-1 left them. Assertion commands are the ones already on record (each one
// independently replayed by v7-7-replay.cjs before this ran), plus the e2e command each fr record's
// own requiresProof.e2e declares where it was missing.
//   node ex-testing/lint/scratch/v7-7-reprove.cjs
const cp = require('child_process');
const fs = require('fs');

const claude = 'D:\\Repositories\\starci-academy-backend\\.claude';
const WORK = 'examples/ecommerce-app-be/.starciwork';
const CWD = 'examples/ecommerce-app-be';
const E2E = 'npx jest --config src/tests/e2e/jest.config.js';

const RECORDS = [
  ['br.checkout.place-order', [
    ['ac.checkout.place-order.becomes-a-buyer', `${E2E} order-lifecycle`],
    ['ac.checkout.place-order.empty-cart-is-refused', 'npx jest -t ac.checkout.place-order.empty-cart-is-refused --runInBand'],
    ['ac.checkout.place-order.stock-is-checked-at-confirmation', 'npx jest -t ac.checkout.place-order.stock-is-checked-at-confirmation --runInBand'],
  ]],
  ['contract.checkout.order-for-identity', [
    ['provider', 'npx jest buyer.controller.spec --runInBand'],
    ['consumer', 'npx jest order.client.spec --runInBand'],
    ['wire', `${E2E} order-lifecycle`],
  ]],
  ['fr.checkout.place-order', [
    ['unit-composed-rules', 'npx jest -t fr.checkout.place-order --runInBand'],
    ['e2e', `${E2E} checkout/checkout-journey`],
    ['e2e-refusal-paths', `${E2E} order-lifecycle checkout/payment-failure`],
  ]],
  ['impl.checkout.ecommerce-app-be.order-checkout', [
    ['unit', 'npx jest src/modules/bussiness/order src/modules/bussiness/cart src/modules/bussiness/catalog src/modules/bussiness/payment src/modules/integrations/identity src/features/checkout --runInBand'],
    ['e2e', `${E2E} order-lifecycle checkout/payment-failure`],
  ]],
  ['sds.checkout.order-flow', [
    ['implementation', 'npx jest -t sds.checkout.order-flow --runInBand'],
    ['transitions', 'npx jest -t t-refuse --runInBand'],
    ['live-sequence', `${E2E} order-lifecycle`],
  ]],
  ['br.identity.sign-in', [
    ['ac.identity.sign-in.known-pair-issues-a-session-token', 'npx jest -t ac.identity.sign-in.known-pair-issues-a-session-token --runInBand'],
    ['ac.identity.sign-in.wrong-pair-is-refused-alike', 'npx jest -t ac.identity.sign-in.wrong-pair-is-refused-alike --runInBand'],
  ]],
  ['fr.identity.sign-in', [
    ['unit-composed-rules', 'npx jest -t fr.identity.sign-in --runInBand'],
    ['e2e', `${E2E} identity/sign-up-sign-in`],
  ]],
  ['impl.identity.ecommerce-app-be.identity-account', [
    ['unit', 'npx jest src/modules/bussiness/account src/modules/bussiness/session src/modules/integrations/order src/features/identity --runInBand'],
    ['e2e', `${E2E} identity/sign-up-sign-in order-lifecycle/cross-service-identity`],
  ]],
];

const LOG = claude + '\\ex-testing\\lint\\scratch\\v7-7-reprove.log';
fs.writeFileSync(LOG, '');
const log = (line) => { fs.appendFileSync(LOG, line + '\n'); console.log(line); };

for (const [record, assertions] of RECORDS) {
  const argv = ['scripts/example-evidence.mjs', '--work', WORK, '--record', record, '--cwd', CWD];
  for (const [id, command] of assertions) argv.push('--assert', `${id}=${command}`);
  let out = '';
  let failed = false;
  try {
    out = cp.execFileSync('node', argv, { cwd: claude, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    out = (error?.stdout || '') + (error?.stderr || '');
    failed = true;
  }
  log(`[${record}] ${failed ? 'NONZERO EXIT - evidence written with fail outcome' : 'ok'}\n${out.replace(/\n$/, '')}`);
}
log('REPROVE COMPLETE');
