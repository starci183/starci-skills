import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMachine } from '../../engine/db/machine.mjs';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { incidentPolicy, boundValue } from '../../scripts/kernel/op-incident-policy.mjs';
import { analyze } from '../../scripts/reconciler/debug-digest-analyze.mjs';
import { digestNumbers } from '../../scripts/reconciler/debug-digest-numbers.mjs';
import { machineFacts } from '../../scripts/reconciler/debug-digest-machine.mjs';
import { collectSnapshot, ledgerFacts } from '../../scripts/reconciler/debug-digest-collect.mjs';
import { renderText } from '../../scripts/reconciler/debug-digest-render.mjs';
import { main } from '../../scripts/reconciler/debug-digest.mjs';

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const REV = 'a'.repeat(40);
const policy = { ...incidentPolicy(), resolve: boundValue };
const numbers = digestNumbers();
const digest = (snapshot) => analyze(snapshot, policy, numbers);

const job = (over = {}) => ({ jobId: 'op-x-1', kind: 'op', opId: 'x', status: 'running', tryNo: 1, retryOf: null, workerId: 'w', deadline: null,
  createdAt: NOW - 60 * MIN, updatedAt: NOW - 5 * MIN, ...over });
const status = (over = {}) => ({ frontier: { state: 'engaged', openOperations: 1, readyOperations: 0, queued: [] }, legs: [], awaitingOwner: [],
  kernelRev: { current: REV, acked: REV, stale: false, fileCount: 0 }, usage: { byOp: [{ opId: 'x', tokens: 1200, turns: 3, attempts: 1, costUsd: 0.5 }] }, ...over });
const workflow = (over = {}) => ({ id: 'wf-1', name: 'Shop', ledger: 'shop', repo: 'work/shop', phase: 'running', jobs: [job(), job({ jobId: 'kernel-wf-1', kind: 'kernel', opId: null })],
  incidents: [], decisions: [], kernelJob: { status: 'running', updatedAt: NOW - MIN }, kernelSignal: { terminal: 'term_k' }, lastKernelWakeAt: NOW - 2 * MIN,
  status: status(), statusError: null, seatProbe: { action: 'idle-waiting' }, ...over });
const snapshot = (over = {}) => ({ now: NOW, liveRev: REV,
  engine: { leader: { pid: 7, epoch: 3, heartbeatAt: NOW - 10_000, rev: REV }, modes: { job: 'active', host: 'active' }, configured: { job: 'active', host: 'active' }, safe: [], failingQueue: [] },
  supervisor: { seat: { state: 'live', terminalHandle: 'term_s', lastSeenAt: NOW - MIN, lastInputOkAt: NOW - MIN, deaf: false }, enabled: true, lastWakeAt: NOW - MIN, decisions: [], health: { live: true } },
  reservations: [], seats: ['supervisor'], supJobs: [], workflows: [workflow()], ...over });
const keys = (d) => d.problems.map((p) => p.key);

test('a healthy workflow lists no problem and the digest says so in the owner language', () => {
  const d = digest(snapshot());
  assert.deepEqual(d.problems, []);
  assert.equal(d.ok, true);
  assert.equal(d.workflows[0].running[0].op, 'x');
  assert.deepEqual(d.workflows[0].usage, [{ op: 'x', tokens: 1200, turns: 3, attempts: 1, costUsd: 0.5 }]);
  assert.match(renderText(d, { language: 'en' }), /No problem found\./);
  assert.match(renderText(d, { language: 'vi' }), /Không thấy vấn đề nào\./);
});

