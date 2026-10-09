// Replay of the StarCi sequence of 2026-10-09 17:15 (registry: two-revision-acks-disagree-and-one-needs-a-file-the-guard-refuses): the Kernel had acked the revision by
// kernel-ack-rev (runtime-rev-acked) and the revision notice still called it due; the digest printed both lines. After a revision change that owes the Kernel a contract file
// beyond the legacy set, there is ONE ack: the plan carries that file, a token of the legacy set alone is refused, and the ack the gate reads settles the notice.
// Real: the runtime root with git revisions (reviseRuntime), the Kernel verbs as the seat runs them, `starci kernel status`. Stubbed: Orca.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture, replayWorld } from '../helpers/replay-world.mjs';

const fixture = loadFixture('handed-over');
const MENU = 'modules/kernel/kernel-menu.yaml';

test('a revision change that owes the Kernel a file: one plan holds it, one ack settles it, and the status names one revision state', (t) => {
  const world = replayWorld(t, fixture, { tree: true });
  assert.equal(world.ack([]).status, 0, 'the Kernel acks the revision it booted on');
  world.reviseRuntime({ [MENU]: `${'kinds:'}\n  - a\n  - b\n` });

  const owed = world.status().revisionNotice;
  assert.ok(['owed', 'owed-woken'].includes(owed.state), `the change owes the Kernel (${owed.state})`);
  assert.ok(owed.files.includes(MENU));

  const plan = world.cli('kernel-ack-rev', ['--workflow', world.wf, '--plan']);
  assert.equal(plan.status, 0, plan.stderr);
  assert.ok(plan.json.readManifest.files.some((file) => file.path === MENU), 'the one plan carries the owed file');
  const stale = world.cli('kernel-ack-rev', ['--workflow', world.wf, '--rev', plan.json.readManifest.rev, '--digest', 'f'.repeat(64)]);
  assert.notEqual(stale.status, 0, 'a token that is not the digest of the current union is refused');

  const acked = world.cli('revision-ack', ['--workflow', world.wf, '--rev', plan.json.readManifest.rev, '--digest', plan.json.readToken]);
  assert.equal(acked.status, 0, acked.stderr);
  const after = world.status();
  assert.equal(after.kernelRev.stale, false, 'the gate reads the ack');
  assert.ok(['acked-legacy', 'current'].includes(after.revisionNotice.state), `the notice reads the same ack (${after.revisionNotice.state})`);
  const kinds = world.ledger((ledger) => ledger.db.prepare("SELECT kind FROM events WHERE kind IN ('runtime-rev-acked')").all().map((row) => row.kind));
  assert.equal(kinds.length, 2, 'one event kind for every ack, whichever verb spelling attests');
});
