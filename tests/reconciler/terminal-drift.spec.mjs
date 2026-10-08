import test from 'node:test';
import assert from 'node:assert/strict';
import { runTerminalDrift, runtimeTerminalCount } from '../../scripts/reconciler/terminal-drift.mjs';

// 2026-10-07: the clock counted every Orca terminal (41 against 8 workers), stayed open for twenty hours and named an auto-action that nothing ran.
const tab = (tabId, title) => ({ tabId, title, panes: [{ paneId: `${tabId}-p` }] });
const listed = {
  ok: true,
  terminals: [
    { handle: 't1', tabId: 'a' }, { handle: 't2', tabId: 'b' }, { handle: 't3', tabId: 'c' }, { handle: 't4', tabId: 'd' },
    { handle: 't5', tabId: 'e' }, { handle: 't6', tabId: 'f' },
  ],
  visualLayouts: [{ tabs: [tab('a', '[Kernel] auth'), tab('b', '[Op] business.decide'), tab('c', '[Worker] fix'), tab('d', 'smells lane'), tab('e', 'Terminal 1'), tab('f', 'powershell')] }],
};

test('only the tabs the runtime titled are counted; the owner\'s shells, lanes and coordinators are not', () => {
  assert.equal(runtimeTerminalCount(listed), 3);
  assert.equal(runtimeTerminalCount({ ok: false }), null, 'an Orca that does not answer proves nothing');
});

const fixture = ({ count, workers, now = 1_000_000, last }) => {
  const calls = { clock: [], clear: [], run: [] };
  const ctx = { now: () => now, run: async (cmd, args) => { calls.run.push([cmd, args]); } };
  const state = last === undefined ? {} : { lastDriftDedupeAt: last };
  const parts = {
    ctx, state, p: { terminalSlack: 5, terminalDriftSlaMs: 600_000 },
    orcaTerminals: async () => count, activeWorkers: async () => Array.from({ length: workers }, () => ({})),
    clock: async (_ctx, entity, st, ms, meta) => { calls.clock.push([entity, st, ms, meta.count, meta.expected]); },
    clear: async (_ctx, entity, st) => { calls.clear.push([entity, st]); }, dedupeArgs: ['services.mjs', '--dedupe', '--json'],
  };
  return { calls, state, parts };
};

test('a drift runs the clock and the dedupe pass once per SLA window', async () => {
  const f = fixture({ count: 12, workers: 3 });
  assert.deepEqual(await runTerminalDrift(f.parts), { count: 12, expected: 8, workers: 3 });
  assert.deepEqual(f.calls.clock, [['host:terminals', 'TERMINAL_COUNT_DRIFT', 600_000, 12, 8]]);
  assert.deepEqual(f.calls.run, [['node', ['services.mjs', '--dedupe', '--json']]]);
  await runTerminalDrift(f.parts);
  assert.equal(f.calls.run.length, 1, 'the same window runs the pass once');
  const later = fixture({ count: 12, workers: 3, now: 1_000_000 + 600_000, last: 1_000_000 });
  await runTerminalDrift(later.parts);
  assert.equal(later.calls.run.length, 1, 'the next window runs it again');
});

test('within the slack the clock clears and nothing runs; a blind Orca proves nothing', async () => {
  const quiet = fixture({ count: 8, workers: 3 });
  await runTerminalDrift(quiet.parts);
  assert.deepEqual([quiet.calls.clock.length, quiet.calls.run.length, quiet.calls.clear.length], [0, 0, 1]);
  const blind = fixture({ count: null, workers: 3 });
  assert.equal(await runTerminalDrift(blind.parts), null);
  const noWorkers = fixture({ count: 12, workers: 3 });
  noWorkers.parts.activeWorkers = async () => null;
  assert.equal(await runTerminalDrift(noWorkers.parts), null);
  assert.equal(noWorkers.calls.run.length, 0);
});
