// controllers/gc.mjs — the reconciler's GC controller (DESIGN §8.5, §15; lane rc-gc-resource).
//
// It wraps scripts/supervisor/gc.mjs, never re-implements it. Three triggers:
//   1. an event (op-settled, worker-released[-on-report], kernel-stale-cleared, land-succeeded/land-passed,
//      workflow-finished, workflow-archived) → verify just that entity: its workers (Orca's worker-list of the entity's
//      Runs: a reclaimable worker on one of its terminals is released per Orca's nextAction, lib/worker-accounting.mjs
//      releasePlan), its other terminals (classifyTerminals restricted to the entity's handles), its leases
//      (classifyLeases) and, for a landed [Worker] job, its staging checkout. What the owner step left behind is
//      released through worker-release or closed through the verified close (close-verify.mjs --tree) and recorded as a
//      leftover lesson (lessons.mjs recordLeftover, klass per DESIGN §15.3). A leaked lease has no api path that
//      deletes it: it is reported and a runtime-defect Decision Item goes to the Supervisor (LEASE_LEAK);
//   2. key gc:sweep, every allocation.gc.sweepMs (30 min): runGc({apply: mode === 'active'}) under the host lock
//      `gc` (runGc takes it on a live apply), so a hand-run gc.mjs never overlaps;
//   3. key gc:housekeeping, every housekeepingEveryMs (24 h) and at once when host-resources reads lowDisk/lowRam
//      (at most every lowResourceGapMs): `node scripts/housekeeping/housekeeping.mjs --apply` through ctx.run.
//   4. key gc:blob-sweep, every blobSweepEveryMs (24 h): scripts/housekeeping/blob-gc.mjs (mark each ledger, then machine.sqlite;
//      sweep what nothing marks) - shadow logs the read-only plan, active runs --apply as a child.
//   5. key gc:worktrees, every worktrees.gcEveryMs (5 min, modules/kernel/product-land.yaml): scripts/machine/worktrees.mjs
//      gcWorktrees. ALWAYS ACTIVE, whatever the controller's mode (owner order lane WT: 600+ orphan worktrees piled up
//      while the GC ran shadow): a worktree whose branch is merged, whose owner op settled, or whose owner process has
//      been gone for worktrees.ownerGoneMs (30 min) is preserved (refs/heads/preserved/<name>) and removed; a tree
//      stamped as the runtime's in Orca's worktree ps with no registry row is adopted (recorded keep) or preserved
//      and removed. Every item is a gc_items row.
//
// Shadow: every actuator goes through ctx.run (the engine records a reconciler.would row and runs nothing) or, for an
// in-process one (the sweep, a staging removal), a reconciler.would row written here; the sweep runs gc.mjs as a dry
// run with its seen-state and machine-log writes switched off, so a shadow sweep mutates nothing.
//
// Numbers: modules/reconciler/gc.yaml (resyncMs, concurrency, housekeepingEveryMs, lowResourceGapMs, eventGraceMs).
// createGcController(deps) is the spec seam: every host read and write is a dep.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../engine/yaml.mjs';
import { claimDue, finishDuty } from '../schedules.mjs';
import { SETTLED_JOB_LIST } from '../../../engine/admission.mjs';
import { releasePlan, workerTerminalHandles } from '../../lib/worker-accounting.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const NAME = 'gc';
const OWNER = 'reconciler/gc';
export const DEFAULTS = Object.freeze({ resyncMs: 60_000, concurrency: 2, housekeepingEveryMs: 86_400_000, lowResourceGapMs: 3_600_000, eventGraceMs: 60_000,
  eventMaxTries: 6, blobSweepEveryMs: 86_400_000 });
/** MB-14: a retry lands this long after the grace window closes, never exactly on its edge. */
export const GRACE_MARGIN_MS = 5_000;
const LIVE_JOB = new Set(['queued', 'leased', 'running', 'answering', 'effect_unknown']);
const SETTLED = new Set(SETTLED_JOB_LIST);
const SUP_FINAL = new Set(['succeeded', 'failed', 'cancelled']);
const WOULD = 'reconciler.would';

/** modules/reconciler/gc.yaml over the defaults. */
export function gcControllerSettings(file = path.join(ROOT, 'modules', 'reconciler', 'gc.yaml')) {
  let doc = {};
  try { doc = parseYaml(fs.readFileSync(file, 'utf8')) ?? {}; } catch { doc = {}; }
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) { const n = Number(doc?.[k]); if (Number.isFinite(n) && n > 0) out[k] = n; }
  return out;
}

/* ------------------------------------------------------------ keys */

const clean = (s) => String(s ?? '').trim();
export const jobKey = (ledgerId, jobId) => (clean(ledgerId) && clean(jobId) ? `gc:job:${clean(ledgerId)}:${clean(jobId)}` : null);
export const workflowKey = (ledgerId, workflowId) => (clean(ledgerId) && clean(workflowId) ? `gc:workflow:${clean(ledgerId)}:${clean(workflowId)}` : null);
export const landKey = (jobId) => (clean(jobId) ? `gc:land:${clean(jobId)}` : null);

