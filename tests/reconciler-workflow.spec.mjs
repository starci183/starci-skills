import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { withLedger, seedWorkflow } from './_ledger-fixture.mjs';
import controller, { reconcileWorkflow, listWorkflows, planWorkflow, workflowSettings, keyOf } from '../scripts/reconciler/controllers/workflow.mjs';
import { slaPass, clocksOf, SLA_CLOCKS_DDL } from '../scripts/reconciler/sla.mjs';

// Lane rc-sla-workflow, the Workflow controller (DESIGN.md §8.2, §9.2, §17.1). Fixture: the nivo Collab incident the
// stall specs use (tests/supervisor-stall.spec.mjs) - an owner gate naming a record that has since landed, a workflow
// idle 120 minutes. The ctx is the smallest one the engine contract describes (LANES.md "Shared contract"): shadow
// mode, api / openDecision / log recorded, a temp reconciler.sqlite for the SLA clocks.

const require = createRequire(import.meta.url);
const MIN = 60_000;
const NOW = Date.now();
const WF = 'wf-nivo-collab-group-chat-mudqjp5g';
const PEER = 'wf-nivo-app-auth-mudqjob3';
const LEDGER = 'nivo-backend';
const HELD = ['op-interface.implement-0a1619a4ac', 'op-interface.implement-a485eea143', 'op-interface.implement-490960859c'];
const GATE_TEXT = `Runtime now requires the product app shell record .starciwork/shell/index.yaml (work/app-shell@1) before interface.draw/implement dispatch; it is absent. Owner decision pending in peer ${PEER}'s ask. Resolve when the shell record exists (peer heads-up).`;
const GOAL = { markdown: '# Collab\nGroup chat for the Nivo app.' };

