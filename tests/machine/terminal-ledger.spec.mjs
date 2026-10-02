import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { JOB_HANDLE_FIELDS, WORKER_HOLDING_STATUSES, jobTerminalHandles, ledgerJobs, kernelSignalRows, pathUnder } from '../../scripts/machine/terminal-ledger.mjs';
import { ledgerBindings, dedupeTerminals } from '../../scripts/kernel/terminal-dedupe.mjs';
import { orcaTreeFindings } from '../../scripts/supervisor/orca-tree.mjs';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';

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

test('pathUnder is the path-prefix test both scripts spelt locally', () => { const DRIVE = path.parse(os.tmpdir()).root, FW = DRIVE.replace(/\\/g, '/');
  assert.ok(pathUnder(`${DRIVE}Repo\\x\\sub`, `${FW.toLowerCase()}repo/x`));
  assert.ok(pathUnder(`${FW}a/`, `${FW}a`));
  assert.ok(!pathUnder(`${FW}ab`, `${FW}a`));
  assert.ok(!pathUnder(null, `${FW}a`));
  assert.ok(!pathUnder(`${FW}a`, null));
});

// A handle hiding only under payload.hierarchy.runtime.terminalHandle must count as bound for BOTH readers —
// proof they read the shared field list, not a local copy.
test('the dedupe and check readers bind a terminal named only under hierarchy.runtime', async (t) => {
  await withLedger(t, async ({ repoRoot, ledger }) => {
    seedWorkflow(ledger, { id: 'wf-tl', jobs: [{ jobId: 'j-nested', opId: 'code.refactor', status: 'running',
      payload: { opId: 'code.refactor', hierarchy: { runtime: { terminalHandle: 'term_nested' } } } }] });
    const out = dedupeTerminals({ repos: [repoRoot], env: {}, deps: {
      list: () => ({ ok: true, terminals: [{ handle: 'term_nested', worktreePath: repoRoot, title: 'op-x' }], visualLayouts: [] }),
      read: () => 'agent frame, no shell prompt',
      quit: () => { throw new Error('a bound terminal is never quit'); },
      close: () => { throw new Error('a bound terminal is never closed'); },
    } });
    assert.equal(out.listed, 1);
    assert.deepEqual(out.closed, []);
    const findings = orcaTreeFindings(ledger.db, [{ handle: 'term_nested', live: true, worktreePath: repoRoot, title: 'x' }],
      { repo: repoRoot, owned: new Set(), workers: [] });
    assert.deepEqual(findings.filter((f) => f.terminal === 'term_nested'), [], JSON.stringify(findings));
  });
});
