// controllers/gc.mjs — the reconciler's GC controller (DESIGN §8.5, §15; lane rc-gc-resource).
//
// It wraps scripts/supervisor/gc.mjs, never re-implements it. Three triggers:
//   1. an event (op-settled, worker-released[-on-report], kernel-stale-cleared, land-succeeded/land-passed,
//      workflow-finished, workflow-archived) → verify just that entity: its terminals (classifyTerminals restricted to
//      the entity's handles), its leases (classifyLeases) and, for a landed [Worker] job, its staging checkout. What
//      the owner step left behind is closed through the same verified close (close-verify.mjs --tree) and recorded as a
//      leftover lesson (lessons.mjs recordLeftover, klass per DESIGN §15.3). A leaked lease has no api path that
//      deletes it: it is reported and a runtime-defect Decision Item goes to the Supervisor (LEASE_LEAK);
//   2. key gc:sweep, every allocation.gc.sweepMs (30 min): runGc({apply: mode === 'active'}) under the host lock
//      `gc` (runGc takes it on a live apply), so a hand-run gc.mjs never overlaps;
//   3. key gc:housekeeping, every housekeepingEveryMs (24 h) and at once when host-resources reads lowDisk/lowRam
//      (at most every lowResourceGapMs): `node scripts/supervisor/housekeeping.mjs --apply` through ctx.run.
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const NAME = 'gc';
const OWNER = 'reconciler/gc';
export const DEFAULTS = Object.freeze({ resyncMs: 60_000, concurrency: 2, housekeepingEveryMs: 86_400_000, lowResourceGapMs: 3_600_000, eventGraceMs: 60_000 });
const LIVE_JOB = new Set(['queued', 'leased', 'running', 'answering', 'effect_unknown']);
const SETTLED = new Set(['succeeded', 'failed', 'cancelled']);
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
  if (k === 'gc:sweep' || k === 'gc:housekeeping') return { type: k.slice(3) };
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
  list: async () => (await import('../../api/orca/terminal-list.mjs')).terminalList({ includeVisualLayouts: true }),
  read: async () => (await import('../../api/orca/terminal-read.mjs')).terminalRead,
  hostResources: async () => (await import('../../lib/host-resources.mjs')).hostResourcesFor({}),
  lesson: async (args) => (await import('../../supervisor/lessons.mjs')).recordLeftover(args),
  removeStaging: async (args) => (await import('../../supervisor/workers.mjs')).removeStaging(args),
  stagingExists: async (jobId) => fs.existsSync((await import('../../supervisor/workers.mjs')).stagingPathOf(jobId)),
  recordSweep: async (report) => {
    const { openSupervisorLedger, supervisorEvent } = await import('../../supervisor/home.mjs');
    const { GC_EVENT_KIND } = await import('../../supervisor/gc.mjs');
    const w = openSupervisorLedger();
    try { w.transaction(() => supervisorEvent(w, { entityType: 'gc', entityId: 'reconciler', kind: GC_EVENT_KIND, payload: { ...report.counts, line: report.line, errors: report.errors.length, by: OWNER } })); }
    finally { try { w.close(); } catch { /* closed */ } }
  },
};

/* ------------------------------------------------------------ the controller */

