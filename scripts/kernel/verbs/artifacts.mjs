// starci kernel artifacts — every indexed proof file of the workflow's jobs (job_artifacts), per job; read-only
// (scripts/kernel/job-artifacts.mjs listJobArtifacts). Split out of cli.mjs (lane slim-04); its help line
// stays in cli.mjs usage() (usageInCore).
//
//   artifacts --workflow <id> [--job <job_id>] [--kind <kind>]
import { listJobArtifacts } from '../job-artifacts.mjs';

export default {
  verb: 'artifacts',
  reads: true,
  required: ['workflow'],
  usageInCore: true,
  usage: '  artifacts --workflow <id> [--job <job_id>] [--kind <kind>]   every indexed proof file of the workflow\'s jobs (job_artifacts), per job',
  run({ ledger, args, emit }) {
    const out = { ok: true, ...listJobArtifacts(ledger.db, { workflowId: args.workflow, jobId: args.job ?? null, kind: args.kind ?? null, subkind: args.subkind ?? null }) };
    const rows = out.jobs.map((job) => {
      const kinds = Object.entries(job.byKind).map(([k, n]) => `${k}:${n}`).join(' ');
      const subkinds = Object.entries(job.bySubkind ?? {}).map(([k, n]) => `${k}:${n}`).join(' ');
      return `  ${job.jobId} ${job.opId ?? '-'} a${job.attempt ?? '-'} [${job.status ?? '-'}] ${kinds} (${subkinds})`;
    });
    emit(out, [`${out.total} artifact(s) across ${out.jobs.length} job(s) of ${args.workflow}`, ...rows].join('\n'), args.json);
  },
};
