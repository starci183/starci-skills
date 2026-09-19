// v7-7 replay harness: re-runs each DISTINCT assertion command recorded in the 8 in-scope
// ecommerce-app-be evidence.yaml files, from the ec-be cwd, and reports the real exit code plus the
// jest summary lines, so a `-t <pattern>` that matches no test (jest exits 0 on that) is visible as a
// vacuous pass instead of being trusted.
//   node ex-testing/lint/scratch/v7-7-replay.cjs unit
//   node ex-testing/lint/scratch/v7-7-replay.cjs e2e
const cp = require('child_process');
const fs = require('fs');

const cwd = 'D:\\Repositories\\starci-academy-backend\\.claude\\examples\\ecommerce-app-be';
const OUT = 'D:\\Repositories\\starci-academy-backend\\.claude\\ex-testing\\lint\\scratch\\v7-7-replay-' + process.argv[2] + '.jsonl';

// Every entry is a verbatim `command` from an evidence.yaml in scope, with the records that cite it.
const JOBS = {
  unit: [
    ['U1', 'br.checkout.place-order(empty-cart)', 'npx jest -t ac.checkout.place-order.empty-cart-is-refused --runInBand'],
    ['U2', 'br.checkout.place-order(stock-at-confirm)', 'npx jest -t ac.checkout.place-order.stock-is-checked-at-confirmation --runInBand'],
    ['U3', 'contract.checkout.order-for-identity(provider)', 'npx jest buyer.controller.spec --runInBand'],
    ['U4', 'contract.checkout.order-for-identity(consumer)', 'npx jest order.client.spec --runInBand'],
    ['U5', 'fr.checkout.place-order(unit-composed-rules)', 'npx jest -t fr.checkout.place-order --runInBand'],
    ['U6', 'sds.checkout.order-flow(implementation)', 'npx jest -t sds.checkout.order-flow --runInBand'],
    ['U7', 'sds.checkout.order-flow(transitions)', 'npx jest -t t-refuse --runInBand'],
    ['U8', 'br.identity.sign-in(known-pair)', 'npx jest -t ac.identity.sign-in.known-pair-issues-a-session-token --runInBand'],
    ['U9', 'br.identity.sign-in(wrong-pair)', 'npx jest -t ac.identity.sign-in.wrong-pair-is-refused-alike --runInBand'],
    ['U10', 'fr.identity.sign-in(unit-composed-rules)', 'npx jest -t fr.identity.sign-in --runInBand'],
    ['U11', 'impl.checkout...order-checkout(unit)', 'npx jest src/modules/bussiness/order src/modules/bussiness/cart src/modules/bussiness/catalog src/modules/bussiness/payment src/modules/integrations/identity src/features/checkout --runInBand'],
    ['U12', 'impl.identity...identity-account(unit)', 'npx jest src/modules/bussiness/account src/modules/bussiness/session src/modules/integrations/order src/features/identity --runInBand'],
  ],
  // The four e2e commands in scope are subsets of this one union pattern. Each spec boots its own
  // run-owned compose project (src/tests/infra/platform/stack/e2e-stack.service.ts), so a spec's
  // outcome in the union run is its outcome in any subset run; jest's exit is 0 iff every matched
  // suite passed, so the per-suite lines below settle every subset's claimed outcome.
  e2e: [
    ['E2', 'union incl. checkout/checkout-journey (the command fr.checkout.place-order requires)',
      'npx jest --config src/tests/e2e/jest.config.js "order-lifecycle|checkout/payment-failure|checkout/checkout-journey|identity/sign-up-sign-in"'],
  ],
};

const mode = process.argv[2];
const jobs = JOBS[mode];
if (!jobs) { console.error('mode must be unit|e2e'); process.exit(2); }

const summarize = (text) => {
  const lines = String(text).split(/\r?\n/);
  const pick = (re) => lines.filter((l) => re.test(l)).map((l) => l.trim());
  return {
    suites: pick(/^Test Suites:/),
    tests: pick(/^Tests:/),
    perSuite: pick(/^(PASS|FAIL) /),
    noTests: pick(/^(No tests found|●.*No tests)/),
  };
};

for (const [id, label, cmd] of jobs) {
  const started = new Date().toISOString();
  // spawnSync (not execFileSync): jest writes its per-suite lines and its Tests:/Test Suites: summary to
  // stderr, and a successful execFileSync hands back only stdout - the summary would be lost exactly when
  // the command passed, which is the case whose vacuity matters most.
  const run = cp.spawnSync(cmd, { cwd, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const exit = typeof run?.status === 'number' ? run.status : (run?.error ? 1 : 0);
  const stdout = run?.stdout || '';
  const stderr = run?.stderr || '';
  const crashed = run?.error ? String(run.error.message).split(/\r?\n/)[0] : null;
  const combined = stdout + '\n' + stderr;
  const rec = { id, label, cmd, started, finished: new Date().toISOString(), exit, ...summarize(combined), crashed };
  fs.appendFileSync(OUT, JSON.stringify(rec) + '\n');
  console.log(`${id} exit=${rec.exit} ${rec.tests.join(' | ')} ${rec.suites.join(' | ')}`);
}