test('a job held past its deadline names the hold, its handler, the step and the overdue time', () => {
  const hold = policy.holds.find((h) => h.queuedBecause === 'path-lease');
  const deadline = policy.resolve(hold.bound.deadlineMs);
  const waiting = job({ jobId: 'op-held-1', opId: 'held', status: 'queued', updatedAt: NOW - deadline - 7 * MIN });
  const wf = workflow({ jobs: [job(), waiting], status: status({ frontier: { state: 'engaged', openOperations: 2, queued: [{ jobId: 'op-held-1', opId: 'held', queuedBecause: 'path-lease', detail: 'lease held by op-x-1' }] } }) });
  const d = digest(snapshot({ workflows: [wf] }));
  const held = d.workflows[0].held[0];
  assert.deepEqual([held.hold, held.handler, held.overdue, held.step.kind], ['path-lease', hold.handler, true, 'bound-spent']);
  assert.equal(d.problems[0].key, 'hold-op-held-1');
  assert.equal(d.problems[0].params.min, 7);
  assert.match(renderText(d), /held by path-lease 7 min past its deadline/);
  const inside = digest(snapshot({ workflows: [workflow({ jobs: [job(), { ...waiting, updatedAt: NOW - MIN }], status: wf.status })] }));
  assert.equal(inside.workflows[0].held[0].overdue, false);
  assert.deepEqual(inside.problems, []);
});

test('a hold the policy table does not list is a problem of its own', () => {
  const wf = workflow({ status: status({ frontier: { openOperations: 1, queued: [{ jobId: 'op-x-1', opId: 'x', queuedBecause: 'mystery' }] } }) });
  assert.deepEqual(keys(digest(snapshot({ workflows: [wf] }))), ['hold-unlisted-op-x-1']);
});

test('a dead Kernel outranks the held work it leaves behind and an idle Kernel with ready work is named', () => {
  const dead = workflow({ kernelJob: { status: 'failed', updatedAt: NOW }, seatProbe: { action: 'restart-needed' } });
  const d = digest(snapshot({ workflows: [dead] }));
  assert.equal(d.workflows[0].kernel.alive, false);
  assert.equal(d.problems[0].key, 'kernel-dead-wf-1');
  const idle = workflow({ lastKernelWakeAt: NOW - 120 * MIN, status: status({ frontier: { state: 'idle', openOperations: 2, readyOperations: 2, queued: [] } }) });
  const found = digest(snapshot({ workflows: [idle] }));
  assert.deepEqual(keys(found), ['kernel-idle-wf-1']);
  assert.equal(found.problems[0].blocks, 2);
});

test('a Kernel that acked an older runtime than the current one is reported with the files behind', () => {
  const stale = workflow({ status: status({ kernelRev: { current: REV, acked: 'b'.repeat(40), stale: true, fileCount: 3 } }) });
  const d = digest(snapshot({ workflows: [stale] }));
  assert.deepEqual(keys(d), ['kernel-rev-wf-1']);
  assert.equal(d.problems[0].params.files, 3);
});

test('a stale Supervisor gate and a Decision Item past due are listed with their overdue time; a dead seat outranks both', () => {
  const decisions = [{ id: 'di-1', kind: 'supervisor-gate', decider: 'supervisor', dueAt: NOW - 30 * MIN, summary: 'budget', workflowId: 'wf-1' },
    { id: 'di-2', kind: 'push-refused', decider: 'supervisor', dueAt: NOW + MIN, summary: 'later', workflowId: null }];
  const d = digest(snapshot({ supervisor: { ...snapshot().supervisor, decisions } }));
  assert.deepEqual(keys(d), ['di-di-1']);
  assert.equal(d.problems[0].code, 'gate-stale');
  assert.equal(d.supervisor.staleGates.length, 1);
  assert.equal(d.supervisor.openDecisions, 2);
  const dead = digest(snapshot({ supervisor: { ...snapshot().supervisor, decisions, health: { live: false, reason: 'terminal gone' } } }));
  assert.equal(dead.problems[0].key, 'seat-dead');
});

