// debug-digest-machine.mjs — the machine-store reads of `starci debug digest`: the reconciler leader and controller modes, the
// Supervisor seat and its open Decision Items, the provider reservations and the Supervisor jobs. Read only, through one reader.
import { readMachine } from '../../engine/db/machine.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { SUPERVISOR_SEAT } from '../machine/home.mjs';
import { supervisorWakeUsageOf } from '../kernel/wake-budget.mjs';
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

function engineOf(m) {
  const leader = ask(m, 'SELECT * FROM engine_leader WHERE name=?', [LEADER_NAME])[0] ?? null;
  const modes = Object.fromEntries(ask(m, 'SELECT controller, mode FROM controller_modes').map((r) => [r.controller, r.mode]));
  const safe = ask(m, "SELECT controller FROM controller_modes WHERE reason LIKE 'safe mode%'").map((r) => r.controller);
  const failingQueue = ask(m, 'SELECT controller, COUNT(*) AS n FROM engine_queue WHERE tries>0 GROUP BY controller')
    .map((r) => ({ controller: r.controller, n: Number(r.n) }));
  const config = reconcilerConfig();
  const configured = Object.fromEntries(CONTROLLER_NAMES.map((name) => [name, configuredMode(name, config)]));
  return { leader: leader ? { pid: leader.pid, epoch: leader.epoch, heartbeatAt: leader.heartbeat_at, rev: leader.rev } : null, modes, configured, safe, failingQueue, ...startsOf(m) };
}

function supervisorOf(m) {
  const seat = ask(m, 'SELECT * FROM seats WHERE seat_id=?', [SUPERVISOR_SEAT.seatId])[0] ?? null;
  const deaf = ask(m, 'SELECT seat_id FROM v_deaf_seats').some((r) => r.seat_id === SUPERVISOR_SEAT.seatId);
  const enabled = parseJsonOr(ask(m, 'SELECT value_json FROM sup_signals WHERE scope=?', [SUPERVISOR_SEAT.enabledScope])[0]?.value_json)?.enabled ?? null;
  const wake = ask(m, "SELECT MAX(created_at) AS at FROM sup_events WHERE kind='supervisor-wake'")[0]?.at ?? null;
  const decisions = ask(m, "SELECT di_id, kind, decider, due_at, summary, workflow_id FROM sup_decision_items WHERE status='open'")
    .map((d) => ({ id: d.di_id, kind: d.kind, decider: d.decider, dueAt: d.due_at ?? null, summary: d.summary, workflowId: d.workflow_id }));
  return { seat: seat ? { state: seat.state, terminalHandle: seat.terminal_handle, lastSeenAt: seat.last_seen_at, lastInputOkAt: seat.last_input_ok_at, deaf } : null,
    enabled, lastWakeAt: wake, wakes: supervisorWakeUsageOf(m.db), decisions, health: null };
}

function reservationsOf(m) {
  return ask(m, 'SELECT id, provider, model, role, state, scope_json, created_at, updated_at, released_at FROM provider_reservations WHERE released_at IS NULL').map((r) => {
    const scope = parseJsonOr(r.scope_json) ?? {};
    const seat = scope.seat === SUPERVISOR_SEAT.id ? SUPERVISOR_SEAT.seatId : scope.seat ?? null;
    return { id: r.id, provider: r.provider, model: r.model, role: r.role, state: r.state, jobId: scope.jobId ?? null, seat,
      kernelWorkflow: KERNEL_SCOPE.exec(scope.scopeId ?? '')?.[1] ?? null, createdAt: r.created_at, updatedAt: r.updated_at, releasedAt: null };
  });
}

/** The machine facts of one digest, or null when there is no machine store. Seam: the reader. */
export function machineFacts({ env = process.env, read = readMachine } = {}) {
  return read((m) => ({
    ledgers: ask(m, "SELECT ledger_id, name, repo_root, file FROM ledgers WHERE state='active' ORDER BY name"),
    engine: engineOf(m), supervisor: supervisorOf(m), reservations: reservationsOf(m),
    seats: ask(m, 'SELECT seat_id FROM seats').map((r) => r.seat_id),
    supJobs: ask(m, 'SELECT job_id, status FROM sup_jobs').map((r) => ({ jobId: r.job_id, status: r.status })),
  }), null, { env });
}
