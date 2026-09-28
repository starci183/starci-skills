// The Job controller's worker-health probe: deterministic classification, backoff, staggered nudges, DIs last.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { classifyWorker, planHealth, resetHintMs, HEALTH_DEFAULTS, NUDGE } from '../scripts/reconciler/worker-health.mjs';
import job, { _health } from '../scripts/reconciler/controllers/job.mjs';
import { fakeCtx } from '../scripts/reconciler/testing.mjs';
import { openLedger } from '../engine/ledger-db.mjs';

const H = HEALTH_DEFAULTS;
const T0 = 1_800_000_000_000;
const term = (over = {}) => ({ handle: 'term_1', connected: true, lastOutputAt: T0, preview: '', agentIdentity: 'devin', ...over });

test('classification', () => {
  assert.equal(classifyWorker(null).state, 'dead');
  assert.equal(classifyWorker(term({ exitCause: 'exit 0' })).state, 'dead');
  assert.notEqual(classifyWorker(term({ connected: false, orphaned: true }), { now: T0 }).state, 'dead', 'an orphaned product-worktree terminal still runs');
  const rl = classifyWorker(term({ preview: 'Reached free model rate limit. Send a message to retry' }), { now: T0 });
  assert.equal(rl.state, 'rate-limited');
  assert.equal(classifyWorker(term({ preview: 'Upgrade to Pro for higher limits' })).state, 'rate-limited');
  assert.equal(resetHintMs('limit resets in 5 minutes'), 300_000);
  assert.equal(resetHintMs('try again in 30s'), 30_000);
  assert.equal(classifyWorker(term({ preview: 'Worked for 12m 3s - done' }), { now: T0 }).state, 'done-without-report');
  assert.equal(classifyWorker(term({ preview: 'Worked for 12m 3s - done' }), { now: T0, reportFiled: true, mem: { lastOutputAt: T0 } }).state, 'working');
  assert.equal(classifyWorker(term({ lastOutputAt: T0 + 5 }), { mem: { lastOutputAt: T0 }, now: T0 + 10 }).state, 'working');
  assert.equal(classifyWorker(term(), { mem: { lastOutputAt: T0 }, now: T0 + H.idleMs + 1 }).state, 'idle-at-prompt');
  assert.equal(classifyWorker(term(), { mem: { lastOutputAt: T0 }, now: T0 + H.idleMs + 1, reportFiled: true }).state, 'working');
});

test('rate limit: backoff 30s doubling to 5 min with jitter, then the retry nudge; a DI past 30 min', () => {
  let mem = {}, now = T0;
  const c = { state: 'rate-limited', resetMs: null };
  let p = planHealth(c, { mem, now, rand: () => 0 }); assert.equal(p.action, null); assert.equal(p.mem.nextAt - now, 30_000); mem = p.mem;
  now += 30_000; p = planHealth(c, { mem, now, rand: () => 0 }); assert.deepEqual(p.action, { kind: 'send', text: NUDGE.retry }); mem = p.mem;
  p = planHealth(c, { mem, now, rand: () => 0 }); assert.equal(p.mem.nextAt - now, 60_000); mem = p.mem;
  for (let i = 0; i < 6; i += 1) { now = mem.nextAt ?? now; p = planHealth(c, { mem, now, rand: () => 0 }); mem = p.mem; p = planHealth(c, { mem, now, rand: () => 0 }); mem = p.mem; }
  assert.ok(mem.backoffMs <= H.backoffMaxMs);
  const hinted = planHealth({ state: 'rate-limited', resetMs: 120_000 }, { mem: {}, now: T0 });
  assert.equal(hinted.mem.nextAt, T0 + 120_000);
  const late = planHealth(c, { mem: { state: 'rate-limited', since: T0 }, now: T0 + H.rateLimitDecisionMs + 1 });
  assert.equal(late.action.kind, 'decision');
});

test('idle: at most 2 nudges, then one DI; done-without-report: report nudges, then failed-no-report after 10 min', () => {
  const idle = { state: 'idle-at-prompt' };
  let mem = {}, now = T0, sends = 0, decisions = 0;
  for (let i = 0; i < 30; i += 1) { const p = planHealth(idle, { mem, now }); mem = p.mem; if (p.action?.kind === 'send') sends += 1; if (p.action?.kind === 'decision') decisions += 1; now += 60_000; }
  assert.equal(sends, 2); assert.equal(decisions, 1);
  const done = { state: 'done-without-report' };
  let p = planHealth(done, { mem: {}, now: T0 }); assert.equal(p.action.text, NUDGE.report);
  p = planHealth(done, { mem: p.mem, now: T0 + H.doneFailAfterMs + 1 }); assert.equal(p.action.kind, 'fail-no-report');
  p = planHealth(done, { mem: p.mem, now: T0 + H.doneFailAfterMs + 2 }); assert.equal(p.action, null, 'once');
  assert.equal(planHealth({ state: 'working', lastOutputAt: T0 }, { mem: { nudges: 2, state: 'idle-at-prompt' }, now: T0 }).mem.nudges, undefined, 'progress resets the memory');
});

test('the probe over a ledger: shadow would-sends, staggered 15 s apart, a rate-limit row for the Resource controller', async () => {
  _health.reset();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-health-'));
  const file = path.join(dir, 'runtime.sqlite');
  const ledger = openLedger({ file });
  ledger.db.prepare("INSERT INTO workflows(workflow_id,created_at,updated_at,phase) VALUES('wf-x',1,1,'running')").run();
  for (const [id, h] of [['op-a', 'term_a'], ['op-b', 'term_b']]) ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,payload_json,status,worker_id,created_at,updated_at) VALUES(?, 'wf-x','code.refactor',1,0,'op','{\"provider\":\"devin-agent\"}','running',?,1,1)").run(id, h);
  ledger.close();
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const rl = 'Reached free model rate limit. Send a message to retry';
    let now = T0;
    const terminals = [{ handle: 'term_a', connected: true, lastOutputAt: T0 - 1000, preview: rl, agentIdentity: 'devin' }, { handle: 'term_b', connected: true, lastOutputAt: T0 - 1000, preview: rl, agentIdentity: 'devin' }];
    const ctx = fakeCtx({ controller: 'job', now: () => now, ledgers: [{ ledgerId: 'nivo', repo: dir, file }], dbs: { nivo: db }, terminalList: async () => ({ ok: true, terminals }), terminalShow: async () => null });
    assert.ok((await job.list(ctx)).includes('health:all'));
    await job.reconcile('health:all', ctx);
    assert.equal(ctx.calls.log.filter((r) => r.kind === 'reconciler.provider-rate-limited').length, 2);
    assert.ok(ctx.calls.clock.some((c) => c.state === 'WORKER_STALLED'));
    now += 61_000; await job.reconcile('health:all', ctx);
    assert.equal(ctx.calls.run.length, 1, 'one send per stagger window');
    assert.equal(ctx.calls.run[0].args[0], 'scripts/api/orca/terminal-send.mjs');
    now += 16_000; await job.reconcile('health:all', ctx);
    assert.equal(ctx.calls.run.length, 2);
    assert.notEqual(ctx.calls.run[0].args[2], ctx.calls.run[1].args[2], 'the second worker gets its nudge next');
    terminals[0] = { ...terminals[0], lastOutputAt: now, preview: 'editing files' };
    now += 16_000; const r = await job.reconcile('health:all', ctx);
    assert.equal(r.states.working, 1);
    assert.ok(ctx.calls.clear.some((c) => c.entity === 'job:nivo:op-a' && c.state === 'WORKER_STALLED'));
  } finally { db.close(); _health.reset(); }
});
