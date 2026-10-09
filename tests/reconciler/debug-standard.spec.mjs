import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { loadStandard } from '../../scripts/reconciler/debug-standard.mjs';
import { registryFacts, endCriteria } from '../../scripts/reconciler/debug-docs.mjs';
import { loadQuestions, cleanRun } from '../../scripts/reconciler/debug-questions.mjs';
import { attemptFacts, eventFacts, historyFacts } from '../../scripts/reconciler/debug-digest-ledger.mjs';
import { renderText } from '../../scripts/reconciler/debug-digest-render.mjs';
import { rolesContract } from '../../scripts/machine/roles-contract.mjs';
import { NOW, MIN, REV, digest, job, status, workflow, snapshot, keys } from '../helpers/debug-digest-fixture.mjs';

const TREE = '/orca/starci-monorepo/wf-one';
const attempt = (over = {}) => ({ attemptId: 1, jobId: 'op-x-1', op: 'x', tryNo: 1, agent: 'claude', provider: 'claude', dispatchedAt: NOW - 90 * MIN, startedAt: NOW - 89 * MIN,
  reportedAt: NOW - 60 * MIN, settledAt: NOW - 59 * MIN, reportOutcome: 'done', verdict: 'pass', endState: 'settled', settledBy: 'settler', worktreePath: TREE, claimMismatch: 0, treeExists: null, ...over });
const event = (kind, over = {}) => ({ kind, attemptId: null, entityId: 'x', at: NOW - 60 * MIN, step: null, error: null, op: null, verb: null, verdict: null, claimOverruled: false, checkedIn: null, ...over });
const settledEvents = (checkedIn = [{ cwd: TREE, commit: 'c'.repeat(40), tree: 'd'.repeat(40) }]) => [event('checks-recorded', { attemptId: 1 }), event('op-settled', { attemptId: 1, verdict: 'pass', checkedIn })];
const withRows = (over = {}) => workflow({ attempts: [attempt()], events: settledEvents(), jobs: [job({ status: 'succeeded' }), job({ jobId: 'kernel-wf-1', kind: 'kernel', opId: null })], ...over });
const flow = (d) => d.standard.workflows[0];
const step = (d, id) => flow(d).steps.find((s) => s.id === id);
const row = (d, role, text = '') => d.roles.find((r) => r.role === role && r.subject.includes(text));
const bugCodes = (d) => d.problems.map((p) => (p.code === 'departure' ? p.params.departure : p.code));

test('the standard resolves every bound to a number, names a probe for every step and points only at registry entries and roles that exist', () => {
  const standard = loadStandard();
  const bound = (id) => standard.steps.find((s) => s.id === id).bound;
  assert.deepEqual([bound('host-ready'), bound('kernel-booted'), bound('goal-approved')], [90_000, 180_000, null]);
  assert.equal(standard.steps.find((s) => s.id === 'settled').boundKernel, 900_000);
  const registry = new Set(registryFacts().map((c) => c.id));
  const roles = new Set([...rolesContract().roles.map((r) => r.id), 'runtime', 'handler']);
  for (const [code, def] of Object.entries(standard.departures)) {
    assert.ok(roles.has(def.role), `${code} names the role ${def.role}`);
    assert.ok(def.registry === null || registry.has(def.registry), `${code} names the registry entry ${def.registry}`);
  }
  for (const [kind, def] of Object.entries(standard.happy)) assert.ok(roles.has(def.role), `${kind} names the role ${def.role}`);
});

test('a workflow that ran its legs on the standard path has no departure and every role reads no error', () => {
  const d = digest(snapshot({ workflows: [withRows()] }));
  assert.deepEqual(d.problems, []);
  assert.equal(flow(d).firstDeparture, null);
  assert.deepEqual(step(d, 'settle-evidence'), { id: 'settle-evidence', actor: 'runtime', scope: 'attempt', state: 'done', evidence: 'the checks ran in the attempt tree', departure: null, items: [{ attemptId: 1, op: 'x', state: 'done', evidence: 'the checks ran in the attempt tree' }] });
  assert.deepEqual(d.roles.filter((r) => r.role !== 'critic').map((r) => r.verdict), ['none', 'none', 'none', 'none']);
  assert.equal(row(d, 'critic').verdict, 'unobserved');
});

