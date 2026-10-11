// How each long-lived seat learns that the runtime tree changed: settled by the runtime when it concerns the seat nothing, woken exactly once
// when it does, replaced only when a rule was removed, attested with a small record whatever the number of files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openLedger } from '../../engine/db/ledger.mjs';
import { openMachine } from '../../engine/db/machine.mjs';
import { eventPayloadOf } from '../../engine/db/event-payload.mjs';
import { revisionRepo } from '../helpers/revision-repo.mjs';
import { attest, noticeFor, planRead, recordReplaced, recordWoken, runtimePass } from '../../scripts/machine/revision-ack.mjs';
import { kernelSeat, supervisorSeat } from '../../scripts/machine/revision-seats.mjs';
import { NOTICE_EVENT, noticeLine, noticeWakeLine } from '../../scripts/machine/revision-notice.mjs';
import { contractReplacement } from '../../scripts/machine/revision-replace.mjs';
import { planWake } from '../../scripts/supervisor/supervisor-watchdog.mjs';
import { idleWakesOf } from '../../scripts/kernel/kernel-watchdog.mjs';
import { proofsOwedUnder, settleRevisionPayload } from '../../scripts/kernel/settle-revision.mjs';
import { EVENT_LIMITS } from '../../engine/db/event-compact.mjs';
import revisionAckVerb from '../../scripts/kernel/verbs/revision-ack.mjs';
import { kernelNoticeOf } from '../../scripts/kernel/kernel-notice.mjs';
import { revisionAck } from '../../scripts/supervisor/revision-ack.mjs';

const WF = 'wf-notice';
const KERNEL_FILE = 'modules/kernel/driver-loop.yaml';
const SUPERVISOR_FILE = 'modules/supervisor/supervisor-menu.yaml';
function withRevRoot(t, root) {
  const saved = process.env.STARCI_KERNEL_REV_ROOT;
  process.env.STARCI_KERNEL_REV_ROOT = root;
  t.after(() => { if (saved === undefined) delete process.env.STARCI_KERNEL_REV_ROOT; else process.env.STARCI_KERNEL_REV_ROOT = saved; });
}
const GROWN_MENU = ['items:', '  - a', '  - b', ''].join(String.fromCodePoint(10));
const GROWN_STEPS = ['steps:', '  - a', '  - b', ''].join(String.fromCodePoint(10));

