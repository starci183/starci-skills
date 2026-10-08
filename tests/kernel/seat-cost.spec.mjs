// A seat costs in proportion to its decisions: the wakes a seat received and decided nothing after are counted per seat and cause, the runtime
// withholds a Kernel wake while the menu is empty, a Kernel past its wake or token bound is replaced by a fresh seat, a bound seat reads its menu
// and not the world, and a seat the runtime woke with an empty menu too often is a departure of the runtime in the digest.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { seatCostConfig, kernelWakeLog, kernelWorkAts, kernelSkippedLog, supervisorWakeLog, supervisorWorkAts, withWorked } from '../../scripts/kernel/seat-wakes.mjs';
import { seatRow, seatsOverEmptyBound, kernelSeatOf, supervisorSeatOf, seatCostLines, withShares, wakesWithUsage, collectSeatCost } from '../../scripts/reconciler/seat-cost.mjs';
import { rotationDue, rotationRule, kernelSinceBoot, createKernelRotation } from '../../scripts/kernel/seat-rotation.mjs';
import { menuVerdict, gatedWake, probeMenu, repoOfLedger } from '../../scripts/kernel/wake-menu-gate.mjs';
import { seatStatusText } from '../../scripts/kernel/verbs/shared/status-lines.mjs';
import { supervisorMenuLines } from '../../scripts/supervisor/supervisor-menu.mjs';
import { openDecisionRow, ringDoorbellWith } from '../../scripts/machine/decisions.mjs';
import { analyze } from '../../scripts/reconciler/debug-digest-analyze.mjs';
import { digestNumbers } from '../../scripts/reconciler/debug-digest-numbers.mjs';
import { incidentPolicy, boundValue } from '../../scripts/kernel/op-incident-policy.mjs';
import { renderText } from '../../scripts/reconciler/debug-digest-render.mjs';

const WF = 'wf-cost';
const T0 = 1_800_000_000_000;
const MIN = 60_000;
const event = (kind, at, payload = {}) => ({ kind, entityType: 'kernel', at, payload });
const seed = (ledger, events) => seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'cost' }, goalIdentity: 'cost-goal', goal: { revision: 0, identity: 'cost-goal', markdown: '# goal', json: {} }, events });

test('a Kernel wake is a stall, a transition or a doorbell event and names its cause', (t) => withLedger(t, ({ ledger }) => {
  seed(ledger, [event('kernel-woken', T0), event('kernel-transition-woken', T0 + MIN, { transition: 'report-filed:done' }), event('decision-doorbell', T0 + 2 * MIN), event('job-status', T0 + 3 * MIN)]);
  assert.deepEqual(kernelWakeLog(ledger.db, WF).map((wake) => wake.cause), ['stall', 'transition:report-filed', 'doorbell']);
}));

test('a wake is empty when the seat authored no decision before the next wake, and a quick next wake shares the answer', () => {
  const wakes = [{ at: 0 }, { at: 10 * MIN }, { at: 11 * MIN }, { at: 40 * MIN }];
  const judged = withWorked(wakes, [11 * MIN + 5000], { now: 60 * MIN, shareMs: 2 * MIN });
  assert.deepEqual(judged.map((wake) => wake.worked), [false, true, true, false], 'the wake 1 minute before another shares that window; the others stand alone');
});

test('the work of a Kernel is its own decisions: a runtime-written decision row is not one', (t) => withLedger(t, ({ ledger }) => {
  seed(ledger, [event('kernel-decision', T0 + 1), event('decision-resolved', T0 + 2, { by: 'kernel:wf-cost' }), event('decision-resolved', T0 + 3, { by: 'runtime' }), event('runtime-rev-acked', T0 + 4)]);
  assert.deepEqual(kernelWorkAts(ledger.db, WF), [T0 + 1, T0 + 2]);
}));