test('a queued workflow is a happy wait inside the start bound and a runtime departure past it', () => {
  const queued = (ago) => digest(snapshot({ workflows: [workflow({ phase: 'queued', updatedAt: NOW - ago, attempts: [], events: [], kernelJob: null, kernelSignal: null })] }));
  assert.deepEqual(queued(MIN).problems, []);
  const late = queued(10 * MIN);
  assert.deepEqual(bugCodes(late), ['workflow-not-started']);
  assert.equal(late.problems[0].role, 'runtime');
  assert.equal(flow(late).firstDeparture.id, 'workflow-started');
});

test('a Kernel that cannot be started again and again is the runtime\'s departure, not the Kernel\'s', () => {
  const failures = Array.from({ length: 6 }, (_, i) => event('kernel-start-failed', { at: NOW - (30 - i) * MIN, step: 'workflow-worktree-install', error: 'npm error code EPERM', runtimeRev: REV }));
  const wf = withRows({ kernelJob: { status: 'failed', updatedAt: NOW - 60 * MIN }, seatProbe: { action: 'restart-needed' }, events: [...settledEvents(), ...failures] });
  const d = digest(snapshot({ workflows: [wf] }));
  assert.deepEqual(bugCodes(d), ['kernel-start-loop']);
  assert.equal(d.problems[0].role, 'runtime');
  assert.match(d.problems[0].params.evidence, /6 launches failed at workflow-worktree-install/);
  assert.equal(row(d, 'kernel').verdict, 'none');
  assert.equal(row(d, 'runtime').verdict, 'bug');
  const quiet = digest(snapshot({ workflows: [{ ...wf, events: [...settledEvents(), ...failures.slice(0, 2)] }] }));
  assert.deepEqual(bugCodes(quiet), ['kernel-dead']);
});

test('failed launches that a launch which stood followed, or that another runtime revision made, are history and no departure (StarCi 2026-10-09: 1670 failures, then kernel-restarted)', () => {
  const failures = Array.from({ length: 6 }, (_, i) => event('kernel-start-failed', { at: NOW - (30 - i) * MIN, step: 'workflow-worktree-install', error: 'npm error code EPERM', runtimeRev: 'a'.repeat(40) }));
  for (const launch of ['kernel-booted', 'kernel-restarted', 'kernel-adopted']) {
    const stood = digest(snapshot({ workflows: [withRows({ events: [...settledEvents(), ...failures, event(launch, { at: NOW - 10 * MIN })] })] }));
    assert.deepEqual(bugCodes(stood), [], launch);
  }
  const live = status({ kernelRev: { current: 'b'.repeat(40), acked: 'b'.repeat(40), stale: false, fileCount: 0 } });
  const oldRuntime = digest(snapshot({ workflows: [withRows({ status: live, events: [...settledEvents(), ...failures] })] }));
  assert.ok(!bugCodes(oldRuntime).includes('kernel-start-loop'), 'the failures of another revision do not count, as the start hold does not count them');
  const same = failures.map((e) => ({ ...e, runtimeRev: 'b'.repeat(40) }));
  const current = digest(snapshot({ workflows: [withRows({ status: live, kernelJob: { status: 'failed', updatedAt: NOW - 60 * MIN }, seatProbe: { action: 'restart-needed' }, events: [...settledEvents(), ...same] })] }));
  assert.ok(bugCodes(current).includes('kernel-start-loop'), 'the failures of the revision now running still do');
});

test('a Kernel restarted after the last ack is inside the ack bound from its restart, not from the ack of its predecessor', () => {
  const behind = status({ kernelRev: { current: 'b'.repeat(40), acked: 'a'.repeat(40), stale: true, fileCount: 2 } });
  const restarted = digest(snapshot({ workflows: [withRows({ status: behind, events: [...settledEvents(), event('runtime-rev-acked', { at: NOW - 600 * MIN }), event('kernel-restarted', { at: NOW - 5 * MIN })] })] }));
  assert.deepEqual(restarted.problems, []);
  assert.deepEqual(row(restarted, 'kernel').happy, [{ kind: 'rev-pending', count: 1 }]);
});

