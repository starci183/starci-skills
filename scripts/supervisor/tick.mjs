#!/usr/bin/env node
// tick.mjs — ONE supervisor tick (modules/supervisor/supervise.yaml scheduledTick). The Windows task
// StarCi-Supervisor-Every30m runs it every allocation.supervisorTick.everyMs with no chat; the Supervisor (chat or
// [Supervisor] kernel) runs it too when it wants a fresh digest. A host lock (supervisor-tick) keeps two ticks
// from overlapping: the second answers skipped tick-running.
//
//   node scripts/supervisor/tick.mjs [--repo <path>]... [--no-push] [--scheduled] [--json]
//   node scripts/supervisor/tick.mjs --task-spec      the scheduled task's name, interval and command (JSON)
//   node scripts/supervisor/tick.mjs --samples [<n>]  the newest n bottleneck samples, one JSON per line
//
// Duties, in order: modules/supervisor/supervise.yaml scheduledTick.duties (host, orca, statusApp, digest, workflows,
// sample, alerts), each a decision in scripts/supervisor/host-health.mjs or tick-duties.mjs. The digest is the loop
// tick: per product ledger the poll digest (poll.mjs cycle, read-only), the OWED items clustered by root cause
// (cluster.mjs) with each cluster's open/fixed-by state and owning [Worker] job, the worker board and land queue, the
// push of main of the runtime and each product repository (push-mains.mjs: secret scan first, hooks on), and in
// exclusive land-gate mode each first-parent commit on .claude main no gate land produced (`DIRECT-COMMIT <sha>
// <subject>`); it records one `supervisor-tick` event that /status reads for the OWED trend.
// One `supervisor-tick-duties` event records what the duties saw and did. The tick fixes no code.
import '../lib/hide-child-windows.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { cycle } from './poll.mjs';
import { clusterOwed, clusterLine } from './cluster.mjs';
import { workerBoard, jobsOf, OPEN_STATUSES, machineLoad, memoryProbe } from './workers.mjs';
import { landStatus } from './land.mjs';
import { directCommits, describeDirect } from './direct-commits.mjs';
import { pushMains, describePush } from './push-mains.mjs';
import { heartbeatSupervisor, getSupervisor, readInbox, appendInbox } from '../connectors/telegram-bridge.mjs';
import { claimManager } from '../connectors/lib.mjs';
import { lowerOwnPriority } from '../lib/low-priority.mjs';
import { clipLine } from '../lib/clip.mjs';
import { nameWithId, workflowNameOf } from '../lib/display-names.mjs';
import { SKILL_ROOT, SUPERVISOR_ID, SUPERVISOR_WF, openSupervisorLedger, supervisorEvent, supervisorSettings, productRepos, supervisorLog, withSupervisorRead } from './home.mjs';
import { listProcesses, hostVerdict, stopTree, groupByOwner } from './host-health.mjs';
import { owedActions, withSla, actedOf, actionLine, OWED_ACTIONS_KIND } from './actions.mjs';
import { learnTick, readLearning, matchLessons, signatureOf } from './lessons.mjs';
import { supLogRows } from './sup-log.mjs';
import { OWNER_ONLY } from './owed.mjs';
import { fleetCensus, footprintSample, hostThrottle, throttleLine, throttleSummary, OP_RAM_FOOTPRINT } from '../lib/ram-throttle.mjs';
import {
  TICK_TASK, TICK_LOCK, SAMPLE_KIND, tickSettings, tickEveryMinutes, orcaHealth, statusAppHealth, deadKernels, workflowFrontiers,
  noProgress, persisting, readTickState, writeTickState, dueAlerts, sendAlerts, recordSample,
} from './tick-duties.mjs';

const selfFile = fileURLToPath(import.meta.url);

