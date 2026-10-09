// ONE revision ack: kernel-ack-rev and revision-ack are one verb, one event (runtime-rev-acked), one gate, one status line. The attestation needs no file
// (the Kernel seat cannot redirect output into one: KERNEL_NO_FILE_WRITE), and the ack the gate reads is the ack the notice reads.
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import assert from 'node:assert/strict';
import { withKernelIngress } from '../helpers/kernel-ingress-fixture.mjs';
import { callerAdmission } from '../../scripts/kernel/caller-admission.mjs';
import ackRev from '../../scripts/kernel/verbs/kernel-ack-rev.mjs';
import revisionAck from '../../scripts/kernel/verbs/revision-ack.mjs';
import { kernelSeat } from '../../scripts/machine/revision-seats.mjs';
import { noticeFor } from '../../scripts/machine/revision-ack.mjs';
import { noticeLine } from '../../scripts/machine/revision-notice.mjs';

const run = (verb, w, args) => {
  const admitted = callerAdmission(w.ledger, args, { env: { ...process.env, ORCA_TERMINAL_HANDLE: w.handle }, root: w.runtime });
  let out = null;
  admitted.run(() => verb.run({ ledger: w.ledger, args, caller: admitted.caller, emit: (value) => { out = value; } }));
  return out;
};
const acks = (w) => w.ledger.db.prepare("SELECT kind FROM events WHERE kind IN ('runtime-rev-acked','runtime-rev-noticed') ORDER BY seq").all().map((row) => row.kind);

test('both names plan the same manifest with the same readToken, and either attests it by token alone', (t) => withKernelIngress(t, (w) => {
  const saved = process.env.STARCI_KERNEL_REV_ROOT;
  process.env.STARCI_KERNEL_REV_ROOT = w.runtime;
  try {
    const planA = run(ackRev, w, { workflow: w.workflowId, plan: true });
    const planB = run(revisionAck, w, { workflow: w.workflowId, plan: true });
    assert.equal(planA.readToken, planB.readToken);
    assert.match(planA.readToken, /^[0-9a-f]{64}$/);
    assert.equal(planA.readToken, planA.readManifest.digest);
    assert.throws(() => run(revisionAck, w, { workflow: w.workflowId, rev: planA.readManifest.rev, digest: 'f'.repeat(64) }), /readToken/);
    assert.deepEqual(acks(w), [], 'a refused token writes nothing');
    run(revisionAck, w, { workflow: w.workflowId, rev: planA.readManifest.rev, digest: planA.readToken });
    run(ackRev, w, { workflow: w.workflowId, rev: planA.readManifest.rev, digest: planA.readToken });
    assert.deepEqual(acks(w), ['runtime-rev-acked', 'runtime-rev-acked'], 'one event kind, whichever name attests');
  } finally { if (saved === undefined) delete process.env.STARCI_KERNEL_REV_ROOT; else process.env.STARCI_KERNEL_REV_ROOT = saved; }
}));

test('the ack the gate reads is the ack the notice reads: after the attestation the status line says acked, not owed, not stale', (t) => withKernelIngress(t, (w) => {
  const saved = process.env.STARCI_KERNEL_REV_ROOT;
  process.env.STARCI_KERNEL_REV_ROOT = w.runtime;
  try {
    const plan = run(ackRev, w, { workflow: w.workflowId, plan: true });
    run(ackRev, w, { workflow: w.workflowId, rev: plan.readManifest.rev, digest: plan.readToken });
    const notice = noticeFor(kernelSeat({ ledger: w.ledger, workflowId: w.workflowId, root: w.runtime }));
    assert.equal(notice.state, 'current');
    assert.match(noticeLine(notice), /^kernel acked rev [0-9a-f]{12}$/);
  } finally { if (saved === undefined) delete process.env.STARCI_KERNEL_REV_ROOT; else process.env.STARCI_KERNEL_REV_ROOT = saved; }
}));

// The union: what the ack plans is the legacy required set UNION what the revision change owes this Kernel; its token is the digest of exactly that union.
import { recordReplaced } from '../../scripts/machine/revision-ack.mjs';

