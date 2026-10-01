// api log — one typed row (typed-logs.mjs) into the ledger's logs table - validated per kind,
// redacted, capped per job - through the process's buffered log writer (log-writer.mjs: its own
// connection, one short transaction, flushed before this returns), never an events row, so an op
// logging every step holds the ledger lock for milliseconds only. An op caller logs only for its
// own job and always as actor op; a Kernel logs as kernel (or names the runtime/check/land actor
// it speaks for). Split out of cli.mjs (lane slim-api); its help line stays in cli.mjs usage()
// (usageInCore).
//
//   log --workflow <id> [--job <job_id>] --kind <kind> --msg <text> [--data '<json>'] [--refs <csv>] [--level info|warn|error] [--node <id>] [--actor kernel|runtime|check|land]
import { getWorkflow } from './shared/rows.mjs';
import { OP_ROLE, refuseOpCaller } from '../../guards/op-caller.mjs';
import { appendLog, openLogs } from '../typed-logs.mjs';

export default {
  verb: 'log',
  required: ['workflow', 'kind', 'msg'],
  usageInCore: true,
  usage: "  log      --workflow <id> [--job <job_id>] --kind <kind> --msg <short text> [--data '<json>'] [--refs <csv>] [--level info|warn|error] [--node <work-graph node>] [--actor kernel|runtime|check|land]   one typed log row into the ledger's logs table",
  run({ ledger, args, repo, emit, caller }) {
    const db = ledger.db;
    if (!getWorkflow(db, args.workflow)) throw Object.assign(new Error(`unknown workflow ${args.workflow}`), { code: 'workflow-unknown' });
    if (caller.role === OP_ROLE && (!args.job || caller.jobId !== args.job)) {
      refuseOpCaller(ledger, { cmd: 'log', caller, code: 'log-identity-mismatch',
        detail: `operation ${caller.jobId ?? '(unbound)'} (${caller.via}) may log only for its own job (--job ${caller.jobId ?? '<its job>'}), not ${args.job ?? 'the workflow'}` });
    }
    if (args.job) {
      const job = db.prepare('SELECT job_id, workflow_id FROM jobs WHERE job_id=?').get(args.job);
      if (!job || job.workflow_id !== args.workflow) throw Object.assign(new Error(`job ${args.job} is not a job of ${args.workflow}`), { code: 'job-unknown' });
    }
    const actor = caller.role === OP_ROLE ? 'op' : (args.actor ?? 'kernel');
    if (caller.role !== OP_ROLE && !['kernel', 'runtime', 'check', 'land'].includes(actor)) throw Object.assign(new Error(`--actor must be kernel|runtime|check|land, got '${actor}'`), { code: 'log-actor-unknown' });
    let data = {};
    if (args.data != null) {
      try { data = JSON.parse(args.data); } catch (error) { throw Object.assign(new Error(`--data is not JSON: ${error.message}`), { code: 'log-data-invalid' }); }
    }
    const logs = openLogs(repo);
    try {
      const r = appendLog(logs, { workflowId: args.workflow, jobId: args.job ?? null, actor, nodeId: args.node ?? null, level: args.level ?? null, kind: args.kind, msg: args.msg, data, refs: args.refs ?? [] });
      const out = { ok: true, seq: r.seq, kind: r.row.kind, level: r.row.level, actor, ...(r.dropped ? { dropped: true, reason: 'per-job cap reached (log.truncated)' } : {}), ...(r.deferred ? { deferred: true } : {}) };
      emit(out, r.dropped ? `log dropped: ${args.job} reached its cap` : `log #${r.seq} ${r.row.kind} [${r.row.level}] ${r.row.msg}`, args.json);
    } finally { logs.close(); }
  },
};