/** A repository, a Kernel ledger and a Supervisor machine store, all at temp paths; every seat starts fresh at the base revision. */
function world(t, files = {}) {
  const repo = revisionRepo(t, { files: { [KERNEL_FILE]: 'steps:\n  - a\n', [SUPERVISOR_FILE]: 'items:\n  - a\n', ...files } });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-notice-'));
  const ledger = openLedger({ file: path.join(dir, 'runtime.sqlite') });
  ledger.write.createWorkflow({ workflowId: WF });
  const m = openMachine({ file: path.join(dir, 'machine.sqlite') });
  t.after(() => { ledger.close(); m.close(); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  const head = () => repo.git('rev-parse', 'HEAD');
  const w = { repo, ledger, m, head,
    kernel: () => kernelSeat({ ledger, workflowId: WF, root: repo.root, current: head() }),
    supervisor: () => supervisorSeat({ m, root: repo.root, current: head() }),
    notices: () => ledger.db.prepare('SELECT payload_json, payload_sha FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(WF, NOTICE_EVENT).map(eventPayloadOf) };
  recordReplaced(w.kernel(), 'boot');
  recordReplaced(w.supervisor(), 'boot');
  return w;
}

test('a docs-only change: the runtime settles both seats not-concerned with the diff hash, nobody is woken and nothing is owed', (t) => {
  const w = world(t);
  w.repo.commit('docs', { 'docs/a.md': '# a\n', 'CHANGELOG.md': 'x\n' });
  for (const seat of [w.kernel(), w.supervisor()]) {
    const first = runtimePass(seat, { repair: true });
    assert.equal(first.wrote, 'not-concerned');
    assert.equal(first.notice.state, 'current');
    assert.equal(runtimePass(seat, { repair: true }).wrote, null, 'settled once: the second pass writes nothing');
  }
  const settled = w.notices().filter((p) => p.verdict === 'not-concerned');
  assert.equal(settled.length, 1, 'the Kernel ledger holds one record');
  assert.match(settled[0].digest, /^[0-9a-f]{64}$/);
  assert.equal(settled[0].count, 2);
  assert.ok(JSON.stringify(settled[0]).length < 600, 'a small payload: revisions, count and hash');
  assert.equal(JSON.stringify(settled[0]).includes('CHANGELOG'), false, 'no file list in the record');
});

test('replay: docs change reads nothing; a Kernel contract change is read by the Kernel once and not by the Supervisor; a Supervisor contract change by the Supervisor once', (t) => {
  const w = world(t);
  const wakes = { kernel: 0, supervisor: 0 };
  const tick = () => {
    for (const role of ['kernel', 'supervisor']) {
      const seat = w[role]();
      const { notice } = runtimePass(seat, { repair: true });
      if (notice.state === 'owed') { wakes[role] += 1; recordWoken(seat, notice); }
    }
  };
  w.repo.commit('docs', { 'docs/a.md': '# a\n' });
  tick(); tick();
  assert.deepEqual(wakes, { kernel: 0, supervisor: 0 });
  w.repo.commit('kernel rule added', { [KERNEL_FILE]: 'steps:\n  - a\n  - b\n' });
  tick(); tick(); tick();
  assert.deepEqual(wakes, { kernel: 1, supervisor: 0 }, 'woken exactly once however many ticks pass');
  assert.equal(noticeFor(w.kernel()).state, 'owed-woken');
  assert.equal(noticeFor(w.supervisor()).state, 'current');
  w.repo.commit('supervisor rule added', { [SUPERVISOR_FILE]: 'items:\n  - a\n  - b\n' });
  tick(); tick();
  assert.deepEqual(wakes, { kernel: 1, supervisor: 1 });
});

test('several commits deployed together are ONE change: one wake, one list of files', (t) => {
  const w = world(t);
  w.repo.commit('one', { [KERNEL_FILE]: 'steps:\n  - a\n  - b\n' });
  w.repo.commit('two', { 'docs/x.md': 'x\n' });
  w.repo.commit('three', { [KERNEL_FILE]: 'steps:\n  - a\n  - b\n  - c\n', 'modules/kernel/owner-rulings.yaml': 'rulings:\n  - r\n' });
  const { notice } = runtimePass(w.kernel(), { repair: true });
  assert.equal(notice.state, 'owed');
  assert.deepEqual(notice.files, [KERNEL_FILE, 'modules/kernel/owner-rulings.yaml']);
  assert.match(noticeWakeLine(notice, 'starci kernel revision-ack --workflow wf'), /changed 2 file\(s\) of your contract/);
});

test('a revision that moves again before the seat acked is a new change from the newest settled revision', (t) => {
  const w = world(t);
  w.repo.commit('one', { [KERNEL_FILE]: 'steps:\n  - a\n  - b\n' });
  const first = runtimePass(w.kernel(), { repair: true }).notice;
  recordWoken(w.kernel(), first);
  w.repo.commit('two', { [KERNEL_FILE]: 'steps:\n  - a\n  - b\n  - c\n' });
  const second = runtimePass(w.kernel(), { repair: true }).notice;
  assert.equal(second.state, 'owed', 'the new revision is woken for once more: one wake per revision change');
  assert.equal(second.from, first.from, 'measured from the newest settled revision');
});

test('an attestation of 500 files stays far under the 16 KB event limit: the record carries a hash and a count, the list lives in the blob store', (t) => {
  const w = world(t);
  const many = {};
  for (let i = 0; i < 500; i += 1) many[`modules/models/extra-${i}.yaml`] = `model: fixture-${i}\n`;
  w.repo.commit('five hundred verbs', many);
  const seat = w.kernel();
  const { notice, manifest } = planRead(seat);
  assert.equal(notice.state, 'owed');
  assert.equal(manifest.files.length, 500);
  assert.ok(JSON.stringify(manifest).length > EVENT_LIMITS.payloadBytes, 'the manifest alone would not fit an event');
  attest(seat, manifest);
  const row = w.ledger.db.prepare('SELECT payload_json, payload_sha, length(payload_json) AS bytes FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT 1').get(WF, NOTICE_EVENT);
  assert.match(row.payload_sha, /^[0-9a-f]{64}$/, 'the list is behind the sha: the one spill path of the event writer');
  assert.ok(row.bytes <= EVENT_LIMITS.payloadBytes, `the inline view is ${row.bytes} bytes`);
  const payload = eventPayloadOf(row);
  assert.equal(payload.verdict, 'acked');
  assert.equal(payload.count, 500);
  assert.equal(payload.files.length, 500, 'the whole list is in the resolved payload');
  assert.equal(noticeFor(w.kernel()).state, 'current');
});

test('a manifest that is not the complete current read is refused and settles nothing', (t) => {
  const w = world(t);
  w.repo.commit('rule', { [KERNEL_FILE]: 'steps:\n  - a\n  - b\n' });
  const seat = w.kernel();
  const { manifest } = planRead(seat);
  assert.throws(() => attest(seat, { ...manifest, files: [] }), /not the complete current read/);
  assert.throws(() => attest(seat, null), /not the complete current read/);
  assert.equal(noticeFor(w.kernel()).state, 'owed');
  assert.throws(() => attest(w.supervisor(), manifest), /no revision change is owed/);
});

test('the Supervisor verb lists the owed files and attests them by readToken or by file (the Kernel has the one attestation of kernel-ack-rev: tests/kernel/one-ack.spec.mjs)', (t) => {
  const w = world(t);
  withRevRoot(t, w.repo.root);
  w.repo.commit('rules', { [SUPERVISOR_FILE]: GROWN_MENU });
  const plan = revisionAck(w.m, { plan: true });
  assert.deepEqual(plan.readManifest.files.map((f) => f.path), [SUPERVISOR_FILE]);
  assert.equal(plan.readToken, plan.readManifest.digest);
  const file = path.join(w.repo.root, 'manifest.json');
  fs.writeFileSync(file, JSON.stringify(plan.readManifest));
  assert.equal(revisionAck(w.m, { rev: 'f'.repeat(40), manifestFile: file }).ok, false);
  assert.equal(revisionAck(w.m, { rev: w.head(), digest: 'f'.repeat(64) }).ok, false, 'a wrong token attests nothing');
  assert.equal(revisionAck(w.m, { rev: w.head(), digest: plan.readToken }).ok, true);
  assert.equal(noticeFor(w.supervisor()).state, 'current');
});

test('the Kernel ack of the current revision settles the update in place for the files it named: there is one ack, and a file it never named stays owed', (t) => {
  const w = world(t);
  w.repo.commit('rule', { [KERNEL_FILE]: GROWN_STEPS });
  const ack = (files) => w.ledger.transaction(() => w.ledger.appendEvent({ workflowId: WF, entityType: 'kernel', entityId: WF, kind: 'runtime-rev-acked', payload: { rev: w.head(), files, source: 'ack' }, createdAt: Date.now() }));
  ack(['modules/kernel/api.yaml']);
  assert.equal(noticeFor(w.kernel()).state, 'owed', 'an ack that never named the owed file settles nothing');
  ack([KERNEL_FILE]);
  const pass = runtimePass(w.kernel(), { repair: true });
  assert.equal(pass.wrote, 'acked');
  assert.equal(pass.notice.state, 'current');
});

test('a seat that never acked is owed the changes since it booted, not only those after its first look', (t) => {
  const w = world(t);
  w.repo.commit('rule', { [SUPERVISOR_FILE]: GROWN_MENU });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-never-acked-'));
  const fresh = openMachine({ file: path.join(dir, 'machine.sqlite') });
  t.after(() => { fresh.close(); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  const seat = { ...supervisorSeat({ m: fresh, root: w.repo.root, current: w.head() }), bootRev: () => w.repo.base };
  const first = runtimePass(seat, { repair: true, adopt: true });
  assert.equal(first.wrote, 'baseline');
  assert.equal(first.notice.from, w.repo.base, 'the baseline is the revision it booted on');
});

test('a removed rule is replace-due, never an update; the replacement settles the notice and a fresh seat is not replaced twice', (t) => {
  const w = world(t);
  w.repo.commit('rule removed', { [KERNEL_FILE]: 'steps:\n  - b\n' });
  const { notice } = runtimePass(w.kernel(), { repair: true });
  assert.equal(notice.state, 'replace-due');
  assert.deepEqual(notice.replaceFiles, [KERNEL_FILE]);
  const due = contractReplacement(notice);
  assert.match(due.reason, /^contract-changed: 1 rule file\(s\) changed or lost a rule between/);
  assert.equal(contractReplacement({ state: 'owed' }), null);
  assert.equal(planWake({ revision: notice }).text, null, 'a replacement is not a wake');
  recordReplaced(w.kernel(), due.reason);
  assert.equal(noticeFor(w.kernel()).state, 'current');
  assert.equal(noticeFor(w.supervisor()).state, 'not-concerned', 'the Supervisor is not concerned by a Kernel rule');
});

test('an unmeasurable diff is replace-due: unsure means the heavier action', (t) => {
  const w = world(t);
  const lost = kernelSeat({ ledger: w.ledger, workflowId: WF, root: w.repo.root, current: 'a'.repeat(40) });
  assert.equal(noticeFor(lost).state, 'replace-due');
});

test('the Supervisor wake carries the revision once; no second wake for the same revision, and no wake at all for a change it is not concerned by', (t) => {
  const w = world(t);
  w.repo.commit('rule', { [SUPERVISOR_FILE]: 'items:\n  - a\n  - b\n' });
  const { notice } = runtimePass(w.supervisor(), { repair: true });
  const plan = planWake({ revision: notice });
  assert.deepEqual(plan.tags, ['revision']);
  assert.equal(plan.revision, notice.to);
  assert.match(plan.text, /\[revision\] Runtime rev .* changed 1 file\(s\) of your contract/);
  recordWoken(w.supervisor(), plan.revisionNotice);
  assert.deepEqual(planWake({ revision: noticeFor(w.supervisor()) }).tags, []);
  assert.deepEqual(planWake({ revision: noticeFor(w.kernel()) }).tags, []);
});

test('the wake adds no loop: one wake per concerned revision change, which the rotation and idle-replace counters absorb', (t) => {
  const w = world(t);
  const rows = [];
  let woken = 0;
  for (let change = 1; change <= 3; change += 1) {
    w.repo.commit(`rule ${change}`, { [KERNEL_FILE]: `steps:\n  - a\n${'  - b\n'.repeat(change)}` });
    for (let tickNo = 0; tickNo < 5; tickNo += 1) {
      const { notice } = runtimePass(w.kernel(), { repair: true });
      if (notice.state === 'owed') { woken += 1; recordWoken(w.kernel(), notice); rows.push({ kind: 'kernel-woken', created_at: Date.now() }); }
    }
    attest(w.kernel(), planRead(w.kernel()).manifest);
    rows.push({ kind: 'runtime-rev-acked', created_at: Date.now() });
  }
  assert.equal(woken, 3, 'three concerned changes, three wakes, however many ticks');
  assert.equal(idleWakesOf(rows, { now: Date.now() + 3_600_000 }).due, false, 'each ack is an activity record: the idle-replace streak (WAKE_IDLE_REPLACE) never builds');
});

test('one line per seat: revision acked, concerned or not, files owed', (t) => {
  const w = world(t);
  assert.match(noticeLine(noticeFor(w.kernel())), /^kernel acked rev [0-9a-f]{12}$/);
  w.repo.commit('docs', { 'docs/a.md': '# a\n' });
  assert.match(noticeLine(noticeFor(w.kernel())), /^kernel not concerned by rev [0-9a-f]{12}$/);
  w.repo.commit('rule', { [KERNEL_FILE]: 'steps:\n  - a\n  - b\n' });
  assert.match(noticeLine(noticeFor(w.kernel())), /^kernel owes 1 file\(s\) of rev [0-9a-f]{12}$/);
  assert.match(noticeLine(noticeFor(w.supervisor())), /^supervisor not concerned by rev/);
  const saved = process.env.STARCI_KERNEL_REV_ROOT;
  process.env.STARCI_KERNEL_REV_ROOT = w.repo.root;
  t.after(() => { if (saved === undefined) delete process.env.STARCI_KERNEL_REV_ROOT; else process.env.STARCI_KERNEL_REV_ROOT = saved; });
  const field = kernelNoticeOf(w.ledger.db, WF, { root: w.repo.root });
  assert.match(field.line, /^kernel owes 1 file/);
});

test('settle records, per proof the op owes, whether the rules of its judge moved since the admission', (t) => {
  const w = world(t);
  const admitted = w.head();
  w.repo.commit('rules moved', { 'knowledge/op-gate.yaml': 'a: 1\n', 'modules/kernel/critic.yaml': 'a: 1\n', 'docs/a.md': '# a\n' });
  const owed = proofsOwedUnder(w.repo.root, 'backend.implement', admitted, w.head(), { owes: { 'op-gate': () => true, 'independent-critic': () => true, 'sonar-gate': () => true } });
  assert.equal(owed.known, true);
  assert.deepEqual(owed.proofs.map((p) => [p.proof, p.moved]), [['sonar-gate', false], ['op-gate', true], ['independent-critic', true]]);
  assert.equal(owed.proofs.find((p) => p.proof === 'independent-critic').admissionAware, true);
  const payload = settleRevisionPayload({ op: 'backend.implement', attempt: 3, owed });
  assert.deepEqual(payload.moved.map((m) => m.proof), ['op-gate', 'independent-critic']);
  assert.deepEqual([payload.admitted, payload.judged], [admitted, w.head()]);
  const same = proofsOwedUnder(w.repo.root, 'backend.implement', w.head(), w.head(), { owes: { 'op-gate': () => true } });
  assert.deepEqual(same.proofs.map((p) => p.moved), [false], 'an attempt judged under its own revision has nothing moved');
});

test('an attempt in flight is stopped by no rule change: the admission keeps its own contract files and the change only reaches the next try', (t) => {
  const w = world(t);
  const admitted = w.head();
  w.repo.commit('brief changed', { 'modules/ops/ops/interface.draw.yaml': 'a: 2\n' });
  const scope = noticeFor(w.kernel());
  assert.equal(scope.state, 'owed', 'the Kernel re-reads before it enqueues the next try');
  const owed = proofsOwedUnder(w.repo.root, 'interface.draw', admitted, w.head(), { owes: { 'proof-media': () => true } });
  assert.deepEqual(owed.proofs.map((p) => p.moved), [true], 'the settle can say the brief moved after the admission; it refuses nothing');
});