test('the seat row counts wakes, empty wakes, withheld wakes and tokens per wake', (t) => withLedger(t, ({ ledger }) => {
  seed(ledger, [event('kernel-woken', T0), event('kernel-decision', T0 + MIN), event('kernel-woken', T0 + 30 * MIN), event('kernel-transition-woken', T0 + 60 * MIN, { transition: 'ask-answered' }),
    event('kernel-wake-skipped', T0 + 61 * MIN, { cause: 'transition:ask-answered', reason: 'the menu holds no item' })]);
  const [first, second] = kernelWakeLog(ledger.db, WF);
  const insert = (seq, tokens, turns) => ledger.db.prepare(`INSERT INTO llm_usage(workflow_id,subject_type,turn_ref,provider,cache_read_tokens,turns,source,at)
    VALUES(?,'kernel-turn',?,'claude',?,?,'cli-transcript',?)`).run(WF, `kernel:${WF}:s@${turns}#w${seq}`, tokens, turns, T0);
  insert(first.seq, 4_000_000, 8);
  insert(second.seq, 500_000, 2);
  const row = kernelSeatOf(ledger.db, { workflowId: WF, now: T0 + 120 * MIN });
  assert.deepEqual([row.wakes, row.emptyWakes, row.emptySharePercent, row.withheld], [3, 2, 67, 1]);
  assert.deepEqual([row.tokensP50, row.tokensP90, row.measuredWakes], [4_000_000, 4_000_000, 2]);
  assert.equal(row.byCause['transition:ask-answered'].skipped, 1);
  assert.deepEqual(kernelSkippedLog(ledger.db, WF).map((item) => item.cause), ['transition:ask-answered']);
}));

test('the Supervisor row reads its delivered wakes and its replies from machine.sqlite', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE sup_events(seq INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, created_at INTEGER, payload_json TEXT); CREATE TABLE sup_messages(direction TEXT, at INTEGER);'
    + 'CREATE TABLE llm_usage(subject_type TEXT, turn_ref TEXT, turns INTEGER, input_tokens INTEGER, output_tokens INTEGER, cache_read_tokens INTEGER, cache_write_tokens INTEGER);');
  const wake = (at, delivered, tags) => db.prepare('INSERT INTO sup_events(kind,created_at,payload_json) VALUES(?,?,?)').run('supervisor-wake', at, JSON.stringify({ tags, delivered }));
  wake(T0, true, ['land']); wake(T0 + 20 * MIN, false, ['decide']); wake(T0 + 40 * MIN, true, ['inbox', 'land']);
  db.prepare("INSERT INTO sup_messages(direction, at) VALUES('out', ?)").run(T0 + 41 * MIN);
  assert.deepEqual(supervisorWakeLog(db).map((item) => item.cause), ['land', 'inbox+land'], 'an undelivered wake was never received');
  assert.deepEqual(supervisorWorkAts(db), [T0 + 41 * MIN]);
  const row = supervisorSeatOf(db, { now: T0 + 90 * MIN });
  assert.deepEqual([row.wakes, row.emptyWakes], [2, 1]);
  db.close();
});

test('a seat over the declared empty-wake share, with enough wakes to judge, is named; a quiet or small seat is not', () => {
  const config = seatCostConfig();
  const mk = (empty, wakes) => seatRow({ seat: 'kernel', name: 'k', wakes: Array.from({ length: wakes }, (_, i) => ({ seq: i, cause: 'stall', worked: i >= empty, tokens: 1 })) });
  assert.equal(seatsOverEmptyBound([mk(5, 10)]).length, 1);
  assert.equal(seatsOverEmptyBound([mk(3, 10)]).length, 0, `${config.emptyWakeSharePercent} percent is the bound`);
  assert.equal(seatsOverEmptyBound([mk(3, 3)]).length, 0, 'fewer than minWakes wakes are not judged');
  const [row] = withShares([{ ...mk(5, 10), tokens: 30 }], 100);
  assert.equal(row.sharePercent, 30);
  assert.match(seatCostLines({ seats: [{ ...row, sharePercent: 30 }], bound: { emptyWakeSharePercent: 35 } }).join('\n'), /10 wakes, 5 empty \(50%\) OVER-BOUND/);
});