test('a Kernel seat that is being replaced and a Kernel that has not yet acked the new revision are happy errors inside their bounds', () => {
  const starting = digest(snapshot({ workflows: [withRows({ kernelJob: { status: 'failed', updatedAt: NOW - MIN } })] }));
  assert.deepEqual(starting.problems, []);
  assert.deepEqual(row(starting, 'runtime').happy, [{ kind: 'kernel-starting', count: 1 }]);
  const behind = status({ kernelRev: { current: 'b'.repeat(40), acked: 'a'.repeat(40), stale: true, fileCount: 2 } });
  const pending = digest(snapshot({ workflows: [withRows({ status: behind, events: [...settledEvents(), event('runtime-rev-acked', { at: NOW - 5 * MIN })] })] }));
  assert.deepEqual(pending.problems, []);
  assert.deepEqual(row(pending, 'kernel').happy, [{ kind: 'rev-pending', count: 1 }]);
  const spent = digest(snapshot({ workflows: [withRows({ status: behind, events: [...settledEvents(), event('runtime-rev-acked', { at: NOW - 60 * MIN })] })] }));
  assert.deepEqual(keys(spent), ['kernel-rev-wf-1']);
  assert.equal(spent.problems[0].role, 'kernel');
});

test('a report that no one settled is the settler\'s departure; one whose tree is gone is named as the lost placement and carries its registry state', () => {
  const stuck = (over) => attempt({ settledAt: null, verdict: null, endState: null, settledBy: null, reportedAt: NOW - 60 * MIN, ...over });
  const events = [event('checks-recorded', { attemptId: 1 })];
  const registry = [{ id: 'admitted-op-placement-names-a-lost-tree-path', status: 'open', remedy: 'open' }];
  const plain = digest(snapshot({ workflows: [withRows({ attempts: [stuck()], events })], registry }));
  assert.deepEqual(bugCodes(plain), ['settle-overdue']);
  assert.equal(plain.problems[0].remedy.state, 'none-recorded');
  const lost = digest(snapshot({ workflows: [withRows({ attempts: [stuck({ treeExists: false })], events })], registry }));
  assert.deepEqual(bugCodes(lost), ['placement-lost']);
  assert.deepEqual(lost.problems[0].remedy, { state: 'open', case: 'admitted-op-placement-names-a-lost-tree-path' });
  const fixed = digest(snapshot({ workflows: [withRows({ attempts: [stuck({ treeExists: false })], events })], registry: [{ ...registry[0], status: 'covered', remedy: 'on-host' }] }));
  assert.equal(fixed.problems[0].remedy.state, 'on-host');
  assert.equal(flow(lost).standardStep, 'settled');
  const fresh = digest(snapshot({ workflows: [withRows({ attempts: [stuck({ reportedAt: NOW - MIN })], events: [] })] }));
  assert.deepEqual(fresh.problems, []);
});

test('a report that is not done is the Kernel\'s to settle and its overdue settle is the Kernel\'s departure', () => {
  const asked = attempt({ settledAt: null, verdict: null, endState: null, reportOutcome: 'ask', reportedAt: NOW - 30 * MIN });
  const d = digest(snapshot({ workflows: [withRows({ attempts: [asked], events: [] })] }));
  assert.deepEqual(bugCodes(d), ['settle-overdue-kernel']);
  assert.equal(d.problems[0].role, 'kernel');
});

test('checks that ran outside the attempt tree are a runtime departure; a subdirectory of the tree, and a settle that names no directory, are not', () => {
  const outside = digest(snapshot({ workflows: [withRows({ events: settledEvents([{ cwd: '/repos/starci-monorepo', commit: 'c'.repeat(40), tree: 'd'.repeat(40) }]) })] }));
  assert.deepEqual(bugCodes(outside), ['checks-ran-outside-tree']);
  assert.equal(outside.problems[0].remedy.case, 'checks-rerun-wrong-tree');
  const spelled = (cwd) => digest(snapshot({ workflows: [withRows({ events: settledEvents([{ cwd, commit: 'c', tree: 'd' }]) })] }));
  const inside = spelled(`${TREE}/apps/web/`);
  assert.deepEqual(spelled(`\\orca\\starci-monorepo\\wf-one\\apps`).problems, []);
  assert.deepEqual(inside.problems, []);
  const old = digest(snapshot({ workflows: [withRows({ events: settledEvents(null) })] }));
  assert.equal(step(old, 'settle-evidence').state, 'na');
  assert.deepEqual(old.problems, []);
});

