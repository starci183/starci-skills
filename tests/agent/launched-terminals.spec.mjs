import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recordLaunchedTerminal, launchedDispatchOf } from '../../scripts/agent/launched-terminals.mjs';
import { entryDispatchOf } from '../../scripts/agent/depth-preflight.mjs';
import { startAgent } from '../../scripts/agent/lib.mjs';

// Live smoke 2026-10-02 (E5): Orca's worker-list, called without --run, lists only the Run bound to the calling terminal. A
// nested worker's own Dispatch lives in its parent's Run, so the preflight never saw its entry and resolved depth 1 for a
// depth-4 entry; only Orca's nested_worker_depth_exceeded stopped the 5th launch. The runtime now records what it launches.
const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-launched-')); t.after(() => fs.rmSync(d, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return d; };

test('a launched terminal is recorded and read back; an unknown or expired one is null', (t) => {
  const env = { STARCI_LOCAL_ROOT: tmp(t) };
  assert.equal(recordLaunchedTerminal({ terminal: 'term_a', dispatchId: 'ctx_a', env, now: 1000 }), true);
  assert.equal(launchedDispatchOf('term_a', { env, now: 2000 }), 'ctx_a');
  assert.equal(launchedDispatchOf('term_b', { env, now: 2000 }), null);
  assert.equal(launchedDispatchOf('term_a', { env, now: 1000 + 8 * 24 * 3600 * 1000 }), null, 'a week later it has expired');
  assert.equal(recordLaunchedTerminal({ terminal: null, dispatchId: 'x', env }), false);
});

test('a spec process never writes the host state root', () => {
  assert.equal(recordLaunchedTerminal({ terminal: 'term_x', dispatchId: 'ctx_x', env: { NODE_TEST_CONTEXT: 'child' } }), false);
});

test('entryDispatchOf finds a nested entry that a bound-Run worker-list never lists', (t) => {
  const env = { STARCI_LOCAL_ROOT: tmp(t) };
  const launched = (terminal) => launchedDispatchOf(terminal, { env });
  const boundRunOnly = () => ({ ok: true, workers: [] });
  recordLaunchedTerminal({ terminal: 'term_d4', dispatchId: 'ctx_d4', env });
  assert.equal(entryDispatchOf('term_d4', { list: boundRunOnly, launched }), 'ctx_d4');
  assert.equal(entryDispatchOf('term_chat', { list: boundRunOnly, launched }), null, 'an unrecorded entry still falls back to the list');
  const rows = [{ dispatchId: 'ctx_sup', resource: { terminalHandle: 'term_sup' } }];
  assert.equal(entryDispatchOf('term_sup', { list: () => ({ ok: true, workers: rows }), launched }), 'ctx_sup');
});

test('the RUNTIME preflight refuses depth 5 from a depth-4 entry that Orca\'s bound-Run list does not show', (t) => {
  const env = { STARCI_LOCAL_ROOT: tmp(t) };
  recordLaunchedTerminal({ terminal: 'term_d4', dispatchId: 'ctx_d4', env });
  const calls = [];
  const rec = (name, out) => () => { calls.push(name); return out; };
  const io = {
    workerList: () => ({ ok: true, workers: [] }), // Orca scoped to the caller's bound Run: no row for the entry
    runShow: rec('run-show', { ok: false }), runCreate: rec('run-create', { ok: true, runId: 'r' }), taskCreate: rec('task-create', { ok: true, taskId: 't' }),
    spawn: { show: ({ dispatch }) => (calls.push('worker-show'), dispatch === 'ctx_d4' ? { ok: true, dispatch: { depth: 4 } } : { ok: false }),
      trust: rec('trust', { status: 'ok', paths: [] }), start: rec('worker-start', { ok: true }) },
  };
  const launchedFromEnv = process.env.STARCI_LOCAL_ROOT;
  process.env.STARCI_LOCAL_ROOT = env.STARCI_LOCAL_ROOT;
  t.after(() => { if (launchedFromEnv === undefined) delete process.env.STARCI_LOCAL_ROOT; else process.env.STARCI_LOCAL_ROOT = launchedFromEnv; });
  const refused = startAgent({ provider: 'claude', model: 'claude-opus-5-5', worktree: 'x', title: '[Op] d5', prompt: 'p', objective: 'o', entry: 'term_d4', maxDepth: 4, io });
  assert.equal(refused.ok, false);
  assert.equal(refused.step, 'depth');
  assert.equal(refused.code, 'worker-depth-exceeded');
  assert.deepEqual([refused.depth, refused.parentDispatch], [5, 'ctx_d4']);
  assert.deepEqual(calls, ['worker-show'], 'nothing was created, trusted or started');
});