test('the digest names the runtime, not the seat, for a seat woken with an empty menu too often', () => {
  const policy = { ...incidentPolicy(), resolve: boundValue };
  const seatCost = { ...seatRow({ seat: 'kernel', name: 'k', wakes: Array.from({ length: 10 }, (_, i) => ({ seq: i, cause: 'stall', worked: i < 4, tokens: 0 })) }) };
  const job = { jobId: `kernel-${WF}`, kind: 'kernel', opId: null, status: 'running', tryNo: 1, retryOf: null, workerId: 'w', deadline: null, createdAt: T0 - MIN, updatedAt: T0 - MIN };
  const workflow = { id: WF, name: 'Cost', ledger: 'cost', repo: 'work/cost', phase: 'running', jobs: [job], incidents: [], decisions: [], kernelJob: { status: 'running', updatedAt: T0 }, kernelSignal: { terminal: 'term_k' },
    lastKernelWakeAt: T0 - MIN, statusError: null, seatProbe: { action: 'idle-waiting' }, kernelWakes: [], seatCost,
    status: { frontier: { state: 'idle', openOperations: 0, readyOperations: 0, queued: [] }, legs: [], awaitingOwner: [], menu: [], kernelRev: { current: 'a', acked: 'a', stale: false, fileCount: 0 }, usage: { byOp: [] } } };
  const digest = analyze({ now: T0, liveRev: 'a', engine: { leader: { pid: 1, epoch: 1, heartbeatAt: T0, rev: 'a' }, modes: {}, configured: {}, safe: [], failingQueue: [] },
    supervisor: { seat: null, enabled: false, lastWakeAt: null, decisions: [], health: { live: true } }, reservations: [], seats: [], supJobs: [], workflows: [workflow] }, policy, digestNumbers());
  const problem = digest.problems.find((p) => p.code === 'seat-empty-wakes');
  assert.deepEqual([problem.params.empty, problem.params.wakes, problem.params.percent], [6, 10, 60]);
  assert.match(renderText(digest, { language: 'en' }), /woke the Kernel of Cost 10 times and 6 of them \(60%\) found nothing to decide/);
  const runtime = digest.roles.find((role) => role.role === 'runtime');
  assert.equal(runtime.verdict, 'bug');
  assert.ok(runtime.bugs.some((bug) => bug.remedy.case === 'seat-cost-exceeds-decisions'));
});

test('a Kernel past its wake or token bound since its boot is due for a fresh seat', (t) => withLedger(t, ({ ledger }) => {
  const rule = rotationRule('kernel');
  assert.deepEqual(rotationDue({ wakes: rule.afterWakes - 1, tokens: 1 }, rule), { due: false, reason: null });
  assert.match(rotationDue({ wakes: rule.afterWakes, tokens: 1 }, rule).reason, /wakes since its boot/);
  assert.match(rotationDue({ wakes: 1, tokens: rule.afterTokens }, rule).reason, /tokens since its boot/);
  seed(ledger, [event('kernel-woken', T0 - MIN), event('kernel-booted', T0), event('kernel-woken', T0 + MIN), event('decision-doorbell', T0 + 2 * MIN)]);
  const usage = (session, at, tokens) => ledger.db.prepare(`INSERT INTO llm_usage(workflow_id,subject_type,turn_ref,provider,cache_read_tokens,turns,source,at)
    VALUES(?,'kernel-turn',?,'claude',?,3,'cli-transcript',?)`).run(WF, `kernel:${WF}:${session}@9`, tokens, at);
  usage('old', T0 - 5 * MIN, 9_000_000);
  usage('old', T0 + MIN, 1_000_000);
  usage('new', T0 + 3 * MIN, 2_000_000);
  assert.deepEqual(kernelSinceBoot(ledger.db, WF), { bootAt: T0, wakes: 2, tokens: 2_000_000 }, 'what the old session spent, recorded late or not, is not the new seat');
}));

test('the rotation closes the idle seat, records kernel-rotated and answers rotated; a failed step is its own answer', (t) => withLedger(t, ({ ledger }) => {
  seed(ledger, [event('kernel-booted', T0)]);
  const open = (fn) => fn(ledger);
  const calls = [];
  const rotation = createKernelRotation({ workflowId: WF, openLedger: open, close: (terminal) => { calls.push(['close', terminal]); return { ok: true }; },
    replace: (base) => { calls.push(['replace', base.deathReason]); return { ...base, ok: true, action: 'restarted' }; }, sender: () => ({ ok: true }) });
  const answer = rotation.rotate({ phase: 'running', terminal: 'term_k', outputAgeMs: 5, rotation: { due: true, reason: '8 wakes since its boot (bound 8)' } });
  assert.equal(answer.action, 'rotated');
  assert.deepEqual(calls.map((call) => call[0]), ['close', 'replace']);
  assert.match(calls[1][1], /rotated: 8 wakes since its boot/);
  assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM events WHERE workflow_id=? AND kind='kernel-rotated'").get(WF).n, 1);
  const stuck = createKernelRotation({ workflowId: WF, openLedger: open, close: () => ({ ok: false, error: 'busy' }), replace: () => assert.fail('no replacement'), sender: () => ({ ok: true }) });
  assert.equal(stuck.rotate({ phase: 'running', terminal: 'term_k', outputAgeMs: 5, rotation: { due: true, reason: 'x' } }).action, 'kernel-terminal-close-failed');
  const unlaunchable = createKernelRotation({ workflowId: WF, openLedger: open, close: () => assert.fail('the seat stays'), replace: () => assert.fail('no replacement'), sender: () => ({ ok: false, reason: 'workflow-sender-terminal-missing' }) });
  assert.equal(unlaunchable.rotate({ phase: 'running', terminal: 'term_k', outputAgeMs: 5, rotation: { due: true, reason: 'x' } }).action, 'replacement-unlaunchable');
}));