/** The poll digest of one ledger, read-only: {repo, text, owed, stalls}. Never throws. */
export async function digestOf(repo, { cycleFn = cycle } = {}) {
  let handle = null;
  try {
    handle = inspectLedger({ file: ledgerFileFor(repo) });
    const lastReportId = handle.db.prepare('SELECT COALESCE(MAX(report_id),0) m FROM reports').get().m;
    const state = { lastReportId, lastArtifacts: Date.now() - 10 * 60_000, first: true };
    const out = await cycleFn(handle.db, { repo, state });
    return { repo, text: out.text, owed: out.owed ?? [], stalls: out.stalls ?? [], workflows: out.workflows?.length ?? 0 };
  } catch (error) {
    return { repo, text: `===== ${path.basename(repo)}: digest failed: ${String(error?.message ?? error).slice(0, 200)}`, owed: [], stalls: [], error: true };
  } finally { try { handle?.close(); } catch { /* closed */ } }
}

/**
 * The digest half of the tick. Seams: `digest`, `push`, `env`, `settings`, `directCommitsFn`. `heartbeat`: the tick
 * runs inside the Supervisor's own seat, so it heartbeats channel 'main' (the scheduled task passes false).
 * Returns {digests, clusters, owed, board, land, directs, pushes, lines}.
 */
export async function runTick({ repos = null, push = true, heartbeat = true, env = process.env, digest = digestOf, pushFn = pushMains, now = Date.now,
  settings = supervisorSettings(), directCommitsFn = (e) => directCommits({ env: e }) } = {}) {
  const list = repos ?? productRepos(settings);
  const digests = [];
  for (const repo of list) digests.push(await digest(repo));
  const owed = digests.flatMap((d) => d.owed.map((i) => ({ ...i, repo: d.repo })));
  const clusters = clusterOwed(owed);
  const ledger = openSupervisorLedger({ env });
  let board, openJobs;
  try {
    board = workerBoard(ledger.db, { now: now() });
    openJobs = jobsOf(ledger.db, OPEN_STATUSES);
  } finally { ledger.close(); }
  const owner = new Map(openJobs.map((j) => [j.payload.cluster, j.job_id]));
  const land = landStatus({ env });
  const directs = settings.landGate?.mode === 'exclusive' ? directCommitsFn(env) : [];
  const pushes = push ? pushFn({ env }) : [];
  const unread = readInbox(SUPERVISOR_ID, env).filter((m) => !m.read).length;
  const w = openSupervisorLedger({ env });
  try {
    w.transaction(() => supervisorEvent(w, { entityType: 'tick', kind: 'supervisor-tick', now: now(), payload: {
      owed: owed.length, clusters: clusters.length, open: clusters.filter((c) => !c.fixedBy).length, repos: list,
      directCommits: directs.map((c) => c.sha),
      pushes: pushes.map((p) => ({ repo: p.repo, pushed: p.pushed, skipped: p.skipped ?? null, refused: p.refused ?? null, error: p.error ? String(p.error).slice(0, 120) : null })),
      workers: board.active.length, landQueue: board.reported.length } }));
  } finally { w.close(); }
  if (heartbeat) {
    try { const sup = getSupervisor(SUPERVISOR_ID, env); if (sup && (!sup.terminal || sup.terminal === env.ORCA_TERMINAL_HANDLE)) heartbeatSupervisor(SUPERVISOR_ID, { env }); } catch { /* best effort */ }
  }

  const lines = [`===== [Supervisor] tick ${new Date(now()).toISOString()} =====`];
  for (const d of digests) lines.push(d.text);
  lines.push(`----- OWED ${owed.length} item(s) in ${clusters.length} cluster(s) -----`);
  for (const c of clusters) {
    lines.push(`${clusterLine(c)}${owner.has(c.id) ? ` [job ${owner.get(c.id)}]` : ''}`);
    for (const i of c.items.slice(0, 6)) lines.push(`    ${i.line ?? `${i.workflowId} ${i.incidentId ?? i.key}`}`);
    if (c.items.length > 6) lines.push(`    ... ${c.items.length - 6} more`);
    if (c.items[0]?.action) lines.push(`    action: ${c.items[0].action}`);
  }
  lines.push(`----- workers: ${board.active.length} active, ${board.queued.length} queued, land queue ${board.reported.length}${land.busy ? ` (landing ${land.current?.jobId ?? 'a commit'})` : ''} -----`);
  for (const j of [...board.active, ...board.queued, ...board.reported]) lines.push(`  ${j.jobId} [${j.status}] ${j.cluster} ${j.agent ?? '-'} ${j.ageMin}m`);
  for (const c of directs) lines.push(describeDirect(c));
  if (push) { lines.push('----- push main -----'); for (const p of pushes) lines.push(`  ${describePush(p)}`); }
  lines.push(`----- inbox: ${unread} unread -----`);
  lines.push('Close every OWED cluster THIS tick (supervise.yaml step owed): verify fixed-by and notify, or one worker job per open cluster, or fix/rule it yourself. Then report and yield.');
  return { digests, clusters, owed, board, land, directs, pushes, unread, lines };
}

