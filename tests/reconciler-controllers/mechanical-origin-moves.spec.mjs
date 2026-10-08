// The origins that were the Kernel's menu and are now the Job controller's moves (scripts/kernel/next-moves.mjs,
// scripts/reconciler/mechanical-moves.mjs): an approved leg that declares its write set, a red node, a stale proof or attempt, the asset
// leg, the credential ask, the owner's redraw and a cut ordinal that does not reconcile with its seam. Each carries a typed move that
// `enqueue` accepts; one whose move cannot be built, and the origins that are judgments, stay on the menu.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { unitSubjectKey } from '../../engine/admission.mjs';
import { graphProjectionOf } from '../../scripts/kernel/graph-projection.mjs';
import { buildMenu, originOf, parseKernelCommand } from '../../scripts/kernel/kernel-menu.mjs';
import { drawRetry, seamMoveOf } from '../../scripts/kernel/verbs/shared/status-decor.mjs';
import { enqueueMove, legPathsOf, rerunMoveOf } from '../../scripts/kernel/next-moves.mjs';
import { mechanicalMovesOf, runMechanicalMoves } from '../../scripts/reconciler/mechanical-moves.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CLI = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const WF = 'wf-origin-moves';
const T0 = Date.now() - 3_600_000;
const SUCCEEDED = 'op-work.author-pass0001';
const FAILED = 'op-work.author-fail0001';
const OTHER = 'op-work.author-pass0002';

const job = (jobId, status, extra = {}) => ({ jobId, unitId: jobId, ...(extra.subject ? { subjectKey: unitSubjectKey({ ownedPaths: extra.paths ?? ['.starciwork/x'] }) } : {}), opId: extra.opId ?? 'work.author', status, createdAt: T0, dispatchedAt: T0 + 1000, updatedAt: T0 + 120_000,
  payload: { opId: extra.opId ?? 'work.author', records: [], owned_paths: extra.paths ?? ['.starciwork/x'], ...(extra.cut ? { cut: extra.cut } : {}) }, result: { verdict: status === 'succeeded' ? 'pass' : 'fail' } });
const goalOf = (derivedPlan) => ({ revision: 0, identity: 'origin-goal', markdown: '# goal', json: { derivedPlan } });

const rowsOf = (db) => db.prepare('SELECT * FROM jobs WHERE workflow_id=?').all(WF);
const byOp = (rows) => rows.reduce((map, row) => map.set(row.op_id, [...(map.get(row.op_id) ?? []), row]), new Map());
const project = (db, over = {}) => {
  const rows = rowsOf(db);
  return graphProjectionOf(db, { wf: { workflow_id: WF, phase: 'running' }, legOps: [], planAncestors: new Map(), workflowJobs: rows, jobsByOp: byOp(rows), failedRows: [],
    queued: [], ownerGates: [], peerWaits: [], awaitingOwner: [], staleReady: [], ...over }).nextActions;
};
const seed = (ledger, jobs, goal = goalOf({ legs: [], edges: [] })) => seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'origin' }, goalIdentity: 'origin-goal', goal, jobs });
const only = (actions, origin) => actions.find((action) => action.origin === origin);

test('an approved leg that declares its write set is a mechanical move on those paths, and one that declares none is the Kernel\'s', (t) => withLedger(t, (world) => {
  const plan = { legs: [{ op: 'work.author', paths: ['.starciwork/x'] }, { op: 'brand.decide', paths: ['.starciwork/brand'] }, { op: 'scope.define' }], edges: [['work.author', 'brand.decide'], ['brand.decide', 'scope.define']] };
  seed(world.ledger, [job(SUCCEEDED, 'succeeded')], goalOf(plan));
  const legs = { legOps: ['work.author', 'brand.decide', 'scope.define'], planAncestors: new Map([['work.author', []], ['brand.decide', ['work.author']], ['scope.define', ['work.author', 'brand.decide']]]) };
  const [ready] = project(world.ledger.db, legs).filter((action) => action.op === 'brand.decide');
  assert.equal(ready.origin, 'approved-leg');
  assert.deepEqual(ready.move, { verb: 'enqueue', args: { workflow: WF, op: 'brand.decide', paths: '.starciwork/brand' } });
  assert.equal(originOf(ready).class, 'mechanical');
  assert.deepEqual(buildMenu({ workflow: WF, rev: null, jobDecisions: [], questions: [], peers: [], wedged: [], deadWaits: [], decisions: [], nextActions: [ready], handover: null, snoozed: new Set() }), []);
  assert.deepEqual(legPathsOf(JSON.stringify({ derivedPlan: plan })), new Map([['work.author', '.starciwork/x'], ['brand.decide', '.starciwork/brand']]), 'a leg without paths has no entry');
  // The same leg with no declared write set: judgment, on the menu with the typed text choice.
  world.ledger.db.prepare('UPDATE goals SET json=? WHERE workflow_id=?').run(JSON.stringify({ derivedPlan: { ...plan, legs: [{ op: 'work.author' }, { op: 'brand.decide' }, { op: 'scope.define' }] } }), WF);
  const [open] = project(world.ledger.db, legs).filter((action) => action.op === 'brand.decide');
  assert.equal(open.origin, 'approved-leg-open');
  assert.equal(open.move, undefined);
  const [item] = buildMenu({ workflow: WF, rev: null, jobDecisions: [], questions: [], peers: [], wedged: [], deadWaits: [], decisions: [], nextActions: [open], handover: null, snoozed: new Set() });
  assert.equal(item.mode, 'judgment');
  assert.deepEqual(item.options.map((option) => option.choice), ['enqueue-leg', 'none-fits']);
  assert.equal(item.options[0].text, 'paths');
}));