test('a reservation live for a job that is not running, a finished Supervisor job, a dead Kernel workflow or a vanished seat is leaked', () => {
  const reservation = (id, over) => ({ id: id.padEnd(32, '0'), provider: 'codex', model: 'm', role: 'op', state: 'live', jobId: null, seat: null, kernelWorkflow: null,
    createdAt: NOW - 90 * MIN, updatedAt: NOW - 20 * MIN, releasedAt: null, ...over });
  const reservations = [reservation('ok-op', { jobId: 'op-x-1' }), reservation('gone-op', { jobId: 'op-old-9' }),
    reservation('ended-fix', { role: 'worker', jobId: 'fix-a', state: 'unknown' }), reservation('live-fix', { role: 'worker', jobId: 'fix-b' }),
    reservation('kernel-ok', { role: 'kernel', kernelWorkflow: 'wf-1' }), reservation('kernel-gone', { role: 'kernel', kernelWorkflow: 'wf-9' }),
    reservation('seat-ok', { role: 'supervisor', seat: 'supervisor' }), reservation('seat-gone', { role: 'supervisor', seat: 'core-debug' }),
    reservation('released', { jobId: 'op-old-9', releasedAt: NOW })];
  const supJobs = [{ jobId: 'fix-a', status: 'failed' }, { jobId: 'fix-b', status: 'spawning' }];
  const d = digest(snapshot({ reservations, supJobs }));
  assert.equal(d.admission.live, 8);
  assert.deepEqual(d.admission.leaked.map((r) => r.id.replace(/0+$/, '')).sort(), ['ended-fix', 'gone-op', 'kernel-gone', 'seat-gone']);
  assert.equal(d.problems.every((p) => p.code === 'reservation-leak'), true);
  assert.equal(d.problems[0].params.min, 20);
});

test('controllers that are off while the config asks for them are the first line, also when the leader is gone', () => {
  const off = snapshot({ engine: { leader: { pid: 7, epoch: 3, heartbeatAt: NOW - 5_000, rev: REV }, modes: { job: 'off', host: 'off' }, configured: { job: 'active', host: 'active' }, safe: [], failingQueue: [] } });
  const d = digest(off);
  assert.equal(d.problems[0].key, 'controllers-off');
  assert.equal(d.reconciler.alarm.kind, 'all-off');
  const lines = renderText(d, { language: 'en' }).split('\n');
  assert.match(lines[1], /^ALARM: Controllers job, host are off although the config asks for them/);
  assert.match(renderText(d, { language: 'vi' }).split('\n')[1], /^BÁO ĐỘNG: Các controller job, host đang tắt/);
  const half = digest(snapshot({ engine: { ...off.engine, modes: { job: 'active', host: 'off' } } }));
  assert.deepEqual([half.reconciler.alarm.kind, half.reconciler.alarm.names], ['some-off', ['host']]);
  const gone = digest(snapshot({ engine: { ...off.engine, leader: null } }));
  assert.deepEqual(keys(gone).slice(0, 2).sort(), ['controllers-off', 'leader-missing']);
  assert.equal(gone.reconciler.alarm.leaderMissing, true);
});

test('a stale leader, a leader on other code than the live runtime and failing queue items are reported', () => {
  const stale = digest(snapshot({ engine: { ...snapshot().engine, leader: { pid: 7, epoch: 3, heartbeatAt: NOW - 600_000, rev: REV } } }));
  assert.ok(keys(stale).includes('leader-stale'));
  const drift = digest(snapshot({ engine: { ...snapshot().engine, leader: { pid: 7, epoch: 3, heartbeatAt: NOW - 1000, rev: 'c'.repeat(40) }, failingQueue: [{ controller: 'host', n: 4 }] } }));
  assert.deepEqual(keys(drift), ['queue-host', 'leader-rev']);
  assert.equal(drift.problems[0].blocks, 4);
});

