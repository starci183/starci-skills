import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { KERNEL_REV_ACKED_EVENT } from '../../scripts/kernel/runtime-rev.mjs';
import { git, statusWorld as fixture, write } from '../helpers/kernel-status-world.mjs';

// starci kernel status took 26-31 s per workflow under load (8 s idle) on the live nivo ledger: nearly all of it process
// starts. runtime-rev.mjs re-resolved the current runtime rev once per running job and re-diffed the same commit
// pair on every call, two typed waits naming the same --until-commit target ran the same git reads twice, and the
// Orca reads of every worker terminal ran one after another. Status now memoises read-only git reads (within the
// call; across calls when every revision is a full commit sha, HEAD pinned to its sha) and runs its Orca reads in
// parallel ahead of the projection - with the same output.

// The fields a status projection stamps from the clock (the autopilot budget's wallMs among them), from a live terminal's output
// time, or from the host's live RAM sample.
const VOLATILE = new Set(['observedAt', 'outputAgeMs', 'lastOutputAt', 'expires_at', 'expiresAt', 'generatedAt', 'heartbeatAgeMs', 'waitedMinutes', 'weight', 'now', 'at', 'ageMs', 'wallMs', 'ramThrottle']);
const stable = (value) => (Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => !VOLATILE.has(key)).map(([key, v]) => [key, stable(v)]))
  : value);
const duplicates = (list) => [...new Set(list.filter((item, index) => list.indexOf(item) !== index))];
const pinnedGitReads = (reads) => reads.filter((argv) => /\b[0-9a-f]{40}\b/.test(argv) && /\b(rev-parse|diff|show)\b/.test(argv));

test('starci kernel status runs no git read twice in one call, and a repeat call runs none of its commit-pinned reads', (t) => {
  const fx = fixture(t);
  assert.match(fx.A, /^[0-9a-f]{40}$/, 'revision A of the runtime is a full commit sha');
  assert.notEqual(fx.A, fx.B, 'the world holds two revisions of the runtime');
  const cold = fx.status();
  assert.equal(cold.out.kernelRev.stale, true, 'the fixture is a stale Kernel: runtime-rev diffs A..B');
  assert.deepEqual(cold.out.runningOpRevDrift.map((w) => [w.jobId, w.from, w.to, w.files]),
    [['job-d1', fx.A, fx.B, ['modules/ops/ops/interface.draw.yaml']], ['job-d2', fx.A, fx.B, ['modules/ops/ops/interface.draw.yaml']]]);
  // Each cat-file --batch call has a different revision on stdin, which the spawn tracer cannot display.
  assert.deepEqual(duplicates(cold.git.filter((read)=>read!=='cat-file --batch')), [], `one status call repeated these git reads:\n${cold.git.join('\n')}`);
  assert.ok(pinnedGitReads(cold.git).length > 0, 'the cold call reads the commit pair from git');

  const warm = fx.status();
  assert.deepEqual(pinnedGitReads(warm.git), [], `a repeat status re-ran reads whose answer is fixed by commit shas:\n${warm.git.join('\n')}`);
  assert.deepEqual(stable(warm.out), stable(cold.out), 'the memo answers exactly what git answered');

  // Each worker terminal is shown and read once per call, in parallel ahead of the projection (execFile).
  const verbs = warm.orca.map((call) => call.argv.slice(0, 2).join(' ') + (call.argv.includes('--terminal') ? ` ${call.argv[call.argv.indexOf('--terminal') + 1]}` : ''));
  for (const handle of ['term_w1', 'term_w2']) {
    assert.equal(verbs.filter((v) => v === `terminal show ${handle}`).length, 1, verbs.join('\n'));
    assert.equal(verbs.filter((v) => v === `terminal read ${handle}`).length, 1, verbs.join('\n'));
  }
  assert.ok(warm.spawns.filter((s) => s.fn === 'execFile').length >= 4, 'the worker terminal reads ran through the parallel prefetch');
  assert.deepEqual(warm.out.workers.map((w) => [w.jobId, w.terminalHandle, w.connected]), [['job-d1', 'term_w1', true], ['job-d2', 'term_w2', true]]);
});

test('starci kernel status output is identical with the memo off, cold and warm', (t) => {
  const fx = fixture(t);
  fx.restore(); const off = fx.status({ STARCI_STATUS_MEMO: 'off' });
  fx.restore(); const cold = fx.status();
  fx.restore(); const warm = fx.status();
  assert.ok(off.git.length > cold.git.length, `the memo saves git reads within one call (${off.git.length} -> ${cold.git.length})`);
  assert.ok(cold.git.length > warm.git.length, `and across calls (${cold.git.length} -> ${warm.git.length})`);
  assert.deepEqual(stable(cold.out), stable(off.out));
  assert.deepEqual(stable(warm.out), stable(off.out));
  assert.deepEqual([off.out.kernelRev.acked, off.out.kernelRev.current, off.out.kernelRev.files], [fx.A, fx.B, ['modules/ops/ops/interface.draw.yaml']]);
  assert.equal(off.out.nextActions[0].kind, 'reread');
});

test('the memo follows HEAD, and a revision git did not know is asked again, never remembered', (t) => {
  const fx = fixture(t);
  const open = fx.status();
  assert.deepEqual(open.out.frontier.gateConditions.map((g) => [g.incidentId, g.met]), fx.gates.map((id) => [id, false]));
  // Committing the awaited path moves the other repo's HEAD: the HEAD-pinned reads are new keys, read live.
  git(fx.other, 'add', '-A'); git(fx.other, 'commit', '-qm', 'app');
  fx.status();
  const states = fx.seed((l) => fx.gates.map((id) => l.db.prepare('SELECT status FROM incidents WHERE incident_id=?').get(id).status));
  assert.deepEqual(states, ['resolved', 'resolved'], 'the commit released both gates through a warm memo');

  // An acked rev the runtime root does not have yet reads unknown; once it lands, status diffs it.
  const clone = path.join(fx.dir, 'clone');
  git(fx.dir, 'clone', '-q', fx.rt, clone);
  git(clone, 'config', 'user.email', 'spec@example.test'); git(clone, 'config', 'user.name', 'spec'); git(clone, 'config', 'commit.gpgsign', 'false');
  write(clone, 'modules/kernel/driver-loop.yaml', 'loop: 2\n'); git(clone, 'add', '-A'); git(clone, 'commit', '-qm', 'D');
  const D = git(clone, 'rev-parse', 'HEAD');
  fx.seed((l) => l.transaction(() => l.appendEvent({ workflowId: fx.wf, entityType: 'kernel', entityId: fx.wf, kind: KERNEL_REV_ACKED_EVENT, payload: { rev: D, files: [], source: 'ack' } })));
  const unknown = fx.status();
  assert.deepEqual([unknown.out.kernelRev.acked, unknown.out.kernelRev.unknownDiff], [D, true]);
  git(fx.rt, 'fetch', '-q', clone, 'HEAD');
  const known = fx.status();
  assert.equal(known.out.kernelRev.unknownDiff, undefined, 'the failed resolve was not remembered');
  // D is B's child (the clone was taken at B): D..B is D's driver-loop edit alone.
  assert.deepEqual([known.out.kernelRev.stale, known.out.kernelRev.files], [true, ['modules/kernel/driver-loop.yaml']]);
});
