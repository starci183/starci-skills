// ONE revision ack: kernel-ack-rev and revision-ack are one verb, one event (runtime-rev-acked), one gate, one status line. The attestation needs no file
// (the Kernel seat cannot redirect output into one: KERNEL_NO_FILE_WRITE), and the ack the gate reads is the ack the notice reads.
import test from 'node:test';
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
