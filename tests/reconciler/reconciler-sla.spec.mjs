import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { slaPass, slaCatalog, codeOf, entityOf, setClock, clearClock, clocksOf, openViolations, VIOLATED_KIND, CLEARED_KIND } from '../../scripts/reconciler/sla.mjs';
import { TEST_REGISTRY_ENV, openMachine } from '../../engine/db/machine.mjs';
import { allocationSettings } from '../../engine/config.mjs';

// Lane rc-sla-workflow (DESIGN.md §8.8, Appendix A): a clock past its SLA is ONE runtime-invariant-violated Supervisor
// event (sup_events; deduped by code|entity across passes), its clear ONE runtime-invariant-cleared event, and a
// critical code ONE runtime-defect DI for the Supervisor. The clocks are machine.sqlite sla_episodes (append-only) of a
// temp machine.sqlite; the ctx is the smallest one the engine contract (LANES.md "Shared contract") describes.

const MIN = 60_000;

function world(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-rc-sla-'));
  const env = { ...process.env, LOCALAPPDATA: path.join(root, 'la'), STARCI_CONNECTORS_OFF: '1',
    [TEST_REGISTRY_ENV]: path.join(root, 'machine.sqlite') };
  let now = Date.parse('2026-09-28T10:00:00Z');
  const m = openMachine({ env, now: () => now });
  t.after(() => { m.close(); fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); });
  const decisions = [];
  const ctx = { mode: 'shadow', env, machine: m, stateFile: m.file, now: () => now, openDecision: async (di) => { decisions.push(di); return { ok: true, shadow: true }; } };
  const events = (kind) => m.supEvents({ kind, entityType: 'invariant', order: 'asc', limit: 1000 }).map((r) => ({ key: r.entity_id, ...r.payload }));
  const logs = () => m.logs({ actor: 'reconciler', limit: 1000 }).reverse();
  return { ctx, m, env, decisions, events, logs, advance: (ms) => { now += ms; }, at: () => now };
}

test('a clock past its SLA is exactly one violation event (deduped across passes); clearing it is one cleared event', async (t) => {
  const w = world(t);
  await setClock(w.ctx, { entity: 'workflow:todo-app-be:wf-todo-app-a', state: 'STALL_UNOWNED', slaMs: 30 * MIN, ledgerId: 'todo-app-be', enteredAt: w.at() - 10 * MIN });
  let r = await slaPass(w.ctx);
  assert.equal(r.violated.length, 0, 'inside its SLA');
  w.advance(25 * MIN);
  r = await slaPass(w.ctx);
  assert.equal(r.violated.length, 1);
  const [ev] = r.violated;
  assert.equal(ev.code, 'STALL_UNOWNED');
  assert.equal(ev.severity, 'warn');
  assert.deepEqual(ev.entity, { type: 'workflow', id: 'wf-todo-app-a', ledger: 'todo-app-be', workflowId: 'wf-todo-app-a' });
  assert.equal(ev.dedupeKey, 'STALL_UNOWNED|workflow:todo-app-be:wf-todo-app-a');
  assert.equal(ev.ageMs, 35 * MIN);
  assert.equal(ev.owner, 'kernel');
  assert.equal(w.events(VIOLATED_KIND).length, 1);
  assert.ok(w.logs().some((l) => l.kind === 'invariant.violated' && /invariant\.violated STALL_UNOWNED/.test(l.msg)), 'one typed row');
  assert.equal(w.decisions.length, 0, 'warn opens no DI');

  w.advance(MIN);
  r = await slaPass(w.ctx);
  assert.equal(r.violated.length, 0, 'deduped: the episode is marked violated');
  assert.equal(w.events(VIOLATED_KIND).length, 1);
  assert.equal(w.m.db.prepare('SELECT COUNT(*) AS n FROM invariant_violations WHERE cleared_at IS NULL').get().n, 1, 'one open invariant violation');
  await clearClock(w.ctx, { entity: 'workflow:todo-app-be:wf-todo-app-a', state: 'STALL_UNOWNED' });
  r = await slaPass(w.ctx);
  assert.equal(r.cleared.length, 1);
  assert.equal(w.events(CLEARED_KIND).length, 1);
  assert.equal(clocksOf(w.ctx).length, 0, 'no open episode');
  assert.deepEqual(clocksOf(w.ctx, { open: false }).map((c) => c.clearReason), ['resolved'], 'the episode stays, cleared once (append-only)');
  assert.equal(w.m.db.prepare('SELECT COUNT(*) AS n FROM invariant_violations WHERE cleared_at IS NULL').get().n, 0, 'the violation is cleared');
  r = await slaPass(w.ctx);
  assert.equal(r.cleared.length + r.violated.length, 0, 'nothing twice');
  assert.equal(openViolations({ env: w.env }).length, 0);

  // Re-entering the state later is a new episode: one new violation.
  await setClock(w.ctx, { entity: 'workflow:todo-app-be:wf-todo-app-a', state: 'STALL_UNOWNED', slaMs: 30 * MIN, ledgerId: 'todo-app-be', enteredAt: w.at() - 31 * MIN });
  r = await slaPass(w.ctx);
  assert.equal(r.violated.length, 1);
  assert.equal(w.events(VIOLATED_KIND).length, 2);
});