test('the menu gate holds a wake only for an explicit empty menu, writes one skipped event and lets a probe failure through', (t) => withLedger(t, ({ ledger }) => {
  seed(ledger, []);
  assert.equal(menuVerdict({ 'frontier.actionable': false, menu: [] }).hold, true);
  assert.equal(menuVerdict({ 'frontier.actionable': false, menu: [{ id: 'x' }] }).hold, false);
  assert.equal(menuVerdict({ 'frontier.actionable': true, menu: [] }).hold, false);
  assert.equal(menuVerdict({}).hold, false, 'an unanswered field is not an empty menu');
  let sent = 0;
  const send = () => { sent += 1; return { action: 'kernel-woken', delivered: true }; };
  const held = gatedWake(ledger, { workflowId: WF, cause: 'transition:report-filed', send, deps: { menuProbe: () => ({ ok: true, fields: { 'frontier.actionable': false, 'frontier.reason': 'nothing to decide', menu: [] } }) } });
  assert.deepEqual([held.sent, held.answer.action, sent], [false, 'kernel-no-menu', 0]);
  assert.deepEqual(kernelSkippedLog(ledger.db, WF), [{ at: kernelSkippedLog(ledger.db, WF)[0].at, cause: 'transition:report-filed' }]);
  assert.equal(gatedWake(ledger, { workflowId: WF, cause: 'x', send, deps: { menuProbe: () => ({ ok: true, fields: { 'frontier.actionable': true, menu: [{}] } }) } }).sent, true);
  assert.equal(gatedWake(ledger, { workflowId: WF, cause: 'x', send, deps: { menuProbe: () => ({ ok: false, error: 'timeout' }) } }).sent, true, 'a lost wake costs more than an empty one');
  assert.equal(gatedWake(ledger, { workflowId: WF, cause: 'x', send, deps: { menuProbe: () => assert.fail('a probe child does not probe') }, env: { STARCI_WAKE_PROBE: '1' } }).sent, true);
  assert.equal(sent, 3);
}));

test('a bound seat reads its menu, bounded, on a ledger with a hundred open items', () => {
  const bounds = seatCostConfig().statusBounds;
  const menu = Array.from({ length: 100 }, (_, i) => ({ id: `item-${i}`, mode: 'decide', step: 's', question: `question ${i} ${'q'.repeat(400)}`, options: [{ choice: 'a', effect: 'e'.repeat(300) }, { choice: 'b', effect: 'f' }] }));
  const s = { title: 'T', workflowId: WF, actionable: true, frontierState: 'next-ready', byStatus: { queued: 100 }, workers: [], failures: { failed: 0, awaitingOwner: 0 }, leases: [], inboxPending: 0, reports: [], unconsumedReports: 0,
    menu, kernelRev: { stale: true, acked: 'a', current: 'b', fileCount: 3 }, frontier: { reason: null } };
  const text = seatStatusText(s, { phase: 'running' });
  assert.ok(text.length <= bounds.kernelTextChars, `${text.length} chars against ${bounds.kernelTextChars}`);
  assert.match(text, /^.*phase=running frontier=next-ready ACTIONABLE/);
  assert.match(text, /Decide \(100\)/);
  assert.ok((text.match(/question \d+/g) ?? []).length <= bounds.kernelMenuItems);
  assert.match(text, /starci kernel status --full/);
  const waiting = seatStatusText({ ...s, menu: [], actionable: false, kernelRev: { stale: false }, frontier: { reason: 'peer-wait on x' } }, { phase: 'running' });
  assert.match(waiting, /reason: peer-wait on x/);
  const lines = supervisorMenuLines(menu.map((item) => ({ ...item, kind: 'k' })));
  assert.ok(lines.join('\n').length <= bounds.supervisorTextChars + 1500, 'the capped Supervisor menu is a few items, not a hundred');
  assert.match(lines.at(-1), new RegExp(`\\+${100 - bounds.supervisorMenuItems} more item`));
});

