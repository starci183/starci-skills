// A READ plan of many files outgrows the inline event bound (16 KiB): the Kernel of StarCi could not attest its runtime revision
// (STARCI_EVENT_PAYLOAD_TOO_LARGE, 19267 bytes against 16384), so every new leg was refused kernel-read-unverified. The attestation
// event keeps its whole payload in the blob store and every reader resolves it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withKernelIngress } from '../helpers/kernel-ingress-fixture.mjs';
import { kernelAuthorityOf } from '../../scripts/kernel/verbs/shared/kernel-seat.mjs';
import { kernelReadManifest, requireKernelRead, unreadFiles } from '../../scripts/kernel/required-read.mjs';
import { callerAdmission } from '../../scripts/kernel/caller-admission.mjs';
import { eventPayloadOf } from '../../engine/db/event-payload.mjs';
import ackRev from '../../scripts/kernel/verbs/kernel-ack-rev.mjs';

const options = (w) => ({ root: w.runtime, authority: kernelAuthorityOf(w.ledger.db, w.workflowId, w.handle), ops: ['review.verify'] });

test('a read manifest over the inline event bound is attested, kept whole in the blob store and read back by the admission', (t) => withKernelIngress(t, (w) => {
  const saved = process.env.STARCI_KERNEL_REV_ROOT;
  process.env.STARCI_KERNEL_REV_ROOT = w.runtime;
  try {
    // a leg whose brief cites 160 schema files: the read plan of that leg names every one
    for (let i = 0; i < 160; i += 1) w.write(`modules/schemas/big-${i}.yaml`, `id: big-${i}`);
    w.write('modules/ops/ops/review.verify.yaml', Array.from({ length: 160 }, (_, i) => `modules/schemas/big-${i}.yaml`).join(String.fromCodePoint(10)));
    w.git('add', '-A');
    w.git('commit', '-qm', 'a large read plan');
    const required = kernelReadManifest(w.ledger.db, w.workflowId, options(w));
    assert.ok(JSON.stringify(required).length > 16_384, 'the manifest alone is over the inline bound');
    const file = path.join(w.root, 'large-read.json');
    fs.writeFileSync(file, JSON.stringify(required));
    const args = { workflow: w.workflowId, rev: required.rev, 'read-manifest': file, op: 'review.verify' };
    const admitted = callerAdmission(w.ledger, args, { env: { ...process.env, ORCA_TERMINAL_HANDLE: w.handle }, root: w.runtime });
    admitted.run(() => ackRev.run({ ledger: w.ledger, args, caller: admitted.caller, emit() {} }));
    const row = w.ledger.db.prepare("SELECT payload_json, payload_sha FROM events WHERE kind='runtime-rev-acked' ORDER BY seq DESC LIMIT 1").get();
    assert.equal(JSON.parse(row.payload_json).spilled, true, 'the row keeps a bounded inline view of the scalars');
    assert.equal(JSON.parse(row.payload_json).rev, required.rev);
    assert.match(row.payload_sha, /^[0-9a-f]{64}$/);
    assert.equal(eventPayloadOf(row).readManifest.digest, required.digest, 'the whole manifest is behind the sha');
    assert.deepEqual(unreadFiles(w.ledger.db, w.workflowId, required), [], 'the admission reads the attestation back');
    requireKernelRead(w.ledger.db, w.workflowId, { ...options(w), op: 'review.verify' });
  } finally { if (saved === undefined) delete process.env.STARCI_KERNEL_REV_ROOT; else process.env.STARCI_KERNEL_REV_ROOT = saved; }
}));
