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

import { kernelSeat } from '../../scripts/machine/revision-seats.mjs';
import { noticeFor } from '../../scripts/machine/revision-ack.mjs';


const run = (verb, w, args) => {
  const admitted = callerAdmission(w.ledger, args, { env: { ...process.env, ORCA_TERMINAL_HANDLE: w.handle }, root: w.runtime });
  let out = null;
  admitted.run(() => verb.run({ ledger: w.ledger, args, caller: admitted.caller, emit: (value) => { out = value; } }));
  return out;
};






// The union: what the ack plans is the legacy required set UNION what the revision change owes this Kernel; its token is the digest of exactly that union.
import { recordReplaced } from '../../scripts/machine/revision-ack.mjs';


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
