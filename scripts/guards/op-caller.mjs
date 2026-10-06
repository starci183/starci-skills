// op-caller.mjs — actual managed identities, history and the existing unbound owner ingress.
import path from 'node:path';
import { boundIdentityOf } from './rights.mjs';
import { openMachineObserver } from '../../engine/db/machine.mjs';
import { openLedgerReader } from '../../engine/db/ledger.mjs';
import { ledgerJobs, jobTerminalHandles, KERNEL_LAUNCH_EVENTS } from '../machine/terminal-ledger.mjs';
import { parseJson } from '../lib/json.mjs';
export const OP_ROLE = 'op';

const ledgerCaller = (db, handle) => {
  const job = ledgerJobs(db).find(row => jobTerminalHandles(row).includes(handle));
  if (job) {
    const attempt = job.kind === 'kernel' ? null : db.prepare('SELECT attempt_id,dispatch_id,terminal_handle FROM op_attempts WHERE job_id=? ORDER BY dispatch_seq DESC,attempt_id DESC LIMIT 1').get(job.job_id);
    return { role: job.kind === 'kernel' ? 'kernel' : OP_ROLE, jobId: job.job_id, workflowId: job.workflow_id, via: 'terminal-handle', handle, ...(attempt ? { identity: attempt } : {}) };
  }
  const attempt = db.prepare('SELECT job_id,workflow_id,attempt_id,dispatch_id,terminal_handle FROM op_attempts WHERE terminal_handle=? ORDER BY attempt_id DESC LIMIT 1').get(handle);
  if (attempt) return { role: OP_ROLE, jobId: attempt.job_id, workflowId: attempt.workflow_id, via: 'attempt-history', handle, identity: attempt };
  for (const row of db.prepare(`SELECT workflow_id,payload_json FROM events WHERE kind IN (${KERNEL_LAUNCH_EVENTS.map(() => '?').join(',')}) ORDER BY seq DESC`).all(...KERNEL_LAUNCH_EVENTS)) {
    const payload = parseJson(row.payload_json);
    if (payload?.terminal === handle || payload?.managed?.agentTerminalHandle === handle)
      return { role: 'kernel', jobId: `kernel-${row.workflow_id}`, workflowId: row.workflow_id, via: 'launch-history', handle };
  }
  return null;
};

const supervisorCaller = (m, handle, now) => {
  const seat = m.db.prepare("SELECT * FROM seats WHERE role='supervisor' AND terminal_handle=?").get(handle);
  if (seat) {
    const detail = parseJson(seat.detail_json), value = detail?.value;
    if (seat.state !== 'live' || !detail?.token || (detail.expiresAt != null && detail.expiresAt <= now)
      || value?.terminal !== handle || !value.dispatch || !Number.isInteger(value.attempt))
      return { role: 'stale', via: 'supervisor-seat', handle };
    return { role: 'supervisor', handle, via: 'supervisor-seat', identity: { seat: seat.seat_id, token: detail.token, attempt: value.attempt, dispatch: value.dispatch, terminal: handle } };
  }
  const attempt = m.db.prepare(`SELECT a.attempt_id,a.job_id,a.closed_at,a.dispatch_seq,j.status FROM sup_attempts a
    JOIN sup_jobs j ON j.job_id=a.job_id WHERE a.terminal_handle=? ORDER BY a.attempt_id DESC LIMIT 1`).get(handle);
  if (attempt) {
    const latest = m.db.prepare('SELECT max(attempt_id) AS id FROM sup_attempts WHERE job_id=?').get(attempt.job_id);
    if (attempt.closed_at != null || latest.id !== attempt.attempt_id || !['running','reported','landing'].includes(attempt.status))
      return { role: 'stale', via: 'supervisor-attempt', handle };
    return { role: 'supervisor', jobId: attempt.job_id, handle, via: 'supervisor-attempt', identity: { job: attempt.job_id, attempt: attempt.attempt_id, dispatch: attempt.dispatch_seq, terminal: handle } };
  }
  // Delivery history survives seat replacement and never grants the old terminal owner ingress.
  const prior = m.db.prepare("SELECT d.delivery_id FROM deliveries d JOIN seats s ON s.seat_id=d.seat_id WHERE s.role='supervisor' AND d.terminal_handle=? LIMIT 1").get(handle);
  return prior ? { role: 'stale', via: 'managed-delivery-history', handle } : null;
};

/** The local-ledger caller versus its managed binding: a contradiction is 'unknown', agreement is the local row. */
const localCallerVerdict = (local, bound, handle) => {
  if (bound.guard && (bound.guard.jobId !== local.jobId || bound.guard.workflowId !== local.workflowId))
    return { role: 'unknown', jobId: local.jobId, handle, via: 'contradictory-managed-binding' };
  if (bound.seat && bound.seat.role !== local.role) return { role: 'unknown', jobId: local.jobId, handle, via: 'contradictory-seat-binding' };
  return local;
};

/** The handle's history in every OTHER registered ledger, as a foreign caller, or null. */
const foreignLedgerCaller = (m, { handle, file, reader }) => {
  for (const ledger of m.listLedgers({ includeRetired: true })) {
    if (!ledger.file || (file && path.resolve(ledger.file) === path.resolve(file))) continue;
    let other;
    try {
      other = reader(ledger.file);
      const foreign = ledgerCaller(other, handle);
      if (foreign) return { ...foreign, role: 'foreign', via: 'registered-ledger-history' };
    } finally { other?.close(); }
  }
  return null;
};

/** Resolve actual custody; failed reads never become an unbound owner. No role/actor env claim is consulted. */
export function callerOf(db, env = process.env, { file = null, root, machine = openMachineObserver, reader = openLedgerReader, binding = boundIdentityOf, now = Date.now() } = {}) {
  const handle = env.ORCA_TERMINAL_HANDLE || null;
  if (!handle) return { role: 'owner', jobId: null, handle, via: 'unbound' };
  let m;
  try {
    const local = ledgerCaller(db, handle);
    const bound = binding(handle, { root, env });
    if (local) return localCallerVerdict(local, bound, handle);
    m = machine({ env });
    const supervisor = m ? supervisorCaller(m, handle, now) : null;
    if (supervisor) return supervisor;
    if (bound.guard || bound.seat) return { role: 'stale', jobId: bound.guard?.jobId ?? null, workflowId: bound.guard?.workflowId ?? null, handle, via: 'managed-binding' };
    const foreign = m ? foreignLedgerCaller(m, { handle, file, reader }) : null;
    if (foreign) return foreign;
    return { role: 'owner', jobId: null, handle, via: 'unbound' };
  } catch (error) { return { role: 'unknown', jobId: null, handle, via: 'read-unavailable', error: String(error?.message ?? error) }; }
  finally { m?.close(); }
}

export const refuseOpCaller = (ledger, { cmd, caller, code, detail }) => {
  const job = caller.jobId ? ledger.db.prepare('SELECT job_id,workflow_id FROM jobs WHERE job_id=?').get(caller.jobId) : null;
  if (job) {
    try {
      ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id,
        kind: 'op-caller-refused', payload: { verb: cmd, code, via: caller.via, terminal: caller.handle } }));
    } catch { /* the refusal stands without its receipt */ }
  }
  console.error(JSON.stringify({ ok: false, error: detail, code, verb: cmd, caller: { role: caller.role, jobId: caller.jobId, via: caller.via } }));
  process.exit(1);
};