/** The typed log rows of one tick (the supervisor ledger's logs, sup-log.mjs). Pure. */
export function tickLogRows(out, { at, breaches = [], pushes = [] }) {
  const rows = [];
  const byClass = {};
  for (const i of out.actions ?? []) byClass[i.class] = (byClass[i.class] ?? 0) + 1;
  rows.push({ kind: 'narration', at, level: out.ok ? 'info' : 'warn',
    msg: `tick ${out.ok ? 'ok' : 'NOT OK'}: ${out.flows?.workflows?.length ?? 0} workflow(s), ${(out.actions ?? []).length} owed action(s), ${breaches.length} past the SLA, ${out.alerts?.length ?? 0} alert(s)`,
    data: { markdown: [`Workflows: ${(out.flows?.workflows ?? []).map((w) => `${w.workflowId} ${w.state ?? w.error ?? '?'}`).join('; ') || 'none'}`,
      `Owed actions by class: ${Object.entries(byClass).map(([c, n]) => `${c} ${n}`).join(', ') || 'none'}`,
      out.learning ? `Self-learning: ${out.learning.hypotheses?.length ?? 0} new hypothesis(es), ${out.learning.verdicts?.length ?? 0} verdict(s), ${out.learning.revertDue?.length ?? 0} revert(s) due` : null].filter(Boolean).join('\n') } });
  if (out.host) rows.push({ kind: 'check.result', at, msg: `host node=${out.host.counts.node} git=${out.host.counts.git}${out.host.over ? ' OVER' : ''}`, data: { name: 'host-processes', pass: !out.host.over } });
  if (out.orca) rows.push({ kind: 'check.result', at, msg: `orca ${out.orca.verdict}`, data: { name: 'orca', pass: ['healthy', 'responding-error'].includes(out.orca.verdict) } });
  if (out.statusApp) rows.push({ kind: 'check.result', at, msg: `status UI ${out.statusApp.up ? 'up' : 'down'}`, data: { name: 'status-ui', pass: Boolean(out.statusApp.up || out.statusApp.upAfter) } });
  for (const p of pushes) rows.push({ kind: 'cmd.run', at, msg: `push main ${String(p.repo ?? '').split(/[\\/]/).pop()}: ${p.pushed ? 'pushed' : p.skipped ?? p.refused ?? p.deferred ?? p.error ?? 'not pushed'}`,
    data: { cmd: `git push origin main (${String(p.repo ?? '').replace(/\\/g, '/')})`, exit: p.pushed || p.skipped || p.deferred ? 0 : 1, ...(p.refused || p.error ? { output: String(p.refused ?? p.error).slice(0, 400) } : {}) }, refs: p.repo ? [`repo:${String(p.repo).replace(/\\/g, '/')}`] : [] });
  for (const i of breaches) rows.push({ kind: 'warning', at, msg: `SLA breach [${i.class}] ${i.key} age ${i.ageMin}m`, data: { code: 'SLA-BREACH', message: String(i.evidence ?? ''), hint: String(i.do ?? '') },
    refs: [...String(i.workflowId ?? '').split(',').filter(Boolean).map((w) => `workflow:${w}`), `item:${i.key}`] });
  for (const a of out.alerts ?? []) rows.push({ kind: 'warning', at, msg: `alert ${a.key}${a.sent ? ' (sent)' : ''}`, data: { code: String(a.key).split('|')[0].toUpperCase(), message: String(a.text ?? '') } });
  for (const e of out.errors ?? []) rows.push({ kind: 'error', at, msg: `tick step ${e.step} failed`, data: { code: `tick-${e.step}`, message: String(e.error ?? '') } });
  return rows;
}

