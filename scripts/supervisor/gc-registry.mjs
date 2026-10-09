// gc-registry.mjs - what the GC reads and records about the machine and the ledgers (scripts/supervisor/gc.mjs): when an idle-shell
// candidate was first seen and what a run closed or collected (machine.sqlite), the Supervisor's own view, and one product
// ledger's view with its lease rows.
import fs from 'node:fs';
import path from 'node:path';
import { inspectLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { workflowNameOf } from '../lib/display-names.mjs';
import { jobTerminalHandles, ledgerJobs, kernelSignalRows } from '../machine/terminal-ledger.mjs';
import { seatOf, readSupervisor, withSupervisor, supervisedSeatHandles } from '../machine/home.mjs';
import { jobsOf } from './workers.mjs';

/* ------------------------------------------------------------ state: when a candidate was first seen (machine.sqlite) */

/** {seen: {handle: firstSeenMs}}: the open terminals rows' opened_at (the first sighting of an idle-shell candidate). */
export function readState(env = process.env) {
  return { seen: readSupervisor((m) => Object.fromEntries(m.db.prepare('SELECT handle, opened_at FROM terminals WHERE closed_at IS NULL AND opened_at IS NOT NULL').all()
    .map((r) => [r.handle, Number(r.opened_at)])), {}, { env }) };
}

/** The GC collector of a report item's class (gc_items.collector). */
const collectorOf = (klass) => ({ 'idle-shell': 'shells', lane: 'lanes', evidence: 'evidence', tmp: 'tmp', lease: 'leases', 'lane-log': 'lanelogs', process: 'processes' }[klass] ?? 'agents');

/** The first sighting of each idle-shell candidate: a terminals row created when absent, its opened_at set when empty. */
const recordSightings = (m, seen) => {
  for (const [handle, s] of Object.entries(seen)) {
    const row = m.db.prepare('SELECT opened_at FROM terminals WHERE handle=?').get(handle);
    if (!row) m.upsertTerminal({ handle, title: s.title ?? null, role: 'shell', openedAt: s.at });
    else if (row.opened_at == null) m.update('terminals', { opened_at: s.at }, { handle });
  }
};

/** One gc_items row per collected / refused / kept item of an apply run. */
const recordItems = (m, runId, report) => {
  for (const i of report.items) {
    m.recordGcItem({ runId, collector: collectorOf(i.class), kind: i.action ?? i.class, target: String(i.target), ownerRef: i.owner ? String(i.owner) : null,
      action: i.ok === false ? 'failed' : i.verdict ?? 'keep', reason: String(i.reason ?? '').slice(0, 2000), bytes: i.bytes ?? i.ramBytes ?? null,
      lastError: i.error ? String(i.error).slice(0, 2000) : null, outcome: (i.ok === true && 'done') || (i.ok === false && 'gave-up') || 'dropped', verifiedGoneAt: i.ok === true ? m.now() : null });
  }
};

/**
 * The run's machine records: a candidate shell's first sighting (terminals.opened_at, a row created when absent),
 * a closed terminal (terminals.closed_at, verified), and - for an apply run - one gc_runs row with one gc_items row per
 * collected / refused / kept item and its final outcome (done | dropped | gave-up). Returns the gc_runs id or null.
 */
export function writeState({ seen = {}, closed = [], report = null, trigger = 'sweep', startedAt = Date.now() } = {}, env = process.env) {
  try {
    return withSupervisor((m) => m.transaction(() => {
      recordSightings(m, seen);
      for (const handle of closed) m.closeTerminal(handle, { by: 'gc', verified: true });
      if (!report?.apply) return null;
      const runId = m.startGcRun({ trigger, startedAt, collectors: [...new Set(report.items.map((i) => collectorOf(i.class)))] });
      recordItems(m, runId, report);
      m.finishGcRun(runId, { freedBytes: report.counts.freedBytes, counts: report.counts, errors: report.errors, report });
      return runId;
    }), { env });
  } catch { return null; /* the next run re-learns the first sightings */ }
}

/* ------------------------------------------------------------ registry: what the ledgers own */

/** The Supervisor's view (machine.sqlite): {seat, jobs: [{jobId, status, cluster, handle, staging, stagingPath, branch, base, runId, dispatch}], leases}. */
export function supervisorView({ env = process.env, now = Date.now() } = {}) {
  return readSupervisor((m) => {
    const seat = seatOf(m, now);
    const jobs = jobsOf(m).map((r) => {
      const p = r.payload ?? {};
      return { jobId: r.job_id, status: r.status, cluster: p.cluster ?? null, handle: r.worker_id ?? null, self: p.self === true,
        staging: p.staging ?? null, stagingPath: p.staging?.path ?? null, branch: p.staging?.branch ?? null, base: p.staging?.base ?? null, runId: p.runId ?? null, dispatch: p.dispatch ?? null, updatedAt: r.updated_at };
    });
    return { seat: seat ? { handle: seat.value?.terminal ?? null, live: !seat.expired && !seat.starting } : null,
      seatHandles: [...supervisedSeatHandles(m)], jobs, leases: supLeaseRowsOf(m) };
  }, { seat: null, jobs: [], leases: [] }, { env });
}

/** The sup_leases rows in leaseRowsOf's shape (resourceKey file:<path>; no workflow). */
const supLeaseRowsOf = (m) => m.db.prepare(`SELECT 'file:' || l.path resourceKey, l.job_id jobId, NULL workflowId, l.acquired_at acquiredAt, l.expires_at expiresAt,
    j.status jobStatus, j.updated_at jobUpdatedAt, NULL phase, NULL archivedAt, NULL workflowUpdatedAt FROM sup_leases l LEFT JOIN sup_jobs j ON j.job_id=l.job_id`).all();

/** One product ledger's view: {repo, workflows: [{workflowId, name, ended, endedAt, kernelHandle}], jobs: [{jobId, workflowId, kind, status, handles}]}. */
export function ledgerView(repo) {
  const file = ledgerFileFor(repo);
  if (!fs.existsSync(file)) return null;
  const h = inspectLedger({ file });
  try {
    const db = h.db;
    const signals = new Map(kernelSignalRows(db).map((s) => [s.key, s.value?.terminal ?? null]));
    const purged = new Set((() => { try { return db.prepare("SELECT workflow_id FROM workflow_purges WHERE state='purged'").all().map((r) => r.workflow_id); } catch { return []; } })());
    const workflows = db.prepare('SELECT workflow_id, phase, archived_at, updated_at FROM workflows').all().map((w) => ({
      workflowId: w.workflow_id, name: (() => { try { return workflowNameOf(db, w.workflow_id); } catch { return null; } })(),
      ended: w.phase === 'finished' || w.archived_at != null, endedAt: w.archived_at ?? (w.phase === 'finished' ? w.updated_at : null),
      purged: purged.has(w.workflow_id), kernelHandle: signals.get(w.workflow_id) ?? null }));
    const updatedAt = new Map((() => { try { return db.prepare('SELECT job_id, updated_at FROM jobs').all().map((r) => [r.job_id, r.updated_at]); } catch { return []; } })());
    const jobs = ledgerJobs(db).map((j) => ({ jobId: j.job_id, workflowId: j.workflow_id, kind: j.kind, status: j.status, updatedAt: updatedAt.get(j.job_id) ?? null,
      handles: [...new Set([...jobTerminalHandles(j, j.payload), j.payload?.launchTerminal?.handle].filter(Boolean))] }));
    return { repo: path.resolve(repo), workflows, jobs, leases: leaseRowsOf(db), launchRuns: failedLaunchRunsOf(db) };
  } finally { h.close(); }
}

/**
 * The Orca Runs of Kernel launches that failed: no job names them (the launch died before a job existed), so the agents collector never listed their
 * workers and a dead agent TUI such a launch left stayed open and unowned (Nivo 2026-10-09: one dead codex terminal per retry).
 */
function failedLaunchRunsOf(db) {
  try {
    return [...new Set(db.prepare("SELECT payload_json FROM events WHERE kind='kernel-start-failed' ORDER BY seq DESC LIMIT 200").all()
      .map((row) => { try { return JSON.parse(row.payload_json)?.runId; } catch { return null; } }).filter((run) => typeof run === 'string' && run))];
  } catch { return []; }
}

/** Every lease row of a ledger with its job's and workflow's state (the leases collector's input). */
function leaseRowsOf(db) {
  try {
    return db.prepare(`SELECT l.resource_key resourceKey, l.job_id jobId, l.workflow_id workflowId, l.acquired_at acquiredAt, l.expires_at expiresAt,
        j.status jobStatus, j.updated_at jobUpdatedAt, w.phase phase, w.archived_at archivedAt, w.updated_at workflowUpdatedAt
      FROM leases l LEFT JOIN jobs j ON j.job_id=l.job_id LEFT JOIN workflows w ON w.workflow_id=l.workflow_id`).all();
  } catch { return []; }
}