const GROWN = ['kinds:', '  - a', '  - b', ''].join(String.fromCodePoint(10));
const OWED_ONLY = 'modules/kernel/kernel-menu.yaml'; // a Kernel contract file of the revision table that is no member of the legacy required set
const withRoot = (w, fn) => {
  const saved = process.env.STARCI_KERNEL_REV_ROOT;
  process.env.STARCI_KERNEL_REV_ROOT = w.runtime;
  try { return fn(); } finally { if (saved === undefined) delete process.env.STARCI_KERNEL_REV_ROOT; else process.env.STARCI_KERNEL_REV_ROOT = saved; }
};
const SHIPPED_TABLE = fs.readFileSync(path.join(skillRoot, 'modules/kernel/revision-scope.yaml'), 'utf8');
const baseline = (w) => {
  change(w, { 'modules/kernel/revision-scope.yaml': SHIPPED_TABLE }, 'the table');
  recordReplaced(kernelSeat({ ledger: w.ledger, workflowId: w.workflowId, root: w.runtime }), 'boot');
};
const change = (w, files, message) => { for (const [file, text] of Object.entries(files)) w.write(file, text); w.git('add', '-A'); w.git('commit', '-qm', message); };

test('the plan carries the file a revision change owes beyond the legacy set, the token is the digest of that union, and the ack settles it', (t) => withKernelIngress(t, (w) => withRoot(w, () => {
  baseline(w);
  const before = run(ackRev, w, { workflow: w.workflowId, plan: true });
  assert.equal(before.readManifest.files.some((f) => f.path === OWED_ONLY), false, 'nothing owes it yet');
  change(w, { [OWED_ONLY]: 'kinds:\n  - a\n  - b\n' }, 'the menu grows');
  const plan = run(ackRev, w, { workflow: w.workflowId, plan: true });
  assert.ok(plan.readManifest.files.some((f) => f.path === OWED_ONLY), 'the union holds the owed file');
  assert.equal(plan.readToken, plan.readManifest.digest);
  assert.notEqual(plan.readToken, before.readToken);
  run(revisionAck, w, { workflow: w.workflowId, rev: plan.readManifest.rev, digest: plan.readToken });
  assert.equal(noticeFor(kernelSeat({ ledger: w.ledger, workflowId: w.workflowId, root: w.runtime })).state, 'acked-legacy', 'the ack listed every owed file: the runtime settles it');
})));

test('a token of the legacy set alone is refused once a revision change owes more: no ack settles a file it never listed', (t) => withKernelIngress(t, (w) => withRoot(w, () => {
  baseline(w);
  const stale = run(ackRev, w, { workflow: w.workflowId, plan: true });
  change(w, { [OWED_ONLY]: 'kinds:\n  - a\n  - b\n' }, 'the menu grows');
  assert.throws(() => run(ackRev, w, { workflow: w.workflowId, rev: stale.readManifest.rev, digest: stale.readToken }), /readToken|current/);
  assert.deepEqual(acks(w).filter((kind) => kind === 'runtime-rev-acked'), []);
})));

test('a file outside both sets is never in the plan and an ack never settles it', (t) => withKernelIngress(t, (w) => withRoot(w, () => {
  baseline(w);
  change(w, { 'docs/unrelated.md': '# unrelated\n' }, 'a doc');
  const plan = run(ackRev, w, { workflow: w.workflowId, plan: true });
  assert.equal(plan.readManifest.files.some((f) => f.path === 'docs/unrelated.md'), false);
  const seat = kernelSeat({ ledger: w.ledger, workflowId: w.workflowId, root: w.runtime });
  assert.equal(noticeFor(seat).state, 'not-concerned', 'the runtime settles it as not concerned, never as read');
})));

test('an ack that named only part of what is owed leaves the rest owed', (t) => withKernelIngress(t, (w) => withRoot(w, () => {
  baseline(w);
  change(w, { [OWED_ONLY]: 'kinds:\n  - a\n  - b\n' }, 'the menu grows');
  const rev = w.git('rev-parse', 'HEAD').trim();
  w.ledger.transaction(() => w.ledger.appendEvent({ workflowId: w.workflowId, entityType: 'kernel', entityId: w.workflowId, kind: 'runtime-rev-acked', payload: { rev, files: ['modules/kernel/api.yaml'], source: 'ack' }, createdAt: Date.now() }));
  assert.equal(noticeFor(kernelSeat({ ledger: w.ledger, workflowId: w.workflowId, root: w.runtime })).state, 'owed');
})));
