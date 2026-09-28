#!/usr/bin/env node
// progress-watch.mjs — the Supervisor's OUTCOME duty (owner 2026-09-28: "trước đây supervisor không tư duy dc à?"; then
// "sao workflows không tự điều phối dc mà đợi supervisor"). Each Kernel owns its own progress (api status progress + rca,
// modules/kernel/driver-loop.yaml progress); the Supervisor is the BACKSTOP. Every tick, priority workflow first:
//
//   see      each running workflow's progress block and RCA (the same scripts/kernel/progress-rca.mjs the Kernel reads,
//            through api status): units passed per hour, running vs allowed parallelism, queued-ready, ETA, stall
//   own      a stall older than runtimes.yaml allocation.progress.supervisorGraceMs is a `progress-stall` owed action
//            of the Supervisor; an RCA cluster whose authority is the runtime (dead workers, binding defects, checker
//            unavailable) or another workflow is a `runtime-defect` owed action; an open kernel-proposal is a
//            `kernel-proposal` owed action (tier 2: land AUTO through a lane, forward IMPORTANT to the owner)
//   act      AUTO: notify the stalled Kernel (the sanctioned wake path) with its RCA and its top untried action, and
//            with `api dispatch-ready` when it holds queued-ready work under its allowed parallelism; the next tick
//            verifies the push (running before -> now)
//   record   one supervisor-rca event + typed decision row + a self lesson per new RCA; a supervisor-progress snapshot the
//            owner digest reads ("Vì sao chậm: ...")
//
//   node scripts/supervisor/progress-watch.mjs [--repo <path>]... [--no-notify] [--json]   one pass outside the tick
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { clipLine } from '../lib/clip.mjs';
import { hhmm } from '../lib/time.mjs';
import { progressLine, progressSettings, whyLine } from '../kernel/progress-rca.mjs';
import { PROPOSAL_KIND } from '../kernel/kernel-authority.mjs';
import { SUPERVISOR_WF, openSupervisorLedger, supervisorEvent, withSupervisorRead, productRepos } from './home.mjs';
import { supLog, refsOf } from './sup-log.mjs';
import { KINDS } from './lessons.mjs';

const selfFile = fileURLToPath(import.meta.url);
export const RCA_KIND = 'supervisor-rca';
export const PROGRESS_KIND = 'supervisor-progress';
export const PUSH_KIND = 'supervisor-progress-push';
const one = (s, n = 240) => clipLine(String(s ?? '').replace(/\s+/g, ' ').trim(), n);
const parse = (s) => parseJsonOr(s, {}) ?? {};

/** Open kernel-proposals of one product ledger: [{id, workflowId, title, tier, files, at}]. Never throws. */
export function openKernelProposals(repo) {
  let h = null;
  try {
    h = inspectLedger({ file: ledgerFileFor(repo) });
    const closed = new Set(h.db.prepare("SELECT entity_id FROM events WHERE kind='kernel-proposal-closed'").all().map((r) => r.entity_id));
    return h.db.prepare('SELECT workflow_id, entity_id, payload_json, created_at FROM events WHERE kind=? ORDER BY seq').all(PROPOSAL_KIND)
      .filter((r) => !closed.has(r.entity_id)).map((r) => ({ ...parse(r.payload_json), id: r.entity_id, workflowId: r.workflow_id, repo, at: Number(r.created_at) }));
  } catch { return []; } finally { try { h?.close(); } catch { /* closed */ } }
}

/** The newest supervisor event of `kind` per workflow id (payload.workflowId). */
const latestBy = (kind, env) => withSupervisorRead((db) => {
  const out = {};
  for (const r of db.prepare('SELECT payload_json, created_at FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT 200').all(SUPERVISOR_WF, kind)) {
    const p = parse(r.payload_json);
    if (p.workflowId && !out[p.workflowId]) out[p.workflowId] = { ...p, at: Number(r.created_at) };
  }
  return out;
}, {}, { env });

/** The Kernel notice for one stalled workflow. Pure. */
export function stallNotice(w, { lang = 'vi' } = {}) {
  const p = w.progress, r = w.rca;
  const top = (r?.actions ?? []).find((a) => !a.tried) ?? null;
  return [
    `PROGRESS-STALL ${p.stall.sinceMin}m: ${p.stall.reasons.join('; ')}.`,
    r ? `${whyLine(r, { language: lang }) ?? ''}` : '',
    p.queuedReady > 0 && p.running < p.allowedParallel ? `Chạy ngay: api dispatch-ready --workflow ${w.workflowId} (running ${p.running}/${p.allowedParallel}, ${p.queuedReady} ready).` : '',
    top ? `Hành động #${top.rank} [${top.tier}] ${top.title}. Log: api decide --workflow ${w.workflowId} --hypothesis "..." --action-key ${top.key} --metric "units/h". Run: ${top.command}` : '',
    'driver-loop.yaml progress: FIRST DUTY every wake.',
  ].filter(Boolean).join(' ');
}

