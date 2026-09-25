// terminal-ledger.mjs — the facts the Orca-terminal projections read from a ledger.
//
// terminal-dedupe's stray plan and check-orca-tree's findings each grew the same list of
// payload fields a job's terminal can hide in, the same "still holds a worker" statuses and
// the same two SELECTs; start-supervisor reads the same facts through workers.mjs
// openWorkerHandles (the supervisor ledger) and identifies the terminal's agent through
// quit-agent.mjs agentOfTerminal. kernel/api.mjs carries the same field list at
// operationTerminalHandleOf - that file is reserved to the w2-api lanes.

/** Where a job row's terminal lives, in priority order: the worker column, then the payload. */
export const JOB_HANDLE_FIELDS = Object.freeze([
  'worker_id',
  'orca.agentTerminalHandle',
  'managed.agentTerminalHandle',
  'hierarchy.runtime.terminalHandle',
]);

/** The job statuses that still hold a live agent terminal (leased/queued jobs hold none yet). */
export const WORKER_HOLDING_STATUSES = Object.freeze(['running', 'answering']);

const parse = (text) => { try { return JSON.parse(text ?? 'null'); } catch { return null; } };
export const jobPayload = (row) => parse(row?.payload_json) ?? {};

/** The terminal handles one job row binds, JOB_HANDLE_FIELDS order, empty values dropped. */
export function jobTerminalHandles(row, payload = jobPayload(row)) {
  return [row?.worker_id, payload?.orca?.agentTerminalHandle, payload?.managed?.agentTerminalHandle,
    payload?.hierarchy?.runtime?.terminalHandle].filter(Boolean);
}

/** Every job row with its payload parsed: [{job_id, workflow_id, op_id, kind, status, worker_id, payload_json, payload}]. */
export const ledgerJobs = (db) =>
  db.prepare('SELECT job_id, workflow_id, op_id, kind, status, worker_id, payload_json FROM jobs').all()
    .map((row) => ({ ...row, payload: jobPayload(row) }));

/** The kernel-scope signals: [{key, expiresAt, value}] with value the parsed signal body ({terminal?, ...}). */
export const kernelSignalRows = (db) =>
  db.prepare("SELECT key, value_json, expires_at FROM signals WHERE scope='kernel'").all()
    .map((row) => ({ key: row.key, expiresAt: row.expires_at, value: parse(row.value_json) ?? {} }));

const normPath = (p) => String(p ?? '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

/** `child` is `root` itself or a path inside it (both spellings normalized: slashes, case, no trailing slash). */
export const pathUnder = (child, root) => {
  const a = normPath(child), b = normPath(root);
  return Boolean(a && b) && (a === b || a.startsWith(`${b}/`));
};
