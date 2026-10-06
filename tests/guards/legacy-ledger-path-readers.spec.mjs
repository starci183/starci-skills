// legacy-ledger-path-readers.spec.mjs — repo-keyed ledger readers resolve a repo's runtime.sqlite through the
// machine registry (decision Q1: engine/db/ledger.mjs ledgerFileFor -> machine.sqlite ledgers.file ->
// <runtime root>/.runtime/projects/<ledger id>/runtime.sqlite), never the pre-Q1 in-repo .starciwork/runtime.sqlite
// (cluster legacy-ledger-path-readers). The owner digest and the deps guard's peer-lease read opened the in-repo
// path only: nivo-backend (no in-repo file) contributed nothing to the digest, and mia-mia-backend / starci-next
// would have surfaced their stale in-repo stores (hygiene LEDGER_LEGACY_WORK_SQLITE) instead of the live ledger.
//   1. A repo whose ledger lives only at the registry path IS read: its owner-wait DI reaches digestInputs'
//      ownerWaits, and peerLeasedJobs reports its leased jobs ({known:true}).
//   2. A stale in-repo runtime.sqlite beside a registered ledger is never opened: its phantom owner DI and
//      phantom leased job stay invisible to both readers.
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
    // exactly the post-Q1 shape: nothing at <repo>/.starciwork/runtime.sqlite.
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

test('a stale in-repo runtime.sqlite beside a registered ledger is never read', async (t) => {
  await withLedger(t, async ({ repoRoot, ledger }) => {
    seedWorkflow(ledger, { id: 'wf-live', jobs: [leasedOp('op-live')] });
    ownerWait(ledger, 'wf-live', 'the live owner wait');
    // The pre-Q1 leftover inside the checkout: a valid ledger file whose rows are the dead store's (it is never
    // registered — repoRootOfFile knows only the projects path, so openLedger writes no registry row for it).
    const stale = openLedger({ file: path.join(repoRoot, '.starciwork', 'runtime.sqlite') });
    try {
      seedWorkflow(stale, { id: 'wf-stale', jobs: [leasedOp('op-ghost')] });
      ownerWait(stale, 'wf-stale', 'a phantom wait from the stale store');
    } finally { stale.close(); }

    const inputs = await digestInputs({ env: process.env, now: 120_000, repos: [repoRoot] });
    assert.deepEqual(inputs.ownerWaits, ['wf-live: the live owner wait'],
      'the stale store\'s DI stays out of the digest');

    const peers = await peerLeasedJobs({ ledgerRepo: repoRoot, workflowId: 'wf-self' });
    assert.deepEqual(peers.jobs.map((j) => j.jobId), ['op-live'], 'the phantom lease never surfaces');
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
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-legacy-only-'));
    t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
    fs.mkdirSync(path.join(repo, '.starciwork'));
    const legacy = openLedger({ file: path.join(repo, '.starciwork', 'runtime.sqlite') });
    try {
      seedWorkflow(legacy, { id: 'wf-legacy', jobs: [leasedOp('op-old')] });
      ownerWait(legacy, 'wf-legacy', 'the only store this checkout has');
    } finally { legacy.close(); }
    const legacyInputs = await digestInputs({ env: process.env, now: 120_000, repos: [repo] });
    assert.deepEqual(legacyInputs.ownerWaits, []);
    assert.deepEqual(await peerLeasedJobs({ ledgerRepo: repo, workflowId: 'wf-x' }), { known: false, jobs: [] });
  });
});