/** A key → {type, ledgerId?, id}. The ledger id never holds ':' (a repo basename or 'supervisor'); ids may. */
export function parseKey(key) {
  const k = String(key ?? '');
  if (k === 'gc:sweep' || k === 'gc:housekeeping' || k === 'gc:blob-sweep' || k === 'gc:worktrees') return { type: k.slice(3) };
  let m = /^gc:(job|workflow):([^:]+):(.+)$/.exec(k);
  if (m) return { type: m[1], ledgerId: m[2], id: m[3] };
  m = /^gc:land:(.+)$/.exec(k);
  if (m) return { type: 'land', id: m[1] };
  return { type: 'unknown' };
}

const payloadOf = (ev) => (ev?.payload && typeof ev.payload === 'object' ? ev.payload : {});
const jobOfEvent = (ev) => jobKey(ev?.ledgerId, ev?.jobId ?? (ev?.entityType === 'job' || !ev?.entityType ? ev?.entityId : null) ?? payloadOf(ev).jobId);
const workflowOfEvent = (ev) => workflowKey(ev?.ledgerId, ev?.workflowId ?? payloadOf(ev).workflowId ?? (ev?.entityType === 'workflow' ? ev?.entityId : null));
const landOfEvent = (ev) => (ev?.kind === 'land-failed' ? null : landKey(payloadOf(ev).jobId ?? ev?.jobId ?? null));

export const ROUTES = Object.freeze({
  'op-settled': jobOfEvent,
  'worker-released': jobOfEvent,
  'worker-released-on-report': jobOfEvent,
  'kernel-stale-cleared': workflowOfEvent,
  'workflow-finished': workflowOfEvent,
  'workflow-archived': workflowOfEvent,
  'land-succeeded': landOfEvent,
  'land-passed': landOfEvent,
});

/* ------------------------------------------------------------ live deps (lazy: discovery stays cheap) */

const liveDeps = {
  gc: () => import('../../supervisor/gc.mjs'),
  // The sweep is a CHILD process, never runGc in the engine: it walks every lane worktree and Orca terminal with synchronous
  // git/CLI calls (minutes on a loaded host) and the engine has one thread (ENGINE-STALL: it stalled the lease at the
  // sweep's due time, three restarts in an hour). {apply, holder} -> the report gc.mjs prints, or throws.
  sweep: async ({ apply, holder = null }) => {
    const { runChild } = await import('../services.mjs');
    const args = [path.join(ROOT, 'scripts', 'supervisor', 'gc.mjs'), ...(apply ? ['--apply', '--holder', holder ?? OWNER, '--trigger', 'sweep'] : ['--plan', '--trigger', 'sweep']), '--json'];
    const r = await runChild(process.execPath, args, { timeoutMs: 900_000 });
    let report = null;
    try { report = JSON.parse(r.stdout); } catch { report = null; }
    if (!report || !Array.isArray(report.items)) throw new Error(`gc sweep child gave no report: ${r.timedOut ? 'timed out' : String(r.stderr).trim().slice(-300) || `exit ${r.status}`}`);
    return report;
  },
  list: async () => (await import('../../api/orca/terminal-list.mjs')).terminalList({ includeVisualLayouts: true }),
  // Orca's worker accounting of one Run (every page).
  workers: async (run) => (await import('../../machine/worker-list-all.mjs')).workerListAll({ run }),
  worktrees: async ({ env, repos }) => (await import('../../machine/worktrees.mjs')).gcWorktrees({ env, repos: (await import('../../kernel/target-repo.mjs')).boundRepoRoots(repos) }),
  worktreeSettings: async () => (await import('../../machine/worktree-registry.mjs')).worktreeSettings(),
  read: async () => (await import('../../api/orca/terminal-read.mjs')).terminalRead,
  hostResources: async () => (await import('../../machine/host-resources.mjs')).hostResourcesFor({}),
  lesson: async (args) => (await import('../../machine/lessons.mjs')).recordLeftover(args),
  removeStaging: async (args) => (await import('../../supervisor/workers.mjs')).removeStaging(args),
  stagingExists: async (job) => Boolean(job?.staging?.path) && fs.existsSync(job.staging.path),
  // MB-13/MB-14 (G4): every GC item's final outcome in machine.sqlite gc_runs / gc_items, through the one writer.
  recordRun: async ({ trigger, report = null, items = [] }) => {
    const { withMachine } = await import('../../../engine/db/machine.mjs');
    return withMachine((m) => m.transaction(() => {
      const runId = m.startGcRun({ trigger });
      for (const it of items) m.recordGcItem({ runId, ...it });
      m.finishGcRun(runId, { counts: report?.counts ?? null, errors: report?.errors ?? null, freedBytes: report?.counts?.freedBytes ?? null, report });
      return runId;
    }));
  },
  recordSweep: async (report) => {
    const { withSupervisor, supervisorEvent } = await import('../../machine/home.mjs');
    const { GC_EVENT_KIND } = await import('../../supervisor/gc.mjs');
    withSupervisor((m) => supervisorEvent(m, { entityType: 'gc', entityId: 'reconciler', kind: GC_EVENT_KIND, payload: { ...report.counts, line: report.line, errors: report.errors.length, by: OWNER } }));
  },
};

