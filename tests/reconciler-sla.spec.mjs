import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { slaPass, slaCatalog, codeOf, entityOf, setClock, clearClock, clocksOf, openViolations, SLA_CLOCKS_DDL, VIOLATED_KIND, CLEARED_KIND } from '../scripts/reconciler/sla.mjs';
import { withSupervisorRead, SUPERVISOR_WF } from '../scripts/supervisor/home.mjs';
import { allocationSettings } from '../engine/config.mjs';

// Lane rc-sla-workflow (DESIGN.md §8.8, Appendix A): a clock past its SLA is ONE runtime-invariant-violated event on the
// supervisor ledger (deduped by code|entity across passes), its clear ONE runtime-invariant-cleared event, and a
// critical code ONE runtime-defect DI for the Supervisor. The state DB is a temp reconciler.sqlite with the §7.3
// sla_clocks table; the ctx is the smallest one the engine contract (LANES.md "Shared contract") describes.

const require = createRequire(import.meta.url);
const MIN = 60_000;

function world(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-rc-sla-'));
  const env = { ...process.env, LOCALAPPDATA: path.join(root, 'la'), STARCI_SUPERVISOR_HOME: path.join(root, 'home'), STARCI_CONNECTORS_OFF: '1' };
  fs.mkdirSync(env.STARCI_SUPERVISOR_HOME, { recursive: true });
  const stateFile = path.join(env.STARCI_SUPERVISOR_HOME, 'reconciler.sqlite');
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(stateFile);
  db.exec(SLA_CLOCKS_DDL);
  db.close();
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }));
  let now = Date.parse('2026-09-28T10:00:00Z');
  const decisions = [];
  const ctx = { mode: 'shadow', env, stateFile, now: () => now, openDecision: async (di) => { decisions.push(di); return { ok: true, shadow: true }; } };
  const events = (kind) => withSupervisorRead((sdb) => sdb.prepare('SELECT entity_id, payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(SUPERVISOR_WF, kind)
    .map((r) => ({ key: r.entity_id, ...JSON.parse(r.payload_json) })), [], { env });
  const logs = () => withSupervisorRead((sdb) => sdb.prepare("SELECT kind, msg, data_json FROM logs WHERE workflow_id=? ORDER BY seq").all(SUPERVISOR_WF), [], { env });
  return { ctx, env, decisions, events, logs, advance: (ms) => { now += ms; }, at: () => now };
}

test('a clock past its SLA is exactly one violation event (deduped across passes); clearing it is one cleared event', async (t) => {
  const w = world(t);
  await setClock(w.ctx, { entity: 'workflow:nivo-backend:wf-nivo-a', state: 'STALL_UNOWNED', slaMs: 30 * MIN, ledgerId: 'nivo-backend', enteredAt: w.at() - 10 * MIN });
  let r = await slaPass(w.ctx);
  assert.equal(r.violated.length, 0, 'inside its SLA');
  w.advance(25 * MIN);
  r = await slaPass(w.ctx);
  assert.equal(r.violated.length, 1);
  const [ev] = r.violated;
  assert.equal(ev.code, 'STALL_UNOWNED');
  assert.equal(ev.severity, 'warn');
  assert.deepEqual(ev.entity, { type: 'workflow', id: 'wf-nivo-a', ledger: 'nivo-backend', workflowId: 'wf-nivo-a' });
  assert.equal(ev.dedupeKey, 'STALL_UNOWNED|workflow:nivo-backend:wf-nivo-a');
  assert.equal(ev.ageMs, 35 * MIN);
  assert.equal(ev.owner, 'kernel');
  assert.equal(w.events(VIOLATED_KIND).length, 1);
  assert.ok(w.logs().some((l) => l.kind === 'warning' && /invariant\.violated STALL_UNOWNED/.test(l.msg)), 'one typed row');
  assert.equal(w.decisions.length, 0, 'warn opens no DI');

  w.advance(MIN);
  r = await slaPass(w.ctx);
  assert.equal(r.violated.length, 0, 'deduped: the clock is marked violated');
  // Even with the clock's mark lost (a state DB reset), the ledger's newest event for the dedupeKey dedupes.
  { const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(w.ctx.stateFile); db.exec('UPDATE sla_clocks SET violated_at=NULL'); db.close(); }
  r = await slaPass(w.ctx);
  assert.equal(r.violated.length, 0);
  assert.equal(w.events(VIOLATED_KIND).length, 1);
  await clearClock(w.ctx, { entity: 'workflow:nivo-backend:wf-nivo-a', state: 'STALL_UNOWNED' });
  r = await slaPass(w.ctx);
  assert.equal(r.cleared.length, 1);
  assert.equal(w.events(CLEARED_KIND).length, 1);
  assert.equal(clocksOf(w.ctx, { open: false }).length, 0, 'the reported clear drops the row');
  r = await slaPass(w.ctx);
  assert.equal(r.cleared.length + r.violated.length, 0, 'nothing twice');
  assert.equal(openViolations({ env: w.env }).length, 0);

  // Re-entering the state later is a new episode: one new violation.
  await setClock(w.ctx, { entity: 'workflow:nivo-backend:wf-nivo-a', state: 'STALL_UNOWNED', slaMs: 30 * MIN, ledgerId: 'nivo-backend', enteredAt: w.at() - 31 * MIN });
  r = await slaPass(w.ctx);
  assert.equal(r.violated.length, 1);
  assert.equal(w.events(VIOLATED_KIND).length, 2);
});

test('a critical code opens exactly one runtime-defect DI for the Supervisor', async (t) => {
  const w = world(t);
  await setClock(w.ctx, { entity: 'workflow:mia-mia-backend:wf-mia-x', state: 'GOAL_TEXT_MISSING', slaMs: 0, ledgerId: 'mia-mia-backend', enteredAt: w.at() - 1000 });
  await setClock(w.ctx, { entity: 'stuck:mia-mia-backend:wf-mia-x:peer-wait:inc-1', state: 'PEER_WAIT_OVERDUE/critical', slaMs: 4 * 60 * MIN, ledgerId: 'mia-mia-backend', enteredAt: w.at() - 5 * 60 * MIN });
  const r = await slaPass(w.ctx);
  assert.equal(r.violated.length, 2);
  assert.equal(r.decisions, 2);
  const goal = w.decisions.find((d) => d.code === 'GOAL_TEXT_MISSING');
  assert.equal(goal.kind, 'runtime-defect');
  assert.equal(goal.decider, 'supervisor');
  assert.equal(goal.idempotencyKey, 'runtime-defect:GOAL_TEXT_MISSING|workflow:mia-mia-backend:wf-mia-x');
  const peer = w.decisions.find((d) => d.code === 'PEER_WAIT_OVERDUE');
  assert.equal(peer.severity, 'critical', 'a /critical clock is the critical threshold of its code');
  assert.equal(peer.workflowId, 'wf-mia-x');
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
  assert.deepEqual(entityOf('job:nivo-backend:op-x', 'nivo-backend').type, 'job');
});

test('no state DB is a skipped pass, never a throw', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-rc-sla-none-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const r = await slaPass({ now: () => Date.now(), env: { ...process.env, STARCI_SUPERVISOR_HOME: root }, stateFile: path.join(root, 'absent.sqlite') });
  assert.equal(r.ok, true);
  assert.deepEqual(r.skipped, ['no-state-db']);
  assert.equal(fs.existsSync(path.join(root, 'absent.sqlite')), false, 'the layer never creates the engine state file');
});