test('an op that asked, was blocked or reported red checks, a refused launch and a provider quota are counted and never a problem', () => {
  const attempts = [attempt({ attemptId: 1, reportOutcome: 'ask', verdict: 'blocked' }), attempt({ attemptId: 2, reportOutcome: 'blocked', verdict: 'blocked' }),
    attempt({ attemptId: 3, verdict: 'fail' }), attempt({ attemptId: 4, endState: 'worker-dead', reportedAt: null, verdict: 'fail' })];
  const events = [event('provider-unavailable'), event('dispatch-rejected', { op: 'x', step: 'launch-trust', error: 'busy' }), ...settledEvents()];
  const d = digest(snapshot({ workflows: [withRows({ attempts, events })] }));
  assert.deepEqual(d.problems, []);
  assert.equal(d.ok, true);
  assert.deepEqual(d.roles.filter((r) => r.role === 'op').map((r) => [r.attemptId, r.verdict, r.happy.map((h) => h.kind)]),
    [[1, 'happy', ['op-asked']], [2, 'happy', ['op-blocked']], [3, 'happy', ['check-red']], [4, 'none', []]]);
  assert.deepEqual(row(d, 'runtime').happy.map((h) => h.kind).sort(), ['dispatch-rejected', 'quota-wait', 'worker-lost']);
  assert.match(renderText(d, { language: 'en' }), /happy error x1 \(op-asked 1\)/);
  assert.match(renderText(d, { language: 'en' }), /No problem found\./);
});

test('the same launch refused over and over is a runtime departure; a refusal followed by a dispatch is not', () => {
  const refused = (at) => event('dispatch-rejected', { at, op: 'x', step: 'launch-trust', error: 'codex app-server answered nothing' });
  const loop = Array.from({ length: 5 }, (_, i) => refused(NOW - (20 - i) * MIN));
  assert.deepEqual(bugCodes(digest(snapshot({ workflows: [withRows({ events: [...settledEvents(), ...loop] })] }))), ['dispatch-loop']);
  const recovered = [...loop, event('op-dispatched', { at: NOW - 5 * MIN })];
  assert.deepEqual(digest(snapshot({ workflows: [withRows({ events: [...settledEvents(), ...recovered] })] })).problems, []);
});

test('an op running past its deadline is the op\'s departure, attached to its attempt row', () => {
  const running = attempt({ settledAt: null, verdict: null, endState: null, reportedAt: null, reportOutcome: null });
  const d = digest(snapshot({ workflows: [withRows({ attempts: [running], events: [], jobs: [job({ deadline: NOW - 9 * MIN }), job({ jobId: 'kernel-wf-1', kind: 'kernel', opId: null })] })] }));
  assert.deepEqual(bugCodes(d), ['job-past-deadline']);
  const opRow = row(d, 'op');
  assert.deepEqual([opRow.verdict, opRow.bugs[0].code, opRow.bugs[0].duty], ['bug', 'job-past-deadline', 'never']);
});

test('a hold whose handler is the owner, and a Decision Item the owner decides, are the owner\'s wait and never a departure', () => {
  const queued = [{ jobId: 'op-x-1', opId: 'x', queuedBecause: 'owner-gate', detail: 'owner gate' }];
  const wf = withRows({ jobs: [job({ status: 'queued', updatedAt: NOW - 9 * 60 * 60 * MIN })], status: status({ frontier: { state: 'engaged', openOperations: 1, queued } }) });
  const d = digest(snapshot({ workflows: [wf] }));
  assert.deepEqual(d.problems, []);
  assert.ok(d.workflows[0].held[0].overdue);
  assert.deepEqual(row(d, 'kernel').happy, [{ kind: 'owner-wait', count: 1 }]);
});

