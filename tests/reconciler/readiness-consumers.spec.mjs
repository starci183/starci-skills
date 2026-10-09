// 2026-10-09: no Kernel could start on the live host because the harness UI build (a row of `starci reconciler up`) was red, and the start of a workflow's Kernel runs the
// same readiness. A row gates the consumers modules/reconciler/readiness.yaml names; the start of a Kernel is gated by Orca, the ledgers, the guard and the engine, never by the UI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureHostRuntime, main } from '../../scripts/reconciler/start.mjs';
import { forConsumer } from '../../scripts/reconciler/readiness-consumers.mjs';

const row = (id, status, required = true) => ({ group: 'services', id, status, required, detail: id });
const ITEMS = [row('orca', 'green'), row('ledgers', 'green'), row('ui-build', 'red'), row('harness-ui', 'red'), row('harness-tunnel', 'red'), row('guard-command', 'red')];

test('the rows that gate a Kernel start leave out the harness UI rows, and name everything else', () => {
  assert.deepEqual(forConsumer(ITEMS, 'kernel-start').map((item) => item.id), ['orca', 'ledgers', 'guard-command']);
  assert.equal(forConsumer(ITEMS, 'harness').length, ITEMS.length, 'the full host start gates on every row');
});

test('a red UI build blocks the harness start and not the Kernel start, and the Kernel start never builds the UI', async () => {
  const applied = [];
  const deps = { gather: async () => ITEMS.filter((item) => item.id !== 'guard-command'), applyHost: async (options) => { applied.push(options); return []; }, sleep: async () => {}, now: () => 0 };
  const kernel = await ensureHostRuntime({ consumer: 'kernel-start', waitMs: 0 }, deps);
  assert.equal(kernel.ok, true, 'only the rows a Kernel needs are judged');
  assert.deepEqual(kernel.items.map((item) => item.id).sort(), ['ledgers', 'orca']);
  const harness = await ensureHostRuntime({ waitMs: 0 }, deps);
  assert.equal(harness.ok, false);
  assert.ok(applied.every((options) => (options.consumer === 'kernel-start') === (options.noBuild === true)), 'the Kernel start asks for no UI build');
});

test('the workflow entry of `reconciler up` asks for the Kernel-start consumer', async () => {
  const seen = [];
  const ensure = async (options) => { seen.push(options.consumer); return { ok: true, items: [], summary: {}, applied: [] }; };
  await main(['--json'], { workflowEntry: true, print: () => {}, ensureHostRuntime: ensure });
  await main(['--json'], { print: () => {}, ensureHostRuntime: ensure });
  assert.deepEqual(seen, ['kernel-start', 'harness']);
});
