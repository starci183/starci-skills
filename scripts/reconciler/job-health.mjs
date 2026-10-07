// scripts/reconciler/job-health.mjs — the worker-health pass of the Job controller (controllers/job.mjs key `health:all`):
// every live op job's worker is classified from ONE orca terminal list (worker-health.mjs classifyWorker / planHealth),
// its stall clock kept, and the planned nudge, dead-worker settle or Decision Item sent through ctx.
import { eachInOrder } from '../lib/in-order.mjs';
import { parseJson } from '../lib/json.mjs';
import { reportedJobs } from '../machine/reported-jobs.mjs';
import { OPENED_BY, SUPERVISOR_LEDGER, jobKey } from './job-keys.mjs';
import { classifyWorker, planHealth } from './worker-health.mjs';

const healthMem = new Map(); // jobId -> probe memory (worker-health.mjs planHealth), per engine process
/** H14/H12: the settler's lease sweep marked the job's lease dead (conditions LeaseLive=False). */
const leaseLostOf = (db, jobId) => {
  try { return Boolean(db.prepare("SELECT 1 FROM conditions WHERE entity_type='job' AND entity_id=? AND type='LeaseLive' AND status='False'").get(jobId)); } catch { return false; }
};
let lastSendAt = 0;          // the stagger across every worker of the host
const LIVE_WORKER = ['leased', 'running', 'answering'];
const STALLED_STATES = new Set(['rate-limited', 'idle-at-prompt', 'done-without-report']);
const TERMINAL_SEND = 'scripts/api/orca/terminal-send.mjs';

async function showTerminal(handle, ctx) {
  try {
    if (ctx.terminalShow) return (await ctx.terminalShow(handle)) ?? null;
    const r = (await import('../api/orca/terminal-show.mjs')).terminalShow({ terminal: handle });
    return r?.ok ? r.terminal ?? null : null;
  } catch { return null; }
}

/** The live op jobs of one ledger with their report and lease facts. */
const liveJobsOf = (ctx, ledgerId) => ctx.read(ledgerId, (db) => db.prepare(`SELECT job_id, workflow_id, op_id, status, worker_id, payload_json FROM jobs WHERE kind='op' AND worker_id IS NOT NULL
  AND status IN (${LIVE_WORKER.map(() => '?').join(',')})`).all(...LIVE_WORKER).map((r) => ({ ...r, reportFiled: reportedJobs(db, { jobId: r.job_id }).length > 0, leaseLost: leaseLostOf(db, r.job_id) }))) ?? [];

/** The stall clock of a job: running while its worker is stalled, cleared otherwise. */
function keepStallClock(ctx, entity, ledgerId, c, planned, probe) {
  if (STALLED_STATES.has(c.state)) ctx.clock(entity, 'WORKER_STALLED', probe.H.idleMs, { ledgerId, enteredAt: planned.mem.since ?? probe.now });
  else ctx.clear(entity, 'WORKER_STALLED');
}

/** The log rows of a worker whose state changed (not to `working`). */
function logStateChange(ctx, j, c, mem, who, term) {
  if (c.state === mem.state || c.state === 'working') return;
  ctx.log('reconciler.worker-health', j.job_id + ' ' + c.state + (c.resetMs != null ? ' (reset in ' + Math.round(c.resetMs / 1000) + 's)' : ''), { ...who, state: c.state, preview: String(term?.preview ?? '').slice(0, 200) });
  if (c.state === 'rate-limited') ctx.log('reconciler.provider-rate-limited', `provider ${who.provider ?? '?'} rate-limited (${j.job_id})`, { ...who, resetMs: c.resetMs ?? null });
}

/** The stalled-worker Decision Item: the automatic nudges did not move it. */
function openStalledDecision(probe, l, j, c, planned, who, term) {
  const { ctx, settings, now } = probe;
  const a = planned.action;
  return ctx.openDecision({ schema: 'starci/decision-item@1', kind: 'worker-stalled', idempotencyKey: `worker-stalled:${j.job_id}:${c.state}:${planned.mem.since ?? now}`,
    decider: 'kernel', ledger: l.ledgerId, workflowId: j.workflow_id, entity: { type: 'job', id: j.job_id },
    summary: `${j.op_id} ${j.job_id} (${who.provider ?? 'worker'}) is ${c.state}: ${a.why}; the automatic nudges did not move it`,
    evidence: [{ ref: `terminal:${j.worker_id}` }, { ref: String(term?.preview ?? '').slice(0, 200) }], allowedVerbs: ['nudge', 'reconcile', 'route', 'enqueue'],
    dueAt: now + settings.decisionDueMs, escalateTo: 'supervisor', openedBy: OPENED_BY, openedAt: now });
}