function seed(ledger, { goal = GOAL, progressAgoMin = 120 } = {}) {
  seedWorkflow(ledger, { id: WF, now: NOW - 600 * MIN, goal,
    events: [
      { kind: 'op-dispatched', payload: { jobId: 'op-interface.draw-1111111111' }, created_at: NOW - progressAgoMin * MIN },
      { kind: 'incident-raised', entityType: 'incident', entityId: 'inc-48bc556d89a6', payload: { kind: 'owner-gate', detail: GATE_TEXT, holds: [...HELD, 'interface.implement'] }, created_at: NOW - 180 * MIN },
    ],
    jobs: HELD.map((jobId) => ({ jobId, opId: 'interface.implement', status: 'queued', createdAt: NOW - 180 * MIN, updatedAt: NOW - 180 * MIN })) });
  seedWorkflow(ledger, { id: PEER, now: NOW - 600 * MIN, goal: GOAL, events: [{ kind: 'op-settled', payload: {}, created_at: NOW - 5 * MIN }] });
  ledger.db.prepare("UPDATE workflows SET phase='running'").run();
  ledger.db.prepare('INSERT INTO incidents(incident_id,workflow_id,op_id,last_progress,status,updated_at) VALUES(?,?,?,?,?,?)')
    .run('inc-48bc556d89a6', WF, 'interface.implement', `[owner-gate] ${GATE_TEXT}`, 'open', NOW - 180 * MIN);
}
const writeShell = (repoRoot) => {
  const file = path.join(repoRoot, '.starciwork', 'shell', 'index.yaml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'schema: work/layout-tree@1\nid: shell\nstate: done\n');
  fs.utimesSync(file, new Date(NOW - 40 * MIN), new Date(NOW - 40 * MIN));
};
const status = ({ frontier = {}, ...over } = {}) => ({ ok: true, phase: 'running', workers: [], progress: null, rca: null, stuck: [], ...over,
  frontier: { state: 'engaged', actionable: false, queued: [], queuedCauses: { 'owner-gate': 3 }, reason: null, ...frontier } });

/** The shadow ctx: every action recorded; clocks in a temp reconciler.sqlite through sla.mjs (no ctx.clock). */
function fakeCtx({ repoRoot, ledgerFile, statusOf = () => status(), now = NOW }) {
  const stateFile = path.join(path.dirname(repoRoot), 'reconciler.sqlite');
  if (!fs.existsSync(stateFile)) { const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(stateFile); db.exec(SLA_CLOCKS_DDL); db.close(); }
  const rec = { api: [], run: [], decisions: [], logs: [] };
  const ctx = {
    mode: 'shadow', now: () => now, stateFile, env: { ...process.env, STARCI_SUPERVISOR_HOME: path.join(path.dirname(repoRoot), 'sup') },
    ledgers: [{ ledgerId: LEDGER, repo: repoRoot, file: ledgerFile }, { ledgerId: 'supervisor', repo: null, file: path.join(path.dirname(repoRoot), 'nope.sqlite') }],
    status: async (_ledgerId, wf) => statusOf(wf),
    api: async (ledgerId, verb, argv) => { rec.api.push({ ledgerId, verb, argv }); return { ok: true, shadow: true }; },
    run: async (cmd, args) => { rec.run.push({ cmd, args }); return { ok: true, shadow: true }; },
    openDecision: async (di) => { rec.decisions.push(di); return { ok: true, shadow: true }; },
    log: async (kind, msg, data) => { rec.logs.push({ kind, msg, data }); },
    owns: () => false,
  };
  return { ctx, rec };
}

test('a STALE-GATE finding is one stale-gate DI for the Kernel and one doorbell would-row; nothing is typed into a terminal', (t) => withLedger(t, async ({ repoRoot, ledger, ledgerFile }) => {
  seed(ledger);
  writeShell(repoRoot);
  const { ctx, rec } = fakeCtx({ repoRoot, ledgerFile });
  const key = keyOf(LEDGER, WF);
  assert.ok((await listWorkflows(ctx)).includes(key), 'the resync lists every running workflow');
  const r = await reconcileWorkflow(key, ctx);
  assert.ok(r.findings.includes('STALE-GATE'), r.findings.join(','));
  const gates = rec.decisions.filter((d) => d.kind === 'stale-gate');
  assert.equal(gates.length, 1);
  assert.equal(gates[0].idempotencyKey, `stale-gate:${WF}:inc-48bc556d89a6`);
  assert.equal(gates[0].decider, 'kernel');
  assert.equal(gates[0].schema, 'starci/decision-item@1');
  assert.match(gates[0].evidence[0].ref, /^STALE-GATE wf-nivo-collab-group-chat-mudqjp5g inc-48bc556d89a6/);
  assert.equal(rec.run.length, 0, 'no actuator ran (no wake, no terminal typing)');
  assert.equal(rec.api.length, 0, 'no api verb for a finding: the Kernel decides it');
  const bells = rec.logs.filter((l) => l.kind === 'reconciler.would' && l.data?.action === 'doorbell');
  assert.equal(bells.length, 1, 'one doorbell for the pass, a would-row before lane rc-decisions lands');
  assert.ok(bells[0].data.keys.includes(`stale-gate:${WF}:inc-48bc556d89a6`));

  // The next pass opens nothing again (one DI per decision window).
  await reconcileWorkflow(key, ctx);
  assert.equal(rec.decisions.filter((d) => d.kind === 'stale-gate').length, 1);
}));

test('a stall past progress.supervisorGraceMs escalates the same progress-stall DI to the Supervisor', (t) => withLedger(t, async ({ repoRoot, ledger, ledgerFile }) => {
  seed(ledger, { progressAgoMin: 120 });
  const settings = workflowSettings();
  const { ctx, rec } = fakeCtx({ repoRoot, ledgerFile });
  await reconcileWorkflow(keyOf(LEDGER, WF), ctx);
  const stall = rec.decisions.filter((d) => d.kind === 'progress-stall');
  assert.deepEqual(stall.map((d) => [d.decider, d.idempotencyKey]).sort(), [
    ['kernel', `progress-stall:${WF}:stall`],
    ['supervisor', `progress-stall:${WF}:stall@supervisor`],
  ]);
  const up = stall.find((d) => d.decider === 'supervisor');
  assert.equal(up.escalatedFrom, `progress-stall:${WF}:stall`);
  assert.equal(up.escalations, 1);
  assert.match(up.summary, /^ESCALATED \(120m >= supervisorGraceMs 60m\)/);
  const clocks = clocksOf(ctx, { prefixes: [`workflow:${LEDGER}:${WF}`] });
  assert.deepEqual(clocks.map((c) => c.state).sort(), ['STALL_ESCALATED', 'STALL_UNOWNED']);
  assert.equal(clocks.find((c) => c.state === 'STALL_UNOWNED').slaMs, settings.graceMs);

  // Inside the grace window: the Kernel's DI only.
  const young = planWorkflow({ ledgerId: LEDGER, workflowId: WF, now: NOW, settings,
    findings: [{ type: 'STALLED', alert: true, idleSince: NOW - 40 * MIN, line: `STALLED ${WF} idle 40m: frontier engaged` }] });
  assert.deepEqual(young.decisions.map((d) => d.decider), ['kernel']);
}));

test('a running workflow with a null goal text gets a critical GOAL_TEXT_MISSING clock, which the SLA pass reports with one DI', (t) => withLedger(t, async ({ repoRoot, ledger, ledgerFile }) => {
  seed(ledger, { goal: { markdown: 'Goal gốc: null' }, progressAgoMin: 5 });
  const { ctx } = fakeCtx({ repoRoot, ledgerFile });
  await reconcileWorkflow(keyOf(LEDGER, WF), ctx);
  const clock = clocksOf(ctx, { prefixes: [`workflow:${LEDGER}:${WF}`] }).find((c) => c.state === 'GOAL_TEXT_MISSING');
  assert.ok(clock, 'the goal clock is set');
  assert.equal(clock.slaMs, 0);
  const slaDecisions = [];
  const out = await slaPass({ ...ctx, now: () => NOW + 1000, openDecision: async (di) => { slaDecisions.push(di); return { ok: true, shadow: true }; } });
  const goal = out.violated.find((v) => v.code === 'GOAL_TEXT_MISSING');
  assert.equal(goal.severity, 'critical');
  assert.equal(slaDecisions.filter((d) => d.kind === 'runtime-defect').length, 1);
}));

test('asks: dead / stale / unserved are re-parked through api serve-ask (a would-row in shadow); on-demand is untouched', (t) => withLedger(t, async ({ repoRoot, ledger, ledgerFile }) => {
  seed(ledger, { progressAgoMin: 5 });
  const addAsk = (dispatchId, notified) => {
    ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?,?)')
      .run(WF, dispatchId, 'interface.scaffold', 1, 1, 'ask', '{}', NOW - 60 * MIN);
    if (notified) ledger.appendEvent({ workflowId: WF, entityType: 'workflow', entityId: WF, kind: 'ask-notified', payload: { dispatchId }, createdAt: NOW - 59 * MIN });
  };
  addAsk('ctx_unserved00001', false);
  addAsk('ctx_ondemand00001', true);
  const { ctx, rec } = fakeCtx({ repoRoot, ledgerFile });
  await reconcileWorkflow(keyOf(LEDGER, WF), ctx);
  assert.deepEqual(rec.api.map((a) => [a.verb, ...a.argv]), [['serve-ask', '--workflow', WF, '--dispatch', 'ctx_unserved00001']]);
}));

