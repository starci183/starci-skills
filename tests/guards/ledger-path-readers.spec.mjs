// ledger-path-readers.spec.mjs — repo-keyed ledger readers resolve a repo's runtime.sqlite through the
// machine registry (engine/db/ledger.mjs ledgerFileFor -> machine.sqlite ledgers.file ->
// <runtime root>/.runtime/projects/<ledger id>/runtime.sqlite); a file inside the checkout is never a ledger source.
// The owner digest and the deps guard's peer-lease read both go through that one resolver.
//   1. A repo whose ledger lives only at the registry path IS read: its owner-wait DI reaches digestInputs'
//      ownerWaits, and peerLeasedJobs reports its leased jobs ({known:true}).
//   2. A runtime.sqlite inside the checkout beside a registered ledger is never opened: its owner DI and
//      leased job stay invisible to both readers.
//   3. A repo with no resolvable ledger is a quiet skip ({known:false}, no ownerWaits line, no throw), and a repo the
//      registry never named is NOT read through an in-repo store either: ledgerFileFor is the one resolver.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { openLedger } from '../../engine/db/ledger.mjs';
import { openDecisionRow } from '../../scripts/machine/decisions.mjs';
import { digestInputs } from '../../scripts/reconciler/notifier.mjs';
import { peerLeasedJobs } from '../../scripts/guards/deps-guard.mjs';

const ownerWait = (ledger, workflowId, summary) => openDecisionRow(ledger, {
  workflowId, kind: 'worker-question', decider: 'owner', entity: { type: 'workflow', id: workflowId },
  summary, by: 'kernel', idempotencyKey: `worker-question:${workflowId}`,
}, { now: 0 });

const leasedOp = (jobId) => ({ jobId, opId: 'backend.implement', status: 'leased' });

test('a repo whose ledger lives only at the registry path is read by the digest and the deps guard', async (t) => {
  await withLedger(t, async ({ repoRoot, ledger }) => {
    // withLedger parks the ledger at ledgerFileFor(repoRoot) and registers it in the test machine.sqlite —
    // the one ledger location: nothing at <repo>/.starciwork/runtime.sqlite.
    seedWorkflow(ledger, { id: 'wf-live', jobs: [leasedOp('op-live')] });
    ownerWait(ledger, 'wf-live', 'owner must pick an option for wf-live');

    const inputs = await digestInputs({ env: process.env, now: 120_000, repos: [repoRoot] });
    assert.deepEqual(inputs.ownerWaits, ['wf-live: owner must pick an option for wf-live'],
      'the digest reads the registry-resolved ledger, not the absent in-repo one');

    const peers = await peerLeasedJobs({ ledgerRepo: repoRoot, workflowId: 'wf-self' });
    assert.equal(peers.known, true, 'the guard resolves the same registry ledger');
    assert.deepEqual(peers.jobs.map((j) => j.jobId), ['op-live']);
  });
});

test('a runtime.sqlite inside the checkout beside a registered ledger is never read', async (t) => {
  await withLedger(t, async ({ repoRoot, ledger }) => {
    seedWorkflow(ledger, { id: 'wf-live', jobs: [leasedOp('op-live')] });
    ownerWait(ledger, 'wf-live', 'the live owner wait');
    // A ledger-shaped file inside the checkout (it is never registered — repoRootOfFile knows only the projects
    // path, so openLedger writes no registry row for it).
    const inCheckout = openLedger({ file: path.join(repoRoot, '.starciwork', 'runtime.sqlite') });
    try {
      seedWorkflow(inCheckout, { id: 'wf-in-checkout', jobs: [leasedOp('op-ghost')] });
      ownerWait(inCheckout, 'wf-in-checkout', 'a wait from the in-checkout file');
    } finally { inCheckout.close(); }

    const inputs = await digestInputs({ env: process.env, now: 120_000, repos: [repoRoot] });
    assert.deepEqual(inputs.ownerWaits, ['wf-live: the live owner wait'],
      'the in-checkout file\'s DI stays out of the digest');

    const peers = await peerLeasedJobs({ ledgerRepo: repoRoot, workflowId: 'wf-self' });
    assert.deepEqual(peers.jobs.map((j) => j.jobId), ['op-live'], 'the in-checkout lease never surfaces');
  });
});

test('a repo with no resolvable ledger is a quiet skip, and an in-repo store of an unregistered repo is never read', async (t) => {
  await withLedger(t, async () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-ledger-less-'));
    t.after(() => fs.rmSync(bare, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
    const inputs = await digestInputs({ env: process.env, now: 120_000, repos: [bare] });
    assert.deepEqual(inputs.ownerWaits, []);
    assert.deepEqual(inputs.progress, []);
    assert.deepEqual(await peerLeasedJobs({ ledgerRepo: bare, workflowId: 'wf-x' }), { known: false, jobs: [] });

    // The registry never named this checkout: an in-repo file is not a ledger, so it contributes nothing.
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-in-checkout-only-'));
    t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
    fs.mkdirSync(path.join(repo, '.starciwork'));
    const inCheckoutOnly = openLedger({ file: path.join(repo, '.starciwork', 'runtime.sqlite') });
    try {
      seedWorkflow(inCheckoutOnly, { id: 'wf-in-checkout-only', jobs: [leasedOp('op-old')] });
      ownerWait(inCheckoutOnly, 'wf-in-checkout-only', 'the only store this checkout has');
    } finally { inCheckoutOnly.close(); }
    const inCheckoutInputs = await digestInputs({ env: process.env, now: 120_000, repos: [repo] });
    assert.deepEqual(inCheckoutInputs.ownerWaits, []);
    assert.deepEqual(await peerLeasedJobs({ ledgerRepo: repo, workflowId: 'wf-x' }), { known: false, jobs: [] });
  });
});
