// scripts/kernel/op-context.mjs: an op's job, scratch and provider come from the Orca terminal it runs in - the guard
// bound to that terminal names the ledger, and the ledger's own binding names the job. worker-start owns the op's
// environment, so no env marker (STARCI_OP_JOB, STARCI_JOB_SCRATCH, STARCI_OP_PROVIDER) names anything any more.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withLedger, seedWorkflow } from './_ledger-fixture.mjs';
import { writeJobGuard, bindGuardTerminal } from '../scripts/guards/install.mjs';
import { opContextOf } from '../scripts/kernel/op-context.mjs';

const WF = 'wf-op-context';

test('the op context is the job the ledger binds to the caller\'s Orca terminal, with its latest attempt\'s scratch and provider', (t) => withLedger(t, ({ root, repoRoot, ledger }) => {
  seedWorkflow(ledger, { id: WF, jobs: [
    { jobId: 'op-draw-1', opId: 'interface.draw', kind: 'op', status: 'running', payload: { opId: 'interface.draw', owned_paths: [], managed: { agentTerminalHandle: 'term_draw' } } },
    { jobId: 'op-queued-1', opId: 'docs.author', kind: 'op', status: 'queued' },
  ] });
  const scratch = path.join(root, 'scratch-draw');
  ledger.db.prepare('UPDATE op_attempts SET scratch_dir=?, provider=? WHERE job_id=?').run(scratch, 'devin', 'op-draw-1');
  const skillRoot = path.join(root, 'skill');
  const bind = (handle, jobId, ledgerRepo = repoRoot) => bindGuardTerminal({ skillRoot, handle,
    jobFile: writeJobGuard({ skillRoot, jobId, workflowId: WF, ledgerRepo, owned: [path.join(repoRoot, 'src')] }) });
  bind('term_draw', 'op-draw-1');
  const env = (extra) => ({ ...process.env, ...extra });
  assert.deepEqual(opContextOf({ env: env({ ORCA_TERMINAL_HANDLE: 'term_draw' }), root: skillRoot }),
    { jobId: 'op-draw-1', workflowId: WF, scratchDir: scratch, provider: 'devin', dispatchId: 'seed:op-draw-1', handle: 'term_draw', ledgerRepo: path.resolve(repoRoot) });
  // No terminal, a terminal with no guard (the Kernel's, the owner's), or a guard the ledger does not bind to that
  // terminal: no op. An env marker never names one.
  assert.equal(opContextOf({ env: env({ ORCA_TERMINAL_HANDLE: '', STARCI_OP_JOB: 'op-draw-1', STARCI_JOB_SCRATCH: scratch, STARCI_OP_PROVIDER: 'devin' }), root: skillRoot }), null);
  assert.equal(opContextOf({ env: env({ ORCA_TERMINAL_HANDLE: 'term_kernel' }), root: skillRoot }), null);
  bind('term_stray', 'op-queued-1');
  assert.equal(opContextOf({ env: env({ ORCA_TERMINAL_HANDLE: 'term_stray' }), root: skillRoot }), null, 'the ledger, not the guard file, decides');
  // A [Worker]'s guard names no ledger: it is no op.
  bind('term_worker', 'fix-x', null);
  assert.equal(opContextOf({ env: env({ ORCA_TERMINAL_HANDLE: 'term_worker' }), root: skillRoot }), null);
  assert.ok(!fs.existsSync(scratch), 'reading the context creates nothing');
}));