test('finish-ready (every job settled, handover approved) is api finish; an ended workflow clears its clocks', (t) => withLedger(t, async ({ repoRoot, ledger, ledgerFile }) => {
  seed(ledger, { progressAgoMin: 5 });
  const { ctx, rec } = fakeCtx({ repoRoot, ledgerFile, statusOf: () => status({ frontier: { state: 'finish-ready', actionable: true, openOperations: 0 },
    kernelRev: { stale: true, acked: 'a7461cbb4952aaaa', current: 'b709a530dffcbbbb', files: ['modules/kernel/driver-loop.yaml'] } }) });
  const key = keyOf(LEDGER, WF);
  await reconcileWorkflow(key, ctx);
  assert.deepEqual(rec.api.map((a) => [a.verb, ...a.argv]), [['finish', '--workflow', WF]]);
  assert.deepEqual(rec.decisions.filter((d) => d.kind === 'rev-ack'), [], 'a fresh stale rev is a re-wake, not a decision');
  assert.ok(rec.logs.some((l) => l.kind === 'reconciler.would' && (l.data?.keys ?? []).includes('rev:b709a530dffc')), 'one doorbell carries the new rev');
  assert.ok(clocksOf(ctx, { prefixes: [`workflow:${LEDGER}:${WF}`] }).some((c) => c.state === 'REV_ACK_OVERDUE'));
  const overdue = planWorkflow({ ledgerId: LEDGER, workflowId: WF, now: NOW, settings: workflowSettings(),
    status: status({ kernelRev: { stale: true, acked: 'a7461cbb4952aaaa', current: 'b709a530dffcbbbb', files: [] } }),
    clocks: [{ entity: `workflow:${LEDGER}:${WF}`, state: 'REV_ACK_OVERDUE', enteredAt: NOW - workflowSettings().revAckMs - 1 }] });
  assert.deepEqual(overdue.decisions.filter((d) => d.kind === 'rev-ack').map((d) => d.idempotencyKey), [`rev-ack:${WF}:runtime-rev`], 'overdue: one DI per workflow, whatever the rev');

  ledger.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id=?").run(WF);
  const r = await reconcileWorkflow(key, ctx);
  assert.equal(r.ended, 'finished');
  assert.equal(clocksOf(ctx, { prefixes: [`workflow:${LEDGER}:${WF}`] }).length, 0, 'every clock of the ended workflow is cleared');
}));