test('a Supervisor seat that is down inside its replacement bound is a happy error and past it a Supervisor departure', () => {
  const seat = (lastSeenAt) => ({ state: 'dead', terminalHandle: 'term_s', lastSeenAt, lastInputOkAt: lastSeenAt, deaf: false });
  const supervisor = (lastSeenAt) => ({ ...snapshot().supervisor, seat: seat(lastSeenAt), health: { live: false, reason: 'terminal gone' } });
  const soon = digest(snapshot({ supervisor: supervisor(NOW - MIN) }));
  assert.deepEqual(soon.problems, []);
  assert.deepEqual(row(soon, 'runtime').happy, [{ kind: 'seat-replacing', count: 1 }]);
  const late = digest(snapshot({ supervisor: supervisor(NOW - 60 * MIN) }));
  assert.deepEqual(bugCodes(late), ['supervisor-down']);
  assert.equal(row(late, 'supervisor').verdict, 'bug');
});

test('the text prints the standard, every role, the standing and the questions in both languages', () => {
  const wf = withRows({ attempts: [attempt({ settledAt: null, verdict: null, endState: null })], events: [] });
  const d = digest(snapshot({ workflows: [wf], criteria: endCriteria() }));
  const en = renderText(d, { language: 'en', questions: true });
  for (const word of ['Standard: at step', 'Verdict per role', 'Critic runs: unobserved', 'Runtime: BUG - ', 'Debug standing against its end condition', 'clean-workflows', 'Power and lifecycle', '0 documented gaps']) assert.ok(en.includes(word), word);
  const vi = renderText(d, { language: 'vi', questions: false });
  for (const word of ['Chu\u1ea9n v\u1eadn h\u00e0nh', 'K\u1ebft lu\u1eadn theo t\u1eebng vai', 'ch\u01b0a quan s\u00e1t \u0111\u01b0\u1ee3c', 'V\u1ecb th\u1ebf c\u1ee7a Debug', 'C\u00e2u h\u1ecfi c\u1ee7a Debug']) assert.ok(vi.includes(word), word);
  assert.equal(vi.includes('Power and lifecycle'), false);
});