test('a critical code opens exactly one runtime-defect DI for the Supervisor', async (t) => {
  const w = world(t);
  await setClock(w.ctx, { entity: 'workflow:todo-app-be:wf-todo-app-x', state: 'GOAL_TEXT_MISSING', slaMs: 0, ledgerId: 'todo-app-be', enteredAt: w.at() - 1000 });
  await setClock(w.ctx, { entity: 'stuck:todo-app-be:wf-todo-app-x:peer-wait:inc-1', state: 'PEER_WAIT_OVERDUE/critical', slaMs: 4 * 60 * MIN, ledgerId: 'todo-app-be', enteredAt: w.at() - 5 * 60 * MIN });
  const r = await slaPass(w.ctx);
  assert.equal(r.violated.length, 2);
  assert.equal(r.decisions, 2);
  const goal = w.decisions.find((d) => d.code === 'GOAL_TEXT_MISSING');
  assert.equal(goal.kind, 'runtime-defect');
  assert.equal(goal.decider, 'supervisor');
  assert.equal(goal.idempotencyKey, 'runtime-defect:GOAL_TEXT_MISSING|workflow:todo-app-be:wf-todo-app-x');
  const peer = w.decisions.find((d) => d.code === 'PEER_WAIT_OVERDUE');
  assert.equal(peer.severity, 'critical', 'a /critical clock is the critical threshold of its code');
  assert.equal(peer.workflowId, 'wf-todo-app-x');
  w.advance(MIN);
  await slaPass(w.ctx);
  assert.equal(w.decisions.length, 2, 'no second DI on the next pass');
});

test('the catalogue covers Appendix A and cites runtimes.yaml keys instead of copying them', () => {
  const cat = slaCatalog();
  for (const code of ['READY_UNDISPATCHED', 'SETTLE_OVERDUE', 'STALL_UNOWNED', 'STALL_ESCALATED', 'ORPHANED_FRONTIER', 'REV_ACK_OVERDUE', 'GOAL_TEXT_MISSING',
    'PEER_WAIT_OVERDUE', 'WAIT_OVERDUE', 'SUPERVISOR_GATE_OVERDUE', 'ENDED_WITH_LIVE_WORK', 'IMPORTS_BROKEN_AFTER_MOVE', 'PRODUCT_WORKTREE_LEAK']) assert.ok(cat.codes[code], code);
  const a = allocationSettings();
  assert.equal(cat.codes.STALL_UNOWNED.slaKey, 'progress.graceMs');
  assert.equal(cat.codes.STALL_UNOWNED.slaMs, a.progress.graceMs);
  assert.equal(cat.codes.STALL_ESCALATED.slaMs, a.progress.supervisorGraceMs);
  assert.equal(cat.codes.WORKER_START_STUCK.slaMs, a.liveness.launchGraceMs + 120_000);
  assert.equal(cat.codes.PEER_WAIT_OVERDUE.criticalMs, a.opTelemetry.stuckSla['peer-wait'].criticalMs);
  assert.equal(cat.codes.GOAL_TEXT_MISSING.severity, 'critical');
  assert.deepEqual(codeOf('stalled', cat).code, 'STALL_UNOWNED', 'a mapped state');
  assert.deepEqual(codeOf('SOMETHING_NEW', cat), { code: 'SOMETHING_NEW', severity: 'warn', spec: null, critical: false });
  assert.equal(codeOf('WAIT_OVERDUE/critical', cat).severity, 'critical');
  assert.deepEqual(entityOf('job:todo-app-be:op-x', 'todo-app-be').type, 'job');
});

test('no machine.sqlite is a skipped pass, never a throw', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-rc-sla-none-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const r = await slaPass({ now: () => Date.now(), env: { ...process.env, [TEST_REGISTRY_ENV]: path.join(root, 'absent.sqlite') }, stateFile: path.join(root, 'absent.sqlite') });
  assert.equal(r.ok, true);
  assert.deepEqual(r.skipped, ['no-state-db']);
  assert.equal(fs.existsSync(path.join(root, 'absent.sqlite')), false, 'the read-only pass never creates the store');
});