/** One sweep report item as a gc_items row (G4): the action taken and its final outcome. Pure. */
export function sweepItem(i) {
  const failed = i.ok === false, done = i.ok === true;
  const acted = { 'close-terminal': 'closed', 'kill-tree': 'killed' }[i.action] ?? 'removed';
  const action = i.verdict === 'refuse' ? 'refuse' : i.verdict === 'keep' ? 'keep' : failed ? 'failed' : done ? acted : 'collect';
  return { collector: 'gc-sweep', kind: String(i.class ?? 'unknown'), target: String(i.target ?? ''), ownerRef: i.owner ?? null, action, reason: i.reason ?? null,
    bytes: Number(i.bytes ?? i.ramBytes) || null, ageMs: i.firstSeenAt ? Math.max(0, Date.now() - Number(i.firstSeenAt)) : null,
    outcome: failed ? 'gave-up' : done ? 'done' : 'dropped', ...(failed ? { lastError: String(i.error ?? 'failed').slice(0, 300) } : {}) };
}

/* ------------------------------------------------------------ the controller */

export function createGcController(overrides = {}) {
  const deps = { ...liveDeps, ...overrides };
  const settings = { ...gcControllerSettings(), ...(overrides.settings ?? {}) };

  const would = (ctx, action, target, data = {}) => ctx.log(WOULD, `${action} ${target}`, { controller: NAME, action, target, ...data });
  const tries = new Map(); // key -> grace waits so far (per engine process; the final outcome is durable in gc_items)

  /** Record GC items (active only: shadow changed nothing). Never throws; a failed write is one error row. */
  async function record(ctx, trigger, items, report = null) {
    if (ctx.mode !== 'active' || !items.length) return null;
    try { return await deps.recordRun({ trigger, report, items }); }
    catch (error) { ctx.log('reconciler.gc.record.error', `gc_items write failed: ${String(error?.message ?? error).slice(0, 200)}`, { controller: NAME }); return null; }
  }

  /**
   * MB-14: an entity changed inside the grace window is re-queued for grace - age + GRACE_MARGIN_MS (not a full grace,
   * not an error). After eventMaxTries waits it is given up, and that outcome is recorded.
   */
  async function graceWait(ctx, key, { age, what }) {
    const n = (tries.get(key) ?? 0) + 1;
    tries.set(key, n);
    if (n > settings.eventMaxTries) {
      tries.delete(key);
      ctx.log('reconciler.gc.gave-up', `${what}: still changing after ${n - 1} grace waits; given up (the sweep covers it)`, { controller: NAME, key, tries: n - 1 });
      await record(ctx, 'event', [{ collector: 'gc-event', kind: parseKey(key).type, target: key, action: 'keep', reason: `still changing after ${n - 1} grace waits`, tries: n - 1, outcome: 'gave-up' }]);
      return { gaveUp: true, key, tries: n - 1 };
    }
    return { waiting: true, key, tries: n, requeueAfterMs: Math.max(1_000, settings.eventGraceMs - age + GRACE_MARGIN_MS) };
  }

  /** The final outcome of one event key: its closes (closed / failed) and one summary item (done / dropped). */
  async function recordEvent(ctx, key, { closes = [], skipped = null } = {}) {
    const n = tries.get(key) ?? 0;
    tries.delete(key);
    const items = closes.map((c) => ({ collector: 'gc-event', kind: c.klass ?? 'terminal', target: c.handle, ownerRef: key, action: c.ok === true ? 'closed' : 'failed',
      reason: c.reason ?? null, tries: n + 1, outcome: c.ok === true ? 'done' : 'gave-up', ...(c.ok === true ? { verifiedGoneAt: ctx.now() } : { lastError: c.error ?? 'close failed' }) }));
    items.push({ collector: 'gc-event', kind: parseKey(key).type, target: key, action: skipped ? 'keep' : 'collect', reason: skipped ?? `${closes.length} close(s)`, tries: n + 1,
      outcome: skipped ? 'dropped' : closes.every((c) => c.ok === true) ? 'done' : 'gave-up' });
    await record(ctx, 'event', items);
  }

  /** One verified close of a runtime terminal (the engine's shadow gate records it instead in shadow). */
  async function closeTerminal(ctx, d, { entity }) {
    const r = await ctx.run('node', ['scripts/machine/close-verify.mjs', '--terminal', d.handle, '--owner', OWNER, '--tree', '--log', '--json'], { timeoutMs: 90_000 });
    const closed = ctx.mode === 'active' && r?.ok === true && !r?.shadow;
    ctx.log('reconciler.gc.close', `${closed ? 'closed' : ctx.mode === 'active' ? 'close FAILED' : 'would close'} ${d.klass} ${d.handle} of ${entity}`, { controller: NAME, handle: d.handle, klass: d.klass, reason: d.reason, entity, ok: r?.ok ?? null, shadow: ctx.mode !== 'active' });
    if (closed) await deps.lesson({ klass: d.klass, count: 1, examples: [`${d.handle} ${String(d.title ?? '').slice(0, 50)} (${entity}, closed by the GC controller after its event)`] });
    return { handle: d.handle, klass: d.klass, reason: d.reason, ok: r?.ok ?? null, shadow: ctx.mode !== 'active', ...(closed || ctx.mode !== 'active' ? {} : { error: r?.error ?? r?.value?.error ?? 'close failed' }) };
  }

  /** One worker-release of a reclaimable worker Orca names (the engine's shadow gate records it instead in shadow). */
  async function releaseWorker(ctx, d, { entity }) {
    const r = await ctx.run('node', ['scripts/api/orca/worker-release.mjs', '--dispatch', d.dispatchId], { timeoutMs: 90_000 });
    const released = ctx.mode === 'active' && r?.ok === true && !r?.shadow;
    ctx.log('reconciler.gc.release', `${released ? 'released' : ctx.mode === 'active' ? 'release FAILED' : 'would release'} worker ${d.dispatchId} of ${entity}`, { controller: NAME, dispatch: d.dispatchId, terminal: d.terminalHandle, reason: d.reason, entity, ok: r?.ok ?? null, shadow: ctx.mode !== 'active' });
    if (released) await deps.lesson({ klass: 'worker', count: 1, examples: [`${d.dispatchId} ${d.terminalHandle ?? ''} (${entity}, released by the GC controller after its event)`] });
    return { handle: d.terminalHandle ?? d.dispatchId, klass: 'worker', reason: d.reason, ok: r?.ok ?? null, shadow: ctx.mode !== 'active', ...(released || ctx.mode !== 'active' ? {} : { error: r?.error ?? 'worker-release failed' }) };
  }

  /**
   * What one entity left behind: [{kind: 'release', ...releasePlan row} | {kind: 'close', ...classifyTerminals row}].
   * Orca's worker-list of the entity's Runs (`runs`) decides its workers (a reclaimable worker on one of the entity's terminals is
   * released per Orca's nextAction); classifyTerminals decides the entity's other terminals, never one Orca accounts for.
   */
  async function decideTerminals(ctx, { handles, sup, ledgers, owners = null, runs }) {
    const gc = await deps.gc();
    const rows = [];
    for (const run of runs.filter(Boolean)) {
      const listed = await deps.workers(run);
      if (!listed?.ok) throw Object.assign(new Error(`WORKER_LIST_UNAVAILABLE: worker-list --run ${run}: ${listed?.error ?? 'Orca did not answer'}`), { retryAfterMs: 60_000 });
      rows.push(...listed.workers);
    }
    const mine = (h) => (handles ? handles.includes(h) : true);
    const releases = releasePlan(rows).filter((d) => d.verdict === 'release' && d.terminalHandle && mine(d.terminalHandle)).map((d) => ({ kind: 'release', ...d }));
    const listed = await deps.list();
    if (!listed?.ok) throw Object.assign(new Error(`terminal list: ${listed?.error ?? 'Orca did not answer'}`), { retryAfterMs: 60_000 });
    const terminals = (listed.terminals ?? []).filter((t) => mine(t.handle));
    if (!terminals.length) return releases;
    const read = await deps.read();
    const screenOf = (h) => { try { const r = read({ terminal: h, screen: true }); return r?.ok ? r.screen ?? '' : null; } catch { return null; } };
    const s = gc.gcSettings();
    const decided = gc.classifyTerminals({ terminals, titles: gc.tabTitles(listed.visualLayouts), sup, ledgers, workers: workerTerminalHandles(rows), screenOf, now: ctx.now(), minAgeMs: s.minAgeMs, keepTitles: s.keepTitles });
    return [...releases, ...decided.filter((d) => d.verdict === 'collect' && (!owners || owners.has(String(d.owner ?? '')))).map((d) => ({ kind: 'close', ...d }))];
  }

  /** Release or close one decision of decideTerminals. */
  const settleLeftover = (ctx, d, { entity }) => (d.kind === 'release' ? releaseWorker(ctx, d, { entity }) : closeTerminal(ctx, d, { entity }));

  async function leaseDecision(ctx, leaks, { ledgerId, entity }) {
    if (!leaks.length) return 0;
    const summary = `LEASE_LEAK: ${leaks.length} lease(s) of ${entity} still held after it settled/ended (${leaks.slice(0, 3).map((l) => l.resourceKey).join(', ')}); no api path deletes them`;
    ctx.log('reconciler.gc.lease-leak', summary, { controller: NAME, ledgerId, entity, leases: leaks.slice(0, 20) });
    await ctx.openDecision({
      schema: 'starci/decision-item@1', kind: 'runtime-defect', decider: 'supervisor', ledger: ledgerId, workflowId: leaks[0]?.workflowId ?? null,
      idempotencyKey: `lease-leak:${ledgerId}:${entity}`, entity: { type: 'job', id: String(entity) }, summary,
      evidence: leaks.slice(0, 10).map((l) => ({ ref: `lease:${l.resourceKey}`, why: l.why })),
      options: [{ key: 'fix-release-step', verb: 'fix the settle/reconcile step that left the lease (DESIGN §15.3 orphan lease)', recommended: true }],
      allowedVerbs: [], openedBy: 'gc-controller', escalateTo: 'owner',
    });
    return leaks.length;
  }

  async function reconcileJob(ctx, { ledgerId, id: jobId }) {
    const gc = await deps.gc();
    const ledger = (ctx.ledgers ?? []).find((l) => l.ledgerId === ledgerId);
    if (!ledger) return { skipped: `unknown ledger ${ledgerId}` };
    if (ledgerId === 'supervisor') return reconcileSupJob(ctx, { jobId, sup: gc.supervisorView(), gc });
    const view = (deps.ledgerView ?? gc.ledgerView)(ledger.repo);
    const job = view?.jobs.find((j) => j.jobId === jobId);
    if (!job) return { skipped: 'job not in its ledger' };
    if (LIVE_JOB.has(job.status)) return { skipped: `job is ${job.status}` };
    const updatedAt = Number(job.updatedAt ?? 0);
    const key = jobKey(ledgerId, jobId);
    if (updatedAt && ctx.now() - updatedAt < settings.eventGraceMs) return graceWait(ctx, key, { age: ctx.now() - updatedAt, what: `job ${jobId}` });
    const closes = [];
    for (const d of await decideTerminals(ctx, { handles: job.handles, sup: { seat: null, jobs: [] }, ledgers: [view], runs: [job.task?.runId] })) closes.push(await settleLeftover(ctx, d, { entity: `job ${jobId}` }));
    const leaks = SETTLED.has(job.status) ? gc.classifyLeases({ rows: (view.leases ?? []).filter((l) => l.jobId === jobId).map((l) => ({ ...l, ledger: ledgerId })), now: ctx.now(), minAgeMs: 0 }) : [];
    const leases = await leaseDecision(ctx, leaks, { ledgerId, entity: jobId });
    await recordEvent(ctx, key, { closes });
    return { entity: `job:${jobId}`, closes, leases };
  }

  async function reconcileSupJob(ctx, { jobId, sup, gc }) {
    const job = sup.jobs.find((j) => j.jobId === jobId);
    if (!job) return { skipped: 'supervisor job unknown' };
    if (!SUP_FINAL.has(job.status)) return { skipped: `supervisor job is ${job.status}` };
    const updatedAt = Number(job.updatedAt ?? 0);
    if (updatedAt && ctx.now() - updatedAt < settings.eventGraceMs) return graceWait(ctx, landKey(jobId), { age: ctx.now() - updatedAt, what: `supervisor job ${jobId}` });
    const closes = [];
    if (job.handle && job.handle !== 'supervisor')
      for (const d of await decideTerminals(ctx, { handles: [job.handle], sup, ledgers: [], runs: [job.runId] })) closes.push(await settleLeftover(ctx, d, { entity: `[Worker] job ${jobId}` }));
    let staging = null;
    if (await deps.stagingExists(job)) {
      if (ctx.mode !== 'active') { would(ctx, 'remove-staging', jobId, { klass: 'staging', status: job.status }); staging = { shadow: true }; }
      else {
        const r = await deps.removeStaging({ jobId, staging: job.staging, landed: job.status === 'succeeded' });
        staging = { ok: r?.removed === true, error: r?.error ?? null };
        ctx.log('reconciler.gc.staging', `${staging.ok ? 'removed' : 'could not remove'} staging of ${job.status} job ${jobId}`, { controller: NAME, jobId, ...staging });
        if (staging.ok) await deps.lesson({ klass: 'staging', count: 1, examples: [`${job.staging.branch ?? jobId} (removeStaging did not run at report/land)`] });
      }
    }
    const leaks = gc.classifyLeases({ rows: (sup.leases ?? []).filter((l) => l.jobId === jobId).map((l) => ({ ...l, ledger: 'supervisor' })), now: ctx.now(), minAgeMs: 0 });
    const leases = await leaseDecision(ctx, leaks, { ledgerId: 'supervisor', entity: jobId });
    await recordEvent(ctx, landKey(jobId), { closes });
    return { entity: `sup-job:${jobId}`, closes, staging, leases };
  }

  async function reconcileWorkflow(ctx, { ledgerId, id: workflowId }) {
    const gc = await deps.gc();
    const ledger = (ctx.ledgers ?? []).find((l) => l.ledgerId === ledgerId);
    if (!ledger || ledgerId === 'supervisor') return { skipped: `no product ledger ${ledgerId}` };
    const view = (deps.ledgerView ?? gc.ledgerView)(ledger.repo);
    const wf = view?.workflows.find((w) => w.workflowId === workflowId);
    if (!wf) return { skipped: 'workflow not in its ledger' };
    // The entity's terminals: its Kernel seat, its jobs' terminals, and an unbound [Kernel]/[Op] that names it.
    const owners = new Set([workflowId, ...view.jobs.filter((j) => j.workflowId === workflowId).map((j) => j.jobId)]);
    const closes = [];
    for (const d of await decideTerminals(ctx, { handles: null, sup: { seat: null, jobs: [] }, ledgers: [view], owners, runs: [...new Set(view.jobs.filter((j) => j.workflowId === workflowId).map((j) => j.task?.runId))] })) closes.push(await settleLeftover(ctx, d, { entity: `workflow ${workflowId}` }));
    const leaks = wf.ended ? gc.classifyLeases({ rows: (view.leases ?? []).filter((l) => l.workflowId === workflowId).map((l) => ({ ...l, ledger: ledgerId })), now: ctx.now(), minAgeMs: 0 }) : [];
    const leases = await leaseDecision(ctx, leaks, { ledgerId, entity: workflowId });
    await recordEvent(ctx, workflowKey(ledgerId, workflowId), { closes });
    return { entity: `workflow:${workflowId}`, ended: wf.ended, closes, leases };
  }

  async function reconcileSweep(ctx) {
    const gc = await deps.gc();
    const sweepMs = settings.sweepMs ?? gc.gcSettings().sweepMs;
    const now = ctx.now();
    // MB-01: the cadence is durable (schedules), so an engine restart never sweeps early.
    const claim = claimDue(ctx, { controller: NAME, duty: 'sweep', intervalMs: sweepMs, now });
    if (!claim.due) return { skipped: 'not due', nextAt: claim.nextAt };
    if (ctx.mode !== 'active') {
      // A dry run that writes nothing: no seen-state, no machine-log rows, no lessons; the would-rows are ours.
      const report = await deps.sweep({ apply: false });
      const collect = report.items.filter((i) => i.verdict === 'collect');
      await ctx.run('node', ['scripts/supervisor/gc.mjs', '--apply', '--json'], { timeoutMs: 900_000 });
      ctx.log(WOULD, `sweep: ${report.line}`, { controller: NAME, action: 'gc-sweep', counts: report.counts,
        items: collect.slice(0, 300).map((i) => ({ class: i.class, action: i.action, target: String(i.target), owner: i.owner ?? null })), truncated: collect.length > 300 });
      await leaseDecisionsOf(ctx, report);
      finishDuty(ctx, { controller: NAME, duty: 'sweep', result: 'skipped', now: ctx.now() });
      return { shadow: true, wouldCollect: collect.length, counts: report.counts };
    }
    const report = await deps.sweep({ apply: true, holder: OWNER });
    if (report.busy) {
      claimDue(ctx, { controller: NAME, duty: 'sweep', intervalMs: 120_000, now, force: true }); // retry in 2 min, not a full interval
      finishDuty(ctx, { controller: NAME, duty: 'sweep', result: 'skipped', now: ctx.now() });
      throw Object.assign(new Error('gc-busy: another GC apply holds the host lock'), { retryAfterMs: 120_000 });
    }
    try { await deps.recordSweep(report); } catch { /* the sweep happened; the event is the digest's */ }
    ctx.log('reconciler.gc.sweep', report.line, { controller: NAME, counts: report.counts, errors: report.errors.slice(0, 5), progress: report.progress ?? null });
    if (report.stopped) await stoppedDecision(ctx, report.stopped);
    await leaseDecisionsOf(ctx, report);
    await record(ctx, 'sweep', report.items.map(sweepItem), report);
    finishDuty(ctx, { controller: NAME, duty: 'sweep', result: report.ok === false ? 'failed' : 'done', now: ctx.now() });
    return { counts: report.counts, ok: report.ok };
  }

  async function leaseDecisionsOf(ctx, report) {
    const byJob = new Map();
    for (const i of report.items) if (i.class === 'lease' && i.reportOnly) {
      const k = `${i.ledger}|${i.jobId}`;
      if (!byJob.has(k)) byJob.set(k, { ledgerId: i.ledger, jobId: i.jobId, rows: [] });
      byJob.get(k).rows.push({ resourceKey: String(i.target).split(':').slice(1).join(':'), workflowId: i.workflowId, why: i.reason });
    }
    for (const g of byJob.values()) await leaseDecision(ctx, g.rows, { ledgerId: g.ledgerId, entity: g.jobId });
  }

  /**
   * key gc:blob-sweep, every blobSweepEveryMs (24 h, schedules gc/blob-sweep): the blob store's mark-and-sweep
   * (scripts/housekeeping/blob-gc.mjs). It marks each enrolled ledger read-only, one at a time, then machine.sqlite,
   * and sweeps only what no source marks (its own Q4 retention and archive-before-delete). Shadow: the read-only plan
   * (planBlobGc) is logged and the --apply run is the engine's would-row; active: the --apply run as a child.
   */
  async function reconcileBlobSweep(ctx) {
    const now = ctx.now();
    const claim = claimDue(ctx, { controller: NAME, duty: 'blob-sweep', intervalMs: settings.blobSweepEveryMs, now });
    if (!claim.due) return { skipped: 'not due', nextAt: claim.nextAt ?? null };
    let plan = null;
    if (ctx.mode !== 'active') {
      try { plan = await (deps.planBlobGc ?? (async () => (await import('../../housekeeping/blob-gc.mjs')).planBlobGc({ env: ctx.env ?? process.env, now })))(); }
      catch (error) { plan = { error: String(error?.message ?? error).slice(0, 200) }; }
      ctx.log(WOULD, `blob-sweep: ${plan?.error ? `plan failed: ${plan.error}` : `${plan.marked} marked, ${plan.toArchive?.length ?? 0} to archive, ${plan.toSweep?.length ?? 0} to sweep (${Math.round(((plan.archiveBytes ?? 0) + (plan.sweepBytes ?? 0)) / 1e6)} MB)${plan.blocked?.length ? `, blocked: ${plan.blocked.join('; ')}` : ''}`}`,
        { controller: NAME, action: 'blob-sweep', sources: plan?.sources?.map((s) => ({ name: s.name, kind: s.kind, marks: s.marks, error: s.error ?? null })) ?? null });
    }
    const r = await ctx.run('node', ['scripts/housekeeping/blob-gc.mjs', '--apply', '--json'], { timeoutMs: 3_600_000 });
    if (ctx.mode === 'active') ctx.log('reconciler.gc.blob-sweep', `blob-sweep ${r?.ok ? 'done' : 'FAILED'}: ${r?.value?.refused ?? (r?.value ? `${r.value.items?.length ?? 0} item(s), ${Math.round((r.value.freedBytes ?? 0) / 1e6)} MB freed` : r?.error ?? '')}`,
      { controller: NAME, ok: r?.ok ?? null, runId: r?.value?.runId ?? null });
    finishDuty(ctx, { controller: NAME, duty: 'blob-sweep', result: ctx.mode !== 'active' ? 'skipped' : r?.ok === true ? 'done' : 'failed', now: ctx.now() });
    return ctx.mode === 'active' ? { ran: true, ok: r?.ok ?? null } : { shadow: true, plan: plan?.error ? { error: plan.error } : { marked: plan?.marked ?? null, toArchive: plan?.toArchive?.length ?? 0, toSweep: plan?.toSweep?.length ?? 0 } };
  }

  /** A removal changed a main checkout: the GC stopped itself; the Supervisor gets one runtime-defect item per stop. */
  async function stoppedDecision(ctx, stop) {
    ctx.log('reconciler.gc.stopped', `GC STOPPED: a worktree removal changed the main checkout (${(stop.damage ?? []).join('; ').slice(0, 300)})`, { controller: NAME, ...stop });
    await ctx.openDecision({
      schema: 'starci/decision-item@1', kind: 'runtime-defect', decider: 'supervisor', ledger: 'supervisor',
      idempotencyKey: `gc-main-damaged:${String(stop.path ?? 'unknown').replace(/:/g, '_')}`, entity: { type: 'worktree', id: String(stop.path ?? 'unknown') },
      summary: `The GC stopped: removing ${stop.path ?? 'a worktree'} changed the main checkout (${(stop.damage ?? []).join('; ').slice(0, 300)})`,
      evidence: [{ ref: `worktree:${stop.path ?? ''}`, why: (stop.damage ?? []).join('; ').slice(0, 500) }],
      options: [{ key: 'restore-and-resume', verb: 'restore the main checkout (git checkout -- <paths>, npm ci), find the link that was followed, then node scripts/machine/worktrees.mjs resume', recommended: true }],
      allowedVerbs: [], openedBy: 'gc-controller', escalateTo: 'owner',
    });
  }

  /**
   * key gc:worktrees: the worktree GC, ALWAYS ACTIVE (the owner's order overrides the controller's shadow mode for
   * worktrees). Every item - removed, unregistered, failed - is recorded in gc_items whatever the mode.
   */
  async function reconcileWorktrees(ctx) {
    const now = ctx.now();
    const every = settings.worktreeGcEveryMs ?? (await deps.worktreeSettings()).gcEveryMs;
    const claim = claimDue(ctx, { controller: NAME, duty: 'worktrees', intervalMs: every, now });
    if (!claim.due) return { skipped: 'not due', nextAt: claim.nextAt ?? null };
    let items = [];
    try { items = await deps.worktrees({ env: ctx.env ?? process.env, repos: (ctx.ledgers ?? []).map((l) => l.repo).filter(Boolean) }); }
    catch (error) {
      finishDuty(ctx, { controller: NAME, duty: 'worktrees', result: 'failed', now: ctx.now() });
      ctx.log('reconciler.gc.worktrees', `worktree gc FAILED: ${String(error?.message ?? error).slice(0, 200)}`, { controller: NAME });
      return { ok: false, error: String(error?.message ?? error).slice(0, 200) };
    }
    const stop = items.find((i) => i.action === 'stopped');
    if (stop) await stoppedDecision(ctx, { reason: stop.reason, path: items.find((i) => i.fatal)?.path ?? null, damage: items.find((i) => i.fatal)?.damage ?? [stop.error] });
    const removed = items.filter((i) => i.ok === true && i.action === 'remove').length;
    const failed = items.filter((i) => i.ok === false);
    if (items.length) {
      ctx.log('reconciler.gc.worktrees', `worktree gc: ${removed} removed, ${items.filter((i) => i.action === 'unregister').length} unregistered, ${items.filter((i) => i.action === 'adopt' && i.ok).length} adopted, ${failed.length} failed`,
        { controller: NAME, items: items.slice(0, 50) });
      try {
        await deps.recordRun({ trigger: 'sweep', items: items.map((i) => ({ collector: 'gc-worktrees', kind: 'worktree', target: String(i.path ?? ''), ownerRef: i.preserved ?? null,
          action: i.ok === false ? 'failed' : i.action === 'adopt' || i.action === 'review' ? 'keep' : 'removed', reason: i.reason ?? null, outcome: i.ok === false ? 'gave-up' : 'done',
          ...(i.ok === false ? { lastError: String(i.error ?? 'failed').slice(0, 300) } : i.action === 'adopt' || i.action === 'review' ? {} : { verifiedGoneAt: ctx.now() }) })) });
      } catch (error) { ctx.log('reconciler.gc.record.error', `gc_items write failed: ${String(error?.message ?? error).slice(0, 200)}`, { controller: NAME }); }
    }
    finishDuty(ctx, { controller: NAME, duty: 'worktrees', result: failed.length ? 'failed' : 'done', now: ctx.now() });
    return { active: true, removed, failed: failed.length, items: items.length };
  }

  async function reconcileHousekeeping(ctx) {
    const now = ctx.now();
    let host = null;
    try { host = await deps.hostResources(); } catch { host = null; }
    const low = Boolean(host?.lowDisk || host?.lowRam);
    // MB-01: the daily cadence is durable (schedules); a low-disk/low-RAM host pulls it in after lowResourceGapMs.
    const claim = claimDue(ctx, { controller: NAME, duty: 'housekeeping', intervalMs: settings.housekeepingEveryMs, now, earlyAfterMs: low ? settings.lowResourceGapMs : null });
    if (!claim.due) return { skipped: 'not due', low, nextAt: claim.nextAt };
    const why = claim.reason === 'first-run' ? 'first run' : claim.reason === 'early' ? `host ${host.lowDisk ? `lowDisk ${Math.round(host.freeDiskGb ?? 0)} GB` : ''}${host.lowDisk && host.lowRam ? ', ' : ''}${host.lowRam ? `lowRam ${Math.round(host.freeRamPct ?? 0)}%` : ''}` : 'daily';
    const r = await ctx.run('node', ['scripts/housekeeping/housekeeping.mjs', '--apply'], { timeoutMs: 1_800_000 });
    finishDuty(ctx, { controller: NAME, duty: 'housekeeping', result: ctx.mode !== 'active' ? 'skipped' : r?.ok === true ? 'done' : 'failed', actionId: r?.actionId ?? null, now: ctx.now() });
    ctx.log('reconciler.gc.housekeeping', `${ctx.mode === 'active' ? 'ran' : 'would run'} housekeeping (${why})`, { controller: NAME, why, ok: r?.ok ?? null, shadow: ctx.mode !== 'active' });
    return { ran: ctx.mode === 'active', why };
  }

  return {
    name: NAME,
    concerns: ['gc.sweep', 'gc.housekeeping'],
    resyncMs: settings.resyncMs,
    concurrency: settings.concurrency,
    routes: ROUTES,
    async list() { return ['gc:sweep', 'gc:housekeeping', 'gc:blob-sweep', 'gc:worktrees']; },
    async reconcile(key, ctx) {
      const k = parseKey(key);
      // The engine runs this controller only when it is not off; ctx.mode decides act (active) or record (shadow).
      if (k.type === 'sweep') return reconcileSweep(ctx);
      if (k.type === 'housekeeping') return reconcileHousekeeping(ctx);
      if (k.type === 'blob-sweep') return reconcileBlobSweep(ctx);
      if (k.type === 'worktrees') return reconcileWorktrees(ctx);
      if (k.type === 'job') return reconcileJob(ctx, k);
      if (k.type === 'workflow') return reconcileWorkflow(ctx, k);
      if (k.type === 'land') return reconcileSupJob(ctx, { jobId: k.id, sup: (await deps.gc()).supervisorView(), gc: await deps.gc() });
      return { skipped: `unknown key ${key}` };
    },
  };
}

export default createGcController();