/**
 * One pass over the running workflows the tick read (`flows.workflows`, each with its api status `progress` and
 * `rca`). Returns {owed, lines, records}. `notify(w, text, item)` delivers a Kernel notice (notify.mjs notifyKernel);
 * `acted` is actions.mjs actedOf (item -> last action) so a stall is notified at most once per supervisorGraceMs.
 */
export function progressDuty({ flows = {}, repos = [], env = process.env, now = Date.now(), settings = progressSettings(), notify = null, acted = { byKey: {} }, proposals = null }) {
  const ws = (flows.workflows ?? []).filter((w) => w.progress).sort((a, b) => (b.progress.priority - a.progress.priority) || ((b.progress.stall?.sinceMin ?? 0) - (a.progress.stall?.sinceMin ?? 0)));
  const owed = [], lines = [], records = [];
  const lastRca = latestBy(RCA_KIND, env);
  const lastPush = latestBy(PUSH_KIND, env);
  lines.push(`----- PROGRESS (priority first; allocation.progress) -----`);
  const snapshot = [];
  for (const w of ws) {
    const p = w.progress, r = w.rca;
    lines.push(`${p.priority ? 'PRIORITY ' : ''}${w.workflowId}: ${progressLine(p)}`);
    const why = r ? whyLine(r, { language: 'vi' }) : null;
    if (why) lines.push(`  ${why}`);
    for (const a of (r?.actions ?? []).slice(0, 3)) lines.push(`  #${a.rank} [${a.tier}]${a.tried ? ` (${a.tried.status})` : ''} ${a.title}`);
    const push = lastPush[w.workflowId];
    if (push && now - push.at < 3 * settings.supervisorGraceMs) lines.push(`  verify push ${hhmm(push.at)}: running ${push.running} -> ${p.running} (allowed ${p.allowedParallel})${p.running > push.running ? ' - worked' : ' - NOT improved'}`);
    snapshot.push({ workflowId: w.workflowId, priority: p.priority, line: progressLine(p), why, stalled: p.stall.stalled, supervisorDue: p.stall.supervisorDue,
      unitsDone: p.unitsDone, unitsTotal: p.unitsTotal, unitsPerHour: p.unitsPerHour, running: p.running, allowed: p.allowedParallel, eta: p.eta });
    // A new RCA (its cluster digest changed): one record, one typed row, one self lesson.
    if (r && r.id && lastRca[w.workflowId]?.rcaId !== r.id && (p.stall.stalled || r.trigger)) {
      records.push({ kind: RCA_KIND, payload: { workflowId: w.workflowId, repo: w.repo, rcaId: r.id, trigger: r.trigger, why,
        clusters: r.clusters.map((c) => ({ cause: c.cause, count: c.count, open: c.open, authority: c.authority, jobs: c.jobs.slice(0, 6), commits: c.commits })),
        actions: (r.actions ?? []).slice(0, 5).map((a) => ({ rank: a.rank, tier: a.tier, key: a.key, title: a.title, command: a.command, tried: a.tried })),
        progress: { unitsDone: p.unitsDone, unitsTotal: p.unitsTotal, unitsPerHour: p.unitsPerHour, running: p.running, allowed: p.allowedParallel, stall: p.stall } } });
    }
    // The Supervisor's own items: a stall past its grace, runtime/cross-workflow clusters.
    if (p.stall.supervisorDue) {
      const key = `progress|${w.workflowId}`;
      owed.push({ key, class: 'progress-stall', workflowId: w.workflowId, repo: w.repo, subject: w.workflowId,
        evidence: one(`${p.stall.sinceMin}m: ${p.stall.reasons.join('; ')}${why ? ` | ${why}` : ''}${r?.actions?.[0] ? ` | top: ${r.actions[0].title}` : ''}`, 400) });
      const last = acted.byKey?.[key]?.at ?? 0;
      if (notify && now - last >= settings.supervisorGraceMs) {
        const text = stallNotice(w);
        const res = notify(w, text, key);
        lines.push(`  notified the Kernel: ${res?.action ?? '?'}${res?.delivered ? ' (delivered)' : ''}`);
        if (p.queuedReady > 0 && p.running < p.allowedParallel) records.push({ kind: PUSH_KIND, payload: { workflowId: w.workflowId, running: p.running, allowed: p.allowedParallel, queuedReady: p.queuedReady, delivered: Boolean(res?.delivered) } });
      }
    }
    for (const c of r?.clusters ?? []) {
      if (c.authority !== 'supervisor' || c.count < settings.rca.minFailures) continue;
      owed.push({ key: `rca|${w.workflowId}|${c.cause}`, class: 'runtime-defect', workflowId: w.workflowId, repo: w.repo, subject: `${c.cause}-${w.workflowId}`, size: c.count,
        evidence: one(`RCA ${r.id} ${c.cause} x${c.count} (${c.open} open): ${c.why}; ${c.examples.slice(-2).join(' | ')}`, 400) });
    }
  }
  for (const pr of proposals ?? repos.flatMap(openKernelProposals)) {
    owed.push({ key: `kprop|${pr.id}`, class: 'kernel-proposal', workflowId: pr.workflowId, repo: pr.repo, subject: pr.id,
      evidence: one(`[${pr.tier ?? '?'}] ${pr.title}: ${pr.evidence ?? ''}${pr.patchFile ? ` (patch ${pr.patchFile})` : ''}`, 400) });
  }
  records.push({ kind: PROGRESS_KIND, payload: { workflows: snapshot } });
  return { owed, lines, records };
}

