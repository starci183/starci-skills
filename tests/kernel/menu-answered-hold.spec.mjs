// The Kernel is woken only for an item it has not answered, and an answer whose step failed is not asked again while the item's facts stand:
// the StarCi Kernel answered the leg named forgot-password with none-fits 14 times (the event stores the id through the redaction filter, which
// blanks what follows `password:`, so the answer never matched the live id), and the Nivo Kernel answered a failed Critic verdict three times with
// a settle-fail that reverted. Each ask was a wake, and a wake counts toward the 8-wake rotation, so both Kernels were replaced every 10 to 23 minutes.
// A failed Critic verdict is also never offered accept.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { openLedger } from '../../engine/db/ledger.mjs';
import { openDecisionRow } from '../../scripts/machine/decisions.mjs';
import { buildMenu, itemFactsOf } from '../../scripts/kernel/kernel-menu.mjs';


const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CLI = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const WF = 'wf-answered';
const T0 = Date.now() - 3_600_000;
const sources = (over = {}) => ({ workflow: WF, rev: null, jobDecisions: [], questions: [], peers: [], wedged: [], deadWaits: [], decisions: [], nextActions: [], handover: null, snoozed: new Set(), ...over });
const shape = (jobId) => ({ shapeRefused: [{ jobId, op: 'work.author', failedJobId: 'j1', situation: `${jobId} is ready but has the shape of j1` }] });



test('an item whose answer failed is held while its facts are unchanged and offered again when they change', () => {
  const [item] = buildMenu(sources(shape('op-x-1')));
  const answered = new Map([[item.id, itemFactsOf(item)]]);
  assert.equal(buildMenu(sources({ ...shape('op-x-1'), answered })).length, 0, 'the same question and options: nothing new to decide');
  const changed = new Map([[item.id, itemFactsOf({ ...item, question: `${item.question} (and more)` })]]);
  assert.equal(buildMenu(sources({ ...shape('op-x-1'), answered: changed })).length, 1, 'a changed fact asks again');
  const options = new Map([[item.id, itemFactsOf({ ...item, options: item.options.slice(1) })]]);
  assert.equal(buildMenu(sources({ ...shape('op-x-1'), answered: options })).length, 1, 'a changed option asks again');
});

const envOf = (world, extra = {}) => ({ ...process.env, ...extra, [TEST_REGISTRY_ENV]: world.machineFile, STARCI_LOCAL_ROOT: world.machineHome, STARCI_AUTOPILOT: 'off', ORCA_TERMINAL_HANDLE: '' });
const status = (world, extra = {}) => JSON.parse(spawnSync(process.execPath, [CLI, 'status', '--repo', world.repoRoot, '--workflow', WF, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 180_000, env: envOf(world, extra) }).stdout);

/** A reported architecture.decide job the runtime handed over with `code`, and its Decision Item. */
function reportedWith(ledger, code) {
  const REPORTED = 'op-architecture.decide-e78adc94cc';
  const payload = { opId: 'architecture.decide', records: [], owned_paths: ['.starciwork/x'] };
  seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'answered' }, goalIdentity: 'g', goal: { revision: 0, identity: 'g', markdown: '# goal', json: {} },
    jobs: [{ jobId: REPORTED, unitId: REPORTED, opId: 'architecture.decide', status: 'reported', createdAt: T0, dispatchedAt: T0 + 1000, updatedAt: T0 + 120_000, payload }] });
  const { attempt_id: attemptId, dispatch_id: dispatchId } = ledger.db.prepare('SELECT attempt_id, dispatch_id FROM op_attempts WHERE job_id=?').get(REPORTED);
  ledger.db.prepare("INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,created_at) VALUES(?,?,?,'m',?)").run(attemptId, WF, REPORTED, T0);
  ledger.db.prepare('INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(WF, attemptId, dispatchId, REPORTED, 'done', '{}', T0 + 60_000, T0 + 30_000);
  ledger.transaction(() => ledger.appendEvent({ workflowId: WF, entityType: 'job', entityId: REPORTED, attemptId, kind: 'job-settle-needs-kernel',
    payload: { dispatchId, reason: 'settle-refused', code, detail: [code], outcome: 'done', op: 'architecture.decide' } }));
  openDecisionRow(ledger, { workflowId: WF, kind: 'settle-nongreen', entity: { type: 'job', id: REPORTED }, summary: `${REPORTED} reported done: the runtime did not settle it`, by: 'reconciler/job' }, { now: T0 });
  return REPORTED;
}

test('a failed Critic verdict is never offered accept, and the choices say what they do with the critique', (t) => withLedger(t, (world) => {
  const REPORTED = reportedWith(world.ledger, 'op-critic-verdict-failed');
  world.ledger.close();
  const [item] = status(world).menu;
  assert.equal(item.id, `job-decision:${REPORTED}`);
  const choices = item.options.map((option) => option.choice);
  assert.ok(!choices.includes('accept'), `accept settles pass, which the runtime refuses again against a failed verdict: ${choices.join(', ')}`);
  assert.match(item.options.find((option) => option.choice === 'settle-fail').effect, /critique/);
  assert.match(item.options.find((option) => option.choice === 'continue').effect, /critique/);
}));

test('another refusal of a done report still offers accept', (t) => withLedger(t, (world) => {
  reportedWith(world.ledger, 'op-gate-new-findings');
  world.ledger.close();
  assert.ok(status(world).menu[0].options.some((option) => option.choice === 'accept'));
}));