test('the doorbell rings for an item the menu lists, not for a settle item whose job the settler never handed over', (t) => withLedger(t, ({ ledger }) => {
  seed(ledger, []);
  openDecisionRow(ledger, { workflowId: WF, kind: 'settle-nongreen', entity: { type: 'job', id: 'op-gone' }, summary: 'blocked', by: 'reconciler/job' }, { now: 0 });
  const calls = [];
  const wake = (args) => { calls.push(args.text); return { action: 'kernel-woken', delivered: true, terminal: 'term_1', state: 'turn-idle' }; };
  assert.equal(ringDoorbellWith({ ledger, workflowId: WF, wake, now: 1000 }).action, 'nothing-open');
  openDecisionRow(ledger, { workflowId: WF, kind: 'supervisor-ruling', entity: { type: 'job', id: 'op-1' }, summary: 'ruling', by: 'supervisor' }, { now: 0 });
  assert.equal(ringDoorbellWith({ ledger, workflowId: WF, wake, now: 2000 }).action, 'rung');
  assert.equal(calls.length, 1);
}));

test('the probe asks a read-only status for the menu fields, and a stopped probe is not an answer', () => {
  const asked = [];
  const run = (args, options) => { asked.push({ args, env: options.env }); return { status: 0, stdout: JSON.stringify({ ok: true, fields: { 'frontier.actionable': false, menu: [] } }), stderr: '' }; };
  assert.deepEqual(probeMenu({ repo: '/r', workflowId: WF, run, env: {} }).fields, { 'frontier.actionable': false, menu: [] });
  assert.ok(asked[0].args.includes('--field') && asked[0].args.includes('status'));
  assert.equal(asked[0].env.STARCI_WAKE_PROBE, '1', 'the child never gates a wake of its own');
  assert.equal(probeMenu({ repo: '/r', workflowId: WF, run: () => ({ status: 1, stdout: '', stderr: 'boom' }), env: {} }).ok, false);
  assert.equal(repoOfLedger({ file: path.join('r', '.starciwork', 'runtime.sqlite') }), 'r');
  assert.equal(repoOfLedger({}), null);
});

test('the machine view joins the wakes with the usage they own and shares the machine total across Kernels and the Supervisor', (t) => withLedger(t, ({ ledger, ledgerFile }) => {
  seed(ledger, [event('kernel-woken', T0), event('kernel-decision', T0 + MIN)]);
  const [wake] = kernelWakeLog(ledger.db, WF);
  ledger.db.prepare(`INSERT INTO llm_usage(workflow_id,subject_type,turn_ref,provider,cache_read_tokens,turns,source,at)
    VALUES(?,'kernel-turn',?,'claude',1000,4,'cli-transcript',?)`).run(WF, `kernel:${WF}:s@4#w${wake.seq}`, T0);
  assert.deepEqual(wakesWithUsage([{ seq: wake.seq, cause: 'stall', worked: true }, { seq: 999, cause: 'stall', worked: false }], [{ seq: wake.seq, turns: 4, tokens: 1000 }]).map((row) => row.tokens), [1000, 0]);
  const machineDb = new DatabaseSync(':memory:');
  machineDb.exec('CREATE TABLE sup_events(seq INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, created_at INTEGER, payload_json TEXT); CREATE TABLE sup_messages(direction TEXT, at INTEGER);'
    + 'CREATE TABLE llm_usage(subject_type TEXT, turn_ref TEXT, turns INTEGER, input_tokens INTEGER, output_tokens INTEGER, cache_read_tokens INTEGER, cache_write_tokens INTEGER);');
  const cost = collectSeatCost({ machineDb, ledgers: [{ file: ledgerFile, name: 'cost' }], now: T0 + 10 * MIN });
  machineDb.close();
  assert.deepEqual(cost.seats.map((row) => [row.seat, row.wakes, row.tokens, row.sharePercent]), [['kernel', 1, 1000, 100], ['supervisor', 0, 0, 0]]);
}));