/** Do the planned action of one job; the probe memory to keep for it. `judged` is the classified job: ledger, job, class, plan, memory, identity, terminal. */
async function act(probe, judged) {
  const { l, j, c, planned, mem, who, term } = judged;
  const { ctx, H, now, out } = probe;
  const a = planned.action;
  if (a && ctx.mode === 'active' && !ctx.owns('job.worker')) return mem;
  if (a?.kind === 'send') {
    if (now - lastSendAt < H.staggerMs) return { ...mem, state: c.state, since: planned.mem.since, seenAt: planned.mem.seenAt };
    lastSendAt = now;
    await ctx.run('node', [TERMINAL_SEND, '--terminal', j.worker_id, '--text', a.text], { timeoutMs: 60_000 });
    out.sends += 1;
  } else if (a?.kind === 'dead-worker') {
    // H14: a gone/exited worker, or one whose lease the settler found expired (LeaseLive=False), is settled now.
    ctx.log('reconciler.worker-health', `${j.job_id} dead (${a.why}): starci kernel reconcile --dead-worker --settle-failed`, { ...who, state: 'dead', why: a.why });
    await ctx.api(l.ledgerId, 'reconcile', ['--job', j.job_id, '--dead-worker', '--settle-failed']);
  } else if (a?.kind === 'fail-no-report') {
    // done-without-report past doneFailAfterMs, or a rate limit beyond the wait budget: the failed-no-report path (its salvage continues from the commits).
    if (a.why) ctx.log('reconciler.worker-health', `${j.job_id} moves to the next agent: ${a.why}`, { ...who, state: c.state, why: a.why });
    await ctx.api(l.ledgerId, 'reconcile', ['--job', j.job_id, '--dead-worker', '--settle-failed']);
  } else if (a?.kind === 'decision') {
    await openStalledDecision(probe, l, j, c, planned, who, term);
    out.decisions += 1;
  }
  return planned.mem;
}

/** Probe one live job: classify its worker, keep its clock, log a change, act. */
async function probeJob(probe, l, j) {
  const { ctx, byHandle, now, out, H } = probe;
  out.probed += 1;
  probe.seen.add(j.job_id);
  // A workflow-worktree terminal is not in the default list: read it by handle.
  if (!byHandle.has(j.worker_id)) byHandle.set(j.worker_id, await showTerminal(j.worker_id, ctx));
  const term = byHandle.get(j.worker_id) ?? null;
  const mem = healthMem.get(j.job_id) ?? {};
  const c = classifyWorker(term, { mem, reportFiled: j.reportFiled, leaseLost: j.leaseLost, now, settings: H });
  out.states[c.state] = (out.states[c.state] ?? 0) + 1;
  const planned = planHealth(c, { mem, now, settings: H });
  keepStallClock(ctx, jobKey(l.ledgerId, j.job_id), l.ledgerId, c, planned, probe);
  const payload = parseJson(j.payload_json) ?? {};
  const who = { jobId: j.job_id, workflowId: j.workflow_id, op: j.op_id, terminal: j.worker_id, provider: term?.agentIdentity ?? payload.provider ?? null, pool: payload.agent ?? payload.provider ?? null, model: payload.model ?? null };
  logStateChange(ctx, j, c, mem, who, term);
  healthMem.set(j.job_id, await act(probe, { l, j, c, planned, mem, who, term }));
}

/** One probe: every live op job's worker, classified from ONE orca terminal list. */
export async function reconcileHealth(ctx, settings, { list = null } = {}) {
  let listed;
  try { listed = list ? await list() : (await import('../api/orca/terminal-list.mjs')).terminalList({}); } catch (error) { listed = { ok: false, error: String(error?.message ?? error) }; }
  if (!listed?.ok || listed.hostUnavailable) return { ok: true, action: 'host-unavailable', error: listed?.error ?? null };
  const probe = { ctx, settings, H: settings.health, now: ctx.now(), byHandle: new Map((listed.terminals ?? []).map((t) => [t.handle, t])), seen: new Set(),
    out: { ok: true, action: 'health', probed: 0, states: {}, sends: 0, decisions: 0 } };
  await eachInOrder(ctx.ledgers ?? [], (l) => (l.ledgerId === SUPERVISOR_LEDGER ? undefined : eachInOrder(liveJobsOf(ctx, l.ledgerId), (j) => probeJob(probe, l, j))));
  for (const id of [...healthMem.keys()]) if (!probe.seen.has(id)) healthMem.delete(id); // a job no longer live forgets its probe memory
  return probe.out;
}
export const _health = { reset: () => { healthMem.clear(); lastSendAt = 0; }, mem: healthMem };