test('a work graph partitions an approved leg per node, so the leg stays the Kernel\'s even when the plan declares paths', (t) => withLedger(t, (world) => {
  const plan = { legs: [{ op: 'work.author', paths: ['.starciwork/x'] }, { op: 'brand.decide', paths: ['.starciwork/brand'] }], edges: [['work.author', 'brand.decide']] };
  seed(world.ledger, [job(SUCCEEDED, 'succeeded')], goalOf(plan));
  const workGraph = { version: 1, frontier: [{ id: 'n1', color: 'gray', ownedPaths: ['.starciwork/n1'], lastOp: null, lastJob: null }] };
  const actions = project(world.ledger.db, { legOps: ['work.author', 'brand.decide'], planAncestors: new Map([['work.author', []], ['brand.decide', ['work.author']]]), workGraph });
  assert.equal(only(actions, 'approved-leg-open').op, 'brand.decide');
}));

test('a red node is reworked by the op that wrote it: a failed last job is retried, a passed one is reopened, both on the node\'s paths', (t) => withLedger(t, (world) => {
  seed(world.ledger, [job(FAILED, 'failed'), job(SUCCEEDED, 'succeeded', { paths: ['.starciwork/y'] })]);
  const node = (lastJob, paths) => ({ id: `node-${lastJob}`, color: 'red', ownedPaths: paths, lastOp: 'work.author', lastJob });
  const actions = project(world.ledger.db, { workGraph: { version: 2, frontier: [node(FAILED, ['.starciwork/x']), node(SUCCEEDED, ['.starciwork/y'])] } });
  const [failed, passed] = actions.filter((action) => action.origin === 'red-node');
  assert.deepEqual(failed.move.args, { workflow: WF, op: 'work.author', paths: '.starciwork/x', 'retry-of': FAILED });
  assert.deepEqual(passed.move.args, { workflow: WF, op: 'work.author', paths: '.starciwork/y', reopen: 'work-graph node node-op-work.author-pass0001 turned red' });
  assert.deepEqual(mechanicalMovesOf({ nextActions: actions }).map((move) => move.key).length, 2, 'each round of a node is its own move');
}));

test('a stale proof and a stale attempt re-run their unit: a passed unit is reopened, and a job the ledger lacks leaves the move to the Kernel', (t) => withLedger(t, (world) => {
  seed(world.ledger, [job(SUCCEEDED, 'succeeded'), job(OTHER, 'succeeded', { paths: ['.starciwork/z'] })]);
  const actions = project(world.ledger.db, { staleProofs: [{ jobId: SUCCEEDED, op: 'work.author', items: ['fr a'], changed: ['src/a.ts'] }],
    staleReady: [{ jobId: OTHER, op: 'work.author', followUp: true }, { jobId: 'op-gone-1', op: 'work.author' }] });
  assert.deepEqual(only(actions, 'stale-proof').move.args, { workflow: WF, op: 'work.author', paths: '.starciwork/x', reopen: 'its proof is stale: src/a.ts changed' });
  assert.deepEqual(only(actions, 'stale-ready').move.args.paths, '.starciwork/z');
  assert.equal(only(actions, 'stale-ready').move.args.reopen, 'the owner of a record it read declared the change breaking');
  assert.equal(only(actions, 'stale-ready').move.args['retry-of'], undefined, 'a passed unit is reopened, not retried');
  const unbuilt = actions.find((action) => action.origin === 'move-unbuilt');
  assert.equal(unbuilt.jobId, 'op-gone-1');
  const [item] = buildMenu({ workflow: WF, rev: null, jobDecisions: [], questions: [], peers: [], wedged: [], deadWaits: [], decisions: [], nextActions: [unbuilt], handover: null, snoozed: new Set() });
  assert.deepEqual([item.kind, item.mode, item.options.map((option) => option.choice)], ['move-unbuilt', 'judgment', ['enqueue-by-hand', 'none-fits']]);
}));

