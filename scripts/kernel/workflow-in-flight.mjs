// workflow-in-flight.mjs - which ops of a workflow are IN FLIGHT: an attempt whose worker is alive (or whose liveness cannot be proven
// either way). A job that is not settled but whose worker is gone - a reported job after a host restart, a running job whose terminal
// vanished - holds no tree: it is not in flight, and the custody repair of a workflow tree (starci workflow custody --apply) may proceed.
import { TERMINAL_JOB_STATUSES } from '../machine/worktree-registry.mjs';
import { terminalShow } from '../api/orca/terminal-show.mjs';
import { TERMINAL_GONE_CODES } from '../lib/orca-terminal.mjs';
import { operationTerminalHandleOf } from './verbs/shared/rows.mjs';
import { parseJson } from '../lib/json.mjs';

/** Worker states: `live` answers an Orca terminal read, `gone` is proven absent, `unknown` is an unreadable host or a job with no handle. */
export const WORKER_STATES = Object.freeze({ live: 'live', gone: 'gone', unknown: 'unknown' });

// A leased job with no worker bound is a launch: alive until its lease deadline.
const launchState = (row, now) => {
  const deadline = Number(row.deadline);
  return deadline > 0 && deadline <= now ? WORKER_STATES.gone : WORKER_STATES.live;
};

// The state the Orca terminal answer proves.
const shownState = (shown) => {
  if (shown?.hostUnavailable) return WORKER_STATES.unknown;
  if (shown?.ok) return shown.connected ? WORKER_STATES.live : WORKER_STATES.gone;
  return TERMINAL_GONE_CODES.has(shown?.errorCode) ? WORKER_STATES.gone : WORKER_STATES.unknown;
};

/** The worker state of one job row: {state, terminal}. `show` reads one terminal handle (scripts/api/orca/terminal-show.mjs). */
export function workerStateOf(row, { show = terminalShow, now = Date.now(), reported = false } = {}) {
  const payload = parseJson(row.payload_json, {}) ?? {};
  const terminal = operationTerminalHandleOf(row, payload);
  if (!terminal) {
    if (row.status === 'leased') return { state: launchState(row, now), terminal: null };
    return { state: reported ? WORKER_STATES.gone : WORKER_STATES.unknown, terminal: null };
  }
  return { state: shownState(show({ terminal })), terminal };
}

/**
 * The op jobs of `workflowId` that are in flight: [{jobId, status, state, terminal}] for every job that holds the tree
 * (part A's TERMINAL_JOB_STATUSES) and whose worker is not proven gone.
 */
export function inFlightOps(db, workflowId, { show = terminalShow, now = Date.now() } = {}) {
  const marks = TERMINAL_JOB_STATUSES.map(() => '?').join(',');
  const rows = db.prepare(`SELECT job_id, status, worker_id, deadline, payload_json FROM jobs WHERE workflow_id=? AND kind='op' AND status IN (${marks})`).all(workflowId, ...TERMINAL_JOB_STATUSES);
  return rows.map((row) => ({ jobId: row.job_id, status: row.status, ...workerStateOf(row, { show, now, reported: row.status === 'reported' }) }))
    .filter((item) => item.state !== WORKER_STATES.gone);
}