/** A runtime checkout the status reads its revision from: {env, advance()} moves its HEAD, as a land does. */
function revisionRoot(root) {
  const dir = fs.mkdtempSync(path.join(root, 'rev-'));
  const git = (...args) => { const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'spec@starci.test');
  git('config', 'user.name', 'spec');
  let n = 0;
  const advance = () => { fs.writeFileSync(path.join(dir, 'f.txt'), String(n += 1)); git('add', '-A'); git('commit', '-q', '-m', `rev ${n}`); return git('rev-parse', 'HEAD'); };
  advance();
  return { env: { STARCI_KERNEL_REV_ROOT: dir }, head: () => git('rev-parse', 'HEAD'), advance };
}

test('an answer whose step failed holds the item while the facts and the runtime revision stand; a new revision or a changed item offers it again once', (t) => withLedger(t, (world) => {
  const REPORTED = reportedWith(world.ledger, 'op-critic-verdict-failed');
  world.ledger.close();
  const revision = revisionRoot(world.root ?? world.repoRoot);
  const [item] = status(world, revision.env).menu;
  let n = 0;
  const answer = (facts, rev) => {
    const writer = openLedger({ file: world.ledgerFile });
    const id = `dec-spec-${n += 1}`;
    writer.transaction(() => {
      writer.appendEvent({ workflowId: WF, entityType: 'kernel', entityId: id, kind: 'kernel-decision', payload: { hypothesis: 'spec', actionKey: `settle-fail:${item.id}:spec`, metric: 'm', command: 'c', baseline: {}, menu: { item: item.id, choice: 'settle-fail', facts, rev } } });
      writer.appendEvent({ workflowId: WF, entityType: 'kernel', entityId: id, kind: 'kernel-decision-result', payload: { result: 'revert', observed: 'settle failed: workflow-reset-failed' } });
    });
    writer.close();
  };
  const rev1 = revision.head();
  answer('not-the-facts-of-the-item', rev1);
  assert.equal(status(world, revision.env).menu.length, 1, 'an answer to other facts holds nothing back');
  answer(itemFactsOf(item), rev1);
  const held = status(world, revision.env);
  assert.deepEqual(held.menu, [], `${REPORTED}: the failed answer is not asked again at the revision it failed on`);
  assert.equal(held.frontier.actionable, false, 'so the watchdog does not wake the Kernel for it');
  const rev2 = revision.advance();
  assert.notEqual(rev2, rev1);
  const back = status(world, revision.env);
  assert.deepEqual(back.menu.map((entry) => entry.id), [item.id], 'a new runtime revision may cure the failed step: the item is offered again');
  assert.equal(back.frontier.actionable, true, 'and the Kernel is woken for it');
  answer(itemFactsOf(item), rev2);
  assert.deepEqual(status(world, revision.env).menu, [], 'failing again at the new revision holds it again until the next one');
}));

test('a prepared fail decision the runtime kept stays the Kernel\'s after the settler hands the job over again (Nivo 2026-10-09 13:42: kept, then re-handed at a new revision, hidden from both)', (t) => withLedger(t, (world) => {
  const REPORTED = reportedWith(world.ledger, 'workflow-checkpoint-recovery-conflict');
  const { attempt_id: attemptId, dispatch_id: dispatchId } = world.ledger.db.prepare('SELECT attempt_id, dispatch_id FROM op_attempts WHERE job_id=?').get(REPORTED);
  const append = (kind, payload) => world.ledger.transaction(() => world.ledger.appendEvent({ workflowId: WF, entityType: 'job', entityId: REPORTED, attemptId, kind, payload }));
  const handover = () => append('job-settle-needs-kernel', { dispatchId, reason: 'settle-refused', code: 'workflow-checkpoint-recovery-conflict', detail: ['settle must recover its prepared fail decision'], outcome: 'done', op: 'architecture.decide' });
  append('workflow-op-preserved-prepared', { opId: REPORTED, attemptId, resetTo: 'a'.repeat(40) });
  handover();
  world.ledger.close();
  assert.deepEqual(status(world).menu, [], 'a receipt nobody looked at yet is the settler\'s to withdraw or keep');
  const writer = openLedger({ file: world.ledgerFile });
  writer.transaction(() => writer.appendEvent({ workflowId: WF, entityType: 'job', entityId: REPORTED, attemptId, kind: 'workflow-op-preserved-kept', payload: { reason: 'the receipt aims at the live gate base' } }));
  writer.transaction(() => writer.appendEvent({ workflowId: WF, entityType: 'job', entityId: REPORTED, attemptId, kind: 'job-settle-needs-kernel',
    payload: { dispatchId, reason: 'settle-refused', code: 'workflow-checkpoint-recovery-conflict', detail: ['settle must recover its prepared fail decision'], outcome: 'done', op: 'architecture.decide', runtimeRev: 'b'.repeat(40) } }));
  writer.close();
  const [item] = status(world).menu;
  assert.equal(item?.id, `job-decision:${REPORTED}`, 'a kept receipt is an apply to finish, whichever hand-over is the newest');
  assert.ok(!item.options.some((option) => option.choice === 'accept'), 'a pass is refused against a prepared fail decision');
  assert.ok(item.options.some((option) => option.choice === 'settle-fail'));
}));

test('an approved leg that this Kernel life has not attested its READ for says so in its question (StarCi: enqueue refused kernel-read-unverified three lives in a row)', () => {
  const action = { kind: 'dispatch', origin: 'approved-leg-open', op: 'interface.draw', reason: 'approved leg interface.draw has no job' };
  const [bare] = buildMenu(sources({ nextActions: [action] }));
  assert.doesNotMatch(bare.question, /attest/);
  assert.doesNotMatch(bare.question, /\{attest\}/);
  const [noted] = buildMenu(sources({ nextActions: [{ ...action, attest: 'This Kernel life has not attested its READ for interface.draw (19 file(s)): run starci kernel kernel-ack-rev --plan --op interface.draw.' }] }));
  assert.match(noted.question, /not attested its READ for interface\.draw \(19 file\(s\)\)/);
});
