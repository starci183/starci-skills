// debug-digest-machine.mjs — the machine-store reads of `starci debug digest`: the reconciler leader and controller modes, the
// Supervisor seat and its open Decision Items, the provider reservations and the Supervisor jobs. Read only, through one reader.
import fs from 'node:fs';
import path from 'node:path';
import { readMachine } from '../../engine/db/machine.mjs';
import { guardsRoot } from '../guards/guards-root.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { SUPERVISOR_SEAT } from '../machine/home.mjs';
import { supervisorWakeUsageOf } from '../kernel/wake-budget.mjs';
import { supervisorSeatOf } from './seat-cost.mjs';
import { supervisorLastSeenAt } from './supervisor-sign-of-life.mjs';
import { digestNumbers } from './debug-digest-numbers.mjs';
import { SIGNAL, signalRows } from '../machine/debug-signals.mjs';
import { machineBlobItems, mergeScans, scanBlobs, scanLogs } from './debug-secret-scan.mjs';
import { CONTROLLER_NAMES, LEADER_NAME, configuredMode, reconcilerConfig } from './state.mjs';

const KERNEL_SCOPE = /^[^:]+:([^:]+):kernel-attempt:\d+$/;

/** One query that must not blind the others: the rows, or `fallback` when the table or a column is missing. */
function ask(m, sql, args = [], fallback = []) {
  try { return m.db.prepare(sql).all(...args); } catch { return fallback; }
}

/** The engine starts the host remembers, newest first: the boot each named (reconciler.boot rows) and the process runs behind them. */
function startsOf(m) {
  const boots = ask(m, "SELECT at, data_json FROM machine_logs WHERE kind='reconciler.event' AND data_json LIKE '%reconciler.boot%' ORDER BY seq DESC LIMIT 100").map((r) => ({ at: r.at, ...parseJsonOr(r.data_json, {}) }))
    .filter((b) => b.kind === 'reconciler.boot').map((b) => ({ at: b.at, bootAt: b.bootAt, bootId: b.bootId, pid: b.pid }));
  const runs = ask(m, 'SELECT run_id, start_reason, started_at, ended_at, exit_reason FROM process_runs WHERE role=? ORDER BY run_id DESC LIMIT 100', ['engine'])
    .map((r) => ({ runId: r.run_id, startReason: r.start_reason, startedAt: r.started_at, endedAt: r.ended_at, exitReason: r.exit_reason }));
  return { boots, runs };
}

/**
 * When the runtime revision now leading took over: the `acquired_at` of the oldest leader epoch in the unbroken run of epochs at that revision, or null.
 * A departure of the wake path is judged from here, as the start hold judges failures by revision: the wakes of an older runtime are history.
 */
function revSinceOf(m, rev) {
  if (!rev) return null;
  let since = null;
  for (const row of ask(m, 'SELECT rev, acquired_at FROM leader_history ORDER BY epoch DESC LIMIT 200')) {
    if (row.rev !== rev) break;
    since = Number(row.acquired_at);
  }
  return since;
}

function engineOf(m) {
  const leader = ask(m, 'SELECT * FROM engine_leader WHERE name=?', [LEADER_NAME])[0] ?? null;
  const modes = Object.fromEntries(ask(m, 'SELECT controller, mode FROM controller_modes').map((r) => [r.controller, r.mode]));
  const safe = ask(m, "SELECT controller FROM controller_modes WHERE reason LIKE 'safe mode%'").map((r) => r.controller);
  const failingQueue = ask(m, 'SELECT controller, COUNT(*) AS n FROM engine_queue WHERE tries>0 GROUP BY controller')
    .map((r) => ({ controller: r.controller, n: Number(r.n) }));
  const config = reconcilerConfig();
  const configured = Object.fromEntries(CONTROLLER_NAMES.map((name) => [name, configuredMode(name, config)]));
  return { leader: leader ? { pid: leader.pid, epoch: leader.epoch, heartbeatAt: leader.heartbeat_at, rev: leader.rev } : null, revSince: revSinceOf(m, leader?.rev ?? null), modes, configured, safe, failingQueue, ...startsOf(m) };
}

function supervisorOf(m, since = null) {
  const seat = ask(m, 'SELECT * FROM seats WHERE seat_id=?', [SUPERVISOR_SEAT.seatId])[0] ?? null;
  // Deaf is the live seat's: refused inputs from before it booted belong to the seat it replaced.
  const deaf = ask(m, 'SELECT seat_id, last_input_failure_at FROM v_deaf_seats').some((r) => r.seat_id === SUPERVISOR_SEAT.seatId && Number(r.last_input_failure_at ?? 0) >= Number(seat?.booted_at ?? 0));
  const enabled = parseJsonOr(ask(m, 'SELECT value_json FROM sup_signals WHERE scope=?', [SUPERVISOR_SEAT.enabledScope])[0]?.value_json)?.enabled ?? null;
  const wake = ask(m, "SELECT MAX(created_at) AS at FROM sup_events WHERE kind='supervisor-wake'")[0]?.at ?? null;
  const decisions = ask(m, "SELECT di_id, kind, decider, due_at, summary, workflow_id FROM sup_decision_items WHERE status='open'")
    .map((d) => ({ id: d.di_id, kind: d.kind, decider: d.decider, dueAt: d.due_at ?? null, summary: d.summary, workflowId: d.workflow_id }));
  return { seat: seat ? { state: seat.state, terminalHandle: seat.terminal_handle, lastSeenAt: supervisorLastSeenAt(seat.last_seen_at, (sql) => ask(m, sql)), lastInputOkAt: seat.last_input_ok_at, deaf } : null,
    enabled, lastWakeAt: wake, wakes: supervisorWakeUsageOf(m.db), seatCost: supervisorSeatOf(m.db, { since: since ?? 0 }), decisions, health: null };
}