// Coordinator 2026-09-28 (live, every controller active): SERVICE_DOWN service:harness-ui and DECISION_OVERDUE
// job:todo-app-be:op-code.refactor-df7f8417b9 stayed violated after their condition was gone - the clear waited on the
// owning controller's next transition (the host's probe timed out on the first request after idle). Every pass now
// re-checks each open clock against current truth and clears it with ONE cleared event and ONE invariant.cleared row.
test('truth: a violated clock whose condition is gone is cleared by the pass itself, once, with one invariant.cleared row', async (t) => {
  const { withLedger, seedWorkflow } = await import('../helpers/ledger-fixture.mjs');
  await withLedger(t, async ({ ledger, ledgerFile }) => {
    const w = world(t);
    seedWorkflow(ledger, { id: 'wf-todo-app-fe', jobs: [
      { jobId: 'op-code.refactor-df7f8417b9', opId: 'code.refactor', status: 'running' },
      { jobId: 'op-code.refactor-0000000001', opId: 'code.refactor', status: 'running' },
      { jobId: 'op-code.refactor-0000000002', opId: 'code.refactor', status: 'succeeded' },
    ] });
    let probeOk = false;
    let dis = [{ id: 'di-1', status: 'open', entity: { type: 'job', id: 'op-code.refactor-df7f8417b9' } }];
    const ctx = { ...w.ctx, ledgers: [{ ledgerId: 'todo-app-be', file: ledgerFile }],
      serviceRegistry: async () => [{ name: 'harness-ui', probe: async () => (probeOk ? { ok: true, status: 200 } : { ok: false, error: 'TimeoutError' }) }],
      decisionsModule: { listDecisions: () => dis } };
    const past = w.at() - 20 * MIN;
    await setClock(ctx, { entity: 'service:harness-ui', state: 'SERVICE_DOWN', slaMs: 2 * MIN, ledgerId: 'supervisor', enteredAt: past });
    await setClock(ctx, { entity: 'job:todo-app-be:op-code.refactor-df7f8417b9', state: 'DECISION_OVERDUE', slaMs: 15 * MIN, ledgerId: 'todo-app-be', enteredAt: past });
    await setClock(ctx, { entity: 'job:todo-app-be:op-code.refactor-0000000001', state: 'DECISION_OVERDUE', slaMs: 15 * MIN, ledgerId: 'todo-app-be', enteredAt: past });
    await setClock(ctx, { entity: 'job:todo-app-be:op-code.refactor-0000000002', state: 'SETTLE_OVERDUE', slaMs: 3 * MIN, ledgerId: 'todo-app-be', enteredAt: past });

    let r = await slaPass(ctx);
    assert.deepEqual(r.violated.map((e) => e.code).sort(), ['DECISION_OVERDUE', 'DECISION_OVERDUE', 'SERVICE_DOWN'], 'still true: violated; the settled job never violates');
    assert.deepEqual(r.truthCleared.map((c) => c.clock), ['job:todo-app-be:op-code.refactor-0000000002 SETTLE_OVERDUE']);

    // Truth changes with no controller transition: the service answers, the decision is resolved.
    probeOk = true;
    dis = [{ id: 'di-1', status: 'resolved', entity: { type: 'job', id: 'op-code.refactor-df7f8417b9' } }];
    w.advance(MIN);
    r = await slaPass(ctx);
    assert.deepEqual(r.cleared.map((e) => e.dedupeKey).sort(), ['DECISION_OVERDUE|job:todo-app-be:op-code.refactor-df7f8417b9', 'SERVICE_DOWN|service:harness-ui']);
    assert.ok(r.cleared.every((e) => e.clearedBy === 'sla-truth'));
    const rows = w.logs().filter((l) => l.kind === 'invariant.cleared');
    assert.equal(rows.length, 2, 'one invariant.cleared row each');
    assert.match(rows.map((l) => l.msg).join('\n'), /SERVICE_DOWN service harness-ui \(sla-truth: probe ok \(http 200\)\)/);
    assert.equal(w.events(CLEARED_KIND).length, 2);
    assert.deepEqual(openViolations({ env: w.env }).map((v) => v.dedupeKey), ['DECISION_OVERDUE|job:todo-app-be:op-code.refactor-0000000001'], 'a job with no decision yet keeps its clock');

    // A controller that re-sets the cleared clock from its stale view is cleared again before it can re-violate.
    await setClock(ctx, { entity: 'service:harness-ui', state: 'SERVICE_DOWN', slaMs: 2 * MIN, ledgerId: 'supervisor', enteredAt: past });
    w.advance(MIN);
    r = await slaPass(ctx);
    assert.equal(r.violated.length, 0);
    assert.equal(w.events(VIOLATED_KIND).length, 3, 'no new violation');
  });
});