test('a failed op is judged by its recorded cause and by whether the policy next step happened', () => {
  const failedJob = job({ jobId: 'op-b-1', opId: 'b', status: 'failed', createdAt: NOW - 200 * MIN, updatedAt: NOW - 180 * MIN });
  const leg = (over = {}) => ({ op: 'b', jobId: 'op-b-1', status: 'failed', why: { headline: 'tests red', owner: 'kernel', next: 'retry', codes: ['failed'] }, ...over });
  const judged = (wf) => digest(snapshot({ workflows: [wf] })).workflows[0].judgements[0];
  const base = { jobs: [job(), failedJob] };
  assert.equal(judged(workflow({ ...base, status: status({ legs: [leg()] }) })).verdict, 'step-missing');
  assert.equal(judged(workflow({ ...base, status: status({ legs: [leg({ why: null })] }) })).verdict, 'no-cause');
  const retried = workflow({ jobs: [job(), failedJob, job({ jobId: 'op-b-2', opId: 'b', tryNo: 2, status: 'running', createdAt: NOW - 170 * MIN })], status: status({ legs: [leg()] }) });
  assert.deepEqual([judged(retried).verdict, judged(retried).stepBy.kind], ['reasonable', 'retry']);
  const escalated = workflow({ ...base, decisions: [{ id: 'd', kind: 'settle-nongreen', decider: 'supervisor', status: 'open', dueAt: null, openedAt: NOW, jobId: 'op-b-1', summary: '' }], status: status({ legs: [leg()] }) });
  assert.equal(judged(escalated).stepBy.kind, 'decision');
  const recent = workflow({ jobs: [job(), { ...failedJob, updatedAt: NOW - MIN }], status: status({ legs: [leg()] }) });
  assert.equal(judged(recent).verdict, 'pending');
  const owner = (ask) => workflow({ ...base, jobs: ask ? [...base.jobs, job({ jobId: 'op-c-1', opId: 'c', status: 'awaiting_owner' })] : base.jobs,
    status: status({ legs: [leg({ why: { headline: 'needs a credential', owner: 'owner', codes: ['blocker:authority'] } })] }) });
  assert.equal(judged(owner(true)).verdict, 'reasonable');
  assert.equal(judged(owner(false)).verdict, 'owner-without-ask');
  const waiting = workflow({ ...base, jobs: [...base.jobs, job({ jobId: 'op-a-1', opId: 'a' })], status: status({ legs: [leg({ why: { headline: 'needs the design', owner: 'other-op:a' } })] }) });
  assert.deepEqual([judged(waiting).verdict, judged(waiting).stepBy.kind], ['reasonable', 'waits']);
});

test('a running job past its deadline is named; one that reported is not', () => {
  const late = workflow({ jobs: [job({ deadline: NOW - 9 * MIN })] });
  assert.deepEqual(keys(digest(snapshot({ workflows: [late] }))), ['deadline-op-x-1']);
  assert.deepEqual(digest(snapshot({ workflows: [workflow({ jobs: [job({ status: 'reported', deadline: NOW - 9 * MIN })] })] })).problems, []);
});

test('the problems are ordered by the work each blocks, then by key', () => {
  const dead = workflow({ kernelJob: null, seatProbe: { action: 'restart-needed' }, status: status({ frontier: { openOperations: 5, queued: [] } }) });
  const d = digest(snapshot({ workflows: [dead], engine: { ...snapshot().engine, failingQueue: [{ controller: 'job', n: 2 }] } }));
  assert.deepEqual(d.problems.map((p) => p.blocks), [6, 2]);
  assert.deepEqual(d.problems.map((p) => p.area), ['kernel', 'reconciler']);
});

test('the text names every section in both languages and the JSON carries the same digest', async () => {
  const d = digest(snapshot());
  for (const [language, words] of [['en', ['Reconciler:', 'Supervisor:', 'Workflow Shop (shop) phase running', 'Kernel: alive', 'Admission:']],
    ['vi', ['Reconciler:', 'Supervisor:', 'Workflow Shop (shop) giai đoạn running', 'Kernel: còn sống', 'Cấp phép:']]]) {
    const text = renderText(d, { language });
    for (const word of words) assert.ok(text.includes(word), `${language}: ${word}`);
  }
  const printed = [];
  const code = await main(['--json'], { collect: async () => snapshot(), print: (line) => printed.push(line), language: 'en' });
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(printed[0]).problems, []);
  assert.equal(JSON.parse(printed[0]).schema, 'starci/debug-digest@1');
});