test('stuck[] waits become clocks at their opTelemetry.stuckSla thresholds; the contract shape the engine discovers', () => {
  const settings = workflowSettings();
  const plan = planWorkflow({ ledgerId: LEDGER, workflowId: WF, now: NOW, settings, status: status({ stuck: [
    { key: `stuck:${WF}:peer-wait:inc-9`, kind: 'peer-wait', since: NOW - 2 * 60 * MIN },
    { key: `stuck:${WF}:owner-gate:inc-7`, kind: 'owner-gate', cause: 'supervisor-gate', since: NOW - MIN },
  ] }) });
  const byState = Object.fromEntries(plan.clocks.map((c) => [`${c.entity} ${c.state}`, c.slaMs]));
  assert.equal(byState[`stuck:${LEDGER}:${WF}:peer-wait:inc-9 PEER_WAIT_OVERDUE`], settings.stuckSla['peer-wait'].warnMs);
  assert.equal(byState[`stuck:${LEDGER}:${WF}:peer-wait:inc-9 PEER_WAIT_OVERDUE/critical`], settings.stuckSla['peer-wait'].criticalMs);
  assert.equal(byState[`stuck:${LEDGER}:${WF}:owner-gate:inc-7 SUPERVISOR_GATE_OVERDUE`], settings.supervisorGateMs);
  assert.equal(plan.decisions.length, 0, 'a wait inside its SLA opens no DI');

  assert.equal(controller.name, 'workflow');
  assert.deepEqual(controller.concerns, ['workflow.stall-wake', 'workflow.progress', 'workflow.ask-repark']);
  assert.equal(controller.resyncMs, 120_000);
  assert.equal(controller.routes['op-settled']({ ledgerId: LEDGER, workflowId: WF, kind: 'op-settled' }), keyOf(LEDGER, WF));
  assert.equal(controller.routes['runtime-rev-acked']({ ledgerId: 'supervisor', workflowId: 'wf-supervisor' }), null);
});
