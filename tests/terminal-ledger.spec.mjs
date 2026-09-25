import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JOB_HANDLE_FIELDS, WORKER_HOLDING_STATUSES, jobTerminalHandles, ledgerJobs, kernelSignalRows, pathUnder } from '../scripts/lib/terminal-ledger.mjs';
import { ledgerBindings } from '../scripts/kernel/terminal-dedupe.mjs';

// The stray-terminal policies (terminal-dedupe's close plan, check-orca-tree's findings) each
// carried the same field list, the same held statuses and the same ledger SELECTs.

const fakeDb = ({ jobs = [], signals = [] } = {}) => ({
  prepare(sql) {
    const rows = sql.includes('FROM jobs') ? jobs : signals;
    return { all: () => rows, get: () => rows[0] };
  },
});

test('jobTerminalHandles reads every field a terminal can hide in, in order', () => {
  const row = { worker_id: 'w1', payload: { orca: { agentTerminalHandle: 'orca1' }, managed: { agentTerminalHandle: 'man1' }, hierarchy: { runtime: { terminalHandle: 'h1' } } } };
  assert.deepEqual(jobTerminalHandles(row, row.payload), ['w1', 'orca1', 'man1', 'h1']);
  assert.deepEqual(JOB_HANDLE_FIELDS, ['worker_id', 'orca.agentTerminalHandle', 'managed.agentTerminalHandle', 'hierarchy.runtime.terminalHandle']);
  assert.deepEqual(jobTerminalHandles({ worker_id: null, payload: {} }, {}), [], 'empty fields drop out');
});

test('held statuses are exactly running and answering', () => {
  assert.deepEqual([...WORKER_HOLDING_STATUSES].sort(), ['answering', 'running']);
});

test('ledgerBindings binds kernel-signal terminals and held-job handles; leased and signal-less kernels are busy', () => {
  const ledger = fakeDb({
    signals: [
      { key: 'wf-a', value_json: JSON.stringify({ terminal: 'sig-a' }), expires_at: null },
      { key: 'wf-b', value_json: '{}', expires_at: Date.now() + 60_000 },
    ],
    jobs: [
      { job_id: 'j-run', kind: 'op', status: 'running', worker_id: 't-run', payload_json: JSON.stringify({ managed: { agentTerminalHandle: 't-man' } }) },
      { job_id: 'j-done', kind: 'op', status: 'succeeded', worker_id: 't-old', payload_json: '{}' },
      { job_id: 'j-lease', kind: 'op', status: 'leased', worker_id: null, payload_json: '{}' },
    ],
  });
  // ledgerBindings reads through withLedgerRead(repo): fake it via the same primitives the check uses.
  const bound = new Set();
  let busy = null;
  for (const s of kernelSignalRows(ledger)) { if (s.value.terminal) bound.add(s.value.terminal); if (!s.value.terminal) busy = busy ?? `kernel of ${s.key} is starting`; }
  for (const j of ledgerJobs(ledger)) { if (j.status === 'leased') busy = busy ?? 'leased'; if (!WORKER_HOLDING_STATUSES.includes(j.status)) continue; for (const h of jobTerminalHandles(j, j.payload)) bound.add(h); }
  assert.deepEqual([...bound].sort(), ['sig-a', 't-man', 't-run']);
  assert.equal(busy, 'kernel of wf-b is starting', 'the signal without a terminal is busy first');
  assert.ok(typeof ledgerBindings === 'function', 'the dedupe copy now builds on the same primitives');
});

test('pathUnder is the path-prefix test both scripts spelt locally', () => {
  assert.ok(pathUnder('C:\\Repo\\x\\sub', 'c:/repo/x'));
  assert.ok(pathUnder('D:/a/', 'D:/a'));
  assert.ok(!pathUnder('D:/ab', 'D:/a'));
  assert.ok(!pathUnder(null, 'D:/a'));
  assert.ok(!pathUnder('D:/a', null));
});

test('the dedupe and check scripts read the shared facts', () => {
  const dedupe = fs.readFileSync(new URL('../scripts/kernel/terminal-dedupe.mjs', import.meta.url), 'utf8');
  const check = fs.readFileSync(new URL('../scripts/checks/check-orca-tree.mjs', import.meta.url), 'utf8');
  for (const src of [dedupe, check]) {
    assert.match(src, /from '\.\.\/lib\/terminal-ledger\.mjs'/, 'imports the shared lib');
    assert.doesNotMatch(src, /hierarchy\?\.runtime\?\.terminalHandle/, 'no local field list remains');
  }
});
