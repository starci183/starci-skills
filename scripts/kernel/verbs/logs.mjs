// api logs — the workflow's typed rows, oldest first; the ledger's events are synced
// first (scripts/kernel/typed-logs.mjs). Split out of cli.mjs (lane slim-04); its help line stays in cli.mjs
// usage() (usageInCore).
//
//   logs --workflow <id> [--job <job_id>] [--after <seq>] [--kinds <csv>] [--limit <n>]
import { LOG_KINDS, openLogs, readLogs, syncLogs } from '../typed-logs.mjs';

export default {
  verb: 'logs',
  required: ['workflow'],
  usageInCore: true,
  usage: "  logs     --workflow <id> [--job <job_id>] [--after <seq>] [--kinds <csv>] [--limit <n>]   the workflow's typed log rows (events synced first)",
  run({ ledger, args, repo, emit, internals }) {
    if (!internals.getWorkflow(ledger.db, args.workflow)) throw Object.assign(new Error(`unknown workflow ${args.workflow}`), { code: 'workflow-unknown' });
    const kinds = args.kinds ? String(args.kinds).split(',').map((k) => k.trim()).filter(Boolean) : null;
    const unknown = (kinds ?? []).filter((k) => !LOG_KINDS[k]);
    if (unknown.length) throw Object.assign(new Error(`unknown log kind(s) ${unknown.join(', ')}`), { code: 'log-kind-unknown' });
    const logs = openLogs(repo);
    try {
      const synced = syncLogs(logs, ledger.db, { repo });
      const out = { ok: true, workflowId: args.workflow, ...readLogs(logs, { workflowId: args.workflow, jobIds: args.job ? [args.job] : null, after: Number(args.after ?? 0), kinds, limit: Number(args.limit ?? 500) }),
        synced: { derived: synced.derived.inserted } };
      const hhmm = (at) => new Date(at).toISOString().slice(11, 19);
      emit(out, out.rows.map((r) => `#${r.seq} ${hhmm(r.at)} ${r.actor.padEnd(7)} ${r.level === 'info' ? '    ' : r.level.toUpperCase().padEnd(4)} ${r.kind.padEnd(12)} ${r.jobId ?? '-'}  ${r.msg}`).join('\n') || '(no log rows)', args.json);
    } finally { logs.close(); }
  },
};
