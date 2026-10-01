// op-context.mjs — which op a script runs for, read from the Orca terminal it runs in.
//
// Every agent launches through Orca worker-start, which owns the agent's environment: nothing the runtime sets reaches
// the op's shell, so no environment variable names its job, scratch or provider. Orca exports ORCA_TERMINAL_HANDLE
// into the terminal, and the dispatch binds that handle twice: the op's guard (<guards root>/terminals/<handle>.json,
// which names the ledger) and the ledger's own job record (api-lib/caller.mjs callerOf). The context is the job the
// LEDGER binds to the handle, with its latest attempt's scratch directory and provider (op_attempts); a terminal no op
// is bound to (the Kernel's, the owner's, a [Worker]'s) has none.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boundGuard } from './command-guard.mjs';
import { ledgerFileFor, openLedgerReader } from '../../engine/db/ledger.mjs';
import { callerOf, OP_ROLE } from './op-caller.mjs';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cache = new Map();

/**
 * opContextOf({env}) -> {jobId, workflowId, scratchDir, provider, dispatchId, handle, ledgerRepo} | null. Read once per process
 * and handle. Never throws: an unreadable binding or ledger is no context.
 */
export function opContextOf({ env = process.env, root = SKILL_ROOT } = {}) {
  const handle = env.ORCA_TERMINAL_HANDLE || null;
  if (!handle) return null;
  const key = `${root}\0${handle}`;
  if (cache.has(key)) return cache.get(key);
  let context = null;
  try {
    const guard = boundGuard(handle, { root });
    if (guard?.ledgerRepo) {
      const db = openLedgerReader(ledgerFileFor(guard.ledgerRepo, { env }));
      try {
        const caller = callerOf(db, { ORCA_TERMINAL_HANDLE: handle });
        if (caller.role === OP_ROLE && caller.jobId) {
          const job = db.prepare('SELECT job_id, workflow_id FROM jobs WHERE job_id=?').get(caller.jobId);
          const attempt = db.prepare('SELECT scratch_dir, provider, dispatch_id FROM op_attempts WHERE job_id=? ORDER BY dispatch_seq DESC, attempt_id DESC LIMIT 1').get(caller.jobId);
          context = { jobId: job.job_id, workflowId: job.workflow_id, scratchDir: attempt?.scratch_dir ?? null, provider: attempt?.provider ?? null, dispatchId: attempt?.dispatch_id ?? null, handle, ledgerRepo: path.resolve(guard.ledgerRepo) };
        }
      } finally { db.close(); }
    }
  } catch { context = null; }
  cache.set(key, context);
  return context;
}