export function createGcController(overrides = {}) {
  const deps = { ...liveDeps, ...overrides };
  const settings = { ...gcControllerSettings(), ...(overrides.settings ?? {}) };

  const would = (ctx, action, target, data = {}) => ctx.log(WOULD, `${action} ${target}`, { controller: NAME, action, target, ...data });

  /** One verified close of a runtime terminal (the engine's shadow gate records it instead in shadow). */
  async function closeTerminal(ctx, d, { entity }) {
    const r = await ctx.run('node', ['scripts/lib/close-verify.mjs', '--terminal', d.handle, '--owner', OWNER, '--tree', '--log', '--json'], { timeoutMs: 90_000 });
    const closed = ctx.mode === 'active' && r?.ok === true && !r?.shadow;
    ctx.log('reconciler.gc.close', `${closed ? 'closed' : ctx.mode === 'active' ? 'close FAILED' : 'would close'} ${d.klass} ${d.handle} of ${entity}`, { controller: NAME, handle: d.handle, klass: d.klass, reason: d.reason, entity, ok: r?.ok ?? null, shadow: ctx.mode !== 'active' });
    if (closed) await deps.lesson({ klass: d.klass, count: 1, examples: [`${d.handle} ${String(d.title ?? '').slice(0, 50)} (${entity}, closed by the GC controller after its event)`] });
    return { handle: d.handle, klass: d.klass, ok: r?.ok ?? null, shadow: ctx.mode !== 'active' };
  }

  /** The runtime terminals of one entity that are due to close: classifyTerminals over just those handles. */
  async function decideTerminals(ctx, { handles, sup, ledgers, owners = null }) {
    const gc = await deps.gc();
    const listed = await deps.list();
    if (!listed?.ok) throw Object.assign(new Error(`terminal list: ${listed?.error ?? 'Orca did not answer'}`), { retryAfterMs: 60_000 });
    const terminals = (listed.terminals ?? []).filter((t) => (handles ? handles.includes(t.handle) : true));
    if (!terminals.length) return [];
    const read = await deps.read();
    const screenOf = (h) => { try { const r = read({ terminal: h, screen: true }); return r?.ok ? r.screen ?? '' : null; } catch { return null; } };
    const s = gc.gcSettings();
    const decided = gc.classifyTerminals({ terminals, titles: gc.tabTitles(listed.visualLayouts), sup, ledgers, screenOf, now: ctx.now(), minAgeMs: s.minAgeMs, keepTitles: s.keepTitles });
    return decided.filter((d) => d.verdict === 'collect' && (!owners || owners.has(String(d.owner ?? ''))));
  }

  async function leaseDecision(ctx, leaks, { ledgerId, entity }) {
    if (!leaks.length) return 0;
    const summary = `LEASE_LEAK: ${leaks.length} lease(s) of ${entity} still held after it settled/ended (${leaks.slice(0, 3).map((l) => l.resourceKey).join(', ')}); no api path deletes them`;
    ctx.log('reconciler.gc.lease-leak', summary, { controller: NAME, ledgerId, entity, leases: leaks.slice(0, 20) });
    await ctx.openDecision({
      schema: 'starci/decision-item@1', kind: 'runtime-defect', decider: 'supervisor', ledger: ledgerId, workflowId: leaks[0]?.workflowId ?? null,
      idempotencyKey: `lease-leak:${ledgerId}:${entity}`, entity: { type: 'job', id: String(entity) }, summary,
      evidence: leaks.slice(0, 10).map((l) => ({ ref: `lease:${l.resourceKey}`, why: l.why })),
      options: [{ key: 'fix-release-step', verb: 'fix the settle/reconcile step that left the lease (DESIGN §15.3 lease mồ côi)', recommended: true }],
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
    if (updatedAt && ctx.now() - updatedAt < settings.eventGraceMs)
      throw Object.assign(new Error(`job ${jobId} changed ${Math.round((ctx.now() - updatedAt) / 1000)}s ago: its owner step may still be closing`), { retryAfterMs: settings.eventGraceMs });
    const closes = [];
    for (const d of await decideTerminals(ctx, { handles: job.handles, sup: { seat: null, jobs: [] }, ledgers: [view] })) closes.push(await closeTerminal(ctx, d, { entity: `job ${jobId}` }));
    const leaks = SETTLED.has(job.status) ? gc.classifyLeases({ rows: (view.leases ?? []).filter((l) => l.jobId === jobId).map((l) => ({ ...l, ledger: ledgerId })), now: ctx.now(), minAgeMs: 0 }) : [];
    const leases = await leaseDecision(ctx, leaks, { ledgerId, entity: jobId });
    return { entity: `job:${jobId}`, closes, leases };
  }

  async function reconcileSupJob(ctx, { jobId, sup, gc }) {
    const job = sup.jobs.find((j) => j.jobId === jobId);
    if (!job) return { skipped: 'supervisor job unknown' };
    if (!SUP_FINAL.has(job.status)) return { skipped: `supervisor job is ${job.status}` };
    const updatedAt = Number(job.updatedAt ?? 0);
    if (updatedAt && ctx.now() - updatedAt < settings.eventGraceMs)
      throw Object.assign(new Error(`supervisor job ${jobId} changed ${Math.round((ctx.now() - updatedAt) / 1000)}s ago: its land/report may still be closing`), { retryAfterMs: settings.eventGraceMs });
    const closes = [];
    if (job.handle && job.handle !== 'supervisor')
      for (const d of await decideTerminals(ctx, { handles: [job.handle], sup, ledgers: [] })) closes.push(await closeTerminal(ctx, d, { entity: `[Worker] job ${jobId}` }));
    let staging = null;
    if (await deps.stagingExists(jobId)) {
      if (ctx.mode !== 'active') { would(ctx, 'remove-staging', jobId, { klass: 'staging', status: job.status }); staging = { shadow: true }; }
      else {
        const r = await deps.removeStaging({ jobId, landed: job.status === 'succeeded', base: job.base });
        staging = { ok: r?.removed === true, error: r?.error ?? null };
        ctx.log('reconciler.gc.staging', `${staging.ok ? 'removed' : 'could not remove'} staging of ${job.status} job ${jobId}`, { controller: NAME, jobId, ...staging });
        if (staging.ok) await deps.lesson({ klass: 'staging', count: 1, examples: [`sup/${jobId} (removeStaging did not run at report/land)`] });
      }
    }
    const leaks = gc.classifyLeases({ rows: (sup.leases ?? []).filter((l) => l.jobId === jobId).map((l) => ({ ...l, ledger: 'supervisor' })), now: ctx.now(), minAgeMs: 0 });
    const leases = await leaseDecision(ctx, leaks, { ledgerId: 'supervisor', entity: jobId });
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
    for (const d of await decideTerminals(ctx, { handles: null, sup: { seat: null, jobs: [] }, ledgers: [view], owners })) closes.push(await closeTerminal(ctx, d, { entity: `workflow ${workflowId}` }));
    const leaks = wf.ended ? gc.classifyLeases({ rows: (view.leases ?? []).filter((l) => l.workflowId === workflowId).map((l) => ({ ...l, ledger: ledgerId })), now: ctx.now(), minAgeMs: 0 }) : [];
    const leases = await leaseDecision(ctx, leaks, { ledgerId, entity: workflowId });
    return { entity: `workflow:${workflowId}`, ended: wf.ended, closes, leases };
  }

  async function reconcileSweep(ctx) {
    const gc = await deps.gc();
    const sweepMs = settings.sweepMs ?? gc.gcSettings().sweepMs;
    const now = ctx.now();
    // MB-01: the cadence is durable (schedules), so an engine restart never sweeps early.
    const claim = claimDue(ctx.stateDb ?? ctx, { controller: NAME, duty: 'sweep', intervalMs: sweepMs, now });
    if (!claim.due) return { skipped: 'not due', nextAt: claim.nextAt };
    if (ctx.mode !== 'active') {
      // A dry run that writes nothing: no seen-state, no machine-log rows, no lessons; the would-rows are ours.
      const report = await gc.runGc({ apply: false, now, deps: { ...(deps.gcDeps ?? {}), writeState: () => {}, log: () => {}, lesson: () => null } });
      const collect = report.items.filter((i) => i.verdict === 'collect');
      await ctx.run('node', ['scripts/supervisor/gc.mjs', '--apply', '--json'], { timeoutMs: 900_000 });
      ctx.log(WOULD, `sweep: ${report.line}`, { controller: NAME, action: 'gc-sweep', counts: report.counts,
        items: collect.slice(0, 300).map((i) => ({ class: i.class, action: i.action, target: String(i.target), owner: i.owner ?? null })), truncated: collect.length > 300 });
      await leaseDecisionsOf(ctx, report);
      finishDuty(ctx.stateDb ?? ctx, { controller: NAME, duty: 'sweep', result: 'skipped', now: ctx.now() });
      return { shadow: true, wouldCollect: collect.length, counts: report.counts };
    }
    const report = await gc.runGc({ apply: true, now, ...(deps.gcDeps ? { deps: { ...deps.gcDeps, holder: OWNER } } : { deps: { holder: OWNER } }) });
    if (report.busy) {
      claimDue(ctx.stateDb ?? ctx, { controller: NAME, duty: 'sweep', intervalMs: 120_000, now, force: true }); // retry in 2 min, not a full interval
      finishDuty(ctx.stateDb ?? ctx, { controller: NAME, duty: 'sweep', result: 'skipped', now: ctx.now() });
      throw Object.assign(new Error('gc-busy: another GC apply holds the host lock'), { retryAfterMs: 120_000 });
    }
    try { await deps.recordSweep(report); } catch { /* the sweep happened; the event is the digest's */ }
    ctx.log('reconciler.gc.sweep', report.line, { controller: NAME, counts: report.counts, errors: report.errors.slice(0, 5) });
    await leaseDecisionsOf(ctx, report);
    finishDuty(ctx.stateDb ?? ctx, { controller: NAME, duty: 'sweep', result: report.ok === false ? 'failed' : 'done', now: ctx.now() });
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

  async function reconcileHousekeeping(ctx) {
    const now = ctx.now();
    let host = null;
    try { host = await deps.hostResources(); } catch { host = null; }
    const low = Boolean(host?.lowDisk || host?.lowRam);
    // MB-01: the daily cadence is durable (schedules); a low-disk/low-RAM host pulls it in after lowResourceGapMs.
    const claim = claimDue(ctx.stateDb ?? ctx, { controller: NAME, duty: 'housekeeping', intervalMs: settings.housekeepingEveryMs, now, earlyAfterMs: low ? settings.lowResourceGapMs : null });
    if (!claim.due) return { skipped: 'not due', low, nextAt: claim.nextAt };
    const why = claim.reason === 'first-run' ? 'first run' : claim.reason === 'early' ? `host ${host.lowDisk ? `lowDisk ${Math.round(host.freeDiskGb ?? 0)} GB` : ''}${host.lowDisk && host.lowRam ? ', ' : ''}${host.lowRam ? `lowRam ${Math.round(host.freeRamPct ?? 0)}%` : ''}` : 'daily';
    const r = await ctx.run('node', ['scripts/supervisor/housekeeping.mjs', '--apply'], { timeoutMs: 1_800_000 });
    finishDuty(ctx.stateDb ?? ctx, { controller: NAME, duty: 'housekeeping', result: ctx.mode !== 'active' ? 'skipped' : r?.ok === true ? 'done' : 'failed', actionId: r?.actionId ?? null, now: ctx.now() });
    ctx.log('reconciler.gc.housekeeping', `${ctx.mode === 'active' ? 'ran' : 'would run'} housekeeping (${why})`, { controller: NAME, why, ok: r?.ok ?? null, shadow: ctx.mode !== 'active' });
    return { ran: ctx.mode === 'active', why };
  }

  return {
    name: NAME,
    concerns: ['gc.sweep', 'gc.housekeeping'],
    resyncMs: settings.resyncMs,
    concurrency: settings.concurrency,
    routes: ROUTES,
    async list() { return ['gc:sweep', 'gc:housekeeping']; },
    async reconcile(key, ctx) {
      const k = parseKey(key);
      // The engine runs this controller only when it is not off; ctx.mode decides act (active) or record (shadow).
      if (k.type === 'sweep') return reconcileSweep(ctx);
      if (k.type === 'housekeeping') return reconcileHousekeeping(ctx);
      if (k.type === 'job') return reconcileJob(ctx, k);
      if (k.type === 'workflow') return reconcileWorkflow(ctx, k);
      if (k.type === 'land') return reconcileSupJob(ctx, { jobId: k.id, sup: (await deps.gc()).supervisorView(), gc: await deps.gc() });
      return { skipped: `unknown key ${key}` };
    },
  };
}

export default createGcController();