const describeHost = (h) => `host node=${h.counts.node} git=${h.counts.git} all=${h.counts.all}${h.over ? ' OVER' : ''}`
  + `${h.stopped?.length ? `; stopped ${h.stopped.map((r) => `${r.kind} pid ${r.rootPid} (${r.size})${r.ok ? '' : ' FAILED'}`).join(', ')}` : ''}`
  + `${h.runaways?.some((r) => !r.safe) ? `; unsafe runaway ${h.runaways.filter((r) => !r.safe).map((r) => r.rootPid).join(', ')}` : ''}`;

/**
 * The whole tick: the duties, then the digest. Seams (`deps`): listProcesses, stopTree, orca (orcaHealth deps),
 * statusApp (statusAppHealth deps), frontiers (workflowFrontiers deps), deadKernels, load, runTick, sendAlerts.
 * Returns {ok, at, host, orca, statusApp, flows, sample, alerts, errors, tick, lines}.
 */
export async function runSupervisorTick({ repos = null, push = true, heartbeat = true, env = process.env, now = Date.now, settings = null, deps = {} } = {}) {
  const t = settings ?? tickSettings();
  const out = { ok: true, at: now(), host: null, orca: null, statusApp: null, flows: null, actions: [], sample: null, alerts: [], errors: [], tick: null, lines: [] };
  const step = async (name, fn) => {
    try { return await fn(); } catch (error) { out.ok = false; out.errors.push({ step: name, error: clipLine(error?.stack ?? error, 300) }); return null; }
  };
  const alerts = [];

  const procs = await step('host', () => { const p = (deps.listProcesses ?? listProcesses)(); if (!p) throw Error('process table unreadable'); return p; });
  if (procs) {
    const h = hostVerdict(procs, { ...t.host, now: now() });
    h.stopped = h.stop.map((r) => ({ ...r, ...(deps.stopTree ?? stopTree)(r.rootPid) }));
    out.host = h;
    for (const r of h.stopped) alerts.push({ key: `runaway|${r.kind}|${r.rootPid}`, text: `RUNAWAY ${r.kind} ${r.ok ? 'stopped' : 'NOT stopped'}: root pid ${r.rootPid}, ${r.size} process(es), shim nesting ${r.nesting}${r.ok ? '' : ` (${r.output})`}: ${r.cmd}. Something re-created a guard-shim chain; find its caller.` });
    if (h.alert) alerts.push({ key: 'host-processes', text: `HOST node=${h.counts.node} git=${h.counts.git} (limits ${t.host.maxNode}/${t.host.maxGit}); nothing safe to stop${h.runaways.some((r) => !r.safe) ? ` (runaway chain(s) ${h.runaways.filter((r) => !r.safe).map((r) => r.rootPid).join(', ')} hold non-shim processes)` : ''}. Top parents: ${h.topParents.map((p) => `${p.count}x ${p.cmd}`).join(' | ')}` });
  }

  const orca = await step('orca', () => orcaHealth({ orca: t.orca, ...(deps.orca ?? {}) }));
  out.orca = orca;
  if (orca?.verdict === 'restart') {
    const back = orca.ready?.ready === true;
    alerts.push({ key: back && orca.restartAll?.ok ? 'orca-restarted' : 'orca-restart-failed',
      text: `ORCA did not answer ${orca.results.length} probes (${orca.results.join(',')}); app restart ${orca.restarted?.ok ? `closed ${orca.restarted.closed ?? '?'}, forced ${orca.restarted.forced ?? '?'}` : `FAILED ${orca.restarted?.error ?? ''}`}; ${back ? `answering again; restart-all ${orca.restartAll?.ok ? 'ok' : `NOT OK: ${orca.restartAll?.summary ?? ''}`}` : 'still not answering'}.` });
  }
  const orcaUp = orca != null && (['healthy', 'responding-error'].includes(orca.verdict) || orca.ready?.ready === true);

  const statusApp = await step('statusApp', () => statusAppHealth({ statusApp: t.statusApp, ...(deps.statusApp ?? {}) }));
  out.statusApp = statusApp;
  if (statusApp && !statusApp.up && !statusApp.upAfter) alerts.push({ key: 'status-app', text: `STATUS-UI 127.0.0.1:${t.statusApp.port} does not answer; task "${t.statusApp.task}" ${statusApp.restarted ? 'was run again and still does not answer' : `could not be run: ${statusApp.error ?? ''}`}.` });

  const list = repos ?? productRepos();
  if (orcaUp) out.tick = await step('digest', () => (deps.runTick ?? runTick)({ repos: list, push, heartbeat, env, now }));

  const frontiers = await step('workflows', () => workflowFrontiers({ repos: list, ...(deps.frontiers ?? {}) }));
  const running = (frontiers?.workflows ?? []).map(({ workflowId, repo }) => ({ workflowId, repo }));
  const dead = await step('deadKernels', () => (deps.deadKernels ?? deadKernels)({ workflows: running, deadKernelMs: t.deadKernelMs, now: now() })) ?? [];
  const stalled = noProgress((out.tick?.digests ?? []).flatMap((d) => d.stalls ?? []), t);
  out.flows = { workflows: frontiers?.workflows ?? [], waits: frontiers?.waits ?? {}, orphaned: frontiers?.orphaned ?? [], deadKernels: dead, noProgress: stalled.map((f) => f.line) };
  // An alert names the workflow by its display name with the id after it (scripts/lib/display-names.mjs).
  const repoOf = new Map(running.map((w) => [w.workflowId, w.repo]));
  const names = new Map();
  const wfName = (id) => {
    if (!names.has(id)) {
      let name = null;
      try { const h = inspectLedger({ file: ledgerFileFor(repoOf.get(id)) }); try { name = workflowNameOf(h.db, id); } finally { h.close(); } } catch { name = null; }
      names.set(id, nameWithId(name, id));
    }
    return names.get(id);
  };
  for (const k of dead) alerts.push({ key: `dead-kernel|${k.workflowId}`, text: `DEAD-KERNEL ${wfName(k.workflowId)}: its watchdog read ${k.action} on the last ${k.count} tick(s) (~${Math.round(k.failingMs / 60_000)}m).` });
  for (const f of stalled) alerts.push({ key: `no-progress|${f.workflowId}`, text: `NO-PROGRESS ${clipLine(f.line, 300)}` });
  const ledger = openSupervisorLedger({ env });
  let state;
  try { state = readTickState(ledger.db); } finally { ledger.close(); }
  const orphanSeen = persisting(out.flows.orphaned.map((o) => o.workflowId), state.seen, { now: now(), minMs: t.orphanedFrontierMs });
  for (const o of out.flows.orphaned.filter((x) => orphanSeen.persisting.includes(x.workflowId)))
    alerts.push({ key: `orphaned-frontier|${o.workflowId}`, text: `ORPHANED-FRONTIER ${wfName(o.workflowId)} for ${Math.round((now() - orphanSeen.seen[o.workflowId]) / 60_000)}m: nothing open and no next step named${o.reason ? ` (${o.reason})` : ''}` });

  // The owed actions (supervise.yaml mission; scripts/supervisor/actions.mjs): every stuck item with its action and SLA.
  const stallsAll = (out.tick?.digests ?? []).flatMap((d) => d.stalls ?? []);
  const owedAct = await step('actions', () => {
    const base = owedActions({ clusters: out.tick?.clusters ?? [], stalls: stallsAll, pushes: out.tick?.pushes ?? [], stuck: out.flows.stuck ?? [],
      flows: { ...out.flows, orphaned: out.flows.orphaned.filter((x) => orphanSeen.persisting.includes(x.workflowId)) } });
    const acted = withSupervisorRead((db) => actedOf(db, { since: now() - 7 * 24 * 3_600_000 }), { byKey: {}, byWorkflow: {} }, { env });
    const sla = (items) => withSla(items, { seen: state.owedSeen, acted, now: now(), slaMs: t.actionSlaMs });
    // The self-learning pass (scripts/supervisor/lessons.mjs, supervise.yaml selfLearning): repeated signatures open
    // hypotheses, landed experiments are measured, a revert that is due becomes an owed action.
    let learning = null;
    try { learning = (deps.learnTick ?? learnTick)({ items: sla(base).items, env, now: now() }); }
    catch (error) { out.errors.push({ step: 'learning', error: clipLine(error?.stack ?? error, 300) }); }
    out.learning = learning;
    const all = sla([...base, ...owedActions({ revertDue: learning?.revertDue ?? [] })]);
    const lessons = readLearning({ env }).lessons;
    for (const i of all.items) i.lessons = matchLessons(lessons, { signature: signatureOf(i), limit: 2 }).map((l) => `[${l.source}] ${clipLine(l.text, 160)}`);
    return all;
  });
  out.actions = owedAct?.items ?? [];
  const breaches = out.actions.filter((i) => i.breach);
  const slaPlan = dueAlerts(breaches.map((i) => ({ key: `sla|${i.key}`, text: actionLine(i) })), state.slaSent ?? {}, { now: now(), repeatMs: t.actionSlaMs });
  if (slaPlan.due.length) {
    // Into the Supervisor's own inbox only (its [inbox] wake), never Telegram: the owner gets the digest, not the backlog.
    await step('sla', () => appendInbox(SUPERVISOR_ID, { chatId: null, messageId: null, from: 'supervisor-tick',
      text: `OWED-ACTIONS ${slaPlan.due.length} item(s) past the ${Math.round(t.actionSlaMs / 60_000)}m SLA with no supervisor action (supervise.yaml mission): act on each and record it (actions.mjs record / notify.mjs --item).\n${slaPlan.due.map((a) => a.text).join('\n')}` }, { env }));
  }

  out.sample = await step('sample', () => {
    const load = (deps.load ?? (() => ({ ...machineLoad({ sampleMs: 1000 }), ...memoryProbe() })))();
    return {
      cpuBusy: Math.round(load.cpuBusy * 1000) / 1000, freeRamPct: Math.round(load.freeMem * 1000) / 10,
      totalRamGb: Math.round((load.totalRamBytes ?? 0) / 1e8) / 10, procs: out.host?.counts ?? null,
      owners: procs ? groupByOwner(procs) : [], waits: out.flows.waits,
      workflows: out.flows.workflows.map((w) => (w.error ? { workflowId: w.workflowId, error: w.error } : { workflowId: w.workflowId, state: w.state, causes: w.causes })),
    };
  });

  // The RAM-aware dispatch cap (scripts/lib/ram-throttle.mjs): the op-ram-footprint sample its per-op estimates
  // learn from (the agent process trees' RAM beside the fleet's running ops) and the effective cap and why.
  const census = await step('census', () => (deps.census ?? (() => fleetCensus({ env })))());
  out.footprint = procs && census ? footprintSample({ owners: groupByOwner(procs, { limit: Infinity }), ops: census.ops, kernels: census.kernels, freeRamPct: out.sample?.freeRamPct ?? null }) : null;
  out.ramThrottle = await step('ramThrottle', () => (deps.throttle ?? ((c) => hostThrottle({ env, ...(c ? { census: () => c } : {}) })))(census));
  for (const e of out.errors) alerts.push({ key: `tick-error|${e.step}`, text: `TICK-ERROR ${e.step}: ${e.error}` });
  const plan = dueAlerts(alerts, state.alerts, { now: now(), repeatMs: t.alertRepeatMs });
  const due = plan.due;
  const s = openSupervisorLedger({ env });
  try {
    s.transaction(() => {
      if (out.sample) recordSample(s, out.sample, { now: now() });
      if (out.footprint) supervisorEvent(s, { entityType: 'host', entityId: 'ram', kind: OP_RAM_FOOTPRINT, now: now(), payload: out.footprint });
      writeTickState(s, { alerts: plan.sent, seen: orphanSeen.seen, owedSeen: owedAct?.seen ?? state.owedSeen, slaSent: slaPlan.sent }, { now: now() });
      supervisorEvent(s, { entityType: 'tick', kind: OWED_ACTIONS_KIND, now: now(), payload: {
        items: out.actions.map((i) => ({ key: i.key, class: i.class, workflowId: i.workflowId, repo: i.repo, subject: i.subject ?? null, incidents: i.incidents ?? null,
          fixedBy: i.fixedBy ?? null, peer: i.peer ?? null, evidence: i.evidence, do: i.do, firstSeenAt: i.firstSeenAt, ageMin: i.ageMin, actedAt: i.actedAt, breach: i.breach, lessons: i.lessons ?? [] })),
        workflows: out.flows.workflows.map((w) => ({ workflowId: w.workflowId, state: w.state ?? null, ready: w.ready ?? 0, causes: w.causes ?? {}, error: w.error ?? null })),
        ownerWaits: stallsAll.filter((f) => (f.type === 'STALLED' && f.credentialOnly) || (f.type === 'GATE' && !f.young && OWNER_ONLY.test(f.text ?? '')))
          .map((f) => f.line) } });
    });
  } finally { s.close(); }
  out.alerts = alerts.map((a) => ({ ...a, sent: due.includes(a) }));
  out.alerted = await (deps.sendAlerts ?? sendAlerts)(due, { env, now: now() });
  const w = openSupervisorLedger({ env });
  try {
    w.transaction(() => supervisorEvent(w, { entityType: 'tick', kind: 'supervisor-tick-duties', now: now(), payload: {
      ok: out.ok, host: out.host ? { counts: out.host.counts, over: out.host.over, stopped: out.host.stopped.map((r) => ({ kind: r.kind, rootPid: r.rootPid, size: r.size, ok: r.ok })) } : null,
      orca: orca ? { verdict: orca.verdict, results: orca.results, restarted: orca.restarted?.ok ?? null, ready: orca.ready?.ready ?? null, restartAll: orca.restartAll?.ok ?? null } : null,
      ramThrottle: out.ramThrottle ? (({ line, ...rest }) => rest)(throttleSummary(out.ramThrottle)) : null,
      statusApp, digest: out.tick ? 'ran' : 'skipped', deadKernels: dead.map((k) => k.workflowId), orphaned: out.flows.orphaned.map((o) => o.workflowId),
      noProgress: stalled.map((f) => f.workflowId), alerts: out.alerts.map((a) => ({ key: a.key, sent: a.sent })), errors: out.errors } }));
  } finally { w.close(); }

  // The machine log (sup-log.mjs): what this tick saw and did, as typed rows on the supervisor ledger.
  (deps.supLogRows ?? supLogRows)(tickLogRows(out, { at: now(), breaches, pushes: out.tick?.pushes ?? [] }), { env });

  out.lines = [
    `===== supervisor tick duties ${new Date(out.at).toISOString()} ${out.ok ? 'ok' : 'NOT OK'} =====`,
    out.host ? describeHost(out.host) : 'host: unread',
    `orca ${orca ? `${orca.verdict} (${orca.results.join(',')})${orca.verdict === 'restart' ? ` restarted=${orca.restarted?.ok} ready=${orca.ready?.ready} restart-all=${orca.restartAll?.ok ?? '-'}` : ''}` : 'unread'}`,
    `status UI ${statusApp ? (statusApp.up ? 'up' : statusApp.upAfter ? 'restarted, up' : 'DOWN') : 'unread'}`,
    `workflows ${out.flows.workflows.length} running; waits ${Object.entries(out.flows.waits).map(([c, n]) => `${c} ${n}`).join(', ') || 'none'}; dead kernels ${dead.length}; orphaned ${out.flows.orphaned.length}; no progress ${stalled.length}`,
    out.sample ? `sample cpu ${Math.round(out.sample.cpuBusy * 100)}% free RAM ${out.sample.freeRamPct}%; top ${out.sample.owners.slice(0, 4).map((g) => `${g.key} ${g.cpuPct}%/${g.ramMb}MB`).join(', ')}` : 'sample: none',
    out.ramThrottle ? throttleLine(out.ramThrottle) : 'ram-throttle: unread',
    `alerts ${out.alerts.length} (${due.length} sent)${out.alerts.map((a) => `\n  ${a.sent ? '>' : '='} ${a.text}`).join('')}`,
    `----- OWED ACTIONS ${out.actions.length} (${breaches.length} past the ${Math.round(t.actionSlaMs / 60_000)}m SLA): act on each and record it (supervise.yaml mission) -----`,
    ...out.actions.map(actionLine),
    ...out.errors.map((e) => `ERROR ${e.step}: ${e.error}`),
    ...(out.tick ? out.tick.lines : ['digest skipped: Orca does not answer']),
  ];
  return out;
}