test('the asset leg and the credential ask are moves built from the ledger, not from the Kernel\'s text', (t) => withLedger(t, (world) => {
  seed(world.ledger, [job(SUCCEEDED, 'succeeded')]);
  const actions = project(world.ledger.db, { assetSlotsOwed: [{ key: 's1', ui: '.starciwork/ui/a' }, { key: 's2', ui: '.starciwork/ui/b' }],
    autopilot: { on: true, checklistDue: true, checklistApprovals: [] } });
  assert.deepEqual(only(actions, 'asset-slots').move.args, { workflow: WF, op: 'interface.asset', paths: '.starciwork/ui/a,.starciwork/ui/b' });
  const credential = only(actions, 'credential-step').move.args;
  assert.deepEqual([credential.op, credential.paths], ['provision.ask', `.starciwork/evidence/${WF}.credentials`]);
  assert.match(credential.params, /handover-credentials/);
  assert.equal(enqueueMove(WF, { op: 'interface.asset', paths: [] }), null, 'no records, no move');
}));

test('the owner\'s redraw repeats the job it concerned; an answer that names no job is the Kernel\'s', (t) => withLedger(t, (world) => {
  seed(world.ledger, [job(SUCCEEDED, 'succeeded', { opId: 'interface.draw', paths: ['.starciwork/ui/a'] })]);
  const rows = rowsOf(world.ledger.db);
  const entry = (jobId) => ({ record: 'ui/a', redrawOwed: { dispatchId: 'd-1', jobId, notes: ['n1'] } });
  const bound = drawRetry(entry(SUCCEEDED), rows);
  assert.equal(bound.origin, 'draw-redraw');
  assert.deepEqual(bound.move.args, { workflow: WF, op: 'interface.draw', paths: '.starciwork/ui/a', reopen: 'the owner asked for a redraw in ask d-1' });
  const unbound = drawRetry(entry(null), rows);
  assert.equal(unbound.origin, 'draw-redraw-unbound');
  const [item] = buildMenu({ workflow: WF, rev: null, jobDecisions: [], questions: [], peers: [], wedged: [], deadWaits: [], decisions: [], nextActions: [unbound], handover: null, snoozed: new Set() });
  assert.deepEqual([item.kind, item.mode, item.options[0].choice], ['draw-redraw', 'judgment', 'redraw']);
}));

test('a cut ordinal that does not reconcile is redone on its own cut by the runtime; the reconcile itself and the re-cut stay judgments', (t) => withLedger(t, (world) => {
  seed(world.ledger, [job(SUCCEEDED, 'succeeded', { cut: { id: 'cut1', ordinal: 2, total: 3 } })]);
  const rows = rowsOf(world.ledger.db);
  const red = seamMoveOf({ kind: 'retry', origin: 'seam-reconcile-red', op: 'work.author', jobId: SUCCEEDED, cutId: 'cut1' }, rows);
  assert.equal(red.origin, 'seam-reconcile-red');
  assert.deepEqual(red.move.args, { workflow: WF, op: 'work.author', paths: '.starciwork/x', 'cut-id': 'cut1', 'cut-ordinal': '2', 'cut-total': '3', reopen: 'cut cut1 ordinal does not reconcile with the landed seam' });
  assert.equal(originOf({ origin: 'seam-reconcile' }).class, 'judgment');
  assert.equal(originOf({ origin: 'seam-recut' }).class, 'judgment');
  const items = buildMenu({ workflow: WF, rev: null, jobDecisions: [], questions: [], peers: [], wedged: [], deadWaits: [], decisions: [], handover: null, snoozed: new Set(),
    nextActions: [{ kind: 'impact-check', origin: 'seam-reconcile', op: 'x', jobId: 'op-x-1', cutId: 'c', reason: 'reconcile' }, { kind: 'retry', origin: 'seam-recut', op: 'x', jobId: 'op-x-2', cutId: 'c', reason: 'recut' }] });
  assert.deepEqual(items.map((item) => item.kind), ['seam-duty', 'seam-duty']);
  assert.ok(items.every((item) => item.mode === 'judgment' && item.options[0].direct));
}));