test('the attempts, step events and finished workflows are read from a ledger, the claim mismatch counting only the last run of each check', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE op_attempts(attempt_id INTEGER, workflow_id TEXT, job_id TEXT, op_id TEXT, try_no INTEGER, agent TEXT, provider TEXT, dispatched_at INTEGER, started_at INTEGER,
      reported_at INTEGER, settled_at INTEGER, report_outcome TEXT, verdict TEXT, end_state TEXT, settled_by TEXT, worktree_path TEXT, transcript_sha TEXT);
    CREATE TABLE check_runs(attempt_id INTEGER, name TEXT, runner TEXT, run_seq INTEGER, declared_exit_code INTEGER, exit_code INTEGER, cwd TEXT);
    CREATE TABLE events(seq INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT, kind TEXT, attempt_id INTEGER, entity_id TEXT, created_at INTEGER, payload_json TEXT);
    CREATE TABLE workflows(workflow_id TEXT, phase TEXT, created_at INTEGER, finished_at INTEGER, updated_at INTEGER);
    CREATE TABLE incidents(workflow_id TEXT, kind TEXT);`);
  db.prepare("INSERT INTO op_attempts VALUES(1,'wf','j','x',1,'claude','claude',10,11,12,NULL,'done',NULL,NULL,NULL,'/tree/a',NULL),(2,'wf','j2','y',1,'claude','claude',10,11,12,13,'done','pass','settled','settler','/tree/b','sha')").run();
  db.prepare("INSERT INTO check_runs VALUES(1,'lint','kernel',1,0,1,'/t'),(1,'lint','kernel',2,0,0,'/t'),(2,'lint','kernel',1,0,1,'/t')").run();
  const insert = db.prepare('INSERT INTO events(workflow_id, kind, attempt_id, entity_id, created_at, payload_json) VALUES(?,?,?,?,?,?)');
  insert.run('wf', 'op-settled', 2, 'j2', 14, JSON.stringify({ verdict: 'pass', claimOverruled: false, checkedIn: [{ cwd: '/tree/b', commit: 'c', tree: 't' }] }));
  insert.run('wf', 'kernel-start-failed', null, 'wf', 15, JSON.stringify({ step: 'install', error: 'e'.repeat(300) }));
  insert.run('wf', 'job-status', null, 'j', 16, '{}');
  insert.run('done', 'ledger-written-outside-seat', null, 'done', 17, JSON.stringify({ actor: 'person', verb: 'enqueue' }));
  db.prepare("INSERT INTO workflows VALUES('wf','running',1,NULL,2),('done','finished',1,20,21),('open','finished',1,NULL,30)").run();
  db.prepare("INSERT INTO incidents VALUES('done','runtime-defect'),('done','owner-ask')").run();
  const attempts = attemptFacts(db, 'wf', { exists: (p) => p === '/tree/a' });
  assert.deepEqual(attempts.map((a) => [a.attemptId, a.claimMismatch, a.treeExists]), [[1, 0, true], [2, 1, null]]);
  const events = eventFacts(db, 'wf');
  assert.deepEqual(events.map((e) => e.kind), ['op-settled', 'kernel-start-failed']);
  assert.deepEqual(events[0].checkedIn, [{ cwd: '/tree/b', commit: 'c', tree: 't' }]);
  assert.equal(events[1].error.length, 120);
  assert.deepEqual(historyFacts(db).map((h) => [h.id, h.finishedAt, h.interventions, h.runtimeDefects]), [['done', 20, 1, 1], ['open', 30, 0, 0]]);
});

const finished = (id, over = {}) => ({ id, createdAt: NOW - 600 * MIN, finishedAt: NOW - 300 * MIN, interventions: 0, runtimeDefects: 0, startFailures: 0, ...over });
const bootRow = (at, bootAt) => ({ at, bootAt, bootId: String(bootAt), pid: 1 });

test('the debug standing counts the consecutive clean workflows, the open edge cases and the workflows that finished across a host restart', () => {
  const history = [finished('a', { interventions: 2 }), finished('b'), finished('c', { finishedAt: NOW - 100 * MIN }), finished('d')];
  assert.equal(cleanRun(history), 3);
  assert.equal(cleanRun([finished('a'), finished('b', { startFailures: 3 })]), 0);
  const registry = [{ id: 'one', status: 'open', remedy: 'open' }, { id: 'two', status: 'covered', remedy: 'on-host' }];
  const boots = [bootRow(NOW - 450 * MIN, NOW - 700 * MIN), bootRow(NOW - 800 * MIN, NOW - 900 * MIN)];
  const engine = { ...snapshot().engine, boots };
  const d = digest(snapshot({ history, registry, criteria: endCriteria(), engine }));
  const byId = Object.fromEntries(d.debug.standing.criteria.map((c) => [c.id, c]));
  assert.deepEqual([byId['clean-workflows'].have, byId['clean-workflows'].holds], [3, false]);
  assert.deepEqual([byId['no-open-edge-case'].have, byId['no-open-edge-case'].atMost, byId['no-open-edge-case'].holds], [1, true, false]);
  assert.deepEqual([byId['survived-restart'].have, byId['survived-restart'].holds], [3, true]);
  assert.equal(d.debug.standing.met, false);
  const clean = digest(snapshot({ history: Array.from({ length: 5 }, (_, i) => finished(`w${i}`, { finishedAt: NOW - 300 * MIN + i })), registry: [], criteria: endCriteria(), engine }));
  assert.equal(clean.debug.standing.criteria.find((c) => c.id === 'clean-workflows').holds, true);
});

test('every debug question belongs to an edge-case family, is answerable today by a check or names the signal it needs, and the answers carry their state', () => {
  const groups = loadQuestions();
  const families = [...groups.map((g) => g.id)];
  assert.deepEqual(families, ['power-lifecycle', 'change-under-running', 'failure-while-running', 'correctness', 'smooth-operation', 'record-vs-reality', 'authority-safety', 'concurrency', 'ending']);
  const all = groups.flatMap((g) => g.questions);
  assert.equal(new Set(all.map((q) => q.id)).size, all.length);
  assert.ok(all.filter((q) => q.answerable === 'gap').every((q) => q.signal && q.why));
  const d = digest(snapshot({ workflows: [withRows()], history: [finished('a')], registry: [], criteria: endCriteria() }));
  const answered = d.debug.questions.flatMap((g) => g.questions);
  assert.equal(answered.length, all.length);
  assert.ok(answered.filter((q) => q.answerable === 'today').every((q) => ['ok', 'attention', 'unknown'].includes(q.state) && typeof q.evidence === 'string'));
  assert.ok(answered.filter((q) => q.answerable === 'gap').every((q) => q.state === 'gap'));
  assert.equal(answered.find((q) => q.id === 'co-done-on-evidence').state, 'ok');
  assert.equal(answered.find((q) => q.id === 'en-clean-run').evidence.startsWith('1 consecutive clean'), true);
});

test('interventions by a person, the lost tree of an unsettled attempt and a claim that passed against a contradicting re-run are answered as attention', () => {
  const lost = attempt({ attemptId: 2, jobId: 'op-y-1', op: 'y', settledAt: null, verdict: null, endState: null, treeExists: false, claimMismatch: 1, reportedAt: NOW - MIN });
  const wf = withRows({ attempts: [attempt({ claimMismatch: 1 }), lost], events: [...settledEvents(), event('ledger-written-outside-seat', { verb: 'enqueue' })] });
  const d = digest(snapshot({ workflows: [wf], registry: [], criteria: endCriteria() }));
  const answer = (id) => d.debug.questions.flatMap((g) => g.questions).find((q) => q.id === id);
  assert.equal(answer('as-interventions').state, 'attention');
  assert.equal(answer('rr-placement-exists').state, 'attention');
  assert.equal(answer('co-claim-vs-rerun').state, 'attention');
  assert.equal(answer('fr-stale-gates').state, 'ok');
});

test('an approved leg that stands without a job is waiting inside its bound and, past it, the runtime\'s departure when the plan fixes its write set and the Kernel\'s when it does not', () => {
  const standing = (origin, settledAgo) => {
    const events = [event('checks-recorded', { attemptId: 1 }), event('op-settled', { attemptId: 1, verdict: 'pass', at: NOW - settledAgo, checkedIn: [{ cwd: TREE }] })];
    return digest(snapshot({ workflows: [withRows({ events, status: status({ nextActions: [{ kind: 'dispatch', origin, op: 'business.decide' }] }) })] }));
  };
  const fresh = standing('approved-leg', MIN);
  assert.deepEqual(fresh.problems, []);
  assert.equal(step(fresh, 'leg-enqueued').state, 'waiting');
  const mechanical = standing('approved-leg', 40 * MIN);
  assert.deepEqual(bugCodes(mechanical), ['leg-not-enqueued']);
  assert.equal(mechanical.problems[0].role, 'runtime');
  assert.equal(flow(mechanical).firstDeparture.id, 'leg-enqueued');
  const open = standing('approved-leg-open', 40 * MIN);
  assert.deepEqual(bugCodes(open), ['leg-open-unanswered']);
  assert.equal(open.problems[0].role, 'kernel');
  const held = digest(snapshot({ workflows: [withRows({ status: status({ nextActions: [{ kind: 'dispatch', origin: 'approved-leg', op: 'business.decide', heldBy: { incident: 'inc-1' } }] }) })] }));
  assert.deepEqual(held.problems, [], 'a leg a supervisor-gate or a peer-wait holds is theirs to release');
  assert.equal(step(held, 'leg-enqueued').state, 'done');
});

test('the end of the flow: a handover ask that waits on the owner is a wait, a due handover that is not enqueued is a runtime departure', () => {
  const ending = (handover, ago) => digest(snapshot({ workflows: [withRows({ status: status({ frontier: { state: 'handover-due', openOperations: 0, readyOperations: 0, queued: [] }, handover }),
    events: [event('checks-recorded', { attemptId: 1 }), event('op-settled', { attemptId: 1, verdict: 'pass', at: NOW - ago, checkedIn: [{ cwd: TREE }] })] })] }));
  const asked = ending({ state: 'awaiting-owner', due: false }, 120 * MIN);
  assert.deepEqual(asked.problems, []);
  assert.deepEqual([step(asked, 'handover').state, step(asked, 'handover').happy], ['waiting', 'owner-wait']);
  assert.equal(step(ending({ state: 'due', due: true }, MIN), 'handover').state, 'waiting');
  const stuck = ending({ state: 'due', due: true }, 40 * MIN);
  assert.deepEqual(bugCodes(stuck), ['handover-not-enqueued']);
  assert.equal(stuck.problems[0].role, 'runtime');
});
