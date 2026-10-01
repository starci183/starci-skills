// api-lib/caller.mjs — who is calling: the op-caller guard of the kernel api (split out of
// api.mjs, lane slim-api). A worker running with unattended permissions can still read the
// ledger file or unset the marker; the api cannot stop raw file access, only refuse its verbs
// (modules/kernel/api.yaml conventions.callerBoundary).
export const OP_ROLE = 'op';

export const callerOf = (db, env = process.env) => {
  const handle = env.ORCA_TERMINAL_HANDLE || null;
  const byHandle = handle ? db.prepare(`SELECT job_id,workflow_id FROM jobs WHERE kind<>'kernel' AND (worker_id=?
      OR json_extract(payload_json,'$.managed.agentTerminalHandle')=? OR json_extract(payload_json,'$.orca.agentTerminalHandle')=?
      OR json_extract(payload_json,'$.hierarchy.runtime.terminalHandle')=?) ORDER BY updated_at DESC LIMIT 1`).get(handle, handle, handle, handle) : null;
  // The ledger's own binding decides: worker-start owns an op's environment, so the Orca terminal it runs in is the one
  // identity it carries (scripts/kernel/op-context.mjs reads the same binding).
  if (byHandle) return { role: OP_ROLE, jobId: byHandle.job_id, via: 'terminal-handle', handle };
  return { role: 'kernel', jobId: null, via: null, handle };
};

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
