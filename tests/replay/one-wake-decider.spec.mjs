// Replay of the double decision of the Kernel's re-read wake (registry: kernel-revision-wake-decided-twice; the case of 2026-10-09 17:15 where the two disagreed): runtime-rev.mjs decided
// from its own path list, its 30-minute window and its file cap, the revision notice decided from modules/kernel/revision-scope.yaml, and the watchdog typed `notice || rev`, so after an
// op-contract land inside the window the status said `kernelRev.stale false` while the notice said owed, the menu had no item and the wake named a different file set, and after a
// modified rule the status asked for a re-read of files the notice called a replacement.
// Sequence: a Kernel that acked the revision it booted on; (1) an op contract lands at once; (2) the Kernel attests; (3) a rule of the Kernel contract is modified.
// Real: the runtime root with git revisions, the Kernel verbs as the seat runs them, `starci kernel status`, the watchdog's wake text. Stubbed: Orca. Fixture: read-plan (neutral).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';
import { wakePromptOf } from '../../scripts/kernel/kernel-watchdog.mjs';

const OP = 'review.verify';
const BRIEF = `modules/ops/ops/${OP}.yaml`;
const revSentences = (text) => text.match(/Runtime rev [0-9a-f]{12}[ .:]/g) ?? [];

test('one decider: the status field, the menu, the next action, the wake and the gate give one answer for every revision change', (t) => {
  const world = replayWorld(t, loadFixture('read-plan'));
  assert.equal(world.ack([OP]).status, 0, 'the Kernel attests the revision it booted on');
  assert.equal(world.status().kernelRev, undefined, 'the status has one revision field');
  const wake = (status) => wakePromptOf(world.wf, { kernel: { attempt: 1 }, revisionNotice: status.revisionNotice });

  // 1. An op contract lands within seconds of the ack. The table says reread: owed at once, no second window.
  world.reviseRuntime({ [BRIEF]: `id: ${OP}\nnote: a rule the Kernel must read\n` }, 'an op contract changes');
  const owed = world.status();
  assert.equal(owed.revisionNotice.state, 'owed');
  assert.deepEqual(owed.revisionNotice.files, [BRIEF]);
  assert.ok(owed.menu.some((item) => item.kind === 'rev-ack'), 'the menu carries the duty');
  assert.equal(owed.nextActions[0]?.kind, 'reread');
  assert.deepEqual(owed.nextActions[0].files, owed.revisionNotice.files, 'the next action names the files the notice owes');
  const text = wake(owed);
  assert.ok(text.includes(BRIEF), 'the wake names the same file');
  assert.equal(revSentences(text).length, 1, `one sentence about the revision: ${text}`);
  assert.equal(world.cli('enqueue', ['--workflow', world.wf, '--op', OP, '--paths', 'docs/x', '--params', '{invalid']).json?.code, 'kernel-read-unverified', 'the gate waits for the same attestation');

  // 2. One attestation settles all of them.
  assert.equal(world.ack([OP]).status, 0);
  const settled = world.status();
  assert.ok(['current', 'acked-legacy'].includes(settled.revisionNotice.state), settled.revisionNotice.state);
  assert.ok(!settled.menu.some((item) => item.kind === 'rev-ack'));
  assert.notEqual(settled.nextActions[0]?.kind, 'reread');
  assert.equal(wake(settled).includes(BRIEF), false, 'the wake asks nothing more');
  assert.equal(world.cli('enqueue', ['--workflow', world.wf, '--op', OP, '--paths', 'docs/x', '--params', '{invalid']).json?.code, 'params-invalid', 'the gate lets the leg through to its own validation');

  // 3. A rule of the Kernel contract is modified: the table says replace. The seat is replaced at its next yield; nobody asks it to re-read.
  world.reviseRuntime({ 'modules/kernel/driver-loop.yaml': 'tick: a rule reversed\n' }, 'a rule of the Kernel contract is modified');
  const replaced = world.status();
  assert.equal(replaced.revisionNotice.state, 'replace-due');
  assert.ok(!replaced.menu.some((item) => item.kind === 'rev-ack'), 'no re-read is asked of a seat that is being replaced');
  assert.notEqual(replaced.nextActions[0]?.kind, 'reread');
  assert.deepEqual(replaced.revisionNotice.replaceFiles, ['modules/kernel/driver-loop.yaml']);
  assert.equal(revSentences(wake(replaced)).length, 1);
  assert.doesNotMatch(wake(replaced), /changed \d+ file/, 'and the wake carries the revision only');
});