/**
 * Run `run()` holding the host lock supervisor-tick: {ran: true, value} or, while another tick holds it,
 * {ran: false, skipped: 'tick-running', holder} without calling `run`. The lock is released however `run` ends.
 */
export async function runLocked(run, { env = process.env, claim = (e) => claimManager(TICK_LOCK, { env: e }) } = {}) {
  const lock = claim(env);
  if (!lock.ok) return { ran: false, skipped: 'tick-running', holder: lock.holder ?? null };
  try { return { ran: true, value: await run() }; } finally { lock.release(); }
}

/** The scheduled task this tick runs under: {name, everyMinutes, node, script, args, workdir}. */
export const taskSpec = () => ({ name: TICK_TASK, everyMinutes: tickEveryMinutes(), node: process.execPath, script: selfFile, args: ['--scheduled', '--json'], workdir: SKILL_ROOT });

/** The newest `limit` bottleneck samples, oldest first: [{at, ...sample}]. */
export const recentSamples = (limit = 48, { env = process.env } = {}) => withSupervisorRead((db) => db.prepare(
  'SELECT created_at, payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT ?').all(SUPERVISOR_WF, SAMPLE_KIND, limit)
  .reverse().map((r) => ({ at: new Date(r.created_at).toISOString(), ...JSON.parse(r.payload_json) })), [], { env });

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  if (argv.includes('--task-spec')) { console.log(JSON.stringify(taskSpec())); process.exit(0); }
  if (argv.includes('--samples')) {
    const n = Number(argv[argv.indexOf('--samples') + 1]);
    for (const s of recentSamples(Number.isInteger(n) && n > 0 ? n : 48)) console.log(JSON.stringify(s));
    process.exit(0);
  }
  lowerOwnPriority();
  const asJson = argv.includes('--json');
  let code = 1;
  try {
    const locked = await runLocked(async () => {
      const repos = argv.flatMap((a, i) => (a === '--repo' && argv[i + 1] ? [path.resolve(argv[i + 1])] : []));
      const r = await runSupervisorTick({ repos: repos.length ? repos : null, push: !argv.includes('--no-push'), heartbeat: !argv.includes('--scheduled') });
      supervisorLog('tick', `${r.ok ? 'ok' : 'NOT OK'} ${r.host ? `node=${r.host.counts.node} git=${r.host.counts.git}` : 'host=?'} orca=${r.orca?.verdict ?? '?'} ui=${r.statusApp?.up ? 'up' : 'down'} alerts=${r.alerts.length} owed=${r.tick?.owed.length ?? '-'} pushes=${(r.tick?.pushes ?? []).map((p) => (p.pushed ? 'ok' : p.skipped ? 'skip' : 'X')).join('')}`);
      if (asJson) {
        const tick = r.tick ? { owed: r.tick.owed.length, clusters: r.tick.clusters.map(({ items, ...c }) => ({ ...c, items: items.map((i) => i.line) })), board: r.tick.board, land: r.tick.land, directs: r.tick.directs, pushes: r.tick.pushes, unread: r.tick.unread } : null;
        console.log(JSON.stringify({ ok: r.ok, at: r.at, host: r.host && { counts: r.host.counts, over: r.host.over, runaways: r.host.runaways, stopped: r.host.stopped, topParents: r.host.topParents },
          orca: r.orca, statusApp: r.statusApp, flows: r.flows, actions: r.actions, sample: r.sample, ramThrottle: throttleSummary(r.ramThrottle), footprint: r.footprint, alerts: r.alerts, alerted: r.alerted, errors: r.errors, tick }));
      } else console.log(r.lines.join('\n'));
      return r.ok ? 0 : 1;
    });
    if (locked.ran) code = locked.value;
    else {
      code = 0;
      console.log(asJson ? JSON.stringify({ ok: true, skipped: locked.skipped, holder: locked.holder }) : `[supervisor tick] skipped: another tick is running (pid ${locked.holder?.pid ?? '?'})`);
    }
  } catch (error) {
    supervisorLog('tick', `CRASHED ${clipLine(error?.stack ?? error, 400)}`);
    console.error(error?.stack ?? error);
  }
  process.exit(code);
}