function reservationsOf(m) {
  return ask(m, 'SELECT id, provider, model, role, state, scope_json, created_at, updated_at, released_at FROM provider_reservations WHERE released_at IS NULL').map((r) => {
    const scope = parseJsonOr(r.scope_json) ?? {};
    const seat = scope.seat === SUPERVISOR_SEAT.id ? SUPERVISOR_SEAT.seatId : scope.seat ?? null;
    return { id: r.id, provider: r.provider, model: r.model, role: r.role, state: r.state, jobId: scope.jobId ?? null, seat,
      kernelWorkflow: KERNEL_SCOPE.exec(scope.scopeId ?? '')?.[1] ?? null, createdAt: r.created_at, updatedAt: r.updated_at, releasedAt: null };
  });
}

/** The provider circuit transitions on record, oldest first: what failed (job, step, failure kind, signal class), when, and until when the circuit was to stay open. */
function providerEventsOf(m, limit) {
  return ask(m, 'SELECT seq, provider, at, from_status, to_status, failure_kind, detail_json FROM provider_health_events ORDER BY seq DESC LIMIT ?', [limit]).reverse().map((r) => {
    const d = parseJsonOr(r.detail_json, {}) ?? {};
    return { seq: Number(r.seq), provider: r.provider, at: Number(r.at), from: r.from_status, to: r.to_status, failureKind: r.failure_kind, jobId: d.jobId ?? null, step: d.step ?? null,
      signal: typeof d.signal === 'string' ? d.signal.slice(0, 120) : null, circuitOpenUntil: Number.isFinite(Number(d.circuitOpenUntil)) ? Number(d.circuitOpenUntil) : null };
  });
}

/** The machine-level signals (debug-signals.mjs) and the secret scan of the artifacts this store holds. */
function signalsOf(m, n, readBlob) {
  const blobs = scanBlobs(machineBlobItems(m, { limit: n.secretScanArtifacts }), { maxBytes: n.secretScanBytes, ...(readBlob ? { readBlob } : {}) });
  return { runtimeChange: signalRows(m, SIGNAL.runtimeChange, { limit: n.signalRows }), hostDrift: signalRows(m, SIGNAL.hostDrift, { limit: n.signalRows }),
    portClaim: signalRows(m, SIGNAL.portClaim, { limit: n.signalRows }), secrets: mergeScans(blobs, scanLogs(m, { limit: n.secretScanArtifacts })) };
}

const REFUSAL_TAIL_BYTES = 1024 * 1024;

/** The guard refusals on record (<guards root>/refusals.jsonl, the newest megabyte): [{at, role, code, via, command}]; none when the file is absent. */
export function refusalFacts(env = process.env) {
  let text = '';
  try {
    const file = path.join(guardsRoot(undefined, env), 'refusals.jsonl');
    const size = fs.statSync(file).size;
    const fd = fs.openSync(file, 'r');
    try {
      const buf = Buffer.alloc(Math.min(size, REFUSAL_TAIL_BYTES));
      fs.readSync(fd, buf, 0, buf.length, size - buf.length);
      text = buf.toString('utf8');
    } finally { fs.closeSync(fd); }
  } catch { return []; }
  return text.split('\n').map((line) => parseJsonOr(line.trim(), null)).filter((row) => row?.code)
    .map((row) => ({ at: row.at ?? null, role: row.role ?? null, code: row.code, via: row.via ?? null, command: row.command ?? null }));
}

/** The machine facts of one digest, or null when there is no machine store. Seam: the reader. */
export function machineFacts({ env = process.env, read = readMachine, numbers = digestNumbers(), readBlob = undefined } = {}) {
  return read((m) => ({
    providerEvents: providerEventsOf(m, numbers.signalRows), ...signalsOf(m, numbers, readBlob),
    ledgers: ask(m, "SELECT ledger_id, name, repo_root, file FROM ledgers WHERE state='active' ORDER BY name"),
    engine: engineOf(m), supervisor: supervisorOf(m, revSinceOf(m, ask(m, 'SELECT rev FROM engine_leader')[0]?.rev ?? null)), reservations: reservationsOf(m),
    seats: ask(m, 'SELECT seat_id FROM seats').map((r) => r.seat_id),
    supJobs: ask(m, 'SELECT job_id, status FROM sup_jobs').map((r) => ({ jobId: r.job_id, status: r.status })),
    lands: ask(m, "SELECT run_id, lane, result, started_at, json_extract(specs_json,'$.loosening.id') AS id, json_extract(specs_json,'$.loosening.approved') AS approved FROM land_runs WHERE json_extract(specs_json,'$.loosening') IS NOT NULL ORDER BY run_id DESC LIMIT 50")
      .map((r) => ({ runId: r.run_id, lane: r.lane, result: r.result, at: r.started_at, id: r.id, approved: r.approved === 1 })),
  }), null, { env });
}