test('the verb exits 1 when the machine store is unreadable and 2 on a bad flag, and passes its filters on', async () => {
  const printed = [], errors = [];
  assert.equal(await main([], { collect: async () => ({ unavailable: 'machine store' }), print: (line) => printed.push(line), language: 'en' }), 1);
  assert.match(printed[0], /machine store is not readable/);
  assert.equal(await main(['--nope'], { error: (text) => errors.push(text) }), 2);
  assert.match(errors[0], /debug digest/);
  let seen;
  await main(['--repo', 'a', '--repo', 'b', '--workflow', 'wf-1', '--child-timeout', '5'], { collect: async (o) => { seen = o; return snapshot(); }, print: () => {}, language: 'en' });
  assert.deepEqual([seen.repos, seen.workflowIds, seen.timeoutMs], [['a', 'b'], ['wf-1'], 5000]);
});

test('the machine facts and the collector read a real store and call only the read verbs', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-digest-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const env = { STARCI_TEST_MACHINE_FILE: path.join(dir, 'machine.sqlite') };
  const machine = openMachine({ env });
  try {
    machine.upsertSeat({ seatId: 'supervisor', role: 'supervisor', state: 'live', terminalHandle: 'term_s', lastSeenAt: NOW });
    machine.setSupSignal({ scope: 'supervisor-enabled', key: 'main', value: { enabled: true } });
  } finally { machine.close(); }
  const facts = machineFacts({ env });
  assert.equal(facts.supervisor.seat.state, 'live');
  assert.equal(facts.supervisor.enabled, true);
  assert.deepEqual(facts.seats, ['supervisor']);
  assert.equal(facts.engine.leader, null);
  assert.equal(machineFacts({ env: { STARCI_TEST_MACHINE_FILE: path.join(dir, 'absent.sqlite') } }), null);
  const calls = [];
  const run = async (args) => { calls.push(args.slice(0, 2).join(' ')); return { ok: true, stdout: '{"ok":true,"health":{"live":true}}', error: null }; };
  const ledger = (file) => [{ id: 'wf-1', name: 'Shop', phase: 'running', jobs: [], incidents: [], decisions: [], kernelJob: null, kernelSignal: null, lastKernelWakeAt: null, file }];
  const snap = await collectSnapshot({ env, now: NOW, run, liveRev: () => REV, ledger,
    machine: () => ({ ...facts, ledgers: [{ name: 'shop', repo_root: 'work/shop', file: 'f' }] }) });
  assert.deepEqual(calls, ['scripts/kernel/cli.mjs status', 'scripts/kernel/kernel-watchdog.mjs --repo', 'scripts/supervisor/start-supervisor.mjs --status']);
  assert.equal(snap.workflows[0].repo, 'work/shop');
  assert.deepEqual(snap.supervisor.health, { live: true });
  assert.equal(calls.some((c) => c.includes('--repair')), false);
  assert.deepEqual(await collectSnapshot({ env, machine: () => null }), { unavailable: 'machine store' });
});

test('the ledger facts list the running workflows with their jobs, open incidents, Kernel job and last wake', (t) => withLedger(t, ({ ledger }) => {
  seedWorkflow(ledger, { id: 'wf-run', state: { phase: 'running' }, goal: { revision: 1, markdown: 'g', json: {} },
    jobs: [{ jobId: 'kernel-wf-run', kind: 'kernel', status: 'running', workerId: 'term_k' }, { jobId: 'op-a-1', opId: 'a', status: 'queued', updatedAt: NOW }],
    events: [{ kind: 'kernel-woken', entityType: 'kernel', entityId: 'wf-run', at: NOW }] });
  seedWorkflow(ledger, { id: 'wf-paused', state: { phase: 'paused' }, goal: { revision: 1, markdown: 'g', json: {} } });
  const found = ledgerFacts(ledger.file);
  assert.deepEqual(found.map((w) => [w.id, w.phase]), [['wf-run', 'running']]);
  assert.deepEqual(found[0].jobs.map((j) => [j.jobId, j.kind, j.status]).sort(), [['kernel-wf-run', 'kernel', 'running'], ['op-a-1', 'op', 'queued']]);
  assert.equal(found[0].kernelJob.status, 'running');
  assert.equal(found[0].lastKernelWakeAt, NOW);
  assert.deepEqual(ledgerFacts(ledger.file, ['wf-other']), []);
}));
