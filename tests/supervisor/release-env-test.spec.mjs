// release-env-test.spec.mjs - `starci release env-test` carries the cut's spec conditions: the same env, installs, test-world build and host prerequisites, and a lane run leaves out only the Orca requirement.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { releaseEnvPlan, releaseEnvTest, main } from '../../scripts/supervisor/release-env-test.mjs';

const NODE_TEST = 'node --import ./tests/setup/low-priority.mjs --import ./tests/setup/isolated-temp.mjs --import ./tests/setup/isolated-registry.mjs --import ./tests/setup/runtime-copies.mjs --test "tests/**/*.spec.mjs"';

function repoWithApp(t) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-release-env-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  fs.writeFileSync(path.join(base, 'package.json'), JSON.stringify({ name: 'rt', scripts: { test: NODE_TEST, check: 'x' } }));
  const app = path.join(base, 'examples', 'shop');
  fs.mkdirSync(app, { recursive: true });
  fs.writeFileSync(path.join(app, 'hfs.json'), JSON.stringify({ kind: 'app' }));
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'shop', scripts: {} }));
  fs.writeFileSync(path.join(app, 'package-lock.json'), '{}');
  fs.mkdirSync(path.join(base, 'packages', 'test-world'), { recursive: true });
  fs.writeFileSync(path.join(base, 'packages', 'test-world', 'package.json'), JSON.stringify({ name: '@starci/test-world' }));
  return { base, app };
}

test('the plan is the cut\'s spec leg: installs, the test-world build, then the suite with the cut\'s env', (t) => {
  const { base } = repoWithApp(t);
  const plan = releaseEnvPlan(base);
  assert.deepEqual(plan.steps.map((s) => s.name), ['shop: npm ci', 'test-world: npm run build', 'npm test']);
  assert.equal(plan.steps[2].env.STARCI_REQUIRE_ORCA_LIVE, '1');
  assert.equal(plan.steps[2].env.STARCI_REQUIRE_APP_INSTALLS, '1');
  assert.deepEqual([plan.proofs, plan.linux], [[], false]);
  const lane = releaseEnvPlan(base, { lane: true });
  assert.equal(lane.steps[2].env.STARCI_REQUIRE_ORCA_LIVE, undefined, 'a lane clone is no Orca terminal');
  assert.equal(lane.steps[2].env.STARCI_REQUIRE_APP_INSTALLS, '1', 'everything else is the cut\'s');
  fs.mkdirSync(path.join(base, 'examples', 'shop', 'node_modules'));
  assert.deepEqual(releaseEnvPlan(base, { reuseInstalls: true }).steps.map((s) => s.name), ['test-world: npm run build', 'npm test']);
});

test('a host that lacks the cut\'s prerequisites is refused before any step; a lane run is not', async (t) => {
  const { base } = repoWithApp(t);
  const ran = [];
  const step = (s) => { ran.push(s.name); return { ok: true, log: 'x.log', ms: 1, text: '' }; };
  const host = () => [{ need: 'an Orca terminal', why: 'ORCA_TERMINAL_HANDLE is empty', fix: 'run it in an Orca terminal' }];
  const refused = await releaseEnvTest({ repo: base, deps: { host, step } });
  assert.deepEqual([refused.ok, refused.refused], [false, true]);
  assert.match(refused.why, /an Orca terminal/);
  assert.deepEqual(ran, []);
  const lane = await releaseEnvTest({ repo: base, lane: true, deps: { host, step } });
  assert.equal(lane.ok, true);
  assert.deepEqual(ran, ['shop: npm ci', 'test-world: npm run build', 'npm test']);
});

test('a red step and a skip nothing covers fail the run; the CLI exits 1 and prints the verdict', async (t) => {
  const { base } = repoWithApp(t);
  const step = (s) => (s.name === 'npm test' ? { ok: false, log: 'suite.log', ms: 2000, text: '﹣ Orca settle smoke (1ms) # no ORCA_TERMINAL_HANDLE\n' } : { ok: true, log: 'ok.log', ms: 1, text: '' });
  const result = await releaseEnvTest({ repo: base, deps: { host: () => [], step } });
  assert.equal(result.ok, false);
  assert.deepEqual(result.failed.map((f) => f.name), ['npm test']);
  assert.deepEqual(result.skips.map((k) => k.class), ['infrastructure']);
  const out = [];
  assert.equal(await main(['--nope'], (text) => out.push(text)), 2);
  assert.match(out.join(''), /unknown argument --nope/);
});