/** Write the duty's records to the supervisor ledger (+ typed rows, + a self lesson per new RCA). */
export function writeProgressRecords(records, { env = process.env, now = Date.now() } = {}) {
  if (!records.length) return;
  const l = openSupervisorLedger({ env });
  try {
    l.transaction(() => {
      for (const r of records) supervisorEvent(l, { entityType: 'progress', entityId: r.payload.workflowId ?? 'all', kind: r.kind, payload: r.payload, now });
      for (const r of records.filter((x) => x.kind === RCA_KIND)) {
        const top = r.payload.actions.find((a) => !a.tried) ?? r.payload.actions[0];
        supervisorEvent(l, { entityType: 'learning', entityId: `rca-${r.payload.rcaId}`, kind: KINDS.lesson, now, payload: {
          signature: `progress-stall:${r.payload.workflowId}`, source: 'self', weight: 1, status: 'rca',
          text: one(`${r.payload.workflowId} ${r.payload.why ?? ''}; top action: ${top ? `${top.title} (${top.key})` : 'none'}`, 600), refs: [`workflow:${r.payload.workflowId}`] } });
      }
    });
  } finally { l.close(); }
  for (const r of records.filter((x) => x.kind === RCA_KIND)) {
    const p = r.payload;
    supLog({ kind: 'decision', at: now, msg: `RCA ${p.rcaId} ${p.workflowId}: ${p.why ?? 'no open cluster'}`,
      data: { markdown: [`**RCA ${p.rcaId}** for ${p.workflowId} (trigger ${p.trigger ?? '-'})`, `Progress: ${p.progress.unitsDone}/${p.progress.unitsTotal} units, ${p.progress.unitsPerHour}/h, running ${p.progress.running}/${p.progress.allowed}${p.progress.stall?.stalled ? `, STALL: ${p.progress.stall.reasons.join('; ')}` : ''}`,
        'Clusters:', ...p.clusters.map((c) => `- ${c.cause} x${c.count} (${c.open} open, ${c.authority}): ${c.jobs.slice(0, 4).join(', ')}`),
        'Ranked actions:', ...p.actions.map((a) => `${a.rank}. [${a.tier}] ${a.title}\n   \`${a.command}\``)].join('\n') },
      refs: refsOf({ workflowId: p.workflowId, repo: p.repo, extra: [`rca:${p.rcaId}`] }) }, { env });
  }
}

/** The newest progress snapshot for the owner digest: lines, priority first. */
export const progressDigestLines = ({ env = process.env, language = 'vi' } = {}) => withSupervisorRead((db) => {
  const r = db.prepare('SELECT payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT 1').get(SUPERVISOR_WF, PROGRESS_KIND);
  const ws = parse(r?.payload_json).workflows ?? [];
  const head = language === 'vi' ? 'Tiến độ (ưu tiên trước)' : 'Progress (priority first)';
  return ws.length ? [`${head}:`, ...ws.slice(0, 8).flatMap((w) => [`- ${w.priority ? '[ưu tiên] ' : ''}${w.workflowId}: ${w.unitsDone}/${w.unitsTotal}, ${w.unitsPerHour}/h, chạy ${w.running}/${w.allowed}, ETA ${w.eta ? w.eta.slice(5, 16).replace('T', ' ') : '?'}${w.stalled ? ' - CHẬM' : ''}`,
    ...(w.why ? [`  ${w.why}`] : [])])] : [];
}, [], { env });

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const repos = argv.flatMap((a, i) => (a === '--repo' && argv[i + 1] ? [path.resolve(argv[i + 1])] : []));
  const { workflowFrontiers } = await import('./tick-duties.mjs');
  const { notifyKernel } = await import('./notify.mjs');
  const { actedOf } = await import('./actions.mjs');
  const list = repos.length ? repos : productRepos();
  const flows = workflowFrontiers({ repos: list });
  const acted = withSupervisorRead((db) => actedOf(db, { since: Date.now() - 7 * 24 * 3_600_000 }), { byKey: {}, byWorkflow: {} });
  const out = progressDuty({ flows, repos: list, acted, notify: argv.includes('--no-notify') ? null : (w, text, item) => notifyKernel({ repo: w.repo, workflowId: w.workflowId, text, item }) });
  writeProgressRecords(out.records);
  if (argv.includes('--json')) console.log(JSON.stringify({ ok: true, owed: out.owed, lines: out.lines, rca: out.records.filter((r) => r.kind === RCA_KIND).map((r) => r.payload) }, null, 2));
  else console.log([...out.lines, `----- ${out.owed.length} supervisor item(s) -----`, ...out.owed.map((i) => `[${i.class}] ${i.key}: ${i.evidence}`)].join('\n'));
}
