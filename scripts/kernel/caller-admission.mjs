// caller-admission.mjs — one invocation's current durable identity and mutation publication fence.
import { callerOf } from '../guards/op-caller.mjs';
import { kernelAuthorityOf } from './verbs/shared/kernel-seat.mjs';
import { kernelReadManifest, requireKernelRead } from './required-read.mjs';
import { revRootOf } from './runtime-rev.mjs';
import { withMutationFence, mutationAuthority } from '../lib/mutation-fence.mjs';
import { parseJson } from '../lib/json.mjs';
const refuse = (detail, code = 'kernel-caller-stale') => Object.assign(new Error(detail), { code });

const targetWorkflow = (db, args) => {
  const ids = new Set(args.workflow ? [String(args.workflow)] : []);
  if (args.job) { const row = db.prepare('SELECT workflow_id FROM jobs WHERE job_id=?').get(args.job); if (row) ids.add(row.workflow_id); }
  for (const id of [args.claim,args.resolve,args.escalate].filter(Boolean)) {
    const di = db.prepare('SELECT workflow_id FROM decision_items WHERE di_id=?').get(id);
    const incident = db.prepare('SELECT workflow_id FROM incidents WHERE incident_id=?').get(id);
    if (di?.workflow_id) ids.add(di.workflow_id);
    if (incident?.workflow_id) ids.add(incident.workflow_id);
  }
  return ids;
};

/** Capture existing owners once; each write/effect rechecks against those same actual owners. */
export function callerAdmission(ledger, args, { env = process.env, root = revRootOf(env), caller = null, resolve = callerOf, authorityOf = kernelAuthorityOf, manifestOf = kernelReadManifest } = {}) {
  const identity = caller ?? resolve(ledger.db,env,{ file: ledger.path });
  if (['unknown','foreign','stale'].includes(identity.role)) throw refuse(`caller custody ${identity.via ?? 'unknown'}`, 'kernel-caller-unknown');
  let authority = null, baseline = null;
  if (identity.role === 'kernel') {
    authority = authorityOf(ledger.db,identity.workflowId,identity.handle);
    baseline = manifestOf(ledger.db,identity.workflowId,{ root,authority,ops: args.op ? [args.op] : [],clean: false });
    if (args.by != null && !['kernel',`kernel:${authority.workflowId}`].includes(args.by)) throw refuse('--by does not match the current Kernel', 'kernel-caller-actor');
    args.by ??= 'kernel';
  } else if (identity.role === 'supervisor') {
    authority = { role: 'supervisor', ...identity.identity };
    if (args.by != null && args.by !== 'supervisor') throw refuse('--by does not match the actual Supervisor', 'kernel-caller-actor');
    args.by ??= 'supervisor';
  } else if (identity.role === 'owner') {
    if (args.by != null && /^(?:kernel|op)(?::|$)/.test(args.by)) throw refuse('an unbound owner cannot attest a managed actor', 'kernel-caller-actor');
  }
  const check = boundary => {
    const fresh = resolve(ledger.db,env,{ file: ledger.path });
    if (fresh.role !== identity.role || fresh.jobId !== identity.jobId || fresh.handle !== identity.handle) throw refuse('caller binding changed before mutation');
    if (identity.role === 'kernel') {
      if (boundary?.kind === 'ledger-write' && boundary.db !== ledger.db) throw refuse('Kernel write uses another ledger');
      // Finish may release this exact seat; only its captured terminal close remains admissible.
      if (boundary?.kind === 'kernel-terminal-close' && boundary.terminal === authority.terminal) {
        const wf = ledger.db.prepare('SELECT generation,phase FROM workflows WHERE workflow_id=?').get(authority.workflowId);
        const signal = ledger.db.prepare("SELECT token FROM signals WHERE scope='kernel' AND key=?").get(authority.workflowId);
        const end = ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='workflow-finished' ORDER BY seq DESC LIMIT 1").get(authority.workflowId);
        const endedJob = ledger.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(identity.jobId);
        const ended = parseJson(endedJob?.payload_json);
        if (wf?.phase === 'finished' && wf.generation === authority.generation && !signal
          && ended?.hierarchy?.attempt === authority.attempt && ended?.hierarchy?.generation === authority.generation
          && ended?.managed?.dispatchId === authority.dispatch && parseJson(end?.payload_json)?.kernelTerminal === authority.terminal) return;
      }
      const current = authorityOf(ledger.db,identity.workflowId,identity.handle);
      if (current.digest !== authority.digest) throw refuse('Kernel incarnation changed before mutation');
      const targets = targetWorkflow(ledger.db,args);
      if ([...targets].some(id => id !== authority.workflowId)) throw refuse('Kernel mutation targets another workflow');
      const currentReads = manifestOf(ledger.db,identity.workflowId,{ root,authority: current,ops: args.op ? [args.op] : [],clean: false });
      if (JSON.stringify(currentReads.files) !== JSON.stringify(baseline.files)) throw refuse('required bytes changed during this call', 'kernel-read-unverified');
    } else if (identity.role === 'op') {
      const latest = ledger.db.prepare('SELECT attempt_id,dispatch_id,terminal_handle FROM op_attempts WHERE job_id=? ORDER BY dispatch_seq DESC,attempt_id DESC LIMIT 1').get(identity.jobId);
      if (!latest || latest.terminal_handle !== identity.handle || latest.attempt_id !== identity.identity?.attempt_id
        || latest.dispatch_id !== identity.identity?.dispatch_id) throw refuse('operation report incarnation changed before mutation');
    } else if (identity.role === 'supervisor' && JSON.stringify(fresh.identity) !== JSON.stringify(identity.identity)) throw refuse('Supervisor incarnation changed before mutation');
  };
  const stamp = authority ? Object.freeze(Object.fromEntries(Object.entries(authority).filter(([key]) => key !== 'token'))) : null;
  return { caller: identity, authority: stamp, run: fn => withMutationFence(check,stamp,fn) };
}

/** The existing enqueue/dispatch boundary calls this only for a real admitted Kernel. */
export function requireAdmittedKernelRead(db, workflowId, op, { root = revRootOf() } = {}) {
  const authority = mutationAuthority();
  if (authority?.role === 'kernel') {
    if (workflowId !== authority.workflowId) throw refuse('new leg targets another workflow');
    requireKernelRead(db,workflowId,{ root,authority,op });
  }
}
