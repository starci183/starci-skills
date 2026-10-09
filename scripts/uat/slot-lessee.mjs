// slot-lessee.mjs - who a UAT slot is leased to, and whether that lessee still exists.
//
// A slot is leased by one `uat-slots run` process on behalf of one op attempt (the attempt's STARCI_JOB_SCRATCH names it in op_attempts) that
// asked for a held command (a Playwright run and the app server it starts). The lease records, with the identity of each process (pid,
// creation time and command line, so a reused pid never reads as the old process): itself, the process that launched it (the owner), the
// held command (the child), the attempt's scratch directory, the Orca terminal and the directory it runs from. The lessee has ended when
// its attempt ended (settled or worker-dead) or when its owner process is gone; a lease that recorded neither is judged by age alone.
import { processList } from '../api/process/process-list.mjs';

const CMD_KEY = 200;

/** The identity of process `pid` in a process table: {pid, created, cmd}, or null when the table holds no such process. */
export function identityOf(pid, rows) {
  const row = (rows ?? []).find((p) => p.pid === pid);
  return row ? { pid, created: row.created || null, cmd: String(row.cmd ?? '').slice(0, CMD_KEY) } : null;
}

/** Whether the process `identity` names is alive in the table: same pid, same creation time (where the platform gives one) and command line. */
export function identityLive(identity, rows) {
  const row = identity ? (rows ?? []).find((p) => p.pid === identity.pid) : null;
  if (!row) return false;
  if (identity.created && row.created && identity.created !== row.created) return false;
  return String(row.cmd ?? '').slice(0, CMD_KEY) === identity.cmd;
}

/** The lessee a `uat-slots run` records: its own, its launcher's and its held command's identity, the attempt's scratch and terminal, its directory. */
export function lesseeRecord({ env = process.env, cwd = process.cwd(), self = process.pid, parent = process.ppid, child = null, list = processList } = {}) {
  const rows = list({ cmdMax: CMD_KEY }) ?? [];
  return { self: identityOf(self, rows), owner: identityOf(parent, rows), child: child ? identityOf(child, rows) : null,
    scratchDir: env.STARCI_JOB_SCRATCH ?? null, terminal: env.ORCA_TERMINAL_HANDLE ?? null, cwd };
}

/** The newest attempt that ran in `scratchDir` across the registered ledgers: {ended, endState}, or null when none names it. */
export function attemptEnded(scratchDir, readMachine, options = {}) {
  if (!scratchDir) return null;
  return readMachine((m) => {
    const found = m.forEachLedger(({ db }) => db.prepare('SELECT end_state, settled_at FROM op_attempts WHERE scratch_dir=? ORDER BY attempt_id DESC LIMIT 1').get(scratchDir));
    const row = found.map((entry) => entry.result).find(Boolean);
    return row ? { ended: row.end_state != null || row.settled_at != null, endState: row.end_state ?? (row.settled_at == null ? null : 'settled') } : null;
  }, null, options);
}

/**
 * The state of a lease's lessee: {state: 'live'} or {state, why} with state ended | owner-gone | unknown-overdue. `attempt` is attemptEnded's answer,
 * `rows` the process table, `heldMs` how long the lease has been held; a lease that names no owner is live until it has been held `unknownHoldMs`.
 */
export function lesseeVerdict({ lessee, rows, attempt = null, heldMs, unknownHoldMs }) {
  if (attempt?.ended) return { state: 'ended', why: `its attempt ended (${attempt.endState})` };
  if (lessee?.owner) {
    return identityLive(lessee.owner, rows) ? { state: 'live' } : { state: 'owner-gone', why: `the process that leased it (pid ${lessee.owner.pid}) is gone` };
  }
  return heldMs > unknownHoldMs ? { state: 'unknown-overdue', why: `it names no lessee and has been held ${Math.round(heldMs / 60_000)} minutes` } : { state: 'live' };
}