test('every move the projection builds is accepted by enqueue: a passed unit reopens, the same request twice is refused as an open try', (t) => withLedger(t, (world) => {
  seed(world.ledger, [job(SUCCEEDED, 'succeeded', { subject: true })]);
  const move = rerunMoveOf(rowsOf(world.ledger.db)[0], { reason: 'records it read changed since it settled' });
  world.ledger.close();
  const env = { ...process.env, [TEST_REGISTRY_ENV]: world.machineFile, STARCI_LOCAL_ROOT: world.machineHome, STARCI_AUTOPILOT: 'off', ORCA_TERMINAL_HANDLE: '' };
  const run = () => spawnSync(process.execPath, [CLI, 'enqueue', ...Object.entries(move.args).flatMap(([flag, value]) => [`--${flag}`, value]), '--repo', world.repoRoot, '--json'],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 180_000, env });
  const first = run();
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const { unit } = JSON.parse(first.stdout);
  assert.deepEqual([unit.unitId, unit.tryNo], [SUCCEEDED, 2], 'the second try of the passed unit, not a new unit');
  assert.notEqual(run().status, 0, 'the unit now has an open try');
}));

const fakeCtx = (answer) => {
  const calls = [], opened = [];
  return { calls, opened, now: () => 1_000_000, api: async (_ledger, verb, argv) => { calls.push([verb, ...argv]); return answer; }, openDecision: async (di) => { opened.push(di); return { ok: true }; } };
};
const deps = { facts: (jobId) => (jobId === FAILED ? { jobId, workflowId: WF, op: 'work.author', status: 'failed', terminal: null } : { jobId, workflowId: WF, op: 'work.author', status: 'succeeded' }),
  refused: (facts, reason) => ({ kind: 'retry-decision', entity: facts.jobId, reason }), workflowId: WF, settings: { allowedVerbs: ['enqueue'], decisionDueMs: 60_000 } };

test('the controller makes each origin\'s move once, skips a move a gate holds, and a refused move opens the Decision Item that fits', async () => {
  const move = (origin, args, extra = {}) => ({ kind: 'dispatch', origin, op: 'work.author', move: { verb: 'enqueue', args: { workflow: WF, op: 'work.author', paths: '.starciwork/x', ...args } }, ...extra });
  const status = { nextActions: [move('approved-leg', {}), move('stale-ready', { reopen: 'records it read changed' }, { jobId: SUCCEEDED }), move('red-node', { 'retry-of': FAILED }, { jobId: FAILED }),
    move('credential-step', {}, { heldBy: { incident: 'inc-gate' } })] };
  assert.deepEqual(mechanicalMovesOf(status).map((entry) => entry.origin), ['approved-leg', 'stale-ready', 'red-node'], 'a held move is the gate\'s to release');
  const ctx = fakeCtx({ ok: false, error: 'unit-try-budget-exhausted' });
  const first = await runMechanicalMoves(ctx, 'ledger-origin', status, deps);
  assert.deepEqual(first.map((entry) => entry.ok), [false, false, false]);
  assert.deepEqual(ctx.opened.map((di) => di.kind), ['move-refused', 'move-refused', 'retry-decision'], 'a failed job nothing follows is a retry-decision, the rest a refused move');
  const [leg, stale] = ctx.opened;
  assert.equal(leg.entity.type, 'workflow');
  assert.equal(stale.entity.id, SUCCEEDED);
  assert.match(leg.summary, /approved-leg work\.author: the runtime's move was refused \(the approved-leg move was refused: unit-try-budget-exhausted\)/);
  const again = parseKernelCommand(stale.options[0].verb);
  assert.deepEqual([again.verb, again.args.reopen, again.args.workflow], ['enqueue', 'records it read changed', WF], 'the option is the refused command, runnable as it stands');
  assert.equal(stale.dueAt, 1_060_000);
  assert.deepEqual(await runMechanicalMoves(ctx, 'ledger-origin', status, deps), [], 'a move made is not made again');
  assert.equal(ctx.calls.length, 3);
});
